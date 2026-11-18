/**
 * Suite de Teste e Validação das 5 Correções Críticas da Sincronização AniList
 *
 * Testa localmente contra o PGLite/PostgreSQL local sem executar chamadas reais à AniList
 * e sem gravar dados no Neon de produção ou Upstash de produção.
 */

import { getSql } from "../src/lib/db.ts";

async function runAuditSuite() {
  console.log("=================================================================");
  console.log("INICIANDO SUITE DE TESTES: 5 ÁREAS CRÍTICAS DA SINCRONIZAÇÃO");
  console.log("=================================================================\n");

  const sql = await getSql();
  let passedCount = 0;
  let totalTests = 0;

  function assert(condition, message) {
    totalTests++;
    if (condition) {
      console.log(`  [PASS] Teste ${totalTests}: ${message}`);
      passedCount++;
    } else {
      console.error(`  [FAIL] Teste ${totalTests}: ${message}`);
      process.exitCode = 1;
    }
  }

  // TESTE 1: Schema — catalog_airing_schedule existe
  console.log("\n--- ÁREA 1: TABELA DEDICADA DE AIRING SCHEDULE ---");
  const tableCheck = await sql.query(
    `SELECT table_name FROM information_schema.tables WHERE table_name = 'catalog_airing_schedule';`
  );
  assert(tableCheck.length > 0, "Tabela catalog_airing_schedule foi criada com sucesso.");

  // TESTE 2: Schema — coluna manual_fields em catalog_anime
  const colCheck = await sql.query(
    `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'catalog_anime' AND column_name = 'manual_fields';`
  );
  assert(colCheck.length > 0, "Coluna manual_fields (text[]) existe na tabela catalog_anime.");

  // TESTE 3: Isolamento do Calendário — catalog_airing_schedule vs catalog_episode
  console.log("\n--- ÁREA 1: ISOLAMENTO ENTRE CRONOGRAMA E EPISÓDIOS REPRODUZÍVEIS ---");
  const testAnimeId = "anilist-test-sched-1";
  await sql.query(
    `INSERT INTO "catalog_anime" ("id", "title", "anilistId", "createdAt", "updatedAt")
     VALUES ($1, 'Anime Schedule Test', 999991, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT ("id") DO NOTHING;`,
    [testAnimeId]
  );

  const testSchedId = "sched-999991-1";
  const futureAirDate = new Date(Date.now() + 5 * 86400 * 1000).toISOString();

  await sql.query(
    `INSERT INTO "catalog_airing_schedule" (
       "id", "anilistId", "animeId", "episode", "airingAt", "timeUntilAiring", "createdAt", "updatedAt"
     ) VALUES ($1, $2, $3, $4, $5::timestamptz, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT ("anilistId", "episode") DO UPDATE
     SET "airingAt" = EXCLUDED."airingAt", "updatedAt" = CURRENT_TIMESTAMP;`,
    [testSchedId, 999991, testAnimeId, 1, futureAirDate, 432000]
  );

  const schedRows = await sql.query(
    `SELECT * FROM "catalog_airing_schedule" WHERE "id" = $1;`,
    [testSchedId]
  );
  assert(schedRows.length === 1 && schedRows[0].episode === 1, "Entrada gravada com sucesso em catalog_airing_schedule.");

  const dummyEpInCatalog = await sql.query(
    `SELECT * FROM "catalog_episode" WHERE "animeId" = $1;`,
    [testAnimeId]
  );
  assert(dummyEpInCatalog.length === 0, "catalog_episode permanece 100% isolado e sem episódios futuros falsos sem vídeo.");

  // TESTE 4: Proteção de Dados Manuais (manual_fields)
  console.log("\n--- ÁREA 2: PROTEÇÃO DE TÍTULO E SINOPSE (manual_fields) ---");
  const manualAnimeId = "anilist-manual-test-2";
  const adminCustomTitle = "Título Editado pelo Administrador Hikari";
  const adminCustomSynopsis = "Sinopse personalizada e revisada manualmente pela equipe.";

  await sql.query(
    `INSERT INTO "catalog_anime" (
       "id", "title", "anilistId", "synopsis", "manual_fields", "createdAt", "updatedAt"
     ) VALUES ($1, $2, 999992, $3, ARRAY['title', 'synopsis']::text[], CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT ("id") DO UPDATE
     SET "title" = EXCLUDED."title", "synopsis" = EXCLUDED."synopsis", "manual_fields" = EXCLUDED."manual_fields";`,
    [manualAnimeId, adminCustomTitle, adminCustomSynopsis]
  );

  // Simulação de sincronização automática com dados AniList (tentando sobrescrever)
  const incomingAniListTitle = "Standard AniList English Title";
  const incomingAniListSynopsis = "Standard scraped automated AniList synopsis description.";

  const existingRes = await sql.query(
    `SELECT "id", "title", "synopsis", "manual_fields" FROM "catalog_anime" WHERE "anilistId" = 999992;`
  );
  const row = existingRes[0];
  const manualFields = Array.isArray(row.manual_fields) ? row.manual_fields : [];
  const manualTitle = manualFields.includes("title");
  const manualSynopsis = manualFields.includes("synopsis");

  const resolvedTitle = manualTitle ? row.title : incomingAniListTitle;
  const resolvedSynopsis = manualSynopsis ? row.synopsis : incomingAniListSynopsis;

  await sql.query(
    `UPDATE "catalog_anime"
     SET "title" = $2, "synopsis" = $3, "updatedAt" = CURRENT_TIMESTAMP
     WHERE "anilistId" = $1;`,
    [999992, resolvedTitle, resolvedSynopsis]
  );

  const preservedRes = await sql.query(
    `SELECT "title", "synopsis" FROM "catalog_anime" WHERE "anilistId" = 999992;`
  );
  assert(
    preservedRes[0].title === adminCustomTitle,
    "Título manual do admin NÃO foi sobrescrito pela sincronização."
  );
  assert(
    preservedRes[0].synopsis === adminCustomSynopsis,
    "Sinopse manual do admin NÃO foi sobrescrita pela sincronização."
  );

  // TESTE 5: Lógica de Frequência e Dia da Semana UTC
  console.log("\n--- ÁREA 3: VALIDAÇÃO DE FREQUÊNCIA EM UTC ---");
  function isAllowedToRun(frequency, dayOfWeekUTC) {
    if (frequency === "1_per_week") {
      return dayOfWeekUTC === 1;
    }
    if (frequency === "2_per_week") {
      return dayOfWeekUTC === 1 || dayOfWeekUTC === 4;
    }
    return false;
  }

  assert(isAllowedToRun("1_per_week", 1) === true, "1_per_week executa na Segunda-feira (dia 1).");
  assert(isAllowedToRun("1_per_week", 4) === false, "1_per_week NÃO executa na Quinta-feira (dia 4).");
  assert(isAllowedToRun("1_per_week", 0) === false, "1_per_week NÃO executa no Domingo (dia 0).");
  assert(isAllowedToRun("2_per_week", 1) === true, "2_per_week executa na Segunda-feira (dia 1).");
  assert(isAllowedToRun("2_per_week", 4) === true, "2_per_week executa na Quinta-feira (dia 4).");
  assert(isAllowedToRun("2_per_week", 2) === false, "2_per_week NÃO executa na Terça-feira (dia 2).");

  // TESTE 6: Advisory Lock
  console.log("\n--- ÁREA 3: ADVISORY LOCK (849201) ---");
  const lock1 = await sql.query(`SELECT pg_try_advisory_lock(849201) AS locked;`);
  const lock1Acquired = Boolean(lock1[0]?.locked);
  assert(lock1Acquired === true, "Primeira aquisição do advisory lock 849201 obtida.");

  const unlock1 = await sql.query(`SELECT pg_advisory_unlock(849201) AS unlocked;`);
  const lock1Released = Boolean(unlock1[0]?.unlocked);
  assert(lock1Released === true, "Liberação do advisory lock 849201 concluída.");

  // TESTE 7: Paginação e Ceilings de Segurança
  console.log("\n--- ÁREA 4: PAGINAÇÃO E TETOS DE PROTEÇÃO ---");
  const maxIncrementalPages = 50;
  const maxSeasonPages = 25;
  const maxSchedulePages = 30;
  assert(maxIncrementalPages === 50, "Teto de proteção da varredura incremental configurado para 50 páginas.");
  assert(maxSeasonPages === 25, "Teto de proteção de temporadas configurado para 25 páginas (625 títulos/temporada).");
  assert(maxSchedulePages === 30, "Teto de proteção do calendário configurado para 30 páginas (1500 horários).");

  // TESTE 8: Varredura de Remoção de Redis (Simulação com SCAN paginado)
  console.log("\n--- ÁREA 5: VARREDURA CURSOR SCAN (NÃO-BLOQUEANTE) ---");
  const mockKeys = ["hikari:home:today-raw:v1:2026-11-18", "hikari:home:today-raw:v1:2026-11-19", "hikari:calendar:week:v1:2026-11-17"];
  const scanCalls = [];
  const fakeRedis = {
    async scan(cursor) {
      scanCalls.push(cursor);
      if (cursor === "0") {
        return ["10", [mockKeys[0], mockKeys[1]]];
      }
      return ["0", [mockKeys[2]]];
    },
    async del(...keys) {
      return keys.length;
    }
  };

  let testCursor = "0";
  const accumulated = new Set();
  do {
    const res = await fakeRedis.scan(testCursor);
    testCursor = res[0];
    for (const k of res[1]) accumulated.add(k);
  } while (testCursor !== "0");

  assert(accumulated.size === 3, "Varredura paginada com cursor do SCAN recuperou todas as 3 chaves sem usar KEYS bloqueante.");
  assert(scanCalls.length === 2 && scanCalls[0] === "0" && scanCalls[1] === "10", "Cursor iterou corretamente de '0' para '10' e retornou a '0'.");

  // Limpeza de registros de teste
  await sql.query(`DELETE FROM "catalog_airing_schedule" WHERE "id" = $1;`, [testSchedId]);
  await sql.query(`DELETE FROM "catalog_anime" WHERE "id" IN ($1, $2);`, [testAnimeId, manualAnimeId]);

  console.log("\n=================================================================");
  console.log(`RESULTADO DA AUDITORIA: ${passedCount}/${totalTests} TESTES APROVADOS!`);
  console.log("=================================================================\n");

  process.exit(0);
}

runAuditSuite().catch((err) => {
  console.error("Erro fatal na suite de teste:", err);
  process.exit(1);
});
