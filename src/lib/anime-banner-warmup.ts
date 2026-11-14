import { fetchJikanPictures } from "@/lib/api";
import { mergeDetail } from "@/lib/overlay";
import {
  hasAdminCustomBanner,
  resolveSeasonMobileBanner,
  resolveSeasonMobileBannerSync,
} from "@/lib/season-banner";
import { useHikariStore } from "@/lib/store";
import type { Anime } from "@/lib/types";

const MOBILE_BANNER_MEDIA_QUERY = "(max-width: 639.98px)";
const MAX_WARMED_BANNERS = 12;
const warmedBannerElements = new Map<string, HTMLImageElement>();

export function warmBannerImage(url: string | null | undefined): void {
  if (typeof window === "undefined") return;
  const clean = url?.trim();
  if (!clean || warmedBannerElements.has(clean)) return;

  if (warmedBannerElements.size >= MAX_WARMED_BANNERS) {
    const oldestKey = warmedBannerElements.keys().next().value;
    if (oldestKey) {
      warmedBannerElements.delete(oldestKey);
    }
  }

  const img = new Image();
  img.decoding = "async";
  img.fetchPriority = "high";
  img.src = clean;
  warmedBannerElements.set(clean, img);
}

function buildWarmupSeasonBannerInput(
  animeId: string,
  anime: Pick<
    Anime,
    | "anilistId"
    | "malId"
    | "kitsuId"
    | "year"
    | "startDate"
    | "format"
    | "status"
    | "banner"
    | "cover"
    | "images"
  >,
  isAdminCustomBanner: boolean,
) {
  const parsedAniId =
    anime.anilistId ?? (/^\d+$/.test(animeId) ? Number(animeId) : undefined);
  const parsedMalId =
    anime.malId ??
    (animeId.startsWith("mal-")
      ? Number(animeId.replace("mal-", ""))
      : undefined);
  const parsedKitsuId =
    anime.kitsuId ??
    (animeId.startsWith("kitsu-")
      ? Number(animeId.replace("kitsu-", ""))
      : undefined);

  return {
    animeId,
    anilistId:
      parsedAniId && Number.isFinite(parsedAniId) ? parsedAniId : undefined,
    malId:
      parsedMalId && Number.isFinite(parsedMalId) ? parsedMalId : undefined,
    kitsuId:
      parsedKitsuId && Number.isFinite(parsedKitsuId)
        ? parsedKitsuId
        : undefined,
    year: anime.year ?? null,
    startYear: anime.startDate?.year ?? null,
    format: anime.format ?? null,
    status: anime.status ?? null,
    currentBanner: anime.banner ?? null,
    currentCover: anime.cover ?? null,
    isAdminCustomBanner,
    preloadedMalPictures: anime.images,
    fetchJikanPictures,
  };
}

export function warmAnimeBannerOnClient(
  animeId: string,
  remote: Anime | null,
): void {
  if (typeof window === "undefined" || !animeId) return;

  const locals = useHikariStore.getState().animes;
  const merged = mergeDetail(remote, animeId, locals);
  if (!merged) return;

  const localRecord = locals.find(
    (a) =>
      a.id === merged.id ||
      (merged.anilistId != null && a.anilistId === merged.anilistId),
  );
  const adminBanner = hasAdminCustomBanner(localRecord, remote);
  const baseBanner =
    adminBanner && localRecord?.banner?.trim()
      ? localRecord.banner.trim()
      : (merged.banner?.trim() || null);

  const isMobile = window.matchMedia(MOBILE_BANNER_MEDIA_QUERY).matches;
  if (adminBanner || !isMobile) {
    warmBannerImage(baseBanner);
    return;
  }

  if (merged.resolvedMobileBanner) {
    warmBannerImage(merged.resolvedMobileBanner.url ?? baseBanner);
    return;
  }

  const seasonInput = buildWarmupSeasonBannerInput(merged.id, merged, false);
  const sync = resolveSeasonMobileBannerSync(seasonInput);
  if (sync) {
    warmBannerImage(sync.url ?? baseBanner);
    return;
  }

  void resolveSeasonMobileBanner(seasonInput).then((resolved) => {
    if (resolved.url) {
      warmBannerImage(resolved.url);
    }
  });
}
