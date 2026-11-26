import {
  CALENDAR_TIMEZONE,
  getDayKeySaoPaulo,
  getTodayRangeSaoPaulo,
  getWeekdaySaoPaulo,
} from "@/lib/calendar-timezone";
import { getSql } from "@/lib/db";
import { buildHikariPlayerEpisodeUrl } from "@/lib/hikari-player";
import { getHomeTrendingItems } from "@/lib/home-trending.server";
import { stripCatalogImageVersion } from "@/lib/image-utils";
import { hasEpisodePlayableSource } from "@/lib/published-episodes";
import {
  HERO_BANNER_PAYLOAD_VERSION,
  getRedisHeroBannerPoolWithFence,
  invalidateRedisHeroBannerPool,
  resolveHeroEnvironmentName,
  scheduleRedisBackgroundWrite,
  setRedisHeroBannerPool,
  type HeroBannerBucket,
  type HeroBannerPoolItem,
  type HeroBannerPoolPayload,
  type RedisEvalClient,
  type RedisHeroBannerPoolReadResult,
  type RedisScopedWriteStatus,
} from "@/lib/redis";
import type { SlimAnime } from "@/lib/types";

export const MAX_HERO_SLIDES = 8;
export const MAX_HERO_POOL_SIZE = 24;
export const HERO_ROTATION_WINDOW_MS = 15 * 60 * 1000; // 15 minutos
export const HERO_RAM_CACHE_TTL_MS = 4 * 60 * 1000; // 4 minutos

export const NOVELTY_WINDOW_DAYS = 21;
export const NOVELTY_TAIL_DAYS = 35;
export const NEW_EPISODE_WINDOW_DAYS = 10;

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export interface HeroEpisode1SourceRow {
  number?: number | null;
  seasonNumber?: number | null;
  videoUrl?: string | null;
  videoUrl2?: string | null;
  videoUrl3?: string | null;
  videoUrl4?: string | null;
  videoUrl5?: string | null;
  hikariPlayerEpisodeId?: string | null;
}

export interface HeroCatalogAnimeCandidateRow {
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
  hidden: boolean | null;
  archivedAt?: string | Date | null;
  score: number | null;
  popularity: number | null;
  trending: number | null;
  createdAt: string | Date | null;
  updatedAt: string | Date | null;
  publishedEpisodeCount: number;
  firstEpisodePublishedAt: string | Date | null;
  latestEpisodePublishedAt: string | Date | null;
  ep1Sources?: HeroEpisode1SourceRow[] | null;
  epSources?: HeroEpisode1SourceRow[] | null;
  hasTodayAiringSchedule?: boolean | null;
  hasTodayWeeklyRecurrence?: boolean | null;
  todayAiringAtEpoch?: number | string | null;
}

export interface ScoredHeroCandidate {
  anime: SlimAnime;
  sourceId: string;
  anilistId: number | null;
  malId: number | null;
  kitsuId: number | null;
  isDubbed: boolean;
  hasDistinctBanner: boolean;
  hasPublishedEpisode: boolean;
  isEmAlta: boolean;
  isCalendarToday: boolean;
  titleKey: string;
  emAltaScore: number;
  calendarScore: number;
  publishedScore: number;
  noveltyScore: number;
  newEpisodeScore: number;
  evergreenScore: number;
}

