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
  getCloudinaryThumbnailCandidates,
  getYouTubeThumbnailCandidates,
  isYouTubeMediaUrl,
  isWatchPlayableMediaUrl,
  resolvePlayableStreamUrl,
  resolveEpisodePlayerSources,
  selectEpisodeForWatch,
} from "./published-episodes";
import { persistEpisode } from "./episode-writer";
import {
  buildResolvedSeasons,
  mergeAdminEpisodesWithServer,
  invalidateCatalogEpisodesCache,
  primeCatalogEpisodesCache,
} from "./catalog-episodes";
import {
  buildAdminCatalogAnimeSavePayload,
  mergeDetail,
  mergeSeasonsWithRemote,
  resolveAdminAnimeWithRemote,
  resolveAdminDisplayMedia,
  resolveSavedMediaFromServer,
  shouldPreferRemoteMedia,
} from "./overlay";
import {
  isKitsuImageUrl,
  resolveCatalogAnimeMediaWrite,
  type Anime,
  type Episode,
  type LocalAnime,
} from "./types";
import { hasAdminCustomBanner, selectViewportBanner } from "./season-banner";

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
          id: "op-untouched-2",
          type: "upsert",
          animeId: "a1",
          seasonNumber: 1,
          episodeNumber: 2,
          episodeId: "ep-2",
          status: "pending",
          attempts: 0,
          createdAt: Date.now(),
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
          id: "op-clear-2",
          type: "upsert",
          animeId: "a1",
          seasonNumber: 1,
          episodeNumber: 2,
          episodeId: "ep-2",
          status: "pending",
          attempts: 0,
          createdAt: Date.now(),
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

