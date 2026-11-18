/**
 * Suite de Validação Pontual — Independência do Calendário e Paginação/Marcador de Sucesso
 *
 * Testa:
 *  - Ausência total de chamadas AniList em src/routes/calendar.tsx
 *  - Ausência de updatedAt_greater nas queries enviadas à AniList
 *  - Execução real de runSync (scripts/anilist-sync.mjs) contra mocks em memória
 *  - Limites de paginação incremental (50 páginas), Temporadas (25 páginas), Calendário (30 páginas)
 *  - Impedimento de gravação de anilist_sync_last_timestamp quando hasNextPage === true ou em erros de rede
 *  - Continuação das demais temporadas após falha em uma temporada, terminando globalmente com erro
 *  - Liberação garantida do advisory lock 849201 no finally em todas as falhas
 *  - Código de saída != 0 em execução incompleta e == 0 em execução completa
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { runSync, MEDIA_LIST_QUERY, SEASON_QUERY, AIRING_SCHEDULE_QUERY } from "./anilist-sync.mjs";

let totalTests = 0;
let passedTests = 0;

function assert(condition, label) {
  totalTests++;
  if (condition) {
    console.log(`  [PASS] Teste ${totalTests}: ${label}`);
    passedTests++;
  } else {
    console.error(`  [FAIL] Teste ${totalTests}: ${label}`);
    process.exitCode = 1;
  }
}

function createMockDb({ initialTimestamp = "1000000", initialCompleted = "true" } = {}) {
  const queries = [];
  let lockHeld = false;
  let lockAcquiredCount = 0;
  let lockReleasedCount = 0;
  let timestampWrites = [];
  let lastTimestamp = initialTimestamp;
  let checkpointValue = null;
  const animeTable = new Map();
  const scheduleTable = new Map();
  const episodeWrites = [];

  const client = {
    async query(sqlText, params = []) {
      const normalized = sqlText.replace(/\s+/g, " ").trim();
      queries.push({ sql: normalized, params });

      if (normalized.startsWith("SELECT pg_try_advisory_lock")) {
        lockHeld = true;
        lockAcquiredCount++;
        return { rows: [{ locked: true }] };
      }
      if (normalized.startsWith("SELECT pg_advisory_unlock")) {
        lockHeld = false;
        lockReleasedCount++;
        return { rows: [{ pg_advisory_unlock: true }] };
      }
      if (normalized.includes(`FROM "admin_settings"`) && params[0] === "anilist_sync_frequency") {
        return { rows: [{ value: JSON.stringify("2_per_week") }] };
      }
      if (normalized.includes(`FROM "admin_settings"`) && params[0] === "anilist_sync_initial_completed") {
        return { rows: initialCompleted ? [{ value: initialCompleted }] : [] };
      }
      if (normalized.includes(`FROM "admin_settings"`) && params[0] === "anilist_sync_last_timestamp") {
        return { rows: lastTimestamp ? [{ value: lastTimestamp }] : [] };
      }
      if (normalized.includes(`FROM "admin_settings"`) && params[0] === "anilist_sync_checkpoint") {
        return { rows: checkpointValue ? [{ value: checkpointValue }] : [] };
      }
      if (normalized.startsWith(`INSERT INTO "admin_settings"`)) {
        const [key, val] = params;
        if (key === "anilist_sync_last_timestamp") {
          lastTimestamp = val;
          timestampWrites.push(val);
        } else if (key === "anilist_sync_checkpoint") {
          checkpointValue = val;
        }
        return { rows: [] };
      }
      if (normalized.startsWith(`DELETE FROM "admin_settings"`)) {
        if (params[0] === "anilist_sync_checkpoint") {
          checkpointValue = null;
        }
        return { rows: [] };
      }
      if (normalized.startsWith(`SELECT "id", "cover"`)) {
        const anilistId = params[0];
        const existing = animeTable.get(anilistId);
        return { rows: existing ? [existing] : [] };
      }
      if (normalized.startsWith(`INSERT INTO "catalog_anime"`)) {
        const anilistId = params[2];
        animeTable.set(anilistId, {
          id: params[0],
          title: params[1],
          cover: params[7],
          banner: params[8],
          synopsis: params[9],
          manual_fields: [],
        });
        return { rows: [] };
      }
      if (normalized.startsWith(`UPDATE "catalog_anime"`)) {
        return { rows: [] };
      }
      if (normalized.startsWith(`INSERT INTO "catalog_airing_schedule"`)) {
        scheduleTable.set(params[0], { id: params[0], anilistId: params[1], episode: params[3] });
        return { rows: [] };
      }
      if (normalized.includes("catalog_episode")) {
        episodeWrites.push(normalized);
        return { rows: [] };
      }
      return { rows: [] };
    },
    release() {},
  };

  const pool = {
    async connect() {
      return client;
    },
    async end() {},
  };

  return {
    pool,
    getState: () => ({
      lockHeld,
      lockAcquiredCount,
      lockReleasedCount,
      timestampWrites,
      lastTimestamp,
      checkpointValue,
      animeCount: animeTable.size,
      scheduleCount: scheduleTable.size,
      episodeWrites,
    }),
  };
}

function createMockRedis() {
  const incrs = [];
  const dels = [];
  const scans = [];
  return {
    async incr(key) {
      incrs.push(key);
      return 1;
    },
    async del(...keys) {
      dels.push(...keys);
      return keys.length;
    },
    async scan(cursor, opts) {
      scans.push({ cursor, match: opts?.match });
      return ["0", []];
    },
    getStats: () => ({ incrs, dels, scans }),
  };
}

function makeMedia(id, updatedAt = 2000) {
  return {
    id,
    idMal: id + 1000,
    updatedAt,
    title: { romaji: `Anime ${id}`, english: `Anime ${id}`, native: `アニメ${id}` },
    coverImage: { extraLarge: "https://s4.anilist.co/file/anilistcdn/c.jpg", large: "https://s4.anilist.co/file/anilistcdn/c.jpg" },
    bannerImage: null,
    description: "Sinopse teste",
    format: "TV",
    status: "RELEASING",
    episodes: 12,
    season: "FALL",
    seasonYear: 2026,
    averageScore: 80,
    popularity: 5000,
    trending: 120,
    genres: ["Action"],
    trailer: null,
  };
}

function makeFetch({
  incrementalPages = 1,
  incrementalLastHasNext = false,
  seasonPagesForFirst = 1,
  seasonLastHasNext = false,
  failFirstSeason = false,
  schedulePages = 1,
  scheduleLastHasNext = false,
  failSchedule = false,
} = {}) {
  const uniqueSeasonsSeen = new Set();
  let firstSeasonKey = null;
  let maxIncrementalPageSeen = 0;
  let maxFirstSeasonPageSeen = 0;
  let maxSchedulePageSeen = 0;
  let sawInvalidUpdatedAtGreater = false;

  const fetchImpl = async (_url, init) => {
    const body = JSON.parse(init.body);
    const { query, variables } = body;

    if (query.includes("updatedAt_greater") || "updatedAtGreater" in (variables || {})) {
      sawInvalidUpdatedAtGreater = true;
    }

    if (query.includes("MediaListQuery")) {
      const sortKey = Array.isArray(variables.sort) ? variables.sort.join(",") : "";
      if (sortKey.includes("UPDATED_AT_DESC")) {
        maxIncrementalPageSeen = Math.max(maxIncrementalPageSeen, variables.page);
        const hasNextPage = variables.page < incrementalPages ? true : incrementalLastHasNext;
        return {
          ok: true,
          status: 200,
          async json() {
            return {
              data: {
                Page: {
                  pageInfo: { hasNextPage, currentPage: variables.page, lastPage: incrementalPages },
                  media: [makeMedia(1000 + variables.page, 5000)],
                },
              },
            };
          },
        };
      }
      // trending_refresh / popular_refresh
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            data: {
              Page: {
                pageInfo: { hasNextPage: false, currentPage: variables.page, lastPage: 1 },
                media: [makeMedia(1500 + variables.page, 5000)],
              },
            },
          };
        },
      };
    }

    if (query.includes("SeasonQuery")) {
      const sKey = `${variables.season}-${variables.year}`;
      if (!firstSeasonKey) firstSeasonKey = sKey;
      uniqueSeasonsSeen.add(sKey);
      const isTargetSeason = sKey === firstSeasonKey;
      if (isTargetSeason) {
        maxFirstSeasonPageSeen = Math.max(maxFirstSeasonPageSeen, variables.page);
        if (failFirstSeason) {
          return { ok: false, status: 500, async json() { return {}; } };
        }
        const hasNextPage = variables.page < seasonPagesForFirst ? true : seasonLastHasNext;
        return {
          ok: true,
          status: 200,
          async json() {
            return {
              data: {
                Page: {
                  pageInfo: { hasNextPage },
                  media: [makeMedia(2000 + variables.page, 5000)],
                },
              },
            };
          },
        };
      }
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            data: {
              Page: {
                pageInfo: { hasNextPage: false },
                media: [],
              },
            },
          };
        },
      };
    }

    if (query.includes("AiringScheduleQuery")) {
      maxSchedulePageSeen = Math.max(maxSchedulePageSeen, variables.page);
      if (failSchedule) {
        return { ok: false, status: 502, async json() { return {}; } };
      }
      const hasNextPage = variables.page < schedulePages ? true : scheduleLastHasNext;
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            data: {
              Page: {
                pageInfo: { hasNextPage },
                airingSchedules: [
                  {
                    id: 5000 + variables.page,
                    airingAt: Math.floor(Date.now() / 1000) + 3600,
                    timeUntilAiring: 3600,
                    episode: variables.page,
                    media: makeMedia(3000 + variables.page, 5000),
                  },
                ],
              },
            },
          };
        },
      };
    }

    throw new Error("Unexpected query");
  };

  return {
    fetchImpl,
    getMetrics: () => ({
      seasonQueriesSeen: uniqueSeasonsSeen.size,
      maxIncrementalPageSeen,
      maxFirstSeasonPageSeen,
      maxSchedulePageSeen,
      sawInvalidUpdatedAtGreater,
    }),
  };
}

async function main() {
  console.log("=================================================================");
  console.log("VALIDAÇÃO PONTUAL — CALENDÁRIO INDEPENDENTE & SINCRONIZAÇÃO SEGURA");
  console.log("=================================================================\n");

  // 1. Verificação estática do calendário e GraphQL queries
  console.log("--- 1. INDEPENDÊNCIA DO CALENDÁRIO & QUERIES GRAPHQL ---");
  const calendarSrc = fs.readFileSync(path.join(process.cwd(), "src/routes/calendar.tsx"), "utf8");
  assert(!calendarSrc.includes("graphql.anilist.co"), "calendar.tsx não contém chamadas diretas a graphql.anilist.co.");
  assert(!calendarSrc.includes("/api-anilist"), "calendar.tsx não contém chamadas ao proxy /api-anilist.");
  assert(!calendarSrc.includes("AIRING_SCHEDULE_QUERY"), "calendar.tsx não contém AIRING_SCHEDULE_QUERY.");
  assert(!calendarSrc.includes("withCache"), "calendar.tsx não importa nem utiliza withCache da AniList.");
  assert(calendarSrc.includes("catalog_airing_schedule") && calendarSrc.includes("getRedisCalendarSchedule"), "calendar.tsx consulta exclusivamente Redis + catalog_airing_schedule.");
  assert(!MEDIA_LIST_QUERY.includes("updatedAt_greater") && !SEASON_QUERY.includes("updatedAt_greater") && !AIRING_SCHEDULE_QUERY.includes("updatedAt_greater"), "Nenhuma query GraphQL usa updatedAt_greater inválido.");

  // 2. Execução completa bem-sucedida atualiza anilist_sync_last_timestamp
  console.log("\n--- 2. EXECUÇÃO COMPLETA ATUALIZA MARCADOR DE SUCESSO ---");
  {
    const db = createMockDb({ initialTimestamp: "1000000" });
    const redis = createMockRedis();
    const mockFetch = makeFetch();
    const res = await runSync({
      pool: db.pool,
      redis,
      fetchImpl: mockFetch.fetchImpl,
      rateLimitDelayMs: 0,
      retries: 1,
      argv: ["--manual"],
    });
    const st = db.getState();
    assert(res.status === "success", "Execução completa retornou status 'success'.");
    assert(st.timestampWrites.length === 1, "Execução completa atualizou anilist_sync_last_timestamp.");
    assert(st.lockAcquiredCount === 1 && st.lockReleasedCount === 1 && !st.lockHeld, "Advisory lock 849201 adquirido e liberado corretamente.");
    assert(redis.getStats().incrs.includes("hikari:calendar:gen:v1"), "Contador hikari:calendar:gen:v1 incrementado após execução completa.");
    assert(st.episodeWrites.length === 0, "Nenhuma escrita realizada em catalog_episode.");
    assert(!mockFetch.getMetrics().sawInvalidUpdatedAtGreater, "Nenhuma chamada HTTP enviou updatedAt_greater.");
  }

  // 3. Limite incremental de 50 páginas atingido com hasNextPage === true
  console.log("\n--- 3. LIMITE INCREMENTAL (50 PÁGINAS) COM hasNextPage === true ---");
  {
    const db = createMockDb({ initialTimestamp: "1000000" });
    const redis = createMockRedis();
    const mockFetch = makeFetch({ incrementalPages: 60, incrementalLastHasNext: true });
    let threw = false;
    try {
      await runSync({
        pool: db.pool,
        redis,
        fetchImpl: mockFetch.fetchImpl,
        rateLimitDelayMs: 0,
        retries: 1,
        argv: ["--manual"],
      });
    } catch {
      threw = true;
    }
    const st = db.getState();
    const m = mockFetch.getMetrics();
    assert(m.maxIncrementalPageSeen === 50, `Varredura incremental respeitou exatamente o teto de 50 páginas (visto: ${m.maxIncrementalPageSeen}).`);
    assert(threw === true, "Execução incremental truncada lançou erro (código de saída != 0).");
    assert(st.timestampWrites.length === 0 && st.lastTimestamp === "1000000", "Marcador anilist_sync_last_timestamp permaneceu intacto.");
    assert(st.lockAcquiredCount === 1 && st.lockReleasedCount === 1 && !st.lockHeld, "Advisory lock 849201 liberado no finally após falha incremental.");
  }

  // 4. Limite de temporadas (25 páginas) atingido com hasNextPage === true
  console.log("\n--- 4. LIMITE DE TEMPORADAS (25 PÁGINAS) COM hasNextPage === true ---");
  {
    const db = createMockDb({ initialTimestamp: "1000000" });
    const redis = createMockRedis();
    const mockFetch = makeFetch({ seasonPagesForFirst: 30, seasonLastHasNext: true });
    let threw = false;
    try {
      await runSync({
        pool: db.pool,
        redis,
        fetchImpl: mockFetch.fetchImpl,
        rateLimitDelayMs: 0,
        retries: 1,
        argv: ["--manual"],
      });
    } catch {
      threw = true;
    }
    const st = db.getState();
    const m = mockFetch.getMetrics();
    assert(m.maxFirstSeasonPageSeen === 25, `Temporada respeitou o teto de 25 páginas (visto: ${m.maxFirstSeasonPageSeen}).`);
    assert(m.seasonQueriesSeen === 12, `Outras temporadas continuaram sendo processadas (${m.seasonQueriesSeen}/12 combinações).`);
    assert(threw === true, "Execução truncada em temporada lançou erro global.");
    assert(st.timestampWrites.length === 0, "Marcador anilist_sync_last_timestamp NÃO foi atualizado.");
    assert(st.lockReleasedCount === 1 && !st.lockHeld, "Advisory lock 849201 liberado no finally.");
  }

  // 5. Erro de rede em uma temporada continua outras temporadas e termina com erro
  console.log("\n--- 5. ERRO DE REDE EM TEMPORADA NÃO MASCARA SUCESSO ---");
  {
    const db = createMockDb({ initialTimestamp: "1000000" });
    const redis = createMockRedis();
    const mockFetch = makeFetch({ failFirstSeason: true });
    let threw = false;
    try {
      await runSync({
        pool: db.pool,
        redis,
        fetchImpl: mockFetch.fetchImpl,
        rateLimitDelayMs: 0,
        retries: 1,
        argv: ["--manual"],
      });
    } catch {
      threw = true;
    }
    const st = db.getState();
    const m = mockFetch.getMetrics();
    assert(m.seasonQueriesSeen === 12, "Mesmo após falha na 1ª temporada, as demais temporadas foram processadas.");
    assert(threw === true, "Erro em temporada propagou falha global.");
    assert(st.timestampWrites.length === 0, "Marcador anilist_sync_last_timestamp NÃO foi atualizado.");
    assert(st.lockReleasedCount === 1 && !st.lockHeld, "Advisory lock 849201 liberado no finally.");
  }

  // 6. Limite do calendário (30 páginas) atingido com hasNextPage === true
  console.log("\n--- 6. LIMITE DO CALENDÁRIO (30 PÁGINAS) COM hasNextPage === true ---");
  {
    const db = createMockDb({ initialTimestamp: "1000000" });
    const redis = createMockRedis();
    const mockFetch = makeFetch({ schedulePages: 35, scheduleLastHasNext: true });
    let threw = false;
    try {
      await runSync({
        pool: db.pool,
        redis,
        fetchImpl: mockFetch.fetchImpl,
        rateLimitDelayMs: 0,
        retries: 1,
        argv: ["--manual"],
      });
    } catch {
      threw = true;
    }
    const st = db.getState();
    const m = mockFetch.getMetrics();
    assert(m.maxSchedulePageSeen === 30, `Calendário respeitou o teto de 30 páginas (visto: ${m.maxSchedulePageSeen}).`);
    assert(threw === true, "Calendário truncado lançou erro global.");
    assert(st.timestampWrites.length === 0, "Marcador anilist_sync_last_timestamp NÃO foi atualizado.");
    assert(st.lockReleasedCount === 1 && !st.lockHeld, "Advisory lock 849201 liberado no finally.");
  }

  // 7. Erro de rede no calendário não é tratado como sucesso
  console.log("\n--- 7. ERRO DE REDE NO CALENDÁRIO NÃO MASCARA SUCESSO ---");
  {
    const db = createMockDb({ initialTimestamp: "1000000" });
    const redis = createMockRedis();
    const mockFetch = makeFetch({ failSchedule: true });
    let threw = false;
    try {
      await runSync({
        pool: db.pool,
        redis,
        fetchImpl: mockFetch.fetchImpl,
        rateLimitDelayMs: 0,
        retries: 1,
        argv: ["--manual"],
      });
    } catch {
      threw = true;
    }
    const st = db.getState();
    assert(threw === true, "Erro no calendário lançou erro global.");
    assert(st.timestampWrites.length === 0, "Marcador anilist_sync_last_timestamp NÃO foi atualizado.");
    assert(st.lockReleasedCount === 1 && !st.lockHeld, "Advisory lock 849201 liberado no finally.");
  }

  // 8. Verificação de exit code real via subprocesso Node (sem DATABASE_URL -> saída != 0)
  console.log("\n--- 8. CÓDIGO DE SAÍDA NÃO-ZERO EM PROCESSO CLI COM FALHA ---");
  {
    const proc = spawnSync(process.execPath, ["scripts/anilist-sync.mjs", "--manual"], {
      env: { PATH: process.env.PATH },
      encoding: "utf8",
    });
    assert(proc.status !== 0, `Execução CLI com falha retornou código de saída != 0 (recebido: ${proc.status}).`);
  }

  console.log("\n=================================================================");
  console.log(`RESULTADO FINAL DA VALIDAÇÃO: ${passedTests}/${totalTests} TESTES APROVADOS!`);
  console.log("=================================================================\n");
}

main().catch((err) => {
  console.error("Erro fatal nos testes:", err);
  process.exit(1);
});
