export type PerformanceCompleteness =
  | "COMPLETO"
  | "PARCIAL"
  | "NÃO VERIFICADO"
  | "INDISPONÍVEL";

export type CoreWebVitalRating = "SAUDÁVEL" | "ATENÇÃO" | "CRÍTICO";

export type MeasurementSource =
  | "buffer"
  | "tempo_real"
  | "hibrido"
  | "indisponivel";

export interface CoreWebVitalMetric<TValue = number> {
  value: TValue | null;
  displayValue: string;
  completeness: PerformanceCompleteness;
  rating: CoreWebVitalRating | null;
  source: MeasurementSource;
  note: string;
  bufferCount?: number;
  liveCount?: number;
}

export interface NavigationTimingSummary {
  elapsedSinceNavMs: number | null;
  domContentLoadedMs: number | null;
  domContentLoadedCompleteness: PerformanceCompleteness;
  loadEventMs: number | null;
  loadEventCompleteness: PerformanceCompleteness;
  documentTotalMs: number | null;
  isInitialDocumentOnly: boolean;
  visibilityAssessment: {
    startedInBackground: boolean | null;
    canProveInitialVisibility: boolean;
    note: string;
  };
}

export interface LongTasksSummary {
  supported: boolean;
  completeness: PerformanceCompleteness;
  count: number;
  totalDurationMs: number;
  maxDurationMs: number;
  bufferCount: number;
  liveCount: number;
  note: string;
}

export interface JsMemorySummary {
  supported: boolean;
  completeness: PerformanceCompleteness;
  usedHeapBytes: number | null;
  totalHeapBytes: number | null;
  heapLimitBytes: number | null;
  note: string;
}

export interface SanitizedSlowResource {
  sanitizedUrl: string;
  initiatorType: string;
  durationMs: number;
  knownBytes: number | null;
  sizeRestricted: boolean;
}

export interface PageResourcesSummary {
  count: number;
  byInitiatorType: Record<string, number>;
  knownBytes: number;
  restrictedSizeCount: number;
  slowestResources: SanitizedSlowResource[];
}

export interface MediaResourcesSummary {
  count: number;
  avgDurationMs: number | null;
  maxDurationMs: number | null;
  knownBytes: number;
  restrictedSizeCount: number;
  classificationLabel: string;
}

export interface ResourcesDiagnosticSummary {
  supported: boolean;
  completeness: PerformanceCompleteness;
  totalEntries: number;
  page: PageResourcesSummary;
  media: MediaResourcesSummary;
  note: string;
}

export interface BrowserPerformanceSnapshot {
  isBrowserEnvironment: boolean;
  measuredAt: string;
  panelOpenedAtMs: number | null;
  lcp: CoreWebVitalMetric<number>;
  inp: CoreWebVitalMetric<number> & {
    observedInteractions: number;
    reportedInteractionCount: number | null;
    belowThresholdInteractionsDetected: boolean;
    bufferTruncatedOrCapped: boolean;
  };
  cls: CoreWebVitalMetric<number> & {
    windowCount: number;
    ignoredRecentInputCount: number;
  };
  fcp: CoreWebVitalMetric<number>;
  ttfb: CoreWebVitalMetric<number>;
  navigation: NavigationTimingSummary;
  longTasks: LongTasksSummary;
  memory: JsMemorySummary;
  resources: ResourcesDiagnosticSummary;
  supportedEntryTypes: string[];
  limitations: string[];
}

export interface PerformanceMonitorHandle {
  refresh: () => void;
  destroy: () => void;
}

interface PerformanceMemoryLike {
  usedJSHeapSize?: number;
  totalJSHeapSize?: number;
  jsHeapSizeLimit?: number;
}

interface PerformanceWithExtras extends Performance {
  interactionCount?: number;
  memory?: PerformanceMemoryLike;
}

interface EventTimingEntryLike extends PerformanceEntry {
  interactionId?: number;
}

interface LayoutShiftEntryLike extends PerformanceEntry {
  value?: number;
  hadRecentInput?: boolean;
}

interface VisibilityStateEntryLike extends PerformanceEntry {
  name: string;
  startTime: number;
}

const UI_BATCH_INTERVAL_MS = 350;
const CLS_MAX_WINDOW_MS = 5000;
const CLS_MAX_GAP_MS = 1000;
const SLOW_RESOURCES_LIMIT = 6;
const RESOURCE_BUFFER_TYPICAL_LIMIT = 250;
const EVENT_BUFFER_TYPICAL_LIMIT = 150;

export const RESTRICTED_RESOURCE_SIZE_TEXT =
  "Detalhes de tamanho não expostos (possível restrição CORS/Timing-Allow-Origin)";

