import {
  createFileRoute,
  Link,
  type ErrorComponentProps,
  useNavigate,
} from "@tanstack/react-router";

import { fetchAdultCatalog } from "@/lib/api";
import { overlayList } from "@/lib/overlay";
import { useHikariStore } from "@/lib/store";

import {
  AnimeCard,
  AnimeCardSkeleton,
} from "@/components/anime-card";

export const Route = createFileRoute("/adult/recent")({
  validateSearch: (search: Record<string, unknown>) => {
    const page = Number(search.page);

    return {
      page:
        Number.isFinite(page) && page >= 1
          ? Math.floor(page)
          : 1,
    };
  },

  loader: () => fetchAdultCatalog(),

  pendingComponent: AdultRecentPending,
  errorComponent: AdultRecentError,
  component: AdultRecentPage,
});

function AdultRecentPending() {
  return (
    <div className="space-y-5 pb-5 sm:space-y-8">
      <div>
        <div className="h-8 w-52 animate-pulse rounded bg-elevated" />
        <div className="mt-2 h-4 w-72 animate-pulse rounded bg-elevated" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {Array.from({ length: 8 }, (_, i) => (
          <AnimeCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

function AdultRecentError({
  error,
}: ErrorComponentProps) {
  const message =
    error instanceof Error && error.message
      ? error.message
      : typeof error === "string"
        ? error
        : "Tente recarregar.";

  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <p className="font-display text-2xl">
        Novos episódios indisponíveis
      </p>

      <p className="mt-2 text-sm text-muted">
        {message}
      </p>

      <Link
        to="/adult"
        className="mt-6 inline-flex rounded-lg bg-elevated px-4 py-2 text-sm text-fg transition hover:bg-surface"
      >
        Voltar
      </Link>
    </div>
  );
}

function getPaginationPages(
  currentPage: number,
  totalPages: number,
) {
  if (totalPages <= 9) {
    return Array.from(
      { length: totalPages },
      (_, index) => index + 1,
    );
  }

  const pages: Array<number | "..."> = [];

  pages.push(1);

  if (currentPage <= 5) {
    pages.push(
      2,
      3,
      4,
      5,
      6,
      7,
      "...",
    );

    pages.push(totalPages);

    return pages;
  }

  if (currentPage >= totalPages - 4) {
    pages.push("...");

    for (
      let page = totalPages - 6;
      page <= totalPages;
      page++
    ) {
      pages.push(page);
    }

    return pages;
  }

  pages.push("...");

  pages.push(
    currentPage - 2,
    currentPage - 1,
    currentPage,
    currentPage + 1,
    currentPage + 2,
  );

  pages.push("...");
  pages.push(totalPages);

  return pages;
}

function AdultRecentPage() {
  const data = Route.useLoaderData();

  const navigate = useNavigate({
    from: "/adult/recent",
  });

  const { page: requestedPage } = Route.useSearch();

  const locals = useHikariStore(
    (s) => s.animes,
  );

  const items = overlayList(
    data.recentItems ?? [],
    locals,
  );

  const itemsPerPage = 8;

  const totalPages = Math.max(
    1,
    Math.ceil(
      items.length / itemsPerPage,
    ),
  );

  const currentPage = Math.min(
    requestedPage,
    totalPages,
  );

  const startIndex =
    (currentPage - 1) * itemsPerPage;

  const paginatedItems = items.slice(
    startIndex,
    startIndex + itemsPerPage,
  );

  const paginationPages = getPaginationPages(
    currentPage,
    totalPages,
  );

  const changePage = (page: number) => {
    if (
      page < 1 ||
      page > totalPages
    ) {
      return;
    }

    navigate({
      search: {
        page,
      },
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  function goBack() {
    window.history.back();
  }

  return (
    <div className="space-y-5 pb-5 sm:space-y-8">
      <section>
        <button
          type="button"
          onClick={goBack}
          className="mt-2 inline-flex items-center rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted transition hover:bg-elevated hover:text-fg"
        >
          ‹ Voltar
        </button>

        <div className="mt-12">
          <h1 className="font-display text-2xl tracking-tight sm:text-3xl">
            Novos episódios
          </h1>

          <p className="mt-1 text-sm text-muted">
            Confira os episódios mais recentes.
          </p>
        </div>
      </section>

      {items.length === 0 ? (
        <div className="rounded-xl bg-surface p-8 text-center shadow-[var(--shadow-border)]">
          <p className="font-display text-xl">
            Nenhum episódio encontrado
          </p>

          <p className="mt-2 text-sm text-muted">
            Não há novos episódios disponíveis no momento.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {paginatedItems.map((anime) => (
              <AnimeCard
                key={anime.id}
                anime={anime}
                size="lg"
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-center gap-1.5 pt-2">
              {paginationPages.map(
                (page, index) => {
                  if (page === "...") {
                    return (
                      <span
                        key={`dots-${index}`}
                        className="inline-flex size-9 items-center justify-center text-sm text-muted"
                      >
                        …
                      </span>
                    );
                  }

                  const isActive =
                    currentPage === page;

                  return (
                    <button
                      key={page}
                      type="button"
                      onClick={() =>
                        changePage(page)
                      }
                      aria-current={
                        isActive
                          ? "page"
                          : undefined
                      }
                      className={`inline-flex size-9 items-center justify-center rounded-lg text-sm font-medium transition ${
                        isActive
                          ? "bg-elevated text-fg"
                          : "text-muted hover:bg-elevated hover:text-fg"
                      }`}
                    >
                      {page}
                    </button>
                  );
                },
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
  }
