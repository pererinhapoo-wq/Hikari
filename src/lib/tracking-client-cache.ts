import type { TrackingStatus, UserAnimeTrackingItem } from "@/types/profile-tracking";

export type TrackingFilterOption = "all" | TrackingStatus;

export type CachedPaginatedTrackingEntry = {
  items: UserAnimeTrackingItem[];
  page: number;
  hasMore: boolean;
  counts: Record<TrackingFilterOption, number> | null;
};

type CachedAnimeTrackingEntry = {
  item: UserAnimeTrackingItem | null;
  candidateIds: string[];
  cachedAt: number;
};

type InFlightAnimeInitialStateEntry = {
  promise: Promise<unknown>;
  epoch: number;
  startSeq: number;
  settled: boolean;
  settledWithNull: boolean;
};

const animeTrackingCache = new Map<string, CachedAnimeTrackingEntry>();
const inFlightAnimeTracking = new Map<string, Promise<UserAnimeTrackingItem[]>>();
const inFlightAnimeInitialState = new Map<string, InFlightAnimeInitialStateEntry>();
const paginatedTrackingCache = new Map<string, CachedPaginatedTrackingEntry>();
const inFlightPaginatedTracking = new Map<string, Promise<unknown>>();
const lastTrackingMutationSeqByUser = new Map<string, number>();
const lastAnimeMutationSeqByKey = new Map<string, number>();
const loaderInitialFetchSeqByKey = new Map<string, number>();
const initialStateSeenSeq = new WeakMap<object, number>();

let activeTrackingUserId: string | null = null;
let hasSeenAuthenticatedUser = false;
let trackingCacheEpoch = 0;
let monotonicSeq = 0;
let lastUserResetSeq = 0;
let initialStateRequestSeq = 0;
const MAX_INFLIGHT_INITIAL_ENTRIES = 8;

