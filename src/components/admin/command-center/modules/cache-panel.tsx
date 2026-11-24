import React, { useMemo } from "react";
import {
  AlertTriangle,
  Database,
  Globe,
  HardDrive,
  Info,
  Layers,
  RefreshCw,
  Server,
  ShieldAlert,
} from "lucide-react";
import type { CommandCenterDiagnosticsReport } from "@/lib/admin-diagnostics.functions";
import {
  formatStorageBytes,
  type BrowserStorageAuditReport,
} from "@/lib/browser-storage-diagnostics";
import { buildBrowserCacheDiagnosticsReport } from "@/lib/browser-cache-diagnostics";
import {
  ModuleStatusBadge,
  type CommandCenterModuleStatus,
} from "./module-status-badge";

interface CachePanelProps {
  storageAudit: BrowserStorageAuditReport | null;
  isStorageLoading: boolean;
  onRefreshStorage: () => void;
  diagnostics: CommandCenterDiagnosticsReport | null;
  isDiagnosticsLoading: boolean;
  diagnosticsError: string | null;
  onRefreshDiagnostics: () => void;
}

export function CachePanel({
  storageAudit,
  isStorageLoading,
  onRefreshStorage,
  diagnostics,
  isDiagnosticsLoading,
  diagnosticsError,
  onRefreshDiagnostics,
}: CachePanelProps) {
  const report = useMemo(
    () => buildBrowserCacheDiagnosticsReport(storageAudit),
    [storageAudit],
  );

  const redisStatus: CommandCenterModuleStatus = diagnostics
    ? diagnostics.redis.status
    : diagnosticsError
      ? "NÃO VERIFICADO"
      : "NÃO VERIFICADO";

  const cacheStorageStatus: CommandCenterModuleStatus = !storageAudit
    ? "NÃO VERIFICADO"
    : storageAudit.cacheStorage.status === "available"
      ? "SAUDÁVEL"
      : storageAudit.cacheStorage.status === "blocked"
        ? "ATENÇÃO"
        : "INDISPONÍVEL";

  const serviceWorkerStatus: CommandCenterModuleStatus = !storageAudit
    ? "NÃO VERIFICADO"
    : storageAudit.serviceWorkers.status === "available"
      ? "SAUDÁVEL"
      : storageAudit.serviceWorkers.status === "blocked"
        ? "ATENÇÃO"
        : "INDISPONÍVEL";

  const redisTimestamp = diagnostics?.checkedAt
    ? new Date(diagnostics.checkedAt).toLocaleTimeString("pt-BR")
    : "--:--:--";

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Cabeçalho */}
      <div className="rounded-xl border border-[#262B36] bg-[#111318] p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="size-9 shrink-0 rounded-lg bg-[#8B5CF6]/15 border border-[#8B5CF6]/30 flex items-center justify-center text-[#8B5CF6]">
            <Database className="size-5" />
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-bold text-white font-sans tracking-tight">
                Camadas de Cache do Hikari
              </h2>
              <span className="px-2 py-0.5 rounded text-[9px] font-mono font-semibold bg-[#181B22] text-[#8B5CF6] border border-[#8B5CF6]/30">
                SERVIDOR + CLIENT
              </span>
            </div>
            <p className="text-xs text-[#9CA3AF] font-sans leading-relaxed">
              Separação real entre armazenamento/cache local do navegador atual, mapas privados em memória, conectividade do Redis compartilhado e políticas HTTP/CDN. Métricas globais não coletadas permanecem explicitamente como NÃO VERIFICADO.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <span className="px-2.5 py-2 rounded-lg bg-[#181B22] border border-[#262B36] text-[11px] font-mono tabular-nums text-[#9CA3AF]">
            Local: {report.measuredAt} • Redis: {redisTimestamp}
          </span>
          <button
            type="button"
            onClick={onRefreshStorage}
            disabled={isStorageLoading}
            className="min-h-[38px] flex items-center gap-2 px-3 py-2 rounded-lg bg-[#181B22] hover:bg-[#212630] disabled:opacity-60 border border-[#262B36] text-xs font-sans font-medium text-white transition-colors cursor-pointer"
          >
            <RefreshCw
              className={`size-3.5 text-[#06B6D4] ${isStorageLoading ? "animate-spin" : ""}`}
            />
            <span>Atualizar Local</span>
          </button>
          <button
            type="button"
            onClick={onRefreshDiagnostics}
            disabled={isDiagnosticsLoading}
            className="min-h-[38px] flex items-center gap-2 px-3 py-2 rounded-lg bg-[#181B22] hover:bg-[#212630] disabled:opacity-60 border border-[#262B36] text-xs font-sans font-medium text-white transition-colors cursor-pointer"
          >
            <RefreshCw
              className={`size-3.5 text-[#8B5CF6] ${isDiagnosticsLoading ? "animate-spin" : ""}`}
            />
            <span>Sondar Redis</span>
          </button>
        </div>
      </div>

      {/* A. Cache Local do Navegador */}
      <section className="rounded-xl border border-[#262B36] bg-[#111318] p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <HardDrive className="size-4 text-[#06B6D4]" />
            <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#E5E7EB]">
              A. Cache Local do Navegador (Dispositivo Atual)
            </h3>
          </div>
          <span className="text-[10px] font-mono text-[#6B7280]">
            Reaproveita auditoria de armazenamento sem nova leitura redundante
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-3.5 space-y-2 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-white font-sans">
                IndexedDB (&quot;hikari&quot;)
              </span>
              <ModuleStatusBadge status={report.localCatalogIndexedDb.status} />
            </div>
            <div className="text-sm font-mono font-bold text-[#06B6D4]">
              {report.localCatalogIndexedDb.present
                ? `v${report.localCatalogIndexedDb.version ?? "?"} ativo`
                : "Não inicializado"}
            </div>
            <p className="text-[11px] text-[#9CA3AF] font-sans leading-relaxed">
              {report.localCatalogIndexedDb.detail}
            </p>
          </div>

          <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-3.5 space-y-2 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-white font-sans">
                Cache Storage API
              </span>
              <ModuleStatusBadge status={cacheStorageStatus} />
            </div>
            <div className="text-sm font-mono font-bold text-white">
              {storageAudit?.cacheStorage.available
                ? `${storageAudit.cacheStorage.cacheCount} bucket(s) • ${formatStorageBytes(
                    storageAudit.cacheStorage.items.reduce(
                      (acc, c) => acc + c.estimatedBytes,
                      0,
                    ),
                  )}`
                : "--"}
            </div>
            <p className="text-[11px] text-[#9CA3AF] font-sans leading-relaxed">
              {storageAudit?.cacheStorage.available
                ? storageAudit.cacheStorage.cacheCount > 0
                  ? `${storageAudit.cacheStorage.items.reduce((acc, c) => acc + c.requestCount, 0)} resposta(s) armazenada(s) no Cache Storage.`
                  : "API disponível, porém sem buckets gravados nesta origem."
                : storageAudit?.cacheStorage.reason ?? "Aguardando auditoria local."}
            </p>
          </div>

          <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-3.5 space-y-2 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-white font-sans">
                Service Workers
              </span>
              <ModuleStatusBadge status={serviceWorkerStatus} />
            </div>
            <div className="text-sm font-mono font-bold text-white">
              {storageAudit?.serviceWorkers.available
                ? `${storageAudit.serviceWorkers.registrationCount} registro(s)`
                : "--"}
            </div>
            <p className="text-[11px] text-[#9CA3AF] font-sans leading-relaxed">
              {storageAudit?.serviceWorkers.available
                ? storageAudit.serviceWorkers.registrationCount === 0
                  ? "Nenhum Service Worker ativo interceptando cache offline nesta origem."
                  : "Service Worker registrado na origem (consulte Armazenamento para escopo)."
                : storageAudit?.serviceWorkers.reason ?? "Aguardando auditoria local."}
            </p>
          </div>
        </div>

        {/* Chaves conhecidas do localStorage */}
        <div className="space-y-2 pt-2 border-t border-[#262B36]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#9CA3AF]">
              Chaves de Cache &amp; Estado Conhecidas no localStorage (Somente Presença e Tamanho)
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {report.localKeyPresence.map((item) => (
              <div
                key={item.key}
                className="rounded-lg border border-[#262B36] bg-[#181B22] p-3 space-y-1 min-w-0"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-[11px] font-semibold text-white break-all min-w-0">
                    {item.key}
                  </span>
                  <span
                    className={`font-mono text-[11px] font-bold shrink-0 ${
                      item.present ? "text-[#10B981]" : "text-[#6B7280]"
                    }`}
                  >
                    {item.formattedSize}
                  </span>
                </div>
                <p className="text-[11px] text-[#9CA3AF] font-sans leading-snug">
                  {item.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* B. Redis Compartilhado (Upstash) */}
      <section className="rounded-xl border border-[#262B36] bg-[#111318] p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Server className="size-4 text-[#8B5CF6] shrink-0" />
            <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#E5E7EB]">
              B. Redis Compartilhado (Upstash Redis)
            </h3>
          </div>
          <ModuleStatusBadge status={redisStatus} />
        </div>

        <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="text-xs font-semibold text-white font-sans">
              {diagnostics
                ? diagnostics.redis.summary
                : diagnosticsError
                  ? "Falha ao consultar sonda administrativa"
                  : "Aguardando resultado da sonda Redis"}
            </div>
            <p className="text-[11px] text-[#9CA3AF] font-sans leading-relaxed">
              {diagnostics
                ? diagnostics.redis.detail
                : diagnosticsError ?? "Use 'Sondar Redis' para executar apenas um PING sob demanda."}
            </p>
          </div>
          <div className="shrink-0 text-left sm:text-right">
            <span className="text-[10px] font-mono uppercase text-[#6B7280] block">
              Latência PING
            </span>
            <span className="text-lg font-bold font-mono tabular-nums text-[#06B6D4]">
              {diagnostics?.redis.latencyMs !== null &&
              diagnostics?.redis.latencyMs !== undefined
                ? `${diagnostics.redis.latencyMs} ms`
                : "--"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {report.serverMemoryAndRedisSpecs.map((spec) => (
            <div
              key={spec.id}
              className="rounded-lg border border-[#262B36] bg-[#181B22] p-3 space-y-1.5 min-w-0"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-semibold text-white font-sans">
                  {spec.name}
                </span>
                <ModuleStatusBadge status="NÃO VERIFICADO" showDot={false} />
              </div>
              <div className="text-[10px] font-mono text-[#06B6D4] break-all">
                {spec.keyOrRoute}
              </div>
              <div className="text-[11px] text-[#E5E7EB] font-sans">
                {spec.ttlOrPolicy}
              </div>
              <div className="text-[10px] font-mono text-[#9CA3AF]">
                Invalidação: {spec.invalidationMechanism}
              </div>
              <div className="text-[10px] font-mono text-[#6B7280]">
                {spec.runtimeVisibility}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* C. Cache em Memória (Cliente & Servidor) + D. HTTP/CDN */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-[#262B36] bg-[#111318] p-4 sm:p-5 space-y-3 min-w-0">
          <div className="flex items-center gap-2">
            <Layers className="size-4 text-[#06B6D4]" />
            <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#E5E7EB]">
              C. Caches em Memória da Aplicação (Especificação)
            </h3>
          </div>
          <div className="space-y-2.5">
            {report.inMemoryClientCaches.map((spec) => (
              <div
                key={spec.id}
                className="rounded-lg border border-[#262B36] bg-[#181B22] p-3 space-y-1 min-w-0"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-semibold text-white font-sans">
                    {spec.name}
                  </span>
                  <ModuleStatusBadge status="NÃO VERIFICADO" showDot={false} />
                </div>
                <div className="text-[10px] font-mono text-[#8B5CF6] break-all">
                  {spec.keyOrRoute}
                </div>
                <p className="text-[11px] text-[#9CA3AF] font-sans">
                  {spec.ttlOrPolicy} • Invalidação: {spec.invalidationMechanism}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-[#262B36] bg-[#111318] p-4 sm:p-5 space-y-3 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Globe className="size-4 text-[#10B981]" />
              <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#E5E7EB]">
                D. HTTP / CDN &amp; Evidência Passiva na Aba
              </h3>
            </div>
            <ModuleStatusBadge status={report.passiveHttpEvidence.status} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-2.5">
              <span className="text-[10px] font-mono uppercase text-[#6B7280] block">
                Mesma Origem
              </span>
              <span className="text-sm font-bold font-mono tabular-nums text-white">
                {report.passiveHttpEvidence.sameOriginCount}
              </span>
            </div>
            <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-2.5">
              <span className="text-[10px] font-mono uppercase text-[#6B7280] block">
                Transfer = 0 B
              </span>
              <span className="text-sm font-bold font-mono tabular-nums text-[#10B981]">
                {report.passiveHttpEvidence.zeroTransferCandidateCount}
              </span>
            </div>
            <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-2.5">
              <span className="text-[10px] font-mono uppercase text-[#6B7280] block">
                Rede (&gt; 0 B)
              </span>
              <span className="text-sm font-bold font-mono tabular-nums text-[#06B6D4]">
                {report.passiveHttpEvidence.networkTransferCount}
              </span>
            </div>
            <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-2.5">
              <span className="text-[10px] font-mono uppercase text-[#6B7280] block">
                Cross-Origin Opaco
              </span>
              <span className="text-sm font-bold font-mono tabular-nums text-[#F59E0B]">
                {report.passiveHttpEvidence.crossOriginRestrictedCount}
              </span>
            </div>
          </div>

          <p className="text-[11px] text-[#9CA3AF] font-sans leading-relaxed">
            {report.passiveHttpEvidence.note}
          </p>

          <div className="space-y-2 pt-2 border-t border-[#262B36]">
            {report.httpCdnPolicySpecs.map((spec) => (
              <div
                key={spec.id}
                className="rounded-lg border border-[#262B36] bg-[#181B22] p-2.5 space-y-1 min-w-0"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-semibold text-white font-sans">
                    {spec.name}
                  </span>
                  <span className="text-[10px] font-mono text-[#6B7280] shrink-0">
                    Política
                  </span>
                </div>
                <div className="text-[10px] font-mono text-[#06B6D4] break-all">
                  {spec.keyOrRoute}
                </div>
                <div className="text-[11px] text-[#9CA3AF] font-mono break-words">
                  {spec.ttlOrPolicy}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* E. Métricas explicitamente não verificadas */}
      <section className="rounded-xl border border-[#262B36] bg-[#111318] p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-[#F59E0B]" />
          <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#E5E7EB]">
            E. Métricas Não Verificadas pela Arquitetura Atual
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {report.unverifiableMetrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-lg border border-[#262B36] bg-[#181B22] p-3.5 space-y-1.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-white font-sans">
                  {metric.label}
                </span>
                <ModuleStatusBadge status="NÃO VERIFICADO" showDot={false} />
              </div>
              <p className="text-[11px] text-[#9CA3AF] font-sans leading-relaxed">
                {metric.reason}
              </p>
            </div>
          ))}
        </div>
      </section>

      <div className="rounded-xl border border-[#262B36] bg-[#111318] px-4 py-3 flex items-start gap-2.5">
        <ShieldAlert className="size-4 text-[#6B7280] shrink-0 mt-0.5" />
        <p className="text-[11px] text-[#9CA3AF] font-sans leading-relaxed flex-1">
          Este painel não executa <code className="font-mono text-[#E5E7EB]">KEYS</code>, <code className="font-mono text-[#E5E7EB]">SCAN</code>, <code className="font-mono text-[#E5E7EB]">DBSIZE</code>, expurgo de cache nem requisições extras de borda.
        </p>
        <Info className="size-4 text-[#06B6D4] shrink-0 mt-0.5" />
      </div>
    </div>
  );
}
