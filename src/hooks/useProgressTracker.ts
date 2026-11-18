import { useEffect, useRef } from "react";

export interface UseProgressTrackerProps {
  episodeId: string;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

export function useProgressTracker({
  episodeId,
  videoRef,
}: UseProgressTrackerProps) {
  const lastSentPos = useRef<number>(0);
  const lastSentAt = useRef<number>(0);
  const inFlight = useRef<boolean>(false);
  const hasAppliedResume = useRef<boolean>(false);

  const getSessionId = (): string => {
    if (typeof window === "undefined") return "";
    try {
      let sess = sessionStorage.getItem("hikari:sess");
      if (!sess) {
        sess =
          typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : Math.random().toString(36).slice(2) + Date.now().toString(36);
        sessionStorage.setItem("hikari:sess", sess);
      }
      return sess;
    } catch {
      return "anon-session";
    }
  };

  const sendProgress = (
    event: "interval" | "pause" | "seek" | "hide",
    preferBeacon = false,
  ) => {
    const el = videoRef.current;
    if (!el || !episodeId || inFlight.current) return;

    const currentTime = el.currentTime;
    const duration = el.duration;

    // Regras obrigatórias:
    // Nunca enviar com currentTime menor que 3s
    // Nunca enviar se duration desconhecida
    if (
      typeof currentTime !== "number" ||
      Number.isNaN(currentTime) ||
      currentTime < 3 ||
      typeof duration !== "number" ||
      Number.isNaN(duration) ||
      duration <= 0
    ) {
      return;
    }

    const pos = Math.floor(currentTime);
    const dur = Math.floor(duration);
    const now = Date.now();

    // Ao enviar, atualizar lastSentPos e lastSentAt antes da chamada, para não duplicar.
    lastSentPos.current = pos;
    lastSentAt.current = now;
    inFlight.current = true;

    const payload = JSON.stringify({
      episodeId,
      position: pos,
      duration: dur,
      sessionId: getSessionId(),
      event,
    });

    if (preferBeacon && typeof navigator !== "undefined" && navigator.sendBeacon) {
      try {
        const blob = new Blob([payload], { type: "application/json" });
        const sent = navigator.sendBeacon("/api/progress", blob);
        inFlight.current = false;
        if (!sent) {
          lastSentAt.current = Date.now() + 30000;
        }
        return;
      } catch {
        // fallback para fetch
      }
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
        inFlight.current = false;
      });
  };

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !episodeId) return;

    hasAppliedResume.current = false;

    // 4. LEITURA: posição inicial no Redis / Postgres após loadedmetadata
    const handleLoadedMetadata = () => {
      if (hasAppliedResume.current) return;
      hasAppliedResume.current = true;

      const sid = getSessionId();
      fetch(
        `/api/progress?episodeId=${encodeURIComponent(episodeId)}&sessionId=${encodeURIComponent(sid)}`,
      )
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { position?: number } | null) => {
          if (data && typeof data.position === "number" && data.position > 0) {
            const current = el.currentTime;
            // nunca bloquear o primeiro frame: usar depois do loadedmetadata, aplicando seek se a diferença for maior que 10s
            if (Math.abs(current - data.position) > 10) {
              el.currentTime = data.position;
              lastSentPos.current = data.position;
            }
          }
        })
        .catch(() => {});
    };

    // Em timeupdate: só avaliar. Nunca enviar direto.
    // Enviar se now - lastSentAt >= 15000 E abs(currentTime - lastSentPos) >= 10.
    const handleTimeUpdate = () => {
      const currentTime = el.currentTime;
      const duration = el.duration;
      if (
        typeof currentTime !== "number" ||
        Number.isNaN(currentTime) ||
        currentTime < 3 ||
        typeof duration !== "number" ||
        Number.isNaN(duration) ||
        duration <= 0
      ) {
        return;
      }
      const now = Date.now();
      if (
        now - lastSentAt.current >= 15000 &&
        Math.abs(currentTime - lastSentPos.current) >= 10
      ) {
        sendProgress("interval");
      }
    };

    const handlePause = () => {
      sendProgress("pause");
    };

    const handleSeeked = () => {
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
      el.removeEventListener("loadedmetadata", handleLoadedMetadata);
      el.removeEventListener("timeupdate", handleTimeUpdate);
      el.removeEventListener("pause", handlePause);
      el.removeEventListener("seeked", handleSeeked);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [episodeId, videoRef]);

  return { lastSentPos, lastSentAt };
}
