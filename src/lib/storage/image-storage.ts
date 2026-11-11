import { put } from "@vercel/blob";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { auth } from "@/lib/auth/server";
import { requireAdminUser } from "@/lib/auth/admin-guard";

/**
 * HIKARI — Categorias Oficiais de Armazenamento de Imagens
 */
export const IMAGE_CATEGORIES = [
  "anime-covers",
  "anime-banners",
  "season-images",
  "episode-thumbnails",
  "profile-avatars",
  "profile-banners",
  "comment-images",
] as const;

export type ImageCategory = (typeof IMAGE_CATEGORIES)[number];

export interface CategoryPolicy {
  readonly folder: string;
  readonly maxSizeBytes: number;
  readonly allowedMimeTypes: readonly string[];
  readonly requiresAdmin: boolean;
  readonly description: string;
}

export const CATEGORY_POLICIES: Record<ImageCategory, CategoryPolicy> = {
  "anime-covers": {
    folder: "hikari/covers",
    maxSizeBytes: 5 * 1024 * 1024, // 5 MB
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    requiresAdmin: true,
    description: "Capas oficiais de animes",
  },
  "anime-banners": {
    folder: "hikari/banners",
    maxSizeBytes: 8 * 1024 * 1024, // 8 MB
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    requiresAdmin: true,
    description: "Banners horizontais oficiais de animes",
  },
  "season-images": {
    folder: "hikari/seasons",
    maxSizeBytes: 8 * 1024 * 1024, // 8 MB
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    requiresAdmin: true,
    description: "Imagens e pôsteres de temporadas",
  },
  "episode-thumbnails": {
    folder: "hikari/thumbnails",
    maxSizeBytes: 5 * 1024 * 1024, // 5 MB
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    requiresAdmin: true,
    description: "Miniaturas de episódios capturadas ou enviadas",
  },
  "profile-avatars": {
    folder: "hikari/avatars",
    maxSizeBytes: 3 * 1024 * 1024, // 3 MB
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    requiresAdmin: false,
    description: "Fotos de perfil de usuários",
  },
  "profile-banners": {
    folder: "hikari/profile-banners",
    maxSizeBytes: 5 * 1024 * 1024, // 5 MB
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    requiresAdmin: false,
    description: "Banners de perfil de usuários",
  },
  "comment-images": {
    folder: "hikari/comments",
    maxSizeBytes: 4 * 1024 * 1024, // 4 MB
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    requiresAdmin: false,
    description: "Imagens e GIFs anexados a comentários",
  },
};

export class StorageValidationError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "StorageValidationError";
    this.status = status;
  }
}

export class StorageConfigurationError extends Error {
  readonly status: number;
  constructor(message: string, status = 503) {
    super(message);
    this.name = "StorageConfigurationError";
    this.status = status;
  }
}

/**
 * Validação de Magic Bytes para verificar o tipo binário real do arquivo,
 * impedindo uploads maliciosos com extensões forjadas.
 */
export function detectMimeFromBytes(buffer: Uint8Array): string | null {
  if (buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }

  // GIF: GIF87a ou GIF89a (47 49 46 38 37 61 ou 47 49 46 38 39 61)
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38 &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) &&
    buffer[5] === 0x61
  ) {
    return "image/gif";
  }

  // WebP: RIFF .... WEBP
  // [0..3] = "RIFF" (52 49 46 46), [8..11] = "WEBP" (57 45 42 50)
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return "image/webp";
  }

  return null;
}

export function isValidCategory(cat: unknown): cat is ImageCategory {
  return typeof cat === "string" && IMAGE_CATEGORIES.includes(cat as ImageCategory);
}

/**
 * Normaliza a extensão correspondente ao MIME detectado.
 */
export function getExtensionFromMime(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "bin";
  }
}

/**
 * Gera um caminho único e estável de armazenamento no Vercel Blob.
 * Garante que clientes não sobrescrevam arquivos e impede Directory Traversal.
 */
export function generateSafeStoragePath(
  category: ImageCategory,
  originalFilename?: string,
  actorId?: string,
): { pathname: string; filename: string } {
  const policy = CATEGORY_POLICIES[category];
  const timestamp = Date.now();
  const random = crypto.randomUUID().slice(0, 8);

  let ext = "jpg";
  if (originalFilename) {
    const rawExt = originalFilename.split(".").pop()?.toLowerCase()?.trim() || "";
    if (["jpg", "jpeg", "png", "webp", "gif"].includes(rawExt)) {
      ext = rawExt === "jpeg" ? "jpg" : rawExt;
    }
  }

  const prefix = actorId ? `${actorId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 16)}-` : "";
  const filename = `${prefix}${timestamp}-${random}.${ext}`;
  const pathname = `${policy.folder}/${filename}`;

  return { pathname, filename };
}

export interface UploadOptions {
  file: Blob | File | Buffer;
  category: ImageCategory;
  actorId: string;
  filename?: string;
  token?: string;
}

export interface UploadResult {
  url: string;
  pathname: string;
  contentType: string;
  size: number;
}

