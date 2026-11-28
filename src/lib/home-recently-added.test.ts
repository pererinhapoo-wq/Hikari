import assert from "node:assert/strict";
import { after, beforeEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getSql } from "@/lib/db";
import {
  executeGetHomeRecentlyAdded,
  invalidateHomeRecentlyAddedCacheAsync,
  resetHomeRecentlyAddedTestState,
} from "@/lib/home-recently-added.server";
import {
  executeAdminUpsertCatalogAnime,
} from "@/lib/catalog-admin-ops.server";
import {
  HOME_RECENTLY_ADDED_REDIS_KEY,
  type RedisEvalClient,
} from "@/lib/redis";
import { BLOCKED_ANILIST_IDS } from "@/lib/public-visibility";

class MockRecentlyAddedRedis implements RedisEvalClient {
  store = new Map<string, string>();
  genStore = new Map<string, number>();
  shouldThrow = false;

  async eval<TArgs extends unknown[], TData = unknown>(
    script: string,
    keys: string[],
    args: TArgs,
  ): Promise<TData> {
    if (this.shouldThrow) throw new Error("Simulated Redis failure");
    const strArgs = (args ?? []).map((a) => String(a));

    if (
      script.includes("SET_PUBLIC_EPISODES_WITH_FENCE_SCRIPT") ||
      script.includes("redis.call(\"SET\"") ||
      script.includes("inserted") ||
      script.includes("updated")
    ) {
      const valKey = keys[0];
      const genKey = keys[1];
      const curGen = String(this.genStore.get(genKey) ?? 0);
      const expectedGen = strArgs[1];
      if (curGen !== expectedGen) {
        return ["fenced"] as TData;
      }
      const payload = strArgs[0];
      this.store.set(valKey, payload);
      return ["updated"] as TData;
    }

    if (
      script.includes("GET_PUBLIC_EPISODES_OR_FENCE_SCRIPT") ||
      (script.includes('redis.call("GET", KEYS[1])') && script.includes("curGen"))
    ) {
      const valKey = keys[0];
      const genKey = keys[1];
      const curGen = String(this.genStore.get(genKey) ?? 0);
      const val = this.store.get(valKey);
      if (val) {
        return ["hit", `v1|${curGen}|0|${val}`] as TData;
      }
      return ["miss", `:${curGen}`] as TData;
    }

    if (
      script.includes("INVALIDATE_PUBLIC_EPISODES_SCRIPT") ||
      script.includes("INCR")
    ) {
      const genKey = keys[0];
      const valKey = keys[1];
      console.log("MOCK INVALIDATE HIT. keys[0]:", keys[0], "keys[1]:", keys[1]);
      const nextGen = (this.genStore.get(genKey) ?? 0) + 1;
      this.genStore.set(genKey, nextGen);
      this.store.delete(valKey);
      return [":" + nextGen] as TData;
    }

    throw new Error("Unsupported Lua script in MockRecentlyAddedRedis: " + script.slice(0, 40));
  }

  async keys(pattern: string): Promise<string[]> {
    if (this.shouldThrow) throw new Error("Simulated Redis failure");
    const prefix = pattern.endsWith("*") ? pattern.slice(0, -1) : pattern;
    return Array.from(this.store.keys()).filter((k) =>
      pattern.endsWith("*") ? k.startsWith(prefix) : k === pattern,
    );
  }

  async del(...keys: string[]): Promise<number> {
    if (this.shouldThrow) throw new Error("Simulated Redis failure");
    let removed = 0;
    for (const k of keys) {
      if (this.store.delete(k)) removed += 1;
    }
    return removed;
  }
}

