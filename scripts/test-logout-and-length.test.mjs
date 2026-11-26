import assert from "node:assert/strict";
import { after, test } from "node:test";
import vm from "node:vm";
import React from "react";
import { tsImport } from "tsx/esm/api";
import { runSignOut } from "./sign-out-plan.mjs";

// Ensure authEnabled resolves to true in node test environment before loading auth modules
const prevViteAuthEnabled = process.env.VITE_AUTH_ENABLED;
process.env.VITE_AUTH_ENABLED = "true";

// Lightweight storage + window shim for browser-targeted helpers in Node
function createMemoryStorage() {
  const map = new Map();
  return {
    getItem(k) {
      return map.has(k) ? map.get(k) : null;
    },
    setItem(k, v) {
      map.set(String(k), String(v));
    },
    removeItem(k) {
      map.delete(String(k));
    },
    clear() {
      map.clear();
    },
  };
}

const mockSessionStorage = createMemoryStorage();
const mockLocalStorage = createMemoryStorage();
const hadWindow = "window" in globalThis;
const hadDocument = "document" in globalThis;
const hadLocalStorage = "localStorage" in globalThis;

if (!hadWindow) {
  globalThis.window = {
    sessionStorage: mockSessionStorage,
    localStorage: mockLocalStorage,
    location: {
      hostname: "hikaritv.cc.cd",
      origin: "https://hikaritv.cc.cd",
      href: "https://hikaritv.cc.cd/",
    },
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return true;
    },
  };
} else if (!globalThis.window.sessionStorage) {
  globalThis.window.sessionStorage = mockSessionStorage;
}
if (!hadDocument) {
  globalThis.document = {
    visibilityState: "visible",
    head: { appendChild() {} },
    createElement() {
      return { appendChild() {}, setAttribute() {} };
    },
    createTextNode() {
      return {};
    },
    getElementsByTagName() {
      return [{ appendChild() {} }];
    },
    addEventListener() {},
    removeEventListener() {},
  };
}
if (!hadLocalStorage) {
  globalThis.localStorage = mockLocalStorage;
}

after(() => {
  if (prevViteAuthEnabled === undefined) {
    delete process.env.VITE_AUTH_ENABLED;
  } else {
    process.env.VITE_AUTH_ENABLED = prevViteAuthEnabled;
  }
});

const [
  typesMod,
  overlayMod,
  storeMod,
  authClientMod,
  useCurrentUserMod,
] = await Promise.all([
  tsImport("../src/lib/types.ts", import.meta.url),
  tsImport("../src/lib/overlay.ts", import.meta.url),
  tsImport("../src/lib/store.ts", import.meta.url),
  tsImport("../src/lib/auth/client.ts", import.meta.url),
  tsImport("../src/lib/auth/use-current-user.ts", import.meta.url),
]);

const { localToAnime } = typesMod;
const { mergeDetail, resolveAdminAnimeWithRemote, mergeSeasonsWithRemote } = overlayMod;
const { useHikariStore } = storeMod;
const { authClient } = authClientMod;
const { useCurrentUserState, InitialSessionUserContext } = useCurrentUserMod;

// =============================================================================
// Teste 1: candidateAnimeIds serialization & .length safety
// =============================================================================
function generateInlineScript(candidateAnimeIds) {
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
    /Sign-out failed/,
  );

  assert.equal(storedBearer, "active-token", "Token não pode ser removido prematuramente se o logout falhou");
  assert.equal(clientCleared, false, "clearToken não deve ser chamado em falha no ambiente com cookies");
  assert.equal(redirected, false, "Não deve redirecionar em caso de falha");
});