/**
 * Validação rigorosa do arquivo de imagem antes do envio.
 */
export async function validateImageBuffer(
  file: Blob | File | Buffer,
  category: ImageCategory,
): Promise<{ buffer: Buffer; detectedMime: string; size: number }> {
  const policy = CATEGORY_POLICIES[category];

  let buffer: Buffer;
  let size: number;

  if (Buffer.isBuffer(file)) {
    buffer = file;
    size = file.length;
  } else if (file instanceof Blob) {
    const arrayBuffer = await file.arrayBuffer();
    buffer = Buffer.from(arrayBuffer);
    size = buffer.length;
  } else {
    throw new StorageValidationError("Formato de arquivo não reconhecido.", 400);
  }

  if (size === 0) {
    throw new StorageValidationError("O arquivo enviado está vazio.", 400);
  }

  if (size > policy.maxSizeBytes) {
    const maxMb = (policy.maxSizeBytes / (1024 * 1024)).toFixed(1);
    const sentMb = (size / (1024 * 1024)).toFixed(2);
    throw new StorageValidationError(
      `O arquivo excede o limite de ${maxMb} MB para ${policy.description} (tamanho enviado: ${sentMb} MB).`,
      413,
    );
  }

  // Validação binária por Magic Bytes
  const detectedMime = detectMimeFromBytes(buffer);
  if (!detectedMime) {
    throw new StorageValidationError(
      "Tipo de arquivo inválido. Apenas imagens reais (JPEG, PNG, WebP ou GIF) são permitidas.",
      415,
    );
  }

  if (!policy.allowedMimeTypes.includes(detectedMime)) {
    throw new StorageValidationError(
      `Formato ${detectedMime} não permitido para ${policy.description}. Formatos aceitos: ${policy.allowedMimeTypes.join(", ")}.`,
      415,
    );
  }

  return { buffer, detectedMime, size };
}

/**
 * Envia um arquivo validado para o armazenamento definitivo no Vercel Blob.
 */
export async function uploadImageToStorage(options: UploadOptions): Promise<UploadResult> {
  const { file, category, actorId, filename } = options;

  if (!isValidCategory(category)) {
    throw new StorageValidationError(`Categoria de imagem inválida: "${category}".`, 400);
  }

  // 1. Validar conteúdo, tamanho e magic bytes
  const { buffer, detectedMime, size } = await validateImageBuffer(file, category);

  // 2. Resolver token do Vercel Blob
  const blobToken = options.token || process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!blobToken) {
    throw new StorageConfigurationError(
      "Vercel Blob não configurado. Defina a variável de ambiente BLOB_READ_WRITE_TOKEN no projeto da Vercel.",
      503,
    );
  }

  // 3. Gerar caminho único seguro
  const normalizedFilename = filename || (file instanceof File ? file.name : undefined);
  const { pathname } = generateSafeStoragePath(category, normalizedFilename, actorId);

  // 4. Gravação física no Vercel Blob
  try {
    const blob = await put(pathname, buffer, {
      access: "public",
      contentType: detectedMime,
      token: blobToken,
      addRandomSuffix: true,
    });

    return {
      url: blob.url,
      pathname: blob.pathname,
      contentType: detectedMime,
      size,
    };
  } catch (err) {
    console.error("[image-storage] Falha ao enviar para o Vercel Blob:", err);
    throw new Error(
      `Falha na persistência da imagem no Vercel Blob: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Processador do fluxo de token do `@vercel/blob/client` (ex: usado pelo componente de comentários).
 */
export async function handleClientBlobUpload(
  request: Request,
  allowedCategory: ImageCategory = "comment-images",
): Promise<Response> {
  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return Response.json({ error: "JSON inválido." }, { status: 400 });
  }

  const policy = CATEGORY_POLICIES[allowedCategory];

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        // Validação de sessão do usuário
        const session = await auth.api.getSession({ headers: request.headers });
        const userId = session?.user?.id;

        if (!userId) {
          throw new StorageValidationError("Não autenticado. Faça login para enviar imagens.", 401);
        }

        if (policy.requiresAdmin) {
          await requireAdminUser(request);
        }

        // Garante que o pathname respeite o prefixo da pasta da categoria
        if (!pathname.startsWith(`${policy.folder}/`)) {
          throw new StorageValidationError(
            `Caminho de upload não autorizado. Esperado prefixo "${policy.folder}/".`,
            403,
          );
        }

        return {
          allowedContentTypes: [...policy.allowedMimeTypes],
          maximumSizeInBytes: policy.maxSizeBytes,
          tokenPayload: JSON.stringify({ userId, category: allowedCategory }),
        };
      },
      onUploadCompleted: async () => {
        // Notificação de conclusão de upload recebida da Vercel
      },
    });

    return Response.json(jsonResponse);
  } catch (err) {
    const status =
      err instanceof StorageValidationError ? err.status : err instanceof Error && "status" in err ? (err as { status: number }).status : 500;
    return Response.json(
      { error: err instanceof Error ? err.message : "Erro ao gerar token de upload." },
      { status: typeof status === "number" ? status : 500 },
    );
  }
}
