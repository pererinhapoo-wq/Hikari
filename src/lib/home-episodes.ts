import { getSql } from "@/lib/db";
import {
  FIRST_PLAYABLE_VIDEO_URL_SQL,
  PLAYABLE_EPISODE_SQL_CONDITION,
  invalidatePublicCatalogEpisodesCache,
  invalidatePublicCatalogEpisodesCacheAsync,
} from "@/lib/catalog-episodes";
import { buildEpisodeDubbedSqlCondition } from "@/lib/published-episodes";
import {
  getRedisHomePublicEpisodesWithFence,
  setRedisHomePublicEpisodes,
  invalidateRedisHomePublicEpisodes,
  scheduleRedisBackgroundWrite,
  type RedisEvalClient,
} from "@/lib/redis";
import {
  isPubliclyBlockedAnime,
  normalizeCountryOfOrigin,
  type VisibilityIndexContext,
} from "@/lib/public-visibility";

export interface HomeEpisodeRow {
  id: string;
  animeId: string;
  seasonNumber: number;
  number: number;
  title: string | null;
  thumbnail: string | null;
  duration: null;
  synopsis: null;
  videoUrl: string | null;
  videoUrl2: null;
  videoUrl3: null;
  videoUrl4: null;
  videoUrl5: null;
  hikariPlayerEpisodeId?: string | null;
  audio?: string | null;
  hasValidDubSource?: boolean;
  published: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  badgeLancamento: boolean;
  badgeNovo: boolean;
  badgeFinal: boolean;
  animeTitle: string | null;
  animeTitleRomaji: string | null;
  animeTitleEnglish: string | null;
  animeTitleNative: string | null;
  animeCover: string | null;
  animeBanner: string | null;
  animeStatus: string | null;
  animeEpisodesCount: number | null;
  animeCreatedAt: null;
  animeUpdatedAt: null;
  animeAnilistId?: number | null;
  animeMalId?: number | null;
  animeKitsuId?: number | null;
  animeCountryOfOrigin?: string | null;
  animeDuplicateOfId?: string | null;
  seasonTitle: string | null;
}

export interface HomeEpisodesResult {
  status: "success" | "empty" | "error";
  episodes: HomeEpisodeRow[];
  total: number;
  error?: string;
}

const HOME_PUBLIC_EPISODES_CACHE_TTL_MS = 180 * 1000; // 180 segundos

let cachedHomePublicEpisodesResult: {
  data: HomeEpisodesResult;
  timestamp: number;
} | null = null;
let homePublicEpisodesInFlightPromise: Promise<HomeEpisodesResult> | null = null;
let homePublicEpisodesCacheEpoch = 0;

export function invalidateHomePublicEpisodesCache(): void {
  homePublicEpisodesCacheEpoch += 1;
  cachedHomePublicEpisodesResult = null;
  homePublicEpisodesInFlightPromise = null;
  void invalidateRedisHomePublicEpisodes().catch(() => {});
  invalidatePublicCatalogEpisodesCache();
  import("@/lib/home-hero.server")
    .then((m) => m.invalidateHomeHeroCache())
    .catch(() => {});
  import("@/lib/home-trending.server")
    .then((m) => m.invalidateHomeTrendingCache({ skipHero: true }))
    .catch(() => {});
}

export async function invalidateHomePublicEpisodesCacheAsync(options?: {
  skipHeroAndTrending?: boolean;
  redisOverride?: RedisEvalClient | null;
}): Promise<void> {
  homePublicEpisodesCacheEpoch += 1;
  cachedHomePublicEpisodesResult = null;
  homePublicEpisodesInFlightPromise = null;

  await Promise.allSettled([
    invalidateRedisHomePublicEpisodes(),
    invalidatePublicCatalogEpisodesCacheAsync(),
    ...(options?.skipHeroAndTrending
      ? []
      : [
          import("@/lib/home-hero.server").then((m) =>
            m.invalidateHomeHeroCacheAsync(options?.redisOverride),
          ),
          import("@/lib/home-trending.server").then((m) =>
            m.invalidateHomeTrendingCacheAsync(options?.redisOverride, {
              skipHero: true,
            }),
          ),
        ]),
  ]);
}

