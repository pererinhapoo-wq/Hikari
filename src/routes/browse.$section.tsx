import {
  createFileRoute,
  Link,
  useNavigate,
} from "@tanstack/react-router";

import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Search,
  Tags,
} from "lucide-react";

import {
  fetchBrowse,
  fetchGenres,
} from "@/lib/api";

import { overlayList } from "@/lib/overlay";

import { useHikariStore } from "@/lib/store";

import {
  AnimeCard,
  AnimeCardSkeleton,
} from "@/components/anime-card";

import { NativeSelect } from "@/components/ui/native-select";

import {
  useEffect,
  useState,
  type FormEvent,
} from "react";

type AnimeSeason =
  | "WINTER"
  | "SPRING"
  | "SUMMER"
  | "FALL";

type BrowseSearch = {
  season?: AnimeSeason;
  year?: number;
  page?: number;
  genre?: string;
};

const SEASONS: Array<{
  value: AnimeSeason;
  label: string;
  icon: string;
}> = [
  {
    value: "WINTER",
    label: "Inverno",
    icon: "❄️",
  },
  {
    value: "SPRING",
    label: "Primavera",
    icon: "🌸",
  },
  {
    value: "SUMMER",
    label: "Verão",
    icon: "☀️",
  },
  {
    value: "FALL",
    label: "Outono",
    icon: "🍂",
  },
];

const YEARS = Array.from(
  { length: 29 },
  (_, index) => 2000 + index,
);

function getCurrentSeason(): {
  season: AnimeSeason;
  year: number;
} {
  const now = new Date();

  const month = now.getMonth();
  const year = now.getFullYear();

  if (month <= 2) {
    return {
      season: "WINTER",
      year,
    };
  }

  if (month <= 5) {
    return {
      season: "SPRING",
      year,
    };
  }

  if (month <= 8) {
    return {
      season: "SUMMER",
      year,
    };
  }

  return {
    season: "FALL",
    year,
  };
}

function isAnimeSeason(
  value: unknown,
): value is AnimeSeason {
  return (
    value === "WINTER" ||
    value === "SPRING" ||
    value === "SUMMER" ||
    value === "FALL"
  );
}

function normalizeYear(
  value: unknown,
  fallback: number,
): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;

  if (
    Number.isInteger(parsed) &&
    parsed >= 2000 &&
    parsed <= 2028
  ) {
    return parsed;
  }

  return fallback;
}

function normalizePage(
  value: unknown,
): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;

  if (
    Number.isInteger(parsed) &&
    parsed >= 1
  ) {
    return parsed;
  }

  return 1;
}

function normalizeGenre(
  value: unknown,
): string | undefined {
  if (
    typeof value !== "string"
  ) {
    return undefined;
  }

  const genre =
    value.trim();

  return genre
    ? genre
    : undefined;
}

function cnCalendarSeason(
  active: boolean,
) {
  return [
    "flex",
    "min-h-12",
    "items-center",
    "justify-center",
    "gap-2",
    "rounded-lg",
    "border",
    "px-4",
    "text-sm",
    "font-medium",
    "transition-colors",

    active
      ? "border-fg/20 bg-elevated text-fg"
      : "border-border text-muted hover:bg-elevated hover:text-fg",
  ].join(" ");
}

function cnGenre() {
  return [
    "flex",
    "min-h-12",
    "items-center",
    "gap-3",
    "rounded-xl",
    "border",
    "border-border",
    "bg-surface",
    "px-4",
    "text-sm",
    "font-medium",
    "text-fg",
    "transition-colors",
    "hover:bg-elevated",
  ].join(" ");
}

