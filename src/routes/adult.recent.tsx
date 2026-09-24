import {
  createFileRoute,
  Link,
  type ErrorComponentProps,
} from "@tanstack/react-router";

import { fetchAdultCatalog } from "@/lib/api";
import { overlayList } from "@/lib/overlay";
import { useHikariStore } from "@/lib/store";

import {
  AnimeCard,
  AnimeCardSkeleton,
} from "@/components/anime-card";

export const Route = createFileRoute("/adult/recent")({
  validateSearch: (search: Record<string, unknown>) => ({
    page: Math.max(1, Number(search.page) || 1),
  }),

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
        {Array.from({ length: 12 }, (_, i) => (
          <AnimeCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

function AdultRecentError({ error }: ErrorComponentProps) {
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

function AdultRecentPage() {
  const data = Route.useLoaderData();

  const { page: requestedPage } = Route.useSearch();

  const navigate = Route.useNavigate();

  const locals = useHikariStore((s) => s.animes);

  const items = overlayList(
    data.recentItems ?? [],
    locals,
  );

  const itemsPerPage = 6;

  const totalPages = Math.max(
    1,
    Math.ceil(items.length / itemsPerPage),
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

  function goToPage(page: number) {
    const nextPage = Math.min(
      Math.max(1, page),
      totalPages,
    );

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
        {/* Botão Voltar no mesmo padrão da página Calendário */}
        <div className="mb-6">
          <Link
            to="/adult"
            className="inline-flex items-center rounded-full border border-border px-3 py-1.5 text-sm font-medium text-muted transition hover:bg-elevated hover:text-fg"
          >
            ‹ Voltar
          </Link>
        </div>

        <div>
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
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              {Array.from(
                { length: totalPages },
                (_, index) => {
                  const page = index + 1;

                  const isActive =
                    currentPage === page;

                  return (
                    <button
                      key={page}
                      type="button"
                      onClick={() => goToPage(page)}
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
