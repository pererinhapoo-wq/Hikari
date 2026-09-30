import {
  Maximize,
  Pause,
  Play,
  Settings,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type TouchEvent,
} from "react";

type HikariPlayerProps = {
  file: string;
};

export function HikariPlayer({
  file,
}: HikariPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastTapRef = useRef<{
    time: number;
    side: "left" | "right";
  } | null>(null);
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controlsHideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  const clearControlsHideTimer = () => {
    if (controlsHideTimeoutRef.current) {
      clearTimeout(controlsHideTimeoutRef.current);
      controlsHideTimeoutRef.current = null;
    }
  };

  const showControls = () => {
    clearControlsHideTimer();
    setControlsVisible(true);

    if (isPlaying) {
      controlsHideTimeoutRef.current = setTimeout(() => {
        setControlsVisible(false);
        controlsHideTimeoutRef.current = null;
      }, 5000);
    }
  };

  const hideControls = () => {
    clearControlsHideTimer();
    setControlsVisible(false);
  };

  useEffect(() => {
    clearControlsHideTimer();

    if (isPlaying) {
      controlsHideTimeoutRef.current = setTimeout(() => {
        setControlsVisible(false);
        controlsHideTimeoutRef.current = null;
      }, 5000);
    } else {
      setControlsVisible(true);
    }

    return clearControlsHideTimer;
  }, [isPlaying]);

  const formatTime = (seconds: number) => {
    if (!Number.isFinite(seconds) || seconds < 0) return "00:00";

    const total = Math.floor(seconds);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }

    return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const seekBy = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;

    const nextTime = Math.min(
      Math.max(video.currentTime + seconds, 0),
      Number.isFinite(video.duration) ? video.duration : video.currentTime + seconds,
    );

    video.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const togglePlay = async () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      try {
        await video.play();
      } catch {
        // O navegador pode bloquear autoplay/interação programática.
      }
    } else {
      video.pause();
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.muted || video.volume === 0) {
      const restored = volume > 0 ? volume : 1;
      video.muted = false;
      video.volume = restored;
      setVolume(restored);
      setIsMuted(false);
    } else {
      video.muted = true;
      setIsMuted(true);
    }
  };

  const handlePlayerTap = (event: TouchEvent<HTMLVideoElement>) => {
    const now = Date.now();
    const rect = event.currentTarget.getBoundingClientRect();
    const touch = event.changedTouches[0];
    if (!touch) return;

    const side =
      touch.clientX - rect.left < rect.width / 2
        ? "left"
        : "right";
    const previous = lastTapRef.current;

    if (
      previous &&
      previous.side === side &&
      now - previous.time < 320
    ) {
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
        tapTimeoutRef.current = null;
      }

      seekBy(side === "left" ? -10 : 10);
      showControls();
      lastTapRef.current = null;
      return;
    }

    lastTapRef.current = { time: now, side };

    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current);
    }

    tapTimeoutRef.current = setTimeout(() => {
      if (controlsVisible) {
        hideControls();
      } else {
        showControls();
      }
      lastTapRef.current = null;
      tapTimeoutRef.current = null;
    }, 220);
  };

  const lockLandscape = async () => {
    try {
      if (
        typeof screen !== "undefined" &&
        screen.orientation &&
        typeof screen.orientation.lock === "function"
      ) {
        await screen.orientation.lock("landscape");
      }
    } catch {
      // Alguns navegadores móveis não permitem travar a orientação.
    }
  };

  const unlockOrientation = async () => {
    try {
      if (
        typeof screen !== "undefined" &&
        screen.orientation &&
        typeof screen.orientation.unlock === "function"
      ) {
        screen.orientation.unlock();
      }
    } catch {
      // Alguns navegadores não permitem liberar a orientação por script.
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (document.fullscreenElement) {
        void lockLandscape();
      } else {
        void unlockOrientation();
      }
    };

    document.addEventListener(
      "fullscreenchange",
      handleFullscreenChange,
    );

    return () => {
      document.removeEventListener(
        "fullscreenchange",
        handleFullscreenChange,
      );
      void unlockOrientation();
    };
  }, []);

  const handleFullscreen = async () => {
    const video = videoRef.current;
    const player = video?.parentElement;
    if (!player) return;

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        await unlockOrientation();
      } else {
        await player.requestFullscreen();
        await lockLandscape();
      }
    } catch {
      // Alguns navegadores móveis não permitem fullscreen/orientação.
    }
  };

  const changePlaybackRate = (rate: number) => {
    const video = videoRef.current;
    setPlaybackRate(rate);
    if (video) video.playbackRate = rate;
  };

  return (
    <>
      <style>{`
        @media (hover: none) and (pointer: coarse) {
          /* MOBILE ONLY — visual integrado ao vídeo. Desktop permanece igual. */
          .hikari-player .hikari-mobile-controls {
            position: absolute !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            height: 56px !important;
            padding: 0 12px 4px !important;
            display: block !important;
            background: transparent !important;
            z-index: 10 !important;
          }

          .hikari-player .hikari-progress-shell {
            position: absolute !important;
            left: 12px !important;
            right: 12px !important;
            bottom: 0 !important;
            top: auto !important;
            width: auto !important;
            height: 3px !important;
            margin: 0 !important;
            padding: 0 !important;
            border: 0 !important;
            border-radius: 999px !important;
            background: transparent !important;
            box-shadow: none !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
          }

          .hikari-player .hikari-progress-track {
            position: absolute !important;
            left: 0 !important;
            right: 0 !important;
            top: 50% !important;
            height: 2px !important;
            transform: translateY(-50%) !important;
            background: rgba(255,255,255,.35) !important;
            border-radius: 999px !important;
          }

          .hikari-player .hikari-progress-track > div {
            height: 100% !important;
            background: rgba(255,255,255,.95) !important;
          }

          .hikari-player .hikari-progress-shell > div:nth-child(2) {
            width: 6px !important;
            height: 6px !important;
            background: #a855f7 !important;
            box-shadow: 0 0 6px rgba(168,85,247,.75) !important;
          }

          .hikari-player .hikari-mobile-time-row {
            position: absolute !important;
            left: 12px !important;
            right: 12px !important;
            bottom: 8px !important;
            top: auto !important;
            width: auto !important;
            height: 28px !important;
            margin: 0 !important;
            padding: 0 !important;
            display: flex !important;
            align-items: center !important;
            gap: 8px !important;
            border: 0 !important;
            border-radius: 0 !important;
            background: transparent !important;
            box-shadow: none !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
          }

          .hikari-player .hikari-mobile-time-row > div:first-child {
            font-size: 10px !important;
            line-height: 1 !important;
            text-shadow: 0 1px 4px rgba(0,0,0,.95) !important;
          }

          .hikari-player .hikari-mobile-time-row > div:last-child {
            gap: 2px !important;
          }

          .hikari-player .hikari-volume,
          .hikari-player .hikari-settings,
          .hikari-player .hikari-mobile-fullscreen {
            width: 30px !important;
            height: 30px !important;
            border: 0 !important;
            background: transparent !important;
            box-shadow: none !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
          }

          .hikari-player .hikari-volume svg,
          .hikari-player .hikari-settings svg,
          .hikari-player .hikari-mobile-fullscreen svg {
            width: 17px !important;
            height: 17px !important;
            filter: drop-shadow(0 1px 3px rgba(0,0,0,.95));
          }

          .hikari-player > video + div {
            top: 50% !important;
          }

          .hikari-player .hikari-skip {
            width: 38px !important;
            height: 38px !important;
            background: rgba(0,0,0,.28) !important;
            box-shadow: 0 5px 20px rgba(0,0,0,.3) !important;
          }
        }
      `}</style>
              <video
                key={file}
                ref={videoRef}
                src={file ?? undefined}
                preload="metadata"
                autoPlay={false}
                playsInline
                disablePictureInPicture
                controlsList="nodownload noremoteplayback"
                onContextMenu={(event) => event.preventDefault()}
                onPointerMove={(event) => {
                  if (event.pointerType !== "touch") {
                    showControls();
                  }
                }}
                onTouchEnd={handlePlayerTap}
                style={{
                  touchAction: "pan-x",
                }}
                className="relative z-0 size-full select-none bg-black object-contain"
                 data-player-video="true"
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onLoadedMetadata={(event) => {
                  setDuration(event.currentTarget.duration);
                  event.currentTarget.playbackRate = playbackRate;
                  event.currentTarget.volume = volume;
                  event.currentTarget.muted = isMuted;
                }}
                onTimeUpdate={(event) =>
                  setCurrentTime(event.currentTarget.currentTime)
                }
                onDurationChange={(event) =>
                  setDuration(event.currentTarget.duration)
                }
              />

              {controlsVisible && (
                <div className="pointer-events-none absolute inset-0 z-10 flex -translate-y-1/2 items-center justify-center sm:inset-x-0 sm:inset-y-auto sm:top-[40%]">
                  <div
                    onPointerDown={showControls}
                    className="pointer-events-auto flex items-center gap-2 sm:gap-3"
                  >
                    <button
                      type="button"
                      onClick={() => seekBy(-10)}
                      className="hikari-skip flex size-10 items-center justify-center rounded-full border-0 bg-black/35 text-[10px] font-semibold text-white/90 shadow-[0_8px_30px_rgba(0,0,0,0.35)] transition hover:border-white/30 hover:bg-white/15 active:scale-95 sm:size-11 sm:text-[11px]"
                      aria-label="Voltar 10 segundos"
                    >
                      -10s
                    </button>

                    <button
                      type="button"
                      onClick={togglePlay}
                      className="flex size-12 items-center justify-center rounded-full border border-white/30 bg-white/[0.14] text-white shadow-[0_10px_40px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.22)] transition hover:border-white/45 hover:bg-white/20 active:scale-95 sm:size-14"
                      aria-label={isPlaying ? "Pausar" : "Reproduzir"}
                    >
                      {isPlaying ? (
                        <Pause className="size-5 fill-current" />
                      ) : (
                        <Play className="ml-0.5 size-5 fill-current" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => seekBy(10)}
                      className="hikari-skip flex size-10 items-center justify-center rounded-full border-0 bg-black/35 text-[10px] font-semibold text-white/90 shadow-[0_8px_30px_rgba(0,0,0,0.35)] transition hover:border-white/30 hover:bg-white/15 active:scale-95 sm:size-11 sm:text-[11px]"
                      aria-label="Avançar 10 segundos"
                    >
                      +10s
                    </button>
                  </div>
                </div>
              )}

              {controlsVisible && (
                <div
                  onPointerDown={showControls}
                  className="hikari-mobile-controls absolute inset-x-0 bottom-0 z-10 px-2 pb-2 sm:px-5 sm:pb-4"
                >
                  <div className="hikari-progress-shell relative h-5 rounded-full border-0 bg-transparent px-2 shadow-none sm:h-7 sm:px-3">
                    <div className="hikari-progress-track pointer-events-none absolute inset-x-2 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-white/20 sm:inset-x-3 sm:h-1.5">
                      <div
                        className="h-full rounded-full bg-white/90"
                        style={{
                          width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                        }}
                      />
                    </div>

                    <div
                      className="pointer-events-none absolute top-1/2 size-1.5 -translate-y-1/2 -translate-x-1/2 rounded-full bg-[#a855f7] shadow-[0_0_8px_rgba(168,85,247,0.75)] sm:size-2"
                      style={{
                        left: `${duration > 0 ? Math.min(99.5, Math.max(0.5, (currentTime / duration) * 100)) : 0.5}%`,
                      }}
                    />

                    <input
                      aria-label="Progresso do episódio"
                      type="range"
                      min={0}
                      max={duration || 0}
                      step={0.1}
                      value={Math.min(currentTime, duration || 0)}
                      onChange={(event) => {
                        const nextTime = Number(event.target.value);
                        if (videoRef.current) videoRef.current.currentTime = nextTime;
                        setCurrentTime(nextTime);
                      }}
                      className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent opacity-0"
                    />
                  </div>

                  <div className="hikari-mobile-time-row mt-1 flex items-center gap-1.5 rounded-full border-0 bg-transparent px-2 py-1 shadow-none sm:gap-2 sm:px-3 sm:py-1.5">
                    <div className="flex shrink-0 items-center gap-1.5 text-[10px] font-medium tabular-nums tracking-wide text-white/90 sm:text-[11px]">
                      <span>{formatTime(currentTime)}</span>
                      <span className="text-white/35">/</span>
                      <span className="text-white/65">{formatTime(duration)}</span>
                    </div>

                    <div className="pointer-events-auto ml-auto flex items-center gap-1.5 sm:gap-2">
                      <button
                        type="button"
                        onClick={toggleMute}
                        className="hikari-volume flex size-8 items-center justify-center rounded-full border border-white/15 bg-white/[0.08] text-white/90 shadow-[0_8px_28px_rgba(0,0,0,0.35)] transition hover:bg-white/15 hover:border-white/25 active:scale-95 sm:size-9"
                        aria-label={isMuted ? "Ativar som" : "Silenciar"}
                      >
                        {isMuted ? (
                          <VolumeX className="size-3.5 sm:size-4" />
                        ) : (
                          <Volume2 className="size-3.5 sm:size-4" />
                        )}
                      </button>

                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setSettingsOpen((open) => !open)}
                          className={`hikari-settings flex size-9 items-center justify-center rounded-full border border-white/15 bg-white/[0.08] text-white/90 shadow-[0_8px_28px_rgba(0,0,0,0.35)] transition hover:bg-white/15 hover:border-white/25 active:scale-95 sm:size-10 ${
                            settingsOpen ? "bg-white/15" : ""
                          }`}
                          aria-label="Configurações do player"
                          aria-expanded={settingsOpen}
                        >
                          <Settings className="size-3.5 sm:size-4" />
                        </button>

                        {settingsOpen && (
                          <div className="absolute bottom-11 right-0 z-20 w-56 rounded-2xl border border-white/10 bg-[#111116]/95 p-2 text-sm shadow-2xl">
                            <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
                              Configurações
                            </div>

                            <div className="mt-1 rounded-xl px-3 py-2.5">
                              <div className="mb-2 text-white/75">Velocidade</div>
                              <div className="grid grid-cols-5 gap-1">
                                {[0.75, 1, 1.25, 1.5, 2].map((rate) => (
                                  <button
                                    key={rate}
                                    type="button"
                                    onClick={() => changePlaybackRate(rate)}
                                    className={`rounded-lg px-1 py-1.5 text-[11px] ${playbackRate === rate ? "bg-[#a855f7] text-white" : "bg-white/5 text-white/65 hover:bg-white/10"}`}
                                  >
                                    {rate}x
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={handleFullscreen}
                        className="hikari-mobile-fullscreen flex size-9 items-center justify-center rounded-full border border-white/15 bg-white/[0.08] text-white/90 shadow-[0_8px_28px_rgba(0,0,0,0.35)] transition hover:bg-white/15 hover:border-white/25 active:scale-95 sm:size-9"
                        aria-label="Tela cheia"
                      >
                        <Maximize className="size-4 sm:size-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            

    </>
  );
}