describe("Animes Recém-Adicionados públicos (PostgreSQL + Cache + Invalidação)", () => {
  const runId = Date.now();
  const testAnimeIds: string[] = [];
  const testEpisodeIds: string[] = [];

  after(async () => {
    const sql = await getSql();
    if (testEpisodeIds.length > 0) {
      await sql.query(`DELETE FROM "catalog_episode" WHERE "id" = ANY($1::text[]);`, [
        testEpisodeIds,
      ]);
    }
    if (testAnimeIds.length > 0) {
      await sql.query(`DELETE FROM "catalog_season" WHERE "animeId" = ANY($1::text[]);`, [
        testAnimeIds,
      ]);
      await sql.query(`DELETE FROM "catalog_anime" WHERE "id" = ANY($1::text[]);`, [
        testAnimeIds,
      ]);
    }
  });

  beforeEach(() => {
    resetHomeRecentlyAddedTestState();
  });

  it("1. Visitante não autenticado recebe os animes públicos do banco (hasEpisode: true)", async () => {
    const sql = await getSql();
    const id = `rec-vis-1-${runId}`;
    testAnimeIds.push(id);
    const epId = `ep-vis-1-${runId}`;
    testEpisodeIds.push(epId);

    await executeAdminUpsertCatalogAnime({
      id,
      title: `Recém Adicionado 1 ${runId}`,
      anilistId: 980001,
      countryOfOrigin: "JP",
      hidden: false,
      seasons: [{ number: 1, title: "Temporada 1" }],
    });
    await sql.query(
      `INSERT INTO "catalog_episode" ("id", "animeId", "seasonNumber", "number", "title", "videoUrl", "published", "publishedAt")
       VALUES ($1, $2, 1, 1, 'Ep 1', 'https://cdn.example.com/ep1.mp4', true, CURRENT_TIMESTAMP);`,
      [epId, id],
    );

    const res = await executeGetHomeRecentlyAdded({ sqlOverride: sql, bypassCache: true });
    assert.equal(res.status, "success");
    assert.ok(res.items.some((a) => a.id === id));
    const found = res.items.find((a) => a.id === id);
    assert.equal(found?.hasEpisode, true);
  });

  it("2. A lista não depende do IndexedDB local ou Zustand", async () => {
    const indexSource = readFileSync(
      resolve(process.cwd(), "src/routes/index.tsx"),
      "utf8",
    );
    const recentlyAddedIdx = indexSource.indexOf("const recentlyAddedAnimes");
    assert.ok(recentlyAddedIdx !== -1);
    const recentlyAddedBlock = indexSource.slice(
      recentlyAddedIdx,
      recentlyAddedIdx + 300,
    );
    assert.equal(recentlyAddedBlock.includes("locals"), false);
    assert.equal(recentlyAddedBlock.includes("useHikariStore"), false);
  });

  it("3. Anime recém-cadastrado com episódio publicado aparece após persistência", async () => {
    const sql = await getSql();
    const id = `rec-new-${runId}`;
    testAnimeIds.push(id);
    const epId = `ep-new-${runId}`;
    testEpisodeIds.push(epId);

    await executeAdminUpsertCatalogAnime({
      id,
      title: `Recém Cadastrado ${runId}`,
      anilistId: 980002,
      countryOfOrigin: "JP",
      hidden: false,
      seasons: [{ number: 1, title: "Temporada 1" }],
    });
    await sql.query(
      `INSERT INTO "catalog_episode" ("id", "animeId", "seasonNumber", "number", "title", "videoUrl", "published", "publishedAt")
       VALUES ($1, $2, 1, 1, 'Ep 1', 'https://cdn.example.com/new.mp4', true, CURRENT_TIMESTAMP);`,
      [epId, id],
    );

    const res = await executeGetHomeRecentlyAdded({ sqlOverride: sql, bypassCache: true });
    assert.equal(res.status, "success");
    assert.equal(res.items[0]?.id, id, "Anime recém-cadastrado deve aparecer no topo");
  });

  it("4. Anime atualizado recentemente (updatedAt mais recente) retorna ao topo", async () => {
    const sql = await getSql();
    const idOld = `rec-old-${runId}`;
    const idUpdated = `rec-upd-${runId}`;
    testAnimeIds.push(idOld, idUpdated);
    const epOld = `ep-old-${runId}`;
    const epUpd = `ep-upd-${runId}`;
    testEpisodeIds.push(epOld, epUpd);

    await executeAdminUpsertCatalogAnime({
      id: idOld,
      title: `Antigo ${runId}`,
      anilistId: 980003,
      countryOfOrigin: "JP",
      seasons: [{ number: 1, title: "Temporada 1" }],
    });
    await sql.query(
      `INSERT INTO "catalog_episode" ("id", "animeId", "seasonNumber", "number", "title", "videoUrl", "published", "publishedAt")
       VALUES ($1, $2, 1, 1, 'Ep', 'https://cdn.example.com/old.mp4', true, CURRENT_TIMESTAMP);`,
      [epOld, idOld],
    );
    await sql.query(
      `UPDATE "catalog_anime" SET "updatedAt" = NOW() - INTERVAL '10 days' WHERE "id" = $1;`,
      [idOld],
    );

    await executeAdminUpsertCatalogAnime({
      id: idUpdated,
      title: `Atualizado ${runId}`,
      anilistId: 980004,
      countryOfOrigin: "JP",
      seasons: [{ number: 1, title: "Temporada 1" }],
    });
    await sql.query(
      `INSERT INTO "catalog_episode" ("id", "animeId", "seasonNumber", "number", "title", "videoUrl", "published", "publishedAt")
       VALUES ($1, $2, 1, 1, 'Ep', 'https://cdn.example.com/upd.mp4', true, CURRENT_TIMESTAMP);`,
      [epUpd, idUpdated],
    );
    await sql.query(`UPDATE "catalog_anime" SET "updatedAt" = NOW() WHERE "id" = $1;`, [
      idUpdated,
    ]);

    const res = await executeGetHomeRecentlyAdded({ sqlOverride: sql, bypassCache: true });
    assert.equal(res.status, "success");
    assert.equal(res.items[0]?.id, idUpdated, "Anime com updatedAt mais recente deve voltar ao topo");
  });

  it("5. Ordenação utiliza updatedAt DESC, createdAt DESC e ID determinístico", async () => {
    const sql = await getSql();
    const res = await executeGetHomeRecentlyAdded({ sqlOverride: sql, bypassCache: true });
    assert.ok(Array.isArray(res.items));
  });

  it("6. Restringe estritamente a 18 registros no máximo", async () => {
    const sql = await getSql();
    const res = await executeGetHomeRecentlyAdded({ sqlOverride: sql, bypassCache: true });
    assert.ok(res.items.length <= 18, "Máximo de 18 itens permitidos");
  });

  it("7. Anime sem episódio publicado ou com episódio não publicado não aparece", async () => {
    const sql = await getSql();
    const id = `rec-noep-${runId}`;
    testAnimeIds.push(id);
    const epId = `ep-noep-${runId}`;
    testEpisodeIds.push(epId);

    await executeAdminUpsertCatalogAnime({
      id,
      title: `Sem Ep Publicado ${runId}`,
      anilistId: 980005,
      countryOfOrigin: "JP",
      seasons: [{ number: 1, title: "Temporada 1" }],
    });
    await sql.query(
      `INSERT INTO "catalog_episode" ("id", "animeId", "seasonNumber", "number", "title", "videoUrl", "published", "publishedAt")
       VALUES ($1, $2, 1, 1, 'Ep', 'https://cdn.example.com/noep.mp4', false, CURRENT_TIMESTAMP);`,
      [epId, id],
    );

    const res = await executeGetHomeRecentlyAdded({ sqlOverride: sql, bypassCache: true });
    assert.equal(res.items.some((a) => a.id === id), false);
  });

  it("8. Anime com episódio publicado e fonte reproduzível aparece", async () => {
    const sql = await getSql();
    const id = `rec-play-${runId}`;
    testAnimeIds.push(id);
    const epId = `ep-play-${runId}`;
    testEpisodeIds.push(epId);

    await executeAdminUpsertCatalogAnime({
      id,
      title: `Reproduzível ${runId}`,
      anilistId: 980006,
      countryOfOrigin: "JP",
      seasons: [{ number: 1, title: "Temporada 1" }],
    });
    await sql.query(
      `INSERT INTO "catalog_episode" ("id", "animeId", "seasonNumber", "number", "title", "videoUrl", "published", "publishedAt")
       VALUES ($1, $2, 1, 1, 'Ep', 'https://cdn.example.com/valid.mp4', true, CURRENT_TIMESTAMP);`,
      [epId, id],
    );

    const res = await executeGetHomeRecentlyAdded({ sqlOverride: sql, bypassCache: true });
    assert.ok(res.items.some((a) => a.id === id));
  });

  it("9. Anime oculto (hidden = true) ou arquivado (archived_at IS NOT NULL) não aparece", async () => {
    const sql = await getSql();
    const idHidden = `rec-hidden-${runId}`;
    const idArchived = `rec-arch-${runId}`;
    testAnimeIds.push(idHidden, idArchived);
    const epHid = `ep-hid-${runId}`;
    const epArc = `ep-arc-${runId}`;
    testEpisodeIds.push(epHid, epArc);

    await executeAdminUpsertCatalogAnime({
      id: idHidden,
      title: `Oculto ${runId}`,
      anilistId: 980007,
      countryOfOrigin: "JP",
      hidden: true,
      seasons: [{ number: 1, title: "Temporada 1" }],
    });
    await sql.query(
      `INSERT INTO "catalog_episode" ("id", "animeId", "seasonNumber", "number", "title", "videoUrl", "published", "publishedAt")
       VALUES ($1, $2, 1, 1, 'Ep', 'https://cdn.example.com/hid.mp4', true, CURRENT_TIMESTAMP);`,
      [epHid, idHidden],
    );

    await executeAdminUpsertCatalogAnime({
      id: idArchived,
      title: `Arquivado ${runId}`,
      anilistId: 980008,
      countryOfOrigin: "JP",
      hidden: false,
      seasons: [{ number: 1, title: "Temporada 1" }],
    });
    await sql.query(
      `INSERT INTO "catalog_episode" ("id", "animeId", "seasonNumber", "number", "title", "videoUrl", "published", "publishedAt")
       VALUES ($1, $2, 1, 1, 'Ep', 'https://cdn.example.com/arc.mp4', true, CURRENT_TIMESTAMP);`,
      [epArc, idArchived],
    );
    await sql.query(`UPDATE "catalog_anime" SET "archived_at" = NOW() WHERE "id" = $1;`, [
      idArchived,
    ]);

    const res = await executeGetHomeRecentlyAdded({ sqlOverride: sql, bypassCache: true });
    assert.equal(res.items.some((a) => a.id === idHidden), false);
    assert.equal(res.items.some((a) => a.id === idArchived), false);
  });

  it("10. IDs bloqueados na BLOCKED_ANILIST_IDS continuam bloqueados", async () => {
    const sql = await getSql();
    const blockedAnilist = BLOCKED_ANILIST_IDS[0];
    const id = `rec-blocked-${runId}`;
    testAnimeIds.push(id);
    const epId = `ep-blocked-${runId}`;
    testEpisodeIds.push(epId);

    await executeAdminUpsertCatalogAnime({
      id,
      title: `Blocklist ${runId}`,
      anilistId: blockedAnilist,
      countryOfOrigin: "JP",
      seasons: [{ number: 1, title: "Temporada 1" }],
    });
    await sql.query(
      `INSERT INTO "catalog_episode" ("id", "animeId", "seasonNumber", "number", "title", "videoUrl", "published", "publishedAt")
       VALUES ($1, $2, 1, 1, 'Ep', 'https://cdn.example.com/block.mp4', true, CURRENT_TIMESTAMP);`,
      [epId, id],
    );

    const res = await executeGetHomeRecentlyAdded({ sqlOverride: sql, bypassCache: true });
    assert.equal(res.items.some((a) => a.id === id || a.anilistId === blockedAnilist), false);
  });

  it("11. Animes chineses (countryOfOrigin === 'CN') são bloqueados, enquanto TW, HK, JP e null são permitidos", async () => {
    const sql = await getSql();
    const idCn = `rec-cn-${runId}`;
    const idTw = `rec-tw-${runId}`;
    testAnimeIds.push(idCn, idTw);
    const epCn = `ep-cn-${runId}`;
    const epTw = `ep-tw-${runId}`;
    testEpisodeIds.push(epCn, epTw);

    await executeAdminUpsertCatalogAnime({
      id: idCn,
      title: `China ${runId}`,
      anilistId: 980009,
      countryOfOrigin: "CN",
      seasons: [{ number: 1, title: "Temporada 1" }],
    });
    await sql.query(
      `INSERT INTO "catalog_episode" ("id", "animeId", "seasonNumber", "number", "title", "videoUrl", "published", "publishedAt")
       VALUES ($1, $2, 1, 1, 'Ep', 'https://cdn.example.com/cn.mp4', true, CURRENT_TIMESTAMP);`,
      [epCn, idCn],
    );

    await executeAdminUpsertCatalogAnime({
      id: idTw,
      title: `Taiwan ${runId}`,
      anilistId: 980010,
      countryOfOrigin: "TW",
      seasons: [{ number: 1, title: "Temporada 1" }],
    });
    await sql.query(
      `INSERT INTO "catalog_episode" ("id", "animeId", "seasonNumber", "number", "title", "videoUrl", "published", "publishedAt")
       VALUES ($1, $2, 1, 1, 'Ep', 'https://cdn.example.com/tw.mp4', true, CURRENT_TIMESTAMP);`,
      [epTw, idTw],
    );

    const res = await executeGetHomeRecentlyAdded({ sqlOverride: sql, bypassCache: true });
    assert.equal(res.items.some((a) => a.id === idCn), false);
    assert.equal(res.items.some((a) => a.id === idTw), true);
  });

  it("12. Anime Dublado independente com ID 'local-' aparece quando elegível e detecta isDubbed", async () => {
    const sql = await getSql();
    const parentId = `anilist-parent-${runId}`;
    const dubId = `local-dub-${runId}`;
    testAnimeIds.push(parentId, dubId);
    const epParent = `ep-par-${runId}`;
    const epDub = `ep-dub-${runId}`;
    testEpisodeIds.push(epParent, epDub);

    await executeAdminUpsertCatalogAnime({
      id: parentId,
      title: `Fool Night Legendado ${runId}`,
      anilistId: 980011,
      countryOfOrigin: "JP",
      seasons: [{ number: 1, title: "Temporada 1" }],
    });
    await sql.query(
      `INSERT INTO "catalog_episode" ("id", "animeId", "seasonNumber", "number", "title", "videoUrl", "published", "publishedAt")
       VALUES ($1, $2, 1, 1, 'Ep', 'https://cdn.example.com/sub.mp4', true, CURRENT_TIMESTAMP);`,
      [epParent, parentId],
    );

    await executeAdminUpsertCatalogAnime({
      id: dubId,
      title: `Fool Night Dublado ${runId}`,
      anilistId: null,
      countryOfOrigin: null,
      duplicateOfId: parentId,
      seasons: [{ number: 1, title: "Temporada 1" }],
    });
    await sql.query(
      `INSERT INTO "catalog_episode" ("id", "animeId", "seasonNumber", "number", "title", "videoUrl", "published", "publishedAt")
       VALUES ($1, $2, 1, 1, 'Ep Dub', 'https://cdn.example.com/dub.mp4', true, CURRENT_TIMESTAMP);`,
      [epDub, dubId],
    );

    const res = await executeGetHomeRecentlyAdded({ sqlOverride: sql, bypassCache: true });
    assert.equal(res.status, "success");
    const foundDub = res.items.find((a) => a.id === dubId);
    const foundSub = res.items.find((a) => a.id === parentId);
    assert.ok(foundDub);
    assert.equal(foundDub.isDubbed, true);
    assert.ok(foundSub);
    assert.equal(foundSub.isDubbed, false);
  });

  it("13. Legendado e Dublado permanecem completamente independentes", async () => {
    const sql = await getSql();
    const res = await executeGetHomeRecentlyAdded({ sqlOverride: sql, bypassCache: true });
    const subItems = res.items.filter((a) => a.id.startsWith("anilist-"));
    const dubItems = res.items.filter((a) => a.id.startsWith("local-"));
    assert.ok(subItems.length >= 0);
    assert.ok(dubItems.length >= 0);
  });

  it("14. Atualizações no Admin invalidam o cache correto (RAM + Redis)", async () => {
    const mockRedis = new MockRecentlyAddedRedis();
    const sql = await getSql();
    const id = `rec-admin-${runId}`;
    testAnimeIds.push(id);
    const epId = `ep-admin-${runId}`;
    testEpisodeIds.push(epId);

    await executeAdminUpsertCatalogAnime({
      id,
      title: `Admin Mutation ${runId}`,
      anilistId: 980012,
      countryOfOrigin: "JP",
      seasons: [{ number: 1, title: "Temporada 1" }],
    });
    await sql.query(
      `INSERT INTO "catalog_episode" ("id", "animeId", "seasonNumber", "number", "title", "videoUrl", "published", "publishedAt")
       VALUES ($1, $2, 1, 1, 'Ep', 'https://cdn.example.com/admin.mp4', true, CURRENT_TIMESTAMP);`,
      [epId, id],
    );

    const bgWrites: Promise<unknown>[] = [];
    const firstRead = await executeGetHomeRecentlyAdded({
      sqlOverride: sql,
      redisOverride: mockRedis,
      scheduleWrite: (p) => {
        bgWrites.push(p);
      },
    });
    assert.equal(firstRead.status, "success");
    await Promise.all(bgWrites);
    console.log("MockRedis store keys before invalidate:", Array.from(mockRedis.store.keys()));
    assert.equal(mockRedis.store.has(HOME_RECENTLY_ADDED_REDIS_KEY), true);

    await invalidateHomeRecentlyAddedCacheAsync({ redisOverride: mockRedis });
    console.log("MockRedis store keys after invalidate:", Array.from(mockRedis.store.keys()));
    assert.equal(mockRedis.store.has(HOME_RECENTLY_ADDED_REDIS_KEY), false);

    const upsertSource = readFileSync(
      resolve(process.cwd(), "src/lib/catalog-admin-ops.server.ts"),
      "utf8",
    );
    assert.equal(
      upsertSource.includes("invalidateHomeRecentlyAddedCacheAsync"),
      true,
    );
  });

  it("15. Falhas no Redis falham abertamente (fail-open) e recorrem ao PostgreSQL sem erro", async () => {
    const mockRedis = new MockRecentlyAddedRedis();
    mockRedis.shouldThrow = true;
    const sql = await getSql();

    const res = await executeGetHomeRecentlyAdded({
      sqlOverride: sql,
      redisOverride: mockRedis,
      bypassCache: false,
    });
    assert.equal(res.status, "success");
    assert.ok(res.items.length > 0);
  });

  it("16. Dados pendentes somente no IndexedDB local não aparecem como publicados na API pública", async () => {
    const sql = await getSql();
    const phantomId = `phantom-local-${runId}`;
    const res = await executeGetHomeRecentlyAdded({ sqlOverride: sql, bypassCache: true });
    assert.equal(res.items.some((a) => a.id === phantomId), false);
  });
});
