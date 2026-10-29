import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import {
  Bookmark,
  BookmarkCheck,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Pencil,
  Play,
  Share2,
  X,
} from "lucide-react";
import {
  memo,
  startTransition,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";

import { AnimeCard } from "@/components/anime-card";
import {
  fetchAnimeCredits,
  fetchAnimeDetail,
  fetchAnimePictures,
  fetchAnimeSeasonNavigation,
  fetchJikanPictures,
} from "@/lib/api";
import { isHikariAdmin } from "@/lib/auth/admin";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getStudioLogo } from "@/lib/studio-logos";
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
import { mergeDetail } from "@/lib/overlay";
import {
  analyzeBannerFramingAndTheme,
  hasAdminCustomBanner,
  resolveSeasonMobileBanner,
  resolveSeasonMobileBannerSync,
  selectViewportBanner,
} from "@/lib/season-banner";
import { useHikariStore } from "@/lib/store";
import {
  displayTitle,
  type Anime,
  type AnimeCharacter,
  type AnimeStaff,
  type SlimAnime,
} from "@/lib/types";
import { cn, youtubeIdFrom } from "@/lib/utils";

const EMPTY_WATCHED_EPISODES: string[] = [];
const MOBILE_BANNER_MEDIA_QUERY = "(max-width: 639.98px)";
const DESKTOP_BANNER_MEDIA_QUERY = "(min-width: 640px)";
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

let clientAppHydrated = false;

