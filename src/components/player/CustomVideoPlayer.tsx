import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import type Hls from 'hls.js';
import { VideoPlayer, Video, VideoSkin } from '@videojs/react/video';

function isMediaSourceSupported(): boolean {
  if (typeof window === 'undefined') return false;
  const mediaSource =
    window.MediaSource ||
    (window as unknown as { WebKitMediaSource?: typeof MediaSource }).WebKitMediaSource;
  if (!mediaSource || typeof mediaSource.isTypeSupported !== 'function') {
    return false;
  }
  return (
    mediaSource.isTypeSupported('video/mp4; codecs="avc1.42E01E,mp4a.40.2"') ||
    mediaSource.isTypeSupported('video/mp4; codecs="avc1.4d401f,mp4a.40.2"') ||
    mediaSource.isTypeSupported('video/mp4')
  );
}
import { Info, X } from 'lucide-react';
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
  /** Callback disparado quando o vídeo começa a tocar */
  onPlay?: () => void;
  /** Callback disparado quando a reprodução está em andamento */
  onPlaying?: () => void;
  /** Callback disparado quando uma busca na timeline inicia */
  onSeeking?: () => void;
  /** Callback disparado quando uma busca na timeline conclui */
  onSeeked?: () => void;
  /** Callback disparado quando o player entra em buffering */
  onWaiting?: () => void;
  /** Callback periódico de tempo e duração para persistência do progresso */
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  /** Callback disparado na pausa para salvar o progresso imediatamente */
  onPause?: (currentTime: number, duration: number) => void;
  /** Callback disparado quando a retomada do tempo inicial é confirmada */
  onRestored?: (currentTime: number) => void;
  /** Callback ao finalizar reprodução */
  onEnded?: () => void;
  /** Callback em erro de reprodução */
  onError?: (error: Error | string) => void;
  /** Próximo episódio (mantido para compatibilidade de props) */
  onNextEpisode?: () => void;
  /** Episódio anterior (mantido para compatibilidade de props) */
  hasPrevEpisode?: boolean;
  /** Se há próximo episódio */
  hasNextEpisode?: boolean;
  /** Classe CSS customizada para o contêiner */
  className?: string;
}

/**
 * Reprodutor oficial do Hikari migrado para a arquitetura nativa do Video.js 10.1.0.
 * Utiliza o VideoPlayer e VideoSkin oficiais do Video.js 10 com tema roxo característico,
 * suporte unificado e explícito a HLS via hls.js (com fallback Safari nativo),
 * persistência de progresso e eventos padronizados sem temporizadores ou controles concorrentes.
 */
