import React, { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  Cpu,
  Database,
  ExternalLink,
  HardDrive,
  Info,
  RefreshCw,
  Server,
  ShieldAlert,
  Zap,
} from "lucide-react";
import type { CommandCenterDiagnosticsReport } from "@/lib/admin-diagnostics.functions";
import {
  readBrowserOutboxSummary,
  subscribeOutboxStoragePassive,
  type BrowserOutboxSummary,
} from "@/lib/browser-outbox-diagnostics";
import {
  ModuleStatusBadge,
  type CommandCenterModuleStatus,
} from "./module-status-badge";

interface InfrastructurePanelProps {
  diagnostics: CommandCenterDiagnosticsReport | null;
  isLoading: boolean;
  requestError: string | null;
  onRefresh: () => void;
  lastUpdated: string;
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hours}h ${remMins}m`;
}

export function InfrastructurePanel({
  diagnostics,
  isLoading,
  requestError,
  onRefresh,
  lastUpdated,
}: InfrastructurePanelProps) {
  const [outboxSummary, setOutboxSummary] = useState<BrowserOutboxSummary>(() =>
    readBrowserOutboxSummary(),
  );

  useEffect(() => {
    setOutboxSummary(readBrowserOutboxSummary());
    return subscribeOutboxStoragePassive((next) => {
      setOutboxSummary(next);
    });
  }, []);

  const overallStatus: CommandCenterModuleStatus = diagnostics
    ? diagnostics.overallStatus
    : requestError
      ? "CRÍTICO"
      : "NÃO VERIFICADO";

  const dbStatus: CommandCenterModuleStatus = diagnostics
    ? diagnostics.database.status
    : requestError
      ? "CRÍTICO"
      : "NÃO VERIFICADO";

  const redisStatus: CommandCenterModuleStatus = diagnostics
    ? diagnostics.redis.status
    : "NÃO VERIFICADO";

  const outboxStatus: CommandCenterModuleStatus = !outboxSummary.available
    ? "INDISPONÍVEL"
    : outboxSummary.conflictCount > 0
      ? "ATENÇÃO"
      : "SAUDÁVEL";

  const handleManualRefresh = () => {
    setOutboxSummary(readBrowserOutboxSummary());
    onRefresh();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Cabeçalho */}
      <div className="rounded-xl border border-[#262B36] bg-[#111318] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="size-9 shrink-0 rounded-lg bg-[#06B6D4]/15 border border-[#06B6D4]/30 flex items-center justify-center text-[#06B6D4]">
            <Server className="size-5" />
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-bold text-white font-sans tracking-tight">
                Infraestrutura e Runtime
              </h2>
              <span className="px-2 py-0.5 rounded text-[9px] font-mono font-semibold bg-[#181B22] text-[#8B5CF6] border border-[#8B5CF6]/30">
                SERVIDOR + CLIENT
              </span>
            </div>
            <p className="text-xs text-[#9CA3AF] font-sans leading-relaxed">
              Reaproveita a sonda administrativa sob demanda (Neon PostgreSQL / PGlite, Upstash Redis e runtime Node.js da instância atual) combinada com o estado passivo do Outbox local e os limites da arquitetura Vercel Hobby.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <span className="px-2.5 py-2 rounded-lg bg-[#181B22] border border-[#262B36] text-[11px] font-mono tabular-nums text-[#9CA3AF]">
            Sonda: {lastUpdated}
          </span>
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isLoading}
            className="min-h-[38px] flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#181B22] hover:bg-[#212630] disabled:opacity-60 border border-[#262B36] text-xs font-sans font-medium text-white transition-colors cursor-pointer"
          >
            <RefreshCw
              className={`size-3.5 text-[#06B6D4] ${isLoading ? "animate-spin" : ""}`}
            />
            <span>{isLoading ? "Sondando..." : "Reexecutar Sondas"}</span>
          </button>
        </div>
      </div>

      {/* Resumo consolidado da última sonda */}
      <section className="rounded-xl border border-[#262B36] bg-[#111318] p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Zap className="size-4 text-[#06B6D4]" />
            <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#E5E7EB]">
              Última Sonda Administrativa Executada
            </h3>
          </div>
          <ModuleStatusBadge status={overallStatus} />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg border border-[#262B36] bg-[#181B22] p-3.5">
          <div className="space-y-1 min-w-0">
            <div className="text-xs font-semibold text-white font-sans">
              {diagnostics
                ? diagnostics.overallTitle
                : requestError
                  ? "Falha ao executar sonda administrativa"
                  : isLoading
                    ? "Executando sondas de servidor..."
                    : "Aguardando execução manual"}
            </div>
            <p className="text-[11px] text-[#9CA3AF] font-sans leading-relaxed">
              {diagnostics
                ? diagnostics.overallMessage
                : requestError ?? "As sondas de Neon e Upstash Redis são compartilhadas com a Visão Geral sem duplicar chamadas."}
            </p>
          </div>
          <div className="shrink-0 text-left sm:text-right">
            <span className="text-[10px] font-mono uppercase text-[#6B7280] block">
              Duração da Sonda
            </span>
            <span className="text-sm font-mono font-bold tabular-nums text-[#06B6D4]">
              {diagnostics ? `${diagnostics.probeDurationMs} ms` : "--"}
            </span>
          </div>
        </div>
      </section>

      {/* Neon PostgreSQL + Upstash Redis */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-[#262B36] bg-[#111318] p-4 sm:p-5 space-y-3 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Database className="size-4 text-[#06B6D4]" />
              <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#E5E7EB]">
                Banco de Dados ({diagnostics?.database.backendLabel ?? "PostgreSQL"})
              </h3>
            </div>
            <ModuleStatusBadge status={dbStatus} />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-3">
              <span className="text-[10px] font-mono uppercase text-[#6B7280] block">
                Latência SELECT 1
              </span>
              <span className="text-lg font-bold font-mono tabular-nums text-white">
                {diagnostics?.database.latencyMs !== null &&
                diagnostics?.database.latencyMs !== undefined
                  ? `${diagnostics.database.latencyMs} ms`
                  : "--"}
              </span>
            </div>
            <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-3">
              <span className="text-[10px] font-mono uppercase text-[#6B7280] block">
                Pool / Timeout
              </span>
              <span className="text-xs font-mono font-bold text-[#06B6D4] mt-1 block">
                Pool max: 2 • Guard 4000ms
              </span>
            </div>
          </div>

          <p className="text-[11px] text-[#9CA3AF] font-sans leading-relaxed">
            {diagnostics?.database.detail ??
              "Configuração em src/lib/db.ts: Pool(max: 2), connectionTimeoutMillis: 5000ms, idleTimeoutMillis: 30000ms, com fallback local PGlite quando DATABASE_URL não está presente."}
          </p>
        </div>

        <div className="rounded-xl border border-[#262B36] bg-[#111318] p-4 sm:p-5 space-y-3 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Zap className="size-4 text-[#8B5CF6]" />
              <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#E5E7EB]">
                Upstash Redis (Fail-Open)
              </h3>
            </div>
            <ModuleStatusBadge status={redisStatus} />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-3">
              <span className="text-[10px] font-mono uppercase text-[#6B7280] block">
                Latência PING
              </span>
              <span className="text-lg font-bold font-mono tabular-nums text-white">
                {diagnostics?.redis.latencyMs !== null &&
                diagnostics?.redis.latencyMs !== undefined
                  ? `${diagnostics.redis.latencyMs} ms`
                  : "--"}
              </span>
            </div>
            <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-3">
              <span className="text-[10px] font-mono uppercase text-[#6B7280] block">
                Timeout Fail-Open
              </span>
              <span className="text-xs font-mono font-bold text-[#8B5CF6] mt-1 block">
                2500ms (redis.ts)
              </span>
            </div>
          </div>

          <p className="text-[11px] text-[#9CA3AF] font-sans leading-relaxed">
            {diagnostics?.redis.detail ??
              "Verificação sob demanda via pingRedisHealth() sem comandos KEYS, SCAN ou DBSIZE."}
          </p>
        </div>
      </section>

      {/* Runtime Node.js + Outbox Local */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-[#262B36] bg-[#111318] p-4 sm:p-5 space-y-3 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Cpu className="size-4 text-[#10B981]" />
              <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#E5E7EB]">
                Runtime Node.js (Instância que Respondeu)
              </h3>
            </div>
            <ModuleStatusBadge
              status={diagnostics ? "SAUDÁVEL" : "NÃO VERIFICADO"}
              showDot={false}
            />
          </div>

          {diagnostics ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-2.5">
                <span className="text-[10px] font-mono uppercase text-[#6B7280] block">
                  Node.js
                </span>
                <span className="text-xs font-mono font-bold text-white">
                  {diagnostics.runtime.nodeVersion}
                </span>
              </div>
              <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-2.5">
                <span className="text-[10px] font-mono uppercase text-[#6B7280] block">
                  Plataforma / Arch
                </span>
                <span className="text-xs font-mono font-bold text-white">
                  {diagnostics.runtime.platform}/{diagnostics.runtime.arch}
                </span>
              </div>
              <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-2.5">
                <span className="text-[10px] font-mono uppercase text-[#6B7280] block">
                  Ambiente
                </span>
                <span className="text-xs font-mono font-bold text-[#06B6D4]">
                  {diagnostics.runtime.environment}
                </span>
              </div>
              <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-2.5">
                <span className="text-[10px] font-mono uppercase text-[#6B7280] block">
                  Uptime
                </span>
                <span className="text-xs font-mono font-bold tabular-nums text-white">
                  {formatUptime(diagnostics.runtime.uptimeSeconds)}
                </span>
              </div>
              <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-2.5">
                <span className="text-[10px] font-mono uppercase text-[#6B7280] block">
                  Heap Usado / Total
                </span>
                <span className="text-xs font-mono font-bold tabular-nums text-white">
                  {diagnostics.runtime.heapUsedMb} / {diagnostics.runtime.heapTotalMb} MB
                </span>
              </div>
              <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-2.5">
                <span className="text-[10px] font-mono uppercase text-[#6B7280] block">
                  RSS
                </span>
                <span className="text-xs font-mono font-bold tabular-nums text-white">
                  {diagnostics.runtime.rssMb} MB
                </span>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-3 text-xs text-[#9CA3AF] font-sans">
              Aguardando retorno da sonda administrativa.
            </div>
          )}

          <p className="text-[11px] text-[#6B7280] font-sans leading-relaxed">
            Em execução serverless na Vercel, RSS, heap e uptime representam exclusivamente o container efêmero que atendeu esta requisição — não representam um servidor contínuo global.
          </p>
        </div>

        {/* Outbox Local do Navegador */}
        <div className="rounded-xl border border-[#262B36] bg-[#111318] p-4 sm:p-5 space-y-3 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <HardDrive className="size-4 text-[#06B6D4]" />
              <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#E5E7EB]">
                Fila Outbox Local (Sincronização Offline)
              </h3>
            </div>
            <ModuleStatusBadge status={outboxStatus} />
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-2.5">
              <span className="text-[10px] font-mono uppercase text-[#6B7280] block">
                Total Fila
              </span>
              <span className="text-base font-bold font-mono tabular-nums text-white">
                {outboxSummary.totalCount}
              </span>
            </div>
            <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-2.5">
              <span className="text-[10px] font-mono uppercase text-[#6B7280] block">
                Pendentes
              </span>
              <span className="text-base font-bold font-mono tabular-nums text-[#06B6D4]">
                {outboxSummary.pendingCount}
              </span>
            </div>
            <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-2.5">
              <span className="text-[10px] font-mono uppercase text-[#6B7280] block">
                Conflitos
              </span>
              <span className="text-base font-bold font-mono tabular-nums text-[#F59E0B]">
                {outboxSummary.conflictCount}
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-[#262B36] bg-[#181B22] px-3 py-2.5 text-[11px] text-[#9CA3AF] font-sans space-y-1">
            <div>
              Chave: <code className="font-mono text-[#E5E7EB]">hikari-episode-outbox-v1</code> • Upserts: {outboxSummary.upsertCount} • Exclusões: {outboxSummary.deleteCount}
            </div>
            <p className="text-[11px] text-[#6B7280]">
              {outboxSummary.reason ??
                "Leitura passiva no navegador atual (não força sincronização nem mutações)."}
            </p>
          </div>

          <div className="pt-1 flex items-center justify-between gap-2 text-[11px] font-sans">
            <span className="text-[#9CA3AF]">
              Métricas de acervo e catálogo permanecem na tela legada de saúde:
            </span>
            <Link
              to="/admin/health"
              className="inline-flex items-center gap-1 font-mono text-xs text-[#06B6D4] hover:underline shrink-0"
            >
              <span>/admin/health</span>
              <ExternalLink className="size-3" />
            </Link>
          </div>
        </div>
      </section>

      {/* Limites Vercel Hobby & Não Verificados */}
      <section className="rounded-xl border border-[#262B36] bg-[#111318] p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-[#F59E0B]" />
          <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#E5E7EB]">
            Arquitetura Vercel Hobby &amp; Métricas Não Disponíveis em Runtime
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-3.5 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-white font-sans">
                Configuração Serverless (vercel.json)
              </span>
              <ModuleStatusBadge status="PARCIAL" showDot={false} />
            </div>
            <p className="text-[11px] text-[#9CA3AF] font-sans leading-relaxed">
              Cron jobs desativados no plano Hobby (<code className="font-mono text-[#E5E7EB]">crons: []</code>); cache de instância Node.js em memória é efêmero e não compartilhado entre invocações paralelas.
            </p>
          </div>
          <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-3.5 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-white font-sans">
                CPU Global, Banda CDN &amp; Conexões Ativas no Neon
              </span>
              <ModuleStatusBadge status="NÃO VERIFICADO" showDot={false} />
            </div>
            <p className="text-[11px] text-[#9CA3AF] font-sans leading-relaxed">
              Não existem APIs internas no Hikari expondo uso histórico de CPU, largura de banda da Vercel ou contagem global de conexões ativas no Neon PostgreSQL.
            </p>
          </div>
        </div>
      </section>

      <div className="rounded-xl border border-[#262B36] bg-[#111318] px-4 py-3 flex items-start gap-2.5">
        <ShieldAlert className="size-4 text-[#6B7280] shrink-0 mt-0.5" />
        <p className="text-[11px] text-[#9CA3AF] font-sans leading-relaxed flex-1">
          Este painel respeita execução exclusiva sob demanda, sem polling em segundo plano, sem testes de carga e sem duplicar sondas já carregadas pela Visão Geral.
        </p>
        <Info className="size-4 text-[#06B6D4] shrink-0 mt-0.5" />
      </div>
    </div>
  );
}
