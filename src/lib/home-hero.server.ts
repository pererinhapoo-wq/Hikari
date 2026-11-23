import { getSql } from "@/lib/db";
import type { AnimeRecentBadgesLookup } from "@/lib/catalog-badges";
import { buildHikariPlayerEpisodeUrl } from "@/lib/hikari-player";
import { stripCatalogImageVersion } from "@/lib/image-utils";
import { hasEpisodePlayableSource } from "@/lib/published-episodes";
import {
  getRedisHeroBannerPoolWithFence,
  invalidateRedisHeroBannerPool,
  scheduleRedisBackgroundWrite,
  setRedisHeroBannerPool,
  type HeroBannerBucket,
  type HeroBannerPoolItem,
  type HeroBannerPoolPayload,
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
  score: number | null;
  popularity: number | null;
  trending: number | null;
  createdAt: string | Date | null;
  updatedAt: string | Date | null;
  publishedEpisodeCount: number;
  firstEpisodePublishedAt: string | Date | null;
  latestEpisodePublishedAt: string | Date | null;
  ep1Sources: HeroEpisode1SourceRow[] | null;
}

export interface HeroAudienceRawRow {
  animeId: string;
  progUsers7d: number;
  progUsers14d: number;
  playbackUsers7d: number;
  playbackUsers14d: number;
  manualUsers14d: number;
  trackingUsers14d: number;
}

export interface HeroAudienceMetrics {
  progUsers7d: number;
  progUsers14d: number;
  playbackUsers7d: number;
  playbackUsers14d: number;
  manualUsers14d: number;
  trackingUsers14d: number;
}

export interface ScoredHeroCandidate {
  anime: SlimAnime;
  sourceId: string;
  anilistId: number | null;
  malId: number | null;
  kitsuId: number | null;
  isDubbed: boolean;
  hasDistinctBanner: boolean;
  titleKey: string;
  noveltyScore: number;
  newEpisodeScore: number;
  engagementScore: number;
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
 * Resolve um ID compatível com `/watch/$id/ep-1` e `/anime/$id` sem alterar essas rotas.
 * Registros `local-*` ou slugs customizados sem ID externo (`anilistId`/`malId`/`kitsuId`)
 * retornam `null` porque `/watch_.$id.$ep.tsx` retorna `{ remote: null, catalogEpisodes: null }`
 * para `local-*` e `fetchAnimeDetail` exige ID numérico, `mal-*` ou `kitsu-*`.
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

  return null;
}

export function isHeroEpisodeRowPlayable(ep: HeroEpisode1SourceRow | null | undefined): boolean {
  if (!ep || typeof ep !== "object") return false;
  if (hasEpisodePlayableSource(ep)) return true;
  return Boolean(buildHikariPlayerEpisodeUrl(ep.hikariPlayerEpisodeId));
}

