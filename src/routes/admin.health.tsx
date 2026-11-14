import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Database,
  Globe,
  Layers,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getBearerToken } from "@/lib/auth/client";
import {
  StudioLoadingState,
  StudioPageHeader,
  StudioPanel,
  StudioStatStrip,
} from "@/components/admin/studio-ui";
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
    return <StudioLoadingState message="Executando diagnóstico de infraestrutura e banco..." />;
  }

  const isHealthy = report?.overallStatus === "healthy";
  const isDegraded = report?.overallStatus === "degraded";

  return (
    <div className="studio-enter space-y-6">
      <StudioPageHeader
        kicker="Sistema & Infra"
        title="Saúde do Sistema"
        description="Métricas em tempo real de latência, integridade do Neon PostgreSQL, integrações externas e runtime Node.js."
        backTo="/admin"
        backLabel="Voltar à Central"
        status={
          <span
            className={cn(
              "studio-mono font-semibold uppercase",
              isHealthy
                ? "text-emerald-400"
                : isDegraded
                  ? "text-amber-300"
                  : "text-rose-400",
            )}
          >
            {isHealthy
              ? "Operação Estável"
              : isDegraded
                ? "Degradação Parcial"
                : "Instabilidade Crítica"}
          </span>
        }
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => void fetchHealth(true)}
            disabled={isRefreshing}
            className="h-9 border-[var(--studio-line)] bg-[var(--studio-panel)] text-xs hover:bg-white/[0.06]"
          >
            <RefreshCw className={cn("mr-1.5 size-3.5", isRefreshing && "animate-spin")} />
            Executar Diagnóstico Agora
          </Button>
        }
      />

      {/* Banner Geral de Saúde */}
      <div
        className={cn(
          "rounded-xl border p-4 transition-colors",
          isHealthy
            ? "border-emerald-500/30 bg-emerald-950/20 text-emerald-200"
            : isDegraded
              ? "border-amber-500/35 bg-amber-950/20 text-amber-200"
              : "border-rose-500/40 bg-rose-950/25 text-rose-200",
        )}
      >
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
            <h3 className="text-sm font-semibold text-white">
              {isHealthy
                ? "Todos os subsistemas estão operando com desempenho nominal"
                : isDegraded
                  ? "Alguns serviços externos ou conexões apresentam latência elevada"
                  : "Falha de conectividade com a camada de persistência principal"}
            </h3>
            <p className="text-xs leading-relaxed opacity-90">
              Diagnóstico gerado em{" "}
              <strong className="studio-tabular text-white">
                {report?.timestamp ? new Date(report.timestamp).toLocaleTimeString("pt-BR") : "--"}
              </strong>
              . Camada de persistência Neon PostgreSQL monitorada em tempo real.
            </p>
          </div>
        </div>
      </div>

      {/* Bloco 1: Neon PostgreSQL & Latência */}
      <StudioPanel
        title="Camada de Dados (Neon PostgreSQL)"
        description="Estado de conectividade e tempo de resposta de queries transacionais."
        icon={<Database className="size-4" />}
        bodyClassName="space-y-4"
      >
        <StudioStatStrip
          columns={4}
          items={[
            {
              label: "Status Conexão",
              value: (report?.database.status || "online").toUpperCase(),
              accent: "emerald",
            },
            {
              label: "Latência (Ping)",
              value: `${report?.database.latencyMs ?? "--"} ms`,
              accent:
                (report?.database.latencyMs ?? 0) < 120
                  ? "emerald"
                  : (report?.database.latencyMs ?? 0) < 300
                    ? "amber"
                    : "rose",
            },
            {
              label: "Tamanho do Banco",
              value: report?.database.sizePretty || "--",
            },
            {
              label: "Banco Atual",
              value: report?.database.databaseName || "hikari",
              accent: "violet",
            },
          ]}
        />

        <div className="divide-y divide-[var(--studio-line)] rounded-xl border border-[var(--studio-line)] bg-[var(--studio-panel-alt)] px-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-[11px]">
            <span className="text-[var(--color-subtle)]">Versão do Servidor:</span>
            <span className="studio-mono max-w-xs truncate text-white sm:max-w-md">
              {report?.database.version}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-[11px]">
            <span className="text-[var(--color-subtle)]">Horário do Servidor Postgres:</span>
            <span className="studio-tabular text-[var(--color-muted)]">
              {report?.database.serverTime}
            </span>
          </div>
        </div>
      </StudioPanel>

      {/* Bloco 2: Volume de Dados por Tabela */}
      <StudioPanel
        title="Volume de Dados e Tabelas"
        description="Contagem exata de registros nas tabelas do sistema."
        icon={<Layers className="size-4" />}
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {report?.tables.map((t) => (
            <div
              key={t.name}
              className="flex flex-col justify-between space-y-1 rounded-xl border border-[var(--studio-line)] bg-[var(--studio-panel-alt)] p-3.5"
            >
              <div>
                <span className="studio-mono block truncate text-[10px] font-bold text-violet-300">
                  {t.name}
                </span>
                <span className="line-clamp-1 text-[10px] text-[var(--color-subtle)]" title={t.description}>
                  {t.description}
                </span>
              </div>
              <div className="studio-tabular pt-1 text-lg font-bold text-white">
                {t.count.toLocaleString("pt-BR")}
              </div>
            </div>
          ))}
        </div>
      </StudioPanel>

      {/* Bloco 3: Integrações Externas & Runtime Node.js */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <StudioPanel
          title="Serviços & Integrações Externas"
          description="Status de conectividade com APIs e provedores de metadados."
          icon={<Globe className="size-4" />}
        >
          <div className="space-y-3 rounded-xl border border-[var(--studio-line)] bg-[var(--studio-panel-alt)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-white">
                  AniList GraphQL API
                </span>
                <span className="studio-mono text-[10px] text-[var(--color-subtle)]">
                  graphql.anilist.co
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "studio-mono text-[10px] font-bold uppercase",
                    report?.externalServices.anilist.status === "online"
                      ? "text-emerald-400"
                      : "text-rose-400",
                  )}
                >
                  {report?.externalServices.anilist.status}
                </span>
                <span className="studio-tabular text-xs text-[var(--color-muted)]">
                  · {report?.externalServices.anilist.latencyMs}ms
                </span>
              </div>
            </div>

            <p className="text-[11px] leading-relaxed text-[var(--color-subtle)]">
              Utilizada para importação e enriquecimento automático de metadados dos animes.
            </p>
          </div>
        </StudioPanel>

        <StudioPanel
          title="Runtime do Servidor"
          description="Recursos de memória, tempo de atividade e ambiente do processo."
          icon={<Cpu className="size-4" />}
        >
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl border border-[var(--studio-line)] bg-[var(--studio-panel-alt)] p-3.5">
              <span className="studio-label">Tempo Ativo (Uptime)</span>
              <div className="studio-tabular mt-1 text-sm font-semibold text-white">
                {report?.runtime ? formatUptime(report.runtime.uptimeSeconds) : "--"}
              </div>
            </div>

            <div className="rounded-xl border border-[var(--studio-line)] bg-[var(--studio-panel-alt)] p-3.5">
              <span className="studio-label">Versão Node.js</span>
              <div className="studio-mono mt-1 truncate text-sm font-semibold text-white">
                {report?.runtime.nodeVersion} ({report?.runtime.platform}-{report?.runtime.arch})
              </div>
            </div>

            <div className="rounded-xl border border-[var(--studio-line)] bg-[var(--studio-panel-alt)] p-3.5">
              <span className="studio-label">Memória Heap Usada</span>
              <div className="studio-tabular mt-1 text-sm font-semibold text-violet-300">
                {report?.runtime.memoryMb.heapUsed} MB / {report?.runtime.memoryMb.heapTotal} MB
              </div>
            </div>

            <div className="rounded-xl border border-[var(--studio-line)] bg-[var(--studio-panel-alt)] p-3.5">
              <span className="studio-label">Memória RSS Total</span>
              <div className="studio-tabular mt-1 text-sm font-semibold text-white">
                {report?.runtime.memoryMb.rss} MB
              </div>
            </div>
          </div>
        </StudioPanel>
      </div>
    </div>
  );
}

export default AdminHealthPage;
