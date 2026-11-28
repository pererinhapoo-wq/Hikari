import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  persistEpisode,
  readOutbox,
  writeOutbox,
  type OutboxOperation,
} from "@/lib/episode-writer";
import { reconcileDirtyEpisodeIdsAfterFormPopulation } from "@/lib/opening-admin-state";
import type { Episode, Season } from "@/lib/types";
import {
  EPISODES_PER_PAGE,
  INITIAL_COLLAPSE_EPISODE_THRESHOLD,
  buildInitialCollapsedSeasons,
  buildOutboxIndex,
  filterSeasonEpisodes,
  getCompactPageNumbers,
  getOutboxOpForEpisode,
  paginateEpisodes,
  publishFilledEpisodesInSeason,
} from "./editor-episodes-window.ts";

function makeEpisodes(count: number, offset = 0): Episode[] {
  return Array.from({ length: count }, (_, idx) => {
    const n = offset + idx + 1;
    return {
      id: `ep-${n}`,
      number: n,
      title: `Episódio ${n}`,
      published: n % 2 === 0,
    };
  });
}

function makeSeason(id: string, number: number, count: number): Season {
  return {
    id,
    number,
    title: `Temporada ${number}`,
    episodes: makeEpisodes(count, (number - 1) * 1000),
  };
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

describe("editor-episodes-window (Otimização C2)", () => {
  it("1. Pagina listas de 100, 250, 500 e 1.000 episódios limitando itens renderizados por página", () => {
    for (const total of [100, 250, 500, 1000]) {
      const episodes = makeEpisodes(total);
      const p1 = paginateEpisodes(episodes, 1, EPISODES_PER_PAGE);
      assert.equal(p1.items.length, EPISODES_PER_PAGE);
      assert.equal(p1.currentPage, 1);
      assert.equal(p1.totalItems, total);
      assert.equal(p1.totalPages, Math.ceil(total / EPISODES_PER_PAGE));
      assert.equal(p1.startItem, 1);
      assert.equal(p1.endItem, EPISODES_PER_PAGE);

      const lastPage = paginateEpisodes(episodes, p1.totalPages, EPISODES_PER_PAGE);
      assert.equal(lastPage.currentPage, p1.totalPages);
      assert.equal(lastPage.items.at(-1)?.number, total);
    }
  });

  it("2. Faz clamping seguro quando página solicitada excede o total após exclusão ou filtro", () => {
    const episodes = makeEpisodes(30);
    const clamped = paginateEpisodes(episodes, 99, 25);
    assert.equal(clamped.currentPage, 2);
    assert.equal(clamped.items.length, 5);
    assert.equal(clamped.startItem, 26);
    assert.equal(clamped.endItem, 30);

    const empty = paginateEpisodes([], 3, 25);
    assert.equal(empty.currentPage, 1);
    assert.equal(empty.totalPages, 1);
    assert.equal(empty.items.length, 0);
  });

  it("3. Filtra e localiza episódios por número ou título em grandes catálogos", () => {
    const episodes = makeEpisodes(1000);
    episodes[499] = {
      ...episodes[499],
      title: "O Despertar Final",
    };

    const byNumber = filterSeasonEpisodes(episodes, "500");
    assert.equal(byNumber[0]?.number, 500);
    assert.ok(byNumber.length >= 1);

    const byTitle = filterSeasonEpisodes(episodes, "despertar final");
    assert.equal(byTitle.length, 1);
    assert.equal(byTitle[0]?.id, "ep-500");

    // Query vazia retorna a própria referência do array sem cópia
    assert.equal(filterSeasonEpisodes(episodes, "   "), episodes);
  });

  it("4. Gera numeração compacta de páginas para caber em telas móveis", () => {
    assert.deepEqual(getCompactPageNumbers(1, 3), [1, 2, 3]);
    assert.deepEqual(getCompactPageNumbers(1, 40), [1, 2, "ellipsis", 40]);
    assert.deepEqual(getCompactPageNumbers(20, 40), [
      1,
      "ellipsis",
      19,
      20,
      21,
      "ellipsis",
      40,
    ]);
    assert.deepEqual(getCompactPageNumbers(40, 40), [1, "ellipsis", 39, 40]);
  });

  it("5. Recolhe temporadas secundárias apenas em animes multi-temporada acima do limiar", () => {
    // 1 temporada com 1.000 episódios: mantém expandida (paginação limita DOM a 25)
    const singleLarge = [makeSeason("s1", 1, 1000)];
    assert.deepEqual(buildInitialCollapsedSeasons(singleLarge), {});

    // Multi-temporada pequeno (<= 25 episódios): mantém todas expandidas
    const multiSmall = [makeSeason("s1", 1, 12), makeSeason("s2", 2, 12)];
    assert.deepEqual(
      buildInitialCollapsedSeasons(multiSmall, INITIAL_COLLAPSE_EPISODE_THRESHOLD),
      {},
    );

    // Multi-temporada grande (> 25 episódios): mantém apenas T1 expandida e recolhe T2..Tn
    const multiLarge = [
      makeSeason("s1", 1, 20),
      makeSeason("s2", 2, 250),
      makeSeason("s3", 3, 250),
    ];
    assert.deepEqual(buildInitialCollapsedSeasons(multiLarge), {
      s2: true,
      s3: true,
    });
  });

  it("6. Indexa operações do Outbox em O(1) por episodeId, canonicalId e slot preservando pendências e conflitos", () => {
    const ops: OutboxOperation[] = [
      {
        id: "ob-1",
        type: "upsert",
        episodeId: "e-temp-1",
        animeId: "anime-1",
        seasonNumber: 1,
        episodeNumber: 5,
        status: "pending",
        createdAt: 1000,
        attempts: 0,
        payload: {
          id: "ep-canonical-5",
          animeId: "anime-1",
          seasonNumber: 1,
          number: 5,
          published: true,
        },
      },
      {
        id: "ob-2",
        type: "upsert",
        episodeId: "ep-canonical-9",
        animeId: "anime-1",
        seasonNumber: 2,
        episodeNumber: 9,
        status: "conflict",
        lastError: "URL inválida",
        createdAt: 2000,
        attempts: 1,
      },
      {
        id: "ob-other",
        type: "upsert",
        episodeId: "ep-other",
        animeId: "anime-2",
        seasonNumber: 1,
        episodeNumber: 1,
        status: "pending",
        createdAt: 3000,
        attempts: 0,
      },
    ];

    const index = buildOutboxIndex(ops, "anime-1");

    // Busca direta por episodeId
    assert.equal(getOutboxOpForEpisode(index, "e-temp-1")?.status, "pending");
    // Busca direta por ID canônico presente no payload
    assert.equal(getOutboxOpForEpisode(index, "ep-canonical-5")?.id, "ob-1");
    // Busca por slot (temporada + número) quando ID mudou localmente
    assert.equal(getOutboxOpForEpisode(index, "novo-id-local", 1, 5)?.id, "ob-1");
    // Conflito preservado
    const conflictOp = getOutboxOpForEpisode(index, "ep-canonical-9", 2, 9);
    assert.equal(conflictOp?.status, "conflict");
    assert.equal(conflictOp?.lastError, "URL inválida");
    // Isolamento por animeId
    assert.equal(getOutboxOpForEpisode(index, "ep-other", 1, 1), undefined);
  });
});

describe("Publicar todos os episódios em massa (editor-episodes-window)", () => {
  it("1-5. Publica todos os 12+ episódios preenchidos (ID Hikari Player ou URLs), preserva os já publicados, mantém vazios inalterados e preserva todos os campos", () => {
    const filledFromDraft: Episode[] = Array.from({ length: 12 }, (_, idx) => {
      const n = idx + 1;
      const useUrl = n % 3 === 0;
      return {
        id: `e-local-${n}`,
        externalEpisodeId: `ext-${n}`,
        number: n,
        title: `Episódio Especial ${n}`,
        thumbnail: `https://cdn.example.com/thumb-${n}.jpg`,
        duration: "24:10",
        synopsis: `Sinopse ${n}`,
        videoUrl: useUrl ? `https://cdn.example.com/ep-${n}.mp4` : undefined,
        videoUrl2: n === 6 ? `https://cdn.example.com/ep-${n}-alt.m3u8` : undefined,
        hikariPlayerEpisodeId: useUrl ? undefined : `hikari_ep_${n}`,
        audio: n % 2 === 0 ? "dub" : "sub",
        openingStartSeconds: 90,
        openingEndSeconds: 180,
        recentBadges: { lancamento: n === 1, novo: n === 2, final: n === 12 },
        published: false,
      };
    });

    const alreadyPublishedEp: Episode = {
      id: "e-already-pub-13",
      number: 13,
      title: "Episódio 13",
      hikariPlayerEpisodeId: "hikari_ep_13",
      audio: "sub",
      published: true,
    };

    const emptyEp14: Episode = {
      id: "e-empty-14",
      number: 14,
      title: "Episódio 14",
      published: false,
    };

    const invalidSourceEp15: Episode = {
      id: "e-invalid-15",
      number: 15,
      title: "Episódio 15",
      hikariPlayerEpisodeId: "https://evil.example/e/15",
      published: false,
    };

    const season: Season = {
      id: "season-1",
      number: 1,
      title: "Temporada 1",
      episodes: [...filledFromDraft, alreadyPublishedEp, emptyEp14, invalidSourceEp15],
    };

    const res = publishFilledEpisodesInSeason([season], "season-1");

    assert.equal(res.changed, true);
    assert.equal(res.eligibleCount, 13);
    assert.equal(res.alreadyPublishedCount, 1);
    assert.equal(res.emptyOrInvalidCount, 2);
    assert.equal(res.changedEpisodeIds.length, 12);

    const nextSeason = res.seasons[0]!;
    assert.equal(nextSeason.episodes.length, 15);

    // Todos os 12 preenchidos passaram para Publicado preservando 100% dos dados
    for (let i = 0; i < 12; i += 1) {
      const before = filledFromDraft[i]!;
      const after = nextSeason.episodes[i]!;
      assert.equal(after.published, true);
      assert.deepEqual(after, { ...before, published: true });
    }

    // Episódio já publicado continua publicado e intacto (mesma referência)
    assert.equal(nextSeason.episodes[12], alreadyPublishedEp);
    assert.equal(nextSeason.episodes[12]?.published, true);

    // Episódios vazios ou com fonte inválida permanecem inalterados (mesma referência)
    assert.equal(nextSeason.episodes[13], emptyEp14);
    assert.equal(nextSeason.episodes[13]?.published, false);
    assert.equal(nextSeason.episodes[14], invalidSourceEp15);
    assert.equal(nextSeason.episodes[14]?.published, false);
  });

  it("5b. Funciona com 50 episódios (incluindo páginas além da primeira página de 25)", () => {
    const episodes: Episode[] = Array.from({ length: 50 }, (_, idx) => ({
      id: `ep-50-${idx + 1}`,
      number: idx + 1,
      title: `Episódio ${idx + 1}`,
      hikariPlayerEpisodeId: idx < 45 ? `hp_${idx + 1}` : undefined,
      published: false,
    }));
    const seasons: Season[] = [{ id: "s1", number: 1, title: "T1", episodes }];

    const res = publishFilledEpisodesInSeason(seasons, "s1");
    assert.equal(res.changedEpisodeIds.length, 45);
    assert.equal(res.emptyOrInvalidCount, 5);
    // Verifica que episódios da página 2 (26..45) também foram publicados e 46..50 permaneceram rascunho
    assert.equal(res.seasons[0]!.episodes[25]?.published, true);
    assert.equal(res.seasons[0]!.episodes[44]?.published, true);
    assert.equal(res.seasons[0]!.episodes[45]?.published, false);
    assert.equal(res.seasons[0]!.episodes[49]?.published, false);
  });

  it("2b. Quando não há nenhum episódio preenchido, não executa alteração e mantém referências originais", () => {
    const seasons: Season[] = [
      {
        id: "s-empty",
        number: 1,
        title: "Temporada 1",
        episodes: [
          { id: "e-1", number: 1, title: "Episódio 1", published: false },
          { id: "e-2", number: 2, title: "Episódio 2", videoUrl: "   ", published: false },
        ],
      },
    ];

    const res = publishFilledEpisodesInSeason(seasons, "s-empty");
    assert.equal(res.changed, false);
    assert.equal(res.eligibleCount, 0);
    assert.equal(res.changedEpisodeIds.length, 0);
    assert.equal(res.seasons, seasons);
  });

  it("6. Não salva automaticamente no banco (zero chamadas fetch até que o usuário clique em Salvar)", () => {
    const originalFetch = globalThis.fetch;
    let fetchCalls = 0;
    globalThis.fetch = (async () => {
      fetchCalls += 1;
      throw new Error("Não deve chamar fetch durante publicação em massa no formulário");
    }) as typeof fetch;

    try {
      const seasons: Season[] = [
        {
          id: "s1",
          number: 1,
          title: "Temporada 1",
          episodes: Array.from({ length: 12 }, (_, idx) => ({
            id: `e-unsaved-${idx + 1}`,
            number: idx + 1,
            title: `Episódio ${idx + 1}`,
            hikariPlayerEpisodeId: `id_${idx + 1}`,
            published: false,
          })),
        },
      ];

      const res = publishFilledEpisodesInSeason(seasons, "s1");
      assert.equal(res.changed, true);
      assert.equal(res.changedEpisodeIds.length, 12);
      assert.equal(fetchCalls, 0);

      // Verifica também no código-fonte de admin.$id.tsx que publishAllSeasonEpisodes não chama save() nem persistEpisode()
      const adminSrc = fs.readFileSync(path.resolve("src/routes/admin.$id.tsx"), "utf8");
      const blockMatch = adminSrc.match(
        /const publishAllSeasonEpisodes = useCallback\([\s\S]*?\n {2}\);\n/,
      );
      assert.ok(blockMatch, "publishAllSeasonEpisodes deve existir em admin.$id.tsx");
      assert.equal(blockMatch[0].includes("persistEpisode("), false);
      assert.equal(blockMatch[0].includes("upsertAnime("), false);
      assert.equal(blockMatch[0].includes("fetch("), false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("7 & 10. O fluxo de dirtyEpisodeIds, reconciliação, Salvar (persistEpisode) e Outbox persiste corretamente os novos status", async () => {
    const restoreWindow = installTestWindowStorage();
    const originalFetch = globalThis.fetch;

    try {
      const animeId = "anime-bulk-pub-save";
      const seasons: Season[] = [
        {
          id: "s1",
          number: 1,
          title: "Temporada 1",
          episodes: [
            ...Array.from({ length: 12 }, (_, idx) => ({
              id: `ep-save-${idx + 1}`,
              number: idx + 1,
              title: `Episódio ${idx + 1}`,
              hikariPlayerEpisodeId: `hp_save_${idx + 1}`,
              published: false,
            })),
            {
              id: "ep-save-empty-13",
              number: 13,
              title: "Episódio 13",
              published: false,
            },
          ],
        },
      ];

      const dirtyIds = new Set<string>();
      const explicitUserDirtyIds = new Set<string>();

      const bulk = publishFilledEpisodesInSeason(seasons, "s1");
      for (const eid of bulk.changedEpisodeIds) {
        dirtyIds.add(eid);
        explicitUserDirtyIds.add(eid);
      }

      // Mesmo se houver reconciliação com snapshot antigo do servidor (onde estavam como rascunho),
      // explicitUserDirtyIds preserva todos os episódios marcados em massa como pendentes de salvamento.
      reconcileDirtyEpisodeIdsAfterFormPopulation(
        dirtyIds,
        bulk.seasons,
        bulk.seasons[0]!.episodes.map((ep) => ({
          id: ep.id,
          seasonNumber: 1,
          number: ep.number,
          published: false,
        })),
        explicitUserDirtyIds,
      );
      for (let i = 1; i <= 12; i += 1) {
        assert.equal(dirtyIds.has(`ep-save-${i}`), true);
      }
      // Episódio 13 já estava salvo/vazio e não foi alterado em massa; se existir no server como rascunho, não entra indevidamente
      assert.equal(dirtyIds.has("ep-save-empty-13"), false);

      // Simula clique em Salvar: episódio 12 falha temporariamente (vai para Outbox) e 1..11 confirmam no servidor
      const sentPayloads: Array<{ id: string; published: boolean; hikariPlayerEpisodeId?: string }> = [];
      globalThis.fetch = (async (_input: unknown, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body || "{}")) as {
          id: string;
          number: number;
          published: boolean;
          hikariPlayerEpisodeId?: string;
        };
        sentPayloads.push(body);
        if (body.number === 12) {
          return new Response(JSON.stringify({ error: "Erro temporário 503" }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(
          JSON.stringify({
            ok: true,
            published: body.published,
            publishedAt: "2026-11-28T00:00:00.000Z",
            episodeId: body.id,
            canonicalId: body.id,
            hikariPlayerEpisodeId: body.hikariPlayerEpisodeId,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }) as typeof fetch;

      writeOutbox([]);
      const dirtyEpisodesToSave = bulk.seasons[0]!.episodes.filter((ep) =>
        dirtyIds.has(ep.id),
      );
      assert.equal(dirtyEpisodesToSave.length, 12);

      const results = [];
      for (const ep of dirtyEpisodesToSave) {
        results.push(await persistEpisode(animeId, 1, ep, "Anime Teste"));
      }

      assert.equal(sentPayloads.length, 12);
      assert.ok(sentPayloads.every((p) => p.published === true));
      assert.equal(results.slice(0, 11).every((r) => r.confirmed && r.published === true), true);
      assert.equal(results[11]?.confirmed, false);
      assert.equal(results[11]?.status, "pending");

      const outbox = readOutbox();
      assert.equal(outbox.length, 1);
      assert.equal(outbox[0]?.episodeId, "ep-save-12");
      assert.equal(outbox[0]?.payload?.published, true);
    } finally {
      globalThis.fetch = originalFetch;
      restoreWindow();
    }
  });

  it("8. Alteração individual continua funcionando normalmente após a publicação em massa", () => {
    const initialSeasons: Season[] = [
      {
        id: "s1",
        number: 1,
        title: "Temporada 1",
        episodes: Array.from({ length: 12 }, (_, idx) => ({
          id: `ep-ind-${idx + 1}`,
          number: idx + 1,
          title: `Episódio ${idx + 1}`,
          hikariPlayerEpisodeId: `hp_${idx + 1}`,
          published: false,
        })),
      },
    ];

    const bulk = publishFilledEpisodesInSeason(initialSeasons, "s1");
    assert.equal(bulk.seasons[0]!.episodes.every((ep) => ep.published === true), true);

    // Simula patchEpisode individual voltando o Episódio 3 para Rascunho
    const afterIndividualToggle = bulk.seasons.map((s) =>
      s.id !== "s1"
        ? s
        : {
            ...s,
            episodes: s.episodes.map((ep) =>
              ep.id === "ep-ind-3" ? { ...ep, published: false } : ep,
            ),
          },
    );

    assert.equal(afterIndividualToggle[0]!.episodes[2]?.published, false);
    assert.equal(afterIndividualToggle[0]!.episodes[0]?.published, true);
    assert.equal(afterIndividualToggle[0]!.episodes[11]?.published, true);
  });

  it("9. Não publica episódios de outras temporadas nem de outros animes/formulários", () => {
    const animeASeason1: Season = {
      id: "anime-a-s1",
      number: 1,
      title: "Temporada 1",
      episodes: [
        {
          id: "a-s1-ep1",
          number: 1,
          title: "Ep 1",
          hikariPlayerEpisodeId: "hp_a1",
          published: false,
        },
      ],
    };
    const animeASeason2: Season = {
      id: "anime-a-s2",
      number: 2,
      title: "Temporada 2",
      episodes: [
        {
          id: "a-s2-ep1",
          number: 1,
          title: "Ep 1 T2",
          hikariPlayerEpisodeId: "hp_a2",
          published: false,
        },
      ],
    };
    const animeBSeason1: Season = {
      id: "anime-b-s1",
      number: 1,
      title: "Outro Anime T1",
      episodes: [
        {
          id: "b-s1-ep1",
          number: 1,
          title: "Ep 1 B",
          hikariPlayerEpisodeId: "hp_b1",
          published: false,
        },
      ],
    };

    const animeASeasons = [animeASeason1, animeASeason2];
    const animeBSeasons = [animeBSeason1];

    const res = publishFilledEpisodesInSeason(animeASeasons, "anime-a-s1");

    // Temporada 1 do Anime A foi publicada
    assert.equal(res.seasons[0]!.episodes[0]?.published, true);
    // Temporada 2 do Anime A permaneceu intacta (mesma referência, published=false)
    assert.equal(res.seasons[1], animeASeason2);
    assert.equal(res.seasons[1]!.episodes[0]?.published, false);
    // Outro anime/formulário permaneceu intacto
    assert.equal(animeBSeasons[0]!.episodes[0]?.published, false);
  });
});