export function toHeroTimestampMs(val: unknown): number {
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

export function isValidHeroImageUrl(url?: string | null): boolean {
  if (typeof url !== "string") return false;
  const clean = url.trim();
  if (!clean || clean === "#" || clean === "null" || clean === "undefined") {
    return false;
  }
  return /^https?:\/\//i.test(clean) || clean.startsWith("/");
}

export function hasDistinctHorizontalBanner(
  cover?: string | null,
  banner?: string | null,
): boolean {
  const cleanBanner = stripCatalogImageVersion(banner);
  if (!isValidHeroImageUrl(cleanBanner)) return false;
  const cleanCover = stripCatalogImageVersion(cover);
  if (!isValidHeroImageUrl(cleanCover)) return true;
  return cleanBanner !== cleanCover;
}

export function isAdultHeroCandidate(genres?: string[] | null): boolean {
  if (!Array.isArray(genres) || genres.length === 0) return false;
  return genres.some((genre) => {
    const g = String(genre ?? "").trim().toLowerCase();
    return g === "hentai" || g === "eroge" || g === "+18" || g === "adult" || g === "rx";
  });
}

export function isDubbedHeroRow(row: {
  title?: string | null;
  titleRomaji?: string | null;
  titleEnglish?: string | null;
  titleNative?: string | null;
}): boolean {
  return /\b(dub|dublado|dublada|audio dual|dual audio)\b/i.test(
    `${row.title ?? ""} ${row.titleRomaji ?? ""} ${row.titleEnglish ?? ""} ${row.titleNative ?? ""}`,
  );
}

export function normalizeHeroTitleKey(row: {
  title?: string | null;
  titleRomaji?: string | null;
  titleEnglish?: string | null;
  titleNative?: string | null;
}): string {
  const raw =
    row.titleRomaji?.trim() ||
    row.titleEnglish?.trim() ||
    row.title?.trim() ||
    row.titleNative?.trim() ||
    "";

  if (!raw) return "";

  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(
      /\((?:dublado|dublada|dub|legendado|legendada|pt-br|audio dual|dual audio)\)/gi,
      " ",
    )
    .replace(
      /\[(?:dublado|dublada|dub|legendado|legendada|pt-br|audio dual|dual audio)\]/gi,
      " ",
    )
    .replace(
      /\b(?:dublado|dublada|dub|legendado|legendada|audio dual|dual audio)\b/gi,
      " ",
    )
    .replace(/[^a-z0-9\u3040-\u30ff\u4e00-\u9faf]+/g, " ")
    .trim();
}

/**
 * Resolve o ID de navegação compatível com `/anime/$id` e `/watch/$id/$ep`.
 * Prioriza IDs canônicos externos quando presentes (preservando aliases e logos),
 * e aceita identificadores internos válidos do catálogo do Hikari (`local-*` ou slugs próprios)
 * quando não há ID externo vinculado.
 */
export function resolveHeroWatchId(row: {
  id: string;
  anilistId?: number | null;
  malId?: number | null;
  kitsuId?: number | null;
}): string | null {
  const rawId = row.id?.trim() || "";
  if (!rawId) return null;

  if (!rawId.startsWith("local-")) {
    if (
      /^\d+$/.test(rawId) ||
      /^mal-\d+$/.test(rawId) ||
      /^kitsu-\d+$/.test(rawId)
    ) {
      return rawId;
    }
  }

  if (typeof row.anilistId === "number" && Number.isFinite(row.anilistId) && row.anilistId > 0) {
    return String(Math.floor(row.anilistId));
  }
  if (typeof row.malId === "number" && Number.isFinite(row.malId) && row.malId > 0) {
    return `mal-${Math.floor(row.malId)}`;
  }
  if (typeof row.kitsuId === "number" && Number.isFinite(row.kitsuId) && row.kitsuId > 0) {
    return `kitsu-${Math.floor(row.kitsuId)}`;
  }

  const lowerId = rawId.toLowerCase();
  if (
    lowerId === "null" ||
    lowerId === "undefined" ||
    /[\s/?#\\]/.test(rawId)
  ) {
    return null;
  }

  return rawId;
}

export function isHeroEpisodeRowPlayable(ep: HeroEpisode1SourceRow | null | undefined): boolean {
  if (!ep || typeof ep !== "object") return false;
  if (hasEpisodePlayableSource(ep)) return true;
  return Boolean(buildHikariPlayerEpisodeUrl(ep.hikariPlayerEpisodeId));
}

function isNonStubHeroTitle(row: {
  id: string;
  anilistId?: number | null;
  malId?: number | null;
  kitsuId?: number | null;
  title?: string | null;
  titleRomaji?: string | null;
  titleEnglish?: string | null;
  titleNative?: string | null;
}): boolean {
  const candidates = [row.titleRomaji, row.titleEnglish, row.title, row.titleNative]
    .map((v) => v?.trim() || "")
    .filter(Boolean);
  if (candidates.length === 0) return false;

  const idTokens = new Set<string>([row.id.trim()]);
  if (row.anilistId) idTokens.add(String(row.anilistId));
  if (row.malId) idTokens.add(`mal-${row.malId}`);
  if (row.kitsuId) idTokens.add(`kitsu-${row.kitsuId}`);

  return candidates.some((t) => !idTokens.has(t));
}

export function computeNoveltyScore(params: {
  animeCreatedAtMs?: number;
  firstEpisodePublishedAtMs: number;
  publishedEpisodeCount: number;
  badges?: { lancamento: boolean; novo: boolean; final: boolean } | null;
  nowMs: number;
}): number {
  const { firstEpisodePublishedAtMs, publishedEpisodeCount, nowMs } = params;

  if (!publishedEpisodeCount || publishedEpisodeCount < 1 || publishedEpisodeCount > 26) {
    return 0;
  }
  if (firstEpisodePublishedAtMs <= 0) {
    return 0;
  }

  const firstEpDays = Math.max(0, (nowMs - firstEpisodePublishedAtMs) / DAY_MS);

  let baseScore = 0;
  if (firstEpDays <= NOVELTY_WINDOW_DAYS) {
    baseScore = 110 * Math.exp(-firstEpDays / 12);
  } else if (firstEpDays <= NOVELTY_TAIL_DAYS) {
    const tailRatio =
      (NOVELTY_TAIL_DAYS - firstEpDays) / (NOVELTY_TAIL_DAYS - NOVELTY_WINDOW_DAYS);
    baseScore = 110 * Math.exp(-NOVELTY_WINDOW_DAYS / 12) * Math.max(0, tailRatio);
  }

  if (baseScore <= 0) {
    return 0;
  }

  return Math.round(baseScore * 100) / 100;
}

export function computeNewEpisodeScore(params: {
  latestEpisodePublishedAtMs: number;
  status: string | null;
  score: number | null;
  nowMs: number;
}): number {
  const { latestEpisodePublishedAtMs, status, score, nowMs } = params;
  if (latestEpisodePublishedAtMs <= 0) return 0;

  const ageMs = Math.max(0, nowMs - latestEpisodePublishedAtMs);
  const ageDays = ageMs / DAY_MS;
  if (ageDays > NEW_EPISODE_WINDOW_DAYS) return 0;

  const ageHours = ageMs / HOUR_MS;
  const recency = 95 * Math.exp(-ageHours / 56);
  const releasingBoost = status === "RELEASING" ? 18 : 0;
  const qualityTie = Math.min(10, Math.max(0, (score ?? 70) / 10));

  return Math.round((recency + releasingBoost + qualityTie) * 100) / 100;
}

export function computeEvergreenScore(params: {
  score: number | null;
  popularity: number | null;
  status: string | null;
  latestEpisodePublishedAtMs: number;
  nowMs: number;
}): number {
  const { score, popularity, status, latestEpisodePublishedAtMs, nowMs } = params;
  const scorePart = (score ?? 68) * 0.65;
  const popPart = Math.log1p(Math.max(0, popularity ?? 0)) * 4;
  const statusPart = status === "RELEASING" ? 12 : 0;
  const recentActivityPart =
    latestEpisodePublishedAtMs > 0 && (nowMs - latestEpisodePublishedAtMs) / DAY_MS <= 30
      ? 10
      : 0;

  return Math.round((scorePart + popPart + statusPart + recentActivityPart) * 100) / 100;
}

export function computeCalendarScore(params: {
  hasTodayAiringSchedule: boolean;
  hasTodayWeeklyRecurrence: boolean;
  hasPublishedEpisode: boolean;
  score: number | null;
  popularity: number | null;
}): number {
  const {
    hasTodayAiringSchedule,
    hasTodayWeeklyRecurrence,
    hasPublishedEpisode,
    score,
    popularity,
  } = params;

  if (!hasTodayAiringSchedule && !hasTodayWeeklyRecurrence) {
    return 0;
  }

  const sourceBoost = hasTodayAiringSchedule ? 45 : 35;
  const playableBoost = hasPublishedEpisode ? 15 : 0;
  const scorePart = Math.min(25, Math.max(0, (score ?? 65) * 0.25));
  const popPart = Math.min(15, Math.log1p(Math.max(0, popularity ?? 0)) * 1.2);

  return Math.round((sourceBoost + playableBoost + scorePart + popPart) * 100) / 100;
}

function collectMatchKeysFromIds(params: {
  id?: string | null;
  serverCatalogId?: string | null;
  anilistId?: number | null;
  malId?: number | null;
  kitsuId?: number | null;
}): string[] {
  const keys: string[] = [];
  const cleanId = params.id?.trim();
  const cleanServerId = params.serverCatalogId?.trim();
  if (cleanServerId) keys.push(`id:${cleanServerId}`);
  if (cleanId) keys.push(`id:${cleanId}`);

  const resolvedWatchId = cleanId
    ? resolveHeroWatchId({
        id: cleanId,
        anilistId: params.anilistId,
        malId: params.malId,
        kitsuId: params.kitsuId,
      })
    : null;
  if (resolvedWatchId) keys.push(`watch:${resolvedWatchId}`);

  if (typeof params.anilistId === "number" && Number.isFinite(params.anilistId) && params.anilistId > 0) {
    keys.push(`ani:${Math.floor(params.anilistId)}`);
  } else if (cleanId && /^\d+$/.test(cleanId)) {
    keys.push(`ani:${Number(cleanId)}`);
  }

  if (typeof params.malId === "number" && Number.isFinite(params.malId) && params.malId > 0) {
    keys.push(`mal:${Math.floor(params.malId)}`);
  } else if (cleanId && /^mal-(\d+)$/i.test(cleanId)) {
    keys.push(`mal:${Number(cleanId.slice(4))}`);
  }

  if (typeof params.kitsuId === "number" && Number.isFinite(params.kitsuId) && params.kitsuId > 0) {
    keys.push(`kitsu:${Math.floor(params.kitsuId)}`);
  } else if (cleanId && /^kitsu-(\d+)$/i.test(cleanId)) {
    keys.push(`kitsu:${Number(cleanId.slice(6))}`);
  }

  return Array.from(new Set(keys));
}

export function scoreAndDeduplicateHeroCandidates(
  rows: HeroCatalogAnimeCandidateRow[],
  trendingItems: SlimAnime[] = [],
  nowMs = Date.now(),
  calendarItems: SlimAnime[] = [],
): ScoredHeroCandidate[] {
  const candidates: ScoredHeroCandidate[] = [];
  const blockedKeys = new Set<string>();

  // Indexa Fonte B (Animes em Alta no Hikari) preservando exatamente a ordem recebida
  const trendingEntries = trendingItems
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => Boolean(item && item.id?.trim()) && !isAdultHeroCandidate(item.genres));

  const trendingByKey = new Map<string, { item: SlimAnime; index: number }>();
  for (const entry of trendingEntries) {
    const keys = collectMatchKeysFromIds({
      id: entry.item.id,
      serverCatalogId: entry.item.serverCatalogId,
      anilistId: entry.item.anilistId,
      malId: entry.item.malId,
      kitsuId: entry.item.kitsuId,
    });
    for (const k of keys) {
      if (!trendingByKey.has(k)) {
        trendingByKey.set(k, entry);
      }
    }
  }

  // Indexa Fonte A opcional (itens do Calendário do dia caso informados diretamente)
  const calendarEntries = calendarItems
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => Boolean(item && item.id?.trim()) && !isAdultHeroCandidate(item.genres));

  const calendarByKey = new Map<string, { item: SlimAnime; index: number }>();
  for (const entry of calendarEntries) {
    const keys = collectMatchKeysFromIds({
      id: entry.item.id,
      serverCatalogId: entry.item.serverCatalogId,
      anilistId: entry.item.anilistId,
      malId: entry.item.malId,
      kitsuId: entry.item.kitsuId,
    });
    for (const k of keys) {
      if (!calendarByKey.has(k)) {
        calendarByKey.set(k, entry);
      }
    }
  }

  const matchedTrendingIndices = new Set<number>();
  const matchedCalendarIndices = new Set<number>();

  for (const row of rows) {
    if (!row) continue;

    // Bloqueia explicitamente ocultos, arquivados e +18/Hentai (inclusive para evitar fallback de Em Alta/Calendário stale)
    if (row.hidden === true || Boolean(row.archivedAt) || isAdultHeroCandidate(row.genres)) {
      for (const k of collectMatchKeysFromIds(row)) {
        blockedKeys.add(k);
      }
      continue;
    }

    if (!isNonStubHeroTitle(row)) continue;

    const rawSources = [
      ...(Array.isArray(row.epSources) ? row.epSources : []),
      ...(Array.isArray(row.ep1Sources) ? row.ep1Sources : []),
    ];
    const playableSources = rawSources.filter((ep) => isHeroEpisodeRowPlayable(ep));
    const publishedCount = Number(row.publishedEpisodeCount ?? 0) || 0;
    const hasPublishedPlayableEpisode = publishedCount >= 1 && playableSources.length > 0;

    let firstAvailableEpisodeNumber: number | undefined;
    if (hasPublishedPlayableEpisode) {
      const sortedPlayable = [...playableSources].sort((a, b) => {
        const sa = typeof a.seasonNumber === "number" && Number.isFinite(a.seasonNumber) ? a.seasonNumber : 1;
        const sb = typeof b.seasonNumber === "number" && Number.isFinite(b.seasonNumber) ? b.seasonNumber : 1;
        if (sa !== sb) return sa - sb;
        const na = typeof a.number === "number" && Number.isFinite(a.number) ? a.number : 1;
        const nb = typeof b.number === "number" && Number.isFinite(b.number) ? b.number : 1;
        return na - nb;
      });
      const firstEpNum = sortedPlayable[0]?.number;
      if (typeof firstEpNum === "number" && Number.isFinite(firstEpNum) && firstEpNum >= 1) {
        firstAvailableEpisodeNumber = Math.floor(firstEpNum);
      }
    }

    const rowKeys = collectMatchKeysFromIds(row);

    // Verifica pertinência à Fonte B (Em Alta no Hikari)
    let matchedTrending: { item: SlimAnime; index: number } | null = null;
    for (const k of rowKeys) {
      const found = trendingByKey.get(k);
      if (found) {
        matchedTrending = found;
        break;
      }
    }

    // Verifica pertinência à Fonte A (Calendário do dia em America/Sao_Paulo)
    let matchedCalendar: { item: SlimAnime; index: number } | null = null;
    for (const k of rowKeys) {
      const found = calendarByKey.get(k);
      if (found) {
        matchedCalendar = found;
        break;
      }
    }

    const isEmAlta = matchedTrending !== null;
    if (matchedTrending) {
      matchedTrendingIndices.add(matchedTrending.index);
    }
    if (matchedCalendar) {
      matchedCalendarIndices.add(matchedCalendar.index);
    }

    const hasTodayAiring = Boolean(row.hasTodayAiringSchedule) || matchedCalendar !== null;
    const hasTodayRecurrence = Boolean(row.hasTodayWeeklyRecurrence);
    const isCalendarToday = hasTodayAiring || hasTodayRecurrence;

    // Critério exclusivo de elegibilidade:
    // Fonte A (Calendário programado para o dia) OU Fonte B (Em Alta no Hikari).
    // Animes recém-cadastrados ou recém-publicados NÃO entram automaticamente.
    if (!isEmAlta && !isCalendarToday) {
      continue;
    }

    const watchId = resolveHeroWatchId(row);
    if (!watchId) continue;

    const rowCover = stripCatalogImageVersion(row.cover);
    const rowBanner = stripCatalogImageVersion(row.banner);
    const trendingCover = matchedTrending ? stripCatalogImageVersion(matchedTrending.item.cover) : "";
    const trendingBanner = matchedTrending ? stripCatalogImageVersion(matchedTrending.item.banner) : "";
    const calendarCover = matchedCalendar ? stripCatalogImageVersion(matchedCalendar.item.cover) : "";
    const calendarBanner = matchedCalendar ? stripCatalogImageVersion(matchedCalendar.item.banner) : "";

    const cleanCover = isValidHeroImageUrl(rowCover)
      ? rowCover
      : isValidHeroImageUrl(trendingCover)
        ? trendingCover
        : calendarCover;
    const cleanBanner = isValidHeroImageUrl(rowBanner)
      ? rowBanner
      : isValidHeroImageUrl(trendingBanner)
        ? trendingBanner
        : calendarBanner;
    if (!isValidHeroImageUrl(cleanBanner) && !isValidHeroImageUrl(cleanCover)) {
      continue;
    }

    const distinctBanner = hasDistinctHorizontalBanner(cleanCover, cleanBanner);
    const isStubTitle =
      !row.title ||
      row.title.trim() === row.id ||
      (typeof row.anilistId === "number" && row.title.trim() === String(row.anilistId));
    const romaji =
      row.titleRomaji?.trim() ||
      (!isStubTitle ? row.title.trim() : "") ||
      row.titleEnglish?.trim() ||
      row.titleNative?.trim() ||
      matchedTrending?.item.titles?.romaji?.trim() ||
      matchedCalendar?.item.titles?.romaji?.trim() ||
      "Anime";

    const firstEpisodePublishedAtMs = toHeroTimestampMs(row.firstEpisodePublishedAt);
    const latestEpisodePublishedAtMs = toHeroTimestampMs(row.latestEpisodePublishedAt);
    const animeUpdatedAtMs = toHeroTimestampMs(row.updatedAt);

    const noveltyScore = hasPublishedPlayableEpisode
      ? computeNoveltyScore({
          firstEpisodePublishedAtMs,
          publishedEpisodeCount: publishedCount,
          nowMs,
        })
      : 0;
    const newEpisodeScore = hasPublishedPlayableEpisode
      ? computeNewEpisodeScore({
          latestEpisodePublishedAtMs,
          status: row.status,
          score: row.score,
          nowMs,
        })
      : 0;
    const evergreenScore = hasPublishedPlayableEpisode
      ? computeEvergreenScore({
          score: row.score,
          popularity: row.popularity,
          status: row.status,
          latestEpisodePublishedAtMs,
          nowMs,
        })
      : 0;

    const publishedScore = hasPublishedPlayableEpisode
      ? Math.max(noveltyScore, newEpisodeScore, evergreenScore, 10)
      : 0;
    const emAltaScore = matchedTrending ? Math.max(10, 200 - matchedTrending.index * 5) : 0;
    const calendarScore = isCalendarToday
      ? computeCalendarScore({
          hasTodayAiringSchedule: hasTodayAiring,
          hasTodayWeeklyRecurrence: hasTodayRecurrence,
          hasPublishedEpisode: hasPublishedPlayableEpisode,
          score: row.score ?? matchedCalendar?.item.score ?? null,
          popularity: row.popularity ?? matchedCalendar?.item.popularity ?? null,
        })
      : 0;

    const slimAnime: SlimAnime = {
      id: watchId,
      anilistId:
        row.anilistId ??
        matchedTrending?.item.anilistId ??
        matchedCalendar?.item.anilistId ??
        undefined,
      malId:
        row.malId ??
        matchedTrending?.item.malId ??
        matchedCalendar?.item.malId ??
        undefined,
      kitsuId:
        row.kitsuId ??
        matchedTrending?.item.kitsuId ??
        matchedCalendar?.item.kitsuId ??
        undefined,
      titles: {
        romaji,
        english:
          row.titleEnglish?.trim() ||
          matchedTrending?.item.titles?.english?.trim() ||
          matchedCalendar?.item.titles?.english?.trim() ||
          "",
        native:
          row.titleNative?.trim() ||
          matchedTrending?.item.titles?.native?.trim() ||
          matchedCalendar?.item.titles?.native?.trim() ||
          "",
      },
      cover: cleanCover || cleanBanner,
      banner: cleanBanner || "",
      synopsis:
        row.synopsis?.trim() ||
        matchedTrending?.item.synopsis?.trim() ||
        matchedCalendar?.item.synopsis?.trim() ||
        "",
      score: row.score ?? matchedTrending?.item.score ?? matchedCalendar?.item.score ?? null,
      popularity:
        row.popularity ??
        matchedTrending?.item.popularity ??
        matchedCalendar?.item.popularity ??
        null,
      genres:
        Array.isArray(row.genres) && row.genres.length > 0
          ? row.genres.filter(Boolean)
          : (matchedTrending?.item.genres ?? matchedCalendar?.item.genres ?? []),
      format:
        row.format?.trim() ||
        matchedTrending?.item.format?.trim() ||
        matchedCalendar?.item.format?.trim() ||
        "TV",
      status:
        row.status?.trim() ||
        matchedTrending?.item.status?.trim() ||
        matchedCalendar?.item.status?.trim() ||
        "FINISHED",
      episodesCount: hasPublishedPlayableEpisode
        ? row.episodesCount ?? publishedCount
        : row.episodesCount ??
          matchedTrending?.item.episodesCount ??
          matchedCalendar?.item.episodesCount ??
          null,
      season:
        row.season?.trim() ||
        matchedTrending?.item.season ||
        matchedCalendar?.item.season ||
        null,
      year:
        row.year ?? matchedTrending?.item.year ?? matchedCalendar?.item.year ?? null,
      trailerId:
        row.trailerId?.trim() ||
        matchedTrending?.item.trailerId ||
        matchedCalendar?.item.trailerId ||
        null,
      source: "local",
      catalogUpdatedAt: animeUpdatedAtMs || latestEpisodePublishedAtMs || undefined,
      serverCatalogId: row.id,
      hasEpisode: hasPublishedPlayableEpisode,
      ...(matchedCalendar?.item.todayEpisode
        ? { todayEpisode: matchedCalendar.item.todayEpisode }
        : {}),
      ...(hasPublishedPlayableEpisode &&
      firstAvailableEpisodeNumber !== undefined &&
      firstAvailableEpisodeNumber !== 1
        ? { firstAvailableEpisodeNumber }
        : {}),
    };

    const titleKey = normalizeHeroTitleKey(row) || watchId;

    candidates.push({
      anime: slimAnime,
      sourceId: row.id,
      anilistId: row.anilistId ?? null,
      malId: row.malId ?? null,
      kitsuId: row.kitsuId ?? null,
      isDubbed: isDubbedHeroRow(row),
      hasDistinctBanner: distinctBanner,
      hasPublishedEpisode: hasPublishedPlayableEpisode,
      isEmAlta,
      isCalendarToday,
      titleKey,
      emAltaScore,
      calendarScore,
      publishedScore,
      noveltyScore,
      newEpisodeScore,
      evergreenScore,
    });
  }

  // Preserva itens de Em Alta que não possuam linha correspondente no retorno de catalog_anime
  // (ex.: fallback ou mocks parciais), desde que válidos e não bloqueados por hidden/archived/+18.
  for (const { item, index } of trendingEntries) {
    if (matchedTrendingIndices.has(index)) continue;

    const itemKeys = collectMatchKeysFromIds({
      id: item.id,
      serverCatalogId: item.serverCatalogId,
      anilistId: item.anilistId,
      malId: item.malId,
      kitsuId: item.kitsuId,
    });
    if (itemKeys.some((k) => blockedKeys.has(k))) {
      continue;
    }

    const watchId = resolveHeroWatchId({
      id: item.id,
      anilistId: item.anilistId ?? null,
      malId: item.malId ?? null,
      kitsuId: item.kitsuId ?? null,
    });
    if (!watchId) continue;

    const nonStub = isNonStubHeroTitle({
      id: item.id,
      anilistId: item.anilistId ?? null,
      malId: item.malId ?? null,
      kitsuId: item.kitsuId ?? null,
      title: item.titles?.romaji || item.titles?.english,
      titleRomaji: item.titles?.romaji,
      titleEnglish: item.titles?.english,
      titleNative: item.titles?.native,
    });
    if (!nonStub) continue;

    const cleanCover = stripCatalogImageVersion(item.cover);
    const cleanBanner = stripCatalogImageVersion(item.banner);
    if (!isValidHeroImageUrl(cleanBanner) && !isValidHeroImageUrl(cleanCover)) {
      continue;
    }

    let matchedCalendarFallback: { item: SlimAnime; index: number } | null = null;
    for (const k of itemKeys) {
      const found = calendarByKey.get(k);
      if (found) {
        matchedCalendarFallback = found;
        matchedCalendarIndices.add(found.index);
        break;
      }
    }

    const distinctBanner = hasDistinctHorizontalBanner(cleanCover, cleanBanner);
    const titleObj = {
      title: item.titles?.romaji || item.titles?.english || "",
      titleRomaji: item.titles?.romaji || "",
      titleEnglish: item.titles?.english || "",
      titleNative: item.titles?.native || "",
    };
    const titleKey = normalizeHeroTitleKey(titleObj) || watchId;
    const emAltaScore = Math.max(10, 200 - index * 5);
    const hasPublished = Boolean(item.hasEpisode);
    const isCalendarToday = matchedCalendarFallback !== null;
    const calendarScore = isCalendarToday
      ? computeCalendarScore({
          hasTodayAiringSchedule: true,
          hasTodayWeeklyRecurrence: false,
          hasPublishedEpisode: hasPublished,
          score: item.score ?? null,
          popularity: item.popularity ?? null,
        })
      : 0;

    candidates.push({
      anime: {
        ...item,
        id: watchId,
        cover: cleanCover || cleanBanner,
        banner: cleanBanner || "",
        hasEpisode: hasPublished,
      },
      sourceId: item.serverCatalogId?.trim() || item.id,
      anilistId: item.anilistId ?? null,
      malId: item.malId ?? null,
      kitsuId: item.kitsuId ?? null,
      isDubbed: isDubbedHeroRow(titleObj),
      hasDistinctBanner: distinctBanner,
      hasPublishedEpisode: hasPublished,
      isEmAlta: true,
      isCalendarToday,
      titleKey,
      emAltaScore,
      calendarScore,
      publishedScore: hasPublished ? 10 : 0,
      noveltyScore: 0,
      newEpisodeScore: 0,
      evergreenScore: hasPublished ? 10 : 0,
    });
  }

  // Preserva itens do Calendário informados diretamente que não possuam linha em catalog_anime
  // (desde que válidos e não bloqueados por hidden/archived/+18).
  for (const { item, index } of calendarEntries) {
    if (matchedCalendarIndices.has(index)) continue;

    const itemKeys = collectMatchKeysFromIds({
      id: item.id,
      serverCatalogId: item.serverCatalogId,
      anilistId: item.anilistId,
      malId: item.malId,
      kitsuId: item.kitsuId,
    });
    if (itemKeys.some((k) => blockedKeys.has(k))) {
      continue;
    }

    const watchId = resolveHeroWatchId({
      id: item.id,
      anilistId: item.anilistId ?? null,
      malId: item.malId ?? null,
      kitsuId: item.kitsuId ?? null,
    });
    if (!watchId) continue;

    const nonStub = isNonStubHeroTitle({
      id: item.id,
      anilistId: item.anilistId ?? null,
      malId: item.malId ?? null,
      kitsuId: item.kitsuId ?? null,
      title: item.titles?.romaji || item.titles?.english,
      titleRomaji: item.titles?.romaji,
      titleEnglish: item.titles?.english,
      titleNative: item.titles?.native,
    });
    if (!nonStub) continue;

    const cleanCover = stripCatalogImageVersion(item.cover);
    const cleanBanner = stripCatalogImageVersion(item.banner);
    if (!isValidHeroImageUrl(cleanBanner) && !isValidHeroImageUrl(cleanCover)) {
      continue;
    }

    const distinctBanner = hasDistinctHorizontalBanner(cleanCover, cleanBanner);
    const titleObj = {
      title: item.titles?.romaji || item.titles?.english || "",
      titleRomaji: item.titles?.romaji || "",
      titleEnglish: item.titles?.english || "",
      titleNative: item.titles?.native || "",
    };
    const titleKey = normalizeHeroTitleKey(titleObj) || watchId;
    const hasPublished = Boolean(item.hasEpisode);
    const calendarScore = computeCalendarScore({
      hasTodayAiringSchedule: true,
      hasTodayWeeklyRecurrence: false,
      hasPublishedEpisode: hasPublished,
      score: item.score ?? null,
      popularity: item.popularity ?? null,
    });

    candidates.push({
      anime: {
        ...item,
        id: watchId,
        cover: cleanCover || cleanBanner,
        banner: cleanBanner || "",
        hasEpisode: hasPublished,
      },
      sourceId: item.serverCatalogId?.trim() || item.id,
      anilistId: item.anilistId ?? null,
      malId: item.malId ?? null,
      kitsuId: item.kitsuId ?? null,
      isDubbed: isDubbedHeroRow(titleObj),
      hasDistinctBanner: distinctBanner,
      hasPublishedEpisode: hasPublished,
      isEmAlta: false,
      isCalendarToday: true,
      titleKey,
      emAltaScore: 0,
      calendarScore,
      publishedScore: hasPublished ? 10 : 0,
      noveltyScore: 0,
      newEpisodeScore: 0,
      evergreenScore: hasPublished ? 10 : 0,
    });
  }

  // Deduplicação canônica preferindo banner horizontal próprio, versão original (não dublada),
  // episódio publicado real e maior pontuação, mesclando pertinência das duas fontes.
  const bestRankKey = (c: ScoredHeroCandidate): number =>
    (c.hasDistinctBanner ? 100000 : 0) +
    (!c.isDubbed ? 10000 : 0) +
    (c.hasPublishedEpisode ? 1000 : 0) +
    Math.max(c.emAltaScore, c.calendarScore);

  const sortedForDedup = [...candidates].sort((a, b) => bestRankKey(b) - bestRankKey(a));
  const deduped: ScoredHeroCandidate[] = [];
  const ownerByKey = new Map<string, ScoredHeroCandidate>();

  for (const c of sortedForDedup) {
    const keys = [
      `id:${c.anime.id}`,
      ...(c.anilistId && c.anilistId > 0 ? [`ani:${c.anilistId}`] : []),
      ...(c.malId && c.malId > 0 ? [`mal:${c.malId}`] : []),
      ...(c.kitsuId && c.kitsuId > 0 ? [`kitsu:${c.kitsuId}`] : []),
      ...(c.titleKey ? [`title:${c.titleKey}`] : []),
    ];

    let existingOwner: ScoredHeroCandidate | undefined;
    for (const k of keys) {
      const found = ownerByKey.get(k);
      if (found) {
        existingOwner = found;
        break;
      }
    }

    if (existingOwner) {
      existingOwner.isEmAlta = existingOwner.isEmAlta || c.isEmAlta;
      existingOwner.emAltaScore = Math.max(existingOwner.emAltaScore, c.emAltaScore);
      existingOwner.isCalendarToday = existingOwner.isCalendarToday || c.isCalendarToday;
      existingOwner.calendarScore = Math.max(existingOwner.calendarScore, c.calendarScore);
      existingOwner.hasPublishedEpisode =
        existingOwner.hasPublishedEpisode || c.hasPublishedEpisode;
      existingOwner.publishedScore = Math.max(existingOwner.publishedScore, c.publishedScore);
      existingOwner.noveltyScore = Math.max(existingOwner.noveltyScore, c.noveltyScore);
      existingOwner.newEpisodeScore = Math.max(existingOwner.newEpisodeScore, c.newEpisodeScore);
      existingOwner.evergreenScore = Math.max(existingOwner.evergreenScore, c.evergreenScore);
      if (c.hasPublishedEpisode && !existingOwner.anime.hasEpisode) {
        existingOwner.anime = {
          ...existingOwner.anime,
          hasEpisode: true,
          ...(c.anime.firstAvailableEpisodeNumber !== undefined
            ? { firstAvailableEpisodeNumber: c.anime.firstAvailableEpisodeNumber }
            : {}),
        };
      }
      if (c.anime.todayEpisode && !existingOwner.anime.todayEpisode) {
        existingOwner.anime = {
          ...existingOwner.anime,
          todayEpisode: c.anime.todayEpisode,
        };
      }
      for (const k of keys) {
        if (!ownerByKey.has(k)) {
          ownerByKey.set(k, existingOwner);
        }
      }
      continue;
    }

    for (const k of keys) {
      ownerByKey.set(k, c);
    }
    deduped.push(c);
  }

  return deduped;
}

