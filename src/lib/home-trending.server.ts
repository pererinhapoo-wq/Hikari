import { getSql } from "@/lib/db";
import {
  CALENDAR_TIMEZONE,
  getTodayRangeSaoPaulo,
  getWeekdaySaoPaulo,
} from "@/lib/calendar-timezone";
import { currentAnimeSeason } from "@/lib/utils";
import type { AnimeRecentBadgesLookup } from "@/lib/catalog-badges";
import { buildHikariPlayerEpisodeUrl } from "@/lib/hikari-player";
import { stripCatalogImageVersion } from "@/lib/image-utils";
import { hasEpisodePlayableSource } from "@/lib/published-episodes";
import {
  getRedisHomeTrendingWithFence,
  invalidateRedisHomeTrending,
  scheduleRedisBackgroundWrite,
  setRedisHomeTrending,
  type HomeTrendingPayload,
  type RedisHomeTrendingReadResult,
  type RedisScopedWriteStatus,
} from "@/lib/redis";
import type { SlimAnime } from "@/lib/types";

export const MAX_HOME_TRENDING_ITEMS = 18;
export const MAX_HOME_TRENDING_CACHE_ITEMS = 24;
export const TRENDING_RAM_CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutos
export const TRENDING_AUDIENCE_WINDOW_DAYS = 30;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const FUTURE_CLOCK_SKEW_TOLERANCE_MS = 5 * 60 * 1000;

export type TrendingTimeBucket = "0_48h" | "2_7d" | "7_14d" | "14_30d";
export type TrendingSignalKind = "playback" | "progress" | "comment";

export const TRENDING_SIGNAL_WEIGHTS: Record<
  TrendingSignalKind,
  Record<TrendingTimeBucket, number>
> = {
  playback: {
    "0_48h": 5.0,
    "2_7d": 3.5,
    "7_14d": 1.6,
    "14_30d": 0.5,
  },
  progress: {
    "0_48h": 4.2,
    "2_7d": 3.0,
    "7_14d": 1.4,
    "14_30d": 0.4,
  },
  comment: {
    "0_48h": 2.2,
    "2_7d": 1.5,
    "7_14d": 0.7,
    "14_30d": 0.25,
  },
};

export interface TrendingEpisodeSourceRow {
  videoUrl?: string | null;
  videoUrl2?: string | null;
  videoUrl3?: string | null;
  videoUrl4?: string | null;
  videoUrl5?: string | null;
  hikariPlayerEpisodeId?: string | null;
}

export interface TrendingCatalogAnimeCandidateRow {
  id: string;
  title: string;
  anilistId: number | null;
  malId: number | null;
  kitsuId: number | null;
  titleRomaji: string | null;
  titleEnglish: string | null;
  titleNative: string | null;
  cover: string | null;
  format: string | null;
  status: string | null;
  episodesCount: number | null;
  year: number | null;
  season: string | null;
  genres: string[] | null;
  hidden: boolean | null;
  score: number | null;
  popularity: number | null;
  trending?: number | null;
  updatedAt: string | Date | null;
  publishedEpisodeCount: number;
  latestEpisodePublishedAt: string | Date | null;
  epSources: TrendingEpisodeSourceRow[] | null;
  hasTodayAiringSchedule?: boolean | null;
  hasWeekAiringSchedule?: boolean | null;
  hasTodayWeeklyRecurrence?: boolean | null;
  hasActiveWeeklyRecurrence?: boolean | null;
}

export interface TrendingUserAnimeSignalRow {
  userId: string;
  animeId: string;
  playbackAt: string | Date | number | null;
  progressAt: string | Date | number | null;
  commentAt?: string | Date | number | null;
  /** Ignorado intencionalmente: marcação manual ("assistido") não influencia Em Alta */
  manualAt?: string | Date | number | null;
}

export interface ScoredTrendingItem {
  anime: SlimAnime;
  workKey: string;
  audienceRaw: number;
  audienceScore: number;
  calendarBoost: number;
  publishedEpisodeBoost: number;
  seasonBoost: number;
  editorialBoost: number;
  fallbackRankScore: number;
  uniqueUsers: number;
  latestActivityMs: number;
  isFallbackFill: boolean;
}

