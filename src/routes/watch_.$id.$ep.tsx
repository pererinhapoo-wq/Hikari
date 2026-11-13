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
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  buildResolvedSeasons,
  executeGetCatalogEpisodes,
  getCachedResolvedSeasons,
  getCatalogEpisodes,
  primeCatalogEpisodesCache,
  resolveEpisodes,
} from "@/lib/catalog-episodes";
import {
  startEpisodeSession,
  heartbeatEpisodeProgress,
  getEpisodeProgress,
} from "@/lib/profile-playback.functions";
import {
  displayTitle,
  type Episode,
  type Season,
} from "@/lib/types";
import { youtubeIdFrom } from "@/lib/utils";

function parseEpisodeNumber(epStr?: string): number {
  if (!epStr) return 1;
  const match = epStr.match(/ep-(?:\d+-)?(\d+)$/i) || epStr.match(/(\d+)$/);
  return match ? parseInt(match[1], 10) : 1;
}

function resolvePlayableStream(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  if (trimmed.includes("player.mux.com/")) {
    const muxMatch = trimmed.match(/player\.mux\.com\/([a-zA-Z0-9_-]+)/);
    if (muxMatch?.[1]) {
      return `https://stream.mux.com/${muxMatch[1]}.m3u8`;
    }
  }
  if (
    /^[a-zA-Z0-9_-]{20,50}$/.test(trimmed) &&
    !trimmed.includes("/") &&
    !trimmed.includes(".")
  ) {
    return `https://stream.mux.com/${trimmed}.m3u8`;
  }

  if (trimmed.includes("player.mediadelivery.net/embed/")) {
    const bunnyMatch = trimmed.match(
      /mediadelivery\.net\/embed\/(\d+)\/([0-9a-f-]{36})/i,
    );
    if (bunnyMatch) {
      const [, libraryId, videoId] = bunnyMatch;
      return `https://vz-${libraryId}.b-cdn.net/${videoId}/playlist.m3u8`;
    }
  }

  return trimmed;
}

function isPlayableMediaUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const trimmed = url.trim().toLowerCase();
  if (!trimmed) return false;

  if (
    trimmed.includes("crunchyroll.com") ||
    trimmed.includes("funimation.com") ||
    trimmed.includes("vrv.co") ||
    trimmed.includes("netflix.com") ||
    trimmed.includes("hidive.com") ||
    trimmed.includes("youtube.com/watch") ||
    trimmed.includes("youtu.be/") ||
    trimmed.includes("vimeo.com/")
  ) {
    return false;
  }

  if (
    trimmed.includes("player.mux.com/") ||
    (/^[a-zA-Z0-9_-]{20,50}$/.test(url.trim()) &&
      !trimmed.includes("/") &&
      !trimmed.includes("."))
  ) {
    return true;
  }
  if (trimmed.includes("player.mediadelivery.net/embed/")) {
    return true;
  }

  const cleanPath = trimmed.split("?")[0].split("#")[0];
  if (
    cleanPath.endsWith(".m3u8") ||
    cleanPath.endsWith(".mp4") ||
    cleanPath.endsWith(".webm") ||
    cleanPath.endsWith(".mkv") ||
    cleanPath.endsWith(".mov") ||
    cleanPath.endsWith(".ogg") ||
    cleanPath.endsWith(".mpd")
  ) {
    return true;
  }

  if (
    trimmed.startsWith("blob:") ||
    trimmed.includes("vercel-storage.com") ||
    trimmed.includes("b-cdn.net") ||
    trimmed.includes("stream.mux.com") ||
    trimmed.includes("backblazeb2.com") ||
    trimmed.includes("cloudinary.com") ||
    trimmed.includes("amazonaws.com") ||
    trimmed.includes("r2.cloudflarestorage.com") ||
    trimmed.includes("storage.googleapis.com") ||
    trimmed.includes("/hls/") ||
    trimmed.includes("/m3u8/")
  ) {
    return true;
  }

  return false;
}

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

    const [remote, catalogEpisodes] = await Promise.all([
      fetchAnimeDetail({
        data: { id: params.id },
      }),
      (typeof window === "undefined"
        ? executeGetCatalogEpisodes(params.id)
        : getCatalogEpisodes({ data: { animeId: params.id } })
      ).catch(() => null),
    ]);

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
      catalogEpisodes?.episodes?.find((e) => e.number === epNum) ??
      catalogEpisodes?.episodes?.[0];
    const remoteEps = (remote?.seasons ?? []).flatMap((s) => s.episodes ?? []);
    const targetRemoteEp =
      remoteEps.find((e) => e.number === epNum) ?? remoteEps[0];

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
    let hasPlayableVideo = false;
    for (const rawCandidate of streamCandidates) {
      if (!rawCandidate || !isPlayableMediaUrl(rawCandidate)) continue;
      const resolvedUrl = resolvePlayableStream(rawCandidate);
      if (!resolvedUrl) continue;
      hasPlayableVideo = true;
      try {
        const parsed = new URL(resolvedUrl);
        if (parsed.protocol === "https:" || parsed.protocol === "http:") {
          externalOriginSet.add(parsed.origin);
        }
      } catch {
        // ignora URL inválida
      }
    }

    const firstRawVideo = streamCandidates.find((c) => Boolean(c?.trim()));
    const resolvedYt = !hasPlayableVideo
      ? (remote?.trailerId ? youtubeIdFrom(remote.trailerId) : null) ||
        (firstRawVideo ? youtubeIdFrom(firstRawVideo) : null)
      : null;

    if (resolvedYt) {
      externalOriginSet.add("https://www.youtube-nocookie.com");
      if (!targetCatalogEp?.thumbnail && !targetRemoteEp?.thumbnail && !remote?.banner && !remote?.cover) {
        externalOriginSet.add("https://i.ytimg.com");
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
  const [userTriggeredPlay, setUserTriggeredPlay] = useState(false);

  const handleActivatePlayer = useCallback(() => {
    setUserTriggeredPlay(true);
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

  const [resolvedSeasons, setResolvedSeasons] = useState<Season[] | null>(() => {
    const targetId = baseAnime?.id || id;
    if (catalogEpisodes) {
      if (typeof window !== "undefined") {
        primeCatalogEpisodesCache(targetId, catalogEpisodes);
      }
      return buildResolvedSeasons(targetId, catalogEpisodes, baseAnime?.seasons ?? []);
    }
    return getCachedResolvedSeasons(targetId, baseAnime?.seasons);
  });

  useEffect(() => {
    const targetId = baseAnime?.id || id;
    if (!targetId) return;

    let cancelled = false;
    void resolveEpisodes(targetId, baseAnime?.seasons).then((seasons) => {
      if (cancelled) return;
      setResolvedSeasons(seasons);
    });

    return () => {
      cancelled = true;
    };
  }, [baseAnime?.id, baseAnime?.seasons, id]);

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

  const current = useMemo(() => {
    if (!episodes.length) {
      return null;
    }

    const match =
      episodes.find(
        (e) =>
          e.id === ep ||
          String(e.id) === String(ep) ||
          e.number === targetEpNum,
      ) ?? episodes.find((e) => String(e.number) === String(targetEpNum));

    if (match) {
      return match;
    }

    return episodes[0];
  }, [episodes, ep, targetEpNum]);

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
        current.thumbnail ||
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

  // Usa os helpers resolvePlayableStream e isPlayableMediaUrl definidos no escopo do módulo

  type PlayerSourceEntry = {
    id: "player-1" | "player-2" | "player-3" | "player-4" | "player-5";
    url: string;
    name: string;
  };

  // Mapeamento dinâmico: exibe exclusivamente os players com URLs válidas e configuradas
  const playerSources = useMemo(() => {
    if (!current) return [];
    const list: PlayerSourceEntry[] = [];

    const candidates = [
      { id: "player-1" as const, raw: current.videoUrl, defaultName: "Player 1" },
      { id: "player-2" as const, raw: current.videoUrl2, defaultName: "Player 2" },
      { id: "player-3" as const, raw: current.videoUrl3, defaultName: "Player 3" },
      { id: "player-4" as const, raw: current.videoUrl4, defaultName: "Player 4" },
      { id: "player-5" as const, raw: current.videoUrl5, defaultName: "Player 5" },
    ];

    candidates.forEach((c) => {
      if (!c.raw) return;
      if (!isPlayableMediaUrl(c.raw)) return; // Ignora páginas externas e links inválidos
      const resolved = resolvePlayableStream(c.raw);
      if (resolved) {
        list.push({ id: c.id, url: resolved, name: c.defaultName });
      }
    });

    return list;
  }, [current]);

  const { user } = useCurrentUserState();

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

  const playbackSessionIdRef = useRef<string | null>(null);
  const sessionStartingRef = useRef<boolean>(false);
  const isPlayingRef = useRef<boolean>(false);
  const isBufferingRef = useRef<boolean>(false);
  const isSeekingRef = useRef<boolean>(false);
  const lastHeartbeatTimestampRef = useRef<number>(0);
  const isCompletedRef = useRef<boolean>(false);

  // Chave de armazenamento para salvar progresso e retomar a reprodução
  const progressStorageKey =
    anime && current
      ? `hikari_progress_${anime.id}_${current.id}`
      : null;

  const savedInitialTime = useMemo(() => {
    if (typeof window === "undefined" || !progressStorageKey) return 0;
    try {
      const raw = localStorage.getItem(progressStorageKey);
      const parsed = raw ? Number.parseFloat(raw) : 0;
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    } catch {
      return 0;
    }
  }, [progressStorageKey]);

  const effectiveInitialTime =
    sessionTime && sessionTime.episodeId === current?.id && sessionTime.time > 0
      ? sessionTime.time
      : savedInitialTime;

  const hasRestoredRef = useRef<boolean>(savedInitialTime <= 0);
  const lastSavedTimeRef = useRef<number>(savedInitialTime);

  // Consulta progresso remoto do usuário autenticado no servidor
  useEffect(() => {
    let isMounted = true;
    if (user && anime?.id && current?.id) {
      getEpisodeProgress({ data: { animeId: anime.id, episodeId: current.id } })
        .then((progress) => {
          if (!isMounted || !progress || progress.currentTime <= 0) return;
          if (!hasRestoredRef.current && progress.currentTime > 0) {
            setSessionTime({ episodeId: current.id, time: progress.currentTime });
          }
        })
        .catch(() => {
          // Fallback transparente
        });
    }
    return () => {
      isMounted = false;
    };
  }, [user, anime?.id, current?.id]);

  useEffect(() => {
    playbackSessionIdRef.current = null;
    sessionStartingRef.current = false;
    isPlayingRef.current = false;
    isBufferingRef.current = false;
    isSeekingRef.current = false;
    isCompletedRef.current = false;
    lastHeartbeatTimestampRef.current = 0;
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
      hasRestoredRef.current = savedInitialTime <= 0;
      lastSavedTimeRef.current = savedInitialTime;
    }
  }, [current?.id, anime, savedInitialTime, playerSources]);

  useEffect(() => {
    const handleBeforeUnload = () => {
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

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", handleBeforeUnload);
    };
  }, [current?.id, progressStorageKey]);

  const userAutoplay = useMemo(() => {
    if (typeof window === "undefined") return true;
    try {
      const saved = localStorage.getItem("hikari-player-autoplay");
      return saved === null ? true : saved !== "false";
    } catch {
      return true;
    }
  }, []);

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

  const ensureSessionAndSendHeartbeat = useCallback(
    async (time: number, totalDuration: number, isEnding = false) => {
      if (!user || !anime || !current) return;

      const dur = totalDuration > 0 ? Math.floor(totalDuration) : undefined;
      const snap = {
        title: displayTitle(anime),
        cover: current.thumbnail || anime.cover,
      };

      // 1. Inicia a sessão se ainda não tiver sido iniciada
      if (!playbackSessionIdRef.current) {
        if (sessionStartingRef.current) return;
        sessionStartingRef.current = true;
        try {
          const session = await startEpisodeSession({
            data: {
              animeId: anime.id,
              episodeId: current.id,
              episodeNumber: current.number,
              duration: dur,
              animeSnapshot: snap,
            },
          });
          playbackSessionIdRef.current = session.playbackSessionId;
          lastHeartbeatTimestampRef.current = Date.now();
        } catch {
          // Preserva a reprodução mesmo se o servidor estiver temporariamente indisponível
        } finally {
          sessionStartingRef.current = false;
        }
        return;
      }

      // 2. Heartbeat se sessão estiver ativa
      const sessionId = playbackSessionIdRef.current;
      const now = Date.now();
      const deltaMs =
        lastHeartbeatTimestampRef.current > 0
          ? Math.max(0, now - lastHeartbeatTimestampRef.current)
          : 0;

      // Se for heartbeat normal de reprodução, exige ~4.5s de intervalo
      if (!isEnding && deltaMs < 4500) {
        return;
      }

      lastHeartbeatTimestampRef.current = now;

      try {
        const hb = await heartbeatEpisodeProgress({
          data: {
            animeId: anime.id,
            episodeId: current.id,
            playbackSessionId: sessionId,
            currentTime: Math.floor(time),
            duration: dur,
            deltaMs,
            isPlaying: isEnding ? false : isPlayingRef.current,
            isBuffering: isBufferingRef.current,
            isSeeking: isSeekingRef.current,
            ended: isEnding,
            animeSnapshot: snap,
          },
        });
        if (hb.completed) {
          isCompletedRef.current = true;
        }
      } catch (err: unknown) {
        const msg = (err as Error)?.message || "";
        if (msg.includes("expirada") || msg.includes("inválida")) {
          playbackSessionIdRef.current = null;
        }
      }
    },
    [user, anime, current],
  );

  const handlePlay = useCallback(() => {
    isPlayingRef.current = true;
    isBufferingRef.current = false;
    const curTime = livePlaybackRef.current.time;
    void ensureSessionAndSendHeartbeat(curTime, 0);
  }, [ensureSessionAndSendHeartbeat]);

  const handlePlaying = useCallback(() => {
    isPlayingRef.current = true;
    isBufferingRef.current = false;
    const curTime = livePlaybackRef.current.time;
    void ensureSessionAndSendHeartbeat(curTime, 0);
  }, [ensureSessionAndSendHeartbeat]);

  const handleSeeking = useCallback(() => {
    isSeekingRef.current = true;
  }, []);

  const handleSeeked = useCallback(() => {
    isSeekingRef.current = false;
  }, []);

  const handleWaiting = useCallback(() => {
    isBufferingRef.current = true;
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

      // Envia heartbeat com throttled timing para o servidor
      void ensureSessionAndSendHeartbeat(time, totalDuration, false);

      if (time / totalDuration > 0.95) {
        try {
          localStorage.removeItem(progressStorageKey);
        } catch (err) {
          void err;
        }
        return;
      }

      if (Math.abs(time - lastSavedTimeRef.current) >= 4) {
        lastSavedTimeRef.current = time;
        try {
          localStorage.setItem(
            progressStorageKey,
            String(Math.floor(time)),
          );
        } catch (err) {
          void err;
        }
      }
    },
    [progressStorageKey, current?.id, effectiveInitialTime, ensureSessionAndSendHeartbeat],
  );

  const handlePause = useCallback(
    (time: number, totalDuration: number) => {
      isPlayingRef.current = false;
      if (!current?.id || !progressStorageKey || totalDuration <= 0) return;

      if (time > 0) {
        livePlaybackRef.current = { episodeId: current.id, time };
      }

      void ensureSessionAndSendHeartbeat(time, totalDuration, false);

      if (time / totalDuration > 0.95) {
        try {
          localStorage.removeItem(progressStorageKey);
        } catch {
          /* ignore storage error */
        }
        return;
      }

      if (
        hasRestoredRef.current ||
        effectiveInitialTime <= 0 ||
        Math.abs(time - effectiveInitialTime) <= 2
      ) {
        lastSavedTimeRef.current = time;
        try {
          localStorage.setItem(
            progressStorageKey,
            String(Math.floor(time)),
          );
        } catch {
          /* ignore storage error */
        }
      }
    },
    [current?.id, progressStorageKey, effectiveInitialTime, ensureSessionAndSendHeartbeat],
  );

  const handleSelectPlayer = useCallback(
    (targetId: string) => {
      if (targetId === selectedPlayerId) return;

      const hasValidLiveTime =
        current?.id &&
        livePlaybackRef.current.episodeId === current.id &&
        livePlaybackRef.current.time > 0;

      const currentTimeToCarry = hasValidLiveTime
        ? livePlaybackRef.current.time
        : savedInitialTime;

      if (currentTimeToCarry > 0 && current?.id) {
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
    [selectedPlayerId, savedInitialTime, progressStorageKey, current?.id],
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
    isPlayingRef.current = false;
    void ensureSessionAndSendHeartbeat(livePlaybackRef.current.time, 0, true);
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
  }, [progressStorageKey, handleNextEpisode, ensureSessionAndSendHeartbeat]);

  const selectedPlayer =
    playerSources.find((s) => s.id === selectedPlayerId) ??
    playerSources[0] ??
    undefined;
  const playUrl = selectedPlayer?.url ?? "";
  const file = playUrl || null;

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
    const rawPoster = current?.thumbnail || anime?.banner || anime?.cover || null;
    return rawPoster ? anilistImage(rawPoster, 1280) : null;
  }, [current?.thumbnail, anime?.banner, anime?.cover]);

  const _currentVideoItem = useMemo((): VideoItem | undefined => {
    if (!current || !file) return undefined;
    const initialDuration = parseDurationToSeconds(current.duration);
    const episodeTitleStr = current.number
      ? `${title} — Episódio ${current.number}${current.title ? ` · ${current.title}` : ""}`
      : title;

    const mins = Math.floor(initialDuration / 60).toString().padStart(2, "0");
    const secs = (initialDuration % 60).toString().padStart(2, "0");

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
  }, [current, file, title, playerPoster, anime?.synopsis, selectedPlayer?.name]);

  const handlePlayerError = useCallback(() => {
    if (!selectedPlayer) return;
    const alt = playerSources.find((s) => s.id !== selectedPlayer.id);
    if (alt) {
      handleSelectPlayer(alt.id);
    }
  }, [playerSources, selectedPlayer, handleSelectPlayer]);

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

  const yt =
    !playUrl && anime.trailerId
      ? youtubeIdFrom(anime.trailerId)
      : youtubeIdFrom(playUrl);

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
                key={`${anime.id}-${current.id}-${selectedPlayer.id}-${file}`}
                video={_currentVideoItem}
                autoPlay={userTriggeredPlay || userAutoplay}
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
              className="relative block aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black shadow-[0_20px_70px_rgba(0,0,0,0.45)] cursor-pointer group select-none text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
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
                  className="absolute inset-0 size-full object-cover filter brightness-[0.85] transition-transform duration-300 group-hover:scale-105"
                />
              ) : null}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/40" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex size-16 sm:size-20 items-center justify-center rounded-full bg-purple-600/90 text-white shadow-[0_0_30px_rgba(168,85,247,0.6)] transition-transform duration-200 group-hover:scale-110">
                  <Play className="size-8 sm:size-10 fill-white ml-1" />
                </div>
              </div>
            </button>
          )
        ) : yt ? (
          <YouTubeTrailer
            yt={yt}
            title={title}
            posterUrl={playerPoster || `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`}
            mounted={playerMounted}
            autoPlay={userTriggeredPlay || userAutoplay}
            onActivate={handleActivatePlayer}
          />
        ) : (
          <div className="relative aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black shadow-[0_20px_70px_rgba(0,0,0,0.45)]">
            <div className="flex size-full flex-col items-center justify-center gap-3 px-6 text-center">
              <p className="font-display text-2xl">
                Sem vídeo neste episódio
              </p>
              <p className="max-w-md text-sm text-muted">
                Adicione um trailer do YouTube ou uma URL de
                vídeo no Admin para reproduzir aqui.
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

        {/* ================================================== */}
        {/* INFORMAÇÕES DO ANIME (ABAIXO DO PLAYER)           */}
        {/* ================================================== */}

        <section className="mt-4 flex items-center gap-3.5 sm:gap-4 rounded-2xl border border-white/10 bg-[#121217]/90 p-3 sm:p-4 backdrop-blur-xl shadow-lg">
          <Link
            to="/anime/$id"
            params={{ id: anime.id }}
            className="group relative block aspect-[2/3] w-14 sm:w-16 shrink-0 overflow-hidden rounded-xl bg-elevated ring-1 ring-white/15 transition-transform hover:scale-[1.02]"
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
                  className="size-full object-cover transition-transform duration-200 group-hover:scale-105"
                  loading="lazy"
                  fetchPriority="low"
                  decoding="async"
                />
              );
            })() : (
              <div className="size-full bg-elevated flex items-center justify-center text-white/30 text-[10px]">
                Sem Capa
              </div>
            )}
          </Link>

          <div className="min-w-0 flex-1">
            <h1 className="font-display text-base sm:text-xl font-bold leading-tight text-white truncate">
              <Link
                to="/anime/$id"
                params={{ id: anime.id }}
                className="transition hover:text-[#c084fc]"
              >
                {title}
              </Link>
            </h1>

            <div className="mt-1 flex items-center gap-2 text-xs sm:text-sm text-white/60">
              <span className="size-1.5 rounded-full bg-[#a855f7] shrink-0" />
              <span className="truncate">
                {current
                  ? `Episódio ${current.number}${current.title ? ` · ${current.title}` : ""}`
                  : "Trailer"}
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

