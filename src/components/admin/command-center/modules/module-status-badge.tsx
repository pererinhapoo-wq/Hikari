import React from "react";

export type CommandCenterModuleStatus =
  | "SAUDÁVEL"
  | "ATENÇÃO"
  | "CRÍTICO"
  | "INDISPONÍVEL"
  | "NÃO VERIFICADO"
  | "PARCIAL";

const MODULE_STATUS_BADGE_MAP: Record<CommandCenterModuleStatus, string> = {
  SAUDÁVEL: "bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30",
  ATENÇÃO: "bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/30",
  CRÍTICO: "bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/30",
  INDISPONÍVEL: "bg-[#94A3B8]/15 text-[#94A3B8] border-[#94A3B8]/30",
  "NÃO VERIFICADO": "bg-[#181B22] text-[#9CA3AF] border-[#262B36]",
  PARCIAL: "bg-[#06B6D4]/15 text-[#06B6D4] border-[#06B6D4]/30",
};

const MODULE_STATUS_DOT_MAP: Record<CommandCenterModuleStatus, string> = {
  SAUDÁVEL: "bg-[#10B981]",
  ATENÇÃO: "bg-[#F59E0B]",
  CRÍTICO: "bg-[#EF4444]",
  INDISPONÍVEL: "bg-[#94A3B8]",
  "NÃO VERIFICADO": "bg-[#6B7280]",
  PARCIAL: "bg-[#06B6D4]",
};

export function ModuleStatusBadge({
  status,
  showDot = true,
}: {
  status: CommandCenterModuleStatus;
  showDot?: boolean;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${MODULE_STATUS_BADGE_MAP[status]}`}
    >
      {showDot && (
        <span className={`size-1.5 rounded-full ${MODULE_STATUS_DOT_MAP[status]}`} />
      )}
      <span>{status}</span>
    </span>
  );
}