export function buildHeroBannerPool(
  candidates: ScoredHeroCandidate[],
  nowMs: number,
): HeroBannerPoolPayload {
  const poolItems: HeroBannerPoolItem[] = [];
  const usedIds = new Set<string>();

  const populateTier = (tierCandidates: ScoredHeroCandidate[]) => {
    if (tierCandidates.length === 0 || poolItems.length >= MAX_HERO_POOL_SIZE) return;

    const addFromGroup = (
      bucket: HeroBannerBucket,
      list: ScoredHeroCandidate[],
      getScore: (c: ScoredHeroCandidate) => number,
      limit: number,
    ) => {
      let added = 0;
      const ordered = [...list].sort((a, b) => getScore(b) - getScore(a));
      for (const c of ordered) {
        if (added >= limit || poolItems.length >= MAX_HERO_POOL_SIZE) break;
        if (usedIds.has(c.anime.id)) continue;
        const score = getScore(c);
        if (score <= 0) continue;

        usedIds.add(c.anime.id);
        poolItems.push({
          anime: c.anime,
          bucket,
          score,
          hasDistinctBanner: c.hasDistinctBanner,
          titleKey: c.titleKey,
          rank: poolItems.length + 1,
        });
        added += 1;
      }
    };

    const emAltaCandidates = tierCandidates.filter((c) => c.isEmAlta && c.emAltaScore > 0);
    const calendarCandidates = tierCandidates.filter(
      (c) => c.isCalendarToday && c.calendarScore > 0,
    );

    // Equilibra as duas fontes aprovadas no pool do tier (Em Alta + Calendário)
    addFromGroup("em_alta", emAltaCandidates, (c) => c.emAltaScore, 12);
    addFromGroup("calendario", calendarCandidates, (c) => c.calendarScore, 12);

    // Se uma das fontes tiver menos de 12 candidatos, completa a capacidade do pool com os restantes do tier
    if (poolItems.length < MAX_HERO_POOL_SIZE) {
      addFromGroup(
        "em_alta",
        emAltaCandidates,
        (c) => c.emAltaScore,
        MAX_HERO_POOL_SIZE,
      );
      addFromGroup(
        "calendario",
        calendarCandidates,
        (c) => c.calendarScore,
        MAX_HERO_POOL_SIZE,
      );
    }
  };

  // Tier 1: Animes com banner horizontal próprio (sempre priorizados)
  populateTier(candidates.filter((c) => c.hasDistinctBanner));
  // Tier 2: Animes apenas com capa vertical (fallback secundário)
  if (poolItems.length < MAX_HERO_POOL_SIZE) {
    populateTier(candidates.filter((c) => !c.hasDistinctBanner));
  }

  return {
    v: HERO_BANNER_PAYLOAD_VERSION,
    env: resolveHeroEnvironmentName(),
    generatedAt: nowMs,
    items: poolItems,
  };
}

