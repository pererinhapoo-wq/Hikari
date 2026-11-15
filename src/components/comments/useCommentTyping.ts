import { useCallback, useEffect, useRef, useState } from "react";
import { getBearerToken } from "@/lib/auth/client";

const HEARTBEAT_INTERVAL_MS = 1800;
const INACTIVITY_STOP_MS = 2800;
const MIN_LOCAL_EXPIRY_MS = 1200;

interface TypingStreamPayload {
  isTyping?: boolean;
  typingCount?: number;
  expiresInMs?: number;
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
}: {
  animeId: string;
  episodeId: string;
  viewerUserId: string | null;
}) {
  const [remoteTyping, setRemoteTyping] = useState(false);
  const [remoteTypingCount, setRemoteTypingCount] = useState(0);

  const isLocallyTypingRef = useRef(false);
  const lastSentAtRef = useRef(0);
  const inactivityTimerRef = useRef<number | null>(null);
  const remoteExpiryTimerRef = useRef<number | null>(null);
  const roomRef = useRef({ animeId, episodeId, viewerUserId });
  roomRef.current = { animeId, episodeId, viewerUserId };

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

  const postTypingStatus = useCallback(
    (
      targetAnimeId: string,
      targetEpisodeId: string,
      active: boolean,
      keepalive = false,
    ) => {
      if (typeof window === "undefined" || !targetAnimeId) return;

      void fetch("/api/comments/typing", {
        method: "POST",
        credentials: "include",
        keepalive,
        headers: buildAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          animeId: targetAnimeId,
          episodeId: targetEpisodeId,
          active,
        }),
      }).catch(() => {
        // Ignore transient network errors for ephemeral typing state
      });
    },
    [],
  );

  const stopTypingNow = useCallback(() => {
    clearInactivityTimer();
    if (!isLocallyTypingRef.current) return;

    isLocallyTypingRef.current = false;
    lastSentAtRef.current = 0;

    const { animeId: curAnimeId, episodeId: curEpisodeId, viewerUserId: curUid } =
      roomRef.current;
    if (curUid && curAnimeId) {
      postTypingStatus(curAnimeId, curEpisodeId, false, true);
    }
  }, [clearInactivityTimer, postTypingStatus]);

  const notifyTypingInput = useCallback(
    (hasNonEmptyText: boolean) => {
      const { animeId: curAnimeId, episodeId: curEpisodeId, viewerUserId: curUid } =
        roomRef.current;

      if (!curUid || !curAnimeId) return;

      if (!hasNonEmptyText) {
        stopTypingNow();
        return;
      }

      clearInactivityTimer();
      inactivityTimerRef.current = window.setTimeout(() => {
        inactivityTimerRef.current = null;
        stopTypingNow();
      }, INACTIVITY_STOP_MS);

      const now = Date.now();
      if (
        !isLocallyTypingRef.current ||
        now - lastSentAtRef.current >= HEARTBEAT_INTERVAL_MS
      ) {
        isLocallyTypingRef.current = true;
        lastSentAtRef.current = now;
        postTypingStatus(curAnimeId, curEpisodeId, true, false);
      }
    },
    [clearInactivityTimer, postTypingStatus, stopTypingNow],
  );

  // Real-time SSE subscription for remote users typing in this (animeId, episodeId) room
  useEffect(() => {
    if (typeof window === "undefined" || !animeId || !episodeId) {
      setRemoteTyping(false);
      setRemoteTypingCount(0);
      return;
    }

    let cancelled = false;
    let abortController: AbortController | null = null;
    let reconnectTimer: number | null = null;
    let retryAttempt = 0;

    setRemoteTyping(false);
    setRemoteTypingCount(0);
    clearRemoteExpiryTimer();

    const applyTypingPayload = (payload: TypingStreamPayload) => {
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

    const connect = async () => {
      if (cancelled) return;

      abortController?.abort();
      const controller = new AbortController();
      abortController = controller;

      try {
        const params = new URLSearchParams({
          animeId,
          episodeId,
          stream: "1",
        });

        const response = await fetch(`/api/comments/typing?${params.toString()}`, {
          method: "GET",
          credentials: "include",
          headers: buildAuthHeaders({ Accept: "text/event-stream" }),
          signal: controller.signal,
          cache: "no-store",
        });

        if (!response.ok || !response.body) {
          throw new Error(`SSE status ${response.status}`);
        }

        retryAttempt = 0;
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (!cancelled && !controller.signal.aborted) {
          const { value, done } = await reader.read();
          if (done) break;
          if (!value) continue;

          buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");

          let boundary = buffer.indexOf("\n\n");
          while (boundary !== -1) {
            const rawFrame = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);
            boundary = buffer.indexOf("\n\n");

            if (!rawFrame.trim()) continue;

            let eventType = "message";
            const dataLines: string[] = [];

            for (const line of rawFrame.split("\n")) {
              if (line.startsWith(":")) continue;
              if (line.startsWith("event:")) {
                eventType = line.slice(6).trim();
              } else if (line.startsWith("data:")) {
                dataLines.push(line.slice(5).trim());
              }
            }

            if (eventType === "typing" && dataLines.length > 0) {
              try {
                const parsed = JSON.parse(dataLines.join("\n")) as TypingStreamPayload;
                applyTypingPayload(parsed);
              } catch {
                // Ignore malformed frame
              }
            }
          }
        }
      } catch (err) {
        if (
          cancelled ||
          controller.signal.aborted ||
          (err instanceof DOMException && err.name === "AbortError")
        ) {
          return;
        }
      }

      if (!cancelled) {
        const delayMs = Math.min(3000, 600 * 2 ** retryAttempt) + Math.floor(Math.random() * 250);
        retryAttempt = Math.min(retryAttempt + 1, 4);
        reconnectTimer = window.setTimeout(() => {
          reconnectTimer = null;
          void connect();
        }, delayMs);
      }
    };

    void connect();

    const handleVisibilityOrPageHide = () => {
      if (document.visibilityState === "hidden") {
        stopTypingNow();
      }
    };

    const handlePageHide = () => {
      stopTypingNow();
    };

    document.addEventListener("visibilitychange", handleVisibilityOrPageHide);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      cancelled = true;
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      abortController?.abort();
      clearRemoteExpiryTimer();
      clearInactivityTimer();
      document.removeEventListener("visibilitychange", handleVisibilityOrPageHide);
      window.removeEventListener("pagehide", handlePageHide);

      if (isLocallyTypingRef.current) {
        isLocallyTypingRef.current = false;
        lastSentAtRef.current = 0;
        if (viewerUserId && animeId) {
          postTypingStatus(animeId, episodeId, false, true);
        }
      }
    };
  }, [
    animeId,
    episodeId,
    viewerUserId,
    clearInactivityTimer,
    clearRemoteExpiryTimer,
    postTypingStatus,
    stopTypingNow,
  ]);

  return {
    remoteTyping,
    remoteTypingCount,
    notifyTypingInput,
    stopTypingNow,
  };
}
