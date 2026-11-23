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

let trackingCacheMod: typeof import("@/lib/tracking-client-cache");
let userClientCacheMod: typeof import("@/lib/anime-user-client-cache");

describe("Proteção contra flash e mutações de Minha Lista e Favorito", () => {
  before(async () => {
    (globalThis as { window?: unknown }).window = {
      localStorage: mockStorage,
      addEventListener: () => {},
      removeEventListener: () => {},
    };
    trackingCacheMod = await import("@/lib/tracking-client-cache");
    userClientCacheMod = await import("@/lib/anime-user-client-cache");
  });

  after(() => {
    if (originalWindow === undefined) {
      delete (globalThis as { window?: unknown }).window;
    } else {
      (globalThis as { window?: unknown }).window = originalWindow;
    }
  });

  beforeEach(() => {
    mockStorage.clear();
    trackingCacheMod.clearAllTrackingClientCaches();
    userClientCacheMod.clearAllAnimeUserClientCache();
  });

  it("1. Isola frescor e mutação de Favorito vs Minha Lista de forma independente", () => {
    const userId = "user-1";
    const candidateIds = ["anime-21", "21"];
    const initialObj = {
      userId,
      isFavorite: true,
      favFavoriteId: "fav-21",
    };

    trackingCacheMod.setActiveTrackingCacheUser(userId);
    trackingCacheMod.recordInitialAnimeTrackingLoaded(userId, candidateIds, initialObj);

    assert.equal(
      trackingCacheMod.isInitialAnimeTrackingFresh(userId, candidateIds, initialObj),
      true,
    );
    assert.equal(
      trackingCacheMod.isInitialAnimeFavoriteFresh(userId, candidateIds, initialObj),
      true,
    );

    // Mutação apenas de favorito (ex.: remoção na conta ou toggle nos detalhes)
    trackingCacheMod.seedAnimeFavoriteCache(userId, candidateIds, false, null);
    trackingCacheMod.markFavoriteMutated(userId, ["21"], "fav-21");

    // Favorito antigo fica stale, mas tracking continua fresco
    assert.equal(
      trackingCacheMod.isInitialAnimeFavoriteFresh(userId, candidateIds, initialObj),
      false,
    );
    assert.equal(
      trackingCacheMod.isInitialAnimeTrackingFresh(userId, candidateIds, initialObj),
      true,
    );
    assert.deepEqual(
      trackingCacheMod.getCachedAnimeFavorite(userId, candidateIds),
      { hit: true, isFavorite: false, favFavoriteId: null },
    );
  });

  it("2. Detecta mutação de favorito em voo mesmo por favoriteId quando candidateIds divergem", () => {
    const userId = "user-2";
    const initialObj = {
      userId,
      isFavorite: true,
      favFavoriteId: "fav-row-99",
    };

    trackingCacheMod.setActiveTrackingCacheUser(userId);
    const handle = trackingCacheMod.registerInFlightAnimeInitialState(
      new Promise(() => {}),
      trackingCacheMod.getTrackingCacheEpoch(),
    );
    const inFlight = trackingCacheMod.getInFlightAnimeInitialState(handle.requestId);
    assert.ok(inFlight);

    trackingCacheMod.recordInitialAnimeTrackingLoaded(userId, ["mal-999"], initialObj);

    // Remove usando outro targetId (ex.: ID interno do catálogo), mas mesmo favoriteId
    trackingCacheMod.markFavoriteMutated(userId, ["catalog-uuid-999"], "fav-row-99");

    assert.equal(
      trackingCacheMod.hasFavoriteMutationSince(
        inFlight.startSeq,
        userId,
        ["mal-999"],
        initialObj.favFavoriteId,
      ),
      true,
    );
    assert.equal(
      trackingCacheMod.isInitialAnimeFavoriteFresh(userId, ["mal-999"], initialObj),
      false,
    );

    trackingCacheMod.clearInFlightAnimeInitialState(handle.requestId);
  });

  it("3. updateAnimeFavoriteInClientCache só atualiza entradas existentes do dono verificado", () => {
    const userA = "user-a";
    const userB = "user-b";

    // Sem entrada prévia, não grava entrada incompleta
    userClientCacheMod.setAnimeUserClientCacheOwner(userA);
    const updatedEmpty = userClientCacheMod.updateAnimeFavoriteInClientCache(
      userA,
      { targetId: "21", favoriteId: "fav-21" },
      false,
      null,
    );
    assert.equal(updatedEmpty, false);
    assert.equal(userClientCacheMod.getAnimeUserClientCache(["21"], userA), null);

    // Com entrada completa existente de userA, atualiza apenas isFavorite/favFavoriteId preservando tracking
    userClientCacheMod.saveAnimeUserClientCache(
      ["21", "one-piece"],
      {
        trackingStatus: "watching",
        episodesWatched: 5,
        score: 9,
        dbAnimeId: "db-21",
        isFavorite: true,
        favFavoriteId: "fav-21",
      },
      userA,
    );

    // Tentativa de outro usuário não altera entrada de userA
    const crossUpdate = userClientCacheMod.updateAnimeFavoriteInClientCache(
      userB,
      { targetId: "21", favoriteId: "fav-21" },
      false,
      null,
    );
    assert.equal(crossUpdate, false);

    // Atualização pelo dono preserva status e episódios
    const ownerUpdate = userClientCacheMod.updateAnimeFavoriteInClientCache(
      userA,
      { targetId: "db-21", favoriteId: "fav-21" },
      false,
      null,
    );
    assert.equal(ownerUpdate, true);

    const cachedAfter = userClientCacheMod.getAnimeUserClientCache(["one-piece"], userA);
    assert.ok(cachedAfter);
    assert.equal(cachedAfter.trackingStatus, "watching");
    assert.equal(cachedAfter.episodesWatched, 5);
    assert.equal(cachedAfter.isFavorite, false);
    assert.equal(cachedAfter.favFavoriteId, null);
  });

  it("4. Isolamento entre contas limpa caches de favorito e tracking na troca ou logout", () => {
    const userA = "user-alpha";
    const userB = "user-beta";
    const candidateIds = ["anime-50"];
    const initialObjA = {
      userId: userA,
      isFavorite: true,
      favFavoriteId: "fav-a",
    };

    trackingCacheMod.setActiveTrackingCacheUser(userA);
    trackingCacheMod.recordInitialAnimeTrackingLoaded(userA, candidateIds, initialObjA);
    trackingCacheMod.seedAnimeFavoriteCache(userA, candidateIds, true, "fav-a");
    userClientCacheMod.saveAnimeUserClientCache(
      candidateIds,
      {
        trackingStatus: "completed",
        episodesWatched: 12,
        isFavorite: true,
        favFavoriteId: "fav-a",
      },
      userA,
    );

    // Troca para userB
    trackingCacheMod.setActiveTrackingCacheUser(userB);
    userClientCacheMod.setAnimeUserClientCacheOwner(userB);

    assert.equal(trackingCacheMod.getCachedAnimeFavorite(userB, candidateIds), null);
    assert.equal(trackingCacheMod.getCachedAnimeFavorite(userA, candidateIds), null);
    assert.equal(
      trackingCacheMod.isInitialAnimeFavoriteFresh(userB, candidateIds, initialObjA),
      false,
    );
    assert.equal(userClientCacheMod.getAnimeUserClientCache(candidateIds, userB), null);
    assert.equal(userClientCacheMod.getAnimeUserClientCache(candidateIds, userA), null);

    // Logout limpa totalmente
    trackingCacheMod.setActiveTrackingCacheUser(null);
    userClientCacheMod.clearAllAnimeUserClientCache();
    assert.equal(mockStorage.getItem("hikari_anime_user_cache_v1"), null);
  });
});
