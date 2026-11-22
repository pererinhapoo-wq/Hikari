export const MONETAG_SMARTLINK_ZONE_ID = "12327684" as const;
export const MONETAG_SMARTLINK_URL = "https://uplcm.com/4/12327684" as const;
export const MONETAG_STORAGE_KEY = "hikari:monetag:smartlink:v1" as const;
export const MONETAG_MAX_OPENS_PER_WINDOW = 2;
export const MONETAG_COOLDOWN_MS = 2 * 60 * 60 * 1000;

export interface SmartLinkStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface SmartLinkFrequencyState {
  version: 1;
  count: number;
  blockedUntil: number | null;
}

export type SmartLinkOpenOutcomeReason =
  | "opened"
  | "popup_blocked"
  | "cooldown_active"
  | "storage_unavailable"
  | "open_error";

export interface SmartLinkAttemptResult {
  attempted: boolean;
  opened: boolean;
  reason: SmartLinkOpenOutcomeReason;
  state: SmartLinkFrequencyState | null;
}

export interface TryOpenSmartLinkOptions {
  storage?: SmartLinkStorage | null;
  now?: number;
  openFn?: (url: string, target: string, features: string) => unknown;
}

export type SmartLinkNavigationEvent = {
  defaultPrevented?: boolean;
  button?: number;
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  nativeEvent?: Event;
};

const handledNavigationEvents = new WeakSet<Event>();

function createInitialState(): SmartLinkFrequencyState {
  return {
    version: 1,
    count: 0,
    blockedUntil: null,
  };
}

function parsePersistedState(raw: string | null): SmartLinkFrequencyState {
  if (raw === null || raw.trim() === "") {
    return createInitialState();
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      return createInitialState();
    }

    const candidate = parsed as Record<string, unknown>;
    if (candidate.version !== 1) {
      return createInitialState();
    }

    const count = candidate.count;
    const blockedUntil = candidate.blockedUntil;

    if (
      typeof count !== "number" ||
      !Number.isInteger(count) ||
      count < 0 ||
      count > MONETAG_MAX_OPENS_PER_WINDOW
    ) {
      return createInitialState();
    }

    if (
      blockedUntil !== null &&
      (typeof blockedUntil !== "number" ||
        !Number.isFinite(blockedUntil) ||
        blockedUntil < 0)
    ) {
      return createInitialState();
    }

    return {
      version: 1,
      count,
      blockedUntil,
    };
  } catch {
    return createInitialState();
  }
}

function resolveBrowserStorage(): SmartLinkStorage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

function resolveBrowserOpenFn():
  | ((url: string, target: string, features: string) => unknown)
  | null {
  if (typeof window === "undefined" || typeof window.open !== "function") {
    return null;
  }

  return (url, target, features) => window.open(url, target, features);
}

/**
 * Avalia e persiste a regra compartilhada de frequência (máximo 2 aberturas
 * seguidas por bloqueio de 2 horas) e executa `window.open` de forma síncrona
 * dentro do gesto do usuário.
 */
export function tryOpenMonetagSmartLink(
  options: TryOpenSmartLinkOptions = {},
): SmartLinkAttemptResult {
  const storage =
    options.storage === undefined ? resolveBrowserStorage() : options.storage;
  if (!storage) {
    return {
      attempted: false,
      opened: false,
      reason: "storage_unavailable",
      state: null,
    };
  }

  const now =
    typeof options.now === "number" && Number.isFinite(options.now)
      ? options.now
      : Date.now();

  let currentState: SmartLinkFrequencyState;
  try {
    const raw = storage.getItem(MONETAG_STORAGE_KEY);
    currentState = parsePersistedState(raw);
  } catch {
    return {
      attempted: false,
      opened: false,
      reason: "storage_unavailable",
      state: null,
    };
  }

  if (currentState.blockedUntil !== null) {
    if (now < currentState.blockedUntil) {
      return {
        attempted: false,
        opened: false,
        reason: "cooldown_active",
        state: currentState,
      };
    }

    // Janela de 2 horas concluída: reinicia o ciclo para liberar até 2 novos anúncios.
    currentState = createInitialState();
  } else if (currentState.count >= MONETAG_MAX_OPENS_PER_WINDOW) {
    // Estado inconsistente com contagem máxima sem timestamp de bloqueio: aplica bloqueio defensivo.
    const repairedState: SmartLinkFrequencyState = {
      version: 1,
      count: MONETAG_MAX_OPENS_PER_WINDOW,
      blockedUntil: now + MONETAG_COOLDOWN_MS,
    };
    try {
      storage.setItem(MONETAG_STORAGE_KEY, JSON.stringify(repairedState));
    } catch {
      return {
        attempted: false,
        opened: false,
        reason: "storage_unavailable",
        state: null,
      };
    }

    return {
      attempted: false,
      opened: false,
      reason: "cooldown_active",
      state: repairedState,
    };
  }

  const nextCount = currentState.count + 1;
  const nextState: SmartLinkFrequencyState = {
    version: 1,
    count: nextCount,
    blockedUntil:
      nextCount >= MONETAG_MAX_OPENS_PER_WINDOW ? now + MONETAG_COOLDOWN_MS : null,
  };

  try {
    storage.setItem(MONETAG_STORAGE_KEY, JSON.stringify(nextState));
  } catch {
    return {
      attempted: false,
      opened: false,
      reason: "storage_unavailable",
      state: null,
    };
  }

  const openFn = options.openFn ?? resolveBrowserOpenFn();
  if (!openFn) {
    return {
      attempted: true,
      opened: false,
      reason: "open_error",
      state: nextState,
    };
  }

  try {
    const popupWindow = openFn(
      MONETAG_SMARTLINK_URL,
      "_blank",
      "noopener,noreferrer",
    );

    if (!popupWindow) {
      return {
        attempted: true,
        opened: false,
        reason: "popup_blocked",
        state: nextState,
      };
    }

    return {
      attempted: true,
      opened: true,
      reason: "opened",
      state: nextState,
    };
  } catch {
    return {
      attempted: true,
      opened: false,
      reason: "open_error",
      state: nextState,
    };
  }
}

/**
 * Handler síncrono para links/ações elegíveis que levam à página de um anime
 * (`/anime/$id`) ou à página de um episódio (`/watch/$id/$ep`).
 * Nunca cancela nem substitui a navegação normal do Hikari.
 */
export function triggerMonetagSmartLinkOnNavigationClick(
  event?: SmartLinkNavigationEvent,
  options: TryOpenSmartLinkOptions = {},
): SmartLinkAttemptResult | null {
  if (typeof window === "undefined" && options.storage === undefined) {
    return null;
  }

  if (event) {
    if (event.defaultPrevented) {
      return null;
    }

    if (typeof event.button === "number" && event.button !== 0) {
      return null;
    }

    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return null;
    }

    const dedupeEvent =
      event.nativeEvent ?? (typeof Event !== "undefined" && event instanceof Event ? event : null);
    if (dedupeEvent) {
      if (handledNavigationEvents.has(dedupeEvent)) {
        return null;
      }
      handledNavigationEvents.add(dedupeEvent);
    }
  }

  return tryOpenMonetagSmartLink(options);
}