function buildInterleavedGroupList(
  items: HeroBannerPoolItem[],
  usedIds: Set<string>,
  usedTitleKeys: Set<string>,
): HeroBannerPoolItem[] {
  const uniqueItems: HeroBannerPoolItem[] = [];
  for (const item of items) {
    if (!item?.anime?.id) continue;
    if (usedIds.has(item.anime.id)) continue;
    if (item.titleKey && usedTitleKeys.has(item.titleKey)) continue;
    usedIds.add(item.anime.id);
    if (item.titleKey) usedTitleKeys.add(item.titleKey);
    uniqueItems.push(item);
  }

  if (uniqueItems.length <= 1) {
    return uniqueItems;
  }

  const emAltaGroup = uniqueItems.filter((i) => i.bucket === "em_alta");
  const publishedGroup = uniqueItems.filter((i) => i.bucket !== "em_alta");

  const consolidated: HeroBannerPoolItem[] = [];
  const maxLen = Math.max(emAltaGroup.length, publishedGroup.length);
  for (let i = 0; i < maxLen; i++) {
    if (i < emAltaGroup.length) consolidated.push(emAltaGroup[i]);
    if (i < publishedGroup.length) consolidated.push(publishedGroup[i]);
  }

  return consolidated;
}

function rotateSlice(
  items: HeroBannerPoolItem[],
  count: number,
  windowIndex: number,
): HeroBannerPoolItem[] {
  if (items.length === 0 || count <= 0) return [];
  const len = items.length;
  const start = ((windowIndex % len) + len) % len;
  const take = Math.min(count, len);
  const out: HeroBannerPoolItem[] = [];
  for (let i = 0; i < take; i++) {
    out.push(items[(start + i) % len]);
  }
  return out;
}

