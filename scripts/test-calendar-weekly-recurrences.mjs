import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { pendingMigrations } from "./migration-plan.mjs";
import {
  CALENDAR_TIMEZONE,
  getDayKeySaoPaulo,
  getWeekInfoSaoPaulo,
  getWeekdaySaoPaulo,
} from "../src/lib/calendar-timezone.ts";
import {
  CalendarRecurrenceError,
  createCalendarRecurrence,
  deleteCalendarRecurrence,
  getTodayScheduleFromDbAndRedis,
  getWeeklyScheduleFromDbAndRedis,
  invalidateLocalTodayScheduleCache,
  listCalendarRecurrences,
  searchCatalogAnimesForRecurrence,
  updateCalendarRecurrence,
} from "../src/lib/calendar-schedule.server.ts";
import { invalidateRedisCalendar } from "../src/lib/redis.ts";
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
  const sql = async (strings, ...values) => {
    let text = strings[0];
    for (let i = 0; i < values.length; i++) {
      text += `$${i + 1}${strings[i + 1]}`;
    }
    const res = await pg.query(text, values);
    return res.rows;
  };
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
      const res = await pg.query(sqlText, params);
      return { rows: res.rows };
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

function createMockRedisClient() {
  const store = new Map();
  let gen = 0;
  const stats = { incrs: [], dels: [], scans: [] };

  return {
    store,
    stats,
    async incr(key) {
      stats.incrs.push(key);
      if (key === "hikari:calendar:gen:v1") {
        gen += 1;
        store.set(key, String(gen));
        return gen;
      }
      const next = Number(store.get(key) || "0") + 1;
      store.set(key, String(next));
      return next;
    },
    async get(key) {
      return store.get(key) ?? null;
    },
    async set(key, value) {
      store.set(key, value);
      return "OK";
    },
    async del(...keys) {
      stats.dels.push(...keys);
      let count = 0;
      for (const k of keys) {
        if (store.delete(k)) count += 1;
      }
      return count;
    },
    async scan(_cursor, opts = {}) {
      const pattern = opts.match || "*";
      stats.scans.push(pattern);
      const prefix = pattern.endsWith("*") ? pattern.slice(0, -1) : pattern;
      const matched = Array.from(store.keys()).filter((k) =>
        pattern.endsWith("*") ? k.startsWith(prefix) : k === pattern,
      );
      return [0, matched];
    },
  };
}

