export type NetworkModuleStatus =
  | "SAUDÁVEL"
  | "ATENÇÃO"
  | "CRÍTICO"
  | "INDISPONÍVEL"
  | "NÃO VERIFICADO"
  | "PARCIAL";

export type NetworkTransitionKind = "initial" | "online" | "offline" | "connection";

export interface NetworkInformationSnapshot {
  supported: boolean;
  effectiveType: string | null;
  type: string | null;
  rttMs: number | null;
  rttNote: string;
  downlinkMbps: number | null;
  downlinkNote: string;
  saveData: boolean | null;
  changeEventsSupported: boolean;
}

export interface NetworkTransitionEntry {
  id: string;
  timestamp: string;
  kind: NetworkTransitionKind;
  summary: string;
  onLine: boolean | null;
  effectiveType: string | null;
}

export interface BrowserNetworkSnapshot {
  isBrowserEnvironment: boolean;
  measuredAt: string;
  status: NetworkModuleStatus;
  statusReason: string;
  onLine: boolean | null;
  onlineLabel: string;
  onlineCaveat: string;
  networkInfo: NetworkInformationSnapshot;
  transitions: NetworkTransitionEntry[];
  historyLimit: number;
  limitations: string[];
}

export interface NetworkMonitorHandle {
  refresh: () => void;
  destroy: () => void;
}

interface NetworkInformationLike extends EventTarget {
  effectiveType?: string;
  type?: string;
  rtt?: number;
  downlink?: number;
  saveData?: boolean;
  onchange?: ((this: NetworkInformationLike, ev: Event) => unknown) | null;
}

interface NavigatorWithConnection extends Navigator {
  connection?: NetworkInformationLike;
  mozConnection?: NetworkInformationLike;
  webkitConnection?: NetworkInformationLike;
}

const MAX_TRANSITION_HISTORY = 15;

function getConnectionObject(): NetworkInformationLike | null {
  if (typeof navigator === "undefined") return null;
  const nav = navigator as NavigatorWithConnection;
  return nav.connection ?? nav.mozConnection ?? nav.webkitConnection ?? null;
}

function readNetworkInformation(): NetworkInformationSnapshot {
  const conn = getConnectionObject();
  if (!conn) {
    return {
      supported: false,
      effectiveType: null,
      type: null,
      rttMs: null,
      rttNote:
        "NetworkInformation API ausente neste navegador (comum em Safari/iOS, Firefox ou contextos com restrição).",
      downlinkMbps: null,
      downlinkNote:
        "Estimativa de downlink indisponível sem suporte à NetworkInformation API.",
      saveData: null,
      changeEventsSupported: false,
    };
  }

  const effectiveType =
    typeof conn.effectiveType === "string" && conn.effectiveType.trim()
      ? conn.effectiveType.trim()
      : null;

  const type =
    typeof conn.type === "string" && conn.type.trim() ? conn.type.trim() : null;

  const rawRtt = conn.rtt;
  let rttMs: number | null = null;
  let rttNote =
    "O navegador não expôs estimativa de RTT nesta sessão (não exibido como zero artificial).";
  if (typeof rawRtt === "number" && Number.isFinite(rawRtt) && rawRtt > 0) {
    rttMs = Math.round(rawRtt);
    rttNote =
      "Estimativa heurística arredondada pelo navegador; não equivale a latência real até os servidores do Hikari.";
  } else if (rawRtt === 0) {
    rttNote =
      "Navegador reportou rtt=0 (valor omitido/restrito ou interface local); tratado como NÃO VERIFICADO.";
  }

  const rawDownlink = conn.downlink;
  let downlinkMbps: number | null = null;
  let downlinkNote =
    "O navegador não expôs estimativa de largura de banda nesta sessão (não exibida como zero artificial).";
  if (
    typeof rawDownlink === "number" &&
    Number.isFinite(rawDownlink) &&
    rawDownlink > 0
  ) {
    downlinkMbps = Number(rawDownlink.toFixed(2));
    downlinkNote =
      "Estimativa heurística limitada/arredondada pelo navegador (frequentemente limitada a 10 Mbps); não é teste de velocidade.";
  } else if (rawDownlink === 0) {
    downlinkNote =
      "Navegador reportou downlink=0 (sem estimativa válida ou offline); tratado como NÃO VERIFICADO.";
  }

  const saveData = typeof conn.saveData === "boolean" ? conn.saveData : null;
  const changeEventsSupported = typeof conn.addEventListener === "function";

  return {
    supported: true,
    effectiveType,
    type,
    rttMs,
    rttNote,
    downlinkMbps,
    downlinkNote,
    saveData,
    changeEventsSupported,
  };
}