export function selectHeroSlidesForWindow(
  pool: HeroBannerPoolPayload | null | undefined,
  nowMs = Date.now(),
  maxSlides = MAX_HERO_SLIDES,
): SlimAnime[] {
  if (!pool || !Array.isArray(pool.items) || pool.items.length === 0) {
    return [];
  }

  const targetMax = Math.max(1, Math.min(maxSlides, MAX_HERO_SLIDES));
  const windowIndex = Math.floor(nowMs / HERO_ROTATION_WINDOW_MS);

  const usedIds = new Set<string>();
  const usedTitleKeys = new Set<string>();

  const distinctTier = buildInterleavedGroupList(
    pool.items.filter((i) => i.hasDistinctBanner),
    usedIds,
    usedTitleKeys,
  );
  const coverOnlyTier = buildInterleavedGroupList(
    pool.items.filter((i) => !i.hasDistinctBanner),
    usedIds,
    usedTitleKeys,
  );

  // Quando há >= 2 banners horizontais distintos, rotaciona-os de forma consolidada
  // mantendo todos antes dos fallbacks cover-only e variando a posição [0] entre janelas.
  if (distinctTier.length >= 2) {
    const selectedDistinct = rotateSlice(distinctTier, targetMax, windowIndex);
    const remaining = targetMax - selectedDistinct.length;
    const selectedCover =
      remaining > 0 ? rotateSlice(coverOnlyTier, remaining, windowIndex) : [];
    return [...selectedDistinct, ...selectedCover].map((item) => item.anime);
  }

  // Quando há apenas 0 ou 1 banner horizontal distinto, consolida ambos os tiers na mesma lista
  // antes de rotacionar para impedir que um único anime (ex.: Bakemonogatari) trave a posição [0].
  const consolidated = [...distinctTier, ...coverOnlyTier];
  if (consolidated.length === 0) {
    return [];
  }
  if (consolidated.length === 1) {
    return [consolidated[0].anime];
  }

  return rotateSlice(consolidated, targetMax, windowIndex).map((item) => item.anime);
}

