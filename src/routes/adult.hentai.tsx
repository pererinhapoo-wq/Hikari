import {
  createFileRoute,
  Link,
  useNavigate,
  type ErrorComponentProps,
} from "@tanstack/react-router";

import { fetchAdultCatalog } from "@/lib/api";
import { overlayList } from "@/lib/overlay";
import { useHikariStore } from "@/lib/store";

import {
  AnimeCard,
  AnimeCardSkeleton,
} from "@/components/anime-card";

export const Route = createFileRoute("/adult/hentai")({
  validateSearch: (search: Record<string, unknown>) => {
    const page = Number(search.page);

    return {
      page:
        Number.isInteger(page) && page > 0
          ? page
          : 1,
    };
  },

  loader: () => fetchAdultCatalog(),

  pendingComponent: HentaiPending,

  errorComponent: HentaiError,

  component: HentaiPage,
});

function HentaiPending() {
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

function HentaiError({
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
        Hentai indisponível
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

/**
 * Cria uma paginação compacta.
 *
 * Exemplos:
 *
 * Página 1:
 * 1 2 3 4 5 6 7 … 63
 *
 * Página 4:
 * 1 2 3 4 5 6 7 … 63
 *
 * Página 30:
 * 1 … 27 28 29 30 31 32 33 … 63
 *
 * Página 63:
 * 1 … 57 58 59 60 61 62 63
 */
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

  // Começo
  if (currentPage <= 5) {
    pages.push(
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      "...",
      totalPages,
    );

    return pages;
  }

  // Final
  if (currentPage >= totalPages - 4) {
    pages.push(1, "...");

    for (
      let page = totalPages - 6;
      page <= totalPages;
      page++
    ) {
      pages.push(page);
    }

    return pages;
  }

  // Meio
  pages.push(
    1,
    "...",
    currentPage - 2,
    currentPage - 1,
    currentPage,
    currentPage + 1,
    currentPage + 2,
    "...",
    totalPages,
  );

  return pages;
}

function HentaiPage() {
  const data = Route.useLoaderData();

  const { page: requestedPage } =
    Route.useSearch();

  const navigate = useNavigate({
    from: "/adult/hentai",
  });

  const locals = useHikariStore(
    (s) => s.animes,
  );

  const items = overlayList(
    data.items ?? [],
    locals,
  );

  // Sempre 8 Hentai por página.
  const itemsPerPage = 8;

  const totalPages = Math.max(
    1,
    Math.ceil(
      items.length / itemsPerPage,
    ),
  );

  // Impede uma página inválida de quebrar a lista.
  const currentPage = Math.min(
    Math.max(requestedPage, 1),
    totalPages,
  );

  const startIndex =
    (currentPage - 1) * itemsPerPage;

  const paginatedItems = items.slice(
    startIndex,
    startIndex + itemsPerPage,
  );

  const paginationPages =
    getPaginationPages(
      currentPage,
      totalPages,
    );

  function changePage(nextPage: number) {
    if (
      nextPage < 1 ||
      nextPage > totalPages ||
      nextPage === currentPage
    ) {
      return;
    }

    navigate({
      search: {
        page: nextPage,
      },
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  return (
    <div className="space-y-5 pb-5 sm:space-y-8">
      <section>
        <Link
          to="/adult"
          className="mt-2 inline-flex items-center rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted transition hover:bg-elevated hover:text-fg"
        >
          ‹ Voltar
        </Link>

        <div className="mt-12">
          <h1 className="font-display text-2xl tracking-tight sm:text-3xl">
            Hentai
          </h1>

          <p className="mt-1 text-sm text-muted">
            Confira todos os títulos disponíveis.
          </p>
        </div>
      </section>

      {items.length === 0 ? (
        <div className="rounded-xl bg-surface p-8 text-center shadow-[var(--shadow-border)]">
          <p className="font-display text-xl">
            Nenhum título encontrado
          </p>

          <p className="mt-2 text-sm text-muted">
            Não há títulos disponíveis no momento.
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
