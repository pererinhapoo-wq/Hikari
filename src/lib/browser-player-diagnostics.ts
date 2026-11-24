export type PlayerModuleStatus =
  | "SAUDÁVEL"
  | "ATENÇÃO"
  | "CRÍTICO"
  | "INDISPONÍVEL"
  | "NÃO VERIFICADO"
  | "PARCIAL";

export interface PlayerCheckResult {
  id: string;
  label: string;
  status: PlayerModuleStatus;
  meta?: string;
  detail: string;
}

export interface PlayerCodecResult {
  id: string;
  label: string;
  status: PlayerModuleStatus;
  mimeTested: string;
  detail: string;
}

export interface PlayerPreferenceReadonly {
  key: string;
  label: string;
  value: string;
}

export interface BrowserPlayerDiagnosticsReport {
  isBrowserEnvironment: boolean;
  measuredAt: string;
  overallStatus: PlayerModuleStatus;
  overallSummary: string;
  activeStrategySummary: string;
  environmentFlags: {
    isAndroid: boolean;
    isIos: boolean;
    isBraveLike: boolean;
    hlsWorkerExpected: boolean;
  };
  engines: {
    nativeHls: PlayerCheckResult;
    hlsJs: PlayerCheckResult;
    mediaSource: PlayerCheckResult;
    htmlVideo: PlayerCheckResult;
  };
  features: {
    pictureInPicture: PlayerCheckResult;
    fullscreen: PlayerCheckResult;
  };
  codecs: PlayerCodecResult[];
  preferences: {
    available: boolean;
    items: PlayerPreferenceReadonly[];
  };
  architectureNotes: string[];
  limitations: string[];
}

interface NavigatorWithBrave extends Navigator {
  brave?: unknown;
}

let cachedPlayerDiagnostics: BrowserPlayerDiagnosticsReport | null = null;

export function createNonBrowserPlayerDiagnosticsReport(): BrowserPlayerDiagnosticsReport {
  return {
    isBrowserEnvironment: false,
    measuredAt: "--:--:--",
    overallStatus: "NÃO VERIFICADO",
    overallSummary: "Aguardando execução no navegador (ambiente SSR).",
    activeStrategySummary: "Não verificado fora do navegador.",
    environmentFlags: {
      isAndroid: false,
      isIos: false,
      isBraveLike: false,
      hlsWorkerExpected: false,
    },
    engines: {
      nativeHls: {
        id: "native-hls",
        label: "HLS Nativo (HTMLVideoElement.canPlayType)",
        status: "NÃO VERIFICADO",
        detail: "Aguardando execução no navegador.",
      },
      hlsJs: {
        id: "hls-js",
        label: "Hls.js (MSE Streaming)",
        status: "NÃO VERIFICADO",
        detail: "Aguardando execução no navegador.",
      },
      mediaSource: {
        id: "mse",
        label: "MediaSource Extensions (MSE)",
        status: "NÃO VERIFICADO",
        detail: "Aguardando execução no navegador.",
      },
      htmlVideo: {
        id: "html-video",
        label: "HTMLVideoElement (<video>)",
        status: "NÃO VERIFICADO",
        detail: "Aguardando execução no navegador.",
      },
    },
    features: {
      pictureInPicture: {
        id: "pip",
        label: "Picture-in-Picture (PiP)",
        status: "NÃO VERIFICADO",
        detail: "Aguardando execução no navegador.",
      },
      fullscreen: {
        id: "fullscreen",
        label: "Fullscreen API",
        status: "NÃO VERIFICADO",
        detail: "Aguardando execução no navegador.",
      },
    },
    codecs: [],
    preferences: {
      available: false,
      items: [],
    },
    architectureNotes: [],
    limitations: ["Diagnóstico client-only aguardando montagem no navegador."],
  };
}

