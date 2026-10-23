import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ChevronLeft,
  RotateCcw,
  Save,
  Sliders,
  Smartphone,
  Monitor,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DEFAULT_BANNER_SETTINGS,
  type AdminBannerSettings,
  getCachedAdminBannerSettings,
  setCachedAdminBannerSettings,
  sanitizeBannerSettings,
} from "@/lib/banner-settings";

export const Route = createFileRoute("/admin/banner")({
  component: AdminBannerPage,
});

interface SampleAnime {
  id: string;
  title: string;
  banner: string;
  cover: string;
  year: number;
}

const SAMPLE_ANIMES: SampleAnime[] = [
  {
    id: "195516",
    title: "Kusuriya no Hitorigoto 2nd Season",
    banner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/176595-zJ9lU7f6N8jP.jpg",
    cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx176595-sI6v2a5XpM7n.jpg",
    year: 2025,
  },
  {
    id: "21",
    title: "One Piece",
    banner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/21-wf37VakJ5Amb.jpg",
    cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx21-YCDuy1vdjl24.jpg",
    year: 1999,
  },
  {
    id: "154587",
    title: "Sousou no Frieren",
    banner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/154587-ivXNJ23SM1xB.jpg",
    cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx154587-n6hrHvlJ5afm.jpg",
    year: 2023,
  },
];

