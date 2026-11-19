import React, { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize, RefreshCcw } from "lucide-react";
import { isAnitube22PlayerUrl } from "@/lib/anitube22";

export interface PlayerProps {
  src: string | null;
  iframeSrc: string;
  poster?: string;
  title: string;
  onProgress?: (currentTime: number, duration: number) => void;
}

export function Player({
  src,
  iframeSrc,
  poster,
  title,
  onProgress,
}: PlayerProps) {
  const [mode, setMode] = useState<"native" | "iframe">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("hikari_player_mode");
      if (saved === "native" || saved === "iframe") {
        return saved;
      }
    }
    return src ? "native" : "iframe";
  });

  const [hasError, setHasError] = useState(false);
  const [iframeError, setIframeError] = useState(false);
  const [iframeReloadCount, setIframeReloadCount] = useState(0);
  const [iframeReloadTs, setIframeReloadTs] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hlsRef = useRef<any>(null);
  const lastProgressSaveRef = useRef(0);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fallback automático se src for nulo ou se houver erro
  const effectiveMode = src && !hasError && mode === "native" ? "native" : "iframe";

  // Salvar preferência de modo
  const toggleMode = () => {
    const next = mode === "native" ? "iframe" : "native";
    setMode(next);
    setHasError(false);
    if (typeof window !== "undefined") {
      localStorage.setItem("hikari_player_mode", next);
    }
  };

  // Inicialização do hls.js ou nativo HLS
  useEffect(() => {
    if (effectiveMode !== "native" || !src) return;

    let isDestroyed = false;
    const video = videoRef.current;
    if (!video) return;

    async function initHls() {
      try {
        const videoEl = videoRef.current;
        if (!videoEl || !src) return;

        const HlsModule = await import("hls.js");
        const Hls = HlsModule.default;

        if (Hls.isSupported()) {
          const hls = new Hls({
            xhrSetup: (xhr) => {
              xhr.withCredentials = false;
            },
          });
          hlsRef.current = hls;
          hls.loadSource(src);
          hls.attachMedia(videoEl);

          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (data.fatal && !isDestroyed) {
              console.warn("[Hikari Player] HLS fatal error, falling back to iframe:", data);
              hls.destroy();
              hlsRef.current = null;
              setHasError(true);
            }
          });
        } else if (videoEl.canPlayType("application/vnd.apple.mpegurl")) {
          videoEl.src = src;
        } else {
          setHasError(true);
        }
      } catch (err) {
        console.warn("[Hikari Player] Falha ao carregar hls.js:", err);
        setHasError(true);
      }
    }

    initHls();

    return () => {
      isDestroyed = true;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [effectiveMode, src]);

  // Manipuladores de progresso e eventos do video (sem envio direto em timeupdate)
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    const cur = video.currentTime;
    const dur = video.duration || 0;
    setCurrentTime(cur);
    setDuration(dur);
    void lastProgressSaveRef;
    void onProgress;
  };

  const handleVideoError = () => {
    console.warn("[Hikari Player] HTML5 video error, falling back to iframe");
    setHasError(true);
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;
    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return "00:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div
      ref={containerRef}
      className="hikari-video-player group relative w-full h-full bg-black overflow-hidden rounded-2xl isolation-auto"
      onMouseMove={() => {
        setShowControls(true);
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3500);
      }}
      onMouseLeave={() => setShowControls(false)}
    >
      <style>{`
        .hikari-video-player {
          position: relative;
          overflow: hidden;
          width: 100%;
          height: 100%;
          border-radius: 1rem;
          background: #000;
          isolation: isolate;
        }
        .hikari-video-player video {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: contain;
          background: #000;
          filter: none !important;
          transition: none !important;
          transform: translateZ(0);
          border: none;
          outline: none;
        }
        .hikari-video-player iframe {
          display: block;
          width: 100%;
          height: 100%;
          border: 0;
        }
      `}</style>

      {effectiveMode === "native" ? (
        <>
          <video
            ref={videoRef}
            poster={poster}
            playsInline
            crossOrigin="anonymous"
            preload="metadata"
            onTimeUpdate={handleTimeUpdate}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onError={handleVideoError}
            onClick={togglePlay}
          />

          {/* Camada superior de gradiente */}
          <div
            className={`absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/70 to-transparent transition-opacity duration-300 z-10 flex items-center justify-between ${
              showControls ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
          >
            <h2 className="text-white text-sm font-medium truncate max-w-[70%] drop-shadow">
              {title}
            </h2>
            <button
              onClick={toggleMode}
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium backdrop-blur transition flex items-center gap-1.5"
            >
              <RefreshCcw className="w-3.5 h-3.5" />
              Usar Iframe
            </button>
          </div>

          {/* Barra inferior de controles */}
          <div
            className={`absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/85 via-black/45 to-transparent transition-opacity duration-300 z-10 flex flex-col gap-2 ${
              showControls ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
          >
            {/* Barra de progresso */}
            <div
              className="w-full h-1.5 bg-white/20 rounded-full cursor-pointer relative group/bar"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const pos = (e.clientX - rect.left) / rect.width;
                if (videoRef.current && duration) {
                  videoRef.current.currentTime = pos * duration;
                }
              }}
            >
              <div
                className="absolute top-0 left-0 bottom-0 bg-primary rounded-full relative"
                style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow opacity-0 group-hover/bar/opacity-100 transition" />
              </div>
            </div>

            <div className="flex items-center justify-between text-white">
              <div className="flex items-center gap-3">
                <button
                  onClick={togglePlay}
                  className="p-2 rounded-full hover:bg-white/20 transition"
                  aria-label={isPlaying ? "Pausar" : "Reproduzir"}
                >
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-white" />}
                </button>

                <button
                  onClick={toggleMute}
                  className="p-2 rounded-full hover:bg-white/20 transition"
                  aria-label={isMuted ? "Ativar som" : "Silenciar"}
                >
                  {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </button>

                <span className="text-xs font-mono text-zinc-300">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={toggleFullscreen}
                  className="p-2 rounded-full hover:bg-white/20 transition"
                  aria-label="Tela cheia"
                >
                  <Maximize className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          {(() => {
            const activeIframeSrc =
              iframeReloadTs && isAnitube22PlayerUrl(iframeSrc)
                ? iframeSrc.replace(/([?&])time=\d+/i, `$1time=${iframeReloadTs}`)
                : iframeSrc;
            return (
              <iframe
                key={`${activeIframeSrc}-${iframeReloadCount}`}
                src={activeIframeSrc}
                title={title}
                referrerPolicy="no-referrer-when-downgrade"
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
                onLoad={() => setIframeError(false)}
                onError={() => setIframeError(true)}
              />
            );
          })()}

          {iframeError && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/85 p-6 text-center">
              <p className="text-sm font-medium text-white">
                Falha ao carregar o player da fonte.
              </p>
              <button
                type="button"
                onClick={() => {
                  setIframeError(false);
                  setIframeReloadTs(Math.floor(Date.now() / 1000));
                  setIframeReloadCount((c) => c + 1);
                }}
                className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-lg cursor-pointer"
              >
                <RefreshCcw className="w-3.5 h-3.5" />
                Recarregar fonte
              </button>
            </div>
          )}

          <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setIframeError(false);
                setIframeReloadTs(Math.floor(Date.now() / 1000));
                setIframeReloadCount((c) => c + 1);
              }}
              className="px-3 py-1.5 rounded-lg bg-black/70 hover:bg-black/90 text-white text-xs font-medium backdrop-blur transition border border-white/15 flex items-center gap-1.5 shadow-lg cursor-pointer"
            >
              <RefreshCcw className="w-3.5 h-3.5" />
              Recarregar fonte
            </button>
            {src && (
              <button
                type="button"
                onClick={toggleMode}
                className="px-3 py-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white text-xs font-medium backdrop-blur transition border border-white/10 flex items-center gap-1.5 shadow-lg cursor-pointer"
              >
                <RefreshCcw className="w-3.5 h-3.5" />
                Usar Player Próprio
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
