import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
} from "react";

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

interface PresentationSyncState {
  shellUiReady: boolean;
  pendingTokens: Set<symbol>;
}

const syncState: PresentationSyncState = {
  shellUiReady: false,
  pendingTokens: new Set<symbol>(),
};

let cachedSnapshot = false;
const listeners = new Set<() => void>();

function computeReadySnapshot(): boolean {
  return syncState.shellUiReady && syncState.pendingTokens.size === 0;
}

function notifyIfChanged() {
  const next = computeReadySnapshot();
  if (next !== cachedSnapshot) {
    cachedSnapshot = next;
    for (const listener of listeners) {
      listener();
    }
  }
}

export function setShellUiReady(ready: boolean) {
  if (syncState.shellUiReady === ready) return;
  syncState.shellUiReady = ready;
  notifyIfChanged();
}

export function beginCriticalImageToken(): symbol {
  const token = Symbol("critical-image");
  syncState.pendingTokens.add(token);
  notifyIfChanged();
  return token;
}

export function finishCriticalImageToken(token: symbol | null | undefined) {
  if (!token) return;
  if (syncState.pendingTokens.delete(token)) {
    notifyIfChanged();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getClientSnapshot(): boolean {
  return cachedSnapshot;
}

function getServerSnapshot(): boolean {
  return false;
}

export function useNotificationsPresentationReady(): boolean {
  return useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot,
  );
}

/**
 * Sincroniza um elemento <img> existente (ex: <picture><img> no Hero) como recurso
 * crítico de apresentação sem alterar seu layout ou marcação.
 */
export function useSynchronizedImageRef(
  enabled: boolean,
  srcKey: string | null | undefined,
) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const activeTokenRef = useRef<symbol | null>(null);

  const release = useCallback(() => {
    if (activeTokenRef.current) {
      finishCriticalImageToken(activeTokenRef.current);
      activeTokenRef.current = null;
    }
  }, []);

  useIsomorphicLayoutEffect(() => {
    release();

    if (!enabled || !srcKey) {
      return;
    }

    const img = imgRef.current;
    if (!img) {
      return;
    }

    // Se a imagem já está carregada e decodificada em cache, não bloqueia
    if (img.complete) {
      return;
    }

    const token = beginCriticalImageToken();
    activeTokenRef.current = token;

    let cancelled = false;

    const handleSettled = () => {
      if (cancelled) return;
      if (activeTokenRef.current === token) {
        finishCriticalImageToken(token);
        activeTokenRef.current = null;
      }
    };

    const handleLoad = () => {
      if (typeof img.decode === "function") {
        void img.decode().catch(() => undefined).finally(handleSettled);
      } else {
        handleSettled();
      }
    };

    img.addEventListener("load", handleLoad, { once: true });
    img.addEventListener("error", handleSettled, { once: true });

    return () => {
      cancelled = true;
      img.removeEventListener("load", handleLoad);
      img.removeEventListener("error", handleSettled);
      if (activeTokenRef.current === token) {
        finishCriticalImageToken(token);
        activeTokenRef.current = null;
      }
    };
  }, [enabled, srcKey, release]);

  return imgRef;
}
