import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  Settings,
  Gauge,
  Sliders,
  ChevronRight,
  ChevronLeft,
  Info,
  X,
  Check,
  Radio,
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

export type { VideoItem };

export interface VideoMetadataUpdates {
  duration?: number;
  durationFormatted?: string;
  resolution?: VideoResolution;
}

export interface NovaStreamPlayerProps {
  /** Objeto de vídeo original NOVA STREAM */
  video: VideoItem;
  /** Ação de fechamento / retorno da tela */
  onClose?: () => void;
  /** Iniciar reprodução automaticamente quando o vídeo estiver pronto */
  autoPlay?: boolean;
  /** Callback para sincronização de metadados do vídeo */
  onUpdateMetadata?: (videoId: string, metadata: VideoMetadataUpdates) => void;
  /** Tempo inicial em segundos para retomar a reprodução */
  initialTime?: number;
  /** Callback acionado periodicamente com o progresso atual */
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  /** Callback acionado ao término do vídeo */
  onEnded?: () => void;
  /** Classe CSS customizada opcional */
  className?: string;
}

export const NovaStreamPlayer: React.FC<NovaStreamPlayerProps> = ({
  video,
  onClose,
  autoPlay = true,
  onUpdateMetadata,
  initialTime,
  onTimeUpdate,
  onEnded,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const initialTimeAppliedRef = useRef(false);
  const settingsMenuRef = useRef<HTMLDivElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);

  // Obter URL de vídeo real com suporte a aliases
  const rawUrl = video.videoUrl || video.url || '';
  const effectiveVideoUrl = video.isLocalFile
    ? getLocalVideoUrl(video.id) || rawUrl
    : rawUrl;

  const effectivePoster = video.posterUrl || video.thumbnailUrl || '';

  // Estados de reprodução
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(video.duration || 0);
  const [bufferedTime, setBufferedTime] = useState(0);
  const [volume, setVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1);
  const [selectedQuality, setSelectedQuality] = useState<QualityLevel>('auto');

  // Resolução e dimensões detectadas em tempo de execução
  const [detectedResolution, setDetectedResolution] = useState<VideoResolution>(
    video.resolution || 'N/D'
  );
  const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number } | null>(null);

  // Estados de streaming HLS adaptativo
  const [isHlsActive, setIsHlsActive] = useState(false);
  const [availableLevels, setAvailableLevels] = useState<StreamQualityOption[]>([]);
  const [requestedHlsLevel, setRequestedHlsLevel] = useState<number>(-1); // -1 = Automático (ABR)
  const [effectiveHlsLevel, setEffectiveHlsLevel] = useState<number>(-1); // Nível ativo confirmado no hls.js
  const [isLevelSwitchPending, setIsLevelSwitchPending] = useState<boolean>(false);
  const [currentBitrate, setCurrentBitrate] = useState<number | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const switchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isHlsUrl = useCallback((url: string): boolean => {
    if (!url) return false;
    const cleanUrl = url.split('?')[0].toLowerCase();
    return cleanUrl.endsWith('.m3u8') || url.includes('.m3u8') || url.includes('/hls/');
  }, []);

  // Sincronizar resolução inicial e limpar erros/dimensões ao alternar de vídeo ou URL
  useEffect(() => {
    setDetectedResolution(video.resolution || 'N/D');
    setVideoDimensions(null);
    setCurrentBitrate(null);
    setRequestedHlsLevel(-1);
    setEffectiveHlsLevel(-1);
    setIsLevelSwitchPending(false);
    initialTimeAppliedRef.current = false;
    setVideoError(null);
    if (switchTimeoutRef.current) {
      clearTimeout(switchTimeoutRef.current);
      switchTimeoutRef.current = null;
    }
  }, [video.id, video.resolution, effectiveVideoUrl]);

  // Resolução efetiva para exibição honesta
  const displayResolution: VideoResolution =
    detectedResolution !== 'N/D'
      ? detectedResolution
      : !isHlsActive && video.resolution && video.resolution !== 'N/D'
        ? video.resolution
        : 'N/D';

  // Controles de visibilidade da interface
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isHoveringProgress, setIsHoveringProgress] = useState(false);
  const [hoverTime, setHoverTime] = useState(0);
  const [hoverPosition, setHoverPosition] = useState(0);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'main' | 'speed' | 'quality'>('main');
  const [videoError, setVideoError] = useState<string | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Estados e referências para gestos de toque (YouTube-style)
  // Duplo toque: avançar / retroceder 10s com animação
  const [doubleTapFeedback, setDoubleTapFeedback] = useState<{
    side: 'left' | 'right';
    id: number;
  } | null>(null);
  // Toque simples: animação discreta e centralizada de Play / Pause
  const [playPauseFeedback, setPlayPauseFeedback] = useState<{
    action: 'play' | 'pause';
    id: number;
  } | null>(null);

  const lastTapRef = useRef<{ time: number; x: number; y: number; side: 'left' | 'right' } | null>(null);
  const singleTapTimerRef = useRef<NodeJS.Timeout | null>(null);
  const doubleTapFeedbackTimerRef = useRef<NodeJS.Timeout | null>(null);
  const playPauseFeedbackTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isTouchRef = useRef(false);

  // Listener para confirmação física de redimensionamento do decodificador no elemento <video>
  const handleVideoResize = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    const rawHeight = el.videoHeight;
    const rawWidth = el.videoWidth;
    if (rawWidth > 0 && rawHeight > 0) {
      setVideoDimensions({ width: rawWidth, height: rawHeight });
      const detected = classifyVideoResolution(rawHeight);
      if (detected !== 'N/D') {
        setDetectedResolution(detected);
      }
      setIsLevelSwitchPending(false);
    }
  }, []);

  // Inicialização do pipeline de decodificação: Hls.js ou HTML5 Direto
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    // Se a URL estiver vazia, reseta e aguarda
    if (!effectiveVideoUrl) {
      setVideoError(null);
      return;
    }

    // Se for URL de catálogo / streaming externa que não seja arquivo de vídeo direto
    const trimmedUrl = effectiveVideoUrl.trim().toLowerCase();
    if (
      trimmedUrl.includes('crunchyroll.com') ||
      trimmedUrl.includes('netflix.com') ||
      trimmedUrl.includes('youtube.com/watch') ||
      trimmedUrl.includes('youtu.be/') ||
      trimmedUrl.includes('funimation.com') ||
      trimmedUrl.includes('hidive.com') ||
      trimmedUrl.includes('animesonline') ||
      trimmedUrl.includes('betteranime')
    ) {
      setVideoError(
        'Esta URL é uma página externa de streaming e não pode ser reproduzida diretamente no player. Forneça uma URL direta de vídeo ou playlist HLS.'
      );
      return;
    }

    // Destrói instância Hls anterior se houver e reseta erros
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const isHls = isHlsUrl(effectiveVideoUrl);
    setIsHlsActive(isHls);
    setVideoError(null);

    // Registra listener nativo de resize para acompanhar mudanças físicas de resolução do decodificador
    videoEl.addEventListener('resize', handleVideoResize);

    if (isHls && Hls.isSupported()) {
      // Remove qualquer src direto do elemento <video> para impedir
      // que o decodificador nativo tente processar a playlist HLS (.m3u8)
      videoEl.removeAttribute('src');
      videoEl.load();

      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 60,
        capLevelToPlayerSize: false,
      });
      hlsRef.current = hls;

      hls.attachMedia(videoEl);
      hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        hls.loadSource(effectiveVideoUrl);
      });

      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        setVideoError(null);
        const parsedLevels: StreamQualityOption[] = [
          {
            levelIndex: -1,
            label: 'Automático',
            resolution: 'Auto',
          },
        ];

        // Ordena visualmente por resolução decrescente preservando o índice real em data.levels
        const sortedVariants = data.levels
          .map((lvl, origIdx) => ({ lvl, origIdx }))
          .sort((a, b) => (b.lvl.height || 0) - (a.lvl.height || 0));

        sortedVariants.forEach(({ lvl, origIdx }) => {
          const height = lvl.height || 0;
          const resLabel =
            height >= 2160
              ? '4K'
              : height >= 1080
              ? '1080p'
              : height >= 720
              ? '720p'
              : height >= 480
              ? '480p'
              : height > 0
              ? `${height}p`
              : `Nível ${origIdx + 1}`;

          parsedLevels.push({
            levelIndex: origIdx,
            label: resLabel,
            resolution: resLabel,
            height: lvl.height,
            width: lvl.width,
            bitrate: lvl.bitrate,
          });
        });

        setAvailableLevels(parsedLevels);
        setRequestedHlsLevel(-1);
        setEffectiveHlsLevel(-1);
        setIsLevelSwitchPending(false);

        if (initialTime && initialTime > 0 && !initialTimeAppliedRef.current) {
          initialTimeAppliedRef.current = true;
          videoEl.currentTime = initialTime;
          setCurrentTime(initialTime);
        }

        if (autoPlay) {
          videoEl.play().catch((err) => {
            console.warn('Auto-play HLS restrito pelo navegador:', err);
            setIsPlaying(false);
          });
        }
      });

      hls.on(Hls.Events.LEVEL_SWITCHING, (_event, _data) => {
        setIsLevelSwitchPending(true);
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
        setEffectiveHlsLevel(data.level);
        const lvl = hls.levels[data.level];
        if (lvl && lvl.bitrate) {
          setCurrentBitrate(lvl.bitrate);
        }
        if (videoEl.videoHeight > 0 && lvl && (!lvl.height || videoEl.videoHeight === lvl.height)) {
          setIsLevelSwitchPending(false);
          const detected = classifyVideoResolution(videoEl.videoHeight);
          if (detected !== 'N/D') {
            setDetectedResolution(detected);
          }
        }
      });

      hls.on(Hls.Events.FRAG_CHANGED, (_event, data) => {
        if (data.frag && typeof data.frag.level === 'number') {
          const fragLevel = data.frag.level;
          setEffectiveHlsLevel(fragLevel);
          const lvl = hls.levels[fragLevel];
          if (lvl && lvl.bitrate) {
            setCurrentBitrate(lvl.bitrate);
          }
          if (videoEl.videoHeight > 0 && lvl && (!lvl.height || videoEl.videoHeight === lvl.height)) {
            setIsLevelSwitchPending(false);
            const detected = classifyVideoResolution(videoEl.videoHeight);
            if (detected !== 'N/D') {
              setDetectedResolution(detected);
            }
          }
        }
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        console.warn('HLS Event:', data.type, data.details);
        if (
          data.details === Hls.ErrorDetails.LEVEL_LOAD_ERROR ||
          data.details === Hls.ErrorDetails.LEVEL_LOAD_TIMEOUT
        ) {
          console.warn('Falha no carregamento do nível HLS selecionado:', data.details);
          setIsLevelSwitchPending(false);
          if (hls.currentLevel !== -1) {
            hls.currentLevel = -1;
            setRequestedHlsLevel(-1);
          }
        }
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.warn('Erro de rede fatal no HLS, tentando recuperar...');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.warn('Erro de mídia fatal no HLS, tentando recuperar...');
              hls.recoverMediaError();
              break;
            default:
              console.error('Erro HLS fatal:', data.details);
              hls.destroy();
              setVideoError(
                'Não foi possível estabelecer transmissão contínua com a stream HLS adaptativa.'
              );
              break;
          }
        }
      });
    } else if (isHls && videoEl.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari / iOS suporte nativo a HLS
      videoEl.src = effectiveVideoUrl;
      videoEl.load();
      setIsHlsActive(true);
      setAvailableLevels([{ levelIndex: -1, label: 'Automático (Nativo)', resolution: 'Auto' }]);
      if (initialTime && initialTime > 0 && !initialTimeAppliedRef.current) {
        initialTimeAppliedRef.current = true;
        videoEl.currentTime = initialTime;
        setCurrentTime(initialTime);
      }
      if (autoPlay) {
        videoEl.play().catch(() => setIsPlaying(false));
      }
    } else {
      // Fonte direta MP4, WebM ou Blob local (Vercel Blob, etc.)
      videoEl.src = effectiveVideoUrl;
      videoEl.load();
      setIsHlsActive(false);
      setAvailableLevels([]);
      if (initialTime && initialTime > 0 && !initialTimeAppliedRef.current) {
        initialTimeAppliedRef.current = true;
        videoEl.currentTime = initialTime;
        setCurrentTime(initialTime);
      }
      if (autoPlay) {
        videoEl.play().catch((err) => {
          console.warn('Auto-play restrito pelo navegador:', err);
          setIsPlaying(false);
        });
      }
    }

    return () => {
      videoEl.removeEventListener('resize', handleVideoResize);
      if (switchTimeoutRef.current) {
        clearTimeout(switchTimeoutRef.current);
        switchTimeoutRef.current = null;
      }
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [effectiveVideoUrl, autoPlay, isHlsUrl, handleVideoResize, initialTime]);

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Resetar timer para ocultar controles
  const showControlsTemporarily = useCallback(() => {
    setControlsVisible(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying && !showSettingsMenu) {
        setControlsVisible(false);
      }
    }, 3500);
  }, [isPlaying, showSettingsMenu]);

  // Limpeza de timers de gestos no desmonte
  useEffect(() => {
    return () => {
      if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
      if (doubleTapFeedbackTimerRef.current) clearTimeout(doubleTapFeedbackTimerRef.current);
      if (playPauseFeedbackTimerRef.current) clearTimeout(playPauseFeedbackTimerRef.current);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, []);

  // Disparo da animação temporária e discreta de play / pause
  const triggerPlayPauseFeedback = useCallback((action: 'play' | 'pause') => {
    setPlayPauseFeedback({ action, id: Date.now() });
    if (playPauseFeedbackTimerRef.current) {
      clearTimeout(playPauseFeedbackTimerRef.current);
    }
    playPauseFeedbackTimerRef.current = setTimeout(() => {
      setPlayPauseFeedback(null);
    }, 650);
  }, []);

  // Controle de Play/Pause com animação temporária
  const togglePlay = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      el.play()
        .then(() => {
          setIsPlaying(true);
          triggerPlayPauseFeedback('play');
        })
        .catch((err) => {
          console.warn('Auto-play restrito pelo navegador:', err);
          setIsPlaying(false);
        });
    } else {
      el.pause();
      setIsPlaying(false);
      triggerPlayPauseFeedback('pause');
    }
    showControlsTemporarily();
  }, [showControlsTemporarily, triggerPlayPauseFeedback]);

  // Avançar / retroceder 10s respeitando os limites de início e fim
  const seekRelative = useCallback((deltaSec: number) => {
    const el = videoRef.current;
    if (!el) return;
    const maxDur = el.duration || duration || 0;
    const target = Math.max(0, Math.min(maxDur, el.currentTime + deltaSec));
    el.currentTime = target;
    setCurrentTime(target);
    showControlsTemporarily();
  }, [duration, showControlsTemporarily]);

  // Manipulador de gestos na área do vídeo (1 toque: play/pause, 2 toques: ±10s)
  const handleVideoAreaTap = useCallback(
    (clientX: number, clientY: number) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const relativeX = clientX - rect.left;
      const side: 'left' | 'right' = relativeX < rect.width / 2 ? 'left' : 'right';
      const now = Date.now();
      const previous = lastTapRef.current;

      // 1. Detecção de duplo toque (dois toques rápidos dentro de 280ms no mesmo lado da tela)
      if (
        previous &&
        previous.side === side &&
        now - previous.time < 280 &&
        Math.hypot(clientX - previous.x, clientY - previous.y) < 60
      ) {
        // Cancela o timer de toque simples pendente para NÃO pausar/reproduzir acidentalmente
        if (singleTapTimerRef.current) {
          clearTimeout(singleTapTimerRef.current);
          singleTapTimerRef.current = null;
        }
        lastTapRef.current = null;

        // Executa o salto de 10 segundos
        seekRelative(side === 'left' ? -10 : 10);

        // Ativa animação temporária com ícone de avançar/voltar e o número 10
        setDoubleTapFeedback({ side, id: now });
        if (doubleTapFeedbackTimerRef.current) {
          clearTimeout(doubleTapFeedbackTimerRef.current);
        }
        doubleTapFeedbackTimerRef.current = setTimeout(() => {
          setDoubleTapFeedback(null);
        }, 700);

        return;
      }

      // 2. Primeiro toque: registra o toque e agenda o toque simples
      lastTapRef.current = { time: now, x: clientX, y: clientY, side };
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
      }

      singleTapTimerRef.current = setTimeout(() => {
        // Toque simples confirmado: alterna Play / Pause e mostra animação central
        lastTapRef.current = null;
        singleTapTimerRef.current = null;

        const el = videoRef.current;
        if (!el) return;

        if (el.paused) {
          el.play()
            .then(() => {
              setIsPlaying(true);
              triggerPlayPauseFeedback('play');
              showControlsTemporarily();
            })
            .catch(() => {
              setIsPlaying(false);
            });
        } else {
          el.pause();
          setIsPlaying(false);
          setControlsVisible(true);
          triggerPlayPauseFeedback('pause');
        }
      }, 250);
    },
    [seekRelative, showControlsTemporarily, triggerPlayPauseFeedback]
  );

  const handleVideoClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isTouchRef.current) {
        isTouchRef.current = false;
        return;
      }
      handleVideoAreaTap(e.clientX, e.clientY);
    },
    [handleVideoAreaTap]
  );

  const handleVideoTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (e.changedTouches.length === 0) return;
      const touch = e.changedTouches[0];
      isTouchRef.current = true;
      handleVideoAreaTap(touch.clientX, touch.clientY);
    },
    [handleVideoAreaTap]
  );

  // Atualização de tempo do vídeo e propagação de progresso para o Hikari
  const handleTimeUpdate = () => {
    const el = videoRef.current;
    if (!el) return;
    setCurrentTime(el.currentTime);
    if (el.buffered.length > 0) {
      setBufferedTime(el.buffered.end(el.buffered.length - 1));
    }
    if (onTimeUpdate && el.duration > 0) {
      onTimeUpdate(el.currentTime, el.duration);
    }
  };

  const handleLoadedMetadata = () => {
    const el = videoRef.current;
    if (!el) return;
    if (el.duration && !isNaN(el.duration)) {
      setDuration(el.duration);
    }
    setVideoError(null);
    const rawDur = el.duration;
    const rawHeight = el.videoHeight;
    const rawWidth = el.videoWidth;
    if (rawWidth > 0 && rawHeight > 0) {
      setVideoDimensions({ width: rawWidth, height: rawHeight });
    }
    const detected = classifyVideoResolution(rawHeight);
    if (detected !== 'N/D') {
      setDetectedResolution(detected);
    }

    // Retoma tempo salvo do Hikari de forma não-intrusiva
    if (!initialTimeAppliedRef.current && initialTime && initialTime > 0) {
      initialTimeAppliedRef.current = true;
      if (rawDur && initialTime < rawDur - 2) {
        el.currentTime = initialTime;
        setCurrentTime(initialTime);
      }
    }

    // Propagação de metadados reais confirmados pelo player
    if (onUpdateMetadata) {
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

  // Clique na barra de progresso
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
  };

  const handleProgressMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const bar = progressBarRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const mouseX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const ratio = mouseX / rect.width;
    setHoverPosition(mouseX);
    setHoverTime(ratio * (duration || 0));
  };

  // Volume
  const handleVolumeChange = (newVol: number) => {
    const el = videoRef.current;
    const clamped = Math.max(0, Math.min(1, newVol));
    setVolume(clamped);
    if (el) {
      el.volume = clamped;
      el.muted = clamped === 0;
    }
    setIsMuted(clamped === 0);
  };

  const toggleMute = () => {
    const el = videoRef.current;
    if (!el) return;
    if (isMuted) {
      el.muted = false;
      el.volume = volume > 0 ? volume : 0.5;
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
    if (!document.fullscreenElement) {
      container
        .requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch(() => {
          // fallback se fullscreen api for restrita
        });
    } else {
      document
        .exitFullscreen()
        .then(() => setIsFullscreen(false))
        .catch(() => {
          // fallback
        });
    }
  };

  // Alterar velocidade
  const changeSpeed = (speed: PlaybackSpeed) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  };

  // Alterar seleção visual de qualidade (e sincronizar com HLS se a stream for adaptativa)
  const changeQuality = (q: QualityLevel) => {
    setSelectedQuality(q);
    if (isHlsActive && hlsRef.current) {
      if (q === 'auto') {
        changeHlsQuality(-1, 'auto');
      } else {
        const targetLvl = availableLevels.find(
          (lvl) => lvl.label.toLowerCase() === q.toLowerCase()
        );
        if (targetLvl && targetLvl.levelIndex >= 0) {
          changeHlsQuality(targetLvl.levelIndex, targetLvl.resolution);
        }
      }
    }
    setShowSettingsMenu(false);
  };

  // Alterar nível de qualidade real para transmissões HLS via hls.js
  const changeHlsQuality = (levelIndex: number, resLabel: string) => {
    const hls = hlsRef.current;
    const el = videoRef.current;
    if (!hls) return;
    if (switchTimeoutRef.current) {
      clearTimeout(switchTimeoutRef.current);
      switchTimeoutRef.current = null;
    }
    setRequestedHlsLevel(levelIndex);
    setSelectedQuality(resLabel.toLowerCase() as QualityLevel);
    if (levelIndex === -1) {
      // Reativa o modo Automático (ABR)
      hls.currentLevel = -1;
      setIsLevelSwitchPending(false);
    } else {
      // Solicita a qualidade manual selecionada no hls.js
      hls.currentLevel = levelIndex;
      const targetLvl = hls.levels[levelIndex];
      const targetHeight = targetLvl?.height;
      if (el && targetHeight && el.videoHeight > 0 && el.videoHeight === targetHeight) {
        setIsLevelSwitchPending(false);
        if (targetLvl.bitrate) {
          setCurrentBitrate(targetLvl.bitrate);
        }
      } else {
        setIsLevelSwitchPending(true);
        switchTimeoutRef.current = setTimeout(() => {
          setIsLevelSwitchPending(false);
        }, 8000);
      }
    }
    setShowSettingsMenu(false);
  };

  // Teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorar se o foco estiver em campo de texto
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }
      if (e.code === 'Space' || e.key === 'k') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        seekRelative(-10);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        seekRelative(10);
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        toggleMute();
      } else if (e.code === 'Escape') {
        if (isFullscreen) {
          document.exitFullscreen().catch(() => {});
        } else if (onClose) {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, seekRelative, isFullscreen, onClose]);

  // Listener para evento fullscreenchange do navegador
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Fechar menus ao clicar fora de forma segura (preservando cliques internos com troca de abas)
  useEffect(() => {
    if (!showSettingsMenu) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      // Se o elemento não existe ou já foi desmontado do DOM durante a troca de abas, ignorar
      if (!target || !document.contains(target)) {
        return;
      }
      if (
        settingsMenuRef.current &&
        !settingsMenuRef.current.contains(target) &&
        settingsButtonRef.current &&
        !settingsButtonRef.current.contains(target)
      ) {
        setShowSettingsMenu(false);
      }
    };

    document.addEventListener('pointerdown', handleClickOutside);
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showSettingsMenu]);

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPercent = duration > 0 ? (bufferedTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      onMouseMove={showControlsTemporarily}
      onTouchStart={showControlsTemporarily}
      className={`relative w-full ${isFullscreen ? 'h-full flex items-center justify-center' : 'aspect-video'} bg-black select-none overflow-hidden rounded-2xl border border-white/10 shadow-[0_20px_70px_rgba(0,0,0,0.55)] group ${className || ''}`}
    >
      {/* Elemento de Vídeo HTML5 com suporte a HLS.js adaptativo e decodificação nativa */}
      <video
        ref={videoRef}
        poster={effectivePoster}
        playsInline
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onResize={handleVideoResize}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={onEnded}
        onError={() => {
          // Erros de stream HLS são gerenciados com resiliência pelo Hls.js
          if (isHlsUrl(effectiveVideoUrl) || hlsRef.current) {
            return;
          }
          if (video.isLocalFile) {
            setVideoError(
              'O navegador não conseguiu decodificar o arquivo de vídeo selecionado. Verifique se o formato (MP4, WebM) e codec (H.264/AAC) são suportados nativamente pelo seu navegador.'
            );
          } else {
            setVideoError(
              'Não foi possível carregar a fonte de vídeo remota. Verifique a URL do vídeo ou selecione outro player.'
            );
          }
        }}
        className="w-full h-full object-contain max-h-screen"
      />

      {/* Camada transparente de captura de gestos (1 toque: play/pause, 2 toques: ±10s) */}
      <div
        onClick={handleVideoClick}
        onTouchEnd={handleVideoTouchEnd}
        className="absolute inset-0 z-10 cursor-pointer"
        aria-label="Área de controle do vídeo"
      />

      {/* Fallback caso a fonte falhe */}
      {videoError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0B0C10]/95 p-6 text-center z-20">
          <div className="w-12 h-12 rounded-full bg-indigo-950/80 border border-indigo-700/50 flex items-center justify-center text-indigo-400 mb-4">
            <Info className="w-6 h-6" />
          </div>
          <h4 className="text-base font-semibold text-white mb-1">
            {video.isLocalFile
              ? 'Erro na Decodificação do Vídeo Local'
              : 'Fonte de Reprodução em Manutenção'}
          </h4>
          <p className="text-xs text-slate-300 max-w-md mb-5 leading-relaxed">{videoError}</p>
          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition-colors"
            >
              Voltar ao Player Padrão
            </button>
          )}
        </div>
      )}

      {/* Barra superior (botão fechar se fornecido) */}
      {onClose && (
        <div
          className={`absolute top-0 left-0 right-0 p-4 md:p-6 bg-gradient-to-b from-black/80 via-black/40 to-transparent transition-opacity duration-300 z-30 flex items-center justify-between ${
            controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <button
            onClick={onClose}
            aria-label="Voltar para o player padrão"
            title="Voltar para o player padrão"
            className="w-9 h-9 rounded-full bg-slate-900/80 hover:bg-slate-800 text-slate-200 hover:text-white flex items-center justify-center transition-colors border border-slate-700/50 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Indicador temporário de Duplo Toque (+10s / -10s) */}
      {doubleTapFeedback && (
        <div
          key={`dt-${doubleTapFeedback.id}`}
          className={`pointer-events-none absolute top-1/2 -translate-y-1/2 z-25 flex flex-col items-center justify-center size-20 rounded-full bg-black/70 text-white border border-white/20 shadow-2xl backdrop-blur-md transition-all duration-300 animate-in fade-in zoom-in-75 ${
            doubleTapFeedback.side === 'left' ? 'left-8 sm:left-14' : 'right-8 sm:right-14'
          }`}
        >
          {doubleTapFeedback.side === 'left' ? (
            <RotateCcw className="w-7 h-7 text-white" />
          ) : (
            <RotateCw className="w-7 h-7 text-white" />
          )}
          <span className="text-xs font-bold text-white tracking-wide mt-1">
            {doubleTapFeedback.side === 'left' ? '-10s' : '+10s'}
          </span>
        </div>
      )}

      {/* Indicador temporário discreto e centralizado ao tocar para reproduzir ou pausar */}
      {playPauseFeedback && (
        <div
          key={`pp-${playPauseFeedback.id}`}
          className="pointer-events-none absolute inset-0 z-25 flex items-center justify-center"
        >
          <div className="flex size-16 sm:size-20 items-center justify-center rounded-full bg-black/70 text-white border border-white/20 shadow-2xl backdrop-blur-md transition-all duration-300 animate-in fade-in zoom-in-75">
            {playPauseFeedback.action === 'play' ? (
              <Play className="w-8 h-8 sm:w-10 sm:h-10 ml-1 fill-white" />
            ) : (
              <Pause className="w-8 h-8 sm:w-10 sm:h-10 fill-white" />
            )}
          </div>
        </div>
      )}

      {/* Overlay inferior de controles */}
      <div
        onClick={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
        className={`absolute bottom-0 left-0 right-0 p-3 sm:p-5 bg-gradient-to-t from-black/95 via-black/70 to-transparent transition-opacity duration-300 z-30 ${
          controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Barra de Progresso Interativa */}
        <div
          ref={progressBarRef}
          onClick={handleProgressSeek}
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

        {/* Linha de Botões de Controle */}
        <div className="flex items-center justify-between gap-2 text-slate-200">
          {/* Lado Esquerdo: Play, Voltar 10s, Avançar 10s, Volume, Tempo */}
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={togglePlay}
              aria-label={isPlaying ? 'Pausar' : 'Reproduzir'}
              className="w-10 h-10 flex items-center justify-center hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
            </button>
            <button
              onClick={() => seekRelative(-10)}
              aria-label="Voltar 10 segundos"
              className="w-10 h-10 flex items-center justify-center hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              title="Voltar 10s"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={() => seekRelative(10)}
              aria-label="Avançar 10 segundos"
              className="w-10 h-10 flex items-center justify-center hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              title="Avançar 10s"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            {/* Controle de Volume */}
            <div className="flex items-center group/vol">
              <button
                onClick={toggleMute}
                aria-label={isMuted ? 'Ativar som' : 'Desativar som'}
                className="w-10 h-10 flex items-center justify-center hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
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
            <div className="text-xs font-mono text-slate-300 ml-1 sm:ml-2 tabular-nums">
              <span>{formatTime(currentTime)}</span>
              <span className="text-slate-500 mx-1">/</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Lado Direito: Configurações e Fullscreen */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Menu Popover de Configurações (Velocidade e Qualidade integradas) */}
            <div className="relative">
              <button
                ref={settingsButtonRef}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSettingsMenu((prev) => !prev);
                  setSettingsTab('main');
                }}
                className="player-menu-trigger w-10 h-10 flex items-center justify-center rounded-lg hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer touch-manipulation"
                title="Configurações do Player"
                aria-label="Configurações do Player"
                aria-expanded={showSettingsMenu}
              >
                <Settings className="w-5 h-5" />
              </button>

              {showSettingsMenu && (
                <div
                  ref={settingsMenuRef}
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  className="player-menu-content absolute bottom-12 right-0 w-64 max-w-[calc(100vw-2rem)] bg-[#12131A]/95 border border-slate-800 rounded-2xl p-2 shadow-2xl z-40 backdrop-blur-md touch-manipulation select-none"
                >
                  {/* Vista Principal das Configurações */}
                  {settingsTab === 'main' && (
                    <div className="flex flex-col gap-1">
                      <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800/80">
                        Configurações
                      </div>

                      {/* Opção de Velocidade */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSettingsTab('speed');
                        }}
                        className="flex items-center justify-between rounded-xl px-3 py-2.5 min-h-[40px] text-xs text-slate-200 hover:bg-slate-800/80 hover:text-white transition cursor-pointer touch-manipulation"
                      >
                        <div className="flex items-center gap-2">
                          <Gauge className="w-4 h-4 text-indigo-400" />
                          <span className="font-medium">Velocidade</span>
                        </div>
                        <span className="text-[11px] text-indigo-300 font-semibold flex items-center gap-0.5">
                          {playbackSpeed === 1 ? '1x (Normal)' : `${playbackSpeed}x`}
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                        </span>
                      </button>

                      {/* Opção de Qualidade */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSettingsTab('quality');
                        }}
                        className="flex items-center justify-between rounded-xl px-3 py-2.5 min-h-[40px] text-xs text-slate-200 hover:bg-slate-800/80 hover:text-white transition cursor-pointer touch-manipulation"
                      >
                        <div className="flex items-center gap-2">
                          <Sliders className="w-4 h-4 text-indigo-400" />
                          <span className="font-medium">Qualidade</span>
                        </div>
                        <span className="text-[11px] text-indigo-300 font-semibold flex items-center gap-0.5">
                          {isHlsActive && requestedHlsLevel !== -1
                            ? availableLevels.find((lvl) => lvl.levelIndex === requestedHlsLevel)?.label || 'Manual'
                            : selectedQuality === 'auto'
                              ? displayResolution !== 'N/D'
                                ? `Auto (${displayResolution})`
                                : 'Automático'
                              : selectedQuality}
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                        </span>
                      </button>
                    </div>
                  )}

                  {/* Submenu de Velocidade de Reprodução */}
                  {settingsTab === 'speed' && (
                    <div className="flex flex-col gap-1 max-h-64 overflow-y-auto custom-scrollbar">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSettingsTab('main');
                        }}
                        className="flex items-center gap-1.5 px-3 py-2 min-h-[36px] text-xs font-semibold text-slate-400 hover:text-white transition cursor-pointer touch-manipulation"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        <span>Velocidade de Reprodução</span>
                      </button>
                      <div className="border-t border-slate-800/80 my-0.5" />
                      {([0.5, 0.75, 1, 1.25, 1.5, 2] as PlaybackSpeed[]).map((spd) => (
                        <button
                          key={spd}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            changeSpeed(spd);
                            setShowSettingsMenu(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 min-h-[38px] text-xs rounded-xl transition cursor-pointer touch-manipulation ${
                            playbackSpeed === spd
                              ? 'bg-indigo-600/30 text-indigo-300 font-semibold'
                              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                          }`}
                        >
                          <span>{spd === 1 ? '1x (Normal)' : `${spd}x`}</span>
                          {playbackSpeed === spd && <Check className="w-4 h-4 text-indigo-400" />}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Submenu de Qualidade do Vídeo */}
                  {settingsTab === 'quality' && (
                    <div className="flex flex-col gap-1 max-h-64 overflow-y-auto custom-scrollbar">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSettingsTab('main');
                        }}
                        className="flex items-center gap-1.5 px-3 py-2 min-h-[36px] text-xs font-semibold text-slate-400 hover:text-white transition cursor-pointer touch-manipulation"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        <span>Qualidade do Vídeo</span>
                      </button>
                      <div className="border-t border-slate-800/80 my-0.5" />

                      {/* Opção Automático */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isHlsActive && hlsRef.current) {
                            changeHlsQuality(-1, 'auto');
                          } else {
                            changeQuality('auto');
                          }
                          setShowSettingsMenu(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 min-h-[38px] text-xs rounded-xl transition cursor-pointer touch-manipulation ${
                          selectedQuality === 'auto' || (isHlsActive && requestedHlsLevel === -1)
                            ? 'bg-indigo-600/30 text-indigo-300 font-semibold'
                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span>Automático</span>
                          {displayResolution !== 'N/D' && (
                            <span className="text-[10px] text-slate-400 font-normal">
                              ({displayResolution})
                            </span>
                          )}
                        </div>
                        {(selectedQuality === 'auto' || (isHlsActive && requestedHlsLevel === -1)) && (
                          <Check className="w-4 h-4 text-indigo-400" />
                        )}
                      </button>

                      {/* Variantes HLS reais se disponíveis */}
                      {isHlsActive && availableLevels.filter((lvl) => lvl.levelIndex >= 0).length > 0 ? (
                        availableLevels
                          .filter((lvl) => lvl.levelIndex >= 0)
                          .map((lvl) => {
                            const isSelected = requestedHlsLevel === lvl.levelIndex;
                            return (
                              <button
                                key={lvl.levelIndex}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  changeHlsQuality(lvl.levelIndex, lvl.resolution);
                                  setShowSettingsMenu(false);
                                }}
                                className={`w-full flex items-center justify-between px-3 py-2 min-h-[38px] text-xs rounded-xl transition cursor-pointer touch-manipulation ${
                                  isSelected
                                    ? 'bg-indigo-600/30 text-indigo-300 font-semibold'
                                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="uppercase">{lvl.label}</span>
                                  {lvl.height && lvl.height >= 1080 && (
                                    <span className="text-[10px] text-slate-400 font-normal">Full HD</span>
                                  )}
                                  {lvl.height && lvl.height === 720 && (
                                    <span className="text-[10px] text-slate-400 font-normal">HD</span>
                                  )}
                                </div>
                                {isSelected && <Check className="w-4 h-4 text-indigo-400" />}
                              </button>
                            );
                          })
                      ) : (
                        /* Fallback para fontes diretas (MP4/WebM) */
                        (['1080p', '720p', '480p', '360p'] as QualityLevel[]).map((q) => {
                          const isSelected = selectedQuality === q && requestedHlsLevel !== -1;
                          return (
                            <button
                              key={q}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                changeQuality(q);
                                setShowSettingsMenu(false);
                              }}
                              className={`w-full flex items-center justify-between px-3 py-2 min-h-[38px] text-xs rounded-xl transition cursor-pointer touch-manipulation ${
                                isSelected
                                  ? 'bg-indigo-600/30 text-indigo-300 font-semibold'
                                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="uppercase">{q}</span>
                                {q === '1080p' && (
                                  <span className="text-[10px] text-slate-400 font-normal">Full HD</span>
                                )}
                                {q === '720p' && (
                                  <span className="text-[10px] text-slate-400 font-normal">HD</span>
                                )}
                              </div>
                              {isSelected && <Check className="w-4 h-4 text-indigo-400" />}
                            </button>
                          );
                        })
                      )}

                      <div className="mt-1 pt-2 border-t border-slate-800/80 px-2 text-[10px] text-slate-400 leading-normal">
                        {isHlsActive
                          ? 'Stream HLS adaptativa com seleção dinâmica de variantes.'
                          : 'Ajuste de preferência de qualidade para reprodução.'}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Tela Cheia */}
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
              className="w-10 h-10 flex items-center justify-center hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            >
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NovaStreamPlayer;
