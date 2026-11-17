import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import type Hls from 'hls.js';
import {
  Container,
  createPlayer,
  createSelector,
  definePlayerFeature,
  selectBuffer,
  selectFullscreen,
  selectPlayback,
  selectPlaybackRate,
  selectTime,
  selectVolume,
  videoFeatures,
  type MediaControlsState,
} from '@videojs/react';
import { Video } from '@videojs/react/video';
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

type HlsLogStage =
  | 'URL'
  | 'INIT'
  | 'MANIFEST'
  | 'FRAGMENT'
  | 'PLAYBACK'
  | 'RECOVERY'
  | 'FALLBACK'
  | 'ERROR'
  | 'FATAL';

type HlsErrorCategory =
  | 'url'
  | 'manifest'
  | 'segment'
  | 'cors_auth'
  | 'compat_decode';

interface PlayerErrorState {
  category: HlsErrorCategory;
  title: string;
  proxyReason?: string;
  message: string;
  detail: string;
}

function sanitizeStreamUrl(url: string): string {
  if (!url) return '';
  try {
    const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const parsed = new URL(url, base);
    const maskedPath = parsed.pathname
      .split('/')
      .map((seg) => {
        if (!seg) return seg;
        if (/^(?:bcdn_token|token|sig|auth)=/i.test(seg) || seg.length > 40) {
          return '***';
        }
        return seg;
      })
      .join('/');
    parsed.pathname = maskedPath;

    const safeParams = new URLSearchParams();
    for (const [key] of parsed.searchParams.entries()) {
      safeParams.set(key, '***');
    }
    const qs = safeParams.toString();
    return `${parsed.origin}${parsed.pathname}${qs ? `?${qs}` : ''}`;
  } catch {
    return url.split('?')[0] || '[url-invalida]';
  }
}

function resolveHlsPlaybackUrl(url: string): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  try {
    const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const parsed = new URL(trimmed, base);
    const pathLower = parsed.pathname.toLowerCase();
    if (
      (pathLower === '/api/hls' || pathLower === '/hls') &&
      parsed.searchParams.has('u')
    ) {
      return trimmed;
    }
    const hostname = parsed.hostname.toLowerCase();
    if (
      (parsed.protocol === 'https:' || parsed.protocol === 'http:') &&
      (hostname === 'maximaimg.online' || hostname.endsWith('.maximaimg.online'))
    ) {
      return `/api/hls?u=${encodeURIComponent(trimmed)}`;
    }
  } catch {
    // Keep original string if URL parsing fails
  }
  return trimmed;
}

function extractProxyErrorReason(data: unknown): string {
  if (!data || typeof data !== 'object') return '';
  const errData = data as {
    response?: { data?: unknown };
    networkDetails?: unknown;
  };

  let rawText = '';

  const respData = errData.response?.data;
  if (typeof respData === 'string') {
    rawText = respData;
  } else if (respData instanceof ArrayBuffer) {
    try {
      rawText = new TextDecoder('utf-8').decode(new Uint8Array(respData));
    } catch {
      rawText = '';
    }
  }

  if (!rawText && errData.networkDetails && typeof errData.networkDetails === 'object') {
    const xhr = errData.networkDetails as {
      responseType?: string;
      responseText?: string;
      response?: unknown;
    };
    if (
      (xhr.responseType === '' || xhr.responseType === 'text' || xhr.responseType === undefined) &&
      typeof xhr.responseText === 'string'
    ) {
      rawText = xhr.responseText;
    } else if (xhr.response instanceof ArrayBuffer) {
      try {
        rawText = new TextDecoder('utf-8').decode(new Uint8Array(xhr.response));
      } catch {
        rawText = '';
      }
    } else if (typeof xhr.response === 'string') {
      rawText = xhr.response;
    }
  }

  const trimmed = rawText.trim();
  if (!trimmed) return '';
  // Mask any signed query params on url= if present while keeping status and referer visible
  const sanitized = trimmed.replace(/(\|\s*url=)(\S+)/i, (_m, prefix: string, targetUrl: string) => {
    return `${prefix}${sanitizeStreamUrl(targetUrl)}`;
  });
  return sanitized.length > 220 ? `${sanitized.slice(0, 220)}...` : sanitized;
}

function isHlsStreamUrl(url: string, depth = 0): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed, 'http://localhost');
    const pathLower = parsed.pathname.toLowerCase();
    const searchLower = parsed.search.toLowerCase();
    if (
      depth === 0 &&
      (pathLower === '/api/hls' || pathLower === '/hls') &&
      parsed.searchParams.get('u')
    ) {
      const inner = parsed.searchParams.get('u') || '';
      if (isHlsStreamUrl(inner, depth + 1)) return true;
    }
    return (
      pathLower.endsWith('.m3u8') ||
      pathLower.endsWith('.m3u') ||
      /\.m3u8?(?:[?#&]|$)/i.test(trimmed) ||
      searchLower.includes('.m3u8') ||
      searchLower.includes('.m3u') ||
      pathLower.includes('/hls/')
    );
  } catch {
    return /\.m3u8?(?:[?#&]|$)/i.test(trimmed) || trimmed.toLowerCase().includes('/hls/');
  }
}

function isValidDirectStreamUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed || trimmed === '#') return false;
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:')
  ) {
    return false;
  }
  if (lower.startsWith('blob:') || (trimmed.startsWith('/') && !trimmed.startsWith('//'))) {
    return true;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function logHls(stage: HlsLogStage, msg: string, data?: unknown) {
  const prefix = `[Hikari Player: HLS] [${stage}]`;
  if (data !== undefined) {
    console.log(`${prefix} ${msg}`, data);
  } else {
    console.log(`${prefix} ${msg}`);
  }
}

function warnHls(stage: HlsLogStage, msg: string, data?: unknown) {
  const prefix = `[Hikari Player: HLS] [${stage}]`;
  if (data !== undefined) {
    console.warn(`${prefix} ${msg}`, data);
  } else {
    console.warn(`${prefix} ${msg}`);
  }
}

function errorHls(stage: HlsLogStage, msg: string, data?: unknown) {
  const prefix = `[Hikari Player: HLS] [${stage}]`;
  if (data !== undefined) {
    console.error(`${prefix} ${msg}`, data);
  } else {
    console.error(`${prefix} ${msg}`);
  }
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
  iframeFallbackUrl?: string;
  onFallbackToIframe?: () => void;
}

const SPEED_OPTIONS: PlaybackSpeed[] = [0.5, 0.75, 1, 1.25, 1.5, 2];
const IDLE_HIDE_DELAY_MS = 3000;
const TOUCH_SETTLE_DELAY_MS = 600;
const TAP_MAX_DISTANCE_PX = 12;
const TAP_MAX_DURATION_MS = 500;
const DOUBLE_TAP_WINDOW_MS = 250;
const DOUBLE_TAP_MAX_DISTANCE_PX = 72;

const INTERACTIVE_TARGET_SELECTOR =
  '[data-controls-interactive="true"], button, input, select, textarea, a, [role="button"], [role="slider"], [role="menu"], [role="menuitem"]';

function isInteractiveEventTarget(target: EventTarget | null): boolean {
  if (!target || typeof Element === 'undefined') return false;
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest(INTERACTIVE_TARGET_SELECTOR));
}

function getSavedPlaybackRate(): PlaybackSpeed {
  if (typeof window === 'undefined') return 1;
  try {
    const saved = window.localStorage.getItem('nova_player_playback_rate');
    const parsed = saved ? Number.parseFloat(saved) : 1;
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed as PlaybackSpeed;
    }
  } catch {
    // Ignore storage error
  }
  return 1;
}

function getSavedQualityPreference(): string {
  if (typeof window === 'undefined') return 'Automática';
  try {
    return window.localStorage.getItem('nova_player_quality_preference') || 'Automática';
  } catch {
    return 'Automática';
  }
}

type ControlsActionsHandle = {
  requestControlsLock: () => () => void;
  toggleControls: (forceShow?: boolean) => boolean;
  setDelegates: (nextLock: () => () => void, nextToggle: (forceShow?: boolean) => boolean) => void;
  reset: () => void;
};

const hikariControlsActionsMap = new WeakMap<() => () => void, ControlsActionsHandle>();

function createHikariControlsActions(
  fallbackRequestControlsLock: () => () => void,
  fallbackToggleControls: (forceShow?: boolean) => boolean,
): ControlsActionsHandle {
  let requestControlsLockDelegate = fallbackRequestControlsLock;
  let toggleControlsDelegate = fallbackToggleControls;
  const locks = new Set<{ release: () => void }>();

  const requestControlsLock = () => {
    const lock = { release: requestControlsLockDelegate() };
    let released = false;
    locks.add(lock);
    return () => {
      if (released) return;
      released = true;
      locks.delete(lock);
      lock.release();
    };
  };

  const toggleControls = (forceShow?: boolean) => toggleControlsDelegate(forceShow);

  const handle: ControlsActionsHandle = {
    requestControlsLock,
    toggleControls,
    setDelegates(nextLock, nextToggle) {
      if (nextLock !== requestControlsLockDelegate) {
        requestControlsLockDelegate = nextLock;
        for (const lock of locks) {
          lock.release();
          lock.release = nextLock();
        }
      }
      toggleControlsDelegate = nextToggle;
    },
    reset() {
      handle.setDelegates(fallbackRequestControlsLock, fallbackToggleControls);
    },
  };

  return handle;
}

/**
 * Custom Video.js player controls feature tailored for Hikari / Nova Stream:
 * - Shows controls on pause/end and keeps them visible until tapped.
 * - Allows tapping video area while paused to hide controls WITHOUT starting playback.
 * - Shows controls for 3s of inactivity during playback before auto-hiding.
 * - Avoids pointerup conflicts with React gesture handling and ignores synthetic mouse events after touch.
 */
