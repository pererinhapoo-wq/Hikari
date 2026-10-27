import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computePanoramicFocalPercentFromColumns,
  hasAdminCustomBanner,
  initialObjectPositionForAspect,
  isCorsCapableBannerOrigin,
  isSeasonYearConsistent,
  isValidPermanentKitsuSeasonUrl,
  normalizeBannerUrl,
  parseImageDimensionsFromBuffer,
  probeImageDimensions,
  resolveSeasonMobileBanner,
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

  it("preserves Admin custom banner and maintains safe season default fallback for unreleased seasons", async () => {
    const adminRes = await resolveSeasonMobileBanner({
      animeId: "176301",
      anilistId: 176301,
      currentBanner: "https://custom.example.com/admin-banner.jpg",
      isAdminCustomBanner: true,
    });
    assert.equal(adminRes.source, "admin");
    assert.equal(adminRes.url, "https://custom.example.com/admin-banner.jpg");
    assert.equal(adminRes.isAlternative, false);

    const unreleasedRes = await resolveSeasonMobileBanner({
      animeId: "195516",
      anilistId: 195516,
      status: "NOT_YET_RELEASED",
      currentBanner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/195516-B5M0cPaQbQXI.jpg",
      isAdminCustomBanner: false,
    });
    assert.equal(unreleasedRes.source, "season-default");
    assert.equal(
      unreleasedRes.url,
      "https://s4.anilist.co/file/anilistcdn/media/anime/banner/195516-B5M0cPaQbQXI.jpg",
    );
    assert.equal(unreleasedRes.isAlternative, false);
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

    // Imagens com proporção inferior a 1.48 (< 1.48, ex.: 1.405, 4:3 1.33) recebem enquadramento equilibrado
    assert.equal(initialObjectPositionForAspect(1.405), "50% 40%");
    assert.equal(initialObjectPositionForAspect(1.333), "50% 40%");

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
    assert.equal(initialObjectPositionForAspect(kizu3Aspect), "50% 40%");

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
    assert.equal(res.initialObjectPosition, "50% 40%");
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
});