describe("Hikari — Programação semanal recorrente de animes", () => {
  it("1-4. Cadastra anime para toda segunda-feira, previne duplicidade, aparece em múltiplas segundas, não na terça e persiste entre semanas sem AniList", async () => {
    const { pg, sql } = await createPgliteWithMigrations();
    try {
      await pg.query(
        `INSERT INTO "catalog_anime" ("id", "title", "anilistId", "format", "status", "genres", "year")
         VALUES
           ('test-anime-mon', 'Anime Teste Segunda', 9901, 'TV', 'RELEASING', ARRAY['Action'], 2026),
           ('local-anime-wed', 'Anime Manual Quarta', NULL, 'ONA', 'RELEASING', ARRAY['Fantasy'], 2026);`,
      );

      const mockRedis = createMockRedisClient();
      const created = await createCalendarRecurrence(
        { animeId: "test-anime-mon", dayOfWeek: 0 },
        { sql, redisOverride: mockRedis },
      );

      assert.equal(created.animeId, "test-anime-mon");
      assert.equal(created.dayOfWeek, 0);
      assert.equal(created.timezone, CALENDAR_TIMEZONE);
      assert.equal(created.active, true);

      // Impede duplicidade para o mesmo anime + mesmo dia da semana
      await assert.rejects(
        () => createCalendarRecurrence({ animeId: "test-anime-mon", dayOfWeek: 0 }, { sql }),
        (err) => err instanceof CalendarRecurrenceError && err.status === 409,
      );

      // Verifica também anime manual sem anilistId na quarta-feira (dayOfWeek = 2)
      const manualRec = await createCalendarRecurrence(
        { animeId: "local-anime-wed", dayOfWeek: 2 },
        { sql, redisOverride: mockRedis },
      );
      assert.equal(manualRec.anime.anilistId, null);

      const list = await listCalendarRecurrences(sql);
      assert.equal(list.length, 2);

      // Busca no catálogo local (sem AniList)
      const searchHits = await searchCatalogAnimesForRecurrence("Manual", sql);
      assert.equal(searchHits.length, 1);
      assert.equal(searchHits[0].id, "local-anime-wed");

      // Verifica semana passada (-1), semana atual (0), próxima (+1) e futura (+3)
      const baseMondayBrt = new Date("2026-04-06T15:00:00Z"); // 2026-04-06 = Segunda-feira
      for (const offset of [-1, 0, 1, 3]) {
        const weekInfo = getWeekInfoSaoPaulo(offset, baseMondayBrt);
        const weekItems = await getWeeklyScheduleFromDbAndRedis(
          {
            startTimestamp: weekInfo.startTimestamp,
            endTimestamp: weekInfo.endTimestamp,
            weekKey: weekInfo.weekKey,
            days: weekInfo.days,
          },
          { sql },
        );

        const monItems = weekItems.filter(
          (i) => getDayKeySaoPaulo(i.airingAt) === weekInfo.days[0].dateKey,
        );
        const tueItems = weekItems.filter(
          (i) => getDayKeySaoPaulo(i.airingAt) === weekInfo.days[1].dateKey,
        );
        const wedItems = weekItems.filter(
          (i) => getDayKeySaoPaulo(i.airingAt) === weekInfo.days[2].dateKey,
        );

        assert.equal(monItems.length, 1, `Segunda (offset ${offset}) deve conter 1 anime recorrente`);
        assert.equal(monItems[0].media.animeId, "test-anime-mon");
        assert.equal(monItems[0].isRecurring, true);

        assert.equal(tueItems.length, 0, `Terça (offset ${offset}) deve estar vazia`);

        assert.equal(wedItems.length, 1, `Quarta (offset ${offset}) deve conter anime manual sem anilistId`);
        assert.equal(wedItems[0].media.animeId, "local-anime-wed");
        assert.equal(wedItems[0].media.id, 0);
      }
    } finally {
      await pg.close();
    }
  });

  it("5-6. Home ('Episódios de Hoje') e /calendar mostram recorrência no dia certo e avançam automaticamente sem AniList", async () => {
    const { pg, sql } = await createPgliteWithMigrations();
    try {
      await pg.query(
        `INSERT INTO "catalog_anime" ("id", "title", "anilistId", "format", "status", "genres")
         VALUES ('test-home-mon', 'Anime Home Segunda', 9902, 'TV', 'RELEASING', ARRAY['Comedy']);`,
      );
      await createCalendarRecurrence({ animeId: "test-home-mon", dayOfWeek: 0 }, { sql });

      invalidateLocalTodayScheduleCache();
      // Segunda-feira 2026-04-06
      const mondayToday = await getTodayScheduleFromDbAndRedis({
        sql,
        now: new Date("2026-04-06T16:00:00Z"),
        skipLocalCache: true,
      });
      assert.equal(mondayToday.length, 1);
      assert.equal(mondayToday[0].id, "test-home-mon");

      // Terça-feira 2026-04-07 (não aparece)
      const tuesdayToday = await getTodayScheduleFromDbAndRedis({
        sql,
        now: new Date("2026-04-07T16:00:00Z"),
        skipLocalCache: true,
      });
      assert.equal(tuesdayToday.length, 0);

      // Próxima segunda-feira 2026-04-13 (reaparece automaticamente sem sync)
      const nextMondayToday = await getTodayScheduleFromDbAndRedis({
        sql,
        now: new Date("2026-04-13T16:00:00Z"),
        skipLocalCache: true,
      });
      assert.equal(nextMondayToday.length, 1);
      assert.equal(nextMondayToday[0].id, "test-home-mon");

      // Auditoria estática de independência da AniList em calendar.tsx e today-episodes-section.tsx
      const calendarSrc = fs.readFileSync(path.join(process.cwd(), "src/routes/calendar.tsx"), "utf8");
      const todaySrc = fs.readFileSync(path.join(process.cwd(), "src/components/today-episodes-section.tsx"), "utf8");
      assert.equal(calendarSrc.includes("graphql.anilist.co"), false);
      assert.equal(calendarSrc.includes("catalog_episode"), false);
      assert.equal(todaySrc.includes("graphql.anilist.co"), false);
    } finally {
      await pg.close();
    }
  });

  it("7-8. Deduplica quando existe horário específico no mesmo dia e nunca inventa horário ou número de episódio", async () => {
    const { pg, sql } = await createPgliteWithMigrations();
    try {
      await pg.query(
        `INSERT INTO "catalog_anime" ("id", "title", "anilistId", "format", "status", "genres")
         VALUES ('test-dedup-mon', 'Anime Dedup Segunda', 9903, 'TV', 'RELEASING', ARRAY['Drama']);`,
      );
      await createCalendarRecurrence({ animeId: "test-dedup-mon", dayOfWeek: 0 }, { sql });

      // Registro específico somente em 2026-04-06 (Episódio 8 às 10:00 BRT = 13:00 UTC)
      await pg.query(
        `INSERT INTO "catalog_airing_schedule" ("id", "anilistId", "animeId", "episode", "airingAt")
         VALUES ('sched-9903-8', 9903, 'test-dedup-mon', 8, '2026-04-06T13:00:00Z'::timestamptz);`,
      );

      // Na Home em 2026-04-06 -> 1 único item, com episódio real 8 (sem duplicar com recorrência)
      const todayApril6 = await getTodayScheduleFromDbAndRedis({
        sql,
        now: new Date("2026-04-06T16:00:00Z"),
        skipLocalCache: true,
      });
      assert.equal(todayApril6.length, 1);
      assert.equal(todayApril6[0].todayEpisode?.number, 8);

      // Na Home na segunda seguinte 2026-04-13 (sem específico) -> aparece pela recorrência com number: 0 (sem inventar episódio)
      const todayApril13 = await getTodayScheduleFromDbAndRedis({
        sql,
        now: new Date("2026-04-13T16:00:00Z"),
        skipLocalCache: true,
      });
      assert.equal(todayApril13.length, 1);
      assert.equal(todayApril13[0].todayEpisode?.number, 0);

      // No /calendar da semana 2026-04-06 -> apenas 1 entrada na segunda (específico Ep. 8, sem duplicata)
      const week0 = getWeekInfoSaoPaulo(0, new Date("2026-04-06T16:00:00Z"));
      const week0Items = await getWeeklyScheduleFromDbAndRedis(
        {
          startTimestamp: week0.startTimestamp,
          endTimestamp: week0.endTimestamp,
          weekKey: week0.weekKey,
          days: week0.days,
        },
        { sql },
      );
      assert.equal(week0Items.length, 1);
      assert.equal(week0Items[0].episode, 8);
      assert.equal(week0Items[0].isRecurring, false);

      // No /calendar da semana seguinte 2026-04-13 -> entrada recorrente com episode: 0
      const week1 = getWeekInfoSaoPaulo(1, new Date("2026-04-06T16:00:00Z"));
      const week1Items = await getWeeklyScheduleFromDbAndRedis(
        {
          startTimestamp: week1.startTimestamp,
          endTimestamp: week1.endTimestamp,
          weekKey: week1.weekKey,
          days: week1.days,
        },
        { sql },
      );
      assert.equal(week1Items.length, 1);
      assert.equal(week1Items[0].episode, 0);
      assert.equal(week1Items[0].isRecurring, true);

      // Verifica no código da UI que episode === 0 não exibe "Episódio 0" nem horário inventado
      const animeCardSrc = fs.readFileSync(path.join(process.cwd(), "src/components/anime-card.tsx"), "utf8");
      const calSrc = fs.readFileSync(path.join(process.cwd(), "src/routes/calendar.tsx"), "utf8");
      assert.ok(animeCardSrc.includes("anime.todayEpisode?.number ?"));
      assert.ok(calSrc.includes('typeof item.episode === "number" && item.episode > 0'));
    } finally {
      await pg.close();
    }
  });

  it("9. Visitantes e usuários comuns são bloqueados pela proteção administrativa", async () => {
    const apiSrc = fs.readFileSync(
      path.join(process.cwd(), "src/routes/api/admin/calendar-recurrences.ts"),
      "utf8",
    );
    assert.ok(apiSrc.includes("assertSameSiteRequest"));
    assert.ok(apiSrc.includes("requireAdminUser"));

    // Sem usuário / visitante -> bloqueado
    assert.equal(await isAuthorizedAdminAccount({ userId: null }), false);
    // Usuário comum -> bloqueado
    assert.equal(
      await isAuthorizedAdminAccount({
        userId: "user-comum",
        email: "visitante@example.com",
        profileRole: "user",
      }),
      false,
    );
    // Conta fictícia local -> bloqueada mesmo com role admin
    assert.equal(
      await isAuthorizedAdminAccount({
        userId: "dev-user",
        email: "dev@example.com",
        profileRole: "admin",
      }),
      false,
    );
    // Administrador -> autorizado
    assert.equal(
      await isAuthorizedAdminAccount({
        userId: "admin-1",
        email: "admin@example.com",
        profileRole: "admin",
      }),
      true,
    );
  });

  it("10-12. Edição, desativação, exclusão, invalidação seletiva no Redis e fail-open quando Redis está fora", async () => {
    const { pg, sql } = await createPgliteWithMigrations();
    try {
      await pg.query(
        `INSERT INTO "catalog_anime" ("id", "title", "anilistId", "format", "status")
         VALUES ('test-crud-anime', 'Anime Teste CRUD', 9904, 'TV', 'RELEASING');`,
      );

      const mockRedis = createMockRedisClient();
      // Simula cache antigo no Redis
      mockRedis.store.set("hikari:calendar:today:v1:2026-04-06", "stale-today");
      mockRedis.store.set("hikari:calendar:week:v1:2026-04-06:1:2", "stale-week");

      const rec = await createCalendarRecurrence(
        { animeId: "test-crud-anime", dayOfWeek: 0 },
        { sql, redisOverride: mockRedis },
      );

      // Verifica invalidação seletiva no Redis (INCR gen + SCAN + DEL nas chaves de calendário)
      assert.ok(mockRedis.stats.incrs.includes("hikari:calendar:gen:v1"));
      assert.ok(mockRedis.stats.scans.includes("hikari:calendar:today:v1:*"));
      assert.ok(mockRedis.stats.scans.includes("hikari:calendar:week:v1:*"));
      assert.equal(mockRedis.store.has("hikari:calendar:today:v1:2026-04-06"), false);
      assert.equal(mockRedis.store.has("hikari:calendar:week:v1:2026-04-06:1:2"), false);

      // Edita dia da semana de Segunda (0) -> Sexta (4)
      const updated = await updateCalendarRecurrence(
        { id: rec.id, dayOfWeek: 4 },
        { sql, redisOverride: mockRedis },
      );
      assert.equal(updated.dayOfWeek, 4);

      // Fail-open com Redis indisponível (lançando erro em get/set)
      const fridayToday = await getTodayScheduleFromDbAndRedis({
        sql,
        now: new Date("2026-04-10T16:00:00Z"), // Sexta-feira
        skipLocalCache: true,
        redisGet: async () => {
          throw new Error("Upstash Redis offline");
        },
        redisSet: async () => {
          throw new Error("Upstash Redis offline");
        },
      });
      assert.equal(fridayToday.length, 1);
      assert.equal(fridayToday[0].id, "test-crud-anime");

      // Desativa recorrência -> deixa de aparecer
      const deactivated = await updateCalendarRecurrence(
        { id: rec.id, active: false },
        { sql, redisOverride: mockRedis },
      );
      assert.equal(deactivated.active, false);

      const fridayAfterDisable = await getTodayScheduleFromDbAndRedis({
        sql,
        now: new Date("2026-04-10T16:00:00Z"),
        skipLocalCache: true,
      });
      assert.equal(fridayAfterDisable.length, 0);

      // Exclusão remove registro do PostgreSQL
      const deleted = await deleteCalendarRecurrence(rec.id, { sql, redisOverride: mockRedis });
      assert.equal(deleted.id, rec.id);
      const remaining = await listCalendarRecurrences(sql);
      assert.equal(remaining.length, 0);

      // Também garante que invalidateRedisCalendar direto funciona fail-open com Redis nulo
      await invalidateRedisCalendar(null);
    } finally {
      await pg.close();
    }
  });

  it("13. Sincronização administrativa com AniList NÃO remove nem sobrescreve recorrências manuais", async () => {
    const { pg, sql, pool } = await createPgliteWithMigrations();
    try {
      await pg.query(
        `INSERT INTO "catalog_anime" ("id", "title", "anilistId", "format", "status")
         VALUES ('anilist-9905', 'Anime Manual Preservado', 9905, 'TV', 'RELEASING');`,
      );
      const rec = await createCalendarRecurrence(
        { animeId: "anilist-9905", dayOfWeek: 3 }, // Quinta-feira
        { sql },
      );

      // Simula sync schedule da AniList trazendo o mesmo anime com um horário específico de quarta
      const mockFetch = async () => ({
        ok: true,
        status: 200,
        async json() {
          return {
            data: {
              Page: {
                pageInfo: { hasNextPage: false },
                airingSchedules: [
                  {
                    id: 88001,
                    airingAt: Math.floor(new Date("2026-04-08T15:00:00Z").getTime() / 1000),
                    timeUntilAiring: 3600,
                    episode: 12,
                    media: {
                      id: 9905,
                      idMal: null,
                      isAdult: false,
                      title: {
                        romaji: "Anime Manual Preservado",
                        english: "Anime Manual Preservado",
                        native: "テスト",
                      },
                      coverImage: { extraLarge: null, large: null },
                      bannerImage: null,
                      description: "Teste",
                      format: "TV",
                      status: "RELEASING",
                      episodes: 24,
                      season: "SPRING",
                      seasonYear: 2026,
                      averageScore: 80,
                      popularity: 1000,
                      trending: 50,
                      genres: ["Action"],
                      trailer: null,
                    },
                  },
                ],
              },
            },
          };
        },
      });

      const mockRedis = createMockRedisClient();
      const syncRes = await runSync({
        pool,
        redis: mockRedis,
        mode: "schedule",
        fetchImpl: mockFetch,
        rateLimitDelayMs: 0,
        retries: 1,
        argv: ["--manual"],
      });
      assert.equal(syncRes.status, "success");

      // Recorrência manual de Quinta-feira continua intacta!
      const afterList = await listCalendarRecurrences(sql);
      assert.equal(afterList.length, 1);
      assert.equal(afterList[0].id, rec.id);
      assert.equal(afterList[0].dayOfWeek, 3);
      assert.equal(afterList[0].active, true);
    } finally {
      await pg.close();
    }
  });

  it("14. Fuso horário America/Sao_Paulo na virada de dia (23:30 BRT / 02:30 UTC) e transição às 00:00 BRT", async () => {
    const { pg, sql } = await createPgliteWithMigrations();
    try {
      await pg.query(
        `INSERT INTO "catalog_anime" ("id", "title", "anilistId", "format", "status")
         VALUES
           ('test-tz-mon', 'Anime Segunda Virada', 9906, 'TV', 'RELEASING'),
           ('test-tz-tue', 'Anime Terça Virada', 9907, 'TV', 'RELEASING');`,
      );
      await createCalendarRecurrence({ animeId: "test-tz-mon", dayOfWeek: 0 }, { sql });
      await createCalendarRecurrence({ animeId: "test-tz-tue", dayOfWeek: 1 }, { sql });

      // 2026-04-07 02:30:00 UTC === 2026-04-06 23:30:00 America/Sao_Paulo (AINDA É SEGUNDA!)
      const lateMondayBrt = new Date("2026-04-07T02:30:00Z");
      assert.equal(getDayKeySaoPaulo(lateMondayBrt), "2026-04-06");
      assert.equal(getWeekdaySaoPaulo(lateMondayBrt), 0);

      const itemsBeforeMidnight = await getTodayScheduleFromDbAndRedis({
        sql,
        now: lateMondayBrt,
        skipLocalCache: true,
      });
      assert.equal(itemsBeforeMidnight.length, 1);
      assert.equal(itemsBeforeMidnight[0].id, "test-tz-mon");

      // 2026-04-07 03:05:00 UTC === 2026-04-07 00:05:00 America/Sao_Paulo (JÁ VIROU TERÇA!)
      const afterMidnightBrt = new Date("2026-04-07T03:05:00Z");
      assert.equal(getDayKeySaoPaulo(afterMidnightBrt), "2026-04-07");
      assert.equal(getWeekdaySaoPaulo(afterMidnightBrt), 1);

      const itemsAfterMidnight = await getTodayScheduleFromDbAndRedis({
        sql,
        now: afterMidnightBrt,
        skipLocalCache: true,
      });
      assert.equal(itemsAfterMidnight.length, 1);
      assert.equal(itemsAfterMidnight[0].id, "test-tz-tue");
    } finally {
      await pg.close();
    }
  });
});
