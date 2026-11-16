import type { SlimAnime } from "@/lib/types";
import type { SearchUserItem } from "@/lib/profile.functions";

export const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos
const MAX_CACHE_ENTRIES = 100;

type CacheEntry<T> = {
  data: T;
  timestamp: number;
};

const animeSearchCache = new Map<string, CacheEntry<{ items: SlimAnime[]; page: number; hasNext: boolean; source?: string }>>();
const userSearchCache = new Map<string, CacheEntry<SearchUserItem[]>>();

let currentSearchViewerId: string | null = null;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function setKnownSearchViewerId(viewerId: string | null): void {
  if (!isBrowser()) return;
  const normalized = viewerId && viewerId.trim() ? viewerId.trim() : null;
  if (currentSearchViewerId !== normalized) {
    userSearchCache.clear();
    currentSearchViewerId = normalized;
  }
}

export function getKnownSearchViewerId(): string | null {
  if (!isBrowser()) return null;
  return currentSearchViewerId;
}

function normalizeQuery(q?: string): string {
  if (!q) return "";
  return q.trim().replace(/^@+/, "").toLowerCase();
}

export type AnimeSearchParams = {
  q?: string;
  genre?: string;
  year?: string;
  format?: string;
  status?: string;
  sort?: string;
  page?: number;
  adult?: boolean;
};

export type UserSearchParams = {
  query: string;
  page?: number;
  limit?: number;
};

function getAnimeCacheKey(params: AnimeSearchParams): string {
  const q = normalizeQuery(params.q);
  const genre = (params.genre ?? "").trim().toLowerCase();
  const year = params.year ?? "";
  const format = (params.format ?? "").trim().toLowerCase();
  const status = (params.status ?? "").trim().toLowerCase();
  const sort = (params.sort ?? "").trim().toLowerCase();
  const page = params.page ?? 1;
  const adult = params.adult ? "1" : "0";
  return `anime:q=${q}|g=${genre}|y=${year}|f=${format}|s=${status}|sort=${sort}|p=${page}|adult=${adult}`;
}

function getUserCacheKey(params: UserSearchParams, viewerId?: string | null): string {
  const q = normalizeQuery(params.query);
  const page = params.page ?? 1;
  const limit = params.limit ?? 20;
  const v = viewerId ?? "anon";
  return `user:v=${v}|q=${q}|p=${page}|l=${limit}`;
}

function enforceCacheLimit<T>(map: Map<string, CacheEntry<T>>): void {
  if (map.size > MAX_CACHE_ENTRIES) {
    // Remove a entrada mais antiga (primeira inserida no Map)
    const firstKey = map.keys().next().value;
    if (firstKey !== undefined) {
      map.delete(firstKey);
    }
  }
}

export function getCachedAnimeSearch(params: AnimeSearchParams): { items: SlimAnime[]; page: number; hasNext: boolean; source?: string } | null {
  if (!isBrowser()) return null;
  const key = getAnimeCacheKey(params);
  const entry = animeSearchCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp >= SEARCH_CACHE_TTL_MS) {
    animeSearchCache.delete(key);
    return null;
  }
  return entry.data;
}

export function setCachedAnimeSearch(params: AnimeSearchParams, data: { items: SlimAnime[]; page: number; hasNext: boolean; source?: string }): void {
  if (!isBrowser()) return;
  if (!data || !Array.isArray(data.items)) return;
  const key = getAnimeCacheKey(params);
  animeSearchCache.set(key, {
    data,
    timestamp: Date.now(),
  });
  enforceCacheLimit(animeSearchCache);
}

export function getCachedUserSearch(params: UserSearchParams, viewerId?: string | null): SearchUserItem[] | null {
  if (!isBrowser()) return null;
  const key = getUserCacheKey(params, viewerId);
  const entry = userSearchCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp >= SEARCH_CACHE_TTL_MS) {
    userSearchCache.delete(key);
    return null;
  }
  return entry.data;
}

export function setCachedUserSearch(params: UserSearchParams, viewerId: string | null | undefined, data: SearchUserItem[]): void {
  if (!isBrowser()) return;
  if (!Array.isArray(data)) return;
  const key = getUserCacheKey(params, viewerId);
  userSearchCache.set(key, {
    data,
    timestamp: Date.now(),
  });
  enforceCacheLimit(userSearchCache);
}
