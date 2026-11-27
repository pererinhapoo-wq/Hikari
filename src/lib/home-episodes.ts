import { getSql } from "@/lib/db";
import {
  invalidatePublicCatalogEpisodesCache,
  invalidatePublicCatalogEpisodesCacheAsync,
} from "@/lib/catalog-episodes";
import {
  getRedisHomePublicEpisodesWithFence,
  setRedisHomePublicEpisodes,
  invalidateRedisHomePublicEpisodes,
  scheduleRedisBackgroundWrite,
  type RedisEvalClient,
} from "@/lib/redis";

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

async function queryHomePublicEpisodesFromDb(
  limit: number,
  offset: number,
): Promise<HomeEpisodesResult> {
  try {
    const sql = await getSql();
    const rows = await sql.query<HomeEpisodeRow>(
      `SELECT
         e."id",
         e."animeId",
         e."seasonNumber",
         e."number",
         e."title",
         e."thumbnail",
         NULL AS "duration",
         NULL AS "synopsis",
         e."videoUrl",
         NULL AS "videoUrl2",
         NULL AS "videoUrl3",
         NULL AS "videoUrl4",
         NULL AS "videoUrl5",
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
         NULL AS "animeCreatedAt",
         NULL AS "animeUpdatedAt",
         a."anilistId" AS "animeAnilistId",
         a."malId" AS "animeMalId",
         a."kitsuId" AS "animeKitsuId",
         s."title" AS "seasonTitle"
       FROM "catalog_episode" e
       LEFT JOIN "catalog_anime" a ON a."id" = e."animeId"
       LEFT JOIN "catalog_season" s ON s."animeId" = e."animeId" AND s."number" = e."seasonNumber"
       WHERE e."published" = true
         AND (a."id" IS NULL OR a."archived_at" IS NULL)
       ORDER BY e."publishedAt" DESC NULLS LAST, e."createdAt" DESC, e."seasonNumber" DESC, e."number" DESC
       LIMIT $1 OFFSET $2;`,
      [limit, offset],
    );

    const episodes = (Array.isArray(rows) ? rows : []).map((row) => ({
      ...row,
      audio: row.audio ?? null,
      hasValidDubSource: Boolean(row.hasValidDubSource),
      badgeLancamento: Boolean(row.badgeLancamento),
      badgeNovo: Boolean(row.badgeNovo),
      badgeFinal: Boolean(row.badgeFinal),
    }));

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

/**
 * Consulta otimizada e exclusiva para a Home, projetando somente as colunas
 * necessárias para a vitrine de episódios recentes e removendo campos inativos
 * (videoUrl2-5, synopsis, duration, animeCreatedAt, animeUpdatedAt) para
 * otimizar o payload de transferência entre Neon e Vercel e o JSON de hidratação SSR.
 *
 * Para a chamada padrão da Home (limit === 10000 e offset === 0), utiliza cache
 * em memória por instância (TTL de 180s) com singleflight para evitar consultas
 * duplicadas ao Neon em acessos simultâneos.
 */
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

  const now = Date.now();
  if (
    cachedHomePublicEpisodesResult &&
    now - cachedHomePublicEpisodesResult.timestamp < HOME_PUBLIC_EPISODES_CACHE_TTL_MS
  ) {
    return cachedHomePublicEpisodesResult.data;
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
        if (requestEpoch === homePublicEpisodesCacheEpoch) {
          cachedHomePublicEpisodesResult = {
            data: redisRead.data,
            timestamp: Date.now(),
          };
        }
        return redisRead.data;
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
