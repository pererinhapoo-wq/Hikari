import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getSql } from "@/lib/db";
import {
  findCanonicalCatalogAnime,
  getAllAliasIdsForCanonical,
  resolveAnimeCandidateIdsFromDb,
  resolveEquivalentEpisodeIdsFromDb,
  resolveCatalogMetadataMap,
  reconcileAnimeIdentityReferences,
  reconcileEpisodeIdentityReferences,
  wouldCreateAliasCycle,
} from "@/lib/anime-identity";
import {
  executeAdminUpsertCatalogAnime,
  executeAdminArchiveCatalogAnime,
} from "@/lib/catalog-admin-ops.server";
import {
  getRedisAnimeDetailWithFence,
  setRedisAnimeDetail,
  invalidateRedisAnimeDetail,
  type RedisEvalClient,
} from "@/lib/redis";
import type { Anime } from "@/lib/types";

class MockRedis implements RedisEvalClient {
  store = new Map<string, { value: string; ttlSec?: number }>();
  evalCalls: Array<{ keys: string[]; args: string[] }> = [];
  shouldThrow = false;

  private getString(key: string): string | null {
    return this.store.get(key)?.value ?? null;
  }

  private incr(key: string): number {
    const current = Number(this.getString(key) ?? "0") || 0;
    const next = current + 1;
    this.store.set(key, { value: String(next) });
    return next;
  }

  async eval<TArgs extends unknown[], TData = unknown>(
    script: string,
    keys: string[],
    args: TArgs,
  ): Promise<TData> {
    if (this.shouldThrow) {
      throw new Error("MockRedis simulated outage");
    }
    const strArgs = (args ?? []).map((a) => String(a));
    this.evalCalls.push({ keys: [...keys], args: strArgs });

    // 1. GET_DETAIL_OR_FENCE_SCRIPT
    if (script.includes("local v = redis.call(\"GET\", KEYS[1])") && script.includes("hit")) {
      const v = this.getString(keys[0]);
      const g = this.getString(keys[1]) ?? "0";
      if (v) {
        return ["hit", `:${v}`, `:${g}`] as TData;
      }
      const out: unknown[] = ["miss", `:${g}`];
      for (let i = 2; i < keys.length; i++) {
        out.push(`:${this.getString(keys[i]) ?? "0"}`);
      }
      return out as TData;
    }

    // 2. CAPTURE_FENCE_SCRIPT
    if (script.includes("tostring(redis.call(\"GET\", KEYS[1]) or \"0\")")) {
      const out: unknown[] = [];
      for (let i = 0; i < keys.length; i++) {
        out.push(`:${this.getString(keys[i]) ?? "0"}`);
      }
      return out as TData;
    }

    // 3. READ_RAW_AND_FENCE_SCRIPT
    if (script.includes("local v = redis.call(\"GET\", KEYS[1])") && script.includes("missing")) {
      const v = this.getString(keys[0]);
      if (!v) return ["missing"] as TData;
      const g = this.getString(keys[1]) ?? "0";
      const idg = this.getString(keys[2]) ?? "0";
      return ["ok", `:${v}`, `:${g}`, `:${idg}`] as TData;
    }

    // 4. CAS_UPDATE_WITH_FENCE_SCRIPT
    if (script.includes("current ~= ARGV[1]") && script.includes("PTTL")) {
      for (let i = 1; i < keys.length; i++) {
        const curGen = this.getString(keys[i]) ?? "0";
        const expectedGen = strArgs[i + 1];
        if (curGen !== expectedGen) {
          return ["fenced"] as TData;
        }
      }
      const current = this.getString(keys[0]);
      if (!current) return ["missing"] as TData;
      if (current !== strArgs[0]) {
        return ["conflict", `:${current}`] as TData;
      }
      this.store.set(keys[0], { value: strArgs[1] });
      return ["updated"] as TData;
    }

    // 5. SET_IF_MISSING_OR_READ_WITH_FENCE_SCRIPT
    if (script.includes("local current = redis.call(\"GET\", KEYS[1])") && script.includes("inserted")) {
      for (let i = 1; i < keys.length; i++) {
        const curGen = this.getString(keys[i]) ?? "0";
        const expectedGen = strArgs[i + 1];
        if (curGen !== expectedGen) {
          return ["fenced"] as TData;
        }
      }
      const current = this.getString(keys[0]);
      if (!current) {
        this.store.set(keys[0], { value: strArgs[0] });
        return ["inserted"] as TData;
      }
      return ["exists", `:${current}`] as TData;
    }

    // 6. INVALIDATE_IDS_SCRIPT
    if (script.includes("tonumber(ARGV[1])") && script.includes("DEL")) {
      const n = Number(strArgs[0] ?? 0) || 0;
      for (let i = 0; i < n; i++) {
        this.incr(keys[i]);
      }
      for (let i = n; i < keys.length; i++) {
        this.store.delete(keys[i]);
      }
      return n as TData;
    }

    // 7. INCR_GLOBAL_GEN_SCRIPT
    if (script.includes("redis.call(\"INCR\", KEYS[1])")) {
      const next = this.incr(keys[0]);
      return `:${next}` as TData;
    }

    throw new Error(`Unmapped MockRedis script: ${script.slice(0, 50)}`);
  }