// =============================================================================
// Teste 5: Recarregamento e isolamento real no useHikariStore.setCurrentUserId(null)
// =============================================================================
test("Teste 5 — Store real: setCurrentUserId(null) isola conta anterior e restaura estado anônimo", () => {
  useHikariStore.setState({
    currentUserId: "user-123",
    myList: ["anime-1", "anime-2"],
    snapshots: { "anime-1": { id: "anime-1" } },
    userLists: { "user-123": ["anime-1", "anime-2"] },
    userWatchedEpisodes: { "user-123": { "anime-1": ["ep-1"] } },
    anonymousWatchedEpisodes: { "anime-anon": ["ep-anon-1"] },
    anonymousContinueWatching: [
      {
        animeId: "anime-anon",
        animeTitle: "Anon Title",
        animeCover: "",
        episodeId: "ep-anon-1",
        episodeNumber: 1,
        updatedAt: 1000,
      },
    ],
    watchedEpisodes: { "anime-1": ["ep-1"] },
    continueWatching: [
      {
        animeId: "anime-1",
        animeTitle: "User Title",
        animeCover: "",
        episodeId: "ep-1",
        episodeNumber: 1,
        updatedAt: 2000,
      },
    ],
  });

  useHikariStore.getState().setCurrentUserId(null);
  const loggedOutState = useHikariStore.getState();

  assert.equal(loggedOutState.currentUserId, null, "currentUserId deve ser null");
  assert.deepEqual(loggedOutState.myList, [], "myList deve ficar vazia após logout");
  assert.deepEqual(loggedOutState.snapshots, {}, "snapshots devem ser limpos");
  assert.deepEqual(
    loggedOutState.watchedEpisodes,
    { "anime-anon": ["ep-anon-1"] },
    "watchedEpisodes deve restaurar o estado anônimo",
  );
  assert.equal(loggedOutState.continueWatching[0]?.animeId, "anime-anon");
  assert.deepEqual(
    loggedOutState.userWatchedEpisodes["user-123"],
    { "anime-1": ["ep-1"] },
    "Histórico do usuário anterior permanece particionado por userId",
  );
});

// =============================================================================
// Teste 6: Rules of Hooks em useCurrentUserState() nas transições de logout
// =============================================================================
function renderWithStrictHookDispatcher(fn, contextValue, expectedHookOrder = null) {
  const internals = React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  const prevH = internals.H;
  const hookOrder = [];

  internals.H = {
    useContext(ctx) {
      hookOrder.push("useContext");
      if (ctx === InitialSessionUserContext) {
        return contextValue;
      }
      return ctx._currentValue;
    },
    useSyncExternalStore(_sub, getSnap) {
      hookOrder.push("useSyncExternalStore");
      return getSnap();
    },
    useCallback(cb) {
      hookOrder.push("useCallback");
      return cb;
    },
    useRef(init) {
      hookOrder.push("useRef");
      return { current: init };
    },
    useEffect() {
      hookOrder.push("useEffect");
    },
    useMemo(factory) {
      hookOrder.push("useMemo");
      return factory();
    },
    useState(init) {
      hookOrder.push("useState");
      return [typeof init === "function" ? init() : init, () => {}];
    },
  };

  try {
    const result = fn();
    if (expectedHookOrder) {
      assert.equal(
        hookOrder.length,
        expectedHookOrder.length,
        `Quantidade de Hooks mudou entre renderizações (${expectedHookOrder.length} -> ${hookOrder.length})`,
      );
      assert.deepEqual(
        hookOrder,
        expectedHookOrder,
        "Ordem dos Hooks deve permanecer idêntica entre renderizações",
      );
    }
    return { result, hookOrder };
  } finally {
    internals.H = prevH;
  }
}

test("Teste 6 — useCurrentUserState mantém mesma quantidade e ordem de Hooks durante transição de logout", () => {
  mockSessionStorage.clear();
  const ssrUser = {
    id: "user-99",
    displayName: "Hikari User",
    primaryEmail: "user@hikaritv.cc.cd",
    profileImageUrl: null,
    profileNick: "hikari",
    isAdmin: false,
    isDevFallback: false,
  };

  // Render 1: autenticado (isSignedOut = false)
  authClient.$store.atoms.session.set({
    data: {
      user: {
        id: "user-99",
        name: "Hikari User",
        email: "user@hikaritv.cc.cd",
        image: null,
      },
      session: { id: "sess-1" },
    },
    error: null,
    isPending: false,
    isRefetching: false,
  });

  const render1 = renderWithStrictHookDispatcher(() => useCurrentUserState(), ssrUser);
  assert.equal(render1.result.user?.id, "user-99");
  assert.equal(render1.result.isPending, false);
  assert.ok(render1.hookOrder.length >= 3);

  // Render 2: hikari_signed_out = "true" mesmo com sessão em cache e initialSessionUser presentes
  mockSessionStorage.setItem("hikari_signed_out", "true");
  const render2 = renderWithStrictHookDispatcher(
    () => useCurrentUserState(),
    ssrUser,
    render1.hookOrder,
  );
  assert.equal(render2.result.user, null, "Sessão anterior não deve reaparecer com hikari_signed_out ativo");
  assert.equal(render2.result.isPending, false);

  // Render 3: sessão pendente no cliente com hikari_signed_out ainda ativo -> nunca vaza initialSessionUser
  authClient.$store.atoms.session.set({
    data: null,
    error: null,
    isPending: true,
    isRefetching: false,
  });
  const render3 = renderWithStrictHookDispatcher(
    () => useCurrentUserState(),
    ssrUser,
    render1.hookOrder,
  );
  assert.equal(render3.result.user, null);
  assert.equal(render3.result.isPending, false);

  // Render 4: novo estado autenticado após remover hikari_signed_out (isPending + initialSessionUser)
  mockSessionStorage.removeItem("hikari_signed_out");
  const render4 = renderWithStrictHookDispatcher(
    () => useCurrentUserState(),
    ssrUser,
    render1.hookOrder,
  );
  assert.equal(render4.result.user?.id, "user-99");
  assert.equal(render4.result.isPending, false);

  // Render 5: visitante sem initialSessionUser e isPending = true
  const render5 = renderWithStrictHookDispatcher(
    () => useCurrentUserState(),
    null,
    render1.hookOrder,
  );
  assert.equal(render5.result.user, null);
  assert.equal(render5.result.isPending, true);

  mockSessionStorage.clear();
});

