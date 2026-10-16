import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type CSSProperties,
  type ComponentPropsWithoutRef,
  type ReactEventHandler,
  type TouchEventHandler,
} from "react";
import Hls from "hls.js";

export type HikariPlayerProps = {
  src?: string | null;
  className?: string;
  style?: CSSProperties;
  onPlay?: ReactEventHandler<HTMLVideoElement>;
  onPause?: ReactEventHandler<HTMLVideoElement>;
  onLoadedMetadata?: ReactEventHandler<HTMLVideoElement>;
  onTimeUpdate?: ReactEventHandler<HTMLVideoElement>;
  onDurationChange?: ReactEventHandler<HTMLVideoElement>;
  onTouchEnd?: TouchEventHandler<HTMLVideoElement>;
  onError?: (error: Error | string) => void;
  autoPlay?: boolean;
  preload?: ComponentPropsWithoutRef<"video">["preload"];
  playsInline?: boolean;
  disablePictureInPicture?: boolean;
  controlsList?: string;
  "data-player-video"?: string | boolean;
};

import { isHlsSource } from "@/lib/utils";

export const HikariPlayer = forwardRef<HTMLVideoElement, HikariPlayerProps>(
  function HikariPlayer(
    {
      src,
      className,
      style,
      onPlay,
      onPause,
      onLoadedMetadata,
      onTimeUpdate,
      onDurationChange,
      onTouchEnd,
      onError,
      autoPlay = false,
      preload = "metadata",
      playsInline = true,
      disablePictureInPicture = true,
      controlsList = "nodownload noremoteplayback",
      "data-player-video": dataPlayerVideo = "true",
      ...rest
    },
    ref,
  ) {
    const internalVideoRef = useRef<HTMLVideoElement | null>(null);

    useImperativeHandle<HTMLVideoElement | null, HTMLVideoElement | null>(
      ref,
      () => internalVideoRef.current,
    );

    useEffect(() => {
      const video = internalVideoRef.current;
      if (!video || !src) return;

      let hlsInstance: Hls | null = null;
      const isHls = isHlsSource(src);

      if (isHls) {
        // 1. Suporte HLS nativo no Safari/iOS
        if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = src;
        } else if (typeof window !== "undefined" && Hls.isSupported()) {
          // 2. Navegadores com suporte a MediaSource (Chrome, Firefox, Android, etc.)
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: false,
            backBufferLength: 90,
          });
          hlsInstance = hls;

          hls.attachMedia(video);

          hls.on(Hls.Events.MEDIA_ATTACHED, () => {
            hls.loadSource(src);
          });

          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (data.fatal) {
              switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                  console.warn("[HikariPlayer] Erro fatal de rede no HLS. Tentando recuperar...", data);
                  hls.startLoad();
                  break;
                case Hls.ErrorTypes.MEDIA_ERROR:
                  console.warn("[HikariPlayer] Erro fatal de mídia no HLS. Tentando recuperar...", data);
                  hls.recoverMediaError();
                  break;
                default:
                  console.error("[HikariPlayer] Erro fatal não recuperável no HLS:", data);
                  hls.destroy();
                  onError?.(new Error(`Falha no stream HLS: ${data.details}`));
                  break;
              }
            }
          });
        } else {
          // Fallback caso Hls.js não seja suportado
          video.src = src;
        }
      } else {
        // Arquivo direto tradicional (MP4, WebM, QuickTime, etc.)
        video.src = src;
      }

      return () => {
        if (hlsInstance) {
          hlsInstance.destroy();
          hlsInstance = null;
        }
        video.removeAttribute("src");
        video.load();
      };
    }, [src, onError]);

    return (
      <video
        ref={internalVideoRef}
        preload={preload}
        autoPlay={autoPlay}
        playsInline={playsInline}
        disablePictureInPicture={disablePictureInPicture}
        controlsList={controlsList}
        onContextMenu={(event) => event.preventDefault()}
        onTouchEnd={onTouchEnd}
        style={style}
        className={className}
        data-player-video={dataPlayerVideo}
        onPlay={onPlay}
        onPause={onPause}
        onLoadedMetadata={onLoadedMetadata}
        onTimeUpdate={onTimeUpdate}
        onDurationChange={onDurationChange}
        {...rest}
      />
    );
  },
);
