export interface PruneProgressOptions {
  /**
   * Quando true (recuperação após QuotaExceededError), remove imediatamente chaves
   * de progresso antigas/não prioritárias em vez de aguardar o limite padrão.
   */
  aggressive?: boolean;
  /**
   * Quando false em modo agressivo, permite podar também chaves de progresso
   * marcadas como prioritárias caso não haja mais chaves não prioritárias para liberar.
   * Nunca remove chaves protegidas (estado principal, favoritos, preferências, histórico ou auth).
   */
  keepPriority?: boolean;
  /**
   * Quantidade máxima de chaves de progresso mantidas na poda padrão.
   */
  maxKeep?: number;
  /**
   * Idade máxima (em ms) para chaves de progresso não prioritárias com timestamp válido.
   */
  maxAgeMs?: number;
}

export interface QuotaRetryOptions {
  priorityAnimeIds?: Iterable<string>;
  maxRetries?: number;
}

const DEFAULT_MAX_PROGRESS_KEYS = 40;
const DEFAULT_MAX_PROGRESS_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_QUOTA_RETRIES = 2;
const HARD_MAX_QUOTA_RETRIES = 5;

const PROTECTED_EXACT_KEYS = new Set<string>([
  "hikari-user-state-v1",
  "hikari-catalog-fallback-v1",
  "hikari-deleted-episodes-v1",
  "hikari-episode-outbox-v1",
  "hikari_anime_user_cache_v1",
  "hikari-account-email",
  "hikari-notifications-likes",
  "hikari-notifications-replies",
  "hikari-notifications-followers",
  "hikari-player-autoplay",
  "nova_player_autoplay",
  "nova_player_playback_rate",
  "nova_player_quality_preference",
  "hikari_player_mode",
  "hikari_show_comment_media",
]);

const PROTECTED_KEY_PATTERN =
  /^(?:better-auth|auth|session|hikari[-_](?:user[-_]?state|account|auth|notifications?|player[-_](?:autoplay|mode)|deleted[-_]?episodes|episode[-_]?outbox|anime[-_]?user[-_]?cache|catalog[-_]?fallback|show[-_]comment[-_]media)|nova[-_]player)/i;

const PROGRESS_KEY_PATTERN =
  /^(?:hikari|nova)[-_:]?(?:watch[-_:]?|ep(?:isode)?[-_:]?)?progress(?:[-_:]|$)/i;

function isProtectedKey(key: string): boolean {
  if (!key) return true;
  if (PROTECTED_EXACT_KEYS.has(key)) return true;
  if (PROTECTED_KEY_PATTERN.test(key)) return true;
  return false;
}

function isPrunableProgressKey(key: string): boolean {
  if (isProtectedKey(key)) return false;
  return PROGRESS_KEY_PATTERN.test(key);
}

function getSafeLocalStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

function readAllStorageKeys(storage: Storage): string[] {
  const keys: string[] = [];
  try {
    const total = storage.length;
    for (let i = 0; i < total; i += 1) {
      const k = storage.key(i);
      if (typeof k === "string" && k.length > 0) {
        keys.push(k);
      }
    }
  } catch {
    return [];
  }
  return keys;
}

function normalizePriorityIds(priorityAnimeIds?: Iterable<string>): Set<string> {
  const set = new Set<string>();
  if (!priorityAnimeIds) return set;
  for (const raw of priorityAnimeIds) {
    if (typeof raw !== "string") continue;
    const clean = raw.trim();
    if (clean) {
      set.add(clean);
    }
  }
  return set;
}

function keyMatchesPriorityAnimeId(key: string, priorityIds: Set<string>): boolean {
  if (priorityIds.size === 0) return false;
  for (const id of priorityIds) {
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const boundaryRe = new RegExp(`(?:^|[-_:/])${escaped}(?:$|[-_:/])`);
    if (boundaryRe.test(key)) {
      return true;
    }
  }
  return false;
}

interface ProgressKeyMeta {
  key: string;
  updatedAt: number;
  hasValidTimestamp: boolean;
  isPriority: boolean;
}

function inspectProgressKey(
  storage: Storage,
  key: string,
  priorityIds: Set<string>,
): ProgressKeyMeta {
  let updatedAt = 0;
  let hasValidTimestamp = false;
  let isPriority = keyMatchesPriorityAnimeId(key, priorityIds);

  try {
    const raw = storage.getItem(key);
    if (raw && raw.trim().startsWith("{")) {
      const parsed = JSON.parse(raw) as Record<string, unknown> | null;
      if (parsed && typeof parsed === "object") {
        const candidateAnimeId = parsed.animeId;
        if (
          typeof candidateAnimeId === "string" &&
          priorityIds.has(candidateAnimeId.trim())
        ) {
          isPriority = true;
        }
        const tsCandidate =
          parsed.updatedAt ?? parsed.timestamp ?? parsed.savedAt;
        if (
          typeof tsCandidate === "number" &&
          Number.isFinite(tsCandidate) &&
          tsCandidate > 0
        ) {
          updatedAt = tsCandidate;
          hasValidTimestamp = true;
        }
      }
    }
  } catch {
    // Mantém metadados padrão se o valor não for JSON válido
  }

  return {
    key,
    updatedAt,
    hasValidTimestamp,
    isPriority,
  };
}

