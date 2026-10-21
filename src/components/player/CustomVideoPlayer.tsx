import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import Hls from 'hls.js';
import videojs from 'video.js';
import { VideoPlayer, Video, VideoSkin } from '@videojs/react/video';
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
  /** Callback periódico de tempo e duração para persistência do progresso */
  onTimeUpdate?: (currentTime: number, duration: number) => void;
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
  onTimeUpdate,
  onEnded,
  onError,
  className,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const initialTimeAppliedRef = useRef<boolean>(false);

  const [videoError, setVideoError] = useState<string | null>(null);
  const [isHlsActive, setIsHlsActive] = useState<boolean>(false);

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

  // Aplicação segura do tempo inicial (retomada de progresso)
  const applyInitialTime = useCallback(() => {
    const el = videoRef.current;
    if (!el || initialTimeAppliedRef.current) return;
    if (initialTime && initialTime > 0) {
      try {
        el.currentTime = initialTime;
        initialTimeAppliedRef.current = true;
      } catch {
        // Tenta novamente quando loadedmetadata disparar
      }
    }
  }, [initialTime]);

  // Estratégia de reprodução explícita: hls.js único para HLS, direto para MP4/WebM
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl || !effectiveVideoUrl) return;

    // Destrói instância HLS anterior se existente
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
            console.warn('Reprodução automática restrita pelo navegador:', err);
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
              hlsRef.current = null;
              const msg = 'Não foi possível carregar a transmissão HLS.';
              setVideoError(msg);
              onError?.(msg);
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
      // Suporte nativo ao HLS (ex: Safari iOS / macOS)
      videoEl.src = effectiveVideoUrl;
      setIsHlsActive(true);
      applyInitialTime();
      if (autoPlay) {
        videoEl.play().catch(() => {});
      }
    } else {
      // Vídeo direto (MP4, WebM, etc.)
      videoEl.src = effectiveVideoUrl;
      setIsHlsActive(false);
      applyInitialTime();
      if (autoPlay) {
        videoEl.play().catch((err) => {
          console.warn('Reprodução automática restrita pelo navegador:', err);
        });
      }
    }

    return () => {
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
  }, [effectiveVideoUrl, autoPlay, isHlsUrl, applyInitialTime, onError]);

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

  // Atualização periódica de tempo para persistência do progresso
  const handleTimeUpdate = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    const time = el.currentTime;
    const dur = el.duration || video?.duration || 0;
    onTimeUpdate?.(time, dur);
  }, [onTimeUpdate, video?.duration]);

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
    onError?.(message);
  }, [video?.isLocalFile, onError]);

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
            src={isHlsActive && Hls.isSupported() ? undefined : effectiveVideoUrl}
            poster={effectivePosterUrl}
            playsInline
            autoPlay={autoPlay}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
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

export { videojs };
export default CustomVideoPlayer;
