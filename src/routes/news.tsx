import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Newspaper,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  fetchAutomaticNews,
  type AutomaticNewsItem,
} from "@/lib/news-api";

export const Route = createFileRoute("/news")({
  loader: async () => {
    return await fetchAutomaticNews();
  },

  component: NewsPage,
});

const NEWS_PER_PAGE = 4;

function NewsPage() {
  const loaderNews =
    Route.useLoaderData() as AutomaticNewsItem[];

  const [currentPage, setCurrentPage] =
    useState(1);

  const news = loaderNews ?? [];

  const totalPages = Math.max(
    1,
    Math.ceil(
      news.length / NEWS_PER_PAGE,
    ),
  );

  useEffect(() => {
    if (
      currentPage >
      totalPages
    ) {
      setCurrentPage(totalPages);
    }
  }, [
    currentPage,
    totalPages,
  ]);

  const visibleNews =
    useMemo(() => {
      const start =
        (currentPage - 1) *
        NEWS_PER_PAGE;

      return news.slice(
        start,
        start + NEWS_PER_PAGE,
      );
    }, [
      news,
      currentPage,
    ]);

  const goToPage = (
    page: number,
  ) => {
    const nextPage = Math.min(
      Math.max(page, 1),
      totalPages,
    );

    setCurrentPage(nextPage);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <main className="min-h-screen bg-background text-fg">
      <div className="mx-auto w-full max-w-7xl px-4 pb-16 pt-4 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="
            mb-7
            inline-flex
            w-fit
            items-center
            gap-2
            rounded-lg
            px-2
            py-2
            text-sm
            font-medium
            text-muted
            transition-all
            duration-200
            hover:bg-elevated
            hover:text-fg
            active:scale-[0.97]
          "
        >
          <ArrowLeft className="size-4 shrink-0" />
          <span>Voltar</span>
        </Link>

        <section className="mb-7">
          <div className="flex items-center gap-3">
            <div
              className="
                flex
                size-10
                shrink-0
                items-center
                justify-center
                rounded-full
                bg-elevated
                text-fg
              "
            >
              <Newspaper className="size-5" />
            </div>

            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Notícias
              </h1>

              <p className="mt-1 text-sm text-muted">
                Fique por dentro das novidades do mundo dos animes.
              </p>
            </div>
          </div>
        </section>

        {visibleNews.length > 0 ? (
          <>
            <section
              className="
                grid
                grid-cols-1
                gap-4
                sm:grid-cols-2
              "
            >
              {visibleNews.map(
                (item) => (
                  <Link
                    key={item.id}
                    to="/news/$id"
                    params={{
                      id: item.id,
                    }}
                    className="
                      group
                      overflow-hidden
                      rounded-3xl
                      border
                      border-border
                      bg-card
                      transition-all
                      duration-200
                      hover:-translate-y-0.5
                      hover:border-border/80
                      hover:bg-elevated
                    "
                  >
                    <div
                      className="
                        relative
                        aspect-[16/9]
                        overflow-hidden
                        bg-elevated
                      "
                    >
                      <img
                        src={item.image}
                        alt={item.title}
                        className="
                          h-full
                          w-full
                          object-cover
                          transition-transform
                          duration-300
                          group-hover:scale-[1.02]
                        "
                        loading="lazy"
                      />

                      <div
                        className="
                          absolute
                          inset-x-0
                          bottom-0
                          h-1/2
                          bg-gradient-to-t
                          from-black/80
                          via-black/20
                          to-transparent
                        "
                      />

                      <span
                        className="
                          absolute
                          bottom-3
                          left-3
                          rounded-md
                          bg-black/70
                          px-2
                          py-1
                          text-[10px]
                          font-semibold
                          uppercase
                          tracking-wide
                          text-white
                        "
                      >
                        {item.type}
                      </span>
                    </div>

                    <div className="p-4">
                      <h2
                        className="
                          line-clamp-2
                          text-base
                          font-semibold
                          leading-snug
                          text-fg
                        "
                      >
                        {item.title}
                      </h2>

                      <p
                        className="
                          mt-2
                          line-clamp-3
                          text-sm
                          leading-relaxed
                          text-muted
                        "
                      >
                        {item.description}
                      </p>

                      <div
                        className="
                          mt-4
                          flex
                          items-center
                          gap-2
                          text-xs
                          text-muted
                        "
                      >
                        <CalendarDays className="size-3.5 shrink-0" />

                        <span>
                          {item.date}
                        </span>
                      </div>
                    </div>
                  </Link>
                ),
              )}
            </section>

            {totalPages > 1 && (
              <nav
                className="
                  mt-8
                  flex
                  flex-col
                  items-center
                  gap-3
                "
                aria-label="Paginação das notícias"
              >
                <div
                  className="
                    flex
                    max-w-full
                    items-center
                    gap-1.5
                    overflow-x-auto
                    px-1
                    pb-1
                  "
                >
                  <button
                    type="button"
                    onClick={() =>
                      goToPage(
                        currentPage - 1,
                      )
                    }
                    disabled={
                      currentPage === 1
                    }
                    aria-label="Página anterior"
                    className="
                      flex
                      size-9
                      shrink-0
                      items-center
                      justify-center
                      rounded-full
                      border
                      border-border
                      bg-card
                      text-muted
                      transition
                      hover:bg-elevated
                      hover:text-fg
                      disabled:cursor-not-allowed
                      disabled:opacity-30
                    "
                  >
                    <ChevronLeft className="size-4" />
                  </button>

                  {Array.from(
                    {
                      length:
                        totalPages,
                    },
                    (_, index) =>
                      index + 1,
                  ).map(
                    (page) => (
                      <button
                        key={page}
                        type="button"
                        onClick={() =>
                          goToPage(page)
                        }
                        aria-label={`Ir para a página ${page}`}
                        aria-current={
                          currentPage ===
                          page
                            ? "page"
                            : undefined
                        }
                        className={`
                          flex
                          size-9
                          shrink-0
                          items-center
                          justify-center
                          rounded-full
                          border
                          text-xs
                          font-medium
                          transition
                          ${
                            currentPage ===
                            page
                              ? "border-fg bg-fg text-background"
                              : "border-border bg-card text-muted hover:bg-elevated hover:text-fg"
                          }
                        `}
                      >
                        {page}
                      </button>
                    ),
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      goToPage(
                        currentPage + 1,
                      )
                    }
                    disabled={
                      currentPage ===
                      totalPages
                    }
                    aria-label="Próxima página"
                    className="
                      flex
                      size-9
                      shrink-0
                      items-center
                      justify-center
                      rounded-full
                      border
                      border-border
                      bg-card
                      text-muted
                      transition
                      hover:bg-elevated
                      hover:text-fg
                      disabled:cursor-not-allowed
                      disabled:opacity-30
                    "
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>

                <p className="text-xs text-muted">
                  Página{" "}
                  {currentPage} de{" "}
                  {totalPages}
                </p>
              </nav>
            )}
          </>
        ) : (
          <section
            className="
              flex
              min-h-[160px]
              items-center
              justify-center
              rounded-3xl
              border
              border-border
              bg-card
              px-6
              text-center
            "
          >
            <p className="text-sm text-muted">
              Nenhuma notícia disponível no momento.
            </p>
          </section>
        )}
      </div>
    </main>
  );
              }
