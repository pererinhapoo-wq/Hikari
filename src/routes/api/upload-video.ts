import { createFileRoute } from "@tanstack/react-router";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const MAX_UPLOAD_SIZE = 900 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

type UploadBody = {
  filename?: string;
  contentType?: string;
  size?: number;
};

function getB2Client() {
  const endpoint = process.env.B2_ENDPOINT;
  const region = process.env.B2_REGION;
  const bucket = process.env.B2_BUCKET;
  const keyId = process.env.B2_KEY_ID;
  const applicationKey = process.env.B2_APPLICATION_KEY;

  if (!endpoint || !region || !bucket || !keyId || !applicationKey) {
    throw new Error(
      "Configuração do Backblaze B2 incompleta. Verifique B2_ENDPOINT, B2_REGION, B2_BUCKET, B2_KEY_ID e B2_APPLICATION_KEY.",
    );
  }

  return {
    client: new S3Client({
      endpoint,
      region,
      forcePathStyle: true,
      credentials: {
        accessKeyId: keyId,
        secretAccessKey: applicationKey,
      },
    }),
    bucket,
  };
}

function sanitizeFilename(filename: string) {
  const cleaned = filename
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_");

  return cleaned || "video.mp4";
}

export const Route = createFileRoute("/api/upload-video")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as UploadBody;

          const filename =
            typeof body.filename === "string" ? body.filename : "";

          const contentType =
            typeof body.contentType === "string" ? body.contentType : "";

          const size = typeof body.size === "number" ? body.size : 0;

          if (!filename) {
            return Response.json(
              { error: "Nome do arquivo não informado." },
              { status: 400 },
            );
          }

          if (!ALLOWED_TYPES.has(contentType)) {
            return Response.json(
              {
                error:
                  "Tipo de vídeo não permitido. Use MP4, WebM ou QuickTime.",
              },
              { status: 400 },
            );
          }

          if (!Number.isFinite(size) || size <= 0) {
            return Response.json(
              { error: "Tamanho do arquivo inválido." },
              { status: 400 },
            );
          }

          if (size > MAX_UPLOAD_SIZE) {
            return Response.json(
              { error: "O vídeo ultrapassa o limite de 900 MB." },
              { status: 400 },
            );
          }

          const { client, bucket } = getB2Client();

          const safeFilename = sanitizeFilename(filename);

          const key = `hikari/episodes/${crypto.randomUUID()}-${safeFilename}`;

          const command = new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            ContentType: contentType,
          });

          const uploadUrl = await getSignedUrl(client, command, {
            expiresIn: 15 * 60,
          });

          const origin = new URL(request.url).origin;

          const videoUrl =
            `${origin}/api/upload-video?key=${encodeURIComponent(key)}`;

          return Response.json({
            uploadUrl,
            videoUrl,
            key,
          });
        } catch (error) {
          console.error(
            "Erro ao preparar upload para o Backblaze B2:",
            error,
          );

          return Response.json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : "Falha ao preparar o upload.",
            },
            { status: 500 },
          );
        }
      },

      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const key = url.searchParams.get("key");

          if (!key) {
            return Response.json(
              { error: "Chave do vídeo não informada." },
              { status: 400 },
            );
          }

          if (!key.startsWith("hikari/episodes/")) {
            return Response.json(
              { error: "Chave de vídeo inválida." },
              { status: 400 },
            );
          }

          const { client, bucket } = getB2Client();

          const command = new GetObjectCommand({
            Bucket: bucket,
            Key: key,
          });

          const signedUrl = await getSignedUrl(client, command, {
            expiresIn: 60 * 60,
          });

          return Response.redirect(signedUrl, 302);
        } catch (error) {
          console.error("Erro ao gerar URL do vídeo:", error);

          return Response.json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : "Falha ao gerar URL do vídeo.",
            },
            { status: 500 },
          );
        }
      },
    },
  },
});
