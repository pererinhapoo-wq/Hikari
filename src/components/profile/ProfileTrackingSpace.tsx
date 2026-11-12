import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Film,
  Pencil,
  Plus,
  Search,
  Star,
  X,
} from "lucide-react";
import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ProfileAnimeEditModal } from "@/components/profile/ProfileAnimeEditModal";
import {
  getMyAnimeTrackingPaginated,
  getPublicAnimeTrackingPaginated,
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
export type SortOption = "updatedAt" | "title" | "score" | "episodes";

export interface ProfileTrackingSpaceProps {
  items?: UserAnimeTrackingItem[];
  loading?: boolean;
  onUpdateItem?: (updatedItem: UserAnimeTrackingItem) => void;
  activeFilter?: FilterOption;
  onFilterChange?: (filter: FilterOption) => void;
  hideFilterBar?: boolean;
  onCountsChange?: (counts: Record<FilterOption, number>) => void;
  targetUserId?: string;
  readOnly?: boolean;
}

const PAGE_SIZE = 24;

interface AnimeTrackingCardProps {
  item: UserAnimeTrackingItem;
  isUpdating: boolean;
  isMobileActive: boolean;
  readOnly?: boolean;
  onCardClick: (e: React.MouseEvent, animeId: string) => void;
  onQuickIncrement: (item: UserAnimeTrackingItem) => void;
  onEdit: (item: UserAnimeTrackingItem) => void;
}

/**
 * Card individual de anime memoizado com React.memo.
 * Impede que a alteração de um único card (ex: +1 ep ou edição) provoque
 * a re-renderização de toda a lista de 24, 48 ou milhares de itens montados.
 */
const AnimeTrackingCard = React.memo(function AnimeTrackingCard({
  item,
  isUpdating,
  isMobileActive,
  readOnly = false,
  onCardClick,
  onQuickIncrement,
  onEdit,
}: AnimeTrackingCardProps) {
  const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.planning;
  const maxEps = item.episodesCount ?? null;
  const watched = item.episodesWatched ?? 0;
  const progressPct =
    maxEps && maxEps > 0
      ? Math.min(100, Math.round((watched / maxEps) * 100))
      : null;
  const isCompletedOrMax =
    maxEps !== null && maxEps > 0 && watched >= maxEps;
  const isButtonDisabled = isUpdating || isCompletedOrMax;

  return (
    <article
      data-card-id={item.animeId}
      onClick={(e) => onCardClick(e, item.animeId)}
      className="group relative flex flex-col min-w-0"
    >
      {/* Pôster vertical retangular com cantos retos (sem cantos arredondados, sem textos/estrelas sobrepostos) */}
      <Link
        to="/anime/$id"
        params={{ id: item.animeId }}
        onClick={(e) => {
          onCardClick(e, item.animeId);
        }}
        className="
          block
          outline-none
          focus-visible:ring-2
          focus-visible:ring-purple-400
          transition-transform
          duration-150
          ease-out
          active:scale-[0.96]
          active:brightness-110
          [@media(hover:hover)_and_(pointer:fine)]:hover:brightness-105
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
          transition-colors
          duration-200
          ease-out
          [@media(hover:hover)_and_(pointer:fine)]:group-hover:border-purple-500/50
          group-active:border-purple-400
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
                [@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-[1.03]
                group-active:scale-[1.01]
                motion-reduce:transform-none
              "
            />
          ) : (
            <div className="flex size-full items-center justify-center font-display text-base text-zinc-600">
              {item.title.slice(0, 1)}
            </div>
          )}

          {/* Camada de sombra/glow acelerada por GPU via opacidade, evitando repaint da box-shadow */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-none shadow-[0_0_20px_rgba(168,85,247,0.35)] opacity-0 transition-opacity duration-200 ease-out [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100 group-active:opacity-100"
          />

          {/* Indicador discreto de nota pessoal sobreposto à imagem do anime */}
          {typeof item.score === "number" && item.score > 0 && (
            <div
              className="absolute top-1.5 left-1.5 z-10 flex items-center gap-1 rounded bg-[#0b0914]/90 border border-purple-500/35 px-1.5 py-0.5 text-[10px] font-bold text-purple-200 backdrop-blur-md shadow-sm select-none"
              title={`Nota pessoal: ${item.score}/10`}
            >
              <Star className="size-2.5 text-[#c084fc] fill-[#c084fc]/50" />
              <span className="tabular-nums leading-none">
                {Number(item.score).toFixed(item.score % 1 === 0 ? 0 : 1)}
              </span>
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
            onCardClick(e, item.animeId);
          }}
          className="truncate text-xs sm:text-sm font-medium text-zinc-100 transition-colors duration-150 [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-purple-300 group-active:text-purple-200"
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

        {/* Controles de Incremento Rápido e Edição (somente no próprio perfil) */}
        {!readOnly && (
          <div
            className={`mt-2 flex items-center justify-between gap-1 pt-1 border-t border-white/[0.06] transition-opacity duration-200 ${
              isMobileActive
                ? "opacity-100"
                : "opacity-80 sm:opacity-0 [@media(hover:hover)_and_(pointer:fine)]:sm:group-hover:opacity-100"
            }`}
          >
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onQuickIncrement(item);
              }}
              disabled={isButtonDisabled}
              className={`inline-flex items-center justify-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold transition-transform duration-100 ease-out shrink-0 ${
                isButtonDisabled
                  ? "border border-white/10 bg-white/[0.04] text-zinc-500 cursor-not-allowed opacity-60"
                  : "border border-purple-500/35 bg-purple-500/15 text-purple-200 [@media(hover:hover)_and_(pointer:fine)]:hover:border-purple-400/60 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-purple-600/30 [@media(hover:hover)_and_(pointer:fine)]:hover:text-white active:scale-95 cursor-pointer"
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
                onEdit(item);
              }}
              className="inline-flex items-center justify-center gap-0.5 rounded border border-white/15 bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-semibold text-zinc-200 transition-transform duration-100 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:border-purple-500/40 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-purple-600/20 [@media(hover:hover)_and_(pointer:fine)]:hover:text-white active:scale-95 cursor-pointer shrink-0"
              title="Editar status e episódios"
            >
              <Pencil className="size-2.5 text-purple-300 shrink-0" />
              <span>Editar</span>
            </button>
          </div>
        )}
      </div>
    </article>
  );
});

export const ProfileTrackingSpace = React.memo(function ProfileTrackingSpace({
  items: initialItems,
  loading: initialLoadingProp = false,
  onUpdateItem,
  activeFilter,
  onFilterChange,
  hideFilterBar = false,
  onCountsChange,
  targetUserId,
  readOnly = false,
}: ProfileTrackingSpaceProps) {
  const isReadOnly = Boolean(readOnly || targetUserId);
  const [internalFilter, setInternalFilter] = useState<FilterOption>("all");
  const filter = activeFilter !== undefined ? activeFilter : internalFilter;

  // Busca e Ordenação
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearch = useDeferredValue(searchQuery);
  const [sortBy, setSortBy] = useState<SortOption>("updatedAt");

  const handleFilterChange = useCallback((newFilter: FilterOption) => {
    if (activeFilter === undefined) {
      setInternalFilter(newFilter);
    }
    onFilterChange?.(newFilter);
  }, [activeFilter, onFilterChange]);

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

  const isMobileOrTouch = useCallback((e?: React.SyntheticEvent) => {
    if (typeof window === "undefined") return false;
    if (e && "nativeEvent" in e && e.nativeEvent instanceof PointerEvent) {
      if (e.nativeEvent.pointerType === "touch") return true;
    }
    const isCoarse = window.matchMedia?.("(hover: none), (pointer: coarse)")?.matches;
    const isMobileWidth = window.innerWidth < 768;
    return Boolean(isCoarse || isMobileWidth);
  }, []);

  const handleCardClick = useCallback((e: React.MouseEvent, animeId: string) => {
    if (isReadOnly) return;
    if (isMobileOrTouch(e) && activeMobileCardId !== animeId) {
      // Primeiro toque no card no mobile: revela os controles sem acionar ação acidental
      e.preventDefault();
      e.stopPropagation();
      setActiveMobileCardId(animeId);
    }
  }, [activeMobileCardId, isMobileOrTouch, isReadOnly]);

  const upsertTrackingFn = useServerFn(upsertAnimeTracking);
  const getPaginatedTrackingFn = useServerFn(getMyAnimeTrackingPaginated);
  const getPublicPaginatedTrackingFn = useServerFn(getPublicAnimeTrackingPaginated);

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

  // Índice em memória (Set) de IDs carregados por filtro para deduplicação O(1) sem alocação
  const loadedIdSetsRef = useRef<Map<FilterOption, Set<string>>>(new Map());
  const lastTargetUserIdRef = useRef<string | undefined>(targetUserId);

  const animeSentinelRef = useRef<HTMLDivElement>(null);

  // Busca inicial (lote de 24) por filtro
  useEffect(() => {
    let active = true;

    if (lastTargetUserIdRef.current !== targetUserId) {
      filterCacheRef.current = {};
      loadedIdSetsRef.current.clear();
      lastTargetUserIdRef.current = targetUserId;
    }

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

    const requestPromise = targetUserId
      ? getPublicPaginatedTrackingFn({
          data: {
            userId: targetUserId,
            status: filter === "all" ? undefined : filter,
            page: 1,
            limit: PAGE_SIZE,
          },
        })
      : getPaginatedTrackingFn({
          data: {
            status: filter === "all" ? undefined : filter,
            page: 1,
            limit: PAGE_SIZE,
          },
        });

    void requestPromise
      .then((res) => {
        if (!active) return;
        setItems(res.items);
        setPage(1);
        setHasMore(res.hasMore);
        setCounts(res.counts);
        onCountsChange?.(res.counts);

        // Atualiza índice de IDs
        const idSet = new Set<string>();
        for (let i = 0; i < res.items.length; i++) {
          idSet.add(res.items[i].animeId);
        }
        loadedIdSetsRef.current.set(filter, idSet);

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
  }, [
    filter,
    targetUserId,
    getPaginatedTrackingFn,
    getPublicPaginatedTrackingFn,
    onCountsChange,
  ]);

  // Carrega a próxima página (lote de 24) ao se aproximar do fim da lista
  const loadNextPage = useCallback(() => {
    if (fetchingRef.current || !hasMore || dataLoading) return;

    fetchingRef.current = true;
    setLoadingMore(true);

    const nextPage = page + 1;

    const requestPromise = targetUserId
      ? getPublicPaginatedTrackingFn({
          data: {
            userId: targetUserId,
            status: filter === "all" ? undefined : filter,
            page: nextPage,
            limit: PAGE_SIZE,
          },
        })
      : getPaginatedTrackingFn({
          data: {
            status: filter === "all" ? undefined : filter,
            page: nextPage,
            limit: PAGE_SIZE,
          },
        });

    void requestPromise
      .then((res) => {
        setItems((prev) => {
          // Prevenção estrita de registros duplicados com Set index O(1)
          let idSet = loadedIdSetsRef.current.get(filter);
          if (!idSet) {
            idSet = new Set(prev.map((i) => i.animeId));
            loadedIdSetsRef.current.set(filter, idSet);
          }

          const uniqueNew: UserAnimeTrackingItem[] = [];
          for (let i = 0; i < res.items.length; i++) {
            const it = res.items[i];
            if (!idSet.has(it.animeId)) {
              idSet.add(it.animeId);
              uniqueNew.push(it);
            }
          }

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
  }, [
    filter,
    targetUserId,
    getPaginatedTrackingFn,
    getPublicPaginatedTrackingFn,
    hasMore,
    dataLoading,
    onCountsChange,
    page,
  ]);

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

  // Callback estável para incremento rápido (+1 ep)
  const handleQuickIncrement = useCallback(async (item: UserAnimeTrackingItem) => {
    if (isReadOnly) return;
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
  }, [filter, isReadOnly, onUpdateItem, upsertTrackingFn]);

  // Callback estável para salvar edição completa
  const handleSaveEdit = useCallback(async (data: {
    animeId: string;
    status: TrackingStatus;
    score: number | null;
    episodesWatched: number;
  }) => {
    if (isReadOnly || !editingItem) return;
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
  }, [editingItem, filter, isReadOnly, onUpdateItem, upsertTrackingFn]);

  // Estrutura de busca e ordenação em memória otimizada com useDeferredValue
  const processedItems = useMemo(() => {
    let result = items;
    const q = deferredSearch.trim().toLowerCase();

    if (q) {
      result = result.filter((item) => {
        const title = (item.title || "").toLowerCase();
        const titleRomaji = (item.titleRomaji || "").toLowerCase();
        const titleEnglish = (item.titleEnglish || "").toLowerCase();
        const titleNative = (item.titleNative || "").toLowerCase();
        return (
          title.includes(q) ||
          titleRomaji.includes(q) ||
          titleEnglish.includes(q) ||
          titleNative.includes(q)
        );
      });
    }

    if (sortBy === "title") {
      return [...result].sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    }
    if (sortBy === "score") {
      return [...result].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
    }
    if (sortBy === "episodes") {
      return [...result].sort(
        (a, b) => (b.episodesWatched ?? 0) - (a.episodesWatched ?? 0),
      );
    }

    // Padrão: "updatedAt" (ordem cronológica decrescente original do banco)
    return result;
  }, [items, deferredSearch, sortBy]);

  const isLoading = initialLoadingProp || dataLoading;

  return (
    <div className="space-y-6">
      {/* Barra de Filtros, Busca e Ordenação */}
      {!hideFilterBar && (
        <div className="space-y-3">
          {/* Linha de Busca e Ordenação */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            {/* Campo de Busca por Título (Otimizado com useDeferredValue) */}
            <div className="relative flex-1 max-w-sm sm:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por título na coleção..."
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] pl-9 pr-8 py-2 text-xs text-white placeholder-zinc-500 outline-none transition-all focus:border-purple-500/50 focus:bg-white/[0.06] focus:ring-1 focus:ring-purple-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors cursor-pointer p-0.5"
                  title="Limpar busca"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            {/* Seletor de Ordenação */}
            <div className="flex items-center gap-1.5 self-start sm:self-auto text-xs text-zinc-400">
              <span className="text-[11px] font-medium text-zinc-400">Ordenar:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="rounded-xl border border-white/[0.08] bg-[#12101e] px-2.5 py-1.5 text-xs text-zinc-200 outline-none transition-all focus:border-purple-500/50 cursor-pointer"
              >
                <option value="updatedAt">Atualizados</option>
                <option value="score">Melhor Nota</option>
                <option value="title">Título A-Z</option>
                <option value="episodes">Episódios</option>
              </select>
            </div>
          </div>

          {/* Barra de Filtros e Contadores de Status Clicáveis */}
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
      ) : processedItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-8 sm:p-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-400 mb-3">
            {searchQuery ? <Search className="size-6" /> : <Film className="size-6" />}
          </div>
          <h4 className="text-sm font-semibold text-zinc-300">
            {searchQuery ? `Nenhum resultado para "${searchQuery}"` : "Nenhum anime encontrado"}
          </h4>
          <p className="mt-1 max-w-sm text-xs text-zinc-500 leading-relaxed">
            {searchQuery
              ? "Tente buscar por outro termo ou limpe a busca para visualizar os animes disponíveis."
              : filter === "all"
                ? isReadOnly
                  ? "Este usuário ainda não adicionou nenhum anime à sua lista de acompanhamento."
                  : "Você ainda não adicionou nenhum anime à sua lista de acompanhamento."
                : `Nenhum anime com status "${STATUS_CONFIG[filter]?.label || filter}".`}
          </p>
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="mt-4 rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-white/10 hover:text-white transition cursor-pointer"
            >
              Limpar busca
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
            {processedItems.map((item) => (
              <AnimeTrackingCard
                key={item.animeId}
                item={item}
                isUpdating={updatingId === item.animeId}
                isMobileActive={activeMobileCardId === item.animeId}
                readOnly={isReadOnly}
                onCardClick={handleCardClick}
                onQuickIncrement={handleQuickIncrement}
                onEdit={setEditingItem}
              />
            ))}
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

      {/* Modal de Edição Direta de Anime da Coleção (somente no próprio perfil) */}
      {!isReadOnly && editingItem && (
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
});
