import React from "react";
import { AlertCircle } from "lucide-react";

export function SystemHealthBanner() {
  return (
    <div className="rounded-xl border border-[#262B36] bg-[#111318] p-5 space-y-2">
      <div className="flex items-start gap-3.5">
        <div className="mt-0.5 size-8 shrink-0 rounded-lg bg-[#6B7280]/15 border border-[#6B7280]/30 flex items-center justify-center text-[#6B7280]">
          <AlertCircle className="size-4" />
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-white font-sans tracking-tight">
              SISTEMA AGUARDANDO SONDAS
            </h2>
            <span className="px-2 py-0.5 rounded text-[9px] font-mono font-semibold bg-[#262B36] text-[#6B7280]">
              ESTRUTURA VISUAL
            </span>
          </div>
          <p className="text-xs text-[#9CA3AF] leading-relaxed font-sans">
            A arquitetura visual do Hikari Command Center está ativa em modo de isolamento. As integrações com o Neon PostgreSQL, Upstash Redis e métricas reais de infraestrutura serão conectadas nas próximas etapas. Nenhum diagnóstico real está ativo no momento.
          </p>
        </div>
      </div>
    </div>
  );
}
