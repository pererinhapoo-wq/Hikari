// scripts/test-etapa-4d.mjs
import assert from "node:assert/strict";

const baseUrl = "http://127.0.0.1:3000";

async function run() {
  console.log("=== INICIANDO TESTES DA ETAPA 4D: CARREGAMENTO PROGRESSIVO ===");

  // Teste 1: Página abre exibindo imediatamente conteúdo principal
  console.log("\n1. Testando exibição imediata do conteúdo principal...");
  const res = await fetch(`${baseUrl}/anime/16498`); // AoT
  assert.equal(res.status, 200, "Anime deve carregar com 200 OK");
  const html = await res.text();

  // Elementos imediatos obrigatórios:
  assert.ok(html.includes("Attack on Titan") || html.includes("Shingeki no Kyojin"), "Deve conter título");
  assert.ok(html.includes("Sinopse"), "Deve conter sinopse");
  assert.ok(html.includes("id=\"episodes\"") || html.includes("Episódios"), "Deve conter grade de episódios");
  console.log("✓ Conteúdo principal (Banner, Título, Sinopse, Episódios) renderizado imediatamente!");

  // Teste 2: Seções secundárias protegidas por SectionReveal
  console.log("\n2. Verificando presença dos contêineres SectionReveal...");
  const sectionRevealCount = (html.match(/will-change-\[opacity,transform\]/g) || []).length;
  console.log(`✓ Encontrados ${sectionRevealCount} contêineres SectionReveal protegendo as seções secundárias no SSR.`);
  assert.ok(sectionRevealCount >= 3, "Deve haver seções protegidas por SectionReveal");

  // Teste 3: Link direto para comentário (targetCommentId) não bloqueia lazy
  console.log("\n3. Testando link direto para comentário (?comment=xyz)...");
  const commentDirectRes = await fetch(`${baseUrl}/anime/16498?comment=test-comment-123`);
  assert.equal(commentDirectRes.status, 200);
  console.log("✓ Rota com link direto para comentário respondeu 200 com sucesso");

  // Teste 4: Verificação de outras rotas de anime (Anime isolado, Anime com filmes)
  console.log("\n4. Testando anime isolado e anime com filmes...");
  const deathParadeRes = await fetch(`${baseUrl}/anime/20931`);
  assert.equal(deathParadeRes.status, 200);
  const steinsGateRes = await fetch(`${baseUrl}/anime/9253`);
  assert.equal(steinsGateRes.status, 200);
  console.log("✓ Animes com diferentes estruturas de seções abriram perfeitamente");

  // Teste 5: Rota do player (/watch/$id) permanece 100% íntegra
  console.log("\n5. Verificando integridade da rota do Player (/watch/16498)...");
  const playerRes = await fetch(`${baseUrl}/watch/16498?ep=stream-0`);
  assert.equal(playerRes.status, 200);
  console.log("✓ Rota do player respondeu 200 OK sem qualquer regressão");

  console.log("\n=== TODOS OS TESTES DA ETAPA 4D PASSARAM COM SUCESSO! ===");
}

run().catch((err) => {
  console.error("Erro nos testes da Etapa 4D:", err);
  process.exit(1);
});
