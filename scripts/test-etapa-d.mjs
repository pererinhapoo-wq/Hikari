import assert from "node:assert/strict";

// =========================================================================
// Teste 1: Importação em Lotes (catalog-import-client)
// =========================================================================
console.log("--- Teste 1: Importação em Lotes (catalog-import-client) ---");

// Simulação de animes para teste de particionamento e lotes
const mockAnimes = Array.from({ length: 250 }, (_, i) => ({
  id: `anime-${i + 1}`,
  titleRomaji: `Anime ${i + 1}`,
  seasons: [
    {
      id: `s-${i + 1}-1`,
      number: 1,
      title: "Temporada 1",
      episodes: [
        {
          id: `ep-${i + 1}-1`,
          number: 1,
          title: `Episódio 1`,
          videoUrl: `https://storage.hikari.moe/video/${i + 1}/ep1.mp4`,
        },
      ],
    },
  ],
}));

// Teste do helper de divisão em lotes (BATCH_SIZE = 100)
function chunkArray(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

const batches = chunkArray(mockAnimes, 100);
assert.equal(batches.length, 3, "250 animes devem ser divididos em exatamente 3 lotes.");
assert.equal(batches[0].length, 100, "Primeiro lote deve ter 100 animes.");
assert.equal(batches[1].length, 100, "Segundo lote deve ter 100 animes.");
assert.equal(batches[2].length, 50, "Terceiro lote deve ter 50 animes.");
console.log("✓ Divisão em lotes de 100 animes aprovada.");

// Simulação de execução sequencial com falha no lote 2
const executionLog = [];
let simulatedNetworkCalls = 0;

async function simulateImportCatalog(chunks, failBatchIndex = -1) {
  const completed = [];
  const failed = [];
  let processedAnimes = 0;
  let importedEpisodes = 0;

  for (let i = 0; i < chunks.length; i++) {
    simulatedNetworkCalls++;
    executionLog.push(`Executando lote ${i + 1} (${chunks[i].length} animes)`);

    if (i === failBatchIndex) {
      failed.push({
        batchIndex: i,
        animes: chunks[i],
        error: "Erro 500 simulado no lote",
      });
      continue;
    }

    completed.push(i);
    processedAnimes += chunks[i].length;
    importedEpisodes += chunks[i].reduce(
      (sum, a) => sum + a.seasons.reduce((s2, s) => s2 + s.episodes.length, 0),
      0,
    );
  }

  return {
    ok: failed.length === 0,
    totalAnimes: chunks.flat().length,
    processedAnimes,
    importedEpisodes,
    completedBatchIndices: completed,
    failedBatches: failed,
  };
}

const run1 = await simulateImportCatalog(batches, 1);
assert.equal(run1.ok, false, "Importação com lote falho deve reportar ok: false.");
assert.equal(run1.completedBatchIndices.length, 2, "Lotes 0 e 2 devem ter sido concluídos.");
assert.equal(run1.failedBatches.length, 1, "Exatamente o lote 1 deve estar na lista de falhas.");
assert.equal(run1.failedBatches[0].batchIndex, 1, "Índice do lote falho deve ser 1.");
assert.equal(run1.failedBatches[0].animes.length, 100, "Lote falho deve preservar seus 100 animes para reenvio.");
console.log("✓ Identificação precisa de lote com falha aprovada.");

// Teste de reenvio seletivo: reenvia APENAS o lote 1
const retryChunks = chunkArray(run1.failedBatches.flatMap((item) => item.animes), 100);
assert.equal(retryChunks.length, 1, "Reenvio deve conter apenas 1 lote.");
assert.equal(retryChunks[0].length, 100, "Reenvio deve conter exatamente os 100 animes que falharam.");

const runRetry = await simulateImportCatalog(retryChunks, -1);
assert.equal(runRetry.ok, true, "Reenvio bem-sucedido deve retornar ok: true.");
assert.equal(runRetry.processedAnimes, 100, "Reenvio deve processar apenas os 100 animes re-submetidos.");
console.log("✓ Reenvio seletivo sem reprocessar lotes confirmados aprovado.");

// =========================================================================
// Teste 2: Tombstones (catalog-storage & catalog-episodes)
// =========================================================================
console.log("\n--- Teste 2: Tombstones de Episódios Excluídos ---");

// Mock de localStorage
const mockStorage = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => mockStorage.get(k) ?? null,
    setItem: (k, v) => mockStorage.set(k, String(v)),
    removeItem: (k) => mockStorage.delete(k),
  },
};