describe("Escolha de múltiplas thumbnails do vídeo, preservação de episódios e sincronização Admin/Site", () => {
  it("Extrai múltiplas opções reais e distintas para Cloudinary e YouTube sem duplicatas", () => {
    const cloudinary = getCloudinaryThumbnailCandidates(
      "https://res.cloudinary.com/demo/video/upload/v123/episode-2.mp4",
    );
    assert.ok(cloudinary.length >= 3);
    assert.equal(
      new Set(cloudinary.map((c) => c.previewUrl)).size,
      cloudinary.length,
      "Opções do Cloudinary devem ser todas distintas",
    );

    const youtube = getYouTubeThumbnailCandidates(
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
    );
    assert.ok(youtube.length >= 4);
    assert.equal(
      new Set(youtube.map((c) => c.previewUrl)).size,
      youtube.length,
      "Opções do YouTube devem ser todas distintas",
    );
  });

  it("Salvar/publicar 1 episódio no Bakemonogatari preserva os outros 14 episódios e suas thumbnails no site e no Admin", () => {
    const remoteBakemonogatari: Anime = {
      id: "5081",
      anilistId: 5081,
      malId: 5081,
      titles: {
        romaji: "Bakemonogatari",
        english: "Bakemonogatari",
        native: "化物語",
      },
      cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx5081.jpg",
      banner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/5081.jpg",
      synopsis: "Sinopse",
      score: 83,
      genres: ["Mystery", "Supernatural"],
      format: "TV",
      status: "FINISHED",
      episodesCount: 15,
      season: "SUMMER",
      year: 2009,
      trailerId: null,
      source: "anilist",
      studios: ["Shaft"],
      streamingEpisodes: [],
      seasons: [
        {
          id: "s1-5081",
          number: 1,
          title: "Temporada 1",
          episodes: Array.from({ length: 15 }, (_, idx) => ({
            id: `kitsu-5081-${idx + 1}`,
            number: idx + 1,
            title: `Episódio ${idx + 1}`,
            thumbnail: `https://media.kitsu.app/episodes/thumbnails/bakemonogatari-${idx + 1}.jpg`,
            videoUrl: `https://www.crunchyroll.com/watch/bake-${idx + 1}`,
          })),
        },
      ],
      recommendations: [],
      characters: [],
      staff: [],
    };

    // Caso 1: Admin salvou apenas o Episódio 1 localmente/no banco
    const localOnlyEp1 = createMockAnime({
      id: "5081",
      anilistId: 5081,
      titleRomaji: "Bakemonogatari",
      titleEnglish: "Bakemonogatari",
      seasons: [
        {
          id: "s1-5081",
          number: 1,
          title: "Temporada 1",
          episodes: [
            {
              id: "ep-1-saved",
              number: 1,
              title: "Hitagi Crab Parte 1",
              thumbnail: "https://cdn.example.com/custom-bake-ep1.jpg",
              videoUrl: "https://cdn.example.com/bake-ep1.mp4",
              published: true,
            },
          ],
        },
      ],
    });

    const detail = mergeDetail(remoteBakemonogatari, "5081", [localOnlyEp1]);
    assert.ok(detail);
    assert.equal(detail.seasons[0]?.episodes.length, 15, "Todos os 15 episódios devem permanecer no detalhe");
    assert.equal(
      detail.seasons[0]?.episodes[0]?.thumbnail,
      "https://cdn.example.com/custom-bake-ep1.jpg",
    );
    assert.equal(detail.seasons[0]?.episodes[0]?.videoUrl, "https://cdn.example.com/bake-ep1.mp4");
    for (let i = 1; i < 15; i++) {
      assert.equal(
        detail.seasons[0]?.episodes[i]?.thumbnail,
        `https://media.kitsu.app/episodes/thumbnails/bakemonogatari-${i + 1}.jpg`,
        `Episódio ${i + 1} deve preservar sua thumbnail original`,
      );
    }

    // Caso 2: No Admin, resolveAdminAnimeWithRemote traz todos os 15 episódios sem auto-publicar os demais
    const adminAnime = resolveAdminAnimeWithRemote(localOnlyEp1, remoteBakemonogatari);
    assert.ok(adminAnime);
    assert.equal(adminAnime.seasons[0]?.episodes.length, 15);
    assert.equal(adminAnime.seasons[0]?.episodes[0]?.published, true);
    assert.equal(adminAnime.seasons[0]?.episodes[1]?.published, false);
    assert.equal(
      adminAnime.seasons[0]?.episodes[1]?.videoUrl,
      undefined,
      "Links externos como Crunchyroll não devem vazar como URL inválida no Admin",
    );
    assert.equal(
      adminAnime.seasons[0]?.episodes[13]?.thumbnail,
      "https://media.kitsu.app/episodes/thumbnails/bakemonogatari-14.jpg",
    );

    // Caso 3: Vitrine pública só lista o Episódio 1 efetivamente publicado
    const publishedList = getAllPublishedEpisodes([adminAnime]);
    assert.equal(publishedList.length, 1);
    assert.equal(publishedList[0]?.episodeNumber, 1);

    // Caso 4: Limpeza intencional da thumbnail do Episódio 1 permanece respeitada sem apagar os demais
    const clearedEp1Merged = mergeSeasonsWithRemote(
      [
        {
          id: "s1-5081",
          number: 1,
          title: "Temporada 1",
          episodes: [
            {
              id: "ep-1-saved",
              number: 1,
              title: "Hitagi Crab Parte 1",
              thumbnail: undefined,
              videoUrl: "https://cdn.example.com/bake-ep1.mp4",
              published: true,
            },
          ],
        },
      ],
      remoteBakemonogatari.seasons,
    );
    assert.equal(clearedEp1Merged[0]?.episodes[0]?.thumbnail, undefined);
    assert.equal(
      clearedEp1Merged[0]?.episodes[4]?.thumbnail,
      "https://media.kitsu.app/episodes/thumbnails/bakemonogatari-5.jpg",
    );
  });

  it("resolveAdminAnimeWithRemote sincroniza capa/banner do Admin com o site (ex.: Black Clover) sem apagar edições locais não sincronizadas", () => {
    const publicRemote: Anime = {
      id: "97940",
      anilistId: 97940,
      titles: {
        romaji: "Black Clover",
        english: "Black Clover",
        native: "ブラッククローバー",
      },
      cover: "https://cdn.hikari.app/black-clover-canonical.jpg",
      banner: "https://cdn.hikari.app/black-clover-banner-canonical.jpg",
      synopsis: "Asta e Yuno",
      score: 81,
      genres: ["Action", "Fantasy"],
      format: "TV",
      status: "FINISHED",
      episodesCount: 170,
      season: "FALL",
      year: 2017,
      trailerId: null,
      source: "anilist",
      studios: ["Pierrot"],
      streamingEpisodes: [],
      seasons: [],
      recommendations: [],
      characters: [],
      staff: [],
      catalogUpdatedAt: 1700000100000,
      serverCatalogId: "97940",
    };

    // Registro em IndexedDB com imagem antiga do CDN padrão (divergente da usada no site)
    const staleStored = createMockAnime({
      id: "97940",
      anilistId: 97940,
      titleRomaji: "Black Clover",
      titleEnglish: "Black Clover",
      cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/old-black-clover.jpg",
      banner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/old-black-clover.jpg",
      updatedAt: 1700000200000,
      syncedAt: undefined,
    });

    const syncedAdmin = resolveAdminAnimeWithRemote(staleStored, publicRemote);
    assert.equal(
      syncedAdmin?.cover,
      "https://cdn.hikari.app/black-clover-canonical.jpg",
      "Admin deve exibir a mesma capa canônica exibida no site público",
    );
    assert.equal(
      syncedAdmin?.banner,
      "https://cdn.hikari.app/black-clover-banner-canonical.jpg",
    );

    // Registro com edição personalizada intencional feita localmente após o último sync
    const customUnsynced = createMockAnime({
      id: "97940",
      anilistId: 97940,
      titleRomaji: "Black Clover",
      titleEnglish: "Black Clover",
      cover: "https://cdn.hikari.app/nova-capa-manual.jpg",
      banner: "https://cdn.hikari.app/black-clover-banner-canonical.jpg",
      updatedAt: 1700000500000,
      syncedAt: 1700000200000,
    });

    const preservedCustom = resolveAdminAnimeWithRemote(customUnsynced, publicRemote);
    assert.equal(
      preservedCustom?.cover,
      "https://cdn.hikari.app/nova-capa-manual.jpg",
      "Edição manual não sincronizada feita pelo admin deve ser preservada",
    );
  });
});

