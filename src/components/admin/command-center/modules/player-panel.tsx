import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Film,
  Info,
  PlaySquare,
  RefreshCw,
  Settings2,
  ShieldAlert,
  Sliders,
} from "lucide-react";
import {
  collectBrowserPlayerDiagnostics,
  createNonBrowserPlayerDiagnosticsReport,
  type BrowserPlayerDiagnosticsReport,
} from "@/lib/browser-player-diagnostics";
import { ModuleStatusBadge } from "./module-status-badge";

export function PlayerPanel() {
  const [report, setReport] = useState<BrowserPlayerDiagnosticsReport>(() =>
    createNonBrowserPlayerDiagnosticsReport(),
  );
  const [isLoading, setIsLoading] = useState(false);

  const isMountedRef = useRef(true);
  const inFlightRef = useRef(false);

  const runCheck = useCallback(async (forceRefresh = false) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setIsLoading(true);
    try {
      const next = await collectBrowserPlayerDiagnostics({ forceRefresh });
      if (!isMountedRef.current) return;
      setReport(next);
    } finally {
      inFlightRef.current = false;
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    void runCheck(false);
    return () => {
      isMountedRef.current = false;
    };
  }, [runCheck]);

  const engineList = [
    report.engines.nativeHls,
    report.engines.hlsJs,
    report.engines.mediaSource,
    report.engines.htmlVideo,
  ];

  const featureList = [
    report.features.pictureInPicture,
    report.features.fullscreen,
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Cabeçalho */}
      <div className="rounded-xl border border-[#262B36] bg-[#111318] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="size-9 shrink-0 rounded-lg bg-[#8B5CF6]/15 border border-[#8B5CF6]/30 flex items-center justify-center text-[#8B5CF6]">
            <PlaySquare className="size-5" />
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-bold text-white font-sans tracking-tight">
                Diagnóstico Informativo do Player
              </h2>
              <span className="px-2 py-0.5 rounded text-[9px] font-mono font-semibold bg-[#181B22] text-[#06B6D4] border border-[#06B6D4]/30">
                CLIENT-ONLY
              </span>
            </div>
            <p className="text-xs text-[#9CA3AF] font-sans leading-relaxed">
              Verificação somente leitura da aptidão de reprodução HLS, codecs e flags do dispositivo atual. Não instancia o player oficial, não carrega streams e não altera a reprodução de vídeo.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <span className="px-2.5 py-2 rounded-lg bg-[#181B22] border border-[#262B36] text-[11px] font-mono tabular-nums text-[#9CA3AF]">
            Verificado: {report.measuredAt}
          </span>
          <button
            type="button"
            onClick={() => void runCheck(true)}
            disabled={isLoading}
            className="min-h-[38px] flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#181B22] hover:bg-[#212630] disabled:opacity-60 border border-[#262B36] text-xs font-sans font-medium text-white transition-colors cursor-pointer"
          >
            <RefreshCw
              className={`size-3.5 text-[#06B6D4] ${isLoading ? "animate-spin" : ""}`}
            />
            <span>{isLoading ? "Verificando..." : "Reexecutar Verificação"}</span>
          </button>
        </div>
      </div>

      {/* Caminho de reprodução + flags de ambiente */}
      <section className="rounded-xl border border-[#262B36] bg-[#111318] p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-[#10B981]" />
            <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#E5E7EB]">
              Prontidão de Streaming HLS no Dispositivo
            </h3>
          </div>
          <ModuleStatusBadge status={report.overallStatus} />
        </div>

        <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-3.5 space-y-2">
          <p className="text-xs text-white font-sans font-medium leading-relaxed">
            {report.overallSummary}
          </p>
          <p className="text-[11px] font-mono text-[#06B6D4] leading-relaxed">
            {report.activeStrategySummary}
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-3 space-y-1">
            <span className="text-[10px] font-mono uppercase text-[#6B7280] block">
              Perfil Android
            </span>
            <span className="text-xs font-mono font-bold text-white">
              {report.environmentFlags.isAndroid ? "Detectado" : "Não"}
            </span>
          </div>
          <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-3 space-y-1">
            <span className="text-[10px] font-mono uppercase text-[#6B7280] block">
              Perfil iOS / iPadOS
            </span>
            <span className="text-xs font-mono font-bold text-white">
              {report.environmentFlags.isIos ? "Detectado" : "Não"}
            </span>
          </div>
          <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-3 space-y-1">
            <span className="text-[10px] font-mono uppercase text-[#6B7280] block">
              Web Worker Hls.js
            </span>
            <span className="text-xs font-mono font-bold text-[#06B6D4]">
              {report.environmentFlags.hlsWorkerExpected
                ? "enableWorker: true"
                : "enableWorker: false (Android)"}
            </span>
          </div>
          <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-3 space-y-1">
            <span className="text-[10px] font-mono uppercase text-[#6B7280] block">
              Detecção Brave
            </span>
            <span className="text-xs font-mono font-bold text-white">
              {report.environmentFlags.isBraveLike ? "Sinalizado (navigator.brave)" : "Não detectado"}
            </span>
          </div>
        </div>
      </section>

      {/* Motores e Recursos */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-[#262B36] bg-[#111318] p-4 sm:p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Cpu className="size-4 text-[#06B6D4]" />
            <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#E5E7EB]">
              Motores e APIs Base de Vídeo
            </h3>
          </div>
          <div className="space-y-2.5">
            {engineList.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-[#262B36] bg-[#181B22] p-3.5 space-y-1.5 min-w-0"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-white font-sans">
                    {item.label}
                  </span>
                  <ModuleStatusBadge status={item.status} />
                </div>
                {item.meta && (
                  <div className="text-[11px] font-mono text-[#06B6D4] break-all">
                    {item.meta}
                  </div>
                )}
                <p className="text-[11px] text-[#9CA3AF] font-sans leading-relaxed">
                  {item.detail}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-[#262B36] bg-[#111318] p-4 sm:p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Settings2 className="size-4 text-[#8B5CF6]" />
              <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#E5E7EB]">
                Recursos Complementares (PiP &amp; Tela Cheia)
              </h3>
            </div>
            <div className="space-y-2.5">
              {featureList.map((feat) => (
                <div
                  key={feat.id}
                  className="rounded-lg border border-[#262B36] bg-[#181B22] p-3.5 space-y-1.5 min-w-0"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-white font-sans">
                      {feat.label}
                    </span>
                    <ModuleStatusBadge status={feat.status} />
                  </div>
                  <p className="text-[11px] text-[#9CA3AF] font-sans leading-relaxed">
                    {feat.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Preferências locais (somente leitura) */}
          <div className="rounded-xl border border-[#262B36] bg-[#111318] p-4 sm:p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sliders className="size-4 text-[#10B981]" />
                <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#E5E7EB]">
                  Preferências Salvas no Navegador
                </h3>
              </div>
              <ModuleStatusBadge
                status={report.preferences.available ? "SAUDÁVEL" : "INDISPONÍVEL"}
                showDot={false}
              />
            </div>

            {report.preferences.items.length === 0 ? (
              <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-3 text-xs text-[#9CA3AF] font-sans">
                Preferências locais indisponíveis neste contexto.
              </div>
            ) : (
              <div className="space-y-2">
                {report.preferences.items.map((pref) => (
                  <div
                    key={pref.key}
                    className="rounded-lg border border-[#262B36] bg-[#181B22] px-3 py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1"
                  >
                    <div className="min-w-0">
                      <div className="text-xs text-white font-sans font-medium">
                        {pref.label}
                      </div>
                      <div className="text-[10px] font-mono text-[#6B7280] break-all">
                        {pref.key}
                      </div>
                    </div>
                    <span className="text-xs font-mono font-semibold text-[#06B6D4] shrink-0">
                      {pref.value}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Codecs */}
      <section className="rounded-xl border border-[#262B36] bg-[#111318] p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Film className="size-4 text-[#06B6D4]" />
            <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#E5E7EB]">
              Codecs de Vídeo e Áudio Declarados
            </h3>
          </div>
          <span className="text-[10px] font-mono text-[#6B7280]">
            Apenas perfis MIME declarados (sem decodificação real)
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {report.codecs.map((codec) => (
            <div
              key={codec.id}
              className="rounded-lg border border-[#262B36] bg-[#181B22] p-3.5 space-y-1.5 min-w-0"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-white font-sans">
                  {codec.label}
                </span>
                <ModuleStatusBadge status={codec.status} />
              </div>
              <div className="text-[10px] font-mono text-[#9CA3AF] break-all bg-[#111318] border border-[#262B36] rounded px-2 py-1">
                {codec.mimeTested}
              </div>
              <p className="text-[11px] text-[#9CA3AF] font-sans leading-snug">
                {codec.detail}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Arquitetura & Limitações */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-[#262B36] bg-[#111318] p-4 sm:p-5 space-y-2.5">
          <div className="flex items-center gap-2">
            <Info className="size-4 text-[#06B6D4]" />
            <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#E5E7EB]">
              Arquitetura do Player no Hikari
            </h3>
          </div>
          {report.architectureNotes.map((note, idx) => (
            <div
              key={idx}
              className="rounded-lg border border-[#262B36] bg-[#181B22] px-3 py-2.5 text-[11px] text-[#9CA3AF] font-sans leading-relaxed"
            >
              {note}
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-[#262B36] bg-[#111318] p-4 sm:p-5 space-y-2.5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-[#F59E0B]" />
            <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#E5E7EB]">
              Limitações desta Verificação
            </h3>
          </div>
          {report.limitations.map((limitation, idx) => (
            <div
              key={idx}
              className="rounded-lg border border-[#262B36] bg-[#181B22] px-3 py-2.5 text-[11px] text-[#9CA3AF] font-sans leading-relaxed"
            >
              {limitation}
            </div>
          ))}
        </div>
      </section>

      <div className="rounded-xl border border-[#262B36] bg-[#111318] px-4 py-3 flex items-start gap-2.5">
        <ShieldAlert className="size-4 text-[#6B7280] shrink-0 mt-0.5" />
        <p className="text-[11px] text-[#9CA3AF] font-sans leading-relaxed">
          Nenhuma instância <code className="font-mono text-[#E5E7EB]">new Hls()</code> ou player de mídia foi criada nesta inspeção. Métricas de carregamento de mídia da aba ficam no módulo <strong>Desempenho</strong>, e a matriz completa de Web APIs permanece no módulo <strong>Compatibilidade</strong>.
        </p>
      </div>
    </div>
  );
}
