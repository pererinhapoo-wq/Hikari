import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  MONETAG_COOLDOWN_MS,
  MONETAG_SMARTLINK_URL,
  MONETAG_SMARTLINK_ZONE_ID,
  MONETAG_STORAGE_KEY,
  triggerMonetagSmartLinkOnNavigationClick,
  tryOpenMonetagSmartLink,
  type SmartLinkStorage,
} from "./monetag-smartlink.ts";

class MemoryStorage implements SmartLinkStorage {
  private map = new Map<string, string>();
  public throwOnGet = false;
  public throwOnSet = false;

  getItem(key: string): string | null {
    if (this.throwOnGet) {
      throw new Error("Storage read unavailable");
    }
    return this.map.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.throwOnSet) {
      throw new Error("Storage write unavailable");
    }
    this.map.set(key, value);
  }

  seedRaw(raw: string): void {
    this.map.set(MONETAG_STORAGE_KEY, raw);
  }

  readRaw(): string | null {
    return this.map.get(MONETAG_STORAGE_KEY) ?? null;
  }
}

describe("monetag-smartlink", () => {
  it("uses exact Monetag Direct Link URL and zone 12327684", () => {
    assert.equal(MONETAG_SMARTLINK_ZONE_ID, "12327684");
    assert.equal(MONETAG_SMARTLINK_URL, "https://uplcm.com/4/12327684");
    assert.equal(MONETAG_COOLDOWN_MS, 2 * 60 * 60 * 1000);
  });

  it("allows 2 opens shared across anime/episode clicks, then blocks for 2 hours, then repeats (controlled clock)", () => {
    const storage = new MemoryStorage();
    const openedCalls: Array<{ url: string; target: string; features: string }> = [];
    const openFn = (url: string, target: string, features: string) => {
      openedCalls.push({ url, target, features });
      return { closed: false };
    };

    const t0 = 1_700_000_000_000;

    // 1o clique elegivel (ex.: /anime/$id) -> abre anuncio 1
    const r1 = tryOpenMonetagSmartLink({ storage, now: t0, openFn });
    assert.equal(r1.opened, true);
    assert.equal(r1.reason, "opened");
    assert.equal(r1.state?.count, 1);
    assert.equal(r1.state?.blockedUntil, null);

    // 2o clique elegivel (ex.: /watch/$id/$ep) -> abre anuncio 2 e inicia bloqueio de 2h
    const t2 = t0 + 15_000;
    const r2 = tryOpenMonetagSmartLink({ storage, now: t2, openFn });
    assert.equal(r2.opened, true);
    assert.equal(r2.reason, "opened");
    assert.equal(r2.state?.count, 2);
    assert.equal(r2.state?.blockedUntil, t2 + MONETAG_COOLDOWN_MS);
    assert.equal(openedCalls.length, 2);
    assert.deepEqual(openedCalls[0], {
      url: "https://uplcm.com/4/12327684",
      target: "_blank",
      features: "noopener,noreferrer",
    });

    // 3o e 4o cliques dentro da janela de 2h -> nao abre anuncio
    const r3 = tryOpenMonetagSmartLink({ storage, now: t2 + 1_000, openFn });
    assert.equal(r3.attempted, false);
    assert.equal(r3.opened, false);
    assert.equal(r3.reason, "cooldown_active");

    const r4 = tryOpenMonetagSmartLink({
      storage,
      now: t2 + MONETAG_COOLDOWN_MS - 1,
      openFn,
    });
    assert.equal(r4.attempted, false);
    assert.equal(r4.opened, false);
    assert.equal(r4.reason, "cooldown_active");
    assert.equal(openedCalls.length, 2);

    // Exatamente apos 2h -> reinicia ciclo e abre anuncio 1 do novo ciclo
    const tAfter = t2 + MONETAG_COOLDOWN_MS;
    const r5 = tryOpenMonetagSmartLink({ storage, now: tAfter, openFn });
    assert.equal(r5.opened, true);
    assert.equal(r5.reason, "opened");
    assert.equal(r5.state?.count, 1);
    assert.equal(r5.state?.blockedUntil, null);

    // 2o clique do novo ciclo -> abre anuncio 2 e bloqueia por mais 2h
    const tAfter2 = tAfter + 5_000;
    const r6 = tryOpenMonetagSmartLink({ storage, now: tAfter2, openFn });
    assert.equal(r6.opened, true);
    assert.equal(r6.state?.count, 2);
    assert.equal(r6.state?.blockedUntil, tAfter2 + MONETAG_COOLDOWN_MS);
    assert.equal(openedCalls.length, 4);

    // Novo clique dentro da segunda janela de 2h -> bloqueado novamente
    const r7 = tryOpenMonetagSmartLink({
      storage,
      now: tAfter2 + 60_000,
      openFn,
    });
    assert.equal(r7.opened, false);
    assert.equal(r7.reason, "cooldown_active");
    assert.equal(openedCalls.length, 4);
  });

  it("persists state in localStorage across reloads", () => {
    const storage = new MemoryStorage();
    let opens = 0;
    const openFn = () => {
      opens += 1;
      return {};
    };

    const base = 1_750_000_000_000;
    tryOpenMonetagSmartLink({ storage, now: base, openFn });

    // Simula recarregamento lendo apenas do storage persistido
    const persisted = JSON.parse(storage.readRaw() || "null");
    assert.deepEqual(persisted, { version: 1, count: 1, blockedUntil: null });

    tryOpenMonetagSmartLink({ storage, now: base + 1000, openFn });
    const third = tryOpenMonetagSmartLink({ storage, now: base + 2000, openFn });
    assert.equal(opens, 2);
    assert.equal(third.opened, false);
    assert.equal(third.reason, "cooldown_active");
  });

  it("counts popup blocker (window.open returning null) as an attempt and applies 2h cooldown after 2nd attempt", () => {
    const storage = new MemoryStorage();
    let calls = 0;
    const blockedOpenFn = () => {
      calls += 1;
      return null;
    };

    const t0 = 1_800_000_000_000;
    const r1 = tryOpenMonetagSmartLink({ storage, now: t0, openFn: blockedOpenFn });
    assert.equal(r1.attempted, true);
    assert.equal(r1.opened, false);
    assert.equal(r1.reason, "popup_blocked");
    assert.equal(r1.state?.count, 1);

    const r2 = tryOpenMonetagSmartLink({ storage, now: t0 + 1000, openFn: blockedOpenFn });
    assert.equal(r2.attempted, true);
    assert.equal(r2.opened, false);
    assert.equal(r2.reason, "popup_blocked");
    assert.equal(r2.state?.count, 2);
    assert.equal(r2.state?.blockedUntil, t0 + 1000 + MONETAG_COOLDOWN_MS);

    const r3 = tryOpenMonetagSmartLink({ storage, now: t0 + 2000, openFn: blockedOpenFn });
    assert.equal(r3.attempted, false);
    assert.equal(r3.reason, "cooldown_active");
    assert.equal(calls, 2);
  });

  it("safely recovers from corrupted or invalid persisted values", () => {
    const storage = new MemoryStorage();
    storage.seedRaw("{corrupted-json");
    let opens = 0;
    const openFn = () => {
      opens += 1;
      return {};
    };

    const res = tryOpenMonetagSmartLink({ storage, now: 1_800_000_000_000, openFn });
    assert.equal(res.opened, true);
    assert.equal(res.state?.count, 1);
    assert.equal(opens, 1);

    storage.seedRaw(JSON.stringify({ version: 99, count: 999, blockedUntil: "bad" }));
    const res2 = tryOpenMonetagSmartLink({ storage, now: 1_800_000_000_100, openFn });
    assert.equal(res2.opened, true);
    assert.equal(res2.state?.count, 1);
    assert.equal(opens, 2);
  });

  it("does not open ads when localStorage is unavailable or throws", () => {
    let opens = 0;
    const openFn = () => {
      opens += 1;
      return {};
    };

    const rNull = tryOpenMonetagSmartLink({ storage: null, now: 1000, openFn });
    assert.equal(rNull.opened, false);
    assert.equal(rNull.reason, "storage_unavailable");

    const readFailStorage = new MemoryStorage();
    readFailStorage.throwOnGet = true;
    const rReadFail = tryOpenMonetagSmartLink({
      storage: readFailStorage,
      now: 1000,
      openFn,
    });
    assert.equal(rReadFail.opened, false);
    assert.equal(rReadFail.reason, "storage_unavailable");

    const writeFailStorage = new MemoryStorage();
    writeFailStorage.throwOnSet = true;
    const rWriteFail = tryOpenMonetagSmartLink({
      storage: writeFailStorage,
      now: 1000,
      openFn,
    });
    assert.equal(rWriteFail.opened, false);
    assert.equal(rWriteFail.reason, "storage_unavailable");
    assert.equal(opens, 0);
  });

  it("guards against defaultPrevented, non-primary clicks, modifier keys, and duplicate native events", () => {
    const storage = new MemoryStorage();
    let opens = 0;
    const openFn = () => {
      opens += 1;
      return {};
    };

    assert.equal(
      triggerMonetagSmartLinkOnNavigationClick(
        { defaultPrevented: true, button: 0 },
        { storage, now: 1000, openFn },
      ),
      null,
    );
    assert.equal(
      triggerMonetagSmartLinkOnNavigationClick(
        { defaultPrevented: false, button: 1 },
        { storage, now: 1000, openFn },
      ),
      null,
    );
    assert.equal(
      triggerMonetagSmartLinkOnNavigationClick(
        { defaultPrevented: false, button: 0, ctrlKey: true },
        { storage, now: 1000, openFn },
      ),
      null,
    );
    assert.equal(
      triggerMonetagSmartLinkOnNavigationClick(
        { defaultPrevented: false, button: 0, metaKey: true },
        { storage, now: 1000, openFn },
      ),
      null,
    );
    assert.equal(opens, 0);

    const sharedNativeEvent = new Event("click");
    const first = triggerMonetagSmartLinkOnNavigationClick(
      { defaultPrevented: false, button: 0, nativeEvent: sharedNativeEvent },
      { storage, now: 1000, openFn },
    );
    const duplicate = triggerMonetagSmartLinkOnNavigationClick(
      { defaultPrevented: false, button: 0, nativeEvent: sharedNativeEvent },
      { storage, now: 1005, openFn },
    );
    assert.equal(first?.opened, true);
    assert.equal(duplicate, null);
    assert.equal(opens, 1);
  });
});
