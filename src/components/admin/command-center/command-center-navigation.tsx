import React from "react";
import {
  LayoutDashboard,
  Gauge,
  Network,
  Database,
  HardDrive,
  PlaySquare,
  Smartphone,
  AlertOctagon,
  Server,
} from "lucide-react";

export interface NavModule {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: string;
}

const MODULES: NavModule[] = [
  { id: "overview", label: "Visão Geral", icon: <LayoutDashboard className="size-4" />, badge: "Ativo" },
  { id: "performance", label: "Desempenho", icon: <Gauge className="size-4" />, badge: "Ativo" },
  { id: "network", label: "Rede e Conexão", icon: <Network className="size-4" />, badge: "Planejado" },
  { id: "cache", label: "Cache", icon: <Database className="size-4" />, badge: "Planejado" },
  { id: "storage", label: "Armazenamento", icon: <HardDrive className="size-4" />, badge: "Ativo" },
  { id: "player", label: "Player", icon: <PlaySquare className="size-4" />, badge: "Planejado" },
  { id: "compatibility", label: "Compatibilidade", icon: <Smartphone className="size-4" />, badge: "Ativo" },
  { id: "errors", label: "Erros", icon: <AlertOctagon className="size-4" />, badge: "Planejado" },
  { id: "infrastructure", label: "Infraestrutura", icon: <Server className="size-4" />, badge: "Planejado" },
];

interface CommandCenterNavigationProps {
  activeModule: string;
  onSelectModule: (id: string) => void;
}

export function CommandCenterNavigation({
  activeModule,
  onSelectModule,
}: CommandCenterNavigationProps) {
  return (
    <>
      {/* Desktop Sidebar Navigation */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 bg-[#111318] border-r border-[#262B36] p-4 space-y-1.5">
        <div className="px-3 py-2 text-[10px] font-mono font-semibold uppercase tracking-wider text-[#6B7280]">
          Módulos de Telemetria
        </div>
        {MODULES.map((mod) => {
          const isActive = activeModule === mod.id;
          return (
            <button
              key={mod.id}
              onClick={() => onSelectModule(mod.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-sans transition-colors cursor-pointer ${
                isActive
                  ? "bg-[#181B22] text-white border border-[#262B36] font-semibold shadow-sm"
                  : "text-[#9CA3AF] hover:bg-[#181B22]/60 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={isActive ? "text-[#06B6D4]" : "text-[#6B7280]"}>{mod.icon}</span>
                <span>{mod.label}</span>
              </div>
              <span
                className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                  isActive
                    ? "bg-[#06B6D4]/10 text-[#06B6D4] border-[#06B6D4]/30"
                    : "bg-[#181B22] text-[#6B7280] border-[#262B36]"
                }`}
              >
                {mod.badge}
              </span>
            </button>
          );
        })}
      </aside>

      {/* Mobile Horizontal Scrollable Navigation */}
      <div className="lg:hidden w-full bg-[#111318] border-b border-[#262B36] px-4 py-2.5 overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-2 min-w-max">
          {MODULES.map((mod) => {
            const isActive = activeModule === mod.id;
            return (
              <button
                key={mod.id}
                onClick={() => onSelectModule(mod.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-sans transition-colors cursor-pointer shrink-0 ${
                  isActive
                    ? "bg-[#181B22] text-white border border-[#262B36] font-semibold"
                    : "bg-[#111318] text-[#9CA3AF] hover:bg-[#181B22]/60 border border-transparent"
                }`}
              >
                <span className={isActive ? "text-[#06B6D4]" : "text-[#6B7280]"}>{mod.icon}</span>
                <span>{mod.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

export { MODULES };
