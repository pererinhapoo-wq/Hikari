import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  HardDrive,
  Layers,
  Loader2,
  RefreshCw,
  Save,
  Server,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wrench,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getBearerToken } from "@/lib/auth/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/maintenance")({
  component: AdminMaintenancePage,
});

interface TableStat {
  tableName: string;
  rowCount: number;
  liveTuples?: number;
  deadTuples?: number;
  lastVacuum?: string | null;
  lastAnalyze?: string | null;
}

interface MaintenanceData {
  maintenance: {
    mode: boolean;
    message: string;
    allowAdminBypass: boolean;
  };
  database: {
    status: string;
    latencyMs: number;
    sizeBytes: number;
    sizePretty: string;
    tables: TableStat[];
  };
  serverTime: string;
}

function AdminMaintenancePage() {
  const [data, setData] = useState<MaintenanceData | null>(null);
  const [loading, setLoading] = useState(true);

  // Estado dos formulários de manutenção
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState("");
  const [allowAdminBypass, setAllowAdminBypass] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Estados de ações de cache e ping
  const [isClearingCache, setIsClearingCache] = useState<string | null>(null);
  const [isPinging, setIsPinging] = useState(false);
  const [currentPing, setCurrentPing] = useState<number | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = getBearerToken();
      const res = await fetch("/api/admin/maintenance", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || "Falha ao carregar dados de manutenção.");
      }

      const json = await res.json();
      setData(json);
      setMaintenanceMode(json.maintenance?.mode ?? false);
      setMaintenanceMessage(json.maintenance?.message ?? "");
      setAllowAdminBypass(json.maintenance?.allowAdminBypass ?? true);
      setCurrentPing(json.database?.latencyMs ?? null);
    } catch (err) {
      console.error("[admin.maintenance] Erro ao carregar:", err);
      toast.error(
        err instanceof Error ? err.message : "Erro ao carregar dados do servidor.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  const handleSaveMaintenance = async () => {
    if (isSaving) return;
    setIsSaving(true);

    try {
      const token = getBearerToken();
      const res = await fetch("/api/admin/maintenance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          action: "update_maintenance",
          maintenance_mode: maintenanceMode,
          maintenance_message: maintenanceMessage,
          maintenance_allow_admin_bypass: allowAdminBypass,
        }),
      });

      const resJson = await res.json();

      if (!res.ok) {
        throw new Error(resJson?.error || "Falha ao salvar configuração.");
      }

      toast.success(resJson.message || "Configuração de manutenção atualizada!");
      if (resJson.maintenance) {
        setMaintenanceMode(resJson.maintenance.mode);
        setMaintenanceMessage(resJson.maintenance.message);
        setAllowAdminBypass(resJson.maintenance.allowAdminBypass);
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erro ao salvar manutenção.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearCache = async (target: "episodes" | "catalog" | "settings" | "all") => {
    if (isClearingCache) return;
    setIsClearingCache(target);

    try {
      const token = getBearerToken();
      const res = await fetch("/api/admin/maintenance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          action: "clear_cache",
          target,
        }),
      });

      const resJson = await res.json();

      if (!res.ok) {
        throw new Error(resJson?.error || "Falha ao limpar cache.");
      }

      toast.success(resJson.message || "Cache limpo com sucesso!");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erro ao limpar cache.",
      );
    } finally {
      setIsClearingCache(null);
    }
  };

  const handlePingDb = async () => {
    if (isPinging) return;
    setIsPinging(true);

    try {
      const token = getBearerToken();
      const res = await fetch("/api/admin/maintenance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action: "ping_db" }),
      });

      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson?.error || "Falha no teste de conexão.");
      }

      setCurrentPing(resJson.latencyMs);
      toast.success(`PostgreSQL respondeu em ${resJson.latencyMs}ms!`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Falha ao testar conexão.",
      );
    } finally {
      setIsPinging(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3">
        <Loader2 className="size-8 animate-spin text-purple-400" />
        <p className="studio-mono text-xs text-[var(--color-muted)]">
          Carregando diagnóstico de manutenção do PostgreSQL...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--color-fg)]">
              Central de Manutenção
            </h1>
            <span
              className={cn(
                "studio-mono rounded-md border px-2 py-0.5 text-xs font-semibold uppercase",
                maintenanceMode
                  ? "border-rose-500/35 bg-rose-500/15 text-rose-300"
                  : "border-emerald-500/35 bg-emerald-500/15 text-emerald-300",
              )}
            >
              {maintenanceMode ? "Manutenção Ativa" : "Operação Normal"}
            </span>
          </div>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Gerencie o modo de manutenção global, libere caches em memória e inspecione o estado das tabelas no Neon PostgreSQL.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => void fetchData()}
          disabled={loading}
          className="border-white/10 bg-white/[0.03] text-xs hover:bg-white/[0.08]"
        >
          <RefreshCw className={cn("size-3.5 mr-1.5", loading && "animate-spin")} />
          Atualizar Diagnóstico
        </Button>
      </div>

      {/* Banner de Status do Modo de Manutenção */}
      {maintenanceMode ? (
        <div className="rounded-xl border border-rose-500/35 bg-rose-950/30 p-4 text-rose-200">
          <div className="flex items-start gap-3">
            <div className="grid size-8 shrink-0 place-items-center rounded-lg border border-rose-500/35 bg-rose-500/20 text-rose-300">
              <AlertTriangle className="size-4" />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-sm text-white">
                O Modo de Manutenção está ATIVADO no momento
              </h3>
              <p className="text-xs text-rose-200/90 leading-relaxed">
                Visitantes e usuários comuns verão o aviso de manutenção.
                {allowAdminBypass
                  ? " Administradores continuam com bypass autorizado para navegar e testar a plataforma."
                  : " O bypass de administrador está desativado."}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4 text-emerald-200">
          <div className="flex items-center gap-3">
            <div className="grid size-8 shrink-0 place-items-center rounded-lg border border-emerald-500/35 bg-emerald-500/20 text-emerald-300">
              <CheckCircle2 className="size-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-white">
                Acesso Público Liberado
              </h3>
              <p className="text-xs text-emerald-200/80">
                A plataforma está operando normalmente para todos os usuários e visitantes.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Bloco 1: Controle do Modo de Manutenção */}
      <div className="rounded-xl border border-white/[0.08] bg-[var(--studio-panel)] p-5 space-y-5">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="grid size-8 place-items-center rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-400">
              <Wrench className="size-4" />
            </div>
            <div>
              <h2 className="font-semibold text-sm text-[var(--color-fg)]">
                Configurações de Manutenção
              </h2>
              <p className="text-xs text-[var(--color-subtle)]">
                Persistidas diretamente na tabela admin_settings do PostgreSQL
              </p>
            </div>
          </div>

          <Button
            size="sm"
            onClick={() => void handleSaveMaintenance()}
            disabled={isSaving}
            className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold"
          >
            {isSaving ? (
              <Loader2 className="size-3.5 mr-1.5 animate-spin" />
            ) : (
              <Save className="size-3.5 mr-1.5" />
            )}
            Salvar Configurações
          </Button>
        </div>

        <div className="space-y-4">
          {/* Interruptor Modo de Manutenção */}
          <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-black/20 p-4">
            <div className="space-y-0.5">
              <Label className="text-xs font-semibold text-white">
                Ativar Modo de Manutenção
              </Label>
              <p className="text-[11px] text-[var(--color-muted)]">
                Bloqueia o acesso público temporariamente exibindo a mensagem abaixo.
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={maintenanceMode}
              onClick={() => setMaintenanceMode((prev) => !prev)}
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                maintenanceMode ? "bg-rose-600" : "bg-white/20",
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block size-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out",
                  maintenanceMode ? "translate-x-5" : "translate-x-0",
                )}
              />
            </button>
          </div>

          {/* Interruptor Permissão de Bypass */}
          <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-black/20 p-4">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <Label className="text-xs font-semibold text-white">
                  Permitir Bypass de Administradores
                </Label>
                <ShieldCheck className="size-3.5 text-purple-400" />
              </div>
              <p className="text-[11px] text-[var(--color-muted)]">
                Garante que administradores autenticados possam navegar no site público mesmo durante manutenção.
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={allowAdminBypass}
              onClick={() => setAllowAdminBypass((prev) => !prev)}
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                allowAdminBypass ? "bg-purple-600" : "bg-white/20",
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block size-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out",
                  allowAdminBypass ? "translate-x-5" : "translate-x-0",
                )}
              />
            </button>
          </div>

          {/* Mensagem Personalizada */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-[var(--color-fg)]">
              Mensagem de Manutenção para os Visitantes
            </Label>
            <Textarea
              value={maintenanceMessage}
              onChange={(e) => setMaintenanceMessage(e.target.value)}
              placeholder="Digite o comunicado que será exibido aos visitantes..."
              rows={3}
              className="border-white/10 bg-black/30 text-xs text-white focus-visible:ring-purple-500"
            />
            <p className="text-[11px] text-[var(--color-subtle)]">
              Esta mensagem aparecerá com destaque na interface quando o modo de manutenção estiver ativo.
            </p>
          </div>
        </div>
      </div>

      {/* Bloco 2: Limpeza e Gerenciamento de Caches */}
      <div className="rounded-xl border border-white/[0.08] bg-[var(--studio-panel)] p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="grid size-8 place-items-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400">
              <Zap className="size-4" />
            </div>
            <div>
              <h2 className="font-semibold text-sm text-[var(--color-fg)]">
                Gerenciamento de Caches em Memória
              </h2>
              <p className="text-xs text-[var(--color-subtle)]">
                Invalide caches de servidor para forçar releitura imediata do banco de dados
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleClearCache("all")}
            disabled={isClearingCache !== null}
            className="border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 text-xs font-semibold"
          >
            {isClearingCache === "all" ? (
              <Loader2 className="size-3.5 mr-1.5 animate-spin" />
            ) : (
              <Trash2 className="size-3.5 mr-1.5" />
            )}
            Limpar Todos os Caches
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {/* Cache 1: Episódios */}
          <div className="flex flex-col justify-between rounded-xl border border-white/[0.06] bg-black/20 p-3.5 space-y-3">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <Layers className="size-3.5 text-purple-400" />
                <span>Episódios & Players</span>
              </div>
              <p className="mt-1 text-[11px] text-[var(--color-muted)] leading-relaxed">
                Cache de episódios e players de vídeo publicado por anime.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleClearCache("episodes")}
              disabled={isClearingCache !== null}
              className="w-full border-white/10 text-xs hover:bg-white/[0.06]"
            >
              {isClearingCache === "episodes" && (
                <Loader2 className="size-3 mr-1.5 animate-spin" />
              )}
              Limpar Cache
            </Button>
          </div>

          {/* Cache 2: Catálogo */}
          <div className="flex flex-col justify-between rounded-xl border border-white/[0.06] bg-black/20 p-3.5 space-y-3">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <Server className="size-3.5 text-blue-400" />
                <span>Catálogo Geral</span>
              </div>
              <p className="mt-1 text-[11px] text-[var(--color-muted)] leading-relaxed">
                Listas de animes em alta, lançamentos e metadados de catálogo.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleClearCache("catalog")}
              disabled={isClearingCache !== null}
              className="w-full border-white/10 text-xs hover:bg-white/[0.06]"
            >
              {isClearingCache === "catalog" && (
                <Loader2 className="size-3 mr-1.5 animate-spin" />
              )}
              Limpar Cache
            </Button>
          </div>

          {/* Cache 3: Configurações */}
          <div className="flex flex-col justify-between rounded-xl border border-white/[0.06] bg-black/20 p-3.5 space-y-3">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <Sparkles className="size-3.5 text-emerald-400" />
                <span>Configurações Públicas</span>
              </div>
              <p className="mt-1 text-[11px] text-[var(--color-muted)] leading-relaxed">
                Cache TTL de 60 segundos com nome, slogan e avisos públicos.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleClearCache("settings")}
              disabled={isClearingCache !== null}
              className="w-full border-white/10 text-xs hover:bg-white/[0.06]"
            >
              {isClearingCache === "settings" && (
                <Loader2 className="size-3 mr-1.5 animate-spin" />
              )}
              Limpar Cache
            </Button>
          </div>
        </div>
      </div>

      {/* Bloco 3: Diagnóstico do Neon PostgreSQL */}
      <div className="rounded-xl border border-white/[0.08] bg-[var(--studio-panel)] p-5 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-white/[0.08] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="grid size-8 place-items-center rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-400">
              <Database className="size-4" />
            </div>
            <div>
              <h2 className="font-semibold text-sm text-[var(--color-fg)]">
                Diagnóstico do Neon PostgreSQL
              </h2>
              <p className="text-xs text-[var(--color-subtle)]">
                Métricas em tempo real de latência, tamanho e tabelas do banco
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handlePingDb()}
              disabled={isPinging}
              className="border-white/10 bg-white/[0.03] text-xs hover:bg-white/[0.08]"
            >
              <Activity className={cn("size-3.5 mr-1.5", isPinging && "animate-spin")} />
              {isPinging ? "Testando..." : "Testar Conexão (Ping)"}
            </Button>
          </div>
        </div>

        {/* Métricas do Banco */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3.5">
            <span className="text-[10px] text-[var(--color-subtle)] uppercase tracking-wider font-semibold">
              Status da Conexão
            </span>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-semibold text-sm text-emerald-400">
                Online & Conectado
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3.5">
            <span className="text-[10px] text-[var(--color-subtle)] uppercase tracking-wider font-semibold">
              Latência de Resposta (Ping)
            </span>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span
                className={cn(
                  "studio-tabular text-xl font-bold",
                  (currentPing ?? 0) < 120
                    ? "text-emerald-400"
                    : (currentPing ?? 0) < 300
                      ? "text-amber-300"
                      : "text-rose-400",
                )}
              >
                {currentPing ?? "--"}
              </span>
              <span className="text-xs text-[var(--color-subtle)]">ms</span>
            </div>
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3.5">
            <span className="text-[10px] text-[var(--color-subtle)] uppercase tracking-wider font-semibold">
              Tamanho do Banco
            </span>
            <div className="mt-1.5 flex items-center gap-1.5">
              <HardDrive className="size-4 text-purple-400" />
              <span className="studio-tabular text-xl font-bold text-white">
                {data?.database?.sizePretty || "--"}
              </span>
            </div>
          </div>
        </div>

        {/* Tabela de Estatísticas das Tabelas */}
        {data?.database?.tables && data.database.tables.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-white/[0.06]">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/[0.08] bg-white/[0.02] text-[10px] font-semibold tracking-wider text-[var(--color-subtle)] uppercase">
                <tr>
                  <th className="px-4 py-2.5">Tabela</th>
                  <th className="px-4 py-2.5 text-right">Total Linhas</th>
                  <th className="px-4 py-2.5 text-right">Tuplas Ativas</th>
                  <th className="px-4 py-2.5 text-right">Tuplas Mortas</th>
                  <th className="px-4 py-2.5 text-right">Último Analyze/Vacuum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {data.database.tables.map((t) => (
                  <tr key={t.tableName} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-2.5 studio-mono font-medium text-[var(--color-fg)]">
                      {t.tableName}
                    </td>
                    <td className="px-4 py-2.5 text-right studio-tabular text-white font-semibold">
                      {t.rowCount.toLocaleString("pt-BR")}
                    </td>
                    <td className="px-4 py-2.5 text-right studio-tabular text-[var(--color-muted)]">
                      {t.liveTuples !== undefined
                        ? t.liveTuples.toLocaleString("pt-BR")
                        : "--"}
                    </td>
                    <td className="px-4 py-2.5 text-right studio-tabular text-[var(--color-subtle)]">
                      {t.deadTuples !== undefined
                        ? t.deadTuples.toLocaleString("pt-BR")
                        : "--"}
                    </td>
                    <td className="px-4 py-2.5 text-right studio-tabular text-[var(--color-subtle)]">
                      {t.lastAnalyze || t.lastVacuum
                        ? new Date(t.lastAnalyze || t.lastVacuum!).toLocaleDateString("pt-BR")
                        : "Automático (Neon)"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminMaintenancePage;
