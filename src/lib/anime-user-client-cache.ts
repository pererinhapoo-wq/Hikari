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

type PersistedAnimeUserCache = {
  ownerUserId: string | null;
  entries: Record<string, CachedAnimeUserState>;
};

const STORAGE_KEY = "hikari_anime_user_cache_v1";
const MAX_CACHE_ENTRIES = 30;
const memoryCache = new Map<string, CachedAnimeUserState>();
let hasHydratedFromStorage = false;
let currentOwnerUserId: string | null = null;

function normalizeOwnerId(userId?: string | null): string | null {
  return typeof userId === "string" && userId.trim() ? userId.trim() : null;
}

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

function removeStorageSafely(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (removeErr) {
    console.warn("[anime-user-client-cache] Falha ao remover cache do localStorage:", removeErr);
  }
}

function hydrateMemoryCache(): void {
  if (hasHydratedFromStorage) return;
  if (typeof window === "undefined") return;
  hasHydratedFromStorage = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<PersistedAnimeUserCache> | null;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !("ownerUserId" in parsed) ||
      typeof parsed.ownerUserId !== "string" ||
      !parsed.ownerUserId.trim() ||
      !parsed.entries ||
      typeof parsed.entries !== "object"
    ) {
      // Descarta payload legado sem dono ou de sessão anônima para evitar vazamento entre contas
      removeStorageSafely();
      return;
    }

    currentOwnerUserId = parsed.ownerUserId.trim();
    const entries = Object.entries(parsed.entries)
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
  } catch {
    // Trata JSON inválido ou localStorage indisponível removendo a chave corrompida com segurança
    removeStorageSafely();
  }
}

function persistMemoryCache(): void {
  if (typeof window === "undefined") return;
  if (!currentOwnerUserId) {
    removeStorageSafely();
    return;
  }
  try {
    enforceLruLimit();
    const entries: Record<string, CachedAnimeUserState> = {};
    for (const [key, val] of memoryCache.entries()) {
      entries[key] = val;
    }
    const payload: PersistedAnimeUserCache = {
      ownerUserId: currentOwnerUserId,
      entries,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    if (err instanceof DOMException && err.name === "QuotaExceededError") {
      try {
        const reduced = Array.from(memoryCache.entries()).slice(-15);
        memoryCache.clear();
        const entries: Record<string, CachedAnimeUserState> = {};
        for (const [key, val] of reduced) {
          memoryCache.set(key, val);
          entries[key] = val;
        }
        const payload: PersistedAnimeUserCache = {
          ownerUserId: currentOwnerUserId,
          entries,
        };
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch (quotaErr) {
        console.warn("[anime-user-client-cache] Falha ao reduzir cache após QuotaExceededError:", quotaErr);
      }
    }
  }
}

/**
 * Define o usuário dono atual do cache síncrono de detalhes de anime.
 * Limpa imediatamente qualquer cache pertencente a outro usuário ou sessão anterior.
 */
export function setAnimeUserClientCacheOwner(userId: string | null): void {
  if (typeof window === "undefined") return;
  hydrateMemoryCache();
  const normalized = normalizeOwnerId(userId);
  if (!normalized) {
    memoryCache.clear();
    currentOwnerUserId = null;
    removeStorageSafely();
    return;
  }
  if (currentOwnerUserId !== normalized) {
    memoryCache.clear();
    currentOwnerUserId = normalized;
    removeStorageSafely();
  }
}

/**
 * Limpa todo o cache síncrono de detalhes de anime (usado no logout ou troca de conta).
 */
export function clearAllAnimeUserClientCache(): void {
  if (typeof window === "undefined") return;
  hasHydratedFromStorage = true;
  memoryCache.clear();
  currentOwnerUserId = null;
  removeStorageSafely();
}

/**
 * Recupera o estado persistido em cache síncrono para qualquer ID candidato do anime,
 * garantindo estrito isolamento pelo usuário proprietário da sessão.
 */
export function getAnimeUserClientCache(
  candidateIds: (string | null | undefined)[],
  expectedUserId?: string | null,
): CachedAnimeUserState | null {
  if (typeof window === "undefined") return null;
  hydrateMemoryCache();

  if (expectedUserId === null) {
    return null;
  }
  const normalizedExpected = normalizeOwnerId(expectedUserId);
  if (expectedUserId !== undefined) {
    if (!normalizedExpected || currentOwnerUserId !== normalizedExpected) {
      return null;
    }
  } else if (!currentOwnerUserId) {
    return null;
  }

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
  ownerUserId?: string | null,
): void {
  if (typeof window === "undefined") return;
  hydrateMemoryCache();

  if (ownerUserId !== undefined) {
    const normalizedOwner = normalizeOwnerId(ownerUserId);
    if (!normalizedOwner) return;
    setAnimeUserClientCacheOwner(normalizedOwner);
  }
  if (!currentOwnerUserId) return;

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

/**
 * Atualiza o estado de favorito apenas em entradas já existentes do usuário autenticado
 * (evita gravar entradas incompletas sem status de tracking).
 */
export function updateAnimeFavoriteInClientCache(
  userId: string | null | undefined,
  match: {
    targetId: string;
    favoriteId?: string | null;
  },
  isFavorite: boolean,
  favFavoriteId: string | null,
): boolean {
  if (typeof window === "undefined") return false;
  hydrateMemoryCache();

  const normalizedOwner = normalizeOwnerId(userId);
  if (!normalizedOwner || currentOwnerUserId !== normalizedOwner) {
    return false;
  }

  const targetId = match.targetId.trim();
  const favoriteId = match.favoriteId?.trim() || null;
  if (!targetId && !favoriteId) return false;

  let updated = false;
  const now = Date.now();
  for (const [key, entry] of Array.from(memoryCache.entries())) {
    const matchesTarget =
      Boolean(targetId) &&
      (key === targetId || entry.dbAnimeId === targetId);
    const matchesFavId =
      Boolean(favoriteId) && entry.favFavoriteId === favoriteId;
    if (matchesTarget || matchesFavId) {
      touchKey(key, {
        ...entry,
        isFavorite,
        favFavoriteId,
        cachedAt: now,
      });
      updated = true;
    }
  }

  if (updated) {
    persistMemoryCache();
  }
  return updated;
}
