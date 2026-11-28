import { getSql, type Sql } from "@/lib/db";
import { PLAYABLE_EPISODE_SQL_CONDITION } from "@/lib/catalog-episodes";
import { stripCatalogImageVersion } from "@/lib/image-utils";
import { buildEpisodeDubbedSqlCondition } from "@/lib/published-episodes";
import {
  EMPTY_PUBLIC_VISIBILITY_CONTEXT,
  filterPublicAnimes,
  normalizeCountryOfOrigin,
  type VisibilityIndexContext,
} from "@/lib/public-visibility";
import { getServerPublicVisibilityContext } from "@/lib/public-visibility-server";
import {
  getRedisHomeRecentlyAddedWithFence,
  invalidateRedisHomeRecentlyAdded,
  scheduleRedisBackgroundWrite,
  setRedisHomeRecentlyAdded,
  type HomeRecentlyAddedCachePayload,
  type RedisEvalClient,
} from "@/lib/redis";
import type { SlimAnime } from "@/lib/types";

export const MAX_HOME_RECENTLY_ADDED_ITEMS = 18;
export const HOME_RECENTLY_ADDED_CACHE_TTL_MS = 180 * 1000; // 180 segundos

export interface HomeRecentlyAddedDbRow {
  id: string;
  title: string;
  anilistId: number | null;
  malId: number | null;
  kitsuId: number | null;
  titleRomaji: string | null;
  titleEnglish: string | null;
  titleNative: string | null;
  cover: string | null;
  banner: string | null;
  synopsis: string | null;
  format: string | null;
  status: string | null;
  episodesCount: number | null;
  year: number | null;
  season: string | null;
  genres: string[] | null;
  score: number | null;
  trailerId: string | null;
  countryOfOrigin: string | null;
  duplicateOfId: string | null;
  hasDubbedEpisode: boolean;
  createdAt: string | Date | null;
  updatedAt: string | Date | null;
}

export interface HomeRecentlyAddedResult {
  status: "success" | "empty" | "error";
  items: SlimAnime[];
  total: number;
  error?: string;
}

let cachedHomeRecentlyAddedResult: {
  data: HomeRecentlyAddedResult;
  timestamp: number;
} | null = null;
let homeRecentlyAddedInFlightPromise: Promise<HomeRecentlyAddedResult> | null = null;
let homeRecentlyAddedCacheEpoch = 0;

export function resetHomeRecentlyAddedTestState(): void {
  homeRecentlyAddedCacheEpoch += 1;
  cachedHomeRecentlyAddedResult = null;
  homeRecentlyAddedInFlightPromise = null;
}

export function invalidateHomeRecentlyAddedCache(options?: {
  redisOverride?: RedisEvalClient | null;
}): void {
  homeRecentlyAddedCacheEpoch += 1;
  cachedHomeRecentlyAddedResult = null;
  homeRecentlyAddedInFlightPromise = null;
  scheduleRedisBackgroundWrite(
    invalidateRedisHomeRecentlyAdded(options?.redisOverride),
    "invalidateRedisHomeRecentlyAdded",
  );
}

export async function invalidateHomeRecentlyAddedCacheAsync(options?: {
  redisOverride?: RedisEvalClient | null;
}): Promise<void> {
  homeRecentlyAddedCacheEpoch += 1;
  cachedHomeRecentlyAddedResult = null;
  homeRecentlyAddedInFlightPromise = null;
  await invalidateRedisHomeRecentlyAdded(options?.redisOverride);
}

function toTimestampMs(val: unknown): number {
  if (typeof val === "number" && Number.isFinite(val) && val > 0) {
    return val;
  }
  if (val instanceof Date) {
    const ms = val.getTime();
    return Number.isFinite(ms) && ms > 0 ? ms : 0;
  }
  if (typeof val === "string" && val.trim()) {
    const ms = Date.parse(val);
    return Number.isFinite(ms) && ms > 0 ? ms : 0;
  }
  return 0;
}

