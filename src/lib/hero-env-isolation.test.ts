import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  resolveHeroEnvironmentName,
  getHeroRedisKey,
  getHeroGenKey,
  getRedisHeroBannerPoolWithFence,
  setRedisHeroBannerPool,
  HERO_BANNER_PAYLOAD_VERSION,
  HERO_BANNER_REDIS_KEY,
  HERO_BANNER_GEN_KEY,
  type HeroBannerPoolPayload,
  type RedisEvalClient,
} from "@/lib/redis";

class MockHeroEnvRedis implements RedisEvalClient {
  store = new Map<string, string>();

  async eval<TArgs extends unknown[], TData = unknown>(
    script: string,
    keys: string[],
    args: TArgs,
  ): Promise<TData> {
    const strArgs = (args ?? []).map((a) => String(a));
    if (script.includes('redis.call("GET", KEYS[1])') && script.includes("out = { v")) {
      const v = this.store.get(keys[0]) ?? null;
      const g = this.store.get(keys[1]) ?? "0";
      return [v ? `:${v}` : "", `:${g}`] as TData;
    }
    if (script.includes("currentGen ~= tostring(ARGV[i + 1])")) {
      for (let i = 1; i < keys.length; i++) {
        const curGen = this.store.get(keys[i]) ?? "0";
        const expectedGen = strArgs[i + 1];
        if (curGen !== expectedGen) {
          return ["fenced"] as TData;
        }
      }
      this.store.set(keys[0], strArgs[0]);
      return ["inserted"] as TData;
    }
    throw new Error("Unsupported script");
  }

  async keys(): Promise<string[]> {
    return Array.from(this.store.keys());
  }

  async del(...keys: string[]): Promise<number> {
    let count = 0;
    for (const k of keys) {
      if (this.store.delete(k)) count += 1;
    }
    return count;
  }
}

const originalVercelEnv = process.env.VERCEL_ENV;
const originalNodeEnv = process.env.NODE_ENV;

describe("hero cache environment isolation (v4 namespace & v2 payload)", () => {
  afterEach(() => {
    if (originalVercelEnv === undefined) {
      delete process.env.VERCEL_ENV;
    } else {
      process.env.VERCEL_ENV = originalVercelEnv;
    }
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it("resolves environment name correctly or falls back to development/test safely", () => {
    const envName = resolveHeroEnvironmentName();
    assert.ok(["production", "preview", "development", "test"].includes(envName));
  });

  it("generates namespaced keys with version v4 for hero banner pool and generation", () => {
    assert.equal(HERO_BANNER_PAYLOAD_VERSION, 2);

    const prodKey = getHeroRedisKey("production");
    const prodGen = getHeroGenKey("production");
    assert.equal(prodKey, "hikari:production:home:hero-banner:v4");
    assert.equal(prodGen, "hikari:production:home:hero-banner:gen:v4");

    const prevKey = getHeroRedisKey("preview");
    const prevGen = getHeroGenKey("preview");
    assert.equal(prevKey, "hikari:preview:home:hero-banner:v4");
    assert.equal(prevGen, "hikari:preview:home:hero-banner:gen:v4");

    const devKey = getHeroRedisKey("development");
    const devGen = getHeroGenKey("development");
    assert.equal(devKey, "hikari:development:home:hero-banner:v4");
    assert.equal(devGen, "hikari:development:home:hero-banner:gen:v4");
  });

  it("ensures preview and production never share keys", () => {
    const k1 = getHeroRedisKey("production");
    const k2 = getHeroRedisKey("preview");
    assert.notEqual(k1, k2);

    const g1 = getHeroGenKey("production");
    const g2 = getHeroGenKey("preview");
    assert.notEqual(g1, g2);
  });

  it("preserves legacy v2 constants for backward compatibility without overwriting v4", () => {
    assert.equal(HERO_BANNER_REDIS_KEY, "hikari:home:hero-banner:v2");
    assert.equal(HERO_BANNER_GEN_KEY, "hikari:home:hero-banner:gen:v2");
  });

  it("rejects legacy v1 or cross-env payloads and accepts v2 payload matching current env", async () => {
    const mockRedis = new MockHeroEnvRedis();
    const nowMs = Date.UTC(2026, 4, 15, 12, 0, 0);
    process.env.VERCEL_ENV = "preview";

    const sampleItem = {
      anime: {
        id: "176301",
        titles: { romaji: "Solo Leveling", english: "Solo Leveling", native: "" },
        cover: "https://cdn.example.com/cover.jpg",
        banner: "https://cdn.example.com/banner.jpg",
        synopsis: "Sinopse",
        score: 85,
        genres: ["Action"],
        format: "TV",
        status: "FINISHED",
        episodesCount: 12,
        season: "WINTER",
        year: 2024,
        trailerId: null,
        source: "local" as const,
        hasEpisode: true,
      },
      bucket: "preenchimento" as const,
      score: 80,
      hasDistinctBanner: true,
      titleKey: "solo leveling",
      rank: 1,
    };

    // Payload v1 legado ou sem env na chave v4 -> rejeitado
    mockRedis.store.set(
      getHeroRedisKey("preview"),
      JSON.stringify({
        v: 1,
        globalGen: "0",
        idGens: {},
        data: { v: 1, env: "preview", generatedAt: nowMs, items: [sampleItem] },
      }),
    );
    assert.equal((await getRedisHeroBannerPoolWithFence(mockRedis)).status, "miss");

    mockRedis.store.set(
      getHeroRedisKey("preview"),
      JSON.stringify({
        v: 1,
        globalGen: "0",
        idGens: {},
        data: { v: HERO_BANNER_PAYLOAD_VERSION, generatedAt: nowMs, items: [sampleItem] },
      }),
    );
    assert.equal((await getRedisHeroBannerPoolWithFence(mockRedis)).status, "miss");

    // Payload de outro ambiente -> rejeitado na leitura e na escrita
    mockRedis.store.set(
      getHeroRedisKey("preview"),
      JSON.stringify({
        v: 1,
        globalGen: "0",
        idGens: {},
        data: { v: HERO_BANNER_PAYLOAD_VERSION, env: "production", generatedAt: nowMs, items: [sampleItem] },
      }),
    );
    assert.equal((await getRedisHeroBannerPoolWithFence(mockRedis)).status, "miss");

    const foreignPayload: HeroBannerPoolPayload = {
      v: HERO_BANNER_PAYLOAD_VERSION,
      env: "production",
      generatedAt: nowMs,
      items: [sampleItem],
    };
    assert.equal(await setRedisHeroBannerPool(foreignPayload, "0", mockRedis), "skipped");

    // Payload válido v2 com env === preview -> aceito
    const validPayload: HeroBannerPoolPayload = {
      v: HERO_BANNER_PAYLOAD_VERSION,
      env: "preview",
      generatedAt: nowMs,
      items: [sampleItem],
    };
    assert.equal(await setRedisHeroBannerPool(validPayload, "0", mockRedis), "inserted");
    const hit = await getRedisHeroBannerPoolWithFence(mockRedis);
    assert.equal(hit.status, "hit");
    assert.equal(hit.payload?.v, HERO_BANNER_PAYLOAD_VERSION);
    assert.equal(hit.payload?.env, "preview");
  });
});