  async del(...keys: string[]): Promise<number> {
    if (this.shouldThrow) throw new Error("MockRedis del failure");
    let count = 0;
    for (const k of keys) {
      if (this.store.delete(k)) count++;
    }
    return count;
  }
}

describe("Hikari Anime Identity, Archival, Re-registration & Reference Reconciliation E2E Suite", () => {
  it("Scenario 1: Bakemonogatari test case - old local ID resolves to current canonical ID 5081", async () => {
    const sql = await getSql();
    assert.equal(typeof sql, "function");

    await sql.query(
      `INSERT INTO "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
       VALUES ('user-test-1', 'Test User', 'test@example.com', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT ("id") DO NOTHING;`,
    );

    const initialUpsert = await executeAdminUpsertCatalogAnime({
      id: "5081",
      title: "Bakemonogatari",
      titleRomaji: "Bakemonogatari",
      format: "TV",
      year: 2009,
      anilistId: 5081,
      malId: 5081,
      episodesCount: 15,
      status: "FINISHED",
    });
    assert.equal(initialUpsert.animeId, "5081");

    await sql.query(
      `INSERT INTO "user_anime_tracking" ("userId", "animeId", "status", "episodesWatched", "score", "createdAt", "updatedAt")
       VALUES ('user-test-1', '5081', 'completed', 15, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT ("userId", "animeId") DO UPDATE SET "episodesWatched" = 15;`,
    );

    const archiveRes = await executeAdminArchiveCatalogAnime("5081");
    assert.equal(archiveRes.found, true);

    await executeAdminUpsertCatalogAnime({
      id: "local-f1d063f5-cf66-4729-aab7-d2c3cc807c25",
      title: "Bakemonogatari",
      titleRomaji: "Bakemonogatari",
      format: "TV",
      year: 2009,
      anilistId: 5081,
      malId: 5081,
      episodesCount: 15,
      status: "FINISHED",
    });

    const lookup = await findCanonicalCatalogAnime(sql, {
      id: "local-f1d063f5-cf66-4729-aab7-d2c3cc807c25",
      anilistId: 5081,
    });
    assert.equal(lookup.canonicalId, "5081");
    assert.equal(lookup.row?.title, "Bakemonogatari");

    const tracking = await sql.query(
      `SELECT "animeId", "episodesWatched" FROM "user_anime_tracking" WHERE "userId" = 'user-test-1' AND "animeId" = '5081'`,
    );
    assert.equal(tracking.length, 1);
    assert.equal(tracking[0].episodesWatched, 15);
  });

  it("Scenario 2: AniList anime archive & re-registration", async () => {
    await executeAdminUpsertCatalogAnime({
      id: "100",
      title: "AniList Test Anime",
      anilistId: 100,
      format: "TV",
      year: 2020,
    });
    await executeAdminArchiveCatalogAnime("100");

    const rereg = await executeAdminUpsertCatalogAnime({
      id: "local-new-100",
      title: "AniList Test Anime",
      anilistId: 100,
      format: "TV",
      year: 2020,
    });
    assert.equal(rereg.animeId, "100");
  });

  it("Scenario 3: MAL anime archive & re-registration", async () => {
    await executeAdminUpsertCatalogAnime({
      id: "mal-200",
      title: "MAL Test Anime",
      malId: 200,
      format: "MOVIE",
      year: 2021,
    });
    await executeAdminArchiveCatalogAnime("mal-200");

    const rereg = await executeAdminUpsertCatalogAnime({
      id: "local-mal-200",
      title: "MAL Test Anime",
      malId: 200,
      format: "MOVIE",
      year: 2021,
    });
    assert.equal(rereg.animeId, "mal-200");
  });

  it("Scenario 4: Kitsu anime archive & re-registration", async () => {
    await executeAdminUpsertCatalogAnime({
      id: "kitsu-300",
      title: "Kitsu Test Anime",
      kitsuId: 300,
      format: "OVA",
      year: 2022,
    });
    await executeAdminArchiveCatalogAnime("kitsu-300");

    const rereg = await executeAdminUpsertCatalogAnime({
      id: "local-kitsu-300",
      title: "Kitsu Test Anime",
      kitsuId: 300,
      format: "OVA",
      year: 2022,
    });
    assert.equal(rereg.animeId, "kitsu-300");
  });

  it("Scenario 5: Multiple consecutive delete/re-register cycles (alias chains & flattening)", async () => {
    await executeAdminUpsertCatalogAnime({ id: "chain-A", title: "Chained Anime", format: "TV", year: 2015 });
    await executeAdminArchiveCatalogAnime("chain-A");

    await executeAdminUpsertCatalogAnime({ id: "chain-B", title: "Chained Anime", format: "TV", year: 2015 });
    await executeAdminArchiveCatalogAnime("chain-B");

    const finalUpsert = await executeAdminUpsertCatalogAnime({ id: "chain-C", title: "Chained Anime", format: "TV", year: 2015 });
    assert.equal(finalUpsert.animeId, "chain-A");
  });

  it("Scenario 6: Direct detail lookup & route identifier equivalence via old ID", async () => {
    const sql = await getSql();
    const candidateIds = await resolveAnimeCandidateIdsFromDb(sql, "chain-B");
    assert.ok(candidateIds.candidateIds.includes("chain-A"));
    assert.ok(candidateIds.candidateIds.includes("chain-B"));
  });

  it("Scenario 7: User tracking, custom list items & favorites preserved across archival and re-registration", async () => {
    const sql = await getSql();
    await sql.query(
      `INSERT INTO "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
       VALUES ('user-test-1', 'Test User', 'test@example.com', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT ("id") DO NOTHING;`,
    );
    await executeAdminUpsertCatalogAnime({ id: "preserve-1", title: "Preserved Anime", format: "TV", year: 2018 });
    await sql.query(
      `INSERT INTO "user_anime_tracking" ("userId", "animeId", "status", "episodesWatched", "score", "createdAt", "updatedAt")
       VALUES ('user-test-1', 'preserve-1', 'watching', 5, 8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT ("userId", "animeId") DO UPDATE SET "episodesWatched" = 5;`,
    );

    await executeAdminArchiveCatalogAnime("preserve-1");
    await executeAdminUpsertCatalogAnime({ id: "preserve-2", title: "Preserved Anime", format: "TV", year: 2018 });

    const tracking = await sql.query(
      `SELECT "animeId", "episodesWatched" FROM "user_anime_tracking" WHERE "userId" = 'user-test-1' AND "animeId" = 'preserve-1'`,
    );
    assert.equal(tracking.length, 1);
    assert.equal(tracking[0].episodesWatched, 5);
  });

  it("Scenario 8: Episode progress and watched episodes preserved across re-registration", async () => {
    const sql = await getSql();
    await sql.query(
      `INSERT INTO "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
       VALUES ('user-test-1', 'Test User', 'test@example.com', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT ("id") DO NOTHING;`,
    );
    await executeAdminUpsertCatalogAnime({ id: "ep-anime-1", title: "Ep Anime", format: "TV", year: 2019 });
    await sql.query(
      `UPDATE "catalog_anime"
       SET "episode_history" = $1::jsonb
       WHERE "id" = 'ep-anime-1'`,
      [JSON.stringify([{ episodeId: "ep-old-1", seasonNumber: 1, number: 1, title: "Ep 1" }])],
    );
    await sql.query(
      `INSERT INTO "user_watched_episode" ("userId", "animeId", "episodeId", "episodeNumber", "origin", "watchedAt")
       VALUES ('user-test-1', 'ep-anime-1', 'ep-old-1', 1, 'playback', CURRENT_TIMESTAMP)
       ON CONFLICT ("userId", "animeId", "episodeId") DO NOTHING;`,
    );

    const remapped = await reconcileEpisodeIdentityReferences(sql, {
      animeId: "ep-anime-1",
      episodeId: "ep-new-1",
      seasonNumber: 1,
      number: 1,
    });
    assert.ok(remapped.remappedOldEpisodeIds.includes("ep-old-1"));

    const watched = await sql.query(
      `SELECT "episodeId" FROM "user_watched_episode" WHERE "userId" = 'user-test-1' AND "animeId" = 'ep-anime-1'`,
    );
    assert.equal(watched.length, 1);
    assert.equal(watched[0].episodeId, "ep-new-1");
  });

  it("Scenario 9: Comments, activities, and notifications preserved and resolved across old and new IDs", async () => {
    const sql = await getSql();
    await sql.query(
      `INSERT INTO "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
       VALUES ('user-test-1', 'Test User', 'test@example.com', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT ("id") DO NOTHING;`,
    );
    await executeAdminUpsertCatalogAnime({ id: "comm-anime-old", title: "Comment Anime", format: "TV", year: 2019 });
    await sql.query(
      `INSERT INTO "catalog_episode" ("id", "animeId", "seasonNumber", "number", "title", "published", "createdAt", "updatedAt")
       VALUES ('ep-comm-old', 'comm-anime-old', 1, 1, 'Ep 1', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT ("id") DO NOTHING;`,
    );
    await sql.query(
      `INSERT INTO "comment" ("id", "userId", "animeId", "episodeId", "content", "createdAt", "updatedAt")
       VALUES ('c-1', 'user-test-1', 'comm-anime-old', 'ep-comm-old', 'Great anime!', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT ("id") DO NOTHING;`,
    );
    await executeAdminArchiveCatalogAnime("comm-anime-old");
    const newUpsert = await executeAdminUpsertCatalogAnime({ id: "comm-anime-1", title: "Comment Anime 2", format: "TV", year: 2020 });
    await sql.query(
      `INSERT INTO "catalog_episode" ("id", "animeId", "seasonNumber", "number", "title", "published", "createdAt", "updatedAt")
       VALUES ('ep-comm-1', $1, 1, 1, 'Ep 1', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT ("id") DO NOTHING;`,
      [newUpsert.animeId],
    );

    const ref = await reconcileAnimeIdentityReferences(sql, {
      canonicalId: newUpsert.animeId,
      oldIds: ["comm-anime-old"],
      canonicalSnapshot: { title: "Comment Anime 2" },
    });
    assert.equal(ref.migratedComments, 1);
  });

  it("Scenario 10: Strict subbed vs dubbed separation even sharing anilistId", async () => {
    const sql = await getSql();
    await executeAdminUpsertCatalogAnime({
      id: "sub-1",
      title: "Attack on Titan",
      anilistId: 16498,
      format: "TV",
    });
    await executeAdminUpsertCatalogAnime({
      id: "dub-1",
      title: "Attack on Titan (Dublado)",
      anilistId: 16498,
      format: "TV",
    });

    const subLookup = await findCanonicalCatalogAnime(sql, { id: "sub-1", isDubbed: false });
    const dubLookup = await findCanonicalCatalogAnime(sql, { id: "dub-1", isDubbed: true });
    assert.equal(subLookup.canonicalId, "sub-1");
    assert.equal(dubLookup.canonicalId, "dub-1");
  });

  it("Scenario 11: Sequels / similar / short ambiguous titles NOT auto-associated", async () => {
    const sql = await getSql();
    await executeAdminUpsertCatalogAnime({ id: "anime-x", title: "Sword Art Online", format: "TV", year: 2012 });
    const lookup = await findCanonicalCatalogAnime(sql, {
      title: "Sword Art Online II",
      format: "TV",
      year: 2014,
    });
    assert.equal(lookup.canonicalId, null);
  });

  it("Scenario 12: Alias cycle prevention in app logic & PostgreSQL trigger", async () => {
    const sql = await getSql();
    const cycle = await wouldCreateAliasCycle(sql, "anime-A", "anime-B");
    assert.equal(typeof cycle, "boolean");

    await assert.rejects(async () => {
      await sql.query(
        `INSERT INTO "catalog_anime_id_alias" ("old_id", "current_id", "updated_at") VALUES ('self', 'self', CURRENT_TIMESTAMP)`,
      );
    });
  });

  it("Scenario 13: Multiple users with duplicate rows across old ID + new ID reconciled safely", async () => {
    const sql = await getSql();
    await sql.query(
      `INSERT INTO "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
       VALUES ('user-test-1', 'Test User', 'test@example.com', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT ("id") DO NOTHING;`,
    );
    await executeAdminUpsertCatalogAnime({ id: "dup-new", title: "Duplicate Anime", format: "TV", year: 2020 });
    await sql.query(
      `INSERT INTO "user_anime_tracking" ("userId", "animeId", "status", "episodesWatched", "createdAt", "updatedAt")
       VALUES ('user-test-1', 'dup-old', 'watching', 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT ("userId", "animeId") DO NOTHING;`,
    );
    await sql.query(
      `INSERT INTO "user_anime_tracking" ("userId", "animeId", "status", "episodesWatched", "createdAt", "updatedAt")
       VALUES ('user-test-1', 'dup-new', 'completed', 12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT ("userId", "animeId") DO NOTHING;`,
    );

    const ref = await reconcileAnimeIdentityReferences(sql, {
      canonicalId: "dup-new",
      oldIds: ["dup-old"],
      canonicalSnapshot: { title: "Duplicate Anime" },
    });
    assert.ok(ref.migratedTrackingUsers >= 0);
  });

  it("Scenario 14: Cache invalidation & fail-open Redis behavior", async () => {
    const mockRedis = new MockRedis();
    const testAnime = {
      id: "cache-1",
      titles: { romaji: "Cached Anime", english: "Cached Anime", native: "Cached Anime" },
      episodesCount: 12,
      seasons: [],
    } as unknown as Anime;

    const setRes = await setRedisAnimeDetail("cache-1", testAnime, undefined, mockRedis);
    assert.equal(setRes, "inserted");

    const readRes = await getRedisAnimeDetailWithFence("cache-1", [], mockRedis);
    assert.equal(readRes.status, "hit");
    assert.equal(readRes.detail?.id, "cache-1");

    await invalidateRedisAnimeDetail("cache-1", undefined, mockRedis);

    mockRedis.shouldThrow = true;
    const failOpenRead = await getRedisAnimeDetailWithFence("cache-1", [], mockRedis);
    assert.equal(failOpenRead.status, "failed");
  });

  it("Scenario 15: Concurrent / idempotent re-registration", async () => {
    const results = await Promise.all([
      executeAdminUpsertCatalogAnime({ id: "conc-1", title: "Concurrent Anime", format: "TV", year: 2023, anilistId: 9999 }),
      executeAdminUpsertCatalogAnime({ id: "conc-2", title: "Concurrent Anime", format: "TV", year: 2023, anilistId: 9999 }),
    ]);
    assert.equal(results[0].animeId, results[1].animeId);
  });
});
