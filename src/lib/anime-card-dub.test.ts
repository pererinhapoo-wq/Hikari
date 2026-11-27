import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from "@tanstack/react-router";
import { PGlite } from "@electric-sql/pglite";
import { AnimeCard } from "../components/anime-card";
import { EpisodeCard } from "../components/episode-card";
import {
  buildEpisodeDubbedSqlCondition,
  isAnimeDubbed,
  isPublishedEpisodeDubbed,
} from "./published-episodes";
import {
  mergeRowIntoSlim,
  resolveCatalogRowIsDubbed,
  type DbCatalogAnimeRow,
} from "./catalog-server-overlay.server";
import {
  scoreAndRankHomeTrending,
  type TrendingCatalogAnimeCandidateRow,
} from "./home-trending.server";
import {
  mapTodayScheduleRowsToSlimAnime,
  mapWeeklyScheduleRowsAndRecurrences,
  type DbTodayScheduleRow,
  type DbWeeklyRecurrenceJoinedRow,
  type DbWeeklyScheduleRow,
} from "./calendar-schedule.server";
import { overlaySlim, slimSnapshot } from "./store";
import { localToAnime, type LocalAnime, type SlimAnime } from "./types";
import type { AnimeRecentBadgesLookup } from "./catalog-badges";

function emptyBadgesLookup(): AnimeRecentBadgesLookup {
  return {
    byId: new Map(),
    byAnilistId: new Map(),
    byMalId: new Map(),
    byKitsuId: new Map(),
  };
}

function makeBaseSlim(overrides: Partial<SlimAnime> = {}): SlimAnime {
  return {
    id: "anime-base",
    titles: {
      romaji: "Sousou no Frieren",
      english: "Frieren: Beyond Journey's End",
      native: "葬送のフリーレン",
    },
    cover: "https://cdn.example.com/cover.jpg",
    banner: "",
    synopsis: "",
    score: 90,
    genres: ["Adventure", "Fantasy"],
    format: "TV",
    status: "FINISHED",
    episodesCount: 28,
    season: "FALL",
    year: 2023,
    trailerId: null,
    source: "anilist",
    ...overrides,
  };
}

function makeBaseDbRow(
  overrides: Partial<DbCatalogAnimeRow> = {},
): DbCatalogAnimeRow {
  return {
    id: "anime-db-1",
    title: "Sousou no Frieren",
    anilistId: 154587,
    malId: 52991,
    kitsuId: null,
    titleRomaji: "Sousou no Frieren",
    titleEnglish: "Frieren: Beyond Journey's End",
    titleNative: "葬送のフリーレン",
    cover: "https://cdn.example.com/cover.jpg",
    banner: null,
    synopsis: null,
    format: "TV",
    status: "FINISHED",
    episodesCount: 28,
    year: 2023,
    season: "FALL",
    genres: ["Adventure", "Fantasy"],
    trailerId: null,
    hidden: false,
    score: 90,
    updatedAt: "2026-10-01T12:00:00.000Z",
    hasEpisode: false,
    hasDubbedEpisode: false,
    ...overrides,
  };
}