// Estado do cache local em memória (processo Node / Serverless)
let ramHeroPool: { payload: HeroBannerPoolPayload; timestamp: number } | null = null;
let staleHeroPool: HeroBannerPoolPayload | null = null;
let heroPoolInFlight: Promise<HeroBannerPoolPayload | null> | null = null;
let heroPoolEpoch = 0;

export function invalidateHomeHeroLocalCache(options?: {
  preserveStale?: boolean;
}): void {
  heroPoolEpoch += 1;
  ramHeroPool = null;
  if (!options?.preserveStale) {
    staleHeroPool = null;
  }
  heroPoolInFlight = null;
}

export function invalidateHomeHeroCache(): void {
  invalidateHomeHeroLocalCache();
  void invalidateRedisHeroBannerPool().catch(() => {});
}

export async function invalidateHomeHeroCacheAsync(
  redisOverride?: RedisEvalClient | null,
): Promise<void> {
  invalidateHomeHeroLocalCache();
  await invalidateRedisHeroBannerPool(redisOverride).catch(() => {});
}

export function resetHomeHeroTestState(): void {
  heroPoolEpoch = 0;
  ramHeroPool = null;
  staleHeroPool = null;
  heroPoolInFlight = null;
}

async function queryCatalogCandidatesFromNeon(
  trendingItems: SlimAnime[] = [],
  nowMs = Date.now(),
): Promise<HeroCatalogAnimeCandidateRow[]> {
  const sql = await getSql();
  const todayRange = getTodayRangeSaoPaulo(new Date(nowMs));
  const todayWeekday = getWeekdaySaoPaulo(todayRange.todayKey);

  const trendingCatalogIds = new Set<string>();
  const trendingAnilistIds = new Set<number>();
  const trendingMalIds = new Set<number>();
  const trendingKitsuIds = new Set<number>();

  for (const item of trendingItems) {
    if (!item) continue;
    const rawServerId = typeof item.serverCatalogId === "string" ? item.serverCatalogId.trim() : "";
    const rawId = typeof item.id === "string" ? item.id.trim() : "";
    if (rawServerId) trendingCatalogIds.add(rawServerId);
    if (rawId) {
      trendingCatalogIds.add(rawId);
      if (/^\d+$/.test(rawId)) {
        const parsed = Number(rawId);
        if (Number.isFinite(parsed) && parsed > 0) {
          trendingAnilistIds.add(Math.floor(parsed));
        }
      } else if (/^mal-(\d+)$/i.test(rawId)) {
        const parsed = Number(rawId.slice(4));
        if (Number.isFinite(parsed) && parsed > 0) {
          trendingMalIds.add(Math.floor(parsed));
        }
      } else if (/^kitsu-(\d+)$/i.test(rawId)) {
        const parsed = Number(rawId.slice(6));
        if (Number.isFinite(parsed) && parsed > 0) {
          trendingKitsuIds.add(Math.floor(parsed));
        }
      }
    }
    if (typeof item.anilistId === "number" && Number.isFinite(item.anilistId) && item.anilistId > 0) {
      trendingAnilistIds.add(Math.floor(item.anilistId));
    }
    if (typeof item.malId === "number" && Number.isFinite(item.malId) && item.malId > 0) {
      trendingMalIds.add(Math.floor(item.malId));
    }
    if (typeof item.kitsuId === "number" && Number.isFinite(item.kitsuId) && item.kitsuId > 0) {
      trendingKitsuIds.add(Math.floor(item.kitsuId));
    }
  }

  const rows = await sql.query<HeroCatalogAnimeCandidateRow>(
    `WITH ep_stats AS (
       SELECT
         e."animeId",
         COUNT(*)::int AS "publishedEpisodeCount",
         MIN(COALESCE(e."publishedAt", e."createdAt")) AS "firstEpisodePublishedAt",
         MAX(COALESCE(e."publishedAt", e."createdAt")) AS "latestEpisodePublishedAt"
       FROM "catalog_episode" e
       WHERE e."published" = true
         AND (
           (e."videoUrl" IS NOT NULL AND BTRIM(e."videoUrl") <> '' AND BTRIM(e."videoUrl") <> '#')
           OR (e."videoUrl2" IS NOT NULL AND BTRIM(e."videoUrl2") <> '' AND BTRIM(e."videoUrl2") <> '#')
           OR (e."videoUrl3" IS NOT NULL AND BTRIM(e."videoUrl3") <> '' AND BTRIM(e."videoUrl3") <> '#')
           OR (e."videoUrl4" IS NOT NULL AND BTRIM(e."videoUrl4") <> '' AND BTRIM(e."videoUrl4") <> '#')
           OR (e."videoUrl5" IS NOT NULL AND BTRIM(e."videoUrl5") <> '' AND BTRIM(e."videoUrl5") <> '#')
           OR (e."hikari_player_episode_id" IS NOT NULL AND BTRIM(e."hikari_player_episode_id") <> '')
         )
       GROUP BY e."animeId"
     ),
     airing_stats AS (
       SELECT
         s."animeId",
         true AS "hasTodayAiringSchedule",
         MIN(EXTRACT(EPOCH FROM s."airingAt"))::double precision AS "todayAiringAtEpoch"
       FROM "catalog_airing_schedule" s
       WHERE s."airingAt" >= to_timestamp($1)
         AND s."airingAt" <= to_timestamp($2)
       GROUP BY s."animeId"
     ),
     recurrence_stats AS (
       SELECT
         r."animeId",
         true AS "hasTodayWeeklyRecurrence"
       FROM "catalog_weekly_recurrence" r
       WHERE r."active" = true
         AND r."dayOfWeek" = $3
         AND r."timezone" = $4
       GROUP BY r."animeId"
     )
     SELECT
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
       COALESCE(a."hidden", false) AS "hidden",
       a."archived_at" AS "archivedAt",
       a."score",
       a."popularity",
       a."trending",
       a."createdAt",
       a."updatedAt",
       COALESCE(ep_stats."publishedEpisodeCount", 0)::int AS "publishedEpisodeCount",
       ep_stats."firstEpisodePublishedAt",
       ep_stats."latestEpisodePublishedAt",
       ep_sample."epSources",
       COALESCE(airing_stats."hasTodayAiringSchedule", false) AS "hasTodayAiringSchedule",
       COALESCE(recurrence_stats."hasTodayWeeklyRecurrence", false) AS "hasTodayWeeklyRecurrence",
       airing_stats."todayAiringAtEpoch"
     FROM "catalog_anime" a
     LEFT JOIN ep_stats ON ep_stats."animeId" = a."id"
     LEFT JOIN airing_stats ON airing_stats."animeId" = a."id"
     LEFT JOIN recurrence_stats ON recurrence_stats."animeId" = a."id"
     LEFT JOIN LATERAL (
       SELECT JSONB_AGG(sub.*) AS "epSources"
       FROM (
         SELECT
           e."number",
           e."seasonNumber",
           e."videoUrl",
           e."videoUrl2",
           e."videoUrl3",
           e."videoUrl4",
           e."videoUrl5",
           e."hikari_player_episode_id" AS "hikariPlayerEpisodeId"
         FROM "catalog_episode" e
         WHERE e."animeId" = a."id"
           AND e."published" = true
           AND (
             (e."videoUrl" IS NOT NULL AND BTRIM(e."videoUrl") <> '' AND BTRIM(e."videoUrl") <> '#')
             OR (e."videoUrl2" IS NOT NULL AND BTRIM(e."videoUrl2") <> '' AND BTRIM(e."videoUrl2") <> '#')
             OR (e."videoUrl3" IS NOT NULL AND BTRIM(e."videoUrl3") <> '' AND BTRIM(e."videoUrl3") <> '#')
             OR (e."videoUrl4" IS NOT NULL AND BTRIM(e."videoUrl4") <> '' AND BTRIM(e."videoUrl4") <> '#')
             OR (e."videoUrl5" IS NOT NULL AND BTRIM(e."videoUrl5") <> '' AND BTRIM(e."videoUrl5") <> '#')
             OR (e."hikari_player_episode_id" IS NOT NULL AND BTRIM(e."hikari_player_episode_id") <> '')
           )
         ORDER BY e."seasonNumber" ASC, e."number" ASC
         LIMIT 10
       ) sub
     ) ep_sample ON ep_stats."publishedEpisodeCount" > 0
     WHERE (
       (
         (airing_stats."animeId" IS NOT NULL OR recurrence_stats."animeId" IS NOT NULL)
         AND COALESCE(a."hidden", false) = false
         AND a."archived_at" IS NULL
         AND NOT ('Hentai' = ANY(COALESCE(a."genres", '{}'::text[])))
       )
       OR a."id" = ANY($5::text[])
       OR (a."anilistId" IS NOT NULL AND a."anilistId" = ANY($6::int[]))
       OR (a."malId" IS NOT NULL AND a."malId" = ANY($7::int[]))
       OR (a."kitsuId" IS NOT NULL AND a."kitsuId" = ANY($8::int[]))
     );`,
    [
      todayRange.startTimestamp,
      todayRange.endTimestamp,
      todayWeekday,
      CALENDAR_TIMEZONE,
      Array.from(trendingCatalogIds),
      Array.from(trendingAnilistIds),
      Array.from(trendingMalIds),
      Array.from(trendingKitsuIds),
    ],
  );

  return Array.isArray(rows) ? rows : [];
}

