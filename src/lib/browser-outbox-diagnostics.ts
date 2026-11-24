export const HIKARI_OUTBOX_STORAGE_KEY = "hikari-episode-outbox-v1";

export interface OutboxConflictSummary {
  id: string;
  type: "upsert" | "delete" | "unknown";
  animeId: string;
  episodeId: string;
  seasonNumber: number | null;
  episodeNumber: number | null;
  attempts: number;
  lastError: string;
  lastAttemptAt: string | null;
}

export interface BrowserOutboxSummary {
  available: boolean;
  totalCount: number;
  pendingCount: number;
  conflictCount: number;
  upsertCount: number;
  deleteCount: number;
  conflicts: OutboxConflictSummary[];
  reason?: string;
}

export function sanitizeOutboxErrorText(raw: unknown): string {
  if (typeof raw !== "string" || !raw.trim()) {
    return "Erro não especificado na sincronização local.";
  }

  const sanitized = raw
    .replace(/(postgres(?:ql)?|rediss?|https?):\/\/[^\s"'`]+/gi, "[URL_REMOVIDA]")
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, "$1 [REDIGIDO]")
    .replace(
      /\b(token|auth|password|passwd|secret|key|apikey|api_key|cookie)\s*[:=]\s*[^\s,;]+/gi,
      "$1=[REDIGIDO]",
    )
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[EMAIL_REDIGIDO]")
    .replace(/\s+/g, " ")
    .trim();

  return sanitized.length > 160 ? `${sanitized.slice(0, 157)}...` : sanitized;
}

export function readBrowserOutboxSummary(): BrowserOutboxSummary {
  if (typeof window === "undefined") {
    return {
      available: false,
      totalCount: 0,
      pendingCount: 0,
      conflictCount: 0,
      upsertCount: 0,
      deleteCount: 0,
      conflicts: [],
      reason: "Aguardando execução no navegador (SSR).",
    };
  }

  try {
    if (!("localStorage" in window) || !window.localStorage) {
      return {
        available: false,
        totalCount: 0,
        pendingCount: 0,
        conflictCount: 0,
        upsertCount: 0,
        deleteCount: 0,
        conflicts: [],
        reason: "localStorage indisponível neste navegador.",
      };
    }

    const raw = window.localStorage.getItem(HIKARI_OUTBOX_STORAGE_KEY);
    if (!raw) {
      return {
        available: true,
        totalCount: 0,
        pendingCount: 0,
        conflictCount: 0,
        upsertCount: 0,
        deleteCount: 0,
        conflicts: [],
      };
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return {
        available: true,
        totalCount: 0,
        pendingCount: 0,
        conflictCount: 0,
        upsertCount: 0,
        deleteCount: 0,
        conflicts: [],
        reason: "Estrutura do Outbox local não reconhecida.",
      };
    }

    let pendingCount = 0;
    let conflictCount = 0;
    let upsertCount = 0;
    let deleteCount = 0;
    const conflicts: OutboxConflictSummary[] = [];

    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const op = item as Record<string, unknown>;
      const status = op.status === "conflict" ? "conflict" : "pending";
      const type =
        op.type === "upsert"
          ? "upsert"
          : op.type === "delete"
            ? "delete"
            : "unknown";

      if (status === "conflict") conflictCount += 1;
      else pendingCount += 1;

      if (type === "upsert") upsertCount += 1;
      else if (type === "delete") deleteCount += 1;

      if (status === "conflict" || (typeof op.lastError === "string" && op.lastError.trim())) {
        conflicts.push({
          id: typeof op.id === "string" ? op.id : `outbox-item-${conflicts.length}`,
          type,
          animeId: typeof op.animeId === "string" ? op.animeId : "desconhecido",
          episodeId: typeof op.episodeId === "string" ? op.episodeId : "desconhecido",
          seasonNumber:
            typeof op.seasonNumber === "number" && Number.isFinite(op.seasonNumber)
              ? op.seasonNumber
              : null,
          episodeNumber:
            typeof op.episodeNumber === "number" && Number.isFinite(op.episodeNumber)
              ? op.episodeNumber
              : null,
          attempts:
            typeof op.attempts === "number" && Number.isFinite(op.attempts)
              ? op.attempts
              : 0,
          lastError: sanitizeOutboxErrorText(op.lastError),
          lastAttemptAt:
            typeof op.lastAttemptAt === "number" && Number.isFinite(op.lastAttemptAt)
              ? new Date(op.lastAttemptAt).toLocaleTimeString("pt-BR")
              : null,
        });
      }
    }

    return {
      available: true,
      totalCount: parsed.length,
      pendingCount,
      conflictCount,
      upsertCount,
      deleteCount,
      conflicts: conflicts.slice(0, 15),
    };
  } catch {
    return {
      available: false,
      totalCount: 0,
      pendingCount: 0,
      conflictCount: 0,
      upsertCount: 0,
      deleteCount: 0,
      conflicts: [],
      reason: "Acesso bloqueado ou erro ao ler fila do Outbox local.",
    };
  }
}

export function subscribeOutboxStoragePassive(
  onUpdate: (summary: BrowserOutboxSummary) => void,
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== HIKARI_OUTBOX_STORAGE_KEY) return;
    onUpdate(readBrowserOutboxSummary());
  };

  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener("storage", handleStorage);
  };
}
