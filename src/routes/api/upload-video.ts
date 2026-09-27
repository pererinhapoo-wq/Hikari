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
  const accessKeyId = process.env.B2_KEY_ID;
  const secretAccessKey = process.env.B2_APPLICATION_KEY;

  if (!endpoint) {
    throw new Error("B2_ENDPOINT não está configurado.");
  }

  if (!region) {
    throw new Error("B2_REGION não está configurado.");
  }

  if (!accessKeyId) {
    throw new Error("B2_KEY_ID não está configurado.");
  }

  if (!secretAccessKey) {
    throw new Error("B2_APPLICATION_KEY não está configurado.");
  }

  return new S3Client({
    endpoint,
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
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

export async function POST({ request }: { request: Request }) {
  try {
    const body = await request.json();

    const filename =
      typeof body.filename === "string" ? body.filename.trim() : "";

    const contentType =
      typeof body.contentType === "string" ? body.contentType.trim() : "";

    const size = Number(body.size);

    if (!filename) {
      return Response.json(
        { error: "Nome do arquivo não informado." },
        { status: 400 },
      );
    }

    if (!ALLOWED_TYPES.has(contentType)) {
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

    const extension =
      filename.includes(".")
        ? filename.slice(filename.lastIndexOf(".")).toLowerCase()
        : "";

    const safeExtension =
      extension === ".mp4" ||
      extension === ".webm" ||
      extension === ".mov"
        ? extension
        : ".mp4";

    const key = `hikari/episodes/${crypto.randomUUID()}${safeExtension}`;

    const client = getB2Client();
    const bucket = getBucket();

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(client, command, {
      expiresIn: 60 * 15,
    });

    const endpoint = process.env.B2_ENDPOINT;

    if (!endpoint) {
      throw new Error("B2_ENDPOINT não está configurado.");
    }

    const videoUrl = `${endpoint.replace(/\/$/, "")}/${bucket}/${key}`;

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
    const url = new URL(request.url);
    const key = url.searchParams.get("key");

    if (!key) {
      return Response.json(
        { error: "Key não informada." },
        { status: 400 },
      );
    }

    if (!key.startsWith("hikari/episodes/")) {
      return Response.json(
        { error: "Key inválida." },
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
}
