import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  Globe,
  Info,
  Layers,
  Loader2,
  MessageSquare,
  Play,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldAlert,
  Sparkles,
  Wrench,
  X,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getBearerToken } from "@/lib/auth/client";
import { usePublicSettings } from "@/lib/settings/use-public-settings";
import {
  type HikariAdminSettings,
  DEFAULT_ADMIN_SETTINGS,
} from "@/lib/settings/settings-types";
import {
  getAniListSyncStatusFn,
  startAniListSyncFn,
  stepAniListSyncFn,
} from "@/lib/anilist-sync.functions";
import type { AniListSyncStatusSnapshot } from "@/lib/anilist-sync-types";
import {
  StudioLoadingState,
  StudioPageHeader,
  StudioPanel,
} from "@/components/admin/studio-ui";
import { cn } from "@/lib/utils";

type SettingsTab = "identity" | "preferences" | "sync" | "notices" | "modules";

export interface AdminSettingsSearch {
  tab?: SettingsTab;
}

export const Route = createFileRoute("/admin/settings")({
  validateSearch: (raw: Record<string, unknown>): AdminSettingsSearch => {
    const tab = typeof raw.tab === "string" ? raw.tab : undefined;
    if (
      tab === "identity" ||
      tab === "preferences" ||
      tab === "sync" ||
      tab === "notices" ||
      tab === "modules"
    ) {
      return { tab: tab as SettingsTab };
    }
    return {};
  },
  component: AdminSettingsPage,
});

function formatSyncDateTime(iso: string | null | undefined): string {
  if (!iso) return "Nenhuma execução concluída ainda";
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return "Nenhuma execução concluída ainda";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(ts));
}

function getSyncStageLabel(stage: string | null | undefined): string {
  switch (stage) {
    case "trending":
      return "Em Alta (Trending)";
    case "popular":
      return "Populares";
    case "top":
      return "Melhores Avaliados";
    case "recent":
      return "Atualizados Recentemente";
    case "incremental":
      return "Varredura Incremental";
    case "trending_refresh":
      return "Atualização de Trending";
    case "popular_refresh":
      return "Atualização de Populares";
    case "seasons":
      return "Temporadas";
    case "schedule":
      return "Calendário de Lançamentos";
    case "completed":
      return "Concluída";
    default:
      return stage || "Inicial";
  }
}

function AdminSettingsPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { refreshSettings } = usePublicSettings();
  const [activeTab, setActiveTab] = useState<SettingsTab>(() => search.tab || "identity");

  useEffect(() => {
    if (search.tab) {
      setActiveTab((curr) => (curr !== search.tab ? (search.tab as SettingsTab) : curr));
    } else {
      setActiveTab((curr) => (curr !== "identity" ? "identity" : curr));
    }
  }, [search.tab]);

  const handleTabChange = useCallback(
    (newTab: SettingsTab) => {
      setActiveTab(newTab);
      void navigate({
        search: (prev: AdminSettingsSearch) => {
          const next: AdminSettingsSearch = { ...prev };
          if (newTab === "identity") {
            delete next.tab;
          } else {
            next.tab = newTab;
          }
          return next;
        },
        replace: true,
      });
    },
    [navigate],
  );

  const [settings, setSettings] =
    useState<HikariAdminSettings>(DEFAULT_ADMIN_SETTINGS);
  const [savedSettings, setSavedSettings] =
    useState<HikariAdminSettings>(DEFAULT_ADMIN_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [syncStatus, setSyncStatus] = useState<AniListSyncStatusSnapshot | null>(null);
  const [syncLoading, setSyncLoading] = useState(true);
  const [startingSync, setStartingSync] = useState(false);
  const [confirmSyncOpen, setConfirmSyncOpen] = useState(false);
  const [savingFrequency, setSavingFrequency] = useState(false);
  const stepLoopRunningRef = useRef(false);
  const syncWasRunningRef = useRef(false);

  const loadSyncStatus = useCallback(async (silent = false) => {
    if (!silent) setSyncLoading(true);
    try {
      const snapshot = await getAniListSyncStatusFn();
      setSyncStatus(snapshot);
    } catch (err) {
      if (!silent) {
        console.error("[admin.settings] Erro ao carregar status da sincronização AniList:", err);
      }
    } finally {
      if (!silent) setSyncLoading(false);
    }
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const token = getBearerToken();
      const res = await fetch("/api/admin/settings", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || "Falha ao carregar configurações.");
      }
      const data = await res.json();
      if (data?.settings) {
        setSettings(data.settings);
        setSavedSettings(data.settings);
      }
    } catch (err) {
      console.error("[admin.settings] Erro de carregamento:", err);
      toast.error(
        err instanceof Error
          ? err.message
          : "Erro ao carregar configurações do servidor.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSettings();
    void loadSyncStatus();
  }, [loadSyncStatus]);

  useEffect(() => {
    const currentStatus = syncStatus?.status;
    if (currentStatus === "running") {
      syncWasRunningRef.current = true;
    } else if (syncWasRunningRef.current && currentStatus) {
      syncWasRunningRef.current = false;
      if (currentStatus === "completed") {
        toast.success("Sincronização AniList concluída com sucesso!");
      } else if (currentStatus === "error") {
        toast.error(
          syncStatus?.errorMessage || "A sincronização AniList terminou com erro.",
        );
      }
    }
  }, [syncStatus?.status, syncStatus?.errorMessage]);

  useEffect(() => {
    if (syncStatus?.status !== "running") return;
    let cancelled = false;

    if (syncStatus.executionMode === "chunked") {
      if (stepLoopRunningRef.current) return;
      stepLoopRunningRef.current = true;

      const runChunkedLoop = async () => {
        let activeRunId = syncStatus.runId;
        try {
          while (!cancelled) {
            const next = await stepAniListSyncFn({ data: { runId: activeRunId } });
            if (cancelled) break;
            setSyncStatus(next);
            activeRunId = next.runId;
            if (next.status !== "running") break;
            await new Promise((resolve) => setTimeout(resolve, 250));
          }
        } catch (err) {
          if (!cancelled) {
            toast.error(
              err instanceof Error
                ? err.message
                : "Falha ao avançar etapa da sincronização.",
            );
            await loadSyncStatus(true);
          }
        } finally {
          stepLoopRunningRef.current = false;
        }
      };

      void runChunkedLoop();
      return () => {
        cancelled = true;
      };
    }

    const timer = window.setInterval(() => {
      void loadSyncStatus(true);
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [syncStatus?.status, syncStatus?.executionMode, syncStatus?.runId, loadSyncStatus]);

  const handleSaveFrequency = async () => {
    if (savingFrequency) return;
    setSavingFrequency(true);
    try {
      const token = getBearerToken();
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          anilist_sync_frequency: settings.anilist_sync_frequency,
        }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || "Falha ao salvar frequência de sincronização.");
      }
      const data = await res.json();
      if (data?.settings) {
        setSettings((prev) => ({
          ...prev,
          anilist_sync_frequency: data.settings.anilist_sync_frequency,
        }));
        setSavedSettings((prev) => ({
          ...prev,
          anilist_sync_frequency: data.settings.anilist_sync_frequency,
        }));
      }
      await loadSyncStatus(true);
      toast.success("Frequência da sincronização AniList atualizada!");
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Erro ao salvar frequência da sincronização.",
      );
    } finally {
      setSavingFrequency(false);
    }
  };

  const handleConfirmStartSync = async () => {
    if (startingSync) return;
    setStartingSync(true);
    try {
      const res = await startAniListSyncFn();
      setSyncStatus(res.snapshot);
      setConfirmSyncOpen(false);
      toast.info("Sincronização AniList iniciada no servidor.");
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Não foi possível iniciar a sincronização AniList.";
      toast.error(message);
      await loadSyncStatus(true);
    } finally {
      setStartingSync(false);
    }
  };

  const isDirty = useMemo(() => {
    return JSON.stringify(settings) !== JSON.stringify(savedSettings);
  }, [settings, savedSettings]);

  const updateField = <K extends keyof HikariAdminSettings>(
    key: K,
    value: HikariAdminSettings[K],
  ) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const token = getBearerToken();
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(settings),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || "Falha ao salvar configurações.");
      }

      const data = await res.json();
      if (data?.settings) {
        setSettings(data.settings);
        setSavedSettings(data.settings);
      }
      await refreshSettings();
      toast.success("Configurações salvas com sucesso no Neon PostgreSQL!");
    } catch (err) {
      console.error("[admin.settings] Erro ao salvar:", err);
      toast.error(
        err instanceof Error
          ? err.message
          : "Erro interno ao atualizar configurações.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setSettings(savedSettings);
    toast.info("Alterações descartadas.");
  };

  if (loading) {
    return <StudioLoadingState message="Carregando configurações do PostgreSQL..." />;
  }

  return (
    <div className="studio-enter space-y-6 pb-12">
      <StudioPageHeader
        kicker="Sistema & Governança"
        title="Configurações Gerais"
        description="Gerencie a identidade visual e institucional, preferências globais de exibição e reprodução, comunicados e ativação de módulos do Hikari."
        backTo="/admin"
        backLabel="Voltar à Central"
        status={
          isDirty ? (
            <span className="studio-mono font-semibold text-amber-300">
              Alterações não salvas · admin_settings
            </span>
          ) : (
            <span className="studio-mono font-semibold text-emerald-400">
              admin_settings sincronizado
            </span>
          )
        }
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={!isDirty || saving}
              className="h-9 gap-1.5 border-[var(--studio-line)] bg-[var(--studio-panel)] text-xs text-[var(--color-muted)] hover:text-white"
            >
              <RotateCcw className="size-3.5" />
              <span>Descartar</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadSettings()}
              disabled={saving}
              className="h-9 border-[var(--studio-line)] bg-[var(--studio-panel)] text-xs text-[var(--color-muted)] hover:text-white"
              title="Recarregar do banco"
              aria-label="Recarregar configurações"
            >
              <RefreshCw className="size-3.5" />
            </Button>

            <Button
              size="sm"
              onClick={handleSave}
              disabled={!isDirty || saving}
              className="h-9 gap-2 bg-violet-600 px-4 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-40"
            >
              {saving ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Gravando...</span>
                </>
              ) : (
                <>
                  <Save className="size-3.5" />
                  <span>Salvar Configurações</span>
                </>
              )}
            </Button>
          </>
        }
      />

      {/* Navegação por Abas */}
      <nav
        className="flex gap-1.5 overflow-x-auto border-b border-[var(--studio-line)] pb-2.5"
        aria-label="Categorias de configurações"
      >
        {[
          { id: "identity" as const, label: "Identidade & Marca", icon: Building2 },
          { id: "preferences" as const, label: "Preferências Globais", icon: Globe },
          { id: "sync" as const, label: "Sincronização AniList", icon: RefreshCw },
          { id: "notices" as const, label: "Avisos & Comunicados", icon: AlertTriangle },
          { id: "modules" as const, label: "Recursos & Módulos", icon: Layers },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const showSyncAlert =
            tab.id === "sync" &&
            (syncStatus?.status === "error" ||
              syncStatus?.status === "running" ||
              syncStatus?.incomplete);
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors select-none whitespace-nowrap",
                isActive
                  ? "border border-[var(--studio-accent-border)] bg-[var(--studio-accent-soft)] text-violet-200"
                  : "border border-transparent text-[var(--color-muted)] hover:bg-white/[0.04] hover:text-[var(--color-fg)]",
              )}
            >
              <Icon
                className={cn(
                  "size-4",
                  tab.id === "sync" && syncStatus?.status === "running" && "animate-spin",
                )}
              />
              <span>{tab.label}</span>
              {showSyncAlert && (
                <span
                  className={cn(
                    "size-2 rounded-full",
                    syncStatus?.status === "error"
                      ? "bg-rose-400"
                      : syncStatus?.status === "running"
                        ? "bg-violet-400"
                        : "bg-amber-400",
                  )}
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </nav>

      <div className="space-y-6">
        {/* ABA 1: IDENTIDADE E INFORMAÇÕES DO SITE */}
        {activeTab === "identity" && (
          <StudioPanel
            title="Identidade da Plataforma"
            description="Defina o nome canônico, slogan e descrições institucionais que alimentam o cabeçalho, rodapé e metadados."
            icon={<Building2 className="size-4" />}
            bodyClassName="space-y-6"
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="site_name" className="text-xs font-semibold text-zinc-200">
                  Nome da Plataforma
                </Label>
                <Input
                  id="site_name"
                  value={settings.site_name}
                  onChange={(e) => updateField("site_name", e.target.value)}
                  placeholder="Hikari"
                  className="studio-input h-10 text-sm"
                />
                <p className="text-[11px] text-[var(--color-subtle)]">
                  Exibido na tag &lt;title&gt;, no cabeçalho e na identificação pública.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="site_slogan" className="text-xs font-semibold text-zinc-200">
                  Slogan Institucional
                </Label>
                <Input
                  id="site_slogan"
                  value={settings.site_slogan}
                  onChange={(e) => updateField("site_slogan", e.target.value)}
                  placeholder="Seu portal definitivo para streaming e catálogo de animes"
                  className="studio-input h-10 text-sm"
                />
                <p className="text-[11px] text-[var(--color-subtle)]">
                  Exibido no rodapé e subtítulo da página inicial.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="site_description" className="text-xs font-semibold text-zinc-200">
                  Descrição Institucional
                </Label>
                <span className="studio-mono text-[10px] text-[var(--color-subtle)]">
                  {settings.site_description.length}/500
                </span>
              </div>
              <Textarea
                id="site_description"
                value={settings.site_description}
                onChange={(e) => updateField("site_description", e.target.value)}
                rows={3}
                maxLength={500}
                className="studio-input resize-none text-xs leading-relaxed"
                placeholder="Descrição institucional do catálogo e comunidade..."
              />
              <p className="text-[11px] text-[var(--color-subtle)]">
                Utilizada nas meta-tags e nos textos explicativos do rodapé.
              </p>
            </div>

            <div className="grid gap-5 border-t border-[var(--studio-line)] pt-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="site_contact_email" className="text-xs font-semibold text-zinc-200">
                  E-mail Oficial de Contato
                </Label>
                <Input
                  id="site_contact_email"
                  type="email"
                  value={settings.site_contact_email}
                  onChange={(e) => updateField("site_contact_email", e.target.value)}
                  placeholder="contato@hikari.tv"
                  className="studio-input h-10 text-sm"
                />
                <p className="text-[11px] text-[var(--color-subtle)]">
                  Canal oficial para suporte, denúncias e solicitações.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="site_favicon_url" className="text-xs font-semibold text-zinc-200">
                  Ícone / Favicon URL
                </Label>
                <div className="flex items-center gap-3">
                  <Input
                    id="site_favicon_url"
                    value={settings.site_favicon_url}
                    onChange={(e) => updateField("site_favicon_url", e.target.value)}
                    placeholder="/favicon.svg"
                    className="studio-input studio-mono h-10 text-xs"
                  />
                  <div className="grid size-10 shrink-0 place-items-center rounded-lg border border-[var(--studio-line)] bg-[var(--studio-panel-alt)]">
                    <img
                      src={settings.site_favicon_url || "/favicon.svg"}
                      alt="Favicon"
                      className="size-6 object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "/favicon.svg";
                      }}
                    />
                  </div>
                </div>
                <p className="text-[11px] text-[var(--color-subtle)]">
                  Caminho relativo (/favicon.svg) ou URL HTTPS para o ícone do navegador.
                </p>
              </div>
            </div>
          </StudioPanel>
        )}

        {/* ABA 2: PREFERÊNCIAS GLOBAIS */}
        {activeTab === "preferences" && (
          <StudioPanel
            title="Preferências Globais da Plataforma"
            description="Configure o idioma padrão da interface, apresentação dos títulos dos animes e comportamento de reprodução."
            icon={<Globe className="size-4" />}
            bodyClassName="space-y-6"
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="default_language" className="text-xs font-semibold text-zinc-200">
                  Idioma Padrão da Plataforma
                </Label>
                <select
                  id="default_language"
                  value={settings.default_language}
                  onChange={(e) =>
                    updateField(
                      "default_language",
                      e.target.value as HikariAdminSettings["default_language"],
                    )
                  }
                  className="studio-input h-10 w-full rounded-md px-3 text-xs"
                >
                  <option value="pt-BR">Português do Brasil (pt-BR)</option>
                  <option value="en-US">English (en-US)</option>
                  <option value="ja-JP">日本語 (ja-JP)</option>
                </select>
                <p className="text-[11px] text-[var(--color-subtle)]">
                  Idioma padrão aplicado para visitantes e novos cadastros.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="preferred_title_language" className="text-xs font-semibold text-zinc-200">
                  Apresentação Preferencial de Títulos
                </Label>
                <select
                  id="preferred_title_language"
                  value={settings.preferred_title_language}
                  onChange={(e) =>
                    updateField(
                      "preferred_title_language",
                      e.target.value as HikariAdminSettings["preferred_title_language"],
                    )
                  }
                  className="studio-input h-10 w-full rounded-md px-3 text-xs"
                >
                  <option value="romaji">Romaji (Ex: Shingeki no Kyojin)</option>
                  <option value="english">Inglês (Ex: Attack on Titan)</option>
                  <option value="native">Nativo (Ex: 進撃の巨人)</option>
                </select>
                <p className="text-[11px] text-[var(--color-subtle)]">
                  Ordem de prioridade para exibição dos nomes dos animes no catálogo.
                </p>
              </div>
            </div>

            <div className="space-y-4 border-t border-[var(--studio-line)] pt-5">
              <h3 className="studio-kicker">Comportamento do Player de Vídeo</h3>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex cursor-pointer select-none items-start gap-3 rounded-xl border border-[var(--studio-line)] bg-[var(--studio-panel-alt)] p-4 transition-colors hover:border-[var(--studio-line-strong)]">
                  <input
                    type="checkbox"
                    checked={settings.player_autoplay_default}
                    onChange={(e) => updateField("player_autoplay_default", e.target.checked)}
                    className="mt-0.5 size-4 rounded accent-violet-600"
                  />
                  <div>
                    <p className="text-xs font-semibold text-white">Autoplay Padrão</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--color-muted)]">
                      Inicia a reprodução do episódio automaticamente ao carregar a página de transmissão.
                    </p>
                  </div>
                </label>

                <label className="flex cursor-pointer select-none items-start gap-3 rounded-xl border border-[var(--studio-line)] bg-[var(--studio-panel-alt)] p-4 transition-colors hover:border-[var(--studio-line-strong)]">
                  <input
                    type="checkbox"
                    checked={settings.player_auto_next_default}
                    onChange={(e) => updateField("player_auto_next_default", e.target.checked)}
                    className="mt-0.5 size-4 rounded accent-violet-600"
                  />
                  <div>
                    <p className="text-xs font-semibold text-white">Avanço Automático (Auto-Next)</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--color-muted)]">
                      Transiciona suavemente para o próximo episódio ao finalizar a reprodução do atual.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            <div className="space-y-4 border-t border-[var(--studio-line)] pt-5">
              <label className="flex cursor-pointer select-none items-start gap-3 rounded-xl border border-[var(--studio-line)] bg-[var(--studio-panel-alt)] p-4 transition-colors hover:border-[var(--studio-line-strong)]">
                <input
                  type="checkbox"
                  checked={settings.allow_adult_content}
                  onChange={(e) => updateField("allow_adult_content", e.target.checked)}
                  className="mt-0.5 size-4 rounded accent-violet-600"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold text-white">
                      Habilitar Modo Adulto (18+) no Catálogo
                    </p>
                    <span className="studio-mono text-[10px] font-bold text-rose-400">
                      [18+]
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--color-muted)]">
                    Permite que usuários maiores de idade alternem para o modo adulto na busca e navegação.
                  </p>
                </div>
              </label>

              <div className="space-y-2 rounded-xl border border-[var(--studio-line)] bg-[var(--studio-panel-alt)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label htmlFor="anilist_sync_frequency" className="text-xs font-semibold text-zinc-200">
                    Frequência da Sincronização Periódica (AniList)
                  </Label>
                  <button
                    type="button"
                    onClick={() => handleTabChange("sync")}
                    className="text-[11px] font-semibold text-violet-300 hover:text-violet-200"
                  >
                    Abrir painel de Sincronização AniList →
                  </button>
                </div>
                <select
                  id="anilist_sync_frequency"
                  value={settings.anilist_sync_frequency}
                  onChange={(e) =>
                    updateField(
                      "anilist_sync_frequency",
                      e.target.value as HikariAdminSettings["anilist_sync_frequency"],
                    )
                  }
                  className="studio-input h-10 w-full rounded-md px-3 text-xs"
                >
                  <option value="1_per_week">1 vez por semana (Segunda-feira às 03:00 UTC)</option>
                  <option value="2_per_week">2 vezes por semana (Segunda e Quinta-feira às 03:00 UTC)</option>
                </select>
                <p className="text-[11px] text-[var(--color-subtle)]">
                  Controla quando o agendamento automático do GitHub Actions sincroniza catálogo, temporadas e calendário da AniList. Execuções manuais ignoram essa restrição.
                </p>
              </div>
            </div>
          </StudioPanel>
        )}

        {/* ABA SINCRONIZAÇÃO ANILIST */}
        {activeTab === "sync" && (
          <StudioPanel
            title="Sincronização AniList"
            description="Controle manual da importação para Neon PostgreSQL e Upstash Redis, frequência periódica, histórico de conclusão e retomada de checkpoints."
            icon={<RefreshCw className="size-4" />}
            right={
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void loadSyncStatus()}
                  disabled={syncLoading}
                  className="h-9 border-[var(--studio-line)] bg-[var(--studio-panel-alt)] text-xs text-[var(--color-muted)] hover:text-white"
                  title="Atualizar status da sincronização"
                  aria-label="Atualizar status da sincronização"
                >
                  <RefreshCw className={cn("size-3.5", syncLoading && "animate-spin")} />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setConfirmSyncOpen(true)}
                  disabled={startingSync || syncStatus?.status === "running"}
                  className="h-9 gap-2 bg-violet-600 px-4 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
                >
                  {syncStatus?.status === "running" || startingSync ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      <span>Sincronizando...</span>
                    </>
                  ) : (
                    <>
                      <Play className="size-3.5" />
                      <span>Sincronizar agora</span>
                    </>
                  )}
                </Button>
              </div>
            }
            bodyClassName="space-y-6"
          >
            {/* Resumo de Status e Última Execução */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-[var(--studio-line)] bg-[var(--studio-panel-alt)] p-4">
                <span className="studio-label block">Status da Sincronização</span>
                <div className="mt-2 flex items-center gap-2">
                  {syncStatus?.status === "running" && (
                    <>
                      <Loader2 className="size-4 animate-spin text-violet-400" />
                      <span className="text-sm font-semibold text-violet-200">
                        Executando
                      </span>
                    </>
                  )}
                  {syncStatus?.status === "completed" && (
                    <>
                      <CheckCircle2 className="size-4 text-emerald-400" />
                      <span className="text-sm font-semibold text-emerald-300">
                        Concluída
                      </span>
                    </>
                  )}
                  {syncStatus?.status === "error" && (
                    <>
                      <XCircle className="size-4 text-rose-400" />
                      <span className="text-sm font-semibold text-rose-300">
                        Erro
                      </span>
                    </>
                  )}
                  {(!syncStatus || syncStatus.status === "idle") && (
                    <>
                      <Clock className="size-4 text-zinc-400" />
                      <span className="text-sm font-semibold text-zinc-200">
                        Aguardando
                      </span>
                    </>
                  )}
                </div>
                <p className="mt-1.5 text-[11px] text-[var(--color-subtle)]">
                  {syncStatus?.initialCompleted
                    ? "Modo atual: Atualização incremental (janela 24h)"
                    : "Modo atual: Carga inicial completa"}
                </p>
              </div>

              <div className="rounded-xl border border-[var(--studio-line)] bg-[var(--studio-panel-alt)] p-4">
                <span className="studio-label block">Última Sincronização Bem-Sucedida</span>
                <p className="studio-tabular mt-2 text-sm font-semibold text-zinc-100">
                  {formatSyncDateTime(syncStatus?.lastSuccessAt)}
                </p>
                <p className="mt-1.5 text-[11px] text-[var(--color-subtle)]">
                  Atualizado apenas após conclusão integral de todas as etapas.
                </p>
              </div>

              <div className="rounded-xl border border-[var(--studio-line)] bg-[var(--studio-panel-alt)] p-4">
                <span className="studio-label block">Estado de Checkpoint</span>
                <p
                  className={cn(
                    "mt-2 text-sm font-semibold",
                    syncStatus?.incomplete ? "text-amber-300" : "text-emerald-300",
                  )}
                >
                  {syncStatus?.incomplete
                    ? "Sincronização incompleta"
                    : "Nenhum checkpoint pendente"}
                </p>
                <p className="mt-1.5 text-[11px] text-[var(--color-subtle)]">
                  {syncStatus?.incomplete && syncStatus.checkpoint
                    ? `Etapa: ${getSyncStageLabel(syncStatus.checkpoint.stage)} · Página ${syncStatus.checkpoint.page}`
                    : "Todas as etapas sincronizadas sem pendências."}
                </p>
              </div>
            </div>

            {/* Progresso em tempo real durante execução */}
            {syncStatus?.status === "running" && (
              <div className="rounded-xl border border-violet-500/35 bg-violet-950/25 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin text-violet-300" />
                    <span className="text-xs font-semibold text-violet-100">
                      Sincronização em andamento no servidor
                    </span>
                  </div>
                  {syncStatus.progress?.stage && (
                    <span className="studio-mono text-[11px] text-violet-300">
                      {getSyncStageLabel(syncStatus.progress.stage)}
                      {syncStatus.progress.page ? ` · Página ${syncStatus.progress.page}` : ""}
                    </span>
                  )}
                </div>
                {syncStatus.progress && (
                  <p className="studio-tabular mt-2 text-[11px] text-violet-200/80">
                    Processados: {syncStatus.progress.totalProcessed} · Inseridos:{" "}
                    {syncStatus.progress.totalInserted} · Atualizados:{" "}
                    {syncStatus.progress.totalUpdated} · Calendário:{" "}
                    {syncStatus.progress.importedSchedulesCount}
                  </p>
                )}
              </div>
            )}

            {/* Indicação de sincronização incompleta / checkpoint pendente */}
            {syncStatus?.incomplete && syncStatus.checkpoint && (
              <div className="rounded-xl border border-amber-500/35 bg-amber-950/25 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-400" />
                  <div className="space-y-1 text-xs">
                    <p className="font-semibold text-amber-200">
                      Sincronização incompleta detectada (checkpoint pendente)
                    </p>
                    <p className="leading-relaxed text-amber-100/80">
                      A execução anterior foi interrompida antes de concluir todas as etapas.
                      Ao clicar em <strong className="text-amber-100">Sincronizar agora</strong>,
                      o processo retomará exatamente da etapa{" "}
                      <span className="studio-mono font-semibold text-amber-200">
                        {getSyncStageLabel(syncStatus.checkpoint.stage)}
                      </span>{" "}
                      (página {syncStatus.checkpoint.page}
                      {syncStatus.checkpoint.stage === "seasons"
                        ? `, temporada índice ${syncStatus.checkpoint.seasonIndex}`
                        : ""}
                      ), sem perder registros e sem sobrescrever campos editados manualmente.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Mensagem de erro quando houver falha */}
            {syncStatus?.status === "error" && syncStatus.errorMessage && (
              <div className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-4">
                <div className="flex items-start gap-3">
                  <XCircle className="mt-0.5 size-4 shrink-0 text-rose-400" />
                  <div className="space-y-1 text-xs">
                    <p className="font-semibold text-rose-200">
                      Falha na última tentativa de sincronização
                    </p>
                    <p className="studio-mono break-words text-[11px] leading-relaxed text-rose-200/85">
                      {syncStatus.errorMessage}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Frequência Automática */}
            <div className="space-y-3 border-t border-[var(--studio-line)] pt-5">
              <div className="flex flex-wrap items-end justify-between gap-4 rounded-xl border border-[var(--studio-line)] bg-[var(--studio-panel-alt)] p-4">
                <div className="min-w-0 flex-1 space-y-2">
                  <Label
                    htmlFor="anilist_sync_frequency_panel"
                    className="text-xs font-semibold text-zinc-200"
                  >
                    Frequência Automática (GitHub Actions)
                  </Label>
                  <select
                    id="anilist_sync_frequency_panel"
                    value={settings.anilist_sync_frequency}
                    onChange={(e) =>
                      updateField(
                        "anilist_sync_frequency",
                        e.target.value as HikariAdminSettings["anilist_sync_frequency"],
                      )
                    }
                    className="studio-input h-10 w-full rounded-md px-3 text-xs"
                  >
                    <option value="1_per_week">
                      1 vez por semana (Segunda-feira às 03:00 UTC)
                    </option>
                    <option value="2_per_week">
                      2 vezes por semana (Segunda e Quinta-feira às 03:00 UTC)
                    </option>
                  </select>
                  <p className="text-[11px] text-[var(--color-subtle)]">
                    Define os dias em UTC em que o agendamento automático executa. A execução
                    manual pelo painel ou GitHub requer confirmação explícita e respeita campos
                    manuais (<span className="studio-mono">manual_fields</span>).
                  </p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void handleSaveFrequency()}
                  disabled={
                    savingFrequency ||
                    settings.anilist_sync_frequency === savedSettings.anilist_sync_frequency
                  }
                  className="h-10 shrink-0 gap-2 border-[var(--studio-line)] bg-[var(--studio-panel)] px-4 text-xs font-semibold text-zinc-100 hover:bg-white/[0.06] disabled:opacity-40"
                >
                  {savingFrequency ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <>
                      <Save className="size-3.5" />
                      <span>Salvar Frequência</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </StudioPanel>
        )}

        {/* ABA 3: AVISOS E COMUNICADOS */}
        {activeTab === "notices" && (
          <StudioPanel
            title="Comunicado Global aos Visitantes"
            description="Exiba uma faixa no topo da plataforma com comunicados oficiais, alertas de manutenção ou avisos importantes."
            icon={<AlertTriangle className="size-4" />}
            right={
              <label className="inline-flex cursor-pointer select-none items-center gap-2.5 rounded-lg border border-[var(--studio-accent-border)] bg-[var(--studio-accent-soft)] px-3.5 py-2">
                <input
                  type="checkbox"
                  checked={settings.notice_enabled}
                  onChange={(e) => updateField("notice_enabled", e.target.checked)}
                  className="size-4 rounded accent-violet-600"
                />
                <span className="text-xs font-semibold text-violet-200">
                  {settings.notice_enabled ? "Aviso Ativado no Site" : "Aviso Desativado"}
                </span>
              </label>
            }
            bodyClassName="space-y-6"
          >
            <div className="space-y-3">
              <Label className="text-xs font-semibold text-zinc-200">
                Tipo de Comunicado
              </Label>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  {
                    id: "info" as const,
                    label: "Informativo",
                    icon: Info,
                    color: "border-violet-500/40 text-violet-200 bg-violet-500/12",
                  },
                  {
                    id: "warning" as const,
                    label: "Atenção",
                    icon: AlertTriangle,
                    color: "border-amber-500/40 text-amber-200 bg-amber-500/12",
                  },
                  {
                    id: "maintenance" as const,
                    label: "Manutenção",
                    icon: Wrench,
                    color: "border-rose-500/40 text-rose-200 bg-rose-500/12",
                  },
                  {
                    id: "success" as const,
                    label: "Sucesso / Concluído",
                    icon: CheckCircle2,
                    color: "border-emerald-500/40 text-emerald-200 bg-emerald-500/12",
                  },
                ].map((item) => {
                  const isSelected = settings.notice_type === item.id;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => updateField("notice_type", item.id)}
                      className={cn(
                        "flex items-center gap-2.5 rounded-xl border p-3 text-left text-xs font-medium transition-colors",
                        isSelected
                          ? item.color
                          : "border-[var(--studio-line)] bg-[var(--studio-panel-alt)] text-[var(--color-muted)] hover:border-[var(--studio-line-strong)] hover:text-white",
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="notice_title" className="text-xs font-semibold text-zinc-200">
                  Título do Comunicado
                </Label>
                <Input
                  id="notice_title"
                  value={settings.notice_title}
                  onChange={(e) => updateField("notice_title", e.target.value)}
                  placeholder="Ex: Manutenção Programada"
                  className="studio-input h-10 text-sm"
                />
              </div>

              <div className="flex items-center sm:pt-6">
                <label className="flex cursor-pointer select-none items-center gap-3">
                  <input
                    type="checkbox"
                    checked={settings.notice_dismissible}
                    onChange={(e) => updateField("notice_dismissible", e.target.checked)}
                    className="size-4 rounded accent-violet-600"
                  />
                  <div>
                    <p className="text-xs font-semibold text-white">
                      Permitir Fechamento pelo Usuário
                    </p>
                    <p className="text-[11px] text-[var(--color-subtle)]">
                      Exibe o botão &apos;X&apos; para ocultar o aviso na sessão atual.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notice_content" className="text-xs font-semibold text-zinc-200">
                Mensagem do Comunicado
              </Label>
              <Textarea
                id="notice_content"
                value={settings.notice_content}
                onChange={(e) => updateField("notice_content", e.target.value)}
                rows={2}
                maxLength={1000}
                className="studio-input resize-none text-xs leading-relaxed"
                placeholder="Descreva o comunicado ou instrução para os visitantes..."
              />
            </div>

            {/* Prévia em Tempo Real */}
            <div className="space-y-3 border-t border-[var(--studio-line)] pt-5">
              <div className="flex items-center justify-between">
                <h3 className="studio-kicker">Prévia em Tempo Real</h3>
                <span className="studio-mono text-[10px] text-[var(--color-muted)]">
                  {settings.notice_enabled ? "Visível no Topo" : "Oculto no Momento"}
                </span>
              </div>

              <div className="overflow-hidden rounded-xl border border-[var(--studio-line)] bg-[var(--studio-canvas)] p-2">
                <div
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-xs",
                    {
                      "border-violet-500/35 bg-violet-950/35 text-violet-100":
                        settings.notice_type === "info",
                      "border-amber-500/35 bg-amber-950/35 text-amber-100":
                        settings.notice_type === "warning",
                      "border-rose-500/35 bg-rose-950/35 text-rose-100":
                        settings.notice_type === "maintenance",
                      "border-emerald-500/35 bg-emerald-950/35 text-emerald-100":
                        settings.notice_type === "success",
                    },
                  )}
                >
                  <div className="flex items-center gap-3">
                    {settings.notice_type === "info" && <Info className="size-4 shrink-0 text-violet-300" />}
                    {settings.notice_type === "warning" && <AlertTriangle className="size-4 shrink-0 text-amber-400" />}
                    {settings.notice_type === "maintenance" && <Wrench className="size-4 shrink-0 text-rose-400" />}
                    {settings.notice_type === "success" && <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />}
                    <div>
                      {settings.notice_title && (
                        <span className="mr-2 font-semibold text-white">
                          {settings.notice_title} ·
                        </span>
                      )}
                      <span>{settings.notice_content || "Nenhuma mensagem definida."}</span>
                    </div>
                  </div>

                  {settings.notice_dismissible && (
                    <button
                      type="button"
                      className="rounded p-1 text-white/60 hover:text-white"
                      title="Fechar prévia"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </StudioPanel>
        )}

        {/* ABA 4: RECURSOS E MÓDULOS */}
        {activeTab === "modules" && (
          <StudioPanel
            title="Recursos e Módulos Globais"
            description="Ative ou desative seções existentes no Hikari. Alterações entram em vigor imediatamente para visitantes e usuários."
            icon={<Layers className="size-4" />}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div
                className={cn(
                  "flex flex-col justify-between rounded-xl border p-5 transition-colors",
                  settings.module_comments_enabled
                    ? "border-[var(--studio-accent-border)] bg-[var(--studio-accent-soft)]"
                    : "border-[var(--studio-line)] bg-[var(--studio-panel-alt)] opacity-80",
                )}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="grid size-9 place-items-center rounded-lg border border-[var(--studio-line)] bg-[var(--studio-panel)] text-violet-300">
                        <MessageSquare className="size-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-white">
                          Comentários da Comunidade
                        </h3>
                        <span className="studio-mono text-[10px] text-violet-300">
                          module_comments_enabled
                        </span>
                      </div>
                    </div>

                    <input
                      type="checkbox"
                      aria-label="Ativar Comentários da Comunidade"
                      checked={settings.module_comments_enabled}
                      onChange={(e) =>
                        updateField("module_comments_enabled", e.target.checked)
                      }
                      className="size-4 cursor-pointer rounded accent-violet-600"
                    />
                  </div>

                  <p className="text-xs leading-relaxed text-[var(--color-muted)]">
                    Permite que visitantes e membros enviem comentários,
                    respostas e reações nos episódios. Quando desativado, exibe
                    um aviso de pausa pela moderação.
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-[var(--studio-line)] pt-3 text-[11px]">
                  <span className="text-[var(--color-subtle)]">Status Atual:</span>
                  <span
                    className={cn(
                      "studio-mono font-semibold",
                      settings.module_comments_enabled ? "text-emerald-400" : "text-rose-400",
                    )}
                  >
                    {settings.module_comments_enabled ? "Ativo" : "Pausado"}
                  </span>
                </div>
              </div>

              <div
                className={cn(
                  "flex flex-col justify-between rounded-xl border p-5 transition-colors",
                  settings.module_ai_enabled
                    ? "border-[var(--studio-accent-border)] bg-[var(--studio-accent-soft)]"
                    : "border-[var(--studio-line)] bg-[var(--studio-panel-alt)] opacity-80",
                )}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="grid size-9 place-items-center rounded-lg border border-[var(--studio-line)] bg-[var(--studio-panel)] text-violet-300">
                        <Sparkles className="size-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-white">
                          Hikari AI Assist
                        </h3>
                        <span className="studio-mono text-[10px] text-violet-300">
                          module_ai_enabled
                        </span>
                      </div>
                    </div>

                    <input
                      type="checkbox"
                      aria-label="Ativar Hikari AI Assist"
                      checked={settings.module_ai_enabled}
                      onChange={(e) =>
                        updateField("module_ai_enabled", e.target.checked)
                      }
                      className="size-4 cursor-pointer rounded accent-violet-600"
                    />
                  </div>

                  <p className="text-xs leading-relaxed text-[var(--color-muted)]">
                    Habilita análises inteligentes, resumos automáticos de
                    episódios e recomendações assistidas por inteligência
                    artificial no ecossistema.
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-[var(--studio-line)] pt-3 text-[11px]">
                  <span className="text-[var(--color-subtle)]">Status Atual:</span>
                  <span
                    className={cn(
                      "studio-mono font-semibold",
                      settings.module_ai_enabled ? "text-emerald-400" : "text-rose-400",
                    )}
                  >
                    {settings.module_ai_enabled ? "Ativo" : "Desativado"}
                  </span>
                </div>
              </div>

              <div
                className={cn(
                  "flex flex-col justify-between rounded-xl border p-5 transition-colors",
                  settings.module_adult_enabled
                    ? "border-[var(--studio-accent-border)] bg-[var(--studio-accent-soft)]"
                    : "border-[var(--studio-line)] bg-[var(--studio-panel-alt)] opacity-80",
                )}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="grid size-9 place-items-center rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-300">
                        <ShieldAlert className="size-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-white">
                          Seção Adulto / 18+
                        </h3>
                        <span className="studio-mono text-[10px] text-rose-400">
                          module_adult_enabled
                        </span>
                      </div>
                    </div>

                    <input
                      type="checkbox"
                      aria-label="Ativar Seção Adulto 18+"
                      checked={settings.module_adult_enabled}
                      onChange={(e) =>
                        updateField("module_adult_enabled", e.target.checked)
                      }
                      className="size-4 cursor-pointer rounded accent-violet-600"
                    />
                  </div>

                  <p className="text-xs leading-relaxed text-[var(--color-muted)]">
                    Disponibiliza o catálogo de animes adultos e o feed de
                    notícias especializadas. Quando desativado, o acesso 18+ é
                    omitido das buscas e menus.
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-[var(--studio-line)] pt-3 text-[11px]">
                  <span className="text-[var(--color-subtle)]">Status Atual:</span>
                  <span
                    className={cn(
                      "studio-mono font-semibold",
                      settings.module_adult_enabled ? "text-emerald-400" : "text-rose-400",
                    )}
                  >
                    {settings.module_adult_enabled ? "Ativo" : "Oculto"}
                  </span>
                </div>
              </div>

              <div
                className={cn(
                  "flex flex-col justify-between rounded-xl border p-5 transition-colors",
                  settings.module_calendar_enabled
                    ? "border-[var(--studio-accent-border)] bg-[var(--studio-accent-soft)]"
                    : "border-[var(--studio-line)] bg-[var(--studio-panel-alt)] opacity-80",
                )}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="grid size-9 place-items-center rounded-lg border border-[var(--studio-line)] bg-[var(--studio-panel)] text-violet-300">
                        <CalendarDays className="size-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-white">
                          Grade Semanal &amp; Calendário
                        </h3>
                        <span className="studio-mono text-[10px] text-violet-300">
                          module_calendar_enabled
                        </span>
                      </div>
                    </div>

                    <input
                      type="checkbox"
                      aria-label="Ativar Grade Semanal e Calendário"
                      checked={settings.module_calendar_enabled}
                      onChange={(e) =>
                        updateField("module_calendar_enabled", e.target.checked)
                      }
                      className="size-4 cursor-pointer rounded accent-violet-600"
                    />
                  </div>

                  <p className="text-xs leading-relaxed text-[var(--color-muted)]">
                    Exibe o link e a página do Calendário com a programação de
                    lançamentos semanais sincronizados com a TV japonesa.
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-[var(--studio-line)] pt-3 text-[11px]">
                  <span className="text-[var(--color-subtle)]">Status Atual:</span>
                  <span
                    className={cn(
                      "studio-mono font-semibold",
                      settings.module_calendar_enabled ? "text-emerald-400" : "text-rose-400",
                    )}
                  >
                    {settings.module_calendar_enabled ? "Ativo no Menu" : "Oculto"}
                  </span>
                </div>
              </div>
            </div>
          </StudioPanel>
        )}
      </div>

      {/* Confirmação Explícita para Sincronização Manual Real */}
      <Dialog
        open={confirmSyncOpen}
        onOpenChange={(open) => {
          if (!startingSync) setConfirmSyncOpen(open);
        }}
      >
        <DialogContent className="hikari-studio-dialog border border-white/[0.08] bg-[#12101e] text-zinc-100 shadow-2xl sm:max-w-md">
          <div className="flex items-start gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-violet-500/30 bg-violet-500/15 text-violet-300">
              <RefreshCw className="size-5" />
            </div>
            <div className="min-w-0 pr-6">
              <DialogTitle className="font-display text-lg font-bold text-zinc-100">
                Confirmar Sincronização AniList
              </DialogTitle>
              <DialogDescription className="mt-1 text-xs leading-relaxed text-zinc-400">
                {syncStatus?.incomplete && syncStatus.checkpoint
                  ? `Existe um checkpoint pendente na etapa "${getSyncStageLabel(syncStatus.checkpoint.stage)}" (página ${syncStatus.checkpoint.page}). A sincronização retomará deste ponto sem duplicar registros.`
                  : syncStatus?.initialCompleted
                    ? "Será iniciada uma sincronização incremental real com a AniList para atualizar catálogo, temporadas, calendário e invalidar caches Redis."
                    : "Será iniciada a carga inicial real do catálogo, temporadas e calendário da AniList para o Neon PostgreSQL."}
              </DialogDescription>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-white/[0.08] bg-[#161226] px-3.5 py-2.5 text-[11px] leading-relaxed text-zinc-300">
            Todos os títulos, sinopses, capas e banners editados manualmente no painel
            continuarão protegidos por <span className="studio-mono text-violet-300">manual_fields</span>.
          </div>

          <div className="mt-5 flex flex-col-reverse gap-2 border-t border-white/[0.08] pt-4 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={startingSync}
              onClick={() => setConfirmSyncOpen(false)}
              className="h-9 border-white/[0.08] bg-[#161226] text-xs text-zinc-300 hover:bg-[#1f1a36]"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={startingSync}
              onClick={() => void handleConfirmStartSync()}
              className="h-9 gap-2 bg-violet-600 px-4 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
            >
              {startingSync ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Iniciando...</span>
                </>
              ) : (
                <>
                  <Play className="size-3.5" />
                  <span>Confirmar e Sincronizar</span>
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
