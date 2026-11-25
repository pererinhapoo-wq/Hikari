import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import {
  buildHikariPlayerEpisodeUrl,
  HIKARI_PLAYER_EPISODE_ID_MAX_LENGTH,
  HIKARI_PLAYER_ORIGIN,
  normalizeHikariPlayerEpisodeId,
  validateHikariPlayerEpisodeId,
} from "./hikari-player";
import { getSql } from "./db";
import {
  buildResolvedSeasons,
  catalogItemToEpisode,
  executeGetCatalogEpisodes,
  executeGetPaginatedPublicCatalogEpisodes,
  executeGetPublicCatalogAnimeOptions,
  executeGetPublicCatalogEpisodes,
  invalidateCatalogEpisodesCacheAsync,
  mergeAdminEpisodesWithServer,
} from "./catalog-episodes";
import {
  executeGetHomePublicEpisodes,
  invalidateHomePublicEpisodesCache,
} from "./home-episodes";
import {
  getAllPublishedEpisodes,
  getRecentEpisodesSection,
  hasEpisodePlayableSource,
  isEpisodePublished,
  resolvePublicEpisodes,
  resolvePublicRecentEpisodes,
  selectEpisodeForWatch,
} from "./published-episodes";
import { sanitizeRemoteEpisodeForAdmin } from "./overlay";
import { persistEpisode } from "./episode-writer";
import { buildAdminCatalogIndex } from "./admin-catalog-index";

describe("hikari-player — validação, normalização e construção de URL", () => {
  it("1. Normaliza espaços e trata vazio/null/undefined como ausência de associação", () => {
    assert.equal(normalizeHikariPlayerEpisodeId(undefined), null);
    assert.equal(normalizeHikariPlayerEpisodeId(null), null);
    assert.equal(normalizeHikariPlayerEpisodeId(""), null);
    assert.equal(normalizeHikariPlayerEpisodeId("   \t\n "), null);
    assert.equal(normalizeHikariPlayerEpisodeId("  abc123  "), "abc123");
  });

  it("2. Aceita IDs válidos e rejeita ausência sem bloquear", () => {
    assert.deepEqual(validateHikariPlayerEpisodeId(undefined), {
      valid: true,
      value: null,
    });
    assert.deepEqual(validateHikariPlayerEpisodeId(null), {
      valid: true,
      value: null,
    });
    assert.deepEqual(validateHikariPlayerEpisodeId("   "), {
      valid: true,
      value: null,
    });
    assert.deepEqual(validateHikariPlayerEpisodeId("  ep_abc-123.v1  "), {
      valid: true,
      value: "ep_abc-123.v1",
    });
  });

  it("3. Rejeita URLs completas, domínios, caminhos, query strings, espaços e traversal", () => {
    const invalidInputs = [
      "https://hikari-player-2.vercel.app/e/abc123",
      "http://hikari-player-2.vercel.app/e/abc123",
      "//hikari-player-2.vercel.app/e/abc123",
      "hikari-player-2.vercel.app/e/abc123",
      "hikari-player-2.vercel.app",
      "/e/abc123",
      "e/abc123",
      "abc123?autoplay=1",
      "abc123#player",
      "javascript:alert(1)",
      "../abc123",
      "..",
      ".",
      "abc 123",
      "abc$123",
      "a".repeat(HIKARI_PLAYER_EPISODE_ID_MAX_LENGTH + 1),
    ];

    for (const input of invalidInputs) {
      const res = validateHikariPlayerEpisodeId(input);
      assert.equal(res.valid, false, `Input deveria ser rejeitado: ${input}`);
      assert.equal(res.value, null);
      assert.ok(res.error && res.error.length > 0);
      assert.equal(buildHikariPlayerEpisodeUrl(input), null);
    }
  });

  it("4. Constrói URL somente com a origem fixa do Hikari Player", () => {
    assert.equal(buildHikariPlayerEpisodeUrl(null), null);
    assert.equal(buildHikariPlayerEpisodeUrl(""), null);
    assert.equal(
      buildHikariPlayerEpisodeUrl("  abc123  "),
      `${HIKARI_PLAYER_ORIGIN}/e/abc123`,
    );
    assert.equal(
      buildHikariPlayerEpisodeUrl("ep_99-sub"),
      "https://hikari-player-2.vercel.app/e/ep_99-sub",
    );
  });
});

