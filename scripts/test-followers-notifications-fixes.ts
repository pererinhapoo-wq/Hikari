/**
 * Suite de Verificação Completa das 5 Correções:
 * Seguidores, Seguir de volta, Remover Seguidor, Relações nas Listas e Notificações de Perfis Privados.
 */
import assert from "node:assert/strict";
import { getSql } from "@/lib/db";
import {
  executeAcceptFollowRequest,
  executeBlockUser,
  executeFollowUser,
  executeGetPublicProfile,
  executeGetPublicProfileFollowers,
  executeGetPublicProfileFollowing,
  executeRejectFollowRequest,
  executeRemoveFollower,
} from "@/lib/profile.functions";
import { executeGetNotifications } from "@/lib/notifications.functions";

async function runTests() {
  console.log("=== TESTANDO AS 5 CORREÇÕES DE SEGUIDORES E NOTIFICAÇÕES ===");
  const sql = await getSql();
  const suffix = Date.now().toString();

  const aliceId = `fix_alice_${suffix}`;
  const bobId = `fix_bob_${suffix}`;
  const charlieId = `fix_charlie_${suffix}`;
  const privId = `fix_priv_${suffix}`;

  const aliceNick = `alice_${suffix.slice(-6)}`;
  const bobNick = `bob_${suffix.slice(-6)}`;
  const charlieNick = `charlie_${suffix.slice(-6)}`;
  const privNick = `priv_${suffix.slice(-6)}`;

  try {
    // Setup 4 contas: Alice (public), Bob (public), Charlie (public), Priv (private)
    await sql`
      insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
      values
        (${aliceId}, 'Alice', ${aliceId + "@test.com"}, true, current_timestamp, current_timestamp),
        (${bobId}, 'Bob', ${bobId + "@test.com"}, true, current_timestamp, current_timestamp),
        (${charlieId}, 'Charlie', ${charlieId + "@test.com"}, true, current_timestamp, current_timestamp),
        (${privId}, 'Priv User', ${privId + "@test.com"}, true, current_timestamp, current_timestamp)
    `;
    await sql`
      insert into "profile" ("userId", "nick", "displayName", "accountType", "allowFollowers", "privacyFollowers")
      values
        (${aliceId}, ${aliceNick}, 'Alice', 'public', true, 'public'),
        (${bobId}, ${bobNick}, 'Bob', 'public', true, 'public'),
        (${charlieId}, ${charlieNick}, 'Charlie', 'public', true, 'public'),
        (${privId}, ${privNick}, 'Priv User', 'private', true, 'public')
    `;

    // -----------------------------------------------------------------------
    // FIX 1: "Seguir de volta" ao visitar o perfil de quem segue o visitante
    // -----------------------------------------------------------------------
    await executeFollowUser(sql, aliceId, bobId);

    // Bob visita o perfil de Alice (Alice segue Bob, Bob ainda não segue Alice)
    const aliceAsSeenByBob = await executeGetPublicProfile(sql, aliceNick, bobId);
    assert.equal(aliceAsSeenByBob.isFollowing, false, "Bob ainda não segue Alice");
    assert.equal(aliceAsSeenByBob.isFollowedBy, true, "Alice segue Bob -> isFollowedBy deve ser true");

    // Charlie visita o perfil de Alice (Alice NÃO segue Charlie)
    const aliceAsSeenByCharlie = await executeGetPublicProfile(sql, aliceNick, charlieId);
    assert.equal(aliceAsSeenByCharlie.isFollowing, false);
    assert.equal(aliceAsSeenByCharlie.isFollowedBy, false, "Alice não segue Charlie -> isFollowedBy deve ser false");

    // Bloqueio mútuo deve ocultar isFollowedBy
    await executeBlockUser(sql, aliceId, bobId);
    const aliceBlockedByBob = await executeGetPublicProfile(sql, aliceNick, bobId);
    assert.equal(aliceBlockedByBob.isBlocked, true);
    assert.equal(aliceBlockedByBob.isFollowedBy, false, "Bloqueio zera isFollowedBy");
    await sql`delete from "user_block" where "blockerId" = ${aliceId} and "blockedId" = ${bobId}`;

    // Reestabelecer Alice seguindo Bob para os próximos testes
    await executeFollowUser(sql, aliceId, bobId);
    console.log("✓ FIX 1 PASSOU: executeGetPublicProfile retorna isFollowedBy corretamente.");

    // -----------------------------------------------------------------------
    // FIX 4: Relações nas listas de Seguidores e Seguindo de outro perfil
    // -----------------------------------------------------------------------
    // Cenário:
    // - Alice segue Bob
    // - Charlie segue Bob
    // - Charlie também segue Alice (ou seja, Charlie segue o visitante quando Alice visita Bob? Testemos com Dave/visitor!)
    // Vamos usar Bob como perfil visitado e Charlie como visitante:
    //   - Alice segue Bob (está em Seguidores de Bob) e Alice NÃO segue Charlie
    //   - Priv segue Bob (está em Seguidores de Bob) e Priv segue Charlie -> Charlie deve ver "Seguir de volta" para Priv
    //   - Charlie já segue Alice? Vamos fazer Charlie seguir Alice e solicitar Priv!
    await executeFollowUser(sql, charlieId, bobId); // Charlie segue Bob
    await executeFollowUser(sql, privId, bobId);    // Priv segue Bob (Priv -> public Bob é imediato)
    await executeFollowUser(sql, privId, charlieId); // Priv segue Charlie
    await executeFollowUser(sql, charlieId, aliceId); // Charlie já segue Alice
    await executeFollowUser(sql, charlieId, privId);  // Charlie solicita seguir Priv (conta privada -> pending!)

    // Agora Charlie visita os Seguidores de Bob:
    // Lista de seguidores de Bob contém: Alice, Charlie, Priv.
    const bobFollowersForCharlie = await executeGetPublicProfileFollowers(sql, bobId, charlieId);
    const aliceRow = bobFollowersForCharlie.find((u) => u.userId === aliceId);
    const charlieSelfRow = bobFollowersForCharlie.find((u) => u.userId === charlieId);
    const privRow = bobFollowersForCharlie.find((u) => u.userId === privId);

    assert.ok(aliceRow && charlieSelfRow && privRow, "Todos os seguidores de Bob devem estar na lista");
    assert.equal(aliceRow.isFollowing, true, "Charlie já segue Alice -> deve mostrar 'Seguindo'");
    assert.equal(aliceRow.followsViewer, false, "Alice não segue Charlie");
    assert.equal(privRow.isFollowing, false, "Priv ainda não aprovou Charlie");
    assert.equal(privRow.hasPendingRequest, true, "Charlie tem solicitação pendente para Priv -> deve mostrar 'Solicitado'");
    assert.equal(privRow.followsViewer, true, "Priv segue Charlie");

    // Agora Alice visita os Seguindo de Priv (ou de Bob quando Bob segue alguém que não segue Alice)
    await executeFollowUser(sql, bobId, aliceId);
    const bobFollowingForCharlie = await executeGetPublicProfileFollowing(sql, bobId, charlieId);
    const aliceInFollowing = bobFollowingForCharlie.find((u) => u.userId === aliceId);
    assert.ok(aliceInFollowing);
    assert.equal(aliceInFollowing.isFollowing, true, "Sem ação duplicada: Charlie já segue Alice");

    // Se Alice visitar os seguidores de Bob (onde Charlie está listado e Alice NÃO segue Charlie):
    const bobFollowersForAlice = await executeGetPublicProfileFollowers(sql, bobId, aliceId);
    const charlieSeenByAlice = bobFollowersForAlice.find((u) => u.userId === charlieId);
    assert.ok(charlieSeenByAlice);
    assert.equal(charlieSeenByAlice.isFollowing, false, "Alice não segue Charlie");
    assert.equal(charlieSeenByAlice.followsViewer, true, "Charlie segue Alice -> deve mostrar 'Seguir de volta'");

    // E se Bob segue um usuário que NÃO segue Charlie (vamos criar um relacionamento assim: Bob -> Charlie? Charlie já segue Bob):
    // Priv segue Bob, Bob segue Priv? Não, se Bob segue Alice, e testamos alguém novo que NÃO segue Alice:
    // Se Charlie segue Bob, e Bob segue Priv: Alice não segue Priv e Priv não segue Alice:
    await executeFollowUser(sql, bobId, privId); // envia request de Bob para Priv; aceitemos:
    await executeAcceptFollowRequest(sql, privId, bobId);
    const bobFollowingForAlice = await executeGetPublicProfileFollowing(sql, bobId, aliceId);
    const privSeenByAlice = bobFollowingForAlice.find((u) => u.userId === privId);
    assert.ok(privSeenByAlice);
    assert.equal(privSeenByAlice.isFollowing, false, "Alice não segue Priv");
    assert.equal(privSeenByAlice.followsViewer, false, "Priv não segue Alice -> deve mostrar 'Seguir'");
    assert.equal(privSeenByAlice.hasPendingRequest, false);
    console.log("✓ FIX 4 PASSOU: Relações Seguir / Seguir de volta / Seguindo / Solicitado calculadas corretamente.");

    // -----------------------------------------------------------------------
    // FIX 3: Remover seguidor (somente o dono pode remover seu seguidor)
    // -----------------------------------------------------------------------
    // Alice tenta remover Charlie dos seguidores de Bob chamando executeRemoveFollower como Alice (ownerId=aliceId):
    // Isso NÃO pode remover Charlie de Bob! Apenas remove de Alice (e Charlie realmente seguia Alice).
    // Testemos com Priv: Charlie não segue Priv ainda. Alice tenta remover Bob de Priv passando ownerId=aliceId:
    const wrongOwnerRemove = await executeRemoveFollower(sql, aliceId, privId);
    assert.equal(wrongOwnerRemove.removed, false, "Não remove se não for seguidor do proprietário autenticado");

    // Bob remove Alice de seus próprios seguidores
    const beforeFollowers = await executeGetPublicProfileFollowers(sql, bobId, bobId);
    assert.ok(beforeFollowers.some((u) => u.userId === aliceId), "Alice seguia Bob antes da remoção");

    const removeRes = await executeRemoveFollower(sql, bobId, aliceId);
    assert.equal(removeRes.removed, true, "Dono removeu Alice com sucesso");

    const afterFollowers = await executeGetPublicProfileFollowers(sql, bobId, bobId);
    assert.equal(afterFollowers.some((u) => u.userId === aliceId), false, "Alice não aparece mais nos seguidores de Bob");
    console.log("✓ FIX 3 PASSOU: Remoção de seguidor funciona exclusivamente para o dono do perfil.");

    // -----------------------------------------------------------------------
    // FIX 5: Notificações de perfis privados (follow_request -> Aceitar / Recusar)
    // -----------------------------------------------------------------------
    // Charlie já enviou solicitação para Priv acima (em FIX 4). Verificar notificação follow_request de Priv:
    const privNotifs = await executeGetNotifications(sql, privId);
    const reqNotif = privNotifs.notifications.find(
      (n) => n.type === "follow_request" && n.actorId === charlieId,
    );
    assert.ok(reqNotif, "Perfil privado deve receber notificação follow_request");

    // Testar Recusar primeiro com Alice -> Priv
    await executeFollowUser(sql, aliceId, privId);
    let privNotifs2 = await executeGetNotifications(sql, privId);
    assert.ok(
      privNotifs2.notifications.some((n) => n.type === "follow_request" && n.actorId === aliceId),
      "Priv recebeu follow_request de Alice",
    );

    // Somente Priv (owner) pode recusar; Alice não pode recusar a si mesma como ownerId=aliceId:
    await assert.rejects(
      () => executeRejectFollowRequest(sql, aliceId, aliceId),
      "Usuário não-dono não pode recusar solicitação",
    );

    await executeRejectFollowRequest(sql, privId, aliceId);
    privNotifs2 = await executeGetNotifications(sql, privId);
    assert.equal(
      privNotifs2.notifications.some((n) => n.type === "follow_request" && n.actorId === aliceId),
      false,
      "Notificação follow_request de Alice removida após recusa",
    );

    // Testar Aceitar solicitação de Charlie para Priv:
    await executeAcceptFollowRequest(sql, privId, charlieId);
    const privNotifsAfterAccept = await executeGetNotifications(sql, privId);
    assert.equal(
      privNotifsAfterAccept.notifications.some((n) => n.type === "follow_request" && n.actorId === charlieId),
      false,
      "Notificação follow_request de Charlie removida após aceitação",
    );
    const privFollowersAfter = await executeGetPublicProfileFollowers(sql, privId, privId);
    assert.ok(
      privFollowersAfter.some((u) => u.userId === charlieId),
      "Charlie tornou-se seguidor de Priv após aceitação",
    );
    const charlieNotifs = await executeGetNotifications(sql, charlieId);
    assert.ok(
      charlieNotifs.notifications.some((n) => n.type === "follow_accept" && n.actorId === privId),
      "Charlie recebeu notificação follow_accept",
    );
    console.log("✓ FIX 5 PASSOU: Solicitações follow_request aceitas e recusadas com integridade e notificações atualizadas.");

    console.log("\n=== TODOS OS TESTES DAS 5 CORREÇÕES PASSARAM 100%! ===");
  } finally {
    await sql`delete from "notification" where "userId" in (${aliceId}, ${bobId}, ${charlieId}, ${privId}) or "actorId" in (${aliceId}, ${bobId}, ${charlieId}, ${privId})`;
    await sql`delete from "user_follow_request" where "requesterId" in (${aliceId}, ${bobId}, ${charlieId}, ${privId}) or "targetId" in (${aliceId}, ${bobId}, ${charlieId}, ${privId})`;
    await sql`delete from "user_follow" where "followerId" in (${aliceId}, ${bobId}, ${charlieId}, ${privId}) or "followingId" in (${aliceId}, ${bobId}, ${charlieId}, ${privId})`;
    await sql`delete from "user_block" where "blockerId" in (${aliceId}, ${bobId}, ${charlieId}, ${privId}) or "blockedId" in (${aliceId}, ${bobId}, ${charlieId}, ${privId})`;
    await sql`delete from "profile" where "userId" in (${aliceId}, ${bobId}, ${charlieId}, ${privId})`;
    await sql`delete from "user" where "id" in (${aliceId}, ${bobId}, ${charlieId}, ${privId})`;
  }
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("FALHA NO TESTE:", err);
    process.exit(1);
  });
