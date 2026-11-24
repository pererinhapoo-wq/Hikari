import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Cpu,
  HardDrive,
  Info,
  MonitorSmartphone,
  PlaySquare,
  RefreshCw,
  ShieldAlert,
  AlertCircle,
} from "lucide-react";

export type CompatibilityStatus =
  | "SUPORTADO"
  | "NÃO SUPORTADO"
  | "INDISPONÍVEL"
  | "NÃO VERIFICADO";

interface CompatibilityCheckItem {
  id: string;
  label: string;
  detail: string;
  status: CompatibilityStatus;
  meta?: string;
}

interface DeviceEnvironmentInfo {
  browserName: string;
  browserVersion: string;
  platform: string;
  viewportWidth: number | null;
  viewportHeight: number | null;
  devicePixelRatio: number | null;
  touchSupport: string;
  colorScheme: string;
  webApis: Array<{ name: string; status: CompatibilityStatus }>;
}

interface StorageQuotaSummary {
  status: CompatibilityStatus;
  usageBytes: number | null;
  quotaBytes: number | null;
  percentageText: string;
  detail: string;
}

interface CompatibilitySnapshot {
  checkedAt: string | null;
  environment: DeviceEnvironmentInfo;
  hlsChecks: CompatibilityCheckItem[];
  codecChecks: CompatibilityCheckItem[];
  playerFeatureChecks: CompatibilityCheckItem[];
  storageChecks: CompatibilityCheckItem[];
  storageQuota: StorageQuotaSummary;
}

const STATUS_BADGE_MAP: Record<CompatibilityStatus, string> = {
  SUPORTADO: "bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30",
  "NÃO SUPORTADO": "bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/30",
  INDISPONÍVEL: "bg-[#94A3B8]/15 text-[#94A3B8] border-[#94A3B8]/30",
  "NÃO VERIFICADO": "bg-[#181B22] text-[#6B7280] border-[#262B36]",
};

const STATUS_DOT_MAP: Record<CompatibilityStatus, string> = {
  SUPORTADO: "bg-[#10B981]",
  "NÃO SUPORTADO": "bg-[#F59E0B]",
  INDISPONÍVEL: "bg-[#94A3B8]",
  "NÃO VERIFICADO": "bg-[#6B7280]",
};

const INITIAL_SNAPSHOT: CompatibilitySnapshot = {
  checkedAt: null,
  environment: {
    browserName: "Aguardando navegador",
    browserVersion: "Não verificada",
    platform: "Aguardando navegador",
    viewportWidth: null,
    viewportHeight: null,
    devicePixelRatio: null,
    touchSupport: "Não verificado",
    colorScheme: "Não verificado",
    webApis: [
      { name: "matchMedia", status: "NÃO VERIFICADO" },
      { name: "ResizeObserver", status: "NÃO VERIFICADO" },
      { name: "PerformanceObserver", status: "NÃO VERIFICADO" },
      { name: "WebAssembly", status: "NÃO VERIFICADO" },
    ],
  },
  hlsChecks: [
    {
      id: "hls-native",
      label: "HLS Nativo (HTMLVideoElement.canPlayType)",
      detail: "Aguardando execução no navegador.",
      status: "NÃO VERIFICADO",
    },
    {
      id: "hls-js",
      label: "Hls.js (Hls.isSupported)",
      detail: "Aguardando execução no navegador.",
      status: "NÃO VERIFICADO",
    },
  ],
  codecChecks: [
    {
      id: "codec-h264",
      label: "H.264 / AVC",
      detail: "Aguardando execução no navegador.",
      status: "NÃO VERIFICADO",
    },
    {
      id: "codec-hevc",
      label: "HEVC / H.265",
      detail: "Aguardando execução no navegador.",
      status: "NÃO VERIFICADO",
    },
    {
      id: "codec-vp9",
      label: "VP9",
      detail: "Aguardando execução no navegador.",
      status: "NÃO VERIFICADO",
    },
    {
      id: "codec-av1",
      label: "AV1",
      detail: "Aguardando execução no navegador.",
      status: "NÃO VERIFICADO",
    },
    {
      id: "codec-aac",
      label: "AAC / MP4A",
      detail: "Aguardando execução no navegador.",
      status: "NÃO VERIFICADO",
    },
  ],
  playerFeatureChecks: [
    {
      id: "feature-video-el",
      label: "HTMLVideoElement",
      detail: "Aguardando execução no navegador.",
      status: "NÃO VERIFICADO",
    },
    {
      id: "feature-mse",
      label: "MediaSource Extensions (MSE)",
      detail: "Aguardando execução no navegador.",
      status: "NÃO VERIFICADO",
    },
    {
      id: "feature-pip",
      label: "Picture-in-Picture",
      detail: "Aguardando execução no navegador.",
      status: "NÃO VERIFICADO",
    },
    {
      id: "feature-fullscreen",
      label: "Fullscreen API",
      detail: "Aguardando execução no navegador.",
      status: "NÃO VERIFICADO",
    },
  ],
  storageChecks: [
    {
      id: "storage-local",
      label: "localStorage",
      detail: "Aguardando execução no navegador.",
      status: "NÃO VERIFICADO",
    },
    {
      id: "storage-session",
      label: "sessionStorage",
      detail: "Aguardando execução no navegador.",
      status: "NÃO VERIFICADO",
    },
    {
      id: "storage-idb",
      label: "IndexedDB",
      detail: "Aguardando execução no navegador.",
      status: "NÃO VERIFICADO",
    },
    {
      id: "storage-caches",
      label: "Cache Storage",
      detail: "Aguardando execução no navegador.",
      status: "NÃO VERIFICADO",
    },
    {
      id: "storage-sw",
      label: "Service Worker",
      detail: "Aguardando execução no navegador.",
      status: "NÃO VERIFICADO",
    },
    {
      id: "storage-estimate",
      label: "navigator.storage.estimate()",
      detail: "Aguardando execução no navegador.",
      status: "NÃO VERIFICADO",
    },
  ],
  storageQuota: {
    status: "NÃO VERIFICADO",
    usageBytes: null,
    quotaBytes: null,
    percentageText: "--",
    detail: "Aguardando execução no navegador.",
  },
};

