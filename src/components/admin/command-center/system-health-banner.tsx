import React from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  XCircle,
} from "lucide-react";
import type {
  CommandCenterDiagnosticsReport,
  DiagnosticStatus,
} from "@/lib/admin-diagnostics.functions";

interface SystemHealthBannerProps {
  diagnostics: CommandCenterDiagnosticsReport | null;
  isLoading: boolean;
  requestError: string | null;
}

const BANNER_STYLE_MAP: Record<
  DiagnosticStatus,
  {
    containerClass: string;
    iconWrapClass: string;
    badgeClass: string;
  }
> = {
  SAUDÁVEL: {
    containerClass: "border-[#10B981]/30 bg-[#111318]",
    iconWrapClass: "bg-[#10B981]/15 border-[#10B981]/30 text-[#10B981]",
    badgeClass: "bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30",
  },
  ATENÇÃO: {
    containerClass: "border-[#F59E0B]/30 bg-[#111318]",
    iconWrapClass: "bg-[#F59E0B]/15 border-[#F59E0B]/30 text-[#F59E0B]",
    badgeClass: "bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30",
  },
  CRÍTICO: {
    containerClass: "border-[#EF4444]/35 bg-[#111318]",
    iconWrapClass: "bg-[#EF4444]/15 border-[#EF4444]/30 text-[#EF4444]",
    badgeClass: "bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/30",
  },
  INDISPONÍVEL: {
    containerClass: "border-[#94A3B8]/30 bg-[#111318]",
    iconWrapClass: "bg-[#94A3B8]/15 border-[#94A3B8]/30 text-[#94A3B8]",
    badgeClass: "bg-[#94A3B8]/15 text-[#94A3B8] border border-[#94A3B8]/30",
  },
  "NÃO VERIFICADO": {
    containerClass: "border-[#262B36] bg-[#111318]",
    iconWrapClass: "bg-[#6B7280]/15 border-[#6B7280]/30 text-[#6B7280]",
    badgeClass: "bg-[#262B36] text-[#9CA3AF]",
  },
};

function renderStatusIcon(status: DiagnosticStatus, isLoading: boolean) {
  if (isLoading && status === "NÃO VERIFICADO") {
    return <Loader2 className="size-4 animate-spin text-[#06B6D4]" />;
  }
  switch (status) {
    case "SAUDÁVEL":
      return <CheckCircle2 className="size-4" />;
    case "ATENÇÃO":
      return <AlertTriangle className="size-4" />;
    case "CRÍTICO":
      return <XCircle className="size-4" />;
    default:
      return <AlertCircle className="size-4" />;
  }
}

export function SystemHealthBanner({
  diagnostics,
  isLoading,
  requestError,
}: SystemHealthBannerProps) {
  if (!diagnostics && requestError) {
    const style = BANNER_STYLE_MAP["CRÍTICO"];
    return (
      <div className={`rounded-xl border p-5 space-y-2 ${style.containerClass}`}>
        <div className="flex items-start gap-3.5">
          <div
            className={`mt-0.5 size-8 shrink-0 rounded-lg border flex items-center justify-center ${style.iconWrapClass}`}
          >
            <XCircle className="size-4" />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-bold text-white font-sans tracking-tight">
                ERRO AO CONSULTAR SONDAS
              </h2>
              <span
                className={`px-2 py-0.5 rounded text-[9px] font-mono font-semibold ${style.badgeClass}`}
              >
                CRÍTICO
              </span>
            </div>
            <p className="text-xs text-[#9CA3AF] leading-relaxed font-sans">
              {requestError}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!diagnostics) {
    const style = BANNER_STYLE_MAP["NÃO VERIFICADO"];
    return (
      <div className={`rounded-xl border p-5 space-y-2 ${style.containerClass}`}>
        <div className="flex items-start gap-3.5">
          <div
            className={`mt-0.5 size-8 shrink-0 rounded-lg border flex items-center justify-center ${style.iconWrapClass}`}
          >
            {renderStatusIcon("NÃO VERIFICADO", isLoading)}
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-bold text-white font-sans tracking-tight">
                {isLoading
                  ? "EXECUTANDO SONDAS DE INFRAESTRUTURA"
                  : "SISTEMA AGUARDANDO SONDAS"}
              </h2>
              <span
                className={`px-2 py-0.5 rounded text-[9px] font-mono font-semibold ${style.badgeClass}`}
              >
                NÃO VERIFICADO
              </span>
            </div>
            <p className="text-xs text-[#9CA3AF] leading-relaxed font-sans">
              {isLoading
                ? "Executando verificação leve no banco PostgreSQL (SELECT 1) e no Upstash Redis (PING) sob demanda..."
                : "Acione a atualização para verificar conectividade real com PostgreSQL e Upstash Redis."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const style = BANNER_STYLE_MAP[diagnostics.overallStatus];

  return (
    <div className={`rounded-xl border p-5 space-y-3 ${style.containerClass}`}>
      <div className="flex items-start gap-3.5">
        <div
          className={`mt-0.5 size-8 shrink-0 rounded-lg border flex items-center justify-center ${style.iconWrapClass}`}
        >
          {renderStatusIcon(diagnostics.overallStatus, isLoading)}
        </div>
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-bold text-white font-sans tracking-tight">
              {diagnostics.overallTitle}
            </h2>
            <span
              className={`px-2 py-0.5 rounded text-[9px] font-mono font-semibold ${style.badgeClass}`}
            >
              {diagnostics.overallStatus}
            </span>
            {isLoading && (
              <span className="px-2 py-0.5 rounded text-[9px] font-mono font-medium bg-[#181B22] text-[#06B6D4] border border-[#06B6D4]/30">
                ATUALIZANDO...
              </span>
            )}
          </div>
          <p className="text-xs text-[#9CA3AF] leading-relaxed font-sans">
            {diagnostics.overallMessage}
          </p>
          {requestError && (
            <p className="text-[11px] text-[#EF4444] font-sans">
              Última tentativa de atualização falhou: {requestError}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-[10px] font-mono text-[#6B7280]">
            <span className="px-2 py-0.5 rounded bg-[#181B22] border border-[#262B36] text-[#9CA3AF]">
              Backend DB: {diagnostics.database.backend === "neon" ? "Neon" : "PGlite"}
            </span>
            <span className="px-2 py-0.5 rounded bg-[#181B22] border border-[#262B36] text-[#9CA3AF]">
              Redis: {diagnostics.redis.configured ? "Configurado" : "Não configurado"}
            </span>
            <span className="px-2 py-0.5 rounded bg-[#181B22] border border-[#262B36]">
              Node {diagnostics.runtime.nodeVersion} ({diagnostics.runtime.environment})
            </span>
            <span className="px-2 py-0.5 rounded bg-[#181B22] border border-[#262B36]">
              Sonda total: {diagnostics.probeDurationMs} ms
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

