import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
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
  endpoint && keyId && applicationKey
    ? new S3Client({
        endpoint,
        region,
        credentials: {
          accessKeyId: keyId,
          secretAccessKey: applicationKey,
        },
      })
    : null;

type UploadBody = {
  filename?: string;
  contentType?: string;
  size?: number;
};

const MAX_SIZE = 900 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

function sanitizeFilename(filename: string) {
  const cleaned = filename
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_");

  return cleaned || "video.mp4";
}

function jsonError(message: string, status = 400) {
  return Response.json(
    {
      error: message,
    },
    { status },
  );
}

export async function POST({ request }: { request: Request }) {
  try {
    if (!s3 || !endpoint || !bucket || !keyId || !applicationKey) {
      console.error("Configuração do Backblaze B2 incompleta.", {
        hasEndpoint: Boolean(endpoint),
        hasBucket: Boolean(bucket),
        hasKeyId: Boolean(keyId),
        hasApplicationKey: Boolean(applicationKey),
      });

      return jsonError(
        "Backblaze B2 não está configurado corretamente no servidor.",
        500,
      );
    }

    let body: UploadBody;

    try {
      body = (await request.json()) as UploadBody;
    } catch {
      return jsonError("Corpo da requisição inválido.");
    }

    const filename =
      typeof body.filename === "string" && body.filename.trim()
        ? body.filename
        : "video.mp4";

    const contentType =
      typeof body.contentType === "string" ? body.contentType : "";

    const size =
      typeof body.size === "number" && Number.isFinite(body.size)
        ? body.size
        : 0;

    if (!ALLOWED_TYPES.has(contentType)) {
      return jsonError(
        "Tipo de vídeo não permitido. Use MP4, WebM ou MOV.",
      );
    }

    if (size <= 0) {
      return jsonError("Tamanho do vídeo inválido.");
    }

    if (size > MAX_SIZE) {
      return jsonError("O vídeo ultrapassa o limite de 900 MB.");
    }

    const safeFilename = sanitizeFilename(filename);

    const key = `hikari/episodes/${crypto.randomUUID()}-${safeFilename}`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3, command, {
      expiresIn: 60 * 15,
    });

    const videoUrl = `/api/upload-video?key=${encodeURIComponent(key)}`;

    return Response.json({
      uploadUrl,
      videoUrl,
      key,
    });
  } catch (error) {
    console.error("Erro ao preparar upload para o Backblaze B2:", error);

    return jsonError(
      error instanceof Error
        ? error.message
        : "Falha ao preparar o upload.",
      500,
    );
  }
}

export async function GET({ request }: { request: Request }) {
  try {
    if (!s3 || !bucket) {
      return jsonError(
        "Backblaze B2 não está configurado corretamente no servidor.",
        500,
      );
    }

    const url = new URL(request.url);
    const key = url.searchParams.get("key");

    if (!key) {
      return jsonError("Chave do vídeo não informada.");
    }

    if (!key.startsWith("hikari/episodes/")) {
      return jsonError("Chave do vídeo inválida.", 403);
    }

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const videoUrl = await getSignedUrl(s3, command, {
      expiresIn: 60 * 60,
    });

    return Response.redirect(videoUrl, 302);
  } catch (error) {
    console.error("Erro ao gerar URL do vídeo no Backblaze B2:", error);

    return jsonError(
      error instanceof Error
        ? error.message
        : "Falha ao gerar URL do vídeo.",
      500,
    );
  }
      }
