import React from "react";
import { Gauge, Network, Database, HardDrive } from "lucide-react";
import type { DiagnosticStatus } from "@/lib/admin-diagnostics.functions";

interface MetricCardProps {
  title: string;
  type: "performance" | "network" | "cache" | "storage";
  description: string;
  status?: DiagnosticStatus;
  value?: string;
  footerLeft?: string;
  footerRight?: string;
}

const STATUS_BADGE_STYLES: Record<DiagnosticStatus, string> = {
  SAUDÁVEL: "bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30",
  ATENÇÃO: "bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/30",
  CRÍTICO: "bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/30",
  INDISPONÍVEL: "bg-[#94A3B8]/15 text-[#94A3B8] border-[#94A3B8]/30",
  "NÃO VERIFICADO": "bg-[#181B22] text-[#6B7280] border-[#262B36]",
};

const STATUS_VALUE_STYLES: Record<DiagnosticStatus, string> = {
  SAUDÁVEL: "text-[#10B981]",
  ATENÇÃO: "text-[#F59E0B]",
  CRÍTICO: "text-[#EF4444]",
  INDISPONÍVEL: "text-[#94A3B8]",
  "NÃO VERIFICADO": "text-[#6B7280]",
};

const ICON_COLOR_STYLES: Record<DiagnosticStatus, string> = {
  SAUDÁVEL: "text-[#10B981]",
  ATENÇÃO: "text-[#F59E0B]",
  CRÍTICO: "text-[#EF4444]",
  INDISPONÍVEL: "text-[#94A3B8]",
  "NÃO VERIFICADO": "text-[#6B7280]",
};

function renderMetricIcon(
  type: MetricCardProps["type"],
  status: DiagnosticStatus,
) {
  const colorClass = ICON_COLOR_STYLES[status];
  switch (type) {
    case "performance":
      return <Gauge className={`size-4 ${colorClass}`} />;
    case "network":
      return <Network className={`size-4 ${colorClass}`} />;
    case "cache":
      return <Database className={`size-4 ${colorClass}`} />;
    case "storage":
      return <HardDrive className={`size-4 ${colorClass}`} />;
  }
}

export function MetricCard({
  title,
  type,
  description,
  status = "NÃO VERIFICADO",
  value = "--",
  footerLeft = "Status: Aguardando Sonda",
  footerRight = "--",
}: MetricCardProps) {
  return (
    <div className="rounded-xl border border-[#262B36] bg-[#111318] p-4 flex flex-col justify-between space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="size-7 shrink-0 rounded-lg bg-[#181B22] border border-[#262B36] flex items-center justify-center">
            {renderMetricIcon(type, status)}
          </div>
          <span className="text-xs font-semibold text-white font-sans truncate">
            {title}
          </span>
        </div>
        <span
          className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-mono font-medium border ${STATUS_BADGE_STYLES[status]}`}
        >
          {status}
        </span>
      </div>

      <div className="py-1">
        <div
          className={`text-xl font-bold font-mono tracking-tight ${STATUS_VALUE_STYLES[status]}`}
        >
          {value}
        </div>
        <p className="text-[11px] text-[#9CA3AF] mt-1 font-sans">{description}</p>
      </div>

      <div className="pt-2 border-t border-[#262B36]/60 flex items-center justify-between gap-2 text-[10px] text-[#6B7280] font-mono">
        <span className="truncate">{footerLeft}</span>
        <span className="shrink-0">{footerRight}</span>
      </div>
    </div>
  );
}

