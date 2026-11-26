import type {
  AccountProfileBundle,
  PublicProfileBundle,
} from "@/lib/profile.functions";
import {
  clearAllAnimeUserClientCache,
  setAnimeUserClientCacheOwner,
} from "@/lib/anime-user-client-cache";
import {
  clearAllTrackingClientCaches,
  setActiveTrackingCacheUser,
} from "@/lib/tracking-client-cache";

export const PROFILE_CACHE_TTL_MS = 2 * 60 * 1000;

export type CachedProfileMeta = {
  image: string | null;
  nick: string | null;
  timestamp: number;
};

type CacheEntry<T> = {
  data: T;
  timestamp: number;
};

const publicProfileBundleCache = new Map<string, CacheEntry<PublicProfileBundle>>();
const accountProfileBundleCache = new Map<string, CacheEntry<AccountProfileBundle>>();
const profileMetaCache = new Map<string, CachedProfileMeta>();
const inFlightProfileMeta = new Map<
  string,
  Promise<{ image: string | null; nick: string | null } | null>
>();

let knownViewerId: string | null = null;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function normalizeNickKey(nick: string): string {
  return nick.trim().replace(/^@+/, "").toLowerCase();
}

function makePublicKey(viewerId: string | null | undefined, nick: string): string {
  return `${viewerId ?? "anon"}:${normalizeNickKey(nick)}`;
}

export function setKnownViewerId(viewerId: string | null): void {
  if (!isBrowser()) return;
  const normalized = viewerId && viewerId.trim() ? viewerId.trim() : null;
  if (knownViewerId !== normalized) {
    if (knownViewerId) {
      try {
        sessionStorage.removeItem(`hikari:profile-meta:${knownViewerId}`);
      } catch {
        // ignore
      }
    }
    // Isola sessão anterior em memória ao trocar ou encerrar conta
    accountProfileBundleCache.clear();
    profileMetaCache.clear();
    inFlightProfileMeta.clear();
    setAnimeUserClientCacheOwner(normalized);
    setActiveTrackingCacheUser(normalized);
    knownViewerId = normalized;
  }
}

export function getKnownViewerId(): string | null {
  if (!isBrowser()) return null;
  return knownViewerId;
}

export function getCachedPublicProfileBundle(
  viewerId: string | null | undefined,
  nick: string,
): PublicProfileBundle | null {
  if (!isBrowser()) return null;
  const key = makePublicKey(viewerId, nick);
  const entry = publicProfileBundleCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp >= PROFILE_CACHE_TTL_MS) {
    publicProfileBundleCache.delete(key);
    return null;
  }
  return entry.data;
}

export function setCachedPublicProfileBundle(
  viewerId: string | null | undefined,
  nick: string,
  data: PublicProfileBundle,
): void {
  if (!isBrowser()) return;
  const now = Date.now();
  const normalizedNick = normalizeNickKey(nick);
  if (normalizedNick) {
    publicProfileBundleCache.set(makePublicKey(viewerId, normalizedNick), {
      data,
      timestamp: now,
    });
  }
  const canonicalNick = normalizeNickKey(data.profile.nick || "");
  if (canonicalNick && canonicalNick !== normalizedNick) {
    publicProfileBundleCache.set(makePublicKey(viewerId, canonicalNick), {
      data,
      timestamp: now,
    });
  }
}

export function invalidatePublicProfileCache(nick?: string): void {
  if (!isBrowser()) return;
  if (!nick) {
    publicProfileBundleCache.clear();
    return;
  }
  const targetSuffix = `:${normalizeNickKey(nick)}`;
  for (const key of publicProfileBundleCache.keys()) {
    if (key.endsWith(targetSuffix)) {
      publicProfileBundleCache.delete(key);
    }
  }
}

export function invalidatePublicProfileCacheByUserId(userId: string): void {
  if (!isBrowser() || !userId) return;
  for (const [key, entry] of publicProfileBundleCache.entries()) {
    if (entry.data.profile.userId === userId) {
      publicProfileBundleCache.delete(key);
    }
  }
}

