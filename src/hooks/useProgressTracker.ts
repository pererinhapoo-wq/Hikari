import { useEffect, useRef } from "react";

export interface UseProgressTrackerProps {
  episodeId: string;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onRestored?: (position: number) => void;
}

type ProgressEventType = "interval" | "pause" | "seek" | "hide";

function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    let sess = sessionStorage.getItem("hikari:sess");
    if (!sess) {
      sess =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
      sessionStorage.setItem("hikari:sess", sess);
    }
    return sess;
  } catch {
    return "anon-session";
  }
}

function isValidProgressSample(currentTime: number, duration: number): boolean {
  return (
    typeof currentTime === "number" &&
    Number.isFinite(currentTime) &&
    currentTime >= 3 &&
    typeof duration === "number" &&
    Number.isFinite(duration) &&
    duration > 0
  );
}

export function useProgressTracker({
  episodeId,
  videoRef,
  onRestored,
}: UseProgressTrackerProps) {
  const lastSentPos = useRef<number>(0);
  const lastSentAt = useRef<number>(0);
  const sessionId = useRef<string>("");
  const inFlight = useRef<boolean>(false);

  const hasAppliedResume = useRef<boolean>(false);
  const isRestoringSeek = useRef<boolean>(false);
  const shouldSendInterval = useRef<boolean>(false);
  const onRestoredRef = useRef(onRestored);
  onRestoredRef.current = onRestored;

  if (!sessionId.current && typeof window !== "undefined") {
    sessionId.current = getOrCreateSessionId();
  }

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !episodeId) return;

    lastSentPos.current = 0;
    lastSentAt.current = Date.now();
    inFlight.current = false;
    hasAppliedResume.current = false;
    isRestoringSeek.current = false;
    shouldSendInterval.current = false;

    if (!sessionId.current) {
      sessionId.current = getOrCreateSessionId();
    }

    const sendProgress = (event: ProgressEventType, preferBeacon = false) => {
      const videoEl = videoRef.current;
      if (!videoEl || !episodeId) return;

      // Apenas envios periódicos de intervalo respeitam inFlight;
      // eventos pontuais (pause, seek, hide) devem disparar imediatamente.
      if (event === "interval" && inFlight.current) return;

      const currentTime = videoEl.currentTime;
      const duration = videoEl.duration;

      // Nunca enviar com currentTime < 3s ou duration desconhecida
      if (!isValidProgressSample(currentTime, duration)) {
        return;
      }

      const pos = Math.floor(currentTime);
      const dur = Math.floor(duration);
      const now = Date.now();

      // Ao enviar, atualizar lastSentPos e lastSentAt antes da chamada, para não duplicar.
      lastSentPos.current = pos;
      lastSentAt.current = now;
      shouldSendInterval.current = false;

      if (!sessionId.current) {
        sessionId.current = getOrCreateSessionId();
      }

      const payload = JSON.stringify({
        episodeId,
        position: pos,
        duration: dur,
        sessionId: sessionId.current,
        event,
      });

      if (
        preferBeacon &&
        typeof navigator !== "undefined" &&
        typeof navigator.sendBeacon === "function"
      ) {
        try {
          const blob = new Blob([payload], { type: "application/json" });
          const sent = navigator.sendBeacon("/api/progress", blob);
          if (!sent) {
            lastSentAt.current = Date.now() + 30000;
          }
          return;
        } catch {
          // fallback para fetch keepalive
        }
      }

      const trackInFlight = event === "interval";
      if (trackInFlight) {
        inFlight.current = true;
      }

      fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      })
        .then((res) => {
          if (!res.ok && res.status !== 204 && res.status !== 202) {
            lastSentAt.current = Date.now() + 30000;
          }
        })
        .catch(() => {
          // Em falha: não repetir na hora. Marcar lastSentAt = now + 30000 para esfriar 30s.
          lastSentAt.current = Date.now() + 30000;
        })
        .finally(() => {
          if (trackInFlight) {
            inFlight.current = false;
          }
        });
    };

    // 4. LEITURA: ler posição inicial do Redis / Postgres após loadedmetadata, sem bloquear o 1º frame
    const handleLoadedMetadata = () => {
      if (hasAppliedResume.current) return;
      hasAppliedResume.current = true;

      if (!sessionId.current) {
        sessionId.current = getOrCreateSessionId();
      }

      fetch(
        `/api/progress?episodeId=${encodeURIComponent(episodeId)}&sessionId=${encodeURIComponent(sessionId.current)}`,
      )
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { position?: number; duration?: number } | null) => {
          const videoEl = videoRef.current;
          if (!videoEl || !data || typeof data.position !== "number" || data.position <= 0) {
            return;
          }

          const dur = videoEl.duration;
          const target =
            typeof dur === "number" && Number.isFinite(dur) && dur > 0
              ? Math.min(data.position, Math.max(0, dur - 1))
              : data.position;

          if (Math.abs(videoEl.currentTime - target) > 10) {
            isRestoringSeek.current = true;
            videoEl.currentTime = target;
            lastSentPos.current = Math.floor(target);
            onRestoredRef.current?.(target);
          }
        })
        .catch(() => {
          // Fail-open: inicia do zero
        });
    };

    // Em timeupdate: só avaliar. Nunca enviar direto.
    const handleTimeUpdate = () => {
      const currentTime = el.currentTime;
      const duration = el.duration;
      if (!isValidProgressSample(currentTime, duration)) {
        shouldSendInterval.current = false;
        return;
      }

      const now = Date.now();
      shouldSendInterval.current =
        now - lastSentAt.current >= 15000 &&
        Math.abs(currentTime - lastSentPos.current) >= 10;
    };

    // Despacha o envio periódico fora do handler de timeupdate
    const intervalTimer = window.setInterval(() => {
      if (!shouldSendInterval.current) return;
      const videoEl = videoRef.current;
      if (!videoEl || videoEl.paused || videoEl.ended) {
        shouldSendInterval.current = false;
        return;
      }
      const currentTime = videoEl.currentTime;
      const duration = videoEl.duration;
      if (!isValidProgressSample(currentTime, duration)) {
        shouldSendInterval.current = false;
        return;
      }
      const now = Date.now();
      if (
        now - lastSentAt.current >= 15000 &&
        Math.abs(currentTime - lastSentPos.current) >= 10
      ) {
        sendProgress("interval");
      }
    }, 1000);

    const handlePause = () => {
      sendProgress("pause");
    };

    const handleSeeked = () => {
      if (isRestoringSeek.current) {
        isRestoringSeek.current = false;
        return;
      }
      sendProgress("seek");
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        sendProgress("hide", true);
      }
    };

    const handlePageHide = () => {
      sendProgress("hide", true);
    };

    el.addEventListener("loadedmetadata", handleLoadedMetadata);
    el.addEventListener("timeupdate", handleTimeUpdate);
    el.addEventListener("pause", handlePause);
    el.addEventListener("seeked", handleSeeked);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);

    if (el.readyState >= 1) {
      handleLoadedMetadata();
    }

    return () => {
      window.clearInterval(intervalTimer);
      el.removeEventListener("loadedmetadata", handleLoadedMetadata);
      el.removeEventListener("timeupdate", handleTimeUpdate);
      el.removeEventListener("pause", handlePause);
      el.removeEventListener("seeked", handleSeeked);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [episodeId, videoRef]);

  return { lastSentPos, lastSentAt, sessionId, inFlight };
}
