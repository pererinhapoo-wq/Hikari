import React, { useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  History,
  Info,
  Network,
  Radio,
  RefreshCw,
  ShieldAlert,
  Wifi,
  WifiOff,
} from "lucide-react";
import {
  createNetworkMonitor,
  createNonBrowserNetworkSnapshot,
  type BrowserNetworkSnapshot,
  type NetworkMonitorHandle,
  type NetworkTransitionKind,
} from "@/lib/browser-network-diagnostics";
import { ModuleStatusBadge } from "./module-status-badge";

const TRANSITION_KIND_STYLE: Record<
  NetworkTransitionKind,
  { label: string; className: string }
> = {
  initial: {
    label: "INICIAL",
    className: "bg-[#181B22] text-[#06B6D4] border-[#06B6D4]/30",
  },
  online: {
    label: "ONLINE",
    className: "bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30",
  },
  offline: {
    label: "OFFLINE",
    className: "bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/30",
  },
  connection: {
    label: "PERFIL",
    className: "bg-[#8B5CF6]/15 text-[#8B5CF6] border-[#8B5CF6]/30",
  },
};

export function NetworkPanel() {
  const [snapshot, setSnapshot] = useState<BrowserNetworkSnapshot>(() =>
    createNonBrowserNetworkSnapshot(),
  );
  const monitorRef = useRef<NetworkMonitorHandle | null>(null);

  useEffect(() => {
    let active = true;
    const monitor = createNetworkMonitor((next) => {
      if (!active) return;
      setSnapshot(next);
    });
    monitorRef.current = monitor;

    return () => {
      active = false;
      monitor.destroy();
      monitorRef.current = null;
    };
  }, []);

  const handleManualRefresh = () => {
    monitorRef.current?.refresh();
  };

  const { networkInfo } = snapshot;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Cabeçalho */}
      <div className="rounded-xl border border-[#262B36] bg-[#111318] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="size-9 shrink-0 rounded-lg bg-[#06B6D4]/15 border border-[#06B6D4]/30 flex items-center justify-center text-[#06B6D4]">
            <Network className="size-5" />
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-bold text-white font-sans tracking-tight">
                Rede e Conexão do Navegador
              </h2>
              <span className="px-2 py-0.5 rounded text-[9px] font-mono font-semibold bg-[#181B22] text-[#06B6D4] border border-[#06B6D4]/30">
                CLIENT-ONLY
              </span>
            </div>
            <p className="text-xs text-[#9CA3AF] font-sans leading-relaxed">
              Monitoramento passivo exclusivo do navegador e dispositivo atuais do administrador. Nenhuma requisição HTTP, ping ou teste de velocidade é disparado por este painel.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <span className="px-2.5 py-2 rounded-lg bg-[#181B22] border border-[#262B36] text-[11px] font-mono tabular-nums text-[#9CA3AF]">
            Leitura: {snapshot.measuredAt}
          </span>
          <button
            type="button"
            onClick={handleManualRefresh}
            className="min-h-[38px] flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#181B22] hover:bg-[#212630] active:bg-[#262B36] border border-[#262B36] text-xs font-sans font-medium text-white transition-colors cursor-pointer"
          >
            <RefreshCw className="size-3.5 text-[#06B6D4]" />
            <span>Atualizar Leitura</span>
          </button>
        </div>
      </div>

      {/* Estado geral + navigator.onLine */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-[#262B36] bg-[#111318] p-4 sm:p-5 space-y-3 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Activity className="size-4 text-[#8B5CF6]" />
              <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#E5E7EB]">
                Estado Passivo da Sessão
              </h3>
            </div>
            <ModuleStatusBadge status={snapshot.status} />
          </div>
          <p className="text-xs text-[#E5E7EB] font-sans leading-relaxed">
            {snapshot.statusReason}
          </p>
          <div className="rounded-lg border border-[#262B36] bg-[#181B22] px-3 py-2 flex items-center justify-between gap-2 text-[11px] font-mono text-[#9CA3AF]">
            <span>Listeners online / offline</span>
            <span className={snapshot.isBrowserEnvironment ? "text-[#10B981]" : "text-[#6B7280]"}>
              {snapshot.isBrowserEnvironment ? "ATIVOS" : "AGUARDANDO"}
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-[#262B36] bg-[#111318] p-4 sm:p-5 space-y-3 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {snapshot.onLine === false ? (
                <WifiOff className="size-4 text-[#EF4444]" />
              ) : (
                <Wifi className="size-4 text-[#10B981]" />
              )}
              <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#E5E7EB]">
                Interface Local (navigator.onLine)
              </h3>
            </div>
            <ModuleStatusBadge
              status={
                snapshot.onLine === true
                  ? "SAUDÁVEL"
                  : snapshot.onLine === false
                    ? "CRÍTICO"
                    : "NÃO VERIFICADO"
              }
            />
          </div>

          <div className="text-xl font-bold font-mono text-white">
            {snapshot.onlineLabel}
          </div>

          <div className="rounded-lg border border-[#F59E0B]/30 bg-[#181B22] px-3 py-2.5 flex items-start gap-2">
            <Info className="size-3.5 text-[#F59E0B] shrink-0 mt-0.5" />
            <p className="text-[11px] text-[#9CA3AF] font-sans leading-relaxed">
              {snapshot.onlineCaveat}
            </p>
          </div>
        </div>
      </section>

      {/* NetworkInformation API */}
      <section className="rounded-xl border border-[#262B36] bg-[#111318] p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Radio className="size-4 text-[#06B6D4] shrink-0" />
            <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#E5E7EB]">
              Sinais Heurísticos (NetworkInformation API)
            </h3>
          </div>
          <ModuleStatusBadge
            status={
              networkInfo.supported
                ? networkInfo.effectiveType
                  ? "SAUDÁVEL"
                  : "PARCIAL"
                : "INDISPONÍVEL"
            }
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-3.5 space-y-1.5 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-mono uppercase text-[#9CA3AF]">
                Perfil Efetivo
              </span>
              <ModuleStatusBadge
                status={
                  !networkInfo.supported
                    ? "INDISPONÍVEL"
                    : networkInfo.effectiveType
                      ? "SAUDÁVEL"
                      : "NÃO VERIFICADO"
                }
                showDot={false}
              />
            </div>
            <div className="text-lg font-bold font-mono text-white uppercase">
              {networkInfo.effectiveType ?? "--"}
            </div>
            <p className="text-[11px] text-[#9CA3AF] font-sans leading-snug">
              {networkInfo.type
                ? `Tipo físico reportado: ${networkInfo.type}`
                : "Tipo físico de interface não exposto pelo navegador."}
            </p>
          </div>

          <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-3.5 space-y-1.5 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-mono uppercase text-[#9CA3AF]">
                RTT Estimado
              </span>
              <ModuleStatusBadge
                status={
                  !networkInfo.supported
                    ? "INDISPONÍVEL"
                    : networkInfo.rttMs !== null
                      ? "PARCIAL"
                      : "NÃO VERIFICADO"
                }
                showDot={false}
              />
            </div>
            <div className="text-lg font-bold font-mono tabular-nums text-white">
              {networkInfo.rttMs !== null ? `~${networkInfo.rttMs} ms` : "--"}
            </div>
            <p className="text-[11px] text-[#9CA3AF] font-sans leading-snug">
              {networkInfo.rttNote}
            </p>
          </div>

          <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-3.5 space-y-1.5 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-mono uppercase text-[#9CA3AF]">
                Downlink Estimado
              </span>
              <ModuleStatusBadge
                status={
                  !networkInfo.supported
                    ? "INDISPONÍVEL"
                    : networkInfo.downlinkMbps !== null
                      ? "PARCIAL"
                      : "NÃO VERIFICADO"
                }
                showDot={false}
              />
            </div>
            <div className="text-lg font-bold font-mono tabular-nums text-white">
              {networkInfo.downlinkMbps !== null
                ? `~${networkInfo.downlinkMbps} Mbps`
                : "--"}
            </div>
            <p className="text-[11px] text-[#9CA3AF] font-sans leading-snug">
              {networkInfo.downlinkNote}
            </p>
          </div>

          <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-3.5 space-y-1.5 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-mono uppercase text-[#9CA3AF]">
                Save-Data (Economia)
              </span>
              <ModuleStatusBadge
                status={
                  !networkInfo.supported
                    ? "INDISPONÍVEL"
                    : networkInfo.saveData === true
                      ? "ATENÇÃO"
                      : networkInfo.saveData === false
                        ? "SAUDÁVEL"
                        : "NÃO VERIFICADO"
                }
                showDot={false}
              />
            </div>
            <div className="text-lg font-bold font-mono text-white">
              {networkInfo.saveData === true
                ? "Ativo"
                : networkInfo.saveData === false
                  ? "Inativo"
                  : "--"}
            </div>
            <p className="text-[11px] text-[#9CA3AF] font-sans leading-snug">
              {networkInfo.changeEventsSupported
                ? "Eventos NetworkInformation.change suportados."
                : "Sem suporte a eventos NetworkInformation.change."}
            </p>
          </div>
        </div>
      </section>

      {/* Histórico em memória de transições + Limitações */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-[#262B36] bg-[#111318] p-4 sm:p-5 space-y-3 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <History className="size-4 text-[#06B6D4]" />
              <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#E5E7EB]">
                Transições na Sessão ({snapshot.transitions.length}/{snapshot.historyLimit})
              </h3>
            </div>
            <span className="text-[10px] font-mono text-[#6B7280]">
              Apenas em memória
            </span>
          </div>

          {snapshot.transitions.length === 0 ? (
            <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-3 text-xs text-[#9CA3AF] font-sans">
              Nenhuma transição registrada ainda.
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {snapshot.transitions.map((entry) => {
                const badge = TRANSITION_KIND_STYLE[entry.kind];
                return (
                  <div
                    key={entry.id}
                    className="rounded-lg border border-[#262B36] bg-[#181B22] p-2.5 space-y-1 min-w-0"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold border ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                      <span className="text-[10px] font-mono tabular-nums text-[#6B7280]">
                        {entry.timestamp}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#E5E7EB] font-sans leading-snug break-words">
                      {entry.summary}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[#262B36] bg-[#111318] p-4 sm:p-5 space-y-3 min-w-0">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-[#F59E0B]" />
            <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#E5E7EB]">
              Limitações e Escopo da Leitura
            </h3>
          </div>
          <div className="space-y-2">
            {snapshot.limitations.map((item, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-[#262B36] bg-[#181B22] px-3 py-2.5 flex items-start gap-2"
              >
                <Info className="size-3.5 text-[#06B6D4] shrink-0 mt-0.5" />
                <p className="text-[11px] text-[#9CA3AF] font-sans leading-relaxed">
                  {item}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="rounded-xl border border-[#262B36] bg-[#111318] px-4 py-3 flex items-start gap-2.5">
        <ShieldAlert className="size-4 text-[#6B7280] shrink-0 mt-0.5" />
        <p className="text-[11px] text-[#9CA3AF] font-sans leading-relaxed">
          Os listeners passivos de rede são removidos automaticamente ao sair deste módulo. Nenhum dado de conexão é enviado ao servidor ou armazenado fora da memória temporária desta aba.
        </p>
      </div>
    </div>
  );
}