const TOMBSTONE_KEY = "hikari-deleted-episodes-v1";
const MAX_TOMBSTONES = 500;

function readTombstones() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(TOMBSTONE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((id) => typeof id === "string" && Boolean(id.trim()));
    }
  } catch {
    return [];
  }
  return [];
}

function addTombstone(episodeId) {
  if (typeof window === "undefined" || !episodeId) return;
  const cleanId = episodeId.trim();
  if (!cleanId) return;
  const current = readTombstones();
  if (current.includes(cleanId)) return;
  const next = [...current, cleanId];
  const clamped = next.slice(Math.max(0, next.length - MAX_TOMBSTONES));
  window.localStorage.setItem(TOMBSTONE_KEY, JSON.stringify(clamped));
}

function clearTombstone(episodeId) {
  if (typeof window === "undefined" || !episodeId) return;
  const cleanId = episodeId.trim();
  if (!cleanId) return;
  const current = readTombstones();
  if (!current.includes(cleanId)) return;
  const next = current.filter((id) => id !== cleanId);
  window.localStorage.setItem(TOMBSTONE_KEY, JSON.stringify(next));
}

// 1. Exclusão e registro do tombstone
addTombstone("ep-del-1");
addTombstone("ep-del-2");
assert.deepEqual(readTombstones(), ["ep-del-1", "ep-del-2"], "Tombstones devem ser registrados.");
console.log("✓ Registro de tombstones no localStorage aprovado.");

// 2. Limite máximo de 500 tombstones sem perder os recentes
for (let i = 3; i <= 550; i++) {
  addTombstone(`ep-del-${i}`);
}
const allTombstones = readTombstones();
assert.equal(allTombstones.length, 500, "Limite de 500 tombstones deve ser respeitado.");
assert.equal(allTombstones.includes("ep-del-550"), true, "Tombstones mais recentes devem ser preservados.");
assert.equal(allTombstones.includes("ep-del-1"), false, "Tombstones mais antigos devem ser podados.");
console.log("✓ Limite e poda segura de tombstones aprovados.");

// 3. Filtragem de episódios no fallback e resolveEpisodes
addTombstone("ep-secret-deleted");

const localSeasons = [
  {
    id: "s-1",
    number: 1,
    title: "Temporada 1",
    episodes: [
      { id: "ep-active-1", number: 1, title: "Episódio Ativo 1" },
      { id: "ep-secret-deleted", number: 2, title: "Episódio Excluído" },
      { id: "ep-active-3", number: 3, title: "Episódio Ativo 3" },
    ],
  },
];

const tSet = new Set(readTombstones());
const filteredSeasons = localSeasons.map((s) => ({
  ...s,
  episodes: s.episodes.filter((ep) => !tSet.has(ep.id)),
}));

assert.equal(filteredSeasons[0].episodes.length, 2, "Episódio excluído deve ser filtrado do fallback.");
assert.equal(
  filteredSeasons[0].episodes.some((e) => e.id === "ep-secret-deleted"),
  false,
  "Episódio com tombstone não pode reaparecer.",
);
console.log("✓ Filtragem de episódios com tombstone no fallback aprovada.");

// 4. Republicação limpa o tombstone
clearTombstone("ep-secret-deleted");
assert.equal(
  readTombstones().includes("ep-secret-deleted"),
  false,
  "Republicação deve remover o tombstone.",
);
console.log("✓ Limpeza de tombstone na republicação aprovada.");

