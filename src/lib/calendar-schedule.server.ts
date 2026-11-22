import { getSql, type Sql } from "@/lib/db";
import { sortByHasEpisodeFirst } from "@/lib/anime-search-ranking";
import {
  CALENDAR_TIMEZONE,
  getDayKeySaoPaulo,
  getSaoPauloNoonTimestamp,
  getTodayRangeSaoPaulo,
  getWeekDaysFromRangeSaoPaulo,
  getWeekdayLabelSaoPaulo,
  getWeekdaySaoPaulo,
} from "@/lib/calendar-timezone";
import {
  type CalendarRedisInvalidationClient,
  getRedisCalendarSchedule,
  getRedisCalendarToday,
  invalidateRedisCalendar,
  setRedisCalendarSchedule,
  setRedisCalendarToday,
} from "@/lib/redis";
import type { SlimAnime } from "@/lib/types";

export interface DbTodayScheduleRow {
  anilistId: number;
  animeId: string;
  episode: number;
  airingAtEpoch: number | string;
  malId: number | null;
  kitsuId: number | null;
  title: string;
  titleRomaji: string | null;
  titleEnglish: string | null;
  titleNative: string | null;
  cover: string | null;
  banner: string | null;
  synopsis: string | null;
  score: number | null;
  genres: string[] | null;
  format: string | null;
  status: string | null;
  episodesCount: number | null;
  season: string | null;
  year: number | null;
  trailerId: string | null;
  updatedAt: string | Date | null;
  hasEpisode: boolean;
}

export interface DbWeeklyScheduleRow {
  scheduleId: string;
  anilistId: number;
  animeId: string;
  episode: number;
  airingAtEpoch: number | string;
  timeUntilAiring: number | null;
  title: string;
  titleRomaji: string | null;
  titleEnglish: string | null;
  titleNative: string | null;
  cover: string | null;
  banner: string | null;
  format: string | null;
  status: string | null;
  genres: string[] | null;
}

export interface DbWeeklyRecurrenceJoinedRow {
  recurrenceId: string;
  animeId: string;
  dayOfWeek: number;
  timezone: string;
  active: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
  anilistId: number | null;
  malId: number | null;
  kitsuId: number | null;
  title: string;
  titleRomaji: string | null;
  titleEnglish: string | null;
  titleNative: string | null;
  cover: string | null;
  banner: string | null;
  synopsis: string | null;
  score: number | null;
  genres: string[] | null;
  format: string | null;
  status: string | null;
  episodesCount: number | null;
  season: string | null;
  year: number | null;
  trailerId: string | null;
  animeUpdatedAt: string | Date | null;
  hasEpisode: boolean;
}

export interface WeeklyScheduleMedia {
  id: number;
  animeId?: string | null;
  idMal?: number | null;
  isAdult?: boolean;
  format?: string | null;
  title: {
    romaji?: string | null;
    english?: string | null;
    native?: string | null;
  };
  coverImage?: {
    extraLarge?: string | null;
    large?: string | null;
    medium?: string | null;
    color?: string | null;
  } | null;
  bannerImage?: string | null;
  genres?: string[] | null;
  status?: string | null;
}

export interface WeeklyScheduleItem {
  id: number;
  airingAt: number;
  timeUntilAiring?: number;
  episode: number;
  isRecurring?: boolean;
  recurrenceId?: string;
  media: WeeklyScheduleMedia;
}

export interface CalendarRecurrenceRecord {
  id: string;
  animeId: string;
  dayOfWeek: number;
  timezone: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  anime: {
    id: string;
    anilistId: number | null;
    title: string;
    titleRomaji: string | null;
    titleEnglish: string | null;
    cover: string | null;
    format: string | null;
    status: string | null;
  };
}

export interface CatalogAnimeOptionForRecurrence {
  id: string;
  anilistId: number | null;
  title: string;
  titleRomaji: string | null;
  titleEnglish: string | null;
  cover: string | null;
  format: string | null;
  status: string | null;
  year: number | null;
}

export class CalendarRecurrenceError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "CalendarRecurrenceError";
    this.status = status;
  }
}

const LOCAL_TODAY_CACHE_TTL_MS = 60 * 1000;
const localTodayCache = new Map<string, { at: number; data: SlimAnime[] }>();
let localTodayCacheEpoch = 0;

export function invalidateLocalTodayScheduleCache(): void {
  localTodayCacheEpoch += 1;
  localTodayCache.clear();
}

function toEpochSeconds(val: unknown): number {
  if (typeof val === "number" && Number.isFinite(val)) {
    return val > 1e11 ? Math.floor(val / 1000) : Math.floor(val);
  }
  if (val instanceof Date) {
    return Math.floor(val.getTime() / 1000);
  }
  if (typeof val === "string" && val.trim()) {
    const asNum = Number(val);
    if (Number.isFinite(asNum) && asNum > 0) {
      return asNum > 1e11 ? Math.floor(asNum / 1000) : Math.floor(asNum);
    }
    const parsed = Date.parse(val);
    if (Number.isFinite(parsed)) {
      return Math.floor(parsed / 1000);
    }
  }
  return 0;
}

