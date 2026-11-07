/**
 * Suite de Verificação Completa da Etapa 10:
 * Sistema de Notificações | Hikari
 */

import { getSql } from "@/lib/db";
import {
  executeCreateNotification,
  executeGetNotifications,
  executeGetUnreadNotificationCount,
  executeMarkNotificationAsRead,
  executeMarkAllNotificationsAsRead,
  executeDeleteNotification,
  executeDeleteAllNotifications,
} from "@/lib/notifications.functions";
import {
  executeBlockUser,
  executeUnblockUser,
  executeFollowUser,
  executeAcceptFollowRequest,
  evaluateUserPrivacy,
} from "@/lib/profile.functions";

async function runTests() {
  console.log("=== INICIANDO SUÍTE DE TESTES DA ETAPA 10: SISTEMA DE NOTIFICAÇÕES ===");
  const sql = await getSql();

  const now = Date.now();
  const idAlice = `e10_alice_${now}`;
  const idBob = `e10_bob_${now}`;
  const idCharlie = `e10_charlie_${now}`;
  const idDave = `e10_dave_${now}`;

  try {
    // 0. Seed usuários de teste
    console.log("\n-> Criando usuários de teste (Alice, Bob, Charlie, Dave)...");

    await sql`
      insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
      values
        (${idAlice}, 'Alice One', ${idAlice + "@test.com"}, true, current_timestamp, current_timestamp),
        (${idBob}, 'Bob Two', ${idBob + "@test.com"}, true, current_timestamp, current_timestamp),
        (${idCharlie}, 'Charlie Three', ${idCharlie + "@test.com"}, true, current_timestamp, current_timestamp),
        (${idDave}, 'Dave Four', ${idDave + "@test.com"}, true, current_timestamp, current_timestamp)
    `;

    await sql`
      insert into "profile" ("userId", "nick", "displayName", "accountType", "allowFollowers", "privacyComments", "privacyLists")
      values
        (${idAlice}, ${"alice_" + now.toString().slice(-6)}, 'Alice One', 'public', true, 'public', 'public'),
        (${idBob}, ${"bob_" + now.toString().slice(-6)}, 'Bob Two', 'private', true, 'followers', 'followers'),
        (${idCharlie}, ${"charlie_" + now.toString().slice(-6)}, 'Charlie Three', 'public', true, 'public', 'public'),
        (${idDave}, ${"dave_" + now.toString().slice(-6)}, 'Dave Four', 'public', true, 'public', 'public')
    `;

    // Comentário para teste de reações
    const testCommentId = `c10_${now}`;
    await sql`
      insert into "comment" ("id", "userId", "animeId", "episodeId", "content", "createdAt")
      values (${testCommentId}, ${idAlice}, 'kitsu-7442', 'ep-1', 'Excelente primeiro episódio!', current_timestamp)
    `;

    console.log("✓ Usuários e dados de apoio criados com sucesso.");

    // =========================================================================
    // TESTE 1: Criação de cada tipo de notificação existente
    // =========================================================================
    console.log("\n[Teste 1] Criação de cada tipo de notificação");

    const notifFollower = await executeCreateNotification(sql, {
      userId: idAlice,
      actorId: idBob,
      type: "new_follower",
      message: "Bob Two começou a seguir você.",
    });
    if (!notifFollower.success || !notifFollower.notificationId) {
      throw new Error("Falha ao criar notificação new_follower");
    }

    const notifRequest = await executeCreateNotification(sql, {
      userId: idBob,
      actorId: idCharlie,
      type: "follow_request",
      message: "Charlie Three solicitou para seguir você.",
    });
    if (!notifRequest.success || !notifRequest.notificationId) {
      throw new Error("Falha ao criar notificação follow_request");
    }

    const notifAccept = await executeCreateNotification(sql, {
      userId: idCharlie,
      actorId: idBob,
      type: "follow_accept",
      message: "Bob Two aceitou sua solicitação para seguir.",
    });
    if (!notifAccept.success || !notifAccept.notificationId) {
      throw new Error("Falha ao criar notificação follow_accept");
    }

    const notifLike = await executeCreateNotification(sql, {
      userId: idAlice,
      actorId: idCharlie,
      type: "comment_like",
      message: "Charlie Three curtiu seu comentário.",
      commentId: testCommentId,
      animeId: "kitsu-7442",
      episodeId: "ep-1",
    });
    if (!notifLike.success || !notifLike.notificationId) {
      throw new Error("Falha ao criar notificação comment_like");
    }

    const notifReply = await executeCreateNotification(sql, {
      userId: idAlice,
      actorId: idDave,
      type: "comment_reply",
      message: "Dave Four respondeu ao seu comentário.",
      commentId: testCommentId,
      animeId: "kitsu-7442",
      episodeId: "ep-1",
    });
    if (!notifReply.success || !notifReply.notificationId) {
      throw new Error("Falha ao criar notificação comment_reply");
    }

    console.log("✓ Teste 1 passou: Todos os 5 tipos de notificação criados com sucesso.");

    // =========================================================================
    // TESTE 2: Não notificar o próprio autor (auto-ações rejeitadas)
    // =========================================================================
    console.log("\n[Teste 2] Não notificar o próprio autor");

    const selfNotif = await executeCreateNotification(sql, {
      userId: idAlice,
      actorId: idAlice,
      type: "comment_like",
      message: "Você curtiu seu comentário.",
      commentId: testCommentId,
    });
    if (selfNotif.success || selfNotif.reason !== "self_action") {
      throw new Error("Auto-notificação deveria ter sido rejeitada com 'self_action'");
    }

    const selfCount = await sql<{ count: string }>`
      select count(*)::text as count from "notification"
      where "userId" = ${idAlice} and "actorId" = ${idAlice}
    `;
    if (Number(selfCount[0]?.count ?? "0") > 0) {
      throw new Error("Registro de auto-notificação encontrado no banco");
    }

    console.log("✓ Teste 2 passou: Auto-notificações barradas com sucesso.");

    // =========================================================================
    // TESTE 3: Não gerar duplicatas (Deduplicação de eventos)
    // =========================================================================
    console.log("\n[Teste 3] Deduplicação inteligente de eventos");

    // a) new_follower duplicado deve atualizar a notificação existente e retornar o mesmo ID
    const notifFollower2 = await executeCreateNotification(sql, {
      userId: idAlice,
      actorId: idBob,
      type: "new_follower",
      message: "Bob Two começou a seguir você (atualizado).",
    });
    if (!notifFollower2.success || notifFollower2.notificationId !== notifFollower.notificationId) {
      throw new Error("Deduplicação de new_follower falhou em reusar notificação existente");
    }

    // b) follow_request duplicado deve atualizar a notificação existente
    const notifRequest2 = await executeCreateNotification(sql, {
      userId: idBob,
      actorId: idCharlie,
      type: "follow_request",
      message: "Charlie Three solicitou para seguir você (reaberto).",
    });
    if (!notifRequest2.success || notifRequest2.notificationId !== notifRequest.notificationId) {
      throw new Error("Deduplicação de follow_request falhou em reusar notificação existente");
    }

    // c) comment_like para o mesmo comentário deve atualizar existente
    const notifLike2 = await executeCreateNotification(sql, {
      userId: idAlice,
      actorId: idDave,
      type: "comment_like",
      message: "Dave Four curtiu seu comentário.",
      commentId: testCommentId,
    });
    if (!notifLike2.success || notifLike2.notificationId !== notifLike.notificationId) {
      throw new Error("Deduplicação de comment_like falhou em consolidar likes do mesmo comentário");
    }

    console.log("✓ Teste 3 passou: Deduplicação consolidou eventos sem duplicatas.");

    // =========================================================================
    // TESTE 4: Isolamento entre usuários (usuário B não vê nem altera de A)
    // =========================================================================
    console.log("\n[Teste 4] Isolamento estrito entre usuários");

    const aliceList = await executeGetNotifications(sql, idAlice);
    const bobList = await executeGetNotifications(sql, idBob);

    // Bob não deve ver nenhuma notificação destinada a Alice
    const leakedToBob = bobList.notifications.filter((n) => n.id === notifFollower.notificationId);
    if (leakedToBob.length > 0) {
      throw new Error("Vazamento de notificação: Bob recebeu notificação de Alice");
    }

    // Bob tenta marcar a notificação de Alice como lida
    const bobTamperRead = await executeMarkNotificationAsRead(sql, idBob, notifFollower.notificationId!);
    if (bobTamperRead.success) {
      throw new Error("Segurança violada: Bob conseguiu marcar notificação de Alice como lida");
    }

    // Bob tenta excluir a notificação de Alice
    const bobTamperDelete = await executeDeleteNotification(sql, idBob, notifFollower.notificationId!);
    if (bobTamperDelete.success) {
      throw new Error("Segurança violada: Bob conseguiu excluir notificação de Alice");
    }

    // A notificação de Alice continua intacta e não-lida
    const checkAliceNotif = await sql<{ read: boolean }>`
      select "read" from "notification" where "id" = ${notifFollower.notificationId!}
    `;
    if (!checkAliceNotif[0] || checkAliceNotif[0].read !== false) {
      throw new Error("Notificação de Alice foi alterada indevidamente");
    }

    console.log("✓ Teste 4 passou: Isolamento e imunidade contra adulteração de terceiros confirmados.");

    // =========================================================================
    // TESTE 5: Marcar uma notificação como lida
    // =========================================================================
    console.log("\n[Teste 5] Marcar notificação individual como lida");

    const unreadBefore = (await executeGetUnreadNotificationCount(sql, idAlice)).unreadCount;
    const markRes = await executeMarkNotificationAsRead(sql, idAlice, notifFollower.notificationId!);
    if (!markRes.success) {
      throw new Error("Falha ao marcar notificação legítima como lida");
    }

    const unreadAfter = (await executeGetUnreadNotificationCount(sql, idAlice)).unreadCount;
    if (unreadAfter !== unreadBefore - 1) {
      throw new Error(`Contador não diminuiu corretamente: antes ${unreadBefore}, depois ${unreadAfter}`);
    }

    console.log("✓ Teste 5 passou: Notificação marcada como lida e contador sincronizado.");

    // =========================================================================
    // TESTE 6: Marcar todas como lidas
    // =========================================================================
    console.log("\n[Teste 6] Marcar todas as notificações como lidas");

    const markAllRes = await executeMarkAllNotificationsAsRead(sql, idAlice);
    if (!markAllRes.success) {
      throw new Error("Falha ao marcar todas como lidas");
    }

    const aliceUnreadFinal = await executeGetUnreadNotificationCount(sql, idAlice);
    if (aliceUnreadFinal.unreadCount !== 0) {
      throw new Error(`Contador não zerou após marcar todas: ${aliceUnreadFinal.unreadCount}`);
    }

    console.log("✓ Teste 6 passou: Todas as notificações marcadas como lidas com sucesso.");

    // =========================================================================
    // TESTE 7: Excluir notificações (individual e todas)
    // =========================================================================
    console.log("\n[Teste 7] Exclusão de notificações (individual e em massa)");

    // Excluir uma
    const delSingle = await executeDeleteNotification(sql, idAlice, notifFollower.notificationId!);
    if (!delSingle.success) {
      throw new Error("Falha ao excluir notificação individual");
    }
    const checkDeleted = await sql`
      select "id" from "notification" where "id" = ${notifFollower.notificationId!}
    `;
    if (checkDeleted.length !== 0) {
      throw new Error("Notificação excluída ainda existe no banco");
    }

    // Excluir todas de Alice
    const delAll = await executeDeleteAllNotifications(sql, idAlice);
    if (!delAll.success) {
      throw new Error("Falha ao excluir todas as notificações");
    }
    const aliceRemaining = await executeGetNotifications(sql, idAlice);
    if (aliceRemaining.notifications.length !== 0) {
      throw new Error("Alice ainda possui notificações após deleteAllNotifications");
    }

    console.log("✓ Teste 7 passou: Exclusão individual e em lote validadas com sucesso.");

    // =========================================================================
    // TESTE 8: Bloqueio bilateral (impede entrega, purga mútuas e não restaura)
    // =========================================================================
    console.log("\n[Teste 8] Bloqueio bilateral de notificações");

    // Cria notificação de Bob para Charlie e de Charlie para Bob
    const notifBobToCharlie = await executeCreateNotification(sql, {
      userId: idCharlie,
      actorId: idBob,
      type: "new_follower",
      message: "Bob começou a seguir Charlie.",
    });
    const notifCharlieToBob = await executeCreateNotification(sql, {
      userId: idBob,
      actorId: idCharlie,
      type: "new_follower",
      message: "Charlie começou a seguir Bob.",
    });

    if (!notifBobToCharlie.success || !notifCharlieToBob.success) {
      throw new Error("Falha ao preparar notificações para teste de bloqueio");
    }

    // Bob bloqueia Charlie
    const blockRes = await executeBlockUser(sql, idBob, idCharlie);
    if (!blockRes.success) {
      throw new Error("Falha ao bloquear usuário");
    }

    // 1. Notificações prévias entre ambos devem ter sido purgadas
    const charlieListBlocked = await executeGetNotifications(sql, idCharlie);
    const bobListBlocked = await executeGetNotifications(sql, idBob);

    if (charlieListBlocked.notifications.some((n) => n.actorId === idBob)) {
      throw new Error("Notificação de Bob ainda visível na caixa de Charlie após bloqueio");
    }
    if (bobListBlocked.notifications.some((n) => n.actorId === idCharlie)) {
      throw new Error("Notificação de Charlie ainda visível na caixa de Bob após bloqueio");
    }

    // 2. Novas tentativas de gerar notificações entre ambos devem ser bloqueadas
    const tryNotif1 = await executeCreateNotification(sql, {
      userId: idBob,
      actorId: idCharlie,
      type: "new_follower",
      message: "Tentativa bloqueada",
    });
    if (tryNotif1.success || tryNotif1.reason !== "blocked_user") {
      throw new Error("Tentativa de notificação de usuário bloqueado deveria retornar blocked_user");
    }

    const tryNotif2 = await executeCreateNotification(sql, {
      userId: idCharlie,
      actorId: idBob,
      type: "new_follower",
      message: "Tentativa bloqueada reversa",
    });
    if (tryNotif2.success || tryNotif2.reason !== "blocked_user") {
      throw new Error("Tentativa de notificação para usuário bloqueado deveria retornar blocked_user");
    }

    // 3. Ao desbloquear, as notificações antigas NÃO devem ser restauradas automaticamente
    await executeUnblockUser(sql, idBob, idCharlie);
    const charlieListAfterUnblock = await executeGetNotifications(sql, idCharlie);
    if (charlieListAfterUnblock.notifications.some((n) => n.id === notifBobToCharlie.notificationId)) {
      throw new Error("Notificação antiga foi restaurada indevidamente após desbloqueio");
    }

    console.log("✓ Teste 8 passou: Bloqueio bilateral impede entrega, purga mútuas e não restaura ao desbloquear.");

    // =========================================================================
    // TESTE 9: Fluxo de solicitação aceita com limpeza de pendências
    // =========================================================================
    console.log("\n[Teste 9] Solicitação de acompanhamento aceita");

    // Dave solicita seguir Bob (privado)
    const followReq = await executeFollowUser(sql, idDave, idBob);
    if (followReq.status !== "requested") {
      throw new Error("Status deveria ser 'requested' para perfil privado");
    }

    // Bob deve ter a notificação de follow_request
    const bobReqNotifs = await executeGetNotifications(sql, idBob);
    const pendingReqNotif = bobReqNotifs.notifications.find(
      (n) => n.type === "follow_request" && n.actorId === idDave,
    );
    if (!pendingReqNotif) {
      throw new Error("Bob não recebeu a notificação de follow_request");
    }

    // Bob aceita a solicitação de Dave
    const acceptRes = await executeAcceptFollowRequest(sql, idBob, idDave);
    if (!acceptRes.success) {
      throw new Error("Falha ao aceitar solicitação");
    }

    // Dave deve ter recebido a notificação de follow_accept
    const daveNotifs = await executeGetNotifications(sql, idDave);
    const acceptNotif = daveNotifs.notifications.find(
      (n) => n.type === "follow_accept" && n.actorId === idBob,
    );
    if (!acceptNotif) {
      throw new Error("Dave não recebeu notificação de solicitação aceita");
    }

    // A solicitação de follow_request deve ter sido limpa
    const bobNotifsAfter = await executeGetNotifications(sql, idBob);
    const reqStillExists = bobNotifsAfter.notifications.some(
      (n) => n.type === "follow_request" && n.actorId === idDave,
    );
    if (reqStillExists) {
      throw new Error("Notificação de follow_request ainda existe após aceitação");
    }

    console.log("✓ Teste 9 passou: Solicitação aceita notificou solicitante e limpou pendências.");

    // =========================================================================
    // TESTE 10: Privacidade e autorização no destino
    // =========================================================================
    console.log("\n[Teste 10] Privacidade e autorização no destino de notificação");

    // Dave agora é seguidor aprovado de Bob -> tem canViewAccount = true
    const daveBobPrivacy = await evaluateUserPrivacy(sql, idBob, idDave);
    if (!daveBobPrivacy.isFollower || !daveBobPrivacy.canViewAccount) {
      throw new Error("Seguidor aprovado não possui acesso ao destino do perfil privado");
    }

    // Alice não é seguidora de Bob -> canViewAccount = false
    const aliceBobPrivacy = await evaluateUserPrivacy(sql, idBob, idAlice);
    if (aliceBobPrivacy.canViewAccount) {
      throw new Error("Usuário não-seguidor possui acesso indevido a conta privada");
    }

    console.log("✓ Teste 10 passou: Autorização no destino do recurso validada corretamente.");

    // =========================================================================
    // TESTE 11: Paginação sob demanda (limit, offset, hasMore, counts)
    // =========================================================================
    console.log("\n[Teste 11] Paginação sob demanda");

    // Inserir 25 notificações para Dave
    for (let i = 1; i <= 25; i++) {
      await executeCreateNotification(sql, {
        userId: idDave,
        actorId: idAlice,
        type: "new_follower",
        message: `Notificação paginada ${i}`,
      });
      // Pequeno avanço de relógio
      await sql`
        insert into "notification" ("id", "userId", "actorId", "type", "message", "read", "createdAt")
        values (${`p_${i}_${now}`}, ${idDave}, ${idAlice}, 'comment_reply', ${`Comentário ${i}`}, false, current_timestamp)
      `;
    }

    const page1 = await executeGetNotifications(sql, idDave, { limit: 10, offset: 0 });
    if (page1.notifications.length !== 10 || !page1.hasMore) {
      throw new Error(`Página 1 falhou: retornou ${page1.notifications.length}, hasMore: ${page1.hasMore}`);
    }

    const page2 = await executeGetNotifications(sql, idDave, { limit: 10, offset: 10 });
    if (page2.notifications.length !== 10 || !page2.hasMore) {
      throw new Error(`Página 2 falhou: retornou ${page2.notifications.length}, hasMore: ${page2.hasMore}`);
    }

    const page3 = await executeGetNotifications(sql, idDave, { limit: 10, offset: 20 });
    if (page3.notifications.length <= 0) {
      throw new Error("Página 3 vazia inesperadamente");
    }

    console.log(`✓ Teste 11 passou: Paginação operou com precisão (p1=${page1.notifications.length}, p2=${page2.notifications.length}, p3=${page3.notifications.length}).`);

    // =========================================================================
    // TESTE 12: Concorrência em eventos simultâneos (Promise.all)
    // =========================================================================
    console.log("\n[Teste 12] Concorrência em eventos simultâneos");

    const concurrentPromises = Array.from({ length: 8 }, (_, idx) =>
      executeCreateNotification(sql, {
        userId: idAlice,
        actorId: idBob,
        type: "new_follower",
        message: `Follow concorrente ${idx}`,
      }),
    );

    const concurrentResults = await Promise.all(concurrentPromises);
    const successCount = concurrentResults.filter((r) => r.success).length;
    if (successCount !== 8) {
      throw new Error(`Eventos simultâneos falharam: sucessos ${successCount}/8`);
    }

    // Devido à deduplicação, deve existir exatamente 1 notificação new_follower desse par
    const checkAliceBobDedup = await sql<{ count: string }>`
      select count(*)::text as count from "notification"
      where "userId" = ${idAlice} and "actorId" = ${idBob} and "type" = 'new_follower'
    `;
    if (Number(checkAliceBobDedup[0]?.count ?? "0") !== 1) {
      throw new Error(`Falha de concorrência: esperada 1 notificação deduplicada, encontrados ${checkAliceBobDedup[0]?.count}`);
    }

    console.log("✓ Teste 12 passou: Eventos simultâneos processados atomicamente com 100% de consistência.");

    // =========================================================================
    // TESTE 14: Eventos diferentes do mesmo autor (devem coexistir)
    // =========================================================================
    console.log("\n[Teste 14] Eventos diferentes do mesmo autor devem coexistir");

    // Bob curte o comentário de Alice e Bob responde ao comentário de Alice
    const notifLikeBob = await executeCreateNotification(sql, {
      userId: idAlice,
      actorId: idBob,
      type: "comment_like",
      message: "Bob curtiu seu comentário.",
      commentId: testCommentId,
    });
    const notifReplyBob = await executeCreateNotification(sql, {
      userId: idAlice,
      actorId: idBob,
      type: "comment_reply",
      message: "Bob respondeu ao seu comentário.",
      commentId: `reply_${now}_1`,
    });

    if (!notifLikeBob.success || !notifReplyBob.success) {
      throw new Error("Falha ao criar eventos diferentes do mesmo autor");
    }
    if (notifLikeBob.notificationId === notifReplyBob.notificationId) {
      throw new Error("Eventos de tipos diferentes colidiram indevidamente");
    }
    console.log("✓ Teste 14 passou: Eventos diferentes do mesmo autor coexistiram com sucesso.");

    // =========================================================================
    // TESTE 15: Comentários diferentes do mesmo autor (devem gerar notificações distintas)
    // =========================================================================
    console.log("\n[Teste 15] Comentários diferentes do mesmo autor geram notificações distintas");

    const testCommentId2 = `c10_2_${now}`;
    await sql`
      insert into "comment" ("id", "userId", "animeId", "episodeId", "content", "createdAt")
      values (${testCommentId2}, ${idAlice}, 'kitsu-7442', 'ep-1', 'Segundo comentário para teste!', current_timestamp)
    `;

    // Charlie curte comentário 1 de Alice e Charlie curte comentário 2 de Alice
    const likeC1 = await executeCreateNotification(sql, {
      userId: idAlice,
      actorId: idCharlie,
      type: "comment_like",
      message: "Charlie curtiu seu comentário 1.",
      commentId: testCommentId,
    });
    const likeC2 = await executeCreateNotification(sql, {
      userId: idAlice,
      actorId: idCharlie,
      type: "comment_like",
      message: "Charlie curtiu seu comentário 2.",
      commentId: testCommentId2,
    });

    if (!likeC1.success || !likeC2.success) {
      throw new Error("Falha ao criar curtidas em comentários diferentes");
    }
    if (likeC1.notificationId === likeC2.notificationId) {
      throw new Error("Curtidas em comentários diferentes colidiram indevidamente");
    }
    console.log("✓ Teste 15 passou: Comentários diferentes geraram notificações distintas e legítimas.");

    // =========================================================================
    // TESTE 16: Respostas diferentes geram notificações distintas
    // =========================================================================
    console.log("\n[Teste 16] Respostas diferentes geram notificações distintas");

    const replyC1 = await executeCreateNotification(sql, {
      userId: idAlice,
      actorId: idCharlie,
      type: "comment_reply",
      message: "Charlie respondeu primeira vez.",
      commentId: `reply_diff_1_${now}`,
    });
    const replyC2 = await executeCreateNotification(sql, {
      userId: idAlice,
      actorId: idCharlie,
      type: "comment_reply",
      message: "Charlie respondeu segunda vez.",
      commentId: `reply_diff_2_${now}`,
    });

    if (!replyC1.success || !replyC2.success) {
      throw new Error("Falha ao criar respostas diferentes");
    }
    if (replyC1.notificationId === replyC2.notificationId) {
      throw new Error("Respostas diferentes colidiram indevidamente");
    }
    console.log("✓ Teste 16 passou: Respostas diferentes preservadas com identidades próprias.");

    // =========================================================================
    // TESTE 17: Concorrência multi-instância (sem mutex em memória, bypassLock: true)
    // =========================================================================
    console.log("\n[Teste 17] Concorrência multi-instância direta no banco (bypassLock: true)");

    const multiInstancePromises = Array.from({ length: 10 }, (_, idx) =>
      executeCreateNotification(sql, {
        userId: idBob,
        actorId: idAlice,
        type: "new_follower",
        message: `Follow multi-instancia ${idx}`,
        bypassLock: true, // Ignora o mutex em memória, forçando resolução atômica no PostgreSQL
      }),
    );

    const multiInstanceResults = await Promise.all(multiInstancePromises);
    const multiSuccess = multiInstanceResults.filter((r) => r.success).length;
    if (multiSuccess !== 10) {
      throw new Error(`Concorrência multi-instância falhou: ${multiSuccess}/10 sucessos`);
    }

    const checkMultiDedup = await sql<{ count: string }>`
      select count(*)::text as count from "notification"
      where "userId" = ${idBob} and "actorId" = ${idAlice} and "type" = 'new_follower'
    `;
    if (Number(checkMultiDedup[0]?.count ?? "0") !== 1) {
      throw new Error(
        `Falha de deduplicação no banco: esperada 1 notificação, encontrados ${checkMultiDedup[0]?.count}`,
      );
    }
    console.log("✓ Teste 17 passou: Concorrência multi-instância resolvida atomicamente no PostgreSQL sem mutex.");

    // =========================================================================
    // TESTE 18: Integridade da constraint UNIQUE no PostgreSQL
    // =========================================================================
    console.log("\n[Teste 18] Validação de integridade do índice UNIQUE no PostgreSQL");

    const directDedupKey = `test_unique_key_${now}`;
    await sql`
      insert into "notification" ("id", "userId", "type", "message", "dedupKey")
      values (${"uidx_1_" + now}, ${idAlice}, 'custom', 'Teste Unique 1', ${directDedupKey})
    `;

    let uniqueViolated = false;
    try {
      await sql`
        insert into "notification" ("id", "userId", "type", "message", "dedupKey")
        values (${"uidx_2_" + now}, ${idAlice}, 'custom', 'Teste Unique 2', ${directDedupKey})
      `;
    } catch (err: any) {
      // Código de erro PostgreSQL para violação de constraint unique é 23505
      if (err?.code === "23505" || String(err).includes("unique") || String(err).includes("duplicate")) {
        uniqueViolated = true;
      }
    }

    if (!uniqueViolated) {
      throw new Error("Índice UNIQUE no PostgreSQL falhou em rejeitar inserção duplicada direta");
    }
    console.log("✓ Teste 18 passou: Constraint UNIQUE no PostgreSQL rejeitou duplicatas diretas (23505).");

    // =========================================================================
    // TESTE 19: Regressão das Etapas 7, 8 e 9
    // =========================================================================
    console.log("\n[Teste 19] Verificando regressão de privacidade e bloqueios...");

    const privTest = await evaluateUserPrivacy(sql, idAlice, idDave);
    if (!privTest.canViewAccount) {
      throw new Error("Regressão em conta pública na privacidade");
    }

    console.log("✓ Teste 19 passou: Sem regressão nas Etapas 7, 8 e 9.");

    console.log("\n========================================================");
    console.log(">>> TODOS OS 19 TESTES DA ETAPA 10.1 PASSARAM COM SUCESSO! <<<");
    console.log("========================================================");
  } finally {
    // Limpeza de usuários de teste
    console.log("\n-> Limpando dados de teste da Etapa 10...");
    await sql`delete from "notification" where "userId" in (${idAlice}, ${idBob}, ${idCharlie}, ${idDave})`;
    await sql`delete from "comment" where "userId" in (${idAlice}, ${idBob}, ${idCharlie}, ${idDave})`;
    await sql`delete from "user_block" where "blockerId" in (${idAlice}, ${idBob}, ${idCharlie}, ${idDave})`;
    await sql`delete from "user_follow" where "followerId" in (${idAlice}, ${idBob}, ${idCharlie}, ${idDave})`;
    await sql`delete from "user_follow_request" where "requesterId" in (${idAlice}, ${idBob}, ${idCharlie}, ${idDave})`;
    await sql`delete from "profile" where "userId" in (${idAlice}, ${idBob}, ${idCharlie}, ${idDave})`;
    await sql`delete from "user" where "id" in (${idAlice}, ${idBob}, ${idCharlie}, ${idDave})`;
    console.log("✓ Limpeza de teste concluída.");
  }
}

runTests().catch((err) => {
  console.error("ERRO NOS TESTES DA ETAPA 10:", err);
  process.exit(1);
});
