import {
  createFileRoute,
  Link,
} from "@tanstack/react-router";

import {
  CalendarDays,
  ChevronDown,
} from "lucide-react";

import { AnimeCard } from "@/components/anime-card";
import type { SlimAnime } from "@/lib/types";

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

const FIRST_YEAR = 2000;
const LAST_YEAR = 2028;

const ITEMS_PER_PAGE = 24;

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
): Promise<SlimAnime[]> {
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
              $year: Int
            ) {
              Page(
                page: 1,
                perPage: 50
              ) {
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

  return (
    json.data?.Page?.media ??
    []
  )
    .filter(
      (anime) =>
        !anime.isAdult,
    )
    .map(mapAnime);
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

      const rawSeason =
        raw.season;

      const rawYear =
        raw.year;

      const rawPage =
        raw.page;

      const validSeason =
        rawSeason === "WINTER" ||
        rawSeason === "SPRING" ||
        rawSeason === "SUMMER" ||
        rawSeason === "FALL";

      const parsedYear =
        typeof rawYear === "number"
          ? rawYear
          : typeof rawYear === "string"
            ? Number(rawYear)
            : NaN;

      const parsedPage =
        typeof rawPage === "number"
          ? rawPage
          : typeof rawPage === "string"
            ? Number(rawPage)
            : NaN;

      return {
        season: validSeason
          ? rawSeason
          : current.season,

        year:
          Number.isInteger(
            parsedYear,
          ) &&
          parsedYear >= FIRST_YEAR &&
          parsedYear <= LAST_YEAR
            ? parsedYear
            : current.year,

        page:
          Number.isInteger(
            parsedPage,
          ) &&
          parsedPage >= 1
            ? parsedPage
            : 1,
      };
    },

    loader: async ({
      location,
    }) => {
      const current =
        getCurrentSeason();

      const rawSeason =
        location.search
          .season;

      const rawYear =
        location.search
          .year;

      const rawPage =
        location.search
          .page;

      const season =
        rawSeason === "WINTER" ||
        rawSeason === "SPRING" ||
        rawSeason === "SUMMER" ||
        rawSeason === "FALL"
          ? rawSeason
          : current.season;

      const parsedYear =
        Number(rawYear);

      const year =
        Number.isInteger(
          parsedYear,
        ) &&
        parsedYear >= FIRST_YEAR &&
        parsedYear <= LAST_YEAR
          ? parsedYear
          : current.year;

      const parsedPage =
        Number(rawPage);

      const page =
        Number.isInteger(
          parsedPage,
        ) &&
        parsedPage >= 1
          ? parsedPage
          : 1;

      const items =
        await fetchSeason(
          season,
          year,
        );

      return {
        items,
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
    <div className="space-y-6 py-5 sm:space-y-8 sm:py-8">
      <div className="space-y-2">
        <div className="h-8 w-64 animate-pulse rounded bg-elevated" />

        <div className="h-4 w-80 animate-pulse rounded bg-elevated" />
      </div>

      <div className="h-12 animate-pulse rounded-xl bg-elevated" />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {Array.from(
          { length: 4 },
          (_, index) => (
            <div
              key={index}
              className="h-12 animate-pulse rounded-xl bg-elevated"
            />
          ),
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {Array.from(
          { length: 12 },
          (_, index) => (
            <div
              key={index}
              className="overflow-hidden rounded-xl"
            >
              <div className="aspect-2/3 animate-pulse bg-elevated" />

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
  const {
    items,
    season,
    year,
    page,
  } =
    Route.useLoaderData();

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        items.length /
          ITEMS_PER_PAGE,
      ),
    );

  const safePage =
    Math.min(
      Math.max(page, 1),
      totalPages,
    );

  const startIndex =
    (safePage - 1) *
    ITEMS_PER_PAGE;

  const visibleItems =
    items.slice(
      startIndex,
      startIndex +
        ITEMS_PER_PAGE,
    );

  const currentSeason =
    SEASONS.find(
      (item) =>
        item.value === season,
    );

  const years =
    Array.from(
      {
        length:
          LAST_YEAR -
          FIRST_YEAR +
          1,
      },
      (_, index) =>
        FIRST_YEAR + index,
    );

  return (
    <div className="space-y-6 py-5 sm:space-y-8 sm:py-8">

      {/* =====================================================
          CABEÇALHO
      ====================================================== */}

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

      {/* =====================================================
          SELETOR DE ANO
      ====================================================== */}

      <section className="space-y-3">
        <p className="text-xs font-semibold tracking-[0.16em] text-subtle uppercase">
          Ano
        </p>

        <div className="relative">
          <select
            value={year}
            onChange={() => {}}
            className="pointer-events-none absolute inset-0 size-full opacity-0"
            aria-hidden="true"
            tabIndex={-1}
          />

          <details className="group">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between rounded-xl border border-border px-4 text-base font-medium text-fg transition-colors hover:bg-elevated sm:min-h-14 sm:px-5 sm:text-lg">
              <span>{year}</span>

              <ChevronDown className="size-5 text-muted transition-transform group-open:rotate-180" />
            </summary>

            <div className="absolute z-30 mt-2 max-h-80 w-full overflow-y-auto rounded-xl border border-border bg-elevated shadow-2xl">
              {years.map(
                (yearOption) => (
                  <Link
                    key={yearOption}
                    to="/calendar"
                    search={{
                      season,
                      year:
                        yearOption,
                      page: 1,
                    }}
                    className={[
                      "flex min-h-12 items-center justify-between border-b border-border px-4 text-base transition-colors last:border-b-0 sm:min-h-14 sm:px-5 sm:text-lg",
                      yearOption === year
                        ? "bg-bg text-fg"
                        : "text-muted hover:bg-bg hover:text-fg",
                    ].join(" ")}
                  >
                    <span>
                      {yearOption}
                    </span>

                    {yearOption ===
                      year && (
                      <span className="size-2.5 rounded-full bg-fg" />
                    )}
                  </Link>
                ),
              )}
            </div>
          </details>
        </div>
      </section>

      {/* =====================================================
          TEMPORADAS
      ====================================================== */}

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

      {/* =====================================================
          TÍTULO
      ====================================================== */}

      <section className="border-b border-border pb-4">
        <h2 className="font-display text-xl tracking-tight sm:text-2xl">
          Animes da temporada de{" "}
          {currentSeason?.label ??
            "Anime"}{" "}
          {year}
        </h2>

        <p className="mt-1 text-sm text-muted">
          Confira a lista dos animes
          programados para esta temporada.
        </p>
      </section>

      {/* =====================================================
          LISTA DE ANIMES
      ====================================================== */}

      {visibleItems.length > 0 ? (
        <section className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {visibleItems.map(
            (anime) => (
              <AnimeCard
                key={anime.id}
                anime={anime}
              />
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

      {/* =====================================================
          PAGINAÇÃO
      ====================================================== */}

      {totalPages > 1 && (
        <nav
          className="flex flex-wrap items-center justify-center gap-2 pt-2"
          aria-label="Paginação do calendário"
        >
          {Array.from(
            {
              length: totalPages,
            },
            (_, index) =>
              index + 1,
          ).map(
            (pageNumber) => (
              <Link
                key={pageNumber}
                to="/calendar"
                search={{
                  season,
                  year,
                  page:
                    pageNumber,
                }}
                className={[
                  "flex size-10 items-center justify-center rounded-lg border text-sm font-medium transition-colors",
                  pageNumber ===
                  safePage
                    ? "border-fg/20 bg-elevated text-fg"
                    : "border-border text-muted hover:bg-elevated hover:text-fg",
                ].join(" ")}
              >
                {pageNumber}
              </Link>
            ),
          )}
        </nav>
      )}

      <div className="h-2" />
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
    "rounded-xl",
    "border",
    "px-4",
    "text-sm",
    "font-medium",
    "transition-colors",
    "sm:min-h-14",
    "sm:text-base",
    active
      ? "border-fg/20 bg-elevated text-fg"
      : "border-border text-muted hover:bg-elevated hover:text-fg",
  ].join(" ");
      }