function isNonStubHeroTitle(row: HeroCatalogAnimeCandidateRow): boolean {
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

export function reconcileAudienceMetricsForRow(
  row: Pick<HeroCatalogAnimeCandidateRow, "id" | "anilistId" | "malId" | "kitsuId">,
  audienceByKey: Map<string, HeroAudienceMetrics>,
): HeroAudienceMetrics {
  const keys = new Set<string>([row.id.trim()]);
  if (row.anilistId && row.anilistId > 0) keys.add(String(row.anilistId));
  if (row.malId && row.malId > 0) keys.add(`mal-${row.malId}`);
  if (row.kitsuId && row.kitsuId > 0) keys.add(`kitsu-${row.kitsuId}`);

  const agg: HeroAudienceMetrics = {
    progUsers7d: 0,
    progUsers14d: 0,
    playbackUsers7d: 0,
    playbackUsers14d: 0,
    manualUsers14d: 0,
    trackingUsers14d: 0,
  };

  for (const key of keys) {
    const m = audienceByKey.get(key);
    if (!m) continue;
    agg.progUsers7d += m.progUsers7d;
    agg.progUsers14d += m.progUsers14d;
    agg.playbackUsers7d += m.playbackUsers7d;
    agg.playbackUsers14d += m.playbackUsers14d;
    agg.manualUsers14d += m.manualUsers14d;
    agg.trackingUsers14d += m.trackingUsers14d;
  }

  return agg;
}

export function computeNoveltyScore(params: {
  animeCreatedAtMs: number;
  firstEpisodePublishedAtMs: number;
  publishedEpisodeCount: number;
  badges: { lancamento: boolean; novo: boolean; final: boolean } | null;
  nowMs: number;
}): number {
  const { animeCreatedAtMs, firstEpisodePublishedAtMs, publishedEpisodeCount, nowMs } =
    params;

  const createdDays =
    animeCreatedAtMs > 0 ? Math.max(0, (nowMs - animeCreatedAtMs) / DAY_MS) : Infinity;
  const firstEpDays =
    firstEpisodePublishedAtMs > 0
      ? Math.max(0, (nowMs - firstEpisodePublishedAtMs) / DAY_MS)
      : Infinity;

  // Distingue um anime recém-chegado ao Hikari de um título antigo que recebeu novo episódio:
  // Só usa firstEpisodePublishedAt se a estreia do primeiro episódio for recente e não for um
  // catálogo histórico antigo com dezenas de episódios publicados há muito tempo.
  let effectiveAgeDays = createdDays;
  if (firstEpDays <= NOVELTY_TAIL_DAYS && publishedEpisodeCount <= 26) {
    effectiveAgeDays = Math.min(createdDays, firstEpDays);
  } else if (firstEpDays > NOVELTY_TAIL_DAYS && createdDays > NOVELTY_WINDOW_DAYS) {
    effectiveAgeDays = firstEpDays;
  }

  let baseScore = 0;
  if (effectiveAgeDays <= NOVELTY_WINDOW_DAYS) {
    baseScore = 110 * Math.exp(-effectiveAgeDays / 12);
  } else if (effectiveAgeDays <= NOVELTY_TAIL_DAYS) {
    const tailRatio =
      (NOVELTY_TAIL_DAYS - effectiveAgeDays) / (NOVELTY_TAIL_DAYS - NOVELTY_WINDOW_DAYS);
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

export function computeEngagementScore(metrics: HeroAudienceMetrics): number {
  const weighted =
    metrics.progUsers7d * 3.0 +
    Math.max(0, metrics.progUsers14d - metrics.progUsers7d) * 1.4 +
    metrics.playbackUsers7d * 3.5 +
    Math.max(0, metrics.playbackUsers14d - metrics.playbackUsers7d) * 1.6 +
    metrics.manualUsers14d * 0.65 +
    metrics.trackingUsers14d * 1.1;

  if (weighted <= 0) return 0;
  return Math.round(Math.log1p(weighted) * 32 * 100) / 100;
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

export function scoreAndDeduplicateHeroCandidates(
  rows: HeroCatalogAnimeCandidateRow[],
  _badgesLookup: AnimeRecentBadgesLookup,
  audienceByKey: Map<string, HeroAudienceMetrics>,
  nowMs: number,
): ScoredHeroCandidate[] {
  const candidates: ScoredHeroCandidate[] = [];

  for (const row of rows) {
    if (!row || row.hidden === true) continue;
    if (isAdultHeroCandidate(row.genres)) continue;
    if (!isNonStubHeroTitle(row)) continue;
    if (!row.publishedEpisodeCount || row.publishedEpisodeCount < 1) continue;

    const ep1List = Array.isArray(row.ep1Sources) ? row.ep1Sources : [];
    const hasPlayableEp1 = ep1List.some((ep1) => isHeroEpisodeRowPlayable(ep1));
    if (!hasPlayableEp1) continue;

    const watchId = resolveHeroWatchId(row);
    if (!watchId) continue;

    const cleanCover = stripCatalogImageVersion(row.cover);
    const cleanBanner = stripCatalogImageVersion(row.banner);
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
      "Anime";

    const animeCreatedAtMs = toHeroTimestampMs(row.createdAt);
    const firstEpisodePublishedAtMs = toHeroTimestampMs(row.firstEpisodePublishedAt);
    const latestEpisodePublishedAtMs = toHeroTimestampMs(row.latestEpisodePublishedAt);
    const animeUpdatedAtMs = toHeroTimestampMs(row.updatedAt);

    const noveltyScore = computeNoveltyScore({
      animeCreatedAtMs,
      firstEpisodePublishedAtMs,
      publishedEpisodeCount: row.publishedEpisodeCount,
      badges: null,
      nowMs,
    });
    const newEpisodeScore = computeNewEpisodeScore({
      latestEpisodePublishedAtMs,
      status: row.status,
      score: row.score,
      nowMs,
    });
    const audienceMetrics = reconcileAudienceMetricsForRow(row, audienceByKey);
    const engagementScore = computeEngagementScore(audienceMetrics);
    const evergreenScore = computeEvergreenScore({
      score: row.score,
      popularity: row.popularity,
      status: row.status,
      latestEpisodePublishedAtMs,
      nowMs,
    });

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
      cover: cleanCover || cleanBanner,
      banner: cleanBanner || "",
      synopsis: row.synopsis?.trim() || "",
      score: row.score ?? null,
      popularity: row.popularity ?? null,
      genres: Array.isArray(row.genres) ? row.genres.filter(Boolean) : [],
      format: row.format?.trim() || "TV",
      status: row.status?.trim() || "FINISHED",
      episodesCount: row.episodesCount ?? row.publishedEpisodeCount,
      season: row.season?.trim() || null,
      year: row.year ?? null,
      trailerId: row.trailerId?.trim() || null,
      source: "local",
      catalogUpdatedAt: animeUpdatedAtMs || latestEpisodePublishedAtMs || undefined,
      serverCatalogId: row.id,
      hasEpisode: true,
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
      titleKey,
      noveltyScore,
      newEpisodeScore,
      engagementScore,
      evergreenScore,
    });
  }

  // Deduplicação preferindo banner horizontal próprio, versão original (não dublada) e maior pontuação
  const bestRankKey = (c: ScoredHeroCandidate): number =>
    (c.hasDistinctBanner ? 100000 : 0) +
    (!c.isDubbed ? 10000 : 0) +
    Math.max(c.noveltyScore, c.newEpisodeScore, c.engagementScore, c.evergreenScore);

  const sortedForDedup = [...candidates].sort((a, b) => bestRankKey(b) - bestRankKey(a));
  const deduped: ScoredHeroCandidate[] = [];
  const seenKeys = new Set<string>();

  for (const c of sortedForDedup) {
    const keys = [
      `id:${c.anime.id}`,
      ...(c.anilistId && c.anilistId > 0 ? [`ani:${c.anilistId}`] : []),
      ...(c.malId && c.malId > 0 ? [`mal:${c.malId}`] : []),
      ...(c.kitsuId && c.kitsuId > 0 ? [`kitsu:${c.kitsuId}`] : []),
      ...(c.titleKey ? [`title:${c.titleKey}`] : []),
    ];

    if (keys.some((k) => seenKeys.has(k))) {
      continue;
    }

    for (const k of keys) seenKeys.add(k);
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

    const addFromBucket = (
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
        if (bucket !== "preenchimento" && score <= 0) continue;

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

    addFromBucket("novidade", tierCandidates, (c) => c.noveltyScore, 6);
    addFromBucket("episodio_novo", tierCandidates, (c) => c.newEpisodeScore, 8);
    addFromBucket("engajamento", tierCandidates, (c) => c.engagementScore, 8);
    addFromBucket("preenchimento", tierCandidates, (c) => c.evergreenScore, MAX_HERO_POOL_SIZE);
  };

  // Tier 1: Animes com banner horizontal próprio (sempre priorizados)
  populateTier(candidates.filter((c) => c.hasDistinctBanner));
  // Tier 2: Animes apenas com capa vertical (fallback estritamente secundário)
  if (poolItems.length < MAX_HERO_POOL_SIZE) {
    populateTier(candidates.filter((c) => !c.hasDistinctBanner));
  }

  return {
    v: 1,
    generatedAt: nowMs,
    items: poolItems,
  };
}

function pickRotatedFromBucket(
  bucketItems: HeroBannerPoolItem[],
  count: number,
  windowIndex: number,
  usedIds: Set<string>,
  usedTitleKeys: Set<string>,
): HeroBannerPoolItem[] {
  if (bucketItems.length === 0 || count <= 0) return [];
  const picked: HeroBannerPoolItem[] = [];
  const len = bucketItems.length;
  const start = ((windowIndex % len) + len) % len;

  for (let i = 0; i < len && picked.length < count; i++) {
    const item = bucketItems[(start + i) % len];
    if (usedIds.has(item.anime.id)) continue;
    if (item.titleKey && usedTitleKeys.has(item.titleKey)) continue;
    usedIds.add(item.anime.id);
    if (item.titleKey) usedTitleKeys.add(item.titleKey);
    picked.push(item);
  }

  return picked;
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

  const selected: HeroBannerPoolItem[] = [];
  const usedIds = new Set<string>();
  const usedTitleKeys = new Set<string>();

  const fillFromTier = (tierItems: HeroBannerPoolItem[]) => {
    if (tierItems.length === 0 || selected.length >= targetMax) return;

    const nov = tierItems.filter((i) => i.bucket === "novidade");
    const ep = tierItems.filter((i) => i.bucket === "episodio_novo");
    const eng = tierItems.filter((i) => i.bucket === "engajamento");
    const fill = tierItems.filter((i) => i.bucket === "preenchimento");

    // Quotas equilibradas: ~2 novidades, 2-3 episódios novos, 2-3 engajamento, restante preenchimento
    const novTarget = Math.min(2, targetMax - selected.length);
    selected.push(...pickRotatedFromBucket(nov, novTarget, windowIndex, usedIds, usedTitleKeys));

    const epTarget = Math.min(nov.length > 0 ? 3 : 3, targetMax - selected.length);
    selected.push(...pickRotatedFromBucket(ep, epTarget, windowIndex, usedIds, usedTitleKeys));

    const engTarget = Math.min(
      selected.filter((s) => s.bucket === "novidade").length < 2 ? 3 : 2,
      targetMax - selected.length,
    );
    selected.push(...pickRotatedFromBucket(eng, engTarget, windowIndex, usedIds, usedTitleKeys));

    if (selected.length < targetMax) {
      selected.push(
        ...pickRotatedFromBucket(
          fill,
          targetMax - selected.length,
          windowIndex,
          usedIds,
          usedTitleKeys,
        ),
      );
    }

    // Se algum bucket foi menor que sua cota, completa com o restante deste tier (respeitando rotação)
    if (selected.length < targetMax) {
      selected.push(
        ...pickRotatedFromBucket(
          tierItems,
          targetMax - selected.length,
          windowIndex,
          usedIds,
          usedTitleKeys,
        ),
      );
    }
  };

  // Regra estrita: esgota todos os candidatos com banner horizontal próprio antes de recorrer a cover-only
  fillFromTier(pool.items.filter((i) => i.hasDistinctBanner));
  if (selected.length < targetMax) {
    fillFromTier(pool.items.filter((i) => !i.hasDistinctBanner));
  }

  return selected.slice(0, targetMax).map((item) => item.anime);
}

// Estado do cache local em memória (processo Node / Serverless)
let ramHeroPool: { payload: HeroBannerPoolPayload; timestamp: number } | null = null;
let staleHeroPool: HeroBannerPoolPayload | null = null;
let heroPoolInFlight: Promise<HeroBannerPoolPayload | null> | null = null;
let heroPoolEpoch = 0;

export function invalidateHomeHeroLocalCache(): void {
  heroPoolEpoch += 1;
  ramHeroPool = null;
  heroPoolInFlight = null;
}

export function invalidateHomeHeroCache(): void {
  invalidateHomeHeroLocalCache();
  void invalidateRedisHeroBannerPool().catch(() => {});
}

export function resetHomeHeroTestState(): void {
  heroPoolEpoch = 0;
  ramHeroPool = null;
  staleHeroPool = null;
  heroPoolInFlight = null;
}

async function queryCatalogCandidatesFromNeon(): Promise<HeroCatalogAnimeCandidateRow[]> {
  const sql = await getSql();
  const rows = await sql.query<HeroCatalogAnimeCandidateRow>(
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
       COALESCE(a."hidden", false) AS "hidden",
       a."score",
       a."popularity",
       a."trending",
       a."createdAt",
       a."updatedAt",
       ep_stats."publishedEpisodeCount",
       ep_stats."firstEpisodePublishedAt",
       ep_stats."latestEpisodePublishedAt",
       ep1."ep1Sources"
     FROM "catalog_anime" a
     INNER JOIN (
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
     ) ep_stats ON ep_stats."animeId" = a."id"
     INNER JOIN LATERAL (
       SELECT JSONB_AGG(
         JSONB_BUILD_OBJECT(
           'videoUrl', e1."videoUrl",
           'videoUrl2', e1."videoUrl2",
           'videoUrl3', e1."videoUrl3",
           'videoUrl4', e1."videoUrl4",
           'videoUrl5', e1."videoUrl5",
           'hikariPlayerEpisodeId', e1."hikari_player_episode_id"
         )
       ) AS "ep1Sources"
       FROM "catalog_episode" e1
       WHERE e1."animeId" = a."id"
         AND e1."published" = true
         AND e1."number" = 1
     ) ep1 ON ep1."ep1Sources" IS NOT NULL
     WHERE COALESCE(a."hidden", false) = false
       AND NOT ('Hentai' = ANY(COALESCE(a."genres", '{}'::text[])));`,
  );

  return Array.isArray(rows) ? rows : [];
}

async function queryAudienceMetricsFromNeon(): Promise<Map<string, HeroAudienceMetrics>> {
  const byAnimeId = new Map<string, HeroAudienceMetrics>();
  try {
    const sql = await getSql();
    const rows = await sql.query<HeroAudienceRawRow>(
      `WITH prog AS (
         SELECT
           p."animeId",
           COUNT(DISTINCT p."userId") FILTER (WHERE p."updatedAt" >= NOW() - INTERVAL '7 days')::int AS "progUsers7d",
           COUNT(DISTINCT p."userId")::int AS "progUsers14d"
         FROM "user_episode_progress" p
         WHERE p."updatedAt" >= NOW() - INTERVAL '14 days'
           AND p."accumulatedTime" >= 60
         GROUP BY p."animeId"
       ),
       watched AS (
         SELECT
           w."animeId",
           COUNT(DISTINCT w."userId") FILTER (WHERE w."origin" = 'playback' AND w."watchedAt" >= NOW() - INTERVAL '7 days')::int AS "playbackUsers7d",
           COUNT(DISTINCT w."userId") FILTER (WHERE w."origin" = 'playback')::int AS "playbackUsers14d",
           COUNT(DISTINCT w."userId") FILTER (WHERE w."origin" = 'manual')::int AS "manualUsers14d"
         FROM "user_watched_episode" w
         WHERE w."watchedAt" >= NOW() - INTERVAL '14 days'
         GROUP BY w."animeId"
       ),
       tracking AS (
         SELECT
           t."animeId",
           COUNT(DISTINCT t."userId")::int AS "trackingUsers14d"
         FROM "user_anime_tracking" t
         WHERE t."updatedAt" >= NOW() - INTERVAL '14 days'
           AND t."status" = 'watching'
           AND t."episodesWatched" >= 1
         GROUP BY t."animeId"
       )
       SELECT
         COALESCE(prog."animeId", watched."animeId", tracking."animeId") AS "animeId",
         COALESCE(prog."progUsers7d", 0)::int AS "progUsers7d",
         COALESCE(prog."progUsers14d", 0)::int AS "progUsers14d",
         COALESCE(watched."playbackUsers7d", 0)::int AS "playbackUsers7d",
         COALESCE(watched."playbackUsers14d", 0)::int AS "playbackUsers14d",
         COALESCE(watched."manualUsers14d", 0)::int AS "manualUsers14d",
         COALESCE(tracking."trackingUsers14d", 0)::int AS "trackingUsers14d"
       FROM prog
       FULL OUTER JOIN watched ON watched."animeId" = prog."animeId"
       FULL OUTER JOIN tracking ON tracking."animeId" = COALESCE(prog."animeId", watched."animeId");`,
    );

    for (const row of rows ?? []) {
      const id = row?.animeId?.trim();
      if (!id) continue;
      byAnimeId.set(id, {
        progUsers7d: Number(row.progUsers7d) || 0,
        progUsers14d: Number(row.progUsers14d) || 0,
        playbackUsers7d: Number(row.playbackUsers7d) || 0,
        playbackUsers14d: Number(row.playbackUsers14d) || 0,
        manualUsers14d: Number(row.manualUsers14d) || 0,
        trackingUsers14d: Number(row.trackingUsers14d) || 0,
      });
    }
  } catch (err) {
    console.warn(
      "[home-hero] Falha segura ao consultar métricas de audiência (continuando sem audiência):",
      err instanceof Error ? err.message : err,
    );
  }
  return byAnimeId;
}

export interface HomeHeroDeps {
  getRedisPool: () => Promise<RedisHeroBannerPoolReadResult>;
  setRedisPool: (
    payload: HeroBannerPoolPayload,
    fence?: string | null,
  ) => Promise<RedisScopedWriteStatus>;
  scheduleWrite: (promise: Promise<unknown>, operation?: string) => void;
  queryCatalog: () => Promise<HeroCatalogAnimeCandidateRow[]>;
  queryBadges: () => Promise<AnimeRecentBadgesLookup>;
  queryAudience: () => Promise<Map<string, HeroAudienceMetrics>>;
}

const defaultHomeHeroDeps: HomeHeroDeps = {
  getRedisPool: () => getRedisHeroBannerPoolWithFence(),
  setRedisPool: (payload, fence) => setRedisHeroBannerPool(payload, fence),
  scheduleWrite: scheduleRedisBackgroundWrite,
  queryCatalog: queryCatalogCandidatesFromNeon,
  queryBadges: async () => ({
    byId: new Map(),
    byAnilistId: new Map(),
    byMalId: new Map(),
    byKitsuId: new Map(),
  }),
  queryAudience: queryAudienceMetricsFromNeon,
};

export async function getHomeHeroPoolWithDeps(
  deps: HomeHeroDeps = defaultHomeHeroDeps,
  nowMs = Date.now(),
): Promise<HeroBannerPoolPayload | null> {
  // 1. Cache quente em memória RAM
  if (ramHeroPool && nowMs - ramHeroPool.timestamp < HERO_RAM_CACHE_TTL_MS) {
    return ramHeroPool.payload;
  }

  // 2. Coalescing de requisições concorrentes (singleflight)
  if (heroPoolInFlight) {
    return heroPoolInFlight;
  }

  const requestEpoch = heroPoolEpoch;
  let flightRef: Promise<HeroBannerPoolPayload | null> | null = null;

  const currentFlight = (async (): Promise<HeroBannerPoolPayload | null> => {
    try {
      // 3. Consulta Upstash Redis antes de ir ao Neon
      const redisRead = await deps.getRedisPool();
      if (redisRead.status === "hit" && redisRead.payload && redisRead.payload.items.length > 0) {
        staleHeroPool = redisRead.payload;
        if (requestEpoch === heroPoolEpoch) {
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

      // 4. Miss no Redis/RAM: consulta Neon (catálogo, badges em cache e audiência agregada)
      const [catalogRows, badgesLookup, audienceByKey] = await Promise.all([
        deps.queryCatalog(),
        deps.queryBadges().catch(() => ({
          byId: new Map(),
          byAnilistId: new Map(),
          byMalId: new Map(),
          byKitsuId: new Map(),
        })),
        deps.queryAudience().catch(() => new Map<string, HeroAudienceMetrics>()),
      ]);

      const scored = scoreAndDeduplicateHeroCandidates(
        catalogRows,
        badgesLookup,
        audienceByKey,
        nowMs,
      );

      if (scored.length === 0) {
        return staleHeroPool;
      }

      const pool = buildHeroBannerPool(scored, nowMs);
      if (pool.items.length === 0) {
        return staleHeroPool;
      }

      staleHeroPool = pool;
      if (requestEpoch === heroPoolEpoch) {
        ramHeroPool = { payload: pool, timestamp: Date.now() };
        deps.scheduleWrite(deps.setRedisPool(pool, activeFence), "setRedisHeroBannerPool");
      }

      return pool;
    } catch (err) {
      console.warn(
        "[home-hero] Falha segura ao montar pool dinâmico do Hero (usando reserva stale se disponível):",
        err instanceof Error ? err.message : err,
      );
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
): Promise<SlimAnime[]> {
  const pool = await getHomeHeroPoolWithDeps(deps, nowMs);
  return selectHeroSlidesForWindow(pool, nowMs, MAX_HERO_SLIDES);
}

export async function getHomeHeroItems(nowMs = Date.now()): Promise<SlimAnime[]> {
  return getHomeHeroItemsWithDeps(defaultHomeHeroDeps, nowMs);
}