function readPlayerPreferencesReadonly(): BrowserPlayerDiagnosticsReport["preferences"] {
  try {
    if (!("localStorage" in window) || !window.localStorage) {
      return { available: false, items: [] };
    }
    const keys: Array<{ key: string; label: string; fallback: string }> = [
      {
        key: "hikari_player_mode",
        label: "Modo preferido (Player.tsx)",
        fallback: "Padrão automático (native quando há URL)",
      },
      {
        key: "nova_player_playback_rate",
        label: "Velocidade salva (CustomVideoPlayer)",
        fallback: "1x (padrão)",
      },
      {
        key: "nova_player_quality_preference",
        label: "Qualidade salva (CustomVideoPlayer)",
        fallback: "Automática (padrão)",
      },
    ];

    const items: PlayerPreferenceReadonly[] = keys.map((item) => {
      const raw = window.localStorage.getItem(item.key);
      return {
        key: item.key,
        label: item.label,
        value: raw && raw.trim() ? raw.trim() : item.fallback,
      };
    });

    return { available: true, items };
  } catch {
    return { available: false, items: [] };
  }
}

export async function collectBrowserPlayerDiagnostics(options?: {
  forceRefresh?: boolean;
}): Promise<BrowserPlayerDiagnosticsReport> {
  if (
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    typeof navigator === "undefined"
  ) {
    return createNonBrowserPlayerDiagnosticsReport();
  }

  if (!options?.forceRefresh && cachedPlayerDiagnostics) {
    return cachedPlayerDiagnostics;
  }

  const ua = typeof navigator.userAgent === "string" ? navigator.userAgent : "";
  const isAndroid = /android/i.test(ua);
  const isIos = /iphone|ipad|ipod/i.test(ua);
  const isBraveLike = Boolean((navigator as NavigatorWithBrave).brave);
  const hlsWorkerExpected = !isAndroid;

  // Elemento <video> transitório em memória apenas para canPlayType (nunca anexado ao DOM nem com src)
  let videoEl: HTMLVideoElement | null = null;
  let hasVideoElement = false;
  try {
    if (typeof HTMLVideoElement !== "undefined") {
      videoEl = document.createElement("video");
      hasVideoElement = typeof videoEl.canPlayType === "function";
    }
  } catch {
    videoEl = null;
    hasVideoElement = false;
  }

  const htmlVideo: PlayerCheckResult = {
    id: "html-video",
    label: "HTMLVideoElement (<video>)",
    status: hasVideoElement ? "SAUDÁVEL" : "INDISPONÍVEL",
    detail: hasVideoElement
      ? "Elemento <video> nativo e canPlayType() operacionais no navegador."
      : "HTMLVideoElement indisponível neste ambiente.",
  };

  let nativeHls: PlayerCheckResult;
  let canPlayNativeHls = false;
  if (!videoEl || !hasVideoElement) {
    nativeHls = {
      id: "native-hls",
      label: "HLS Nativo (canPlayType)",
      status: "INDISPONÍVEL",
      detail: "Não foi possível consultar canPlayType() sem HTMLVideoElement.",
    };
  } else {
    try {
      const appleMime = videoEl.canPlayType("application/vnd.apple.mpegurl");
      const xMime = videoEl.canPlayType("application/x-mpegurl");
      const level = appleMime || xMime;
      canPlayNativeHls = level !== "";
      nativeHls = canPlayNativeHls
        ? {
            id: "native-hls",
            label: "HLS Nativo (canPlayType)",
            status: "SAUDÁVEL",
            meta: `canPlayType="${level}"`,
            detail:
              "O navegador declara suporte nativo a manifestos HLS (.m3u8). O CustomVideoPlayer tenta reprodução nativa primeiro com fallback automático para Hls.js.",
          }
        : {
            id: "native-hls",
            label: "HLS Nativo (canPlayType)",
            status: "PARCIAL",
            detail:
              "Sem suporte HLS nativo declarado (esperado no Chrome/Edge/Firefox). A reprodução depende do motor Hls.js via MSE.",
          };
    } catch {
      nativeHls = {
        id: "native-hls",
        label: "HLS Nativo (canPlayType)",
        status: "NÃO VERIFICADO",
        detail: "Erro ao consultar suporte HLS nativo.",
      };
    }
  }

  const mseSupported =
    typeof window.MediaSource !== "undefined" &&
    typeof window.MediaSource.isTypeSupported === "function";

  const mediaSource: PlayerCheckResult = {
    id: "mse",
    label: "MediaSource Extensions (MSE)",
    status: mseSupported ? "SAUDÁVEL" : canPlayNativeHls ? "ATENÇÃO" : "CRÍTICO",
    detail: mseSupported
      ? "MediaSource.isTypeSupported() disponível para demux/buffer via Hls.js."
      : canPlayNativeHls
        ? "MSE indisponível (típico em iOS Safari/WebKit); o player depende exclusivamente do HLS nativo."
        : "MSE indisponível e sem HLS nativo detectado.",
  };

  // Importa apenas metadados e isSupported() sem instanciar new Hls()
  let hlsJs: PlayerCheckResult;
  let hlsJsSupported = false;
  try {
    const { default: HlsClass } = await import("hls.js");
    if (typeof HlsClass?.isSupported === "function") {
      hlsJsSupported = Boolean(HlsClass.isSupported());
      const versionLabel = HlsClass.version ? `v${HlsClass.version}` : "versão não informada";
      hlsJs = hlsJsSupported
        ? {
            id: "hls-js",
            label: "Hls.js (Hls.isSupported)",
            status: "SAUDÁVEL",
            meta: `${versionLabel} • Worker: ${hlsWorkerExpected ? "habilitado" : "desativado (Android)"}`,
            detail: isAndroid
              ? `Hls.js ${versionLabel} compatível. Em Android o CustomVideoPlayer configura enableWorker: false para evitar falhas de Web Worker.`
              : `Hls.js ${versionLabel} compatível e pronto para anexar streams MSE quando acionado pelo player.`,
          }
        : {
            id: "hls-js",
            label: "Hls.js (Hls.isSupported)",
            status: canPlayNativeHls ? "ATENÇÃO" : "CRÍTICO",
            meta: versionLabel,
            detail: canPlayNativeHls
              ? `Hls.isSupported() retornou false (${versionLabel}); fallback garantido apenas via HLS nativo.`
              : `Hls.isSupported() retornou false (${versionLabel}) e não há HLS nativo disponível.`,
          };
    } else {
      hlsJs = {
        id: "hls-js",
        label: "Hls.js (Hls.isSupported)",
        status: "NÃO VERIFICADO",
        detail: "Hls.isSupported() não encontrado no módulo carregado.",
      };
    }
  } catch {
    hlsJs = {
      id: "hls-js",
      label: "Hls.js (Hls.isSupported)",
      status: "NÃO VERIFICADO",
      detail: "Não foi possível importar o módulo hls.js no navegador.",
    };
  }

  // Codecs relevantes para streaming de anime
  const codecSpecs: Array<{
    id: string;
    label: string;
    mimes: string[];
    requiredForHikari: boolean;
  }> = [
    {
      id: "h264",
      label: "H.264 / AVC (Vídeo Principal)",
      mimes: [
        'video/mp4; codecs="avc1.42E01E, mp4a.40.2"',
        'video/mp4; codecs="avc1.640028, mp4a.40.2"',
      ],
      requiredForHikari: true,
    },
    {
      id: "aac",
      label: "AAC / MP4A (Áudio Principal)",
      mimes: ['audio/mp4; codecs="mp4a.40.2"'],
      requiredForHikari: true,
    },
    {
      id: "hevc",
      label: "HEVC / H.265 (Opcional)",
      mimes: [
        'video/mp4; codecs="hvc1.1.6.L93.B0"',
        'video/mp4; codecs="hev1.1.6.L93.B0"',
      ],
      requiredForHikari: false,
    },
    {
      id: "vp9",
      label: "VP9 (Opcional / WebM)",
      mimes: [
        'video/webm; codecs="vp9, opus"',
        'video/mp4; codecs="vp09.00.10.08"',
      ],
      requiredForHikari: false,
    },
    {
      id: "av1",
      label: "AV1 (Opcional / Alta Eficiência)",
      mimes: [
        'video/mp4; codecs="av01.0.04M.08"',
        'video/webm; codecs="av01.0.04M.08"',
      ],
      requiredForHikari: false,
    },
  ];

  const codecs: PlayerCodecResult[] = codecSpecs.map((spec) => {
    if (mseSupported) {
      try {
        const matched = spec.mimes.find((m) =>
          window.MediaSource.isTypeSupported(m),
        );
        if (matched) {
          return {
            id: spec.id,
            label: spec.label,
            status: "SAUDÁVEL",
            mimeTested: matched,
            detail: "Confirmado via MediaSource.isTypeSupported().",
          };
        }
        return {
          id: spec.id,
          label: spec.label,
          status: spec.requiredForHikari ? "ATENÇÃO" : "PARCIAL",
          mimeTested: spec.mimes[0],
          detail: spec.requiredForHikari
            ? "Perfil padrão não confirmado via MSE; reprodução depende de HLS nativo ou MP4."
            : "Codec opcional não declarado pelo MSE; não compromete streams H.264/AAC padrão.",
        };
      } catch {
        return {
          id: spec.id,
          label: spec.label,
          status: "NÃO VERIFICADO",
          mimeTested: spec.mimes[0],
          detail: "Erro ao consultar MediaSource.isTypeSupported().",
        };
      }
    }

    if (videoEl && hasVideoElement) {
      try {
        const matched = spec.mimes.find((m) => videoEl!.canPlayType(m) !== "");
        if (matched) {
          return {
            id: spec.id,
            label: spec.label,
            status: "SAUDÁVEL",
            mimeTested: matched,
            detail: "Confirmado via HTMLVideoElement.canPlayType() (sem MSE).",
          };
        }
      } catch {
        // segue abaixo
      }
    }

    return {
      id: spec.id,
      label: spec.label,
      status: mseSupported ? "NÃO VERIFICADO" : "INDISPONÍVEL",
      mimeTested: spec.mimes[0],
      detail: "MediaSource.isTypeSupported() indisponível neste dispositivo.",
    };
  });

  // PiP & Fullscreen
  let pictureInPicture: PlayerCheckResult;
  try {
    if ("pictureInPictureEnabled" in document) {
      const hasReq =
        typeof HTMLVideoElement !== "undefined" &&
        "requestPictureInPicture" in HTMLVideoElement.prototype;
      const enabled = Boolean(document.pictureInPictureEnabled && hasReq);
      pictureInPicture = {
        id: "pip",
        label: "Picture-in-Picture (PiP)",
        status: enabled ? "SAUDÁVEL" : "ATENÇÃO",
        detail: enabled
          ? "API Picture-in-Picture habilitada pelo documento e HTMLVideoElement."
          : "Picture-in-Picture desabilitado ou não suportado neste contexto.",
      };
    } else {
      pictureInPicture = {
        id: "pip",
        label: "Picture-in-Picture (PiP)",
        status: "INDISPONÍVEL",
        detail: "document.pictureInPictureEnabled ausente neste navegador.",
      };
    }
  } catch {
    pictureInPicture = {
      id: "pip",
      label: "Picture-in-Picture (PiP)",
      status: "NÃO VERIFICADO",
      detail: "Não foi possível verificar suporte a Picture-in-Picture.",
    };
  }

  let fullscreen: PlayerCheckResult;
  try {
    const docExtra = document as Document & {
      webkitFullscreenEnabled?: boolean;
    };
    if (
      "fullscreenEnabled" in document ||
      "webkitFullscreenEnabled" in docExtra
    ) {
      const enabled = Boolean(
        document.fullscreenEnabled ?? docExtra.webkitFullscreenEnabled,
      );
      fullscreen = {
        id: "fullscreen",
        label: "Fullscreen API",
        status: enabled ? "SAUDÁVEL" : "ATENÇÃO",
        detail: enabled
          ? "Tela cheia permitida pelo navegador/iframe atual."
          : "Tela cheia bloqueada pela política atual do documento ou container iframe.",
      };
    } else {
      fullscreen = {
        id: "fullscreen",
        label: "Fullscreen API",
        status: "INDISPONÍVEL",
        detail: "Fullscreen API não exposta neste navegador.",
      };
    }
  } catch {
    fullscreen = {
      id: "fullscreen",
      label: "Fullscreen API",
      status: "NÃO VERIFICADO",
      detail: "Erro ao consultar Fullscreen API.",
    };
  }

  let overallStatus: PlayerModuleStatus;
  let overallSummary: string;
  let activeStrategySummary: string;

  if (!hasVideoElement) {
    overallStatus = "CRÍTICO";
    overallSummary =
      "Elemento HTMLVideoElement indisponível; reprodução nativa/HLS não pode operar.";
    activeStrategySummary = "Apenas fallback por iframe externo (se suportado).";
  } else if (canPlayNativeHls && hlsJsSupported) {
    overallStatus = "SAUDÁVEL";
    overallSummary =
      "HLS Nativo e Hls.js (MSE) disponíveis neste navegador, com caminho completo de fallback.";
    activeStrategySummary =
      "Fluxo Hikari: HLS Nativo (se aplicável) → fallback Hls.js (MSE) → fallback Iframe do provedor.";
  } else if (hlsJsSupported) {
    overallStatus = "SAUDÁVEL";
    overallSummary =
      "Motor Hls.js via MSE operacional para reprodução dos streams HLS do Hikari.";
    activeStrategySummary =
      "Fluxo Hikari: Hls.js (MSE) como motor principal → fallback Iframe do provedor.";
  } else if (canPlayNativeHls) {
    overallStatus = "PARCIAL";
    overallSummary =
      "Apenas HLS Nativo disponível (sem MSE/Hls.js, comportamento esperado em iOS WebKit).";
    activeStrategySummary =
      "Fluxo Hikari: HLS Nativo via <video> → fallback Iframe do provedor.";
  } else {
    overallStatus = "ATENÇÃO";
    overallSummary =
      "Nenhum motor HLS (nativo ou Hls.js) confirmado; apenas MP4 direto ou Iframe podem funcionar.";
    activeStrategySummary =
      "Fluxo Hikari limitado a MP4/WebM direto ou Iframe externo.";
  }

  const preferences = readPlayerPreferencesReadonly();

  const report: BrowserPlayerDiagnosticsReport = {
    isBrowserEnvironment: true,
    measuredAt: new Date().toLocaleTimeString("pt-BR"),
    overallStatus,
    overallSummary,
    activeStrategySummary,
    environmentFlags: {
      isAndroid,
      isIos,
      isBraveLike,
      hlsWorkerExpected,
    },
    engines: {
      nativeHls,
      hlsJs,
      mediaSource,
      htmlVideo,
    },
    features: {
      pictureInPicture,
      fullscreen,
    },
    codecs,
    preferences,
    architectureNotes: [
      "O player oficial (CustomVideoPlayer.tsx) combina UI @videojs/react v10.1.0 com hls.js e reprodução nativa HTML5.",
      "Streams de domínios restritos (como maximaimg.online) são roteados pelo proxy /api/hls para contornar bloqueios de Referer/CORS.",
      "Este diagnóstico não instancia outro player, não carrega manifestos .m3u8, não inicia vídeo e não intercepta requisições HLS.",
    ],
    limitations: [
      "Suporte declarado por canPlayType() ou MediaSource.isTypeSupported() não garante que um stream específico abrirá caso haja expiração de token, bloqueio CORS ou recusa 403 do provedor.",
      "Métricas ativas de reprodução (bitrate atual, frames descartados, buffer em segundos e falhas de segmento) só existem durante a reprodução real de um episódio.",
      "Para matriz completa de Web APIs e armazenamento do dispositivo, consulte o módulo Compatibilidade.",
    ],
  };

  cachedPlayerDiagnostics = report;
  return report;
}
