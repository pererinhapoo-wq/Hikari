import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveHeroEnvironmentName,
  getHeroRedisKey,
  getHeroGenKey,
  HERO_BANNER_REDIS_KEY,
  HERO_BANNER_GEN_KEY,
} from "@/lib/redis";

describe("hero cache environment isolation (v3 namespace)", () => {
  it("resolves environment name correctly or falls back to development/test safely", () => {
    const envName = resolveHeroEnvironmentName();
    assert.ok(["production", "preview", "development", "test"].includes(envName));
  });

  it("generates namespaced keys with version v3 for hero banner pool and generation", () => {
    const prodKey = getHeroRedisKey("production");
    const prodGen = getHeroGenKey("production");
    assert.equal(prodKey, "hikari:production:home:hero-banner:v3");
    assert.equal(prodGen, "hikari:production:home:hero-banner:gen:v3");

    const prevKey = getHeroRedisKey("preview");
    const prevGen = getHeroGenKey("preview");
    assert.equal(prevKey, "hikari:preview:home:hero-banner:v3");
    assert.equal(prevGen, "hikari:preview:home:hero-banner:gen:v3");

    const devKey = getHeroRedisKey("development");
    const devGen = getHeroGenKey("development");
    assert.equal(devKey, "hikari:development:home:hero-banner:v3");
    assert.equal(devGen, "hikari:development:home:hero-banner:gen:v3");
  });

  it("ensures preview and production never share keys", () => {
    const k1 = getHeroRedisKey("production");
    const k2 = getHeroRedisKey("preview");
    assert.notEqual(k1, k2);

    const g1 = getHeroGenKey("production");
    const g2 = getHeroGenKey("preview");
    assert.notEqual(g1, g2);
  });

  it("preserves legacy v2 constants for backward compatibility without overwriting v3", () => {
    assert.equal(HERO_BANNER_REDIS_KEY, "hikari:home:hero-banner:v2");
    assert.equal(HERO_BANNER_GEN_KEY, "hikari:home:hero-banner:gen:v2");
  });
});
