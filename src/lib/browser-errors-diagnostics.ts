import {
  readBrowserOutboxSummary,
  type OutboxConflictSummary,
} from "@/lib/browser-outbox-diagnostics";

export type ErrorsModuleStatus =
  | "SAUDÁVEL"
  | "ATENÇÃO"
  | "CRÍTICO"
  | "INDISPONÍVEL"
  | "NÃO VERIFICADO"
  | "PARCIAL";

export type CapturedErrorKind =
  | "runtime_error"
  | "unhandled_rejection"
  | "resource_error";

export interface CapturedSessionErrorItem {
  id: string;
  timestamp: string;
  kind: CapturedErrorKind;
  name: string;
  message: string;
  sanitizedSource: string;
}

export interface ProjectErrorMechanismItem {
  id: string;
  name: string;
  scope: string;
  persistence: string;
  status: ErrorsModuleStatus;
}

export interface BrowserErrorsSnapshot {
  isBrowserEnvironment: boolean;
  measuredAt: string;
  listenerActive: boolean;
  sessionStatus: ErrorsModuleStatus;
  sessionStatusReason: string;
  sessionErrors: CapturedSessionErrorItem[];
  sessionCounts: {
    total: number;
    runtime: number;
    unhandledRejection: number;
    resource: number;
  };
  persistedLocalOutbox: {
    available: boolean;
    conflictCount: number;
    pendingWithErrorCount: number;
    items: OutboxConflictSummary[];
    note: string;
  };
  projectMechanisms: ProjectErrorMechanismItem[];
  unavailableInfo: Array<{ label: string; status: ErrorsModuleStatus; reason: string }>;
  limitations: string[];
}

export interface ErrorsMonitorHandle {
  refresh: () => void;
  clearSessionBuffer: () => void;
  destroy: () => void;
}

const MAX_SESSION_ERRORS = 25;