export function toTrendingTimestampMs(val: unknown): number {
  if (typeof val === "number") {
    return Number.isFinite(val) && val > 0 ? val : 0;
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

export function isValidTrendingCoverUrl(url?: string | null): boolean {
  if (typeof url !== "string") return false;
  const clean = url.trim();
  if (!clean || clean === "#" || clean === "null" || clean === "undefined") {
    return false;
  }
  return /^https?:\/\//i.test(clean) || clean.startsWith("/");
}

export function isAdultTrendingCandidate(genres?: string[] | null): boolean {
  if (!Array.isArray(genres) || genres.length === 0) return false;
  return genres.some((genre) => {
    const g = String(genre ?? "").trim().toLowerCase();
    return (
      g === "hentai" ||
      g === "eroge" ||
      g === "+18" ||
      g === "adult" ||
      g === "rx"
    );
  });
}

export function isDubbedTrendingRow(row: {
  title?: string | null;
  titleRomaji?: string | null;
  titleEnglish?: string | null;
  titleNative?: string | null;
}): boolean {
  return /\b(dub|dublado|dublada|audio dual|dual audio)\b/i.test(
    `${row.title ?? ""} ${row.titleRomaji ?? ""} ${row.titleEnglish ?? ""} ${row.titleNative ?? ""}`,
  );
}

export function normalizeTrendingBaseTitleKey(row: {
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

export function resolveTrendingWatchId(row: {
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

  if (
    typeof row.anilistId === "number" &&
    Number.isFinite(row.anilistId) &&
    row.anilistId > 0
  ) {
    return String(Math.floor(row.anilistId));
  }
  if (
    typeof row.malId === "number" &&
    Number.isFinite(row.malId) &&
    row.malId > 0
  ) {
    return `mal-${Math.floor(row.malId)}`;
  }
  if (
    typeof row.kitsuId === "number" &&
    Number.isFinite(row.kitsuId) &&
    row.kitsuId > 0
  ) {
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

export function isTrendingEpisodeRowPlayable(
  ep: TrendingEpisodeSourceRow | null | undefined,
): boolean {
  if (!ep || typeof ep !== "object") return false;
  if (hasEpisodePlayableSource(ep)) return true;
  return Boolean(buildHikariPlayerEpisodeUrl(ep.hikariPlayerEpisodeId));
}

function isNonStubTrendingTitle(row: TrendingCatalogAnimeCandidateRow): boolean {
  const candidates = [
    row.titleRomaji,
    row.titleEnglish,
    row.title,
    row.titleNative,
  ]
    .map((v) => v?.trim() || "")
    .filter(Boolean);
  if (candidates.length === 0) return false;

  const idTokens = new Set<string>([row.id.trim()]);
  if (row.anilistId) idTokens.add(String(row.anilistId));
  if (row.malId) idTokens.add(`mal-${row.malId}`);
  if (row.kitsuId) idTokens.add(`kitsu-${row.kitsuId}`);

  return candidates.some((t) => !idTokens.has(t));
}

export function classifyTrendingTimeBucket(
  timestampMs: number,
  nowMs: number,
): TrendingTimeBucket | null {
  if (!Number.isFinite(timestampMs) || timestampMs <= 0) return null;
  if (!Number.isFinite(nowMs) || nowMs <= 0) return null;
  if (timestampMs > nowMs + FUTURE_CLOCK_SKEW_TOLERANCE_MS) return null;

  const ageMs = Math.max(0, nowMs - timestampMs);
  if (ageMs <= 48 * HOUR_MS) return "0_48h";
  if (ageMs <= 7 * DAY_MS) return "2_7d";
  if (ageMs <= 14 * DAY_MS) return "7_14d";
  if (ageMs <= TRENDING_AUDIENCE_WINDOW_DAYS * DAY_MS) return "14_30d";
  return null;
}

export function getSignalWeightForTimestamp(
  kind: TrendingSignalKind,
  timestampMs: number,
  nowMs: number,
): number {
  const bucket = classifyTrendingTimeBucket(timestampMs, nowMs);
  if (!bucket) return 0;
  return TRENDING_SIGNAL_WEIGHTS[kind][bucket];
}

function buildRowAliasKeys(row: {
  id: string;
  anilistId?: number | null;
  malId?: number | null;
  kitsuId?: number | null;
}): string[] {
  const keys = new Set<string>();
  const cleanId = row.id?.trim();
  if (cleanId) keys.add(cleanId);
  if (typeof row.anilistId === "number" && Number.isFinite(row.anilistId) && row.anilistId > 0) {
    keys.add(String(Math.floor(row.anilistId)));
  }
  if (typeof row.malId === "number" && Number.isFinite(row.malId) && row.malId > 0) {
    keys.add(`mal-${Math.floor(row.malId)}`);
  }
  if (typeof row.kitsuId === "number" && Number.isFinite(row.kitsuId) && row.kitsuId > 0) {
    keys.add(`kitsu-${Math.floor(row.kitsuId)}`);
  }
  return Array.from(keys);
}

interface ParsedTrendingCandidate {
  row: TrendingCatalogAnimeCandidateRow;
  watchId: string;
  isDubbed: boolean;
  hasAudioTag: boolean;
  baseTitleKey: string;
  slimAnime: SlimAnime;
  latestEpisodePublishedAtMs: number;
  fallbackRankScore: number;
  calendarBoost: number;
  publishedEpisodeBoost: number;
  seasonBoost: number;
}

function hasConflictingExternalIds(
  a: Pick<TrendingCatalogAnimeCandidateRow, "anilistId" | "malId" | "kitsuId">,
  b: Pick<TrendingCatalogAnimeCandidateRow, "anilistId" | "malId" | "kitsuId">,
): boolean {
  if (
    typeof a.anilistId === "number" &&
    a.anilistId > 0 &&
    typeof b.anilistId === "number" &&
    b.anilistId > 0 &&
    a.anilistId !== b.anilistId
  ) {
    return true;
  }
  if (
    typeof a.malId === "number" &&
    a.malId > 0 &&
    typeof b.malId === "number" &&
    b.malId > 0 &&
    a.malId !== b.malId
  ) {
    return true;
  }
  if (
    typeof a.kitsuId === "number" &&
    a.kitsuId > 0 &&
    typeof b.kitsuId === "number" &&
    b.kitsuId > 0 &&
    a.kitsuId !== b.kitsuId
  ) {
    return true;
  }
  return false;
}

export function computeTrendingRankScore(params: {
  status: string | null;
  score: number | null;
  popularity: number | null;
  trending?: number | null;
  latestEpisodePublishedAtMs: number;
  publishedEpisodeCount: number;
  hasPublishedPlayable: boolean;
  hasTodaySchedule: boolean;
  hasTodayRecurrence: boolean;
  hasWeekSchedule: boolean;
  hasActiveRecurrence: boolean;
  isCurrentSeason: boolean;
  nowMs: number;
}): {
  rankScore: number;
  calendarBoost: number;
  publishedEpisodeBoost: number;
  seasonBoost: number;
} {
  const {
    status,
    score,
    popularity,
    trending,
    latestEpisodePublishedAtMs,
    publishedEpisodeCount,
    hasPublishedPlayable,
    hasTodaySchedule,
    hasTodayRecurrence,
    hasWeekSchedule,
    hasActiveRecurrence,
    isCurrentSeason,
    nowMs,
  } = params;

  // 1. Calendário de lançamentos (catalog_airing_schedule / catalog_weekly_recurrence)
  // Independe de já haver episódio publicado no Hikari.
  let calendarBoost = 0;
  if (hasTodaySchedule || hasTodayRecurrence) {
    calendarBoost = 90;
  } else if (hasWeekSchedule || hasActiveRecurrence) {
    calendarBoost = 40;
  }

  // 2. Publicação real de episódios recentes no Hikari (sinal independente do calendário)
  let publishedEpisodeBoost = 0;
  const recentEpDays =
    hasPublishedPlayable && latestEpisodePublishedAtMs > 0
      ? Math.max(0, (nowMs - latestEpisodePublishedAtMs) / DAY_MS)
      : Infinity;
  if (hasPublishedPlayable && recentEpDays <= 21) {
    const recencyPart =
      recentEpDays <= 2
        ? 55
        : recentEpDays <= 7
          ? 42
          : recentEpDays <= 14
            ? 24
            : 10;
    const releasingBonus = status === "RELEASING" ? 8 : 0;
    publishedEpisodeBoost = recencyPart + releasingBonus;
  }

  // 3. Popularidade da temporada atual com métricas reais do catálogo (sem usar data de cadastro)
  let seasonBoost = 0;
  const safePop = typeof popularity === "number" && Number.isFinite(popularity) ? Math.max(0, popularity) : 0;
  const safeTrend = typeof trending === "number" && Number.isFinite(trending) ? Math.max(0, trending) : 0;
  const safeScore = typeof score === "number" && Number.isFinite(score) ? Math.max(0, score) : 0;
  const hasCurrentSeasonPopularity =
    isCurrentSeason && (safePop >= 3000 || safeTrend >= 10 || safeScore >= 72);

  if (hasCurrentSeasonPopularity) {
    const popContribution = safePop > 0 ? Math.min(35, Math.log1p(safePop) * 2.5) : 0;
    const trendContribution = safeTrend > 0 ? Math.min(20, Math.log1p(safeTrend) * 4) : 0;
    const scoreContribution = safeScore >= 70 ? Math.min(10, (safeScore - 70) * 0.4) : 0;
    seasonBoost =
      Math.round((25 + popContribution + trendContribution + scoreContribution) * 100) / 100;
  }

  const popPart = safePop > 0 ? Math.log1p(safePop) * 3 : 0;
  const scorePart = safeScore > 0 ? safeScore * 0.25 : 0;
  const episodeDepthPart = hasPublishedPlayable
    ? Math.min(24, Math.max(0, publishedEpisodeCount)) * 0.25
    : 0;

  const rankScore =
    Math.round(
      (calendarBoost +
        publishedEpisodeBoost +
        seasonBoost +
        popPart +
        scorePart +
        episodeDepthPart) *
        100,
    ) / 100;

  return { rankScore, calendarBoost, publishedEpisodeBoost, seasonBoost };
}

interface ConsolidatedUserWorkSignals {
  playbackAtMs: number;
  progressAtMs: number;
  commentAtMs: number;
}

export function scoreAndRankHomeTrending(
  rows: TrendingCatalogAnimeCandidateRow[],
  _badgesLookup: AnimeRecentBadgesLookup,
  signals: TrendingUserAnimeSignalRow[],
  nowMs = Date.now(),
): ScoredTrendingItem[] {
  const parsedCandidates: ParsedTrendingCandidate[] = [];
  const audioTaggedRowsForAliasResolution: Array<{
    row: TrendingCatalogAnimeCandidateRow;
    baseTitleKey: string;
    hasAudioTag: boolean;
  }> = [];

  const currentSeason = currentAnimeSeason(new Date(nowMs));

  for (const row of rows) {
    if (!row || row.hidden === true) continue;
    if (isAdultTrendingCandidate(row.genres)) continue;
    if (!isNonStubTrendingTitle(row)) continue;

    const publishedCount = Number(row.publishedEpisodeCount ?? 0) || 0;
    const epList = Array.isArray(row.epSources) ? row.epSources : [];
    const hasPlayableEp = epList.some((ep) => isTrendingEpisodeRowPlayable(ep));
    const hasPublishedPlayable = publishedCount >= 1 && hasPlayableEp;

    const isCurrentSeason = Boolean(
      row.season &&
        row.year &&
        row.season.trim().toUpperCase() === currentSeason.season.toUpperCase() &&
        Number(row.year) === currentSeason.year,
    );

    const hasAudioTag = /\b(dub|dublado|dublada|legendado|legendada|audio dual|dual audio)\b/i.test(
      `${row.title ?? ""} ${row.titleRomaji ?? ""} ${row.titleEnglish ?? ""} ${row.titleNative ?? ""}`,
    );
    const baseTitleKey = normalizeTrendingBaseTitleKey(row);

    const watchId = resolveTrendingWatchId(row);
    if (!watchId) {
      if (hasAudioTag && baseTitleKey) {
        audioTaggedRowsForAliasResolution.push({
          row,
          baseTitleKey,
          hasAudioTag,
        });
      }
      continue;
    }

    const cleanCover = stripCatalogImageVersion(row.cover);
    if (!isValidTrendingCoverUrl(cleanCover)) continue;

    const isStubTitle =
      !row.title ||
      row.title.trim() === row.id ||
      (typeof row.anilistId === "number" &&
        row.title.trim() === String(row.anilistId));
    const romaji =
      row.titleRomaji?.trim() ||
      (!isStubTitle ? row.title.trim() : "") ||
      row.titleEnglish?.trim() ||
      row.titleNative?.trim() ||
      "Anime";

    const updatedAtMs = toTrendingTimestampMs(row.updatedAt);
    const latestEpisodePublishedAtMs = toTrendingTimestampMs(
      row.latestEpisodePublishedAt,
    );

    const slimAnime: SlimAnime = {
      id: watchId,
      anilistId: row.anilistId ?? undefined,
      malId: row.malId ?? undefined,
      kitsuId: row.kitsuId ?? undefined,
      titles: {
        romaji,
        english: row.titleEnglish?.trim() || "",
        native: row.titleNative?.trim() || "",
      },
      cover: cleanCover,
      banner: "",
      synopsis: "",
      score: row.score ?? null,
      popularity: row.popularity ?? null,
      genres: Array.isArray(row.genres) ? row.genres.filter(Boolean) : [],
      format: row.format?.trim() || "TV",
      status: row.status?.trim() || "FINISHED",
      episodesCount: hasPublishedPlayable
        ? (row.episodesCount ?? publishedCount)
        : (row.episodesCount ?? null),
      season: row.season?.trim() || null,
      year: row.year ?? null,
      trailerId: null,
      source: "local",
      catalogUpdatedAt: updatedAtMs || latestEpisodePublishedAtMs || undefined,
      serverCatalogId: row.id,
      hasEpisode: hasPublishedPlayable,
    };

    const rankRes = computeTrendingRankScore({
      status: row.status,
      score: row.score,
      popularity: row.popularity,
      trending: row.trending ?? null,
      latestEpisodePublishedAtMs,
      publishedEpisodeCount: publishedCount,
      hasPublishedPlayable,
      hasTodaySchedule: Boolean(row.hasTodayAiringSchedule),
      hasTodayRecurrence: Boolean(row.hasTodayWeeklyRecurrence),
      hasWeekSchedule: Boolean(row.hasWeekAiringSchedule),
      hasActiveRecurrence: Boolean(row.hasActiveWeeklyRecurrence),
      isCurrentSeason,
      nowMs,
    });

    parsedCandidates.push({
      row,
      watchId,
      isDubbed: isDubbedTrendingRow(row),
      hasAudioTag,
      baseTitleKey,
      slimAnime,
      latestEpisodePublishedAtMs,
      fallbackRankScore: rankRes.rankScore,
      calendarBoost: rankRes.calendarBoost,
      publishedEpisodeBoost: rankRes.publishedEpisodeBoost,
      seasonBoost: rankRes.seasonBoost,
    });
  }

  if (parsedCandidates.length === 0) {
    return [];
  }

  const parent = parsedCandidates.map((_, idx) => idx);
  const find = (i: number): number => {
    let cur = i;
    while (parent[cur] !== cur) {
      parent[cur] = parent[parent[cur]];
      cur = parent[cur];
    }
    return cur;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) {
      parent[rb] = ra;
    }
  };

  const extOwner = new Map<string, number>();
  const baseTitleCandidates = new Map<string, number[]>();

  for (let i = 0; i < parsedCandidates.length; i++) {
    const c = parsedCandidates[i];
    const extKeys: string[] = [`watch:${c.watchId}`];
    if (c.row.anilistId && c.row.anilistId > 0) {
      extKeys.push(`ani:${c.row.anilistId}`);
    }
    if (c.row.malId && c.row.malId > 0) {
      extKeys.push(`mal:${c.row.malId}`);
    }
    if (c.row.kitsuId && c.row.kitsuId > 0) {
      extKeys.push(`kitsu:${c.row.kitsuId}`);
    }

    for (const k of extKeys) {
      const existing = extOwner.get(k);
      if (existing !== undefined) {
        union(existing, i);
      } else {
        extOwner.set(k, i);
      }
    }

    if (c.baseTitleKey) {
      const list = baseTitleCandidates.get(c.baseTitleKey) ?? [];
      list.push(i);
      baseTitleCandidates.set(c.baseTitleKey, list);
    }
  }

  for (const indices of baseTitleCandidates.values()) {
    if (indices.length < 2) continue;
    for (let i = 0; i < indices.length; i++) {
      for (let j = i + 1; j < indices.length; j++) {
        const idxA = indices[i];
        const idxB = indices[j];
        const candA = parsedCandidates[idxA];
        const candB = parsedCandidates[idxB];
        if (!candA.hasAudioTag && !candB.hasAudioTag) continue;
        if (hasConflictingExternalIds(candA.row, candB.row)) continue;
        union(idxA, idxB);
      }
    }
  }

  const workGroups = new Map<string, ParsedTrendingCandidate[]>();
  const rootToWorkKey = new Map<number, string>();
  for (let i = 0; i < parsedCandidates.length; i++) {
    const root = find(i);
    let workKey = rootToWorkKey.get(root);
    if (!workKey) {
      workKey = `work:${parsedCandidates[root].watchId}:${root}`;
      rootToWorkKey.set(root, workKey);
    }
    const group = workGroups.get(workKey) ?? [];
    group.push(parsedCandidates[i]);
    workGroups.set(workKey, group);
  }

  const aliasToWorkKey = new Map<string, string>();
  const workPrimaryCandidate = new Map<string, ParsedTrendingCandidate>();

  for (const [workKey, group] of workGroups.entries()) {
    const sortedGroup = [...group].sort((a, b) => {
      if (a.isDubbed !== b.isDubbed) return a.isDubbed ? 1 : -1;
      const aDirect = a.row.id === a.watchId ? 1 : 0;
      const bDirect = b.row.id === b.watchId ? 1 : 0;
      if (aDirect !== bDirect) return bDirect - aDirect;
      if (a.row.publishedEpisodeCount !== b.row.publishedEpisodeCount) {
        return b.row.publishedEpisodeCount - a.row.publishedEpisodeCount;
      }
      return a.row.id.localeCompare(b.row.id);
    });
    const primary = sortedGroup[0];
    workPrimaryCandidate.set(workKey, primary);

    for (const member of group) {
      for (const alias of buildRowAliasKeys(member.row)) {
        if (!aliasToWorkKey.has(alias)) {
          aliasToWorkKey.set(alias, workKey);
        }
      }
      if (!aliasToWorkKey.has(member.watchId)) {
        aliasToWorkKey.set(member.watchId, workKey);
      }
    }
  }

  for (const extra of audioTaggedRowsForAliasResolution) {
    const candidateIndices = baseTitleCandidates.get(extra.baseTitleKey);
    if (!candidateIndices || candidateIndices.length === 0) continue;
    const matchIdx = candidateIndices.find(
      (idx) => !hasConflictingExternalIds(parsedCandidates[idx].row, extra.row),
    );
    if (matchIdx === undefined) continue;
    const workKey = rootToWorkKey.get(find(matchIdx));
    if (!workKey) continue;
    const cleanExtraId = extra.row.id?.trim();
    if (cleanExtraId && !aliasToWorkKey.has(cleanExtraId)) {
      aliasToWorkKey.set(cleanExtraId, workKey);
    }
  }

  const userSignalsByWork = new Map<
    string,
    Map<string, ConsolidatedUserWorkSignals>
  >();

  for (const sig of signals) {
    const cleanUserId = typeof sig?.userId === "string" ? sig.userId.trim() : "";
    const cleanAnimeId =
      typeof sig?.animeId === "string" ? sig.animeId.trim() : "";
    if (!cleanUserId || !cleanAnimeId) continue;

    const workKey = aliasToWorkKey.get(cleanAnimeId);
    if (!workKey) continue;

    const playbackMs = toTrendingTimestampMs(sig.playbackAt);
    const progressMs = toTrendingTimestampMs(sig.progressAt);
    const commentMs = toTrendingTimestampMs(sig.commentAt);
    // sig.manualAt é ignorado propositalmente: marcações manuais ("assistido") não geram sinal em Em Alta

    if (playbackMs <= 0 && progressMs <= 0 && commentMs <= 0) {
      continue;
    }

    let usersMap = userSignalsByWork.get(workKey);
    if (!usersMap) {
      usersMap = new Map<string, ConsolidatedUserWorkSignals>();
      userSignalsByWork.set(workKey, usersMap);
    }

    const existing = usersMap.get(cleanUserId);
    if (existing) {
      if (playbackMs > existing.playbackAtMs) existing.playbackAtMs = playbackMs;
      if (progressMs > existing.progressAtMs) existing.progressAtMs = progressMs;
      if (commentMs > existing.commentAtMs) existing.commentAtMs = commentMs;
    } else {
      usersMap.set(cleanUserId, {
        playbackAtMs: playbackMs,
        progressAtMs: progressMs,
        commentAtMs: commentMs,
      });
    }
  }

  const scored: ScoredTrendingItem[] = [];

  for (const [workKey, primary] of workPrimaryCandidate.entries()) {
    const group = workGroups.get(workKey) ?? [primary];
    const effectiveCalendarBoost = Math.max(
      ...group.map((g) => g.calendarBoost),
    );
    const effectivePublishedEpisodeBoost = Math.max(
      ...group.map((g) => g.publishedEpisodeBoost),
    );
    const effectiveSeasonBoost = Math.max(...group.map((g) => g.seasonBoost));

    const usersMap = userSignalsByWork.get(workKey);
    let audienceRaw = 0;
    let uniqueUsers = 0;
    let latestActivityMs = 0;

    if (usersMap) {
      for (const userSig of usersMap.values()) {
        const wPlayback = getSignalWeightForTimestamp(
          "playback",
          userSig.playbackAtMs,
          nowMs,
        );
        const wProgress = getSignalWeightForTimestamp(
          "progress",
          userSig.progressAtMs,
          nowMs,
        );
        const wComment = getSignalWeightForTimestamp(
          "comment",
          userSig.commentAtMs,
          nowMs,
        );

        const contribution = Math.max(wPlayback, wProgress, wComment);
        if (contribution <= 0) continue;

        audienceRaw += contribution;
        uniqueUsers += 1;

        const userLatestMs = Math.max(
          wPlayback > 0 ? userSig.playbackAtMs : 0,
          wProgress > 0 ? userSig.progressAtMs : 0,
          wComment > 0 ? userSig.commentAtMs : 0,
        );
        if (userLatestMs > latestActivityMs) {
          latestActivityMs = userLatestMs;
        }
      }
    }

    const audienceScore =
      audienceRaw > 0
        ? Math.round(Math.log1p(audienceRaw) * 40 * 1000) / 1000
        : 0;

    // Critério estrito: exige ao menos um sinal real (comunidade, calendário, episódio recente publicado ou popularidade da temporada atual).
    // Nunca preenche vagas com cadastros sem relevância.
    const totalRealSignal =
      audienceScore +
      effectiveCalendarBoost +
      effectivePublishedEpisodeBoost +
      effectiveSeasonBoost;
    if (totalRealSignal <= 0) {
      continue;
    }

    let editorialBoost = 0;
    if (audienceScore > 0) {
      const latestEpAgeDays =
        primary.latestEpisodePublishedAtMs > 0
          ? Math.max(0, (nowMs - primary.latestEpisodePublishedAtMs) / DAY_MS)
          : Infinity;
      const releasingRecentBoost =
        primary.row.status === "RELEASING" && latestEpAgeDays <= 7
          ? 2.0
          : primary.row.status === "RELEASING" && latestEpAgeDays <= 14
            ? 1.0
            : 0;
      const scoreTie = Math.min(
        1.0,
        Math.max(0, (primary.row.score ?? 0) * 0.01),
      );
      editorialBoost = Math.round((releasingRecentBoost + scoreTie) * 1000) / 1000;
    }

    scored.push({
      anime: primary.slimAnime,
      workKey,
      audienceRaw: Math.round(audienceRaw * 1000) / 1000,
      audienceScore,
      calendarBoost: effectiveCalendarBoost,
      publishedEpisodeBoost: effectivePublishedEpisodeBoost,
      seasonBoost: effectiveSeasonBoost,
      editorialBoost,
      fallbackRankScore: primary.fallbackRankScore,
      uniqueUsers,
      latestActivityMs,
      isFallbackFill: false,
    });
  }

  scored.sort((a, b) => {
    const aTotal =
      a.audienceScore +
      a.calendarBoost +
      a.publishedEpisodeBoost +
      a.seasonBoost +
      a.editorialBoost;
    const bTotal =
      b.audienceScore +
      b.calendarBoost +
      b.publishedEpisodeBoost +
      b.seasonBoost +
      b.editorialBoost;
    if (bTotal !== aTotal) return bTotal - aTotal;
    if (b.uniqueUsers !== a.uniqueUsers) return b.uniqueUsers - a.uniqueUsers;
    if (b.latestActivityMs !== a.latestActivityMs) {
      return b.latestActivityMs - a.latestActivityMs;
    }
    if (b.fallbackRankScore !== a.fallbackRankScore) {
      return b.fallbackRankScore - a.fallbackRankScore;
    }

    return a.anime.id.localeCompare(b.anime.id);
  });

  return scored;
}

export function buildHomeTrendingPayload(
  scored: ScoredTrendingItem[],
  nowMs = Date.now(),
  maxCacheItems = MAX_HOME_TRENDING_CACHE_ITEMS,
): HomeTrendingPayload {
  const seenIds = new Set<string>();
  const items: SlimAnime[] = [];

  for (const entry of scored) {
    if (items.length >= maxCacheItems) break;
    if (seenIds.has(entry.anime.id)) continue;
    seenIds.add(entry.anime.id);
    items.push(entry.anime);
  }

  return {
    v: 1,
    generatedAt: nowMs,
    items,
  };
}

let ramTrendingPayload: {
  payload: HomeTrendingPayload;
  timestamp: number;
} | null = null;
let staleTrendingPayload: HomeTrendingPayload | null = null;
let trendingInFlight: Promise<HomeTrendingPayload | null> | null = null;
let trendingEpoch = 0;

export function invalidateHomeTrendingLocalCache(): void {
  trendingEpoch += 1;
  ramTrendingPayload = null;
  trendingInFlight = null;
}

export function invalidateHomeTrendingCache(): void {
  invalidateHomeTrendingLocalCache();
  scheduleRedisBackgroundWrite(
    invalidateRedisHomeTrending(),
    "invalidateRedisHomeTrending",
  );
}

export function resetHomeTrendingTestState(): void {
  trendingEpoch = 0;
  ramTrendingPayload = null;
  staleTrendingPayload = null;
  trendingInFlight = null;
}

async function queryTrendingCatalogCandidatesFromNeon(): Promise<
  TrendingCatalogAnimeCandidateRow[]
> {
  const sql = await getSql();
  const todayRange = getTodayRangeSaoPaulo();
  const todayWeekday = getWeekdaySaoPaulo(todayRange.todayKey);
  const weekStartSec = todayRange.startTimestamp - 86400;
  const weekEndSec = todayRange.endTimestamp + 6 * 86400;
  const currentSeason = currentAnimeSeason();

  const rows = await sql.query<TrendingCatalogAnimeCandidateRow>(
    `WITH ep_stats AS (
       SELECT
         e."animeId",
         COUNT(*)::int AS "publishedEpisodeCount",
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
         BOOL_OR(s."airingAt" >= to_timestamp($1) AND s."airingAt" <= to_timestamp($2)) AS "hasTodayAiringSchedule",
         true AS "hasWeekAiringSchedule"
       FROM "catalog_airing_schedule" s
       WHERE s."airingAt" >= to_timestamp($3)
         AND s."airingAt" <= to_timestamp($4)
       GROUP BY s."animeId"
     ),
     recurrence_stats AS (
       SELECT
         r."animeId",
         BOOL_OR(r."dayOfWeek" = $5) AS "hasTodayWeeklyRecurrence",
         true AS "hasActiveWeeklyRecurrence"
       FROM "catalog_weekly_recurrence" r
       WHERE r."active" = true
         AND r."timezone" = $6
       GROUP BY r."animeId"
     ),
     recent_engagement_ids AS (
       SELECT DISTINCT p."animeId"
       FROM "user_episode_progress" p
       WHERE p."updatedAt" >= NOW() - INTERVAL '30 days'
         AND p."accumulatedTime" >= 60
       UNION
       SELECT DISTINCT w."animeId"
       FROM "user_watched_episode" w
       WHERE w."watchedAt" >= NOW() - INTERVAL '30 days'
         AND w."origin" = 'playback'
       UNION
       SELECT DISTINCT c."animeId"
       FROM "comment" c
       WHERE c."createdAt" >= NOW() - INTERVAL '30 days'
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
       a."format",
       a."status",
       a."episodesCount",
       a."year",
       a."season",
       a."genres",
       COALESCE(a."hidden", false) AS "hidden",
       a."score",
       a."popularity",
       a."trending",
       a."updatedAt",
       COALESCE(ep_stats."publishedEpisodeCount", 0)::int AS "publishedEpisodeCount",
       ep_stats."latestEpisodePublishedAt",
       ep_sample."epSources",
       COALESCE(airing_stats."hasTodayAiringSchedule", false) AS "hasTodayAiringSchedule",
       COALESCE(airing_stats."hasWeekAiringSchedule", false) AS "hasWeekAiringSchedule",
       COALESCE(recurrence_stats."hasTodayWeeklyRecurrence", false) AS "hasTodayWeeklyRecurrence",
       COALESCE(recurrence_stats."hasActiveWeeklyRecurrence", false) AS "hasActiveWeeklyRecurrence"
     FROM "catalog_anime" a
     LEFT JOIN ep_stats ON ep_stats."animeId" = a."id"
     LEFT JOIN airing_stats ON airing_stats."animeId" = a."id"
     LEFT JOIN recurrence_stats ON recurrence_stats."animeId" = a."id"
     LEFT JOIN LATERAL (
       SELECT JSONB_AGG(
         JSONB_BUILD_OBJECT(
           'videoUrl', s."videoUrl",
           'videoUrl2', s."videoUrl2",
           'videoUrl3', s."videoUrl3",
           'videoUrl4', s."videoUrl4",
           'videoUrl5', s."videoUrl5",
           'hikariPlayerEpisodeId', s."hikari_player_episode_id"
         )
       ) AS "epSources"
       FROM (
         SELECT
           e2."videoUrl",
           e2."videoUrl2",
           e2."videoUrl3",
           e2."videoUrl4",
           e2."videoUrl5",
           e2."hikari_player_episode_id"
         FROM "catalog_episode" e2
         WHERE e2."animeId" = a."id"
           AND e2."published" = true
           AND (
             (e2."videoUrl" IS NOT NULL AND BTRIM(e2."videoUrl") <> '' AND BTRIM(e2."videoUrl") <> '#')
             OR (e2."videoUrl2" IS NOT NULL AND BTRIM(e2."videoUrl2") <> '' AND BTRIM(e2."videoUrl2") <> '#')
             OR (e2."videoUrl3" IS NOT NULL AND BTRIM(e2."videoUrl3") <> '' AND BTRIM(e2."videoUrl3") <> '#')
             OR (e2."videoUrl4" IS NOT NULL AND BTRIM(e2."videoUrl4") <> '' AND BTRIM(e2."videoUrl4") <> '#')
             OR (e2."videoUrl5" IS NOT NULL AND BTRIM(e2."videoUrl5") <> '' AND BTRIM(e2."videoUrl5") <> '#')
             OR (e2."hikari_player_episode_id" IS NOT NULL AND BTRIM(e2."hikari_player_episode_id") <> '')
           )
         ORDER BY e2."seasonNumber" ASC, e2."number" ASC
         LIMIT 5
       ) s
     ) ep_sample ON ep_stats."publishedEpisodeCount" > 0
     WHERE COALESCE(a."hidden", false) = false
       AND a."archived_at" IS NULL
       AND NOT ('Hentai' = ANY(COALESCE(a."genres", '{}'::text[])))
       AND (
         (ep_stats."animeId" IS NOT NULL AND ep_stats."latestEpisodePublishedAt" >= NOW() - INTERVAL '21 days')
         OR airing_stats."animeId" IS NOT NULL
         OR recurrence_stats."animeId" IS NOT NULL
         OR (
           a."season" IS NOT NULL
           AND UPPER(BTRIM(a."season")) = $7
           AND a."year" = $8
           AND (
             COALESCE(a."popularity", 0) >= 3000
             OR COALESCE(a."trending", 0) >= 10
             OR COALESCE(a."score", 0) >= 72
           )
         )
         OR EXISTS (
           SELECT 1
           FROM recent_engagement_ids re
           WHERE re."animeId" = a."id"
             OR (a."anilistId" IS NOT NULL AND re."animeId" = a."anilistId"::text)
             OR (a."malId" IS NOT NULL AND re."animeId" = ('mal-' || a."malId"::text))
             OR (a."kitsuId" IS NOT NULL AND re."animeId" = ('kitsu-' || a."kitsuId"::text))
         )
       );`,
    [
      todayRange.startTimestamp,
      todayRange.endTimestamp,
      weekStartSec,
      weekEndSec,
      todayWeekday,
      CALENDAR_TIMEZONE,
      currentSeason.season.toUpperCase(),
      currentSeason.year,
    ],
  );

  return Array.isArray(rows) ? rows : [];
}

async function queryTrendingAudienceSignalsFromNeon(): Promise<
  TrendingUserAnimeSignalRow[]
> {
  try {
    const sql = await getSql();
    const rows = await sql.query<TrendingUserAnimeSignalRow>(
      `WITH raw_signals AS (
         SELECT
           w."userId",
           w."animeId",
           MAX(w."watchedAt") AS "playbackAt",
           NULL::timestamptz AS "progressAt",
           NULL::timestamptz AS "commentAt"
         FROM "user_watched_episode" w
         WHERE w."watchedAt" >= NOW() - INTERVAL '30 days'
           AND w."origin" = 'playback'
         GROUP BY w."userId", w."animeId"

         UNION ALL

         SELECT
           p."userId",
           p."animeId",
           NULL::timestamptz AS "playbackAt",
           MAX(p."updatedAt") AS "progressAt",
           NULL::timestamptz AS "commentAt"
         FROM "user_episode_progress" p
         WHERE p."updatedAt" >= NOW() - INTERVAL '30 days'
           AND p."accumulatedTime" >= 60
         GROUP BY p."userId", p."animeId"

         UNION ALL

         SELECT
           c."userId",
           c."animeId",
           NULL::timestamptz AS "playbackAt",
           NULL::timestamptz AS "progressAt",
           MAX(c."createdAt") AS "commentAt"
         FROM "comment" c
         WHERE c."createdAt" >= NOW() - INTERVAL '30 days'
         GROUP BY c."userId", c."animeId"
       )
       SELECT
         "userId",
         "animeId",
         MAX("playbackAt") AS "playbackAt",
         MAX("progressAt") AS "progressAt",
         MAX("commentAt") AS "commentAt"
       FROM raw_signals
       GROUP BY "userId", "animeId";`,
    );

    return Array.isArray(rows) ? rows : [];
  } catch (err) {
    console.warn(
      "[home-trending] Falha segura ao consultar sinais de audiência no Neon (continuando com catálogo):",
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}

export interface HomeTrendingDeps {
  getRedisTrending: () => Promise<RedisHomeTrendingReadResult>;
  setRedisTrending: (
    payload: HomeTrendingPayload,
    fence?: string | null,
  ) => Promise<RedisScopedWriteStatus>;
  scheduleWrite: (promise: Promise<unknown>, operation?: string) => void;
  queryCatalog: () => Promise<TrendingCatalogAnimeCandidateRow[]>;
  queryBadges: () => Promise<AnimeRecentBadgesLookup>;
  queryAudienceSignals: () => Promise<TrendingUserAnimeSignalRow[]>;
}

const defaultHomeTrendingDeps: HomeTrendingDeps = {
  getRedisTrending: () => getRedisHomeTrendingWithFence(),
  setRedisTrending: (payload, fence) => setRedisHomeTrending(payload, fence),
  scheduleWrite: scheduleRedisBackgroundWrite,
  queryCatalog: queryTrendingCatalogCandidatesFromNeon,
  queryBadges: async () => ({
    byId: new Map(),
    byAnilistId: new Map(),
    byMalId: new Map(),
    byKitsuId: new Map(),
  }),
  queryAudienceSignals: queryTrendingAudienceSignalsFromNeon,
};

export interface HomeTrendingResult {
  ok: boolean;
  items: SlimAnime[];
}

export async function getHomeTrendingPayloadWithDeps(
  deps: HomeTrendingDeps = defaultHomeTrendingDeps,
  nowMs = Date.now(),
): Promise<HomeTrendingPayload | null> {
  const currentDayKey = getTodayRangeSaoPaulo(new Date(nowMs)).todayKey;

  if (
    ramTrendingPayload &&
    nowMs - ramTrendingPayload.timestamp < TRENDING_RAM_CACHE_TTL_MS &&
    getTodayRangeSaoPaulo(new Date(ramTrendingPayload.payload.generatedAt)).todayKey ===
      currentDayKey
  ) {
    return ramTrendingPayload.payload;
  }

  if (trendingInFlight) {
    return trendingInFlight;
  }

  const requestEpoch = trendingEpoch;
  let flightRef: Promise<HomeTrendingPayload | null> | null = null;

  const currentFlight = (async (): Promise<HomeTrendingPayload | null> => {
    try {
      const redisRead = await deps.getRedisTrending();
      if (
        redisRead.status === "hit" &&
        redisRead.payload &&
        redisRead.payload.items.length > 0 &&
        getTodayRangeSaoPaulo(new Date(redisRead.payload.generatedAt)).todayKey ===
          currentDayKey
      ) {
        staleTrendingPayload = redisRead.payload;
        if (requestEpoch === trendingEpoch) {
          ramTrendingPayload = {
            payload: redisRead.payload,
            timestamp: Date.now(),
          };
        }
        return redisRead.payload;
      }

      const activeFence =
        redisRead.status === "miss"
          ? redisRead.fence
          : redisRead.status === "failed"
            ? null
            : undefined;

      const [catalogRows, badgesLookup, audienceSignals] = await Promise.all([
        deps.queryCatalog(),
        deps.queryBadges().catch(() => ({
          byId: new Map(),
          byAnilistId: new Map(),
          byMalId: new Map(),
          byKitsuId: new Map(),
        })),
        deps
          .queryAudienceSignals()
          .catch(() => [] as TrendingUserAnimeSignalRow[]),
      ]);

      const scored = scoreAndRankHomeTrending(
        catalogRows,
        badgesLookup,
        audienceSignals,
        nowMs,
      );

      if (scored.length === 0) {
        const emptyPayload: HomeTrendingPayload = {
          v: 1,
          generatedAt: nowMs,
          items: [],
        };
        if (requestEpoch === trendingEpoch) {
          ramTrendingPayload = {
            payload: emptyPayload,
            timestamp: Date.now(),
          };
        }
        return emptyPayload;
      }

      const payload = buildHomeTrendingPayload(
        scored,
        nowMs,
        MAX_HOME_TRENDING_CACHE_ITEMS,
      );

      staleTrendingPayload = payload;
      if (requestEpoch === trendingEpoch) {
        ramTrendingPayload = {
          payload,
          timestamp: Date.now(),
        };
        if (payload.items.length > 0) {
          deps.scheduleWrite(
            deps.setRedisTrending(payload, activeFence),
            "setRedisHomeTrending",
          );
        }
      }

      return payload;
    } catch (err) {
      console.warn(
        "[home-trending] Falha segura ao montar ranking Em Alta (usando reserva stale se disponível):",
        err instanceof Error ? err.message : err,
      );
      return staleTrendingPayload;
    } finally {
      if (trendingInFlight === flightRef) {
        trendingInFlight = null;
      }
    }
  })();

  flightRef = currentFlight;
  trendingInFlight = currentFlight;
  return currentFlight;
}

export async function getHomeTrendingItemsWithDeps(
  deps: HomeTrendingDeps = defaultHomeTrendingDeps,
  nowMs = Date.now(),
  maxItems = MAX_HOME_TRENDING_ITEMS,
): Promise<SlimAnime[]> {
  const payload = await getHomeTrendingPayloadWithDeps(deps, nowMs);
  if (!payload || !Array.isArray(payload.items) || payload.items.length === 0) {
    return [];
  }
  const safeLimit = Math.max(1, Math.min(maxItems, MAX_HOME_TRENDING_ITEMS));
  return payload.items.slice(0, safeLimit);
}

export async function getHomeTrendingResult(
  nowMs = Date.now(),
  maxItems = MAX_HOME_TRENDING_ITEMS,
): Promise<HomeTrendingResult> {
  const payload = await getHomeTrendingPayloadWithDeps(defaultHomeTrendingDeps, nowMs);
  if (!payload || !Array.isArray(payload.items)) {
    return { ok: false, items: [] };
  }
  const safeLimit = Math.max(1, Math.min(maxItems, MAX_HOME_TRENDING_ITEMS));
  return {
    ok: true,
    items: payload.items.slice(0, safeLimit),
  };
}

export async function getHomeTrendingItems(
  nowMs = Date.now(),
): Promise<SlimAnime[]> {
  return getHomeTrendingItemsWithDeps(
    defaultHomeTrendingDeps,
    nowMs,
    MAX_HOME_TRENDING_ITEMS,
  );
}
