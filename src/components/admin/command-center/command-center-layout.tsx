import React, { useCallback, useEffect, useRef, useState } from "react";
import { CommandCenterHeader } from "./command-center-header";
import { CommandCenterNavigation, MODULES } from "./command-center-navigation";
import { SystemHealthBanner } from "./system-health-banner";
import { MetricCard } from "./metric-card";
import { SubsystemStatus } from "./subsystem-status";
import { EmptyEventFeed } from "./empty-event-feed";
import { CompatibilityPanel } from "./modules/compatibility-panel";
import { StoragePanel } from "./modules/storage-panel";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { Link } from "@tanstack/react-router";
import {
  getCommandCenterDiagnostics,
  type CommandCenterDiagnosticsReport,
  type DiagnosticStatus,
} from "@/lib/admin-diagnostics.functions";
import {
  collectBrowserStorageAudit,
  formatStorageBytes,
  type BrowserStorageAuditReport,
} from "@/lib/browser-storage-diagnostics";

function formatRuntimeUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hours}h ${remMins}m`;
}

export function CommandCenterLayout() {
  const [activeModule, setActiveModule] = useState("overview");
  const [diagnostics, setDiagnostics] =
    useState<CommandCenterDiagnosticsReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState("--:--:--");
  const [storageAudit, setStorageAudit] =
    useState<BrowserStorageAuditReport | null>(null);
  const [isStorageLoading, setIsStorageLoading] = useState(false);

  const isMountedRef = useRef(true);
  const inFlightRef = useRef(false);
  const hasFetchedInitialRef = useRef(false);
  const storageInFlightRef = useRef(false);
  const hasRunInitialStorageAuditRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const runDiagnostics = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setIsLoading(true);
    setRequestError(null);

    try {
      const report = await getCommandCenterDiagnostics();
      if (!isMountedRef.current) return;
      setDiagnostics(report);
      setLastUpdated(
        new Date(report.checkedAt).toLocaleTimeString("pt-BR"),
      );
    } catch (err) {
      if (!isMountedRef.current) return;
      const message =
        err instanceof Error && err.message.trim()
          ? "Não foi possível consultar as sondas administrativas neste momento."
          : "Falha ao executar verificação de infraestrutura.";
      setRequestError(message);
    } finally {
      inFlightRef.current = false;
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  const runStorageAudit = useCallback(async () => {
    if (storageInFlightRef.current) return;
    storageInFlightRef.current = true;
    setIsStorageLoading(true);

    try {
      const report = await collectBrowserStorageAudit();
      if (!isMountedRef.current) return;
      setStorageAudit(report);
    } finally {
      storageInFlightRef.current = false;
      if (isMountedRef.current) {
        setIsStorageLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (activeModule === "overview" && !hasFetchedInitialRef.current) {
      hasFetchedInitialRef.current = true;
      void runDiagnostics();
    }
  }, [activeModule, runDiagnostics]);

  useEffect(() => {
    if (!hasRunInitialStorageAuditRef.current) {
      hasRunInitialStorageAuditRef.current = true;
      void runStorageAudit();
    }
  }, [runStorageAudit]);

  const handleRefresh = useCallback(() => {
    if (isLoading || inFlightRef.current) return;
    void runDiagnostics();
  }, [isLoading, runDiagnostics]);

  const handleRefreshStorage = useCallback(() => {
    if (isStorageLoading || storageInFlightRef.current) return;
    void runStorageAudit();
  }, [isStorageLoading, runStorageAudit]);

  const currentModuleObj = MODULES.find((m) => m.id === activeModule);

  const headerStatus: DiagnosticStatus = diagnostics
    ? diagnostics.overallStatus
    : requestError
      ? "CRÍTICO"
      : "NÃO VERIFICADO";

  const performanceProps = diagnostics
    ? {
        status: diagnostics.database.status,
        value:
          diagnostics.database.latencyMs !== null
            ? `${diagnostics.database.latencyMs} ms`
            : "Erro",
        description:
          diagnostics.database.backend === "neon"
            ? "Latência SELECT 1 (Neon PostgreSQL)"
            : "Latência SELECT 1 (PGlite Fallback)",
        footerLeft: `Heap: ${diagnostics.runtime.heapUsedMb} MB • RSS: ${diagnostics.runtime.rssMb} MB`,
        footerRight: `Uptime ${formatRuntimeUptime(diagnostics.runtime.uptimeSeconds)}`,
      }
    : requestError
      ? {
          status: "CRÍTICO" as DiagnosticStatus,
          value: "Erro",
          description: "Latência SELECT 1 (PostgreSQL)",
          footerLeft: "Falha ao consultar servidor",
          footerRight: "--",
        }
      : {
          status: "NÃO VERIFICADO" as DiagnosticStatus,
          value: isLoading ? "..." : "--",
          description: "Latência SELECT 1 e runtime Node.js",
          footerLeft: isLoading
            ? "Status: Executando sonda..."
            : "Status: Aguardando Sonda",
          footerRight: "--",
        };

  const cacheProps = diagnostics
    ? {
        status: diagnostics.redis.status,
        value: diagnostics.redis.configured
          ? diagnostics.redis.connected && diagnostics.redis.latencyMs !== null
            ? `${diagnostics.redis.latencyMs} ms`
            : "Falha"
          : "Indisponível",
        description: "Conectividade PING • Upstash Redis",
        footerLeft: diagnostics.redis.configured
          ? diagnostics.redis.connected
            ? "PING: PONG verificado"
            : "PING: Sem resposta"
          : "Sem credenciais (fail-open)",
        footerRight:
          diagnostics.redis.latencyMs !== null
            ? `${diagnostics.redis.latencyMs} ms`
            : "--",
      }
    : requestError
      ? {
          status: "NÃO VERIFICADO" as DiagnosticStatus,
          value: "--",
          description: "Conectividade PING • Upstash Redis",
          footerLeft: "Sonda não concluída",
          footerRight: "--",
        }
      : {
          status: "NÃO VERIFICADO" as DiagnosticStatus,
          value: isLoading ? "..." : "--",
          description: "Conectividade PING • Upstash Redis",
          footerLeft: isLoading
            ? "Status: Executando PING..."
            : "Status: Aguardando Sonda",
          footerRight: "--",
        };

  const storageProps = (() => {
    if (!storageAudit) {
      return {
        status: "NÃO VERIFICADO" as DiagnosticStatus,
        value: isStorageLoading ? "..." : "--",
        description: "Armazenamento local do navegador",
        footerLeft: isStorageLoading
          ? "Status: Inspecionando navegador..."
          : "Status: Aguardando navegador",
        footerRight: "Client-only",
      };
    }

    const localLabel = storageAudit.localStorage.available
      ? `LS: ${storageAudit.localStorage.keyCount} chave(s)`
      : `LS: ${storageAudit.localStorage.status === "blocked" ? "bloqueado" : "indisponível"}`;

    const idbLabel =
      storageAudit.indexedDb.status === "available"
        ? `IDB: ${storageAudit.indexedDb.databaseCount} banco(s)`
        : storageAudit.indexedDb.status === "partial"
          ? "IDB: parcial"
          : "IDB: indisponível";

    const footerCounts = `${localLabel} • ${idbLabel}`;

    if (storageAudit.estimate.available && storageAudit.estimate.data) {
      const fullyReliable =
        storageAudit.localStorage.available &&
        storageAudit.indexedDb.status === "available";
      return {
        status: (fullyReliable ? "SAUDÁVEL" : "ATENÇÃO") as DiagnosticStatus,
        value: formatStorageBytes(storageAudit.estimate.data.usage),
        description: `Uso estimado da origem (${storageAudit.estimate.data.percentage} de ${formatStorageBytes(storageAudit.estimate.data.quota)})`,
        footerLeft: footerCounts,
        footerRight: `Quota: ${storageAudit.estimate.data.percentage}`,
      };
    }

    const hasAnyLocalRead =
      storageAudit.localStorage.available || storageAudit.indexedDb.available;

    return {
      status: (hasAnyLocalRead ? "ATENÇÃO" : "INDISPONÍVEL") as DiagnosticStatus,
      value: "Indisponível",
      description:
        storageAudit.estimate.reason ??
        "navigator.storage.estimate() indisponível",
      footerLeft: footerCounts,
      footerRight: "Sem estimativa",
    };
  })();

  return (
    <div className="fixed inset-0 z-50 bg-[#090A0F] text-[#E5E7EB] font-sans overflow-y-auto flex flex-col">
      {/* Top Operational Header */}
      <CommandCenterHeader
        lastUpdated={lastUpdated}
        onRefresh={handleRefresh}
        status={headerStatus}
        isLoading={isLoading}
      />

      {/* Sub-header with back to studio link */}
      <div className="bg-[#111318] border-b border-[#262B36] px-4 py-2 md:px-6 flex items-center justify-between text-xs">
        <Link
          to="/admin"
          className="inline-flex items-center gap-1.5 text-[#9CA3AF] hover:text-white transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          <span>Voltar ao Studio Admin</span>
        </Link>
        <span className="font-mono text-[10px] text-[#6B7280]">
          Módulo Ativo: <strong className="text-white">{currentModuleObj?.label}</strong>
        </span>
      </div>

      {/* Main Container: Sidebar + Content */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        <CommandCenterNavigation
          activeModule={activeModule}
          onSelectModule={setActiveModule}
        />

        {/* Content Area */}
        <main className="flex-1 p-4 md:p-6 space-y-6 overflow-y-auto bg-[#090A0F]">
          {activeModule === "overview" ? (
            <div className="space-y-6 max-w-7xl mx-auto">
              {/* A. Global State Banner */}
              <SystemHealthBanner
                diagnostics={diagnostics}
                isLoading={isLoading}
                requestError={requestError}
              />

              {/* B. Indicator Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  title="Performance"
                  type="performance"
                  description={performanceProps.description}
                  status={performanceProps.status}
                  value={performanceProps.value}
                  footerLeft={performanceProps.footerLeft}
                  footerRight={performanceProps.footerRight}
                />
                <MetricCard
                  title="Network & Outbox"
                  type="network"
                  description="Fila de sincronização offline"
                  status="NÃO VERIFICADO"
                  value="--"
                  footerLeft="Status: Aguardando Sonda"
                  footerRight="Não integrado"
                />
                <MetricCard
                  title="Cache State"
                  type="cache"
                  description={cacheProps.description}
                  status={cacheProps.status}
                  value={cacheProps.value}
                  footerLeft={cacheProps.footerLeft}
                  footerRight={cacheProps.footerRight}
                />
                <MetricCard
                  title="Storage Quota"
                  type="storage"
                  description={storageProps.description}
                  status={storageProps.status}
                  value={storageProps.value}
                  footerLeft={storageProps.footerLeft}
                  footerRight={storageProps.footerRight}
                />
              </div>

              {/* C. Subsystem Status */}
              <SubsystemStatus diagnostics={diagnostics} isLoading={isLoading} />

              {/* D. Recent Events */}
              <div className="space-y-3">
                <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#9CA3AF]">
                  Eventos e Alertas Recentes
                </h3>
                <EmptyEventFeed />
              </div>
            </div>
          ) : activeModule === "storage" ? (
            <StoragePanel
              audit={storageAudit}
              isLoading={isStorageLoading}
              onRefresh={handleRefreshStorage}
            />
          ) : activeModule === "compatibility" ? (
            <CompatibilityPanel />
          ) : (
            <div className="max-w-4xl mx-auto py-12 px-6 rounded-xl border border-[#262B36] bg-[#111318] text-center space-y-3">
              <div className="inline-flex items-center justify-center size-12 rounded-xl bg-[#181B22] border border-[#262B36] text-[#06B6D4]">
                <ShieldAlert className="size-6" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-white font-sans">
                  Módulo: {currentModuleObj?.label}
                </h2>
                <p className="text-xs font-mono uppercase tracking-wider text-[#F59E0B]">
                  EM PLANEJAMENTO E ESTRUTURAÇÃO VISUAL
                </p>
              </div>
              <p className="text-xs text-[#9CA3AF] max-w-md mx-auto font-sans pt-1">
                Este módulo foi concebido na arquitetura do Command Center mas ainda não possui sua interface específica implementada. Retorne à Visão Geral para inspecionar o estado visual base.
              </p>
              <div className="pt-3">
                <button
                  onClick={() => setActiveModule("overview")}
                  className="px-4 py-2 rounded-lg bg-[#181B22] hover:bg-[#212630] border border-[#262B36] text-xs font-sans font-medium text-white transition-colors cursor-pointer"
                >
                  Retornar à Visão Geral
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