export interface GetHomeHeroOptions {
  trendingItems?: SlimAnime[];
  calendarItems?: SlimAnime[];
}

export interface HomeHeroDeps {
  getRedisPool: () => Promise<RedisHeroBannerPoolReadResult>;
  setRedisPool: (
    payload: HeroBannerPoolPayload,
    fence?: string | null,
  ) => Promise<RedisScopedWriteStatus>;
  scheduleWrite: (promise: Promise<unknown>, operation?: string) => void;
  queryCatalog: (
    trendingItems?: SlimAnime[],
    nowMs?: number,
  ) => Promise<HeroCatalogAnimeCandidateRow[]>;
  getTrendingItems?: () => Promise<SlimAnime[]>;
}

const defaultHomeHeroDeps: HomeHeroDeps = {
  getRedisPool: () => getRedisHeroBannerPoolWithFence(),
  setRedisPool: (payload, fence) => setRedisHeroBannerPool(payload, fence),
  scheduleWrite: scheduleRedisBackgroundWrite,
  queryCatalog: queryCatalogCandidatesFromNeon,
  getTrendingItems: () => getHomeTrendingItems(),
};

function isCurrentHeroPoolPayload(
  pool: HeroBannerPoolPayload | null | undefined,
  currentEnv: string,
  currentDayKey: string,
): pool is HeroBannerPoolPayload {
  return Boolean(
    pool &&
      pool.v === HERO_BANNER_PAYLOAD_VERSION &&
      typeof pool.env === "string" &&
      pool.env === currentEnv &&
      typeof pool.generatedAt === "number" &&
      Number.isFinite(pool.generatedAt) &&
      getDayKeySaoPaulo(new Date(pool.generatedAt)) === currentDayKey &&
      Array.isArray(pool.items) &&
      pool.items.length > 0,
  );
}