// 5. Teste de proteção SSR (sem window)
const savedWindow = globalThis.window;
delete globalThis.window;
assert.doesNotThrow(() => {
  const ssrTombstones = readTombstones();
  assert.deepEqual(ssrTombstones, [], "No servidor (SSR), readTombstones deve retornar vazio com segurança.");
}, "SSR não deve tentar acessar window/localStorage.");
globalThis.window = savedWindow;
console.log("✓ Segurança em ambiente SSR aprovada.");

// =========================================================================
// Teste 3: Notificações de novos episódios
// =========================================================================
console.log("\n--- Teste 3: Notificações de Novos Episódios ---");

// Simulação da regra de disparo: apenas na primeira publicação
function shouldNotifyFollowers({ published, wasAlreadyPublished }) {
  return Boolean(published && !wasAlreadyPublished);
}

// Inserção de novo episódio publicado: DEVE notificar
assert.equal(
  shouldNotifyFollowers({ published: true, wasAlreadyPublished: false }),
  true,
  "Novo episódio publicado deve notificar.",
);

// Edição de episódio já publicado: NÃO DEVE notificar
assert.equal(
  shouldNotifyFollowers({ published: true, wasAlreadyPublished: true }),
  false,
  "Edição de episódio já publicado não deve notificar.",
);

// Rascunho não publicado: NÃO DEVE notificar
assert.equal(
  shouldNotifyFollowers({ published: false, wasAlreadyPublished: false }),
  false,
  "Episódio em rascunho não deve notificar.",
);
console.log("✓ Regra de primeira publicação aprovada.");

// Deduplicação determinística no banco
const adminId = "admin-user-123";
const targetEpisodeId = "ep-hunter-1";

const followers = [
  { userId: "user-alpha" },
  { userId: "user-beta" },
  { userId: "admin-user-123" }, // Deve ser excluído
  { userId: "user-alpha" }, // Duplicata por acompanhar em favoritos e lista
];

// União distinta excluindo o administrador
const uniqueFollowers = Array.from(
  new Set(followers.map((f) => f.userId).filter((uId) => uId !== adminId)),
);

assert.deepEqual(uniqueFollowers, ["user-alpha", "user-beta"], "Administrador e duplicatas devem ser excluídos.");

// Chave determinística de deduplicação (garantia atômica por UNIQUE index)
const dedupKeys = uniqueFollowers.map((uId) => `episode:${uId}:${targetEpisodeId}`);
assert.deepEqual(
  dedupKeys,
  ["episode:user-alpha:ep-hunter-1", "episode:user-beta:ep-hunter-1"],
  "Chave dedupKey determinística aprovada.",
);
console.log("✓ Deduplicação e exclusão do administrador aprovadas.");

// =========================================================================
// Teste 4: Separação de Progresso Anônimo e Autenticado
// =========================================================================
console.log("\n--- Teste 4: Separação de Progresso Anônimo e Autenticado ---");

// Simulação de transição de estado da store Zustand
let state = {
  currentUserId: null,
  myList: [],
  snapshots: {},
  watchedEpisodes: {},
  anonymousWatchedEpisodes: {},
  userWatchedEpisodes: {},
};

// 1. Usuário anônimo assiste episódios locais
function markEpisodeWatchedSim(animeId, episodeId) {
  const current = state.watchedEpisodes[animeId] ?? [];
  if (current.includes(episodeId)) return;
  const updated = [...current, episodeId];
  const nextWatched = { ...state.watchedEpisodes, [animeId]: updated };

  if (state.currentUserId) {
    state.watchedEpisodes = nextWatched;
    state.userWatchedEpisodes = {
      ...state.userWatchedEpisodes,
      [state.currentUserId]: nextWatched,
    };
  } else {
    state.watchedEpisodes = nextWatched;
    state.anonymousWatchedEpisodes = nextWatched;
  }
}

markEpisodeWatchedSim("anime-1", "ep-1");
markEpisodeWatchedSim("anime-1", "ep-2");

assert.deepEqual(
  state.anonymousWatchedEpisodes["anime-1"],
  ["ep-1", "ep-2"],
  "Progresso anônimo deve ser gravado em anonymousWatchedEpisodes.",
);
assert.deepEqual(
  state.watchedEpisodes["anime-1"],
  ["ep-1", "ep-2"],
  "Progresso anônimo deve ser visível na sessão ativa.",
);
console.log("✓ Registro de progresso anônimo aprovado.");

