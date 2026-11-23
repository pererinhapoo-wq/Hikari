import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Database,
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
import { usePublicSettings } from "@/lib/settings/use-public-settings";
import {
  StudioLoadingState,
  StudioPageHeader,
  StudioPanel,
  StudioStatStrip,
} from "@/components/admin/studio-ui";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/maintenance")({
  component: AdminMaintenancePage,
});

interface TableStat {
  tableName: string;
  rowCount: number;
  status?: "ok" | "error";
  error?: string;
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
    error?: string;
  };
  serverTime: string;
}

interface CalendarSyncStatusData {
  dbSource: "neon" | "pglite";
  counts: {
    scheduleCount: number;
    animeCount: number;
    seasonCount: number;
  };
  scheduleRange: {
    minAiringAt: string | null;
    maxAiringAt: string | null;
  };
  settings: {
    initialCompleted: boolean;
    lastScheduleTimestamp: number | null;
    lastCatalogTimestamp: number | null;
    checkpoint: Record<string, unknown> | null;
    lastSummary: Record<string, unknown> | null;
  };
}

function AdminMaintenancePage() {
  const { refreshSettings, applyAdminSettings } = usePublicSettings();
  const [data, setData] = useState<MaintenanceData | null>(null);
  const [calendarSync, setCalendarSync] = useState<CalendarSyncStatusData | null>(null);
  const [loading, setLoading] = useState(true);

  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState("");
  const [allowAdminBypass, setAllowAdminBypass] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [isClearingCache, setIsClearingCache] = useState<string | null>(null);
  const [isSyncingCalendar, setIsSyncingCalendar] = useState<"schedule" | "full" | null>(null);
  const [isPinging, setIsPinging] = useState(false);
  const [currentPing, setCurrentPing] = useState<number | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = getBearerToken();
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const [res, calRes] = await Promise.all([
        fetch("/api/admin/maintenance", { headers }),
        fetch("/api/admin/calendar-sync", { headers }).catch(() => null),
      ]);

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

      if (calRes && calRes.ok) {
        const calJson = await calRes.json().catch(() => null);
        if (calJson?.ok) {
          setCalendarSync(calJson);
        }
      }
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
      if (resJson.settings) {
        applyAdminSettings(resJson.settings);
      } else {
        await refreshSettings();
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
      if (target === "settings" || target === "all") {
        await refreshSettings();
      }
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

  const handleSyncCalendar = async (mode: "schedule" | "full") => {
    if (isSyncingCalendar) return;
    setIsSyncingCalendar(mode);

    try {
      const token = getBearerToken();
      const res = await fetch("/api/admin/calendar-sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          mode,
          scheduleDaysForward: 90,
        }),
      });

      const resJson = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          resJson?.error || "Falha ao sincronizar calendário administrativo.",
        );
      }

      if (resJson?.counts) {
        setCalendarSync(resJson);
        setData((prev) => {
          if (!prev?.database?.tables) return prev;
          return {
            ...prev,
            database: {
              ...prev.database,
              tables: prev.database.tables.map((t) => {
                if (t.tableName === "catalog_airing_schedule") {
                  return { ...t, rowCount: resJson.counts.scheduleCount, status: "ok", error: undefined };
                }
                if (t.tableName === "catalog_anime") {
                  return { ...t, rowCount: resJson.counts.animeCount, status: "ok", error: undefined };
                }
                if (t.tableName === "catalog_season") {
                  return { ...t, rowCount: resJson.counts.seasonCount, status: "ok", error: undefined };
                }
                return t;
              }),
            },
          };
        });
      }
      toast.success(
        resJson?.message || "Sincronização do calendário concluída com sucesso!",
      );
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Erro ao sincronizar calendário com a AniList.",
      );
    } finally {
      setIsSyncingCalendar(null);
    }
  };

  if (loading) {
    return (
      <StudioLoadingState message="Carregando diagnóstico de manutenção do PostgreSQL..." />
    );
  }

  return (
    <div className="studio-enter space-y-6">
      <StudioPageHeader
        kicker="Sistema & Infra"
        title="Central de Manutenção"
        description="Gerencie o modo de manutenção global, libere caches em memória e inspecione o estado das tabelas no Neon PostgreSQL."
        backTo="/admin"
        backLabel="Voltar à Central"
        status={
          <span
            className={cn(
              "studio-mono font-semibold uppercase",
              maintenanceMode ? "text-rose-400" : "text-emerald-400",
            )}
          >
            {maintenanceMode ? "Manutenção Ativa" : "Operação Normal"}
          </span>
        }
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => void fetchData()}
            disabled={loading}
            className="h-9 border-[var(--studio-line)] bg-[var(--studio-panel)] text-xs hover:bg-white/[0.06]"
          >
            <RefreshCw className={cn("mr-1.5 size-3.5", loading && "animate-spin")} />
            Atualizar Diagnóstico
          </Button>
        }
      />

      {/* Banner de Status do Modo de Manutenção */}
      {maintenanceMode ? (
        <div className="rounded-xl border border-rose-500/35 bg-rose-950/25 p-4 text-rose-200">
          <div className="flex items-start gap-3">
            <div className="grid size-8 shrink-0 place-items-center rounded-lg border border-rose-500/35 bg-rose-500/20 text-rose-300">
              <AlertTriangle className="size-4" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-white">
                O Modo de Manutenção está ATIVADO no momento
              </h3>
              <p className="text-xs leading-relaxed text-rose-200/90">
                Visitantes e usuários comuns verão a tela de manutenção.
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
              <h3 className="text-sm font-semibold text-white">
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
      <StudioPanel
        title="Configurações de Manutenção"
        description="Persistidas diretamente na tabela admin_settings do PostgreSQL."
        icon={<Wrench className="size-4" />}
        right={
          <Button
            size="sm"
            onClick={() => void handleSaveMaintenance()}
            disabled={isSaving}
            className="h-9 bg-violet-600 px-4 text-xs font-semibold text-white hover:bg-violet-500"
          >
            {isSaving ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <Save className="mr-1.5 size-3.5" />
            )}
            Salvar Configurações
          </Button>
        }
        bodyClassName="space-y-4"
      >
        {/* Interruptor Modo de Manutenção */}
        <div className="flex items-center justify-between gap-4 rounded-xl border border-[var(--studio-line)] bg-[var(--studio-panel-alt)] p-4">
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
        <div className="flex items-center justify-between gap-4 rounded-xl border border-[var(--studio-line)] bg-[var(--studio-panel-alt)] p-4">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <Label className="text-xs font-semibold text-white">
                Permitir Bypass de Administradores
              </Label>
              <ShieldCheck className="size-3.5 text-violet-300" />
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
              allowAdminBypass ? "bg-violet-600" : "bg-white/20",
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
            className="studio-input text-xs"
          />
          <p className="text-[11px] text-[var(--color-subtle)]">
            Esta mensagem aparecerá com destaque na tela de manutenção quando o modo estiver ativo.
          </p>
        </div>
      </StudioPanel>

      {/* Bloco 2: Limpeza e Gerenciamento de Caches */}
      <StudioPanel
        title="Gerenciamento de Caches em Memória"
        description="Invalide caches de servidor para forçar releitura imediata do banco de dados."
        icon={<Zap className="size-4" />}
        right={
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleClearCache("all")}
            disabled={isClearingCache !== null}
            className="h-9 border-amber-500/30 bg-amber-500/10 text-xs font-semibold text-amber-200 hover:bg-amber-500/20"
          >
            {isClearingCache === "all" ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <Trash2 className="mr-1.5 size-3.5" />
            )}
            Limpar Todos os Caches
          </Button>
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex flex-col justify-between space-y-3 rounded-xl border border-[var(--studio-line)] bg-[var(--studio-panel-alt)] p-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <Layers className="size-3.5 text-violet-300" />
                <span>Episódios &amp; Players</span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-[var(--color-muted)]">
                Cache de episódios e players de vídeo publicado por anime.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleClearCache("episodes")}
              disabled={isClearingCache !== null}
              className="h-9 w-full border-[var(--studio-line)] text-xs hover:bg-white/[0.06]"
            >
              {isClearingCache === "episodes" && (
                <Loader2 className="mr-1.5 size-3 animate-spin" />
              )}
              Limpar Cache
            </Button>
          </div>

          <div className="flex flex-col justify-between space-y-3 rounded-xl border border-[var(--studio-line)] bg-[var(--studio-panel-alt)] p-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <Server className="size-3.5 text-sky-300" />
                <span>Catálogo Geral</span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-[var(--color-muted)]">
                Listas de animes em alta, lançamentos e metadados de catálogo.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleClearCache("catalog")}
              disabled={isClearingCache !== null}
              className="h-9 w-full border-[var(--studio-line)] text-xs hover:bg-white/[0.06]"
            >
              {isClearingCache === "catalog" && (
                <Loader2 className="mr-1.5 size-3 animate-spin" />
              )}
              Limpar Cache
            </Button>
          </div>

          <div className="flex flex-col justify-between space-y-3 rounded-xl border border-[var(--studio-line)] bg-[var(--studio-panel-alt)] p-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <Sparkles className="size-3.5 text-emerald-400" />
                <span>Configurações Públicas</span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-[var(--color-muted)]">
                Cache TTL de 60 segundos com nome, slogan e avisos públicos.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleClearCache("settings")}
              disabled={isClearingCache !== null}
              className="h-9 w-full border-[var(--studio-line)] text-xs hover:bg-white/[0.06]"
            >
              {isClearingCache === "settings" && (
                <Loader2 className="mr-1.5 size-3 animate-spin" />
              )}
              Limpar Cache
            </Button>
          </div>
        </div>
      </StudioPanel>

      {/* Bloco 2.5: Sincronização Administrativa do Calendário */}
      <StudioPanel
        title="Sincronização do Calendário (AniList → PostgreSQL)"
        description="A navegação de visitantes (Home e /calendar) lê apenas PostgreSQL + Upstash Redis. Use os controles abaixo somente para carga inicial ou atualização trimestral."
        icon={<CalendarClock className="size-4" />}
        right={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-9 border-[var(--studio-line)] bg-[var(--studio-panel-alt)] px-3.5 text-xs hover:bg-white/[0.08]"
            >
              <Link to="/admin/calendar">Recorrências Semanais</Link>
            </Button>
            <Button
              size="sm"
              onClick={() => void handleSyncCalendar("schedule")}
              disabled={isSyncingCalendar !== null}
              className="h-9 bg-violet-600 px-3.5 text-xs font-semibold text-white hover:bg-violet-500"
            >
              {isSyncingCalendar === "schedule" ? (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              ) : (
                <CalendarClock className="mr-1.5 size-3.5" />
              )}
              {calendarSync?.settings?.checkpoint &&
              calendarSync.settings.checkpoint.mode === "schedule"
                ? "Retomar Calendário"
                : "Sincronizar Calendário (90 dias)"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleSyncCalendar("full")}
              disabled={isSyncingCalendar !== null}
              className="h-9 border-[var(--studio-line)] bg-[var(--studio-panel-alt)] px-3.5 text-xs hover:bg-white/[0.08]"
            >
              {isSyncingCalendar === "full" ? (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="mr-1.5 size-3.5" />
              )}
              Sincronização Completa
            </Button>
          </div>
        }
        bodyClassName="space-y-4"
      >
        <StudioStatStrip
          columns={3}
          items={[
            {
              label: "Banco Conectado",
              value:
                calendarSync?.dbSource === "neon"
                  ? "Neon PostgreSQL"
                  : "PGLite Local",
              detail:
                calendarSync?.dbSource === "neon"
                  ? "Persistência remota via DATABASE_URL"
                  : "Banco embutido local (preview/sandbox)",
              accent: calendarSync?.dbSource === "neon" ? "emerald" : "amber",
            },
            {
              label: "Horários Armazenados",
              value: (calendarSync?.counts?.scheduleCount ?? 0).toLocaleString(
                "pt-BR",
              ),
              detail: `${(calendarSync?.counts?.animeCount ?? 0).toLocaleString("pt-BR")} animes e ${(calendarSync?.counts?.seasonCount ?? 0).toLocaleString("pt-BR")} temporadas`,
              accent: "violet",
            },
            {
              label: "Última Sincronização do Calendário",
              value: calendarSync?.settings?.lastScheduleTimestamp
                ? new Date(
                    calendarSync.settings.lastScheduleTimestamp,
                  ).toLocaleDateString("pt-BR")
                : "Pendente",
              detail: calendarSync?.settings?.checkpoint
                ? `Checkpoint salvo: etapa ${String(calendarSync.settings.checkpoint.stage ?? "")}`
                : "Idempotente: preserva dados manuais, episódios e fontes",
              accent: calendarSync?.settings?.lastScheduleTimestamp
                ? "emerald"
                : "amber",
            },
          ]}
        />
      </StudioPanel>

      {/* Bloco 3: Diagnóstico do Neon PostgreSQL */}
      <StudioPanel
        title="Diagnóstico do Neon PostgreSQL"
        description="Métricas em tempo real de latência, tamanho e tabelas do banco."
        icon={<Database className="size-4" />}
        right={
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handlePingDb()}
            disabled={isPinging}
            className="h-9 border-[var(--studio-line)] bg-[var(--studio-panel-alt)] text-xs hover:bg-white/[0.08]"
          >
            <Activity className={cn("mr-1.5 size-3.5", isPinging && "animate-spin")} />
            {isPinging ? "Testando..." : "Testar Conexão (Ping)"}
          </Button>
        }
        bodyClassName="space-y-4"
      >
        {data?.database?.error && (
          <div className="rounded-xl border border-rose-500/35 bg-rose-950/20 px-4 py-3 text-xs text-rose-200">
            <strong className="font-semibold text-white">Alerta de diagnóstico:</strong>{" "}
            {data.database.error}
          </div>
        )}

        <StudioStatStrip
          columns={3}
          items={[
            {
              label: "Status da Conexão",
              value:
                data?.database?.status === "offline"
                  ? "Offline"
                  : data?.database?.status === "degraded"
                    ? "Degradado"
                    : "Online",
              detail:
                data?.database?.status === "offline"
                  ? "Falha ao executar consulta no PostgreSQL"
                  : data?.database?.status === "degraded"
                    ? "Alguma tabela reportou erro na verificação"
                    : "Conexão PostgreSQL ativa",
              accent:
                data?.database?.status === "offline"
                  ? "rose"
                  : data?.database?.status === "degraded"
                    ? "amber"
                    : "emerald",
            },
            {
              label: "Latência de Resposta",
              value: `${currentPing ?? "--"} ms`,
              detail: "Round-trip transacional (SELECT 1)",
              accent:
                data?.database?.status === "offline"
                  ? "rose"
                  : (currentPing ?? 0) < 120
                    ? "emerald"
                    : (currentPing ?? 0) < 300
                      ? "amber"
                      : "rose",
            },
            {
              label: "Tamanho do Banco",
              value: data?.database?.sizePretty || "--",
              detail: "Armazenamento total alocado",
              accent: "violet",
            },
          ]}
        />

        {data?.database?.tables && data.database.tables.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-[var(--studio-line)]">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--studio-line)] bg-white/[0.02] text-[10px] font-semibold tracking-wider text-[var(--color-subtle)] uppercase">
                <tr>
                  <th className="px-4 py-2.5">Tabela</th>
                  <th className="px-4 py-2.5 text-right">Total Linhas</th>
                  <th className="hidden px-4 py-2.5 text-right sm:table-cell">Tuplas Ativas</th>
                  <th className="hidden px-4 py-2.5 text-right md:table-cell">Tuplas Mortas</th>
                  <th className="px-4 py-2.5 text-right">Último Analyze/Vacuum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--studio-line-soft)]">
                {data.database.tables.map((t) => (
                  <tr
                    key={t.tableName}
                    className={cn(
                      "hover:bg-white/[0.02]",
                      t.status === "error" && "bg-rose-950/15",
                    )}
                  >
                    <td className="studio-mono px-4 py-2.5 font-medium text-[var(--color-fg)]">
                      <span>{t.tableName}</span>
                      {t.error && (
                        <span className="mt-0.5 block text-[10px] font-normal text-rose-300">
                          {t.error}
                        </span>
                      )}
                    </td>
                    <td className="studio-tabular px-4 py-2.5 text-right font-semibold text-white">
                      {t.status === "error" ? (
                        <span className="studio-mono text-[11px] font-bold text-rose-400">
                          ERRO
                        </span>
                      ) : (
                        t.rowCount.toLocaleString("pt-BR")
                      )}
                    </td>
                    <td className="studio-tabular hidden px-4 py-2.5 text-right text-[var(--color-muted)] sm:table-cell">
                      {t.liveTuples !== undefined
                        ? t.liveTuples.toLocaleString("pt-BR")
                        : "--"}
                    </td>
                    <td className="studio-tabular hidden px-4 py-2.5 text-right text-[var(--color-subtle)] md:table-cell">
                      {t.deadTuples !== undefined
                        ? t.deadTuples.toLocaleString("pt-BR")
                        : "--"}
                    </td>
                    <td className="studio-tabular px-4 py-2.5 text-right text-[var(--color-subtle)]">
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
      </StudioPanel>
    </div>
  );
}

export default AdminMaintenancePage;