export const Route = createFileRoute(
  "/browse/$section",
)({
  validateSearch: (
    raw: Record<string, unknown>,
  ): BrowseSearch => {
    const current =
      getCurrentSeason();

    return {
      season: isAnimeSeason(
        raw.season,
      )
        ? raw.season
        : current.season,

      year: normalizeYear(
        raw.year,
        current.year,
      ),

      page: normalizePage(
        raw.page,
      ),

      genre: normalizeGenre(
        raw.genre,
      ),
    };
  },

  loaderDeps: ({
    search,
  }) => search,

  loader: async ({
    params,
    deps,
  }) => {
    /*
     * GÊNEROS
     *
     * Sem gênero selecionado:
     * mostra a lista de gêneros.
     *
     * Com gênero selecionado:
     * mostra os animes daquele gênero.
     */
    if (
      params.section ===
      "genres"
    ) {
      const genre =
        normalizeGenre(
          deps.genre,
        );

      if (!genre) {
        const genres =
          await fetchGenres();

        return {
          section:
            "genres" as const,

          genres,

          result: null,

          season:
            undefined,

          year:
            undefined,

          page: 1,

          genre:
            undefined,
        };
      }

      const result =
        await fetchBrowse({
          data: {
            section:
              "popular",

            page:
              normalizePage(
                deps.page,
              ),

            genre,
          },
        });

      return {
        section:
          "genres" as const,

        genres:
          [] as string[],

        result,

        season:
          undefined,

        year:
          undefined,

        page:
          normalizePage(
            deps.page,
          ),

        genre,
      };
    }

    const section = [
      "popular",
      "season",
      "top",
      "trending",
    ].includes(params.section)
      ? params.section
      : "popular";

    const current =
      getCurrentSeason();

    const season =
      isAnimeSeason(
        deps.season,
      )
        ? deps.season
        : current.season;

    const year =
      normalizeYear(
        deps.year,
        current.year,
      );

    const page =
      normalizePage(
        deps.page,
      );

    const result =
      await fetchBrowse({
        data: {
          section:
            section as
              | "popular"
              | "season"
              | "top"
              | "trending",

          page,

          season,

          year,
        },
      });

    return {
      result,

      section,

      season,

      year,

      page,

      genres:
        [] as string[],

      genre:
        undefined,
    };
  },

  pendingComponent: () => (
    <div className="grid grid-cols-2 gap-3 pt-20 sm:grid-cols-4 lg:grid-cols-6">
      {Array.from(
        { length: 12 },
        (_, i) => (
          <AnimeCardSkeleton
            key={i}
          />
        ),
      )}
    </div>
  ),

  component:
    BrowsePage,
});

