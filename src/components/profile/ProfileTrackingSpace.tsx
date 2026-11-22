import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ChevronDown,
  Check,
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
import { ProfileAnimeImage } from "@/components/profile/ProfileAnimeImage";
import {
  getMyAnimeTrackingPaginated,
  getPublicAnimeTrackingPaginated,
  upsertAnimeTracking,
} from "@/lib/profile-tracking.functions";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { clearAnimeUserClientCache } from "@/lib/anime-user-client-cache";
import { invalidateWatchedEpisodesCache } from "@/lib/store";
import { triggerMonetagSmartLinkOnNavigationClick } from "@/lib/monetag-smartlink";
import {
  getCachedPaginatedTracking,
  invalidatePaginatedTrackingCache,
  markTrackingMutated,
  seedAnimeTrackingCache,
  setCachedPaginatedTracking,
  fetchPaginatedTrackingSingleflight,
} from "@/lib/tracking-client-cache";
import {
  getKnownViewerId,
  invalidateAccountProfileCache,
  invalidatePublicProfileCacheByUserId,
} from "@/lib/profile-client-cache";
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
  initialCounts?: Record<FilterOption, number> | null;
  loading?: boolean;
  onUpdateItem?: (
    updatedItem: UserAnimeTrackingItem,
    previousAnimeId?: string,
    previousItem?: UserAnimeTrackingItem,
    settled?: boolean,
  ) => void;
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

interface SortDropdownMenuProps {
  sortBy: SortOption;
  setSortBy: (s: SortOption) => void;
}

