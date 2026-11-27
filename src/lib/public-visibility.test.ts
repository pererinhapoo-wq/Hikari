import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getSql, dbSource } from "@/lib/db";
import {
  BLOCKED_ANILIST_IDS,
  EMPTY_PUBLIC_VISIBILITY_CONTEXT,
  filterPublicAnimes,
  isConfirmedDonghuaOrigin,
  isPubliclyBlockedAnime,
  isPubliclyBlockedId,
  normalizeCountryOfOrigin,
  parseVisibilityIdentifier,
} from "@/lib/public-visibility";
import {
  buildServerVisibilityContextFromRows,
  filterServerPublicAnimes,
  getServerPublicVisibilityContext,
  invalidatePublicVisibilityCache,
  isServerPubliclyBlockedAnime,
  isServerPubliclyBlockedId,
} from "@/lib/public-visibility-server";
import {
  executeAdminArchiveCatalogAnime,
  executeAdminUpsertCatalogAnime,
} from "@/lib/catalog-admin-ops.server";
import {
  applyDbCatalogOverlayToDetail,
  applyDbCatalogOverlayToSlimList,
  buildLocalAnimeFromDb,
  invalidateCatalogIndex,
  searchLocalCatalogAnime,
} from "@/lib/catalog-server-overlay.server";
import {
  executeGetCatalogEpisodes,
  executeGetPaginatedPublicCatalogEpisodes,
  executeGetPublicCatalogAnimeOptions,
  executeGetPublicCatalogEpisodes,
  invalidateCatalogEpisodesCache,
  invalidatePublicCatalogEpisodesLocalCache,
} from "@/lib/catalog-episodes";
import {
  executeFetchAnimeDetail,
  invalidateServerCatalogCaches,
} from "@/lib/api";
import {
  filterAnilistProxyPayload,
  injectCountryOfOriginIntoAnilistQuery,
} from "@/routes/api-anilist";
import {
  getHomeHeroItemsWithDeps,
  resetHomeHeroTestState,
  scoreAndDeduplicateHeroCandidates,
  type HeroCatalogAnimeCandidateRow,
} from "@/lib/home-hero.server";
import {
  getHomeTrendingItemsWithDeps,
  resetHomeTrendingTestState,
  scoreAndRankHomeTrending,
  type TrendingCatalogAnimeCandidateRow,
} from "@/lib/home-trending.server";
import {
  mapTodayScheduleRowsToSlimAnime,
  mapWeeklyScheduleRowsAndRecurrences,
} from "@/lib/calendar-schedule.server";
import {
  findLocalCover,
  mergeDetail,
  overlayList,
  overlaySeasonList,
} from "@/lib/overlay";
import { getPersonWorks, getStudioWorks } from "@/lib/entity-works";
import { searchCharacters, searchPeople } from "@/lib/search-entities";
import { useHikariStore } from "@/lib/store";
import { getSitemapAnimeCatalog } from "@/lib/seo";
import type { Anime, LocalAnime, SlimAnime } from "@/lib/types";
import {
  MEDIA_LIST_QUERY,
  ANNOUNCED_MEDIA_QUERY,
  SEASON_QUERY,
  AIRING_SCHEDULE_QUERY,
  resolveCatalogAnimeFields,
} from "../../scripts/anilist-sync.mjs";
import {
  buildAniListOriginBatchQuery,
  runCountryOfOriginBackfill,
} from "../../scripts/backfill-country-of-origin.mjs";

const EXPECTED_41_BLOCKED_IDS = [
  212308, 165159, 146004, 202851, 209709, 966, 8687, 168085, 218011, 213298,
  204269, 185646, 202957, 216860, 206523, 217787, 213356, 155723, 216557,
  214968, 214260, 137683, 2406, 118123, 215835, 209032, 217782, 218217,
  214593, 137653, 218532, 218938, 213188, 218008, 204656, 214974, 220079,
  217624, 218942, 217577, 212144,
] as const;

function makeSlim(
  id: string,
  overrides: Partial<SlimAnime> = {},
): SlimAnime {
  const numId = /^\d+$/.test(id) ? Number(id) : undefined;
  return {
    id,
    anilistId: numId,
    titles: {
      romaji: `Anime ${id}`,
      english: `Anime ${id} EN`,
      native: `アニメ ${id}`,
    },
    cover: `https://cdn.example.com/cover-${id}.jpg`,
    banner: `https://cdn.example.com/banner-${id}.jpg`,
    synopsis: "Sinopse de teste",
    score: 85,
    genres: ["Action"],
    format: "TV",
    status: "FINISHED",
    episodesCount: 12,
    season: "SPRING",
    year: 2025,
    trailerId: null,
    source: "local",
    hasEpisode: true,
    ...overrides,
  };
}

function makeLocal(
  id: string,
  overrides: Partial<LocalAnime> = {},
): LocalAnime {
  return {
    id,
    titleRomaji: `Local ${id}`,
    titleEnglish: `Local ${id} EN`,
    titleNative: `ローカル ${id}`,
    cover: `https://cdn.example.com/cover-${id}.jpg`,
    banner: `https://cdn.example.com/banner-${id}.jpg`,
    synopsis: "Sinopse local",
    score: 80,
    genres: ["Action"],
    format: "TV",
    status: "FINISHED",
    episodesCount: 12,
    season: "SPRING",
    year: 2025,
    trailerId: null,
    hidden: false,
    seasons: [
      {
        id: `s-${id}`,
        number: 1,
        title: "Temporada 1",
        episodes: [
          {
            id: `ep-${id}-1`,
            number: 1,
            title: "Episódio 1",
            videoUrl: `https://cdn.example.com/${id}-ep1.mp4`,
            published: true,
          },
        ],
      },
    ],
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    ...overrides,
  };
}

function makeFullAnime(
  id: string,
  overrides: Partial<Anime> = {},
): Anime {
  return {
    ...makeSlim(id),
    studios: ["Studio Test"],
    streamingEpisodes: [],
    seasons: [
      {
        id: `s-${id}`,
        number: 1,
        title: "Temporada 1",
        episodes: [
          {
            id: `ep-${id}-1`,
            number: 1,
            title: "Episódio 1",
            videoUrl: `https://cdn.example.com/${id}-ep1.mp4`,
            published: true,
          },
        ],
      },
    ],
    recommendations: [],
    characters: [],
    staff: [],
    ...overrides,
  };
}

