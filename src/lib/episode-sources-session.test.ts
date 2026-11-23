import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { EpisodeSourceItem } from "@/lib/anitube22";
import type { Episode } from "@/lib/types";
import {
  createEpisodeSourcesSessionStore,
  getEpisodeSlotsSignature,
} from "./episode-sources-session.ts";

function makeEpisode(overrides: Partial<Episode> = {}): Episode {
  return {
    id: "ep-1",
    number: 1,
    title: "Episódio 1",
    published: true,
    ...overrides,
  };
}

function makeSource(overrides: Partial<EpisodeSourceItem> = {}): EpisodeSourceItem {
  return {
    id: "src-1",
    episodeId: "ep-1",
    provider: "anitube22",
    externalId: "123456",
    lang: "sub",
    quality: "1080p",
    priority: 0,
    status: "active",
    failCount: 0,
    lastCheckedAt: null,
    namePath: "/animes/sample/1.mp4",
    urlPath: "/animes/sample/1.mp4",
    imgUrl: "https://cdn.example/thumb.jpg",
    ...overrides,
  };
}

describe("EpisodeSourcesSessionStore (Otimização C1)", () => {
  it("1. Não realiza nenhum carregamento antecipado até loadEpisodeSources ser chamado sob demanda", () => {
    const store = createEpisodeSourcesSessionStore();
    assert.equal(store.isValid("ep-1"), false);
    assert.equal(store.getCached("ep-1"), undefined);
    assert.equal(store.isInFlight("ep-1"), false);
  });

  it("2. Reutiliza dados já carregados ao fechar e reabrir gaveta sem repetir fetch", async () => {
    const store = createEpisodeSourcesSessionStore();
    let fetchCalls = 0;

    const fetcher = async (epId: string) => {
      fetchCalls += 1;
      return [
        makeSource({ id: "s1", episodeId: epId, status: "active" }),
        makeSource({ id: "s2", episodeId: epId, status: "broken", failCount: 3 }),
      ];
    };

    const first = await store.loadEpisodeSources("ep-10", fetcher);
    assert.equal(fetchCalls, 1);
    assert.equal(first.fromCache, false);
    assert.equal(first.sources.length, 2);
    assert.equal(first.sources[1]?.status, "broken");

    // Simula fechamento e reabertura da gaveta
    const second = await store.loadEpisodeSources("ep-10", fetcher);
    assert.equal(fetchCalls, 1);
    assert.equal(second.fromCache, true);
    assert.equal(second.sources.length, 2);
  });

  it("3. Previne requisições duplicadas em cliques rápidos (singleflight)", async () => {
    const store = createEpisodeSourcesSessionStore();
    let fetchCalls = 0;
    let resolveFetch!: (items: EpisodeSourceItem[]) => void;

    const fetcher = () => {
      fetchCalls += 1;
      return new Promise<EpisodeSourceItem[]>((resolve) => {
        resolveFetch = resolve;
      });
    };

    const p1 = store.loadEpisodeSources("ep-20", fetcher);
    const p2 = store.loadEpisodeSources("ep-20", fetcher);
    const p3 = store.loadEpisodeSources("ep-20", fetcher, { force: true });

    assert.equal(fetchCalls, 1);
    assert.equal(store.isInFlight("ep-20"), true);

    resolveFetch([makeSource({ id: "s20", episodeId: "ep-20" })]);
    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

    assert.equal(fetchCalls, 1);
    assert.equal(r1.fromCache, false);
    assert.equal(r2.deduplicated, true);
    assert.equal(r3.deduplicated, true);
    assert.equal(r1.sources[0]?.id, "s20");
    assert.equal(store.isInFlight("ep-20"), false);
  });

  it("4. Isola cache por episódio e preserva estado vazio ([]) sem refetches", async () => {
    const store = createEpisodeSourcesSessionStore();
    const calls: string[] = [];

    const fetcher = async (epId: string) => {
      calls.push(epId);
      if (epId === "ep-empty") return [];
      return [makeSource({ id: `src-${epId}`, episodeId: epId })];
    };

    const resA = await store.loadEpisodeSources("ep-a", fetcher);
    const resEmpty = await store.loadEpisodeSources("ep-empty", fetcher);
    const resEmptyAgain = await store.loadEpisodeSources("ep-empty", fetcher);

    assert.deepEqual(calls, ["ep-a", "ep-empty"]);
    assert.equal(resA.sources.length, 1);
    assert.equal(resEmpty.sources.length, 0);
    assert.equal(resEmptyAgain.fromCache, true);
    assert.equal(resEmptyAgain.sources.length, 0);
  });

  it("5. Erro na requisição não envenena o cache e permite nova tentativa limpa", async () => {
    const store = createEpisodeSourcesSessionStore();
    let attempt = 0;

    const fetcher = async (epId: string) => {
      attempt += 1;
      if (attempt === 1) {
        throw new Error("Falha temporária HTTP 503");
      }
      return [makeSource({ id: "recovered", episodeId: epId })];
    };

    await assert.rejects(
      () => store.loadEpisodeSources("ep-err", fetcher),
      /HTTP 503/,
    );
    assert.equal(store.isValid("ep-err"), false);
    assert.equal(store.getCached("ep-err"), undefined);

    const retry = await store.loadEpisodeSources("ep-err", fetcher);
    assert.equal(attempt, 2);
    assert.equal(retry.sources[0]?.id, "recovered");
    assert.equal(store.isValid("ep-err"), true);
  });

  it("6. Detecta alterações locais nos slots Player 1–5 e invalida cache após salvamento", async () => {
    const store = createEpisodeSourcesSessionStore();
    const savedEp = makeEpisode({
      id: "ep-50",
      videoUrl: "https://site.test/playerricas.php?name=a&img=b&url=c",
    });

    store.setBaselineSlotsFromEpisodes([savedEp]);
    assert.equal(store.hasUnsavedSlotChanges(savedEp), false);

    // Edição local antes de salvar
    const editedEp = {
      ...savedEp,
      videoUrl2: "https://site.test/playerricas.php?name=d&img=e&url=f",
    };
    assert.equal(store.hasUnsavedSlotChanges(editedEp), true);

    // Reverter edição restaura consistência
    assert.equal(store.hasUnsavedSlotChanges(savedEp), false);

    // Carrega e depois simula confirmação do save() no servidor
    await store.loadEpisodeSources("ep-50", async () => [
      makeSource({ episodeId: "ep-50" }),
    ]);
    assert.equal(store.isValid("ep-50"), true);

    store.updateEpisodeBaseline("ep-50", getEpisodeSlotsSignature(editedEp));
    store.invalidateEpisode("ep-50");

    assert.equal(store.isValid("ep-50"), false);
    assert.equal(store.hasUnsavedSlotChanges(editedEp), false);
  });

  it("7. Descarta resposta em voo desatualizada se houver invalidação/mutação concorrente", async () => {
    const store = createEpisodeSourcesSessionStore();
    let resolveStale!: (items: EpisodeSourceItem[]) => void;

    const stalePromise = store.loadEpisodeSources(
      "ep-race",
      () =>
        new Promise<EpisodeSourceItem[]>((resolve) => {
          resolveStale = resolve;
        }),
    );

    // Enquanto o GET antigo está em voo, ocorre save() -> invalidação
    store.invalidateEpisode("ep-race");
    assert.equal(store.getRevision("ep-race"), 1);

    resolveStale([makeSource({ id: "stale-item", episodeId: "ep-race" })]);
    await stalePromise;

    // Cache NÃO deve ter sido contaminado pelo resultado antigo
    assert.equal(store.isValid("ep-race"), false);
    assert.equal(store.getCached("ep-race"), undefined);
  });

  it("8. Mantém cache coerente após adicionar ou remover fontes", async () => {
    const store = createEpisodeSourcesSessionStore();
    await store.loadEpisodeSources("ep-mut", async () => [
      makeSource({ id: "src-1", episodeId: "ep-mut", priority: 1 }),
    ]);

    const added = store.applyUpsertedSource(
      "ep-mut",
      makeSource({ id: "src-0", episodeId: "ep-mut", priority: 0, lang: "dub" }),
    );
    assert.deepEqual(
      added.map((s) => s.id),
      ["src-0", "src-1"],
    );
    assert.equal(store.isValid("ep-mut"), true);

    const afterDelete = store.applyDeletedSource("ep-mut", "src-1");
    assert.deepEqual(
      afterDelete.map((s) => s.id),
      ["src-0"],
    );
    assert.equal(store.isValid("ep-mut"), true);
  });
});