function formatBytes(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes) || bytes < 0) return "--";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

interface NavigatorUABrandLike {
  brand: string;
  version: string;
}

interface NavigatorWithUAData extends Navigator {
  userAgentData?: {
    brands?: NavigatorUABrandLike[];
    platform?: string;
    mobile?: boolean;
  };
}

function detectBrowserIdentity(): {
  browserName: string;
  browserVersion: string;
  platform: string;
} {
  const nav = navigator as NavigatorWithUAData;
  const ua = typeof nav.userAgent === "string" ? nav.userAgent : "";

  let platform = "Não identificada";
  const uaDataPlatform = nav.userAgentData?.platform?.trim();
  if (uaDataPlatform) {
    platform = uaDataPlatform;
  } else if (/android/i.test(ua)) {
    platform = "Android";
  } else if (/iphone|ipad|ipod/i.test(ua)) {
    platform = "iOS / iPadOS";
  } else if (/mac os x|macintosh/i.test(ua)) {
    platform = "macOS";
  } else if (/windows/i.test(ua)) {
    platform = "Windows";
  } else if (/cros/i.test(ua)) {
    platform = "ChromeOS";
  } else if (/linux/i.test(ua)) {
    platform = "Linux";
  }

  const brands = nav.userAgentData?.brands;
  if (Array.isArray(brands) && brands.length > 0) {
    const preferredOrder = [
      "Microsoft Edge",
      "Opera",
      "Brave",
      "Google Chrome",
      "Chromium",
    ];
    for (const target of preferredOrder) {
      const found = brands.find(
        (b) => b.brand && b.brand.toLowerCase() === target.toLowerCase(),
      );
      if (found) {
        return {
          browserName: found.brand,
          browserVersion: found.version?.trim() || "Não informada",
          platform,
        };
      }
    }
  }

  const matchers: Array<{ name: string; regex: RegExp }> = [
    { name: "Microsoft Edge", regex: /Edg(?:A|iOS)?\/([\d.]+)/ },
    { name: "Opera", regex: /(?:OPR|Opera)\/([\d.]+)/ },
    { name: "Samsung Internet", regex: /SamsungBrowser\/([\d.]+)/ },
    { name: "Firefox", regex: /(?:Firefox|FxiOS)\/([\d.]+)/ },
    { name: "Chrome", regex: /(?:Chrome|CriOS)\/([\d.]+)/ },
    { name: "Safari", regex: /Version\/([\d.]+).*Safari\// },
  ];

  for (const matcher of matchers) {
    const match = ua.match(matcher.regex);
    if (match) {
      return {
        browserName: matcher.name,
        browserVersion: match[1] || "Não informada",
        platform,
      };
    }
  }

  return {
    browserName: "Navegador não identificado",
    browserVersion: "Não informada",
    platform,
  };
}

function readColorSchemePreference(): string {
  if (typeof window.matchMedia !== "function") {
    return "Indisponível (sem matchMedia)";
  }
  try {
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "Escuro (dark)";
    }
    if (window.matchMedia("(prefers-color-scheme: light)").matches) {
      return "Claro (light)";
    }
    return "Sem preferência definida";
  } catch {
    return "Não verificado";
  }
}

function readTouchSupport(): string {
  try {
    const maxTouch =
      typeof navigator.maxTouchPoints === "number"
        ? navigator.maxTouchPoints
        : 0;
    const hasTouchEvent = "ontouchstart" in window;
    const coarsePointer =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(pointer: coarse)").matches;

    if (maxTouch > 0 || hasTouchEvent || coarsePointer) {
      return maxTouch > 0
        ? `Suportado (até ${maxTouch} ponto${maxTouch > 1 ? "s" : ""})`
        : "Suportado (ponteiro tátil)";
    }
    return "Não detectado (ponteiro não tátil)";
  } catch {
    return "Não verificado";
  }
}

function readDynamicEnvironment(): DeviceEnvironmentInfo {
  const { browserName, browserVersion, platform } = detectBrowserIdentity();
  const dpr =
    typeof window.devicePixelRatio === "number" &&
    Number.isFinite(window.devicePixelRatio)
      ? Number(window.devicePixelRatio.toFixed(2))
      : null;

  return {
    browserName,
    browserVersion,
    platform,
    viewportWidth: typeof window.innerWidth === "number" ? window.innerWidth : null,
    viewportHeight:
      typeof window.innerHeight === "number" ? window.innerHeight : null,
    devicePixelRatio: dpr,
    touchSupport: readTouchSupport(),
    colorScheme: readColorSchemePreference(),
    webApis: [
      {
        name: "matchMedia",
        status: typeof window.matchMedia === "function" ? "SUPORTADO" : "INDISPONÍVEL",
      },
      {
        name: "ResizeObserver",
        status:
          typeof window.ResizeObserver === "function"
            ? "SUPORTADO"
            : "INDISPONÍVEL",
      },
      {
        name: "PerformanceObserver",
        status:
          typeof window.PerformanceObserver === "function"
            ? "SUPORTADO"
            : "INDISPONÍVEL",
      },
      {
        name: "WebAssembly",
        status: typeof WebAssembly === "object" ? "SUPORTADO" : "INDISPONÍVEL",
      },
    ],
  };
}

