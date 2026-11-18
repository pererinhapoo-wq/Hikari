import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pendingMigrations } from "../../scripts/migration-plan.mjs";
import { isAuthorizedAdminAccount } from "./auth/admin-guard";
import {
  ANILIST_SYNC_STATUS_KEY,
  AniListSyncConflictError,
  getAniListSyncStatus,
  startAniListSync,
  stepAniListSync,
  waitForActiveAniListSync,
  type AniListSyncDeps,
  type SyncPool,
  type SyncPoolClient,
} from "./anilist-sync.server";

async function createTestPgliteContext() {
  const { pg_trgm } = await import("@electric-sql/pglite/contrib/pg_trgm");
  const pg = new PGlite({ extensions: { pg_trgm } });
  await pg.waitReady;
  await pg.exec(
    "CREATE TABLE IF NOT EXISTS _migrations (name text primary key, applied_at timestamptz not null default now());",
  );

  const migrationsDir = path.join(process.cwd(), "migrations");
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"));

  for (const { name } of pendingMigrations(files, [])) {
    const sqlText = fs.readFileSync(path.join(migrationsDir, name), "utf8");
    await pg.transaction(async (tx) => {
      await tx.exec(sqlText);
      await tx.query("INSERT INTO _migrations (name) VALUES ($1);", [name]);
    });
  }

  let lockHeld = false;
  let lockBusy = false;

  const client: SyncPoolClient = {
    async query<T = Record<string, unknown>>(sqlText: string, params: unknown[] = []) {
      const normalized = sqlText.replace(/\s+/g, " ").trim();
      if (normalized.startsWith("SELECT pg_try_advisory_lock")) {
        if (lockBusy || lockHeld) {
          return { rows: [{ locked: false } as T] };
        }
        lockHeld = true;
        return { rows: [{ locked: true } as T] };
      }
      if (normalized.startsWith("SELECT pg_advisory_unlock")) {
        lockHeld = false;
        return { rows: [{ pg_advisory_unlock: true } as T] };
      }
      const res = await pg.query<T>(sqlText, params);
      return { rows: res.rows };
    },
    release() {},
  };

  const pool: SyncPool = {
    async connect() {
      return client;
    },
    async end() {},
  };

  return {
    pg,
    pool,
    setLockBusy(busy: boolean) {
      lockBusy = busy;
    },
    isLockHeld() {
      return lockHeld;
    },
  };
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify({ data }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function makeMedia(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    idMal: id + 5000,
    updatedAt: 1700100000,
    title: {
      romaji: `Romaji ${id}`,
      english: `English ${id}`,
      native: `ネイティブ ${id}`,
    },
    coverImage: {
      extraLarge: `https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx${id}.jpg`,
      large: `https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx${id}.jpg`,
    },
    bannerImage: `https://s4.anilist.co/file/anilistcdn/media/anime/banner/${id}.jpg`,
    description: `<p>Descrição AniList ${id}</p>`,
    format: "TV",
    status: "RELEASING",
    episodes: 12,
    season: "FALL",
    seasonYear: 2026,
    averageScore: 85,
    popularity: 50000 + id,
    trending: 1000 + id,
    genres: ["Action"],
    trailer: { id: `tr-${id}`, site: "youtube", thumbnail: null },
    ...overrides,
  };
}

describe("Controle Administrativo da Sincronização AniList", () => {
  it("1. Bloqueia usuário não administrador, visitante e conta dev-user (401/403)", async () => {
    assert.equal(
      await isAuthorizedAdminAccount({
        userId: null,
        email: null,
      }),
      false,
    );
    assert.equal(
      await isAuthorizedAdminAccount({
        userId: "user-common-1",
        email: "viewer@hikari.app",
        profileRole: "user",
      }),
      false,
    );
    assert.equal(
      await isAuthorizedAdminAccount({
        userId: "dev-user",
        email: "dev@example.com",
        profileRole: "admin",
      }),
      false,
    );
    assert.equal(
      await isAuthorizedAdminAccount({
        userId: "admin-real-1",
        email: "mod@hikari.app",
        profileRole: "admin",
      }),
      true,
    );

    const routeSource = fs.readFileSync(
      path.join(process.cwd(), "src/routes/api/admin/anilist-sync.ts"),
      "utf8",
    );
    const fnSource = fs.readFileSync(
      path.join(process.cwd(), "src/lib/anilist-sync.functions.ts"),
      "utf8",
    );
    assert.ok(routeSource.includes("requireAdminUser"));
    assert.ok(routeSource.includes("assertSameSiteRequest"));
    assert.ok(fnSource.includes("adminMiddleware"));
  });

  it("2. Administrador inicia execução sem travar requisição HTTP e persiste status + última execução", async () => {
    const db = await createTestPgliteContext();
    await db.pg.query(
      `INSERT INTO "admin_settings" ("key", "value") VALUES
       ('anilist_sync_initial_completed', 'true'),
       ('anilist_sync_frequency', '"2_per_week"');`,
    );

    let releaseFetch!: () => void;
    const fetchGate = new Promise<void>((resolve) => {
      releaseFetch = resolve;
    });

    const deps: AniListSyncDeps = {
      pool: db.pool,
      executionMode: "background",
      rateLimitDelayMs: 0,
      retries: 1,
      now: () => new Date("2026-11-18T15:00:00Z"),
      incrementalLimits: {
        incrementalPages: 1,
        trendingPages: 1,
        popularPages: 1,
        seasonPages: 1,
        schedulePages: 1,
      },
      fetchImpl: async (_url, init) => {
        await fetchGate;
        const { query } = JSON.parse(String(init?.body || "{}"));
        if (query.includes("AiringScheduleQuery")) {
          return jsonResponse({ Page: { pageInfo: { hasNextPage: false }, airingSchedules: [] } });
        }
        return jsonResponse({
          Page: { pageInfo: { hasNextPage: false }, media: [makeMedia(910)] },
        });
      },
    };

    try {
      const startRes = await startAniListSync({ adminId: "admin-1" }, deps);
      assert.equal(startRes.accepted, true);
      assert.equal(startRes.snapshot.status, "running");
      assert.equal(startRes.snapshot.frequency, "2_per_week");

      // Segunda execução simultânea deve ser bloqueada (409)
      await assert.rejects(
        () => startAniListSync({ adminId: "admin-2" }, deps),
        (err: unknown) => err instanceof AniListSyncConflictError && err.status === 409,
      );

      // Libera AniList mock e aguarda término do background worker
      releaseFetch();
      await waitForActiveAniListSync();

      const finalSnapshot = await getAniListSyncStatus(deps);
      assert.equal(finalSnapshot.status, "completed");
      assert.equal(finalSnapshot.incomplete, false);
      assert.equal(finalSnapshot.errorMessage, null);
      assert.equal(finalSnapshot.lastSuccessAt, "2026-11-18T15:00:00.000Z");

      const animeRows = (
        await db.pg.query(`SELECT "anilistId" FROM "catalog_anime" WHERE "anilistId" = 910;`)
      ).rows;
      assert.equal(animeRows.length, 1);
    } finally {
      await waitForActiveAniListSync();
      await db.pg.close();
    }
  });

  it("3. Falha na AniList grava status error sem prender em running e preserva checkpoint para retomada", async () => {
    const db = await createTestPgliteContext();
    await db.pg.query(
      `INSERT INTO "admin_settings" ("key", "value") VALUES
       ('anilist_sync_initial_completed', 'true'),
       ('anilist_sync_last_timestamp', '1700000000000');`,
    );

    let failIncrementalPage2 = true;
    const calledPages: number[] = [];

    const deps: AniListSyncDeps = {
      pool: db.pool,
      executionMode: "background",
      rateLimitDelayMs: 0,
      retries: 1,
      now: () => new Date("2026-11-18T16:00:00Z"),
      fetchImpl: async (_url, init) => {
        const { query, variables } = JSON.parse(String(init?.body || "{}"));
        if (query.includes("MediaListQuery") && variables.sort[0] === "UPDATED_AT_DESC") {
          calledPages.push(variables.page);
          if (variables.page === 2 && failIncrementalPage2) {
            return new Response("Service Unavailable", { status: 503 });
          }
          return jsonResponse({
            Page: {
              pageInfo: { hasNextPage: variables.page === 1 },
              media: [makeMedia(920 + variables.page)],
            },
          });
        }
        if (query.includes("AiringScheduleQuery")) {
          return jsonResponse({ Page: { pageInfo: { hasNextPage: false }, airingSchedules: [] } });
        }
        return jsonResponse({ Page: { pageInfo: { hasNextPage: false }, media: [] } });
      },
    };

    try {
      await startAniListSync({ adminId: "admin-1" }, deps);
      await waitForActiveAniListSync();

      const afterErr = await getAniListSyncStatus(deps);
      assert.equal(afterErr.status, "error");
      assert.match(afterErr.errorMessage || "", /503/);
      assert.equal(afterErr.incomplete, true);
      assert.equal(afterErr.checkpoint?.stage, "incremental");
      assert.equal(afterErr.checkpoint?.page, 2);
      assert.ok(afterErr.lastSuccessAt !== null);

      // Corrige erro e retoma a partir da página 2
      calledPages.length = 0;
      failIncrementalPage2 = false;

      await startAniListSync({ adminId: "admin-1" }, deps);
      await waitForActiveAniListSync();

      const afterResume = await getAniListSyncStatus(deps);
      assert.equal(afterResume.status, "completed");
      assert.equal(afterResume.incomplete, false);
      assert.equal(afterResume.checkpoint, null);
      assert.equal(afterResume.errorMessage, null);
      assert.deepEqual(calledPages, [2]);
    } finally {
      await waitForActiveAniListSync();
      await db.pg.close();
    }
  });

  it("4. Modo fatiado (chunked para Vercel) executa por fatias sem timeout e recupera lock órfão", async () => {
    const db = await createTestPgliteContext();
    await db.pg.query(
      `INSERT INTO "admin_settings" ("key", "value") VALUES
       ('anilist_sync_initial_completed', 'true');`,
    );

    const deps: AniListSyncDeps = {
      pool: db.pool,
      executionMode: "chunked",
      timeBudgetMs: 40,
      rateLimitDelayMs: 0,
      retries: 1,
      fetchImpl: async (_url, init) => {
        await new Promise((r) => setTimeout(r, 15));
        const { query, variables } = JSON.parse(String(init?.body || "{}"));
        if (query.includes("MediaListQuery") && variables.sort[0] === "UPDATED_AT_DESC") {
          return jsonResponse({
            Page: {
              pageInfo: { hasNextPage: variables.page < 2 },
              media: [makeMedia(950 + variables.page)],
            },
          });
        }
        if (query.includes("AiringScheduleQuery")) {
          return jsonResponse({ Page: { pageInfo: { hasNextPage: false }, airingSchedules: [] } });
        }
        return jsonResponse({ Page: { pageInfo: { hasNextPage: false }, media: [] } });
      },
    };

    try {
      const startRes = await startAniListSync({ adminId: "admin-1" }, deps);
      assert.equal(startRes.snapshot.executionMode, "chunked");
      assert.equal(startRes.snapshot.status, "running");
      assert.equal(startRes.snapshot.needsStep, true);

      let latest = startRes.snapshot;
      let steps = 0;
      while (latest.status === "running" && steps < 25) {
        steps++;
        latest = await stepAniListSync({ runId: latest.runId }, deps);
      }

      assert.ok(steps >= 2, "Deve executar em múltiplas fatias temporais");
      assert.equal(latest.status, "completed");
      assert.equal(latest.incomplete, false);

      // Simula processo serverless travado ("running" antigo sem lock ativo)
      await db.pg.query(
        `INSERT INTO "admin_settings" ("key", "value")
         VALUES ($1, $2)
         ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value";`,
        [
          ANILIST_SYNC_STATUS_KEY,
          JSON.stringify({
            status: "running",
            runId: "orphan-run",
            mode: "incremental",
            startedAt: "2026-11-18T00:00:00.000Z",
            updatedAt: "2026-11-18T00:00:00.000Z",
            finishedAt: null,
            lastSuccessAt: latest.lastSuccessAt,
            errorMessage: null,
            progress: null,
          }),
        ],
      );

      const healed = await getAniListSyncStatus({
        ...deps,
        staleRunningMs: 1000,
        now: () => new Date("2026-11-18T01:00:00.000Z"),
      });
      assert.equal(healed.status, "error");
      assert.match(healed.errorMessage || "", /interrompida|tempo limite/i);
    } finally {
      await waitForActiveAniListSync();
      await db.pg.close();
    }
  });

  it("5. Preserva manual_fields e garante que navegação pública não chama AniList", async () => {
    const db = await createTestPgliteContext();
    await db.pg.query(
      `INSERT INTO "admin_settings" ("key", "value") VALUES
       ('anilist_sync_initial_completed', 'true');`,
    );
    await db.pg.query(
      `INSERT INTO "catalog_anime" (
         "id", "title", "anilistId", "cover", "manual_fields"
       ) VALUES (
         'anilist-999',
         'Título Editado Manualmente',
         999,
         'https://cdn.hikari.tv/manual-cover.webp',
         ARRAY['title', 'cover']::text[]
       );`,
    );

    const deps: AniListSyncDeps = {
      pool: db.pool,
      executionMode: "background",
      rateLimitDelayMs: 0,
      retries: 1,
      fetchImpl: async (_url, init) => {
        const { query, variables } = JSON.parse(String(init?.body || "{}"));
        if (query.includes("MediaListQuery") && variables.sort[0] === "UPDATED_AT_DESC") {
          return jsonResponse({
            Page: { pageInfo: { hasNextPage: false }, media: [makeMedia(999)] },
          });
        }
        if (query.includes("AiringScheduleQuery")) {
          return jsonResponse({ Page: { pageInfo: { hasNextPage: false }, airingSchedules: [] } });
        }
        return jsonResponse({ Page: { pageInfo: { hasNextPage: false }, media: [] } });
      },
    };

    try {
      await startAniListSync({ adminId: "admin-1" }, deps);
      await waitForActiveAniListSync();

      const row = (
        await db.pg.query<{ title: string; cover: string }>(
          `SELECT "title", "cover" FROM "catalog_anime" WHERE "anilistId" = 999;`,
        )
      ).rows[0];
      assert.equal(row.title, "Título Editado Manualmente");
      assert.equal(row.cover, "https://cdn.hikari.tv/manual-cover.webp");

      const calendarSource = fs.readFileSync(
        path.join(process.cwd(), "src/routes/calendar.tsx"),
        "utf8",
      );
      const homeEpisodesSource = fs.readFileSync(
        path.join(process.cwd(), "src/lib/home-episodes.ts"),
        "utf8",
      );
      assert.equal(calendarSource.includes("graphql.anilist.co"), false);
      assert.equal(homeEpisodesSource.includes("graphql.anilist.co"), false);
    } finally {
      await waitForActiveAniListSync();
      await db.pg.close();
    }
  });

  it("6. Validações de concorrência e recuperação (7 critérios obrigatórios)", async () => {
    const db = await createTestPgliteContext();
    await db.pg.query(
      `INSERT INTO "admin_settings" ("key", "value") VALUES
       ('anilist_sync_initial_completed', 'true'),
       ('anilist_sync_checkpoint', '{"mode":"incremental","stage":"incremental","page":3,"seasonIndex":0,"startedAt":1700000000000,"updatedAt":1700000000000}');`,
    );

    const deps: AniListSyncDeps = {
      pool: db.pool,
      executionMode: "background",
      rateLimitDelayMs: 0,
      retries: 1,
      fetchImpl: async () => jsonResponse({ Page: { pageInfo: { hasNextPage: false }, media: [] } }),
    };

    try {
      // 1. Duas inicializações concorrentes no Admin: apenas uma recebe autorização (409 na segunda)
      let releaseFetch!: () => void;
      const gate = new Promise<void>((r) => { releaseFetch = r; });
      const slowDeps: AniListSyncDeps = {
        ...deps,
        fetchImpl: async () => {
          await gate;
          return jsonResponse({ Page: { pageInfo: { hasNextPage: false }, media: [] } });
        },
      };

      const start1 = await startAniListSync({ adminId: "admin-1" }, slowDeps);
      assert.equal(start1.accepted, true);

      await assert.rejects(
        () => startAniListSync({ adminId: "admin-2" }, slowDeps),
        (err: unknown) => err instanceof AniListSyncConflictError && err.status === 409,
      );

      // Libera execução 1 para terminar
      releaseFetch();
      await waitForActiveAniListSync();

      // 3 & 4. Simula o intervalo entre fatias (lock livre na Vercel, mas status running com runId do admin ativo):
      // GitHub Actions sem runId ou execução com runId diferente são rejeitados com skipped_conflict.
      const nowIso = new Date().toISOString();
      await db.pg.query(
        `INSERT INTO "admin_settings" ("key", "value")
         VALUES ('anilist_sync_status', $1)
         ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value";`,
        [
          JSON.stringify({
            status: "running",
            runId: "admin-run-1",
            mode: "incremental",
            startedAt: nowIso,
            updatedAt: nowIso,
            finishedAt: null,
            lastSuccessAt: null,
            errorMessage: null,
            progress: null,
          }),
        ],
      );

      await db.pg.query(
        `INSERT INTO "admin_settings" ("key", "value")
         VALUES ('anilist_sync_checkpoint', '{"mode":"incremental","stage":"incremental","page":3,"seasonIndex":0,"startedAt":1700000000000,"updatedAt":1700000000000}')
         ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value";`,
      );

      const { runSync } = await import("../../scripts/anilist-sync.mjs");
      const conflictingRun = await runSync({
        argv: ["--manual"],
        runId: "gh-actions-or-wrong-run-id",
        pool: db.pool,
        fetchImpl: async (_url: string, init: any) => {
          const bodyStr = String(init?.body || "{}");
          if (bodyStr.includes("AiringScheduleQuery")) {
            return jsonResponse({ Page: { pageInfo: { hasNextPage: false }, airingSchedules: [] } });
          }
          return jsonResponse({ Page: { pageInfo: { hasNextPage: false }, media: [makeMedia(9999)] } });
        },
      });
      assert.equal(conflictingRun.status, "skipped_conflict");

      // 6. Conflito não modifica checkpoint, timestamp ou dados do catálogo
      const cpCheck = await db.pg.query<{ value: string }>(
        `SELECT "value" FROM "admin_settings" WHERE "key" = 'anilist_sync_checkpoint';`,
      );
      assert.ok(cpCheck.rows[0].value.includes('"page":3'));

      // 5. Após conclusão/resparagem da execução, nova execução com runId correto (ou após erro) pode prosseguir
      await db.pg.query(`DELETE FROM "admin_settings" WHERE "key" = 'anilist_sync_status';`);
      const cronRun = await runSync({
        argv: [],
        pool: db.pool,
        now: () => new Date("2026-11-16T03:00:00Z"),
        fetchImpl: async (_url: string, init: any) => {
          const bodyStr = String(init?.body || "{}");
          if (bodyStr.includes("AiringScheduleQuery")) {
            return jsonResponse({ Page: { pageInfo: { hasNextPage: false }, airingSchedules: [] } });
          }
          return jsonResponse({ Page: { pageInfo: { hasNextPage: false }, media: [] } });
        },
      });
      assert.equal(cronRun.status, "success");

      // 7. Execução órfã pode ser recuperada sem perder o checkpoint (simula running antigo sem lock)
      await db.pg.query(
        `INSERT INTO "admin_settings" ("key", "value")
         VALUES ('anilist_sync_checkpoint', '{"mode":"incremental","stage":"incremental","page":5,"seasonIndex":0,"startedAt":1700000000000,"updatedAt":1700000000000}')
         ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value";`,
      );
      await db.pg.query(
        `INSERT INTO "admin_settings" ("key", "value")
         VALUES ('anilist_sync_status', '{"status":"running","runId":"orphan","mode":"incremental","startedAt":"2020-01-01T00:00:00.000Z","updatedAt":"2020-01-01T00:00:00.000Z","finishedAt":null,"lastSuccessAt":null,"errorMessage":null,"progress":null}')
         ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value";`,
      );

      const orphanRecovered = await getAniListSyncStatus({
        ...deps,
        staleRunningMs: 1000,
        now: () => new Date("2026-11-18T20:00:00Z"),
      });
      assert.equal(orphanRecovered.status, "error");
      assert.equal(orphanRecovered.incomplete, true);
      assert.equal(orphanRecovered.checkpoint?.page, 5);
    } finally {
      await waitForActiveAniListSync();
      await db.pg.close();
    }
  });

});
