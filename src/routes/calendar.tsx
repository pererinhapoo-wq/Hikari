import {
  createFileRoute,
  Link,
  useNavigate,
} from "@tanstack/react-router";

import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { AnimeCard } from "@/components/anime-card";
import type { SlimAnime } from "@/lib/types";
import { NativeSelect } from "@/components/ui/native-select";

type AnimeSeason =
  | "WINTER"
  | "SPRING"
  | "SUMMER"
  | "FALL";

type CalendarSearch = {
  season?: AnimeSeason;
  year?: number;
  page?: number;
};

type AniMedia = {
  id: number;
  idMal?: number | null;
  isAdult?: boolean;

  title?: {
    romaji?: string | null;
    english?: string | null;
    native?: string | null;
  } | null;

  coverImage?: {
    extraLarge?: string | null;
    large?: string | null;
    color?: string | null;
  } | null;

  bannerImage?: string | null;

  averageScore?: number | null;

  genres?: string[] | null;

  format?: string | null;

  status?: string | null;

  episodes?: number | null;

  season?: AnimeSeason | null;

  seasonYear?: number | null;

  description?: string | null;
};

type AniListResponse = {
  data?: {
    Page?: {
      media?: AniMedia[];

      pageInfo?: {
        currentPage?: number;
        lastPage?: number;
        hasNextPage?: boolean;
        total?: number;
      };
    };
  };
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

function mapAnime(
  anime: AniMedia,
): SlimAnime {
  return {
    id: String(anime.id),

    anilistId: anime.id,

    malId:
      anime.idMal ??
      undefined,

    titles: {
      romaji:
        anime.title?.romaji ??
        "",

      english:
        anime.title?.english ??
        "",

      native:
        anime.title?.native ??
        "",
    },

    cover:
      anime.coverImage?.extraLarge ??
      anime.coverImage?.large ??
      "",

    banner:
      anime.bannerImage ??
      "",

    synopsis:
      anime.description ??
      "",

    score:
      anime.averageScore != null
        ? anime.averageScore / 10
        : null,

    genres:
      (anime.genres ?? []).filter(
        (genre) =>
          genre !== "Hentai",
      ),

    format:
      anime.format ??
      "",

    status:
      anime.status ??
      "",

    episodesCount:
      anime.episodes ??
      null,

    season:
      anime.season ??
      null,

    year:
      anime.seasonYear ??
      null,

    trailerId:
      null,

    source:
      "anilist",
  };
}

async function fetchSeason(
  season: AnimeSeason,
  year: number,
  page: number,
): Promise<{
  items: SlimAnime[];
  currentPage: number;
  lastPage: number;
  hasNext: boolean;
  total: number;
}> {
  const response =
    await fetch(
      "https://graphql.anilist.co",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          query: `
            query CalendarSeason(
              $season: MediaSeason,
              $year: Int,
              $page: Int
            ) {
              Page(
                page: $page,
                perPage: 24
              ) {
                pageInfo {
                  currentPage
                  lastPage
                  hasNextPage
                  total
                }

                media(
                  type: ANIME,
                  season: $season,
                  seasonYear: $year,
                  sort: POPULARITY_DESC
                ) {
                  id
                  idMal
                  isAdult

                  title {
                    romaji
                    english
                    native
                  }

                  coverImage {
                    extraLarge
                    large
                    color
                  }

                  bannerImage

                  averageScore

                  genres

                  format

                  status

                  episodes

                  season

                  seasonYear

                  description(asHtml: false)
                }
              }
            }
          `,

          variables: {
            season,
            year,
            page,
          },
        }),
      },
    );

  if (!response.ok) {
    throw new Error(
      "Não foi possível carregar a temporada.",
    );
  }

  const json =
    (await response.json()) as AniListResponse;

  const pageData =
    json.data?.Page;

  const pageInfo =
    pageData?.pageInfo;

  const items =
    (pageData?.media ?? [])
      .filter(
        (anime) =>
          !anime.isAdult,
      )
      .map(mapAnime);

  return {
    items,

    currentPage:
      pageInfo?.currentPage ??
      page,

    lastPage:
      pageInfo?.lastPage ??
      1,

    hasNext:
      pageInfo?.hasNextPage ??
      false,

    total:
      pageInfo?.total ??
      items.length,
  };
}

export const Route =
  createFileRoute(
    "/calendar",
  )({
    validateSearch: (
      raw: Record<string, unknown>,
    ): CalendarSearch => {
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
      };
    },

    loaderDeps: ({
      search,
    }) => search,

    loader: async ({
      deps,
    }) => {
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
        await fetchSeason(
          season,
          year,
          page,
        );

      return {
        ...result,
        season,
        year,
        page,
      };
    },

    pendingComponent:
      CalendarPending,

    errorComponent:
      CalendarError,

    component:
      CalendarPage,
  });

