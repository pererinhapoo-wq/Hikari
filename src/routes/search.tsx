import {
  createFileRoute,
  Link,
} from "@tanstack/react-router";

import {
  ChevronLeft,
  ChevronRight,
  Search as SearchIcon,
  SlidersHorizontal,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  fetchHomeCatalog,
  searchCatalog,
} from "@/lib/api";

import {
  FORMAT_PT,
  GENRE_PT,
  SORT_OPTIONS,
  STATUS_PT,
} from "@/lib/labels";

import { overlayList } from "@/lib/overlay";
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
    }),

    loaderDeps: ({
      search,
    }) => search,

    loader: async ({
      deps,
    }) => {
      const [
        result,
        home,
      ] = await Promise.all([
        searchCatalog({
          data: {
            ...deps,
            page:
              deps.page ?? 1,
          },
        }),

        fetchHomeCatalog(),
      ]);

      return {
        result,
        genres:
          home.genres,
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

                if (
                  q &&
                  !`${anime.titles.romaji} ${anime.titles.english} ${anime.titles.native}`
                    .toLowerCase()
                    .includes(q)
                ) {
                  return false;
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
          BUSCA
      ====================================================== */}

      <div className="relative flex gap-2">
        <div className="relative flex-1">

          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />

          <Input
            value={draft}
            onChange={(e) => {
              setDraft(
                e.target.value,
              );
            }}
            placeholder="Buscar animes…"
            className="pl-10"
            aria-label="Buscar animes"
          />

        </div>

        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Filtros"
          onClick={() =>
            setFiltersOpen(
              (value) =>
                !value,
            )
          }
        >
          <SlidersHorizontal className="size-4" />
        </Button>
      </div>

      {/* =====================================================
          FILTROS
      ====================================================== */}

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
            value={
              search.genre ??
              ""
            }
            onChange={(e) =>
              apply({
                genre:
                  e.target
                    .value ||
                  undefined,
              })
            }
          >
            <option value="">
              Todos
            </option>

            {genreOptions.map(
              (genre) => (
                <option
                  key={genre}
                  value={genre}
                >
                  {GENRE_PT[
                    genre
                  ] ?? genre}
                </option>
              ),
            )}
          </NativeSelect>
        </Field>

        {/* ANO */}
        <Field label="Ano">
          <NativeSelect
            value={
              search.year ??
              ""
            }
            onChange={(e) =>
              apply({
                year:
                  e.target
                    .value ||
                  undefined,
              })
            }
          >
            <option value="">
              Qualquer
            </option>

            {YEARS.map(
              (year) => (
                <option
                  key={year}
                  value={year}
                >
                  {year}
                </option>
              ),
            )}
          </NativeSelect>
        </Field>

        {/* FORMATO */}
        <Field label="Formato">
          <NativeSelect
            value={
              search.format ??
              ""
            }
            onChange={(e) =>
              apply({
                format:
                  e.target
                    .value ||
                  undefined,
              })
            }
          >
            <option value="">
              Todos
            </option>

            {Object.entries(
              FORMAT_PT,
            )
              .filter(
                ([key]) =>
                  [
                    "TV",
                    "MOVIE",
                    "OVA",
                    "ONA",
                    "SPECIAL",
                    "TV_SHORT",
                  ].includes(
                    key,
                  ),
              )
              .map(
                ([
                  key,
                  value,
                ]) => (
                  <option
                    key={key}
                    value={key}
                  >
                    {value}
                  </option>
                ),
              )}
          </NativeSelect>
        </Field>

        {/* STATUS */}
        <Field label="Status">
          <NativeSelect
            value={
              search.status ??
              ""
            }
            onChange={(e) =>
              apply({
                status:
                  e.target
                    .value ||
                  undefined,
              })
            }
          >
            <option value="">
              Todos
            </option>

            {Object.entries(
              STATUS_PT,
            ).map(
              ([
                key,
                value,
              ]) => (
                <option
                  key={key}
                  value={key}
                >
                  {value}
                </option>
              ),
            )}
          </NativeSelect>
        </Field>

        {/* ORDENAR */}
        <Field
          label="Ordenar"
          className="lg:col-span-2"
        >
          <NativeSelect
            value={
              search.sort ??
              "TRENDING_DESC"
            }
            onChange={(e) =>
              apply({
                sort:
                  e.target
                    .value ||
                  undefined,
              })
            }
          >
            {SORT_OPTIONS.map(
              (option) => (
                <option
                  key={
                    option.value
                  }
                  value={
                    option.value
                  }
                >
                  {
                    option.label
                  }
                </option>
              ),
            )}
          </NativeSelect>
        </Field>

      </div>

      {/* =====================================================
          RESULTADOS
      ====================================================== */}

      {hasQuery &&
        hasAnimes && (
          <section className="space-y-5">

            <div className="flex items-end justify-between gap-3">

              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">

                <h1 className="font-display text-2xl tracking-tight sm:text-3xl">
                  Resultados da busca
                </h1>

                <span className="text-sm text-muted">
                  {items.length}{" "}
                  {items.length ===
                  1
                    ? "anime encontrado"
                    : "animes encontrados"}
                </span>

              </div>

            </div>

            <div className="grid grid-cols-2 items-stretch gap-3 sm:grid-cols-4 lg:grid-cols-6">

              {items.map(
                (anime) => (
                  <div
                    key={
                      anime.id
                    }
                    className="min-w-0 [&>article]:w-full"
                  >
                    <AnimeCard
                      anime={
                        anime
                      }
                    />
                  </div>
                ),
              )}

            </div>

            {(currentPage >
              1 ||
              result.hasNext) && (
              <div className="flex items-center justify-center gap-1 pt-4">

                <button
                  type="button"
                  onClick={() =>
                    goToPage(
                      currentPage -
                        1,
                    )
                  }
                  disabled={
                    currentPage ===
                    1
                  }
                  aria-label="Página anterior"
                  className="flex size-10 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:bg-elevated hover:text-fg disabled:pointer-events-none disabled:opacity-35"
                >
                  <ChevronLeft className="size-5" />
                </button>

                <div className="flex items-center gap-1">

                  {pageNumbers.map(
                    (page) => (
                      <button
                        key={
                          page
                        }
                        type="button"
                        onClick={() =>
                          goToPage(
                            page,
                          )
                        }
                        aria-current={
                          page ===
                          currentPage
                            ? "page"
                            : undefined
                        }
                        className={
                          page ===
                          currentPage
                            ? "flex size-10 items-center justify-center rounded-lg bg-elevated text-sm font-semibold text-fg"
                            : "flex size-10 items-center justify-center rounded-lg text-sm text-muted transition-colors hover:bg-elevated hover:text-fg"
                        }
                      >
                        {
                          page
                        }
                      </button>
                    ),
                  )}

                  {result.hasNext &&
                    currentPage <=
                      3 && (
                      <span className="flex size-10 items-center justify-center text-sm text-muted">
                        …
                      </span>
                    )}

                </div>

                <button
                  type="button"
                  onClick={() =>
                    goToPage(
                      currentPage +
                        1,
                    )
                  }
                  disabled={
                    !result.hasNext
                  }
                  aria-label="Próxima página"
                  className="flex size-10 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:bg-elevated hover:text-fg disabled:pointer-events-none disabled:opacity-35"
                >
                  <ChevronRight className="size-5" />
                </button>

              </div>
            )}

          </section>
        )}

      {/* =====================================================
          SEM BUSCA
      ====================================================== */}

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

      {/* =====================================================
          NADA ENCONTRADO
      ====================================================== */}

      {hasQuery &&
        !hasAnimes && (
          <div className="py-20 text-center">

            <p className="font-display text-2xl">
              Nada encontrado
            </p>

            <p className="mt-2 text-sm text-muted">
              Tente outro título
              ou limpe os
              filtros.
            </p>

            <Link
              to="/search"
              className="mt-4 inline-block text-sm text-fg underline"
            >
              Limpar busca
            </Link>

          </div>
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
