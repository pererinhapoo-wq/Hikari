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
  PlaySquare,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  isHikariPlayableUrl,
  isEpisodePublished,
} from "@/lib/published-episodes";
import type { Episode, Season } from "@/lib/types";
import type { OutboxOperation } from "@/lib/episode-writer";

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
  onUploadVideoToB2: (sid: string, ep: Episode, key: "videoUrl" | "videoUrl2" | "videoUrl3") => Promise<void>;
  uploadingEpisode: string | null;
  captureStatus: Record<string, { status: "loading" | "error" | "success"; message?: string }>;
  outboxOps: OutboxOperation[];
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
  // Controle de aba ativa para navegação rápida entre temporadas
  // "all" mostra todas, ou o ID da temporada selecionada
  const [activeSeasonTab, setActiveSeasonTab] = useState<string>("all");
  const [collapsedSeasons, setCollapsedSeasons] = useState<Record<string, boolean>>({});
  const [seasonToDelete, setSeasonToDelete] = useState<Season | null>(null);

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
    <section className="space-y-6">
      {/* Cabeçalho da Seção de Temporadas */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-white/5 bg-surface/70 p-5 shadow-sm backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="size-5 text-purple-400" />
            <h2 className="font-display text-lg font-bold tracking-tight text-white">
              Gerenciamento de Temporadas & Episódios
            </h2>
          </div>
          <p className="mt-1 text-xs text-muted">
            Total de {seasons.length} {seasons.length === 1 ? "temporada" : "temporadas"} e {totalEpisodesCount} episódios cadastrados
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onAddSeason}
          className="border-purple-500/30 bg-purple-500/10 text-xs font-semibold text-purple-300 hover:bg-purple-500/20 hover:text-white"
        >
          <Plus className="mr-1.5 size-4" />
          <span>Nova Temporada</span>
        </Button>
      </div>

      {/* Navegador de Temporadas (Abas Rápidas) */}
      {seasons.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          <button
            type="button"
            onClick={() => setActiveSeasonTab("all")}
            className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${
              activeSeasonTab === "all"
                ? "bg-purple-600 text-white shadow-md shadow-purple-600/20"
                : "border border-white/5 bg-elevated/40 text-zinc-400 hover:bg-elevated hover:text-white"
            }`}
          >
            Todas as Temporadas ({seasons.length})
          </button>

          {seasons.map((s) => {
            const epCount = s.episodes.length;
            const publishedCount = s.episodes.filter(isEpisodePublished).length;
            const isSelected = activeSeasonTab === s.id;

            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveSeasonTab(s.id)}
                className={`group flex shrink-0 items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${
                  isSelected
                    ? "bg-purple-600 text-white shadow-md shadow-purple-600/20"
                    : "border border-white/5 bg-elevated/40 text-zinc-400 hover:bg-elevated hover:text-white"
                }`}
              >
                <span>{s.title || `Temporada ${s.number}`}</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                    isSelected
                      ? "bg-purple-950/60 text-purple-200"
                      : "bg-white/5 text-zinc-500 group-hover:text-zinc-300"
                  }`}
                >
                  {publishedCount}/{epCount}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Listagem das Temporadas Visíveis */}
      <div className="space-y-6">
        {visibleSeasons.map((season) => {
          const isCollapsed = collapsedSeasons[season.id] ?? false;
          const publishedCount = season.episodes.filter(isEpisodePublished).length;

          return (
            <div
              key={season.id}
              className="rounded-2xl border border-white/5 bg-surface/80 p-5 shadow-lg backdrop-blur-md transition-all sm:p-6"
            >
              {/* Barra de Metadados da Temporada */}
              <div className="flex flex-col gap-4 border-b border-white/5 pb-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-1 flex-wrap items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-purple-500/10 border border-purple-500/30 text-sm font-bold text-purple-300">
                    T{season.number}
                  </div>

                  <div className="flex-1 min-w-[180px]">
                    <Input
                      value={season.title}
                      onChange={(e) =>
                        onPatchSeason(season.id, {
                          title: e.target.value,
                        })
                      }
                      placeholder="Nome da temporada"
                      className="bg-elevated/60 text-sm font-semibold focus:border-purple-500/50"
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
                      className="bg-elevated/60 text-sm text-center"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge className="h-7 border border-white/10 bg-white/5 text-xs text-zinc-300">
                      {season.episodes.length} {season.episodes.length === 1 ? "episódio" : "episódios"}
                    </Badge>
                    <Badge className="h-7 border border-emerald-500/30 bg-emerald-500/10 text-xs text-emerald-300">
                      {publishedCount} publicados
                    </Badge>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end lg:self-auto">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleCollapse(season.id)}
                    className="h-8 text-xs text-zinc-400 hover:text-white"
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
                    className="size-8 text-zinc-500 hover:bg-rose-500/10 hover:text-rose-400"
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

              {/* Lista dos Episódios da Temporada (Preservação Integral) */}
              {!isCollapsed && (
                <div className="mt-4 space-y-4">
                  {season.episodes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 p-8 text-center text-zinc-500">
                      <Film className="mb-2 size-8 text-zinc-700" />
                      <p className="text-xs">Nenhum episódio cadastrado nesta temporada.</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-3 border-purple-500/30 text-xs text-purple-300 hover:bg-purple-500/20"
                        onClick={() => onAddEpisode(season.id)}
                      >
                        <Plus className="mr-1 size-3.5" />
                        Adicionar Episódio 1
                      </Button>
                    </div>
                  ) : (
                    <ul className="space-y-3">
                      {season.episodes.map((ep) => {
                        const outboxOp = outboxOps.find(
                          (o) => o.episodeId === ep.id && o.animeId === animeId,
                        );

                        return (
                          <li
                            key={ep.id}
                            className="rounded-xl border border-white/5 bg-elevated/40 p-4 shadow-sm transition-colors hover:border-white/10"
                          >
                            <div className="grid gap-3 sm:grid-cols-12">
                              {/* Campo de Número com Badge de Estado */}
                              <Field
                                label={
                                  <span className="flex items-center gap-1.5 flex-wrap">
                                    <span>#</span>
                                    {outboxOp ? (
                                      outboxOp.status === "conflict" ? (
                                        <span
                                          className="inline-flex items-center gap-1 rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] font-medium text-red-400"
                                          title={`Ação necessária: ${outboxOp.lastError || "Erro de validação ou conflito no servidor"}`}
                                        >
                                          Ação necessária
                                        </span>
                                      ) : (
                                        <span
                                          className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-300"
                                          title="Sincronização pendente: episódio preservado aguardando envio ao servidor"
                                        >
                                          Pendente
                                        </span>
                                      )
                                    ) : isEpisodePublished(ep) ? (
                                      <span
                                        className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400"
                                        title="Salvo no servidor: gravação confirmada no PostgreSQL"
                                      >
                                        Sincronizado
                                      </span>
                                    ) : (
                                      <span
                                        className="inline-flex items-center gap-1 rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-muted"
                                        title="Salvo no servidor: rascunho sem player de vídeo"
                                      >
                                        Rascunho
                                      </span>
                                    )}
                                  </span>
                                }
                                className="sm:col-span-1"
                              >
                                <Input
                                  type="number"
                                  value={ep.number}
                                  onChange={(e) =>
                                    onPatchEpisode(season.id, ep.id, {
                                      number: Number(e.target.value),
                                    })
                                  }
                                  className="text-center font-semibold"
                                />
                              </Field>

                              {/* Título do Episódio */}
                              <Field label="Título do Episódio" className="sm:col-span-6">
                                <Input
                                  value={ep.title}
                                  onChange={(e) =>
                                    onPatchEpisode(season.id, ep.id, {
                                      title: e.target.value,
                                    })
                                  }
                                  placeholder="Ex: O Retorno do Herói"
                                />
                              </Field>

                              {/* Duração */}
                              <Field label="Duração" className="sm:col-span-4">
                                <Input
                                  value={ep.duration ?? ""}
                                  onChange={(e) =>
                                    onPatchEpisode(season.id, ep.id, {
                                      duration: e.target.value,
                                    })
                                  }
                                  placeholder="24 min"
                                />
                              </Field>

                              {/* Botão de Excluir Episódio */}
                              <div className="sm:col-span-1 flex items-end justify-center">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="size-9 text-zinc-500 hover:bg-rose-500/10 hover:text-rose-400"
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
                              ].map(({ key, label }) => (
                                <Field
                                  key={key}
                                  label={`${label} — URL do vídeo`}
                                  className="sm:col-span-4"
                                >
                                  <div className="flex gap-2">
                                    <Input
                                      value={ep[key] ?? ""}
                                      onChange={(e) =>
                                        onPatchEpisode(season.id, ep.id, {
                                          [key]: e.target.value,
                                        })
                                      }
                                      onBlur={(e) => {
                                        const val = e.target.value.trim();
                                        if (val && !ep.thumbnail && isHikariPlayableUrl(val)) {
                                          void onCaptureFrame(season.id, ep, val);
                                        }
                                      }}
                                      onPaste={(e) => {
                                        const val = e.clipboardData.getData("text").trim();
                                        if (val && !ep.thumbnail && isHikariPlayableUrl(val)) {
                                          setTimeout(() => {
                                            void onCaptureFrame(season.id, ep, val);
                                          }, 100);
                                        }
                                      }}
                                      placeholder="URL do vídeo (MP4 / R2)"
                                      className="text-xs"
                                    />

                                    <Button
                                      type="button"
                                      variant="outline"
                                      className="shrink-0 text-xs"
                                      disabled={uploadingEpisode === `${ep.id}-${key}`}
                                      onClick={() => onUploadVideoToB2(season.id, ep, key)}
                                    >
                                      {uploadingEpisode === `${ep.id}-${key}` ? "Abrindo…" : "Enviar"}
                                    </Button>
                                  </div>
                                </Field>
                              ))}

                              {/* Player 4 */}
                              <Field
                                label="Player 4 — URL do vídeo"
                                className="sm:col-span-4"
                              >
                                <div className="flex gap-2">
                                  <Input
                                    value={ep.videoUrl4 ?? ""}
                                    onChange={(e) =>
                                      onPatchEpisode(season.id, ep.id, {
                                        videoUrl4: e.target.value,
                                      })
                                    }
                                    onBlur={(e) => {
                                      const val = e.target.value.trim();
                                      if (val && !ep.thumbnail && isHikariPlayableUrl(val)) {
                                        void onCaptureFrame(season.id, ep, val);
                                      }
                                    }}
                                    onPaste={(e) => {
                                      const val = e.clipboardData.getData("text").trim();
                                      if (val && !ep.thumbnail && isHikariPlayableUrl(val)) {
                                        setTimeout(() => {
                                          void onCaptureFrame(season.id, ep, val);
                                        }, 100);
                                      }
                                    }}
                                    placeholder="URL do vídeo (MP4 / R2)"
                                    className="text-xs"
                                  />
                                  <Button type="button" variant="outline" className="shrink-0 text-xs" disabled>
                                    Enviar
                                  </Button>
                                </div>
                              </Field>

                              {/* Player 5 */}
                              <Field
                                label="Player 5 — URL do vídeo"
                                className="sm:col-span-4"
                              >
                                <div className="flex gap-2">
                                  <Input
                                    value={ep.videoUrl5 ?? ""}
                                    onChange={(e) =>
                                      onPatchEpisode(season.id, ep.id, {
                                        videoUrl5: e.target.value,
                                      })
                                    }
                                    onBlur={(e) => {
                                      const val = e.target.value.trim();
                                      if (val && !ep.thumbnail && isHikariPlayableUrl(val)) {
                                        void onCaptureFrame(season.id, ep, val);
                                      }
                                    }}
                                    onPaste={(e) => {
                                      const val = e.clipboardData.getData("text").trim();
                                      if (val && !ep.thumbnail && isHikariPlayableUrl(val)) {
                                        setTimeout(() => {
                                          void onCaptureFrame(season.id, ep, val);
                                        }, 100);
                                      }
                                    }}
                                    placeholder="URL do vídeo (HLS / MP4)"
                                    className="text-xs"
                                  />
                                </div>
                              </Field>

                              {/* Miniatura Real do Vídeo (Thumbnail) */}
                              <Field
                                label="Thumb do Episódio (Miniatura Real do Vídeo)"
                                className="sm:col-span-12"
                              >
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    {ep.thumbnail ? (
                                      <div className="relative size-10 shrink-0 overflow-hidden rounded-md border border-purple-500/30 bg-black">
                                        <img
                                          src={ep.thumbnail}
                                          alt=""
                                          className="size-full object-cover"
                                        />
                                      </div>
                                    ) : (
                                      <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-dashed border-zinc-700 bg-black/40 text-zinc-500">
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
                                      className="text-xs"
                                    />

                                    <Button
                                      type="button"
                                      variant="outline"
                                      disabled={captureStatus[ep.id]?.status === "loading"}
                                      onClick={() => onCaptureFrame(season.id, ep)}
                                      className="shrink-0 gap-1.5 text-xs text-purple-300 hover:text-white"
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

                                  {/* Feedback em tempo real do estado da captura */}
                                  {captureStatus[ep.id]?.status === "loading" && (
                                    <div className="flex items-center gap-2 rounded-md bg-purple-950/40 border border-purple-500/30 px-2.5 py-1.5 text-xs text-purple-300">
                                      <Loader2 className="size-3.5 animate-spin shrink-0 text-purple-400" />
                                      <span>Capturando quadro real e salvando miniatura persistente…</span>
                                    </div>
                                  )}

                                  {captureStatus[ep.id]?.status === "error" && (
                                    <div className="rounded-md bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs text-amber-200 space-y-1">
                                      <div className="flex items-center gap-1.5 font-medium text-amber-300">
                                        <AlertCircle className="size-3.5 shrink-0" />
                                        <span>Captura automática indisponível para este vídeo:</span>
                                      </div>
                                      <p className="text-[11px] text-amber-200/90 pl-5">
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
                      className="border-white/10 text-xs text-zinc-300 hover:border-purple-500/40 hover:bg-elevated hover:text-white"
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

      {/* Modal de Confirmação para Remoção de Temporada com Episódios */}
      <Dialog
        open={Boolean(seasonToDelete)}
        onOpenChange={(open) => {
          if (!open) setSeasonToDelete(null);
        }}
      >
        <DialogContent className="border-rose-500/20 bg-zinc-950 sm:max-w-md">
          <DialogTitle className="flex items-center gap-2 text-rose-400 font-display text-lg">
            <AlertTriangle className="size-5 shrink-0" />
            <span>Excluir temporada e seus episódios?</span>
          </DialogTitle>
          <DialogDescription className="mt-2 text-xs leading-relaxed text-zinc-400">
            A temporada <strong className="text-zinc-200">{seasonToDelete?.title || `Temporada ${seasonToDelete?.number}`}</strong> possui{" "}
            <strong className="text-zinc-200">{seasonToDelete?.episodes.length} episódios</strong>.
            Esta ação excluirá a temporada e disparará a exclusão dos episódios associados no banco e outbox.
          </DialogDescription>

          <div className="mt-6 flex justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSeasonToDelete(null)}
              className="border-white/10 text-xs text-zinc-300 hover:bg-white/5"
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
              className="bg-rose-600 text-xs font-medium text-white hover:bg-rose-700"
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
      <Label className="mb-1.5 block text-xs font-semibold text-zinc-300">
        {label}
      </Label>
      {children}
    </label>
  );
}
