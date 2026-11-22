import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import {
  buildHomeTrendingPayload,
  getHomeTrendingItemsWithDeps,
  invalidateHomeTrendingLocalCache,
  MAX_HOME_TRENDING_CACHE_ITEMS,
  MAX_HOME_TRENDING_ITEMS,
  resetHomeTrendingTestState,
  scoreAndRankHomeTrending,
  type HomeTrendingDeps,
  type TrendingCatalogAnimeCandidateRow,
  type TrendingUserAnimeSignalRow,
} from "@/lib/home-trending.server";
import type { AnimeRecentBadgesLookup } from "@/lib/catalog-badges";
import {
  countDistinctTitlesWithEpisode,
  selectHomeSectionItems,
} from "@/lib/anime-search-ranking";
import { overlayList } from "@/lib/overlay";
import {
  getRedisHomeTrendingWithFence,
  HOME_TRENDING_GEN_KEY,
  HOME_TRENDING_REDIS_KEY,
  invalidateRedisHomeTrending,
  setRedisHomeTrending,
  type HomeTrendingPayload,
  type RedisEvalClient,
} from "@/lib/redis";
import type { SlimAnime } from "@/lib/types";

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
    status: "FINISHED",
    episodesCount: 12,
    year: 2026,
    season: "SPRING",
    genres: ["Action", "Fantasy"],
    hidden: false,
    score: 75,
    popularity: 25000,
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

    // GET_ENVELOPE_OR_FENCE_SCRIPT
    if (
      script.includes('redis.call("GET", KEYS[1])') &&
      script.includes("out = { v")
    ) {
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

describe("home-trending real audience ranking & caching", () => {
  beforeEach(() => {
    resetHomeTrendingTestState();
  });

  it("1. enforces signal hierarchy playback > progress > tracking > manual", () => {
    const nowMs = Date.UTC(2026, 4, 15, 12, 0, 0);
    const tsRecent = new Date(nowMs - 6 * HOUR_MS).toISOString();

    const rows = [
      makeCandidateRow({ id: "101" }, nowMs),
      makeCandidateRow({ id: "102" }, nowMs),
      makeCandidateRow({ id: "103" }, nowMs),
      makeCandidateRow({ id: "104" }, nowMs),
    ];

    const signals: TrendingUserAnimeSignalRow[] = [
      { userId: "u1", animeId: "104", playbackAt: null, progressAt: null, trackingAt: null, manualAt: tsRecent },
      { userId: "u2", animeId: "103", playbackAt: null, progressAt: null, trackingAt: tsRecent, manualAt: null },
      { userId: "u3", animeId: "102", playbackAt: null, progressAt: tsRecent, trackingAt: null, manualAt: null },
      { userId: "u4", animeId: "101", playbackAt: tsRecent, progressAt: null, trackingAt: null, manualAt: null },
    ];

    const scored = scoreAndRankHomeTrending(rows, emptyBadgesLookup(), signals, nowMs);
    assert.deepEqual(
      scored.map((s) => s.anime.id),
      ["101", "102", "103", "104"],
    );
    assert.equal(scored[0].audienceRaw, 5.0);
    assert.equal(scored[1].audienceRaw, 4.2);
    assert.equal(scored[2].audienceRaw, 2.2);
    assert.equal(scored[3].audienceRaw, 1.1);
  });

  it("2. enforces single consolidated contribution per user/anime without stacking signals", () => {
    const nowMs = Date.UTC(2026, 4, 15, 12, 0, 0);
    const tsRecent = new Date(nowMs - 4 * HOUR_MS).toISOString();

    const rows = [
      makeCandidateRow({ id: "201" }, nowMs), // 1 usuário com todos os 4 sinais
      makeCandidateRow({ id: "202" }, nowMs), // 2 usuários com progresso (4.2 + 4.2 = 8.4)
    ];

    const signals: TrendingUserAnimeSignalRow[] = [
      // Mesmo usuário com playback + progress + tracking + manual deve valer no máximo 5.0 (não 12.5)
      { userId: "u-all", animeId: "201", playbackAt: tsRecent, progressAt: tsRecent, trackingAt: tsRecent, manualAt: tsRecent },
      { userId: "u-a", animeId: "202", playbackAt: null, progressAt: tsRecent, trackingAt: null, manualAt: null },
      { userId: "u-b", animeId: "202", playbackAt: null, progressAt: tsRecent, trackingAt: null, manualAt: null },
    ];

    const scored = scoreAndRankHomeTrending(rows, emptyBadgesLookup(), signals, nowMs);
    assert.equal(scored[0].anime.id, "202");
    assert.equal(scored[1].anime.id, "201");
    assert.equal(scored[1].audienceRaw, 5.0);
    assert.equal(scored[1].uniqueUsers, 1);
  });

  it("3. prevents a single user watching many episodes from dominating multi-user titles", () => {
    const nowMs = Date.UTC(2026, 4, 15, 12, 0, 0);
    const tsRecent = new Date(nowMs - 2 * HOUR_MS).toISOString();

    const rows = [
      makeCandidateRow({ id: "301" }, nowMs),
      makeCandidateRow({ id: "302" }, nowMs),
    ];

    // Simula múltiplas entradas de episódios para o mesmo usuário em 301 vs 3 usuários distintos em 302
    const signals: TrendingUserAnimeSignalRow[] = [
      ...Array.from({ length: 12 }, (_, idx) => ({
        userId: "binge-user",
        animeId: "301",
        playbackAt: new Date(nowMs - (idx + 1) * HOUR_MS).toISOString(),
        progressAt: tsRecent,
        trackingAt: tsRecent,
        manualAt: tsRecent,
      })),
      { userId: "u1", animeId: "302", playbackAt: null, progressAt: tsRecent, trackingAt: null, manualAt: null },
      { userId: "u2", animeId: "302", playbackAt: null, progressAt: tsRecent, trackingAt: null, manualAt: null },
      { userId: "u3", animeId: "302", playbackAt: null, progressAt: tsRecent, trackingAt: null, manualAt: null },
    ];

    const scored = scoreAndRankHomeTrending(rows, emptyBadgesLookup(), signals, nowMs);
    assert.equal(scored[0].anime.id, "302");
    assert.equal(scored[0].uniqueUsers, 3);
    assert.equal(scored[1].anime.id, "301");
    assert.equal(scored[1].uniqueUsers, 1);
    assert.equal(scored[1].audienceRaw, 5.0);
  });

  it("4. reconciles equivalent IDs (anilist, mal-*, kitsu-*, local-*) without double-counting the same user", () => {
    const nowMs = Date.UTC(2026, 4, 15, 12, 0, 0);
    const tsRecent = new Date(nowMs - 5 * HOUR_MS).toISOString();

    const rows = [
      makeCandidateRow({
        id: "local-hero-alias",
        anilistId: 176301,
        malId: 52991,
        kitsuId: 46474,
      }, nowMs),
      makeCandidateRow({ id: "176302" }, nowMs),
    ];

    const signals: TrendingUserAnimeSignalRow[] = [
      // Mesmo usuário aparece com 4 aliases do mesmo anime
      { userId: "u-dup", animeId: "local-hero-alias", playbackAt: null, progressAt: null, trackingAt: tsRecent, manualAt: null },
      { userId: "u-dup", animeId: "176301", playbackAt: tsRecent, progressAt: null, trackingAt: null, manualAt: null },
      { userId: "u-dup", animeId: "mal-52991", playbackAt: null, progressAt: tsRecent, trackingAt: null, manualAt: null },
      { userId: "u-dup", animeId: "kitsu-46474", playbackAt: null, progressAt: null, trackingAt: null, manualAt: tsRecent },
      // Dois usuários distintos no anime 176302 (2 * 4.2 = 8.4 > 5.0)
      { userId: "u-x", animeId: "176302", playbackAt: null, progressAt: tsRecent, trackingAt: null, manualAt: null },
      { userId: "u-y", animeId: "176302", playbackAt: null, progressAt: tsRecent, trackingAt: null, manualAt: null },
    ];

    const scored = scoreAndRankHomeTrending(rows, emptyBadgesLookup(), signals, nowMs);
    assert.equal(scored[0].anime.id, "176302");
    assert.equal(scored[1].anime.id, "176301");
    assert.equal(scored[1].uniqueUsers, 1);
    assert.equal(scored[1].audienceRaw, 5.0);
  });

  it("5. consolidates dubbed and subbed variants into one original card combining distinct users", () => {
    const nowMs = Date.UTC(2026, 4, 15, 12, 0, 0);
    const tsRecent = new Date(nowMs - 3 * HOUR_MS).toISOString();

    const rows = [
      makeCandidateRow({
        id: "local-dub-solo",
        title: "Solo Leveling (Dublado)",
        titleRomaji: "Solo Leveling (Dublado)",
        titleEnglish: "Solo Leveling (Dublado)",
        anilistId: null, // variante sem ID externo
      }, nowMs),
      makeCandidateRow({
        id: "151807",
        title: "Solo Leveling",
        titleRomaji: "Solo Leveling",
        titleEnglish: "Solo Leveling",
        anilistId: 151807,
      }, nowMs),
      makeCandidateRow({
        id: "151808",
        title: "Outro Anime",
        titleRomaji: "Outro Anime",
        titleEnglish: "Outro Anime",
      }, nowMs),
    ];

    const signals: TrendingUserAnimeSignalRow[] = [
      // u1 assistiu tanto legendado quanto dublado -> conta apenas 1 vez (5.0)
      { userId: "u1", animeId: "151807", playbackAt: null, progressAt: null, trackingAt: tsRecent, manualAt: null },
      { userId: "u1", animeId: "local-dub-solo", playbackAt: tsRecent, progressAt: null, trackingAt: null, manualAt: null },
      // u2 assistiu apenas a versão dublada -> soma para a mesma obra
      { userId: "u2", animeId: "local-dub-solo", playbackAt: tsRecent, progressAt: null, trackingAt: null, manualAt: null },
      // Outro anime com 1 usuário
      { userId: "u3", animeId: "151808", playbackAt: tsRecent, progressAt: null, trackingAt: null, manualAt: null },
    ];

    const scored = scoreAndRankHomeTrending(rows, emptyBadgesLookup(), signals, nowMs);
    assert.equal(scored.length, 2);
    assert.equal(scored[0].anime.id, "151807");
    assert.equal(scored[0].uniqueUsers, 2);
    assert.equal(scored[0].audienceRaw, 10.0);
  });

  it("6. does not merge distinct works solely because of title similarity", () => {
    const nowMs = Date.UTC(2026, 4, 15, 12, 0, 0);
    const tsRecent = new Date(nowMs - 2 * HOUR_MS).toISOString();

    const rows = [
      makeCandidateRow({
        id: "401",
        anilistId: 401,
        title: "Jujutsu Kaisen",
        titleRomaji: "Jujutsu Kaisen",
        titleEnglish: "Jujutsu Kaisen",
      }, nowMs),
      makeCandidateRow({
        id: "402",
        anilistId: 402,
        title: "Jujutsu Kaisen 2nd Season",
        titleRomaji: "Jujutsu Kaisen 2nd Season",
        titleEnglish: "Jujutsu Kaisen 2nd Season",
      }, nowMs),
      // Mesmo título-base mas com anilistIds explicitamente diferentes (ex.: adaptação/remake distinto)
      makeCandidateRow({
        id: "403",
        anilistId: 403,
        title: "Hunter x Hunter",
        titleRomaji: "Hunter x Hunter",
        titleEnglish: "Hunter x Hunter",
      }, nowMs),
      makeCandidateRow({
        id: "404",
        anilistId: 404,
        title: "Hunter x Hunter (Dublado)",
        titleRomaji: "Hunter x Hunter (Dublado)",
        titleEnglish: "Hunter x Hunter (Dublado)",
      }, nowMs),
    ];

    const signals: TrendingUserAnimeSignalRow[] = [
      { userId: "u1", animeId: "401", playbackAt: tsRecent, progressAt: null, trackingAt: null, manualAt: null },
      { userId: "u2", animeId: "402", playbackAt: tsRecent, progressAt: null, trackingAt: null, manualAt: null },
    ];

    const scored = scoreAndRankHomeTrending(rows, emptyBadgesLookup(), signals, nowMs);
    assert.equal(scored.length, 4);
    assert.ok(scored.some((s) => s.anime.id === "401"));
    assert.ok(scored.some((s) => s.anime.id === "402"));
    assert.ok(scored.some((s) => s.anime.id === "403"));
    assert.ok(scored.some((s) => s.anime.id === "404"));
  });

  it("7 & 8. applies temporal decay across exclusive windows and safely ignores null/invalid/expired/future dates", () => {
    const nowMs = Date.UTC(2026, 4, 15, 12, 0, 0);
    const rows = [
      makeCandidateRow({ id: "501" }, nowMs), // 0-48h (5.0)
      makeCandidateRow({ id: "502" }, nowMs), // 2-7d (3.5)
      makeCandidateRow({ id: "503" }, nowMs), // 7-14d (1.6)
      makeCandidateRow({ id: "504" }, nowMs), // 14-30d (0.5)
      makeCandidateRow({ id: "505", popularity: 999999, score: 99 }, nowMs), // datas inválidas/expiradas -> sem audiência real
    ];

    const signals: TrendingUserAnimeSignalRow[] = [
      { userId: "u1", animeId: "504", playbackAt: new Date(nowMs - 20 * DAY_MS).toISOString(), progressAt: null, trackingAt: null, manualAt: null },
      { userId: "u2", animeId: "503", playbackAt: new Date(nowMs - 10 * DAY_MS).toISOString(), progressAt: null, trackingAt: null, manualAt: null },
      { userId: "u3", animeId: "502", playbackAt: new Date(nowMs - 4 * DAY_MS).toISOString(), progressAt: null, trackingAt: null, manualAt: null },
      { userId: "u4", animeId: "501", playbackAt: new Date(nowMs - 12 * HOUR_MS).toISOString(), progressAt: null, trackingAt: null, manualAt: null },
      // Casos inválidos/expirados para 505
      { userId: "u5", animeId: "505", playbackAt: new Date(nowMs - 31 * DAY_MS).toISOString(), progressAt: "data-invalida", trackingAt: null, manualAt: new Date(nowMs + 2 * DAY_MS).toISOString() },
    ];

    const scored = scoreAndRankHomeTrending(rows, emptyBadgesLookup(), signals, nowMs);
    assert.deepEqual(
      scored.map((s) => s.anime.id),
      ["501", "502", "503", "504", "505"],
    );
    assert.equal(scored[0].audienceRaw, 5.0);
    assert.equal(scored[1].audienceRaw, 3.5);
    assert.equal(scored[2].audienceRaw, 1.6);
    assert.equal(scored[3].audienceRaw, 0.5);
    assert.equal(scored[4].audienceRaw, 0);
    assert.equal(scored[4].isFallbackFill, true);
  });

  it("9, 10 & 11. excludes hidden, adult (+18/Hentai/Eroge/Rx), non-playable, invalid cover, and pure local-* without external ID", () => {
    const nowMs = Date.UTC(2026, 4, 15, 12, 0, 0);
    const rows: TrendingCatalogAnimeCandidateRow[] = [
      makeCandidateRow({ id: "601", hidden: true }, nowMs),
      makeCandidateRow({ id: "602", genres: ["Action", "Hentai"] }, nowMs),
      makeCandidateRow({ id: "603", genres: ["+18"] }, nowMs),
      makeCandidateRow({ id: "604", genres: ["Eroge"] }, nowMs),
      makeCandidateRow({ id: "605", genres: ["Rx"] }, nowMs),
      makeCandidateRow({ id: "606", publishedEpisodeCount: 0, epSources: [] }, nowMs),
      makeCandidateRow({ id: "607", epSources: [{ videoUrl: "https://www.youtube.com/watch?v=abc" }] }, nowMs),
      makeCandidateRow({ id: "608", cover: "#" }, nowMs),
      makeCandidateRow({ id: "local-pure", anilistId: null, malId: null, kitsuId: null }, nowMs),
      // local-* COM ID externo válido DEVE ser aceito com ID navegável externo
      makeCandidateRow({ id: "local-valid", anilistId: 609, malId: null, kitsuId: null }, nowMs),
      // hikariPlayerEpisodeId válido DEVE ser aceito
      makeCandidateRow({ id: "610", epSources: [{ hikariPlayerEpisodeId: "ep-610-1" }] }, nowMs),
    ];

    const scored = scoreAndRankHomeTrending(rows, emptyBadgesLookup(), [], nowMs);
    assert.deepEqual(
      scored.map((s) => s.anime.id).sort(),
      ["609", "610"],
    );
    assert.equal(
      scored.find((s) => s.anime.id === "609")?.anime.serverCatalogId,
      "local-valid",
    );
  });

  it("12 & 13. deterministically fills up to 18 items without artificial rotation and without letting zero-audience titles overtake real activity", () => {
    const nowMs = Date.UTC(2026, 4, 15, 12, 0, 0);
    const rows: TrendingCatalogAnimeCandidateRow[] = Array.from(
      { length: 22 },
      (_, i) =>
        makeCandidateRow({
          id: String(700 + i),
          score: i === 20 ? 99 : 65,
          popularity: i === 20 ? 999999 : 1000 + i * 100,
          status: i === 20 ? "RELEASING" : "FINISHED",
        }, nowMs),
    );

    // Somente o anime de menor nota/popularidade (700) possui atividade manual mínima (0.15)
    const signals: TrendingUserAnimeSignalRow[] = [
      {
        userId: "u-single",
        animeId: "700",
        playbackAt: null,
        progressAt: null,
        trackingAt: null,
        manualAt: new Date(nowMs - 20 * DAY_MS).toISOString(),
      },
    ];

    const scoredA = scoreAndRankHomeTrending(rows, emptyBadgesLookup(), signals, nowMs);
    const scoredB = scoreAndRankHomeTrending(rows, emptyBadgesLookup(), signals, nowMs);

    const payloadA = buildHomeTrendingPayload(scoredA, nowMs, MAX_HOME_TRENDING_CACHE_ITEMS);
    const payloadB = buildHomeTrendingPayload(scoredB, nowMs, MAX_HOME_TRENDING_CACHE_ITEMS);

    assert.equal(payloadA.items.length, 22);
    assert.equal(payloadA.items[0].id, "700");
    assert.deepEqual(
      payloadA.items.slice(0, MAX_HOME_TRENDING_ITEMS).map((a) => a.id),
      payloadB.items.slice(0, MAX_HOME_TRENDING_ITEMS).map((a) => a.id),
    );
  });

  it("14, 15, 16, 17, 18 & 19. handles RAM cache, Redis cache, singleflight, Redis failure, Neon failure fallback, and generation fence", async () => {
    const nowMs = Date.UTC(2026, 4, 15, 12, 0, 0);
    const mockRedis = new MockTrendingRedis();
    const bgWrites: Promise<unknown>[] = [];
    let dbCatalogCalls = 0;
    let dbAudienceCalls = 0;
    let failDb = false;

    const sampleRows = Array.from({ length: 20 }, (_, i) =>
      makeCandidateRow({ id: String(800 + i) }, nowMs),
    );

    const deps: HomeTrendingDeps = {
      getRedisTrending: () => getRedisHomeTrendingWithFence(mockRedis),
      setRedisTrending: (payload, fence) =>
        setRedisHomeTrending(payload, fence, mockRedis),
      scheduleWrite: (promise) => {
        bgWrites.push(promise);
      },
      queryCatalog: async () => {
        dbCatalogCalls += 1;
        await new Promise((r) => setTimeout(r, 15));
        if (failDb) throw new Error("Neon offline");
        return sampleRows;
      },
      queryBadges: async () => emptyBadgesLookup(),
      queryAudienceSignals: async () => {
        dbAudienceCalls += 1;
        return [
          {
            userId: "u1",
            animeId: "805",
            playbackAt: new Date(nowMs - 2 * HOUR_MS).toISOString(),
            progressAt: null,
            trackingAt: null,
            manualAt: null,
          },
        ];
      },
    };

    // 16. Singleflight: 4 chamadas concorrentes compartilham 1 ida ao Neon
    const [r1, r2, r3, r4] = await Promise.all([
      getHomeTrendingItemsWithDeps(deps, nowMs),
      getHomeTrendingItemsWithDeps(deps, nowMs),
      getHomeTrendingItemsWithDeps(deps, nowMs),
      getHomeTrendingItemsWithDeps(deps, nowMs),
    ]);
    await Promise.all(bgWrites);

    assert.equal(dbCatalogCalls, 1);
    assert.equal(dbAudienceCalls, 1);
    assert.equal(r1.length, MAX_HOME_TRENDING_ITEMS);
    assert.equal(r1[0].id, "805");
    assert.deepEqual(r1, r2);
    assert.deepEqual(r1, r3);
    assert.deepEqual(r1, r4);

    // Garante que userId nunca vaze para o payload salvo no Redis
    const rawRedisJson = mockRedis.store.get(HOME_TRENDING_REDIS_KEY) ?? "";
    assert.ok(rawRedisJson.length > 0);
    assert.equal(rawRedisJson.includes("u1"), false);

    // 14. RAM hit (sem chamar Neon nem Redis novamente)
    mockRedis.shouldThrow = true;
    const ramHit = await getHomeTrendingItemsWithDeps(deps, nowMs + 60_000);
    assert.equal(dbCatalogCalls, 1);
    assert.equal(ramHit[0].id, "805");
    mockRedis.shouldThrow = false;

    // 15. Limpa RAM -> hit no Redis (ainda sem ir ao Neon)
    invalidateHomeTrendingLocalCache();
    const redisHit = await getHomeTrendingItemsWithDeps(deps, nowMs + 60_000);
    assert.equal(dbCatalogCalls, 1);
    assert.equal(redisHit[0].id, "805");

    // 17. Redis indisponível + RAM limpa -> fail-open para Neon
    invalidateHomeTrendingLocalCache();
    mockRedis.shouldThrow = true;
    const failOpenNeon = await getHomeTrendingItemsWithDeps(deps, nowMs + 60_000);
    assert.equal(dbCatalogCalls, 2);
    assert.equal(failOpenNeon[0].id, "805");
    mockRedis.shouldThrow = false;

    // 18. Neon falha + RAM expirada + Redis falha -> fallback seguro para stale RAM
    invalidateHomeTrendingLocalCache();
    mockRedis.shouldThrow = true;
    failDb = true;
    const staleFallback = await getHomeTrendingItemsWithDeps(deps, nowMs + 60_000);
    assert.equal(staleFallback.length, MAX_HOME_TRENDING_ITEMS);
    assert.equal(staleFallback[0].id, "805");
    mockRedis.shouldThrow = false;
    failDb = false;

    // 19. Generation fence: invalidação durante voo impede sobrescrita obsoleta
    invalidateHomeTrendingLocalCache();
    await invalidateRedisHomeTrending(mockRedis);
    const fenceRead = await getRedisHomeTrendingWithFence(mockRedis);
    assert.equal(fenceRead.status, "miss");
    const staleFence = fenceRead.fence;

    await invalidateRedisHomeTrending(mockRedis);
    const freshPayload: HomeTrendingPayload = {
      v: 1,
      generatedAt: nowMs,
      items: [{
        id: "999",
        titles: { romaji: "Novo", english: "Novo", native: "" },
        cover: "https://cdn.example.com/999.jpg",
        banner: "",
        synopsis: "",
        score: 80,
        genres: ["Action"],
        format: "TV",
        status: "RELEASING",
        episodesCount: 12,
        season: "SPRING",
        year: 2026,
        trailerId: null,
        source: "local",
      }],
    };
    const writeStatus = await setRedisHomeTrending(freshPayload, staleFence, mockRedis);
    assert.equal(writeStatus, "fenced");
    assert.equal(mockRedis.store.has(HOME_TRENDING_REDIS_KEY), false);
    assert.ok(Number(mockRedis.store.get(HOME_TRENDING_GEN_KEY) ?? "0") >= 2);
  });

  it("19b. bumps home trending Redis generation via invalidateServerCatalogCachesAsync", async () => {
    const mockRedis = new MockTrendingRedis();
    const initialPayload: HomeTrendingPayload = {
      v: 1,
      generatedAt: Date.now(),
      items: [{
        id: "176301",
        titles: { romaji: "Solo Leveling", english: "Solo Leveling", native: "" },
        cover: "https://cdn.example.com/176301.jpg",
        banner: "",
        synopsis: "",
        score: 85,
        genres: ["Action"],
        format: "TV",
        status: "FINISHED",
        episodesCount: 12,
        season: "WINTER",
        year: 2024,
        trailerId: null,
        source: "local",
      }],
    };
    const r = await getRedisHomeTrendingWithFence(mockRedis);
    await setRedisHomeTrending(initialPayload, r.fence, mockRedis);
    assert.ok(mockRedis.store.has(HOME_TRENDING_REDIS_KEY));

    const { invalidateServerCatalogCachesAsync } = await import("@/lib/api");
    await invalidateServerCatalogCachesAsync("176301", { anilistId: 176301 }, mockRedis);

    assert.equal(mockRedis.store.has(HOME_TRENDING_REDIS_KEY), false);
    assert.equal(mockRedis.store.get(HOME_TRENDING_GEN_KEY), "1");
  });

  it("20, 21 & 22. keeps withCache('home:...') independent, preserves trending/popular for Hero, and preserves homeWithEpisodeCount", async () => {
    const { domainCaches, toCache } = await import("@/lib/api");
    const todayKey = "2026-05-15";
    const cachedHome = {
      todaySchedule: [],
      trending: [
        {
          id: "ani-1",
          titles: { romaji: "AniList Trending 1", english: "AniList Trending 1", native: "" },
          cover: "https://cdn.example.com/ani1.jpg",
          banner: "",
          synopsis: "",
          score: 80,
          genres: ["Action"],
          format: "TV",
          status: "RELEASING",
          episodesCount: 12,
          season: "SPRING",
          year: 2026,
          trailerId: null,
          source: "anilist" as const,
          hasEpisode: true,
        },
      ],
      popular: [
        {
          id: "ani-2",
          titles: { romaji: "AniList Popular 1", english: "AniList Popular 1", native: "" },
          cover: "https://cdn.example.com/ani2.jpg",
          banner: "",
          synopsis: "",
          score: 82,
          genres: ["Drama"],
          format: "TV",
          status: "FINISHED",
          episodesCount: 12,
          season: "WINTER",
          year: 2026,
          trailerId: null,
          source: "anilist" as const,
          hasEpisode: false,
        },
      ],
      top: [],
      season: [
        {
          id: "season-no-ep",
          titles: { romaji: "Season Sem Ep", english: "Season Sem Ep", native: "" },
          cover: "https://cdn.example.com/s1.jpg",
          banner: "",
          synopsis: "",
          score: 75,
          genres: ["Comedy"],
          format: "TV",
          status: "RELEASING",
          episodesCount: 12,
          season: "SPRING",
          year: 2026,
          trailerId: null,
          source: "anilist" as const,
          hasEpisode: false,
        },
      ],
      releases: [],
      seasonName: "Primavera",
      seasonYear: 2026,
      source: "anilist" as const,
      genres: [],
    };

    // 20. Simula cache quente do catálogo geral da Home em withCache("home:...")
    toCache(`home:${todayKey}`, cachedHome);
    const homeCacheBefore = domainCaches.get("home")?.get(`home:${todayKey}`);
    assert.ok(homeCacheBefore);

    // O ranking independente não lê nem invalida o cache geral "home:..."
    const nowMs = Date.UTC(2026, 4, 15, 12, 0, 0);
    const mockRedis = new MockTrendingRedis();
    const deps: HomeTrendingDeps = {
      getRedisTrending: () => getRedisHomeTrendingWithFence(mockRedis),
      setRedisTrending: (payload, fence) =>
        setRedisHomeTrending(payload, fence, mockRedis),
      scheduleWrite: () => {},
      queryCatalog: async () =>
        Array.from({ length: 18 }, (_, i) =>
          makeCandidateRow({ id: String(900 + i) }, nowMs),
        ),
      queryBadges: async () => emptyBadgesLookup(),
      queryAudienceSignals: async () => [
        {
          userId: "u-live",
          animeId: "907",
          playbackAt: new Date(nowMs - HOUR_MS).toISOString(),
          progressAt: null,
          trackingAt: null,
          manualAt: null,
        },
      ],
    };

    const emAltaItems = await getHomeTrendingItemsWithDeps(deps, nowMs);
    assert.equal(emAltaItems[0].id, "907");
    assert.equal(emAltaItems.length, 18);

    // Cache "home:..." permanece intacto com trending/popular preservados para Hero
    const homeCacheAfter = domainCaches.get("home")?.get(`home:${todayKey}`);
    assert.equal(homeCacheAfter, homeCacheBefore);
    assert.equal((homeCacheAfter?.data as typeof cachedHome).trending[0].id, "ani-1");
    assert.equal((homeCacheAfter?.data as typeof cachedHome).popular[0].id, "ani-2");

    // 22. homeWithEpisodeCount calculado sobre legacyEmAltaSource não é inflado pelos 18 itens de emAltaItems
    const legacyCount = countDistinctTitlesWithEpisode([
      cachedHome.todaySchedule,
      cachedHome.trending,
      cachedHome.season,
    ]);
    assert.equal(legacyCount, 1);
    const seasonWithLegacyCount = selectHomeSectionItems(cachedHome.season, legacyCount);
    assert.equal(seasonWithLegacyCount.length, 1);
    assert.equal(seasonWithLegacyCount[0].id, "season-no-ep");

    // overlayList preserva a ordem e nunca reescreve IDs válidos para local-*
    const overlaid = overlayList(emAltaItems, [], { includeExtras: false });
    assert.equal((overlaid as SlimAnime[])[0].id, "907");
  });
});
