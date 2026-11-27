import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { getSql } from "./db";
import {
  episodePostSchema,
  resolveEpisodeBadgesPatch,
  type OutboxOperation,
} from "./episode-writer";
import {
  executeGetCatalogEpisodes,
  executeGetPaginatedPublicCatalogEpisodes,
  executeGetPublicCatalogEpisodes,
  invalidateCatalogEpisodesCache,
  invalidatePublicCatalogEpisodesCache,
  mergeAdminEpisodesWithServer,
} from "./catalog-episodes";
import {
  executeGetHomePublicEpisodes,
  invalidateHomePublicEpisodesCache,
} from "./home-episodes";
import {
  getAllPublishedEpisodes,
  getRecentEpisodesSection,
  isPublishedEpisodeDubbed,
  resolvePublicEpisodes,
  resolvePublicRecentEpisodes,
} from "./published-episodes";
import { reconcileDirtyEpisodeIdsAfterFormPopulation } from "./opening-admin-state";
import {
  mergeSeasonsWithRemote,
  mergeSeasonsWithRemoteForAdmin,
  sanitizeRemoteEpisodeForAdmin,
} from "./overlay";
import { isValidPublicEpisodeShape } from "./redis";
import {
  DEFAULT_ANIME_RECENT_BADGES,
  normalizeAnimeRecentBadges,
  type AnimeRecentBadges,
  type Episode,
  type LocalAnime,
  type Season,
} from "./types";

const UPSERT_EPISODE_SQL = `
  INSERT INTO "catalog_episode" (
    "id", "animeId", "seasonNumber", "number",
    "title", "thumbnail", "duration", "synopsis",
    "videoUrl", "videoUrl2", "videoUrl3", "videoUrl4", "videoUrl5",
    "badge_lancamento", "badge_novo", "badge_final",
    "published", "publishedAt", "createdAt", "updatedAt"
  )
  VALUES (
    $1, $2, $3, $4,
    $5, $6, $7, $8,
    $9, $10, $11, $12, $13,
    $14, $15, $16,
    $17,
    CASE WHEN $17 = true THEN CURRENT_TIMESTAMP ELSE NULL END,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
  ON CONFLICT ("animeId", "seasonNumber", "number") DO UPDATE
  SET
    "title" = EXCLUDED."title",
    "videoUrl" = CASE
      WHEN $18 = true THEN EXCLUDED."videoUrl"
      ELSE COALESCE(NULLIF(EXCLUDED."videoUrl", ''), "catalog_episode"."videoUrl")
    END,
    "badge_lancamento" = CASE
      WHEN $19 = true THEN EXCLUDED."badge_lancamento"
      ELSE "catalog_episode"."badge_lancamento"
    END,
    "badge_novo" = CASE
      WHEN $20 = true THEN EXCLUDED."badge_novo"
      ELSE "catalog_episode"."badge_novo"
    END,
    "badge_final" = CASE
      WHEN $21 = true THEN EXCLUDED."badge_final"
      ELSE "catalog_episode"."badge_final"
    END,
    "published" = EXCLUDED."published",
    "publishedAt" = CASE
      WHEN EXCLUDED."published" = true AND "catalog_episode"."publishedAt" IS NULL THEN CURRENT_TIMESTAMP
      WHEN EXCLUDED."published" = false THEN NULL
      ELSE "catalog_episode"."publishedAt"
    END,
    "updatedAt" = CURRENT_TIMESTAMP
  RETURNING
    "id",
    "badge_lancamento" AS "badgeLancamento",
    "badge_novo" AS "badgeNovo",
    "badge_final" AS "badgeFinal";
`;