export function sanitizeErrorMessage(raw: unknown): string {
  const base =
    raw instanceof Error
      ? `${raw.name ? `${raw.name}: ` : ""}${raw.message}`
      : typeof raw === "string"
        ? raw
        : "Erro sem mensagem descritiva.";

  const cleaned = base
    .replace(/(postgres(?:ql)?|rediss?|https?|wss?):\/\/[^\s"'`<>]+/gi, (match) =>
      sanitizeUrlPathOnly(match),
    )
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, "$1 [REDIGIDO]")
    .replace(
      /\b(token|auth|password|passwd|secret|key|apikey|api_key|cookie|session|sig|bcdn_token)\s*[:=]\s*[^\s,;&"']+/gi,
      "$1=[REDIGIDO]",
    )
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[EMAIL_REDIGIDO]")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return "Erro sem detalhes disponíveis.";
  return cleaned.length > 220 ? `${cleaned.slice(0, 217)}...` : cleaned;
}

export function sanitizeUrlPathOnly(rawUrl: string | undefined | null): string {
  if (!rawUrl || !rawUrl.trim()) return "(origem não informada)";
  const trimmed = rawUrl.trim();
  try {
    const base =
      typeof window !== "undefined" ? window.location.origin : "http://localhost";
    const parsed = new URL(trimmed, base);
    // Remove query string, credenciais e fragmento para não vazar tokens nem parâmetros sensíveis
    const cleanPath = parsed.pathname || "/";
    if (
      parsed.protocol === "http:" ||
      parsed.protocol === "https:" ||
      parsed.protocol === "ws:" ||
      parsed.protocol === "wss:"
    ) {
      return `${parsed.origin}${cleanPath}`;
    }
    return cleanPath;
  } catch {
    const withoutHash = trimmed.split("#")[0] ?? "";
    const withoutQuery = withoutHash.split("?")[0] ?? "";
    return withoutQuery || "(caminho não identificado)";
  }
}

function buildProjectMechanisms(): ProjectErrorMechanismItem[] {
  return [
    {
      id: "router-boundary",
      name: "AppErrorComponent (Error Boundary de Rotas)",
      scope: "Exibição de fallback visual em src/router.tsx",
      persistence: "Apenas em memória/DOM local; não envia nem persiste logs",
      status: "PARCIAL",
    },
    {
      id: "server-telemetry",
      name: "traceServerFn & Logs Estruturados (Redis/API)",
      scope: "Console do runtime Node.js / logs Vercel stdout",
      persistence: "Efêmero no provedor; sem consulta pela UI do Hikari",
      status: "INDISPONÍVEL",
    },
    {
      id: "player-hls",
      name: "Estado de Erro do Player (CustomVideoPlayer)",
      scope: "Console do navegador e overlay local durante reprodução",
      persistence: "Apenas na instância ativa do episódio; sem persistência global",
      status: "PARCIAL",
    },
    {
      id: "outbox-local",
      name: "Fila Outbox de Episódios (localStorage)",
      scope: "Conflitos e falhas de sincronização administrativa local",
      persistence: "Persistido localmente em hikari-episode-outbox-v1",
      status: "SAUDÁVEL",
    },
  ];
}

function buildUnavailableInfo(): BrowserErrorsSnapshot["unavailableInfo"] {
  return [
    {
      label: "Histórico Global de Erros de Visitantes",
      status: "INDISPONÍVEL",
      reason:
        "A arquitetura atual do Hikari não possui tabela de erros no PostgreSQL nem serviço externo (como Sentry) configurado.",
    },
    {
      label: "Contagens Históricas / Taxa de Crash Agregada",
      status: "NÃO VERIFICADO",
      reason:
        "Não há armazenamento centralizado de exceções; este painel observa somente a sessão ativa do administrador enquanto aberto.",
    },
    {
      label: "Logs do Runtime Vercel / Server Functions",
      status: "INDISPONÍVEL",
      reason:
        "Logs de stdout (traceServerFn e emitRedisTelemetry) ficam restritos ao painel da plataforma de hospedagem.",
    },
  ];
}

export function createNonBrowserErrorsSnapshot(): BrowserErrorsSnapshot {
  return {
    isBrowserEnvironment: false,
    measuredAt: "--:--:--",
    listenerActive: false,
    sessionStatus: "NÃO VERIFICADO",
    sessionStatusReason: "Aguardando montagem no navegador (ambiente SSR).",
    sessionErrors: [],
    sessionCounts: {
      total: 0,
      runtime: 0,
      unhandledRejection: 0,
      resource: 0,
    },
    persistedLocalOutbox: {
      available: false,
      conflictCount: 0,
      pendingWithErrorCount: 0,
      items: [],
      note: "Leitura disponível somente no navegador.",
    },
    projectMechanisms: buildProjectMechanisms(),
    unavailableInfo: buildUnavailableInfo(),
    limitations: [
      "Módulo client-only aguardando execução no navegador.",
    ],
  };
}

function buildErrorsSnapshot(
  sessionErrors: CapturedSessionErrorItem[],
  listenerActive: boolean,
): BrowserErrorsSnapshot {
  const outbox = readBrowserOutboxSummary();
  const conflictItems = outbox.conflicts;
  const conflictCount = outbox.conflictCount;
  const pendingWithErrorCount = Math.max(0, conflictItems.length - conflictCount);

  let runtime = 0;
  let unhandledRejection = 0;
  let resource = 0;
  for (const item of sessionErrors) {
    if (item.kind === "runtime_error") runtime += 1;
    else if (item.kind === "unhandled_rejection") unhandledRejection += 1;
    else resource += 1;
  }

  let sessionStatus: ErrorsModuleStatus;
  let sessionStatusReason: string;

  if (runtime > 0 || unhandledRejection > 0) {
    sessionStatus = "CRÍTICO";
    sessionStatusReason = `${runtime + unhandledRejection} erro(s) JavaScript/Promise não tratado(s) observado(s) nesta sessão enquanto o módulo está aberto.`;
  } else if (resource > 0 || conflictCount > 0) {
    sessionStatus = "ATENÇÃO";
    sessionStatusReason =
      conflictCount > 0
        ? `${conflictCount} conflito(s) persistido(s) no Outbox local do navegador${resource > 0 ? ` e ${resource} falha(s) de recurso` : ""}.`
        : `${resource} falha(s) de carregamento de recurso observada(s) nesta sessão.`;
  } else {
    sessionStatus = "SAUDÁVEL";
    sessionStatusReason =
      "Nenhum erro capturado pelos listeners locais desta sessão nem conflitos no Outbox local.";
  }

  return {
    isBrowserEnvironment: true,
    measuredAt: new Date().toLocaleTimeString("pt-BR"),
    listenerActive,
    sessionStatus,
    sessionStatusReason,
    sessionErrors: sessionErrors.slice(),
    sessionCounts: {
      total: sessionErrors.length,
      runtime,
      unhandledRejection,
      resource,
    },
    persistedLocalOutbox: {
      available: outbox.available,
      conflictCount,
      pendingWithErrorCount,
      items: conflictItems,
      note: outbox.available
        ? "Fonte real persistida localmente em hikari-episode-outbox-v1 (somente erros de sincronização do navegador atual)."
        : outbox.reason ?? "Outbox local inacessível neste navegador.",
    },
    projectMechanisms: buildProjectMechanisms(),
    unavailableInfo: buildUnavailableInfo(),
    limitations: [
      "Os listeners window.error e unhandledrejection operam somente em memória enquanto este módulo estiver aberto; recarregar ou fechar o painel limpa o buffer da sessão.",
      "Os registros abaixo NÃO representam todos os erros de visitantes do Hikari nem oferecem histórico global persistido.",
      "Nenhum erro é transmitido ao servidor; query strings, tokens, e-mails e cookies nunca são capturados ou exibidos.",
    ],
  };
}

export function createErrorsMonitor(
  onUpdate: (snapshot: BrowserErrorsSnapshot) => void,
): ErrorsMonitorHandle {
  if (typeof window === "undefined") {
    return {
      refresh: () => {},
      clearSessionBuffer: () => {},
      destroy: () => {},
    };
  }

  let destroyed = false;
  let seq = 0;
  const sessionErrors: CapturedSessionErrorItem[] = [];

  const pushError = (item: Omit<CapturedSessionErrorItem, "id" | "timestamp">) => {
    seq += 1;
    sessionErrors.unshift({
      ...item,
      id: `err-${Date.now()}-${seq}`,
      timestamp: new Date().toLocaleTimeString("pt-BR"),
    });
    if (sessionErrors.length > MAX_SESSION_ERRORS) {
      sessionErrors.length = MAX_SESSION_ERRORS;
    }
  };

  const emit = () => {
    if (destroyed) return;
    onUpdate(buildErrorsSnapshot(sessionErrors, true));
  };

  const handleWindowError = (event: Event) => {
    if (destroyed) return;

    if (event instanceof ErrorEvent) {
      const errObj = event.error as unknown;
      const errName =
        errObj instanceof Error && errObj.name ? errObj.name : "Error";
      const msg = sanitizeErrorMessage(
        errObj instanceof Error ? errObj : event.message || "Erro de execução",
      );
      const source = sanitizeUrlPathOnly(event.filename);
      const loc =
        typeof event.lineno === "number" && event.lineno > 0
          ? `${source}:${event.lineno}`
          : source;

      pushError({
        kind: "runtime_error",
        name: errName,
        message: msg,
        sanitizedSource: loc,
      });
      emit();
      return;
    }

    // Erro de carregamento de recurso em fase de captura (img/script/link/video)
    const target = event.target as
      | (EventTarget & { tagName?: string; currentSrc?: string; src?: string; href?: string })
      | null;
    const tagName =
      target && typeof target.tagName === "string"
        ? target.tagName.toLowerCase()
        : "recurso";
    const rawTargetUrl = target?.currentSrc || target?.src || target?.href || "";

    pushError({
      kind: "resource_error",
      name: `ResourceLoadError (${tagName})`,
      message: `Falha ao carregar recurso <${tagName}> na página.`,
      sanitizedSource: sanitizeUrlPathOnly(rawTargetUrl),
    });
    emit();
  };

  const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    if (destroyed) return;
    const reason = event.reason as unknown;
    const name =
      reason instanceof Error && reason.name
        ? reason.name
        : "UnhandledPromiseRejection";
    const message = sanitizeErrorMessage(reason);

    pushError({
      kind: "unhandled_rejection",
      name,
      message,
      sanitizedSource: sanitizeUrlPathOnly(window.location.pathname),
    });
    emit();
  };

  const handleStorage = (event: StorageEvent) => {
    if (destroyed) return;
    if (event.key !== null && event.key !== "hikari-episode-outbox-v1") return;
    emit();
  };

  window.addEventListener("error", handleWindowError, true);
  window.addEventListener("unhandledrejection", handleUnhandledRejection);
  window.addEventListener("storage", handleStorage);

  emit();

  return {
    refresh: () => {
      emit();
    },
    clearSessionBuffer: () => {
      sessionErrors.length = 0;
      emit();
    },
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      window.removeEventListener("error", handleWindowError, true);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      window.removeEventListener("storage", handleStorage);
      sessionErrors.length = 0;
    },
  };
}
