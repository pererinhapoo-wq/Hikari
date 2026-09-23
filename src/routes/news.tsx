import {
  createFileRoute,
  Link,
  useNavigate,
} from "@tanstack/react-router";

import {
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Newspaper,
  Search,
  X,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  fetchAutomaticNews,
  type AutomaticNewsItem,
} from "@/lib/news-api";

export const Route = createFileRoute("/news")({
  validateSearch: (search) => ({
    page: Math.max(
      1,
      Number(search.page) || 1,
    ),
  }),

  loader: async () => {
    return await fetchAutomaticNews();
  },

  component: NewsPage,
});

const NEWS_PER_PAGE = 4;

function parseNewsDate(date: string) {
  if (!date) {
    return 0;
  }

  const normalized = date
    .trim()
    .toLowerCase();

  const numericMatch =
    normalized.match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    );

  if (numericMatch) {
    const [, day, month, year] =
      numericMatch;

    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
    ).getTime();
  }

  const monthNames: Record<
    string,
    number
  > = {
    janeiro: 0,
    fevereiro: 1,
    março: 2,
    abril: 3,
    maio: 4,
    junho: 5,
    julho: 6,
    agosto: 7,
    setembro: 8,
    outubro: 9,
    novembro: 10,
    dezembro: 11,
  };

  const textMatch =
    normalized.match(
      /^(\d{1,2})\s+de\s+([a-zç]+)\s+de\s+(\d{4})$/,
    );

  if (textMatch) {
    const [, day, monthName, year] =
      textMatch;

    const month =
      monthNames[monthName];

    if (month !== undefined) {
      return new Date(
        Number(year),
        month,
        Number(day),
      ).getTime();
    }
  }

  const parsed =
    Date.parse(date);

  if (!Number.isNaN(parsed)) {
    return parsed;
  }

  return 0;
}

function normalizeSearchText(
  value: string,
) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .trim();
}