async function upsertEpisodeRow(
  sql: Awaited<ReturnType<typeof getSql>>,
  params: {
    id: string;
    animeId: string;
    seasonNumber: number;
    number: number;
    title: string;
    videoUrl: string;
    published: boolean;
    recentBadges?: Partial<AnimeRecentBadges> | null;
    replaceVideoSlots?: boolean;
  },
) {
  const patch = resolveEpisodeBadgesPatch({
    recentBadges: params.recentBadges,
  });
  return sql.query<{
    id: string;
    badgeLancamento: boolean;
    badgeNovo: boolean;
    badgeFinal: boolean;
  }>(UPSERT_EPISODE_SQL, [
    params.id,
    params.animeId,
    params.seasonNumber,
    params.number,
    params.title,
    "",
    "24:00",
    "",
    params.videoUrl,
    "",
    "",
    "",
    "",
    patch.badgeLancamento,
    patch.badgeNovo,
    patch.badgeFinal,
    params.published,
    params.replaceVideoSlots ?? false,
    patch.hasLancamentoField,
    patch.hasNovoField,
    patch.hasFinalField,
  ]);
}

describe("Selos individuais por episódio — DB (PGLite), API, Admin e Exibição Pública (Cenários A–F)", () => {
  const animeId = "anime-individual-badges-e2e";
  const multiSeasonAnimeId = "anime-multi-season-badges-e2e";

  before(async () => {
    const sql = await getSql();
    for (const targetId of [animeId, multiSeasonAnimeId]) {
      await sql.query(`DELETE FROM "catalog_episode" WHERE "animeId" = $1;`, [targetId]);
      await sql.query(`DELETE FROM "catalog_season" WHERE "animeId" = $1;`, [targetId]);
      await sql.query(`DELETE FROM "catalog_anime" WHERE "id" = $1;`, [targetId]);
    }

    await sql.query(
      `INSERT INTO "catalog_anime" ("id", "title", "titleRomaji", "status", "episodesCount", "hidden")
       VALUES ($1, 'Anime Selos Individuais', 'Anime Selos Individuais', 'RELEASING', 12, false);`,
      [animeId],
    );
    await sql.query(
      `INSERT INTO "catalog_season" ("animeId", "number", "title", "position")
       VALUES ($1, 1, 'Temporada 1', 0);`,
      [animeId],
    );

    await sql.query(
      `INSERT INTO "catalog_anime" ("id", "title", "titleRomaji", "status", "episodesCount", "hidden")
       VALUES ($1, 'Anime Multi Temporada', 'Anime Multi Temporada', 'FINISHED', 24, false);`,
      [multiSeasonAnimeId],
    );
    await sql.query(
      `INSERT INTO "catalog_season" ("animeId", "number", "title", "position")
       VALUES ($1, 1, 'Temporada 1', 0), ($1, 2, 'Temporada 2', 1);`,
      [multiSeasonAnimeId],
    );
  });

  it("0. Migration 0045 adicionou badge_lancamento, badge_novo e badge_final como BOOLEAN NOT NULL DEFAULT FALSE", async () => {
    const sql = await getSql();
    const cols = await sql.query<{
      column_name: string;
      data_type: string;
      is_nullable: string;
      column_default: string | null;
    }>(
      `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_name = 'catalog_episode'
         AND column_name IN ('badge_lancamento', 'badge_novo', 'badge_final')
       ORDER BY column_name ASC;`,
    );

    assert.equal(cols.length, 3);
    for (const col of cols) {
      assert.equal(col.data_type, "boolean");
      assert.equal(col.is_nullable, "NO");
      assert.equal(String(col.column_default).toLowerCase(), "false");
    }
  });

  it("Cenário A: Cadastro em lote de 12 episódios inicia sem nenhum selo automático", async () => {
    const sql = await getSql();

    for (let ep = 1; ep <= 12; ep++) {
      // Payload sem recentBadges (cadastro padrão / lote)
      const parsed = episodePostSchema.safeParse({
        id: `${animeId}-ep-${ep}`,
        animeId,
        seasonNumber: 1,
        number: ep,
        title: `Episódio ${ep}`,
        videoUrl: `https://cdn.example.com/${animeId}/ep-${ep}.mp4`,
        published: true,
      });
      assert.equal(parsed.success, true);

      await upsertEpisodeRow(sql, {
        id: `${animeId}-ep-${ep}`,
        animeId,
        seasonNumber: 1,
        number: ep,
        title: `Episódio ${ep}`,
        videoUrl: `https://cdn.example.com/${animeId}/ep-${ep}.mp4`,
        published: true,
        recentBadges: undefined,
      });
    }

    invalidateCatalogEpisodesCache(animeId);
    invalidatePublicCatalogEpisodesCache();
    invalidateHomePublicEpisodesCache();

    const adminCatalog = await executeGetCatalogEpisodes(animeId, { includeUnpublished: true });
    assert.equal(adminCatalog.episodes.length, 12);
    for (const row of adminCatalog.episodes) {
      assert.equal(row.badgeLancamento, false);
      assert.equal(row.badgeNovo, false);
      assert.equal(row.badgeFinal, false);
    }

    const publicCatalog = await executeGetPublicCatalogEpisodes({ limit: 100 });
    const animePublicEps = publicCatalog.episodes.filter((e) => e.animeId === animeId);
    assert.equal(animePublicEps.length, 12);
    for (const row of animePublicEps) {
      assert.equal(row.badgeLancamento, false);
      assert.equal(row.badgeNovo, false);
      assert.equal(row.badgeFinal, false);
    }

    const resolved = resolvePublicEpisodes(publicCatalog, []);
    const resolvedAnimeEps = resolved.filter((e) => e.animeId === animeId);
    assert.equal(resolvedAnimeEps.length, 12);
    for (const ep of resolvedAnimeEps) {
      assert.deepEqual(ep.recentBadges, DEFAULT_ANIME_RECENT_BADGES);
      assert.equal(ep.badge, null);
    }
  });

  it("Cenário B: Controle granular em 12 episódios — Ep 2=NOVO, Ep 5=LANÇAMENTO, Ep 12=FINAL, demais sem selo", async () => {
    const sql = await getSql();

    await upsertEpisodeRow(sql, {
      id: `${animeId}-ep-2`,
      animeId,
      seasonNumber: 1,
      number: 2,
      title: "Episódio 2",
      videoUrl: `https://cdn.example.com/${animeId}/ep-2.mp4`,
      published: true,
      recentBadges: { lancamento: false, novo: true, final: false },
    });
    await upsertEpisodeRow(sql, {
      id: `${animeId}-ep-5`,
      animeId,
      seasonNumber: 1,
      number: 5,
      title: "Episódio 5",
      videoUrl: `https://cdn.example.com/${animeId}/ep-5.mp4`,
      published: true,
      recentBadges: { lancamento: true, novo: false, final: false },
    });
    await upsertEpisodeRow(sql, {
      id: `${animeId}-ep-12`,
      animeId,
      seasonNumber: 1,
      number: 12,
      title: "Episódio 12",
      videoUrl: `https://cdn.example.com/${animeId}/ep-12.mp4`,
      published: true,
      recentBadges: { lancamento: false, novo: false, final: true },
    });

    invalidateCatalogEpisodesCache(animeId);
    invalidatePublicCatalogEpisodesCache();
    invalidateHomePublicEpisodesCache();

    const [homeRes, publicRes, paginatedRes, adminRes] = await Promise.all([
      executeGetHomePublicEpisodes({ limit: 100 }),
      executeGetPublicCatalogEpisodes({ limit: 100 }),
      executeGetPaginatedPublicCatalogEpisodes({ page: 1, pageSize: 50, animeId }),
      executeGetCatalogEpisodes(animeId, { includeUnpublished: true }),
    ]);

    // A Home retorna apenas o primeiro (Ep 1) e o último (Ep 12) episódio publicado da temporada/áudio
    const homeAnimeEps = homeRes.episodes.filter((e) => e.animeId === animeId);
    assert.equal(homeAnimeEps.length, 2);
    assert.deepEqual(
      homeAnimeEps.map((e) => e.number).sort((a, b) => a - b),
      [1, 12],
    );
    assert.equal(homeAnimeEps.find((e) => e.number === 1)?.badgeLancamento, false);
    assert.equal(homeAnimeEps.find((e) => e.number === 1)?.badgeNovo, false);
    assert.equal(homeAnimeEps.find((e) => e.number === 1)?.badgeFinal, false);
    assert.equal(homeAnimeEps.find((e) => e.number === 12)?.badgeLancamento, false);
    assert.equal(homeAnimeEps.find((e) => e.number === 12)?.badgeNovo, false);
    assert.equal(homeAnimeEps.find((e) => e.number === 12)?.badgeFinal, true);

    for (const sourceEps of [
      publicRes.episodes.filter((e) => e.animeId === animeId),
      paginatedRes.episodes.filter((e) => e.animeId === animeId),
    ]) {
      assert.equal(sourceEps.length, 12);
      for (const row of sourceEps) {
        if (row.number === 2) {
          assert.equal(row.badgeLancamento, false);
          assert.equal(row.badgeNovo, true);
          assert.equal(row.badgeFinal, false);
        } else if (row.number === 5) {
          assert.equal(row.badgeLancamento, true);
          assert.equal(row.badgeNovo, false);
          assert.equal(row.badgeFinal, false);
        } else if (row.number === 12) {
          assert.equal(row.badgeLancamento, false);
          assert.equal(row.badgeNovo, false);
          assert.equal(row.badgeFinal, true);
        } else {
          assert.equal(row.badgeLancamento, false);
          assert.equal(row.badgeNovo, false);
          assert.equal(row.badgeFinal, false);
        }
      }
    }

    const resolvedAllPublic = resolvePublicEpisodes(publicRes, []);
    const allForAnime = resolvedAllPublic.filter((e) => e.animeId === animeId);
    assert.equal(allForAnime.find((e) => e.episodeNumber === 1)?.badge, null);
    assert.equal(allForAnime.find((e) => e.episodeNumber === 2)?.badge, "NOVO");
    assert.equal(allForAnime.find((e) => e.episodeNumber === 5)?.badge, "LANÇAMENTO");
    assert.equal(allForAnime.find((e) => e.episodeNumber === 11)?.badge, null);
    assert.equal(allForAnime.find((e) => e.episodeNumber === 12)?.badge, "FINAL");

    const resolvedRecent = resolvePublicRecentEpisodes(homeRes, []);
    const recentForAnime = resolvedRecent.filter((e) => e.animeId === animeId);
    assert.equal(recentForAnime.length, 2);
    assert.equal(recentForAnime.find((e) => e.episodeNumber === 1)?.badge, null);
    assert.equal(recentForAnime.find((e) => e.episodeNumber === 12)?.badge, "FINAL");

    // Reabertura no Admin recupera os estados exatos do banco
    const mergedAdmin = mergeAdminEpisodesWithServer({
      animeId,
      localSeasons: [],
      serverResult: adminRes,
      outboxOps: [],
    });
    const adminEps = mergedAdmin.seasons[0]!.episodes;
    assert.deepEqual(adminEps.find((e) => e.number === 1)?.recentBadges, DEFAULT_ANIME_RECENT_BADGES);
    assert.deepEqual(adminEps.find((e) => e.number === 2)?.recentBadges, {
      lancamento: false,
      novo: true,
      final: false,
    });
    assert.deepEqual(adminEps.find((e) => e.number === 5)?.recentBadges, {
      lancamento: true,
      novo: false,
      final: false,
    });
    assert.deepEqual(adminEps.find((e) => e.number === 12)?.recentBadges, {
      lancamento: false,
      novo: false,
      final: true,
    });
  });

  it("Cenário C: Múltiplos selos combinados no mesmo episódio e desativação individual persistida", async () => {
    const sql = await getSql();

    // Ativa todos os 3 selos no Ep 7
    await upsertEpisodeRow(sql, {
      id: `${animeId}-ep-7`,
      animeId,
      seasonNumber: 1,
      number: 7,
      title: "Episódio 7",
      videoUrl: `https://cdn.example.com/${animeId}/ep-7.mp4`,
      published: true,
      recentBadges: { lancamento: true, novo: true, final: true },
    });

    invalidateCatalogEpisodesCache(animeId);
    let adminRes = await executeGetCatalogEpisodes(animeId, { includeUnpublished: true });
    let ep7 = adminRes.episodes.find((e) => e.number === 7);
    assert.equal(ep7?.badgeLancamento, true);
    assert.equal(ep7?.badgeNovo, true);
    assert.equal(ep7?.badgeFinal, true);

    // Desmarca apenas FINAL no Ep 7
    await upsertEpisodeRow(sql, {
      id: `${animeId}-ep-7`,
      animeId,
      seasonNumber: 1,
      number: 7,
      title: "Episódio 7",
      videoUrl: `https://cdn.example.com/${animeId}/ep-7.mp4`,
      published: true,
      recentBadges: { lancamento: true, novo: true, final: false },
    });

    invalidateCatalogEpisodesCache(animeId);
    invalidatePublicCatalogEpisodesCache();
    adminRes = await executeGetCatalogEpisodes(animeId, { includeUnpublished: true });
    ep7 = adminRes.episodes.find((e) => e.number === 7);
    assert.equal(ep7?.badgeLancamento, true);
    assert.equal(ep7?.badgeNovo, true);
    assert.equal(ep7?.badgeFinal, false);

    // Outros episódios (ex.: Ep 2=NOVO, Ep 12=FINAL) não sofrem alteração
    assert.equal(adminRes.episodes.find((e) => e.number === 2)?.badgeNovo, true);
    assert.equal(adminRes.episodes.find((e) => e.number === 12)?.badgeFinal, true);
  });

  it("Cenário D: Atualizações parciais (sem recentBadges) preservam selos existentes no DB", async () => {
    const sql = await getSql();

    // Atualiza apenas vídeo/título do Ep 2 (NOVO) sem enviar recentBadges (como QuickPlayerUpdate / import / backup)
    const partialResult = await upsertEpisodeRow(sql, {
      id: `${animeId}-ep-2`,
      animeId,
      seasonNumber: 1,
      number: 2,
      title: "Episódio 2 (Atualizado)",
      videoUrl: `https://cdn.example.com/${animeId}/ep-2-v2.mp4`,
      published: true,
      recentBadges: undefined,
      replaceVideoSlots: true,
    });

    assert.equal(partialResult[0]?.badgeLancamento, false);
    assert.equal(partialResult[0]?.badgeNovo, true);
    assert.equal(partialResult[0]?.badgeFinal, false);

    // Patch parcial de apenas um campo dentro de recentBadges preserva os demais
    const singleKeyPatch = resolveEpisodeBadgesPatch(
      { recentBadges: { lancamento: true } },
      { badgeLancamento: false, badgeNovo: true, badgeFinal: false },
    );
    assert.equal(singleKeyPatch.hasLancamentoField, true);
    assert.equal(singleKeyPatch.hasNovoField, false);
    assert.equal(singleKeyPatch.hasFinalField, false);
    assert.deepEqual(singleKeyPatch.recentBadges, {
      lancamento: true,
      novo: true,
      final: false,
    });
  });

  it("Cenário E: Multi-temporada isolada, rascunhos ocultos, Outbox pendente e dirty reconciliation", async () => {
    const sql = await getSql();

    await upsertEpisodeRow(sql, {
      id: `${multiSeasonAnimeId}-s1-e1`,
      animeId: multiSeasonAnimeId,
      seasonNumber: 1,
      number: 1,
      title: "T1 Ep 1",
      videoUrl: "https://cdn.example.com/ms/s1e1.mp4",
      published: true,
      recentBadges: { lancamento: false, novo: true, final: false },
    });
    await upsertEpisodeRow(sql, {
      id: `${multiSeasonAnimeId}-s2-e1`,
      animeId: multiSeasonAnimeId,
      seasonNumber: 2,
      number: 1,
      title: "T2 Ep 1",
      videoUrl: "https://cdn.example.com/ms/s2e1.mp4",
      published: true,
      recentBadges: { lancamento: true, novo: false, final: false },
    });
    await upsertEpisodeRow(sql, {
      id: `${multiSeasonAnimeId}-s2-e2-draft`,
      animeId: multiSeasonAnimeId,
      seasonNumber: 2,
      number: 2,
      title: "T2 Ep 2 Rascunho",
      videoUrl: "https://cdn.example.com/ms/s2e2.mp4",
      published: false,
      recentBadges: { lancamento: false, novo: true, final: true },
    });

    invalidateCatalogEpisodesCache(multiSeasonAnimeId);
    invalidatePublicCatalogEpisodesCache();
    invalidateHomePublicEpisodesCache();

    const publicRes = await executeGetPublicCatalogEpisodes({ limit: 100 });
    const msPublic = publicRes.episodes.filter((e) => e.animeId === multiSeasonAnimeId);
    assert.equal(msPublic.length, 2, "Rascunho não deve aparecer no catálogo público");
    assert.equal(msPublic.find((e) => e.seasonNumber === 1 && e.number === 1)?.badgeNovo, true);
    assert.equal(msPublic.find((e) => e.seasonNumber === 2 && e.number === 1)?.badgeLancamento, true);

    // Outbox pendente tem prioridade sobre banco obsoleto
    const pendingOutbox: OutboxOperation[] = [
      {
        id: "op-badge-override",
        type: "upsert",
        episodeId: `${multiSeasonAnimeId}-s1-e1`,
        animeId: multiSeasonAnimeId,
        seasonNumber: 1,
        episodeNumber: 1,
        createdAt: Date.now(),
        attempts: 0,
        status: "pending",
        payload: {
          id: `${multiSeasonAnimeId}-s1-e1`,
          animeId: multiSeasonAnimeId,
          seasonNumber: 1,
          number: 1,
          title: "T1 Ep 1",
          videoUrl: "https://cdn.example.com/ms/s1e1.mp4",
          published: true,
          recentBadges: { lancamento: true, novo: false, final: false },
        },
      },
    ];

    const resolvedWithOutbox = resolvePublicEpisodes(publicRes, [], { outbox: pendingOutbox });
    const s1e1Resolved = resolvedWithOutbox.find(
      (e) => e.animeId === multiSeasonAnimeId && e.seasonNumber === 1 && e.episodeNumber === 1,
    );
    assert.deepEqual(s1e1Resolved?.recentBadges, {
      lancamento: true,
      novo: false,
      final: false,
    });
    assert.equal(s1e1Resolved?.badge, "LANÇAMENTO");

    // Reconciliação de dirty episodes no Admin marca apenas o episódio com selo alterado
    const adminCatalog = await executeGetCatalogEpisodes(multiSeasonAnimeId, { includeUnpublished: true });
    const localSeasons: Season[] = [
      {
        id: "s-1",
        number: 1,
        title: "Temporada 1",
        episodes: [
          {
            id: `${multiSeasonAnimeId}-s1-e1`,
            number: 1,
            title: "T1 Ep 1",
            videoUrl: "https://cdn.example.com/ms/s1e1.mp4",
            published: true,
            recentBadges: { lancamento: true, novo: false, final: false },
          },
        ],
      },
      {
        id: "s-2",
        number: 2,
        title: "Temporada 2",
        episodes: [
          {
            id: `${multiSeasonAnimeId}-s2-e1`,
            number: 1,
            title: "T2 Ep 1",
            videoUrl: "https://cdn.example.com/ms/s2e1.mp4",
            published: true,
            recentBadges: { lancamento: true, novo: false, final: false },
          },
        ],
      },
    ];
    const dirtyIds = new Set<string>();
    reconcileDirtyEpisodeIdsAfterFormPopulation(
      dirtyIds,
      localSeasons,
      adminCatalog.episodes,
    );
    assert.equal(dirtyIds.has(`${multiSeasonAnimeId}-s1-e1`), true);
    assert.equal(dirtyIds.has(`${multiSeasonAnimeId}-s2-e1`), false);

    // Overlay de mergeSeasonsWithRemote e sanitizeRemoteEpisodeForAdmin preservam recentBadges por episódio
    const remoteEp: Episode = {
      id: "rem-1",
      number: 1,
      title: "Ep 1",
      recentBadges: { lancamento: false, novo: true, final: false },
    };
    const sanitized = sanitizeRemoteEpisodeForAdmin(remoteEp);
    assert.deepEqual(sanitized.recentBadges, { lancamento: false, novo: true, final: false });

    const mergedSeasons = mergeSeasonsWithRemote(
      [],
      [{ id: "rs-1", number: 1, title: "Temporada 1", episodes: [remoteEp] }],
    );
    assert.deepEqual(mergedSeasons[0]?.episodes[0]?.recentBadges, {
      lancamento: false,
      novo: true,
      final: false,
    });

    const mergedAdminSeasons = mergeSeasonsWithRemoteForAdmin(
      [],
      [{ id: "rs-1", number: 1, title: "Temporada 1", episodes: [remoteEp] }],
    );
    assert.deepEqual(mergedAdminSeasons[0]?.episodes[0]?.recentBadges, {
      lancamento: false,
      novo: true,
      final: false,
    });
  });

  it("Cenário F: DUB independente, zero herança de anime legado e validação de payload Redis v2", () => {
    // Mesmo que um LocalAnime antigo possua recentBadges no objeto do anime, episódios não herdam
    const legacyAnimeWithBadges: LocalAnime = {
      id: "legacy-anime-no-inherit",
      titleRomaji: "Anime Dublado",
      titleEnglish: "Anime Dubbed",
      titleNative: "",
      cover: "https://cdn.example.com/cover.jpg",
      banner: "https://cdn.example.com/banner.jpg",
      synopsis: "",
      score: 90,
      genres: [],
      format: "TV",
      status: "FINISHED",
      episodesCount: 3,
      season: "FALL",
      year: 2025,
      trailerId: null,
      hidden: false,
      recentBadges: { lancamento: true, novo: true, final: true },
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
      seasons: [
        {
          id: "s-1",
          number: 1,
          title: "Temporada 1",
          episodes: [
            {
              id: "leg-1",
              number: 1,
              title: "Episódio 1",
              videoUrl: "https://cdn.example.com/leg1.mp4",
              published: true,
            },
            {
              id: "leg-2",
              number: 2,
              title: "Episódio 2",
              videoUrl: "https://cdn.example.com/leg2.mp4",
              recentBadges: { lancamento: false, novo: true, final: false },
              published: true,
            },
          ],
        },
      ],
    };

    const recent = getRecentEpisodesSection([legacyAnimeWithBadges]);
    const all = getAllPublishedEpisodes([legacyAnimeWithBadges]);
    assert.deepEqual(recent.find((e) => e.episodeNumber === 1)?.recentBadges, DEFAULT_ANIME_RECENT_BADGES);
    assert.deepEqual(recent.find((e) => e.episodeNumber === 2)?.recentBadges, {
      lancamento: false,
      novo: true,
      final: false,
    });
    assert.deepEqual(all.find((e) => e.episodeNumber === 1)?.recentBadges, DEFAULT_ANIME_RECENT_BADGES);
    assert.deepEqual(all.find((e) => e.episodeNumber === 2)?.recentBadges, {
      lancamento: false,
      novo: true,
      final: false,
    });

    // DUB independe de LANÇAMENTO / NOVO / FINAL
    assert.equal(
      isPublishedEpisodeDubbed({
        animeTitle: "Anime Dublado",
        animeAltTitles: [],
        seasonTitle: "Temporada 1",
        episodeTitle: "Episódio 1",
      }),
      true,
    );
    assert.equal(
      isPublishedEpisodeDubbed({
        animeTitle: "Anime Legendado",
        animeAltTitles: [],
        seasonTitle: "Temporada 1",
        episodeTitle: "Episódio 1",
      }),
      false,
    );

    // Validação do shape Redis v2 rejeita caches antigos sem badgeLancamento/badgeNovo/badgeFinal
    assert.equal(
      isValidPublicEpisodeShape({
        id: "ep-1",
        animeId: "anime-1",
        seasonNumber: 1,
        number: 1,
        published: true,
      }),
      false,
    );
    assert.equal(
      isValidPublicEpisodeShape({
        id: "ep-1",
        animeId: "anime-1",
        seasonNumber: 1,
        number: 1,
        published: true,
        badgeLancamento: false,
        badgeNovo: true,
        badgeFinal: false,
      }),
      true,
    );
    assert.deepEqual(normalizeAnimeRecentBadges(undefined), DEFAULT_ANIME_RECENT_BADGES);
  });
});
