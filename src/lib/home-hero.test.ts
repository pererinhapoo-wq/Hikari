import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import {
  buildHeroBannerPool,
  computeCalendarScore,
  getHomeHeroItemsWithDeps,
  invalidateHomeHeroLocalCache,
  MAX_HERO_SLIDES,
  resetHomeHeroTestState,
  scoreAndDeduplicateHeroCandidates,
  selectHeroSlidesForWindow,
  type HeroAudienceMetrics,
  type HeroCatalogAnimeCandidateRow,
  type HomeHeroDeps,
} from "@/lib/home-hero.server";
import { pickHeroItems } from "@/lib/home-hero-fallback";
import type { AnimeRecentBadgesLookup } from "@/lib/catalog-badges";
import type { SlimAnime } from "@/lib/types";
import {
  getRedisHeroBannerPoolWithFence,
  HERO_BANNER_GEN_KEY,
  HERO_BANNER_REDIS_KEY,
  getHeroRedisKey,
  getHeroGenKey,
  invalidateRedisHeroBannerPool,
  setRedisHeroBannerPool,
  type HeroBannerPoolPayload,
  type RedisEvalClient,
} from "@/lib/redis";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

function emptyBadgesLookup(): AnimeRecentBadgesLookup {
  return {
    byId: new Map(),
    byAnilistId: new Map(),
    byMalId: new Map(),
    byKitsuId: new Map(),
  };
}

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

