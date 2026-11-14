import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Database,
  Globe,
  Layers,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getBearerToken } from "@/lib/auth/client";
import { cn } from "@/lib/utils";
import type { SystemHealthReport } from "@/routes/api/admin/health";

export const Route = createFileRoute("/admin/health")({
  component: AdminHealthPage,
});

function formatUptime(totalSeconds: number): string {
  const d = Math.floor(totalSeconds / 86400);
  const h = Math.floor((totalSeconds % 86400) / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(" ");
}

function AdminHealthPage() {
  const [report, setReport] = useState<SystemHealthReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchHealth = async (showToast = false) => {
    if (showToast) setIsRefreshing(true);
    else setLoading(true);

    try {
      const token = getBearerToken();
      const res = await fetch("/api/admin/health", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || "Falha ao consultar saúde do sistema.");
      }

      const data = await res.json();
      if (data?.report) {
        setReport(data.report);
        if (showToast) {
          toast.success("Diagnóstico do sistema atualizado com sucesso!");
        }
      }
    } catch (err) {
      console.error("[admin.health] Erro:", err);
      toast.error(
        err instanceof Error ? err.message : "Erro ao consultar diagnóstico.",
      );
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void fetchHealth();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3">
        <Loader2 className="size-8 animate-spin text-purple-400" />
        <p className="studio-mono text-xs text-[var(--color-muted)]">
          Executando diagnóstico de infraestrutura e banco...
        </p>
      </div>
    );
  }

  const isHealthy = report?.overallStatus === "healthy";
  const isDegraded = report?.overallStatus === "degraded";

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--color-fg)]">
              Saúde do Sistema
            </h1>
            <span
              className={cn(
                "studio-mono rounded-md border px-2 py-0.5 text-xs font-semibold uppercase",
                isHealthy
                  ? "border-emerald-500/35 bg-emerald-500/15 text-emerald-300"
                  : isDegraded
                    ? "border-amber-500/35 bg-amber-500/15 text-amber-300"
                    : "border-rose-500/35 bg-rose-500/15 text-rose-300",
              )}
            >
              {isHealthy ? "Operação Estável" : isDegraded ? "Degradação Parcial" : "Instabilidade Crítica"}
            </span>
          </div>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Métricas em tempo real de latência, integridade do Neon PostgreSQL, integrações externas e runtime Node.js.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => void fetchHealth(true)}
          disabled={isRefreshing}
          className="border-white/10 bg-white/[0.03] text-xs hover:bg-white/[0.08]"
        >
          <RefreshCw className={cn("size-3.5 mr-1.5", isRefreshing && "animate-spin")} />
          Executar Diagnóstico Agora
        </Button>
      </div>

      {/* Banner Geral de Saúde */}
      <div
        className={cn(
          "rounded-xl border p-4.5 transition-colors",
          isHealthy
            ? "border-emerald-500/30 bg-emerald-950/20 text-emerald-200"
            : isDegraded
              ? "border-amber-500/35 bg-amber-950/25 text-amber-200"
              : "border-rose-500/40 bg-rose-950/30 text-rose-200",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border",
                isHealthy
                  ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-300"
                  : isDegraded
                    ? "border-amber-500/40 bg-amber-500/20 text-amber-300"
                    : "border-rose-500/40 bg-rose-500/20 text-rose-300",
              )}
            >
              {isHealthy ? (
                <CheckCircle2 className="size-4" />
              ) : isDegraded ? (
                <AlertTriangle className="size-4" />
              ) : (
                <XCircle className="size-4" />
              )}
            </div>

            <div className="space-y-1">
              <h3 className="font-semibold text-sm text-white">
                {isHealthy
                  ? "Todos os subsistemas estão operando com desempenho nominal"
                  : isDegraded
                    ? "Alguns serviços externos ou conexões apresentam latência elevada"
                    : "Falha de conectividade com a camada de persistência principal"}
              </h3>
              <p className="text-xs opacity-90 leading-relaxed">
                Diagnóstico gerado em{" "}
                <strong className="text-white studio-tabular">
                  {report?.timestamp ? new Date(report.timestamp).toLocaleTimeString("pt-BR") : "--"}
                </strong>
                . Camada de persistência Neon PostgreSQL conectada com sucesso.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bloco 1: Neon PostgreSQL & Latência */}
      <div className="rounded-xl border border-white/[0.08] bg-[var(--studio-panel)] p-5 space-y-4">
        <div className="flex items-center gap-2.5 border-b border-white/[0.08] pb-3">
          <div className="grid size-8 place-items-center rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-400">
            <Database className="size-4" />
          </div>
          <div>
            <h2 className="font-semibold text-sm text-[var(--color-fg)]">
              Camada de Dados (Neon PostgreSQL)
            </h2>
            <p className="text-xs text-[var(--color-subtle)]">
              Estado de conectividade e tempo de resposta de queries transacionais
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3.5">
            <span className="text-[10px] text-[var(--color-subtle)] uppercase tracking-wider font-semibold">
              Status Conexão
            </span>
            <div className="mt-1 flex items-center gap-2">
              <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-semibold text-sm text-emerald-400 uppercase studio-mono text-xs">
                {report?.database.status}
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3.5">
            <span className="text-[10px] text-[var(--color-subtle)] uppercase tracking-wider font-semibold">
              Latência (Ping)
            </span>
            <div className="mt-1 flex items-baseline gap-1">
              <span
                className={cn(
                  "studio-tabular text-xl font-bold",
                  (report?.database.latencyMs ?? 0) < 120
                    ? "text-emerald-400"
                    : (report?.database.latencyMs ?? 0) < 300
                      ? "text-amber-300"
                      : "text-rose-400",
                )}
              >
                {report?.database.latencyMs}
              </span>
              <span className="text-xs text-[var(--color-subtle)]">ms</span>
            </div>
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3.5">
            <span className="text-[10px] text-[var(--color-subtle)] uppercase tracking-wider font-semibold">
              Tamanho do Banco
            </span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="studio-tabular text-xl font-bold text-white">
                {report?.database.sizePretty || "--"}
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3.5">
            <span className="text-[10px] text-[var(--color-subtle)] uppercase tracking-wider font-semibold">
              Banco Atual
            </span>
            <div className="mt-1 studio-mono text-sm font-semibold text-purple-300 truncate">
              {report?.database.databaseName || "hikari"}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3 text-xs space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[var(--color-subtle)]">Versão do Servidor:</span>
            <span className="studio-mono text-white truncate max-w-xs sm:max-w-md">
              {report?.database.version}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[var(--color-subtle)]">Horário do Servidor Postgres:</span>
            <span className="studio-tabular text-[var(--color-muted)]">
              {report?.database.serverTime}
            </span>
          </div>
        </div>
      </div>

      {/* Bloco 2: Volume de Dados por Tabela */}
      <div className="rounded-xl border border-white/[0.08] bg-[var(--studio-panel)] p-5 space-y-4">
        <div className="flex items-center gap-2.5 border-b border-white/[0.08] pb-3">
          <div className="grid size-8 place-items-center rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-400">
            <Layers className="size-4" />
          </div>
          <div>
            <h2 className="font-semibold text-sm text-[var(--color-fg)]">
              Volume de Dados e Tabelas
            </h2>
            <p className="text-xs text-[var(--color-subtle)]">
              Contagem exata de registros nas tabelas do sistema
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {report?.tables.map((t) => (
            <div
              key={t.name}
              className="flex flex-col justify-between rounded-xl border border-white/[0.06] bg-black/20 p-3 space-y-1"
            >
              <div>
                <span className="studio-mono text-[10px] font-bold text-purple-300 truncate block">
                  {t.name}
                </span>
                <span className="text-[10px] text-[var(--color-subtle)] line-clamp-1" title={t.description}>
                  {t.description}
                </span>
              </div>
              <div className="studio-tabular text-lg font-bold text-white pt-1">
                {t.count.toLocaleString("pt-BR")}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bloco 3: Integrações Externas & Runtime Node.js */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Integrações Externas */}
        <div className="rounded-xl border border-white/[0.08] bg-[var(--studio-panel)] p-5 space-y-4">
          <div className="flex items-center gap-2.5 border-b border-white/[0.08] pb-3">
            <div className="grid size-8 place-items-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
              <Globe className="size-4" />
            </div>
            <div>
              <h2 className="font-semibold text-sm text-[var(--color-fg)]">
                Serviços & Integrações Externas
              </h2>
              <p className="text-xs text-[var(--color-subtle)]">
                Status de conectividade com APIs e provedores de metadados
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-xs text-white">
                  AniList GraphQL API
                </span>
                <span className="studio-mono text-[9px] text-[var(--color-subtle)]">
                  graphql.anilist.co
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "studio-mono rounded px-1.5 py-0.5 text-[9px] font-bold uppercase",
                    report?.externalServices.anilist.status === "online"
                      ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                      : "bg-rose-500/15 text-rose-300 border border-rose-500/30",
                  )}
                >
                  {report?.externalServices.anilist.status}
                </span>
                <span className="studio-tabular text-xs text-[var(--color-muted)]">
                  {report?.externalServices.anilist.latencyMs}ms
                </span>
              </div>
            </div>

            <p className="text-[11px] text-[var(--color-subtle)] leading-relaxed">
              Utilizada para importação e enriquecimento automático de metadados dos animes.
            </p>
          </div>
        </div>

        {/* Runtime Node.js */}
        <div className="rounded-xl border border-white/[0.08] bg-[var(--studio-panel)] p-5 space-y-4">
          <div className="flex items-center gap-2.5 border-b border-white/[0.08] pb-3">
            <div className="grid size-8 place-items-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400">
              <Cpu className="size-4" />
            </div>
            <div>
              <h2 className="font-semibold text-sm text-[var(--color-fg)]">
                Runtime do Servidor
              </h2>
              <p className="text-xs text-[var(--color-subtle)]">
                Recursos de memória, tempo de atividade e ambiente do processo
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
              <span className="text-[10px] text-[var(--color-subtle)] uppercase tracking-wider font-semibold">
                Tempo Ativo (Uptime)
              </span>
              <div className="mt-1 studio-tabular text-sm font-semibold text-white">
                {report?.runtime ? formatUptime(report.runtime.uptimeSeconds) : "--"}
              </div>
            </div>

            <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
              <span className="text-[10px] text-[var(--color-subtle)] uppercase tracking-wider font-semibold">
                Versão Node.js
              </span>
              <div className="mt-1 studio-mono text-sm font-semibold text-white">
                {report?.runtime.nodeVersion} ({report?.runtime.platform}-{report?.runtime.arch})
              </div>
            </div>

            <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
              <span className="text-[10px] text-[var(--color-subtle)] uppercase tracking-wider font-semibold">
                Memória Heap Usada
              </span>
              <div className="mt-1 studio-tabular text-sm font-semibold text-purple-300">
                {report?.runtime.memoryMb.heapUsed} MB / {report?.runtime.memoryMb.heapTotal} MB
              </div>
            </div>

            <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
              <span className="text-[10px] text-[var(--color-subtle)] uppercase tracking-wider font-semibold">
                Memória RSS Total
              </span>
              <div className="mt-1 studio-tabular text-sm font-semibold text-white">
                {report?.runtime.memoryMb.rss} MB
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminHealthPage;
