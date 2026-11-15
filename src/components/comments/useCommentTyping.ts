import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { getBearerToken } from "@/lib/auth/client";

const POLL_INTERVAL_MS = 2500;
const MAX_POLL_BACKOFF_MS = 15000;
const HEARTBEAT_INTERVAL_MS = 1800;
const INACTIVITY_STOP_MS = 2800;
const MIN_LOCAL_EXPIRY_MS = 1200;

interface TypingViewPayload {
  isTyping?: boolean;
  typingCount?: number;
  expiresInMs?: number;
}

interface TypingPostJob {
  animeId: string;
  episodeId: string;
  active: boolean;
  keepalive: boolean;
}

export interface UseCommentTypingOptions {
  animeId: string;
  episodeId: string;
  viewerUserId: string | null;
  sessionReady?: boolean;
  containerRef?: RefObject<HTMLElement | null>;
  enabled?: boolean;
}

function buildAuthHeaders(extra?: Record<string, string>): Record<string, string> {
  const bearer = getBearerToken();
  return {
    ...(extra ?? {}),
    ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
  };
}

export function useCommentTyping({
  animeId,
  episodeId,
  viewerUserId,
  sessionReady = true,
  containerRef,
  enabled = true,
}: UseCommentTypingOptions) {
  const trimmedAnimeId = animeId.trim();
  const trimmedEpisodeId = episodeId.trim();

  const [remoteTyping, setRemoteTyping] = useState(false);
  const [remoteTypingCount, setRemoteTypingCount] = useState(0);
  const [isTabVisible, setIsTabVisible] = useState(() =>
    typeof document === "undefined" ? true : document.visibilityState === "visible",
  );
  const [isSectionVisible, setIsSectionVisible] = useState(() => {
    if (!containerRef) return true;
    if (typeof window === "undefined") return false;
    return !("IntersectionObserver" in window);
  });

  const isLocallyTypingRef = useRef(false);
  const lastSentAtRef = useRef(0);
  const authRejectedRef = useRef(false);
  const inactivityTimerRef = useRef<number | null>(null);
  const remoteExpiryTimerRef = useRef<number | null>(null);
  const pendingPostRef = useRef<TypingPostJob | null>(null);
  const postInFlightRef = useRef(false);
  const postAbortRef = useRef<AbortController | null>(null);

  const contextRef = useRef({
    animeId: trimmedAnimeId,
    episodeId: trimmedEpisodeId,
    viewerUserId,
    enabled,
  });
  contextRef.current = {
    animeId: trimmedAnimeId,
    episodeId: trimmedEpisodeId,
    viewerUserId,
    enabled,
  };

  // Reset 401 lock when the authenticated user changes
  useEffect(() => {
    authRejectedRef.current = false;
  }, [viewerUserId]);

  const clearRemoteExpiryTimer = useCallback(() => {
    if (remoteExpiryTimerRef.current !== null) {
      window.clearTimeout(remoteExpiryTimerRef.current);
      remoteExpiryTimerRef.current = null;
    }
  }, []);

  const clearInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current !== null) {
      window.clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
  }, []);

  const sendKeepaliveStop = useCallback(
    (targetAnimeId: string, targetEpisodeId: string) => {
      if (typeof window === "undefined" || !targetAnimeId || !targetEpisodeId) return;

      pendingPostRef.current = null;
      postAbortRef.current?.abort();
      postAbortRef.current = null;

      void fetch("/api/comments/typing", {
        method: "POST",
        credentials: "include",
        keepalive: true,
        cache: "no-store",
        headers: buildAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          animeId: targetAnimeId,
          episodeId: targetEpisodeId,
          active: false,
        }),
      }).catch(() => {
        // Ignore transient network errors on unload/hide
      });
    },
    [],
  );

  const drainPostQueue = useCallback(async () => {
    if (typeof window === "undefined" || postInFlightRef.current) return;

    postInFlightRef.current = true;
    try {
      while (pendingPostRef.current) {
        const job = pendingPostRef.current;
        pendingPostRef.current = null;

        if (!job.animeId || !job.episodeId) continue;
        if (job.active && authRejectedRef.current) continue;

        const controller = new AbortController();
        postAbortRef.current = controller;

        try {
          const response = await fetch("/api/comments/typing", {
            method: "POST",
            credentials: "include",
            keepalive: job.keepalive,
            cache: "no-store",
            headers: buildAuthHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify({
              animeId: job.animeId,
              episodeId: job.episodeId,
              active: job.active,
            }),
            signal: job.keepalive ? undefined : controller.signal,
          });

          if (postAbortRef.current === controller) {
            postAbortRef.current = null;
          }

          if (response.status === 401) {
            authRejectedRef.current = true;
            isLocallyTypingRef.current = false;
            lastSentAtRef.current = 0;
            clearInactivityTimer();
            if (job.active) {
              continue;
            }
          } else if (!response.ok && job.active) {
            // Allow retry on subsequent keystrokes or heartbeats after 5xx/4xx
            isLocallyTypingRef.current = false;
            lastSentAtRef.current = 0;
          }
        } catch (err) {
          if (postAbortRef.current === controller) {
            postAbortRef.current = null;
          }
          const isAbort = err instanceof DOMException && err.name === "AbortError";
          if (!isAbort && job.active) {
            isLocallyTypingRef.current = false;
            lastSentAtRef.current = 0;
          }
        }
      }
    } finally {
      postInFlightRef.current = false;
    }
  }, [clearInactivityTimer]);

  const enqueueTypingPost = useCallback(
    (
      targetAnimeId: string,
      targetEpisodeId: string,
      active: boolean,
      keepalive = false,
    ) => {
      if (typeof window === "undefined" || !targetAnimeId || !targetEpisodeId) return;

      if (!active && keepalive) {
        sendKeepaliveStop(targetAnimeId, targetEpisodeId);
        return;
      }

      // If user stopped typing while an `active: true` request is in flight,
      // abort the superseded start/heartbeat so `active: false` executes next cleanly.
      if (!active && postInFlightRef.current && postAbortRef.current) {
        postAbortRef.current.abort();
      }

      pendingPostRef.current = {
        animeId: targetAnimeId,
        episodeId: targetEpisodeId,
        active,
        keepalive,
      };
      void drainPostQueue();
    },
    [drainPostQueue, sendKeepaliveStop],
  );

  const stopTypingNow = useCallback(
    (useKeepalive = false) => {
      clearInactivityTimer();
      if (!isLocallyTypingRef.current) {
        // Also cancel any queued `active: true` not yet flushed
        if (pendingPostRef.current?.active) {
          pendingPostRef.current = null;
        }
        return;
      }

      isLocallyTypingRef.current = false;
      lastSentAtRef.current = 0;

      const {
        animeId: curAnimeId,
        episodeId: curEpisodeId,
        viewerUserId: curUid,
      } = contextRef.current;

      if (curUid && curAnimeId && curEpisodeId) {
        enqueueTypingPost(curAnimeId, curEpisodeId, false, useKeepalive === true);
      }
    },
    [clearInactivityTimer, enqueueTypingPost],
  );

  const notifyTypingInput = useCallback(
    (hasNonEmptyText: boolean) => {
      const {
        animeId: curAnimeId,
        episodeId: curEpisodeId,
        viewerUserId: curUid,
        enabled: curEnabled,
      } = contextRef.current;

      if (!hasNonEmptyText) {
        stopTypingNow(false);
        return;
      }

      if (!curEnabled || !curUid || !curAnimeId || !curEpisodeId || authRejectedRef.current) {
        return;
      }

      clearInactivityTimer();
      inactivityTimerRef.current = window.setTimeout(() => {
        inactivityTimerRef.current = null;
        stopTypingNow(false);
      }, INACTIVITY_STOP_MS);

      const now = Date.now();
      if (
        !isLocallyTypingRef.current ||
        now - lastSentAtRef.current >= HEARTBEAT_INTERVAL_MS
      ) {
        isLocallyTypingRef.current = true;
        lastSentAtRef.current = now;
        enqueueTypingPost(curAnimeId, curEpisodeId, true, false);
      }
    },
    [clearInactivityTimer, enqueueTypingPost, stopTypingNow],
  );

  // Track browser tab visibility and page exit
  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    const syncVisibility = () => {
      const visible = document.visibilityState === "visible";
      setIsTabVisible(visible);
      if (!visible) {
        stopTypingNow(true);
      }
    };

    const handlePageHide = () => {
      stopTypingNow(true);
    };

    syncVisibility();
    document.addEventListener("visibilitychange", syncVisibility);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      document.removeEventListener("visibilitychange", syncVisibility);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [stopTypingNow]);

  // Track whether the comments section is inside the visible viewport
  useEffect(() => {
    if (!containerRef) {
      setIsSectionVisible(true);
      return;
    }

    if (typeof window === "undefined") {
      setIsSectionVisible(false);
      return;
    }

    const target = containerRef.current;
    if (!target) {
      setIsSectionVisible(false);
      return;
    }

    if (!("IntersectionObserver" in window)) {
      setIsSectionVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        setIsSectionVisible(entry.isIntersecting);
      },
      {
        root: null,
        rootMargin: "0px",
        threshold: 0,
      },
    );

    observer.observe(target);
    return () => {
      observer.disconnect();
    };
  }, [containerRef, enabled, trimmedAnimeId, trimmedEpisodeId]);

  // Reset typing view immediately on room switch/disable, and stop active typing on unmount or room switch
  useEffect(() => {
    setRemoteTyping(false);
    setRemoteTypingCount(0);
    clearRemoteExpiryTimer();

    return () => {
      clearInactivityTimer();
      clearRemoteExpiryTimer();
      pendingPostRef.current = null;
      if (isLocallyTypingRef.current) {
        isLocallyTypingRef.current = false;
        lastSentAtRef.current = 0;
        if (viewerUserId && trimmedAnimeId && trimmedEpisodeId) {
          sendKeepaliveStop(trimmedAnimeId, trimmedEpisodeId);
        }
      }
    };
  }, [
    trimmedAnimeId,
    trimmedEpisodeId,
    viewerUserId,
    enabled,
    clearInactivityTimer,
    clearRemoteExpiryTimer,
    sendKeepaliveStop,
  ]);

  // Adaptive HTTP polling: only runs when comments are enabled, session is ready, tab is foreground, and section is visible
  const shouldPoll =
    typeof window !== "undefined" &&
    enabled &&
    sessionReady &&
    Boolean(trimmedAnimeId && trimmedEpisodeId) &&
    isTabVisible &&
    isSectionVisible;

  useEffect(() => {
    if (!shouldPoll) {
      return;
    }

    let cancelled = false;
    let pollTimer: number | null = null;
    let activeController: AbortController | null = null;
    let consecutiveErrors = 0;

    const clearPollTimer = () => {
      if (pollTimer !== null) {
        window.clearTimeout(pollTimer);
        pollTimer = null;
      }
    };

    const scheduleNext = (delayMs: number) => {
      clearPollTimer();
      if (cancelled) return;
      pollTimer = window.setTimeout(() => {
        pollTimer = null;
        void pollOnce();
      }, delayMs);
    };

    const applyTypingPayload = (payload: TypingViewPayload) => {
      if (cancelled) return;
      clearRemoteExpiryTimer();

      const active = Boolean(payload?.isTyping);
      const count = active ? Math.max(1, Number(payload?.typingCount) || 1) : 0;

      setRemoteTyping(active);
      setRemoteTypingCount(count);

      if (active) {
        const expiresInMs = Math.max(
          MIN_LOCAL_EXPIRY_MS,
          (Number(payload?.expiresInMs) || 4500) + 300,
        );
        remoteExpiryTimerRef.current = window.setTimeout(() => {
          remoteExpiryTimerRef.current = null;
          if (!cancelled) {
            setRemoteTyping(false);
            setRemoteTypingCount(0);
          }
        }, expiresInMs);
      }
    };

    const pollOnce = async () => {
      if (cancelled) return;

      activeController?.abort();
      const controller = new AbortController();
      activeController = controller;

      try {
        const params = new URLSearchParams({
          animeId: trimmedAnimeId,
          episodeId: trimmedEpisodeId,
        });

        const response = await fetch(`/api/comments/typing?${params.toString()}`, {
          method: "GET",
          credentials: "include",
          headers: buildAuthHeaders({ Accept: "application/json" }),
          signal: controller.signal,
          cache: "no-store",
        });

        if (cancelled || controller.signal.aborted) return;

        if (response.status === 401 || response.status === 403) {
          clearRemoteExpiryTimer();
          setRemoteTyping(false);
          setRemoteTypingCount(0);
          consecutiveErrors = Math.min(consecutiveErrors + 1, 3);
          scheduleNext(Math.min(MAX_POLL_BACKOFF_MS, POLL_INTERVAL_MS * 2));
          return;
        }

        if (!response.ok) {
          consecutiveErrors = Math.min(consecutiveErrors + 1, 3);
          const backoffMs = Math.min(
            MAX_POLL_BACKOFF_MS,
            POLL_INTERVAL_MS * 2 ** consecutiveErrors,
          );
          scheduleNext(backoffMs);
          return;
        }

        const payload = (await response.json()) as TypingViewPayload;
        if (cancelled || controller.signal.aborted) return;

        consecutiveErrors = 0;
        applyTypingPayload(payload);
        scheduleNext(POLL_INTERVAL_MS);
      } catch (err) {
        if (
          cancelled ||
          controller.signal.aborted ||
          (err instanceof DOMException && err.name === "AbortError")
        ) {
          return;
        }

        consecutiveErrors = Math.min(consecutiveErrors + 1, 3);
        const backoffMs = Math.min(
          MAX_POLL_BACKOFF_MS,
          POLL_INTERVAL_MS * 2 ** consecutiveErrors,
        );
        scheduleNext(backoffMs);
      }
    };

    void pollOnce();

    return () => {
      cancelled = true;
      clearPollTimer();
      activeController?.abort();
      activeController = null;
    };
  }, [
    shouldPoll,
    trimmedAnimeId,
    trimmedEpisodeId,
    viewerUserId,
    clearRemoteExpiryTimer,
  ]);

  return {
    remoteTyping,
    remoteTypingCount,
    notifyTypingInput,
    stopTypingNow,
  };
}
