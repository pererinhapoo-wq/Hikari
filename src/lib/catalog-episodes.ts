import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { adminMiddleware, bearerForwardMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { normalizeAnimeRecentBadges, type Episode, type Season } from "@/lib/types";
import {
  getRedisCatalogEpisodes,
  setRedisCatalogEpisodes,
  invalidateRedisCatalogEpisodes,
  invalidateRedisAnimeJikanEpisodes,
  notifyJikanEpisodesRamInvalidation,
  getRedisPublicCatalogEpisodesWithFence,
  setRedisPublicCatalogEpisodes,
  invalidateRedisPublicCatalogEpisodes,
  getRedisPublicCatalogAnimeOptionsWithFence,
  setRedisPublicCatalogAnimeOptions,
  invalidateRedisPublicCatalogAnimeOptions,
  scheduleRedisBackgroundWrite,
} from "@/lib/redis";
import {
  readTombstones,
  readTombstoneRecords,
  isEpisodeTombstoned,
  type TombstoneRecord,
} from "@/lib/catalog-storage";
import { readOutbox, type OutboxOperation } from "@/lib/episode-writer";
import {
  hasEpisodePlayableSource,
  isHikariPlayableUrl,
  sanitizePlayableVideoUrl,
} from "@/lib/published-episodes";
import {
  buildHikariPlayerEpisodeUrl,
  normalizeHikariPlayerEpisodeId,
} from "@/lib/hikari-player";
import { resolveAnimeCandidateIdsFromDb } from "@/lib/anime-identity";

export const getCatalogEpisodesSchema = z.object({
  animeId: z.string().min(1, "animeId é obrigatório"),
  includeUnpublished: z.boolean().optional(),
});

export type GetCatalogEpisodesInput = z.infer<typeof getCatalogEpisodesSchema>;

export interface CatalogEpisodeItem {
  id: string;
  animeId: string;
  seasonNumber: number;
  number: number;
  title: string | null;
  thumbnail: string | null;
  duration: string | null;
  synopsis: string | null;
  videoUrl: string | null;
  videoUrl2: string | null;
  videoUrl3: string | null;
  videoUrl4: string | null;
  videoUrl5: string | null;
  hikariPlayerEpisodeId?: string | null;
  openingStartSeconds?: number | null;
  openingEndSeconds?: number | null;
  published: boolean;
  publishedAt: string | null;
  createdAt?: string;
  updatedAt?: string;
  badgeLancamento?: boolean;
  badgeNovo?: boolean;
  badgeFinal?: boolean;
}

export interface CatalogSeasonItem {
  animeId: string;
  number: number;
  title: string | null;
  position: number;
  createdAt?: string;
}

export interface CatalogEpisodesResult {
  animeId: string;
  seasons: CatalogSeasonItem[];
  episodes: CatalogEpisodeItem[];
}

// Cache em memória com staleTime de aproximadamente 2 minutos
const STALE_TIME_MS = 2 * 60 * 1000;

interface CacheEntry {
  timestamp: number;
  data: CatalogEpisodesResult;
}

const clientCatalogEpisodesCache = new Map<string, CacheEntry>();
const clientInFlightPromises = new Map<string, Promise<CatalogEpisodesResult>>();

const SERVER_CATALOG_EPISODES_TTL_MS = 180 * 1000; // 180s por instância
const SERVER_CATALOG_EPISODES_MAX_ENTRIES = 300;
const serverCatalogEpisodesCache = new Map<
  string,
  { timestamp: number; data: CatalogEpisodesResult; candidateIds: string[] }
>();
const serverCatalogEpisodesInFlight = new Map<string, Promise<CatalogEpisodesResult>>();
let serverCatalogEpisodesCacheEpoch = 0;

function setServerCatalogEpisodesRamCache(
  key: string,
  data: CatalogEpisodesResult,
  candidateIds: string[],
): void {
  if (
    !serverCatalogEpisodesCache.has(key) &&
    serverCatalogEpisodesCache.size >= SERVER_CATALOG_EPISODES_MAX_ENTRIES
  ) {
    const oldestKey = serverCatalogEpisodesCache.keys().next().value;
    if (oldestKey !== undefined) {
      serverCatalogEpisodesCache.delete(oldestKey);
    }
  }
  serverCatalogEpisodesCache.set(key, {
    timestamp: Date.now(),
    data,
    candidateIds,
  });
}

function invalidateServerCatalogEpisodesRam(ids: string[]): void {
  serverCatalogEpisodesCacheEpoch += 1;
  if (ids.length === 0) {
    serverCatalogEpisodesCache.clear();
    serverCatalogEpisodesInFlight.clear();
    return;
  }
  const targetSet = new Set(ids);
  for (const [entryKey, entry] of serverCatalogEpisodesCache.entries()) {
    if (
      targetSet.has(entryKey) ||
      entry.candidateIds.some((cid) => targetSet.has(cid))
    ) {
      serverCatalogEpisodesCache.delete(entryKey);
    }
  }
  for (const id of ids) {
    serverCatalogEpisodesInFlight.delete(id);
  }
}

/**
 * Invalida o cache em memória de episódios para um anime específico (ou todo o cache).
 */
export function invalidateCatalogEpisodesCache(...animeIds: (string | undefined)[]): void {
  const ids = Array.from(
    new Set(
      animeIds
        .filter((id): id is string => typeof id === "string" && Boolean(id.trim()))
        .map((id) => id.trim()),
    ),
  );
  invalidateServerCatalogEpisodesRam(ids);
  if (ids.length > 0) {
    for (const id of ids) {
      clientCatalogEpisodesCache.delete(id);
      clientInFlightPromises.delete(id);
      void invalidateRedisCatalogEpisodes(id).catch(() => {});
    }
    notifyJikanEpisodesRamInvalidation(ids);
    void invalidateRedisAnimeJikanEpisodes(ids[0], { extraIds: ids.slice(1) }).catch(() => {});
  } else {
    clientCatalogEpisodesCache.clear();
    clientInFlightPromises.clear();
    notifyJikanEpisodesRamInvalidation([]);
    void invalidateRedisAnimeJikanEpisodes().catch(() => {});
  }
}

export async function invalidateCatalogEpisodesCacheAsync(
  ...animeIds: (string | undefined)[]
): Promise<void> {
  const ids = Array.from(
    new Set(
      animeIds
        .filter((id): id is string => typeof id === "string" && Boolean(id.trim()))
        .map((id) => id.trim()),
    ),
  );
  invalidateServerCatalogEpisodesRam(ids);
  if (ids.length > 0) {
    notifyJikanEpisodesRamInvalidation(ids);
    await Promise.allSettled([
      ...ids.map(async (id) => {
        clientCatalogEpisodesCache.delete(id);
        clientInFlightPromises.delete(id);
        await invalidateRedisCatalogEpisodes(id);
      }),
      invalidateRedisAnimeJikanEpisodes(ids[0], { extraIds: ids.slice(1) }),
    ]);
  } else {
    clientCatalogEpisodesCache.clear();
    clientInFlightPromises.clear();
    notifyJikanEpisodesRamInvalidation([]);
    await invalidateRedisAnimeJikanEpisodes();
  }
}

/**
 * Alimenta o cache de episódios (útil para pré-carregamento no loader).
 */
export function primeCatalogEpisodesCache(
  animeId: string,
  data: CatalogEpisodesResult,
): void {
  if (!animeId) return;
  clientCatalogEpisodesCache.set(animeId, {
    timestamp: Date.now(),
    data,
  });
}

export function getCachedCatalogEpisodes(
  animeId: string,
): CatalogEpisodesResult | null {
  if (!animeId) return null;
  const cached = clientCatalogEpisodesCache.get(animeId.trim());
  if (cached && Date.now() - cached.timestamp < STALE_TIME_MS) {
    return cached.data;
  }
  return null;
}

/**
 * Consulta server-side segura de episódios (publicados ou todos no caso administrativo)
 * e metadados de temporadas de um anime.
 */
export async function executeGetCatalogEpisodes(
  animeId: string,
  options?: { includeUnpublished?: boolean },
): Promise<CatalogEpisodesResult> {
  const cleanId = animeId?.trim();
  if (!cleanId) {
    return { animeId: "", seasons: [], episodes: [] };
  }

  const wantUnpublished = Boolean(options?.includeUnpublished);

  if (!wantUnpublished) {
    const cachedRam = serverCatalogEpisodesCache.get(cleanId);
    if (
      cachedRam &&
      Date.now() - cachedRam.timestamp < SERVER_CATALOG_EPISODES_TTL_MS
    ) {
      return cachedRam.data;
    }

    const existingFlight = serverCatalogEpisodesInFlight.get(cleanId);
    if (existingFlight) {
      return existingFlight;
    }
  }

  const requestEpoch = serverCatalogEpisodesCacheEpoch;

  const runFetch = async (): Promise<CatalogEpisodesResult> => {
    // 1. Tentar consultar no Upstash Redis (cache compartilhado) se for consulta pública
    if (!wantUnpublished) {
      try {
        const cached = await getRedisCatalogEpisodes(cleanId);
        if (cached && typeof cached === "object" && Array.isArray(cached.episodes)) {
          if (requestEpoch === serverCatalogEpisodesCacheEpoch) {
            setServerCatalogEpisodesRamCache(cleanId, cached, [cleanId]);
          }
          return cached;
        }
      } catch {
        // ignore
      }
    }

    try {
      const sql = await getSql();

      const candidateIds = [cleanId];
      try {
        const candidateInfo = await resolveAnimeCandidateIdsFromDb(sql, cleanId);
        for (const c of candidateInfo.candidateIds) {
          if (c && !candidateIds.includes(c)) {
            candidateIds.push(c);
          }
        }
      } catch {
        // ignore
      }

      const whereClause = wantUnpublished
        ? `WHERE "animeId" = ANY($1::text[])`
        : `WHERE "animeId" = ANY($1::text[]) AND "published" = true`;

      // Executa consultas de episódios e temporadas em paralelo após resolver candidateIds
      const [episodeRows, seasonRows] = await Promise.all([
        sql.query<CatalogEpisodeItem>(
          `SELECT
             "id",
             "animeId",
             "seasonNumber",
             "number",
             "title",
             "thumbnail",
             "duration",
             "synopsis",
             "videoUrl",
             "videoUrl2",
             "videoUrl3",
             "videoUrl4",
             "videoUrl5",
             "hikari_player_episode_id" AS "hikariPlayerEpisodeId",
             "opening_start_seconds" AS "openingStartSeconds",
             "opening_end_seconds" AS "openingEndSeconds",
             COALESCE("badge_lancamento", false) AS "badgeLancamento",
             COALESCE("badge_novo", false) AS "badgeNovo",
             COALESCE("badge_final", false) AS "badgeFinal",
             "published",
             "publishedAt",
             "createdAt",
             "updatedAt"
           FROM "catalog_episode"
           ${whereClause}
           ORDER BY "seasonNumber" ASC, "number" ASC;`,
          [candidateIds],
        ),
        sql.query<CatalogSeasonItem>(
          `SELECT
             "animeId",
             "number",
             "title",
             "position",
             "createdAt"
           FROM "catalog_season"
           WHERE "animeId" = ANY($1::text[])
           ORDER BY "position" ASC, "number" ASC;`,
          [candidateIds],
        ),
      ]);

      const result: CatalogEpisodesResult = {
        animeId: cleanId,
        seasons: seasonRows,
        episodes: episodeRows,
      };

      if (!wantUnpublished) {
        if (requestEpoch === serverCatalogEpisodesCacheEpoch) {
          setServerCatalogEpisodesRamCache(cleanId, result, candidateIds);
        }
        scheduleRedisBackgroundWrite(
          setRedisCatalogEpisodes(cleanId, result),
          "setRedisCatalogEpisodes",
        );
      }

      return result;
    } catch (err) {
      console.warn("[Hikari] Falha segura ao consultar catalog_episode:", err);
      return {
        animeId: cleanId,
        seasons: [],
        episodes: [],
      };
    }
  };

  if (wantUnpublished) {
    return runFetch();
  }

  let flightRef: Promise<CatalogEpisodesResult> | null = null;
  const currentFlight = runFetch().finally(() => {
    if (serverCatalogEpisodesInFlight.get(cleanId) === flightRef) {
      serverCatalogEpisodesInFlight.delete(cleanId);
    }
  });
  flightRef = currentFlight;
  serverCatalogEpisodesInFlight.set(cleanId, currentFlight);
  return currentFlight;
}


/**
 * Server Function GET para consultar episódios publicados de um anime no PostgreSQL (acesso público).
 * Caso `includeUnpublished: true` seja solicitado, exige sessão administrativa autorizada no servidor.
 */
export const getCatalogEpisodes = createServerFn({
  method: "GET",
})
  .middleware([bearerForwardMiddleware])
  .validator(getCatalogEpisodesSchema)
  .handler(async ({ data, context }): Promise<CatalogEpisodesResult> => {
    const wantUnpublished = Boolean(data.includeUnpublished);
    if (wantUnpublished) {
      const { assertSameSiteRequest } = await import(
        "@/lib/auth/isolation.server"
      );
      const { verifyAdminServerCaller } = await import(
        "@/lib/auth/admin.server"
      );
      assertSameSiteRequest();
      await verifyAdminServerCaller(context?.bearerToken);
    }

    return executeGetCatalogEpisodes(data.animeId, {
      includeUnpublished: wantUnpublished,
    });
  });

/**
 * Server Function GET para recuperar todos os episódios (inclusive rascunhos)
 * no painel administrativo a partir do PostgreSQL.
 */
export const getAdminCatalogEpisodes = createServerFn({
  method: "GET",
})
  .middleware([adminMiddleware])
  .validator(getCatalogEpisodesSchema)
  .handler(async ({ data }): Promise<CatalogEpisodesResult> => {
    return executeGetCatalogEpisodes(data.animeId, {
      includeUnpublished: true,
    });
  });

export interface PublicEpisodeRow {
  id: string;
  animeId: string;
  seasonNumber: number;
  number: number;
  title: string | null;
  thumbnail: string | null;
  duration: string | null;
  synopsis: string | null;
  videoUrl: string | null;
  videoUrl2: string | null;
  videoUrl3: string | null;
  videoUrl4: string | null;
  videoUrl5: string | null;
  hikariPlayerEpisodeId?: string | null;
  openingStartSeconds?: number | null;
  openingEndSeconds?: number | null;
  published: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  badgeLancamento?: boolean;
  badgeNovo?: boolean;
  badgeFinal?: boolean;
  animeTitle: string | null;
  animeTitleRomaji: string | null;
  animeTitleEnglish: string | null;
  animeTitleNative: string | null;
  animeCover: string | null;
  animeBanner: string | null;
  animeStatus: string | null;
  animeEpisodesCount: number | null;
  animeCreatedAt: string | null;
  animeUpdatedAt: string | null;
  animeAnilistId?: number | null;
  animeMalId?: number | null;
  animeKitsuId?: number | null;
  seasonTitle: string | null;
}

export type PublicEpisodesFetchStatus = "success" | "empty" | "error";

export interface PublicEpisodesResult {
  status: PublicEpisodesFetchStatus;
  episodes: PublicEpisodeRow[];
  total: number;
  error?: string;
}

const PUBLIC_CATALOG_EPISODES_CACHE_TTL_MS = 180 * 1000; // 180 segundos
const PUBLIC_CATALOG_EPISODES_MAX_RAM_ENTRIES = 20;

const publicCatalogEpisodesCache = new Map<
  string,
  { data: PublicEpisodesResult; timestamp: number }
>();
const publicCatalogEpisodesInFlight = new Map<
  string,
  Promise<PublicEpisodesResult>
>();
let publicCatalogEpisodesCacheEpoch = 0;

export function invalidatePublicCatalogEpisodesLocalCache(): void {
  publicCatalogEpisodesCacheEpoch += 1;
  publicCatalogEpisodesCache.clear();
  publicCatalogEpisodesInFlight.clear();
  publicCatalogAnimeOptionsCacheEpoch += 1;
  cachedPublicCatalogAnimeOptions = null;
  publicCatalogAnimeOptionsInFlight = null;
}

export function invalidatePublicCatalogEpisodesCache(): void {
  invalidatePublicCatalogEpisodesLocalCache();
  void invalidateRedisPublicCatalogEpisodes().catch(() => {});
  void invalidateRedisPublicCatalogAnimeOptions().catch(() => {});
}

export async function invalidatePublicCatalogEpisodesCacheAsync(): Promise<void> {
  invalidatePublicCatalogEpisodesLocalCache();
  await Promise.allSettled([
    invalidateRedisPublicCatalogEpisodes(),
    invalidateRedisPublicCatalogAnimeOptions(),
  ]);
}

function setPublicCatalogEpisodesRamCache(
  cacheKey: string,
  data: PublicEpisodesResult,
): void {
  if (
    !publicCatalogEpisodesCache.has(cacheKey) &&
    publicCatalogEpisodesCache.size >= PUBLIC_CATALOG_EPISODES_MAX_RAM_ENTRIES
  ) {
    const oldestKey = publicCatalogEpisodesCache.keys().next().value;
    if (oldestKey !== undefined) {
      publicCatalogEpisodesCache.delete(oldestKey);
    }
  }
  publicCatalogEpisodesCache.set(cacheKey, {
    data,
    timestamp: Date.now(),
  });
}

async function queryPublicCatalogEpisodesFromDb(
  limit: number,
  offset: number,
): Promise<PublicEpisodesResult> {
  try {
    const sql = await getSql();
    const rows = await sql.query<PublicEpisodeRow>(
      `SELECT
         e."id",
         e."animeId",
         e."seasonNumber",
         e."number",
         e."title",
         e."thumbnail",
         e."duration",
         e."synopsis",
         e."videoUrl",
         e."videoUrl2",
         e."videoUrl3",
         e."videoUrl4",
         e."videoUrl5",
         e."hikari_player_episode_id" AS "hikariPlayerEpisodeId",
         e."opening_start_seconds" AS "openingStartSeconds",
         e."opening_end_seconds" AS "openingEndSeconds",
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
         a."createdAt" AS "animeCreatedAt",
         a."updatedAt" AS "animeUpdatedAt",
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
    console.warn("[Hikari] Falha segura ao consultar episódios públicos do PostgreSQL:", err);
    return {
      status: "error",
      episodes: [],
      total: 0,
      error: err?.message || String(err),
    };
  }
}

/**
 * Consulta server-side direta dos episódios publicados no PostgreSQL para exibição pública
 * na Home e na página /episodes.
 * 
 * Regras da Etapa 4 + Etapa 7:
 * 1. Recupera apenas episódios marcados com published = true.
 * 2. Exclui rascunhos.
 * 3. Une metadados de anime e temporada canônicos.
 * 4. Ordena temporalmente de forma decrescente (mais recentes primeiro).
 * 5. Não executa escritas, mutações ou exclusões no banco de dados (leitura pura).
 * 6. Em caso de falha de conexão, retorna status = "error" com erro detalhado.
 * 7. Utiliza cache em RAM (180s) + singleflight + cache compartilhado Redis (180s) com fence.
 */
export async function executeGetPublicCatalogEpisodes(options?: {
  limit?: number;
  offset?: number;
}): Promise<PublicEpisodesResult> {
  const rawLimit =
    typeof options?.limit === "number" &&
    Number.isFinite(options.limit) &&
    options.limit > 0
      ? Math.floor(options.limit)
      : 10000;
  const limit = rawLimit > 0 ? rawLimit : 10000;
  const offset =
    typeof options?.offset === "number" &&
    Number.isFinite(options.offset) &&
    options.offset >= 0
      ? Math.floor(options.offset)
      : 0;

  const cacheKey = limit === 10000 && offset === 0 ? "default" : `${limit}:${offset}`;

  // 1. Primeira camada: cache local em memória (180s)
  const now = Date.now();
  const cached = publicCatalogEpisodesCache.get(cacheKey);
  if (
    cached &&
    now - cached.timestamp < PUBLIC_CATALOG_EPISODES_CACHE_TTL_MS
  ) {
    return cached.data;
  }

  // Deduplicação singleflight por chave (limit/offset)
  const existingFlight = publicCatalogEpisodesInFlight.get(cacheKey);
  if (existingFlight) {
    return existingFlight;
  }

  const requestEpoch = publicCatalogEpisodesCacheEpoch;
  let flightRef: Promise<PublicEpisodesResult> | null = null;
  const currentFlight = (async (): Promise<PublicEpisodesResult> => {
    try {
      // 2. Segunda camada: Redis compartilhado com verificação de geração (fence)
      const redisRead = await getRedisPublicCatalogEpisodesWithFence(
        limit,
        offset,
      );
      if (redisRead.status === "hit" && redisRead.data) {
        if (requestEpoch === publicCatalogEpisodesCacheEpoch) {
          setPublicCatalogEpisodesRamCache(cacheKey, redisRead.data);
        }
        return redisRead.data;
      }

      // 3. Terceira camada: PostgreSQL em miss de RAM + Redis
      const fetchStartedAt = Date.now();
      const result = await queryPublicCatalogEpisodesFromDb(limit, offset);
      if (
        result.status !== "error" &&
        requestEpoch === publicCatalogEpisodesCacheEpoch
      ) {
        setPublicCatalogEpisodesRamCache(cacheKey, result);
        if (redisRead.fence) {
          scheduleRedisBackgroundWrite(
            setRedisPublicCatalogEpisodes(
              result,
              limit,
              offset,
              redisRead.fence,
              fetchStartedAt,
            ),
            "setRedisPublicCatalogEpisodes",
          );
        }
      }
      return result;
    } finally {
      if (publicCatalogEpisodesInFlight.get(cacheKey) === flightRef) {
        publicCatalogEpisodesInFlight.delete(cacheKey);
      }
    }
  })();

  flightRef = currentFlight;
  publicCatalogEpisodesInFlight.set(cacheKey, currentFlight);
  return currentFlight;
}

export const getPublicCatalogEpisodesSchema = z
  .object({
    limit: z.number().optional(),
    offset: z.number().optional(),
  })
  .optional();

/**
 * Server Function GET para consulta pública de episódios publicados no PostgreSQL
 * acessível tanto no SSR quanto via RPC no cliente.
 */
export const getPublicCatalogEpisodes = createServerFn({
  method: "GET",
})
  .validator((d?: { limit?: number; offset?: number }) => d ?? {})
  .handler(async ({ data }): Promise<PublicEpisodesResult> => {
    return executeGetPublicCatalogEpisodes(data);
  });

export const getPaginatedPublicCatalogEpisodes = createServerFn({
  method: "GET",
})
  .validator((d?: PaginatedPublicEpisodesInput) => d ?? {})
  .handler(async ({ data }): Promise<PaginatedPublicEpisodesResult> => {
    return executeGetPaginatedPublicCatalogEpisodes(data);
  });

export const getPublicCatalogAnimeOptionsFn = createServerFn({
  method: "GET",
})
  .handler(async (): Promise<PublicCatalogAnimeOption[]> => {
    return executeGetPublicCatalogAnimeOptions();
  });

export interface PaginatedPublicEpisodesInput {
  page?: number;
  pageSize?: number;
  animeId?: string | null;
  q?: string | null;
}

export interface PaginatedPublicEpisodesResult {
  status: PublicEpisodesFetchStatus;
  episodes: PublicEpisodeRow[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  error?: string;
}

export interface PublicCatalogAnimeOption {
  id: string;
  title: string;
}

const DEFAULT_PUBLIC_EPISODES_PAGE_SIZE = 24;
const MAX_PUBLIC_EPISODES_PAGE_SIZE = 100;
const PG_INT32_MAX = 2147483647;

/**
 * Lista espelhada de BLOCKED_STREAMING_HOSTS (`src/lib/published-episodes.ts`)
 * para pré-filtragem SQL de URLs externas não reproduzíveis (YouTube, Crunchyroll, etc.).
 * Qualquer alteração nos domínios bloqueados em `published-episodes.ts` deve ser mantida em sincronia.
 */
const BLOCKED_STREAMING_HOSTS_SQL_PATTERN =
  "(?:^|\\.)(crunchyroll\\.com|funimation\\.com|vrv\\.co|netflix\\.com|hidive\\.com|hulu\\.com|tubitv\\.com|bilibili\\.tv|iq\\.com|iqiyi\\.com|disneyplus\\.com|primevideo\\.com|amazon\\.com|viz\\.com|adultswim\\.com|retrocrush\\.tv|starplus\\.com|max\\.com|hbomax\\.com|dailymotion\\.com|anilist\\.co|myanimelist\\.net|kitsu\\.io|youtu\\.be|youtube\\.com|youtube-nocookie\\.com|vimeo\\.com)$";

const IPV4_OCTET_SQL = "(?:25[0-5]|2[0-4][0-9]|1?[0-9]{1,2})";
const IPV4_ADDR_SQL = `(?:${IPV4_OCTET_SQL}\\.){3}${IPV4_OCTET_SQL}`;
const IPV6_HOST_SQL_PATTERN =
  "\\[(?:" +
  "(?:[0-9a-f]{1,4}:){7}[0-9a-f]{1,4}|" +
  "(?:[0-9a-f]{1,4}:){1,7}:|" +
  "(?:[0-9a-f]{1,4}:){1,6}:[0-9a-f]{1,4}|" +
  "(?:[0-9a-f]{1,4}:){1,5}(?::[0-9a-f]{1,4}){1,2}|" +
  "(?:[0-9a-f]{1,4}:){1,4}(?::[0-9a-f]{1,4}){1,3}|" +
  "(?:[0-9a-f]{1,4}:){1,3}(?::[0-9a-f]{1,4}){1,4}|" +
  "(?:[0-9a-f]{1,4}:){1,2}(?::[0-9a-f]{1,4}){1,5}|" +
  "[0-9a-f]{1,4}:(?::[0-9a-f]{1,4}){1,6}|" +
  ":(?:(?::[0-9a-f]{1,4}){1,7}|:)|" +
  `(?:[0-9a-f]{1,4}:){6}${IPV4_ADDR_SQL}|` +
  `(?:[0-9a-f]{1,4}:){1,4}:${IPV4_ADDR_SQL}|` +
  `::(?:ffff(?::0{1,4})?:)?${IPV4_ADDR_SQL}` +
  ")\\]";
const URL_HOST_SQL_PATTERN = `(?:${IPV6_HOST_SQL_PATTERN}|${IPV4_ADDR_SQL}|[a-z0-9.-]+)`;

/**
 * Condição SQL equivalente à regra de `isHikariPlayableUrl` sobre os 5 slots de vídeo:
 * - Exige protocolo http/https, host válido (incluindo IPv6 RFC-válido), porta opcional <= 65535
 *   e ausência de domínios bloqueados.
 * - Verifica todos os 5 slots (`videoUrl` a `videoUrl5`) para não descartar episódios cujo link válido
 *   esteja em `videoUrl2`..`videoUrl5`.
 * - Limitação conhecida: casos extremos da especificação WHATWG `new URL()` (ex.: IPv4 com octetos > 255
 *   ou caracteres Unicode/punycode atípicos no host) não são reproduzíveis com 100% de fidelidade em
 *   regex SQL pura; por isso, a função paginada também valida as linhas retornadas via `isHikariPlayableUrl` em JS.
 */
const PLAYABLE_EPISODE_SQL_CONDITION = `(
  EXISTS (
    SELECT 1
    FROM unnest(ARRAY[e."videoUrl", e."videoUrl2", e."videoUrl3", e."videoUrl4", e."videoUrl5"]) AS u
    WHERE u IS NOT NULL
      AND BTRIM(u, E' \\t\\r\\n') <> ''
      AND BTRIM(u, E' \\t\\r\\n') <> '#'
      AND BTRIM(u, E' \\t\\r\\n') ~* '^https?://(?:[^/@#\\s]+@)?${URL_HOST_SQL_PATTERN}(?::[0-9]{1,5})?(?:[/?#].*)?$'
      AND (
        SUBSTRING(BTRIM(u, E' \\t\\r\\n') FROM '(?i)^https?://(?:[^/@#\\s]+@)?${URL_HOST_SQL_PATTERN}:([0-9]{1,5})(?:[/?#]|$)') IS NULL
        OR SUBSTRING(BTRIM(u, E' \\t\\r\\n') FROM '(?i)^https?://(?:[^/@#\\s]+@)?${URL_HOST_SQL_PATTERN}:([0-9]{1,5})(?:[/?#]|$)')::integer <= 65535
      )
      AND LOWER(SUBSTRING(BTRIM(u, E' \\t\\r\\n') FROM '(?i)^https?://(?:[^/@#\\s]+@)?(${URL_HOST_SQL_PATTERN})')) !~ '${BLOCKED_STREAMING_HOSTS_SQL_PATTERN}'
  )
  OR (
    e."hikari_player_episode_id" IS NOT NULL
    AND BTRIM(e."hikari_player_episode_id", E' \\t\\r\\n') <> ''
    AND CHAR_LENGTH(BTRIM(e."hikari_player_episode_id", E' \\t\\r\\n')) <= 128
    AND BTRIM(e."hikari_player_episode_id", E' \\t\\r\\n') ~ '^[A-Za-z0-9._-]+$'
    AND BTRIM(e."hikari_player_episode_id", E' \\t\\r\\n') NOT IN ('.', '..')
    AND BTRIM(e."hikari_player_episode_id", E' \\t\\r\\n') NOT LIKE '%..%'
    AND LOWER(BTRIM(e."hikari_player_episode_id", E' \\t\\r\\n')) !~ '(?:hikari-player|\\.(?:vercel\\.app|com|net|org|io|dev|app|tv|br|me|co|xyz)(?:$|[:/?#]))'
  )
)`;

export interface ParsedEpisodeSearchQuery {
  hasQuery: boolean;
  likePattern: string | null;
  exactEpisodeNumber: number | null;
}

export function parsePublicEpisodeSearchQuery(
  rawQuery?: string | null,
): ParsedEpisodeSearchQuery {
  const clean = typeof rawQuery === "string" ? rawQuery.trim() : "";
  if (!clean) {
    return {
      hasQuery: false,
      likePattern: null,
      exactEpisodeNumber: null,
    };
  }

  const escaped = clean.replace(/[\\%_]/g, "\\$&");
  const likePattern = `%${escaped}%`;

  const normalizedForNumber = clean
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  let exactEpisodeNumber: number | null = null;
  const numMatch = normalizedForNumber.match(
    /^(?:(?:episodio|ep)\.?\s*)?(\d+)$/i,
  );
  if (numMatch) {
    const parsedNum = Number(numMatch[1]);
    if (
      Number.isSafeInteger(parsedNum) &&
      parsedNum >= 0 &&
      parsedNum <= PG_INT32_MAX
    ) {
      exactEpisodeNumber = parsedNum;
    }
  }

  return {
    hasQuery: true,
    likePattern,
    exactEpisodeNumber,
  };
}

export function buildPaginatedPublicEpisodesWhereClause(filters?: {
  animeId?: string | null;
  q?: string | null;
}): {
  whereClause: string;
  params: unknown[];
} {
  const conditions: string[] = [
    `e."published" = true`,
    PLAYABLE_EPISODE_SQL_CONDITION,
    `(a."id" IS NULL OR a."archived_at" IS NULL)`,
  ];
  const params: unknown[] = [];

  const cleanAnimeId =
    typeof filters?.animeId === "string" ? filters.animeId.trim() : "";
  if (cleanAnimeId && cleanAnimeId.toLowerCase() !== "all") {
    params.push(cleanAnimeId);
    conditions.push(`e."animeId" = $${params.length}`);
  }

  const parsedSearch = parsePublicEpisodeSearchQuery(filters?.q);
  if (parsedSearch.hasQuery && parsedSearch.likePattern) {
    params.push(parsedSearch.likePattern);
    const likeParamRef = `$${params.length}`;

    const textConditions = [
      `COALESCE(a."title", '') ILIKE ${likeParamRef} ESCAPE '\\'`,
      `COALESCE(a."titleRomaji", '') ILIKE ${likeParamRef} ESCAPE '\\'`,
      `COALESCE(a."titleEnglish", '') ILIKE ${likeParamRef} ESCAPE '\\'`,
      `COALESCE(a."titleNative", '') ILIKE ${likeParamRef} ESCAPE '\\'`,
      `COALESCE(a."search_blob", '') ILIKE ${likeParamRef} ESCAPE '\\'`,
      `COALESCE(e."title", '') ILIKE ${likeParamRef} ESCAPE '\\'`,
    ];

    if (parsedSearch.exactEpisodeNumber !== null) {
      params.push(parsedSearch.exactEpisodeNumber);
      const numParamRef = `$${params.length}`;
      textConditions.push(`e."number" = ${numParamRef}`);
    }

    conditions.push(`(${textConditions.join(" OR ")})`);
  }

  return {
    whereClause: conditions.join(" AND "),
    params,
  };
}

function hasAnyPlayableSlot(row: {
  videoUrl?: string | null;
  videoUrl2?: string | null;
  videoUrl3?: string | null;
  videoUrl4?: string | null;
  videoUrl5?: string | null;
  hikariPlayerEpisodeId?: string | null;
}): boolean {
  return (
    [
      row.videoUrl,
      row.videoUrl2,
      row.videoUrl3,
      row.videoUrl4,
      row.videoUrl5,
    ].some((url) => isHikariPlayableUrl(url)) ||
    buildHikariPlayerEpisodeUrl(row.hikariPlayerEpisodeId) !== null
  );
}

/**
 * Consulta paginada server-side de episódios públicos no PostgreSQL para futura
 * integração com a rota `/episodes` (Etapa 8A).
 *
 * - Independente de `executeGetPublicCatalogEpisodes()` e sem conexão com Redis nesta etapa.
 * - Suporta `page`, `pageSize` (máximo 100), `animeId` e `q` (busca segura parametrizada).
 * - Preserva a ordenação determinística e a semântica de `isHikariPlayableUrl`.
 */
export async function executeGetPaginatedPublicCatalogEpisodes(
  options?: PaginatedPublicEpisodesInput,
): Promise<PaginatedPublicEpisodesResult> {
  const page =
    typeof options?.page === "number" &&
    Number.isFinite(options.page) &&
    options.page >= 1
      ? Math.floor(options.page)
      : 1;

  const rawPageSize =
    typeof options?.pageSize === "number" &&
    Number.isFinite(options.pageSize) &&
    options.pageSize >= 1
      ? Math.floor(options.pageSize)
      : DEFAULT_PUBLIC_EPISODES_PAGE_SIZE;
  const pageSize = Math.min(rawPageSize, MAX_PUBLIC_EPISODES_PAGE_SIZE);
  const offset = (page - 1) * pageSize;

  try {
    const sql = await getSql();

    const { whereClause, params } = buildPaginatedPublicEpisodesWhereClause({
      animeId: options?.animeId,
      q: options?.q,
    });

    const countSql = `
      SELECT COUNT(*)::integer AS "totalCount"
      FROM "catalog_episode" e
      LEFT JOIN "catalog_anime" a ON a."id" = e."animeId"
      WHERE ${whereClause};
    `;

    const limitParamIdx = params.length + 1;
    const offsetParamIdx = params.length + 2;
    const listSql = `
      SELECT
        e."id",
        e."animeId",
        e."seasonNumber",
        e."number",
        e."title",
        e."thumbnail",
        e."duration",
        e."synopsis",
        e."videoUrl",
        e."videoUrl2",
        e."videoUrl3",
        e."videoUrl4",
        e."videoUrl5",
        e."hikari_player_episode_id" AS "hikariPlayerEpisodeId",
        e."opening_start_seconds" AS "openingStartSeconds",
        e."opening_end_seconds" AS "openingEndSeconds",
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
        a."createdAt" AS "animeCreatedAt",
        a."updatedAt" AS "animeUpdatedAt",
        a."anilistId" AS "animeAnilistId",
        a."malId" AS "animeMalId",
        a."kitsuId" AS "animeKitsuId",
        s."title" AS "seasonTitle"
      FROM "catalog_episode" e
      LEFT JOIN "catalog_anime" a ON a."id" = e."animeId"
      LEFT JOIN "catalog_season" s ON s."animeId" = e."animeId" AND s."number" = e."seasonNumber"
      WHERE ${whereClause}
      ORDER BY e."publishedAt" DESC NULLS LAST, e."createdAt" DESC, e."seasonNumber" DESC, e."number" DESC, e."id" DESC
      LIMIT $${limitParamIdx} OFFSET $${offsetParamIdx};
    `;

    const [countRows, rawRows] = await Promise.all([
      sql.query<{ totalCount: number }>(countSql, params),
      sql.query<PublicEpisodeRow>(listSql, [...params, pageSize, offset]),
    ]);

    const totalCount = Math.max(0, Number(countRows?.[0]?.totalCount ?? 0));
    const totalPages = totalCount > 0 ? Math.ceil(totalCount / pageSize) : 0;

    // Verificação dupla em JS para garantir aderência absoluta a `isHikariPlayableUrl`
    // mesmo em casos de sintaxe de URL que escapem da regex SQL.
    const verifiedRows: PublicEpisodeRow[] = [];
    for (const row of Array.isArray(rawRows) ? rawRows : []) {
      if (hasAnyPlayableSlot(row)) {
        verifiedRows.push(row);
      }
    }

    // Se alguma linha da página foi rejeitada pelo parser WHATWG `new URL()` em JS,
    // completa os slots restantes da página a partir dos registros seguintes (máx. 2 rodadas).
    let nextLookaheadOffset = offset + (Array.isArray(rawRows) ? rawRows.length : 0);
    let lastBatchLength = Array.isArray(rawRows) ? rawRows.length : 0;
    let lookaheadAttempts = 0;
    while (
      verifiedRows.length < pageSize &&
      lastBatchLength === pageSize &&
      lookaheadAttempts < 2
    ) {
      lookaheadAttempts += 1;
      const missingCount = pageSize - verifiedRows.length;
      const extraRows = await sql.query<PublicEpisodeRow>(listSql, [
        ...params,
        missingCount,
        nextLookaheadOffset,
      ]);
      lastBatchLength = Array.isArray(extraRows) ? extraRows.length : 0;
      nextLookaheadOffset += lastBatchLength;
      if (lastBatchLength === 0) break;
      for (const row of extraRows) {
        if (hasAnyPlayableSlot(row)) {
          verifiedRows.push(row);
        }
      }
      if (lastBatchLength < missingCount) break;
    }

    const episodes = verifiedRows.map((row) => ({
      ...row,
      badgeLancamento: Boolean(row.badgeLancamento),
      badgeNovo: Boolean(row.badgeNovo),
      badgeFinal: Boolean(row.badgeFinal),
    }));

    return {
      status: episodes.length > 0 ? "success" : "empty",
      episodes,
      totalCount,
      page,
      pageSize,
      totalPages,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(
      "[Hikari] Falha segura ao consultar episódios públicos paginados no PostgreSQL:",
      err,
    );
    return {
      status: "error",
      episodes: [],
      totalCount: 0,
      page,
      pageSize,
      totalPages: 0,
      error: message,
    };
  }
}

const PUBLIC_CATALOG_ANIME_OPTIONS_CACHE_TTL_MS = 180 * 1000; // 180s
let cachedPublicCatalogAnimeOptions: {
  data: PublicCatalogAnimeOption[];
  timestamp: number;
} | null = null;
let publicCatalogAnimeOptionsInFlight: Promise<PublicCatalogAnimeOption[]> | null = null;
let publicCatalogAnimeOptionsCacheEpoch = 0;

/**
 * Consulta leve e independente para obter apenas os animes que possuem ao menos
 * um episódio publicado e reproduzível no catálogo público.
 * Evita carregar milhares de episódios apenas para popular o seletor de filtro.
 */
export async function executeGetPublicCatalogAnimeOptions(): Promise<
  PublicCatalogAnimeOption[]
> {
  const now = Date.now();
  if (
    cachedPublicCatalogAnimeOptions &&
    now - cachedPublicCatalogAnimeOptions.timestamp <
      PUBLIC_CATALOG_ANIME_OPTIONS_CACHE_TTL_MS
  ) {
    return cachedPublicCatalogAnimeOptions.data;
  }

  if (publicCatalogAnimeOptionsInFlight) {
    return publicCatalogAnimeOptionsInFlight;
  }

  const requestEpoch = publicCatalogAnimeOptionsCacheEpoch;
  let flightRef: Promise<PublicCatalogAnimeOption[]> | null = null;

  const currentFlight = (async (): Promise<PublicCatalogAnimeOption[]> => {
    try {
      const redisRead = await getRedisPublicCatalogAnimeOptionsWithFence();
      if (redisRead.status === "hit" && redisRead.data) {
        if (requestEpoch === publicCatalogAnimeOptionsCacheEpoch) {
          cachedPublicCatalogAnimeOptions = {
            data: redisRead.data,
            timestamp: Date.now(),
          };
        }
        return redisRead.data;
      }

      const fetchStartedAt = Date.now();
      const sql = await getSql();
      const rows = await sql.query<PublicCatalogAnimeOption>(
        `SELECT
           a."id",
           COALESCE(
             NULLIF(BTRIM(a."title"), ''),
             NULLIF(BTRIM(a."titleRomaji"), ''),
             NULLIF(BTRIM(a."titleEnglish"), ''),
             NULLIF(BTRIM(a."titleNative"), ''),
             'Anime'
           ) AS "title"
         FROM "catalog_anime" a
         WHERE a."archived_at" IS NULL
           AND EXISTS (
           SELECT 1
           FROM "catalog_episode" e
           WHERE e."animeId" = a."id"
             AND e."published" = true
             AND ${PLAYABLE_EPISODE_SQL_CONDITION}
         )
         ORDER BY LOWER(
           COALESCE(
             NULLIF(BTRIM(a."title"), ''),
             NULLIF(BTRIM(a."titleRomaji"), ''),
             NULLIF(BTRIM(a."titleEnglish"), ''),
             NULLIF(BTRIM(a."titleNative"), ''),
             'Anime'
           )
         ) ASC, a."id" ASC;`,
      );
      const validRows = Array.isArray(rows) ? rows : [];
      if (requestEpoch === publicCatalogAnimeOptionsCacheEpoch) {
        cachedPublicCatalogAnimeOptions = {
          data: validRows,
          timestamp: Date.now(),
        };
        if (redisRead.fence) {
          scheduleRedisBackgroundWrite(
            setRedisPublicCatalogAnimeOptions(
              validRows,
              redisRead.fence,
              fetchStartedAt,
            ),
            "setRedisPublicCatalogAnimeOptions",
          );
        }
      }
      return validRows;
    } catch (err) {
      console.warn(
        "[Hikari] Falha segura ao consultar opções de animes públicos:",
        err,
      );
      return [];
    } finally {
      if (publicCatalogAnimeOptionsInFlight === flightRef) {
        publicCatalogAnimeOptionsInFlight = null;
      }
    }
  })();

  flightRef = currentFlight;
  publicCatalogAnimeOptionsInFlight = currentFlight;
  return currentFlight;
}

/**
 * Constrói temporadas resolvidas a partir dos dados remotos e do fallback local.
 */
/**
 * Constrói temporadas resolvidas a partir dos dados remotos do PostgreSQL e do catálogo local.
 *
 * Implementação segura da Etapa 3 (HIKARI):
 * 1. Não descarta episódios locais apenas porque uma temporada possui outros episódios no servidor (Resolve Problema A).
 * 2. Reconhece slots por (animeId, seasonNumber, episodeNumber).
 * 3. Preserva episódios locais ausentes no PostgreSQL (ex: novos episódios criados offline ou em rascunho).
 * 4. Preserva episódios locais em estado "pending" ou "conflict".
 * 5. Utiliza dados canônicos do PostgreSQL para episódios confirmados no servidor quando não houver pendências locais.
 * 6. Evita duplicação quando o mesmo registro aparecer em ambas as fontes.
 * 7. Não oculta episódios confirmados no PostgreSQL por tombstones legados/antigos, a não ser que haja
 *    uma operação de exclusão ativa e intencional no Outbox (Resolve Problema B).
 * 8. Aplica isolamento estrito de tombstones por anime (um tombstone do anime X nunca oculta do anime Y).
 * 9. Idempotente e determinístico: múltiplas execuções com as mesmas entradas produzem idêntico resultado.
 */
export function buildResolvedSeasons(
  animeId: string,
  remoteData: CatalogEpisodesResult,
  safeLocalSeasons: Season[],
  options?: { outbox?: OutboxOperation[]; tombstones?: TombstoneRecord[] },
): Season[] {
  const cleanId = animeId?.trim() || "";

  // 1. Ler operações do Outbox para este anime (respeita estado pending/conflict/delete)
  const animeOutbox =
    options?.outbox !== undefined
      ? options.outbox.filter((o) => o.animeId === cleanId)
      : typeof window !== "undefined"
        ? readOutbox().filter((o) => o.animeId === cleanId)
        : [];

  // 2. Ler registros estruturados de tombstones
  const allTombstones =
    options?.tombstones !== undefined
      ? options.tombstones
      : typeof window !== "undefined"
        ? readTombstoneRecords()
        : [];

  // Filtra tombstones aplicáveis a este anime (isolamento estrito: ignora tombstones de outro anime ou sem anime)
  const applicableTombstones = allTombstones.filter(
    (t) => t.animeId === cleanId,
  );

  // Regra de Tombstone para Episódios Confirmados no PostgreSQL:
  // Um episódio confirmado no servidor só é ocultado se houver uma exclusão ATIVA na Outbox local.
  // Tombstones antigos ou órfãos sem exclusão ativa no Outbox NÃO ocultam registros do banco.
  const isRemoteEpisodeDeleted = (rep: CatalogEpisodeItem): boolean => {
    return animeOutbox.some(
      (op) =>
        op.type === "delete" &&
        (op.episodeId === rep.id ||
          (op.seasonNumber === (rep.seasonNumber || 1) &&
            op.episodeNumber === rep.number)),
    );
  };

  // Regra de Tombstone para Episódios Exclusivamente Locais:
  const isLocalEpisodeDeleted = (lep: Episode, sNum: number): boolean => {
    // Se o usuário adicionou um novo upsert local, não filtra (republicação/recriação)
    const hasActiveUpsert = animeOutbox.some(
      (op) =>
        op.type === "upsert" &&
        (op.episodeId === lep.id ||
          (op.seasonNumber === sNum && op.episodeNumber === lep.number)),
    );
    if (hasActiveUpsert) return false;

    // Se houver exclusão pendente na Outbox
    const hasActiveDelete = animeOutbox.some(
      (op) =>
        op.type === "delete" &&
        (op.episodeId === lep.id ||
          (op.seasonNumber === sNum && op.episodeNumber === lep.number)),
    );
    if (hasActiveDelete) return true;

    // Se houver tombstone correspondente a este anime
    return isEpisodeTombstoned(applicableTombstones, cleanId, lep.id, sNum, lep.number);
  };

  const safeLocal = Array.isArray(safeLocalSeasons)
    ? safeLocalSeasons.map((s) => ({
        ...s,
        episodes: Array.isArray(s.episodes) ? [...s.episodes] : [],
      }))
    : [];

  const remoteEpisodes = Array.isArray(remoteData?.episodes)
    ? remoteData.episodes
    : [];
  const remoteSeasons = Array.isArray(remoteData?.seasons)
    ? remoteData.seasons
    : [];

  // Mapear metadados remotos de temporadas por número
  const seasonMetaMap = new Map<number, CatalogSeasonItem>();
  for (const s of remoteSeasons) {
    seasonMetaMap.set(s.number, s);
  }

  // Mapear temporadas locais por número
  const localSeasonByNumber = new Map<number, Season>();
  for (const ls of safeLocal) {
    localSeasonByNumber.set(ls.number, ls);
  }

  // Agrupar episódios remotos por temporada (aplicando verificação de exclusão ativa)
  const remoteEpsBySeason = new Map<number, CatalogEpisodeItem[]>();
  for (const ep of remoteEpisodes) {
    if (isRemoteEpisodeDeleted(ep)) continue;
    const sNum = ep.seasonNumber || 1;
    const list = remoteEpsBySeason.get(sNum) ?? [];
    list.push(ep);
    remoteEpsBySeason.set(sNum, list);
  }

  // Identificar todas as temporadas existentes (locais + remotas)
  const allSeasonNumbers = new Set<number>();
  for (const ls of safeLocal) {
    allSeasonNumbers.add(ls.number);
  }
  for (const s of remoteSeasons) {
    allSeasonNumbers.add(s.number);
  }
  for (const ep of remoteEpisodes) {
    allSeasonNumbers.add(ep.seasonNumber || 1);
  }

  if (allSeasonNumbers.size === 0) {
    return safeLocal;
  }

  const resolvedSeasons: Season[] = [];

  for (const sNum of Array.from(allSeasonNumbers)) {
    const localSeason = localSeasonByNumber.get(sNum);
    const remoteEpsForSeason = remoteEpsBySeason.get(sNum) ?? [];
    const seasonMeta = seasonMetaMap.get(sNum);

    // Episódios locais filtrando tombstones válidos deste anime
    const localEps = (localSeason?.episodes ?? []).filter(
      (lep) => !isLocalEpisodeDeleted(lep, sNum),
    );

    // Mapas de busca remota por número e por ID
    const remoteByNumber = new Map<number, CatalogEpisodeItem>();
    const remoteById = new Map<string, CatalogEpisodeItem>();
    for (const rep of remoteEpsForSeason) {
      remoteByNumber.set(rep.number, rep);
      remoteById.set(rep.id, rep);
    }

    // Mapas de busca local por número e por ID
    const localByNumber = new Map<number, Episode>();
    const localById = new Map<string, Episode>();
    for (const lep of localEps) {
      localByNumber.set(lep.number, lep);
      localById.set(lep.id, lep);
    }

    // Identificar todos os números de episódios nesta temporada (remotos + locais)
    const allEpisodeNumbers = new Set<number>();
    for (const rep of remoteEpsForSeason) {
      allEpisodeNumbers.add(rep.number);
    }
    for (const lep of localEps) {
      allEpisodeNumbers.add(lep.number);
    }

    const sortedEpNumbers = Array.from(allEpisodeNumbers).sort((a, b) => a - b);
    const resolvedEpisodes: Episode[] = [];

    for (const epNum of sortedEpNumbers) {
      const rep = remoteByNumber.get(epNum);
      const lep = localByNumber.get(epNum);

      if (rep && lep) {
        // Colisão de slot: o episódio existe tanto local quanto remotamente
        const op = animeOutbox.find(
          (o) =>
            o.episodeId === lep.id ||
            (o.seasonNumber === sNum && o.episodeNumber === epNum),
        );

        if (op?.status === "conflict") {
          // Preserva a versão local com status de conflito para resolução
          resolvedEpisodes.push(lep);
        } else if (op?.status === "pending" || (op && op.type === "upsert")) {
          // Preserva a versão local pendente (trabalho não salvo pelo usuário)
          resolvedEpisodes.push(lep);
        } else {
          // Confirmado / sincronizado: utiliza dados canônicos do PostgreSQL com fallback seguro
          const repHasCanonicalSources = hasEpisodePlayableSource(rep);
          resolvedEpisodes.push({
            id: rep.id,
            number: rep.number,
            title: rep.title?.trim() || lep.title?.trim() || `Episódio ${rep.number}`,
            thumbnail: rep.thumbnail?.trim() || lep.thumbnail?.trim() || undefined,
            duration: rep.duration?.trim() || lep.duration?.trim() || undefined,
            synopsis: rep.synopsis?.trim() || lep.synopsis?.trim() || undefined,
            videoUrl: repHasCanonicalSources
              ? rep.videoUrl?.trim() || undefined
              : rep.videoUrl?.trim() || sanitizePlayableVideoUrl(lep.videoUrl) || undefined,
            videoUrl2: repHasCanonicalSources
              ? rep.videoUrl2?.trim() || undefined
              : rep.videoUrl2?.trim() || sanitizePlayableVideoUrl(lep.videoUrl2) || undefined,
            videoUrl3: repHasCanonicalSources
              ? rep.videoUrl3?.trim() || undefined
              : rep.videoUrl3?.trim() || sanitizePlayableVideoUrl(lep.videoUrl3) || undefined,
            videoUrl4: repHasCanonicalSources
              ? rep.videoUrl4?.trim() || undefined
              : rep.videoUrl4?.trim() || sanitizePlayableVideoUrl(lep.videoUrl4) || undefined,
            videoUrl5: repHasCanonicalSources
              ? rep.videoUrl5?.trim() || undefined
              : rep.videoUrl5?.trim() || sanitizePlayableVideoUrl(lep.videoUrl5) || undefined,
            hikariPlayerEpisodeId:
              normalizeHikariPlayerEpisodeId(rep.hikariPlayerEpisodeId) ?? undefined,
            openingStartSeconds:
              typeof rep.openingStartSeconds === "number" ? rep.openingStartSeconds : null,
            openingEndSeconds:
              typeof rep.openingEndSeconds === "number" ? rep.openingEndSeconds : null,
            aired:
              lep.aired ||
              (rep.publishedAt ? new Date(rep.publishedAt).toLocaleDateString("pt-BR") : undefined),
            published: rep.published ?? lep.published ?? false,
            recentBadges: normalizeAnimeRecentBadges({
              lancamento: rep.badgeLancamento,
              novo: rep.badgeNovo,
              final: rep.badgeFinal,
            }),
          });
        }
      } else if (rep && !lep) {
        // Existe apenas no PostgreSQL (reconstruído a partir do servidor)
        const localByIdMatch = localById.get(rep.id);
        resolvedEpisodes.push({
          id: rep.id,
          number: rep.number,
          title: rep.title?.trim() || localByIdMatch?.title?.trim() || `Episódio ${rep.number}`,
          thumbnail: rep.thumbnail?.trim() || localByIdMatch?.thumbnail?.trim() || undefined,
          duration: rep.duration?.trim() || localByIdMatch?.duration?.trim() || undefined,
          synopsis: rep.synopsis?.trim() || localByIdMatch?.synopsis?.trim() || undefined,
          videoUrl: rep.videoUrl?.trim() || localByIdMatch?.videoUrl?.trim() || undefined,
          videoUrl2: rep.videoUrl2?.trim() || localByIdMatch?.videoUrl2?.trim() || undefined,
          videoUrl3: rep.videoUrl3?.trim() || localByIdMatch?.videoUrl3?.trim() || undefined,
          videoUrl4: rep.videoUrl4?.trim() || localByIdMatch?.videoUrl4?.trim() || undefined,
          videoUrl5: rep.videoUrl5?.trim() || localByIdMatch?.videoUrl5?.trim() || undefined,
          hikariPlayerEpisodeId:
            normalizeHikariPlayerEpisodeId(rep.hikariPlayerEpisodeId) ?? undefined,
          openingStartSeconds:
            typeof rep.openingStartSeconds === "number" ? rep.openingStartSeconds : null,
          openingEndSeconds:
            typeof rep.openingEndSeconds === "number" ? rep.openingEndSeconds : null,
          aired:
            localByIdMatch?.aired ||
            (rep.publishedAt ? new Date(rep.publishedAt).toLocaleDateString("pt-BR") : undefined),
          published: rep.published ?? false,
          recentBadges: normalizeAnimeRecentBadges({
            lancamento: rep.badgeLancamento,
            novo: rep.badgeNovo,
            final: rep.badgeFinal,
          }),
        });
      } else if (!rep && lep) {
        // Se este ID já foi mapeado por um episódio remoto em outro slot da mesma temporada
        // e não há alteração pendente/conflito no outbox, não duplica
        if (remoteById.has(lep.id)) {
          const op = animeOutbox.find(
            (o) =>
              o.episodeId === lep.id ||
              (o.seasonNumber === sNum && o.episodeNumber === epNum),
          );
          if (!op) {
            continue;
          }
        }
        // Existe apenas localmente (PRESERVADO — resolve o Problema A!)
        resolvedEpisodes.push(lep);
      }
    }

    // Ordenar episódios numericamente
    resolvedEpisodes.sort((a, b) => a.number - b.number);

    const seasonTitle =
      (localSeason?.title && localSeason.title !== `Temporada ${sNum}`
        ? localSeason.title
        : seasonMeta?.title?.trim()) ||
      localSeason?.title?.trim() ||
      `Temporada ${sNum}`;

    const seasonId = localSeason?.id || `s-${cleanId}-${sNum}`;

    resolvedSeasons.push({
      id: seasonId,
      number: sNum,
      title: seasonTitle,
      episodes: resolvedEpisodes,
    });
  }

  // Ordenar temporadas pela posição (se cadastrada) ou pelo número
  resolvedSeasons.sort((a, b) => {
    const posA = seasonMetaMap.get(a.number)?.position ?? a.number;
    const posB = seasonMetaMap.get(b.number)?.position ?? b.number;
    if (posA !== posB) return posA - posB;
    return a.number - b.number;
  });

  return resolvedSeasons;
}

/**
 * Obtém sincronamente temporadas resolvidas se já estiverem em cache (staleTime 2min).
 */
export function getCachedResolvedSeasons(
  animeId: string,
  localSeasons?: Season[],
): Season[] | null {
  if (!animeId) return null;
  const entry = clientCatalogEpisodesCache.get(animeId);
  if (!entry) return null;

  const isFresh = Date.now() - entry.timestamp < STALE_TIME_MS;
  if (!isFresh) return null;

  const safeLocalSeasons = Array.isArray(localSeasons)
    ? localSeasons.map((s) => ({
        ...s,
        episodes: Array.isArray(s.episodes) ? [...s.episodes] : [],
      }))
    : [];

  return buildResolvedSeasons(animeId, entry.data, safeLocalSeasons);
}

/**
 * Resolve temporadas e episódios combinando a fonte canônica do PostgreSQL com o fallback local.
 *
 * Comportamento:
 * 1. Consulta episódios publicados no banco (com cache in-memory de 2 minutos).
 * 2. Se a consulta falhar, devolve as temporadas locais sem alterações destrutivas.
 * 3. Se não houver registros publicados no banco, preserva as temporadas locais.
 * 4. Se houver registros publicados, usa o banco como fonte canônica para os episódios retornados.
 * 5. Aproveita metadados locais como fallback quando campos remotos estiverem vazios.
 * 6. Não inventa episódios.
 * 7. Não modifica os dados originais do IndexedDB.
 * 8. Preserva a ordem correta dos episódios e temporadas.
 */
export async function resolveEpisodes(
  animeId: string,
  localSeasons?: Season[],
): Promise<Season[]> {
  const tombstones =
    typeof window !== "undefined" ? new Set(readTombstones()) : new Set<string>();

  const safeLocalSeasons = Array.isArray(localSeasons)
    ? localSeasons.map((s) => ({
        ...s,
        episodes: Array.isArray(s.episodes)
          ? s.episodes.filter((ep) => !tombstones.has(ep.id))
          : [],
      }))
    : [];

  if (!animeId || typeof animeId !== "string" || !animeId.trim()) {
    return safeLocalSeasons;
  }

  const cleanId = animeId.trim();

  try {
    // 1. Verifica cache local válido (staleTime 2 minutos)
    const cachedEntry = clientCatalogEpisodesCache.get(cleanId);
    if (cachedEntry && Date.now() - cachedEntry.timestamp < STALE_TIME_MS) {
      return buildResolvedSeasons(cleanId, cachedEntry.data, safeLocalSeasons);
    }

    // 2. Consulta remota ou deduplica com requisição em voo
    let fetchPromise = clientInFlightPromises.get(cleanId);
    if (!fetchPromise) {
      if (typeof window === "undefined") {
        fetchPromise = executeGetCatalogEpisodes(cleanId);
      } else {
        fetchPromise = getCatalogEpisodes({ data: { animeId: cleanId } });
      }
      clientInFlightPromises.set(cleanId, fetchPromise);
    }

    const remoteData = await fetchPromise;
    clientInFlightPromises.delete(cleanId);

    // Atualiza cache em memória
    clientCatalogEpisodesCache.set(cleanId, {
      timestamp: Date.now(),
      data: remoteData,
    });

    return buildResolvedSeasons(cleanId, remoteData, safeLocalSeasons);
  } catch (err) {
    clientInFlightPromises.delete(cleanId);
    console.warn("[Hikari] Erro ao resolver episódios, usando fallback local:", err);
    return safeLocalSeasons;
  }
}

/**
 * Converte um item de episódio canônico do PostgreSQL para a interface Episode do Hikari.
 * Preserva estritamente todos os campos: ID canônico, número, título, sinopse, thumbnail,
 * duração, estado de publicação (inclusive rascunho sem vídeo) e as 5 fontes de reprodução.
 */
export function catalogItemToEpisode(item: CatalogEpisodeItem): Episode {
  return {
    id: item.id,
    number: item.number,
    title: item.title?.trim() || `Episódio ${item.number}`,
    thumbnail: item.thumbnail?.trim() || undefined,
    duration: item.duration?.trim() || undefined,
    synopsis: item.synopsis?.trim() || undefined,
    videoUrl: item.videoUrl?.trim() || undefined,
    videoUrl2: item.videoUrl2?.trim() || undefined,
    videoUrl3: item.videoUrl3?.trim() || undefined,
    videoUrl4: item.videoUrl4?.trim() || undefined,
    videoUrl5: item.videoUrl5?.trim() || undefined,
    hikariPlayerEpisodeId:
      normalizeHikariPlayerEpisodeId(item.hikariPlayerEpisodeId) ?? undefined,
    openingStartSeconds:
      typeof item.openingStartSeconds === "number" ? item.openingStartSeconds : null,
    openingEndSeconds:
      typeof item.openingEndSeconds === "number" ? item.openingEndSeconds : null,
    published: item.published ?? false,
    recentBadges: normalizeAnimeRecentBadges({
      lancamento: item.badgeLancamento,
      novo: item.badgeNovo,
      final: item.badgeFinal,
    }),
    aired: item.publishedAt
      ? new Date(item.publishedAt).toLocaleDateString("pt-BR")
      : undefined,
  };
}

export interface MergeAdminEpisodesInput {
  animeId: string;
  localSeasons?: Season[] | null;
  serverResult: CatalogEpisodesResult;
  outboxOps?: OutboxOperation[];
}

export interface MergeAdminEpisodesResult {
  seasons: Season[];
  totalServerEpisodes: number;
  recoveredCount: number;
  preservedPendingCount: number;
  preservedConflictCount: number;
  localOnlyCount: number;
}

/**
 * Mescla de forma segura e não destrutiva as temporadas e episódios recuperados do PostgreSQL
 * com o estado do painel administrativo.
 *
 * Regras da Etapa 2:
 * 1. O PostgreSQL é a fonte canônica para os episódios confirmados no servidor.
 * 2. Preserva episódios com estado "pending" ou "conflict" no Outbox.
 * 3. Não descarta episódios locais apenas porque ainda não existem no PostgreSQL.
 * 4. Não trata episódios ausentes na resposta do servidor como exclusões.
 * 5. Em colisão de slot (mesma temporada e número):
 *    - Se o local estiver confirmado ("synced"), atualiza com os dados do PostgreSQL.
 *    - Se o local estiver com alterações "pending", preserva a versão local pendente para que o administrador não perca trabalho.
 *    - Se o local estiver em "conflict", preserva os dados locais e o aviso de conflito para resolução explícita.
 * 6. Preserva todos os campos canônicos: ID, número, temporada, título, sinopse, thumbnail, duração,
 *    estado de publicação, data e todas as 5 fontes de reprodução (videoUrl a videoUrl5).
 * 7. Reconstrói temporadas a partir de catalog_season e catalog_episode quando o IndexedDB estiver vazio.
 * 8. Não executa mutações, exclusões ou chamadas de gravação na base de dados (opera puramente em memória).
 */
export function mergeAdminEpisodesWithServer(
  input: MergeAdminEpisodesInput,
): MergeAdminEpisodesResult {
  const { animeId, localSeasons, serverResult, outboxOps = [] } = input;

  const animeOutbox = outboxOps.filter((o) => o.animeId === animeId);
  const serverEpisodes = serverResult?.episodes || [];
  const serverSeasonsMeta = serverResult?.seasons || [];

  let recoveredCount = 0;
  let preservedPendingCount = 0;
  let preservedConflictCount = 0;
  let localOnlyCount = 0;

  const safeLocalSeasons = Array.isArray(localSeasons)
    ? localSeasons.map((s) => ({
        ...s,
        episodes: Array.isArray(s.episodes) ? [...s.episodes] : [],
      }))
    : [];

  // Mapear metadados de temporadas remotas por número
  const serverSeasonMetaMap = new Map<number, CatalogSeasonItem>();
  for (const s of serverSeasonsMeta) {
    serverSeasonMetaMap.set(s.number, s);
  }

  // Identificar todas as temporadas relevantes (locais + remotas)
  const seasonNumbersSet = new Set<number>();
  for (const s of safeLocalSeasons) {
    seasonNumbersSet.add(s.number);
  }
  for (const ep of serverEpisodes) {
    seasonNumbersSet.add(ep.seasonNumber || 1);
  }
  for (const sm of serverSeasonsMeta) {
    seasonNumbersSet.add(sm.number);
  }

  // Se nenhuma temporada existir, fornece pelo menos a Temporada 1
  if (seasonNumbersSet.size === 0) {
    seasonNumbersSet.add(1);
  }

  const mergedSeasons: Season[] = [];

  for (const sNum of Array.from(seasonNumbersSet)) {
    const localSeason = safeLocalSeasons.find((s) => s.number === sNum);
    const serverEpsForSeason = serverEpisodes.filter(
      (e) => (e.seasonNumber || 1) === sNum,
    );
    const seasonMeta = serverSeasonMetaMap.get(sNum);

    const localEpisodes = localSeason?.episodes || [];

    // Mapas para busca rápida por número e por ID
    const serverByNumber = new Map<number, CatalogEpisodeItem>();
    for (const sep of serverEpsForSeason) {
      serverByNumber.set(sep.number, sep);
    }

    const allNumbers = new Set<number>();
    for (const lep of localEpisodes) {
      allNumbers.add(lep.number);
    }
    for (const sep of serverEpsForSeason) {
      allNumbers.add(sep.number);
    }

    const sortedNumbers = Array.from(allNumbers).sort((a, b) => a - b);
    const mergedEpisodes: Episode[] = [];

    for (const epNum of sortedNumbers) {
      const lep = localEpisodes.find((e) => e.number === epNum);
      const sep = serverByNumber.get(epNum);

      if (lep && sep) {
        // Colisão de slot: existe tanto local quanto no PostgreSQL
        const outboxOp = animeOutbox.find(
          (o) =>
            o.episodeId === lep.id ||
            (o.seasonNumber === sNum && o.episodeNumber === epNum),
        );

        if (outboxOp?.status === "conflict") {
          // Mantém versão local com erro de conflito
          mergedEpisodes.push(lep);
          preservedConflictCount++;
        } else if (outboxOp?.status === "pending" || outboxOp) {
          // Mantém versão local com alteração pendente
          mergedEpisodes.push(lep);
          preservedPendingCount++;
        } else {
          // Confirmado / sincronizado: atualiza com os dados canônicos do PostgreSQL preservando thumbnail local se servidor estiver vazio
          const serverEp = catalogItemToEpisode(sep);
          mergedEpisodes.push({
            ...serverEp,
            thumbnail: serverEp.thumbnail || lep.thumbnail?.trim() || undefined,
          });
          recoveredCount++;
        }
      } else if (lep && !sep) {
        // Episódio existe apenas localmente (ex: rascunho offline ou pendente de criação)
        const outboxOp = animeOutbox.find(
          (o) =>
            o.episodeId === lep.id ||
            (o.seasonNumber === sNum && o.episodeNumber === epNum),
        );
        if (outboxOp?.status === "conflict") {
          preservedConflictCount++;
        } else if (outboxOp?.status === "pending" || outboxOp) {
          preservedPendingCount++;
        } else {
          localOnlyCount++;
        }
        mergedEpisodes.push(lep);
      } else if (!lep && sep) {
        // Episódio existe no PostgreSQL mas não existia no local (ex: outro dispositivo / IndexedDB vazio)
        mergedEpisodes.push(catalogItemToEpisode(sep));
        recoveredCount++;
      }
    }

    // Ordenar episódios numericamente
    mergedEpisodes.sort((a, b) => a.number - b.number);

    // Determinar título da temporada respeitando metadados salvos
    const seasonTitle =
      (localSeason?.title && localSeason.title !== `Temporada ${sNum}`
        ? localSeason.title
        : seasonMeta?.title?.trim()) ||
      localSeason?.title?.trim() ||
      `Temporada ${sNum}`;

    const seasonId = localSeason?.id || `s-${animeId}-${sNum}`;

    mergedSeasons.push({
      id: seasonId,
      number: sNum,
      title: seasonTitle,
      episodes: mergedEpisodes,
    });
  }

  // Ordenar temporadas por position (se cadastrada) ou por number
  mergedSeasons.sort((a, b) => {
    const posA = serverSeasonMetaMap.get(a.number)?.position ?? a.number;
    const posB = serverSeasonMetaMap.get(b.number)?.position ?? b.number;
    if (posA !== posB) return posA - posB;
    return a.number - b.number;
  });

  return {
    seasons: mergedSeasons,
    totalServerEpisodes: serverEpisodes.length,
    recoveredCount,
    preservedPendingCount,
    preservedConflictCount,
    localOnlyCount,
  };
}
