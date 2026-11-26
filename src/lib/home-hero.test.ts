import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildHeroBannerPool,
  computeCalendarScore,
  computeNewEpisodeScore,
  computeNoveltyScore,
  getHomeHeroItemsWithDeps,
  invalidateHomeHeroCacheAsync,
  invalidateHomeHeroLocalCache,
  MAX_HERO_POOL_SIZE,
  MAX_HERO_SLIDES,
  HERO_ROTATION_WINDOW_MS,
  resetHomeHeroTestState,
  scoreAndDeduplicateHeroCandidates,
  selectHeroSlidesForWindow,
  type HeroCatalogAnimeCandidateRow,
  type HomeHeroDeps,
} from "@/lib/home-hero.server";
import {
  getHomeTrendingItemsWithDeps,
  invalidateHomeTrendingCacheAsync,
  invalidateHomeTrendingLocalCache,
  resetHomeTrendingTestState,
  type HomeTrendingDeps,
} from "@/lib/home-trending.server";
import { invalidateHomePublicEpisodesCacheAsync } from "@/lib/home-episodes";
import { pickHeroItems } from "@/lib/home-hero-fallback";
import type { AnimeRecentBadgesLookup } from "@/lib/catalog-badges";
import type { SlimAnime } from "@/lib/types";
import {
  HERO_BANNER_PAYLOAD_VERSION,
  HOME_TRENDING_PAYLOAD_VERSION,
  getRedisHeroBannerPoolWithFence,
  getRedisHomeTrendingWithFence,
  HERO_BANNER_GEN_KEY,
  HERO_BANNER_REDIS_KEY,
  getHeroRedisKey,
  getHeroGenKey,
  getHomeTrendingRedisKey,
  getHomeTrendingGenKey,
  invalidateRedisHeroBannerPool,
  resolveHeroEnvironmentName,
  setRedisHeroBannerPool,
  setRedisHomeTrending,
  type HeroBannerPoolPayload,
  type RedisEvalClient,
} from "@/lib/redis";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

function makeCandidateRow(
  overrides: Partial<HeroCatalogAnimeCandidateRow> & { id: string },
  nowMs = Date.UTC(2026, 4, 15, 12, 0, 0),
): HeroCatalogAnimeCandidateRow {
  const numId = /^\d+$/.test(overrides.id) ? Number(overrides.id) : null;
  return {
    title: `Anime ${overrides.id}`,
    anilistId: numId,
    malId: null,
    kitsuId: null,
    titleRomaji: `Anime ${overrides.id}`,
    titleEnglish: `Anime ${overrides.id} EN`,
    titleNative: null,
    cover: `https://cdn.example.com/cover-${overrides.id}.jpg`,
    banner: `https://cdn.example.com/banner-${overrides.id}.jpg`,
    synopsis: "Sinopse de teste válida.",
    format: "TV",
    status: "RELEASING",
    episodesCount: 12,
    year: 2026,
    season: "SPRING",
    genres: ["Action", "Fantasy"],
    trailerId: null,
    hidden: false,
    archivedAt: null,
    score: 82,
    popularity: 50000,
    trending: 1000,
    createdAt: new Date(nowMs - 45 * DAY_MS).toISOString(),
    updatedAt: new Date(nowMs - 40 * DAY_MS).toISOString(),
    publishedEpisodeCount: 6,
    firstEpisodePublishedAt: new Date(nowMs - 44 * DAY_MS).toISOString(),
    latestEpisodePublishedAt: new Date(nowMs - 20 * DAY_MS).toISOString(),
    ep1Sources: [{ videoUrl: `https://cdn.example.com/ep1-${overrides.id}.mp4` }],
    hasTodayAiringSchedule: false,
    hasTodayWeeklyRecurrence: false,
    ...overrides,
  };
}

function makeTrendingSlim(
  overrides: Partial<SlimAnime> & { id: string },
): SlimAnime {
  return {
    titles: {
      romaji: overrides.titles?.romaji ?? `Trending ${overrides.id}`,
      english: overrides.titles?.english ?? `Trending ${overrides.id} EN`,
      native: overrides.titles?.native ?? "",
    },
    cover: overrides.cover ?? `https://cdn.example.com/cover-${overrides.id}.jpg`,
    banner: overrides.banner ?? "",
    synopsis: overrides.synopsis ?? "",
    score: overrides.score ?? 85,
    popularity: overrides.popularity ?? 75000,
    genres: overrides.genres ?? ["Action"],
    format: overrides.format ?? "TV",
    status: overrides.status ?? "RELEASING",
    episodesCount: overrides.episodesCount ?? 12,
    season: overrides.season ?? "SPRING",
    year: overrides.year ?? 2026,
    trailerId: overrides.trailerId ?? null,
    source: overrides.source ?? "local",
    hasEpisode: overrides.hasEpisode ?? false,
    ...overrides,
  };
}

class MockHeroRedis implements RedisEvalClient {
  store = new Map<string, string>();
  shouldThrow = false;

  private incr(key: string): number {
    const next = (Number(this.store.get(key) ?? "0") || 0) + 1;
    this.store.set(key, String(next));
    return next;
  }

  async eval<TArgs extends unknown[], TData = unknown>(
    script: string,
    keys: string[],
    args: TArgs,
  ): Promise<TData> {
    if (this.shouldThrow) {
      throw new Error("Simulated Redis outage");
    }
    const strArgs = (args ?? []).map((a) => String(a));

    // GET_ENVELOPE_OR_FENCE_SCRIPT
    if (script.includes('redis.call("GET", KEYS[1])') && script.includes("out = { v")) {
      const v = this.store.get(keys[0]) ?? null;
      const g = this.store.get(keys[1]) ?? "0";
      return [v ? `:${v}` : "", `:${g}`] as TData;
    }

    // SET_ENVELOPE_WITH_FENCE_SCRIPT
    if (script.includes("currentGen ~= tostring(ARGV[i + 1])")) {
      for (let i = 1; i < keys.length; i++) {
        const curGen = this.store.get(keys[i]) ?? "0";
        const expectedGen = strArgs[i + 1];
        if (curGen !== expectedGen) {
          return ["fenced"] as TData;
        }
      }
      this.store.set(keys[0], strArgs[0]);
      return ["inserted"] as TData;
    }

    // INVALIDATE_IDS_SCRIPT
    if (script.includes("tonumber(ARGV[1])") && script.includes('redis.call("DEL"')) {
      const n = Number(strArgs[0] ?? 0) || 0;
      for (let i = 0; i < n; i++) {
        this.incr(keys[i]);
      }
      for (let i = n; i < keys.length; i++) {
        this.store.delete(keys[i]);
      }
      return n as TData;
    }

    throw new Error("Unsupported script in MockHeroRedis");
  }

  async keys(pattern: string): Promise<string[]> {
    if (this.shouldThrow) throw new Error("Simulated Redis outage");
    const prefix = pattern.endsWith("*") ? pattern.slice(0, -1) : pattern;
    return Array.from(this.store.keys()).filter((k) =>
      pattern.endsWith("*") ? k.startsWith(prefix) : k === pattern,
    );
  }

