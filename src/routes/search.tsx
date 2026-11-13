import {
  createFileRoute,
  Link,
} from "@tanstack/react-router";

import {
  ChevronDown,
  Mic2,
  Lock,
  Search as SearchIcon,
  SlidersHorizontal,
  Tv,
  UserRound,
  Users,
  X,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  fetchGenres,
  searchCatalog,
} from "@/lib/api";

import {
  AnimeCard,
} from "@/components/anime-card";

import {
  FORMAT_PT,
  GENRE_PT,
  SORT_OPTIONS,
  STATUS_PT,
} from "@/lib/labels";

import { overlayList } from "@/lib/overlay";
import { searchUsers, type SearchUserItem } from "@/lib/profile.functions";
import { buildCleanCanonical, DEFAULT_OG_IMAGE } from "@/lib/seo";
import { useHikariStore } from "@/lib/store";
import { displayTitle, type SlimAnime } from "@/lib/types";
import { getResponsiveCoverAttrs } from "@/lib/image-utils";
import type { SearchCategory } from "@/components/search/SearchCategorySelector";
import {
  searchCharacters,
  searchPeople,
  type SearchCharacterItem,
  type SearchPersonItem,
} from "@/lib/search-entities";
import { cn } from "@/lib/utils";

import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

const YEARS = Array.from(
  { length: 37 },
  (_, i) => String(2026 - i),
);

const CATEGORY_TABS: {
  id: SearchCategory;
  label: string;
  icon: typeof Tv;
}[] = [
  { id: "animes", label: "Animes", icon: Tv },
  { id: "users", label: "Usuários", icon: Users },
  { id: "people", label: "People", icon: Mic2 },
  { id: "characters", label: "Personagens", icon: UserRound },
];

type Search = {
  q?: string;
  genre?: string;
  year?: string;
  format?: string;
  status?: string;
  sort?: string;
  page?: number;
  adult?: boolean;
  tab?: SearchCategory;
};

export const Route =
  createFileRoute("/search")({
    validateSearch: (
      raw: Record<string, unknown>,
    ): Search => ({
      q:
        typeof raw.q === "string" && raw.q
          ? raw.q
          : undefined,

      genre:
        typeof raw.genre === "string" && raw.genre
          ? raw.genre
          : undefined,

      year:
        typeof raw.year === "string" && raw.year
          ? raw.year
          : undefined,

      format:
        typeof raw.format === "string" && raw.format
          ? raw.format
          : undefined,

      status:
        typeof raw.status === "string" && raw.status
          ? raw.status
          : undefined,

      sort:
        typeof raw.sort === "string" && raw.sort
          ? raw.sort
          : undefined,

      page:
        typeof raw.page === "string" && /^\d+$/.test(raw.page)
          ? Math.max(1, Number(raw.page))
          : undefined,

      adult:
        raw.adult === true || raw.adult === "true"
          ? true
          : undefined,

      tab:
        raw.tab === "users" || raw.tab === "people" || raw.tab === "characters"
          ? raw.tab
          : undefined,
    }),

    loaderDeps: ({ search }) => search,

    loader: async ({ deps }) => {
      const [result, genres] = await Promise.all([
        searchCatalog({
          data: {
            ...deps,
            page: deps.page ?? 1,
          },
        }),
        fetchGenres(),
      ]);

      return {
        result,
        genres,
      };
    },

    head: ({ match }) => {
      const search = (match?.search ?? {}) as Search;
      const hasQueryOrFilter = Boolean(
        search.q ||
        search.genre ||
        search.year ||
        search.format ||
        search.status ||
        search.sort ||
        (search.page && search.page > 1)
      );

      const title = search.q
        ? `Buscar "${search.q}" no catálogo — HIKARI`
        : search.genre
          ? `Animes do gênero ${search.genre} — HIKARI`
          : "Buscar animes no catálogo — HIKARI";

      const description = search.q
        ? `Resultados da busca por "${search.q}" no catálogo do HIKARI. Assista e explore informações completas de animes.`
        : "Filtre e encontre animes por gênero, ano de lançamento, temporada e formato no catálogo completo do HIKARI.";

      const canonicalUrl = buildCleanCanonical("/search");

      const meta = [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:image", content: DEFAULT_OG_IMAGE },
        { property: "og:url", content: canonicalUrl },
        { property: "og:locale", content: "pt_BR" },
        { property: "og:site_name", content: "HIKARI" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: DEFAULT_OG_IMAGE },
        ...(hasQueryOrFilter
          ? [{ name: "robots", content: "noindex, follow" }]
          : []),
      ];

      return {
        links: [
          {
            rel: "canonical",
            href: canonicalUrl,
          },
        ],
        meta,
      };
    },

    pendingComponent: SearchPending,

    component: SearchPage,
  });

function SearchPending() {
  return (
    <div className="grid grid-cols-3 gap-2.5 pt-6 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
      {Array.from({ length: 12 }, (_, i) => (
        <div key={i} className="min-w-0">
          <div className="aspect-[2/3] w-full bg-[#141224] animate-pulse border border-white/5" />
          <div className="mt-2 h-3 w-3/4 bg-white/5 animate-pulse" />
          <div className="mt-1 h-2.5 w-1/2 bg-white/5 animate-pulse" />
        </div>
      ))}
    </div>
  );
}

function SearchPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { result, genres } = Route.useLoaderData();
  const locals = useHikariStore((s) => s.animes);

  /*
   * =========================================================
   * RELOAD REAL DA PÁGINA
   * =========================================================
   */
  const [clearingOnReload, setClearingOnReload] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const navigation = window.performance.getEntriesByType(
      "navigation",
    )[0] as PerformanceNavigationTiming | undefined;

    const alreadyHandled = Boolean(
      (
        window as Window & {
          __hikariSearchReloadHandled?: boolean;
        }
      ).__hikariSearchReloadHandled,
    );

    if (navigation?.type === "reload" && !alreadyHandled) {
      (
        window as Window & {
          __hikariSearchReloadHandled?: boolean;
        }
      ).__hikariSearchReloadHandled = true;
      setClearingOnReload(true);
    }
  }, []);

  /*
   * =========================================================
   * CAMPO DE BUSCA & ESTADOS
   * =========================================================
   */
  const [draft, setDraft] = useState(() => search.q ?? "");
  const firstSearchSync = useRef(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const currentPage = search.page ?? 1;

  const [remoteAnimeItems, setRemoteAnimeItems] = useState<typeof result.items>([]);
  useEffect(() => {
    if (currentPage === 1) {
      setRemoteAnimeItems(result.items);
      return;
    }
    setRemoteAnimeItems((previous) => {
      const seen = new Set(previous.map((anime) => anime.id));
      return [...previous, ...result.items.filter((anime) => !seen.has(anime.id))];
    });
  }, [result.items, currentPage]);

  const activeTab: SearchCategory = search.tab ?? "animes";

  const handleTabChange = (nextTab: SearchCategory) => {
    void navigate({
      search: {
        ...search,
        tab: nextTab === "animes" ? undefined : nextTab,
        page: 1,
      },
      replace: true,
    });
  };

  /*
   * =========================================================
   * PESQUISA DE USUÁRIOS
   * =========================================================
   */
  const [userResults, setUserResults] = useState<SearchUserItem[]>([]);
  const [usersPage, setUsersPage] = useState(1);
  const [hasMoreUsers, setHasMoreUsers] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersLoadingMore, setUsersLoadingMore] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const isFetchingMoreUsersRef = useRef(false);

  /*
   * =========================================================
   * PESQUISA DE PERSONAGENS & PEOPLE
   * =========================================================
   */
  const [characterResults, setCharacterResults] = useState<SearchCharacterItem[]>([]);
  const [peopleResults, setPeopleResults] = useState<SearchPersonItem[]>([]);
  const [entityLoading, setEntityLoading] = useState(false);
  const [entityLoadingMore, setEntityLoadingMore] = useState(false);
  const [entityHasNext, setEntityHasNext] = useState(false);
  const [entityPage, setEntityPage] = useState(1);
  const isFetchingMoreEntitiesRef = useRef(false);

  /*
   * SENTINELAS PARA ROLAGEM INFINITA AUTOMÁTICA
   */
  const animeSentinelRef = useRef<HTMLDivElement>(null);
  const userSentinelRef = useRef<HTMLDivElement>(null);
  const entitySentinelRef = useRef<HTMLDivElement>(null);
  const isNavigatingAnimeRef = useRef(false);

  useEffect(() => {
    isNavigatingAnimeRef.current = false;
  }, [currentPage, result.items]);

  let userQueryClean = draft.trim();
  if (userQueryClean.startsWith("@")) {
    userQueryClean = userQueryClean.slice(1).trim();
  }

  useEffect(() => {
    if (activeTab !== "users") {
      return;
    }

    let clean = draft.trim();
    if (clean.startsWith("@")) {
      clean = clean.slice(1).trim();
    }

    if (clean.length < 2) {
      setUserResults([]);
      setHasMoreUsers(false);
      setUsersLoading(false);
      setUsersError(null);
      return;
    }

    setUsersLoading(true);
    setUsersError(null);

    const timer = window.setTimeout(async () => {
      try {
        const results = await searchUsers({
          data: {
            query: clean,
            page: 1,
            limit: 20,
          },
        });
        setUserResults(results);
        setUsersPage(1);
        setHasMoreUsers(results.length >= 20);
      } catch (err) {
        console.error("Erro ao buscar usuários:", err);
        setUsersError("Não foi possível carregar os usuários. Tente novamente.");
        setUserResults([]);
        setHasMoreUsers(false);
      } finally {
        setUsersLoading(false);
      }
    }, 350);

    return () => window.clearTimeout(timer);
  }, [activeTab, draft]);

  const handleLoadMoreUsers = async () => {
    if (usersLoadingMore || isFetchingMoreUsersRef.current || !hasMoreUsers) {
      return;
    }

    let clean = draft.trim();
    if (clean.startsWith("@")) {
      clean = clean.slice(1).trim();
    }
    if (clean.length < 2) return;

    const nextPage = usersPage + 1;
    isFetchingMoreUsersRef.current = true;
    setUsersLoadingMore(true);

    try {
      const moreUsers = await searchUsers({
        data: {
          query: clean,
          page: nextPage,
          limit: 20,
        },
      });

      setUserResults((prev) => {
        const existingIds = new Set(prev.map((u) => u.userId));
        const newUnique = moreUsers.filter((u) => !existingIds.has(u.userId));
        return [...prev, ...newUnique];
      });

      setUsersPage(nextPage);
      setHasMoreUsers(moreUsers.length >= 20);
    } catch (err) {
      console.error("Erro ao carregar mais usuários:", err);
    } finally {
      isFetchingMoreUsersRef.current = false;
      setUsersLoadingMore(false);
    }
  };

  useEffect(() => {
    if (activeTab !== "characters" && activeTab !== "people") return;
    const clean = draft.trim();
    if (clean.length < 2) {
      setCharacterResults([]);
      setPeopleResults([]);
      setEntityHasNext(false);
      setEntityPage(1);
      return;
    }
    let cancelled = false;
    setEntityLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const res =
          activeTab === "characters"
            ? await searchCharacters(clean, 1, 18)
            : await searchPeople(clean, 1, 18);
        if (cancelled) return;
        if (activeTab === "characters") {
          setCharacterResults(res.items as SearchCharacterItem[]);
        } else {
          setPeopleResults(res.items as SearchPersonItem[]);
        }
        setEntityHasNext(res.hasNext);
        setEntityPage(1);
      } catch {
        if (!cancelled) {
          setCharacterResults([]);
          setPeopleResults([]);
          setEntityHasNext(false);
        }
      } finally {
        if (!cancelled) setEntityLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [activeTab, draft]);

  const loadMoreEntities = async () => {
    if (
      entityLoading ||
      entityLoadingMore ||
      isFetchingMoreEntitiesRef.current ||
      !entityHasNext ||
      (activeTab !== "characters" && activeTab !== "people")
    ) {
      return;
    }
    const clean = draft.trim();
    if (clean.length < 2) return;

    const nextPage = entityPage + 1;
    isFetchingMoreEntitiesRef.current = true;
    setEntityLoadingMore(true);
    try {
      const res =
        activeTab === "characters"
          ? await searchCharacters(clean, nextPage, 18)
          : await searchPeople(clean, nextPage, 18);
      if (activeTab === "characters") {
        setCharacterResults((prev) => {
          const seen = new Set(prev.map((x) => x.id));
          return [...prev, ...(res.items as SearchCharacterItem[]).filter((x) => !seen.has(x.id))];
        });
      } else {
        setPeopleResults((prev) => {
          const seen = new Set(prev.map((x) => x.id));
          return [...prev, ...(res.items as SearchPersonItem[]).filter((x) => !seen.has(x.id))];
        });
      }
      setEntityPage(nextPage);
      setEntityHasNext(res.hasNext);
    } finally {
      isFetchingMoreEntitiesRef.current = false;
      setEntityLoadingMore(false);
    }
  };

  /*
   * =========================================================
   * LIMPAR BUSCA NO RELOAD REAL
   * =========================================================
   */
  useEffect(() => {
    if (!clearingOnReload) {
      return;
    }

    setDraft("");

    void navigate({
      search: {
        genre: search.genre,
        adult: search.adult,
      },
      replace: true,
    }).finally(() => {
      setClearingOnReload(false);
    });
  }, [clearingOnReload, navigate, search.genre, search.adult]);

  /*
   * =========================================================
   * SINCRONIZAR CAMPO COM A URL
   * =========================================================
   */
  useEffect(() => {
    if (firstSearchSync.current) {
      firstSearchSync.current = false;
      return;
    }

    if (clearingOnReload) {
      return;
    }

    setDraft(search.q ?? "");
  }, [search.q, clearingOnReload]);

  /*
   * =========================================================
   * BUSCA AUTOMÁTICA DE ANIMES (DEBOUNCE)
   * =========================================================
   */
  useEffect(() => {
    if (clearingOnReload) {
      return;
    }

    if (activeTab !== "animes") {
      return;
    }

    const q = draft.trim();

    if (q.length > 0 && q.length < 2) {
      return;
    }

    const current = (search.q ?? "").trim();

    if (q === current) {
      return;
    }

    const timer = window.setTimeout(() => {
      void navigate({
        search: {
          ...search,
          q: q || undefined,
          page: 1,
        },
        replace: true,
      });
    }, 700);

    return () => window.clearTimeout(timer);
  }, [draft, navigate, search, clearingOnReload, activeTab]);

  /*
   * =========================================================
   * RESULTADOS DE ANIMES
   * =========================================================
   */
  const items = useMemo(() => {
    if (clearingOnReload) {
      return [];
    }

    const q = (search.q ?? "").trim().toLowerCase();

    const localHits =
      currentPage === 1
        ? overlayList([], locals).filter((anime) => {
            const isHentai =
              anime.genres?.some(
                (genre) => genre.trim().toLowerCase() === "hentai",
              ) ?? false;

            if (search.adult) {
              if (!isHentai) return false;
            } else if (isHentai) {
              return false;
            }

            if (q) {
              const titleStr =
                `${anime.titles?.romaji || ""} ${anime.titles?.english || ""} ${anime.titles?.native || ""}`
                  .normalize("NFD")
                  .replace(/[\u0300-\u036f]/g, "")
                  .toLowerCase();
              const normalizedQ = q
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .toLowerCase();

              const matchesDirect = titleStr.includes(normalizedQ);
              const matchesWords = normalizedQ
                .split(/\s+/)
                .every((word) => titleStr.includes(word));

              if (!matchesDirect && !matchesWords) {
                return false;
              }
            }

            if (search.genre && !anime.genres.includes(search.genre)) {
              return false;
            }

            return true;
          })
        : [];

    const remote = overlayList(remoteAnimeItems, locals).filter((anime) => {
      const isHentai =
        anime.genres?.some(
          (genre) => genre.trim().toLowerCase() === "hentai",
        ) ?? false;

      return search.adult ? isHentai : !isHentai;
    });

    const seen = new Set(localHits.map((anime) => anime.id));

    return [
      ...localHits,
      ...remote.filter((anime) => !seen.has(anime.id)),
    ];
  }, [
    currentPage,
    locals,
    remoteAnimeItems,
    search.q,
    search.genre,
    search.adult,
    clearingOnReload,
  ]);

  /*
   * =========================================================
   * FILTROS
   * =========================================================
   */
  function apply(next: Partial<Search>) {
    void navigate({
      search: {
        ...search,
        ...next,
        page: 1,
      },
    });
  }

  const genreOptions = genres.length
    ? genres
    : Object.keys(GENRE_PT);

  const hasAnimes = items.length > 0;
  const hasQuery = Boolean(search.q?.trim() || search.genre);

  const activeFilterCount = [
    search.genre,
    search.year,
    search.format,
    search.status,
    search.sort,
  ].filter(Boolean).length;

  /*
   * =========================================================
   * CARREGAMENTO AUTOMÁTICO VIA INTERSECTION OBSERVER
   * =========================================================
   */
  const handleLoadMoreUsersRef = useRef(handleLoadMoreUsers);
  handleLoadMoreUsersRef.current = handleLoadMoreUsers;
  const loadMoreEntitiesRef = useRef(loadMoreEntities);
  loadMoreEntitiesRef.current = loadMoreEntities;

  useEffect(() => {
    const target =
      activeTab === "animes"
        ? animeSentinelRef.current
        : activeTab === "users"
          ? userSentinelRef.current
          : entitySentinelRef.current;

    if (!target || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;

        if (activeTab === "animes" && result.hasNext && !isNavigatingAnimeRef.current) {
          isNavigatingAnimeRef.current = true;
          void navigate({
            search: { ...search, page: currentPage + 1 },
            replace: true,
          });
        } else if (activeTab === "users" && hasMoreUsers) {
          void handleLoadMoreUsersRef.current();
        } else if ((activeTab === "characters" || activeTab === "people") && entityHasNext) {
          void loadMoreEntitiesRef.current();
        }
      },
      { rootMargin: "600px 0px" },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [
    activeTab,
    result.hasNext,
    currentPage,
    search,
    navigate,
    hasMoreUsers,
    entityHasNext,
  ]);

  /*
   * =========================================================
   * BLOQUEIO DURANTE RELOAD
   * =========================================================
   */
  if (clearingOnReload) {
    return (
      <div className="space-y-6 pt-6 max-w-7xl mx-auto px-2.5 sm:px-4">
        <SearchPending />
      </div>
    );
  }

  /*
   * =========================================================
   * RENDER PRINCIPAL
   * =========================================================
   */
  return (
    <div className="space-y-5 pt-3 sm:pt-5 pb-16 max-w-7xl mx-auto px-2.5 sm:px-4">
      {/* =====================================================
          PAINEL DE PESQUISA E FILTROS (INSPIRADO NO MODELO VISUAL)
      ====================================================== */}
      <div className="rounded-2xl border border-white/10 bg-[#141224]/90 p-3 sm:p-4.5 shadow-xl backdrop-blur-md space-y-3.5">
        {/* Rótulo e Campo de busca */}
        <div className="space-y-1.5">
          <label
            htmlFor="search-page-input"
            className="block text-xs font-medium text-zinc-400"
          >
            Search
          </label>
          <div className="relative flex items-center rounded-xl border border-white/10 bg-[#0c0a17] px-3 py-1.5 sm:py-2 transition-all focus-within:border-purple-500/50 focus-within:ring-1 focus-within:ring-purple-500/30">
            <SearchIcon className="size-4 shrink-0 text-zinc-400 mr-2.5" />
            <input
              id="search-page-input"
              type="search"
              enterKeyHint="search"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  (e.currentTarget as HTMLInputElement).blur();
                  const q = draft.trim();
                  void navigate({
                    search: {
                      ...search,
                      q: q || undefined,
                      page: 1,
                    },
                    replace: true,
                  });
                }
              }}
              placeholder={
                activeTab === "animes"
                  ? "Buscar animes..."
                  : activeTab === "users"
                    ? "Buscar usuários..."
                    : activeTab === "characters"
                      ? "Buscar personagens..."
                      : "Buscar profissionais (People)..."
              }
              className="w-full bg-transparent text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-500 outline-none [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
            />
            {draft.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setDraft("");
                  if (search.q) {
                    void navigate({
                      search: { ...search, q: undefined, page: 1 },
                      replace: true,
                    });
                  }
                }}
                className="ml-2 flex size-6 shrink-0 items-center justify-center rounded-full text-zinc-400 hover:bg-white/10 hover:text-white transition-colors"
                aria-label="Limpar busca"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Categorias horizontais (Animes, Usuários, People, Personagens) */}
        <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
          {CATEGORY_TABS.map((cat) => {
            const isActive = activeTab === cat.id;
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleTabChange(cat.id)}
                className={cn(
                  "flex items-center justify-center gap-1 sm:gap-1.5 rounded-xl py-2 px-0.5 sm:px-1 text-center transition-all text-[10px] sm:text-xs font-medium cursor-pointer select-none",
                  isActive
                    ? "bg-gradient-to-r from-purple-600 via-purple-500 to-fuchsia-600 text-white shadow-[0_4px_16px_rgba(168,85,247,0.35)] border border-purple-400/40"
                    : "bg-white/[0.04] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.08] border border-white/5",
                )}
              >
                <Icon
                  className={cn(
                    "size-3 sm:size-3.5 shrink-0",
                    isActive ? "text-white" : "text-zinc-400",
                  )}
                />
                <span className="shrink-0 tracking-tight">{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Área de Ordenação ("Sort by") */}
        {activeTab === "animes" && (
          <div className="space-y-1.5">
            <label
              htmlFor="sort-select"
              className="block text-xs font-medium text-zinc-400"
            >
              Sort by
            </label>
            <div className="relative">
              <select
                id="sort-select"
                value={search.sort ?? "TRENDING_DESC"}
                onChange={(e) => apply({ sort: e.target.value || undefined })}
                className="w-full appearance-none rounded-xl border border-white/10 bg-[#0c0a17] py-2.5 pl-3.5 pr-10 text-xs sm:text-sm text-zinc-200 outline-none transition-colors focus:border-purple-500/50 cursor-pointer"
              >
                {SORT_OPTIONS.map((option) => (
                  <option
                    key={option.value}
                    value={option.value}
                    className="bg-[#141224] text-zinc-200"
                  >
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
            </div>
          </div>
        )}

        {/* Botão de Filtros ("More Filters") */}
        {activeTab === "animes" && (
          <div>
            <button
              type="button"
              onClick={() => setFiltersOpen((prev) => !prev)}
              className={cn(
                "w-full flex items-center justify-center gap-2 rounded-xl py-2.5 px-4 text-xs sm:text-sm font-medium transition-all cursor-pointer border",
                filtersOpen || activeFilterCount > 0
                  ? "border-purple-500/50 bg-purple-500/20 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.2)]"
                  : "border-white/10 bg-[#0c0a17]/90 text-zinc-300 hover:bg-[#1a1730] hover:text-white",
              )}
            >
              <SlidersHorizontal className="size-4 shrink-0 text-zinc-400" />
              <span>More Filters</span>
              {activeFilterCount > 0 && (
                <span className="ml-1 flex size-4 items-center justify-center rounded-full bg-purple-600 text-[10px] font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* Painel expansível de filtros */}
            {filtersOpen && (
              <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4 rounded-xl border border-white/10 bg-[#0c0a17]/70 p-3 pt-3.5">
                <Field label="Gênero">
                  <NativeSelect
                    value={search.genre ?? ""}
                    onChange={(e) =>
                      apply({ genre: e.target.value || undefined })
                    }
                  >
                    <option value="">Todos</option>
                    {genreOptions.map((genre) => (
                      <option key={genre} value={genre}>
                        {GENRE_PT[genre] ?? genre}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>

                <Field label="Ano">
                  <NativeSelect
                    value={search.year ?? ""}
                    onChange={(e) =>
                      apply({ year: e.target.value || undefined })
                    }
                  >
                    <option value="">Qualquer</option>
                    {YEARS.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>

                <Field label="Formato">
                  <NativeSelect
                    value={search.format ?? ""}
                    onChange={(e) =>
                      apply({ format: e.target.value || undefined })
                    }
                  >
                    <option value="">Todos</option>
                    {Object.entries(FORMAT_PT)
                      .filter(([key]) =>
                        [
                          "TV",
                          "MOVIE",
                          "OVA",
                          "ONA",
                          "SPECIAL",
                          "TV_SHORT",
                        ].includes(key),
                      )
                      .map(([key, value]) => (
                        <option key={key} value={key}>
                          {value}
                        </option>
                      ))}
                  </NativeSelect>
                </Field>

                <Field label="Status">
                  <NativeSelect
                    value={search.status ?? ""}
                    onChange={(e) =>
                      apply({ status: e.target.value || undefined })
                    }
                  >
                    <option value="">Todos</option>
                    {Object.entries(STATUS_PT).map(([key, value]) => (
                      <option key={key} value={key}>
                        {value}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
              </div>
            )}
          </div>
        )}
      </div>

      {/* =====================================================
          TÍTULO DOS RESULTADOS E QUANTIDADE ENCONTRADA
      ====================================================== */}
      <div className="pt-2">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
          {draft.trim() || search.q
            ? `Results for “${draft.trim() || search.q}”`
            : activeTab === "animes"
              ? "Explorar Animes"
              : activeTab === "users"
                ? "Explorar Usuários"
                : activeTab === "people"
                  ? "Explorar People"
                  : "Explorar Personagens"}
        </h1>
        <p className="mt-0.5 text-xs sm:text-sm text-zinc-400">
          {activeTab === "animes"
            ? `${items.length} ${items.length === 1 ? "resultado" : "resultados"}`
            : activeTab === "users"
              ? `${userResults.length} ${userResults.length === 1 ? "resultado" : "resultados"}`
              : activeTab === "people"
                ? `${peopleResults.length} ${peopleResults.length === 1 ? "resultado" : "resultados"}`
                : `${characterResults.length} ${characterResults.length === 1 ? "resultado" : "resultados"}`}
        </p>
      </div>

      {/* =====================================================
          CONTEÚDO: ABA ANIMES
      ====================================================== */}
      {activeTab === "animes" && (
        <>
          {hasQuery && hasAnimes && (
            <section className="space-y-4">
              {/* Exatamente 3 cards por linha no celular */}
              <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                {items.map((anime) => (
                  <AnimeCard key={anime.id} anime={anime} size="lg" />
                ))}
              </div>

              {/* Sentinela de carregamento automático */}
              <div ref={animeSentinelRef} className="h-6" aria-hidden="true" />
              {result.hasNext && (
                <div className="py-4 flex items-center justify-center gap-2 text-xs text-zinc-400">
                  <div className="size-3.5 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
                  <span>Carregando mais resultados...</span>
                </div>
              )}
            </section>
          )}

          {!hasQuery && (
            <div className="py-20 text-center">
              <SearchIcon className="mx-auto size-8 text-zinc-500" />
              <p className="mt-4 font-display text-2xl text-zinc-200">
                Pesquise um anime
              </p>
              <p className="mt-2 text-sm text-zinc-400">
                Digite o nome do anime para ver os resultados.
              </p>
            </div>
          )}

          {hasQuery && !hasAnimes && (
            <div className="py-20 text-center">
              <p className="font-display text-2xl text-zinc-200">
                Nada encontrado
              </p>
              <p className="mt-2 text-sm text-zinc-400">
                Tente outro título ou limpe os filtros.
              </p>
              <Link
                to="/search"
                className="mt-4 inline-block text-sm text-purple-400 hover:text-purple-300 underline"
              >
                Limpar busca
              </Link>
            </div>
          )}
        </>
      )}

      {/* =====================================================
          CONTEÚDO: ABA USUÁRIOS
      ====================================================== */}
      {activeTab === "users" && (
        <section className="space-y-4">
          {usersLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-[#141224]/50 p-3.5 animate-pulse"
                >
                  <div className="size-11 shrink-0 rounded-xl bg-white/[0.05]" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-32 rounded bg-white/[0.05]" />
                    <div className="h-3 w-20 rounded bg-white/[0.05]" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!usersLoading && usersError && (
            <div className="py-20 text-center">
              <p className="font-display text-2xl text-red-400">
                Erro na busca
              </p>
              <p className="mt-2 text-sm text-zinc-400">{usersError}</p>
            </div>
          )}

          {!usersLoading && !usersError && userQueryClean.length < 2 && (
            <div className="py-20 text-center">
              <Users className="mx-auto size-8 text-zinc-500" />
              <p className="mt-4 font-display text-2xl text-zinc-200">
                Pesquise um usuário
              </p>
              <p className="mt-2 text-sm text-zinc-400">
                Digite o @username ou nome de exibição para encontrar membros da comunidade.
              </p>
            </div>
          )}

          {!usersLoading &&
            !usersError &&
            userQueryClean.length >= 2 &&
            userResults.length === 0 && (
              <div className="py-20 text-center">
                <Users className="mx-auto size-8 text-zinc-500" />
                <p className="mt-4 font-display text-2xl text-zinc-200">
                  Nenhum usuário encontrado
                </p>
                <p className="mt-2 text-sm text-zinc-400">
                  Não encontramos membros para &quot;{draft.trim()}&quot;.
                </p>
              </div>
            )}

          {!usersLoading && !usersError && userResults.length > 0 && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {userResults.map((person) => {
                  const avatarLetter = (
                    person.displayName ||
                    person.nick ||
                    "U"
                  )
                    .charAt(0)
                    .toUpperCase();

                  return (
                    <Link
                      key={person.userId}
                      to="/profile/$nick"
                      params={{ nick: person.nick }}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#141224]/80 p-3 sm:p-3.5 transition-all hover:border-purple-500/40 hover:bg-[#1a1730] hover:shadow-[0_4px_20px_rgba(168,85,247,0.15)] group"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#0d0c16] font-semibold text-sm text-purple-300 ring-1 ring-purple-500/30 group-hover:ring-purple-500/60 transition-all">
                          {person.avatarUrl ? (
                            <img
                              src={person.avatarUrl}
                              alt=""
                              className="size-full object-cover"
                            />
                          ) : (
                            <span>{avatarLetter}</span>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="truncate text-sm font-semibold text-zinc-100 group-hover:text-purple-300 transition-colors">
                              {person.displayName || person.nick}
                            </p>
                            {person.accountType === "private" && (
                              <span
                                className="inline-flex items-center gap-0.5 rounded bg-white/[0.06] px-1 py-0.5 text-[9px] font-medium text-zinc-400 border border-white/[0.08]"
                                title="Conta privada"
                              >
                                <Lock className="size-2 text-zinc-400" />
                                <span>Privada</span>
                              </span>
                            )}
                            {person.isFollowing && (
                              <span className="inline-flex items-center rounded bg-purple-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-purple-300 border border-purple-500/30">
                                Seguindo
                              </span>
                            )}
                            {person.isOwner && (
                              <span className="inline-flex items-center rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-semibold text-zinc-300">
                                Você
                              </span>
                            )}
                          </div>
                          <p className="truncate text-xs text-zinc-400 mt-0.5">
                            @{person.nick}
                          </p>
                        </div>
                      </div>

                      <span className="shrink-0 rounded-xl border border-purple-500/30 bg-purple-500/15 px-3 py-1.5 text-xs font-semibold text-purple-300 group-hover:bg-purple-600 group-hover:text-white transition-all">
                        Ver perfil
                      </span>
                    </Link>
                  );
                })}
              </div>

              <div ref={userSentinelRef} className="h-6" aria-hidden="true" />
              {usersLoadingMore && (
                <div className="py-4 flex items-center justify-center gap-2 text-xs text-zinc-400">
                  <div className="size-3.5 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
                  <span>Carregando mais usuários...</span>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* =====================================================
          CONTEÚDO: ABA PERSONAGENS
      ====================================================== */}
      {activeTab === "characters" && (
        <section className="space-y-4">
          {entityLoading && characterResults.length === 0 && (
            <div className="py-12 flex items-center justify-center gap-2 text-sm text-zinc-400">
              <div className="size-4 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
              <span>Pesquisando personagens...</span>
            </div>
          )}

          {!entityLoading && draft.trim().length < 2 && (
            <div className="py-20 text-center">
              <UserRound className="mx-auto size-8 text-zinc-500" />
              <p className="mt-4 font-display text-2xl text-zinc-200">
                Pesquise um personagem
              </p>
              <p className="mt-2 text-sm text-zinc-400">
                Digite o nome de um personagem de anime.
              </p>
            </div>
          )}

          {characterResults.length > 0 && (
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
              {characterResults.map((char) => (
                <SearchCharacterResultCard key={char.id} character={char} />
              ))}
            </div>
          )}

          <div ref={entitySentinelRef} className="h-6" aria-hidden="true" />
          {entityLoadingMore && (
            <div className="py-4 flex items-center justify-center gap-2 text-xs text-zinc-400">
              <div className="size-3.5 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
              <span>Carregando mais personagens...</span>
            </div>
          )}

          {!entityLoading &&
            draft.trim().length >= 2 &&
            characterResults.length === 0 && (
              <p className="py-16 text-center text-sm text-zinc-400">
                Nenhum personagem encontrado para &quot;{draft.trim()}&quot;.
              </p>
            )}
        </section>
      )}

      {/* =====================================================
          CONTEÚDO: ABA PEOPLE
      ====================================================== */}
      {activeTab === "people" && (
        <section className="space-y-4">
          {entityLoading && peopleResults.length === 0 && (
            <div className="py-12 flex items-center justify-center gap-2 text-sm text-zinc-400">
              <div className="size-4 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
              <span>Pesquisando profissionais...</span>
            </div>
          )}

          {!entityLoading && draft.trim().length < 2 && (
            <div className="py-20 text-center">
              <Mic2 className="mx-auto size-8 text-zinc-500" />
              <p className="mt-4 font-display text-2xl text-zinc-200">
                Pesquise profissionais (People)
              </p>
              <p className="mt-2 text-sm text-zinc-400">
                Dubladores, diretores, roteiristas e equipe técnica de animes.
              </p>
            </div>
          )}

          {peopleResults.length > 0 && (
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
              {peopleResults.map((person) => (
                <SearchPersonResultCard key={person.id} person={person} />
              ))}
            </div>
          )}

          <div ref={entitySentinelRef} className="h-6" aria-hidden="true" />
          {entityLoadingMore && (
            <div className="py-4 flex items-center justify-center gap-2 text-xs text-zinc-400">
              <div className="size-3.5 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
              <span>Carregando mais profissionais...</span>
            </div>
          )}

          {!entityLoading &&
            draft.trim().length >= 2 &&
            peopleResults.length === 0 && (
              <p className="py-16 text-center text-sm text-zinc-400">
                Nenhum profissional encontrado para &quot;{draft.trim()}&quot;.
              </p>
            )}
        </section>
      )}
    </div>
  );
}

/* ===========================================================
   CARD DE ANIME NA BUSCA (REFERÊNCIA VISUAL BINGEBANG)
   - Pôster vertical retangular com cantos retos (sem cantos arredondados)
   - Proporção 2:3 preservada sem cortes
   - Sem textos, notas, estrelas ou badges sobrepostos
   - Título abaixo do pôster
   - Gênero e ano abaixo do título em tamanho menor
   - Animação suave e rápida de escala e realce ao clicar/tocar
=========================================================== */
function SearchAnimeResultCard({ anime }: { anime: SlimAnime }) {
  const title = displayTitle(anime);
  const coverAttrs = getResponsiveCoverAttrs(anime.cover, "card-md");
  const primaryGenre = anime.genres?.[0]
    ? GENRE_PT[anime.genres[0]] || anime.genres[0]
    : anime.format
      ? FORMAT_PT[anime.format] || anime.format
      : "";
  const yearText = anime.year ? String(anime.year) : "";

  return (
    <article className="group flex flex-col min-w-0">
      <Link
        to="/anime/$id"
        params={{ id: anime.id }}
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
        {/* Pôster vertical retangular com cantos retos (sem cantos arredondados) */}
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
          {anime.cover ? (
            <img
              src={coverAttrs.src}
              srcSet={coverAttrs.srcSet}
              sizes={coverAttrs.sizes}
              alt=""
              width={230}
              height={345}
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
            <div className="flex size-full items-center justify-center font-display text-lg text-zinc-600">
              {title.slice(0, 1)}
            </div>
          )}
        </div>

        {/* Informações estritamente FORA do pôster */}
        <div className="mt-2 flex flex-col px-0.5">
          {/* Título abaixo do pôster */}
          <h3
            title={title}
            className="truncate text-xs sm:text-sm font-medium text-zinc-100 transition-colors group-hover:text-purple-300 group-active:text-purple-200"
          >
            {title}
          </h3>

          {/* Gênero e ano abaixo do título, em tamanho menor (sem notas nem estrelas) */}
          <div className="mt-0.5 text-[10.5px] sm:text-xs text-zinc-400 truncate">
            {primaryGenre}
            {primaryGenre && yearText ? " · " : ""}
            {yearText}
          </div>
        </div>
      </Link>
    </article>
  );
}

/* ===========================================================
   CARD DE PERSONAGEM NA BUSCA
=========================================================== */
function SearchCharacterResultCard({
  character,
}: {
  character: SearchCharacterItem;
}) {
  const animeId = character.anime?.id;
  const imageSrc = character.image?.large || character.image?.medium || "";

  const card = (
    <article className="group flex flex-col min-w-0">
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
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={character.name.full}
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
          <div className="flex size-full items-center justify-center text-zinc-600">
            <UserRound className="size-8" />
          </div>
        )}
      </div>

      <div className="mt-2 flex flex-col px-0.5">
        <h3
          title={character.name.full}
          className="truncate text-xs sm:text-sm font-medium text-zinc-100 transition-colors group-hover:text-purple-300 group-active:text-purple-200"
        >
          {character.name.full}
        </h3>
        <p className="mt-0.5 truncate text-[10.5px] sm:text-xs text-zinc-400">
          {character.role || "Personagem"}
          {character.anime?.title ? ` · ${character.anime.title}` : ""}
        </p>
      </div>
    </article>
  );

  return animeId ? (
    <Link
      to="/anime/$id"
      params={{ id: String(animeId) }}
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
      {card}
    </Link>
  ) : (
    card
  );
}

/* ===========================================================
   CARD DE PROFISSIONAL (PEOPLE) NA BUSCA
=========================================================== */
function SearchPersonResultCard({
  person,
}: {
  person: SearchPersonItem;
}) {
  const animeId = person.anime?.id;
  const imageSrc = person.image?.large || person.image?.medium || "";

  const card = (
    <article className="group flex flex-col min-w-0">
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
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={person.name.full}
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
          <div className="flex size-full items-center justify-center text-zinc-600">
            <Mic2 className="size-8" />
          </div>
        )}
      </div>

      <div className="mt-2 flex flex-col px-0.5">
        <h3
          title={person.name.full}
          className="truncate text-xs sm:text-sm font-medium text-zinc-100 transition-colors group-hover:text-purple-300 group-active:text-purple-200"
        >
          {person.name.full}
        </h3>
        <p className="mt-0.5 truncate text-[10.5px] sm:text-xs text-zinc-400">
          {person.role || "Profissional"}
          {person.anime?.title ? ` · ${person.anime.title}` : ""}
        </p>
      </div>
    </article>
  );

  return animeId ? (
    <Link
      to="/anime/$id"
      params={{ id: String(animeId) }}
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
      {card}
    </Link>
  ) : (
    card
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={className}>
      <Label className="mb-1.5 block">{label}</Label>
      {children}
    </label>
  );
}
