import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import {
  buildConsolidatedAnimePayload,
  clearAnimeParentConsolidationCache,
  consolidateAnimeParent,
  flushOutbox,
  isConfirmedServerAnime,
  persistEpisode,
  readOutbox,
  repairDubbedOutboxEpisodeIds,
  writeOutbox,
  type OutboxOperation,
} from "./episode-writer";
import { cloneSeasonsForDubbedAnime, isExternalEpisodeId } from "./episode-id";
import {
  mergeSeasonsWithRemoteForAdmin,
  resolveAdminAnimeWithRemote,
} from "./overlay";
import {
  animeAdminPostSchema,
  executeAdminUpsertCatalogAnime,
} from "./catalog-admin-ops.server";
import { invalidateCatalogEpisodesCacheAsync } from "./catalog-episodes";
import { dbSource, getSql } from "./db";
import { useHikariStore } from "./store";
import type { Anime, LocalAnime } from "./types";
import { handlePostCatalogEpisode } from "@/routes/api/admin/catalog-episode";

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

function withIsolatedWindow<T>(fn: () => Promise<T>): Promise<T> {
  const storage = createMemoryStorage();
  const prevWindow = (globalThis as { window?: unknown }).window;
  const prevAnimes = useHikariStore.getState().animes;
  const prevHydrated = useHikariStore.getState().hydrated;
  (globalThis as { window: unknown }).window = { localStorage: storage };
  clearAnimeParentConsolidationCache();

  return fn().finally(() => {
    clearAnimeParentConsolidationCache();
    useHikariStore.setState({ animes: prevAnimes, hydrated: prevHydrated });
    if (prevWindow === undefined) {
      delete (globalThis as { window?: unknown }).window;
    } else {
      (globalThis as { window: unknown }).window = prevWindow;
    }
  });
}

function makeDubbedLocalAnime(overrides: Partial<LocalAnime> = {}): LocalAnime {
  const now = Date.now();
  return {
    id: `local-${now}-${Math.random().toString(36).slice(2, 7)}`,
    titleRomaji: "Fool Night Dublado",
    titleEnglish: "Fool Night Dub",
    titleNative: "フールナイト",
    cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/fn.jpg",
    banner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/fn.jpg",
    synopsis: "Sinopse Dub",
    score: 85,
    genres: ["Drama", "Sci-Fi"],
    format: "TV",
    status: "FINISHED",
    episodesCount: 12,
    season: "FALL",
    year: 2025,
    trailerId: null,
    hidden: false,
    anilistId: 213457,
    malId: 999213,
    kitsuId: 888213,
    duplicateOfId: "anilist-213457",
    seasons: [{ id: "s-1", number: 1, title: "Temporada 1", episodes: [] }],
    createdAt: now - 1000,
    updatedAt: now,
    ...overrides,
  };
}

