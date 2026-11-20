import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { getSql } from "./db";
import {
  episodePostSchema,
  persistEpisode,
  resolveOpeningTimestampsPatch,
} from "./episode-writer";
import {
  buildResolvedSeasons,
  catalogItemToEpisode,
  executeGetCatalogEpisodes,
  executeGetPaginatedPublicCatalogEpisodes,
  executeGetPublicCatalogEpisodes,
  invalidateCatalogEpisodesCacheAsync,
  invalidatePublicCatalogEpisodesCache,
  mergeAdminEpisodesWithServer,
} from "./catalog-episodes";
import {
  mergeSeasonsWithRemoteForAdmin,
  resolveAdminAnimeWithRemote,
} from "./overlay";
import type { Anime, Episode } from "./types";

const UPSERT_SQL = `
  INSERT INTO "catalog_episode" (
    "id", "animeId", "seasonNumber", "number",
    "title", "thumbnail", "duration", "synopsis",
    "videoUrl", "videoUrl2", "videoUrl3", "videoUrl4", "videoUrl5",
    "hikari_player_episode_id",
    "opening_start_seconds", "opening_end_seconds",
    "published", "publishedAt", "createdAt", "updatedAt"
  )
  VALUES (
    $1, $2, $3, $4,
    $5, $6, $7, $8,
    $9, $10, $11, $12, $13,
    $17,
    $19, $20,
    $14,
    CASE WHEN $14 = true THEN CURRENT_TIMESTAMP ELSE NULL END,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
  ON CONFLICT ("animeId", "seasonNumber", "number") DO UPDATE
  SET
    "title" = EXCLUDED."title",
    "thumbnail" = CASE
      WHEN $16 = true THEN EXCLUDED."thumbnail"
      ELSE COALESCE(NULLIF(EXCLUDED."thumbnail", ''), "catalog_episode"."thumbnail")
    END,
    "duration" = COALESCE(NULLIF(EXCLUDED."duration", ''), "catalog_episode"."duration"),
    "synopsis" = COALESCE(NULLIF(EXCLUDED."synopsis", ''), "catalog_episode"."synopsis"),
    "videoUrl" = CASE
      WHEN $15 = true THEN EXCLUDED."videoUrl"
      ELSE COALESCE(NULLIF(EXCLUDED."videoUrl", ''), "catalog_episode"."videoUrl")
    END,
    "videoUrl2" = CASE
      WHEN $15 = true THEN EXCLUDED."videoUrl2"
      ELSE COALESCE(NULLIF(EXCLUDED."videoUrl2", ''), "catalog_episode"."videoUrl2")
    END,
    "videoUrl3" = CASE
      WHEN $15 = true THEN EXCLUDED."videoUrl3"
      ELSE COALESCE(NULLIF(EXCLUDED."videoUrl3", ''), "catalog_episode"."videoUrl3")
    END,
    "videoUrl4" = CASE
      WHEN $15 = true THEN EXCLUDED."videoUrl4"
      ELSE COALESCE(NULLIF(EXCLUDED."videoUrl4", ''), "catalog_episode"."videoUrl4")
    END,
    "videoUrl5" = CASE
      WHEN $15 = true THEN EXCLUDED."videoUrl5"
      ELSE COALESCE(NULLIF(EXCLUDED."videoUrl5", ''), "catalog_episode"."videoUrl5")
    END,
    "hikari_player_episode_id" = CASE
      WHEN $18 = true THEN EXCLUDED."hikari_player_episode_id"
      ELSE "catalog_episode"."hikari_player_episode_id"
    END,
    "opening_start_seconds" = CASE
      WHEN $21 = true THEN EXCLUDED."opening_start_seconds"
      ELSE "catalog_episode"."opening_start_seconds"
    END,
    "opening_end_seconds" = CASE
      WHEN $22 = true THEN EXCLUDED."opening_end_seconds"
      ELSE "catalog_episode"."opening_end_seconds"
    END,
    "published" = EXCLUDED."published",
    "publishedAt" = CASE
      WHEN EXCLUDED."published" = true AND "catalog_episode"."publishedAt" IS NULL THEN CURRENT_TIMESTAMP
      WHEN EXCLUDED."published" = false THEN NULL
      ELSE "catalog_episode"."publishedAt"
    END,
    "updatedAt" = CURRENT_TIMESTAMP
  RETURNING "id", "published", "publishedAt", "hikari_player_episode_id" AS "hikariPlayerEpisodeId", "opening_start_seconds" AS "openingStartSeconds", "opening_end_seconds" AS "openingEndSeconds";
`;

