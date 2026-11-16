import type { TrackingStatus } from "@/types/profile-tracking";

export type CachedAnimeUserState = {
  trackingStatus?: TrackingStatus | null;
  episodesWatched?: number;
  score?: number | null;
  dbAnimeId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  isFavorite?: boolean;
  favFavoriteId?: string | null;
  continueEpisode?: { id: string; number: number } | null;
  cachedAt?: number;
};

const STORAGE_KEY = "hikari_anime_user_cache_v1";
const MAX_CACHE_ENTRIES = 30;
const memoryCache = new Map<string, CachedAnimeUserState>();
let hasHydratedFromStorage = false;

function enforceLruLimit(): void {
  if (memoryCache.size <= MAX_CACHE_ENTRIES) return;
  const keysToDelete = Array.from(memoryCache.keys()).slice(
    0,
    memoryCache.size - MAX_CACHE_ENTRIES,
  );
  for (const k of keysToDelete) {
    memoryCache.delete(k);
  }
}

function touchKey(key: string, val: CachedAnimeUserState): void {
  memoryCache.delete(key);
  memoryCache.set(key, val);
}

function hydrateMemoryCache(): void {
  if (hasHydratedFromStorage) return;
  if (typeof window === "undefined") return;
  hasHydratedFromStorage = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      const entries = Object.entries(parsed)
        .filter(([, val]) => val && typeof val === "object")
        .sort((a, b) => {
          const timeA = (a[1] as CachedAnimeUserState).cachedAt ?? 0;
          const timeB = (b[1] as CachedAnimeUserState).cachedAt ?? 0;
          return timeA - timeB;
        });

      for (const [key, val] of entries) {
        memoryCache.set(key, val as CachedAnimeUserState);
      }
      const initialSize = memoryCache.size;
      enforceLruLimit();
      if (memoryCache.size < initialSize) {
        persistMemoryCache();
      }
    }
  } catch {
    // Trata JSON inválido ou localStorage indisponível removendo a chave corrompida com segurança
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (removeErr) {
      console.warn("[anime-user-client-cache] Falha ao limpar cache corrompido:", removeErr);
    }
  }
}

function persistMemoryCache(): void {
  if (typeof window === "undefined") return;
  try {
    enforceLruLimit();
    const obj: Record<string, CachedAnimeUserState> = {};
    for (const [key, val] of memoryCache.entries()) {
      obj[key] = val;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch (err) {
    if (err instanceof DOMException && err.name === "QuotaExceededError") {
      try {
        const entries = Array.from(memoryCache.entries());
        const reduced = entries.slice(-15);
        memoryCache.clear();
        const obj: Record<string, CachedAnimeUserState> = {};
        for (const [key, val] of reduced) {
          memoryCache.set(key, val);
          obj[key] = val;
        }
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
      } catch (quotaErr) {
        console.warn("[anime-user-client-cache] Falha ao reduzir cache após QuotaExceededError:", quotaErr);
      }
    }
  }
}

/**
 * Recupera o estado persistido em cache síncrono para qualquer ID candidato do anime.
 */
export function getAnimeUserClientCache(
  candidateIds: (string | null | undefined)[],
): CachedAnimeUserState | null {
  if (typeof window === "undefined") return null;
  hydrateMemoryCache();

  for (const raw of candidateIds) {
    if (!raw) continue;
    const key = String(raw).trim();
    if (!key) continue;
    const item = memoryCache.get(key);
    if (item) {
      touchKey(key, item);
      return item;
    }
  }
  return null;
}

/**
 * Salva ou mescla o estado de usuário para o anime sob todos os seus IDs conhecidos.
 */
export function saveAnimeUserClientCache(
  candidateIds: (string | null | undefined)[],
  partialState: Partial<CachedAnimeUserState>,
): void {
  if (typeof window === "undefined") return;
  hydrateMemoryCache();

  const validKeys = Array.from(
    new Set(
      candidateIds
        .filter((k): k is string => typeof k === "string" && Boolean(k.trim()))
        .map((k) => k.trim()),
    ),
  );

  if (validKeys.length === 0) return;

  let existing: CachedAnimeUserState = {};
  for (const key of validKeys) {
    const found = memoryCache.get(key);
    if (found) {
      existing = { ...found };
      break;
    }
  }

  const merged: CachedAnimeUserState = {
    ...existing,
    ...partialState,
    cachedAt: Date.now(),
  };

  for (const key of validKeys) {
    touchKey(key, merged);
  }

  persistMemoryCache();
}

/**
 * Limpa o cache para todos os IDs candidatos do anime.
 */
export function clearAnimeUserClientCache(
  candidateIds: (string | null | undefined)[],
): void {
  if (typeof window === "undefined") return;
  hydrateMemoryCache();

  for (const raw of candidateIds) {
    if (!raw) continue;
    const key = String(raw).trim();
    if (key) {
      memoryCache.delete(key);
    }
  }

  persistMemoryCache();
}
