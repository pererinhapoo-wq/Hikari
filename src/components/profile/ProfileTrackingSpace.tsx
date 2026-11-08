import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  CheckCircle2,
  Film,
  Pencil,
  Play,
  Plus,
  Star,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ProfileAnimeEditModal } from "@/components/profile/ProfileAnimeEditModal";
import { upsertAnimeTracking } from "@/lib/profile-tracking.functions";
import type {
  TrackingStatus,
  UserAnimeTrackingItem,
} from "@/types/profile-tracking";

interface ProfileTrackingSpaceProps {
  items: UserAnimeTrackingItem[];
  loading?: boolean;
  onUpdateItem?: (updatedItem: UserAnimeTrackingItem) => void;
}

type FilterOption = "all" | TrackingStatus;

const STATUS_CONFIG: Record<
  TrackingStatus,
  { label: string; color: string; badgeBg: string; badgeBorder: string; badgeText: string }
> = {
  watching: {
    label: "Assistindo",
    color: "emerald",
    badgeBg: "bg-emerald-500/15",
    badgeBorder: "border-emerald-500/30",
    badgeText: "text-emerald-300",
  },
  completed: {
    label: "Completos",
    color: "violet",
    badgeBg: "bg-violet-500/15",
    badgeBorder: "border-violet-500/30",
    badgeText: "text-violet-300",
  },
  planning: {
    label: "Planejando",
    color: "sky",
    badgeBg: "bg-sky-500/15",
    badgeBorder: "border-sky-500/30",
    badgeText: "text-sky-300",
  },
  on_hold: {
    label: "Em Pausa",
    color: "amber",
    badgeBg: "bg-amber-500/15",
    badgeBorder: "border-amber-500/30",
    badgeText: "text-amber-300",
  },
  dropped: {
    label: "Desistidos",
    color: "rose",
    badgeBg: "bg-rose-500/15",
    badgeBorder: "border-rose-500/30",
    badgeText: "text-rose-300",
  },
};

