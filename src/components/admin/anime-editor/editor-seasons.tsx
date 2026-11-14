import { useState, type ReactNode } from "react";
import {
  Plus,
  Trash2,
  Camera,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Film,
  Layers,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Globe,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  hasEpisodePlayableSource,
  isPersistablePlayableVideoUrl,
} from "@/lib/published-episodes";
import type { Episode, Season } from "@/lib/types";
import type { OutboxOperation } from "@/lib/episode-writer";
import { cn } from "@/lib/utils";

interface EditorSeasonsProps {
  animeId: string;
  seasons: Season[];
  onAddSeason: () => void;
  onPatchSeason: (sid: string, patch: Partial<Season>) => void;
  onRemoveSeason: (sid: string) => void;
  onAddEpisode: (sid: string) => void;
  onPatchEpisode: (sid: string, eid: string, patch: Partial<Episode>) => void;
  onRemoveEpisode: (sid: string, eid: string) => void;
  onCaptureFrame: (sid: string, ep: Episode, forcedUrl?: string) => Promise<void>;
  onUploadVideoToB2: (
    sid: string,
    ep: Episode,
    key: "videoUrl" | "videoUrl2" | "videoUrl3",
  ) => Promise<void>;
  uploadingEpisode: string | null;
  captureStatus: Record<
    string,
    { status: "loading" | "error" | "success"; message?: string }
  >;
  outboxOps: OutboxOperation[];
}

function getPublishSourceError(ep: Episode): string {
  const rawUrls = [
    ep.videoUrl,
    ep.videoUrl2,
    ep.videoUrl3,
    ep.videoUrl4,
    ep.videoUrl5,
  ]
    .map((u) => u?.trim() ?? "")
    .filter(Boolean);
  if (rawUrls.length === 0) {
    return "Adicione pelo menos uma URL de vídeo válida (Player 1 a Player 5) antes de publicar este episódio.";
  }
  return "Nenhuma fonte de reprodução válida encontrada. Use uma URL HTTP/HTTPS direta de vídeo (MP4, HLS ou R2); links externos como YouTube ou Crunchyroll não permitem publicação.";
}

