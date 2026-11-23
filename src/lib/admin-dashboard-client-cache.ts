import {
  getAdminCatalogSyncMeta,
  getAdminSystemStatus,
  type AdminCatalogSyncMetaInput,
  type AdminCatalogSyncMetaItem,
  type AdminSystemStatus,
} from "@/lib/admin-dashboard.functions";
import { shouldPreferRemoteMedia } from "@/lib/overlay";
import { useHikariStore } from "@/lib/store";
import type { LocalAnime } from "@/lib/types";

export const ADMIN_SYSTEM_STATUS_TTL_MS = 60 * 1000;
export const ADMIN_CATALOG_META_TTL_MS = 2 * 60 * 1000;

interface StatusCacheEntry {
  data: AdminSystemStatus;
  timestamp: number;
}

interface MetaSyncCacheEntry {
  timestamp: number;
  lastServerUpdatedAt: number;
  catalogCount: number;
}

let cachedSystemStatus: StatusCacheEntry | null = null;
let inFlightSystemStatus: Promise<AdminSystemStatus> | null = null;
let systemStatusEpoch = 0;

let cachedMetaSync: MetaSyncCacheEntry | null = null;
let inFlightMetaSync: Promise<{ updatedCount: number; skipped: boolean }> | null =
  null;
let metaSyncEpoch = 0;

const isDubbedTitle = (text: string) =>
  /\b(dub|dublado|dublada)\b/i.test(text);

export function getCachedAdminSystemStatus(
  nowMs = Date.now(),
): AdminSystemStatus | null {
  if (!cachedSystemStatus) return null;
  if (nowMs - cachedSystemStatus.timestamp >= ADMIN_SYSTEM_STATUS_TTL_MS) {
    return null;
  }
  return cachedSystemStatus.data;
}

export function invalidateAdminDashboardCache(
  scope: "all" | "status" | "meta" = "all",
): void {
  if (scope === "all" || scope === "status") {
    systemStatusEpoch += 1;
    cachedSystemStatus = null;
    inFlightSystemStatus = null;
  }
  if (scope === "all" || scope === "meta") {
    metaSyncEpoch += 1;
    cachedMetaSync = null;
    inFlightMetaSync = null;
  }
}

export async function loadAdminSystemStatusCached(options?: {
  force?: boolean;
  fetcher?: () => Promise<AdminSystemStatus>;
}): Promise<AdminSystemStatus> {
  const force = Boolean(options?.force);
  const now = Date.now();

  if (!force) {
    const cached = getCachedAdminSystemStatus(now);
    if (cached) {
      return cached;
    }
  }

  if (inFlightSystemStatus && !force) {
    return inFlightSystemStatus;
  }

  const requestEpoch = systemStatusEpoch;
  const fetcher = options?.fetcher ?? (() => getAdminSystemStatus());

  let flightRef: Promise<AdminSystemStatus> | null = null;
  const promise = (async () => {
    try {
      const res = await fetcher();
      if (requestEpoch === systemStatusEpoch && res.connected) {
        cachedSystemStatus = {
          data: res,
          timestamp: Date.now(),
        };
      }
      return res;
    } finally {
      if (inFlightSystemStatus === flightRef) {
        inFlightSystemStatus = null;
      }
    }
  })();

  flightRef = promise;
  inFlightSystemStatus = promise;
  return promise;
}

export function computeAdminCatalogMetaUpdates(
  currentAnimes: LocalAnime[],
  rows: AdminCatalogSyncMetaItem[],
): LocalAnime[] {
  if (!rows || rows.length === 0 || currentAnimes.length === 0) {
    return [];
  }

  const byId = new Map(rows.map((r) => [r.id, r]));
  const byAni = new Map<number, AdminCatalogSyncMetaItem>();
  const byMal = new Map<number, AdminCatalogSyncMetaItem>();
  const byKitsu = new Map<number, AdminCatalogSyncMetaItem>();

  for (const row of rows) {
    if (
      isDubbedTitle(
        `${row.title} ${row.titleRomaji ?? ""} ${row.titleEnglish ?? ""}`,
      )
    ) {
      continue;
    }
    if (row.anilistId && !byAni.has(row.anilistId)) byAni.set(row.anilistId, row);
    if (row.malId && !byMal.has(row.malId)) byMal.set(row.malId, row);
    if (row.kitsuId && !byKitsu.has(row.kitsuId)) byKitsu.set(row.kitsuId, row);
  }

  const batchUpdates: LocalAnime[] = [];

  for (const local of currentAnimes) {
    const localIsDub = isDubbedTitle(
      `${local.titleRomaji} ${local.titleEnglish} ${local.titleNative}`,
    );
    const match =
      byId.get(local.id) ??
      (!localIsDub && local.anilistId ? byAni.get(local.anilistId) : undefined) ??
      (!localIsDub && local.malId ? byMal.get(local.malId) : undefined) ??
      (!localIsDub && local.kitsuId ? byKitsu.get(local.kitsuId) : undefined);

    if (!match) continue;

    const useServerCover = shouldPreferRemoteMedia(
      local.cover,
      match.cover ?? undefined,
      local,
      match.updatedAt,
    );
    const useServerBanner = shouldPreferRemoteMedia(
      local.banner,
      match.banner ?? undefined,
      local,
      match.updatedAt,
    );

    if (useServerCover || useServerBanner) {
      const nextUpdatedAt =
        Math.max(local.updatedAt ?? 0, match.updatedAt || 0) || local.updatedAt;
      const nextSyncedAt =
        Math.max(local.syncedAt ?? 0, match.updatedAt || 0) || local.syncedAt;

      batchUpdates.push({
        ...local,
        cover: useServerCover && match.cover ? match.cover : local.cover,
        banner: useServerBanner && match.banner ? match.banner : local.banner,
        updatedAt: nextUpdatedAt,
        syncedAt: nextSyncedAt,
      });
    }
  }

  return batchUpdates;
}

