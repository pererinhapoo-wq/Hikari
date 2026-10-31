import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ChevronLeft,
  ChevronRight,
  EyeOff,
  HeartHandshake,
  ShieldAlert,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import { EpisodeCommentsSection } from "@/components/comments/EpisodeCommentsSection";
import { Logo } from "@/components/logo";
import {
  CustomVideoPlayer,
  type VideoItem,
} from "@/components/player/CustomVideoPlayer";
import { fetchAnimeDetail } from "@/lib/api";
import { mergeDetail } from "@/lib/overlay";
import { useHikariStore } from "@/lib/store";
import {
  displayTitle,
  type Episode,
} from "@/lib/types";
import { youtubeIdFrom } from "@/lib/utils";
import playerCss from "@/styles/player.css?url";

export const Route = createFileRoute("/watch/$id")({
  validateSearch: (
    raw: Record<string, unknown>,
  ): {
    ep?: string;
    comment?: string;
  } => ({
    ep:
      typeof raw.ep === "string" && raw.ep
        ? raw.ep
        : undefined,

    comment:
      typeof raw.comment === "string" &&
      raw.comment
        ? raw.comment
        : undefined,
  }),

  loader: async ({ params }) => {
    if (params.id.startsWith("local-")) {
      return { remote: null };
    }

    const remote = await fetchAnimeDetail({
      data: { id: params.id },
    });

    return { remote };
  },

  head: () => ({
    links: [
      {
        rel: "stylesheet",
        href: playerCss,
      },
    ],
  }),

  component: WatchPage,
});

function WatchPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

  const {
    ep: epQuery,
    comment: commentQuery,
  } = Route.useSearch();

  const { remote } = Route.useLoaderData();

  const locals = useHikariStore((s) => s.animes);
  const hydrated = useHikariStore((s) => s.hydrated);

  const markContinue = useHikariStore(
    (s) => s.markContinue,
  );

  const anime = mergeDetail(
    remote,
    id,
    locals,
  );

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

    if (epQuery) {
      const match = episodes.find(
        (e) =>
          e.id === epQuery ||
          String(e.id) === String(epQuery) ||
          String(e.number) === String(epQuery),
      );
      if (match) {
        return match;
      }
    }

    return episodes[0];
  }, [episodes, epQuery]);

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
  }, [id, epQuery]);

  const title = anime
    ? displayTitle(anime)
    : "";

  // Resolve qualquer formato de URL (HLS .m3u8, MP4, WebM, Bunny, Mux, B2, Vercel Blob)
  // em um stream reproduzível nativamente pelo reprodutor do Hikari
  function resolvePlayableStream(url: string | null | undefined): string | null {
    if (!url) return null;
    const trimmed = url.trim();
    if (!trimmed) return null;

    // Se for URL ou ID do Mux
    if (trimmed.includes("player.mux.com/")) {
      const muxMatch = trimmed.match(/player\.mux\.com\/([a-zA-Z0-9_-]+)/);
      if (muxMatch?.[1]) {
        return `https://stream.mux.com/${muxMatch[1]}.m3u8`;
      }
    }
    if (/^[a-zA-Z0-9_-]{20,50}$/.test(trimmed) && !trimmed.includes("/") && !trimmed.includes(".")) {
      return `https://stream.mux.com/${trimmed}.m3u8`;
    }

    // Se for embed do Bunny mediadelivery: https://player.mediadelivery.net/embed/{libraryId}/{videoId}
    if (trimmed.includes("player.mediadelivery.net/embed/")) {
      const bunnyMatch = trimmed.match(/mediadelivery\.net\/embed\/(\d+)\/([0-9a-f-]{36})/i);
      if (bunnyMatch) {
        const [, libraryId, videoId] = bunnyMatch;
        return `https://vz-${libraryId}.b-cdn.net/${videoId}/playlist.m3u8`;
      }
    }

    // Streams diretos (HLS, MP4, WebM, Cloudinary, Vercel Blob, Bunny CDN, B2, S3)
    return trimmed;
  }

  // Verifica se uma URL é um arquivo/stream de mídia reproduzível e descarta páginas web externas
  function isPlayableMediaUrl(url: string | null | undefined): boolean {
    if (!url) return false;
    const trimmed = url.trim().toLowerCase();
    if (!trimmed) return false;

    // Páginas externas de streaming / catálogo que não são arquivos de vídeo diretos
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

    // Embeds / IDs suportados pelo resolver (Mux e Bunny)
    if (trimmed.includes("player.mux.com/") || (/^[a-zA-Z0-9_-]{20,50}$/.test(url.trim()) && !trimmed.includes("/") && !trimmed.includes("."))) {
      return true;
    }
    if (trimmed.includes("player.mediadelivery.net/embed/")) {
      return true;
    }

    // Extensões de vídeo e playlists HLS/DASH
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

    // Storages e CDNs de mídia reconhecidos (Vercel Blob, Bunny, Mux, B2, S3, Cloudinary, etc.)
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

  // O tempo inicial efetivo prioriza o progresso em tempo real da sessão do episódio atual,
  // validando imediatamente se o ID gravado na sessão corresponde ao episódio ativo no render.
  const effectiveInitialTime =
    sessionTime && sessionTime.episodeId === current?.id && sessionTime.time > 0
      ? sessionTime.time
      : savedInitialTime;

  // Estado que impede sobrescrever o progresso salvo antes de a restauração ser concluída
  const hasRestoredRef = useRef<boolean>(savedInitialTime <= 0);
  const lastSavedTimeRef = useRef<number>(savedInitialTime);

  // Redefine a seleção de player e sincroniza estado na mudança de episódio
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

  // Salva o progresso ao sair da página, fechar ou recarregar a aba
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

  // Preferência de reprodução automática configurada pelo usuário no Hikari
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

  const handleTimeUpdate = useCallback(
    (time: number, totalDuration: number) => {
      if (!current?.id || !progressStorageKey || totalDuration <= 0) return;

      // Se temos tempo inicial pendente de restauração, verifica se alcançou a posição retomada
      if (!hasRestoredRef.current && effectiveInitialTime > 0) {
        if (
          Math.abs(time - effectiveInitialTime) <= 4 ||
          time >= effectiveInitialTime
        ) {
          hasRestoredRef.current = true;
          lastSavedTimeRef.current = time;
        } else {
          // Previne que eventos iniciais de timeupdate (ex: 0s) sobrescrevam o progresso salvo
          return;
        }
      }

      // Registra o tempo em tempo real associado ao episódio atual
      if (time > 0) {
        livePlaybackRef.current = { episodeId: current.id, time };
      }

      // Se passou de 95% do episódio, remove do storage para reiniciar do início na próxima reprodução
      if (time / totalDuration > 0.95) {
        try {
          localStorage.removeItem(progressStorageKey);
        } catch (err) {
          void err;
        }
        return;
      }

      // Evita gravações excessivas: salva periodicamente a cada 4 segundos de reprodução
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
    [progressStorageKey, current?.id, effectiveInitialTime],
  );

  const handlePause = useCallback(
    (time: number, totalDuration: number) => {
      if (!current?.id || !progressStorageKey || totalDuration <= 0) return;

      if (time > 0) {
        livePlaybackRef.current = { episodeId: current.id, time };
      }

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
    [current?.id, progressStorageKey, effectiveInitialTime],
  );

  // Troca de player preservando o currentTime mais recente da sessão do episódio atual
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
        to: "/watch/$id",
        replace: true,
        params: { id: anime.id },
        search: { ep: next.id },
      });
    }
  }, [next, navigate, anime]);

  const handleEnded = useCallback(() => {
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

  const selectedPlayer =
    playerSources.find((s) => s.id === selectedPlayerId) ??
    playerSources[0] ??
    undefined;
  const playUrl = selectedPlayer?.url ?? "";
  const file = playUrl || null;

// Conversão segura e não-presuntiva da duração do Hikari para segundos
function parseDurationToSeconds(raw?: string | number | null): number {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return Math.floor(raw);
  if (!raw || typeof raw !== "string") return 0;
  const trimmed = raw.trim().toLowerCase();

  // Formato "23:40" ou "01:23:40"
  if (trimmed.includes(":")) {
    const parts = trimmed.split(":").map(Number);
    if (parts.every((p) => !isNaN(p))) {
      if (parts.length === 2) return parts[0] * 60 + parts[1];
      if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
  }

  // Formato "24 min" ou "24m"
  const minMatch = trimmed.match(/^(\d+)\s*(?:min|m)$/);
  if (minMatch) return parseInt(minMatch[1], 10) * 60;

  // Formato numérico puro em string "1420"
  const numOnly = parseInt(trimmed, 10);
  if (!isNaN(numOnly) && numOnly > 0) return numOnly;

  return 0;
}

  // Criação do objeto VideoItem compatível com o Hikari
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
      posterUrl: current.thumbnail || anime?.cover || "",
      videoUrl: file,
      url: file,
      thumbnailUrl: current.thumbnail || anime?.cover || undefined,
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
  }, [current, file, title, anime?.cover, anime?.synopsis, selectedPlayer?.name]);

  const handlePlayerError = useCallback(() => {
    if (!selectedPlayer) return;
    const alt = playerSources.find((s) => s.id !== selectedPlayer.id);
    if (alt) {
      handleSelectPlayer(alt.id);
    }
  }, [playerSources, selectedPlayer, handleSelectPlayer]);

  if (!hydrated) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg text-fg">
        <div className="flex flex-col items-center justify-center gap-3">
          <div
            className="size-8 animate-spin rounded-full border-2 border-white/10 border-t-[#a855f7]"
            aria-label="Carregando"
          />
          <span className="text-sm text-white/50">
            Carregando...
          </span>
        </div>
      </div>
    );
  }

  if (!anime) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg text-fg">
        <div className="flex flex-col items-center justify-center gap-3">
          <div
            className="size-8 animate-spin rounded-full border-2 border-white/10 border-t-[#a855f7]"
            aria-label="Carregando"
          />
          <span className="text-sm text-white/50">
            Carregando...
          </span>
        </div>
      </div>
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

      <div className="mx-auto w-full max-w-6xl flex-1 px-3 pb-12 sm:px-5">



        {/* ================================================== */}
        {/* PLAYER */}
        {/* ================================================== */}

        {file && selectedPlayer && current ? (
          <CustomVideoPlayer
            key={`${anime.id}-${current.id}-${selectedPlayer.id}-${file}`}
            video={_currentVideoItem}
            autoPlay={userAutoplay}
            initialTime={effectiveInitialTime}
            onTimeUpdate={handleTimeUpdate}
            onPause={handlePause}
            onRestored={handleRestored}
            onEnded={handleEnded}
            onError={handlePlayerError}
          />
        ) : yt ? (
          <div className="relative aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black shadow-[0_20px_70px_rgba(0,0,0,0.45)]">
            <iframe
              title={`${title} — trailer`}
              src={`https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&rel=0`}
              className="size-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
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
            {anime.cover ? (
              <img
                src={anime.cover}
                alt={title}
                className="size-full object-cover transition-transform duration-200 group-hover:scale-105"
                loading="lazy"
              />
            ) : (
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
                to="/watch/$id"
                replace
                params={{ id: anime.id }}
                search={{ ep: prev.id }}
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
                to="/watch/$id"
                replace
                params={{ id: anime.id }}
                search={{ ep: next.id }}
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
          <EpisodeCommentsSection
            key={`${anime.id}-${current.id}`}
            animeId={anime.id}
            episodeId={current.id}
            animeTitle={title}
            episodeNumber={current.number ?? 1}
            targetCommentId={commentQuery}
          />
        ) : (
          <div className="mt-10 border-t border-purple-500/20 pt-8 text-center text-sm text-zinc-500">
            Selecione um episódio para carregar os comentários.
          </div>
        )}

      </div>
    </div>
  );
}

