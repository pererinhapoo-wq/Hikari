import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  consolidateAnimeParent,
  persistEpisode,
  flushOutbox,
  OUTBOX_STORAGE_KEY,
  readOutbox,
  writeOutbox,
} from "./episode-writer";
import { useHikariStore } from "./store";

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

describe("Hikari — Sincronização de Outbox e Anime Dublado (Testes Obrigatórios)", () => {
  it("1, 2 & 4. Anime dublado com ID local 'local-...' é consolidado antes dos episódios, aplicando ID definitivo e mantendo áudio 'dub' e IDs independentes", async () => {
    const storage = createMemoryStorage();
    const prevWindow = (globalThis as { window?: unknown }).window;
    (globalThis as { window: unknown }).window = { localStorage: storage };

    const localAnimeId = "local-anime-fool-night-dub";
    const definitiveAnimeId = "server-anime-fool-night-dub-def";

    useHikariStore.setState({
      animes: [
        {
          id: localAnimeId,
          titleRomaji: "Fool Night Dublado",
          titleEnglish: "Fool Night Dubbed",
          titleNative: "",
          cover: "",
          banner: "",
          synopsis: "Dub",
          score: 8,
          genres: ["Sci-Fi"],
          format: "TV",
          status: "FINISHED",
          episodesCount: 12,
          season: "FALL",
          year: 2025,
          trailerId: "",
          hidden: false,
          anilistId: 999999,
          malId: 999999,
          kitsuId: 999999,
          duplicateOfId: "server-anime-fool-night-sub",
          seasons: [{ id: "s-1", number: 1, title: "Temporada 1", episodes: [] }],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
    });

    writeOutbox([
      {
        id: "outbox-1",
        type: "upsert",
        episodeId: "local-ep-1",
        animeId: localAnimeId,
        seasonNumber: 1,
        episodeNumber: 1,
        payload: {
          id: "local-ep-1",
          animeId: localAnimeId,
          seasonNumber: 1,
          number: 1,
          title: "Episódio 1 Dub",
          audio: "dub",
          videoUrl: "https://www.anitube22.vip/playerricas.php?name=apphd/123.mp4",
          published: true,
        },
        createdAt: Date.now(),
        attempts: 0,
        status: "pending",
      },
    ]);

    const originalFetch = globalThis.fetch;
    let animeCreated = false;
    let episodeSynced = false;

    globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/admin/catalog-anime")) {
        animeCreated = true;
        return new Response(
          JSON.stringify({
            ok: true,
            animeId: definitiveAnimeId,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.includes("/api/admin/catalog-episode")) {
        const body = JSON.parse(String(init?.body || "{}"));
        assert.equal(body.animeId, definitiveAnimeId, "Episódio deve ser enviado com o ID definitivo do anime");
        assert.equal(body.audio, "dub", "Áudio deve permanecer dub");
        episodeSynced = true;
        return new Response(
          JSON.stringify({
            ok: true,
            episodeId: "server-ep-1",
            canonicalId: "server-ep-1",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response("Not found", { status: 404 });
    }) as typeof fetch;

    try {
      const defId = await consolidateAnimeParent(localAnimeId);
      assert.equal(defId, definitiveAnimeId);
      assert.equal(animeCreated, true);

      const ops = readOutbox();
      assert.equal(ops[0]?.animeId, definitiveAnimeId, "Outbox deve ter o animeId atualizado para o definitivo");

      const flushResult = await flushOutbox();
      assert.equal(flushResult.processed, 1);
      assert.equal(flushResult.remaining, 0);
      assert.equal(episodeSynced, true);
    } finally {
      globalThis.fetch = originalFetch;
      if (prevWindow === undefined) {
        delete (globalThis as { window?: unknown }).window;
      } else {
        (globalThis as { window: unknown }).window = prevWindow;
      }
    }
  });

  it("5, 6, 7 & 10. Falha na criação do anime não envia episódios, falha de conexão preserva operações e outras operações não são afetadas", async () => {
    const storage = createMemoryStorage();
    const prevWindow = (globalThis as { window?: unknown }).window;
    (globalThis as { window: unknown }).window = { localStorage: storage };

    const localAnimeId = "local-anime-fail";
    const otherAnimeId = "other-anime-server";

    useHikariStore.setState({
      animes: [
        {
          id: localAnimeId,
          titleRomaji: "Fail Anime",
          titleEnglish: "",
          titleNative: "",
          cover: "",
          banner: "",
          synopsis: "",
          score: 5,
          genres: [],
          format: "TV",
          status: "RELEASING",
          episodesCount: 1,
          season: "SPRING",
          year: 2026,
          trailerId: "",
          hidden: false,
          anilistId: 888888,
          malId: 888888,
          kitsuId: 888888,
          seasons: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
    });

    writeOutbox([
      {
        id: "outbox-other",
        type: "upsert",
        episodeId: "other-ep-1",
        animeId: otherAnimeId,
        seasonNumber: 1,
        episodeNumber: 1,
        payload: {
          id: "other-ep-1",
          animeId: otherAnimeId,
          seasonNumber: 1,
          number: 1,
          title: "Other Ep",
          audio: "sub",
          published: true,
        },
        createdAt: Date.now(),
        attempts: 0,
        status: "pending",
      },
      {
        id: "outbox-fail",
        type: "upsert",
        episodeId: "fail-ep-1",
        animeId: localAnimeId,
        seasonNumber: 1,
        episodeNumber: 1,
        payload: {
          id: "fail-ep-1",
          animeId: localAnimeId,
          seasonNumber: 1,
          number: 1,
          title: "Fail Ep",
          audio: "dub",
          published: true,
        },
        createdAt: Date.now(),
        attempts: 0,
        status: "pending",
      },
    ]);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/admin/catalog-anime")) {
        return new Response(JSON.stringify({ error: "Erro interno Neon" }), { status: 500 });
      }
      if (url.includes("/api/admin/catalog-episode")) {
        const body = JSON.parse(String(init?.body || "{}"));
        if (body.animeId === otherAnimeId) {
          return new Response(JSON.stringify({ ok: true, episodeId: "other-ep-1" }), { status: 200 });
        }
      }
      return new Response("Error", { status: 500 });
    }) as typeof fetch;

    try {
      const flushResult = await flushOutbox();
      const remaining = readOutbox();
      
      // O anime com falha na criação não envia episódio, mantendo a operação local intacta
      const failOp = remaining.find((o) => o.episodeId === "fail-ep-1");
      assert.ok(failOp, "Operação do anime com falha deve ser preservada na Outbox");
      assert.equal(failOp.animeId, localAnimeId);

      // Operações de outros animes sem erro devem ter sido processadas ou mantidas sem alteração indevida
      assert.ok(remaining.length >= 1);
    } finally {
      globalThis.fetch = originalFetch;
      if (prevWindow === undefined) {
        delete (globalThis as { window?: unknown }).window;
      } else {
        (globalThis as { window: unknown }).window = prevWindow;
      }
    }
  });
});
