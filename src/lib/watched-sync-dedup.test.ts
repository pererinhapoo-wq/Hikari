import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length(): number {
    return this.map.size;
  }
  clear(): void {
    this.map.clear();
  }
  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) ?? null) : null;
  }
  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

const mockStorage = new MemoryStorage();
const originalWindow = (globalThis as { window?: unknown }).window;
const originalDocument = (globalThis as { document?: unknown }).document;

let storeMod: typeof import("@/lib/store");
let cacheMod: typeof import("@/lib/tracking-client-cache");

describe("Deduplicação de episódios assistidos (fetchAnimeUserInitialState vs syncAuthenticatedWatchedEpisodes)", () => {
  before(async () => {
    (globalThis as { window?: unknown }).window = {
      localStorage: mockStorage,
      addEventListener: () => {},
      removeEventListener: () => {},
    };
    (globalThis as { document?: unknown }).document = {
      visibilityState: "visible",
      addEventListener: () => {},
      removeEventListener: () => {},
    };
    cacheMod = await import("@/lib/tracking-client-cache");
    storeMod = await import("@/lib/store");
  });

  after(() => {
    if (originalWindow === undefined) {
      delete (globalThis as { window?: unknown }).window;
    } else {
      (globalThis as { window?: unknown }).window = originalWindow;
    }
    if (originalDocument === undefined) {
      delete (globalThis as { document?: unknown }).document;
    } else {
      (globalThis as { document?: unknown }).document = originalDocument;
    }
  });

  beforeEach(() => {
    mockStorage.clear();
    storeMod.useHikariStore.getState().setCurrentUserId(null);
    storeMod.useHikariStore.setState({
      watchedEpisodes: {},
      anonymousWatchedEpisodes: {},
      userWatchedEpisodes: {},
      myList: [],
      userLists: {},
    });
    cacheMod.clearAllTrackingClientCaches();
  });

  it("1. Usuário autenticado COM episódios assistidos: sincroniza store/localStorage e evita segunda consulta", async () => {
    const userId = "user-with-watched";
    const candidateIds = ["anime-100", "anilist-100", "mal-100"];

    // Simula ordem de mount do React: AnimePageContent filho roda antes do Shell
    assert.equal(storeMod.useHikariStore.getState().currentUserId, null);

    // Sem setCurrentUserId prévio, hydrateAnimeWatchedEpisodes rejeita por segurança
    const rejected = storeMod.hydrateAnimeWatchedEpisodes(
      userId,
      candidateIds,
      ["ep-1", "ep-2"],
    );
    assert.equal(rejected, false);

    // Ao sincronizar currentUserId antes (como AnimePageContent agora garante):
    storeMod.useHikariStore.getState().setCurrentUserId(userId);
    const hydrated = storeMod.hydrateAnimeWatchedEpisodes(
      userId,
      candidateIds,
      ["ep-1", "ep-2", "ep-1"],
    );
    assert.equal(hydrated, true);

    const state = storeMod.useHikariStore.getState();
    assert.deepEqual(state.userWatchedEpisodes[userId]["anime-100"], ["ep-1", "ep-2"]);
    assert.deepEqual(state.userWatchedEpisodes[userId]["anilist-100"], ["ep-1", "ep-2"]);
    assert.deepEqual(state.watchedEpisodes["anime-100"], ["ep-1", "ep-2"]);

    // Persiste no localStorage (hikari-user-state-v1)
    const persistedRaw = mockStorage.getItem("hikari-user-state-v1");
    assert.ok(persistedRaw);
    const persisted = JSON.parse(persistedRaw);
    assert.deepEqual(
      persisted.state.userWatchedEpisodes[userId]["anime-100"],
      ["ep-1", "ep-2"],
    );

    // Chamada subsequente de syncAuthenticatedWatchedEpisodes retorna em curto-circuito sem consultar servidor
    const origWarn = console.warn;
    let warnCount = 0;
    console.warn = () => {
      warnCount += 1;
    };
    try {
      await storeMod.syncAuthenticatedWatchedEpisodes(userId, "anime-100", {
        candidateIds,
      });
    } finally {
      console.warn = origWarn;
    }
    assert.equal(warnCount, 0);
    assert.equal(storeMod.useHikariStore.getState().isEpisodeWatched("anime-100", "ep-2"), true);
  });

  it("2. Usuário autenticado SEM episódios assistidos ([]): hidrata lista vazia e evita segunda consulta", async () => {
    const userId = "user-empty-watched";
    const candidateIds = ["anime-200", "server-200"];

    storeMod.useHikariStore.getState().setCurrentUserId(userId);
    const hydrated = storeMod.hydrateAnimeWatchedEpisodes(userId, candidateIds, []);
    assert.equal(hydrated, true);

    const state = storeMod.useHikariStore.getState();
    assert.deepEqual(state.userWatchedEpisodes[userId]["anime-200"], []);
    assert.deepEqual(state.watchedEpisodes["anime-200"], []);

    // Mesmo com [], a chave está marcada como sincronizada; syncAuthenticatedWatchedEpisodes não consulta de novo
    await storeMod.syncAuthenticatedWatchedEpisodes(userId, "anime-200", {
      candidateIds,
    });
    assert.equal(state.isEpisodeWatched("anime-200", "ep-1"), false);
  });

  it("3. Timeout do loader (>80ms/250ms): reaproveita a mesma Promise em andamento de fetchAnimeUserInitialState", async () => {
    const userId = "user-slow-loader";
    const candidateIds = ["anime-300"];
    const epochAtStart = cacheMod.getTrackingCacheEpoch();

    let serverCalls = 0;
    let resolveServer!: (val: { userId: string; watchedEpisodeIds: string[] }) => void;
    const serverPromise = new Promise<{ userId: string; watchedEpisodeIds: string[] }>(
      (resolve) => {
        resolveServer = resolve;
      },
    );
    const trackedFetch = (() => {
      serverCalls += 1;
      return serverPromise;
    })();

    const handle = cacheMod.registerInFlightAnimeInitialState(
      trackedFetch,
      epochAtStart,
    );
    assert.ok(handle.requestId.startsWith("init-"));
    assert.equal(handle.isSettled(), false);

    // Mesmo após setCurrentUserId na primeira hidratação (null -> userId), o request em voo permanece válido
    storeMod.useHikariStore.getState().setCurrentUserId(userId);

    const inFlight = cacheMod.getInFlightAnimeInitialState<{
      userId: string;
      watchedEpisodeIds: string[];
    }>(handle.requestId);
    assert.ok(inFlight);
    assert.equal(inFlight.epoch, cacheMod.getTrackingCacheEpoch());

    // Simula chegada da resposta do único fetch
    resolveServer({ userId, watchedEpisodeIds: ["ep-7", "ep-8"] });
    const resolved = await inFlight.promise;
    assert.ok(resolved);
    assert.equal(resolved.userId, userId);
    assert.equal(serverCalls, 1);

    cacheMod.consumeInFlightAnimeInitialState(handle.requestId);
    assert.equal(cacheMod.getInFlightAnimeInitialState(handle.requestId), null);

    storeMod.hydrateAnimeWatchedEpisodes(
      userId,
      candidateIds,
      resolved.watchedEpisodeIds,
    );
    assert.deepEqual(
      storeMod.useHikariStore.getState().userWatchedEpisodes[userId]["anime-300"],
      ["ep-7", "ep-8"],
    );
  });

  it("4. Usuário deslogado: não hidrata nem consulta user_watched_episode e preserva progresso anônimo", async () => {
    storeMod.useHikariStore.getState().setCurrentUserId(null);
    storeMod.useHikariStore.getState().markEpisodeWatched("anime-400", "ep-anon-1");

    const hydrated = storeMod.hydrateAnimeWatchedEpisodes(
      "",
      ["anime-400"],
      ["ep-server"],
    );
    assert.equal(hydrated, false);

    await storeMod.syncAuthenticatedWatchedEpisodes("", "anime-400");

    const state = storeMod.useHikariStore.getState();
    assert.equal(state.currentUserId, null);
    assert.deepEqual(state.anonymousWatchedEpisodes["anime-400"], ["ep-anon-1"]);
    assert.deepEqual(state.watchedEpisodes["anime-400"], ["ep-anon-1"]);
    assert.equal(state.isEpisodeWatched("anime-400", "ep-anon-1"), true);
  });

  it("5. Alteração manual de acompanhamento invalida frescor inicial e detecta mutação durante voo", () => {
    const userId = "user-manual-edit";
    const candidateIds = ["anime-500"];
    const initialObj = { userId, watchedEpisodeIds: ["ep-1"] };

    storeMod.useHikariStore.getState().setCurrentUserId(userId);

    const handle = cacheMod.registerInFlightAnimeInitialState(
      new Promise(() => {}),
      cacheMod.getTrackingCacheEpoch(),
    );
    const inFlight = cacheMod.getInFlightAnimeInitialState(handle.requestId);
    assert.ok(inFlight);

    cacheMod.recordInitialAnimeTrackingLoaded(userId, candidateIds, initialObj);
    assert.equal(
      cacheMod.isInitialAnimeTrackingFresh(userId, candidateIds, initialObj),
      true,
    );
    assert.equal(
      cacheMod.hasTrackedMutationSince(inFlight.startSeq, userId, candidateIds),
      false,
    );

    // Simula alteração manual do usuário (ex.: modal ou ProfileTrackingSpace)
    cacheMod.markTrackingMutated(userId, candidateIds);
    storeMod.invalidateWatchedEpisodesCache(userId, candidateIds);

    assert.equal(
      cacheMod.isInitialAnimeTrackingFresh(userId, candidateIds, initialObj),
      false,
    );
    assert.equal(
      cacheMod.hasTrackedMutationSince(inFlight.startSeq, userId, candidateIds),
      true,
    );

    cacheMod.clearInFlightAnimeInitialState(handle.requestId);
  });

  it("6. Isolamento entre usuários: troca de conta invalida handoff em andamento e não mistura listas", async () => {
    const userA = "user-alpha";
    const userB = "user-beta";
    const candidateIds = ["anime-600"];

    storeMod.useHikariStore.getState().setCurrentUserId(userA);
    storeMod.hydrateAnimeWatchedEpisodes(userA, candidateIds, ["ep-a1", "ep-a2"]);

    const initialObjA = { userId: userA, watchedEpisodeIds: ["ep-a1", "ep-a2"] };
    cacheMod.recordInitialAnimeTrackingLoaded(userA, candidateIds, initialObjA);
    const handleA = cacheMod.registerInFlightAnimeInitialState(
      Promise.resolve(initialObjA),
      cacheMod.getTrackingCacheEpoch(),
    );

    // Troca para usuário B
    storeMod.useHikariStore.getState().setCurrentUserId(userB);

    // Handoff do usuário A deve ter sido invalidado e descartado pela troca de epoch/usuário
    assert.equal(cacheMod.getInFlightAnimeInitialState(handleA.requestId), null);
    assert.equal(
      cacheMod.isInitialAnimeTrackingFresh(userB, candidateIds, initialObjA),
      false,
    );

    // Hydrate com ID do usuário A enquanto usuário ativo é B deve ser recusado
    const crossHydrate = storeMod.hydrateAnimeWatchedEpisodes(
      userA,
      candidateIds,
      ["ep-leak"],
    );
    assert.equal(crossHydrate, false);

    // Usuário B hidrata apenas seu próprio estado e não vê episódios do usuário A
    storeMod.hydrateAnimeWatchedEpisodes(userB, candidateIds, ["ep-b1"]);
    const state = storeMod.useHikariStore.getState();
    assert.deepEqual(state.watchedEpisodes["anime-600"], ["ep-b1"]);
    assert.deepEqual(state.userWatchedEpisodes[userB]["anime-600"], ["ep-b1"]);
    assert.deepEqual(state.userWatchedEpisodes[userA]["anime-600"], ["ep-a1", "ep-a2"]);
    assert.equal(state.isEpisodeWatched("anime-600", "ep-a1"), false);
    assert.equal(state.isEpisodeWatched("anime-600", "ep-b1"), true);
  });
});
