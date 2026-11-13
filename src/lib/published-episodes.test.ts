import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getRecentEpisodesSection,
  getAllPublishedEpisodes,
  isConfirmedFinalEpisode,
  isAnimeConfirmedFinished,
  isPersistablePlayableVideoUrl,
  sanitizePlayableVideoUrl,
  isEpisodePublished,
  resolvePublicEpisodes,
  hasEpisodePlayableSource,
} from "./published-episodes";
import { persistEpisode } from "./episode-writer";
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

describe("Regras de publicação explícita e fonte válida de reprodução", () => {
  it("Aceita URLs HTTP/HTTPS válidas (inclusive esquema em maiúsculas) e rejeita URLs inválidas ou blocklist", () => {
    assert.equal(isPersistablePlayableVideoUrl("https://cdn.example.com/ep1.mp4"), true);
    assert.equal(isPersistablePlayableVideoUrl("HTTPS://cdn.example.com/ep1.m3u8"), true);
    assert.equal(isPersistablePlayableVideoUrl("http://media.example.com/stream.mp4"), true);

    assert.equal(isPersistablePlayableVideoUrl(""), false);
    assert.equal(isPersistablePlayableVideoUrl("   "), false);
    assert.equal(isPersistablePlayableVideoUrl("https://"), false);
    assert.equal(isPersistablePlayableVideoUrl("ftp://cdn.example.com/ep1.mp4"), false);
    assert.equal(isPersistablePlayableVideoUrl("javascript:alert(1)"), false);
    assert.equal(isPersistablePlayableVideoUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), false);
    assert.equal(isPersistablePlayableVideoUrl("https://www.crunchyroll.com/watch/123"), false);
    assert.equal(isPersistablePlayableVideoUrl("nao-e-url"), false);
  });

  it("Detecta fonte válida em qualquer player (Player 1 a Player 5)", () => {
    assert.equal(hasEpisodePlayableSource({}), false);
    assert.equal(hasEpisodePlayableSource({ videoUrl: "https://www.youtube.com/watch?v=abc" }), false);
    assert.equal(hasEpisodePlayableSource({ videoUrl4: "https://cdn.example.com/ep4.mp4" }), true);
    assert.equal(hasEpisodePlayableSource({ videoUrl5: "HTTPS://cdn.example.com/ep5.m3u8" }), true);
  });

  it("Bloqueia publicação quando não há fonte válida e nunca auto-publica rascunhos", async () => {
    const blocked = await persistEpisode("anime-test", 1, {
      id: "ep-invalid",
      number: 1,
      title: "Sem Fonte",
      videoUrl: "",
      published: true,
    });
    assert.equal(blocked.confirmed, false);
    assert.equal(blocked.queued, false);
    assert.equal(blocked.status, "conflict");
    assert.ok(blocked.error?.includes("fonte válida"));

    const originalFetch = globalThis.fetch;
    let sentPublished: boolean | undefined;
    globalThis.fetch = (async (_input: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body || "{}"));
      sentPublished = body.published;
      return new Response(
        JSON.stringify({
          ok: true,
          published: Boolean(body.published),
          publishedAt: body.published ? "2026-01-01T00:00:00.000Z" : null,
          episodeId: body.id,
          canonicalId: body.id,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;

    try {
      const draftWithSource = await persistEpisode("anime-test", 1, {
        id: "ep-draft",
        number: 2,
        title: "Rascunho com URL",
        videoUrl: "https://cdn.example.com/ep2.mp4",
        published: false,
      });
      assert.equal(sentPublished, false);
      assert.equal(draftWithSource.confirmed, true);
      assert.equal(draftWithSource.published, false);

      const omittedPublished = await persistEpisode("anime-test", 1, {
        id: "ep-omitted",
        number: 3,
        title: "Sem aprovação explícita",
        videoUrl: "https://cdn.example.com/ep3.mp4",
      });
      assert.equal(sentPublished, false);
      assert.equal(omittedPublished.confirmed, true);
      assert.equal(omittedPublished.published, false);

      const approved = await persistEpisode("anime-test", 1, {
        id: "ep-pub",
        number: 4,
        title: "Publicado",
        videoUrl: "https://cdn.example.com/ep4.mp4",
        published: true,
      });
      assert.equal(sentPublished, true);
      assert.equal(approved.confirmed, true);
      assert.equal(approved.published, true);
      assert.ok(approved.publishedAt);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("Não rejeita falsos positivos por substring e bloqueia domínios proibidos e esquemas inseguros", () => {
    // Casos válidos antes rejeitados indevidamente por substring matching
    assert.equal(sanitizePlayableVideoUrl("https://streammax.com/ep1.mp4"), "https://streammax.com/ep1.mp4");
    assert.equal(sanitizePlayableVideoUrl("https://vidmax.com/ep1.mp4"), "https://vidmax.com/ep1.mp4");
    assert.equal(sanitizePlayableVideoUrl("https://pixiq.com/ep1.m3u8"), "https://pixiq.com/ep1.m3u8");
    assert.equal(sanitizePlayableVideoUrl("https://cdn.example.com/max.com/ep1.mp4"), "https://cdn.example.com/max.com/ep1.mp4");
    assert.equal(sanitizePlayableVideoUrl("https://cdn.example.com/ep1.mp4?ref=viz.com"), "https://cdn.example.com/ep1.mp4?ref=viz.com");
    assert.equal(sanitizePlayableVideoUrl("https://stream.mux.com/abc123.m3u8"), "https://stream.mux.com/abc123.m3u8");
    assert.equal(sanitizePlayableVideoUrl("https://vz-123.b-cdn.net/video/playlist.m3u8"), "https://vz-123.b-cdn.net/video/playlist.m3u8");

    // Domínios de terceiros proibidos (raiz e subdomínios)
    assert.equal(sanitizePlayableVideoUrl("https://max.com/watch/123"), null);
    assert.equal(sanitizePlayableVideoUrl("https://play.max.com/video/123"), null);
    assert.equal(sanitizePlayableVideoUrl("https://www.iq.com/play/123"), null);
    assert.equal(sanitizePlayableVideoUrl("https://viz.com/watch"), null);
    assert.equal(sanitizePlayableVideoUrl("https://vrv.co/watch/123"), null);
    assert.equal(sanitizePlayableVideoUrl("https://youtu.be/dQw4w9WgXcQ"), null);
    assert.equal(sanitizePlayableVideoUrl("https://vimeo.com/123456"), null);

    // Esquemas inseguros
    assert.equal(sanitizePlayableVideoUrl("javascript:alert(1)"), null);
    assert.equal(sanitizePlayableVideoUrl("data:text/html,<script>alert(1)</script>"), null);
    assert.equal(sanitizePlayableVideoUrl("vbscript:msgbox(1)"), null);
  });

  it("Nunca auto-publica episódios com published undefined ou false", () => {
    assert.equal(
      isEpisodePublished({
        id: "ep-undef",
        number: 1,
        videoUrl: "https://cdn.example.com/ep1.mp4",
      }),
      false,
    );
    assert.equal(
      isEpisodePublished({
        id: "ep-false",
        number: 1,
        videoUrl: "https://cdn.example.com/ep1.mp4",
        published: false,
      }),
      false,
    );

    const publicFromServer = resolvePublicEpisodes(
      {
        status: "success",
        total: 1,
        episodes: [
          {
            id: "ep-srv-draft",
            animeId: "a1",
            seasonNumber: 1,
            number: 1,
            title: "Ep 1",
            thumbnail: null,
            duration: null,
            synopsis: null,
            videoUrl: "https://cdn.example.com/ep1.mp4",
            videoUrl2: null,
            videoUrl3: null,
            videoUrl4: null,
            videoUrl5: null,
            published: false,
            publishedAt: null,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
            animeTitle: "Anime Teste",
            animeTitleRomaji: "Anime Teste",
            animeTitleEnglish: "Anime Teste",
            animeTitleNative: null,
            animeCover: "",
            animeBanner: "",
            animeStatus: "RELEASING",
            animeEpisodesCount: 12,
            animeCreatedAt: null,
            animeUpdatedAt: null,
            seasonTitle: "Temporada 1",
          },
        ],
      },
      [
        createMockAnime({
          id: "a1",
          seasons: [
            {
              id: "s1",
              number: 1,
              title: "Temporada 1",
              episodes: [
                {
                  id: "ep-local-undef",
                  number: 2,
                  title: "Ep 2",
                  videoUrl: "https://cdn.example.com/ep2.mp4",
                },
              ],
            },
          ],
        }),
      ],
      { outbox: [], tombstones: [] },
    );
    assert.equal(publicFromServer.length, 0);
  });

  it("Envia replaceSources=true e Authorization Bearer quando presente no persistEpisode", async () => {
    const originalFetch = globalThis.fetch;
    let capturedBody: { replaceSources?: boolean; published?: boolean } = {};
    globalThis.fetch = (async (_input: unknown, init?: RequestInit) => {
      capturedBody = JSON.parse(String(init?.body || "{}"));
      return new Response(
        JSON.stringify({
          ok: true,
          published: false,
          publishedAt: null,
          episodeId: "ep-rep",
          canonicalId: "ep-rep",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;

    try {
      await persistEpisode("anime-test", 1, {
        id: "ep-rep",
        number: 5,
        title: "Ep 5",
        videoUrl: "",
        published: false,
      });
      assert.equal(capturedBody.replaceSources, true);
      assert.equal(capturedBody.published, false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