export function EditorSeasons({
  animeId,
  seasons,
  onAddSeason,
  onPatchSeason,
  onRemoveSeason,
  onAddEpisode,
  onPatchEpisode,
  onRemoveEpisode,
  onCaptureFrame,
  onUploadVideoToB2,
  uploadingEpisode,
  captureStatus,
  outboxOps,
}: EditorSeasonsProps) {
  const [activeSeasonTab, setActiveSeasonTab] = useState<string>("all");
  const [collapsedSeasons, setCollapsedSeasons] = useState<Record<string, boolean>>({});
  const [seasonToDelete, setSeasonToDelete] = useState<Season | null>(null);
  const [publishErrors, setPublishErrors] = useState<Record<string, string>>({});

  const clearPublishError = (epId: string) => {
    setPublishErrors((prev) => {
      if (!(epId in prev)) return prev;
      const next = { ...prev };
      delete next[epId];
      return next;
    });
  };

  const handleSetEpisodePublished = (
    seasonId: string,
    ep: Episode,
    nextPublished: boolean,
  ) => {
    if (!nextPublished) {
      clearPublishError(ep.id);
      onPatchEpisode(seasonId, ep.id, { published: false });
      return;
    }

    if (!hasEpisodePlayableSource(ep)) {
      const msg = getPublishSourceError(ep);
      setPublishErrors((prev) => ({ ...prev, [ep.id]: msg }));
      toast.error(msg);
      if (ep.published) {
        onPatchEpisode(seasonId, ep.id, { published: false });
      }
      return;
    }

    clearPublishError(ep.id);
    onPatchEpisode(seasonId, ep.id, { published: true });
  };

  const handleVideoUrlChange = (
    seasonId: string,
    ep: Episode,
    key: "videoUrl" | "videoUrl2" | "videoUrl3" | "videoUrl4" | "videoUrl5",
    value: string,
  ) => {
    const updatedEp = { ...ep, [key]: value };
    const stillValid = hasEpisodePlayableSource(updatedEp);
    if (stillValid) {
      clearPublishError(ep.id);
    } else if (ep.published === true) {
      setPublishErrors((prev) => ({
        ...prev,
        [ep.id]: getPublishSourceError(updatedEp),
      }));
    }
    onPatchEpisode(seasonId, ep.id, { [key]: value });
  };

  const toggleCollapse = (sid: string) => {
    setCollapsedSeasons((prev) => ({
      ...prev,
      [sid]: !prev[sid],
    }));
  };

  const visibleSeasons =
    activeSeasonTab === "all"
      ? seasons
      : seasons.filter((s) => s.id === activeSeasonTab);

  const totalEpisodesCount = seasons.reduce((acc, s) => acc + s.episodes.length, 0);

  return (
    <section id="seasons" className="scroll-mt-20 space-y-5">
      {/* Cabeçalho da Seção */}
      <div className="studio-panel flex flex-col gap-4 rounded-2xl p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <Layers className="size-5 text-purple-400" />
            <h2 className="font-display text-lg font-bold tracking-tight text-[var(--color-fg)]">
              Gerenciamento de Temporadas &amp; Episódios
            </h2>
          </div>
          <p className="studio-tabular mt-1 text-xs text-[var(--color-muted)]">
            {seasons.length} {seasons.length === 1 ? "temporada" : "temporadas"} ·{" "}
            {totalEpisodesCount} episódios cadastrados
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onAddSeason}
          className="h-10 border-purple-500/35 bg-purple-500/12 px-4 text-xs font-semibold text-purple-200 hover:bg-purple-500/22 hover:text-white"
        >
          <Plus className="mr-1.5 size-4" />
          <span>Nova Temporada</span>
        </Button>
      </div>

      {/* Navegação por Abas de Temporadas */}
      {seasons.length > 1 && (
        <div className="studio-scroll flex items-center gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setActiveSeasonTab("all")}
            className={cn(
              "h-9 shrink-0 rounded-lg px-3.5 text-xs font-medium transition-colors",
              activeSeasonTab === "all"
                ? "bg-purple-600 text-white"
                : "border border-white/10 bg-[var(--studio-panel)] text-[var(--color-muted)] hover:bg-white/[0.05] hover:text-[var(--color-fg)]",
            )}
          >
            Todas as Temporadas ({seasons.length})
          </button>

          {seasons.map((s) => {
            const epCount = s.episodes.length;
            const publishedCount = s.episodes.filter(
              (ep) => ep.published === true && hasEpisodePlayableSource(ep),
            ).length;
            const isSelected = activeSeasonTab === s.id;

            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveSeasonTab(s.id)}
                className={cn(
                  "flex h-9 shrink-0 items-center gap-2 rounded-lg px-3.5 text-xs font-medium transition-colors",
                  isSelected
                    ? "bg-purple-600 text-white"
                    : "border border-white/10 bg-[var(--studio-panel)] text-[var(--color-muted)] hover:bg-white/[0.05] hover:text-[var(--color-fg)]",
                )}
              >
                <span>{s.title || `Temporada ${s.number}`}</span>
                <span
                  className={cn(
                    "studio-mono text-[11px]",
                    isSelected ? "text-purple-100" : "text-[var(--color-subtle)]",
                  )}
                >
                  {publishedCount}/{epCount}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Listagem das Temporadas */}
      <div className="space-y-6">
        {visibleSeasons.map((season) => {
          const isCollapsed = collapsedSeasons[season.id] ?? false;
          const publishedCount = season.episodes.filter(
            (ep) => ep.published === true && hasEpisodePlayableSource(ep),
          ).length;

          return (
            <div key={season.id} className="studio-panel rounded-2xl p-4 sm:p-6">
              {/* Cabeçalho da Temporada */}
              <div className="flex flex-col gap-4 border-b border-white/[0.07] pb-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-1 flex-wrap items-center gap-3">
                  <div className="studio-mono flex size-10 shrink-0 items-center justify-center rounded-xl border border-purple-500/35 bg-purple-500/12 text-xs font-bold text-purple-200">
                    T{season.number}
                  </div>

                  <div className="min-w-[180px] flex-1">
                    <Input
                      value={season.title}
                      onChange={(e) =>
                        onPatchSeason(season.id, {
                          title: e.target.value,
                        })
                      }
                      placeholder="Nome da temporada"
                      className="h-10 border-white/10 bg-[var(--studio-panel-alt)] text-sm font-semibold"
                    />
                  </div>

                  <div className="w-24">
                    <Input
                      type="number"
                      min={1}
                      value={season.number}
                      onChange={(e) =>
                        onPatchSeason(season.id, {
                          number: Number(e.target.value),
                        })
                      }
                      placeholder="Nº"
                      title="Número da temporada"
                      className="studio-tabular h-10 border-white/10 bg-[var(--studio-panel-alt)] text-center text-sm"
                    />
                  </div>

                  <div className="studio-tabular flex items-center gap-3 text-xs text-[var(--color-muted)]">
                    <span>
                      {season.episodes.length}{" "}
                      {season.episodes.length === 1 ? "episódio" : "episódios"}
                    </span>
                    <span className="text-white/20">·</span>
                    <span className="font-semibold text-emerald-400">
                      {publishedCount} publicados
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end lg:self-auto">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleCollapse(season.id)}
                    className="h-9 text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)]"
                    title={isCollapsed ? "Expandir episódios" : "Recolher episódios"}
                  >
                    {isCollapsed ? (
                      <>
                        <ChevronDown className="mr-1 size-3.5" />
                        <span>Expandir ({season.episodes.length})</span>
                      </>
                    ) : (
                      <>
                        <ChevronUp className="mr-1 size-3.5" />
                        <span>Recolher</span>
                      </>
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-9 text-[var(--color-subtle)] hover:bg-rose-500/12 hover:text-rose-400"
                    aria-label="Remover temporada"
                    onClick={() => {
                      if (season.episodes.length > 0) {
                        setSeasonToDelete(season);
                      } else {
                        onRemoveSeason(season.id);
                      }
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>

              {/* Episódios */}
              {!isCollapsed && (
                <div className="mt-5 space-y-4">
                  {season.episodes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/15 p-8 text-center text-[var(--color-muted)]">
                      <Film className="mb-2 size-8 opacity-50" />
                      <p className="text-xs">Nenhum episódio cadastrado nesta temporada.</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-3 h-9 border-purple-500/35 text-xs text-purple-300 hover:bg-purple-500/15"
                        onClick={() => onAddEpisode(season.id)}
                      >
                        <Plus className="mr-1.5 size-3.5" />
                        Adicionar Episódio 1
                      </Button>
                    </div>
                  ) : (
                    <ul className="space-y-4">
                      {season.episodes.map((ep) => {
                        const outboxOp = outboxOps.find(
                          (o) => o.episodeId === ep.id && o.animeId === animeId,
                        );
                        const hasValidSource = hasEpisodePlayableSource(ep);
                        const isMarkedPublished = ep.published === true;
                        const isEffectivelyPublished = isMarkedPublished && hasValidSource;
                        const inlinePublishError =
                          publishErrors[ep.id] ??
                          (isMarkedPublished && !hasValidSource
                            ? getPublishSourceError(ep)
                            : undefined);

                        return (
                          <li
                            key={ep.id}
                            data-episode-id={ep.id}
                            data-episode-number={ep.number}
                            className="studio-panel-alt rounded-xl p-4 transition-colors hover:border-white/15"
                          >
                            {/* Barra de Status e Publicação do Episódio */}
                            <div className="mb-4 flex flex-col gap-3 border-b border-white/[0.06] pb-3.5 sm:flex-row sm:items-center sm:justify-between">
                              <div className="flex flex-wrap items-center gap-2.5">
                                <span className="studio-mono text-xs font-bold text-[var(--color-fg)]">
                                  Episódio {ep.number}
                                </span>

                                {outboxOp ? (
                                  outboxOp.status === "conflict" ? (
                                    <span
                                      className="inline-flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/12 px-2 py-0.5 text-[11px] font-medium text-rose-300"
                                      title={`Ação necessária: ${outboxOp.lastError || "Erro de validação ou conflito no servidor"}`}
                                    >
                                      Ação necessária
                                    </span>
                                  ) : (
                                    <span
                                      className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/12 px-2 py-0.5 text-[11px] font-medium text-amber-200"
                                      title="Sincronização pendente: episódio preservado aguardando envio ao servidor"
                                    >
                                      Pendente
                                    </span>
                                  )
                                ) : isEffectivelyPublished ? (
                                  <span
                                    className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/12 px-2 py-0.5 text-[11px] font-medium text-emerald-300"
                                    title="Episódio visível no catálogo público quando salvo"
                                  >
                                    <Globe className="size-3" />
                                    Publicado
                                  </span>
                                ) : isMarkedPublished && !hasValidSource ? (
                                  <span
                                    className="inline-flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/12 px-2 py-0.5 text-[11px] font-medium text-rose-300"
                                    title="Fonte de vídeo válida obrigatória para publicar"
                                  >
                                    <AlertCircle className="size-3" />
                                    Fonte inválida
                                  </span>
                                ) : (
                                  <span
                                    className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] font-medium text-[var(--color-muted)]"
                                    title="Salvo apenas como rascunho; oculto no catálogo público"
                                  >
                                    <EyeOff className="size-3" />
                                    Rascunho
                                  </span>
                                )}
                              </div>

                              <div
                                role="group"
                                aria-label={`Status de publicação do Episódio ${ep.number}`}
                                className="inline-flex items-center gap-1 self-start rounded-lg border border-white/10 bg-black/35 p-0.5 sm:self-auto"
                              >
                                <button
                                  type="button"
                                  aria-pressed={!isMarkedPublished}
                                  onClick={() => handleSetEpisodePublished(season.id, ep, false)}
                                  className={cn(
                                    "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors",
                                    !isMarkedPublished
                                      ? "bg-zinc-700 text-white"
                                      : "text-[var(--color-muted)] hover:text-white",
                                  )}
                                >
                                  <EyeOff className="size-3.5" />
                                  <span>Rascunho</span>
                                </button>
                                <button
                                  type="button"
                                  aria-pressed={isMarkedPublished}
                                  onClick={() => handleSetEpisodePublished(season.id, ep, true)}
                                  className={cn(
                                    "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors",
                                    isMarkedPublished
                                      ? hasValidSource
                                        ? "bg-emerald-600 text-white"
                                        : "bg-rose-600 text-white"
                                      : hasValidSource
                                        ? "text-[var(--color-muted)] hover:bg-emerald-500/15 hover:text-emerald-300"
                                        : "text-[var(--color-muted)] hover:bg-white/[0.05] hover:text-white",
                                  )}
                                >
                                  <Globe className="size-3.5" />
                                  <span>Publicado</span>
                                </button>
                              </div>
                            </div>

                            {inlinePublishError && (
                              <div
                                role="alert"
                                className="mb-4 flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200"
                              >
                                <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-rose-400" />
                                <span>{inlinePublishError}</span>
                              </div>
                            )}

                            <div className="grid gap-3 sm:grid-cols-12">
                              <Field label="#" className="sm:col-span-2 lg:col-span-1">
                                <Input
                                  type="number"
                                  value={ep.number}
                                  onChange={(e) =>
                                    onPatchEpisode(season.id, ep.id, {
                                      number: Number(e.target.value),
                                    })
                                  }
                                  className="studio-tabular h-10 border-white/10 bg-[var(--studio-panel)] text-center font-semibold"
                                />
                              </Field>

                              <Field
                                label="Título do Episódio"
                                className="sm:col-span-6 lg:col-span-6"
                              >
                                <Input
                                  value={ep.title}
                                  onChange={(e) =>
                                    onPatchEpisode(season.id, ep.id, {
                                      title: e.target.value,
                                    })
                                  }
                                  placeholder="Ex: O Retorno do Herói"
                                  className="h-10 border-white/10 bg-[var(--studio-panel)]"
                                />
                              </Field>

                              <Field label="Duração" className="sm:col-span-3 lg:col-span-4">
                                <Input
                                  value={ep.duration ?? ""}
                                  onChange={(e) =>
                                    onPatchEpisode(season.id, ep.id, {
                                      duration: e.target.value,
                                    })
                                  }
                                  placeholder="24 min"
                                  className="h-10 border-white/10 bg-[var(--studio-panel)]"
                                />
                              </Field>

                              <div className="flex items-end justify-end sm:col-span-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="size-10 text-[var(--color-subtle)] hover:bg-rose-500/12 hover:text-rose-400"
                                  aria-label="Remover episódio"
                                  onClick={() => onRemoveEpisode(season.id, ep.id)}
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </div>

                              {/* Players 1, 2 e 3 com Upload B2 */}
                              {[
                                { key: "videoUrl" as const, label: "Player 1" },
                                { key: "videoUrl2" as const, label: "Player 2" },
                                { key: "videoUrl3" as const, label: "Player 3" },
                              ].map(({ key, label }) => {
                                const rawVal = ep[key] ?? "";
                                const hasInvalidInput =
                                  Boolean(rawVal.trim()) &&
                                  !isPersistablePlayableVideoUrl(rawVal);

                                return (
                                  <Field
                                    key={key}
                                    label={`${label} — URL do vídeo`}
                                    className="sm:col-span-6 lg:col-span-4"
                                  >
                                    <div className="flex gap-2">
                                      <Input
                                        value={rawVal}
                                        onChange={(e) =>
                                          handleVideoUrlChange(
                                            season.id,
                                            ep,
                                            key,
                                            e.target.value,
                                          )
                                        }
                                        onBlur={(e) => {
                                          const val = e.target.value.trim();
                                          if (
                                            val &&
                                            !ep.thumbnail &&
                                            isPersistablePlayableVideoUrl(val)
                                          ) {
                                            void onCaptureFrame(season.id, ep, val);
                                          }
                                        }}
                                        onPaste={(e) => {
                                          const val = e.clipboardData.getData("text").trim();
                                          if (
                                            val &&
                                            !ep.thumbnail &&
                                            isPersistablePlayableVideoUrl(val)
                                          ) {
                                            setTimeout(() => {
                                              void onCaptureFrame(season.id, ep, val);
                                            }, 100);
                                          }
                                        }}
                                        placeholder="URL do vídeo (MP4 / R2)"
                                        className="studio-mono h-10 border-white/10 bg-[var(--studio-panel)] text-xs"
                                      />

                                      <Button
                                        type="button"
                                        variant="outline"
                                        className="h-10 shrink-0 border-white/10 bg-[var(--studio-panel)] text-xs"
                                        disabled={uploadingEpisode === `${ep.id}-${key}`}
                                        onClick={() => onUploadVideoToB2(season.id, ep, key)}
                                      >
                                        {uploadingEpisode === `${ep.id}-${key}`
                                          ? "Abrindo…"
                                          : "Enviar"}
                                      </Button>
                                    </div>
                                    {hasInvalidInput && (
                                      <p className="mt-1 text-[11px] text-rose-400">
                                        URL inválida ou não suportada para publicação.
                                      </p>
                                    )}
                                  </Field>
                                );
                              })}

                              {/* Player 4 */}
                              <Field
                                label="Player 4 — URL do vídeo"
                                className="sm:col-span-6 lg:col-span-6"
                              >
                                <div className="flex gap-2">
                                  <Input
                                    value={ep.videoUrl4 ?? ""}
                                    onChange={(e) =>
                                      handleVideoUrlChange(
                                        season.id,
                                        ep,
                                        "videoUrl4",
                                        e.target.value,
                                      )
                                    }
                                    onBlur={(e) => {
                                      const val = e.target.value.trim();
                                      if (
                                        val &&
                                        !ep.thumbnail &&
                                        isPersistablePlayableVideoUrl(val)
                                      ) {
                                        void onCaptureFrame(season.id, ep, val);
                                      }
                                    }}
                                    onPaste={(e) => {
                                      const val = e.clipboardData.getData("text").trim();
                                      if (
                                        val &&
                                        !ep.thumbnail &&
                                        isPersistablePlayableVideoUrl(val)
                                      ) {
                                        setTimeout(() => {
                                          void onCaptureFrame(season.id, ep, val);
                                        }, 100);
                                      }
                                    }}
                                    placeholder="URL do vídeo (MP4 / R2)"
                                    className="studio-mono h-10 border-white/10 bg-[var(--studio-panel)] text-xs"
                                  />
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="h-10 shrink-0 border-white/10 text-xs"
                                    disabled
                                  >
                                    Enviar
                                  </Button>
                                </div>
                                {Boolean(ep.videoUrl4?.trim()) &&
                                  !isPersistablePlayableVideoUrl(ep.videoUrl4) && (
                                    <p className="mt-1 text-[11px] text-rose-400">
                                      URL inválida ou não suportada para publicação.
                                    </p>
                                  )}
                              </Field>

                              {/* Player 5 */}
                              <Field
                                label="Player 5 — URL do vídeo"
                                className="sm:col-span-6 lg:col-span-6"
                              >
                                <Input
                                  value={ep.videoUrl5 ?? ""}
                                  onChange={(e) =>
                                    handleVideoUrlChange(
                                      season.id,
                                      ep,
                                      "videoUrl5",
                                      e.target.value,
                                    )
                                  }
                                  onBlur={(e) => {
                                    const val = e.target.value.trim();
                                    if (
                                      val &&
                                      !ep.thumbnail &&
                                      isPersistablePlayableVideoUrl(val)
                                    ) {
                                      void onCaptureFrame(season.id, ep, val);
                                    }
                                  }}
                                  onPaste={(e) => {
                                    const val = e.clipboardData.getData("text").trim();
                                    if (
                                      val &&
                                      !ep.thumbnail &&
                                      isPersistablePlayableVideoUrl(val)
                                    ) {
                                      setTimeout(() => {
                                        void onCaptureFrame(season.id, ep, val);
                                      }, 100);
                                    }
                                  }}
                                  placeholder="URL do vídeo (HLS / MP4)"
                                  className="studio-mono h-10 border-white/10 bg-[var(--studio-panel)] text-xs"
                                />
                                {Boolean(ep.videoUrl5?.trim()) &&
                                  !isPersistablePlayableVideoUrl(ep.videoUrl5) && (
                                    <p className="mt-1 text-[11px] text-rose-400">
                                      URL inválida ou não suportada para publicação.
                                    </p>
                                  )}
                              </Field>

                              {/* Miniatura Real do Vídeo */}
                              <Field
                                label="Thumb do Episódio (Miniatura Real do Vídeo)"
                                className="sm:col-span-12"
                              >
                                <div className="space-y-2">
                                  <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                                    {ep.thumbnail ? (
                                      <div className="relative h-10 w-16 shrink-0 overflow-hidden rounded-md border border-purple-500/35 bg-black">
                                        <img
                                          src={ep.thumbnail}
                                          alt=""
                                          className="size-full object-cover"
                                        />
                                      </div>
                                    ) : (
                                      <div className="flex h-10 w-16 shrink-0 items-center justify-center rounded-md border border-dashed border-white/15 bg-black/40 text-[var(--color-subtle)]">
                                        <Film className="size-4" />
                                      </div>
                                    )}

                                    <Input
                                      value={ep.thumbnail ?? ""}
                                      onChange={(e) =>
                                        onPatchEpisode(season.id, ep.id, {
                                          thumbnail: e.target.value,
                                        })
                                      }
                                      placeholder="URL da miniatura do episódio (capturada ou manual)"
                                      className="h-10 min-w-0 flex-1 border-white/10 bg-[var(--studio-panel)] text-xs"
                                    />

                                    <Button
                                      type="button"
                                      variant="outline"
                                      disabled={captureStatus[ep.id]?.status === "loading"}
                                      onClick={() => onCaptureFrame(season.id, ep)}
                                      className="h-10 shrink-0 gap-1.5 border-white/10 bg-[var(--studio-panel)] text-xs text-purple-300 hover:text-white"
                                      title="Capturar quadro do vídeo agora"
                                    >
                                      {captureStatus[ep.id]?.status === "loading" ? (
                                        <>
                                          <Loader2 className="size-3.5 animate-spin" />
                                          <span>Capturando…</span>
                                        </>
                                      ) : (
                                        <>
                                          <Camera className="size-3.5" />
                                          <span>{ep.thumbnail ? "Recapturar" : "Capturar"}</span>
                                        </>
                                      )}
                                    </Button>
                                  </div>

                                  {captureStatus[ep.id]?.status === "loading" && (
                                    <div className="flex items-center gap-2 rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-2 text-xs text-purple-200">
                                      <Loader2 className="size-3.5 shrink-0 animate-spin text-purple-300" />
                                      <span>
                                        Capturando quadro real e salvando miniatura persistente…
                                      </span>
                                    </div>
                                  )}

                                  {captureStatus[ep.id]?.status === "error" && (
                                    <div className="space-y-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                                      <div className="flex items-center gap-1.5 font-medium text-amber-300">
                                        <AlertCircle className="size-3.5 shrink-0" />
                                        <span>
                                          Captura automática indisponível para este vídeo:
                                        </span>
                                      </div>
                                      <p className="pl-5 text-[11px] text-amber-200/90">
                                        {captureStatus[ep.id]?.message}
                                      </p>
                                    </div>
                                  )}

                                  {captureStatus[ep.id]?.status === "success" && (
                                    <div className="flex items-center gap-1.5 text-[11px] text-emerald-400">
                                      <CheckCircle2 className="size-3.5 shrink-0" />
                                      <span>Miniatura própria capturada e salva com sucesso!</span>
                                    </div>
                                  )}
                                </div>
                              </Field>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  <div className="pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onAddEpisode(season.id)}
                      className="h-10 border-white/10 bg-[var(--studio-panel-alt)] px-4 text-xs text-[var(--color-fg)] hover:border-purple-500/40"
                    >
                      <Plus className="mr-1.5 size-3.5 text-purple-400" />
                      Adicionar Episódio
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal de Confirmação para Remoção de Temporada */}
      <Dialog
        open={Boolean(seasonToDelete)}
        onOpenChange={(open) => {
          if (!open) setSeasonToDelete(null);
        }}
      >
        <DialogContent className="hikari-studio-dialog max-h-[88dvh] overflow-y-auto border border-rose-500/25 bg-[#0e0c17] text-[var(--color-fg)] sm:max-w-md">
          <DialogTitle className="flex items-center gap-2 font-display text-lg font-semibold text-rose-400">
            <AlertTriangle className="size-5 shrink-0" />
            <span>Excluir temporada e seus episódios?</span>
          </DialogTitle>
          <DialogDescription className="mt-2 text-xs leading-relaxed text-[var(--color-muted)]">
            A temporada{" "}
            <strong className="text-[var(--color-fg)]">
              {seasonToDelete?.title || `Temporada ${seasonToDelete?.number}`}
            </strong>{" "}
            possui{" "}
            <strong className="text-[var(--color-fg)]">
              {seasonToDelete?.episodes.length} episódios
            </strong>
            . Esta ação excluirá a temporada e disparará a exclusão dos episódios associados no
            banco e outbox.
          </DialogDescription>

          <div className="mt-6 flex justify-end gap-2.5 border-t border-white/[0.07] pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSeasonToDelete(null)}
              className="h-9 border-white/10 text-xs text-[var(--color-muted)] hover:bg-white/[0.06]"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={() => {
                if (seasonToDelete) {
                  onRemoveSeason(seasonToDelete.id);
                  setSeasonToDelete(null);
                }
              }}
              className="h-9 bg-rose-600 text-xs font-semibold text-white hover:bg-rose-500"
            >
              Sim, Excluir Temporada
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={className}>
      <Label className="mb-1.5 block text-xs font-semibold text-[var(--color-muted)]">
        {label}
      </Label>
      {children}
    </label>
  );
}
