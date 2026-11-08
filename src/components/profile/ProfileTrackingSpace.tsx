import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  CheckCircle2,
  Film,
  Pencil,
  Play,
  Plus,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ProfileAnimeEditModal } from "@/components/profile/ProfileAnimeEditModal";
import { upsertAnimeTracking } from "@/lib/profile-tracking.functions";
import {
  STATUS_CONFIG,
  STATUS_ORDER,
  type TrackingStatus,
  type UserAnimeTrackingItem,
} from "@/types/profile-tracking";

export type FilterOption = "all" | TrackingStatus;

export interface ProfileTrackingSpaceProps {
  items: UserAnimeTrackingItem[];
  loading?: boolean;
  onUpdateItem?: (updatedItem: UserAnimeTrackingItem) => void;
  activeFilter?: FilterOption;
  onFilterChange?: (filter: FilterOption) => void;
  hideFilterBar?: boolean;
}

export function ProfileTrackingSpace({
  items,
  loading = false,
  onUpdateItem,
  activeFilter,
  onFilterChange,
  hideFilterBar = false,
}: ProfileTrackingSpaceProps) {
  const [internalFilter, setInternalFilter] = useState<FilterOption>("all");
  const filter = activeFilter !== undefined ? activeFilter : internalFilter;

  const handleFilterChange = (newFilter: FilterOption) => {
    if (activeFilter === undefined) {
      setInternalFilter(newFilter);
    }
    onFilterChange?.(newFilter);
  };

  const [editingItem, setEditingItem] = useState<UserAnimeTrackingItem | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [activeMobileCardId, setActiveMobileCardId] = useState<string | null>(null);

  // Oculta controles no mobile ao tocar fora de qualquer card ativo
  useEffect(() => {
    if (!activeMobileCardId) return;

    const handlePointerDownOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest(`[data-card-id="${activeMobileCardId}"]`)) {
        setActiveMobileCardId(null);
      }
    };

    document.addEventListener("pointerdown", handlePointerDownOutside);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDownOutside);
    };
  }, [activeMobileCardId]);

  const isMobileOrTouch = (e?: React.SyntheticEvent) => {
    if (typeof window === "undefined") return false;
    if (e && "nativeEvent" in e && e.nativeEvent instanceof PointerEvent) {
      if (e.nativeEvent.pointerType === "touch") return true;
    }
    const isCoarse = window.matchMedia?.("(hover: none), (pointer: coarse)")?.matches;
    const isMobileWidth = window.innerWidth < 768;
    return Boolean(isCoarse || isMobileWidth);
  };

  const handleCardClick = (e: React.MouseEvent, animeId: string) => {
    if (isMobileOrTouch(e) && activeMobileCardId !== animeId) {
      // Primeiro toque no card no mobile: revela os controles sem acionar ação acidental
      e.preventDefault();
      e.stopPropagation();
      setActiveMobileCardId(animeId);
    }
  };

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

    // Ao marcar como Concluído, preenche automaticamente com o total real de episódios do anime
    const maxEps =
      targetItem.episodesCount ?? targetItem.animeSnapshot?.episodesCount ?? null;
    const resolvedEpisodes =
      data.status === "completed" && maxEps !== null && maxEps > 0
        ? maxEps
        : data.episodesWatched;

    const optimisticItem: UserAnimeTrackingItem = {
      ...targetItem,
      status: data.status,
      score: data.score,
      episodesWatched: resolvedEpisodes,
    };
    onUpdateItem?.(optimisticItem);

    try {
      const res = await upsertTrackingFn({
        data: {
          animeId: data.animeId,
          status: data.status,
          score: data.score,
          episodesWatched: resolvedEpisodes,
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

  return (
    <div className="space-y-6">
      {/* Barra de Filtros e Contadores de Status Clicáveis */}
      {!hideFilterBar && (
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar pb-1">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              handleFilterChange("all");
            }}
            className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all cursor-pointer ${
              filter === "all"
                ? "bg-violet-600 text-white shadow-[0_0_15px_rgba(168,85,247,0.35)] ring-1 ring-violet-400"
                : "border border-white/[0.06] bg-white/[0.03] text-zinc-400 hover:bg-white/[0.08] hover:text-white"
            }`}
          >
            <span>Todos</span>
            <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-bold tabular-nums">
              {counts.all}
            </span>
          </button>

          {STATUS_ORDER.map((statusKey) => {
            const cfg = STATUS_CONFIG[statusKey];
            const isActive = filter === statusKey;
            const count = counts[statusKey];

            return (
              <button
                key={statusKey}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  handleFilterChange(statusKey);
                }}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? `${cfg.activeStyle}`
                    : "border border-white/[0.06] bg-white/[0.03] text-zinc-400 hover:bg-white/[0.08] hover:text-white"
                }`}
              >
                <span>{cfg.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                    isActive ? "bg-white/20 text-white" : "bg-white/10 text-zinc-400"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Conteúdo: Skeleton, Vazio ou Grade de Obras (Exatamente 3 cards por linha) */}
      {loading ? (
        <div className="grid grid-cols-3 gap-2.5 sm:gap-4 lg:gap-5">
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
        <div className="grid grid-cols-3 gap-2.5 sm:gap-4 lg:gap-5">
          {filteredItems.map((item) => {
            const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.planning;
            const maxEps = item.episodesCount ?? null;
            const watched = item.episodesWatched ?? 0;
            const progressPct =
              maxEps && maxEps > 0
                ? Math.min(100, Math.round((watched / maxEps) * 100))
                : null;
            const isMobileActive = activeMobileCardId === item.animeId;
            const isCompletedOrMax =
              maxEps !== null && maxEps > 0 && watched >= maxEps;
            const isUpdating = updatingId === item.animeId;
            const isButtonDisabled = isUpdating || isCompletedOrMax;

            return (
              <article
                key={item.animeId}
                data-card-id={item.animeId}
                onClick={(e) => handleCardClick(e, item.animeId)}
                className={`group relative flex flex-col min-w-0 overflow-hidden rounded-2xl border p-1.5 sm:p-2.5 transition-all duration-300 hover:border-violet-500/40 hover:bg-[#121020] hover:shadow-[0_12px_30px_rgba(0,0,0,0.5)] ${
                  isMobileActive
                    ? "border-violet-500/50 bg-[#121020] shadow-[0_8px_25px_rgba(0,0,0,0.5)]"
                    : "border-white/[0.07] bg-[#0d0c16]/80"
                }`}
              >
                {/* Imagem de Capa com Proporção Cinematográfica 3/4.2 */}
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
                      <Film className="size-6 sm:size-8" />
                    </div>
                  )}

                  {/* Gradiente escuro para legibilidade */}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/35" />

                  {/* Top badge: Status do anime (sem exibição de nota ou média pessoal) */}
                  <div className="pointer-events-none absolute left-1.5 top-1.5 sm:left-2 sm:top-2">
                    <span
                      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider backdrop-blur-md border ${cfg.badgeBg} ${cfg.badgeText} ${cfg.badgeBorder}`}
                    >
                      {cfg.label}
                    </span>
                  </div>

                  {/* Botão Hover de Play / Acesso Rápido — primeiro toque no mobile revela controles */}
                  <Link
                    to="/anime/$id"
                    params={{ id: item.animeId }}
                    onClick={(e) => {
                      if (isMobileOrTouch(e) && activeMobileCardId !== item.animeId) {
                        e.preventDefault();
                        e.stopPropagation();
                        setActiveMobileCardId(item.animeId);
                      }
                    }}
                    className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-black/40 backdrop-blur-[2px]"
                    aria-label={`Ver ${item.title}`}
                  >
                    <span className="flex size-8 sm:size-11 items-center justify-center rounded-full bg-violet-600 text-white shadow-xl transition-transform duration-300 group-hover:scale-110">
                      <Play className="size-3.5 sm:size-5 fill-white ml-0.5" />
                    </span>
                  </Link>

                  {/* Informações na base do pôster */}
                  <div className="pointer-events-none absolute bottom-1.5 sm:bottom-2 inset-x-1.5 sm:inset-x-2">
                    <div className="flex items-center justify-between text-[9px] sm:text-[10px] font-medium text-zinc-300">
                      <span className="truncate">{item.format || "Anime"}</span>
                      {item.year && <span className="shrink-0">{item.year}</span>}
                    </div>

                    {/* Barra de Progresso se houver episódios conhecidos */}
                    {progressPct !== null && (
                      <div className="mt-1 sm:mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/20">
                        <div
                          className="h-full bg-violet-400 transition-all duration-300"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Título e Progresso do Anime: legível em 3 colunas, sem corte nem sobreposição */}
                <div className="mt-2 min-w-0 flex flex-1 flex-col justify-between pt-0.5 pb-0.5 px-0.5 sm:px-1">
                  <Link
                    to="/anime/$id"
                    params={{ id: item.animeId }}
                    onClick={(e) => {
                      if (isMobileOrTouch(e) && activeMobileCardId !== item.animeId) {
                        e.preventDefault();
                        e.stopPropagation();
                        setActiveMobileCardId(item.animeId);
                      }
                    }}
                    className="line-clamp-2 text-[11px] sm:text-xs md:text-sm font-semibold text-zinc-100 transition-colors hover:text-violet-300 break-words leading-tight sm:leading-snug"
                    title={item.title}
                  >
                    {item.title}
                  </Link>

                  <div className="mt-1.5 sm:mt-2.5 flex items-center justify-between gap-1 text-[10px] sm:text-xs text-zinc-400 min-w-0">
                    <span className="tabular-nums truncate">
                      {watched}
                      {maxEps ? ` / ${maxEps}` : " eps"}
                    </span>

                    {item.status === "completed" ? (
                      <span className="flex shrink-0 items-center gap-0.5 sm:gap-1 text-emerald-400 font-medium text-[9px] sm:text-xs">
                        <CheckCircle2 className="size-2.5 sm:size-3" />
                        <span className="hidden min-[400px]:inline">Concluído</span>
                      </span>
                    ) : progressPct !== null ? (
                      <span className="shrink-0 text-zinc-400 font-mono text-[9px] sm:text-[11px]">
                        {progressPct}%
                      </span>
                    ) : null}
                  </div>

                  {/* 3. Controles de Edição Direta e Incremento Rápido com Revelação Animada (Hover no desktop, toque no mobile) */}
                  <div
                    className={`mt-2 pt-1.5 sm:mt-3 sm:pt-2 border-t border-white/[0.06] flex items-center justify-between gap-1 sm:gap-2 transition-all duration-200 ease-out ${
                      isMobileActive
                        ? "opacity-100 translate-y-0 pointer-events-auto"
                        : "opacity-0 translate-y-1 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto"
                    }`}
                  >
                    {/* 2. Botão +1 ep com alto contraste, legibilidade nítida e estado desabilitado discreto */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (isMobileOrTouch(e) && activeMobileCardId !== item.animeId) {
                          setActiveMobileCardId(item.animeId);
                          return;
                        }
                        handleQuickIncrement(item);
                      }}
                      disabled={isButtonDisabled}
                      className={`inline-flex items-center justify-center gap-0.5 sm:gap-1 rounded-lg px-1.5 sm:px-2 py-1 text-[10px] sm:text-[11px] font-semibold transition-all shrink-0 ${
                        isButtonDisabled
                          ? "border border-white/10 bg-white/[0.04] text-zinc-400 opacity-65 cursor-not-allowed pointer-events-none"
                          : "border border-violet-500/35 bg-violet-500/15 text-zinc-100 shadow-[0_2px_8px_rgba(139,92,246,0.12)] hover:border-violet-400/60 hover:bg-violet-600/30 hover:text-white active:scale-95 cursor-pointer"
                      }`}
                      title={
                        isCompletedOrMax
                          ? "Todos os episódios assistidos"
                          : isUpdating
                          ? "Atualizando episódio..."
                          : "Adicionar 1 episódio assistido (+1)"
                      }
                    >
                      <Plus
                        className={`size-2.5 sm:size-3 shrink-0 ${
                          isButtonDisabled
                            ? "text-zinc-500 stroke-[2]"
                            : "text-violet-300 stroke-[2.5]"
                        }`}
                      />
                      <span>1 ep</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (isMobileOrTouch(e) && activeMobileCardId !== item.animeId) {
                          setActiveMobileCardId(item.animeId);
                          return;
                        }
                        setEditingItem(item);
                      }}
                      className="inline-flex items-center justify-center gap-0.5 sm:gap-1.5 rounded-lg border border-white/15 bg-white/[0.06] px-1.5 sm:px-2.5 py-1 text-[10px] sm:text-[11px] font-semibold text-zinc-200 transition-all hover:border-violet-500/40 hover:bg-violet-600/20 hover:text-white active:scale-95 cursor-pointer shrink-0"
                      title="Editar status, nota e episódios"
                    >
                      <Pencil className="size-2.5 sm:size-3 text-violet-300 shrink-0 stroke-[2]" />
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
      {editingItem && (
        <ProfileAnimeEditModal
          key={editingItem.animeId}
          isOpen={true}
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSave={handleSaveEdit}
        />
      )}
    </div>
  );
}
