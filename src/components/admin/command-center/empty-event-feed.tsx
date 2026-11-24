import React from "react";
import { Radio } from "lucide-react";

export function EmptyEventFeed() {
  return (
    <div className="rounded-xl border border-[#262B36] bg-[#111318] p-8 text-center space-y-3">
      <div className="mx-auto size-10 rounded-xl bg-[#181B22] border border-[#262B36] flex items-center justify-center text-[#6B7280]">
        <Radio className="size-5" />
      </div>
      <div className="space-y-1">
        <h4 className="text-sm font-semibold text-white font-sans">Nenhum evento registrado</h4>
        <p className="text-xs text-[#6B7280] font-sans max-w-sm mx-auto">
          O feed de telemetria e o histórico de incidentes estão vazios. Nenhum evento de sistema ou alerta foi integrado nesta etapa visual.
        </p>
      </div>
    </div>
  );
}
