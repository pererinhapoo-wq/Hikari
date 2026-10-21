import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import Hls from 'hls.js';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Volume1,
  Maximize,
  Minimize,
  RotateCcw,
  RotateCw,
  Gauge,
  Info,
  X,
  Check,
} from 'lucide-react';
import {
  VideoItem,
  QualityLevel,
  PlaybackSpeed,
  VideoResolution,
  StreamQualityOption,
} from '../../types/video';
import {
  getLocalVideoUrl,
  classifyVideoResolution,
  formatDuration,
} from '../../services/videoData';

export type { VideoItem, QualityLevel, PlaybackSpeed, VideoResolution, StreamQualityOption };

export interface VideoMetadataUpdates {
  duration?: number;
  durationFormatted?: string;
  resolution?: VideoResolution;
}

export interface CustomVideoPlayerProps {
  /** Objeto de vídeo original do episódio */
  video?: VideoItem | null;
  /** Ação de fechamento / retorno da tela quando usado em modal (opcional) */
  onClose?: () => void;
  /** Iniciar reprodução automaticamente quando o vídeo estiver pronto */
  autoPlay?: boolean;
  /** Callback para sincronização de metadados do vídeo */
  onUpdateMetadata?: (videoId: string, metadata: VideoMetadataUpdates) => void;

  /** Tempo inicial em segundos para retomar reprodução */
  initialTime?: number;
  /** Callback periódico de tempo e duração para persistência do progresso */
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  /** Callback ao finalizar reprodução */
  onEnded?: () => void;
  /** Callback em erro de reprodução */
  onError?: (error: Error | string) => void;
  /** Próximo episódio (mantido para compatibilidade de props) */
  onNextEpisode?: () => void;
  /** Episódio anterior (mantido para compatibilidade de props) */
  onPrevEpisode?: () => void;
  /** Se há próximo episódio */
  hasNextEpisode?: boolean;
  /** Se há episódio anterior */
  hasPrevEpisode?: boolean;
  /** Classe CSS customizada para o contêiner */
  className?: string;
}

const PLAYBACK_SPEEDS: PlaybackSpeed[] = [0.5, 0.75, 1, 1.25, 1.5, 2];
const INACTIVITY_DELAY = 5000; // ~5 segundos exatos de inatividade confortável antes de ocultar controles durante reprodução

