import React, { useEffect, useRef, useState } from "react";
import {
  AlertOctagon,
  AlertTriangle,
  Database,
  FileWarning,
  Info,
  RefreshCw,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import {
  createErrorsMonitor,
  createNonBrowserErrorsSnapshot,
  type BrowserErrorsSnapshot,
  type CapturedErrorKind,
  type ErrorsMonitorHandle,
} from "@/lib/browser-errors-diagnostics";
import { ModuleStatusBadge } from "./module-status-badge";

const ERROR_KIND_BADGE: Record<
  CapturedErrorKind,
  { label: string; className: string }
> = {
  runtime_error: {
    label: "RUNTIME JS",
    className: "bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/30",
  },
  unhandled_rejection: {
    label: "PROMISE",
    className: "bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/30",
  },
  resource_error: {
    label: "RECURSO",
    className: "bg-[#06B6D4]/15 text-[#06B6D4] border-[#06B6D4]/30",
  },
};

export function ErrorsPanel() {
  const [snapshot, setSnapshot] = useState<BrowserErrorsSnapshot>(() =>
    createNonBrowserErrorsSnapshot(),
  );
  const monitorRef = useRef<ErrorsMonitorHandle | null>(null);

  useEffect(() => {
    let active = true;
    const monitor = createErrorsMonitor((next) => {
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

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Cabeçalho */}
      <div className="rounded-xl border border-[#262B36] bg-[#111318] p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="size-9 shrink-0 rounded-lg bg-[#EF4444]/15 border border-[#EF4444]/30 flex items-center justify-center text-[#EF4444]">
            <AlertOctagon className="size-5" />
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-bold text-white font-sans tracking-tight">
                Observabilidade de Erros (Sessão &amp; Outbox Local)
              </h2>
              <span className="px-2 py-0.5 rounded text-[9px] font-mono font-semibold bg-[#181B22] text-[#06B6D4] border border-[#06B6D4]/30">
                CLIENT-ONLY
              </span>
            </div>
            <p className="text-xs text-[#9CA3AF] font-sans leading-relaxed">
              Captura em memória de erros da sessão atual enquanto este painel está aberto e leitura do estado persistido no Outbox local. NÃO representa histórico global de visitantes nem logs do servidor.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <span className="px-2.5 py-2 rounded-lg bg-[#181B22] border border-[#262B36] text-[11px] font-mono tabular-nums text-[#9CA3AF]">
            Leitura: {snapshot.measuredAt}
          </span>
          <button
            type="button"
            onClick={() => monitorRef.current?.clearSessionBuffer()}
            className="min-h-[38px] flex items-center gap-2 px-3 py-2 rounded-lg bg-[#181B22] hover:bg-[#212630] border border-[#262B36] text-xs font-sans font-medium text-[#E5E7EB] transition-colors cursor-pointer"
          >
            <Trash2 className="size-3.5 text-[#F59E0B]" />
            <span>Limpar Buffer</span>
          </button>
          <button
            type="button"
            onClick={() => monitorRef.current?.refresh()}
            className="min-h-[38px] flex items-center gap-2 px-3 py-2 rounded-lg bg-[#181B22] hover:bg-[#212630] border border-[#262B36] text-xs font-sans font-medium text-white transition-colors cursor-pointer"
          >
            <RefreshCw className="size-3.5 text-[#06B6D4]" />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {/* Estado atual + contadores */}
      <section className="rounded-xl border border-[#262B36] bg-[#111318] p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FileWarning className="size-4 text-[#06B6D4]" />
            <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#E5E7EB]">
              Resumo da Sessão Ativa do Administrador
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#181B22] border border-[#262B36] text-[#9CA3AF]">
              Listeners: {snapshot.listenerActive ? "ATIVOS" : "INATIVOS"}
            </span>
            <ModuleStatusBadge status={snapshot.sessionStatus} />
          </div>
        </div>

        <p className="text-xs text-[#E5E7EB] font-sans leading-relaxed">
          {snapshot.sessionStatusReason}
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-3">
            <span className="text-[10px] font-mono uppercase text-[#6B7280] block">
              Total Sessão
            </span>
            <span className="text-xl font-bold font-mono tabular-nums text-white">
              {snapshot.sessionCounts.total}
            </span>
          </div>
          <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-3">
            <span className="text-[10px] font-mono uppercase text-[#6B7280] block">
              Runtime JS
            </span>
            <span className="text-xl font-bold font-mono tabular-nums text-[#EF4444]">
              {snapshot.sessionCounts.runtime}
            </span>
          </div>
          <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-3">
            <span className="text-[10px] font-mono uppercase text-[#6B7280] block">
              Promises
            </span>
            <span className="text-xl font-bold font-mono tabular-nums text-[#F59E0B]">
              {snapshot.sessionCounts.unhandledRejection}
            </span>
          </div>
          <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-3">
            <span className="text-[10px] font-mono uppercase text-[#6B7280] block">
              Recursos
            </span>
            <span className="text-xl font-bold font-mono tabular-nums text-[#06B6D4]">
              {snapshot.sessionCounts.resource}
            </span>
          </div>
          <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-3 col-span-2 sm:col-span-1">
            <span className="text-[10px] font-mono uppercase text-[#6B7280] block">
              Conflitos Outbox
            </span>
            <span className="text-xl font-bold font-mono tabular-nums text-[#8B5CF6]">
              {snapshot.persistedLocalOutbox.conflictCount}
            </span>
          </div>
        </div>
      </section>

      {/* Buffer em memória da sessão + Outbox local */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-[#262B36] bg-[#111318] p-4 sm:p-5 space-y-3 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#E5E7EB]">
              Buffer em Memória da Sessão (Máx. 25)
            </h3>
            <span className="text-[10px] font-mono text-[#6B7280]">
              URLs e parâmetros sanitizados
            </span>
          </div>

          {snapshot.sessionErrors.length === 0 ? (
            <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-4 text-xs text-[#9CA3AF] font-sans leading-relaxed">
              Nenhum erro capturado enquanto este módulo permaneceu aberto. Lembre-se de que exceções ocorridas antes da abertura do painel ou em outros navegadores não ficam gravadas aqui.
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {snapshot.sessionErrors.map((err) => {
                const badge = ERROR_KIND_BADGE[err.kind];
                return (
                  <div
                    key={err.id}
                    className="rounded-lg border border-[#262B36] bg-[#181B22] p-3 space-y-1.5 min-w-0"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold border ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                      <span className="text-[10px] font-mono tabular-nums text-[#6B7280]">
                        {err.timestamp}
                      </span>
                    </div>
                    <div className="text-xs font-mono font-semibold text-white break-all">
                      {err.name}
                    </div>
                    <p className="text-[11px] text-[#E5E7EB] font-sans leading-snug break-words">
                      {err.message}
                    </p>
                    <div className="text-[10px] font-mono text-[#6B7280] break-all">
                      Origem: {err.sanitizedSource}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[#262B36] bg-[#111318] p-4 sm:p-5 space-y-3 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Database className="size-4 text-[#8B5CF6]" />
              <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#E5E7EB]">
                Conflitos Persistidos no Outbox Local
              </h3>
            </div>
            <ModuleStatusBadge
              status={
                !snapshot.persistedLocalOutbox.available
                  ? "INDISPONÍVEL"
                  : snapshot.persistedLocalOutbox.conflictCount > 0
                    ? "ATENÇÃO"
                    : "SAUDÁVEL"
              }
            />
          </div>

          <p className="text-[11px] text-[#9CA3AF] font-sans leading-relaxed">
            {snapshot.persistedLocalOutbox.note}
          </p>

          {snapshot.persistedLocalOutbox.items.length === 0 ? (
            <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-4 text-xs text-[#9CA3AF] font-sans">
              Nenhum conflito ou falha pendente registrada na fila local <code className="font-mono text-[#E5E7EB]">hikari-episode-outbox-v1</code>.
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {snapshot.persistedLocalOutbox.items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-[#F59E0B]/30 bg-[#181B22] p-3 space-y-1 min-w-0"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono">
                    <span className="text-[#F59E0B] uppercase font-semibold">
                      {item.type} • {item.attempts} tentativa(s)
                    </span>
                    <span className="text-[#6B7280]">
                      {item.lastAttemptAt ?? "Sem horário"}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-white break-all">
                    Anime: {item.animeId} • Ep: {item.episodeId}
                    {item.seasonNumber !== null && item.episodeNumber !== null
                      ? ` (T${item.seasonNumber} E${item.episodeNumber})`
                      : ""}
                  </div>
                  <p className="text-[11px] text-[#9CA3AF] font-sans break-words">
                    {item.lastError}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Mecanismos do projeto + Informações indisponíveis */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-[#262B36] bg-[#111318] p-4 sm:p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Info className="size-4 text-[#06B6D4]" />
            <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#E5E7EB]">
              Mecanismos de Erro Existentes no Projeto
            </h3>
          </div>
          <div className="space-y-2.5">
            {snapshot.projectMechanisms.map((mech) => (
              <div
                key={mech.id}
                className="rounded-lg border border-[#262B36] bg-[#181B22] p-3 space-y-1 min-w-0"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-white font-sans">
                    {mech.name}
                  </span>
                  <ModuleStatusBadge status={mech.status} showDot={false} />
                </div>
                <p className="text-[11px] text-[#9CA3AF] font-sans">
                  Escopo: {mech.scope}
                </p>
                <p className="text-[10px] font-mono text-[#6B7280]">
                  Persistência: {mech.persistence}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-[#262B36] bg-[#111318] p-4 sm:p-5 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-[#F59E0B]" />
            <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#E5E7EB]">
              Informações Globalmente Indisponíveis
            </h3>
          </div>
          <div className="space-y-2.5">
            {snapshot.unavailableInfo.map((info) => (
              <div
                key={info.label}
                className="rounded-lg border border-[#262B36] bg-[#181B22] p-3 space-y-1.5 min-w-0"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-white font-sans">
                    {info.label}
                  </span>
                  <ModuleStatusBadge status={info.status} showDot={false} />
                </div>
                <p className="text-[11px] text-[#9CA3AF] font-sans leading-relaxed">
                  {info.reason}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="rounded-xl border border-[#262B36] bg-[#111318] px-4 py-3 flex items-start gap-2.5">
        <ShieldAlert className="size-4 text-[#6B7280] shrink-0 mt-0.5" />
        <p className="text-[11px] text-[#9CA3AF] font-sans leading-relaxed">
          {snapshot.limitations.join(" ")}
        </p>
      </div>
    </div>
  );
}