export function formatPerformanceMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms) || ms < 0) {
    return "--";
  }
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(2)} s`;
  }
  return `${Math.round(ms)} ms`;
}

export function formatPerformanceBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes) || bytes < 0) {
    return "--";
  }
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getSupportedEntryTypes(): string[] {
  try {
    if (
      typeof window !== "undefined" &&
      typeof window.PerformanceObserver === "function" &&
      Array.isArray(window.PerformanceObserver.supportedEntryTypes)
    ) {
      return [...window.PerformanceObserver.supportedEntryTypes];
    }
  } catch {
    // ignore
  }
  return [];
}

function rateLcp(ms: number): CoreWebVitalRating {
  if (ms <= 2500) return "SAUDÁVEL";
  if (ms <= 4000) return "ATENÇÃO";
  return "CRÍTICO";
}

function rateInp(ms: number): CoreWebVitalRating {
  if (ms <= 200) return "SAUDÁVEL";
  if (ms <= 500) return "ATENÇÃO";
  return "CRÍTICO";
}

function rateCls(cls: number): CoreWebVitalRating {
  if (cls <= 0.1) return "SAUDÁVEL";
  if (cls <= 0.25) return "ATENÇÃO";
  return "CRÍTICO";
}

function sanitizeResourceUrl(rawName: string): {
  sanitizedUrl: string;
  origin: string;
  pathname: string;
} {
  try {
    const parsed = new URL(rawName, window.location.origin);
    const origin = parsed.origin || "";
    const pathname = parsed.pathname || "/";
    return {
      sanitizedUrl: `${origin}${pathname}`,
      origin,
      pathname,
    };
  } catch {
    const withoutFragment = rawName.split("#")[0] ?? "";
    const withoutQuery = withoutFragment.split("?")[0] ?? "";
    return {
      sanitizedUrl: withoutQuery || "(recurso sem URL válida)",
      origin: "",
      pathname: withoutQuery || "",
    };
  }
}

function isMediaOrLikelyHlsResource(
  initiatorType: string,
  pathname: string,
): boolean {
  const lowerInit = initiatorType.toLowerCase();
  if (lowerInit === "video" || lowerInit === "audio") {
    return true;
  }

  const lowerPath = pathname.toLowerCase();
  return (
    /\.m3u8?$/i.test(lowerPath) ||
    /\.(ts|m4s|m4a|mp4|webm|aac|vtt|srt|key)$/i.test(lowerPath) ||
    lowerPath.includes("/hls/") ||
    lowerPath.includes("/api/hls-proxy")
  );
}

function inspectInitialVisibility(
  supportedTypes: string[],
  referenceTimeMs: number | null,
): NavigationTimingSummary["visibilityAssessment"] {
  try {
    const supportsVisEntry = supportedTypes.includes("visibility-state");
    if (
      supportsVisEntry &&
      typeof window.performance?.getEntriesByType === "function"
    ) {
      const entries = window.performance.getEntriesByType(
        "visibility-state",
      ) as VisibilityStateEntryLike[];
      if (Array.isArray(entries) && entries.length > 0) {
        const sorted = [...entries].sort((a, b) => a.startTime - b.startTime);
        const firstEntry = sorted[0];
        const hiddenBeforeRef = sorted.some((entry) => {
          if (entry.name !== "hidden") return false;
          if (referenceTimeMs === null) return entry.startTime === 0;
          return entry.startTime <= referenceTimeMs;
        });

        const startedHidden =
          firstEntry?.name === "hidden" || hiddenBeforeRef;

        return {
          startedInBackground: startedHidden,
          canProveInitialVisibility: true,
          note: startedHidden
            ? "A página esteve oculta/em segundo plano antes da conclusão das métricas iniciais; tempos de pintura podem estar distorcidos."
            : "Visibilidade inicial confirmada via entradas visibility-state.",
        };
      }
    }
  } catch {
    // fallback abaixo
  }

  const currentlyHidden =
    typeof document !== "undefined" && document.visibilityState === "hidden";

  return {
    startedInBackground: currentlyHidden ? true : null,
    canProveInitialVisibility: false,
    note: currentlyHidden
      ? "Aba atualmente em segundo plano; histórico de visibilidade anterior à montagem não pôde ser comprovado."
      : "Navegador sem histórico visibility-state; não é possível comprovar se a página iniciou em segundo plano antes da abertura do painel.",
  };
}

function readNavigationAndFcp(supportedTypes: string[]): {
  ttfb: CoreWebVitalMetric<number>;
  fcp: CoreWebVitalMetric<number>;
  navigation: NavigationTimingSummary;
} {
  if (
    typeof window === "undefined" ||
    typeof window.performance === "undefined" ||
    typeof window.performance.getEntriesByType !== "function"
  ) {
    return {
      ttfb: {
        value: null,
        displayValue: "--",
        completeness: "INDISPONÍVEL",
        rating: null,
        source: "indisponivel",
        note: "API PerformanceNavigationTiming indisponível neste navegador.",
      },
      fcp: {
        value: null,
        displayValue: "--",
        completeness: "INDISPONÍVEL",
        rating: null,
        source: "indisponivel",
        note: "API PerformancePaintTiming indisponível neste navegador.",
      },
      navigation: {
        elapsedSinceNavMs: null,
        domContentLoadedMs: null,
        domContentLoadedCompleteness: "INDISPONÍVEL",
        loadEventMs: null,
        loadEventCompleteness: "INDISPONÍVEL",
        documentTotalMs: null,
        isInitialDocumentOnly: true,
        visibilityAssessment: {
          startedInBackground: null,
          canProveInitialVisibility: false,
          note: "Visibilidade inicial não verificável.",
        },
      },
    };
  }

  let navEntry: PerformanceNavigationTiming | undefined;
  try {
    const navEntries = window.performance.getEntriesByType(
      "navigation",
    ) as PerformanceNavigationTiming[];
    navEntry = navEntries[0];
  } catch {
    navEntry = undefined;
  }

  let fcpEntry: PerformanceEntry | undefined;
  try {
    const paintEntries = window.performance.getEntriesByType("paint");
    fcpEntry = paintEntries.find((e) => e.name === "first-contentful-paint");
  } catch {
    fcpEntry = undefined;
  }

  const fcpMs =
    fcpEntry && Number.isFinite(fcpEntry.startTime) && fcpEntry.startTime >= 0
      ? fcpEntry.startTime
      : null;

  const visAssessment = inspectInitialVisibility(supportedTypes, fcpMs);

  let ttfb: CoreWebVitalMetric<number>;
  if (!navEntry || !Number.isFinite(navEntry.responseStart)) {
    ttfb = {
      value: null,
      displayValue: "--",
      completeness: "INDISPONÍVEL",
      rating: null,
      source: "indisponivel",
      note: "PerformanceNavigationTiming indisponível.",
    };
  } else {
    const ttfbMs = Math.max(0, navEntry.responseStart);
    const cacheOrSwHint =
      navEntry.transferSize === 0
        ? " (transferSize = 0; possível cache local ou Service Worker)"
        : "";
    ttfb = {
      value: ttfbMs,
      displayValue: formatPerformanceMs(ttfbMs),
      completeness: "COMPLETO",
      rating: null,
      source: "buffer",
      note: `TTFB do documento HTML inicial (não mede transições SPA)${cacheOrSwHint}.`,
    };
  }

  let fcp: CoreWebVitalMetric<number>;
  if (fcpMs !== null) {
    fcp = {
      value: fcpMs,
      displayValue: formatPerformanceMs(fcpMs),
      completeness: visAssessment.startedInBackground === true ? "PARCIAL" : "COMPLETO",
      rating: null,
      source: "buffer",
      note:
        visAssessment.startedInBackground === true
          ? "Primeira pintura registrada após período em segundo plano."
          : "First Contentful Paint do carregamento inicial do documento.",
    };
  } else {
    const paintSupported = supportedTypes.includes("paint");
    fcp = {
      value: null,
      displayValue: "--",
      completeness: paintSupported ? "NÃO VERIFICADO" : "INDISPONÍVEL",
      rating: null,
      source: paintSupported ? "buffer" : "indisponivel",
      note: paintSupported
        ? "Entrada first-contentful-paint ainda não emitida."
        : "API paint timing não exposta por este navegador.",
    };
  }

  const elapsedSinceNavMs =
    typeof window.performance.now === "function"
      ? Math.max(0, window.performance.now())
      : null;

  const dclRaw =
    navEntry && Number.isFinite(navEntry.domContentLoadedEventEnd)
      ? navEntry.domContentLoadedEventEnd
      : 0;
  const loadRaw =
    navEntry && Number.isFinite(navEntry.loadEventEnd)
      ? navEntry.loadEventEnd
      : 0;

  const domContentLoadedMs = dclRaw > 0 ? dclRaw : null;
  const loadEventMs = loadRaw > 0 ? loadRaw : null;

  return {
    ttfb,
    fcp,
    navigation: {
      elapsedSinceNavMs,
      domContentLoadedMs,
      domContentLoadedCompleteness: !navEntry
        ? "INDISPONÍVEL"
        : domContentLoadedMs !== null
          ? "COMPLETO"
          : "NÃO VERIFICADO",
      loadEventMs,
      loadEventCompleteness: !navEntry
        ? "INDISPONÍVEL"
        : loadEventMs !== null
          ? "COMPLETO"
          : "NÃO VERIFICADO",
      documentTotalMs: loadEventMs,
      isInitialDocumentOnly: true,
      visibilityAssessment: visAssessment,
    },
  };
}

function readJsMemory(): JsMemorySummary {
  try {
    const perf = window.performance as PerformanceWithExtras;
    const mem = perf?.memory;
    if (
      mem &&
      typeof mem.usedJSHeapSize === "number" &&
      Number.isFinite(mem.usedJSHeapSize) &&
      typeof mem.totalJSHeapSize === "number" &&
      Number.isFinite(mem.totalJSHeapSize)
    ) {
      return {
        supported: true,
        completeness: "PARCIAL",
        usedHeapBytes: mem.usedJSHeapSize,
        totalHeapBytes: mem.totalJSHeapSize,
        heapLimitBytes:
          typeof mem.jsHeapSizeLimit === "number" &&
          Number.isFinite(mem.jsHeapSizeLimit)
            ? mem.jsHeapSizeLimit
            : null,
        note: "API não-padrão (performance.memory) disponível apenas em navegadores Chromium.",
      };
    }
  } catch {
    // ignore
  }

  return {
    supported: false,
    completeness: "INDISPONÍVEL",
    usedHeapBytes: null,
    totalHeapBytes: null,
    heapLimitBytes: null,
    note: "performance.memory não disponível neste navegador.",
  };
}

function readResourcesSummary(): ResourcesDiagnosticSummary {
  try {
    if (typeof window.performance?.getEntriesByType !== "function") {
      return {
        supported: false,
        completeness: "INDISPONÍVEL",
        totalEntries: 0,
        page: {
          count: 0,
          byInitiatorType: {},
          knownBytes: 0,
          restrictedSizeCount: 0,
          slowestResources: [],
        },
        media: {
          count: 0,
          avgDurationMs: null,
          maxDurationMs: null,
          knownBytes: 0,
          restrictedSizeCount: 0,
          classificationLabel: "Mídia / provável HLS (heurística)",
        },
        note: "PerformanceResourceTiming indisponível neste navegador.",
      };
    }

    const entries = window.performance.getEntriesByType(
      "resource",
    ) as PerformanceResourceTiming[];

    const byInitiatorType: Record<string, number> = {};
    let pageCount = 0;
    let pageKnownBytes = 0;
    let pageRestrictedCount = 0;
    const pageSlowCandidates: SanitizedSlowResource[] = [];

    let mediaCount = 0;
    let mediaKnownBytes = 0;
    let mediaRestrictedCount = 0;
    let mediaDurationSum = 0;
    let mediaMaxDuration = 0;

    const currentOrigin = window.location.origin;

    for (const entry of entries) {
      const initiatorType = entry.initiatorType || "other";
      const durationMs =
        typeof entry.duration === "number" && Number.isFinite(entry.duration)
          ? Math.max(0, entry.duration)
          : 0;

      const { sanitizedUrl, origin, pathname } = sanitizeResourceUrl(
        entry.name || "",
      );

      const transferSize =
        typeof entry.transferSize === "number" && Number.isFinite(entry.transferSize)
          ? entry.transferSize
          : 0;
      const encodedBodySize =
        typeof entry.encodedBodySize === "number" &&
        Number.isFinite(entry.encodedBodySize)
          ? entry.encodedBodySize
          : 0;
      const decodedBodySize =
        typeof entry.decodedBodySize === "number" &&
        Number.isFinite(entry.decodedBodySize)
          ? entry.decodedBodySize
          : 0;

      const isCrossOrigin = origin !== "" && origin !== currentOrigin;
      const hasZeroSizes =
        transferSize === 0 && encodedBodySize === 0 && decodedBodySize === 0;
      const sizeRestricted = isCrossOrigin && hasZeroSizes;
      const knownBytes = sizeRestricted
        ? null
        : transferSize > 0
          ? transferSize
          : encodedBodySize > 0
            ? encodedBodySize
            : null;

      if (isMediaOrLikelyHlsResource(initiatorType, pathname)) {
        mediaCount += 1;
        mediaDurationSum += durationMs;
        if (durationMs > mediaMaxDuration) {
          mediaMaxDuration = durationMs;
        }
        if (sizeRestricted || knownBytes === null) {
          if (sizeRestricted) mediaRestrictedCount += 1;
        } else {
          mediaKnownBytes += knownBytes;
        }
      } else {
        pageCount += 1;
        byInitiatorType[initiatorType] =
          (byInitiatorType[initiatorType] ?? 0) + 1;
        if (sizeRestricted) {
          pageRestrictedCount += 1;
        } else if (knownBytes !== null) {
          pageKnownBytes += knownBytes;
        }

        pageSlowCandidates.push({
          sanitizedUrl,
          initiatorType,
          durationMs,
          knownBytes,
          sizeRestricted,
        });
      }
    }

    pageSlowCandidates.sort((a, b) => b.durationMs - a.durationMs);
    const slowestResources = pageSlowCandidates.slice(0, SLOW_RESOURCES_LIMIT);

    const bufferPotentiallyCapped =
      entries.length >= RESOURCE_BUFFER_TYPICAL_LIMIT;

    const noteParts: string[] = [];
    if (bufferPotentiallyCapped) {
      noteParts.push(
        `Buffer de recursos atingiu ${entries.length} entradas (entradas antigas podem ter sido descartadas pelo navegador).`,
      );
    }
    if (pageRestrictedCount > 0 || mediaRestrictedCount > 0) {
      noteParts.push(RESTRICTED_RESOURCE_SIZE_TEXT);
    }
    if (noteParts.length === 0) {
      noteParts.push(
        "URLs sanitizadas sem query strings ou hashes; segmentos de mídia são agregados separadamente.",
      );
    }

    return {
      supported: true,
      completeness: bufferPotentiallyCapped ? "PARCIAL" : "COMPLETO",
      totalEntries: entries.length,
      page: {
        count: pageCount,
        byInitiatorType,
        knownBytes: pageKnownBytes,
        restrictedSizeCount: pageRestrictedCount,
        slowestResources,
      },
      media: {
        count: mediaCount,
        avgDurationMs: mediaCount > 0 ? mediaDurationSum / mediaCount : null,
        maxDurationMs: mediaCount > 0 ? mediaMaxDuration : null,
        knownBytes: mediaKnownBytes,
        restrictedSizeCount: mediaRestrictedCount,
        classificationLabel: "Mídia / provável HLS (heurística por tipo e caminho)",
      },
      note: noteParts.join(" "),
    };
  } catch {
    return {
      supported: false,
      completeness: "INDISPONÍVEL",
      totalEntries: 0,
      page: {
        count: 0,
        byInitiatorType: {},
        knownBytes: 0,
        restrictedSizeCount: 0,
        slowestResources: [],
      },
      media: {
        count: 0,
        avgDurationMs: null,
        maxDurationMs: null,
        knownBytes: 0,
        restrictedSizeCount: 0,
        classificationLabel: "Mídia / provável HLS (heurística)",
      },
      note: "Falha ao ler entradas PerformanceResourceTiming.",
    };
  }
}

export function createNonBrowserPerformanceSnapshot(): BrowserPerformanceSnapshot {
  return {
    isBrowserEnvironment: false,
    measuredAt: "",
    panelOpenedAtMs: null,
    lcp: {
      value: null,
      displayValue: "--",
      completeness: "NÃO VERIFICADO",
      rating: null,
      source: "indisponivel",
      note: "Aguardando execução no navegador.",
    },
    inp: {
      value: null,
      displayValue: "--",
      completeness: "NÃO VERIFICADO",
      rating: null,
      source: "indisponivel",
      note: "Aguardando execução no navegador.",
      observedInteractions: 0,
      reportedInteractionCount: null,
      belowThresholdInteractionsDetected: false,
      bufferTruncatedOrCapped: false,
    },
    cls: {
      value: null,
      displayValue: "--",
      completeness: "NÃO VERIFICADO",
      rating: null,
      source: "indisponivel",
      note: "Aguardando execução no navegador.",
      windowCount: 0,
      ignoredRecentInputCount: 0,
    },
    fcp: {
      value: null,
      displayValue: "--",
      completeness: "NÃO VERIFICADO",
      rating: null,
      source: "indisponivel",
      note: "Aguardando execução no navegador.",
    },
    ttfb: {
      value: null,
      displayValue: "--",
      completeness: "NÃO VERIFICADO",
      rating: null,
      source: "indisponivel",
      note: "Aguardando execução no navegador.",
    },
    navigation: {
      elapsedSinceNavMs: null,
      domContentLoadedMs: null,
      domContentLoadedCompleteness: "NÃO VERIFICADO",
      loadEventMs: null,
      loadEventCompleteness: "NÃO VERIFICADO",
      documentTotalMs: null,
      isInitialDocumentOnly: true,
      visibilityAssessment: {
        startedInBackground: null,
        canProveInitialVisibility: false,
        note: "Aguardando execução no navegador.",
      },
    },
    longTasks: {
      supported: false,
      completeness: "NÃO VERIFICADO",
      count: 0,
      totalDurationMs: 0,
      maxDurationMs: 0,
      bufferCount: 0,
      liveCount: 0,
      note: "Aguardando execução no navegador.",
    },
    memory: {
      supported: false,
      completeness: "NÃO VERIFICADO",
      usedHeapBytes: null,
      totalHeapBytes: null,
      heapLimitBytes: null,
      note: "Aguardando execução no navegador.",
    },
    resources: {
      supported: false,
      completeness: "NÃO VERIFICADO",
      totalEntries: 0,
      page: {
        count: 0,
        byInitiatorType: {},
        knownBytes: 0,
        restrictedSizeCount: 0,
        slowestResources: [],
      },
      media: {
        count: 0,
        avgDurationMs: null,
        maxDurationMs: null,
        knownBytes: 0,
        restrictedSizeCount: 0,
        classificationLabel: "Mídia / provável HLS (heurística)",
      },
      note: "Aguardando execução no navegador.",
    },
    supportedEntryTypes: [],
    limitations: ["Diagnóstico de desempenho executa apenas no navegador."],
  };
}

export function readInitialPerformanceSnapshot(): BrowserPerformanceSnapshot {
  if (typeof window === "undefined") {
    return createNonBrowserPerformanceSnapshot();
  }

  const base = createNonBrowserPerformanceSnapshot();
  const supportedTypes = getSupportedEntryTypes();
  const { ttfb, fcp, navigation } = readNavigationAndFcp(supportedTypes);
  const memory = readJsMemory();
  const resources = readResourcesSummary();

  return {
    ...base,
    isBrowserEnvironment: true,
    measuredAt: new Date().toLocaleTimeString("pt-BR"),
    panelOpenedAtMs:
      typeof window.performance?.now === "function"
        ? Math.round(window.performance.now())
        : null,
    ttfb,
    fcp,
    navigation,
    memory,
    resources,
    supportedEntryTypes: supportedTypes,
    limitations: [
      navigation.visibilityAssessment.note,
      "Leitura inicial concluída; observadores de LCP, INP, CLS e Long Tasks precisam estar ativos.",
    ],
  };
}

export function createPerformanceMonitor(
  onSnapshot: (snapshot: BrowserPerformanceSnapshot) => void,
): PerformanceMonitorHandle {
  if (typeof window === "undefined") {
    return {
      refresh: () => {},
      destroy: () => {},
    };
  }

  let destroyed = false;
  let flushTimer: ReturnType<typeof setTimeout> | null = null;

  const panelOpenedAtMs =
    typeof window.performance?.now === "function"
      ? window.performance.now()
      : 0;
  const startedLate = panelOpenedAtMs > 1500;

  const supportedTypes = getSupportedEntryTypes();
  const hasObserverApi = typeof window.PerformanceObserver === "function";

  const observers: PerformanceObserver[] = [];

  // LCP state
  let lcpSupported = false;
  let lcpStartTimeMs: number | null = null;
  let lcpBufferCount = 0;
  let lcpLiveCount = 0;
  let lcpFinalized = false;

  // INP state: preserva todas as interações observadas na sessão atual para nunca errar o índice p98
  let inpSupported = false;
  const interactionMaxMap = new Map<
    number,
    { duration: number; source: "buffer" | "tempo_real" }
  >();
  let inpBufferEntriesRaw = 0;

  // CLS state (session windows: máx 5s janela, máx 1s intervalo)
  let clsSupported = false;
  let clsMaxSessionValue = 0;
  let clsCurrentSessionValue = 0;
  let clsSessionFirstTime = -1;
  let clsSessionLastTime = -1;
  let clsWindowCount = 0;
  let clsIgnoredRecentInputCount = 0;
  let clsBufferCount = 0;
  let clsLiveCount = 0;

  // Long tasks state
  let longTaskSupported = false;
  let longTaskCount = 0;
  let longTaskTotalDurationMs = 0;
  let longTaskMaxDurationMs = 0;
  let longTaskBufferCount = 0;
  let longTaskLiveCount = 0;

  // Paint live fallback if FCP fires after mount
  let observedFcpMs: number | null = null;

  const buildSnapshot = (): BrowserPerformanceSnapshot => {
    const { ttfb, fcp: baseFcp, navigation } = readNavigationAndFcp(supportedTypes);
    const memory = readJsMemory();
    const resources = readResourcesSummary();

    const fcp =
      baseFcp.value !== null
        ? baseFcp
        : observedFcpMs !== null
          ? {
              value: observedFcpMs,
              displayValue: formatPerformanceMs(observedFcpMs),
              completeness: "COMPLETO" as PerformanceCompleteness,
              rating: null,
              source: "tempo_real" as MeasurementSource,
              note: "First Contentful Paint observado durante a sessão atual.",
            }
          : baseFcp;

    // 1. LCP
    let lcpMetric: CoreWebVitalMetric<number>;
    if (!lcpSupported) {
      lcpMetric = {
        value: null,
        displayValue: "--",
        completeness: "INDISPONÍVEL",
        rating: null,
        source: "indisponivel",
        note: "largest-contentful-paint não suportado por este navegador.",
      };
    } else if (lcpStartTimeMs === null) {
      lcpMetric = {
        value: null,
        displayValue: "--",
        completeness: "NÃO VERIFICADO",
        rating: null,
        source: "buffer",
        note: "Nenhuma entrada LCP recebida até o momento.",
        bufferCount: 0,
        liveCount: 0,
      };
    } else {
      const visForLcp = inspectInitialVisibility(supportedTypes, lcpStartTimeMs);
      const lcpWasInBackground = visForLcp.startedInBackground === true;
      const canFinishCleanly =
        lcpFinalized &&
        visForLcp.canProveInitialVisibility &&
        !lcpWasInBackground;

      const lcpCompleteness: PerformanceCompleteness = canFinishCleanly
        ? "COMPLETO"
        : "PARCIAL";

      const source: MeasurementSource =
        lcpBufferCount > 0 && lcpLiveCount > 0
          ? "hibrido"
          : lcpLiveCount > 0
            ? "tempo_real"
            : "buffer";

      const lcpNotes: string[] = [];
      if (lcpWasInBackground) {
        lcpNotes.push(
          "Página iniciou em segundo plano antes do LCP; leitura pode estar inflada.",
        );
      } else if (!visForLcp.canProveInitialVisibility) {
        lcpNotes.push(
          "Visibilidade inicial pré-abertura não comprovável neste navegador.",
        );
      }
      if (!lcpFinalized) {
        lcpNotes.push(
          "Aguardando primeira interação ou ocultação da aba para finalizar LCP.",
        );
      } else if (lcpNotes.length === 0) {
        lcpNotes.push("LCP finalizado do carregamento inicial do documento.");
      }

      lcpMetric = {
        value: lcpStartTimeMs,
        displayValue: formatPerformanceMs(lcpStartTimeMs),
        completeness: lcpCompleteness,
        rating: rateLcp(lcpStartTimeMs),
        source,
        note: lcpNotes.join(" "),
        bufferCount: lcpBufferCount,
        liveCount: lcpLiveCount,
      };
    }

    // 2. INP
    const perfWithExtras = window.performance as PerformanceWithExtras;
    const reportedInteractionCount =
      typeof perfWithExtras.interactionCount === "number" &&
      Number.isFinite(perfWithExtras.interactionCount)
        ? perfWithExtras.interactionCount
        : null;

    let inpMetric: BrowserPerformanceSnapshot["inp"];
    if (!inpSupported) {
      inpMetric = {
        value: null,
        displayValue: "--",
        completeness: "INDISPONÍVEL",
        rating: null,
        source: "indisponivel",
        note: "Event Timing (type: 'event') não suportado neste navegador.",
        observedInteractions: 0,
        reportedInteractionCount,
        belowThresholdInteractionsDetected: false,
        bufferTruncatedOrCapped: false,
      };
    } else {
      const observedCount = interactionMaxMap.size;
      const totalInteractions =
        reportedInteractionCount !== null
          ? Math.max(reportedInteractionCount, observedCount)
          : observedCount;

      let bufferInteractionsCount = 0;
      let liveInteractionsCount = 0;
      const durations: number[] = [];

      for (const item of interactionMaxMap.values()) {
        durations.push(item.duration);
        if (item.source === "buffer") {
          bufferInteractionsCount += 1;
        } else {
          liveInteractionsCount += 1;
        }
      }
      durations.sort((a, b) => b - a);

      const source: MeasurementSource =
        bufferInteractionsCount > 0 && liveInteractionsCount > 0
          ? "hibrido"
          : liveInteractionsCount > 0
            ? "tempo_real"
            : bufferInteractionsCount > 0
              ? "buffer"
              : "tempo_real";

      const possibleBufferOverflow =
        startedLate && inpBufferEntriesRaw >= EVENT_BUFFER_TYPICAL_LIMIT;

      if (totalInteractions === 0) {
        inpMetric = {
          value: null,
          displayValue: "--",
          completeness: "NÃO VERIFICADO",
          rating: null,
          source: "tempo_real",
          note: "Nenhuma interação válida registrada ainda (clique, toque ou tecla).",
          observedInteractions: 0,
          reportedInteractionCount,
          belowThresholdInteractionsDetected: false,
          bufferTruncatedOrCapped: false,
          bufferCount: 0,
          liveCount: 0,
        };
      } else if (durations.length === 0) {
        inpMetric = {
          value: null,
          displayValue: "< 16 ms",
          completeness: "PARCIAL",
          rating: null,
          source,
          note: `${totalInteractions} interação(ões) detectada(s) em performance.interactionCount, mas nenhuma entrada atingiu durationThreshold (16 ms) ou permaneceu no buffer.`,
          observedInteractions: 0,
          reportedInteractionCount,
          belowThresholdInteractionsDetected: true,
          bufferTruncatedOrCapped: possibleBufferOverflow,
          bufferCount: bufferInteractionsCount,
          liveCount: liveInteractionsCount,
        };
      } else {
        const targetIndex = Math.floor(totalInteractions / 50);
        if (targetIndex >= durations.length) {
          // A posição p98 cai abaixo das entradas >= 16ms capturadas (ou houve perda no buffer pré-montagem)
          inpMetric = {
            value: null,
            displayValue: "< 16 ms",
            completeness: "PARCIAL",
            rating: null,
            source,
            note: `População total de ${totalInteractions} interação(ões), porém apenas ${durations.length} atingiram o limiar de captura/buffer; p98 exato não pode ser garantido.`,
            observedInteractions: observedCount,
            reportedInteractionCount,
            belowThresholdInteractionsDetected: true,
            bufferTruncatedOrCapped: possibleBufferOverflow,
            bufferCount: bufferInteractionsCount,
            liveCount: liveInteractionsCount,
          };
        } else {
          const inpValueMs = durations[targetIndex];
          const isSmallSample = totalInteractions < 50;
          const lateIncomplete = startedLate && liveInteractionsCount < 50;
          const inpCompleteness: PerformanceCompleteness =
            isSmallSample || possibleBufferOverflow || lateIncomplete
              ? "PARCIAL"
              : "COMPLETO";

          const notes: string[] = [];
          if (isSmallSample) {
            notes.push(
              `Amostra pequena (${totalInteractions} interação(ões); p98 requer ≥ 50). Exibe pior interação observada.`,
            );
          } else {
            notes.push(
              `Calculado por agrupamento de interactionId no índice p98 (${targetIndex + 1}ª pior de ${totalInteractions}).`,
            );
          }
          if (startedLate) {
            notes.push(
              "Coleta iniciada tardiamente: interações pré-abertura abaixo do buffer padrão podem não constar.",
            );
          }

          inpMetric = {
            value: inpValueMs,
            displayValue: formatPerformanceMs(inpValueMs),
            completeness: inpCompleteness,
            rating: rateInp(inpValueMs),
            source,
            note: notes.join(" "),
            observedInteractions: observedCount,
            reportedInteractionCount,
            belowThresholdInteractionsDetected: false,
            bufferTruncatedOrCapped: possibleBufferOverflow,
            bufferCount: bufferInteractionsCount,
            liveCount: liveInteractionsCount,
          };
        }
      }
    }

    // 3. CLS
    let clsMetric: BrowserPerformanceSnapshot["cls"];
    if (!clsSupported) {
      clsMetric = {
        value: null,
        displayValue: "--",
        completeness: "INDISPONÍVEL",
        rating: null,
        source: "indisponivel",
        note: "layout-shift não suportado por este navegador.",
        windowCount: 0,
        ignoredRecentInputCount: 0,
      };
    } else {
      const clsSource: MeasurementSource =
        clsBufferCount > 0 && clsLiveCount > 0
          ? "hibrido"
          : clsLiveCount > 0
            ? "tempo_real"
            : "buffer";

      clsMetric = {
        value: clsMaxSessionValue,
        displayValue: clsMaxSessionValue.toFixed(3),
        completeness: "PARCIAL",
        rating: rateCls(clsMaxSessionValue),
        source: clsSource,
        note: "Calculado por janelas de sessão (máx. 5s / intervalo 1s, ignorando hadRecentInput). Permanece PARCIAL enquanto a página estiver aberta.",
        windowCount: clsWindowCount,
        ignoredRecentInputCount: clsIgnoredRecentInputCount,
        bufferCount: clsBufferCount,
        liveCount: clsLiveCount,
      };
    }

    // 4. Long Tasks
    const longTasks: LongTasksSummary = longTaskSupported
      ? {
          supported: true,
          completeness: "PARCIAL",
          count: longTaskCount,
          totalDurationMs: longTaskTotalDurationMs,
          maxDurationMs: longTaskMaxDurationMs,
          bufferCount: longTaskBufferCount,
          liveCount: longTaskLiveCount,
          note: startedLate
            ? "Long Tasks (> 50 ms) da thread principal; coleta iniciada após carga inicial pode omitir tarefas antigas fora do buffer."
            : "Long Tasks (> 50 ms) monitoradas na sessão atual.",
        }
      : {
          supported: false,
          completeness: "INDISPONÍVEL",
          count: 0,
          totalDurationMs: 0,
          maxDurationMs: 0,
          bufferCount: 0,
          liveCount: 0,
          note: "Observer longtask não suportado neste navegador.",
        };

    // Limitações consolidadas
    const limitations: string[] = [
      "Dados exclusivos do navegador e dispositivo atual do administrador (sem histórico global de visitantes).",
      "Métricas NavigationTiming, TTFB, FCP e LCP referem-se ao carregamento inicial do documento HTML, não às transições internas SPA.",
      "Interações realizadas dentro deste próprio painel de diagnóstico fazem parte da sessão medida e influenciam o INP.",
    ];

    if (startedLate) {
      limitations.push(
        "Coleta iniciada após o carregamento da aplicação (painel aberto tardiamente); entradas fora do buffer nativo anterior não podem ser reconstruídas.",
      );
    }

    if (!navigation.visibilityAssessment.canProveInitialVisibility) {
      limitations.push(navigation.visibilityAssessment.note);
    } else if (navigation.visibilityAssessment.startedInBackground) {
      limitations.push(navigation.visibilityAssessment.note);
    }

    return {
      isBrowserEnvironment: true,
      measuredAt: new Date().toLocaleTimeString("pt-BR"),
      panelOpenedAtMs: Math.round(panelOpenedAtMs),
      lcp: lcpMetric,
      inp: inpMetric,
      cls: clsMetric,
      fcp,
      ttfb,
      navigation,
      longTasks,
      memory,
      resources,
      supportedEntryTypes: supportedTypes,
      limitations,
    };
  };

  const emitNow = () => {
    if (destroyed) return;
    if (flushTimer !== null) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    onSnapshot(buildSnapshot());
  };

  const scheduleBatchedEmit = () => {
    if (destroyed || flushTimer !== null) return;
    flushTimer = setTimeout(() => {
      flushTimer = null;
      if (!destroyed) {
        onSnapshot(buildSnapshot());
      }
    }, UI_BATCH_INTERVAL_MS);
  };

  const markLcpFinalized = () => {
    if (lcpFinalized) return;
    lcpFinalized = true;
    scheduleBatchedEmit();
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      markLcpFinalized();
    }
  };

  const handleFirstInteractionForLcp = () => {
    markLcpFinalized();
  };

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", handleVisibilityChange);
  }
  window.addEventListener("keydown", handleFirstInteractionForLcp, {
    once: true,
    capture: true,
    passive: true,
  });
  window.addEventListener("pointerdown", handleFirstInteractionForLcp, {
    once: true,
    capture: true,
    passive: true,
  });

  if (hasObserverApi) {
    // LCP Observer
    if (supportedTypes.includes("largest-contentful-paint")) {
      try {
        const lcpObs = new window.PerformanceObserver((list) => {
          if (destroyed) return;
          for (const entry of list.getEntries()) {
            if (Number.isFinite(entry.startTime)) {
              lcpStartTimeMs = entry.startTime;
              if (entry.startTime <= panelOpenedAtMs) {
                lcpBufferCount += 1;
              } else {
                lcpLiveCount += 1;
              }
            }
          }
          scheduleBatchedEmit();
        });
        lcpObs.observe({
          type: "largest-contentful-paint",
          buffered: true,
        });
        observers.push(lcpObs);
        lcpSupported = true;
      } catch {
        lcpSupported = false;
      }
    }

    // Event Timing Observer (INP)
    if (supportedTypes.includes("event")) {
      try {
        const eventObs = new window.PerformanceObserver((list) => {
          if (destroyed) return;
          let changed = false;
          for (const rawEntry of list.getEntries()) {
            const entry = rawEntry as EventTimingEntryLike;
            const id = entry.interactionId;
            const duration = entry.duration;
            if (
              typeof id === "number" &&
              id > 0 &&
              typeof duration === "number" &&
              Number.isFinite(duration) &&
              duration >= 0
            ) {
              if (entry.startTime <= panelOpenedAtMs) {
                inpBufferEntriesRaw += 1;
              }
              const origin: "buffer" | "tempo_real" =
                entry.startTime <= panelOpenedAtMs ? "buffer" : "tempo_real";
              const existing = interactionMaxMap.get(id);
              if (!existing) {
                interactionMaxMap.set(id, { duration, source: origin });
                changed = true;
              } else if (duration > existing.duration) {
                interactionMaxMap.set(id, {
                  duration,
                  source: origin === "tempo_real" ? "tempo_real" : existing.source,
                });
                changed = true;
              }
            }
          }
          if (changed) {
            markLcpFinalized();
            scheduleBatchedEmit();
          }
        });
        eventObs.observe({
          type: "event",
          buffered: true,
          durationThreshold: 16,
        } as PerformanceObserverInit);
        observers.push(eventObs);
        inpSupported = true;
      } catch {
        inpSupported = false;
      }
    }

    // Layout Shift Observer (CLS)
    if (supportedTypes.includes("layout-shift")) {
      try {
        const clsObs = new window.PerformanceObserver((list) => {
          if (destroyed) return;
          let changed = false;
          for (const rawEntry of list.getEntries()) {
            const entry = rawEntry as LayoutShiftEntryLike;
            if (entry.hadRecentInput) {
              clsIgnoredRecentInputCount += 1;
              continue;
            }
            const val = entry.value;
            if (typeof val !== "number" || !Number.isFinite(val) || val <= 0) {
              continue;
            }

            if (entry.startTime <= panelOpenedAtMs) {
              clsBufferCount += 1;
            } else {
              clsLiveCount += 1;
            }

            if (
              clsSessionFirstTime >= 0 &&
              entry.startTime - clsSessionLastTime <= CLS_MAX_GAP_MS &&
              entry.startTime - clsSessionFirstTime <= CLS_MAX_WINDOW_MS
            ) {
              clsCurrentSessionValue += val;
              clsSessionLastTime = entry.startTime;
            } else {
              clsSessionFirstTime = entry.startTime;
              clsSessionLastTime = entry.startTime;
              clsCurrentSessionValue = val;
              clsWindowCount += 1;
            }

            if (clsCurrentSessionValue > clsMaxSessionValue) {
              clsMaxSessionValue = clsCurrentSessionValue;
            }
            changed = true;
          }
          if (changed) {
            scheduleBatchedEmit();
          }
        });
        clsObs.observe({ type: "layout-shift", buffered: true });
        observers.push(clsObs);
        clsSupported = true;
      } catch {
        clsSupported = false;
      }
    }

    // Long Tasks Observer
    if (supportedTypes.includes("longtask")) {
      try {
        const ltObs = new window.PerformanceObserver((list) => {
          if (destroyed) return;
          let changed = false;
          for (const entry of list.getEntries()) {
            if (Number.isFinite(entry.duration) && entry.duration > 0) {
              longTaskCount += 1;
              longTaskTotalDurationMs += entry.duration;
              if (entry.duration > longTaskMaxDurationMs) {
                longTaskMaxDurationMs = entry.duration;
              }
              if (entry.startTime <= panelOpenedAtMs) {
                longTaskBufferCount += 1;
              } else {
                longTaskLiveCount += 1;
              }
              changed = true;
            }
          }
          if (changed) {
            scheduleBatchedEmit();
          }
        });
        ltObs.observe({ type: "longtask", buffered: true });
        observers.push(ltObs);
        longTaskSupported = true;
      } catch {
        longTaskSupported = false;
      }
    }

    // Paint Observer (caso FCP ocorra após montagem)
    if (supportedTypes.includes("paint")) {
      try {
        const paintObs = new window.PerformanceObserver((list) => {
          if (destroyed) return;
          for (const entry of list.getEntries()) {
            if (
              entry.name === "first-contentful-paint" &&
              Number.isFinite(entry.startTime)
            ) {
              observedFcpMs = entry.startTime;
              scheduleBatchedEmit();
            }
          }
        });
        paintObs.observe({ type: "paint", buffered: true });
        observers.push(paintObs);
      } catch {
        // ignore
      }
    }
  }

  // Emite leitura inicial imediatamente após registrar observadores
  emitNow();

  return {
    refresh: () => {
      emitNow();
    },
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      if (flushTimer !== null) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      for (const obs of observers) {
        try {
          obs.disconnect();
        } catch {
          // ignore
        }
      }
      observers.length = 0;

      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
      window.removeEventListener("keydown", handleFirstInteractionForLcp, {
        capture: true,
      });
      window.removeEventListener("pointerdown", handleFirstInteractionForLcp, {
        capture: true,
      });
    },
  };
}