const hikariControlsFeature = definePlayerFeature<MediaControlsState>({
  name: 'controls',
  state: ({ get, set }) => {
    const fallbackRequestControlsLock = () => {
      set({ controlsVisible: true, userActive: true });
      return () => {};
    };
    const fallbackToggleControls = (forceShow?: boolean) => {
      const next = forceShow ?? !get().controlsVisible;
      set({
        userActive: next,
        controlsVisible: next,
      });
      return next;
    };

    const actions = createHikariControlsActions(
      fallbackRequestControlsLock,
      fallbackToggleControls,
    );
    hikariControlsActionsMap.set(actions.requestControlsLock, actions);

    return {
      userActive: true,
      controlsVisible: true,
      requestControlsLock: actions.requestControlsLock,
      toggleControls: actions.toggleControls,
    };
  },
  attach({ target, signal, get, set }) {
    const { media, container } = target;
    if (!media || !container) return;

    let idleTimer: number | undefined;
    let controlsLockCount = 0;
    let lastTouchAt = 0;
    let shownByMoveAt = 0;

    const isMediaPaused = () => Boolean((media as HTMLMediaElement).paused);
    const isRecentTouch = () =>
      lastTouchAt > 0 && Date.now() - lastTouchAt < TOUCH_SETTLE_DELAY_MS;

    const clearIdle = () => {
      if (idleTimer !== undefined) {
        window.clearTimeout(idleTimer);
        idleTimer = undefined;
      }
    };

    const scheduleIdle = () => {
      clearIdle();
      if (controlsLockCount > 0 || isMediaPaused()) return;
      idleTimer = window.setTimeout(() => {
        if (controlsLockCount > 0 || isMediaPaused()) return;
        shownByMoveAt = 0;
        set({ userActive: false, controlsVisible: false });
      }, IDLE_HIDE_DELAY_MS);
    };

    const showControls = (fromMove = false) => {
      const wasHidden = !get().controlsVisible;
      if (wasHidden || !get().userActive) {
        if (fromMove && wasHidden) {
          shownByMoveAt = Date.now();
        }
        set({ userActive: true, controlsVisible: true });
      }
      scheduleIdle();
    };

    const hideControls = () => {
      clearIdle();
      shownByMoveAt = 0;
      if (controlsLockCount > 0) return;
      if (get().controlsVisible || get().userActive) {
        set({ userActive: false, controlsVisible: false });
      }
    };

    const requestControlsLock = () => {
      controlsLockCount += 1;
      clearIdle();
      shownByMoveAt = 0;
      if (!get().controlsVisible || !get().userActive) {
        set({ controlsVisible: true, userActive: true });
      }
      let released = false;
      return () => {
        if (released || signal.aborted) return;
        released = true;
        controlsLockCount = Math.max(0, controlsLockCount - 1);
        if (controlsLockCount === 0 && get().controlsVisible && !isMediaPaused()) {
          scheduleIdle();
        }
      };
    };

    const toggleControls = (forceShow?: boolean) => {
      if (forceShow === undefined && get().controlsVisible && shownByMoveAt > 0 && Date.now() - shownByMoveAt < 450) {
        shownByMoveAt = 0;
        scheduleIdle();
        return get().controlsVisible;
      }
      shownByMoveAt = 0;
      const shouldShow = forceShow ?? !get().controlsVisible;
      if (shouldShow) {
        showControls(false);
      } else {
        hideControls();
      }
      return get().controlsVisible;
    };

    const actions = hikariControlsActionsMap.get(get().requestControlsLock);
    actions?.setDelegates(requestControlsLock, toggleControls);

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'touch') {
        lastTouchAt = Date.now();
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch' || isRecentTouch()) return;
      // Only auto-reveal on hover/pointermove during active playback so a paused tap-to-hide isn't undone immediately
      if (!isMediaPaused()) {
        showControls(true);
      }
    };

    const onKeyDown = () => {
      if (!isMediaPaused()) {
        showControls();
      }
    };

    const onPlay = () => {
      showControls();
    };

    const onPauseOrEnded = () => {
      clearIdle();
      set({ userActive: true, controlsVisible: true });
    };

    container.addEventListener('pointerdown', onPointerDown, { signal });
    container.addEventListener('pointermove', onPointerMove, { signal });
    container.addEventListener('keydown', onKeyDown, { signal });
    (media as EventTarget).addEventListener('play', onPlay, { signal });
    (media as EventTarget).addEventListener('pause', onPauseOrEnded, { signal });
    (media as EventTarget).addEventListener('ended', onPauseOrEnded, { signal });

    signal.addEventListener(
      'abort',
      () => {
        actions?.reset();
        controlsLockCount = 0;
        clearIdle();
      },
      { once: true },
    );

    if (!isMediaPaused()) {
      scheduleIdle();
    }
  },
});

const hikariVideoFeatures = [
  ...videoFeatures.filter((feature) => feature.name !== 'controls'),
  hikariControlsFeature,
];

const selectHikariControls = createSelector(hikariControlsFeature);

const {
  Player: HikariVideoPlayerRoot,
  usePlayer: useHikariPlayer,
  useMedia: useHikariMedia,
} = createPlayer({
  features: hikariVideoFeatures,
  displayName: 'HikariVideoPlayer',
});

interface HikariPlayerSurfaceProps {
  video?: VideoItem | null;
  effectiveVideoUrl: string;
  effectivePosterUrl: string;
  isHls: boolean;
  autoPlay: boolean;
  initialTime: number;
  onClose?: () => void;
  onUpdateMetadata?: (videoId: string, metadata: VideoMetadataUpdates) => void;
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
  className?: string;
  iframeFallbackUrl?: string;
  onFallbackToIframe?: () => void;
}