function YouTubeTrailer({
  yt,
  title,
  posterUrl,
  mounted,
  autoPlay,
  onActivate,
}: {
  yt: string;
  title: string;
  posterUrl: string;
  mounted: boolean;
  autoPlay: boolean;
  onActivate: () => void;
}) {
  return (
    <div className="relative aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black shadow-[0_20px_70px_rgba(0,0,0,0.45)]">
      {mounted ? (
        <iframe
          title={`${title} — trailer`}
          src={`https://www.youtube-nocookie.com/embed/${yt}?autoplay=${autoPlay ? 1 : 0}&rel=0`}
          className="size-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <button
          type="button"
          onClick={onActivate}
          aria-label={`Reproduzir trailer de ${title}`}
          className="relative block size-full cursor-pointer group select-none text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
        >
          <img
            src={posterUrl}
            alt={`${title} — trailer`}
            width={1280}
            height={720}
            loading="eager"
            fetchPriority="high"
            decoding="sync"
            className="absolute inset-0 size-full object-cover filter brightness-[0.85] transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/40" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex size-16 sm:size-20 items-center justify-center rounded-full bg-purple-600/90 text-white shadow-[0_0_30px_rgba(168,85,247,0.6)] transition-transform duration-200 group-hover:scale-110">
              <Play className="size-8 sm:size-10 fill-white ml-1" />
            </div>
          </div>
        </button>
      )}
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
        className="elizabeth-loading-container relative overflow-hidden rounded-2xl sm:rounded-3xl border border-[#a855f7]/25 bg-gradient-to-b from-[#130f24]/90 via-[#0c0a15]/95 to-[#08070d] p-8 sm:p-14 text-center shadow-[0_8px_32px_rgba(0,0,0,0.65),0_0_35px_rgba(168,85,247,0.12)] backdrop-blur-md"
      >
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-44 bg-[#a855f7]/15 rounded-full blur-3xl"
          aria-hidden="true"
        />

        <div className="relative z-10 flex flex-col items-center justify-center">
          <div className="elizabeth-sway-anim inline-flex items-center justify-center select-none drop-shadow-[0_4px_16px_rgba(0,0,0,0.7)]">
            <picture className="contents">
              <source
                type="image/webp"
                srcSet="/assets/hikari-elizabeth-character-sm.webp 186w, /assets/hikari-elizabeth-character.webp 290w"
                sizes="(min-width: 768px) 224px, (min-width: 640px) 208px, 176px"
              />
              <img
                src="/assets/hikari-elizabeth-character.webp"
                alt="Elizabeth"
                width={290}
                height={140}
                className="w-44 sm:w-52 md:w-56 h-auto object-contain pointer-events-none"
                loading="lazy"
                fetchPriority="low"
                decoding="async"
                draggable={false}
              />
            </picture>
          </div>

          <div className="mt-5 flex items-center justify-center gap-2.5">
            <div
              className="elizabeth-spinner size-5 rounded-full border-2 border-[#a855f7]/25 border-t-[#c084fc] animate-spin shadow-[0_0_12px_rgba(168,85,247,0.45)] shrink-0"
              aria-hidden="true"
            />
            <p className="text-sm font-medium tracking-wide text-white/85 select-none">
              Carregando os comentários...
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
