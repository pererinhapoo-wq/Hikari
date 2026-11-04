// scripts/test-etapa-4e.mjs
import assert from "node:assert/strict";
import {
  DOMAIN_TTL_CONFIGS,
  getDomainTtlConfig,
  getCacheDomain,
  inspectCache,
  toCache,
  domainCaches,
  inFlight,
  withCache,
  triggerBackgroundRevalidation,
  isReleasingAnime,
} from "../src/lib/api.ts";

async function runEtapa4ETests() {
  console.log("=== INICIANDO TESTES DA ETAPA 4E: OTIMIZAÇÃO DOS TEMPOS DE CACHE (TTL) ===");

  // 1 & 2: TTL fresco de detail (30 min) e SWR de detail (24h)
  console.log("\n1 & 2. Verificando configuração de TTL e SWR de detail...");
  const detailConfig = getDomainTtlConfig("detail");
  const expectedDetailFresh = 30 * 60 * 1000; // 30 minutos
  const expectedDetailSwr = 24 * 60 * 60 * 1000; // 24 horas
  assert.equal(detailConfig.freshTtl, expectedDetailFresh, "TTL fresco de detail deve ser exatamente 30 minutos (1800000ms)");
  assert.equal(detailConfig.swrWindow, expectedDetailSwr, "Janela SWR de detail deve ser exatamente 24 horas (86400000ms)");
  assert.equal(detailConfig.maxAge, expectedDetailFresh + expectedDetailSwr, "maxAge de detail deve ser 30m + 24h");
  console.log(`✓ detail: freshTtl = ${detailConfig.freshTtl / 60000}min, swrWindow = ${detailConfig.swrWindow / 3600000}h, maxAge = ${detailConfig.maxAge / 3600000}h`);

  // 3 & 4: TTL fresco de season-nav (2h) e SWR de season-nav (48h)
  console.log("\n3 & 4. Verificando configuração de TTL e SWR de season-nav...");
  const seasonNavConfig = getDomainTtlConfig("season-nav");
  const expectedNavFresh = 2 * 60 * 60 * 1000; // 2 horas
  const expectedNavSwr = 48 * 60 * 60 * 1000; // 48 horas
  assert.equal(seasonNavConfig.freshTtl, expectedNavFresh, "TTL fresco de season-nav deve ser exatamente 2 horas (7200000ms)");
  assert.equal(seasonNavConfig.swrWindow, expectedNavSwr, "Janela SWR de season-nav deve ser exatamente 48 horas (172800000ms)");
  assert.equal(seasonNavConfig.maxAge, expectedNavFresh + expectedNavSwr, "maxAge de season-nav deve ser 2h + 48h (50h)");
  console.log(`✓ season-nav: freshTtl = ${seasonNavConfig.freshTtl / 3600000}h, swrWindow = ${seasonNavConfig.swrWindow / 3600000}h, maxAge = ${seasonNavConfig.maxAge / 3600000}h`);

  // 5 & 6: TTL fresco de credits (2h) e SWR de credits (48h)
  console.log("\n5 & 6. Verificando configuração de TTL e SWR de credits...");
  const creditsConfig = getDomainTtlConfig("credits");
  const expectedCreditsFresh = 2 * 60 * 60 * 1000; // 2 horas
  const expectedCreditsSwr = 48 * 60 * 60 * 1000; // 48 horas
  assert.equal(creditsConfig.freshTtl, expectedCreditsFresh, "TTL fresco de credits deve ser exatamente 2 horas (7200000ms)");
  assert.equal(creditsConfig.swrWindow, expectedCreditsSwr, "Janela SWR de credits deve ser exatamente 48 horas (172800000ms)");
  assert.equal(creditsConfig.maxAge, expectedCreditsFresh + expectedCreditsSwr, "maxAge de credits deve ser 2h + 48h (50h)");
  console.log(`✓ credits: freshTtl = ${creditsConfig.freshTtl / 3600000}h, swrWindow = ${creditsConfig.swrWindow / 3600000}h, maxAge = ${creditsConfig.maxAge / 3600000}h`);

  // 7: Proteção de dados que mudam frequentemente (episódios e animes em lançamento)
  console.log("\n7. Testando proteção de episódios e animes semanais / em lançamento...");
  // 7a. jikan-episodes possui domínio isolado "episodes" com TTL específico preservado (5 min)
  const episodesDomain = getCacheDomain("jikan-episodes:v2:21");
  assert.equal(episodesDomain, "episodes", "jikan-episodes deve pertencer ao domínio 'episodes'");
  const episodesConfig = getDomainTtlConfig("episodes");
  assert.equal(episodesConfig.freshTtl, 5 * 60 * 1000, "TTL de episódios deve ser mantido em 5 minutos para refletir atualizações rápidas");
  assert.equal(episodesConfig.swrWindow, 60 * 60 * 1000, "Janela SWR de episódios deve ser 60 minutos");
  console.log(`✓ Domínio 'episodes': freshTtl = ${episodesConfig.freshTtl / 60000}min, swrWindow = ${episodesConfig.swrWindow / 60000}min`);

  // 7b. Animes finalizados (FINISHED) usam os 30 min normais de detail
  const finishedAnime = {
    id: "finished-1",
    status: "FINISHED",
    title: { english: "Cowboy Bebop" },
    seasons: [{ id: "s1", number: 1, episodes: [] }],
  };
  toCache("detail:v5:finished-1", finishedAnime);
  const detailCacheMap = domainCaches.get("detail");
  const finishedEntry = detailCacheMap.get("detail:v5:finished-1");
  assert.ok(finishedEntry, "Entrada deve existir em cache");

  // Aos 20 minutos, anime finalizado ainda é FRESH (pois 20 min <= 30 min)
  finishedEntry.at = Date.now() - 20 * 60 * 1000;
  const finishedLookup20m = inspectCache("detail:v5:finished-1");
  assert.equal(finishedLookup20m.status, "fresh", "Anime finalizado aos 20 min deve estar fresh");

  // 7c. Animes em lançamento (RELEASING ou com nextEpisode) NÃO ficam congelados por 30m:
  // Preservam TTL fresco de 5 min e entram em STALE aos 20 min (disparando SWR em segundo plano)
  const releasingAnime = {
    id: "releasing-21",
    status: "RELEASING",
    nextEpisode: { episode: 1125, airingAt: Math.floor(Date.now() / 1000) + 86400 },
    title: { english: "One Piece" },
    seasons: [{ id: "s1", number: 1, episodes: [] }],
  };
  toCache("detail:v5:releasing-21", releasingAnime);
  const releasingEntry = detailCacheMap.get("detail:v5:releasing-21");
  assert.ok(releasingEntry, "Entrada de anime em lançamento deve existir");

  // Aos 2 minutos (< 5 min), anime em lançamento é fresh
  releasingEntry.at = Date.now() - 2 * 60 * 1000;
  const releasingLookup2m = inspectCache("detail:v5:releasing-21");
  assert.equal(releasingLookup2m.status, "fresh", "Anime em lançamento aos 2 min deve ser fresh");

  // Aos 10 minutos (> 5 min mas < 24h), anime em lançamento entra em STALE para revalidação SWR
  releasingEntry.at = Date.now() - 10 * 60 * 1000;
  const releasingLookup10m = inspectCache("detail:v5:releasing-21");
  assert.equal(releasingLookup10m.status, "stale", "Anime em lançamento aos 10 min deve ser stale para disparar revalidação imediata em segundo plano!");
  console.log("✓ Proteção confirmada: anime em lançamento não fica congelado por 30m, entra em SWR aos 5m");

  // 8: Singleflight evita consultas duplicadas
  console.log("\n8. Testando Singleflight (deduplicação de requisições concorrentes)...");
  let fetchCount = 0;
  const slowFetcher = async () => {
    fetchCount++;
    await new Promise((r) => setTimeout(r, 50));
    return { data: "singleflight-success" };
  };
  const testKey = "detail:v5:singleflight-test";
  const [res1, res2, res3] = await Promise.all([
    withCache(testKey, slowFetcher),
    withCache(testKey, slowFetcher),
    withCache(testKey, slowFetcher),
  ]);
  assert.equal(fetchCount, 1, "Fetcher deve ser executado apenas 1 vez para 3 requisições simultâneas");
  assert.equal(res1.data, "singleflight-success");
  assert.equal(res2.data, "singleflight-success");
  assert.equal(res3.data, "singleflight-success");
  console.log("✓ Singleflight funcionou perfeitamente: 3 chamadas concorrentes resultaram em apenas 1 execução!");

  // 9: Falhas de revalidação preservam dados válidos em cache (SWR resilience)
  console.log("\n9. Testando tolerância a falhas na revalidação (preservação do cache SWR)...");
  const resilientKey = "detail:v5:resilient-test";
  const originalData = { id: "resilient-1", name: "Dados Válidos", status: "FINISHED" };
  toCache(resilientKey, originalData);
  const resilientEntry = detailCacheMap.get(resilientKey);
  // Simula que os dados ficaram stale (idade 35 minutos)
  resilientEntry.at = Date.now() - 35 * 60 * 1000;

  const failingFetcher = async () => {
    throw new Error("Simulated network outage");
  };

  // withCache deve retornar os dados originais imediatamente mesmo quando o fetcher de background falha
  const returnedData = await withCache(resilientKey, failingFetcher);
  assert.deepEqual(returnedData, originalData, "Deve retornar dados anteriores em cache");

  // Aguarda a resolução da revalidação em segundo plano
  await new Promise((r) => setTimeout(r, 50));
  const stillCached = inspectCache(resilientKey);
  assert.equal(stillCached.status, "stale", "Dados continuam preservados no cache mesmo após falha de rede");
  assert.deepEqual(stillCached.data, originalData, "Dados em cache não foram corrompidos nem apagados");
  console.log("✓ SWR resiliente confirmado: falhas na revalidação em segundo plano preservam dados válidos em cache");

  // 10: Testando LRU
  console.log("\n10. Verificando política LRU...");
  toCache("credits:v1:test-a", { id: "a" });
  toCache("credits:v1:test-b", { id: "b" });
  toCache("credits:v1:test-c", { id: "c" });

  const creditsMap = domainCaches.get("credits");
  assert.ok(creditsMap, "creditsMap deve existir após toCache");

  // Acessa 'test-a' via inspectCache -> deve ir para o fim da fila de uso recente
  inspectCache("credits:v1:test-a");
  const keysOrder = Array.from(creditsMap.keys());
  assert.equal(keysOrder[keysOrder.length - 1], "credits:v1:test-a", "test-a deve ser o mais recentemente utilizado na fila LRU");
  console.log("✓ Política LRU comprovada: acessos atualizam a prioridade do cache");

  console.log("\n=== TODOS OS 10 TESTES DE COMPORTAMENTO E TTL PASSARAM COM 100% DE SUCESSO! ===");
}

runEtapa4ETests().catch((err) => {
  console.error("ERRO NOS TESTES DA ETAPA 4E:", err);
  process.exit(1);
});
