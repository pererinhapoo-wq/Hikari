import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CalendarDays,
  CheckCircle2,
  Globe,
  Info,
  Layers,
  Loader2,
  MessageSquare,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Wrench,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getBearerToken } from "@/lib/auth/client";
import {
  type HikariAdminSettings,
  DEFAULT_ADMIN_SETTINGS,
} from "@/lib/settings/settings-types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/settings")({
  component: AdminSettingsPage,
});

type SettingsTab = "identity" | "preferences" | "notices" | "modules";

function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("identity");
  const [settings, setSettings] =
    useState<HikariAdminSettings>(DEFAULT_ADMIN_SETTINGS);
  const [savedSettings, setSavedSettings] =
    useState<HikariAdminSettings>(DEFAULT_ADMIN_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Carrega configurações do servidor
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
  }, []);

  // Detecta alterações não salvas
  const isDirty = useMemo(() => {
    return JSON.stringify(settings) !== JSON.stringify(savedSettings);
  }, [settings, savedSettings]);

  // Atualiza um campo específico
  const updateField = <K extends keyof HikariAdminSettings>(
    key: K,
    value: HikariAdminSettings[K],
  ) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  // Salva no Neon PostgreSQL via /api/admin/settings
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

  // Desfaz alterações voltando ao estado salvo
  const handleReset = () => {
    setSettings(savedSettings);
    toast.info("Alterações descartadas.");
  };

  if (loading) {
    return (
      <div className="studio-enter flex min-h-[400px] flex-col items-center justify-center gap-3">
        <Loader2 className="size-8 animate-spin text-purple-400" />
        <p className="studio-mono text-xs text-[var(--color-muted)]">
          Carregando configurações do PostgreSQL...
        </p>
      </div>
    );
  }

  return (
    <div className="studio-enter space-y-6 pb-12">
      {/* CABEÇALHO */}
      <header className="flex flex-col gap-4 border-b border-white/[0.075] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            to="/admin"
            className="group inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
          >
            <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
            <span>Voltar à Visão Geral</span>
          </Link>

          <div className="mt-3 flex items-center gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-purple-500/30 bg-purple-500/12 text-purple-300">
              <SlidersHorizontal className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="studio-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-purple-400">
                  Sistema & Governança
                </p>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                  <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  admin_settings
                </span>
              </div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--color-fg)] sm:text-3xl">
                Configurações Gerais
              </h1>
            </div>
          </div>

          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-[var(--color-muted)] sm:text-sm">
            Gerencie a identidade visual e institucional, preferências de
            exibição e reprodução, avisos aos visitantes e ativação de módulos
            globais do Hikari.
          </p>
        </div>

        {/* Ações Globais */}
        <div className="flex flex-wrap items-center gap-2.5">
          {isDirty && (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-300">
              <span className="size-2 rounded-full bg-amber-400 animate-ping" />
              Alterações não salvas
            </span>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={!isDirty || saving}
            className="gap-1.5 border-white/10 text-xs text-[var(--color-muted)] hover:text-white"
          >
            <RotateCcw className="size-3.5" />
            <span>Descartar</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadSettings()}
            disabled={saving}
            className="gap-1.5 border-white/10 text-xs text-[var(--color-muted)] hover:text-white"
            title="Recarregar do banco"
          >
            <RefreshCw className="size-3.5" />
          </Button>

          <Button
            size="sm"
            onClick={handleSave}
            disabled={!isDirty || saving}
            className="gap-2 bg-purple-600 px-4 text-xs font-semibold text-white shadow-lg shadow-purple-900/30 hover:bg-purple-500 disabled:opacity-40"
          >
            {saving ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>Gravando no PostgreSQL...</span>
              </>
            ) : (
              <>
                <Save className="size-3.5" />
                <span>Salvar Configurações</span>
              </>
            )}
          </Button>
        </div>
      </header>

      {/* NAVEGAÇÃO POR ABAS */}
      <div className="flex gap-2 overflow-x-auto border-b border-white/[0.075] pb-2 scrollbar-none">
        {[
          { id: "identity" as const, label: "Identidade & Marca", icon: Building2 },
          { id: "preferences" as const, label: "Preferências Globais", icon: Globe },
          { id: "notices" as const, label: "Avisos & Comunicados", icon: AlertTriangle },
          { id: "modules" as const, label: "Recursos & Módulos", icon: Layers },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all select-none whitespace-nowrap",
                isActive
                  ? "bg-purple-600/15 text-purple-300 ring-1 ring-purple-500/40 shadow-[0_0_15px_rgba(168,85,247,0.15)]"
                  : "text-[var(--color-muted)] hover:bg-white/[0.04] hover:text-[var(--color-fg)]",
              )}
            >
              <Icon className="size-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* CONTEÚDO DAS ABAS */}
      <div className="space-y-6">
        {/* ========================================================
            ABA 1: IDENTIDADE E INFORMAÇÕES DO SITE
        ========================================================= */}
        {activeTab === "identity" && (
          <div className="grid gap-6">
            <div className="studio-panel rounded-2xl p-5 sm:p-6 space-y-6">
              <div className="border-b border-white/[0.06] pb-4">
                <h2 className="font-display text-lg font-semibold text-[var(--color-fg)]">
                  Identidade da Plataforma
                </h2>
                <p className="text-xs text-[var(--color-muted)] mt-1">
                  Defina o nome canônico, slogan e descrições institucionais que
                  alimentam o cabeçalho, rodapé e metadados.
                </p>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="site_name" className="text-xs font-semibold text-zinc-300">
                    Nome da Plataforma
                  </Label>
                  <Input
                    id="site_name"
                    value={settings.site_name}
                    onChange={(e) => updateField("site_name", e.target.value)}
                    placeholder="Hikari"
                    className="bg-black/30 border-white/10 text-white"
                  />
                  <p className="text-[11px] text-[var(--color-subtle)]">
                    Exibido na tag &lt;title&gt;, no cabeçalho e na identificação pública.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="site_slogan" className="text-xs font-semibold text-zinc-300">
                    Slogan Institucional
                  </Label>
                  <Input
                    id="site_slogan"
                    value={settings.site_slogan}
                    onChange={(e) => updateField("site_slogan", e.target.value)}
                    placeholder="Seu portal definitivo para streaming e catálogo de animes"
                    className="bg-black/30 border-white/10 text-white"
                  />
                  <p className="text-[11px] text-[var(--color-subtle)]">
                    Exibido no rodapé e subtítulo da página inicial.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="site_description" className="text-xs font-semibold text-zinc-300">
                    Descrição Institucional
                  </Label>
                  <span className="text-[10px] studio-mono text-[var(--color-subtle)]">
                    {settings.site_description.length}/500
                  </span>
                </div>
                <Textarea
                  id="site_description"
                  value={settings.site_description}
                  onChange={(e) => updateField("site_description", e.target.value)}
                  rows={3}
                  maxLength={500}
                  className="bg-black/30 border-white/10 text-white resize-none text-xs leading-relaxed"
                  placeholder="Descrição institucional do catálogo e comunidade..."
                />
                <p className="text-[11px] text-[var(--color-subtle)]">
                  Utilizada nas meta-tags e nos textos explicativos do rodapé.
                </p>
              </div>

              <div className="grid gap-5 sm:grid-cols-2 border-t border-white/[0.06] pt-5">
                <div className="space-y-2">
                  <Label htmlFor="site_contact_email" className="text-xs font-semibold text-zinc-300">
                    E-mail Oficial de Contato
                  </Label>
                  <Input
                    id="site_contact_email"
                    type="email"
                    value={settings.site_contact_email}
                    onChange={(e) => updateField("site_contact_email", e.target.value)}
                    placeholder="contato@hikari.tv"
                    className="bg-black/30 border-white/10 text-white"
                  />
                  <p className="text-[11px] text-[var(--color-subtle)]">
                    Canal oficial para suporte, denúncias e solicitações.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="site_favicon_url" className="text-xs font-semibold text-zinc-300">
                    Ícone / Favicon URL
                  </Label>
                  <div className="flex gap-3 items-center">
                    <Input
                      id="site_favicon_url"
                      value={settings.site_favicon_url}
                      onChange={(e) => updateField("site_favicon_url", e.target.value)}
                      placeholder="/favicon.svg"
                      className="bg-black/30 border-white/10 text-white font-mono text-xs"
                    />
                    <div className="grid size-11 shrink-0 place-items-center rounded-lg border border-white/10 bg-black/40">
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
            </div>
          </div>
        )}

        {/* ========================================================
            ABA 2: PREFERÊNCIAS GERAIS
        ========================================================= */}
        {activeTab === "preferences" && (
          <div className="grid gap-6">
            <div className="studio-panel rounded-2xl p-5 sm:p-6 space-y-6">
              <div className="border-b border-white/[0.06] pb-4">
                <h2 className="font-display text-lg font-semibold text-[var(--color-fg)]">
                  Preferências Globais da Plataforma
                </h2>
                <p className="text-xs text-[var(--color-muted)] mt-1">
                  Configure o idioma padrão da interface, a apresentação dos
                  títulos dos animes e o comportamento padrão de reprodução.
                </p>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="default_language" className="text-xs font-semibold text-zinc-300">
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
                    className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-purple-400"
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
                  <Label htmlFor="preferred_title_language" className="text-xs font-semibold text-zinc-300">
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
                    className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-purple-400"
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

              <div className="border-t border-white/[0.06] pt-5 space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-purple-400 studio-mono">
                  Comportamento do Player de Vídeo
                </h3>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/20 p-4 transition-colors hover:bg-white/[0.03] cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={settings.player_autoplay_default}
                      onChange={(e) => updateField("player_autoplay_default", e.target.checked)}
                      className="mt-0.5 size-4 rounded accent-purple-600"
                    />
                    <div>
                      <p className="text-xs font-semibold text-white">Autoplay Padrão</p>
                      <p className="mt-0.5 text-[11px] text-[var(--color-muted)] leading-relaxed">
                        Inicia a reprodução do episódio automaticamente ao carregar a página de transmissão.
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/20 p-4 transition-colors hover:bg-white/[0.03] cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={settings.player_auto_next_default}
                      onChange={(e) => updateField("player_auto_next_default", e.target.checked)}
                      className="mt-0.5 size-4 rounded accent-purple-600"
                    />
                    <div>
                      <p className="text-xs font-semibold text-white">Avanço Automático (Auto-Next)</p>
                      <p className="mt-0.5 text-[11px] text-[var(--color-muted)] leading-relaxed">
                        Transiciona suavemente para o próximo episódio ao finalizar a reprodução do atual.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="border-t border-white/[0.06] pt-5">
                <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/20 p-4 transition-colors hover:bg-white/[0.03] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={settings.allow_adult_content}
                    onChange={(e) => updateField("allow_adult_content", e.target.checked)}
                    className="mt-0.5 size-4 rounded accent-purple-600"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold text-white">
                        Habilitar Modo Adulto (18+) no Catálogo
                      </p>
                      <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[9px] font-bold text-rose-300 border border-rose-500/30">
                        18+
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-[var(--color-muted)] leading-relaxed">
                      Permite que usuários maiores de idade alternem para o modo adulto na busca e navegação.
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            ABA 3: AVISOS E COMUNICADOS
        ========================================================= */}
        {activeTab === "notices" && (
          <div className="grid gap-6">
            <div className="studio-panel rounded-2xl p-5 sm:p-6 space-y-6">
              <div className="flex flex-col gap-2 border-b border-white/[0.06] pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-display text-lg font-semibold text-[var(--color-fg)]">
                    Comunicado Global aos Visitantes
                  </h2>
                  <p className="text-xs text-[var(--color-muted)] mt-1">
                    Exiba uma faixa no topo da plataforma com comunicados
                    oficiais, alertas de manutenção ou avisos importantes.
                  </p>
                </div>

                {/* Interruptor Liga/Desliga */}
                <label className="inline-flex items-center gap-3 rounded-xl border border-purple-500/30 bg-purple-500/10 px-4 py-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={settings.notice_enabled}
                    onChange={(e) => updateField("notice_enabled", e.target.checked)}
                    className="size-4 rounded accent-purple-600"
                  />
                  <span className="text-xs font-semibold text-purple-200">
                    {settings.notice_enabled ? "Aviso Ativado no Site" : "Aviso Desativado"}
                  </span>
                </label>
              </div>

              {/* Seletor do Tipo de Aviso */}
              <div className="space-y-3">
                <Label className="text-xs font-semibold text-zinc-300">
                  Tipo de Comunicado
                </Label>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    {
                      id: "info" as const,
                      label: "Informativo",
                      icon: Info,
                      color: "border-purple-500/40 text-purple-300 bg-purple-950/30",
                    },
                    {
                      id: "warning" as const,
                      label: "Atenção",
                      icon: AlertTriangle,
                      color: "border-amber-500/40 text-amber-300 bg-amber-950/30",
                    },
                    {
                      id: "maintenance" as const,
                      label: "Manutenção",
                      icon: Wrench,
                      color: "border-rose-500/40 text-rose-300 bg-rose-950/30",
                    },
                    {
                      id: "success" as const,
                      label: "Sucesso / Concluído",
                      icon: CheckCircle2,
                      color: "border-emerald-500/40 text-emerald-300 bg-emerald-950/30",
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
                          "flex items-center gap-2.5 rounded-xl border p-3 text-xs font-medium transition-all text-left",
                          isSelected
                            ? `${item.color} ring-1 ring-white/20 shadow-lg`
                            : "border-white/10 bg-black/20 text-zinc-400 hover:border-white/20 hover:text-white",
                        )}
                      >
                        <Icon className="size-4 shrink-0" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Título e Conteúdo do Aviso */}
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="notice_title" className="text-xs font-semibold text-zinc-300">
                    Título do Comunicado
                  </Label>
                  <Input
                    id="notice_title"
                    value={settings.notice_title}
                    onChange={(e) => updateField("notice_title", e.target.value)}
                    placeholder="Ex: Manutenção Programada"
                    className="bg-black/30 border-white/10 text-white"
                  />
                </div>

                <div className="flex items-center pt-6">
                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={settings.notice_dismissible}
                      onChange={(e) => updateField("notice_dismissible", e.target.checked)}
                      className="size-4 rounded accent-purple-600"
                    />
                    <div>
                      <p className="text-xs font-semibold text-white">
                        Permitir Fechamento pelo Usuário
                      </p>
                      <p className="text-[11px] text-[var(--color-subtle)]">
                        Exibe o botão 'X' para ocultar o aviso na sessão atual.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notice_content" className="text-xs font-semibold text-zinc-300">
                  Mensagem do Comunicado
                </Label>
                <Textarea
                  id="notice_content"
                  value={settings.notice_content}
                  onChange={(e) => updateField("notice_content", e.target.value)}
                  rows={2}
                  maxLength={1000}
                  className="bg-black/30 border-white/10 text-white resize-none text-xs leading-relaxed"
                  placeholder="Descreva o comunicado ou instrução para os visitantes..."
                />
              </div>

              {/* PRÉVIA EM TEMPO REAL */}
              <div className="border-t border-white/[0.06] pt-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-purple-400 studio-mono">
                    Prévia em Tempo Real (Como os visitantes verão)
                  </h3>
                  <span className="text-[10px] text-zinc-400">
                    {settings.notice_enabled ? "Visível no Topo" : "Oculto no Momento"}
                  </span>
                </div>

                <div className="overflow-hidden rounded-xl border border-white/10 bg-black/40 p-1">
                  <div
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-xs",
                      {
                        "border-purple-500/30 bg-purple-950/40 text-purple-200":
                          settings.notice_type === "info",
                        "border-amber-500/35 bg-amber-950/40 text-amber-100":
                          settings.notice_type === "warning",
                        "border-rose-500/35 bg-rose-950/40 text-rose-100":
                          settings.notice_type === "maintenance",
                        "border-emerald-500/35 bg-emerald-950/40 text-emerald-100":
                          settings.notice_type === "success",
                      },
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {settings.notice_type === "info" && <Info className="size-4 shrink-0 text-purple-400" />}
                      {settings.notice_type === "warning" && <AlertTriangle className="size-4 shrink-0 text-amber-400" />}
                      {settings.notice_type === "maintenance" && <Wrench className="size-4 shrink-0 text-rose-400" />}
                      {settings.notice_type === "success" && <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />}
                      <div>
                        {settings.notice_title && (
                          <span className="font-semibold text-white mr-2">
                            {settings.notice_title} •
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
            </div>
          </div>
        )}

        {/* ========================================================
            ABA 4: RECURSOS E MÓDULOS
        ========================================================= */}
        {activeTab === "modules" && (
          <div className="grid gap-6">
            <div className="studio-panel rounded-2xl p-5 sm:p-6 space-y-6">
              <div className="border-b border-white/[0.06] pb-4">
                <h2 className="font-display text-lg font-semibold text-[var(--color-fg)]">
                  Recursos e Módulos Globais
                </h2>
                <p className="text-xs text-[var(--color-muted)] mt-1">
                  Ative ou desative seções e recursos existentes no Hikari.
                  Desativações entram em vigor imediatamente para visitantes e
                  usuários comuns.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {/* Módulo de Comentários */}
                <div
                  className={cn(
                    "flex flex-col justify-between rounded-xl border p-5 transition-all",
                    settings.module_comments_enabled
                      ? "border-purple-500/30 bg-purple-950/15"
                      : "border-white/10 bg-black/20 opacity-75",
                  )}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="grid size-9 place-items-center rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-300">
                          <MessageSquare className="size-4" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-white">
                            Comentários da Comunidade
                          </h3>
                          <span className="text-[10px] studio-mono text-purple-400">
                            module_comments_enabled
                          </span>
                        </div>
                      </div>

                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.module_comments_enabled}
                          onChange={(e) =>
                            updateField("module_comments_enabled", e.target.checked)
                          }
                          className="size-4 rounded accent-purple-600"
                        />
                      </label>
                    </div>

                    <p className="text-xs text-[var(--color-muted)] leading-relaxed">
                      Permite que visitantes e membros enviem comentários,
                      respostas e reações nos episódios. Quando desativado, exibe
                      um aviso amigável de pausa pela moderação.
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-[11px]">
                    <span className="text-[var(--color-subtle)]">Status Atual:</span>
                    <span
                      className={cn(
                        "font-semibold",
                        settings.module_comments_enabled
                          ? "text-emerald-400"
                          : "text-rose-400",
                      )}
                    >
                      {settings.module_comments_enabled ? "Ativo" : "Pausado"}
                    </span>
                  </div>
                </div>

                {/* Módulo Hikari AI */}
                <div
                  className={cn(
                    "flex flex-col justify-between rounded-xl border p-5 transition-all",
                    settings.module_ai_enabled
                      ? "border-purple-500/30 bg-purple-950/15"
                      : "border-white/10 bg-black/20 opacity-75",
                  )}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="grid size-9 place-items-center rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-300">
                          <Sparkles className="size-4" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-white">
                            Hikari AI Assist
                          </h3>
                          <span className="text-[10px] studio-mono text-purple-400">
                            module_ai_enabled
                          </span>
                        </div>
                      </div>

                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.module_ai_enabled}
                          onChange={(e) =>
                            updateField("module_ai_enabled", e.target.checked)
                          }
                          className="size-4 rounded accent-purple-600"
                        />
                      </label>
                    </div>

                    <p className="text-xs text-[var(--color-muted)] leading-relaxed">
                      Habilita as análises inteligentes, resumos automáticos de
                      episódios e recomendações assistidas por inteligência
                      artificial no ecossistema.
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-[11px]">
                    <span className="text-[var(--color-subtle)]">Status Atual:</span>
                    <span
                      className={cn(
                        "font-semibold",
                        settings.module_ai_enabled
                          ? "text-emerald-400"
                          : "text-rose-400",
                      )}
                    >
                      {settings.module_ai_enabled ? "Ativo" : "Desativado"}
                    </span>
                  </div>
                </div>

                {/* Módulo Adulto / 18+ */}
                <div
                  className={cn(
                    "flex flex-col justify-between rounded-xl border p-5 transition-all",
                    settings.module_adult_enabled
                      ? "border-purple-500/30 bg-purple-950/15"
                      : "border-white/10 bg-black/20 opacity-75",
                  )}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="grid size-9 place-items-center rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-300">
                          <ShieldAlert className="size-4" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-white">
                            Seção Adulto / 18+
                          </h3>
                          <span className="text-[10px] studio-mono text-rose-400">
                            module_adult_enabled
                          </span>
                        </div>
                      </div>

                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.module_adult_enabled}
                          onChange={(e) =>
                            updateField("module_adult_enabled", e.target.checked)
                          }
                          className="size-4 rounded accent-purple-600"
                        />
                      </label>
                    </div>

                    <p className="text-xs text-[var(--color-muted)] leading-relaxed">
                      Disponibiliza o catálogo de animes adultos e o feed de
                      notícias especializadas. Quando desativado, o acesso ao
                      conteúdo 18+ é omitido das buscas e menus.
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-[11px]">
                    <span className="text-[var(--color-subtle)]">Status Atual:</span>
                    <span
                      className={cn(
                        "font-semibold",
                        settings.module_adult_enabled
                          ? "text-emerald-400"
                          : "text-rose-400",
                      )}
                    >
                      {settings.module_adult_enabled ? "Ativo" : "Oculto"}
                    </span>
                  </div>
                </div>

                {/* Módulo Calendário Semanal */}
                <div
                  className={cn(
                    "flex flex-col justify-between rounded-xl border p-5 transition-all",
                    settings.module_calendar_enabled
                      ? "border-purple-500/30 bg-purple-950/15"
                      : "border-white/10 bg-black/20 opacity-75",
                  )}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="grid size-9 place-items-center rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-300">
                          <CalendarDays className="size-4" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-white">
                            Grade Semanal & Calendário
                          </h3>
                          <span className="text-[10px] studio-mono text-purple-400">
                            module_calendar_enabled
                          </span>
                        </div>
                      </div>

                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.module_calendar_enabled}
                          onChange={(e) =>
                            updateField("module_calendar_enabled", e.target.checked)
                          }
                          className="size-4 rounded accent-purple-600"
                        />
                      </label>
                    </div>

                    <p className="text-xs text-[var(--color-muted)] leading-relaxed">
                      Exibe o link e a página do Calendário com a programação de
                      lançamentos semanais dos animes sincronizados com a TV
                      japonesa.
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-[11px]">
                    <span className="text-[var(--color-subtle)]">Status Atual:</span>
                    <span
                      className={cn(
                        "font-semibold",
                        settings.module_calendar_enabled
                          ? "text-emerald-400"
                          : "text-rose-400",
                      )}
                    >
                      {settings.module_calendar_enabled ? "Ativo no Menu" : "Oculto"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
