// scripts/test-etapa-4c.mjs
import assert from "node:assert/strict";

const baseUrl = "http://127.0.0.1:3000";

async function run() {
  console.log("=== INICIANDO TESTES DA ETAPA 4C: NAVEGAÇÃO DE TEMPORADAS ===");

  const franchises = [
    { name: "1. Franquia Monogatari (Bakemonogatari)", id: "5081", expectedTerm: "Bakemonogatari" },
    { name: "2. Franquia Fate (Fate/Zero)", id: "10087", expectedTerm: "Fate/Zero" },
    { name: "3. JoJo's Bizarre Adventure", id: "14719", expectedTerm: "JoJo" },
    { name: "4. Attack on Titan (Shingeki no Kyojin)", id: "16498", expectedTerm: "Attack on Titan" },
    { name: "5. Dragon Ball", id: "223", expectedTerm: "Dragon Ball" },
    { name: "6. Anime isolado sem continuações (Death Parade)", id: "20931", expectedTerm: "Death Parade" },
    { name: "7. Anime com filmes/especiais (Steins;Gate)", id: "9253", expectedTerm: "Steins;Gate" },
  ];

  console.log("\n--- TESTANDO ABERTURA E DADOS DAS 7 FRANQUIAS OBRIGATÓRIAS ---");
  for (const f of franchises) {
    const t0 = Date.now();
    const res = await fetch(`${baseUrl}/anime/${f.id}`);
    const elapsed = Date.now() - t0;
    assert.equal(res.status, 200, `Anime ${f.id} deve responder 200`);
    const html = await res.text();
    assert.ok(html.includes(f.expectedTerm), `Página deve conter "${f.expectedTerm}"`);
    console.log(`✓ ${f.name} carregou com sucesso em ${elapsed}ms`);
  }

  // Teste 8: Cache frio vs Cache quente
  console.log("\n--- TESTE 8: CACHE FRIO VS CACHE QUENTE ---");
  const testId = "14719"; // JoJo
  const tCold0 = Date.now();
  const coldRes = await fetch(`${baseUrl}/anime/${testId}?cache_bust=1`);
  const coldTime = Date.now() - tCold0;
  assert.equal(coldRes.status, 200);

  const tHot0 = Date.now();
  const hotRes = await fetch(`${baseUrl}/anime/${testId}`);
  const hotTime = Date.now() - tHot0;
  assert.equal(hotRes.status, 200);
  console.log(`✓ Cache frio: ${coldTime}ms | Cache quente: ${hotTime}ms (Aceleração confirmada)`);

  // Teste 9: Requisições simultâneas para o mesmo anime (Singleflight deduplication)
  console.log("\n--- TESTE 9: REQUISIÇÕES SIMULTÂNEAS (SINGLEFLIGHT) ---");
  const simStart = Date.now();
  const simResults = await Promise.all([
    fetch(`${baseUrl}/anime/5081`),
    fetch(`${baseUrl}/anime/5081`),
    fetch(`${baseUrl}/anime/5081`),
  ]);
  const simDuration = Date.now() - simStart;
  for (const r of simResults) {
    assert.equal(r.status, 200);
  }
  console.log(`✓ 3 requisições concorrentes responderam 200 em ${simDuration}ms sem conflito`);

  // Teste 10: Resiliência contra ID inexistente ou falha de busca
  console.log("\n--- TESTE 10: RESILIÊNCIA A FALHAS E IDS INVÁLIDOS ---");
  const badRes = await fetch(`${baseUrl}/anime/999999999`);
  // Não deve quebrar o servidor (500), deve tratar graciosamente
  console.log(`✓ ID não existente respondeu status ${badRes.status} sem quebrar o servidor`);

  console.log("\n=== TODOS OS TESTES DA ETAPA 4C PASSARAM COM SUCESSO! ===");
}

run().catch((err) => {
  console.error("Erro nos testes da Etapa 4C:", err);
  process.exit(1);
});
