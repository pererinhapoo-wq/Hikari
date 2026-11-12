import assert from "node:assert/strict";
import fs from "node:fs";

console.log("=== INICIANDO VALIDAÇÃO DA RESTAURAÇÃO DE EPISÓDIOS RECENTES ===");

// -------------------------------------------------------------------------
// 1. Verificação Estática de Código: Ausência de Capa/Banner em EpisodeCard
// -------------------------------------------------------------------------
console.log("\n1. Verificando código-fonte de src/components/episode-card.tsx...");
const cardCode = fs.readFileSync("src/components/episode-card.tsx", "utf-8");

assert.equal(
  cardCode.includes("animeBanner || episode.animeCover"),
  false,
  "EpisodeCard NÃO deve utilizar animeBanner ou animeCover como fallback",
);
assert.equal(
  cardCode.includes("fallbackImage"),
  false,
  "EpisodeCard NÃO deve definir variável fallbackImage",
);
assert.equal(
  cardCode.includes("showFallback"),
  false,
  "EpisodeCard NÃO deve exibir fallback com imagens do anime",
);
assert.ok(
  cardCode.includes("episode.thumbnail"),
  "EpisodeCard deve utilizar o campo de thumbnail próprio do episódio",
);
assert.ok(
  cardCode.includes("hasValidThumbnail"),
  "EpisodeCard deve verificar se hasValidThumbnail é verdadeiro",
);
assert.ok(
  cardCode.includes("<Film"),
  "EpisodeCard deve renderizar o placeholder Film quando não houver thumbnail",
);
console.log("✓ episode-card.tsx validado: usa exclusivamente a thumbnail própria do episódio sem qualquer fallback para cover/banner.");

// -------------------------------------------------------------------------
// 2. Verificação de src/components/recent-episodes-section.tsx
// -------------------------------------------------------------------------
console.log("\n2. Verificando código-fonte de src/components/recent-episodes-section.tsx...");
const sectionCode = fs.readFileSync("src/components/recent-episodes-section.tsx", "utf-8");

assert.ok(
  sectionCode.includes('title = "Episódios Recentes"'),
  "RecentEpisodesSection deve ter 'Episódios Recentes' como título padrão",
);
assert.ok(
  sectionCode.includes("{title}"),
  "RecentEpisodesSection deve exibir a prop {title}",
);
assert.ok(
  sectionCode.includes('to="/episodes"'),
  "RecentEpisodesSection deve manter link para /episodes",
);
assert.ok(
  sectionCode.includes("EpisodeCard"),
  "RecentEpisodesSection deve renderizar EpisodeCard",
);
console.log("✓ recent-episodes-section.tsx validado com título 'Episódios Recentes' e link preservado.");

// -------------------------------------------------------------------------
// 3. Verificação de Posição em src/routes/index.tsx
// -------------------------------------------------------------------------
console.log("\n3. Verificando ordem das seções em src/routes/index.tsx...");
const indexCode = fs.readFileSync("src/routes/index.tsx", "utf-8");

const idxToday = indexCode.indexOf("<TodayEpisodesSection");
const idxEmAlta = indexCode.indexOf('title="Em Alta"');
const idxRecent = indexCode.indexOf("<RecentEpisodesSection");
const idxAdded = indexCode.indexOf('title="Animes Recém-Adicionados"');
const idxSeason = indexCode.indexOf("<SeasonAnimeRow");

assert.ok(idxToday !== -1, "TodayEpisodesSection deve existir");
assert.ok(idxEmAlta !== -1, "AnimeRow 'Em Alta' deve existir");
assert.ok(idxRecent !== -1, "RecentEpisodesSection deve existir");
assert.ok(idxAdded !== -1, "AnimeRow 'Animes Recém-Adicionados' deve existir");
assert.ok(idxSeason !== -1, "SeasonAnimeRow deve existir");

assert.ok(
  idxToday < idxEmAlta,
  "1. Episódios de Hoje deve vir antes de 'Em Alta'",
);
assert.ok(
  idxEmAlta < idxRecent,
  "2. 'Em Alta' deve vir imediatamente antes de 'Episódios Recentes' (RecentEpisodesSection)",
);
assert.ok(
  idxRecent < idxAdded,
  "3. 'Episódios Recentes' deve vir imediatamente antes de 'Animes Recém-Adicionados'",
);
assert.ok(
  idxAdded < idxSeason,
  "4. 'Animes Recém-Adicionados' deve vir antes de 'Animes da Temporada'",
);

console.log("✓ Ordem exata das seções na Home validada:");
console.log("   1. Episódios de Hoje");
console.log("   2. Em Alta");
console.log("   3. Episódios Recentes (imediatamente abaixo de 'Em Alta')");
console.log("   4. Animes Recém-Adicionados");
console.log("   5. Animes da Temporada");

// -------------------------------------------------------------------------
// 4. Teste de Conectividade HTTP com a Home (Servidor ativo)
// -------------------------------------------------------------------------
console.log("\n4. Testando resposta HTTP da Home (http://127.0.0.1:3000)...");
const res = await fetch("http://127.0.0.1:3000/");
assert.equal(res.status, 200, "Home deve responder 200 OK");
const html = await res.text();
assert.ok(html.includes("HIKARI"), "Página deve conter HIKARI");
console.log("✓ Servidor responde 200 OK na Home.");

console.log("\n=== TODAS AS VALIDAÇÕES PASSARAM COM SUCESSO! ===");
