import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import Hls from 'hls.js';
import { Info } from 'lucide-react';
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
  video: VideoItem;
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
  const initialTimeAppliedRef = useRef<boolean>(false);
  const hlsRef = useRef<Hls | null>(null);

  // Obter URL de vídeo real para arquivos locais da sessão ou fonte remota
  const effectiveVideoUrl = useMemo(() => {
    if (!video) return '';
    if (video.isLocalFile) {
      return getLocalVideoUrl(video.id) || video.videoUrl || video.url || '';
    }
    return video.videoUrl || video.url || '';
  }, [video]);

  const effectivePosterUrl = video.posterUrl || video.thumbnailUrl || '';

  // Estados essenciais para decodificação e tratamento de erro
  const [isHlsActive, setIsHlsActive] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);

  // Reiniciar proteção de initialTime e limpar erros ao alternar de episódio ou fonte
  useEffect(() => {
    initialTimeAppliedRef.current = false;
    setVideoError(null);
  }, [video.id, effectiveVideoUrl]);

  const isHlsUrl = useCallback((url: string): boolean => {
    if (!url) return false;
    const cleanUrl = url.split('?')[0].toLowerCase();
    return cleanUrl.endsWith('.m3u8') || url.includes('.m3u8') || url.includes('/hls/');
  }, []);

  // Inicialização do pipeline de decodificação: Hls.js adaptativo autônomo ou HTML5 Direto
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl || !effectiveVideoUrl) return;

    // Destrói instância Hls anterior se houver
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const isHls = isHlsUrl(effectiveVideoUrl);
    setIsHlsActive(isHls);
    setVideoError(null);

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
        // Aplicação de initialTime para stream HLS caso ainda não tenha sido aplicado
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
            console.warn('Auto-play HLS restrito pelo navegador:', err);
          });
        }
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        console.warn('HLS Event:', data.type, data.details);
        if (
          data.details === Hls.ErrorDetails.LEVEL_LOAD_ERROR ||
          data.details === Hls.ErrorDetails.LEVEL_LOAD_TIMEOUT
        ) {
          console.warn('Falha no carregamento do nível HLS selecionado:', data.details);
          if (hls.currentLevel !== -1) {
            hls.currentLevel = -1;
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
      // Safari / iOS suporte nativo a HLS
      videoEl.src = effectiveVideoUrl;
      setIsHlsActive(true);
      if (autoPlay) {
        videoEl.play().catch(() => {});
      }
    } else {
      // Fonte direta MP4, WebM ou Blob local
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

  // Atualização periódica de tempo e duração para persistência no Hikari
  const handleTimeUpdate = () => {
    const el = videoRef.current;
    if (!el) return;
    onTimeUpdate?.(el.currentTime, el.duration || 0);
  };

  const handleLoadedMetadata = () => {
    const el = videoRef.current;
    if (!el) return;
    setVideoError(null);
    const rawDur = el.duration;
    const rawHeight = el.videoHeight;

    // Aplicação única e segura de initialTime na prontidão da mídia
    if (!initialTimeAppliedRef.current && initialTime && initialTime > 0) {
      try {
        el.currentTime = initialTime;
      } catch {
        // no-op
      }
      initialTimeAppliedRef.current = true;
    }

    // Sincronização de metadados reais confirmados pelo decodificador
    if (onUpdateMetadata) {
      const hasValidDuration =
        typeof rawDur === 'number' && !isNaN(rawDur) && rawDur > 0 && isFinite(rawDur);
      const detected = classifyVideoResolution(rawHeight);
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

  return (
    <div
      className={`relative w-full h-full min-h-[340px] md:min-h-[520px] bg-black flex items-center justify-center overflow-hidden rounded-2xl ${className || ''}`}
    >
      {/* Elemento de Vídeo HTML5 com Controles Nativos do Navegador */}
      <video
        ref={videoRef}
        controls
        src={isHlsActive && Hls.isSupported() ? undefined : effectiveVideoUrl}
        poster={effectivePosterUrl}
        playsInline
        autoPlay={autoPlay}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onCanPlay={handleCanPlay}
        onEnded={onEnded}
        onError={() => {
          if (video.isLocalFile) {
            const msg =
              'O navegador não conseguiu decodificar o arquivo de vídeo selecionado. Verifique se o formato (MP4, WebM) e codec (H.264/AAC) são suportados nativamente pelo seu navegador.';
            setVideoError(msg);
            onError?.(msg);
          } else {
            const msg =
              'Não foi possível reproduzir este vídeo. Tente alternar para outro Player.';
            setVideoError(msg);
            onError?.(msg);
          }
        }}
        className="w-full h-full object-contain max-h-screen"
      >
        {video.subtitles?.map((sub) => (
          <track
            key={sub.id}
            kind="subtitles"
            src={sub.src || ''}
            srcLang={sub.lang}
            label={sub.label}
          />
        ))}
      </video>

      {/* Fallback amigável caso a fonte falhe */}
      {videoError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0B0C10]/95 p-6 text-center z-20">
          <div className="w-12 h-12 rounded-full bg-indigo-950/80 border border-indigo-700/50 flex items-center justify-center text-indigo-400 mb-4">
            <Info className="w-6 h-6" />
          </div>
          <h4 className="text-base font-semibold text-white mb-1">
            {video.isLocalFile
              ? 'Erro na Decodificação do Vídeo Local'
              : 'Não foi possível reproduzir este vídeo. Tente alternar para outro Player.'}
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
    </div>
  );
};

export default CustomVideoPlayer;