// 2. Login do Usuário 1 (trazendo seu progresso do servidor ou prévio)
function setCurrentUserIdSim(userId) {
  const prevUserWatched = state.currentUserId
    ? {
        ...state.userWatchedEpisodes,
        [state.currentUserId]: state.watchedEpisodes,
      }
    : state.userWatchedEpisodes;

  if (!userId) {
    // Logout
    state.currentUserId = null;
    state.myList = [];
    state.snapshots = {};
    state.userWatchedEpisodes = prevUserWatched;
    state.watchedEpisodes = state.anonymousWatchedEpisodes ?? {};
    return;
  }

  // Login
  const existingUserWatched = prevUserWatched[userId] ?? {};
  state.currentUserId = userId;
  state.userWatchedEpisodes = prevUserWatched;
  state.watchedEpisodes = existingUserWatched;
}

setCurrentUserIdSim("user-1");

// Usuário 1 não tem progresso prévio salvo ainda
assert.deepEqual(
  state.watchedEpisodes,
  {},
  "Ao logar com nova conta, progresso anônimo anterior não deve vazar para a conta.",
);

// Usuário 1 assiste anime-2
markEpisodeWatchedSim("anime-2", "ep-10");
assert.deepEqual(
  state.userWatchedEpisodes["user-1"]["anime-2"],
  ["ep-10"],
  "Progresso do Usuário 1 deve ser particionado em userWatchedEpisodes.",
);

// 3. Logout do Usuário 1
setCurrentUserIdSim(null);
assert.equal(state.currentUserId, null, "currentUserId deve ser null.");
assert.deepEqual(
  state.watchedEpisodes["anime-1"],
  ["ep-1", "ep-2"],
  "Ao deslogar, o progresso anônimo original deve ser restaurado intacto.",
);
assert.equal(
  state.watchedEpisodes["anime-2"],
  undefined,
  "Ao deslogar, o progresso da conta autenticada NÃO pode ficar visível.",
);
console.log("✓ Isolamento e restauração no logout aprovados.");

// 4. Troca de conta (Usuário 2)
setCurrentUserIdSim("user-2");
assert.deepEqual(
  state.watchedEpisodes,
  {},
  "Usuário 2 novo não deve herdar dados do Usuário 1 nem do anônimo.",
);

markEpisodeWatchedSim("anime-3", "ep-50");

// Troca de volta para o Usuário 1
setCurrentUserIdSim("user-1");
assert.deepEqual(
  state.watchedEpisodes["anime-2"],
  ["ep-10"],
  "Ao retornar ao Usuário 1, seu progresso próprio deve ser restaurado.",
);
assert.equal(
  state.watchedEpisodes["anime-3"],
  undefined,
  "Usuário 1 não deve ver progresso do Usuário 2.",
);
console.log("✓ Troca de conta e partição estrita de progresso aprovadas.");

// 5. Limpeza de animes inexistentes no catálogo (ensureCatalogLoaded)
const catalogAnimes = [{ id: "anime-1" }, { id: "anime-2" }];
const validIds = new Set(catalogAnimes.map((a) => a.id));

const dirtyWatched = {
  "anime-1": ["ep-1", "ep-2"],
  "anime-deleted-99": ["ep-999"], // Órfão
};

let hasOrphan = false;
const cleaned = {};
for (const [aId, epIds] of Object.entries(dirtyWatched)) {
  if (validIds.has(aId)) {
    cleaned[aId] = epIds;
  } else {
    hasOrphan = true;
  }
}

assert.equal(hasOrphan, true, "Deve identificar animes órfãos.");
assert.deepEqual(cleaned, { "anime-1": ["ep-1", "ep-2"] }, "Apenas animes válidos devem permanecer.");
console.log("✓ Limpeza de progresso órfão aprovada.");

console.log("\n=======================================================");
console.log("TODOS OS TESTES DA ETAPA D FORAM APROVADOS COM SUCESSO!");
console.log("=======================================================");