function AdminBannerPage() {
  const [settings, setSettings] = useState<AdminBannerSettings>(
    () => getCachedAdminBannerSettings(),
  );
  const [mode, setMode] = useState<"mobile" | "desktop">("mobile");
  const [selectedSample, setSelectedSample] = useState<SampleAnime>(SAMPLE_ANIMES[0]);
  const [saving, setSaving] = useState(false);
  const [loadedFromServer, setLoadedFromServer] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Carrega configurações persistidas no servidor
  useEffect(() => {
    let active = true;

    async function loadSettings() {
      try {
        const res = await fetch("/api/admin/banner-settings", {
          method: "GET",
          credentials: "include",
        });

        if (!res.ok) {
          throw new Error("Não foi possível carregar configurações.");
        }

        const data = (await res.json()) as {
          settings?: AdminBannerSettings;
        };

        if (active && data.settings) {
          const sanitized = sanitizeBannerSettings(data.settings);
          setSettings(sanitized);
          setCachedAdminBannerSettings(sanitized);
          setLoadedFromServer(true);
        }
      } catch (err) {
        console.warn("Usando configurações em cache local:", err);
      }
    }

    void loadSettings();
    return () => {
      active = false;
    };
  }, []);

  const currentModeSettings = settings[mode];

  function updateCurrentMode(field: "posX" | "posY" | "zoom", val: number) {
    setSettings((prev) => {
      const next = {
        ...prev,
        [mode]: {
          ...prev[mode],
          [field]: val,
        },
      };
      setCachedAdminBannerSettings(next);
      return next;
    });
    setHasChanges(true);
  }

  function handleReset() {
    setSettings((prev) => {
      const next = {
        ...prev,
        [mode]: { ...DEFAULT_BANNER_SETTINGS[mode] },
      };
      setCachedAdminBannerSettings(next);
      return next;
    });
    setHasChanges(true);
    toast.success(`Ajustes de ${mode === "mobile" ? "celular" : "desktop"} restaurados para o padrão.`);
  }

  function handleResetAll() {
    setSettings({ ...DEFAULT_BANNER_SETTINGS });
    setCachedAdminBannerSettings(DEFAULT_BANNER_SETTINGS);
    setHasChanges(true);
    toast.success("Todos os enquadramentos foram restaurados para o padrão.");
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/banner-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ settings }),
      });

      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? "Erro ao salvar no servidor.");
      }

      setCachedAdminBannerSettings(settings);
      setHasChanges(false);
      toast.success("Ajustes do banner salvos com sucesso na sua conta!");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Falha ao salvar preferências.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8 pt-6 pb-16">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            to="/admin"
            className="inline-flex items-center gap-1 text-xs text-muted hover:text-fg"
          >
            <ChevronLeft className="size-3.5" />
            Painel Admin
          </Link>

          <p className="mt-4 text-[11px] tracking-[0.28em] text-purple-400 uppercase">
            Personalização Privada
          </p>

          <h1 className="mt-1 font-display text-3xl tracking-tight">
            Personalizar banner dos animes
          </h1>

          <p className="mt-1 max-w-2xl text-sm text-muted">
            Ajuste o posicionamento e o zoom dos banners de fundo exclusivos das páginas
            de detalhes dos animes. Essas preferências são associadas à sua conta administrativa
            e não alteram a visualização dos demais visitantes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleReset}
            className="text-xs"
          >
            <RotateCcw className="size-3.5" />
            Restaurar padrão ({mode === "mobile" ? "celular" : "desktop"})
          </Button>

          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="bg-purple-600 hover:bg-purple-500 text-white shadow-[0_0_20px_rgba(168,85,247,0.3)]"
          >
            <Save className="size-4" />
            {saving ? "Salvando…" : "Salvar ajustes"}
          </Button>
        </div>
      </header>

      {/* SELEÇÃO DE DISPOSITIVO / MODO */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* COLUNA ESQUERDA: CONTROLES */}
        <div className="lg:col-span-5 space-y-6">
          {/* Seletor de modo Celular / Desktop */}
          <div className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)] space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                Modo de exibição
              </span>
              <span className="text-[11px] text-purple-400 font-medium">
                Ajustes independentes
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 bg-elevated p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setMode("mobile")}
                className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all ${
                  mode === "mobile"
                    ? "bg-purple-600 text-white shadow-md shadow-purple-900/30"
                    : "text-muted hover:text-fg hover:bg-surface/50"
                }`}
              >
                <Smartphone className="size-4" />
                <span>Celular</span>
              </button>

              <button
                type="button"
                onClick={() => setMode("desktop")}
                className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all ${
                  mode === "desktop"
                    ? "bg-purple-600 text-white shadow-md shadow-purple-900/30"
                    : "text-muted hover:text-fg hover:bg-surface/50"
                }`}
              >
                <Monitor className="size-4" />
                <span>Desktop</span>
              </button>
            </div>
          </div>

          {/* SLIDERS DE CONTROLE */}
          <div className="rounded-xl bg-surface p-5 shadow-[var(--shadow-border)] space-y-6">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="size-4 text-purple-400" />
                <h2 className="font-display text-base">
                  Controles de enquadramento ({mode === "mobile" ? "Celular" : "Desktop"})
                </h2>
              </div>
              <button
                type="button"
                onClick={handleReset}
                className="text-xs text-muted hover:text-purple-300 underline"
              >
                Resetar {mode}
              </button>
            </div>

            {/* 1. POSIÇÃO HORIZONTAL */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <label htmlFor="range-pos-x" className="font-medium text-fg">
                  Posição horizontal
                </label>
                <span className="font-mono text-xs text-purple-400 font-semibold bg-purple-950/40 px-2 py-0.5 rounded border border-purple-500/20">
                  {currentModeSettings.posX}%
                </span>
              </div>
              <p className="text-xs text-muted">
                Move o banner para a esquerda (0%) ou para a direita (100%).
              </p>
              <input
                id="range-pos-x"
                type="range"
                min={0}
                max={100}
                step={1}
                value={currentModeSettings.posX}
                onChange={(e) => updateCurrentMode("posX", Number(e.target.value))}
                className="w-full accent-purple-500 h-2 bg-elevated rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-subtle">
                <span>Esquerda (0%)</span>
                <span>Centro (50%)</span>
                <span>Direita (100%)</span>
              </div>
            </div>

            {/* 2. POSIÇÃO VERTICAL */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <label htmlFor="range-pos-y" className="font-medium text-fg">
                  Posição vertical
                </label>
                <span className="font-mono text-xs text-purple-400 font-semibold bg-purple-950/40 px-2 py-0.5 rounded border border-purple-500/20">
                  {currentModeSettings.posY}%
                </span>
              </div>
              <p className="text-xs text-muted">
                Move o banner para cima (0% = topo) ou para baixo (100% = base).
              </p>
              <input
                id="range-pos-y"
                type="range"
                min={0}
                max={100}
                step={1}
                value={currentModeSettings.posY}
                onChange={(e) => updateCurrentMode("posY", Number(e.target.value))}
                className="w-full accent-purple-500 h-2 bg-elevated rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-subtle">
                <span>Topo (0%)</span>
                <span>Centro (50%)</span>
                <span>Base (100%)</span>
              </div>
            </div>

            {/* 3. ZOOM */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <label htmlFor="range-zoom" className="font-medium text-fg">
                  Zoom
                </label>
                <span className="font-mono text-xs text-purple-400 font-semibold bg-purple-950/40 px-2 py-0.5 rounded border border-purple-500/20">
                  {currentModeSettings.zoom.toFixed(2)}x ({Math.round(currentModeSettings.zoom * 100)}%)
                </span>
              </div>
              <p className="text-xs text-muted">
                Aproxima ou afasta a arte do banner dentro da área visível.
              </p>
              <input
                id="range-zoom"
                type="range"
                min={0.8}
                max={2.2}
                step={0.05}
                value={currentModeSettings.zoom}
                onChange={(e) => updateCurrentMode("zoom", Number(e.target.value))}
                className="w-full accent-purple-500 h-2 bg-elevated rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-subtle">
                <span>Afastado (0.80x)</span>
                <span>Padrão (1.00x)</span>
                <span>Aproximado (2.20x)</span>
              </div>
            </div>
          </div>

          {/* AMOSTRAS DE ANIME PARA TESTE */}
          <div className="rounded-xl bg-surface p-5 shadow-[var(--shadow-border)] space-y-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">
              Testar com outros animes
            </span>
            <div className="grid grid-cols-3 gap-2">
              {SAMPLE_ANIMES.map((sample) => (
                <button
                  key={sample.id}
                  type="button"
                  onClick={() => setSelectedSample(sample)}
                  className={`text-left p-2 rounded-lg border text-xs transition-all ${
                    selectedSample.id === sample.id
                      ? "border-purple-500 bg-purple-950/30 text-white font-medium"
                      : "border-border bg-elevated text-muted hover:text-fg"
                  }`}
                >
                  <p className="truncate font-semibold">{sample.title}</p>
                  <p className="text-[10px] text-subtle">{sample.year}</p>
                </button>
              ))}
            </div>
          </div>

          {/* STATUS E AÇÕES */}
          <div className="flex items-center justify-between text-xs text-muted px-1">
            <span>
              {hasChanges ? "⚠️ Alterações pendentes de salvamento" : "✓ Sincronizado com sua conta"}
            </span>
            <button
              type="button"
              onClick={handleResetAll}
              className="text-subtle hover:text-danger underline"
            >
              Restaurar tudo
            </button>
          </div>
        </div>

        {/* COLUNA DIREITA: PRÉVIA EM TEMPO REAL */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-purple-400" />
              <h2 className="font-display text-base">Prévia em tempo real</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-elevated px-2.5 py-0.5 text-xs text-purple-300 border border-purple-500/20">
                Visualizando modo: {mode === "mobile" ? "Celular (390px)" : "Desktop"}
              </span>
              <Link
                to="/anime/$id"
                params={{ id: selectedSample.id }}
                target="_blank"
                className="inline-flex items-center gap-1 text-xs text-muted hover:text-purple-300 ml-2"
                title="Abrir página real deste anime"
              >
                <span>Ver página real</span>
                <ExternalLink className="size-3" />
              </Link>
            </div>
          </div>

          {/* MOCKUP DO BANNER */}
          <div className="rounded-2xl border border-purple-500/20 bg-black/60 p-4 sm:p-6 backdrop-blur-sm">
            {mode === "mobile" ? (
              /* MOCKUP DE CELULAR REALISTA (390px) */
              <div className="mx-auto w-full max-w-[390px] overflow-hidden rounded-3xl border border-purple-500/30 bg-bg shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_30px_rgba(168,85,247,0.15)] ring-1 ring-white/10">
                {/* BARRA SUPERIOR DO DISPOSITIVO */}
                <div className="flex items-center justify-between px-6 py-2.5 text-[11px] font-semibold text-muted bg-black/40 border-b border-white/5">
                  <span>9:41</span>
                  <div className="h-3 w-16 rounded-full bg-elevated" />
                  <span>5G</span>
                </div>

                {/* BANNER COM OS MESMOS ELEMENTOS DE ANIME.$ID.TSX */}
                <div className="relative overflow-hidden">
                  {/* IMAGEM COM OS AJUSTES AO VIVO */}
                  <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                    <img
                      src={selectedSample.banner}
                      alt=""
                      className="size-full object-cover"
                      style={{
                        objectPosition: `${currentModeSettings.posX}% ${currentModeSettings.posY}%`,
                        transform: `scale(${currentModeSettings.zoom})`,
                        transformOrigin: `${currentModeSettings.posX}% ${currentModeSettings.posY}%`,
                        transition: "object-position 0.1s ease-out, transform 0.1s ease-out",
                      }}
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-bg via-bg/75 to-bg/15" />
                    <div className="absolute inset-0 bg-linear-to-r from-bg/80 via-transparent to-bg/30" />
                  </div>

                  {/* CONTEÚDO SOBREPOSTO EXATAMENTE COMO NO MOBILE REAL */}
                  <div className="relative z-10 px-4 pt-14 pb-5 flex flex-col items-center text-center">
                    {/* CAPA CENTRALIZADA NO MOBILE */}
                    <div className="w-28 shrink-0 overflow-hidden rounded-2xl bg-elevated shadow-[0_12px_36px_rgba(0,0,0,0.8),0_0_24px_rgba(168,85,247,0.2)] ring-1 ring-purple-500/30">
                      <img
                        src={selectedSample.cover}
                        alt=""
                        className="aspect-2/3 w-full object-cover"
                      />
                    </div>

                    <h3 className="mt-4 font-display text-lg tracking-tight text-white line-clamp-1">
                      {selectedSample.title}
                    </h3>

                    <p className="mt-1 text-xs text-muted">
                      {selectedSample.year} · Ação, Fantasia
                    </p>

                    <div className="mt-4 flex gap-2">
                      <div className="rounded-xl bg-purple-600 px-4 py-2 text-xs font-medium text-white shadow-md shadow-purple-900/40">
                        Assistir
                      </div>
                      <div className="rounded-xl bg-elevated px-3 py-2 text-xs font-medium text-muted">
                        + Minha Lista
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-bg text-center border-t border-border/40 text-xs text-muted">
                  Área de episódios e detalhes continuam abaixo...
                </div>
              </div>
            ) : (
              /* MOCKUP DESKTOP (WIDE) */
              <div className="w-full overflow-hidden rounded-2xl border border-purple-500/30 bg-bg shadow-[0_20px_50px_rgba(0,0,0,0.8)] ring-1 ring-white/10">
                {/* CABEÇALHO DO NAVEGADOR DESKTOP */}
                <div className="flex items-center gap-2 px-4 py-2 text-xs text-muted bg-black/40 border-b border-white/5">
                  <div className="flex gap-1.5">
                    <div className="size-2.5 rounded-full bg-red-500/80" />
                    <div className="size-2.5 rounded-full bg-yellow-500/80" />
                    <div className="size-2.5 rounded-full bg-green-500/80" />
                  </div>
                  <span className="ml-2 font-mono text-[10px] text-subtle truncate">
                    hikari.app/anime/{selectedSample.id} (Visualização Desktop)
                  </span>
                </div>

                {/* BANNER COM OS MESMOS ELEMENTOS DE ANIME.$ID.TSX DESKTOP */}
                <div className="relative overflow-hidden min-h-[280px]">
                  {/* IMAGEM COM OS AJUSTES AO VIVO */}
                  <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                    <img
                      src={selectedSample.banner}
                      alt=""
                      className="size-full object-cover"
                      style={{
                        objectPosition: `${currentModeSettings.posX}% ${currentModeSettings.posY}%`,
                        transform: `scale(${currentModeSettings.zoom})`,
                        transformOrigin: `${currentModeSettings.posX}% ${currentModeSettings.posY}%`,
                        transition: "object-position 0.1s ease-out, transform 0.1s ease-out",
                      }}
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-bg via-bg/75 to-bg/15" />
                    <div className="absolute inset-0 bg-linear-to-r from-bg/80 via-transparent to-bg/30" />
                  </div>

                  {/* CONTEÚDO SOBREPOSTO DESKTOP */}
                  <div className="relative z-10 px-8 py-10 flex flex-row items-center gap-6">
                    <div className="w-36 shrink-0 overflow-hidden rounded-2xl bg-elevated shadow-[0_12px_36px_rgba(0,0,0,0.8),0_0_24px_rgba(168,85,247,0.2)] ring-1 ring-purple-500/30">
                      <img
                        src={selectedSample.cover}
                        alt=""
                        className="aspect-2/3 w-full object-cover"
                      />
                    </div>

                    <div className="space-y-2 max-w-lg">
                      <span className="text-[11px] font-semibold text-purple-400 uppercase tracking-widest">
                        Anime em exibição
                      </span>
                      <h3 className="font-display text-2xl tracking-tight text-white line-clamp-2">
                        {selectedSample.title}
                      </h3>
                      <p className="text-xs text-muted">
                        {selectedSample.year} · Ação, Mistério, Fantasia · 24 episódios
                      </p>
                      <div className="pt-2 flex gap-2">
                        <div className="rounded-xl bg-purple-600 px-4 py-2 text-xs font-medium text-white shadow-md shadow-purple-900/40">
                          Continuar assistindo
                        </div>
                        <div className="rounded-xl bg-elevated px-4 py-2 text-xs font-medium text-muted">
                          + Salvar na lista
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-between text-xs text-muted">
              <span>
                Enquadramento atual ({mode}): <strong>X: {currentModeSettings.posX}%</strong>, <strong>Y: {currentModeSettings.posY}%</strong>, <strong>Zoom: {currentModeSettings.zoom.toFixed(2)}x</strong>
              </span>
              <span className="text-[11px] text-purple-400">
                Ajuste os controles deslizantes ao lado para ver o efeito instantâneo.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
