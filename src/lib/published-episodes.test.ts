import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getRecentEpisodesSection,
  getAllPublishedEpisodes,
  isConfirmedFinalEpisode,
  isAnimeConfirmedFinished,
} from "./published-episodes";
import type { LocalAnime } from "./types";

function createMockAnime(overrides: Partial<LocalAnime> = {}): LocalAnime {
  return {
    id: "anime-1",
    titleRomaji: "Frieren: Beyond Journey's End",
    titleEnglish: "Frieren: Beyond Journey's End",
    titleNative: "葬送のフリーレン",
    cover: "https://example.com/cover.jpg",
    banner: "https://example.com/banner.jpg",
    synopsis: "Sinopse do anime",
    score: 95,
    genres: ["Aventura", "Fantasia"],
    format: "TV",
    status: "FINISHED",
    episodesCount: 28,
    season: "FALL",
    year: 2023,
    trailerId: null,
    hidden: false,
    createdAt: 1700000000000,
    updatedAt: 1700000050000,
    seasons: [
      {
        id: "s-1",
        number: 1,
        title: "Temporada 1",
        episodes: [
          {
            id: "ep-1",
            number: 1,
            title: "O Fim da Jornada",
            videoUrl: "https://example.com/videos/ep1.mp4",
            published: true,
          },
          {
            id: "ep-2",
            number: 2,
            title: "Não Precisava Ser Magia",
            videoUrl: "https://example.com/videos/ep2.mp4",
            published: true,
          },
          {
            id: "ep-28",
            number: 28,
            title: "Seria Vergonhoso Quando Nos Reencontrarmos",
            videoUrl: "https://example.com/videos/ep28.mp4",
            published: true,
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe("Lógica de exibição da seção 'Novos Episódios'", () => {
  it("Regra 1: LANÇAMENTO deve ser associado unicamente ao Episódio 1 e nunca aos episódios seguintes", () => {
    const anime = createMockAnime({
      status: "RELEASING",
      episodesCount: 12,
      seasons: [
        {
          id: "s-1",
          number: 1,
          title: "Temporada 1",
          episodes: [
            { id: "e1", number: 1, title: "Episódio 1", videoUrl: "https://example.com/e1.mp4", published: true },
            { id: "e2", number: 2, title: "Episódio 2", videoUrl: "https://example.com/e2.mp4", published: true },
          ],
        },
      ],
    });

    const recent = getRecentEpisodesSection([anime]);

    // O episódio 1 deve ter o selo LANÇAMENTO
    const ep1 = recent.find((e) => e.episodeNumber === 1);
    assert.ok(ep1, "Episódio 1 deve estar presente");
    assert.equal(ep1.badge, "LANÇAMENTO");

    // O episódio 2 NUNCA deve ter o selo LANÇAMENTO
    const ep2 = recent.find((e) => e.episodeNumber === 2);
    assert.ok(ep2, "Episódio 2 deve estar presente como o mais recente");
    assert.notEqual(ep2.badge, "LANÇAMENTO");

    // O anime deve aparecer em LANÇAMENTO apenas uma vez
    const lancamentos = recent.filter((e) => e.badge === "LANÇAMENTO");
    assert.equal(lancamentos.length, 1);
  });

  it("Regra 2 e 4: Em cadastro em massa de 300 episódios, não exibe os 300 intermediários", () => {
    const episodes = Array.from({ length: 300 }, (_, i) => ({
      id: `ep-${i + 1}`,
      number: i + 1,
      title: `Episódio ${i + 1}`,
      videoUrl: `https://example.com/episodes/ep${i + 1}.mp4`,
      published: true,
    }));

    const anime = createMockAnime({
      id: "anime-300",
      status: "FINISHED",
      episodesCount: 300,
      seasons: [
        {
          id: "s-1",
          number: 1,
          title: "Temporada 1",
          episodes,
        },
      ],
    });

    const recent = getRecentEpisodesSection([anime]);

    // Não deve conter 300 episódios na seção Novos Episódios!
    assert.equal(recent.length, 2, "Deve exibir apenas o episódio 1 e o episódio 300");

    // Episódio 1 como LANÇAMENTO
    const ep1 = recent.find((e) => e.episodeNumber === 1);
    assert.ok(ep1);
    assert.equal(ep1.badge, "LANÇAMENTO");

    // Episódio 300 como FINAL (já que o anime foi concluído com 300 episódios)
    const ep300 = recent.find((e) => e.episodeNumber === 300);
    assert.ok(ep300);
    assert.equal(ep300.badge, "FINAL");

    // Episódios intermediários (ex: 2 a 299) não devem constar na seção
    const ep2 = recent.find((e) => e.episodeNumber === 2);
    assert.equal(ep2, undefined, "Episódio 2 intermediário não deve poluir a seção");
    const ep150 = recent.find((e) => e.episodeNumber === 150);
    assert.equal(ep150, undefined, "Episódio 150 intermediário não deve poluir a seção");
  });

  it("Regra 3: FINAL só deve ser destacado quando houver confirmação de que o anime terminou", () => {
    // Caso A: Anime em exibição semanal (RELEASING) — o último episódio cadastrado NÃO é FINAL
    const ongoingAnime = createMockAnime({
      id: "anime-ongoing",
      status: "RELEASING",
      episodesCount: null,
      seasons: [
        {
          id: "s-1",
          number: 1,
          title: "Temporada 1",
          episodes: [
            { id: "e1", number: 1, title: "Episódio 1", videoUrl: "https://example.com/e1.mp4", published: true },
            { id: "e2", number: 2, title: "Episódio 2", videoUrl: "https://example.com/e2.mp4", published: true },
            { id: "e10", number: 10, title: "Episódio 10", videoUrl: "https://example.com/e10.mp4", published: true },
          ],
        },
      ],
    });

    const ongoingRecent = getRecentEpisodesSection([ongoingAnime]);
    const latestOngoing = ongoingRecent.find((e) => e.episodeNumber === 10);
    assert.ok(latestOngoing);
    assert.equal(latestOngoing.badge, null, "Anime em lançamento não deve receber selo FINAL");

    // Caso B: Anime com status FINISHED e número do episódio bate com a contagem total
    const finishedAnime = createMockAnime({
      id: "anime-finished",
      status: "FINISHED",
      episodesCount: 12,
      seasons: [
        {
          id: "s-1",
          number: 1,
          title: "Temporada 1",
          episodes: [
            { id: "e1", number: 1, title: "Episódio 1", videoUrl: "https://example.com/e1.mp4", published: true },
            { id: "e12", number: 12, title: "Episódio 12", videoUrl: "https://example.com/e12.mp4", published: true },
          ],
        },
      ],
    });

    const finishedRecent = getRecentEpisodesSection([finishedAnime]);
    const latestFinished = finishedRecent.find((e) => e.episodeNumber === 12);
    assert.ok(latestFinished);
    assert.equal(latestFinished.badge, "FINAL", "Último episódio de anime concluído deve receber FINAL");
  });

  it("Regra 5: Todos os episódios continuam acessíveis no catálogo completo e na página do anime", () => {
    const episodes = Array.from({ length: 50 }, (_, i) => ({
      id: `ep-${i + 1}`,
      number: i + 1,
      title: `Episódio ${i + 1}`,
      videoUrl: `https://example.com/episodes/ep${i + 1}.mp4`,
      published: true,
    }));

    const anime = createMockAnime({
      id: "anime-50",
      status: "FINISHED",
      episodesCount: 50,
      seasons: [
        {
          id: "s-1",
          number: 1,
          title: "Temporada 1",
          episodes,
        },
      ],
    });

    // getAllPublishedEpisodes preserva todos os 50 episódios para navegação e busca
    const all = getAllPublishedEpisodes([anime]);
    assert.equal(all.length, 50, "Todos os 50 episódios devem permanecer disponíveis");

    // A estrutura do anime permanece com todos os episódios para a página de detalhes (/anime/$id)
    assert.equal(anime.seasons[0].episodes.length, 50);
  });
});
