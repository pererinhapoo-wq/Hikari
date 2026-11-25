import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import {
  getHomeTrendingItemsWithDeps,
  invalidateHomeTrendingLocalCache,
  resetHomeTrendingTestState,
  scoreAndRankHomeTrending,
  type HomeTrendingDeps,
  type TrendingCatalogAnimeCandidateRow,
  type TrendingUserAnimeSignalRow,
} from "@/lib/home-trending.server";
import type { AnimeRecentBadgesLookup } from "@/lib/catalog-badges";
import {
  getRedisHomeTrendingWithFence,
  HOME_TRENDING_GEN_KEY,
  HOME_TRENDING_REDIS_KEY,
  invalidateRedisHomeTrending,
  setRedisHomeTrending,
  type RedisEvalClient,
} from "@/lib/redis";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function emptyBadgesLookup(): AnimeRecentBadgesLookup {
  return {
    byId: new Map(),
    byAnilistId: new Map(),
    byMalId: new Map(),
    byKitsuId: new Map(),
  };
}

function makeCandidateRow(
  overrides: Partial<TrendingCatalogAnimeCandidateRow> & { id: string },
  nowMs = Date.UTC(2026, 4, 15, 12, 0, 0),
): TrendingCatalogAnimeCandidateRow {
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
    format: "TV",
    status: "RELEASING",
    episodesCount: 12,
    year: 2026,
    season: "SPRING",
    genres: ["Action", "Fantasy"],
    hidden: false,
    score: 75,
    popularity: 25000,
    trending: 0,
    updatedAt: new Date(nowMs - 20 * DAY_MS).toISOString(),
    publishedEpisodeCount: 12,
    latestEpisodePublishedAt: new Date(nowMs - 20 * DAY_MS).toISOString(),
    epSources: [{ videoUrl: `https://cdn.example.com/ep1-${overrides.id}.mp4` }],
    ...overrides,
  };
}

class MockTrendingRedis implements RedisEvalClient {
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
      throw new Error("Simulated Redis failure");
    }
    const strArgs = (args ?? []).map((a) => String(a));

    if (
      script.includes('redis.call("GET", KEYS[1])') &&
      script.includes("out = { v")
    ) {
      const v = this.store.get(keys[0]) ?? null;
      const g = this.store.get(keys[1]) ?? "0";
      return [v ? `:${v}` : "", `:${g}`] as TData;
    }

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

    if (
      script.includes("tonumber(ARGV[1])") &&
      script.includes('redis.call("DEL"')
    ) {
      const n = Number(strArgs[0] ?? 0) || 0;
      for (let i = 0; i < n; i++) {
        this.incr(keys[i]);
      }
      for (let i = n; i < keys.length; i++) {
        this.store.delete(keys[i]);
      }
      return n as TData;
    }

    throw new Error("Unsupported Lua script in MockTrendingRedis");
  }

  async keys(pattern: string): Promise<string[]> {
    if (this.shouldThrow) throw new Error("Simulated Redis failure");
    const prefix = pattern.endsWith("*") ? pattern.slice(0, -1) : pattern;
    return Array.from(this.store.keys()).filter((k) =>
      pattern.endsWith("*") ? k.startsWith(prefix) : k === pattern,
    );
  }

  async del(...keys: string[]): Promise<number> {
    if (this.shouldThrow) throw new Error("Simulated Redis failure");
    let removed = 0;
    for (const k of keys) {
      if (this.store.delete(k)) removed += 1;
    }
    return removed;
  }
}