function toTimestampMs(val: unknown): number | undefined {
  if (typeof val === "number" && Number.isFinite(val)) return val;
  if (val instanceof Date) {
    const ms = val.getTime();
    return Number.isFinite(ms) ? ms : undefined;
  }
  if (typeof val === "string" && val.trim()) {
    const ms = Date.parse(val);
    return Number.isFinite(ms) ? ms : undefined;
  }
  return undefined;
}

function toIsoString(val: unknown): string {
  if (val instanceof Date) return val.toISOString();
  if (typeof val === "string" && val.trim()) return val;
  return new Date().toISOString();
}

function computeRecurringItemNumericId(recurrenceId: string, dateKey: string): number {
  const seed = `${recurrenceId}::${dateKey}`;
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const unsigned = (hash >>> 0) % 2_000_000_000;
  return -(unsigned + 1);
}

export function mapTodayScheduleRowsToSlimAnime(
  rows: DbTodayScheduleRow[],
  todayKey: string,
  recurringRows: DbWeeklyRecurrenceJoinedRow[] = [],
): SlimAnime[] {
  const grouped = new Map<
    string,
    {
      row: DbTodayScheduleRow;
      episodes: Array<{ number: number; airingAt: number }>;
    }
  >();

  const specificAnimeIds = new Set<string>();
  const specificAnilistIds = new Set<number>();

  for (const row of rows) {
    const airingAt = toEpochSeconds(row.airingAtEpoch);
    if (airingAt <= 0 || typeof row.episode !== "number" || row.episode <= 0) {
      continue;
    }
    if (getDayKeySaoPaulo(airingAt) !== todayKey) {
      continue;
    }

    const groupKey = row.animeId || (row.anilistId ? String(row.anilistId) : `anilist-${row.anilistId}`);
    if (row.animeId) specificAnimeIds.add(row.animeId);
    if (typeof row.anilistId === "number" && row.anilistId > 0) {
      specificAnilistIds.add(row.anilistId);
    }

    const existing = grouped.get(groupKey);
    if (existing) {
      if (
        !existing.episodes.some(
          (ep) => ep.number === row.episode && ep.airingAt === airingAt,
        )
      ) {
        existing.episodes.push({ number: row.episode, airingAt });
      }
      if (row.hasEpisode && !existing.row.hasEpisode) {
        existing.row = { ...existing.row, hasEpisode: true };
      }
    } else {
      grouped.set(groupKey, {
        row,
        episodes: [{ number: row.episode, airingAt }],
      });
    }
  }

  const items: SlimAnime[] = [];

  for (const { row, episodes } of grouped.values()) {
    episodes.sort((a, b) => a.airingAt - b.airingAt || a.number - b.number);
    const firstEp = episodes[0];
    if (!firstEp) continue;

    items.push({
      id: row.animeId || (row.anilistId ? String(row.anilistId) : `anilist-${row.anilistId}`),
      serverCatalogId: row.animeId,
      anilistId: row.anilistId,
      malId: row.malId ?? undefined,
      kitsuId: row.kitsuId ?? undefined,
      titles: {
        romaji: row.titleRomaji || row.title || "",
        english: row.titleEnglish || row.title || "",
        native: row.titleNative || "",
      },
      cover: row.cover || "",
      banner: row.banner || "",
      synopsis: row.synopsis || "",
      score: row.score ?? null,
      genres: Array.isArray(row.genres) ? row.genres : [],
      format: row.format || "TV",
      status: row.status || "RELEASING",
      episodesCount: row.episodesCount ?? null,
      season: row.season ?? null,
      year: row.year ?? null,
      trailerId: row.trailerId ?? null,
      todayEpisode: firstEp,
      todayUpcomingEpisodes: episodes,
      source: "local",
      catalogUpdatedAt: toTimestampMs(row.updatedAt),
      hasEpisode: Boolean(row.hasEpisode),
    });
  }

  const todayWeekday = getWeekdaySaoPaulo(todayKey);
  const recurrenceNoonSec = getSaoPauloNoonTimestamp(todayKey);
  const seenRecurringAnimeIds = new Set<string>();

  for (const rec of recurringRows) {
    if (!rec.active || Number(rec.dayOfWeek) !== todayWeekday) {
      continue;
    }
    if (
      specificAnimeIds.has(rec.animeId) ||
      (typeof rec.anilistId === "number" &&
        rec.anilistId > 0 &&
        specificAnilistIds.has(rec.anilistId)) ||
      seenRecurringAnimeIds.has(rec.animeId)
    ) {
      continue;
    }
    seenRecurringAnimeIds.add(rec.animeId);

    const anchorEpisode = { number: 0, airingAt: recurrenceNoonSec };
    items.push({
      id: rec.animeId,
      serverCatalogId: rec.animeId,
      anilistId: rec.anilistId ?? undefined,
      malId: rec.malId ?? undefined,
      kitsuId: rec.kitsuId ?? undefined,
      titles: {
        romaji: rec.titleRomaji || rec.title || "",
        english: rec.titleEnglish || rec.title || "",
        native: rec.titleNative || "",
      },
      cover: rec.cover || "",
      banner: rec.banner || "",
      synopsis: rec.synopsis || "",
      score: rec.score ?? null,
      genres: Array.isArray(rec.genres) ? rec.genres : [],
      format: rec.format || "TV",
      status: rec.status || "RELEASING",
      episodesCount: rec.episodesCount ?? null,
      season: rec.season ?? null,
      year: rec.year ?? null,
      trailerId: rec.trailerId ?? null,
      todayEpisode: anchorEpisode,
      todayUpcomingEpisodes: [anchorEpisode],
      source: "local",
      catalogUpdatedAt: toTimestampMs(rec.animeUpdatedAt),
      hasEpisode: Boolean(rec.hasEpisode),
    });
  }

  items.sort(
    (a, b) =>
      (a.todayEpisode?.airingAt ?? Number.MAX_SAFE_INTEGER) -
      (b.todayEpisode?.airingAt ?? Number.MAX_SAFE_INTEGER),
  );

  return sortByHasEpisodeFirst(items);
}