function evaluateNetworkStatus(
  onLine: boolean | null,
  info: NetworkInformationSnapshot,
): { status: NetworkModuleStatus; reason: string } {
  if (onLine === null) {
    return {
      status: "NÃO VERIFICADO",
      reason: "Estado de conectividade não disponível fora do navegador.",
    };
  }

  if (onLine === false) {
    return {
      status: "CRÍTICO",
      reason:
        "navigator.onLine indica false: o sistema operacional/navegador reporta ausência de interface de rede ativa.",
    };
  }

  if (!info.supported) {
    return {
      status: "PARCIAL",
      reason:
        "Interface local reportada como online (navigator.onLine=true), mas NetworkInformation API está indisponível neste navegador.",
    };
  }

  if (info.saveData === true) {
    return {
      status: "ATENÇÃO",
      reason:
        "Modo de economia de dados (saveData) ativo no dispositivo; o carregamento de mídia pode ser restringido.",
    };
  }

  if (info.effectiveType === "slow-2g" || info.effectiveType === "2g") {
    return {
      status: "ATENÇÃO",
      reason: `Perfil efetivo estimado como ${info.effectiveType.toUpperCase()}; largura de banda reduzida para streaming HLS.`,
    };
  }

  if (info.effectiveType === "3g") {
    return {
      status: "ATENÇÃO",
      reason:
        "Perfil efetivo estimado como 3G; pode ocorrer buffering em resoluções altas.",
    };
  }

  if (info.effectiveType) {
    return {
      status: "SAUDÁVEL",
      reason: `Interface local online e perfil efetivo estimado em ${info.effectiveType.toUpperCase()} (sem garantia de alcance fim-a-fim sem requisição).`,
    };
  }

  return {
    status: "PARCIAL",
    reason:
      "Interface local online e NetworkInformation exposta, porém sem effectiveType preenchido pelo navegador.",
  };
}

function buildLimitationsList(info: NetworkInformationSnapshot): string[] {
  const notes = [
    "navigator.onLine=true confirma apenas presença de interface de rede local; não garante acesso real à internet nem alcançabilidade ao Hikari/CDN.",
    "Zero requisições de rede, testes de velocidade ou polling são executados por este módulo.",
    `O histórico registra apenas até ${MAX_TRANSITION_HISTORY} transições em memória enquanto este painel permanecer aberto.`,
  ];

  if (!info.supported) {
    notes.push(
      "A API NetworkInformation (navigator.connection) não está disponível neste navegador; tipo de rede, RTT e downlink permanecem indisponíveis.",
    );
  } else {
    notes.push(
      "Os valores de effectiveType, rtt e downlink são estimativas heurísticas do navegador (com arredondamento/teto por privacidade) e não constituem medições garantidas.",
    );
  }

  return notes;
}

export function createNonBrowserNetworkSnapshot(): BrowserNetworkSnapshot {
  return {
    isBrowserEnvironment: false,
    measuredAt: "--:--:--",
    status: "NÃO VERIFICADO",
    statusReason: "Aguardando execução no navegador (ambiente SSR).",
    onLine: null,
    onlineLabel: "Não verificado",
    onlineCaveat:
      "Leitura passiva disponível somente após montagem no navegador.",
    networkInfo: {
      supported: false,
      effectiveType: null,
      type: null,
      rttMs: null,
      rttNote: "Aguardando montagem no navegador.",
      downlinkMbps: null,
      downlinkNote: "Aguardando montagem no navegador.",
      saveData: null,
      changeEventsSupported: false,
    },
    transitions: [],
    historyLimit: MAX_TRANSITION_HISTORY,
    limitations: [
      "Módulo client-only aguardando execução no navegador.",
    ],
  };
}