export function isQuotaExceededError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const record = err as {
    name?: unknown;
    code?: unknown;
    message?: unknown;
  };
  if (
    record.name === "QuotaExceededError" ||
    record.name === "NS_ERROR_DOM_QUOTA_REACHED"
  ) {
    return true;
  }
  if (record.code === 22 || record.code === 1014) {
    return true;
  }
  if (typeof record.message === "string" && /quota/i.test(record.message)) {
    return true;
  }
  return false;
}

/**
 * Remove chaves legadas/efêmeras de progresso por episódio no localStorage para
 * manter o armazenamento dentro da cota sem afetar estado principal (`hikari-user-state-v1`),
 * favoritos, preferências, histórico ou dados de autenticação.
 */
export function pruneProgressKeys(
  priorityAnimeIds?: Iterable<string>,
  options?: PruneProgressOptions,
): number {
  const storage = getSafeLocalStorage();
  if (!storage) return 0;

  const candidateKeys = readAllStorageKeys(storage).filter(isPrunableProgressKey);
  if (candidateKeys.length === 0) return 0;

  const priorityIds = normalizePriorityIds(priorityAnimeIds);
  const metas = candidateKeys.map((key) =>
    inspectProgressKey(storage, key, priorityIds),
  );

  const aggressive = Boolean(options?.aggressive);
  const keepPriority = options?.keepPriority ?? true;
  const maxKeep = Math.max(
    0,
    options?.maxKeep ?? DEFAULT_MAX_PROGRESS_KEYS,
  );
  const maxAgeMs = Math.max(
    0,
    options?.maxAgeMs ?? DEFAULT_MAX_PROGRESS_AGE_MS,
  );
  const now = Date.now();

  const keysToRemove: string[] = [];
  const nonPriority = metas
    .filter((m) => !m.isPriority)
    .sort((a, b) => a.updatedAt - b.updatedAt);
  const priority = metas
    .filter((m) => m.isPriority)
    .sort((a, b) => a.updatedAt - b.updatedAt);

  if (aggressive) {
    for (const item of nonPriority) {
      keysToRemove.push(item.key);
    }
    if (!keepPriority) {
      for (const item of priority) {
        keysToRemove.push(item.key);
      }
    }
  } else {
    const survivingNonPriority: ProgressKeyMeta[] = [];
    for (const item of nonPriority) {
      if (
        item.hasValidTimestamp &&
        now - item.updatedAt > maxAgeMs
      ) {
        keysToRemove.push(item.key);
      } else {
        survivingNonPriority.push(item);
      }
    }

    const totalSurviving = priority.length + survivingNonPriority.length;
    if (totalSurviving > maxKeep) {
      const excess = totalSurviving - maxKeep;
      // Remove apenas chaves não prioritárias mais antigas; preserva progresso legítimo prioritário
      const toTrim = Math.min(excess, survivingNonPriority.length);
      for (let i = 0; i < toTrim; i += 1) {
        keysToRemove.push(survivingNonPriority[i].key);
      }
    }
  }

  let removedCount = 0;
  for (const key of keysToRemove) {
    if (isProtectedKey(key)) continue;
    try {
      storage.removeItem(key);
      removedCount += 1;
    } catch {
      // Ignora erro individual de remoção
    }
  }

  return removedCount;
}

/**
 * Executa uma gravação no localStorage com recuperação automática para falhas de quota.
 * Possui número estritamente limitado de tentativas para nunca entrar em loop infinito.
 */
export function withQuotaRetry<T>(
  writeFn: () => T,
  options?: QuotaRetryOptions,
): T | undefined {
  try {
    return writeFn();
  } catch (err) {
    if (!isQuotaExceededError(err)) {
      console.warn("[Hikari] Falha ao gravar no localStorage:", err);
      return undefined;
    }

    const maxRetries = Math.max(
      0,
      Math.min(
        options?.maxRetries ?? DEFAULT_QUOTA_RETRIES,
        HARD_MAX_QUOTA_RETRIES,
      ),
    );

    let lastError: unknown = err;

    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
      const keepPriority = attempt === 1;
      let removed = pruneProgressKeys(options?.priorityAnimeIds, {
        aggressive: true,
        keepPriority,
      });

      if (removed === 0 && keepPriority) {
        removed = pruneProgressKeys(options?.priorityAnimeIds, {
          aggressive: true,
          keepPriority: false,
        });
      }

      if (removed === 0) {
        break;
      }

      try {
        return writeFn();
      } catch (retryErr) {
        lastError = retryErr;
        if (!isQuotaExceededError(retryErr)) {
          console.warn("[Hikari] Falha ao gravar no localStorage após poda:", retryErr);
          return undefined;
        }
      }
    }

    console.warn(
      "[Hikari] Cota do localStorage excedida mesmo após limpeza de chaves de progresso antigas:",
      lastError,
    );
    return undefined;
  }
}