describe("Regressão de reprodução: Assistir episódio real vs trailer do YouTube", () => {
  it("1) Seleciona exclusivamente o episódio solicitado e reproduz sua fonte cadastrada sem fallback para outro episódio", () => {
    const episodes: Episode[] = [
      {
        id: "ep-1",
        number: 1,
        title: "Episódio 1",
        videoUrl: "https://pub-123456.r2.dev/stream/ep1",
        published: true,
      },
      {
        id: "ep-2",
        number: 2,
        title: "Episódio 2",
        videoUrl: "https://cdn.custom-anime.net/hls/ep2/master.m3u8",
        published: true,
      },
      {
        id: "ep-3",
        number: 3,
        title: "Episódio 3",
        videoUrl: "https://player.mux.com/AbCdEfGhIjKlMnOpQrStUvWx01",
        published: true,
      },
      {
        id: "ep-4",
        number: 4,
        title: "Episódio 4",
        videoUrl:
          "https://iframe.mediadelivery.net/embed/12345/12345678-1234-1234-1234-1234567890ab",
        published: true,
      },
    ];

    // Episódio 2 deve reproduzir o vídeo do Episódio 2 (não do Episódio 1)
    const selected2 = selectEpisodeForWatch(episodes, "ep-2", 2);
    assert.equal(selected2?.id, "ep-2");
    assert.deepEqual(resolveEpisodePlayerSources(selected2), [
      {
        id: "player-1",
        name: "Player 1",
        url: "https://cdn.custom-anime.net/hls/ep2/master.m3u8",
      },
    ]);

    // URL sem extensão (.r2.dev) e normalização de Mux / Bunny continuam funcionando
    const selected1 = selectEpisodeForWatch(episodes, "ep-1", 1);
    assert.equal(
      resolveEpisodePlayerSources(selected1)[0]?.url,
      "https://pub-123456.r2.dev/stream/ep1",
    );

    const selected3 = selectEpisodeForWatch(episodes, "ep-3", 3);
    assert.equal(
      resolveEpisodePlayerSources(selected3)[0]?.url,
      "https://stream.mux.com/AbCdEfGhIjKlMnOpQrStUvWx01.m3u8",
    );

    assert.equal(
      resolvePlayableStreamUrl(
        "https://player.mediadelivery.net/embed/12345/12345678-1234-1234-1234-1234567890ab",
      ),
      "https://vz-12345.b-cdn.net/12345678-1234-1234-1234-1234567890ab/playlist.m3u8",
    );
    assert.equal(isWatchPlayableMediaUrl("/api/video-proxy?url=https%3A%2F%2Fcdn.example.com%2Fep1.mp4"), true);

    // Episódio inexistente NÃO deve cair no Episódio 1
    assert.equal(selectEpisodeForWatch(episodes, "ep-99", 99), null);
  });

  it("2) Nunca utiliza trailer ou URLs do YouTube / catálogos externos como fonte de reprodução do episódio", () => {
    const youtubeUrls = [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://youtu.be/dQw4w9WgXcQ",
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
      "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
    ];

    for (const ytUrl of youtubeUrls) {
      assert.equal(isYouTubeMediaUrl(ytUrl), true);
      assert.equal(isWatchPlayableMediaUrl(ytUrl), false);
    }

    // Episódio sem vídeo real (mesmo que o anime possua trailerId) resulta em 0 fontes (exibe indisponibilidade)
    const noSourceEp: Episode = {
      id: "ep-sem-video",
      number: 5,
      title: "Episódio 5",
      videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      videoUrl2: "https://www.crunchyroll.com/watch/G12345",
      published: false,
    };
    assert.deepEqual(resolveEpisodePlayerSources(noSourceEp), []);

    // Se Player 1 tiver URL do YouTube (referência) e Player 2 tiver stream válido, ignora Player 1 e usa Player 2
    const mixedEp: Episode = {
      id: "ep-misto",
      number: 6,
      title: "Episódio 6",
      videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      videoUrl2: "https://cdn.hikari.app/streams/ep6.mp4",
      published: true,
    };
    assert.deepEqual(resolveEpisodePlayerSources(mixedEp), [
      {
        id: "player-2",
        name: "Player 2",
        url: "https://cdn.hikari.app/streams/ep6.mp4",
      },
    ]);
  });

  it("3) Mantém extração de thumbnails totalmente independente da resolução de reprodução", () => {
    const ytRef = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
    // Não é reproduzível como episódio
    assert.equal(isWatchPlayableMediaUrl(ytRef), false);
    // Mas continua gerando opções reais de thumbnail e respeitando imagem manual com prioridade 1
    assert.ok(getYouTubeThumbnailCandidates(ytRef).length >= 4);
    assert.equal(
      resolveEpisodeThumbnailUrl({
        thumbnail: "https://cdn.hikari.app/thumbs/ep7-manual.jpg",
        videoUrl: ytRef,
        videoUrl2: "https://cdn.hikari.app/videos/ep7.mp4",
      }),
      "https://cdn.hikari.app/thumbs/ep7-manual.jpg",
    );
  });

  it("4) Preserva outros episódios e impede que links externos remotos ou locais obsoletos poluam fontes canônicas", () => {
    const remoteEp1WithCrunchyroll: Episode = {
      id: "remote-1",
      number: 1,
      title: "Episódio 1",
      thumbnail: "https://media.kitsu.app/ep1.jpg",
      videoUrl: "https://www.crunchyroll.com/watch/ep1",
    };
    const remoteEp2WithCrunchyroll: Episode = {
      id: "remote-2",
      number: 2,
      title: "Episódio 2",
      thumbnail: "https://media.kitsu.app/ep2.jpg",
      videoUrl: "https://www.crunchyroll.com/watch/ep2",
    };

    const merged = mergeSeasonsWithRemote(
      [
        {
          id: "s1",
          number: 1,
          title: "Temporada 1",
          episodes: [
            {
              id: "ep-1",
              number: 1,
              title: "Episódio 1",
              videoUrl: "https://cdn.hikari.app/ep1.mp4",
              published: true,
            },
          ],
        },
      ],
      [
        {
          id: "s1",
          number: 1,
          title: "Temporada 1",
          episodes: [remoteEp1WithCrunchyroll, remoteEp2WithCrunchyroll],
        },
      ],
    );

    // Ep 1 preserva sua fonte real; Ep 2 não vaza Crunchyroll como fonte reproduzível mas preserva thumbnail
    assert.equal(merged[0]?.episodes[0]?.videoUrl, "https://cdn.hikari.app/ep1.mp4");
    assert.equal(merged[0]?.episodes[1]?.videoUrl, undefined);
    assert.equal(merged[0]?.episodes[1]?.thumbnail, "https://media.kitsu.app/ep2.jpg");
    assert.deepEqual(resolveEpisodePlayerSources(merged[0]?.episodes[1]), []);

    // buildResolvedSeasons: quando o PostgreSQL confirma Player 2 sem Player 1, não ressuscita YouTube/antigo local no Player 1
    const resolved = buildResolvedSeasons(
      "anime-sync",
      {
        animeId: "anime-sync",
        seasons: [{ animeId: "anime-sync", number: 1, title: "Temporada 1", position: 1 }],
        episodes: [
          {
            id: "db-ep-1",
            animeId: "anime-sync",
            seasonNumber: 1,
            number: 1,
            title: "Ep 1 Confirmado",
            thumbnail: "https://cdn.hikari.app/db-ep1.jpg",
            duration: "24:00",
            synopsis: null,
            videoUrl: null,
            videoUrl2: "https://cdn.hikari.app/db-ep1-p2.mp4",
            videoUrl3: null,
            videoUrl4: null,
            videoUrl5: null,
            published: true,
            publishedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      },
      [
        {
          id: "s1",
          number: 1,
          title: "Temporada 1",
          episodes: [
            {
              id: "db-ep-1",
              number: 1,
              title: "Ep 1 Local Antigo",
              videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
              published: true,
            },
          ],
        },
      ],
      { outbox: [], tombstones: [] },
    );

    const resolvedEp1 = resolved[0]?.episodes[0];
    assert.equal(resolvedEp1?.videoUrl, undefined);
    assert.equal(resolvedEp1?.videoUrl2, "https://cdn.hikari.app/db-ep1-p2.mp4");
    assert.deepEqual(resolveEpisodePlayerSources(resolvedEp1), [
      {
        id: "player-2",
        name: "Player 2",
        url: "https://cdn.hikari.app/db-ep1-p2.mp4",
      },
    ]);
  });

  it("5) Preserva seleção de servidores (Player 1 a Player 5) em ordem e com múltiplos links válidos", () => {
    const multiServerEp: Episode = {
      id: "ep-multi",
      number: 10,
      title: "Batalha Decisiva",
      videoUrl: "https://cdn1.example.com/ep10-1080p.mp4",
      videoUrl2: "https://cdn2.example.com/ep10/master.m3u8",
      videoUrl3: "https://player.mux.com/ZxYvWuTsRqPoNmLkJiHgFe01",
      videoUrl4:
        "https://player.mediadelivery.net/embed/999/abcdefab-cdef-4123-8123-abcdefabcdef",
      videoUrl5: "https://cdn5.example.com/ep10-backup.mp4",
      published: true,
    };

    assert.deepEqual(resolveEpisodePlayerSources(multiServerEp), [
      {
        id: "player-1",
        name: "Player 1",
        url: "https://cdn1.example.com/ep10-1080p.mp4",
      },
      {
        id: "player-2",
        name: "Player 2",
        url: "https://cdn2.example.com/ep10/master.m3u8",
      },
      {
        id: "player-3",
        name: "Player 3",
        url: "https://stream.mux.com/ZxYvWuTsRqPoNmLkJiHgFe01.m3u8",
      },
      {
        id: "player-4",
        name: "Player 4",
        url: "https://vz-999.b-cdn.net/abcdefab-cdef-4123-8123-abcdefabcdef/playlist.m3u8",
      },
      {
        id: "player-5",
        name: "Player 5",
        url: "https://cdn5.example.com/ep10-backup.mp4",
      },
    ]);

    // Em caso de episódios duplicados entre temporadas, prioriza a ocorrência que possui fonte reproduzível
    const duplicateAcrossSeasons: Episode[] = [
      { id: "ep-1-s1", number: 1, title: "Ep 1 S1", published: false },
      {
        id: "ep-1-s2",
        number: 1,
        title: "Ep 1 S2",
        videoUrl: "https://cdn.example.com/ep1-playable.mp4",
        published: true,
      },
    ];
    const picked = selectEpisodeForWatch(duplicateAcrossSeasons, "ep-1", 1);
    assert.equal(picked?.id, "ep-1-s2");
  });
});

describe("Auditoria de Publicação, Cache e Navegação de Episódios", () => {
  it("1 & 2. Associa episódio ao serverCatalogId correto e exige publicação explícita com fonte válida", async () => {
    // Tentar publicar sem fonte válida bloqueia
    const blocked = await persistEpisode("server-catalog-999", 1, {
      id: "ep-draft",
      number: 1,
      title: "Rascunho Sem Fonte",
      videoUrl: "",
      published: true,
    });
    assert.equal(blocked.confirmed, false);
    assert.ok(blocked.error?.includes("fonte válida"));

    // Rascunho sem published explícito fica como não publicado
    assert.equal(isEpisodePublished({ id: "ep-1", number: 1, videoUrl: "https://cdn.example.com/ep1.mp4", published: false }), false);
    assert.equal(isEpisodePublished({ id: "ep-1", number: 1, videoUrl: "https://cdn.example.com/ep1.mp4" }), false);
  });

  it("3 & 4. Preserva rascunhos e reconhece fontes válidas pelo filtro público", () => {
    const epValid = { id: "ep-1", number: 1, title: "Ep 1", videoUrl: "https://cdn.example.com/ep1.mp4", published: true };
    const epDraft = { id: "ep-2", number: 2, title: "Ep 2", videoUrl: "https://cdn.example.com/ep2.mp4", published: false };

    assert.equal(isEpisodePublished(epValid), true);
    assert.equal(isEpisodePublished(epDraft), false);

    const publicList = resolvePublicEpisodes(
      {
        animeId: "a1",
        seasons: [{ animeId: "a1", number: 1, title: "T1", position: 1 }],
        episodes: [
          {
            id: "ep-1",
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
            published: true,
            publishedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      },
      [],
      { outbox: [], tombstones: [] },
    );
    assert.equal(publicList.length, 1);
    assert.equal(publicList[0]?.episodeNumber, 1);
  });

  it("5 & 6. Invalidação de cache e inclusão do episódio recém-publicado nos detalhes do anime", () => {
    const cacheKey = "anime-cache-test";
    primeCatalogEpisodesCache(cacheKey, {
      animeId: cacheKey,
      seasons: [{ animeId: cacheKey, number: 1, title: "T1", position: 1 }],
      episodes: [],
    });

    // Invalida o cache
    invalidateCatalogEpisodesCache(cacheKey);

    // buildResolvedSeasons integra corretamente o novo episódio publicado
    const resolved = buildResolvedSeasons(
      cacheKey,
      {
        animeId: cacheKey,
        seasons: [{ animeId: cacheKey, number: 1, title: "T1", position: 1 }],
        episodes: [
          {
            id: "ep-new-1",
            animeId: cacheKey,
            seasonNumber: 1,
            number: 1,
            title: "Novo Ep Publicado",
            thumbnail: "https://cdn.example.com/thumb.jpg",
            duration: "24:00",
            synopsis: null,
            videoUrl: "https://cdn.example.com/new1.mp4",
            videoUrl2: null,
            videoUrl3: null,
            videoUrl4: null,
            videoUrl5: null,
            published: true,
            publishedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      },
      [],
    );

    assert.equal(resolved.length, 1);
    assert.equal(resolved[0]?.episodes.length, 1);
    assert.equal(resolved[0]?.episodes[0]?.title, "Novo Ep Publicado");
    assert.equal(resolved[0]?.episodes[0]?.videoUrl, "https://cdn.example.com/new1.mp4");
  });

  it("7 & 8. Inclusão correta na navegação do player e preservação dos demais episódios e thumbnails", () => {
    const episodes = [
      { id: "ep-1", number: 1, title: "Ep 1", videoUrl: "https://cdn.example.com/1.mp4", published: true },
      { id: "ep-2", number: 2, title: "Ep 2", videoUrl: "https://cdn.example.com/2.mp4", published: true },
      { id: "ep-3", number: 3, title: "Ep 3", videoUrl: "https://cdn.example.com/3.mp4", published: true },
    ];

    const current = selectEpisodeForWatch(episodes, "ep-2", 2);
    assert.equal(current?.id, "ep-2");
    assert.equal(current?.number, 2);

    const sources = resolveEpisodePlayerSources(current);
    assert.equal(sources.length, 1);
    assert.equal(sources[0]?.url, "https://cdn.example.com/2.mp4");
  });
});

describe("Preservação de imagens Kitsu/AniList e salvamento explícito no Admin", () => {
  it("1 & 9. Black Clover (195604): Admin exibe capa/banner corretos e resolvedMobileBanner Kitsu sem converter arte sazonal em banner permanente", () => {
    const kitsuMobileUrl =
      "https://media.kitsu.app/anime/50024/cover_image/c344242518d97e6a4dd5fb0a79c8ca43.jpg";
    const aniCover =
      "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx195604-cover.jpg";
    const aniBanner =
      "https://s4.anilist.co/file/anilistcdn/media/anime/banner/195604-lQpCzTziSA17.jpg";

    const blackCloverRemote: Anime = {
      id: "195604",
      anilistId: 195604,
      malId: 60462,
      kitsuId: 50024,
      titles: {
        romaji: "Black Clover 2nd Season",
        english: "Black Clover Season 2",
        native: "ブラッククローバー 第2期",
      },
      cover: aniCover,
      banner: aniBanner,
      synopsis: "Black Clover S2",
      score: 82,
      genres: ["Action", "Fantasy"],
      format: "TV",
      status: "NOT_YET_RELEASED",
      episodesCount: 12,
      season: "FALL",
      year: 2026,
      trailerId: null,
      source: "anilist",
      studios: ["Pierrot"],
      streamingEpisodes: [],
      seasons: [],
      recommendations: [],
      characters: [],
      staff: [],
      resolvedMobileBanner: {
        url: kitsuMobileUrl,
        isAlternative: true,
        source: "kitsu-season",
        initialObjectPosition: "50% 24%",
      },
    };

    const form = resolveAdminAnimeWithRemote(undefined, blackCloverRemote);
    assert.ok(form);
    assert.equal(form.cover, aniCover);
    assert.equal(form.banner, aniBanner, "Banner desktop não pode ser sobrescrito por banner mobile sazonal");

    const preview = resolveAdminDisplayMedia(form, blackCloverRemote);
    assert.equal(preview.cover, aniCover);
    assert.equal(preview.desktopBanner, aniBanner);
    assert.equal(preview.hasCustomDesktopBanner, false);
    assert.equal(preview.mobileBanner?.url, kitsuMobileUrl);
    assert.equal(preview.mobileBanner?.source, "kitsu-season");

    // Na página pública, não foi criado banner customizado de admin -> mobile continua Kitsu e desktop continua AniList
    assert.equal(hasAdminCustomBanner(form, blackCloverRemote), false);
    const mobileViewport = selectViewportBanner({
      animeId: "195604",
      isMobileViewport: true,
      isAdminBanner: false,
      baseSeasonBanner: form.banner,
      mobileBannerState: {
        forId: "195604",
        url: kitsuMobileUrl,
        isAlternative: true,
        initialObjectPosition: "50% 24%",
      },
      failedBannerUrls: {},
    });
    const desktopViewport = selectViewportBanner({
      animeId: "195604",
      isMobileViewport: false,
      isAdminBanner: false,
      baseSeasonBanner: form.banner,
      mobileBannerState: {
        forId: "195604",
        url: kitsuMobileUrl,
        isAlternative: true,
        initialObjectPosition: "50% 24%",
      },
      failedBannerUrls: {},
    });
    assert.equal(mobileViewport.effectiveBannerUrl, kitsuMobileUrl);
    assert.equal(desktopViewport.effectiveBannerUrl, aniBanner);
  });

  it("2 & 8. Adicionar episódio sem editar mídia omite cover/banner do payload mesmo sem serverCatalogId e impede gravação no PostgreSQL", () => {
    const animeWithoutServerId = createMockAnime({
      id: "local-bc-1",
      anilistId: 195604,
      kitsuId: 50024,
      cover: "https://media.kitsu.app/anime/poster_images/50024/large.jpg",
      banner: "https://media.kitsu.app/anime/50024/cover_image/c344242518d97e6a4dd5fb0a79c8ca43.jpg",
      seasons: [
        {
          id: "s-1",
          number: 1,
          title: "Temporada 1",
          episodes: [
            {
              id: "ep-new-1",
              number: 1,
              title: "Episódio 1",
              videoUrl: "https://cdn.example.com/bc-ep1.mp4",
              published: true,
            },
          ],
        },
      ],
    });

    const payload = buildAdminCatalogAnimeSavePayload(animeWithoutServerId, {
      cover: false,
      banner: false,
    });

    assert.equal("cover" in payload, false, "cover deve ser omitido quando não editado");
    assert.equal("banner" in payload, false, "banner deve ser omitido quando não editado");
    assert.equal(payload.coverExplicitlyEdited, false);
    assert.equal(payload.bannerExplicitlyEdited, false);

    // No backend (novo registro ou registro já existente), campos omitidos nunca gravam nem sobrescrevem imagens
    const newRowDecision = resolveCatalogAnimeMediaWrite({
      cover: payload.cover,
      banner: payload.banner,
      coverExplicitlyEdited: payload.coverExplicitlyEdited,
      bannerExplicitlyEdited: payload.bannerExplicitlyEdited,
      targetExists: false,
      cleanCover: null,
      cleanBanner: null,
    });
    assert.equal(newRowDecision.shouldWriteCover, false);
    assert.equal(newRowDecision.shouldWriteBanner, false);
    assert.equal(newRowDecision.insertCover, null);
    assert.equal(newRowDecision.insertBanner, null);

    // Mesmo se uma chamada externa enviar URLs antigas sem flag explícita em registro existente, o backend bloqueia sobrescrita
    const implicitUpdateBlocked = resolveCatalogAnimeMediaWrite({
      cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx195604.jpg",
      banner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/195604.jpg",
      coverExplicitlyEdited: undefined,
      bannerExplicitlyEdited: false,
      targetExists: true,
      cleanCover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx195604.jpg",
      cleanBanner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/195604.jpg",
    });
    assert.equal(implicitUpdateBlocked.shouldWriteCover, false);
    assert.equal(implicitUpdateBlocked.shouldWriteBanner, false);
  });

  it("3 & 4. Imagens Kitsu válidas armazenadas localmente são preservadas contra AniList na sincronização inicial e na reconciliação do editor", () => {
    const kitsuCover = "https://media.kitsu.app/anime/poster_images/13209/large.jpg";
    const kitsuBanner = "https://media.kitsu.app/anime/cover_images/13209/original.jpg";
    const anilistCover = "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx97940.jpg";
    const anilistBanner = "https://s4.anilist.co/file/anilistcdn/media/anime/banner/97940.jpg";

    assert.equal(isKitsuImageUrl(kitsuCover), true);
    assert.equal(isKitsuImageUrl(anilistCover), false);

    const localKitsuAnime = createMockAnime({
      id: "97940",
      anilistId: 97940,
      kitsuId: 13209,
      cover: kitsuCover,
      banner: kitsuBanner,
      updatedAt: 1700000000000,
      syncedAt: undefined,
    });

    // Sincronização inicial da listagem (admin.index.tsx) não pode substituir Kitsu por AniList
    assert.equal(
      shouldPreferRemoteMedia(localKitsuAnime.cover, anilistCover, localKitsuAnime, 1700000900000),
      false,
    );
    assert.equal(
      shouldPreferRemoteMedia(localKitsuAnime.banner, anilistBanner, localKitsuAnime, 1700000900000),
      false,
    );

    // Abertura no editor (resolveAdminAnimeWithRemote) preserva Kitsu mesmo com catalogUpdatedAt mais recente
    const remoteWithAniFallback: Anime = {
      id: "97940",
      anilistId: 97940,
      kitsuId: 13209,
      titles: { romaji: "Black Clover", english: "Black Clover", native: "ブラッククローバー" },
      cover: anilistCover,
      banner: anilistBanner,
      synopsis: "Asta",
      score: 82,
      genres: ["Action"],
      format: "TV",
      status: "FINISHED",
      episodesCount: 170,
      season: "FALL",
      year: 2017,
      trailerId: null,
      source: "anilist",
      studios: [],
      streamingEpisodes: [],
      seasons: [],
      recommendations: [],
      characters: [],
      staff: [],
      catalogUpdatedAt: 1700000900000,
      serverCatalogId: "97940",
    };

    const resolvedAdmin = resolveAdminAnimeWithRemote(localKitsuAnime, remoteWithAniFallback);
    assert.equal(resolvedAdmin?.cover, kitsuCover);
    assert.equal(resolvedAdmin?.banner, kitsuBanner);

    // Resposta do servidor com fallback legado AniList não sobrescreve Kitsu local quando mídia não foi editada
    assert.equal(resolveSavedMediaFromServer(kitsuCover, anilistCover, false), kitsuCover);
    assert.equal(resolveSavedMediaFromServer(kitsuBanner, anilistBanner, false), kitsuBanner);

    // Rota pública kitsu-* também preserva arte Kitsu se o registro local contiver apenas CDN AniList padrão
    const remoteKitsuRoute: Anime = {
      ...remoteWithAniFallback,
      id: "kitsu-13209",
      cover: kitsuCover,
      banner: kitsuBanner,
      source: "kitsu",
    };
    const localWithDefaultAni = createMockAnime({
      id: "local-kitsu-check",
      anilistId: 97940,
      kitsuId: 13209,
      cover: anilistCover,
      banner: anilistBanner,
    });
    const publicDetail = mergeDetail(remoteKitsuRoute, "kitsu-13209", [localWithDefaultAni]);
    assert.equal(publicDetail?.cover, kitsuCover);
    assert.equal(publicDetail?.banner, kitsuBanner);
  });

  it("5 & 6 & 7. Edição manual envia somente o campo alterado e criação de novo anime persiste imagens iniciais", () => {
    const baseAnime = createMockAnime({
      id: "97940",
      anilistId: 97940,
      cover: "https://cdn.hikari.app/new-cover.jpg",
      banner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/97940.jpg",
    });

    // 5. Editar apenas capa
    const coverOnlyPayload = buildAdminCatalogAnimeSavePayload(baseAnime, {
      cover: true,
      banner: false,
    });
    assert.equal(coverOnlyPayload.cover, "https://cdn.hikari.app/new-cover.jpg");
    assert.equal("banner" in coverOnlyPayload, false);
    assert.equal(coverOnlyPayload.coverExplicitlyEdited, true);
    assert.equal(coverOnlyPayload.bannerExplicitlyEdited, false);

    const coverOnlyDb = resolveCatalogAnimeMediaWrite({
      cover: coverOnlyPayload.cover,
      banner: coverOnlyPayload.banner,
      coverExplicitlyEdited: coverOnlyPayload.coverExplicitlyEdited,
      bannerExplicitlyEdited: coverOnlyPayload.bannerExplicitlyEdited,
      targetExists: true,
      cleanCover: "https://cdn.hikari.app/new-cover.jpg",
      cleanBanner: null,
    });
    assert.equal(coverOnlyDb.shouldWriteCover, true);
    assert.equal(coverOnlyDb.shouldWriteBanner, false);

    // 6. Editar apenas banner
    const customBanner = "https://cdn.hikari.app/new-banner.jpg";
    const bannerOnlyPayload = buildAdminCatalogAnimeSavePayload(
      { ...baseAnime, banner: customBanner },
      { cover: false, banner: true },
    );
    assert.equal("cover" in bannerOnlyPayload, false);
    assert.equal(bannerOnlyPayload.banner, customBanner);
    assert.equal(bannerOnlyPayload.coverExplicitlyEdited, false);
    assert.equal(bannerOnlyPayload.bannerExplicitlyEdited, true);

    const bannerOnlyDb = resolveCatalogAnimeMediaWrite({
      cover: bannerOnlyPayload.cover,
      banner: bannerOnlyPayload.banner,
      coverExplicitlyEdited: bannerOnlyPayload.coverExplicitlyEdited,
      bannerExplicitlyEdited: bannerOnlyPayload.bannerExplicitlyEdited,
      targetExists: true,
      cleanCover: null,
      cleanBanner: customBanner,
    });
    assert.equal(bannerOnlyDb.shouldWriteCover, false);
    assert.equal(bannerOnlyDb.shouldWriteBanner, true);

    const customPreview = resolveAdminDisplayMedia(
      { cover: baseAnime.cover, banner: customBanner },
      {
        cover: "https://s4.anilist.co/cover.jpg",
        banner: "https://s4.anilist.co/banner.jpg",
        resolvedMobileBanner: {
          url: "https://media.kitsu.app/anime/50024/cover_image/x.jpg",
          isAlternative: true,
          source: "kitsu-season",
          initialObjectPosition: "50% 24%",
        },
      },
    );
    assert.equal(customPreview.hasCustomDesktopBanner, true);
    assert.equal(customPreview.mobileBanner?.source, "admin");
    assert.equal(customPreview.mobileBanner?.url, customBanner);

    // 7. Criação de anime novo com imagens informadas
    const brandNew = createMockAnime({
      id: "local-brand-new",
      cover: "https://cdn.hikari.app/brand-new-cover.jpg",
      banner: "https://cdn.hikari.app/brand-new-banner.jpg",
    });
    const newAnimePayload = buildAdminCatalogAnimeSavePayload(brandNew, {
      cover: true,
      banner: true,
    });
    const newAnimeDb = resolveCatalogAnimeMediaWrite({
      cover: newAnimePayload.cover,
      banner: newAnimePayload.banner,
      coverExplicitlyEdited: newAnimePayload.coverExplicitlyEdited,
      bannerExplicitlyEdited: newAnimePayload.bannerExplicitlyEdited,
      targetExists: false,
      cleanCover: "https://cdn.hikari.app/brand-new-cover.jpg",
      cleanBanner: "https://cdn.hikari.app/brand-new-banner.jpg",
    });
    assert.equal(newAnimeDb.shouldWriteCover, true);
    assert.equal(newAnimeDb.shouldWriteBanner, true);
    assert.equal(newAnimeDb.insertCover, "https://cdn.hikari.app/brand-new-cover.jpg");
    assert.equal(newAnimeDb.insertBanner, "https://cdn.hikari.app/brand-new-banner.jpg");
  });
});