export const CustomVideoPlayer: React.FC<CustomVideoPlayerProps> = ({
  video,
  onClose,
  autoPlay = true,
  onUpdateMetadata,
  initialTime = 0,
  onPlay,
  onPlaying,
  onSeeking,
  onSeeked,
  onWaiting,
  onTimeUpdate,
  onPause,
  onRestored,
  onEnded,
  onError,
  className,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const initialTimeAppliedRef = useRef<boolean>(false);

  const [videoError, setVideoError] = useState<string | null>(null);

  // Armazena callbacks em refs para evitar desmontagens ou re-execuções desnecessárias do player
  const onTimeUpdateRef = useRef(onTimeUpdate);
  onTimeUpdateRef.current = onTimeUpdate;
  const onPauseRef = useRef(onPause);
  onPauseRef.current = onPause;
  const onRestoredRef = useRef(onRestored);
  onRestoredRef.current = onRestored;
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const onUpdateMetadataRef = useRef(onUpdateMetadata);
  onUpdateMetadataRef.current = onUpdateMetadata;
  const initialTimeRef = useRef(initialTime);
  initialTimeRef.current = initialTime;

  // Resolução da URL efetiva do vídeo
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

  // Determina síncronamente se a URL é HLS para evitar oscilações de src no DOM
  const isHls = useMemo(() => isHlsUrl(effectiveVideoUrl), [effectiveVideoUrl, isHlsUrl]);

  // Determina síncronamente se o navegador suporta MediaSource para HLS
  const hasMseSupport = useMemo(() => isMediaSourceSupported(), []);

  // Aplicação segura do tempo inicial (retomada de progresso) somente quando o elemento de mídia está pronto
  const applyInitialTime = useCallback(() => {
    const el = videoRef.current;
    if (!el || initialTimeAppliedRef.current) return;
    const target = initialTimeRef.current;
    if (!target || target <= 0) {
      initialTimeAppliedRef.current = true;
      return;
    }

    // Só aplica quando a mídia tiver metadados carregados e estiver apta a receber posição de reprodução
    if (el.readyState >= 1) {
      try {
        const dur = el.duration;
        const targetTime =
          dur && Number.isFinite(dur) && dur > 0
            ? Math.min(target, Math.max(0, dur - 2))
            : target;

        el.currentTime = targetTime;
        initialTimeAppliedRef.current = true;
        onRestoredRef.current?.(targetTime);
      } catch {
        // Tenta novamente quando canplay disparar
      }
    }
  }, []);

  // Função resiliente de autoplay com fallback para modo silenciado se o navegador restringir áudio inicial
  const playSafely = useCallback((videoEl: HTMLVideoElement) => {
    if (!autoPlay) return;
    const promise = videoEl.play();
    if (promise !== undefined) {
      promise.catch((err) => {
        // Se a reprodução com áudio foi restrita pelo navegador na navegação inicial, inicia silenciado
        if (err?.name === 'NotAllowedError' || err?.name === 'AbortError') {
          videoEl.muted = true;
          videoEl.play().catch((mutedErr) => {
            console.warn('Reprodução automática restrita pelo navegador:', mutedErr);
          });
        } else {
          console.warn('Reprodução automática restrita:', err);
        }
      });
    }
  }, [autoPlay]);

  // Estratégia de reprodução explícita: hls.js sob demanda para HLS, direto para MP4/WebM
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl || !effectiveVideoUrl) return;

    let isCancelled = false;

    // Destrói instância HLS anterior se existente
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    initialTimeAppliedRef.current = false;
    setVideoError(null);

    if (isHls && hasMseSupport) {
      import('hls.js')
        .then(({ default: HlsClass }) => {
          if (isCancelled) return;

          if (!HlsClass.isSupported()) {
            if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
              videoEl.src = effectiveVideoUrl;
              playSafely(videoEl);
            }
            return;
          }

          if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
          }

          const hls = new HlsClass({
            enableWorker: true,
            lowLatencyMode: false,
            backBufferLength: 60,
            capLevelToPlayerSize: false,
            ...(initialTimeRef.current && initialTimeRef.current > 0
              ? { startPosition: initialTimeRef.current }
              : {}),
          });
          hlsRef.current = hls;
          hls.loadSource(effectiveVideoUrl);
          hls.attachMedia(videoEl);

          hls.on(HlsClass.Events.MANIFEST_PARSED, () => {
            if (isCancelled) return;
            applyInitialTime();
            playSafely(videoEl);
          });

          hls.on(HlsClass.Events.ERROR, (_event, data) => {
            if (isCancelled) return;
            if (data.fatal) {
              switch (data.type) {
                case HlsClass.ErrorTypes.NETWORK_ERROR:
                  hls.startLoad();
                  break;
                case HlsClass.ErrorTypes.MEDIA_ERROR:
                  hls.recoverMediaError();
                  break;
                default: {
                  hls.destroy();
                  hlsRef.current = null;
                  const msg = 'Não foi possível carregar a transmissão HLS.';
                  setVideoError(msg);
                  onErrorRef.current?.(msg);
                  break;
                }
              }
            }
          });
        })
        .catch((err) => {
          if (isCancelled) return;
          console.error('Erro ao carregar hls.js sob demanda:', err);
          if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
            videoEl.src = effectiveVideoUrl;
            playSafely(videoEl);
          } else {
            const msg = 'Não foi possível carregar a transmissão HLS.';
            setVideoError(msg);
            onErrorRef.current?.(msg);
          }
        });
    } else if (isHls && videoEl.canPlayType('application/vnd.apple.mpegurl')) {
      // Suporte nativo ao HLS (ex: Safari iOS / macOS sem MSE)
      videoEl.src = effectiveVideoUrl;
      playSafely(videoEl);
    } else {
      // Vídeo direto (MP4, WebM, etc.)
      if (videoEl.src !== effectiveVideoUrl) {
        videoEl.src = effectiveVideoUrl;
      }
      if (videoEl.readyState >= 2) {
        applyInitialTime();
        playSafely(videoEl);
      } else {
        const handleCanPlayOnce = () => {
          videoEl.removeEventListener('canplay', handleCanPlayOnce);
          applyInitialTime();
          playSafely(videoEl);
        };
        videoEl.addEventListener('canplay', handleCanPlayOnce);
      }
    }

    return () => {
      isCancelled = true;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (videoEl) {
        try {
          videoEl.pause();
          videoEl.removeAttribute('src');
          videoEl.load();
        } catch {
          // Ignora limpeza de mídia ao desmontar
        }
      }
    };
  }, [effectiveVideoUrl, isHls, hasMseSupport, autoPlay, playSafely, applyInitialTime]);

  // Manipulador de carregamento de metadados
  const handleLoadedMetadata = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;

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
  }, [applyInitialTime, onUpdateMetadata, video?.id]);

  // Confirmação adicional de prontidão para reprodução
  const handleCanPlay = useCallback(() => {
    applyInitialTime();
  }, [applyInitialTime]);

  // Atualização periódica de tempo para persistência do progresso
  const handleTimeUpdate = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    const time = el.currentTime;
    const dur = el.duration || video?.duration || 0;

    // Se temos tempo inicial pendente para aplicar e o elemento já tem metadados, tenta aplicar
    if (initialTime && initialTime > 0 && !initialTimeAppliedRef.current) {
      if (el.readyState >= 1) {
        applyInitialTime();
      }
      // Evita disparar timeupdate inicial próximo a 0 que possa sobrescrever o tempo salvo
      if (time < 1) {
        return;
      }
    }

    onTimeUpdate?.(time, dur);
  }, [onTimeUpdate, video?.duration, initialTime, applyInitialTime]);

  const handlePlay = useCallback(() => {
    onPlay?.();
  }, [onPlay]);

  const handlePlaying = useCallback(() => {
    onPlaying?.();
  }, [onPlaying]);

  const handleSeeking = useCallback(() => {
    onSeeking?.();
  }, [onSeeking]);

  const handleSeeked = useCallback(() => {
    onSeeked?.();
  }, [onSeeked]);

  const handleWaiting = useCallback(() => {
    onWaiting?.();
  }, [onWaiting]);

  // Manipulador de pausa para salvamento imediato do progresso
  const handlePause = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    const time = el.currentTime;
    const dur = el.duration || video?.duration || 0;
    onPause?.(time, dur);
  }, [onPause, video?.duration]);

  // Fim de reprodução do vídeo (avanço automático de episódio)
  const handleEnded = useCallback(() => {
    onEnded?.();
  }, [onEnded]);

  // Tratamento de erro nativo do elemento de mídia
  const handleMediaError = useCallback(() => {
    const message = video?.isLocalFile
      ? 'O navegador não conseguiu decodificar o arquivo local.'
      : 'Não foi possível reproduzir este vídeo no momento.';
    setVideoError(message);
    onErrorRef.current?.(message);
  }, [video?.isLocalFile]);

  return (
    <VideoPlayer
      title={null}
      poster={effectivePosterUrl || null}
    >
      <div
        className={`relative isolate w-full aspect-video min-h-[240px] md:min-h-[520px] bg-black flex items-center justify-center select-none overflow-hidden rounded-2xl group ${className || ''}`}
      >
        {/* Skin oficial nativa do Video.js 10 com tema roxo Hikari */}
        <VideoSkin
          className="hikari-video-player w-full h-full"
          style={{
            '--media-accent-color': '#a855f7',
            '--media-accent-text-color': '#ffffff',
            '--media-border-radius': '1rem',
            '--media-border-color': 'rgba(255, 255, 255, 0.1)',
          } as React.CSSProperties}
        >
          <Video
            ref={videoRef}
            src={isHls && hasMseSupport ? undefined : effectiveVideoUrl}
            poster={effectivePosterUrl}
            playsInline
            autoPlay={autoPlay}
            onPlay={handlePlay}
            onPlaying={handlePlaying}
            onSeeking={handleSeeking}
            onSeeked={handleSeeked}
            onWaiting={handleWaiting}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onCanPlay={handleCanPlay}
            onPause={handlePause}
            onEnded={handleEnded}
            onError={handleMediaError}
            className="w-full h-full object-contain"
          />

          {/* Botão voltar/fechar opcional no canto superior para uso em modal */}
          {onClose && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              aria-label="Voltar para a biblioteca"
              className="hikari-player-close-btn absolute top-3 sm:top-5 left-3 sm:left-5 z-30 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-900/80 hover:bg-slate-800 active:scale-95 text-slate-200 hover:text-white flex items-center justify-center transition-all border border-slate-700/60 shadow-lg backdrop-blur-sm cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          {/* Fallback de erro amigável se a reprodução falhar */}
          {videoError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0B0C10]/95 p-6 text-center z-40">
              <div className="w-12 h-12 rounded-full bg-purple-950/80 border border-purple-700/50 flex items-center justify-center text-purple-400 mb-4">
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
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  Voltar para a Biblioteca
                </button>
              )}
            </div>
          )}
        </VideoSkin>
      </div>
    </VideoPlayer>
  );
};

export default CustomVideoPlayer;