export function mapRecentlyAddedDbRowToSlim(
  row: HomeRecentlyAddedDbRow,
): SlimAnime {
  const isStubTitle =
    !row.title ||
    row.title.trim() === row.id ||
    (typeof row.anilistId === "number" && row.title.trim() === String(row.anilistId));

  const romaji =
    row.titleRomaji?.trim() ||
    (!isStubTitle ? row.title.trim() : "") ||
    row.titleEnglish?.trim() ||
    row.titleNative?.trim() ||
    "Anime";

  const updatedAtMs = toTimestampMs(row.updatedAt);
  const createdAtMs = toTimestampMs(row.createdAt);

  return {
    id: row.id,
    ...(typeof row.anilistId === "number" && row.anilistId > 0
      ? { anilistId: row.anilistId }
      : {}),
    ...(typeof row.malId === "number" && row.malId > 0
      ? { malId: row.malId }
      : {}),
    ...(typeof row.kitsuId === "number" && row.kitsuId > 0
      ? { kitsuId: row.kitsuId }
      : {}),
    titles: {
      romaji,
      english: row.titleEnglish?.trim() || "",
      native: row.titleNative?.trim() || "",
    },
    cover: stripCatalogImageVersion(row.cover),
    banner: stripCatalogImageVersion(row.banner),
    synopsis: row.synopsis?.trim() || "",
    score: row.score ?? null,
    genres: Array.isArray(row.genres) ? row.genres.filter(Boolean) : [],
    format: row.format?.trim() || "TV",
    status: row.status?.trim() || "FINISHED",
    episodesCount: row.episodesCount ?? null,
    season: row.season?.trim() || null,
    year: row.year ?? null,
    trailerId: row.trailerId?.trim() || null,
    source: "local",
    catalogUpdatedAt: updatedAtMs || createdAtMs || undefined,
    serverCatalogId: row.id,
    hasEpisode: true,
    isDubbed: Boolean(row.hasDubbedEpisode),
    countryOfOrigin: normalizeCountryOfOrigin(row.countryOfOrigin),
    duplicateOfId: row.duplicateOfId?.trim() || null,
  };
}

function applyPublicVisibilityFilter(
  items: ReadonlyArray<SlimAnime>,
  visCtx: VisibilityIndexContext,
): SlimAnime[] {
  return filterPublicAnimes(items, visCtx).slice(0, MAX_HOME_RECENTLY_ADDED_ITEMS);
}

async function resolveSafePublicVisibilityContext(
  sqlOverride?: Sql,
): Promise<VisibilityIndexContext> {
  try {
    return await getServerPublicVisibilityContext(sqlOverride);
  } catch {
    return EMPTY_PUBLIC_VISIBILITY_CONTEXT;
  }
}