function inspectStorageAccess(kind: "local" | "session"): CompatibilityCheckItem {
  const label = kind === "local" ? "localStorage" : "sessionStorage";
  const id = kind === "local" ? "storage-local" : "storage-session";

  try {
    const propName = kind === "local" ? "localStorage" : "sessionStorage";
    if (!(propName in window)) {
      return {
        id,
        label,
        status: "INDISPONÍVEL",
        detail: "API não exposta pelo navegador neste contexto.",
      };
    }

    const storage =
      kind === "local" ? window.localStorage : window.sessionStorage;
    if (!storage) {
      return {
        id,
        label,
        status: "INDISPONÍVEL",
        detail: "Armazenamento indisponível neste contexto.",
      };
    }

    const totalKeys = storage.length;
    return {
      id,
      label,
      status: "SUPORTADO",
      detail: `Acesso de leitura ativo (${totalKeys} chave${totalKeys === 1 ? "" : "s"} na origem).`,
    };
  } catch {
    return {
      id,
      label,
      status: "INDISPONÍVEL",
      detail: "Acesso bloqueado por restrição de privacidade ou iframe.",
    };
  }
}

async function inspectIndexedDbAccess(): Promise<CompatibilityCheckItem> {
  try {
    if (!("indexedDB" in window) || !window.indexedDB) {
      return {
        id: "storage-idb",
        label: "IndexedDB",
        status: "INDISPONÍVEL",
        detail: "API IndexedDB não disponível neste navegador.",
      };
    }

    const idb = window.indexedDB as IDBFactory & {
      databases?: () => Promise<Array<{ name?: string }>>;
    };

    if (typeof idb.databases === "function") {
      const dbs = await idb.databases();
      return {
        id: "storage-idb",
        label: "IndexedDB",
        status: "SUPORTADO",
        detail: `API acessível (${dbs.length} banco${dbs.length === 1 ? "" : "s"} listado${dbs.length === 1 ? "" : "s"} na origem).`,
      };
    }

    return {
      id: "storage-idb",
      label: "IndexedDB",
      status: "SUPORTADO",
      detail: "API IndexedDB exposta (listagem automática não suportada neste browser).",
    };
  } catch {
    return {
      id: "storage-idb",
      label: "IndexedDB",
      status: "INDISPONÍVEL",
      detail: "Acesso ao IndexedDB bloqueado por restrições de privacidade.",
    };
  }
}

async function inspectCacheStorageAccess(): Promise<CompatibilityCheckItem> {
  try {
    if (!("caches" in window) || !window.caches) {
      return {
        id: "storage-caches",
        label: "Cache Storage",
        status: "INDISPONÍVEL",
        detail: window.isSecureContext
          ? "API Cache Storage não disponível neste navegador."
          : "Requer contexto seguro (HTTPS) para acesso ao Cache Storage.",
      };
    }

    const keys = await window.caches.keys();
    return {
      id: "storage-caches",
      label: "Cache Storage",
      status: "SUPORTADO",
      detail: `Cache Storage acessível (${keys.length} cache${keys.length === 1 ? "" : "s"} na origem).`,
    };
  } catch {
    return {
      id: "storage-caches",
      label: "Cache Storage",
      status: "INDISPONÍVEL",
      detail: "Acesso negado por política de privacidade ou contexto restrito.",
    };
  }
}

async function inspectServiceWorkerAccess(): Promise<CompatibilityCheckItem> {
  try {
    if (!("serviceWorker" in navigator) || !navigator.serviceWorker) {
      return {
        id: "storage-sw",
        label: "Service Worker",
        status: "INDISPONÍVEL",
        detail: window.isSecureContext
          ? "Service Workers não suportados neste navegador."
          : "Requer contexto seguro (HTTPS) para Service Workers.",
      };
    }

    const regs = await navigator.serviceWorker.getRegistrations();
    return {
      id: "storage-sw",
      label: "Service Worker",
      status: "SUPORTADO",
      detail: `API acessível (${regs.length} registro${regs.length === 1 ? "" : "s"} na origem).`,
    };
  } catch {
    return {
      id: "storage-sw",
      label: "Service Worker",
      status: "INDISPONÍVEL",
      detail: "Consulta bloqueada por contexto restrito ou navegação privada.",
    };
  }
}