// =============================================================================
// Teste 7: Normalização de dados incompletos em localToAnime, mergeDetail e overlay
// =============================================================================
function makeValidRemoteAnime(overrides = {}) {
  return {
    id: "16498",
    anilistId: 16498,
    malId: 16498,
    titles: { romaji: "Shingeki no Kyojin", english: "Attack on Titan", native: "進撃の巨人" },
    cover: "https://cdn.example/cover.jpg",
    banner: "https://cdn.example/banner.jpg",
    synopsis: "Sinopse remota",
    score: 85,
    genres: ["Action", "Drama"],
    format: "TV",
    status: "FINISHED",
    episodesCount: 25,
    season: "SPRING",
    year: 2013,
    source: "anilist",
    studios: ["Wit Studio"],
    streamingEpisodes: [],
    seasons: [
      {
        id: "season-1",
        number: 1,
        title: "Temporada 1",
        episodes: [
          {
            id: "ep-1",
            number: 1,
            title: "Episódio 1",
            thumbnail: "",
            videoUrl: "https://cdn.example/ep1.m3u8",
            published: true,
          },
        ],
      },
    ],
    recommendations: [
      {
        id: "11061",
        title: "Hunter x Hunter",
        cover: "https://cdn.example/hxh.jpg",
        score: 90,
        format: "TV",
      },
    ],
    ...overrides,
  };
}

test("Teste 7 — localToAnime normaliza genres, seasons e seasons sem episodes", () => {
  const incompleteLocal = {
    id: "local-1",
    anilistId: 16498,
    titleRomaji: "Shingeki",
    titleEnglish: "Attack on Titan",
    titleNative: "進撃の巨人",
    cover: "https://cdn.example/local-cover.jpg",
    synopsis: "Sinopse local",
    genres: undefined,
    seasons: [
      { id: "s1", number: 1, title: "T1", episodes: undefined },
      null,
    ],
    updatedAt: "2026-01-01T00:00:00.000Z",
  };

  const normalized = localToAnime(incompleteLocal);
  assert.deepEqual(normalized.genres, []);
  assert.equal(normalized.genres.length, 0);
  assert.deepEqual(normalized.recommendations, []);
  assert.equal(normalized.recommendations.length, 0);
  assert.equal(normalized.seasons.length, 1);
  assert.deepEqual(normalized.seasons[0].episodes, []);
  assert.equal(normalized.seasons[0].episodes.length, 0);

  const withoutSeasons = localToAnime({
    ...incompleteLocal,
    seasons: undefined,
  });
  assert.deepEqual(withoutSeasons.seasons, []);
  assert.equal(withoutSeasons.seasons.length, 0);
});