export async function getHomeHeroPoolWithDeps(
  deps: HomeHeroDeps = defaultHomeHeroDeps,
  nowMs = Date.now(),
  options?: GetHomeHeroOptions,
): Promise<HeroBannerPoolPayload | null> {
  const currentEnv = resolveHeroEnvironmentName();
  const currentDayKey = getDayKeySaoPaulo(new Date(nowMs));

  // 1. Cache quente em memória RAM (somente se versão, ambiente e dia em America/Sao_Paulo coincidirem)
  if (ramHeroPool) {
    if (!isCurrentHeroPoolPayload(ramHeroPool.payload, currentEnv, currentDayKey)) {
      ramHeroPool = null;
    } else if (nowMs - ramHeroPool.timestamp < HERO_RAM_CACHE_TTL_MS) {
      return ramHeroPool.payload;
    }
  }

  // 2. Coalescing de requisições concorrentes (singleflight)
  if (heroPoolInFlight) {
    return heroPoolInFlight;
  }

  const requestEpoch = heroPoolEpoch;
  let flightRef: Promise<HeroBannerPoolPayload | null> | null = null;

  const currentFlight = (async (): Promise<HeroBannerPoolPayload | null> => {
    try {
      // 3. Consulta Upstash Redis antes de ir ao Neon (valida versão, ambiente e dia atual)
      const redisRead = await deps.getRedisPool();
      if (
        redisRead.status === "hit" &&
        isCurrentHeroPoolPayload(redisRead.payload, currentEnv, currentDayKey)
      ) {
        if (requestEpoch === heroPoolEpoch) {
          staleHeroPool = redisRead.payload;
          ramHeroPool = { payload: redisRead.payload, timestamp: Date.now() };
        }
        return redisRead.payload;
      }

      const activeFence =
        redisRead.status === "miss"
          ? redisRead.fence
          : redisRead.status === "failed"
            ? null
            : undefined;

      // 4. Miss no Redis/RAM: obtém Fonte B (Em Alta) e consulta Fonte A (Calendário) + enriquecimento no Neon
      const trendingItems = Array.isArray(options?.trendingItems)
        ? options.trendingItems
        : deps.getTrendingItems
          ? await deps.getTrendingItems().catch(() => [] as SlimAnime[])
          : [];
      const calendarItems = Array.isArray(options?.calendarItems)
        ? options.calendarItems
        : [];

      const catalogRows = await deps.queryCatalog(trendingItems, nowMs);

      const scored = scoreAndDeduplicateHeroCandidates(
        catalogRows,
        trendingItems,
        nowMs,
        calendarItems,
      );

      if (scored.length === 0) {
        if (!isCurrentHeroPoolPayload(staleHeroPool, currentEnv, currentDayKey)) {
          staleHeroPool = null;
          return null;
        }
        return staleHeroPool;
      }

      const pool = buildHeroBannerPool(scored, nowMs);
      if (pool.items.length === 0) {
        if (!isCurrentHeroPoolPayload(staleHeroPool, currentEnv, currentDayKey)) {
          staleHeroPool = null;
          return null;
        }
        return staleHeroPool;
      }

      if (requestEpoch === heroPoolEpoch) {
        staleHeroPool = pool;
        ramHeroPool = { payload: pool, timestamp: Date.now() };
        deps.scheduleWrite(deps.setRedisPool(pool, activeFence), "setRedisHeroBannerPool");
      }

      return pool;
    } catch (err) {
      console.warn(
        "[home-hero] Falha segura ao montar pool dinâmico do Hero (usando reserva stale se disponível):",
        err instanceof Error ? err.message : err,
      );
      if (!isCurrentHeroPoolPayload(staleHeroPool, currentEnv, currentDayKey)) {
        staleHeroPool = null;
        return null;
      }
      return staleHeroPool;
    } finally {
      if (heroPoolInFlight === flightRef) {
        heroPoolInFlight = null;
      }
    }
  })();

  flightRef = currentFlight;
  heroPoolInFlight = currentFlight;
  return currentFlight;
}

export async function getHomeHeroItemsWithDeps(
  deps: HomeHeroDeps = defaultHomeHeroDeps,
  nowMs = Date.now(),
  options?: GetHomeHeroOptions,
): Promise<SlimAnime[]> {
  const pool = await getHomeHeroPoolWithDeps(deps, nowMs, options);
  return selectHeroSlidesForWindow(pool, nowMs, MAX_HERO_SLIDES);
}

export async function getHomeHeroItems(
  nowMs = Date.now(),
  options?: GetHomeHeroOptions,
): Promise<SlimAnime[]> {
  return getHomeHeroItemsWithDeps(defaultHomeHeroDeps, nowMs, options);
}
