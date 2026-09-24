import {
  createFileRoute,
  Link,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useState } from "react";

import { fetchAdultCatalog } from "@/lib/api";
import { overlayList } from "@/lib/overlay";
import { useHikariStore } from "@/lib/store";

import {
  AnimeCard,
  AnimeCardSkeleton,
} from "@/components/anime-card";

export const Route = createFileRoute("/adult/recent")({
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

  const locals = useHikariStore((s) => s.animes);

  const items = overlayList(
    data.recentItems ?? [],
    locals,
  );

  const [currentPage, setCurrentPage] = useState(1);

  const itemsPerPage = 6;

  const totalPages = Math.max(
    1,
    Math.ceil(items.length / itemsPerPage),
  );

  const startIndex =
    (currentPage - 1) * itemsPerPage;

  const paginatedItems = items.slice(
    startIndex,
    startIndex + itemsPerPage,
  );

  return (
    <div className="space-y-5 pb-5 sm:space-y-8">
      <section>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl tracking-tight sm:text-3xl">
              Novos episódios
            </h1>

            <p className="mt-1 text-sm text-muted">
              Confira os episódios mais recentes.
            </p>
          </div>

          <Link
            to="/adult"
            className="
              mt-1
              shrink-0
              rounded-md
              px-2
              py-1
              text-sm
              font-semibold
              text-muted
              transition
              hover:bg-elevated
              hover:text-fg
            "
          >
            Voltar
          </Link>
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
                      onClick={() =>
                        setCurrentPage(page)
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
