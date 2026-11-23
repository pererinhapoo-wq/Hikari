import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { dbSource, getSql, type Sql } from "./db";
import {
  fetchAdminCatalogSyncMetaFromDb,
  fetchAdminSystemStatusFromDb,
  type AdminCatalogSyncMetaItem,
  type AdminSystemStatus,
} from "./admin-dashboard.functions";
import {
  getCachedAdminSystemStatus,
  invalidateAdminDashboardCache,
  loadAdminSystemStatusCached,
  syncAdminCatalogMetaCached,
} from "./admin-dashboard-client-cache";
import {
  buildAdminCatalogIndex,
  filterAndSortAdminCatalog,
} from "./admin-catalog-index";
import {
  flushAnimes,
  markCatalogPersistedRef,
  scheduleSave,
} from "./catalog-storage";
import {
  OUTBOX_STORAGE_KEY,
  readOutbox,
  writeOutbox,
  type OutboxOperation,
} from "./episode-writer";
import {
  applyTemporaryUserBan,
  buildActiveBanKey,
} from "./moderation-bans.server";
import { useHikariStore } from "./store";
import type { LocalAnime } from "./types";
import { queryAdminImagesFromDb } from "../routes/api/admin/images";
import { queryAdminCommentsFromDb } from "../routes/api/admin/comments";

interface RecordedQuery {
  text: string;
  params: unknown[] | undefined;
}

function createSqlSpy(sql: Sql): {
  spySql: Sql;
  queries: RecordedQuery[];
  reset: () => void;
} {
  const queries: RecordedQuery[] = [];
  const spyFn = (<T = Record<string, unknown>>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T[]> => {
    queries.push({ text: strings.join("?"), params: values });
    return sql<T>(strings, ...values);
  }) as Sql;
  spyFn.query = async <T = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<T[]> => {
    queries.push({ text, params });
    return sql.query<T>(text, params);
  };
  const spySql: Sql = spyFn;
  return {
    spySql,
    queries,
    reset: () => {
      queries.length = 0;
    },
  };
}

function createMemoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear() {
      data.clear();
    },
    getItem(key: string) {
      return data.has(key) ? data.get(key)! : null;
    },
    key(index: number) {
      return Array.from(data.keys())[index] ?? null;
    },
    removeItem(key: string) {
      data.delete(key);
    },
    setItem(key: string, value: string) {
      data.set(key, String(value));
    },
  };
}

function makeTestAnime(
  id: string,
  overrides: Partial<LocalAnime> = {},
): LocalAnime {
  return {
    id,
    titleRomaji: `Anime ${id}`,
    titleEnglish: `Anime EN ${id}`,
    titleNative: `アニメ ${id}`,
    cover: "https://example.com/cover.jpg",
    banner: "https://example.com/banner.jpg",
    synopsis: "Sinopse de teste",
    score: 8.5,
    format: "TV",
    status: "RELEASING",
    episodesCount: 12,
    season: "SPRING",
    year: 2024,
    trailerId: null,
    hidden: false,
    genres: ["Action"],
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
            videoUrl: "https://cdn.example.com/1.mp4",
            published: true,
          },
          {
            id: `ep-${id}-2`,
            number: 2,
            title: "Episódio 2",
            published: false,
          },
        ],
      },
    ],
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    ...overrides,
  };
}

