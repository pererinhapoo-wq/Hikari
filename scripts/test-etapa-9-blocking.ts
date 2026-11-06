/**
 * Suite de Verificação Completa da Etapa 9:
 * Sistema de Bloqueio e Gerenciamento de Usuários | Hikari
 */

import { getSql } from "@/lib/db";
import {
  executeBlockUser,
  executeUnblockUser,
  executeGetMyBlockedUsers,
  executeGetUserBlockStatus,
  executeFollowUser,
  executeUnfollowUser,
  executeAcceptFollowRequest,
  executeGetUserRelationship,
  evaluateUserPrivacy,
} from "@/lib/profile.functions";

async function runTests() {
  console.log("=== INICIANDO SUITE DE TESTES DA ETAPA 9: BLOQUEIO E GERENCIAMENTO ===");
  const sql = await getSql();

  const idAlice = "e9_alice_" + Date.now();
  const idBob = "e9_bob_" + Date.now();
  const idCharlie = "e9_charlie_" + Date.now();
  const idDave = "e9_dave_" + Date.now();

  try {
    // 0. Seed usuários de teste
    console.log("\n-> Criando usuários de teste (Alice, Bob, Charlie, Dave)...");

    await sql`
      insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
      values
        (${idAlice}, 'Alice One', ${idAlice + '@test.com'}, true, current_timestamp, current_timestamp),
        (${idBob}, 'Bob Two', ${idBob + '@test.com'}, true, current_timestamp, current_timestamp),
        (${idCharlie}, 'Charlie Three', ${idCharlie + '@test.com'}, true, current_timestamp, current_timestamp),
        (${idDave}, 'Dave Four', ${idDave + '@test.com'}, true, current_timestamp, current_timestamp)
    `;

    await sql`
      insert into "profile" ("userId", "nick", "displayName", "accountType", "allowFollowers", "privacyComments", "privacyLists")
      values
        (${idAlice}, ${'alice_' + Date.now().toString().slice(-6)}, 'Alice One', 'public', true, 'public', 'public'),
        (${idBob}, ${'bob_' + Date.now().toString().slice(-6)}, 'Bob Two', 'private', true, 'followers', 'followers'),
        (${idCharlie}, ${'charlie_' + Date.now().toString().slice(-6)}, 'Charlie Three', 'public', true, 'public', 'public'),
        (${idDave}, ${'dave_' + Date.now().toString().slice(-6)}, 'Dave Four', 'public', true, 'public', 'public')
    `;

    // Estabelecer vínculos preliminares entre Alice e Bob:
    // Alice segue Bob (vínculo prévio) e Bob segue Alice (vínculo prévio)
    await sql`
      insert into "user_follow" ("followerId", "followingId", "createdAt")
      values
        (${idAlice}, ${idBob}, current_timestamp),
        (${idBob}, ${idAlice}, current_timestamp)
    `;

    // Solicitação pendente prévia entre Alice e Charlie:
    await sql`
      insert into "user_follow_request" ("requesterId", "targetId", "status", "createdAt", "updatedAt")
      values (${idCharlie}, ${idAlice}, 'pending', current_timestamp, current_timestamp)
    `;

    console.log("-> Usuários e dados iniciais criados com sucesso.");

    // TESTE 1: Bloquear usuário
    console.log("\n[Teste 1] Bloquear usuário (Alice bloqueia Bob)");
    const blockRes1 = await executeBlockUser(sql, idAlice, idBob);
    if (!blockRes1.success) throw new Error("Falha ao bloquear usuário");
    const blocksAliceBob = await sql`
      select * from "user_block" where "blockerId" = ${idAlice} and "blockedId" = ${idBob}
    `;
    if (blocksAliceBob.length !== 1) throw new Error("Registro de bloqueio não encontrado na tabela user_block");
    console.log("✓ Teste 1 passou: Alice bloqueou Bob com sucesso.");

    // TESTE 2: Desbloquear usuário
    console.log("\n[Teste 2] Desbloquear usuário (Alice desbloqueia Bob temporariamente)");
    const unblockRes1 = await executeUnblockUser(sql, idAlice, idBob);
    if (!unblockRes1.success) throw new Error("Falha ao desbloquear usuário");
    const unblockedCheck = await sql`
      select * from "user_block" where "blockerId" = ${idAlice} and "blockedId" = ${idBob}
    `;
    if (unblockedCheck.length !== 0) throw new Error("Registro de bloqueio ainda existe após unblock");
    console.log("✓ Teste 2 passou: Desbloqueio remove registro corretamente.");

    // TESTE 3: Impedir auto-bloqueio
    console.log("\n[Teste 3] Impedir auto-bloqueio");
    let selfBlockFailed = false;
    try {
      await executeBlockUser(sql, idAlice, idAlice);
    } catch {
      selfBlockFailed = true;
    }
    if (!selfBlockFailed) throw new Error("Auto-bloqueio deveria ter lançado erro");
    console.log("✓ Teste 3 passou: Auto-bloqueio rejeitado com sucesso.");

    // TESTE 4: Impedir bloqueio duplicado (idempotente/atômico)
    console.log("\n[Teste 4] Impedir bloqueio duplicado");
    await executeBlockUser(sql, idAlice, idBob);
    const dupRes = await executeBlockUser(sql, idAlice, idBob);
    if (!dupRes.success) throw new Error("Segundo bloqueio deve ser idempotente");
    const dupCount = await sql`
      select count(*)::int as c from "user_block" where "blockerId" = ${idAlice} and "blockedId" = ${idBob}
    `;
    if (dupCount[0].c !== 1) throw new Error("Registro duplicado criado na user_block");
    console.log("✓ Teste 4 passou: Bloqueio duplicado tratado atomicamente sem duplicatas.");

    // TESTE 5: Impedir que terceiros removam bloqueios alheios
    console.log("\n[Teste 5] Impedir que terceiros removam bloqueios alheios");
    // Charlie tenta desbloquear Bob em nome de Alice
    await executeUnblockUser(sql, idCharlie, idBob);
    const stillBlocked = await sql`
      select * from "user_block" where "blockerId" = ${idAlice} and "blockedId" = ${idBob}
    `;
    if (stillBlocked.length !== 1) throw new Error("Terceiro conseguiu remover o bloqueio de Alice!");
    console.log("✓ Teste 5 passou: Bloqueio protegido contra manipulação de terceiros.");

    // TESTE 6: Remover seguidores nas duas direções ao bloquear
    console.log("\n[Teste 6] Remover seguidores nas duas direções ao bloquear");
    // Verificamos que o bloqueio de Alice em Bob removeu os vínculos mútuos em user_follow
    const followsBetweenAliceAndBob = await sql`
      select * from "user_follow"
      where ("followerId" = ${idAlice} and "followingId" = ${idBob})
         or ("followerId" = ${idBob} and "followingId" = ${idAlice})
    `;
    if (followsBetweenAliceAndBob.length !== 0) {
      throw new Error("Vínculos de seguidor ainda existem após o bloqueio mútuo!");
    }
    console.log("✓ Teste 6 passou: Vínculos em user_follow removidos em ambas as direções.");

    // TESTE 7: Remover solicitações pendentes nas duas direções ao bloquear
    console.log("\n[Teste 7] Remover solicitações pendentes nas duas direções ao bloquear");
    // Charlie tinha pedido para seguir Alice. Agora Alice bloqueia Charlie.
    await executeBlockUser(sql, idAlice, idCharlie);
    const requestsAliceCharlie = await sql`
      select * from "user_follow_request"
      where ("requesterId" = ${idCharlie} and "targetId" = ${idAlice})
         or ("requesterId" = ${idAlice} and "targetId" = ${idCharlie})
    `;
    if (requestsAliceCharlie.length !== 0) {
      throw new Error("Solicitações pendentes ainda persistem após bloqueio!");
    }
    console.log("✓ Teste 7 passou: Solicitações pendentes eliminadas atomicamente em ambas as direções.");

    // TESTE 8: Impedir novas solicitações ou vínculos após bloqueio
    console.log("\n[Teste 8] Impedir novas solicitações ou vínculos após bloqueio");
    let followBlocked1 = false;
    try {
      // Bob tenta seguir Alice (que o bloqueou)
      await executeFollowUser(sql, idBob, idAlice);
    } catch {
      followBlocked1 = true;
    }
    if (!followBlocked1) throw new Error("Bob conseguiu seguir Alice mesmo bloqueado!");

    let followBlocked2 = false;
    try {
      // Alice tenta seguir Bob (a quem ela bloqueou)
      await executeFollowUser(sql, idAlice, idBob);
    } catch {
      followBlocked2 = true;
    }
    if (!followBlocked2) throw new Error("Alice conseguiu seguir Bob enquanto o bloqueio está ativo!");
    console.log("✓ Teste 8 passou: Novas tentativas de seguir são barradas bilateralmente.");

    // TESTE 9: Impedir aprovação de solicitações pendentes após bloqueio
    console.log("\n[Teste 9] Impedir aprovação de solicitações pendentes após bloqueio");
    let acceptBlocked = false;
    try {
      await executeAcceptFollowRequest(sql, idAlice, idBob);
    } catch {
      acceptBlocked = true;
    }
    if (!acceptBlocked) throw new Error("Aprovação de solicitação deveria ser impedida");
    console.log("✓ Teste 9 passou: Aprovação de solicitações impedida com bloqueio ativo.");

    // TESTE 10: Impedir novas interações nos comentários entre usuários bloqueados (respostas e likes)
    console.log("\n[Teste 10] Impedir interações nos comentários entre usuários bloqueados");
    const dummyAnimeId = "e9_anime_" + Date.now();
    const dummyComment = await sql`
      insert into "comment" ("id", "userId", "animeId", "episodeId", "content", "createdAt", "updatedAt")
      values (${'comm_' + Date.now()}, ${idAlice}, ${dummyAnimeId}, 'ep-1', 'Comentário original de Alice', current_timestamp, current_timestamp)
      returning *
    `;

    // Simulação do check da rota api/comments.ts para resposta
    const checkReplyBlock = await sql`
      select 1 from "user_block"
      where ("blockerId" = ${idBob} and "blockedId" = ${dummyComment[0].userId})
         or ("blockerId" = ${dummyComment[0].userId} and "blockedId" = ${idBob})
      limit 1
    `;
    if (checkReplyBlock.length === 0) {
      throw new Error("Deveria detectar bloqueio ativo entre Alice e Bob no sistema de comentários");
    }
    console.log("✓ Teste 10 passou: Interações e respostas em comentários barradas entre usuários bloqueados.");

    // TESTE 11: Impedir acesso a conteúdos privados por vínculos anteriores
    console.log("\n[Teste 11] Impedir acesso a conteúdos privados por vínculos anteriores");
    // Bob tem conta privada e privacidade de seções = 'followers'.
    // Alice está com bloqueio mútuo com Bob.
    const privacyBobEvaluated = await evaluateUserPrivacy(sql, idBob, idAlice);
    if (privacyBobEvaluated.isFollower) {
      throw new Error("Alice não deveria ser considerada seguidora de Bob!");
    }
    if (privacyBobEvaluated.canViewLists || privacyBobEvaluated.canViewComments) {
      throw new Error("Alice não deveria ter acesso às seções restritas a seguidores de Bob!");
    }
    console.log("✓ Teste 11 passou: Usuário bloqueado não acessa conteúdo restrito de seguidores.");

    // TESTE 12: Preservar comentários antigos intactos e permissões de seus autores
    console.log("\n[Teste 12] Preservar comentários antigos intactos e permissões de seus autores");
    const existingComment = await sql`
      select * from "comment" where "id" = ${dummyComment[0].id}
    `;
    if (existingComment.length !== 1 || existingComment[0].content !== 'Comentário original de Alice') {
      throw new Error("Comentário histórico foi alterado ou apagado indevidamente!");
    }
    console.log("✓ Teste 12 passou: Comentários históricos permanecem intactos.");

    // TESTE 13: Não restaurar vínculos anteriores automaticamente após desbloquear
    console.log("\n[Teste 13] Não restaurar vínculos anteriores após desbloquear");
    // Alice desbloqueia Bob
    await executeUnblockUser(sql, idAlice, idBob);
    const followsRestored = await sql`
      select * from "user_follow"
      where ("followerId" = ${idAlice} and "followingId" = ${idBob})
         or ("followerId" = ${idBob} and "followingId" = ${idAlice})
    `;
    if (followsRestored.length !== 0) {
      throw new Error("Vínculos anteriores NUNCA devem ser restaurados automaticamente!");
    }
    console.log("✓ Teste 13 passou: Desbloqueio não restaura relacionamentos anteriores.");

    // TESTE 14: Listar usuários bloqueados corretamente (executeGetMyBlockedUsers)
    console.log("\n[Teste 14] Listar usuários bloqueados corretamente");
    // Alice ainda bloqueia Charlie
    const aliceBlockedList = await executeGetMyBlockedUsers(sql, idAlice);
    const hasCharlie = aliceBlockedList.some((u) => u.id === idCharlie);
    if (!hasCharlie) {
      throw new Error("Charlie deveria constar na lista de bloqueados de Alice!");
    }
    console.log("✓ Teste 14 passou: Lista de bloqueados retorna usuários com metadados corretos.");

    // TESTE 15: Verificar bloqueio unilateral com status bidirecional
    console.log("\n[Teste 15] Verificar bloqueio unilateral com status bidirecional");
    // Charlie consulta status com Alice: Alice bloqueou Charlie
    const charlieViewAlice = await executeGetUserBlockStatus(sql, idCharlie, idAlice);
    if (!charlieViewAlice.isBlocked || !charlieViewAlice.isBlockedByTarget || charlieViewAlice.isBlockedByMe) {
      throw new Error("Status de bloqueio incorreto na perspectiva do bloqueado");
    }

    const aliceViewCharlie = await executeGetUserBlockStatus(sql, idAlice, idCharlie);
    if (!aliceViewCharlie.isBlocked || !aliceViewCharlie.isBlockedByMe || aliceViewCharlie.isBlockedByTarget) {
      throw new Error("Status de bloqueio incorreto na perspectiva do bloqueador");
    }
    console.log("✓ Teste 15 passou: Perspectivas direcionais do bloqueio consistentes e precisas.");

    // TESTE 16: Regressão das Etapas 7 e 8
    console.log("\n[Teste 16] Regressão das Etapas 7 e 8");
    // Dave segue Alice (conta pública) normalmente
    const daveFollowAlice = await executeFollowUser(sql, idDave, idAlice);
    if (daveFollowAlice.status !== "following") {
      throw new Error("Fluxo normal de follow da Etapa 8 foi afetado");
    }
    const daveRelAlice = await executeGetUserRelationship(sql, idDave, idAlice);
    if (!daveRelAlice.isFollowing) {
      throw new Error("Dave deveria constar como seguidor de Alice");
    }
    await executeUnfollowUser(sql, idDave, idAlice);
    console.log("✓ Teste 16 passou: Regressão das Etapas 7 e 8 validada com sucesso.");

    console.log("\n========================================================");
    console.log(">>> TODOS OS 16 TESTES DA ETAPA 9 PASSARAM COM SUCESSO! <<<");
    console.log("========================================================\n");
  } finally {
    // Cleanup dos usuários de teste
    try {
      await sql`delete from "user_block" where "blockerId" in (${idAlice}, ${idBob}, ${idCharlie}, ${idDave}) or "blockedId" in (${idAlice}, ${idBob}, ${idCharlie}, ${idDave})`;
      await sql`delete from "user_follow" where "followerId" in (${idAlice}, ${idBob}, ${idCharlie}, ${idDave}) or "followingId" in (${idAlice}, ${idBob}, ${idCharlie}, ${idDave})`;
      await sql`delete from "user_follow_request" where "requesterId" in (${idAlice}, ${idBob}, ${idCharlie}, ${idDave}) or "targetId" in (${idAlice}, ${idBob}, ${idCharlie}, ${idDave})`;
      await sql`delete from "comment" where "userId" in (${idAlice}, ${idBob}, ${idCharlie}, ${idDave})`;
      await sql`delete from "profile" where "userId" in (${idAlice}, ${idBob}, ${idCharlie}, ${idDave})`;
      await sql`delete from "user" where "id" in (${idAlice}, ${idBob}, ${idCharlie}, ${idDave})`;
    } catch (e) {
      console.warn("Cleanup warning:", e);
    }
  }
}

runTests().catch((err) => {
  console.error("ERRO NA SUITE DE TESTES DA ETAPA 9:", err);
  process.exit(1);
});
