import {
  createFileRoute,
  Link,
  useNavigate,
} from "@tanstack/react-router";

import {
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

const TITLES: Record<string, string> = {
  popular: "Populares",
  season: "Temporada atual",
  top: "Mais bem avaliados",
  trending: "Em alta",
};

type BrowseSection =
  | "popular"
  | "season"
  | "top"
  | "trending";

type BrowseSearch = {
  page?: number;
};

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
      ? (params.section as BrowseSection)
      : "popular";

    const page =
      normalizePage(
        deps.page,
      );

    const result =
      await fetchBrowse({
        data: {
          section,
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

  const title =
    TITLES[section] ??
    "Catálogo";

  const hasNext =
    Boolean(
      result.hasNext,
    );

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
      !hasNext
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

      if (hasNext) {
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
    hasNext;

  return (
    <div className="space-y-6 pt-6">
      <header>
        <p className="text-[11px] tracking-[0.28em] text-muted uppercase">
          Explorar
        </p>

        <h1 className="font-display text-3xl tracking-tight">
          {title}
        </h1>
      </header>

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
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {items.map(
              (a) => (
                <AnimeCard
                  key={a.id}
                  anime={a}
                />
              ),
            )}
          </div>

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
                  !hasNext
                }
                aria-label="Próxima página"
                className="flex size-10 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:bg-elevated hover:text-fg disabled:pointer-events-none disabled:opacity-35"
              >
                <ChevronRight className="size-5" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
      }
