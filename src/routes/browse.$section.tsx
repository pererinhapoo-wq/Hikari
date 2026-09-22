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

import { fetchBrowse } from "@/lib/api";
import { overlayList } from "@/lib/overlay";
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
  page?: number;
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

export const Route = createFileRoute(
  "/browse/$section",
)({
  validateSearch: (
    raw: Record<string, unknown>,
  ): BrowseSearch => {
    return {
      page: normalizePage(
        raw.page,
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
    const section = [
      "popular",
      "season",
      "top",
      "trending",
    ].includes(params.section)
      ? params.section
      : "popular";

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
        },
      });

    return {
      result,
      section,
      page,
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
    page,
  } =
    Route.useLoaderData();

  const locals =
    useHikariStore(
      (s) => s.animes,
    );

  const items =
    overlayList(
      result.items,
      locals,
    );

  const current =
    getCurrentSeason();

  const currentSeason =
    SEASONS.find(
      (item) =>
        item.value ===
        current.season,
    );

  const title =
    currentSeason?.label ??
    "Temporada";

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
      nextPage > page + 1 &&
      !result.hasNext
    ) {
      return;
    }

    void navigate({
      to: "/browse/$section",
      params: {
        section,
      },
      search: {
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

      if (result.hasNext) {
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
      result.hasNext,
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
          value={String(
            current.year,
          )}
          onChange={() => {
            // O filtro de ano será ligado
            // à API na próxima etapa.
          }}
          aria-label="Selecionar ano"
        >
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
                className={cnCalendarSeason(
                  item.value ===
                    current.season,
                )}
                onClick={() => {
                  // A troca real da temporada
                  // será ligada à API na próxima etapa.
                }}
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
          {title}{" "}
          {current.year}
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
              />
            ),
          )}
        </div>
      )}

      {/* PAGINAÇÃO — NÃO ALTERADA */}
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
              !result.hasNext
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