function filterHomeEpisodeRows(
  rows: ReadonlyArray<HomeEpisodeRow>,
  visCtx: VisibilityIndexContext,
): HomeEpisodeRow[] {
  return rows.filter(
    (row) =>
      !isPubliclyBlockedAnime(
        {
          id: row.animeId,
          animeId: row.animeId,
          animeAnilistId: row.animeAnilistId,
          animeMalId: row.animeMalId,
          animeKitsuId: row.animeKitsuId,
          animeCountryOfOrigin: row.animeCountryOfOrigin,
          duplicateOfId: row.animeDuplicateOfId,
        },
        visCtx,
      ),
  );
}

async function queryHomePublicEpisodesFromDb(
  limit: number,
  offset: number,
): Promise<HomeEpisodesResult> {
  try {
    const sql = await getSql();
    const { getServerPublicVisibilityContext } = await import(
      "@/lib/public-visibility.server"
    );
    const visCtx = await getServerPublicVisibilityContext(sql);

    const canonicalAnimeGroupExpr = `COALESCE(
      CASE WHEN a."anilistId" IS NOT NULL THEN 'anilist:' || a."anilistId"::text END,
      CASE WHEN alias_id."anilist_id" IS NOT NULL THEN 'anilist:' || alias_id."anilist_id"::text END,
      CASE WHEN a_alias."anilistId" IS NOT NULL THEN 'anilist:' || a_alias."anilistId"::text END,
      alias_id."current_id",
      CASE WHEN e."animeId" ~ '^[0-9]+$' THEN 'anilist:' || e."animeId" END,
      e."animeId"
    )`;
    const seasonExpr = `COALESCE(NULLIF(e."seasonNumber", 0), 1)`;
    const dubbedExpr = buildEpisodeDubbedSqlCondition("e", "s", "a");

    const runQuery = async (includeOriginCol: boolean) => {
      const params: unknown[] = [limit, offset];
      const visConds: string[] = [];
      if (includeOriginCol) {
        visConds.push(`COALESCE(UPPER(BTRIM(a."country_of_origin")), '') <> 'CN'`);
      }
      if (visCtx.blockedCatalogIds.size > 0) {
        params.push(Array.from(visCtx.blockedCatalogIds));
        visConds.push(`NOT (e."animeId" = ANY($${params.length}::text[]))`);
        visConds.push(
          `(alias_id."current_id" IS NULL OR NOT (alias_id."current_id" = ANY($${params.length}::text[])))`,
        );
      }
      if (visCtx.blockedAnilistIds.size > 0) {
        params.push(Array.from(visCtx.blockedAnilistIds));
        visConds.push(
          `(a."anilistId" IS NULL OR NOT (a."anilistId" = ANY($${params.length}::integer[])))`,
        );
        visConds.push(
          `(a_alias."anilistId" IS NULL OR NOT (a_alias."anilistId" = ANY($${params.length}::integer[])))`,
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

      return sql.query<HomeEpisodeRow>(
        `WITH ranked_episodes AS (
           SELECT
             e."id",
             e."animeId",
             ${seasonExpr} AS "seasonNumber",
             e."number",
             e."title",
             e."thumbnail",
             ${FIRST_PLAYABLE_VIDEO_URL_SQL} AS "videoUrl",
             e."hikari_player_episode_id" AS "hikariPlayerEpisodeId",
             e."audio",
             EXISTS (
               SELECT 1
               FROM "episode_sources" es
               WHERE es."episode_id" = e."id"
                 AND es."lang" = 'dub'
                 AND COALESCE(es."status", 'active') NOT IN ('broken', 'incomplete')
             ) AS "hasValidDubSource",
             e."published",
             e."publishedAt",
             e."createdAt",
             e."updatedAt",
             COALESCE(e."badge_lancamento", false) AS "badgeLancamento",
             COALESCE(e."badge_novo", false) AS "badgeNovo",
             COALESCE(e."badge_final", false) AS "badgeFinal",
             COALESCE(NULLIF(a."title", ''), a."titleRomaji", a."titleEnglish", 'Anime') AS "animeTitle",
             a."titleRomaji" AS "animeTitleRomaji",
             a."titleEnglish" AS "animeTitleEnglish",
             a."titleNative" AS "animeTitleNative",
             a."cover" AS "animeCover",
             a."banner" AS "animeBanner",
             a."status" AS "animeStatus",
             a."episodesCount" AS "animeEpisodesCount",
             a."anilistId" AS "animeAnilistId",
             a."malId" AS "animeMalId",
             a."kitsuId" AS "animeKitsuId",
             ${
               includeOriginCol
                 ? `a."country_of_origin" AS "animeCountryOfOrigin",
             a."duplicate_of_id" AS "animeDuplicateOfId",`
                 : `NULL::text AS "animeCountryOfOrigin",
             NULL::text AS "animeDuplicateOfId",`
             }
             s."title" AS "seasonTitle",
             ROW_NUMBER() OVER (
               PARTITION BY ${canonicalAnimeGroupExpr}, ${seasonExpr}, ${dubbedExpr}
               ORDER BY e."number" ASC, e."publishedAt" DESC NULLS LAST, e."createdAt" DESC, e."id" ASC
             ) AS "rn_first",
             ROW_NUMBER() OVER (
               PARTITION BY ${canonicalAnimeGroupExpr}, ${seasonExpr}, ${dubbedExpr}
               ORDER BY e."number" DESC, e."publishedAt" DESC NULLS LAST, e."createdAt" DESC, e."id" ASC
             ) AS "rn_last"
           FROM "catalog_episode" e
           LEFT JOIN "catalog_anime" a ON a."id" = e."animeId"
           LEFT JOIN "catalog_anime_id_alias" alias_id ON alias_id."old_id" = e."animeId"
           LEFT JOIN "catalog_anime" a_alias ON alias_id."current_id" IS NOT NULL AND a_alias."id" = alias_id."current_id"
           LEFT JOIN "catalog_season" s ON s."animeId" = e."animeId" AND s."number" = e."seasonNumber"
           WHERE e."published" = true
             AND (a."id" IS NULL OR a."archived_at" IS NULL)
             AND ${PLAYABLE_EPISODE_SQL_CONDITION}
             ${visSql}
         )
         SELECT
           "id",
           "animeId",
           "seasonNumber",
           "number",
           "title",
           "thumbnail",
           NULL AS "duration",
           NULL AS "synopsis",
           "videoUrl",
           NULL AS "videoUrl2",
           NULL AS "videoUrl3",
           NULL AS "videoUrl4",
           NULL AS "videoUrl5",
           "hikariPlayerEpisodeId",
           "audio",
           "hasValidDubSource",
           "published",
           "publishedAt",
           "createdAt",
           "updatedAt",
           "badgeLancamento",
           "badgeNovo",
           "badgeFinal",
           "animeTitle",
           "animeTitleRomaji",
           "animeTitleEnglish",
           "animeTitleNative",
           "animeCover",
           "animeBanner",
           "animeStatus",
           "animeEpisodesCount",
           NULL AS "animeCreatedAt",
           NULL AS "animeUpdatedAt",
           "animeAnilistId",
           "animeMalId",
           "animeKitsuId",
           "animeCountryOfOrigin",
           "animeDuplicateOfId",
           "seasonTitle"
         FROM ranked_episodes
         WHERE "rn_first" = 1 OR "rn_last" = 1
         ORDER BY "publishedAt" DESC NULLS LAST, "createdAt" DESC, "seasonNumber" DESC, "number" DESC
         LIMIT $1 OFFSET $2;`,
        params,
      );
    };

    let rows: HomeEpisodeRow[];
    try {
      rows = await runQuery(true);
    } catch (err: unknown) {
      if ((err as { code?: string } | null)?.code === "42703") {
        rows = await runQuery(false);
      } else {
        throw err;
      }
    }

    const mapped = (Array.isArray(rows) ? rows : []).map((row) => ({
      ...row,
      audio: row.audio ?? null,
      animeCountryOfOrigin: normalizeCountryOfOrigin(row.animeCountryOfOrigin),
      animeDuplicateOfId: row.animeDuplicateOfId ?? null,
      hasValidDubSource: Boolean(row.hasValidDubSource),
      badgeLancamento: Boolean(row.badgeLancamento),
      badgeNovo: Boolean(row.badgeNovo),
      badgeFinal: Boolean(row.badgeFinal),
    }));

    const episodes = filterHomeEpisodeRows(mapped, visCtx);

    return {
      status: episodes.length > 0 ? "success" : "empty",
      episodes,
      total: episodes.length,
    };
  } catch (err: any) {
    console.warn("[Hikari] Falha segura ao consultar episódios da Home no PostgreSQL:", err);
    return {
      status: "error",
      episodes: [],
      total: 0,
      error: err?.message || String(err),
    };
  }
}

export async function executeGetHomePublicEpisodes(options?: {
  limit?: number;
  offset?: number;
}): Promise<HomeEpisodesResult> {
  const limit =
    typeof options?.limit === "number" && options.limit > 0
      ? options.limit
      : 10000;
  const offset =
    typeof options?.offset === "number" && options.offset >= 0
      ? options.offset
      : 0;

  if (limit !== 10000 || offset !== 0) {
    return queryHomePublicEpisodesFromDb(limit, offset);
  }

  const { getServerPublicVisibilityContext } = await import(
    "@/lib/public-visibility.server"
  );

  const now = Date.now();
  if (
    cachedHomePublicEpisodesResult &&
    now - cachedHomePublicEpisodesResult.timestamp < HOME_PUBLIC_EPISODES_CACHE_TTL_MS
  ) {
    const visCtx = await getServerPublicVisibilityContext();
    const filtered = filterHomeEpisodeRows(
      cachedHomePublicEpisodesResult.data.episodes,
      visCtx,
    );
    if (filtered.length === cachedHomePublicEpisodesResult.data.episodes.length) {
      return cachedHomePublicEpisodesResult.data;
    }
    return {
      ...cachedHomePublicEpisodesResult.data,
      status: filtered.length > 0 ? "success" : cachedHomePublicEpisodesResult.data.status === "error" ? "error" : "empty",
      episodes: filtered,
      total: filtered.length,
    };
  }

  if (homePublicEpisodesInFlightPromise) {
    return homePublicEpisodesInFlightPromise;
  }

  const requestEpoch = homePublicEpisodesCacheEpoch;
  let flightRef: Promise<HomeEpisodesResult> | null = null;
  const currentFlight = (async (): Promise<HomeEpisodesResult> => {
    try {
      // 2. Segunda camada: Redis compartilhado com verificação de geração (fence)
      const redisRead = await getRedisHomePublicEpisodesWithFence();
      if (redisRead.status === "hit" && redisRead.data) {
        const visCtx = await getServerPublicVisibilityContext();
        const filtered = filterHomeEpisodeRows(redisRead.data.episodes, visCtx);
        const normalizedHit: HomeEpisodesResult =
          filtered.length === redisRead.data.episodes.length
            ? redisRead.data
            : {
                ...redisRead.data,
                status:
                  filtered.length > 0
                    ? "success"
                    : redisRead.data.status === "error"
                      ? "error"
                      : "empty",
                episodes: filtered,
                total: filtered.length,
              };
        if (requestEpoch === homePublicEpisodesCacheEpoch) {
          cachedHomePublicEpisodesResult = {
            data: normalizedHit,
            timestamp: Date.now(),
          };
        }
        return normalizedHit;
      }

      // 3. Terceira camada: PostgreSQL em miss de RAM + Redis
      const fetchStartedAt = Date.now();
      const result = await queryHomePublicEpisodesFromDb(limit, offset);
      if (result.status !== "error" && requestEpoch === homePublicEpisodesCacheEpoch) {
        cachedHomePublicEpisodesResult = {
          data: result,
          timestamp: Date.now(),
        };
        if (redisRead.fence) {
          scheduleRedisBackgroundWrite(
            setRedisHomePublicEpisodes(
              result,
              redisRead.fence,
              fetchStartedAt,
            ),
            "setRedisHomePublicEpisodes",
          );
        }
      }
      return result;
    } finally {
      if (homePublicEpisodesInFlightPromise === flightRef) {
        homePublicEpisodesInFlightPromise = null;
      }
    }
  })();

  flightRef = currentFlight;
  homePublicEpisodesInFlightPromise = currentFlight;
  return currentFlight;
}
