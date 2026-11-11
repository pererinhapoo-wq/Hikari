import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  createFileRoute,
  Link,
  useNavigate,
} from "@tanstack/react-router";

import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Star,
  Tags,
  TrendingUp,
} from "lucide-react";

import {
  fetchBrowse,
  fetchGenres,
} from "@/lib/api";

import { overlayList } from "@/lib/overlay";
import { buildCleanCanonical, DEFAULT_OG_IMAGE } from "@/lib/seo";

import { useHikariStore } from "@/lib/store";

import {
  AnimeCard,
  AnimeCardSkeleton,
} from "@/components/anime-card";

import { NativeSelect } from "@/components/ui/native-select";

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

  head: ({ params }) => {
    const sectionTitles: Record<string, { title: string; desc: string }> = {
      popular: {
        title: "Animes Mais Populares — HIKARI",
        desc: "Explore os animes mais populares de todos os tempos no catálogo completo do HIKARI.",
      },
      trending: {
        title: "Animes em Alta — HIKARI",
        desc: "Descubra as séries e episódios de anime em alta nesta semana no HIKARI.",
      },
      top: {
        title: "Melhores Animes Avaliados — HIKARI",
        desc: "Confira o ranking dos animes com as maiores notas e melhores avaliações da comunidade no HIKARI.",
      },
      season: {
        title: "Temporada de Animes — HIKARI",
        desc: "Acompanhe todos os lançamentos da temporada atual de animes transmitidos no Japão no HIKARI.",
      },
      genres: {
        title: "Gêneros de Animes — HIKARI",
        desc: "Explore animações japonesas organizadas por gênero: ação, romance, fantasia, ficção e mais no HIKARI.",
      },
    };

    const info = sectionTitles[params.section] || {
      title: "Explorar Animes — HIKARI",
      desc: "Navegue pelo catálogo completo de animes com sinopses, trailers e episódios online no HIKARI.",
    };

    const canonicalUrl = buildCleanCanonical(`/browse/${params.section}`);

    return {
      links: [
        {
          rel: "canonical",
          href: canonicalUrl,
        },
      ],
      meta: [
        { title: info.title },
        { name: "description", content: info.desc },
        { property: "og:title", content: info.title },
        { property: "og:description", content: info.desc },
        { property: "og:image", content: DEFAULT_OG_IMAGE },
        { property: "og:url", content: canonicalUrl },
        { property: "og:locale", content: "pt_BR" },
        { property: "og:site_name", content: "HIKARI" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: info.title },
        { name: "twitter:description", content: info.desc },
        { name: "twitter:image", content: DEFAULT_OG_IMAGE },
      ],
    };
  },

  pendingComponent: () => (
    <div className="grid grid-cols-3 gap-2.5 pt-20 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
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

  // Chave unificada para detectar mudanças de filtro/seção
  const currentQueryKey = `${section}-${genre ?? ""}-${season ?? ""}-${year ?? ""}`;
  const [accumulatedItems, setAccumulatedItems] = useState(() => result?.items ?? []);
  const lastKeyRef = useRef(currentQueryKey);
  const isNavigatingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Reseta ou acumula itens sem duplicação
  useEffect(() => {
    if (lastKeyRef.current !== currentQueryKey || page === 1) {
      lastKeyRef.current = currentQueryKey;
      setAccumulatedItems(result?.items ?? []);
      isNavigatingRef.current = false;
      return;
    }

    if (result?.items && result.items.length > 0) {
      setAccumulatedItems((prev) => {
        const existingIds = new Set(prev.map((item) => item.id));
        const newItems = result.items.filter((item) => !existingIds.has(item.id));
        return newItems.length > 0 ? [...prev, ...newItems] : prev;
      });
    }
    isNavigatingRef.current = false;
  }, [result, page, currentQueryKey]);

  // Determina se há próxima página
  const itemsPerPage = 24;
  const total =
    result && "total" in result && typeof result.total === "number"
      ? result.total
      : 0;
  const totalPages = Math.max(1, Math.ceil(total / itemsPerPage));

  const hasNextPage =
    section === "genres"
      ? Boolean(result?.hasNext) || (page < totalPages && (result?.items?.length ?? 0) >= itemsPerPage)
      : Boolean(result?.hasNext);

  // IntersectionObserver para carregamento automático sem clique
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting && !isNavigatingRef.current && hasNextPage) {
          isNavigatingRef.current = true;
          void (navigate as any)({
            search: (prev: any) => ({
              ...prev,
              page: (prev?.page ?? 1) + 1,
            }),
            replace: true,
          });
        }
      },
      { rootMargin: "600px 0px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, currentQueryKey, page, navigate]);

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
        accumulatedItems,
        locals,
      );

    return (
      <div className="space-y-6 py-5 sm:space-y-8 sm:py-8">
        <section>
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-elevated">
                <Tags className="size-5 text-fg" />
              </div>

              <div className="min-w-0">
                <h1 className="font-display text-2xl tracking-tight sm:text-3xl">
                  {genre}
                </h1>

                <p className="mt-1 text-sm text-muted">
                  Animes do gênero {genre}.
                </p>
              </div>
            </div>

            <Link
              to="/browse/$section"
              params={{
                section: "genres",
              }}
              aria-label="Fechar gênero"
              title="Voltar para gêneros"
              className="flex size-10 shrink-0 items-center justify-center rounded-xl text-muted transition-colors hover:bg-elevated hover:text-fg"
            >
              <span className="text-2xl leading-none" aria-hidden="true">
                ×
              </span>
            </Link>
          </div>
        </section>

        {items.length === 0 ? (
          <p className="py-16 text-center text-muted">
            Nenhum anime encontrado para este gênero.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
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

        {/* Sentinela de carregamento automático */}
        <div ref={sentinelRef} className="h-6" aria-hidden="true" />

        {hasNextPage && (
          <div className="py-6 flex items-center justify-center gap-2 text-xs text-zinc-400">
            <div className="size-3.5 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
            <span>Carregando mais animes...</span>
          </div>
        )}
      </div>
    );
  }

  const items =
    overlayList(
      accumulatedItems,
      locals,
    );

  const isSeasonPage =
    section === "season";

  const sectionMeta = {
    popular: {
      title: "Populares",
      description:
        "Os animes mais populares.",
      Icon: Star,
    },
    top: {
      title: "Mais bem avaliados",
      description:
        "Animes com as melhores avaliações.",
      Icon: Star,
    },
    trending: {
      title: "Em alta",
      description:
        "Animes que estão em alta no momento.",
      Icon: TrendingUp,
    },
    season: {
      title: "Calendário de animes",
      description:
        "Confira os animes de cada temporada.",
      Icon: CalendarDays,
    },
  } as const;

  const meta =
    sectionMeta[section as keyof typeof sectionMeta] ??
    sectionMeta.popular;

  const SectionIcon = meta.Icon;

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

  return (
    <div className="space-y-6 py-5 sm:space-y-8 sm:py-8">
      {/* CABEÇALHO */}
      <section>
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-elevated">
            <SectionIcon className="size-5 text-fg" />
          </div>

          <div>
            <h1 className="font-display text-2xl tracking-tight sm:text-3xl">
              {meta.title}
            </h1>

            <p className="mt-1 text-sm text-muted">
              {meta.description}
            </p>
          </div>
        </div>
      </section>

      {/* FILTROS — SOMENTE NO CALENDÁRIO */}
      {isSeasonPage && (
        <>
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
        </>
      )}

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
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
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

      {/* Sentinela de carregamento automático */}
      <div ref={sentinelRef} className="h-6" aria-hidden="true" />

      {hasNextPage && (
        <div className="py-6 flex items-center justify-center gap-2 text-xs text-zinc-400">
          <div className="size-3.5 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
          <span>Carregando mais animes...</span>
        </div>
      )}
    </div>
  );
}
