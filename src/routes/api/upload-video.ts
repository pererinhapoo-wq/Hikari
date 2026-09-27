import { createFileRoute } from "@tanstack/react-router";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const endpoint = process.env.B2_ENDPOINT;
const region = process.env.B2_REGION;
const bucket = process.env.B2_BUCKET;
const keyId = process.env.B2_KEY_ID;
const applicationKey = process.env.B2_APPLICATION_KEY;

const s3 =
  endpoint && region && keyId && applicationKey
    ? new S3Client({
        endpoint,
        region,
        credentials: {
          accessKeyId: keyId,
          secretAccessKey: applicationKey,
        },
      })
    : null;

const ALLOWED_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

const MAX_SIZE = 900 * 1024 * 1024;

function jsonError(message: string, status = 400) {
  return Response.json(
    {
      error: message,
    },
    {
      status,
    },
  );
}

async function handlePost({ request }: { request: Request }) {
  try {
    if (!s3 || !bucket) {
      return jsonError(
        "Backblaze B2 não está configurado no servidor.",
        500,
      );
    }

    const body = await request.json();

    const filename =
      typeof body?.filename === "string"
        ? body.filename
        : "video.mp4";

    const contentType =
      typeof body?.contentType === "string"
        ? body.contentType
        : "";

    const size = Number(body?.size);

    if (!ALLOWED_TYPES.has(contentType)) {
      return jsonError("Tipo de vídeo não permitido.");
    }

    if (
      !Number.isFinite(size) ||
      size <= 0 ||
      size > MAX_SIZE
    ) {
      return jsonError(
        "Tamanho do vídeo inválido ou acima de 900 MB.",
      );
    }

    const lowerFilename = filename.toLowerCase();

    const extension = lowerFilename.endsWith(".webm")
      ? ".webm"
      : lowerFilename.endsWith(".mov")
        ? ".mov"
        : ".mp4";

    const key = `hikari/episodes/${crypto.randomUUID()}${extension}`;

    const uploadUrl = await getSignedUrl(
      s3,
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: contentType,
      }),
      {
        expiresIn: 60 * 60,
      },
    );

    const videoUrl =
      `/api/upload-video?key=${encodeURIComponent(key)}`;

    return Response.json({
      uploadUrl,
      videoUrl,
      key,
    });
  } catch (error) {
    console.error(
      "Erro ao preparar upload do Backblaze B2:",
      error,
    );

    return jsonError(
      error instanceof Error
        ? `Falha ao preparar o upload: ${error.message}`
        : "Falha ao preparar o upload.",
      500,
    );
  }
}

async function handleGet({ request }: { request: Request }) {
  try {
    if (!s3 || !bucket) {
      return jsonError(
        "Backblaze B2 não está configurado no servidor.",
        500,
      );
    }

    const url = new URL(request.url);
    const key = url.searchParams.get("key");

    if (!key || !key.startsWith("hikari/episodes/")) {
      return jsonError("Chave de vídeo inválida.");
    }

    const downloadUrl = await getSignedUrl(
      s3,
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
      {
        expiresIn: 60 * 60,
      },
    );

    return Response.redirect(downloadUrl, 302);
  } catch (error) {
    console.error(
      "Erro ao preparar download do Backblaze B2:",
      error,
    );

    return jsonError(
      error instanceof Error
        ? `Falha ao preparar o vídeo: ${error.message}`
        : "Falha ao preparar o vídeo.",
      500,
    );
  }
}

export const Route = createFileRoute("/api/upload-video")({
  server: {
    handlers: {
      POST: handlePost,
      GET: handleGet,
    },
  },
});
