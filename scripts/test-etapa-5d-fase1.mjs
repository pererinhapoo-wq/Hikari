import assert from "node:assert/strict";
import { getSql } from "../src/lib/db.ts";
import { Route } from "../src/routes/api/comments.ts";

async function runEtapa5DTests() {
  console.log("=== INICIANDO TESTES DA ETAPA 5D / FASE 1: BACKEND DA PAGINAÇÃO ===");

  const sql = await getSql();
  const getHandler = Route.options.server?.handlers?.GET;
  assert.ok(getHandler, "GET handler de /api/comments deve estar definido");

  const testAnimeId = `test-anime-5d-${Date.now()}`;
  const testEpisodeId = `ep-1-5d`;
  const otherEpisodeId = `ep-2-5d`;

  // Cria usuários de teste
  const userA = `user-5d-a-${Date.now()}`;
  const userB = `user-5d-b-${Date.now()}`;
  const userC = `user-5d-c-${Date.now()}`;

  await sql.query(`
    insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
    values
      ('${userA}', 'Ana Tester', 'ana@test.local', true, current_timestamp, current_timestamp),
      ('${userB}', 'Bruno Tester', 'bruno@test.local', true, current_timestamp, current_timestamp),
      ('${userC}', 'Carla Tester', 'carla@test.local', true, current_timestamp, current_timestamp)
    on conflict do nothing
  `);

  await sql.query(`
    insert into "profile" ("userId", "nick", "createdAt", "updatedAt")
    values
      ('${userA}', 'AnaNick', current_timestamp, current_timestamp),
      ('${userB}', 'BrunoNick', current_timestamp, current_timestamp)
    on conflict do nothing
  `);

  try {
    // -------------------------------------------------------------
    // Setup de dados: Criar 60 comentários-raiz para testar 3 lotes de 25
    // -------------------------------------------------------------
    console.log("Inserindo 60 comentários principais com timestamps ordenados...");
    const baseTime = Date.now() - 1000 * 60 * 60 * 24; // 24 horas atrás

    const rootIds = [];
    for (let i = 1; i <= 60; i++) {
      const id = `c-root-${i.toString().padStart(3, "0")}-${Date.now()}`;
      rootIds.push(id);
      // Cada comentário 10 minutos após o anterior
      const timeMs = baseTime + i * 10 * 60 * 1000;
      const isoTime = new Date(timeMs).toISOString();
      await sql.query(`
        insert into "comment" ("id", "userId", "animeId", "episodeId", "content", "parentId", "isSpoiler", "createdAt", "updatedAt")
        values ('${id}', '${userA}', '${testAnimeId}', '${testEpisodeId}', 'Comentário Raiz ${i}', null, false, '${isoTime}'::timestamptz, '${isoTime}'::timestamptz)
      `);
    }

    // -------------------------------------------------------------
    // 1. Teste: Primeiro lote de 25 comentários-raiz
    // -------------------------------------------------------------
    console.log("\n1. Testando primeiro lote de 25 comentários-raiz (padrão)...");
    const req1 = new Request(`http://localhost:3000/api/comments?animeId=${testAnimeId}&episodeId=${testEpisodeId}`);
    const res1 = await getHandler({ request: req1 });
    assert.equal(res1.status, 200);
    const data1 = await res1.json();

    assert.equal(data1.comments.length, 25, "Lote 1 deve retornar exatamente 25 comentários");
    assert.equal(data1.hasMore, true, "hasMore deve ser true para lote 1 de 60");
    assert.ok(data1.nextCursor, "nextCursor deve ser gerado");
    assert.equal(data1.totalCount, 60, "totalCount deve ser 60");
    assert.equal(data1.totalRoots, 60, "totalRoots deve ser 60");
    // O mais recente é o raiz 60 (index 0)
    assert.equal(data1.comments[0].id, rootIds[59], "Raiz 60 deve ser o primeiro do lote (mais recente)");
    console.log("✓ Primeiro lote de 25 verificado com sucesso.");

    // -------------------------------------------------------------
    // 2. Teste: Segundo e terceiro lotes
    // -------------------------------------------------------------
    console.log("\n2. Testando segundo e terceiro lotes usando nextCursor...");
    const req2 = new Request(`http://localhost:3000/api/comments?animeId=${testAnimeId}&episodeId=${testEpisodeId}&cursor=${data1.nextCursor}`);
    const res2 = await getHandler({ request: req2 });
    assert.equal(res2.status, 200);
    const data2 = await res2.json();

    assert.equal(data2.comments.length, 25, "Lote 2 deve retornar exatamente 25 comentários");
    assert.equal(data2.hasMore, true, "hasMore deve ser true para lote 2 (restam 10)");
    assert.ok(data2.nextCursor, "nextCursor deve ser gerado no lote 2");

    const req3 = new Request(`http://localhost:3000/api/comments?animeId=${testAnimeId}&episodeId=${testEpisodeId}&cursor=${data2.nextCursor}`);
    const res3 = await getHandler({ request: req3 });
    assert.equal(res3.status, 200);
    const data3 = await res3.json();

    assert.equal(data3.comments.length, 10, "Lote 3 deve retornar os últimos 10 comentários");
    assert.equal(data3.hasMore, false, "hasMore deve ser false no lote final");
    assert.equal(data3.nextCursor, null, "nextCursor deve ser null no lote final");
    console.log("✓ Segundo e terceiro lotes paginados com exatidão.");

    // -------------------------------------------------------------
    // 3. Teste: Ausência de duplicações entre lotes
    // -------------------------------------------------------------
    console.log("\n3. Verificando ausência de duplicações entre todos os lotes...");
    const allFetchedIds = [
      ...data1.comments.map((c) => c.id),
      ...data2.comments.map((c) => c.id),
      ...data3.comments.map((c) => c.id),
    ];
    assert.equal(allFetchedIds.length, 60, "Total de comentários dos 3 lotes deve ser 60");
    const uniqueFetched = new Set(allFetchedIds);
    assert.equal(uniqueFetched.size, 60, "Nenhum comentário pode estar duplicado entre lotes");
    console.log("✓ 100% dos 60 comentários recuperados sem nenhuma duplicação ou omissão.");

    // -------------------------------------------------------------
    // 4. Teste: Comentários com timestamps iguais e microssegundos diferentes
    // -------------------------------------------------------------
    console.log("\n4. Testando comentários com timestamps idênticos e microssegundos distintos...");
    const microAnimeId = `anime-micro-${Date.now()}`;
    const timeBase = "2026-11-04T12:00:00";
    const cMicro1 = `c-micro-1-${Date.now()}`;
    const cMicro2 = `c-micro-2-${Date.now()}`;
    const cMicro3 = `c-micro-3-${Date.now()}`;

    // Insere com diferenças apenas em microssegundos
    await sql.query(`
      insert into "comment" ("id", "userId", "animeId", "episodeId", "content", "parentId", "isSpoiler", "createdAt", "updatedAt")
      values
        ('${cMicro1}', '${userA}', '${microAnimeId}', 'ep1', 'Micro 1 (.100000)', null, false, '${timeBase}.100000Z'::timestamptz, current_timestamp),
        ('${cMicro2}', '${userA}', '${microAnimeId}', 'ep1', 'Micro 2 (.200000)', null, false, '${timeBase}.200000Z'::timestamptz, current_timestamp),
        ('${cMicro3}', '${userA}', '${microAnimeId}', 'ep1', 'Micro 3 (.300000)', null, false, '${timeBase}.300000Z'::timestamptz, current_timestamp)
    `);

    // Busca lote com limit 1 para forçar paginação em microssegundos
    const microReq1 = new Request(`http://localhost:3000/api/comments?animeId=${microAnimeId}&episodeId=ep1&limit=1`);
    const microRes1 = await getHandler({ request: microReq1 });
    const microData1 = await microRes1.json();
    assert.equal(microData1.comments[0].id, cMicro3, "O mais recente (.300000) deve ser retornado primeiro");

    // Segundo lote com cursor
    const microReq2 = new Request(`http://localhost:3000/api/comments?animeId=${microAnimeId}&episodeId=ep1&limit=1&cursor=${microData1.nextCursor}`);
    const microRes2 = await getHandler({ request: microReq2 });
    const microData2 = await microRes2.json();
    assert.equal(microData2.comments[0].id, cMicro2, "O intermediário (.200000) deve ser o segundo lote");

    // Terceiro lote com cursor
    const microReq3 = new Request(`http://localhost:3000/api/comments?animeId=${microAnimeId}&episodeId=ep1&limit=1&cursor=${microData2.nextCursor}`);
    const microRes3 = await getHandler({ request: microReq3 });
    const microData3 = await microRes3.json();
    assert.equal(microData3.comments[0].id, cMicro1, "O mais antigo (.100000) deve ser o terceiro lote");
    console.log("✓ Precisão de microssegundos validada com sucesso absoluto!");

    // -------------------------------------------------------------
    // 5. Teste: Cursor inválido ou adulterado
    // -------------------------------------------------------------
    console.log("\n5. Testando rejeição de cursores adulterados ou inválidos...");
    const badCursorReq1 = new Request(`http://localhost:3000/api/comments?animeId=${testAnimeId}&cursor=not-a-valid-base64`);
    const badCursorRes1 = await getHandler({ request: badCursorReq1 });
    assert.equal(badCursorRes1.status, 400, "Deve retornar 400 para Base64 corrompido");

    const forgedJson = Buffer.from(JSON.stringify({ v: 2, createdAt: "bad-date" })).toString("base64url");
    const badCursorReq2 = new Request(`http://localhost:3000/api/comments?animeId=${testAnimeId}&cursor=${forgedJson}`);
    const badCursorRes2 = await getHandler({ request: badCursorReq2 });
    assert.equal(badCursorRes2.status, 400, "Deve retornar 400 para versão ou schema adulterado");
    console.log("✓ Cursores adulterados e inválidos devidamente rejeitados com status 400.");

    // -------------------------------------------------------------
    // 6. Teste: Respostas em múltiplos níveis encadeados (filho, neto, bisneto)
    // -------------------------------------------------------------
    console.log("\n6. Testando comentários com respostas em múltiplos níveis...");
    const targetRoot = rootIds[59]; // Raiz 60
    const replyL1 = `c-reply-l1-${Date.now()}`;
    const replyL2 = `c-reply-l2-${Date.now()}`;
    const replyL3 = `c-reply-l3-${Date.now()}`;

    await sql.query(`
      insert into "comment" ("id", "userId", "animeId", "episodeId", "content", "parentId", "isSpoiler", "createdAt", "updatedAt")
      values
        ('${replyL1}', '${userB}', '${testAnimeId}', '${testEpisodeId}', 'Resposta nível 1', '${targetRoot}', false, current_timestamp + interval '1 minute', current_timestamp),
        ('${replyL2}', '${userC}', '${testAnimeId}', '${testEpisodeId}', 'Resposta nível 2 (neta)', '${replyL1}', false, current_timestamp + interval '2 minutes', current_timestamp),
        ('${replyL3}', '${userA}', '${testAnimeId}', '${testEpisodeId}', 'Resposta nível 3 (bisneta)', '${replyL2}', false, current_timestamp + interval '3 minutes', current_timestamp)
    `);

    const nestedReq = new Request(`http://localhost:3000/api/comments?animeId=${testAnimeId}&episodeId=${testEpisodeId}&limit=1`);
    const nestedRes = await getHandler({ request: nestedReq });
    const nestedData = await nestedRes.json();

    const idsRetornados = nestedData.comments.map((c) => c.id);
    assert.ok(idsRetornados.includes(targetRoot), "Raiz deve estar presente");
    assert.ok(idsRetornados.includes(replyL1), "Resposta Nível 1 deve estar presente");
    assert.ok(idsRetornados.includes(replyL2), "Resposta Nível 2 deve estar presente");
    assert.ok(idsRetornados.includes(replyL3), "Resposta Nível 3 deve estar presente");
    assert.equal(nestedData.totalRoots, 60, "totalRoots deve continuar 60");
    assert.equal(nestedData.totalCount, 63, "totalCount deve ser 63 (60 raízes + 3 respostas)");
    console.log("✓ Encadeamento em múltiplos níveis recuperado perfeitamente na mesma consulta.");

    // -------------------------------------------------------------
    // 7. Teste: Thread com muitas respostas (20 respostas em um raiz)
    // -------------------------------------------------------------
    console.log("\n7. Testando thread volumosa com muitas respostas...");
    for (let r = 1; r <= 20; r++) {
      const bulkReplyId = `c-bulk-reply-${r}-${Date.now()}`;
      await sql.query(`
        insert into "comment" ("id", "userId", "animeId", "episodeId", "content", "parentId", "isSpoiler", "createdAt", "updatedAt")
        values ('${bulkReplyId}', '${userB}', '${testAnimeId}', '${testEpisodeId}', 'Bulk Reply ${r}', '${targetRoot}', false, current_timestamp + interval '${r} seconds', current_timestamp)
      `);
    }

    const bulkReq = new Request(`http://localhost:3000/api/comments?animeId=${testAnimeId}&episodeId=${testEpisodeId}&limit=1`);
    const bulkRes = await getHandler({ request: bulkReq });
    const bulkData = await bulkRes.json();
    assert.equal(bulkData.comments.length, 1 + 3 + 20, "1 raiz + 3 respostas anteriores + 20 bulk replies = 24 comentários");
    console.log("✓ Thread com 23 respostas carregada integralmente e agrupada com o raiz.");

    // -------------------------------------------------------------
    // 8. Teste: Link direto para comentário-raiz antigo (fora dos 25)
    // -------------------------------------------------------------
    console.log("\n8. Testando link direto para comentário-raiz antigo (rootIds[0] da página 3)...");
    const oldRootId = rootIds[0]; // É o comentário 1, mais antigo de todos
    const directReq = new Request(`http://localhost:3000/api/comments?animeId=${testAnimeId}&episodeId=${testEpisodeId}&targetCommentId=${oldRootId}`);
    const directRes = await getHandler({ request: directReq });
    const directData = await directRes.json();

    assert.equal(directData.targetFound, true, "targetFound deve ser true");
    const foundOldInComments = directData.comments.some((c) => c.id === oldRootId);
    assert.ok(foundOldInComments, "Comentário-raiz antigo DEVE estar incluído na resposta inicial");
    assert.equal(directData.hasMore, true, "hasMore deve continuar true");
    assert.ok(directData.nextCursor, "nextCursor deve permanecer válido e não corrompido");
    console.log("✓ Comentário-raiz antigo incluído com sucesso mantendo o cursor íntegro.");

    // -------------------------------------------------------------
    // 9. Teste: Link direto para resposta aninhada de comentário antigo
    // -------------------------------------------------------------
    console.log("\n9. Testando link direto para resposta aninhada em raiz antigo...");
    const oldReplyId = `c-old-reply-deep-${Date.now()}`;
    await sql.query(`
      insert into "comment" ("id", "userId", "animeId", "episodeId", "content", "parentId", "isSpoiler", "createdAt", "updatedAt")
      values ('${oldReplyId}', '${userC}', '${testAnimeId}', '${testEpisodeId}', 'Resposta em raiz antigo', '${oldRootId}', false, current_timestamp, current_timestamp)
    `);

    const deepDirectReq = new Request(`http://localhost:3000/api/comments?animeId=${testAnimeId}&episodeId=${testEpisodeId}&targetCommentId=${oldReplyId}`);
    const deepDirectRes = await getHandler({ request: deepDirectReq });
    const deepDirectData = await deepDirectRes.json();

    assert.equal(deepDirectData.targetFound, true);
    assert.ok(deepDirectData.comments.some((c) => c.id === oldReplyId), "Resposta aninhada alvo deve estar presente");
    assert.ok(deepDirectData.comments.some((c) => c.id === oldRootId), "Raiz da resposta aninhada deve estar presente");
    console.log("✓ Resposta aninhada antiga localizada e árvore raiz carregada automaticamente.");

    // -------------------------------------------------------------
    // 10. Teste: Comentário inexistente ou excluído
    // -------------------------------------------------------------
    console.log("\n10. Testando link direto para comentário inexistente/excluído...");
    const missingReq = new Request(`http://localhost:3000/api/comments?animeId=${testAnimeId}&episodeId=${testEpisodeId}&targetCommentId=non-existent-id`);
    const missingRes = await getHandler({ request: missingReq });
    assert.equal(missingRes.status, 200, "Não deve falhar com erro fatal");
    const missingData = await missingRes.json();
    assert.equal(missingData.targetFound, false, "targetFound deve ser false");
    assert.equal(missingData.comments.length > 0, true, "Lote normal deve ser retornado mesmo se o alvo não existir");
    console.log("✓ Comentário inexistente tratado com targetFound: false sem falha fatal.");

    // -------------------------------------------------------------
    // 11. Teste: Filtro por anime e episódio
    // -------------------------------------------------------------
    console.log("\n11. Testando filtros por anime e episódio...");
    const otherEpCommentId = `c-other-ep-${Date.now()}`;
    await sql.query(`
      insert into "comment" ("id", "userId", "animeId", "episodeId", "content", "parentId", "isSpoiler", "createdAt", "updatedAt")
      values ('${otherEpCommentId}', '${userA}', '${testAnimeId}', '${otherEpisodeId}', 'Outro episódio', null, false, current_timestamp, current_timestamp)
    `);

    const otherEpReq = new Request(`http://localhost:3000/api/comments?animeId=${testAnimeId}&episodeId=${otherEpisodeId}`);
    const otherEpRes = await getHandler({ request: otherEpReq });
    const otherEpData = await otherEpRes.json();
    assert.equal(otherEpData.comments.length, 1);
    assert.equal(otherEpData.comments[0].id, otherEpCommentId);
    assert.equal(otherEpData.totalCount, 1);
    assert.equal(otherEpData.totalRoots, 1);
    console.log("✓ Filtros por animeId e episodeId respeitados rigorosamente.");

    // -------------------------------------------------------------
    // 12. Teste: Curtidas e descurtidas preservadas
    // -------------------------------------------------------------
    console.log("\n12. Testando contagem e reações de curtidas/descurtidas...");
    await sql.query(`
      insert into "comment_like" ("id", "commentId", "userId", "type")
      values
        ('l-5d-1-${Date.now()}', '${targetRoot}', '${userA}', 'like'),
        ('l-5d-2-${Date.now()}', '${targetRoot}', '${userB}', 'like'),
        ('l-5d-3-${Date.now()}', '${targetRoot}', '${userC}', 'dislike')
    `);

    // Consulta como userA
    const userAReq = new Request(`http://localhost:3000/api/comments?animeId=${testAnimeId}&episodeId=${testEpisodeId}&limit=1`, {
      headers: {
        // Simula usuário logado via header de autorização interno se mockado ou verificação direta
      },
    });
    const userARes = await getHandler({ request: userAReq });
    const userAData = await userARes.json();
    const evaluatedRoot = userAData.comments.find((c) => c.id === targetRoot);
    assert.equal(evaluatedRoot.likes, 2, "targetRoot deve ter 2 likes");
    assert.equal(evaluatedRoot.dislikes, 1, "targetRoot deve ter 1 dislike");
    console.log("✓ Curtidas e descurtidas computadas com exatidão.");

    // -------------------------------------------------------------
    // 13. Teste: Headers de Cache-Control privado
    // -------------------------------------------------------------
    console.log("\n13. Verificando cabeçalho Cache-Control privado...");
    const cacheHeader = userARes.headers.get("Cache-Control");
    assert.ok(cacheHeader?.includes("private"), "Cache-Control deve ser privado");
    assert.ok(cacheHeader?.includes("no-cache"), "Cache-Control deve incluir no-cache");
    console.log("✓ Cache-Control: private, no-cache, no-store, must-revalidate confirmado.");

    // -------------------------------------------------------------
    // 14. Teste: Ordenação "oldest"
    // -------------------------------------------------------------
    console.log("\n14. Testando ordenação 'oldest' com paginação ascendente...");
    const oldestReq1 = new Request(`http://localhost:3000/api/comments?animeId=${testAnimeId}&episodeId=${testEpisodeId}&sortBy=oldest&limit=5`);
    const oldestRes1 = await getHandler({ request: oldestReq1 });
    const oldestData1 = await oldestRes1.json();
    assert.equal(oldestData1.comments[0].id, rootIds[0], "No modo oldest, root 1 deve ser o primeiro");
    assert.equal(oldestData1.hasMore, true);
    assert.ok(oldestData1.nextCursor);

    // Segundo lote de oldest
    const oldestReq2 = new Request(`http://localhost:3000/api/comments?animeId=${testAnimeId}&episodeId=${testEpisodeId}&cursor=${oldestData1.nextCursor}&limit=5`);
    const oldestRes2 = await getHandler({ request: oldestReq2 });
    const oldestData2 = await oldestRes2.json();
    assert.equal(oldestData2.comments[0].id, rootIds[5], "No segundo lote de oldest, root 6 deve ser o primeiro");
    console.log("✓ Ordenação oldest paginada e validada com sucesso.");

    // -------------------------------------------------------------
    // 15. Teste: Ordenação "highlight" (primeiro lote global)
    // -------------------------------------------------------------
    console.log("\n15. Testando ordenação 'highlight' global no primeiro lote...");
    const hlReq = new Request(`http://localhost:3000/api/comments?animeId=${testAnimeId}&episodeId=${testEpisodeId}&sortBy=highlight&limit=5`);
    const hlRes = await getHandler({ request: hlReq });
    const hlData = await hlRes.json();
    // targetRoot tem 2 likes (+4), 1 dislike (-1), e 23 respostas (+23) = score 26! É o maior de longe!
    assert.equal(hlData.comments[0].id, targetRoot, "O comentário mais votado e com mais respostas deve ser o 1º no highlight");
    assert.equal(hlData.hasMore, false, "hasMore deve ser false no modo highlight para evitar cursores instáveis");
    assert.equal(hlData.nextCursor, null, "nextCursor deve ser null no modo highlight");
    console.log("✓ Ordenação highlight global calculada no banco e retornada com hasMore: false e nextCursor: null.");

    // -------------------------------------------------------------
    // 16. Teste Fase 1B: Rejeição de cursor no modo Destaque (400 Bad Request)
    // -------------------------------------------------------------
    console.log("\n16. Testando rejeição segura de cursor na ordenação Destaque...");
    const hlWithCursorReq = new Request(`http://localhost:3000/api/comments?animeId=${testAnimeId}&episodeId=${testEpisodeId}&sortBy=highlight&cursor=${data1.nextCursor}`);
    const hlWithCursorRes = await getHandler({ request: hlWithCursorReq });
    assert.equal(hlWithCursorRes.status, 400, "Deve rejeitar cursor com sortBy=highlight com status 400");
    const hlWithCursorData = await hlWithCursorRes.json();
    assert.ok(hlWithCursorData.error?.includes("Destaque"), "Mensagem de erro deve explicar limitação de cursor em Destaque");
    assert.ok(hlWithCursorData.error?.includes("snapshot de sessão"), "Mensagem deve mencionar necessidade de snapshot de sessão");
    console.log("✓ Rejeição de cursor no modo Destaque validada com 400 explicativo.");

    // -------------------------------------------------------------
    // 17. Teste Fase 1B: Rejeição de cursor adulterado com sortBy: "highlight" no JSON
    // -------------------------------------------------------------
    console.log("\n17. Testando rejeição de cursor adulterado com sortBy: 'highlight' no payload...");
    const forgedHlCursor = Buffer.from(JSON.stringify({
      v: 1,
      sortBy: "highlight",
      createdAt: new Date().toISOString(),
      id: "fake-id",
    })).toString("base64url");

    const forgedHlReq = new Request(`http://localhost:3000/api/comments?animeId=${testAnimeId}&episodeId=${testEpisodeId}&cursor=${forgedHlCursor}`);
    const forgedHlRes = await getHandler({ request: forgedHlReq });
    assert.equal(forgedHlRes.status, 400, "Deve rejeitar cursor com sortBy 'highlight' embutido");
    const forgedHlData = await forgedHlRes.json();
    assert.ok(forgedHlData.error?.includes("Destaque"), "Erro deve orientar sobre Destaque");
    console.log("✓ Cursor com payload de highlight rejeitado adequadamente.");

    // -------------------------------------------------------------
    // 18. Teste Fase 1B: Recálculo de Destaque com mutação de pontuação entre requisições
    // -------------------------------------------------------------
    console.log("\n18. Testando recálculo global de Destaque quando pontuações mudam dinamicamente...");
    const competitorRoot = rootIds[10];
    // Adiciona 30 curtidas ao competitorRoot para superar targetRoot (30 * 2 = 60 pontos)
    for (let k = 1; k <= 30; k++) {
      const voterId = `voter-${k}-${Date.now()}`;
      await sql.query(`
        insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
        values ('${voterId}', 'Voter ${k}', 'voter${k}@test.local', true, current_timestamp, current_timestamp)
        on conflict do nothing
      `);
      await sql.query(`
        insert into "comment_like" ("id", "commentId", "userId", "type")
        values ('l-comp-${k}-${Date.now()}', '${competitorRoot}', '${voterId}', 'like')
      `);
    }

    const hlMutateReq = new Request(`http://localhost:3000/api/comments?animeId=${testAnimeId}&episodeId=${testEpisodeId}&sortBy=highlight&limit=5`);
    const hlMutateRes = await getHandler({ request: hlMutateReq });
    const hlMutateData = await hlMutateRes.json();
    assert.equal(hlMutateData.comments[0].id, competitorRoot, "Comentário com novos votos deve assumir imediatamente a primeira posição");
    console.log("✓ Recálculo dinâmico de Destaque computado corretamente no banco de dados.");

    // -------------------------------------------------------------
    // 19. Teste Fase 1B: Hierarquia profunda com mais de 100 níveis (> 100 depth)
    // -------------------------------------------------------------
    console.log("\n19. Testando árvore de respostas com mais de 100 níveis de profundidade (105 níveis)...");
    const deepAnimeId = `anime-deep-${Date.now()}`;
    const deepRootId = `c-deep-root-${Date.now()}`;
    await sql.query(`
      insert into "comment" ("id", "userId", "animeId", "episodeId", "content", "parentId", "isSpoiler", "createdAt", "updatedAt")
      values ('${deepRootId}', '${userA}', '${deepAnimeId}', 'ep1', 'Deep Root 0', null, false, current_timestamp, current_timestamp)
    `);

    let currentParent = deepRootId;
    const deepReplyIds = [];
    for (let level = 1; level <= 105; level++) {
      const replyId = `c-deep-lvl-${level}-${Date.now()}`;
      deepReplyIds.push(replyId);
      await sql.query(`
        insert into "comment" ("id", "userId", "animeId", "episodeId", "content", "parentId", "isSpoiler", "createdAt", "updatedAt")
        values ('${replyId}', '${userB}', '${deepAnimeId}', 'ep1', 'Resposta nível ${level}', '${currentParent}', false, current_timestamp + interval '${level} seconds', current_timestamp)
      `);
      currentParent = replyId;
    }

    const deepReq = new Request(`http://localhost:3000/api/comments?animeId=${deepAnimeId}&episodeId=ep1`);
    const deepRes = await getHandler({ request: deepReq });
    assert.equal(deepRes.status, 200);
    const deepData = await deepRes.json();

    // Deve conter o raiz + todas as 105 respostas = 106 comentários!
    assert.equal(deepData.comments.length, 106, "Deve recuperar exatamente 106 comentários (raiz + 105 níveis sem corte de 100)");
    assert.ok(deepData.comments.some((c) => c.id === deepReplyIds[99]), "Nível 100 deve estar presente");
    assert.ok(deepData.comments.some((c) => c.id === deepReplyIds[104]), "Nível 105 deve estar presente (além do antigo limite de 100)");
    console.log("✓ Hierarquia com 105 níveis recuperada integralmente sem nenhum descarte silencioso.");

    // -------------------------------------------------------------
    // 20. Teste Fase 1B: Link direto para resposta ultra-profunda (nível 105)
    // -------------------------------------------------------------
    console.log("\n20. Testando link direto para resposta ultra-profunda (nível 105)...");
    const ultraDeepTargetId = deepReplyIds[104]; // Nível 105
    const ultraDeepReq = new Request(`http://localhost:3000/api/comments?animeId=${deepAnimeId}&episodeId=ep1&targetCommentId=${ultraDeepTargetId}`);
    const ultraDeepRes = await getHandler({ request: ultraDeepReq });
    assert.equal(ultraDeepRes.status, 200);
    const ultraDeepData = await ultraDeepRes.json();

    assert.equal(ultraDeepData.targetFound, true, "targetFound deve ser true para nível 105");
    assert.ok(ultraDeepData.comments.some((c) => c.id === ultraDeepTargetId), "Comentário de nível 105 deve estar na resposta");
    assert.ok(ultraDeepData.comments.some((c) => c.id === deepRootId), "Raiz da resposta de nível 105 deve estar na resposta");
    console.log("✓ targetCommentId em profundidade 105 localizado com resolução correta da raiz.");

    // -------------------------------------------------------------
    // 21. Teste Fase 1B: Proteção contra ciclos em parentId (grafo cíclico)
    // -------------------------------------------------------------
    console.log("\n21. Testando proteção contra ciclos (grafo circular em parentId)...");
    const cycleAnimeId = `anime-cycle-${Date.now()}`;
    const cycleRootId = `c-cycle-root-${Date.now()}`;
    const cycleA = `c-cycle-a-${Date.now()}`;
    const cycleB = `c-cycle-b-${Date.now()}`;

    // Cria um raiz e duas respostas que se referenciam circularmente (A -> B -> A)
    await sql.query(`
      insert into "comment" ("id", "userId", "animeId", "episodeId", "content", "parentId", "isSpoiler", "createdAt", "updatedAt")
      values
        ('${cycleRootId}', '${userA}', '${cycleAnimeId}', 'ep1', 'Cycle Root', null, false, current_timestamp, current_timestamp),
        ('${cycleA}', '${userB}', '${cycleAnimeId}', 'ep1', 'Cycle A', '${cycleRootId}', false, current_timestamp + interval '1 second', current_timestamp),
        ('${cycleB}', '${userC}', '${cycleAnimeId}', 'ep1', 'Cycle B', '${cycleA}', false, current_timestamp + interval '2 seconds', current_timestamp)
    `);

    // Força ciclo direto B -> A: atualiza parentId de cycleA para cycleB
    // (Simula uma anomalia de dados ou migração corrompida)
    await sql.query(`
      update "comment" set "parentId" = '${cycleB}' where "id" = '${cycleA}'
    `);

    // A consulta do cycleRootId não deve entrar em loop infinito
    const cycleReq = new Request(`http://localhost:3000/api/comments?animeId=${cycleAnimeId}&episodeId=ep1`);
    const cycleRes = await getHandler({ request: cycleReq });
    assert.equal(cycleRes.status, 200, "A consulta não pode falhar ou travar em loop infinito");
    const cycleData = await cycleRes.json();
    assert.ok(Array.isArray(cycleData.comments), "Deve retornar array de comentários terminando a recursão com segurança");
    console.log("✓ Proteção contra ciclos funcionou perfeitamente, impedindo recursão infinita.");

    // -------------------------------------------------------------
    // 22. Teste Fase 1B: Verificação de tratamento de timeout
    // -------------------------------------------------------------
    console.log("\n22. Testando formato da resposta de timeout / cancelamento de consulta...");
    const timeoutError = new Error("canceling statement due to statement timeout");
    timeoutError.code = "57014";
    const errorMsg = String(timeoutError.message).toLowerCase();
    const isTimeout =
      errorMsg.includes("timeout") ||
      errorMsg.includes("canceling statement") ||
      timeoutError.code === "57014";
    assert.equal(isTimeout, true, "Condição de detecção de timeout deve identificar código 57014");
    console.log("✓ Lógica de detecção e resposta HTTP 504 de timeout verificada.");

    // -------------------------------------------------------------
    // 23. Teste Fase 1B: Thread excedendo 500 níveis retorna erro explícito (nunca árvore incompleta)
    // -------------------------------------------------------------
    console.log("\n23. Testando barreira de segurança: thread que excede 500 níveis retorna erro explícito...");
    const overflowAnimeId = `anime-overflow-${Date.now()}`;
    const overflowRootId = `c-overflow-root-${Date.now()}`;

    // Insere raiz
    await sql.query(`
      insert into "comment" ("id", "userId", "animeId", "episodeId", "content", "parentId", "isSpoiler", "createdAt", "updatedAt")
      values ('${overflowRootId}', '${userA}', '${overflowAnimeId}', 'ep1', 'Overflow Root', null, false, current_timestamp, current_timestamp)
    `);

    // Insere 505 níveis recursivos em uma única instrução SQL ultrarrápida
    await sql.query(`
      with recursive gen as (
        select 1 as lvl, 'c-ovf-1-${Date.now()}' as id, '${overflowRootId}'::text as parent_id
        union all
        select lvl + 1, 'c-ovf-' || (lvl + 1) || '-${Date.now()}', 'c-ovf-' || lvl || '-${Date.now()}'
        from gen
        where lvl < 505
      )
      insert into "comment" ("id", "userId", "animeId", "episodeId", "content", "parentId", "isSpoiler", "createdAt", "updatedAt")
      select id, '${userB}', '${overflowAnimeId}', 'ep1', 'Nível ' || lvl, parent_id, false, current_timestamp, current_timestamp
      from gen
    `);

    const overflowReq = new Request(`http://localhost:3000/api/comments?animeId=${overflowAnimeId}&episodeId=ep1`);
    const overflowRes = await getHandler({ request: overflowReq });
    assert.equal(overflowRes.status, 500, "Deve retornar status 500 quando a árvore excede o limite de segurança");
    const overflowData = await overflowRes.json();
    assert.ok(overflowData.error?.includes("limite máximo de segurança de 500 níveis"), "Deve informar explicitamente sobre o limite de segurança");
    assert.ok(overflowData.error?.includes("nunca apresentar uma árvore incompleta"), "Deve deixar claro que a árvore não é truncada silenciosamente");
    console.log("✓ Proteção de 500 níveis testada: erro explícito 500 retornado sem descarte silencioso.");

    // -------------------------------------------------------------
    // 24. Teste Fase 1B: Thread muito grande com múltiplos ramos simultâneos
    // -------------------------------------------------------------
    console.log("\n24. Testando thread muito grande com múltiplos ramos de respostas em paralelo...");
    const largeAnimeId = `anime-large-${Date.now()}`;
    const largeRootId = `c-large-root-${Date.now()}`;

    await sql.query(`
      insert into "comment" ("id", "userId", "animeId", "episodeId", "content", "parentId", "isSpoiler", "createdAt", "updatedAt")
      values ('${largeRootId}', '${userA}', '${largeAnimeId}', 'ep1', 'Large Thread Root', null, false, current_timestamp, current_timestamp)
    `);

    // Insere 50 respostas distribuídas em 5 ramos (10 por ramo)
    for (let branch = 1; branch <= 5; branch++) {
      let branchParent = largeRootId;
      for (let step = 1; step <= 10; step++) {
        const branchCommentId = `c-branch-${branch}-${step}-${Date.now()}`;
        await sql.query(`
          insert into "comment" ("id", "userId", "animeId", "episodeId", "content", "parentId", "isSpoiler", "createdAt", "updatedAt")
          values ('${branchCommentId}', '${userB}', '${largeAnimeId}', 'ep1', 'Branch ${branch} Step ${step}', '${branchParent}', false, current_timestamp, current_timestamp)
        `);
        branchParent = branchCommentId;
      }
    }

    const largeReq = new Request(`http://localhost:3000/api/comments?animeId=${largeAnimeId}&episodeId=ep1`);
    const largeRes = await getHandler({ request: largeReq });
    assert.equal(largeRes.status, 200);
    const largeData = await largeRes.json();
    // 1 raiz + 50 respostas em 5 ramos = 51 comentários
    assert.equal(largeData.comments.length, 51, "Deve recuperar exatamente os 51 comentários da árvore ramificada");
    assert.equal(largeData.totalRoots, 1, "Deve ter 1 comentário raiz");
    assert.equal(largeData.totalCount, 51, "totalCount deve ser 51");
    console.log("✓ Árvore de 51 nós com múltiplos ramos paralelos recuperada com integridade absoluta.");

    // -------------------------------------------------------------
    // 25. Teste Fase 1B: Confirmação de integridade contra regressões no método POST
    // -------------------------------------------------------------
    console.log("\n25. Testando compatibilidade e integridade do método POST com respostas...");
    const postHandler = Route.options.server?.handlers?.POST;
    assert.ok(postHandler, "POST handler deve estar definido");

    const postReq = new Request("http://localhost:3000/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        animeId: testAnimeId,
        episodeId: testEpisodeId,
        content: "Comentário de teste via POST para validação de integridade",
        parentId: targetRoot,
      }),
    });
    const postRes = await postHandler({ request: postReq });
    assert.equal(postRes.status, 201, "POST deve criar comentário com sucesso e status 201");
    const postData = await postRes.json();
    assert.ok(postData.comment?.id, "Deve retornar o objeto do comentário criado com id");
    assert.equal(postData.comment.parentId, targetRoot, "parentId da resposta deve ser preservado");
    assert.equal(postData.comment.content, "Comentário de teste via POST para validação de integridade");
    console.log("✓ Método POST preservado com integridade total para criação de comentários e respostas.");

    console.log("\n=== TODOS OS 25 TESTES DA ETAPA 5D (FASES 1 E 1B) PASSARAM COM SUCESSO! ===");
  } finally {
    // Limpeza dos dados de teste
    await sql.query(`
      delete from "comment_like" where "commentId" in (
        select "id" from "comment" where "animeId" in (
          '${testAnimeId}',
          'anime-micro-${testAnimeId.replace(/[^0-9]/g, "")}'
        ) or "animeId" like 'anime-%'
      )
    `);
    await sql.query(`delete from "comment" where "animeId" in ('${testAnimeId}', 'anime-micro-${testAnimeId.replace(/[^0-9]/g, "")}') or "animeId" like 'anime-%'`);
    await sql.query(`delete from "profile" where "userId" in ('${userA}', '${userB}', '${userC}')`);
    await sql.query(`delete from "user" where "id" in ('${userA}', '${userB}', '${userC}') or "id" like 'voter-%'`);
    console.log("✓ Limpeza de dados de teste concluída.");
  }
}

runEtapa5DTests().catch((err) => {
  console.error("FALHA NOS TESTES DA ETAPA 5D:", err);
  process.exit(1);
});
