import { getSql } from "@/lib/db";
import { isCustomImageUrl, type Anime, type HomeCatalog, type Season, type SlimAnime } from "@/lib/types";
import { stripCatalogImageVersion } from "@/lib/image-utils";

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

interface CatalogIndex {
  byId: Map<string, DbCatalogAnimeRow>;
  byAnilistId: Map<number, DbCatalogAnimeRow>;
  byMalId: Map<number, DbCatalogAnimeRow>;
  byKitsuId: Map<number, DbCatalogAnimeRow>;
}

async function loadCatalogIndex(): Promise<CatalogIndex | null> {
  try {
    const sql = await getSql();
    const rows = await sql.query<DbCatalogAnimeRow>(
      `SELECT
         "id",
         "title",
         "anilistId",
         "malId",
         "kitsuId",
         "titleRomaji",
         "titleEnglish",
         "titleNative",
         "cover",
         "banner",
         "synopsis",
         "format",
         "status",
         "episodesCount",
         "year",
         "season",
         "genres",
         "trailerId",
         "hidden",
         "score",
         "updatedAt"
       FROM "catalog_anime"
       ORDER BY "updatedAt" DESC;`,
    );

    if (!rows || rows.length === 0) {
      return null;
    }

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
  } catch (err) {
    console.warn("[catalog-server-overlay] Falha ao consultar catalog_anime:", err);
    return null;
  }
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
    return items;
  }

  let changed = false;
  const next = items.map((item) => {
    const match = findMatchingRow(index, item);
    if (!match) return item;
    changed = true;
    return mergeRowIntoSlim(item, match);
  });

  return changed ? next : items;
}

export async function applyDbCatalogOverlayToHome(
  catalog: HomeCatalog,
): Promise<HomeCatalog> {
  const index = await loadCatalogIndex();
  if (!index) {
    return catalog;
  }

  const mapList = (list: SlimAnime[]): SlimAnime[] =>
    list.map((item) => {
      const match = findMatchingRow(index, item);
      return match ? mergeRowIntoSlim(item, match) : item;
    });

  return {
    ...catalog,
    todaySchedule: mapList(catalog.todaySchedule),
    trending: mapList(catalog.trending),
    popular: mapList(catalog.popular),
    top: mapList(catalog.top),
    season: mapList(catalog.season),
    releases: mapList(catalog.releases),
  };
}

async function buildLocalAnimeFromDb(animeId: string): Promise<Anime | null> {
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
    }>(
      `SELECT
         "id", "seasonNumber", "number", "title", "thumbnail",
         "duration", "synopsis", "videoUrl", "videoUrl2",
         "videoUrl3", "videoUrl4", "videoUrl5", "published", "publishedAt"
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
  if (!index) {
    return detail;
  }

  const match = findMatchingRow(index, detail, requestedId);
  if (!match) {
    return detail;
  }

  const mergedSlim = mergeRowIntoSlim(detail, match);
  const cleanDbBanner = stripCatalogImageVersion(match.banner);
  const bannerWasCustomized = Boolean(
    cleanDbBanner && isCustomImageUrl(cleanDbBanner, detail.banner),
  );

  return {
    ...detail,
    ...mergedSlim,
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
