import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import {
  ADVISORY_LOCK_ID,
  AIRING_SCHEDULE_QUERY,
  MEDIA_LIST_QUERY,
  MAX_TEST_LIMIT,
  MAX_TEST_REQUESTS,
  SEASON_QUERY,
  computeSearchBlob,
  computeTitleNorm,
  fetchAniListWithRetry,
  isCronAllowedForFrequency,
  isCustomImageUrl,
  normalizeSyncFrequency,
  parseAdminSettingValue,
  resolveCatalogAnimeFields,
  runSync,
} from "./anilist-sync.mjs";
import { pendingMigrations } from "./migration-plan.mjs";

async function createRealPglitePool({ skipMigration0037 = false } = {}) {
  const { pg_trgm } = await import("@electric-sql/pglite/contrib/pg_trgm");
  const pg = new PGlite({ extensions: { pg_trgm } });
  await pg.waitReady;
  await pg.exec(
    "CREATE TABLE IF NOT EXISTS _migrations (name text primary key, applied_at timestamptz not null default now());"
  );

  const migrationsDir = path.join(process.cwd(), "migrations");
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql") && (!skipMigration0037 || !f.startsWith("0037_")));

  for (const { name } of pendingMigrations(files, [])) {
    const sqlText = fs.readFileSync(path.join(migrationsDir, name), "utf8");
    await pg.transaction(async (tx) => {
      await tx.exec(sqlText);
      await tx.query("INSERT INTO _migrations (name) VALUES ($1);", [name]);
    });
  }

  let lockHeld = false;
  let lockBusy = false;
  const queryLog = [];

  const client = {
    async query(sqlText, params = []) {
      const normalized = sqlText.replace(/\s+/g, " ").trim();
      queryLog.push({ sql: normalized, params });

      if (normalized.startsWith("SELECT pg_try_advisory_lock")) {
        if (lockBusy) {
          return { rows: [{ locked: false }] };
        }
        lockHeld = true;
        return { rows: [{ locked: true }] };
      }
      if (normalized.startsWith("SELECT pg_advisory_unlock")) {
        lockHeld = false;
        return { rows: [{ pg_advisory_unlock: true }] };
      }
      return pg.query(sqlText, params);
    },
    release() {},
  };

  return {
    pg,
    pool: {
      async connect() {
        return client;
      },
      async end() {},
    },
    setLockBusy(busy) {
      lockBusy = busy;
    },
    isLockHeld() {
      return lockHeld;
    },
    getQueryLog() {
      return queryLog;
    },
  };
}

function createTrackingRedis() {
  const incrs = [];
  const dels = [];
  const scans = [];
  const keysCalls = [];
  const scanFixtures = new Map([
    ["hikari:calendar:week:v1:*", ["hikari:calendar:week:v1:2026-W47", "hikari:calendar:week:v1:2026-W48"]],
    ["hikari:home:today-raw:v1:*", ["hikari:home:today-raw:v1:2026-11-18"]],
    ["hikari:catalog:detail:v1:*", ["hikari:catalog:detail:v1:anilist-101"]],
  ]);

  return {
    async incr(key) {
      incrs.push(key);
      return 1;
    },
    async del(...keys) {
      dels.push(...keys);
      return keys.length;
    },
    async scan(cursor, opts = {}) {
      scans.push({ cursor: String(cursor), match: opts.match, count: opts.count });
      const items = scanFixtures.get(opts.match) ?? [];
      if (String(cursor) === "0" && items.length > 1) {
        return ["42", [items[0]]];
      }
      if (String(cursor) === "42") {
        return ["0", items.slice(1)];
      }
      return ["0", items];
    },
    async keys(pattern) {
      keysCalls.push(pattern);
      throw new Error("KEYS bloqueante nunca deve ser chamado!");
    },
    getStats: () => ({ incrs, dels, scans, keysCalls }),
  };
}

function makeMedia(id, overrides = {}) {
  return {
    id,
    idMal: id + 10000,
    updatedAt: 1700000500,
    title: {
      romaji: `Romaji ${id}`,
      english: `English ${id}`,
      native: `ネイティブ ${id}`,
    },
    coverImage: {
      extraLarge: `https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx${id}.jpg`,
      large: `https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx${id}.jpg`,
      color: "#5b21b6",
    },
    bannerImage: `https://s4.anilist.co/file/anilistcdn/media/anime/banner/${id}.jpg`,
    description: `<p>Sinopse oficial AniList ${id}</p>`,
    format: "TV",
    status: "RELEASING",
    episodes: 12,
    season: "FALL",
    seasonYear: 2026,
    averageScore: 84,
    popularity: 42000 + id,
    trending: 900 + id,
    genres: ["Action", "Fantasy"],
    trailer: { id: `tr-${id}`, site: "youtube", thumbnail: null },
    ...overrides,
  };
}

function jsonResponse(data, status = 200, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get(name) {
        return headers[name.toLowerCase()] ?? headers[name] ?? null;
      },
    },
    async json() {
      return { data };
    },
  };
}

