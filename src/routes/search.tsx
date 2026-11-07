import {
  createFileRoute,
  Link,
} from "@tanstack/react-router";

import {
  ChevronLeft,
  ChevronRight,
  Film,
  Loader2,
  Lock,
  Search as SearchIcon,
  SlidersHorizontal,
  Users,
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
  FORMAT_PT,
  GENRE_PT,
  SORT_OPTIONS,
  STATUS_PT,
} from "@/lib/labels";

import { overlayList } from "@/lib/overlay";
import { searchUsers, type SearchUserItem } from "@/lib/profile.functions";
import { buildCleanCanonical, DEFAULT_OG_IMAGE } from "@/lib/seo";
import { useHikariStore } from "@/lib/store";

import {
  AnimeCard,
  AnimeCardSkeleton,
} from "@/components/anime-card";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

const YEARS = Array.from(
  { length: 37 },
  (_, i) =>
    String(2026 - i),
);

type Search = {
  q?: string;
  genre?: string;
  year?: string;
  format?: string;
  status?: string;
  sort?: string;
  page?: number;
  adult?: boolean;
  tab?: "animes" | "users";
};

export const Route =
  createFileRoute("/search")({
    validateSearch: (
      raw: Record<string, unknown>,
    ): Search => ({
      q:
        typeof raw.q === "string" &&
        raw.q
          ? raw.q
          : undefined,

      genre:
        typeof raw.genre === "string" &&
        raw.genre
          ? raw.genre
          : undefined,

      year:
        typeof raw.year === "string" &&
        raw.year
          ? raw.year
          : undefined,

      format:
        typeof raw.format === "string" &&
        raw.format
          ? raw.format
          : undefined,

      status:
        typeof raw.status === "string" &&
        raw.status
          ? raw.status
          : undefined,

      sort:
        typeof raw.sort === "string" &&
        raw.sort
          ? raw.sort
          : undefined,

      page:
        typeof raw.page === "string" &&
        /^\d+$/.test(raw.page)
          ? Math.max(
              1,
              Number(raw.page),
            )
          : undefined,

      adult:
        raw.adult === true ||
        raw.adult === "true"
          ? true
          : undefined,

      tab:
        raw.tab === "users"
          ? "users"
          : undefined,
    }),

    loaderDeps: ({
      search,
    }) => search,

    loader: async ({
      deps,
    }) => {
      const [
        result,
        genres,
      ] = await Promise.all([
        searchCatalog({
          data: {
            ...deps,
            page:
              deps.page ?? 1,
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

    pendingComponent:
      SearchPending,

    component:
      SearchPage,
  });

function SearchPending() {
  return (
    <div className="grid grid-cols-2 gap-3 pt-6 sm:grid-cols-4 lg:grid-cols-6">
      {Array.from(
        { length: 12 },
        (_, i) => (
          <div
            key={i}
            className="[&>div]:w-full"
          >
            <AnimeCardSkeleton />
          </div>
        ),
      )}
    </div>
  );
}

function SearchPage() {
  const search =
    Route.useSearch();

  const navigate =
    Route.useNavigate();

  const {
    result,
    genres,
  } =
    Route.useLoaderData();

  const locals =
    useHikariStore(
      (s) => s.animes,
    );

  /*
   * =========================================================
   * RELOAD REAL DA PÁGINA
   * =========================================================
   */

  const [
    clearingOnReload,
    setClearingOnReload,
  ] = useState(() => {
    if (
      typeof window === "undefined"
    ) {
      return false;
    }

    const navigation =
      window.performance.getEntriesByType(
        "navigation",
      )[0] as
        | PerformanceNavigationTiming
        | undefined;

    const alreadyHandled =
      Boolean(
        (
          window as Window & {
            __hikariSearchReloadHandled?: boolean;
          }
        ).__hikariSearchReloadHandled,
      );

    if (
      navigation?.type === "reload" &&
      !alreadyHandled
    ) {
      (
        window as Window & {
          __hikariSearchReloadHandled?: boolean;
        }
      ).__hikariSearchReloadHandled =
        true;

      return true;
    }

    return false;
  });

  /*
   * =========================================================
   * CAMPO DE BUSCA
   * =========================================================
   */

  const [
    draft,
    setDraft,
  ] = useState(() =>
    search.q ?? "",
  );

  /*
   * Guarda a primeira execução do efeito de sincronização.
   *
   * Isso impede que o React apague "jujut" logo depois
   * que o usuário começa a digitar.
   */

  const firstSearchSync =
    useRef(true);

  const [
    filtersOpen,
    setFiltersOpen,
  ] = useState(false);

  const currentPage =
    search.page ?? 1;

  const activeTab: "animes" | "users" =
    search.tab === "users" ? "users" : "animes";

  const handleTabChange = (nextTab: "animes" | "users") => {
    void navigate({
      search: {
        ...search,
        tab: nextTab === "users" ? "users" : undefined,
      },
      replace: true,
    });
  };

  /*
   * =========================================================
   * PESQUISA DE USUÁRIOS (ETAPA 12)
   * =========================================================
   */

  const [userResults, setUserResults] = useState<SearchUserItem[]>([]);
  const [usersPage, setUsersPage] = useState(1);
  const [hasMoreUsers, setHasMoreUsers] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersLoadingMore, setUsersLoadingMore] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const isFetchingMoreRef = useRef(false);

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
    if (usersLoadingMore || isFetchingMoreRef.current || !hasMoreUsers) {
      return;
    }

    let clean = draft.trim();
    if (clean.startsWith("@")) {
      clean = clean.slice(1).trim();
    }
    if (clean.length < 2) return;

    const nextPage = usersPage + 1;
    isFetchingMoreRef.current = true;
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
      isFetchingMoreRef.current = false;
      setUsersLoadingMore(false);
    }
  };

  /*
   * =========================================================
   * LIMPAR BUSCA SOMENTE NO RELOAD REAL
   * =========================================================
   *
   * O gênero e o tipo da busca são preservados.
   */

  useEffect(() => {
    if (!clearingOnReload) {
      return;
    }

    setDraft("");

    void navigate({
      search: {
        genre:
          search.genre,
        adult:
          search.adult,
      },
      replace: true,
    }).finally(() => {
      setClearingOnReload(false);
    });
  }, [
    clearingOnReload,
    navigate,
    search.genre,
    search.adult,
  ]);

  /*
   * =========================================================
   * SINCRONIZAR CAMPO COM A URL
   * =========================================================
   *
   * IMPORTANTE:
   * Não executamos esta sincronização na primeira montagem.
   *
   * Assim, o valor inicial do campo continua sendo o valor
   * correto e o usuário pode digitar normalmente.
   */

  useEffect(() => {
    if (
      firstSearchSync.current
    ) {
      firstSearchSync.current =
        false;

      return;
    }

    if (clearingOnReload) {
      return;
    }

    setDraft(
      search.q ?? "",
    );
  }, [
    search.q,
    clearingOnReload,
  ]);

  /*
   * =========================================================
   * BUSCA AUTOMÁTICA
   * =========================================================
   *
   * Não precisa apertar Enter.
   *
   * A partir de 2 caracteres, aguarda 700ms.
   */

  useEffect(() => {
    if (clearingOnReload) {
      return;
    }

    if (activeTab === "users") {
      return;
    }

    const q =
      draft.trim();

    /*
     * Não pesquisa uma única letra.
     */

    if (
      q.length > 0 &&
      q.length < 2
    ) {
      return;
    }

    const current =
      (
        search.q ?? ""
      ).trim();

    if (q === current) {
      return;
    }

    const timer =
      window.setTimeout(() => {
        void navigate({
          search: {
            ...search,
            q:
              q || undefined,
            page: 1,
          },
          replace: true,
        });
      }, 700);

    return () =>
      window.clearTimeout(
        timer,
      );
  }, [
    draft,
    navigate,
    search,
    clearingOnReload,
    activeTab,
  ]);

  /*
   * =========================================================
   * RESULTADOS
   * =========================================================
   */

  const items =
    useMemo(() => {
      if (clearingOnReload) {
        return [];
      }

      const q =
        (
          search.q ?? ""
        )
          .trim()
          .toLowerCase();

      /*
       * Animes locais somente na primeira página.
       */

      const localHits =
        currentPage === 1
          ? overlayList(
              [],
              locals,
            ).filter(
              (anime) => {
                const isHentai =
                  anime.genres?.some(
                    (genre) =>
                      genre
                        .trim()
                        .toLowerCase() ===
                      "hentai",
                  ) ?? false;

                /*
                 * Busca adulta:
                 * somente Hentai.
                 *
                 * Busca normal:
                 * exclui Hentai.
                 */

                if (
                  search.adult
                ) {
                  if (
                    !isHentai
                  ) {
                    return false;
                  }
                } else if (
                  isHentai
                ) {
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

                if (
                  search.genre &&
                  !anime.genres.includes(
                    search.genre,
                  )
                ) {
                  return false;
                }

                return true;
              },
            )
          : [];

      const remote =
        overlayList(
          result.items,
          locals,
        ).filter(
          (anime) => {
            const isHentai =
              anime.genres?.some(
                (genre) =>
                  genre
                    .trim()
                    .toLowerCase() ===
                  "hentai",
              ) ?? false;

            /*
             * Proteção adicional no resultado remoto.
             *
             * Isso garante que nenhum conteúdo +18
             * apareça na busca normal, e que a busca
             * adulta permaneça somente em Hentai.
             */

            return search.adult
              ? isHentai
              : !isHentai;
          },
        );

      const seen =
        new Set(
          localHits.map(
            (anime) =>
              anime.id,
          ),
        );

      return [
        ...localHits,
        ...remote.filter(
          (anime) =>
            !seen.has(
              anime.id,
            ),
        ),
      ];
    }, [
      currentPage,
      locals,
      result.items,
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

  function apply(
    next: Partial<Search>,
  ) {
    void navigate({
      search: {
        ...search,
        ...next,
        page: 1,
      },
    });
  }

  const genreOptions =
    genres.length
      ? genres
      : Object.keys(
          GENRE_PT,
        );

  const hasAnimes =
    items.length > 0;

  const hasQuery =
    Boolean(
      search.q?.trim() ||
      search.genre,
    );

  /*
   * =========================================================
   * PAGINAÇÃO
   * =========================================================
   */

  const pageNumbers =
    useMemo(() => {
      const pages =
        new Set<number>();

      pages.add(1);

      if (
        currentPage <= 3
      ) {
        pages.add(2);
        pages.add(3);
        pages.add(4);
        pages.add(5);
      } else {
        pages.add(
          currentPage - 2,
        );

        pages.add(
          currentPage - 1,
        );

        pages.add(
          currentPage,
        );

        if (
          result.hasNext
        ) {
          pages.add(
            currentPage + 1,
          );
        }
      }

      return Array.from(
        pages,
      )
        .filter(
          (page) =>
            page >= 1,
        )
        .sort(
          (a, b) =>
            a - b,
        );
    }, [
      currentPage,
      result.hasNext,
    ]);

  function goToPage(
    page: number,
  ) {
    if (
      page < 1 ||
      page === currentPage
    ) {
      return;
    }

    void navigate({
      search: {
        ...search,
        page,
      },
    });
  }

  /*
   * =========================================================
   * BLOQUEIO DURANTE RELOAD
   * =========================================================
   *
   * Não mostra "Pesquise um anime" durante o reload.
   */

  if (clearingOnReload) {
    return (
      <div className="space-y-6 pt-6">

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              window.history.back()
            }
          >
            <ChevronLeft className="size-4" />
            Voltar
          </Button>
        </div>

        <SearchPending />

      </div>
    );
  }

  /*
   * =========================================================
   * RENDER
   * =========================================================
   */

  return (
    <div className="space-y-6 pt-6">

      {/* =====================================================
          VOLTAR
      ====================================================== */}

      <div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() =>
            window.history.back()
          }
        >
          <ChevronLeft className="size-4" />
          Voltar
        </Button>
      </div>

      {/* =====================================================
          ABAS DISCRETAS: ANIMES E USUÁRIOS
      ====================================================== */}

      <div className="flex items-center gap-2 border-b border-white/[0.08] pb-2">
        <button
          type="button"
          onClick={() => handleTabChange("animes")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold transition-all ${
            activeTab === "animes"
              ? "bg-violet-600/20 text-violet-300 border border-violet-500/30 shadow-sm"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]"
          }`}
        >
          <Film className="size-4" />
          <span>Animes</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange("users")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold transition-all ${
            activeTab === "users"
              ? "bg-violet-600/20 text-violet-300 border border-violet-500/30 shadow-sm"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]"
          }`}
        >
          <Users className="size-4" />
          <span>Usuários</span>
        </button>
      </div>

      {/* =====================================================
          BUSCA
      ====================================================== */}

      <div className="relative flex gap-2">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />

          <Input
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
            }}
            placeholder={
              activeTab === "users"
                ? "Buscar usuários por @username ou nome…"
                : "Buscar animes…"
            }
            className="pl-10"
            aria-label={
              activeTab === "users" ? "Buscar usuários" : "Buscar animes"
            }
          />
        </div>

        {activeTab === "animes" && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Filtros"
            onClick={() =>
              setFiltersOpen((value) => !value)
            }
          >
            <SlidersHorizontal className="size-4" />
          </Button>
        )}
      </div>

      {/* =====================================================
          FILTROS (SOMENTE ABA ANIMES)
      ====================================================== */}

      {activeTab === "animes" && (
        <div
          className={
            filtersOpen
              ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
              : "hidden lg:grid lg:grid-cols-4 lg:gap-3"
          }
        >
          {/* GÊNERO */}
          <Field label="Gênero">
            <NativeSelect
              value={search.genre ?? ""}
              onChange={(e) =>
                apply({
                  genre: e.target.value || undefined,
                })
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

          {/* ANO */}
          <Field label="Ano">
            <NativeSelect
              value={search.year ?? ""}
              onChange={(e) =>
                apply({
                  year: e.target.value || undefined,
                })
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

          {/* FORMATO */}
          <Field label="Formato">
            <NativeSelect
              value={search.format ?? ""}
              onChange={(e) =>
                apply({
                  format: e.target.value || undefined,
                })
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

          {/* STATUS */}
          <Field label="Status">
            <NativeSelect
              value={search.status ?? ""}
              onChange={(e) =>
                apply({
                  status: e.target.value || undefined,
                })
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

          {/* ORDENAR */}
          <Field label="Ordenar" className="lg:col-span-2">
            <NativeSelect
              value={search.sort ?? "TRENDING_DESC"}
              onChange={(e) =>
                apply({
                  sort: e.target.value || undefined,
                })
              }
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
      )}

      {/* =====================================================
          CONTEÚDO DA ABA DE ANIMES
      ====================================================== */}

      {activeTab === "animes" && (
        <>
          {hasQuery && hasAnimes && (
            <section className="space-y-5">
              <div className="flex items-end justify-between gap-3">
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <h1 className="font-display text-2xl tracking-tight sm:text-3xl">
                    Resultados da busca
                  </h1>
                  <span className="text-sm text-muted">
                    {items.length}{" "}
                    {items.length === 1
                      ? "anime encontrado"
                      : "animes encontrados"}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 items-stretch gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {items.map((anime) => (
                  <div
                    key={anime.id}
                    className="min-w-0 [&>article]:w-full"
                  >
                    <AnimeCard anime={anime} />
                  </div>
                ))}
              </div>

              {(currentPage > 1 || result.hasNext) && (
                <div className="flex items-center justify-center gap-1 pt-4">
                  <button
                    type="button"
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    aria-label="Página anterior"
                    className="flex size-10 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:bg-elevated hover:text-fg disabled:pointer-events-none disabled:opacity-35"
                  >
                    <ChevronLeft className="size-5" />
                  </button>

                  <div className="flex items-center gap-1">
                    {pageNumbers.map((page) => (
                      <button
                        key={page}
                        type="button"
                        onClick={() => goToPage(page)}
                        aria-current={
                          page === currentPage ? "page" : undefined
                        }
                        className={
                          page === currentPage
                            ? "flex size-10 items-center justify-center rounded-lg bg-elevated text-sm font-semibold text-fg"
                            : "flex size-10 items-center justify-center rounded-lg text-sm text-muted transition-colors hover:bg-elevated hover:text-fg"
                        }
                      >
                        {page}
                      </button>
                    ))}

                    {result.hasNext && currentPage <= 3 && (
                      <span className="flex size-10 items-center justify-center text-sm text-muted">
                        …
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={!result.hasNext}
                    aria-label="Próxima página"
                    className="flex size-10 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:bg-elevated hover:text-fg disabled:pointer-events-none disabled:opacity-35"
                  >
                    <ChevronRight className="size-5" />
                  </button>
                </div>
              )}
            </section>
          )}

          {!hasQuery && (
            <div className="py-20 text-center">
              <SearchIcon className="mx-auto size-8 text-subtle" />
              <p className="mt-4 font-display text-2xl">
                Pesquise um anime
              </p>
              <p className="mt-2 text-sm text-muted">
                Digite o nome do anime para ver os resultados.
              </p>
            </div>
          )}

          {hasQuery && !hasAnimes && (
            <div className="py-20 text-center">
              <p className="font-display text-2xl">Nada encontrado</p>
              <p className="mt-2 text-sm text-muted">
                Tente outro título ou limpe os filtros.
              </p>
              <Link
                to="/search"
                className="mt-4 inline-block text-sm text-fg underline"
              >
                Limpar busca
              </Link>
            </div>
          )}
        </>
      )}

      {/* =====================================================
          CONTEÚDO DA ABA DE USUÁRIOS (ETAPA 12)
      ====================================================== */}

      {activeTab === "users" && (
        <section className="space-y-5">
          {/* Carregamento inicial de usuários */}
          {usersLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3.5 sm:p-4 animate-pulse"
                >
                  <div className="size-11 sm:size-12 shrink-0 rounded-xl bg-white/[0.05]" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-32 rounded bg-white/[0.05]" />
                    <div className="h-3 w-20 rounded bg-white/[0.05]" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Erro ao buscar usuários */}
          {!usersLoading && usersError && (
            <div className="py-20 text-center">
              <p className="font-display text-2xl text-red-400">
                Erro na busca
              </p>
              <p className="mt-2 text-sm text-muted">{usersError}</p>
            </div>
          )}

          {/* Menos de dois caracteres */}
          {!usersLoading && !usersError && userQueryClean.length < 2 && (
            <div className="py-20 text-center">
              <Users className="mx-auto size-8 text-subtle" />
              <p className="mt-4 font-display text-2xl">
                Pesquise um usuário
              </p>
              <p className="mt-2 text-sm text-muted">
                Digite o @username ou nome de exibição (mínimo de 2 caracteres) para encontrar membros da comunidade.
              </p>
            </div>
          )}

          {/* Nenhum usuário encontrado */}
          {!usersLoading &&
            !usersError &&
            userQueryClean.length >= 2 &&
            userResults.length === 0 && (
              <div className="py-20 text-center">
                <Users className="mx-auto size-8 text-subtle" />
                <p className="mt-4 font-display text-2xl">
                  Nenhum usuário encontrado
                </p>
                <p className="mt-2 text-sm text-muted">
                  Não encontramos membros correspondentes a &quot;{draft.trim()}&quot;. Tente outro username ou nome.
                </p>
              </div>
            )}

          {/* Resultados de usuários encontrados */}
          {!usersLoading && !usersError && userResults.length > 0 && (
            <>
              <div className="flex items-end justify-between gap-3">
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <h1 className="font-display text-2xl tracking-tight sm:text-3xl">
                    Resultados da busca
                  </h1>
                  <span className="text-sm text-muted">
                    {userResults.length}{" "}
                    {userResults.length === 1
                      ? "usuário encontrado"
                      : "usuários encontrados"}
                  </span>
                </div>
              </div>

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
                    <div
                      key={person.userId}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 sm:p-4 transition-colors hover:border-violet-500/30 hover:bg-white/[0.04]"
                    >
                      <Link
                        to="/profile/$nick"
                        params={{ nick: person.nick }}
                        className="flex items-center gap-3 min-w-0 flex-1 group"
                      >
                        <div className="flex size-11 sm:size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#161424] font-semibold text-sm sm:text-base text-violet-300 ring-1 ring-white/10">
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
                            <p className="truncate text-xs sm:text-sm font-semibold text-zinc-100 transition-colors group-hover:text-violet-300">
                              {person.displayName || person.nick}
                            </p>
                            {person.accountType === "private" && (
                              <span
                                className="inline-flex items-center gap-1 rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-zinc-400 border border-white/[0.08]"
                                title="Conta privada"
                              >
                                <Lock className="size-2.5 text-zinc-400" />
                                <span>Privada</span>
                              </span>
                            )}
                            {person.isFollowing && (
                              <span className="inline-flex items-center rounded-md bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-violet-300 border border-violet-500/20">
                                Seguindo
                              </span>
                            )}
                            {person.isOwner && (
                              <span className="inline-flex items-center rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-300">
                                Você
                              </span>
                            )}
                          </div>
                          <p className="truncate text-[11px] sm:text-xs text-zinc-500">
                            @{person.nick}
                          </p>
                        </div>
                      </Link>

                      <Link
                        to="/profile/$nick"
                        params={{ nick: person.nick }}
                        className="shrink-0 rounded-xl border border-white/10 bg-white/[0.04] px-3 sm:px-3.5 py-1.5 sm:py-2 text-xs font-semibold text-zinc-300 transition-all hover:border-violet-500/40 hover:bg-violet-600 hover:text-white"
                      >
                        Ver perfil
                      </Link>
                    </div>
                  );
                })}
              </div>

              {hasMoreUsers && (
                <div className="flex justify-center pt-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleLoadMoreUsers}
                    disabled={usersLoadingMore}
                    className="min-w-[160px] rounded-xl border-white/10 bg-surface hover:bg-elevated text-sm font-semibold"
                  >
                    {usersLoadingMore ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="size-4 animate-spin" />
                        Carregando...
                      </span>
                    ) : (
                      "Carregar mais"
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </section>
      )}

    </div>
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
    <label
      className={
        className
      }
    >
      <Label className="mb-1.5 block">
        {label}
      </Label>

      {children}
    </label>
  );
  }
