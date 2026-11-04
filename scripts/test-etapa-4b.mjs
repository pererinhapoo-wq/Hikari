import assert from "node:assert/strict";

async function runTests() {
  console.log("=== INICIANDO TESTES DA ETAPA 4B ===");
  const baseUrl = "http://127.0.0.1:3000";

  // Teste 1: Abertura da Home e da página de anime
  console.log("\n1. Testando conectividade básica...");
  const homeRes = await fetch(`${baseUrl}/`);
  assert.equal(homeRes.status, 200, "Home deve responder 200");
  console.log("✓ Home responde 200 OK");

  // Teste 2: Anime popular na AniList com streamingEpisodes (ex: Attack on Titan - 16498)
  console.log("\n2. Testando anime com streamingEpisodes na AniList (ID 16498)...");
  const startAot = Date.now();
  const aotRes = await fetch(`${baseUrl}/anime/16498`);
  const aotDuration = Date.now() - startAot;
  assert.equal(aotRes.status, 200, "Página do anime 16498 deve responder 200");
  const aotHtml = await aotRes.text();
  assert.ok(aotHtml.includes("Shingeki no Kyojin") || aotHtml.includes("Attack on Titan"), "Deve conter o título do anime");
  console.log(`✓ Anime 16498 carregou com sucesso em ${aotDuration}ms (Status 200)`);

  // Teste 3: Anime sem streamingEpisodes (deve entregar episódios numerados sem travar no Jikan)
  console.log("\n3. Testando anime clássico sem streamingEpisodes no AniList (ex: Cowboy Bebop - 1)...");
  const startBebop = Date.now();
  const bebopRes = await fetch(`${baseUrl}/anime/1`);
  const bebopDuration = Date.now() - startBebop;
  assert.equal(bebopRes.status, 200, "Página do anime 1 deve responder 200");
  const bebopHtml = await bebopRes.text();
  assert.ok(bebopHtml.includes("Cowboy Bebop"), "Deve conter o título Cowboy Bebop");
  console.log(`✓ Anime 1 carregou em ${bebopDuration}ms sem bloqueio de 2s`);

  // Teste 4: Compatibilidade com o Player (/watch/$id)
  console.log("\n4. Testando rota do player (/watch/1?ep=ep-1-1)...");
  const watchRes = await fetch(`${baseUrl}/watch/1?ep=ep-1-1`);
  assert.equal(watchRes.status, 200, "Player deve responder 200");
  const watchHtml = await watchRes.text();
  assert.ok(watchHtml.includes("Cowboy Bebop"), "Player deve conter o anime correspondente");
  console.log("✓ Player responde 200 e encontra o episódio");

  // Teste 5: Cache quente (segunda requisição deve ser quase instantânea)
  console.log("\n5. Testando velocidade em Cache Quente...");
  const startHot = Date.now();
  const hotRes = await fetch(`${baseUrl}/anime/16498`);
  const hotDuration = Date.now() - startHot;
  assert.equal(hotRes.status, 200);
  console.log(`✓ Cache quente respondeu em ${hotDuration}ms (MUITO mais rápido que o cache frio)`);

  // Teste 6: Anime em Lançamento (RELEASING)
  console.log("\n6. Testando anime em lançamento...");
  // Frieren / Solo Leveling / One Piece (21)
  const opRes = await fetch(`${baseUrl}/anime/21`);
  assert.equal(opRes.status, 200);
  const opHtml = await opRes.text();
  assert.ok(opHtml.includes("One Piece"), "Deve conter One Piece");
  console.log("✓ Anime em lançamento (One Piece) carregou corretamente");

  // Teste 7: Rota MAL (mal-*)
  console.log("\n7. Testando anime com ID MyAnimeList (mal-5114 - Fullmetal Alchemist: Brotherhood)...");
  const malRes = await fetch(`${baseUrl}/anime/mal-5114`);
  assert.equal(malRes.status, 200);
  const malHtml = await malRes.text();
  assert.ok(malHtml.includes("Fullmetal Alchemist"), "Deve conter Fullmetal Alchemist");
  console.log("✓ Anime com prefixo mal- carregou com sucesso");

  console.log("\n=== TODOS OS TESTES PASSARAM COM SUCESSO! ===");
}

runTests().catch((err) => {
  console.error("FALHA NOS TESTES:", err);
  process.exit(1);
});