export function ProfileTrackingSpace({
  items,
  loading = false,
  onUpdateItem,
}: ProfileTrackingSpaceProps) {
  const [filter, setFilter] = useState<FilterOption>("all");
  const [editingItem, setEditingItem] = useState<UserAnimeTrackingItem | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const upsertTrackingFn = useServerFn(upsertAnimeTracking);

  const handleQuickIncrement = async (item: UserAnimeTrackingItem) => {
    const currentWatched = item.episodesWatched ?? 0;
    const maxEps = item.episodesCount ?? null;
    if (maxEps !== null && maxEps > 0 && currentWatched >= maxEps) {
      toast.info("Todos os episódios conhecidos já foram assistidos.");
      return;
    }
    const nextWatched = currentWatched + 1;
    const nextStatus =
      maxEps !== null && maxEps > 0 && nextWatched >= maxEps && item.status === "watching"
        ? "completed"
        : item.status;

    setUpdatingId(item.animeId);

    const previousItem = { ...item };
    const updatedItem: UserAnimeTrackingItem = {
      ...item,
      episodesWatched: nextWatched,
      status: nextStatus,
    };
    onUpdateItem?.(updatedItem);

    try {
      const res = await upsertTrackingFn({
        data: {
          animeId: item.animeId,
          status: nextStatus,
          episodesWatched: nextWatched,
          score: item.score,
          animeSnapshot: item.animeSnapshot,
        },
      });

      onUpdateItem?.({
        ...updatedItem,
        status: res.status,
        score: res.score,
        episodesWatched: res.episodesWatched,
        startedAt: res.startedAt,
        completedAt: res.completedAt,
        updatedAt: res.updatedAt,
      });

      toast.success(`Episódio ${nextWatched}${maxEps ? ` de ${maxEps}` : ""} marcado!`);
    } catch (err) {
      onUpdateItem?.(previousItem);
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar episódios.");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleSaveEdit = async (data: {
    animeId: string;
    status: TrackingStatus;
    score: number | null;
    episodesWatched: number;
  }) => {
    if (!editingItem) return;
    const targetItem = editingItem;
    const previousItem = { ...targetItem };

    const optimisticItem: UserAnimeTrackingItem = {
      ...targetItem,
      status: data.status,
      score: data.score,
      episodesWatched: data.episodesWatched,
    };
    onUpdateItem?.(optimisticItem);

    try {
      const res = await upsertTrackingFn({
        data: {
          animeId: data.animeId,
          status: data.status,
          score: data.score,
          episodesWatched: data.episodesWatched,
          animeSnapshot: targetItem.animeSnapshot,
        },
      });

      onUpdateItem?.({
        ...targetItem,
        status: res.status,
        score: res.score,
        episodesWatched: res.episodesWatched,
        startedAt: res.startedAt,
        completedAt: res.completedAt,
        updatedAt: res.updatedAt,
      });

      toast.success("Coleção atualizada com sucesso!");
    } catch (err) {
      onUpdateItem?.(previousItem);
      throw err;
    }
  };

  const counts: Record<FilterOption, number> = {
    all: items.length,
    watching: items.filter((i) => i.status === "watching").length,
    completed: items.filter((i) => i.status === "completed").length,
    planning: items.filter((i) => i.status === "planning").length,
    on_hold: items.filter((i) => i.status === "on_hold").length,
    dropped: items.filter((i) => i.status === "dropped").length,
  };

  const filteredItems =
    filter === "all"
      ? items
      : items.filter((item) => item.status === filter);

  // Métricas agregadas reais do usuário
  const scoredItems = items.filter(
    (i) => typeof i.score === "number" && i.score > 0,
  );
  const avgScore =
    scoredItems.length > 0
      ? (
          scoredItems.reduce((acc, c) => acc + (c.score || 0), 0) /
          scoredItems.length
        ).toFixed(1)
      : null;

  return (
    <div className="space-y-6">
      {/* Barra de Filtros e Status do Acompanhamento */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Filtros em Pílulas */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
              filter === "all"
                ? "bg-violet-600 text-white shadow-[0_0_15px_rgba(168,85,247,0.3)] ring-1 ring-violet-400"
                : "border border-white/[0.06] bg-white/[0.03] text-zinc-400 hover:bg-white/[0.08] hover:text-white"
            }`}
          >
            <span>Todos</span>
            <span className="rounded-full bg-white/10 px-1.5 py-0.2 text-[10px] font-bold">
              {counts.all}
            </span>
          </button>

          {(Object.keys(STATUS_CONFIG) as TrackingStatus[]).map((statusKey) => {
            const cfg = STATUS_CONFIG[statusKey];
            const isActive = filter === statusKey;
            const count = counts[statusKey];

            return (
              <button
                key={statusKey}
                type="button"
                onClick={() => setFilter(statusKey)}
                className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                  isActive
                    ? `${cfg.badgeBg} ${cfg.badgeText} ring-1 ${cfg.badgeBorder} shadow-sm`
                    : "border border-white/[0.06] bg-white/[0.03] text-zinc-400 hover:bg-white/[0.08] hover:text-white"
                }`}
              >
                <span>{cfg.label}</span>
                <span className="rounded-full bg-white/10 px-1.5 py-0.2 text-[10px] font-bold tabular-nums">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Resumo Rápido das Estatísticas Reais */}
        {avgScore && (
          <div className="flex items-center gap-3 text-xs text-zinc-400 sm:shrink-0">
            <div className="flex items-center gap-1">
              <Star className="size-3.5 text-amber-400 fill-amber-400" />
              <span className="text-zinc-200 font-semibold tabular-nums">
                {avgScore}
              </span>
              <span>média pessoal</span>
            </div>
          </div>
        )}
      </div>

      {/* Conteúdo: Skeleton, Vazio ou Grade de Obras (3 colunas por linha em telas com espaço suficiente) */}
      {loading ? (
        <div className="grid grid-cols-1 min-[360px]:grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 lg:gap-5">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="aspect-[3/4.2] animate-pulse rounded-2xl bg-white/[0.04]"
            />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-8 sm:p-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-400 mb-3">
            <Film className="size-6" />
          </div>
          <h4 className="text-sm font-semibold text-zinc-300">Nenhum anime encontrado</h4>
          <p className="mt-1 max-w-sm text-xs text-zinc-500 leading-relaxed">
            {filter === "all"
              ? "Você ainda não adicionou nenhum anime à sua lista de acompanhamento."
              : `Nenhum anime com status "${STATUS_CONFIG[filter]?.label || filter}".`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 min-[360px]:grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 lg:gap-5">
          {filteredItems.map((item) => {
            const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.planning;
            const maxEps = item.episodesCount ?? null;
            const watched = item.episodesWatched ?? 0;
            const progressPct =
              maxEps && maxEps > 0
                ? Math.min(100, Math.round((watched / maxEps) * 100))
                : null;

            return (
              <article
                key={item.animeId}
                className="group relative flex flex-col min-w-0 overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0d0c16]/80 p-2 sm:p-2.5 transition-all duration-300 hover:border-violet-500/40 hover:bg-[#121020] hover:shadow-[0_12px_30px_rgba(0,0,0,0.5)]"
              >
                {/* Imagem de Capa com Proporção Cinematográfica preservada */}
                <div className="relative aspect-[3/4.2] w-full overflow-hidden rounded-xl bg-[#161422]">
                  {item.cover ? (
                    <img
                      src={item.cover}
                      alt={item.title}
                      loading="lazy"
                      className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center text-zinc-600">
                      <Film className="size-8" />
                    </div>
                  )}

                  {/* Gradiente escuro para legibilidade */}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/35" />

                  {/* Top badges: Status e Nota pessoal sem sobreposição */}
                  <div className="pointer-events-none absolute inset-x-2 top-2 flex items-start justify-between gap-1.5">
                    <span
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider backdrop-blur-md truncate max-w-[65%] ${cfg.badgeBg} ${cfg.badgeText} border ${cfg.badgeBorder}`}
                    >
                      {cfg.label}
                    </span>

                    {typeof item.score === "number" && item.score > 0 && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-amber-500/40 bg-black/60 px-2 py-0.5 text-[10px] font-bold text-amber-300 backdrop-blur-md">
                        <Star className="size-2.5 fill-amber-400 text-amber-400" />
                        <span>{item.score.toFixed(1)}</span>
                      </span>
                    )}
                  </div>

                  {/* Botão Hover de Play / Acesso Rápido */}
                  <Link
                    to="/anime/$id"
                    params={{ id: item.animeId }}
                    className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-black/40 backdrop-blur-[2px]"
                    aria-label={`Ver ${item.title}`}
                  >
                    <span className="flex size-11 items-center justify-center rounded-full bg-violet-600 text-white shadow-xl transition-transform duration-300 group-hover:scale-110">
                      <Play className="size-5 fill-white ml-0.5" />
                    </span>
                  </Link>

                  {/* Informações na base do pôster */}
                  <div className="pointer-events-none absolute bottom-2 inset-x-2">
                    <div className="flex items-center justify-between text-[10px] font-medium text-zinc-300">
                      <span className="truncate">{item.format || "Anime"}</span>
                      {item.year && <span className="shrink-0">{item.year}</span>}
                    </div>

                    {/* Barra de Progresso se houver episódios conhecidos */}
                    {progressPct !== null && (
                      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/20">
                        <div
                          className="h-full bg-violet-400 transition-all duration-300"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Título e Progresso do Anime: quebra segura, sem invasão aos cards vizinhos */}
                <div className="mt-2.5 min-w-0 flex flex-1 flex-col justify-between pt-0.5 pb-1 px-1">
                  <Link
                    to="/anime/$id"
                    params={{ id: item.animeId }}
                    className="line-clamp-2 text-xs sm:text-sm font-semibold text-zinc-100 transition-colors hover:text-violet-300 break-words leading-snug"
                    title={item.title}
                  >
                    {item.title}
                  </Link>

                  <div className="mt-2.5 flex items-center justify-between gap-2 text-[11px] sm:text-xs text-zinc-400 min-w-0">
                    <span className="tabular-nums truncate">
                      {watched}
                      {maxEps ? ` / ${maxEps}` : " eps"}
                    </span>

                    {item.status === "completed" ? (
                      <span className="flex shrink-0 items-center gap-1 text-emerald-400 font-medium">
                        <CheckCircle2 className="size-3" />
                        <span>Concluído</span>
                      </span>
                    ) : progressPct !== null ? (
                      <span className="shrink-0 text-zinc-400 font-mono text-[10px] sm:text-[11px]">
                        {progressPct}%
                      </span>
                    ) : null}
                  </div>

                  {/* Controles de Edição Direta e Incremento Rápido */}
                  <div className="mt-3 pt-2 border-t border-white/[0.06] flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleQuickIncrement(item);
                      }}
                      disabled={
                        updatingId === item.animeId ||
                        (maxEps !== null && maxEps > 0 && watched >= maxEps)
                      }
                      className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] font-semibold text-zinc-300 transition-all hover:border-violet-500/40 hover:bg-violet-600/20 hover:text-white disabled:opacity-40 disabled:pointer-events-none active:scale-95 cursor-pointer"
                      title={
                        maxEps !== null && maxEps > 0 && watched >= maxEps
                          ? "Todos os episódios assistidos"
                          : "Adicionar 1 episódio assistido (+1)"
                      }
                    >
                      <Plus className="size-3 text-violet-400" />
                      <span>+1 ep</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setEditingItem(item);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-zinc-300 transition-all hover:border-violet-500/40 hover:bg-violet-600/20 hover:text-white active:scale-95 cursor-pointer"
                      title="Editar status, nota e episódios"
                    >
                      <Pencil className="size-3 text-violet-400" />
                      <span>Editar</span>
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Modal de Edição Direta de Anime da Coleção */}
      <ProfileAnimeEditModal
        isOpen={editingItem !== null}
        item={editingItem}
        onClose={() => setEditingItem(null)}
        onSave={handleSaveEdit}
      />
    </div>
  );
}
