import React from "react";
import { RefreshCw, Activity } from "lucide-react";
import type { DiagnosticStatus } from "@/lib/admin-diagnostics.functions";

interface CommandCenterHeaderProps {
  lastUpdated: string;
  onRefresh: () => void;
  status: DiagnosticStatus;
  isLoading: boolean;
}

const HEADER_STATUS_STYLES: Record<
  DiagnosticStatus,
  { dotClass: string; textClass: string; borderClass: string }
> = {
  SAUDÁVEL: {
    dotClass: "bg-[#10B981]",
    textClass: "text-[#10B981]",
    borderClass: "border-[#10B981]/30",
  },
  ATENÇÃO: {
    dotClass: "bg-[#F59E0B]",
    textClass: "text-[#F59E0B]",
    borderClass: "border-[#F59E0B]/30",
  },
  CRÍTICO: {
    dotClass: "bg-[#EF4444]",
    textClass: "text-[#EF4444]",
    borderClass: "border-[#EF4444]/30",
  },
  INDISPONÍVEL: {
    dotClass: "bg-[#94A3B8]",
    textClass: "text-[#94A3B8]",
    borderClass: "border-[#94A3B8]/30",
  },
  "NÃO VERIFICADO": {
    dotClass: "bg-[#6B7280]",
    textClass: "text-[#6B7280]",
    borderClass: "border-[#262B36]",
  },
};

export function CommandCenterHeader({
  lastUpdated,
  onRefresh,
  status,
  isLoading,
}: CommandCenterHeaderProps) {
  const statusStyle = HEADER_STATUS_STYLES[status];

  return (
    <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-4 py-5 md:px-6 bg-[#111318] border-b border-[#262B36]">
      <div className="flex items-center gap-3">
        <div className="size-9 rounded-lg bg-[#8B5CF6]/15 border border-[#8B5CF6]/30 flex items-center justify-center text-[#8B5CF6]">
          <Activity className="size-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold tracking-tight text-white font-sans">
              HIKARI COMMAND CENTER
            </h1>
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#262B36] text-[#06B6D4] border border-[#06B6D4]/30">
              SECURE ADMIN
            </span>
          </div>
          <p className="text-xs text-[#6B7280] font-sans">
            Central de Diagnóstico e Sondas de Infraestrutura
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* Status Badge */}
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#181B22] border ${statusStyle.borderClass}`}
        >
          <span
            className={`size-2 rounded-full ${statusStyle.dotClass} ${isLoading ? "animate-pulse" : ""}`}
          />
          <span
            className={`text-xs font-mono font-semibold uppercase tracking-wider ${statusStyle.textClass}`}
          >
            {isLoading && status === "NÃO VERIFICADO" ? "VERIFICANDO..." : status}
          </span>
        </div>

        {/* Last Updated */}
        <div className="hidden lg:flex items-center gap-1.5 text-xs text-[#6B7280] font-mono px-3 py-1.5 rounded-lg bg-[#181B22] border border-[#262B36]">
          <span className="text-[#9CA3AF]">Sync:</span>
          <span>{lastUpdated}</span>
        </div>

        {/* Refresh Button */}
        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#181B22] hover:bg-[#212630] disabled:opacity-60 disabled:cursor-not-allowed border border-[#262B36] text-xs font-sans font-medium text-white transition-colors cursor-pointer"
          title="Executar sondas sob demanda no servidor"
        >
          <RefreshCw
            className={`size-3.5 text-[#06B6D4] ${isLoading ? "animate-spin" : ""}`}
          />
          <span>{isLoading ? "Verificando..." : "Atualizar Sondas"}</span>
        </button>
      </div>
    </header>
  );
}