function SortDropdownMenu({ sortBy, setSortBy }: SortDropdownMenuProps) {
  const sortLabels: Record<SortOption, string> = {
    updatedAt: "Atualizados",
    score: "Melhor Nota",
    title: "Título A-Z",
    episodes: "Episódios",
  };
  const [sortOpen, setSortOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
    };
    if (sortOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [sortOpen]);

  return (
    <div ref={dropdownRef} className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setSortOpen(!sortOpen)}
        className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-[#12101e] px-3 py-1.5 text-xs font-semibold text-zinc-200 transition-all hover:border-purple-500/40 hover:bg-[#1a172e] focus:outline-none focus:ring-1 focus:ring-purple-400 cursor-pointer shadow-sm"
      >
        <span className="text-zinc-400 font-normal">Ordenar:</span>
        <span className="text-white font-medium">{sortLabels[sortBy]}</span>
        <ChevronDown
          className={cn(
            "size-3.5 text-purple-400 transition-transform duration-200",
            sortOpen && "rotate-180",
          )}
        />
      </button>

      {sortOpen && (
        <div className="absolute right-0 top-full mt-1.5 z-50 w-44 origin-top-right overflow-hidden rounded-xl border border-purple-500/25 bg-[#0d0b16] p-1 shadow-[0_16px_40px_rgba(0,0,0,0.85)] backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
          {(Object.keys(sortLabels) as SortOption[]).map((optionKey) => {
            const isSelected = sortBy === optionKey;
            return (
              <button
                key={optionKey}
                type="button"
                onClick={() => {
                  setSortBy(optionKey);
                  setSortOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-colors cursor-pointer",
                  isSelected
                    ? "bg-purple-600/25 text-purple-200 font-semibold border border-purple-500/30 shadow-inner"
                    : "text-zinc-300 hover:bg-white/[0.06] hover:text-white",
                )}
              >
                <span>{sortLabels[optionKey]}</span>
                {isSelected && <Check className="size-3.5 text-purple-400 shrink-0 ml-2" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
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
          triggerMonetagSmartLinkOnNavigationClick(e);
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
          <ProfileAnimeImage
            src={item.cover}
            alt=""
            loading="lazy"
            decoding="async"
            fallbackClassName="bg-[#0d0c16]"
            className="
              size-full
              object-cover
              [@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-[1.03]
              group-active:scale-[1.01]
              motion-reduce:transform-none
            "
          />

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
            triggerMonetagSmartLinkOnNavigationClick(e);
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
  initialCounts = null,
  loading: _initialLoadingProp = false,
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
  const updatingIdsRef = useRef<Set<string>>(new Set());
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

  const { user: currentViewer } = useCurrentUserState();
  const effectiveViewerId = currentViewer?.id ?? getKnownViewerId() ?? null;

  const upsertTrackingFn = useServerFn(upsertAnimeTracking);
  const getPaginatedTrackingFn = useServerFn(getMyAnimeTrackingPaginated);
  const getPublicPaginatedTrackingFn = useServerFn(getPublicAnimeTrackingPaginated);

  type FilterCacheEntry = {
    items: UserAnimeTrackingItem[];
    page: number;
    hasMore: boolean;
  };

  const scopePrefix = targetUserId ?? "__self__";
  const cacheKey = `${scopePrefix}::${filter}`;

  // Cache reativo por (usuário, filtro) restaurado do cache compartilhado de sessão
  const [filterCache, setFilterCache] = useState<Record<string, FilterCacheEntry>>(() => {
    const cached = getCachedPaginatedTracking(effectiveViewerId, scopePrefix, filter);
    if (!cached) return {};
    return {
      [cacheKey]: {
        items: cached.items,
        page: cached.page,
        hasMore: cached.hasMore,
      },
    };
  });
  const [loadingMore, setLoadingMore] = useState(false);
  const [serverCounts, setServerCounts] = useState<Record<FilterOption, number> | null>(() => {
    const cached = getCachedPaginatedTracking(effectiveViewerId, scopePrefix, filter);
    return cached?.counts ?? null;
  });

  const fallbackCounts = useMemo<Record<FilterOption, number>>(() => {
    if (initialCounts) {
      return {
        all: initialCounts.all ?? 0,
        watching: initialCounts.watching ?? 0,
        completed: initialCounts.completed ?? 0,
        on_hold: initialCounts.on_hold ?? 0,
        dropped: initialCounts.dropped ?? 0,
        planning: initialCounts.planning ?? 0,
      };
    }
    const base: Record<FilterOption, number> = {
      all: initialItems?.length ?? 0,
      watching: 0,
      completed: 0,
      on_hold: 0,
      dropped: 0,
      planning: 0,
    };
    if (!initialItems) return base;
    for (let i = 0; i < initialItems.length; i++) {
      const st = initialItems[i].status;
      if (st in base) {
        base[st] += 1;
      }
    }
    return base;
  }, [initialCounts, initialItems]);

  const counts = serverCounts ?? fallbackCounts;

  const activeCache = filterCache[cacheKey];
  const items = useMemo(() => activeCache?.items ?? [], [activeCache?.items]);
  const page = activeCache?.page ?? 1;
  const hasMore = activeCache?.hasMore ?? true;
  const dataLoading = !activeCache;

  // Trava para impedir requisições simultâneas da mesma página
  const fetchingRef = useRef(false);

  // Índice em memória (Set) de IDs carregados por filtro para deduplicação O(1) sem alocação
  const loadedIdSetsRef = useRef<Map<string, Set<string>>>(new Map());
  const lastTargetUserIdRef = useRef<string | undefined>(targetUserId);
  const lastViewerIdRef = useRef<string | null>(effectiveViewerId);

  const animeSentinelRef = useRef<HTMLDivElement>(null);

  // Busca inicial (lote de 24) por filtro, reaproveitando cache compartilhado e singleflight
  useEffect(() => {
    let active = true;

    if (
      lastTargetUserIdRef.current !== targetUserId ||
      lastViewerIdRef.current !== effectiveViewerId
    ) {
      loadedIdSetsRef.current.clear();
      setFilterCache({});
      setServerCounts(null);
      lastTargetUserIdRef.current = targetUserId;
      lastViewerIdRef.current = effectiveViewerId;
    }

    // Se já foi carregado para este filtro na sessão atual do componente, evita nova requisição
    if (activeCache) {
      return;
    }

    // Verifica cache compartilhado entre abas/montagens antes de disparar consulta no servidor
    const sharedCached = getCachedPaginatedTracking(
      effectiveViewerId,
      scopePrefix,
      filter,
    );
    if (sharedCached) {
      const idSet = new Set<string>();
      for (let i = 0; i < sharedCached.items.length; i++) {
        idSet.add(sharedCached.items[i].animeId);
      }
      loadedIdSetsRef.current.set(cacheKey, idSet);
      if (sharedCached.counts) {
        setServerCounts(sharedCached.counts);
        onCountsChange?.(sharedCached.counts);
      }
      setFilterCache((prev) => ({
        ...prev,
        [cacheKey]: {
          items: sharedCached.items,
          page: sharedCached.page,
          hasMore: sharedCached.hasMore,
        },
      }));
      return;
    }

    if (!targetUserId && !effectiveViewerId) {
      return;
    }

    fetchingRef.current = true;

    const flightKey = `${effectiveViewerId ?? "anon"}::${cacheKey}::page1`;
    const requestPromise = fetchPaginatedTrackingSingleflight(flightKey, () =>
      targetUserId
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
          }),
    );

    void requestPromise
      .then((res) => {
        setCachedPaginatedTracking(effectiveViewerId, scopePrefix, filter, {
          items: res.items,
          page: 1,
          hasMore: res.hasMore,
          counts: res.counts,
        });

        if (!active) return;

        // Atualiza índice de IDs
        const idSet = new Set<string>();
        for (let i = 0; i < res.items.length; i++) {
          idSet.add(res.items[i].animeId);
        }
        loadedIdSetsRef.current.set(cacheKey, idSet);

        setServerCounts(res.counts);
        onCountsChange?.(res.counts);

        setFilterCache((prev) => ({
          ...prev,
          [cacheKey]: {
            items: res.items,
            page: 1,
            hasMore: res.hasMore,
          },
        }));
      })
      .catch((err) => {
        console.warn("Erro ao buscar registros de animes paginados:", err);
      })
      .finally(() => {
        fetchingRef.current = false;
      });

    return () => {
      active = false;
      fetchingRef.current = false;
    };
  }, [
    cacheKey,
    scopePrefix,
    effectiveViewerId,
    activeCache,
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

    const requestCacheKey = cacheKey;
    const requestScopePrefix = scopePrefix;
    const requestFilter = filter;
    const requestViewerId = effectiveViewerId;
    const nextPage = page + 1;

    const flightKey = `${requestViewerId ?? "anon"}::${requestCacheKey}::page${nextPage}`;
    const requestPromise = fetchPaginatedTrackingSingleflight(flightKey, () =>
      targetUserId
        ? getPublicPaginatedTrackingFn({
            data: {
              userId: targetUserId,
              status: requestFilter === "all" ? undefined : requestFilter,
              page: nextPage,
              limit: PAGE_SIZE,
            },
          })
        : getPaginatedTrackingFn({
            data: {
              status: requestFilter === "all" ? undefined : requestFilter,
              page: nextPage,
              limit: PAGE_SIZE,
            },
          }),
    );

    void requestPromise
      .then((res) => {
        setFilterCache((prev) => {
          const prevEntry = prev[requestCacheKey];
          const prevItems = prevEntry?.items ?? [];

          // Prevenção estrita de registros duplicados com Set index O(1)
          let idSet = loadedIdSetsRef.current.get(requestCacheKey);
          if (!idSet) {
            idSet = new Set(prevItems.map((i) => i.animeId));
            loadedIdSetsRef.current.set(requestCacheKey, idSet);
          }

          const uniqueNew: UserAnimeTrackingItem[] = [];
          for (let i = 0; i < res.items.length; i++) {
            const it = res.items[i];
            if (!idSet.has(it.animeId)) {
              idSet.add(it.animeId);
              uniqueNew.push(it);
            }
          }

          const nextItems = [...prevItems, ...uniqueNew];
          setCachedPaginatedTracking(requestViewerId, requestScopePrefix, requestFilter, {
            items: nextItems,
            page: nextPage,
            hasMore: res.hasMore,
            counts: res.counts,
          });

          return {
            ...prev,
            [requestCacheKey]: {
              items: nextItems,
              page: nextPage,
              hasMore: res.hasMore,
            },
          };
        });

        setServerCounts(res.counts);
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
    cacheKey,
    scopePrefix,
    filter,
    effectiveViewerId,
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

  const applyItemMutationToCache = useCallback(
    (
      nextItem: UserAnimeTrackingItem,
      prevStatus?: TrackingStatus,
      previousAnimeId?: string,
    ) => {
      const prefix = `${scopePrefix}::`;
      const matchIds = new Set<string>([nextItem.animeId]);
      if (previousAnimeId) {
        matchIds.add(previousAnimeId);
      }

      const upsertDeduped = (list: UserAnimeTrackingItem[]) => {
        const result: UserAnimeTrackingItem[] = [];
        let inserted = false;
        for (const entry of list) {
          if (matchIds.has(entry.animeId)) {
            if (!inserted) {
              result.push(nextItem);
              inserted = true;
            }
          } else {
            result.push(entry);
          }
        }
        return { result, inserted };
      };

      setFilterCache((prev) => {
        const updatedCache: Record<string, FilterCacheEntry> = {};

        for (const [key, entry] of Object.entries(prev)) {
          if (!key.startsWith(prefix)) {
            updatedCache[key] = entry;
            continue;
          }

          const keyFilter = key.slice(prefix.length) as FilterOption;

          if (keyFilter === "all") {
            const { result, inserted } = upsertDeduped(entry.items);
            const finalItems = inserted ? result : [nextItem, ...result];
            loadedIdSetsRef.current.set(
              key,
              new Set(finalItems.map((i) => i.animeId)),
            );
            updatedCache[key] = {
              ...entry,
              items: finalItems,
            };
          } else if (keyFilter === nextItem.status) {
            const exists = entry.items.some((i) => matchIds.has(i.animeId));
            if (exists) {
              const { result } = upsertDeduped(entry.items);
              loadedIdSetsRef.current.set(
                key,
                new Set(result.map((i) => i.animeId)),
              );
              updatedCache[key] = {
                ...entry,
                items: result,
              };
            } else {
              // Invalida aba de destino em cache para rebuscar ordenado quando visitada
              loadedIdSetsRef.current.delete(key);
            }
          } else {
            const filtered = entry.items.filter((i) => !matchIds.has(i.animeId));
            if (filtered.length !== entry.items.length) {
              loadedIdSetsRef.current.set(
                key,
                new Set(filtered.map((i) => i.animeId)),
              );
              updatedCache[key] = {
                ...entry,
                items: filtered,
              };
            } else {
              updatedCache[key] = entry;
            }
          }
        }

        return updatedCache;
      });

      if (prevStatus && prevStatus !== nextItem.status) {
        setServerCounts((prevCounts) => {
          if (!prevCounts) return prevCounts;
          const nextCounts: Record<FilterOption, number> = {
            ...prevCounts,
            [prevStatus]: Math.max(0, (prevCounts[prevStatus] ?? 0) - 1),
            [nextItem.status]: (prevCounts[nextItem.status] ?? 0) + 1,
          };
          onCountsChange?.(nextCounts);
          return nextCounts;
        });
      }
    },
    [onCountsChange, scopePrefix],
  );

  // Callback estável para incremento rápido (+1 ep)
  const handleQuickIncrement = useCallback(async (item: UserAnimeTrackingItem) => {
    if (isReadOnly || updatingIdsRef.current.has(item.animeId)) return;
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

    updatingIdsRef.current.add(item.animeId);
    setUpdatingId(item.animeId);

    const previousItem = { ...item };
    const updatedItem: UserAnimeTrackingItem = {
      ...item,
      episodesWatched: nextWatched,
      status: nextStatus,
    };

    applyItemMutationToCache(updatedItem, previousItem.status, item.animeId);
    onUpdateItem?.(updatedItem, item.animeId, previousItem, false);

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
        animeId: res.animeId,
        status: res.status,
        score: res.score,
        episodesWatched: res.episodesWatched,
        startedAt: res.startedAt,
        completedAt: res.completedAt,
        updatedAt: res.updatedAt,
      };

      applyItemMutationToCache(finalItem, updatedItem.status, item.animeId);
      onUpdateItem?.(finalItem, item.animeId, updatedItem, true);
      const ownerId = targetUserId ?? effectiveViewerId ?? getKnownViewerId();
      const affectedIds = Array.from(
        new Set(
          [
            item.animeId,
            finalItem.animeId,
            finalItem.animeSnapshot?.serverCatalogId,
            finalItem.animeSnapshot?.anilistId != null
              ? String(finalItem.animeSnapshot.anilistId)
              : null,
            finalItem.animeSnapshot?.malId != null
              ? `mal-${finalItem.animeSnapshot.malId}`
              : null,
            finalItem.animeSnapshot?.malId != null
              ? String(finalItem.animeSnapshot.malId)
              : null,
            finalItem.animeSnapshot?.kitsuId != null
              ? `kitsu-${finalItem.animeSnapshot.kitsuId}`
              : null,
            finalItem.animeSnapshot?.kitsuId != null
              ? String(finalItem.animeSnapshot.kitsuId)
              : null,
          ].filter((x): x is string => typeof x === "string" && Boolean(x.trim())),
        ),
      );
      if (ownerId) {
        seedAnimeTrackingCache(ownerId, affectedIds, finalItem);
        markTrackingMutated(ownerId, affectedIds);
        invalidateWatchedEpisodesCache(ownerId, affectedIds);
        invalidatePaginatedTrackingCache(ownerId, scopePrefix);
        invalidateAccountProfileCache(ownerId);
        invalidatePublicProfileCacheByUserId(ownerId);
      } else {
        invalidateAccountProfileCache(undefined);
      }
      clearAnimeUserClientCache(affectedIds);
      toast.success(`Episódio ${finalItem.episodesWatched}${maxEps ? ` de ${maxEps}` : ""} marcado!`);
    } catch (err) {
      applyItemMutationToCache(previousItem, updatedItem.status, item.animeId);
      onUpdateItem?.(previousItem, item.animeId, updatedItem, false);
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar episódios.");
    } finally {
      updatingIdsRef.current.delete(item.animeId);
      setUpdatingId((curr) => (curr === item.animeId ? null : curr));
    }
  }, [applyItemMutationToCache, effectiveViewerId, isReadOnly, onUpdateItem, scopePrefix, targetUserId, upsertTrackingFn]);

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

    applyItemMutationToCache(optimisticItem, previousItem.status, targetItem.animeId);
    onUpdateItem?.(optimisticItem, targetItem.animeId, previousItem, false);

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
        animeId: res.animeId,
        status: res.status,
        score: res.score,
        episodesWatched: res.episodesWatched,
        startedAt: res.startedAt,
        completedAt: res.completedAt,
        updatedAt: res.updatedAt,
      };

      applyItemMutationToCache(finalItem, optimisticItem.status, targetItem.animeId);
      onUpdateItem?.(finalItem, targetItem.animeId, optimisticItem, true);
      const ownerId = targetUserId ?? effectiveViewerId ?? getKnownViewerId();
      const affectedIds = Array.from(
        new Set(
          [
            targetItem.animeId,
            finalItem.animeId,
            finalItem.animeSnapshot?.serverCatalogId,
            finalItem.animeSnapshot?.anilistId != null
              ? String(finalItem.animeSnapshot.anilistId)
              : null,
            finalItem.animeSnapshot?.malId != null
              ? `mal-${finalItem.animeSnapshot.malId}`
              : null,
            finalItem.animeSnapshot?.malId != null
              ? String(finalItem.animeSnapshot.malId)
              : null,
            finalItem.animeSnapshot?.kitsuId != null
              ? `kitsu-${finalItem.animeSnapshot.kitsuId}`
              : null,
            finalItem.animeSnapshot?.kitsuId != null
              ? String(finalItem.animeSnapshot.kitsuId)
              : null,
          ].filter((x): x is string => typeof x === "string" && Boolean(x.trim())),
        ),
      );
      if (ownerId) {
        seedAnimeTrackingCache(ownerId, affectedIds, finalItem);
        markTrackingMutated(ownerId, affectedIds);
        invalidateWatchedEpisodesCache(ownerId, affectedIds);
        invalidatePaginatedTrackingCache(ownerId, scopePrefix);
        invalidateAccountProfileCache(ownerId);
        invalidatePublicProfileCacheByUserId(ownerId);
      } else {
        invalidateAccountProfileCache(undefined);
      }
      clearAnimeUserClientCache(affectedIds);
      toast.success("Coleção atualizada com sucesso!");
    } catch (err) {
      applyItemMutationToCache(previousItem, optimisticItem.status, targetItem.animeId);
      onUpdateItem?.(previousItem, targetItem.animeId, optimisticItem, false);
      throw err;
    }
  }, [applyItemMutationToCache, editingItem, effectiveViewerId, isReadOnly, onUpdateItem, scopePrefix, targetUserId, upsertTrackingFn]);

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

  const isLoading = dataLoading;

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

            {/* Seletor de Ordenação Personalizado Hikari */}
            <div className="relative">
              <SortDropdownMenu sortBy={sortBy} setSortBy={setSortBy} />
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
