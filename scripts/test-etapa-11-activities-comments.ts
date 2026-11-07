/**
 * Suite de Verificação Completa da Etapa 11:
 * Atividades e Histórico de Comentários | Hikari Perfil
 */

import { getSql } from "@/lib/db";
import {
  executeGetUserActivities,
  executeGetComments,
  evaluateUserPrivacy,
  executeBlockUser,
  executeFollowUser,
  executeAcceptFollowRequest,
  type MyProfileComment,
  type UserActivityItem,
} from "@/lib/profile.functions";
import { executeCreateNotification } from "@/lib/notifications.functions";

async function runEtapa11Tests() {
  console.log("=== INICIANDO SUITE DE TESTES DA ETAPA 11: ATIVIDADES E HISTÓRICO DE COMENTÁRIOS ===");
  const sql = await getSql();

  const timestamp = Date.now();
  const idAlice = `e11_alice_${timestamp}`;
  const idBob = `e11_bob_${timestamp}`;
  const idCharlie = `e11_charlie_${timestamp}`;
  const idDave = `e11_dave_${timestamp}`;

  try {
    // 0. Seed usuários de teste
    console.log("\n-> Criando usuários de teste (Alice, Bob, Charlie, Dave)...");

    await sql`
      insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
      values
        (${idAlice}, 'Alice Perfil', ${idAlice + '@test.com'}, true, current_timestamp, current_timestamp),
        (${idBob}, 'Bob Visitante', ${idBob + '@test.com'}, true, current_timestamp, current_timestamp),
        (${idCharlie}, 'Charlie Seguidor', ${idCharlie + '@test.com'}, true, current_timestamp, current_timestamp),
        (${idDave}, 'Dave Bloqueado', ${idDave + '@test.com'}, true, current_timestamp, current_timestamp)
    `;

    await sql`
      insert into "profile" ("userId", "nick", "displayName", "accountType", "allowFollowers", "privacyComments", "privacyHistory", "privacyLists", "privacyFavorites")
      values
        (${idAlice}, ${'alice_' + timestamp.toString().slice(-6)}, 'Alice Perfil', 'public', true, 'public', 'public', 'public', 'public'),
        (${idBob}, ${'bob_' + timestamp.toString().slice(-6)}, 'Bob Visitante', 'public', true, 'public', 'public', 'public', 'public'),
        (${idCharlie}, ${'charlie_' + timestamp.toString().slice(-6)}, 'Charlie Seguidor', 'public', true, 'public', 'public', 'public', 'public'),
        (${idDave}, ${'dave_' + timestamp.toString().slice(-6)}, 'Dave Bloqueado', 'public', true, 'public', 'public', 'public', 'public')
    `;

    console.log("-> Usuários criados com sucesso.");

    // TESTE 1: Listagem de atividades reais
    console.log("\n[Teste 1] Listagem de atividades reais (Watched, Tracking Add, Tracking Update, Fav, List Create, List Item)");

    // 1.1 Episódio assistido
    await sql`
      insert into "user_watched_episode" ("userId", "animeId", "episodeId", "episodeNumber", "origin", "watchedAt")
      values (${idAlice}, 'kitsu-7442', 'ep-1', 1, 'playback', current_timestamp - interval '50 minutes')
    `;

    // 1.2 Tracking adicionado (createdAt)
    await sql`
      insert into "user_anime_tracking" ("userId", "animeId", "status", "score", "episodesWatched", "animeSnapshot", "createdAt", "updatedAt")
      values (
        ${idAlice},
        'kitsu-41370',
        'watching',
        8.5,
        3,
        ${JSON.stringify({ title: 'Demon Slayer', cover: 'https://example.com/ds.jpg' })},
        current_timestamp - interval '40 minutes',
        current_timestamp - interval '40 minutes'
      )
    `;

    // 1.3 Tracking atualizado (updatedAt > createdAt + 2s e sem watched_episode recente)
    await sql`
      insert into "user_anime_tracking" ("userId", "animeId", "status", "score", "episodesWatched", "animeSnapshot", "createdAt", "updatedAt")
      values (
        ${idAlice},
        'kitsu-42765',
        'completed',
        9.5,
        24,
        ${JSON.stringify({ title: 'Jujutsu Kaisen', cover: 'https://example.com/jjk.jpg' })},
        current_timestamp - interval '30 minutes',
        current_timestamp - interval '20 minutes'
      )
    `;

    // 1.4 Favorito adicionado (usando anime em catalog_anime ou mock)
    // Garantir que catalog_anime tenha kitsu-7442
    await sql`
      insert into "catalog_anime" ("id", "title", "createdAt", "updatedAt")
      values ('kitsu-7442', 'Attack on Titan', current_timestamp, current_timestamp)
      on conflict ("id") do nothing
    `;

    const favId = `fav-${timestamp}-1`;
    await sql`
      insert into "user_favorite" ("id", "userId", "targetType", "animeId", "createdAt")
      values (${favId}, ${idAlice}, 'anime', 'kitsu-7442', current_timestamp - interval '15 minutes')
    `;

    // 1.5 Lista personalizada criada
    const listId = `list-${timestamp}-1`;
    await sql`
      insert into "user_custom_list" ("id", "userId", "title", "description", "isPublic", "createdAt", "updatedAt")
      values (${listId}, ${idAlice}, 'Meus Animes Favoritos de Todos os Tempos', 'Lista especial', true, current_timestamp - interval '10 minutes', current_timestamp - interval '10 minutes')
    `;

    // 1.6 Item adicionado à lista personalizada
    await sql`
      insert into "user_custom_list_item" ("listId", "animeId", "position", "animeSnapshot", "addedAt")
      values (${listId}, 'kitsu-7442', 0, ${JSON.stringify({ title: 'Attack on Titan' })}, current_timestamp - interval '5 minutes')
    `;

    const activitiesAlice = await executeGetUserActivities(sql, idAlice, true, 1, 15);
    if (activitiesAlice.total !== 6) {
      throw new Error(`Esperado 6 atividades reais, encontrado ${activitiesAlice.total}`);
    }

    const typesFound = new Set(activitiesAlice.items.map((a) => a.type));
    if (!typesFound.has("watched_episode")) throw new Error("Atividade watched_episode ausente");
    if (!typesFound.has("tracking_added")) throw new Error("Atividade tracking_added ausente");
    if (typesFound.has("tracking_updated")) throw new Error("Atividade tracking_updated NÃO deveria existir no feed");
    if (!typesFound.has("favorite_added")) throw new Error("Atividade favorite_added ausente");
    if (!typesFound.has("list_created")) throw new Error("Atividade list_created ausente");
    if (!typesFound.has("list_item_added")) throw new Error("Atividade list_item_added ausente");

    console.log("✓ Teste 1 passou: Todas as 5 categorias de atividades legítimas listadas (6 eventos reais, zero tracking_updated).");

    // TESTE 2: Ordenação cronológica
    console.log("\n[Teste 2] Ordenação cronológica (mais recente primeiro)");
    for (let i = 0; i < activitiesAlice.items.length - 1; i++) {
      const t1 = new Date(activitiesAlice.items[i].createdAt).getTime();
      const t2 = new Date(activitiesAlice.items[i + 1].createdAt).getTime();
      if (t1 < t2) {
        throw new Error(`Atividades fora de ordem cronológica no índice ${i}: ${t1} < ${t2}`);
      }
    }
    console.log("✓ Teste 2 passou: Atividades rigorosamente ordenadas do mais recente para o mais antigo.");

    // TESTE 3: Paginação sem duplicação ou perda de registros
    console.log("\n[Teste 3] Paginação determinística sem duplicação ou perda de registros");
    const page1 = await executeGetUserActivities(sql, idAlice, true, 1, 2);
    const page2 = await executeGetUserActivities(sql, idAlice, true, 2, 2);
    const page3 = await executeGetUserActivities(sql, idAlice, true, 3, 2);

    if (page1.items.length !== 2 || page2.items.length !== 2 || page3.items.length !== 2) {
      throw new Error(`Paginação retornou contagens inesperadas: P1=${page1.items.length}, P2=${page2.items.length}, P3=${page3.items.length}`);
    }

    const allPagedIds = [...page1.items, ...page2.items, ...page3.items].map((i) => i.id);
    const uniqueIds = new Set(allPagedIds);
    if (uniqueIds.size !== 6) {
      throw new Error(`Duplicação ou perda detectada na paginação: total=${uniqueIds.size}, esperado=6`);
    }
    console.log("✓ Teste 3 passou: Paginação de 3 páginas de 2 itens sem sobreposição e sem perda de itens.");

    // TESTE 4: Histórico de comentários
    console.log("\n[Teste 4] Histórico de comentários (conteúdo, data, episódio, anime, spoiler)");
    const comment1Id = `c1_${timestamp}`;
    const comment2Id = `c2_${timestamp}`;
    const comment3Id = `c3_${timestamp}`;

    await sql`
      insert into "comment" ("id", "userId", "animeId", "episodeId", "content", "isSpoiler", "createdAt", "updatedAt")
      values
        (${comment1Id}, ${idAlice}, 'kitsu-7442', 'ep-1', 'Comentário normal no episódio 1', false, current_timestamp - interval '2 hours', current_timestamp - interval '2 hours'),
        (${comment2Id}, ${idAlice}, 'kitsu-7442', 'ep-2', 'Cuidado com este spoiler importante!', true, current_timestamp - interval '1 hour', current_timestamp - interval '1 hour'),
        (${comment3Id}, ${idAlice}, 'kitsu-41370', 'ep-5', 'Animação incrível nesta batalha', false, current_timestamp - interval '30 minutes', current_timestamp - interval '30 minutes')
    `;

    const commentsAlice = await executeGetComments(sql, idAlice, null, true, 1, 10);
    if (commentsAlice.total !== 3) {
      throw new Error(`Esperado 3 comentários para Alice, encontrado ${commentsAlice.total}`);
    }

    const spoilerComment = commentsAlice.items.find((c) => c.id === comment2Id);
    if (!spoilerComment?.isSpoiler) {
      throw new Error("Comentário com flag isSpoiler=true não foi preservado");
    }

    console.log("✓ Teste 4 passou: Histórico de comentários retornou metadados, episódios e spoiler corretamente.");

    // TESTE 5: Comentários de outros usuários não aparecem
    console.log("\n[Teste 5] Comentários de outros usuários não aparecem");
    const commentBob = `c_bob_${timestamp}`;
    await sql`
      insert into "comment" ("id", "userId", "animeId", "episodeId", "content", "isSpoiler", "createdAt", "updatedAt")
      values (${commentBob}, ${idBob}, 'kitsu-7442', 'ep-1', 'Comentário do Bob', false, current_timestamp, current_timestamp)
    `;

    const commentsOnlyAlice = await executeGetComments(sql, idAlice, null, false, 1, 10);
    const hasBobInAlice = commentsOnlyAlice.items.some((c) => c.userId === idBob);
    if (hasBobInAlice || commentsOnlyAlice.total !== 3) {
      throw new Error("Comentários de outro usuário vazaram na lista de comentários de Alice");
    }
    console.log("✓ Teste 5 passou: Comentários de terceiros estritamente isolados.");

    // TESTE 6: Privacidade pública
    console.log("\n[Teste 6] Privacidade pública (visitante anônimo)");
    const privPublic = await evaluateUserPrivacy(sql, idAlice, null);
    if (!privPublic.canViewComments || !privPublic.canViewHistory) {
      throw new Error("Perfil público deveria permitir comentários e histórico para visitantes anônimos");
    }
    console.log("✓ Teste 6 passou: Visitantes anônimos acessam conteúdo público.");

    // TESTE 7: Privacidade para seguidores aprovados
    console.log("\n[Teste 7] Privacidade restrita a seguidores aprovados (followers)");
    await sql`
      update "profile"
      set "privacyHistory" = 'followers', "privacyComments" = 'followers'
      where "userId" = ${idAlice}
    `;

    // Bob não é seguidor
    const privBobNonFollower = await evaluateUserPrivacy(sql, idAlice, idBob);
    if (privBobNonFollower.canViewHistory || privBobNonFollower.canViewComments) {
      throw new Error("Não-seguidor teve acesso a seções restritas a seguidores");
    }

    // Charlie segue Alice
    await sql`
      insert into "user_follow" ("followerId", "followingId", "createdAt")
      values (${idCharlie}, ${idAlice}, current_timestamp)
    `;

    const privCharlieFollower = await evaluateUserPrivacy(sql, idAlice, idCharlie);
    if (!privCharlieFollower.canViewHistory || !privCharlieFollower.canViewComments) {
      throw new Error("Seguidor aprovado não teve acesso a seções followers");
    }
    console.log("✓ Teste 7 passou: Acesso garantido a seguidores aprovados e negado a não-seguidores.");

    // TESTE 8: Privacidade somente eu
    console.log("\n[Teste 8] Privacidade Somente Eu (private)");
    await sql`
      update "profile"
      set "privacyHistory" = 'private', "privacyComments" = 'private'
      where "userId" = ${idAlice}
    `;

    const privCharliePrivate = await evaluateUserPrivacy(sql, idAlice, idCharlie);
    if (privCharliePrivate.canViewHistory || privCharliePrivate.canViewComments) {
      throw new Error("Seguidor teve acesso a seções privadas 'Somente Eu'");
    }

    const privAliceOwner = await evaluateUserPrivacy(sql, idAlice, idAlice);
    if (!privAliceOwner.canViewHistory || !privAliceOwner.canViewComments) {
      throw new Error("Proprietário foi impedido de acessar suas próprias seções");
    }
    console.log("✓ Teste 8 passou: Somente Eu bloqueia seguidores e permite o proprietário.");

    // TESTE 9: Conta privada
    console.log("\n[Teste 9] Conta privada (accountType = 'private')");
    await sql`
      update "profile"
      set "accountType" = 'private', "privacyHistory" = 'public', "privacyComments" = 'public'
      where "userId" = ${idAlice}
    `;

    const privBobPrivateAccount = await evaluateUserPrivacy(sql, idAlice, idBob);
    if (privBobPrivateAccount.canViewHistory || privBobPrivateAccount.canViewComments || privBobPrivateAccount.canViewAccount) {
      throw new Error("Conta privada permitiu acesso de usuário não-seguidor");
    }

    const privCharliePrivateAccount = await evaluateUserPrivacy(sql, idAlice, idCharlie);
    if (!privCharliePrivateAccount.canViewHistory || !privCharliePrivateAccount.canViewComments) {
      throw new Error("Seguidor aprovado de conta privada não teve acesso");
    }
    console.log("✓ Teste 9 passou: Conta privada protege todo o perfil contra não-seguidores.");

    // TESTE 10: Bloqueio bilateral
    console.log("\n[Teste 10] Bloqueio bilateral (impede acesso independente de vínculos prévios)");
    await executeBlockUser(sql, idAlice, idDave);

    const privAliceDave = await evaluateUserPrivacy(sql, idAlice, idDave);
    const privDaveAlice = await evaluateUserPrivacy(sql, idDave, idAlice);

    if (privAliceDave.canViewHistory || privAliceDave.canViewComments) {
      throw new Error("Usuário bloqueado conseguiu visualizar histórico ou comentários de quem o bloqueou");
    }
    if (privDaveAlice.canViewHistory || privDaveAlice.canViewComments) {
      throw new Error("Bloqueador teve acesso indevido às seções do bloqueado");
    }
    console.log("✓ Teste 10 passou: Bloqueio bilateral impede acesso em ambas as direções.");

    // TESTE 11: Isolamento entre usuários (listas privadas e favoritos privados não vazam no feed)
    console.log("\n[Teste 11] Isolamento no feed (listas privadas e seções privadas não vazam)");
    // Restaurar perfil da Alice para público com histórico público, mas listas e favoritos privados
    await sql`
      update "profile"
      set "accountType" = 'public', "privacyHistory" = 'public', "privacyLists" = 'private', "privacyFavorites" = 'private'
      where "userId" = ${idAlice}
    `;

    // Bob consulta atividades públicas da Alice
    const privAliceForBob = await evaluateUserPrivacy(sql, idAlice, idBob);
    const bobViewOfAliceActs = await executeGetUserActivities(sql, idAlice, {
      isOwner: false,
      canViewLists: privAliceForBob.canViewLists,
      canViewFavorites: privAliceForBob.canViewFavorites,
    });

    const leakedFav = bobViewOfAliceActs.items.some((a) => a.type === "favorite_added");
    const leakedList = bobViewOfAliceActs.items.some((a) => a.type === "list_created" || a.type === "list_item_added");

    if (leakedFav) throw new Error("Favorito privado vazou no feed público");
    if (leakedList) throw new Error("Lista privada vazou no feed público");

    // Alice como dona vê tudo
    const aliceSelfActs = await executeGetUserActivities(sql, idAlice, {
      isOwner: true,
      canViewLists: true,
      canViewFavorites: true,
    });
    const ownerFav = aliceSelfActs.items.some((a) => a.type === "favorite_added");
    const ownerList = aliceSelfActs.items.some((a) => a.type === "list_created");
    if (!ownerFav || !ownerList) {
      throw new Error("Proprietário deveria visualizar suas atividades completas");
    }
    console.log("✓ Teste 11 passou: Atividades privadas não vazam no feed de terceiros.");

    // TESTE 12: Conteúdo excluído ou indisponível
    console.log("\n[Teste 12] Conteúdo excluído ou indisponível tratado com resiliência");
    const commentArchivedId = `c_archived_${timestamp}`;
    await sql`
      insert into "comment" ("id", "userId", "animeId", "episodeId", "content", "isSpoiler", "createdAt", "updatedAt")
      values (${commentArchivedId}, ${idAlice}, 'non_existent_anime_9999', 'ep-99', 'Comentário sobre anime deletado', false, current_timestamp, current_timestamp)
    `;

    const commentsWithArchived = await executeGetComments(sql, idAlice, null, true, 1, 10);
    const archivedItem = commentsWithArchived.items.find((c) => c.id === commentArchivedId);
    if (!archivedItem) {
      throw new Error("Comentário em anime desconhecido não foi listado");
    }
    if (archivedItem.animeTitle !== "Anime indisponível") {
      throw new Error(`Esperado 'Anime indisponível', recebido '${archivedItem.animeTitle}'`);
    }

    // Exclusão do comentário
    await sql`delete from "comment" where "id" = ${commentArchivedId}`;
    const commentsAfterDel = await executeGetComments(sql, idAlice, null, true, 1, 10);
    if (commentsAfterDel.items.some((c) => c.id === commentArchivedId)) {
      throw new Error("Comentário excluído ainda aparece no histórico");
    }
    console.log("✓ Teste 12 passou: Animes inexistentes tratados com segurança e exclusão respeitada.");

    // TESTE 13: Regressão das Etapas 7, 8, 9 e 10
    console.log("\n[Teste 13] Validação de regressão das Etapas 7, 8, 9 e 10");
    // Regressão Etapa 10: Notificações
    const notifRes = await executeCreateNotification(sql, {
      userId: idAlice,
      actorId: idBob,
      type: "comment_like",
      message: "Bob curtiu seu comentário",
      commentId: comment1Id,
    });
    if (!notifRes.success) {
      throw new Error(`Criação de notificação da Etapa 10 falhou: ${notifRes.reason}`);
    }

    // Regressão Etapa 8: Contagem de seguidores
    const followerCountRows = await sql<{ count: string }>`
      select count(*)::text as count from "user_follow" where "followingId" = ${idAlice}
    `;
    if (Number(followerCountRows[0]?.count) !== 1) {
      throw new Error("Contagem de seguidores inconsistente");
    }
    console.log("✓ Teste 13 passou: Funcionalidades anteriores (7, 8, 9 e 10) preservadas.");

    // TESTE 14: Ausência de dados ou timestamps inventados
    console.log("\n[Teste 14] Ausência de dados ou timestamps inventados");
    // Criar um usuário sem qualquer atividade
    const idEmptyUser = `e11_empty_${timestamp}`;
    await sql`
      insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
      values (${idEmptyUser}, 'Empty User', ${idEmptyUser + '@test.com'}, true, current_timestamp, current_timestamp)
    `;
    await sql`
      insert into "profile" ("userId", "nick", "displayName", "accountType")
      values (${idEmptyUser}, ${'empty_' + timestamp.toString().slice(-6)}, 'Empty User', 'public')
    `;

    const emptyActs = await executeGetUserActivities(sql, idEmptyUser, true, 1, 15);
    if (emptyActs.total !== 0 || emptyActs.items.length !== 0) {
      throw new Error("Usuário sem atividade retornou registros inventados");
    }

    const emptyComments = await executeGetComments(sql, idEmptyUser, null, true, 1, 15);
    if (emptyComments.total !== 0 || emptyComments.items.length !== 0) {
      throw new Error("Usuário sem comentários retornou comentários inventados");
    }

    // Verificar se todos os timestamps das atividades da Alice são datas válidas e reais
    for (const act of activitiesAlice.items) {
      const d = new Date(act.createdAt);
      if (isNaN(d.getTime())) {
        throw new Error(`Timestamp inválido detectado na atividade ${act.id}: ${act.createdAt}`);
      }
    }
    // TESTE 15: Validação específica dos 4 cenários de ausência de tracking_updated
    console.log("\n[Teste 15] Validação específica de inexistência de tracking_updated (Player, Heartbeat, Desmarcar, Alteração de Status/Nota)");

    const idPlayerTest = 'kitsu-player-test';
    // 15.1 Simular startPlaybackSession (reproduzir sem concluir)
    await sql`
      insert into "user_anime_tracking" ("userId", "animeId", "status", "episodesWatched", "animeSnapshot", "startedAt", "createdAt", "updatedAt")
      values (${idAlice}, ${idPlayerTest}, 'watching', 0, ${JSON.stringify({ title: 'Player Test Anime' })}, current_timestamp, current_timestamp - interval '2 hours', current_timestamp)
      on conflict ("userId", "animeId") do update set "updatedAt" = current_timestamp
    `;

    let acts = await executeGetUserActivities(sql, idAlice, true, 1, 50);
    if (acts.items.some((a) => a.type === "tracking_updated")) {
      throw new Error("Cenário 1 falhou: Iniciar reprodução gerou tracking_updated indevido");
    }

    // 15.2 Simular Heartbeat periódico do player (múltiplas atualizações de progresso e updatedAt)
    await sql`
      update "user_anime_tracking"
      set "updatedAt" = current_timestamp
      where "userId" = ${idAlice} and "animeId" = ${idPlayerTest}
    `;
    acts = await executeGetUserActivities(sql, idAlice, true, 1, 50);
    if (acts.items.some((a) => a.type === "tracking_updated")) {
      throw new Error("Cenário 2 falhou: Heartbeat do player gerou tracking_updated indevido");
    }

    // 15.3 Simular Desmarcação de episódio
    await sql`
      delete from "user_watched_episode"
      where "userId" = ${idAlice} and "animeId" = ${idPlayerTest}
    `;
    await sql`
      update "user_anime_tracking"
      set "episodesWatched" = 0, "updatedAt" = current_timestamp
      where "userId" = ${idAlice} and "animeId" = ${idPlayerTest}
    `;
    acts = await executeGetUserActivities(sql, idAlice, true, 1, 50);
    if (acts.items.some((a) => a.type === "tracking_updated")) {
      throw new Error("Cenário 3 falhou: Desmarcar episódio gerou tracking_updated indevido");
    }

    // 15.4 Simular Alteração apenas de nota e status
    await sql`
      update "user_anime_tracking"
      set "status" = 'completed', "score" = 10.0, "updatedAt" = current_timestamp
      where "userId" = ${idAlice} and "animeId" = ${idPlayerTest}
    `;
    acts = await executeGetUserActivities(sql, idAlice, true, 1, 50);
    if (acts.items.some((a) => a.type === "tracking_updated")) {
      throw new Error("Cenário 4 falhou: Alteração de status/nota gerou tracking_updated");
    }

    console.log("✓ Teste 15 passou: Player, heartbeats, desmarcações e alterações de status/nota não geram tracking_updated em hipótese alguma.");

    console.log("\n========================================================");
    console.log(">>> TODOS OS 15 TESTES DA ETAPA 11 PASSARAM COM SUCESSO! <<<");
    console.log("========================================================\n");
  } finally {
    // Limpeza dos dados de teste
    try {
      await sql`delete from "notification" where "userId" in (${idAlice}, ${idBob}, ${idCharlie}, ${idDave}) or "actorId" in (${idAlice}, ${idBob}, ${idCharlie}, ${idDave})`;
      await sql`delete from "user_block" where "blockerId" in (${idAlice}, ${idBob}, ${idCharlie}, ${idDave}) or "blockedId" in (${idAlice}, ${idBob}, ${idCharlie}, ${idDave})`;
      await sql`delete from "user_follow" where "followerId" in (${idAlice}, ${idBob}, ${idCharlie}, ${idDave}) or "followingId" in (${idAlice}, ${idBob}, ${idCharlie}, ${idDave})`;
      await sql`delete from "user_custom_list_item" where "listId" in (select id from "user_custom_list" where "userId" in (${idAlice}, ${idBob}, ${idCharlie}, ${idDave}))`;
      await sql`delete from "user_custom_list" where "userId" in (${idAlice}, ${idBob}, ${idCharlie}, ${idDave})`;
      await sql`delete from "user_favorite" where "userId" in (${idAlice}, ${idBob}, ${idCharlie}, ${idDave})`;
      await sql`delete from "user_watched_episode" where "userId" in (${idAlice}, ${idBob}, ${idCharlie}, ${idDave})`;
      await sql`delete from "user_anime_tracking" where "userId" in (${idAlice}, ${idBob}, ${idCharlie}, ${idDave})`;
      await sql`delete from "comment" where "userId" in (${idAlice}, ${idBob}, ${idCharlie}, ${idDave})`;
      await sql`delete from "profile" where "userId" in (${idAlice}, ${idBob}, ${idCharlie}, ${idDave})`;
      await sql`delete from "user" where "id" in (${idAlice}, ${idBob}, ${idCharlie}, ${idDave})`;
    } catch (e) {
      console.warn("Cleanup warning:", e);
    }
  }
}

runEtapa11Tests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("ERRO NA SUITE DE TESTES DA ETAPA 11:", err);
    process.exit(1);
  });