function CalendarPending() {
  return (
    <div className="space-y-6 py-6">
      <div className="space-y-2">
        <div className="h-8 w-64 animate-pulse rounded bg-elevated" />

        <div className="h-4 w-80 animate-pulse rounded bg-elevated" />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {Array.from(
          { length: 4 },
          (_, index) => (
            <div
              key={index}
              className="h-12 animate-pulse rounded-lg bg-elevated"
            />
          ),
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-2 gap-y-4 sm:grid-cols-4 lg:grid-cols-6">
        {Array.from(
          { length: 12 },
          (_, index) => (
            <div
              key={index}
              className="min-w-0"
            >
              <div className="aspect-2/3 w-full animate-pulse rounded-xl bg-elevated" />

              <div className="mt-2 h-3 w-4/5 animate-pulse rounded bg-elevated" />

              <div className="mt-1 h-2.5 w-1/2 animate-pulse rounded bg-elevated" />
            </div>
          ),
        )}
      </div>
    </div>
  );
}

function CalendarError({
  error,
}: {
  error: unknown;
}) {
  const message =
    error instanceof Error
      ? error.message
      : "Tente novamente.";

  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <CalendarDays className="mx-auto size-10 text-muted" />

      <h1 className="mt-4 font-display text-2xl">
        Calendário indisponível
      </h1>

      <p className="mt-2 text-sm text-muted">
        {message}
      </p>
    </div>
  );
}

function CalendarPage() {
  const navigate =
    useNavigate();

  const {
    items,
    season,
    year,
    page,
    lastPage,
    hasNext,
    total,
  } =
    Route.useLoaderData();

  const currentSeason =
    SEASONS.find(
      (item) =>
        item.value === season,
    );

  function handleYearChange(
    nextYear: number,
  ) {
    void navigate({
      to: "/calendar",
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
      to: "/calendar",
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
      nextPage === page ||
      nextPage > lastPage
    ) {
      return;
    }

    void navigate({
      to: "/calendar",
      search: {
        season,
        year,
        page: nextPage,
      },
    });
  }

  const pageNumbers =
    (() => {
      if (lastPage <= 1) {
        return [1];
      }

      const pages =
        new Set<number>();

      pages.add(1);

      if (page <= 3) {
        for (
          let value = 2;
          value <=
            Math.min(
              5,
              lastPage,
            );
          value += 1
        ) {
          pages.add(value);
        }
      } else {
        pages.add(
          Math.max(
            2,
            page - 1,
          ),
        );

        pages.add(page);

        if (
          page + 1 <=
          lastPage
        ) {
          pages.add(
            page + 1,
          );
        }
      }

      if (lastPage > 5) {
        pages.add(lastPage);
      }

      return Array.from(
        pages,
      )
        .filter(
          (value) =>
            value >= 1 &&
            value <= lastPage,
        )
        .sort(
          (a, b) =>
            a - b,
        );
    })();

  const showPagination =
    lastPage > 1;

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
              <Link
                key={item.value}
                to="/calendar"
                search={{
                  season:
                    item.value,
                  year,
                  page: 1,
                }}
                onClick={() =>
                  handleSeasonChange(
                    item.value,
                  )
                }
                className={cnCalendarSeason(
                  item.value === season,
                )}
              >
                <span className="text-lg">
                  {item.icon}
                </span>

                <span>
                  {item.label}
                </span>
              </Link>
            ),
          )}
        </div>
      </section>

      {/* TÍTULO */}
      <section className="border-b border-border pb-4">
        <h2 className="font-display text-xl tracking-tight sm:text-2xl">
          Animes da temporada de{" "}
          {currentSeason?.label ??
            "anime"}{" "}
          {year}
        </h2>

        <p className="mt-1 text-sm text-muted">
          Confira a lista dos animes
          programados para esta temporada.
        </p>
      </section>

      {/* LISTA */}
      {items.length > 0 ? (
        <section className="grid grid-cols-2 items-stretch gap-x-2 gap-y-4 sm:grid-cols-4 sm:gap-x-3 sm:gap-y-6 lg:grid-cols-6">
          {items.map(
            (anime) => (
              <div
                key={anime.id}
                className="
                  flex
                  min-w-0
                  h-full
                  [&>article]:flex
                  [&>article]:h-full
                  [&>article]:w-full
                  [&>article>a]:flex
                  [&>article>a]:h-full
                  [&>article>a]:w-full
                  [&>article>a]:flex-col
                "
              >
                <AnimeCard
                  anime={anime}
                />
              </div>
            ),
          )}
        </section>
      ) : (
        <section className="rounded-xl border border-border bg-elevated/40 px-5 py-14 text-center">
          <CalendarDays className="mx-auto size-8 text-muted" />

          <h3 className="mt-3 font-medium">
            Nenhum anime encontrado
          </h3>

          <p className="mt-1 text-sm text-muted">
            Não encontramos animes para
            esta temporada.
          </p>
        </section>
      )}

      {/* PAGINAÇÃO */}
      {showPagination && (
        <div className="flex items-center justify-center gap-1 pt-2">
          <button
            type="button"
            onClick={() =>
              goToPage(page - 1)
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
                index,
              ) => {
                const previous =
                  pageNumbers[
                    index - 1
                  ];

                const showEllipsis =
                  previous != null &&
                  pageNumber -
                    previous >
                    1;

                return (
                  <div
                    key={
                      pageNumber
                    }
                    className="flex items-center gap-1"
                  >
                    {showEllipsis && (
                      <span className="flex size-10 items-center justify-center text-sm text-muted">
                        …
                      </span>
                    )}

                    <button
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
                  </div>
                );
              },
            )}
          </div>

          <button
            type="button"
            onClick={() =>
              goToPage(page + 1)
            }
            disabled={
              !hasNext
            }
            aria-label="Próxima página"
            className="flex size-10 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:bg-elevated hover:text-fg disabled:pointer-events-none disabled:opacity-35"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
      )}

      {total > 0 && (
        <p className="text-center text-xs text-subtle">
          Página {page} de{" "}
          {lastPage} · {total}{" "}
          animes
        </p>
      )}
    </div>
  );
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