export function mapWeeklyScheduleRowsAndRecurrences(params: {
  scheduleRows: DbWeeklyScheduleRow[];
  recurrenceRows: DbWeeklyRecurrenceJoinedRow[];
  weekDays: Array<{ dateKey: string; index: number }>;
}): WeeklyScheduleItem[] {
  const { scheduleRows, recurrenceRows, weekDays } = params;
  const items: WeeklyScheduleItem[] = [];
  const specificByAnimeDay = new Set<string>();
  const specificByAnilistDay = new Set<string>();

  for (const r of scheduleRows) {
    const airingAtSec = toEpochSeconds(r.airingAtEpoch);
    if (airingAtSec <= 0) continue;

    const dayKey = getDayKeySaoPaulo(airingAtSec);
    if (r.animeId) {
      specificByAnimeDay.add(`${r.animeId}::${dayKey}`);
    }
    if (typeof r.anilistId === "number" && r.anilistId > 0) {
      specificByAnilistDay.add(`${r.anilistId}::${dayKey}`);
    }

    items.push({
      id: r.anilistId * 10000 + r.episode,
      airingAt: airingAtSec,
      timeUntilAiring: r.timeUntilAiring ?? undefined,
      episode: r.episode,
      isRecurring: false,
      media: {
        id: r.anilistId,
        animeId: r.animeId,
        format: r.format,
        status: r.status,
        title: {
          romaji: r.titleRomaji || r.title,
          english: r.titleEnglish || r.title,
          native: r.titleNative || r.title,
        },
        coverImage: {
          extraLarge: r.cover,
          large: r.cover,
          medium: r.cover,
          color: null,
        },
        bannerImage: r.banner,
        genres: r.genres || [],
      },
    });
  }

  const emittedRecurrenceByAnimeDay = new Set<string>();

  for (const day of weekDays) {
    const noonSec = getSaoPauloNoonTimestamp(day.dateKey);

    for (const rec of recurrenceRows) {
      if (!rec.active || Number(rec.dayOfWeek) !== day.index) {
        continue;
      }

      const animeDayKey = `${rec.animeId}::${day.dateKey}`;
      const anilistDayKey =
        typeof rec.anilistId === "number" && rec.anilistId > 0
          ? `${rec.anilistId}::${day.dateKey}`
          : null;

      if (
        specificByAnimeDay.has(animeDayKey) ||
        (anilistDayKey && specificByAnilistDay.has(anilistDayKey)) ||
        emittedRecurrenceByAnimeDay.has(animeDayKey)
      ) {
        continue;
      }
      emittedRecurrenceByAnimeDay.add(animeDayKey);

      items.push({
        id: computeRecurringItemNumericId(rec.recurrenceId, day.dateKey),
        airingAt: noonSec,
        episode: 0,
        isRecurring: true,
        recurrenceId: rec.recurrenceId,
        media: {
          id: typeof rec.anilistId === "number" && rec.anilistId > 0 ? rec.anilistId : 0,
          animeId: rec.animeId,
          format: rec.format,
          status: rec.status,
          title: {
            romaji: rec.titleRomaji || rec.title,
            english: rec.titleEnglish || rec.title,
            native: rec.titleNative || rec.title,
          },
          coverImage: {
            extraLarge: rec.cover,
            large: rec.cover,
            medium: rec.cover,
            color: null,
          },
          bannerImage: rec.banner,
          genres: rec.genres || [],
        },
      });
    }
  }

  items.sort((a, b) => a.airingAt - b.airingAt || a.episode - b.episode);
  return items;
}

