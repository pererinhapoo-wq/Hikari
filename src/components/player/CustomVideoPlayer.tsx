import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import Hls from 'hls.js';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Settings,
  ChevronLeft,
  ChevronRight,
  Info,
  Check,
  SkipBack,
  SkipForward,
  X,
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
  formatQualityLabel,
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
const DOUBLE_TAP_WINDOW = 280; // Janela em ms para detecção de duplo toque

export const CustomVideoPlayer: React.FC<CustomVideoPlayerProps> = ({
  video,
  onClose,
  autoPlay = true,
  onUpdateMetadata,
  initialTime = 0,
  onTimeUpdate,
  onEnded,
  onError,
  onNextEpisode,
  onPrevEpisode,
  hasNextEpisode,
  hasPrevEpisode,
  className,
}) => {
  // Referências DOM e motor HLS
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const initialTimeAppliedRef = useRef<boolean>(false);
  const hideControlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapRef = useRef<{ time: number; x: number } | null>(null);
  const doubleTapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDraggingScrubberRef = useRef<boolean>(false);

  // Estados de reprodução
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [bufferedTime, setBufferedTime] = useState<number>(0);
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [detectedResolution, setDetectedResolution] = useState<VideoResolution>('N/D');

  // Estados dos controles e menus
  const [controlsVisible, setControlsVisible] = useState<boolean>(true);
  const [activeMenu, setActiveMenu] = useState<'main' | 'speed' | 'quality' | null>(null);
  const [isHlsActive, setIsHlsActive] = useState<boolean>(false);
  const [hlsLevels, setHlsLevels] = useState<StreamQualityOption[]>([]);
  const [currentLevelIndex, setCurrentLevelIndex] = useState<number>(-1); // -1 = auto
  const [videoError, setVideoError] = useState<string | null>(null);
  const [feedbackSeek, setFeedbackSeek] = useState<'left' | 'right' | null>(null);

  // URL efetiva do vídeo
  const effectiveVideoUrl = useMemo(() => {
    if (!video) return '';
    if (video.isLocalFile) {
      return getLocalVideoUrl(video.id) || video.videoUrl || video.url || '';
    }
    return video.videoUrl || video.url || '';
  }, [video]);

  const effectivePosterUrl = video.posterUrl || video.thumbnailUrl || '';

  const isHlsUrl = useCallback((url: string): boolean => {
    if (!url) return false;
    const cleanUrl = url.split('?')[0].toLowerCase();
    return cleanUrl.endsWith('.m3u8') || url.includes('.m3u8') || url.includes('/hls/');
  }, []);

  // Timer de auto-ocultação dos controles (3.5 segundos de inatividade)
  const resetControlsTimer = useCallback(() => {
    setControlsVisible(true);
    if (hideControlsTimerRef.current) {
      clearTimeout(hideControlsTimerRef.current);
    }
    // Não oculta se o vídeo estiver pausado ou se houver menu aberto
    if (isPlaying && !activeMenu) {
      hideControlsTimerRef.current = setTimeout(() => {
        setControlsVisible(false);
      }, 3500);
    }
  }, [isPlaying, activeMenu]);

  useEffect(() => {
    if (!isPlaying) {
      setControlsVisible(true);
      if (hideControlsTimerRef.current) {
        clearTimeout(hideControlsTimerRef.current);
      }
    } else {
      resetControlsTimer();
    }
  }, [isPlaying, resetControlsTimer]);

  // Inicialização e gerenciamento do pipeline de vídeo (HLS / Direto)
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl || !effectiveVideoUrl) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    initialTimeAppliedRef.current = false;
    setVideoError(null);
    setHlsLevels([]);
    setCurrentLevelIndex(-1);

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

      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        // Mapear níveis de qualidade adaptativa do HLS
        if (data.levels && data.levels.length > 0) {
          const parsedOptions: StreamQualityOption[] = data.levels.map((lvl, idx) => ({
            levelIndex: idx,
            label: lvl.height ? `${lvl.height}p` : `Qualidade ${idx + 1}`,
            resolution: lvl.height ? `${lvl.height}p` : 'N/D',
            bitrate: lvl.bitrate,
            width: lvl.width,
            height: lvl.height,
          }));
          setHlsLevels(parsedOptions);
        }

        if (!initialTimeAppliedRef.current && initialTime && initialTime > 0) {
          try {
            videoEl.currentTime = initialTime;
          } catch {
            // aguarda loadedmetadata
          }
          initialTimeAppliedRef.current = true;
        }

        if (autoPlay) {
          videoEl.play().catch((err) => {
            console.warn('Auto-play restrito pelo navegador:', err);
          });
        }
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
        setCurrentLevelIndex(data.level);
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        console.warn('HLS Event:', data.type, data.details);
        if (
          data.details === Hls.ErrorDetails.LEVEL_LOAD_ERROR ||
          data.details === Hls.ErrorDetails.LEVEL_LOAD_TIMEOUT
        ) {
          if (hls.currentLevel !== -1) {
            hls.currentLevel = -1;
          }
        }
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
              setVideoError('Não foi possível estabelecer transmissão contínua com a stream HLS.');
              onError?.('Não foi possível carregar a stream HLS.');
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
      // Suporte nativo Safari iOS / macOS
      videoEl.src = effectiveVideoUrl;
      setIsHlsActive(true);
      if (autoPlay) {
        videoEl.play().catch(() => {});
      }
    } else {
      // Fonte direta MP4, WebM ou Blob
      videoEl.src = effectiveVideoUrl;
      setIsHlsActive(false);
      if (autoPlay) {
        videoEl.play().catch((err) => {
          console.warn('Auto-play restrito pelo navegador:', err);
        });
      }
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [effectiveVideoUrl, autoPlay, isHlsUrl, initialTime, onError]);

  // Listener para tela cheia
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Atualização de buffer
  const updateBuffer = useCallback(() => {
    const el = videoRef.current;
    if (!el || el.duration <= 0) return;
    for (let i = 0; i < el.buffered.length; i++) {
      if (el.buffered.start(i) <= el.currentTime && el.currentTime <= el.buffered.end(i)) {
        setBufferedTime(el.buffered.end(i));
        break;
      }
    }
  }, []);

  // Manipuladores de eventos do elemento <video>
  const handleTimeUpdate = () => {
    const el = videoRef.current;
    if (!el) return;
    if (!isDraggingScrubberRef.current) {
      setCurrentTime(el.currentTime);
    }
    updateBuffer();
    onTimeUpdate?.(el.currentTime, el.duration || 0);
  };

  const handleLoadedMetadata = () => {
    const el = videoRef.current;
    if (!el) return;
    setVideoError(null);
    setDuration(el.duration || 0);
    const rawDur = el.duration;
    const rawHeight = el.videoHeight;

    if (!initialTimeAppliedRef.current && initialTime && initialTime > 0) {
      try {
        el.currentTime = initialTime;
      } catch {
        // no-op
      }
      initialTimeAppliedRef.current = true;
    }

    const detected = classifyVideoResolution(rawHeight);
    setDetectedResolution(detected);

    if (onUpdateMetadata && video?.id) {
      const hasValidDuration =
        typeof rawDur === 'number' && !isNaN(rawDur) && rawDur > 0 && isFinite(rawDur);
      const updates: VideoMetadataUpdates = {};
      if (hasValidDuration) {
        updates.duration = Math.round(rawDur);
        updates.durationFormatted = formatDuration(rawDur);
      }
      if (detected !== 'N/D') {
        updates.resolution = detected;
      }
      if (updates.duration !== undefined || updates.resolution !== undefined) {
        onUpdateMetadata(video.id, updates);
      }
    }
  };

  const handleCanPlay = () => {
    const el = videoRef.current;
    if (!el) return;
    if (!initialTimeAppliedRef.current && initialTime && initialTime > 0) {
      try {
        el.currentTime = initialTime;
      } catch {
        // no-op
      }
      initialTimeAppliedRef.current = true;
    }
  };

  // Comandos de reprodução
  const togglePlay = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      el.play().catch(() => {});
    } else {
      el.pause();
    }
    resetControlsTimer();
  }, [resetControlsTimer]);

  const seekBy = useCallback(
    (seconds: number) => {
      const el = videoRef.current;
      if (!el) return;
      const targetTime = Math.max(0, Math.min(el.duration || 0, el.currentTime + seconds));
      el.currentTime = targetTime;
      setCurrentTime(targetTime);
      resetControlsTimer();

      // Disparar feedback visual rápido (sem backdrop)
      setFeedbackSeek(seconds < 0 ? 'left' : 'right');
      setTimeout(() => setFeedbackSeek(null), 600);
    },
    [resetControlsTimer]
  );

  const toggleMute = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = !el.muted;
    setIsMuted(el.muted);
    resetControlsTimer();
  }, [resetControlsTimer]);

  const handleVolumeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseFloat(e.target.value);
      const el = videoRef.current;
      if (!el) return;
      el.volume = val;
      el.muted = val === 0;
      setVolume(val);
      setIsMuted(val === 0);
      resetControlsTimer();
    },
    [resetControlsTimer]
  );

  const handleSpeedChange = useCallback(
    (speed: PlaybackSpeed) => {
      const el = videoRef.current;
      if (!el) return;
      el.playbackRate = speed;
      setPlaybackSpeed(speed);
      setActiveMenu(null);
      resetControlsTimer();
    },
    [resetControlsTimer]
  );

  const handleQualityChange = useCallback(
    (levelIndex: number) => {
      if (hlsRef.current) {
        hlsRef.current.currentLevel = levelIndex;
        setCurrentLevelIndex(levelIndex);
      }
      setActiveMenu(null);
      resetControlsTimer();
    },
    [resetControlsTimer]
  );

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      if (container.requestFullscreen) {
        container.requestFullscreen().catch(() => {});
      } else if ((container as any).webkitRequestFullscreen) {
        (container as any).webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      }
    }
    resetControlsTimer();
  }, [resetControlsTimer]);

  // Manipulação da barra de progresso (scrubber)
  const handleScrubberChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const targetTime = parseFloat(e.target.value);
    setCurrentTime(targetTime);
    if (videoRef.current) {
      videoRef.current.currentTime = targetTime;
    }
  }, []);

  const handleScrubberMouseDown = () => {
    isDraggingScrubberRef.current = true;
    if (hideControlsTimerRef.current) {
      clearTimeout(hideControlsTimerRef.current);
    }
  };

  const handleScrubberMouseUp = () => {
    isDraggingScrubberRef.current = false;
    resetControlsTimer();
  };

  // Gestos de toque: Diferenciação entre Toque Simples e Duplo Toque (Janela de 280ms)
  const handleTouchZone = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.changedTouches[0];
    const container = containerRef.current;
    if (!touch || !container) return;

    const rect = container.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const now = Date.now();

    if (lastTapRef.current) {
      const deltaT = now - lastTapRef.current.time;
      const deltaX = Math.abs(x - lastTapRef.current.x);

      if (deltaT <= DOUBLE_TAP_WINDOW && deltaX < 140) {
        // Duplo toque confirmado
        if (doubleTapTimeoutRef.current) {
          clearTimeout(doubleTapTimeoutRef.current);
          doubleTapTimeoutRef.current = null;
        }
        lastTapRef.current = null;

        const isLeft = x < rect.width / 2;
        seekBy(isLeft ? -10 : 10);
        return;
      }
    }

    lastTapRef.current = { time: now, x };
    doubleTapTimeoutRef.current = setTimeout(() => {
      // Toque simples: alterna visibilidade dos controles
      setControlsVisible((prev) => !prev);
      lastTapRef.current = null;
    }, DOUBLE_TAP_WINDOW);
  };

  // Atalhos de teclado para navegação no player
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignora se estiver digitando em campos de texto
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
          seekBy(-10);
          break;
        case 'arrowright':
        case 'l':
          e.preventDefault();
          seekBy(10);
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, seekBy, toggleFullscreen, toggleMute]);

  // Formatação de rótulos
  const formatSpeedLabel = (spd: PlaybackSpeed) => (spd === 1 ? 'Normal (1x)' : `${spd}x`);

  const qualityDisplayLabel = useMemo(() => {
    if (isHlsActive && hlsLevels.length > 0) {
      if (currentLevelIndex === -1) return 'Automático';
      const lvl = hlsLevels[currentLevelIndex];
      return lvl ? lvl.label : 'Automático';
    }
    return formatQualityLabel(detectedResolution);
  }, [isHlsActive, hlsLevels, currentLevelIndex, detectedResolution]);

  return (
    <div
      ref={containerRef}
      onPointerMove={resetControlsTimer}
      className={`relative w-full h-full min-h-[340px] md:min-h-[520px] bg-black flex items-center justify-center overflow-hidden rounded-2xl select-none ${className || ''}`}
    >
      {/* ========================================================================= */}
      {/* CAMADA 1: CAMADA DE IMAGEM PURA (HIKARI VIDEO SURFACE)                   */}
      {/* Esta camada contém ESTRITAMENTE o elemento <video>.                       */}
      {/* REGRA INVIOLÁVEL: Nenhum filtro, gradiente, backdrop-filter ou elemento  */}
      {/* sobreposto pode ser inserido nesta subárvore.                             */}
      {/* O <video> é completamente isolado contra re-renderizações da interface.  */}
      {/* ========================================================================= */}
      <div
        className="absolute inset-0 z-0 flex items-center justify-center bg-black overflow-hidden pointer-events-none"
        style={{ isolation: 'isolate' }}
      >
        <video
          ref={videoRef}
          playsInline
          autoPlay={autoPlay}
          poster={effectivePosterUrl}
          src={isHlsActive && Hls.isSupported() ? undefined : effectiveVideoUrl}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onCanPlay={handleCanPlay}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => {
            setIsPlaying(false);
            onEnded?.();
          }}
          onError={() => {
            if (video?.isLocalFile) {
              const msg =
                'O navegador não conseguiu decodificar o arquivo local. Verifique se o formato (MP4, WebM) e codec (H.264/AAC) são suportados.';
              setVideoError(msg);
              onError?.(msg);
            } else {
              const msg = 'Não foi possível reproduzir este vídeo. Tente alternar de Player.';
              setVideoError(msg);
              onError?.(msg);
            }
          }}
          className="w-full h-full object-contain max-h-screen pointer-events-auto cursor-pointer"
          style={{
            filter: 'none',
            WebkitFilter: 'none',
            transform: 'none',
          }}
        >
          {video?.subtitles?.map((sub) => (
            <track
              key={sub.id}
              kind="subtitles"
              src={sub.src || ''}
              srcLang={sub.lang}
              label={sub.label}
            />
          ))}
        </video>
      </div>

      {/* ========================================================================= */}
      {/* ZONA DE TOQUE E DETECÇÃO DE GESTOS NO VÍDEO (SEM INTERFERIR NA IMAGEM)     */}
      {/* ========================================================================= */}
      <div
        onTouchEnd={handleTouchZone}
        onClick={(e) => {
          // No desktop, clique simples na imagem alterna Play/Pause
          if (e.target === e.currentTarget) {
            togglePlay();
          }
        }}
        className="absolute inset-0 z-10 cursor-pointer pointer-events-auto"
        aria-hidden="true"
      />

      {/* ========================================================================= */}
      {/* FEEDBACK VISUAL RÁPIDO DE SEEK (-10s / +10s)                             */}
      {/* Usa cores sólidas e sombras limpas, SEM backdrop-filter                   */}
      {/* ========================================================================= */}
      {feedbackSeek && (
        <div
          className={`absolute top-1/2 z-20 -translate-y-1/2 flex items-center justify-center pointer-events-none transition-all duration-300 ${
            feedbackSeek === 'left' ? 'left-8 md:left-16' : 'right-8 md:right-16'
          }`}
        >
          <div className="flex flex-col items-center justify-center size-20 rounded-full bg-[#121217]/95 border border-white/20 text-white shadow-2xl scale-110">
            {feedbackSeek === 'left' ? (
              <>
                <RotateCcw className="size-6 mb-1 text-[#c084fc]" />
                <span className="text-xs font-bold text-white tracking-wider">-10s</span>
              </>
            ) : (
              <>
                <RotateCw className="size-6 mb-1 text-[#c084fc]" />
                <span className="text-xs font-bold text-white tracking-wider">+10s</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CAMADA 2: CAMADA IRMÃ DE CONTROLES (HIKARI CONTROLS OVERLAY)             */}
      {/* Camada IRMÃ posicionada sobre o container, SEM backdrop-filter e SEM      */}
      {/* gradientes que cubram a área de visualização do anime.                    */}
      {/* Usa pointer-events-none na raiz e pointer-events-auto nos botões.         */}
      {/* Quando inativa, recebe opacity-0 invisible para descartar a composição.   */}
      {/* ========================================================================= */}
      <div
        className={`absolute inset-0 z-20 flex flex-col justify-between p-3 md:p-5 pointer-events-none transition-all duration-200 ${
          controlsVisible ? 'opacity-100 visible' : 'opacity-0 invisible'
        }`}
      >
        {/* TOPO: Cabeçalho com título do episódio e botão voltar (quando modal) */}
        <div className="flex items-center justify-between gap-3 pointer-events-none">
          <div className="flex items-center gap-2 max-w-[80%]">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="pointer-events-auto flex size-9 items-center justify-center rounded-full bg-[#14141a]/90 hover:bg-[#202029] border border-white/10 text-white transition active:scale-95 cursor-pointer shadow-lg"
                aria-label="Voltar"
              >
                <X className="size-4" />
              </button>
            )}
            <div className="truncate">
              <h3 className="text-sm font-semibold text-white truncate drop-shadow-md">
                {video?.title || 'Hikari Player'}
              </h3>
              {video?.episodeNumber && (
                <p className="text-xs text-white/70 truncate drop-shadow-sm">
                  Episódio {video.episodeNumber} {video.episodeTitle ? `· ${video.episodeTitle}` : ''}
                </p>
              )}
            </div>
          </div>

          {/* Tag de resolução atual discreta */}
          <div className="pointer-events-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#14141a]/90 border border-white/10 text-[11px] font-medium text-white/90 shadow-md">
            <span className="size-1.5 rounded-full bg-[#a855f7]" />
            {qualityDisplayLabel}
          </div>
        </div>

        {/* CENTRO: Controles Centrais Flutuantes (-10s / Play-Pause / +10s) */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-center gap-4 md:gap-6 pointer-events-none">
          <button
            type="button"
            onClick={() => seekBy(-10)}
            className="pointer-events-auto flex size-11 md:size-12 items-center justify-center rounded-full bg-[#121217]/90 hover:bg-[#202029] border border-white/10 text-white shadow-xl transition active:scale-95 cursor-pointer"
            aria-label="Voltar 10 segundos"
          >
            <RotateCcw className="size-5" />
          </button>

          <button
            type="button"
            onClick={togglePlay}
            className="pointer-events-auto flex size-14 md:size-16 items-center justify-center rounded-full bg-[#a855f7] hover:bg-[#9333ea] text-white shadow-[0_0_25px_rgba(168,85,247,0.4)] transition active:scale-95 cursor-pointer"
            aria-label={isPlaying ? 'Pausar' : 'Reproduzir'}
          >
            {isPlaying ? (
              <Pause className="size-7 fill-current" />
            ) : (
              <Play className="size-7 fill-current ml-1" />
            )}
          </button>

          <button
            type="button"
            onClick={() => seekBy(10)}
            className="pointer-events-auto flex size-11 md:size-12 items-center justify-center rounded-full bg-[#121217]/90 hover:bg-[#202029] border border-white/10 text-white shadow-xl transition active:scale-95 cursor-pointer"
            aria-label="Avançar 10 segundos"
          >
            <RotateCw className="size-5" />
          </button>
        </div>

        {/* RODAPÉ: Dock de controles inferior compacto e autocontido */}
        <div className="pointer-events-auto flex flex-col gap-2 rounded-2xl bg-[#0f0f15]/95 border border-white/10 p-3 shadow-2xl max-w-4xl mx-auto w-full">
          {/* Barra de Progresso (Scrubber) de Alta Precisão com Buffer */}
          <div className="relative flex items-center w-full h-5 cursor-pointer group">
            {/* Trilho base de fundo */}
            <div className="absolute inset-x-0 h-1.5 rounded-full bg-white/15 overflow-hidden">
              {/* Progresso do Buffer */}
              <div
                className="h-full bg-white/30 rounded-full transition-all duration-300"
                style={{
                  width: `${duration > 0 ? (bufferedTime / duration) * 100 : 0}%`,
                }}
              />
            </div>

            {/* Trilho de Progresso Assistido */}
            <div
              className="absolute left-0 h-1.5 bg-[#a855f7] rounded-full pointer-events-none"
              style={{
                width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
              }}
            />

            {/* Ponto indicador (Thumb) com brilho roxo característico */}
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 size-3.5 rounded-full bg-white border border-[#a855f7] shadow-[0_0_8px_rgba(168,85,247,0.9)] pointer-events-none transition-transform group-hover:scale-125"
              style={{
                left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
              }}
            />

            {/* Input range invisível para arraste acessível e responsivo */}
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={Math.min(currentTime, duration || 0)}
              onChange={handleScrubberChange}
              onMouseDown={handleScrubberMouseDown}
              onMouseUp={handleScrubberMouseUp}
              onTouchStart={handleScrubberMouseDown}
              onTouchEnd={handleScrubberMouseUp}
              className="absolute inset-0 size-full opacity-0 cursor-pointer"
              aria-label="Linha do tempo do vídeo"
            />
          </div>

          {/* Linha de botões e seletores */}
          <div className="flex items-center justify-between gap-2 pt-0.5">
            {/* Esquerda: Play/Pause, Episódios Ant/Prox, Tempo */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={togglePlay}
                className="flex size-8 items-center justify-center rounded-lg hover:bg-white/10 text-white transition active:scale-95 cursor-pointer"
                aria-label={isPlaying ? 'Pausar' : 'Reproduzir'}
              >
                {isPlaying ? <Pause className="size-4 fill-current" /> : <Play className="size-4 fill-current" />}
              </button>

              {hasPrevEpisode && onPrevEpisode && (
                <button
                  type="button"
                  onClick={onPrevEpisode}
                  className="flex size-8 items-center justify-center rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition active:scale-95 cursor-pointer"
                  aria-label="Episódio anterior"
                >
                  <SkipBack className="size-4" />
                </button>
              )}

              {hasNextEpisode && onNextEpisode && (
                <button
                  type="button"
                  onClick={onNextEpisode}
                  className="flex size-8 items-center justify-center rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition active:scale-95 cursor-pointer"
                  aria-label="Próximo episódio"
                >
                  <SkipForward className="size-4" />
                </button>
              )}

              {/* Tempo decorrido / Duração total */}
              <div className="text-xs font-medium tabular-nums text-white/80 pl-1">
                <span>{formatDuration(currentTime)}</span>
                <span className="text-white/35 px-1">/</span>
                <span className="text-white/50">{formatDuration(duration)}</span>
              </div>
            </div>

            {/* Direita: Volume, Configurações (Velocidade/Qualidade), Fullscreen */}
            <div className="flex items-center gap-1.5 md:gap-2">
              {/* Controle de Volume */}
              <div className="flex items-center gap-1.5 group/volume">
                <button
                  type="button"
                  onClick={toggleMute}
                  className="flex size-8 items-center justify-center rounded-lg hover:bg-white/10 text-white transition active:scale-95 cursor-pointer"
                  aria-label={isMuted ? 'Ativar som' : 'Silenciar'}
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="size-4 text-red-400" />
                  ) : (
                    <Volume2 className="size-4" />
                  )}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-16 h-1 accent-[#a855f7] bg-white/20 rounded-lg cursor-pointer hidden md:block"
                  aria-label="Volume"
                />
              </div>

              {/* Botão de Configurações */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setActiveMenu((prev) => (prev ? null : 'main'))}
                  className={`flex size-8 items-center justify-center rounded-lg hover:bg-white/10 text-white transition active:scale-95 cursor-pointer ${
                    activeMenu ? 'bg-white/15' : ''
                  }`}
                  aria-label="Configurações"
                  aria-expanded={Boolean(activeMenu)}
                >
                  <Settings className="size-4" />
                </button>

                {/* Popover de Configurações Autocontido (SEM backdrop-filter) */}
                {activeMenu && (
                  <div className="absolute bottom-11 right-0 z-30 w-64 rounded-2xl bg-[#14141c] border border-white/15 p-2 shadow-2xl text-sm text-white">
                    {/* Menu Principal de Opções */}
                    {activeMenu === 'main' && (
                      <div className="flex flex-col gap-1">
                        <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white/40">
                          Configurações
                        </div>

                        {/* Opção de Velocidade */}
                        <button
                          type="button"
                          onClick={() => setActiveMenu('speed')}
                          className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-white/10 text-left transition cursor-pointer"
                        >
                          <span className="text-xs text-white/80">Velocidade</span>
                          <div className="flex items-center gap-1 text-xs text-[#c084fc] font-medium">
                            <span>{formatSpeedLabel(playbackSpeed)}</span>
                            <ChevronRight className="size-3.5" />
                          </div>
                        </button>

                        {/* Opção de Qualidade */}
                        <button
                          type="button"
                          onClick={() => setActiveMenu('quality')}
                          className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-white/10 text-left transition cursor-pointer"
                        >
                          <span className="text-xs text-white/80">Qualidade</span>
                          <div className="flex items-center gap-1 text-xs text-[#c084fc] font-medium">
                            <span className="truncate max-w-[110px]">{qualityDisplayLabel}</span>
                            <ChevronRight className="size-3.5" />
                          </div>
                        </button>
                      </div>
                    )}

                    {/* Submenu de Velocidade */}
                    {activeMenu === 'speed' && (
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 px-2 py-1.5 border-b border-white/10 mb-1">
                          <button
                            type="button"
                            onClick={() => setActiveMenu('main')}
                            className="p-1 rounded-lg hover:bg-white/10 text-white cursor-pointer"
                            aria-label="Voltar para configurações"
                          >
                            <ChevronLeft className="size-4" />
                          </button>
                          <span className="text-xs font-bold text-white">Velocidade</span>
                        </div>
                        {PLAYBACK_SPEEDS.map((spd) => (
                          <button
                            key={spd}
                            type="button"
                            onClick={() => handleSpeedChange(spd)}
                            className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs transition cursor-pointer ${
                              playbackSpeed === spd
                                ? 'bg-[#a855f7] text-white font-semibold'
                                : 'text-white/70 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            <span>{formatSpeedLabel(spd)}</span>
                            {playbackSpeed === spd && <Check className="size-3.5" />}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Submenu de Qualidade */}
                    {activeMenu === 'quality' && (
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 px-2 py-1.5 border-b border-white/10 mb-1">
                          <button
                            type="button"
                            onClick={() => setActiveMenu('main')}
                            className="p-1 rounded-lg hover:bg-white/10 text-white cursor-pointer"
                            aria-label="Voltar para configurações"
                          >
                            <ChevronLeft className="size-4" />
                          </button>
                          <span className="text-xs font-bold text-white">Qualidade</span>
                        </div>

                        {/* Níveis do HLS adaptativo se disponíveis */}
                        {isHlsActive && hlsLevels.length > 0 ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleQualityChange(-1)}
                              className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs transition cursor-pointer ${
                                currentLevelIndex === -1
                                  ? 'bg-[#a855f7] text-white font-semibold'
                                  : 'text-white/70 hover:bg-white/10 hover:text-white'
                              }`}
                            >
                              <span>Automático</span>
                              {currentLevelIndex === -1 && <Check className="size-3.5" />}
                            </button>
                            {hlsLevels.map((lvl) => (
                              <button
                                key={lvl.levelIndex}
                                type="button"
                                onClick={() => handleQualityChange(lvl.levelIndex)}
                                className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs transition cursor-pointer ${
                                  currentLevelIndex === lvl.levelIndex
                                    ? 'bg-[#a855f7] text-white font-semibold'
                                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                                }`}
                              >
                                <span>{lvl.label}</span>
                                {currentLevelIndex === lvl.levelIndex && <Check className="size-3.5" />}
                              </button>
                            ))}
                          </>
                        ) : (
                          // Fonte direta MP4 / WebM
                          <div className="px-3 py-2.5 text-xs text-white/70">
                            <p className="font-semibold text-white mb-1">
                              {formatQualityLabel(detectedResolution)}
                            </p>
                            <p className="text-[11px] text-white/50 leading-relaxed">
                              Fonte de vídeo direta reproduzida na qualidade máxima original.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Botão de Tela Cheia */}
              <button
                type="button"
                onClick={toggleFullscreen}
                className="flex size-8 items-center justify-center rounded-lg hover:bg-white/10 text-white transition active:scale-95 cursor-pointer"
                aria-label={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
              >
                {isFullscreen ? <Minimize className="size-4" /> : <Maximize className="size-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* FALLBACK AMIGÁVEL EM CASO DE ERRO NA FONTE DE VÍDEO                       */}
      {/* ========================================================================= */}
      {videoError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#09090d]/95 p-6 text-center z-30">
          <div className="w-12 h-12 rounded-full bg-purple-950/80 border border-purple-700/50 flex items-center justify-center text-[#c084fc] mb-4">
            <Info className="w-6 h-6" />
          </div>
          <h4 className="text-base font-semibold text-white mb-1">
            {video?.isLocalFile
              ? 'Erro na Decodificação do Vídeo Local'
              : 'Não foi possível reproduzir este vídeo.'}
          </h4>
          <p className="text-xs text-slate-300 max-w-md mb-5 leading-relaxed">{videoError}</p>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#a855f7] hover:bg-[#9333ea] text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              Voltar para a Biblioteca
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default CustomVideoPlayer;
