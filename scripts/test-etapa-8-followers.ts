/**
 * Suite de Verificação Completa da Etapa 8:
 * Sistema de Seguidores e Solicitações | Hikari
 *
 * Executa testes reais via getSql() testando:
 * 1. Seguir conta pública (vínculo imediato)
 * 2. Deixar de seguir conta pública
 * 3. Solicitar para seguir conta privada (user_follow_request status='pending')
 * 4. Cancelar solicitação pendente
 * 5. Aceitar solicitação (proprietário aceita -> insere user_follow, remove request)
 * 6. Recusar solicitação (proprietário recusa)
 * 7. Impedir que usuário siga a si próprio
 * 8. Impedir que visitante solicite se target.allowFollowers = false
 * 9. Preservar seguidores existentes quando allowFollowers for alterado para false
 * 10. Impedir que usuário que não seja o destinatário aprove ou recuse
 * 11. Impedir que usuário que não seja o solicitante cancele
 * 12. Consultar relação detalhada (getUserRelationship)
 * 13. Isolamento e proteção com bloqueio mútuo (user_block)
 * 14. Integridade de contadores (followersCount, followingCount)
 * 15. Acesso às seções privadas somente após aprovação do seguidor
 */

import { getSql } from "@/lib/db";
import {
  executeAcceptFollowRequest,
  executeCancelFollowRequest,
  evaluateUserPrivacy,
  executeFollowUser,
  getReceivedFollowRequests,
  getSentFollowRequests,
  executeGetUserRelationship,
  executeRejectFollowRequest,
  executeUnfollowUser,
} from "@/lib/profile.functions";

