import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import { getSql, dbSource } from "./db";
import { loadAllSettingsFromDb, saveSettingsToDb } from "./settings/settings.server";
import { DEFAULT_ADMIN_SETTINGS } from "./settings/settings-types";
import { listActiveBansMap, applyTemporaryUserBan, buildActiveBanKey } from "./moderation-bans.server";

describe(`C4 — Otimização de Configurações e Banimentos (${dbSource})`, () => {
  const testUserId = `c4-user-${Date.now()}`;
  const testAdminId = `c4-admin-${Date.now()}`;

  before(async () => {
    const sql = await getSql();
    // Insere usuário de teste na tabela user para os testes de banimento
    await sql.query(
      `INSERT INTO "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
       VALUES ($1, 'Usuário C4', 'c4@example.com', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT ("id") DO NOTHING;`,
      [testUserId],
    );
    await sql.query(
      `INSERT INTO "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
       VALUES ($1, 'Admin C4', 'adminc4@example.com', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT ("id") DO NOTHING;`,
      [testAdminId],
    );
  });

  after(async () => {
    const sql = await getSql();
    const banKey = buildActiveBanKey(testUserId);
    await sql.query(`DELETE FROM "admin_settings" WHERE "key" = $1 OR "key" LIKE 'comment_ban:%';`, [banKey]);
    await sql.query(`DELETE FROM "user" WHERE "id" = ANY($1::text[]);`, [[testUserId, testAdminId]]);
  });

  it("C4.1 — loadAllSettingsFromDb carrega apenas chaves permitidas e ignora chaves de banimento e logs em admin_settings", async () => {
    const sql = await getSql();

    // Insere um banimento e um log em admin_settings para verificar se NÃO são trazidos pela consulta de settings
    const dummyBanKey = buildActiveBanKey(testUserId);
    const dummyLogKey = "comment_ban_log:000000000000000-dummy";
    await sql.query(
      `INSERT INTO "admin_settings" ("key", "value", "createdAt", "updatedAt")
       VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value";`,
      [dummyBanKey, JSON.stringify({ userId: testUserId, expiresAt: Date.now() + 999999, reason: "Ban Teste" })],
    );
    await sql.query(
      `INSERT INTO "admin_settings" ("key", "value", "createdAt", "updatedAt")
       VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value";`,
      [dummyLogKey, JSON.stringify({ id: "log-1", userId: testUserId, action: "ban" })],
    );

    // Salva uma configuração administrativa válida
    await saveSettingsToDb({ site_name: "Hikari Teste C4.1" });

    // Carrega configurações
    const settings = await loadAllSettingsFromDb();
    assert.equal(settings.site_name, "Hikari Teste C4.1");

    // Verifica diretamente na base que o número de chaves retornadas por loadAllSettings (via fetchAllSettingsFromDbStrict)
    // restringe-se exatamente a DEFAULT_ADMIN_SETTINGS (sem trazer comment_ban:* ou comment_ban_log:*)
    const allowedKeys = Object.keys(DEFAULT_ADMIN_SETTINGS);
    const allFetchedRows = await sql.query<{ key: string }>(
      `SELECT "key" FROM "admin_settings" WHERE "key" = ANY($1::text[]);`,
      [allowedKeys],
    );

    assert.ok(allFetchedRows.every((r) => allowedKeys.includes(r.key)));
    assert.equal(allFetchedRows.some((r) => r.key.startsWith("comment_ban:")), false);
  });

  it("C4.2 — listActiveBansMap lê banimentos ativos e filtrados sem executar DELETE síncrono no caminho de leitura", async () => {
    const sql = await getSql();

    // Aplica um banimento ativo válido
    const now = Date.now();
    await applyTemporaryUserBan(sql, {
      targetUserId: testUserId,
      preset: "1h",
      reason: "Teste de banimento C4.2 ativo",
      actorId: testAdminId,
      nowMs: now,
    });

    // Insere manualmente um banimento expirado no passado
    const expiredUserId = `c4-expired-${now}`;
    const expiredBanKey = buildActiveBanKey(expiredUserId);
    const expiredBanRecord = {
      banId: "ban-expired-test",
      userId: expiredUserId,
      reason: "Banimento já expirado",
      durationMs: 1000,
      expiresAt: now - 5000, // Expirado há 5 segundos
      bannedAt: now - 6000,
      bannedBy: testAdminId,
    };
    await sql.query(
      `INSERT INTO "admin_settings" ("key", "value", "createdAt", "updatedAt")
       VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value";`,
      [expiredBanKey, JSON.stringify(expiredBanRecord)],
    );

    // Conta registros comment_ban antes da listagem
    const beforeCountRows = await sql.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM "admin_settings" WHERE "key" LIKE 'comment_ban:%';`,
    );
    const countBefore = beforeCountRows[0]?.count ?? 0;

    // Executa listActiveBansMap no tempo 'now'
    const activeMap = await listActiveBansMap(sql, now);

    // Confirma que o banimento ativo está presente e o expirado NÃO está no mapa retornado
    assert.ok(activeMap.has(testUserId));
    assert.equal(activeMap.has(expiredUserId), false);

    // Conta registros comment_ban após a listagem
    const afterCountRows = await sql.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM "admin_settings" WHERE "key" LIKE 'comment_ban:%';`,
    );
    const countAfter = afterCountRows[0]?.count ?? 0;

    // GARANTIA C4.2: listActiveBansMap NÃO realizou DELETE síncrono de registros expirados na leitura!
    assert.equal(
      countAfter,
      countBefore,
      "listActiveBansMap não deve executar DELETE síncrono de bans expirados no caminho de leitura",
    );

    // Limpeza explícita do banimento expirado de teste
    await sql.query(`DELETE FROM "admin_settings" WHERE "key" = $1;`, [expiredBanKey]);
  });
});