describe("Regra centralizada de visibilidade pública (Donghua CN + 41 IDs AniList)", () => {
  it("1. Contém exatamente os 41 IDs AniList obrigatórios e normaliza todos os formatos de ID", () => {
    assert.deepEqual(Array.from(BLOCKED_ANILIST_IDS), Array.from(EXPECTED_41_BLOCKED_IDS));
    assert.equal(BLOCKED_ANILIST_IDS.length, 41);

    for (const blockedId of EXPECTED_41_BLOCKED_IDS) {
      assert.equal(isPubliclyBlockedId(blockedId), true, `Numérico ${blockedId} deve bloquear`);
      assert.equal(isPubliclyBlockedId(String(blockedId)), true, `String ${blockedId} deve bloquear`);
      assert.equal(
        isPubliclyBlockedId(`anilist-${blockedId}`),
        true,
        `anilist-${blockedId} deve bloquear`,
      );
      assert.equal(
        isPubliclyBlockedId(`ANILIST-${blockedId}`),
        true,
        `ANILIST-${blockedId} deve bloquear`,
      );
      assert.equal(
        isPubliclyBlockedAnime({ id: `local-copy-${blockedId}`, anilistId: blockedId }),
        true,
        `Registro com anilistId=${blockedId} deve bloquear`,
      );
    }

    assert.deepEqual(parseVisibilityIdentifier("mal-12345"), {
      raw: "mal-12345",
      normalized: "mal-12345",
      anilistId: null,
      malId: 12345,
      kitsuId: null,
      isLocal: false,
    });
    assert.deepEqual(parseVisibilityIdentifier("kitsu-999"), {
      raw: "kitsu-999",
      normalized: "kitsu-999",
      anilistId: null,
      malId: null,
      kitsuId: 999,
      isLocal: false,
    });
    assert.deepEqual(parseVisibilityIdentifier("local-abc-123"), {
      raw: "local-abc-123",
      normalized: "local-abc-123",
      anilistId: null,
      malId: null,
      kitsuId: null,
      isLocal: true,
    });
    assert.equal(parseVisibilityIdentifier("   "), null);
    assert.equal(parseVisibilityIdentifier(null), null);
  });

  it("2. Bloqueia exclusivamente CN confirmado; preserva TW, HK, JP, KR e null sem inferência por título/idioma/temática", () => {
    assert.equal(normalizeCountryOfOrigin("cn"), "CN");
    assert.equal(normalizeCountryOfOrigin(" tw "), "TW");
    assert.equal(normalizeCountryOfOrigin("HK"), "HK");
    assert.equal(normalizeCountryOfOrigin(null), null);
    assert.equal(normalizeCountryOfOrigin(undefined), null);
    assert.equal(normalizeCountryOfOrigin(""), null);
    assert.equal(normalizeCountryOfOrigin("CHINA"), null);
    assert.equal(normalizeCountryOfOrigin("123"), null);

    assert.equal(isConfirmedDonghuaOrigin("CN"), true);
    assert.equal(isConfirmedDonghuaOrigin("cn"), true);
    assert.equal(isConfirmedDonghuaOrigin("TW"), false);
    assert.equal(isConfirmedDonghuaOrigin("HK"), false);
    assert.equal(isConfirmedDonghuaOrigin("JP"), false);
    assert.equal(isConfirmedDonghuaOrigin("KR"), false);
    assert.equal(isConfirmedDonghuaOrigin(null), false);
    assert.equal(isConfirmedDonghuaOrigin(undefined), false);

    // Animes com caracteres chineses ou palavra "Donghua" no título/gênero mas sem CN confirmado NÃO são bloqueados automaticamente
    const ambiguousWithChineseTitle = makeSlim("550001", {
      titles: {
        romaji: "Modao Zushi (Dublado)",
        english: "Grandmaster of Demonic Cultivation Donghua",
        native: "魔道祖師",
      },
      genres: ["Action", "Donghua"],
      countryOfOrigin: null,
    });
    const taiwanAnime = makeSlim("550002", {
      titles: { romaji: "Taiwan Original", english: "Taiwan Original", native: "台灣動畫" },
      countryOfOrigin: "TW",
    });
    const hongKongAnime = makeSlim("550003", {
      titles: { romaji: "Hong Kong Original", english: "Hong Kong Original", native: "香港動畫" },
      countryOfOrigin: "HK",
    });
    const confirmedCnAnime = makeSlim("550004", {
      titles: { romaji: "Normal Japanese-Sounding Title", english: "Innocent Title", native: "" },
      countryOfOrigin: "CN",
    });
    const jpWithBlockedId = makeSlim("966", {
      titles: { romaji: "Anime JP na blocklist", english: "Blocked JP", native: "" },
      countryOfOrigin: "JP",
    });

    const visible = filterPublicAnimes([
      ambiguousWithChineseTitle,
      taiwanAnime,
      hongKongAnime,
      confirmedCnAnime,
      jpWithBlockedId,
    ]);
    assert.deepEqual(
      visible.map((a) => a.id),
      ["550001", "550002", "550003"],
    );
  });

  it("3. Resolve aliases históricos e duplicatas dubladas via vínculos reais sem correspondência aproximada de título", () => {
    const ctx = buildServerVisibilityContextFromRows(
      [
        {
          id: "anilist-501001",
          anilistId: 501001,
          malId: 77001,
          kitsuId: 88001,
          countryOfOrigin: "CN",
          duplicateOfId: null,
        },
        {
          id: "local-dub-501001",
          anilistId: null,
          malId: null,
          kitsuId: null,
          countryOfOrigin: null,
          duplicateOfId: "anilist-501001",
        },
        {
          id: "local-dub-966",
          anilistId: null,
          malId: null,
          kitsuId: null,
          countryOfOrigin: "JP",
          duplicateOfId: "966",
        },
        {
          id: "anilist-501002",
          anilistId: 501002,
          malId: 77002,
          kitsuId: null,
          countryOfOrigin: "JP",
          duplicateOfId: null,
        },
        {
          id: "anilist-501003",
          anilistId: 501003,
          malId: null,
          kitsuId: null,
          countryOfOrigin: null,
          duplicateOfId: null,
        },
      ],
      [
        {
          oldId: "legacy-cn-alias",
          currentId: "anilist-501001",
          anilistId: 501001,
          malId: 77001,
          kitsuId: 88001,
        },
        {
          oldId: "legacy-22-alias",
          currentId: "212308",
          anilistId: 212308,
          malId: null,
          kitsuId: null,
        },
      ],
    );

    assert.equal(isPubliclyBlockedId("501001", ctx), true);
    assert.equal(isPubliclyBlockedId("anilist-501001", ctx), true);
    assert.equal(isPubliclyBlockedId("mal-77001", ctx), true);
    assert.equal(isPubliclyBlockedId("kitsu-88001", ctx), true);
    assert.equal(isPubliclyBlockedId("legacy-cn-alias", ctx), true);
    assert.equal(isPubliclyBlockedId("legacy-22-alias", ctx), true);
    assert.equal(isPubliclyBlockedId("local-dub-501001", ctx), true);
    assert.equal(isPubliclyBlockedId("local-dub-966", ctx), true);

    // Anime diferente com título muito semelhante ao anime bloqueado NÃO deve ser ocultado sem vínculo real
    const similarTitleDistinctAnime = makeSlim("501002", {
      anilistId: 501002,
      titles: {
        romaji: "Anime CN Similar Title Remake",
        english: "Anime CN Similar Title",
        native: "",
      },
      countryOfOrigin: "JP",
    });
    const unconfirmedAnime = makeSlim("501003", {
      anilistId: 501003,
      countryOfOrigin: null,
    });
    const blockedDubCopy = makeSlim("local-dub-501001", {
      anilistId: undefined,
      countryOfOrigin: null,
      duplicateOfId: "anilist-501001",
    });

    assert.deepEqual(
      filterPublicAnimes(
        [similarTitleDistinctAnime, unconfirmedAnime, blockedDubCopy],
        ctx,
      ).map((a) => a.id),
      ["501002", "501003"],
    );
  });

  it("4. Remove fallback incorreto '?? \"JP\"' em src/lib/api.ts e preserva countryOfOrigin=null em Jikan/Kitsu", () => {
    const apiSource = readFileSync(resolve(process.cwd(), "src/lib/api.ts"), "utf8");
    assert.equal(
      apiSource.includes('mappedAni?.countryOfOrigin ?? "JP"'),
      false,
      'Não deve existir fallback automático ?? "JP" em fetchAnimeDetail',
    );
    assert.equal(
      apiSource.includes("normalizeCountryOfOrigin(mappedAni?.countryOfOrigin)"),
      true,
    );
  });

  it("5. Proxy /api-anilist injeta countryOfOrigin nas queries públicas e filtra mídia bloqueada (CN + 22 IDs) mantendo TW/HK/null", () => {
    const clientQuery = `
      query Search($page: Int) {
        Page(page: $page) {
          media(type: ANIME) {
            id
            title { romaji }
          }
        }
      }
    `;
    const injected = injectCountryOfOriginIntoAnilistQuery(clientQuery);
    assert.match(injected, /media\([^)]*\)\s*\{\s*countryOfOrigin\b/);

    // Não duplica quando já existe
    const queryWithOrigin = `query Detail($id: Int) { Media(id: $id) { id countryOfOrigin } }`;
    assert.equal(injectCountryOfOriginIntoAnilistQuery(queryWithOrigin), queryWithOrigin);

    // Não altera queries Viewer ou mutations
    const viewerQuery = `query Viewer { Viewer { id mediaListOptions { scoreFormat } } }`;
    assert.equal(injectCountryOfOriginIntoAnilistQuery(viewerQuery), viewerQuery);

    const payload = {
      data: {
        Page: {
          media: [
            { id: 1001, countryOfOrigin: "JP", title: { romaji: "JP OK" } },
            { id: 1002, countryOfOrigin: "CN", title: { romaji: "CN Donghua" } },
            { id: 966, countryOfOrigin: "JP", title: { romaji: "Blocked ID 966" } },
            { id: 1003, countryOfOrigin: "TW", title: { romaji: "Taiwan OK" } },
            { id: 1004, countryOfOrigin: "HK", title: { romaji: "HK OK" } },
            { id: 1005, countryOfOrigin: null, title: { romaji: "Unknown OK" } },
          ],
          airingSchedules: [
            { id: 1, media: { id: 1001, countryOfOrigin: "JP" } },
            { id: 2, media: { id: 1002, countryOfOrigin: "CN" } },
            { id: 3, media: { id: 212308, countryOfOrigin: "JP" } },
          ],
        },
        Media: {
          id: 212308,
          countryOfOrigin: "JP",
          relations: {
            edges: [
              { node: { id: 1001, countryOfOrigin: "JP" } },
              { node: { id: 1002, countryOfOrigin: "CN" } },
            ],
          },
          recommendations: {
            nodes: [
              { mediaRecommendation: { id: 1003, countryOfOrigin: "TW" } },
              { mediaRecommendation: { id: 1002, countryOfOrigin: "CN" } },
            ],
          },
        },
      },
    };

    const filtered = filterAnilistProxyPayload(
      payload,
      EMPTY_PUBLIC_VISIBILITY_CONTEXT,
    ) as typeof payload;
    assert.deepEqual(
      filtered.data.Page.media.map((m) => m.id),
      [1001, 1003, 1004, 1005],
    );
    assert.deepEqual(
      filtered.data.Page.airingSchedules.map((s) => s.id),
      [1],
    );
    assert.equal(filtered.data.Media, null);
  });

  it("6. Home Hero, Em Alta, Calendário e helpers de cliente (overlayList, overlaySeasonList, mergeDetail, findLocalCover) aplicam a regra centralizada", async () => {
    resetHomeHeroTestState();
    resetHomeTrendingTestState();
    const nowMs = Date.UTC(2026, 4, 15, 12, 0, 0);

    const trendingCandidates: TrendingCatalogAnimeCandidateRow[] = [
      {
        id: "710001",
        title: "Trending JP",
        anilistId: 710001,
        malId: null,
        kitsuId: null,
        countryOfOrigin: "JP",
        duplicateOfId: null,
        titleRomaji: "Trending JP",
        titleEnglish: "Trending JP",
        titleNative: null,
        cover: "https://cdn.example.com/710001.jpg",
        format: "TV",
        status: "RELEASING",
        episodesCount: 12,
        year: 2026,
        season: "SPRING",
        genres: ["Action"],
        hidden: false,
        score: 85,
        popularity: 90000,
        trending: 2000,
        updatedAt: new Date(nowMs - 3600_000).toISOString(),
        publishedEpisodeCount: 1,
        latestEpisodePublishedAt: new Date(nowMs - 3600_000).toISOString(),
        epSources: [{ videoUrl: "https://cdn.example.com/ep1.mp4" }],
        hasTodayAiringSchedule: true,
        hasWeekAiringSchedule: true,
      },
      {
        id: "710002",
        title: "Trending CN Donghua",
        anilistId: 710002,
        malId: null,
        kitsuId: null,
        countryOfOrigin: "CN",
        duplicateOfId: null,
        titleRomaji: "Trending CN Donghua",
        titleEnglish: "Trending CN Donghua",
        titleNative: null,
        cover: "https://cdn.example.com/710002.jpg",
        format: "ONA",
        status: "RELEASING",
        episodesCount: 12,
        year: 2026,
        season: "SPRING",
        genres: ["Action"],
        hidden: false,
        score: 99,
        popularity: 999999,
        trending: 9999,
        updatedAt: new Date(nowMs - 1000).toISOString(),
        publishedEpisodeCount: 1,
        latestEpisodePublishedAt: new Date(nowMs - 1000).toISOString(),
        epSources: [{ videoUrl: "https://cdn.example.com/cn.mp4" }],
        hasTodayAiringSchedule: true,
        hasWeekAiringSchedule: true,
      },
      {
        id: "966",
        title: "Trending Blocked ID 966",
        anilistId: 966,
        malId: null,
        kitsuId: null,
        countryOfOrigin: "JP",
        duplicateOfId: null,
        titleRomaji: "Trending Blocked ID 966",
        titleEnglish: "Trending Blocked ID 966",
        titleNative: null,
        cover: "https://cdn.example.com/966.jpg",
        format: "TV",
        status: "RELEASING",
        episodesCount: 12,
        year: 2026,
        season: "SPRING",
        genres: ["Action"],
        hidden: false,
        score: 98,
        popularity: 999999,
        trending: 9999,
        updatedAt: new Date(nowMs - 1000).toISOString(),
        publishedEpisodeCount: 1,
        latestEpisodePublishedAt: new Date(nowMs - 1000).toISOString(),
        epSources: [{ videoUrl: "https://cdn.example.com/966.mp4" }],
        hasTodayAiringSchedule: true,
        hasWeekAiringSchedule: true,
      },
    ];

    const scoredTrending = scoreAndRankHomeTrending(
      trendingCandidates,
      { byId: new Map(), byAnilistId: new Map(), byMalId: new Map(), byKitsuId: new Map() },
      [],
      nowMs,
      EMPTY_PUBLIC_VISIBILITY_CONTEXT,
    );
    assert.deepEqual(
      scoredTrending.map((x) => x.anime.id),
      ["710001"],
    );

    const trendingItems = await getHomeTrendingItemsWithDeps(
      {
        getRedisTrending: async () => ({ status: "unavailable", payload: null, fence: null }),
        setRedisTrending: async () => "unavailable",
        scheduleWrite: () => {},
        queryCatalog: async () => trendingCandidates,
        queryBadges: async () => ({
          byId: new Map(),
          byAnilistId: new Map(),
          byMalId: new Map(),
          byKitsuId: new Map(),
        }),
        queryAudienceSignals: async () => [],
      },
      nowMs,
    );
    assert.deepEqual(
      trendingItems.map((i) => i.id),
      ["710001"],
    );

    // Home Hero também bloqueia CN e 22 IDs
    const heroRows: HeroCatalogAnimeCandidateRow[] = [
      {
        id: "710001",
        title: "Hero JP",
        anilistId: 710001,
        malId: null,
        kitsuId: null,
        countryOfOrigin: "JP",
        duplicateOfId: null,
        titleRomaji: "Hero JP",
        titleEnglish: "Hero JP",
        titleNative: null,
        cover: "https://cdn.example.com/710001.jpg",
        banner: "https://cdn.example.com/banner-710001.jpg",
        synopsis: "Sinopse",
        format: "TV",
        status: "RELEASING",
        episodesCount: 12,
        year: 2026,
        season: "SPRING",
        genres: ["Action"],
        trailerId: null,
        hidden: false,
        archivedAt: null,
        score: 85,
        popularity: 50000,
        trending: 1000,
        createdAt: new Date(nowMs - 86400_000).toISOString(),
        updatedAt: new Date(nowMs - 3600_000).toISOString(),
        publishedEpisodeCount: 1,
        firstEpisodePublishedAt: new Date(nowMs - 3600_000).toISOString(),
        latestEpisodePublishedAt: new Date(nowMs - 3600_000).toISOString(),
        ep1Sources: [{ videoUrl: "https://cdn.example.com/ep1.mp4" }],
        hasTodayAiringSchedule: true,
        hasTodayWeeklyRecurrence: false,
      },
      {
        id: "710002",
        title: "Hero CN",
        anilistId: 710002,
        malId: null,
        kitsuId: null,
        countryOfOrigin: "CN",
        duplicateOfId: null,
        titleRomaji: "Hero CN",
        titleEnglish: "Hero CN",
        titleNative: null,
        cover: "https://cdn.example.com/710002.jpg",
        banner: "https://cdn.example.com/banner-710002.jpg",
        synopsis: "Sinopse CN",
        format: "ONA",
        status: "RELEASING",
        episodesCount: 12,
        year: 2026,
        season: "SPRING",
        genres: ["Action"],
        trailerId: null,
        hidden: false,
        archivedAt: null,
        score: 95,
        popularity: 90000,
        trending: 9000,
        createdAt: new Date(nowMs - 86400_000).toISOString(),
        updatedAt: new Date(nowMs - 3600_000).toISOString(),
        publishedEpisodeCount: 1,
        firstEpisodePublishedAt: new Date(nowMs - 3600_000).toISOString(),
        latestEpisodePublishedAt: new Date(nowMs - 3600_000).toISOString(),
        ep1Sources: [{ videoUrl: "https://cdn.example.com/cn.mp4" }],
        hasTodayAiringSchedule: true,
        hasTodayWeeklyRecurrence: false,
      },
    ];

    const scoredHero = scoreAndDeduplicateHeroCandidates(
      heroRows,
      [makeSlim("966", { anilistId: 966 })],
      nowMs,
      [],
      EMPTY_PUBLIC_VISIBILITY_CONTEXT,
    );
    assert.deepEqual(
      scoredHero.map((s) => s.anime.id),
      ["710001"],
    );

    const heroItems = await getHomeHeroItemsWithDeps(
      {
        getRedisPool: async () => ({ status: "unavailable", payload: null, fence: null }),
        setRedisPool: async () => "unavailable",
        scheduleWrite: () => {},
        getTrendingItems: async () => trendingItems,
        queryCatalog: async () => heroRows,
      },
      nowMs,
    );
    assert.deepEqual(
      heroItems.map((h) => h.id),
      ["710001"],
    );

    // Calendário (hoje + semanal) preserva countryOfOrigin para filtragem pública
    const todayMapped = mapTodayScheduleRowsToSlimAnime(
      [
        {
          anilistId: 710001,
          episode: 1,
          airingAtEpoch: Math.floor(nowMs / 1000),
          animeId: "710001",
          malId: null,
          kitsuId: null,
          title: "JP Calendar",
          titleRomaji: "JP Calendar",
          titleEnglish: "JP Calendar",
          titleNative: null,
          cover: "https://cdn.example.com/710001.jpg",
          banner: null,
          synopsis: null,
          format: "TV",
          status: "RELEASING",
          episodesCount: 12,
          year: 2026,
          season: "SPRING",
          genres: ["Action"],
          trailerId: null,
          score: 80,
          updatedAt: null,
          countryOfOrigin: "JP",
          duplicateOfId: null,
          hasEpisode: true,
        },
        {
          anilistId: 710002,
          episode: 1,
          airingAtEpoch: Math.floor(nowMs / 1000),
          animeId: "710002",
          malId: null,
          kitsuId: null,
          title: "CN Calendar",
          titleRomaji: "CN Calendar",
          titleEnglish: "CN Calendar",
          titleNative: null,
          cover: "https://cdn.example.com/710002.jpg",
          banner: null,
          synopsis: null,
          format: "ONA",
          status: "RELEASING",
          episodesCount: 12,
          year: 2026,
          season: "SPRING",
          genres: ["Action"],
          trailerId: null,
          score: 90,
          updatedAt: null,
          countryOfOrigin: "CN",
          duplicateOfId: null,
          hasEpisode: true,
        },
      ],
      "2026-05-15",
    );
    assert.deepEqual(
      filterPublicAnimes(todayMapped).map((i) => i.id),
      ["710001"],
    );

    const weeklyMapped = mapWeeklyScheduleRowsAndRecurrences({
      scheduleRows: [
        {
          scheduleId: "sched-cn-1",
          anilistId: 710002,
          episode: 1,
          airingAtEpoch: Math.floor(nowMs / 1000),
          timeUntilAiring: 100,
          animeId: "710002",
          title: "CN Weekly",
          titleRomaji: "CN Weekly",
          titleEnglish: "CN Weekly",
          titleNative: null,
          cover: null,
          banner: null,
          format: "ONA",
          status: "RELEASING",
          genres: [],
          countryOfOrigin: "CN",
          duplicateOfId: null,
        },
        {
          scheduleId: "sched-tw-1",
          anilistId: 710003,
          episode: 1,
          airingAtEpoch: Math.floor(nowMs / 1000),
          timeUntilAiring: 100,
          animeId: "710003",
          title: "TW Weekly",
          titleRomaji: "TW Weekly",
          titleEnglish: "TW Weekly",
          titleNative: null,
          cover: null,
          banner: null,
          format: "TV",
          status: "RELEASING",
          genres: [],
          countryOfOrigin: "TW",
          duplicateOfId: null,
        },
      ],
      recurrenceRows: [],
      weekDays: [{ dateKey: "2026-05-15", index: 5 }],
    });
    const visibleWeekly = weeklyMapped.filter(
      (w) =>
        !isPubliclyBlockedAnime({
          id: w.media.animeId ?? w.media.id,
          anilistId: w.media.id,
          countryOfOrigin: w.media.countryOfOrigin,
          duplicateOfId: w.media.duplicateOfId,
        }),
    );
    assert.deepEqual(
      visibleWeekly.map((w) => w.media.id),
      [710003],
    );

    // Helpers de cliente (overlayList, overlaySeasonList, mergeDetail, findLocalCover, buildSearchEntityWorks, searchEntities)
    const cnLocal = makeLocal("local-cn-1", {
      anilistId: 710002,
      countryOfOrigin: "CN",
    });
    const cnDubCopy = makeLocal("local-dub-cn-1", {
      anilistId: undefined,
      countryOfOrigin: null,
      duplicateOfId: "local-cn-1",
      titleRomaji: "Local CN Dublado",
    });
    const twLocal = makeLocal("local-tw-1", {
      anilistId: 710003,
      countryOfOrigin: "TW",
      season: "SPRING",
      year: 2025,
    });
    const clientLocals = [cnLocal, cnDubCopy, twLocal];

    const overlaid = overlayList(
      [
        makeSlim("710002", { countryOfOrigin: "CN" }),
        makeSlim("966", { countryOfOrigin: "JP" }),
        makeSlim("710003", { countryOfOrigin: "TW" }),
        makeSlim("710004", { countryOfOrigin: "TW" }),
      ],
      clientLocals,
    );
    assert.deepEqual(
      overlaid.map((a) => a.id),
      ["local-tw-1", "710004"],
    );

    const overlaidSeason = overlaySeasonList(
      [
        makeSlim("966", { season: "SPRING", year: 2025 }),
        makeSlim("710003", { countryOfOrigin: "TW", season: "SPRING", year: 2025 }),
      ],
      clientLocals,
      "SPRING",
      2025,
    );
    assert.deepEqual(
      overlaidSeason.map((a) => a.id),
      ["local-tw-1"],
    );

    const overlaidSeasonFromLocalsOnly = overlaySeasonList(
      [],
      clientLocals,
      "SPRING",
      2025,
    );
    assert.deepEqual(
      overlaidSeasonFromLocalsOnly.map((a) => a.id),
      ["local-tw-1"],
    );

    assert.equal(mergeDetail(null, "local-cn-1", clientLocals), null);
    assert.equal(mergeDetail(null, "local-dub-cn-1", clientLocals), null);
    assert.equal(mergeDetail(makeFullAnime("966"), "966", clientLocals), null);

    const detailWithMixedRecs = mergeDetail(
      makeFullAnime("710003", {
        countryOfOrigin: "TW",
        recommendations: [
          makeSlim("966", { countryOfOrigin: "JP" }),
          makeSlim("710002", { countryOfOrigin: "CN" }),
          makeSlim("710099", { countryOfOrigin: "JP" }),
        ],
      }),
      "710003",
      clientLocals,
    );
    assert.ok(detailWithMixedRecs);
    assert.deepEqual(
      detailWithMixedRecs.recommendations.map((r) => r.id),
      ["710099"],
    );
    assert.equal(findLocalCover("local-dub-cn-1", clientLocals, []), undefined);
    assert.equal(findLocalCover("966", clientLocals, []), undefined);

    const prevAnimes = useHikariStore.getState().animes;
    const prevFetch = globalThis.fetch;
    useHikariStore.setState({ animes: clientLocals });
    globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      const bodyStr = String(init?.body ?? "");
      if (bodyStr.includes("StudioWorks")) {
        return new Response(
          JSON.stringify({
            data: {
              Studio: {
                id: 901,
                name: "Studio Test",
                isAnimationStudio: true,
                media: {
                  nodes: [
                    { id: 966, countryOfOrigin: "JP", title: { romaji: "Blocked 966" }, coverImage: {}, startDate: { year: 2025 } },
                    { id: 710002, countryOfOrigin: "CN", title: { romaji: "Donghua CN" }, coverImage: {}, startDate: { year: 2025 } },
                    { id: 710099, countryOfOrigin: "JP", title: { romaji: "Allowed JP" }, coverImage: {}, startDate: { year: 2025 } },
                  ],
                },
              },
            },
          }),
          { status: 200 },
        );
      }
      if (bodyStr.includes("PersonWorks")) {
        return new Response(
          JSON.stringify({
            data: {
              Staff: {
                id: 902,
                name: { full: "VA Test" },
                image: {},
                primaryOccupations: ["Voice Actor"],
                characterMedia: {
                  edges: [
                    {
                      characterRole: "MAIN",
                      characters: [{ id: 1, name: { full: "Char CN" } }],
                      node: { id: 710002, countryOfOrigin: "CN", title: { romaji: "Donghua CN" }, coverImage: {}, startDate: { year: 2025 } },
                    },
                    {
                      characterRole: "MAIN",
                      characters: [{ id: 2, name: { full: "Char JP" } }],
                      node: { id: 710099, countryOfOrigin: "JP", title: { romaji: "Allowed JP" }, coverImage: {}, startDate: { year: 2025 } },
                    },
                  ],
                },
                staffMedia: {
                  edges: [
                    {
                      staffRole: "Director",
                      node: { id: 212308, countryOfOrigin: "JP", title: { romaji: "Blocked 212308" }, coverImage: {}, startDate: { year: 2025 } },
                    },
                  ],
                },
              },
            },
          }),
          { status: 200 },
        );
      }
      if (bodyStr.includes("SearchCharacters")) {
        return new Response(
          JSON.stringify({
            data: {
              Page: {
                pageInfo: { hasNextPage: false },
                characters: [
                  {
                    id: 5001,
                    name: { full: "Protagonist" },
                    media: {
                      nodes: [
                        { id: 710002, countryOfOrigin: "CN", title: { romaji: "Donghua CN" } },
                        { id: 710099, countryOfOrigin: "JP", title: { romaji: "Allowed JP" } },
                      ],
                    },
                  },
                ],
              },
            },
          }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          data: {
            Page: {
              pageInfo: { hasNextPage: false },
              staff: [
                {
                  id: 6001,
                  name: { full: "Staff Test" },
                  primaryOccupations: ["Director"],
                  staffMedia: {
                    edges: [
                      { staffRole: "Director", node: { id: 966, countryOfOrigin: "JP", title: { romaji: "Blocked 966" } } },
                      { staffRole: "Director", node: { id: 710003, countryOfOrigin: "TW", title: { romaji: "Allowed TW" } } },
                    ],
                  },
                  characterMedia: { edges: [] },
                },
              ],
            },
          },
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    try {
      const studioData = await getStudioWorks("Studio Test", 901);
      assert.deepEqual(
        (studioData.studioAnimes ?? []).map((w) => w.id),
        ["710099"],
      );

      const personData = await getPersonWorks("VA Test", 902, "dublador");
      assert.deepEqual(
        (personData.dubladorWorks ?? []).map((w) => w.anime.id),
        ["710099"],
      );
      assert.equal((personData.staffWorks ?? []).length, 0);

      const charSearch = await searchCharacters("Protagonist", 1, 10);
      assert.equal(charSearch.items[0]?.anime?.id, 710099);

      const peopleSearch = await searchPeople("Staff Test", 1, 10);
      assert.equal(peopleSearch.items[0]?.anime?.id, 710003);
    } finally {
      globalThis.fetch = prevFetch;
      useHikariStore.setState({ animes: prevAnimes });
    }
  });

  it("7. Script anilist-sync inclui countryOfOrigin nas queries GraphQL e backfill controlado atualiza apenas válidos sem fallback JP", async () => {
    assert.match(MEDIA_LIST_QUERY, /\bcountryOfOrigin\b/);
    assert.match(ANNOUNCED_MEDIA_QUERY, /\bcountryOfOrigin\b/);
    assert.match(SEASON_QUERY, /\bcountryOfOrigin\b/);
    assert.match(AIRING_SCHEDULE_QUERY, /\bcountryOfOrigin\b/);

    const resolvedNull = resolveCatalogAnimeFields(
      {
        id: 88801,
        title: { romaji: "No Origin", english: null, native: null },
        coverImage: {},
        genres: [],
      },
      null,
    );
    assert.equal(resolvedNull.countryOfOrigin, null);

    const resolvedCn = resolveCatalogAnimeFields(
      {
        id: 88802,
        countryOfOrigin: "cn",
        title: { romaji: "CN Origin", english: null, native: null },
        coverImage: {},
        genres: [],
      },
      null,
    );
    assert.equal(resolvedCn.countryOfOrigin, "CN");

    const builtBatch = buildAniListOriginBatchQuery([10, 20, 10]);
    assert.ok(builtBatch);
    assert.deepEqual(builtBatch.ids, [10, 20]);
    assert.match(builtBatch.query, /countryOfOrigin/);

    // Teste controlado do runCountryOfOriginBackfill com client simulado
    const rows = [
      { id: "a-cn", anilistId: 10001, countryOfOrigin: null },
      { id: "a-null", anilistId: 10002, countryOfOrigin: null },
      { id: "a-confirmed", anilistId: 10003, countryOfOrigin: "JP" },
      { id: "a-fail", anilistId: 10004, countryOfOrigin: "TW" },
    ];
    const updates: Array<{ anilistId: number; origin: string }> = [];

    const mockClient = {
      async query(sqlText: string, params: unknown[] = []) {
        if (sqlText.includes("SELECT")) {
          const onlyNull = sqlText.includes('IS NULL');
          return {
            rows: onlyNull
              ? rows.filter((r) => !r.countryOfOrigin)
              : rows,
          };
        }
        if (sqlText.includes("UPDATE")) {
          const [origin, aniId] = params as [string, number];
          updates.push({ anilistId: aniId, origin });
          const target = rows.find((r) => r.anilistId === aniId);
          if (target) target.countryOfOrigin = origin;
          return { rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      },
    };

    let fetchCalls = 0;
    const summary = await runCountryOfOriginBackfill({
      client: mockClient,
      includeConfirmed: true,
      batchSize: 2,
      delayMs: 0,
      maxRetries: 1,
      baseRetryMs: 0,
      sleepFn: async () => {},
      fetchFn: async () => {
        fetchCalls += 1;
        if (fetchCalls === 1) {
          return new Response(
            JSON.stringify({
              data: {
                a0: { id: 10001, countryOfOrigin: "CN" },
                a1: { id: 10002, countryOfOrigin: null },
              },
            }),
            { status: 200 },
          );
        }
        // Simula falha HTTP 500 no segundo lote — NÃO pode sobrescrever JP/TW com NULL nem abortar
        return new Response(JSON.stringify({ errors: [{ message: "upstream err" }] }), {
          status: 500,
        });
      },
    });

    assert.equal(summary.batchesProcessed, 2);
    assert.equal(summary.batchesFailed, 1);
    assert.equal(summary.updatedCount, 1);
    assert.deepEqual(updates, [{ anilistId: 10001, origin: "CN" }]);
    assert.equal(rows.find((r) => r.id === "a-cn")?.countryOfOrigin, "CN");
    assert.equal(rows.find((r) => r.id === "a-null")?.countryOfOrigin, null);
    assert.equal(rows.find((r) => r.id === "a-confirmed")?.countryOfOrigin, "JP");
    assert.equal(rows.find((r) => r.id === "a-fail")?.countryOfOrigin, "TW");
  });
});

describe(`Integração PostgreSQL (${dbSource}): persistência não destrutiva, visibilidade pública vs Admin`, () => {
  const runId = Date.now();
  const cnId = `vis-cn-${runId}`;
  const cnAnilistId = 950000 + (runId % 40000);
  const twId = `vis-tw-${runId}`;
  const twAnilistId = 960000 + (runId % 40000);
  const blocked22Id = `vis-22-${runId}`;
  const blocked22AnilistId = 212308; // primeiro da lista de 22 IDs
  const dubId = `local-dub-vis-${runId}`;
  const oldAliasId = `old-cn-alias-${runId}`;
  const createdIds = [cnId, twId, blocked22Id, dubId];
  const epIds = [`ep-cn-${runId}`, `ep-tw-${runId}`, `ep-22-${runId}`, `ep-dub-${runId}`];

  after(async () => {
    const sql = await getSql();
    await sql.query(`DELETE FROM "catalog_anime_id_alias" WHERE "old_id" = $1 OR "current_id" = ANY($2::text[]);`, [
      oldAliasId,
      createdIds,
    ]);
    await sql.query(`DELETE FROM "catalog_episode" WHERE "id" = ANY($1::text[]);`, [epIds]);
    await sql.query(`DELETE FROM "catalog_season" WHERE "animeId" = ANY($1::text[]);`, [createdIds]);
    await sql.query(`DELETE FROM "catalog_anime" WHERE "id" = ANY($1::text[]);`, [createdIds]);
    invalidatePublicVisibilityCache();
    invalidateCatalogIndex();
    invalidateCatalogEpisodesCache();
    invalidatePublicCatalogEpisodesLocalCache();
    invalidateServerCatalogCaches();
  });

  it("8. Migration 0052 aplicada no schema, upsert persiste country_of_origin/duplicate_of_id, e registro oculto permanece intacto no DB e acessível no Admin", async () => {
    const sql = await getSql();

    // Verifica que as colunas não destrutivas existem em catalog_anime
    const cols = await sql.query<{ column_name: string; is_nullable: string }>(
      `SELECT "column_name", "is_nullable"
       FROM "information_schema"."columns"
       WHERE "table_name" = 'catalog_anime'
         AND "column_name" IN ('country_of_origin', 'duplicate_of_id');`,
    );
    assert.equal(cols.length, 2);
    assert.ok(cols.every((c) => c.is_nullable === "YES"));

    // 1. Anime Donghua CN
    const upCn = await executeAdminUpsertCatalogAnime({
      id: cnId,
      title: `Donghua Teste ${runId}`,
      titleRomaji: `Donghua Teste ${runId}`,
      anilistId: cnAnilistId,
      countryOfOrigin: "CN",
      hidden: false,
      seasons: [{ number: 1, title: "Temporada 1" }],
    });
    assert.equal(upCn.animeId, cnId);

    // 2. Anime TW (não deve ser considerado CN)
    await executeAdminUpsertCatalogAnime({
      id: twId,
      title: `Taiwan Teste ${runId}`,
      titleRomaji: `Taiwan Teste ${runId}`,
      anilistId: twAnilistId,
      countryOfOrigin: "TW",
      hidden: false,
      seasons: [{ number: 1, title: "Temporada 1" }],
    });

    // 3. Anime com um dos 22 IDs AniList bloqueados (mesmo com origem JP)
    await executeAdminUpsertCatalogAnime({
      id: blocked22Id,
      title: `Blocked 22 Teste ${runId}`,
      titleRomaji: `Blocked 22 Teste ${runId}`,
      anilistId: blocked22AnilistId,
      countryOfOrigin: "JP",
      hidden: false,
      seasons: [{ number: 1, title: "Temporada 1" }],
    });

    // 4. Duplicata dublada local-* vinculada via duplicateOfId ao Donghua CN (sem anilistId próprio)
    await executeAdminUpsertCatalogAnime({
      id: dubId,
      title: `Donghua Teste ${runId} (Dublado)`,
      titleRomaji: `Donghua Teste ${runId} (Dublado)`,
      anilistId: null,
      countryOfOrigin: null,
      duplicateOfId: cnId,
      hidden: false,
      seasons: [{ number: 1, title: "Temporada 1" }],
    });

    // Alias histórico apontando para o Donghua CN
    await sql.query(
      `INSERT INTO "catalog_anime_id_alias" ("old_id", "current_id", "anilist_id")
       VALUES ($1, $2, $3)
       ON CONFLICT ("old_id") DO UPDATE SET "current_id" = EXCLUDED."current_id";`,
      [oldAliasId, cnId, cnAnilistId],
    );

    // Episódios publicados com thumbnails e videoUrl válidos
    await sql.query(
      `INSERT INTO "catalog_episode" ("id", "animeId", "seasonNumber", "number", "title", "thumbnail", "videoUrl", "published", "publishedAt")
       VALUES
         ($1, $5, 1, 1, 'Ep 1 CN', 'https://cdn.example.com/cn-thumb.jpg', 'https://cdn.example.com/cn-ep1.mp4', true, CURRENT_TIMESTAMP),
         ($2, $6, 1, 1, 'Ep 1 TW', 'https://cdn.example.com/tw-thumb.jpg', 'https://cdn.example.com/tw-ep1.mp4', true, CURRENT_TIMESTAMP),
         ($3, $7, 1, 1, 'Ep 1 Blocked 22', 'https://cdn.example.com/22-thumb.jpg', 'https://cdn.example.com/22-ep1.mp4', true, CURRENT_TIMESTAMP),
         ($4, $8, 1, 1, 'Ep 1 Dub CN', 'https://cdn.example.com/dub-thumb.jpg', 'https://cdn.example.com/dub-ep1.mp4', true, CURRENT_TIMESTAMP);`,
      [epIds[0], epIds[1], epIds[2], epIds[3], cnId, twId, blocked22Id, dubId],
    );

    invalidatePublicVisibilityCache();
    invalidateCatalogIndex();
    invalidateCatalogEpisodesCache();
    invalidatePublicCatalogEpisodesLocalCache();
    invalidateServerCatalogCaches();

    // Regra server-side bloqueia CN, 22 IDs, duplicata dublada e alias, e libera TW
    assert.equal(await isServerPubliclyBlockedId(cnId, sql), true);
    assert.equal(await isServerPubliclyBlockedId(cnAnilistId, sql), true);
    assert.equal(await isServerPubliclyBlockedId(oldAliasId, sql), true);
    assert.equal(await isServerPubliclyBlockedId(dubId, sql), true);
    assert.equal(await isServerPubliclyBlockedId(blocked22Id, sql), true);
    assert.equal(await isServerPubliclyBlockedId(blocked22AnilistId, sql), true);
    assert.equal(await isServerPubliclyBlockedId(twId, sql), false);
    assert.equal(await isServerPubliclyBlockedAnime({ id: dubId }, sql), true);

    const serverCtx = await getServerPublicVisibilityContext(sql);
    assert.equal(serverCtx.blockedCatalogIds.has(dubId), true);
    assert.equal(serverCtx.blockedCatalogIds.has(oldAliasId), true);

    const filteredServer = await filterServerPublicAnimes(
      [makeSlim(cnId), makeSlim(dubId), makeSlim(blocked22Id), makeSlim(twId)],
      sql,
    );
    assert.deepEqual(
      filteredServer.map((a) => a.id),
      [twId],
    );

    // Superfícies públicas de catálogo/episódios ocultam os bloqueados
    assert.equal(await buildLocalAnimeFromDb(cnId, { includeBlocked: false }), null);
    assert.equal(await buildLocalAnimeFromDb(dubId, { includeBlocked: false }), null);
    assert.equal(await buildLocalAnimeFromDb(blocked22Id, { includeBlocked: false }), null);
    assert.equal(await buildLocalAnimeFromDb(oldAliasId, { includeBlocked: false }), null);
    assert.ok(await buildLocalAnimeFromDb(twId, { includeBlocked: false }));

    assert.equal(await executeFetchAnimeDetail(cnId, { allowBlocked: false }), null);
    assert.equal(await executeFetchAnimeDetail(dubId, { allowBlocked: false }), null);
    assert.equal(await executeFetchAnimeDetail(String(blocked22AnilistId), { allowBlocked: false }), null);

    const publicLocalSearch = await searchLocalCatalogAnime(`Teste ${runId}`, 20, {
      includeBlocked: false,
    });
    assert.equal(publicLocalSearch.some((a) => a.id === cnId || a.id === dubId || a.id === blocked22Id), false);
    assert.equal(publicLocalSearch.some((a) => a.id === twId), true);

    const overlaidSlim = await applyDbCatalogOverlayToSlimList(
      [makeSlim(cnId), makeSlim(dubId), makeSlim(twId)],
      { includeBlocked: false },
    );
    assert.deepEqual(
      overlaidSlim.map((a) => a.id),
      [twId],
    );

    assert.equal(
      await applyDbCatalogOverlayToDetail(makeFullAnime(blocked22Id, { anilistId: blocked22AnilistId }), blocked22Id, {
        includeBlocked: false,
      }),
      null,
    );

    const pubEpsCn = await executeGetCatalogEpisodes(cnId, { includeUnpublished: false });
    assert.equal(pubEpsCn.episodes.length, 0);

    const pubPaginated = await executeGetPaginatedPublicCatalogEpisodes({
      q: `Teste ${runId}`,
      page: 1,
      pageSize: 50,
    });
    assert.equal(
      pubPaginated.episodes.some((e) => e.animeId === cnId || e.animeId === dubId || e.animeId === blocked22Id),
      false,
    );
    assert.equal(
      pubPaginated.episodes.some((e) => e.animeId === twId),
      true,
    );

    const pubAllEps = await executeGetPublicCatalogEpisodes({ limit: 500, offset: 0 });
    assert.equal(
      pubAllEps.episodes.some((e) => e.animeId === cnId || e.animeId === dubId || e.animeId === blocked22Id),
      false,
    );

    const pubOptions = await executeGetPublicCatalogAnimeOptions();
    assert.equal(
      pubOptions.some((o) => o.id === cnId || o.id === dubId || o.id === blocked22Id),
      false,
    );

    // Sitemap exclui IDs bloqueados
    const sitemapItems = await getSitemapAnimeCatalog();
    assert.equal(
      sitemapItems.some((s) => BLOCKED_ANILIST_IDS.includes(Number(s.id) as (typeof BLOCKED_ANILIST_IDS)[number])),
      false,
    );

    // Painel Admin mantém acesso irrestrito aos mesmos animes e episódios
    const adminSearch = await searchLocalCatalogAnime(`Teste ${runId}`, 20, {
      includeBlocked: true,
    });
    assert.ok(adminSearch.some((a) => a.id === cnId));
    assert.ok(adminSearch.some((a) => a.id === dubId));
    assert.ok(adminSearch.some((a) => a.id === blocked22Id));

    const adminDetailCn = await buildLocalAnimeFromDb(cnId, { includeBlocked: true });
    assert.ok(adminDetailCn);
    assert.equal(adminDetailCn.countryOfOrigin, "CN");
    assert.equal(adminDetailCn.seasons[0]?.episodes.length, 1);

    const adminDetailDub = await executeFetchAnimeDetail(dubId, { allowBlocked: true });
    assert.ok(adminDetailDub);
    assert.equal(adminDetailDub.duplicateOfId, cnId);

    const adminEpsCn = await executeGetCatalogEpisodes(cnId, { includeUnpublished: true });
    assert.equal(adminEpsCn.episodes.length, 1);

    // Invariante não destrutiva: hidden, archived_at, published, thumbnail e videoUrl permanecem intactos no banco
    const dbCheck = await sql.query<{
      id: string;
      hidden: boolean;
      archived_at: string | null;
      country_of_origin: string | null;
      duplicate_of_id: string | null;
    }>(
      `SELECT "id", "hidden", "archived_at", "country_of_origin", "duplicate_of_id"
       FROM "catalog_anime"
       WHERE "id" = ANY($1::text[]);`,
      [createdIds],
    );
    assert.equal(dbCheck.length, 4);
    for (const row of dbCheck) {
      assert.equal(row.hidden, false, `hidden não deve ser alterado em ${row.id}`);
      assert.equal(row.archived_at, null, `archived_at não deve ser alterado em ${row.id}`);
    }

    const epCheck = await sql.query<{
      id: string;
      published: boolean;
      thumbnail: string | null;
      videoUrl: string | null;
    }>(
      `SELECT "id", "published", "thumbnail", "videoUrl"
       FROM "catalog_episode"
       WHERE "id" = ANY($1::text[]);`,
      [epIds],
    );
    assert.equal(epCheck.length, 4);
    for (const ep of epCheck) {
      assert.equal(ep.published, true);
      assert.ok(ep.thumbnail);
      assert.ok(ep.videoUrl);
    }

    // Arquivamento e restauração admin continuam funcionando normalmente
    const archRes = await executeAdminArchiveCatalogAnime(blocked22Id);
    assert.equal(archRes.found, true);
    const restored = await executeAdminUpsertCatalogAnime({
      id: blocked22Id,
      title: `Blocked 22 Teste ${runId}`,
      anilistId: blocked22AnilistId,
      countryOfOrigin: "JP",
      hidden: false,
    });
    assert.equal(restored.animeId, blocked22Id);
  });
});