export async function getTodayScheduleFromDbAndRedis(deps?: {
  sql?: Sql;
  redisGet?: (dayKey: string) => Promise<SlimAnime[] | null>;
  redisSet?: (dayKey: string, data: SlimAnime[]) => Promise<void>;
  now?: Date;
  skipLocalCache?: boolean;
}): Promise<SlimAnime[]> {
  const { todayKey, startTimestamp, endTimestamp } = getTodayRangeSaoPaulo(deps?.now);
  const todayWeekday = getWeekdaySaoPaulo(todayKey);
  const useLocalCache = !deps?.skipLocalCache && !deps?.sql && !deps?.redisGet;

  if (useLocalCache) {
    const cached = localTodayCache.get(todayKey);
    if (cached && Date.now() - cached.at <= LOCAL_TODAY_CACHE_TTL_MS) {
      return cached.data;
    }
  }

  const readRedis = deps?.redisGet ?? ((key: string) => getRedisCalendarToday<SlimAnime[]>(key));
  const writeRedis = deps?.redisSet ?? ((key: string, data: SlimAnime[]) => setRedisCalendarToday<SlimAnime[]>(key, data));

  const redisHit = await readRedis(todayKey).catch(() => null);
  if (Array.isArray(redisHit)) {
    const sortedHit = sortByHasEpisodeFirst(redisHit);
    if (useLocalCache) {
      localTodayCache.set(todayKey, { at: Date.now(), data: sortedHit });
    }
    return sortedHit;
  }

  const epochBeforeDb = localTodayCacheEpoch;
  const sql = deps?.sql ?? (await getSql());

  type CombinedTodayRow = DbTodayScheduleRow & {
    entryType: "specific" | "recurring";
    recurrenceId: string | null;
    dayOfWeek: number | null;
    timezone: string | null;
    active: boolean;
  };

  const combinedRows = await sql.query<CombinedTodayRow>(
    `SELECT
       'specific'::text AS "entryType",
       NULL::text AS "recurrenceId",
       NULL::smallint AS "dayOfWeek",
       NULL::text AS "timezone",
       true AS "active",
       s."anilistId",
       s."animeId",
       s."episode",
       EXTRACT(EPOCH FROM s."airingAt")::double precision AS "airingAtEpoch",
       a."malId",
       a."kitsuId",
       a."title",
       a."titleRomaji",
       a."titleEnglish",
       a."titleNative",
       a."cover",
       a."banner",
       a."synopsis",
       a."score",
       a."genres",
       a."format",
       a."status",
       a."episodesCount",
       a."season",
       a."year",
       a."trailerId",
       a."updatedAt",
       EXISTS (
         SELECT 1
         FROM "catalog_episode" e
         WHERE e."animeId" = a."id"
           AND e."published" = true
       ) AS "hasEpisode"
     FROM "catalog_airing_schedule" s
     JOIN "catalog_anime" a ON s."animeId" = a."id"
     WHERE s."airingAt" >= to_timestamp($1)
       AND s."airingAt" <= to_timestamp($2)
       AND (a."hidden" IS NOT TRUE)
       AND NOT ('Hentai' = ANY(COALESCE(a."genres", '{}'::text[])))
     UNION ALL
     SELECT
       'recurring'::text AS "entryType",
       r."id" AS "recurrenceId",
       r."dayOfWeek",
       r."timezone",
       r."active",
       a."anilistId",
       r."animeId",
       0::integer AS "episode",
       0::double precision AS "airingAtEpoch",
       a."malId",
       a."kitsuId",
       a."title",
       a."titleRomaji",
       a."titleEnglish",
       a."titleNative",
       a."cover",
       a."banner",
       a."synopsis",
       a."score",
       a."genres",
       a."format",
       a."status",
       a."episodesCount",
       a."season",
       a."year",
       a."trailerId",
       a."updatedAt",
       EXISTS (
         SELECT 1
         FROM "catalog_episode" e
         WHERE e."animeId" = a."id"
           AND e."published" = true
       ) AS "hasEpisode"
     FROM "catalog_weekly_recurrence" r
     JOIN "catalog_anime" a ON r."animeId" = a."id"
     WHERE r."active" = true
       AND r."dayOfWeek" = $3
       AND r."timezone" = $4
       AND (a."hidden" IS NOT TRUE)
       AND NOT ('Hentai' = ANY(COALESCE(a."genres", '{}'::text[])))
     ORDER BY "entryType" DESC, "airingAtEpoch" ASC, "episode" ASC, "title" ASC;`,
    [startTimestamp, endTimestamp, todayWeekday, CALENDAR_TIMEZONE],
  );

  const rows: DbTodayScheduleRow[] = [];
  const recurringRows: DbWeeklyRecurrenceJoinedRow[] = [];

  for (const row of combinedRows) {
    if (row.entryType === "recurring" && row.recurrenceId) {
      recurringRows.push({
        recurrenceId: row.recurrenceId,
        animeId: row.animeId,
        dayOfWeek: Number(row.dayOfWeek),
        timezone: row.timezone || CALENDAR_TIMEZONE,
        active: Boolean(row.active),
        createdAt: row.updatedAt ?? "",
        updatedAt: row.updatedAt ?? "",
        anilistId: row.anilistId ?? null,
        malId: row.malId ?? null,
        kitsuId: row.kitsuId ?? null,
        title: row.title,
        titleRomaji: row.titleRomaji,
        titleEnglish: row.titleEnglish,
        titleNative: row.titleNative,
        cover: row.cover,
        banner: row.banner,
        synopsis: row.synopsis,
        score: row.score,
        genres: row.genres,
        format: row.format,
        status: row.status,
        episodesCount: row.episodesCount,
        season: row.season,
        year: row.year,
        trailerId: row.trailerId,
        animeUpdatedAt: row.updatedAt,
        hasEpisode: Boolean(row.hasEpisode),
      });
    } else {
      rows.push(row);
    }
  }

  const items = mapTodayScheduleRowsToSlimAnime(rows, todayKey, recurringRows);

  if (epochBeforeDb === localTodayCacheEpoch) {
    if (useLocalCache) {
      localTodayCache.set(todayKey, { at: Date.now(), data: items });
    }
    await writeRedis(todayKey, items).catch(() => {});
  }

  return items;
}

