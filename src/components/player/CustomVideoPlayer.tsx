import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import type Hls from 'hls.js';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Settings,
  Info,
  X,
  RotateCcw,
  RotateCw,
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
  video?: VideoItem | null;
  onClose?: () => void;
  autoPlay?: boolean;
  onUpdateMetadata?: (videoId: string, metadata: VideoMetadataUpdates) => void;
  initialTime?: number;
  onPlay?: () => void;
  onPlaying?: () => void;
  onSeeking?: () => void;
  onSeeked?: () => void;
  onWaiting?: () => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onPause?: (currentTime: number, duration: number) => void;
  onRestored?: (currentTime: number) => void;
  onEnded?: () => void;
  onError?: (error: Error | string) => void;
  onNextEpisode?: () => void;
  hasPrevEpisode?: boolean;
  hasNextEpisode?: boolean;
  className?: string;
}

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
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const initialTimeAppliedRef = useRef<boolean>(false);
  const hideControlsTimeoutRef = useRef<number | null>(null);
  const lastTapTimeRef = useRef<number>(0);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1);
  const [showSettingsMenu, setShowSettingsMenu] = useState<boolean>(false);
  const [isBuffering, setIsBuffering] = useState<boolean>(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [doubleTapFeedback, setDoubleTapFeedback] = useState<'left' | 'right' | null>(null);

  // Refs for callbacks
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

  const isHls = useMemo(() => isHlsUrl(effectiveVideoUrl), [effectiveVideoUrl, isHlsUrl]);
  const hasMseSupport = useMemo(() => isMediaSourceSupported(), []);

  // Auto-hide controls handler during playback
  useEffect(() => {
    if (!isPlaying) {
      // When paused, keep controls visible by default, clear any hide timeout
      setShowControls(true);
      if (hideControlsTimeoutRef.current) {
        window.clearTimeout(hideControlsTimeoutRef.current);
        hideControlsTimeoutRef.current = null;
      }
      return;
    }

    // When playing and controls are visible, start auto-hide timer after 3s of inactivity
    if (showControls) {
      if (hideControlsTimeoutRef.current) {
        window.clearTimeout(hideControlsTimeoutRef.current);
      }
      hideControlsTimeoutRef.current = window.setTimeout(() => {
        setShowControls(false);
        setShowSettingsMenu(false);
      }, 3000);
    }

    return () => {
      if (hideControlsTimeoutRef.current) {
        window.clearTimeout(hideControlsTimeoutRef.current);
      }
    };
  }, [isPlaying, showControls]);

  const handleUserActivity = useCallback(() => {
    if (!isPlaying) return;
    setShowControls(true);
    if (hideControlsTimeoutRef.current) {
      window.clearTimeout(hideControlsTimeoutRef.current);
    }
    hideControlsTimeoutRef.current = window.setTimeout(() => {
      setShowControls(false);
      setShowSettingsMenu(false);
    }, 3000);
  }, [isPlaying]);

  const applyInitialTime = useCallback(() => {
    const el = videoRef.current;
    if (!el || initialTimeAppliedRef.current) return;
    const target = initialTimeRef.current;
    if (!target || target <= 0) {
      initialTimeAppliedRef.current = true;
      return;
    }
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
        // Retry later
      }
    }
  }, []);

  const playSafely = useCallback((videoEl: HTMLVideoElement) => {
    if (!autoPlay) return;
    const promise = videoEl.play();
    if (promise !== undefined) {
      promise.catch((err) => {
        if (err?.name === 'NotAllowedError' || err?.name === 'AbortError') {
          videoEl.muted = true;
          setIsMuted(true);
          videoEl.play().catch((mutedErr) => {
            console.warn('Autoplay restricted:', mutedErr);
          });
        } else {
          console.warn('Autoplay restricted:', err);
        }
      });
    }
  }, [autoPlay]);

  // Video source setup & Hls.js
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl || !effectiveVideoUrl) return;

    let isCancelled = false;

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
          console.error('Failed to load hls.js:', err);
          if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
            videoEl.src = effectiveVideoUrl;
            playSafely(videoEl);
          } else {
            const msg = 'Falha ao carregar HLS.';
            setVideoError(msg);
            onErrorRef.current?.(msg);
          }
        });
    } else if (isHls && videoEl.canPlayType('application/vnd.apple.mpegurl')) {
      videoEl.src = effectiveVideoUrl;
      playSafely(videoEl);
    } else {
      videoEl.src = effectiveVideoUrl;
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
          // Ignore
        }
      }
    };
  }, [effectiveVideoUrl, isHls, hasMseSupport, playSafely, applyInitialTime]);

  // Play/Pause toggle
  const togglePlay = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      el.play().catch(() => {});
      setShowControls(true);
    } else {
      el.pause();
      setShowControls(true);
    }
  }, []);

  // Mute toggle
  const toggleMute = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = !el.muted;
    setIsMuted(el.muted);
  }, []);

  // Volume change
  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    const el = videoRef.current;
    if (!el) return;
    el.volume = val;
    setVolume(val);
    if (val === 0) {
      el.muted = true;
      setIsMuted(true);
    } else if (el.muted) {
      el.muted = false;
      setIsMuted(false);
    }
  }, []);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Playback speed change
  const changeSpeed = useCallback((speed: PlaybackSpeed) => {
    const el = videoRef.current;
    if (!el) return;
    el.playbackRate = speed;
    setPlaybackSpeed(speed);
    setShowSettingsMenu(false);
  }, []);

  // Skip time (-10s / +10s)
  const skipTime = useCallback((seconds: number) => {
    const el = videoRef.current;
    if (!el) return;
    el.currentTime = Math.max(0, Math.min(el.duration || 0, el.currentTime + seconds));
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      const el = videoRef.current;
      if (!el) return;

      switch (e.code) {
        case 'Space':
        case 'KeyK':
          e.preventDefault();
          togglePlay();
          break;
        case 'KeyF':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'KeyM':
          e.preventDefault();
          toggleMute();
          break;
        case 'ArrowLeft':
        case 'KeyJ':
          e.preventDefault();
          skipTime(-10);
          break;
        case 'ArrowRight':
        case 'KeyL':
          e.preventDefault();
          skipTime(10);
          break;
        case 'ArrowUp':
          e.preventDefault();
          {
            const newVol = Math.min(1, el.volume + 0.1);
            el.volume = newVol;
            setVolume(newVol);
            if (el.muted) {
              el.muted = false;
              setIsMuted(false);
            }
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          {
            const newVol = Math.max(0, el.volume - 0.1);
            el.volume = newVol;
            setVolume(newVol);
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, toggleFullscreen, toggleMute, skipTime]);

  // Click/tap handler on video container (toggle controls visibility cleanly without touchstart conflicts)
  const handleContainerClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const now = Date.now();
    const timeDiff = now - lastTapTimeRef.current;
    lastTapTimeRef.current = now;

    if (timeDiff < 350) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const width = rect.width;

      if (x < width * 0.35) {
        skipTime(-10);
        setDoubleTapFeedback('left');
        setTimeout(() => setDoubleTapFeedback(null), 600);
      } else if (x > width * 0.65) {
        skipTime(10);
        setDoubleTapFeedback('right');
        setTimeout(() => setDoubleTapFeedback(null), 600);
      } else {
        toggleFullscreen();
      }
    } else {
      // Single tap / click on video area: toggle controls visibility
      setShowControls((current) => !current);
      if (showSettingsMenu) {
        setShowSettingsMenu(false);
      }
    }
  }, [skipTime, toggleFullscreen, showSettingsMenu]);

  // Video event handlers
  const handleTimeUpdate = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    const time = el.currentTime;
    const dur = el.duration || video?.duration || 0;
    setCurrentTime(time);
    if (dur && dur > 0 && dur !== duration) {
      setDuration(dur);
    }

    if (initialTime && initialTime > 0 && !initialTimeAppliedRef.current) {
      if (el.readyState >= 1) {
        applyInitialTime();
      }
      if (time < 1) return;
    }

    onTimeUpdateRef.current?.(time, dur);
  }, [video?.duration, duration, initialTime, applyInitialTime]);

  const handleLoadedMetadata = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    applyInitialTime();
    setVideoError(null);

    const dur = el.duration;
    if (dur && Number.isFinite(dur)) {
      setDuration(dur);
    }

    const rawHeight = el.videoHeight;
    const detected = classifyVideoResolution(rawHeight);

    if (onUpdateMetadataRef.current && video?.id) {
      const updates: VideoMetadataUpdates = {};
      if (dur && !isNaN(dur) && dur > 0) {
        updates.duration = Math.round(dur);
        updates.durationFormatted = formatDuration(dur);
      }
      if (detected !== 'N/D') {
        updates.resolution = detected;
      }
      if (updates.duration !== undefined || updates.resolution !== undefined) {
        onUpdateMetadataRef.current(video.id, updates);
      }
    }
  }, [applyInitialTime, video?.id]);

  const handlePlayState = useCallback(() => {
    setIsPlaying(true);
    setIsBuffering(false);
    onPlay?.();
  }, [onPlay]);

  const handlePlayingState = useCallback(() => {
    setIsBuffering(false);
    onPlaying?.();
  }, [onPlaying]);

  const handlePauseState = useCallback(() => {
    setIsPlaying(false);
    setShowControls(true); // Ensure controls remain visible when paused
    const el = videoRef.current;
    if (!el) return;
    const time = el.currentTime;
    const dur = el.duration || video?.duration || 0;
    onPauseRef.current?.(time, dur);
  }, [video?.duration]);

  const handleWaitingState = useCallback(() => {
    setIsBuffering(true);
    onWaiting?.();
  }, [onWaiting]);

  const handleSeekingState = useCallback(() => {
    onSeeking?.();
  }, [onSeeking]);

  const handleSeekedState = useCallback(() => {
    onSeeked?.();
  }, [onSeeked]);

  const handleEndedState = useCallback(() => {
    setIsPlaying(false);
    setShowControls(true);
    onEndedRef.current?.();
  }, []);

  const handleMediaError = useCallback(() => {
    const msg = video?.isLocalFile
      ? 'O navegador não conseguiu decodificar o arquivo local.'
      : 'Não foi possível reproduzir este vídeo no momento.';
    setVideoError(msg);
    onErrorRef.current?.(msg);
  }, [video?.isLocalFile]);

  // Timeline seek change
  const handleSeekChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    const el = videoRef.current;
    if (!el) return;
    el.currentTime = val;
    setCurrentTime(val);
  }, []);

  return (
    <div
      ref={containerRef}
      onMouseMove={handleUserActivity}
      onClick={handleContainerClick}
      data-controls={showControls ? "visible" : "hidden"}
      data-paused={!isPlaying ? "true" : "false"}
      className={`hikari-video-player w-full aspect-video min-h-[240px] md:min-h-[520px] flex items-center justify-center select-none ${className || ''}`}
    >
      {/* Video element with filter:none and transition:none */}
      <video
        ref={videoRef}
        src={isHls && hasMseSupport ? undefined : effectiveVideoUrl}
        poster={effectivePosterUrl}
        playsInline
        autoPlay={autoPlay}
        onPlay={handlePlayState}
        onPlaying={handlePlayingState}
        onPause={handlePauseState}
        onWaiting={handleWaitingState}
        onSeeking={handleSeekingState}
        onSeeked={handleSeekedState}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEndedState}
        onError={handleMediaError}
        className="video-body-click w-full h-full object-contain bg-black cursor-pointer"
      />

      {/* Buffering spinner overlay */}
      {isBuffering && !videoError && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="w-12 h-12 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
        </div>
      )}

      {/* Double tap feedback indicators */}
      {doubleTapFeedback === 'left' && (
        <div className="absolute left-10 top-1/2 -translate-y-1/2 z-30 bg-black/70 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/10 flex items-center gap-2 text-white animate-fade-in pointer-events-none">
          <RotateCcw className="w-6 h-6 text-purple-400 animate-spin" />
          <span className="text-sm font-bold">-10s</span>
        </div>
      )}
      {doubleTapFeedback === 'right' && (
        <div className="absolute right-10 top-1/2 -translate-y-1/2 z-30 bg-black/70 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/10 flex items-center gap-2 text-white animate-fade-in pointer-events-none">
          <span className="text-sm font-bold">+10s</span>
          <RotateCw className="w-6 h-6 text-purple-400 animate-spin" />
        </div>
      )}

      {/* Top Close Button */}
      {onClose && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          aria-label="Voltar"
          className="absolute top-4 left-4 z-30 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 active:scale-95 text-slate-200 hover:text-white flex items-center justify-center transition-all border border-white/10 backdrop-blur-md cursor-pointer shadow-lg"
        >
          <X className="w-5 h-5" />
        </button>
      )}

      {/* Custom Controls Overlay (z-30) */}
      <div
        className={`absolute inset-0 flex flex-col justify-end p-4 pt-6 bg-gradient-to-t from-black/85 via-black/45 to-transparent transition-opacity duration-300 z-30 pointer-events-none ${
          showControls || !isPlaying ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Center Big Play/Pause icon feedback when paused */}
        <div className="flex-1 flex items-center justify-center pointer-events-none">
          {!isPlaying && !videoError && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                togglePlay();
              }}
              className="w-16 h-16 rounded-full bg-purple-600/90 hover:bg-purple-600 text-white flex items-center justify-center shadow-2xl backdrop-blur-sm pointer-events-auto cursor-pointer transition-transform hover:scale-105 active:scale-95"
              aria-label="Reproduzir"
            >
              <Play className="w-8 h-8 fill-current translate-x-0.5" />
            </button>
          )}
        </div>

        {/* Bottom Control Bar */}
        <div
          onClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          className="flex flex-col gap-2 w-full pointer-events-auto bg-black/40 backdrop-blur-md p-3 rounded-xl border border-white/10 relative"
        >
          {/* Timeline progress bar */}
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.1}
              value={currentTime}
              onChange={handleSeekChange}
              className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-purple-500 hover:h-2 transition-all"
            />
          </div>

          <div className="flex items-center justify-between text-xs text-slate-300 font-medium">
            {/* Left controls: Play, Volume, Time */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={togglePlay}
                aria-label={isPlaying ? 'Pausar' : 'Reproduzir'}
                className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-white transition-colors cursor-pointer"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
              </button>

              <div className="flex items-center gap-2 group/vol relative">
                <button
                  type="button"
                  onClick={toggleMute}
                  aria-label={isMuted ? 'Ativar som' : 'Silenciar'}
                  className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-white transition-colors cursor-pointer"
                >
                  {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-16 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-purple-500 hidden group-hover/vol:block transition-all"
                />
              </div>

              <div className="tabular-nums">
                {formatDuration(currentTime)} / {formatDuration(duration)}
              </div>
            </div>

            {/* Right controls: Settings Menu, Fullscreen */}
            <div className="flex items-center gap-2 relative">
              {/* Settings Menu Toggle */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowSettingsMenu((prev) => !prev)}
                  aria-label="Configurações e velocidade"
                  className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-slate-200 hover:text-white transition-colors cursor-pointer"
                >
                  <Settings className="w-4 h-4" />
                </button>

                {/* Settings Popup Menu (Compact mobile-friendly speed menu) */}
                {showSettingsMenu && (
                  <div className="absolute bottom-full right-0 mb-2 w-32 bg-[#161424]/95 border border-purple-500/30 rounded-xl shadow-2xl p-1.5 z-45 backdrop-blur-xl text-slate-200 max-h-36 overflow-y-auto pr-1">
                    <div className="flex flex-col gap-0.5">
                      {([0.5, 0.75, 1, 1.25, 1.5, 2] as PlaybackSpeed[]).map((spd) => (
                        <button
                          key={spd}
                          type="button"
                          onClick={() => changeSpeed(spd)}
                          className={`w-full px-2.5 py-1.5 text-left text-xs rounded-lg transition-colors flex items-center justify-between cursor-pointer ${
                            playbackSpeed === spd
                              ? 'bg-purple-600/30 text-purple-200 font-semibold'
                              : 'text-slate-300 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <span>{spd}x</span>
                          {playbackSpeed === spd && <Check className="w-3 h-3 text-purple-400" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Fullscreen Toggle */}
              <button
                type="button"
                onClick={toggleFullscreen}
                aria-label={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
                className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-white transition-colors cursor-pointer"
              >
                {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Error fallback screen */}
      {videoError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#08070d]/95 p-6 text-center z-40">
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
    </div>
  );
};

export default CustomVideoPlayer;
