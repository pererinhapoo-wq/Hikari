import {
  useCallback,
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
  Flower2,
  Leaf,
  Loader2,
  Snowflake,
  Star,
  Sun,
  Tags,
  TrendingUp,
} from "lucide-react";

import {
  fetchBrowse,
  fetchGenres,
} from "@/lib/api";

import {
  overlayList,
  overlaySeasonList,
} from "@/lib/overlay";
import { buildCleanCanonical, DEFAULT_OG_IMAGE } from "@/lib/seo";

import { useHikariStore } from "@/lib/store";
import {
  cn,
  compareAnimeSeasons,
  currentAnimeSeason,
  stepAnimeSeason,
  type OfficialAnimeSeason,
} from "@/lib/utils";

import {
  AnimeCard,
  AnimeCardSkeleton,
} from "@/components/anime-card";

import { NativeSelect } from "@/components/ui/native-select";

type AnimeSeason = OfficialAnimeSeason;

type BrowseSearch = {
  season?: AnimeSeason;
  year?: number;
  page?: number;
  genre?: string;
};

const SEASONS: Array<{
  value: AnimeSeason;
  label: string;
  shortMonths: string;
  fullMonths: string;
  Icon: typeof Snowflake;
}> = [
  {
    value: "WINTER",
    label: "Inverno",
    shortMonths: "Jan – Mar",
    fullMonths: "Janeiro – Março",
    Icon: Snowflake,
  },
  {
    value: "SPRING",
    label: "Primavera",
    shortMonths: "Abr – Jun",
    fullMonths: "Abril – Junho",
    Icon: Flower2,
  },
  {
    value: "SUMMER",
    label: "Verão",
    shortMonths: "Jul – Set",
    fullMonths: "Julho – Setembro",
    Icon: Sun,
  },
  {
    value: "FALL",
    label: "Outono",
    shortMonths: "Out – Dez",
    fullMonths: "Outubro – Dezembro",
    Icon: Leaf,
  },
];

const MIN_BROWSE_YEAR = 1970;
const MAX_BROWSE_YEAR = Math.max(2040, new Date().getFullYear() + 10);
const SELECT_MIN_YEAR = 1985;
const SELECT_MAX_YEAR = Math.max(2030, new Date().getFullYear() + 4);

const BASE_YEARS = Array.from(
  { length: SELECT_MAX_YEAR - SELECT_MIN_YEAR + 1 },
  (_, index) => SELECT_MIN_YEAR + index,
);