export async function getWeeklyScheduleFromDbAndRedis(
  params: {
    startTimestamp: number;
    endTimestamp: number;
    weekKey?: string;
    days?: Array<{ dateKey: string; index: number }>;
  },
  deps?: {
    sql?: Sql;
    redisGet?: (weekCacheKey: string) => Promise<WeeklyScheduleItem[] | null>;
    redisSet?: (weekCacheKey: string, data: WeeklyScheduleItem[]) => Promise<void>;
  },
): Promise<WeeklyScheduleItem[]> {
  const { startTimestamp, endTimestamp, weekKey } = params;
  const effectiveWeekKey = weekKey
    ? `${weekKey}:${startTimestamp}:${endTimestamp}`
    : `${startTimestamp}:${endTimestamp}`;

  const readRedis =
    deps?.redisGet ??
    ((key: string) => getRedisCalendarSchedule<WeeklyScheduleItem[]>(key));
  const writeRedis =
    deps?.redisSet ??
    ((key: string, data: WeeklyScheduleItem[]) =>
      setRedisCalendarSchedule<WeeklyScheduleItem[]>(key, data));

  const cachedRedis = await readRedis(effectiveWeekKey).catch(() => null);
  if (Array.isArray(cachedRedis)) {
    return cachedRedis;
  }

  const epochBeforeDb = localTodayCacheEpoch;
  const sql = deps?.sql ?? (await getSql());

  type CombinedWeeklyRow = {
    entryType: "specific" | "recurring";
    scheduleId: string | null;
    recurrenceId: string | null;
    dayOfWeek: number | null;
    timezone: string | null;
    active: boolean;
    anilistId: number | null;
    animeId: string;
    episode: number;
    airingAtEpoch: number | string;
    timeUntilAiring: number | null;
    title: string;
    titleRomaji: string | null;
    titleEnglish: string | null;
    titleNative: string | null;
    cover: string | null;
    banner: string | null;
    format: string | null;
    status: string | null;
    genres: string[] | null;
  };

  const combinedRows = await sql.query<CombinedWeeklyRow>(
    `SELECT
       'specific'::text AS "entryType",
       s."id" AS "scheduleId",
       NULL::text AS "recurrenceId",
       NULL::smallint AS "dayOfWeek",
       NULL::text AS "timezone",
       true AS "active",
       s."anilistId",
       s."animeId",
       s."episode",
       EXTRACT(EPOCH FROM s."airingAt")::double precision AS "airingAtEpoch",
       s."timeUntilAiring",
       a."title",
       a."titleRomaji",
       a."titleEnglish",
       a."titleNative",
       a."cover",
       a."banner",
       a."format",
       a."status",
       a."genres"
     FROM "catalog_airing_schedule" s
     JOIN "catalog_anime" a ON s."animeId" = a."id"
     WHERE s."airingAt" >= to_timestamp($1)
       AND s."airingAt" <= to_timestamp($2)
       AND (a."hidden" IS NOT TRUE)
       AND NOT ('Hentai' = ANY(COALESCE(a."genres", '{}'::text[])))
     UNION ALL
     SELECT
       'recurring'::text AS "entryType",
       NULL::text AS "scheduleId",
       r."id" AS "recurrenceId",
       r."dayOfWeek",
       r."timezone",
       r."active",
       a."anilistId",
       r."animeId",
       0::integer AS "episode",
       0::double precision AS "airingAtEpoch",
       NULL::integer AS "timeUntilAiring",
       a."title",
       a."titleRomaji",
       a."titleEnglish",
       a."titleNative",
       a."cover",
       a."banner",
       a."format",
       a."status",
       a."genres"
     FROM "catalog_weekly_recurrence" r
     JOIN "catalog_anime" a ON r."animeId" = a."id"
     WHERE r."active" = true
       AND r."timezone" = $3
       AND (a."hidden" IS NOT TRUE)
       AND NOT ('Hentai' = ANY(COALESCE(a."genres", '{}'::text[])))
     ORDER BY "entryType" DESC, "airingAtEpoch" ASC, "episode" ASC, "dayOfWeek" ASC, "title" ASC;`,
    [startTimestamp, endTimestamp, CALENDAR_TIMEZONE],
  );

  const scheduleRows: DbWeeklyScheduleRow[] = [];
  const recurrenceRows: DbWeeklyRecurrenceJoinedRow[] = [];

  for (const r of combinedRows) {
    if (r.entryType === "recurring" && r.recurrenceId) {
      recurrenceRows.push({
        recurrenceId: r.recurrenceId,
        animeId: r.animeId,
        dayOfWeek: Number(r.dayOfWeek),
        timezone: r.timezone || CALENDAR_TIMEZONE,
        active: Boolean(r.active),
        createdAt: "",
        updatedAt: "",
        anilistId: r.anilistId ?? null,
        malId: null,
        kitsuId: null,
        title: r.title,
        titleRomaji: r.titleRomaji,
        titleEnglish: r.titleEnglish,
        titleNative: r.titleNative,
        cover: r.cover,
        banner: r.banner,
        synopsis: null,
        score: null,
        genres: r.genres,
        format: r.format,
        status: r.status,
        episodesCount: null,
        season: null,
        year: null,
        trailerId: null,
        animeUpdatedAt: null,
        hasEpisode: false,
      });
    } else if (r.scheduleId && typeof r.anilistId === "number") {
      scheduleRows.push({
        scheduleId: r.scheduleId,
        anilistId: r.anilistId,
        animeId: r.animeId,
        episode: r.episode,
        airingAtEpoch: r.airingAtEpoch,
        timeUntilAiring: r.timeUntilAiring,
        title: r.title,
        titleRomaji: r.titleRomaji,
        titleEnglish: r.titleEnglish,
        titleNative: r.titleNative,
        cover: r.cover,
        banner: r.banner,
        format: r.format,
        status: r.status,
        genres: r.genres,
      });
    }
  }

  const weekDays =
    Array.isArray(params.days) && params.days.length > 0
      ? params.days
      : getWeekDaysFromRangeSaoPaulo(startTimestamp, weekKey);

  const combined = mapWeeklyScheduleRowsAndRecurrences({
    scheduleRows: Array.isArray(scheduleRows) ? scheduleRows : [],
    recurrenceRows: Array.isArray(recurrenceRows) ? recurrenceRows : [],
    weekDays,
  });

  if (epochBeforeDb === localTodayCacheEpoch) {
    await writeRedis(effectiveWeekKey, combined).catch(() => {});
  }

  return combined;
}