  async del(...keys: string[]): Promise<number> {
    if (this.shouldThrow) throw new Error("Simulated Redis outage");
    let removed = 0;
    for (const k of keys) {
      if (this.store.delete(k)) removed += 1;
    }
    return removed;
  }
}

describe("home-hero Calendar + Em Alta composition, daily rollover, rotation & cache invalidation", () => {
  beforeEach(() => {
    resetHomeHeroTestState();
    resetHomeTrendingTestState();
  });

  it("1. includes Em Alta animes from getHomeTrendingItems and enriches banner/synopsis/trailerId from catalog", async () => {
    const nowMs = Date.UTC(2026, 4, 15, 12, 0, 0);
    const emptyBadges: AnimeRecentBadgesLookup = {
      byId: new Map(),
      byAnilistId: new Map(),
      byMalId: new Map(),
      byKitsuId: new Map(),
    };

    // Produz Em Alta real via getHomeTrendingItemsWithDeps (que zera banner/synopsis/trailerId no SlimAnime)
    const trendingDeps: HomeTrendingDeps = {
      getRedisTrending: async () => ({ status: "unavailable", payload: null, fence: null }),
      setRedisTrending: async () => "unavailable",
      scheduleWrite: () => {},
      queryCatalog: async () => [
        {
          id: "210001",
          title: "Em Alta Sem Ep",
          anilistId: 210001,
          malId: null,
          kitsuId: null,
          titleRomaji: "Em Alta Sem Ep",
          titleEnglish: "Trending Without Ep",
          titleNative: null,
          cover: "https://cdn.example.com/cover-210001.jpg",
          format: "TV",
          status: "RELEASING",
          episodesCount: 12,
          year: 2026,
          season: "SPRING",
          genres: ["Action"],
          hidden: false,
          score: 88,
          popularity: 90000,
          trending: 1500,
          updatedAt: new Date(nowMs - HOUR_MS).toISOString(),
          publishedEpisodeCount: 0,
          latestEpisodePublishedAt: null,
          epSources: [],
          hasTodayAiringSchedule: true,
          hasWeekAiringSchedule: true,
        },
      ],
      queryBadges: async () => emptyBadges,
      queryAudienceSignals: async () => [
        {
          userId: "u-1",
          animeId: "210001",
          playbackAt: new Date(nowMs - 2 * HOUR_MS).toISOString(),
          progressAt: null,
          commentAt: null,
        },
      ],
    };

    const trendingItems = await getHomeTrendingItemsWithDeps(trendingDeps, nowMs);
    assert.equal(trendingItems.length, 1);
    assert.equal(trendingItems[0].banner, "");

    const heroItems = await getHomeHeroItemsWithDeps(
      {
        getRedisPool: async () => ({ status: "unavailable", payload: null, fence: null }),
        setRedisPool: async () => "unavailable",
        scheduleWrite: () => {},
        getTrendingItems: async () => trendingItems,
        queryCatalog: async () => [
          makeCandidateRow(
            {
              id: "210001",
              title: "Em Alta Sem Ep",
              titleRomaji: "Em Alta Sem Ep",
              banner: "https://cdn.example.com/banner-210001.jpg",
              synopsis: "Sinopse completa enriquecida no Hero.",
              trailerId: "yt_210001",
              publishedEpisodeCount: 0,
              firstEpisodePublishedAt: null,
              latestEpisodePublishedAt: null,
              ep1Sources: [],
              epSources: [],
            },
            nowMs,
          ),
        ],
      },
      nowMs,
    );

    assert.equal(heroItems.length, 1);
    assert.equal(heroItems[0].id, "210001");
    assert.equal(heroItems[0].banner, "https://cdn.example.com/banner-210001.jpg");
    assert.equal(heroItems[0].synopsis, "Sinopse completa enriquecida no Hero.");
    assert.equal(heroItems[0].trailerId, "yt_210001");
    assert.equal(heroItems[0].hasEpisode, false);
  });

  it("2. includes Calendar-today animes (airing schedule and weekly recurrence, with or without episodes) and preserves playable metadata", () => {
    const nowMs = Date.UTC(2026, 4, 15, 12, 0, 0);
    const rows: HeroCatalogAnimeCandidateRow[] = [
      makeCandidateRow(
        {
          id: "local-pure",
          anilistId: null,
          malId: null,
          kitsuId: null,
          hasTodayAiringSchedule: true,
        },
        nowMs,
      ),
      makeCandidateRow(
        {
          id: "hikari-ep5-only",
          anilistId: null,
          malId: null,
          kitsuId: null,
          publishedEpisodeCount: 1,
          ep1Sources: [],
          epSources: [{ number: 5, seasonNumber: 1, videoUrl: "https://cdn.example.com/ep5.mp4" }],
          hasTodayWeeklyRecurrence: true,
        },
        nowMs,
      ),
      makeCandidateRow(
        {
          id: "105",
          ep1Sources: [{ hikariPlayerEpisodeId: "ep_valid_105" }],
          hasTodayAiringSchedule: true,
        },
        nowMs,
      ),
      makeCandidateRow(
        {
          id: "local-mapped",
          anilistId: 176301,
          title: "Solo Leveling",
          publishedEpisodeCount: 0,
          ep1Sources: [],
          epSources: [],
          hasTodayAiringSchedule: true,
        },
        nowMs,
      ),
    ];

    const scored = scoreAndDeduplicateHeroCandidates(rows, [], nowMs);
    const ids = scored.map((s) => s.anime.id).sort();
    assert.deepEqual(ids, ["105", "176301", "hikari-ep5-only", "local-pure"]);

    const mapped = scored.find((s) => s.anime.id === "176301");
    assert.equal(mapped?.anime.serverCatalogId, "local-mapped");
    assert.equal(mapped?.isCalendarToday, true);
    assert.equal(mapped?.hasPublishedEpisode, false);
    assert.equal(mapped?.anime.hasEpisode, false);

    const ep5Only = scored.find((s) => s.anime.id === "hikari-ep5-only");
    assert.equal(ep5Only?.isCalendarToday, true);
    assert.equal(ep5Only?.anime.firstAvailableEpisodeNumber, 5);
    assert.equal(ep5Only?.anime.hasEpisode, true);

    const pool = buildHeroBannerPool(scored, nowMs);
    assert.equal(pool.items.length, 4);
    assert.ok(pool.items.every((item) => item.bucket === "calendario"));
  });

  it("3. canonically deduplicates an anime appearing in both Calendar and Em Alta (and dubbed vs subbed)", () => {
    const nowMs = Date.UTC(2026, 4, 15, 12, 0, 0);
    const rows: HeroCatalogAnimeCandidateRow[] = [
      makeCandidateRow(
        {
          id: "113415",
          title: "Jujutsu Kaisen",
          titleRomaji: "Jujutsu Kaisen",
          titleEnglish: "JUJUTSU KAISEN",
          score: 86,
          hasTodayAiringSchedule: true,
        },
        nowMs,
      ),
      makeCandidateRow(
        {
          id: "mal-40748",
          anilistId: null,
          malId: 40748,
          title: "Jujutsu Kaisen (Dublado)",
          titleRomaji: "Jujutsu Kaisen (Dublado)",
          titleEnglish: "JUJUTSU KAISEN Dublado",
          score: 95,
          hasTodayWeeklyRecurrence: true,
        },
        nowMs,
      ),
    ];

    const trendingItems: SlimAnime[] = [
      makeTrendingSlim({
        id: "113415",
        anilistId: 113415,
        titles: { romaji: "Jujutsu Kaisen", english: "JUJUTSU KAISEN", native: "" },
        hasEpisode: true,
      }),
      makeTrendingSlim({
        id: "mal-40748",
        malId: 40748,
        titles: { romaji: "Jujutsu Kaisen (Dublado)", english: "JUJUTSU KAISEN Dublado", native: "" },
        hasEpisode: true,
      }),
    ];

    const scored = scoreAndDeduplicateHeroCandidates(rows, trendingItems, nowMs);
    assert.equal(scored.length, 1);
    assert.equal(scored[0].anime.id, "113415");
    assert.equal(scored[0].isDubbed, false);
    assert.equal(scored[0].isEmAlta, true);
    assert.equal(scored[0].isCalendarToday, true);
    assert.equal(scored[0].hasPublishedEpisode, true);

    const pool = buildHeroBannerPool(scored, nowMs);
    assert.equal(pool.items.length, 1);
  });

  it("4. rejects newly-published/newly-registered/episode-only animes outside Calendar and Em Alta, while preserving popular Em Alta and SQL Calendar queries", () => {
    const nowMs = Date.UTC(2026, 4, 15, 12, 0, 0);
    const rows: HeroCatalogAnimeCandidateRow[] = [
      // Recém-cadastrado e recém-publicado há 5 minutos, mas fora de Calendário e Em Alta -> NÃO deve entrar
      makeCandidateRow(
        {
          id: "910001",
          title: "Recem Publicado Qualquer",
          createdAt: new Date(nowMs - 5 * 60 * 1000).toISOString(),
          updatedAt: new Date(nowMs - 5 * 60 * 1000).toISOString(),
          publishedEpisodeCount: 1,
          firstEpisodePublishedAt: new Date(nowMs - 5 * 60 * 1000).toISOString(),
          latestEpisodePublishedAt: new Date(nowMs - 5 * 60 * 1000).toISOString(),
          ep1Sources: [{ videoUrl: "https://cdn.example.com/recent.mp4" }],
          hasTodayAiringSchedule: false,
          hasTodayWeeklyRecurrence: false,
        },
        nowMs,
      ),
      // Sem episódio publicado e fora de Calendário/Em Alta
      makeCandidateRow({ id: "910002", publishedEpisodeCount: 0, ep1Sources: [], epSources: [] }, nowMs),
      // Programado no Calendário de hoje (sem episódio publicado ainda) -> entra via Fonte A
      makeCandidateRow(
        {
          id: "910003",
          title: "Calendario Hoje",
          titleRomaji: "Calendario Hoje",
          publishedEpisodeCount: 0,
          ep1Sources: [],
          epSources: [],
          hasTodayAiringSchedule: true,
        },
        nowMs,
      ),
      // Popular em Em Alta antigo (FINISHED há 2 anos, sem episódio recente) -> entra via Fonte B
      makeCandidateRow(
        {
          id: "5081",
          title: "Bakemonogatari",
          titleRomaji: "Bakemonogatari",
          status: "FINISHED",
          score: 91,
          popularity: 350000,
          createdAt: new Date(nowMs - 700 * DAY_MS).toISOString(),
          firstEpisodePublishedAt: new Date(nowMs - 690 * DAY_MS).toISOString(),
          latestEpisodePublishedAt: new Date(nowMs - 600 * DAY_MS).toISOString(),
          hasTodayAiringSchedule: false,
          hasTodayWeeklyRecurrence: false,
        },
        nowMs,
      ),
    ];

    const trendingItems: SlimAnime[] = [
      makeTrendingSlim({
        id: "5081",
        anilistId: 5081,
        titles: { romaji: "Bakemonogatari", english: "Bakemonogatari", native: "" },
        status: "FINISHED",
        hasEpisode: true,
      }),
    ];

    const scored = scoreAndDeduplicateHeroCandidates(rows, trendingItems, nowMs);
    assert.deepEqual(
      scored.map((s) => s.anime.id).sort(),
      ["5081", "910003"],
    );
    assert.equal(scored.some((s) => s.anime.id === "910001"), false);

    const byId = new Map(scored.map((s) => [s.anime.id, s]));
    assert.equal(byId.get("910003")?.isCalendarToday, true);
    assert.equal(byId.get("910003")?.isEmAlta, false);
    assert.equal(byId.get("5081")?.isEmAlta, true);
    assert.equal(byId.get("5081")?.isCalendarToday, false);

    const heroServerSource = readFileSync(
      resolve(process.cwd(), "src/lib/home-hero.server.ts"),
      "utf8",
    );
    assert.equal(heroServerSource.includes("airing_stats"), true);
    assert.equal(heroServerSource.includes("recurrence_stats"), true);
    assert.equal(heroServerSource.includes("CALENDAR_TIMEZONE"), true);
    assert.equal(heroServerSource.includes("recent_engagement_ids"), false);
    assert.equal(heroServerSource.includes("user_anime_tracking"), false);
    assert.equal(heroServerSource.includes("queryAudienceMetricsFromNeon"), false);
  });

  it("5. excludes hidden, archived, and +18/Hentai candidates even if in Calendar or stale trendingItems", () => {
    const nowMs = Date.UTC(2026, 4, 15, 12, 0, 0);
    const rows: HeroCatalogAnimeCandidateRow[] = [
      makeCandidateRow({ id: "101", hidden: true, hasTodayAiringSchedule: true }, nowMs),
      makeCandidateRow({ id: "102", genres: ["Action", "Hentai"], hasTodayAiringSchedule: true }, nowMs),
      makeCandidateRow(
        { id: "103", archivedAt: new Date(nowMs - DAY_MS).toISOString(), hasTodayWeeklyRecurrence: true },
        nowMs,
      ),
      makeCandidateRow(
        { id: "bad/id", anilistId: null, malId: null, kitsuId: null, hasTodayAiringSchedule: true },
        nowMs,
      ),
      makeCandidateRow(
        { id: "104", title: "Valid Anime", titleRomaji: "Valid Anime", hasTodayAiringSchedule: true },
        nowMs,
      ),
    ];

    // Simula snapshot antigo de Em Alta contendo itens hidden, archived e Hentai
    const staleTrending: SlimAnime[] = [
      makeTrendingSlim({ id: "101", anilistId: 101 }),
      makeTrendingSlim({ id: "102", anilistId: 102, genres: ["Hentai"] }),
      makeTrendingSlim({ id: "103", anilistId: 103 }),
      makeTrendingSlim({ id: "104", anilistId: 104 }),
    ];

    const scored = scoreAndDeduplicateHeroCandidates(rows, staleTrending, nowMs);
    assert.deepEqual(
      scored.map((s) => s.anime.id),
      ["104"],
    );
  });

  it("6. rotates position [0] across consecutive 15-minute windows without locking slot 0 and balances Calendar + Em Alta", () => {
    const t0 = Date.UTC(2026, 4, 15, 12, 0, 0);

    // Caso A: Bakemonogatari (Calendário) é o ÚNICO com banner horizontal distinto e Em Alta tem animes apenas com cover
    const singleDistinctRows: HeroCatalogAnimeCandidateRow[] = [
      makeCandidateRow(
        {
          id: "5081",
          title: "Bakemonogatari",
          titleRomaji: "Bakemonogatari",
          banner: "https://cdn.example.com/banner-5081.jpg",
          cover: "https://cdn.example.com/cover-5081.jpg",
          hasTodayAiringSchedule: true,
        },
        t0,
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        makeCandidateRow(
          {
            id: String(700001 + i),
            banner: null,
            cover: `https://cdn.example.com/cover-${700001 + i}.jpg`,
            publishedEpisodeCount: 0,
            ep1Sources: [],
            epSources: [],
          },
          t0,
        ),
      ),
    ];

    const trendingCoverOnly = Array.from({ length: 5 }, (_, i) =>
      makeTrendingSlim({
        id: String(700001 + i),
        anilistId: 700001 + i,
        cover: `https://cdn.example.com/cover-${700001 + i}.jpg`,
        banner: "",
      }),
    );

    const scoredA = scoreAndDeduplicateHeroCandidates(singleDistinctRows, trendingCoverOnly, t0);
    const poolA = buildHeroBannerPool(scoredA, t0);

    const firstIdsA: string[] = [];
    for (let w = 0; w < 6; w++) {
      const slides = selectHeroSlidesForWindow(poolA, t0 + w * HERO_ROTATION_WINDOW_MS, MAX_HERO_SLIDES);
      assert.equal(slides.length, 6);
      firstIdsA.push(slides[0].id);
      if (w > 0) {
        assert.notEqual(
          slides[0].id,
          firstIdsA[w - 1],
          `Position [0] must vary between window ${w - 1} and ${w}`,
        );
      }
    }
    assert.equal(new Set(firstIdsA).size, 6);
    assert.ok(firstIdsA.includes("5081"));
    assert.ok(firstIdsA.includes("700001"));

    // Caso B: 6 banners distintos (4 Em Alta + 2 Calendário) + 6 cover-only -> banners distintos ficam à frente dos cover-only e [0] gira entre todos os 6
    const mixedRows: HeroCatalogAnimeCandidateRow[] = [
      ...Array.from({ length: 4 }, (_, i) =>
        makeCandidateRow({ id: String(800101 + i) }, t0),
      ),
      ...Array.from({ length: 2 }, (_, i) =>
        makeCandidateRow(
          {
            id: String(800105 + i),
            hasTodayWeeklyRecurrence: true,
          },
          t0,
        ),
      ),
      ...Array.from({ length: 6 }, (_, i) =>
        makeCandidateRow(
          {
            id: String(800001 + i),
            banner: i % 2 === 0 ? null : `https://cdn.example.com/cover-${800001 + i}.jpg`,
            hasTodayAiringSchedule: true,
          },
          t0,
        ),
      ),
    ];
    const scoredB = scoreAndDeduplicateHeroCandidates(
      mixedRows,
      Array.from({ length: 4 }, (_, i) => makeTrendingSlim({ id: String(800101 + i), anilistId: 800101 + i })),
      t0,
    );
    const poolB = buildHeroBannerPool(scoredB, t0);
    assert.ok(poolB.items.some((item) => item.bucket === "em_alta"));
    assert.ok(poolB.items.some((item) => item.bucket === "calendario"));

    const firstIdsB: string[] = [];
    for (let w = 0; w < 6; w++) {
      const slides = selectHeroSlidesForWindow(poolB, t0 + w * HERO_ROTATION_WINDOW_MS, MAX_HERO_SLIDES);
      assert.equal(slides.length, 8);
      for (let i = 0; i < 6; i++) {
        assert.ok(
          slides.slice(0, 6).some((s) => s.id === String(800101 + i)),
          `Distinct banner ${800101 + i} must appear in first 6 slots`,
        );
      }
      firstIdsB.push(slides[0].id);
      if (w > 0) {
        assert.notEqual(slides[0].id, firstIdsB[w - 1]);
      }
    }
    assert.equal(new Set(firstIdsB).size, 6);

    // Caso C: Equilíbrio justo quando ambas as fontes têm >= 15 candidatos (12 Em Alta + 12 Calendário = 24)
    const balancedRows: HeroCatalogAnimeCandidateRow[] = [
      ...Array.from({ length: 15 }, (_, i) =>
        makeCandidateRow({ id: String(810001 + i) }, t0),
      ),
      ...Array.from({ length: 15 }, (_, i) =>
        makeCandidateRow(
          { id: String(820001 + i), hasTodayAiringSchedule: true },
          t0,
        ),
      ),
    ];
    const balancedTrending = Array.from({ length: 15 }, (_, i) =>
      makeTrendingSlim({ id: String(810001 + i), anilistId: 810001 + i }),
    );
    const balancedPool = buildHeroBannerPool(
      scoreAndDeduplicateHeroCandidates(balancedRows, balancedTrending, t0),
      t0,
    );
    assert.equal(balancedPool.items.length, MAX_HERO_POOL_SIZE);
    assert.equal(
      balancedPool.items.filter((item) => item.bucket === "em_alta").length,
      12,
    );
    assert.equal(
      balancedPool.items.filter((item) => item.bucket === "calendario").length,
      12,
    );
  });

  it("7. keeps 1 static slide without fabricating animes when only 1 valid candidate exists across both sources", async () => {
    const t0 = Date.UTC(2026, 4, 15, 12, 0, 0);
    const singleValidRows: HeroCatalogAnimeCandidateRow[] = [
      makeCandidateRow(
        {
          id: "5081",
          title: "Bakemonogatari",
          titleRomaji: "Bakemonogatari",
          hasTodayAiringSchedule: true,
        },
        t0,
      ),
      makeCandidateRow({ id: "930001", publishedEpisodeCount: 0, ep1Sources: [], epSources: [] }, t0),
      makeCandidateRow({ id: "930002", publishedEpisodeCount: 1, ep1Sources: [{ videoUrl: "https://cdn.example.com/ep1.mp4" }] }, t0),
    ];

    const deps: HomeHeroDeps = {
      getRedisPool: async () => ({ status: "unavailable", payload: null, fence: null }),
      setRedisPool: async () => "unavailable",
      scheduleWrite: () => {},
      queryCatalog: async () => singleValidRows,
      getTrendingItems: async () => [],
    };

    const items1 = await getHomeHeroItemsWithDeps(deps, t0);
    const items2 = await getHomeHeroItemsWithDeps(deps, t0 + HERO_ROTATION_WINDOW_MS);

    assert.deepEqual(items1.map((x) => x.id), ["5081"]);
    assert.deepEqual(items2.map((x) => x.id), ["5081"]);
  });

  it("8. avoids getHomeTrendingItems and queryCatalog calls on RAM and Redis cache hits, and refreshes on America/Sao_Paulo day rollover", async () => {
    const t0 = Date.UTC(2026, 4, 15, 12, 0, 0);
    const rows = Array.from({ length: 12 }, (_, i) =>
      makeCandidateRow({ id: String(400001 + i), hasTodayAiringSchedule: true }, t0),
    );
    const mockRedis = new MockHeroRedis();
    let catalogQueries = 0;
    let trendingCalls = 0;

    const deps: HomeHeroDeps = {
      getRedisPool: () => getRedisHeroBannerPoolWithFence(mockRedis),
      setRedisPool: (payload, fence) => setRedisHeroBannerPool(payload, fence, mockRedis),
      scheduleWrite: (promise) => {
        void promise;
      },
      getTrendingItems: async () => {
        trendingCalls += 1;
        return [makeTrendingSlim({ id: "400001", anilistId: 400001 })];
      },
      queryCatalog: async () => {
        catalogQueries += 1;
        return rows;
      },
    };

    const firstWindowSlides = await getHomeHeroItemsWithDeps(deps, t0);
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(firstWindowSlides.length, 8);
    assert.equal(catalogQueries, 1);
    assert.equal(trendingCalls, 1);
    assert.ok(mockRedis.store.has(getHeroRedisKey("development")));

    // RAM hit
    const sameWindowRam = await getHomeHeroItemsWithDeps(deps, t0 + 20_000);
    assert.deepEqual(sameWindowRam.map((a) => a.id), firstWindowSlides.map((a) => a.id));
    assert.equal(catalogQueries, 1);
    assert.equal(trendingCalls, 1);

    // Clear RAM -> Redis hit
    invalidateHomeHeroLocalCache();
    const sameWindowRedis = await getHomeHeroItemsWithDeps(deps, t0 + 30_000);
    assert.deepEqual(sameWindowRedis.map((a) => a.id), firstWindowSlides.map((a) => a.id));
    assert.equal(catalogQueries, 1);
    assert.equal(trendingCalls, 1);

    // Next 15-min window still uses cached pool
    const nextWindowSlides = await getHomeHeroItemsWithDeps(deps, t0 + HERO_ROTATION_WINDOW_MS);
    assert.equal(nextWindowSlides.length, 8);
    assert.equal(catalogQueries, 1);
    assert.equal(trendingCalls, 1);
    assert.notDeepEqual(nextWindowSlides.map((a) => a.id), firstWindowSlides.map((a) => a.id));

    // Virada de dia em America/Sao_Paulo (23:55 BRT -> 00:05 BRT):
    // 2026-05-15 23:55 BRT = 2026-05-16T02:55:00Z
    // 2026-05-16 00:05 BRT = 2026-05-16T03:05:00Z
    resetHomeHeroTestState();
    const rolloverRedis = new MockHeroRedis();
    const day1Ms = Date.UTC(2026, 4, 16, 2, 55, 0);
    const day2Ms = Date.UTC(2026, 4, 16, 3, 5, 0);
    const bgWrites: Promise<unknown>[] = [];

    const dayDeps: HomeHeroDeps = {
      getRedisPool: () => getRedisHeroBannerPoolWithFence(rolloverRedis),
      setRedisPool: (payload, fence) => setRedisHeroBannerPool(payload, fence, rolloverRedis),
      scheduleWrite: (promise) => {
        bgWrites.push(promise);
      },
      getTrendingItems: async () => [],
      queryCatalog: async (_trending, requestedNowMs = Date.now()) => {
        if (requestedNowMs < day2Ms) {
          return [
            makeCandidateRow({ id: "510001", title: "Dia 1 Sexta", hasTodayAiringSchedule: true }, requestedNowMs),
          ];
        }
        return [
          makeCandidateRow({ id: "520001", title: "Dia 2 Sabado", hasTodayAiringSchedule: true }, requestedNowMs),
        ];
      },
    };

    const day1Slides = await getHomeHeroItemsWithDeps(dayDeps, day1Ms);
    await Promise.all(bgWrites.splice(0));
    assert.deepEqual(day1Slides.map((a) => a.id), ["510001"]);

    // Mesmo com RAM quente (10 min < 20 min TTL Redis) e Redis populado, virada de dia em SP atualiza o Hero
    const day2RamBypassSlides = await getHomeHeroItemsWithDeps(dayDeps, day2Ms);
    await Promise.all(bgWrites.splice(0));
    assert.deepEqual(day2RamBypassSlides.map((a) => a.id), ["520001"]);

    // Mesmo se a RAM estiver limpa e apenas o Redis tiver o pool do dia anterior, Redis miss por dia é respeitado
    await setRedisHeroBannerPool(
      buildHeroBannerPool(
        scoreAndDeduplicateHeroCandidates(
          [makeCandidateRow({ id: "510001", hasTodayAiringSchedule: true }, day1Ms)],
          [],
          day1Ms,
        ),
        day1Ms,
      ),
      "0",
      rolloverRedis,
    );
    invalidateHomeHeroLocalCache();
    const day2RedisBypassSlides = await getHomeHeroItemsWithDeps(dayDeps, day2Ms);
    await Promise.all(bgWrites.splice(0));
    assert.deepEqual(day2RedisBypassSlides.map((a) => a.id), ["520001"]);
  });

  it("9. explicit invalidation clears ramHeroPool, staleHeroPool, and Redis Hero/Em Alta keys+generations (and fails open on Redis error)", async () => {
    const nowMs = Date.UTC(2026, 4, 15, 12, 0, 0);
    const rows = Array.from({ length: 8 }, (_, i) =>
      makeCandidateRow({ id: String(600001 + i), hasTodayAiringSchedule: true }, nowMs),
    );

    // 9a. preserveStale=true preserves staleHeroPool for DB+Redis outage fallback
    const items1 = await getHomeHeroItemsWithDeps(
      {
        getRedisPool: async () => ({ status: "failed", payload: null, fence: null }),
        setRedisPool: async () => "failed",
        scheduleWrite: () => {},
        queryCatalog: async () => rows,
        getTrendingItems: async () => [],
      },
      nowMs,
    );
    assert.equal(items1.length, 8);

    invalidateHomeHeroLocalCache({ preserveStale: true });
    const itemsStale = await getHomeHeroItemsWithDeps(
      {
        getRedisPool: async () => ({ status: "failed", payload: null, fence: null }),
        setRedisPool: async () => "failed",
        scheduleWrite: () => {},
        queryCatalog: async () => {
          throw new Error("Neon connection error");
        },
        getTrendingItems: async () => [],
      },
      nowMs,
    );
    assert.equal(itemsStale.length, 8);

    // 9b. Default invalidation clears staleHeroPool so DB failure returns [] instead of stale cache
    const mockRedis = new MockHeroRedis();
    mockRedis.store.set(getHeroRedisKey("development"), JSON.stringify({ v: HERO_BANNER_PAYLOAD_VERSION }));
    mockRedis.store.set(getHeroGenKey("development"), "2");
    mockRedis.store.set(getHomeTrendingRedisKey("development"), JSON.stringify({ v: HOME_TRENDING_PAYLOAD_VERSION }));
    mockRedis.store.set(getHomeTrendingGenKey("development"), "5");

    await invalidateHomePublicEpisodesCacheAsync({ redisOverride: mockRedis });

    assert.equal(mockRedis.store.has(getHeroRedisKey("development")), false);
    assert.equal(mockRedis.store.get(getHeroGenKey("development")), "3");
    assert.equal(mockRedis.store.has(getHomeTrendingRedisKey("development")), false);
    assert.equal(mockRedis.store.get(getHomeTrendingGenKey("development")), "6");

    const afterExplicitInvalidation = await getHomeHeroItemsWithDeps(
      {
        getRedisPool: async () => ({ status: "failed", payload: null, fence: null }),
        setRedisPool: async () => "failed",
        scheduleWrite: () => {},
        queryCatalog: async () => {
          throw new Error("Neon connection error");
        },
        getTrendingItems: async () => [],
      },
      nowMs,
    );
    assert.deepEqual(afterExplicitInvalidation, []);

    // 9c. Em Alta invalidation also invalidates Hero cache
    mockRedis.store.set(getHeroRedisKey("development"), JSON.stringify({ v: HERO_BANNER_PAYLOAD_VERSION }));
    mockRedis.store.set(getHomeTrendingRedisKey("development"), JSON.stringify({ v: HOME_TRENDING_PAYLOAD_VERSION }));
    await invalidateHomeTrendingCacheAsync(mockRedis);
    assert.equal(mockRedis.store.has(getHeroRedisKey("development")), false);
    assert.equal(mockRedis.store.get(getHeroGenKey("development")), "4");
    assert.equal(mockRedis.store.has(getHomeTrendingRedisKey("development")), false);
    assert.equal(mockRedis.store.get(getHomeTrendingGenKey("development")), "7");

    // 9d. Fail-open when Redis throws during async invalidation
    mockRedis.shouldThrow = true;
    await assert.doesNotReject(async () => {
      await invalidateHomeHeroCacheAsync(mockRedis);
      await invalidateHomePublicEpisodesCacheAsync({ redisOverride: mockRedis });
      await invalidateHomeTrendingCacheAsync(mockRedis);
    });
  });

  it("10. prevents concurrent invalidation during in-flight calculation from restoring stale RAM/staleHeroPool or overwriting Redis", async () => {
    const mockRedis = new MockHeroRedis();
    const nowMs = Date.UTC(2026, 4, 15, 12, 0, 0);

    // 10a. requestEpoch guard on in-flight Neon computation
    let resolveInFlightCatalog!: (rows: HeroCatalogAnimeCandidateRow[]) => void;
    const inFlightCatalogPromise = new Promise<HeroCatalogAnimeCandidateRow[]>((resolveFn) => {
      resolveInFlightCatalog = resolveFn;
    });
    const bgWrites: Promise<unknown>[] = [];

    const inflightPromise = getHomeHeroItemsWithDeps(
      {
        getRedisPool: async () => getRedisHeroBannerPoolWithFence(mockRedis),
        setRedisPool: (p, f) => setRedisHeroBannerPool(p, f, mockRedis),
        scheduleWrite: (p) => {
          bgWrites.push(p);
        },
        getTrendingItems: async () => [],
        queryCatalog: () => inFlightCatalogPromise,
      },
      nowMs,
    );

    // Aguarda passar pela leitura do Redis e suspender na query do catálogo
    await new Promise((r) => setTimeout(r, 10));

    // Invalidação concorrente antes da query antiga resolver
    await invalidateHomeHeroCacheAsync(mockRedis);
    assert.equal(mockRedis.store.get(getHeroGenKey("development")), "1");

    // Agora a query antiga termina
    resolveInFlightCatalog([
      makeCandidateRow({ id: "5081", title: "Old Inflight", hasTodayAiringSchedule: true }, nowMs),
    ]);
    await inflightPromise;
    await Promise.all(bgWrites.splice(0));

    // O cálculo antigo NÃO deve ter gravado no Redis nem populado ramHeroPool/staleHeroPool
    assert.equal(mockRedis.store.has(getHeroRedisKey("development")), false);

    // Se o próximo request falhar no DB, não recebe o old inflight como staleHeroPool
    const afterRace = await getHomeHeroItemsWithDeps(
      {
        getRedisPool: async () => ({ status: "failed", payload: null, fence: null }),
        setRedisPool: async () => "failed",
        scheduleWrite: () => {},
        getTrendingItems: async () => [],
        queryCatalog: async () => {
          throw new Error("DB error");
        },
      },
      nowMs,
    );
    assert.deepEqual(afterRace, []);

    // 10b. Fence guard direto no Redis
    const read = await getRedisHeroBannerPoolWithFence(mockRedis);
    assert.equal(read.status, "miss");
    const staleFence = read.fence;
    await invalidateRedisHeroBannerPool(mockRedis);
    assert.equal(mockRedis.store.get(getHeroGenKey("development")), "2");

    const payload: HeroBannerPoolPayload = {
      v: HERO_BANNER_PAYLOAD_VERSION,
      env: resolveHeroEnvironmentName(),
      generatedAt: nowMs,
      items: [
        {
          anime: makeTrendingSlim({
            id: "176301",
            banner: "https://cdn.example.com/banner.jpg",
            cover: "https://cdn.example.com/cover.jpg",
            hasEpisode: true,
          }),
          bucket: "calendario",
          score: 80,
          hasDistinctBanner: true,
          titleKey: "solo leveling",
          rank: 1,
        },
      ],
    };

    assert.equal(await setRedisHeroBannerPool(payload, staleFence, mockRedis), "fenced");
    assert.equal(mockRedis.store.has(getHeroRedisKey("development")), false);
  });

  it("11. reuses provided trendingItems without invoking getTrendingItems redundantly (and fetchHomeCatalog shares emAltaItems)", async () => {
    const nowMs = Date.UTC(2026, 4, 15, 12, 0, 0);
    let trendingFetcherCalls = 0;

    const items = await getHomeHeroItemsWithDeps(
      {
        getRedisPool: async () => ({ status: "unavailable", payload: null, fence: null }),
        setRedisPool: async () => "unavailable",
        scheduleWrite: () => {},
        getTrendingItems: async () => {
          trendingFetcherCalls += 1;
          return [];
        },
        queryCatalog: async () => [],
      },
      nowMs,
      {
        trendingItems: [
          makeTrendingSlim({
            id: "300001",
            anilistId: 300001,
            banner: "https://cdn.example.com/banner-300001.jpg",
          }),
        ],
      },
    );

    assert.equal(trendingFetcherCalls, 0);
    assert.deepEqual(items.map((i) => i.id), ["300001"]);

    const apiSource = readFileSync(resolve(process.cwd(), "src/lib/api.ts"), "utf8");
    assert.match(apiSource, /getHomeHeroItems\(Date\.now\(\),\s*\{\s*trendingItems\s*\}\)/);
  });

  describe("12. environment isolation (preview vs production) and Redis v4/v2 & v3 preservation", () => {
    const originalVercelEnv = process.env.VERCEL_ENV;
    const originalNodeEnv = process.env.NODE_ENV;

    afterEach(() => {
      if (originalVercelEnv === undefined) {
        delete process.env.VERCEL_ENV;
      } else {
        process.env.VERCEL_ENV = originalVercelEnv;
      }
      if (originalNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = originalNodeEnv;
      }
    });

    it("enforces preview vs production isolation for Hero v4 (v2) and Em Alta v3 (v3)", async () => {
      const mockRedis = new MockHeroRedis();
      const nowMs = Date.UTC(2026, 4, 15, 12, 0, 0);
      process.env.VERCEL_ENV = "preview";

      assert.equal(HERO_BANNER_REDIS_KEY, "hikari:home:hero-banner:v2");
      assert.equal(HERO_BANNER_GEN_KEY, "hikari:home:hero-banner:gen:v2");
      assert.equal(getHeroRedisKey("preview"), "hikari:preview:home:hero-banner:v4");
      assert.equal(getHeroGenKey("preview"), "hikari:preview:home:hero-banner:gen:v4");
      assert.equal(getHeroRedisKey("production"), "hikari:production:home:hero-banner:v4");
      assert.equal(getHomeTrendingRedisKey("preview"), "hikari:preview:home:trending:v3");
      assert.equal(getHomeTrendingRedisKey("production"), "hikari:production:home:trending:v3");

      const validAnimeRow = makeCandidateRow({ id: "960001", hasTodayAiringSchedule: true }, nowMs);
      const sampleItem = buildHeroBannerPool(
        scoreAndDeduplicateHeroCandidates([validAnimeRow], [], nowMs),
        nowMs,
      ).items[0];

      // Cross-env payload (production under preview key) must be rejected
      mockRedis.store.set(
        getHeroRedisKey("preview"),
        JSON.stringify({
          v: 1,
          globalGen: "0",
          idGens: {},
          data: {
            v: HERO_BANNER_PAYLOAD_VERSION,
            env: "production",
            generatedAt: nowMs,
            items: [sampleItem],
          },
        }),
      );
      assert.equal((await getRedisHeroBannerPoolWithFence(mockRedis)).status, "miss");

      // Legacy v1 payload must be rejected
      mockRedis.store.set(
        getHeroRedisKey("preview"),
        JSON.stringify({
          v: 1,
          globalGen: "0",
          idGens: {},
          data: {
            v: 1,
            env: "preview",
            generatedAt: nowMs,
            items: [sampleItem],
          },
        }),
      );
      assert.equal((await getRedisHeroBannerPoolWithFence(mockRedis)).status, "miss");

      // Write valid preview pool via getHomeHeroItemsWithDeps
      const bgWrites: Promise<unknown>[] = [];
      const prevItems = await getHomeHeroItemsWithDeps(
        {
          getRedisPool: () => getRedisHeroBannerPoolWithFence(mockRedis),
          setRedisPool: (p, f) => setRedisHeroBannerPool(p, f, mockRedis),
          scheduleWrite: (p) => {
            bgWrites.push(p);
          },
          getTrendingItems: async () => [],
          queryCatalog: async () => [validAnimeRow],
        },
        nowMs,
      );
      await Promise.all(bgWrites.splice(0));
      assert.deepEqual(prevItems.map((a) => a.id), ["960001"]);

      // Em Alta v3 preview write/read check
      const trendingPreviewWrite = await setRedisHomeTrending(
        {
          v: HOME_TRENDING_PAYLOAD_VERSION,
          env: "preview",
          generatedAt: nowMs,
          items: [makeTrendingSlim({ id: "960001" })],
        },
        "0",
        mockRedis,
      );
      assert.equal(trendingPreviewWrite, "inserted");
      assert.equal((await getRedisHomeTrendingWithFence(mockRedis)).status, "hit");

      // Switch to production -> preview RAM/Redis pools are NOT reused
      process.env.VERCEL_ENV = "production";
      assert.equal((await getRedisHomeTrendingWithFence(mockRedis)).status, "miss");
      invalidateHomeTrendingLocalCache();

      let prodDbCalls = 0;
      const prodRow = makeCandidateRow({ id: "960002", hasTodayAiringSchedule: true }, nowMs);
      const prodItems = await getHomeHeroItemsWithDeps(
        {
          getRedisPool: () => getRedisHeroBannerPoolWithFence(mockRedis),
          setRedisPool: (p, f) => setRedisHeroBannerPool(p, f, mockRedis),
          scheduleWrite: () => {},
          getTrendingItems: async () => [],
          queryCatalog: async () => {
            prodDbCalls += 1;
            return [prodRow];
          },
        },
        nowMs,
      );
      assert.equal(prodDbCalls, 1);
      assert.deepEqual(prodItems.map((a) => a.id), ["960002"]);
    });
  });

  it("13. preserves Calendar scoring neutrality toward registration age, temporal score helpers, and safe pickHeroItems fallback", () => {
    const nowMs = Date.UTC(2026, 4, 15, 12, 0, 0);

    // Helpers temporais continuam preservados sem erro
    assert.equal(
      computeNoveltyScore({
        firstEpisodePublishedAtMs: nowMs - 170 * DAY_MS,
        publishedEpisodeCount: 6,
        nowMs,
      }),
      0,
    );
    assert.ok(
      computeNewEpisodeScore({
        latestEpisodePublishedAtMs: nowMs - 2 * HOUR_MS,
        status: "RELEASING",
        score: 82,
        nowMs,
      }) >
        computeNewEpisodeScore({
          latestEpisodePublishedAtMs: nowMs - 8 * DAY_MS,
          status: "RELEASING",
          score: 82,
          nowMs,
        }),
    );

    // computeCalendarScore não favorece animes apenas por criação recente
    const scoreA = computeCalendarScore({
      hasTodayAiringSchedule: true,
      hasTodayWeeklyRecurrence: false,
      hasPublishedEpisode: false,
      score: 80,
      popularity: 10000,
    });
    assert.ok(scoreA > 0);
    assert.equal(
      computeCalendarScore({
        hasTodayAiringSchedule: false,
        hasTodayWeeklyRecurrence: false,
        hasPublishedEpisode: true,
        score: 95,
        popularity: 200000,
      }),
      0,
    );

    const noEpisodeResult = pickHeroItems(
      [makeTrendingSlim({ id: "1", banner: "https://cdn.example.com/b-1.jpg" }), makeTrendingSlim({ id: "2", banner: "https://cdn.example.com/b-2.jpg" })],
      [makeTrendingSlim({ id: "3", banner: "https://cdn.example.com/b-3.jpg" })],
      [],
    );
    assert.equal(noEpisodeResult.length, 3);
  });

  it("14. ensures today Calendar animes (airing schedule & weekly recurrence) effectively appear in final slides alongside Em Alta across all windows without auto-including newly published animes", async () => {
    const t0 = Date.UTC(2026, 4, 15, 15, 0, 0);

    // Cenário 14a: Em Alta tem 14 animes com banner distinto; Calendário de hoje tem apenas 3 cover-only (banner: null).
    // Regressão anterior: distinctTier (>= 8 itens de Em Alta) consumia todos os 8 slots e excluía 100% do Calendário dos slides finais.
    const emAltaDistinctRows = Array.from({ length: 14 }, (_, i) =>
      makeCandidateRow(
        {
          id: String(970001 + i),
          title: `Em Alta ${i + 1}`,
          banner: `https://cdn.example.com/banner-${970001 + i}.jpg`,
          popularity: 120000 - i * 1000,
          score: 88 - (i % 5),
        },
        t0,
      ),
    );
    const emAltaTrending = emAltaDistinctRows.map((r) =>
      makeTrendingSlim({
        id: r.id,
        anilistId: Number(r.id),
        banner: r.banner ?? "",
        popularity: r.popularity ?? 0,
        score: r.score ?? 80,
      }),
    );

    const calendarCoverOnlyRows: HeroCatalogAnimeCandidateRow[] = [
      makeCandidateRow(
        {
          id: "971001",
          title: "Calendario Grade Hoje Cover",
          banner: null,
          hasTodayAiringSchedule: true,
          publishedEpisodeCount: 0,
          ep1Sources: [],
          epSources: [],
        },
        t0,
      ),
      makeCandidateRow(
        {
          id: "971002",
          title: "Calendario Recorrente Hoje Cover",
          banner: null,
          hasTodayWeeklyRecurrence: true,
          publishedEpisodeCount: 0,
          ep1Sources: [],
          epSources: [],
        },
        t0,
      ),
      makeCandidateRow(
        {
          id: "971003",
          title: "Calendario Grade Hoje Cover 2",
          banner: null,
          hasTodayAiringSchedule: true,
        },
        t0,
      ),
    ];

    // Anime recém-publicado (fora do Calendário de hoje e fora do Em Alta) NÃO pode entrar nos slides finais
    const newlyPublishedNonCalendar = makeCandidateRow(
      {
        id: "979999",
        title: "Recem Publicado Nao Elegivel",
        createdAt: new Date(t0 - 5 * 60 * 1000).toISOString(),
        latestEpisodePublishedAt: new Date(t0 - 2 * 60 * 1000).toISOString(),
        score: 99,
        popularity: 500000,
        hasTodayAiringSchedule: false,
        hasTodayWeeklyRecurrence: false,
      },
      t0,
    );

    const deps14a: HomeHeroDeps = {
      getRedisPool: async () => ({ status: "unavailable", payload: null, fence: null }),
      setRedisPool: async () => "unavailable",
      scheduleWrite: () => {},
      getTrendingItems: async () => emAltaTrending,
      queryCatalog: async () => [...emAltaDistinctRows, ...calendarCoverOnlyRows, newlyPublishedNonCalendar],
    };

    const calendarCoverIds = new Set(calendarCoverOnlyRows.map((r) => r.id));
    const emAltaIds = new Set(emAltaDistinctRows.map((r) => r.id));
    const leadIdsAcrossWindows: string[] = [];

    for (let w = 0; w < 6; w++) {
      const slides = await getHomeHeroItemsWithDeps(deps14a, t0 + w * HERO_ROTATION_WINDOW_MS);
      assert.equal(slides.length, MAX_HERO_SLIDES);
      const slideIds = slides.map((s) => s.id);
      assert.equal(new Set(slideIds).size, MAX_HERO_SLIDES, "Final slides must be unique");
      assert.ok(!slideIds.includes("979999"), "Newly published non-Calendar/non-Em-Alta anime must never enter slides");

      const calCount = slideIds.filter((id) => calendarCoverIds.has(id)).length;
      const emAltaCount = slideIds.filter((id) => emAltaIds.has(id)).length;
      assert.ok(calCount >= 2, `Window ${w} must include at least 2 today Calendar slides, got ${calCount}`);
      assert.ok(emAltaCount >= 2, `Window ${w} must include Em Alta slides, got ${emAltaCount}`);
      leadIdsAcrossWindows.push(slides[0].id);
    }
    assert.ok(new Set(leadIdsAcrossWindows).size > 1, "Position [0] must rotate across windows");

    // Cenário 14b: Calendário tem apenas 2 banners distintos vs 12 banners distintos do Em Alta, sendo 1 em comum (dual-source).
    // Nenhum ciclo de 15 min deve eliminar todo o Calendário dos slides finais e a duplicata só aparece 1x.
    resetHomeHeroTestState();
    const emAlta12 = Array.from({ length: 12 }, (_, i) =>
      makeCandidateRow(
        {
          id: String(980001 + i),
          title: `Em Alta B ${i + 1}`,
          banner: `https://cdn.example.com/banner-${980001 + i}.jpg`,
          hasTodayAiringSchedule: i === 0, // 980001 está tanto no Em Alta quanto no Calendário
        },
        t0,
      ),
    );
    const calWeeklyExtra = makeCandidateRow(
      {
        id: "981001",
        title: "Calendario Recorrencia Unica",
        banner: "https://cdn.example.com/banner-981001.jpg",
        hasTodayWeeklyRecurrence: true,
      },
      t0,
    );
    const deps14b: HomeHeroDeps = {
      getRedisPool: async () => ({ status: "unavailable", payload: null, fence: null }),
      setRedisPool: async () => "unavailable",
      scheduleWrite: () => {},
      getTrendingItems: async () =>
        emAlta12.map((r) =>
          makeTrendingSlim({
            id: r.id,
            anilistId: Number(r.id),
            banner: r.banner ?? "",
          }),
        ),
      queryCatalog: async () => [...emAlta12, calWeeklyExtra],
    };

    const allCalendarIds14b = new Set(["980001", "981001"]);
    const seenCalendarInSlides = new Set<string>();
    for (let w = 0; w < 14; w++) {
      const slides = await getHomeHeroItemsWithDeps(deps14b, t0 + w * HERO_ROTATION_WINDOW_MS);
      assert.equal(slides.length, MAX_HERO_SLIDES);
      const slideIds = slides.map((s) => s.id);
      assert.equal(new Set(slideIds).size, MAX_HERO_SLIDES, "Overlap dual-source anime must appear at most once");
      const calHits = slideIds.filter((id) => allCalendarIds14b.has(id));
      assert.ok(calHits.length >= 1, `Window ${w} eliminated all Calendar animes from final slides`);
      for (const id of calHits) seenCalendarInSlides.add(id);
    }
    assert.ok(seenCalendarInSlides.has("980001"));
    assert.ok(seenCalendarInSlides.has("981001"));

    // Cenário 14c: Simetria inversa — Calendário com 12 banners distintos e Em Alta com apenas cover-only continua preservando Em Alta nos slides finais
    resetHomeHeroTestState();
    const cal12Distinct = Array.from({ length: 12 }, (_, i) =>
      makeCandidateRow(
        {
          id: String(990001 + i),
          title: `Cal Distinct ${i + 1}`,
          banner: `https://cdn.example.com/banner-${990001 + i}.jpg`,
          hasTodayAiringSchedule: true,
        },
        t0,
      ),
    );
    const emAltaCoverOnly = [
      makeCandidateRow({ id: "995001", title: "Em Alta Cover 1", banner: null }, t0),
      makeCandidateRow({ id: "995002", title: "Em Alta Cover 2", banner: null }, t0),
    ];
    const slides14c = await getHomeHeroItemsWithDeps(
      {
        getRedisPool: async () => ({ status: "unavailable", payload: null, fence: null }),
        setRedisPool: async () => "unavailable",
        scheduleWrite: () => {},
        getTrendingItems: async () =>
          emAltaCoverOnly.map((r) =>
            makeTrendingSlim({ id: r.id, anilistId: Number(r.id), banner: "" }),
          ),
        queryCatalog: async () => [...cal12Distinct, ...emAltaCoverOnly],
      },
      t0,
    );
    assert.equal(slides14c.length, MAX_HERO_SLIDES);
    assert.ok(slides14c.some((s) => s.id === "995001" || s.id === "995002"));
    assert.ok(slides14c.some((s) => s.id.startsWith("9900")));
  });
});

