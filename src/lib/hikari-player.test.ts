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
  invalidateCatalogEpisodesCacheAsync,
  mergeAdminEpisodesWithServer,
} from "./catalog-episodes";

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