export async function queryHomeRecentlyAddedFromDb(
  sqlOverride?: Sql,
): Promise<HomeRecentlyAddedResult> {
  try {
    const sql = sqlOverride ?? (await getSql());
    const visCtx = await resolveSafePublicVisibilityContext(sql);

    const sqlFetchLimit = MAX_HOME_RECENTLY_ADDED_ITEMS * 2;
    const dubbedCondition = buildEpisodeDubbedSqlCondition("e", "cs", "a");

    const runQuery = async (includeVisibilityCols: boolean) => {
      const params: unknown[] = [sqlFetchLimit];
      const visConds: string[] = [];

      if (includeVisibilityCols) {
        visConds.push(
          `COALESCE(UPPER(BTRIM(a."country_of_origin")), '') <> 'CN'`,
        );
      }
      if (visCtx.blockedCatalogIds.size > 0) {
        params.push(Array.from(visCtx.blockedCatalogIds));
        visConds.push(`NOT (a."id" = ANY($${params.length}::text[]))`);
      }
      if (visCtx.blockedAnilistIds.size > 0) {
        params.push(Array.from(visCtx.blockedAnilistIds));
        visConds.push(
          `(a."anilistId" IS NULL OR NOT (a."anilistId" = ANY($${params.length}::integer[])))`,
        );
      }
      if (visCtx.blockedMalIds.size > 0) {
        params.push(Array.from(visCtx.blockedMalIds));
        visConds.push(
          `(a."malId" IS NULL OR NOT (a."malId" = ANY($${params.length}::integer[])))`,
        );
      }
      if (visCtx.blockedKitsuIds.size > 0) {
        params.push(Array.from(visCtx.blockedKitsuIds));
        visConds.push(
          `(a."kitsuId" IS NULL OR NOT (a."kitsuId" = ANY($${params.length}::integer[])))`,
        );
      }

      const visSql = visConds.length > 0 ? `AND ${visConds.join(" AND ")}` : "";

      return sql.query<HomeRecentlyAddedDbRow>(
        `SELECT
           a."id",
           a."title",
           a."anilistId",
           a."malId",
           a."kitsuId",
           a."titleRomaji",
           a."titleEnglish",
           a."titleNative",
           a."cover",
           a."banner",
           a."synopsis",
           a."format",
           a."status",
           a."episodesCount",
           a."year",
           a."season",
           a."genres",
           a."score",
           a."trailerId",
           ${
             includeVisibilityCols
               ? `a."country_of_origin" AS "countryOfOrigin",
           a."duplicate_of_id" AS "duplicateOfId",`
               : `NULL::text AS "countryOfOrigin",
           NULL::text AS "duplicateOfId",`
           }
           EXISTS (
             SELECT 1
             FROM "catalog_episode" e
             LEFT JOIN "catalog_season" cs
               ON cs."animeId" = e."animeId"
              AND cs."number" = e."seasonNumber"
             WHERE e."animeId" = a."id"
               AND e."published" = true
               AND ${PLAYABLE_EPISODE_SQL_CONDITION}
               AND ${dubbedCondition}
           ) AS "hasDubbedEpisode",
           a."createdAt",
           a."updatedAt"
         FROM "catalog_anime" a
         WHERE a."archived_at" IS NULL
           AND COALESCE(a."hidden", false) = false
           AND EXISTS (
             SELECT 1
             FROM "catalog_episode" e
             WHERE e."animeId" = a."id"
               AND e."published" = true
               AND ${PLAYABLE_EPISODE_SQL_CONDITION}
           )
           ${visSql}
         ORDER BY a."updatedAt" DESC NULLS LAST, a."createdAt" DESC NULLS LAST, a."id" ASC
         LIMIT $1;`,
        params,
      );
    };

    let rows: HomeRecentlyAddedDbRow[];
    try {
      rows = await runQuery(true);
    } catch (err: unknown) {
      if ((err as { code?: string } | null)?.code === "42703") {
        rows = await runQuery(false);
      } else {
        throw err;
      }
    }

    const mapped = (Array.isArray(rows) ? rows : []).map(
      mapRecentlyAddedDbRowToSlim,
    );
    const items = applyPublicVisibilityFilter(mapped, visCtx);

    return {
      status: items.length > 0 ? "success" : "empty",
      items,
      total: items.length,
    };
  } catch (err: unknown) {
    console.warn(
      "[home-recently-added] Falha segura ao consultar Animes Recém-Adicionados no PostgreSQL:",
      err instanceof Error ? err.message : err,
    );
    return {
      status: "error",
      items: [],
      total: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function executeGetHomeRecentlyAdded(options?: {
  sqlOverride?: Sql;
  redisOverride?: RedisEvalClient | null;
  bypassCache?: boolean;
  scheduleWrite?: (promise: Promise<unknown>, operation?: string) => void;
}): Promise<HomeRecentlyAddedResult> {
  if (options?.bypassCache) {
    return queryHomeRecentlyAddedFromDb(options.sqlOverride);
  }

  const now = Date.now();
  if (
    cachedHomeRecentlyAddedResult &&
    now - cachedHomeRecentlyAddedResult.timestamp <
      HOME_RECENTLY_ADDED_CACHE_TTL_MS
  ) {
    const visCtx = await resolveSafePublicVisibilityContext(options?.sqlOverride);
    const filtered = applyPublicVisibilityFilter(
      cachedHomeRecentlyAddedResult.data.items,
      visCtx,
    );
    if (filtered.length === cachedHomeRecentlyAddedResult.data.items.length) {
      return cachedHomeRecentlyAddedResult.data;
    }
    return {
      ...cachedHomeRecentlyAddedResult.data,
      status:
        filtered.length > 0
          ? "success"
          : cachedHomeRecentlyAddedResult.data.status === "error"
            ? "error"
            : "empty",
      items: filtered,
      total: filtered.length,
    };
  }

  if (homeRecentlyAddedInFlightPromise) {
    return homeRecentlyAddedInFlightPromise;
  }

  const requestEpoch = homeRecentlyAddedCacheEpoch;
  const scheduleWrite = options?.scheduleWrite ?? scheduleRedisBackgroundWrite;
  let flightRef: Promise<HomeRecentlyAddedResult> | null = null;

  const currentFlight = (async (): Promise<HomeRecentlyAddedResult> => {
    try {
      const redisRead = await getRedisHomeRecentlyAddedWithFence(
        options?.redisOverride,
      );
      if (redisRead.status === "hit" && redisRead.data) {
        const visCtx = await resolveSafePublicVisibilityContext(
          options?.sqlOverride,
        );
        const filtered = applyPublicVisibilityFilter(redisRead.data.items, visCtx);
        const normalizedHit: HomeRecentlyAddedResult =
          filtered.length === redisRead.data.items.length
            ? redisRead.data
            : {
                status: filtered.length > 0 ? "success" : "empty",
                items: filtered,
                total: filtered.length,
              };
        if (requestEpoch === homeRecentlyAddedCacheEpoch) {
          cachedHomeRecentlyAddedResult = {
            data: normalizedHit,
            timestamp: Date.now(),
          };
        }
        return normalizedHit;
      }

      const fetchStartedAt = Date.now();
      const result = await queryHomeRecentlyAddedFromDb(options?.sqlOverride);

      if (
        result.status !== "error" &&
        requestEpoch === homeRecentlyAddedCacheEpoch
      ) {
        cachedHomeRecentlyAddedResult = {
          data: result,
          timestamp: Date.now(),
        };
        if (redisRead.fence) {
          const cachePayload: HomeRecentlyAddedCachePayload = {
            status: result.status === "success" ? "success" : "empty",
            items: result.items,
            total: result.total,
          };
          scheduleWrite(
            setRedisHomeRecentlyAdded(
              cachePayload,
              redisRead.fence,
              fetchStartedAt,
              options?.redisOverride,
            ),
            "setRedisHomeRecentlyAdded",
          );
        }
      }

      return result;
    } finally {
      if (homeRecentlyAddedInFlightPromise === flightRef) {
        homeRecentlyAddedInFlightPromise = null;
      }
    }
  })();

  flightRef = currentFlight;
  homeRecentlyAddedInFlightPromise = currentFlight;
  return currentFlight;
}
