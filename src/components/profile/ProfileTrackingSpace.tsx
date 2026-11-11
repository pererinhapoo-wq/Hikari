import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Film,
  Pencil,
  Plus,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ProfileAnimeEditModal } from "@/components/profile/ProfileAnimeEditModal";
import {
  getMyAnimeTrackingPaginated,
  upsertAnimeTracking,
} from "@/lib/profile-tracking.functions";
import { cn } from "@/lib/utils";
import {
  STATUS_CONFIG,
  STATUS_ORDER,
  type TrackingStatus,
  type UserAnimeTrackingItem,
} from "@/types/profile-tracking";

export type FilterOption = "all" | TrackingStatus;

export interface ProfileTrackingSpaceProps {
  items?: UserAnimeTrackingItem[];
  loading?: boolean;
  onUpdateItem?: (updatedItem: UserAnimeTrackingItem) => void;
  activeFilter?: FilterOption;
  onFilterChange?: (filter: FilterOption) => void;
  hideFilterBar?: boolean;
  onCountsChange?: (counts: Record<FilterOption, number>) => void;
}

const PAGE_SIZE = 24;

export function ProfileTrackingSpace({
  items: initialItems,
  loading: initialLoadingProp = false,
  onUpdateItem,
  activeFilter,
  onFilterChange,
  hideFilterBar = false,
  onCountsChange,
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
  const getPaginatedTrackingFn = useServerFn(getMyAnimeTrackingPaginated);

  // Estados de Paginação Real
  const [items, setItems] = useState<UserAnimeTrackingItem[]>(() => initialItems || []);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [dataLoading, setDataLoading] = useState(() => !(initialItems && initialItems.length > 0));
  const [loadingMore, setLoadingMore] = useState(false);
  const [counts, setCounts] = useState<Record<FilterOption, number>>({
    all: 0,
    watching: 0,
    completed: 0,
    on_hold: 0,
    dropped: 0,
    planning: 0,
  });

  // Trava para impedir requisições simultâneas da mesma página
  const fetchingRef = useRef(false);

  // Cache por filtro para alternância instantânea sem perder itens carregados
  const filterCacheRef = useRef<
    Partial<
      Record<
        FilterOption,
        {
          items: UserAnimeTrackingItem[];
          page: number;
          hasMore: boolean;
        }
      >
    >
  >({});

  const animeSentinelRef = useRef<HTMLDivElement>(null);

  // Busca inicial (lote de 24) por filtro
  useEffect(() => {
    let active = true;

    // Se já foi carregado para este filtro na sessão do componente, restaura do cache
    const cached = filterCacheRef.current[filter];
    if (cached) {
      setItems(cached.items);
      setPage(cached.page);
      setHasMore(cached.hasMore);
      setDataLoading(false);
      return;
    }

    setDataLoading(true);
    setItems([]);
    setPage(1);
    setHasMore(true);
    fetchingRef.current = true;

    void getPaginatedTrackingFn({
      data: {
        status: filter === "all" ? undefined : filter,
        page: 1,
        limit: PAGE_SIZE,
      },
    })
      .then((res) => {
        if (!active) return;
        setItems(res.items);
        setPage(1);
        setHasMore(res.hasMore);
        setCounts(res.counts);
        onCountsChange?.(res.counts);

        filterCacheRef.current[filter] = {
          items: res.items,
          page: 1,
          hasMore: res.hasMore,
        };
      })
      .catch((err) => {
        console.warn("Erro ao buscar registros de animes paginados:", err);
      })
      .finally(() => {
        fetchingRef.current = false;
        if (active) setDataLoading(false);
      });

    return () => {
      active = false;
      fetchingRef.current = false;
    };
  }, [filter, getPaginatedTrackingFn, onCountsChange]);

  // Carrega a próxima página (lote de 24) ao se aproximar do fim da lista
  const loadNextPage = useCallback(() => {
    if (fetchingRef.current || !hasMore || dataLoading) return;

    fetchingRef.current = true;
    setLoadingMore(true);

    const nextPage = page + 1;

    void getPaginatedTrackingFn({
      data: {
        status: filter === "all" ? undefined : filter,
        page: nextPage,
        limit: PAGE_SIZE,
      },
    })
      .then((res) => {
        setItems((prev) => {
          // Prevenção estrita de registros duplicados
          const existingIds = new Set(prev.map((i) => i.animeId));
          const uniqueNew = res.items.filter((i) => !existingIds.has(i.animeId));
          const combined = [...prev, ...uniqueNew];

          filterCacheRef.current[filter] = {
            items: combined,
            page: nextPage,
            hasMore: res.hasMore,
          };

          return combined;
        });

        setPage(nextPage);
        setHasMore(res.hasMore);
        setCounts(res.counts);
        onCountsChange?.(res.counts);
      })
      .catch((err) => {
        console.warn("Erro ao paginar mais animes:", err);
      })
      .finally(() => {
        fetchingRef.current = false;
        setLoadingMore(false);
      });
  }, [filter, getPaginatedTrackingFn, hasMore, dataLoading, onCountsChange, page]);

  // IntersectionObserver com rootMargin entre 300px e 400px (350px) para rolagem suave
  useEffect(() => {
    const sentinel = animeSentinelRef.current;
    if (!sentinel || !hasMore || dataLoading || typeof IntersectionObserver === "undefined") {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          loadNextPage();
        }
      },
      { rootMargin: "350px 0px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, dataLoading, loadNextPage]);

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

    setItems((prev) =>
      prev.map((i) => (i.animeId === updatedItem.animeId ? updatedItem : i)),
    );
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

      const finalItem: UserAnimeTrackingItem = {
        ...updatedItem,
        status: res.status,
        score: res.score,
        episodesWatched: res.episodesWatched,
        startedAt: res.startedAt,
        completedAt: res.completedAt,
        updatedAt: res.updatedAt,
      };

      setItems((prev) =>
        prev.map((i) => (i.animeId === finalItem.animeId ? finalItem : i)),
      );

      // Sincroniza cache por filtro
      if (filterCacheRef.current[filter]) {
        filterCacheRef.current[filter]!.items = filterCacheRef.current[filter]!.items.map((i) =>
          i.animeId === finalItem.animeId ? finalItem : i,
        );
      }

      onUpdateItem?.(finalItem);
      toast.success(`Episódio ${nextWatched}${maxEps ? ` de ${maxEps}` : ""} marcado!`);
    } catch (err) {
      setItems((prev) =>
        prev.map((i) => (i.animeId === previousItem.animeId ? previousItem : i)),
      );
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

    setItems((prev) =>
      prev.map((i) => (i.animeId === optimisticItem.animeId ? optimisticItem : i)),
    );
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

      const finalItem: UserAnimeTrackingItem = {
        ...targetItem,
        status: res.status,
        score: res.score,
        episodesWatched: res.episodesWatched,
        startedAt: res.startedAt,
        completedAt: res.completedAt,
        updatedAt: res.updatedAt,
      };

      setItems((prev) =>
        prev.map((i) => (i.animeId === finalItem.animeId ? finalItem : i)),
      );

      if (filterCacheRef.current[filter]) {
        filterCacheRef.current[filter]!.items = filterCacheRef.current[filter]!.items.map((i) =>
          i.animeId === finalItem.animeId ? finalItem : i,
        );
      }

      onUpdateItem?.(finalItem);
      toast.success("Coleção atualizada com sucesso!");
    } catch (err) {
      setItems((prev) =>
        prev.map((i) => (i.animeId === previousItem.animeId ? previousItem : i)),
      );
      onUpdateItem?.(previousItem);
      throw err;
    }
  };

  const isLoading = initialLoadingProp || dataLoading;

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
                ? "bg-purple-600 text-white shadow-[0_0_15px_rgba(168,85,247,0.35)] ring-1 ring-purple-400"
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

      {/* Conteúdo: Skeleton, Vazio ou Grade de Obras (Exatamente 3 cards por linha no mobile) */}
      {isLoading ? (
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {Array.from({ length: 12 }).map((_, idx) => (
            <div key={idx} className="min-w-0">
              <div className="aspect-[2/3] w-full rounded-none bg-[#141224] animate-pulse border border-white/5" />
              <div className="mt-2 h-3.5 w-3/4 rounded-none bg-white/5 animate-pulse" />
              <div className="mt-1 h-2.5 w-1/2 rounded-none bg-white/5 animate-pulse" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-8 sm:p-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-400 mb-3">
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
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
            {items.map((item) => {
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
                  className="group relative flex flex-col min-w-0"
                >
                  {/* Pôster vertical retangular com cantos retos (sem cantos arredondados, sem textos/estrelas sobrepostos) */}
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
                    className="
                      block
                      outline-none
                      focus-visible:ring-2
                      focus-visible:ring-purple-400
                      transition-all
                      duration-150
                      ease-out
                      active:scale-[0.96]
                      active:brightness-110
                      [@media(hover:hover)]:hover:brightness-105
                      motion-reduce:transition-none
                      motion-reduce:transform-none
                      -webkit-tap-highlight-color-transparent
                    "
                  >
                    <div className="
                      relative
                      aspect-[2/3]
                      w-full
                      overflow-hidden
                      rounded-none
                      bg-[#0d0c16]
                      border
                      border-white/10
                      shadow-sm
                      transition-all
                      duration-200
                      ease-out
                      group-hover:border-purple-500/50
                      group-hover:shadow-[0_0_20px_rgba(168,85,247,0.3)]
                      group-active:border-purple-400
                      group-active:shadow-[0_0_25px_rgba(168,85,247,0.45)]
                    ">
                      {item.cover ? (
                        <img
                          src={item.cover}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="
                            size-full
                            object-cover
                            transition-transform
                            duration-300
                            ease-out
                            group-hover:scale-[1.03]
                            group-active:scale-[1.01]
                            motion-reduce:transform-none
                          "
                        />
                      ) : (
                        <div className="flex size-full items-center justify-center font-display text-base text-zinc-600">
                          {item.title.slice(0, 1)}
                        </div>
                      )}
                    </div>
                  </Link>

                  {/* Informações estritamente FORA do pôster */}
                  <div className="mt-2 flex flex-col px-0.5 min-w-0">
                    {/* Título abaixo do pôster */}
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
                      className="truncate text-xs sm:text-sm font-medium text-zinc-100 transition-colors group-hover:text-purple-300 group-active:text-purple-200"
                      title={item.title}
                    >
                      {item.title}
                    </Link>

                    {/* Informações secundárias: Status · Episódios (sem notas nem estrelas) */}
                    <div className="mt-0.5 flex items-center gap-1.5 text-[10.5px] sm:text-xs text-zinc-400 truncate">
                      <span className={cn("font-medium shrink-0", cfg.badgeText || "text-purple-400")}>
                        {cfg.label}
                      </span>
                      <span>·</span>
                      <span className="tabular-nums truncate">
                        {watched}{maxEps ? ` / ${maxEps}` : " eps"}
                      </span>
                    </div>

                    {/* Barra de Progresso minimalista se houver episódios conhecidos */}
                    {progressPct !== null && (
                      <div className="mt-1 h-1 w-full overflow-hidden rounded-none bg-white/10">
                        <div
                          className="h-full bg-purple-500 transition-all duration-300"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    )}

                    {/* Controles de Incremento Rápido e Edição */}
                    <div
                      className={`mt-2 flex items-center justify-between gap-1 pt-1 border-t border-white/[0.06] transition-all duration-200 ${
                        isMobileActive
                          ? "opacity-100"
                          : "opacity-80 sm:opacity-0 sm:group-hover:opacity-100"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleQuickIncrement(item);
                        }}
                        disabled={isButtonDisabled}
                        className={`inline-flex items-center justify-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold transition-all shrink-0 ${
                          isButtonDisabled
                            ? "border border-white/10 bg-white/[0.04] text-zinc-500 cursor-not-allowed opacity-60"
                            : "border border-purple-500/35 bg-purple-500/15 text-purple-200 hover:border-purple-400/60 hover:bg-purple-600/30 hover:text-white active:scale-95 cursor-pointer"
                        }`}
                        title={
                          isCompletedOrMax
                            ? "Todos os episódios assistidos"
                            : isUpdating
                              ? "Atualizando..."
                              : "Adicionar 1 episódio assistido (+1)"
                        }
                      >
                        <Plus className="size-2.5 shrink-0 stroke-[2.5]" />
                        <span>1 ep</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setEditingItem(item);
                        }}
                        className="inline-flex items-center justify-center gap-0.5 rounded border border-white/15 bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-semibold text-zinc-200 transition-all hover:border-purple-500/40 hover:bg-purple-600/20 hover:text-white active:scale-95 cursor-pointer shrink-0"
                        title="Editar status e episódios"
                      >
                        <Pencil className="size-2.5 text-purple-300 shrink-0" />
                        <span>Editar</span>
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Sentinela de carregamento automático na rolagem (sem botão Carregar mais) */}
          <div ref={animeSentinelRef} className="h-6" aria-hidden="true" />
          {loadingMore && (
            <div className="py-4 flex items-center justify-center gap-2 text-xs text-zinc-400">
              <div className="size-3.5 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
              <span>Carregando mais animes...</span>
            </div>
          )}
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