const HikariPlayerSurface: React.FC<HikariPlayerSurfaceProps> = ({
  video,
  effectiveVideoUrl,
  effectivePosterUrl,
  isHls,
  autoPlay,
  initialTime,
  onClose,
  onUpdateMetadata,
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
  iframeFallbackUrl,
  onFallbackToIframe,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const media = useHikariMedia();
  const hlsRef = useRef<Hls | null>(null);
  const playbackEngineRef = useRef<'idle' | 'native-hls' | 'hlsjs' | 'direct'>('idle');
  const isTearingDownRef = useRef<boolean>(false);
  const initialTimeAppliedRef = useRef<boolean>(false);
  const initialRateAppliedRef = useRef<boolean>(false);

  // Pointer & gesture tracking refs (single source of truth, prevents duplicate events)
  const activePointerRef = useRef<{
    pointerId: number;
    pointerType: string;
    startX: number;
    startY: number;
    startTime: number;
  } | null>(null);
  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null);
  const doubleTapTimeoutRef = useRef<number | null>(null);

  // Lock controls while user interacts with settings menu or slider drag
  const settingsLockReleaseRef = useRef<(() => void) | null>(null);
  const sliderLockReleaseRef = useRef<(() => void) | null>(null);

  const [showSettingsMenu, setShowSettingsMenu] = useState<boolean>(false);
  const [videoError, setVideoError] = useState<PlayerErrorState | null>(null);
  const [doubleTapFeedback, setDoubleTapFeedback] = useState<'left' | 'right' | null>(null);
  const [hasPlaybackStarted, setHasPlaybackStarted] = useState<boolean>(() => Boolean(autoPlay));
  const hasPlaybackStartedRef = useRef<boolean>(Boolean(autoPlay));
  hasPlaybackStartedRef.current = hasPlaybackStarted;
  const [posterFailed, setPosterFailed] = useState<boolean>(false);
  const [isIframeMode, setIsIframeMode] = useState<boolean>(false);
  const [hlsRetryNonce, setHlsRetryNonce] = useState<number>(0);

  const effectiveIframeUrl = useMemo(() => {
    if (iframeFallbackUrl) return iframeFallbackUrl;
    if (video?.iframeUrl) return video.iframeUrl;
    let raw = video?.videoUrl || video?.url || '';
    try {
      const parsed = new URL(raw, 'http://localhost');
      const proxiedTarget = parsed.searchParams.get('u');
      if (proxiedTarget) raw = proxiedTarget;
    } catch {
      // Mantém URL original caso não seja possível parsear
    }
    if (raw.includes('/embed/') || raw.includes('/video/') || raw.includes('animefire.plus/')) {
      return raw;
    }
    const maximaMatch = raw.match(/\/stream\/[a-z]\/([^/]+)\/(\d+)\.mp4/i);
    if (maximaMatch) {
      const slug = maximaMatch[1];
      const epNum = parseInt(maximaMatch[2], 10);
      return `https://animefire.plus/video/${slug}/${epNum}`;
    }
    return null;
  }, [iframeFallbackUrl, video?.iframeUrl, video?.videoUrl, video?.url]);

  const handleSwitchToIframe = useCallback(() => {
    if (effectiveIframeUrl) {
      setIsIframeMode(true);
      setVideoError(null);
      return;
    }
    if (onFallbackToIframe) {
      onFallbackToIframe();
    }
  }, [effectiveIframeUrl, onFallbackToIframe]);

  const handleRetryHls = useCallback(() => {
    setVideoError(null);
    setIsIframeMode(false);
    setHlsRetryNonce((prev) => prev + 1);
  }, []);

  const showInitialCover = !hasPlaybackStarted && !videoError && !isIframeMode;

  useEffect(() => {
    setPosterFailed(false);
  }, [effectivePosterUrl]);

  // Video.js Player Store State
  const playback = useHikariPlayer(selectPlayback);
  const timeState = useHikariPlayer(selectTime);
  const volumeState = useHikariPlayer(selectVolume);
  const fullscreenState = useHikariPlayer(selectFullscreen);
  const playbackRateState = useHikariPlayer(selectPlaybackRate);
  const controlsState = useHikariPlayer(selectHikariControls);
  const bufferState = useHikariPlayer(selectBuffer);

  const isPlaying = playback ? !playback.paused && !playback.ended : false;
  const isPaused = playback ? playback.paused || playback.ended : true;
  const isBuffering = playback ? playback.waiting : false;
  const currentTime = timeState?.currentTime ?? 0;
  const storeDuration = timeState?.duration ?? 0;
  const duration = storeDuration > 0 ? storeDuration : video?.duration || 0;
  const volume = volumeState?.volume ?? 1;
  const isMuted = volumeState?.muted ?? false;
  const isFullscreen = fullscreenState?.isFullscreen ?? false;
  const playbackSpeed = (playbackRateState?.playbackRate ?? 1) as PlaybackSpeed;
  const controlsVisible = controlsState?.controlsVisible ?? true;

  const bufferedPercent = useMemo(() => {
    if (!duration || duration <= 0 || !bufferState?.buffered?.length) return 0;
    let maxEnd = 0;
    for (const [, end] of bufferState.buffered) {
      if (end > maxEnd) maxEnd = end;
    }
    return Math.min(100, Math.max(0, (maxEnd / duration) * 100));
  }, [bufferState?.buffered, duration]);

  const progressPercent = useMemo(() => {
    if (!duration || duration <= 0) return 0;
    return Math.min(100, Math.max(0, (currentTime / duration) * 100));
  }, [currentTime, duration]);

  // Keep latest callbacks in refs
  const onPlayRef = useRef(onPlay);
  onPlayRef.current = onPlay;
  const onPlayingRef = useRef(onPlaying);
  onPlayingRef.current = onPlaying;
  const onSeekingRef = useRef(onSeeking);
  onSeekingRef.current = onSeeking;
  const onSeekedRef = useRef(onSeeked);
  onSeekedRef.current = onSeeked;
  const onWaitingRef = useRef(onWaiting);
  onWaitingRef.current = onWaiting;
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

  // Close settings menu automatically if controls become hidden
  useEffect(() => {
    if (!controlsVisible && showSettingsMenu) {
      setShowSettingsMenu(false);
    }
  }, [controlsVisible, showSettingsMenu]);

  // Hold Video.js controls lock while speed settings menu is open
  const requestControlsLockFn = controlsState?.requestControlsLock;
  useEffect(() => {
    if (showSettingsMenu && requestControlsLockFn) {
      settingsLockReleaseRef.current = requestControlsLockFn();
    } else if (settingsLockReleaseRef.current) {
      settingsLockReleaseRef.current();
      settingsLockReleaseRef.current = null;
    }

    return () => {
      if (settingsLockReleaseRef.current) {
        settingsLockReleaseRef.current();
        settingsLockReleaseRef.current = null;
      }
    };
  }, [showSettingsMenu, requestControlsLockFn]);

  useEffect(() => {
    return () => {
      if (sliderLockReleaseRef.current) {
        sliderLockReleaseRef.current();
        sliderLockReleaseRef.current = null;
      }
      if (doubleTapTimeoutRef.current) {
        window.clearTimeout(doubleTapTimeoutRef.current);
      }
    };
  }, []);

  const setPlaybackRateFn = playbackRateState?.setPlaybackRate;
  const applySavedPlaybackRate = useCallback(
    (videoEl: HTMLVideoElement) => {
      if (initialRateAppliedRef.current) return;
      const savedRate = getSavedPlaybackRate();
      initialRateAppliedRef.current = true;
      if (savedRate !== 1) {
        if (setPlaybackRateFn) {
          setPlaybackRateFn(savedRate);
        } else {
          videoEl.playbackRate = savedRate;
        }
      }
    },
    [setPlaybackRateFn],
  );

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
        // Retry once metadata/data is ready
      }
    }
  }, []);

  const playFn = playback?.play;
  const setMutedFn = volumeState?.setMuted;
  const playSafely = useCallback(
    (videoEl: HTMLVideoElement) => {
      if (!autoPlay && !hasPlaybackStartedRef.current) return;
      const playPromise = playFn ? playFn() : videoEl.play();
      if (playPromise !== undefined) {
        Promise.resolve(playPromise).catch((err: unknown) => {
          const errorName = (err as { name?: string })?.name;
          if (errorName === 'NotAllowedError' || errorName === 'AbortError') {
            if (setMutedFn) {
              setMutedFn(true);
            } else {
              videoEl.muted = true;
            }
            const retryPromise = playFn ? playFn() : videoEl.play();
            Promise.resolve(retryPromise).catch((mutedErr) => {
              console.warn('Autoplay restricted:', mutedErr);
            });
          } else {
            console.warn('Autoplay restricted:', err);
          }
        });
      }
    },
    [autoPlay, playFn, setMutedFn],
  );

  const applySavedPlaybackRateRef = useRef(applySavedPlaybackRate);
  applySavedPlaybackRateRef.current = applySavedPlaybackRate;
  const applyInitialTimeRef = useRef(applyInitialTime);
  applyInitialTimeRef.current = applyInitialTime;
  const playSafelyRef = useRef(playSafely);
  playSafelyRef.current = playSafely;

  // Video.js <Video> source setup + Native HLS / Hls.js engine lifecycle
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl || isIframeMode) return;

    const directUrl = effectiveVideoUrl.trim();
    if (!directUrl || !isValidDirectStreamUrl(directUrl)) {
      const urlErr: PlayerErrorState = {
        category: 'url',
        title: 'URL de Transmissão Inválida',
        message: 'Não foi possível obter uma URL válida de transmissão para este episódio.',
        detail: 'Verifique se o link da fonte cadastrada é um endereço HTTP/HTTPS válido.',
      };
      errorHls('URL', 'Falha na obtenção da URL da stream.', { hasUrl: Boolean(directUrl) });
      setVideoError(urlErr);
      onErrorRef.current?.(urlErr.message);
      return;
    }

    let isCancelled = false;
    let activeHls: Hls | null = null;
    isTearingDownRef.current = false;
    playbackEngineRef.current = 'idle';

    if (hlsRef.current) {
      try {
        hlsRef.current.detachMedia();
        hlsRef.current.destroy();
      } catch {
        // Ignore teardown error
      }
      hlsRef.current = null;
    }

    initialTimeAppliedRef.current = false;
    initialRateAppliedRef.current = false;
    setVideoError(null);

    const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);
    const isBrave =
      typeof navigator !== 'undefined' &&
      Boolean((navigator as unknown as { brave?: { isBrave?: () => Promise<boolean> } }).brave);
    const canPlayNativeHls =
      videoEl.canPlayType('application/vnd.apple.mpegurl') !== '' ||
      videoEl.canPlayType('application/x-mpegurl') !== '';

    logHls(
      'URL',
      `URL direta obtida: ${sanitizeStreamUrl(directUrl)} (isHls=${isHls}, nativeHLS=${canPlayNativeHls}, Android=${isAndroid}, Brave=${isBrave})`,
    );

    const reportFatalError = (errState: PlayerErrorState) => {
      if (isCancelled) return;
      if (hlsRef.current) {
        try {
          hlsRef.current.detachMedia();
          hlsRef.current.destroy();
        } catch {
          // Ignore teardown error
        }
        hlsRef.current = null;
      }
      activeHls = null;
      errorHls('FATAL', `[${errState.category}] ${errState.message}`, {
        detail: errState.detail,
        url: sanitizeStreamUrl(directUrl),
      });
      setVideoError(errState);
      onErrorRef.current?.(errState.message);
    };

    const onPlayLog = () => logHls('PLAYBACK', 'Evento play disparado no elemento HTMLVideoElement');
    const onPlayingLog = () => logHls('PLAYBACK', 'Transmissão em reprodução contínua ativa');
    const onWaitingLog = () => warnHls('PLAYBACK', 'Aguardando buffer de transmissão (buffering)...');
    const onPauseLog = () => logHls('PLAYBACK', 'Transmissão pausada');
    const onSeekedLog = () => {
      logHls('PLAYBACK', `Posição do vídeo ajustada para ${videoEl.currentTime.toFixed(1)}s`);
    };

    videoEl.addEventListener('play', onPlayLog);
    videoEl.addEventListener('playing', onPlayingLog);
    videoEl.addEventListener('waiting', onWaitingLog);
    videoEl.addEventListener('pause', onPauseLog);
    videoEl.addEventListener('seeked', onSeekedLog);

    let nativeCanPlayHandler: (() => void) | null = null;
    let nativeErrorHandler: (() => void) | null = null;

    const removeNativeListeners = () => {
      if (nativeCanPlayHandler) {
        videoEl.removeEventListener('canplay', nativeCanPlayHandler);
        videoEl.removeEventListener('loadedmetadata', nativeCanPlayHandler);
        nativeCanPlayHandler = null;
      }
      if (nativeErrorHandler) {
        videoEl.removeEventListener('error', nativeErrorHandler);
        nativeErrorHandler = null;
      }
    };

    const cleanupAll = () => {
      removeNativeListeners();
      videoEl.removeEventListener('play', onPlayLog);
      videoEl.removeEventListener('playing', onPlayingLog);
      videoEl.removeEventListener('waiting', onWaitingLog);
      videoEl.removeEventListener('pause', onPauseLog);
      videoEl.removeEventListener('seeked', onSeekedLog);
    };

    const startHlsJsEngine = () => {
      import('hls.js')
        .then(({ default: HlsClass }) => {
          if (isCancelled) return;

          if (!HlsClass.isSupported()) {
            if (canPlayNativeHls && playbackEngineRef.current !== 'native-hls') {
              startNativeHlsEngine(false);
              return;
            }
            reportFatalError({
              category: 'compat_decode',
              title: 'Navegador Incompatível com HLS',
              message: 'Este navegador não suporta reprodução HLS nativa nem Media Source Extensions (MSE).',
              detail: 'Tente atualizar o navegador ou utilizar o player incorporado, se disponível.',
            });
            return;
          }

          playbackEngineRef.current = 'hlsjs';
          logHls(
            'INIT',
            `Inicializando HLS.js v${HlsClass.version} (worker=${!isAndroid}, Android=${isAndroid}, Brave=${isBrave}).`,
          );

          if (hlsRef.current) {
            try {
              hlsRef.current.detachMedia();
              hlsRef.current.destroy();
            } catch {
              // Ignore teardown error
            }
            hlsRef.current = null;
          }

          const hls = new HlsClass({
            enableWorker: !isAndroid,
            lowLatencyMode: false,
            backBufferLength: 60,
            maxBufferLength: 30,
            maxMaxBufferLength: 600,
            maxBufferSize: 60 * 1000 * 1000,
            manifestLoadingTimeOut: 15000,
            manifestLoadingMaxRetry: 2,
            levelLoadingTimeOut: 15000,
            levelLoadingMaxRetry: 2,
            fragLoadingTimeOut: 20000,
            fragLoadingMaxRetry: 3,
            xhrSetup: (xhr, reqUrl) => {
              try {
                const sameOrigin =
                  typeof window !== 'undefined' &&
                  new URL(reqUrl, window.location.origin).origin === window.location.origin;
                xhr.withCredentials = sameOrigin;
              } catch {
                xhr.withCredentials = false;
              }
            },
            ...(initialTimeRef.current && initialTimeRef.current > 0
              ? { startPosition: initialTimeRef.current }
              : {}),
          });

          activeHls = hls;
          hlsRef.current = hls;

          let networkRecoveryAttempts = 0;
          let mediaRecoveryAttempts = 0;

          hls.on(HlsClass.Events.MEDIA_ATTACHED, () => {
            if (isCancelled) return;
            logHls('INIT', 'Elemento de vídeo anexado ao HLS.js. Carregando manifesto...');
            hls.loadSource(directUrl);
          });

          hls.on(HlsClass.Events.MANIFEST_LOADING, (_event, data) => {
            if (isCancelled) return;
            logHls('MANIFEST', `Baixando manifesto: ${sanitizeStreamUrl(data.url || directUrl)}`);
          });

          hls.on(HlsClass.Events.MANIFEST_LOADED, (_event, data) => {
            if (isCancelled) return;
            logHls(
              'MANIFEST',
              `Manifesto carregado (${data.levels?.length || 0} níveis, ${data.audioTracks?.length || 0} faixas de áudio).`,
            );
          });

          hls.on(HlsClass.Events.MANIFEST_PARSED, (_event, data) => {
            if (isCancelled) return;
            const qualities = Array.isArray(data?.levels)
              ? data.levels
                  .map((lvl: { height?: number; bitrate?: number }) =>
                    `${lvl.height || 'auto'}p@${Math.round((lvl.bitrate || 0) / 1000)}k`,
                  )
                  .join(', ')
              : 'padrão';
            logHls('MANIFEST', `Manifesto analisado. Qualidades: [${qualities}]`);

            const qualityPref = getSavedQualityPreference();
            if (qualityPref.includes('480p') && Array.isArray(data?.levels) && data.levels.length > 0) {
              const sdIdx = data.levels.findIndex((lvl) => (lvl.height ?? 0) <= 480);
              if (sdIdx >= 0) {
                hls.autoLevelCapping = sdIdx;
              }
            }
            applySavedPlaybackRateRef.current(videoEl);
            applyInitialTimeRef.current();
            playSafelyRef.current(videoEl);
          });

          hls.on(HlsClass.Events.FRAG_LOADING, (_event, data) => {
            if (isCancelled) return;
            logHls('FRAGMENT', `Baixando segmento #${data.frag.sn} (nível ${data.frag.level})`);
          });

          hls.on(HlsClass.Events.FRAG_LOADED, (_event, data) => {
            if (isCancelled) return;
            logHls(
              'FRAGMENT',
              `Segmento #${data.frag.sn} recebido (${data.frag.duration.toFixed(2)}s, ${data.payload?.byteLength || 0} bytes)`,
            );
          });

          hls.on(HlsClass.Events.FRAG_PARSED, (_event, data) => {
            if (isCancelled) return;
            logHls('FRAGMENT', `Segmento #${data.frag.sn} pronto no SourceBuffer.`);
          });

          hls.on(HlsClass.Events.ERROR, (_event, data) => {
            if (isCancelled || isTearingDownRef.current) return;
            const statusCode = data.response?.code;
            const httpStatusStr = typeof statusCode === 'number' ? String(statusCode) : 'N/A';
            const reqUrl = data.context?.url || data.frag?.url || directUrl;
            const detailStr = data.details || 'desconhecido';
            const proxyBodyReason = extractProxyErrorReason(data);
            const reasonStr = proxyBodyReason || data.reason || data.error?.message || '';

            errorHls('ERROR', `Falha HLS (${data.type}/${detailStr}, fatal=${data.fatal}, HTTP=${httpStatusStr})`, {
              url: sanitizeStreamUrl(reqUrl),
              reason: reasonStr || undefined,
            });

            if (!data.fatal) return;

            const isManifestFailure =
              detailStr === HlsClass.ErrorDetails.MANIFEST_LOAD_ERROR ||
              detailStr === HlsClass.ErrorDetails.MANIFEST_LOAD_TIMEOUT ||
              detailStr === HlsClass.ErrorDetails.MANIFEST_PARSING_ERROR ||
              detailStr === HlsClass.ErrorDetails.LEVEL_LOAD_ERROR ||
              detailStr === HlsClass.ErrorDetails.LEVEL_LOAD_TIMEOUT ||
              detailStr === HlsClass.ErrorDetails.LEVEL_PARSING_ERROR ||
              detailStr === HlsClass.ErrorDetails.LEVEL_EMPTY_ERROR;

            const isSegmentFailure =
              detailStr === HlsClass.ErrorDetails.FRAG_LOAD_ERROR ||
              detailStr === HlsClass.ErrorDetails.FRAG_LOAD_TIMEOUT ||
              detailStr === HlsClass.ErrorDetails.FRAG_DECRYPT_ERROR ||
              detailStr === HlsClass.ErrorDetails.KEY_LOAD_ERROR ||
              detailStr === HlsClass.ErrorDetails.KEY_LOAD_TIMEOUT;

            const isTimeoutDetail =
              detailStr === HlsClass.ErrorDetails.MANIFEST_LOAD_TIMEOUT ||
              detailStr === HlsClass.ErrorDetails.LEVEL_LOAD_TIMEOUT ||
              detailStr === HlsClass.ErrorDetails.FRAG_LOAD_TIMEOUT ||
              detailStr === HlsClass.ErrorDetails.KEY_LOAD_TIMEOUT;

            const isPureCorsFailure =
              !isTimeoutDetail &&
              statusCode === 0 &&
              (typeof navigator === 'undefined' || navigator.onLine !== false);

            const isProxyOrUpstreamRejection =
              statusCode === 401 ||
              statusCode === 403 ||
              statusCode === 502 ||
              Boolean(proxyBodyReason);

            switch (data.type) {
              case HlsClass.ErrorTypes.NETWORK_ERROR: {
                if (isPureCorsFailure) {
                  reportFatalError({
                    category: 'cors_auth',
                    title: 'Bloqueio de CORS na Transmissão',
                    proxyReason: 'HTTP 0 — Access-Control-Allow-Origin ausente ou bloqueio de rede no navegador',
                    message: 'O navegador impediu a leitura da transmissão por bloqueio de CORS.',
                    detail: 'O proxy ou CDN precisa enviar cabeçalhos Access-Control-Allow-Origin válidos para o player HLS.',
                  });
                  return;
                }

                if (isProxyOrUpstreamRejection) {
                  const formattedProxyReason = proxyBodyReason
                    ? `HTTP ${httpStatusStr} — ${proxyBodyReason}`
                    : `HTTP ${httpStatusStr} — Autorização ou Referer recusado pelo CDN`;
                  const isUpstreamForbidden =
                    statusCode === 401 ||
                    statusCode === 403 ||
                    /upstream\s+(?:401|403)|referer/i.test(proxyBodyReason);
                  reportFatalError({
                    category: 'cors_auth',
                    title: isUpstreamForbidden
                      ? 'Acesso Recusado pelo CDN (Referer / Origem)'
                      : 'Falha no Proxy HLS',
                    proxyReason: formattedProxyReason,
                    message: isSegmentFailure
                      ? 'O proxy HLS recebeu uma recusa do CDN ao baixar os segmentos do vídeo.'
                      : 'O proxy HLS não conseguiu obter uma playlist HLS válida do servidor de origem.',
                    detail: 'Você pode assistir pelo player do provedor (Iframe) ou tentar novamente.',
                  });
                  return;
                }

                if (!isManifestFailure && networkRecoveryAttempts < 2) {
                  networkRecoveryAttempts += 1;
                  warnHls('RECOVERY', `Tentando retomar carregamento de segmentos (${networkRecoveryAttempts}/2)...`);
                  hls.startLoad();
                  return;
                }

                if (isManifestFailure) {
                  reportFatalError({
                    category: 'manifest',
                    title: 'Erro ao Carregar Manifesto HLS',
                    proxyReason:
                      typeof statusCode === 'number'
                        ? `HTTP ${httpStatusStr}${reasonStr ? ` — ${reasonStr}` : ''}`
                        : undefined,
                    message:
                      statusCode === 404 || statusCode === 410
                        ? `O arquivo de manifesto (.m3u8) não foi encontrado no servidor (HTTP ${statusCode}).`
                        : detailStr === HlsClass.ErrorDetails.MANIFEST_PARSING_ERROR
                          ? 'O manifesto (.m3u8) retornado pelo provedor é inválido ou não pôde ser interpretado.'
                          : `Não foi possível carregar o manifesto HLS (.m3u8) (${detailStr}, HTTP ${httpStatusStr}).`,
                    detail: reasonStr || 'Verifique se a URL .m3u8 está acessível e retornando uma playlist HLS válida.',
                  });
                  return;
                }

                if (isSegmentFailure) {
                  reportFatalError({
                    category: 'segment',
                    title: 'Erro ao Baixar Segmentos do Vídeo',
                    proxyReason:
                      typeof statusCode === 'number'
                        ? `HTTP ${httpStatusStr}${reasonStr ? ` — ${reasonStr}` : ''}`
                        : undefined,
                    message: `Falha ao baixar os segmentos de mídia da transmissão HLS (${detailStr}, HTTP ${httpStatusStr}).`,
                    detail: reasonStr || 'Os fragmentos de vídeo podem ter expirado ou o CDN interrompeu a entrega.',
                  });
                  return;
                }

                reportFatalError({
                  category: 'manifest',
                  title: 'Falha de Rede na Transmissão HLS',
                  proxyReason:
                    typeof statusCode === 'number'
                      ? `HTTP ${httpStatusStr}${reasonStr ? ` — ${reasonStr}` : ''}`
                      : undefined,
                  message: `Erro de rede ao carregar a transmissão HLS (${detailStr}, HTTP ${httpStatusStr}).`,
                  detail: reasonStr || 'Verifique sua conexão ou a disponibilidade do servidor do provedor.',
                });
                break;
              }

              case HlsClass.ErrorTypes.MEDIA_ERROR: {
                if (mediaRecoveryAttempts === 0) {
                  mediaRecoveryAttempts += 1;
                  warnHls('RECOVERY', 'Erro de mídia detectado. Executando recoverMediaError()...');
                  hls.recoverMediaError();
                  return;
                }
                if (mediaRecoveryAttempts === 1) {
                  mediaRecoveryAttempts += 1;
                  warnHls('RECOVERY', 'Alternando codec de áudio e executando recoverMediaError()...');
                  hls.swapAudioCodec();
                  hls.recoverMediaError();
                  return;
                }
                reportFatalError({
                  category: 'compat_decode',
                  title: 'Erro de Decodificação ou Codec',
                  message: `O navegador não conseguiu decodificar os segmentos de vídeo/áudio (${detailStr}).`,
                  detail: reasonStr || 'Os codecs da transmissão podem ser incompatíveis com o MediaSource deste navegador.',
                });
                break;
              }

              case HlsClass.ErrorTypes.MUX_ERROR:
              case HlsClass.ErrorTypes.KEY_SYSTEM_ERROR:
              case HlsClass.ErrorTypes.OTHER_ERROR:
              default: {
                reportFatalError({
                  category: 'compat_decode',
                  title: 'Erro Interno ou Incompatibilidade HLS',
                  message: `Falha no processamento da transmissão HLS (${data.type}: ${detailStr}).`,
                  detail:
                    reasonStr ||
                    'Ocorreu uma incompatibilidade de MSE, demuxer ou DRM ao processar o fluxo neste navegador.',
                });
                break;
              }
            }
          });

          hls.attachMedia(videoEl);
        })
        .catch((err) => {
          if (isCancelled) return;
          errorHls('INIT', 'Falha ao importar biblioteca hls.js:', err);
          if (canPlayNativeHls && playbackEngineRef.current !== 'native-hls') {
            warnHls('FALLBACK', 'Hls.js indisponível. Tentando reprodução HLS nativa.');
            startNativeHlsEngine(false);
          } else {
            reportFatalError({
              category: 'compat_decode',
              title: 'Erro ao Inicializar Motor HLS',
              message: 'Não foi possível carregar o módulo HLS.js neste navegador.',
              detail: err instanceof Error ? err.message : 'Erro inesperado ao importar hls.js.',
            });
          }
        });
    };

    const startNativeHlsEngine = (allowHlsJsFallback: boolean) => {
      if (isCancelled) return;
      playbackEngineRef.current = 'native-hls';
      logHls('INIT', 'Utilizando reprodução HLS nativa do navegador com URL direta do provedor.');
      removeNativeListeners();

      let readyHandled = false;
      nativeCanPlayHandler = () => {
        if (isCancelled || readyHandled) return;
        readyHandled = true;
        logHls('MANIFEST', 'Manifesto HLS nativo carregado e metadados disponíveis.');
        applySavedPlaybackRateRef.current(videoEl);
        applyInitialTimeRef.current();
        playSafelyRef.current(videoEl);
      };

      nativeErrorHandler = () => {
        if (isCancelled || isTearingDownRef.current) return;
        const mediaErr = videoEl.error;
        const code = mediaErr?.code ?? 0;
        if (code === 1) return; // MEDIA_ERR_ABORTED

        const codeLabel =
          code === 2
            ? 'MEDIA_ERR_NETWORK'
            : code === 3
              ? 'MEDIA_ERR_DECODE'
              : code === 4
                ? 'MEDIA_ERR_SRC_NOT_SUPPORTED'
                : `CODE_${code}`;

        warnHls(
          'ERROR',
          `Erro no reprodutor HLS nativo (${codeLabel}): ${mediaErr?.message || 'sem detalhe adicional'}`,
          { url: sanitizeStreamUrl(directUrl) },
        );

        if (allowHlsJsFallback) {
          warnHls('FALLBACK', 'Tentando reprodução via HLS.js após falha do player nativo...');
          removeNativeListeners();
          isTearingDownRef.current = true;
          try {
            videoEl.pause();
            videoEl.removeAttribute('src');
            videoEl.load();
          } catch {
            // Ignore reset error
          }
          isTearingDownRef.current = false;
          startHlsJsEngine();
          return;
        }

        if (code === 2) {
          reportFatalError({
            category: 'manifest',
            title: 'Erro de Rede no Player Nativo',
            message: 'Falha de rede ao carregar a transmissão HLS nativa.',
            detail: mediaErr?.message || 'O manifesto ou os segmentos não puderam ser baixados.',
          });
        } else if (code === 3) {
          reportFatalError({
            category: 'compat_decode',
            title: 'Erro de Decodificação HLS',
            message: 'O navegador não conseguiu decodificar o vídeo HLS nativamente (MEDIA_ERR_DECODE).',
            detail: mediaErr?.message || 'Formato ou codec de vídeo/áudio incompatível.',
          });
        } else {
          reportFatalError({
            category: 'cors_auth',
            title: 'Fonte HLS Recusada ou Não Suportada',
            message: 'O player nativo não conseguiu carregar a URL .m3u8 (MEDIA_ERR_SRC_NOT_SUPPORTED).',
            detail:
              mediaErr?.message ||
              'O provedor pode ter bloqueado a origem/Referer (HTTP 403), a URL expirou ou o formato é incompatível.',
          });
        }
      };

      videoEl.addEventListener('loadedmetadata', nativeCanPlayHandler);
      videoEl.addEventListener('canplay', nativeCanPlayHandler);
      videoEl.addEventListener('error', nativeErrorHandler);

      videoEl.src = directUrl;
      videoEl.load();
    };

    if (isHls) {
      if (canPlayNativeHls) {
        startNativeHlsEngine(true);
      } else {
        startHlsJsEngine();
      }
    } else {
      playbackEngineRef.current = 'direct';
      logHls('INIT', 'Carregando stream direta MP4 / WebM.');
      if (videoEl.getAttribute('src') !== directUrl) {
        videoEl.src = directUrl;
      }
      if (videoEl.readyState >= 2) {
        applySavedPlaybackRateRef.current(videoEl);
        applyInitialTimeRef.current();
        playSafelyRef.current(videoEl);
      } else {
        nativeCanPlayHandler = () => {
          removeNativeListeners();
          if (isCancelled) return;
          applySavedPlaybackRateRef.current(videoEl);
          applyInitialTimeRef.current();
          playSafelyRef.current(videoEl);
        };
        videoEl.addEventListener('canplay', nativeCanPlayHandler);
      }
    }

    return () => {
      isCancelled = true;
      isTearingDownRef.current = true;
      cleanupAll();

      const hlsToDestroy = hlsRef.current || activeHls;
      hlsRef.current = null;
      activeHls = null;
      if (hlsToDestroy) {
        try {
          hlsToDestroy.detachMedia();
          hlsToDestroy.destroy();
        } catch {
          // Ignore teardown error
        }
      }

      if (isHls) {
        try {
          videoEl.pause();
          videoEl.removeAttribute('src');
          videoEl.load();
        } catch {
          // Ignore teardown error
        }
      } else {
        try {
          videoEl.pause();
        } catch {
          // Ignore teardown error
        }
      }
      playbackEngineRef.current = 'idle';
    };
  }, [effectiveVideoUrl, isHls, isIframeMode, hlsRetryNonce]);

  const handleStartFromCover = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      setHasPlaybackStarted(true);
      const el = videoRef.current || (media as HTMLMediaElement | null);
      if (!el) return;

      const playPromise = playback?.play ? playback.play() : el.play();
      if (playPromise !== undefined) {
        Promise.resolve(playPromise).catch((err: unknown) => {
          const errorName = (err as { name?: string })?.name;
          if (errorName === 'NotAllowedError' || errorName === 'AbortError') {
            if (volumeState?.setMuted) {
              volumeState.setMuted(true);
            } else {
              el.muted = true;
            }
            const retryPromise = playback?.play ? playback.play() : el.play();
            Promise.resolve(retryPromise).catch((mutedErr) => {
              console.warn('Playback restricted:', mutedErr);
            });
          } else {
            console.warn('Playback restricted:', err);
          }
        });
      }
      controlsState?.toggleControls(true);
    },
    [media, playback, volumeState, controlsState],
  );

  // Video.js Store Actions
  const togglePlay = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused || el.ended) {
      setHasPlaybackStarted(true);
      if (playback?.play) {
        void Promise.resolve(playback.play()).catch(() => {});
      } else {
        void el.play().catch(() => {});
      }
      controlsState?.toggleControls(true);
    } else {
      if (playback?.pause) {
        playback.pause();
      } else {
        el.pause();
      }
      controlsState?.toggleControls(true);
    }
  }, [playback, controlsState]);

  const toggleMute = useCallback(() => {
    const el = videoRef.current;
    if (volumeState?.setMuted) {
      volumeState.setMuted(!isMuted);
    } else if (el) {
      el.muted = !el.muted;
    }
    controlsState?.toggleControls(true);
  }, [volumeState, isMuted, controlsState]);

  const handleVolumeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = Number.parseFloat(e.target.value);
      if (Number.isNaN(val)) return;
      if (volumeState?.setVolume) {
        volumeState.setVolume(val);
        if (val === 0) {
          volumeState.setMuted(true);
        }
      } else if (videoRef.current) {
        videoRef.current.volume = val;
        videoRef.current.muted = val === 0;
      }
      controlsState?.toggleControls(true);
    },
    [volumeState, controlsState],
  );

  const toggleFullscreen = useCallback(() => {
    if (isFullscreen) {
      if (fullscreenState?.exitFullscreen) {
        void fullscreenState.exitFullscreen().catch(() => {});
      } else if (document.fullscreenElement) {
        void document.exitFullscreen().catch(() => {});
      }
    } else if (fullscreenState?.requestFullscreen) {
      void fullscreenState.requestFullscreen().catch(() => {});
    } else if (containerRef.current) {
      void containerRef.current.requestFullscreen().catch(() => {});
    }
  }, [isFullscreen, fullscreenState]);

  const changeSpeed = useCallback(
    (speed: PlaybackSpeed) => {
      if (playbackRateState?.setPlaybackRate) {
        playbackRateState.setPlaybackRate(speed);
      } else if (videoRef.current) {
        videoRef.current.playbackRate = speed;
      }
      setShowSettingsMenu(false);
      controlsState?.toggleControls(true);
    },
    [playbackRateState, controlsState],
  );

  const skipTime = useCallback(
    (seconds: number) => {
      const el = videoRef.current;
      const baseTime = el ? el.currentTime : currentTime;
      const maxDuration = (el && Number.isFinite(el.duration) && el.duration > 0 ? el.duration : duration) || 0;
      const targetTime = Math.max(0, maxDuration > 0 ? Math.min(maxDuration, baseTime + seconds) : baseTime + seconds);
      if (timeState?.seek) {
        void timeState.seek(targetTime);
      } else if (el) {
        el.currentTime = targetTime;
      }
    },
    [currentTime, duration, timeState],
  );

  const handleSeekChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = Number.parseFloat(e.target.value);
      if (Number.isNaN(val)) return;
      if (timeState?.seek) {
        void timeState.seek(val);
      } else if (videoRef.current) {
        videoRef.current.currentTime = val;
      }
    },
    [timeState],
  );

  const acquireSliderLock = useCallback(() => {
    if (!sliderLockReleaseRef.current && controlsState?.requestControlsLock) {
      sliderLockReleaseRef.current = controlsState.requestControlsLock();
    }
  }, [controlsState]);

  const releaseSliderLock = useCallback(() => {
    if (sliderLockReleaseRef.current) {
      sliderLockReleaseRef.current();
      sliderLockReleaseRef.current = null;
    }
  }, []);

  // Keyboard shortcuts wired to Video.js store
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const targetEl = e.target as HTMLElement | null;
      if (targetEl && ['INPUT', 'TEXTAREA', 'SELECT'].includes(targetEl.tagName)) {
        return;
      }
      if (targetEl && targetEl.tagName === 'BUTTON' && e.code === 'Space') {
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
          if (showInitialCover) return;
          e.preventDefault();
          toggleMute();
          break;
        case 'ArrowLeft':
        case 'KeyJ':
          if (showInitialCover) return;
          e.preventDefault();
          skipTime(-10);
          controlsState?.toggleControls(true);
          break;
        case 'ArrowRight':
        case 'KeyL':
          if (showInitialCover) return;
          e.preventDefault();
          skipTime(10);
          controlsState?.toggleControls(true);
          break;
        case 'ArrowUp':
          if (showInitialCover) return;
          e.preventDefault();
          {
            const newVol = Math.min(1, Number((volume + 0.1).toFixed(2)));
            if (volumeState?.setVolume) {
              volumeState.setVolume(newVol);
            } else {
              el.volume = newVol;
              el.muted = false;
            }
            controlsState?.toggleControls(true);
          }
          break;
        case 'ArrowDown':
          if (showInitialCover) return;
          e.preventDefault();
          {
            const newVol = Math.max(0, Number((volume - 0.1).toFixed(2)));
            if (volumeState?.setVolume) {
              volumeState.setVolume(newVol);
            } else {
              el.volume = newVol;
            }
            controlsState?.toggleControls(true);
          }
          break;
        case 'Escape':
          if (showSettingsMenu) {
            e.preventDefault();
            setShowSettingsMenu(false);
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    showInitialCover,
    togglePlay,
    toggleFullscreen,
    toggleMute,
    skipTime,
    volume,
    volumeState,
    controlsState,
    showSettingsMenu,
  ]);

  // Unified pointer tap/double-tap handler on Container (no duplicate click/touch handlers)
  const handleContainerPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (showInitialCover) {
      activePointerRef.current = null;
      return;
    }
    if (!e.isPrimary) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    if (isInteractiveEventTarget(e.target)) {
      activePointerRef.current = null;
      return;
    }

    activePointerRef.current = {
      pointerId: e.pointerId,
      pointerType: e.pointerType,
      startX: e.clientX,
      startY: e.clientY,
      startTime: Date.now(),
    };
  }, [showInitialCover]);

  const handleContainerPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (showInitialCover) {
        activePointerRef.current = null;
        return;
      }
      if (!e.isPrimary) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;

      const start = activePointerRef.current;
      activePointerRef.current = null;

      if (!start || start.pointerId !== e.pointerId) return;
      if (isInteractiveEventTarget(e.target)) return;

      const deltaX = Math.abs(e.clientX - start.startX);
      const deltaY = Math.abs(e.clientY - start.startY);
      const elapsed = Date.now() - start.startTime;

      // Ignore drags / vertical page scrolls / long presses
      if (deltaX > TAP_MAX_DISTANCE_PX || deltaY > TAP_MAX_DISTANCE_PX || elapsed > TAP_MAX_DURATION_MS) {
        return;
      }

      if (showSettingsMenu) {
        setShowSettingsMenu(false);
        controlsState?.toggleControls(true);
        return;
      }

      const now = Date.now();
      const prevTap = lastTapRef.current;
      const isDoubleTap =
        e.pointerType === 'touch' &&
        prevTap !== null &&
        now - prevTap.time < DOUBLE_TAP_WINDOW_MS &&
        Math.hypot(e.clientX - prevTap.x, e.clientY - prevTap.y) < DOUBLE_TAP_MAX_DISTANCE_PX;

      if (isDoubleTap) {
        lastTapRef.current = null;
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect || rect.width <= 0) return;
        const x = e.clientX - rect.left;
        const width = rect.width;

        if (x < width * 0.35) {
          skipTime(-10);
          setDoubleTapFeedback('left');
          if (doubleTapTimeoutRef.current) window.clearTimeout(doubleTapTimeoutRef.current);
          doubleTapTimeoutRef.current = window.setTimeout(() => setDoubleTapFeedback(null), 600);
          controlsState?.toggleControls(true);
        } else if (x > width * 0.65) {
          skipTime(10);
          setDoubleTapFeedback('right');
          if (doubleTapTimeoutRef.current) window.clearTimeout(doubleTapTimeoutRef.current);
          doubleTapTimeoutRef.current = window.setTimeout(() => setDoubleTapFeedback(null), 600);
          controlsState?.toggleControls(true);
        } else {
          toggleFullscreen();
        }
        return;
      }

      if (e.pointerType === 'touch') {
        lastTapRef.current = { time: now, x: e.clientX, y: e.clientY };
      } else {
        lastTapRef.current = null;
      }

      // Single tap toggles controls cleanly in both playing & paused states (never auto-plays)
      controlsState?.toggleControls();
    },
    [showInitialCover, showSettingsMenu, controlsState, skipTime, toggleFullscreen],
  );

  const handleContainerPointerCancel = useCallback(() => {
    activePointerRef.current = null;
  }, []);

  const handleContextMenu = useCallback((e: React.SyntheticEvent) => {
    e.preventDefault();
  }, []);

  useEffect(() => {
    const containerEl = containerRef.current;
    if (!containerEl) return;

    const suppressNativeContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };

    containerEl.addEventListener('contextmenu', suppressNativeContextMenu, { capture: true });
    return () => {
      containerEl.removeEventListener('contextmenu', suppressNativeContextMenu, { capture: true });
    };
  }, []);

  // Media callbacks forwarding Video.js <Video> events to Hikari progress/session tracking
  const handleTimeUpdate = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    const time = el.currentTime;
    const dur = (Number.isFinite(el.duration) && el.duration > 0 ? el.duration : 0) || video?.duration || 0;

    if (initialTimeRef.current && initialTimeRef.current > 0 && !initialTimeAppliedRef.current) {
      if (el.readyState >= 1) {
        applyInitialTime();
      }
      if (time < 1) return;
    }

    onTimeUpdateRef.current?.(time, dur);
  }, [video?.duration, applyInitialTime]);

  const handleLoadedMetadata = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    applySavedPlaybackRate(el);
    applyInitialTime();
    setVideoError(null);

    const dur = el.duration;
    const detected = classifyVideoResolution(el.videoHeight);

    if (onUpdateMetadataRef.current && video?.id) {
      const updates: VideoMetadataUpdates = {};
      if (dur && !Number.isNaN(dur) && Number.isFinite(dur) && dur > 0) {
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
  }, [applySavedPlaybackRate, applyInitialTime, video?.id]);

  const handlePlayEvent = useCallback(() => {
    setHasPlaybackStarted(true);
    onPlayRef.current?.();
  }, []);

  const handlePlayingEvent = useCallback(() => {
    setHasPlaybackStarted(true);
    onPlayingRef.current?.();
  }, []);

  const handlePauseEvent = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    const time = el.currentTime;
    const dur = (Number.isFinite(el.duration) && el.duration > 0 ? el.duration : 0) || video?.duration || 0;
    onPauseRef.current?.(time, dur);
  }, [video?.duration]);

  const handleWaitingEvent = useCallback(() => {
    onWaitingRef.current?.();
  }, []);

  const handleSeekingEvent = useCallback(() => {
    onSeekingRef.current?.();
  }, []);

  const handleSeekedEvent = useCallback(() => {
    onSeekedRef.current?.();
  }, []);

  const handleEndedEvent = useCallback(() => {
    onEndedRef.current?.();
  }, []);

  const handleMediaError = useCallback(() => {
    if (isTearingDownRef.current) return;
    // HLS streams manage errors via nativeErrorHandler or hls.js Events.ERROR
    if (isHls && (playbackEngineRef.current === 'native-hls' || playbackEngineRef.current === 'hlsjs')) {
      return;
    }

    const el = videoRef.current;
    const mediaErr = el?.error;
    const code = mediaErr?.code ?? 0;
    if (code === 1) return; // MEDIA_ERR_ABORTED

    const errState: PlayerErrorState = video?.isLocalFile
      ? {
          category: 'compat_decode',
          title: 'Erro na Decodificação Local',
          message: 'O navegador não conseguiu decodificar o arquivo local.',
          detail: mediaErr?.message || 'Formato local não suportado.',
        }
      : code === 2
        ? {
            category: 'segment',
            title: 'Erro de Rede na Reprodução',
            message: 'A conexão foi interrompida durante o carregamento do vídeo.',
            detail: mediaErr?.message || 'MEDIA_ERR_NETWORK',
          }
        : code === 3
          ? {
              category: 'compat_decode',
              title: 'Erro de Decodificação',
              message: 'O navegador não conseguiu decodificar o vídeo (MEDIA_ERR_DECODE).',
              detail: mediaErr?.message || 'Codec incompatível ou arquivo corrompido.',
            }
          : {
              category: 'cors_auth',
              title: 'Vídeo Indisponível',
              message: 'Não foi possível reproduzir este vídeo no momento (MEDIA_ERR_SRC_NOT_SUPPORTED).',
              detail: mediaErr?.message || 'A URL pode estar indisponível, expirada ou bloqueada.',
            };

    errorHls('ERROR', `Erro no elemento <video> (code=${code})`, {
      detail: errState.detail,
      url: sanitizeStreamUrl(effectiveVideoUrl),
    });
    setVideoError(errState);
    onErrorRef.current?.(errState.message);
  }, [isHls, video?.isLocalFile, effectiveVideoUrl]);

  const timelineTrackStyle = useMemo<React.CSSProperties>(
    () => ({
      background: `linear-gradient(to right, #a855f7 0%, #a855f7 ${progressPercent}%, rgba(255,255,255,0.28) ${progressPercent}%, rgba(255,255,255,0.28) ${bufferedPercent}%, rgba(255,255,255,0.16) ${bufferedPercent}%, rgba(255,255,255,0.16) 100%)`,
    }),
    [progressPercent, bufferedPercent],
  );

  const volumePercent = isMuted ? 0 : Math.round(volume * 100);
  const volumeTrackStyle = useMemo<React.CSSProperties>(
    () => ({
      background: `linear-gradient(to right, #a855f7 0%, #a855f7 ${volumePercent}%, rgba(255,255,255,0.22) ${volumePercent}%, rgba(255,255,255,0.22) 100%)`,
    }),
    [volumePercent],
  );

  if (isIframeMode && effectiveIframeUrl) {
    return (
      <div
        ref={containerRef}
        className={`hikari-video-player relative w-full aspect-video min-h-[240px] md:min-h-[520px] flex items-center justify-center select-none border border-white/10 shadow-[0_20px_70px_rgba(0,0,0,0.45)] outline-none rounded-2xl overflow-hidden bg-black ${className || ''}`}
      >
        <iframe
          src={effectiveIframeUrl}
          title={video?.title || 'Player do Provedor'}
          className="size-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
        <div className="absolute top-3 right-3 z-30 flex items-center gap-2">
          <button
            type="button"
            onClick={handleRetryHls}
            className="px-3 py-1.5 rounded-xl bg-black/80 hover:bg-black text-white text-xs font-medium backdrop-blur-md transition border border-white/20 flex items-center gap-1.5 shadow-lg cursor-pointer active:scale-95"
          >
            <RotateCcw className="w-3.5 h-3.5 text-purple-400" />
            Tentar Player Próprio (HLS)
          </button>
        </div>
      </div>
    );
  }

  return (
    <Container
      ref={containerRef}
      onPointerDown={handleContainerPointerDown}
      onPointerUp={handleContainerPointerUp}
      onPointerCancel={handleContainerPointerCancel}
      onContextMenu={handleContextMenu}
      data-controls={controlsVisible ? 'visible' : 'hidden'}
      data-paused={isPaused ? 'true' : 'false'}
      data-playing={isPlaying ? 'true' : 'false'}
      className={`hikari-video-player relative w-full aspect-video min-h-[240px] md:min-h-[520px] flex items-center justify-center select-none border border-white/10 shadow-[0_20px_70px_rgba(0,0,0,0.45)] outline-none focus-visible:outline-none ${className || ''}`}
    >
      {/* Sole <video> element owned by Video.js <Video> */}
      <div data-video-shell className="absolute inset-0 w-full h-full">
        <Video
          ref={videoRef}
          src={isHls ? undefined : effectiveVideoUrl || undefined}
          poster={effectivePosterUrl || undefined}
          controls={false}
          controlsList="nodownload nopictureinpicture"
          disablePictureInPicture
          playsInline
          autoPlay={autoPlay}
          onContextMenu={handleContextMenu}
          onPlay={handlePlayEvent}
          onPlaying={handlePlayingEvent}
          onPause={handlePauseEvent}
          onWaiting={handleWaitingEvent}
          onSeeking={handleSeekingEvent}
          onSeeked={handleSeekedEvent}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleEndedEvent}
          onError={handleMediaError}
          className="video-body-click w-full h-full object-contain bg-black cursor-pointer"
        />
      </div>

      {/* Initial Episode Cover Screen (stays paused until user clicks Play) */}
      {showInitialCover && (
        <div
          data-episode-cover="true"
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className="absolute inset-0 z-30 overflow-hidden bg-black flex items-center justify-center"
        >
          {effectivePosterUrl && !posterFailed ? (
            <img
              src={effectivePosterUrl}
              alt={video?.title || 'Capa do episódio'}
              onError={() => setPosterFailed(true)}
              loading="eager"
              decoding="async"
              draggable={false}
              className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
            />
          ) : (
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-br from-[#141024] via-[#0a0812] to-black pointer-events-none"
            />
          )}

          {/* Subtle gradient vignette for Play button contrast */}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/35 pointer-events-none"
          />

          <button
            type="button"
            data-controls-interactive="true"
            data-cover-play="true"
            onClick={handleStartFromCover}
            aria-label="Reproduzir episódio"
            className="relative z-10 w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-purple-600/90 hover:bg-purple-500 text-white border border-white/20 backdrop-blur-md flex items-center justify-center shadow-[0_12px_36px_rgba(168,85,247,0.45)] transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer outline-none focus-visible:outline-none"
          >
            <Play className="w-7 h-7 sm:w-9 sm:h-9 fill-current translate-x-0.5" />
          </button>
        </div>
      )}

      {/* Buffering spinner overlay */}
      {isBuffering && !videoError && !showInitialCover && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="w-12 h-12 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
        </div>
      )}

      {/* Double tap feedback indicators */}
      {doubleTapFeedback === 'left' && !showInitialCover && (
        <div className="absolute left-6 sm:left-10 top-1/2 -translate-y-1/2 z-30 bg-black/75 backdrop-blur-md px-3.5 py-2.5 rounded-2xl border border-white/10 flex items-center gap-2 text-white pointer-events-none shadow-xl">
          <RotateCcw className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" />
          <span className="text-xs sm:text-sm font-bold">-10s</span>
        </div>
      )}
      {doubleTapFeedback === 'right' && !showInitialCover && (
        <div className="absolute right-6 sm:right-10 top-1/2 -translate-y-1/2 z-30 bg-black/75 backdrop-blur-md px-3.5 py-2.5 rounded-2xl border border-white/10 flex items-center gap-2 text-white pointer-events-none shadow-xl">
          <span className="text-xs sm:text-sm font-bold">+10s</span>
          <RotateCw className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" />
        </div>
      )}

      {/* Top Close Button (optional) */}
      {onClose && !showInitialCover && (
        <button
          type="button"
          data-controls-interactive="true"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          aria-label="Voltar"
          className={`hikari-player-close-btn absolute top-4 left-4 z-30 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 active:scale-95 text-slate-200 hover:text-white flex items-center justify-center border border-white/10 backdrop-blur-md cursor-pointer shadow-lg ${
            controlsVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
        >
          <X className="w-5 h-5" />
        </button>
      )}

      {/* Nova Stream Controls Overlay (zero dark scrim over video frame so image brightness stays identical) */}
      {!showInitialCover && (
      <div
        data-controls-overlay={controlsVisible ? 'visible' : 'hidden'}
        className={`absolute inset-0 flex flex-col justify-end p-2.5 sm:p-4 pt-6 transition-opacity duration-200 z-30 pointer-events-none ${
          controlsVisible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Center Big Play Button when paused and controls visible */}
        <div className="flex-1 flex items-center justify-center pointer-events-none">
          {isPaused && !videoError && (
            <button
              type="button"
              data-controls-interactive="true"
              tabIndex={controlsVisible ? 0 : -1}
              onClick={(e) => {
                e.stopPropagation();
                togglePlay();
              }}
              className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-purple-600/90 hover:bg-purple-600 text-white flex items-center justify-center shadow-2xl backdrop-blur-sm cursor-pointer transition-transform hover:scale-105 active:scale-95 ${
                controlsVisible ? 'pointer-events-auto' : 'pointer-events-none'
              }`}
              aria-label="Reproduzir"
            >
              <Play className="w-7 h-7 sm:w-8 sm:h-8 fill-current translate-x-0.5" />
            </button>
          )}
        </div>

        {/* Bottom Control Bar */}
        <div
          data-controls-interactive="true"
          onClick={(e) => e.stopPropagation()}
          className={`flex flex-col gap-1.5 sm:gap-2 w-full bg-[#0c0a14]/75 backdrop-blur-md p-2.5 sm:p-3 rounded-xl border border-white/10 relative shadow-xl ${
            controlsVisible ? 'pointer-events-auto' : 'pointer-events-none'
          }`}
        >
          {/* Timeline progress bar */}
          <div className="flex items-center gap-3">
            <input
              type="range"
              aria-label="Progresso do vídeo"
              min={0}
              max={duration > 0 ? duration : 100}
              step={0.1}
              value={duration > 0 ? Math.min(currentTime, duration) : 0}
              style={timelineTrackStyle}
              onPointerDown={acquireSliderLock}
              onPointerUp={releaseSliderLock}
              onPointerCancel={releaseSliderLock}
              onBlur={releaseSliderLock}
              onChange={handleSeekChange}
              className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-purple-500 hover:h-2 transition-all"
            />
          </div>

          <div className="flex items-center justify-between text-xs text-slate-300 font-medium">
            {/* Left controls: Play/Pause, Volume, Time */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <button
                type="button"
                data-controls-interactive="true"
                tabIndex={controlsVisible ? 0 : -1}
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlay();
                }}
                aria-label={isPlaying ? 'Pausar' : 'Reproduzir'}
                className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-white transition-colors cursor-pointer shrink-0"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
              </button>

              <div className="flex items-center gap-1.5 sm:gap-2 group/vol relative shrink-0">
                <button
                  type="button"
                  data-controls-interactive="true"
                  tabIndex={controlsVisible ? 0 : -1}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleMute();
                  }}
                  aria-label={isMuted || volume === 0 ? 'Ativar som' : 'Silenciar'}
                  className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-white transition-colors cursor-pointer"
                >
                  {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <input
                  type="range"
                  aria-label="Volume"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  style={volumeTrackStyle}
                  onPointerDown={acquireSliderLock}
                  onPointerUp={releaseSliderLock}
                  onPointerCancel={releaseSliderLock}
                  onBlur={releaseSliderLock}
                  onChange={handleVolumeChange}
                  className="w-16 h-1 rounded-lg appearance-none cursor-pointer accent-purple-500 hidden sm:group-hover/vol:block sm:focus-within/vol:block transition-all"
                />
              </div>

              <div className="tabular-nums text-[11px] sm:text-xs whitespace-nowrap">
                {formatDuration(currentTime)} / {formatDuration(duration)}
              </div>
            </div>

            {/* Right controls: Speed Menu, Fullscreen */}
            <div className="flex items-center gap-1.5 sm:gap-2 relative shrink-0">
              <div className="relative">
                <button
                  type="button"
                  data-controls-interactive="true"
                  tabIndex={controlsVisible ? 0 : -1}
                  aria-expanded={showSettingsMenu}
                  aria-haspopup="menu"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSettingsMenu((prev) => !prev);
                  }}
                  aria-label="Velocidade de reprodução"
                  className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-slate-200 hover:text-white transition-colors cursor-pointer"
                >
                  <Settings className="w-4 h-4" />
                </button>

                {/* Compact Speed Menu (direct selection, no title, fits small mobile players) */}
                {showSettingsMenu && (
                  <div
                    role="menu"
                    aria-label="Velocidade"
                    data-controls-interactive="true"
                    onClick={(e) => e.stopPropagation()}
                    className="absolute bottom-full right-0 mb-2 w-24 sm:w-28 bg-[#161424]/95 border border-purple-500/35 rounded-xl shadow-2xl p-1 z-50 backdrop-blur-xl text-slate-200 max-h-32 sm:max-h-52 overflow-y-auto custom-scrollbar"
                  >
                    <div className="flex flex-col gap-0.5">
                      {SPEED_OPTIONS.map((spd) => (
                        <button
                          key={spd}
                          type="button"
                          role="menuitemradio"
                          aria-checked={playbackSpeed === spd}
                          data-controls-interactive="true"
                          onClick={(e) => {
                            e.stopPropagation();
                            changeSpeed(spd);
                          }}
                          className={`w-full px-2.5 py-1.5 text-left text-xs rounded-lg transition-colors flex items-center justify-between cursor-pointer ${
                            playbackSpeed === spd
                              ? 'bg-purple-600/35 text-purple-200 font-semibold'
                              : 'text-slate-300 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <span>{spd}x</span>
                          {playbackSpeed === spd && <Check className="w-3 h-3 text-purple-400 shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                data-controls-interactive="true"
                tabIndex={controlsVisible ? 0 : -1}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFullscreen();
                }}
                aria-label={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
                className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-white transition-colors cursor-pointer"
              >
                {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Error fallback screen */}
      {videoError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#08070d]/95 p-6 text-center z-40">
          <div className="w-12 h-12 rounded-full bg-purple-950/80 border border-purple-700/50 flex items-center justify-center text-purple-400 mb-3">
            <Info className="w-6 h-6" />
          </div>
          <h4 className="text-base font-semibold text-white mb-1">
            {videoError.title}
          </h4>
          {videoError.proxyReason && (
            <p
              data-proxy-error-reason="true"
              className="text-[11px] font-mono text-purple-200/80 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1 max-w-md mb-2 break-all leading-relaxed"
            >
              {videoError.proxyReason}
            </p>
          )}
          <p className="text-xs text-slate-300 max-w-md mb-2 leading-relaxed">{videoError.message}</p>
          <p className="text-[11px] text-slate-400 max-w-md mb-5 leading-relaxed">
            {videoError.detail}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            {effectiveIframeUrl && (
              <button
                type="button"
                data-controls-interactive="true"
                onClick={handleSwitchToIframe}
                className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-purple-600/30 transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
              >
                <Play className="w-4 h-4 fill-current" />
                Assistir no Player do Provedor (Iframe)
              </button>
            )}

            <button
              type="button"
              data-controls-interactive="true"
              onClick={handleRetryHls}
              className="px-3.5 py-2.5 bg-white/10 hover:bg-white/15 text-white/90 rounded-xl text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 active:scale-95"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Tentar Novamente (HLS)
            </button>

            {onClose && (
              <button
                type="button"
                data-controls-interactive="true"
                onClick={onClose}
                className="px-3.5 py-2.5 bg-transparent hover:bg-white/5 text-white/60 hover:text-white rounded-xl text-xs font-medium transition-colors cursor-pointer"
              >
                Voltar para a Biblioteca
              </button>
            )}
          </div>
        </div>
      )}
    </Container>
  );
};

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
  iframeFallbackUrl,
  onFallbackToIframe,
}) => {
  const effectiveVideoUrl = useMemo(() => {
    if (!video) return '';
    if (video.isLocalFile) {
      return (getLocalVideoUrl(video.id) || video.videoUrl || video.url || '').trim();
    }
    const raw = (video.videoUrl || video.url || '').trim();
    return resolveHlsPlaybackUrl(raw);
  }, [video]);

  const effectivePosterUrl = video?.posterUrl || video?.thumbnailUrl || '';

  const isHls = useMemo(() => isHlsStreamUrl(effectiveVideoUrl), [effectiveVideoUrl]);

  return (
    <HikariVideoPlayerRoot>
      <HikariPlayerSurface
        video={video}
        effectiveVideoUrl={effectiveVideoUrl}
        effectivePosterUrl={effectivePosterUrl}
        isHls={isHls}
        autoPlay={autoPlay}
        initialTime={initialTime}
        onClose={onClose}
        onUpdateMetadata={onUpdateMetadata}
        onPlay={onPlay}
        onPlaying={onPlaying}
        onSeeking={onSeeking}
        onSeeked={onSeeked}
        onWaiting={onWaiting}
        onTimeUpdate={onTimeUpdate}
        onPause={onPause}
        onRestored={onRestored}
        onEnded={onEnded}
        onError={onError}
        className={className}
        iframeFallbackUrl={iframeFallbackUrl}
        onFallbackToIframe={onFallbackToIframe}
      />
    </HikariVideoPlayerRoot>
  );
};

export default CustomVideoPlayer;
