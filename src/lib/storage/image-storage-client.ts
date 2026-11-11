import { getBearerToken } from "@/lib/auth/client";
import { type ImageCategory } from "./image-storage";

export interface UploadClientResult {
  ok: boolean;
  url: string;
  category: ImageCategory;
  pathname?: string;
  size?: number;
}

/**
 * Envia uma imagem para o storage permanente do Hikari (/api/upload-image).
 * Autentica automaticamente via cookie de sessão ou Bearer token.
 */
export async function uploadImageFile(
  file: File | Blob,
  category: ImageCategory,
  filename?: string,
): Promise<string> {
  const formData = new FormData();
  const resolvedFilename =
    filename || (file instanceof File ? file.name : `upload-${Date.now()}.jpg`);
  formData.append("file", file, resolvedFilename);
  formData.append("category", category);

  const token = getBearerToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch("/api/upload-image", {
    method: "POST",
    credentials: "include",
    headers: Object.keys(headers).length > 0 ? headers : undefined,
    body: formData,
  });

  if (!response.ok) {
    let errorMsg = `Erro no upload (${response.status})`;
    try {
      const data = (await response.json()) as { error?: string };
      if (data.error) errorMsg = data.error;
    } catch {
      // Ignora falha de parse
    }
    throw new Error(errorMsg);
  }

  const data = (await response.json()) as { url?: string };
  if (!data.url) {
    throw new Error("O servidor não retornou a URL pública do arquivo armazenado.");
  }

  return data.url;
}

/**
 * Verifica se a URL é persistente e gerenciada pelo storage do Hikari (Vercel Blob / R2).
 */
export function isPersistentStorageUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  return (
    trimmed.includes(".blob.vercel-storage.com") ||
    trimmed.includes("r2.cloudflarestorage.com") ||
    trimmed.includes("amazonaws.com")
  );
}