describe("Hikari — Sincronização de Outbox e Anime Dublado (10 Cenários Obrigatórios)", () => {
  it("1. Reconhece anime 'local-...' já confirmado pelo servidor (serverCatalogId === id) sem repetir criação", async () => {
    await withIsolatedWindow(async () => {
      const dubId = "local-a96d58dd-39a3-438d-af0f-4ee50b78ca1e";
      const now = Date.now();
      const confirmedAnime = makeDubbedLocalAnime({
        id: dubId,
        serverCatalogId: dubId,
        createdAt: now - 5000,
        syncedAt: now,
      });

      assert.equal(isConfirmedServerAnime(confirmedAnime), true);
      useHikariStore.setState({ animes: [confirmedAnime], hydrated: true });

      const originalFetch = globalThis.fetch;
      let animePostCount = 0;
      let episodePostCount = 0;

      globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/api/admin/catalog-anime")) {
          animePostCount++;
          return new Response(JSON.stringify({ ok: true, animeId: dubId }), { status: 200 });
        }
        if (url.includes("/api/admin/catalog-episode")) {
          episodePostCount++;
          const body = JSON.parse(String(init?.body || "{}"));
          assert.equal(body.animeId, dubId);
          assert.equal(body.audio, "dub");
          return new Response(
            JSON.stringify({ ok: true, episodeId: body.id, canonicalId: body.id }),
            { status: 200 },
          );
        }
        return new Response("Not found", { status: 404 });
      }) as typeof fetch;

      try {
        const resolved = await consolidateAnimeParent(dubId);
        assert.equal(resolved, dubId);
        assert.equal(animePostCount, 0, "Não deve reenviar POST /catalog-anime quando o anime local já está confirmado");

        const result = await persistEpisode(
          dubId,
          1,
          {
            id: "ep-dub-1",
            number: 1,
            title: "Episódio 1",
            audio: "dub",
            videoUrl: "https://cdn.example.com/fool-night-dub-01.mp4",
            published: true,
          },
          "Fool Night Dublado",
        );

        assert.equal(result.confirmed, true);
        assert.equal(result.status, "synced");
        assert.equal(animePostCount, 0);
        assert.equal(episodePostCount, 1);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  it("2. Consolida anime 'local-...' não confirmado uma única vez quando servidor mantém o mesmo ID e envia episódios em seguida", async () => {
    await withIsolatedWindow(async () => {
      const dubId = "local-dup-same-id-1";
      // Simula bug legado em que duplicateAsDubbed copiou serverCatalogId e syncedAt antigos do legendado
      const staleDubAnime = makeDubbedLocalAnime({
        id: dubId,
        serverCatalogId: "anilist-213457",
        createdAt: 2000,
        syncedAt: 1000, // syncedAt anterior ao createdAt -> não pode contar como confirmado!
      });

      assert.equal(isConfirmedServerAnime(staleDubAnime), false);
      useHikariStore.setState({ animes: [staleDubAnime], hydrated: true });

      const originalFetch = globalThis.fetch;
      let animePostCount = 0;
      let episodePostCount = 0;

      globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/api/admin/catalog-anime")) {
          animePostCount++;
          return new Response(JSON.stringify({ ok: true, animeId: dubId }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (url.includes("/api/admin/catalog-episode")) {
          episodePostCount++;
          const body = JSON.parse(String(init?.body || "{}"));
          assert.equal(body.animeId, dubId);
          return new Response(
            JSON.stringify({ ok: true, episodeId: body.id, canonicalId: body.id }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response("Not found", { status: 404 });
      }) as typeof fetch;

      try {
        const r1 = await persistEpisode(dubId, 1, {
          id: "e-dub-1",
          number: 1,
          title: "Ep 1",
          audio: "dub",
          videoUrl: "https://cdn.example.com/1.mp4",
          published: true,
        });
        const r2 = await persistEpisode(dubId, 1, {
          id: "e-dub-2",
          number: 2,
          title: "Ep 2",
          audio: "dub",
          videoUrl: "https://cdn.example.com/2.mp4",
          published: true,
        });

        assert.equal(r1.confirmed, true);
        assert.equal(r2.confirmed, true);
        assert.equal(animePostCount, 1, "Deve consolidar o anime pai no máximo 1 vez");
        assert.equal(episodePostCount, 2);

        const updatedStoreAnime = useHikariStore.getState().animes.find((a) => a.id === dubId);
        assert.equal(updatedStoreAnime?.serverCatalogId, dubId);
        assert.ok((updatedStoreAnime?.syncedAt ?? 0) > 0);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  it("3. Quando consolidação retorna ID canônico diferente, atualiza op.animeId e op.payload.animeId na Outbox e conclui flush", async () => {
    await withIsolatedWindow(async () => {
      const localAnimeId = "local-anime-fool-night-dub";
      const definitiveAnimeId = "server-anime-fool-night-dub-def";

      useHikariStore.setState({
        hydrated: true,
        animes: [makeDubbedLocalAnime({ id: localAnimeId })],
      });

      writeOutbox([
        {
          id: "outbox-remap-1",
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
            videoUrl: "https://cdn.example.com/ep1.mp4",
            published: true,
            replaceSources: true,
            animeTitle: "Fool Night Dublado",
          },
          createdAt: Date.now(),
          attempts: 0,
          status: "pending",
        },
      ]);

      const originalFetch = globalThis.fetch;
      let animePosts = 0;

      globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/api/admin/catalog-anime")) {
          animePosts++;
          return new Response(
            JSON.stringify({ ok: true, animeId: definitiveAnimeId }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        if (url.includes("/api/admin/catalog-episode")) {
          const body = JSON.parse(String(init?.body || "{}"));
          assert.equal(body.animeId, definitiveAnimeId);
          assert.equal(body.audio, "dub");
          assert.equal(body.replaceSources, true);
          return new Response(
            JSON.stringify({ ok: true, episodeId: "server-ep-1", canonicalId: "server-ep-1" }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response("Not found", { status: 404 });
      }) as typeof fetch;

      try {
        const defId = await consolidateAnimeParent(localAnimeId);
        assert.equal(defId, definitiveAnimeId);
        assert.equal(animePosts, 1);

        const ops = readOutbox();
        assert.equal(ops[0]?.animeId, definitiveAnimeId);
        assert.equal(ops[0]?.payload?.animeId, definitiveAnimeId);

        const flushResult = await flushOutbox();
        assert.equal(flushResult.processed, 1);
        assert.equal(flushResult.remaining, 0);
        assert.equal(animePosts, 1, "Não deve re-consolidar após remapeamento");
        assert.equal(readOutbox().length, 0);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  it("4. Proteção single-flight impede consolidações simultâneas duplicadas do mesmo anime", async () => {
    await withIsolatedWindow(async () => {
      const dubId = "local-single-flight-1";
      useHikariStore.setState({
        hydrated: false, // também valida espera segura com store já populado em memória
        animes: [makeDubbedLocalAnime({ id: dubId })],
      });

      const originalFetch = globalThis.fetch;
      let animePostCount = 0;
      let episodePostCount = 0;

      globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/api/admin/catalog-anime")) {
          animePostCount++;
          await new Promise((r) => setTimeout(r, 15));
          return new Response(JSON.stringify({ ok: true, animeId: dubId }), {
            status: 200,
          });
        }
        if (url.includes("/api/admin/catalog-episode")) {
          episodePostCount++;
          const body = JSON.parse(String(init?.body || "{}"));
          return new Response(
            JSON.stringify({ ok: true, episodeId: body.id, canonicalId: body.id }),
            { status: 200 },
          );
        }
        return new Response("Not found", { status: 404 });
      }) as typeof fetch;

      try {
        const results = await Promise.all([1, 2, 3, 4].map((num) =>
          persistEpisode(dubId, 1, {
            id: `ep-sf-${num}`,
            number: num,
            title: `Episódio ${num}`,
            audio: "dub",
            videoUrl: `https://cdn.example.com/sf-${num}.mp4`,
            published: true,
          }),
        ));

        assert.equal(animePostCount, 1, "Single-flight deve garantir apenas 1 POST para /catalog-anime");
        assert.equal(episodePostCount, 4);
        assert.ok(results.every((r) => r.confirmed && r.status === "synced"));
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  it("5. Payload de consolidação rejeita URLs 'blob:'/'data:' > 2048 e sanitiza campos numéricos para o schema do backend", async () => {
    const hugeDataUrl = `data:image/png;base64,${"A".repeat(3000)}`;
    const dirtyAnime = makeDubbedLocalAnime({
      id: "local-sanitize-payload",
      cover: "blob:https://hikari.local/1234-5678",
      banner: hugeDataUrl,
      score: 8.6,
      year: 2025.9 as unknown as number,
      episodesCount: 12.2 as unknown as number,
      seasons: [
        { id: "s-0", number: 0, title: "Inválida", episodes: [] },
        { id: "s-1", number: 1, title: "Temporada 1", episodes: [] },
      ],
    });

    const payload = buildConsolidatedAnimePayload(dirtyAnime);
    assert.equal(payload.cover, undefined);
    assert.equal(payload.banner, undefined);
    assert.equal(payload.coverExplicitlyEdited, false);
    assert.equal(payload.bannerExplicitlyEdited, false);
    assert.equal(payload.score, 9);
    assert.equal(payload.year, 2025);
    assert.equal(payload.episodesCount, 12);
    assert.equal(payload.seasons.length, 1);
    assert.equal(payload.seasons[0]?.number, 1);

    const parsed = animeAdminPostSchema.safeParse(payload);
    assert.equal(parsed.success, true, "Payload consolidado deve passar estritamente no animeAdminPostSchema");
  });

  it("6. Classificação correta de erros (401/403, 400/422, 409, 429) sem mascarar como 'aguardando conexão'", async () => {
    await withIsolatedWindow(async () => {
      const dubId = "local-errors-test";
      useHikariStore.setState({
        hydrated: true,
        animes: [makeDubbedLocalAnime({ id: dubId, serverCatalogId: dubId, syncedAt: Date.now() })],
      });

      const baseEp = {
        id: "ep-err-1",
        number: 1,
        title: "Ep 1",
        audio: "dub" as const,
        videoUrl: "https://cdn.example.com/1.mp4",
        published: true,
      };

      const originalFetch = globalThis.fetch;

      try {
        // 401
        globalThis.fetch = (async () =>
          new Response(JSON.stringify({ error: "Sessão expirada no servidor." }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          })) as typeof fetch;

        const r401 = await persistEpisode(dubId, 1, baseEp);
        assert.equal(r401.errorCategory, "auth");
        assert.equal(r401.errorStatus, 401);
        assert.match(r401.error || "", /Sessão expirada/i);
        assert.doesNotMatch(r401.error || "", /aguardando conexão/i);

        // 422
        globalThis.fetch = (async () =>
          new Response(JSON.stringify({ error: "Campo audio inválido na API." }), {
            status: 422,
            headers: { "Content-Type": "application/json" },
          })) as typeof fetch;

        const r422 = await persistEpisode(dubId, 1, baseEp);
        assert.equal(r422.status, "conflict");
        assert.equal(r422.errorCategory, "validation");
        assert.equal(r422.errorStatus, 422);
        assert.equal(r422.error, "Campo audio inválido na API.");
        assert.equal(readOutbox()[0]?.status, "conflict");

        // 409
        globalThis.fetch = (async () =>
          new Response(JSON.stringify({ error: "Conflito de slot já ocupado." }), {
            status: 409,
            headers: { "Content-Type": "application/json" },
          })) as typeof fetch;

        const r409 = await persistEpisode(dubId, 1, baseEp);
        assert.equal(r409.status, "conflict");
        assert.equal(r409.errorCategory, "conflict");
        assert.equal(r409.error, "Conflito de slot já ocupado.");
        assert.equal(readOutbox().length, 1, "Conflito 409 nunca pode apagar o item do Outbox");

        // 429
        globalThis.fetch = (async () =>
          new Response(JSON.stringify({ error: "Muitas requisições, tente novamente em 30s." }), {
            status: 429,
            headers: { "Content-Type": "application/json" },
          })) as typeof fetch;

        const r429 = await persistEpisode(dubId, 1, baseEp);
        assert.equal(r429.status, "pending");
        assert.equal(r429.errorCategory, "rate_limit");
        assert.equal(r429.errorStatus, 429);
        assert.match(r429.error || "", /Muitas requisições/i);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  it("7. Falha na consolidação do anime pai NÃO envia seus episódios e preserva fila sem afetar outros animes", async () => {
    await withIsolatedWindow(async () => {
      const localAnimeFail = "local-anime-fail";
      const otherAnimeId = "other-anime-server";

      useHikariStore.setState({
        hydrated: true,
        animes: [makeDubbedLocalAnime({ id: localAnimeFail })],
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
            videoUrl: "https://cdn.example.com/other.mp4",
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
          animeId: localAnimeFail,
          seasonNumber: 1,
          episodeNumber: 1,
          payload: {
            id: "fail-ep-1",
            animeId: localAnimeFail,
            seasonNumber: 1,
            number: 1,
            title: "Fail Ep",
            audio: "dub",
            videoUrl: "https://cdn.example.com/fail.mp4",
            published: true,
          },
          createdAt: Date.now(),
          attempts: 0,
          status: "pending",
        },
      ]);

      const originalFetch = globalThis.fetch;
      let sentEpisodeForFailedParent = false;
      let sentEpisodeForOther = false;

      globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/api/admin/catalog-anime")) {
          return new Response(JSON.stringify({ error: "Erro interno Neon" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (url.includes("/api/admin/catalog-episode")) {
          const body = JSON.parse(String(init?.body || "{}"));
          if (body.animeId === localAnimeFail) {
            sentEpisodeForFailedParent = true;
            return new Response("Should not be called", { status: 500 });
          }
          if (body.animeId === otherAnimeId) {
            sentEpisodeForOther = true;
            return new Response(
              JSON.stringify({ ok: true, episodeId: "other-ep-1" }),
              { status: 200 },
            );
          }
        }
        return new Response("Error", { status: 500 });
      }) as typeof fetch;

      try {
        const flushResult = await flushOutbox();
        const remaining = readOutbox();

        assert.equal(
          sentEpisodeForFailedParent,
          false,
          "Episódios do anime cuja consolidação falhou NÃO devem ser enviados",
        );
        assert.equal(sentEpisodeForOther, true, "Outros animes devem sincronizar normalmente");
        assert.equal(flushResult.processed, 1);
        assert.equal(flushResult.remaining, 1);

        const failOp = remaining.find((o) => o.episodeId === "fail-ep-1");
        assert.ok(failOp, "Operação do anime com falha deve ser preservada no Outbox");
        assert.equal(failOp.animeId, localAnimeFail);
        assert.match(failOp.lastError || "", /Erro interno Neon/i);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  it("8. Falha ao salvar episódio preserva todos os campos críticos no Outbox (replaceSources, replaceThumbnail, animeTitle, audio, fontes)", async () => {
    await withIsolatedWindow(async () => {
      const dubId = "local-preserve-fields";
      useHikariStore.setState({
        hydrated: true,
        animes: [makeDubbedLocalAnime({ id: dubId })],
      });

      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async () => {
        throw new TypeError("Failed to fetch");
      }) as typeof fetch;

      try {
        const res = await persistEpisode(
          dubId,
          2,
          {
            id: "ep-preserve-1",
            number: 5,
            title: "Episódio 5 Dublado",
            thumbnail: "https://cdn.example.com/thumb-5.jpg",
            duration: "24:00",
            synopsis: "Sinopse ep 5",
            audio: "dub",
            videoUrl: "https://cdn.example.com/p1.mp4",
            videoUrl2: "https://cdn.example.com/p2.mp4",
            openingStartSeconds: 90,
            openingEndSeconds: 180,
            recentBadges: { lancamento: false, novo: true, final: false },
            published: true,
          },
          "Fool Night Dublado",
          { replaceThumbnail: true },
        );

        assert.equal(res.queued, true);
        assert.equal(res.status, "pending");

        const [op] = readOutbox();
        assert.ok(op?.payload);
        assert.equal(op.animeId, dubId);
        assert.equal(op.payload.animeId, dubId);
        assert.equal(op.payload.replaceSources, true);
        assert.equal(op.payload.replaceThumbnail, true);
        assert.equal(op.payload.animeTitle, "Fool Night Dublado");
        assert.equal(op.payload.thumbnail, "https://cdn.example.com/thumb-5.jpg");
        assert.equal(op.payload.videoUrl, "https://cdn.example.com/p1.mp4");
        assert.equal(op.payload.videoUrl2, "https://cdn.example.com/p2.mp4");
        assert.equal(op.payload.number, 5);
        assert.equal(op.payload.seasonNumber, 2);
        assert.equal(op.payload.audio, "dub");
        assert.equal(op.payload.published, true);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  it("9. Limpeza de Outbox remove pendências tanto pelo ID original quanto pelo ID canônico após 2xx", async () => {
    await withIsolatedWindow(async () => {
      const localAnimeId = "local-cleanup-orig";
      const canonicalAnimeId = "server-cleanup-canon";

      useHikariStore.setState({
        hydrated: true,
        animes: [makeDubbedLocalAnime({ id: localAnimeId })],
      });

      writeOutbox([
        {
          id: "outbox-orig-ep",
          type: "upsert",
          episodeId: "e-local-1",
          animeId: localAnimeId,
          seasonNumber: 1,
          episodeNumber: 1,
          payload: {
            id: "e-local-1",
            animeId: localAnimeId,
            seasonNumber: 1,
            number: 1,
            title: "Ep 1",
            audio: "dub",
            videoUrl: "https://cdn.example.com/1.mp4",
            published: true,
          },
          createdAt: Date.now() - 1000,
          attempts: 0,
          status: "pending",
        },
        {
          id: "outbox-keep-other",
          type: "upsert",
          episodeId: "e-other-2",
          animeId: "another-anime",
          seasonNumber: 1,
          episodeNumber: 2,
          payload: {
            id: "e-other-2",
            animeId: "another-anime",
            seasonNumber: 1,
            number: 2,
            title: "Ep 2",
            audio: "sub",
            videoUrl: "https://cdn.example.com/2.mp4",
            published: true,
          },
          createdAt: Date.now(),
          attempts: 0,
          status: "pending",
        },
      ]);

      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async (input: unknown) => {
        const url = String(input);
        if (url.includes("/api/admin/catalog-anime")) {
          return new Response(
            JSON.stringify({ ok: true, animeId: canonicalAnimeId }),
            { status: 200 },
          );
        }
        if (url.includes("/api/admin/catalog-episode")) {
          return new Response(
            JSON.stringify({ ok: true, episodeId: "server-ep-canon-1", canonicalId: "server-ep-canon-1" }),
            { status: 200 },
          );
        }
        return new Response("Not found", { status: 404 });
      }) as typeof fetch;

      try {
        const res = await persistEpisode(localAnimeId, 1, {
          id: "e-local-1",
          number: 1,
          title: "Ep 1 Atualizado",
          audio: "dub",
          videoUrl: "https://cdn.example.com/1.mp4",
          published: true,
        });

        assert.equal(res.confirmed, true);
        assert.equal(res.canonicalId, "server-ep-canon-1");

        const ops = readOutbox();
        assert.equal(ops.length, 1);
        assert.equal(ops[0]?.id, "outbox-keep-other");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe("10. Isolamento estrito Legendado vs Dublado no servidor (PGLite)", () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const subAnimeId = `anilist-213457-test-${suffix}`;
    const dubAnimeId = `local-dub-${suffix}`;
    const subEpId = `ep-sub-${suffix}`;
    const dubEpId = `ep-dub-${suffix}`;
    const adminUserId = `admin-dub-iso-${suffix}`;
    const adminSessionToken = `sess-dub-iso-${suffix}`;

    after(async () => {
      if (dbSource !== "pglite") return;
      const sql = await getSql();
      await sql.query(`DELETE FROM "episode_sources" WHERE "episode_id" = ANY($1::text[]);`, [
        [subEpId, dubEpId],
      ]);
      await sql.query(`DELETE FROM "catalog_episode" WHERE "animeId" = ANY($1::text[]);`, [
        [subAnimeId, dubAnimeId],
      ]);
      await sql.query(`DELETE FROM "catalog_season" WHERE "animeId" = ANY($1::text[]);`, [
        [subAnimeId, dubAnimeId],
      ]);
      await sql.query(`DELETE FROM "catalog_anime" WHERE "id" = ANY($1::text[]);`, [
        [subAnimeId, dubAnimeId],
      ]);
      await sql.query(`DELETE FROM "session" WHERE "token" = $1;`, [adminSessionToken]);
      await sql.query(`DELETE FROM "user" WHERE "id" = $1;`, [adminUserId]);
      await invalidateCatalogEpisodesCacheAsync(subAnimeId, dubAnimeId);
    });

    it("mantém Fool Night Legendado e Dublado separados mesmo com título parecido ou anilistId compartilhado", async (t) => {
      if (dbSource !== "pglite") {
        t.skip("Teste de isolamento SQL executa apenas contra PGLite isolado");
        return;
      }

      const sql = await getSql();
      const prevAdminIds = process.env.ADMIN_USER_IDS;
      process.env.ADMIN_USER_IDS = prevAdminIds
        ? `${prevAdminIds},${adminUserId}`
        : adminUserId;

      try {
        await sql.query(
          `INSERT INTO "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
           VALUES ($1, 'Admin Iso', $2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           ON CONFLICT ("id") DO NOTHING;`,
          [adminUserId, `${adminUserId}@hikaritv.test`],
        );
        await sql.query(
          `INSERT INTO "session" ("id", "expiresAt", "token", "createdAt", "updatedAt", "userId")
           VALUES ($1, CURRENT_TIMESTAMP + INTERVAL '1 day', $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $3);`,
          [`sess-${suffix}`, adminSessionToken, adminUserId],
        );

        // 1. Cria cadastro Legendado e episódio Legendado
        const subUpsert = await executeAdminUpsertCatalogAnime({
          id: subAnimeId,
          titleRomaji: `Fool Night ${suffix}`,
          titleEnglish: `Fool Night ${suffix}`,
          anilistId: 91345700 + Math.floor(Math.random() * 10000),
          format: "TV",
          year: 2025,
          hidden: false,
          seasons: [{ number: 1, title: "Temporada 1" }],
        });
        assert.equal(subUpsert.animeId, subAnimeId);

        const reqSubEp = new Request("https://hikaritv.cc.cd/api/admin/catalog-episode", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminSessionToken}`,
          },
          body: JSON.stringify({
            id: subEpId,
            animeId: subAnimeId,
            seasonNumber: 1,
            number: 1,
            title: "Ep 1 Legendado",
            audio: "sub",
            videoUrl: "https://cdn.example.com/sub-1.mp4",
            published: true,
            replaceSources: true,
            animeTitle: `Fool Night ${suffix}`,
          }),
        });
        const resSubEp = await handlePostCatalogEpisode(
          { request: reqSubEp },
          { assertSameSite: () => {} },
        );
        assert.equal(resSubEp.status, 200);

        // 2. Consolida cadastro Dublado independente (mantém ID local-... e não redireciona para subAnimeId)
        const dubUpsert = await executeAdminUpsertCatalogAnime({
          id: dubAnimeId,
          titleRomaji: `Fool Night ${suffix} Dublado`,
          titleEnglish: `Fool Night ${suffix} Dubbed`,
          duplicateOfId: subAnimeId,
          format: "TV",
          year: 2025,
          hidden: false,
          seasons: [{ number: 1, title: "Temporada 1" }],
        });
        assert.equal(dubUpsert.animeId, dubAnimeId);
        assert.notEqual(dubUpsert.animeId, subAnimeId);

        // 3. Salva episódio Dublado com animeTitle sem marcador "Dublado" e confirma isolamento para dubAnimeId
        const reqDubEp = new Request("https://hikaritv.cc.cd/api/admin/catalog-episode", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminSessionToken}`,
          },
          body: JSON.stringify({
            id: dubEpId,
            animeId: dubAnimeId,
            seasonNumber: 1,
            number: 1,
            title: "Ep 1 Dublado",
            audio: "dub",
            videoUrl: "https://cdn.example.com/dub-1.mp4",
            published: true,
            replaceSources: true,
            animeTitle: `Fool Night ${suffix}`,
          }),
        });
        const resDubEp = await handlePostCatalogEpisode(
          { request: reqDubEp },
          { assertSameSite: () => {} },
        );
        assert.equal(resDubEp.status, 200);

        // 4. Verifica no banco que Sub e Dub continuam 100% separados
        const subRows = await sql.query<{ id: string; audio: string | null }>(
          `SELECT "id", "audio" FROM "catalog_episode" WHERE "animeId" = $1;`,
          [subAnimeId],
        );
        const dubRows = await sql.query<{ id: string; audio: string | null }>(
          `SELECT "id", "audio" FROM "catalog_episode" WHERE "animeId" = $1;`,
          [dubAnimeId],
        );

        assert.equal(subRows.length, 1);
        assert.equal(subRows[0]?.id, subEpId);
        assert.equal(subRows[0]?.audio, "sub");

        assert.equal(dubRows.length, 1);
        assert.equal(dubRows[0]?.id, dubEpId);
        assert.equal(dubRows[0]?.audio, "dub");

        // 5. Tentar reaproveitar o mesmo episodeId do Legendado no Dublado deve retornar 409 (não 500)
        const reqCollide = new Request("https://hikaritv.cc.cd/api/admin/catalog-episode", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminSessionToken}`,
          },
          body: JSON.stringify({
            id: subEpId,
            animeId: dubAnimeId,
            seasonNumber: 1,
            number: 1,
            title: "Colisão",
            audio: "dub",
            videoUrl: "https://cdn.example.com/dub-collide.mp4",
            published: true,
            replaceSources: true,
          }),
        });
        const resCollide = await handlePostCatalogEpisode(
          { request: reqCollide },
          { assertSameSite: () => {} },
        );
        assert.equal(resCollide.status, 409);
      } finally {
        if (prevAdminIds === undefined) {
          delete process.env.ADMIN_USER_IDS;
        } else {
          process.env.ADMIN_USER_IDS = prevAdminIds;
        }
      }
    });
  });
});

function makeTwelveSubbedOutboxFixtures(dubAnimeId: string): OutboxOperation[] {
  const now = Date.now();
  return Array.from({ length: 12 }, (_, idx) => {
    const epNum = idx + 1;
    const kitsuEpId = `kitsu-ep-50792-${epNum}`;
    return {
      id: `outbox-fn-dub-${epNum}`,
      type: "upsert" as const,
      episodeId: kitsuEpId,
      animeId: dubAnimeId,
      seasonNumber: 1,
      episodeNumber: epNum,
      payload: {
        id: kitsuEpId,
        animeId: dubAnimeId,
        seasonNumber: 1,
        number: epNum,
        title: `Fool Night Dublado - Episódio ${epNum}`,
        thumbnail: `https://media.kitsu.app/episodes/thumbnails/${epNum}.jpg`,
        duration: "24:00",
        synopsis: `Sinopse Ep ${epNum}`,
        videoUrl: `https://cdn.example.com/fool-night-dub-ep${epNum}-p1.mp4`,
        videoUrl2: `https://cdn.example.com/fool-night-dub-ep${epNum}-p2.mp4`,
        audio: "dub" as const,
        openingStartSeconds: 85,
        openingEndSeconds: 175,
        recentBadges: { lancamento: epNum === 12, novo: true, final: epNum === 12 },
        published: true,
        replaceSources: true,
        replaceThumbnail: true,
        animeTitle: "Fool Night Dublado",
      },
      createdAt: now - (12 - epNum) * 1000,
      attempts: 1,
      status: "conflict" as const,
      lastError: `Conflito de integridade: o identificador "${kitsuEpId}" já está associado a outro episódio (anilist-213457 - Temporada 1, Ep. ${epNum}) e não pode ser reaproveitado em outro anime ou slot.`,
    };
  });
}

describe("Hikari — Correção de Colisão de IDs dos Episódios Dublados (10 Cenários Obrigatórios)", () => {
  const dubAnimeId = "local-a96d58dd-39a3-438d-af0f-4ee50b78ca1e";
  const subAnimeId = "anilist-213457";

  it("1. Duplicação para Dublado e merge remoto nunca copiam 'kitsu-ep-50792-1' para o ID interno", () => {
    const kitsuSourceSeasons = [
      {
        id: "s-sub-1",
        number: 1,
        title: "Temporada 1",
        episodes: Array.from({ length: 12 }, (_, idx) => ({
          id: `kitsu-ep-50792-${idx + 1}`,
          number: idx + 1,
          title: `Episódio ${idx + 1}`,
          thumbnail: `https://media.kitsu.app/ep/${idx + 1}.jpg`,
          audio: "sub" as const,
          videoUrl: `https://cdn.example.com/sub-${idx + 1}.mp4`,
          hikariPlayerEpisodeId: `hp-sub-${idx + 1}`,
          published: true,
        })),
      },
    ];

    const cloned = cloneSeasonsForDubbedAnime(kitsuSourceSeasons, {
      targetAnimeId: dubAnimeId,
      sourceAnimeAnilistId: 213457,
    });
    assert.equal(cloned.length, 1);
    assert.equal(cloned[0]?.episodes.length, 12);
    for (let i = 0; i < 12; i++) {
      const ep = cloned[0]!.episodes[i]!;
      assert.notEqual(ep.id, `kitsu-ep-50792-${i + 1}`);
      assert.equal(isExternalEpisodeId(ep.id), false);
      assert.ok(ep.id.startsWith("e-"));
      assert.equal(ep.externalEpisodeId, `kitsu-ep-50792-${i + 1}`);
      assert.equal(ep.audio, "dub");
      assert.equal(ep.videoUrl, "");
      assert.equal(ep.hikariPlayerEpisodeId, undefined);
      assert.equal(ep.published, false);
    }

    // Simula duplicação criada com 0 episódios e posterior abertura no Admin onde `remote` vem do AniList/Kitsu (Legendado)
    const dubStub = makeDubbedLocalAnime({
      id: dubAnimeId,
      serverCatalogId: dubAnimeId,
      duplicateOfId: subAnimeId,
      anilistId: 213457,
      kitsuId: 50792,
      seasons: [{ id: "s-dub-1", number: 1, title: "Temporada 1", episodes: [] }],
    });
    const remoteSubAnime: Anime = {
      id: subAnimeId,
      serverCatalogId: subAnimeId,
      anilistId: 213457,
      kitsuId: 50792,
      titles: { romaji: "Fool Night", english: "Fool Night", native: "フールナイト" },
      cover: "https://cdn.example.com/sub-cover.jpg",
      banner: "https://cdn.example.com/sub-banner.jpg",
      synopsis: "Sub",
      score: 85,
      genres: ["Drama"],
      format: "TV",
      status: "FINISHED",
      episodesCount: 12,
      season: "FALL",
      year: 2025,
      trailerId: null,
      studios: [],
      recommendations: [],
      streamingEpisodes: [],
      seasons: kitsuSourceSeasons,
      source: "local",
    };

    const resolved = resolveAdminAnimeWithRemote(dubStub, remoteSubAnime);
    assert.ok(resolved);
    assert.equal(resolved.serverCatalogId, dubAnimeId);
    assert.equal(resolved.titleRomaji, "Fool Night Dublado");
    const mergedEps = resolved.seasons[0]?.episodes ?? [];
    assert.equal(mergedEps.length, 12);
    for (let i = 0; i < 12; i++) {
      assert.notEqual(mergedEps[i]?.id, `kitsu-ep-50792-${i + 1}`);
      assert.equal(isExternalEpisodeId(mergedEps[i]?.id), false);
      assert.equal(mergedEps[i]?.externalEpisodeId, `kitsu-ep-50792-${i + 1}`);
      assert.equal(mergedEps[i]?.audio, "dub");
      assert.equal(mergedEps[i]?.videoUrl, undefined);
      assert.equal(mergedEps[i]?.hikariPlayerEpisodeId, undefined);
      assert.equal(mergedEps[i]?.published, false);
    }

    const directMerge = mergeSeasonsWithRemoteForAdmin(
      [],
      kitsuSourceSeasons,
      { isDubbedDuplicate: true, isCrossAnimeRemote: true },
    );
    assert.equal(directMerge[0]?.episodes.length, 12);
    assert.notEqual(directMerge[0]?.episodes[0]?.id, "kitsu-ep-50792-1");
    assert.equal(directMerge[0]?.episodes[0]?.externalEpisodeId, "kitsu-ep-50792-1");
  });

  it("2 e 3. Todos os 12 episódios Dublados recebem IDs únicos sem colisão entre si nem com o Legendado", async () => {
    await withIsolatedWindow(async () => {
      const subAnime = makeDubbedLocalAnime({
        id: subAnimeId,
        titleRomaji: "Fool Night",
        titleEnglish: "Fool Night",
        duplicateOfId: null,
        seasons: [
          {
            id: "s-sub-1",
            number: 1,
            title: "Temporada 1",
            episodes: Array.from({ length: 12 }, (_, idx) => ({
              id: `kitsu-ep-50792-${idx + 1}`,
              number: idx + 1,
              title: `Ep ${idx + 1}`,
              audio: "sub" as const,
              published: true,
            })),
          },
        ],
      });
      const dubAnime = makeDubbedLocalAnime({
        id: dubAnimeId,
        serverCatalogId: dubAnimeId,
        duplicateOfId: subAnimeId,
        seasons: [
          {
            id: "s-dub-1",
            number: 1,
            title: "Temporada 1",
            episodes: Array.from({ length: 12 }, (_, idx) => ({
              id: `kitsu-ep-50792-${idx + 1}`,
              number: idx + 1,
              title: `Ep ${idx + 1} Dub`,
              audio: "dub" as const,
              videoUrl: `https://cdn.example.com/dub-${idx + 1}.mp4`,
              published: true,
            })),
          },
        ],
      });

      useHikariStore.setState({ animes: [subAnime, dubAnime], hydrated: true });
      writeOutbox(makeTwelveSubbedOutboxFixtures(dubAnimeId));

      const repair = repairDubbedOutboxEpisodeIds();
      assert.equal(repair.repairedCount, 12);

      const ops = readOutbox();
      assert.equal(ops.length, 12);
      const dubIds = new Set(ops.map((o) => o.episodeId));
      assert.equal(dubIds.size, 12, "Todos os 12 IDs dublados devem ser únicos");

      const subIds = new Set(
        subAnime.seasons[0]!.episodes.map((e) => e.id),
      );
      for (const id of dubIds) {
        assert.equal(subIds.has(id), false, "Nenhum ID dublado pode colidir com o Legendado");
        assert.equal(isExternalEpisodeId(id), false);
        assert.notEqual(id, dubAnimeId);
        assert.notEqual(id, "213457");
      }
    });
  });

  it("4. 'kitsu-ep-50792-1' permanece exclusivo do Legendado e é preservado no campo externalEpisodeId do Dublado", async () => {
    await withIsolatedWindow(async () => {
      const subAnime = makeDubbedLocalAnime({
        id: subAnimeId,
        titleRomaji: "Fool Night",
        titleEnglish: "Fool Night",
        duplicateOfId: null,
        seasons: [
          {
            id: "s-sub-1",
            number: 1,
            title: "Temporada 1",
            episodes: [
              {
                id: "kitsu-ep-50792-1",
                number: 1,
                title: "Ep 1 Legendado",
                audio: "sub" as const,
                published: true,
              },
            ],
          },
        ],
      });
      const dubAnime = makeDubbedLocalAnime({
        id: dubAnimeId,
        serverCatalogId: dubAnimeId,
        duplicateOfId: subAnimeId,
      });

      useHikariStore.setState({ animes: [subAnime, dubAnime], hydrated: true });
      writeOutbox(makeTwelveSubbedOutboxFixtures(dubAnimeId));

      repairDubbedOutboxEpisodeIds();

      const updatedSub = useHikariStore.getState().animes.find((a) => a.id === subAnimeId);
      assert.equal(updatedSub?.seasons[0]?.episodes[0]?.id, "kitsu-ep-50792-1");

      const [firstDubOp] = readOutbox();
      assert.notEqual(firstDubOp?.episodeId, "kitsu-ep-50792-1");
      assert.equal(firstDubOp?.payload?.externalEpisodeId, "kitsu-ep-50792-1");
    });
  });

  it("5 e 6. Reparo atualiza op.episodeId + op.payload.id dos 12 registros preservando todos os links, thumbnails, áudio, número e flags", async () => {
    await withIsolatedWindow(async () => {
      const fixtures = makeTwelveSubbedOutboxFixtures(dubAnimeId);
      writeOutbox(fixtures);

      const res = repairDubbedOutboxEpisodeIds();
      assert.equal(res.repairedCount, 12);

      const repaired = readOutbox();
      assert.equal(repaired.length, 12);

      for (let i = 0; i < 12; i++) {
        const before = fixtures[i]!;
        const afterOp = repaired[i]!;
        assert.notEqual(afterOp.episodeId, before.episodeId);
        assert.equal(afterOp.episodeId, afterOp.payload?.id);
        assert.equal(afterOp.status, "pending", "Conflito de ID deve voltar a pending após reparo");
        assert.equal(afterOp.lastError, undefined);

        // Todos os dados críticos intactos:
        assert.equal(afterOp.animeId, dubAnimeId);
        assert.equal(afterOp.seasonNumber, 1);
        assert.equal(afterOp.episodeNumber, i + 1);
        assert.equal(afterOp.payload?.animeId, dubAnimeId);
        assert.equal(afterOp.payload?.number, i + 1);
        assert.equal(afterOp.payload?.seasonNumber, 1);
        assert.equal(afterOp.payload?.title, before.payload?.title);
        assert.equal(afterOp.payload?.thumbnail, before.payload?.thumbnail);
        assert.equal(afterOp.payload?.videoUrl, before.payload?.videoUrl);
        assert.equal(afterOp.payload?.videoUrl2, before.payload?.videoUrl2);
        assert.equal(afterOp.payload?.audio, "dub");
        assert.equal(afterOp.payload?.openingStartSeconds, 85);
        assert.equal(afterOp.payload?.openingEndSeconds, 175);
        assert.equal(afterOp.payload?.published, true);
        assert.equal(afterOp.payload?.replaceSources, true);
        assert.equal(afterOp.payload?.replaceThumbnail, true);
        assert.equal(afterOp.payload?.animeTitle, "Fool Night Dublado");
      }
    });
  });

  it("7. Execuções repetidas do reparo são 100% idempotentes", async () => {
    await withIsolatedWindow(async () => {
      writeOutbox(makeTwelveSubbedOutboxFixtures(dubAnimeId));

      const first = repairDubbedOutboxEpisodeIds();
      assert.equal(first.repairedCount, 12);
      const snapshotAfterFirst = readOutbox().map((o) => ({
        outboxId: o.id,
        episodeId: o.episodeId,
        payloadId: o.payload?.id,
      }));

      const second = repairDubbedOutboxEpisodeIds();
      assert.equal(second.repairedCount, 0);
      assert.equal(second.repairedOps.length, 0);

      const third = repairDubbedOutboxEpisodeIds();
      assert.equal(third.repairedCount, 0);

      const snapshotAfterThird = readOutbox().map((o) => ({
        outboxId: o.id,
        episodeId: o.episodeId,
        payloadId: o.payload?.id,
      }));
      assert.deepEqual(snapshotAfterThird, snapshotAfterFirst);
    });
  });

  it("8. Falhas ou retries após reparo/salvamento reutilizam exatamente o mesmo ID sem regenerar ou duplicar operações", async () => {
    await withIsolatedWindow(async () => {
      useHikariStore.setState({
        hydrated: true,
        animes: [
          makeDubbedLocalAnime({
            id: dubAnimeId,
            serverCatalogId: dubAnimeId,
            syncedAt: Date.now(),
            duplicateOfId: subAnimeId,
            seasons: [
              {
                id: "s-dub-1",
                number: 1,
                title: "Temporada 1",
                episodes: [
                  {
                    id: "kitsu-ep-50792-1",
                    number: 1,
                    title: "Episódio 1 Dub",
                    audio: "dub",
                    videoUrl: "https://cdn.example.com/dub-1.mp4",
                    published: true,
                  },
                ],
              },
            ],
          }),
        ],
      });

      const originalFetch = globalThis.fetch;
      const sentEpisodeIds: string[] = [];
      let failMode = true;

      globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/api/admin/catalog-episode")) {
          const body = JSON.parse(String(init?.body || "{}"));
          sentEpisodeIds.push(body.id);
          if (failMode) {
            return new Response(JSON.stringify({ error: "Erro temporário 500" }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }
          return new Response(
            JSON.stringify({ ok: true, episodeId: body.id, canonicalId: body.id }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response("Not found", { status: 404 });
      }) as typeof fetch;

      try {
        // 1ª tentativa com erro 500 passando objeto com ID antigo stale
        const firstAttempt = await persistEpisode(dubAnimeId, 1, {
          id: "kitsu-ep-50792-1",
          number: 1,
          title: "Episódio 1 Dub",
          audio: "dub",
          videoUrl: "https://cdn.example.com/dub-1.mp4",
          published: true,
        });
        assert.equal(firstAttempt.confirmed, false);
        assert.equal(firstAttempt.queued, true);
        assert.equal(readOutbox().length, 1);

        const repairedId = readOutbox()[0]!.episodeId;
        assert.notEqual(repairedId, "kitsu-ep-50792-1");
        assert.equal(firstAttempt.canonicalId, repairedId);

        // 2ª tentativa (simula caller ainda segurando stale ID ou flushOutbox após retry)
        const secondAttempt = await persistEpisode(dubAnimeId, 1, {
          id: "kitsu-ep-50792-1",
          number: 1,
          title: "Episódio 1 Dub",
          audio: "dub",
          videoUrl: "https://cdn.example.com/dub-1.mp4",
          published: true,
        });
        assert.equal(secondAttempt.confirmed, false);
        assert.equal(readOutbox().length, 1, "Não pode duplicar operação na Outbox");
        assert.equal(readOutbox()[0]!.episodeId, repairedId);

        // 3ª tentativa com sucesso via flushOutbox
        failMode = false;
        const flushRes = await flushOutbox();
        assert.equal(flushRes.processed, 1);
        assert.equal(flushRes.remaining, 0);
        assert.deepEqual(sentEpisodeIds, [repairedId, repairedId, repairedId]);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  it("9. Outros animes (Legendado 'anilist-213457' e outros cadastros) na Outbox não são alterados pelo reparo", async () => {
    await withIsolatedWindow(async () => {
      const subOutboxOp: OutboxOperation = {
        id: "outbox-sub-keep",
        type: "upsert",
        episodeId: "kitsu-ep-50792-1",
        animeId: subAnimeId,
        seasonNumber: 1,
        episodeNumber: 1,
        payload: {
          id: "kitsu-ep-50792-1",
          animeId: subAnimeId,
          seasonNumber: 1,
          number: 1,
          title: "Fool Night Ep 1",
          audio: "sub",
          videoUrl: "https://cdn.example.com/sub-1.mp4",
          published: true,
        },
        createdAt: Date.now() - 5000,
        attempts: 0,
        status: "pending",
      };
      const otherAnimeOp: OutboxOperation = {
        id: "outbox-unrelated-keep",
        type: "upsert",
        episodeId: "kitsu-ep-99999-3",
        animeId: "anilist-99999",
        seasonNumber: 1,
        episodeNumber: 3,
        payload: {
          id: "kitsu-ep-99999-3",
          animeId: "anilist-99999",
          seasonNumber: 1,
          number: 3,
          title: "Outro Anime",
          audio: "sub",
          videoUrl: "https://cdn.example.com/other-3.mp4",
          published: true,
        },
        createdAt: Date.now() - 4000,
        attempts: 0,
        status: "pending",
      };

      writeOutbox([
        subOutboxOp,
        ...makeTwelveSubbedOutboxFixtures(dubAnimeId),
        otherAnimeOp,
      ]);

      const res = repairDubbedOutboxEpisodeIds();
      assert.equal(res.repairedCount, 12);

      const afterOps = readOutbox();
      assert.equal(afterOps.length, 14);

      const keptSub = afterOps.find((o) => o.id === "outbox-sub-keep");
      assert.equal(keptSub?.episodeId, "kitsu-ep-50792-1");
      assert.equal(keptSub?.payload?.id, "kitsu-ep-50792-1");

      const keptOther = afterOps.find((o) => o.id === "outbox-unrelated-keep");
      assert.equal(keptOther?.episodeId, "kitsu-ep-99999-3");
      assert.equal(keptOther?.payload?.id, "kitsu-ep-99999-3");
    });
  });

  describe("10. Backend (PGLite) mantém 409 em colisão e persiste os 12 episódios Dublados após reparo sem tocar o Legendado", () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const testSubAnimeId = `anilist-213457-col-${suffix}`;
    const testDubAnimeId = `local-dub-col-${suffix}`;
    const kitsuIds = Array.from({ length: 12 }, (_, idx) => `kitsu-ep-50792-col-${suffix}-${idx + 1}`);
    const adminUserId = `admin-col-${suffix}`;
    const adminSessionToken = `sess-col-${suffix}`;

    after(async () => {
      if (dbSource !== "pglite") return;
      const sql = await getSql();
      await sql.query(`DELETE FROM "episode_sources" WHERE "episode_id" IN (SELECT "id" FROM "catalog_episode" WHERE "animeId" = ANY($1::text[]));`, [
        [testSubAnimeId, testDubAnimeId],
      ]);
      await sql.query(`DELETE FROM "catalog_episode" WHERE "animeId" = ANY($1::text[]);`, [
        [testSubAnimeId, testDubAnimeId],
      ]);
      await sql.query(`DELETE FROM "catalog_season" WHERE "animeId" = ANY($1::text[]);`, [
        [testSubAnimeId, testDubAnimeId],
      ]);
      await sql.query(`DELETE FROM "catalog_anime" WHERE "id" = ANY($1::text[]);`, [
        [testSubAnimeId, testDubAnimeId],
      ]);
      await sql.query(`DELETE FROM "session" WHERE "token" = $1;`, [adminSessionToken]);
      await sql.query(`DELETE FROM "user" WHERE "id" = $1;`, [adminUserId]);
      await invalidateCatalogEpisodesCacheAsync(testSubAnimeId, testDubAnimeId);
    });

    it("rejeita com 409 se enviar ID do Legendado, e após repairDubbedOutboxEpisodeIds sincroniza 12/12 no Dublado", async (t) => {
      if (dbSource !== "pglite") {
        t.skip("Teste SQL executa apenas contra PGLite isolado");
        return;
      }

      const sql = await getSql();
      const prevAdminIds = process.env.ADMIN_USER_IDS;
      process.env.ADMIN_USER_IDS = prevAdminIds
        ? `${prevAdminIds},${adminUserId}`
        : adminUserId;

      try {
        await sql.query(
          `INSERT INTO "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
           VALUES ($1, 'Admin Col', $2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           ON CONFLICT ("id") DO NOTHING;`,
          [adminUserId, `${adminUserId}@hikaritv.test`],
        );
        await sql.query(
          `INSERT INTO "session" ("id", "expiresAt", "token", "createdAt", "updatedAt", "userId")
           VALUES ($1, CURRENT_TIMESTAMP + INTERVAL '1 day', $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $3);`,
          [`sess-${suffix}`, adminSessionToken, adminUserId],
        );

        // 1. Cria Legendado com 12 episódios donos dos IDs
        await executeAdminUpsertCatalogAnime({
          id: testSubAnimeId,
          titleRomaji: `Fool Night ${suffix}`,
          titleEnglish: `Fool Night ${suffix}`,
          anilistId: 91345700 + Math.floor(Math.random() * 10000),
          kitsuId: 50792,
          format: "TV",
          year: 2025,
          hidden: false,
          seasons: [{ number: 1, title: "Temporada 1" }],
        });

        for (let i = 0; i < 12; i++) {
          const res = await handlePostCatalogEpisode(
            {
              request: new Request("https://hikaritv.cc.cd/api/admin/catalog-episode", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${adminSessionToken}`,
                },
                body: JSON.stringify({
                  id: kitsuIds[i],
                  animeId: testSubAnimeId,
                  seasonNumber: 1,
                  number: i + 1,
                  title: `Ep ${i + 1}`,
                  audio: "sub",
                  videoUrl: `https://cdn.example.com/sub-${i + 1}.mp4`,
                  published: true,
                  replaceSources: true,
                }),
              }),
            },
            { assertSameSite: () => {} },
          );
          assert.equal(res.status, 200);
        }

        // 2. Cria Dublado independente
        await executeAdminUpsertCatalogAnime({
          id: testDubAnimeId,
          titleRomaji: `Fool Night ${suffix} Dublado`,
          titleEnglish: `Fool Night ${suffix} Dubbed`,
          duplicateOfId: testSubAnimeId,
          format: "TV",
          year: 2025,
          hidden: false,
          seasons: [{ number: 1, title: "Temporada 1" }],
        });

        // 3. Integridade do backend: tentar enviar ID do Legendado para o Dublado ainda retorna 409
        const collideRes = await handlePostCatalogEpisode(
          {
            request: new Request("https://hikaritv.cc.cd/api/admin/catalog-episode", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminSessionToken}`,
              },
              body: JSON.stringify({
                id: kitsuIds[0],
                animeId: testDubAnimeId,
                seasonNumber: 1,
                number: 1,
                title: "Ep 1 Dub",
                audio: "dub",
                videoUrl: "https://cdn.example.com/dub-1.mp4",
                published: true,
                replaceSources: true,
              }),
            }),
          },
          { assertSameSite: () => {} },
        );
        assert.equal(collideRes.status, 409);
        const collideJson = (await collideRes.json()) as { code?: string };
        assert.equal(collideJson.code, "ID_BOUND_TO_OTHER_SLOT");

        // 4. Popula Outbox com os 12 IDs colidentes e repara + sincroniza via handler real
        await withIsolatedWindow(async () => {
          useHikariStore.setState({
            hydrated: true,
            animes: [
              makeDubbedLocalAnime({
                id: testSubAnimeId,
                titleRomaji: `Fool Night ${suffix}`,
                titleEnglish: `Fool Night ${suffix}`,
                duplicateOfId: null,
                seasons: [
                  {
                    id: "s-sub",
                    number: 1,
                    title: "Temporada 1",
                    episodes: kitsuIds.map((kid, i) => ({
                      id: kid,
                      number: i + 1,
                      title: `Ep ${i + 1}`,
                      audio: "sub",
                      published: true,
                    })),
                  },
                ],
              }),
              makeDubbedLocalAnime({
                id: testDubAnimeId,
                serverCatalogId: testDubAnimeId,
                syncedAt: Date.now(),
                duplicateOfId: testSubAnimeId,
              }),
            ],
          });

          const collidingOps: OutboxOperation[] = kitsuIds.map((kid, i) => ({
            id: `outbox-pglite-${i + 1}`,
            type: "upsert",
            episodeId: kid,
            animeId: testDubAnimeId,
            seasonNumber: 1,
            episodeNumber: i + 1,
            payload: {
              id: kid,
              animeId: testDubAnimeId,
              seasonNumber: 1,
              number: i + 1,
              title: `Ep ${i + 1} Dublado`,
              audio: "dub",
              videoUrl: `https://cdn.example.com/dub-${i + 1}.mp4`,
              published: true,
              replaceSources: true,
              animeTitle: `Fool Night ${suffix} Dublado`,
            },
            createdAt: Date.now(),
            attempts: 1,
            status: "conflict",
            lastError: `Conflito de integridade: o identificador "${kid}" já está associado a outro episódio`,
          }));
          writeOutbox(collidingOps);

          const originalFetch = globalThis.fetch;
          globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
            const url = String(input);
            if (url.includes("/api/admin/catalog-episode")) {
              return handlePostCatalogEpisode(
                {
                  request: new Request("https://hikaritv.cc.cd/api/admin/catalog-episode", {
                    method: init?.method || "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${adminSessionToken}`,
                    },
                    body: init?.body,
                  }),
                },
                { assertSameSite: () => {} },
              );
            }
            return new Response("Not found", { status: 404 });
          }) as typeof fetch;

          try {
            const flushRes = await flushOutbox();
            assert.equal(flushRes.processed, 12);
            assert.equal(flushRes.remaining, 0);
            assert.equal(readOutbox().length, 0);

            const subDbRows = await sql.query<{ id: string; audio: string }>(
              `SELECT "id", "audio" FROM "catalog_episode" WHERE "animeId" = $1 ORDER BY "number";`,
              [testSubAnimeId],
            );
            const dubDbRows = await sql.query<{ id: string; audio: string }>(
              `SELECT "id", "audio" FROM "catalog_episode" WHERE "animeId" = $1 ORDER BY "number";`,
              [testDubAnimeId],
            );

            assert.equal(subDbRows.length, 12);
            assert.deepEqual(
              subDbRows.map((r) => r.id),
              kitsuIds,
            );
            assert.ok(subDbRows.every((r) => r.audio === "sub"));

            assert.equal(dubDbRows.length, 12);
            assert.ok(dubDbRows.every((r) => r.audio === "dub" && r.id.startsWith("e-")));
            assert.equal(new Set(dubDbRows.map((r) => r.id)).size, 12);
          } finally {
            globalThis.fetch = originalFetch;
          }
        });
      } finally {
        if (prevAdminIds === undefined) {
          delete process.env.ADMIN_USER_IDS;
        } else {
          process.env.ADMIN_USER_IDS = prevAdminIds;
        }
      }
    });
  });
});