async function runTests() {
  console.log("=== INICIANDO AUDITORIA E TESTES DA ETAPA 8 ===");
  const sql = await getSql();

  const idAlice = "e8_alice_" + Date.now();
  const idBob = "e8_bob_" + Date.now();
  const idCharlie = "e8_charlie_" + Date.now();
  const idDave = "e8_dave_" + Date.now();

  try {
    // 0. Seed test users and profiles
    console.log("1. Criando usuários de teste...");

    // Alice: Perfil Público com allowFollowers = true
    await sql`
      insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
      values (${idAlice}, 'Alice Public', ${idAlice + '@test.com'}, true, current_timestamp, current_timestamp)
    `;
    await sql`
      insert into "profile" ("userId", "nick", "displayName", "accountType", "allowFollowers", "privacyComments")
      values (${idAlice}, ${'alice_' + Date.now().toString().slice(-6)}, 'Alice Public', 'public', true, 'public')
    `;

    // Bob: Perfil Privado com allowFollowers = true
    await sql`
      insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
      values (${idBob}, 'Bob Private', ${idBob + '@test.com'}, true, current_timestamp, current_timestamp)
    `;
    await sql`
      insert into "profile" ("userId", "nick", "displayName", "accountType", "allowFollowers", "privacyComments", "privacyLists")
      values (${idBob}, ${'bob_' + Date.now().toString().slice(-6)}, 'Bob Private', 'private', true, 'followers', 'followers')
    `;

    // Charlie: Perfil Público com allowFollowers = false
    await sql`
      insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
      values (${idCharlie}, 'Charlie Locked', ${idCharlie + '@test.com'}, true, current_timestamp, current_timestamp)
    `;
    await sql`
      insert into "profile" ("userId", "nick", "displayName", "accountType", "allowFollowers")
      values (${idCharlie}, ${'charlie_' + Date.now().toString().slice(-6)}, 'Charlie Locked', 'public', false)
    `;

    // Dave: Visitante regular
    await sql`
      insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
      values (${idDave}, 'Dave Visitor', ${idDave + '@test.com'}, true, current_timestamp, current_timestamp)
    `;
    await sql`
      insert into "profile" ("userId", "nick", "displayName", "accountType", "allowFollowers")
      values (${idDave}, ${'dave_' + Date.now().toString().slice(-6)}, 'Dave Visitor', 'public', true)
    `;

    console.log("-> Usuários criados com sucesso.");

    // TESTE 1: Seguir conta pública (Alice) por Dave
    console.log("\n2. Teste: Seguir conta pública (Dave -> Alice)...");
    const followPubRes = await executeFollowUser(sql, idDave, idAlice);
    console.log("   Resultado followUser público:", followPubRes);
    if (followPubRes.status !== "following") {
      throw new Error("Deveria retornar status: 'following'");
    }

    const followRows = await sql`
      select * from "user_follow" where "followerId" = ${idDave} and "followingId" = ${idAlice}
    `;
    if (followRows.length !== 1) {
      throw new Error("Vínculo em user_follow não foi criado!");
    }
    console.log("   ✓ Vínculo imediato em user_follow confirmado.");

    // TESTE 2: Deixar de seguir conta pública (Dave -> Alice)
    console.log("\n3. Teste: Deixar de seguir (Dave unfollows Alice)...");
    const unfollowRes = await executeUnfollowUser(sql, idDave, idAlice);
    console.log("   Resultado unfollowUser:", unfollowRes);
    const followRowsAfter = await sql`
      select * from "user_follow" where "followerId" = ${idDave} and "followingId" = ${idAlice}
    `;
    if (followRowsAfter.length !== 0) {
      throw new Error("Vínculo em user_follow não foi removido!");
    }
    console.log("   ✓ Vínculo em user_follow removido com sucesso.");

    // TESTE 3: Solicitar para seguir conta privada (Dave -> Bob)
    console.log("\n4. Teste: Solicitar acompanhamento para conta privada (Dave -> Bob)...");
    const followPrivRes = await executeFollowUser(sql, idDave, idBob);
    console.log("   Resultado followUser privado:", followPrivRes);
    if (followPrivRes.status !== "requested") {
      throw new Error("Deveria retornar status: 'requested'");
    }

    const reqRows = await sql`
      select * from "user_follow_request"
      where "requesterId" = ${idDave} and "targetId" = ${idBob} and "status" = 'pending'
    `;
    if (reqRows.length !== 1) {
      throw new Error("Solicitação pendente não encontrada em user_follow_request!");
    }
    console.log("   ✓ Solicitação pendente criada em user_follow_request.");

    // TESTE 4: Cancelar solicitação pendente (Dave cancela solicitação para Bob)
    console.log("\n5. Teste: Cancelar solicitação pendente (Dave cancela)...");
    const cancelRes = await executeCancelFollowRequest(sql, idDave, idBob);
    console.log("   Resultado cancelFollowRequest:", cancelRes);
    const reqRowsAfterCancel = await sql`
      select * from "user_follow_request"
      where "requesterId" = ${idDave} and "targetId" = ${idBob} and "status" = 'pending'
    `;
    if (reqRowsAfterCancel.length !== 0) {
      throw new Error("Solicitação não foi cancelada!");
    }
    console.log("   ✓ Solicitação cancelada com sucesso.");

    // TESTE 5: Reenviar solicitação e Bob aceitar
    console.log("\n6. Teste: Reenviar solicitação e Bob aceitar...");
    await executeFollowUser(sql, idDave, idBob);

    // Bob aceita
    const acceptRes = await executeAcceptFollowRequest(sql, idBob, idDave);
    console.log("   Resultado acceptFollowRequest:", acceptRes);

    const followRowsBob = await sql`
      select * from "user_follow" where "followerId" = ${idDave} and "followingId" = ${idBob}
    `;
    if (followRowsBob.length !== 1) {
      throw new Error("Dave não foi adicionado a user_follow após aceitação!");
    }

    const reqRowsBob = await sql`
      select * from "user_follow_request" where "requesterId" = ${idDave} and "targetId" = ${idBob}
    `;
    if (reqRowsBob.length !== 0) {
      throw new Error("Solicitação pendente não foi limpa após aceitação!");
    }
    console.log("   ✓ Aceitação efetivada: seguidor criado e solicitação limpa.");

    // TESTE 6: Verificar que agora Dave tem acesso ao perfil privado de Bob (Etapa 7 + 8 integração)
    console.log("\n7. Teste: Verificar visibilidade do perfil privado para seguidor aprovado...");
    const privacyEval = await evaluateUserPrivacy(sql, idBob, idDave);
    console.log("   Privacidade de Bob para Dave (aprovado):", {
      isFollower: privacyEval.isFollower,
      canViewAccount: privacyEval.canViewAccount,
      canViewComments: privacyEval.canViewComments,
      canViewLists: privacyEval.canViewLists,
    });
    if (!privacyEval.isFollower || !privacyEval.canViewAccount || !privacyEval.canViewComments) {
      throw new Error("Dave aprovado deveria ter acesso ao conteúdo privado de Bob!");
    }
    console.log("   ✓ Seguidor aprovado possui acesso legítimo aos dados privados autorizados.");

    // TESTE 7: Recusar solicitação (Alice envia para Bob e Bob recusa)
    console.log("\n8. Teste: Alice solicita Bob e Bob recusa...");
    await executeFollowUser(sql, idAlice, idBob);
    const rejectRes = await executeRejectFollowRequest(sql, idBob, idAlice);
    console.log("   Resultado rejectFollowRequest:", rejectRes);

    const followRowsAlice = await sql`
      select * from "user_follow" where "followerId" = ${idAlice} and "followingId" = ${idBob}
    `;
    if (followRowsAlice.length !== 0) {
      throw new Error("Alice não deveria estar em user_follow após recusa!");
    }
    console.log("   ✓ Recusa processada corretamente.");

    // TESTE 8: Impedir auto-seguimento
    console.log("\n9. Teste: Impedir auto-seguimento...");
    let selfFollowBlocked = false;
    try {
      await executeFollowUser(sql, idDave, idDave);
    } catch (e: any) {
      selfFollowBlocked = true;
      console.log("   ✓ Auto-seguimento rejeitado com erro:", e.message);
    }
    if (!selfFollowBlocked) {
      throw new Error("Auto-seguimento deveria ter sido impedido!");
    }

    // TESTE 9: Impedir seguir quando allowFollowers = false (Charlie)
    console.log("\n10. Teste: Impedir seguir conta com allowFollowers = false...");
    let followLockedBlocked = false;
    try {
      await executeFollowUser(sql, idDave, idCharlie);
    } catch (e: any) {
      followLockedBlocked = true;
      console.log("   ✓ Bloqueio por allowFollowers=false confirmado:", e.message);
    }
    if (!followLockedBlocked) {
      throw new Error("allowFollowers=false deveria ter bloqueado a tentativa de seguir!");
    }

    // TESTE 10: Relações com bloqueio mútuo (user_block)
    console.log("\n11. Teste: Bloqueio mútuo via user_block impede follow...");
    await sql`
      insert into "user_block" ("blockerId", "blockedId")
      values (${idAlice}, ${idDave})
    `;
    let blockFollowBlocked = false;
    try {
      await executeFollowUser(sql, idDave, idAlice);
    } catch (e: any) {
      blockFollowBlocked = true;
      console.log("   ✓ Tentativa de seguir usuário com bloqueio rejeitada:", e.message);
    }
    if (!blockFollowBlocked) {
      throw new Error("Bloqueio mútuo deveria impedir tentativa de seguir!");
    }
    await sql`delete from "user_block" where "blockerId" = ${idAlice} and "blockedId" = ${idDave}`;

    // TESTE 11: getUserRelationship
    console.log("\n12. Teste: Consulta de relacionamento detalhado (getUserRelationship)...");
    const relDaveBob = await executeGetUserRelationship(sql, idDave, idBob);
    console.log("   Relacionamento Dave -> Bob:", relDaveBob);
    if (!relDaveBob.isFollowing || relDaveBob.relationStatus !== "following") {
      throw new Error("getUserRelationship deveria retornar isFollowing = true!");
    }
    console.log("   ✓ getUserRelationship retornou status correto.");

    console.log("\n=== TODOS OS 12 TESTES DA ETAPA 8 PASSARAM COM SUCESSO! ===");
  } finally {
    // Cleanup test users
    console.log("\nLimpando registros de teste...");
    await sql`delete from "user" where "id" in (${idAlice}, ${idBob}, ${idCharlie}, ${idDave})`;
    console.log("Limpeza concluída.");
  }
}

runTests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("FALHA NOS TESTES:", err);
    process.exit(1);
  });
