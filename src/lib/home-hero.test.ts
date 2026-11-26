import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildHeroBannerPool,
  getHomeHeroItemsWithDeps,
  invalidateHomeHeroCacheAsync,
  invalidateHomeHeroLocalCache,
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

describe("home-hero unified 2-group selection, first-slide rotation & cache invalidation", () => {
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

  it("2. includes published playable episodes including internal IDs, Hikari Player IDs, and non-ep-1 episodes", () => {
    const nowMs = Date.UTC(2026, 4, 15, 12, 0, 0);
    const rows: HeroCatalogAnimeCandidateRow[] = [
      makeCandidateRow({ id: "local-pure", anilistId: null, malId: null, kitsuId: null }, nowMs),
      makeCandidateRow(
        {
          id: "hikari-ep5-only",
          anilistId: null,
          malId: null,
          kitsuId: null,
          publishedEpisodeCount: 1,
          ep1Sources: [],
          epSources: [{ number: 5, seasonNumber: 1, videoUrl: "https://cdn.example.com/ep5.mp4" }],
        },
        nowMs,
      ),
      makeCandidateRow(
        { id: "105", ep1Sources: [{ hikariPlayerEpisodeId: "ep_valid_105" }] },
        nowMs,
      ),
      makeCandidateRow({ id: "local-mapped", anilistId: 176301, title: "Solo Leveling" }, nowMs),
    ];

    const scored = scoreAndDeduplicateHeroCandidates(rows, [], nowMs);
    const ids = scored.map((s) => s.anime.id).sort();
    assert.deepEqual(ids, ["105", "176301", "hikari-ep5-only", "local-pure"]);

    const mapped = scored.find((s) => s.anime.id === "176301");
    assert.equal(mapped?.anime.serverCatalogId, "local-mapped");
    assert.equal(mapped?.hasPublishedEpisode, true);

    const ep5Only = scored.find((s) => s.anime.id === "hikari-ep5-only");
    assert.equal(ep5Only?.anime.firstAvailableEpisodeNumber, 5);
  });

  it("3. canonically deduplicates an anime appearing in both Em Alta and Published Episodes (and dubbed vs subbed)", () => {
    const nowMs = Date.UTC(2026, 4, 15, 12, 0, 0);
    const rows: HeroCatalogAnimeCandidateRow[] = [
      makeCandidateRow(
        {
          id: "113415",
          title: "Jujutsu Kaisen",
          titleRomaji: "Jujutsu Kaisen",
          titleEnglish: "JUJUTSU KAISEN",
          score: 86,
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
    assert.equal(scored[0].hasPublishedEpisode, true);

    const pool = buildHeroBannerPool(scored, nowMs);
    assert.equal(pool.items.length, 1);
  });

  it("4. excludes animes outside the two approved groups (unpublished, invalid sources, calendar-only, engagement-only, freshly registered)", () => {
    const nowMs = Date.UTC(2026, 4, 15, 12, 0, 0);
    const rows: HeroCatalogAnimeCandidateRow[] = [
      // Sem episódio publicado e fora de Em Alta
      makeCandidateRow({ id: "910001", publishedEpisodeCount: 0, ep1Sources: [], epSources: [] }, nowMs),
      // Fonte inválida (#) e fora de Em Alta
      makeCandidateRow({ id: "910002", publishedEpisodeCount: 1, ep1Sources: [{ videoUrl: "#" }] }, nowMs),
      // Campo legado simulado de calendário/recorrência sem episódio publicado e fora de Em Alta
      {
        ...makeCandidateRow({ id: "910003", publishedEpisodeCount: 0, ep1Sources: [], epSources: [] }, nowMs),
        hasTodayAiringSchedule: true,
        hasTodayWeeklyRecurrence: true,
      } as HeroCatalogAnimeCandidateRow,
      // Válido via Grupo 2
      makeCandidateRow({ id: "5081", title: "Bakemonogatari", titleRomaji: "Bakemonogatari" }, nowMs),
    ];

    const scored = scoreAndDeduplicateHeroCandidates(rows, [], nowMs);
    assert.deepEqual(
      scored.map((s) => s.anime.id),
      ["5081"],
    );

    const heroServerSource = readFileSync(
      resolve(process.cwd(), "src/lib/home-hero.server.ts"),
      "utf8",
    );
    assert.equal(heroServerSource.includes("airing_stats"), false);
    assert.equal(heroServerSource.includes("recurrence_stats"), false);
    assert.equal(heroServerSource.includes("recent_engagement_ids"), false);
    assert.equal(heroServerSource.includes("user_anime_tracking"), false);
    assert.equal(heroServerSource.includes("queryAudienceMetricsFromNeon"), false);
  });

  it("5. excludes hidden, archived, and +18/Hentai candidates even if present in trendingItems", () => {
    const nowMs = Date.UTC(2026, 4, 15, 12, 0, 0);
    const rows: HeroCatalogAnimeCandidateRow[] = [
      makeCandidateRow({ id: "101", hidden: true }, nowMs),
      makeCandidateRow({ id: "102", genres: ["Action", "Hentai"] }, nowMs),
      makeCandidateRow({ id: "103", archivedAt: new Date(nowMs - DAY_MS).toISOString() }, nowMs),
      makeCandidateRow({ id: "bad/id", anilistId: null, malId: null, kitsuId: null }, nowMs),
      makeCandidateRow({ id: "104", title: "Valid Anime", titleRomaji: "Valid Anime" }, nowMs),
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

  it("6. rotates position [0] across consecutive 15-minute windows without Bakemonogatari locking slot 0 (both distinct-banner and single-distinct + cover-only)", () => {
    const t0 = Date.UTC(2026, 4, 15, 12, 0, 0);

    // Caso A: Bakemonogatari é o ÚNICO com banner horizontal distinto (Grupo 2) e Em Alta tem animes apenas com cover
    const singleDistinctRows: HeroCatalogAnimeCandidateRow[] = [
      makeCandidateRow(
        {
          id: "5081",
          title: "Bakemonogatari",
          titleRomaji: "Bakemonogatari",
          banner: "https://cdn.example.com/banner-5081.jpg",
          cover: "https://cdn.example.com/cover-5081.jpg",
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

    // Caso B: 6 banners distintos (4 Em Alta + 2 Episódios publicados) + 6 cover-only -> banners distintos ficam à frente dos cover-only e [0] gira entre todos os 6
    const mixedRows: HeroCatalogAnimeCandidateRow[] = [
      ...Array.from({ length: 6 }, (_, i) =>
        makeCandidateRow({ id: String(800101 + i) }, t0),
      ),
      ...Array.from({ length: 6 }, (_, i) =>
        makeCandidateRow(
          {
            id: String(800001 + i),
            banner: i % 2 === 0 ? null : `https://cdn.example.com/cover-${800001 + i}.jpg`,
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
  });

  it("7. keeps 1 static slide without fabricating animes when only 1 valid candidate exists across both groups", async () => {
    const t0 = Date.UTC(2026, 4, 15, 12, 0, 0);
    const singleValidRows: HeroCatalogAnimeCandidateRow[] = [
      makeCandidateRow({ id: "5081", title: "Bakemonogatari", titleRomaji: "Bakemonogatari" }, t0),
      makeCandidateRow({ id: "930001", publishedEpisodeCount: 0, ep1Sources: [], epSources: [] }, t0),
      makeCandidateRow({ id: "930002", publishedEpisodeCount: 0, ep1Sources: [], epSources: [] }, t0),
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

  it("8. avoids getHomeTrendingItems and queryCatalog calls on RAM and Redis cache hits", async () => {
    const t0 = Date.UTC(2026, 4, 15, 12, 0, 0);
    const rows = Array.from({ length: 12 }, (_, i) =>
      makeCandidateRow({ id: String(400001 + i) }, t0),
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
  });

  it("9. explicit invalidation clears ramHeroPool, staleHeroPool, and Redis Hero/Em Alta keys+generations (and fails open on Redis error)", async () => {
    const nowMs = Date.UTC(2026, 4, 15, 12, 0, 0);
    const rows = Array.from({ length: 8 }, (_, i) =>
      makeCandidateRow({ id: String(600001 + i) }, nowMs),
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

    // 9c. Fail-open when Redis throws during async invalidation
    mockRedis.shouldThrow = true;
    await assert.doesNotReject(async () => {
      await invalidateHomeHeroCacheAsync(mockRedis);
      await invalidateHomePublicEpisodesCacheAsync({ redisOverride: mockRedis });
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
    resolveInFlightCatalog([makeCandidateRow({ id: "5081", title: "Old Inflight" }, nowMs)]);
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
          bucket: "episodios_publicados",
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

      const validAnimeRow = makeCandidateRow({ id: "960001" }, nowMs);
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
      const prodRow = makeCandidateRow({ id: "960002" }, nowMs);
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

  it("preserves temporal decay for published episodes and safe pickHeroItems fallback", () => {
    const nowMs = Date.UTC(2026, 4, 15, 12, 0, 0);
    const rows: HeroCatalogAnimeCandidateRow[] = [
      makeCandidateRow(
        {
          id: "900001",
          createdAt: new Date(nowMs - 180 * DAY_MS).toISOString(),
          updatedAt: new Date(nowMs - 10 * 60 * 1000).toISOString(),
          firstEpisodePublishedAt: new Date(nowMs - 170 * DAY_MS).toISOString(),
          latestEpisodePublishedAt: new Date(nowMs - 60 * DAY_MS).toISOString(),
        },
        nowMs,
      ),
      makeCandidateRow(
        {
          id: "900002",
          createdAt: new Date(nowMs - 180 * DAY_MS).toISOString(),
          firstEpisodePublishedAt: new Date(nowMs - 170 * DAY_MS).toISOString(),
          latestEpisodePublishedAt: new Date(nowMs - 2 * HOUR_MS).toISOString(),
        },
        nowMs,
      ),
      makeCandidateRow(
        {
          id: "900003",
          createdAt: new Date(nowMs - 180 * DAY_MS).toISOString(),
          firstEpisodePublishedAt: new Date(nowMs - 170 * DAY_MS).toISOString(),
          latestEpisodePublishedAt: new Date(nowMs - 8 * DAY_MS).toISOString(),
        },
        nowMs,
      ),
    ];

    const scored = scoreAndDeduplicateHeroCandidates(rows, [], nowMs);
    const byId = new Map(scored.map((c) => [c.anime.id, c]));
    assert.equal(byId.get("900001")!.noveltyScore, 0);
    assert.equal(byId.get("900001")!.newEpisodeScore, 0);
    assert.ok(byId.get("900002")!.newEpisodeScore > byId.get("900003")!.newEpisodeScore);

    const noEpisodeResult = pickHeroItems(
      [makeTrendingSlim({ id: "1", banner: "https://cdn.example.com/b-1.jpg" }), makeTrendingSlim({ id: "2", banner: "https://cdn.example.com/b-2.jpg" })],
      [makeTrendingSlim({ id: "3", banner: "https://cdn.example.com/b-3.jpg" })],
      [],
    );
    assert.equal(noEpisodeResult.length, 3);
  });
});
