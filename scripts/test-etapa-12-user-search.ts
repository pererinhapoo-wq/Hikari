/**
 * Suite de Verificação Completa da Etapa 12:
 * Pesquisa de Usuários no Hikari
 *
 * Cobre os 15 requisitos obrigatórios:
 * 1. Username exato
 * 2. Username parcial e prefixo
 * 3. Pesquisa com "@"
 * 4. Display name
 * 5. Nome da conta
 * 6. Case-insensitive
 * 7. Bloqueio bilateral
 * 8. Conta privada com payload público básico
 * 9. Ausência de e-mail e dados confidenciais
 * 10. Paginação e ordenação estáveis
 * 11. Visitante anônimo
 * 12. Usuário autenticado e indicador isFollowing / isOwner
 * 13. Query vazia ou curta (< 2 caracteres)
 * 14. Caracteres especiais "%", "_" e "\"
 * 15. Limite máximo de resultados (máx. 20)
 */

import { getSql } from "@/lib/db";
import { executeSearchUsers } from "@/lib/profile.functions";

async function runTests() {
  console.log("=== INICIANDO SUITE DE TESTES DA ETAPA 12: PESQUISA DE USUÁRIOS ===");
  const sql = await getSql();

  const timestamp = Date.now();
  const idNaruto = `e12_naruto_${timestamp}`;
  const idSasuke = `e12_sasuke_${timestamp}`;
  const idSakura = `e12_sakura_${timestamp}`;
  const idKakashi = `e12_kakashi_${timestamp}`;
  const idSpecial = `e12_special_${timestamp}`;
  const idNormal = `e12_normal_${timestamp}`;
  const idViewer = `e12_viewer_${timestamp}`;
  const idBlockedByViewer = `e12_blocked_${timestamp}`;
  const idBlockerOfViewer = `e12_blocker_${timestamp}`;

  const nickNaruto = `naruto_${timestamp.toString().slice(-5)}`;
  const nickSasuke = `sasuke_${timestamp.toString().slice(-5)}`;
  const nickSakura = `sakura_${timestamp.toString().slice(-5)}`;
  const nickKakashi = `kakashi_${timestamp.toString().slice(-5)}`;
  const nickSpecial = `spec%100_user_${timestamp.toString().slice(-4)}`;
  const nickNormal = `spec1000user_${timestamp.toString().slice(-4)}`;
  const nickViewer = `viewer_${timestamp.toString().slice(-5)}`;
  const nickBlocked = `blocked_${timestamp.toString().slice(-5)}`;
  const nickBlocker = `blocker_${timestamp.toString().slice(-5)}`;

  try {
    console.log("\n-> Criando usuários e perfis para teste...");

    await sql`
      insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
      values
        (${idNaruto}, 'Naruto Uzumaki Cont', ${idNaruto + '@ninja.com'}, true, current_timestamp, current_timestamp),
        (${idSasuke}, 'Sasuke Uchiha Cont', ${idSasuke + '@ninja.com'}, true, current_timestamp, current_timestamp),
        (${idSakura}, 'Sakura Haruno Cont', ${idSakura + '@ninja.com'}, true, current_timestamp, current_timestamp),
        (${idKakashi}, 'Hatake Sensei Cont', ${idKakashi + '@ninja.com'}, true, current_timestamp, current_timestamp),
        (${idSpecial}, 'Special User Cont', ${idSpecial + '@test.com'}, true, current_timestamp, current_timestamp),
        (${idNormal}, 'Normal User Cont', ${idNormal + '@test.com'}, true, current_timestamp, current_timestamp),
        (${idViewer}, 'Viewer Test Cont', ${idViewer + '@test.com'}, true, current_timestamp, current_timestamp),
        (${idBlockedByViewer}, 'Blocked By Viewer Cont', ${idBlockedByViewer + '@test.com'}, true, current_timestamp, current_timestamp),
        (${idBlockerOfViewer}, 'Blocker Of Viewer Cont', ${idBlockerOfViewer + '@test.com'}, true, current_timestamp, current_timestamp)
    `;

    await sql`
      insert into "profile" ("userId", "nick", "displayName", "accountType", "allowFollowers", "privacyComments")
      values
        (${idNaruto}, ${nickNaruto}, 'Uzumaki Hero', 'public', true, 'public'),
        (${idSasuke}, ${nickSasuke}, 'Uchiha Avenger', 'private', true, 'followers'),
        (${idSakura}, ${nickSakura}, 'Haruno Medic', 'public', true, 'public'),
        (${idKakashi}, ${nickKakashi}, 'Kakashi Sensei', 'public', true, 'public'),
        (${idSpecial}, ${nickSpecial}, 'Special\\Nick_Name', 'public', true, 'public'),
        (${idNormal}, ${nickNormal}, 'Normal Nick Name', 'public', true, 'public'),
        (${idViewer}, ${nickViewer}, 'Viewer Principal', 'public', true, 'public'),
        (${idBlockedByViewer}, ${nickBlocked}, 'Blocked Person', 'public', true, 'public'),
        (${idBlockerOfViewer}, ${nickBlocker}, 'Blocker Person', 'public', true, 'public')
    `;

    // Criar lote de 25 usuários para teste de paginação e ordenação
    console.log("-> Criando lote de 25 usuários para testes de paginação...");
    const batchPrefix = `batch_${timestamp.toString().slice(-4)}`;
    for (let i = 1; i <= 25; i++) {
      const pad = String(i).padStart(2, "0");
      const bId = `e12_b_${pad}_${timestamp}`;
      const bNick = `${batchPrefix}_user_${pad}`;
      const bName = `Batch Member ${pad}`;

      await sql`
        insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
        values (${bId}, ${bName}, ${bId + '@batch.com'}, true, current_timestamp, current_timestamp)
      `;
      await sql`
        insert into "profile" ("userId", "nick", "displayName", "accountType")
        values (${bId}, ${bNick}, ${bName}, 'public')
      `;
    }

    // Configurar vínculos para idViewer:
    // idViewer segue idNaruto
    await sql`
      insert into "user_follow" ("followerId", "followingId", "createdAt")
      values (${idViewer}, ${idNaruto}, current_timestamp)
    `;

    // Bloqueios bilaterais:
    // 1. idViewer bloqueia idBlockedByViewer
    await sql`
      insert into "user_block" ("blockerId", "blockedId", "createdAt")
      values (${idViewer}, ${idBlockedByViewer}, current_timestamp)
    `;

    // 2. idBlockerOfViewer bloqueia idViewer
    await sql`
      insert into "user_block" ("blockerId", "blockedId", "createdAt")
      values (${idBlockerOfViewer}, ${idViewer}, current_timestamp)
    `;

    console.log("-> Massa de dados configurada com sucesso.\n");

    // =========================================================================
    // 1. Username exato
    // =========================================================================
    console.log("[Teste 1] Username exato com ordenação prioritária");
    const resExact = await executeSearchUsers(sql, null, {
      query: nickNaruto,
    });
    if (resExact.length === 0 || resExact[0].nick !== nickNaruto) {
      throw new Error(`Resultado não encontrou username exato como primeiro item: ${JSON.stringify(resExact)}`);
    }
    console.log(`✓ Teste 1 passou: Username exato "${nickNaruto}" retornado em 1º lugar.`);

    // =========================================================================
    // 2. Username parcial e prefixo
    // =========================================================================
    console.log("\n[Teste 2] Username parcial e prefixo");
    const resPartial = await executeSearchUsers(sql, null, {
      query: "naruto",
    });
    if (!resPartial.some((u) => u.nick === nickNaruto)) {
      throw new Error("Busca parcial por 'naruto' não retornou usuário correspondente");
    }
    console.log("✓ Teste 2 passou: Busca por prefixo/parcial encontrou usuário correspondente.");

    // =========================================================================
    // 3. Pesquisa com "@"
    // =========================================================================
    console.log("\n[Teste 3] Pesquisa com '@'");
    const resAt = await executeSearchUsers(sql, null, {
      query: `@${nickNaruto}`,
    });
    if (resAt.length === 0 || resAt[0].nick !== nickNaruto) {
      throw new Error("Busca com '@' não normalizou corretamente para encontrar usuário");
    }
    console.log("✓ Teste 3 passou: '@' inicial removido e busca encontrou o perfil.");

    // =========================================================================
    // 4. Display name
    // =========================================================================
    console.log("\n[Teste 4] Busca por displayName");
    const resDisplay = await executeSearchUsers(sql, null, {
      query: "Kakashi Sensei",
    });
    if (!resDisplay.some((u) => u.userId === idKakashi)) {
      throw new Error("Busca por displayName 'Kakashi Sensei' não retornou Kakashi");
    }
    console.log("✓ Teste 4 passou: Busca por displayName bem-sucedida.");

    // =========================================================================
    // 5. Nome da conta
    // =========================================================================
    console.log("\n[Teste 5] Busca por nome da conta (user.name)");
    const resName = await executeSearchUsers(sql, null, {
      query: "Hatake Sensei Cont",
    });
    if (!resName.some((u) => u.userId === idKakashi)) {
      throw new Error("Busca por user.name 'Hatake Sensei Cont' não retornou Kakashi");
    }
    console.log("✓ Teste 5 passou: Busca por user.name encontrou o usuário.");

    // =========================================================================
    // 6. Case-insensitive
    // =========================================================================
    console.log("\n[Teste 6] Busca case-insensitive");
    const resUpper = await executeSearchUsers(sql, null, {
      query: nickNaruto.toUpperCase(),
    });
    if (resUpper.length === 0 || resUpper[0].nick.toLowerCase() !== nickNaruto.toLowerCase()) {
      throw new Error("Busca case-insensitive em maiúsculas falhou");
    }
    console.log("✓ Teste 6 passou: Busca case-insensitive retornou correspondência exata prioritária.");

    // =========================================================================
    // 7. Bloqueio bilateral
    // =========================================================================
    console.log("\n[Teste 7] Bloqueio bilateral quando autenticado");
    // 7a. Viewer bloqueou idBlockedByViewer -> idBlockedByViewer não deve aparecer
    const resBlockedByMe = await executeSearchUsers(sql, idViewer, {
      query: nickBlocked,
    });
    if (resBlockedByMe.some((u) => u.userId === idBlockedByViewer)) {
      throw new Error("Usuário bloqueado pelo visualizador apareceu nos resultados da busca!");
    }

    // 7b. idBlockerOfViewer bloqueou viewer -> idBlockerOfViewer não deve aparecer para viewer
    const resBlockedByTarget = await executeSearchUsers(sql, idViewer, {
      query: nickBlocker,
    });
    if (resBlockedByTarget.some((u) => u.userId === idBlockerOfViewer)) {
      throw new Error("Usuário que bloqueou o visualizador apareceu nos resultados da busca!");
    }
    console.log("✓ Teste 7 passou: Bloqueios bilaterais respeitados e excluídos dos resultados.");

    // =========================================================================
    // 8. Conta privada com payload público básico
    // =========================================================================
    console.log("\n[Teste 8] Conta privada com payload público básico");
    const resPrivate = await executeSearchUsers(sql, null, {
      query: nickSasuke,
    });
    const sasukeUser = resPrivate.find((u) => u.userId === idSasuke);
    if (!sasukeUser) {
      throw new Error("Conta privada não encontrada na busca");
    }
    if (sasukeUser.accountType !== "private") {
      throw new Error(`accountType esperado 'private', recebido: ${sasukeUser.accountType}`);
    }
    if (!sasukeUser.nick || !sasukeUser.displayName) {
      throw new Error("Identidade pública básica ausente na conta privada");
    }
    console.log("✓ Teste 8 passou: Conta privada retornada com accountType='private' e identidade básica.");

    // =========================================================================
    // 9. Ausência de e-mail e dados confidenciais
    // =========================================================================
    console.log("\n[Teste 9] Ausência de e-mail e dados confidenciais");
    const allowedKeys = new Set([
      "userId",
      "nick",
      "displayName",
      "avatarUrl",
      "accountType",
      "isFollowing",
      "isOwner",
    ]);
    for (const user of resPrivate) {
      const keys = Object.keys(user);
      for (const k of keys) {
        if (!allowedKeys.has(k)) {
          throw new Error(`Campo confidencial ou não autorizado vazou no retorno: ${k}`);
        }
      }
      if ("email" in user || "password" in user || "bio" in user || "privacyLists" in user) {
        throw new Error("Vazamento de dados privados detectado!");
      }
    }
    console.log("✓ Teste 9 passou: Nenhum dado privado ou confidencial exposto.");

    // =========================================================================
    // 10. Paginação e ordenação estáveis
    // =========================================================================
    console.log("\n[Teste 10] Paginação e ordenação estáveis");
    const page1 = await executeSearchUsers(sql, null, {
      query: batchPrefix,
      page: 1,
      limit: 10,
    });
    const page2 = await executeSearchUsers(sql, null, {
      query: batchPrefix,
      page: 2,
      limit: 10,
    });

    if (page1.length !== 10) {
      throw new Error(`Página 1 esperava 10 itens, obteve ${page1.length}`);
    }
    if (page2.length !== 10) {
      throw new Error(`Página 2 esperava 10 itens, obteve ${page2.length}`);
    }

    const set1 = new Set(page1.map((u) => u.userId));
    const duplicates = page2.filter((u) => set1.has(u.userId));
    if (duplicates.length > 0) {
      throw new Error(`Itens duplicados entre páginas 1 e 2: ${duplicates.map((d) => d.nick).join(", ")}`);
    }
    console.log("✓ Teste 10 passou: Paginação estável sem duplicatas ou saltos.");

    // =========================================================================
    // 11. Visitante anônimo
    // =========================================================================
    console.log("\n[Teste 11] Visitante anônimo pode pesquisar sem filtro de bloqueio");
    const resAnonBlocked = await executeSearchUsers(sql, null, {
      query: nickBlocked,
    });
    const resAnonBlocker = await executeSearchUsers(sql, null, {
      query: nickBlocker,
    });
    if (!resAnonBlocked.some((u) => u.userId === idBlockedByViewer)) {
      throw new Error("Visitante anônimo não encontrou usuário bloqueado por terceiros");
    }
    if (!resAnonBlocker.some((u) => u.userId === idBlockerOfViewer)) {
      throw new Error("Visitante anônimo não encontrou usuário que bloqueou terceiro");
    }
    console.log("✓ Teste 11 passou: Visitantes anônimos pesquisam sem filtro de bloqueio pessoal.");

    // =========================================================================
    // 12. Usuário autenticado e indicador isFollowing / isOwner
    // =========================================================================
    console.log("\n[Teste 12] Usuário autenticado e indicadores isFollowing e isOwner");
    const resViewerSearch = await executeSearchUsers(sql, idViewer, {
      query: timestamp.toString().slice(-5),
    });

    const narutoItem = resViewerSearch.find((u) => u.userId === idNaruto);
    const sakuraItem = resViewerSearch.find((u) => u.userId === idSakura);
    const viewerItem = resViewerSearch.find((u) => u.userId === idViewer);

    if (!narutoItem || narutoItem.isFollowing !== true) {
      throw new Error(`isFollowing deveria ser true para Naruto: ${JSON.stringify(narutoItem)}`);
    }
    if (!sakuraItem || sakuraItem.isFollowing !== false) {
      throw new Error(`isFollowing deveria ser false para Sakura: ${JSON.stringify(sakuraItem)}`);
    }
    if (!viewerItem || viewerItem.isOwner !== true) {
      throw new Error(`isOwner deveria ser true para o próprio viewer: ${JSON.stringify(viewerItem)}`);
    }
    if (narutoItem.isOwner !== false) {
      throw new Error("isOwner deveria ser false para outro usuário");
    }
    console.log("✓ Teste 12 passou: isFollowing e isOwner calculados corretamente.");

    // =========================================================================
    // 13. Query vazia ou curta
    // =========================================================================
    console.log("\n[Teste 13] Query vazia ou curta (< 2 caracteres)");
    const qEmpty = await executeSearchUsers(sql, null, { query: "" });
    const qSingle = await executeSearchUsers(sql, null, { query: "a" });
    const qSpaces = await executeSearchUsers(sql, null, { query: "   " });
    const qAtSingle = await executeSearchUsers(sql, null, { query: "@b" });
    const qAtSpaces = await executeSearchUsers(sql, null, { query: "@   " });

    if (
      qEmpty.length !== 0 ||
      qSingle.length !== 0 ||
      qSpaces.length !== 0 ||
      qAtSingle.length !== 0 ||
      qAtSpaces.length !== 0
    ) {
      throw new Error("Query curta/vazia deveria retornar array vazio");
    }
    console.log("✓ Teste 13 passou: Queries curtas ou vazias retornam array vazio com segurança.");

    // =========================================================================
    // 14. Caracteres especiais "%", "_" e "\"
    // =========================================================================
    console.log("\n[Teste 14] Caracteres especiais '%', '_' e '\\' pesquisados literalmente");
    // 14a. Pesquisa literal por '%100_'
    const resPercentUnderscore = await executeSearchUsers(sql, null, {
      query: "%100_",
    });
    if (!resPercentUnderscore.some((u) => u.userId === idSpecial)) {
      throw new Error("Pesquisa literal por '%100_' não encontrou usuário com esses caracteres");
    }
    // Não deve casar idNormal ('spec1000user')
    if (resPercentUnderscore.some((u) => u.userId === idNormal)) {
      throw new Error("Pesquisa por '%' e '_' casou indevidamente como curinga!");
    }

    // 14b. Pesquisa literal por barra invertida '\'
    const resBackslash = await executeSearchUsers(sql, null, {
      query: "Special\\Nick",
    });
    if (!resBackslash.some((u) => u.userId === idSpecial)) {
      throw new Error("Pesquisa literal por '\\' no displayName falhou");
    }
    console.log("✓ Teste 14 passou: %, _ e \\ tratados estritamente como texto literal.");

    // =========================================================================
    // 15. Limite máximo de resultados
    // =========================================================================
    console.log("\n[Teste 15] Limite máximo de resultados (máx. 20)");
    const resDefaultLimit = await executeSearchUsers(sql, null, {
      query: batchPrefix,
    });
    if (resDefaultLimit.length !== 20) {
      throw new Error(`Limite padrão esperado 20, recebido: ${resDefaultLimit.length}`);
    }

    const resOverLimit = await executeSearchUsers(sql, null, {
      query: batchPrefix,
      limit: 100, // tenta solicitar mais de 20
    });
    if (resOverLimit.length > 20) {
      throw new Error(`Limite não foi restringido ao máximo de 20: ${resOverLimit.length}`);
    }
    console.log("✓ Teste 15 passou: Limite padrão é 20 e teto máximo de 20 é estritamente garantido.");

    console.log("\n==========================================================");
    console.log(">>> TODOS OS 15 TESTES DA ETAPA 12 PASSARAM COM SUCESSO! <<<");
    console.log("==========================================================");
  } finally {
    // Limpeza dos dados de teste
    try {
      await sql`delete from "user" where "id" like 'e12_%'`;
    } catch {
      // Ignorar eventuais erros de limpeza
    }
  }
}

runTests().catch((err) => {
  console.error("FALHA NA SUITE DE TESTES DA ETAPA 12:", err);
  process.exit(1);
});
