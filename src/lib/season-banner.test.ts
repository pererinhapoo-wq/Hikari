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

  it("preserves Admin custom banner and unreleased season official banner without external calls", async () => {
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
});

