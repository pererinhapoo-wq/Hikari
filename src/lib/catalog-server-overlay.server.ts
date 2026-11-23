import { getSql } from "@/lib/db";
import {
  getRedisCatalogIndex,
  setRedisCatalogIndex,
  invalidateRedisCatalogIndex,
  getRedisCatalogSearch,
  setRedisCatalogSearchWithGen,
  captureSearchGen,
  invalidateRedisCatalogSearch,
  normalizeCatalogSearchQuery,
  scheduleRedisBackgroundWrite,
} from "@/lib/redis";
import {
  isCustomImageUrl,
  normalizeAnimeRecentBadges,
  type Anime,
  type HomeCatalog,
  type Season,
  type SlimAnime,
} from "@/lib/types";
import { stripCatalogImageVersion } from "@/lib/image-utils";
import {
  countDistinctTitlesWithEpisode,
  selectHomeSectionItems,
  sortByHasEpisodeFirst,
} from "@/lib/anime-search-ranking";

export interface DbCatalogAnimeRow {
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
  trailerId: string | null;
  hidden: boolean;
  score: number | null;
  updatedAt: string | Date | null;
  hasEpisode?: boolean;
}

export function toTimestampMs(val: unknown): number {
  if (typeof val === "number" && Number.isFinite(val)) {
    return val;
  }
  if (val instanceof Date) {
    const ms = val.getTime();
    return Number.isFinite(ms) ? ms : 0;
  }
  if (typeof val === "string" && val.trim()) {
    const ms = Date.parse(val);
    return Number.isFinite(ms) ? ms : 0;
  }
  return 0;
}

function isDubbedCatalogRow(row: {
  title?: string | null;
  titleRomaji?: string | null;
  titleEnglish?: string | null;
  titleNative?: string | null;
}): boolean {
  return /\b(dub|dublado|dublada)\b/i.test(
    `${row.title ?? ""} ${row.titleRomaji ?? ""} ${row.titleEnglish ?? ""} ${row.titleNative ?? ""}`,
  );
}

export interface CatalogIndex {
  byId: Map<string, DbCatalogAnimeRow>;
  byAnilistId: Map<number, DbCatalogAnimeRow>;
  byMalId: Map<number, DbCatalogAnimeRow>;
  byKitsuId: Map<number, DbCatalogAnimeRow>;
}

let cachedCatalogIndex: { data: CatalogIndex; timestamp: number } | null = null;
let catalogIndexInFlightPromise: Promise<CatalogIndex | null> | null = null;
let catalogIndexCacheEpoch = 0;
const CATALOG_INDEX_TTL_MS = 3 * 60 * 1000; // 3 minutos

function buildCatalogIndexFromRows(rows: DbCatalogAnimeRow[]): CatalogIndex {
  const byId = new Map<string, DbCatalogAnimeRow>();
  const byAnilistId = new Map<number, DbCatalogAnimeRow>();
  const byMalId = new Map<number, DbCatalogAnimeRow>();
  const byKitsuId = new Map<number, DbCatalogAnimeRow>();

  for (const row of rows) {
    if (row.hidden) {
      continue;
    }
    if (!byId.has(row.id)) {
      byId.set(row.id, row);
    }

    if (isDubbedCatalogRow(row)) {
      continue;
    }

    if (typeof row.anilistId === "number" && row.anilistId > 0 && !byAnilistId.has(row.anilistId)) {
      byAnilistId.set(row.anilistId, row);
    }
    if (typeof row.malId === "number" && row.malId > 0 && !byMalId.has(row.malId)) {
      byMalId.set(row.malId, row);
    }
    if (typeof row.kitsuId === "number" && row.kitsuId > 0 && !byKitsuId.has(row.kitsuId)) {
      byKitsuId.set(row.kitsuId, row);
    }
  }

  return { byId, byAnilistId, byMalId, byKitsuId };
}

export function invalidateCatalogIndex(): void {
  catalogIndexCacheEpoch += 1;
  cachedCatalogIndex = null;
  catalogIndexInFlightPromise = null;
  void invalidateRedisCatalogIndex().catch(() => {});
  invalidateLocalCatalogSearchCache();
}

