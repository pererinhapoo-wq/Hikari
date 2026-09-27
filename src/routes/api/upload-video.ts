import { createFileRoute } from "@tanstack/react-router";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const endpoint = process.env.B2_ENDPOINT;
const bucket = process.env.B2_BUCKET;
const region =
  process.env.B2_REGION ||
  endpoint?.match(/s3\.([^.]+)\.backblazeb2\.com/)?.[1] ||
  "us-east-005";

if (!endpoint || !bucket) {
  console.error("B2 não configurado: B2_ENDPOINT ou B2_BUCKET ausente.");
}

const b2 = new S3Client({
  endpoint,
  region,
  credentials: {
    accessKeyId: process.env.B2_KEY_ID || "",
    secretAccessKey: process.env.B2_APPLICATION_KEY || "",
  },
});

export const Route = createFileRoute("/api/upload-video")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();

          const filename =
            typeof body.filename === "string" ? body.filename : "";
          const contentType =
            typeof body.contentType === "string"
              ? body.contentType
              : "application/octet-stream";
          const size = Number(body.size);

          const allowedTypes = [
            "video/mp4",
            "video/webm",
            "video/quicktime",
          ];

          if (!filename) {
            return Response.json(
              { error: "Nome do arquivo não informado." },
              { status: 400 },
            );
          }

          if (!allowedTypes.includes(contentType)) {
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

          const maxSize = 900 * 1024 * 1024;

          if (size > maxSize) {
            return Response.json(
              { error: "O vídeo ultrapassa o limite de 900 MB." },
              { status: 400 },
            );
          }

          const safeName = filename
            .replace(/[^a-zA-Z0-9._-]/g, "_")
            .replace(/_+/g, "_");

          const key = `hikari/episodes/${Date.now()}-${crypto.randomUUID()}-${safeName}`;

          const command = new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            ContentType: contentType,
          });

          const uploadUrl = await getSignedUrl(b2, command, {
            expiresIn: 60 * 15,
          });

          const videoCommand = new GetObjectCommand({
            Bucket: bucket,
            Key: key,
          });

          const videoUrl = await getSignedUrl(b2, videoCommand, {
            expiresIn: 60 * 60 * 24 * 7,
          });

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

          if (!key || !key.startsWith("hikari/episodes/")) {
            return Response.json(
              { error: "Chave de vídeo inválida." },
              { status: 400 },
            );
          }

          const command = new GetObjectCommand({
            Bucket: bucket,
            Key: key,
          });

          const signedUrl = await getSignedUrl(b2, command, {
            expiresIn: 60 * 60 * 24 * 7,
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
