import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const endpoint = process.env.B2_ENDPOINT;
const bucket = process.env.B2_BUCKET;
const keyId = process.env.B2_KEY_ID;
const applicationKey = process.env.B2_APPLICATION_KEY;

const region =
  process.env.B2_REGION ||
  endpoint?.match(/s3\.([^.]+)\.backblazeb2\.com/)?.[1] ||
  "us-east-005";

const s3 =
  endpoint && bucket && keyId && applicationKey
    ? new S3Client({
        endpoint,
        region,
        credentials: {
          accessKeyId: keyId,
          secretAccessKey: applicationKey,
        },
      })
    : null;

const MAX_SIZE = 900 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

function getConfigError() {
  if (!endpoint) return "B2_ENDPOINT não está configurado.";
  if (!bucket) return "B2_BUCKET não está configurado.";
  if (!keyId) return "B2_KEY_ID não está configurado.";
  if (!applicationKey) return "B2_APPLICATION_KEY não está configurado.";

  return null;
}

export async function POST({ request }: { request: Request }) {
  try {
    const configError = getConfigError();

    if (configError || !s3 || !bucket) {
      return Response.json(
        {
          error: configError ?? "Backblaze B2 não está configurado.",
        },
        { status: 500 },
      );
    }

    const body = await request.json();

    const filename =
      typeof body?.filename === "string" ? body.filename.trim() : "";

    const contentType =
      typeof body?.contentType === "string"
        ? body.contentType.trim()
        : "";

    const size =
      typeof body?.size === "number" ? body.size : 0;

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

    if (size > MAX_SIZE) {
      return Response.json(
        {
          error: "O vídeo ultrapassa o limite de 900 MB.",
        },
        { status: 400 },
      );
    }

    const safeFilename = filename
      .replace(/\\/g, "/")
      .split("/")
      .pop()
      ?.replace(/[^a-zA-Z0-9._-]/g, "_") || "video.mp4";

    const key = `hikari/episodes/${crypto.randomUUID()}-${safeFilename}`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3, command, {
      expiresIn: 60 * 30,
    });

    const videoUrl = `/api/upload-video?key=${encodeURIComponent(key)}`;

    return Response.json({
      uploadUrl,
      videoUrl,
      key,
    });
  } catch (error) {
    console.error("Erro ao preparar upload para o Backblaze B2:", error);

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
}

export async function GET({ request }: { request: Request }) {
  try {
    const configError = getConfigError();

    if (configError || !s3 || !bucket) {
      return Response.json(
        {
          error: configError ?? "Backblaze B2 não está configurado.",
        },
        { status: 500 },
      );
    }

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

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const signedUrl = await getSignedUrl(s3, command, {
      expiresIn: 60 * 60,
    });

    return Response.redirect(signedUrl, 302);
  } catch (error) {
    console.error("Erro ao gerar URL do vídeo B2:", error);

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
  }