async function inspectStorageEstimate(): Promise<{
  check: CompatibilityCheckItem;
  quota: StorageQuotaSummary;
}> {
  try {
    if (
      !("storage" in navigator) ||
      !navigator.storage ||
      typeof navigator.storage.estimate !== "function"
    ) {
      return {
        check: {
          id: "storage-estimate",
          label: "navigator.storage.estimate()",
          status: "INDISPONÍVEL",
          detail: "API navigator.storage.estimate() não suportada neste navegador.",
        },
        quota: {
          status: "INDISPONÍVEL",
          usageBytes: null,
          quotaBytes: null,
          percentageText: "--",
          detail: "API de estimativa de armazenamento não exposta pelo navegador.",
        },
      };
    }

    const estimate = await navigator.storage.estimate();
    const usageBytes =
      typeof estimate.usage === "number" && Number.isFinite(estimate.usage)
        ? estimate.usage
        : null;
    const quotaBytes =
      typeof estimate.quota === "number" && Number.isFinite(estimate.quota)
        ? estimate.quota
        : null;

    const percentageText =
      usageBytes !== null && quotaBytes !== null && quotaBytes > 0
        ? `${((usageBytes / quotaBytes) * 100).toFixed(2)}%`
        : "N/D";

    return {
      check: {
        id: "storage-estimate",
        label: "navigator.storage.estimate()",
        status: "SUPORTADO",
        detail: `Uso estimado: ${formatBytes(usageBytes)} de ${formatBytes(quotaBytes)} (${percentageText}).`,
      },
      quota: {
        status: "SUPORTADO",
        usageBytes,
        quotaBytes,
        percentageText,
        detail: "Estimativa fornecida pelo navegador para toda a origem.",
      },
    };
  } catch {
    return {
      check: {
        id: "storage-estimate",
        label: "navigator.storage.estimate()",
        status: "INDISPONÍVEL",
        detail: "Estimativa bloqueada por restrições de privacidade do navegador.",
      },
      quota: {
        status: "INDISPONÍVEL",
        usageBytes: null,
        quotaBytes: null,
        percentageText: "--",
        detail: "Não foi possível consultar a cota estimada neste contexto.",
      },
    };
  }
}

