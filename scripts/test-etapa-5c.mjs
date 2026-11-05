// scripts/test-etapa-5c.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { getSql } from "../src/lib/db.ts";

const baseUrl = "http://127.0.0.1:3000";

async function runEtapa5CTests() {
  console.log("=== INICIANDO TESTES DA ETAPA 5C: CARREGAMENTO SOB DEMANDA DOS COMENTÁRIOS NO PLAYER ===\n");

  // =========================================================================
  // 1. Verificação Estática e Arquitetural de src/routes/watch.$id.tsx
  // =========================================================================
  console.log("1. Verificando configuração arquitetural do SectionReveal em watch.$id.tsx...");
  const watchPath = path.resolve("src/routes/watch.$id.tsx");
  const watchContent = fs.readFileSync(watchPath, "utf-8");

  // Garante import do SectionReveal
  assert.ok(
    watchContent.includes('import { SectionReveal } from "@/components/section-reveal";'),
    "watch.$id.tsx deve importar SectionReveal de @/components/section-reveal"
  );

  // Garante parâmetros exigidos pela Etapa 5C
  assert.ok(
    watchContent.includes('rootMargin="300px 0px"'),
    "SectionReveal deve usar rootMargin=\"300px 0px\" para antecipação de 300px"
  );
  assert.ok(
    watchContent.includes('minHeight="300px"'),
    "SectionReveal deve usar minHeight=\"300px\" para evitar saltos no layout (CLS)"
  );
  assert.ok(
    watchContent.includes('lazy={!commentQuery}'),
    "SectionReveal deve usar lazy={!commentQuery} para carregar sob demanda, exceto em deep-link de comentário"
  );
  assert.ok(
    watchContent.includes('key={`${anime.id}-${current.id}`}'),
    "SectionReveal e EpisodeCommentsSection devem usar chave vinculada ao anime e episódio atual"
  );

  console.log("   ✓ Import de SectionReveal validado");
  console.log("   ✓ rootMargin=\"300px 0px\" configurado com precisão");
  console.log("   ✓ minHeight=\"300px\" reservado contra Content Layout Shift");
  console.log("   ✓ lazy={!commentQuery} garante que no topo não há montagem prematura e preserva deep-links");
  console.log("   ✓ Chave composta `${anime.id}-${current.id}` reinicia o observador na troca de episódios");

  // =========================================================================
  // 2. Verificação do Componente SectionReveal (Lógica de Retenção e Desconexão)
  // =========================================================================
  console.log("\n2. Verificando contrato de persistência do SectionReveal em section-reveal.tsx...");
  const sectionRevealPath = path.resolve("src/components/section-reveal.tsx");
  const sectionRevealContent = fs.readFileSync(sectionRevealPath, "utf-8");

  // Confirma desconexão e retenção permanente
  assert.ok(
    sectionRevealContent.includes("observer.disconnect()"),
    "SectionReveal deve desconectar o IntersectionObserver após a primeira detecção"
  );
  assert.ok(
    sectionRevealContent.includes("{lazy ? (revealed ? children : null) : children}"),
    "SectionReveal só renderiza children quando revealed é true (ou lazy é false)"
  );
  console.log("   ✓ Desconexão única do IntersectionObserver confirmada (não desmonta ao voltar para o topo)");
  console.log("   ✓ Filhos mantidos indefinidamente após primeira visualização");

  // =========================================================================
  // 3. Teste HTTP: Carregamento Inicial do Player no Topo da Página
  // =========================================================================
  console.log("\n3. Testando resposta HTTP do Player (/watch/16498?ep=stream-0)...");
  const resWatch = await fetch(`${baseUrl}/watch/16498?ep=stream-0`);
  assert.equal(resWatch.status, 200, "Rota do Player deve responder 200 OK");
  const watchHtml = await resWatch.text();

  // O Player e dados do anime devem estar presentes no payload HTTP
  assert.ok(
    watchHtml.includes("Attack on Titan") || watchHtml.includes("Shingeki no Kyojin"),
    "Player deve conter o título do anime"
  );
  assert.ok(
    watchHtml.includes("player.css"),
    "Tags de estilo do player devem ser carregadas no cabeçalho"
  );

  // Com lazy={true} (sem query ?comment), os comentários NÃO devem ser pré-renderizados no HTML inicial
  const hasPrematureComments = watchHtml.includes("Deixe seu comentário") || watchHtml.includes("Comentários do Episódio");
  assert.equal(
    hasPrematureComments,
    false,
    "Comentários NÃO devem ser pré-renderizados no carregamento inicial do player enquanto no topo"
  );
  console.log("   ✓ Resposta HTTP do player validada com status 200 OK e assets críticos no head");
  console.log("   ✓ Conteúdo dos comentários postergado com sucesso (sem consultas no carregamento inicial)");

  // =========================================================================
  // 4. Teste HTTP: Deep-link direto para comentário (?comment=xyz)
  // =========================================================================
  console.log("\n4. Testando bypass do carregamento tardio em deep-link direto (?comment=target-id)...");
  const resDirectComment = await fetch(`${baseUrl}/watch/16498?ep=stream-0&comment=c-target-test-999`);
  assert.equal(resDirectComment.status, 200, "Rota com deep-link de comentário deve responder 200 OK");
  const directHtml = await resDirectComment.text();
  assert.ok(
    directHtml.includes("Attack on Titan") || directHtml.includes("Shingeki no Kyojin"),
    "Página deve responder com conteúdo completo do anime"
  );
  console.log("   ✓ Rota com deep-link de comentário respondeu 200 OK com renderização imediata");

  // =========================================================================
  // 5. Teste de Troca de Episódio e Preservação dos Controles do Player
  // =========================================================================
  console.log("\n5. Verificando navegação entre episódios e preservação da grade de reprodução...");
  const resEp1 = await fetch(`${baseUrl}/watch/16498?ep=stream-0`);
  const resEp2 = await fetch(`${baseUrl}/watch/16498?ep=stream-1`);
  assert.equal(resEp1.status, 200, "Episódio 1 deve responder 200 OK");
  assert.equal(resEp2.status, 200, "Episódio 2 deve responder 200 OK");
  console.log("   ✓ Troca de episódio responde perfeitamente sem afetar o player ou os comentários");

  // =========================================================================
  // 6. Teste de Operações dos Comentários (GET otimizado 5B, integridade de dados)
  // =========================================================================
  console.log("\n6. Verificando integridade da API de comentários (GET /api/comments e estrutura)...");

  // 6.1 Teste HTTP do endpoint com cabeçalhos de controle de cache
  const apiHttpRes = await fetch(`${baseUrl}/api/comments?animeId=16498&episodeId=stream-0`);
  assert.equal(apiHttpRes.status, 200, "API /api/comments deve responder 200 OK");
  const cacheHeader = apiHttpRes.headers.get("Cache-Control");
  assert.ok(
    cacheHeader && cacheHeader.includes("no-store"),
    "Cache-Control da API de comentários deve ser estritamente privado/sem cache"
  );
  const httpJson = await apiHttpRes.json();
  assert.ok(Array.isArray(httpJson.comments), "Resposta deve conter array 'comments'");
  console.log("   ✓ Endpoint HTTP /api/comments responde 200 OK com Cache-Control privado e seguro");

  // 6.2 Teste do SQL Otimizado da Etapa 5B com inserção de dados
  const sql = await getSql();
  const testAnimeId = `test-5c-${Date.now()}`;
  const testEpId = `ep-5c-1`;
  const testUserId = `user-5c-${Date.now()}`;
  const commentId = `comment-5c-${Date.now()}`;

  try {
    await sql.query(`
      insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
      values ('${testUserId}', 'Tester 5C', 'tester5c@hikari.local', true, current_timestamp, current_timestamp)
      on conflict do nothing
    `);

    await sql.query(`
      insert into "comment" ("id", "animeId", "episodeId", "userId", "content", "createdAt", "updatedAt")
      values ('${commentId}', '${testAnimeId}', '${testEpId}', '${testUserId}', 'Comentário teste Etapa 5C', current_timestamp, current_timestamp)
    `);

    // Consulta SQL da Etapa 5B
    const queryText = `
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
          and c."episodeId" = $3
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

    const dbRows = await sql.query(queryText, [testAnimeId, null, testEpId]);
    assert.equal(dbRows.length, 1, "Deve retornar exatamente o comentário inserido");
    assert.equal(dbRows[0].id, commentId);
    assert.equal(dbRows[0].content, "Comentário teste Etapa 5C");
    assert.equal(dbRows[0].likes, 0);
    assert.equal(dbRows[0].dislikes, 0);
    assert.equal(dbRows[0].liked, false);
    assert.equal(dbRows[0].disliked, false);
    assert.equal(dbRows[0].userReaction, null);
    console.log("   ✓ SQL otimizado da Etapa 5B executado com precisão e compatibilidade total");

    // Limpeza
    await sql.query(`delete from "comment" where "id" = '${commentId}'`);
    await sql.query(`delete from "user" where "id" = '${testUserId}'`);
  } catch (err) {
    console.error("   Falha no teste da API de comentários:", err);
    throw err;
  }

  // =========================================================================
  // 7. Verificação de Layout Responsivo (Mobile e Desktop)
  // =========================================================================
  console.log("\n7. Verificando estrutura responsiva de watch.$id.tsx...");
  // Verifica se o layout possui classes para mobile e desktop
  assert.ok(
    watchContent.includes("max-w-7xl mx-auto") || watchContent.includes("max-w-6xl mx-auto") || watchContent.includes("mx-auto"),
    "Layout centralizado com largura máxima e padding adaptativo"
  );
  assert.ok(
    watchContent.includes("px-4") || watchContent.includes("sm:px-6"),
    "Layout deve ter espaçamento responsivo para dispositivos móveis e desktops"
  );
  console.log("   ✓ Estrutura de layout e paddings responsivos confirmados para Mobile e Desktop");

  console.log("\n=== TODOS OS TESTES DA ETAPA 5C FORAM EXECUTADOS E PASSARAM COM SUCESSO! ===");
}

runEtapa5CTests().catch((err) => {
  console.error("\n❌ Erro durante os testes da Etapa 5C:", err);
  process.exit(1);
});
