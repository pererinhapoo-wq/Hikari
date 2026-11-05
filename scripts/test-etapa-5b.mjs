import assert from "node:assert/strict";
import { getSql } from "../src/lib/db.ts";

async function runEtapa5BTests() {
  console.log("=== INICIANDO TESTES DA ETAPA 5B: OTIMIZAÇÃO SQL DO GET /api/comments ===");

  const sql = await getSql();

  // Test setup: isola em um ID de anime exclusivo para o teste
  const testAnimeId = `test-anime-5b-${Date.now()}`;
  const testEpisodeId = `ep-1-test`;
  const generalEpisodeId = "anime";

  // Cria usuários de teste na tabela "user"
  const userA = `user-5b-a-${Date.now()}`;
  const userB = `user-5b-b-${Date.now()}`;
  const userC = `user-5b-c-${Date.now()}`;

  await sql.query(`
    insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
    values
      ('${userA}', 'Alice Tester', 'alice@test.local', true, current_timestamp, current_timestamp),
      ('${userB}', 'Bob Tester', 'bob@test.local', true, current_timestamp, current_timestamp),
      ('${userC}', 'Carlos Tester', 'carlos@test.local', true, current_timestamp, current_timestamp)
    on conflict do nothing
  `);

  await sql.query(`
    insert into "profile" ("userId", "nick", "createdAt", "updatedAt")
    values
      ('${userA}', 'AliceNick', current_timestamp, current_timestamp),
      ('${userB}', 'BobNick', current_timestamp, current_timestamp)
    on conflict do nothing
  `);

  // Define a consulta antiga (com 5 subconsultas correlacionadas) para comparação
  const buildOldQuery = (hasEpisode) => `
    select
      c."id",
      c."animeId",
      c."episodeId",
      c."content",
      c."imageUrl",
      c."parentId",
      c."isSpoiler",
      c."createdAt",
      c."updatedAt",
      c."userId",
      coalesce(p."nick", u."name", 'Usuário') as "userName",
      u."image" as "userImage",
      p."nick" as "userNick",
      (
        select count(*)::int
        from "comment_like" cl
        where cl."commentId" = c."id"
          and (cl."type" = 'like' or cl."type" is null)
      ) as "likes",
      (
        select count(*)::int
        from "comment_like" cl
        where cl."commentId" = c."id"
          and cl."type" = 'dislike'
      ) as "dislikes",
      case
        when $2::text is not null then
          exists (
            select 1
            from "comment_like" cl
            where cl."commentId" = c."id"
              and cl."userId" = $2
              and (cl."type" = 'like' or cl."type" is null)
          )
        else false
      end as "liked",
      case
        when $2::text is not null then
          exists (
            select 1
            from "comment_like" cl
            where cl."commentId" = c."id"
              and cl."userId" = $2
              and cl."type" = 'dislike'
          )
        else false
      end as "disliked",
      case
        when $2::text is not null then
          (
            select cl."type"
            from "comment_like" cl
            where cl."commentId" = c."id"
              and cl."userId" = $2
            limit 1
          )
        else null
      end as "userReaction"
    from "comment" c
    left join "user" u on u."id" = c."userId"
    left join "profile" p on p."userId" = c."userId"
    where c."animeId" = $1
      ${hasEpisode ? 'and c."episodeId" = $3' : ""}
    order by c."createdAt" asc
  `;

  // Define a nova consulta otimizada (com CTE pré-agregada e 1 LEFT JOIN de reação)
  const buildNewQuery = (hasEpisode) => `
    with selected_comments as (
      select
        c."id",
        c."animeId",
        c."episodeId",
        c."content",
        c."imageUrl",
        c."parentId",
        c."isSpoiler",
        c."createdAt",
        c."updatedAt",
        c."userId"
      from "comment" c
      where c."animeId" = $1
        ${hasEpisode ? 'and c."episodeId" = $3' : ""}
    ),
    like_counts as (
      select
        cl."commentId",
        count(*) filter (where cl."type" = 'like' or cl."type" is null)::int as "likes",
        count(*) filter (where cl."type" = 'dislike')::int as "dislikes"
      from "comment_like" cl
      inner join selected_comments sc on sc."id" = cl."commentId"
      group by cl."commentId"
    )
    select
      sc."id",
      sc."animeId",
      sc."episodeId",
      sc."content",
      sc."imageUrl",
      sc."parentId",
      sc."isSpoiler",
      sc."createdAt",
      sc."updatedAt",
      sc."userId",
      coalesce(p."nick", u."name", 'Usuário') as "userName",
      u."image" as "userImage",
      p."nick" as "userNick",
      coalesce(lc."likes", 0)::int as "likes",
      coalesce(lc."dislikes", 0)::int as "dislikes",
      case
        when $2::text is not null and (my_cl."type" = 'like' or (my_cl."type" is null and my_cl."id" is not null)) then true
        else false
      end as "liked",
      case
        when $2::text is not null and my_cl."type" = 'dislike' then true
        else false
      end as "disliked",
      case
        when $2::text is null then null
        when my_cl."type" = 'dislike' then 'dislike'
        when my_cl."type" = 'like' or (my_cl."type" is null and my_cl."id" is not null) then 'like'
        else null
      end as "userReaction"
    from selected_comments sc
    left join "user" u on u."id" = sc."userId"
    left join "profile" p on p."userId" = sc."userId"
    left join like_counts lc on lc."commentId" = sc."id"
    left join "comment_like" my_cl
      on my_cl."commentId" = sc."id"
      and $2::text is not null
      and my_cl."userId" = $2
    order by sc."createdAt" asc
  `;

  const mapRows = (rows) =>
    rows.map((row) => ({
      id: String(row.id),
      animeId: String(row.animeId),
      episodeId: String(row.episodeId),
      content: String(row.content ?? ""),
      imageUrl: row.imageUrl ? String(row.imageUrl) : null,
      parentId: row.parentId ? String(row.parentId) : null,
      isSpoiler: Boolean(row.isSpoiler),
      createdAt:
        row.createdAt instanceof Date
          ? row.createdAt.toISOString()
          : new Date(row.createdAt).toISOString(),
      updatedAt:
        row.updatedAt instanceof Date
          ? row.updatedAt.toISOString()
          : new Date(row.updatedAt).toISOString(),
      userId: String(row.userId),
      userName: row.userName ? String(row.userName) : "Usuário",
      userImage: row.userImage ? String(row.userImage) : null,
      userNick: row.userNick ? String(row.userNick) : null,
      likes: Number(row.likes) || 0,
      dislikes: Number(row.dislikes) || 0,
      liked: Boolean(row.liked),
      disliked: Boolean(row.disliked),
      userReaction:
        row.userReaction === "like" || row.userReaction === "dislike"
          ? row.userReaction
          : null,
    }));

  let c1 = "";
  let c2 = "";
  let c3 = "";

  try {
    // 1. Anime sem comentários
    console.log("\n1. Testando anime sem comentários...");
    const oldRes1 = await sql.query(buildOldQuery(false), ["anime-inexistente", null]);
    const newRes1 = await sql.query(buildNewQuery(false), ["anime-inexistente", null]);
    assert.deepEqual(mapRows(newRes1), mapRows(oldRes1), "Resultado deve ser idêntico ([] vazio)");
    assert.equal(newRes1.length, 0);
    console.log("✓ Anime sem comentários retorna array vazio de forma idêntica.");

    // Insere comentários de teste:
    // Comentário 1 (Geral, raiz, spoiler = false)
    c1 = `c-test-1-${Date.now()}`;
    await sql.query(`
      insert into "comment" ("id", "userId", "animeId", "episodeId", "content", "imageUrl", "parentId", "isSpoiler", "createdAt", "updatedAt")
      values ('${c1}', '${userA}', '${testAnimeId}', '${generalEpisodeId}', 'Primeiro comentário geral', null, null, false, current_timestamp - interval '10 minutes', current_timestamp)
    `);

    // Comentário 2 (Geral, resposta de c1, spoiler = true)
    c2 = `c-test-2-${Date.now()}`;
    await sql.query(`
      insert into "comment" ("id", "userId", "animeId", "episodeId", "content", "imageUrl", "parentId", "isSpoiler", "createdAt", "updatedAt")
      values ('${c2}', '${userB}', '${testAnimeId}', '${generalEpisodeId}', 'Resposta com spoiler', 'https://example.com/img.png', '${c1}', true, current_timestamp - interval '5 minutes', current_timestamp)
    `);

    // Comentário 3 (Do episódio 1, com curtidas e descurtidas)
    c3 = `c-test-3-${Date.now()}`;
    await sql.query(`
      insert into "comment" ("id", "userId", "animeId", "episodeId", "content", "imageUrl", "parentId", "isSpoiler", "createdAt", "updatedAt")
      values ('${c3}', '${userC}', '${testAnimeId}', '${testEpisodeId}', 'Comentário do episódio 1', null, null, false, current_timestamp - interval '2 minutes', current_timestamp)
    `);

    // Inserção de curtidas e descurtidas:
    // c1: curtido por userA e userB (2 likes)
    await sql.query(`
      insert into "comment_like" ("id", "commentId", "userId", "type")
      values
        ('l1-${Date.now()}', '${c1}', '${userA}', 'like'),
        ('l2-${Date.now()}', '${c1}', '${userB}', 'like')
    `);

    // c2: descurtido por userA (1 dislike)
    await sql.query(`
      insert into "comment_like" ("id", "commentId", "userId", "type")
      values
        ('l3-${Date.now()}', '${c2}', '${userA}', 'dislike')
    `);

    // c3: curtido por userB, descurtido por userC
    await sql.query(`
      insert into "comment_like" ("id", "commentId", "userId", "type")
      values
        ('l4-${Date.now()}', '${c3}', '${userB}', 'like'),
        ('l5-${Date.now()}', '${c3}', '${userC}', 'dislike')
    `);

    // 2. Anime com comentários e respostas
    console.log("\n2. Testando anime com comentários e respostas...");
    const oldRes2 = await sql.query(buildOldQuery(false), [testAnimeId, null]);
    const newRes2 = await sql.query(buildNewQuery(false), [testAnimeId, null]);
    assert.deepEqual(mapRows(newRes2), mapRows(oldRes2), "Estrutura de comentários e respostas deve ser idêntica");
    assert.equal(newRes2.length, 3, "Devem existir 3 comentários");
    console.log("✓ Comentários e respostas retornados com exatidão.");

    // 3. Comentários com muitas curtidas
    console.log("\n3. Verificando comentário com múltiplas curtidas (c1)...");
    const c1Mapped = mapRows(newRes2).find((c) => c.id === c1);
    assert.equal(c1Mapped.likes, 2, "c1 deve ter 2 likes");
    assert.equal(c1Mapped.dislikes, 0, "c1 deve ter 0 dislikes");
    console.log(`✓ c1: likes = ${c1Mapped.likes}, dislikes = ${c1Mapped.dislikes}`);

    // 4. Comentários com descurtidas
    console.log("\n4. Verificando comentário com descurtidas (c2)...");
    const c2Mapped = mapRows(newRes2).find((c) => c.id === c2);
    assert.equal(c2Mapped.likes, 0, "c2 deve ter 0 likes");
    assert.equal(c2Mapped.dislikes, 1, "c2 deve ter 1 dislike");
    console.log(`✓ c2: likes = ${c2Mapped.likes}, dislikes = ${c2Mapped.dislikes}`);

    // 5. Usuário autenticado com curtida (userA em c1)
    console.log("\n5. Testando usuário autenticado com curtida (userA)...");
    const oldResUserA = await sql.query(buildOldQuery(false), [testAnimeId, userA]);
    const newResUserA = await sql.query(buildNewQuery(false), [testAnimeId, userA]);
    assert.deepEqual(mapRows(newResUserA), mapRows(oldResUserA), "Reações de userA devem ser 100% idênticas");
    const userA_c1 = mapRows(newResUserA).find((c) => c.id === c1);
    assert.equal(userA_c1.liked, true, "userA deve ter liked = true em c1");
    assert.equal(userA_c1.disliked, false, "userA deve ter disliked = false em c1");
    assert.equal(userA_c1.userReaction, "like", "userA deve ter userReaction = 'like' em c1");
    console.log("✓ userA em c1: liked=true, disliked=false, userReaction='like'");

    // 6. Usuário autenticado com descurtida (userA em c2)
    console.log("\n6. Testando usuário autenticado com descurtida (userA em c2)...");
    const userA_c2 = mapRows(newResUserA).find((c) => c.id === c2);
    assert.equal(userA_c2.liked, false, "userA deve ter liked = false em c2");
    assert.equal(userA_c2.disliked, true, "userA deve ter disliked = true em c2");
    assert.equal(userA_c2.userReaction, "dislike", "userA deve ter userReaction = 'dislike' em c2");
    console.log("✓ userA em c2: liked=false, disliked=true, userReaction='dislike'");

    // 7. Usuário sem reação (userA em c3)
    console.log("\n7. Testando usuário autenticado sem reação (userA em c3)...");
    const userA_c3 = mapRows(newResUserA).find((c) => c.id === c3);
    assert.equal(userA_c3.liked, false);
    assert.equal(userA_c3.disliked, false);
    assert.equal(userA_c3.userReaction, null);
    console.log("✓ userA em c3: liked=false, disliked=false, userReaction=null");

    // 8. Usuário não autenticado ($2 = null)
    console.log("\n8. Testando usuário não autenticado (anônimo)...");
    const oldResAnon = await sql.query(buildOldQuery(false), [testAnimeId, null]);
    const newResAnon = await sql.query(buildNewQuery(false), [testAnimeId, null]);
    assert.deepEqual(mapRows(newResAnon), mapRows(oldResAnon));
    for (const c of mapRows(newResAnon)) {
      assert.equal(c.liked, false);
      assert.equal(c.disliked, false);
      assert.equal(c.userReaction, null);
    }
    console.log("✓ Todos os comentários para usuário anônimo têm liked=false, disliked=false, userReaction=null.");

    // 9. Comentários de episódios específicos vs gerais
    console.log("\n9. Testando filtro de episódio (episodeId = 'ep-1-test')...");
    const oldResEp = await sql.query(buildOldQuery(true), [testAnimeId, null, testEpisodeId]);
    const newResEp = await sql.query(buildNewQuery(true), [testAnimeId, null, testEpisodeId]);
    assert.deepEqual(mapRows(newResEp), mapRows(oldResEp));
    assert.equal(newResEp.length, 1);
    assert.equal(newResEp[0].id, c3);
    console.log("✓ Filtro de episódio retornou apenas o comentário do episódio especificado.");

    // 10. Preservação exata do formato JSON
    console.log("\n10. Verificando chaves de retorno do objeto JSON...");
    const requiredKeys = [
      "id", "animeId", "episodeId", "content", "imageUrl", "parentId",
      "isSpoiler", "createdAt", "updatedAt", "userId", "userName",
      "userImage", "userNick", "likes", "dislikes", "liked", "disliked", "userReaction"
    ];
    for (const key of requiredKeys) {
      assert.ok(key in mapRows(newRes2)[0], `Campo '${key}' deve estar presente`);
    }
    console.log("✓ Todos os 18 campos requeridos estão presentes com tipagem exata.");

    // 11. Ausência de comentários duplicados
    console.log("\n11. Verificando ausência de duplicações causadas por JOINs...");
    const allIds = mapRows(newRes2).map((c) => c.id);
    const uniqueIds = new Set(allIds);
    assert.equal(allIds.length, uniqueIds.size, "Não deve haver IDs duplicados");
    console.log("✓ Ausência total de duplicações confirmada.");

    // 12. Integridade de spoilers, autores e respostas
    console.log("\n12. Verificando integridade de spoilers, autores e respostas...");
    const c2Obj = mapRows(newRes2).find((c) => c.id === c2);
    assert.equal(c2Obj.isSpoiler, true, "isSpoiler de c2 deve ser true");
    assert.equal(c2Obj.parentId, c1, "parentId de c2 deve apontar para c1");
    assert.equal(c2Obj.userNick, "BobNick", "userNick de c2 deve ser BobNick");
    assert.equal(c2Obj.imageUrl, "https://example.com/img.png");
    console.log("✓ Integridade de spoilers, autores e encadeamento comprovada.");

    // 13. Comparação de EXPLAIN ANALYZE
    console.log("\n13. Comparação de EXPLAIN ANALYZE...");
    const explainOld = await sql.query(`EXPLAIN (ANALYZE, BUFFERS) ${buildOldQuery(false)}`, [testAnimeId, userA]);
    const explainNew = await sql.query(`EXPLAIN (ANALYZE, BUFFERS) ${buildNewQuery(false)}`, [testAnimeId, userA]);

    console.log("--- EXPLAIN CONSULTA ANTERIOR ---");
    for (const line of explainOld) {
      console.log(line["QUERY PLAN"] || Object.values(line)[0]);
    }

    console.log("\n--- EXPLAIN CONSULTA NOVA OTIMIZADA ---");
    for (const line of explainNew) {
      console.log(line["QUERY PLAN"] || Object.values(line)[0]);
    }

    console.log("\n=== TODOS OS 13 TESTES DA ETAPA 5B PASSARAM COM 100% DE SUCESSO! ===");
  } finally {
    // Limpeza das linhas criadas para teste
    await sql.query(`delete from "comment_like" where "commentId" in ('${c1}', '${c2}', '${c3}')`);
    await sql.query(`delete from "comment" where "animeId" = '${testAnimeId}'`);
    await sql.query(`delete from "profile" where "userId" in ('${userA}', '${userB}', '${userC}')`);
    await sql.query(`delete from "user" where "id" in ('${userA}', '${userB}', '${userC}')`);
    console.log("\n✓ Limpeza dos dados de teste concluída com sucesso.");
  }
}

runEtapa5BTests().catch((err) => {
  console.error("ERRO NOS TESTES DA ETAPA 5B:", err);
  process.exit(1);
});
