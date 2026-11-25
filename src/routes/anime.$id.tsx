import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Bookmark,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Film,
  Heart,
  LogIn,
  Play,
  X,
} from "lucide-react";
import type {
  TrackingStatus,
  UserAnimeTrackingItem,
} from "@/types/profile-tracking";
import type { FavoriteTargetType } from "@/types/favorite";
import { CardFavoriteButton } from "@/components/anime/CardFavoriteButton";
import { triggerMonetagSmartLinkOnNavigationClick } from "@/lib/monetag-smartlink";
import {
  Suspense,
  createContext,
  lazy,
  memo,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";

interface FavoritesEntityContextType {
  isEntityFavorited: (
    targetType: "character" | "studio" | "person",
    targetId: string,
    name?: string,
  ) => boolean;
  toggleEntityFavorite: (params: {
    targetType: "character" | "studio" | "person";
    targetId: string;
    name: string;
    characterSnapshot?: {
      name: string;
      nativeName?: string | null;
      imageUrl?: string | null;
      role?: string | null;
      description?: string | null;
    };
    studioSnapshot?: {
      name: string;
      logoUrl?: string | null;
      establishedYear?: number | null;
      description?: string | null;
    };
    personSnapshot?: {
      name: string;
      nativeName?: string | null;
      imageUrl?: string | null;
      biography?: string | null;
      primaryOccupation?: string | null;
    };
  }) => Promise<void>;
}

const FavoritesEntityContext = createContext<FavoritesEntityContextType>({
  isEntityFavorited: () => false,
  toggleEntityFavorite: async () => {},
});

const useFavoritesEntity = () => useContext(FavoritesEntityContext);

import { AnimeCard } from "@/components/anime-card";
import { HikariImage } from "@/components/ui/hikari-image";
const DeferredAnimeComments = lazy(
  () => import("@/components/comments/DeferredAnimeComments"),
);
import { SectionReveal } from "@/components/section-reveal";
import { useScrollLock } from "@/lib/scroll-lock";
import { anilistImage, getSmallImageFallback } from "@/lib/image-utils";
import {
  buildCleanCanonical,
  buildTVSeriesJsonLd,
  DEFAULT_OG_IMAGE,
  truncateSynopsis,
} from "@/lib/seo";
import {
  fetchAnimeCredits,
  fetchAnimeDetail,
  fetchAnimeEpisodes,
  fetchAnimePictures,
  fetchAnimeSeasonNavigation,
  fromCache,
  toCache,
} from "@/lib/api";
import { isHikariAdmin } from "@/lib/auth/admin";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  formatDateLabel,
  formatLabel,
  genreLabel,
  ratingLabel,
  scoreLabel,
  seasonLabel,
  sourceLabel,
  staffRoleLabel,
  statusLabel,
} from "@/lib/labels";
import { mergeDetail, overlayList } from "@/lib/overlay";
import { sortByHasEpisodeFirst } from "@/lib/anime-search-ranking";
import {
  analyzeBannerFramingAndTheme,
  hasAdminCustomBanner,
  resolveSeasonMobileBanner,
  resolveSeasonMobileBannerSync,
  selectViewportBanner,
} from "@/lib/season-banner";
import {
  hydrateAnimeWatchedEpisodes,
  invalidateWatchedEpisodesCache,
  syncAuthenticatedWatchedEpisodes,
  useHikariStore,
} from "@/lib/store";
import {
  buildResolvedSeasons,
  executeGetCatalogEpisodes,
  getCachedCatalogEpisodes,
  getCachedResolvedSeasons,
  getCatalogEpisodes,
  primeCatalogEpisodesCache,
  resolveEpisodes,
} from "@/lib/catalog-episodes";
import { resolveEpisodeThumbnailUrl } from "@/lib/published-episodes";
import {
  displayTitle,
  type Anime,
  type AnimeCharacter,
  type AnimeStaff,
  type Episode,
  type Season,
  type SlimAnime,
} from "@/lib/types";
import {
  getKnownViewerId,
  invalidateAccountProfileCache,
  invalidatePublicProfileCacheByUserId,
} from "@/lib/profile-client-cache";
import {
  clearInFlightAnimeInitialState,
  consumeInFlightAnimeInitialState,
  fetchAnimeTrackingSingleflight,
  getCachedAnimeFavorite,
  getCachedAnimeTracking,
  getInFlightAnimeInitialState,
  getTrackingCacheEpoch,
  hasFavoriteMutationSince,
  hasTrackedMutationSince,
  invalidatePaginatedTrackingCache,
  isInitialAnimeFavoriteFresh,
  isInitialAnimeTrackingFresh,
  markFavoriteMutated,
  markTrackingMutated,
  recordInitialAnimeTrackingLoaded,
  registerInFlightAnimeInitialState,
  seedAnimeFavoriteCache,
  seedAnimeTrackingCache,
} from "@/lib/tracking-client-cache";
import { cn, stripHtml, youtubeIdFrom } from "@/lib/utils";
import {
  fetchAnimeUserInitialState,
  getMyAnimeTracking,
  removeAnimeTracking,
  upsertAnimeTracking,
} from "@/lib/profile-tracking.functions";
import type { AnimeUserInitialState } from "@/types/profile-tracking";
import {
  getAnimeUserClientCache,
  saveAnimeUserClientCache,
} from "@/lib/anime-user-client-cache";
import {
  addProfileFavorite,
  getMyProfileFavorites,
  removeProfileFavorite,
} from "@/lib/profile-favorites.functions";
import type { SelectedEntityTarget } from "@/components/anime/EntityWorksExpansion";

const ProfileAnimeEditModal = lazy(() =>
  import("@/components/profile/ProfileAnimeEditModal").then((mod) => ({
    default: mod.ProfileAnimeEditModal,
  })),
);
const EntityWorksExpansion = lazy(() =>
  import("@/components/anime/EntityWorksExpansion").then((mod) => ({
    default: mod.EntityWorksExpansion,
  })),
);
const DubladorWorksView = lazy(() =>
  import("@/components/anime/EntityWorksExpansion").then((mod) => ({
    default: mod.DubladorWorksView,
  })),
);
const StaffWorksView = lazy(() =>
  import("@/components/anime/EntityWorksExpansion").then((mod) => ({
    default: mod.StaffWorksView,
  })),
);
const StudioProductionsView = lazy(() =>
  import("@/components/anime/EntityWorksExpansion").then((mod) => ({
    default: mod.StudioProductionsView,
  })),
);

function notifyToast(
  type: "success" | "info" | "error",
  message: string,
) {
  void import("sonner").then(({ toast }) => {
    toast[type](message);
  });
}

const EMPTY_WATCHED_EPISODES: string[] = [];
const MOBILE_BANNER_MEDIA_QUERY = "(max-width: 639.98px)";
const DESKTOP_BANNER_MEDIA_QUERY = "(min-width: 640px)";
const TRANSPARENT_BANNER_PIXEL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

const clientHydrationState = { hydrated: false };

function setCappedClientMap<K, V>(map: Map<K, V>, key: K, value: V, maxEntries = 50): void {
  if (map.has(key)) {
    map.delete(key);
  } else if (map.size >= maxEntries) {
    const oldestKey = map.keys().next().value;
    if (oldestKey !== undefined) {
      map.delete(oldestKey);
    }
  }
  map.set(key, value);
}

const clientCreditsCache = new Map<
  string,
  {
    studios: string[];
    characters: AnimeCharacter[];
    staff: AnimeStaff[];
  }
>();
const clientCreditsInFlight = new Set<string>();
const clientEpisodesCache = new Map<string, Episode[]>();
const clientEpisodesInFlight = new Set<string>();
const clientPicturesCache = new Map<number, string[]>();
const clientPicturesInFlight = new Set<number>();
const clientSeasonNavCache = new Map<
  string,
  Array<{ id: string; label?: string; title?: string }>
>();
const clientSeasonNavInFlight = new Set<string>();

function buildSeasonBannerInputFromAnime(
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
  };
}

export const Route = createFileRoute("/anime/$id")({
  validateSearch: (
    raw: Record<string, unknown>,
  ): {
    comment?: string;
    studio?: string;
    dublador?: string;
    dubladorId?: string;
    staff?: string;
    staffId?: string;
  } => ({
    comment:
      typeof raw.comment === "string" && raw.comment
        ? raw.comment
        : undefined,
    studio:
      typeof raw.studio === "string" && raw.studio
        ? raw.studio
        : undefined,
    dublador:
      typeof raw.dublador === "string" && raw.dublador
        ? raw.dublador
        : undefined,
    dubladorId:
      typeof raw.dubladorId === "string" || typeof raw.dubladorId === "number"
        ? String(raw.dubladorId)
        : undefined,
    staff:
      typeof raw.staff === "string" && raw.staff
        ? raw.staff
        : undefined,
    staffId:
      typeof raw.staffId === "string" || typeof raw.staffId === "number"
        ? String(raw.staffId)
        : undefined,
  }),
  staleTime: 1000 * 60 * 5,
  gcTime: 1000 * 60 * 15,
  loader: async ({ params }) => {
    const detailKey = `detail:v7:${params.id}`;
    const cachedRemote = fromCache<Anime | null>(detailKey, () =>
      fetchAnimeDetail({ data: { id: params.id } }),
    );
    const cachedClientEpisodes =
      typeof window !== "undefined" ? getCachedCatalogEpisodes(params.id) : null;

    const [resolvedRemote, initialCatalogEpisodes] = await Promise.all([
      cachedRemote
        ? Promise.resolve(cachedRemote)
        : fetchAnimeDetail({ data: { id: params.id } }).then((fetched) => {
            if (fetched) {
              toCache(detailKey, fetched);
              if (fetched.id && fetched.id !== params.id) {
                toCache(`detail:v7:${fetched.id}`, fetched);
              }
            }
            return fetched;
          }),
      cachedClientEpisodes
        ? Promise.resolve(cachedClientEpisodes)
        : (typeof window === "undefined"
            ? executeGetCatalogEpisodes(params.id)
            : getCatalogEpisodes({ data: { animeId: params.id } })
          ).catch(() => null),
    ]);

    const remote = resolvedRemote;
    let catalogEpisodes = initialCatalogEpisodes;
    if (
      remote?.serverCatalogId &&
      remote.serverCatalogId !== params.id &&
      (!catalogEpisodes || catalogEpisodes.episodes.length === 0)
    ) {
      catalogEpisodes = await (typeof window === "undefined"
        ? executeGetCatalogEpisodes(remote.serverCatalogId)
        : getCatalogEpisodes({ data: { animeId: remote.serverCatalogId } })
      ).catch(() => catalogEpisodes);
    }

    if (typeof window !== "undefined") {
      void import("@/lib/anime-banner-warmup").then((m) =>
        m.warmAnimeBannerOnClient(params.id, remote),
      );
    }

    const candidateIds = Array.from(
      new Set(
        [
          params.id,
          remote?.id,
          remote?.serverCatalogId,
          remote?.resolvedFromAliasId,
          ...(remote?.resolvedAliasIds ?? []),
          remote?.anilistId != null ? String(remote.anilistId) : null,
          remote?.malId != null ? `mal-${remote.malId}` : null,
          remote?.malId != null ? String(remote.malId) : null,
          remote?.kitsuId != null ? `kitsu-${remote.kitsuId}` : null,
          remote?.kitsuId != null ? String(remote.kitsuId) : null,
        ].filter((x): x is string => typeof x === "string" && Boolean(x.trim())),
      ),
    );

    const titles = remote
      ? [
          (remote as unknown as { title?: string }).title,
          remote.titles?.romaji,
          remote.titles?.english,
          remote.titles?.native,
        ].filter((x): x is string => typeof x === "string" && Boolean(x.trim()))
      : [];

    let initialUserStatus: AnimeUserInitialState | null = null;
    let initialStateRequestId: string | undefined;
    const fetchUserPromise = fetchAnimeUserInitialState({
      data: {
        animeId: remote?.id || params.id,
        candidateIds,
        titles,
      },
    }).catch(() => null);

    if (typeof window !== "undefined") {
      const requestEpoch = getTrackingCacheEpoch();
      const handle = registerInFlightAnimeInitialState(
        fetchUserPromise,
        requestEpoch,
      );
      const knownViewer = getKnownViewerId();
      const localCachedUser = knownViewer
        ? getAnimeUserClientCache(candidateIds, knownViewer)
        : null;
      const memoryCachedTracking = knownViewer
        ? getCachedAnimeTracking(knownViewer, candidateIds)
        : null;
      const memoryCachedFavorite = knownViewer
        ? getCachedAnimeFavorite(knownViewer, candidateIds)
        : null;
      const hasReliableTrackingCache = Boolean(
        memoryCachedTracking ||
          (localCachedUser && localCachedUser.trackingStatus !== undefined),
      );
      const hasReliableFavoriteCache = Boolean(
        memoryCachedFavorite ||
          (localCachedUser && typeof localCachedUser.isFavorite === "boolean"),
      );
      const hasReliableClientCache = Boolean(
        knownViewer && hasReliableTrackingCache && hasReliableFavoriteCache,
      );

      if (hasReliableClientCache) {
        initialUserStatus = await Promise.race([
          handle.promise,
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 80)),
        ]);
      } else {
        // Sem cache confiável do usuário atual: aguarda o estado completo sem retornar null por timeout
        initialUserStatus = await handle.promise;
      }

      if (initialUserStatus?.userId) {
        clearInFlightAnimeInitialState(handle.requestId);
        recordInitialAnimeTrackingLoaded(
          initialUserStatus.userId,
          candidateIds,
          initialUserStatus,
        );
      } else if (handle.isSettled()) {
        clearInFlightAnimeInitialState(handle.requestId);
      } else {
        // Timeout atingido no caminho rápido enquanto fetchUserPromise segue em andamento:
        // entrega o requestId para reutilizar a mesma resposta e evitar consulta duplicada
        initialStateRequestId = handle.requestId;
      }
    } else {
      // No SSR aguarda completamente para garantir consistência no HTML
      initialUserStatus = await fetchUserPromise;
    }

    return { remote, catalogEpisodes, initialUserStatus, initialStateRequestId };
  },
  head: ({ loaderData, params }) => {
    const remote = loaderData?.remote ?? null;
    if (!remote) {
      return {};
    }

    const animeId = remote.id || params.id;
    const desktopBanner = remote.banner?.trim() || null;
    const syncMobile =
      remote.resolvedMobileBanner ??
      (animeId
        ? resolveSeasonMobileBannerSync(
            buildSeasonBannerInputFromAnime(animeId, remote, false),
            {
              skipClientCache:
                typeof window === "undefined" || !clientHydrationState.hydrated,
            },
          )
        : null);

    const usesKitsuMedia =
      Boolean(syncMobile?.url && syncMobile.url.includes("media.kitsu.app")) ||
      Boolean(desktopBanner && desktopBanner.includes("media.kitsu.app")) ||
      Boolean(remote.kitsuId) ||
      params.id.startsWith("kitsu-");

    const links: Array<{
      rel: string;
      as?: string;
      href: string;
      media?: string;
      imageSizes?: string;
      fetchPriority?: "high" | "low" | "auto";
    }> = [];

    const canonicalUrl = buildCleanCanonical(`/anime/${animeId}`);
    links.push({
      rel: "canonical",
      href: canonicalUrl,
    });

    if (usesKitsuMedia) {
      links.push(
        {
          rel: "preconnect",
          href: "https://media.kitsu.app",
        },
      );
    }

    if (syncMobile?.isAlternative && syncMobile.url) {
      links.push(
        {
          rel: "preload",
          as: "image",
          href: anilistImage(syncMobile.url, 640),
          media: MOBILE_BANNER_MEDIA_QUERY,
          imageSizes: "100vw",
          fetchPriority: "high",
        },
        ...(desktopBanner
          ? [
              {
                rel: "preload",
                as: "image",
                href: anilistImage(desktopBanner, 1600),
                media: DESKTOP_BANNER_MEDIA_QUERY,
                imageSizes: "100vw",
                fetchPriority: "high" as const,
              },
            ]
          : []),
      );
    } else if (desktopBanner) {
      links.push({
        rel: "preload",
        as: "image",
        href: anilistImage(desktopBanner, 1600),
        ...(syncMobile ? {} : { media: DESKTOP_BANNER_MEDIA_QUERY }),
        imageSizes: "100vw",
        fetchPriority: "high",
      });
    } else if (remote.cover && syncMobile) {
      links.push({
        rel: "preload",
        as: "image",
        href: anilistImage(remote.cover, 640),
        imageSizes: "100vw",
        fetchPriority: "high",
      });
    }

    const animeTitle =
      displayTitle(remote) ||
      remote.titles?.romaji ||
      remote.titles?.english ||
      "Anime";
    const pageTitle = `${animeTitle} — HIKARI`;
    const synopsisTruncated = truncateSynopsis(remote.synopsis, 155);
    const coverImageExtraLarge =
      (remote as { coverImage?: { extraLarge?: string } }).coverImage?.extraLarge ||
      remote.cover ||
      DEFAULT_OG_IMAGE;

    const meta = [
      { title: pageTitle },
      { name: "description", content: synopsisTruncated },
      { property: "og:title", content: pageTitle },
      { property: "og:description", content: synopsisTruncated },
      { property: "og:image", content: coverImageExtraLarge },
      { property: "og:url", content: canonicalUrl },
      { property: "og:type", content: "article" },
      { property: "og:locale", content: "pt_BR" },
      { property: "og:site_name", content: "HIKARI" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: pageTitle },
      { name: "twitter:description", content: synopsisTruncated },
      { name: "twitter:image", content: coverImageExtraLarge },
    ];

    const alternateNames: string[] = [];
    if (remote.titles?.english && remote.titles.english !== animeTitle) {
      alternateNames.push(remote.titles.english);
    }
    if (remote.titles?.native && remote.titles.native !== animeTitle) {
      alternateNames.push(remote.titles.native);
    }
    if (remote.titles?.romaji && remote.titles.romaji !== animeTitle) {
      alternateNames.push(remote.titles.romaji);
    }

    const jsonLd = buildTVSeriesJsonLd({
      name: animeTitle,
      alternateName: alternateNames.length > 0 ? alternateNames : undefined,
      image: coverImageExtraLarge,
      description: stripHtml(remote.synopsis || "").trim(),
      numberOfEpisodes:
        remote.episodesCount ||
        (remote.seasons?.[0]?.episodes?.length ? remote.seasons[0].episodes.length : null),
      datePublished: remote.startDate?.year
        ? `${remote.startDate.year}-${String(remote.startDate.month || 1).padStart(2, "0")}-${String(remote.startDate.day || 1).padStart(2, "0")}`
        : remote.year
          ? `${remote.year}-01-01`
          : undefined,
      genre: remote.genres,
      score: remote.score,
      studio: remote.studios?.[0],
    });

    const scripts = [
      {
        type: "application/ld+json",
        children: JSON.stringify(jsonLd),
      },
    ];

    return {
      meta,
      links,
      scripts,
    };
  },

  pendingComponent: () => (
    <div className="space-y-4 pt-4">
      <div className="-mx-4 h-56 animate-pulse bg-elevated sm:-mx-6 sm:h-72" />

      <div className="h-8 w-2/3 animate-pulse rounded bg-elevated" />

      <div className="h-24 rounded bg-elevated" />
    </div>
  ),

  component: AnimePage,
});


const COLLECTION_STATUS_CONFIG: Record<
  TrackingStatus,
  {
    label: string;
    border: string;
    bg: string;
    shadow: string;
    glowDot: string;
    pillBg: string;
    pillText: string;
    textColor: string;
  }
> = {
  watching: {
    label: "Assistindo",
    border: "border-emerald-500/40 hover:border-emerald-400/80",
    bg: "from-[#081b14]/95 via-[#0e271d]/90 to-[#071510]/95",
    shadow:
      "shadow-[0_4px_20px_rgba(0,0,0,0.5),0_0_20px_rgba(16,185,129,0.22)] hover:shadow-[0_6px_26px_rgba(0,0,0,0.6),0_0_28px_rgba(16,185,129,0.4)]",
    glowDot: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.95)]",
    pillBg: "bg-emerald-500/20 border-emerald-400/30",
    pillText: "text-emerald-300",
    textColor: "text-emerald-100",
  },
  completed: {
    label: "Concluído",
    border: "border-violet-500/40 hover:border-violet-400/80",
    bg: "from-[#1b1032]/95 via-[#231540]/90 to-[#120b24]/95",
    shadow:
      "shadow-[0_4px_20px_rgba(0,0,0,0.5),0_0_20px_rgba(168,85,247,0.25)] hover:shadow-[0_6px_26px_rgba(0,0,0,0.6),0_0_28px_rgba(168,85,247,0.45)]",
    glowDot: "bg-violet-400 shadow-[0_0_8px_rgba(192,132,252,0.95)]",
    pillBg: "bg-violet-500/20 border-violet-400/30",
    pillText: "text-violet-300",
    textColor: "text-violet-100",
  },
  on_hold: {
    label: "Em espera",
    border: "border-amber-500/40 hover:border-amber-400/80",
    bg: "from-[#221408]/95 via-[#2e1c0c]/90 to-[#160d05]/95",
    shadow:
      "shadow-[0_4px_20px_rgba(0,0,0,0.5),0_0_20px_rgba(245,158,11,0.22)] hover:shadow-[0_6px_26px_rgba(0,0,0,0.6),0_0_28px_rgba(245,158,11,0.4)]",
    glowDot: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.95)]",
    pillBg: "bg-amber-500/20 border-amber-400/30",
    pillText: "text-amber-300",
    textColor: "text-amber-100",
  },
  dropped: {
    label: "Abandonado",
    border: "border-rose-500/40 hover:border-rose-400/80",
    bg: "from-[#260a14]/95 via-[#340e1b]/90 to-[#18050d]/95",
    shadow:
      "shadow-[0_4px_20px_rgba(0,0,0,0.5),0_0_20px_rgba(244,63,94,0.22)] hover:shadow-[0_6px_26px_rgba(0,0,0,0.6),0_0_28px_rgba(244,63,94,0.4)]",
    glowDot: "bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.95)]",
    pillBg: "bg-rose-500/20 border-rose-400/30",
    pillText: "text-rose-300",
    textColor: "text-rose-100",
  },
  planning: {
    label: "Planejado",
    border: "border-sky-500/40 hover:border-sky-400/80",
    bg: "from-[#081928]/95 via-[#0d243a]/90 to-[#05111e]/95",
    shadow:
      "shadow-[0_4px_20px_rgba(0,0,0,0.5),0_0_20px_rgba(14,165,233,0.22)] hover:shadow-[0_6px_26px_rgba(0,0,0,0.6),0_0_28px_rgba(14,165,233,0.4)]",
    glowDot: "bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.95)]",
    pillBg: "bg-sky-500/20 border-sky-400/30",
    pillText: "text-sky-300",
    textColor: "text-sky-100",
  },
};

function makeAnimeSnapshot(anime: Anime) {
  return {
    title: displayTitle(anime),
    titleRomaji: anime.titles?.romaji || null,
    titleEnglish: anime.titles?.english || null,
    titleNative: anime.titles?.native || null,
    cover: anime.cover || null,
    banner: anime.banner || null,
    synopsis: anime.synopsis || null,
    format: anime.format || null,
    year: anime.year || anime.startDate?.year || null,
    episodesCount:
      anime.episodesCount || (anime.seasons?.[0]?.episodes?.length ?? null),
    status: anime.status || null,
    score: anime.score || null,
    anilistId: anime.anilistId ?? null,
    malId: anime.malId ?? null,
    kitsuId: anime.kitsuId ?? null,
    serverCatalogId: anime.serverCatalogId ?? null,
  };
}