export function getCachedAccountProfileBundle(
  userId?: string | null,
): AccountProfileBundle | null {
  if (!isBrowser()) return null;
  const now = Date.now();
  if (userId) {
    const entry = accountProfileBundleCache.get(userId);
    if (!entry) return null;
    if (now - entry.timestamp >= PROFILE_CACHE_TTL_MS) {
      accountProfileBundleCache.delete(userId);
      return null;
    }
    return entry.data;
  }

  // Quando o caller não passou userId explicitamente (ex: router loader),
  // só retorna entrada se houver um viewer conhecido ou exatamente 1 entrada válida.
  if (knownViewerId) {
    const entry = accountProfileBundleCache.get(knownViewerId);
    if (!entry) return null;
    if (now - entry.timestamp >= PROFILE_CACHE_TTL_MS) {
      accountProfileBundleCache.delete(knownViewerId);
      return null;
    }
    return entry.data;
  }

  return null;
}

export function setCachedAccountProfileBundle(data: AccountProfileBundle): void {
  if (!isBrowser() || !data.profile.userId) return;
  const userId = data.profile.userId;
  knownViewerId = userId;
  accountProfileBundleCache.set(userId, {
    data,
    timestamp: Date.now(),
  });
  setCachedProfileMeta(userId, {
    image: data.profile.image ?? null,
    nick: data.profile.nick ?? null,
  });
}

export function invalidateAccountProfileCache(userId?: string): void {
  if (!isBrowser()) return;
  if (userId) {
    accountProfileBundleCache.delete(userId);
    profileMetaCache.delete(userId);
    try {
      sessionStorage.removeItem(`hikari:profile-meta:${userId}`);
    } catch {
      // ignore
    }
    return;
  }
  accountProfileBundleCache.clear();
  profileMetaCache.clear();
}

export function getCachedProfileMeta(
  userId: string,
): { image: string | null; nick: string | null } | null {
  if (!isBrowser() || !userId) return null;
  let entry = profileMetaCache.get(userId);
  if (!entry) {
    try {
      const stored = sessionStorage.getItem(`hikari:profile-meta:${userId}`);
      if (stored) {
        const parsed = JSON.parse(stored) as { image: string | null; nick: string | null; timestamp: number };
        if (parsed && typeof parsed.timestamp === 'number' && Date.now() - parsed.timestamp < PROFILE_CACHE_TTL_MS) {
          entry = { image: parsed.image ?? null, nick: parsed.nick ?? null, timestamp: parsed.timestamp };
          profileMetaCache.set(userId, entry);
        } else {
          sessionStorage.removeItem(`hikari:profile-meta:${userId}`);
        }
      }
    } catch {
      // ignore
    }
  }
  if (!entry) return null;
  if (Date.now() - entry.timestamp >= PROFILE_CACHE_TTL_MS) {
    profileMetaCache.delete(userId);
    try { sessionStorage.removeItem(`hikari:profile-meta:${userId}`); } catch {
      // ignore
    }
    return null;
  }
  return { image: entry.image, nick: entry.nick };
}

export function setCachedProfileMeta(
  userId: string,
  meta: { image: string | null; nick: string | null },
): void {
  if (!isBrowser() || !userId) return;
  const entry = {
    image: meta.image ?? null,
    nick: meta.nick ?? null,
    timestamp: Date.now(),
  };
  profileMetaCache.set(userId, entry);
  try {
    sessionStorage.setItem(`hikari:profile-meta:${userId}`, JSON.stringify(entry));
  } catch {
    // ignore
  }
}

export async function fetchProfileMetaOnce(
  userId: string,
  fetcher: () => Promise<{ image?: string | null; nick?: string | null } | null>,
): Promise<{ image: string | null; nick: string | null } | null> {
  if (!userId) return null;
  const cached = getCachedProfileMeta(userId);
  if (cached) return cached;

  const existingPromise = inFlightProfileMeta.get(userId);
  if (existingPromise) return existingPromise;

  const promise = fetcher()
    .then((res) => {
      if (!res) return null;
      const normalized = {
        image: res.image ?? null,
        nick: res.nick ?? null,
      };
      setCachedProfileMeta(userId, normalized);
      return normalized;
    })
    .finally(() => {
      inFlightProfileMeta.delete(userId);
    });

  inFlightProfileMeta.set(userId, promise);
  return promise;
}

export function invalidateAllProfileCaches(): void {
  if (!isBrowser()) return;
  publicProfileBundleCache.clear();
  accountProfileBundleCache.clear();
  if (knownViewerId) {
    try {
      sessionStorage.removeItem(`hikari:profile-meta:${knownViewerId}`);
    } catch {
      // ignore
    }
  }
  profileMetaCache.clear();
  inFlightProfileMeta.clear();
  clearAllAnimeUserClientCache();
  clearAllTrackingClientCaches();
  knownViewerId = null;
}
