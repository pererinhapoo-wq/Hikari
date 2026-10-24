import { createFileRoute } from "@tanstack/react-router";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { assertAdminResponse } from "@/lib/auth/admin.server";

const ALLOWED_CONTENT_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
] as const;

type AllowedContentType = (typeof ALLOWED_CONTENT_TYPES)[number];

const MAX_FILE_SIZE = 900 * 1024 * 1024; // 900 MB em bytes

function getSafeExtension(filename: string, contentType: string): string {
  const mimeMap: Record<string, string> = {
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
  };

  if (mimeMap[contentType]) {
    return mimeMap[contentType];
  }

  const parts = filename.split(".");
  if (parts.length > 1) {
    const rawExt = parts.pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
    if (["mp4", "webm", "mov"].includes(rawExt)) {
      return rawExt;
    }
  }

  return "mp4";
}

function sanitizeBaseName(filename: string): string {
  const nameWithoutExt = filename.substring(0, filename.lastIndexOf(".")) || filename;
  const clean = nameWithoutExt
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return clean.slice(0, 50) || "video";
}

async function handlePost({ request }: { request: Request }) {
  try {
    // 1. Verificação estrita de autenticação e autorização administrativa (401 se deslogado, 403 se não-admin)
    const authError = await assertAdminResponse(request);
    if (authError) return authError;

    // 2. Leitura e validação do corpo da requisição
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return Response.json(
        { error: "Corpo da requisição deve ser um JSON válido." },
        { status: 400 },
      );
    }

    const filename = typeof body.filename === "string" ? body.filename.trim() : "";
    const contentType = typeof body.contentType === "string" ? body.contentType.trim().toLowerCase() : "";
    const size = typeof body.size === "number" ? body.size : Number(body.size);

    if (!filename) {
      return Response.json(
        { error: "O nome do arquivo ('filename') é obrigatório." },
        { status: 400 },
      );
    }

    if (!ALLOWED_CONTENT_TYPES.includes(contentType as AllowedContentType)) {
      return Response.json(
        {
          error: `Tipo de arquivo não permitido ('${contentType}'). Tipos aceitos: MP4, WebM e QuickTime.`,
        },
        { status: 400 },
      );
    }

    if (isNaN(size) || size <= 0) {
      return Response.json(
        { error: "Tamanho do arquivo inválido." },
        { status: 400 },
      );
    }

    if (size > MAX_FILE_SIZE) {
      return Response.json(
        { error: "O arquivo excede o limite máximo permitido de 900 MB." },
        { status: 400 },
      );
    }

    // 3. Obtenção e validação das variáveis de ambiente do Backblaze B2 (servidor)
    const keyId =
      process.env.B2_APPLICATION_KEY_ID?.trim() ||
      process.env.B2_KEY_ID?.trim() ||
      process.env.AWS_ACCESS_KEY_ID?.trim();

    const applicationKey =
      process.env.B2_APPLICATION_KEY?.trim() ||
      process.env.B2_APP_KEY?.trim() ||
      process.env.AWS_SECRET_ACCESS_KEY?.trim();

    const bucketName =
      process.env.B2_BUCKET_NAME?.trim() ||
      process.env.B2_BUCKET?.trim() ||
      process.env.AWS_BUCKET_NAME?.trim();

    const endpoint =
      process.env.B2_ENDPOINT?.trim() ||
      process.env.AWS_ENDPOINT_URL_S3?.trim();

    const region =
      process.env.B2_REGION?.trim() ||
      process.env.AWS_REGION?.trim() ||
      "us-east-005";

    const publicBaseUrl =
      process.env.B2_PUBLIC_URL?.trim() ||
      process.env.B2_DOWNLOAD_URL?.trim();

    if (!keyId || !applicationKey || !bucketName || !endpoint) {
      return Response.json(
        {
          error:
            "Configuração do Backblaze B2 não encontrada no servidor. " +
            "Variáveis necessárias: B2_APPLICATION_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET_NAME, B2_ENDPOINT.",
        },
        { status: 500 },
      );
    }

    // 4. Construção da chave segura e isolada no bucket (sem aceitar caminhos arbitrários do cliente)
    const ext = getSafeExtension(filename, contentType);
    const safeName = sanitizeBaseName(filename);
    const uniqueId = crypto.randomUUID().slice(0, 12);
    const key = `hikari/episodes/player4/${Date.now()}-${uniqueId}-${safeName}.${ext}`;

    // 5. Instanciação do cliente S3 para o Backblaze B2
    const s3Client = new S3Client({
      endpoint,
      region,
      credentials: {
        accessKeyId: keyId,
        secretAccessKey: applicationKey,
      },
    });

    const putCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: contentType,
      ContentLength: size,
    });

    // 6. Geração da URL pré-assinada para upload via PUT (expira em 1 hora)
    const uploadUrl = await getSignedUrl(s3Client, putCommand, {
      expiresIn: 3600,
    });

    // 7. Determinação da URL pública final do vídeo
    let videoUrl: string;
    if (publicBaseUrl) {
      const baseClean = publicBaseUrl.replace(/\/+$/, "");
      videoUrl = `${baseClean}/${key}`;
    } else {
      // Formato padrão amigável S3/B2
      const endpointHost = endpoint.replace(/^https?:\/\//, "").replace(/\/+$/, "");
      videoUrl = `https://${bucketName}.${endpointHost}/${key}`;
    }

    // 8. Resposta estritamente limitada aos dados necessários pelo cliente
    return Response.json({
      uploadUrl,
      videoUrl,
      key,
    });
  } catch (error) {
    console.error("[upload-video-player4] Erro ao preparar upload:", error);

    const message =
      error instanceof Error ? error.message : "Erro interno ao processar requisição.";

    return Response.json(
      {
        error: `Falha ao gerar URL de upload: ${message}`,
      },
      { status: 500 },
    );
  }
}

export const Route = createFileRoute("/api/upload-video-player4")({
  server: {
    handlers: {
      POST: handlePost,
    },
  },
});