async function invalidateCalendarAndTodayCaches(
  redisOverride?: CalendarRedisInvalidationClient | null,
): Promise<void> {
  invalidateLocalTodayScheduleCache();
  await invalidateRedisCalendar(redisOverride).catch(() => {});
  try {
    const { invalidateServerCatalogCachesAsync } = await import("@/lib/api");
    await invalidateServerCatalogCachesAsync(undefined, undefined, null);
  } catch {
    // Fail-open caso a camada de api não esteja inicializada no contexto de teste isolado
  }
}

function mapRecurrenceRow(row: DbWeeklyRecurrenceJoinedRow): CalendarRecurrenceRecord {
  return {
    id: row.recurrenceId,
    animeId: row.animeId,
    dayOfWeek: Number(row.dayOfWeek),
    timezone: row.timezone || CALENDAR_TIMEZONE,
    active: Boolean(row.active),
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
    anime: {
      id: row.animeId,
      anilistId: row.anilistId ?? null,
      title: row.title,
      titleRomaji: row.titleRomaji ?? null,
      titleEnglish: row.titleEnglish ?? null,
      cover: row.cover ?? null,
      format: row.format ?? null,
      status: row.status ?? null,
    },
  };
}

const RECURRENCE_SELECT_COLS = `
  r."id" AS "recurrenceId",
  r."animeId",
  r."dayOfWeek",
  r."timezone",
  r."active",
  r."createdAt",
  r."updatedAt",
  a."anilistId",
  a."malId",
  a."kitsuId",
  a."title",
  a."titleRomaji",
  a."titleEnglish",
  a."titleNative",
  a."cover",
  a."banner",
  a."synopsis",
  a."score",
  a."genres",
  a."format",
  a."status",
  a."episodesCount",
  a."season",
  a."year",
  a."trailerId",
  a."updatedAt" AS "animeUpdatedAt",
  false AS "hasEpisode"
`;