function NewsPage() {
  const loaderNews =
    Route.useLoaderData() as AutomaticNewsItem[];

  const navigate =
    useNavigate({
      from: "/news",
    });

  const { page: urlPage } =
    Route.useSearch();

  const [currentPage, setCurrentPage] =
    useState(urlPage);

  const [searchOpen, setSearchOpen] =
    useState(false);

  const [searchQuery, setSearchQuery] =
    useState("");

  const searchInputRef =
    useRef<HTMLInputElement>(null);

  const news = useMemo(() => {
    return [
      ...(loaderNews ?? []),
    ].sort(
      (a, b) =>
        parseNewsDate(b.date) -
        parseNewsDate(a.date),
    );
  }, [loaderNews]);

  const filteredNews =
    useMemo(() => {
      const query =
        normalizeSearchText(
          searchQuery,
        );

      if (!query) {
        return news;
      }

      return news.filter(
        (item) => {
          const searchableText =
            normalizeSearchText(
              [
                item.title,
                item.description,
                item.type,
                item.date,
              ].join(" "),
            );

          return searchableText.includes(
            query,
          );
        },
      );
    }, [
      news,
      searchQuery,
    ]);

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredNews.length /
        NEWS_PER_PAGE,
    ),
  );

  useEffect(() => {
    if (
      currentPage !== urlPage
    ) {
      setCurrentPage(urlPage);
    }
  }, [
    urlPage,
    currentPage,
  ]);

  useEffect(() => {
    if (
      currentPage >
      totalPages
    ) {
      setCurrentPage(totalPages);

      navigate({
        search: {
          page: totalPages,
        },
      });
    }
  }, [
    currentPage,
    totalPages,
    navigate,
  ]);

  useEffect(() => {
    if (searchOpen) {
      requestAnimationFrame(() => {
        searchInputRef.current?.focus();
      });
    }
  }, [searchOpen]);

  const visibleNews =
    useMemo(() => {
      const start =
        (currentPage - 1) *
        NEWS_PER_PAGE;

      return filteredNews.slice(
        start,
        start + NEWS_PER_PAGE,
      );
    }, [
      filteredNews,
      currentPage,
    ]);

  const goToPage = (
    page: number,
  ) => {
    const nextPage =
      Math.min(
        Math.max(page, 1),
        totalPages,
      );

    setCurrentPage(
      nextPage,
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
  };

  const handleSearchChange = (
    value: string,
  ) => {
    setSearchQuery(value);

    if (currentPage !== 1) {
      setCurrentPage(1);

      navigate({
        search: {
          page: 1,
        },
      });
    }
  };

  const handleSearchSubmit = (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    const value =
      searchQuery.trim();

    setSearchQuery(value);

    setCurrentPage(1);

    navigate({
      search: {
        page: 1,
      },
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const clearSearch = () => {
    setSearchQuery("");
    setCurrentPage(1);

    navigate({
      search: {
        page: 1,
      },
    });

    requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
  };

  return (
    <main className="min-h-screen bg-background text-fg">
      <div className="mx-auto w-full max-w-7xl px-4 pb-16 pt-4 sm:px-6 lg:px-8">

        {/* TOPO */}
        <div className="mb-7 flex items-center justify-between gap-3">
          <Link
            to="/"
            className="
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

            <span>
              Voltar
            </span>
          </Link>

          <button
            type="button"
            onClick={() => {
              setSearchOpen(
                (open) => !open,
              );
            }}
            aria-label={
              searchOpen
                ? "Fechar busca"
                : "Buscar notícias"
            }
            aria-expanded={
              searchOpen
            }
            className="
              inline-flex
              items-center
              gap-2
              rounded-lg
              px-3
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
            {searchOpen ? (
              <X className="size-4" />
            ) : (
              <Search className="size-4" />
            )}

            <span>
              {searchOpen
                ? "Fechar"
                : "Buscar"}
            </span>
          </button>
        </div>

        {/* BUSCA */}
        {searchOpen && (
          <form
            onSubmit={
              handleSearchSubmit
            }
            className="
              mb-6
              rounded-2xl
              border
              border-border
              bg-card
              p-3
              shadow-[var(--shadow-border)]
            "
          >
            <div
              className="
                flex
                items-center
                gap-2
                rounded-xl
                border
                border-border
                bg-elevated
                px-3
              "
            >
              <Search
                className="
                  size-5
                  shrink-0
                  text-muted
                "
              />

              <input
                ref={searchInputRef}
                type="search"
                value={searchQuery}
                onChange={(event) =>
                  handleSearchChange(
                    event.target.value,
                  )
                }
                placeholder="Buscar notícias..."
                aria-label="Buscar notícias"
                autoComplete="off"
                className="
                  min-w-0
                  flex-1
                  bg-transparent
                  py-3
                  text-sm
                  text-fg
                  outline-none
                  placeholder:text-muted
                "
              />

              {searchQuery && (
                <button
                  type="button"
                  onClick={
                    clearSearch
                  }
                  aria-label="Limpar busca"
                  className="
                    flex
                    size-8
                    shrink-0
                    items-center
                    justify-center
                    rounded-full
                    text-muted
                    transition
                    hover:bg-card
                    hover:text-fg
                  "
                >
                  <X className="size-4" />
                </button>
              )}

              <button
                type="submit"
                aria-label="Pesquisar"
                className="
                  flex
                  size-9
                  shrink-0
                  items-center
                  justify-center
                  rounded-lg
                  bg-accent
                  text-white
                  transition-all
                  hover:opacity-90
                  active:scale-[0.96]
                "
              >
                <Search className="size-4" />
              </button>
            </div>

            {searchQuery.trim() && (
              <p className="mt-2 px-1 text-xs text-muted">
                {filteredNews.length ===
                0
                  ? "Nenhuma notícia encontrada."
                  : `${filteredNews.length} ${
                      filteredNews.length ===
                      1
                        ? "notícia encontrada"
                        : "notícias encontradas"
                    }`}
              </p>
            )}
          </form>
        )}

        {/* CABEÇALHO */}
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
            {/* NOTÍCIAS */}
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
                    search={{
                      page: currentPage,
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
                        w-full
                        overflow-hidden
                        bg-black
                        sm:aspect-[16/9]
                      "
                    >
                      <img
                        src={
                          item.image
                        }
                        alt={
                          item.title
                        }
                        className="
                          absolute
                          inset-0
                          h-full
                          w-full
                          object-contain
                          object-center
                          transition-transform
                          duration-300
                          group-hover:scale-[1.01]
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
                        {
                          item.type
                        }
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
                        {
                          item.title
                        }
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
                        {
                          item.description
                        }
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
                          {
                            item.date
                          }
                        </span>
                      </div>
                    </div>
                  </Link>
                ),
              )}
            </section>

            {/* PAGINAÇÃO */}
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
                      currentPage ===
                      1
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
                          goToPage(
                            page,
                          )
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
                        {
                          page
                        }
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
                  {
                    currentPage
                  }{" "}
                  de{" "}
                  {
                    totalPages
                  }
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
            <div>
              <Search className="mx-auto size-8 text-muted" />

              <p className="mt-3 text-sm text-muted">
                {searchQuery.trim()
                  ? "Nenhuma notícia encontrada para essa busca."
                  : "Nenhuma notícia disponível no momento."}
              </p>
            </div>
          </section>
        )}
      </div>
    </main>
  );
    }