async function runBrowserCompatibilityAudit(): Promise<CompatibilitySnapshot> {
  const environment = readDynamicEnvironment();

  // 1. Player features & HTMLVideoElement (sem inserir no DOM e sem src)
  let videoEl: HTMLVideoElement | null = null;
  let videoElementSupported = false;
  try {
    if (
      typeof document !== "undefined" &&
      typeof HTMLVideoElement !== "undefined"
    ) {
      videoEl = document.createElement("video");
      videoElementSupported = typeof videoEl.canPlayType === "function";
    }
  } catch {
    videoEl = null;
    videoElementSupported = false;
  }

  // HLS Nativo via HTMLVideoElement.canPlayType()
  let nativeHlsCheck: CompatibilityCheckItem;
  if (!videoEl || !videoElementSupported) {
    nativeHlsCheck = {
      id: "hls-native",
      label: "HLS Nativo (HTMLVideoElement.canPlayType)",
      status: "INDISPONÍVEL",
      detail: "HTMLVideoElement.canPlayType não disponível neste ambiente.",
    };
  } else {
    try {
      const appleMime = videoEl.canPlayType("application/vnd.apple.mpegurl");
      const xMime = videoEl.canPlayType("application/x-mpegurl");
      const nativeLevel = appleMime || xMime;
      if (nativeLevel !== "") {
        nativeHlsCheck = {
          id: "hls-native",
          label: "HLS Nativo (HTMLVideoElement.canPlayType)",
          status: "SUPORTADO",
          meta: `canPlayType="${nativeLevel}"`,
          detail: "Reprodução HLS nativa declarada pelo elemento de vídeo.",
        };
      } else {
        nativeHlsCheck = {
          id: "hls-native",
          label: "HLS Nativo (HTMLVideoElement.canPlayType)",
          status: "NÃO SUPORTADO",
          detail: "Sem suporte HLS nativo; o player utiliza Hls.js via MSE quando disponível.",
        };
      }
    } catch {
      nativeHlsCheck = {
        id: "hls-native",
        label: "HLS Nativo (HTMLVideoElement.canPlayType)",
        status: "NÃO VERIFICADO",
        detail: "Falha ao consultar canPlayType para manifestos HLS.",
      };
    }
  }

  // Hls.js (import dinâmico client-only, sem instanciar player)
  let hlsJsCheck: CompatibilityCheckItem;
  try {
    const { default: HlsClass } = await import("hls.js");
    if (typeof HlsClass?.isSupported === "function") {
      const supported = Boolean(HlsClass.isSupported());
      const versionLabel = HlsClass.version ? `v${HlsClass.version}` : "versão não informada";
      hlsJsCheck = {
        id: "hls-js",
        label: "Hls.js (Hls.isSupported)",
        status: supported ? "SUPORTADO" : "NÃO SUPORTADO",
        meta: versionLabel,
        detail: supported
          ? `Biblioteca hls.js (${versionLabel}) pronta para streaming MSE.`
          : `Hls.isSupported() retornou false (${versionLabel}); dependente de HLS nativo ou MSE.`,
      };
    } else {
      hlsJsCheck = {
        id: "hls-js",
        label: "Hls.js (Hls.isSupported)",
        status: "NÃO VERIFICADO",
        detail: "Método Hls.isSupported() não encontrado no módulo carregado.",
      };
    }
  } catch {
    hlsJsCheck = {
      id: "hls-js",
      label: "Hls.js (Hls.isSupported)",
      status: "NÃO VERIFICADO",
      detail: "Não foi possível carregar hls.js dinamicamente neste ambiente.",
    };
  }

  // MediaSource & Codecs
  const mseAvailable =
    typeof window.MediaSource !== "undefined" &&
    typeof window.MediaSource.isTypeSupported === "function";

  const codecCandidates: Array<{
    id: string;
    label: string;
    mimes: string[];
  }> = [
    {
      id: "codec-h264",
      label: "H.264 / AVC",
      mimes: [
        'video/mp4; codecs="avc1.42E01E, mp4a.40.2"',
        'video/mp4; codecs="avc1.640028, mp4a.40.2"',
      ],
    },
    {
      id: "codec-hevc",
      label: "HEVC / H.265",
      mimes: [
        'video/mp4; codecs="hvc1.1.6.L93.B0"',
        'video/mp4; codecs="hev1.1.6.L93.B0"',
      ],
    },
    {
      id: "codec-vp9",
      label: "VP9",
      mimes: [
        'video/webm; codecs="vp9, opus"',
        'video/mp4; codecs="vp09.00.10.08"',
      ],
    },
    {
      id: "codec-av1",
      label: "AV1",
      mimes: [
        'video/mp4; codecs="av01.0.04M.08"',
        'video/webm; codecs="av01.0.04M.08"',
      ],
    },
    {
      id: "codec-aac",
      label: "AAC / MP4A",
      mimes: ['audio/mp4; codecs="mp4a.40.2"'],
    },
  ];

  const codecChecks: CompatibilityCheckItem[] = codecCandidates.map((codec) => {
    if (!mseAvailable) {
      return {
        id: codec.id,
        label: codec.label,
        status: "INDISPONÍVEL",
        meta: codec.mimes[0],
        detail: "MediaSource.isTypeSupported() indisponível neste navegador.",
      };
    }

    try {
      const supportedMimes = codec.mimes.filter((m) =>
        window.MediaSource.isTypeSupported(m),
      );
      if (supportedMimes.length > 0) {
        return {
          id: codec.id,
          label: codec.label,
          status: "SUPORTADO",
          meta: supportedMimes[0],
          detail: `MediaSource declarou suporte (${supportedMimes.length}/${codec.mimes.length} perfil${codec.mimes.length > 1 ? "is" : ""}).`,
        };
      }
      return {
        id: codec.id,
        label: codec.label,
        status: "NÃO SUPORTADO",
        meta: codec.mimes[0],
        detail: "MediaSource.isTypeSupported() retornou false para os perfis consultados.",
      };
    } catch {
      return {
        id: codec.id,
        label: codec.label,
        status: "NÃO VERIFICADO",
        meta: codec.mimes[0],
        detail: "Erro ao consultar MediaSource.isTypeSupported().",
      };
    }
  });

  // Outros recursos do player
  let pipStatus: CompatibilityStatus = "INDISPONÍVEL";
  let pipDetail = "API Picture-in-Picture não exposta pelo navegador.";
  try {
    if ("pictureInPictureEnabled" in document) {
      const hasReq =
        typeof HTMLVideoElement !== "undefined" &&
        "requestPictureInPicture" in HTMLVideoElement.prototype;
      if (document.pictureInPictureEnabled && hasReq) {
        pipStatus = "SUPORTADO";
        pipDetail = "document.pictureInPictureEnabled ativo para vídeos.";
      } else {
        pipStatus = "NÃO SUPORTADO";
        pipDetail = "Picture-in-Picture desabilitado ou sem suporte no elemento de vídeo.";
      }
    }
  } catch {
    pipStatus = "NÃO VERIFICADO";
    pipDetail = "Não foi possível inspecionar Picture-in-Picture.";
  }

  let fsStatus: CompatibilityStatus = "INDISPONÍVEL";
  let fsDetail = "Fullscreen API não exposta neste contexto.";
  try {
    const docWithWebkit = document as Document & {
      webkitFullscreenEnabled?: boolean;
    };
    if (
      "fullscreenEnabled" in document ||
      "webkitFullscreenEnabled" in docWithWebkit
    ) {
      const enabled = Boolean(
        document.fullscreenEnabled ?? docWithWebkit.webkitFullscreenEnabled,
      );
      fsStatus = enabled ? "SUPORTADO" : "NÃO SUPORTADO";
      fsDetail = enabled
        ? "Modo tela cheia habilitado pelo navegador/documento."
        : "Tela cheia bloqueada pela política atual do documento/iframe.";
    }
  } catch {
    fsStatus = "NÃO VERIFICADO";
    fsDetail = "Não foi possível inspecionar a Fullscreen API.";
  }

  const playerFeatureChecks: CompatibilityCheckItem[] = [
    {
      id: "feature-video-el",
      label: "HTMLVideoElement",
      status: videoElementSupported ? "SUPORTADO" : "INDISPONÍVEL",
      detail: videoElementSupported
        ? "Elemento nativo <video> com suporte a canPlayType()."
        : "Elemento HTMLVideoElement indisponível.",
    },
    {
      id: "feature-mse",
      label: "MediaSource Extensions (MSE)",
      status: mseAvailable ? "SUPORTADO" : "INDISPONÍVEL",
      detail: mseAvailable
        ? "API window.MediaSource.isTypeSupported() disponível."
        : "window.MediaSource ausente (comum em iOS sem MSE; depende de HLS nativo).",
    },
    {
      id: "feature-pip",
      label: "Picture-in-Picture",
      status: pipStatus,
      detail: pipDetail,
    },
    {
      id: "feature-fullscreen",
      label: "Fullscreen API",
      status: fsStatus,
      detail: fsDetail,
    },
  ];

  // Armazenamento e recursos offline (somente leitura)
  const localCheck = inspectStorageAccess("local");
  const sessionCheck = inspectStorageAccess("session");
  const [idbCheck, cacheCheck, swCheck, estimateRes] = await Promise.all([
    inspectIndexedDbAccess(),
    inspectCacheStorageAccess(),
    inspectServiceWorkerAccess(),
    inspectStorageEstimate(),
  ]);

  return {
    checkedAt: new Date().toLocaleTimeString("pt-BR"),
    environment,
    hlsChecks: [nativeHlsCheck, hlsJsCheck],
    codecChecks,
    playerFeatureChecks,
    storageChecks: [
      localCheck,
      sessionCheck,
      idbCheck,
      cacheCheck,
      swCheck,
      estimateRes.check,
    ],
    storageQuota: estimateRes.quota,
  };
}