describe("Selo DUB nos cards do catálogo e consistência de dados", () => {
  it("1. Identifica DUB quando anime possui pelo menos um episódio publicado dublado", () => {
    // 1a. Via título do episódio
    assert.equal(
      isAnimeDubbed({
        id: "a1",
        titles: { romaji: "Frieren", english: "Frieren", native: "" },
        hasEpisode: true,
        seasons: [
          {
            id: "s1",
            number: 1,
            title: "Temporada 1",
            episodes: [
              { id: "e1", number: 1, title: "Episódio 1 (Legendado)", published: true },
              { id: "e2", number: 2, title: "Episódio 2 (Dublado)", published: true },
            ],
          },
        ],
      }),
      true,
    );

    // 1b. Via campo explícito de áudio
    assert.equal(
      isAnimeDubbed({
        id: "a2",
        titles: { romaji: "Dandadan", english: "Dandadan", native: "" },
        hasEpisode: true,
        seasons: [
          {
            id: "s1",
            number: 1,
            title: "Temporada 1",
            episodes: [
              { id: "e1", number: 1, title: "Episódio 1", audio: "PT-BR DUB", published: true },
            ],
          },
        ],
      }),
      true,
    );

    // 1c. Via título da temporada
    assert.equal(
      isAnimeDubbed({
        id: "a3",
        titles: { romaji: "Solo Leveling", english: "Solo Leveling", native: "" },
        hasEpisode: true,
        seasons: [
          {
            id: "s1",
            number: 1,
            title: "1ª Temporada Dublada",
            episodes: [
              { id: "e1", number: 1, title: "Episódio 1", published: true },
            ],
          },
        ],
      }),
      true,
    );

    // 1d. Via SlimAnime vindo do servidor (hasEpisode=true e isDubbed=true)
    assert.equal(
      isAnimeDubbed(makeBaseSlim({ hasEpisode: true, isDubbed: true })),
      true,
    );
  });

  it("2. Não exibe DUB para anime somente legendado (mesmo com título sugerindo dublagem)", () => {
    // Anime comum somente legendado
    assert.equal(
      isAnimeDubbed({
        id: "sub-only",
        titles: { romaji: "Blue Lock", english: "Blue Lock", native: "" },
        hasEpisode: true,
        seasons: [
          {
            id: "s1",
            number: 1,
            title: "Temporada 1",
            episodes: [
              { id: "e1", number: 1, title: "Episódio 1", published: true },
              { id: "e2", number: 2, title: "Episódio 2 (Legendado)", published: true },
            ],
          },
        ],
      }),
      false,
    );

    // Título do anime diz Dublado, mas todos os episódios publicados são explicitamente Legendado
    assert.equal(
      isAnimeDubbed({
        id: "title-dub-ep-sub",
        titles: { romaji: "Naruto Dublado", english: "Naruto Dublado", native: "" },
        hasEpisode: true,
        seasons: [
          {
            id: "s1",
            number: 1,
            title: "Temporada 1",
            episodes: [
              { id: "e1", number: 1, title: "Episódio 1 (Legendado)", published: true },
            ],
          },
        ],
      }),
      false,
    );

    // SlimAnime vindo do servidor com hasEpisode=true e isDubbed=false
    assert.equal(
      isAnimeDubbed(
        makeBaseSlim({
          titles: { romaji: "Naruto Dublado", english: "Naruto Dublado", native: "" },
          hasEpisode: true,
          isDubbed: false,
        }),
      ),
      false,
    );
  });

  it("3. Não exibe DUB para anime sem episódios publicados (mesmo com título ou flag)", () => {
    // Sem temporadas/episódios
    assert.equal(
      isAnimeDubbed(
        makeBaseSlim({
          titles: { romaji: "Anime Dublado", english: "Anime Dublado", native: "" },
          hasEpisode: false,
          isDubbed: true,
        }),
      ),
      false,
    );

    // Apenas episódio em rascunho (published: false)
    assert.equal(
      isAnimeDubbed({
        id: "draft-only",
        titles: { romaji: "Anime Dublado", english: "Anime Dublado", native: "" },
        hasEpisode: false,
        isDubbed: true,
        seasons: [
          {
            id: "s1",
            number: 1,
            title: "Temporada 1 (Dublado)",
            episodes: [
              { id: "e1", number: 1, title: "Episódio 1 (Dublado)", published: false },
            ],
          },
        ],
      }),
      false,
    );
  });

  it("4. Expressão SQL reutilizada no PostgreSQL reflete exatamente isPublishedEpisodeDubbed", async () => {
    const db = new PGlite();
    try {
      await db.exec(`
        CREATE TABLE "catalog_anime" (
          "id" text PRIMARY KEY,
          "title" text NOT NULL,
          "titleRomaji" text,
          "titleEnglish" text,
          "titleNative" text
        );
        CREATE TABLE "catalog_season" (
          "animeId" text NOT NULL,
          "number" integer NOT NULL,
          "title" text
        );
        CREATE TABLE "catalog_episode" (
          "id" text PRIMARY KEY,
          "animeId" text NOT NULL,
          "seasonNumber" integer NOT NULL,
          "number" integer NOT NULL,
          "title" text,
          "published" boolean NOT NULL
        );

        INSERT INTO "catalog_anime" ("id", "title", "titleRomaji", "titleEnglish", "titleNative") VALUES
          ('ep-dub', 'Frieren', 'Sousou no Frieren', 'Frieren', NULL),
          ('season-dub', 'Dandadan', 'Dandadan', 'Dandadan', NULL),
          ('title-dub-ep-sub', 'Solo Leveling Dublado', 'Solo Leveling Dublado', NULL, NULL),
          ('sub-only', 'Blue Lock', 'Blue Lock', NULL, NULL),
          ('no-published', 'Naruto Dublado', 'Naruto Dublado', NULL, NULL);

        INSERT INTO "catalog_season" ("animeId", "number", "title") VALUES
          ('ep-dub', 1, 'Temporada 1'),
          ('season-dub', 1, '1ª Temporada (Dublado)'),
          ('title-dub-ep-sub', 1, 'Temporada 1'),
          ('sub-only', 1, 'Temporada 1'),
          ('no-published', 1, 'Temporada 1 (Dublado)');

        INSERT INTO "catalog_episode" ("id", "animeId", "seasonNumber", "number", "title", "published") VALUES
          ('e1', 'ep-dub', 1, 1, 'Episódio 1 (Legendado)', true),
          ('e2', 'ep-dub', 1, 2, 'Episódio 2 (Dublado)', true),
          ('e3', 'season-dub', 1, 1, 'Episódio 1', true),
          ('e4', 'title-dub-ep-sub', 1, 1, 'Episódio 1 (Legendado)', true),
          ('e5', 'sub-only', 1, 1, 'Episódio 1', true),
          ('e6', 'no-published', 1, 1, 'Episódio 1 (Dublado)', false);
      `);

      const result = await db.query<{
        id: string;
        hasEpisode: boolean;
        hasDubbedEpisode: boolean;
      }>(`
        SELECT
          a."id",
          EXISTS (
            SELECT 1 FROM "catalog_episode" e
            WHERE e."animeId" = a."id" AND e."published" = true
          ) AS "hasEpisode",
          EXISTS (
            SELECT 1
            FROM "catalog_episode" e
            LEFT JOIN "catalog_season" cs
              ON cs."animeId" = e."animeId" AND cs."number" = e."seasonNumber"
            WHERE e."animeId" = a."id"
              AND e."published" = true
              AND ${buildEpisodeDubbedSqlCondition("e", "cs", "a")}
          ) AS "hasDubbedEpisode"
        FROM "catalog_anime" a
        ORDER BY a."id" ASC;
      `);

      const byId = new Map(result.rows.map((r) => [r.id, r]));
      assert.deepEqual(byId.get("ep-dub"), { id: "ep-dub", hasEpisode: true, hasDubbedEpisode: true });
      assert.deepEqual(byId.get("season-dub"), { id: "season-dub", hasEpisode: true, hasDubbedEpisode: true });
      assert.deepEqual(byId.get("title-dub-ep-sub"), { id: "title-dub-ep-sub", hasEpisode: true, hasDubbedEpisode: false });
      assert.deepEqual(byId.get("sub-only"), { id: "sub-only", hasEpisode: true, hasDubbedEpisode: false });
      assert.deepEqual(byId.get("no-published"), { id: "no-published", hasEpisode: false, hasDubbedEpisode: false });
    } finally {
      await db.close();
    }
  });

  it("5. Pipelines de Home, Busca e Calendário propagam isDubbed corretamente sem consultas adicionais", () => {
    // 5a. Overlay de catálogo (Home shelves, Busca, Browse, Recomendações)
    const overlaidDub = mergeRowIntoSlim(
      makeBaseSlim(),
      makeBaseDbRow({ hasEpisode: true, hasDubbedEpisode: true }),
    );
    assert.equal(isAnimeDubbed(overlaidDub), true);

    const overlaidSub = mergeRowIntoSlim(
      makeBaseSlim(),
      makeBaseDbRow({
        title: "Anime Dublado",
        hasEpisode: true,
        hasDubbedEpisode: false,
      }),
    );
    assert.equal(isAnimeDubbed(overlaidSub), false);

    const overlaidNoEp = mergeRowIntoSlim(
      makeBaseSlim(),
      makeBaseDbRow({
        title: "Anime Dublado",
        hasEpisode: false,
        hasDubbedEpisode: true,
      }),
    );
    assert.equal(resolveCatalogRowIsDubbed(makeBaseDbRow({ title: "Anime Dublado", hasEpisode: false, hasDubbedEpisode: true })), false);
    assert.equal(isAnimeDubbed(overlaidNoEp), false);

    // 5b. Home Em Alta (scoreAndRankHomeTrending)
    const nowMs = Date.UTC(2026, 4, 15, 12, 0, 0);
    const trendingCandidates: TrendingCatalogAnimeCandidateRow[] = [
      {
        id: "1001",
        title: "Anime Em Alta Dublado por Ep",
        anilistId: 1001,
        malId: null,
        kitsuId: null,
        titleRomaji: "Anime Em Alta",
        titleEnglish: "Anime Em Alta",
        titleNative: null,
        cover: "https://cdn.example.com/1001.jpg",
        format: "TV",
        status: "RELEASING",
        episodesCount: 12,
        year: 2026,
        season: "SPRING",
        genres: ["Action"],
        hidden: false,
        score: 85,
        popularity: 50000,
        trending: 30,
        updatedAt: new Date(nowMs - 3600_000).toISOString(),
        publishedEpisodeCount: 3,
        hasDubbedEpisode: true,
        latestEpisodePublishedAt: new Date(nowMs - 3600_000).toISOString(),
        epSources: [{ videoUrl: "https://cdn.example.com/1001-1.mp4" }],
        hasTodayAiringSchedule: true,
      },
      {
        id: "1002",
        title: "Anime Em Alta Legendado",
        anilistId: 1002,
        malId: null,
        kitsuId: null,
        titleRomaji: "Anime Em Alta 2",
        titleEnglish: "Anime Em Alta 2",
        titleNative: null,
        cover: "https://cdn.example.com/1002.jpg",
        format: "TV",
        status: "RELEASING",
        episodesCount: 12,
        year: 2026,
        season: "SPRING",
        genres: ["Action"],
        hidden: false,
        score: 85,
        popularity: 50000,
        trending: 30,
        updatedAt: new Date(nowMs - 3600_000).toISOString(),
        publishedEpisodeCount: 3,
        hasDubbedEpisode: false,
        latestEpisodePublishedAt: new Date(nowMs - 3600_000).toISOString(),
        epSources: [{ videoUrl: "https://cdn.example.com/1002-1.mp4" }],
        hasTodayAiringSchedule: true,
      },
    ];
    const scoredTrending = scoreAndRankHomeTrending(
      trendingCandidates,
      emptyBadgesLookup(),
      [],
      nowMs,
    );
    const tDub = scoredTrending.find((s) => s.anime.id === "1001")!;
    const tSub = scoredTrending.find((s) => s.anime.id === "1002")!;
    assert.equal(isAnimeDubbed(tDub.anime), true);
    assert.equal(isAnimeDubbed(tSub.anime), false);

    // 5c. Episódios de Hoje (Home) e Calendário Semanal
    const todayKey = "2026-05-15";
    const airingEpoch = Math.floor(Date.UTC(2026, 4, 15, 16, 0, 0) / 1000);
    const todayRows: DbTodayScheduleRow[] = [
      {
        anilistId: 2001,
        animeId: "cal-dub",
        episode: 4,
        airingAtEpoch: airingEpoch,
        malId: null,
        kitsuId: null,
        title: "Calendário Dublado",
        titleRomaji: "Calendario Dublado",
        titleEnglish: "Calendario Dublado",
        titleNative: null,
        cover: "https://cdn.example.com/cal-dub.jpg",
        banner: null,
        synopsis: null,
        score: 80,
        genres: ["Action"],
        format: "TV",
        status: "RELEASING",
        episodesCount: 12,
        season: "SPRING",
        year: 2026,
        trailerId: null,
        updatedAt: null,
        hasEpisode: true,
        hasDubbedEpisode: true,
      },
      {
        anilistId: 2002,
        animeId: "cal-sub",
        episode: 4,
        airingAtEpoch: airingEpoch,
        malId: null,
        kitsuId: null,
        title: "Calendário Legendado",
        titleRomaji: "Calendario Legendado",
        titleEnglish: "Calendario Legendado",
        titleNative: null,
        cover: "https://cdn.example.com/cal-sub.jpg",
        banner: null,
        synopsis: null,
        score: 80,
        genres: ["Action"],
        format: "TV",
        status: "RELEASING",
        episodesCount: 12,
        season: "SPRING",
        year: 2026,
        trailerId: null,
        updatedAt: null,
        hasEpisode: true,
        hasDubbedEpisode: false,
      },
    ];
    const todaySlim = mapTodayScheduleRowsToSlimAnime(todayRows, todayKey, []);
    assert.equal(isAnimeDubbed(todaySlim.find((i) => i.id === "cal-dub")), true);
    assert.equal(isAnimeDubbed(todaySlim.find((i) => i.id === "cal-sub")), false);

    const weeklyRows: DbWeeklyScheduleRow[] = [
      {
        scheduleId: "ws-1",
        anilistId: 2001,
        animeId: "cal-dub",
        episode: 4,
        airingAtEpoch: airingEpoch,
        timeUntilAiring: 100,
        title: "Calendário Dublado",
        titleRomaji: "Calendario Dublado",
        titleEnglish: "Calendario Dublado",
        titleNative: null,
        cover: "https://cdn.example.com/cal-dub.jpg",
        banner: null,
        format: "TV",
        status: "RELEASING",
        genres: ["Action"],
        hasEpisode: true,
        hasDubbedEpisode: true,
      },
    ];
    const recurrenceRows: DbWeeklyRecurrenceJoinedRow[] = [
      {
        recurrenceId: "rec-1",
        animeId: "cal-no-ep",
        dayOfWeek: 5,
        timezone: "America/Sao_Paulo",
        active: true,
        createdAt: "",
        updatedAt: "",
        anilistId: 2003,
        malId: null,
        kitsuId: null,
        title: "Recorrente Sem Ep Dublado",
        titleRomaji: "Recorrente Sem Ep Dublado",
        titleEnglish: null,
        titleNative: null,
        cover: "https://cdn.example.com/rec.jpg",
        banner: null,
        synopsis: null,
        score: null,
        genres: ["Drama"],
        format: "TV",
        status: "RELEASING",
        episodesCount: null,
        season: null,
        year: null,
        trailerId: null,
        animeUpdatedAt: null,
        hasEpisode: false,
        hasDubbedEpisode: false,
      },
    ];
    const weeklyItems = mapWeeklyScheduleRowsAndRecurrences({
      scheduleRows: weeklyRows,
      recurrenceRows,
      weekDays: [{ dateKey: todayKey, index: 5 }],
    });
    const wDub = weeklyItems.find((w) => w.media.animeId === "cal-dub")!;
    const wNoEp = weeklyItems.find((w) => w.media.animeId === "cal-no-ep")!;
    assert.equal(
      isAnimeDubbed({
        id: wDub.media.animeId!,
        titles: wDub.media.title,
        hasEpisode: wDub.media.hasEpisode,
        isDubbed: wDub.media.isDubbed,
      }),
      true,
    );
    assert.equal(
      isAnimeDubbed({
        id: wNoEp.media.animeId!,
        titles: wNoEp.media.title,
        hasEpisode: wNoEp.media.hasEpisode,
        isDubbed: wNoEp.media.isDubbed,
      }),
      false,
    );

    // 5d. slimSnapshot e overlaySlim preservam hasEpisode e isDubbed (Minha Lista e store)
    const snapDub = slimSnapshot(makeBaseSlim({ hasEpisode: true, isDubbed: true }));
    assert.equal(snapDub.hasEpisode, true);
    assert.equal(snapDub.isDubbed, true);
    assert.equal(isAnimeDubbed(snapDub), true);

    const localMetaOnly: LocalAnime = {
      id: "anime-base",
      anilistId: 154587,
      titleRomaji: "Frieren",
      titleEnglish: "Frieren",
      titleNative: "",
      cover: "https://cdn.example.com/cover.jpg",
      banner: "",
      synopsis: "",
      score: 90,
      genres: ["Adventure"],
      format: "TV",
      status: "FINISHED",
      episodesCount: 28,
      season: "FALL",
      year: 2023,
      trailerId: null,
      hidden: false,
      seasons: [],
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
    };
    const [merged] = overlaySlim(
      [makeBaseSlim({ id: "anime-base", anilistId: 154587, hasEpisode: true, isDubbed: true })],
      [localMetaOnly],
      localToAnime,
      { includeExtras: false },
    );
    assert.equal(isAnimeDubbed(merged), true);
  });

  it("6. Preserva integralmente a detecção existente de DUB em Episódios Recentes", () => {
    assert.equal(
      isPublishedEpisodeDubbed({
        animeTitle: "Frieren",
        animeAltTitles: [],
        seasonTitle: "Temporada 1",
        episodeTitle: "Episódio 1 (Dublado)",
      }),
      true,
    );
    assert.equal(
      isPublishedEpisodeDubbed({
        animeTitle: "Frieren Dublado",
        animeAltTitles: [],
        seasonTitle: "Temporada 1",
        episodeTitle: "Episódio 1 (Legendado)",
      }),
      false,
    );
  });

  it("7. Renderização de AnimeCard e EpisodeCard exibe selo DUB apenas quando há episódio dublado", async () => {
    const renderWithRouter = async (node: React.ReactElement) => {
      const rootRoute = createRootRoute({
        component: () => node,
      });
      const router = createRouter({
        routeTree: rootRoute,
        history: createMemoryHistory({ initialEntries: ["/"] }),
      });
      await router.load();
      return renderToStaticMarkup(React.createElement(RouterProvider, { router }));
    };

    const dubCardHtml = await renderWithRouter(
      React.createElement(AnimeCard, {
        anime: makeBaseSlim({
          id: "render-dub",
          hasEpisode: true,
          isDubbed: true,
        }),
      }),
    );
    assert.match(dubCardHtml, /data-badge="dub"[^>]*>DUB</);

    const subCardHtml = await renderWithRouter(
      React.createElement(AnimeCard, {
        anime: makeBaseSlim({
          id: "render-sub",
          titles: { romaji: "Naruto Dublado", english: "Naruto Dublado", native: "" },
          hasEpisode: true,
          isDubbed: false,
        }),
      }),
    );
    assert.doesNotMatch(subCardHtml, /data-badge="dub"/);

    const noEpCardHtml = await renderWithRouter(
      React.createElement(AnimeCard, {
        anime: makeBaseSlim({
          id: "render-no-ep",
          titles: { romaji: "Naruto Dublado", english: "Naruto Dublado", native: "" },
          hasEpisode: false,
          isDubbed: true,
        }),
      }),
    );
    assert.doesNotMatch(noEpCardHtml, /data-badge="dub"/);

    const recentDubEpHtml = await renderWithRouter(
      React.createElement(EpisodeCard, {
        episode: {
          animeId: "ep-card-dub",
          animeTitle: "Frieren",
          animeCover: "https://cdn.example.com/c.jpg",
          seasonId: "s-1",
          seasonNumber: 1,
          seasonTitle: "Temporada 1",
          episodeId: "ep-1",
          episodeNumber: 1,
          episodeTitle: "Episódio 1 (Dublado)",
          publishedAt: 1700000000000,
          published: true,
        },
      }),
    );
    assert.match(recentDubEpHtml, /data-badge="dub"[^>]*>DUB</);

    const recentSubEpHtml = await renderWithRouter(
      React.createElement(EpisodeCard, {
        episode: {
          animeId: "ep-card-sub",
          animeTitle: "Frieren Dublado",
          animeCover: "https://cdn.example.com/c.jpg",
          seasonId: "s-1",
          seasonNumber: 1,
          seasonTitle: "Temporada 1",
          episodeId: "ep-2",
          episodeNumber: 2,
          episodeTitle: "Episódio 2 (Legendado)",
          publishedAt: 1700000000000,
          published: true,
        },
      }),
    );
    assert.doesNotMatch(recentSubEpHtml, /data-badge="dub"/);
  });
});