describe("hikari-player — persistência, recuperação e remoção no PostgreSQL (PGLite)", () => {
  const animeId = "local-hikari-player-assoc-test";
  const aliasAnilistId = 987654;

  before(async () => {
    const sql = await getSql();
    await sql.query(`DELETE FROM "catalog_episode" WHERE "animeId" = $1;`, [animeId]);
    await sql.query(`DELETE FROM "catalog_season" WHERE "animeId" = $1;`, [animeId]);
    await sql.query(`DELETE FROM "catalog_anime" WHERE "id" = $1;`, [animeId]);

    await sql.query(
      `INSERT INTO "catalog_anime" ("id", "title", "anilistId") VALUES ($1, $2, $3);`,
      [animeId, "Anime Teste Associação", aliasAnilistId],
    );
    await sql.query(
      `INSERT INTO "catalog_season" ("animeId", "number", "title", "position") VALUES ($1, 1, 'Temporada 1', 0);`,
      [animeId],
    );
  });

  it("5. Coluna hikari_player_episode_id existe como TEXT NULL e permite cadastro sem associação", async () => {
    const sql = await getSql();
    const colRows = await sql.query<{ data_type: string; is_nullable: string }>(
      `SELECT data_type, is_nullable
       FROM information_schema.columns
       WHERE table_name = 'catalog_episode' AND column_name = 'hikari_player_episode_id';`,
    );
    assert.equal(colRows.length, 1);
    assert.equal(colRows[0].data_type, "text");
    assert.equal(colRows[0].is_nullable, "YES");

    await sql.query(
      `INSERT INTO "catalog_episode" (
         "id", "animeId", "seasonNumber", "number", "title",
         "videoUrl", "published", "publishedAt"
       ) VALUES ($1, $2, 1, 1, 'Episódio Sem Associação', $3, true, CURRENT_TIMESTAMP);`,
      ["ep-no-assoc-1", animeId, "https://cdn.hikari.test/ep1.m3u8"],
    );

    await invalidateCatalogEpisodesCacheAsync(animeId, String(aliasAnilistId));
    const catalog = await executeGetCatalogEpisodes(animeId, { includeUnpublished: true });
    assert.equal(catalog.episodes.length, 1);
    assert.equal(catalog.episodes[0].id, "ep-no-assoc-1");
    assert.equal(catalog.episodes[0].hikariPlayerEpisodeId, null);
    assert.equal(catalog.episodes[0].videoUrl, "https://cdn.hikari.test/ep1.m3u8");

    const mapped = catalogItemToEpisode(catalog.episodes[0]);
    assert.equal(mapped.hikariPlayerEpisodeId, undefined);
  });

  it("6. Salva, recupera por alias, preserva fontes de vídeo e permite editar e remover associação", async () => {
    const sql = await getSql();
    const epId = "ep-with-assoc-2";
    const initialValidation = validateHikariPlayerEpisodeId("  hp_ep_abc123  ");
    assert.equal(initialValidation.valid, true);

    // Inserção com associação preenchida e duas fontes de vídeo existentes
    await sql.query(
      `INSERT INTO "catalog_episode" (
         "id", "animeId", "seasonNumber", "number", "title",
         "videoUrl", "videoUrl2", "hikari_player_episode_id", "published", "publishedAt"
       ) VALUES ($1, $2, 1, 2, 'Episódio Associado', $3, $4, $5, true, CURRENT_TIMESTAMP);`,
      [
        epId,
        animeId,
        "https://cdn.hikari.test/ep2-p1.m3u8",
        "https://cdn.hikari.test/ep2-p2.m3u8",
        initialValidation.value,
      ],
    );

    await invalidateCatalogEpisodesCacheAsync(animeId, String(aliasAnilistId));
    const byAlias = await executeGetCatalogEpisodes(String(aliasAnilistId));
    const fetched2 = byAlias.episodes.find((e) => e.id === epId);
    assert.ok(fetched2);
    assert.equal(fetched2.hikariPlayerEpisodeId, "hp_ep_abc123");
    assert.equal(fetched2.videoUrl, "https://cdn.hikari.test/ep2-p1.m3u8");
    assert.equal(fetched2.videoUrl2, "https://cdn.hikari.test/ep2-p2.m3u8");

    // Partial update com campo omitido ($2 = false) deve preservar associação existente
    await sql.query(
      `UPDATE "catalog_episode"
       SET "hikari_player_episode_id" = CASE
             WHEN $2 = true THEN $3
             ELSE "catalog_episode"."hikari_player_episode_id"
           END,
           "title" = 'Episódio Associado Editado'
       WHERE "id" = $1;`,
      [epId, false, null],
    );
    await invalidateCatalogEpisodesCacheAsync(animeId, String(aliasAnilistId));
    const afterPartial = await executeGetCatalogEpisodes(animeId);
    const partialEp = afterPartial.episodes.find((e) => e.id === epId);
    assert.equal(partialEp?.title, "Episódio Associado Editado");
    assert.equal(partialEp?.hikariPlayerEpisodeId, "hp_ep_abc123");

    // Atualização explícita para outro ID
    await sql.query(
      `UPDATE "catalog_episode"
       SET "hikari_player_episode_id" = CASE
             WHEN $2 = true THEN $3
             ELSE "catalog_episode"."hikari_player_episode_id"
           END
       WHERE "id" = $1;`,
      [epId, true, "hp_ep_xyz789"],
    );
    await invalidateCatalogEpisodesCacheAsync(animeId, String(aliasAnilistId));
    const afterEdit = await executeGetCatalogEpisodes(String(aliasAnilistId));
    assert.equal(
      afterEdit.episodes.find((e) => e.id === epId)?.hikariPlayerEpisodeId,
      "hp_ep_xyz789",
    );

    const seasonsAfterEdit = buildResolvedSeasons(animeId, afterEdit, [
      {
        id: "s-local-1",
        number: 1,
        title: "Temporada 1",
        episodes: [
          {
            id: epId,
            number: 2,
            title: "Local Antigo",
            hikariPlayerEpisodeId: "old_stale_id",
            published: true,
          },
        ],
      },
    ]);
    assert.equal(
      seasonsAfterEdit[0].episodes.find((e) => e.id === epId)?.hikariPlayerEpisodeId,
      "hp_ep_xyz789",
    );

    // Remoção explícita da associação (NULL) não pode ser ressuscitada por local stale
    await sql.query(
      `UPDATE "catalog_episode"
       SET "hikari_player_episode_id" = NULL
       WHERE "id" = $1;`,
      [epId],
    );
    await invalidateCatalogEpisodesCacheAsync(animeId, String(aliasAnilistId));
    const afterClear = await executeGetCatalogEpisodes(animeId);
    assert.equal(
      afterClear.episodes.find((e) => e.id === epId)?.hikariPlayerEpisodeId,
      null,
    );

    const resolvedCleared = buildResolvedSeasons(animeId, afterClear, [
      {
        id: "s-local-1",
        number: 1,
        title: "Temporada 1",
        episodes: [
          {
            id: epId,
            number: 2,
            title: "Local Antigo",
            hikariPlayerEpisodeId: "hp_ep_xyz789",
            published: true,
          },
        ],
      },
    ]);
    assert.equal(
      resolvedCleared[0].episodes.find((e) => e.id === epId)?.hikariPlayerEpisodeId,
      undefined,
    );

    const adminMergedCleared = mergeAdminEpisodesWithServer({
      animeId,
      serverResult: afterClear,
      localSeasons: [
        {
          id: "s-local-1",
          number: 1,
          title: "Temporada 1",
          episodes: [
            {
              id: epId,
              number: 2,
              title: "Local Antigo",
              hikariPlayerEpisodeId: "hp_ep_xyz789",
              published: true,
            },
          ],
        },
      ],
    });
    assert.equal(
      adminMergedCleared.seasons[0].episodes.find((e) => e.id === epId)
        ?.hikariPlayerEpisodeId,
      undefined,
    );
  });
});

