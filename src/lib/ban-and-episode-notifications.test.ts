import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { dbSource, getSql } from "./db";
import {
  applyTemporaryUserBan,
  buildActiveBanKey,
  getActiveUserBan,
  listBansAndHistory,
  revokeUserBan,
} from "./moderation-bans.server";
import {
  dispatchEpisodePublishedNotifications,
  executeCreateNotification,
  executeGetNotifications,
  executeGetUnreadNotificationCount,
  executeMarkNotificationAsRead,
} from "./notifications.functions";

describe(`Notificações de Banimento, Liberação e Autoria de Episódios (${dbSource})`, () => {
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const adminId = `notif-admin-${runId}`;
  const admin2Id = `notif-admin2-${runId}`;
  const userAId = `notif-usera-${runId}`;
  const userBId = `notif-userb-${runId}`;
  const userCId = `notif-userc-${runId}`;
  const userOtherId = `notif-other-${runId}`;
  const animeId = `notif-anime-${runId}`;
  const epManualId = `notif-ep-manual-${runId}`;
  const epCrossAdminId = `notif-ep-cross-${runId}`;
  const commentId = `notif-cmt-${runId}`;
  const replyId = `notif-rep-${runId}`;

  before(async () => {
    const sql = await getSql();
    const users = [
      { id: adminId, name: "Admin Notif 1", email: `admin1-${runId}@example.com`, nick: `admin1_${runId.slice(-5)}`, role: "admin" },
      { id: admin2Id, name: "Admin Notif 2", email: `admin2-${runId}@example.com`, nick: `admin2_${runId.slice(-5)}`, role: "admin" },
      { id: userAId, name: "Usuário A", email: `usera-${runId}@example.com`, nick: `usera_${runId.slice(-5)}`, role: "user" },
      { id: userBId, name: "Usuário B", email: `userb-${runId}@example.com`, nick: `userb_${runId.slice(-5)}`, role: "user" },
      { id: userCId, name: "Usuário C", email: `userc-${runId}@example.com`, nick: `userc_${runId.slice(-5)}`, role: "user" },
      { id: userOtherId, name: "Outro Usuário", email: `other-${runId}@example.com`, nick: `other_${runId.slice(-5)}`, role: "user" },
    ];

    for (const u of users) {
      await sql.query(
        `INSERT INTO "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT ("id") DO NOTHING;`,
        [u.id, u.name, u.email],
      );
      await sql.query(
        `INSERT INTO "profile" ("userId", "nick", "displayName", "role", "accountType")
         VALUES ($1, $2, $3, $4, 'public')
         ON CONFLICT ("userId") DO NOTHING;`,
        [u.id, u.nick, u.name, u.role],
      );
    }

    await sql.query(
      `INSERT INTO "catalog_anime" ("id", "title", "createdAt", "updatedAt")
       VALUES ($1, 'Anime Teste Notificações', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT ("id") DO NOTHING;`,
      [animeId],
    );
    await sql.query(
      `INSERT INTO "catalog_season" ("animeId", "number", "title", "position", "createdAt")
       VALUES ($1, 1, 'Temporada 1', 0, CURRENT_TIMESTAMP)
       ON CONFLICT ("animeId", "number") DO NOTHING;`,
      [animeId],
    );

    // userA, userB e userOther acompanham o anime
    for (const followerId of [userAId, userBId, userOtherId]) {
      await sql.query(
        `INSERT INTO "user_anime_tracking" ("userId", "animeId", "status", "updatedAt")
         VALUES ($1, $2, 'watching', CURRENT_TIMESTAMP)
         ON CONFLICT ("userId", "animeId") DO NOTHING;`,
        [followerId, animeId],
      );
    }

    // Comentário e resposta para testar preservação das notificações sociais
    await sql.query(
      `INSERT INTO "comment" ("id", "userId", "animeId", "episodeId", "content", "createdAt")
       VALUES ($1, $2, $3, $4, 'Comentário base de teste', CURRENT_TIMESTAMP)
       ON CONFLICT ("id") DO NOTHING;`,
      [commentId, userCId, animeId, epManualId],
    );
    await sql.query(
      `INSERT INTO "comment" ("id", "userId", "parentId", "animeId", "episodeId", "content", "createdAt")
       VALUES ($1, $2, $3, $4, $5, 'Resposta de teste', CURRENT_TIMESTAMP)
       ON CONFLICT ("id") DO NOTHING;`,
      [replyId, userOtherId, commentId, animeId, epManualId],
    );
    await sql.query(
      `INSERT INTO "comment_like" ("id", "commentId", "userId", "type", "createdAt")
       VALUES ($1, $2, $3, 'like', CURRENT_TIMESTAMP)
       ON CONFLICT ("commentId", "userId") DO NOTHING;`,
      [`like-${runId}`, commentId, userOtherId],
    );
  });

  after(async () => {
    const sql = await getSql();
    const userIds = [adminId, admin2Id, userAId, userBId, userCId, userOtherId];
    const banKeys = userIds.map((id) => buildActiveBanKey(id));

    await sql.query(`DELETE FROM "notification" WHERE "userId" = ANY($1::text[]);`, [userIds]);
    await sql.query(`DELETE FROM "admin_settings" WHERE "key" = ANY($1::text[]);`, [banKeys]);
    await sql.query(
      `DELETE FROM "admin_settings" WHERE "key" LIKE 'comment_ban_log:%' AND ("value" LIKE $1);`,
      [`%${runId}%`],
    );
    await sql.query(`DELETE FROM "comment_like" WHERE "commentId" = $1;`, [commentId]);
    await sql.query(`DELETE FROM "comment" WHERE "id" = ANY($1::text[]);`, [[replyId, commentId]]);
    await sql.query(`DELETE FROM "user_anime_tracking" WHERE "animeId" = $1;`, [animeId]);
    await sql.query(`DELETE FROM "catalog_episode" WHERE "animeId" = $1;`, [animeId]);
    await sql.query(`DELETE FROM "catalog_season" WHERE "animeId" = $1;`, [animeId]);
    await sql.query(`DELETE FROM "catalog_anime" WHERE "id" = $1;`, [animeId]);
    await sql.query(`DELETE FROM "profile" WHERE "userId" = ANY($1::text[]);`, [userIds]);
    await sql.query(`DELETE FROM "user" WHERE "id" = ANY($1::text[]);`, [userIds]);
  });

  it("1 & 3. Banimento temporário notifica apenas o usuário banido com motivo e duração/término", async () => {
    const sql = await getSql();
    const now = Date.now();
    const reason = "Spam repetitivo nos comentários do episódio";

    const ban = await applyTemporaryUserBan(sql, {
      targetUserId: userAId,
      preset: "2h",
      reason,
      actorId: adminId,
      nowMs: now,
    });

    assert.equal(ban.isPermanent, false);
    assert.ok(ban.expiresAt !== null && ban.expiresAt > now);

    const userARows = await sql.query<{
      id: string;
      type: string;
      message: string;
      actorId: string | null;
      read: boolean;
    }>(
      `SELECT "id", "type", "message", "actorId", "read"
       FROM "notification"
       WHERE "userId" = $1 AND "dedupKey" = $2;`,
      [userAId, `ban_applied:${userAId}:${ban.banId}`],
    );

    assert.equal(userARows.length, 1);
    assert.equal(userARows[0].type, "account_banned");
    assert.equal(userARows[0].actorId, null);
    assert.equal(userARows[0].read, false);
    assert.ok(userARows[0].message.includes("banida"));
    assert.ok(userARows[0].message.includes("2 horas"));
    assert.ok(userARows[0].message.includes(reason));

    // Nenhum outro usuário recebeu notificação deste banimento
    const otherRows = await sql.query<{ count: string }>(
      `SELECT count(*)::text AS count
       FROM "notification"
       WHERE "userId" != $1 AND "dedupKey" LIKE $2;`,
      [userAId, `%${ban.banId}%`],
    );
    assert.equal(Number(otherRows[0]?.count ?? "0"), 0);
  });

  it("4. Remoção antecipada de banimento notifica liberação apenas uma vez", async () => {
    const sql = await getSql();
    const now = Date.now();

    const active = await getActiveUserBan(sql, userAId, now);
    assert.ok(active, "Banimento de userA deveria estar ativo antes da revogação");

    const revoked = await revokeUserBan(sql, {
      targetUserId: userAId,
      actorId: adminId,
      nowMs: now + 1000,
    });
    assert.equal(revoked.ok, true);

    const afterRevoke = await getActiveUserBan(sql, userAId, now + 2000);
    assert.equal(afterRevoke, null);

    const unbanRows = await sql.query<{ id: string; type: string; message: string }>(
      `SELECT "id", "type", "message"
       FROM "notification"
       WHERE "userId" = $1 AND "type" = 'account_unbanned' AND "dedupKey" = $2;`,
      [userAId, `ban_ended:${userAId}:${active.banId}`],
    );
    assert.equal(unbanRows.length, 1);
    assert.ok(unbanRows[0].message.includes("Banimento encerrado"));
    assert.ok(unbanRows[0].message.includes("conta está liberada"));

    // Nova tentativa de revogação falha com 404 e não cria duplicata
    await assert.rejects(
      () =>
        revokeUserBan(sql, {
          targetUserId: userAId,
          actorId: adminId,
          nowMs: now + 3000,
        }),
      /não possui um banimento ativo/i,
    );

    const stillOne = await sql.query<{ count: string }>(
      `SELECT count(*)::text AS count
       FROM "notification"
       WHERE "userId" = $1 AND "dedupKey" = $2;`,
      [userAId, `ban_ended:${userAId}:${active.banId}`],
    );
    assert.equal(Number(stillOne[0]?.count ?? "0"), 1);
  });

  it("2. Banimento permanente notifica que é permanente e não expira nem gera liberação automática", async () => {
    const sql = await getSql();
    const now = Date.now();
    const permReason = "Violação grave reincidente";

    const permBan = await applyTemporaryUserBan(sql, {
      targetUserId: userBId,
      preset: "permanent",
      isPermanent: true,
      reason: permReason,
      actorId: adminId,
      nowMs: now,
    });

    assert.equal(permBan.isPermanent, true);
    assert.equal(permBan.expiresAt, null);
    assert.equal(permBan.durationPreset, "permanent");

    const permNotifs = await sql.query<{ message: string; type: string }>(
      `SELECT "type", "message"
       FROM "notification"
       WHERE "userId" = $1 AND "dedupKey" = $2;`,
      [userBId, `ban_applied:${userBId}:${permBan.banId}`],
    );
    assert.equal(permNotifs.length, 1);
    assert.equal(permNotifs[0].type, "account_banned");
    assert.ok(permNotifs[0].message.toLowerCase().includes("permanente"));
    assert.ok(permNotifs[0].message.includes(permReason));

    // Mesmo muito no futuro (+100 anos), o banimento permanente permanece ativo e não dispara liberação
    const farFuture = now + 100 * 365 * 24 * 60 * 60 * 1000;
    const stillActive = await getActiveUserBan(sql, userBId, farFuture);
    assert.ok(stillActive);
    assert.equal(stillActive.isPermanent, true);

    await listBansAndHistory(sql, farFuture);

    const unbanRows = await sql.query<{ count: string }>(
      `SELECT count(*)::text AS count
       FROM "notification"
       WHERE "userId" = $1 AND "type" = 'account_unbanned';`,
      [userBId],
    );
    assert.equal(Number(unbanRows[0]?.count ?? "0"), 0);

    // Revogação manual de banimento permanente libera e notifica uma única vez
    await revokeUserBan(sql, {
      targetUserId: userBId,
      actorId: adminId,
      nowMs: now + 5000,
    });
    const unbanAfterManual = await sql.query<{ count: string }>(
      `SELECT count(*)::text AS count
       FROM "notification"
       WHERE "userId" = $1 AND "type" = 'account_unbanned';`,
      [userBId],
    );
    assert.equal(Number(unbanAfterManual[0]?.count ?? "0"), 1);
  });

  it("5 & 6. Expiração automática de banimento dispara notificação única mesmo sob concorrência e retentativas", async () => {
    const sql = await getSql();
    const pastBannedAt = Date.now() - 2 * 60 * 60 * 1000;

    // Aplica banimento de 1h no passado (já vencido agora!)
    const expiredBan = await applyTemporaryUserBan(sql, {
      targetUserId: userCId,
      preset: "1h",
      reason: "Teste de expiração automática",
      actorId: adminId,
      nowMs: pastBannedAt,
    });

    // Dispara várias leituras concorrentes (getActiveUserBan + executeGetNotifications + executeGetUnreadNotificationCount)
    // para provar que a transição atômica + dedupKey geram EXATAMENTE 1 notificação de encerramento.
    const [b1, b2, n1, c1] = await Promise.all([
      getActiveUserBan(sql, userCId, Date.now()),
      getActiveUserBan(sql, userCId, Date.now()),
      executeGetNotifications(sql, userCId),
      executeGetUnreadNotificationCount(sql, userCId),
    ]);

    assert.equal(b1, null);
    assert.equal(b2, null);
    assert.ok(c1.unreadCount >= 2); // 1 ban_applied + 1 ban_ended

    const endedCount = await sql.query<{ count: string }>(
      `SELECT count(*)::text AS count
       FROM "notification"
       WHERE "userId" = $1 AND "dedupKey" = $2;`,
      [userCId, `ban_ended:${userCId}:${expiredBan.banId}`],
    );
    assert.equal(Number(endedCount[0]?.count ?? "0"), 1);

    const hasEndedInList = n1.notifications.some(
      (n) =>
        n.type === "account_unbanned" &&
        n.message.includes("Banimento encerrado"),
    );
    assert.equal(hasEndedInList, true);

    // Reprocessamento / nova tentativa de criar a mesma notificação não duplica nem reseta leitura
    const endedRow = n1.notifications.find((n) => n.type === "account_unbanned");
    assert.ok(endedRow);
    await executeMarkNotificationAsRead(sql, userCId, endedRow.id);

    const retryRes = await executeCreateNotification(sql, {
      userId: userCId,
      actorId: null,
      type: "account_unbanned",
      message: "Banimento encerrado: duplicata",
      dedupKey: `ban_ended:${userCId}:${expiredBan.banId}`,
      bypassLock: true,
    });
    assert.equal(retryRes.success, false);
    assert.equal(retryRes.reason, "duplicate");

    const persistedRow = await sql.query<{ read: boolean }>(
      `SELECT "read" FROM "notification" WHERE "id" = $1;`,
      [endedRow.id],
    );
    assert.equal(persistedRow[0]?.read, true);
  });

  it("7. Usuário com outro banimento ativo (sobreposição / ban secundário) NÃO recebe notificação de conta liberada", async () => {
    const sql = await getSql();
    const now = Date.now();

    // Aplica banimento 1 em userA
    const ban1 = await applyTemporaryUserBan(sql, {
      targetUserId: userAId,
      preset: "20m",
      reason: "Primeiro banimento ativo",
      actorId: adminId,
      nowMs: now,
    });

    // Aplica banimento 2 antes de ban1 terminar (substituição mantendo usuário banido)
    const ban2 = await applyTemporaryUserBan(sql, {
      targetUserId: userAId,
      preset: "7d",
      reason: "Extensão/segundo banimento ativo",
      actorId: adminId,
      nowMs: now + 5000,
    });

    // Simula também um banimento secundário expirado sob chave distinta para garantir
    // que a verificação de outro banimento ativo impeça notificação de liberação.
    const secondaryExpiredKey = `${buildActiveBanKey(userAId)}:legacy`;
    await sql.query(
      `INSERT INTO "admin_settings" ("key", "value", "createdAt", "updatedAt")
       VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value";`,
      [
        secondaryExpiredKey,
        JSON.stringify({
          banId: `ban-sec-${runId}`,
          userId: userAId,
          reason: "Banimento secundário expirado",
          durationPreset: "20m",
          durationLabel: "20 minutos",
          durationMs: 1200000,
          bannedAt: now - 3600000,
          expiresAt: now - 1000,
          bannedBy: adminId,
        }),
      ],
    );

    await listBansAndHistory(sql, now + 6000);

    // Usuário A ainda possui ban2 ativo: NÃO deve receber notificação de ban_ended!
    const banEndedForBan1OrSec = await sql.query<{ count: string }>(
      `SELECT count(*)::text AS count
       FROM "notification"
       WHERE "userId" = $1
         AND "type" = 'account_unbanned'
         AND ("dedupKey" = $2 OR "dedupKey" = $3);`,
      [
        userAId,
        `ban_ended:${userAId}:${ban1.banId}`,
        `ban_ended:${userAId}:ban-sec-${runId}`,
      ],
    );
    assert.equal(Number(banEndedForBan1OrSec[0]?.count ?? "0"), 0);

    // Quando ban2 for finalmente revogado, aí sim userA recebe liberação
    await revokeUserBan(sql, {
      targetUserId: userAId,
      actorId: adminId,
      nowMs: now + 7000,
    });
    const ban2Ended = await sql.query<{ count: string }>(
      `SELECT count(*)::text AS count
       FROM "notification"
       WHERE "userId" = $1 AND "dedupKey" = $2;`,
      [userAId, `ban_ended:${userAId}:${ban2.banId}`],
    );
    assert.equal(Number(ban2Ended[0]?.count ?? "0"), 1);
  });

  it("8 & 9. Publicação de episódio NÃO notifica o autor real (mesmo se outro admin publicar) e notifica os demais seguidores", async () => {
    const sql = await getSql();

    // Limpa notificações de episódio anteriores do teste
    await sql.query(
      `DELETE FROM "notification" WHERE "animeId" = $1 AND "type" = 'episode';`,
      [animeId],
    );

    // Caso 8A: Usuário A cadastra e publica manualmente epManualId enquanto também acompanha o anime
    await sql.query(
      `INSERT INTO "catalog_episode" (
         "id", "animeId", "seasonNumber", "number", "title", "authorId",
         "published", "publishedAt", "createdAt", "updatedAt"
       )
       VALUES ($1, $2, 1, 1, 'Episódio Manual', $3, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
      [epManualId, animeId, userAId],
    );

    const resManual = await dispatchEpisodePublishedNotifications(sql, {
      animeId,
      episodeId: epManualId,
      animeTitle: "Anime Teste Notificações",
      episodeTitle: "Episódio Manual",
      episodeNumber: 1,
      publisherId: userAId,
    });
    assert.equal(resManual.resolvedAuthorId, userAId);
    assert.ok(resManual.excludedUserIds.includes(userAId));

    // User A NÃO recebeu; User B e User Other receberam
    const manualUserANotifs = await sql.query<{ id: string }>(
      `SELECT "id" FROM "notification" WHERE "userId" = $1 AND "episodeId" = $2;`,
      [userAId, epManualId],
    );
    assert.equal(manualUserANotifs.length, 0);

    const manualFollowersNotifs = await sql.query<{ userId: string }>(
      `SELECT "userId" FROM "notification" WHERE "episodeId" = $1 ORDER BY "userId";`,
      [epManualId],
    );
    const notifiedIds1 = manualFollowersNotifs.map((r) => r.userId).sort();
    assert.deepEqual(notifiedIds1, [userBId, userOtherId].sort());

    // Caso 8B: Usuário A cadastrou o episódio como rascunho ("authorId" = userAId),
    // e posteriormente admin2Id (outro usuário/fluxo automático) publica o episódio!
    // Mesmo que o usuário logado no momento seja admin2Id, o autor real (userAId) NÃO pode ser notificado.
    await sql.query(
      `INSERT INTO "catalog_episode" (
         "id", "animeId", "seasonNumber", "number", "title", "authorId",
         "published", "publishedAt", "createdAt", "updatedAt"
       )
       VALUES ($1, $2, 1, 2, 'Episódio Cadastrado por A e Publicado por Admin2', $3, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
      [epCrossAdminId, animeId, userAId],
    );

    const resCross = await dispatchEpisodePublishedNotifications(sql, {
      animeId,
      episodeId: epCrossAdminId,
      animeTitle: "Anime Teste Notificações",
      episodeTitle: "Episódio Cadastrado por A e Publicado por Admin2",
      episodeNumber: 2,
      publisherId: admin2Id, // outro usuário logado na publicação!
    });

    assert.equal(resCross.resolvedAuthorId, userAId);
    assert.ok(resCross.excludedUserIds.includes(userAId));
    assert.ok(resCross.excludedUserIds.includes(admin2Id));

    const crossUserANotifs = await sql.query<{ id: string }>(
      `SELECT "id" FROM "notification" WHERE "userId" = $1 AND "episodeId" = $2;`,
      [userAId, epCrossAdminId],
    );
    assert.equal(
      crossUserANotifs.length,
      0,
      "Autor real do episódio não pode receber notificação mesmo quando outro admin/fluxo publica",
    );

    const crossFollowersNotifs = await sql.query<{ userId: string }>(
      `SELECT "userId" FROM "notification" WHERE "episodeId" = $1 ORDER BY "userId";`,
      [epCrossAdminId],
    );
    assert.deepEqual(
      crossFollowersNotifs.map((r) => r.userId).sort(),
      [userBId, userOtherId].sort(),
    );

    // Caso 8C: Chamada direta via executeCreateNotification para o autor real também deve ser bloqueada
    const directSelfAttempt = await executeCreateNotification(sql, {
      userId: userAId,
      actorId: admin2Id,
      type: "episode",
      message: "Tentativa direta para o autor do episódio",
      animeId,
      episodeId: epCrossAdminId,
    });
    assert.equal(directSelfAttempt.success, false);
    assert.equal(directSelfAttempt.reason, "self_episode_author");
  });

  it("10 & 11. Notificações sociais existentes, contagem não lida e marcação como lida continuam funcionando", async () => {
    const sql = await getSql();

    const followRes = await executeCreateNotification(sql, {
      userId: userCId,
      actorId: userOtherId,
      type: "new_follower",
      message: "Outro Usuário começou a seguir você.",
    });
    assert.equal(followRes.success, true);

    const replyRes = await executeCreateNotification(sql, {
      userId: userCId,
      actorId: userOtherId,
      type: "comment_reply",
      message: "Outro Usuário respondeu ao seu comentário.",
      commentId: replyId,
      animeId,
      episodeId: epManualId,
    });
    assert.equal(replyRes.success, true);

    const likeRes = await executeCreateNotification(sql, {
      userId: userCId,
      actorId: userOtherId,
      type: "comment_like",
      message: "Outro Usuário curtiu seu comentário.",
      commentId,
      animeId,
      episodeId: epManualId,
    });
    assert.equal(likeRes.success, true);

    const listBefore = await executeGetNotifications(sql, userCId, { limit: 50 });
    const countBefore = await executeGetUnreadNotificationCount(sql, userCId);

    assert.equal(listBefore.unreadCount, countBefore.unreadCount);
    assert.ok(listBefore.notifications.some((n) => n.type === "new_follower"));
    assert.ok(listBefore.notifications.some((n) => n.type === "comment_reply"));
    assert.ok(listBefore.notifications.some((n) => n.type === "comment_like"));
    assert.ok(listBefore.notifications.some((n) => n.type === "account_banned"));
    assert.ok(listBefore.notifications.some((n) => n.type === "account_unbanned"));

    // Marca uma notificação social como lida e verifica decremento exato
    if (followRes.notificationId) {
      const marked = await executeMarkNotificationAsRead(
        sql,
        userCId,
        followRes.notificationId,
      );
      assert.equal(marked.success, true);
      const countAfter = await executeGetUnreadNotificationCount(sql, userCId);
      assert.equal(countAfter.unreadCount, countBefore.unreadCount - 1);
    }
  });
});