describe("home-hero dynamic selection, scoring, rotation & caching", () => {
  beforeEach(() => {
    resetHomeHeroTestState();
  });

  it("selects up to 8 items directly from Neon catalog independently of AniList top-18", async () => {
    const nowMs = Date.UTC(2026, 4, 15, 12, 0, 0);
    // 12 animes com IDs próprios fora de qualquer lista top-18 do AniList
    const rows: HeroCatalogAnimeCandidateRow[] = [
      makeCandidateRow({
        id: "700001",
        createdAt: new Date(nowMs - 2 * DAY_MS).toISOString(),
        firstEpisodePublishedAt: new Date(nowMs - 2 * DAY_MS).toISOString(),
        latestEpisodePublishedAt: new Date(nowMs - 2 * DAY_MS).toISOString(),
      }, nowMs),
      makeCandidateRow({
        id: "700002",
        createdAt: new Date(nowMs - 5 * DAY_MS).toISOString(),
        firstEpisodePublishedAt: new Date(nowMs - 5 * DAY_MS).toISOString(),
        latestEpisodePublishedAt: new Date(nowMs - 5 * DAY_MS).toISOString(),
      }, nowMs),
      makeCandidateRow({
        id: "700003",
        latestEpisodePublishedAt: new Date(nowMs - 3 * HOUR_MS).toISOString(),
      }, nowMs),
      makeCandidateRow({
        id: "700004",
        latestEpisodePublishedAt: new Date(nowMs - 2 * DAY_MS).toISOString(),
      }, nowMs),
      makeCandidateRow({
        id: "700005",
        latestEpisodePublishedAt: new Date(nowMs - 4 * DAY_MS).toISOString(),
      }, nowMs),
      ...Array.from({ length: 7 }, (_, i) =>
        makeCandidateRow({
          id: String(700010 + i),
          score: 75 + i,
        }, nowMs),
      ),
    ];

    const audience = new Map<string, HeroAudienceMetrics>([
      ["700010", { progUsers7d: 18, progUsers14d: 25, playbackUsers7d: 12, playbackUsers14d: 16, manualUsers14d: 2 }],
      ["700011", { progUsers7d: 10, progUsers14d: 14, playbackUsers7d: 8, playbackUsers14d: 11, manualUsers14d: 1 }],
    ]);

    const scored = scoreAndDeduplicateHeroCandidates(rows, emptyBadgesLookup(), audience, nowMs);
    const pool = buildHeroBannerPool(scored, nowMs);
    const slides = selectHeroSlidesForWindow(pool, nowMs, MAX_HERO_SLIDES);

    assert.equal(slides.length, 8);
    assert.ok(slides.some((s) => s.id === "700001" || s.id === "700002"));
    assert.ok(slides.some((s) => s.id === "700003"));
    assert.ok(slides.some((s) => s.id === "700010" || s.id === "700011"));
    assert.ok(slides.every((s) => s.hasEpisode === true));
  });

  it("prioritizes distinct horizontal banners strictly ahead of cover-only fallbacks", () => {
    const nowMs = Date.UTC(2026, 4, 15, 12, 0, 0);
    const rows: HeroCatalogAnimeCandidateRow[] = [
      // 6 sem banner próprio (ou banner == capa), mas com scores altíssimos
      ...Array.from({ length: 6 }, (_, i) =>
        makeCandidateRow({
          id: String(800001 + i),
          banner: i % 2 === 0 ? null : `https://cdn.example.com/cover-${800001 + i}.jpg`,
          createdAt: new Date(nowMs - 1 * DAY_MS).toISOString(),
          firstEpisodePublishedAt: new Date(nowMs - 1 * DAY_MS).toISOString(),
          score: 99,
        }, nowMs),
      ),
      // 6 com banner horizontal próprio diferente da capa
      ...Array.from({ length: 6 }, (_, i) =>
        makeCandidateRow({
          id: String(800101 + i),
          score: 70,
        }, nowMs),
      ),
    ];

    const scored = scoreAndDeduplicateHeroCandidates(rows, emptyBadgesLookup(), new Map(), nowMs);
    const pool = buildHeroBannerPool(scored, nowMs);
    const slides = selectHeroSlidesForWindow(pool, nowMs, MAX_HERO_SLIDES);

    assert.equal(slides.length, 8);
    const selectedIds = slides.map((s) => s.id);
    // Todos os 6 com banner horizontal próprio devem vir antes dos 2 de fallback
    for (let i = 0; i < 6; i++) {
      assert.ok(
        selectedIds.slice(0, 6).includes(String(800101 + i)),
        `Expected distinct banner anime ${800101 + i} in first 6 slides`,
      );
    }
  });

  it("applies temporal decay to new episodes and novelties, ignoring superficial updatedAt edits", () => {
    const nowMs = Date.UTC(2026, 4, 15, 12, 0, 0);
    const rows: HeroCatalogAnimeCandidateRow[] = [
      // Anime antigo editado administrativamente hoje (updatedAt hoje, mas último episódio há 60 dias)
      makeCandidateRow({
        id: "900001",
        createdAt: new Date(nowMs - 180 * DAY_MS).toISOString(),
        updatedAt: new Date(nowMs - 10 * 60 * 1000).toISOString(),
        firstEpisodePublishedAt: new Date(nowMs - 170 * DAY_MS).toISOString(),
        latestEpisodePublishedAt: new Date(nowMs - 60 * DAY_MS).toISOString(),
      }, nowMs),
      // Anime antigo que acabou de ganhar episódio há 2h -> episódio novo forte, não novidade
      makeCandidateRow({
        id: "900002",
        createdAt: new Date(nowMs - 180 * DAY_MS).toISOString(),
        firstEpisodePublishedAt: new Date(nowMs - 170 * DAY_MS).toISOString(),
        latestEpisodePublishedAt: new Date(nowMs - 2 * HOUR_MS).toISOString(),
      }, nowMs),
      // Anime antigo que ganhou episódio há 8 dias -> ainda entra, mas com menos força que 2h
      makeCandidateRow({
        id: "900003",
        createdAt: new Date(nowMs - 180 * DAY_MS).toISOString(),
        firstEpisodePublishedAt: new Date(nowMs - 170 * DAY_MS).toISOString(),
        latestEpisodePublishedAt: new Date(nowMs - 8 * DAY_MS).toISOString(),
      }, nowMs),
      // Novidade com 3 dias vs novidade com 26 dias (decaimento após 21 dias) vs 45 dias (zero novidade)
      makeCandidateRow({
        id: "900004",
        createdAt: new Date(nowMs - 3 * DAY_MS).toISOString(),
        firstEpisodePublishedAt: new Date(nowMs - 3 * DAY_MS).toISOString(),
        latestEpisodePublishedAt: new Date(nowMs - 3 * DAY_MS).toISOString(),
      }, nowMs),
      makeCandidateRow({
        id: "900005",
        createdAt: new Date(nowMs - 26 * DAY_MS).toISOString(),
        firstEpisodePublishedAt: new Date(nowMs - 26 * DAY_MS).toISOString(),
        latestEpisodePublishedAt: new Date(nowMs - 26 * DAY_MS).toISOString(),
      }, nowMs),
      makeCandidateRow({
        id: "900006",
        createdAt: new Date(nowMs - 45 * DAY_MS).toISOString(),
        firstEpisodePublishedAt: new Date(nowMs - 45 * DAY_MS).toISOString(),
        latestEpisodePublishedAt: new Date(nowMs - 45 * DAY_MS).toISOString(),
      }, nowMs),
    ];

    const scored = scoreAndDeduplicateHeroCandidates(rows, emptyBadgesLookup(), new Map(), nowMs);
    const byId = new Map(scored.map((c) => [c.anime.id, c]));

    assert.equal(byId.get("900001")!.noveltyScore, 0);
    assert.equal(byId.get("900001")!.newEpisodeScore, 0);

    assert.equal(byId.get("900002")!.noveltyScore, 0);
    assert.ok(byId.get("900002")!.newEpisodeScore > byId.get("900003")!.newEpisodeScore);

    assert.ok(byId.get("900004")!.noveltyScore > byId.get("900005")!.noveltyScore);
    assert.ok(byId.get("900005")!.noveltyScore > 0);
    assert.equal(byId.get("900006")!.noveltyScore, 0);
  });

  it("deduplicates dubbed and subbed variants and prefers original non-dubbed entry", () => {
    const nowMs = Date.UTC(2026, 4, 15, 12, 0, 0);
    const rows: HeroCatalogAnimeCandidateRow[] = [
      makeCandidateRow({
        id: "113415",
        title: "Jujutsu Kaisen",
        titleRomaji: "Jujutsu Kaisen",
        titleEnglish: "JUJUTSU KAISEN",
        score: 86,
      }, nowMs),
      makeCandidateRow({
        id: "mal-40748",
        anilistId: null,
        malId: 40748,
        title: "Jujutsu Kaisen (Dublado)",
        titleRomaji: "Jujutsu Kaisen (Dublado)",
        titleEnglish: "JUJUTSU KAISEN Dublado",
        score: 95,
      }, nowMs),
    ];

    const scored = scoreAndDeduplicateHeroCandidates(rows, emptyBadgesLookup(), new Map(), nowMs);
    assert.equal(scored.length, 1);
    assert.equal(scored[0].anime.id, "113415");
    assert.equal(scored[0].isDubbed, false);
  });

  it("excludes hidden, +18/Hentai, invalid IDs, and non-playable zero-signal candidates while accepting internal IDs and non-ep-1 episodes", () => {
    const nowMs = Date.UTC(2026, 4, 15, 12, 0, 0);
    const rows: HeroCatalogAnimeCandidateRow[] = [
      makeCandidateRow({ id: "101", hidden: true }, nowMs),
      makeCandidateRow({ id: "102", genres: ["Action", "Hentai"] }, nowMs),
      makeCandidateRow({ id: "bad/id", anilistId: null, malId: null, kitsuId: null }, nowMs),
      // ID interno puro do Hikari (local-*) sem ID externo deve ser elegível
      makeCandidateRow({ id: "local-pure", anilistId: null, malId: null, kitsuId: null }, nowMs),
      // ID interno customizado sem ID externo e apenas episódio 5 publicado (sem ep-1)
      makeCandidateRow({
        id: "hikari-ep5-only",
        anilistId: null,
        malId: null,
        kitsuId: null,
        publishedEpisodeCount: 1,
        ep1Sources: [],
        epSources: [{ number: 5, seasonNumber: 1, videoUrl: "https://cdn.example.com/ep5.mp4" }],
      }, nowMs),
      // local-* COM anilistId válido resolve para o ID canônico 176301 com serverCatalogId local-mapped
      makeCandidateRow({ id: "local-mapped", anilistId: 176301, title: "Solo Leveling" }, nowMs),
      // Sem episódio publicado e sem outros sinais (calendário/engajamento)
      makeCandidateRow({ id: "103", publishedEpisodeCount: 0, ep1Sources: [] }, nowMs),
      // Episódio com fonte inválida (#) e sem hikariPlayerEpisodeId nem outros sinais
      makeCandidateRow({ id: "104", ep1Sources: [{ videoUrl: "#" }] }, nowMs),
      // Episódio 1 válido via Hikari Player ID
      makeCandidateRow({ id: "105", ep1Sources: [{ hikariPlayerEpisodeId: "ep_valid_105" }] }, nowMs),
    ];

    const scored = scoreAndDeduplicateHeroCandidates(rows, emptyBadgesLookup(), new Map(), nowMs);
    const ids = scored.map((s) => s.anime.id).sort();
    assert.deepEqual(ids, ["105", "176301", "hikari-ep5-only", "local-pure"]);

    const mapped = scored.find((s) => s.anime.id === "176301");
    assert.equal(mapped?.anime.serverCatalogId, "local-mapped");

    const pureLocal = scored.find((s) => s.anime.id === "local-pure");
    assert.equal(pureLocal?.anime.serverCatalogId, "local-pure");
    assert.equal(pureLocal?.anime.hasEpisode, true);

    const ep5Only = scored.find((s) => s.anime.id === "hikari-ep5-only");
    assert.equal(ep5Only?.anime.hasEpisode, true);
    assert.equal(ep5Only?.anime.firstAvailableEpisodeNumber, 5);
  });

  it("handles empty or failing audience query cleanly without breaking selection", async () => {
    const nowMs = Date.UTC(2026, 4, 15, 12, 0, 0);
    const rows = Array.from({ length: 10 }, (_, i) =>
      makeCandidateRow({ id: String(500001 + i) }, nowMs),
    );

    const deps: HomeHeroDeps = {
      getRedisPool: async () => ({ status: "unavailable", payload: null, fence: null }),
      setRedisPool: async () => "unavailable",
      scheduleWrite: () => {},
      queryCatalog: async () => rows,
      queryBadges: async () => emptyBadgesLookup(),
      queryAudience: async () => {
        throw new Error("Audience query timeout");
      },
    };

    const items = await getHomeHeroItemsWithDeps(deps, nowMs);
    assert.equal(items.length, 8);
  });

  it("falls back cleanly on Redis outage and serves stale RAM pool if DB also fails", async () => {
    const nowMs = Date.UTC(2026, 4, 15, 12, 0, 0);
    const rows = Array.from({ length: 8 }, (_, i) =>
      makeCandidateRow({ id: String(600001 + i) }, nowMs),
    );

    // 1. Redis falha, DB funciona -> popula staleHeroPool
    const items1 = await getHomeHeroItemsWithDeps(
      {
        getRedisPool: async () => ({ status: "failed", payload: null, fence: null }),
        setRedisPool: async () => "failed",
        scheduleWrite: () => {},
        queryCatalog: async () => rows,
        queryBadges: async () => emptyBadgesLookup(),
        queryAudience: async () => new Map(),
      },
      nowMs,
    );
    assert.equal(items1.length, 8);

    // 2. Limpa cache quente RAM (mantendo stale), agora Redis E DB falham -> devolve reserva stale
    invalidateHomeHeroLocalCache();
    const items2 = await getHomeHeroItemsWithDeps(
      {
        getRedisPool: async () => ({ status: "failed", payload: null, fence: null }),
        setRedisPool: async () => "failed",
        scheduleWrite: () => {},
        queryCatalog: async () => {
          throw new Error("Neon connection error");
        },
        queryBadges: async () => emptyBadgesLookup(),
        queryAudience: async () => new Map(),
      },
      nowMs,
    );
    assert.equal(items2.length, 8);
    assert.deepEqual(
      items2.map((x) => x.id),
      items1.map((x) => x.id),
    );
  });

  it("avoids DB/audience queries on RAM and Redis cache hits and rotates deterministically by window", async () => {
    const t0 = Date.UTC(2026, 4, 15, 12, 0, 0);
    const rows = Array.from({ length: 14 }, (_, i) =>
      makeCandidateRow(
        {
          id: String(400001 + i),
          createdAt: new Date(t0 - (i < 4 ? i + 1 : 60) * DAY_MS).toISOString(),
          firstEpisodePublishedAt: new Date(t0 - (i < 4 ? i + 1 : 60) * DAY_MS).toISOString(),
          latestEpisodePublishedAt: new Date(t0 - (i < 8 ? i + 1 : 30) * DAY_MS).toISOString(),
        },
        t0,
      ),
    );

    const mockRedis = new MockHeroRedis();
    let catalogQueries = 0;
    let audienceQueries = 0;

    const deps: HomeHeroDeps = {
      getRedisPool: () => getRedisHeroBannerPoolWithFence(mockRedis),
      setRedisPool: (payload, fence) => setRedisHeroBannerPool(payload, fence, mockRedis),
      scheduleWrite: (promise) => {
        void promise;
      },
      queryCatalog: async () => {
        catalogQueries += 1;
        return rows;
      },
      queryBadges: async () => emptyBadgesLookup(),
      queryAudience: async () => {
        audienceQueries += 1;
        return new Map();
      },
    };

    // 1. Cold miss -> consulta Neon 1x e grava no Redis
    const firstWindowSlides = await getHomeHeroItemsWithDeps(deps, t0);
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(firstWindowSlides.length, 8);
    assert.equal(catalogQueries, 1);
    assert.equal(audienceQueries, 1);
    assert.ok(mockRedis.store.has(getHeroRedisKey("development")));

    // 2. Mesma janela -> RAM hit (0 DB, 0 audience, determinístico == SSR/hydration)
    const sameWindowRam = await getHomeHeroItemsWithDeps(deps, t0 + 20_000);
    assert.deepEqual(
      sameWindowRam.map((a) => a.id),
      firstWindowSlides.map((a) => a.id),
    );
    assert.equal(catalogQueries, 1);
    assert.equal(audienceQueries, 1);

    // 3. Limpa RAM -> Redis hit (0 DB, 0 audience)
    invalidateHomeHeroLocalCache();
    const sameWindowRedis = await getHomeHeroItemsWithDeps(deps, t0 + 30_000);
    assert.deepEqual(
      sameWindowRedis.map((a) => a.id),
      firstWindowSlides.map((a) => a.id),
    );
    assert.equal(catalogQueries, 1);
    assert.equal(audienceQueries, 1);

    // 4. Janela seguinte (+15 min) rotaciona os destaques usando o pool em cache sem consultar Neon
    const nextWindowSlides = await getHomeHeroItemsWithDeps(deps, t0 + 15 * 60 * 1000);
    assert.equal(nextWindowSlides.length, 8);
    assert.equal(catalogQueries, 1);
    assert.equal(audienceQueries, 1);
    assert.notDeepEqual(
      nextWindowSlides.map((a) => a.id),
      firstWindowSlides.map((a) => a.id),
    );
  });

  it("enforces Redis generation fence when invalidated during in-flight calculation", async () => {
    const mockRedis = new MockHeroRedis();
    const read = await getRedisHeroBannerPoolWithFence(mockRedis);
    assert.equal(read.status, "miss");
    const staleFence = read.fence;

    // Simula invalidação administrativa concorrente antes da escrita terminar
    await invalidateRedisHeroBannerPool(mockRedis);
    assert.equal(mockRedis.store.get(getHeroGenKey("development")), "1");

    const nowMs = Date.UTC(2026, 4, 15, 12, 0, 0);
    const payload: HeroBannerPoolPayload = {
      v: 1,
      generatedAt: nowMs,
      items: [
        {
          anime: {
            id: "176301",
            titles: { romaji: "Solo Leveling", english: "Solo Leveling", native: "" },
            cover: "https://cdn.example.com/cover.jpg",
            banner: "https://cdn.example.com/banner.jpg",
            synopsis: "Sinopse",
            score: 85,
            popularity: 100000,
            genres: ["Action"],
            format: "TV",
            status: "FINISHED",
            episodesCount: 12,
            season: "WINTER",
            year: 2024,
            trailerId: null,
            source: "local",
            hasEpisode: true,
          },
          bucket: "preenchimento",
          score: 80,
          hasDistinctBanner: true,
          titleKey: "solo leveling",
          rank: 1,
        },
      ],
    };

    const writeRes = await setRedisHeroBannerPool(payload, staleFence, mockRedis);
    assert.equal(writeRes, "fenced");
    assert.equal(mockRedis.store.has(getHeroRedisKey("development")), false);

    // Nova leitura obtém fence atualizado ("1") e consegue gravar
    const read2 = await getRedisHeroBannerPoolWithFence(mockRedis);
    assert.equal(read2.fence, "1");
    const writeRes2 = await setRedisHeroBannerPool(payload, read2.fence, mockRedis);
    assert.equal(writeRes2, "inserted");
    assert.equal(mockRedis.store.has(getHeroRedisKey("development")), true);
  });

  it("weights real playback higher than manual marks and reconciles audience by canonical and external IDs", () => {
    const nowMs = Date.UTC(2026, 4, 15, 12, 0, 0);
    const rows: HeroCatalogAnimeCandidateRow[] = [
      // Anime A salvo com id local-a e anilistId 210001; audiência registrada no anilistId 210001 via playback
      makeCandidateRow({
        id: "local-a",
        anilistId: 210001,
        title: "Playback Hit",
        titleRomaji: "Playback Hit",
        score: 75,
      }, nowMs),
      // Anime B com mais marcações manuais, porém zero playback real
      makeCandidateRow({
        id: "210002",
        anilistId: 210002,
        title: "Manual Only",
        titleRomaji: "Manual Only",
        score: 75,
      }, nowMs),
    ];

    const audience = new Map<string, HeroAudienceMetrics>([
      [
        "210001",
        {
          progUsers7d: 5,
          progUsers14d: 8,
          playbackUsers7d: 6,
          playbackUsers14d: 9,
          manualUsers14d: 0,
        },
      ],
      [
        "210002",
        {
          progUsers7d: 0,
          progUsers14d: 0,
          playbackUsers7d: 0,
          playbackUsers14d: 0,
          manualUsers14d: 10,
        },
      ],
    ]);

    const scored = scoreAndDeduplicateHeroCandidates(rows, emptyBadgesLookup(), audience, nowMs);
    const byId = new Map(scored.map((s) => [s.anime.id, s]));
    const a = byId.get("210001")!;
    const b = byId.get("210002")!;

    assert.ok(a.engagementScore > b.engagementScore);
    assert.equal(a.anime.serverCatalogId, "local-a");
  });

  it("invalidates hero banner key and bumps generation through invalidateServerCatalogCachesAsync", async () => {
    const { invalidateServerCatalogCachesAsync } = await import("@/lib/api");
    const mockRedis = new MockHeroRedis();
    mockRedis.store.set(getHeroRedisKey("development"), JSON.stringify({ v: 1 }));
    mockRedis.store.set(getHeroGenKey("development"), "3");

    await invalidateServerCatalogCachesAsync("176301", { anilistId: 176301 }, mockRedis);

    assert.equal(mockRedis.store.has(getHeroRedisKey("development")), false);
    assert.equal(mockRedis.store.get(getHeroGenKey("development")), "4");
  });

  it("excludes newly registered anime without real signals and ignores createdAt alone for novelty", () => {
    const nowMs = Date.UTC(2026, 4, 15, 12, 0, 0);
    const rows: HeroCatalogAnimeCandidateRow[] = [
      // Recém-cadastrado hoje com score/popularidade altos, mas sem episódio publicado, sem engajamento e sem calendário
      makeCandidateRow({
        id: "910001",
        score: 98,
        popularity: 900000,
        createdAt: new Date(nowMs - 10 * 60 * 1000).toISOString(),
        updatedAt: new Date(nowMs - 5 * 60 * 1000).toISOString(),
        publishedEpisodeCount: 0,
        firstEpisodePublishedAt: null,
        latestEpisodePublishedAt: null,
        ep1Sources: [],
        epSources: [],
      }, nowMs),
      // Recém-cadastrado hoje cujo único episódio publicado foi há 90 dias -> não deve ganhar novidade pelo createdAt
      makeCandidateRow({
        id: "910002",
        createdAt: new Date(nowMs - 10 * 60 * 1000).toISOString(),
        updatedAt: new Date(nowMs - 5 * 60 * 1000).toISOString(),
        firstEpisodePublishedAt: new Date(nowMs - 90 * DAY_MS).toISOString(),
        latestEpisodePublishedAt: new Date(nowMs - 90 * DAY_MS).toISOString(),
      }, nowMs),
    ];

    const scored = scoreAndDeduplicateHeroCandidates(rows, emptyBadgesLookup(), new Map(), nowMs);
    assert.equal(scored.some((c) => c.anime.id === "910001"), false);
    const oldEpCandidate = scored.find((c) => c.anime.id === "910002");
    assert.ok(oldEpCandidate);
    assert.equal(oldEpCandidate.noveltyScore, 0);
    assert.equal(oldEpCandidate.newEpisodeScore, 0);
  });

  it("includes calendar and weekly recurrence candidates without confusing them with published episodes and avoids padding empty slots", () => {
    const nowMs = Date.UTC(2026, 4, 15, 12, 0, 0);
    const rows: HeroCatalogAnimeCandidateRow[] = [
      // 1) Anime publicado com episódio 3 (sem ep 1)
      makeCandidateRow({
        id: "5081",
        title: "Bakemonogatari",
        titleRomaji: "Bakemonogatari",
        publishedEpisodeCount: 1,
        ep1Sources: [],
        epSources: [{ number: 3, seasonNumber: 1, videoUrl: "https://cdn.example.com/bake-ep3.mp4" }],
      }, nowMs),
      // 2) Anime somente no calendário de hoje (catalog_airing_schedule), sem episódio publicado
      makeCandidateRow({
        id: "920001",
        publishedEpisodeCount: 0,
        firstEpisodePublishedAt: null,
        latestEpisodePublishedAt: null,
        ep1Sources: [],
        epSources: [],
        hasTodayAiringSchedule: true,
        hasWeekAiringSchedule: true,
      }, nowMs),
      // 3) Anime somente em recorrência semanal ativa (catalog_weekly_recurrence), sem episódio publicado
      makeCandidateRow({
        id: "local-rec-1",
        anilistId: null,
        malId: null,
        kitsuId: null,
        publishedEpisodeCount: 0,
        firstEpisodePublishedAt: null,
        latestEpisodePublishedAt: null,
        ep1Sources: [],
        epSources: [],
        hasTodayWeeklyRecurrence: true,
        hasActiveWeeklyRecurrence: true,
      }, nowMs),
      // 4) Anime cadastrado sem qualquer sinal -> deve ficar fora (não preencher slots)
      makeCandidateRow({
        id: "920002",
        publishedEpisodeCount: 0,
        ep1Sources: [],
        epSources: [],
      }, nowMs),
    ];

    assert.ok(
      computeCalendarScore({
        hasTodaySchedule: true,
        hasWeekSchedule: true,
        hasTodayRecurrence: false,
        hasActiveRecurrence: false,
        hasPublishedEpisode: false,
        score: 80,
      }) > 0,
    );

    const scored = scoreAndDeduplicateHeroCandidates(rows, emptyBadgesLookup(), new Map(), nowMs);
    const pool = buildHeroBannerPool(scored, nowMs);
    const slides = selectHeroSlidesForWindow(pool, nowMs, MAX_HERO_SLIDES);

    // Exatamente 3 candidatos válidos (não força preenchimento para 8 com anime sem sinal)
    assert.equal(slides.length, 3);
    const byId = new Map(slides.map((s) => [s.id, s]));

    assert.equal(byId.get("5081")?.hasEpisode, true);
    assert.equal(byId.get("5081")?.firstAvailableEpisodeNumber, 3);

    assert.equal(byId.get("920001")?.hasEpisode, false);
    assert.equal(byId.get("local-rec-1")?.hasEpisode, false);
    assert.equal(byId.has("920002"), false);
  });

  it("keeps single valid candidate stable across windows without fabricating rotation, and rotates when >= 2 candidates exist", async () => {
    const t0 = Date.UTC(2026, 4, 15, 12, 0, 0);

    // Caso 1: apenas 1 candidato válido no catálogo (e vários cadastros sem sinal)
    const singleValidRows: HeroCatalogAnimeCandidateRow[] = [
      makeCandidateRow({ id: "5081", title: "Bakemonogatari", titleRomaji: "Bakemonogatari" }, t0),
      makeCandidateRow({ id: "930001", publishedEpisodeCount: 0, ep1Sources: [] }, t0),
      makeCandidateRow({ id: "930002", publishedEpisodeCount: 0, ep1Sources: [] }, t0),
    ];

    const singleItems1 = await getHomeHeroItemsWithDeps(
      {
        getRedisPool: async () => ({ status: "unavailable", payload: null, fence: null }),
        setRedisPool: async () => "unavailable",
        scheduleWrite: () => {},
        queryCatalog: async () => singleValidRows,
        queryBadges: async () => emptyBadgesLookup(),
        queryAudience: async () => new Map(),
      },
      t0,
    );
    const singleItems2 = await getHomeHeroItemsWithDeps(
      {
        getRedisPool: async () => ({ status: "unavailable", payload: null, fence: null }),
        setRedisPool: async () => "unavailable",
        scheduleWrite: () => {},
        queryCatalog: async () => singleValidRows,
        queryBadges: async () => emptyBadgesLookup(),
        queryAudience: async () => new Map(),
      },
      t0 + 15 * 60 * 1000,
    );

    assert.deepEqual(
      singleItems1.map((x) => x.id),
      ["5081"],
    );
    assert.deepEqual(
      singleItems2.map((x) => x.id),
      ["5081"],
    );

    // Caso 2: 2 candidatos válidos -> ambos ficam disponíveis para rotação do Hero
    resetHomeHeroTestState();
    const twoValidRows: HeroCatalogAnimeCandidateRow[] = [
      makeCandidateRow({ id: "5081", title: "Bakemonogatari", titleRomaji: "Bakemonogatari" }, t0),
      makeCandidateRow({
        id: "local-cal-2",
        anilistId: null,
        publishedEpisodeCount: 0,
        ep1Sources: [],
        hasTodayAiringSchedule: true,
      }, t0),
    ];

    const twoItems = await getHomeHeroItemsWithDeps(
      {
        getRedisPool: async () => ({ status: "unavailable", payload: null, fence: null }),
        setRedisPool: async () => "unavailable",
        scheduleWrite: () => {},
        queryCatalog: async () => twoValidRows,
        queryBadges: async () => emptyBadgesLookup(),
        queryAudience: async () => new Map(),
      },
      t0,
    );
    assert.equal(twoItems.length, 2);
  });

  it("prevents pickHeroItems fallback from collapsing to 1 item when multiple valid candidates exist", () => {
    const makeSlim = (id: string, overrides?: Partial<SlimAnime>): SlimAnime => ({
      id,
      titles: { romaji: `Anime ${id}`, english: "", native: "" },
      cover: `https://cdn.example.com/c-${id}.jpg`,
      banner: `https://cdn.example.com/b-${id}.jpg`,
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
      hasEpisode: false,
      ...overrides,
    });

    // Antes colapsava para [firstWithBanner] (1 item) quando ninguém tinha hasEpisode === true
    const noEpisodeResult = pickHeroItems(
      [makeSlim("1"), makeSlim("2")],
      [makeSlim("3")],
      [makeSlim("4", { todayEpisode: { number: 2, airingAt: 1700000000 } })],
    );
    assert.equal(noEpisodeResult.length, 4);
    assert.equal(noEpisodeResult[0].id, "4");

    // Quando apenas 1 tem hasEpisode === true e há candidatos válidos de calendário/catálogo
    const oneEpisodeWithOthers = pickHeroItems(
      [makeSlim("5081", { hasEpisode: true }), makeSlim("20")],
      [makeSlim("30")],
      [makeSlim("40", { todayEpisode: { number: 1, airingAt: 1700000000 } })],
    );
    assert.equal(oneEpisodeWithOthers.length, 4);
    assert.equal(oneEpisodeWithOthers[0].id, "5081");

    // Quando genuinamente só existe 1 candidato válido, permanece estável em 1
    const trulyOne = pickHeroItems([makeSlim("5081", { hasEpisode: true })], [], []);
    assert.deepEqual(
      trulyOne.map((i) => i.id),
      ["5081"],
    );
  });
});
