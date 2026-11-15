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
const memoryCache = new Map<string, CachedAnimeUserState>();
let hasHydratedFromStorage = false;

function hydrateMemoryCache(): void {
  if (hasHydratedFromStorage) return;
  if (typeof window === "undefined") return;
  hasHydratedFromStorage = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      for (const [key, val] of Object.entries(parsed)) {
        if (val && typeof val === "object") {
          memoryCache.set(key, val as CachedAnimeUserState);
        }
      }
    }
  } catch {
    // Falha silenciosa no acesso ao localStorage
  }
}

function persistMemoryCache(): void {
  if (typeof window === "undefined") return;
  try {
    const obj: Record<string, CachedAnimeUserState> = {};
    const entries = Array.from(memoryCache.entries());
    // Mantém no máximo os 100 animes mais recentes para economizar cota de localStorage
    const recent = entries.slice(-100);
    for (const [key, val] of recent) {
      obj[key] = val;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch {
    // Falha silenciosa de quota de armazenamento
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

  // Busca eventual estado anterior
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
    memoryCache.set(key, merged);
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