describe("home-trending native data & calendar evolution", () => {
  beforeEach(() => {
    resetHomeTrendingTestState();
  });

  it("1. newly registered anime without relevance signals does not enter Em Alta automatically", () => {
    const nowMs = Date.UTC(2026, 4, 15, 12, 0, 0);
    const rows = [
      // Recém-cadastrado hoje, inclusive marcado na temporada atual, mas sem popularidade real, sem ep, sem calendário e sem engajamento
      makeCandidateRow(
        {
          id: "bare-new",
          publishedEpisodeCount: 0,
          epSources: [],
          score: 50,
          popularity: 100,
          trending: 0,
          season: "SPRING",
          year: 2026,
          updatedAt: new Date(nowMs - 5 * 60 * 1000).toISOString(),
        },
        nowMs,
      ),
      makeCandidateRow({ id: "active-1", publishedEpisodeCount: 1 }, nowMs),
    ];

    const signals: TrendingUserAnimeSignalRow[] = [
      {
        userId: "u1",
        animeId: "active-1",
        playbackAt: new Date(nowMs - HOUR_MS).toISOString(),
        progressAt: null,
      },
    ];

    const scored = scoreAndRankHomeTrending(
      rows,
      emptyBadgesLookup(),
      signals,
      nowMs,
    );
    assert.equal(
      scored.some((s) => s.anime.id === "bare-new"),
      false,
    );
    assert.ok(scored.some((s) => s.anime.id === "active-1"));
  });

  it("2. community popular anime can appear via playback, progress, and comment signals even without external popularity metadata", () => {
    const nowMs = Date.UTC(2026, 4, 15, 12, 0, 0);
    const rows = [
      // Anime local sem popularity/score/temporada externos, mas popular na comunidade Hikari
      makeCandidateRow(
        {
          id: "local-community-hit",
          anilistId: null,
          popularity: null,
          score: null,
          trending: null,
          season: null,
          year: null,
          publishedEpisodeCount: 1,
          latestEpisodePublishedAt: new Date(nowMs - 40 * DAY_MS).toISOString(),
        },
        nowMs,
      ),
      makeCandidateRow(
        {
          id: "pop-2",
          season: "WINTER",
          year: 2024,
          latestEpisodePublishedAt: new Date(nowMs - 40 * DAY_MS).toISOString(),
        },
        nowMs,
      ),
    ];

    const signals: TrendingUserAnimeSignalRow[] = [
      {
        userId: "u1",
        animeId: "local-community-hit",
        playbackAt: new Date(nowMs - 2 * HOUR_MS).toISOString(),
        progressAt: null,
      },
      {
        userId: "u2",
        animeId: "local-community-hit",
        playbackAt: null,
        progressAt: new Date(nowMs - 3 * HOUR_MS).toISOString(),
      },
      {
        userId: "u3",
        animeId: "local-community-hit",
        playbackAt: null,
        progressAt: null,
        commentAt: new Date(nowMs - 4 * HOUR_MS).toISOString(),
      },
    ];

    const scored = scoreAndRankHomeTrending(
      rows,
      emptyBadgesLookup(),
      signals,
      nowMs,
    );
    assert.equal(scored.length, 1);
    assert.equal(scored[0].anime.id, "local-community-hit");
    assert.ok(scored[0].audienceScore > 0);
    assert.equal(scored[0].uniqueUsers, 3);
  });

  it("3. anime scheduled for launch today (airing schedule or weekly recurrence) can appear even without published episodes in Hikari", () => {
    const nowMs = Date.UTC(2026, 4, 15, 12, 0, 0);
    const rows = [
      makeCandidateRow(
        {
          id: "sched-today",
          publishedEpisodeCount: 0,
          epSources: [],
          hasTodayAiringSchedule: true,
          season: "WINTER",
          year: 2024,
        },
        nowMs,
      ),
      makeCandidateRow(
        {
          id: "recurrence-today",
          publishedEpisodeCount: 0,
          epSources: [],
          hasTodayWeeklyRecurrence: true,
          season: "WINTER",
          year: 2024,
        },
        nowMs,
      ),
    ];

    const scored = scoreAndRankHomeTrending(
      rows,
      emptyBadgesLookup(),
      [],
      nowMs,
    );
    assert.equal(scored.length, 2);
    for (const item of scored) {
      assert.equal(item.anime.hasEpisode, false);
      assert.equal(item.publishedEpisodeBoost, 0);
      assert.ok(item.calendarBoost > 0);
    }
  });

  it("4. published episode is considered independently of scheduled launch", () => {
    const nowMs = Date.UTC(2026, 4, 15, 12, 0, 0);
    const rows = [
      makeCandidateRow(
        {
          id: "pub-only",
          season: "WINTER",
          year: 2024,
          popularity: 500,
          score: 65,
          publishedEpisodeCount: 5,
          latestEpisodePublishedAt: new Date(nowMs - 6 * HOUR_MS).toISOString(),
          hasTodayAiringSchedule: false,
          hasWeekAiringSchedule: false,
          hasTodayWeeklyRecurrence: false,
          hasActiveWeeklyRecurrence: false,
        },
        nowMs,
      ),
    ];

    const scored = scoreAndRankHomeTrending(
      rows,
      emptyBadgesLookup(),
      [],
      nowMs,
    );
    assert.equal(scored.length, 1);
    assert.equal(scored[0].anime.id, "pub-only");
    assert.equal(scored[0].anime.hasEpisode, true);
    assert.equal(scored[0].calendarBoost, 0);
    assert.ok(scored[0].publishedEpisodeBoost > 0);
  });

  it("5. popular animes of the current season can be considered without AniList or registration date bias", () => {
    const nowMs = Date.UTC(2026, 4, 15, 12, 0, 0);
    const rows = [
      makeCandidateRow(
        {
          id: "current-season-high",
          season: "SPRING",
          year: 2026,
          popularity: 80000,
          trending: 120,
          score: 88,
          publishedEpisodeCount: 1,
          latestEpisodePublishedAt: new Date(nowMs - 40 * DAY_MS).toISOString(),
        },
        nowMs,
      ),
      makeCandidateRow(
        {
          id: "current-season-mid",
          season: "SPRING",
          year: 2026,
          popularity: 4000,
          trending: 0,
          score: 72,
          publishedEpisodeCount: 1,
          latestEpisodePublishedAt: new Date(nowMs - 40 * DAY_MS).toISOString(),
        },
        nowMs,
      ),
      makeCandidateRow(
        {
          id: "old-season-high",
          season: "WINTER",
          year: 2023,
          popularity: 90000,
          trending: 150,
          score: 90,
          publishedEpisodeCount: 12,
          latestEpisodePublishedAt: new Date(nowMs - 365 * DAY_MS).toISOString(),
        },
        nowMs,
      ),
    ];

    const scored = scoreAndRankHomeTrending(
      rows,
      emptyBadgesLookup(),
      [],
      nowMs,
    );
    assert.equal(scored.length, 2);
    assert.equal(scored[0].anime.id, "current-season-high");
    assert.equal(scored[1].anime.id, "current-season-mid");
    assert.ok(scored[0].seasonBoost > scored[1].seasonBoost);
    assert.equal(
      scored.some((s) => s.anime.id === "old-season-high"),
      false,
    );
  });

  it("6. user personal profile lists and manual watched marks do not influence selection", () => {
    const nowMs = Date.UTC(2026, 4, 15, 12, 0, 0);
    const rows = [
      makeCandidateRow(
        {
          id: "profile-list-item",
          publishedEpisodeCount: 0,
          epSources: [],
          score: 50,
          popularity: 100,
          season: "WINTER",
          year: 2024,
        },
        nowMs,
      ),
    ];

    // Marcações manuais ("assistido") e listas de perfil não devem promover o anime
    const manualOnlySignals: TrendingUserAnimeSignalRow[] = [
      {
        userId: "u1",
        animeId: "profile-list-item",
        playbackAt: null,
        progressAt: null,
        manualAt: new Date(nowMs - HOUR_MS).toISOString(),
      },
      {
        userId: "u2",
        animeId: "profile-list-item",
        playbackAt: null,
        progressAt: null,
        manualAt: new Date(nowMs - 2 * HOUR_MS).toISOString(),
      },
    ];

    const scored = scoreAndRankHomeTrending(
      rows,
      emptyBadgesLookup(),
      manualOnlySignals,
      nowMs,
    );
    assert.equal(scored.length, 0);
  });

  it("7. absence of calendar or season data does not cause fabricated or padded results", async () => {
    const nowMs = Date.UTC(2026, 4, 15, 12, 0, 0);
    const rows = [
      makeCandidateRow(
        {
          id: "no-signals-0ep",
          publishedEpisodeCount: 0,
          epSources: [],
          season: null,
          year: null,
          score: 40,
          popularity: 10,
          hasTodayAiringSchedule: false,
        },
        nowMs,
      ),
      makeCandidateRow(
        {
          id: "stale-2020-catalog",
          publishedEpisodeCount: 24,
          latestEpisodePublishedAt: new Date(nowMs - 500 * DAY_MS).toISOString(),
          season: "FALL",
          year: 2020,
          score: 82,
          popularity: 45000,
          hasTodayAiringSchedule: false,
        },
        nowMs,
      ),
    ];

    const scored = scoreAndRankHomeTrending(
      rows,
      emptyBadgesLookup(),
      [],
      nowMs,
    );
    assert.equal(scored.length, 0);

    const items = await getHomeTrendingItemsWithDeps(
      {
        getRedisTrending: async () => ({
          status: "unavailable",
          payload: null,
          fence: null,
        }),
        setRedisTrending: async () => "unavailable",
        scheduleWrite: () => {},
        queryCatalog: async () => rows,
        queryBadges: async () => emptyBadgesLookup(),
        queryAudienceSignals: async () => [],
      },
      nowMs,
    );
    assert.deepEqual(items, []);
  });

  it("8. cache and invalidations work without harming category updates", async () => {
    const nowMs = Date.UTC(2026, 4, 15, 12, 0, 0);
    const mockRedis = new MockTrendingRedis();
    const bgWrites: Promise<unknown>[] = [];

    let catalogQueries = 0;
    let currentRows = [makeCandidateRow({ id: "888" }, nowMs)];

    const deps: HomeTrendingDeps = {
      getRedisTrending: () => getRedisHomeTrendingWithFence(mockRedis),
      setRedisTrending: (payload, fence) =>
        setRedisHomeTrending(payload, fence, mockRedis),
      scheduleWrite: (promise) => {
        bgWrites.push(promise);
      },
      queryCatalog: async () => {
        catalogQueries += 1;
        return currentRows;
      },
      queryBadges: async () => emptyBadgesLookup(),
      queryAudienceSignals: async () => [],
    };

    const res1 = await getHomeTrendingItemsWithDeps(deps, nowMs);
    await Promise.all(bgWrites);
    assert.equal(res1.length, 1);
    assert.equal(res1[0].id, "888");
    assert.equal(catalogQueries, 1);
    assert.equal(mockRedis.store.has(HOME_TRENDING_REDIS_KEY), true);

    // Hit em cache RAM não reconsulta Neon
    const resCached = await getHomeTrendingItemsWithDeps(deps, nowMs + 60_000);
    assert.equal(resCached.length, 1);
    assert.equal(catalogQueries, 1);

    // Simula outra instância com RAM limpa lendo do Redis compartilhado
    invalidateHomeTrendingLocalCache();
    const resRedisHit = await getHomeTrendingItemsWithDeps(deps, nowMs + 60_000);
    assert.equal(resRedisHit[0].id, "888");
    assert.equal(catalogQueries, 1);

    // Invalidação limpa RAM e Redis + incrementa geração
    currentRows = [makeCandidateRow({ id: "999" }, nowMs)];
    invalidateHomeTrendingLocalCache();
    await invalidateRedisHomeTrending(mockRedis);
    assert.equal(mockRedis.store.get(HOME_TRENDING_GEN_KEY), "1");

    const read = await getRedisHomeTrendingWithFence(mockRedis);
    assert.equal(read.status, "miss");
    assert.equal(read.fence, "1");

    const resAfterInvalidation = await getHomeTrendingItemsWithDeps(
      deps,
      nowMs + 120_000,
    );
    assert.equal(catalogQueries, 2);
    assert.equal(resAfterInvalidation[0].id, "999");

    // Fence evita gravação stale se houver invalidação concorrente
    const staleWrite = await setRedisHomeTrending(
      { v: 1, generatedAt: nowMs, items: res1 },
      "0",
      mockRedis,
    );
    assert.equal(staleWrite, "fenced");
  });
});
