import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { pruneProgressKeys, withQuotaRetry } from "./storage-prune.ts";

class MockLocalStorage implements Storage {
  private map = new Map<string, string>();
  public quotaLimitBytes = Number.POSITIVE_INFINITY;

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
    const keys = Array.from(this.map.keys());
    return keys[index] ?? null;
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }

  setItem(key: string, value: string): void {
    const nextSize = this.totalBytesWithout(key) + key.length + value.length;
    if (nextSize > this.quotaLimitBytes) {
      throw new DOMException(
        "Failed to execute 'setItem' on 'Storage': Setting the value exceeded the quota.",
        "QuotaExceededError",
      );
    }
    this.map.set(key, value);
  }

  private totalBytesWithout(excludeKey: string): number {
    let total = 0;
    for (const [k, v] of this.map.entries()) {
      if (k === excludeKey) continue;
      total += k.length + v.length;
    }
    return total;
  }
}

describe("storage-prune — preservação de dados e recuperação de quota", () => {
  let mockStorage: MockLocalStorage;
  const originalWindow = (globalThis as { window?: unknown }).window;

  beforeEach(() => {
    mockStorage = new MockLocalStorage();
    (globalThis as { window?: unknown }).window = {
      localStorage: mockStorage,
    };
  });

  afterEach(() => {
    if (originalWindow === undefined) {
      delete (globalThis as { window?: unknown }).window;
    } else {
      (globalThis as { window?: unknown }).window = originalWindow;
    }
  });

  it("1. Armazenamento normal executa writeFn uma única vez sem podar dados", () => {
    mockStorage.setItem("hikari-user-state-v1", '{"state":{"myList":["a1"]}}');
    mockStorage.setItem("hikari-progress-a2-ep1", '{"time":120}');

    let calls = 0;
    const result = withQuotaRetry(() => {
      calls += 1;
      mockStorage.setItem("hikari-user-state-v1", '{"state":{"myList":["a1","a3"]}}');
      return "saved";
    });

    assert.equal(result, "saved");
    assert.equal(calls, 1);
    assert.equal(mockStorage.getItem("hikari-progress-a2-ep1"), '{"time":120}');
  });

  it("2. Recupera erro de quota podando chaves antigas de progresso e preservando dados legítimos", () => {
    mockStorage.setItem("hikari-user-state-v1", '{"state":{"myList":["fav1"]}}');
    mockStorage.setItem("hikari-account-email", "user@example.com");
    mockStorage.setItem("hikari-notifications-likes", "true");
    mockStorage.setItem("hikari-player-autoplay", "true");
    mockStorage.setItem("nova_player_playback_rate", "1.25");
    mockStorage.setItem("hikari-deleted-episodes-v1", "[]");
    mockStorage.setItem("hikari-episode-outbox-v1", "[]");
    mockStorage.setItem("hikari_anime_user_cache_v1", '{"ownerUserId":"u1","entries":{}}');
    mockStorage.setItem("better-auth.session_token", "secret-session");
    mockStorage.setItem(
      "hikari-progress-fav1-ep1",
      JSON.stringify({ animeId: "fav1", updatedAt: Date.now() }),
    );
    mockStorage.setItem("hikari-progress-stale1-ep1", "x".repeat(400));

    // Limite apertado que obriga a liberar espaço da chave não prioritária
    const currentNonTargetBytes =
      "hikari-user-state-v1".length +
      '{"state":{"myList":["fav1"]}}'.length;
    let totalNow = 0;
    for (let i = 0; i < mockStorage.length; i += 1) {
      const k = mockStorage.key(i)!;
      totalNow += k.length + (mockStorage.getItem(k)?.length ?? 0);
    }
    mockStorage.quotaLimitBytes = totalNow - 100;

    let attempts = 0;
    withQuotaRetry(
      () => {
        attempts += 1;
        mockStorage.setItem(
          "hikari-user-state-v1",
          '{"state":{"myList":["fav1","fav2"]}}',
        );
      },
      { priorityAnimeIds: ["fav1"] },
    );

    assert.equal(attempts, 2);
    assert.ok(currentNonTargetBytes > 0);
    assert.equal(
      mockStorage.getItem("hikari-user-state-v1"),
      '{"state":{"myList":["fav1","fav2"]}}',
    );
    assert.equal(mockStorage.getItem("hikari-progress-stale1-ep1"), null);
    assert.ok(mockStorage.getItem("hikari-progress-fav1-ep1"));
    assert.equal(mockStorage.getItem("hikari-account-email"), "user@example.com");
    assert.equal(mockStorage.getItem("hikari-notifications-likes"), "true");
    assert.equal(mockStorage.getItem("hikari-player-autoplay"), "true");
    assert.equal(mockStorage.getItem("nova_player_playback_rate"), "1.25");
    assert.equal(mockStorage.getItem("hikari-deleted-episodes-v1"), "[]");
    assert.equal(mockStorage.getItem("hikari-episode-outbox-v1"), "[]");
    assert.equal(
      mockStorage.getItem("hikari_anime_user_cache_v1"),
      '{"ownerUserId":"u1","entries":{}}',
    );
    assert.equal(mockStorage.getItem("better-auth.session_token"), "secret-session");
  });

  it("3. pruneProgressKeys preserva favoritos/preferências/auth e progresso prioritário na poda padrão", () => {
    const now = Date.now();
    mockStorage.setItem("hikari-user-state-v1", '{"state":{"myList":["anime-1"]}}');
    mockStorage.setItem("hikari-account-email", "user@example.com");
    mockStorage.setItem("hikari-progress-anime-1-ep5", JSON.stringify({ updatedAt: now }));

    // 45 chaves não prioritárias para ultrapassar o limite padrão de 40
    for (let i = 1; i <= 45; i += 1) {
      mockStorage.setItem(
        `hikari-progress-other-${i}-ep1`,
        JSON.stringify({ updatedAt: now - (50 - i) * 1000 }),
      );
    }

    const removed = pruneProgressKeys(["anime-1"]);
    assert.ok(removed > 0);
    assert.equal(
      mockStorage.getItem("hikari-user-state-v1"),
      '{"state":{"myList":["anime-1"]}}',
    );
    assert.equal(mockStorage.getItem("hikari-account-email"), "user@example.com");
    assert.ok(mockStorage.getItem("hikari-progress-anime-1-ep5"));
    // Mais antiga deve ter sido podada; mais recente preservada
    assert.equal(mockStorage.getItem("hikari-progress-other-1-ep1"), null);
    assert.ok(mockStorage.getItem("hikari-progress-other-45-ep1"));
  });

  it("4. Nunca entra em loop infinito quando o erro de quota persiste ou quando o erro não é de quota", () => {
    mockStorage.setItem("hikari-progress-old-1", '{"time":10}');
    mockStorage.setItem("hikari-user-state-v1", '{"state":{}}');

    let quotaCalls = 0;
    const quotaResult = withQuotaRetry(
      () => {
        quotaCalls += 1;
        throw new DOMException("Always full", "QuotaExceededError");
      },
      { maxRetries: 100 },
    );

    assert.equal(quotaResult, undefined);
    // 1 tentativa inicial + 1 retry após poda; na sequência não há mais chaves podáveis e para
    assert.equal(quotaCalls, 2);
    assert.equal(mockStorage.getItem("hikari-user-state-v1"), '{"state":{}}');

    let nonQuotaCalls = 0;
    const nonQuotaResult = withQuotaRetry(() => {
      nonQuotaCalls += 1;
      throw new Error("SecurityError");
    });

    assert.equal(nonQuotaResult, undefined);
    assert.equal(nonQuotaCalls, 1);
  });
});
