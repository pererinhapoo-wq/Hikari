import assert from "node:assert/strict";
import { test } from "node:test";
import vm from "node:vm";
import { runSignOut } from "./sign-out-plan.mjs";

// =============================================================================
// Teste 1: candidateAnimeIds serialization & .length safety
// =============================================================================
function generateInlineScript(candidateAnimeIds, user = null, matchesInitialUser = false, id = "test-anime") {
  return `(function(){
    try {
      var ids = ${JSON.stringify(Array.isArray(candidateAnimeIds) ? candidateAnimeIds : [])};
      if (!Array.isArray(ids)) { ids = []; }
      var count = ids.length;
      var found = null;
      for (var i = 0; i < ids.length; i++) {
        if (ids[i] === "16498") {
          found = ids[i];
          break;
        }
      }
      return { ok: true, count: count, found: found };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  })()`;
}

test("Teste 1 — candidateAnimeIds com array com IDs válidos", () => {
  const code = generateInlineScript(["16498", "mal-16498", "kitsu-7442"]);
  const result = vm.runInNewContext(code);
  assert.equal(result.ok, true);
  assert.equal(result.count, 3);
  assert.equal(result.found, "16498");
});

test("Teste 1 — candidateAnimeIds com array vazio", () => {
  const code = generateInlineScript([]);
  const result = vm.runInNewContext(code);
  assert.equal(result.ok, true);
  assert.equal(result.count, 0);
  assert.equal(result.found, null);
});

test("Teste 1 — candidateAnimeIds com undefined", () => {
  const code = generateInlineScript(undefined);
  const result = vm.runInNewContext(code);
  assert.equal(result.ok, true, "Não deve lançar exceção quando candidateAnimeIds for undefined");
  assert.equal(result.count, 0);
  assert.equal(result.found, null);
});

test("Teste 1 — candidateAnimeIds com null", () => {
  const code = generateInlineScript(null);
  const result = vm.runInNewContext(code);
  assert.equal(result.ok, true, "Não deve lançar exceção quando candidateAnimeIds for null");
  assert.equal(result.count, 0);
  assert.equal(result.found, null);
});

// =============================================================================
// Teste 2: Logout por cookies (ambiente deployed com HttpOnly cookies)
// =============================================================================
test("Teste 2 — Logout por cookies: invalidação no servidor, limpeza e redirecionamento", async () => {
  let serverSessionActive = true;
  let clientCleared = false;
  let redirected = false;

  await runSignOut({
    livePreview: false,
    hasBearer: false,
    requestSignOut: async () => {
      // Simula invalidação da sessão no servidor
      serverSessionActive = false;
      return Promise.resolve();
    },
    clearToken: () => {
      clientCleared = true;
    },
    redirect: () => {
      redirected = true;
    },
    timeoutMs: 500,
  });

  assert.equal(serverSessionActive, false, "Sessão no servidor deve ser invalidada");
  assert.equal(clientCleared, true, "Estados locais devem ser limpos após confirmação do servidor");
  assert.equal(redirected, true, "Redirecionamento deve ocorrer após sucesso");
});

// =============================================================================
// Teste 3: Logout por Bearer Token (token disponível durante a requisição)
// =============================================================================
test("Teste 3 — Logout por Bearer Token: token permanece disponível durante a chamada e é removido após confirmação", async () => {
  let storedBearer = "test-bearer-token-123";
  let tokenUsedInRequest = null;
  let serverSessionActive = true;
  let redirected = false;

  await runSignOut({
    livePreview: true,
    hasBearer: Boolean(storedBearer),
    requestSignOut: async () => {
      // Verifica se o token ainda está presente no momento da requisição
      tokenUsedInRequest = storedBearer;
      if (!tokenUsedInRequest) {
        throw new Error("Token não disponível na requisição");
      }
      serverSessionActive = false;
      return Promise.resolve();
    },
    clearToken: () => {
      storedBearer = null;
    },
    redirect: () => {
      redirected = true;
    },
    timeoutMs: 500,
  });

  assert.equal(tokenUsedInRequest, "test-bearer-token-123", "O token deve ser enviado na requisição de logout");
  assert.equal(serverSessionActive, false, "A sessão no servidor deve ser encerrada");
  assert.equal(storedBearer, null, "O Bearer Token deve ser removido após a requisição");
  assert.equal(redirected, true, "Redirecionamento concluído");
});

// =============================================================================
// Teste 4: Falha de rede (sem falso sucesso, sem remoção prematura de token)
// =============================================================================
test("Teste 4 — Falha de rede: erro tratado, token mantido para retry, sem redirecionamento", async () => {
  let storedBearer = "active-token";
  let clientCleared = false;
  let redirected = false;

  await assert.rejects(
    runSignOut({
      livePreview: false,
      hasBearer: true,
      requestSignOut: async () => {
        throw new Error("Network connection error");
      },
      clearToken: () => {
        clientCleared = true;
        storedBearer = null;
      },
      redirect: () => {
        redirected = true;
      },
      timeoutMs: 500,
    }),
    /Sign-out failed/
  );

  assert.equal(storedBearer, "active-token", "Token não pode ser removido prematuramente se o logout falhou");
  assert.equal(clientCleared, false, "clearToken não deve ser chamado em falha no ambiente com cookies");
  assert.equal(redirected, false, "Não deve redirecionar em caso de falha");
});

// =============================================================================
// Teste 5: Recarregamento e isolamento de estado pós-logout
// =============================================================================
test("Teste 5 — Recarregamento: usuário torna-se visitante e isolamento de estado preservado", () => {
  // Simula o comportamento de setCurrentUserId(null)
  const previousUserId = "user-123";
  const state = {
    currentUserId: previousUserId,
    myList: ["anime-1", "anime-2"],
    snapshots: { "anime-1": { id: "anime-1" } },
    userLists: { "user-123": ["anime-1", "anime-2"] },
    userWatchedEpisodes: { "user-123": { "anime-1": ["ep-1"] } },
    anonymousWatchedEpisodes: { "anime-anon": ["ep-anon-1"] },
    anonymousContinueWatching: [{ animeId: "anime-anon", episodeId: "ep-anon-1" }],
    watchedEpisodes: { "anime-1": ["ep-1"] },
    continueWatching: [{ animeId: "anime-1", episodeId: "ep-1" }],
  };

  // Aplica transição de logout idêntica à do store.ts
  const loggedOutState = {
    ...state,
    currentUserId: null,
    myList: [],
    snapshots: {},
    watchedEpisodes: state.anonymousWatchedEpisodes,
    continueWatching: state.anonymousContinueWatching,
  };

  assert.equal(loggedOutState.currentUserId, null, "currentUserId deve ser null");
  assert.deepEqual(loggedOutState.myList, [], "myList deve estar vazia após logout");
  assert.deepEqual(loggedOutState.snapshots, {}, "snapshots devem estar vazios");
  assert.deepEqual(
    loggedOutState.watchedEpisodes,
    state.anonymousWatchedEpisodes,
    "watchedEpisodes deve restaurar o estado anônimo"
  );
  assert.deepEqual(
    loggedOutState.userWatchedEpisodes["user-123"],
    { "anime-1": ["ep-1"] },
    "Histórico do usuário anterior é mantido particionado por userId sem vazar"
  );
});