export async function listCalendarRecurrences(
  sqlOverride?: Sql,
): Promise<CalendarRecurrenceRecord[]> {
  const sql = sqlOverride ?? (await getSql());
  const rows = await sql.query<DbWeeklyRecurrenceJoinedRow>(
    `SELECT ${RECURRENCE_SELECT_COLS}
     FROM "catalog_weekly_recurrence" r
     JOIN "catalog_anime" a ON r."animeId" = a."id"
     ORDER BY r."dayOfWeek" ASC, a."title" ASC, r."createdAt" DESC;`,
  );
  return (Array.isArray(rows) ? rows : []).map(mapRecurrenceRow);
}

export async function searchCatalogAnimesForRecurrence(
  query: string,
  sqlOverride?: Sql,
): Promise<CatalogAnimeOptionForRecurrence[]> {
  const sql = sqlOverride ?? (await getSql());
  const clean = query.trim();

  if (!clean) {
    return sql.query<CatalogAnimeOptionForRecurrence>(
      `SELECT
         "id",
         "anilistId",
         "title",
         "titleRomaji",
         "titleEnglish",
         "cover",
         "format",
         "status",
         "year"
       FROM "catalog_anime"
       WHERE ("hidden" IS NOT TRUE)
       ORDER BY "updatedAt" DESC, "title" ASC
       LIMIT 25;`,
    );
  }

  const likePattern = `%${clean}%`;
  const numericQuery = /^\d+$/.test(clean) ? Number(clean) : null;

  return sql.query<CatalogAnimeOptionForRecurrence>(
    `SELECT
       "id",
       "anilistId",
       "title",
       "titleRomaji",
       "titleEnglish",
       "cover",
       "format",
       "status",
       "year"
     FROM "catalog_anime"
     WHERE ("hidden" IS NOT TRUE)
       AND (
         "title" ILIKE $1
         OR COALESCE("titleRomaji", '') ILIKE $1
         OR COALESCE("titleEnglish", '') ILIKE $1
         OR COALESCE("titleNative", '') ILIKE $1
         OR "id" ILIKE $1
         OR ($2::integer IS NOT NULL AND "anilistId" = $2::integer)
       )
     ORDER BY
       CASE
         WHEN LOWER("title") = LOWER($3) THEN 0
         WHEN LOWER(COALESCE("titleEnglish", '')) = LOWER($3) THEN 1
         WHEN LOWER(COALESCE("titleRomaji", '')) = LOWER($3) THEN 2
         ELSE 3
       END ASC,
       "updatedAt" DESC,
       "title" ASC
     LIMIT 25;`,
    [likePattern, numericQuery, clean],
  );
}