describe("Etapa 1 — Sincronização Periódica da AniList (Hikari)", () => {
  it("1. Frequência 1_per_week em cron: executa apenas na Segunda-feira UTC", async () => {
    assert.equal(isCronAllowedForFrequency("1_per_week", new Date("2026-11-16T03:00:00Z")), true); // Seg
    assert.equal(isCronAllowedForFrequency("1_per_week", new Date("2026-11-19T03:00:00Z")), false); // Qui
    assert.equal(isCronAllowedForFrequency("1_per_week", new Date("2026-11-18T03:00:00Z")), false); // Qua

    const db = await createRealPglitePool();
    await db.pg.query(
      `INSERT INTO "admin_settings" ("key", "value") VALUES ('anilist_sync_frequency', $1);`,
      [JSON.stringify("1_per_week")]
    );

    const prevEvent = process.env.GITHUB_EVENT_NAME;
    process.env.GITHUB_EVENT_NAME = "schedule";
    try {
      const skippedRes = await runSync({
        pool: db.pool,
        redis: createTrackingRedis(),
        now: () => new Date("2026-11-19T03:00:00Z"), // Quinta UTC
        rateLimitDelayMs: 0,
        argv: [],
        fetchImpl: async () => {
          throw new Error("Não deve chamar AniList quando ignorado por frequência");
        },
      });
      assert.equal(skippedRes.status, "skipped_frequency");
      assert.equal(db.isLockHeld(), false);
    } finally {
      if (prevEvent === undefined) delete process.env.GITHUB_EVENT_NAME;
      else process.env.GITHUB_EVENT_NAME = prevEvent;
      await db.pg.close();
    }
  });

  it("2. Frequência 2_per_week em cron: executa na Segunda e Quinta UTC, ignora outros dias", async () => {
    assert.equal(isCronAllowedForFrequency("2_per_week", new Date("2026-11-16T03:00:00Z")), true); // Seg
    assert.equal(isCronAllowedForFrequency("2_per_week", new Date("2026-11-19T03:00:00Z")), true); // Qui
    assert.equal(isCronAllowedForFrequency("2_per_week", new Date("2026-11-20T03:00:00Z")), false); // Sex

    const db = await createRealPglitePool();
    // Armazenado como JSON stringificado igual ao settings.server.ts
    await db.pg.query(
      `INSERT INTO "admin_settings" ("key", "value") VALUES ('anilist_sync_frequency', $1), ('anilist_sync_initial_completed', 'true');`,
      [JSON.stringify("2_per_week")]
    );

    const prevEvent = process.env.GITHUB_EVENT_NAME;
    process.env.GITHUB_EVENT_NAME = "schedule";
    try {
      const resThu = await runSync({
        pool: db.pool,
        redis: createTrackingRedis(),
        now: () => new Date("2026-11-19T03:00:00Z"), // Quinta UTC -> permitido
        rateLimitDelayMs: 0,
        argv: [],
        incrementalLimits: { incrementalPages: 1, trendingPages: 1, popularPages: 1, seasonPages: 1, schedulePages: 1 },
        fetchImpl: async (_url, init) => {
          const { query } = JSON.parse(init.body);
          if (query.includes("AiringScheduleQuery")) {
            return jsonResponse({ Page: { pageInfo: { hasNextPage: false }, airingSchedules: [] } });
          }
          return jsonResponse({ Page: { pageInfo: { hasNextPage: false }, media: [] } });
        },
      });
      assert.equal(resThu.status, "success");

      const resFri = await runSync({
        pool: db.pool,
        redis: createTrackingRedis(),
        now: () => new Date("2026-11-20T03:00:00Z"), // Sexta UTC -> ignorado
        rateLimitDelayMs: 0,
        argv: [],
        fetchImpl: async () => {
          throw new Error("Não deve executar na sexta-feira");
        },
      });
      assert.equal(resFri.status, "skipped_frequency");
    } finally {
      if (prevEvent === undefined) delete process.env.GITHUB_EVENT_NAME;
      else process.env.GITHUB_EVENT_NAME = prevEvent;
      await db.pg.close();
    }
  });

  it("3. Execução manual (workflow_dispatch e --manual) ignora restrição de dia da semana", async () => {
    const db = await createRealPglitePool();
    await db.pg.query(
      `INSERT INTO "admin_settings" ("key", "value") VALUES ('anilist_sync_frequency', $1), ('anilist_sync_initial_completed', 'true');`,
      [JSON.stringify("1_per_week")]
    );

    const prevEvent = process.env.GITHUB_EVENT_NAME;
    process.env.GITHUB_EVENT_NAME = "workflow_dispatch";
    try {
      const resDispatch = await runSync({
        pool: db.pool,
        redis: createTrackingRedis(),
        now: () => new Date("2026-11-18T03:00:00Z"), // Quarta UTC (normalmente bloqueado)
        rateLimitDelayMs: 0,
        argv: [],
        fetchImpl: async (_url, init) => {
          const { query } = JSON.parse(init.body);
          if (query.includes("AiringScheduleQuery")) {
            return jsonResponse({ Page: { pageInfo: { hasNextPage: false }, airingSchedules: [] } });
          }
          return jsonResponse({ Page: { pageInfo: { hasNextPage: false }, media: [] } });
        },
      });
      assert.equal(resDispatch.status, "success");
    } finally {
      if (prevEvent === undefined) delete process.env.GITHUB_EVENT_NAME;
      else process.env.GITHUB_EVENT_NAME = prevEvent;
      await db.pg.close();
    }
  });

  it("4 & 5. Carga inicial completa e retomada de checkpoint após falha intermediária", async () => {
    const db = await createRealPglitePool();
    const redis = createTrackingRedis();
    let failOnPopularPage2 = true;
    const calledStages = [];

    const fetchImpl = async (_url, init) => {
      const { query, variables } = JSON.parse(init.body);
      if (query.includes("MediaListQuery")) {
        const sort = variables.sort.join(",");
        calledStages.push(`${sort}:p${variables.page}`);
        if (sort === "TRENDING_DESC,POPULARITY_DESC") {
          return jsonResponse({
            Page: {
              pageInfo: { hasNextPage: false },
              media: [makeMedia(101, { trending: 999 })],
            },
          });
        }
        if (sort === "POPULARITY_DESC") {
          if (variables.page === 2 && failOnPopularPage2) {
            return { ok: false, status: 503, headers: { get: () => null }, async json() { return {}; } };
          }
          return jsonResponse({
            Page: {
              pageInfo: { hasNextPage: variables.page === 1 },
              media: [makeMedia(200 + variables.page, { popularity: 80000 + variables.page })],
            },
          });
        }
        if (sort === "SCORE_DESC") {
          return jsonResponse({
            Page: { pageInfo: { hasNextPage: false }, media: [makeMedia(301, { averageScore: 95 })] },
          });
        }
        if (sort === "UPDATED_AT_DESC") {
          return jsonResponse({
            Page: { pageInfo: { hasNextPage: false }, media: [makeMedia(401)] },
          });
        }
      }
      if (query.includes("SeasonQuery")) {
        calledStages.push(`SEASON:${variables.season}-${variables.year}:p${variables.page}`);
        const media =
          variables.season === "FALL" && variables.year === 2026
            ? [makeMedia(501, { season: "FALL", seasonYear: 2026 })]
            : [];
        return jsonResponse({ Page: { pageInfo: { hasNextPage: false }, media } });
      }
      if (query.includes("AiringScheduleQuery")) {
        calledStages.push(`SCHEDULE:p${variables.page}`);
        return jsonResponse({
          Page: {
            pageInfo: { hasNextPage: false },
            airingSchedules: [
              {
                id: 9001,
                airingAt: Math.floor(Date.now() / 1000) + 7200,
                timeUntilAiring: 7200,
                episode: 3,
                media: makeMedia(601),
              },
            ],
          },
        });
      }
      throw new Error(`Query inesperada: ${query}`);
    };

    try {
      // Primeira execução falha na página 2 de popular
      await assert.rejects(
        () =>
          runSync({
            pool: db.pool,
            redis,
            argv: ["--manual"],
            rateLimitDelayMs: 0,
            retries: 1,
            now: () => new Date("2026-11-18T12:00:00Z"),
            fetchImpl,
          }),
        /503/
      );

      // Verifica que checkpoint foi persistido em popular:p2 e initial_completed NÃO foi marcado
      const cpRes = await db.pg.query(
        `SELECT "value" FROM "admin_settings" WHERE "key" = 'anilist_sync_checkpoint';`
      );
      const cp = JSON.parse(cpRes.rows[0].value);
      assert.equal(cp.mode, "initial");
      assert.equal(cp.stage, "popular");
      assert.equal(cp.page, 2);

      const completedResBefore = await db.pg.query(
        `SELECT "value" FROM "admin_settings" WHERE "key" = 'anilist_sync_initial_completed';`
      );
      assert.equal(completedResBefore.rows.length, 0);

      // Retomada após corrigir erro
      calledStages.length = 0;
      failOnPopularPage2 = false;

      const resumed = await runSync({
        pool: db.pool,
        redis,
        argv: ["--manual"],
        rateLimitDelayMs: 0,
        retries: 1,
        now: () => new Date("2026-11-18T12:10:00Z"),
        fetchImpl,
      });

      assert.equal(resumed.status, "success");
      assert.equal(resumed.mode, "initial");
      assert.equal(resumed.initialCompleted, true);
      // Garante que NÃO repetiu trending nem popular:p1!
      assert.equal(calledStages.includes("TRENDING_DESC,POPULARITY_DESC:p1"), false);
      assert.equal(calledStages.includes("POPULARITY_DESC:p1"), false);
      assert.equal(calledStages[0], "POPULARITY_DESC:p2");

      // Checkpoint limpo e marcadores finais persistidos
      const cpAfter = await db.pg.query(
        `SELECT "value" FROM "admin_settings" WHERE "key" = 'anilist_sync_checkpoint';`
      );
      assert.equal(cpAfter.rows.length, 0);

      const initDone = await db.pg.query(
        `SELECT "value" FROM "admin_settings" WHERE "key" = 'anilist_sync_initial_completed';`
      );
      assert.equal(initDone.rows[0].value, "true");

      const tsRow = await db.pg.query(
        `SELECT "value" FROM "admin_settings" WHERE "key" = 'anilist_sync_last_timestamp';`
      );
      assert.equal(tsRow.rows[0].value, String(Date.parse("2026-11-18T12:00:00Z")));
    } finally {
      await db.pg.close();
    }
  });

  it("6 & 7. Sync incremental usa UPDATED_AT_DESC (sem updatedAt_greater) e respeita corte de janela sem perda", async () => {
    const db = await createRealPglitePool();
    // lastSyncTimestamp = 1700100000 * 1000 => cutoff = 1700100000 - 86400 = 1700013600
    await db.pg.query(
      `INSERT INTO "admin_settings" ("key", "value") VALUES
       ('anilist_sync_initial_completed', 'true'),
       ('anilist_sync_last_timestamp', '1700100000000');`
    );

    let incrementalPagesCalled = [];
    const seenVariables = [];

    try {
      const res = await runSync({
        pool: db.pool,
        redis: createTrackingRedis(),
        argv: ["--manual"],
        rateLimitDelayMs: 0,
        retries: 1,
        now: () => new Date("2026-11-18T12:00:00Z"),
        fetchImpl: async (_url, init) => {
          const { query, variables } = JSON.parse(init.body);
          assert.equal(query.includes("updatedAt_greater"), false);
          assert.equal("updatedAtGreater" in (variables || {}), false);
          seenVariables.push(variables);

          if (query.includes("MediaListQuery")) {
            if (variables.sort[0] === "UPDATED_AT_DESC") {
              incrementalPagesCalled.push(variables.page);
              if (variables.page === 1) {
                return jsonResponse({
                  Page: {
                    pageInfo: { hasNextPage: true },
                    media: [
                      makeMedia(701, { updatedAt: 1700100500 }),
                      makeMedia(702, { updatedAt: 1700013600 }), // exatamente na fronteira -> deve importar
                    ],
                  },
                });
              }
              return jsonResponse({
                Page: {
                  pageInfo: { hasNextPage: true }, // mesmo com hasNextPage=true, deve parar no corte!
                  media: [
                    makeMedia(703, { updatedAt: 1700014000 }), // dentro da janela -> deve importar
                    makeMedia(704, { updatedAt: 1700010000 }), // abaixo do cutoff -> para aqui!
                  ],
                },
              });
            }
            return jsonResponse({ Page: { pageInfo: { hasNextPage: false }, media: [] } });
          }
          if (query.includes("AiringScheduleQuery")) {
            return jsonResponse({ Page: { pageInfo: { hasNextPage: false }, airingSchedules: [] } });
          }
          return jsonResponse({ Page: { pageInfo: { hasNextPage: false }, media: [] } });
        },
      });

      assert.equal(res.status, "success");
      assert.deepEqual(incrementalPagesCalled, [1, 2]);

      const rows = await db.pg.query(`SELECT "anilistId" FROM "catalog_anime" ORDER BY "anilistId" ASC;`);
      assert.deepEqual(
        rows.rows.map((r) => r.anilistId),
        [701, 702, 703]
      );
      assert.equal(MEDIA_LIST_QUERY.includes("updatedAt_greater"), false);
      assert.equal(SEASON_QUERY.includes("updatedAt_greater"), false);
      assert.equal(AIRING_SCHEDULE_QUERY.includes("updatedAt_greater"), false);
    } finally {
      await db.pg.close();
    }
  });

  it("8 & 9. Modo --test é estritamente dry-run (zero escritas DB/Redis), respeita limite global e teto HTTP", async () => {
    const db = await createRealPglitePool();
    await db.pg.query(
      `INSERT INTO "admin_settings" ("key", "value") VALUES ('anilist_sync_last_timestamp', '999999');`
    );
    const redis = createTrackingRedis();

    try {
      const res = await runSync({
        pool: db.pool,
        redis,
        argv: ["--manual", "--test", "--limit=5"],
        rateLimitDelayMs: 0,
        retries: 1,
        fetchImpl: async (_url, init) => {
          const { query } = JSON.parse(init.body);
          if (query.includes("MediaListQuery")) {
            return jsonResponse({
              Page: {
                pageInfo: { hasNextPage: true },
                media: [makeMedia(1), makeMedia(2), makeMedia(3), makeMedia(4), makeMedia(5)],
              },
            });
          }
          if (query.includes("SeasonQuery")) {
            return jsonResponse({
              Page: { pageInfo: { hasNextPage: true }, media: [makeMedia(6), makeMedia(7)] },
            });
          }
          if (query.includes("AiringScheduleQuery")) {
            return jsonResponse({
              Page: {
                pageInfo: { hasNextPage: true },
                airingSchedules: [
                  { id: 1, airingAt: 1800000000, timeUntilAiring: 100, episode: 1, media: makeMedia(8) },
                  { id: 2, airingAt: 1800001000, timeUntilAiring: 200, episode: 2, media: makeMedia(9) },
                ],
              },
            });
          }
          throw new Error("Unexpected query");
        },
      });

      assert.equal(res.status, "dry_run_success");
      assert.equal(res.dryRun, true);
      assert.ok(res.totalProcessed <= 5, `Total processado (${res.totalProcessed}) excedeu limite global 5`);
      assert.ok(res.httpRequestsCount <= MAX_TEST_REQUESTS);

      // Cap máximo global de 20
      const resCap = await runSync({
        pool: db.pool,
        redis,
        argv: ["--manual", "--test", "--limit=999"],
        rateLimitDelayMs: 0,
        retries: 1,
        fetchImpl: async () => jsonResponse({ Page: { pageInfo: { hasNextPage: false }, media: [], airingSchedules: [] } }),
      });
      assert.equal(resCap.globalLimit, MAX_TEST_LIMIT);

      // Zero escritas reais em catalog_anime, catalog_airing_schedule e admin_settings
      const animeCount = await db.pg.query(`SELECT COUNT(*)::int AS c FROM "catalog_anime";`);
      const schedCount = await db.pg.query(`SELECT COUNT(*)::int AS c FROM "catalog_airing_schedule";`);
      const tsAfter = await db.pg.query(
        `SELECT "value" FROM "admin_settings" WHERE "key" = 'anilist_sync_last_timestamp';`
      );
      const cpAfter = await db.pg.query(
        `SELECT "value" FROM "admin_settings" WHERE "key" = 'anilist_sync_checkpoint';`
      );

      assert.equal(animeCount.rows[0].c, 0);
      assert.equal(schedCount.rows[0].c, 0);
      assert.equal(tsAfter.rows[0].value, "999999");
      assert.equal(cpAfter.rows.length, 0);

      // Zero mutações no Redis em --test
      const rStats = redis.getStats();
      assert.equal(rStats.incrs.length, 0);
      assert.equal(rStats.dels.length, 0);
      assert.equal(rStats.scans.length, 0);
    } finally {
      await db.pg.close();
    }
  });

  it("10. Tratamento de HTTP 429 com Retry-After e backoff progressivo", async () => {
    let attempts = 0;
    const retryEvents = [];

    const data = await fetchAniListWithRetry(
      MEDIA_LIST_QUERY,
      { page: 1, perPage: 5, sort: ["POPULARITY_DESC"] },
      {
        retries: 4,
        rateLimitDelayMs: 0,
        backoffBaseMs: 2,
        retryAfterScaleMs: 3,
        onRetry: (evt) => retryEvents.push(evt),
        fetchImpl: async () => {
          attempts++;
          if (attempts === 1) {
            // 429 com header Retry-After
            return {
              ok: false,
              status: 429,
              headers: { get: (h) => (h.toLowerCase() === "retry-after" ? "4" : null) },
              async json() { return {}; },
            };
          }
          if (attempts === 2) {
            // 429 sem header Retry-After -> usa backoff progressivo (2 * 2^1 = 4ms)
            return {
              ok: false,
              status: 429,
              headers: { get: () => null },
              async json() { return {}; },
            };
          }
          return jsonResponse({ Page: { pageInfo: { hasNextPage: false }, media: [makeMedia(10)] } });
        },
      }
    );

    assert.equal(attempts, 3);
    assert.equal(retryEvents.length, 2);
    assert.equal(retryEvents[0].status, 429);
    assert.equal(retryEvents[0].waitMs, 12); // 4 * retryAfterScaleMs(3)
    assert.equal(retryEvents[1].status, 429);
    assert.equal(retryEvents[1].waitMs, 4); // backoffBaseMs(2) * 2^1
    assert.equal(data.Page.media[0].id, 10);
  });

  it("11 & 12. Falha de rede / resposta inválida não marca sucesso nem avança anilist_sync_last_timestamp", async () => {
    const db = await createRealPglitePool();
    await db.pg.query(
      `INSERT INTO "admin_settings" ("key", "value") VALUES
       ('anilist_sync_initial_completed', 'true'),
       ('anilist_sync_last_timestamp', '1500000');`
    );

    try {
      await assert.rejects(() =>
        runSync({
          pool: db.pool,
          redis: createTrackingRedis(),
          argv: ["--manual"],
          rateLimitDelayMs: 0,
          retries: 2,
          backoffBaseMs: 1,
          fetchImpl: async () => {
            throw new Error("ECONNRESET");
          },
        })
      );

      const tsAfterNetworkFail = await db.pg.query(
        `SELECT "value" FROM "admin_settings" WHERE "key" = 'anilist_sync_last_timestamp';`
      );
      assert.equal(tsAfterNetworkFail.rows[0].value, "1500000");

      // Resposta inválida sem campo data
      await assert.rejects(() =>
        runSync({
          pool: db.pool,
          redis: createTrackingRedis(),
          argv: ["--manual"],
          rateLimitDelayMs: 0,
          retries: 1,
          fetchImpl: async () => ({
            ok: true,
            status: 200,
            headers: { get: () => null },
            async json() {
              return { errors: [{ message: "Internal Server Error" }] };
            },
          }),
        })
      );

      const tsAfterInvalid = await db.pg.query(
        `SELECT "value" FROM "admin_settings" WHERE "key" = 'anilist_sync_last_timestamp';`
      );
      assert.equal(tsAfterInvalid.rows[0].value, "1500000");
    } finally {
      await db.pg.close();
    }
  });

  it("13 & 14. Advisory Lock (849201) impede execução concorrente e garante liberação no finally em erro", async () => {
    const db = await createRealPglitePool();
    try {
      db.setLockBusy(true);
      const skipped = await runSync({
        pool: db.pool,
        redis: createTrackingRedis(),
        argv: ["--manual"],
        rateLimitDelayMs: 0,
      });
      assert.equal(skipped.status, "skipped_locked");
      assert.equal(db.isLockHeld(), false);

      db.setLockBusy(false);
      await assert.rejects(() =>
        runSync({
          pool: db.pool,
          redis: createTrackingRedis(),
          argv: ["--manual"],
          rateLimitDelayMs: 0,
          retries: 1,
          fetchImpl: async () => {
            assert.equal(db.isLockHeld(), true, "Lock deve estar ativo durante execução");
            throw new Error("Falha simulada durante execução");
          },
        })
      );

      assert.equal(db.isLockHeld(), false, `Lock ${ADVISORY_LOCK_ID} deve ser liberado no finally`);
    } finally {
      await db.pg.close();
    }
  });

  it("15. Preservação de manual_fields (incluindo Romaji/English/Native individuais) e imagens customizadas", async () => {
    assert.equal(isCustomImageUrl("https://cdn.hikari.app/covers/custom.jpg"), true);
    assert.equal(isCustomImageUrl("/uploads/custom-banner.png"), true);
    assert.equal(
      isCustomImageUrl("https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx1.jpg"),
      false
    );
    assert.equal(
      isCustomImageUrl("https://cdn.myanimelist.net/images/anime/1/1.jpg"),
      false
    );
    assert.equal(
      isCustomImageUrl("https://media.kitsu.app/anime/poster_images/1/large.jpg"),
      false
    );

    const db = await createRealPglitePool();
    try {
      await db.pg.query(
        `INSERT INTO "admin_settings" ("key", "value") VALUES ('anilist_sync_initial_completed', 'true');`
      );
      await db.pg.query(
        `INSERT INTO "catalog_anime" (
           "id", "title", "anilistId", "titleRomaji", "titleEnglish", "titleNative",
           "cover", "banner", "synopsis", "manual_fields"
         ) VALUES (
           'anilist-888',
           'Título Manual PT-BR',
           888,
           'Romaji Manual',
           'English Original DB',
           '日本語マニュアル',
           'https://cdn.hikari.tv/custom-cover.webp',
           'https://s4.anilist.co/file/anilistcdn/media/anime/banner/old.jpg',
           'Sinopse editada manualmente.',
           ARRAY['title', 'titleRomaji', 'titleNative', 'synopsis', 'cover']::text[]
         );`
      );

      // Verificação unitária de resolveCatalogAnimeFields
      const resolvedUnit = resolveCatalogAnimeFields(makeMedia(888), {
        id: "anilist-888",
        title: "Título Manual PT-BR",
        titleRomaji: "Romaji Manual",
        titleEnglish: "English Original DB",
        titleNative: "日本語マニュアル",
        cover: "https://cdn.hikari.tv/custom-cover.webp",
        banner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/old.jpg",
        synopsis: "Sinopse editada manualmente.",
        manual_fields: ["title", "titleRomaji", "titleNative", "synopsis", "cover"],
      });
      assert.equal(resolvedUnit.title, "Título Manual PT-BR");
      assert.equal(resolvedUnit.titleRomaji, "Romaji Manual");
      assert.equal(resolvedUnit.titleNative, "日本語マニュアル");
      assert.equal(resolvedUnit.titleEnglish, "English 888"); // não está em manual_fields
      assert.equal(resolvedUnit.synopsis, "Sinopse editada manualmente.");
      assert.equal(resolvedUnit.cover, "https://cdn.hikari.tv/custom-cover.webp");
      assert.equal(resolvedUnit.banner, "https://s4.anilist.co/file/anilistcdn/media/anime/banner/888.jpg");

      await runSync({
        pool: db.pool,
        redis: createTrackingRedis(),
        argv: ["--manual"],
        rateLimitDelayMs: 0,
        retries: 1,
        fetchImpl: async (_url, init) => {
          const { query, variables } = JSON.parse(init.body);
          if (query.includes("MediaListQuery") && variables.sort[0] === "UPDATED_AT_DESC") {
            return jsonResponse({
              Page: { pageInfo: { hasNextPage: false }, media: [makeMedia(888)] },
            });
          }
          if (query.includes("AiringScheduleQuery")) {
            return jsonResponse({ Page: { pageInfo: { hasNextPage: false }, airingSchedules: [] } });
          }
          return jsonResponse({ Page: { pageInfo: { hasNextPage: false }, media: [] } });
        },
      });

      const saved = (
        await db.pg.query(`SELECT * FROM "catalog_anime" WHERE "anilistId" = 888;`)
      ).rows[0];
      assert.equal(saved.title, "Título Manual PT-BR");
      assert.equal(saved.titleRomaji, "Romaji Manual");
      assert.equal(saved.titleNative, "日本語マニュアル");
      assert.equal(saved.titleEnglish, "English 888");
      assert.equal(saved.synopsis, "Sinopse editada manualmente.");
      assert.equal(saved.cover, "https://cdn.hikari.tv/custom-cover.webp");
      assert.equal(saved.banner, "https://s4.anilist.co/file/anilistcdn/media/anime/banner/888.jpg");
    } finally {
      await db.pg.close();
    }
  });

  it("16. Preservação absoluta de catalog_episode e atualização de title_norm, search_blob, popularity e trending (e fallback pré-0037)", async () => {
    const db = await createRealPglitePool();
    try {
      await db.pg.query(
        `INSERT INTO "admin_settings" ("key", "value") VALUES ('anilist_sync_initial_completed', 'true');`
      );
      await db.pg.query(
        `INSERT INTO "catalog_anime" ("id", "title", "anilistId") VALUES ('anilist-555', 'Anime 555', 555);`
      );
      await db.pg.query(
        `INSERT INTO "catalog_episode" ("id", "animeId", "seasonNumber", "number", "title", "videoUrl", "published")
         VALUES ('ep-real-555-1', 'anilist-555', 1, 1, 'Episódio Real', 'https://cdn.hikari.app/555-1.mp4', true);`
      );

      await runSync({
        pool: db.pool,
        redis: createTrackingRedis(),
        argv: ["--manual"],
        rateLimitDelayMs: 0,
        retries: 1,
        fetchImpl: async (_url, init) => {
          const { query, variables } = JSON.parse(init.body);
          if (query.includes("MediaListQuery") && variables.sort[0] === "UPDATED_AT_DESC") {
            return jsonResponse({
              Page: {
                pageInfo: { hasNextPage: false },
                media: [makeMedia(555, { popularity: 77777, trending: 1234, averageScore: 91 })],
              },
            });
          }
          if (query.includes("AiringScheduleQuery")) {
            return jsonResponse({
              Page: {
                pageInfo: { hasNextPage: false },
                airingSchedules: [
                  {
                    id: 70001,
                    airingAt: Math.floor(Date.now() / 1000) + 86400,
                    timeUntilAiring: 86400,
                    episode: 2,
                    media: makeMedia(555, { popularity: 77777, trending: 1234, averageScore: null }),
                  },
                ],
              },
            });
          }
          return jsonResponse({ Page: { pageInfo: { hasNextPage: false }, media: [] } });
        },
      });

      const animeRow = (
        await db.pg.query(`SELECT * FROM "catalog_anime" WHERE "anilistId" = 555;`)
      ).rows[0];
      assert.equal(animeRow.popularity, 77777);
      assert.equal(animeRow.trending, 1234);
      assert.equal(animeRow.score, 91);
      assert.equal(animeRow.title_norm, computeTitleNorm("English 555"));
      assert.equal(
        animeRow.search_blob,
        computeSearchBlob("English 555", "Romaji 555", "English 555", "ネイティブ 555")
      );

      const epRows = (
        await db.pg.query(`SELECT * FROM "catalog_episode" WHERE "animeId" = 'anilist-555';`)
      ).rows;
      assert.equal(epRows.length, 1);
      assert.equal(epRows[0].id, "ep-real-555-1");

      const schedRows = (
        await db.pg.query(`SELECT * FROM "catalog_airing_schedule" WHERE "anilistId" = 555;`)
      ).rows;
      assert.equal(schedRows.length, 1);
      assert.equal(schedRows[0].episode, 2);
    } finally {
      await db.pg.close();
    }

    // Verifica fallback seguro caso migration 0037 ainda não tenha sido aplicada no Neon
    const dbPre0037 = await createRealPglitePool({ skipMigration0037: true });
    try {
      await dbPre0037.pg.query(
        `INSERT INTO "admin_settings" ("key", "value") VALUES ('anilist_sync_initial_completed', 'true');`
      );
      const resPre = await runSync({
        pool: dbPre0037.pool,
        redis: createTrackingRedis(),
        argv: ["--manual"],
        rateLimitDelayMs: 0,
        retries: 1,
        fetchImpl: async (_url, init) => {
          const { query, variables } = JSON.parse(init.body);
          if (query.includes("MediaListQuery") && variables.sort[0] === "UPDATED_AT_DESC") {
            return jsonResponse({ Page: { pageInfo: { hasNextPage: false }, media: [makeMedia(556)] } });
          }
          if (query.includes("AiringScheduleQuery")) {
            return jsonResponse({ Page: { pageInfo: { hasNextPage: false }, airingSchedules: [] } });
          }
          return jsonResponse({ Page: { pageInfo: { hasNextPage: false }, media: [] } });
        },
      });
      assert.equal(resPre.status, "success");
      const inserted556 = (
        await dbPre0037.pg.query(`SELECT "title_norm", "search_blob" FROM "catalog_anime" WHERE "anilistId" = 556;`)
      ).rows[0];
      assert.equal(inserted556.title_norm, "english 556");
    } finally {
      await dbPre0037.pg.close();
    }
  });

  it("17. Invalidação seletiva no Redis via SCAN paginado + contadores atômicos (sem KEYS)", async () => {
    const db = await createRealPglitePool();
    await db.pg.query(
      `INSERT INTO "admin_settings" ("key", "value") VALUES ('anilist_sync_initial_completed', 'true');`
    );
    const redis = createTrackingRedis();

    try {
      await runSync({
        pool: db.pool,
        redis,
        argv: ["--manual"],
        rateLimitDelayMs: 0,
        retries: 1,
        fetchImpl: async (_url, init) => {
          const { query, variables } = JSON.parse(init.body);
          if (query.includes("MediaListQuery") && variables.sort[0] === "UPDATED_AT_DESC") {
            return jsonResponse({
              Page: { pageInfo: { hasNextPage: false }, media: [makeMedia(101)] },
            });
          }
          if (query.includes("AiringScheduleQuery")) {
            return jsonResponse({ Page: { pageInfo: { hasNextPage: false }, airingSchedules: [] } });
          }
          return jsonResponse({ Page: { pageInfo: { hasNextPage: false }, media: [] } });
        },
      });

      const stats = redis.getStats();
      assert.equal(stats.keysCalls.length, 0);
      assert.ok(stats.incrs.includes("hikari:calendar:gen:v1"));
      assert.ok(stats.incrs.includes("hikari:catalog:detail:gen:global:v1"));
      assert.ok(stats.incrs.includes("hikari:catalog:detail:gen:id:v1:anilist-101"));
      assert.ok(stats.incrs.includes("hikari:catalog:detail:gen:id:v1:101"));
      assert.ok(stats.dels.includes("hikari:catalog:index:v1"));
      assert.ok(stats.dels.includes("hikari:catalog:detail:v1:anilist-101"));
      assert.ok(stats.dels.includes("hikari:calendar:week:v1:2026-W47"));
      assert.ok(stats.dels.includes("hikari:calendar:week:v1:2026-W48"));
      assert.ok(stats.scans.some((s) => s.match === "hikari:calendar:week:v1:*" && s.cursor === "42"));
    } finally {
      await db.pg.close();
    }
  });

  it("18. Workflow GitHub Actions compatível com Bun, permissões mínimas, concurrency, sem --manual, e paridade JSON de settings", () => {
    const workflow = fs.readFileSync(
      path.join(process.cwd(), ".github/workflows/anilist-sync.yml"),
      "utf8"
    );
    assert.ok(workflow.includes("oven-sh/setup-bun@v2"));
    assert.ok(workflow.includes("bun install --frozen-lockfile"));
    assert.equal(workflow.includes("npm ci"), false);
    assert.equal(workflow.includes("cache: 'npm'"), false);
    assert.ok(workflow.includes("contents: read"));
    assert.ok(workflow.includes("cancel-in-progress: false"));
    assert.ok(workflow.includes("default: 'test'"));
    assert.ok(workflow.includes("node scripts/anilist-sync.mjs --test"));
    assert.ok(workflow.includes("node scripts/anilist-sync.mjs $EXTRA_ARGS"));
    assert.equal(workflow.includes("--manual"), false);

    assert.equal(normalizeSyncFrequency(JSON.stringify("2_per_week")), "2_per_week");
    assert.equal(normalizeSyncFrequency("2_per_week"), "2_per_week");
    assert.equal(normalizeSyncFrequency(JSON.stringify("1_per_week")), "1_per_week");
    assert.equal(normalizeSyncFrequency("invalid_value"), "1_per_week");
    assert.deepEqual(parseAdminSettingValue('{"mode":"initial","page":3}'), {
      mode: "initial",
      page: 3,
    });

    assert.equal(fs.existsSync(path.join(process.cwd(), "workspace/scripts/anilist-sync.mjs")), false);
  });

  it("19 (Cenários A e B). Incremental incompleta (50 páginas) preserva checkpoint e retoma exatamente da página pendente", async () => {
    const db = await createRealPglitePool();
    const initialTs = "1700000000000";
    await db.pg.query(
      `INSERT INTO "admin_settings" ("key", "value") VALUES
       ('anilist_sync_initial_completed', 'true'),
       ('anilist_sync_last_timestamp', $1);`,
      [initialTs]
    );

    const TOTAL_INCREMENTAL_PAGES = 53;
    const run1Calls = [];
    const run2Calls = [];
    let currentCalls = run1Calls;

    const fetchImpl = async (_url, init) => {
      const { query, variables } = JSON.parse(init.body);
      if (query.includes("MediaListQuery")) {
        const sort = variables.sort.join(",");
        currentCalls.push(`${sort}:p${variables.page}`);
        if (sort === "UPDATED_AT_DESC") {
          const page = variables.page;
          return jsonResponse({
            Page: {
              pageInfo: { hasNextPage: page < TOTAL_INCREMENTAL_PAGES },
              media: [makeMedia(10000 + page, { updatedAt: 1700100000 })],
            },
          });
        }
        return jsonResponse({
          Page: {
            pageInfo: { hasNextPage: false },
            media: [makeMedia(11000 + variables.page)],
          },
        });
      }
      if (query.includes("SeasonQuery")) {
        currentCalls.push(`SEASON:${variables.season}-${variables.year}:p${variables.page}`);
        return jsonResponse({ Page: { pageInfo: { hasNextPage: false }, media: [] } });
      }
      if (query.includes("AiringScheduleQuery")) {
        currentCalls.push(`SCHEDULE:p${variables.page}`);
        return jsonResponse({ Page: { pageInfo: { hasNextPage: false }, airingSchedules: [] } });
      }
      throw new Error(`Query inesperada: ${query}`);
    };

    try {
      const run1StartIso = "2026-11-18T10:00:00Z";
      // Cenário A: Incremental atinge 50 páginas com hasNextPage === true
      await assert.rejects(
        () =>
          runSync({
            pool: db.pool,
            redis: createTrackingRedis(),
            argv: ["--manual"],
            rateLimitDelayMs: 0,
            retries: 1,
            now: () => new Date(run1StartIso),
            fetchImpl,
          }),
        /incompleta/i
      );

      // Etapas posteriores NÃO devem ter executado nem sobrescrito o checkpoint
      assert.equal(run1Calls.filter((c) => c.startsWith("UPDATED_AT_DESC:")).length, 50);
      assert.equal(run1Calls.some((c) => c.startsWith("TRENDING_DESC")), false);
      assert.equal(run1Calls.some((c) => c.startsWith("POPULARITY_DESC")), false);
      assert.equal(run1Calls.some((c) => c.startsWith("SEASON:")), false);
      assert.equal(run1Calls.some((c) => c.startsWith("SCHEDULE:")), false);

      const cpAfterRun1 = (
        await db.pg.query(`SELECT "value" FROM "admin_settings" WHERE "key" = 'anilist_sync_checkpoint';`)
      ).rows;
      assert.equal(cpAfterRun1.length, 1);
      const parsedCp1 = JSON.parse(cpAfterRun1[0].value);
      assert.equal(parsedCp1.mode, "incremental");
      assert.equal(parsedCp1.stage, "incremental");
      assert.equal(parsedCp1.page, 51);
      assert.equal(parsedCp1.startedAt, Date.parse(run1StartIso));

      const tsAfterRun1 = (
        await db.pg.query(`SELECT "value" FROM "admin_settings" WHERE "key" = 'anilist_sync_last_timestamp';`)
      ).rows[0].value;
      assert.equal(tsAfterRun1, initialTs);

      const persistedRun1Count = (
        await db.pg.query(`SELECT COUNT(*)::int AS c FROM "catalog_anime";`)
      ).rows[0].c;
      assert.equal(persistedRun1Count, 50);

      // Cenário B: Retomada na execução seguinte a partir da página 51
      currentCalls = run2Calls;
      const run2Res = await runSync({
        pool: db.pool,
        redis: createTrackingRedis(),
        argv: ["--manual"],
        rateLimitDelayMs: 0,
        retries: 1,
        now: () => new Date("2026-11-18T10:15:00Z"),
        fetchImpl,
      });

      assert.equal(run2Res.status, "success");
      const incCallsRun2 = run2Calls.filter((c) => c.startsWith("UPDATED_AT_DESC:"));
      assert.deepEqual(incCallsRun2, [
        "UPDATED_AT_DESC:p51",
        "UPDATED_AT_DESC:p52",
        "UPDATED_AT_DESC:p53",
      ]);
      // Confirmar que seguiu para as etapas seguintes somente após concluir incremental
      assert.equal(run2Calls[0], "UPDATED_AT_DESC:p51");
      assert.ok(run2Calls.indexOf("TRENDING_DESC,POPULARITY_DESC:p1") > run2Calls.indexOf("UPDATED_AT_DESC:p53"));
      assert.ok(run2Calls.some((c) => c.startsWith("SEASON:")));
      assert.ok(run2Calls.includes("SCHEDULE:p1"));

      const cpAfterRun2 = (
        await db.pg.query(`SELECT "value" FROM "admin_settings" WHERE "key" = 'anilist_sync_checkpoint';`)
      ).rows;
      assert.equal(cpAfterRun2.length, 0);

      const tsAfterRun2 = (
        await db.pg.query(`SELECT "value" FROM "admin_settings" WHERE "key" = 'anilist_sync_last_timestamp';`)
      ).rows[0].value;
      assert.equal(tsAfterRun2, String(Date.parse(run1StartIso)));

      const persistedRun2Count = (
        await db.pg.query(`SELECT COUNT(*)::int AS c FROM "catalog_anime" WHERE "anilistId" BETWEEN 10001 AND 10053;`)
      ).rows[0].c;
      assert.equal(persistedRun2Count, 53);
    } finally {
      await db.pg.close();
    }
  });

  it("20 (Cenário C). Temporadas incompletas preservam checkpoint sem sobrescrita por schedule e retomam na página pendente", async () => {
    const db = await createRealPglitePool();
    const initialTs = "1700000000000";
    await db.pg.query(
      `INSERT INTO "admin_settings" ("key", "value") VALUES
       ('anilist_sync_initial_completed', 'true'),
       ('anilist_sync_last_timestamp', $1);`,
      [initialTs]
    );

    const run1Calls = [];
    const run2Calls = [];
    let currentCalls = run1Calls;

    const fetchImpl = async (_url, init) => {
      const { query, variables } = JSON.parse(init.body);
      if (query.includes("MediaListQuery")) {
        currentCalls.push(`MEDIA:${variables.sort.join(",")}:p${variables.page}`);
        return jsonResponse({ Page: { pageInfo: { hasNextPage: false }, media: [] } });
      }
      if (query.includes("SeasonQuery")) {
        const key = `${variables.season}-${variables.year}`;
        currentCalls.push(`SEASON:${key}:p${variables.page}`);
        if (key === "WINTER-2025") {
          return jsonResponse({
            Page: {
              pageInfo: { hasNextPage: variables.page < 27 },
              media: [makeMedia(20000 + variables.page, { season: "WINTER", seasonYear: 2025 })],
            },
          });
        }
        return jsonResponse({ Page: { pageInfo: { hasNextPage: false }, media: [] } });
      }
      if (query.includes("AiringScheduleQuery")) {
        currentCalls.push(`SCHEDULE:p${variables.page}`);
        return jsonResponse({ Page: { pageInfo: { hasNextPage: false }, airingSchedules: [] } });
      }
      throw new Error(`Query inesperada: ${query}`);
    };

    try {
      await assert.rejects(
        () =>
          runSync({
            pool: db.pool,
            redis: createTrackingRedis(),
            argv: ["--manual"],
            rateLimitDelayMs: 0,
            retries: 1,
            now: () => new Date("2026-11-18T11:00:00Z"),
            fetchImpl,
          }),
        /incompleta/i
      );

      // Schedule não deve rodar após seasons incompleta e timestamp não avança
      assert.equal(run1Calls.some((c) => c.startsWith("SCHEDULE:")), false);
      const cp1 = JSON.parse(
        (await db.pg.query(`SELECT "value" FROM "admin_settings" WHERE "key" = 'anilist_sync_checkpoint';`)).rows[0].value
      );
      assert.equal(cp1.stage, "seasons");
      assert.equal(cp1.seasonIndex, 0);
      assert.equal(cp1.page, 26);

      const ts1 = (
        await db.pg.query(`SELECT "value" FROM "admin_settings" WHERE "key" = 'anilist_sync_last_timestamp';`)
      ).rows[0].value;
      assert.equal(ts1, initialTs);

      // Retomada da temporada pendente (página 26 -> 27) e conclusão do ciclo
      currentCalls = run2Calls;
      const res2 = await runSync({
        pool: db.pool,
        redis: createTrackingRedis(),
        argv: ["--manual"],
        rateLimitDelayMs: 0,
        retries: 1,
        now: () => new Date("2026-11-18T11:10:00Z"),
        fetchImpl,
      });

      assert.equal(res2.status, "success");
      assert.equal(run2Calls[0], "SEASON:WINTER-2025:p26");
      assert.equal(run2Calls[1], "SEASON:WINTER-2025:p27");
      assert.ok(run2Calls.includes("SCHEDULE:p1"));
      const cp2 = (
        await db.pg.query(`SELECT "value" FROM "admin_settings" WHERE "key" = 'anilist_sync_checkpoint';`)
      ).rows;
      assert.equal(cp2.length, 0);
    } finally {
      await db.pg.close();
    }
  });

  it("21 (Cenário D). Calendário incompleto preserva checkpoint de schedule e não marca conclusão", async () => {
    const db = await createRealPglitePool();
    const run1Calls = [];
    const run2Calls = [];
    let currentCalls = run1Calls;

    const fetchImpl = async (_url, init) => {
      const { query, variables } = JSON.parse(init.body);
      if (query.includes("MediaListQuery")) {
        currentCalls.push(`MEDIA:${variables.sort.join(",")}:p${variables.page}`);
        return jsonResponse({ Page: { pageInfo: { hasNextPage: false }, media: [] } });
      }
      if (query.includes("SeasonQuery")) {
        currentCalls.push(`SEASON:${variables.season}-${variables.year}:p${variables.page}`);
        return jsonResponse({ Page: { pageInfo: { hasNextPage: false }, media: [] } });
      }
      if (query.includes("AiringScheduleQuery")) {
        currentCalls.push(`SCHEDULE:p${variables.page}`);
        const page = variables.page;
        return jsonResponse({
          Page: {
            pageInfo: { hasNextPage: page < 32 },
            airingSchedules: [
              {
                id: 30000 + page,
                airingAt: 1800000000 + page * 60,
                timeUntilAiring: 3600,
                episode: page,
                media: makeMedia(30000 + page),
              },
            ],
          },
        });
      }
      throw new Error(`Query inesperada: ${query}`);
    };

    try {
      const run1Iso = "2026-11-18T12:00:00Z";
      // Modo initial: atinge 30 páginas no calendário com hasNextPage === true
      await assert.rejects(
        () =>
          runSync({
            pool: db.pool,
            redis: createTrackingRedis(),
            argv: ["--manual"],
            rateLimitDelayMs: 0,
            retries: 1,
            now: () => new Date(run1Iso),
            fetchImpl,
          }),
        /incompleta/i
      );

      assert.equal(run1Calls.filter((c) => c.startsWith("SCHEDULE:")).length, 30);

      const cp1 = JSON.parse(
        (await db.pg.query(`SELECT "value" FROM "admin_settings" WHERE "key" = 'anilist_sync_checkpoint';`)).rows[0].value
      );
      assert.equal(cp1.mode, "initial");
      assert.equal(cp1.stage, "schedule");
      assert.equal(cp1.page, 31);

      const initCompleted1 = (
        await db.pg.query(`SELECT "value" FROM "admin_settings" WHERE "key" = 'anilist_sync_initial_completed';`)
      ).rows;
      const lastTs1 = (
        await db.pg.query(`SELECT "value" FROM "admin_settings" WHERE "key" = 'anilist_sync_last_timestamp';`)
      ).rows;
      assert.equal(initCompleted1.length, 0);
      assert.equal(lastTs1.length, 0);

      // Retomada a partir de schedule página 31 -> 32 conclui carga inicial
      currentCalls = run2Calls;
      const res2 = await runSync({
        pool: db.pool,
        redis: createTrackingRedis(),
        argv: ["--manual"],
        rateLimitDelayMs: 0,
        retries: 1,
        now: () => new Date("2026-11-18T12:15:00Z"),
        fetchImpl,
      });

      assert.equal(res2.status, "success");
      assert.deepEqual(run2Calls, ["SCHEDULE:p31", "SCHEDULE:p32"]);

      const cp2 = (
        await db.pg.query(`SELECT "value" FROM "admin_settings" WHERE "key" = 'anilist_sync_checkpoint';`)
      ).rows;
      const initCompleted2 = (
        await db.pg.query(`SELECT "value" FROM "admin_settings" WHERE "key" = 'anilist_sync_initial_completed';`)
      ).rows[0].value;
      const lastTs2 = (
        await db.pg.query(`SELECT "value" FROM "admin_settings" WHERE "key" = 'anilist_sync_last_timestamp';`)
      ).rows[0].value;

      assert.equal(cp2.length, 0);
      assert.equal(initCompleted2, "true");
      assert.equal(lastTs2, String(Date.parse(run1Iso)));
    } finally {
      await db.pg.close();
    }
  });

  it("22 (Cenário E). Execução completa limpa checkpoints e atualiza marcadores finais corretamente", async () => {
    const db = await createRealPglitePool();
    await db.pg.query(
      `INSERT INTO "admin_settings" ("key", "value") VALUES ('anilist_sync_checkpoint', '{"mode":"initial","stage":"trending","page":1,"startedAt":1700000000000}');`
    );

    const fetchImpl = async (_url, init) => {
      const { query } = JSON.parse(init.body);
      if (query.includes("AiringScheduleQuery")) {
        return jsonResponse({
          Page: {
            pageInfo: { hasNextPage: false },
            airingSchedules: [
              {
                id: 40001,
                airingAt: 1800000000,
                timeUntilAiring: 1200,
                episode: 1,
                media: makeMedia(40001),
              },
            ],
          },
        });
      }
      return jsonResponse({ Page: { pageInfo: { hasNextPage: false }, media: [makeMedia(40002)] } });
    };

    try {
      const res = await runSync({
        pool: db.pool,
        redis: createTrackingRedis(),
        argv: ["--manual"],
        rateLimitDelayMs: 0,
        retries: 1,
        now: () => new Date("2026-11-18T14:00:00Z"),
        fetchImpl,
      });

      assert.equal(res.status, "success");
      const cp = (
        await db.pg.query(`SELECT "value" FROM "admin_settings" WHERE "key" = 'anilist_sync_checkpoint';`)
      ).rows;
      const initDone = (
        await db.pg.query(`SELECT "value" FROM "admin_settings" WHERE "key" = 'anilist_sync_initial_completed';`)
      ).rows[0].value;
      const lastTs = (
        await db.pg.query(`SELECT "value" FROM "admin_settings" WHERE "key" = 'anilist_sync_last_timestamp';`)
      ).rows[0].value;

      assert.equal(cp.length, 0);
      assert.equal(initDone, "true");
      assert.equal(lastTs, "1700000000000");
    } finally {
      await db.pg.close();
    }
  });

  it("23. Orçamento de tempo (timeBudgetMs) pausa em checkpoint limpo sem marcar erro e retoma até concluir", async () => {
    const db = await createRealPglitePool();
    await db.pg.query(
      `INSERT INTO "admin_settings" ("key", "value") VALUES
       ('anilist_sync_initial_completed', 'true'),
       ('anilist_sync_last_timestamp', '1700000000000');`
    );

    const calls = [];
    const fetchImpl = async (_url, init) => {
      const { query, variables } = JSON.parse(init.body);
      // Pequeno atraso artificial para estourar timeBudgetMs=15 após 1 página
      await new Promise((r) => setTimeout(r, 20));
      if (query.includes("MediaListQuery")) {
        const sort = variables.sort.join(",");
        calls.push(`${sort}:p${variables.page}`);
        if (sort === "UPDATED_AT_DESC") {
          return jsonResponse({
            Page: {
              pageInfo: { hasNextPage: variables.page < 2 },
              media: [makeMedia(50000 + variables.page, { updatedAt: 1700100000 })],
            },
          });
        }
        return jsonResponse({ Page: { pageInfo: { hasNextPage: false }, media: [] } });
      }
      if (query.includes("SeasonQuery")) {
        calls.push(`SEASON:${variables.season}-${variables.year}:p${variables.page}`);
        return jsonResponse({ Page: { pageInfo: { hasNextPage: false }, media: [] } });
      }
      if (query.includes("AiringScheduleQuery")) {
        calls.push(`SCHEDULE:p${variables.page}`);
        return jsonResponse({ Page: { pageInfo: { hasNextPage: false }, airingSchedules: [] } });
      }
      throw new Error(`Query inesperada: ${query}`);
    };

    try {
      const progressEvents = [];
      const slice1 = await runSync({
        pool: db.pool,
        redis: createTrackingRedis(),
        argv: ["--manual"],
        rateLimitDelayMs: 0,
        retries: 1,
        timeBudgetMs: 15,
        onProgress: (evt) => progressEvents.push(evt),
        fetchImpl,
      });

      assert.equal(slice1.status, "paused_checkpoint");
      assert.equal(slice1.paused, true);
      assert.ok(progressEvents.length >= 1);
      assert.equal(calls.includes("UPDATED_AT_DESC:p1"), true);
      assert.equal(calls.includes("UPDATED_AT_DESC:p2"), false);

      const cpAfterSlice1 = JSON.parse(
        (
          await db.pg.query(
            `SELECT "value" FROM "admin_settings" WHERE "key" = 'anilist_sync_checkpoint';`
          )
        ).rows[0].value
      );
      assert.equal(cpAfterSlice1.stage, "incremental");
      assert.equal(cpAfterSlice1.page, 2);

      // Retoma sem limite de tempo até concluir integralmente
      const slice2 = await runSync({
        pool: db.pool,
        redis: createTrackingRedis(),
        argv: ["--manual"],
        rateLimitDelayMs: 0,
        retries: 1,
        fetchImpl,
      });

      assert.equal(slice2.status, "success");
      assert.equal(calls.includes("UPDATED_AT_DESC:p2"), true);
      assert.equal(calls.includes("SCHEDULE:p1"), true);
    } finally {
      await db.pg.close();
    }
  });
});

