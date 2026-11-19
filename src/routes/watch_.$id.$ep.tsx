import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import {
  ChevronLeft,
  ChevronRight,
  EyeOff,
  HeartHandshake,
  Play,
  ShieldAlert,
} from "lucide-react";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { SectionReveal } from "@/components/section-reveal";

const EpisodeCommentsSection = lazy(() =>
  import("@/components/comments/EpisodeCommentsSection").then((mod) => ({
    default: mod.EpisodeCommentsSection ?? mod.default,
  })),
);

import type { VideoItem } from "@/types/video";

const CustomVideoPlayer = lazy(() =>
  import("@/components/player/CustomVideoPlayer").then((mod) => ({
    default: mod.CustomVideoPlayer ?? mod.default,
  })),
);
import { fetchAnimeDetail } from "@/lib/api";
import { anilistImage, getResponsiveCoverAttrs } from "@/lib/image-utils";
import { mergeDetail } from "@/lib/overlay";
import { buildCleanCanonical, buildWatchJsonLd, DEFAULT_OG_IMAGE } from "@/lib/seo";
import { useHikariStore } from "@/lib/store";
import {
  buildResolvedSeasons,
  executeGetCatalogEpisodes,
  getCachedResolvedSeasons,
  getCatalogEpisodes,
  primeCatalogEpisodesCache,
  resolveEpisodes,
} from "@/lib/catalog-episodes";
import {
  isWatchPlayableMediaUrl,
  resolveEpisodePlayerSources,
  resolveEpisodeThumbnailUrl,
  resolvePlayableStreamUrl,
  selectEpisodeForWatch,
} from "@/lib/published-episodes";
import {
  displayTitle,
  type Episode,
  type Season,
} from "@/lib/types";
import {
  ANITUBE22_PROVIDER,
  buildAnitube22PlayerUrl,
  extractAnitube22ExternalId,
  extractAnitube22Lang,
  isAnitube22SourceInput,
  partitionEpisodeSourcesByLang,
  type EpisodeSourceItem,
  type SourceLang,
} from "@/lib/anitube22";
import { cn } from "@/lib/utils";

function parseEpisodeNumber(epStr?: string): number {
  if (!epStr) return 1;
  const match = epStr.match(/ep-(?:\d+-)?(\d+)$/i) || epStr.match(/(\d+)$/);
  return match ? parseInt(match[1], 10) : 1;
}

// Helpers de resolução de stream e validação de mídia são importados de "@/lib/published-episodes"

export const Route = createFileRoute("/watch_/$id/$ep")({
  validateSearch: (
    raw: Record<string, unknown>,
  ): {
    comment?: string;
  } => ({
    comment:
      typeof raw.comment === "string" && raw.comment
        ? raw.comment
        : undefined,
  }),

  beforeLoad: ({ params, search }) => {
    const epNum = parseEpisodeNumber(params.ep);
    const canonicalEp = `ep-${epNum}`;
    if (params.ep !== canonicalEp) {
      throw redirect({
        to: "/watch/$id/$ep",
        params: { id: params.id, ep: canonicalEp },
        search: search.comment ? { comment: search.comment } : undefined,
        statusCode: 301,
      });
    }
  },

  loader: async ({ params }) => {
    if (params.id.startsWith("local-")) {
      return { remote: null, catalogEpisodes: null };
    }

    const [remote, initialCatalogEpisodes] = await Promise.all([
      fetchAnimeDetail({
        data: { id: params.id },
      }),
      (typeof window === "undefined"
        ? executeGetCatalogEpisodes(params.id)
        : getCatalogEpisodes({ data: { animeId: params.id } })
      ).catch(() => null),
    ]);

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

    return { remote, catalogEpisodes };
  },

  head: ({ params, loaderData }) => {
    const remote = loaderData?.remote;
    const catalogEpisodes = loaderData?.catalogEpisodes;
    const epNum = parseEpisodeNumber(params.ep);

    const animeTitle =
      (remote ? displayTitle(remote) || remote.titles?.romaji || remote.titles?.english : null) ||
      "Anime";
    const pageTitle = `Episódio ${epNum} — ${animeTitle} — HIKARI`;
    const description = `Assista ao episódio ${epNum} de ${animeTitle} online.`;
    const canonicalUrl = buildCleanCanonical(`/watch/${params.id}/ep-${epNum}`);
    const coverImageExtraLarge =
      (remote as { coverImage?: { extraLarge?: string } })?.coverImage?.extraLarge ||
      remote?.cover ||
      DEFAULT_OG_IMAGE;

    const targetCatalogEp =
      catalogEpisodes?.episodes?.find((e) => e.number === epNum);
    const remoteEps = (remote?.seasons ?? []).flatMap((s) => s.episodes ?? []);
    const targetRemoteEp =
      remoteEps.find((e) => e.number === epNum);

    const streamCandidates = [
      targetCatalogEp?.videoUrl,
      targetCatalogEp?.videoUrl2,
      targetCatalogEp?.videoUrl3,
      targetCatalogEp?.videoUrl4,
      targetCatalogEp?.videoUrl5,
      targetRemoteEp?.videoUrl,
      targetRemoteEp?.videoUrl2,
      targetRemoteEp?.videoUrl3,
      targetRemoteEp?.videoUrl4,
      targetRemoteEp?.videoUrl5,
    ];

    const externalOriginSet = new Set<string>();
    for (const rawCandidate of streamCandidates) {
      if (!rawCandidate || !isWatchPlayableMediaUrl(rawCandidate)) continue;
      if (isAnitube22SourceInput(rawCandidate)) {
        externalOriginSet.add("https://www.anitube22.vip");
        externalOriginSet.add("https://173fe263eae04670ecfcebf237fd6480.r2.cloudflarestorage.com");
        continue;
      }
      const resolvedUrl = resolvePlayableStreamUrl(rawCandidate);
      if (!resolvedUrl) continue;
      try {
        const parsed = new URL(resolvedUrl);
        if (parsed.protocol === "https:" || parsed.protocol === "http:") {
          externalOriginSet.add(parsed.origin);
        }
      } catch {
        // ignora URL inválida
      }
    }

    const rawPoster =
      targetCatalogEp?.thumbnail?.trim() ||
      targetRemoteEp?.thumbnail?.trim() ||
      remote?.banner?.trim() ||
      remote?.cover?.trim() ||
      "";
    if (rawPoster) {
      const optimizedPoster = anilistImage(rawPoster, 1280);
      try {
        const posterOrigin = new URL(optimizedPoster).origin;
        if (posterOrigin !== "https://s4.anilist.co") {
          externalOriginSet.add(posterOrigin);
        }
      } catch {
        // ignora URL relativa
      }
    }

    const preconnectLinks = Array.from(externalOriginSet).flatMap((origin) => [
      { rel: "preconnect", href: origin },
      { rel: "dns-prefetch", href: origin },
    ]);

    const meta = [
      { title: pageTitle },
      { name: "description", content: description },
      { property: "og:title", content: pageTitle },
      { property: "og:description", content: description },
      { property: "og:image", content: coverImageExtraLarge },
      { property: "og:url", content: canonicalUrl },
      { property: "og:type", content: "video.tv_show" },
      { property: "og:locale", content: "pt_BR" },
      { property: "og:site_name", content: "HIKARI" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: pageTitle },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: coverImageExtraLarge },
    ];

    const jsonLd = buildWatchJsonLd({
      animeId: params.id,
      animeTitle,
      episodeNumber: epNum,
      image: coverImageExtraLarge,
      description,
    });

    return {
      links: [
        ...preconnectLinks,
        {
          rel: "canonical",
          href: canonicalUrl,
        },
      ],
      meta,
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify(jsonLd),
        },
      ],
    };
  },

  component: WatchPage,
});