export async function loadCatalogIndex(): Promise<CatalogIndex | null> {
  const now = Date.now();
  if (cachedCatalogIndex && now - cachedCatalogIndex.timestamp < CATALOG_INDEX_TTL_MS) {
    return cachedCatalogIndex.data;
  }

  if (catalogIndexInFlightPromise) {
    return catalogIndexInFlightPromise;
  }

  const requestEpoch = catalogIndexCacheEpoch;
  let flightRef: Promise<CatalogIndex | null> | null = null;

  const currentFlight = (async (): Promise<CatalogIndex | null> => {
    try {
      // 1. Tentar consultar no Upstash Redis (cache compartilhado)
      const redisRows = await getRedisCatalogIndex();
      if (
        Array.isArray(redisRows) &&
        redisRows.length > 0 &&
        redisRows.every((r) => typeof r.hasEpisode === "boolean")
      ) {
        const index = buildCatalogIndexFromRows(redisRows);
        if (requestEpoch === catalogIndexCacheEpoch) {
          cachedCatalogIndex = { data: index, timestamp: Date.now() };
        }
        return index;
      }

      // 2. Se miss no Redis, consultar o PostgreSQL
      const sql = await getSql();
      const rows = await sql.query<DbCatalogAnimeRow>(
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
           a."trailerId",
           a."hidden",
           a."score",
           a."updatedAt",
           EXISTS (
             SELECT 1
             FROM "catalog_episode" e
             WHERE e."animeId" = a."id"
               AND e."published" = true
           ) AS "hasEpisode"
         FROM "catalog_anime" a
         ORDER BY a."updatedAt" DESC;`,
      );

      if (!rows || rows.length === 0) {
        return null;
      }

      // Salvar de forma assíncrona no Redis (sem bloquear a resposta)
      scheduleRedisBackgroundWrite(
        setRedisCatalogIndex(rows),
        "setRedisCatalogIndex",
      );

      const index = buildCatalogIndexFromRows(rows);
      if (requestEpoch === catalogIndexCacheEpoch) {
        cachedCatalogIndex = { data: index, timestamp: Date.now() };
      }
      return index;
    } catch (err) {
      console.warn("[catalog-server-overlay] Falha ao consultar catalog_anime:", err);
      return cachedCatalogIndex?.data ?? null;
    } finally {
      if (catalogIndexInFlightPromise === flightRef) {
        catalogIndexInFlightPromise = null;
      }
    }
  })();

  flightRef = currentFlight;
  catalogIndexInFlightPromise = currentFlight;
  return currentFlight;
}

function findMatchingRow(
  index: CatalogIndex,
  item: Pick<SlimAnime, "id" | "anilistId" | "malId" | "kitsuId">,
  requestedId?: string,
): DbCatalogAnimeRow | undefined {
  if (requestedId) {
    const byReq = index.byId.get(requestedId);
    if (byReq) return byReq;
  }

  const direct = index.byId.get(item.id);
  if (direct) return direct;

  if (typeof item.anilistId === "number" && item.anilistId > 0) {
    const byAni = index.byAnilistId.get(item.anilistId);
    if (byAni) return byAni;
  }

  if (/^\d+$/.test(item.id)) {
    const numId = Number(item.id);
    if (numId > 0) {
      const byNumAni = index.byAnilistId.get(numId);
      if (byNumAni) return byNumAni;
    }
  }

  if (typeof item.malId === "number" && item.malId > 0) {
    const byMal = index.byMalId.get(item.malId);
    if (byMal) return byMal;
  }

  if (item.id.startsWith("mal-")) {
    const malNum = Number(item.id.slice(4));
    if (Number.isFinite(malNum) && malNum > 0) {
      const byMal = index.byMalId.get(malNum);
      if (byMal) return byMal;
    }
  }

  if (typeof item.kitsuId === "number" && item.kitsuId > 0) {
    const byKitsu = index.byKitsuId.get(item.kitsuId);
    if (byKitsu) return byKitsu;
  }

  if (item.id.startsWith("kitsu-")) {
    const kitsuNum = Number(item.id.slice(6));
    if (Number.isFinite(kitsuNum) && kitsuNum > 0) {
      const byKitsu = index.byKitsuId.get(kitsuNum);
      if (byKitsu) return byKitsu;
    }
  }

  return undefined;
}

export async function resolveCatalogDetailAliasesForId(
  requestedId: string,
): Promise<string[]> {
  const cleanId = requestedId?.trim();
  if (!cleanId) return [];

  const aliases = new Set<string>([cleanId]);

  try {
    const index = await loadCatalogIndex();
    if (!index) {
      return Array.from(aliases);
    }

    const match = findMatchingRow(index, { id: cleanId }, cleanId);
    if (!match) {
      return Array.from(aliases);
    }

    if (match.id?.trim()) {
      aliases.add(match.id.trim());
    }
    if (typeof match.anilistId === "number" && match.anilistId > 0) {
      aliases.add(String(match.anilistId));
    }
    if (typeof match.malId === "number" && match.malId > 0) {
      aliases.add(`mal-${match.malId}`);
    }
    if (typeof match.kitsuId === "number" && match.kitsuId > 0) {
      aliases.add(`kitsu-${match.kitsuId}`);
    }
  } catch {
    // Fail-open: retorna ao menos o próprio ID solicitado
  }

  return Array.from(aliases);
}

function mergeRowIntoSlim(item: SlimAnime, row: DbCatalogAnimeRow): SlimAnime {
  const cleanCover = stripCatalogImageVersion(row.cover);
  const cleanBanner = stripCatalogImageVersion(row.banner);
  const updatedAtMs = toTimestampMs(row.updatedAt);
  const isStubTitle =
    !row.title ||
    row.title.trim() === row.id ||
    (typeof row.anilistId === "number" && row.title.trim() === String(row.anilistId));

  const nextRomaji =
    row.titleRomaji?.trim() ||
    (!isStubTitle ? row.title.trim() : "") ||
    item.titles.romaji;
  const nextEnglish = row.titleEnglish?.trim() || item.titles.english;
  const nextNative = row.titleNative?.trim() || item.titles.native;

  const hasGenres = Array.isArray(row.genres) && row.genres.length > 0;

  return {
    ...item,
    cover: cleanCover || item.cover,
    banner: cleanBanner || item.banner,
    titles: {
      romaji: nextRomaji,
      english: nextEnglish,
      native: nextNative,
    },
    synopsis: row.synopsis?.trim() || item.synopsis,
    genres: hasGenres ? (row.genres as string[]) : item.genres,
    format: row.format?.trim() || item.format,
    status: row.status?.trim() || item.status,
    episodesCount: row.episodesCount ?? item.episodesCount,
    season: row.season?.trim() || item.season,
    year: row.year ?? item.year,
    trailerId: row.trailerId?.trim() || item.trailerId,
    score: row.score ?? item.score,
    catalogUpdatedAt: updatedAtMs || item.catalogUpdatedAt,
    serverCatalogId: row.id,
    hasEpisode: Boolean(row.hasEpisode),
  };
}

export async function applyDbCatalogOverlayToSlimList(
  items: SlimAnime[],
): Promise<SlimAnime[]> {
  if (!Array.isArray(items) || items.length === 0) {
    return items;
  }
  const index = await loadCatalogIndex();
  if (!index) {
    return items.map((item) =>
      item.hasEpisode === false ? item : { ...item, hasEpisode: false },
    );
  }

  let changed = false;
  const next = items.map((item) => {
    const match = findMatchingRow(index, item);
    if (!match) {
      if (item.hasEpisode === false) {
        return item;
      }
      changed = true;
      return { ...item, hasEpisode: false };
    }
    changed = true;
    return mergeRowIntoSlim(item, match);
  });

  return changed ? next : items;
}

export async function applyDbCatalogOverlayToHome(
  catalog: HomeCatalog,
): Promise<HomeCatalog> {
  const index = await loadCatalogIndex();

  const enrichList = (list: SlimAnime[]): SlimAnime[] =>
    list.map((item) => {
      const match = index ? findMatchingRow(index, item) : undefined;
      return match
        ? mergeRowIntoSlim(item, match)
        : { ...item, hasEpisode: false };
    });

  const todaySchedule = enrichList(catalog.todaySchedule);
  const trending = enrichList(catalog.trending);
  const popular = enrichList(catalog.popular);
  const top = enrichList(catalog.top);
  const season = enrichList(catalog.season);
  const releases = enrichList(catalog.releases);

  const primaryEmAlta =
    trending.some((item) => item.hasEpisode === true) ||
    !popular.some((item) => item.hasEpisode === true)
      ? trending
      : popular;

  const homeWithEpisodeCount = countDistinctTitlesWithEpisode([
    todaySchedule,
    primaryEmAlta,
    season,
  ]);

  return {
    ...catalog,
    todaySchedule: sortByHasEpisodeFirst(todaySchedule),
    trending: selectHomeSectionItems(trending, homeWithEpisodeCount),
    popular: selectHomeSectionItems(popular, homeWithEpisodeCount),
    top: selectHomeSectionItems(top, homeWithEpisodeCount),
    season: selectHomeSectionItems(season, homeWithEpisodeCount),
    releases: selectHomeSectionItems(releases, homeWithEpisodeCount),
  };
}

export async function buildLocalAnimeFromDb(animeId: string): Promise<Anime | null> {
  try {
    const sql = await getSql();
    const rows = await sql.query<DbCatalogAnimeRow>(
      `SELECT
         "id", "title", "anilistId", "malId", "kitsuId",
         "titleRomaji", "titleEnglish", "titleNative",
         "cover", "banner", "synopsis", "format", "status",
         "episodesCount", "year", "season", "genres", "trailerId",
         "hidden", "score",
         "updatedAt"
       FROM "catalog_anime"
       WHERE "id" = $1
       LIMIT 1;`,
      [animeId],
    );

    const row = rows[0];
    if (!row) return null;

    const seasonRows = await sql.query<{
      number: number;
      title: string | null;
      position: number;
    }>(
      `SELECT "number", "title", "position"
       FROM "catalog_season"
       WHERE "animeId" = $1
       ORDER BY "position" ASC, "number" ASC;`,
      [row.id],
    );

    const episodeRows = await sql.query<{
      id: string;
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
      published: boolean;
      publishedAt: string | null;
      badgeLancamento: boolean;
      badgeNovo: boolean;
      badgeFinal: boolean;
    }>(
      `SELECT
         "id", "seasonNumber", "number", "title", "thumbnail",
         "duration", "synopsis", "videoUrl", "videoUrl2",
         "videoUrl3", "videoUrl4", "videoUrl5", "published", "publishedAt",
         COALESCE("badge_lancamento", false) AS "badgeLancamento",
         COALESCE("badge_novo", false) AS "badgeNovo",
         COALESCE("badge_final", false) AS "badgeFinal"
       FROM "catalog_episode"
       WHERE "animeId" = $1 AND "published" = true
       ORDER BY "seasonNumber" ASC, "number" ASC;`,
      [row.id],
    );

    const seasonMap = new Map<number, Season>();
    for (const s of seasonRows) {
      seasonMap.set(s.number, {
        id: `s-${row.id}-${s.number}`,
        number: s.number,
        title: s.title?.trim() || `Temporada ${s.number}`,
        episodes: [],
      });
    }

    for (const ep of episodeRows) {
      let targetSeason = seasonMap.get(ep.seasonNumber);
      if (!targetSeason) {
        targetSeason = {
          id: `s-${row.id}-${ep.seasonNumber}`,
          number: ep.seasonNumber,
          title: `Temporada ${ep.seasonNumber}`,
          episodes: [],
        };
        seasonMap.set(ep.seasonNumber, targetSeason);
      }
      targetSeason.episodes.push({
        id: ep.id,
        number: ep.number,
        title: ep.title?.trim() || `Episódio ${ep.number}`,
        thumbnail: ep.thumbnail || undefined,
        duration: ep.duration || undefined,
        synopsis: ep.synopsis || undefined,
        videoUrl: ep.videoUrl || undefined,
        videoUrl2: ep.videoUrl2 || undefined,
        videoUrl3: ep.videoUrl3 || undefined,
        videoUrl4: ep.videoUrl4 || undefined,
        videoUrl5: ep.videoUrl5 || undefined,
        published: ep.published,
        recentBadges: normalizeAnimeRecentBadges({
          lancamento: ep.badgeLancamento,
          novo: ep.badgeNovo,
          final: ep.badgeFinal,
        }),
        aired: ep.publishedAt
          ? new Date(ep.publishedAt).toLocaleDateString("pt-BR")
          : undefined,
      });
    }

    const seasons = Array.from(seasonMap.values()).sort((a, b) => a.number - b.number);
    const updatedAtMs = toTimestampMs(row.updatedAt);

    return {
      id: row.id,
      anilistId: row.anilistId ?? undefined,
      malId: row.malId ?? undefined,
      kitsuId: row.kitsuId ?? undefined,
      titles: {
        romaji: row.titleRomaji?.trim() || row.title?.trim() || "",
        english: row.titleEnglish?.trim() || "",
        native: row.titleNative?.trim() || "",
      },
      cover: stripCatalogImageVersion(row.cover),
      banner: stripCatalogImageVersion(row.banner),
      synopsis: row.synopsis?.trim() || "",
      score: row.score ?? null,
      genres: Array.isArray(row.genres) ? row.genres : [],
      format: row.format?.trim() || "TV",
      status: row.status?.trim() || "FINISHED",
      episodesCount: row.episodesCount ?? null,
      season: row.season?.trim() || null,
      year: row.year ?? null,
      trailerId: row.trailerId?.trim() || null,
      source: "local",
      studios: [],
      streamingEpisodes: [],
      seasons: seasons.length > 0 ? seasons : [{ id: `s-${row.id}-1`, number: 1, title: "Temporada 1", episodes: [] }],
      recommendations: [],
      characters: [],
      staff: [],
      catalogUpdatedAt: updatedAtMs || undefined,
      serverCatalogId: row.id,
      hasEpisode: episodeRows.length > 0,
    };
  } catch (err) {
    console.warn("[catalog-server-overlay] Falha ao montar anime local do banco:", err);
    return null;
  }
}

export async function applyDbCatalogOverlayToDetail(
  detail: Anime | null,
  requestedId: string,
): Promise<Anime | null> {
  if (!detail) {
    return buildLocalAnimeFromDb(requestedId);
  }

  const index = await loadCatalogIndex();
  const match = index ? findMatchingRow(index, detail, requestedId) : undefined;

  const mappedRecommendations = Array.isArray(detail.recommendations)
    ? sortByHasEpisodeFirst(
        detail.recommendations.map((rec) => {
          const recMatch = index ? findMatchingRow(index, rec) : undefined;
          return recMatch
            ? mergeRowIntoSlim(rec, recMatch)
            : { ...rec, hasEpisode: false };
        }),
      )
    : [];

  if (!match) {
    return {
      ...detail,
      hasEpisode: false,
      recommendations: mappedRecommendations,
    };
  }

  const mergedSlim = mergeRowIntoSlim(detail, match);
  const cleanDbBanner = stripCatalogImageVersion(match.banner);
  const bannerWasCustomized = Boolean(
    cleanDbBanner && isCustomImageUrl(cleanDbBanner, detail.banner),
  );

  return {
    ...detail,
    ...mergedSlim,
    recommendations: mappedRecommendations,
    resolvedMobileBanner: bannerWasCustomized
      ? {
          url: cleanDbBanner,
          isAlternative: false,
          source: "admin",
          initialObjectPosition: "50% 24%",
        }
      : detail.resolvedMobileBanner,
  };
}

interface LocalSearchCacheEntry {
  data: SlimAnime[];
  timestamp: number;
}
const LOCAL_SEARCH_CACHE_TTL_MS = 60 * 1000; // 60 segundos
const MAX_LOCAL_SEARCH_ENTRIES = 200;

const localSearchCache = new Map<string, LocalSearchCacheEntry>();
const localSearchInFlightPromises = new Map<string, Promise<SlimAnime[]>>();
let localSearchCacheEpoch = 0;

function pruneLocalSearchCache(): void {
  if (localSearchCache.size > MAX_LOCAL_SEARCH_ENTRIES) {
    const firstKey = localSearchCache.keys().next().value;
    if (firstKey !== undefined) {
      localSearchCache.delete(firstKey);
    }
  }
}

export function invalidateLocalCatalogSearchCache(query?: string): void {
  localSearchCacheEpoch += 1;
  if (query) {
    const clean = normalizeCatalogSearchQuery(query);
    for (const key of localSearchCache.keys()) {
      if (key.startsWith(`${clean}:`)) {
        localSearchCache.delete(key);
      }
    }
  } else {
    localSearchCache.clear();
  }
  localSearchInFlightPromises.clear();
  void invalidateRedisCatalogSearch(query).catch(() => {});
}

export async function searchLocalCatalogAnime(
  query: string,
  limit = 12,
): Promise<SlimAnime[]> {
  const clean = normalizeCatalogSearchQuery(query);
  if (!clean || clean.length < 2) return [];

  const safeLimit = Math.min(Math.max(1, Math.floor(limit) || 12), 50);
  const cacheKey = `${clean}:${safeLimit}`;
  const now = Date.now();

  // 1. Consulta primeiro a memória local (cache hit)
  const localEntry = localSearchCache.get(cacheKey);
  if (localEntry && now - localEntry.timestamp < LOCAL_SEARCH_CACHE_TTL_MS) {
    return localEntry.data;
  }

  // 2. Proteção contra chamadas simultâneas duplicadas (singleflight)
  const inFlight = localSearchInFlightPromises.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  const requestEpoch = localSearchCacheEpoch;
  let flightPromiseRef: Promise<SlimAnime[]> | null = null;

  const flightPromise = (async (): Promise<SlimAnime[]> => {
    try {
      // 3. Consulta no Upstash Redis (cache compartilhado)
      const redisResult = await getRedisCatalogSearch(clean, safeLimit);
      if (
        Array.isArray(redisResult) &&
        redisResult.every((r) => typeof r.hasEpisode === "boolean")
      ) {
        if (requestEpoch === localSearchCacheEpoch) {
          localSearchCache.set(cacheKey, { data: redisResult, timestamp: Date.now() });
          pruneLocalSearchCache();
        }
        return redisResult;
      }

      // Capturar geração compartilhada no Redis ANTES da consulta ao banco
      const observedGen = await captureSearchGen();

      // 4. Consulta no PostgreSQL
      const sql = await getSql();
      const escaped = clean.replace(/[\\%_]/g, "\\$&");
      const pattern = `%${escaped}%`;

      const rows = await sql.query<DbCatalogAnimeRow>(
        `SELECT DISTINCT
           c.*,
           EXISTS (
             SELECT 1
             FROM "catalog_episode" e
             WHERE e."animeId" = c."id"
               AND e."published" = true
           ) AS "hasEpisode"
         FROM "catalog_anime" c
         LEFT JOIN "anime_alias" a ON a."anime_id" = c."id"
         WHERE c."hidden" = false
           AND (
             c."search_blob" ILIKE $1 ESCAPE '\\'
             OR c."title_norm" ILIKE $1 ESCAPE '\\'
             OR a."alias_norm" ILIKE $1 ESCAPE '\\'
           )
         ORDER BY "hasEpisode" DESC, c."updatedAt" DESC
         LIMIT $2;`,
        [pattern, safeLimit],
      );

      const results: SlimAnime[] =
        !rows || rows.length === 0
          ? []
          : rows.map((row) => ({
              id: row.id,
              anilistId: row.anilistId ?? undefined,
              malId: row.malId ?? undefined,
              kitsuId: row.kitsuId ?? undefined,
              titles: {
                romaji: row.titleRomaji?.trim() || row.title?.trim() || "",
                english: row.titleEnglish?.trim() || "",
                native: row.titleNative?.trim() || "",
              },
              cover: stripCatalogImageVersion(row.cover),
              banner: stripCatalogImageVersion(row.banner),
              synopsis: row.synopsis?.trim() || "",
              format: row.format?.trim() || "TV",
              status: row.status?.trim() || "FINISHED",
              episodesCount: row.episodesCount ?? null,
              season: row.season?.trim() || null,
              year: row.year ?? null,
              genres: Array.isArray(row.genres) ? row.genres : [],
              score: row.score ?? null,
              trailerId: row.trailerId?.trim() || null,
              catalogUpdatedAt: toTimestampMs(row.updatedAt),
              serverCatalogId: row.id,
              hasEpisode: Boolean(row.hasEpisode),
              source: "local" as const,
            }));

      // 5. Salva no Redis (validado por geração) e na memória local (inclui [] como negative cache)
      if (requestEpoch === localSearchCacheEpoch) {
        scheduleRedisBackgroundWrite(
          setRedisCatalogSearchWithGen(clean, safeLimit, results, observedGen),
          "setRedisCatalogSearchWithGen",
        );
        localSearchCache.set(cacheKey, { data: results, timestamp: Date.now() });
        pruneLocalSearchCache();
      }

      return results;
    } catch (err) {
      console.warn("[catalog-server-overlay] Erro na busca local otimizada de catalog_anime:", err);
      return localSearchCache.get(cacheKey)?.data ?? [];
    } finally {
      if (localSearchInFlightPromises.get(cacheKey) === flightPromiseRef) {
        localSearchInFlightPromises.delete(cacheKey);
      }
    }
  })();

  flightPromiseRef = flightPromise;
  localSearchInFlightPromises.set(cacheKey, flightPromise);
  return flightPromise;
}

