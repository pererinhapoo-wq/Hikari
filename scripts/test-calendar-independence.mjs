import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { pendingMigrations } from "./migration-plan.mjs";
import {
  getDayKeySaoPaulo,
  getDayUtcRangeSaoPaulo,
  getTodayRangeSaoPaulo,
  getWeekInfoSaoPaulo,
} from "../src/lib/calendar-timezone.ts";
import {
  getTodayScheduleFromDbAndRedis,
  invalidateLocalTodayScheduleCache,
  mapTodayScheduleRowsToSlimAnime,
} from "../src/lib/calendar-schedule.server.ts";
import { runSync } from "./anilist-sync.mjs";
import { isAuthorizedAdminAccount } from "../src/lib/auth/admin-guard.ts";

async function createPgliteWithMigrations() {
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
  const sql = (async (strings, ...values) => {
    let text = strings[0];
    for (let i = 0; i < values.length; i++) {
      text += `$${i + 1}${strings[i + 1]}`;
    }
    const res = await pg.query(text, values);
    return res.rows;
  });
  sql.query = async (text, params = []) => {
    const res = await pg.query(text, params);
    return res.rows;
  };

  const client = {
    async query(sqlText, params = []) {
      const normalized = sqlText.replace(/\s+/g, " ").trim();
      if (normalized.startsWith("SELECT pg_try_advisory_lock")) {
        if (lockHeld) return { rows: [{ locked: false }] };
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

  const pool = {
    async connect() {
      return client;
    },
    async end() {},
  };

  return { pg, sql, pool };
}

function createMockRedis() {
  const kv = new Map();
  const incrs = [];
  const dels = [];
  const scans = [];

  return {
    async get(key) {
      return kv.has(key) ? kv.get(key) : null;
    },
    async set(key, value) {
      kv.set(key, value);
      return "OK";
    },
    async incr(key) {
      incrs.push(key);
      const next = (Number(kv.get(key)) || 0) + 1;
      kv.set(key, next);
      return next;
    },
    async del(...keys) {
      dels.push(...keys);
      let removed = 0;
      for (const k of keys) {
        if (kv.delete(k)) removed++;
      }
      return removed;
    },
    async scan(cursor, opts = {}) {
      scans.push({ cursor: String(cursor), match: opts.match });
      const prefix = String(opts.match || "").replace(/\*$/, "");
      const matched = Array.from(kv.keys()).filter((k) => k.startsWith(prefix));
      return ["0", matched];
    },
    getState: () => ({ kv, incrs, dels, scans }),
  };
}

describe("Calendário Independente da AniList (Neon + Redis + America/Sao_Paulo)", () => {
  it("1. Calcula corretamente America/Sao_Paulo mesmo após meia-noite UTC (23:30 BRT = 02:30 UTC do dia seguinte)", () => {
    // 2026-04-06T23:30:00-03:00 === 2026-04-07T02:30:00Z
    const lateNightBrt = new Date("2026-04-07T02:30:00Z");
    assert.equal(getDayKeySaoPaulo(lateNightBrt), "2026-04-06");

    const { startTimestamp, endTimestamp } = getDayUtcRangeSaoPaulo("2026-04-06");
    assert.equal(new Date(startTimestamp * 1000).toISOString(), "2026-04-06T03:00:00.000Z");
    assert.equal(new Date(endTimestamp * 1000).toISOString(), "2026-04-07T02:59:59.000Z");

    const lateNightSec = Math.floor(lateNightBrt.getTime() / 1000);
    assert.ok(lateNightSec >= startTimestamp && lateNightSec <= endTimestamp);

    const weekInfo = getWeekInfoSaoPaulo(0, lateNightBrt);
    assert.equal(weekInfo.weekKey, "2026-04-06");
    assert.equal(weekInfo.days[0].isToday, true);
    assert.equal(weekInfo.days[1].dateKey, "2026-04-07");
  });

  it("2. Auditoria estática garante zero chamadas à AniList na navegação do calendário e da programação de hoje", () => {
    const calendarSrc = fs.readFileSync(path.join(process.cwd(), "src/routes/calendar.tsx"), "utf8");
    const todaySectionSrc = fs.readFileSync(
      path.join(process.cwd(), "src/components/today-episodes-section.tsx"),
      "utf8",
    );
    const scheduleServerSrc = fs.readFileSync(
      path.join(process.cwd(), "src/lib/calendar-schedule.server.ts"),
      "utf8",
    );
    const apiSrc = fs.readFileSync(path.join(process.cwd(), "src/lib/api.ts"), "utf8");
    const syncRouteSrc = fs.readFileSync(
      path.join(process.cwd(), "src/routes/api/admin/calendar-sync.ts"),
      "utf8",
    );

    assert.equal(calendarSrc.includes("graphql.anilist.co"), false);
    assert.equal(calendarSrc.includes("anilistGraphQL"), false);
    assert.equal(calendarSrc.includes("catalog_episode"), false); // Não filtra por episódio publicado no WHERE!
    assert.equal(todaySectionSrc.includes("PERIODIC_SYNC_MS"), false);
    assert.equal(todaySectionSrc.includes("selectHomeSectionItems"), false);
    assert.equal(scheduleServerSrc.includes("anilist"), true); // apenas nome da coluna anilistId!
    assert.equal(scheduleServerSrc.includes("graphql.anilist.co"), false);
    assert.equal(apiSrc.includes("fetchTodayScheduleFromAni"), false);
    assert.equal(apiSrc.includes("fetchRawTodaySchedulesFromAni"), false);
    assert.ok(syncRouteSrc.includes("assertSameSiteRequest"));
    assert.ok(syncRouteSrc.includes("requireAdminUser"));
  });

  it("3. Avanço automático de Segunda -> Terça -> Quarta -> Próxima Semana sem sincronização, sem exigir episódio publicado e preservando histórico", async () => {
    const { pg, sql } = await createPgliteWithMigrations();

    try {
      // Popula animes com e sem episódio publicado
      await pg.query(
        `INSERT INTO "catalog_anime" ("id", "title", "anilistId", "format", "status", "genres")
         VALUES
           ('anilist-101', 'Anime Segunda Sem Ep', 101, 'TV', 'RELEASING', ARRAY['Action']),
           ('anilist-102', 'Anime Terca Com Ep', 102, 'TV', 'RELEASING', ARRAY['Comedy']),
           ('anilist-103', 'Anime Quarta Madrugada', 103, 'TV', 'RELEASING', ARRAY['Drama']),
           ('anilist-104', 'Anime Semana Seguinte', 104, 'TV', 'RELEASING', ARRAY['Fantasy']),
           ('anilist-105', 'Anime Oculto', 105, 'TV', 'RELEASING', ARRAY['Action']),
           ('anilist-106', 'Anime Hentai', 106, 'OVA', 'RELEASING', ARRAY['Hentai']);`,
      );
      await pg.query(`UPDATE "catalog_anime" SET "hidden" = true WHERE "id" = 'anilist-105';`);
      await pg.query(
        `INSERT INTO "catalog_episode" ("id", "animeId", "seasonNumber", "number", "published")
         VALUES ('ep-102-1', 'anilist-102', 1, 1, true);`,
      );

      // Datas em America/Sao_Paulo:
      // Segunda 2026-04-06 10:00 BRT
      // Terça   2026-04-07 18:00 BRT
      // Quarta  2026-04-08 23:30 BRT (02:30 UTC de 2026-04-09!)
      // Próx. Segunda 2026-04-13 12:00 BRT
      const schedules = [
        ["s-mon", 101, "anilist-101", 5, "2026-04-06T13:00:00Z"],
        ["s-tue", 102, "anilist-102", 6, "2026-04-07T21:00:00Z"],
        ["s-wed", 103, "anilist-103", 7, "2026-04-09T02:30:00Z"],
        ["s-next", 104, "anilist-104", 8, "2026-04-13T15:00:00Z"],
        ["s-hidden", 105, "anilist-105", 1, "2026-04-06T15:00:00Z"],
        ["s-hentai", 106, "anilist-106", 1, "2026-04-06T16:00:00Z"],
      ];
      for (const [id, anilistId, animeId, episode, airingAt] of schedules) {
        await pg.query(
          `INSERT INTO "catalog_airing_schedule" ("id", "anilistId", "animeId", "episode", "airingAt")
           VALUES ($1, $2, $3, $4, $5::timestamptz);`,
          [id, anilistId, animeId, episode, airingAt],
        );
      }

      const originalFetch = globalThis.fetch;
      let fetchCalled = 0;
      globalThis.fetch = async () => {
        fetchCalled++;
        throw new Error("AniList não deve ser chamada durante a navegação!");
      };

      try {
        // Segunda-feira às 22:00 BRT (mesmo depois das 10:00 BRT em que já foi exibido!)
        const monLate = new Date("2026-04-07T01:00:00Z"); // 22:00 BRT de segunda 06/04
        const monItems = await getTodayScheduleFromDbAndRedis({ sql, now: monLate });
        assert.equal(monItems.length, 1);
        assert.equal(monItems[0].anilistId, 101);
        assert.equal(monItems[0].todayEpisode?.number, 5);
        assert.equal(monItems[0].hasEpisode, false);

        // Terça-feira às 12:00 BRT
        const tueNoon = new Date("2026-04-07T15:00:00Z");
        const tueItems = await getTodayScheduleFromDbAndRedis({ sql, now: tueNoon });
        assert.equal(tueItems.length, 1);
        assert.equal(tueItems[0].anilistId, 102);
        assert.equal(tueItems[0].hasEpisode, true);

        // Quarta-feira às 23:45 BRT (02:45 UTC de quinta!)
        const wedNight = new Date("2026-04-09T02:45:00Z");
        const wedItems = await getTodayScheduleFromDbAndRedis({ sql, now: wedNight });
        assert.equal(wedItems.length, 1);
        assert.equal(wedItems[0].anilistId, 103);

        // Semana seguinte (segunda 13/04): consulta por intervalo de semana funciona e semana anterior continua preservada!
        const nextWeek = getWeekInfoSaoPaulo(1, tueNoon);
        const pastWeek = getWeekInfoSaoPaulo(0, new Date("2026-04-14T15:00:00Z"));
        const nextWeekRows = await sql.query(
          `SELECT s."anilistId" FROM "catalog_airing_schedule" s
           JOIN "catalog_anime" a ON s."animeId" = a."id"
           WHERE s."airingAt" >= to_timestamp($1) AND s."airingAt" <= to_timestamp($2)
             AND (a."hidden" IS NOT TRUE);`,
          [nextWeek.startTimestamp, nextWeek.endTimestamp],
        );
        assert.deepEqual(nextWeekRows.map((r) => r.anilistId), [104]);

        const prevWeekRows = await sql.query(
          `SELECT s."anilistId" FROM "catalog_airing_schedule" s
           JOIN "catalog_anime" a ON s."animeId" = a."id"
           WHERE s."airingAt" >= to_timestamp($1) AND s."airingAt" <= to_timestamp($2)
             AND (a."hidden" IS NOT TRUE);`,
          [pastWeek.startTimestamp - 7 * 86400, pastWeek.endTimestamp - 7 * 86400],
        );
        assert.equal(prevWeekRows.length >= 3, true);
        assert.equal(fetchCalled, 0);
      } finally {
        globalThis.fetch = originalFetch;
      }
    } finally {
      await pg.close();
    }
  });

  it("4. Cache Upstash Redis (HIT, invalidação por geração e fallback fail-open) sem consultar AniList", async () => {
    const { pg, sql } = await createPgliteWithMigrations();
    const now = new Date("2026-04-06T15:00:00Z");

    try {
      await pg.query(
        `INSERT INTO "catalog_anime" ("id", "title", "anilistId") VALUES ('anilist-201', 'Anime Cacheado', 201);`,
      );
      await pg.query(
        `INSERT INTO "catalog_airing_schedule" ("id", "anilistId", "animeId", "episode", "airingAt")
         VALUES ('s-201', 201, 'anilist-201', 2, '2026-04-06T18:00:00Z');`,
      );

      let dbQueries = 0;
      const countingSql = Object.assign(
        (...args) => sql(...args),
        {
          query: async (text, params) => {
            dbQueries++;
            return sql.query(text, params);
          },
        },
      );

      const memRedis = new Map();
      const redisGet = async (dayKey) => memRedis.get(dayKey) ?? null;
      const redisSet = async (dayKey, data) => {
        memRedis.set(dayKey, data);
      };

      // 1ª chamada: MISS no Redis -> lê do PostgreSQL e grava no Redis
      const first = await getTodayScheduleFromDbAndRedis({
        sql: countingSql,
        redisGet,
        redisSet,
        now,
      });
      assert.equal(first.length, 1);
      assert.equal(dbQueries, 1);

      // 2ª chamada: HIT no Redis -> ZERO consultas ao PostgreSQL!
      const second = await getTodayScheduleFromDbAndRedis({
        sql: countingSql,
        redisGet,
        redisSet,
        now,
      });
      assert.equal(second.length, 1);
      assert.equal(dbQueries, 1);

      // Fail-open se Redis falhar
      const third = await getTodayScheduleFromDbAndRedis({
        sql: countingSql,
        redisGet: async () => {
          throw new Error("Redis timeout");
        },
        redisSet: async () => {
          throw new Error("Redis write timeout");
        },
        now,
      });
      assert.equal(third.length, 1);
      assert.equal(dbQueries, 2);

      // Cache de lista vazia ([]) também funciona sem reconsultar banco
      const { todayKey } = getTodayRangeSaoPaulo(new Date("2026-04-20T15:00:00Z"));
      const emptyCached = await getTodayScheduleFromDbAndRedis({
        sql: countingSql,
        redisGet,
        redisSet,
        now: new Date("2026-04-20T15:00:00Z"),
      });
      assert.deepEqual(emptyCached, []);
      assert.deepEqual(memRedis.get(todayKey), []);
      const emptyHit = await getTodayScheduleFromDbAndRedis({
        sql: countingSql,
        redisGet,
        redisSet,
        now: new Date("2026-04-20T15:00:00Z"),
      });
      assert.deepEqual(emptyHit, []);
      assert.equal(dbQueries, 3);
      invalidateLocalTodayScheduleCache();
      assert.equal(
        mapTodayScheduleRowsToSlimAnime([], "2026-04-20").length,
        0,
      );
    } finally {
      await pg.close();
    }
  });

  it("5. Sincronização administrativa (90 dias, idempotente) preserva dados manuais, episódios, fontes e bloqueia não-admins", async () => {
    const { pg, pool } = await createPgliteWithMigrations();
    const redis = createMockRedis();

    try {
      // Verifica proteção admin-guard: dev-user e usuário comum não são admin
      assert.equal(
        await isAuthorizedAdminAccount({ userId: "dev-user", email: "dev@example.com", profileRole: "admin" }),
        false,
      );
      assert.equal(
        await isAuthorizedAdminAccount({ userId: "usr-1", email: "user@example.com", profileRole: "user" }),
        false,
      );
      assert.equal(
        await isAuthorizedAdminAccount({ userId: "adm-1", email: "admin@example.com", profileRole: "admin" }),
        true,
      );

      // Anime pré-existente com título manual, capa customizada, episódio e fonte de vídeo
      await pg.query(
        `INSERT INTO "catalog_anime" ("id", "title", "anilistId", "cover", "manual_fields")
         VALUES ('anilist-501', 'Título Editado Manualmente', 501, 'https://cdn.hikari.local/custom-cover.webp', ARRAY['title']);`,
      );
      await pg.query(
        `INSERT INTO "catalog_season" ("animeId", "number", "title", "position")
         VALUES ('anilist-501', 1, 'Temporada Especial Manual', 1);`,
      );
      await pg.query(
        `INSERT INTO "catalog_episode" ("id", "animeId", "seasonNumber", "number", "title", "videoUrl", "published")
         VALUES ('ep-501-1', 'anilist-501', 1, 1, 'Episódio Preservado', 'https://video.example/1.m3u8', true);`,
      );
      await pg.query(
        `INSERT INTO "episode_sources" ("episode_id", "provider", "page_url", "direct_url", "priority")
         VALUES ('ep-501-1', 'hikari-hls', 'https://video.example/watch/1', 'https://video.example/1.m3u8', 1);`,
      );
      // Registro antigo já exibido no passado que NÃO deve ser apagado pela sincronização
      await pg.query(
        `INSERT INTO "catalog_airing_schedule" ("id", "anilistId", "animeId", "episode", "airingAt")
         VALUES ('sched-501-1', 501, 'anilist-501', 1, '2026-01-01T15:00:00Z');`,
      );

      const nowFixed = new Date("2026-04-06T12:00:00Z");
      let capturedVariables = null;
      let episode5AiringAt = Math.floor(Date.parse("2026-06-15T18:00:00Z") / 1000); // ~70 dias no futuro!

      const fetchImpl = async (_url, init) => {
        const { variables } = JSON.parse(init.body);
        capturedVariables = variables;
        return {
          ok: true,
          status: 200,
          headers: { get: () => null },
          async json() {
            return {
              data: {
                Page: {
                  pageInfo: { hasNextPage: false },
                  airingSchedules: [
                    {
                      id: 99001,
                      episode: 5,
                      airingAt: episode5AiringAt,
                      timeUntilAiring: 1000,
                      media: {
                        id: 501,
                        idMal: 5501,
                        title: { romaji: "Romaji 501", english: "AniList Title Should Not Overwrite", native: "501" },
                        coverImage: { extraLarge: "https://s4.anilist.co/file/501.jpg", large: "https://s4.anilist.co/file/501.jpg" },
                        bannerImage: "https://s4.anilist.co/banner/501.jpg",
                        description: "Sinopse AniList",
                        format: "TV",
                        status: "RELEASING",
                        episodes: 12,
                        season: "SPRING",
                        seasonYear: 2026,
                        averageScore: 88,
                        popularity: 10000,
                        trending: 500,
                        genres: ["Action"],
                        trailer: null,
                      },
                    },
                    {
                      id: 99002,
                      episode: 1,
                      airingAt: Math.floor(Date.parse("2026-06-20T18:00:00Z") / 1000),
                      timeUntilAiring: 2000,
                      media: {
                        id: 502,
                        idMal: 5502,
                        title: { romaji: "Novo Anime 502", english: "New Anime 502", native: "502" },
                        coverImage: { extraLarge: "https://s4.anilist.co/file/502.jpg", large: "https://s4.anilist.co/file/502.jpg" },
                        bannerImage: null,
                        description: "Sinopse 502",
                        format: "TV",
                        status: "NOT_YET_RELEASED",
                        episodes: 12,
                        season: "SPRING",
                        seasonYear: 2026,
                        averageScore: null,
                        popularity: 5000,
                        trending: 100,
                        genres: ["Fantasy"],
                        trailer: null,
                      },
                    },
                  ],
                },
              },
            };
          },
        };
      };

      const res1 = await runSync({
        pool,
        redis,
        mode: "schedule",
        scheduleDaysForward: 90,
        rateLimitDelayMs: 0,
        retries: 1,
        now: () => nowFixed,
        fetchImpl,
      });

      assert.equal(res1.status, "success");
      assert.equal(res1.mode, "schedule");
      assert.equal(res1.importedSchedulesCount, 2);

      // Confirma janela de 90 dias no pedido à AniList
      assert.ok(capturedVariables.end - capturedVariables.start >= 90 * 86400);

      // Dados manuais, capa personalizada, temporada personalizada, episódio, fonte e histórico preservados!
      const anime501 = (await pg.query(`SELECT "title", "cover" FROM "catalog_anime" WHERE "id" = 'anilist-501';`)).rows[0];
      assert.equal(anime501.title, "Título Editado Manualmente");
      assert.equal(anime501.cover, "https://cdn.hikari.local/custom-cover.webp");

      const season501 = (await pg.query(`SELECT "title" FROM "catalog_season" WHERE "animeId" = 'anilist-501' AND "number" = 1;`)).rows[0];
      assert.equal(season501.title, "Temporada Especial Manual");

      const season502 = (await pg.query(`SELECT "title" FROM "catalog_season" WHERE "animeId" = 'anilist-502' AND "number" = 1;`)).rows[0];
      assert.equal(season502.title, "Temporada 1");

      const episodesCount = (await pg.query(`SELECT COUNT(*)::int AS c FROM "catalog_episode" WHERE "animeId" = 'anilist-501';`)).rows[0].c;
      const sourcesCount = (await pg.query(`SELECT COUNT(*)::int AS c FROM "episode_sources" WHERE "episode_id" = 'ep-501-1';`)).rows[0].c;
      const pastScheduleExists = (await pg.query(`SELECT COUNT(*)::int AS c FROM "catalog_airing_schedule" WHERE "id" = 'sched-501-1';`)).rows[0].c;
      assert.equal(episodesCount, 1);
      assert.equal(sourcesCount, 1);
      assert.equal(pastScheduleExists, 1);

      // Re-sincronização idempotente após mudança de horário na AniList (sem duplicação)
      episode5AiringAt += 3600; // atrasou 1 hora
      const res2 = await runSync({
        pool,
        redis,
        mode: "schedule",
        scheduleDaysForward: 90,
        rateLimitDelayMs: 0,
        retries: 1,
        now: () => nowFixed,
        fetchImpl,
      });
      assert.equal(res2.status, "success");

      const sched5Rows = (
        await pg.query(
          `SELECT EXTRACT(EPOCH FROM "airingAt")::int AS epoch FROM "catalog_airing_schedule" WHERE "anilistId" = 501 AND "episode" = 5;`,
        )
      ).rows;
      assert.equal(sched5Rows.length, 1);
      assert.equal(sched5Rows[0].epoch, episode5AiringAt);

      // Confirma invalidação no Redis de calendário (week + today + contador atômico)
      const redisStats = redis.getState();
      assert.ok(redisStats.incrs.includes("hikari:calendar:gen:v1"));
      assert.ok(redisStats.scans.some((s) => s.match === "hikari:calendar:today:v1:*"));
      assert.ok(redisStats.scans.some((s) => s.match === "hikari:calendar:week:v1:*"));
    } finally {
      await pg.close();
    }
  });
});
