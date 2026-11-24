import React, { useState } from "react";
import { RefreshCw, Activity, ShieldCheck, Globe } from "lucide-react";

interface CommandCenterHeaderProps {
  lastUpdated: string;
  onRefresh: () => void;
}

export function CommandCenterHeader({ lastUpdated, onRefresh }: CommandCenterHeaderProps) {
  const [isSpinning, setIsSpinning] = useState(false);

  const handleRefreshClick = () => {
    setIsSpinning(true);
    onRefresh();
    setTimeout(() => setIsSpinning(false), 600);
  };

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
            Central de Diagnóstico e Telemetria em Tempo Real
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* Status Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#181B22] border border-[#262B36]">
          <span className="size-2 rounded-full bg-[#6B7280]" />
          <span className="text-xs font-mono font-semibold text-[#6B7280] uppercase tracking-wider">
            AGUARDANDO SONDAS
          </span>
        </div>

        {/* Last Updated */}
        <div className="hidden lg:flex items-center gap-1.5 text-xs text-[#6B7280] font-mono px-3 py-1.5 rounded-lg bg-[#181B22] border border-[#262B36]">
          <span className="text-[#9CA3AF]">Sync:</span>
          <span>{lastUpdated}</span>
        </div>

        {/* Refresh Button */}
        <button
          onClick={handleRefreshClick}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#181B22] hover:bg-[#212630] border border-[#262B36] text-xs font-sans font-medium text-white transition-colors cursor-pointer"
          title="Atualizar carimbo de tempo da interface"
        >
          <RefreshCw className={`size-3.5 text-[#06B6D4] ${isSpinning ? "animate-spin" : ""}`} />
          <span>Atualizar UI</span>
        </button>
      </div>
    </header>
  );
}