describe("hikari-player — publicação sem Player 1-5 e matriz completa de validação", () => {
  const animeId = "local-hikari-player-publish-only-test";
  const sampleId = "ZlSVZvtn0pMeZxoBp16qu";
  const expectedWatchUrl = `https://hikari-player-2.vercel.app/e/${sampleId}`;

  before(async () => {
    const sql = await getSql();
    await sql.query(`DELETE FROM "catalog_episode" WHERE "animeId" = $1;`, [animeId]);
    await sql.query(`DELETE FROM "catalog_season" WHERE "animeId" = $1;`, [animeId]);
    await sql.query(`DELETE FROM "catalog_anime" WHERE "id" = $1;`, [animeId]);

    await sql.query(
      `INSERT INTO "catalog_anime" ("id", "title", "titleRomaji", "status")
       VALUES ($1, 'Anime Hikari Only', 'Anime Hikari Only', 'RELEASING');`,
      [animeId],
    );
    await sql.query(
      `INSERT INTO "catalog_season" ("animeId", "number", "title", "position")
       VALUES ($1, 1, 'Temporada 1', 0);`,
      [animeId],
    );
  });

  it("7. Matriz completa: Player 1-5 x ID do Hikari Player (6 cenários)", async () => {
    const validUrl = "https://cdn.hikari.test/valid-ep.m3u8";
    const invalidUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
    const invalidHikariId = "https://hikari-player-2.vercel.app/e/ZlSVZvtn0pMeZxoBp16qu";

    // Caso 1: Player 1-5 vazia/inválida + ID vazio -> Bloqueia
    assert.equal(hasEpisodePlayableSource({ videoUrl: "" }), false);
    assert.equal(hasEpisodePlayableSource({ videoUrl: invalidUrl }), false);
    assert.equal(
      isEpisodePublished({ id: "m1", number: 1, videoUrl: "", published: true }),
      false,
    );

    // Caso 2: Player 1-5 vazia/inválida + ID inválido -> Bloqueia
    assert.equal(
      hasEpisodePlayableSource({
        videoUrl: invalidUrl,
        hikariPlayerEpisodeId: invalidHikariId,
      }),
      false,
    );
    assert.equal(
      isEpisodePublished({
        id: "m2",
        number: 2,
        videoUrl: "",
        hikariPlayerEpisodeId: invalidHikariId,
        published: true,
      }),
      false,
    );

    // Caso 3: Player 1-5 vazia/inválida + ID válido -> Permite
    assert.equal(
      hasEpisodePlayableSource({
        videoUrl: "",
        hikariPlayerEpisodeId: `  ${sampleId}  `,
      }),
      true,
    );
    assert.equal(
      isEpisodePublished({
        id: "m3",
        number: 3,
        videoUrl: "",
        hikariPlayerEpisodeId: sampleId,
        published: true,
      }),
      true,
    );

    // Caso 4: Player 1-5 URL válida + ID vazio -> Permite
    assert.equal(
      hasEpisodePlayableSource({ videoUrl: validUrl, hikariPlayerEpisodeId: "" }),
      true,
    );
    assert.equal(
      isEpisodePublished({ id: "m4", number: 4, videoUrl: validUrl, published: true }),
      true,
    );

    // Caso 5: Player 1-5 URL válida + ID inválido -> Permite pela URL válida
    assert.equal(
      hasEpisodePlayableSource({
        videoUrl: validUrl,
        hikariPlayerEpisodeId: invalidHikariId,
      }),
      true,
    );
    assert.equal(
      isEpisodePublished({
        id: "m5",
        number: 5,
        videoUrl: validUrl,
        hikariPlayerEpisodeId: invalidHikariId,
        published: true,
      }),
      true,
    );

    // Caso 6: Player 1-5 URL válida + ID válido -> Permite e preserva ambos
    assert.equal(
      hasEpisodePlayableSource({
        videoUrl: validUrl,
        hikariPlayerEpisodeId: sampleId,
      }),
      true,
    );
    assert.equal(
      isEpisodePublished({
        id: "m6",
        number: 6,
        videoUrl: validUrl,
        hikariPlayerEpisodeId: sampleId,
        published: true,
      }),
      true,
    );

    // Verifica comportamento de persistEpisode para todos os cenários sem depender de servidor HTTP externo
    const originalFetch = globalThis.fetch;
    const prevWindow = (globalThis as { window?: unknown }).window;
    const storageMap = new Map<string, string>();
    (globalThis as { window: unknown }).window = {
      localStorage: {
        get length() {
          return storageMap.size;
        },
        clear: () => storageMap.clear(),
        getItem: (k: string) => storageMap.get(k) ?? null,
        key: (i: number) => Array.from(storageMap.keys())[i] ?? null,
        removeItem: (k: string) => storageMap.delete(k),
        setItem: (k: string, v: string) => storageMap.set(k, String(v)),
      },
    };

    const capturedPayloads: Array<Record<string, unknown>> = [];
    globalThis.fetch = (async (_input: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body || "{}")) as Record<string, unknown>;
      capturedPayloads.push(body);
      return new Response(
        JSON.stringify({
          ok: true,
          published: Boolean(body.published),
          publishedAt: "2026-06-01T00:00:00.000Z",
          hikariPlayerEpisodeId: body.hikariPlayerEpisodeId ?? null,
          episodeId: body.id,
          canonicalId: body.id,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;

    try {
      // Bloqueia sem URL e sem ID
      const resBlockedEmpty = await persistEpisode(animeId, 1, {
        id: "p-empty",
        number: 1,
        title: "Ep 1",
        published: true,
      });
      assert.equal(resBlockedEmpty.confirmed, false);
      assert.equal(capturedPayloads.length, 0);

      // Bloqueia sem URL e com ID inválido
      const resBlockedInvalid = await persistEpisode(animeId, 1, {
        id: "p-invalid-id",
        number: 1,
        title: "Ep 1",
        hikariPlayerEpisodeId: invalidHikariId,
        published: true,
      });
      assert.equal(resBlockedInvalid.confirmed, false);
      assert.equal(capturedPayloads.length, 0);

      // Permite com apenas ID válido (Player 1-5 vazios)
      const resHikariOnly = await persistEpisode(animeId, 1, {
        id: "p-hikari-only",
        number: 1,
        title: "Ep 1",
        hikariPlayerEpisodeId: `  ${sampleId} `,
        published: true,
      });
      assert.equal(resHikariOnly.confirmed, true);
      assert.equal(resHikariOnly.published, true);
      assert.equal(resHikariOnly.hikariPlayerEpisodeId, sampleId);
      assert.equal(capturedPayloads[0]?.hikariPlayerEpisodeId, sampleId);
      assert.equal(capturedPayloads[0]?.videoUrl, null);
      assert.equal(capturedPayloads[0]?.published, true);

      // Permite URL válida + ID inválido (descarta ID inválido no payload e publica pela URL)
      const resUrlWithInvalidId = await persistEpisode(animeId, 1, {
        id: "p-url-bad-id",
        number: 2,
        title: "Ep 2",
        videoUrl: validUrl,
        hikariPlayerEpisodeId: invalidHikariId,
        published: true,
      });
      assert.equal(resUrlWithInvalidId.confirmed, true);
      assert.equal(resUrlWithInvalidId.published, true);
      assert.equal(capturedPayloads[1]?.videoUrl, validUrl);
      assert.equal(capturedPayloads[1]?.hikariPlayerEpisodeId, null);

      // Permite URL válida + ID válido e preserva ambos
      const resBoth = await persistEpisode(animeId, 1, {
        id: "p-both",
        number: 3,
        title: "Ep 3",
        videoUrl: validUrl,
        hikariPlayerEpisodeId: sampleId,
        published: true,
      });
      assert.equal(resBoth.confirmed, true);
      assert.equal(resBoth.published, true);
      assert.equal(capturedPayloads[2]?.videoUrl, validUrl);
      assert.equal(capturedPayloads[2]?.hikariPlayerEpisodeId, sampleId);
    } finally {
      globalThis.fetch = originalFetch;
      if (prevWindow === undefined) {
        delete (globalThis as { window?: unknown }).window;
      } else {
        (globalThis as { window?: unknown }).window = prevWindow;
      }
    }
  });

  it("8. Episódio publicado somente com hikari_player_episode_id aparece no catálogo público, Home, Anime, Watch e Admin", async () => {
    const sql = await getSql();
    const epId = "ep-hikari-only-public-1";

    await sql.query(
      `INSERT INTO "catalog_episode" (
         "id", "animeId", "seasonNumber", "number", "title",
         "videoUrl", "videoUrl2", "videoUrl3", "videoUrl4", "videoUrl5",
         "hikari_player_episode_id", "published", "publishedAt"
       ) VALUES ($1, $2, 1, 1, 'Episódio Hikari Only', NULL, NULL, NULL, NULL, NULL, $3, true, CURRENT_TIMESTAMP);`,
      [epId, animeId, sampleId],
    );

    await invalidateCatalogEpisodesCacheAsync(animeId);
    invalidateHomePublicEpisodesCache();

    // 1. Consulta canônica do anime
    const catalogRes = await executeGetCatalogEpisodes(animeId);
    const catalogEp = catalogRes.episodes.find((e) => e.id === epId);
    assert.ok(catalogEp);
    assert.equal(catalogEp.published, true);
    assert.equal(catalogEp.hikariPlayerEpisodeId, sampleId);
    assert.equal(catalogEp.videoUrl, null);

    // 2. Consulta paginada (/episodes) e filtro de opções
    const paginated = await executeGetPaginatedPublicCatalogEpisodes({
      animeId,
      page: 1,
      pageSize: 24,
    });
    assert.equal(paginated.status, "success");
    assert.equal(paginated.totalCount, 1);
    assert.equal(paginated.episodes[0]?.id, epId);
    assert.equal(paginated.episodes[0]?.hikariPlayerEpisodeId, sampleId);

    const animeOptions = await executeGetPublicCatalogAnimeOptions();
    assert.ok(animeOptions.some((opt) => opt.id === animeId));

    // 3. Consulta pública completa + Home Recent Episodes
    const publicCatalog = await executeGetPublicCatalogEpisodes({ limit: 100 });
    const publicRow = publicCatalog.episodes.find((e) => e.id === epId);
    assert.ok(publicRow);
    assert.equal(publicRow.hikariPlayerEpisodeId, sampleId);

    const homePublic = await executeGetHomePublicEpisodes({ limit: 100 });
    const homeRow = homePublic.episodes.find((e) => e.id === epId);
    assert.ok(homeRow);
    assert.equal(homeRow.hikariPlayerEpisodeId, sampleId);

    const resolvedPublic = resolvePublicEpisodes(publicCatalog, [], {
      outbox: [],
      tombstones: [],
    });
    const pubItem = resolvedPublic.find((e) => e.episodeId === epId);
    assert.ok(pubItem);
    assert.equal(pubItem.hikariPlayerEpisodeId, sampleId);
    assert.equal(pubItem.videoUrl, undefined);

    const resolvedHomeRecent = resolvePublicRecentEpisodes(homePublic as any, [], {
      outbox: [],
      tombstones: [],
    });
    const recentItem = resolvedHomeRecent.find((e) => e.episodeId === epId);
    assert.ok(recentItem);
    assert.equal(recentItem.hikariPlayerEpisodeId, sampleId);

    // 4. Fallback local (getAllPublishedEpisodes / getRecentEpisodesSection / sanitizeRemoteEpisodeForAdmin / admin index)
    const mappedEp = catalogItemToEpisode(catalogEp);
    assert.equal(mappedEp.hikariPlayerEpisodeId, sampleId);
    assert.equal(mappedEp.published, true);

    const sanitizedAdminEp = sanitizeRemoteEpisodeForAdmin(mappedEp);
    assert.equal(sanitizedAdminEp.published, true);
    assert.equal(sanitizedAdminEp.hikariPlayerEpisodeId, sampleId);

    const localAnime = {
      id: animeId,
      titleRomaji: "Anime Hikari Only",
      titleEnglish: "Anime Hikari Only",
      titleNative: "",
      cover: "",
      banner: "",
      synopsis: "",
      score: null,
      genres: [],
      format: "TV",
      status: "RELEASING",
      episodesCount: 12,
      season: null,
      year: 2026,
      trailerId: null,
      hidden: false,
      seasons: [
        {
          id: `s-${animeId}-1`,
          number: 1,
          title: "Temporada 1",
          episodes: [mappedEp],
        },
      ],
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
    };

    const localAllPub = getAllPublishedEpisodes([localAnime]);
    assert.equal(localAllPub.length, 1);
    assert.equal(localAllPub[0]?.hikariPlayerEpisodeId, sampleId);

    const localRecent = getRecentEpisodesSection([localAnime]);
    assert.equal(localRecent.length, 1);
    assert.equal(localRecent[0]?.hikariPlayerEpisodeId, sampleId);

    const adminIndex = buildAdminCatalogIndex([localAnime]);
    assert.equal(adminIndex.stats.totalPublishedEpisodes, 1);

    // 5. Seleção no /watch/$id/$ep e construção exata da URL do Hikari Player
    const selectedWatchEp = selectEpisodeForWatch([mappedEp], epId, 1);
    assert.ok(selectedWatchEp);
    assert.equal(
      buildHikariPlayerEpisodeUrl(selectedWatchEp.hikariPlayerEpisodeId),
      expectedWatchUrl,
    );
  });
});
