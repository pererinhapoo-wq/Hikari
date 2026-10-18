import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type SyntheticEvent,
  type TouchEvent,
} from "react";
import Hls from "hls.js";
import {
  Activity,
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Settings,
  Volume1,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { cn, isHlsSource } from "@/lib/utils";

export interface VideoItem {
  id: string;
  title: string;
  url: string;
  thumbnailUrl?: string;
  duration?: number | string;
  resolution?: string;
  isLocalFile?: boolean;
  size?: number;
  type?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  episodeTitle?: string;
}

export interface CustomVideoPlayerQualityLevel {
  id: number;
  label: string;
  height?: number;
  bitrate?: number;
}

export interface CustomVideoPlayerProps {
  /** Objeto de vídeo original NOVA STREAM */
  video?: VideoItem;
  /** Ação de fechamento / retorno da tela */
  onClose?: () => void;
  /** Callback para sincronização de metadados do vídeo */
  onUpdateMetadata?: (id: string, metadata: Partial<VideoItem>) => void;

  /** URL do vídeo (MP4, WebM ou Manifesto HLS .m3u8) */
  src?: string | null;
  /** Imagem de capa antes do início da reprodução */
  poster?: string;
  /** Título principal (ex.: Nome do anime) */
  title?: string;
  /** Número do episódio atual */
  episodeNumber?: number;
  /** Título do episódio atual */
  episodeTitle?: string;
  /** Iniciar reprodução automaticamente quando o vídeo estiver pronto */
  autoPlay?: boolean;
  /** Tempo inicial em segundos para retomar a reprodução */
  initialTime?: number;
  /** Callback acionado periodicamente com o progresso atual */
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  /** Callback acionado ao término do vídeo */
  onEnded?: () => void;
  /** Callback ao iniciar reprodução */
  onPlay?: () => void;
  /** Callback ao pausar */
  onPause?: () => void;
  /** Callback em caso de erro */
  onError?: (error: Error | string) => void;
  /** Ação ao clicar no botão de próximo episódio */
  onNextEpisode?: () => void;
  /** Ação ao clicar no botão de episódio anterior */
  onPrevEpisode?: () => void;
  /** Se há episódio posterior */
  hasNextEpisode?: boolean;
  /** Se há episódio anterior */
  hasPrevEpisode?: boolean;
  /** Classe CSS customizada para o container principal */
  className?: string;
}

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

export function classifyVideoResolution(height?: number): string {
  if (!height || height <= 0) return "Automática";
  if (height >= 2160) return "4K Ultra HD";
  if (height >= 1440) return "2K QHD";
  if (height >= 1080) return "1080p FHD";
  if (height >= 720) return "720p HD";
  if (height >= 480) return "480p SD";
  return `${height}p`;
}

export function formatTime(secs: number): string {
  if (!Number.isFinite(secs) || secs < 0) return "00:00";
  const total = Math.floor(secs);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function CustomVideoPlayer({
  video,
  onClose,
  onUpdateMetadata,
  src,
  poster,
  title,
  episodeNumber,
  episodeTitle,
  autoPlay = false,
  initialTime = 0,
  onTimeUpdate,
  onEnded,
  onPlay,
  onPause,
  onError,
  onNextEpisode,
  onPrevEpisode,
  hasNextEpisode = false,
  hasPrevEpisode = false,
  className,
}: CustomVideoPlayerProps) {
  // Normalização unificada entre a interface original NOVA STREAM e a interface Hikari
  const activeSrc = src ?? video?.url ?? null;
  const activePoster = poster ?? video?.thumbnailUrl;
  const activeTitle = title ?? video?.title;
  const activeEpisodeNumber = episodeNumber ?? video?.episodeNumber;
  const activeEpisodeTitle = episodeTitle ?? video?.episodeTitle;

  // Referências aos elementos DOM e instâncias
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const hideControlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapRef = useRef<{ time: number; side: "left" | "right" } | null>(null);
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Retomada estável de tempo inicial: aplica apenas uma vez quando o vídeo estiver pronto
  const initialTimeRef = useRef<number>(initialTime);
  const hasAppliedInitialTimeRef = useRef<boolean>(false);

  useEffect(() => {
    initialTimeRef.current = initialTime;
    // Reseta a trava apenas quando a fonte de vídeo mudar
    hasAppliedInitialTimeRef.current = false;
  }, [activeSrc, initialTime]);

  // Estados de reprodução e tempo
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [bufferedTime, setBufferedTime] = useState<number>(0);
  const [isBuffering, setIsBuffering] = useState<boolean>(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  // Estados de áudio
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const volumeRef = useRef<number>(volume);

  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  // Estados de controle e menus
  const [controlsVisible, setControlsVisible] = useState<boolean>(true);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [activeMenuTab, setActiveMenuTab] = useState<"main" | "speed" | "quality">("main");

  // HLS e Qualidade
  const [qualityLevels, setQualityLevels] = useState<CustomVideoPlayerQualityLevel[]>([]);
  const [currentQuality, setCurrentQuality] = useState<number>(-1); // -1 = Auto
  const [isHlsStream, setIsHlsStream] = useState<boolean>(false);

  // Diagnóstico Técnico ("Stats for Nerds")
  const [showDiagnostics, setShowDiagnostics] = useState<boolean>(false);
  const [diagStats, setDiagStats] = useState({
    videoWidth: 0,
    videoHeight: 0,
    droppedFrames: 0,
    totalFrames: 0,
    bufferedAhead: 0,
    bitrate: 0,
  });

  // Feedback visual de double-tap (+10s / -10s)
  const [tapFeedback, setTapFeedback] = useState<"forward" | "rewind" | null>(null);
  const tapFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hover na barra de progresso
  const [hoverPosition, setHoverPosition] = useState<number | null>(null);
  const [hoverTime, setHoverTime] = useState<number>(0);

  // =========================================================================
  // Temporizador de Ocultação dos Controles
  // =========================================================================

  const clearHideTimer = useCallback(() => {
    if (hideControlsTimerRef.current) {
      clearTimeout(hideControlsTimerRef.current);
      hideControlsTimerRef.current = null;
    }
  }, []);

  const triggerShowControls = useCallback(() => {
    clearHideTimer();
    setControlsVisible(true);

    if (isPlaying) {
      hideControlsTimerRef.current = setTimeout(() => {
        if (!settingsOpen && !showDiagnostics) {
          setControlsVisible(false);
        }
      }, 3500);
    }
  }, [clearHideTimer, isPlaying, settingsOpen, showDiagnostics]);

  // =========================================================================
  // Inicialização e Gerenciamento do Vídeo e HLS
  // =========================================================================

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeSrc) {
      setQualityLevels([]);
      setIsHlsStream(false);
      return;
    }

    setPlaybackError(null);
    setIsBuffering(true);
    hasAppliedInitialTimeRef.current = false;

    let hlsInstance: Hls | null = null;
    const isHls = isHlsSource(activeSrc);
    setIsHlsStream(isHls);

    if (isHls) {
      // 1. Suporte HLS Nativo (Safari / iOS)
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = activeSrc;
        setQualityLevels([]);
      } else if (typeof window !== "undefined" && Hls.isSupported()) {
        // 2. Navegadores com suporte a Media Source Extensions (Chrome, Firefox, Edge, Android)
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 90,
          capLevelToPlayerSize: true,
        });
        hlsInstance = hls;
        hlsRef.current = hls;

        hls.attachMedia(video);

        hls.on(Hls.Events.MEDIA_ATTACHED, () => {
          hls.loadSource(activeSrc);
        });

        hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
          setIsBuffering(false);
          if (data.levels && data.levels.length > 1) {
            const levels: CustomVideoPlayerQualityLevel[] = data.levels.map((level, idx) => ({
              id: idx,
              label: level.height
                ? `${level.height}p (${classifyVideoResolution(level.height)})`
                : `Qualidade ${idx + 1}`,
              height: level.height,
              bitrate: level.bitrate,
            }));
            setQualityLevels(levels);
          } else {
            setQualityLevels([]);
          }

          // Notificação de metadados se disponível
          if (onUpdateMetadata && (video?.id || activeEpisodeTitle)) {
            const bestHeight = data.levels?.[0]?.height;
            if (bestHeight) {
              onUpdateMetadata(video?.id ?? "current", {
                resolution: classifyVideoResolution(bestHeight),
              });
            }
          }

          // Aplicação segura do initialTime após análise do manifesto
          if (!hasAppliedInitialTimeRef.current && initialTimeRef.current > 0) {
            video.currentTime = initialTimeRef.current;
            hasAppliedInitialTimeRef.current = true;
          }
        });

        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.warn("[CustomVideoPlayer] Erro de rede no HLS. Tentando recuperar...", data);
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.warn("[CustomVideoPlayer] Erro de mídia no HLS. Tentando recuperar...", data);
                hls.recoverMediaError();
                break;
              default:
                console.error("[CustomVideoPlayer] Erro fatal no HLS:", data);
                hls.destroy();
                setPlaybackError("Não foi possível carregar este stream de vídeo.");
                onError?.(new Error(`Falha no stream HLS: ${data.details}`));
                break;
            }
          }
        });
      } else {
        video.src = activeSrc;
      }
    } else {
      // Arquivo direto convencional (MP4, WebM, etc.)
      setQualityLevels([]);
      video.src = activeSrc;
    }

    return () => {
      if (hlsInstance) {
        hlsInstance.destroy();
        hlsInstance = null;
        hlsRef.current = null;
      }
      video.removeAttribute("src");
      video.load();
    };
  }, [activeSrc, onError, onUpdateMetadata, video?.id, activeEpisodeTitle]);

  // Atualização das métricas de diagnóstico
  useEffect(() => {
    if (!showDiagnostics) return;

    const interval = setInterval(() => {
      const video = videoRef.current;
      if (!video) return;

      let dropped = 0;
      let total = 0;
      if (typeof video.getVideoPlaybackQuality === "function") {
        const q = video.getVideoPlaybackQuality();
        dropped = q.droppedVideoFrames;
        total = q.totalVideoFrames;
      }

      let bufferedAhead = 0;
      if (video.buffered.length > 0) {
        const cur = video.currentTime;
        for (let i = 0; i < video.buffered.length; i++) {
          if (video.buffered.start(i) <= cur && cur <= video.buffered.end(i)) {
            bufferedAhead = Math.max(0, video.buffered.end(i) - cur);
            break;
          }
        }
      }

      let bitrate = 0;
      if (hlsRef.current && hlsRef.current.levels && hlsRef.current.currentLevel >= 0) {
        bitrate = hlsRef.current.levels[hlsRef.current.currentLevel]?.bitrate || 0;
      }

      setDiagStats({
        videoWidth: video.videoWidth || 0,
        videoHeight: video.videoHeight || 0,
        droppedFrames: dropped,
        totalFrames: total,
        bufferedAhead,
        bitrate,
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [showDiagnostics]);

  // =========================================================================
  // Sincronização de Estado de Tela Cheia
  // =========================================================================

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  // =========================================================================
  // Ações de Reprodução e Seek
  // =========================================================================

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      void video.play().catch(() => {
        // Bloqueio de autoplay do navegador sem interação
      });
    } else {
      video.pause();
    }
  }, []);

  const seekBy = useCallback(
    (seconds: number) => {
      const video = videoRef.current;
      if (!video) return;

      const maxDuration = Number.isFinite(video.duration) ? video.duration : duration;
      const target = Math.min(Math.max(video.currentTime + seconds, 0), maxDuration || 0);
      video.currentTime = target;
      setCurrentTime(target);
      triggerShowControls();

      // Feedback visual central (+10s / -10s)
      setTapFeedback(seconds > 0 ? "forward" : "rewind");
      if (tapFeedbackTimerRef.current) clearTimeout(tapFeedbackTimerRef.current);
      tapFeedbackTimerRef.current = setTimeout(() => {
        setTapFeedback(null);
      }, 600);
    },
    [duration, triggerShowControls],
  );

  const handleSeekChange = (time: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = time;
    setCurrentTime(time);
  };

  // =========================================================================
  // Ações de Áudio e Volume
  // =========================================================================

  const setVideoVolume = useCallback((nextVolume: number) => {
    const video = videoRef.current;
    const clamped = Math.min(1, Math.max(0, nextVolume));
    setVolume(clamped);
    setIsMuted(clamped === 0);

    if (video) {
      video.volume = clamped;
      video.muted = clamped === 0;
    }
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.muted || volumeRef.current === 0) {
      const restored = volumeRef.current > 0 ? volumeRef.current : 1;
      video.muted = false;
      video.volume = restored;
      setVolume(restored);
      setIsMuted(false);
    } else {
      video.muted = true;
      setIsMuted(true);
    }
  }, []);

  // =========================================================================
  // Tela Cheia
  // =========================================================================

  const toggleFullscreen = useCallback(async () => {
    const container = containerRef.current;
    const video = videoRef.current;
    if (!container) return;

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        try {
          const orient = screen.orientation as unknown as { unlock?: () => void };
          if (orient && typeof orient.unlock === "function") {
            orient.unlock();
          }
        } catch (_e) {
          // Orientação não suportada ou permissão negada
        }
      } else {
        if (container.requestFullscreen) {
          await container.requestFullscreen();
          try {
            const orient = screen.orientation as unknown as { lock?: (o: string) => Promise<void> };
            if (orient && typeof orient.lock === "function") {
              await orient.lock("landscape");
            }
          } catch (_e) {
            // Orientação opcional
          }
        } else if (video && (video as any).webkitEnterFullscreen) {
          (video as any).webkitEnterFullscreen();
        }
      }
    } catch (err) {
      console.warn("[CustomVideoPlayer] Falha ao alternar tela cheia:", err);
    }
  }, []);

  // =========================================================================
  // Atalhos de Teclado
  // =========================================================================

  const actionsRef = useRef({
    togglePlay,
    seekBy,
    toggleMute,
    toggleFullscreen,
    setVideoVolume,
    setShowDiagnostics,
  });

  useEffect(() => {
    actionsRef.current = {
      togglePlay,
      seekBy,
      toggleMute,
      toggleFullscreen,
      setVideoVolume,
      setShowDiagnostics,
    };
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable
      ) {
        return;
      }

      switch (event.key.toLowerCase()) {
        case " ":
        case "k":
          event.preventDefault();
          actionsRef.current.togglePlay();
          break;
        case "arrowleft":
        case "j":
          event.preventDefault();
          actionsRef.current.seekBy(-10);
          break;
        case "arrowright":
        case "l":
          event.preventDefault();
          actionsRef.current.seekBy(10);
          break;
        case "m":
          event.preventDefault();
          actionsRef.current.toggleMute();
          break;
        case "f":
          event.preventDefault();
          void actionsRef.current.toggleFullscreen();
          break;
        case "arrowup":
          event.preventDefault();
          actionsRef.current.setVideoVolume(volumeRef.current + 0.1);
          break;
        case "arrowdown":
          event.preventDefault();
          actionsRef.current.setVideoVolume(volumeRef.current - 0.1);
          break;
        case "d":
          event.preventDefault();
          actionsRef.current.setShowDiagnostics((prev) => !prev);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // =========================================================================
  // Ações de Velocidade e Qualidade
  // =========================================================================

  const handleSelectPlaybackRate = (rate: number) => {
    const video = videoRef.current;
    setPlaybackRate(rate);
    if (video) video.playbackRate = rate;
    setActiveMenuTab("main");
    setSettingsOpen(false);
  };

  const handleSelectQuality = (levelIndex: number) => {
    const hls = hlsRef.current;
    if (hls) {
      hls.currentLevel = levelIndex; // -1 = Auto
      setCurrentQuality(levelIndex);
    }
    setActiveMenuTab("main");
    setSettingsOpen(false);
  };

  // =========================================================================
  // Interação Touch Mobile (Double-Tap para busca e Single-Tap para controles)
  // =========================================================================

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const now = Date.now();
    const rect = event.currentTarget.getBoundingClientRect();
    const touch = event.changedTouches[0];
    if (!touch) return;

    const side = touch.clientX - rect.left < rect.width / 2 ? "left" : "right";
    const previous = lastTapRef.current;

    if (previous && previous.side === side && now - previous.time < 300) {
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
      seekBy(side === "left" ? -10 : 10);
      lastTapRef.current = null;
      return;
    }

    lastTapRef.current = { time: now, side };
    if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);

    singleTapTimerRef.current = setTimeout(() => {
      setControlsVisible((prev) => {
        if (!prev) triggerShowControls();
        return !prev;
      });
      lastTapRef.current = null;
      singleTapTimerRef.current = null;
    }, 220);
  };

  // =========================================================================
  // Barra de Progresso: Cálculo e Tooltip
  // =========================================================================

  const handleProgressBarMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    setHoverPosition(pos * 100);
    setHoverTime(pos * (duration || 0));
  };

  const handleProgressBarMouseLeave = () => {
    setHoverPosition(null);
  };

  const handleProgressClick = (event: MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const target = pos * (duration || 0);
    handleSeekChange(target);
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPercent = duration > 0 ? (bufferedTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      onMouseMove={triggerShowControls}
      onTouchEnd={handleTouchEnd}
      style={{ touchAction: "manipulation" }}
      className={cn(
        "group relative aspect-video w-full select-none overflow-hidden rounded-2xl border border-white/10 bg-black shadow-[0_20px_70px_rgba(0,0,0,0.55)] touch-manipulation",
        className,
      )}
    >
      {/* Elemento de Vídeo HTML5 */}
      <video
        ref={videoRef}
        poster={activePoster}
        autoPlay={autoPlay}
        playsInline
        preload="metadata"
        disablePictureInPicture
        controlsList="nodownload noremoteplayback"
        onContextMenu={(e) => e.preventDefault()}
        className="size-full object-contain"
        onPlay={() => {
          setIsPlaying(true);
          onPlay?.();
          triggerShowControls();
        }}
        onPause={() => {
          setIsPlaying(false);
          onPause?.();
          setControlsVisible(true);
        }}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
        onLoadedMetadata={(e: SyntheticEvent<HTMLVideoElement>) => {
          const v = e.currentTarget;
          setDuration(v.duration || 0);
          v.volume = volume;
          v.muted = isMuted;
          v.playbackRate = playbackRate;
          setIsBuffering(false);

          // Sincronização opcional de metadados para compatibilidade com o padrão original
          if (onUpdateMetadata && (video?.id || activeEpisodeTitle)) {
            onUpdateMetadata(video?.id ?? "current", {
              duration: v.duration,
              resolution: classifyVideoResolution(v.videoHeight),
            });
          }

          // Retomada segura de initialTime após metadados carregados
          if (!hasAppliedInitialTimeRef.current && initialTimeRef.current > 0) {
            v.currentTime = initialTimeRef.current;
            hasAppliedInitialTimeRef.current = true;
          }
        }}
        onTimeUpdate={(e: SyntheticEvent<HTMLVideoElement>) => {
          const v = e.currentTarget;
          const current = v.currentTime || 0;
          const dur = v.duration || 0;
          setCurrentTime(current);

          if (v.buffered.length > 0) {
            setBufferedTime(v.buffered.end(v.buffered.length - 1));
          }

          onTimeUpdate?.(current, dur);
        }}
        onEnded={() => {
          setIsPlaying(false);
          setControlsVisible(true);
          onEnded?.();
        }}
        onError={() => {
          setIsBuffering(false);
          const errorMsg = "Erro ao carregar o vídeo.";
          setPlaybackError(errorMsg);
          onError?.(new Error(errorMsg));
        }}
      />

      {/* Overlay de Carregamento / Buffering */}
      {isBuffering && !playbackError && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black/35 backdrop-blur-[2px]">
          <Loader2 className="size-11 animate-spin text-[#a855f7]" />
        </div>
      )}

      {/* Feedback de Erro */}
      {playbackError && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/85 p-6 text-center text-white">
          <AlertCircle className="size-10 text-red-500" />
          <p className="text-base font-medium">{playbackError}</p>
          <button
            type="button"
            onClick={() => {
              setPlaybackError(null);
              setIsBuffering(true);
              if (isHlsStream && hlsRef.current && activeSrc) {
                hlsRef.current.loadSource(activeSrc);
                hlsRef.current.startLoad();
              } else if (videoRef.current && activeSrc) {
                videoRef.current.src = activeSrc;
                videoRef.current.load();
              }
            }}
            className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold hover:bg-white/20 active:scale-95"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Indicador Visual de Double Tap (+10s / -10s) */}
      {tapFeedback && (
        <div
          className={cn(
            "pointer-events-none absolute top-1/2 z-25 flex size-20 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white/95 backdrop-blur-md transition-all",
            tapFeedback === "rewind" ? "left-12" : "right-12",
          )}
        >
          <div className="flex flex-col items-center gap-1">
            {tapFeedback === "rewind" ? (
              <RotateCcw className="size-7" />
            ) : (
              <RotateCw className="size-7" />
            )}
            <span className="text-xs font-bold">{tapFeedback === "rewind" ? "-10s" : "+10s"}</span>
          </div>
        </div>
      )}

      {/* Painel Flutuante de Diagnóstico Técnico ("Stats for Nerds") */}
      {showDiagnostics && (
        <div className="absolute top-4 left-4 z-40 w-72 rounded-xl border border-white/20 bg-[#09090b]/90 p-3.5 text-xs text-white/90 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <div className="flex items-center gap-1.5 font-semibold text-[#a855f7]">
              <Activity className="size-4" />
              <span>Diagnóstico Técnico</span>
            </div>
            <button
              type="button"
              onClick={() => setShowDiagnostics(false)}
              className="text-white/60 hover:text-white"
              aria-label="Fechar diagnóstico"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <div className="mt-2.5 space-y-1.5 font-mono text-[11px]">
            <div className="flex justify-between">
              <span className="text-white/50">Resolução:</span>
              <span>{diagStats.videoWidth}x{diagStats.videoHeight}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">Formato:</span>
              <span className="text-purple-300">{classifyVideoResolution(diagStats.videoHeight)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">Motor:</span>
              <span>{isHlsStream ? "HLS.js (MSE)" : "HTML5 Video"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">Buffer à frente:</span>
              <span>{diagStats.bufferedAhead.toFixed(1)}s</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">Frames Perdidos:</span>
              <span>
                {diagStats.totalFrames > 0
                  ? `${((diagStats.droppedFrames / diagStats.totalFrames) * 100).toFixed(1)}% (${diagStats.droppedFrames}/${diagStats.totalFrames})`
                  : "0"}
              </span>
            </div>
            {diagStats.bitrate > 0 && (
              <div className="flex justify-between">
                <span className="text-white/50">Bitrate:</span>
                <span>{(diagStats.bitrate / 1000).toFixed(0)} kbps</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-white/50">Velocidade:</span>
              <span>{playbackRate}x</span>
            </div>
          </div>
        </div>
      )}

      {/* BARRA SUPERIOR (Voltar/Fechar, Título, Episódio e Navegação) */}
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/30 to-transparent p-4 transition-opacity duration-300 sm:p-5",
          controlsVisible ? "opacity-100" : "opacity-0",
        )}
      >
        <div className="flex min-w-0 items-center pr-4">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title="Voltar"
              aria-label="Voltar"
              className="pointer-events-auto mr-3 flex size-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white/80 transition hover:bg-white/20 hover:text-white active:scale-95 sm:size-9"
            >
              <ChevronLeft className="size-4" />
            </button>
          )}
          <div className="min-w-0">
            {activeTitle && (
              <h3 className="truncate text-sm font-semibold tracking-wide text-white/95 sm:text-base">
                {activeTitle}
              </h3>
            )}
            {activeEpisodeTitle && (
              <p className="truncate text-xs text-white/65">
                {activeEpisodeNumber !== undefined ? `Episódio ${activeEpisodeNumber} · ` : ""}
                {activeEpisodeTitle}
              </p>
            )}
          </div>
        </div>

        {/* Botões Rápidos de Episódio Anterior / Próximo */}
        <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2">
          {hasPrevEpisode && (
            <button
              type="button"
              onClick={onPrevEpisode}
              title="Episódio anterior"
              className="flex size-8 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white/80 transition hover:bg-white/20 hover:text-white active:scale-95 sm:size-9"
            >
              <ChevronLeft className="size-4" />
            </button>
          )}
          {hasNextEpisode && (
            <button
              type="button"
              onClick={onNextEpisode}
              title="Próximo episódio"
              className="flex size-8 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white/80 transition hover:bg-white/20 hover:text-white active:scale-95 sm:size-9"
            >
              <ChevronRight className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* BOTÃO CENTRAL DE PLAY / PAUSE (Estilo Original NOVA STREAM) */}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 z-20 flex items-center justify-center transition-opacity duration-300",
          controlsVisible && !isBuffering ? "opacity-100" : "opacity-0",
        )}
      >
        <div className="pointer-events-auto flex items-center gap-3 sm:gap-5">
          {/* Botão de retroceder 10s */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              seekBy(-10);
            }}
            aria-label="Voltar 10 segundos"
            className="flex size-11 items-center justify-center rounded-full border border-white/15 bg-black/45 text-white/90 shadow-[0_4px_24px_rgba(0,0,0,0.45)] backdrop-blur-xl transition hover:border-white/30 hover:bg-white/20 hover:text-white active:scale-95 sm:size-12"
          >
            <RotateCcw className="size-5" />
          </button>

          {/* Botão Principal Central de Play/Pause com Glow Roxo */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              togglePlay();
            }}
            aria-label={isPlaying ? "Pausar" : "Reproduzir"}
            className="flex size-14 items-center justify-center rounded-full border border-white/35 bg-white/20 text-white shadow-[0_10px_40px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.35)] backdrop-blur-2xl transition hover:border-[#a855f7] hover:bg-[#a855f7]/30 hover:shadow-[0_0_30px_rgba(168,85,247,0.4)] active:scale-95 sm:size-16"
          >
            {isPlaying ? (
              <Pause className="size-6 fill-current" />
            ) : (
              <Play className="ml-1 size-6 fill-current" />
            )}
          </button>

          {/* Botão de avançar 10s */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              seekBy(10);
            }}
            aria-label="Avançar 10 segundos"
            className="flex size-11 items-center justify-center rounded-full border border-white/15 bg-black/45 text-white/90 shadow-[0_4px_24px_rgba(0,0,0,0.45)] backdrop-blur-xl transition hover:border-white/30 hover:bg-white/20 hover:text-white active:scale-95 sm:size-12"
          >
            <RotateCw className="size-5" />
          </button>
        </div>
      </div>

      {/* BARRA INFERIOR DE CONTROLES */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 z-20 flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/45 to-transparent px-3 pb-3 pt-6 transition-opacity duration-300 sm:px-5 sm:pb-4",
          controlsVisible ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        {/* BARRA DE PROGRESSO COM BUFFER E HOVER */}
        <div
          role="slider"
          aria-label="Progresso do vídeo"
          aria-valuemin={0}
          aria-valuemax={duration || 0}
          aria-valuenow={currentTime}
          tabIndex={0}
          onClick={handleProgressClick}
          onMouseMove={handleProgressBarMouseMove}
          onMouseLeave={handleProgressBarMouseLeave}
          className="group/progress relative mb-3 flex h-3 w-full cursor-pointer items-center"
        >
          {/* Tooltip com Minutagem no Hover */}
          {hoverPosition !== null && (
            <div
              className="pointer-events-none absolute -top-8 -translate-x-1/2 rounded-md bg-[#131316] px-2 py-1 text-[11px] font-medium text-white shadow-xl border border-white/10"
              style={{ left: `${hoverPosition}%` }}
            >
              {formatTime(hoverTime)}
            </div>
          )}

          {/* Trilho Fundo */}
          <div className="relative h-1 w-full rounded-full bg-white/20 transition-all group-hover/progress:h-1.5">
            {/* Faixa do Buffer */}
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-white/35"
              style={{ width: `${Math.min(100, Math.max(0, bufferedPercent))}%` }}
            />
            {/* Faixa de Reprodução */}
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-purple-500 to-[#a855f7]"
              style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
            />
          </div>

          {/* Marcador / Thumb Roxo com Glow da NOVA STREAM */}
          <div
            className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/60 bg-[#a855f7] shadow-[0_0_10px_rgba(168,85,247,0.9)] transition-transform group-hover/progress:scale-125"
            style={{ left: `${Math.min(99.5, Math.max(0.5, progressPercent))}%` }}
          />
        </div>

        {/* LINHA DE BOTÕES E FUNÇÕES */}
        <div className="flex items-center justify-between text-white">
          {/* Grupo Esquerdo: Play, Volume e Tempo */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={togglePlay}
              className="flex size-8 items-center justify-center rounded-lg text-white/90 transition hover:bg-white/15 hover:text-white"
              aria-label={isPlaying ? "Pausar" : "Reproduzir"}
            >
              {isPlaying ? <Pause className="size-4 fill-current" /> : <Play className="size-4 fill-current ml-0.5" />}
            </button>

            {/* Controle de Volume com Slider Horizontal Expansível */}
            <div className="group/vol flex items-center">
              <button
                type="button"
                onClick={toggleMute}
                className="flex size-8 items-center justify-center rounded-lg text-white/90 transition hover:bg-white/15 hover:text-white"
                aria-label={isMuted ? "Ativar som" : "Silenciar"}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="size-4 text-red-400" />
                ) : volume < 0.5 ? (
                  <Volume1 className="size-4" />
                ) : (
                  <Volume2 className="size-4" />
                )}
              </button>

              <div className="hidden w-0 overflow-hidden transition-all duration-200 group-hover/vol:w-16 group-hover/vol:ml-1 sm:block">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={(e) => setVideoVolume(Number(e.target.value))}
                  aria-label="Volume"
                  className="h-1 w-16 cursor-pointer accent-[#a855f7]"
                />
              </div>
            </div>

            {/* Minutagem (Atual / Total) */}
            <div className="flex items-center gap-1 text-[11px] font-medium tabular-nums text-white/90 sm:text-xs">
              <span>{formatTime(currentTime)}</span>
              <span className="text-white/40">/</span>
              <span className="text-white/60">{formatTime(duration)}</span>
            </div>
          </div>

          {/* Grupo Direito: Configurações e Tela Cheia */}
          <div className="relative flex items-center gap-1.5 sm:gap-2">
            {/* Menu Popover de Configurações */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setSettingsOpen(!settingsOpen);
                  setActiveMenuTab("main");
                }}
                aria-label="Configurações do player"
                aria-expanded={settingsOpen}
                className={cn(
                  "flex size-8 items-center justify-center rounded-lg text-white/90 transition hover:bg-white/15 hover:text-white",
                  settingsOpen && "bg-white/15 text-white",
                )}
              >
                <Settings className="size-4" />
              </button>

              {settingsOpen && (
                <div className="absolute bottom-11 right-0 z-30 w-56 overflow-hidden rounded-2xl border border-white/10 bg-[#111116]/95 p-1.5 text-xs text-white/90 shadow-2xl backdrop-blur-2xl">
                  {/* Aba Principal do Menu */}
                  {activeMenuTab === "main" && (
                    <div className="flex flex-col gap-0.5">
                      <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-white/45">
                        Configurações do Player
                      </div>

                      {/* Item de Velocidade */}
                      <button
                        type="button"
                        onClick={() => setActiveMenuTab("speed")}
                        className="flex items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-white/10 transition"
                      >
                        <span>Velocidade</span>
                        <span className="text-[11px] text-[#a855f7] font-semibold">{playbackRate}x ›</span>
                      </button>

                      {/* Item de Qualidade (Apenas se houver faixas HLS detectadas) */}
                      {isHlsStream && qualityLevels.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setActiveMenuTab("quality")}
                          className="flex items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-white/10 transition"
                        >
                          <span>Qualidade</span>
                          <span className="text-[11px] text-[#a855f7] font-semibold">
                            {currentQuality === -1
                              ? "Automática"
                              : qualityLevels[currentQuality]?.label || "Padrão"} ›
                          </span>
                        </button>
                      )}

                      {/* Item de Diagnóstico Técnico */}
                      <button
                        type="button"
                        onClick={() => {
                          setShowDiagnostics((prev) => !prev);
                          setSettingsOpen(false);
                        }}
                        className="flex items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-white/10 transition"
                      >
                        <span className="flex items-center gap-1.5">
                          <Activity className="size-3.5 text-[#a855f7]" />
                          Diagnóstico Técnico
                        </span>
                        <span className="text-[10px] text-white/40">Tecla D</span>
                      </button>

                      {/* Item de Legendas (Exibe estado indisponível sem falsas simulações) */}
                      <div className="flex items-center justify-between rounded-xl px-3 py-2 text-white/40">
                        <span>Legendas</span>
                        <span className="text-[11px] text-white/30 font-medium">Indisponível</span>
                      </div>
                    </div>
                  )}

                  {/* Submenu: Velocidade */}
                  {activeMenuTab === "speed" && (
                    <div className="flex flex-col gap-0.5 max-h-56 overflow-y-auto custom-scrollbar">
                      <button
                        type="button"
                        onClick={() => setActiveMenuTab("main")}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold uppercase text-white/50 hover:text-white"
                      >
                        ‹ Voltar
                      </button>
                      <div className="my-1 border-t border-white/10" />
                      {PLAYBACK_RATES.map((rate) => (
                        <button
                          key={rate}
                          type="button"
                          onClick={() => handleSelectPlaybackRate(rate)}
                          className="flex items-center justify-between rounded-xl px-3 py-1.5 hover:bg-white/10 transition"
                        >
                          <span>{rate}x {rate === 1 && "(Normal)"}</span>
                          {playbackRate === rate && <Check className="size-3.5 text-[#a855f7]" />}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Submenu: Qualidade HLS */}
                  {activeMenuTab === "quality" && (
                    <div className="flex flex-col gap-0.5 max-h-56 overflow-y-auto custom-scrollbar">
                      <button
                        type="button"
                        onClick={() => setActiveMenuTab("main")}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold uppercase text-white/50 hover:text-white"
                      >
                        ‹ Voltar
                      </button>
                      <div className="my-1 border-t border-white/10" />
                      <button
                        type="button"
                        onClick={() => handleSelectQuality(-1)}
                        className="flex items-center justify-between rounded-xl px-3 py-1.5 hover:bg-white/10 transition"
                      >
                        <span>Automática</span>
                        {currentQuality === -1 && <Check className="size-3.5 text-[#a855f7]" />}
                      </button>
                      {qualityLevels.map((lvl) => (
                        <button
                          key={lvl.id}
                          type="button"
                          onClick={() => handleSelectQuality(lvl.id)}
                          className="flex items-center justify-between rounded-xl px-3 py-1.5 hover:bg-white/10 transition"
                        >
                          <span>{lvl.label}</span>
                          {currentQuality === lvl.id && <Check className="size-3.5 text-[#a855f7]" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Botão de Tela Cheia */}
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
              className="flex size-8 items-center justify-center rounded-lg text-white/90 transition hover:bg-white/15 hover:text-white"
            >
              {isFullscreen ? <Minimize className="size-4" /> : <Maximize className="size-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
