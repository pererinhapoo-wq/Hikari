import React, { useState } from "react";
import { CommandCenterHeader } from "./command-center-header";
import { CommandCenterNavigation, MODULES } from "./command-center-navigation";
import { SystemHealthBanner } from "./system-health-banner";
import { MetricCard } from "./metric-card";
import { SubsystemStatus } from "./subsystem-status";
import { EmptyEventFeed } from "./empty-event-feed";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { Link } from "@tanstack/react-router";

export function CommandCenterLayout() {
  const [activeModule, setActiveModule] = useState("overview");
  const [lastUpdated, setLastUpdated] = useState(() => new Date().toLocaleTimeString("pt-BR"));

  const handleRefresh = () => {
    setLastUpdated(new Date().toLocaleTimeString("pt-BR"));
  };

  const currentModuleObj = MODULES.find((m) => m.id === activeModule);

  return (
    <div className="fixed inset-0 z-50 bg-[#090A0F] text-[#E5E7EB] font-sans overflow-y-auto flex flex-col">
      {/* Top Operational Header */}
      <CommandCenterHeader lastUpdated={lastUpdated} onRefresh={handleRefresh} />

      {/* Sub-header with back to studio link */}
      <div className="bg-[#111318] border-b border-[#262B36] px-4 py-2 md:px-6 flex items-center justify-between text-xs">
        <Link
          to="/admin"
          className="inline-flex items-center gap-1.5 text-[#9CA3AF] hover:text-white transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          <span>Voltar ao Studio Admin</span>
        </Link>
        <span className="font-mono text-[10px] text-[#6B7280]">
          Módulo Ativo: <strong className="text-white">{currentModuleObj?.label}</strong>
        </span>
      </div>

      {/* Main Container: Sidebar + Content */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        <CommandCenterNavigation
          activeModule={activeModule}
          onSelectModule={setActiveModule}
        />

        {/* Content Area */}
        <main className="flex-1 p-4 md:p-6 space-y-6 overflow-y-auto bg-[#090A0F]">
          {activeModule === "overview" ? (
            <div className="space-y-6 max-w-7xl mx-auto">
              {/* A. Global State Banner */}
              <SystemHealthBanner />

              {/* B. Indicator Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  title="Performance"
                  type="performance"
                  description="Latência e tempo de renderização"
                />
                <MetricCard
                  title="Network & Outbox"
                  type="network"
                  description="Fila de sincronização offline"
                />
                <MetricCard
                  title="Cache State"
                  type="cache"
                  description="Upstash Redis & Local Cache"
                />
                <MetricCard
                  title="Storage Quota"
                  type="storage"
                  description="LocalStorage & IndexedDB size"
                />
              </div>

              {/* C. Subsystem Status */}
              <SubsystemStatus />

              {/* D. Recent Events */}
              <div className="space-y-3">
                <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#9CA3AF]">
                  Eventos e Alertas Recentes
                </h3>
                <EmptyEventFeed />
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto py-12 px-6 rounded-xl border border-[#262B36] bg-[#111318] text-center space-y-3">
              <div className="inline-flex items-center justify-center size-12 rounded-xl bg-[#181B22] border border-[#262B36] text-[#06B6D4]">
                <ShieldAlert className="size-6" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-white font-sans">
                  Módulo: {currentModuleObj?.label}
                </h2>
                <p className="text-xs font-mono uppercase tracking-wider text-[#F59E0B]">
                  EM PLANEJAMENTO E ESTRUTURAÇÃO VISUAL
                </p>
              </div>
              <p className="text-xs text-[#9CA3AF] max-w-md mx-auto font-sans pt-1">
                Este módulo foi concebido na arquitetura do Command Center mas ainda não possui sua interface específica implementada. Retorne à Visão Geral para inspecionar o estado visual base.
              </p>
              <div className="pt-3">
                <button
                  onClick={() => setActiveModule("overview")}
                  className="px-4 py-2 rounded-lg bg-[#181B22] hover:bg-[#212630] border border-[#262B36] text-xs font-sans font-medium text-white transition-colors cursor-pointer"
                >
                  Retornar à Visão Geral
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
