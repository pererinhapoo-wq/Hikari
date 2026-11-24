import React, { useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Clock,
  Cpu,
  Film,
  Gauge,
  Globe,
  Info,
  Layers,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import {
  createNonBrowserPerformanceSnapshot,
  createPerformanceMonitor,
  formatPerformanceBytes,
  formatPerformanceMs,
  RESTRICTED_RESOURCE_SIZE_TEXT,
  type BrowserPerformanceSnapshot,
  type CoreWebVitalMetric,
  type CoreWebVitalRating,
  type MeasurementSource,
  type PerformanceCompleteness,
  type PerformanceMonitorHandle,
} from "@/lib/browser-performance-diagnostics";

const COMPLETENESS_STYLES: Record<PerformanceCompleteness, string> = {
  COMPLETO: "bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30",
  PARCIAL: "bg-[#06B6D4]/15 text-[#06B6D4] border-[#06B6D4]/30",
  "NÃO VERIFICADO": "bg-[#181B22] text-[#9CA3AF] border-[#262B36]",
  INDISPONÍVEL: "bg-[#94A3B8]/15 text-[#94A3B8] border-[#94A3B8]/30",
};

const RATING_STYLES: Record<CoreWebVitalRating, string> = {
  SAUDÁVEL: "bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30",
  ATENÇÃO: "bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/30",
  CRÍTICO: "bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/30",
};

const SOURCE_LABELS: Record<MeasurementSource, string> = {
  buffer: "Origem: Buffer inicial",
  tempo_real: "Origem: Tempo real",
  hibrido: "Origem: Buffer + Tempo real",
  indisponivel: "Origem: Indisponível",
};

function CompletenessBadge({ state }: { state: PerformanceCompleteness }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center px-2 py-0.5 rounded text-[10px] font-mono font-medium border ${COMPLETENESS_STYLES[state]}`}
    >
      {state}
    </span>
  );
}

function RatingBadge({ rating }: { rating: CoreWebVitalRating | null }) {
  if (!rating) return null;
  return (
    <span
      className={`inline-flex shrink-0 items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${RATING_STYLES[rating]}`}
    >
      {rating}
    </span>
  );
}

interface VitalCardProps {
  code: string;
  title: string;
  thresholdHint: string;
  metric: CoreWebVitalMetric<number>;
  extraMeta?: string;
}

function VitalCard({
  code,
  title,
  thresholdHint,
  metric,
  extraMeta,
}: VitalCardProps) {
  return (
    <div className="rounded-xl border border-[#262B36] bg-[#111318] p-4 flex flex-col justify-between gap-3 min-w-0">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <span className="text-[11px] font-mono font-bold text-[#8B5CF6] tracking-wider">
            {code}
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            <RatingBadge rating={metric.rating} />
            <CompletenessBadge state={metric.completeness} />
          </div>
        </div>

        <div className="text-xs font-sans font-medium text-[#E5E7EB]">
          {title}
        </div>

        <div className="min-h-[2.25rem] flex items-baseline">
          <span className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-white tracking-tight">
            {metric.displayValue}
          </span>
        </div>
      </div>

      <div className="space-y-2 pt-2 border-t border-[#262B36]/80">
        <div className="flex flex-wrap items-center justify-between gap-1 text-[10px] font-mono text-[#06B6D4]">
          <span>{SOURCE_LABELS[metric.source]}</span>
          <span>{thresholdHint}</span>
        </div>
        {extraMeta && (
          <div className="text-[10px] font-mono text-[#9CA3AF]">
            {extraMeta}
          </div>
        )}
        <p className="text-[11px] text-[#9CA3AF] font-sans leading-relaxed">
          {metric.note}
        </p>
      </div>
    </div>
  );
}

export function PerformancePanel() {
  const [snapshot, setSnapshot] = useState<BrowserPerformanceSnapshot>(() =>
    createNonBrowserPerformanceSnapshot(),
  );
  const monitorRef = useRef<PerformanceMonitorHandle | null>(null);

  useEffect(() => {
    let active = true;
    const monitor = createPerformanceMonitor((nextSnapshot) => {
      if (!active) return;
      setSnapshot(nextSnapshot);
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

  const initiatorEntries = Object.entries(snapshot.resources.page.byInitiatorType).sort(
    (a, b) => b[1] - a[1],
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Cabeçalho do módulo */}
      <div className="rounded-xl border border-[#262B36] bg-[#111318] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="size-9 shrink-0 rounded-lg bg-[#8B5CF6]/15 border border-[#8B5CF6]/30 flex items-center justify-center text-[#8B5CF6]">
            <Gauge className="size-5" />
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-bold text-white font-sans tracking-tight">
                Desempenho e Core Web Vitals
              </h2>
              <span className="px-2 py-0.5 rounded text-[9px] font-mono font-semibold bg-[#181B22] text-[#06B6D4] border border-[#06B6D4]/30">
                CLIENT-ONLY
              </span>
            </div>
            <p className="text-xs text-[#9CA3AF] font-sans leading-relaxed">
              Leitura exclusiva do navegador e da sessão atual do administrador utilizando APIs nativas de desempenho. Não representa histórico global de visitantes do Hikari.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <span className="px-2.5 py-2 rounded-lg bg-[#181B22] border border-[#262B36] text-[11px] font-mono tabular-nums text-[#9CA3AF]">
            Leitura: {snapshot.measuredAt || "--:--:--"}
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

      {/* Core Web Vitals */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Activity className="size-4 text-[#06B6D4]" />
            <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#E5E7EB]">
              Core Web Vitals &amp; Sinais de Pintura
            </h3>
          </div>
          <span className="text-[10px] font-mono text-[#6B7280]">
            Limites oficiais Google aplicados somente a LCP, INP e CLS
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
          <VitalCard
            code="LCP"
            title="Largest Contentful Paint"
            thresholdHint="Bom ≤ 2,5 s"
            metric={snapshot.lcp}
          />
          <VitalCard
            code="INP"
            title="Interaction to Next Paint"
            thresholdHint="Bom ≤ 200 ms"
            metric={snapshot.inp}
            extraMeta={
              snapshot.inp.completeness !== "INDISPONÍVEL"
                ? `Interações capturadas: ${snapshot.inp.observedInteractions}${
                    snapshot.inp.reportedInteractionCount !== null
                      ? ` • Total sessão: ${snapshot.inp.reportedInteractionCount}`
                      : ""
                  }`
                : undefined
            }
          />
          <VitalCard
            code="CLS"
            title="Cumulative Layout Shift"
            thresholdHint="Bom ≤ 0,100"
            metric={snapshot.cls}
            extraMeta={
              snapshot.cls.completeness !== "INDISPONÍVEL"
                ? `Janelas: ${snapshot.cls.windowCount} • Ignoradas (input): ${snapshot.cls.ignoredRecentInputCount}`
                : undefined
            }
          />
          <VitalCard
            code="FCP"
            title="First Contentful Paint"
            thresholdHint="Informativo"
            metric={snapshot.fcp}
          />
          <VitalCard
            code="TTFB"
            title="Time to First Byte (Doc Inicial)"
            thresholdHint="Informativo"
            metric={snapshot.ttfb}
          />
        </div>
      </section>

      {/* Navegação e Runtime Cliente */}
      <section className="rounded-xl border border-[#262B36] bg-[#111318] p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-[#8B5CF6]" />
            <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#E5E7EB]">
              Navegação Inicial, Long Tasks &amp; Memória JS
            </h3>
          </div>
          <span className="text-[10px] font-mono text-[#6B7280]">
            Escopo: documento HTML inicial (não mede rotas SPA)
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-3.5 space-y-1.5 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-mono uppercase text-[#9CA3AF]">
                Tempo de Sessão
              </span>
              <CompletenessBadge
                state={
                  snapshot.navigation.elapsedSinceNavMs !== null
                    ? "COMPLETO"
                    : "INDISPONÍVEL"
                }
              />
            </div>
            <div className="text-lg font-bold font-mono tabular-nums text-white">
              {formatPerformanceMs(snapshot.navigation.elapsedSinceNavMs)}
            </div>
            <p className="text-[11px] text-[#9CA3AF] font-sans">
              Decorrido desde timeOrigin (performance.now)
            </p>
          </div>

          <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-3.5 space-y-1.5 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-mono uppercase text-[#9CA3AF]">
                DOMContentLoaded
              </span>
              <CompletenessBadge
                state={snapshot.navigation.domContentLoadedCompleteness}
              />
            </div>
            <div className="text-lg font-bold font-mono tabular-nums text-white">
              {formatPerformanceMs(snapshot.navigation.domContentLoadedMs)}
            </div>
            <p className="text-[11px] text-[#9CA3AF] font-sans">
              Conclusão do parsing HTML inicial
            </p>
          </div>

          <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-3.5 space-y-1.5 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-mono uppercase text-[#9CA3AF]">
                Load Event
              </span>
              <CompletenessBadge
                state={snapshot.navigation.loadEventCompleteness}
              />
            </div>
            <div className="text-lg font-bold font-mono tabular-nums text-white">
              {formatPerformanceMs(snapshot.navigation.loadEventMs)}
            </div>
            <p className="text-[11px] text-[#9CA3AF] font-sans">
              Término do evento load do documento
            </p>
          </div>

          <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-3.5 space-y-1.5 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-mono uppercase text-[#9CA3AF]">
                Long Tasks (&gt;50ms)
              </span>
              <CompletenessBadge state={snapshot.longTasks.completeness} />
            </div>
            <div className="text-lg font-bold font-mono tabular-nums text-white">
              {snapshot.longTasks.supported
                ? `${snapshot.longTasks.count}`
                : "--"}
            </div>
            <p className="text-[11px] text-[#9CA3AF] font-sans leading-snug">
              {snapshot.longTasks.supported
                ? `Total: ${formatPerformanceMs(snapshot.longTasks.totalDurationMs)} • Máx: ${formatPerformanceMs(snapshot.longTasks.maxDurationMs)} (Buf: ${snapshot.longTasks.bufferCount} / Live: ${snapshot.longTasks.liveCount})`
                : snapshot.longTasks.note}
            </p>
          </div>

          <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-3.5 space-y-1.5 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-mono uppercase text-[#9CA3AF]">
                Memória JS (Heap)
              </span>
              <CompletenessBadge state={snapshot.memory.completeness} />
            </div>
            <div className="text-lg font-bold font-mono tabular-nums text-white">
              {snapshot.memory.supported
                ? formatPerformanceBytes(snapshot.memory.usedHeapBytes)
                : "--"}
            </div>
            <p className="text-[11px] text-[#9CA3AF] font-sans leading-snug">
              {snapshot.memory.supported
                ? `Alocado: ${formatPerformanceBytes(snapshot.memory.totalHeapBytes)}${
                    snapshot.memory.heapLimitBytes
                      ? ` / Limite: ${formatPerformanceBytes(snapshot.memory.heapLimitBytes)}`
                      : ""
                  }`
                : snapshot.memory.note}
            </p>
          </div>
        </div>
      </section>

      {/* Recursos da Aplicação vs Mídia/HLS */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recursos da Página */}
        <div className="rounded-xl border border-[#262B36] bg-[#111318] p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Globe className="size-4 text-[#06B6D4] shrink-0" />
              <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#E5E7EB]">
                Recursos da Aplicação ({snapshot.resources.page.count})
              </h3>
            </div>
            <CompletenessBadge state={snapshot.resources.completeness} />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-3">
              <span className="text-[10px] font-mono uppercase text-[#6B7280] block">
                Bytes Conhecidos
              </span>
              <span className="text-sm font-bold font-mono tabular-nums text-white mt-0.5 block">
                {formatPerformanceBytes(snapshot.resources.page.knownBytes)}
              </span>
            </div>
            <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-3">
              <span className="text-[10px] font-mono uppercase text-[#6B7280] block">
                Tamanho Não Exposto
              </span>
              <span className="text-sm font-bold font-mono tabular-nums text-[#F59E0B] mt-0.5 block">
                {snapshot.resources.page.restrictedSizeCount} entrada(s)
              </span>
            </div>
          </div>

          {initiatorEntries.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#9CA3AF] block">
                Distribuição por initiatorType
              </span>
              <div className="flex flex-wrap gap-1.5">
                {initiatorEntries.map(([type, count]) => (
                  <span
                    key={type}
                    className="px-2 py-1 rounded bg-[#181B22] border border-[#262B36] text-[10px] font-mono text-[#E5E7EB]"
                  >
                    {type}: <strong className="text-[#06B6D4]">{count}</strong>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Top recursos mais lentos sanitizados */}
          <div className="space-y-2 pt-2 border-t border-[#262B36]">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#9CA3AF] block">
              Recursos Mais Lentos da Página (URLs Sanitizadas)
            </span>

            {snapshot.resources.page.slowestResources.length === 0 ? (
              <p className="text-xs text-[#9CA3AF] font-sans">
                Nenhum recurso de página registrado no buffer atual.
              </p>
            ) : (
              <div className="space-y-2">
                {snapshot.resources.page.slowestResources.map((res, idx) => (
                  <div
                    key={`${res.sanitizedUrl}-${idx}`}
                    className="rounded-lg border border-[#262B36] bg-[#181B22] p-2.5 space-y-1 min-w-0"
                  >
                    <div className="flex items-start justify-between gap-2 text-xs">
                      <span className="font-mono text-white break-all min-w-0">
                        {res.sanitizedUrl}
                      </span>
                      <span className="font-mono font-bold tabular-nums text-[#8B5CF6] shrink-0">
                        {formatPerformanceMs(res.durationMs)}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-[#9CA3AF]">
                      <span className="px-1.5 py-0.5 rounded bg-[#111318] border border-[#262B36]">
                        {res.initiatorType}
                      </span>
                      <span>
                        {res.sizeRestricted
                          ? "Tamanho não exposto"
                          : res.knownBytes !== null
                            ? formatPerformanceBytes(res.knownBytes)
                            : "--"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Mídia / Streaming HLS Agregado + Limitações */}
        <div className="space-y-4">
          <div className="rounded-xl border border-[#262B36] bg-[#111318] p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Film className="size-4 text-[#8B5CF6] shrink-0" />
                <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#E5E7EB]">
                  Mídia / Streaming HLS (Agregado)
                </h3>
              </div>
              <CompletenessBadge state={snapshot.resources.completeness} />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-3">
                <span className="text-[10px] font-mono uppercase text-[#6B7280] block">
                  Requisições
                </span>
                <span className="text-sm font-bold font-mono tabular-nums text-white mt-0.5 block">
                  {snapshot.resources.media.count}
                </span>
              </div>
              <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-3">
                <span className="text-[10px] font-mono uppercase text-[#6B7280] block">
                  Bytes Conhecidos
                </span>
                <span className="text-sm font-bold font-mono tabular-nums text-white mt-0.5 block">
                  {formatPerformanceBytes(snapshot.resources.media.knownBytes)}
                </span>
              </div>
              <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-3">
                <span className="text-[10px] font-mono uppercase text-[#6B7280] block">
                  Duração Média
                </span>
                <span className="text-sm font-bold font-mono tabular-nums text-[#06B6D4] mt-0.5 block">
                  {formatPerformanceMs(snapshot.resources.media.avgDurationMs)}
                </span>
              </div>
              <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-3">
                <span className="text-[10px] font-mono uppercase text-[#6B7280] block">
                  Duração Máxima
                </span>
                <span className="text-sm font-bold font-mono tabular-nums text-[#8B5CF6] mt-0.5 block">
                  {formatPerformanceMs(snapshot.resources.media.maxDurationMs)}
                </span>
              </div>
            </div>

            <div className="rounded-lg border border-[#262B36] bg-[#181B22] px-3 py-2.5 text-[11px] text-[#9CA3AF] font-sans space-y-1">
              <div>
                Classificação: <span className="text-[#E5E7EB] font-mono">{snapshot.resources.media.classificationLabel}</span>
              </div>
              <div>
                Entradas com detalhes restritos: <span className="font-mono text-[#F59E0B]">{snapshot.resources.media.restrictedSizeCount}</span>
              </div>
              <p className="text-[11px] text-[#6B7280] pt-1">
                Segmentos de mídia são agregados aqui para não dominar a lista de recursos lentos da página.
              </p>
            </div>

            {(snapshot.resources.page.restrictedSizeCount > 0 ||
              snapshot.resources.media.restrictedSizeCount > 0) && (
              <div className="rounded-lg border border-[#F59E0B]/30 bg-[#181B22] px-3 py-2.5 flex items-start gap-2">
                <Info className="size-3.5 text-[#F59E0B] shrink-0 mt-0.5" />
                <p className="text-[11px] text-[#9CA3AF] font-sans leading-relaxed">
                  {RESTRICTED_RESOURCE_SIZE_TEXT}
                </p>
              </div>
            )}
          </div>

          {/* Transparência e Limitações */}
          <div className="rounded-xl border border-[#262B36] bg-[#111318] p-4 sm:p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Layers className="size-4 text-[#06B6D4]" />
              <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#E5E7EB]">
                Transparência &amp; Limitações da Coleta
              </h3>
            </div>

            <div className="space-y-2">
              {snapshot.limitations.map((limitation, idx) => (
                <div
                  key={idx}
                  className="rounded-lg border border-[#262B36] bg-[#181B22] px-3 py-2 flex items-start gap-2"
                >
                  <AlertTriangle className="size-3.5 text-[#F59E0B] shrink-0 mt-0.5" />
                  <p className="text-[11px] text-[#9CA3AF] font-sans leading-relaxed">
                    {limitation}
                  </p>
                </div>
              ))}
            </div>

            {snapshot.supportedEntryTypes.length > 0 && (
              <div className="pt-2 border-t border-[#262B36] space-y-1.5">
                <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase text-[#6B7280]">
                  <Cpu className="size-3" />
                  <span>supportedEntryTypes detectados neste navegador</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {snapshot.supportedEntryTypes.map((type) => (
                    <span
                      key={type}
                      className="px-1.5 py-0.5 rounded bg-[#181B22] border border-[#262B36] text-[10px] font-mono text-[#9CA3AF]"
                    >
                      {type}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Nota final de escopo */}
      <div className="rounded-xl border border-[#262B36] bg-[#111318] px-4 py-3 flex items-start gap-2.5">
        <ShieldAlert className="size-4 text-[#6B7280] shrink-0 mt-0.5" />
        <p className="text-[11px] text-[#9CA3AF] font-sans leading-relaxed">
          Os observadores de desempenho permanecem ativos apenas enquanto este módulo está aberto e são desconectados ao navegar para outro módulo. Nenhuma métrica é enviada ao servidor ou persistida externamente.
        </p>
      </div>
    </div>
  );
}