test("Teste 8 — mergeDetail protege recommendations/genres/seasons incompletos e preserva remote válido", () => {
  // Caso A: remote com recommendations e genres undefined (ex: payload parcial/corrompido)
  const brokenRemote = makeValidRemoteAnime({
    genres: undefined,
    recommendations: undefined,
    seasons: [{ id: "s1", number: 1, title: "T1", episodes: undefined }],
  });
  const mergedBroken = mergeDetail(brokenRemote, "16498", []);
  assert.ok(mergedBroken);
  assert.equal(mergedBroken.genres.length, 0);
  assert.equal(mergedBroken.recommendations.length, 0);
  assert.equal(mergedBroken.seasons[0].episodes.length, 0);

  // Caso B: registro local incompleto (sem genres e sem episodes) + remote válido (byId e byAni)
  // Deve preservar genres e recommendations válidos do remote em vez de sobrescrever com []!
  const validRemote = makeValidRemoteAnime();
  const incompleteLocalById = {
    id: "16498",
    anilistId: 16498,
    titleRomaji: "Shingeki no Kyojin",
    titleEnglish: "Attack on Titan",
    titleNative: "進撃の巨人",
    cover: "https://cdn.example/c.jpg",
    synopsis: "",
    genres: undefined,
    seasons: undefined,
    updatedAt: "2026-01-01T00:00:00.000Z",
  };

  const mergedById = mergeDetail(validRemote, "16498", [incompleteLocalById]);
  assert.deepEqual(mergedById.genres, ["Action", "Drama"]);
  assert.equal(mergedById.recommendations.length, 1);
  assert.equal(mergedById.seasons[0].episodes.length, 1);

  const incompleteLocalByAni = {
    ...incompleteLocalById,
    id: "local-shingeki",
  };
  const mergedByAni = mergeDetail(validRemote, "16498", [incompleteLocalByAni]);
  assert.deepEqual(mergedByAni.genres, ["Action", "Drama"]);
  assert.equal(mergedByAni.recommendations.length, 1);
  assert.equal(mergedByAni.seasons[0].episodes.length, 1);

  // Caso C: mergeDetail apenas local (remote null) com registro antigo incompleto
  const localOnly = mergeDetail(null, "local-shingeki", [incompleteLocalByAni]);
  assert.ok(localOnly);
  assert.equal(localOnly.genres.length, 0);
  assert.equal(localOnly.recommendations.length, 0);
  assert.equal(localOnly.seasons.length, 0);
});

test("Teste 9 — resolveAdminAnimeWithRemote e mergeSeasonsWithRemote toleram arrays ausentes", () => {
  const remote = makeValidRemoteAnime();
  const storedMatch = {
    id: "local-admin-1",
    anilistId: 16498,
    titleRomaji: "Old",
    titleEnglish: "Old",
    titleNative: "旧",
    cover: "",
    synopsis: "",
    genres: undefined,
    seasons: [{ id: "s1", number: 1, title: "T1", episodes: undefined }],
    updatedAt: "2020-01-01T00:00:00.000Z",
  };

  const resolvedAdmin = resolveAdminAnimeWithRemote(storedMatch, remote);
  assert.ok(resolvedAdmin);
  assert.deepEqual(resolvedAdmin.genres, ["Action", "Drama"]);
  assert.equal(resolvedAdmin.seasons[0].episodes.length, 1);

  const mergedSeasons = mergeSeasonsWithRemote(
    [{ id: "s1", number: 1, title: "T1", episodes: undefined }],
    undefined,
  );
  assert.equal(mergedSeasons.length, 1);
  assert.deepEqual(mergedSeasons[0].episodes, []);
});

test("Teste 10 — Comparação defensiva de temporadas incompletas e guardas de renderização", () => {
  const sameSeasonsWithMissingEpisodes = (baseline, seasons) =>
    Array.isArray(baseline) &&
    Array.isArray(seasons) &&
    baseline.length === seasons.length &&
    baseline.every((s, idx) => {
      const next = seasons[idx];
      const sEpisodes = Array.isArray(s?.episodes) ? s.episodes : [];
      const nextEpisodes = Array.isArray(next?.episodes) ? next.episodes : [];
      if (!next || s.id !== next.id || sEpisodes.length !== nextEpisodes.length) {
        return false;
      }
      return sEpisodes.every((ep, epIdx) => ep.id === nextEpisodes[epIdx]?.id);
    });

  assert.equal(
    sameSeasonsWithMissingEpisodes(
      [{ id: "s1", number: 1, title: "T1", episodes: undefined }],
      [{ id: "s1", number: 1, title: "T1", episodes: [] }],
    ),
    true,
  );

  const partial = mergeDetail(
    makeValidRemoteAnime({ genres: null, recommendations: null }),
    "16498",
    [],
  );
  assert.equal(Array.isArray(partial.genres) && partial.genres.length > 0, false);
  assert.equal(
    Array.isArray(partial.recommendations) && partial.recommendations.length > 0,
    false,
  );
});
