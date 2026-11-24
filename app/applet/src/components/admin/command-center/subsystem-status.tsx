import React from "react";
import { Server, Database, PlaySquare, Globe } from "lucide-react";

interface SubsystemItem {
  name: string;
  type: string;
  icon: React.ReactNode;
}

const SUBSYSTEMS: SubsystemItem[] = [
  { name: "Neon PostgreSQL", type: "Banco de Dados Relacional", icon: <Database className="size-4 text-[#8B5CF6]" /> },
  { name: "Upstash Redis", type: "Cache Distribuído", icon: <Server className="size-4 text-[#06B6D4]" /> },
  { name: "Hikari Player", type: "Streaming & HLS Engine", icon: <PlaySquare className="size-4 text-[#10B981]" /> },
  { name: "APIs externas", type: "AniList & Metadados", icon: <Globe className="size-4 text-[#F59E0B]" /> },
];

export function SubsystemStatus() {
  return (
    <div className="rounded-xl border border-[#262B36] bg-[#111318] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#9CA3AF]">
          Estado dos Subsistemas
        </h3>
        <span className="text-[10px] font-mono text-[#6B7280]">0 / 4 Sondas Ativas</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {SUBSYSTEMS.map((sub) => (
          <div
            key={sub.name}
            className="flex items-center justify-between p-3.5 rounded-lg bg-[#181B22] border border-[#262B36]"
          >
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-lg bg-[#111318] border border-[#262B36] flex items-center justify-center">
                {sub.icon}
              </div>
              <div>
                <span className="text-xs font-semibold text-white font-sans block">{sub.name}</span>
                <span className="text-[10px] text-[#6B7280] font-sans">{sub.type}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-[#6B7280]" />
              <span className="text-[10px] font-mono font-medium text-[#6B7280]">
                NÃO VERIFICADO
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