describe(`Bloco 2 — Otimizações A2, A3 e A4 (${dbSource})`, () => {
  const runId = Date.now();
  const animeIds = [
    `perf-anime-1-${runId}`,
    `perf-anime-2-${runId}`,
    `perf-anime-3-${runId}`,
  ];
  const anilistId1 = 910000 + (runId % 50000);
  const kitsuId2 = 810000 + (runId % 50000);
  const userIds = [
    `perf-user-1-${runId}`,
    `perf-user-2-${runId}`,
    `perf-admin-1-${runId}`,
  ];
  const seasonIds = animeIds;
  const episodeIds = [`perf-ep-1-${runId}`, `perf-ep-2-${runId}`];
  const commentIds = [
    `perf-cmt-1-${runId}`,
    `perf-cmt-2-${runId}`,
    `perf-cmt-3-${runId}`,
    `perf-cmt-4-${runId}`,
  ];
  const settingKeys = [
    `perf_unrelated_${runId}`,
    buildActiveBanKey(userIds[0]),
  ];

  before(async () => {
    const sql = await getSql();

    // Usuários e perfis
    await sql.query(
      `INSERT INTO "user" ("id", "name", "email", "emailVerified", "image", "createdAt", "updatedAt")
       VALUES
         ($1, 'Usuário A234', $4, true, 'https://cdn.example.com/avatar-u1.png', '2026-01-01T10:00:00Z', '2026-02-01T10:00:00Z'),
         ($2, 'Segundo Usuário', $5, true, NULL, '2026-01-02T10:00:00Z', '2026-02-02T10:00:00Z'),
         ($3, 'Admin Teste', $6, true, NULL, '2026-01-03T10:00:00Z', '2026-02-03T10:00:00Z')
       ON CONFLICT ("id") DO NOTHING;`,
      [
        userIds[0],
        userIds[1],
        userIds[2],
        `u1-${runId}@example.com`,
        `u2-${runId}@example.com`,
        `admin-${runId}@example.com`,
      ],
    );

    await sql.query(
      `INSERT INTO "profile" ("userId", "nick", "displayName", "avatarUrl", "role", "createdAt", "updatedAt")
       VALUES
         ($1, 'nick_alpha', 'Alpha Reviewer', 'https://cdn.example.com/avatar-alpha.png', 'user', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
         ($2, 'nick_beta', 'Beta Reviewer', NULL, 'user', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
         ($3, 'nick_admin', 'Admin Reviewer', NULL, 'admin', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT ("userId") DO NOTHING;`,
      [userIds[0], userIds[1], userIds[2]],
    );

    // Animes no catálogo
    await sql.query(
      `INSERT INTO "catalog_anime"
        ("id", "title", "anilistId", "kitsuId", "titleRomaji", "titleEnglish", "cover", "banner", "format", "status", "year", "hidden", "createdAt", "updatedAt")
       VALUES
         ($1, 'Solo Leveling Perf', $4, NULL, 'Ore dake Level Up na Ken', 'Solo Leveling', 'https://s4.anilist.co/cover-1.jpg', 'https://s4.anilist.co/banner-1.jpg', 'TV', 'FINISHED', 2024, false, '2026-01-05T00:00:00Z', '2026-03-01T12:00:00Z'),
         ($2, 'Frieren Perf', NULL, $5, 'Sousou no Frieren', 'Frieren Beyond Journey', 'https://cdn.example.com/cover-2.jpg', NULL, 'TV', 'FINISHED', 2023, false, '2026-01-06T00:00:00Z', '2026-03-05T12:00:00Z'),
         ($3, 'Hidden Film Perf', NULL, NULL, 'Hidden Film', 'Hidden Film EN', 'blob:https://invalid.local/123', NULL, 'MOVIE', 'FINISHED', 2025, true, '2026-01-07T00:00:00Z', '2026-03-10T12:00:00Z')
       ON CONFLICT ("id") DO NOTHING;`,
      [animeIds[0], animeIds[1], animeIds[2], anilistId1, kitsuId2],
    );

    // Temporadas
    await sql.query(
      `INSERT INTO "catalog_season" ("animeId", "number", "title", "position")
       VALUES ($1, 1, 'Temporada 1', 1), ($2, 1, 'Temporada 1', 1)
       ON CONFLICT ("animeId", "number") DO NOTHING;`,
      [seasonIds[0], seasonIds[1]],
    );

    // Episódios com thumbnails
    await sql.query(
      `INSERT INTO "catalog_episode"
        ("id", "animeId", "seasonNumber", "number", "title", "thumbnail", "videoUrl", "published", "createdAt", "updatedAt")
       VALUES
         ($1, $3, 1, 1, 'Arise Ep', 'https://cdn.example.com/thumb-1.jpg', 'https://cdn.example.com/v1.mp4', true, '2026-02-01T00:00:00Z', '2026-03-08T10:00:00Z'),
         ($2, $4, 1, 2, 'Zoltraak Ep', 'https://cdn.example.com/thumb-2.jpg', NULL, false, '2026-02-02T00:00:00Z', '2026-03-02T10:00:00Z')
       ON CONFLICT ("id") DO NOTHING;`,
      [episodeIds[0], episodeIds[1], animeIds[0], animeIds[1]],
    );

    // Comentários (raiz, resposta, spoiler, por anilistId numérico, kitsuId numérico e id string)
    await sql.query(
      `INSERT INTO "comment"
        ("id", "userId", "animeId", "episodeId", "content", "parentId", "isSpoiler", "createdAt", "updatedAt")
       VALUES
         ($1, $5, $8, 'ep-1', 'Excelente animação neste episódio!', NULL, false, '2026-03-01T10:00:00Z', '2026-03-01T10:00:00Z'),
         ($2, $6, $9, 'ep-2', 'Spoiler gigante do mangá aqui', NULL, true, '2026-03-02T10:00:00Z', '2026-03-02T10:00:00Z'),
         ($3, $5, $10, 'ep-3', 'Concordo demais com a cena final', $1, false, '2026-03-03T10:00:00Z', '2026-03-03T10:00:00Z'),
         ($4, $7, $8, 'ep-4', 'Comentário do admin moderador', NULL, false, '2026-03-04T10:00:00Z', '2026-03-04T10:00:00Z')
       ON CONFLICT ("id") DO NOTHING;`,
      [
        commentIds[0],
        commentIds[1],
        commentIds[2],
        commentIds[3],
        userIds[0],
        userIds[1],
        userIds[2],
        String(anilistId1),
        String(kitsuId2),
        animeIds[0],
      ],
    );

    // Curtidas / dislikes
    await sql.query(
      `INSERT INTO "comment_like" ("id", "commentId", "userId", "type")
       VALUES
         ($1, $4, $6, 'like'),
         ($2, $4, $7, 'dislike'),
         ($3, $5, $6, 'like')
       ON CONFLICT ("commentId", "userId") DO NOTHING;`,
      [
        `like-1-${runId}`,
        `like-2-${runId}`,
        `like-3-${runId}`,
        commentIds[0],
        commentIds[1],
        userIds[1],
        userIds[2],
      ],
    );

    // Denúncias (pendentes + resolvida)
    await sql.query(
      `INSERT INTO "comment_report" ("id", "commentId", "userId", "reason", "status", "createdAt")
       VALUES
         ($1, $4, $6, 'spoiler', 'pending', '2026-03-05T08:00:00Z'),
         ($2, $5, $6, 'spam', 'pending', '2026-03-06T09:00:00Z'),
         ($3, $4, $7, 'other', 'resolved', '2026-03-04T07:00:00Z')
       ON CONFLICT ("commentId", "userId") DO NOTHING;`,
      [
        `rep-1-${runId}`,
        `rep-2-${runId}`,
        `rep-3-${runId}`,
        commentIds[1],
        commentIds[0],
        userIds[2],
        userIds[1],
      ],
    );

    // Banimento ativo para userIds[0] e setting não relacionado
    await applyTemporaryUserBan(sql, {
      targetUserId: userIds[0],
      preset: "24h",
      reason: "Teste A4 banimento ativo",
      actorId: userIds[2],
      nowMs: Date.now(),
    });
    await sql.query(
      `INSERT INTO "admin_settings" ("key", "value", "createdAt", "updatedAt")
       VALUES ($1, '"ignored-value"', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT ("key") DO NOTHING;`,
      [settingKeys[0]],
    );
  });

  after(async () => {
    const sql = await getSql();
    await sql.query(`DELETE FROM "comment_report" WHERE "commentId" = ANY($1::text[]);`, [commentIds]);
    await sql.query(`DELETE FROM "comment_like" WHERE "commentId" = ANY($1::text[]);`, [commentIds]);
    await sql.query(`DELETE FROM "comment" WHERE "id" = ANY($1::text[]);`, [commentIds]);
    await sql.query(`DELETE FROM "catalog_episode" WHERE "id" = ANY($1::text[]);`, [episodeIds]);
    await sql.query(`DELETE FROM "catalog_season" WHERE "animeId" = ANY($1::text[]);`, [animeIds]);
    await sql.query(`DELETE FROM "catalog_anime" WHERE "id" = ANY($1::text[]);`, [animeIds]);
    await sql.query(`DELETE FROM "admin_settings" WHERE "key" = ANY($1::text[]) OR "key" LIKE 'comment_ban_log:%';`, [settingKeys]);
    await sql.query(`DELETE FROM "profile" WHERE "userId" = ANY($1::text[]);`, [userIds]);
    await sql.query(`DELETE FROM "user" WHERE "id" = ANY($1::text[]);`, [userIds]);
    invalidateAdminDashboardCache("all");
  });

  it("A2.1 — fetchAdminSystemStatusFromDb elimina SELECT 1 e consolida contagens em 3 queries paralelas", async () => {
    const sql = await getSql();
    const { spySql, queries } = createSqlSpy(sql);

    const status = await fetchAdminSystemStatusFromDb(spySql, dbSource);

    assert.equal(status.connected, true);
    assert.equal(status.dbSource, dbSource);
    assert.equal(
      queries.length,
      3,
      `Esperava exatamente 3 queries paralelas (counts + activeBans + maintenanceKeys), recebeu ${queries.length}`,
    );
    assert.equal(
      queries.some((q) => /SELECT\s+1\b/i.test(q.text)),
      false,
      "Não deve executar SELECT 1 ping separado",
    );
    assert.ok(
      (status.serverAnimesCount ?? 0) >= 3,
      "Deve contar animes do catálogo",
    );
    assert.ok(
      (status.serverEpisodesCount ?? 0) >= 2,
      "Deve contar episódios totais",
    );
    assert.ok(
      (status.serverPublishedEpisodesCount ?? 0) >= 1,
      "Deve contar episódios publicados",
    );
    assert.ok(
      (status.serverSeasonsCount ?? 0) >= 2,
      "Deve contar temporadas",
    );
    assert.ok((status.serverUsersCount ?? 0) >= 3, "Deve contar usuários");
    assert.ok((status.serverAdminsCount ?? 0) >= 1, "Deve contar admins");
    assert.ok(
      (status.serverPendingReportsCount ?? 0) >= 2,
      "Deve contar denúncias pendentes",
    );
    assert.ok(
      (status.serverCommentsCount ?? 0) >= 4,
      "Deve contar comentários",
    );
    assert.ok(
      (status.serverActiveBansCount ?? 0) >= 1,
      "Deve contar bans ativos",
    );
    const settingsQuery = queries.find((q) =>
      q.text.includes('"admin_settings"') && q.text.includes("ANY($1::text[])"),
    );
    assert.ok(
      settingsQuery,
      "Deve consultar apenas as 3 chaves de manutenção via ANY($1::text[])",
    );
  });

  it("A2.2 — fetchAdminCatalogSyncMetaFromDb aplica LIMIT, filtro incremental, escopo por IDs e evita carregar badges desnecessários", async () => {
    const sql = await getSql();
    const { spySql, queries, reset } = createSqlSpy(sql);

    // 1. Escopo vazio deve retornar [] com 0 queries SQL
    const emptyScoped = await fetchAdminCatalogSyncMetaFromDb(spySql, {
      ids: [],
      anilistIds: [],
    });
    assert.deepEqual(emptyScoped, []);
    assert.equal(queries.length, 0);

    // 2. Escopo específico com includeBadges: false e limit
    reset();
    const scopedRows = await fetchAdminCatalogSyncMetaFromDb(spySql, {
      ids: [animeIds[0]],
      anilistIds: [anilistId1],
      limit: 10,
    });
    assert.equal(scopedRows.length, 1);
    assert.equal(scopedRows[0]?.id, animeIds[0]);
    assert.equal(queries.length, 1);
    assert.ok(queries[0]!.text.includes("LIMIT $"));

    // 3. Filtro incremental sinceUpdatedAt futuro -> retorna [] sem carregar badges
    reset();
    const futureRows = await fetchAdminCatalogSyncMetaFromDb(spySql, {
      sinceUpdatedAt: Date.UTC(2035, 0, 1),
      limit: 50,
    });
    assert.deepEqual(futureRows, []);
    assert.equal(queries.length, 1);
    assert.ok(queries[0]!.text.includes('"updatedAt" > to_timestamp('));
  });

  it("A2.3 — Cache cliente (TTL + singleflight + sync incremental + invalidateAdminDashboardCache) evita requisições duplicadas ao retornar à Central", async () => {
    invalidateAdminDashboardCache("all");

    let statusCalls = 0;
    const statusFetcher = async (): Promise<AdminSystemStatus> => {
      statusCalls += 1;
      await new Promise((r) => setTimeout(r, 10));
      return {
        connected: true,
        dbSource: "pglite",
        checkedAt: Date.now(),
        serverAnimesCount: 42,
      };
    };

    // Singleflight: 3 chamadas simultâneas -> apenas 1 requisição
    const [r1, r2, r3] = await Promise.all([
      loadAdminSystemStatusCached({ fetcher: statusFetcher }),
      loadAdminSystemStatusCached({ fetcher: statusFetcher }),
      loadAdminSystemStatusCached({ fetcher: statusFetcher }),
    ]);
    assert.equal(statusCalls, 1);
    assert.equal(r1.serverAnimesCount, 42);
    assert.equal(r2.serverAnimesCount, 42);
    assert.equal(r3.serverAnimesCount, 42);
    assert.ok(getCachedAdminSystemStatus() !== null);

    // Retorno subsequente dentro do TTL -> 0 novas requisições
    const r4 = await loadAdminSystemStatusCached({ fetcher: statusFetcher });
    assert.equal(statusCalls, 1);
    assert.equal(r4.serverAnimesCount, 42);

    // Invalidação ou force=true dispara nova requisição
    invalidateAdminDashboardCache("status");
    assert.equal(getCachedAdminSystemStatus(), null);
    await loadAdminSystemStatusCached({ fetcher: statusFetcher });
    assert.equal(statusCalls, 2);

    // Teste do syncAdminCatalogMetaCached com upsertAnimesBatch
    const prevAnimes = useHikariStore.getState().animes;
    try {
      const a1 = makeTestAnime(animeIds[0], {
        cover: "https://old.example.com/1.jpg",
        updatedAt: 1000,
      });
      const a2 = makeTestAnime(animeIds[1], {
        cover: "https://old.example.com/2.jpg",
        updatedAt: 1000,
      });
      useHikariStore.setState({ animes: [a1, a2], hydrated: true });

      let metaCalls = 0;
      const seenInputs: unknown[] = [];
      const metaFetcher = async (
        input: unknown,
      ): Promise<AdminCatalogSyncMetaItem[]> => {
        metaCalls += 1;
        seenInputs.push(input);
        return [
          {
            id: animeIds[0],
            anilistId: null,
            malId: null,
            kitsuId: null,
            cover: "https://new.example.com/1.jpg",
            banner: null,
            title: "Solo Leveling Perf",
            titleRomaji: null,
            titleEnglish: null,
            titleNative: null,
            hidden: false,
            updatedAt: 5000,
          },
          {
            id: animeIds[1],
            anilistId: null,
            malId: null,
            kitsuId: null,
            cover: "https://new.example.com/2.jpg",
            banner: null,
            title: "Frieren Perf",
            titleRomaji: null,
            titleEnglish: null,
            titleNative: null,
            hidden: false,
            updatedAt: 6000,
          },
        ];
      };

      const sync1 = await syncAdminCatalogMetaCached({ fetcher: metaFetcher });
      assert.equal(metaCalls, 1);
      assert.equal(sync1.skipped, false);
      assert.equal(sync1.updatedCount, 2);
      assert.equal(
        useHikariStore.getState().animes[0]?.cover,
        "https://new.example.com/1.jpg",
      );
      assert.equal(
        useHikariStore.getState().animes[1]?.cover,
        "https://new.example.com/2.jpg",
      );

      // Revisita dentro do TTL -> skipped=true, 0 chamadas
      const sync2 = await syncAdminCatalogMetaCached({ fetcher: metaFetcher });
      assert.equal(metaCalls, 1);
      assert.equal(sync2.skipped, true);
      assert.equal(seenInputs.length, 1);
    } finally {
      useHikariStore.setState({ animes: prevAnimes });
      invalidateAdminDashboardCache("all");
    }
  });

  it("A2.4 — upsertAnimesBatch clona catálogo apenas 1 vez, evita re-serialização redundante no storage e preserva Outbox", async () => {
    const prevWindow = (globalThis as { window?: unknown }).window;
    const prevDocument = (globalThis as { document?: unknown }).document;
    const storage = createMemoryStorage();
    (globalThis as { window: unknown }).window = { localStorage: storage };
    (globalThis as { document: unknown }).document = { visibilityState: "visible" };

    const prevAnimes = useHikariStore.getState().animes;
    try {
      const initial = Array.from({ length: 15 }, (_, idx) =>
        makeTestAnime(`batch-${idx}`, { updatedAt: 1000 }),
      );
      useHikariStore.setState({ animes: initial, hydrated: true });
      markCatalogPersistedRef(initial);

      // Conta notificações do Zustand para atualização em lote de 10 itens
      let subscriberNotifications = 0;
      const unsub = useHikariStore.subscribe(() => {
        subscriberNotifications += 1;
      });

      const updates = initial.slice(0, 10).map((a, idx) => ({
        ...a,
        titleEnglish: `Updated Batch ${idx}`,
        updatedAt: 2000 + idx,
      }));
      // Inclui também um anime novo e uma atualização duplicada no mesmo lote
      updates.push(makeTestAnime("batch-new-99", { updatedAt: 9999 }));
      updates.push({
        ...initial[0]!,
        titleEnglish: "Updated Batch 0 Final",
        updatedAt: 3000,
      });

      useHikariStore.getState().upsertAnimesBatch(updates);
      unsub();

      assert.equal(
        subscriberNotifications,
        1,
        "upsertAnimesBatch deve emitir apenas 1 atualização de estado do Zustand",
      );
      const afterBatch = useHikariStore.getState().animes;
      assert.equal(afterBatch.length, 16);
      assert.equal(
        afterBatch.find((a) => a.id === "batch-0")?.titleEnglish,
        "Updated Batch 0 Final",
      );
      assert.equal(
        afterBatch.find((a) => a.id === "batch-new-99")?.updatedAt,
        9999,
      );

      // Simula o subscriber do browser que agenda persistência após atualização do store
      scheduleSave(afterBatch);

      // Flush grava no fallback (localStorage) quando IndexedDB não está disponível
      await flushAnimes();
      const persistedRaw = storage.getItem("hikari-catalog-fallback-v1");
      assert.ok(persistedRaw, "Fallback deve conter catálogo após flushAnimes");

      // Remover chave para confirmar que flushAnimes seguinte (sem pendências) e scheduleSave com mesma ref NÃO regravam
      storage.removeItem("hikari-catalog-fallback-v1");
      markCatalogPersistedRef(afterBatch);
      scheduleSave(afterBatch);
      await flushAnimes();
      assert.equal(
        storage.getItem("hikari-catalog-fallback-v1"),
        null,
        "Não deve re-serializar catálogo quando referência não mudou e não há pendências",
      );

      // Outbox permanece íntegro e funcional
      const ops: OutboxOperation[] = [
        {
          id: "op-a2-1",
          type: "upsert",
          episodeId: "ep-batch-0-1",
          animeId: "batch-0",
          seasonNumber: 1,
          episodeNumber: 1,
          status: "pending",
          createdAt: Date.now(),
          attempts: 0,
        },
      ];
      writeOutbox(ops);
      const readBack = readOutbox();
      assert.equal(readBack.length, 1);
      assert.equal(readBack[0]?.id, "op-a2-1");
      assert.ok(storage.getItem(OUTBOX_STORAGE_KEY));
    } finally {
      useHikariStore.setState({ animes: prevAnimes });
      if (prevWindow === undefined) {
        delete (globalThis as { window?: unknown }).window;
      } else {
        (globalThis as { window?: unknown }).window = prevWindow;
      }
      if (prevDocument === undefined) {
        delete (globalThis as { document?: unknown }).document;
      } else {
        (globalThis as { document?: unknown }).document = prevDocument;
      }
    }
  });

  it("A2.5 — buildAdminCatalogIndex e filterAndSortAdminCatalog pré-computam estatísticas, top 6 recentes, filtros e ordenação", () => {
    const list: LocalAnime[] = Array.from({ length: 10 }, (_, idx) =>
      makeTestAnime(`idx-${idx}`, {
        titleRomaji: idx === 3 ? "Naruto Dublado" : `Title ${String(9 - idx).padStart(2, "0")}`,
        titleEnglish: idx === 3 ? "Naruto Dublado" : `Title EN ${idx}`,
        anilistId: idx % 2 === 0 ? 1000 + idx : undefined,
        hidden: idx >= 8,
        format: idx === 9 ? "MOVIE" : "TV",
        status: idx === 9 ? "FINISHED" : "RELEASING",
        year: 2015 + idx,
        updatedAt: 1000 * (idx + 1),
      }),
    );

    const index = buildAdminCatalogIndex(list);
    assert.equal(index.stats.totalAnimes, 10);
    assert.equal(index.stats.visibleAnimes, 8);
    assert.equal(index.stats.hiddenAnimes, 2);
    assert.equal(index.stats.dubbedAnimes, 1);
    assert.equal(index.stats.anilistLinkedAnimes, 5);
    assert.equal(index.stats.totalSeasons, 10);
    assert.equal(index.stats.totalEpisodes, 20);
    assert.equal(index.stats.totalPublishedEpisodes, 10);
    assert.deepEqual(index.availableFormats, ["MOVIE", "TV"]);
    assert.deepEqual(index.availableStatuses, ["FINISHED", "RELEASING"]);

    // Top 6 recentes sem ordenar o catálogo inteiro
    assert.equal(index.topRecentAnimes.length, 6);
    assert.deepEqual(
      index.topRecentAnimes.map((a) => a.id),
      ["idx-9", "idx-8", "idx-7", "idx-6", "idx-5", "idx-4"],
    );

    // Filtro por versão dublada + busca textual
    const dubbed = filterAndSortAdminCatalog(list, index.metaById, {
      q: "naruto",
      visibilityFilter: "all",
      formatFilter: "all",
      statusFilter: "all",
      versionFilter: "dubbed",
      sortBy: "updated-desc",
    });
    assert.equal(dubbed.length, 1);
    assert.equal(dubbed[0]?.id, "idx-3");

    // Filtro por ocultos + formato MOVIE
    const hiddenMovies = filterAndSortAdminCatalog(list, index.metaById, {
      q: "",
      visibilityFilter: "hidden",
      formatFilter: "MOVIE",
      statusFilter: "all",
      versionFilter: "all",
      sortBy: "year-desc",
    });
    assert.equal(hiddenMovies.length, 1);
    assert.equal(hiddenMovies[0]?.id, "idx-9");
  });

  it("A3 — queryAdminImagesFromDb elimina countSql sem busca, usa COUNT(*) OVER() com busca e evita ::text no ORDER BY", async () => {
    const sql = await getSql();
    const { spySql, queries, reset } = createSqlSpy(sql);

    // 1. Sem busca -> apenas 2 queries (stats + dados paginados) e zero ::text no updatedAt
    const allRes = await queryAdminImagesFromDb(spySql, {
      typeParam: "all",
      search: "",
      page: 1,
      limit: 24,
    });

    assert.equal(
      queries.length,
      2,
      `Esperava 2 queries sem busca (stats + lista), recebeu ${queries.length}`,
    );
    for (const q of queries) {
      assert.equal(
        /"updatedAt"::text/i.test(q.text),
        false,
        "Não deve converter updatedAt para ::text antes do ORDER BY",
      );
    }
    assert.ok(allRes.stats.totalCovers >= 3);
    assert.ok(allRes.stats.totalBanners >= 1);
    assert.ok(allRes.stats.totalThumbnails >= 2);
    assert.ok(allRes.stats.totalAvatars >= 1);
    assert.equal(
      allRes.pagination.total,
      allRes.stats.totalAll,
    );

    // Verificar ordenação decrescente real por updatedAt
    const timestamps = allRes.images.map((i) => new Date(i.updatedAt).getTime());
    for (let i = 1; i < timestamps.length; i++) {
      assert.ok(
        timestamps[i - 1]! >= timestamps[i]!,
        "Imagens devem estar ordenadas por updatedAt DESC nativo",
      );
    }

    // Verificar detecção de provedor e URL blob inválida
    const blobImg = allRes.images.find((i) => i.entityId === animeIds[2]);
    assert.ok(blobImg);
    assert.equal(blobImg.isBlobOrInvalid, true);

    const anilistImg = allRes.images.find((i) => i.entityId === animeIds[0] && i.type === "cover");
    assert.ok(anilistImg);
    assert.equal(anilistImg.provider, "anilist");

    // 2. Filtro por tipo específico (sem busca)
    reset();
    const thumbsRes = await queryAdminImagesFromDb(spySql, {
      typeParam: "thumbnail",
      search: "",
      page: 1,
      limit: 10,
    });
    assert.equal(queries.length, 2);
    assert.equal(thumbsRes.pagination.total, thumbsRes.stats.totalThumbnails);
    assert.ok(thumbsRes.images.every((i) => i.type === "thumbnail"));

    // 3. Página além do total sem busca -> pula a query de listagem (apenas 1 query de stats)
    reset();
    const outOfRangeRes = await queryAdminImagesFromDb(spySql, {
      typeParam: "banner",
      search: "",
      page: 999,
      limit: 24,
    });
    assert.equal(queries.length, 1);
    assert.equal(outOfRangeRes.images.length, 0);

    // 4. Com busca -> usa CTE + COUNT(*) OVER() em 2 queries totais (stats + search CTE)
    reset();
    const searchRes = await queryAdminImagesFromDb(spySql, {
      typeParam: "all",
      search: "zoltraak",
      page: 1,
      limit: 24,
    });
    assert.equal(queries.length, 2);
    assert.ok(
      queries[1]!.text.includes("COUNT(*) OVER()"),
      "Busca deve usar COUNT(*) OVER() em CTE única",
    );
    assert.ok(searchRes.images.some((i) => i.subTitle?.includes("Zoltraak Ep")));
    assert.equal(searchRes.pagination.total, searchRes.images.length);
  });

  it("A4 — queryAdminCommentsFromDb remove LATERAL/::text, consolida stats, resolve animes em lote e preserva filtros/ordenação/bans", async () => {
    const sql = await getSql();
    const { spySql, queries, reset } = createSqlSpy(sql);

    // 1. Listagem padrão (all) sem busca
    const allRes = await queryAdminCommentsFromDb(spySql, {
      filter: "all",
      search: "",
      page: 1,
      limit: 20,
    });

    assert.ok(queries.length <= 4, `Esperava <= 4 queries (bans + stats + paged + batch anime), recebeu ${queries.length}`);
    for (const q of queries) {
      assert.equal(/\bLATERAL\b/i.test(q.text), false, "SQL não deve conter LATERAL");
      assert.equal(/"anilistId"::text/i.test(q.text), false, "SQL não deve conter anilistId::text");
      assert.equal(/"kitsuId"::text/i.test(q.text), false, "SQL não deve conter kitsuId::text");
    }

    assert.ok(allRes.summary.totalComments >= 4);
    assert.ok(allRes.summary.pendingReports >= 2);
    assert.ok(allRes.summary.spoilersCount >= 1);
    assert.ok(allRes.summary.activeBansCount >= 1);

    // Comentário com anilistId e comentário com kitsuId devem ter animeTitle resolvido em lote
    const c1 = allRes.comments.find((c) => c.id === commentIds[0]);
    const c2 = allRes.comments.find((c) => c.id === commentIds[1]);
    const c3 = allRes.comments.find((c) => c.id === commentIds[2]);
    assert.ok(c1);
    assert.equal(c1.animeTitle, "Solo Leveling Perf");
    assert.equal(c1.likesCount, 1);
    assert.equal(c1.dislikesCount, 1);
    assert.equal(c1.repliesCount, 1);
    assert.ok(c1.authorActiveBan !== null, "Autor banido deve trazer authorActiveBan");

    assert.ok(c2);
    assert.equal(c2.animeTitle, "Frieren Perf");
    assert.equal(c2.isSpoiler, true);
    assert.equal(c2.pendingReportCount, 1);
    assert.equal(c2.totalReportCount, 2);

    assert.ok(c3);
    assert.equal(c3.animeTitle, "Solo Leveling Perf");
    assert.equal(c3.parentId, commentIds[0]);

    // 2. Filtro pending_reports ordena por firstReportedAt DESC
    reset();
    const reportedRes = await queryAdminCommentsFromDb(spySql, {
      filter: "pending_reports",
      page: 1,
      limit: 15,
    });
    const idxC1 = reportedRes.comments.findIndex((c) => c.id === commentIds[0]);
    const idxC2 = reportedRes.comments.findIndex((c) => c.id === commentIds[1]);
    assert.ok(idxC1 !== -1 && idxC2 !== -1);
    assert.ok(
      idxC1 < idxC2,
      "c1 denunciado mais recentemente (06/03) deve vir antes de c2 (05/03)",
    );

    // 3. Busca pelo título do anime resolve animeIds em lote sem LATERAL
    reset();
    const searchAnimeRes = await queryAdminCommentsFromDb(spySql, {
      filter: "all",
      search: "Frieren Beyond Journey",
      page: 1,
      limit: 15,
    });
    assert.ok(searchAnimeRes.comments.some((c) => c.id === commentIds[1]));
    for (const q of queries) {
      assert.equal(/\bLATERAL\b/i.test(q.text), false);
      assert.equal(/"anilistId"::text/i.test(q.text), false);
    }

    // 4. Filtro spoilers + busca por nick do autor
    reset();
    const spoilerRes = await queryAdminCommentsFromDb(spySql, {
      filter: "spoilers",
      search: "nick_beta",
      page: 1,
      limit: 15,
    });
    assert.equal(spoilerRes.comments.length, 1);
    assert.equal(spoilerRes.comments[0]?.id, commentIds[1]);
  });
});