describe("Opening timestamps — validação de schema, transporte em payload e persistência no PostgreSQL (PGLite)", () => {
  const animeId = "anime-opening-persistence-test";

  before(async () => {
    const sql = await getSql();
    await sql.query(`DELETE FROM "catalog_episode" WHERE "animeId" = $1;`, [animeId]);
    await sql.query(`DELETE FROM "catalog_season" WHERE "animeId" = $1;`, [animeId]);
    await sql.query(`DELETE FROM "catalog_anime" WHERE "id" = $1;`, [animeId]);

    await sql.query(
      `INSERT INTO "catalog_anime" ("id", "title", "anilistId") VALUES ($1, $2, $3);`,
      [animeId, "Anime Teste Opening", 776655],
    );
    await sql.query(
      `INSERT INTO "catalog_season" ("animeId", "number", "title", "position") VALUES ($1, 1, 'Temporada 1', 0);`,
      [animeId],
    );
  });

  it("0. Migration 0043 criou opening_start_seconds e opening_end_seconds como INTEGER NULL", async () => {
    const sql = await getSql();
    const cols = await sql.query<{
      column_name: string;
      data_type: string;
      is_nullable: string;
    }>(
      `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
       WHERE table_name = 'catalog_episode'
         AND column_name IN ('opening_start_seconds', 'opening_end_seconds')
       ORDER BY column_name ASC;`,
    );

    assert.equal(cols.length, 2);
    assert.deepEqual(cols, [
      {
        column_name: "opening_end_seconds",
        data_type: "integer",
        is_nullable: "YES",
      },
      {
        column_name: "opening_start_seconds",
        data_type: "integer",
        is_nullable: "YES",
      },
    ]);
  });

  it("1 e 3. Inserção de episódio com openingStartSeconds (incluindo 0) e openingEndSeconds e recuperação do banco", async () => {
    const sql = await getSql();
    const epId = "ep-op-1";

    const rows = await sql.query<{
      id: string;
      openingStartSeconds: number | null;
      openingEndSeconds: number | null;
    }>(UPSERT_SQL, [
      epId,
      animeId,
      1,
      1,
      "Episódio 1 — Opening em 00:00",
      "https://cdn.hikari.test/thumb1.jpg",
      "24m",
      "Sinopse ep 1",
      "https://cdn.hikari.test/ep1-p1.m3u8",
      "https://cdn.hikari.test/ep1-p2.m3u8",
      null,
      null,
      null,
      true,
      true,
      false,
      null,
      false,
      0,
      90,
      true,
      true,
    ]);

    assert.equal(rows[0]?.id, epId);
    assert.equal(rows[0]?.openingStartSeconds, 0);
    assert.equal(rows[0]?.openingEndSeconds, 90);

    await invalidateCatalogEpisodesCacheAsync(animeId, "776655");
    invalidatePublicCatalogEpisodesCache();

    const adminCatalog = await executeGetCatalogEpisodes(animeId, {
      includeUnpublished: true,
    });
    const dbItem = adminCatalog.episodes.find((e) => e.id === epId);
    assert.ok(dbItem);
    assert.equal(dbItem.openingStartSeconds, 0);
    assert.equal(dbItem.openingEndSeconds, 90);

    const mapped = catalogItemToEpisode(dbItem);
    assert.equal(mapped.openingStartSeconds, 0);
    assert.equal(mapped.openingEndSeconds, 90);

    const resolvedSeasons = buildResolvedSeasons(animeId, adminCatalog, []);
    assert.equal(resolvedSeasons[0]?.episodes[0]?.openingStartSeconds, 0);
    assert.equal(resolvedSeasons[0]?.episodes[0]?.openingEndSeconds, 90);

    const publicAll = await executeGetPublicCatalogEpisodes();
    const publicItem = publicAll.episodes.find((e) => e.id === epId);
    assert.equal(publicItem?.openingStartSeconds, 0);
    assert.equal(publicItem?.openingEndSeconds, 90);

    const publicPaginated = await executeGetPaginatedPublicCatalogEpisodes({
      animeId,
    });
    const paginatedItem = publicPaginated.episodes.find((e) => e.id === epId);
    assert.equal(paginatedItem?.openingStartSeconds, 0);
    assert.equal(paginatedItem?.openingEndSeconds, 90);
  });

  it("2 e 9. Atualização de episódio com novos timestamps preserva todas as fontes de vídeo existentes", async () => {
    const sql = await getSql();
    const epId = "ep-op-2";

    await sql.query(UPSERT_SQL, [
      epId,
      animeId,
      1,
      2,
      "Episódio 2 — Original",
      null,
      "24m",
      null,
      "https://cdn.hikari.test/ep2-p1.m3u8",
      "https://cdn.hikari.test/ep2-p2.m3u8",
      "https://cdn.hikari.test/ep2-p3.m3u8",
      "https://cdn.hikari.test/ep2-p4.m3u8",
      "https://cdn.hikari.test/ep2-p5.m3u8",
      true,
      true,
      false,
      null,
      false,
      45,
      135,
      true,
      true,
    ]);

    // Atualiza apenas os timestamps mantendo replaceSources = false
    const updated = await sql.query<{
      openingStartSeconds: number | null;
      openingEndSeconds: number | null;
    }>(UPSERT_SQL, [
      epId,
      animeId,
      1,
      2,
      "Episódio 2 — Original",
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      true,
      false, // replaceSources = false
      false,
      null,
      false,
      85,
      175,
      true,
      true,
    ]);

    assert.equal(updated[0]?.openingStartSeconds, 85);
    assert.equal(updated[0]?.openingEndSeconds, 175);

    await invalidateCatalogEpisodesCacheAsync(animeId);
    const catalog = await executeGetCatalogEpisodes(animeId, {
      includeUnpublished: true,
    });
    const ep2 = catalog.episodes.find((e) => e.id === epId);
    assert.ok(ep2);
    assert.equal(ep2.openingStartSeconds, 85);
    assert.equal(ep2.openingEndSeconds, 175);
    assert.equal(ep2.videoUrl, "https://cdn.hikari.test/ep2-p1.m3u8");
    assert.equal(ep2.videoUrl2, "https://cdn.hikari.test/ep2-p2.m3u8");
    assert.equal(ep2.videoUrl3, "https://cdn.hikari.test/ep2-p3.m3u8");
    assert.equal(ep2.videoUrl4, "https://cdn.hikari.test/ep2-p4.m3u8");
    assert.equal(ep2.videoUrl5, "https://cdn.hikari.test/ep2-p5.m3u8");
  });

  it("4. Valores NULL funcionam na inserção, na limpeza explícita e não são ressuscitados no merge", async () => {
    const sql = await getSql();
    const epId = "ep-op-null";

    // Inserção inicial com NULL
    const inserted = await sql.query<{
      openingStartSeconds: number | null;
      openingEndSeconds: number | null;
    }>(UPSERT_SQL, [
      epId,
      animeId,
      1,
      3,
      "Episódio 3 — Sem Opening",
      null,
      null,
      null,
      "https://cdn.hikari.test/ep3.m3u8",
      null,
      null,
      null,
      null,
      true,
      true,
      false,
      null,
      false,
      null,
      null,
      true,
      true,
    ]);
    assert.equal(inserted[0]?.openingStartSeconds, null);
    assert.equal(inserted[0]?.openingEndSeconds, null);

    // Define timestamps e depois limpa explicitamente para NULL ($21=true, $22=true)
    await sql.query(UPSERT_SQL, [
      epId,
      animeId,
      1,
      3,
      "Episódio 3 — Sem Opening",
      null,
      null,
      null,
      "https://cdn.hikari.test/ep3.m3u8",
      null,
      null,
      null,
      null,
      true,
      false,
      false,
      null,
      false,
      60,
      150,
      true,
      true,
    ]);

    const cleared = await sql.query<{
      openingStartSeconds: number | null;
      openingEndSeconds: number | null;
    }>(UPSERT_SQL, [
      epId,
      animeId,
      1,
      3,
      "Episódio 3 — Sem Opening",
      null,
      null,
      null,
      "https://cdn.hikari.test/ep3.m3u8",
      null,
      null,
      null,
      null,
      true,
      false,
      false,
      null,
      false,
      null,
      null,
      true,
      true,
    ]);
    assert.equal(cleared[0]?.openingStartSeconds, null);
    assert.equal(cleared[0]?.openingEndSeconds, null);

    await invalidateCatalogEpisodesCacheAsync(animeId);
    const catalog = await executeGetCatalogEpisodes(animeId, {
      includeUnpublished: true,
    });
    const staleLocal = [
      {
        id: "s-1",
        number: 1,
        title: "Temporada 1",
        episodes: [
          {
            id: epId,
            number: 3,
            title: "Local Stale",
            openingStartSeconds: 60,
            openingEndSeconds: 150,
            published: true,
          },
        ],
      },
    ];

    const resolved = buildResolvedSeasons(animeId, catalog, staleLocal);
    const resolvedEp3 = resolved[0]?.episodes.find((e) => e.id === epId);
    assert.equal(resolvedEp3?.openingStartSeconds, null);
    assert.equal(resolvedEp3?.openingEndSeconds, null);

    const adminMerged = mergeAdminEpisodesWithServer({
      animeId,
      localSeasons: staleLocal,
      serverResult: catalog,
    });
    const mergedEp3 = adminMerged.seasons[0]?.episodes.find((e) => e.id === epId);
    assert.equal(mergedEp3?.openingStartSeconds, null);
    assert.equal(mergedEp3?.openingEndSeconds, null);
  });

  it("5 e 8. Payloads antigos sem timestamps e edição de outros campos preservam timestamps existentes no banco", async () => {
    const sql = await getSql();
    const epId = "ep-op-2";

    // Payload antigo omitindo openingStartSeconds e openingEndSeconds
    const legacyParsed = episodePostSchema.safeParse({
      id: epId,
      animeId,
      seasonNumber: 1,
      number: 2,
      title: "Episódio 2 — Título Editado",
      synopsis: "Nova sinopse editada sem tocar na opening",
      duration: "25m",
      published: false,
    });
    assert.equal(legacyParsed.success, true);
    assert.equal(legacyParsed.data.openingStartSeconds, undefined);
    assert.equal(legacyParsed.data.openingEndSeconds, undefined);

    const patch = resolveOpeningTimestampsPatch(
      {
        openingStartSeconds: legacyParsed.data.openingStartSeconds,
        openingEndSeconds: legacyParsed.data.openingEndSeconds,
      },
      { openingStartSeconds: 85, openingEndSeconds: 175 },
    );
    assert.equal(patch.valid, true);
    if (!patch.valid) return;
    assert.equal(patch.hasOpeningStartField, false);
    assert.equal(patch.hasOpeningEndField, false);
    assert.equal(patch.openingStartSeconds, 85);
    assert.equal(patch.openingEndSeconds, 175);

    const rows = await sql.query<{
      openingStartSeconds: number | null;
      openingEndSeconds: number | null;
    }>(UPSERT_SQL, [
      epId,
      animeId,
      1,
      2,
      "Episódio 2 — Título Editado",
      null,
      "25m",
      "Nova sinopse editada sem tocar na opening",
      null,
      null,
      null,
      null,
      null,
      false,
      false,
      false,
      null,
      false,
      patch.openingStartSeconds,
      patch.openingEndSeconds,
      patch.hasOpeningStartField,
      patch.hasOpeningEndField,
    ]);
    assert.equal(rows[0]?.openingStartSeconds, 85);
    assert.equal(rows[0]?.openingEndSeconds, 175);

    await invalidateCatalogEpisodesCacheAsync(animeId);
    const reloaded = await executeGetCatalogEpisodes(animeId, {
      includeUnpublished: true,
    });
    const ep2 = reloaded.episodes.find((e) => e.id === epId);
    assert.equal(ep2?.title, "Episódio 2 — Título Editado");
    assert.equal(ep2?.duration, "25m");
    assert.equal(ep2?.synopsis, "Nova sinopse editada sem tocar na opening");
    assert.equal(ep2?.openingStartSeconds, 85);
    assert.equal(ep2?.openingEndSeconds, 175);
    assert.equal(ep2?.videoUrl, "https://cdn.hikari.test/ep2-p1.m3u8");
  });

  it("6. Rejeita valores negativos no schema Zod e na validação do patch", () => {
    const negStart = episodePostSchema.safeParse({
      id: "ep-neg-1",
      animeId,
      seasonNumber: 1,
      number: 1,
      openingStartSeconds: -1,
      openingEndSeconds: 90,
    });
    assert.equal(negStart.success, false);

    const negEnd = episodePostSchema.safeParse({
      id: "ep-neg-2",
      animeId,
      seasonNumber: 1,
      number: 1,
      openingStartSeconds: 10,
      openingEndSeconds: -5,
    });
    assert.equal(negEnd.success, false);

    const patchNeg = resolveOpeningTimestampsPatch(
      { openingStartSeconds: -2 },
      { openingStartSeconds: 10, openingEndSeconds: 90 },
    );
    assert.equal(patchNeg.valid, false);
  });

  it("7. Rejeita openingEndSeconds menor ou igual a openingStartSeconds (inclusive em atualização parcial)", () => {
    const equalValues = episodePostSchema.safeParse({
      id: "ep-eq",
      animeId,
      seasonNumber: 1,
      number: 1,
      openingStartSeconds: 90,
      openingEndSeconds: 90,
    });
    assert.equal(equalValues.success, false);

    const endBeforeStart = episodePostSchema.safeParse({
      id: "ep-inv",
      animeId,
      seasonNumber: 1,
      number: 1,
      openingStartSeconds: 120,
      openingEndSeconds: 60,
    });
    assert.equal(endBeforeStart.success, false);

    // Atualização parcial enviando apenas openingStartSeconds >= openingEndSeconds existente
    const partialInvalid = resolveOpeningTimestampsPatch(
      { openingStartSeconds: 175 },
      { openingStartSeconds: 85, openingEndSeconds: 175 },
    );
    assert.equal(partialInvalid.valid, false);

    const partialSmaller = resolveOpeningTimestampsPatch(
      { openingEndSeconds: 85 },
      { openingStartSeconds: 85, openingEndSeconds: 175 },
    );
    assert.equal(partialSmaller.valid, false);
  });

  it("Transporte via persistEpisode() envia openingStartSeconds/openingEndSeconds (incluindo 0 e null), omite quando undefined e lê resposta", async () => {
    const originalFetch = globalThis.fetch;
    const capturedPayloads: Array<Record<string, unknown>> = [];

    globalThis.fetch = (async (_input: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}"));
      capturedPayloads.push(body);
      return Response.json({
        ok: true,
        episodeId: body.id,
        published: Boolean(body.published),
        publishedAt: null,
        openingStartSeconds: body.openingStartSeconds ?? null,
        openingEndSeconds: body.openingEndSeconds ?? null,
      });
    }) as typeof fetch;

    try {
      const epWithZero: Episode = {
        id: "ep-client-1",
        number: 1,
        title: "Ep 1",
        videoUrl: "https://cdn.hikari.test/ep1.m3u8",
        openingStartSeconds: 0,
        openingEndSeconds: 90,
        published: true,
      };
      const res1 = await persistEpisode(animeId, 1, epWithZero, "Anime Teste");
      assert.equal(res1.confirmed, true);
      assert.equal(res1.openingStartSeconds, 0);
      assert.equal(res1.openingEndSeconds, 90);
      assert.equal(capturedPayloads[0]?.openingStartSeconds, 0);
      assert.equal(capturedPayloads[0]?.openingEndSeconds, 90);

      const epCleared: Episode = {
        id: "ep-client-2",
        number: 2,
        title: "Ep 2",
        openingStartSeconds: null,
        openingEndSeconds: null,
        published: false,
      };
      const res2 = await persistEpisode(animeId, 1, epCleared, "Anime Teste");
      assert.equal(res2.confirmed, true);
      assert.equal(res2.openingStartSeconds, null);
      assert.equal(res2.openingEndSeconds, null);
      assert.equal("openingStartSeconds" in capturedPayloads[1], true);
      assert.equal(capturedPayloads[1]?.openingStartSeconds, null);
      assert.equal(capturedPayloads[1]?.openingEndSeconds, null);

      const epLegacy: Episode = {
        id: "ep-client-3",
        number: 3,
        title: "Ep 3",
        published: false,
      };
      await persistEpisode(animeId, 1, epLegacy, "Anime Teste");
      assert.equal("openingStartSeconds" in capturedPayloads[2], false);
      assert.equal("openingEndSeconds" in capturedPayloads[2], false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("Overlay do Admin (mergeSeasonsWithRemoteForAdmin / resolveAdminAnimeWithRemote) preserva timestamps ao reabrir o anime", () => {
    const remoteAnime: Anime = {
      id: animeId,
      titles: { romaji: "Anime Teste Opening", english: "Anime Teste Opening", native: "" },
      cover: "https://cdn.hikari.test/cover.jpg",
      banner: "https://cdn.hikari.test/banner.jpg",
      synopsis: "",
      score: null,
      genres: [],
      format: "TV",
      status: "FINISHED",
      episodesCount: 2,
      season: null,
      year: null,
      trailerId: null,
      source: "local",
      studios: [],
      streamingEpisodes: [],
      seasons: [
        {
          id: "s-1",
          number: 1,
          title: "Temporada 1",
          episodes: [
            {
              id: "ep-op-1",
              number: 1,
              title: "Ep 1",
              videoUrl: "https://cdn.hikari.test/ep1.m3u8",
              openingStartSeconds: 0,
              openingEndSeconds: 90,
              published: true,
            },
            {
              id: "ep-op-2",
              number: 2,
              title: "Ep 2",
              videoUrl: "https://cdn.hikari.test/ep2.m3u8",
              openingStartSeconds: 85,
              openingEndSeconds: 175,
              published: true,
            },
          ],
        },
      ],
      recommendations: [],
      characters: [],
      staff: [],
      serverCatalogId: animeId,
    };

    // Reabertura sem cache local no IndexedDB
    const reopenedFresh = resolveAdminAnimeWithRemote(undefined, remoteAnime);
    assert.equal(reopenedFresh?.seasons[0]?.episodes[0]?.openingStartSeconds, 0);
    assert.equal(reopenedFresh?.seasons[0]?.episodes[0]?.openingEndSeconds, 90);
    assert.equal(reopenedFresh?.seasons[0]?.episodes[1]?.openingStartSeconds, 85);
    assert.equal(reopenedFresh?.seasons[0]?.episodes[1]?.openingEndSeconds, 175);

    // Reabertura com episódio local antigo sem os campos definidos
    const mergedWithLegacyLocal = mergeSeasonsWithRemoteForAdmin(
      [
        {
          id: "s-1",
          number: 1,
          title: "Temporada 1",
          episodes: [
            {
              id: "ep-op-2",
              number: 2,
              title: "Ep 2",
              videoUrl: "https://cdn.hikari.test/ep2.m3u8",
              published: true,
            },
          ],
        },
      ],
      remoteAnime.seasons,
    );
    assert.equal(mergedWithLegacyLocal[0]?.episodes[0]?.openingStartSeconds, 0);
    assert.equal(mergedWithLegacyLocal[0]?.episodes[0]?.openingEndSeconds, 90);
    assert.equal(mergedWithLegacyLocal[0]?.episodes[1]?.openingStartSeconds, 85);
    assert.equal(mergedWithLegacyLocal[0]?.episodes[1]?.openingEndSeconds, 175);
  });
});
