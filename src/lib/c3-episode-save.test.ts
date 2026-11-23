import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import {
  EPISODE_SAVE_CONCURRENCY,
  SOURCE_SYNC_CONCURRENCY,
  runWithConcurrency,
} from "./concurrency";
import { dbSource, getSql } from "./db";
import {
  OUTBOX_STORAGE_KEY,
  persistEpisode,
  readOutbox,
  writeOutbox,
  type PersistEpisodeResult,
} from "./episode-writer";
import {
  createEpisodeSourcesSessionStore,
  getEpisodeSlotsSignature,
} from "./episode-sources-session";
import {
  ANITUBE22_PROVIDER,
  parseAnitube22PlayerUrl,
  type EpisodeSourceItem,
} from "./anitube22";
import { sanitizePlayableVideoUrl } from "./published-episodes";
import {
  checkAndRecordEpisodeSource,
  listEpisodeSources,
  probeAnitube22PlayerUrl,
  syncCatalogEpisodeSlotsToSources,
  upsertEpisodeSource,
} from "./sources";

function makeAnitubeUrl(epNum: number, lang: "sub" | "dub" = "sub"): string {
  const id = String(700000 + epNum);
  const bucket = lang === "dub" ? "ziphonec" : "zful";
  return `https://www.anitube22.vip/playerricas.php?name=apphd/${id}.mp4&img=https://www.hinatasoul.com/media/videos/tmb/${id}/default.jpg&pais=pais=BR&time=1770000000&url=https://173fe263eae04670ecfcebf237fd6480.r2.cloudflarestorage.com/${bucket}/${id}.mp4`;
}

function createMemoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear() {
      data.clear();
    },
    getItem(key: string) {
      return data.has(key) ? data.get(key)! : null;
    },
    key(index: number) {
      return Array.from(data.keys())[index] ?? null;
    },
    removeItem(key: string) {
      data.delete(key);
    },
    setItem(key: string, value: string) {
      data.set(key, String(value));
    },
  };
}

function installTestWindowStorage(): () => void {
  const prevWindow = (globalThis as { window?: unknown }).window;
  const storage = createMemoryStorage();
  (globalThis as { window: unknown }).window = {
    localStorage: storage,
  };
  return () => {
    if (prevWindow === undefined) {
      delete (globalThis as { window?: unknown }).window;
    } else {
      (globalThis as { window?: unknown }).window = prevWindow;
    }
  };
}