export const CustomVideoPlayer: React.FC<CustomVideoPlayerProps> = ({
  video,
  onClose,
  autoPlay = true,
  onUpdateMetadata,
  initialTime = 0,
  onTimeUpdate,
  onEnded,
  onError,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const settingsAreaRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const initialTimeAppliedRef = useRef<boolean>(false);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playPauseFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const justOpenedMenuTimeRef = useRef<number>(0);

  // Estados de reprodução
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(video?.duration || 0);
  const [bufferedTime, setBufferedTime] = useState<number>(0);
  const [volume, setVolume] = useState<number>(0.85);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1);

  // Estados visuais dos controles da Nova Stream
  const [controlsVisible, setControlsVisible] = useState<boolean>(true);
  const [showSettingsMenu, setShowSettingsMenu] = useState<boolean>(false);
  const [playPauseFeedback, setPlayPauseFeedback] = useState<'play' | 'pause' | null>(null);

  // Hover na barra de progresso
  const [isHoveringProgress, setIsHoveringProgress] = useState<boolean>(false);
  const [hoverPosition, setHoverPosition] = useState<number>(0);
  const [hoverTime, setHoverTime] = useState<number>(0);

  // Erro e suporte HLS
  const [videoError, setVideoError] = useState<string | null>(null);
  const [isHlsActive, setIsHlsActive] = useState<boolean>(false);

  // Refs síncronas para controle seguro de temporizadores sem conflito de renderização ou closures antigas
  const isPlayingRef = useRef<boolean>(isPlaying);
  const showSettingsMenuRef = useRef<boolean>(showSettingsMenu);
  const controlsVisibleRef = useRef<boolean>(controlsVisible);

  isPlayingRef.current = isPlaying;
  showSettingsMenuRef.current = showSettingsMenu;
  controlsVisibleRef.current = controlsVisible;

  // Obter URL do vídeo
  const effectiveVideoUrl = useMemo(() => {
    if (!video) return '';
    if (video.isLocalFile) {
      return getLocalVideoUrl(video.id) || video.videoUrl || video.url || '';
    }
    return video.videoUrl || video.url || '';
  }, [video]);

  const effectivePosterUrl = video?.posterUrl || video?.thumbnailUrl || '';

  const isHlsUrl = useCallback((url: string): boolean => {
    if (!url) return false;
    const cleanUrl = url.split('?')[0].toLowerCase();
    return cleanUrl.endsWith('.m3u8') || url.includes('.m3u8') || url.includes('/hls/');
  }, []);

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Limpar temporizador de inatividade
  const clearInactivityTimer = useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = null;
    }
  }, []);

  // Agenda a ocultação automática dos controles após o tempo de inatividade durante reprodução (~5 segundos)
  const scheduleControlsHide = useCallback((delay = INACTIVITY_DELAY) => {
    clearInactivityTimer();

    const el = videoRef.current;
    // O vídeo está em reprodução se o elemento de mídia estiver despausado e não finalizado,
    // ou se a ref síncrona isPlayingRef indicar reprodução ativa
    const isVideoPlaying = el ? (!el.paused && !el.ended) : isPlayingRef.current;

    // Regra: se estiver pausado ou com o menu de velocidade aberto, não oculta
    if (!isVideoPlaying || showSettingsMenuRef.current) {
      return;
    }

    controlsTimeoutRef.current = setTimeout(() => {
      const currentEl = videoRef.current;
      const isStillPlaying = currentEl ? (!currentEl.paused && !currentEl.ended) : isPlayingRef.current;

      if (isStillPlaying && !showSettingsMenuRef.current) {
        setControlsVisible(false);
        controlsVisibleRef.current = false;
      }
      controlsTimeoutRef.current = null;
    }, delay);
  }, [clearInactivityTimer]);

  // Reiniciar temporizador de inatividade: exibe controles e, se reproduzindo, inicia contagem
  const resetInactivityTimer = useCallback(() => {
    setControlsVisible(true);
    controlsVisibleRef.current = true;
    scheduleControlsHide();
  }, [scheduleControlsHide]);

  // Monitorar mudanças em isPlaying e showSettingsMenu
  useEffect(() => {
    if (!isPlaying || showSettingsMenu) {
      clearInactivityTimer();
      setControlsVisible(true);
      controlsVisibleRef.current = true;
    } else {
      resetInactivityTimer();
    }
  }, [isPlaying, showSettingsMenu, resetInactivityTimer, clearInactivityTimer]);

  const applyInitialTime = useCallback(() => {
    const el = videoRef.current;
    if (!el || initialTimeAppliedRef.current) return;
    if (initialTime && initialTime > 0) {
      try {
        el.currentTime = initialTime;
        setCurrentTime(initialTime);
        initialTimeAppliedRef.current = true;
      } catch {
        // tenta novamente no carregamento de metadados
      }
    }
  }, [initialTime]);

  // Inicialização e gerenciamento do stream de vídeo (HLS / Direto)
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl || !effectiveVideoUrl) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    initialTimeAppliedRef.current = false;
    setVideoError(null);

    const isHls = isHlsUrl(effectiveVideoUrl);
    setIsHlsActive(isHls);

    if (isHls && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 60,
        capLevelToPlayerSize: false,
      });
      hlsRef.current = hls;
      hls.loadSource(effectiveVideoUrl);
      hls.attachMedia(videoEl);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        applyInitialTime();
        if (autoPlay) {
          videoEl.play().catch((err) => {
            console.warn('Auto-play restrito pelo navegador:', err);
          });
        }
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              setVideoError('Não foi possível estabelecer transmissão contínua com o stream HLS.');
              onError?.('Não foi possível carregar o stream HLS.');
              break;
          }
        }
      });

      return () => {
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }
      };
    } else if (isHls && videoEl.canPlayType('application/vnd.apple.mpegurl')) {
      videoEl.src = effectiveVideoUrl;
      setIsHlsActive(true);
      applyInitialTime();
      if (autoPlay) {
        videoEl.play().catch(() => setIsPlaying(false));
      }
    } else {
      videoEl.src = effectiveVideoUrl;
      setIsHlsActive(false);
      applyInitialTime();
      if (autoPlay) {
        videoEl.play().catch((err) => {
          console.warn('Auto-play restrito pelo navegador:', err);
          setIsPlaying(false);
        });
      }
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [effectiveVideoUrl, autoPlay, isHlsUrl, applyInitialTime, onError]);

  // Metadados carregados
  const handleLoadedMetadata = () => {
    const el = videoRef.current;
    if (!el) return;
    if (el.duration && !isNaN(el.duration)) {
      setDuration(el.duration);
    }
    applyInitialTime();
    setVideoError(null);

    const rawHeight = el.videoHeight;
    const detected = classifyVideoResolution(rawHeight);

    if (onUpdateMetadata && video?.id) {
      const updates: VideoMetadataUpdates = {};
      if (el.duration && !isNaN(el.duration) && el.duration > 0) {
        updates.duration = Math.round(el.duration);
        updates.durationFormatted = formatDuration(el.duration);
      }
      if (detected !== 'N/D') {
        updates.resolution = detected;
      }
      if (updates.duration !== undefined || updates.resolution !== undefined) {
        onUpdateMetadata(video.id, updates);
      }
    }
  };

  // Atualização de tempo do vídeo
  const handleTimeUpdate = () => {
    const el = videoRef.current;
    if (!el) return;
    setCurrentTime(el.currentTime);
    onTimeUpdate?.(el.currentTime, el.duration || duration || 0);
    if (el.buffered.length > 0) {
      setBufferedTime(el.buffered.end(el.buffered.length - 1));
    }

    // Auto-recuperação: se estiver reproduzindo ativamente, com controles visíveis,
    // sem menu aberto e sem temporizador ativo no momento, agenda a ocultação para ~5 segundos
    if (
      controlsVisibleRef.current &&
      !showSettingsMenuRef.current &&
      !controlsTimeoutRef.current &&
      !el.paused &&
      !el.ended
    ) {
      scheduleControlsHide();
    }
  };

  // Feedback central discreto de Play/Pause
  const triggerPlayPauseFeedback = useCallback((type: 'play' | 'pause') => {
    if (playPauseFeedbackTimeoutRef.current) {
      clearTimeout(playPauseFeedbackTimeoutRef.current);
    }
    setPlayPauseFeedback(type);
    playPauseFeedbackTimeoutRef.current = setTimeout(() => {
      setPlayPauseFeedback(null);
    }, 700);
  }, []);

  // Controle de Play/Pause garantindo que os controles permaneçam visíveis ao pausar
  const togglePlay = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;

    if (el.paused) {
      el.play()
        .then(() => {
          setIsPlaying(true);
          isPlayingRef.current = true;
          triggerPlayPauseFeedback('play');
          resetInactivityTimer();
        })
        .catch((err) => {
          console.warn('Reprodução restrita pelo navegador:', err);
          setIsPlaying(false);
          isPlayingRef.current = false;
        });
    } else {
      el.pause();
      setIsPlaying(false);
      isPlayingRef.current = false;
      triggerPlayPauseFeedback('pause');
      clearInactivityTimer();
      setControlsVisible(true);
      controlsVisibleRef.current = true;
    }
  }, [triggerPlayPauseFeedback, resetInactivityTimer, clearInactivityTimer]);

  // Avançar / retroceder 10s respeitando os limites e duração do vídeo
  const seekRelative = useCallback(
    (deltaSec: number) => {
      const el = videoRef.current;
      if (!el) return;
      const dur = el.duration || duration || 1;
      const target = Math.max(0, Math.min(dur, el.currentTime + deltaSec));
      el.currentTime = target;
      setCurrentTime(target);
      resetInactivityTimer();
    },
    [duration, resetInactivityTimer]
  );

  // Toque ou clique seguro na superfície do vídeo
  // Regra essencial: ao tocar na área do vídeo, SEMPRE exibe os controles da Nova Stream
  // e inicia/reinicia a contagem de 5 segundos (ou mantém visível se pausado).
  const handleVideoSurfacePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      if (
        target.closest('button') ||
        target.closest('.player-menu-content') ||
        target.closest('.player-menu-trigger') ||
        target.closest('input') ||
        target.closest('.group\\/progress')
      ) {
        return;
      }

      // 1. Ao tocar no vídeo, os controles da Nova Stream devem aparecer imediatamente
      if (!controlsVisibleRef.current) {
        setControlsVisible(true);
        controlsVisibleRef.current = true;
      }
      resetInactivityTimer();
    },
    [resetInactivityTimer]
  );

  const handleVideoSurfacePointerUp = useCallback(
    () => {
      // 2. Ao soltar o dedo ou parar de interagir, garante que o temporizador de 5s continue ativo
      scheduleControlsHide();
    },
    [scheduleControlsHide]
  );

  const handleVideoSurfaceClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      if (
        target.closest('button') ||
        target.closest('.player-menu-content') ||
        target.closest('.player-menu-trigger') ||
        target.closest('input') ||
        target.closest('.group\\/progress')
      ) {
        return;
      }

      // Se o menu de velocidade estiver aberto, fecha o menu
      if (showSettingsMenuRef.current) {
        setShowSettingsMenu(false);
        showSettingsMenuRef.current = false;
      }

      // 3 & 4. Ao tocar novamente no vídeo ou em um controle, reinicia o temporizador de 5 segundos
      resetInactivityTimer();
    },
    [resetInactivityTimer]
  );

  const handlePointerLeaveContainer = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType === 'mouse') {
        scheduleControlsHide();
      }
    },
    [scheduleControlsHide]
  );

  // Mouse move no desktop para resetar timer de inatividade (ignora eventos de touch simulados)
  const handlePointerMoveDesktop = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType === 'touch') return;
      if (e.movementX === 0 && e.movementY === 0) return;
      if (!controlsVisibleRef.current) {
        setControlsVisible(true);
        controlsVisibleRef.current = true;
      }
      scheduleControlsHide();
    },
    [scheduleControlsHide]
  );

  // Barra de progresso: seek e hover com reinício do temporizador
  const handleProgressSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const bar = progressBarRef.current;
    const el = videoRef.current;
    if (!bar || !el) return;
    const rect = bar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = ratio * (duration || 1);
    el.currentTime = newTime;
    setCurrentTime(newTime);
    resetInactivityTimer();
  };

  const handleProgressMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const bar = progressBarRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const mouseX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const ratio = mouseX / rect.width;
    setHoverPosition(mouseX);
    setHoverTime(ratio * (duration || 0));
    resetInactivityTimer();
  };

  // Volume
  const handleVolumeChange = (newVol: number) => {
    const el = videoRef.current;
    setVolume(newVol);
    resetInactivityTimer();
    if (newVol === 0) {
      setIsMuted(true);
      if (el) el.muted = true;
    } else {
      setIsMuted(false);
      if (el) {
        el.muted = false;
        el.volume = newVol;
      }
    }
  };

  const toggleMute = () => {
    const el = videoRef.current;
    if (!el) return;
    resetInactivityTimer();
    if (isMuted || volume === 0) {
      const restored = volume > 0 ? volume : 0.85;
      el.muted = false;
      el.volume = restored;
      setVolume(restored);
      setIsMuted(false);
    } else {
      el.muted = true;
      setIsMuted(true);
    }
  };

  // Fullscreen
  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;
    resetInactivityTimer();
    if (!document.fullscreenElement) {
      container.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Alteração de velocidade de reprodução real com sincronização
  const changeSpeed = useCallback((speed: PlaybackSpeed) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
    resetInactivityTimer();
  }, [resetInactivityTimer]);

  const handleToggleSpeedMenu = useCallback((e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowSettingsMenu((prev) => {
      const next = !prev;
      showSettingsMenuRef.current = next;
      if (next) {
        justOpenedMenuTimeRef.current = Date.now();
        clearInactivityTimer();
      } else {
        scheduleControlsHide();
      }
      return next;
    });
  }, [clearInactivityTimer, scheduleControlsHide]);

  const handleCloseSpeedMenu = useCallback((e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowSettingsMenu(false);
    showSettingsMenuRef.current = false;
    scheduleControlsHide();
  }, [scheduleControlsHide]);

  const handleSelectSpeed = useCallback((spd: PlaybackSpeed, e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
    changeSpeed(spd);
    setShowSettingsMenu(false);
    showSettingsMenuRef.current = false;
    scheduleControlsHide();
  }, [changeSpeed, scheduleControlsHide]);

  // Atalhos de teclado no desktop
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'arrowleft':
        case 'j':
          e.preventDefault();
          seekRelative(-10);
          break;
        case 'arrowright':
        case 'l':
          e.preventDefault();
          seekRelative(10);
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'escape':
          if (isFullscreen) {
            document.exitFullscreen?.().catch(() => {});
          } else if (showSettingsMenu) {
            setShowSettingsMenu(false);
          } else {
            onClose?.();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, seekRelative, toggleFullscreen, toggleMute, isFullscreen, showSettingsMenu, onClose]);

  // Fechar menu de velocidade ao clicar fora
  useEffect(() => {
    const handlePointerDownOutside = (e: PointerEvent) => {
      if (!showSettingsMenuRef.current) return;
      if (Date.now() - justOpenedMenuTimeRef.current < 250) return;

      const settingsArea = settingsAreaRef.current;
      const target = e.target;
      if (settingsArea && target instanceof Node && !settingsArea.contains(target)) {
        setShowSettingsMenu(false);
        showSettingsMenuRef.current = false;
        scheduleControlsHide();
      }
    };

    document.addEventListener('pointerdown', handlePointerDownOutside);
    return () => document.removeEventListener('pointerdown', handlePointerDownOutside);
  }, [scheduleControlsHide]);

  // Limpeza de timers ao desmontar o componente
  useEffect(() => {
    return () => {
      if (playPauseFeedbackTimeoutRef.current) clearTimeout(playPauseFeedbackTimeoutRef.current);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, []);

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPercent = duration > 0 ? (bufferedTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      onPointerDown={handleVideoSurfacePointerDown}
      onPointerUp={handleVideoSurfacePointerUp}
      onPointerCancel={handleVideoSurfacePointerUp}
      onPointerLeave={handlePointerLeaveContainer}
      onPointerMove={handlePointerMoveDesktop}
      onClick={handleVideoSurfaceClick}
      className={`relative isolate w-full aspect-video min-h-[240px] md:min-h-[520px] bg-black flex items-center justify-center select-none overflow-hidden rounded-2xl group touch-manipulation ${className || ''}`}
      style={{ touchAction: 'manipulation' }}
    >
      {/* Elemento de Vídeo HTML5 com suporte HLS e reprodução direta */}
      <video
        ref={videoRef}
        src={isHlsActive && Hls.isSupported() ? undefined : effectiveVideoUrl}
        poster={effectivePosterUrl}
        playsInline
        autoPlay={autoPlay}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={() => {
          setIsPlaying(true);
          isPlayingRef.current = true;
          resetInactivityTimer();
        }}
        onPlaying={() => {
          setIsPlaying(true);
          isPlayingRef.current = true;
          if (controlsVisibleRef.current) {
            scheduleControlsHide();
          }
        }}
        onPause={() => {
          setIsPlaying(false);
          isPlayingRef.current = false;
          clearInactivityTimer();
          setControlsVisible(true);
          controlsVisibleRef.current = true;
        }}
        onEnded={() => {
          setIsPlaying(false);
          isPlayingRef.current = false;
          clearInactivityTimer();
          setControlsVisible(true);
          controlsVisibleRef.current = true;
          onEnded?.();
        }}
        onError={() => {
          const message = video?.isLocalFile
            ? 'O navegador não conseguiu decodificar o arquivo local.'
            : 'Não foi possível reproduzir este vídeo no momento.';
          setVideoError(message);
          onError?.(message);
        }}
        className="absolute inset-0 w-full h-full object-contain cursor-pointer"
      />

      {/* Fallback de erro amigável */}
      {videoError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0B0C10]/95 p-6 text-center z-20">
          <div className="w-12 h-12 rounded-full bg-indigo-950/80 border border-indigo-700/50 flex items-center justify-center text-indigo-400 mb-4">
            <Info className="w-6 h-6" />
          </div>
          <h4 className="text-base font-semibold text-white mb-1">
            {video?.isLocalFile ? 'Erro na Decodificação Local' : 'Vídeo Indisponível'}
          </h4>
          <p className="text-xs text-slate-300 max-w-md mb-5 leading-relaxed">{videoError}</p>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              Voltar para a Biblioteca
            </button>
          )}
        </div>
      )}

      {/* Barra superior com botão fechar */}
      {onClose && (
        <div
          className={`absolute top-0 left-0 right-0 p-3 sm:p-5 bg-gradient-to-b from-black/80 via-black/30 to-transparent transition-opacity duration-300 z-30 flex items-center justify-between ${
            controlsVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            aria-label="Voltar para a biblioteca"
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-900/80 hover:bg-slate-800 active:scale-95 text-slate-200 hover:text-white flex items-center justify-center transition-all border border-slate-700/60 shadow-lg backdrop-blur-sm cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Feedback central discreto de Play / Pause */}
      {playPauseFeedback && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-black/65 backdrop-blur-md border border-white/20 text-white flex items-center justify-center shadow-2xl animate-player-pop">
            {playPauseFeedback === 'play' ? (
              <Play className="w-7 h-7 sm:w-8 sm:h-8 fill-white text-white ml-0.5" />
            ) : (
              <Pause className="w-7 h-7 sm:w-8 sm:h-8 fill-white text-white" />
            )}
          </div>
        </div>
      )}

      {/* Botão central de Play/Pause destacado quando os controles estão visíveis */}
      {controlsVisible && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              togglePlay();
            }}
            aria-label={isPlaying ? 'Pausar vídeo' : 'Reproduzir vídeo'}
            className="pointer-events-auto w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-black/65 hover:bg-black/85 backdrop-blur-md border border-white/20 text-white flex items-center justify-center shadow-2xl transition-all hover:scale-105 active:scale-95 cursor-pointer"
          >
            {isPlaying ? (
              <Pause className="w-8 h-8 sm:w-9 sm:h-9 fill-white" />
            ) : (
              <Play className="w-8 h-8 sm:w-9 sm:h-9 ml-1 fill-white" />
            )}
          </button>
        </div>
      )}

      {/* Overlay inferior de controles com temporizador de inatividade inteligente */}
      <div
        onPointerDown={(e) => {
          e.stopPropagation();
          clearInactivityTimer();
        }}
        onPointerUp={(e) => {
          e.stopPropagation();
          scheduleControlsHide();
        }}
        onClick={(e) => {
          e.stopPropagation();
          resetInactivityTimer();
        }}
        className={`absolute bottom-0 left-0 right-0 p-3 sm:p-5 bg-gradient-to-t from-black/95 via-black/70 to-transparent transition-opacity duration-300 z-30 ${
          controlsVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Barra de Progresso Interativa */}
        <div
          ref={progressBarRef}
          onClick={(e) => {
            e.stopPropagation();
            handleProgressSeek(e);
          }}
          onMouseMove={handleProgressMouseMove}
          onMouseEnter={() => setIsHoveringProgress(true)}
          onMouseLeave={() => setIsHoveringProgress(false)}
          className="relative h-2 hover:h-3.5 bg-slate-800/80 hover:bg-slate-800 rounded-full cursor-pointer transition-all mb-3 group/progress"
        >
          {/* Barra de buffer carregado */}
          <div
            className="absolute top-0 left-0 bottom-0 bg-slate-700/60 rounded-full pointer-events-none transition-all"
            style={{ width: `${bufferedPercent}%` }}
          />

          {/* Barra de progresso atual */}
          <div
            className="absolute top-0 left-0 bottom-0 bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full pointer-events-none"
            style={{ width: `${progressPercent}%` }}
          />

          {/* Marcador deslizante */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -ml-2 w-4 h-4 bg-white rounded-full shadow-md pointer-events-none transition-transform scale-0 group-hover/progress:scale-100"
            style={{ left: `${progressPercent}%` }}
          />

          {/* Tooltip de tempo no hover */}
          {isHoveringProgress && (
            <div
              className="absolute -top-8 -translate-x-1/2 bg-slate-900 border border-slate-700 text-slate-100 text-[11px] font-mono px-2 py-0.5 rounded shadow pointer-events-none"
              style={{ left: `${hoverPosition}px` }}
            >
              {formatTime(hoverTime)}
            </div>
          )}
        </div>

        {/* Linha de Botões de Controle Inferiores Organizados Sem Sobreposição */}
        <div
          className="flex items-center justify-between gap-1 sm:gap-2 text-slate-200"
        >
          {/* Lado Esquerdo: Play/Pause, Voltar 10s, Avançar 10s, Volume, Marcação de Tempo */}
          <div className="flex items-center gap-0.5 sm:gap-1.5 min-w-0">
            {/* Play/Pause */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                togglePlay();
              }}
              aria-label={isPlaying ? 'Pausar' : 'Reproduzir'}
              className="w-9 h-9 sm:w-10 sm:h-10 shrink-0 flex items-center justify-center hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer active:scale-95"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
            </button>

            {/* Voltar 10 segundos (⏪) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                seekRelative(-10);
              }}
              aria-label="Voltar 10 segundos"
              className="relative w-9 h-9 sm:w-10 sm:h-10 shrink-0 flex items-center justify-center hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer active:scale-95 text-slate-300"
              title="Voltar 10 segundos"
            >
              <RotateCcw className="w-5 h-5" strokeWidth={1.75} />
              <span className="absolute text-[8px] font-mono font-bold select-none pointer-events-none mt-[0.5px]">
                10
              </span>
            </button>

            {/* Avançar 10 segundos (⏩) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                seekRelative(10);
              }}
              aria-label="Avançar 10 segundos"
              className="relative w-9 h-9 sm:w-10 sm:h-10 shrink-0 flex items-center justify-center hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer active:scale-95 text-slate-300"
              title="Avançar 10 segundos"
            >
              <RotateCw className="w-5 h-5" strokeWidth={1.75} />
              <span className="absolute text-[8px] font-mono font-bold select-none pointer-events-none mt-[0.5px]">
                10
              </span>
            </button>

            {/* Controle de Volume */}
            <div className="flex items-center group/vol shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleMute();
                }}
                aria-label={isMuted ? 'Ativar som' : 'Desativar som'}
                className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer active:scale-95"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-5 h-5 text-red-400" />
                ) : volume < 0.5 ? (
                  <Volume1 className="w-5 h-5" />
                ) : (
                  <Volume2 className="w-5 h-5" />
                )}
              </button>

              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                aria-label="Ajustar volume"
                className="w-0 group-hover/vol:w-16 md:group-hover/vol:w-20 transition-all duration-200 accent-indigo-500 h-1 cursor-pointer bg-slate-700 rounded-lg hidden sm:block"
              />
            </div>

            {/* Marcação de Tempo */}
            <div className="text-[11px] sm:text-xs font-mono text-slate-300 ml-1 sm:ml-2 tabular-nums truncate">
              <span>{formatTime(currentTime)}</span>
              <span className="text-slate-500 mx-0.5 sm:mx-1">/</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Lado Direito: Menu de Velocidade Compacto e Fullscreen */}
          <div className="flex items-center gap-0.5 sm:gap-1.5 shrink-0">
            {/* Ícone e Menu Compacto de Velocidade na Barra Inferior */}
            <div ref={settingsAreaRef} className="relative">
              <button
                type="button"
                onClick={handleToggleSpeedMenu}
                className={`player-menu-trigger h-9 sm:h-10 px-2 sm:px-2.5 flex items-center gap-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer active:scale-95 ${
                  showSettingsMenu
                    ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
                title="Velocidade de reprodução"
                aria-label="Velocidade de reprodução"
                aria-haspopup="menu"
                aria-expanded={showSettingsMenu}
              >
                <Gauge className="w-4 h-4 text-slate-300 pointer-events-none" />
                <span className="text-[11px] font-mono text-slate-300 font-medium pointer-events-none">
                  {playbackSpeed === 1 ? '1x' : `${playbackSpeed}x`}
                </span>
              </button>

              {/* Menu de Velocidade Compacto posicionado acima da barra, junto ao botão de velocidade */}
              {showSettingsMenu && (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    clearInactivityTimer();
                  }}
                  className="player-menu-content absolute bottom-full mb-1.5 right-0 w-[122px] max-h-[220px] bg-[#12131A]/95 border border-slate-700/80 rounded-xl p-1 shadow-2xl z-[60] pointer-events-auto backdrop-blur-md overflow-y-auto custom-scrollbar"
                >
                  <div className="flex items-center justify-between px-2 py-0.5 text-[9px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800/80 mb-0.5">
                    <span>Velocidade</span>
                    <button
                      type="button"
                      onClick={handleCloseSpeedMenu}
                      className="text-slate-500 hover:text-white p-0.5 rounded cursor-pointer transition-colors"
                      aria-label="Fechar menu"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="space-y-[1px]">
                    {/* Lista de Velocidades Preservadas: 0.5x, 0.75x, Normal (1x), 1.25x, 1.5x, 2x */}
                    {PLAYBACK_SPEEDS.map((spd) => (
                      <button
                        key={spd}
                        type="button"
                        onClick={(e) => handleSelectSpeed(spd, e)}
                        className={`w-full flex items-center justify-between px-2 py-1 text-[11px] rounded-lg transition-colors cursor-pointer ${
                          playbackSpeed === spd
                            ? 'bg-[#a855f7]/25 text-[#d8b4fe] font-semibold border border-[#a855f7]/30'
                            : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                        }`}
                      >
                        <span className="whitespace-nowrap">
                          {spd === 1 ? 'Normal (1x)' : `${spd}x`}
                        </span>
                        {playbackSpeed === spd && (
                          <Check className="w-3 h-3 text-[#c084fc] shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Tela Cheia */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleFullscreen();
              }}
              aria-label={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
              className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer active:scale-95"
            >
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomVideoPlayer;