function nextSeq(): number {
  monotonicSeq += 1;
  return monotonicSeq;
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function makeAnimeKey(userId: string, animeId: string): string {
  return `${userId}::${animeId.trim()}`;
}

function makePaginatedKey(
  viewerId: string | null | undefined,
  scopePrefix: string,
  filter: TrackingFilterOption,
): string {
  return `${viewerId ?? "anon"}::${scopePrefix}::${filter}`;
}

export function getTrackingCacheEpoch(): number {
  return trackingCacheEpoch;
}

export function setActiveTrackingCacheUser(userId: string | null): void {
  if (!isBrowser()) return;
  const normalized = userId && userId.trim() ? userId.trim() : null;
  if (activeTrackingUserId === normalized) return;
  const prevUserId = activeTrackingUserId;
  activeTrackingUserId = normalized;
  if (prevUserId !== null || (hasSeenAuthenticatedUser && normalized !== null)) {
    lastUserResetSeq = nextSeq();
  }
  if (normalized === null || prevUserId !== null) {
    trackingCacheEpoch += 1;
    inFlightAnimeInitialState.clear();
  }
  if (normalized !== null) {
    hasSeenAuthenticatedUser = true;
  }
  animeTrackingCache.clear();
  inFlightAnimeTracking.clear();
  paginatedTrackingCache.clear();
  inFlightPaginatedTracking.clear();
  lastTrackingMutationSeqByUser.clear();
  lastAnimeMutationSeqByKey.clear();
  loaderInitialFetchSeqByKey.clear();
}

export function clearAllTrackingClientCaches(): void {
  if (!isBrowser()) return;
  activeTrackingUserId = null;
  trackingCacheEpoch += 1;
  lastUserResetSeq = nextSeq();
  animeTrackingCache.clear();
  inFlightAnimeTracking.clear();
  inFlightAnimeInitialState.clear();
  paginatedTrackingCache.clear();
  inFlightPaginatedTracking.clear();
  lastTrackingMutationSeqByUser.clear();
  lastAnimeMutationSeqByKey.clear();
  loaderInitialFetchSeqByKey.clear();
}

export function registerInFlightAnimeInitialState<T>(
  promise: Promise<T | null>,
  epoch = trackingCacheEpoch,
): {
  requestId: string;
  promise: Promise<T | null>;
  isSettled: () => boolean;
} {
  if (!isBrowser()) {
    return {
      requestId: "",
      promise,
      isSettled: () => true,
    };
  }

  while (inFlightAnimeInitialState.size >= MAX_INFLIGHT_INITIAL_ENTRIES) {
    const oldestKey = inFlightAnimeInitialState.keys().next().value;
    if (!oldestKey) break;
    inFlightAnimeInitialState.delete(oldestKey);
  }

  initialStateRequestSeq += 1;
  const requestId = `init-${initialStateRequestSeq}`;
  const startSeq = nextSeq();

  const entry: InFlightAnimeInitialStateEntry = {
    promise,
    epoch,
    startSeq,
    settled: false,
    settledWithNull: false,
  };

  const trackedPromise = promise.then(
    (res) => {
      entry.settled = true;
      entry.settledWithNull = res == null;
      return res;
    },
    () => {
      entry.settled = true;
      entry.settledWithNull = true;
      return null;
    },
  );
  entry.promise = trackedPromise;
  inFlightAnimeInitialState.set(requestId, entry);

  const cleanupTimer = setTimeout(() => {
    if (inFlightAnimeInitialState.get(requestId) === entry) {
      inFlightAnimeInitialState.delete(requestId);
    }
  }, 30_000);
  if (
    typeof cleanupTimer === "object" &&
    cleanupTimer !== null &&
    "unref" in cleanupTimer &&
    typeof (cleanupTimer as { unref?: () => void }).unref === "function"
  ) {
    (cleanupTimer as { unref: () => void }).unref();
  }

  return {
    requestId,
    promise: trackedPromise,
    isSettled: () => entry.settled,
  };
}

export function getInFlightAnimeInitialState<T>(
  requestId: string | null | undefined,
): {
  promise: Promise<T | null>;
  epoch: number;
  startSeq: number;
} | null {
  if (!isBrowser() || !requestId) return null;
  const entry = inFlightAnimeInitialState.get(requestId);
  if (!entry) return null;
  if (entry.epoch !== trackingCacheEpoch) {
    inFlightAnimeInitialState.delete(requestId);
    return null;
  }
  if (entry.settled && entry.settledWithNull) {
    inFlightAnimeInitialState.delete(requestId);
    return null;
  }
  return {
    promise: entry.promise as Promise<T | null>,
    epoch: entry.epoch,
    startSeq: entry.startSeq,
  };
}

export function consumeInFlightAnimeInitialState(
  requestId: string | null | undefined,
): void {
  if (!requestId) return;
  inFlightAnimeInitialState.delete(requestId);
}

export function clearInFlightAnimeInitialState(
  requestId: string | null | undefined,
): void {
  if (!requestId) return;
  inFlightAnimeInitialState.delete(requestId);
}

export function hasTrackedMutationSince(
  startSeq: number,
  userId: string | null | undefined,
  candidateIds: string[],
): boolean {
  if (!isBrowser() || !userId) return true;
  if (lastUserResetSeq > startSeq) return true;
  if ((lastTrackingMutationSeqByUser.get(userId) ?? 0) > startSeq) {
    return true;
  }
  for (const rawId of candidateIds) {
    const clean = rawId.trim();
    if (!clean) continue;
    if ((lastAnimeMutationSeqByKey.get(makeAnimeKey(userId, clean)) ?? 0) > startSeq) {
      return true;
    }
  }
  return false;
}

export function recordInitialAnimeTrackingLoaded(
  userId: string,
  candidateIds: string[],
  initialStateObj?: object | null,
): void {
  if (!isBrowser() || !userId) return;
  const seq = nextSeq();
  if (initialStateObj && typeof initialStateObj === "object") {
    initialStateSeenSeq.set(initialStateObj, seq);
  }
  for (const rawId of candidateIds) {
    const clean = rawId.trim();
    if (!clean) continue;
    loaderInitialFetchSeqByKey.set(makeAnimeKey(userId, clean), seq);
  }
}

export function isInitialAnimeTrackingFresh(
  userId: string,
  candidateIds: string[],
  initialStateObj?: object | null,
): boolean {
  if (!isBrowser() || !userId) return false;
  const userMutatedSeq = lastTrackingMutationSeqByUser.get(userId) ?? 0;
  let newestLoadSeq = 0;
  let newestAnimeMutationSeq = 0;

  if (initialStateObj && typeof initialStateObj === "object") {
    let seenSeq = initialStateSeenSeq.get(initialStateObj);
    if (seenSeq === undefined) {
      seenSeq = nextSeq();
      initialStateSeenSeq.set(initialStateObj, seenSeq);
    }
    if (seenSeq > newestLoadSeq) newestLoadSeq = seenSeq;
  }

  for (const rawId of candidateIds) {
    const clean = rawId.trim();
    if (!clean) continue;
    const key = makeAnimeKey(userId, clean);
    const loadedSeq = loaderInitialFetchSeqByKey.get(key) ?? 0;
    if (loadedSeq > newestLoadSeq) newestLoadSeq = loadedSeq;
    const animeMutSeq = lastAnimeMutationSeqByKey.get(key) ?? 0;
    if (animeMutSeq > newestAnimeMutationSeq) newestAnimeMutationSeq = animeMutSeq;
  }

  if (newestLoadSeq === 0) return false;
  return (
    newestLoadSeq >
    Math.max(userMutatedSeq, newestAnimeMutationSeq, lastUserResetSeq)
  );
}

export function markTrackingMutated(
  userId: string | null | undefined,
  candidateIds?: string[],
): void {
  if (!isBrowser() || !userId) return;
  const seq = nextSeq();
  if (!candidateIds || candidateIds.length === 0) {
    lastTrackingMutationSeqByUser.set(userId, seq);
    return;
  }
  for (const rawId of candidateIds) {
    const clean = rawId.trim();
    if (!clean) continue;
    lastAnimeMutationSeqByKey.set(makeAnimeKey(userId, clean), seq);
  }
}

export function getCachedAnimeTracking(
  userId: string | null | undefined,
  candidateIds: string[],
): { hit: true; item: UserAnimeTrackingItem | null } | null {
  if (!isBrowser() || !userId) return null;
  if (activeTrackingUserId && activeTrackingUserId !== userId) return null;

  for (const rawId of candidateIds) {
    const clean = rawId.trim();
    if (!clean) continue;
    const entry = animeTrackingCache.get(makeAnimeKey(userId, clean));
    if (entry) {
      return { hit: true, item: entry.item };
    }
  }
  return null;
}

export function seedAnimeTrackingCache(
  userId: string,
  candidateIds: string[],
  item: UserAnimeTrackingItem | null,
): void {
  if (!isBrowser() || !userId) return;
  if (activeTrackingUserId && activeTrackingUserId !== userId) return;
  activeTrackingUserId = userId;

  const cleanIds = Array.from(
    new Set(
      [...candidateIds, item?.animeId ?? ""]
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  );

  const entry: CachedAnimeTrackingEntry = {
    item,
    candidateIds: cleanIds,
    cachedAt: Date.now(),
  };

  for (const cid of cleanIds) {
    animeTrackingCache.set(makeAnimeKey(userId, cid), entry);
  }
}

export function invalidateAnimeTrackingCache(
  userId: string | null | undefined,
  candidateIds?: string[],
): void {
  if (!isBrowser() || !userId) return;
  markTrackingMutated(userId, candidateIds);

  if (!candidateIds || candidateIds.length === 0) {
    const prefix = `${userId}::`;
    for (const key of Array.from(animeTrackingCache.keys())) {
      if (key.startsWith(prefix)) animeTrackingCache.delete(key);
    }
    for (const key of Array.from(inFlightAnimeTracking.keys())) {
      if (key.startsWith(prefix)) inFlightAnimeTracking.delete(key);
    }
    return;
  }

  const targetIds = new Set(candidateIds.map((id) => id.trim()).filter(Boolean));
  const prefix = `${userId}::`;
  for (const [key, entry] of Array.from(animeTrackingCache.entries())) {
    if (!key.startsWith(prefix)) continue;
    const rawId = key.slice(prefix.length);
    if (
      targetIds.has(rawId) ||
      entry.candidateIds.some((cid) => targetIds.has(cid))
    ) {
      animeTrackingCache.delete(key);
    }
  }
  for (const cid of targetIds) {
    inFlightAnimeTracking.delete(makeAnimeKey(userId, cid));
  }
}

export function fetchAnimeTrackingSingleflight(
  userId: string,
  animePrimaryId: string,
  candidateIds: string[],
  fetcher: () => Promise<UserAnimeTrackingItem[]>,
): Promise<UserAnimeTrackingItem[]> {
  if (!userId || !animePrimaryId) {
    return Promise.resolve([]);
  }
  if (activeTrackingUserId && activeTrackingUserId !== userId) {
    setActiveTrackingCacheUser(userId);
  } else {
    activeTrackingUserId = userId;
  }

  const flightKey = makeAnimeKey(userId, animePrimaryId);
  const existing = inFlightAnimeTracking.get(flightKey);
  if (existing) {
    return existing;
  }

  const requestEpoch = trackingCacheEpoch;
  let flightRef: Promise<UserAnimeTrackingItem[]> | null = null;

  const promise = fetcher()
    .then((items) => {
      if (
        requestEpoch === trackingCacheEpoch &&
        activeTrackingUserId === userId
      ) {
        const matched =
          items.find((row) => row.animeId === animePrimaryId) ?? items[0] ?? null;
        seedAnimeTrackingCache(userId, candidateIds, matched);
      }
      return items;
    })
    .finally(() => {
      if (inFlightAnimeTracking.get(flightKey) === flightRef) {
        inFlightAnimeTracking.delete(flightKey);
      }
    });

  flightRef = promise;
  inFlightAnimeTracking.set(flightKey, promise);
  return promise;
}

export function getCachedPaginatedTracking(
  viewerId: string | null | undefined,
  scopePrefix: string,
  filter: TrackingFilterOption,
): CachedPaginatedTrackingEntry | null {
  if (!isBrowser()) return null;
  const key = makePaginatedKey(viewerId, scopePrefix, filter);
  return paginatedTrackingCache.get(key) ?? null;
}

export function setCachedPaginatedTracking(
  viewerId: string | null | undefined,
  scopePrefix: string,
  filter: TrackingFilterOption,
  entry: CachedPaginatedTrackingEntry,
): void {
  if (!isBrowser()) return;
  const key = makePaginatedKey(viewerId, scopePrefix, filter);
  paginatedTrackingCache.set(key, entry);
}

export function invalidatePaginatedTrackingCache(
  viewerId: string | null | undefined,
  scopePrefix?: string,
): void {
  if (!isBrowser()) return;
  if (!viewerId && !scopePrefix) {
    paginatedTrackingCache.clear();
    inFlightPaginatedTracking.clear();
    return;
  }
  const prefix = scopePrefix
    ? `${viewerId ?? "anon"}::${scopePrefix}::`
    : `${viewerId ?? "anon"}::`;
  for (const key of Array.from(paginatedTrackingCache.keys())) {
    if (key.startsWith(prefix)) {
      paginatedTrackingCache.delete(key);
    }
  }
  for (const key of Array.from(inFlightPaginatedTracking.keys())) {
    if (key.startsWith(prefix)) {
      inFlightPaginatedTracking.delete(key);
    }
  }
}

export function fetchPaginatedTrackingSingleflight<T>(
  cacheKey: string,
  fetcher: () => Promise<T>,
): Promise<T> {
  const existing = inFlightPaginatedTracking.get(cacheKey);
  if (existing) {
    return existing as Promise<T>;
  }

  let flightRef: Promise<T> | null = null;
  const promise = fetcher().finally(() => {
    if (inFlightPaginatedTracking.get(cacheKey) === flightRef) {
      inFlightPaginatedTracking.delete(cacheKey);
    }
  });
  flightRef = promise;
  inFlightPaginatedTracking.set(cacheKey, promise);
  return promise;
}
