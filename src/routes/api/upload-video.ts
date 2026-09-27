import { createFileRoute } from "@tanstack/react-router";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const MAX_FILE_SIZE = 900 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

function getB2Client() {
  const endpoint = process.env.B2_ENDPOINT;
  const region = process.env.B2_REGION;
  const keyId = process.env.B2_KEY_ID;
  const applicationKey = process.env.B2_APPLICATION_KEY;

  if (!endpoint || !region || !keyId || !applicationKey) {
    throw new Error("Configuração do Backblaze B2 não está disponível.");
  }

  return new S3Client({
    endpoint,
    region,
    credentials: {
      accessKeyId: keyId,
      secretAccessKey: applicationKey,
    },
  });
}

function getBucket() {
  const bucket = process.env.B2_BUCKET;

  if (!bucket) {
    throw new Error("B2_BUCKET não está configurado.");
  }

  return bucket;
}

export const Route = createFileRoute("/api/upload-video")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            filename?: string;
            contentType?: string;
            size?: number;
          };

          const filename =
            typeof body.filename === "string" ? body.filename : "";

          const contentType =
            typeof body.contentType === "string" ? body.contentType : "";

          const size =
            typeof body.size === "number" && Number.isFinite(body.size)
              ? body.size
              : 0;

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
                  "Tipo de vídeo não permitido. Use MP4, WebM ou MOV.",
              },
              { status: 400 },
            );
          }

          if (size <= 0) {
            return Response.json(
              { error: "Tamanho do arquivo inválido." },
              { status: 400 },
            );
          }

          if (size > MAX_FILE_SIZE) {
            return Response.json(
              { error: "O vídeo ultrapassa o limite de 900 MB." },
              { status: 400 },
            );
          }

          const extension =
            filename.includes(".")
              ? filename.slice(filename.lastIndexOf(".")).toLowerCase()
              : "";

          const safeExtension =
            extension && /^[.a-z0-9]+$/.test(extension)
              ? extension
              : contentType === "video/mp4"
                ? ".mp4"
                : contentType === "video/webm"
                  ? ".webm"
                  : ".mov";

          const key = `hikari/episodes/${crypto.randomUUID()}${safeExtension}`;

          const client = getB2Client();
          const bucket = getBucket();

          const command = new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            ContentType: contentType,
          });

          const uploadUrl = await getSignedUrl(client, command, {
            expiresIn: 3600,
          });

          const videoUrl = `/api/upload-video?key=${encodeURIComponent(key)}`;

          return Response.json({
            uploadUrl,
            videoUrl,
            key,
          });
        } catch (error) {
          console.error("Erro ao preparar upload do B2:", error);

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

          const client = getB2Client();
          const bucket = getBucket();

          const command = new GetObjectCommand({
            Bucket: bucket,
            Key: key,
          });

          const signedUrl = await getSignedUrl(client, command, {
            expiresIn: 3600,
          });

          return Response.redirect(signedUrl, 302);
        } catch (error) {
          console.error("Erro ao gerar URL do B2:", error);

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
