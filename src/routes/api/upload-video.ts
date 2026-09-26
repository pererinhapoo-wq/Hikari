import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createFileRoute } from "@tanstack/react-router";

const MAX_FILE_SIZE = 900 * 1024 * 1024;

const ALLOWED_CONTENT_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

function getB2Config() {
  const endpoint = process.env.B2_ENDPOINT;
  const bucket = process.env.B2_BUCKET;
  const accessKeyId = process.env.B2_KEY_ID;
  const secretAccessKey = process.env.B2_APPLICATION_KEY;

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error("As variáveis do Backblaze B2 não estão configuradas.");
  }

  const regionMatch = endpoint.match(/s3\.([^.]+)\.backblazeb2\.com/);
  const region = regionMatch?.[1];

  if (!region) {
    throw new Error("Não foi possível identificar a região do Backblaze B2.");
  }

  return {
    endpoint,
    bucket,
    region,
    accessKeyId,
    secretAccessKey,
  };
}

function createB2Client() {
  const config = getB2Config();

  return new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

function sanitizeFileName(fileName: string) {
  const normalized = fileName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");

  const safeName = normalized
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return safeName || "video";
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

          const filename = body.filename?.trim();
          const contentType = body.contentType?.trim();
          const size = Number(body.size);

          if (!filename) {
            return Response.json(
              { error: "Nome do arquivo não informado." },
              { status: 400 },
            );
          }

          if (!contentType || !ALLOWED_CONTENT_TYPES.has(contentType)) {
            return Response.json(
              { error: "Tipo de vídeo não permitido." },
              { status: 400 },
            );
          }

          if (!Number.isFinite(size) || size <= 0) {
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

          const config = getB2Config();
          const client = createB2Client();

          const safeName = sanitizeFileName(filename);
          const uniqueName = `${Date.now()}-${crypto.randomUUID()}-${safeName}`;
          const key = `hikari/episodes/${uniqueName}`;

          const command = new PutObjectCommand({
            Bucket: config.bucket,
            Key: key,
            ContentType: contentType,
          });

          const uploadUrl = await getSignedUrl(client, command, {
            expiresIn: 60 * 60,
          });

          const videoUrl = `/api/upload-video?key=${encodeURIComponent(key)}`;

          return Response.json({
            uploadUrl,
            videoUrl,
            key,
          });
        } catch (error) {
          console.error("Erro ao gerar URL do Backblaze B2:", error);

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
              { error: "Arquivo não informado." },
              { status: 400 },
            );
          }

          if (!key.startsWith("hikari/episodes/")) {
            return Response.json(
              { error: "Arquivo inválido." },
              { status: 400 },
            );
          }

          const config = getB2Config();
          const client = createB2Client();

          const command = new GetObjectCommand({
            Bucket: config.bucket,
            Key: key,
          });

          const signedUrl = await getSignedUrl(client, command, {
            expiresIn: 60 * 60,
          });

          return Response.redirect(signedUrl, 302);
        } catch (error) {
          console.error("Erro ao gerar URL de reprodução do B2:", error);

          return Response.json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : "Falha ao acessar o vídeo.",
            },
            { status: 500 },
          );
        }
      },
    },
  },
});