function buildScopedMetaInput(
  currentAnimes: LocalAnime[],
  sinceUpdatedAt?: number,
): AdminCatalogSyncMetaInput {
  if (currentAnimes.length > 1000) {
    return {
      sinceUpdatedAt,
      limit: Math.min(2000, currentAnimes.length),
    };
  }

  const ids: string[] = [];
  const anilistIds = new Set<number>();
  const malIds = new Set<number>();
  const kitsuIds = new Set<number>();

  for (const a of currentAnimes) {
    if (a.id) ids.push(a.id);
    if (typeof a.anilistId === "number" && a.anilistId > 0) {
      anilistIds.add(a.anilistId);
    }
    if (typeof a.malId === "number" && a.malId > 0) {
      malIds.add(a.malId);
    }
    if (typeof a.kitsuId === "number" && a.kitsuId > 0) {
      kitsuIds.add(a.kitsuId);
    }
  }

  return {
    sinceUpdatedAt,
    limit: Math.min(2000, Math.max(currentAnimes.length * 2, 100)),
    ids,
    anilistIds: Array.from(anilistIds),
    malIds: Array.from(malIds),
    kitsuIds: Array.from(kitsuIds),
  };
}

export async function syncAdminCatalogMetaCached(options?: {
  force?: boolean;
  fetcher?: (
    input: AdminCatalogSyncMetaInput,
  ) => Promise<AdminCatalogSyncMetaItem[]>;
}): Promise<{ updatedCount: number; skipped: boolean }> {
  const force = Boolean(options?.force);
  const currentAnimes = useHikariStore.getState().animes;

  if (currentAnimes.length === 0) {
    return { updatedCount: 0, skipped: true };
  }

  const now = Date.now();
  if (
    !force &&
    cachedMetaSync &&
    cachedMetaSync.catalogCount === currentAnimes.length &&
    now - cachedMetaSync.timestamp < ADMIN_CATALOG_META_TTL_MS
  ) {
    return { updatedCount: 0, skipped: true };
  }

  if (inFlightMetaSync && !force) {
    return inFlightMetaSync;
  }

  const requestEpoch = metaSyncEpoch;
  const canUseIncremental =
    !force &&
    cachedMetaSync &&
    cachedMetaSync.catalogCount === currentAnimes.length &&
    cachedMetaSync.lastServerUpdatedAt > 0;
  const sinceUpdatedAt = canUseIncremental
    ? cachedMetaSync!.lastServerUpdatedAt
    : undefined;

  const fetcher =
    options?.fetcher ??
    ((input: AdminCatalogSyncMetaInput) =>
      getAdminCatalogSyncMeta({ data: input }));

  let flightRef: Promise<{ updatedCount: number; skipped: boolean }> | null =
    null;

  const promise = (async () => {
    try {
      const input = buildScopedMetaInput(currentAnimes, sinceUpdatedAt);
      const rows = await fetcher(input);
      const latestSnapshot = useHikariStore.getState().animes;
      const updates = computeAdminCatalogMetaUpdates(latestSnapshot, rows);

      if (updates.length > 0) {
        useHikariStore.getState().upsertAnimesBatch(updates);
      }

      let maxUpdatedAt = cachedMetaSync?.lastServerUpdatedAt ?? 0;
      for (const r of rows) {
        if (r.updatedAt > maxUpdatedAt) {
          maxUpdatedAt = r.updatedAt;
        }
      }

      if (requestEpoch === metaSyncEpoch) {
        cachedMetaSync = {
          timestamp: Date.now(),
          lastServerUpdatedAt: maxUpdatedAt,
          catalogCount: latestSnapshot.length,
        };
      }

      return { updatedCount: updates.length, skipped: false };
    } finally {
      if (inFlightMetaSync === flightRef) {
        inFlightMetaSync = null;
      }
    }
  })();

  flightRef = promise;
  inFlightMetaSync = promise;
  return promise;
}
