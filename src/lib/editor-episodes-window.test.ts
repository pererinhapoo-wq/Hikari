import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { OutboxOperation } from "@/lib/episode-writer";
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