export async function createCalendarRecurrence(
  input: {
    animeId: string;
    dayOfWeek: number;
    active?: boolean;
  },
  deps?: {
    sql?: Sql;
    redisOverride?: CalendarRedisInvalidationClient | null;
  },
): Promise<CalendarRecurrenceRecord> {
  const animeId = input.animeId?.trim();
  const dayOfWeek = input.dayOfWeek;
  const active = input.active ?? true;

  if (!animeId) {
    throw new CalendarRecurrenceError("Selecione um anime do catálogo.", 400);
  }
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    throw new CalendarRecurrenceError(
      "Dia da semana inválido. Informe um valor entre 0 (Segunda-feira) e 6 (Domingo).",
      400,
    );
  }

  const sql = deps?.sql ?? (await getSql());

  const [animeRow] = await sql.query<{ id: string }>(
    `SELECT "id" FROM "catalog_anime" WHERE "id" = $1 LIMIT 1;`,
    [animeId],
  );
  if (!animeRow) {
    throw new CalendarRecurrenceError(
      "Anime não encontrado no catálogo do Hikari.",
      404,
    );
  }

  const [existing] = await sql.query<{ id: string; active: boolean }>(
    `SELECT "id", "active"
     FROM "catalog_weekly_recurrence"
     WHERE "animeId" = $1 AND "dayOfWeek" = $2
     LIMIT 1;`,
    [animeId, dayOfWeek],
  );
  if (existing) {
    const label = getWeekdayLabelSaoPaulo(dayOfWeek);
    throw new CalendarRecurrenceError(
      existing.active
        ? `Este anime já possui programação recorrente ativa para ${label}.`
        : `Este anime já possui uma recorrência inativa cadastrada para ${label}. Reative-a ou remova-a antes de criar outra.`,
      409,
    );
  }

  const id = `rec-${crypto.randomUUID()}`;
  try {
    await sql.query(
      `INSERT INTO "catalog_weekly_recurrence" (
         "id", "animeId", "dayOfWeek", "timezone", "active", "createdAt", "updatedAt"
       ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
      [id, animeId, dayOfWeek, CALENDAR_TIMEZONE, active],
    );
  } catch (err: unknown) {
    const code = (err as { code?: string } | null)?.code;
    if (code === "23505") {
      throw new CalendarRecurrenceError(
        `Este anime já possui programação recorrente para ${getWeekdayLabelSaoPaulo(dayOfWeek)}.`,
        409,
      );
    }
    throw err;
  }

  const [createdRow] = await sql.query<DbWeeklyRecurrenceJoinedRow>(
    `SELECT ${RECURRENCE_SELECT_COLS}
     FROM "catalog_weekly_recurrence" r
     JOIN "catalog_anime" a ON r."animeId" = a."id"
     WHERE r."id" = $1
     LIMIT 1;`,
    [id],
  );

  await invalidateCalendarAndTodayCaches(deps?.redisOverride);
  return mapRecurrenceRow(createdRow);
}

export async function updateCalendarRecurrence(
  input: {
    id: string;
    dayOfWeek?: number;
    active?: boolean;
  },
  deps?: {
    sql?: Sql;
    redisOverride?: CalendarRedisInvalidationClient | null;
  },
): Promise<CalendarRecurrenceRecord> {
  const id = input.id?.trim();
  if (!id) {
    throw new CalendarRecurrenceError("Identificador da recorrência é obrigatório.", 400);
  }
  if (
    input.dayOfWeek !== undefined &&
    (!Number.isInteger(input.dayOfWeek) || input.dayOfWeek < 0 || input.dayOfWeek > 6)
  ) {
    throw new CalendarRecurrenceError(
      "Dia da semana inválido. Informe um valor entre 0 (Segunda-feira) e 6 (Domingo).",
      400,
    );
  }
  if (input.dayOfWeek === undefined && input.active === undefined) {
    throw new CalendarRecurrenceError(
      "Informe ao menos 'dayOfWeek' ou 'active' para atualizar.",
      400,
    );
  }

  const sql = deps?.sql ?? (await getSql());

  const [current] = await sql.query<{
    id: string;
    animeId: string;
    dayOfWeek: number;
    active: boolean;
  }>(
    `SELECT "id", "animeId", "dayOfWeek", "active"
     FROM "catalog_weekly_recurrence"
     WHERE "id" = $1
     LIMIT 1;`,
    [id],
  );
  if (!current) {
    throw new CalendarRecurrenceError("Programação recorrente não encontrada.", 404);
  }

  const nextDayOfWeek = input.dayOfWeek ?? Number(current.dayOfWeek);
  const nextActive = input.active ?? Boolean(current.active);

  if (nextDayOfWeek !== Number(current.dayOfWeek)) {
    const [duplicate] = await sql.query<{ id: string }>(
      `SELECT "id"
       FROM "catalog_weekly_recurrence"
       WHERE "animeId" = $1 AND "dayOfWeek" = $2 AND "id" <> $3
       LIMIT 1;`,
      [current.animeId, nextDayOfWeek, id],
    );
    if (duplicate) {
      throw new CalendarRecurrenceError(
        `Este anime já possui outra recorrência cadastrada para ${getWeekdayLabelSaoPaulo(nextDayOfWeek)}.`,
        409,
      );
    }
  }

  try {
    await sql.query(
      `UPDATE "catalog_weekly_recurrence"
       SET "dayOfWeek" = $2,
           "active" = $3,
           "updatedAt" = CURRENT_TIMESTAMP
       WHERE "id" = $1;`,
      [id, nextDayOfWeek, nextActive],
    );
  } catch (err: unknown) {
    const code = (err as { code?: string } | null)?.code;
    if (code === "23505") {
      throw new CalendarRecurrenceError(
        `Este anime já possui recorrência cadastrada para ${getWeekdayLabelSaoPaulo(nextDayOfWeek)}.`,
        409,
      );
    }
    throw err;
  }

  const [updatedRow] = await sql.query<DbWeeklyRecurrenceJoinedRow>(
    `SELECT ${RECURRENCE_SELECT_COLS}
     FROM "catalog_weekly_recurrence" r
     JOIN "catalog_anime" a ON r."animeId" = a."id"
     WHERE r."id" = $1
     LIMIT 1;`,
    [id],
  );

  await invalidateCalendarAndTodayCaches(deps?.redisOverride);
  return mapRecurrenceRow(updatedRow);
}

export async function deleteCalendarRecurrence(
  id: string,
  deps?: {
    sql?: Sql;
    redisOverride?: CalendarRedisInvalidationClient | null;
  },
): Promise<{ id: string; animeId: string; dayOfWeek: number }> {
  const cleanId = id?.trim();
  if (!cleanId) {
    throw new CalendarRecurrenceError("Identificador da recorrência é obrigatório.", 400);
  }

  const sql = deps?.sql ?? (await getSql());
  const deletedRows = await sql.query<{
    id: string;
    animeId: string;
    dayOfWeek: number;
  }>(
    `DELETE FROM "catalog_weekly_recurrence"
     WHERE "id" = $1
     RETURNING "id", "animeId", "dayOfWeek";`,
    [cleanId],
  );

  const deleted = deletedRows[0];
  if (!deleted) {
    throw new CalendarRecurrenceError("Programação recorrente não encontrada.", 404);
  }

  await invalidateCalendarAndTodayCaches(deps?.redisOverride);
  return {
    id: deleted.id,
    animeId: deleted.animeId,
    dayOfWeek: Number(deleted.dayOfWeek),
  };
}