function BrowsePage() {
  const navigate =
    useNavigate();

  const {
    result,
    section,
    season,
    year,
    page,
    genres,
    genre,
  } =
    Route.useLoaderData();

  const locals =
    useHikariStore(
      (s) => s.animes,
    );

  /*
   * ESTADO DA BUSCA
   *
   * Fica no nível principal do componente
   * para não quebrar as regras dos Hooks.
   */
  const [
    searchQuery,
    setSearchQuery,
  ] = useState("");

  /*
   * NAVEGAÇÃO DA BUSCA
   *
   * Usa a navegação interna do TanStack Router.
   * Não abre outra aba.
   */
  function goToSearch(
    value: string,
  ) {
    const query =
      value.trim();

    if (!query) {
      return;
    }

    void navigate({
      to: "/search",
      search: {
        q: query,
      },
    });
  }

  /*
   * ENTER / BOTÃO IR
   */
  function handleAnimeSearch(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    goToSearch(
      searchQuery,
    );
  }

  /*
   * PESQUISA AUTOMÁTICA
   *
   * Aguarda 300ms depois que o usuário
   * para de digitar.
   */
  useEffect(() => {
    if (
      section !==
        "genres" ||
      !genre
    ) {
      return;
    }

    const query =
      searchQuery.trim();

    if (!query) {
      return;
    }

    const timer =
      window.setTimeout(() => {
        goToSearch(
          query,
        );
      }, 300);

    return () =>
      window.clearTimeout(
        timer,
      );
  }, [
    searchQuery,
    section,
    genre,
  ]);

  /*
   * GÊNEROS — LISTA
   */
  if (
    section ===
      "genres" &&
    !genre
  ) {
    return (
      <div className="space-y-6 py-5 sm:space-y-8 sm:py-8">
        <section>
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-elevated">
              <Tags className="size-5 text-fg" />
            </div>

            <div>
              <h1 className="font-display text-2xl tracking-tight sm:text-3xl">
                Gêneros
              </h1>

              <p className="mt-1 text-sm text-muted">
                Explore os animes por gênero.
              </p>
            </div>
          </div>
        </section>

        {genres.length === 0 ? (
          <p className="py-16 text-center text-muted">
            Nenhum gênero disponível no momento.
          </p>
        ) : (
          <section>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {genres.map(
                (item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      void navigate({
                        to: "/browse/$section",
                        params: {
                          section:
                            "genres",
                        },
                        search: {
                          genre: item,
                          page: 1,
                        },
                      });
                    }}
                    className={cnGenre()}
                  >
                    <Tags className="size-4 shrink-0 text-muted" />

                    <span className="truncate">
                      {item}
                    </span>
                  </button>
                ),
              )}
            </div>
          </section>
        )}
      </div>
    );
  }

  /*
   * GÊNEROS — ANIMES DO GÊNERO
   */
  if (
    section ===
      "genres" &&
    genre
  ) {
    const items =
      overlayList(
        result?.items ?? [],
        locals,
      );

    const showPagination =
      page > 1 ||
      Boolean(
        result?.hasNext,
      );

    const pageNumbers =
      (() => {
        const pages =
          new Set<number>();

        pages.add(1);
        pages.add(page);

        if (
          result?.hasNext
        ) {
          pages.add(
            page + 1,
          );
        }

        return Array.from(
          pages,
        )
          .filter(
            (value) =>
              value >= 1,
          )
          .sort(
            (a, b) =>
              a - b,
          );
      })();

    function goToGenrePage(
      nextPage: number,
    ) {
      if (
        nextPage < 1 ||
        nextPage === page
      ) {
        return;
      }

      if (
        nextPage >
          page + 1 &&
        !result?.hasNext
      ) {
        return;
      }

      void navigate({
        to: "/browse/$section",
        params: {
          section:
            "genres",
        },
        search: {
          genre,
          page: nextPage,
        },
      });
    }

    return (
      <div className="space-y-6 py-5 sm:space-y-8 sm:py-8">
        <section>
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-elevated">
              <Tags className="size-5 text-fg" />
            </div>

            <div>
              <h1 className="font-display text-2xl tracking-tight sm:text-3xl">
                {genre}
              </h1>

              <p className="mt-1 text-sm text-muted">
                Animes do gênero {genre}.
              </p>
            </div>
          </div>
        </section>

        {/* BARRA DE PESQUISA */}
        <form
          onSubmit={
            handleAnimeSearch
          }
          className="flex items-center gap-2 rounded-2xl border border-border bg-bg p-1.5"
        >
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted" />

            <input
              type="search"
              value={searchQuery}
              onChange={(event) =>
                setSearchQuery(
                  event.target.value,
                )
              }
              placeholder="Buscar animes..."
              aria-label="Buscar animes"
              className="h-12 w-full rounded-xl border border-border bg-surface pl-10 pr-3 text-base text-fg outline-none placeholder:text-muted focus:border-fg/20 focus:ring-1 focus:ring-fg/10"
            />
          </div>

          <button
            type="submit"
            aria-label="Pesquisar anime"
            className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-elevated text-fg transition-colors hover:bg-elevated/80 active:scale-95"
          >
            <Search className="size-5" />
          </button>
        </form>

        {items.length === 0 ? (
          <p className="py-16 text-center text-muted">
            Nenhum anime encontrado para este gênero.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {items.map(
              (anime) => (
                <AnimeCard
                  key={anime.id}
                  anime={anime}
                  size="lg"
                />
              ),
            )}
          </div>
        )}

        {showPagination && (
          <div className="flex flex-wrap items-center justify-center gap-1 pt-2">
            <button
              type="button"
              onClick={() =>
                goToGenrePage(
                  page - 1,
                )
              }
              disabled={
                page === 1
              }
              aria-label="Página anterior"
              className="flex size-10 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:bg-elevated hover:text-fg disabled:pointer-events-none disabled:opacity-35"
            >
              <ChevronLeft className="size-5" />
            </button>

            <div className="flex items-center gap-1">
              {pageNumbers.map(
                (
                  pageNumber,
                ) => (
                  <button
                    key={
                      pageNumber
                    }
                    type="button"
                    onClick={() =>
                      goToGenrePage(
                        pageNumber,
                      )
                    }
                    aria-current={
                      pageNumber ===
                      page
                        ? "page"
                        : undefined
                    }
                    className={
                      pageNumber ===
                      page
                        ? "flex size-10 items-center justify-center rounded-lg bg-elevated text-sm font-semibold text-fg"
                        : "flex size-10 items-center justify-center rounded-lg text-sm text-muted transition-colors hover:bg-elevated hover:text-fg"
                    }
                  >
                    {
                      pageNumber
                    }
                  </button>
                ),
              )}
            </div>

            <button
              type="button"
              onClick={() =>
                goToGenrePage(
                  page + 1,
                )
              }
              disabled={
                !result?.hasNext
              }
              aria-label="Próxima página"
              className="flex size-10 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:bg-elevated hover:text-fg disabled:pointer-events-none disabled:opacity-35"
            >
              <ChevronRight className="size-5" />
            </button>
          </div>
        )}

        <div className="pt-1">
          <Link
            to="/browse/$section"
            params={{
              section:
                "genres",
            }}
            className="text-sm text-muted underline underline-offset-4 hover:text-fg"
          >
            ← Voltar para gêneros
          </Link>
        </div>
      </div>
    );
  }

  const items =
    overlayList(
      result?.items ?? [],
      locals,
    );

  const currentSeason =
    SEASONS.find(
      (item) =>
        item.value ===
        season,
    );

  function handleYearChange(
    nextYear: number,
  ) {
    void navigate({
      to: "/browse/$section",
      params: {
        section,
      },
      search: {
        season,
        year: nextYear,
        page: 1,
      },
    });
  }

  function handleSeasonChange(
    nextSeason: AnimeSeason,
  ) {
    void navigate({
      to: "/browse/$section",
      params: {
        section,
      },
      search: {
        season: nextSeason,
        year,
        page: 1,
      },
    });
  }

  function goToPage(
    nextPage: number,
  ) {
    if (
      nextPage < 1 ||
      nextPage === page
    ) {
      return;
    }

    if (
      nextPage >
        page + 1 &&
      !result?.hasNext
    ) {
      return;
    }

    void navigate({
      to: "/browse/$section",
      params: {
        section,
      },
      search: {
        season,
        year,
        page: nextPage,
      },
    });
  }

  const pageNumbers =
    (() => {
      const pages =
        new Set<number>();

      pages.add(1);
      pages.add(page);

      if (
        result?.hasNext
      ) {
        pages.add(
          page + 1,
        );
      }

      return Array.from(
        pages,
      )
        .filter(
          (value) =>
            value >= 1,
        )
        .sort(
          (a, b) =>
            a - b,
        );
    })();

  const showPagination =
    page > 1 ||
    Boolean(
      result?.hasNext,
    );

  return (
    <div className="space-y-6 py-5 sm:space-y-8 sm:py-8">
      {/* CABEÇALHO */}
      <section>
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-elevated">
            <CalendarDays className="size-5 text-fg" />
          </div>

          <div>
            <h1 className="font-display text-2xl tracking-tight sm:text-3xl">
              Calendário de animes
            </h1>

            <p className="mt-1 text-sm text-muted">
              Confira os animes de cada temporada.
            </p>
          </div>
        </div>
      </section>

      {/* ANO */}
      <section className="space-y-3">
        <p className="text-xs font-semibold tracking-[0.16em] text-subtle uppercase">
          Ano
        </p>

        <NativeSelect
          value={String(year)}
          onChange={(event) => {
            handleYearChange(
              Number(
                event.target.value,
              ),
            );
          }}
          aria-label="Selecionar ano"
        >
          {YEARS.map(
            (yearOption) => (
              <option
                key={yearOption}
                value={yearOption}
              >
                {yearOption}
              </option>
            ),
          )}
        </NativeSelect>
      </section>

      {/* TEMPORADA */}
      <section className="space-y-3">
        <p className="text-xs font-semibold tracking-[0.16em] text-subtle uppercase">
          Temporada
        </p>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {SEASONS.map(
            (item) => (
              <button
                key={item.value}
                type="button"
                onClick={() =>
                  handleSeasonChange(
                    item.value,
                  )
                }
                className={cnCalendarSeason(
                  item.value ===
                    season,
                )}
              >
                <span className="text-lg">
                  {item.icon}
                </span>

                <span>
                  {item.label}
                </span>
              </button>
            ),
          )}
        </div>
      </section>

      {/* TÍTULO */}
      <section className="border-b border-border pb-4">
        <h2 className="font-display text-xl tracking-tight sm:text-2xl">
          Animes da temporada de{" "}
          {currentSeason?.label ??
            "Temporada"}{" "}
          {year}
        </h2>

        <p className="mt-1 text-sm text-muted">
          Confira a lista dos animes
          programados para esta temporada.
        </p>
      </section>

      {/* LISTA */}
      {items.length === 0 ? (
        <p className="py-16 text-center text-muted">
          Nada por aqui.{" "}
          <Link
            to="/"
            className="text-fg underline"
          >
            Voltar
          </Link>
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {items.map(
            (anime) => (
              <AnimeCard
                key={anime.id}
                anime={anime}
                size="lg"
              />
            ),
          )}
        </div>
      )}

      {/* PAGINAÇÃO — MANTIDA */}
      {showPagination && (
        <div className="flex flex-wrap items-center justify-center gap-1 pt-2">
          <button
            type="button"
            onClick={() =>
              goToPage(
                page - 1,
              )
            }
            disabled={
              page === 1
            }
            aria-label="Página anterior"
            className="flex size-10 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:bg-elevated hover:text-fg disabled:pointer-events-none disabled:opacity-35"
          >
            <ChevronLeft className="size-5" />
          </button>

          <div className="flex items-center gap-1">
            {pageNumbers.map(
              (
                pageNumber,
              ) => (
                <button
                  key={
                    pageNumber
                  }
                  type="button"
                  onClick={() =>
                    goToPage(
                      pageNumber,
                    )
                  }
                  aria-current={
                    pageNumber ===
                    page
                      ? "page"
                      : undefined
                  }
                  className={
                    pageNumber ===
                    page
                      ? "flex size-10 items-center justify-center rounded-lg bg-elevated text-sm font-semibold text-fg"
                      : "flex size-10 items-center justify-center rounded-lg text-sm text-muted transition-colors hover:bg-elevated hover:text-fg"
                  }
                >
                  {
                    pageNumber
                  }
                </button>
              ),
            )}
          </div>

          <button
            type="button"
            onClick={() =>
              goToPage(
                page + 1,
              )
            }
            disabled={
              !result?.hasNext
            }
            aria-label="Próxima página"
            className="flex size-10 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:bg-elevated hover:text-fg disabled:pointer-events-none disabled:opacity-35"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
      )}
    </div>
  );
    }
