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
  AlertCircle,
  ChevronLeft,
  Loader2,
  Maximize,
  Minimize,
  Pause,
  Play,
  Settings,
  Volume2,
  VolumeX,
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
  onNextEpisode: _onNextEpisode,
  onPrevEpisode: _onPrevEpisode,
  hasNextEpisode: _hasNextEpisode = false,
  hasPrevEpisode: _hasPrevEpisode = false,
  className,
}: CustomVideoPlayerProps) {
  // Normalização unificada entre a interface original NOVA STREAM e a interface Hikari
  const activeSrc = src ?? video?.url ?? null;
  const activePoster = poster ?? video?.thumbnailUrl;
  const _activeTitle = title ?? video?.title;
  const _activeEpisodeNumber = episodeNumber ?? video?.episodeNumber;
  const activeEpisodeTitle = episodeTitle ?? video?.episodeTitle;

  // Referências aos elementos DOM e instâncias
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const settingsMenuRef = useRef<HTMLDivElement | null>(null);
  const settingsButtonRef = useRef<HTMLButtonElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const hideControlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapRef = useRef<{ time: number; x: number; y: number; side: "left" | "right" } | null>(null);
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Retomada estável de tempo inicial: aplica apenas uma vez quando o vídeo estiver pronto
  const initialTimeRef = useRef<number>(initialTime);
  const hasAppliedInitialTimeRef = useRef<boolean>(false);

  useEffect(() => {
    initialTimeRef.current = initialTime;
    hasAppliedInitialTimeRef.current = false;
  }, [activeSrc, initialTime]);

  // Estados de reprodução e tempo
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [, setBufferedTime] = useState<number>(0);
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

  // HLS e Qualidade
  const [qualityLevels, setQualityLevels] = useState<CustomVideoPlayerQualityLevel[]>([]);
  const [currentQuality, setCurrentQuality] = useState<number>(-1); // -1 = Auto
  const [isHlsStream, setIsHlsStream] = useState<boolean>(false);
  const [detectedResolution, setDetectedResolution] = useState<string>("N/D");

  // Fechar menu de configurações ao clicar/tocar fora
  useEffect(() => {
    if (!settingsOpen) return;

    const handleClickOutside = (e: Event) => {
      const target = e.target as Node | null;
      if (!target || !document.contains(target)) return;
      if (
        settingsMenuRef.current?.contains(target) ||
        settingsButtonRef.current?.contains(target)
      ) {
        return;
      }
      setSettingsOpen(false);
    };

    document.addEventListener("pointerdown", handleClickOutside);
    return () => {
      document.removeEventListener("pointerdown", handleClickOutside);
    };
  }, [settingsOpen]);

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
        if (!settingsOpen) {
          setControlsVisible(false);
        }
      }, 3500);
    }
  }, [clearHideTimer, isPlaying, settingsOpen]);

  // =========================================================================
  // Inicialização e Gerenciamento do Vídeo e HLS
  // =========================================================================

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeSrc) {
      setQualityLevels([]);
      setIsHlsStream(false);
      setDetectedResolution("N/D");
      return;
    }

    setPlaybackError(null);
    setIsBuffering(true);
    hasAppliedInitialTimeRef.current = false;
    setDetectedResolution("N/D");

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
      void video
        .play()
        .then(() => {
          setIsPlaying(true);
          triggerShowControls();
        })
        .catch(() => {
          setIsPlaying(false);
        });
    } else {
      video.pause();
      setIsPlaying(false);
      setControlsVisible(true);
    }
  }, [triggerShowControls]);

  const seekBy = useCallback(
    (seconds: number) => {
      const video = videoRef.current;
      if (!video) return;

      const maxDuration = Number.isFinite(video.duration) ? video.duration : duration;
      const target = Math.min(Math.max(video.currentTime + seconds, 0), maxDuration || 0);
      video.currentTime = target;
      setCurrentTime(target);
      triggerShowControls();
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
        } catch {
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
          } catch {
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
  });

  useEffect(() => {
    actionsRef.current = {
      togglePlay,
      seekBy,
      toggleMute,
      toggleFullscreen,
      setVideoVolume,
    };
  }, [togglePlay, seekBy, toggleMute, toggleFullscreen, setVideoVolume]);

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
    setSettingsOpen(false);
    setActiveMenuTab("main");
  };

  const handleSelectQuality = (levelIndex: number) => {
    const hls = hlsRef.current;
    setCurrentQuality(levelIndex);
    if (hls) {
      hls.currentLevel = levelIndex; // -1 = Auto
    }
    setSettingsOpen(false);
    setActiveMenuTab("main");
  };

  // =========================================================================
  // Interação Touch Mobile e Click (Double-Tap: ±10s e Single-Tap: Play/Pause)
  // =========================================================================

  const handleVideoTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.changedTouches[0];
    if (!touch) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const side: "left" | "right" = x < rect.width / 2 ? "left" : "right";
    const now = Date.now();
    const previous = lastTapRef.current;

    // Detecta duplo toque rápido no mesmo lado (< 300ms)
    if (previous && previous.side === side && now - previous.time < 300) {
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
      lastTapRef.current = null;
      seekBy(side === "left" ? -10 : 10);
      return;
    }

    lastTapRef.current = { time: now, x: touch.clientX, y: touch.clientY, side };
    if (singleTapTimerRef.current) {
      clearTimeout(singleTapTimerRef.current);
    }

    singleTapTimerRef.current = setTimeout(() => {
      togglePlay();
      lastTapRef.current = null;
      singleTapTimerRef.current = null;
    }, 280);
  };

  const handleVideoClick = (event: MouseEvent<HTMLDivElement>) => {
    if (typeof window !== "undefined" && "ontouchstart" in window && navigator.maxTouchPoints > 0) {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const side: "left" | "right" = x < rect.width / 2 ? "left" : "right";
    const now = Date.now();
    const previous = lastTapRef.current;

    if (previous && previous.side === side && now - previous.time < 300) {
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
      lastTapRef.current = null;
      seekBy(side === "left" ? -10 : 10);
      return;
    }

    lastTapRef.current = { time: now, x: event.clientX, y: event.clientY, side };
    if (singleTapTimerRef.current) {
      clearTimeout(singleTapTimerRef.current);
    }

    singleTapTimerRef.current = setTimeout(() => {
      togglePlay();
      lastTapRef.current = null;
      singleTapTimerRef.current = null;
    }, 280);
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={triggerShowControls}
      onPointerMove={(e) => {
        if (e.pointerType !== "touch") {
          triggerShowControls();
        }
      }}
      style={{ touchAction: "manipulation" }}
      className={cn(
        "hikari-player relative aspect-video w-full select-none overflow-hidden rounded-2xl border border-white/10 bg-black shadow-[0_20px_70px_rgba(0,0,0,0.55)] touch-manipulation",
        isFullscreen ? "fixed inset-0 z-50 h-screen w-screen rounded-none border-0" : "",
        className,
      )}
      tabIndex={0}
      role="region"
      aria-label="Reprodutor de vídeo Hikari"
    >
      <style>{`
        @media (max-width: 639px) {
          /* MOBILE ONLY — visual baseado exatamente na referência original do Hikari */
          .hikari-player:not(:fullscreen) .hikari-mobile-controls {
            position: absolute !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            height: 72px !important;
            padding: 0 12px 5px !important;
            display: block !important;
            background: linear-gradient(to top, rgba(0,0,0,.62), rgba(0,0,0,0)) !important;
            z-index: 10 !important;
            box-sizing: border-box !important;
          }

          /* A barra fica sempre no limite inferior e não empurra os outros controles */
          .hikari-player:not(:fullscreen) .hikari-progress-shell {
            position: absolute !important;
            left: 12px !important;
            right: 12px !important;
            bottom: 0 !important;
            top: auto !important;
            width: auto !important;
            height: 5px !important;
            margin: 0 !important;
            padding: 0 !important;
            border: 0 !important;
            border-radius: 999px !important;
            background: transparent !important;
            box-shadow: none !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            box-sizing: border-box !important;
          }

          .hikari-player:not(:fullscreen) .hikari-progress-track {
            position: absolute !important;
            left: 0 !important;
            right: 0 !important;
            top: 50% !important;
            height: 2px !important;
            transform: translateY(-50%) !important;
            background: rgba(255,255,255,.42) !important;
            border-radius: 999px !important;
          }

          .hikari-player:not(:fullscreen) .hikari-progress-track > div {
            height: 100% !important;
            background: rgba(255,255,255,.95) !important;
          }

          .hikari-player:not(:fullscreen) .hikari-progress-shell > div:nth-child(2) {
            width: 7px !important;
            height: 7px !important;
            background: #fff !important;
            box-shadow: 0 0 5px rgba(255,255,255,.55) !important;
          }

          /* Uma única linha: tempo à esquerda e os 3 controles existentes à direita */
          .hikari-player:not(:fullscreen) .hikari-mobile-time-row {
            position: absolute !important;
            left: 12px !important;
            right: 12px !important;
            bottom: 12px !important;
            top: auto !important;
            width: auto !important;
            height: 32px !important;
            margin: 0 !important;
            padding: 0 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            gap: 8px !important;
            border: 0 !important;
            border-radius: 0 !important;
            background: transparent !important;
            box-shadow: none !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            box-sizing: border-box !important;
          }

          .hikari-player:not(:fullscreen) .hikari-mobile-time-row > div:first-child {
            flex: 0 0 auto !important;
            min-width: 0 !important;
            font-size: 10px !important;
            line-height: 32px !important;
            text-shadow: 0 1px 3px rgba(0,0,0,.95) !important;
            white-space: nowrap !important;
          }

          .hikari-player:not(:fullscreen) .hikari-mobile-time-row > div:last-child {
            flex: 0 0 auto !important;
            margin-left: auto !important;
            display: flex !important;
            align-items: center !important;
            gap: 2px !important;
            height: 32px !important;
          }

          /* Somente os botões que o Hikari já possui */
          .hikari-player:not(:fullscreen) .hikari-volume,
          .hikari-player:not(:fullscreen) .hikari-settings,
          .hikari-player:not(:fullscreen) .hikari-mobile-fullscreen {
            width: 30px !important;
            height: 30px !important;
            min-width: 30px !important;
            min-height: 30px !important;
            padding: 0 !important;
            border: 0 !important;
            border-radius: 999px !important;
            background: transparent !important;
            box-shadow: none !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            flex: 0 0 30px !important;
          }

          .hikari-player:not(:fullscreen) .hikari-volume svg,
          .hikari-player:not(:fullscreen) .hikari-settings svg,
          .hikari-player:not(:fullscreen) .hikari-mobile-fullscreen svg {
            width: 17px !important;
            height: 17px !important;
            flex: 0 0 auto !important;
            filter: drop-shadow(0 1px 2px rgba(0,0,0,.95));
          }

          /* O menu de configurações sobe a partir do botão, sem sair da área do player */
          .hikari-player:not(:fullscreen) .hikari-settings + * {
            bottom: 34px !important;
            right: 0 !important;
          }
        }
      `}</style>

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

          if (v.videoHeight > 0) {
            setDetectedResolution(classifyVideoResolution(v.videoHeight));
          }

          if (onUpdateMetadata && (video?.id || activeEpisodeTitle)) {
            onUpdateMetadata(video?.id ?? "current", {
              duration: v.duration,
              resolution: classifyVideoResolution(v.videoHeight),
            });
          }

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

      {/* Camada transparente de captura de gestos no vídeo (1 toque: play/pause, 2 toques: ±10s) */}
      <div
        onClick={handleVideoClick}
        onTouchEnd={handleVideoTouchEnd}
        className="absolute inset-0 z-10 cursor-pointer"
        aria-label="Área de controle do vídeo"
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

      {/* Botão de Fechar / Voltar opcional */}
      {onClose && controlsVisible && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between p-3 sm:p-4">
          <button
            type="button"
            onClick={onClose}
            title="Voltar"
            aria-label="Voltar"
            className="pointer-events-auto flex size-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white/80 transition hover:bg-white/20 hover:text-white active:scale-95 sm:size-9"
          >
            <ChevronLeft className="size-4" />
          </button>
        </div>
      )}

      {/* CONTROLES CENTRAIS CIRCULARES COM EFEITO DE VIDRO FOSCO */}
      {controlsVisible && (
        <div className="pointer-events-none absolute inset-x-0 top-[32%] z-20 flex -translate-y-1/2 items-center justify-center sm:top-[40%]">
          <div
            onPointerDown={triggerShowControls}
            className="pointer-events-auto flex items-center gap-2 sm:gap-3"
          >
            {/* Retrocesso 10 segundos */}
            <button
              type="button"
              onClick={() => seekBy(-10)}
              className="hikari-skip flex size-10 items-center justify-center rounded-full border-0 bg-black/35 text-[10px] font-semibold text-white/90 shadow-[0_8px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl transition hover:border-white/30 hover:bg-white/15 active:scale-95 sm:size-11 sm:text-[11px]"
              aria-label="Voltar 10 segundos"
            >
              -10s
            </button>

            {/* Play / Pause Central */}
            <button
              type="button"
              onClick={togglePlay}
              className="flex size-12 items-center justify-center rounded-full border border-white/30 bg-white/[0.14] text-white shadow-[0_10px_40px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.22)] backdrop-blur-2xl transition hover:border-white/45 hover:bg-white/20 active:scale-95 sm:size-14"
              aria-label={isPlaying ? "Pausar" : "Reproduzir"}
            >
              {isPlaying ? (
                <Pause className="size-5 fill-current" />
              ) : (
                <Play className="ml-0.5 size-5 fill-current" />
              )}
            </button>

            {/* Avanço 10 segundos */}
            <button
              type="button"
              onClick={() => seekBy(10)}
              className="hikari-skip flex size-10 items-center justify-center rounded-full border-0 bg-black/35 text-[10px] font-semibold text-white/90 shadow-[0_8px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl transition hover:border-white/30 hover:bg-white/15 active:scale-95 sm:size-11 sm:text-[11px]"
              aria-label="Avançar 10 segundos"
            >
              +10s
            </button>
          </div>
        </div>
      )}

      {/* BARRA INFERIOR DE CONTROLES DO HIKARI */}
      {controlsVisible && (
        <div
          onPointerDown={triggerShowControls}
          className="hikari-mobile-controls absolute inset-x-0 bottom-0 z-20 px-2 pb-2 sm:px-5 sm:pb-4"
        >
          {/* Barra de Progresso Arredondada com Marcador Roxo */}
          <div className="hikari-progress-shell relative h-5 rounded-full border border-white/10 bg-black/30 px-2 backdrop-blur-xl shadow-[0_8px_28px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.06)] sm:h-7 sm:px-3">
            <div className="hikari-progress-track pointer-events-none absolute inset-x-2 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-white/20 sm:inset-x-3 sm:h-1.5">
              <div
                className="h-full rounded-full bg-white/90"
                style={{
                  width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                }}
              />
            </div>

            {/* Ponto Roxo Característico com Brilho Neon */}
            <div
              className="pointer-events-none absolute top-1/2 size-1.5 -translate-y-1/2 -translate-x-1/2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.75)] sm:size-2"
              style={{
                left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
              }}
            />

            <input
              aria-label="Progresso do episódio"
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={Math.min(currentTime, duration || 0)}
              onChange={(event) => handleSeekChange(Number(event.target.value))}
              className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent opacity-0"
            />
          </div>

          {/* Linha Inferior de Tempo e Ações */}
          <div className="hikari-mobile-time-row mt-1 flex items-center gap-1.5 rounded-full border border-white/15 bg-black/35 px-2 py-1 backdrop-blur-xl shadow-[0_10px_35px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.08)] sm:gap-2 sm:px-3 sm:py-1.5">
            {/* Indicador de Tempo */}
            <div className="flex shrink-0 items-center gap-1.5 text-[10px] font-medium tabular-nums tracking-wide text-white/90 sm:text-[11px]">
              <span>{formatTime(currentTime)}</span>
              <span className="text-white/35">/</span>
              <span className="text-white/65">{formatTime(duration)}</span>
            </div>

            {/* Botões de Ação à Direita: Volume, Configurações, Tela Cheia */}
            <div className="pointer-events-auto ml-auto flex items-center gap-1.5 sm:gap-2">
              {/* Botão de Volume / Mudo */}
              <button
                type="button"
                onClick={toggleMute}
                className="hikari-volume flex size-8 items-center justify-center rounded-full border border-white/15 bg-white/[0.08] text-white/90 shadow-[0_8px_28px_rgba(0,0,0,0.35)] backdrop-blur-xl transition hover:bg-white/15 hover:border-white/25 active:scale-95 sm:size-9"
                aria-label={isMuted ? "Ativar som" : "Silenciar"}
              >
                {isMuted ? (
                  <VolumeX className="size-3.5 sm:size-4" />
                ) : (
                  <Volume2 className="size-3.5 sm:size-4" />
                )}
              </button>

              {/* Botão e Menu Popover de Configurações */}
              <div className="relative">
                <button
                  ref={settingsButtonRef}
                  type="button"
                  onClick={() => setSettingsOpen((open) => !open)}
                  className={`hikari-settings flex size-9 items-center justify-center rounded-full border border-white/15 bg-white/[0.08] text-white/90 shadow-[0_8px_28px_rgba(0,0,0,0.35)] backdrop-blur-xl transition hover:bg-white/15 hover:border-white/25 active:scale-95 sm:size-10 ${
                    settingsOpen ? "bg-white/15 border-white/30" : ""
                  }`}
                  aria-label="Configurações do player"
                  aria-expanded={settingsOpen}
                >
                  <Settings className="size-3.5 sm:size-4" />
                </button>

                {settingsOpen && (
                  <div
                    ref={settingsMenuRef}
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="absolute bottom-11 right-0 z-30 w-56 sm:w-60 rounded-2xl border border-white/10 bg-[#111116]/95 p-2 text-sm shadow-2xl backdrop-blur-xl select-none"
                  >
                    <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
                      Configurações
                    </div>

                    {/* Velocidade de Reprodução */}
                    <div className="mt-1 rounded-xl px-3 py-2">
                      <div className="mb-2 text-xs text-white/75">Velocidade</div>
                      <div className="grid grid-cols-5 gap-1">
                        {[0.75, 1, 1.25, 1.5, 2].map((rate) => (
                          <button
                            key={rate}
                            type="button"
                            onClick={() => handleSelectPlaybackRate(rate)}
                            className={`rounded-lg px-1 py-1.5 text-[11px] font-medium transition ${
                              playbackRate === rate
                                ? "bg-[#a855f7] text-white"
                                : "bg-white/5 text-white/65 hover:bg-white/10"
                            }`}
                          >
                            {rate}x
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Qualidade do Vídeo (se disponível em HLS ou detectada) */}
                    {(qualityLevels.length > 0 || detectedResolution !== "N/D") && (
                      <div className="mt-1 border-t border-white/10 px-3 pt-2 pb-1.5">
                        <div className="mb-2 text-xs text-white/75">Qualidade</div>
                        <div className="flex flex-wrap gap-1">
                          <button
                            type="button"
                            onClick={() => handleSelectQuality(-1)}
                            className={`rounded-lg px-2 py-1 text-[11px] font-medium transition ${
                              currentQuality === -1
                                ? "bg-[#a855f7] text-white"
                                : "bg-white/5 text-white/65 hover:bg-white/10"
                            }`}
                          >
                            {detectedResolution !== "N/D" && qualityLevels.length === 0
                              ? `Auto (${detectedResolution})`
                              : "Auto"}
                          </button>
                          {qualityLevels.map((lvl) => (
                            <button
                              key={lvl.id}
                              type="button"
                              onClick={() => handleSelectQuality(lvl.id)}
                              className={`rounded-lg px-2 py-1 text-[11px] font-medium transition ${
                                currentQuality === lvl.id
                                  ? "bg-[#a855f7] text-white"
                                  : "bg-white/5 text-white/65 hover:bg-white/10"
                              }`}
                            >
                              {lvl.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Botão de Tela Cheia */}
              <button
                type="button"
                onClick={toggleFullscreen}
                className="hikari-mobile-fullscreen flex size-9 items-center justify-center rounded-full border border-white/15 bg-white/[0.08] text-white/90 shadow-[0_8px_28px_rgba(0,0,0,0.35)] backdrop-blur-xl transition hover:bg-white/15 hover:border-white/25 active:scale-95 sm:size-9"
                aria-label={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
              >
                {isFullscreen ? (
                  <Minimize className="size-4 sm:size-4" />
                ) : (
                  <Maximize className="size-4 sm:size-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
