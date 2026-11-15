import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getRecentEpisodesSection,
  getAllPublishedEpisodes,
  isPersistablePlayableVideoUrl,
  sanitizePlayableVideoUrl,
  isEpisodePublished,
  resolvePublicEpisodes,
  hasEpisodePlayableSource,
  sanitizeEpisodeThumbnailUrl,
  resolveEpisodeThumbnailUrl,
} from "./published-episodes";
import { persistEpisode } from "./episode-writer";
import { mergeAdminEpisodesWithServer } from "./catalog-episodes";
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

describe("Imagem manual do episódio (Episode.thumbnail) e prioridade", () => {
  it("Sanitiza URLs válidas de imagem e rejeita esquemas inseguros ou vazios", () => {
    assert.equal(
      sanitizeEpisodeThumbnailUrl("  https://cdn.example.com/thumbs/ep1.jpg  "),
      "https://cdn.example.com/thumbs/ep1.jpg",
    );
    assert.equal(
      sanitizeEpisodeThumbnailUrl("http://media.example.com/ep2.webp"),
      "http://media.example.com/ep2.webp",
    );
    assert.equal(
      sanitizeEpisodeThumbnailUrl("//media.kitsu.app/ep1.jpg"),
      "https://media.kitsu.app/ep1.jpg",
    );
    assert.equal(
      sanitizeEpisodeThumbnailUrl("/images/ep3.png"),
      "/images/ep3.png",
    );
    assert.equal(
      sanitizeEpisodeThumbnailUrl("data:image/jpeg;base64,/9j/4AAQSkZJRg=="),
      "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
    );

    assert.equal(sanitizeEpisodeThumbnailUrl(""), null);
    assert.equal(sanitizeEpisodeThumbnailUrl("   "), null);
    assert.equal(sanitizeEpisodeThumbnailUrl(null), null);
    assert.equal(sanitizeEpisodeThumbnailUrl("javascript:alert(1)"), null);
    assert.equal(sanitizeEpisodeThumbnailUrl("vbscript:msgbox(1)"), null);
    assert.equal(sanitizeEpisodeThumbnailUrl("blob:https://example.com/123"), null);
    assert.equal(
      sanitizeEpisodeThumbnailUrl("data:image/svg+xml;base64,PHN2Zz48L3N2Zz4="),
      null,
    );
    assert.equal(sanitizeEpisodeThumbnailUrl("data:text/html,<script>1</script>"), null);
  });

  it("Respeita prioridade: 1) manual, 2) automática do vídeo, 3) undefined (fallback padrão)", () => {
    // Prioridade 1: imagem manual vence YouTube e Cloudinary
    assert.equal(
      resolveEpisodeThumbnailUrl({
        thumbnail: "https://cdn.example.com/manual-ep1.jpg",
        videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
        videoUrl2: "https://res.cloudinary.com/demo/video/upload/sample.mp4",
      }),
      "https://cdn.example.com/manual-ep1.jpg",
    );

    // Prioridade 2: sem imagem manual, usa captura automática do YouTube/Cloudinary
    assert.equal(
      resolveEpisodeThumbnailUrl({
        thumbnail: "",
        videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      }),
      "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    );
    assert.equal(
      resolveEpisodeThumbnailUrl({
        thumbnail: null,
        videoUrl: "https://cdn.example.com/ep.mp4",
        videoUrl2: "https://res.cloudinary.com/demo/video/upload/v1/ep2.mp4",
      }),
      "https://res.cloudinary.com/demo/video/upload/so_15,w_640,c_scale/v1/ep2.jpg",
    );

    // Prioridade 3: sem imagem manual e sem auto-thumbnail, retorna undefined para fallback do Hikari
    assert.equal(
      resolveEpisodeThumbnailUrl({
        thumbnail: "   ",
        videoUrl: "https://cdn.example.com/ep3.mp4",
      }),
      undefined,
    );
  });

  it("persistEpisode envia thumbnail manual e só envia replaceThumbnail=true quando explicitamente alterado ou limpo", async () => {
    const originalFetch = globalThis.fetch;
    const sentPayloads: Array<{
      thumbnail?: string | null;
      replaceSources?: boolean;
      replaceThumbnail?: boolean;
    }> = [];
    globalThis.fetch = (async (_input: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body || "{}"));
      sentPayloads.push(body);
      return new Response(
        JSON.stringify({
          ok: true,
          published: Boolean(body.published),
          publishedAt: null,
          episodeId: body.id,
          canonicalId: body.id,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;

    try {
      await persistEpisode("anime-test", 1, {
        id: "ep-thumb-set",
        number: 1,
        title: "Ep 1",
        thumbnail: "  https://cdn.example.com/thumb-1.jpg  ",
        videoUrl: "https://cdn.example.com/ep1.mp4",
        published: true,
      }, undefined, { replaceThumbnail: true });

      await persistEpisode("anime-test", 1, {
        id: "ep-thumb-untouched",
        number: 2,
        title: "Ep 2",
        thumbnail: undefined,
        videoUrl: "https://cdn.example.com/ep2.mp4",
        published: true,
      });

      await persistEpisode("anime-test", 1, {
        id: "ep-thumb-clear",
        number: 3,
        title: "Ep 3",
        thumbnail: "   ",
        videoUrl: "https://cdn.example.com/ep3.mp4",
        published: true,
      }, undefined, { replaceThumbnail: true });

      assert.equal(sentPayloads[0]?.thumbnail, "https://cdn.example.com/thumb-1.jpg");
      assert.equal(sentPayloads[0]?.replaceSources, true);
      assert.equal(sentPayloads[0]?.replaceThumbnail, true);

      assert.equal(sentPayloads[1]?.thumbnail, null);
      assert.equal(sentPayloads[1]?.replaceSources, true);
      assert.equal(sentPayloads[1]?.replaceThumbnail, false);

      assert.equal(sentPayloads[2]?.thumbnail, null);
      assert.equal(sentPayloads[2]?.replaceSources, true);
      assert.equal(sentPayloads[2]?.replaceThumbnail, true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("resolvePublicEpisodes mantém imagem manual por episódio e respeita limpeza pendente no Outbox", () => {
    const serverResult = {
      status: "success" as const,
      total: 2,
      episodes: [
        {
          id: "ep-1",
          animeId: "a1",
          seasonNumber: 1,
          number: 1,
          title: "Ep 1",
          thumbnail: "https://cdn.example.com/ep1-manual.jpg",
          duration: null,
          synopsis: null,
          videoUrl: "https://cdn.example.com/ep1.mp4",
          videoUrl2: null,
          videoUrl3: null,
          videoUrl4: null,
          videoUrl5: null,
          published: true,
          publishedAt: "2026-01-01T00:00:00.000Z",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          animeTitle: "Anime Teste",
          animeTitleRomaji: "Anime Teste",
          animeTitleEnglish: "Anime Teste",
          animeTitleNative: null,
          animeCover: "https://cdn.example.com/cover.jpg",
          animeBanner: "https://cdn.example.com/banner.jpg",
          animeStatus: "RELEASING",
          animeEpisodesCount: 12,
          animeCreatedAt: null,
          animeUpdatedAt: null,
          seasonTitle: "Temporada 1",
        },
        {
          id: "ep-2",
          animeId: "a1",
          seasonNumber: 1,
          number: 2,
          title: "Ep 2",
          thumbnail: "https://cdn.example.com/ep2-antiga.jpg",
          duration: null,
          synopsis: null,
          videoUrl: "https://cdn.example.com/ep2.mp4",
          videoUrl2: null,
          videoUrl3: null,
          videoUrl4: null,
          videoUrl5: null,
          published: true,
          publishedAt: "2026-01-02T00:00:00.000Z",
          createdAt: "2026-01-02T00:00:00.000Z",
          updatedAt: "2026-01-02T00:00:00.000Z",
          animeTitle: "Anime Teste",
          animeTitleRomaji: "Anime Teste",
          animeTitleEnglish: "Anime Teste",
          animeTitleNative: null,
          animeCover: "https://cdn.example.com/cover.jpg",
          animeBanner: "https://cdn.example.com/banner.jpg",
          animeStatus: "RELEASING",
          animeEpisodesCount: 12,
          animeCreatedAt: null,
          animeUpdatedAt: null,
          seasonTitle: "Temporada 1",
        },
      ],
    };

    // Sem outbox: preserva cada thumbnail em seu respectivo episódio
    const normal = resolvePublicEpisodes(serverResult, [], { outbox: [], tombstones: [] });
    const nEp1 = normal.find((e) => e.episodeId === "ep-1");
    const nEp2 = normal.find((e) => e.episodeId === "ep-2");
    assert.equal(nEp1?.thumbnail, "https://cdn.example.com/ep1-manual.jpg");
    assert.equal(nEp2?.thumbnail, "https://cdn.example.com/ep2-antiga.jpg");

    // Com upsert pendente no outbox sem replaceThumbnail=true, preserva a thumbnail existente no servidor
    const withPendingUntouched = resolvePublicEpisodes(serverResult, [], {
      outbox: [
        {
          opId: "op-untouched-2",
          type: "upsert",
          animeId: "a1",
          seasonNumber: 1,
          episodeNumber: 2,
          episodeId: "ep-2",
          status: "pending",
          attempts: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          payload: {
            id: "ep-2",
            animeId: "a1",
            seasonNumber: 1,
            number: 2,
            thumbnail: null,
            replaceThumbnail: false,
          },
        },
      ],
      tombstones: [],
    });
    const uEp2 = withPendingUntouched.find((e) => e.episodeId === "ep-2");
    assert.equal(uEp2?.thumbnail, "https://cdn.example.com/ep2-antiga.jpg");

    // Com limpeza pendente explícita (replaceThumbnail: true, thumbnail: null), não volta à thumbnail antiga do servidor
    const withPendingClear = resolvePublicEpisodes(serverResult, [], {
      outbox: [
        {
          opId: "op-clear-2",
          type: "upsert",
          animeId: "a1",
          seasonNumber: 1,
          episodeNumber: 2,
          episodeId: "ep-2",
          status: "pending",
          attempts: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          payload: {
            id: "ep-2",
            animeId: "a1",
            seasonNumber: 1,
            number: 2,
            thumbnail: null,
            replaceThumbnail: true,
          },
        },
      ],
      tombstones: [],
    });
    const cEp1 = withPendingClear.find((e) => e.episodeId === "ep-1");
    const cEp2 = withPendingClear.find((e) => e.episodeId === "ep-2");
    assert.equal(cEp1?.thumbnail, "https://cdn.example.com/ep1-manual.jpg");
    assert.equal(cEp2?.thumbnail, undefined);
  });

  it("mergeAdminEpisodesWithServer preserva thumbnail existente no servidor ou no local quando sincronizado", () => {
    const merged = mergeAdminEpisodesWithServer({
      animeId: "a1",
      localSeasons: [
        {
          id: "s-1",
          number: 1,
          title: "Temporada 1",
          episodes: [
            {
              id: "ep-1",
              number: 1,
              title: "Ep 1 Local",
              thumbnail: "https://cdn.example.com/ep1-local.jpg",
              videoUrl: "https://cdn.example.com/ep1.mp4",
              published: true,
            },
            {
              id: "ep-2",
              number: 2,
              title: "Ep 2 Local",
              videoUrl: "https://cdn.example.com/ep2.mp4",
              published: true,
            },
          ],
        },
      ],
      serverResult: {
        status: "success",
        animeId: "a1",
        seasons: [],
        episodes: [
          {
            id: "ep-1",
            animeId: "a1",
            seasonNumber: 1,
            number: 1,
            title: "Ep 1 Servidor",
            thumbnail: null,
            duration: null,
            synopsis: null,
            videoUrl: "https://cdn.example.com/ep1.mp4",
            videoUrl2: null,
            videoUrl3: null,
            videoUrl4: null,
            videoUrl5: null,
            published: true,
            publishedAt: "2026-01-01T00:00:00.000Z",
          },
          {
            id: "ep-2",
            animeId: "a1",
            seasonNumber: 1,
            number: 2,
            title: "Ep 2 Servidor",
            thumbnail: "https://cdn.example.com/ep2-server.jpg",
            duration: null,
            synopsis: null,
            videoUrl: "https://cdn.example.com/ep2.mp4",
            videoUrl2: null,
            videoUrl3: null,
            videoUrl4: null,
            videoUrl5: null,
            published: true,
            publishedAt: "2026-01-02T00:00:00.000Z",
          },
        ],
      },
      outboxOps: [],
    });

    const eps = merged.seasons[0]?.episodes || [];
    assert.equal(eps[0]?.thumbnail, "https://cdn.example.com/ep1-local.jpg");
    assert.equal(eps[1]?.thumbnail, "https://cdn.example.com/ep2-server.jpg");
  });
});