const TrailerFacade = memo(function TrailerFacade({
  videoId,
  title,
}: {
  videoId: string;
  title: string;
}) {
  return (
    <div className="mt-4 aspect-video w-full overflow-hidden rounded-2xl border border-purple-500/20 bg-[#0d0b18] shadow-[0_8px_30px_rgba(0,0,0,0.6)] [contain:layout_paint]">
      <iframe
        key={videoId}
        title={`Trailer de ${title}`}
        src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0`}
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        className="size-full border-0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
});

function AnimePage() {
  const { id } = Route.useParams();
  const { remote, catalogEpisodes, initialUserStatus, initialStateRequestId } =
    Route.useLoaderData();
  return (
    <AnimePageContent
      key={id}
      id={id}
      remote={remote}
      catalogEpisodes={catalogEpisodes}
      initialUserStatus={initialUserStatus}
      initialStateRequestId={initialStateRequestId}
    />
  );
}

const ANILIST_CANONICAL_ID_RE = /^anilist-(\d+)$/;
const NUMERIC_ANILIST_ID_RE = /^\d+$/;

function extractNormalizedAniListNumericId(
  value: string | number | null | undefined,
): string | null {
  if (typeof value === "number") {
    if (!Number.isInteger(value) || value < 0) return null;
    return String(value);
  }
  if (typeof value !== "string") return null;
  const canonicalMatch = ANILIST_CANONICAL_ID_RE.exec(value);
  if (canonicalMatch) return canonicalMatch[1];
  if (NUMERIC_ANILIST_ID_RE.test(value)) return value;
  return null;
}

function matchesRouteAnimeIdentifier(
  rawRemote: Anime,
  routeId: string,
): boolean {
  if (rawRemote.id === routeId) {
    return true;
  }
  if (rawRemote.serverCatalogId && rawRemote.serverCatalogId === routeId) {
    return true;
  }
  if (rawRemote.resolvedFromAliasId && rawRemote.resolvedFromAliasId === routeId) {
    return true;
  }
  if (rawRemote.resolvedAliasIds && rawRemote.resolvedAliasIds.includes(routeId)) {
    return true;
  }
  if (rawRemote.anilistId != null && String(rawRemote.anilistId) === routeId) {
    return true;
  }

  const normalizedRouteAniListId = extractNormalizedAniListNumericId(routeId);
  if (!normalizedRouteAniListId) {
    return false;
  }

  if (
    rawRemote.anilistId != null &&
    NUMERIC_ANILIST_ID_RE.test(String(rawRemote.anilistId)) &&
    String(rawRemote.anilistId) === normalizedRouteAniListId
  ) {
    return true;
  }

  const normalizedRemoteId = extractNormalizedAniListNumericId(rawRemote.id);
  if (normalizedRemoteId && normalizedRemoteId === normalizedRouteAniListId) {
    return true;
  }

  const normalizedServerCatalogId = extractNormalizedAniListNumericId(
    rawRemote.serverCatalogId,
  );
  if (
    normalizedServerCatalogId &&
    normalizedServerCatalogId === normalizedRouteAniListId
  ) {
    return true;
  }

  return false;
}

function AnimePageContent({
  id,
  remote: rawRemote,
  catalogEpisodes,
  initialUserStatus,
  initialStateRequestId,
}: {
  id: string;
  remote: Anime | null;
  catalogEpisodes: Awaited<ReturnType<typeof executeGetCatalogEpisodes>> | null;
  initialUserStatus: AnimeUserInitialState | null;
  initialStateRequestId?: string;
}) {
  const activeAnimeIdRef = useRef(id);
  activeAnimeIdRef.current = id;

  const remote = useMemo(() => {
    if (!rawRemote) return null;
    return matchesRouteAnimeIdentifier(rawRemote, id) ? rawRemote : null;
  }, [rawRemote, id]);
  const search = Route.useSearch();
  const targetCommentId = search?.comment;
  const rawStudioParam =
    search?.studio ||
    (typeof window !== "undefined"
      ? (new URLSearchParams(window.location.search).get("studio") as string | null)
      : null);
  const studioParam = rawStudioParam?.trim() || undefined;

  const rawDubladorParam =
    search?.dublador ||
    (typeof window !== "undefined"
      ? (new URLSearchParams(window.location.search).get("dublador") as string | null)
      : null);
  const dubladorParam = rawDubladorParam?.trim() || undefined;
  const dubladorIdParam =
    search?.dubladorId ||
    (typeof window !== "undefined"
      ? (new URLSearchParams(window.location.search).get("dubladorId") as string | null)
      : null);

  const rawStaffParam =
    search?.staff ||
    (typeof window !== "undefined"
      ? (new URLSearchParams(window.location.search).get("staff") as string | null)
      : null);
  const staffParam = rawStaffParam?.trim() || undefined;
  const staffIdParam =
    search?.staffId ||
    (typeof window !== "undefined"
      ? (new URLSearchParams(window.location.search).get("staffId") as string | null)
      : null);

  const [hasCommentHash, setHasCommentHash] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.location.hash.toLowerCase().includes("comment");
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const checkHash = () => {
      if (window.location.hash.toLowerCase().includes("comment")) {
        setHasCommentHash(true);
      }
    };
    checkHash();
    window.addEventListener("hashchange", checkHash);
    return () => window.removeEventListener("hashchange", checkHash);
  }, []);

  const shouldForceCommentsLoad = Boolean(targetCommentId || hasCommentHash);

  const hydrated = useHikariStore((s) => s.hydrated);

  const { user, isPending: userPending } = useCurrentUserState();
  const canEdit = isHikariAdmin(user?.primaryEmail);

  const locals = useHikariStore((s) => s.animes);

  const baseAnime = useMemo(
    () => mergeDetail(remote, id, locals),
    [remote, id, locals],
  );

  const matchedLocalForIds = useMemo(
    () =>
      baseAnime
        ? locals.find(
            (a) =>
              a.id === baseAnime.id ||
              (baseAnime.anilistId != null && a.anilistId === baseAnime.anilistId),
          )
        : undefined,
    [baseAnime, locals],
  );

  const canonicalNavigate = useNavigate();

  useEffect(() => {
    if (
      remote?.id &&
      remote.id !== id &&
      (remote.resolvedFromAliasId === id ||
        Boolean(remote.resolvedAliasIds?.includes(id)))
    ) {
      void canonicalNavigate({
        to: "/anime/$id",
        params: { id: remote.id },
        search: (prev) => prev,
        replace: true,
      });
    }
  }, [remote?.id, remote?.resolvedFromAliasId, remote?.resolvedAliasIds, id, canonicalNavigate]);

  const candidateAnimeIds = useMemo(() => {
    const raw = [
      baseAnime?.id,
      id,
      remote?.id,
      rawRemote?.id,
      remote?.serverCatalogId,
      rawRemote?.serverCatalogId,
      baseAnime?.serverCatalogId,
      remote?.resolvedFromAliasId,
      ...(remote?.resolvedAliasIds ?? []),
      rawRemote?.resolvedFromAliasId,
      ...(rawRemote?.resolvedAliasIds ?? []),
      baseAnime?.resolvedFromAliasId,
      ...(baseAnime?.resolvedAliasIds ?? []),
      matchedLocalForIds?.id,
      baseAnime?.anilistId != null ? String(baseAnime.anilistId) : null,
      remote?.anilistId != null ? String(remote.anilistId) : null,
      baseAnime?.malId != null ? `mal-${baseAnime.malId}` : null,
      baseAnime?.malId != null ? String(baseAnime.malId) : null,
      remote?.malId != null ? `mal-${remote.malId}` : null,
      remote?.malId != null ? String(remote.malId) : null,
      baseAnime?.kitsuId != null ? `kitsu-${baseAnime.kitsuId}` : null,
      baseAnime?.kitsuId != null ? String(baseAnime.kitsuId) : null,
      remote?.kitsuId != null ? `kitsu-${remote.kitsuId}` : null,
      remote?.kitsuId != null ? String(remote.kitsuId) : null,
    ];
    return Array.from(
      new Set(
        raw
          .filter((val): val is string => typeof val === "string")
          .map((val) => val.trim())
          .filter(Boolean),
      ),
    );
  }, [
    baseAnime?.id,
    id,
    remote?.id,
    rawRemote?.id,
    remote?.serverCatalogId,
    rawRemote?.serverCatalogId,
    baseAnime?.serverCatalogId,
    remote?.resolvedFromAliasId,
    remote?.resolvedAliasIds,
    rawRemote?.resolvedFromAliasId,
    rawRemote?.resolvedAliasIds,
    baseAnime?.resolvedFromAliasId,
    baseAnime?.resolvedAliasIds,
    matchedLocalForIds?.id,
    baseAnime?.anilistId,
    remote?.anilistId,
    baseAnime?.malId,
    remote?.malId,
    baseAnime?.kitsuId,
    remote?.kitsuId,
  ]);

  const candidateAnimeIdsKey = candidateAnimeIds.join("|");
  const candidateAnimeIdSet = useMemo(() => new Set(candidateAnimeIds), [candidateAnimeIds]);

  const inList = useHikariStore((s) => {
    const activeList = user?.id
      ? (s.userLists?.[user.id] ??
        (s.currentUserId === user.id ? s.myList : EMPTY_WATCHED_EPISODES))
      : s.currentUserId === null
        ? s.myList
        : EMPTY_WATCHED_EPISODES;
    return Boolean(
      activeList.some(
        (listItemId) => candidateAnimeIdSet.has(listItemId) || listItemId === id,
      ),
    );
  });

  const toggleList = useHikariStore((s) => s.toggleList);

  const continueEntry = useHikariStore((s) => {
    const list = user?.id
      ? (s.userContinueWatching?.[user.id] ??
        (s.currentUserId === user.id ? s.continueWatching : undefined))
      : (s.anonymousContinueWatching ??
        (s.currentUserId === null ? s.continueWatching : undefined));
    return list?.find(
      (entry) => candidateAnimeIdSet.has(entry.animeId) || entry.animeId === id,
    );
  });

  const userWatchedMap = useHikariStore((s) =>
    user?.id
      ? s.userWatchedEpisodes?.[user.id]
      : s.anonymousWatchedEpisodes,
  );

  const watchedEpisodes = useMemo(() => {
    if (
      user?.id &&
      initialUserStatus?.userId === user.id &&
      isInitialAnimeTrackingFresh(user.id, candidateAnimeIds, initialUserStatus) &&
      Array.isArray(initialUserStatus.watchedEpisodeIds)
    ) {
      return initialUserStatus.watchedEpisodeIds;
    }
    if (userWatchedMap) {
      if (userWatchedMap[id]) {
        return userWatchedMap[id];
      }
      for (const cid of candidateAnimeIds) {
        if (userWatchedMap[cid]) {
          return userWatchedMap[cid];
        }
      }
    }
    if (user?.id && initialUserStatus?.userId === user.id) {
      return initialUserStatus.watchedEpisodeIds ?? EMPTY_WATCHED_EPISODES;
    }
    return EMPTY_WATCHED_EPISODES;
  }, [
    user?.id,
    initialUserStatus,
    candidateAnimeIds,
    userWatchedMap,
    id,
  ]);

  const episodeCatalogId = baseAnime?.serverCatalogId || baseAnime?.id || id;

  const [resolvedSeasons, setResolvedSeasons] = useState<Season[] | null>(() => {
    if (catalogEpisodes) {
      const cacheKey = catalogEpisodes.animeId || episodeCatalogId;
      if (typeof window !== "undefined") {
        primeCatalogEpisodesCache(cacheKey, catalogEpisodes);
        if (episodeCatalogId && episodeCatalogId !== cacheKey) {
          primeCatalogEpisodesCache(episodeCatalogId, catalogEpisodes);
        }
        if (id && id !== cacheKey && id !== episodeCatalogId) {
          primeCatalogEpisodesCache(id, catalogEpisodes);
        }
      }
      return buildResolvedSeasons(cacheKey, catalogEpisodes, baseAnime?.seasons ?? []);
    }
    return getCachedResolvedSeasons(episodeCatalogId, baseAnime?.seasons);
  });

  useEffect(() => {
    if (!episodeCatalogId) return;

    let cancelled = false;
    void resolveEpisodes(episodeCatalogId, baseAnime?.seasons).then((seasons) => {
      if (cancelled) return;
      startTransition(() => {
        setResolvedSeasons((prev) => {
          const baseline = prev ?? baseAnime?.seasons ?? null;
          if (
            baseline &&
            baseline.length === seasons.length &&
            baseline.every((s, idx) => {
              const next = seasons[idx];
              if (!next || s.id !== next.id || s.episodes.length !== next.episodes.length) {
                return false;
              }
              return s.episodes.every((ep, epIdx) => {
                const nextEp = next.episodes[epIdx];
                return (
                  Boolean(nextEp) &&
                  ep.id === nextEp.id &&
                  ep.number === nextEp.number &&
                  ep.title === nextEp.title &&
                  ep.thumbnail === nextEp.thumbnail &&
                  ep.duration === nextEp.duration &&
                  ep.videoUrl === nextEp.videoUrl &&
                  ep.videoUrl2 === nextEp.videoUrl2 &&
                  ep.videoUrl3 === nextEp.videoUrl3 &&
                  ep.videoUrl4 === nextEp.videoUrl4 &&
                  ep.videoUrl5 === nextEp.videoUrl5 &&
                  ep.hikariPlayerEpisodeId === nextEp.hikariPlayerEpisodeId &&
                  ep.published === nextEp.published
                );
              });
            })
          ) {
            return prev;
          }
          return seasons;
        });
      });
    });

    return () => {
      cancelled = true;
    };
  }, [episodeCatalogId, baseAnime?.seasons]);

  const anime = useMemo(() => {
    if (!baseAnime) return null;
    if (!resolvedSeasons) return baseAnime;
    return {
      ...baseAnime,
      seasons: resolvedSeasons,
    };
  }, [baseAnime, resolvedSeasons]);

  const [extraCredits, setExtraCredits] = useState<{
    forId: string;
    studios: string[];
    characters: AnimeCharacter[];
    staff: AnimeStaff[];
  } | null>(() => {
    const cached = id ? clientCreditsCache.get(id) : null;
    return cached ? { forId: id, ...cached } : null;
  });

  const animeId = anime?.id;
  const animeAnilistId = anime?.anilistId;
  const animeMalId = anime?.malId;
  const animeKitsuId = anime?.kitsuId;
  const animeTitleRomaji = anime?.titles.romaji ?? "";
  const animeTitleEnglish = anime?.titles.english ?? "";
  const animeTitleNative = anime?.titles.native ?? "";
  const animeYear = anime?.year ?? null;
  const animeFormat = anime?.format ?? null;
  const hasCharacters = (anime?.characters?.length ?? 0) > 0;
  const hasStaff = (anime?.staff?.length ?? 0) > 0;
  const hasStudios = (anime?.studios?.length ?? 0) > 0;

  // Proximidade sob demanda: não inicia carregamentos pesados enquanto as seções estiverem distantes
  const [shouldLoadCredits, setShouldLoadCredits] = useState(() => {
    if (
      dubladorParam ||
      staffParam ||
      studioParam ||
      dubladorIdParam ||
      staffIdParam
    ) {
      return true;
    }
    if (id && clientCreditsCache.has(id)) {
      return true;
    }
    return false;
  });
  const creditsSentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (
      dubladorParam ||
      staffParam ||
      studioParam ||
      dubladorIdParam ||
      staffIdParam
    ) {
      setShouldLoadCredits(true);
      return;
    }
    if (id && clientCreditsCache.has(id)) {
      setShouldLoadCredits(true);
      return;
    }
    setShouldLoadCredits(false);
  }, [id, dubladorParam, staffParam, studioParam, dubladorIdParam, staffIdParam]);

  useEffect(() => {
    if (shouldLoadCredits) return;
    if (hasCharacters && hasStaff && hasStudios) return;
    if (typeof window === "undefined") return;

    let unmounted = false;
    let idleId: number | null = null;
    let timerId: ReturnType<typeof setTimeout> | null = null;

    const trigger = () => {
      if (!unmounted) {
        startTransition(() => {
          setShouldLoadCredits(true);
        });
      }
    };

    if ("requestIdleCallback" in window) {
      idleId = (window as Window & { requestIdleCallback: any }).requestIdleCallback(
        trigger,
        { timeout: 600 },
      );
    } else {
      timerId = setTimeout(trigger, 120);
    }

    return () => {
      unmounted = true;
      if (idleId !== null && "cancelIdleCallback" in window) {
        (window as Window & { cancelIdleCallback: any }).cancelIdleCallback(idleId);
      }
      if (timerId !== null) {
        clearTimeout(timerId);
      }
    };
  }, [shouldLoadCredits, hasCharacters, hasStaff, hasStudios]);

  useEffect(() => {
    if (!shouldLoadCredits) return;
    if (!animeId) return;
    if (hasCharacters && hasStaff && hasStudios) return;

    if (clientCreditsCache.has(animeId)) {
      const cached = clientCreditsCache.get(animeId)!;
      if (
        cached.characters.length > 0 ||
        cached.staff.length > 0 ||
        cached.studios.length > 0
      ) {
        setExtraCredits({
          forId: animeId,
          studios: cached.studios,
          characters: cached.characters,
          staff: cached.staff,
        });
      }
      return;
    }

    if (clientCreditsInFlight.has(animeId)) {
      return;
    }

    clientCreditsInFlight.add(animeId);
    let cancelled = false;

    const parsedAniId =
      animeAnilistId ??
      (/^\d+$/.test(animeId) ? Number(animeId) : undefined);
    const parsedMalId =
      animeMalId ??
      (animeId.startsWith("mal-")
        ? Number(animeId.replace("mal-", ""))
        : undefined);
    const parsedKitsuId =
      animeKitsuId ??
      (animeId.startsWith("kitsu-")
        ? Number(animeId.replace("kitsu-", ""))
        : undefined);
    const titles = [animeTitleRomaji, animeTitleEnglish, animeTitleNative].filter(
      (t) => Boolean(t && t.trim()),
    );

    fetchAnimeCredits({
      data: {
        anilistId:
          parsedAniId && Number.isFinite(parsedAniId) ? parsedAniId : undefined,
        malId:
          parsedMalId && Number.isFinite(parsedMalId) ? parsedMalId : undefined,
        kitsuId:
          parsedKitsuId && Number.isFinite(parsedKitsuId)
            ? parsedKitsuId
            : undefined,
        titles,
        year: animeYear,
        format: animeFormat,
        animeId,
      },
    })
      .then((res) => {
        if (!res) {
          setCappedClientMap(clientCreditsCache, animeId, {
            studios: [],
            characters: [],
            staff: [],
          });
          return;
        }

        setCappedClientMap(clientCreditsCache, animeId, {
          studios: res.studios,
          characters: res.characters,
          staff: res.staff,
        });

        if (cancelled || activeAnimeIdRef.current !== id) return;
        if (
          res.characters.length > 0 ||
          res.staff.length > 0 ||
          res.studios.length > 0
        ) {
          startTransition(() => {
            setExtraCredits({
              forId: animeId,
              studios: res.studios,
              characters: res.characters,
              staff: res.staff,
            });
          });
        }
      })
      .catch(() => {
        // Silencioso: preserva o que já estiver disponível na página
      })
      .finally(() => {
        clientCreditsInFlight.delete(animeId);
      });

    return () => {
      cancelled = true;
    };
  }, [
    shouldLoadCredits,
    id,
    animeId,
    animeAnilistId,
    animeMalId,
    animeKitsuId,
    animeTitleRomaji,
    animeTitleEnglish,
    animeTitleNative,
    animeYear,
    animeFormat,
    hasCharacters,
    hasStaff,
    hasStudios,
  ]);

  const activeExtraCredits =
    anime && extraCredits?.forId === anime.id ? extraCredits : null;

  const effectiveCharacters =
    anime?.characters && anime.characters.length > 0
      ? anime.characters
      : activeExtraCredits?.characters;

  const effectiveStaff =
    anime?.staff && anime.staff.length > 0
      ? anime.staff
      : activeExtraCredits?.staff;

  const effectiveStudios =
    anime?.studios && anime.studios.length > 0
      ? anime.studios
      : (activeExtraCredits?.studios ?? []);

  const [synopsisExpanded, setSynopsisExpanded] = useState(false);
  const [isWatchPressing, setIsWatchPressing] = useState(false);

  const getMyAnimeTrackingFn = useServerFn(getMyAnimeTracking);
  const upsertAnimeTrackingFn = useServerFn(upsertAnimeTracking);
  const removeAnimeTrackingFn = useServerFn(removeAnimeTracking);
  const getMyProfileFavoritesFn = useServerFn(getMyProfileFavorites);
  const addProfileFavoriteFn = useServerFn(addProfileFavorite);
  const removeProfileFavoriteFn = useServerFn(removeProfileFavorite);

  const getMyAnimeTrackingFnRef = useRef(getMyAnimeTrackingFn);
  getMyAnimeTrackingFnRef.current = getMyAnimeTrackingFn;
  const upsertAnimeTrackingFnRef = useRef(upsertAnimeTrackingFn);
  upsertAnimeTrackingFnRef.current = upsertAnimeTrackingFn;
  const removeAnimeTrackingFnRef = useRef(removeAnimeTrackingFn);
  removeAnimeTrackingFnRef.current = removeAnimeTrackingFn;
  const getMyProfileFavoritesFnRef = useRef(getMyProfileFavoritesFn);
  getMyProfileFavoritesFnRef.current = getMyProfileFavoritesFn;
  const addProfileFavoriteFnRef = useRef(addProfileFavoriteFn);
  addProfileFavoriteFnRef.current = addProfileFavoriteFn;
  const removeProfileFavoriteFnRef = useRef(removeProfileFavoriteFn);
  removeProfileFavoriteFnRef.current = removeProfileFavoriteFn;

  // Estados de Coleção (Minha Coleção) e Favoritos inicializados diretamente dos dados persistidos do próprio usuário (sem flash e sem vazamento entre contas)
  const isServerRender = typeof window === "undefined";
  const matchesInitialUser = Boolean(
    user?.id &&
      initialUserStatus?.userId &&
      initialUserStatus.userId === user.id,
  );
  const initialFreshForUser = Boolean(
    matchesInitialUser &&
      (isServerRender ||
        isInitialAnimeTrackingFresh(
          user!.id,
          candidateAnimeIds,
          initialUserStatus,
        )),
  );
  const initialFavoriteFreshForUser = Boolean(
    matchesInitialUser &&
      typeof initialUserStatus?.isFavorite === "boolean" &&
      (isServerRender ||
        isInitialAnimeFavoriteFresh(
          user!.id,
          candidateAnimeIds,
          initialUserStatus,
        )),
  );
  const initialSharedTrackingHit = user?.id
    ? getCachedAnimeTracking(user.id, candidateAnimeIds)
    : null;
  const initialSharedFavoriteHit = user?.id
    ? getCachedAnimeFavorite(user.id, candidateAnimeIds)
    : null;
  const initialResolvedTracking = initialFreshForUser
    ? initialUserStatus?.tracking ?? null
    : initialSharedTrackingHit
      ? initialSharedTrackingHit.item
      : null;
  const hasAuthoritativeInitialTracking =
    initialFreshForUser || Boolean(initialSharedTrackingHit);

  const [isCollectionModalOpen, setIsCollectionModalOpen] = useState(false);
  const [trackingStatus, setTrackingStatus] = useState<TrackingStatus | null>(() => {
    if (hasAuthoritativeInitialTracking) {
      return initialResolvedTracking?.status ?? null;
    }
    const cached = getAnimeUserClientCache(candidateAnimeIds, user?.id ?? null);
    if (cached?.trackingStatus) {
      return cached.trackingStatus;
    }
    return null;
  });
  const [trackingEpisodesWatched, setTrackingEpisodesWatched] = useState<number>(() => {
    if (hasAuthoritativeInitialTracking) {
      return typeof initialResolvedTracking?.episodesWatched === "number"
        ? initialResolvedTracking.episodesWatched
        : 0;
    }
    const cached = getAnimeUserClientCache(candidateAnimeIds, user?.id ?? null);
    if (typeof cached?.episodesWatched === "number") {
      return cached.episodesWatched;
    }
    return 0;
  });
  const [trackingScore, setTrackingScore] = useState<number | null>(() => {
    if (hasAuthoritativeInitialTracking) {
      return initialResolvedTracking?.score ?? null;
    }
    const cached = getAnimeUserClientCache(candidateAnimeIds, user?.id ?? null);
    if (cached?.score !== undefined) {
      return cached.score;
    }
    return null;
  });
  const [trackingDbAnimeId, setTrackingDbAnimeId] = useState<string | null>(() => {
    if (hasAuthoritativeInitialTracking) {
      return initialResolvedTracking?.animeId ?? null;
    }
    const cached = getAnimeUserClientCache(candidateAnimeIds, user?.id ?? null);
    return cached?.dbAnimeId ?? null;
  });
  const [trackingTimestamps, setTrackingTimestamps] = useState<{
    createdAt: string;
    updatedAt: string;
  }>(() => {
    if (hasAuthoritativeInitialTracking) {
      return {
        createdAt: initialResolvedTracking?.createdAt || "",
        updatedAt: initialResolvedTracking?.updatedAt || "",
      };
    }
    const cached = getAnimeUserClientCache(candidateAnimeIds, user?.id ?? null);
    return {
      createdAt: cached?.createdAt || "",
      updatedAt: cached?.updatedAt || "",
    };
  });
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [hydratedTrackingUserId, setHydratedTrackingUserId] = useState<string | null>(
    () =>
      user?.id &&
      (initialFreshForUser || Boolean(initialSharedTrackingHit))
        ? user.id
        : null,
  );

  const [isFavorite, setIsFavorite] = useState<boolean>(() => {
    if (initialFavoriteFreshForUser && initialUserStatus) {
      return Boolean(initialUserStatus.isFavorite);
    }
    if (initialSharedFavoriteHit) {
      return initialSharedFavoriteHit.isFavorite;
    }
    const cached = getAnimeUserClientCache(candidateAnimeIds, user?.id ?? null);
    if (cached && typeof cached.isFavorite === "boolean") {
      return cached.isFavorite;
    }
    return false;
  });
  const [favFavoriteId, setFavFavoriteId] = useState<string | null>(() => {
    if (initialFavoriteFreshForUser && initialUserStatus) {
      return initialUserStatus.favFavoriteId ?? null;
    }
    if (initialSharedFavoriteHit) {
      return initialSharedFavoriteHit.favFavoriteId;
    }
    const cached = getAnimeUserClientCache(candidateAnimeIds, user?.id ?? null);
    return cached?.favFavoriteId ?? null;
  });
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [hydratedFavoriteUserId, setHydratedFavoriteUserId] = useState<string | null>(
    () =>
      user?.id &&
      (initialFavoriteFreshForUser || Boolean(initialSharedFavoriteHit))
        ? user.id
        : null,
  );

  const trackingMutationVersionRef = useRef(0);
  const favoriteMutationVersionRef = useRef(0);

  // Mapa de favoritos do perfil indexados por targetType:targetId e targetType:title
  const [favoriteEntities, setFavoriteEntities] = useState<
    Map<string, { id: string; targetType: FavoriteTargetType; targetId: string }>
  >(() => {
    const map = new Map<string, { id: string; targetType: FavoriteTargetType; targetId: string }>();
    if (user?.id && initialUserStatus?.userId === user.id && initialUserStatus.favoriteEntities) {
      for (const item of initialUserStatus.favoriteEntities) {
        map.set(`${item.targetType}:${item.targetId}`, {
          id: item.id,
          targetType: item.targetType,
          targetId: item.targetId,
        });
        if (item.title) {
          map.set(`${item.targetType}:${item.title.toLowerCase().trim()}`, {
            id: item.id,
            targetType: item.targetType,
            targetId: item.targetId,
          });
        }
        if (item.nativeTitle) {
          map.set(`${item.targetType}:${item.nativeTitle.toLowerCase().trim()}`, {
            id: item.id,
            targetType: item.targetType,
            targetId: item.targetId,
          });
        }
      }
    }
    return map;
  });

  // Sincroniza estado inicial do loader para o cache síncrono local do próprio usuário
  useEffect(() => {
    if (!initialUserStatus || !user?.id || initialUserStatus.userId !== user.id) {
      return;
    }
    const trackingFresh = isInitialAnimeTrackingFresh(
      user.id,
      candidateAnimeIds,
      initialUserStatus,
    );
    const favoriteFresh =
      typeof initialUserStatus.isFavorite === "boolean" &&
      isInitialAnimeFavoriteFresh(
        user.id,
        candidateAnimeIds,
        initialUserStatus,
      );
    if (!trackingFresh && !favoriteFresh) {
      return;
    }
    saveAnimeUserClientCache(
      candidateAnimeIds,
      {
        ...(trackingFresh
          ? {
              trackingStatus: initialUserStatus.tracking?.status ?? null,
              episodesWatched: initialUserStatus.tracking?.episodesWatched ?? 0,
              score: initialUserStatus.tracking?.score ?? null,
              dbAnimeId: initialUserStatus.tracking?.animeId ?? null,
              createdAt: initialUserStatus.tracking?.createdAt ?? "",
              updatedAt: initialUserStatus.tracking?.updatedAt ?? "",
              continueEpisode: initialUserStatus.continueEpisode,
            }
          : {}),
        ...(favoriteFresh
          ? {
              isFavorite: initialUserStatus.isFavorite,
              favFavoriteId: initialUserStatus.favFavoriteId,
            }
          : {}),
      },
      user.id,
    );
  }, [initialUserStatus, candidateAnimeIds, user?.id]);

  const [showAuthModal, setShowAuthModal] = useState(false);

  const isTrackingHydrating =
    userPending ||
    (Boolean(user?.id && anime?.id) && hydratedTrackingUserId !== user?.id);
  const isFavoriteHydrating =
    userPending ||
    (Boolean(user?.id && anime?.id) && hydratedFavoriteUserId !== user?.id);

  const isCollectionBusy = trackingLoading || isTrackingHydrating;
  const isFavoriteBusy = favoriteLoading || isFavoriteHydrating;

  const animeModalTitle = anime ? displayTitle(anime) : "";
  const animeModalEpisodesCount =
    anime?.episodesCount || (anime?.seasons?.[0]?.episodes?.length ?? null);

  // Item de acompanhamento estruturado para reutilização do ProfileAnimeEditModal do Perfil
  const trackingItem: UserAnimeTrackingItem | null = useMemo(() => {
    if (!anime) return null;
    return {
      userId: user?.id ?? "",
      animeId: trackingDbAnimeId || anime.id,
      status: trackingStatus || "watching",
      score: trackingScore,
      episodesWatched: trackingEpisodesWatched || 0,
      title: animeModalTitle,
      titleRomaji: anime.titles?.romaji || null,
      titleEnglish: anime.titles?.english || null,
      titleNative: anime.titles?.native || null,
      cover: anime.cover || null,
      banner: anime.banner || null,
      format: anime.format || null,
      year: anime.year || anime.startDate?.year || null,
      episodesCount: animeModalEpisodesCount,
      animeStatus: anime.status || null,
      startedAt: null,
      completedAt: null,
      createdAt: trackingTimestamps.createdAt,
      updatedAt: trackingTimestamps.updatedAt,
      animeSnapshot: makeAnimeSnapshot(anime),
    };
  }, [
    user?.id,
    anime,
    trackingDbAnimeId,
    trackingStatus,
    trackingScore,
    trackingEpisodesWatched,
    animeModalTitle,
    animeModalEpisodesCount,
    trackingTimestamps.createdAt,
    trackingTimestamps.updatedAt,
  ]);

  const animePrimaryId = anime?.id ?? "";
  const animeRomajiTitle = anime?.titles?.romaji ?? "";
  const animeEnglishTitle = anime?.titles?.english ?? "";
  const animeNativeTitle = anime?.titles?.native ?? "";

  const animeTrackingSnapshotRef = useRef<ReturnType<typeof makeAnimeSnapshot> | undefined>(undefined);
  animeTrackingSnapshotRef.current = anime ? makeAnimeSnapshot(anime) : undefined;

  // Consulta status de acompanhamento e favoritos do usuário para este anime e demais entidades
  useEffect(() => {
    if (userPending) {
      return;
    }

    if (!user?.id) {
      if (initialStateRequestId) {
        clearInFlightAnimeInitialState(initialStateRequestId);
      }
      setTrackingStatus(null);
      setTrackingEpisodesWatched(0);
      setTrackingScore(null);
      setTrackingDbAnimeId(null);
      setTrackingTimestamps({ createdAt: "", updatedAt: "" });
      setHydratedTrackingUserId(null);
      setIsFavorite(false);
      setFavFavoriteId(null);
      setFavoriteEntities(new Map());
      setHydratedFavoriteUserId(null);
      return;
    }

    if (!animePrimaryId) {
      return;
    }

    let active = true;
    const currentUserId = user.id;
    const idsToQuery = candidateAnimeIdsKey.split("|").filter(Boolean);
    const idsSet = new Set(idsToQuery);
    const trackingVersionAtStart = trackingMutationVersionRef.current;
    const favoriteVersionAtStart = favoriteMutationVersionRef.current;

    // Garante que o store já reflita o usuário autenticado antes de hidratar episódios assistidos
    // (evita que este useEffect filho rode antes do Shell e aborte hydrateAnimeWatchedEpisodes).
    if (useHikariStore.getState().currentUserId !== currentUserId) {
      useHikariStore.getState().setCurrentUserId(currentUserId);
    }

    const currentTitle = animeModalTitle.toLowerCase().trim();
    const romaji = animeRomajiTitle.toLowerCase().trim();
    const english = animeEnglishTitle.toLowerCase().trim();
    const nativeTitle = animeNativeTitle.toLowerCase().trim();
    const normalizedTitles = new Set(
      [currentTitle, romaji, english, nativeTitle].filter(Boolean),
    );

    // 1. Hidrata ou busca acompanhamento da lista e episódios assistidos sem consultas duplicadas
    const applyTrackingState = (item: UserAnimeTrackingItem | null) => {
      if (item) {
        setTrackingDbAnimeId(item.animeId);
        setTrackingStatus(item.status);
        setTrackingEpisodesWatched(item.episodesWatched ?? 0);
        setTrackingScore(item.score ?? null);
        setTrackingTimestamps({
          createdAt: item.createdAt || "",
          updatedAt: item.updatedAt || "",
        });
        saveAnimeUserClientCache(
          idsToQuery,
          {
            trackingStatus: item.status,
            episodesWatched: item.episodesWatched ?? 0,
            score: item.score ?? null,
            dbAnimeId: item.animeId,
            createdAt: item.createdAt || "",
            updatedAt: item.updatedAt || "",
          },
          currentUserId,
        );
      } else {
        setTrackingDbAnimeId(null);
        setTrackingStatus(null);
        setTrackingEpisodesWatched(0);
        setTrackingScore(null);
        setTrackingTimestamps({ createdAt: "", updatedAt: "" });
        saveAnimeUserClientCache(
          idsToQuery,
          {
            trackingStatus: null,
            episodesWatched: 0,
            score: null,
            dbAnimeId: null,
          },
          currentUserId,
        );
      }
    };

    const applyAuthoritativeInitialState = (state: AnimeUserInitialState) => {
      hydrateAnimeWatchedEpisodes(
        currentUserId,
        idsToQuery,
        state.watchedEpisodeIds ?? [],
      );
      const snap = animeTrackingSnapshotRef.current ?? null;
      const initialItem: UserAnimeTrackingItem | null = state.tracking
        ? {
            userId: currentUserId,
            animeId: state.tracking.animeId,
            status: state.tracking.status,
            score: state.tracking.score ?? null,
            episodesWatched: state.tracking.episodesWatched ?? 0,
            title: animeModalTitle,
            titleRomaji: animeRomajiTitle || null,
            titleEnglish: animeEnglishTitle || null,
            titleNative: animeNativeTitle || null,
            cover: snap?.cover || null,
            banner: snap?.banner || null,
            format: snap?.format || null,
            year: snap?.year ?? null,
            episodesCount: snap?.episodesCount ?? null,
            animeStatus: snap?.status || null,
            startedAt: null,
            completedAt: null,
            createdAt: state.tracking.createdAt || "",
            updatedAt: state.tracking.updatedAt || "",
            animeSnapshot: snap,
          }
        : null;
      seedAnimeTrackingCache(currentUserId, idsToQuery, initialItem);
      if (state.continueEpisode !== undefined) {
        saveAnimeUserClientCache(
          idsToQuery,
          { continueEpisode: state.continueEpisode },
          currentUserId,
        );
      }
      if (trackingMutationVersionRef.current === trackingVersionAtStart) {
        applyTrackingState(initialItem);
      }
      setHydratedTrackingUserId(currentUserId);
    };

    const cachedTracking = getCachedAnimeTracking(currentUserId, idsToQuery);
    const cachedFavorite = getCachedAnimeFavorite(currentUserId, idsToQuery);
    const freshTrackingInitial = Boolean(
      initialUserStatus &&
        initialUserStatus.userId === currentUserId &&
        isInitialAnimeTrackingFresh(currentUserId, idsToQuery, initialUserStatus),
    );
    const freshFavoriteInitial = Boolean(
      initialUserStatus &&
        initialUserStatus.userId === currentUserId &&
        isInitialAnimeFavoriteFresh(currentUserId, idsToQuery, initialUserStatus),
    );
    const inFlightInitial =
      !freshTrackingInitial && !freshFavoriteInitial && initialStateRequestId
        ? getInFlightAnimeInitialState<AnimeUserInitialState>(initialStateRequestId)
        : null;

    const fallbackFetchTrackingAndWatched = () => {
      const latestCached = getCachedAnimeTracking(currentUserId, idsToQuery);
      if (latestCached) {
        if (trackingMutationVersionRef.current === trackingVersionAtStart) {
          applyTrackingState(latestCached.item);
        }
        setHydratedTrackingUserId(currentUserId);
        void syncAuthenticatedWatchedEpisodes(currentUserId, animePrimaryId, {
          candidateIds: idsToQuery,
        });
        return;
      }

      void Promise.all([
        fetchAnimeTrackingSingleflight(
          currentUserId,
          animePrimaryId,
          idsToQuery,
          () =>
            getMyAnimeTrackingFnRef.current({
              data: {
                animeId: animePrimaryId,
                animeIds: idsToQuery,
                animeSnapshot: animeTrackingSnapshotRef.current,
              },
            }),
        )
          .then((items) => {
            if (!active) return;
            if (trackingMutationVersionRef.current !== trackingVersionAtStart) return;
            const matched =
              items && items.length > 0
                ? (items.find((row) => row.animeId === animePrimaryId) ?? items[0])
                : null;
            applyTrackingState(matched);
          })
          .catch((err) => {
            console.warn("Erro ao buscar acompanhamento do anime:", err);
          })
          .finally(() => {
            if (!active) return;
            setHydratedTrackingUserId(currentUserId);
          }),
        syncAuthenticatedWatchedEpisodes(currentUserId, animePrimaryId, {
          candidateIds: idsToQuery,
        }),
      ]);
    };

    const buildFavoriteEntitiesMap = (entities: NonNullable<AnimeUserInitialState["favoriteEntities"]>) => {
      const newMap = new Map<
        string,
        { id: string; targetType: FavoriteTargetType; targetId: string }
      >();
      for (const item of entities) {
        newMap.set(`${item.targetType}:${item.targetId}`, {
          id: item.id,
          targetType: item.targetType,
          targetId: item.targetId,
        });
        if (item.title) {
          newMap.set(`${item.targetType}:${item.title.toLowerCase().trim()}`, {
            id: item.id,
            targetType: item.targetType,
            targetId: item.targetId,
          });
        }
        if (item.nativeTitle) {
          newMap.set(`${item.targetType}:${item.nativeTitle.toLowerCase().trim()}`, {
            id: item.id,
            targetType: item.targetType,
            targetId: item.targetId,
          });
        }
      }
      return newMap;
    };

    const applyFavoriteStateFromInitial = (state: AnimeUserInitialState) => {
      if (favoriteMutationVersionRef.current !== favoriteVersionAtStart) {
        setHydratedFavoriteUserId(currentUserId);
        return;
      }

      const entities = state.favoriteEntities ?? [];
      setFavoriteEntities(buildFavoriteEntitiesMap(entities));

      const matchFromEntities = entities.find((item) => {
        if (item.targetType !== "anime") return false;
        if (idsSet.has(item.targetId)) return true;
        const itemTitle = (item.title || "").toLowerCase().trim();
        const itemNative = (item.nativeTitle || "").toLowerCase().trim();
        if (itemTitle && normalizedTitles.has(itemTitle)) return true;
        if (itemNative && normalizedTitles.has(itemNative)) return true;
        return false;
      });

      const resolvedIsFav = Boolean(state.isFavorite || matchFromEntities);
      const resolvedFavId = state.favFavoriteId ?? matchFromEntities?.id ?? null;

      seedAnimeFavoriteCache(
        currentUserId,
        idsToQuery,
        resolvedIsFav,
        resolvedFavId,
      );
      setIsFavorite(resolvedIsFav);
      setFavFavoriteId(resolvedFavId);
      saveAnimeUserClientCache(
        idsToQuery,
        {
          isFavorite: resolvedIsFav,
          favFavoriteId: resolvedFavId,
        },
        currentUserId,
      );
      setHydratedFavoriteUserId(currentUserId);
    };

    const applyCachedFavoriteState = (
      fav: { isFavorite: boolean; favFavoriteId: string | null },
      entities?: AnimeUserInitialState["favoriteEntities"],
    ) => {
      if (Array.isArray(entities)) {
        setFavoriteEntities(buildFavoriteEntitiesMap(entities));
      }
      if (favoriteMutationVersionRef.current === favoriteVersionAtStart) {
        setIsFavorite(fav.isFavorite);
        setFavFavoriteId(fav.favFavoriteId);
        saveAnimeUserClientCache(
          idsToQuery,
          {
            isFavorite: fav.isFavorite,
            favFavoriteId: fav.favFavoriteId,
          },
          currentUserId,
        );
      }
      setHydratedFavoriteUserId(currentUserId);
    };

    const fallbackFetchFavorites = () => {
      const latestCachedFav = getCachedAnimeFavorite(currentUserId, idsToQuery);
      if (latestCachedFav) {
        applyCachedFavoriteState(
          latestCachedFav,
          initialUserStatus?.userId === currentUserId
            ? initialUserStatus.favoriteEntities
            : undefined,
        );
        return;
      }

      void getMyProfileFavoritesFnRef
        .current({ data: {} })
        .then((res) => {
          if (!active) return;
          if (favoriteMutationVersionRef.current !== favoriteVersionAtStart) return;

          const newMap = new Map<
            string,
            { id: string; targetType: FavoriteTargetType; targetId: string }
          >();
          for (const item of res.items) {
            newMap.set(`${item.targetType}:${item.targetId}`, {
              id: item.id,
              targetType: item.targetType,
              targetId: item.targetId,
            });
            if (item.title) {
              newMap.set(`${item.targetType}:${item.title.toLowerCase().trim()}`, {
                id: item.id,
                targetType: item.targetType,
                targetId: item.targetId,
              });
            }
          }
          setFavoriteEntities(newMap);

          const match = res.items.find((item) => {
            if (item.targetType !== "anime") return false;
            if (idsSet.has(item.targetId)) return true;
            const itemTitle = (item.title || "").toLowerCase().trim();
            const itemNative = (item.nativeTitle || "").toLowerCase().trim();
            if (itemTitle && normalizedTitles.has(itemTitle)) return true;
            if (itemNative && normalizedTitles.has(itemNative)) return true;
            return false;
          });

          if (match) {
            seedAnimeFavoriteCache(currentUserId, idsToQuery, true, match.id);
            setIsFavorite(true);
            setFavFavoriteId(match.id);
            saveAnimeUserClientCache(
              idsToQuery,
              {
                isFavorite: true,
                favFavoriteId: match.id,
              },
              currentUserId,
            );
          } else {
            seedAnimeFavoriteCache(currentUserId, idsToQuery, false, null);
            setIsFavorite(false);
            setFavFavoriteId(null);
            saveAnimeUserClientCache(
              idsToQuery,
              {
                isFavorite: false,
                favFavoriteId: null,
              },
              currentUserId,
            );
          }
        })
        .catch((err) => {
          console.warn("Erro ao buscar favoritos:", err);
        })
        .finally(() => {
          if (!active) return;
          setHydratedFavoriteUserId(currentUserId);
        });
    };

    if (inFlightInitial) {
      if (cachedTracking && trackingMutationVersionRef.current === trackingVersionAtStart) {
        applyTrackingState(cachedTracking.item);
        setHydratedTrackingUserId(currentUserId);
      }
      if (cachedFavorite) {
        applyCachedFavoriteState(cachedFavorite);
      }
      void inFlightInitial.promise.then((resolved) => {
        if (!active) return;
        consumeInFlightAnimeInitialState(initialStateRequestId);

        const epochMatches = getTrackingCacheEpoch() === inFlightInitial.epoch;
        const canApplyTracking =
          resolved &&
          resolved.userId === currentUserId &&
          epochMatches &&
          !hasTrackedMutationSince(
            inFlightInitial.startSeq,
            currentUserId,
            idsToQuery,
          );
        const canApplyFavorite =
          resolved &&
          resolved.userId === currentUserId &&
          epochMatches &&
          !hasFavoriteMutationSince(
            inFlightInitial.startSeq,
            currentUserId,
            idsToQuery,
            resolved.favFavoriteId,
          );

        if (canApplyTracking && canApplyFavorite) {
          recordInitialAnimeTrackingLoaded(
            currentUserId,
            idsToQuery,
            resolved,
          );
        }

        if (trackingMutationVersionRef.current === trackingVersionAtStart) {
          if (canApplyTracking) {
            applyAuthoritativeInitialState(resolved);
          } else {
            fallbackFetchTrackingAndWatched();
          }
        }

        if (favoriteMutationVersionRef.current === favoriteVersionAtStart) {
          if (canApplyFavorite && Array.isArray(resolved.favoriteEntities)) {
            applyFavoriteStateFromInitial(resolved);
          } else {
            fallbackFetchFavorites();
          }
        } else {
          setHydratedFavoriteUserId(currentUserId);
        }
      });
    } else {
      if (freshTrackingInitial && initialUserStatus) {
        applyAuthoritativeInitialState(initialUserStatus);
      } else if (cachedTracking) {
        if (trackingMutationVersionRef.current === trackingVersionAtStart) {
          applyTrackingState(cachedTracking.item);
        }
        setHydratedTrackingUserId(currentUserId);
        void syncAuthenticatedWatchedEpisodes(currentUserId, animePrimaryId, {
          candidateIds: idsToQuery,
        });
      } else {
        fallbackFetchTrackingAndWatched();
      }

      if (
        freshFavoriteInitial &&
        initialUserStatus &&
        Array.isArray(initialUserStatus.favoriteEntities)
      ) {
        applyFavoriteStateFromInitial(initialUserStatus);
      } else if (cachedFavorite) {
        applyCachedFavoriteState(
          cachedFavorite,
          initialUserStatus?.userId === currentUserId
            ? initialUserStatus.favoriteEntities
            : undefined,
        );
      } else {
        fallbackFetchFavorites();
      }
    }

    return () => {
      active = false;
    };
  }, [
    userPending,
    user?.id,
    animePrimaryId,
    animeModalTitle,
    animeRomajiTitle,
    animeEnglishTitle,
    animeNativeTitle,
    candidateAnimeIdsKey,
    initialUserStatus,
    initialStateRequestId,
  ]);

  const isEntityFavorited = useCallback(
    (
      targetType: "character" | "studio" | "person",
      targetId: string,
      name?: string,
    ): boolean => {
      const keyId = `${targetType}:${targetId}`;
      if (favoriteEntities.has(keyId)) return true;
      if (name) {
        const keyName = `${targetType}:${name.toLowerCase().trim()}`;
        if (favoriteEntities.has(keyName)) return true;
      }
      return false;
    },
    [favoriteEntities],
  );

  const handleToggleEntityFavorite = useCallback(
    async (params: {
      targetType: "character" | "studio" | "person";
      targetId: string;
      name: string;
      characterSnapshot?: {
        name: string;
        nativeName?: string | null;
        imageUrl?: string | null;
        role?: string | null;
        description?: string | null;
      };
      studioSnapshot?: {
        name: string;
        logoUrl?: string | null;
        establishedYear?: number | null;
        description?: string | null;
      };
      personSnapshot?: {
        name: string;
        nativeName?: string | null;
        imageUrl?: string | null;
        biography?: string | null;
        primaryOccupation?: string | null;
      };
    }) => {
      if (!user) {
        setShowAuthModal(true);
        return;
      }

      const keyId = `${params.targetType}:${params.targetId}`;
      const keyName = `${params.targetType}:${params.name.toLowerCase().trim()}`;
      const existing =
        favoriteEntities.get(keyId) || favoriteEntities.get(keyName);
      const isCurrentlyFavorite = Boolean(existing);
      const willBeFavorite = !isCurrentlyFavorite;

      // 1. Atualização visual imediata na UI
      setFavoriteEntities((prev) => {
        const next = new Map(prev);
        if (willBeFavorite) {
          const tempFav = {
            id: `temp-${Date.now()}`,
            targetType: params.targetType,
            targetId: params.targetId,
          };
          next.set(keyId, tempFav);
          next.set(keyName, tempFav);
        } else {
          next.delete(keyId);
          next.delete(keyName);
        }
        return next;
      });

      try {
        if (willBeFavorite) {
          const created = await addProfileFavoriteFnRef.current({
            data: {
              targetType: params.targetType,
              targetId: params.targetId,
              characterSnapshot: params.characterSnapshot,
              studioSnapshot: params.studioSnapshot,
              personSnapshot: params.personSnapshot,
            },
          });
          setFavoriteEntities((prev) => {
            const next = new Map(prev);
            const realFav = {
              id: created.id,
              targetType: params.targetType,
              targetId: created.targetId || params.targetId,
            };
            next.set(keyId, realFav);
            next.set(keyName, realFav);
            return next;
          });
          const typeLabel =
            params.targetType === "character"
              ? "Personagem"
              : params.targetType === "studio"
              ? "Estúdio"
              : params.personSnapshot?.biography?.includes("Dublador")
              ? "Dublador(a)"
              : "Pessoa";
          invalidateAccountProfileCache(user.id);
          invalidatePublicProfileCacheByUserId(user.id);
          notifyToast(
            "success",
            `${typeLabel} "${params.name}" adicionado aos favoritos!`,
          );
        } else {
          await removeProfileFavoriteFnRef.current({
            data: {
              targetType: params.targetType,
              targetId: existing?.targetId || params.targetId,
              favoriteId:
                existing?.id && !existing.id.startsWith("temp-")
                  ? existing.id
                  : undefined,
            },
          });
          invalidateAccountProfileCache(user.id);
          invalidatePublicProfileCacheByUserId(user.id);
          notifyToast("info", `"${params.name}" removido dos favoritos.`);
        }
      } catch (err: unknown) {
        // Reverte se a requisição falhar
        setFavoriteEntities((prev) => {
          const next = new Map(prev);
          if (isCurrentlyFavorite && existing) {
            next.set(keyId, existing);
            next.set(keyName, existing);
          } else {
            next.delete(keyId);
            next.delete(keyName);
          }
          return next;
        });
        const msg =
          err instanceof Error
            ? err.message
            : "Erro ao atualizar favoritos.";
        notifyToast("error", msg);
      }
    },
    [user, favoriteEntities],
  );

  const favoritesEntityContextValue = useMemo(
    () => ({
      isEntityFavorited,
      toggleEntityFavorite: handleToggleEntityFavorite,
    }),
    [isEntityFavorited, handleToggleEntityFavorite],
  );

  // Ações de salvar e remover da coleção
  const handleSaveCollection = async (data: {
    status: TrackingStatus;
    episodesWatched: number;
    score: number | null;
  }) => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    if (!anime || isCollectionBusy) return;

    const previousStatus = trackingStatus;
    const previousEpisodes = trackingEpisodesWatched;
    const previousScore = trackingScore;
    const previousDbAnimeId = trackingDbAnimeId;
    const isNewEntry = previousStatus === null;
    const targetAnimeId = trackingDbAnimeId || anime.serverCatalogId || anime.id;

    trackingMutationVersionRef.current += 1;
    setTrackingStatus(data.status);
    setTrackingEpisodesWatched(data.episodesWatched);
    setTrackingScore(data.score);
    setTrackingLoading(true);

    try {
      const saved = await upsertAnimeTrackingFnRef.current({
        data: {
          animeId: targetAnimeId,
          status: data.status,
          episodesWatched: data.episodesWatched,
          score: data.score,
          animeSnapshot: makeAnimeSnapshot(anime),
        },
      });

      setTrackingDbAnimeId(saved.animeId);
      setTrackingStatus(saved.status);
      setTrackingEpisodesWatched(saved.episodesWatched ?? 0);
      setTrackingScore(saved.score ?? null);
      setTrackingTimestamps({
        createdAt: saved.createdAt || "",
        updatedAt: saved.updatedAt || "",
      });
      setHydratedTrackingUserId(user.id);
      const allMutationIds = Array.from(new Set([...candidateAnimeIds, saved.animeId]));
      const savedTrackingItem: UserAnimeTrackingItem = {
        userId: user.id,
        animeId: saved.animeId,
        status: saved.status,
        score: saved.score ?? null,
        episodesWatched: saved.episodesWatched ?? 0,
        title: animeModalTitle,
        titleRomaji: anime.titles?.romaji || null,
        titleEnglish: anime.titles?.english || null,
        titleNative: anime.titles?.native || null,
        cover: anime.cover || null,
        banner: anime.banner || null,
        format: anime.format || null,
        year: anime.year || anime.startDate?.year || null,
        episodesCount: animeModalEpisodesCount,
        animeStatus: anime.status || null,
        startedAt: saved.startedAt ?? null,
        completedAt: saved.completedAt ?? null,
        createdAt: saved.createdAt || "",
        updatedAt: saved.updatedAt || "",
        animeSnapshot: makeAnimeSnapshot(anime),
      };
      seedAnimeTrackingCache(user.id, allMutationIds, savedTrackingItem);
      markTrackingMutated(user.id, allMutationIds);
      invalidatePaginatedTrackingCache(user.id);
      if ((saved.episodesWatched ?? 0) !== previousEpisodes) {
        invalidateWatchedEpisodesCache(user.id, allMutationIds);
        void syncAuthenticatedWatchedEpisodes(user.id, anime.id, {
          candidateIds: allMutationIds,
          force: true,
        });
      }
      saveAnimeUserClientCache(
        allMutationIds,
        {
          trackingStatus: saved.status,
          episodesWatched: saved.episodesWatched ?? 0,
          score: saved.score ?? null,
          dbAnimeId: saved.animeId,
          createdAt: saved.createdAt || "",
          updatedAt: saved.updatedAt || "",
        },
        user.id,
      );

      if (!inList) {
        toggleList(anime, user.id);
      }
      invalidateAccountProfileCache(user.id);
      invalidatePublicProfileCacheByUserId(user.id);

      notifyToast(
        "success",
        isNewEntry
          ? `Adicionado à sua coleção como "${COLLECTION_STATUS_CONFIG[saved.status].label}"!`
          : `Coleção atualizada para "${COLLECTION_STATUS_CONFIG[saved.status].label}"!`,
      );
    } catch (err: unknown) {
      setTrackingDbAnimeId(previousDbAnimeId);
      setTrackingStatus(previousStatus);
      setTrackingEpisodesWatched(previousEpisodes);
      setTrackingScore(previousScore);
      const msg = err instanceof Error ? err.message : "Erro ao atualizar coleção.";
      notifyToast("error", msg);
      throw err;
    } finally {
      setTrackingLoading(false);
    }
  };

  const _handleRemoveCollection = async () => {
    if (!user || !anime || isCollectionBusy) return;

    const previousStatus = trackingStatus;
    const previousEpisodes = trackingEpisodesWatched;
    const previousScore = trackingScore;
    const previousDbAnimeId = trackingDbAnimeId;
    const targetAnimeId = trackingDbAnimeId || anime.serverCatalogId || anime.id;

    trackingMutationVersionRef.current += 1;
    setTrackingStatus(null);
    setTrackingEpisodesWatched(0);
    setTrackingScore(null);
    setTrackingDbAnimeId(null);
    setTrackingLoading(true);

    try {
      await removeAnimeTrackingFnRef.current({
        data: {
          animeId: targetAnimeId,
        },
      });
      setHydratedTrackingUserId(user.id);
      const allMutationIds = Array.from(new Set([...candidateAnimeIds, targetAnimeId]));
      seedAnimeTrackingCache(user.id, allMutationIds, null);
      markTrackingMutated(user.id, allMutationIds);
      invalidatePaginatedTrackingCache(user.id);
      saveAnimeUserClientCache(
        allMutationIds,
        {
          trackingStatus: null,
          episodesWatched: 0,
          score: null,
          dbAnimeId: null,
        },
        user.id,
      );

      if (inList) {
        toggleList(anime, user.id);
      }
      invalidateAccountProfileCache(user.id);
      invalidatePublicProfileCacheByUserId(user.id);

      notifyToast("info", "Anime removido da sua coleção.");
    } catch (err: unknown) {
      setTrackingDbAnimeId(previousDbAnimeId);
      setTrackingStatus(previousStatus);
      setTrackingEpisodesWatched(previousEpisodes);
      setTrackingScore(previousScore);
      const msg = err instanceof Error ? err.message : "Erro ao remover da coleção.";
      notifyToast("error", msg);
    } finally {
      setTrackingLoading(false);
    }
  };

  // Alternar favorito do anime
  const handleToggleFavorite = async () => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    if (!anime || isFavoriteBusy) return;

    const willBeFavorite = !isFavorite;
    const previousFavoriteId = favFavoriteId;

    favoriteMutationVersionRef.current += 1;
    setIsFavorite(willBeFavorite);
    setFavoriteLoading(true);

    try {
      if (willBeFavorite) {
        const created = await addProfileFavoriteFnRef.current({
          data: {
            targetType: "anime",
            targetId: anime.id,
            animeSnapshot: makeAnimeSnapshot(anime),
          },
        });
        setFavFavoriteId(created.id);
        setIsFavorite(true);
        setHydratedFavoriteUserId(user.id);
        seedAnimeFavoriteCache(user.id, candidateAnimeIds, true, created.id);
        markFavoriteMutated(user.id, candidateAnimeIds, created.id);
        saveAnimeUserClientCache(
          candidateAnimeIds,
          {
            isFavorite: true,
            favFavoriteId: created.id,
          },
          user.id,
        );
        invalidateAccountProfileCache(user.id);
        invalidatePublicProfileCacheByUserId(user.id);
        notifyToast("success", "Adicionado aos seus favoritos!");
      } else {
        await removeProfileFavoriteFnRef.current({
          data: {
            targetType: "anime",
            targetId: anime.id,
            favoriteId: previousFavoriteId ?? undefined,
          },
        });
        setFavFavoriteId(null);
        setIsFavorite(false);
        setHydratedFavoriteUserId(user.id);
        seedAnimeFavoriteCache(user.id, candidateAnimeIds, false, null);
        markFavoriteMutated(user.id, candidateAnimeIds, previousFavoriteId);
        saveAnimeUserClientCache(
          candidateAnimeIds,
          {
            isFavorite: false,
            favFavoriteId: null,
          },
          user.id,
        );
        invalidateAccountProfileCache(user.id);
        invalidatePublicProfileCacheByUserId(user.id);
        notifyToast("info", "Removido dos favoritos.");
      }
    } catch (err: unknown) {
      setIsFavorite(!willBeFavorite);
      setFavFavoriteId(previousFavoriteId);
      const msg = err instanceof Error ? err.message : "Erro ao atualizar favoritos.";
      notifyToast("error", msg);
    } finally {
      setFavoriteLoading(false);
    }
  };

  const localRecord = useMemo(
    () =>
      anime
        ? locals.find(
            (a) =>
              a.id === anime.id ||
              (anime.anilistId != null && a.anilistId === anime.anilistId),
          )
        : undefined,
    [anime, locals],
  );

  const isAdminBanner = useMemo(
    () => hasAdminCustomBanner(localRecord, remote),
    [localRecord, remote],
  );

  const [isHydratedClient, setIsHydratedClient] = useState(
    () => clientHydrationState.hydrated,
  );

  const [isMobileViewport, setIsMobileViewport] = useState(() =>
    clientHydrationState.hydrated && typeof window !== "undefined"
      ? window.matchMedia(MOBILE_BANNER_MEDIA_QUERY).matches
      : false,
  );

  useIsomorphicLayoutEffect(() => {
    clientHydrationState.hydrated = true;
    setIsHydratedClient(true);
    const mq = window.matchMedia(MOBILE_BANNER_MEDIA_QUERY);
    const update = () => setIsMobileViewport(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const [failedBannerUrls, setFailedBannerUrls] = useState<
    Record<string, true>
  >({});

  const animeStartYear = anime?.startDate?.year ?? null;
  const animeStatus = anime?.status ?? null;
  const animeBanner = anime?.banner ?? null;
  const animeCover = anime?.cover ?? null;
  const animeColor = anime?.color ?? null;

  const baseSeasonBanner =
    isAdminBanner && localRecord?.banner?.trim()
      ? localRecord.banner.trim()
      : animeBanner;

  const initialSyncBanner = useMemo(() => {
    if (!animeId || isAdminBanner) return null;
    const parsedAniId =
      animeAnilistId ??
      (/^\d+$/.test(animeId) ? Number(animeId) : undefined);
    const parsedMalId =
      animeMalId ??
      (animeId.startsWith("mal-")
        ? Number(animeId.replace("mal-", ""))
        : undefined);
    const parsedKitsuId =
      animeKitsuId ??
      (animeId.startsWith("kitsu-")
        ? Number(animeId.replace("kitsu-", ""))
        : undefined);

    const syncResolved = resolveSeasonMobileBannerSync(
      {
        animeId,
        anilistId:
          parsedAniId && Number.isFinite(parsedAniId) ? parsedAniId : undefined,
        malId:
          parsedMalId && Number.isFinite(parsedMalId) ? parsedMalId : undefined,
        kitsuId:
          parsedKitsuId && Number.isFinite(parsedKitsuId)
            ? parsedKitsuId
            : undefined,
        year: animeYear,
        startYear: animeStartYear,
        format: animeFormat,
        status: animeStatus,
        currentBanner: animeBanner,
        currentCover: animeCover,
        isAdminCustomBanner: isAdminBanner,
      },
      {
        skipClientCache:
          typeof window === "undefined" || !isHydratedClient,
      },
    );

    if (syncResolved) {
      return {
        forId: animeId,
        url: syncResolved.url,
        isAlternative: syncResolved.isAlternative,
        initialObjectPosition: syncResolved.initialObjectPosition,
      };
    }

    if (remote?.resolvedMobileBanner) {
      return {
        forId: animeId,
        url: remote.resolvedMobileBanner.url,
        isAlternative: remote.resolvedMobileBanner.isAlternative,
        initialObjectPosition:
          remote.resolvedMobileBanner.initialObjectPosition,
      };
    }

    return null;
  }, [
    animeId,
    isAdminBanner,
    isHydratedClient,
    animeAnilistId,
    animeMalId,
    animeKitsuId,
    animeYear,
    animeStartYear,
    animeFormat,
    animeStatus,
    animeBanner,
    animeCover,
    remote?.resolvedMobileBanner,
  ]);

  const [mobileBannerState, setMobileBannerState] = useState<{
    forId: string;
    url: string | null;
    isAlternative: boolean;
    initialObjectPosition: string;
  } | null>(() => initialSyncBanner);

  const activeMobileBannerState =
    mobileBannerState && mobileBannerState.forId === animeId
      ? mobileBannerState
      : initialSyncBanner;

  useEffect(() => {
    if (!animeId || isAdminBanner || !isMobileViewport) {
      return;
    }

    if (activeMobileBannerState && activeMobileBannerState.forId === animeId) {
      return;
    }

    const controller = new AbortController();
    const parsedAniId =
      animeAnilistId ??
      (/^\d+$/.test(animeId) ? Number(animeId) : undefined);
    const parsedMalId =
      animeMalId ??
      (animeId.startsWith("mal-")
        ? Number(animeId.replace("mal-", ""))
        : undefined);
    const parsedKitsuId =
      animeKitsuId ??
      (animeId.startsWith("kitsu-")
        ? Number(animeId.replace("kitsu-", ""))
        : undefined);

    void resolveSeasonMobileBanner(
      {
        animeId,
        anilistId:
          parsedAniId && Number.isFinite(parsedAniId) ? parsedAniId : undefined,
        malId:
          parsedMalId && Number.isFinite(parsedMalId) ? parsedMalId : undefined,
        kitsuId:
          parsedKitsuId && Number.isFinite(parsedKitsuId)
            ? parsedKitsuId
            : undefined,
        year: animeYear,
        startYear: animeStartYear,
        format: animeFormat,
        status: animeStatus,
        currentBanner: animeBanner,
        currentCover: animeCover,
        isAdminCustomBanner: isAdminBanner,
        preloadedMalPictures: anime?.images,
      },
      controller.signal,
    ).then((resolved) => {
      if (controller.signal.aborted) return;
      if (resolved.isAlternative && resolved.url) {
        void import("@/lib/anime-banner-warmup").then((m) =>
          m.warmBannerImage(resolved.url),
        );
      }
      setMobileBannerState({
        forId: animeId,
        url: resolved.url,
        isAlternative: resolved.isAlternative,
        initialObjectPosition: resolved.initialObjectPosition,
      });
    });

    return () => {
      controller.abort();
    };
  }, [
    animeId,
    isMobileViewport,
    isAdminBanner,
    activeMobileBannerState,
    animeAnilistId,
    animeMalId,
    animeKitsuId,
    animeYear,
    animeStartYear,
    animeFormat,
    animeStatus,
    animeBanner,
    animeCover,
    anime?.images,
  ]);

  const { effectiveBannerUrl } = selectViewportBanner({
    animeId,
    isMobileViewport,
    isAdminBanner,
    baseSeasonBanner,
    mobileBannerState: activeMobileBannerState,
    failedBannerUrls,
  });

  const validDesktopBannerUrl =
    baseSeasonBanner && !failedBannerUrls[baseSeasonBanner]
      ? baseSeasonBanner
      : null;

  const validMobileSourceUrl =
    !isAdminBanner &&
    activeMobileBannerState?.isAlternative &&
    activeMobileBannerState.url &&
    !failedBannerUrls[activeMobileBannerState.url]
      ? activeMobileBannerState.url
      : null;

  const isMobileConfirmedDefault = Boolean(
    isAdminBanner ||
      (activeMobileBannerState && !activeMobileBannerState.isAlternative),
  );

  const effectiveMobileSourceUrl =
    validMobileSourceUrl ??
    (isMobileConfirmedDefault ? validDesktopBannerUrl : null);

  const currentBannerSrc = effectiveBannerUrl ?? undefined;

  const shouldRenderPicture = Boolean(
    validDesktopBannerUrl || effectiveMobileSourceUrl,
  );

  const shouldRenderDesktopCoverBlur =
    !validDesktopBannerUrl && Boolean(anime?.cover);

  /*
   * COR DA ABA DO NAVEGADOR
   */
  useEffect(() => {
    const getActiveThemeDefault = () =>
      document.documentElement.getAttribute("data-theme") === "light"
        ? "#f7f7f5"
        : "#08070d";

    const isLight =
      document.documentElement.getAttribute("data-theme") === "light";
    const defaultColor = getActiveThemeDefault();

    let meta = document.querySelector(
      'meta[name="theme-color"]',
    ) as HTMLMetaElement | null;

    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }

    if (isLight) {
      meta.content = defaultColor;
      return () => {
        if (meta) meta.content = getActiveThemeDefault();
      };
    }

    meta.content = animeColor || defaultColor;

    if (animeColor || !currentBannerSrc) {
      return () => {
        if (meta) meta.content = getActiveThemeDefault();
      };
    }

    const cancelAnalyze = analyzeBannerFramingAndTheme({
      bannerUrl: currentBannerSrc,
      hasExplicitColor: false,
      computeFraming: false,
      defaultThemeColor: defaultColor,
      onResult: ({ themeColor }) => {
        if (
          themeColor &&
          meta &&
          document.documentElement.getAttribute("data-theme") !== "light"
        ) {
          meta.content = themeColor;
        }
      },
    });

    return () => {
      cancelAnalyze?.();
      if (meta) {
        meta.content = getActiveThemeDefault();
      }
    };
  }, [animeId, currentBannerSrc, animeColor]);

  /*
   * TEMPORADAS
   */
  const initialSeasonNavigation = useMemo(
    () =>
      (
        remote as unknown as {
          seasonNavigation?: {
            items?: Array<{ id: string; label?: string; title?: string }>;
          };
        }
      )?.seasonNavigation?.items ?? [],
    [remote],
  );

  const [extraSeasonNavigation, setExtraSeasonNavigation] = useState<{
    forId: string;
    items: Array<{ id: string; label?: string; title?: string }>;
  } | null>(() => {
    if (!id) return null;
    const cached = clientSeasonNavCache.get(id);
    return cached ? { forId: id, items: cached } : null;
  });

  useEffect(() => {
    if (!id || id.startsWith("local-") || id.startsWith("kitsu-")) {
      return;
    }

    if (clientSeasonNavCache.has(id)) {
      const cached = clientSeasonNavCache.get(id)!;
      if (extraSeasonNavigation?.forId !== id) {
        setExtraSeasonNavigation({ forId: id, items: cached });
      }
      return;
    }

    if (clientSeasonNavInFlight.has(id)) {
      return;
    }

    let cancelled = false;
    clientSeasonNavInFlight.add(id);

    fetchAnimeSeasonNavigation({
      data: { id },
    })
      .then((res) => {
        if (!res?.items || res.items.length === 0) return;
        setCappedClientMap(clientSeasonNavCache, id, res.items);

        if (cancelled || activeAnimeIdRef.current !== id) return;

        const areSame =
          initialSeasonNavigation.length === res.items.length &&
          initialSeasonNavigation.every(
            (item, index) => item.id === res.items[index]?.id,
          );

        if (areSame) return;

        startTransition(() => {
          setExtraSeasonNavigation({
            forId: id,
            items: res.items,
          });
        });
      })
      .catch(() => {
        // Silencioso: mantém a página funcionando com os dados iniciais
      })
      .finally(() => {
        clientSeasonNavInFlight.delete(id);
      });

    return () => {
      cancelled = true;
    };
  }, [id, initialSeasonNavigation, extraSeasonNavigation?.forId]);

  const seasonNavigation = useMemo(() => {
    if (
      extraSeasonNavigation &&
      extraSeasonNavigation.forId === id &&
      extraSeasonNavigation.items.length > 0
    ) {
      return extraSeasonNavigation.items;
    }
    return initialSeasonNavigation;
  }, [extraSeasonNavigation, id, initialSeasonNavigation]);

  const seasons = anime?.seasons ?? [];

  /*
   * A página representa uma temporada.
   * Portanto usamos somente os episódios dessa página.
   */
  const currentSeason = seasons[0] ?? null;
  const currentEpisodes = currentSeason?.episodes;

  const [extraEpisodes, setExtraEpisodes] = useState<{
    forId: string;
    episodes: Episode[];
  } | null>(() => {
    const targetId = animeId || id;
    if (!targetId) return null;
    const cached = clientEpisodesCache.get(targetId);
    return cached ? { forId: targetId, episodes: cached } : null;
  });

  const effectiveEpisodes = useMemo(() => {
    if (
      extraEpisodes &&
      extraEpisodes.forId === (anime?.id ?? id) &&
      extraEpisodes.episodes.length > 0 &&
      currentEpisodes
    ) {
      const enrichedByNum = new Map(
        extraEpisodes.episodes.map((ep) => [ep.number, ep]),
      );
      return currentEpisodes.map((ep) => {
        const enriched = enrichedByNum.get(ep.number);
        if (!enriched) return ep;
        const hasOwnTitle = Boolean(
          ep.title && ep.title !== `Episódio ${ep.number}`,
        );
        return {
          ...ep,
          title: hasOwnTitle ? ep.title : enriched.title || ep.title,
          aired: ep.aired ?? enriched.aired,
        };
      });
    }
    return currentEpisodes;
  }, [extraEpisodes, anime?.id, id, currentEpisodes]);

  useEffect(() => {
    if (!animeId) return;
    const malIdToUse =
      animeMalId ??
      (animeId.startsWith("mal-")
        ? Number(animeId.replace("mal-", ""))
        : undefined);
    if (!malIdToUse || !Number.isFinite(malIdToUse)) return;

    // Se já possui episódios de streaming oficiais com thumbnail e link de vídeo, não precisa de fallback
    if (anime?.streamingEpisodes && anime.streamingEpisodes.length > 0) return;

    const baseEpisodes = currentEpisodes ?? [];
    if (baseEpisodes.length === 0) return;

    // Se os episódios já têm títulos próprios (diferentes de "Episódio X"), não precisa buscar
    const hasGenericTitles = baseEpisodes.some(
      (ep) => !ep.title || ep.title === `Episódio ${ep.number}`,
    );
    if (!hasGenericTitles) return;

    if (clientEpisodesCache.has(animeId)) {
      const cached = clientEpisodesCache.get(animeId)!;
      if (extraEpisodes?.forId !== animeId) {
        setExtraEpisodes({ forId: animeId, episodes: cached });
      }
      return;
    }

    if (clientEpisodesInFlight.has(animeId)) return;
    clientEpisodesInFlight.add(animeId);

    let cancelled = false;

    fetchAnimeEpisodes({
      data: {
        malId: malIdToUse,
        animeId,
      },
    })
      .then((seasonsRes) => {
        if (!seasonsRes?.[0]?.episodes?.length) return;
        const jikanEps = seasonsRes[0].episodes;
        const titleMap = new Map<number, { title: string; aired?: string }>();
        for (const ep of jikanEps) {
          if (ep.title && ep.title !== `Episódio ${ep.number}`) {
            titleMap.set(ep.number, { title: ep.title, aired: ep.aired });
          }
        }
        if (titleMap.size === 0) return;

        const enrichedEpisodes = baseEpisodes.map((ep) => {
          const jikan = titleMap.get(ep.number);
          return jikan
            ? {
                ...ep,
                title: jikan.title,
                aired: jikan.aired ?? ep.aired,
              }
            : ep;
        });

        setCappedClientMap(clientEpisodesCache, animeId, enrichedEpisodes);
        if (id && id !== animeId) {
          setCappedClientMap(clientEpisodesCache, id, enrichedEpisodes);
        }

        if (cancelled || activeAnimeIdRef.current !== id) return;

        startTransition(() => {
          setExtraEpisodes({
            forId: animeId,
            episodes: enrichedEpisodes,
          });
        });
      })
      .catch(() => {
        // Silencioso: mantém os episódios numerados já funcionais
      })
      .finally(() => {
        clientEpisodesInFlight.delete(animeId);
      });

    return () => {
      cancelled = true;
    };
  }, [
    animeId,
    animeMalId,
    anime?.streamingEpisodes,
    currentEpisodes,
    extraEpisodes?.forId,
    id,
  ]);

  const allEpisodes = useMemo(
    () =>
      (effectiveEpisodes ?? []).map((episode) => ({
        ...episode,
        seasonId: currentSeason?.id ?? "",
      })),
    [effectiveEpisodes, currentSeason?.id],
  );

  const watchedEpisodeSet = useMemo(
    () => new Set(watchedEpisodes),
    [watchedEpisodes],
  );

  const watchedCount = useMemo(
    () =>
      allEpisodes.reduce(
        (acc, episode) => acc + (watchedEpisodeSet.has(episode.id) ? 1 : 0),
        0,
      ),
    [allEpisodes, watchedEpisodeSet],
  );



  const title = displayTitle(anime);
  const isReleasing = anime?.status === "RELEASING";
  const yt = youtubeIdFrom(anime?.trailerId);

  const hasCanonicalDbEpisodes = Boolean(
    catalogEpisodes &&
      Array.isArray(catalogEpisodes.episodes) &&
      catalogEpisodes.episodes.length > 0,
  );
  const hasPublishedSeasonEpisodes = allEpisodes.some(
    (ep) => ep.published === true,
  );
  const hasAvailableEpisodes = Boolean(
    hasCanonicalDbEpisodes ||
      hasPublishedSeasonEpisodes ||
      (anime?.hasEpisode === true && allEpisodes.length > 0),
  );

  const rawEpisodeCount =
    effectiveEpisodes?.length ||
    anime?.episodesCount ||
    0;
  const episodeCount = hasAvailableEpisodes ? rawEpisodeCount : 0;

  /*
   * CONTINUAR
   *
   * Procura exatamente o episódio onde o usuário parou,
   * unificando loader do servidor (initialUserStatus), cache local síncrono
   * e zustand store (continueWatching) para exibição imediata sem flash de "Assistir".
   */
  const persistedContinueInfo = useMemo(() => {
    if (
      user?.id &&
      initialUserStatus?.userId === user.id &&
      initialUserStatus.continueEpisode
    ) {
      return {
        id: initialUserStatus.continueEpisode.id,
        number: initialUserStatus.continueEpisode.number,
      };
    }
    const cached = getAnimeUserClientCache(candidateAnimeIds, user?.id ?? null);
    if (cached?.continueEpisode) {
      return {
        id: cached.continueEpisode.id,
        number: cached.continueEpisode.number,
      };
    }
    if (continueEntry) {
      return {
        id: continueEntry.episodeId,
        number: continueEntry.episodeNumber || 1,
      };
    }
    return null;
  }, [
    user?.id,
    initialUserStatus?.userId,
    initialUserStatus?.continueEpisode,
    candidateAnimeIds,
    continueEntry,
  ]);

  const matchedEpisodeFromAll = useMemo(() => {
    if (!allEpisodes || allEpisodes.length === 0 || !persistedContinueInfo) {
      return null;
    }
    const byId = allEpisodes.find((ep) => ep.id === persistedContinueInfo.id);
    if (byId) return byId;

    if (typeof persistedContinueInfo.number === "number" && persistedContinueInfo.number > 0) {
      const byNum = allEpisodes.find((ep) => ep.number === persistedContinueInfo.number);
      if (byNum) return byNum;
    }
    return null;
  }, [allEpisodes, persistedContinueInfo]);

  const continueEpisode = useMemo(() => {
    if (matchedEpisodeFromAll) {
      return matchedEpisodeFromAll;
    }
    if (persistedContinueInfo) {
      return {
        id: persistedContinueInfo.id || `ep-${persistedContinueInfo.number}`,
        number: persistedContinueInfo.number,
        title: continueEntry?.episodeTitle || `Episódio ${persistedContinueInfo.number}`,
        numberDisplay: String(persistedContinueInfo.number),
        seasonId: currentSeason?.id ?? "",
      };
    }
    return undefined;
  }, [matchedEpisodeFromAll, persistedContinueInfo, continueEntry?.episodeTitle, currentSeason?.id]);

  useEffect(() => {
    if (continueEpisode && user?.id) {
      saveAnimeUserClientCache(
        candidateAnimeIds,
        {
          continueEpisode: {
            id: continueEpisode.id,
            number: continueEpisode.number,
          },
        },
        user.id,
      );
    }
  }, [continueEpisode, candidateAnimeIds, user?.id]);

  if (studioParam) {
    return (
      <Suspense fallback={null}>
        <StudioProductionsView
          studioName={studioParam}
          animeId={id}
        />
      </Suspense>
    );
  }

  if (dubladorParam) {
    return (
      <Suspense fallback={null}>
        <DubladorWorksView
          dubladorName={dubladorParam}
          dubladorId={dubladorIdParam}
          animeId={id}
        />
      </Suspense>
    );
  }

  if (staffParam) {
    return (
      <Suspense fallback={null}>
        <StaffWorksView
          staffName={staffParam}
          staffId={staffIdParam}
          animeId={id}
        />
      </Suspense>
    );
  }

  if (!anime && !hydrated) {
    return null;
  }

  if (!anime) {
    return (
      <div className="py-24 text-center">
        <p className="font-display text-2xl">
          Anime não encontrado
        </p>

        <Link
          to="/"
          className="mt-3 inline-block text-sm text-muted underline"
        >
          Voltar ao início
        </Link>
      </div>
    );
  }

  const continueTarget =
    continueEpisode ??
    allEpisodes[0];

  const watchButtonLabel =
    continueEpisode
      ? `Continuar no ep. ${continueEpisode.number}`
      : "Assistir";

  return (
    <article key={anime.id} className="pb-12">
      {/* HERO */}
      <section className="relative z-20 -mx-4 sm:-mx-6">
        <div
          key={`banner-${anime.id}`}
          className="relative max-sm:h-[22rem] max-sm:min-[380px]:h-[24rem] sm:h-[22rem] md:h-[26rem] lg:h-[28rem] w-full bg-elevated overflow-hidden"
        >
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#151126] via-[#0d0b18] to-bg" />
          {shouldRenderDesktopCoverBlur ? (
            <>
              <img
                key={`banner-blur-${anime.id}-${anime.cover}`}
                src={anilistImage(anime.cover, 480)}
                alt=""
                width={460}
                height={690}
                sizes="100vw"
                loading="eager"
                fetchPriority="low"
                decoding="async"
                className={cn(
                  "size-full object-cover object-center blur-sm scale-110",
                  !effectiveMobileSourceUrl &&
                    !isAdminBanner &&
                    !activeMobileBannerState &&
                    "max-sm:hidden",
                  effectiveMobileSourceUrl && "max-sm:hidden",
                )}
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#151126]/75 via-[#0d0b18]/65 to-bg" />
            </>
          ) : null}
          {shouldRenderPicture ? (
            <picture
              key={`picture-${anime.id}-${validDesktopBannerUrl ?? "none"}-${effectiveMobileSourceUrl ?? "none"}`}
              className={cn(
                "relative block size-full",
                !validDesktopBannerUrl && "sm:hidden",
                !effectiveMobileSourceUrl && "max-sm:hidden",
              )}
            >
              <source
                media={MOBILE_BANNER_MEDIA_QUERY}
                srcSet={
                  effectiveMobileSourceUrl
                    ? anilistImage(
                        effectiveMobileSourceUrl,
                        validMobileSourceUrl ? 640 : 1600,
                      )
                    : TRANSPARENT_BANNER_PIXEL
                }
                sizes={effectiveMobileSourceUrl ? "100vw" : undefined}
              />
              <source
                media={DESKTOP_BANNER_MEDIA_QUERY}
                srcSet={
                  validDesktopBannerUrl
                    ? anilistImage(validDesktopBannerUrl, 1600)
                    : TRANSPARENT_BANNER_PIXEL
                }
                sizes={validDesktopBannerUrl ? "100vw" : undefined}
              />
              <img
                key={`banner-img-${anime.id}-${validDesktopBannerUrl ?? "none"}-${effectiveMobileSourceUrl ?? "none"}`}
                src={anilistImage(
                  validDesktopBannerUrl ?? effectiveMobileSourceUrl,
                  validDesktopBannerUrl ? 1600 : 640,
                )}
                alt=""
                sizes="100vw"
                loading="eager"
                fetchPriority="high"
                decoding="async"
                onError={(e) => {
                  const failedUrl =
                    e.currentTarget.currentSrc ||
                    effectiveBannerUrl ||
                    validDesktopBannerUrl ||
                    effectiveMobileSourceUrl;
                  if (!failedUrl || failedUrl.startsWith("data:")) return;
                  setFailedBannerUrls((prev) =>
                    prev[failedUrl] ? prev : { ...prev, [failedUrl]: true },
                  );
                }}
                style={{
                  objectPosition:
                    activeMobileBannerState?.initialObjectPosition ?? "50% 24%",
                }}
                className={cn(
                  "size-full object-cover object-center sm:!object-center",
                  !effectiveMobileSourceUrl && "max-sm:hidden",
                  !validDesktopBannerUrl && "sm:hidden",
                )}
              />
            </picture>
          ) : null}

          {/* Sombra superior suave para contraste */}
          <div className="pointer-events-none absolute inset-x-0 top-0 max-sm:h-20 sm:h-28 bg-gradient-to-b from-black/60 via-black/20 to-transparent sm:from-black/50 sm:via-black/15" />

          {/* Vinheta lateral sutil */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-bg/15 via-transparent to-bg/10" />

          {/* Degradê inferior suave integrando com o fundo dark da página */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 max-sm:h-40 sm:h-36 max-sm:bg-[linear-gradient(to_top,var(--color-bg)_0%,color-mix(in_srgb,var(--color-bg)_88%,transparent)_24%,color-mix(in_srgb,var(--color-bg)_44%,transparent)_60%,transparent_100%)] sm:bg-gradient-to-t sm:from-bg sm:via-bg/25 sm:to-transparent" />
        </div>

        <div className="relative z-10 max-sm:-mt-40 max-sm:min-[380px]:-mt-44 sm:-mt-28 md:-mt-32 px-4 sm:px-6">
          <div className="mx-auto flex max-w-6xl flex-col max-sm:gap-3.5 sm:flex-row sm:gap-6">
            {/* CAPA VERTICAL SOBREPOSTA À ESQUERDA */}
            <div className="block">
              <div className="relative aspect-2/3 w-28 max-sm:min-[380px]:w-32 sm:w-44 shrink-0 overflow-hidden rounded-2xl bg-elevated shadow-[0_12px_36px_rgba(0,0,0,0.85),0_0_24px_rgba(168,85,247,0.2)] ring-1 ring-purple-500/35 sm:translate-y-8.5">
                {(() => {
                  const posterUrl = anime.cover || null;
                  const coverSrc = posterUrl ? anilistImage(posterUrl, 180) : null;
                  return (
                    <HikariImage
                      key={`poster-${anime.id}-${posterUrl}`}
                      src={coverSrc}
                      fallbackSrc={getSmallImageFallback(posterUrl, coverSrc)}
                      alt={title}
                      width={180}
                      height={270}
                      priority={false}
                      loading="lazy"
                      fetchPriority="low"
                      decoding="async"
                      fallbackClassName="bg-elevated"
                      className="size-full object-cover"
                    />
                  );
                })()}
              </div>
            </div>

            {/* INFORMAÇÕES COMPLETAS */}
            <div className="flex min-w-0 flex-1 flex-col justify-end pb-1 sm:pb-2">
              {/* TÍTULO E BADGES RESPONSIVOS (EXATAMENTE UM H1) */}
              <div>
                <div className="mb-1.5 sm:mb-2 flex items-center gap-2">
                  {anime.score != null && (
                    <span className="inline-flex items-center gap-1 rounded-md sm:rounded-lg border border-amber-500/35 bg-amber-950/60 px-1.5 sm:px-2.5 py-0.5 sm:py-1 text-[10px] sm:text-xs font-bold tabular-nums text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.2)]">
                      ★ {scoreLabel(anime.score)}
                    </span>
                  )}
                  {anime.format && (
                    <span className="inline-flex items-center gap-1 rounded-md border border-purple-500/30 bg-purple-950/70 px-2 py-0.5 text-[10px] sm:text-xs font-semibold text-purple-300 uppercase">
                      {formatLabel(anime.format)}
                    </span>
                  )}
                </div>

                <h1 className="font-display text-2xl font-bold leading-tight tracking-tight text-white line-clamp-3 [text-shadow:0_1px_2px_rgba(0,0,0,0.5)] sm:text-4xl md:text-5xl sm:line-clamp-none">
                  {title}
                </h1>

                {anime.titles.native && (
                  <p className="mt-1 font-display text-xs sm:text-sm font-medium text-purple-300/70 truncate sm:overflow-visible">
                    {anime.titles.native}
                  </p>
                )}
              </div>

              {/* METADADOS */}
              <div className="mt-2.5 sm:mt-4 flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
                {anime.score != null && (
                  <span className="hidden sm:inline-flex items-center gap-1 rounded-lg border border-amber-500/35 bg-amber-950/60 px-2.5 py-1 text-xs font-bold tabular-nums text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.2)]">
                    ★ {scoreLabel(anime.score)}
                  </span>
                )}

                {anime.year && (
                  <span className="inline-flex items-center rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-zinc-300">
                    {anime.year}
                  </span>
                )}

                <span className="inline-flex items-center rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-zinc-300">
                  {formatLabel(anime.format)}
                </span>

                <span className="inline-flex items-center rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-zinc-300">
                  {episodeCount} {episodeCount === 1 ? "episódio" : "episódios"}
                </span>

                {statusLabel(anime.status) && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-purple-500/20 bg-purple-950/40 px-2.5 py-1 text-xs font-medium text-purple-300">
                    {isReleasing && (
                      <span className="size-1.5 rounded-full bg-[#1ef066] shadow-[0_0_8px_rgba(30,240,102,0.9)] motion-safe:animate-pulse" />
                    )}
                    <span>{statusLabel(anime.status)}</span>
                  </span>
                )}
              </div>

              {/* GÊNEROS */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {anime.genres.map((g) => (
                  <Link
                    key={g}
                    to="/search"
                    search={{
                      q: "",
                      genre: g,
                      year: "",
                      format: "",
                      status: "",
                      sort: "TRENDING_DESC",
                    }}
                    className="inline-flex items-center rounded-lg border border-purple-500/20 bg-[#161326]/80 px-2.5 py-1 text-xs font-medium text-purple-200/90 transition-all duration-250 ease-out select-none cursor-pointer hover:border-purple-500/60 hover:bg-purple-950/70 hover:text-purple-100 hover:shadow-[0_0_12px_rgba(168,85,247,0.35)] motion-safe:hover:scale-[1.03] motion-safe:active:scale-[0.95] active:border-purple-400/80 active:bg-purple-900/60 active:shadow-[0_0_14px_rgba(168,85,247,0.5)] active:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/70"
                  >
                    {genreLabel(g)}
                  </Link>
                ))}
              </div>

              {/* BOTÕES DE AÇÃO */}
              <div className="mt-5 flex flex-wrap items-center gap-2.5 sm:gap-3">
                {hasAvailableEpisodes && (
                  <Link
                    to="/watch/$id/$ep"
                    params={{
                      id: anime.id,
                      ep: `ep-${continueTarget?.number || 1}`,
                    }}
                    className={cn(
                      "group relative inline-flex h-11 sm:h-12 items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-purple-500 px-5 sm:px-6 text-sm sm:text-base font-semibold text-white shadow-[0_4px_20px_rgba(168,85,247,0.35)] transition-[color,background-color,border-color,box-shadow,filter,transform] duration-250 ease-out select-none touch-manipulation [-webkit-tap-highlight-color:transparent] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400",
                      "[@media(hover:hover)_and_(pointer:fine)]:hover:from-purple-500 [@media(hover:hover)_and_(pointer:fine)]:hover:to-purple-400 [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-[0_4px_26px_rgba(168,85,247,0.5)] [@media(hover:hover)_and_(pointer:fine)]:hover:brightness-110",
                      "[@media(hover:hover)_and_(pointer:fine)]:motion-safe:hover:scale-[1.02] [@media(hover:hover)_and_(pointer:fine)]:motion-safe:active:scale-[0.96]",
                      "active:brightness-125 active:shadow-[0_0_28px_rgba(168,85,247,0.65)]",
                      isWatchPressing && "[@media(hover:hover)_and_(pointer:fine)]:motion-safe:scale-[0.96] brightness-125 shadow-[0_0_28px_rgba(168,85,247,0.65)]"
                    )}
                    onClick={() => {
                      setIsWatchPressing(true);
                      setTimeout(() => {
                        setIsWatchPressing(false);
                      }, 250);
                    }}
                  >
                    <Play className="size-4 fill-current pointer-events-none transition-transform duration-250 ease-out [@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-105" />
                    <span id="hikari-watch-btn-text" suppressHydrationWarning>
                      {watchButtonLabel}
                    </span>
                  </Link>
                )}

                {/* 1. BOTÃO MINHA COLEÇÃO (IDENTIDADE PRÓPRIA & REUTILIZA MODAL DO PERFIL) */}
                <button
                  type="button"
                  onClick={() => {
                    if (isCollectionBusy) return;
                    if (!user) {
                      setShowAuthModal(true);
                      return;
                    }
                    setIsCollectionModalOpen(true);
                  }}
                  disabled={isCollectionBusy}
                  aria-label={
                    trackingStatus
                      ? `Gerenciar Coleção: ${COLLECTION_STATUS_CONFIG[trackingStatus].label}`
                      : "Adicionar à Minha Coleção"
                  }
                  className={cn(
                    "group relative inline-flex h-11 sm:h-12 items-center justify-center gap-2.5 rounded-2xl px-4 sm:px-5 text-sm sm:text-base font-semibold select-none cursor-pointer overflow-hidden bg-black/75 md:bg-black/60 md:backdrop-blur-md transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400",
                    "before:pointer-events-none before:absolute before:inset-x-3 before:top-0 before:h-px before:transition-opacity before:duration-300",
                    "motion-safe:hover:scale-[1.02] motion-safe:active:scale-[0.97]",
                    trackingStatus
                      ? cn(
                          "border bg-gradient-to-r",
                          COLLECTION_STATUS_CONFIG[trackingStatus].border,
                          COLLECTION_STATUS_CONFIG[trackingStatus].bg,
                          COLLECTION_STATUS_CONFIG[trackingStatus].shadow,
                          "before:bg-gradient-to-r before:from-transparent before:via-white/30 before:to-transparent hover:brightness-110",
                        )
                      : cn(
                          "border border-violet-500/35 bg-gradient-to-b from-[#1b1432]/95 via-[#120d24]/90 to-[#0a0714]/95 text-zinc-100",
                          "shadow-[0_4px_20px_rgba(0,0,0,0.5),0_0_18px_rgba(139,92,246,0.18)]",
                          "hover:border-violet-400/75 hover:text-white hover:shadow-[0_6px_26px_rgba(0,0,0,0.6),0_0_28px_rgba(139,92,246,0.36)] hover:brightness-110",
                          "before:bg-gradient-to-r before:from-transparent before:via-violet-400/40 before:to-transparent",
                        ),
                  )}
                >
                  {/* Iluminação ambiente sutil */}
                  <span
                    className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(168,85,247,0.18),transparent_70%)] opacity-80 transition-opacity duration-300 group-hover:opacity-100"
                    aria-hidden="true"
                  />

                  {trackingStatus ? (
                    <div className="relative z-10 flex items-center gap-2">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-lg border border-white/20 bg-white/10 shadow-[0_0_8px_rgba(255,255,255,0.1)]">
                        <span
                          className={cn(
                            "size-2 rounded-full transition-transform duration-300 group-hover:scale-125",
                            COLLECTION_STATUS_CONFIG[trackingStatus].glowDot,
                          )}
                        />
                      </span>
                      <span
                        id="hikari-collection-btn-text"
                        suppressHydrationWarning
                        className={cn(
                          "font-bold tracking-tight text-white",
                          COLLECTION_STATUS_CONFIG[trackingStatus].textColor,
                        )}
                      >
                        {COLLECTION_STATUS_CONFIG[trackingStatus].label}
                      </span>
                      {trackingEpisodesWatched > 0 && (
                        <span
                          className={cn(
                            "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-mono font-bold tracking-tight",
                            COLLECTION_STATUS_CONFIG[trackingStatus].pillBg,
                            COLLECTION_STATUS_CONFIG[trackingStatus].pillText,
                          )}
                        >
                          {trackingEpisodesWatched}/{episodeCount} eps
                        </span>
                      )}
                      <ChevronDown className="size-3.5 opacity-60 transition-transform duration-200 group-hover:translate-y-0.5 ml-0.5" />
                    </div>
                  ) : (
                    <div className="relative z-10 flex items-center gap-2">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-lg border border-violet-400/30 bg-violet-500/20 shadow-[0_0_10px_rgba(139,92,246,0.25)] transition-all duration-300 group-hover:scale-110 group-hover:border-violet-400/60 group-hover:bg-violet-500/30">
                        <Bookmark className="size-3.5 text-violet-300 transition-colors group-hover:text-violet-100" />
                      </span>
                      <span
                        id="hikari-collection-btn-text"
                        suppressHydrationWarning
                        className="font-semibold tracking-tight text-zinc-100 group-hover:text-white transition-colors"
                      >
                        Minha Coleção
                      </span>
                    </div>
                  )}
                </button>

                {/* 2. BOTÃO DE FAVORITOS (IDENTIDADE PRÓPRIA, MODERNA & DIFERENCIADA) */}
                <button
                  type="button"
                  onClick={() => void handleToggleFavorite()}
                  disabled={isFavoriteBusy}
                  aria-label={
                    isFavorite
                      ? "Remover dos favoritos"
                      : "Adicionar aos favoritos"
                  }
                  className={cn(
                    "group relative inline-flex h-11 sm:h-12 items-center justify-center gap-2.5 rounded-2xl px-4 sm:px-5 text-sm sm:text-base font-semibold select-none cursor-pointer overflow-hidden bg-black/75 md:bg-black/60 md:backdrop-blur-md transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400",
                    "before:pointer-events-none before:absolute before:inset-x-3 before:top-0 before:h-px before:transition-opacity before:duration-300",
                    "motion-safe:hover:scale-[1.02] motion-safe:active:scale-[0.97]",
                    isFavorite
                      ? cn(
                          "border border-rose-400/80 bg-gradient-to-r from-[#5a0828] via-[#40071c] to-[#250410] text-white",
                          "shadow-[0_4px_22px_rgba(0,0,0,0.6),0_0_28px_rgba(244,63,94,0.45),inset_0_1px_2px_rgba(255,255,255,0.25)]",
                          "hover:border-rose-300 hover:shadow-[0_6px_28px_rgba(0,0,0,0.7),0_0_36px_rgba(244,63,94,0.65)] hover:brightness-110",
                          "before:bg-gradient-to-r before:from-transparent before:via-white/45 before:to-transparent",
                        )
                      : cn(
                          "border border-rose-500/35 bg-gradient-to-b from-[#240d1a]/95 via-[#160810]/90 to-[#0b0408]/95 text-rose-100/90",
                          "shadow-[0_4px_20px_rgba(0,0,0,0.5),0_0_18px_rgba(244,63,94,0.16)]",
                          "hover:border-rose-400/75 hover:text-white hover:shadow-[0_6px_26px_rgba(0,0,0,0.6),0_0_28px_rgba(244,63,94,0.36)] hover:brightness-110",
                          "before:bg-gradient-to-r before:from-transparent before:via-rose-400/40 before:to-transparent",
                        ),
                  )}
                >
                  {/* Iluminação ambiente rubi */}
                  <span
                    className={cn(
                      "pointer-events-none absolute inset-0 transition-opacity duration-300",
                      isFavorite
                        ? "bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.2),transparent_70%)] opacity-100"
                        : "bg-[radial-gradient(ellipse_at_top,rgba(244,63,94,0.18),transparent_70%)] opacity-80 group-hover:opacity-100",
                    )}
                    aria-hidden="true"
                  />

                  <div className="relative z-10 flex items-center gap-2">
                    <span
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-lg transition-all duration-300",
                        isFavorite
                          ? "border border-rose-300/70 bg-rose-500/35 shadow-[0_0_14px_rgba(244,63,94,0.7)]"
                          : "border border-rose-400/30 bg-rose-500/15 shadow-[0_0_10px_rgba(244,63,94,0.25)] group-hover:scale-110 group-hover:border-rose-400/60 group-hover:bg-rose-500/25",
                      )}
                    >
                      <Heart
                        className={cn(
                          "size-3.5 transition-all duration-300 ease-out",
                          isFavorite
                            ? "fill-rose-500 text-rose-200 scale-110 drop-shadow-[0_0_8px_rgba(244,63,94,0.9)] motion-safe:animate-[bookmarkPop_350ms_cubic-bezier(0.34,1.56,0.64,1)]"
                            : "text-rose-300 group-hover:text-rose-100",
                        )}
                      />
                    </span>
                    <span
                      id="hikari-favorite-btn-text"
                      suppressHydrationWarning
                      className={cn(
                        "tracking-tight transition-colors",
                        isFavorite
                          ? "font-bold text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.6)]"
                          : "font-semibold text-rose-100/90 group-hover:text-white",
                      )}
                    >
                      {isFavorite ? "Favoritado" : "Favoritar"}
                    </span>
                  </div>
                </button>

                <script
                  dangerouslySetInnerHTML={{
                    __html: `(function(){try{var rc=localStorage.getItem("hikari_anime_user_cache_v1");var rs=localStorage.getItem("hikari-user-state-v1");var c=rc?JSON.parse(rc):null;var s=rs?JSON.parse(rs):null;var signedOut=false;try{signedOut=sessionStorage.getItem("hikari_signed_out")==="true";}catch(err){}var ssrUid=${JSON.stringify(user?.id ?? null)};var hasSsrUser=${JSON.stringify(matchesInitialUser)};var uid=signedOut?null:(ssrUid||(s&&s.state&&s.state.currentUserId?s.state.currentUserId:null));var entries=uid&&c&&typeof c==="object"&&typeof c.ownerUserId==="string"&&c.ownerUserId===uid&&c.entries&&typeof c.entries==="object"?c.entries:{};var ids=${JSON.stringify(candidateAnimeIds)};var k=null;for(var i=0;i<ids.length;i++){if(entries[ids[i]]){k=entries[ids[i]];break;}}var num=k&&k.continueEpisode?k.continueEpisode.number:null;var cw=uid&&s&&s.state&&s.state.userContinueWatching&&Array.isArray(s.state.userContinueWatching[uid])?s.state.userContinueWatching[uid]:(!uid&&s&&s.state&&Array.isArray(s.state.anonymousContinueWatching)?s.state.anonymousContinueWatching:[]);if(!num&&cw.length){for(var j=0;j<cw.length;j++){var e=cw[j];if(ids.indexOf(e.animeId)!==-1||e.animeId===${JSON.stringify(id)}){num=e.episodeNumber||1;break;}}}if(num){var w=document.getElementById("hikari-watch-btn-text");if(w)w.textContent="Continuar no ep. "+num;}if(!hasSsrUser){var st=k&&k.trackingStatus?k.trackingStatus:null;if(st){var m={watching:"Assistindo",completed:"Concluído",on_hold:"Em espera",dropped:"Abandonado",planning:"Planejado"};var cl=document.getElementById("hikari-collection-btn-text");if(cl&&m[st])cl.textContent=m[st];}var fav=k&&k.isFavorite===true;if(fav){var f=document.getElementById("hikari-favorite-btn-text");if(f)f.textContent="Favoritado";}}}catch(e){}})();`,
                  }}
                />

                {canEdit && (
                  <Link
                    to="/admin/$id"
                    params={{
                      id: localRecord?.id ?? "new",
                    }}
                    search={{
                      importId: anime.id,
                    }}
                    className="inline-flex h-11 sm:h-12 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 sm:px-5 text-sm sm:text-base font-medium text-zinc-300 shadow-sm transition-[color,background-color,border-color,box-shadow,filter,transform] duration-200 ease-out [@media(hover:hover)]:hover:border-purple-500/40 [@media(hover:hover)]:hover:bg-[#1a142e] [@media(hover:hover)]:hover:text-white [@media(hover:hover)]:hover:brightness-110 [@media(hover:hover)]:motion-safe:hover:scale-[1.02] [@media(hover:hover)]:motion-safe:active:scale-[0.98] active:bg-[#1a142e] active:text-white select-none touch-manipulation [-webkit-tap-highlight-color:transparent] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 cursor-pointer"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="size-4 text-zinc-400 pointer-events-none"
                      aria-hidden="true"
                    >
                      <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
                      <path d="m15 5 4 4" />
                    </svg>
                    <span>Editar</span>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SINOPSE */}
      {anime.synopsis && (
        <section className="mt-10 max-w-4xl rounded-2xl border border-purple-500/15 bg-gradient-to-b from-[#131024]/70 to-[#0d0b18]/50 p-5 sm:p-6 shadow-sm">
          <div className="flex items-center gap-2.5">
            <span className="h-5 w-1 rounded-full bg-purple-500" />
            <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-white">
              Sinopse
            </h2>
          </div>

          <p
            className={cn(
              "mt-3.5 text-sm sm:text-base leading-relaxed text-zinc-300",
              !synopsisExpanded && "line-clamp-4",
            )}
          >
            {anime.synopsis}
          </p>

          {anime.synopsis.length > 260 && (
            <button
              type="button"
              onClick={() => setSynopsisExpanded(!synopsisExpanded)}
              className="mt-3 inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-purple-400 hover:text-purple-300 transition-all duration-200 ease-out hover:brightness-110 motion-safe:hover:scale-[1.02] cursor-pointer"
            >
              {synopsisExpanded ? "Mostrar menos" : "Ler mais"}
            </button>
          )}
        </section>
      )}

      {/* TRAILER OFICIAL (posicionado logo após a Sinopse) */}
      {yt && (
        <section className="mt-10 max-w-4xl">
          <div className="flex items-center gap-2.5">
            <span className="h-6 w-1 rounded-full bg-purple-500" />
            <h2 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Trailer Oficial
            </h2>
          </div>

          <TrailerFacade key={`${anime.id}-${yt}`} videoId={yt} title={title} />
        </section>
      )}

      {/* TEMPORADAS */}
      {seasonNavigation.length > 1 && (
        <SeasonSelector
          seasons={seasonNavigation}
          currentAnimeId={anime.id}
        />
      )}

      {/* EPISÓDIOS (ACIMA DO ELENCO) */}
      {(hasAvailableEpisodes ? Boolean(currentSeason) : true) && (
        <section id="episodes" className="mt-12">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="h-6 w-1 rounded-full bg-purple-500" />
                <h2 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  Episódios
                </h2>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs sm:text-sm text-zinc-400">
                <span className="inline-flex items-center rounded-md border border-white/5 bg-white/5 px-2.5 py-1 text-zinc-300">
                  {episodeCount}{" "}
                  {episodeCount === 1
                    ? "episódio disponível"
                    : "episódios disponíveis"}
                </span>
                {hasAvailableEpisodes && user && (
                  <>
                    <span className="text-zinc-600">·</span>
                    <span className="inline-flex items-center rounded-md border border-purple-500/20 bg-purple-950/40 px-2.5 py-1 font-medium text-purple-300">
                      {watchedCount}/{episodeCount} assistidos
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="mt-5">
            {hasAvailableEpisodes && currentSeason ? (
              <EpisodeGrid
                episodes={effectiveEpisodes ?? currentSeason.episodes}
                animeId={anime.id}
                watchedEpisodes={watchedEpisodes}
              />
            ) : (
              <div className="rounded-2xl border border-white/10 bg-[#100e1b]/80 px-5 py-7 sm:px-6">
                <p className="text-sm sm:text-base font-semibold text-zinc-100">
                  Episódios indisponíveis no momento
                </p>
                <p className="mt-1 text-xs sm:text-sm text-zinc-400">
                  Este título ainda não possui episódios disponíveis para reprodução no catálogo.
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Sentinela de proximidade para carregamento sob demanda dos créditos */}
      <div
        id="credits-sentinel"
        ref={creditsSentinelRef}
        className="h-px w-full pointer-events-none"
        aria-hidden="true"
      />

      {/* 1. PERSONAGENS, DUBLADORES, ESTÚDIOS E EQUIPE TÉCNICA COM SUPORTE A FAVORITOS */}
      <FavoritesEntityContext.Provider value={favoritesEntityContextValue}>
        {/* 1. PERSONAGENS (ELENCO) */}
        <SectionReveal
          lazy={false}
          className="[content-visibility:auto] [contain-intrinsic-size:auto_280px]"
        >
          <ElencoSection
            key={`elenco-${anime.id}`}
            animeId={anime.id}
            characters={effectiveCharacters}
            isMobile={isMobileViewport}
          />
        </SectionReveal>

        {/* 2. DUBLADORES */}
        <SectionReveal
          lazy={false}
          className="[content-visibility:auto] [contain-intrinsic-size:auto_280px]"
        >
          <DubladoresSection
            key={`dubladores-${anime.id}`}
            animeId={anime.id}
            characters={effectiveCharacters}
            isMobile={isMobileViewport}
          />
        </SectionReveal>

        {/* 3. DIREÇÃO E EQUIPE TÉCNICA */}
        <SectionReveal
          lazy={false}
          className="[content-visibility:auto] [contain-intrinsic-size:auto_240px]"
        >
          <DirecaoEquipeSection
            key={`staff-${anime.id}`}
            animeId={anime.id}
            studios={effectiveStudios}
            staff={effectiveStaff}
            isMobile={isMobileViewport}
          />
        </SectionReveal>
      </FavoritesEntityContext.Provider>

      {/* 3. INFORMAÇÕES ADICIONAIS */}
      <SectionReveal
        lazy={false}
        className="[content-visibility:auto] [contain-intrinsic-size:auto_220px]"
      >
        <InformacoesAdicionaisSection key={`info-${anime.id}`} anime={anime} />
      </SectionReveal>

      {/* 4. IMAGENS (GALERIA) */}
      <SectionReveal
        lazy={false}
        className="[content-visibility:auto] [contain-intrinsic-size:auto_260px]"
      >
        <ImagensSection
          key={`imagens-${anime.id}`}
          animeId={anime.id}
          images={anime.images}
          title={title}
          bannerUrl={anime.banner}
          coverUrl={anime.cover}
          malId={anime.malId}
        />
      </SectionReveal>

      {/* 5. RELACIONADOS (SEM BOTÃO DE SALVAR) */}
      {anime.recommendations.length > 0 && (
        <SectionReveal
          lazy={false}
          className="[content-visibility:auto] [contain-intrinsic-size:auto_280px]"
        >
          <RelatedSection
            key={`related-${anime.id}`}
            animeId={anime.id}
            recommendations={anime.recommendations}
          />
        </SectionReveal>
      )}

      {/* 6. COMENTÁRIOS DO ANIME */}
      <SectionReveal
        minHeight="300px"
        rootMargin="100px 0px"
        lazy={!shouldForceCommentsLoad && !shouldLoadCredits}
      >
        <Suspense fallback={<CommentsLoadingFallback />}>
          <DeferredAnimeComments
            key={`comments-${anime.id}`}
            animeId={anime.id}
            animeTitle={title}
            targetCommentId={targetCommentId}
          />
        </Suspense>
      </SectionReveal>

      {/* Modal de Gerenciamento da Coleção existente no Perfil */}
      {isCollectionModalOpen && trackingItem && (
        <Suspense fallback={null}>
          <ProfileAnimeEditModal
            isOpen={isCollectionModalOpen}
            item={trackingItem}
            onClose={() => setIsCollectionModalOpen(false)}
            onSave={async (data) => {
              await handleSaveCollection({
                status: data.status,
                episodesWatched: data.episodesWatched,
                score: data.score,
              });
            }}
          />
        </Suspense>
      )}

      {/* Modal de Orientação para Visitantes não Autenticados */}
      <AuthPromptModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
    </article>
  );
}

function AuthPromptModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  useScrollLock(isOpen);
  const navigate = useNavigate();
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 md:bg-black/60 md:backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-prompt-title"
    >
      <div className="relative w-full max-w-sm sm:max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#0d0918] p-5 sm:p-7 shadow-[0_25px_70px_rgba(0,0,0,0.85)] text-center space-y-4">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3.5 right-3.5 rounded-xl border border-white/10 p-1.5 sm:p-2 text-zinc-400 hover:bg-white/5 hover:text-white transition-colors cursor-pointer"
          title="Fechar"
        >
          <X className="size-4" />
        </button>

        <div className="mx-auto flex size-12 sm:size-14 items-center justify-center rounded-2xl border border-purple-500/40 bg-purple-600/20 text-purple-300 shadow-[0_0_20px_rgba(168,85,247,0.3)]">
          <Bookmark className="size-6 sm:size-7" />
        </div>

        <div className="space-y-1.5">
          <h3
            id="auth-prompt-title"
            className="font-display text-lg sm:text-xl font-bold text-white"
          >
            Organize sua Coleção
          </h3>
          <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed max-w-xs sm:max-w-sm mx-auto">
            Entre na sua conta para adicionar títulos à sua coleção, favoritar animes,
            personagens, dubladores, estúdios e equipe técnica, e sincronizar suas preferências.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <button
            type="button"
            onClick={() => {
              onClose();
              void navigate({ to: "/login" });
            }}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-[0_0_20px_rgba(168,85,247,0.35)] hover:brightness-110 active:scale-98 transition-all cursor-pointer"
          >
            <LogIn className="size-4" />
            <span>Entrar ou Cadastrar</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 px-4 py-2.5 text-xs sm:text-sm font-medium text-zinc-400 hover:bg-white/5 hover:text-white transition-colors cursor-pointer"
          >
            Depois
          </button>
        </div>
      </div>
    </div>
  );
}

function CommentsLoadingFallback() {
  return (
    <section aria-label="Carregando comentários" className="mt-12 min-h-[300px]">
      <div className="grid gap-6 sm:gap-8">
        <div className="min-w-0">
          <div className="border-b border-purple-500/20 pb-4">
            <div className="flex items-center gap-2.5">
              <span className="h-6 w-1 rounded-full bg-purple-500 shrink-0" />
              <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Comentários
              </h2>
            </div>
          </div>
        </div>

        <div
          role="status"
          aria-live="polite"
          className="elizabeth-loading-container relative overflow-hidden rounded-2xl sm:rounded-3xl border border-[#a855f7]/25 bg-gradient-to-b from-[#130f24]/95 via-[#0c0a15]/95 to-[#08070d] p-8 sm:p-12 text-center shadow-[0_8px_32px_rgba(0,0,0,0.65),0_0_35px_rgba(168,85,247,0.12)] md:backdrop-blur-md"
        >
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-36 bg-[#a855f7]/15 rounded-full blur-3xl"
            aria-hidden="true"
          />

          <div className="relative z-10 flex flex-col items-center justify-center">
            <div className="flex items-center justify-center gap-2.5">
              <div
                className="size-5 rounded-full border-2 border-[#a855f7]/25 border-t-[#c084fc] animate-spin shadow-[0_0_12px_rgba(168,85,247,0.45)] shrink-0"
                aria-hidden="true"
              />
              <p className="text-sm font-medium tracking-wide text-white/85 select-none">
                Carregando comentários...
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

type SeasonNavItem = {
  id: string;
  label?: string;
  title?: string;
};

function prefersReducedMotionNow(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function SeasonSelector({
  seasons,
  currentAnimeId,
}: {
  seasons: SeasonNavItem[];
  currentAnimeId: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isRendered, setIsRendered] = useState(false);
  const [isEntered, setIsEntered] = useState(false);
  const [pendingSeasonId, setPendingSeasonId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const openRafRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    if (openRafRef.current !== null) {
      window.cancelAnimationFrame(openRafRef.current);
      openRafRef.current = null;
    }
  }, []);

  const openDropdown = useCallback(() => {
    clearTimers();
    setIsOpen(true);
    setIsRendered(true);

    if (prefersReducedMotionNow()) {
      setIsEntered(true);
      return;
    }

    openRafRef.current = window.requestAnimationFrame(() => {
      openRafRef.current = window.requestAnimationFrame(() => {
        setIsEntered(true);
        openRafRef.current = null;
      });
    });
  }, [clearTimers]);

  const closeDropdown = useCallback(
    (restoreFocus = false) => {
      clearTimers();
      setIsOpen(false);
      setIsEntered(false);

      if (restoreFocus) {
        triggerRef.current?.focus();
      }

      if (prefersReducedMotionNow()) {
        setIsRendered(false);
        return;
      }

      closeTimerRef.current = window.setTimeout(() => {
        setIsRendered(false);
        closeTimerRef.current = null;
      }, 155);
    },
    [clearTimers],
  );

  const toggleDropdown = useCallback(() => {
    if (isOpen) {
      closeDropdown();
    } else {
      openDropdown();
    }
  }, [isOpen, closeDropdown, openDropdown]);

  useEffect(() => clearTimers, [clearTimers]);

  useEffect(() => {
    setPendingSeasonId(null);
  }, [currentAnimeId]);

  const activeSeasonId =
    pendingSeasonId && seasons.some((s) => s.id === pendingSeasonId)
      ? pendingSeasonId
      : currentAnimeId;

  const activeIndex = useMemo(() => {
    const idx = seasons.findIndex((s) => s.id === activeSeasonId);
    return idx >= 0 ? idx : 0;
  }, [seasons, activeSeasonId]);

  const activeSeason = seasons[activeIndex] ?? seasons[0];
  const activeSeasonTitle =
    activeSeason?.label ??
    activeSeason?.title ??
    `Temporada ${activeIndex + 1}`;

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (
        target &&
        containerRef.current &&
        !containerRef.current.contains(target)
      ) {
        closeDropdown();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDropdown(true);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, closeDropdown]);

  useEffect(() => {
    if (!isRendered) return;
    const listEl = listRef.current;
    if (!listEl) return;

    const nodes = listEl.querySelectorAll<HTMLElement>("[data-season-option]");
    let activeEl: HTMLElement | null = null;
    for (let i = 0; i < nodes.length; i += 1) {
      if (nodes[i].dataset.seasonOption === activeSeasonId) {
        activeEl = nodes[i];
        break;
      }
    }
    if (!activeEl) return;

    const itemTop = activeEl.offsetTop;
    const itemBottom = itemTop + activeEl.offsetHeight;
    const viewTop = listEl.scrollTop;
    const viewBottom = viewTop + listEl.clientHeight;

    if (itemTop < viewTop) {
      listEl.scrollTop = Math.max(0, itemTop - 6);
    } else if (itemBottom > viewBottom) {
      listEl.scrollTop = itemBottom - listEl.clientHeight + 6;
    }
  }, [isRendered, activeSeasonId]);

  return (
    <section
      aria-label="Seletor de temporadas"
      className={cn(
        "relative mt-8 w-full max-w-full sm:w-fit",
        isRendered ? "z-30" : "z-10",
      )}
    >
      <div
        ref={containerRef}
        className="relative w-full max-w-[22rem] sm:w-auto sm:min-w-[19.5rem] sm:max-w-[24rem]"
      >
        <button
          ref={triggerRef}
          type="button"
          onClick={toggleDropdown}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls="hikari-season-selector-menu"
          className={cn(
            "group/trigger flex w-full items-center gap-3 rounded-md border bg-gradient-to-b px-3.5 py-2.5 text-left select-none cursor-pointer touch-manipulation [-webkit-tap-highlight-color:transparent] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/80",
            "motion-safe:transition-[border-color,box-shadow,background-color,transform] motion-safe:duration-200 motion-safe:ease-out motion-safe:active:scale-[0.99] motion-reduce:transition-none",
            isOpen
              ? "border-purple-400/55 from-[#19142d] to-[#100d1d] shadow-[0_10px_28px_rgba(0,0,0,0.58),0_0_20px_rgba(168,85,247,0.2)]"
              : "border-purple-500/25 from-[#141124]/95 to-[#0d0b18]/95 shadow-[0_6px_20px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.04)] hover:border-purple-400/45 hover:from-[#18142b]/95 hover:to-[#100d1c]/95 hover:shadow-[0_8px_24px_rgba(0,0,0,0.5),0_0_16px_rgba(168,85,247,0.14)]",
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "h-7 w-1 shrink-0 rounded-xs bg-gradient-to-b from-purple-400 to-purple-600 transition-shadow duration-200",
              isOpen
                ? "shadow-[0_0_12px_rgba(192,132,252,0.75)]"
                : "shadow-[0_0_8px_rgba(168,85,247,0.45)]",
            )}
          />

          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 text-[11px] leading-none">
              <span className="font-semibold tracking-wider text-purple-300/90 uppercase tabular-nums">
                Temporada {activeIndex + 1}
              </span>
              <span aria-hidden="true" className="text-purple-400/40">
                ·
              </span>
              <span className="font-medium tabular-nums text-zinc-400">
                {seasons.length} disponíveis
              </span>
            </span>

            <span
              title={activeSeasonTitle}
              className="mt-1 block truncate font-display text-sm sm:text-[15px] font-semibold leading-snug text-zinc-100 motion-safe:transition-colors motion-safe:duration-200 group-hover/trigger:text-white"
            >
              {activeSeasonTitle}
            </span>
          </span>

          <span
            aria-hidden="true"
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-sm border transition-colors duration-200 motion-reduce:transition-none",
              isOpen
                ? "border-purple-400/45 bg-purple-500/20 text-purple-200"
                : "border-purple-500/20 bg-purple-950/35 text-purple-300/90 group-hover/trigger:border-purple-400/35 group-hover/trigger:bg-purple-900/35 group-hover/trigger:text-purple-200",
            )}
          >
            <ChevronDown
              className={cn(
                "size-4 motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
                isOpen && "rotate-180",
              )}
            />
          </span>
        </button>

        {isRendered ? (
          <div
            id="hikari-season-selector-menu"
            role="listbox"
            aria-label="Lista de temporadas"
            className={cn(
              "absolute left-0 top-full z-40 mt-2 w-full min-w-[17rem] max-w-[min(24rem,calc(100vw-2rem))] origin-top rounded-md border border-purple-500/30 bg-[#100d1c]/98 p-1.5 shadow-[0_18px_44px_rgba(0,0,0,0.78),0_0_24px_rgba(168,85,247,0.14)] md:backdrop-blur-md",
              "motion-safe:transition-[opacity,transform] motion-reduce:transition-none",
              isEntered
                ? "pointer-events-auto translate-y-0 scale-100 opacity-100 motion-safe:duration-[170ms] motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)]"
                : "pointer-events-none -translate-y-1.5 scale-[0.985] opacity-0 motion-safe:duration-[145ms] motion-safe:ease-out",
            )}
          >
            <div className="mb-1 flex items-center justify-between border-b border-white/[0.06] px-2.5 pt-1 pb-1.5">
              <span className="text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">
                Selecionar temporada
              </span>
              <span className="text-[10px] font-medium tabular-nums text-purple-300/80">
                {seasons.length} temporadas
              </span>
            </div>

            <div
              ref={listRef}
              className="max-h-72 space-y-1 overflow-y-auto overscroll-contain pr-0.5 custom-scrollbar"
            >
              {seasons.map((season, index) => {
                const selected = season.id === activeSeasonId;
                const seasonName =
                  season.label ??
                  season.title ??
                  `Temporada ${index + 1}`;
                const hasCustomTitle = !/^temporada\s+\d+$/i.test(
                  seasonName.trim(),
                );

                return (
                  <Link
                    key={season.id}
                    data-season-option={season.id}
                    role="option"
                    aria-selected={selected}
                    to="/anime/$id"
                    params={{ id: season.id }}
                    preload="intent"
                    resetScroll={false}
                    onClick={(e) => {
                      if (
                        e.metaKey ||
                        e.altKey ||
                        e.ctrlKey ||
                        e.shiftKey ||
                        e.button !== 0
                      ) {
                        return;
                      }

                      if (season.id === activeSeasonId) {
                        e.preventDefault();
                        closeDropdown();
                        return;
                      }

                      triggerMonetagSmartLinkOnNavigationClick(e);
                      setPendingSeasonId(season.id);
                      closeDropdown();
                    }}
                    className={cn(
                      "group/option relative flex w-full items-center gap-2.5 rounded-sm border px-2.5 py-2 text-left text-xs sm:text-[13px] select-none cursor-pointer touch-manipulation [-webkit-tap-highlight-color:transparent] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/75",
                      "motion-safe:transition-[background-color,border-color,color,box-shadow,transform] motion-safe:duration-200 motion-safe:ease-out motion-reduce:transition-none",
                      selected
                        ? "border-purple-400/40 bg-gradient-to-r from-purple-600/25 via-purple-500/15 to-purple-900/10 font-semibold text-white shadow-[0_0_14px_rgba(168,85,247,0.16),inset_0_1px_0_rgba(216,180,254,0.12)]"
                        : "border-transparent bg-transparent font-medium text-zinc-300 hover:border-purple-500/20 hover:bg-white/[0.04] hover:text-white motion-safe:active:scale-[0.99]",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-flex size-5 shrink-0 items-center justify-center rounded-xs text-[11px] font-bold tabular-nums motion-safe:transition-[background-color,color,box-shadow] motion-safe:duration-200 motion-reduce:transition-none",
                        selected
                          ? "bg-purple-500 text-white shadow-[0_0_10px_rgba(168,85,247,0.5)]"
                          : "bg-white/[0.06] text-zinc-400 group-hover/option:bg-purple-500/20 group-hover/option:text-purple-200",
                      )}
                    >
                      {index + 1}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span
                        title={seasonName}
                        className="block truncate leading-snug"
                      >
                        {seasonName}
                      </span>
                      {hasCustomTitle ? (
                        <span
                          className={cn(
                            "block text-[10px] leading-tight tabular-nums motion-safe:transition-colors motion-safe:duration-200",
                            selected
                              ? "font-medium text-purple-200/80"
                              : "font-normal text-zinc-500 group-hover/option:text-zinc-400",
                          )}
                        >
                          Temporada {index + 1}
                        </span>
                      ) : null}
                    </span>

                    <span
                      aria-hidden="true"
                      className={cn(
                        "ml-auto flex size-5 shrink-0 items-center justify-center rounded-xs motion-safe:transition-[opacity,transform,background-color] motion-safe:duration-200 motion-safe:ease-out motion-reduce:transition-none",
                        selected
                          ? "scale-100 bg-purple-500/25 text-purple-200 opacity-100"
                          : "scale-75 opacity-0",
                      )}
                    >
                      <Check className="size-3.5 stroke-[2.5]" />
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

interface UseProgressiveRailOptions {
  railRef: RefObject<HTMLDivElement | null>;
  totalCount: number;
  itemStridePx?: number;
  initialRenderCount?: number;
  initialImageCount?: number;
  strideBatch?: number;
  resetKey?: string;
  isMobile?: boolean;
}

function useProgressiveRail({
  railRef,
  totalCount,
  itemStridePx = 128,
  initialRenderCount,
  initialImageCount,
  strideBatch = 8,
  resetKey,
  isMobile = false,
}: UseProgressiveRailOptions) {
  // Limites iniciais otimizados: renderização progressiva leve (mobile: 8, desktop: 10)
  // e imagens antecipadas apenas para o que cabe na tela (mobile: 4, desktop: 7)
  const defaultRender = isMobile ? 8 : 10;
  const defaultImage = isMobile ? 4 : 7;
  const initRender = Math.min(totalCount, initialRenderCount ?? defaultRender);
  const initImage = Math.min(totalCount, initialImageCount ?? defaultImage);

  const [renderedLimit, setRenderedLimit] = useState(initRender);
  const [imageLimit, setImageLimit] = useState(initImage);
  const prevResetKeyRef = useRef(resetKey);

  if (prevResetKeyRef.current !== resetKey) {
    prevResetKeyRef.current = resetKey;
    setRenderedLimit(initRender);
    setImageLimit(initImage);
  }

  const effectiveRenderLimit = Math.max(renderedLimit, initRender);
  const effectiveImageLimit = Math.max(imageLimit, initImage);

  useIsomorphicLayoutEffect(() => {
    if (railRef.current && railRef.current.scrollLeft !== 0) {
      railRef.current.scrollTo({ left: 0, top: 0, behavior: "instant" });
    }
  }, [railRef, resetKey]);

  // Avança cards e imagens sob demanda ao rolar o trilho ou clicar na seta
  const advance = useCallback(
    (extraPx = 0) => {
      const el = railRef.current;
      if (!el) {
        startTransition(() => {
          setRenderedLimit((prev) => Math.min(totalCount, prev + strideBatch));
          setImageLimit((prev) => Math.min(totalCount, prev + strideBatch));
        });
        return;
      }
      const scrollPos = el.scrollLeft;
      const clientWidth = el.clientWidth;
      const neededRendered = Math.ceil(
        (scrollPos + clientWidth * 2.5 + extraPx) / itemStridePx,
      );
      const neededImages = Math.ceil(
        (scrollPos + clientWidth * 1.5 + extraPx) / itemStridePx,
      );

      startTransition(() => {
        setRenderedLimit((prev) =>
          neededRendered > prev ? Math.min(totalCount, neededRendered) : prev,
        );
        setImageLimit((prev) =>
          neededImages > prev ? Math.min(totalCount, neededImages) : prev,
        );
      });
    },
    [railRef, totalCount, itemStridePx, strideBatch],
  );

  // Escuta o arraste/scroll horizontal do trilho para materializar os próximos cards
  useEffect(() => {
    const el = railRef.current;
    if (!el) return;

    let rafId: number | null = null;
    const onScroll = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        advance(0);
      });
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [railRef, advance]);

  return {
    renderedLimit: Math.min(totalCount, effectiveRenderLimit),
    imageLimit: Math.min(totalCount, effectiveImageLimit),
    advance,
  };
}

function useHorizontalRailImageLimit(
  railRef: RefObject<HTMLDivElement | null>,
  totalCount: number,
  itemStridePx: number,
  initialCount: number,
  resetKey?: string,
) {
  const [limit, setLimit] = useState(() =>
    Math.min(totalCount, initialCount),
  );
  const prevResetKeyRef = useRef(resetKey);

  if (prevResetKeyRef.current !== resetKey) {
    prevResetKeyRef.current = resetKey;
    setLimit(Math.min(totalCount, initialCount));
  }

  // Garante que o limite visível seja imediato assim que os dados chegarem, sem atrasar imagens
  const effectiveLimit = Math.max(limit, Math.min(totalCount, initialCount));

  useIsomorphicLayoutEffect(() => {
    if (railRef.current && railRef.current.scrollLeft !== 0) {
      railRef.current.scrollTo({ left: 0, top: 0, behavior: "instant" });
    }
  }, [railRef, resetKey]);

  const advance = useCallback(
    (extraPx = 0) => {
      const el = railRef.current;
      if (!el) {
        startTransition(() => {
          setLimit((prev) => Math.min(totalCount, prev + 8));
        });
        return;
      }
      const needed = Math.ceil(
        (el.scrollLeft + el.clientWidth * 2.5 + extraPx) / itemStridePx,
      );
      startTransition(() => {
        setLimit((prev) =>
          needed > prev ? Math.min(totalCount, needed) : prev,
        );
      });
    },
    [railRef, totalCount, itemStridePx],
  );

  useEffect(() => {
    if (effectiveLimit >= totalCount) return;
    const el = railRef.current;
    if (!el) return;

    let rafId: number | null = null;
    const onScroll = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        advance(0);
      });
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [railRef, effectiveLimit, totalCount, advance]);

  return { limit: effectiveLimit, advance };
}

function useVerticalBoxImageLimit(
  boxRef: RefObject<HTMLDivElement | null>,
  totalCount: number,
  rowHeightPx: number,
  initialCount: number,
  resetKey?: string,
) {
  const [limit, setLimit] = useState(() =>
    Math.min(totalCount, initialCount),
  );
  const prevResetKeyRef = useRef(resetKey);

  useEffect(() => {
    if (prevResetKeyRef.current !== resetKey) {
      prevResetKeyRef.current = resetKey;
      if (boxRef.current) {
        boxRef.current.scrollTop = 0;
      }
      setLimit(Math.min(totalCount, initialCount));
      return;
    }
    setLimit((prev) =>
      Math.min(totalCount, Math.max(prev, initialCount)),
    );
  }, [boxRef, resetKey, totalCount, initialCount]);

  useEffect(() => {
    if (limit >= totalCount) return;
    const el = boxRef.current;
    if (!el) return;

    let rafId: number | null = null;
    const onScroll = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        const cols = window.innerWidth >= 640 ? 2 : 1;
        const rowsNeeded = Math.ceil(
          (el.scrollTop + el.clientHeight * 2.5) / rowHeightPx,
        );
        const itemsNeeded = rowsNeeded * cols;
        startTransition(() => {
          setLimit((prev) =>
            itemsNeeded > prev ? Math.min(totalCount, itemsNeeded) : prev,
          );
        });
      });
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [boxRef, limit, totalCount, rowHeightPx]);

  return limit;
}

type EpisodeItemData = {
  id: string;
  number: number;
  title: string;
  thumbnail?: string;
  duration?: string;
  videoUrl?: string;
  videoUrl2?: string;
  videoUrl3?: string;
  videoUrl4?: string;
  videoUrl5?: string;
};

const EPISODES_PAGE_SIZE = 60;

const EpisodeGridItem = memo(function EpisodeGridItem({
  ep,
  index: _index,
  animeId,
  watched,
  isSelecting,
  loadImage,
  onSelect,
}: {
  ep: EpisodeItemData;
  index: number;
  animeId: string;
  watched: boolean;
  isSelecting: boolean;
  loadImage: boolean;
  onSelect: (epId: string) => void;
}) {
  const rawThumb = resolveEpisodeThumbnailUrl(ep);
  const imgSrc = rawThumb ? anilistImage(rawThumb, 320) : null;
  const fallbackSrc = getSmallImageFallback(rawThumb, imgSrc);

  return (
    <li className="episode-card-cv">
      <Link
        to="/watch/$id/$ep"
        params={{
          id: animeId,
          ep: `ep-${ep.number}`,
        }}
        preload="intent"
        onClick={() => {
          onSelect(ep.id);
        }}
        className={cn(
          "group relative flex gap-3 rounded-xl border p-2.5 select-none touch-manipulation [-webkit-tap-highlight-color:transparent] [contain:layout_paint_style] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/80",
          "motion-safe:transition-[border-color,background-color,box-shadow] [@media(hover:hover)_and_(pointer:fine)]:motion-safe:transition-[transform,border-color,background-color,box-shadow] motion-safe:duration-200 motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none motion-reduce:transform-none",
          "[@media(hover:hover)_and_(pointer:fine)]:motion-safe:hover:-translate-y-0.5",
          "[@media(hover:hover)_and_(pointer:fine)]:motion-safe:active:scale-[0.982] active:border-purple-400/85 active:bg-[#1c1435]/95 active:ring-1 active:ring-purple-400/45 active:shadow-[0_0_24px_rgba(168,85,247,0.38)]",
          watched
            ? "border-purple-500/30 bg-[#141026]/90 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[#1a1530] [@media(hover:hover)_and_(pointer:fine)]:hover:border-purple-500/50"
            : "border-purple-500/15 bg-[#0f0d18]/90 [@media(hover:hover)_and_(pointer:fine)]:hover:border-purple-500/40 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[#161326]",
          "shadow-[0_2px_12px_rgba(0,0,0,0.3)] [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-[0_4px_20px_rgba(168,85,247,0.15)]",
          isSelecting &&
            "!border-purple-400/85 !bg-[#1c1435]/95 ring-1 ring-purple-400/45 !shadow-[0_0_24px_rgba(168,85,247,0.4)] [@media(hover:hover)_and_(pointer:fine)]:motion-safe:animate-[episodeTapPulse_220ms_cubic-bezier(0.22,1,0.36,1)] motion-reduce:animate-none",
        )}
      >
        {/* Realce luminoso violeta ao selecionar */}
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-r from-purple-500/14 via-fuchsia-500/8 to-transparent opacity-0 transition-opacity duration-150 motion-reduce:transition-none group-active:opacity-100",
            isSelecting && "opacity-100",
          )}
        />

        {/* THUMBNAIL */}
        <div className="relative h-[5rem] w-32 shrink-0 overflow-hidden rounded-lg bg-elevated sm:h-[5.5rem] sm:w-36">
          <HikariImage
            key={imgSrc ?? `ep-thumb-${animeId}-${ep.id}`}
            src={imgSrc}
            fallbackSrc={fallbackSrc}
            loading="lazy"
            decoding="async"
            fetchPriority="low"
            defer={Boolean(imgSrc && !loadImage)}
            alt={ep.title ? `Episódio ${ep.number}: ${ep.title}` : `Episódio ${ep.number}`}
            width={320}
            height={180}
            fallback={
              <div className="size-full flex flex-col items-center justify-center bg-gradient-to-br from-[#1b152d] to-[#0f0d19] text-purple-400/35 select-none">
                <Film className="size-6 stroke-[1.5]" />
                <span className="text-[10px] font-medium tracking-wide mt-1 text-zinc-500">
                  Episódio {ep.number}
                </span>
              </div>
            }
            fallbackClassName="bg-elevated"
            loadedOpacityClass={watched ? "opacity-75" : "opacity-100"}
            className="size-full object-cover [@media(hover:hover)_and_(pointer:fine)]:motion-safe:group-hover:scale-105"
          />

          <div className="absolute inset-0 bg-black/20 transition-colors motion-reduce:transition-none [@media(hover:hover)]:group-hover:bg-black/5" />

          {watched && (
            <div className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full border border-purple-500/40 bg-purple-950/90 text-purple-200 shadow-md">
              <Check className="size-3.5" />
            </div>
          )}
        </div>

        {/* INFORMAÇÕES */}
        <div className="relative z-10 min-w-0 flex-1 py-1">
          <div className="flex items-center justify-between gap-2">
            <p
              className={cn(
                "text-[11px] font-bold tracking-wider text-purple-400 uppercase transition-colors duration-150 motion-reduce:transition-none group-active:text-purple-300",
                isSelecting && "text-purple-300",
              )}
            >
              Episódio {ep.number}
            </p>

            {watched && (
              <span className="shrink-0 rounded bg-purple-950/80 border border-purple-500/30 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-purple-300 uppercase">
                Assistido
              </span>
            )}
          </div>

          <p
            className={cn(
              "mt-1 line-clamp-2 text-sm font-medium leading-snug text-zinc-100 [@media(hover:hover)]:group-hover:text-purple-200 group-active:text-white transition-colors motion-reduce:transition-none",
              isSelecting && "text-white",
            )}
          >
            {ep.title}
          </p>

          {ep.duration && (
            <p className="mt-1.5 text-xs text-zinc-400">
              {ep.duration}
            </p>
          )}
        </div>
      </Link>
    </li>
  );
});

const EpisodeGrid = memo(function EpisodeGrid({
  episodes,
  animeId,
  watchedEpisodes,
}: {
  episodes: EpisodeItemData[];
  animeId: string;
  watchedEpisodes: string[];
}) {
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(EPISODES_PAGE_SIZE);
  const selectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setVisibleCount(EPISODES_PAGE_SIZE);
  }, [animeId]);

  const watchedSet = useMemo(
    () => new Set(watchedEpisodes),
    [watchedEpisodes],
  );

  const displayedEpisodes = useMemo(
    () => episodes.slice(0, visibleCount),
    [episodes, visibleCount],
  );

  const visibleImgLimit = useVerticalBoxImageLimit(
    scrollBoxRef,
    displayedEpisodes.length,
    108,
    6,
    animeId,
  );

  useEffect(() => {
    return () => {
      if (selectTimerRef.current) {
        clearTimeout(selectTimerRef.current);
      }
    };
  }, []);

  const handleEpisodeSelect = useCallback((epId: string) => {
    setSelectingId(epId);
    if (selectTimerRef.current) {
      clearTimeout(selectTimerRef.current);
    }
    selectTimerRef.current = setTimeout(() => {
      setSelectingId((current) => (current === epId ? null : current));
    }, 320);
  }, []);

  const remainingCount = Math.max(0, episodes.length - displayedEpisodes.length);

  return (
    <div key={`episode-grid-${animeId}`} className="space-y-3">
      <div
        ref={scrollBoxRef}
        className="max-h-[28rem] overflow-y-auto overscroll-contain rounded-xl pr-1 touch-pan-y sm:max-h-[34rem]"
      >
        <ol className="grid gap-3 p-0.5 sm:grid-cols-2">
          {displayedEpisodes.map((ep, index) => (
            <EpisodeGridItem
              key={`${animeId}-${ep.id}-${ep.number}`}
              ep={ep}
              index={index}
              animeId={animeId}
              watched={watchedSet.has(ep.id)}
              isSelecting={selectingId === ep.id}
              loadImage={index < visibleImgLimit}
              onSelect={handleEpisodeSelect}
            />
          ))}
        </ol>
      </div>
      {remainingCount > 0 && (
        <button
          type="button"
          onClick={() =>
            setVisibleCount((prev) =>
              Math.min(episodes.length, prev + EPISODES_PAGE_SIZE),
            )
          }
          className="w-full rounded-xl border border-purple-500/30 bg-surface/80 py-2.5 text-center text-xs font-bold uppercase tracking-wider text-purple-300 transition-colors hover:bg-elevated hover:text-white cursor-pointer"
        >
          Carregar mais ({Math.min(EPISODES_PAGE_SIZE, remainingCount)} de {remainingCount} restantes)
        </button>
      )}
    </div>
  );
});

const InformacoesAdicionaisSection = memo(function InformacoesAdicionaisSection({
  anime,
}: {
  anime: Anime;
}) {
  const [expanded, setExpanded] = useState(false);

  const {
    mainRows,
    romajiTitle,
    englishTitle,
    synonyms,
    tags,
    hasSecondary,
  } = useMemo(() => {
    // Não repetimos informações do cabeçalho (formato, status, número de episódios, nota, ano, gêneros)
    // E removemos expressamente "País de origem: Japão"
    // Não duplicamos estúdios ou diretores (que já possuem sua seção própria)
    const startDate = formatDateLabel(anime.startDate);
    const endDate = formatDateLabel(anime.endDate);
    const season = seasonLabel(anime.season, anime.year);
    const duration = anime.duration ? `${anime.duration} min. por episódio` : "";
    const source = sourceLabel(anime.originSource);
    const rating = ratingLabel(
      anime.rating,
      (anime as unknown as { isAdult?: boolean }).isAdult ||
        Boolean(anime.rating?.includes("18+")),
    );
    const broadcast = anime.broadcast ?? "";
    const producers = (anime.producers ?? []).filter(Boolean);
    const licensors = (anime.licensors ?? []).filter(Boolean);

    const rTitle = anime.titles?.romaji;
    const eTitle =
      anime.titles?.english && anime.titles?.english !== rTitle
        ? anime.titles.english
        : "";
    const syns = (anime.synonyms ?? []).filter(
      (s) => s !== rTitle && s !== eTitle,
    );
    const animeTags = anime.tags ?? [];

    const rows = [
      { label: "Estreia completa", value: startDate },
      { label: "Término da exibição", value: endDate },
      { label: "Temporada de lançamento", value: season },
      { label: "Duração média", value: duration },
      { label: "Obra original", value: source },
      { label: "Classificação indicativa", value: rating },
      { label: "Transmissão", value: broadcast },
      { label: "Produtores", value: producers.join(", ") },
      { label: "Licenciadores", value: licensors.join(", ") },
    ].filter((item) => Boolean(item.value));

    const secondary =
      Boolean(rTitle) ||
      Boolean(eTitle) ||
      syns.length > 0 ||
      animeTags.length > 0;

    return {
      mainRows: rows,
      romajiTitle: rTitle,
      englishTitle: eTitle,
      synonyms: syns,
      tags: animeTags,
      hasSecondary: secondary,
    };
  }, [anime]);

  if (mainRows.length === 0 && !hasSecondary) {
    return null;
  }

  return (
    <section className="mt-12 max-w-4xl">
      <div className="flex items-center gap-2.5">
        <span className="h-6 w-1 rounded-full bg-purple-500" />
        <h2 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Informações adicionais
        </h2>
      </div>

      <div className="mt-4 rounded-2xl border border-purple-500/15 bg-gradient-to-b from-[#131024]/70 to-[#0e0c18]/90 p-4 sm:p-6 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 sm:gap-y-3.5">
          {mainRows.map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between border-b border-purple-500/10 pb-2.5 sm:pb-3"
            >
              <span className="text-[11px] sm:text-xs font-semibold text-purple-300/80 uppercase tracking-wider">
                {row.label}
              </span>
              <span className="text-xs sm:text-sm font-semibold text-zinc-100 text-right">
                {row.value}
              </span>
            </div>
          ))}
        </div>

        {hasSecondary && expanded && (
          <div className="mt-4 space-y-3 border-t border-purple-500/15 pt-4">
            {romajiTitle && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 border-b border-purple-500/10 pb-2.5">
                <span className="text-[11px] sm:text-xs font-semibold text-purple-300/80 uppercase tracking-wider">
                  Título Romaji
                </span>
                <span className="text-xs sm:text-sm font-semibold text-zinc-200">
                  {romajiTitle}
                </span>
              </div>
            )}
            {englishTitle && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 border-b border-purple-500/10 pb-2.5">
                <span className="text-[11px] sm:text-xs font-semibold text-purple-300/80 uppercase tracking-wider">
                  Título em Inglês
                </span>
                <span className="text-xs sm:text-sm font-semibold text-zinc-200">
                  {englishTitle}
                </span>
              </div>
            )}
            {synonyms.length > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1.5 border-b border-purple-500/10 pb-2.5">
                <span className="text-[11px] sm:text-xs font-semibold text-purple-300/80 uppercase tracking-wider shrink-0">
                  Sinônimos
                </span>
                <span className="text-xs sm:text-sm text-zinc-300 sm:text-right">
                  {synonyms.slice(0, 5).join(" • ")}
                </span>
              </div>
            )}
            {tags.length > 0 && (
              <div className="pt-1">
                <span className="text-[11px] sm:text-xs font-semibold text-purple-300/80 uppercase tracking-wider block mb-2">
                  Temas e Tags
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {tags.slice(0, 10).map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center rounded-md border border-purple-500/20 bg-purple-950/30 px-2 py-0.5 text-[11px] font-medium text-purple-200"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {hasSecondary && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="mt-4 inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-purple-400 hover:text-purple-300 transition-colors cursor-pointer"
          >
            <span>
              {expanded ? "Mostrar menos detalhes" : "Mais detalhes da ficha"}
            </span>
            <ChevronDown
              className={cn(
                "size-3.5 transition-transform duration-200",
                expanded && "rotate-180",
              )}
            />
          </button>
        )}
      </div>
    </section>
  );
});

const INITIAL_GALLERY_LIMIT = 6;

const ImagensSection = memo(function ImagensSection({
  animeId,
  images,
  title,
  bannerUrl,
  coverUrl,
  malId,
}: {
  animeId: string;
  images?: string[];
  title: string;
  bannerUrl?: string;
  coverUrl?: string;
  malId?: number | null;
}) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showAllImages, setShowAllImages] = useState(false);
  const [extraPictures, setExtraPictures] = useState<string[]>(() => {
    return malId ? clientPicturesCache.get(malId) ?? [] : [];
  });
  const railRef = useRef<HTMLDivElement>(null);

  // Busca em segundo plano na API Jikan (MyAnimeList) caso o anime possua poucas imagens carregadas
  useEffect(() => {
    if (!malId || (!showAllImages && images && images.length >= INITIAL_GALLERY_LIMIT)) return;

    const cached = clientPicturesCache.get(malId);
    if (cached && cached.length > 0) {
      setExtraPictures(cached);
      return;
    }

    if (clientPicturesInFlight.has(malId)) return;
    clientPicturesInFlight.add(malId);

    let isMounted = true;

    fetchAnimePictures({ data: { malId } })
      .then((pics) => {
        if (isMounted && Array.isArray(pics) && pics.length > 0) {
          setCappedClientMap(clientPicturesCache, malId, pics);
          startTransition(() => {
            setExtraPictures(pics);
          });
        }
      })
      .catch(() => {
        // Silencioso: não impacta a experiência visual do usuário
      })
      .finally(() => {
        clientPicturesInFlight.delete(malId);
      });

    return () => {
      isMounted = false;
    };
  }, [malId, images, showAllImages]);

  const validImages = useMemo(() => {
    const raw = [...(images ?? []), ...extraPictures];
    const set = new Set<string>();
    const result: string[] = [];

    const norm = (url: string) =>
      url.replace(/^https?:\/\//i, "").split("?")[0].toLowerCase().trim();

    const bannerNorm = bannerUrl ? norm(bannerUrl) : "";
    const coverNorm = coverUrl ? norm(coverUrl) : "";

    for (const url of raw) {
      if (typeof url === "string" && url.trim().length > 0) {
        const clean = url.trim();
        const key = norm(clean);

        // Não exibe a capa principal nem o banner da obra na galeria, nem duplicatas
        if (
          !set.has(key) &&
          key !== bannerNorm &&
          key !== coverNorm
        ) {
          set.add(key);
          result.push(clean);
        }
      }
    }
    return result;
  }, [images, extraPictures, bannerUrl, coverUrl]);

  const displayedImages = useMemo(
    () =>
      showAllImages
        ? validImages
        : validImages.slice(0, INITIAL_GALLERY_LIMIT),
    [validImages, showAllImages],
  );

  const hasHiddenImages = validImages.length > INITIAL_GALLERY_LIMIT;

  const { limit: visibleImgLimit, advance: advanceImgLimit } =
    useHorizontalRailImageLimit(
      railRef,
      displayedImages.length,
      158,
      INITIAL_GALLERY_LIMIT,
      `${animeId}-${showAllImages ? "all" : "preview"}`,
    );

  const closeModal = useCallback(() => {
    setSelectedImage((current) => {
      if (current && window.history.state?.hikariGalleryModal) {
        window.history.back();
      }
      return null;
    });
  }, []);

  useScrollLock(Boolean(selectedImage));

  useEffect(() => {
    if (!selectedImage) return;

    // Suporte ao botão voltar nativo do celular
    window.history.pushState({ hikariGalleryModal: true }, "");

    const handlePopState = () => {
      setSelectedImage(null);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeModal();
      }
    };

    window.addEventListener("popstate", handlePopState);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedImage, closeModal]);

  if (validImages.length === 0) {
    return null;
  }

  const scroll = (direction: "left" | "right") => {
    if (!railRef.current) return;
    if (direction === "right") {
      advanceImgLimit(360);
    }
    const offset = direction === "left" ? -320 : 320;
    railRef.current.scrollBy({ left: offset, behavior: "smooth" });
  };

  return (
    <section className="mt-12 space-y-4">
      <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="h-6 w-1 rounded-full bg-purple-500" />
            <h2 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Imagens
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {hasHiddenImages && (
              <button
                type="button"
                onClick={() => setShowAllImages((prev) => !prev)}
                aria-expanded={showAllImages}
                className="inline-flex items-center gap-1.5 rounded-lg border border-purple-500/30 bg-[#0f0d18] px-3 py-1.5 text-xs font-semibold text-purple-200 [@media(hover:hover)]:hover:border-purple-400/60 [@media(hover:hover)]:hover:bg-[#19142b] transition-[color,background-color,border-color] cursor-pointer"
              >
                {showAllImages
                  ? "Mostrar menos"
                  : `Ver todas (${validImages.length})`}
              </button>
            )}

            {displayedImages.length > 2 && (
              <div className="hidden sm:flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => scroll("left")}
                  aria-label="Rolar imagens para a esquerda"
                  className="flex size-8 items-center justify-center rounded-lg border border-purple-500/20 bg-[#0f0d18] text-purple-300 [@media(hover:hover)]:hover:border-purple-500/50 [@media(hover:hover)]:hover:bg-[#19142b] transition-[color,background-color,border-color] cursor-pointer"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => scroll("right")}
                  aria-label="Rolar imagens para a direita"
                  className="flex size-8 items-center justify-center rounded-lg border border-purple-500/20 bg-[#0f0d18] text-purple-300 [@media(hover:hover)]:hover:border-purple-500/50 [@media(hover:hover)]:hover:bg-[#19142b] transition-[color,background-color,border-color] cursor-pointer"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        <div
          ref={railRef}
          className="rail -mx-4 flex gap-3.5 overflow-x-auto px-4 sm:-mx-6 sm:px-6 pb-2"
        >
          {displayedImages.map((imgUrl, idx) => {
            const gallerySrc = anilistImage(imgUrl, 400);
            return (
              <button
                key={`${imgUrl}-${idx}`}
                type="button"
                onClick={() => setSelectedImage(imgUrl)}
                className="group relative h-52 sm:h-60 w-36 sm:w-44 shrink-0 overflow-hidden rounded-2xl border border-purple-500/20 bg-[#0e0c1a] shadow-md [contain:layout_paint_style] motion-safe:transition-[transform,border-color,box-shadow] motion-safe:duration-300 [@media(hover:hover)]:hover:-translate-y-1 [@media(hover:hover)]:hover:border-purple-500/60 [@media(hover:hover)]:hover:shadow-[0_8px_30px_rgba(168,85,247,0.25)] cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 p-2 flex flex-col items-center justify-center"
              >
                <div className="relative size-full flex items-center justify-center overflow-hidden rounded-xl bg-[#07060d]">
                  <HikariImage
                    src={gallerySrc}
                    fallbackSrc={getSmallImageFallback(imgUrl, gallerySrc)}
                    width={400}
                    loading="lazy"
                    decoding="async"
                    fetchPriority="low"
                    defer={showAllImages && idx >= visibleImgLimit}
                    alt={`Arte promocional de ${title} (${idx + 1})`}
                    fallbackClassName="bg-[#07060d]"
                    className="size-full object-contain [@media(hover:hover)]:group-hover:scale-105"
                  />
                </div>
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-black/85 via-transparent to-transparent opacity-0 [@media(hover:hover)]:group-hover:opacity-100 transition-opacity flex items-end p-2.5 pointer-events-none">
                  <span className="text-[11px] font-semibold text-purple-200 [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]">
                    Ampliar arte
                  </span>
                </div>
              </button>
            );
          })}
      </div>

      {selectedImage && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Visualização de imagem de ${title}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 md:bg-black/75 md:backdrop-blur-md p-3 sm:p-6 animate-in fade-in duration-200"
          onClick={closeModal}
        >
          {/* Botão fechar proeminente */}
          <button
            type="button"
            onClick={closeModal}
            aria-label="Fechar visualização de imagem"
            className="absolute right-3.5 top-3.5 sm:right-6 sm:top-6 z-10 flex size-10 sm:size-11 items-center justify-center rounded-full bg-[#18132d]/90 text-zinc-200 hover:text-white hover:bg-purple-600 transition-[color,background-color] cursor-pointer border border-purple-500/30 shadow-lg"
          >
            <X className="size-5 sm:size-6" />
          </button>

          {/* Imagem inteira: object-contain, sem cortes, proporção original intacta */}
          <div
            className="relative flex min-h-[220px] min-w-[180px] items-center justify-center overflow-hidden rounded-xl border border-purple-500/20 bg-[#090812] shadow-[0_20px_60px_rgba(0,0,0,0.85)] max-h-[88vh] max-w-[92vw] select-none"
            onClick={(e) => e.stopPropagation()}
          >
            <HikariImage
              src={anilistImage(selectedImage, 1200)}
              alt={`Visualização completa de ${title}`}
              loading="eager"
              decoding="async"
              fallbackClassName="bg-[#090812]"
              className="max-h-[88vh] max-w-[92vw] w-auto h-auto object-contain"
            />
          </div>
        </div>
      )}
    </section>
  );
});

const ElencoSection = memo(function ElencoSection({
  animeId,
  characters,
  isMobile,
}: {
  animeId: string;
  characters?: AnimeCharacter[];
  isMobile?: boolean;
}) {
  const railRef = useRef<HTMLDivElement>(null);

  const validCharacters = useMemo(() => {
    return (characters ?? []).filter((c) =>
      Boolean(c?.name?.full?.trim() || c?.name?.native?.trim()),
    );
  }, [characters]);

  const {
    renderedLimit,
    imageLimit: visibleImgLimit,
    advance: advanceImgLimit,
  } = useProgressiveRail({
    railRef,
    totalCount: validCharacters.length,
    itemStridePx: 128,
    initialRenderCount: 10,
    isMobile,
    resetKey: animeId,
  });

  if (validCharacters.length === 0) {
    return null;
  }

  const scroll = (direction: "left" | "right") => {
    if (!railRef.current) return;
    if (direction === "right") {
      advanceImgLimit(360);
    }
    const offset = direction === "left" ? -320 : 320;
    railRef.current.scrollBy({ left: offset, behavior: "smooth" });
  };

  return (
    <section className="mt-12 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <span className="h-6 w-1 rounded-full bg-purple-500" />
          <h2 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Personagens
          </h2>
        </div>

        {validCharacters.length > 3 && (
          <div className="hidden sm:flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => scroll("left")}
              aria-label="Rolar personagens para a esquerda"
              className="flex size-8 items-center justify-center rounded-lg border border-purple-500/20 bg-[#0f0d18] text-purple-300 [@media(hover:hover)]:hover:border-purple-500/50 [@media(hover:hover)]:hover:bg-[#19142b] transition-[color,background-color,border-color] cursor-pointer"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => scroll("right")}
              aria-label="Rolar personagens para a direita"
              className="flex size-8 items-center justify-center rounded-lg border border-purple-500/20 bg-[#0f0d18] text-purple-300 [@media(hover:hover)]:hover:border-purple-500/50 [@media(hover:hover)]:hover:bg-[#19142b] transition-[color,background-color,border-color] cursor-pointer"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        )}
      </div>

      <div
        ref={railRef}
        className="rail -mx-4 flex gap-2.5 sm:gap-3 overflow-x-auto px-4 sm:-mx-6 sm:px-6 pb-2"
      >
        {validCharacters.slice(0, renderedLimit).map((char, index) => (
          <ElencoCard
            key={`${char.id || char.name.full || char.name.native}-${index}`}
            char={char}
            loadImage={index < visibleImgLimit}
          />
        ))}
      </div>
    </section>
  );
});

const ElencoCard = memo(function ElencoCard({
  char,
  loadImage,
}: {
  char: AnimeCharacter;
  loadImage: boolean;
}) {
  const { isEntityFavorited, toggleEntityFavorite } = useFavoritesEntity();

  const charName = char.name?.full?.trim() || char.name?.native?.trim() || "";
  const isMain = (char.role ?? "").toUpperCase() === "MAIN";
  const roleLabel = isMain ? "Protagonista" : "Secundário";

  const charTargetId = char.id ? String(char.id) : charName;
  const isFav = isEntityFavorited("character", charTargetId, charName);

  const handleToggleFav = useCallback(async () => {
    await toggleEntityFavorite({
      targetType: "character",
      targetId: charTargetId,
      name: charName,
      characterSnapshot: {
        name: charName,
        nativeName: char.name?.native ?? null,
        imageUrl: char.image ?? null,
        role: roleLabel,
      },
    });
  }, [toggleEntityFavorite, charTargetId, charName, char.name?.native, char.image, roleLabel]);

  return (
    <div className="group relative flex w-[110px] sm:w-[126px] md:w-[136px] shrink-0 flex-col overflow-hidden rounded-xl border border-purple-500/15 bg-[#100e1b] shadow-sm [contain:layout_paint_style] motion-safe:transition-[transform,border-color,box-shadow] motion-safe:duration-300 [@media(hover:hover)]:hover:-translate-y-1 [@media(hover:hover)]:hover:border-purple-500/45 [@media(hover:hover)]:hover:shadow-[0_8px_24px_rgba(168,85,247,0.2)]">
      {/* Imagem retangular do personagem (elemento visual principal, nunca circular) */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-[#0d0c16]">
        <HikariImage
          src={anilistImage(char.image, 160)}
          width={160}
          height={213}
          loading="lazy"
          decoding="async"
          fetchPriority="low"
          defer={Boolean(char.image && !loadImage)}
          alt={charName}
          fallbackClassName="bg-[#0d0c16]"
          className="size-full object-cover object-top [@media(hover:hover)]:group-hover:scale-105"
        />

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#100e1b] via-transparent to-black/20 opacity-60" />

        {/* Botão de Favorito com animação padronizada */}
        <CardFavoriteButton
          isFavorite={isFav}
          onToggle={handleToggleFav}
          ariaLabel={
            isFav
              ? `Remover ${charName} dos favoritos`
              : `Adicionar ${charName} aos favoritos`
          }
        />

        {/* Linha discreta para a função (Principal / Secundário) protegida contra overflow */}
        <span
          className={cn(
            "absolute bottom-1.5 left-1.5 max-w-[calc(100%-12px)] truncate rounded px-1.5 py-0.5 text-[8px] sm:text-[8.5px] font-semibold tracking-wider uppercase shadow-sm border",
            isMain
              ? "bg-purple-950/92 text-purple-200 border-purple-500/40"
              : "bg-zinc-950/90 text-zinc-300 border-white/10",
          )}
        >
          {roleLabel}
        </span>
      </div>

      {/* Textos abaixo da imagem protegidos com min-w-0 e flexbox */}
      <div className="flex flex-1 flex-col justify-between p-2 sm:p-2.5 min-w-0">
        {/* Nome do personagem */}
        <p
          title={charName}
          className="line-clamp-2 font-display text-[11px] sm:text-xs font-bold text-zinc-100 transition-colors [@media(hover:hover)]:group-hover:text-purple-300 min-w-0 break-words leading-snug"
        >
          {charName}
        </p>
      </div>
    </div>
  );
});

function categorizeLanguage(lang?: string): "ja" | "pt" | "other" {
  if (!lang) return "ja";
  const l = lang.toLowerCase();
  if (
    l.includes("brazil") ||
    l.includes("portuguese") ||
    l.includes("pt-br") ||
    l.includes("pt_br")
  ) {
    return "pt";
  }
  if (l.includes("japan") || l === "ja" || l === "ja_jp") {
    return "ja";
  }
  return "other";
}

function formatVoiceActorLanguage(lang?: string): string {
  if (!lang) return "Japonês";
  const l = lang.toLowerCase().trim();
  if (
    l.includes("brazil") ||
    l.includes("pt-br") ||
    l.includes("pt_br") ||
    l === "portuguese (brazil)"
  ) {
    return "Português (BR)";
  }
  if (l.includes("portuguese")) {
    return "Português";
  }
  if (l.includes("japan") || l === "ja" || l === "ja_jp") {
    return "Japonês";
  }
  if (l.includes("english") || l === "en" || l === "en_us") {
    return "Inglês";
  }
  if (l.includes("spanish") || l === "es") {
    return "Espanhol";
  }
  if (l.includes("korean") || l === "ko") {
    return "Coreano";
  }
  if (l.includes("french") || l === "fr") {
    return "Francês";
  }
  if (l.includes("german") || l === "de") {
    return "Alemão";
  }
  if (l.includes("italian") || l === "it") {
    return "Italiano";
  }
  return lang;
}

type DubladorItem = {
  id: string;
  vaId: number;
  vaName: string;
  vaImage?: string;
  rawLanguage: string;
  language: string;
  langCategory: "ja" | "pt" | "en" | "other";
  characterId: number;
  characterName: string;
  isMain: boolean;
};

const DubladoresSection = memo(function DubladoresSection({
  animeId,
  characters,
  isMobile,
}: {
  animeId: string;
  characters?: AnimeCharacter[];
  isMobile?: boolean;
}) {
  const navigate = useNavigate();
  const [selectedLang, setSelectedLang] = useState<"ja" | "pt">("ja");
  const [expandedEntity, setExpandedEntity] = useState<SelectedEntityTarget | null>(null);
  const railRef = useRef<HTMLDivElement>(null);

  const validCharacters = useMemo(() => {
    return (characters ?? []).filter((c) =>
      Boolean(c?.name?.full?.trim() || c?.name?.native?.trim()),
    );
  }, [characters]);

  const allVoiceActors = useMemo(() => {
    const map = new Map<string, {
      vaId?: number;
      vaName: string;
      vaImage?: string;
      rawLanguage: string;
      language: string;
      langCategory: "pt" | "ja" | "en" | "other";
      characters: Set<string>;
      isMain: boolean;
    }>();

    for (const char of validCharacters) {
      const charName =
        char.name?.full?.trim() || char.name?.native?.trim() || "";
      const isMain = (char.role ?? "").toUpperCase() === "MAIN";

      for (const va of char.voiceActors ?? []) {
        const vaName =
          va?.name?.full?.trim() || va?.name?.native?.trim() || "";
        if (!vaName) continue;

        const rawLang = va.language?.trim() || "Japanese";
        const langCat = categorizeLanguage(rawLang);
        const key = `${va.id ? String(va.id) : vaName.trim().toLowerCase()}::${langCat}`;
        if (!map.has(key)) {
          map.set(key, {
            vaId: va.id,
            vaName,
            vaImage: va.image,
            rawLanguage: rawLang,
            language: formatVoiceActorLanguage(rawLang),
            langCategory: langCat,
            characters: new Set(),
            isMain: false,
          });
        }
        const entry = map.get(key)!;
        if (charName) entry.characters.add(charName);
        if (isMain) entry.isMain = true;
        if (!entry.vaImage && va.image) entry.vaImage = va.image;
      }
    }

    return Array.from(map.values())
      .map((item, idx) => ({
        id: `${item.vaId || item.vaName}-${idx}`,
        vaId: item.vaId ?? 0,
        vaName: item.vaName,
        vaImage: item.vaImage,
        rawLanguage: item.rawLanguage,
        language: item.language,
        langCategory: item.langCategory,
        characterName: Array.from(item.characters).join(" · "),
        characterId: 0,
        isMain: item.isMain,
      }))
      .sort((a, b) => {
        if (a.isMain && !b.isMain) return -1;
        if (!a.isMain && b.isMain) return 1;
        return 0;
      });
  }, [validCharacters]);

  const hasPortuguese = useMemo(() => {
    return allVoiceActors.some((item) => item.langCategory === "pt");
  }, [allVoiceActors]);

  const activeLang: "ja" | "pt" = hasPortuguese ? selectedLang : "ja";

  const displayVoiceActors = useMemo(() => {
    if (hasPortuguese) {
      const filtered = allVoiceActors.filter(
        (item) => item.langCategory === activeLang,
      );
      return filtered.length > 0 ? filtered : allVoiceActors;
    }
    const japanese = allVoiceActors.filter(
      (item) => item.langCategory === "ja",
    );
    return japanese.length > 0 ? japanese : allVoiceActors;
  }, [allVoiceActors, hasPortuguese, activeLang]);

  const {
    renderedLimit,
    imageLimit: visibleImgLimit,
    advance: advanceImgLimit,
  } = useProgressiveRail({
    railRef,
    totalCount: displayVoiceActors.length,
    itemStridePx: 128,
    initialRenderCount: 10,
    isMobile,
    resetKey: `${animeId}-vas-${activeLang}`,
  });

  const handleSelectActor = useCallback(
    (item: DubladorItem) => {
      void navigate({
        to: "/anime/$id",
        params: { id: animeId },
        search: (prev: Record<string, unknown>) => ({
          ...prev,
          dublador: item.vaName,
          ...(item.vaId ? { dubladorId: String(item.vaId) } : {}),
        }),
      });
    },
    [navigate, animeId],
  );

  if (displayVoiceActors.length === 0) {
    return null;
  }

  const scroll = (direction: "left" | "right") => {
    if (!railRef.current) return;
    if (direction === "right") {
      advanceImgLimit(360);
    }
    const offset = direction === "left" ? -320 : 320;
    railRef.current.scrollBy({ left: offset, behavior: "smooth" });
  };

  if (expandedEntity) {
    return (
      <section className="mt-12 space-y-4">
        <Suspense fallback={null}>
          <EntityWorksExpansion
            entity={expandedEntity}
            onClear={() => setExpandedEntity(null)}
            accentColor="pink"
          />
        </Suspense>
      </section>
    );
  }

  return (
    <section className="mt-12 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <span className="h-6 w-1 rounded-full bg-purple-500" />
              <h2 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Dubladores
              </h2>
            </div>

            <div className="flex items-center gap-3 self-start sm:self-auto">
              {hasPortuguese ? (
                <div className="inline-flex items-center rounded-xl border border-purple-500/25 bg-[#0f0d18] p-1 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setSelectedLang("ja")}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-[color,background-color,border-color] cursor-pointer",
                      activeLang === "ja"
                        ? "bg-purple-950/90 text-purple-200 border border-purple-500/40 shadow-sm"
                        : "text-zinc-400 hover:text-zinc-200",
                    )}
                  >
                    <span className="size-1.5 rounded-full bg-purple-400" />
                    <span>Japonês</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedLang("pt")}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-[color,background-color,border-color] cursor-pointer",
                      activeLang === "pt"
                        ? "bg-purple-950/90 text-purple-200 border border-purple-500/40 shadow-sm"
                        : "text-zinc-400 hover:text-zinc-200",
                    )}
                  >
                    <span className="size-1.5 rounded-full bg-emerald-400" />
                    <span>Português (BR)</span>
                  </button>
                </div>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-purple-500/20 bg-purple-950/30 px-2.5 py-1 text-[11px] font-medium text-purple-300">
                  <span className="size-1.5 rounded-full bg-purple-400" />
                  Dublagem original (Japonês)
                </span>
              )}

              {displayVoiceActors.length > 3 && (
                <div className="hidden sm:flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => scroll("left")}
                    aria-label="Rolar dubladores para a esquerda"
                    className="flex size-8 items-center justify-center rounded-lg border border-purple-500/20 bg-[#0f0d18] text-purple-300 [@media(hover:hover)]:hover:border-purple-500/50 [@media(hover:hover)]:hover:bg-[#19142b] transition-[color,background-color,border-color] cursor-pointer"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => scroll("right")}
                    aria-label="Rolar dubladores para a direita"
                    className="flex size-8 items-center justify-center rounded-lg border border-purple-500/20 bg-[#0f0d18] text-purple-300 [@media(hover:hover)]:hover:border-purple-500/50 [@media(hover:hover)]:hover:bg-[#19142b] transition-[color,background-color,border-color] cursor-pointer"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div
            ref={railRef}
            className="rail -mx-4 flex gap-2.5 sm:gap-3 overflow-x-auto px-4 sm:-mx-6 sm:px-6 pb-2"
          >
            {displayVoiceActors.slice(0, renderedLimit).map((item, index) => (
              <DubladorCard
                key={item.id}
                item={item}
                loadImage={index < visibleImgLimit}
                isSelected={false}
                onSelect={handleSelectActor}
              />
            ))}
          </div>
    </section>
  );
});

const DubladorCard = memo(function DubladorCard({
  item,
  loadImage,
  isSelected,
  onSelect,
}: {
  item: DubladorItem;
  loadImage: boolean;
  isSelected?: boolean;
  onSelect?: (item: DubladorItem) => void;
}) {
  const { isEntityFavorited, toggleEntityFavorite } = useFavoritesEntity();

  const vaTargetId = item.vaId ? String(item.vaId) : item.vaName;
  const isFav = isEntityFavorited("person", vaTargetId, item.vaName);

  const handleToggleFav = useCallback(async () => {
    await toggleEntityFavorite({
      targetType: "person",
      targetId: vaTargetId,
      name: item.vaName,
      personSnapshot: {
        name: item.vaName,
        imageUrl: item.vaImage ?? null,
        biography: item.characterName
          ? `Dublador(a) como ${item.characterName} (${item.language})`
          : `Dublador(a) (${item.language})`,
      },
    });
  }, [toggleEntityFavorite, vaTargetId, item.vaName, item.vaImage, item.characterName, item.language]);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect?.(item)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect?.(item);
        }
      }}
      className={cn(
        "group relative flex w-[110px] sm:w-[126px] md:w-[136px] shrink-0 flex-col overflow-hidden rounded-xl border border-purple-500/15 bg-[#100e1b] shadow-sm [contain:layout_paint_style] motion-safe:transition-[transform,border-color,box-shadow,background-color] motion-safe:duration-300 [@media(hover:hover)]:hover:-translate-y-1 [@media(hover:hover)]:hover:border-purple-500/45 [@media(hover:hover)]:hover:shadow-[0_8px_24px_rgba(168,85,247,0.2)] cursor-pointer text-left select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400",
        isSelected &&
          "border-purple-500/80 ring-2 ring-purple-500/90 shadow-[0_0_20px_rgba(168,85,247,0.35)] bg-[#141026]",
      )}
    >
      {/* Imagem retangular do dublador (foto real da pessoa) */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-[#0d0c16]">
        <HikariImage
          src={anilistImage(item.vaImage, 160)}
          width={160}
          height={213}
          loading="lazy"
          decoding="async"
          fetchPriority="low"
          defer={Boolean(item.vaImage && !loadImage)}
          alt={item.vaName}
          fallbackClassName="bg-[#0d0c16]"
          className="size-full object-cover object-top [@media(hover:hover)]:group-hover:scale-105"
        />

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#100e1b] via-transparent to-black/20 opacity-60" />

        {/* Botão de Favorito com animação padronizada (não propaga clique de seleção) */}
        <div onClick={(e) => e.stopPropagation()}>
          <CardFavoriteButton
            isFavorite={isFav}
            onToggle={handleToggleFav}
            ariaLabel={
              isFav
                ? `Remover ${item.vaName} dos favoritos`
                : `Adicionar ${item.vaName} aos favoritos`
            }
          />
        </div>

        {/* Badge do idioma da dublagem */}
        {item.language && (
          <span
            className={cn(
              "absolute bottom-1.5 left-1.5 max-w-[calc(100%-12px)] truncate rounded px-1.5 py-0.5 text-[8px] sm:text-[8.5px] font-semibold tracking-wider uppercase shadow-sm border",
              item.langCategory === "pt"
                ? "bg-emerald-950/92 text-emerald-200 border-emerald-500/40"
                : "bg-zinc-950/90 text-zinc-300 border-white/10",
            )}
          >
            {item.language}
          </span>
        )}
      </div>

      {/* Textos abaixo da imagem: nome do dublador e associação com o personagem */}
      <div className="flex flex-1 flex-col justify-between p-2 sm:p-2.5 min-w-0">
        <p
          title={item.vaName}
          className="line-clamp-2 font-display text-[11px] sm:text-xs font-bold text-zinc-100 transition-colors [@media(hover:hover)]:group-hover:text-purple-300 min-w-0 break-words leading-snug"
        >
          {item.vaName}
        </p>

        {item.characterName && (
          <div className="mt-1.5 min-w-0">
            <p
              title={`Dubla ${item.characterName}`}
              className="truncate text-[9.5px] sm:text-[10px] text-zinc-400 min-w-0"
            >
              <span className="text-zinc-500">como </span>
              <span className="font-medium text-purple-300/90">
                {item.characterName}
              </span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
});

function getStaffRoleWeight(role: string): number {
  const r = role.toLowerCase();
  if (
    r === "director" ||
    r.startsWith("director") ||
    r.includes("series director")
  )
    return 1;
  if (r.includes("original creator") || r.includes("creator")) return 2;
  if (r.includes("series composition")) return 3;
  if (
    r.includes("script") ||
    r.includes("screenplay") ||
    r.includes("writer")
  )
    return 4;
  if (r.includes("character design")) return 5;
  if (r.includes("music") || r.includes("composer")) return 6;
  if (r.includes("sound director")) return 7;
  if (r.includes("art director")) return 8;
  if (r.includes("chief animation director")) return 9;
  if (r.includes("animation director")) return 10;
  if (r.includes("producer")) return 11;
  return 20;
}

const DirecaoEquipeSection = memo(function DirecaoEquipeSection({
  animeId,
  studios,
  staff,
  isMobile,
}: {
  animeId: string;
  studios: string[];
  staff?: AnimeStaff[];
  isMobile?: boolean;
}) {
  const navigate = useNavigate();
  const [expandedEntity, setExpandedEntity] = useState<SelectedEntityTarget | null>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const [resolveStudioLogo, setResolveStudioLogo] = useState<
    ((name: string) => string | undefined) | null
  >(null);

  useEffect(() => {
    if (!studios?.length) return;
    let cancelled = false;
    void import("@/lib/studio-logos").then((mod) => {
      if (!cancelled) {
        setResolveStudioLogo(() => mod.getStudioLogo);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [studios]);

  const validStaff = useMemo(() => {
    const map = new Map<string, { id?: number; name: string; roles: Set<string>; image?: string }>();
    for (const s of staff ?? []) {
      const name = s?.name?.trim();
      if (!name) continue;
      const key = s.id ? String(s.id) : name.toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          id: s.id,
          name,
          roles: new Set(),
          image: s.image,
        });
      }
      const entry = map.get(key)!;
      const roleLabel = s.role?.trim() ? staffRoleLabel(s.role) : "Equipe técnica";
      if (roleLabel) entry.roles.add(roleLabel);
      if (!entry.image && s.image) entry.image = s.image;
    }

    return Array.from(map.values())
      .map((s) => ({
        id: s.id,
        name: s.name,
        role: Array.from(s.roles).join(" · ") || "Equipe técnica",
        image: s.image,
      }))
      .sort((a, b) => getStaffRoleWeight(a.role) - getStaffRoleWeight(b.role));
  }, [staff]);

  const studioItems = useMemo(() => {
    const seen = new Set<string>();
    const out: {
      id: string;
      name: string;
      role: string;
      isStudio: boolean;
      image?: string;
    }[] = [];

    for (const rawName of studios ?? []) {
      const name = rawName?.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        id: name,
        name,
        role: "Estúdio de animação",
        isStudio: true,
        image: resolveStudioLogo ? resolveStudioLogo(name) : undefined,
      });
    }
    return out;
  }, [studios, resolveStudioLogo]);

  const allItems = useMemo(() => {
    return [...studioItems, ...validStaff];
  }, [studioItems, validStaff]);

  const {
    renderedLimit,
    imageLimit: visibleImgLimit,
    advance: advanceImgLimit,
  } = useProgressiveRail({
    railRef,
    totalCount: allItems.length,
    itemStridePx: 128,
    isMobile,
    resetKey: `${animeId}-staff`,
  });

  const handleSelectStaff = useCallback(
    (item: {
      id?: number | string;
      name: string;
      role: string;
      image?: string;
      isStudio?: boolean;
    }) => {
      if ("isStudio" in item && Boolean(item.isStudio)) {
        void navigate({
          to: "/anime/$id",
          params: { id: animeId },
          search: (prev: Record<string, unknown>) => ({
            ...prev,
            studio: item.name,
          }),
        });
      } else {
        void navigate({
          to: "/anime/$id",
          params: { id: animeId },
          search: (prev: Record<string, unknown>) => ({
            ...prev,
            staff: item.name,
            ...(item.id ? { staffId: String(item.id) } : {}),
          }),
        });
      }
    },
    [navigate, animeId],
  );

  if (allItems.length === 0) {
    return null;
  }

  const scroll = (direction: "left" | "right") => {
    if (!railRef.current) return;
    if (direction === "right") {
      advanceImgLimit(360);
    }
    const offset = direction === "left" ? -320 : 320;
    railRef.current.scrollBy({ left: offset, behavior: "smooth" });
  };

  if (expandedEntity) {
    return (
      <section className="mt-12 space-y-4">
        <Suspense fallback={null}>
          <EntityWorksExpansion
            entity={expandedEntity}
            onClear={() => setExpandedEntity(null)}
            accentColor={expandedEntity.type === "studio" ? "indigo" : "purple"}
          />
        </Suspense>
      </section>
    );
  }

  return (
    <section className="mt-12 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <span className="h-6 w-1 rounded-full bg-purple-500" />
          <h2 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Direção e equipe técnica
          </h2>
        </div>

        {allItems.length > 3 && (
          <div className="hidden sm:flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => scroll("left")}
              aria-label="Rolar equipe para a esquerda"
              className="flex size-8 items-center justify-center rounded-lg border border-purple-500/20 bg-[#0f0d18] text-purple-300 [@media(hover:hover)]:hover:border-purple-500/50 [@media(hover:hover)]:hover:bg-[#19142b] transition-[color,background-color,border-color] cursor-pointer"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => scroll("right")}
              aria-label="Rolar equipe para a direita"
              className="flex size-8 items-center justify-center rounded-lg border border-purple-500/20 bg-[#0f0d18] text-purple-300 [@media(hover:hover)]:hover:border-purple-500/50 [@media(hover:hover)]:hover:bg-[#19142b] transition-[color,background-color,border-color] cursor-pointer"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        )}
      </div>

      <div
        ref={railRef}
        className="rail -mx-4 flex gap-2.5 sm:gap-3 overflow-x-auto px-4 sm:-mx-6 sm:px-6 pb-2"
      >
        {allItems.slice(0, renderedLimit).map((item, index) => (
          <StaffCard
            key={`${item.role}-${item.name}-${index}`}
            item={item}
            loadImage={index < visibleImgLimit}
            isSelected={false}
            onSelect={handleSelectStaff}
          />
        ))}
      </div>
    </section>
  );
});

const StaffCard = memo(function StaffCard({
  item,
  loadImage,
  isSelected,
  onSelect,
}: {
  item: {
    id?: number | string;
    name: string;
    role: string;
    image?: string;
    isStudio?: boolean;
  };
  loadImage: boolean;
  isSelected?: boolean;
  onSelect?: (item: {
    id?: number | string;
    name: string;
    role: string;
    image?: string;
    isStudio?: boolean;
  }) => void;
}) {
  const { isEntityFavorited, toggleEntityFavorite } = useFavoritesEntity();

  const roleText = staffRoleLabel(item.role);

  const isStudio = Boolean(item.isStudio);
  const targetType = isStudio ? "studio" : "person";
  const targetId = isStudio
    ? item.name
    : item.id
    ? String(item.id)
    : item.name;

  const isFav = isEntityFavorited(targetType, targetId, item.name);

  const handleToggleFav = useCallback(async () => {
    if (isStudio) {
      let logoUrl = item.image;
      if (!logoUrl) {
        const { getStudioLogo } = await import("@/lib/studio-logos");
        logoUrl = getStudioLogo(item.name);
      }
      await toggleEntityFavorite({
        targetType: "studio",
        targetId,
        name: item.name,
        studioSnapshot: {
          name: item.name,
          logoUrl: logoUrl ?? null,
          description: "Estúdio de animação",
        },
      });
    } else {
      await toggleEntityFavorite({
        targetType: "person",
        targetId,
        name: item.name,
        personSnapshot: {
          name: item.name,
          imageUrl: item.image ?? null,
          biography: roleText || item.role,
        },
      });
    }
  }, [isStudio, item.image, item.name, item.role, roleText, targetId, toggleEntityFavorite]);

  const itemAriaLabel = isFav
    ? `Remover ${item.name} dos favoritos`
    : `Adicionar ${item.name} aos favoritos`;

  return (
    <div
      role="button"
      tabIndex={0}
      title={item.isStudio ? `Ver produções de ${item.name}` : undefined}
      onClick={() => onSelect?.(item)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect?.(item);
        }
      }}
      className={cn(
        "group relative flex w-[110px] sm:w-[126px] md:w-[136px] shrink-0 flex-col overflow-hidden rounded-xl border border-purple-500/15 bg-[#100e1b] shadow-sm [contain:layout_paint_style] motion-safe:transition-[transform,border-color,box-shadow,background-color] motion-safe:duration-300 [@media(hover:hover)]:hover:-translate-y-1 [@media(hover:hover)]:hover:border-purple-500/45 [@media(hover:hover)]:hover:shadow-[0_8px_24px_rgba(168,85,247,0.2)] cursor-pointer text-left select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400",
        isSelected &&
          "border-purple-500/80 ring-2 ring-purple-500/90 shadow-[0_0_20px_rgba(168,85,247,0.35)] bg-[#141026]",
      )}
    >
      {/* Imagem retangular (logo real para estúdio, retrato real para profissional ou fundo chapado) */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-[#0d0c16]">
        {isStudio ? (
          <div className="relative flex size-full items-center justify-center p-2.5 sm:p-3 bg-[#0d0c16]">
            <HikariImage
              src={anilistImage(item.image, 160)}
              width={160}
              height={213}
              loading="lazy"
              decoding="async"
              fetchPriority="low"
              defer={Boolean(item.image && !loadImage)}
              alt={item.name}
              fallbackClassName="bg-[#0d0c16]"
              className="max-h-full max-w-full object-contain [@media(hover:hover)]:group-hover:scale-105"
            />
          </div>
        ) : (
          <HikariImage
            src={anilistImage(item.image, 160)}
            width={160}
            height={213}
            loading="lazy"
            decoding="async"
            fetchPriority="low"
            defer={Boolean(item.image && !loadImage)}
            alt={item.name}
            fallbackClassName="bg-[#0d0c16]"
            className="size-full object-cover object-top [@media(hover:hover)]:group-hover:scale-105"
          />
        )}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#100e1b] via-transparent to-black/20 opacity-60" />

        {/* Botão de Favorito com animação padronizada (não propaga seleção) */}
        <div onClick={(e) => e.stopPropagation()}>
          <CardFavoriteButton
            isFavorite={isFav}
            onToggle={handleToggleFav}
            ariaLabel={itemAriaLabel}
          />
        </div>
      </div>

      {/* Textos abaixo da imagem protegidos com min-w-0 e flexbox */}
      <div className="flex flex-1 flex-col justify-between p-2 sm:p-2.5 min-w-0">
        <div className="min-w-0">
          <p
            title={roleText}
            className="truncate text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-purple-400 min-w-0"
          >
            {roleText}
          </p>
          <p
            title={item.name}
            className="mt-0.5 line-clamp-2 font-display text-[11px] sm:text-xs font-semibold text-zinc-100 transition-colors [@media(hover:hover)]:group-hover:text-purple-300 min-w-0 break-words leading-snug"
          >
            {item.name}
          </p>
        </div>
      </div>
    </div>
  );
});

const RelatedSection = memo(function RelatedSection({
  animeId,
  recommendations,
}: {
  animeId: string;
  recommendations: SlimAnime[];
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const locals = useHikariStore((s) => s.animes);
  const orderedRecommendations = useMemo(
    () =>
      sortByHasEpisodeFirst(
        overlayList(recommendations, locals, { includeExtras: false }),
      ),
    [recommendations, locals],
  );

  const {
    renderedLimit,
    imageLimit: visibleImgLimit,
    advance: advanceImgLimit,
  } = useProgressiveRail({
    railRef,
    totalCount: orderedRecommendations.length,
    itemStridePx: 132,
    initialRenderCount: 8,
    initialImageCount: 6,
    resetKey: animeId,
  });

  if (orderedRecommendations.length === 0) {
    return null;
  }

  const scroll = (direction: "left" | "right") => {
    if (!railRef.current) return;
    if (direction === "right") {
      advanceImgLimit(360);
    }
    const offset = direction === "left" ? -320 : 320;
    railRef.current.scrollBy({ left: offset, behavior: "smooth" });
  };

  return (
    <section className="mt-12 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <span className="h-6 w-1 rounded-full bg-purple-500" />
          <h2 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Relacionados
          </h2>
        </div>

        {orderedRecommendations.length > 3 && (
          <div className="hidden sm:flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => scroll("left")}
              aria-label="Rolar relacionados para a esquerda"
              className="flex size-8 items-center justify-center rounded-lg border border-purple-500/20 bg-[#0f0d18] text-purple-300 [@media(hover:hover)]:hover:border-purple-500/50 [@media(hover:hover)]:hover:bg-[#19142b] transition-[color,background-color,border-color] cursor-pointer"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => scroll("right")}
              aria-label="Rolar relacionados para a direita"
              className="flex size-8 items-center justify-center rounded-lg border border-purple-500/20 bg-[#0f0d18] text-purple-300 [@media(hover:hover)]:hover:border-purple-500/50 [@media(hover:hover)]:hover:bg-[#19142b] transition-[color,background-color,border-color] cursor-pointer"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        )}
      </div>

      <div
        ref={railRef}
        className="rail -mx-4 px-4 sm:-mx-6 sm:px-6"
      >
        {orderedRecommendations.slice(0, renderedLimit).map((r, index) => (
          <AnimeCard
            key={r.id}
            anime={r}
            loading="lazy"
            fetchPriority="low"
            priority={false}
            showBookmark={false}
            loadImage={index < visibleImgLimit}
          />
        ))}
      </div>
    </section>
  );
});