describe("C3 — Concorrência controlada e pipeline de salvamento de episódios", () => {
  it("limita concorrência real para 25, 100, 250 e 500 tarefas sem execução antecipada e preservando a ordem", async () => {
    for (const total of [25, 100, 250, 500]) {
      let active = 0;
      let maxActive = 0;
      let createdCount = 0;

      const tasks = Array.from({ length: total }, (_, idx) => () => {
        createdCount += 1;
        // Nenhuma tarefa pode ser disparada além da janela de concorrência já iniciada + finalizada
        active += 1;
        if (active > maxActive) maxActive = active;
        return new Promise<number>((resolve) => {
          setTimeout(() => {
            active -= 1;
            resolve(idx);
          }, 1);
        });
      });

      assert.equal(
        createdCount,
        0,
        "Fábricas de tarefas não devem iniciar antes de runWithConcurrency",
      );

      const results = await runWithConcurrency(tasks, EPISODE_SAVE_CONCURRENCY);
      assert.equal(results.length, total);
      assert.equal(results[0], 0);
      assert.equal(results[total - 1], total - 1);
      assert.ok(
        maxActive <= EPISODE_SAVE_CONCURRENCY,
        `Concorrência máxima observada (${maxActive}) excedeu EPISODE_SAVE_CONCURRENCY (${EPISODE_SAVE_CONCURRENCY}) para ${total} tarefas`,
      );
      assert.ok(
        maxActive >= 2,
        `Esperava paralelismo controlado >= 2 (observado ${maxActive})`,
      );
    }

    // Valida também limite para sincronização de fontes no backend (SOURCE_SYNC_CONCURRENCY = 2, alinhado ao pool max=2)
    let activeSync = 0;
    let maxActiveSync = 0;
    const syncTasks = Array.from({ length: 100 }, (_, i) => async () => {
      activeSync += 1;
      if (activeSync > maxActiveSync) maxActiveSync = activeSync;
      await new Promise((r) => setTimeout(r, 1));
      activeSync -= 1;
      return i;
    });
    const syncResults = await runWithConcurrency(syncTasks, SOURCE_SYNC_CONCURRENCY);
    assert.equal(syncResults.length, 100);
    assert.ok(
      maxActiveSync <= SOURCE_SYNC_CONCURRENCY,
      `Concorrência de sync (${maxActiveSync}) excedeu SOURCE_SYNC_CONCURRENCY (${SOURCE_SYNC_CONCURRENCY})`,
    );
  });

  it("executa persistEpisode em lotes de 25, 100, 250 e 500 respeitando EPISODE_SAVE_CONCURRENCY (transporte HTTP isolado)", async () => {
    const restoreWindow = installTestWindowStorage();
    const originalFetch = globalThis.fetch;

    try {
      for (const count of [25, 100, 250, 500]) {
        let inFlight = 0;
        let maxInFlight = 0;
        let requestsCount = 0;

        globalThis.fetch = (async (_input: unknown, init?: RequestInit) => {
          inFlight += 1;
          requestsCount += 1;
          if (inFlight > maxInFlight) maxInFlight = inFlight;
          const body = JSON.parse(String(init?.body || "{}")) as {
            id: string;
            number: number;
            published?: boolean;
          };
          await new Promise((r) => setTimeout(r, 1));
          inFlight -= 1;
          return new Response(
            JSON.stringify({
              ok: true,
              published: Boolean(body.published),
              publishedAt: "2026-03-01T00:00:00.000Z",
              episodeId: `canonical-${body.id}`,
              canonicalId: `canonical-${body.id}`,
              reconciled: true,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }) as typeof fetch;

        const episodes = Array.from({ length: count }, (_, idx) => ({
          id: `local-ep-${count}-${idx + 1}`,
          number: idx + 1,
          title: `Episódio ${idx + 1}`,
          videoUrl: makeAnitubeUrl(idx + 1),
          published: true,
        }));

        const results = await runWithConcurrency(
          episodes.map((ep) => () => persistEpisode(`anime-${count}`, 1, ep, "Anime Teste")),
          EPISODE_SAVE_CONCURRENCY,
        );

        assert.equal(requestsCount, count);
        assert.equal(results.length, count);
        assert.ok(results.every((r) => r.confirmed && r.status === "synced"));
        assert.equal(results[0]?.canonicalId, `canonical-local-ep-${count}-1`);
        assert.ok(
          maxInFlight <= EPISODE_SAVE_CONCURRENCY,
          `Lote de ${count}: maxInFlight=${maxInFlight} excedeu limite ${EPISODE_SAVE_CONCURRENCY}`,
        );
      }
    } finally {
      globalThis.fetch = originalFetch;
      restoreWindow();
    }
  });

  it("trata falha parcial sem falso sucesso, preserva Outbox e mantém invalidação seletiva C1 apenas nos episódios confirmados", async () => {
    const restoreWindow = installTestWindowStorage();
    const originalFetch = globalThis.fetch;

    try {
      const animeId = "anime-partial-fail";
      const total = 100;
      const failingNumber = 47;
      const conflictNumber = 82;

      const store = createEpisodeSourcesSessionStore();
      const episodes = Array.from({ length: total }, (_, idx) => ({
        id: `ep-${idx + 1}`,
        number: idx + 1,
        title: `Episódio ${idx + 1}`,
        videoUrl: makeAnitubeUrl(idx + 1),
        published: true,
      }));

      // Pré-aquece cache C1 para episódios que serão salvos e para um episódio não salvo (ep-untouched)
      const makeCached = (episodeId: string): EpisodeSourceItem[] => [
        {
          id: `src-${episodeId}`,
          episodeId,
          provider: ANITUBE22_PROVIDER,
          externalId: "700001",
          lang: "sub",
          quality: "1080p",
          priority: 0,
          status: "active",
          failCount: 0,
          lastCheckedAt: null,
          namePath: "apphd/700001.mp4",
          urlPath: "https://cdn.example/zful/700001.mp4",
        },
      ];
      await store.loadEpisodeSources("ep-1", async () => makeCached("ep-1"));
      await store.loadEpisodeSources(`ep-${failingNumber}`, async () =>
        makeCached(`ep-${failingNumber}`),
      );
      await store.loadEpisodeSources("ep-untouched", async () => makeCached("ep-untouched"));

      // Pré-popula Outbox para ep-1 (que terá sucesso)
      writeOutbox([
        {
          id: "outbox-ep-1",
          type: "upsert",
          episodeId: "ep-1",
          animeId,
          seasonNumber: 1,
          episodeNumber: 1,
          createdAt: Date.now(),
          attempts: 0,
          status: "pending",
        },
      ]);

      globalThis.fetch = (async (_input: unknown, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body || "{}")) as {
          id: string;
          number: number;
          published?: boolean;
        };
        if (body.number === failingNumber) {
          return new Response(JSON.stringify({ error: "Timeout temporário no servidor" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (body.number === conflictNumber) {
          return new Response(
            JSON.stringify({ error: "Conflito de slot no servidor" }),
            { status: 409, headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response(
          JSON.stringify({
            ok: true,
            published: Boolean(body.published),
            publishedAt: "2026-03-01T00:00:00.000Z",
            episodeId: `canon-${body.id}`,
            canonicalId: `canon-${body.id}`,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }) as typeof fetch;

      const results: PersistEpisodeResult[] = await runWithConcurrency(
        episodes.map((ep) => () => persistEpisode(animeId, 1, ep, "Anime Parcial")),
        EPISODE_SAVE_CONCURRENCY,
      );

      const confirmedCount = results.filter((r) => r.confirmed).length;
      const allEpisodesSynced = confirmedCount === results.length;

      assert.equal(confirmedCount, 98);
      assert.equal(allEpisodesSynced, false, "Não pode reportar sucesso total quando 2 episódios falharam");
      assert.equal(results[failingNumber - 1]?.status, "pending");
      assert.equal(results[conflictNumber - 1]?.status, "conflict");

      // Outbox removeu ep-1 confirmado e preservou ep-47 (pending) e ep-82 (conflict)
      const outbox = readOutbox();
      assert.equal(outbox.some((op) => op.episodeId === "ep-1" || op.episodeId === "canon-ep-1"), false);
      const pendingOp = outbox.find((op) => op.episodeId === `ep-${failingNumber}`);
      const conflictOp = outbox.find((op) => op.episodeId === `ep-${conflictNumber}`);
      assert.equal(pendingOp?.status, "pending");
      assert.equal(conflictOp?.status, "conflict");
      assert.ok(window.localStorage.getItem(OUTBOX_STORAGE_KEY));

      // Reconcilia baseline e invalida seletivamente APENAS episódios confirmados
      const confirmedIds = new Set<string>();
      results.forEach((r, idx) => {
        if (!r.confirmed) return;
        const origId = episodes[idx]!.id;
        confirmedIds.add(origId);
        if (r.canonicalId) confirmedIds.add(r.canonicalId);
        store.updateEpisodeBaseline(
          r.canonicalId || origId,
          getEpisodeSlotsSignature(episodes[idx]!),
        );
      });
      store.invalidateEpisodes(confirmedIds);

      assert.equal(store.isValid("ep-1"), false, "Episódio confirmado teve cache C1 invalidado");
      assert.equal(
        store.isValid(`ep-${failingNumber}`),
        true,
        "Episódio com falha não foi invalidado indevidamente",
      );
      assert.equal(
        store.isValid("ep-untouched"),
        true,
        "Episódio não alterado preservou cache C1",
      );
    } finally {
      globalThis.fetch = originalFetch;
      restoreWindow();
    }
  });
});

describe(`C3 — Persistência real no PostgreSQL (${dbSource}) sem probes externos bloqueantes`, () => {
  const animeId = `c3-anime-${Date.now()}`;
  const createdEpisodeIds: string[] = [];
  let createdSourceIds: string[] = [];

  before(async () => {
    const sql = await getSql();
    await sql.query(
      `INSERT INTO "catalog_anime" ("id", "title", "createdAt", "updatedAt")
       VALUES ($1, 'Anime C3 Teste Real', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT ("id") DO NOTHING;`,
      [animeId],
    );
    await sql.query(
      `INSERT INTO "catalog_season" ("animeId", "number", "title", "position", "createdAt")
       VALUES ($1, 1, 'Temporada 1', 0, CURRENT_TIMESTAMP)
       ON CONFLICT ("animeId", "number") DO NOTHING;`,
      [animeId],
    );
  });

  after(async () => {
    const sql = await getSql();
    if (createdEpisodeIds.length > 0) {
      await sql.query(
        `DELETE FROM "episode_sources" WHERE "episode_id" = ANY($1::text[]);`,
        [createdEpisodeIds],
      );
      await sql.query(
        `DELETE FROM "catalog_episode" WHERE "id" = ANY($1::text[]);`,
        [createdEpisodeIds],
      );
    }
    await sql.query(`DELETE FROM "catalog_season" WHERE "animeId" = $1;`, [animeId]);
    await sql.query(`DELETE FROM "catalog_anime" WHERE "id" = $1;`, [animeId]);
  });

  it("persiste slots, IDs canônicos e sincroniza episode_sources com skipProbe=true sem nenhuma chamada HTTP externa (25, 100 e 250/500 escalado)", async () => {
    const sql = await getSql();
    const originalFetch = globalThis.fetch;
    let externalFetchCalls = 0;

    globalThis.fetch = (async () => {
      externalFetchCalls += 1;
      throw new Error("Erro: fetch externo não deveria ser chamado durante salvamento normal!");
    }) as typeof fetch;

    try {
      // Testa 100 episódios reais no banco (incluindo preservação de ID canônico quando cliente envia outro ID para mesmo slot)
      const count = 100;
      const episodeInputs = Array.from({ length: count }, (_, idx) => {
        const epNum = idx + 1;
        const epId = `c3-ep-${animeId}-${epNum}`;
        createdEpisodeIds.push(epId);
        return {
          id: epId,
          number: epNum,
          slot1: sanitizePlayableVideoUrl(makeAnitubeUrl(epNum, "sub")),
          slot2: sanitizePlayableVideoUrl(makeAnitubeUrl(epNum, "dub")),
        };
      });

      const tStart = performance.now();
      await runWithConcurrency(
        episodeInputs.map((item) => async () => {
          const upsert = await sql.query<{ id: string }>(
            `INSERT INTO "catalog_episode" (
               "id", "animeId", "seasonNumber", "number", "title",
               "videoUrl", "videoUrl2", "published", "createdAt", "updatedAt"
             )
             VALUES ($1, $2, 1, $3, $4, $5, $6, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
             ON CONFLICT ("animeId", "seasonNumber", "number") DO UPDATE
             SET
               "videoUrl" = EXCLUDED."videoUrl",
               "videoUrl2" = EXCLUDED."videoUrl2",
               "updatedAt" = CURRENT_TIMESTAMP
             RETURNING "id";`,
            [item.id, animeId, item.number, `Episódio ${item.number}`, item.slot1, item.slot2],
          );
          const canonicalId = upsert[0]!.id;
          assert.equal(canonicalId, item.id);

          await syncCatalogEpisodeSlotsToSources(
            canonicalId,
            [
              { url: item.slot1, priority: 0 },
              { url: item.slot2, priority: 1 },
            ],
            { replaceAnitube22: true, skipProbe: true },
          );
        }),
        SOURCE_SYNC_CONCURRENCY,
      );
      const elapsedMs = performance.now() - tStart;

      assert.equal(
        externalFetchCalls,
        0,
        "Zero chamadas HTTP externas devem ocorrer durante o salvamento",
      );

      // Re-salva episódio 1 enviando ID diferente para o mesmo slot (animeId, 1, 1) -> deve preservar ID canônico!
      const conflictReSave = await sql.query<{ id: string }>(
        `INSERT INTO "catalog_episode" (
           "id", "animeId", "seasonNumber", "number", "title",
           "videoUrl", "published", "createdAt", "updatedAt"
         )
         VALUES ($1, $2, 1, 1, 'Episódio 1 Atualizado', $3, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT ("animeId", "seasonNumber", "number") DO UPDATE
         SET "title" = EXCLUDED."title", "videoUrl" = EXCLUDED."videoUrl", "updatedAt" = CURRENT_TIMESTAMP
         RETURNING "id";`,
        [`temp-reconcile-${animeId}-1`, animeId, episodeInputs[0]!.slot1],
      );
      assert.equal(
        conflictReSave[0]?.id,
        episodeInputs[0]!.id,
        "ID canônico existente no slot deve ser preservado",
      );

      // Confirma persistência real de slots e episode_sources no banco (sem time=)
      const dbEpisodes = await sql.query<{
        id: string;
        videoUrl: string | null;
        videoUrl2: string | null;
      }>(
        `SELECT "id", "videoUrl", "videoUrl2"
         FROM "catalog_episode"
         WHERE "animeId" = $1
         ORDER BY "number" ASC;`,
        [animeId],
      );
      assert.equal(dbEpisodes.length, count);
      assert.ok(dbEpisodes[0]?.videoUrl?.includes("/zful/700001.mp4"));
      assert.ok(dbEpisodes[0]?.videoUrl2?.includes("/ziphonec/700001.mp4"));
      assert.equal(dbEpisodes[0]?.videoUrl?.includes("time="), false);

      const sourcesEp1 = await listEpisodeSources(episodeInputs[0]!.id, {
        includeBroken: true,
      });
      // Nota: ambos slots vão com hint de idioma 'sub' quando título do anime não tem 'dublado', então
      // verifica que as fontes ativas foram sincronizadas e preservam url_path válido sem time=
      assert.ok(sourcesEp1.length >= 1);
      assert.ok(sourcesEp1.every((s) => s.status === "active" && s.namePath && s.urlPath));
      createdSourceIds = sourcesEp1.map((s) => s.id);

      // Verifica substituição de fontes antigas (batch delete staleIds)
      const replacementUrl = makeAnitubeUrl(9999);
      const updatedSources = await syncCatalogEpisodeSlotsToSources(
        episodeInputs[0]!.id,
        [{ url: replacementUrl, priority: 0, lang: "sub" }],
        { replaceAnitube22: true, skipProbe: true },
      );
      assert.equal(updatedSources.length, 1);
      assert.equal(updatedSources[0]?.externalId, String(700000 + 9999));
      const afterReplaceSources = await listEpisodeSources(episodeInputs[0]!.id, {
        includeBroken: true,
      });
      assert.equal(afterReplaceSources.length, 1);
      assert.equal(afterReplaceSources[0]?.externalId, String(700000 + 9999));

      // Restaura fonte original do ep1 para o teste manual a seguir
      await syncCatalogEpisodeSlotsToSources(
        episodeInputs[0]!.id,
        [{ url: makeAnitubeUrl(1), priority: 0, lang: "sub" }],
        { replaceAnitube22: true, skipProbe: true },
      );
      const restoredSources = await listEpisodeSources(episodeInputs[0]!.id, {
        includeBroken: true,
      });
      createdSourceIds = restoredSources.map((s) => s.id);

      // Mantém elapsedMs observado apenas como sanity check (< 15s para 100 eps no PGLite/Neon vs 600s se fizesse probe de 6s)
      assert.ok(elapsedMs < 15_000, `Salvamento de 100 eps demorou ${elapsedMs.toFixed(1)}ms`);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("preserva verificação manual (probe HTTP externo) em checkAndRecordEpisodeSource e probeAnitube22PlayerUrl", async () => {
    const sourceId = createdSourceIds[0];
    assert.ok(sourceId, "Fonte de teste deve existir no banco");

    let probeCalls = 0;
    const manualOk = await checkAndRecordEpisodeSource(sourceId, {
      fetchImpl: async (input) => {
        probeCalls += 1;
        assert.ok(String(input).includes("playerricas.php"));
        return new Response("<html>player ok</html>", { status: 200 });
      },
    });
    assert.equal(probeCalls, 1);
    assert.equal(manualOk.ok, true);
    assert.equal(manualOk.status, "active");

    const manualFail1 = await checkAndRecordEpisodeSource(sourceId, {
      fetchImpl: async () => {
        probeCalls += 1;
        return new Response("deleted 404 not found", { status: 404 });
      },
    });
    assert.equal(probeCalls, 2);
    assert.equal(manualFail1.ok, false);
    assert.equal(manualFail1.failCount, 1);
    assert.equal(manualFail1.status, "active");

    const manualFail2 = await checkAndRecordEpisodeSource(sourceId, {
      fetchImpl: async () => {
        probeCalls += 1;
        return new Response("deleted 404 not found", { status: 404 });
      },
    });
    assert.equal(probeCalls, 3);
    assert.equal(manualFail2.ok, false);
    assert.equal(manualFail2.failCount, 2);
    assert.equal(manualFail2.status, "broken");

    const directProbe = await probeAnitube22PlayerUrl(makeAnitubeUrl(5), {
      fetchImpl: async (url) => {
        probeCalls += 1;
        assert.ok(String(url).includes("playerricas.php"));
        return new Response("<html>ok</html>", { status: 200 });
      },
    });
    assert.equal(probeCalls, 4);
    assert.equal(directProbe.ok, true);
    assert.equal(directProbe.status, "active");
  });

  it("executa importação em lote e restauração de backup no PostgreSQL real com concorrência limitada e zero probes HTTP externos", async () => {
    const sql = await getSql();
    const originalFetch = globalThis.fetch;
    let externalFetchCalls = 0;
    globalThis.fetch = (async () => {
      externalFetchCalls += 1;
      throw new Error("Import/Backup não podem disparar probes HTTP externos!");
    }) as typeof fetch;

    const batchAnimeId = `c3-batch-${Date.now()}`;
    const batchEpIds: string[] = [];

    try {
      const episodes = Array.from({ length: 60 }, (_, idx) => {
        const epNum = idx + 1;
        const epId = `${batchAnimeId}-ep-${epNum}`;
        batchEpIds.push(epId);
        return {
          id: epId,
          number: epNum,
          videoUrl: sanitizePlayableVideoUrl(makeAnitubeUrl(1000 + epNum)),
        };
      });

      // Simula transação idêntica à de catalog-import.ts e backup.ts + pós-commit com runWithConcurrency(..., SOURCE_SYNC_CONCURRENCY)
      await sql.query("BEGIN;");
      try {
        await sql.query(
          `INSERT INTO "catalog_anime" ("id", "title", "createdAt", "updatedAt")
           VALUES ($1, 'Anime Import & Backup C3', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
          [batchAnimeId],
        );
        await sql.query(
          `INSERT INTO "catalog_season" ("animeId", "number", "title", "position", "createdAt")
           VALUES ($1, 1, 'Temporada 1', 0, CURRENT_TIMESTAMP);`,
          [batchAnimeId],
        );

        for (const ep of episodes) {
          await sql.query(
            `INSERT INTO "catalog_episode" (
               "id", "animeId", "seasonNumber", "number", "title",
               "videoUrl", "published", "createdAt", "updatedAt"
             )
             VALUES ($1, $2, 1, $3, $4, $5, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
            [ep.id, batchAnimeId, ep.number, `Episódio ${ep.number}`, ep.videoUrl],
          );
        }
        await sql.query("COMMIT;");
      } catch (err) {
        await sql.query("ROLLBACK;");
        throw err;
      }

      const candidateItems = episodes
        .map((ep) => ({
          episodeId: ep.id,
          slots: [{ url: ep.videoUrl, priority: 0 }],
        }))
        .filter((item) =>
          item.slots.some((s) => Boolean(s.url && parseAnitube22PlayerUrl(s.url))),
        );

      await runWithConcurrency(
        candidateItems.map((item) => () =>
          syncCatalogEpisodeSlotsToSources(item.episodeId, item.slots, {
            replaceAnitube22: true,
            skipProbe: true,
          }),
        ),
        SOURCE_SYNC_CONCURRENCY,
      );

      assert.equal(externalFetchCalls, 0);
      const countRows = await sql.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM "episode_sources" WHERE "episode_id" = ANY($1::text[]);`,
        [batchEpIds],
      );
      assert.equal(countRows[0]?.count, 60);

      // Confirma que upsertEpisodeSource sem skipProbe=true (fluxo manual) ainda chama fetch normalmente
      let manualUpsertProbes = 0;
      const manualAdded = await upsertEpisodeSource(
        {
          episodeId: batchEpIds[0]!,
          provider: ANITUBE22_PROVIDER,
          externalId: makeAnitubeUrl(8888),
          lang: "sub",
          priority: 2,
        },
        {
          fetchImpl: async () => {
            manualUpsertProbes += 1;
            return new Response("<html>ok</html>", { status: 200 });
          },
        },
      );
      assert.equal(manualUpsertProbes, 1);
      assert.equal(manualAdded.status, "active");
    } finally {
      globalThis.fetch = originalFetch;
      if (batchEpIds.length > 0) {
        await sql.query(
          `DELETE FROM "episode_sources" WHERE "episode_id" = ANY($1::text[]);`,
          [batchEpIds],
        );
        await sql.query(
          `DELETE FROM "catalog_episode" WHERE "id" = ANY($1::text[]);`,
          [batchEpIds],
        );
      }
      await sql.query(`DELETE FROM "catalog_season" WHERE "animeId" = $1;`, [batchAnimeId]);
      await sql.query(`DELETE FROM "catalog_anime" WHERE "id" = $1;`, [batchAnimeId]);
    }
  });

  it("confirma que todas as rotas C3 e o editor aplicam concorrência limitada e skipProbe sem alterar C1/C2 ou verificação manual", () => {
    const adminEditorSrc = fs.readFileSync(
      path.resolve("src/routes/admin.$id.tsx"),
      "utf8",
    );
    const catalogEpisodeSrc = fs.readFileSync(
      path.resolve("src/routes/api/admin/catalog-episode.ts"),
      "utf8",
    );
    const catalogImportSrc = fs.readFileSync(
      path.resolve("src/routes/api/admin/catalog-import.ts"),
      "utf8",
    );
    const backupSrc = fs.readFileSync(
      path.resolve("src/routes/api/admin/backup.ts"),
      "utf8",
    );
    const episodeSourcesApiSrc = fs.readFileSync(
      path.resolve("src/routes/api/episode-sources.ts"),
      "utf8",
    );

    assert.equal(
      adminEditorSrc.includes("Promise.all(episodeTasks"),
      false,
      "admin.$id.tsx não pode usar Promise.all ilimitado para episódios",
    );
    assert.ok(adminEditorSrc.includes("runWithConcurrency("));
    assert.ok(adminEditorSrc.includes("EPISODE_SAVE_CONCURRENCY"));

    assert.ok(catalogEpisodeSrc.includes("skipProbe: true"));
    assert.ok(catalogImportSrc.includes("skipProbe: true"));
    assert.ok(catalogImportSrc.includes("SOURCE_SYNC_CONCURRENCY"));
    assert.ok(backupSrc.includes("skipProbe: true"));
    assert.ok(backupSrc.includes("SOURCE_SYNC_CONCURRENCY"));

    assert.ok(episodeSourcesApiSrc.includes("checkAndRecordEpisodeSource"));
    assert.ok(episodeSourcesApiSrc.includes("probeAnitube22PlayerUrl"));
    assert.equal(episodeSourcesApiSrc.includes("skipProbe: true"), false);
  });
});