function getCurrentSeason(): {
  season: AnimeSeason;
  year: number;
} {
  return currentAnimeSeason();
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
    parsed >= MIN_BROWSE_YEAR &&
    parsed <= MAX_BROWSE_YEAR
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

  const search = Route.useSearch();

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
  const [currentPage, setCurrentPage] = useState(() => page);
  const [latestResult, setLatestResult] = useState(() => result);
  const lastKeyRef = useRef(currentQueryKey);
  const lastLoaderPageRef = useRef(page);
  const lastLoaderResultRef = useRef(result);
  const activeQueryKeyRef = useRef(currentQueryKey);
  activeQueryKeyRef.current = currentQueryKey;
  const isLoadingMoreRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Reseta a listagem somente quando os parâmetros da rota/filtro mudam
  useEffect(() => {
    if (
      lastKeyRef.current !== currentQueryKey ||
      lastLoaderPageRef.current !== page ||
      lastLoaderResultRef.current !== result
    ) {
      lastKeyRef.current = currentQueryKey;
      lastLoaderPageRef.current = page;
      lastLoaderResultRef.current = result;
      isLoadingMoreRef.current = false;
      setCurrentPage(page);
      setLatestResult(result);
      setAccumulatedItems(result?.items ?? []);
    }
  }, [result, page, currentQueryKey]);

  // Determina se há próxima página a partir do resultado mais recente
  const activeResult = latestResult ?? result;
  const itemsPerPage = 24;
  const total =
    activeResult && "total" in activeResult && typeof activeResult.total === "number"
      ? activeResult.total
      : 0;
  const totalPages = Math.max(1, Math.ceil(total / itemsPerPage));

  const hasNextPage =
    section === "genres"
      ? Boolean(activeResult?.hasNext) ||
        (currentPage < totalPages && (activeResult?.items?.length ?? 0) >= itemsPerPage)
      : Boolean(activeResult?.hasNext);

  const loadMore = useCallback(async () => {
    if (isLoadingMoreRef.current || !hasNextPage) return;
    if (section === "genres" && !genre) return;

    const requestQueryKey = currentQueryKey;
    const nextPage = currentPage + 1;
    isLoadingMoreRef.current = true;

    try {
      const nextResult = await fetchBrowse({
        data: {
          section:
            section === "genres"
              ? "popular"
              : (section as "popular" | "season" | "top" | "trending"),
          page: nextPage,
          season: section === "genres" ? undefined : season,
          year: section === "genres" ? undefined : year,
          genre: section === "genres" ? genre : undefined,
        },
      });

      if (activeQueryKeyRef.current !== requestQueryKey) {
        return;
      }

      isLoadingMoreRef.current = false;
      setLatestResult(nextResult);
      setCurrentPage(nextPage);

      if (nextResult?.items && nextResult.items.length > 0) {
        setAccumulatedItems((prev) => {
          const existingIds = new Set(prev.map((item) => item.id));
          const newItems = nextResult.items.filter((item) => !existingIds.has(item.id));
          return newItems.length > 0 ? [...prev, ...newItems] : prev;
        });
      }
    } catch (err) {
      if (activeQueryKeyRef.current === requestQueryKey) {
        isLoadingMoreRef.current = false;
      }
      console.warn("[Hikari] Falha ao carregar mais animes:", err);
    }
  }, [currentPage, currentQueryKey, genre, hasNextPage, season, section, year]);

  // IntersectionObserver para carregamento automático sem alterar a rota ou resetar o scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting && !isLoadingMoreRef.current && hasNextPage) {
          void loadMore();
        }
      },
      { rootMargin: "600px 0px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, currentQueryKey, currentPage, loadMore]);

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

  const isSeasonPage =
    section === "season";

  const realCurrentSeason = getCurrentSeason();
  const activeSeason =
    season ?? realCurrentSeason.season;
  const activeYear =
    year ?? realCurrentSeason.year;

  const uiSeason =
    isSeasonPage && isAnimeSeason(search.season)
      ? search.season
      : activeSeason;
  const uiYear =
    isSeasonPage && typeof search.year === "number" && Number.isInteger(search.year)
      ? normalizeYear(search.year, activeYear)
      : activeYear;
  const isSeasonTransitioning =
    isSeasonPage && (uiSeason !== activeSeason || uiYear !== activeYear);

  const items = isSeasonPage
    ? overlaySeasonList(
        accumulatedItems,
        locals,
        activeSeason,
        activeYear,
      )
    : section === "trending" || section === "popular" || section === "top"
      ? overlayList(
          accumulatedItems,
          locals,
          { includeExtras: false },
        )
      : overlayList(
          accumulatedItems,
          locals,
        );

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
      title: "Em Temporada",
      description:
        "Acompanhe os lançamentos da estação atual, revisite temporadas passadas e antecipe estreias futuras.",
      Icon: CalendarDays,
    },
  } as const;

  const meta =
    sectionMeta[section as keyof typeof sectionMeta] ??
    sectionMeta.popular;

  const SectionIcon = meta.Icon;

  const seasonLabelMap: Record<AnimeSeason, string> = {
    WINTER: "Inverno",
    SPRING: "Primavera",
    SUMMER: "Verão",
    FALL: "Outono",
  };

  const selectedSeasonMeta =
    SEASONS.find((item) => item.value === uiSeason) ?? SEASONS[3];
  const SelectedSeasonIcon = selectedSeasonMeta.Icon;

  const prevTarget = stepAnimeSeason(uiSeason, uiYear, -1);
  const nextTarget = stepAnimeSeason(uiSeason, uiYear, 1);

  const seasonComparison = compareAnimeSeasons(
    { season: uiSeason, year: uiYear },
    realCurrentSeason,
  );
  const isViewingCurrentSeason = seasonComparison === 0;
  const isViewingPastSeason = seasonComparison < 0;
  const isViewingFutureSeason = seasonComparison > 0;

  const relativeTimelineLabel =
    seasonComparison === 0
      ? "Temporada em exibição"
      : seasonComparison === 1
        ? "Próxima temporada"
        : seasonComparison === -1
          ? "Temporada anterior"
          : seasonComparison > 1
            ? "Temporada futura"
            : "Temporada passada";

  const yearOptions = BASE_YEARS.includes(uiYear)
    ? BASE_YEARS
    : [...BASE_YEARS, uiYear].sort((a, b) => a - b);

  function navigateToSeason(
    nextSeason: AnimeSeason,
    nextYear: number,
  ) {
    const clampedYear = normalizeYear(nextYear, uiYear);
    void navigate({
      to: "/browse/$section",
      params: {
        section,
      },
      search: {
        season: nextSeason,
        year: clampedYear,
        page: 1,
      },
    });
  }

  function handleYearChange(
    nextYear: number,
  ) {
    navigateToSeason(uiSeason, nextYear);
  }

  function handleSeasonChange(
    nextSeason: AnimeSeason,
  ) {
    navigateToSeason(nextSeason, uiYear);
  }

  return (
    <div
      className={cn(
        isSeasonPage
          ? "space-y-5 pt-3 pb-5 sm:space-y-7 sm:pt-5 sm:pb-8"
          : "space-y-6 py-5 sm:space-y-8 sm:py-8",
      )}
    >
      {/* CABEÇALHO DAS DEMAIS SEÇÕES (POPULAR, TOP, TRENDING) */}
      {!isSeasonPage && (
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
      )}

      {/* EXPERIÊNCIA RENOVADA — EM TEMPORADA */}
      {isSeasonPage && (
        <section className="space-y-4 sm:space-y-5" aria-label="Calendário sazonal">
          {/* Navegação horizontal: Anterior | Esta Temporada | Próxima */}
          <nav
            aria-label="Navegação entre temporadas"
            className="grid w-full grid-cols-3 gap-1.5 rounded-2xl border border-border bg-surface/90 p-1.5 shadow-[0_14px_34px_-20px_rgba(0,0,0,0.75)]"
          >
            <button
              type="button"
              onClick={() =>
                navigateToSeason(prevTarget.season, prevTarget.year)
              }
              aria-label={`Temporada anterior: ${seasonLabelMap[prevTarget.season]} ${prevTarget.year}`}
              aria-pressed={isViewingPastSeason}
              className={cn(
                "group flex min-h-11 flex-col items-center justify-center rounded-xl px-2 py-2 text-center transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:px-3.5",
                isViewingPastSeason
                  ? "border border-primary/45 bg-primary/15 text-fg shadow-[0_0_24px_-12px_rgba(168,85,247,0.55)]"
                  : "border border-transparent text-muted hover:bg-elevated/80 hover:text-fg",
              )}
            >
              <span className="flex items-center justify-center gap-1 text-xs font-semibold whitespace-nowrap sm:gap-1.5 sm:text-sm">
                <ChevronLeft className="size-3.5 shrink-0 transition-transform duration-150 group-hover:-translate-x-0.5 sm:size-4" />
                <span>Anterior</span>
              </span>
              <span className="mt-0.5 hidden text-[11px] font-medium text-subtle tabular-nums sm:block">
                {seasonLabelMap[prevTarget.season]} {prevTarget.year}
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                navigateToSeason(
                  realCurrentSeason.season,
                  realCurrentSeason.year,
                )
              }
              aria-label={`Esta Temporada: ${seasonLabelMap[realCurrentSeason.season]} ${realCurrentSeason.year}`}
              aria-current={isViewingCurrentSeason ? "page" : undefined}
              aria-pressed={isViewingCurrentSeason}
              className={cn(
                "flex min-h-11 flex-col items-center justify-center rounded-xl px-2 py-2 text-center transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:px-3.5",
                isViewingCurrentSeason
                  ? "border border-primary/50 bg-primary/18 text-fg shadow-[0_0_26px_-10px_rgba(168,85,247,0.65)]"
                  : "border border-transparent text-muted hover:bg-elevated/80 hover:text-fg",
              )}
            >
              <span className="flex items-center justify-center gap-1.5 text-xs font-semibold whitespace-nowrap sm:text-sm">
                <CalendarDays className={cn("hidden size-3.5 shrink-0 sm:inline-block", isViewingCurrentSeason && "text-primary")} />
                <span>Esta Temporada</span>
              </span>
              <span className="mt-0.5 hidden text-[11px] font-medium text-subtle tabular-nums sm:block">
                {seasonLabelMap[realCurrentSeason.season]} {realCurrentSeason.year}
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                navigateToSeason(nextTarget.season, nextTarget.year)
              }
              aria-label={`Próxima temporada: ${seasonLabelMap[nextTarget.season]} ${nextTarget.year}`}
              aria-pressed={isViewingFutureSeason}
              className={cn(
                "group flex min-h-11 flex-col items-center justify-center rounded-xl px-2 py-2 text-center transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:px-3.5",
                isViewingFutureSeason
                  ? "border border-primary/45 bg-primary/15 text-fg shadow-[0_0_24px_-12px_rgba(168,85,247,0.55)]"
                  : "border border-transparent text-muted hover:bg-elevated/80 hover:text-fg",
              )}
            >
              <span className="flex items-center justify-center gap-1 text-xs font-semibold whitespace-nowrap sm:gap-1.5 sm:text-sm">
                <span>Próxima</span>
                <ChevronRight className="size-3.5 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5 sm:size-4" />
              </span>
              <span className="mt-0.5 hidden text-[11px] font-medium text-subtle tabular-nums sm:block">
                {seasonLabelMap[nextTarget.season]} {nextTarget.year}
              </span>
            </button>
          </nav>

          {/* Painel unificado da temporada ativa + seletores de ano e estação */}
          <div className="relative rounded-2xl border border-border bg-surface/85 p-4 shadow-[0_18px_48px_-28px_rgba(0,0,0,0.8)] sm:p-6">
            {/* Camada decorativa contida (sem clipar o dropdown do seletor de ano) */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl"
            >
              <div className="h-px w-full bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
              <div className="absolute -top-24 right-0 h-56 w-80 rounded-full bg-primary/10 blur-3xl" />
            </div>

            <div className="relative flex flex-col gap-5 sm:gap-6">
              {/* Identificação da temporada selecionada + seletor de ano */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3.5 sm:items-center sm:gap-4">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border-strong bg-elevated text-primary sm:size-12">
                    <SelectedSeasonIcon className="size-5 sm:size-6" />
                  </div>

                  <div className="min-w-0">
                    <h2 className="font-display text-xl font-semibold tracking-tight text-fg tabular-nums sm:text-2xl">
                      Animes da temporada de {selectedSeasonMeta.label} {uiYear}
                    </h2>

                    <div className="mt-1 flex flex-col gap-0.5 text-xs text-muted sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2.5 sm:gap-y-1 sm:text-sm">
                      <span className="font-medium text-fg/85 tabular-nums">
                        {selectedSeasonMeta.fullMonths} de {uiYear}
                      </span>
                      <span className="hidden text-subtle sm:inline" aria-hidden="true">·</span>
                      <span>{relativeTimelineLabel}</span>
                      {isSeasonTransitioning && (
                        <>
                          <span className="hidden text-subtle sm:inline" aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1.5 text-primary">
                            <Loader2 className="size-3.5 animate-spin" />
                            <span>Atualizando catálogo...</span>
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Seletor de ano integrado */}
                <div className="flex items-center justify-between gap-3 sm:justify-end sm:shrink-0">
                  <span className="text-xs font-semibold tracking-[0.16em] text-subtle uppercase">
                    Ano
                  </span>

                  <div className="w-36 sm:w-32">
                    <NativeSelect
                      value={String(uiYear)}
                      onChange={(event) => {
                        handleYearChange(
                          Number(event.target.value),
                        );
                      }}
                      aria-label="Selecionar ano"
                      className="h-11 rounded-xl border border-border bg-elevated/90 font-semibold tabular-nums shadow-none transition-colors hover:border-primary/40"
                    >
                      {yearOptions.map((yearOption) => (
                        <option
                          key={yearOption}
                          value={yearOption}
                        >
                          {yearOption}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                </div>
              </div>

              {/* Seletores das quatro estações com ícones vetoriais e período */}
              <div className="border-t border-border/80 pt-4 sm:pt-5">
                <div
                  role="group"
                  aria-label="Selecionar estação do ano"
                  className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3"
                >
                  {SEASONS.map((item) => {
                    const active = item.value === uiSeason;
                    const ItemIcon = item.Icon;

                    return (
                      <button
                        key={item.value}
                        type="button"
                        aria-pressed={active}
                        onClick={() =>
                          handleSeasonChange(item.value)
                        }
                        className={cn(
                          "group relative flex min-h-14 items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:px-4",
                          active
                            ? "border-primary/55 bg-primary/14 text-fg shadow-[0_0_24px_-12px_rgba(168,85,247,0.55)]"
                            : "border-border/80 bg-bg/45 text-muted hover:border-primary/35 hover:bg-elevated/80 hover:text-fg",
                        )}
                      >
                        <div
                          className={cn(
                            "flex size-9 shrink-0 items-center justify-center rounded-lg border transition-colors duration-150",
                            active
                              ? "border-primary/40 bg-primary/15 text-primary"
                              : "border-border bg-elevated/80 text-muted group-hover:text-fg",
                          )}
                        >
                          <ItemIcon className="size-4" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold leading-tight">
                            {item.label}
                          </span>
                          <span
                            className={cn(
                              "mt-0.5 block truncate text-[11px] tabular-nums",
                              active ? "text-fg/75" : "text-subtle",
                            )}
                          >
                            {item.shortMonths}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>
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