function WatchPage() {
  const { id, ep } = Route.useParams();
  const navigate = useNavigate();
  const targetEpNum = parseEpisodeNumber(ep);

  const [playerMounted, setPlayerMounted] = useState(false);
  const [triggeredPlayEpisodeId, setTriggeredPlayEpisodeId] = useState<string | null>(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [playTimestamp, setPlayTimestamp] = useState<number>(() => Math.floor(Date.now() / 1000));
  const [iframeReloadKey, setIframeReloadKey] = useState<number>(0);
  const [iframeLoadError, setIframeLoadError] = useState<boolean>(false);
  const currentEpisodeIdRef = useRef<string | undefined>(undefined);

  const handleActivatePlayer = useCallback(() => {
    if (currentEpisodeIdRef.current) {
      setTriggeredPlayEpisodeId(currentEpisodeIdRef.current);
    }
    setPlayTimestamp(Math.floor(Date.now() / 1000));
    setIframeLoadError(false);
    setPlayerMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || playerMounted) return;
    const win = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    let idleId: number | null = null;
    let timerId: number | null = null;

    if (typeof win.requestIdleCallback === "function") {
      idleId = win.requestIdleCallback(
        () => {
          setPlayerMounted(true);
        },
        { timeout: 3000 },
      );
    } else {
      timerId = window.setTimeout(() => {
        setPlayerMounted(true);
      }, 3000);
    }

    return () => {
      if (idleId !== null && typeof win.cancelIdleCallback === "function") {
        win.cancelIdleCallback(idleId);
      }
      if (timerId !== null) {
        window.clearTimeout(timerId);
      }
    };
  }, [playerMounted]);

  const {
    comment: commentQuery,
  } = Route.useSearch();

  const { remote, catalogEpisodes } = Route.useLoaderData();

  const locals = useHikariStore((s) => s.animes);
  const hydrated = useHikariStore((s) => s.hydrated);

  const markContinue = useHikariStore(
    (s) => s.markContinue,
  );

  const baseAnime = useMemo(
    () => mergeDetail(remote, id, locals),
    [remote, id, locals],
  );

  const episodeCatalogId = baseAnime?.serverCatalogId || baseAnime?.id || id;

  const [resolvedSeasons, setResolvedSeasons] = useState<Season[] | null>(() => {
    if (catalogEpisodes) {
      const cacheKey = catalogEpisodes.animeId || episodeCatalogId;
      if (typeof window !== "undefined") {
        primeCatalogEpisodesCache(cacheKey, catalogEpisodes);
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
      setResolvedSeasons(seasons);
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

  const episodes = useMemo(() => {
    if (!anime) {
      return [] as Episode[];
    }

    return (anime.seasons ?? []).flatMap(
      (s) => s.episodes ?? [],
    );
  }, [anime]);

  const current = useMemo(
    () => selectEpisodeForWatch(episodes, ep, targetEpNum),
    [episodes, ep, targetEpNum],
  );

  currentEpisodeIdRef.current = current?.id;
  const userTriggeredPlay = Boolean(current?.id && triggeredPlayEpisodeId === current.id);

  const idx = current
    ? episodes.findIndex(
        (e) => e.id === current.id,
      )
    : -1;

  const prev =
    idx > 0
      ? episodes[idx - 1]
      : null;

  const next =
    idx >= 0 &&
    idx < episodes.length - 1
      ? episodes[idx + 1]
      : null;

  useEffect(() => {
    if (!anime || !current) {
      return;
    }

    markContinue({
      animeId: anime.id,
      episodeId: current.id,
      episodeNumber: current.number,
      episodeTitle: current.title,
      cover:
        resolveEpisodeThumbnailUrl(current) ||
        anime.cover,
      title: displayTitle(anime),
      updatedAt: Date.now(),
    });
  }, [
    anime?.id,
    current?.id,
  ]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
  }, [id, ep]);

  const title = anime
    ? displayTitle(anime)
    : "";

  const [dbSources, setDbSources] = useState<EpisodeSourceItem[]>([]);
  const [dbSourcesLoadedForId, setDbSourcesLoadedForId] = useState<string | null>(null);
  const [selectedLang, setSelectedLang] = useState<SourceLang>("sub");
  const [failedSessionKeys, setFailedSessionKeys] = useState<string[]>([]);
  const checkedDbSourceIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const episodeId = current?.id;
    setFailedSessionKeys([]);
    setIframeLoadError(false);
    setPlayTimestamp(Math.floor(Date.now() / 1000));
    setIframeReloadKey((prev) => prev + 1);
    checkedDbSourceIdsRef.current.clear();

    if (!episodeId || typeof window === "undefined") {
      setDbSources([]);
      setDbSourcesLoadedForId(episodeId ?? null);
      return;
    }

    let cancelled = false;
    void fetch(`/api/episode-sources?episodeId=${encodeURIComponent(episodeId)}&includeBroken=1`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { ok?: boolean; sources?: EpisodeSourceItem[] } | null) => {
        if (cancelled) return;
        if (data?.ok && Array.isArray(data.sources)) {
          setDbSources(data.sources);
        } else {
          setDbSources([]);
        }
        setDbSourcesLoadedForId(episodeId);
      })
      .catch(() => {
        if (!cancelled) {
          setDbSources([]);
          setDbSourcesLoadedForId(episodeId);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [current?.id]);

  // Mapeamento dinâmico: combina fontes duráveis da tabela episode_sources e slots Player 1..5,
  // mantendo listas de prioridade independentes para sub e dub (menor prioridade primeiro)
  const playerSources = useMemo(
    () => resolveEpisodePlayerSources(current),
    [current],
  );

  type WatchSourceEntry = {
    key: string;
    dbSourceId?: string;
    provider: string;
    externalId?: string;
    lang: SourceLang;
    quality?: string | null;
    priority: number;
    isIframe: boolean;
    staticUrl?: string;
    name: string;
  };

  const sourcesByLang = useMemo(() => {
    const subList: WatchSourceEntry[] = [];
    const dubList: WatchSourceEntry[] = [];
    const trackedAnitubeKeys = new Set<string>();

    const relevantDbSources =
      current?.id && dbSourcesLoadedForId === current.id ? dbSources : [];

    for (const s of relevantDbSources) {
      if (s.provider === ANITUBE22_PROVIDER && s.externalId) {
        trackedAnitubeKeys.add(`${s.lang}:${s.externalId}`);
      }
    }

    const activePartition = partitionEpisodeSourcesByLang(relevantDbSources);
    for (const langKey of ["sub", "dub"] as const) {
      const targetList = langKey === "sub" ? subList : dubList;
      activePartition[langKey].forEach((s, index) => {
        if (s.provider === ANITUBE22_PROVIDER && s.externalId) {
          targetList.push({
            key: `db:${s.id}`,
            dbSourceId: s.id,
            provider: s.provider,
            externalId: s.externalId,
            lang: s.lang,
            quality: s.quality,
            priority: s.priority,
            isIframe: true,
            name: s.quality ? `Fonte ${index + 1} (${s.quality})` : `Fonte ${index + 1}`,
          });
        }
      });
    }

    if (current) {
      const rawSlots = [
        { id: "player-1", raw: current.videoUrl, label: "Player 1" },
        { id: "player-2", raw: current.videoUrl2, label: "Player 2" },
        { id: "player-3", raw: current.videoUrl3, label: "Player 3" },
        { id: "player-4", raw: current.videoUrl4, label: "Player 4" },
        { id: "player-5", raw: current.videoUrl5, label: "Player 5" },
      ];

      rawSlots.forEach((slot, idx) => {
        if (!slot.raw) return;
        const extId = extractAnitube22ExternalId(slot.raw);
        if (extId) {
          const lang = extractAnitube22Lang(slot.raw);
          if (trackedAnitubeKeys.has(`${lang}:${extId}`)) {
            return;
          }
          trackedAnitubeKeys.add(`${lang}:${extId}`);
          const entry: WatchSourceEntry = {
            key: `slot:${slot.id}:${lang}:${extId}`,
            provider: ANITUBE22_PROVIDER,
            externalId: extId,
            lang,
            priority: idx,
            isIframe: true,
            name: slot.label,
          };
          if (lang === "dub") dubList.push(entry);
          else subList.push(entry);
          return;
        }

        if (isWatchPlayableMediaUrl(slot.raw)) {
          const resolved = resolvePlayableStreamUrl(slot.raw);
          if (resolved) {
            subList.push({
              key: slot.id,
              provider: "direct",
              lang: "sub",
              priority: 100 + idx,
              isIframe: false,
              staticUrl: resolved,
              name: slot.label,
            });
          }
        }
      });
    }

    subList.sort((a, b) => a.priority - b.priority);
    dubList.sort((a, b) => a.priority - b.priority);

    return { sub: subList, dub: dubList };
  }, [current, dbSources, dbSourcesLoadedForId]);

  useEffect(() => {
    if (selectedLang === "dub" && sourcesByLang.dub.length === 0 && sourcesByLang.sub.length > 0) {
      setSelectedLang("sub");
    } else if (selectedLang === "sub" && sourcesByLang.sub.length === 0 && sourcesByLang.dub.length > 0) {
      setSelectedLang("dub");
    }
  }, [selectedLang, sourcesByLang.sub.length, sourcesByLang.dub.length]);

  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("player-1");
  const lastEpisodeIdRef = useRef<string | undefined>(current?.id);
  const livePlaybackRef = useRef<{ episodeId: string; time: number }>({
    episodeId: current?.id ?? "",
    time: 0,
  });
  const [sessionTime, setSessionTime] = useState<{
    episodeId: string;
    time: number;
  } | null>(null);

  // Chave de armazenamento para troca de player sem bloquear abertura
  const progressStorageKey =
    anime && current
      ? `hikari_progress_${anime.id}_${current.id}`
      : null;

  const effectiveInitialTime =
    sessionTime && sessionTime.episodeId === current?.id && sessionTime.time > 0
      ? sessionTime.time
      : 0;

  const hasRestoredRef = useRef<boolean>(true);
  const lastSavedTimeRef = useRef<number>(0);

  useEffect(() => {
    setIsVideoPlaying(false);
  }, [current?.id, anime?.id]);

  useEffect(() => {
    if (current?.id !== lastEpisodeIdRef.current) {
      if (
        lastEpisodeIdRef.current &&
        anime &&
        livePlaybackRef.current.episodeId === lastEpisodeIdRef.current &&
        livePlaybackRef.current.time > 0
      ) {
        try {
          localStorage.setItem(
            `hikari_progress_${anime.id}_${lastEpisodeIdRef.current}`,
            String(Math.floor(livePlaybackRef.current.time)),
          );
        } catch {
          /* ignore storage error */
        }
      }

      lastEpisodeIdRef.current = current?.id;
      const defaultId = playerSources[0]?.id ?? "player-1";
      setSelectedPlayerId(defaultId);
      livePlaybackRef.current = { episodeId: current?.id ?? "", time: 0 };
      setSessionTime(null);
      hasRestoredRef.current = true;
      lastSavedTimeRef.current = 0;
    }
  }, [current?.id, anime, playerSources]);

  useEffect(() => {
    const handleUnloadOrHide = () => {
      if (!current?.id || !progressStorageKey) return;
      const live = livePlaybackRef.current;
      if (live.episodeId === current.id && live.time > 0) {
        try {
          localStorage.setItem(
            progressStorageKey,
            String(Math.floor(live.time)),
          );
        } catch {
          /* ignore storage error */
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        handleUnloadOrHide();
      }
    };

    window.addEventListener("beforeunload", handleUnloadOrHide);
    window.addEventListener("pagehide", handleUnloadOrHide);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("beforeunload", handleUnloadOrHide);
      window.removeEventListener("pagehide", handleUnloadOrHide);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [current?.id, progressStorageKey]);

  const handleRestored = useCallback(
    (time: number) => {
      hasRestoredRef.current = true;
      lastSavedTimeRef.current = time;
      if (current?.id) {
        livePlaybackRef.current = { episodeId: current.id, time };
      }
    },
    [current?.id],
  );

  const handlePlay = useCallback(() => {
    setIsVideoPlaying(true);
    if (current?.id) {
      setTriggeredPlayEpisodeId((prevId) => (prevId === current.id ? prevId : current.id));
    }
  }, [current?.id]);

  const handlePlaying = useCallback(() => {
    setIsVideoPlaying(true);
  }, []);

  const handleSeeking = useCallback(() => {
    setIsVideoPlaying(false);
  }, []);

  const handleSeeked = useCallback(() => {}, []);

  const handleWaiting = useCallback(() => {
    setIsVideoPlaying(false);
  }, []);

  const handleTimeUpdate = useCallback(
    (time: number, totalDuration: number) => {
      if (!current?.id || !progressStorageKey || totalDuration <= 0) return;

      if (!hasRestoredRef.current && effectiveInitialTime > 0) {
        if (
          Math.abs(time - effectiveInitialTime) <= 4 ||
          time >= effectiveInitialTime
        ) {
          hasRestoredRef.current = true;
          lastSavedTimeRef.current = time;
        } else {
          return;
        }
      }

      if (time > 0) {
        livePlaybackRef.current = { episodeId: current.id, time };
      }
    },
    [progressStorageKey, current?.id, effectiveInitialTime],
  );

  const handlePause = useCallback(
    (time: number, totalDuration: number) => {
      setIsVideoPlaying(false);
      if (!current?.id || !progressStorageKey || totalDuration <= 0) return;

      if (time > 0) {
        livePlaybackRef.current = { episodeId: current.id, time };
      }
    },
    [current?.id, progressStorageKey],
  );

  const handleSelectPlayer = useCallback(
    (targetId: string) => {
      if (targetId === selectedPlayerId) return;
      setIsVideoPlaying(false);

      const hasValidLiveTime =
        current?.id &&
        livePlaybackRef.current.episodeId === current.id &&
        livePlaybackRef.current.time > 0;

      const currentTimeToCarry = hasValidLiveTime
        ? livePlaybackRef.current.time
        : 0;

      if (currentTimeToCarry > 0 && current?.id) {
        hasRestoredRef.current = false;
        setSessionTime({ episodeId: current.id, time: currentTimeToCarry });
        if (progressStorageKey) {
          try {
            localStorage.setItem(
              progressStorageKey,
              String(Math.floor(currentTimeToCarry)),
            );
            lastSavedTimeRef.current = currentTimeToCarry;
          } catch {
            // ignora falha de storage
          }
        }
      }

      setSelectedPlayerId(targetId);
    },
    [selectedPlayerId, progressStorageKey, current?.id],
  );

  const handleNextEpisode = useCallback(() => {
    if (next && anime) {
      void navigate({
        to: "/watch/$id/$ep",
        replace: true,
        params: { id: anime.id, ep: `ep-${next.number}` },
      });
    }
  }, [next, navigate, anime]);

  const handleEnded = useCallback(() => {
    setIsVideoPlaying(false);
    if (progressStorageKey) {
      try {
        localStorage.removeItem(progressStorageKey);
      } catch (err) {
        void err;
      }
    }
    livePlaybackRef.current = { episodeId: "", time: 0 };
    setSessionTime(null);
    handleNextEpisode();
  }, [progressStorageKey, handleNextEpisode]);

  const activeLangSources = useMemo(
    () => (selectedLang === "dub" ? sourcesByLang.dub : sourcesByLang.sub),
    [selectedLang, sourcesByLang],
  );

  const availableLangSources = useMemo(() => {
    const filtered = activeLangSources.filter((s) => !failedSessionKeys.includes(s.key));
    return filtered.length > 0 ? filtered : activeLangSources;
  }, [activeLangSources, failedSessionKeys]);

  const selectedWatchSource = useMemo(() => {
    return (
      availableLangSources.find((s) => s.key === selectedPlayerId) ??
      availableLangSources[0] ??
      undefined
    );
  }, [availableLangSources, selectedPlayerId]);

  const selectedPlayer = useMemo(() => {
    if (selectedWatchSource) {
      return {
        id: selectedWatchSource.key,
        name: selectedWatchSource.name,
        url:
          selectedWatchSource.provider === ANITUBE22_PROVIDER && selectedWatchSource.externalId
            ? buildAnitube22PlayerUrl(selectedWatchSource.externalId, playTimestamp)
            : selectedWatchSource.staticUrl || "",
      };
    }
    return playerSources.find((s) => s.id === selectedPlayerId) ?? playerSources[0] ?? undefined;
  }, [selectedWatchSource, playTimestamp, playerSources, selectedPlayerId]);

  const playUrl = selectedPlayer?.url ?? "";
  const file = playUrl || null;

  const handleReloadSource = useCallback(() => {
    setIframeLoadError(false);
    setPlayTimestamp(Math.floor(Date.now() / 1000));
    setIframeReloadKey((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (!playerMounted || !selectedWatchSource?.dbSourceId) return;
    const dbSourceId = selectedWatchSource.dbSourceId;
    if (checkedDbSourceIdsRef.current.has(dbSourceId)) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;

    checkedDbSourceIdsRef.current.add(dbSourceId);
    let cancelled = false;

    void fetch("/api/episode-sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "check",
        sourceId: dbSourceId,
        clientOffline: false,
      }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then(
        (
          data: {
            ok?: boolean;
            httpStatus?: number | null;
            clientNetworkError?: boolean;
          } | null,
        ) => {
          if (cancelled || !data) return;
          if (
            !data.ok &&
            !data.clientNetworkError &&
            typeof data.httpStatus === "number" &&
            data.httpStatus >= 400
          ) {
            const remaining = activeLangSources.filter(
              (s) => s.key !== selectedWatchSource.key && !failedSessionKeys.includes(s.key),
            );
            setFailedSessionKeys((prev) =>
              prev.includes(selectedWatchSource.key) ? prev : [...prev, selectedWatchSource.key],
            );
            if (remaining.length > 0) {
              setSelectedPlayerId(remaining[0].key);
              setPlayTimestamp(Math.floor(Date.now() / 1000));
            } else {
              setIframeLoadError(true);
            }
          }
        },
      )
      .catch(() => {
        // Erro de rede do cliente: nunca marca como quebrada
      });

    return () => {
      cancelled = true;
    };
  }, [playerMounted, selectedWatchSource, activeLangSources, failedSessionKeys]);

  function parseDurationToSeconds(raw?: string | number | null): number {
    if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return Math.floor(raw);
    if (!raw || typeof raw !== "string") return 0;
    const trimmed = raw.trim().toLowerCase();

    if (trimmed.includes(":")) {
      const parts = trimmed.split(":").map(Number);
      if (parts.every((p) => !isNaN(p))) {
        if (parts.length === 2) return parts[0] * 60 + parts[1];
        if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
      }
    }

    const minMatch = trimmed.match(/^(\d+)\s*(?:min|m)$/);
    if (minMatch) return parseInt(minMatch[1], 10) * 60;

    const numOnly = parseInt(trimmed, 10);
    if (!isNaN(numOnly) && numOnly > 0) return numOnly;

    return 0;
  }

  const playerPoster = useMemo(() => {
    const rawPoster =
      resolveEpisodeThumbnailUrl(current) ||
      anime?.banner ||
      anime?.cover ||
      null;
    return rawPoster ? anilistImage(rawPoster, 1280) : null;
  }, [current, anime?.banner, anime?.cover]);

  const _currentVideoItem = useMemo((): VideoItem | undefined => {
    if (!current || !file) return undefined;
    const initialDuration = parseDurationToSeconds(current.duration);
    const episodeTitleStr = current.number
      ? `${title} — Episódio ${current.number}${current.title ? ` · ${current.title}` : ""}`
      : title;

    const isAnitubeIframe = Boolean(
      selectedWatchSource?.isIframe ||
        selectedWatchSource?.provider === ANITUBE22_PROVIDER,
    );

    const mins = Math.floor(initialDuration / 60).toString().padStart(2, "0");
    const secs = (initialDuration % 60).toString().padStart(2, "0");
    const possibleIframe = isAnitubeIframe
      ? file
      : current.videoUrl2 ||
        current.videoUrl3 ||
        current.videoUrl4 ||
        (file && file.includes("maximaimg.online")
          ? (() => {
              try {
                const parsed = new URL(file, "http://localhost");
                const target = parsed.searchParams.get("u") || file;
                return `https://api.anivideo.net/videohls.php?d=${encodeURIComponent(target)}`;
              } catch {
                return `https://api.anivideo.net/videohls.php?d=${encodeURIComponent(file)}`;
              }
            })()
          : undefined);

    return {
      id: current.id,
      title: episodeTitleStr,
      description: anime?.synopsis || current.title || "Episódio disponível no Hikari",
      duration: initialDuration,
      durationFormatted: initialDuration > 0 ? `${mins}:${secs}` : "00:00",
      category: "Treinamentos & Tutoriais",
      tags: [title, `Episódio ${current.number}`].filter(Boolean),
      posterUrl: playerPoster || "",
      videoUrl: file,
      url: file,
      iframeUrl: possibleIframe,
      isIframe: isAnitubeIframe,
      thumbnailUrl: playerPoster || undefined,
      episodeNumber: current.number,
      episodeTitle: current.title,
      playerLabel: selectedPlayer?.name || "Player 1",
      isDemo: false,
      isLocalFile: false,
      createdAt: new Date().toISOString(),
      resolution: "N/D",
      uploadStatus: "pronto",
      subtitles: [
        { id: "sub-pt", lang: "pt", label: "Português (Brasil)" },
        { id: "sub-en", lang: "en", label: "Inglês (Original)" },
      ],
    };
  }, [current, file, title, playerPoster, anime?.synopsis, selectedPlayer?.name, selectedWatchSource?.isIframe, selectedWatchSource?.provider]);

  const handlePlayerError = useCallback(() => {
    setIsVideoPlaying(false);
    if (!selectedPlayer) return;
    const alt = availableLangSources.find((s) => s.key !== selectedPlayer.id);
    if (alt) {
      setFailedSessionKeys((prev) =>
        prev.includes(selectedPlayer.id) ? prev : [...prev, selectedPlayer.id],
      );
      handleSelectPlayer(alt.key);
      return;
    }
    setIframeLoadError(true);
  }, [availableLangSources, selectedPlayer, handleSelectPlayer]);

  if (!hydrated && !anime) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-bg text-fg">
        <div className="flex flex-col items-center justify-center gap-3">
          <div
            className="size-8 animate-spin rounded-full border-2 border-white/10 border-t-[#a855f7]"
            aria-label="Carregando"
          />
          <span className="text-sm text-white/50">
            Carregando...
          </span>
        </div>
      </main>
    );
  }

  if (!anime) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-bg text-fg">
        <div className="flex flex-col items-center justify-center gap-3">
          <div
            className="size-8 animate-spin rounded-full border-2 border-white/10 border-t-[#a855f7]"
            aria-label="Carregando"
          />
          <span className="text-sm text-white/50">
            Carregando...
          </span>
        </div>
      </main>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-fg">

      {/* ================================================== */}
      {/* CABEÇALHO */}
      {/* ================================================== */}

      <header className="flex h-14 sm:h-16 items-center px-4 sm:px-6 border-b border-white/[0.06] bg-bg/80 backdrop-blur-md sticky top-0 z-40">
        <Logo />
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-3 pb-12 sm:px-5">

        {/* ================================================== */}
        {/* PLAYER */}
        {/* ================================================== */}

        {file && selectedPlayer && current ? (
          playerMounted ? (
            <Suspense
              fallback={
                <PlayerLoadingFallback
                  posterUrl={playerPoster}
                  title={
                    current.number
                      ? `${title} — Episódio ${current.number}`
                      : title
                  }
                />
              }
            >
              <CustomVideoPlayer
                key={`${anime.id}-${current.id}-${selectedPlayer.id}`}
                video={_currentVideoItem}
                autoPlay={userTriggeredPlay}
                initialTime={effectiveInitialTime}
                onPlay={handlePlay}
                onPlaying={handlePlaying}
                onSeeking={handleSeeking}
                onSeeked={handleSeeked}
                onWaiting={handleWaiting}
                onTimeUpdate={handleTimeUpdate}
                onPause={handlePause}
                onRestored={handleRestored}
                onEnded={handleEnded}
                onError={handlePlayerError}
                iframeFallbackUrl={_currentVideoItem?.iframeUrl}
                onReloadSource={handleReloadSource}
                iframeLoadError={iframeLoadError}
                onIframeError={() => setIframeLoadError(true)}
                iframeReloadKey={`${playTimestamp}-${iframeReloadKey}`}
                onFallbackToIframe={() => {
                  const alt = availableLangSources.find((s) => s.key !== selectedPlayer.id);
                  if (alt) {
                    handleSelectPlayer(alt.key);
                  }
                }}
              />
            </Suspense>
          ) : (
            <button
              type="button"
              onClick={handleActivatePlayer}
              aria-label={
                current.number
                  ? `Reproduzir ${title} — Episódio ${current.number}`
                  : `Reproduzir ${title}`
              }
              className="relative block aspect-video min-h-[240px] md:min-h-[520px] w-full overflow-hidden rounded-2xl border border-white/10 bg-black shadow-[0_20px_70px_rgba(0,0,0,0.45)] cursor-pointer group select-none text-left outline-none focus-visible:outline-none"
            >
              {playerPoster ? (
                <img
                  src={playerPoster}
                  alt={current.number ? `${title} — Episódio ${current.number}` : title}
                  width={1280}
                  height={720}
                  loading="eager"
                  fetchPriority="high"
                  decoding="sync"
                  className="absolute inset-0 size-full object-cover select-none"
                />
              ) : (
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-br from-[#141024] via-[#0a0812] to-black"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/35" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex size-16 sm:size-20 items-center justify-center rounded-full bg-purple-600/90 group-hover:bg-purple-500 text-white border border-white/20 backdrop-blur-md shadow-[0_12px_36px_rgba(168,85,247,0.45)] transition-all duration-200 group-hover:scale-105 group-active:scale-95">
                  <Play className="size-7 sm:size-9 fill-current translate-x-0.5" />
                </div>
              </div>
            </button>
          )
        ) : (
          <div className="relative aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black shadow-[0_20px_70px_rgba(0,0,0,0.45)]">
            <div className="flex size-full flex-col items-center justify-center gap-3 px-6 text-center">
              <p className="font-display text-2xl">
                Sem vídeo neste episódio
              </p>
              <p className="max-w-md text-sm text-muted">
                Adicione uma URL de vídeo válida no Admin para reproduzir este
                episódio.
              </p>
              <Button
                asChild
                variant="outline"
              >
                <Link
                  to="/admin/$id"
                  params={{
                    id: anime.id.startsWith(
                      "local-",
                    )
                      ? anime.id
                      : "new",
                  }}
                  search={{
                    importId: anime.id,
                  }}
                >
                  Abrir Admin
                </Link>
              </Button>
            </div>
          </div>
        )}

        {(sourcesByLang.dub.length > 0 || availableLangSources.length > 1) && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#0e0c16]/90 px-3 py-2">
            {(sourcesByLang.sub.length > 0 && sourcesByLang.dub.length > 0) ? (
              <div className="flex items-center gap-1.5" role="group" aria-label="Idioma">
                {(["sub", "dub"] as const).map((langOption) => (
                  <button
                    key={langOption}
                    type="button"
                    onClick={() => {
                      setSelectedLang(langOption);
                      const firstForLang = (
                        langOption === "dub" ? sourcesByLang.dub : sourcesByLang.sub
                      )[0];
                      if (firstForLang) {
                        setSelectedPlayerId(firstForLang.key);
                      }
                      setIframeLoadError(false);
                      setPlayTimestamp(Math.floor(Date.now() / 1000));
                    }}
                    className={cn(
                      "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                      selectedLang === langOption
                        ? "bg-purple-600 text-white"
                        : "bg-white/[0.04] text-white/70 hover:bg-white/[0.1] hover:text-white",
                    )}
                  >
                    {langOption === "sub" ? "Legendado" : "Dublado"}
                  </button>
                ))}
              </div>
            ) : (
              <div />
            )}

            {availableLangSources.length > 1 && (
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Fontes de vídeo">
                {availableLangSources.map((src) => (
                  <button
                    key={src.key}
                    type="button"
                    onClick={() => {
                      handleSelectPlayer(src.key);
                      setIframeLoadError(false);
                      setPlayTimestamp(Math.floor(Date.now() / 1000));
                    }}
                    className={cn(
                      "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                      selectedPlayer?.id === src.key
                        ? "bg-purple-600 text-white"
                        : "bg-white/[0.04] text-white/70 hover:bg-white/[0.1] hover:text-white",
                    )}
                  >
                    {src.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================================================== */}
        {/* INFORMAÇÕES DO ANIME (ABAIXO DO PLAYER)           */}
        {/* ================================================== */}

        <section className="mt-4 flex items-center gap-3 sm:gap-3.5 rounded-none border border-white/10 bg-[#0e0c16]/95 p-2.5 sm:p-3 backdrop-blur-md shadow-sm">
          <Link
            to="/anime/$id"
            params={{ id: anime.id }}
            className="group relative block aspect-[2/3] w-14 sm:w-16 shrink-0 overflow-hidden rounded-none border border-white/15 bg-elevated transition-transform hover:scale-[1.02]"
            aria-label={title}
          >
            {anime.cover ? (() => {
              const infoCoverAttrs = getResponsiveCoverAttrs(
                anime.cover,
                "thumb",
              );
              return (
                <img
                  src={infoCoverAttrs.src}
                  srcSet={infoCoverAttrs.srcSet}
                  sizes="(min-width: 640px) 64px, 56px"
                  alt={title}
                  width={64}
                  height={96}
                  className="size-full object-cover rounded-none transition-transform duration-200 group-hover:scale-105"
                  loading="lazy"
                  fetchPriority="low"
                  decoding="async"
                />
              );
            })() : (
              <div className="size-full bg-elevated rounded-none flex items-center justify-center text-white/30 text-[10px]">
                Sem Capa
              </div>
            )}
          </Link>

          <div className="min-w-0 flex-1">
            <h1 className="font-sans text-base sm:text-lg font-bold tracking-tight leading-snug text-white truncate">
              <Link
                to="/anime/$id"
                params={{ id: anime.id }}
                className="transition-colors hover:text-[#c084fc]"
              >
                {title}
              </Link>
            </h1>

            <div className="mt-1 flex items-center gap-2 text-xs sm:text-[13px] text-white/60">
              <span
                className="relative flex size-2 shrink-0 items-center justify-center"
                aria-hidden="true"
                title={isVideoPlaying ? "Em reprodução" : "Pausado"}
              >
                {isVideoPlaying && (
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                )}
                <span
                  className={cn(
                    "relative inline-flex size-2 rounded-full transition-all duration-300",
                    isVideoPlaying
                      ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.85)] animate-pulse"
                      : "bg-emerald-500/40 border border-emerald-400/30",
                  )}
                />
              </span>
              <span className="truncate font-medium">
                {current
                  ? `Episódio ${current.number}${current.title ? ` · ${current.title}` : ""}`
                  : `Episódio ${targetEpNum}`}
              </span>
            </div>
          </div>
        </section>

        {/* ================================================== */}
        {/* NAVEGAÇÃO DOS EPISÓDIOS                           */}
        {/* ================================================== */}

        <div className="mt-3.5 flex items-center justify-between gap-1.5 sm:gap-3 rounded-2xl border border-white/10 bg-[#131317]/80 p-2 sm:p-2.5 backdrop-blur-md">
          {prev ? (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="flex-1 min-w-0 rounded-xl border-white/10 bg-white/[0.03] px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium text-white/90 hover:bg-white/[0.08] hover:text-white hover:border-[#a855f7]/40 active:scale-95 transition-all"
            >
              <Link
                to="/watch/$id/$ep"
                replace
                params={{ id: anime.id, ep: `ep-${prev.number}` }}
              >
                <ChevronLeft className="size-4 mr-1 shrink-0 text-white/70" />
                <span className="truncate">Episódio anterior</span>
              </Link>
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled
              className="flex-1 min-w-0 rounded-xl border-white/5 bg-white/[0.01] px-2 sm:px-4 py-2 text-xs sm:text-sm text-white/30 cursor-not-allowed"
            >
              <ChevronLeft className="size-4 mr-1 shrink-0" />
              <span className="truncate">Episódio anterior</span>
            </Button>
          )}

          <Button
            asChild
            variant="outline"
            size="sm"
            className="shrink-0 w-10 sm:w-12 h-9 sm:h-10 rounded-xl border-[#a855f7]/40 bg-[#a855f7]/15 p-0 flex items-center justify-center text-lg sm:text-xl font-bold text-[#c084fc] hover:bg-[#a855f7]/25 hover:border-[#a855f7]/60 active:scale-95 transition-all shadow-[0_0_15px_rgba(168,85,247,0.15)]"
          >
            <Link
              to="/anime/$id"
              params={{ id: anime.id }}
              className="flex size-full items-center justify-center text-center font-bold leading-none select-none"
              aria-label="Ver detalhes do anime"
              title="Ver detalhes do anime"
            >
              =
            </Link>
          </Button>

          {next ? (
            <Button
              asChild
              size="sm"
              className="flex-1 min-w-0 rounded-xl border border-transparent bg-white/10 px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium text-white hover:bg-[#a855f7] hover:shadow-[0_0_20px_rgba(168,85,247,0.3)] active:scale-95 transition-all"
            >
              <Link
                to="/watch/$id/$ep"
                replace
                params={{ id: anime.id, ep: `ep-${next.number}` }}
              >
                <span className="truncate">Próximo episódio</span>
                <ChevronRight className="size-4 ml-1 shrink-0 text-white/70" />
              </Link>
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              disabled
              className="flex-1 min-w-0 rounded-xl border-white/5 bg-white/[0.01] px-2 sm:px-4 py-2 text-xs sm:text-sm text-white/30 cursor-not-allowed"
            >
              <span className="truncate">Próximo episódio</span>
              <ChevronRight className="size-4 ml-1 shrink-0" />
            </Button>
          )}
        </div>

        {/* ================================================== */}
        {/* AVISO ANTES DOS COMENTÁRIOS                        */}
        {/* ================================================== */}

        <aside
          aria-label="Aviso antes de comentar"
          className="relative mt-4 overflow-hidden rounded-2xl border border-[#a855f7]/25 bg-gradient-to-b from-[#151124]/95 to-[#0f0d18]/95 px-3.5 py-3 sm:px-4 sm:py-3.5 shadow-[0_8px_28px_rgba(0,0,0,0.35)] backdrop-blur-md"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#a855f7]/50 to-transparent"
          />

          <div className="flex items-center gap-2">
            <ShieldAlert
              className="size-4 shrink-0 text-[#c084fc]"
              aria-hidden="true"
            />
            <h2 className="text-xs sm:text-sm font-bold tracking-tight text-white">
              Antes de comentar, atenção!
            </h2>
          </div>

          <p className="mt-2 flex items-start gap-2 text-xs sm:text-[13px] font-medium leading-relaxed text-[#f3e8ff]">
            <EyeOff
              className="mt-[3px] size-3.5 shrink-0 text-[#c084fc]"
              aria-hidden="true"
            />
            <span>
              Os comentários podem conter{" "}
              <strong className="font-semibold text-[#d8b4fe]">
                spoilers deste episódio
              </strong>
              . Se ainda não terminou de assistir, leia com cuidado!
            </span>
          </p>

          <div className="mt-2.5 space-y-1.5 border-t border-[#a855f7]/15 pt-2.5 text-xs leading-relaxed text-zinc-300/90">
            <p>
              Respeite a opinião dos outros, seja gentil com a comunidade e evite ofensas, provocações e discussões desnecessárias.
            </p>
            <p className="flex items-start gap-1.5 font-medium text-[#d8b4fe]/90">
              <HeartHandshake
                className="mt-[3px] size-3.5 shrink-0 text-[#c084fc]"
                aria-hidden="true"
              />
              <span>Vamos manter o Hikari um espaço agradável para todos!</span>
            </p>
          </div>
        </aside>

        {/* ================================================== */}
        {/* COMENTÁRIOS */}
        {/* ================================================== */}

        {current?.id ? (
          <SectionReveal
            key={`${anime.id}-${current.id}`}
            minHeight="300px"
            rootMargin="300px 0px"
            lazy={!commentQuery}
          >
            <Suspense fallback={<CommentsLoadingFallback />}>
              <EpisodeCommentsSection
                key={`${anime.id}-${current.id}`}
                animeId={anime.id}
                episodeId={current.id}
                animeTitle={title}
                episodeNumber={current.number ?? targetEpNum}
                targetCommentId={commentQuery}
              />
            </Suspense>
          </SectionReveal>
        ) : (
          <div className="mt-10 border-t border-purple-500/20 pt-8 text-center text-sm text-zinc-500">
            Selecione um episódio para carregar os comentários.
          </div>
        )}

      </main>
    </div>
  );
}


function PlayerLoadingFallback({
  posterUrl,
  title,
}: {
  posterUrl?: string | null;
  title?: string;
} = {}) {
  return (
    <div
      aria-label="Carregando reprodutor"
      className="relative aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black shadow-[0_20px_70px_rgba(0,0,0,0.45)] flex items-center justify-center select-none"
    >
      {posterUrl ? (
        <>
          <img
            src={posterUrl}
            alt={title ? `Poster de ${title}` : "Miniatura do episódio"}
            className="absolute inset-0 size-full object-cover filter brightness-[0.7]"
            loading="eager"
            decoding="async"
          />
          <div
            className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/40"
            aria-hidden="true"
          />
        </>
      ) : null}

      <div className="relative z-10 flex flex-col items-center justify-center gap-3">
        <div
          className="size-8 animate-spin rounded-full border-2 border-white/20 border-t-[#a855f7] shadow-[0_0_15px_rgba(168,85,247,0.4)]"
          aria-hidden="true"
        />
        <span className="text-xs font-medium text-white/80 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] tracking-wide">
          Carregando player...
        </span>
      </div>
    </div>
  );
}

function CommentsLoadingFallback() {
  return (
    <section
      aria-label="Carregando comentários"
      className="mt-10 border-t border-[#a855f7]/20 pt-8 sm:pt-10"
    >
      <div
        role="status"
        aria-live="polite"
        className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-[#a855f7]/25 bg-gradient-to-b from-[#130f24]/90 via-[#0c0a15]/95 to-[#08070d] p-6 sm:p-8 text-center shadow-[0_8px_32px_rgba(0,0,0,0.65),0_0_35px_rgba(168,85,247,0.12)] backdrop-blur-md"
      >
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-24 bg-[#a855f7]/15 rounded-full blur-3xl"
          aria-hidden="true"
        />

        <div className="relative z-10 flex items-center justify-center gap-2.5 py-4">
          <div
            className="size-5 rounded-full border-2 border-[#a855f7]/25 border-t-[#c084fc] animate-spin shadow-[0_0_12px_rgba(168,85,247,0.45)] shrink-0"
            aria-hidden="true"
          />
          <p className="text-sm font-medium tracking-wide text-white/85 select-none">
            Carregando os comentários...
          </p>
        </div>
      </div>
    </section>
  );
}
