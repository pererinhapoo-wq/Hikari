import {
  createFileRoute,
  Link,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { fetchAdultCatalog } from "@/lib/api";
import { overlayList } from "@/lib/overlay";
import { useHikariStore } from "@/lib/store";

import {
  AnimeCard,
  AnimeCardSkeleton,
} from "@/components/anime-card";

export const Route = createFileRoute("/adult/hentai")({
  loader: () => fetchAdultCatalog(),
  pendingComponent: AdultHentaiPending,
  errorComponent: AdultHentaiError,
  component: AdultHentaiPage,
});

function AdultHentaiPending() {
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

function AdultHentaiError({
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

function AdultHentaiPage() {
  const data = Route.useLoaderData();

  const locals = useHikariStore((s) => s.animes);

  const items = overlayList(
    data.items ?? [],
    locals,
  );

  /*
   * A página fica salva na URL:
   *
   * /adult/hentai?page=1
   * /adult/hentai?page=2
   * /adult/hentai?page=3
   *
   * Assim, ao recarregar, continuamos na mesma página.
   */
  const getPageFromUrl = () => {
    if (typeof window === "undefined") {
      return 1;
    }

    const value = Number(
      new URLSearchParams(window.location.search).get("page"),
    );

    return Number.isInteger(value) && value > 0
      ? value
      : 1;
  };

  const [currentPage, setCurrentPage] = useState(
    getPageFromUrl,
  );

  // 3 títulos por página para criar mais páginas.
  const itemsPerPage = 3;

  const totalPages = Math.max(
    1,
    Math.ceil(items.length / itemsPerPage),
  );

  /*
   * Garante que uma página inválida não fique selecionada
   * caso a quantidade de títulos diminua.
   */
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  /*
   * Salva a página atual na URL sem recarregar a página.
   */
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const url = new URL(window.location.href);

    if (currentPage === 1) {
      url.searchParams.delete("page");
    } else {
      url.searchParams.set(
        "page",
        String(currentPage),
      );
    }

    window.history.replaceState(
      null,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  }, [currentPage]);

  const startIndex =
    (currentPage - 1) * itemsPerPage;

  const paginatedItems = items.slice(
    startIndex,
    startIndex + itemsPerPage,
  );

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
