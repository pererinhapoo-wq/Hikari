import React from "react";
import { Gauge, Network, Database, HardDrive } from "lucide-react";

interface MetricCardProps {
  title: string;
  type: "performance" | "network" | "cache" | "storage";
  description: string;
}

const ICONS = {
  performance: <Gauge className="size-4 text-[#6B7280]" />,
  network: <Network className="size-4 text-[#6B7280]" />,
  cache: <Database className="size-4 text-[#6B7280]" />,
  storage: <HardDrive className="size-4 text-[#6B7280]" />,
};

export function MetricCard({ title, type, description }: MetricCardProps) {
  return (
    <div className="rounded-xl border border-[#262B36] bg-[#111318] p-4 flex flex-col justify-between space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-lg bg-[#181B22] border border-[#262B36] flex items-center justify-center">
            {ICONS[type]}
          </div>
          <span className="text-xs font-semibold text-white font-sans">{title}</span>
        </div>
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-[#181B22] text-[#6B7280] border border-[#262B36]">
          NÃO VERIFICADO
        </span>
      </div>

      <div className="py-1">
        <div className="text-xl font-bold font-mono text-[#6B7280] tracking-tight">--</div>
        <p className="text-[11px] text-[#6B7280] mt-1 font-sans">{description}</p>
      </div>

      <div className="pt-2 border-t border-[#262B36]/60 flex items-center justify-between text-[10px] text-[#6B7280] font-mono">
        <span>Status: Aguardando Sonda</span>
        <span>0 ms</span>
      </div>
    </div>
  );
}
