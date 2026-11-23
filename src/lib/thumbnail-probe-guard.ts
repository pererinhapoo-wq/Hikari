export function isValidImagePreviewUrl(raw: string | null | undefined): boolean {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return false;

  if (trimmed.startsWith("/")) {
    return trimmed.length > 1 && !trimmed.startsWith("//");
  }
  if (trimmed.startsWith("blob:") || trimmed.startsWith("data:image/")) {
    return true;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }
    const host = parsed.hostname.trim().toLowerCase();
    if (!host) return false;
    if (host === "localhost") return true;
    const dotIdx = host.indexOf(".");
    return dotIdx > 0 && dotIdx < host.length - 1;
  } catch {
    return false;
  }
}

export function normalizeVideoProbeUrl(raw: string | null | undefined): string {
  return (raw ?? "").trim();
}

export interface AutoProbeStateSnapshot {
  loading?: boolean;
  sourceUrl?: string;
  candidates?: unknown[];
  error?: string;
  warning?: string;
}

export function shouldRunAutoThumbnailProbe(
  existingState: AutoProbeStateSnapshot | undefined,
  candidateVideoUrl: string | null | undefined,
  force = false,
): boolean {
  const normalizedUrl = normalizeVideoProbeUrl(candidateVideoUrl);
  if (!normalizedUrl) return false;
  if (force) return true;
  if (!existingState) return true;

  const prevUrl = normalizeVideoProbeUrl(existingState.sourceUrl);
  if (!prevUrl || prevUrl !== normalizedUrl) {
    return true;
  }

  // Já foi consultada para esta mesma URL (carregando, com candidatos, vazia/aviso ou erro):
  // não dispara novamente de forma automática; retry exige force=true (clique manual).
  return false;
}

export interface RecentPasteRecord {
  slotKey: string;
  value: string;
  at: number;
}

export function isDuplicatePasteTrigger(
  lastPaste: RecentPasteRecord | null | undefined,
  slotKey: string,
  value: string,
  nowMs: number,
  windowMs = 600,
): boolean {
  if (!lastPaste) return false;
  if (lastPaste.slotKey !== slotKey) return false;
  if (lastPaste.value.trim() !== value.trim()) return false;
  return nowMs - lastPaste.at <= windowMs;
}