export const Route = createFileRoute("/anime/$id")({
  staleTime: 1000 * 60 * 5,
  gcTime: 1000 * 60 * 15,
  loader: async ({ params }) => {
    if (params.id.startsWith("local-")) {
      return { remote: null };
    }

    const remote = await fetchAnimeDetail({
      data: { id: params.id },
    });

    return { remote };
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

function AnimePage() {
  const { id } = Route.useParams();
  const { remote } = Route.useLoaderData();
  const navigate = useNavigate();

  const hydrated = useHikariStore((s) => s.hydrated);

  const { user } = useCurrentUserState();
  const canEdit = isHikariAdmin(user?.primaryEmail);

  const locals = useHikariStore((s) => s.animes);

  const inList = useHikariStore(
    (s) =>
      s.myList.includes(id) ||
      (remote?.id ? s.myList.includes(remote.id) : false),
  );

  const toggleList = useHikariStore((s) => s.toggleList);

  const continueEntry = useHikariStore((s) =>
    s.continueWatching.find(
      (entry) => entry.animeId === id,
    ),
  );

  const watchedEpisodes = useHikariStore(
    (s) =>
      s.watchedEpisodes[id] ??
      EMPTY_WATCHED_EPISODES,
  );

  const anime = useMemo(
    () => mergeDetail(remote, id, locals),
    [remote, id, locals],
  );

  const [extraCredits, setExtraCredits] = useState<{
    forId: string;
    studios: string[];
    characters: AnimeCharacter[];
    staff: AnimeStaff[];
  } | null>(null);

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

  useEffect(() => {
    if (!animeId) return;
    if (hasCharacters && hasStaff && hasStudios) return;

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
      },
    })
      .then((res) => {
        if (cancelled || !res) return;
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
      });

    return () => {
      cancelled = true;
    };
  }, [
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
  const [isListToggling, setIsListToggling] = useState(false);
  const [isWatchPressing, setIsWatchPressing] = useState(false);

  const handleToggleList = useCallback(() => {
    if (!anime) return;
    setIsListToggling(true);
    toggleList(anime);
    setTimeout(() => {
      setIsListToggling(false);
    }, 300);
  }, [anime, toggleList]);

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
    () => clientAppHydrated,
  );

  const [isMobileViewport, setIsMobileViewport] = useState(() => {
    if (clientAppHydrated && typeof window !== "undefined") {
      return window.matchMedia(MOBILE_BANNER_MEDIA_QUERY).matches;
    }
    return false;
  });

  useIsomorphicLayoutEffect(() => {
    clientAppHydrated = true;
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
      { skipClientCache: !isHydratedClient },
    );

    if (syncResolved) {
      return {
        forId: animeId,
        url: syncResolved.url,
        isAlternative: syncResolved.isAlternative,
        initialObjectPosition: syncResolved.initialObjectPosition,
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
        fetchJikanPictures,
      },
      controller.signal,
    ).then((resolved) => {
      if (controller.signal.aborted) return;
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
  ]);

  const { effectiveBannerUrl, defaultObjectPosition } = selectViewportBanner({
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
    isAdminBanner
      ? validDesktopBannerUrl
      : activeMobileBannerState?.url &&
          !failedBannerUrls[activeMobileBannerState.url]
        ? activeMobileBannerState.url
        : null;

  const initialDefaultBannerUrl =
    validDesktopBannerUrl || validMobileSourceUrl || baseSeasonBanner || null;

  const currentBannerSrc = isHydratedClient
    ? (effectiveBannerUrl ?? initialDefaultBannerUrl ?? undefined)
    : (initialDefaultBannerUrl ?? undefined);

  const shouldRenderPicture = isHydratedClient
    ? Boolean(effectiveBannerUrl)
    : Boolean(validMobileSourceUrl || validDesktopBannerUrl);

  const [framedBannerPosition, setFramedBannerPosition] = useState<{
    forUrl: string;
    objectPosition: string;
  } | null>(null);

  const bannerObjectPosition =
    effectiveBannerUrl && framedBannerPosition?.forUrl === effectiveBannerUrl
      ? framedBannerPosition.objectPosition
      : defaultObjectPosition;

  /*
   * COR DA ABA DO NAVEGADOR & ENQUADRAMENTO ADAPTÁVEL DO BANNER
   */
  useEffect(() => {
    const defaultColor = "#09090b";

    let meta = document.querySelector(
      'meta[name="theme-color"]',
    ) as HTMLMetaElement | null;

    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }

    meta.content = animeColor || defaultColor;

    if (!effectiveBannerUrl) {
      return;
    }

    return analyzeBannerFramingAndTheme({
      bannerUrl: effectiveBannerUrl,
      hasExplicitColor: Boolean(animeColor),
      defaultThemeColor: defaultColor,
      onResult: ({ objectPosition, themeColor }) => {
        if (objectPosition) {
          setFramedBannerPosition({
            forUrl: effectiveBannerUrl,
            objectPosition,
          });
        }
        if (themeColor && !animeColor && meta) {
          meta.content = themeColor;
        }
      },
    });
  }, [animeId, effectiveBannerUrl, animeColor]);

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
  } | null>(null);

  const requestedSeasonNavRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!id || id.startsWith("local-") || id.startsWith("kitsu-")) {
      return;
    }

    if (requestedSeasonNavRef.current.has(id)) {
      return;
    }

    let cancelled = false;
    requestedSeasonNavRef.current.add(id);

    fetchAnimeSeasonNavigation({
      data: { id },
    })
      .then((res) => {
        if (cancelled || !res?.items || res.items.length === 0) return;

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
      });

    return () => {
      cancelled = true;
    };
  }, [id, initialSeasonNavigation]);

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

  const allEpisodes = useMemo(
    () =>
      (currentEpisodes ?? []).map((episode) => ({
        ...episode,
        seasonId: currentSeason?.id ?? "",
      })),
    [currentEpisodes, currentSeason?.id],
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

  const title = displayTitle(anime);
  const isReleasing = anime.status === "RELEASING";
  const yt = youtubeIdFrom(anime.trailerId);

  const episodeCount =
    currentEpisodes?.length ||
    anime.episodesCount ||
    0;

  /*
   * CONTINUAR
   *
   * Procura exatamente o episódio onde
   * o usuário parou.
   */
  const continueEpisode =
    continueEntry
      ? allEpisodes.find(
          (episode) =>
            episode.id ===
            continueEntry.episodeId,
        )
      : undefined;

  const continueTarget =
    continueEpisode ??
    allEpisodes[0];

  const watchButtonLabel =
    continueEpisode
      ? `Continuar no ep. ${continueEpisode.number}`
      : "Assistir";

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title,
          text: `Confira ${title} no Hikari`,
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(
          window.location.href,
        );
      }
    } catch {
      // Usuário cancelou o compartilhamento.
    }
  };

  return (
    <article className="pb-12 motion-safe:animate-[pageEnter_250ms_ease-out]">
      {/* Testes experimentais isolados: entrada suave da página e assentamento sutil do banner */}
      <style>{`
        @keyframes pageEnter {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes bannerSettle {
          from { transform: scale(1.02); }
          to { transform: scale(1); }
        }
        @keyframes bookmarkPop {
          0% { transform: scale(0.85); }
          50% { transform: scale(1.22); }
          100% { transform: scale(1); }
        }
        @keyframes bookmarkDepop {
          0% { transform: scale(1.15); }
          50% { transform: scale(0.88); }
          100% { transform: scale(1); }
        }
        @keyframes episodeTapPulse {
          0% { transform: scale(1); }
          45% { transform: scale(0.982); }
          100% { transform: scale(1); }
        }
      `}</style>

      {/* HERO */}
      <section className="relative -mx-4 overflow-hidden sm:-mx-6">
        <div
          key={`banner-${anime.id}`}
          className="relative max-sm:h-[22rem] max-sm:min-[380px]:h-[24rem] sm:h-[22rem] md:h-[26rem] lg:h-[28rem] w-full bg-elevated"
        >
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#151126] via-[#0d0b18] to-bg" />

          {shouldRenderPicture ? (
            <picture
              className={cn(
                "relative block size-full",
                !isHydratedClient && !validMobileSourceUrl && "max-sm:hidden",
              )}
            >
              {validMobileSourceUrl ? (
                <source
                  media={MOBILE_BANNER_MEDIA_QUERY}
                  srcSet={validMobileSourceUrl}
                />
              ) : null}
              {validDesktopBannerUrl ? (
                <source
                  media={DESKTOP_BANNER_MEDIA_QUERY}
                  srcSet={validDesktopBannerUrl}
                />
              ) : null}
              <img
                src={currentBannerSrc}
                alt=""
                loading="eager"
                fetchPriority="high"
                decoding="async"
                onError={(e) => {
                  const failedUrl =
                    e.currentTarget.currentSrc ||
                    effectiveBannerUrl ||
                    currentBannerSrc;
                  if (!failedUrl) return;
                  setFailedBannerUrls((prev) =>
                    prev[failedUrl] ? prev : { ...prev, [failedUrl]: true },
                  );
                }}
                style={{
                  objectPosition: isHydratedClient
                    ? bannerObjectPosition
                    : (activeMobileBannerState?.initialObjectPosition ??
                      "50% 24%"),
                }}
                className="size-full object-cover sm:!object-center transition-[object-position,opacity] duration-500 motion-safe:animate-[bannerSettle_400ms_ease-out]"
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
              <div className="w-28 max-sm:min-[380px]:w-32 sm:w-44 shrink-0 overflow-hidden rounded-2xl bg-elevated shadow-[0_12px_36px_rgba(0,0,0,0.85),0_0_24px_rgba(168,85,247,0.2)] ring-1 ring-purple-500/35 sm:translate-y-8.5">
                {anime.cover ? (
                  <img
                    src={anime.cover}
                    alt={title}
                    loading="eager"
                    decoding="async"
                    fetchPriority={shouldRenderPicture ? "auto" : "high"}
                    className="aspect-2/3 w-full object-cover"
                  />
                ) : (
                  <div className="aspect-2/3 bg-elevated" />
                )}
              </div>
            </div>

            {/* INFORMAÇÕES COMPLETAS */}
            <div className="flex min-w-0 flex-1 flex-col justify-end pb-1 sm:pb-2">
              {/* TÍTULO E BADGES NO MOBILE ABAIXO DA CAPA */}
              <div className="sm:hidden">
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-500/30 bg-purple-950/70 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-purple-300 uppercase shadow-[0_0_12px_rgba(168,85,247,0.15)]">
                    <span>Anime</span>
                  </span>
                  {anime.score != null && (
                    <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/35 bg-amber-950/60 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.2)]">
                      ★ {scoreLabel(anime.score)}
                    </span>
                  )}
                </div>

                <h1 className="font-display text-2xl font-bold leading-tight tracking-tight text-white line-clamp-3 drop-shadow-sm">
                  {title}
                </h1>

                {anime.titles.native && (
                  <p className="mt-1 font-display text-xs font-medium text-purple-300/70 truncate">
                    {anime.titles.native}
                  </p>
                )}
              </div>

              {/* TÍTULO NO DESKTOP */}
              <div className="hidden sm:block">
                <div className="mb-2">
                  <span className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-950/70 px-2.5 py-0.5 text-xs font-semibold tracking-wider text-purple-300 uppercase shadow-[0_0_12px_rgba(168,85,247,0.15)]">
                    <span>Anime</span>
                  </span>
                </div>

                <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-white drop-shadow-sm sm:text-4xl md:text-5xl">
                  {title}
                </h1>

                {anime.titles.native && (
                  <p className="mt-1 font-display text-sm font-medium text-purple-300/70">
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

                {episodeCount > 0 && (
                  <span className="inline-flex items-center rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-zinc-300">
                    {episodeCount} episódios
                  </span>
                )}

                {statusLabel(anime.status) && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-purple-500/20 bg-purple-950/40 px-2.5 py-1 text-xs font-medium text-purple-300">
                    {isReleasing && (
                      <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] motion-safe:animate-pulse" />
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
                <Link
                  to="/watch/$id"
                  params={{
                    id: anime.id,
                  }}
                  search={
                    continueTarget
                      ? {
                          ep: continueTarget.id,
                        }
                      : undefined
                  }
                  className={cn(
                    "group relative inline-flex h-11 sm:h-12 items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-purple-500 px-5 sm:px-6 text-sm sm:text-base font-semibold text-white shadow-[0_4px_20px_rgba(168,85,247,0.35)] transition-all duration-250 ease-out select-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400",
                    "hover:from-purple-500 hover:to-purple-400 hover:shadow-[0_4px_26px_rgba(168,85,247,0.5)] hover:brightness-110",
                    "motion-safe:hover:scale-[1.02] motion-safe:active:scale-[0.96]",
                    "active:brightness-125 active:shadow-[0_0_28px_rgba(168,85,247,0.65)]",
                    isWatchPressing && "motion-safe:scale-[0.96] brightness-125 shadow-[0_0_28px_rgba(168,85,247,0.65)]"
                  )}
                  onClick={(e) => {
                    setIsWatchPressing(true);
                    setTimeout(() => {
                      setIsWatchPressing(false);
                    }, 250);

                    if (
                      !e.metaKey &&
                      !e.altKey &&
                      !e.ctrlKey &&
                      !e.shiftKey &&
                      e.button === 0
                    ) {
                      e.preventDefault();
                      void navigate({
                        to: "/watch/$id",
                        params: {
                          id: anime.id,
                        },
                        search: continueTarget
                          ? {
                              ep: continueTarget.id,
                            }
                          : undefined,
                      });
                    }
                  }}
                >
                  <Play className="size-4 fill-current pointer-events-none transition-transform duration-250 ease-out group-hover:scale-105" />
                  <span>{watchButtonLabel}</span>
                </Link>

                <button
                  type="button"
                  onClick={handleToggleList}
                  aria-label={inList ? "Remover da minha lista" : "Adicionar à minha lista"}
                  className={cn(
                    "group relative inline-flex h-11 sm:h-12 items-center justify-center gap-2 rounded-xl px-4 sm:px-5 text-sm sm:text-base font-medium shadow-sm transition-all duration-250 ease-out select-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400",
                    "motion-safe:hover:scale-[1.02] motion-safe:active:scale-[0.96]",
                    inList
                      ? "border border-purple-500/50 bg-[#151126] text-purple-200 shadow-[0_0_16px_rgba(168,85,247,0.22)] hover:border-purple-400/70 hover:bg-[#1b1532] hover:shadow-[0_0_20px_rgba(168,85,247,0.32)]"
                      : "border border-purple-500/30 bg-[#0f0d18]/90 text-zinc-200 hover:border-purple-500/60 hover:bg-[#1a142e] hover:text-white hover:shadow-[0_0_12px_rgba(168,85,247,0.18)]",
                    isListToggling && (inList
                      ? "border-purple-400 shadow-[0_0_22px_rgba(168,85,247,0.45)] brightness-110"
                      : "shadow-[0_0_10px_rgba(168,85,247,0.15)]")
                  )}
                >
                  {inList ? (
                    <BookmarkCheck
                      className={cn(
                        "size-4 text-purple-300 transition-all duration-250 ease-out",
                        isListToggling && "motion-safe:animate-[bookmarkPop_300ms_cubic-bezier(0.34,1.56,0.64,1)] text-purple-200"
                      )}
                    />
                  ) : (
                    <Bookmark
                      className={cn(
                        "size-4 text-zinc-400 transition-all duration-250 ease-out group-hover:text-purple-300",
                        isListToggling && "motion-safe:animate-[bookmarkDepop_300ms_ease-out]"
                      )}
                    />
                  )}
                  <span className="transition-colors duration-250">
                    {inList ? "Na Minha Lista" : "Minha Lista"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleShare}
                  className="inline-flex h-11 sm:h-12 items-center justify-center gap-2 rounded-xl border border-purple-500/25 bg-[#0f0d18]/90 px-4 sm:px-5 text-sm sm:text-base font-medium text-zinc-200 shadow-sm transition-all duration-200 ease-out hover:border-purple-500/50 hover:bg-[#1a142e] hover:text-white hover:brightness-110 motion-safe:hover:scale-[1.02] motion-safe:active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 cursor-pointer"
                >
                  <Share2 className="size-4 text-zinc-400" />
                  <span>Compartilhar</span>
                </button>

                {canEdit && (
                  <Link
                    to="/admin/$id"
                    params={{
                      id: localRecord?.id ?? "new",
                    }}
                    search={{
                      importId: anime.id,
                    }}
                    className="inline-flex h-11 sm:h-12 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 sm:px-5 text-sm sm:text-base font-medium text-zinc-300 shadow-sm transition-all duration-200 ease-out hover:border-purple-500/40 hover:bg-[#1a142e] hover:text-white hover:brightness-110 motion-safe:hover:scale-[1.02] motion-safe:active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 cursor-pointer"
                  >
                    <Pencil className="size-4 text-zinc-400" />
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
            className={`mt-3.5 text-sm sm:text-base leading-relaxed text-zinc-300 ${
              synopsisExpanded ? "" : "line-clamp-4"
            }`}
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

          <div className="mt-4 aspect-video overflow-hidden rounded-2xl border border-purple-500/20 bg-[#0d0b18] shadow-[0_8px_30px_rgba(0,0,0,0.6)] [contain:layout_paint]">
            <iframe
              title={`Trailer de ${title}`}
              src={`https://www.youtube-nocookie.com/embed/${yt}`}
              className="size-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
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
      {currentSeason && (
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
                  {episodeCount} episódios disponíveis
                </span>
                <span className="text-zinc-600">·</span>
                <span className="inline-flex items-center rounded-md border border-purple-500/20 bg-purple-950/40 px-2.5 py-1 font-medium text-purple-300">
                  {watchedCount}/{episodeCount} assistidos
                </span>
              </div>
            </div>
          </div>

          <div className="mt-5">
            <EpisodeGrid
              episodes={currentSeason.episodes}
              animeId={anime.id}
              cover={anime.cover}
              watchedEpisodes={watchedEpisodes}
            />
          </div>
        </section>
      )}

      {/* ELENCO */}
      <ElencoSection animeId={anime.id} characters={effectiveCharacters} />

      {/* DIREÇÃO E EQUIPE TÉCNICA */}
      <DirecaoEquipeSection
        animeId={anime.id}
        studios={effectiveStudios}
        staff={effectiveStaff}
      />

      {/* INFORMAÇÕES ADICIONAIS */}
      <InformacoesAdicionaisSection anime={anime} />

      {/* IMAGENS */}
      <ImagensSection
        animeId={anime.id}
        images={anime.images}
        title={title}
        bannerUrl={anime.banner}
        coverUrl={anime.cover}
        malId={anime.malId}
      />

      {/* RELACIONADOS (SEM BOTÃO DE SALVAR) */}
      {anime.recommendations.length > 0 && (
        <RelatedSection
          animeId={anime.id}
          recommendations={anime.recommendations}
        />
      )}

      {/* COMENTÁRIOS DO HIKARI (EM BREVE) */}
      <section className="mt-12 space-y-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="h-6 w-1 rounded-full bg-purple-500" />
            <h2 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Comentários
            </h2>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-zinc-400">
            Espaço para a comunidade compartilhar impressões sobre este anime.
          </p>
        </div>

        <div className="flex flex-col items-center justify-center rounded-2xl border border-purple-500/15 bg-gradient-to-b from-[#131024]/70 to-[#0e0c18]/90 p-8 text-center shadow-sm">
          <div className="flex size-12 items-center justify-center rounded-2xl border border-purple-500/20 bg-purple-950/40 text-purple-400">
            <MessageCircle className="size-6" />
          </div>

          <h3 className="mt-4 font-display text-base font-semibold text-white sm:text-lg">
            Comentários em breve
          </h3>

          <p className="mt-1.5 max-w-md text-xs sm:text-sm text-zinc-400">
            O sistema de discussão e avaliação da comunidade do Hikari está sendo preparado e estará disponível aqui em breve.
          </p>
        </div>
      </section>
    </article>
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
              "absolute left-0 top-full z-40 mt-2 w-full min-w-[17rem] max-w-[min(24rem,calc(100vw-2rem))] origin-top rounded-md border border-purple-500/30 bg-[#100d1c]/98 p-1.5 shadow-[0_18px_44px_rgba(0,0,0,0.78),0_0_24px_rgba(168,85,247,0.14)] backdrop-blur-xl will-change-[opacity,transform]",
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

  useEffect(() => {
    if (prevResetKeyRef.current !== resetKey) {
      prevResetKeyRef.current = resetKey;
      if (railRef.current) {
        railRef.current.scrollLeft = 0;
      }
      setLimit(Math.min(totalCount, initialCount));
      return;
    }
    setLimit((prev) =>
      Math.min(totalCount, Math.max(prev, initialCount)),
    );
  }, [railRef, resetKey, totalCount, initialCount]);

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
    if (limit >= totalCount) return;
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
  }, [railRef, limit, totalCount, advance]);

  return { limit, advance };
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
};

const EpisodeGridItem = memo(function EpisodeGridItem({
  ep,
  animeId,
  cover,
  watched,
  isSelecting,
  loadImage,
  onSelect,
}: {
  ep: EpisodeItemData;
  animeId: string;
  cover: string;
  watched: boolean;
  isSelecting: boolean;
  loadImage: boolean;
  onSelect: (epId: string) => void;
}) {
  const imgSrc = ep.thumbnail || cover;

  return (
    <li>
      <Link
        to="/watch/$id"
        params={{
          id: animeId,
        }}
        search={{
          ep: ep.id,
        }}
        preload="intent"
        onClick={() => onSelect(ep.id)}
        className={cn(
          "group relative flex gap-3 rounded-xl border p-2.5 select-none touch-manipulation [-webkit-tap-highlight-color:transparent] [contain:layout_paint_style] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/80",
          "motion-safe:transition-[transform,border-color,background-color,box-shadow] motion-safe:duration-200 motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none motion-reduce:transform-none",
          "[@media(hover:hover)]:motion-safe:hover:-translate-y-0.5",
          "motion-safe:active:scale-[0.982] active:border-purple-400/85 active:bg-[#1c1435]/95 active:ring-1 active:ring-purple-400/45 active:shadow-[0_0_24px_rgba(168,85,247,0.38)]",
          watched
            ? "border-purple-500/30 bg-[#141026]/90 [@media(hover:hover)]:hover:bg-[#1a1530] [@media(hover:hover)]:hover:border-purple-500/50"
            : "border-purple-500/15 bg-[#0f0d18]/90 [@media(hover:hover)]:hover:border-purple-500/40 [@media(hover:hover)]:hover:bg-[#161326]",
          "shadow-[0_2px_12px_rgba(0,0,0,0.3)] [@media(hover:hover)]:hover:shadow-[0_4px_20px_rgba(168,85,247,0.15)]",
          isSelecting &&
            "!border-purple-400/85 !bg-[#1c1435]/95 ring-1 ring-purple-400/45 !shadow-[0_0_24px_rgba(168,85,247,0.4)] motion-safe:animate-[episodeTapPulse_220ms_cubic-bezier(0.22,1,0.36,1)] motion-reduce:animate-none",
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
          {imgSrc && loadImage ? (
            <img
              src={imgSrc}
              alt=""
              loading="lazy"
              decoding="async"
              className={cn(
                "size-full object-cover motion-safe:transition-transform motion-safe:duration-300 [@media(hover:hover)]:motion-safe:group-hover:scale-105 motion-reduce:transition-none",
                watched && "opacity-75",
              )}
            />
          ) : null}

          <div className="absolute inset-0 bg-black/20 transition-colors motion-reduce:transition-none [@media(hover:hover)]:group-hover:bg-black/5" />

          <div
            className={cn(
              "absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 motion-reduce:transition-none [@media(hover:hover)]:group-hover:opacity-100 group-active:opacity-100",
              isSelecting && "opacity-100",
            )}
          >
            <div
              className={cn(
                "flex size-9 items-center justify-center rounded-full bg-purple-600 text-white shadow-lg shadow-purple-950/60 ring-2 ring-white/20 motion-safe:transition-transform motion-safe:duration-200 motion-reduce:transition-none group-active:bg-purple-500 group-active:ring-purple-300/60",
                isSelecting && "bg-purple-500 ring-purple-300/60 motion-safe:scale-105",
              )}
            >
              <Play className="ml-0.5 size-4 fill-current" />
            </div>
          </div>

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
  cover,
  watchedEpisodes,
}: {
  episodes: EpisodeItemData[];
  animeId: string;
  cover: string;
  watchedEpisodes: string[];
}) {
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const selectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollBoxRef = useRef<HTMLDivElement>(null);

  const watchedSet = useMemo(
    () => new Set(watchedEpisodes),
    [watchedEpisodes],
  );

  const visibleImgLimit = useVerticalBoxImageLimit(
    scrollBoxRef,
    episodes.length,
    108,
    18,
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

  return (
    <div
      ref={scrollBoxRef}
      className="
        max-h-[28rem]
        overflow-y-auto
        overscroll-contain
        rounded-xl
        pr-1
        touch-pan-y
        sm:max-h-[34rem]
      "
    >
      <ol className="grid gap-3 p-0.5 sm:grid-cols-2">
        {episodes.map((ep, index) => (
          <EpisodeGridItem
            key={ep.id}
            ep={ep}
            animeId={animeId}
            cover={cover}
            watched={watchedSet.has(ep.id)}
            isSelecting={selectingId === ep.id}
            loadImage={index < visibleImgLimit}
            onSelect={handleEpisodeSelect}
          />
        ))}
      </ol>
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
  const [extraPictures, setExtraPictures] = useState<string[]>([]);
  const railRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (railRef.current) {
      railRef.current.scrollLeft = 0;
    }

    const unsubscribe = router.subscribe("onRendered", () => {
      requestAnimationFrame(() => {
        if (railRef.current) {
          railRef.current.scrollLeft = 0;
        }
      });
    });

    return unsubscribe;
  }, [router]);

  // Busca em segundo plano na API Jikan (MyAnimeList) caso o anime possua poucas imagens carregadas
  useEffect(() => {
    if (!malId || (images && images.length >= 3)) return;
    let isMounted = true;

    fetchAnimePictures({ data: { malId } })
      .then((pics) => {
        if (isMounted && Array.isArray(pics) && pics.length > 0) {
          startTransition(() => {
            setExtraPictures(pics);
          });
        }
      })
      .catch(() => {
        // Silencioso: não impacta a experiência visual do usuário
      });

    return () => {
      isMounted = false;
    };
  }, [malId, images]);

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

  const { limit: visibleImgLimit, advance: advanceImgLimit } =
    useHorizontalRailImageLimit(
      railRef,
      validImages.length,
      158,
      10,
      animeId,
    );

  const closeModal = useCallback(() => {
    setSelectedImage((current) => {
      if (current && window.history.state?.hikariGalleryModal) {
        window.history.back();
      }
      return null;
    });
  }, []);

  useEffect(() => {
    if (!selectedImage) return;

    // Preserva o scroll original da página sem saltos
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

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
      document.body.style.overflow = prevOverflow;
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

          {validImages.length > 2 && (
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

        <div
          ref={railRef}
          className="rail -mx-4 flex gap-3.5 overflow-x-auto px-4 sm:-mx-6 sm:px-6 pb-2"
        >
          {validImages.map((imgUrl, idx) => (
            <button
              key={`${imgUrl}-${idx}`}
              type="button"
              onClick={() => setSelectedImage(imgUrl)}
              className="group relative h-52 sm:h-60 w-36 sm:w-44 shrink-0 overflow-hidden rounded-2xl border border-purple-500/20 bg-[#0e0c1a] shadow-md [contain:layout_paint_style] motion-safe:transition-[transform,border-color,box-shadow] motion-safe:duration-300 [@media(hover:hover)]:hover:-translate-y-1 [@media(hover:hover)]:hover:border-purple-500/60 [@media(hover:hover)]:hover:shadow-[0_8px_30px_rgba(168,85,247,0.25)] cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 p-2 flex flex-col items-center justify-center"
            >
              <div className="relative size-full flex items-center justify-center overflow-hidden rounded-xl bg-[#07060d]">
                {idx < visibleImgLimit ? (
                  <img
                    src={imgUrl}
                    alt={`Arte promocional de ${title} (${idx + 1})`}
                    className="size-full object-contain motion-safe:transition-transform motion-safe:duration-500 [@media(hover:hover)]:group-hover:scale-105"
                    loading="lazy"
                    decoding="async"
                  />
                ) : null}
              </div>
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-black/85 via-transparent to-transparent opacity-0 [@media(hover:hover)]:group-hover:opacity-100 transition-opacity flex items-end p-2.5 pointer-events-none">
                <span className="text-[11px] font-semibold text-purple-200 drop-shadow">
                  Ampliar arte
                </span>
              </div>
          </button>
        ))}
      </div>

      {selectedImage && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Visualização de imagem de ${title}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-3 sm:p-6 animate-in fade-in duration-200"
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
            className="relative flex items-center justify-center max-h-[88vh] max-w-[92vw] select-none"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={selectedImage}
              alt={`Visualização completa de ${title}`}
              decoding="async"
              className="max-h-[88vh] max-w-[92vw] w-auto h-auto object-contain rounded-xl border border-purple-500/20 bg-[#090812] shadow-[0_20px_60px_rgba(0,0,0,0.85)]"
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
}: {
  animeId: string;
  characters?: AnimeCharacter[];
}) {
  const [selectedLang, setSelectedLang] = useState<"ja" | "pt">("ja");
  const railRef = useRef<HTMLDivElement>(null);

  const validCharacters = useMemo(() => {
    return (characters ?? []).filter((c) =>
      Boolean(c?.name?.full?.trim() || c?.name?.native?.trim()),
    );
  }, [characters]);

  // Verifica se há dubladores em português brasileiro
  const hasPortuguese = useMemo(() => {
    return validCharacters.some((c) =>
      (c.voiceActors ?? []).some((va) => {
        const hasName = Boolean(
          va?.name?.full?.trim() || va?.name?.native?.trim(),
        );
        if (!hasName) return false;
        const lang = (va.language ?? "").toLowerCase();
        return (
          lang.includes("portuguese") ||
          lang.includes("brazil") ||
          lang.includes("pt-br") ||
          lang.includes("pt_br")
        );
      }),
    );
  }, [validCharacters]);

  const activeLang: "ja" | "pt" = hasPortuguese ? selectedLang : "ja";

  const { limit: visibleImgLimit, advance: advanceImgLimit } =
    useHorizontalRailImageLimit(
      railRef,
      validCharacters.length,
      128,
      12,
      animeId,
    );

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <span className="h-6 w-1 rounded-full bg-purple-500" />
          <h2 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Elenco
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

          {validCharacters.length > 3 && (
            <div className="hidden sm:flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => scroll("left")}
                aria-label="Rolar elenco para a esquerda"
                className="flex size-8 items-center justify-center rounded-lg border border-purple-500/20 bg-[#0f0d18] text-purple-300 [@media(hover:hover)]:hover:border-purple-500/50 [@media(hover:hover)]:hover:bg-[#19142b] transition-[color,background-color,border-color] cursor-pointer"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => scroll("right")}
                aria-label="Rolar elenco para a direita"
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
        {validCharacters.map((char, index) => (
          <ElencoCard
            key={`${char.id || char.name.full || char.name.native}-${index}`}
            char={char}
            selectedLang={activeLang}
            loadImage={index < visibleImgLimit}
          />
        ))}
      </div>
    </section>
  );
});

const ElencoCard = memo(function ElencoCard({
  char,
  selectedLang,
  loadImage,
}: {
  char: AnimeCharacter;
  selectedLang: "ja" | "pt";
  loadImage: boolean;
}) {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [char.image]);

  const charName = char.name?.full?.trim() || char.name?.native?.trim() || "";
  const validVas = (char.voiceActors ?? []).filter((va) =>
    Boolean(va?.name?.full?.trim() || va?.name?.native?.trim()),
  );

  const matchingVa =
    selectedLang === "pt"
      ? validVas.find((va) => {
          const l = (va.language ?? "").toLowerCase();
          return (
            l.includes("brazil") ||
            l.includes("pt-br") ||
            l.includes("pt_br")
          );
        }) ??
        validVas.find((va) =>
          (va.language ?? "").toLowerCase().includes("portuguese"),
        )
      : validVas.find((va) => {
          const l = (va.language ?? "").toLowerCase();
          return l.includes("japanese") || l === "ja" || l === "ja_jp";
        });

  const vaName =
    matchingVa?.name?.full?.trim() || matchingVa?.name?.native?.trim() || "";

  const isMain = (char.role ?? "").toUpperCase() === "MAIN";
  const roleLabel = isMain ? "Protagonista" : "Secundário";
  const showImage = Boolean(char.image) && !imgError;

  return (
    <div className="group relative flex w-[110px] sm:w-[126px] md:w-[136px] shrink-0 flex-col overflow-hidden rounded-xl border border-purple-500/15 bg-[#100e1b] shadow-sm [contain:layout_paint_style] motion-safe:transition-[transform,border-color,box-shadow] motion-safe:duration-300 [@media(hover:hover)]:hover:-translate-y-1 [@media(hover:hover)]:hover:border-purple-500/45 [@media(hover:hover)]:hover:shadow-[0_8px_24px_rgba(168,85,247,0.2)]">
      {/* Imagem retangular do personagem (elemento visual principal, nunca circular) */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-[#0d0c16]">
        {showImage ? (
          loadImage ? (
            <img
              src={char.image}
              alt={charName}
              onError={() => setImgError(true)}
              loading="lazy"
              decoding="async"
              className="size-full object-cover object-top motion-safe:transition-transform motion-safe:duration-500 ease-out [@media(hover:hover)]:group-hover:scale-105"
            />
          ) : (
            <div className="size-full bg-[#0d0c16]" />
          )
        ) : (
          <div className="flex size-full items-center justify-center bg-gradient-to-b from-[#17132a] to-[#0d0b18] font-display text-xl sm:text-2xl font-bold text-purple-400/80">
            {charName.charAt(0)}
          </div>
        )}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#100e1b] via-transparent to-black/20 opacity-60" />

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

        {/* Nome do dublador correspondente logo abaixo em texto */}
        <div className="mt-1.5 min-w-0">
          {vaName ? (
            <p
              title={vaName}
              className="truncate text-[10px] sm:text-[10.5px] font-medium text-purple-300/90 min-w-0"
            >
              {vaName}
            </p>
          ) : (
            <p className="truncate text-[9.5px] sm:text-[10px] italic text-zinc-500 min-w-0">
              {selectedLang === "pt"
                ? "Sem dublagem BR"
                : "Sem dublador creditado"}
            </p>
          )}

          <span className="mt-0.5 inline-block rounded bg-white/5 px-1 py-0.5 text-[8px] sm:text-[8.5px] font-medium uppercase tracking-wider text-zinc-400">
            {selectedLang === "pt" ? "Voz BR" : "Voz JP"}
          </span>
        </div>
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
}: {
  animeId: string;
  studios: string[];
  staff?: AnimeStaff[];
}) {
  const railRef = useRef<HTMLDivElement>(null);

  const validStaff = useMemo(() => {
    return [...(staff ?? [])]
      .filter((s) => Boolean(s?.name?.trim()))
      .map((s) => ({
        ...s,
        name: s.name.trim(),
        role: s.role?.trim() || "Equipe técnica",
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
        id: `studio-${name}`,
        name,
        role: "Estúdio de animação",
        isStudio: true,
        image: getStudioLogo(name),
      });
    }
    return out;
  }, [studios]);

  const allItems = useMemo(() => {
    return [...studioItems, ...validStaff];
  }, [studioItems, validStaff]);

  const { limit: visibleImgLimit, advance: advanceImgLimit } =
    useHorizontalRailImageLimit(
      railRef,
      allItems.length,
      128,
      12,
      animeId,
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
        {allItems.map((item, index) => (
          <StaffCard
            key={`${item.role}-${item.name}-${index}`}
            item={item}
            loadImage={index < visibleImgLimit}
          />
        ))}
      </div>
    </section>
  );
});

const StaffCard = memo(function StaffCard({
  item,
  loadImage,
}: {
  item: {
    name: string;
    role: string;
    image?: string;
    isStudio?: boolean;
  };
  loadImage: boolean;
}) {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [item.image]);

  const roleText = staffRoleLabel(item.role);
  const showImage = Boolean(item.image) && !imgError;

  return (
    <div className="group relative flex w-[110px] sm:w-[126px] md:w-[136px] shrink-0 flex-col overflow-hidden rounded-xl border border-purple-500/15 bg-[#100e1b] shadow-sm [contain:layout_paint_style] motion-safe:transition-[transform,border-color,box-shadow] motion-safe:duration-300 [@media(hover:hover)]:hover:-translate-y-1 [@media(hover:hover)]:hover:border-purple-500/45 [@media(hover:hover)]:hover:shadow-[0_8px_24px_rgba(168,85,247,0.2)]">
      {/* Imagem retangular (logo real para estúdio, retrato real para profissional ou card tipográfico elegante) */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-[#0d0c16]">
        {item.isStudio && showImage ? (
          <div className="flex size-full items-center justify-center p-2.5 sm:p-3 bg-[#0d0c16]">
            {loadImage ? (
              <img
                src={item.image}
                alt={item.name}
                onError={() => setImgError(true)}
                loading="lazy"
                decoding="async"
                className="max-h-full max-w-full object-contain motion-safe:transition-transform motion-safe:duration-500 [@media(hover:hover)]:group-hover:scale-105"
              />
            ) : null}
          </div>
        ) : !item.isStudio && showImage ? (
          loadImage ? (
            <img
              src={item.image}
              alt={item.name}
              onError={() => setImgError(true)}
              className="size-full object-cover object-top motion-safe:transition-transform motion-safe:duration-500 [@media(hover:hover)]:group-hover:scale-105"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="size-full bg-[#0d0c16]" />
          )
        ) : (
          <div className="flex size-full flex-col items-center justify-center bg-gradient-to-b from-[#18132d] to-[#0c0a15] p-2.5 text-center">
            <span className="font-display text-xl sm:text-2xl font-black text-purple-400/80">
              {item.name.charAt(0).toUpperCase()}
            </span>
            <span className="mt-1 text-[8.5px] sm:text-[9.5px] text-zinc-500 uppercase tracking-widest font-medium">
              {item.isStudio ? "Estúdio" : "Equipe"}
            </span>
          </div>
        )}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#100e1b] via-transparent to-black/20 opacity-60" />
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

  const { limit: visibleImgLimit, advance: advanceImgLimit } =
    useHorizontalRailImageLimit(
      railRef,
      recommendations.length,
      132,
      12,
      animeId,
    );

  if (recommendations.length === 0) {
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

        {recommendations.length > 3 && (
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
        id="related-anime-rail"
        ref={railRef}
        className="rail -mx-4 px-4 sm:-mx-6 sm:px-6"
      >
        {recommendations.map((r, index) => (
          <AnimeCard
            key={r.id}
            anime={r}
            showBookmark={false}
            loadImage={index < visibleImgLimit}
          />
        ))}
      </div>
    </section>
  );
});
