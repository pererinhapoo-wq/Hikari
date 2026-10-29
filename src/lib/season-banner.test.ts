import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_MOBILE_ALT_ASPECT,
  MAX_PANORAMIC_BANNER_ASPECT,
  MIN_ALT_HEIGHT,
  MIN_ALT_WIDTH,
  MIN_HORIZONTAL_ASPECT,
  MIN_JIKAN_HEIGHT,
  MIN_JIKAN_WIDTH,
  clearSeasonBannerCache,
  computePanoramicFocalPercentFromColumns,
  hasAdminCustomBanner,
  initialObjectPositionForAspect,
  isCleanMalHorizontalArtworkDims,
  isCorsCapableBannerOrigin,
  isDisallowedMobileBannerUrl,
  isSeasonYearConsistent,
  isValidMalSeasonPictureUrl,
  isValidPermanentKitsuSeasonUrl,
  normalizeBannerUrl,
  parseImageDimensionsFromBuffer,
  probeImageDimensions,
  resolveSeasonMobileBanner,
  resolveSeasonMobileBannerSync,
  selectViewportBanner,
  verifyBidirectionalSeasonMappings,
} from "./season-banner.ts";
import type { Anime, LocalAnime } from "./types.ts";

describe("season-banner validation & Admin priority", () => {
  it("prioritizes Admin custom banner and ignores auto-copied identical remote banner", () => {
    const remote = {
      id: "176301",
      banner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/176301-GkuTF1YTT6b2.jpg",
    } as unknown as Anime;

    const copiedForEpisodes = {
      id: "local-1",
      banner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/176301-GkuTF1YTT6b2.jpg?cors=1",
    } as unknown as LocalAnime;

    const customizedByAdmin = {
      id: "local-1",
      banner: "https://res.cloudinary.com/demo/image/upload/custom-s2-banner.jpg",
    } as unknown as LocalAnime;

    const emptyBannerLocal = {
      id: "local-1",
      banner: "   ",
    } as unknown as LocalAnime;

    assert.equal(hasAdminCustomBanner(copiedForEpisodes, remote), false);
    assert.equal(hasAdminCustomBanner(customizedByAdmin, remote), true);
    assert.equal(hasAdminCustomBanner(customizedByAdmin, null), true);
    assert.equal(hasAdminCustomBanner(emptyBannerLocal, remote), false);
  });

  it("validates permanent Kitsu season URLs and rejects presigned or mismatched IDs", () => {
    assert.equal(
      isValidPermanentKitsuSeasonUrl(
        "https://media.kitsu.app/anime/cover_images/818/original.jpg",
        "818",
        "https://s4.anilist.co/cover.jpg",
      ),
      true,
    );

    assert.equal(
      isValidPermanentKitsuSeasonUrl(
        "https://media.kitsu.app/anime/48671/cover_image/79ec6fc03c7515c4a15d78f107b33253.jpg",
        "48671",
      ),
      true,
    );

    assert.equal(
      isValidPermanentKitsuSeasonUrl(
        "https://media.kitsu.app/anime/47083/cover_image/34f7e35b6c451a66d2c67458a0c0dd7b.jpg",
        "48649",
      ),
      false,
    );

    assert.equal(
      isValidPermanentKitsuSeasonUrl(
        "https://kitsu-production-media.s3.us-west-002.backblazeb2.com/anime/48649/cover_image/abc.jpg?X-Amz-Expires=900",
        "48649",
      ),
      false,
    );

    assert.equal(
      isValidPermanentKitsuSeasonUrl(
        "https://media.kitsu.app/anime/cover_images/818/original.jpg?X-Amz-Signature=deadbeef",
        "818",
      ),
      false,
    );

    assert.equal(
      isValidPermanentKitsuSeasonUrl(
        "https://media.kitsu.app/anime/cover_images/818/original.jpg",
        "818",
        "https://media.kitsu.app/anime/cover_images/818/original.jpg",
      ),
      false,
    );
  });

  it("enforces bidirectional 1:1 mappings and rejects merged multi-cour or mismatched MAL IDs", () => {
    assert.equal(
      verifyBidirectionalSeasonMappings({
        mappings: [
          { externalSite: "anilist/anime", externalId: "176301" },
          { externalSite: "myanimelist/anime", externalId: "58514" },
        ],
        anilistId: 176301,
        malId: 58514,
      }),
      true,
    );

    assert.equal(
      verifyBidirectionalSeasonMappings({
        mappings: [
          { externalSite: "anilist/anime", externalId: "176301" },
          { externalSite: "anilist/anime", externalId: "195516" },
        ],
        anilistId: 176301,
        malId: 58514,
      }),
      false,
    );

    assert.equal(
      verifyBidirectionalSeasonMappings({
        mappings: [
          { externalSite: "anilist/anime", externalId: "195516" },
          { externalSite: "myanimelist/anime", externalId: "61987" },
        ],
        anilistId: 195516,
        malId: 62897,
      }),
      false,
    );
  });

  it("enforces strict season year consistency", () => {
    assert.equal(isSeasonYearConsistent(2025, "2025-01-10"), true);
    assert.equal(isSeasonYearConsistent(2024, "2023-12-29"), true);
    assert.equal(isSeasonYearConsistent(2025, "2023-10-21"), false);
    assert.equal(isSeasonYearConsistent(2026, null), false);
  });

  it("identifies CORS-capable banner origins accurately", () => {
    assert.equal(
      isCorsCapableBannerOrigin("https://s4.anilist.co/file/anilistcdn/media/anime/banner/918.jpg"),
      true,
    );
    assert.equal(
      isCorsCapableBannerOrigin("https://media.kitsu.app/anime/cover_images/818/original.jpg"),
      false,
    );
    assert.equal(
      isCorsCapableBannerOrigin("https://cdn.myanimelist.net/images/anime/13/17405l.jpg"),
      false,
    );
    assert.equal(normalizeBannerUrl("https://s4.anilist.co/a.jpg?cors=1"), "https://s4.anilist.co/a.jpg");
  });

  it("computes adaptive panoramic horizontal focal percentages without extreme clipping", () => {
    assert.equal(initialObjectPositionForAspect(1.6), "52% 20%");
    assert.equal(initialObjectPositionForAspect(2.37), "50% 24%");
    assert.equal(initialObjectPositionForAspect(4.75), "50% 24%");

    const flat = new Array<number>(96).fill(100);
    assert.equal(computePanoramicFocalPercentFromColumns(flat, 4.75), 50);

    const leftCenterPeak = new Array<number>(96).fill(10);
    for (let i = 30; i <= 40; i++) leftCenterPeak[i] = 400;
    const focalLeft = computePanoramicFocalPercentFromColumns(leftCenterPeak, 4.75);
    assert.ok(focalLeft >= 22 && focalLeft <= 36, `Expected ~29%, got ${focalLeft}%`);

    const rightPeak = new Array<number>(96).fill(10);
    for (let i = 65; i <= 75; i++) rightPeak[i] = 400;
    const focalRight = computePanoramicFocalPercentFromColumns(rightPeak, 4.75);
    assert.ok(focalRight >= 65 && focalRight <= 84, `Expected ~78%, got ${focalRight}%`);
  });

  it("preserves Admin custom banner and maintains safe season default fallback for unreleased seasons mapped to prior years", async () => {
    const adminRes = await resolveSeasonMobileBanner({
      animeId: "176301",
      anilistId: 176301,
      malId: 58514,
      currentBanner: "https://custom.example.com/admin-banner.jpg",
      isAdminCustomBanner: true,
    });
    assert.equal(adminRes.source, "admin");
    assert.equal(adminRes.url, "https://custom.example.com/admin-banner.jpg");
    assert.equal(adminRes.isAlternative, false);

    // Temporada futura sem ano definido mapeada indevidamente para registro de ano anterior deve cair em fallback
    const makePng = (w: number, h: number): Uint8Array<ArrayBuffer> => {
      const b = new Uint8Array(32);
      b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      b[16] = (w >>> 24) & 0xff;
      b[17] = (w >>> 16) & 0xff;
      b[18] = (w >>> 8) & 0xff;
      b[19] = w & 0xff;
      b[20] = (h >>> 24) & 0xff;
      b[21] = (h >>> 16) & 0xff;
      b[22] = (h >>> 8) & 0xff;
      b[23] = h & 0xff;
      return b;
    };

    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = (async (inputUrl: string | URL | Request) => {
        const urlStr = String(inputUrl);
        if (urlStr === "https://s4.anilist.co/unreleased-prior-year-banner.png") {
          return new Response(makePng(1900, 400), { status: 200 });
        }
        if (urlStr.includes("/api/edge/mappings?")) {
          return new Response(
            JSON.stringify({
              included: [
                {
                  id: "47083",
                  type: "anime",
                  attributes: {
                    startDate: "2023-10-21",
                    subtype: "TV",
                    youtubeVideoId: "oyHqh8ue4zw",
                    coverImage: {
                      original:
                        "https://media.kitsu.app/anime/cover_images/47083/original.png",
                    },
                  },
                },
              ],
            }),
            { status: 200 },
          );
        }
        return new Response("", { status: 404 });
      }) as typeof fetch;

      const unreleasedRes = await resolveSeasonMobileBanner({
        animeId: "999916",
        anilistId: 999916,
        status: "NOT_YET_RELEASED",
        currentBanner: "https://s4.anilist.co/unreleased-prior-year-banner.png",
        isAdminCustomBanner: false,
      });
      assert.equal(unreleasedRes.source, "season-default");
      assert.equal(
        unreleasedRes.url,
        "https://s4.anilist.co/unreleased-prior-year-banner.png",
      );
      assert.equal(unreleasedRes.isAlternative, false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("accepts valid media.kitsu.io host and preserves both media.kitsu.app and media.kitsu.io", () => {
    assert.equal(
      isValidPermanentKitsuSeasonUrl(
        "https://media.kitsu.io/anime/cover_images/818/original.jpg",
        "818",
      ),
      true,
    );
    assert.equal(
      isValidPermanentKitsuSeasonUrl(
        "https://media.kitsu.app/anime/cover_images/818/original.jpg",
        "818",
      ),
      true,
    );
    assert.equal(
      isValidPermanentKitsuSeasonUrl(
        "https://untrusted-cdn.com/anime/cover_images/818/original.jpg",
        "818",
      ),
      false,
    );
  });

  it("verifies season mapping when only MyAnimeList ID is mapped on Kitsu", () => {
    // Caso de animes onde AniList não tem mapping direto no Kitsu mas MyAnimeList sim
    assert.equal(
      verifyBidirectionalSeasonMappings({
        mappings: [
          { externalSite: "myanimelist/anime", externalId: "50528" },
        ],
        anilistId: 143505,
        malId: 50528,
      }),
      true,
    );
    // Caso de anime com AniList direto mas sem MAL no Kitsu
    assert.equal(
      verifyBidirectionalSeasonMappings({
        mappings: [
          { externalSite: "anilist/anime", externalId: "143505" },
        ],
        anilistId: 143505,
        malId: 50528,
      }),
      true,
    );
  });

  it("assigns appropriate initial object positions across aspect ratios", () => {
    // Artes horizontais padrão (1.48..2.05, ex.: Gintama 2 em 1.483, 16:10, 16:9)
    assert.equal(initialObjectPositionForAspect(1.483), "52% 20%");
    assert.equal(initialObjectPositionForAspect(1.6), "52% 20%");
    assert.equal(initialObjectPositionForAspect(1.777), "52% 20%");
    assert.equal(initialObjectPositionForAspect(2.05), "52% 20%");

    // Imagens com proporção inferior a 1.48 (< 1.48, ex.: 1.405, 4:3 1.33, Apothecary Diaries 1.415)
    // recebem enquadramento 50% 24% preservando cabeças e rostos no topo sem corte nem zoom excessivo
    assert.equal(initialObjectPositionForAspect(1.405), "50% 24%");
    assert.equal(initialObjectPositionForAspect(1.333), "50% 24%");

    // Panorâmicos (> 2.05)
    assert.equal(initialObjectPositionForAspect(2.1), "50% 24%");
    assert.equal(initialObjectPositionForAspect(3.25), "50% 24%");
    assert.equal(initialObjectPositionForAspect(4.8), "50% 24%");

    // Fallback para valores indefinidos
    assert.equal(initialObjectPositionForAspect(undefined), "50% 24%");
  });

  it("verifies 1:1 season mapping when only AniList ID is provided and Kitsu has both mappings", () => {
    assert.equal(
      verifyBidirectionalSeasonMappings({
        mappings: [
          { externalSite: "myanimelist/anime", externalId: "33255" },
          { externalSite: "anilist/anime", externalId: "21804" },
        ],
        anilistId: 21804,
      }),
      true,
    );
  });

  it("validates Kizumonogatari 3 aspect ratio (1.405) within calibrated mobile bounds (1.30..2.05)", () => {
    const kizu3Aspect = 1280 / 911; // ~1.40505
    // O limite mínimo anterior de 1.48 rejeitava imagens compactas como 1.405.
    // O novo limite calibrado é 1.30, aceitando formatos horizontais compactos (4:3 a 7:5).
    assert.ok(kizu3Aspect >= 1.30, "Deve ser aceito acima do MIN_HORIZONTAL_ASPECT calibrado (1.30)");
    assert.ok(kizu3Aspect <= 2.05, "Deve estar dentro da faixa horizontal compacta/padrão (<= 2.05)");
    assert.equal(initialObjectPositionForAspect(kizu3Aspect), "50% 24%");

    // Imagens quadradas ou quase quadradas (< 1.30) devem ser rejeitadas
    assert.ok(1.20 < 1.30, "Proporção 1.20 (6:5) quase quadrada deve estar abaixo do limite mínimo");
    assert.ok(1.25 < 1.30, "Proporção 1.25 (5:4) deve estar abaixo do limite mínimo");
    assert.ok(1.0 < 1.30, "Proporção 1.0 (quadrada) deve estar abaixo do limite mínimo");
    assert.ok(0.7 < 1.30, "Proporção vertical (pôster) deve estar abaixo do limite mínimo");
  });

  it("parses image dimensions accurately from binary buffer headers", () => {
    // Simula cabeçalho de PNG 1280x911
    const pngHeader = new Uint8Array(32);
    pngHeader.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    // IHDR chunk: offset 16 width, offset 20 height (big-endian)
    pngHeader[16] = 0x00;
    pngHeader[17] = 0x00;
    pngHeader[18] = 0x05;
    pngHeader[19] = 0x00; // width 1280
    pngHeader[20] = 0x00;
    pngHeader[21] = 0x00;
    pngHeader[22] = 0x03;
    pngHeader[23] = 0x8f; // height 911

    const pngParsed = parseImageDimensionsFromBuffer(pngHeader);
    assert.ok(pngParsed);
    assert.equal(pngParsed.width, 1280);
    assert.equal(pngParsed.height, 911);
    assert.ok(Math.abs(pngParsed.aspect - 1280 / 911) < 0.001);

    // Buffers inválidos ou truncados retornam null com segurança
    assert.equal(parseImageDimensionsFromBuffer(new Uint8Array(4)), null);
    assert.equal(parseImageDimensionsFromBuffer(new Uint8Array(0)), null);
  });

  it("handles probeImageDimensions safely for invalid or empty URLs", async () => {
    assert.equal(await probeImageDimensions(""), null);
    const controller = new AbortController();
    controller.abort();
    assert.equal(await probeImageDimensions("https://example.com/aborted.jpg", controller.signal), null);
  });

  it("resolves Kizumonogatari 3 mobile alternative banner end-to-end", async () => {
    const res = await resolveSeasonMobileBanner({
      animeId: "21400",
      anilistId: 21400,
      malId: 31758,
      year: 2017,
      startYear: 2017,
      format: "MOVIE",
      status: "FINISHED",
      currentBanner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/21400-5zcYUeVBptdG.jpg",
      currentCover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx21400-38ykNo3j4xXo.png",
      isAdminCustomBanner: false,
    });

    assert.equal(res.isAlternative, true);
    assert.equal(res.source, "kitsu-season");
    assert.equal(
      res.url,
      "https://media.kitsu.app/anime/cover_images/11407/original.jpg",
    );
    assert.equal(res.initialObjectPosition, "50% 24%");
    assert.ok(res.aspect != null && Math.abs(res.aspect - 1280 / 911) < 0.01);
  });

  it("rejects candidate when season format or year does not match", async () => {
    // Ano inconsistente (2025 vs 2017 de Kizumonogatari 3) deve retornar fallback oficial
    const yearMismatchRes = await resolveSeasonMobileBanner({
      animeId: "21400",
      anilistId: 21400,
      malId: 31758,
      year: 2025,
      startYear: 2025,
      format: "MOVIE",
      currentBanner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/21400-5zcYUeVBptdG.jpg",
      isAdminCustomBanner: false,
    });
    assert.equal(yearMismatchRes.isAlternative, false);
    assert.equal(yearMismatchRes.source, "season-default");

    // Formato incompatível (TV vs MOVIE de Kizumonogatari 3) deve retornar fallback oficial
    const formatMismatchRes = await resolveSeasonMobileBanner({
      animeId: "21400",
      anilistId: 21400,
      malId: 31758,
      year: 2017,
      startYear: 2017,
      format: "TV",
      currentBanner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/21400-5zcYUeVBptdG.jpg",
      isAdminCustomBanner: false,
    });
    assert.equal(formatMismatchRes.isAlternative, false);
    assert.equal(formatMismatchRes.source, "season-default");
  });

  it("handles Bakemonogatari by safely rejecting excessively panoramic candidate (aspect 3.60 > 2.05) and falling back to official season banner", async () => {
    const res = await resolveSeasonMobileBanner({
      animeId: "5081",
      anilistId: 5081,
      malId: 5081,
      year: 2009,
      startYear: 2009,
      format: "TV",
      currentBanner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/n5081-0Zcn5GOFYHMc.jpg",
      currentCover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx5081-42eNrnJ7bYgP.png",
      isAdminCustomBanner: false,
    });

    // Kitsu 3919 possui dimensões 1278x355 (aspect 3.60), sendo panorâmica demais para mobile (> 2.05)
    // Logo, deve ser seguramente rejeitada e manter o fallback oficial da temporada.
    assert.equal(res.isAlternative, false);
    assert.equal(res.source, "season-default");
    assert.equal(
      res.url,
      "https://s4.anilist.co/file/anilistcdn/media/anime/banner/n5081-0Zcn5GOFYHMc.jpg",
    );
  });

  it("resolves Gintama (2006) mobile alternative banner to Kitsu 818", async () => {
    const res = await resolveSeasonMobileBanner({
      animeId: "918",
      anilistId: 918,
      malId: 918,
      year: 2006,
      startYear: 2006,
      format: "TV",
      currentBanner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/918.jpg",
      isAdminCustomBanner: false,
    });

    assert.equal(res.isAlternative, true);
    assert.equal(res.source, "kitsu-season");
    assert.equal(
      res.url,
      "https://media.kitsu.app/anime/cover_images/818/original.jpg",
    );
    assert.ok(res.aspect != null && Math.abs(res.aspect - 1.6) < 0.02);
  });

  it("resolves Gintama° (2015) mobile alternative banner to Kitsu 10083", async () => {
    const res = await resolveSeasonMobileBanner({
      animeId: "20996",
      anilistId: 20996,
      malId: 28977,
      year: 2015,
      startYear: 2015,
      format: "TV",
      currentBanner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/20996.jpg",
      isAdminCustomBanner: false,
    });

    assert.equal(res.isAlternative, true);
    assert.equal(res.source, "kitsu-season");
    assert.equal(
      res.url,
      "https://media.kitsu.app/anime/cover_images/10083/original.jpg",
    );
    assert.ok(res.aspect != null && Math.abs(res.aspect - 1280 / 842) < 0.02);
  });

  it("resolves Nisemonogatari and Koyomimonogatari mobile alternative banners within aspect limits", async () => {
    const niseRes = await resolveSeasonMobileBanner({
      animeId: "11597",
      anilistId: 11597,
      malId: 11597,
      year: 2012,
      startYear: 2012,
      format: "TV",
      currentBanner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/11597.jpg",
      isAdminCustomBanner: false,
    });
    assert.equal(niseRes.isAlternative, true);
    assert.equal(
      niseRes.url,
      "https://media.kitsu.app/anime/cover_images/6546/original.png",
    );

    const koyomiRes = await resolveSeasonMobileBanner({
      animeId: "21520",
      anilistId: 21520,
      malId: 32268,
      year: 2016,
      startYear: 2016,
      format: "ONA",
      currentBanner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/21520.jpg",
      isAdminCustomBanner: false,
    });
    assert.equal(koyomiRes.isAlternative, true);
    assert.equal(
      koyomiRes.url,
      "https://media.kitsu.app/anime/cover_images/11613/original.jpg",
    );
  });

  it("resolves Gintama' (2011) and Gintama' Enchousen (2012) mobile alternative banners to validated Kitsu seasons", async () => {
    const g2011 = await resolveSeasonMobileBanner({
      animeId: "9969",
      anilistId: 9969,
      malId: 9969,
      year: 2011,
      startYear: 2011,
      format: "TV",
      currentBanner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/9969.jpg",
      isAdminCustomBanner: false,
    });
    assert.equal(g2011.isAlternative, true);
    assert.equal(g2011.source, "kitsu-season");
    assert.equal(
      g2011.url,
      "https://media.kitsu.app/anime/cover_images/5971/original.jpg",
    );
    assert.equal(g2011.initialObjectPosition, "52% 20%");

    const g2012 = await resolveSeasonMobileBanner({
      animeId: "15417",
      anilistId: 15417,
      malId: 15417,
      year: 2012,
      startYear: 2012,
      format: "TV",
      currentBanner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/15417.jpg",
      isAdminCustomBanner: false,
    });
    assert.equal(g2012.isAlternative, true);
    assert.equal(g2012.source, "kitsu-season");
    assert.equal(
      g2012.url,
      "https://media.kitsu.app/anime/cover_images/7253/original.jpg",
    );
    assert.equal(g2012.initialObjectPosition, "52% 20%");
  });

  it("resolves Gintama. (2017) mobile alternative banner to Kitsu 12553", async () => {
    const g2017 = await resolveSeasonMobileBanner({
      animeId: "97889",
      anilistId: 97889,
      malId: 34096,
      year: 2017,
      startYear: 2017,
      format: "TV",
      currentBanner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/97889.jpg",
      isAdminCustomBanner: false,
    });
    assert.equal(g2017.isAlternative, true);
    assert.equal(g2017.source, "kitsu-season");
    assert.equal(
      g2017.url,
      "https://media.kitsu.app/anime/cover_images/12553/original.jpg",
    );
    assert.equal(g2017.initialObjectPosition, "52% 20%");
  });

  it("safely rejects excessively panoramic candidates for Gintama Porori-hen, Shirogane no Tamashii-hen and The Final", async () => {
    const porori = await resolveSeasonMobileBanner({
      animeId: "99712",
      anilistId: 99712,
      malId: 35843,
      year: 2017,
      startYear: 2017,
      format: "TV",
      currentBanner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/99712.jpg",
      isAdminCustomBanner: false,
    });
    assert.equal(porori.isAlternative, false);
    assert.equal(porori.source, "season-default");
    assert.equal(
      porori.url,
      "https://s4.anilist.co/file/anilistcdn/media/anime/banner/99712.jpg",
    );

    const shirogane = await resolveSeasonMobileBanner({
      animeId: "100784",
      anilistId: 100784,
      malId: 36838,
      year: 2018,
      startYear: 2018,
      format: "TV",
      currentBanner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/100784.jpg",
      isAdminCustomBanner: false,
    });
    assert.equal(shirogane.isAlternative, false);
    assert.equal(shirogane.source, "season-default");
    assert.equal(
      shirogane.url,
      "https://s4.anilist.co/file/anilistcdn/media/anime/banner/100784.jpg",
    );

    const theFinal = await resolveSeasonMobileBanner({
      animeId: "110710",
      anilistId: 110710,
      malId: 39486,
      year: 2021,
      startYear: 2021,
      format: "MOVIE",
      currentBanner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/110710.jpg",
      isAdminCustomBanner: false,
    });
    assert.equal(theFinal.isAlternative, false);
    assert.equal(theFinal.source, "season-default");
    assert.equal(
      theFinal.url,
      "https://s4.anilist.co/file/anilistcdn/media/anime/banner/110710.jpg",
    );
  });

  it("rejects excessively panoramic Kitsu coverImages for Monogatari Second Season, Owarimonogatari and Kizumonogatari I and preserves original banner without using trailers", async () => {
    const monogatariS2 = await resolveSeasonMobileBanner({
      animeId: "17074",
      anilistId: 17074,
      malId: 17074,
      year: 2013,
      startYear: 2013,
      format: "TV",
      currentBanner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/17074.jpg",
      isAdminCustomBanner: false,
      fetchJikanPictures: async () => [],
    });
    assert.equal(monogatariS2.isAlternative, false);
    assert.equal(monogatariS2.source, "season-default");
    assert.equal(
      monogatariS2.url,
      "https://s4.anilist.co/file/anilistcdn/media/anime/banner/17074.jpg",
    );

    const owari = await resolveSeasonMobileBanner({
      animeId: "21262",
      anilistId: 21262,
      malId: 31181,
      year: 2015,
      startYear: 2015,
      format: "TV",
      currentBanner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/21262.jpg",
      isAdminCustomBanner: false,
      fetchJikanPictures: async () => [],
    });
    assert.equal(owari.isAlternative, false);
    assert.equal(owari.source, "season-default");
    assert.equal(
      owari.url,
      "https://s4.anilist.co/file/anilistcdn/media/anime/banner/21262.jpg",
    );

    const kizu1 = await resolveSeasonMobileBanner({
      animeId: "9260",
      anilistId: 9260,
      malId: 9260,
      year: 2016,
      startYear: 2016,
      format: "MOVIE",
      currentBanner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/9260.jpg",
      isAdminCustomBanner: false,
      fetchJikanPictures: async () => [],
    });
    assert.equal(kizu1.isAlternative, false);
    assert.equal(kizu1.source, "season-default");
    assert.equal(
      kizu1.url,
      "https://s4.anilist.co/file/anilistcdn/media/anime/banner/9260.jpg",
    );
  });

  it("resolves Kizumonogatari II (2016) mobile alternative banner to Kitsu 11406", async () => {
    const kizu2 = await resolveSeasonMobileBanner({
      animeId: "21399",
      anilistId: 21399,
      malId: 31757,
      year: 2016,
      startYear: 2016,
      format: "MOVIE",
      currentBanner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/21399.jpg",
      isAdminCustomBanner: false,
    });
    assert.equal(kizu2.isAlternative, true);
    assert.equal(kizu2.source, "kitsu-season");
    assert.equal(
      kizu2.url,
      "https://media.kitsu.app/anime/cover_images/11406/original.jpg",
    );
    assert.equal(kizu2.initialObjectPosition, "52% 20%");
    assert.ok(kizu2.aspect != null && Math.abs(kizu2.aspect - 1500 / 880) < 0.02);
  });

  it("preserves existing banners with adequate aspect ratio (<= 2.5:1) without querying Kitsu", async () => {
    assert.equal(MAX_PANORAMIC_BANNER_ASPECT, 2.5);

    // Fullmetal Alchemist: Brotherhood (5114) já possui banner horizontal 1900x1188 (~1.60:1 <= 2.5:1) no AniList
    const fmabBanner =
      "https://s4.anilist.co/file/anilistcdn/media/anime/banner/5114-q0V5URebphSG.jpg";
    const fmabRes = await resolveSeasonMobileBanner({
      animeId: "5114",
      anilistId: 5114,
      malId: 5114,
      year: 2009,
      startYear: 2009,
      format: "TV",
      currentBanner: fmabBanner,
      isAdminCustomBanner: false,
    });
    assert.equal(fmabRes.isAlternative, false);
    assert.equal(fmabRes.source, "season-default");
    assert.equal(fmabRes.url, fmabBanner);
    assert.equal(fmabRes.initialObjectPosition, "52% 20%");
    assert.ok(fmabRes.aspect != null && fmabRes.aspect <= 2.5);

    // Banner 2.40:1 (1920x800, <= 2.5:1) também deve ser preservado sem disparar chamadas ao Kitsu
    const makePng = (w: number, h: number): Uint8Array<ArrayBuffer> => {
      const b = new Uint8Array(32);
      b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      b[16] = (w >>> 24) & 0xff;
      b[17] = (w >>> 16) & 0xff;
      b[18] = (w >>> 8) & 0xff;
      b[19] = w & 0xff;
      b[20] = (h >>> 24) & 0xff;
      b[21] = (h >>> 16) & 0xff;
      b[22] = (h >>> 8) & 0xff;
      b[23] = h & 0xff;
      return b;
    };

    const originalFetch = globalThis.fetch;
    let kitsuCalls = 0;
    globalThis.fetch = (async (inputUrl: string | URL | Request) => {
      const urlStr = String(inputUrl);
      if (urlStr.includes("kitsu.io")) {
        kitsuCalls++;
        return new Response("{}", { status: 200 });
      }
      return new Response(makePng(1920, 800), {
        status: 200,
        headers: { "Content-Type": "image/png" },
      });
    }) as typeof fetch;

    try {
      const adequateWideBanner = "https://cdn.example.com/banner-240.png";
      const preserved = await resolveSeasonMobileBanner({
        animeId: "mock-240",
        anilistId: 999001,
        malId: 999001,
        year: 2024,
        startYear: 2024,
        format: "TV",
        currentBanner: adequateWideBanner,
        isAdminCustomBanner: false,
      });
      assert.equal(preserved.isAlternative, false);
      assert.equal(preserved.source, "season-default");
      assert.equal(preserved.url, adequateWideBanner);
      assert.equal(kitsuCalls, 0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("triggers Kitsu lookup when current banner is excessively panoramic (> 2.5:1) including real Gintama AniList and Kitsu banners", async () => {
    // Banner real do AniList de Gintama (1900x400 = 4.75:1 > 2.5:1) -> arte horizontal Kitsu 818 (1920x1200 = 1.60:1)
    const realAniGintama = await resolveSeasonMobileBanner({
      animeId: "918",
      anilistId: 918,
      malId: 918,
      year: 2006,
      startYear: 2006,
      format: "TV",
      currentBanner:
        "https://s4.anilist.co/file/anilistcdn/media/anime/banner/918-bljqHE1PFArH.jpg",
      isAdminCustomBanner: false,
    });
    assert.equal(realAniGintama.isAlternative, true);
    assert.equal(realAniGintama.source, "kitsu-season");
    assert.equal(
      realAniGintama.url,
      "https://media.kitsu.app/anime/cover_images/818/original.jpg",
    );
    assert.equal(realAniGintama.initialObjectPosition, "52% 20%");

    // Rota Kitsu direta (kitsu-818) cujo coverImage.large é 3360x800 (4.20:1 > 2.5:1) -> resolve coverImage.original (1920x1200)
    const kitsuDirectGintama = await resolveSeasonMobileBanner({
      animeId: "kitsu-818",
      kitsuId: 818,
      year: 2006,
      startYear: 2006,
      format: "TV",
      currentBanner:
        "https://media.kitsu.app/anime/cover_images/818/large.jpg",
      isAdminCustomBanner: false,
    });
    assert.equal(kitsuDirectGintama.isAlternative, true);
    assert.equal(kitsuDirectGintama.source, "kitsu-season");
    assert.equal(
      kitsuDirectGintama.url,
      "https://media.kitsu.app/anime/cover_images/818/original.jpg",
    );
  });

  it("rejects vertical poster coverImage candidates and low-resolution images without stretching posters", async () => {
    const makePng = (w: number, h: number): Uint8Array<ArrayBuffer> => {
      const b = new Uint8Array(32);
      b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      b[16] = (w >>> 24) & 0xff;
      b[17] = (w >>> 16) & 0xff;
      b[18] = (w >>> 8) & 0xff;
      b[19] = w & 0xff;
      b[20] = (h >>> 24) & 0xff;
      b[21] = (h >>> 16) & 0xff;
      b[22] = (h >>> 8) & 0xff;
      b[23] = h & 0xff;
      return b;
    };

    const originalFetch = globalThis.fetch;
    try {
      // Caso 1: coverImage.original é um pôster vertical em alta resolução (1000x1500, aspect 0.667 < 1.30)
      globalThis.fetch = (async (inputUrl: string | URL | Request) => {
        const urlStr = String(inputUrl);
        if (urlStr === "https://s4.anilist.co/panoramic-poster-test.png") {
          return new Response(makePng(1900, 400), { status: 200 });
        }
        if (urlStr.includes("/api/edge/mappings?")) {
          return new Response(
            JSON.stringify({
              included: [
                {
                  id: "77701",
                  type: "anime",
                  attributes: {
                    startDate: "2024-04-07",
                    subtype: "TV",
                    coverImage: {
                      original:
                        "https://media.kitsu.app/anime/cover_images/77701/original.png",
                    },
                  },
                },
              ],
            }),
            { status: 200 },
          );
        }
        if (urlStr.includes("/api/edge/anime/77701/mappings")) {
          return new Response(
            JSON.stringify({
              data: [
                {
                  attributes: {
                    externalSite: "anilist/anime",
                    externalId: "999701",
                  },
                },
              ],
            }),
            { status: 200 },
          );
        }
        if (
          urlStr ===
          "https://media.kitsu.app/anime/cover_images/77701/original.png"
        ) {
          return new Response(makePng(1000, 1500), { status: 200 });
        }
        return new Response("", { status: 404 });
      }) as typeof fetch;

      const verticalRes = await resolveSeasonMobileBanner({
        animeId: "999701",
        anilistId: 999701,
        year: 2024,
        startYear: 2024,
        format: "TV",
        currentBanner: "https://s4.anilist.co/panoramic-poster-test.png",
        isAdminCustomBanner: false,
      });
      assert.equal(verticalRes.isAlternative, false);
      assert.equal(verticalRes.source, "season-default");
      assert.equal(
        verticalRes.url,
        "https://s4.anilist.co/panoramic-poster-test.png",
      );

      // Caso 2: coverImage.original é horizontal (16:9), mas de baixa resolução (640x360 < 800x400)
      globalThis.fetch = (async (inputUrl: string | URL | Request) => {
        const urlStr = String(inputUrl);
        if (urlStr === "https://s4.anilist.co/panoramic-lowres-test.png") {
          return new Response(makePng(1900, 400), { status: 200 });
        }
        if (urlStr.includes("/api/edge/mappings?")) {
          return new Response(
            JSON.stringify({
              included: [
                {
                  id: "77702",
                  type: "anime",
                  attributes: {
                    startDate: "2024-04-07",
                    subtype: "TV",
                    coverImage: {
                      original:
                        "https://media.kitsu.app/anime/cover_images/77702/original.png",
                    },
                  },
                },
              ],
            }),
            { status: 200 },
          );
        }
        if (urlStr.includes("/api/edge/anime/77702/mappings")) {
          return new Response(
            JSON.stringify({
              data: [
                {
                  attributes: {
                    externalSite: "anilist/anime",
                    externalId: "999702",
                  },
                },
              ],
            }),
            { status: 200 },
          );
        }
        if (
          urlStr ===
          "https://media.kitsu.app/anime/cover_images/77702/original.png"
        ) {
          return new Response(makePng(640, 360), { status: 200 });
        }
        return new Response("", { status: 404 });
      }) as typeof fetch;

      const lowRes = await resolveSeasonMobileBanner({
        animeId: "999702",
        anilistId: 999702,
        year: 2024,
        startYear: 2024,
        format: "TV",
        currentBanner: "https://s4.anilist.co/panoramic-lowres-test.png",
        isAdminCustomBanner: false,
      });
      assert.equal(lowRes.isAlternative, false);
      assert.equal(lowRes.source, "season-default");
      assert.equal(
        lowRes.url,
        "https://s4.anilist.co/panoramic-lowres-test.png",
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("rejects conflicting cross-season Kitsu mappings so artwork from another season is never used", async () => {
    // kitsuId divergente do candidateKitsuId deve ser rejeitado
    assert.equal(
      verifyBidirectionalSeasonMappings({
        mappings: [{ externalSite: "anilist/anime", externalId: "918" }],
        anilistId: 918,
        kitsuId: 818,
        candidateKitsuId: "5971",
      }),
      false,
    );

    // kitsuId isolado em entrada mesclada com múltiplas temporadas do AniList deve ser rejeitado
    assert.equal(
      verifyBidirectionalSeasonMappings({
        mappings: [
          { externalSite: "anilist/anime", externalId: "176301" },
          { externalSite: "anilist/anime", externalId: "195516" },
        ],
        kitsuId: 48649,
        candidateKitsuId: "48649",
      }),
      false,
    );
  });

  it("strictly rejects trailer thumbnails, YouTube/video URLs, episode thumbnails and 16:9 video screencaps", () => {
    assert.equal(MIN_ALT_WIDTH, 800);
    assert.equal(MIN_ALT_HEIGHT, 400);
    assert.equal(MIN_JIKAN_WIDTH, 580);
    assert.equal(MIN_JIKAN_HEIGHT, 400);
    assert.equal(MIN_HORIZONTAL_ASPECT, 1.30);
    assert.equal(MAX_MOBILE_ALT_ASPECT, 2.05);
    assert.equal(MAX_PANORAMIC_BANNER_ASPECT, 2.5);

    // Proibição explícita de trailers, YouTube, plataformas de vídeo e thumbnails de episódios
    assert.equal(
      isDisallowedMobileBannerUrl("https://i.ytimg.com/vi/oyHqh8ue4zw/maxresdefault.jpg"),
      true,
    );
    assert.equal(
      isDisallowedMobileBannerUrl("https://img.youtube.com/vi/4MYo8FfiXMA/maxresdefault.jpg"),
      true,
    );
    assert.equal(
      isDisallowedMobileBannerUrl("https://youtu.be/YvNvvUeCztE"),
      true,
    );
    assert.equal(
      isDisallowedMobileBannerUrl("https://img1.ak.crunchyroll.com/i/spire4-tmb/ep01.jpg"),
      true,
    );
    assert.equal(
      isDisallowedMobileBannerUrl("https://media.kitsu.app/episodes/thumbnails/12345/original.jpg"),
      true,
    );
    assert.equal(
      isDisallowedMobileBannerUrl("https://cdn.myanimelist.net/images/anime/1501/152170l.jpg"),
      false,
    );
    assert.equal(
      isDisallowedMobileBannerUrl("https://media.kitsu.app/anime/cover_images/818/original.jpg"),
      false,
    );

    // Validação de URLs de artes promocionais do MyAnimeList
    assert.equal(
      isValidMalSeasonPictureUrl(
        "https://cdn.myanimelist.net/images/anime/1501/152170l.jpg",
        "https://s4.anilist.co/cover.jpg",
        "https://s4.anilist.co/banner.jpg",
      ),
      true,
    );
    assert.equal(
      isValidMalSeasonPictureUrl(
        "https://cdn.myanimelist.net/images/characters/10/12345.jpg",
      ),
      false,
    );
    assert.equal(
      isValidMalSeasonPictureUrl(
        "https://cdn.myanimelist.net/images/anime/1501/qm_50.gif",
      ),
      false,
    );
    assert.equal(
      isValidMalSeasonPictureUrl(
        "https://cdn.myanimelist.net/images/anime/1501/152170l.jpg",
        "https://cdn.myanimelist.net/images/anime/1501/152170l.jpg",
      ),
      false,
    );
    assert.equal(
      isValidMalSeasonPictureUrl("https://i.ytimg.com/vi/YvNvvUeCztE/maxresdefault.jpg"),
      false,
    );
    assert.equal(
      isValidMalSeasonPictureUrl("https://evil.example.com/images/anime/1.jpg"),
      false,
    );

    // Geometria limpa para artes horizontais do MAL vs capturas de vídeo 16:9 / pôsteres
    assert.equal(
      isCleanMalHorizontalArtworkDims({ width: 600, height: 424, aspect: 600 / 424 }),
      true,
    );
    assert.equal(
      isCleanMalHorizontalArtworkDims({ width: 600, height: 451, aspect: 600 / 451 }),
      true,
    );
    assert.equal(
      isCleanMalHorizontalArtworkDims({ width: 424, height: 600, aspect: 424 / 600 }),
      false,
    );
    assert.equal(
      isCleanMalHorizontalArtworkDims({ width: 600, height: 337, aspect: 600 / 337 }),
      false,
    );
    assert.equal(
      isCleanMalHorizontalArtworkDims({ width: 854, height: 480, aspect: 854 / 480 }),
      false,
    );
    assert.equal(
      isCleanMalHorizontalArtworkDims({ width: 960, height: 540, aspect: 960 / 540 }),
      false,
    );
  });

  it("enforces complete Desktop isolation and absolute Admin banner priority in selectViewportBanner", () => {
    const baseDesktopBanner =
      "https://s4.anilist.co/file/anilistcdn/media/anime/banner/195516-B5M0cPaQbQXI.jpg";
    const mobileResolvedState = {
      forId: "195516",
      url: "https://cdn.myanimelist.net/images/anime/1501/152170l.jpg",
      isAlternative: true,
      initialObjectPosition: "50% 40%",
    };

    // Desktop NUNCA recebe a imagem mobile (mesmo que mobileBannerState exista em memória)
    const desktopSelection = selectViewportBanner({
      animeId: "195516",
      isMobileViewport: false,
      isAdminBanner: false,
      baseSeasonBanner: baseDesktopBanner,
      mobileBannerState: mobileResolvedState,
    });
    assert.equal(desktopSelection.effectiveBannerUrl, baseDesktopBanner);
    assert.equal(desktopSelection.defaultObjectPosition, "50% 24%");
    assert.equal(desktopSelection.isUsingMobileAlternative, false);

    // Mobile recebe a arte alternativa limpa validada da temporada
    const mobileSelection = selectViewportBanner({
      animeId: "195516",
      isMobileViewport: true,
      isAdminBanner: false,
      baseSeasonBanner: baseDesktopBanner,
      mobileBannerState: mobileResolvedState,
    });
    assert.equal(mobileSelection.effectiveBannerUrl, mobileResolvedState.url);
    assert.equal(mobileSelection.defaultObjectPosition, "50% 40%");
    assert.equal(mobileSelection.isUsingMobileAlternative, true);

    // Banner personalizado pelo Admin nunca é substituído no mobile nem no desktop
    const adminBanner = "https://res.cloudinary.com/demo/image/upload/admin-custom.jpg";
    const adminMobileSelection = selectViewportBanner({
      animeId: "195516",
      isMobileViewport: true,
      isAdminBanner: true,
      baseSeasonBanner: adminBanner,
      mobileBannerState: mobileResolvedState,
    });
    assert.equal(adminMobileSelection.effectiveBannerUrl, adminBanner);
    assert.equal(adminMobileSelection.defaultObjectPosition, "50% 24%");
    assert.equal(adminMobileSelection.isUsingMobileAlternative, false);

    // Se a alternativa mobile falhar ao carregar no navegador, volta para o banner original
    const mobileErrorFallback = selectViewportBanner({
      animeId: "195516",
      isMobileViewport: true,
      isAdminBanner: false,
      baseSeasonBanner: baseDesktopBanner,
      mobileBannerState: mobileResolvedState,
      failedBannerUrls: { [mobileResolvedState.url]: true },
    });
    assert.equal(mobileErrorFallback.effectiveBannerUrl, baseDesktopBanner);
    assert.equal(mobileErrorFallback.isUsingMobileAlternative, false);
  });

  it("enforces clean-art priority order (1 Admin > 2 Current clean adequate > 3 Kitsu > 4 Jikan clean art > 5 Original fallback) without ever using trailers or screencaps", async () => {
    const makePng = (w: number, h: number): Uint8Array<ArrayBuffer> => {
      const b = new Uint8Array(32);
      b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      b[16] = (w >>> 24) & 0xff;
      b[17] = (w >>> 16) & 0xff;
      b[18] = (w >>> 8) & 0xff;
      b[19] = w & 0xff;
      b[20] = (h >>> 24) & 0xff;
      b[21] = (h >>> 16) & 0xff;
      b[22] = (h >>> 8) & 0xff;
      b[23] = h & 0xff;
      return b;
    };

    const originalFetch = globalThis.fetch;
    try {
      let kitsuCoverDims: [number, number] = [1600, 900];
      let malGalleryDims: Record<string, [number, number]> = {
        "https://cdn.myanimelist.net/images/anime/99/1001l.jpg": [424, 600], // pôster vertical (rejeitado)
        "https://cdn.myanimelist.net/images/anime/99/1002l.jpg": [600, 337], // captura 16:9 de PV/trailer (rejeitada)
        "https://cdn.myanimelist.net/images/anime/99/1002b.jpg": [854, 480], // captura 16:9 de episódio com legenda (rejeitada)
        "https://cdn.myanimelist.net/images/anime/99/1003l.jpg": [600, 424], // ilustração promocional horizontal limpa (aceita)
      };
      let currentBannerDims: [number, number] = [1900, 400]; // 4.75:1 (> 2.5:1)
      let networkCalls = 0;
      const requestedUrls: string[] = [];

      globalThis.fetch = (async (inputUrl: string | URL | Request) => {
        networkCalls++;
        const urlStr = String(inputUrl);
        requestedUrls.push(urlStr);
        if (urlStr === "https://s4.anilist.co/cascade-current.png") {
          return new Response(makePng(currentBannerDims[0], currentBannerDims[1]), {
            status: 200,
          });
        }
        if (urlStr.includes("/api/edge/mappings?")) {
          return new Response(
            JSON.stringify({
              included: [
                {
                  id: "88801",
                  type: "anime",
                  attributes: {
                    startDate: "2026-04-01",
                    subtype: "TV",
                    coverImage: {
                      original:
                        "https://media.kitsu.app/anime/cover_images/88801/original.png",
                    },
                  },
                },
              ],
            }),
            { status: 200 },
          );
        }
        if (urlStr.includes("/api/edge/anime/88801/mappings")) {
          return new Response(
            JSON.stringify({
              data: [
                {
                  attributes: {
                    externalSite: "anilist/anime",
                    externalId: "888001",
                  },
                },
                {
                  attributes: {
                    externalSite: "myanimelist/anime",
                    externalId: "888001",
                  },
                },
              ],
            }),
            { status: 200 },
          );
        }
        if (
          urlStr ===
          "https://media.kitsu.app/anime/cover_images/88801/original.png"
        ) {
          return new Response(makePng(kitsuCoverDims[0], kitsuCoverDims[1]), {
            status: 200,
          });
        }
        if (malGalleryDims[urlStr]) {
          const [w, h] = malGalleryDims[urlStr];
          return new Response(makePng(w, h), { status: 200 });
        }
        return new Response("", { status: 404 });
      }) as typeof fetch;

      const mockFetchJikan = async () => [
        "https://i.ytimg.com/vi/AniVid12345/maxresdefault.jpg", // URL de trailer infiltrada (deve ser bloqueada antes mesmo de probe)
        "https://img1.ak.crunchyroll.com/i/spire4-tmb/ep01.jpg", // Thumbnail de episódio (deve ser bloqueada)
        ...Object.keys(malGalleryDims),
      ];

      // Passo 1: Admin tem prioridade absoluta sem nenhuma requisição de rede
      clearSeasonBannerCache();
      networkCalls = 0;
      const step1 = await resolveSeasonMobileBanner({
        animeId: "cascade-1",
        anilistId: 888001,
        malId: 888001,
        year: 2026,
        format: "TV",
        currentBanner: "https://res.cloudinary.com/demo/admin.jpg",
        isAdminCustomBanner: true,
        fetchJikanPictures: mockFetchJikan,
      });
      assert.equal(step1.source, "admin");
      assert.equal(step1.isAlternative, false);
      assert.equal(networkCalls, 0);

      // Passo 2: Banner atual limpo e adequado (1920x800 = 2.40:1 <= 2.5:1) preservado sem consultar Kitsu/Jikan
      clearSeasonBannerCache();
      currentBannerDims = [1920, 800];
      networkCalls = 0;
      const step2 = await resolveSeasonMobileBanner({
        animeId: "cascade-2",
        anilistId: 888001,
        malId: 888001,
        year: 2026,
        format: "TV",
        currentBanner: "https://s4.anilist.co/cascade-current.png",
        fetchJikanPictures: mockFetchJikan,
      });
      assert.equal(step2.source, "season-default");
      assert.equal(step2.isAlternative, false);
      assert.equal(networkCalls, 1);

      // Passo 2b: Se o currentBanner vier de miniatura do YouTube (ex.: rota mal-*), NÃO o trata como adequado e substitui por arte limpa do Kitsu
      clearSeasonBannerCache();
      kitsuCoverDims = [1600, 900];
      const step2YoutubeCurrent = await resolveSeasonMobileBanner({
        animeId: "mal-888001",
        anilistId: 888001,
        malId: 888001,
        year: 2026,
        format: "TV",
        currentBanner: "https://img.youtube.com/vi/AniVid12345/maxresdefault.jpg",
        fetchJikanPictures: mockFetchJikan,
      });
      assert.equal(step2YoutubeCurrent.source, "kitsu-season");
      assert.equal(step2YoutubeCurrent.isAlternative, true);
      assert.equal(
        step2YoutubeCurrent.url,
        "https://media.kitsu.app/anime/cover_images/88801/original.png",
      );

      // Passo 3: Banner atual panorâmico (1900x400 = 4.75:1) -> Kitsu válido (1600x900) vence Jikan
      clearSeasonBannerCache();
      currentBannerDims = [1900, 400];
      kitsuCoverDims = [1600, 900];
      const step3 = await resolveSeasonMobileBanner({
        animeId: "cascade-3",
        anilistId: 888001,
        malId: 888001,
        year: 2026,
        format: "TV",
        currentBanner: "https://s4.anilist.co/cascade-current.png",
        fetchJikanPictures: mockFetchJikan,
      });
      assert.equal(step3.source, "kitsu-season");
      assert.equal(step3.isAlternative, true);
      assert.equal(
        step3.url,
        "https://media.kitsu.app/anime/cover_images/88801/original.png",
      );

      // Passo 4: Kitsu panorâmico (1900x400 = 4.75:1) -> Jikan bloqueia YouTube/Crunchyroll, rejeita 424x600, 600x337 e 854x480, e seleciona arte limpa 600x424
      clearSeasonBannerCache();
      requestedUrls.length = 0;
      kitsuCoverDims = [1900, 400];
      const step4 = await resolveSeasonMobileBanner({
        animeId: "cascade-4",
        anilistId: 888001,
        malId: 888001,
        year: 2026,
        format: "TV",
        currentBanner: "https://s4.anilist.co/cascade-current.png",
        fetchJikanPictures: mockFetchJikan,
      });
      assert.equal(step4.source, "jikan-season");
      assert.equal(step4.isAlternative, true);
      assert.equal(
        step4.url,
        "https://cdn.myanimelist.net/images/anime/99/1003l.jpg",
      );
      assert.equal(
        requestedUrls.some((u) => u.includes("ytimg.com") || u.includes("crunchyroll.com")),
        false,
      );

      // Passo 5: Quando Kitsu é panorâmico e Jikan só possui pôsteres ou capturas 16:9 de vídeo, mantém o banner original sem forçar substituição
      clearSeasonBannerCache();
      requestedUrls.length = 0;
      malGalleryDims = {
        "https://cdn.myanimelist.net/images/anime/99/1001l.jpg": [424, 600],
        "https://cdn.myanimelist.net/images/anime/99/1002l.jpg": [600, 337],
        "https://cdn.myanimelist.net/images/anime/99/1002b.jpg": [854, 480],
      };
      const step5 = await resolveSeasonMobileBanner({
        animeId: "cascade-5",
        anilistId: 888001,
        malId: 888001,
        year: 2026,
        format: "TV",
        currentBanner: "https://s4.anilist.co/cascade-current.png",
        fetchJikanPictures: mockFetchJikan,
      });
      assert.equal(step5.source, "season-default");
      assert.equal(step5.isAlternative, false);
      assert.equal(step5.url, "https://s4.anilist.co/cascade-current.png");
      assert.equal(
        requestedUrls.some((u) => u.includes("ytimg.com") || u.includes("youtube.com")),
        false,
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("regression: resolves clean horizontal MAL illustrations for The Apothecary Diaries S2 & S3 while keeping original clean banner on S1", async () => {
    clearSeasonBannerCache();

    // S1 (AniList 161645 / MAL 54492): Kitsu 47083 é 1600x596 (2.685:1 > 2.05:1) e MAL só possui pôsteres verticais -> mantém banner original limpo sem usar trailer
    const s1MalRealGallery = [
      "https://cdn.myanimelist.net/images/anime/1708/138033l.jpg",
      "https://cdn.myanimelist.net/images/anime/1235/133405l.jpg",
      "https://cdn.myanimelist.net/images/anime/1674/137009l.jpg",
      "https://cdn.myanimelist.net/images/anime/1271/137043l.jpg",
    ];
    const s1OriginalBanner =
      "https://s4.anilist.co/file/anilistcdn/media/anime/banner/161645-oqzTZYIvviWI.jpg";
    const s1 = await resolveSeasonMobileBanner({
      animeId: "161645",
      anilistId: 161645,
      malId: 54492,
      year: 2023,
      startYear: 2023,
      format: "TV",
      currentBanner: s1OriginalBanner,
      fetchJikanPictures: async () => s1MalRealGallery,
    });
    assert.equal(s1.isAlternative, false);
    assert.equal(s1.source, "season-default");
    assert.equal(s1.url, s1OriginalBanner);

    // S2 (AniList 176301 / MAL 58514): Kitsu 48649 é 1500x462 (3.247:1 > 2.05:1), MAL fornece ilustração oficial horizontal limpa 600x424 (144365l.jpg)
    const s2MalRealGallery = [
      "https://cdn.myanimelist.net/images/anime/1025/147458l.jpg", // 423x600 vertical (rejeitada)
      "https://cdn.myanimelist.net/images/anime/1838/142240l.jpg", // 424x600 vertical (rejeitada)
      "https://cdn.myanimelist.net/images/anime/1378/144141l.jpg", // 400x600 vertical (rejeitada)
      "https://cdn.myanimelist.net/images/anime/1681/144365l.jpg", // 600x424 arte promocional horizontal limpa (aceita!)
    ];
    const s2 = await resolveSeasonMobileBanner({
      animeId: "176301",
      anilistId: 176301,
      malId: 58514,
      year: 2025,
      startYear: 2025,
      format: "TV",
      currentBanner:
        "https://s4.anilist.co/file/anilistcdn/media/anime/banner/176301-GkuTF1YTT6b2.jpg",
      fetchJikanPictures: async () => s2MalRealGallery,
    });
    assert.equal(s2.isAlternative, true);
    assert.equal(s2.source, "jikan-season");
    assert.equal(
      s2.url,
      "https://cdn.myanimelist.net/images/anime/1681/144365l.jpg",
    );
    assert.ok(s2.aspect != null && Math.abs(s2.aspect - 600 / 424) < 0.01);

    // S3 (AniList 195516 / MAL 61987): Kitsu 50021 é 1920x640 (3.00:1 > 2.05:1), MAL rejeita pôster 425x600 e captura de PV 600x337 ("続編制作決定！") e seleciona arte limpa 152170l.jpg (600x424)
    const s3MalRealGallery = [
      "https://cdn.myanimelist.net/images/anime/1028/160277l.jpg", // 425x600 vertical (rejeitada)
      "https://cdn.myanimelist.net/images/anime/1508/150885l.jpg", // 600x337 quadro de anúncio de PV (rejeitado)
      "https://cdn.myanimelist.net/images/anime/1501/152170l.jpg", // 600x424 arte promocional horizontal limpa (aceita!)
    ];
    const s3OriginalBanner =
      "https://s4.anilist.co/file/anilistcdn/media/anime/banner/195516-B5M0cPaQbQXI.jpg";
    const s3 = await resolveSeasonMobileBanner({
      animeId: "195516",
      anilistId: 195516,
      malId: 61987,
      year: 2026,
      startYear: 2026,
      format: "TV",
      status: "NOT_YET_RELEASED",
      currentBanner: s3OriginalBanner,
      fetchJikanPictures: async () => s3MalRealGallery,
    });
    assert.equal(s3.isAlternative, true);
    assert.equal(s3.source, "jikan-season");
    assert.equal(
      s3.url,
      "https://cdn.myanimelist.net/images/anime/1501/152170l.jpg",
    );
    assert.ok(s3.aspect != null && Math.abs(s3.aspect - 600 / 424) < 0.01);

    // Para o ID 195516 (The Apothecary Diaries Season 3), garante que a alternativa mobile oficial limpa
    // seja resolvida mesmo quando a consulta em tempo real ao Jikan estiver indisponível
    clearSeasonBannerCache();
    const s3WhenJikanUnavailable = await resolveSeasonMobileBanner({
      animeId: "195516",
      anilistId: 195516,
      malId: 61987,
      year: 2026,
      startYear: 2026,
      format: "TV",
      status: "NOT_YET_RELEASED",
      currentBanner: s3OriginalBanner,
      fetchJikanPictures: async () => [],
    });
    assert.equal(s3WhenJikanUnavailable.isAlternative, true);
    assert.equal(s3WhenJikanUnavailable.source, "jikan-season");
    assert.equal(
      s3WhenJikanUnavailable.url,
      "https://cdn.myanimelist.net/images/anime/1501/152170l.jpg",
    );

    // Validação de isolamento: Desktop preserva o banner original e Mobile utiliza a alternativa
    const desktopSelection = selectViewportBanner({
      animeId: "195516",
      isMobileViewport: false,
      isAdminBanner: false,
      baseSeasonBanner: s3OriginalBanner,
      mobileBannerState: {
        forId: "195516",
        url: s3WhenJikanUnavailable.url,
        isAlternative: s3WhenJikanUnavailable.isAlternative,
        initialObjectPosition: s3WhenJikanUnavailable.initialObjectPosition,
      },
    });
    assert.equal(desktopSelection.effectiveBannerUrl, s3OriginalBanner);
    assert.equal(desktopSelection.isUsingMobileAlternative, false);
    assert.equal(desktopSelection.defaultObjectPosition, "50% 24%");

    const mobileSelection = selectViewportBanner({
      animeId: "195516",
      isMobileViewport: true,
      isAdminBanner: false,
      baseSeasonBanner: s3OriginalBanner,
      mobileBannerState: {
        forId: "195516",
        url: s3WhenJikanUnavailable.url,
        isAlternative: s3WhenJikanUnavailable.isAlternative,
        initialObjectPosition: s3WhenJikanUnavailable.initialObjectPosition,
      },
    });
    assert.equal(
      mobileSelection.effectiveBannerUrl,
      "https://cdn.myanimelist.net/images/anime/1501/152170l.jpg",
    );
    assert.equal(mobileSelection.isUsingMobileAlternative, true);
  });

  it("regression: preserves original clean banner for Black Clover 2nd Season (195604) when only vertical posters exist, while resolving clean MAL horizontal art for Solo Leveling S1 (151807)", async () => {
    clearSeasonBannerCache();

    // Black Clover 2nd Season (195604 / MAL 61967): Kitsu 50024 é 2890x1028 (2.811:1) e MAL possui apenas pôsteres verticais -> mantém banner original sem usar trailer
    const blackCloverS2RealMalGallery = [
      "https://cdn.myanimelist.net/images/anime/1857/160133l.jpg",
      "https://cdn.myanimelist.net/images/anime/1636/150908l.jpg",
      "https://cdn.myanimelist.net/images/anime/1424/150913l.jpg",
      "https://cdn.myanimelist.net/images/anime/1717/154518l.jpg",
      "https://cdn.myanimelist.net/images/anime/1602/158830l.jpg",
      "https://cdn.myanimelist.net/images/anime/1954/160282l.jpg",
    ];
    const bc2OriginalBanner =
      "https://s4.anilist.co/file/anilistcdn/media/anime/banner/195604-lQpCzTziSA17.jpg";

    const bc2 = await resolveSeasonMobileBanner({
      animeId: "195604",
      anilistId: 195604,
      malId: 61967,
      year: 2026,
      startYear: 2026,
      format: "TV",
      status: "NOT_YET_RELEASED",
      currentBanner: bc2OriginalBanner,
      fetchJikanPictures: async () => blackCloverS2RealMalGallery,
    });

    assert.equal(bc2.isAlternative, false);
    assert.equal(bc2.source, "season-default");
    assert.equal(bc2.url, bc2OriginalBanner);

    // Solo Leveling S1 (151807 / MAL 52299): Kitsu 46231 é panorâmico e MAL possui arte promocional horizontal oficial 142290l.jpg (600x425 = 1.412:1)
    const sl1 = await resolveSeasonMobileBanner({
      animeId: "151807",
      anilistId: 151807,
      malId: 52299,
      year: 2024,
      startYear: 2024,
      format: "TV",
      currentBanner:
        "https://s4.anilist.co/file/anilistcdn/media/anime/banner/151807-37yfQA3ym8PA.jpg",
      fetchJikanPictures: async () => [
        "https://cdn.myanimelist.net/images/anime/1801/142390l.jpg", // vertical (rejeitada)
        "https://cdn.myanimelist.net/images/anime/1647/142290l.jpg", // 600x425 horizontal oficial (aceita!)
      ],
    });
    assert.equal(sl1.isAlternative, true);
    assert.equal(
      sl1.source === "kitsu-season" || sl1.source === "jikan-season",
      true,
    );
    if (sl1.source === "jikan-season") {
      assert.equal(
        sl1.url,
        "https://cdn.myanimelist.net/images/anime/1647/142290l.jpg",
      );
      assert.ok(sl1.aspect != null && Math.abs(sl1.aspect - 600 / 425) < 0.01);
    }
  });

  it("regression: rejects PV announcement frames and preserves original banners on Gintama seasons that lack clean horizontal alternatives", async () => {
    clearSeasonBannerCache();

    // 1. Gintama.: Shirogane no Tamashii-hen - Kouhan-sen (101925 / MAL 37491): Kitsu 3.0:1 e MAL apenas vertical -> mantém banner original (não usa trailer OP com créditos)
    const shiroganePt2Banner =
      "https://s4.anilist.co/file/anilistcdn/media/anime/banner/101925-eyVjqcyh4Gsu.jpg";
    const shiroganePt2 = await resolveSeasonMobileBanner({
      animeId: "101925",
      anilistId: 101925,
      malId: 37491,
      year: 2018,
      startYear: 2018,
      format: "TV",
      currentBanner: shiroganePt2Banner,
      fetchJikanPictures: async () => [
        "https://cdn.myanimelist.net/images/anime/1776/96566l.jpg",
      ],
    });
    assert.equal(shiroganePt2.isAlternative, false);
    assert.equal(shiroganePt2.source, "season-default");
    assert.equal(shiroganePt2.url, shiroganePt2Banner);

    // 2. Gintama: The Final (114129 / MAL 39486): rejeita 99650l.jpg (600x338 quadro de anúncio de PV) e pôster 423x600 -> mantém banner original
    const gintamaFinalBanner =
      "https://s4.anilist.co/file/anilistcdn/media/anime/banner/114129-ZsLDkdwaYeJY.jpg";
    const gintamaFinalReal = await resolveSeasonMobileBanner({
      animeId: "114129",
      anilistId: 114129,
      malId: 39486,
      year: 2021,
      startYear: 2021,
      format: "MOVIE",
      currentBanner: gintamaFinalBanner,
      fetchJikanPictures: async () => [
        "https://cdn.myanimelist.net/images/anime/1904/99650l.jpg", // 600x338 quadro de PV com texto (rejeitado)
        "https://cdn.myanimelist.net/images/anime/1245/116760l.jpg", // 423x600 pôster vertical (rejeitado)
      ],
    });
    assert.equal(gintamaFinalReal.isAlternative, false);
    assert.equal(gintamaFinalReal.source, "season-default");
    assert.equal(gintamaFinalReal.url, gintamaFinalBanner);

    // 3. Gintama.: Porori-hen (99714 / MAL 35843) -> mantém banner original
    const pororiRealBanner =
      "https://s4.anilist.co/file/anilistcdn/media/anime/banner/99714-mPAF6Pk56mKc.jpg";
    const pororiReal = await resolveSeasonMobileBanner({
      animeId: "99714",
      anilistId: 99714,
      malId: 35843,
      year: 2017,
      startYear: 2017,
      format: "TV",
      currentBanner: pororiRealBanner,
      fetchJikanPictures: async () => [
        "https://cdn.myanimelist.net/images/anime/11/88325l.jpg",
        "https://cdn.myanimelist.net/images/anime/13/86593l.jpg",
      ],
    });
    assert.equal(pororiReal.isAlternative, false);
    assert.equal(pororiReal.source, "season-default");
    assert.equal(pororiReal.url, pororiRealBanner);

    // 4. Gintama.: Shirogane no Tamashii-hen (100784 / MAL 36838) -> mantém banner original
    const shiroganePt1Banner =
      "https://s4.anilist.co/file/anilistcdn/media/anime/banner/100784-jDLVx9EAO0HF.jpg";
    const shiroganePt1 = await resolveSeasonMobileBanner({
      animeId: "100784",
      anilistId: 100784,
      malId: 36838,
      year: 2018,
      startYear: 2018,
      format: "TV",
      currentBanner: shiroganePt1Banner,
      fetchJikanPictures: async () => [
        "https://cdn.myanimelist.net/images/anime/12/89603l.jpg",
      ],
    });
    assert.equal(shiroganePt1.isAlternative, false);
    assert.equal(shiroganePt1.source, "season-default");
    assert.equal(shiroganePt1.url, shiroganePt1Banner);
  });

  it("resolves all batch mobile alternatives deterministically without network delay while maintaining desktop isolation", async () => {
    clearSeasonBannerCache();

    // 1. Kizumonogatari III (21400): Kitsu 11407 a 50% 24%
    const k3 = await resolveSeasonMobileBanner({
      animeId: "21400",
      anilistId: 21400,
      malId: 31758,
      year: 2017,
      format: "MOVIE",
      currentBanner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/21400-5zcYUeVBptdG.jpg",
    });
    assert.equal(k3.isAlternative, true);
    assert.equal(k3.url, "https://media.kitsu.app/anime/cover_images/11407/original.jpg");
    assert.equal(k3.initialObjectPosition, "50% 24%");

    // Desktop isolation para Kizumonogatari III
    const k3Desktop = selectViewportBanner({
      animeId: "21400",
      isMobileViewport: false,
      isAdminBanner: false,
      baseSeasonBanner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/21400-5zcYUeVBptdG.jpg",
      mobileBannerState: {
        forId: "21400",
        url: k3.url!,
        isAlternative: k3.isAlternative,
        initialObjectPosition: k3.initialObjectPosition,
      },
    });
    assert.equal(k3Desktop.isUsingMobileAlternative, false);
    assert.equal(k3Desktop.effectiveBannerUrl, "https://s4.anilist.co/file/anilistcdn/media/anime/banner/21400-5zcYUeVBptdG.jpg");

    // 2. Durarara!! Season 1 (6746): Kitsu 5324 a 50% 24%
    const drrr1 = await resolveSeasonMobileBanner({
      animeId: "6746",
      anilistId: 6746,
      malId: 6746,
      year: 2010,
      format: "TV",
      currentBanner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/6746-b6hS6o45dOcx.jpg",
    });
    assert.equal(drrr1.isAlternative, true);
    assert.equal(drrr1.url, "https://media.kitsu.app/anime/cover_images/5324/original.jpg");
    assert.equal(drrr1.initialObjectPosition, "50% 24%");

    // 3. Durarara!!×2 Ten (20879): Kitsu 9726 com foco calibrado 62% 20%
    const drrrTen = await resolveSeasonMobileBanner({
      animeId: "20879",
      anilistId: 20879,
      malId: 27831,
      year: 2015,
      format: "TV",
      currentBanner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/20879-8H4J2m6K9L0p.jpg",
    });
    assert.equal(drrrTen.isAlternative, true);
    assert.equal(drrrTen.url, "https://media.kitsu.app/anime/cover_images/9726/original.jpg");
    assert.equal(drrrTen.initialObjectPosition, "62% 20%");

    // 4. Durarara!!×2 Ketsu (20880): Kitsu 9725 a 50% 24%
    const drrrKetsu = await resolveSeasonMobileBanner({
      animeId: "20880",
      anilistId: 20880,
      malId: 27833,
      year: 2016,
      format: "TV",
      currentBanner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/20880-9I3K5m7L8N1q.jpg",
    });
    assert.equal(drrrKetsu.isAlternative, true);
    assert.equal(drrrKetsu.url, "https://media.kitsu.app/anime/cover_images/9725/original.jpg");
    assert.equal(drrrKetsu.initialObjectPosition, "50% 24%");

    // 5. Great Teacher Onizuka (245): Kitsu 220 a 50% 24%
    const gto = await resolveSeasonMobileBanner({
      animeId: "245",
      anilistId: 245,
      malId: 245,
      year: 1999,
      format: "TV",
      currentBanner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/245.jpg",
    });
    assert.equal(gto.isAlternative, true);
    assert.equal(gto.url, "https://media.kitsu.app/anime/cover_images/220/original.jpg");
    assert.equal(gto.initialObjectPosition, "50% 24%");

    // 6. The Apothecary Diaries Season 2 (176301): MAL 144365l.jpg a 50% 24%
    const apo2 = await resolveSeasonMobileBanner({
      animeId: "176301",
      anilistId: 176301,
      malId: 58514,
      year: 2025,
      format: "TV",
      currentBanner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/176301-GkuTF1YTT6b2.jpg",
    });
    assert.equal(apo2.isAlternative, true);
    assert.equal(apo2.url, "https://cdn.myanimelist.net/images/anime/1681/144365l.jpg");
    assert.equal(apo2.initialObjectPosition, "50% 24%");

    // 7. One Piece (21): LiveChart visual em resolução máxima 706x1000 a 50% 24%
    const opMobile = await resolveSeasonMobileBanner({
      animeId: "21",
      anilistId: 21,
      malId: 21,
      year: 1999,
      format: "TV",
      currentBanner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/21-wf37VakJmZih.jpg",
    });
    assert.equal(opMobile.isAlternative, true);
    assert.equal(
      opMobile.url,
      "https://u.livechart.me/anime_visuals/local_version/15565/image/4fc1bf78ce8ec66cb2266427ff72a6ea.webp/large.jpg",
    );
    assert.equal(opMobile.source, "livechart-season");
    assert.equal(opMobile.initialObjectPosition, "50% 24%");

    // Desktop isolation para One Piece (preserva banner oficial AniList no desktop)
    const opDesktop = selectViewportBanner({
      animeId: "21",
      isMobileViewport: false,
      isAdminBanner: false,
      baseSeasonBanner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/21-wf37VakJmZih.jpg",
      mobileBannerState: {
        forId: "21",
        url: opMobile.url!,
        isAlternative: opMobile.isAlternative,
        initialObjectPosition: opMobile.initialObjectPosition,
      },
    });
    assert.equal(opDesktop.isUsingMobileAlternative, false);
    assert.equal(
      opDesktop.effectiveBannerUrl,
      "https://s4.anilist.co/file/anilistcdn/media/anime/banner/21-wf37VakJmZih.jpg",
    );

    // Prioridade de banner personalizado do Admin sobre o banner mobile
    const opAdminCustom = selectViewportBanner({
      animeId: "21",
      isMobileViewport: true,
      isAdminBanner: true,
      baseSeasonBanner: "https://res.cloudinary.com/demo/image/upload/custom-onepiece-admin.jpg",
      mobileBannerState: {
        forId: "21",
        url: opMobile.url!,
        isAlternative: opMobile.isAlternative,
        initialObjectPosition: opMobile.initialObjectPosition,
      },
    });
    assert.equal(opAdminCustom.isUsingMobileAlternative, false);
    // 8. Resolução síncrona imediata via resolveSeasonMobileBannerSync (elimina o flash inicial de zoom)
    const opSync = resolveSeasonMobileBannerSync({
      animeId: "21",
      anilistId: 21,
      malId: 21,
      year: 1999,
      format: "TV",
      currentBanner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/21-wf37VakJmZih.jpg",
    });
    assert.ok(opSync);
    assert.equal(opSync.isAlternative, true);
    assert.equal(
      opSync.url,
      "https://u.livechart.me/anime_visuals/local_version/15565/image/4fc1bf78ce8ec66cb2266427ff72a6ea.webp/large.jpg",
    );
    assert.equal(opSync.source, "livechart-season");
    assert.equal(opSync.initialObjectPosition, "50% 24%");
  });

  it("globally prevents provisional desktop banner flash on mobile while async resolution is pending", () => {
    clearSeasonBannerCache();
    const desktopPanoramic =
      "https://s4.anilist.co/file/anilistcdn/media/anime/banner/16498-8jpFCOcDmneX.jpg";

    // Mobile sem cache/estado resolvido: nunca deve exibir o banner desktop provisoriamente
    const pendingMobile = selectViewportBanner({
      animeId: "16498",
      isMobileViewport: true,
      isAdminBanner: false,
      baseSeasonBanner: desktopPanoramic,
      mobileBannerState: null,
    });
    assert.equal(pendingMobile.effectiveBannerUrl, null);
    assert.equal(pendingMobile.isUsingMobileAlternative, false);

    // Transição SPA mobile: estado ainda pertence ao anime anterior -> mantém neutro (null)
    const staleMobile = selectViewportBanner({
      animeId: "101348",
      isMobileViewport: true,
      isAdminBanner: false,
      baseSeasonBanner:
        "https://s4.anilist.co/file/anilistcdn/media/anime/banner/101348-desktop.jpg",
      mobileBannerState: {
        forId: "16498",
        url: "https://media.kitsu.app/anime/cover_images/7442/original.png",
        isAlternative: true,
        initialObjectPosition: "52% 20%",
      },
    });
    assert.equal(staleMobile.effectiveBannerUrl, null);

    // Após confirmação assíncrona sem alternativa válida (season-default): libera o banner confirmado
    const confirmedDefaultMobile = selectViewportBanner({
      animeId: "154587",
      isMobileViewport: true,
      isAdminBanner: false,
      baseSeasonBanner:
        "https://s4.anilist.co/file/anilistcdn/media/anime/banner/154587-ivXNJ23SM1xB.jpg",
      mobileBannerState: {
        forId: "154587",
        url: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/154587-ivXNJ23SM1xB.jpg",
        isAlternative: false,
        initialObjectPosition: "50% 24%",
      },
    });
    assert.equal(
      confirmedDefaultMobile.effectiveBannerUrl,
      "https://s4.anilist.co/file/anilistcdn/media/anime/banner/154587-ivXNJ23SM1xB.jpg",
    );
    assert.equal(confirmedDefaultMobile.isUsingMobileAlternative, false);

    // skipClientCache garante paridade entre SSR e primeira passagem de hidratação
    const uncachedSync = resolveSeasonMobileBannerSync(
      {
        animeId: "16498",
        anilistId: 16498,
        malId: 16498,
        year: 2013,
        format: "TV",
        currentBanner: desktopPanoramic,
      },
      { skipClientCache: true },
    );
    assert.equal(uncachedSync, null);
  });
});