export function readBrowserNetworkSnapshot(
  transitions: NetworkTransitionEntry[] = [],
): BrowserNetworkSnapshot {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return createNonBrowserNetworkSnapshot();
  }

  const onLine =
    typeof navigator.onLine === "boolean" ? navigator.onLine : null;
  const networkInfo = readNetworkInformation();
  const evaluated = evaluateNetworkStatus(onLine, networkInfo);

  return {
    isBrowserEnvironment: true,
    measuredAt: new Date().toLocaleTimeString("pt-BR"),
    status: evaluated.status,
    statusReason: evaluated.reason,
    onLine,
    onlineLabel:
      onLine === true
        ? "Online (interface local)"
        : onLine === false
          ? "Offline"
          : "Indisponível",
    onlineCaveat:
      "navigator.onLine reflete apenas o estado da interface de rede do dispositivo/SO; redes Wi-Fi sem internet ou bloqueios de firewall ainda retornam true.",
    networkInfo,
    transitions: transitions.slice(),
    historyLimit: MAX_TRANSITION_HISTORY,
    limitations: buildLimitationsList(networkInfo),
  };
}

export function createNetworkMonitor(
  onUpdate: (snapshot: BrowserNetworkSnapshot) => void,
): NetworkMonitorHandle {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {
      refresh: () => {},
      destroy: () => {},
    };
  }

  let destroyed = false;
  let seq = 0;
  const transitions: NetworkTransitionEntry[] = [];

  const appendTransition = (
    kind: NetworkTransitionKind,
    summary: string,
  ): void => {
    const conn = readNetworkInformation();
    const onLine =
      typeof navigator.onLine === "boolean" ? navigator.onLine : null;

    seq += 1;
    transitions.unshift({
      id: `net-${Date.now()}-${seq}`,
      timestamp: new Date().toLocaleTimeString("pt-BR"),
      kind,
      summary,
      onLine,
      effectiveType: conn.effectiveType,
    });

    if (transitions.length > MAX_TRANSITION_HISTORY) {
      transitions.length = MAX_TRANSITION_HISTORY;
    }
  };

  const emit = () => {
    if (destroyed) return;
    onUpdate(readBrowserNetworkSnapshot(transitions));
  };

  const handleOnline = () => {
    appendTransition(
      "online",
      "Evento online disparado (interface de rede reconectada)",
    );
    emit();
  };

  const handleOffline = () => {
    appendTransition(
      "offline",
      "Evento offline disparado (interface de rede desconectada)",
    );
    emit();
  };

  const handleConnectionChange = () => {
    const info = readNetworkInformation();
    const parts: string[] = [];
    if (info.effectiveType) parts.push(`perfil=${info.effectiveType}`);
    if (info.type) parts.push(`tipo=${info.type}`);
    if (info.rttMs !== null) parts.push(`rtt~${info.rttMs}ms`);
    if (info.downlinkMbps !== null) parts.push(`downlink~${info.downlinkMbps}Mbps`);
    if (info.saveData !== null) parts.push(`saveData=${info.saveData ? "on" : "off"}`);

    appendTransition(
      "connection",
      parts.length > 0
        ? `Alteração em NetworkInformation (${parts.join(", ")})`
        : "Evento change em NetworkInformation disparado",
    );
    emit();
  };

  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);

  const conn = getConnectionObject();
  const hasChangeListener =
    conn !== null && typeof conn.addEventListener === "function";
  if (hasChangeListener && conn) {
    conn.addEventListener("change", handleConnectionChange);
  }

  const initialInfo = readNetworkInformation();
  appendTransition(
    "initial",
    `Leitura inicial (onLine=${String(navigator.onLine)}${
      initialInfo.effectiveType ? `, perfil=${initialInfo.effectiveType}` : ""
    })`,
  );
  emit();

  return {
    refresh: () => {
      emit();
    },
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (hasChangeListener && conn && typeof conn.removeEventListener === "function") {
        conn.removeEventListener("change", handleConnectionChange);
      }
      transitions.length = 0;
    },
  };
}