function StatusBadge({ status }: { status: CompatibilityStatus }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-medium border ${STATUS_BADGE_MAP[status]}`}
    >
      <span className={`size-1.5 rounded-full ${STATUS_DOT_MAP[status]}`} />
      <span>{status}</span>
    </span>
  );
}

export function CompatibilityPanel() {
  const [snapshot, setSnapshot] =
    useState<CompatibilitySnapshot>(INITIAL_SNAPSHOT);
  const [isRunning, setIsRunning] = useState(false);

  const isMountedRef = useRef(true);
  const inFlightRef = useRef(false);

  const executeAudit = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setIsRunning(true);

    try {
      const next = await runBrowserCompatibilityAudit();
      if (!isMountedRef.current) return;
      setSnapshot(next);
    } finally {
      inFlightRef.current = false;
      if (isMountedRef.current) {
        setIsRunning(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    void executeAudit();

    let rafId: number | null = null;
    const syncDynamicOnly = () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      rafId = window.requestAnimationFrame(() => {
        if (!isMountedRef.current) return;
        const env = readDynamicEnvironment();
        setSnapshot((prev) => ({
          ...prev,
          environment: env,
        }));
      });
    };

    window.addEventListener("resize", syncDynamicOnly, { passive: true });

    let colorMedia: MediaQueryList | null = null;
    if (typeof window.matchMedia === "function") {
      try {
        colorMedia = window.matchMedia("(prefers-color-scheme: dark)");
        if (typeof colorMedia.addEventListener === "function") {
          colorMedia.addEventListener("change", syncDynamicOnly);
        }
      } catch {
        colorMedia = null;
      }
    }

    return () => {
      isMountedRef.current = false;
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      window.removeEventListener("resize", syncDynamicOnly);
      if (colorMedia && typeof colorMedia.removeEventListener === "function") {
        colorMedia.removeEventListener("change", syncDynamicOnly);
      }
    };
  }, [executeAudit]);

  const summary = useMemo(() => {
    const allChecks = [
      ...snapshot.hlsChecks,
      ...snapshot.codecChecks,
      ...snapshot.playerFeatureChecks,
      ...snapshot.storageChecks,
    ];

    let supported = 0;
    let unsupported = 0;
    let unavailable = 0;
    let unverified = 0;

    for (const item of allChecks) {
      if (item.status === "SUPORTADO") supported += 1;
      else if (item.status === "NÃO SUPORTADO") unsupported += 1;
      else if (item.status === "INDISPONÍVEL") unavailable += 1;
      else unverified += 1;
    }

    const hlsNative = snapshot.hlsChecks.find((c) => c.id === "hls-native");
    const hlsJs = snapshot.hlsChecks.find((c) => c.id === "hls-js");
    const hasPlaybackPath =
      hlsNative?.status === "SUPORTADO" || hlsJs?.status === "SUPORTADO";

    return {
      total: allChecks.length,
      supported,
      unsupported,
      unavailable,
      unverified,
      hasPlaybackPath,
    };
  }, [snapshot]);

  const { environment, storageQuota } = snapshot;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Cabeçalho do módulo */}
      <div className="rounded-xl border border-[#262B36] bg-[#111318] p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="size-9 shrink-0 rounded-lg bg-[#06B6D4]/15 border border-[#06B6D4]/30 flex items-center justify-center text-[#06B6D4]">
            <MonitorSmartphone className="size-5" />
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-bold text-white font-sans tracking-tight">
                Compatibilidade de Dispositivo e Player
              </h2>
              <span className="px-2 py-0.5 rounded text-[9px] font-mono font-semibold bg-[#181B22] text-[#06B6D4] border border-[#06B6D4]/30">
                CLIENT-ONLY
              </span>
            </div>
            <p className="text-xs text-[#9CA3AF] font-sans leading-relaxed">
              Inspeção local somente leitura das capacidades do navegador, suporte HLS/MediaSource e APIs offline deste dispositivo. Nenhuma consulta de servidor ou download é executado.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <span className="px-2.5 py-1.5 rounded-lg bg-[#181B22] border border-[#262B36] text-[10px] font-mono text-[#9CA3AF]">
            Verificado: {snapshot.checkedAt ?? "--:--:--"}
          </span>
          <button
            type="button"
            onClick={() => void executeAudit()}
            disabled={isRunning}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#181B22] hover:bg-[#212630] disabled:opacity-60 disabled:cursor-not-allowed border border-[#262B36] text-xs font-sans font-medium text-white transition-colors cursor-pointer"
          >
            <RefreshCw
              className={`size-3.5 text-[#06B6D4] ${isRunning ? "animate-spin" : ""}`}
            />
            <span>{isRunning ? "Verificando..." : "Reexecutar Verificações"}</span>
          </button>
        </div>
      </div>

      {/* D. Resumo de compatibilidade */}
      <section className="rounded-xl border border-[#262B36] bg-[#111318] p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-[#8B5CF6]" />
            <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#E5E7EB]">
              Resumo de Compatibilidade
            </h3>
          </div>
          <span className="text-[11px] font-mono text-[#9CA3AF]">
            {summary.total} verificações reais executadas no navegador
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-lg border border-[#10B981]/30 bg-[#181B22] p-3.5 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#10B981]">
              Suportados
            </span>
            <div className="text-2xl font-bold font-mono text-white">
              {summary.supported}
            </div>
            <p className="text-[11px] text-[#9CA3AF] font-sans">
              Recursos ativos neste browser
            </p>
          </div>

          <div className="rounded-lg border border-[#F59E0B]/30 bg-[#181B22] p-3.5 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#F59E0B]">
              Não Suportados
            </span>
            <div className="text-2xl font-bold font-mono text-white">
              {summary.unsupported}
            </div>
            <p className="text-[11px] text-[#9CA3AF] font-sans">
              Codecs ou modos não aceitos
            </p>
          </div>

          <div className="rounded-lg border border-[#94A3B8]/30 bg-[#181B22] p-3.5 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#94A3B8]">
              Indisponíveis
            </span>
            <div className="text-2xl font-bold font-mono text-white">
              {summary.unavailable}
            </div>
            <p className="text-[11px] text-[#9CA3AF] font-sans">
              APIs ausentes ou restritas
            </p>
          </div>

          <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-3.5 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#6B7280]">
              Não Verificados
            </span>
            <div className="text-2xl font-bold font-mono text-white">
              {summary.unverified}
            </div>
            <p className="text-[11px] text-[#9CA3AF] font-sans">
              Pendentes ou sem acesso seguro
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-[#262B36] bg-[#181B22] px-4 py-3 flex items-start gap-3">
          {snapshot.checkedAt === null ? (
            <AlertCircle className="size-4 text-[#6B7280] shrink-0 mt-0.5" />
          ) : summary.hasPlaybackPath ? (
            <CheckCircle2 className="size-4 text-[#10B981] shrink-0 mt-0.5" />
          ) : (
            <ShieldAlert className="size-4 text-[#F59E0B] shrink-0 mt-0.5" />
          )}
          <p className="text-xs text-[#9CA3AF] font-sans leading-relaxed">
            {snapshot.checkedAt === null
              ? "Aguardando execução das verificações locais no navegador."
              : summary.hasPlaybackPath
                ? "Caminho de reprodução HLS disponível neste dispositivo (via Hls.js e/ou HLS nativo). A ausência de um codec opcional como HEVC ou AV1 não torna o dispositivo incompatível com o Hikari."
                : "Nenhum caminho HLS (nativo ou Hls.js) foi confirmado neste navegador. Reproduções MP4 diretas ainda podem funcionar caso o navegador suporte HTMLVideoElement."}
          </p>
        </div>
      </section>

      {/* A. Navegador e dispositivo */}
      <section className="rounded-xl border border-[#262B36] bg-[#111318] p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Cpu className="size-4 text-[#06B6D4]" />
          <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#E5E7EB]">
            A. Navegador e Dispositivo
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-3.5 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#6B7280]">
              Navegador &amp; Versão
            </span>
            <div className="text-sm font-semibold text-white font-sans truncate">
              {environment.browserName}
            </div>
            <div className="text-xs font-mono text-[#06B6D4]">
              Versão: {environment.browserVersion}
            </div>
          </div>

          <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-3.5 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#6B7280]">
              Plataforma / Sistema
            </span>
            <div className="text-sm font-semibold text-white font-sans truncate">
              {environment.platform}
            </div>
            <div className="text-xs font-mono text-[#9CA3AF]">
              DPR: {environment.devicePixelRatio !== null ? `${environment.devicePixelRatio}x` : "--"}
            </div>
          </div>

          <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-3.5 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#6B7280]">
              Viewport Atual
            </span>
            <div className="text-sm font-semibold font-mono text-white">
              {environment.viewportWidth !== null && environment.viewportHeight !== null
                ? `${environment.viewportWidth} × ${environment.viewportHeight} px`
                : "--"}
            </div>
            <div className="text-[11px] text-[#9CA3AF] font-sans">
              Atualizada dinamicamente ao redimensionar
            </div>
          </div>

          <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-3.5 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#6B7280]">
              Interação por Toque
            </span>
            <div className="text-xs font-semibold text-white font-sans">
              {environment.touchSupport}
            </div>
          </div>

          <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-3.5 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#6B7280]">
              Esquema de Cores Preferido
            </span>
            <div className="text-xs font-semibold text-white font-sans">
              {environment.colorScheme}
            </div>
          </div>

          <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-3.5 space-y-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#6B7280]">
              APIs Base do Navegador
            </span>
            <div className="flex flex-wrap gap-1.5">
              {environment.webApis.map((api) => (
                <span
                  key={api.name}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono border ${STATUS_BADGE_MAP[api.status]}`}
                >
                  <span>{api.name}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* B. Compatibilidade do player */}
      <section className="rounded-xl border border-[#262B36] bg-[#111318] p-5 space-y-5">
        <div className="flex items-center gap-2">
          <PlaySquare className="size-4 text-[#8B5CF6]" />
          <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#E5E7EB]">
            B. Compatibilidade do Player
          </h3>
        </div>

        {/* Subgrupo HLS */}
        <div className="space-y-2.5">
          <h4 className="text-[11px] font-mono uppercase tracking-wider text-[#9CA3AF]">
            Motor de Streaming HLS
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {snapshot.hlsChecks.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-[#262B36] bg-[#181B22] p-3.5 space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-white font-sans">
                    {item.label}
                  </span>
                  <StatusBadge status={item.status} />
                </div>
                {item.meta && (
                  <div className="text-[11px] font-mono text-[#06B6D4] break-all">
                    {item.meta}
                  </div>
                )}
                <p className="text-[11px] text-[#9CA3AF] font-sans leading-relaxed">
                  {item.detail}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Subgrupo MediaSource & Codecs */}
        <div className="space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <h4 className="text-[11px] font-mono uppercase tracking-wider text-[#9CA3AF]">
              MediaSource &amp; Codecs Declarados
            </h4>
            <span className="text-[10px] font-mono text-[#6B7280]">
              MediaSource.isTypeSupported()
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {snapshot.codecChecks.map((codec) => (
              <div
                key={codec.id}
                className="rounded-lg border border-[#262B36] bg-[#181B22] p-3.5 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-white font-sans">
                    {codec.label}
                  </span>
                  <StatusBadge status={codec.status} />
                </div>
                {codec.meta && (
                  <div className="text-[10px] font-mono text-[#9CA3AF] break-all bg-[#111318] border border-[#262B36] rounded px-2 py-1">
                    {codec.meta}
                  </div>
                )}
                <p className="text-[11px] text-[#9CA3AF] font-sans leading-snug">
                  {codec.detail}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-[#262B36] bg-[#181B22]/70 px-3.5 py-2.5 flex items-start gap-2.5">
            <Info className="size-3.5 text-[#06B6D4] shrink-0 mt-0.5" />
            <p className="text-[11px] text-[#9CA3AF] font-sans leading-relaxed">
              Os resultados de <code className="font-mono text-[#E5E7EB]">MediaSource.isTypeSupported()</code> e <code className="font-mono text-[#E5E7EB]">canPlayType()</code> refletem apenas o suporte declarado pelo navegador para os perfis MIME testados; não garantem reprodução de qualquer stream específico.
            </p>
          </div>
        </div>

        {/* Subgrupo Outros recursos do player */}
        <div className="space-y-2.5">
          <h4 className="text-[11px] font-mono uppercase tracking-wider text-[#9CA3AF]">
            Recursos Complementares do Player
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {snapshot.playerFeatureChecks.map((feat) => (
              <div
                key={feat.id}
                className="rounded-lg border border-[#262B36] bg-[#181B22] p-3.5 space-y-1.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-white font-sans">
                    {feat.label}
                  </span>
                  <StatusBadge status={feat.status} />
                </div>
                <p className="text-[11px] text-[#9CA3AF] font-sans leading-relaxed">
                  {feat.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* C. Armazenamento e recursos offline */}
      <section className="rounded-xl border border-[#262B36] bg-[#111318] p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
          <div className="flex items-center gap-2">
            <HardDrive className="size-4 text-[#10B981]" />
            <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#E5E7EB]">
              C. Armazenamento e Recursos Offline
            </h3>
          </div>
          <span className="text-[10px] font-mono text-[#6B7280]">
            Verificação não destrutiva (sem leitura de dados sensíveis)
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {snapshot.storageChecks.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-[#262B36] bg-[#181B22] p-3.5 space-y-1.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-white font-sans">
                  {item.label}
                </span>
                <StatusBadge status={item.status} />
              </div>
              <p className="text-[11px] text-[#9CA3AF] font-sans leading-relaxed">
                {item.detail}
              </p>
            </div>
          ))}
        </div>

        {/* Cartão resumido de quota quando disponível */}
        <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-white font-sans">
              Estimativa de Cota da Origem (navigator.storage.estimate)
            </span>
            <StatusBadge status={storageQuota.status} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded border border-[#262B36] bg-[#111318] p-3">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#6B7280] block">
                Espaço Utilizado
              </span>
              <span className="text-sm font-bold font-mono text-white mt-1 block">
                {formatBytes(storageQuota.usageBytes)}
              </span>
            </div>
            <div className="rounded border border-[#262B36] bg-[#111318] p-3">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#6B7280] block">
                Quota Estimada
              </span>
              <span className="text-sm font-bold font-mono text-white mt-1 block">
                {formatBytes(storageQuota.quotaBytes)}
              </span>
            </div>
            <div className="rounded border border-[#262B36] bg-[#111318] p-3">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#6B7280] block">
                Percentual Utilizado
              </span>
              <span className="text-sm font-bold font-mono text-[#06B6D4] mt-1 block">
                {storageQuota.percentageText}
              </span>
            </div>
          </div>

          <p className="text-[11px] text-[#9CA3AF] font-sans">
            {storageQuota.detail}
          </p>
        </div>
      </section>
    </div>
  );
}
