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
  useState,
  type FormEvent,
} from "react";

import {
  fetchAutomaticNews,
  type AutomaticNewsItem,
} from "@/lib/news-api";

export const Route = createFileRoute(
  "/news",
)({
  validateSearch: (search) => ({
    q:
      typeof search.q === "string"
        ? search.q
        : "",

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

function parseNewsDate(
  date: string,
) {
  if (!date) {
    return 0;
  }

  const normalized =
    date.trim().toLowerCase();

  const numericMatch =
    normalized.match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    );

  if (numericMatch) {
    const [
      ,
      day,
      month,
      year,
    ] = numericMatch;

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
    const [
      ,
      day,
      monthName,
      year,
    ] = textMatch;

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
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .toLowerCase()
    .trim();
}

function NewsPage() {
  const navigate =
    useNavigate({
      from: "/news",
    });

  const loaderNews =
    Route.useLoaderData() as AutomaticNewsItem[];

  const search =
    Route.useSearch();

  const urlPage =
    Math.max(
      1,
      Number(search.page) || 1,
    );

  const urlQuery =
    typeof search.q === "string"
      ? search.q
      : "";

  const [
    currentPage,
    setCurrentPage,
  ] = useState(urlPage);

  /* =========================================================
     BUSCA
  ========================================================== */

  const [
    searchOpen,
    setSearchOpen,
  ] = useState(
    Boolean(
      urlQuery.trim(),
    ),
  );

  const [
    searchQuery,
    setSearchQuery,
  ] = useState(urlQuery);

  /* =========================================================
     TODAS AS NOTÍCIAS
  ========================================================== */

  const news = useMemo(() => {
    return [
      ...(loaderNews ?? []),
    ].sort(
      (a, b) =>
        parseNewsDate(
          b.date,
        ) -
        parseNewsDate(
          a.date,
        ),
    );
  }, [loaderNews]);

  /* =========================================================
     RESULTADOS DA BUSCA
  ========================================================== */

  const searchResults =
    useMemo(() => {
      const query =
        normalizeSearchText(
          urlQuery,
        );

      if (!query) {
        return [];
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
              ]
                .filter(Boolean)
                .join(" "),
            );

          return searchableText.includes(
            query,
          );
        },
      );
    }, [
      news,
      urlQuery,
    ]);

  /*
   * Resultados usados na caixa
   * de pesquisa enquanto o usuário digita.
   */
  const previewSearchResults =
    useMemo(() => {
      const query =
        normalizeSearchText(
          searchQuery,
        );

      if (!query) {
        return [];
      }

      return news
        .filter(
          (item) => {
            const searchableText =
              normalizeSearchText(
                [
                  item.title,
                  item.description,
                  item.type,
                  item.date,
                ]
                  .filter(Boolean)
                  .join(" "),
              );

            return searchableText.includes(
              query,
            );
          },
        )
        .slice(0, 5);
    }, [
      news,
      searchQuery,
    ]);

  /* =========================================================
     MODO NORMAL OU MODO PESQUISA
  ========================================================== */

  const isSearchMode =
    Boolean(
      urlQuery.trim(),
    );

  const displayedNews =
    isSearchMode
      ? searchResults
      : news;

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        displayedNews.length /
          NEWS_PER_PAGE,
      ),
    );

  /* =========================================================
     SINCRONIZAÇÃO
  ========================================================== */

  useEffect(() => {
    if (
      currentPage !==
      urlPage
    ) {
      setCurrentPage(
        urlPage,
      );
    }
  }, [
    currentPage,
    urlPage,
  ]);

  useEffect(() => {
    setSearchQuery(
      urlQuery,
    );

    if (
      urlQuery.trim()
    ) {
      setSearchOpen(
        true,
      );
    }
  }, [urlQuery]);

  useEffect(() => {
    if (
      urlPage >
      totalPages
    ) {
      setCurrentPage(
        totalPages,
      );

      void navigate({
        search: {
          q: urlQuery,
          page: totalPages,
        },
        resetScroll: false,
      });
    }
  }, [
    urlPage,
    totalPages,
    urlQuery,
    navigate,
  ]);

  /* =========================================================
     BUSCA
  ========================================================== */

  const handleSearchSubmit =
    (
      event: FormEvent<HTMLFormElement>,
    ) => {
      event.preventDefault();

      const query =
        searchQuery.trim();

      if (!query) {
        return;
      }

      setSearchOpen(
        true,
      );

      setCurrentPage(
        1,
      );

      void navigate({
        search: {
          q: query,
          page: 1,
        },
        resetScroll: false,
      });

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    };

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery("");

    void navigate({
      search: {
        q: "",
        page: 1,
      },
      resetScroll: false,
    });
  };

  /* =========================================================
     RESULTADOS VISÍVEIS
  ========================================================== */

  const visibleNews =
    useMemo(() => {
      const start =
        (currentPage - 1) *
        NEWS_PER_PAGE;

      return displayedNews.slice(
        start,
        start +
          NEWS_PER_PAGE,
      );
    }, [
      displayedNews,
      currentPage,
    ]);

  /* =========================================================
     PAGINAÇÃO
  ========================================================== */

  const goToPage = (
    page: number,
  ) => {
    const nextPage =
      Math.min(
        Math.max(
          page,
          1,
        ),
        totalPages,
      );

    setCurrentPage(
      nextPage,
    );

    void navigate({
      search: {
        q: urlQuery,
        page: nextPage,
      },
      resetScroll: false,
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  /* =========================================================
     VOLTAR
  ========================================================== */

  const handleBack = () => {
    if (isSearchMode) {
      closeSearch();
      return;
    }

    void navigate({
      to: "/",
    });
  };

  return (
    <main className="min-h-screen bg-background text-fg">
      <div
        className="
          mx-auto
          w-full
          max-w-7xl
          px-4
          pb-16
          pt-4
          sm:px-6
          lg:px-8
        "
      >

        {/* =====================================================
            TOPO
        ====================================================== */}

        <div
          className="
            mb-7
            flex
            items-center
            justify-between
            gap-3
          "
        >

          {/* VOLTAR */}

          <button
            type="button"
            onClick={
              handleBack
            }
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
          </button>

          {/* BUSCAR / FECHAR */}

          <button
            type="button"
            onClick={() => {
              if (
                searchOpen
              ) {
                closeSearch();
              } else {
                setSearchOpen(
                  true,
                );
              }
            }}
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
            aria-label={
              searchOpen
                ? "Fechar busca"
                : "Abrir busca"
            }
          >
            {searchOpen ? (
              <>
                <X className="size-4 shrink-0" />

                <span>
                  Fechar
                </span>
              </>
            ) : (
              <>
                <Search className="size-4 shrink-0" />

                <span>
                  Buscar
                </span>
              </>
            )}
          </button>
        </div>

        {/* =====================================================
            CAIXA DE BUSCA
        ====================================================== */}

        {searchOpen && (
          <section
            className="
              mb-7
              rounded-3xl
              border
              border-border
              bg-background
              p-3
              sm:p-4
            "
          >
            <form
              onSubmit={
                handleSearchSubmit
              }
            >
              <div
                className="
                  relative
                  flex
                  items-center
                "
              >

                <input
                  autoFocus
                  type="search"
                  value={
                    searchQuery
                  }
                  onChange={(
                    event,
                  ) =>
                    setSearchQuery(
                      event.target
                        .value,
                    )
                  }
                  placeholder="Buscar notícias..."
                  enterKeyHint="search"
                  autoComplete="off"
                  className="
                    h-14
                    w-full
                    rounded-2xl
                    border
                    border-border
                    bg-elevated
                    pl-4
                    pr-16
                    text-base
                    text-fg
                    outline-none
                    placeholder:text-muted
                    focus:border-fg/30
                  "
                  aria-label="Buscar notícias"
                />

                <div
                  className="
                    absolute
                    right-2
                    flex
                    items-center
                  "
                >
                  <button
                    type="submit"
                    className="
                      flex
                      size-10
                      items-center
                      justify-center
                      rounded-xl
                      text-muted
                      transition-colors
                      hover:bg-background
                      hover:text-fg
                      active:scale-95
                    "
                    aria-label="Pesquisar notícias"
                  >
                    <Search className="size-5" />
                  </button>
                </div>
              </div>
            </form>

            {/* =================================================
                PRÉVIA DA BUSCA
            ================================================== */}

            {searchQuery.trim() && (
              <div className="mt-3">

                {previewSearchResults.length ===
                0 ? (
                  <div
                    className="
                      rounded-2xl
                      bg-surface
                      px-4
                      py-6
                      text-center
                      text-sm
                      text-muted
                    "
                  >
                    Nenhuma notícia encontrada.
                  </div>
                ) : (
                  <div
                    className="
                      overflow-hidden
                      rounded-2xl
                      border
                      border-border
                      bg-surface
                    "
                  >

                    {previewSearchResults.map(
                      (
                        item,
                      ) => (
                        <Link
                          key={
                            item.id
                          }
                          to="/news/$id"
                          params={{
                            id: item.id,
                          }}
                          search={{
                            page: currentPage,
                          }}
                          onClick={() =>
                            setSearchOpen(
                              false,
                            )
                          }
                          className="
                            flex
                            items-center
                            gap-3
                            border-b
                            border-border
                            px-4
                            py-3
                            transition-colors
                            last:border-b-0
                            hover:bg-elevated
                          "
                        >
                          <div
                            className="
                              size-14
                              shrink-0
                              overflow-hidden
                              rounded-lg
                              bg-black
                            "
                          >
                            <img
                              src={
                                item.image
                              }
                              alt=""
                              className="
                                h-full
                                w-full
                                object-cover
                              "
                            />
                          </div>

                          <div className="min-w-0 flex-1">
                            <p
                              className="
                                line-clamp-2
                                text-sm
                                font-semibold
                                text-fg
                              "
                            >
                              {
                                item.title
                              }
                            </p>

                            <p
                              className="
                                mt-1
                                text-xs
                                text-muted
                              "
                            >
                              {
                                item.type
                              }

                              {" · "}

                              {
                                item.date
                              }
                            </p>
                          </div>
                        </Link>
                      ),
                    )}

                    {/* =================================================
                        VER TODOS
                    ================================================== */}

                    {previewSearchResults.length <
                      searchResults.length && (
                      <button
                        type="button"
                        onClick={() =>
                          void navigate({
                            search: {
                              q: searchQuery.trim(),
                              page: 1,
                            },
                            resetScroll: false,
                          })
                        }
                        className="
                          flex
                          w-full
                          items-center
                          justify-center
                          border-t
                          border-border
                          px-4
                          py-4
                          text-sm
                          font-semibold
                          text-fg
                          transition-colors
                          hover:bg-elevated
                          active:bg-elevated
                        "
                      >
                        Ver todos os resultados
                        {" ("}
                        {
                          searchResults.length
                        }
                        {")"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* =====================================================
            CABEÇALHO
        ====================================================== */}

        <section className="mb-7">
          <div
            className="
              flex
              items-center
              gap-3
            "
          >
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
              <h1
                className="
                  text-2xl
                  font-semibold
                  tracking-tight
                "
              >
                {isSearchMode
                  ? "Resultados da busca"
                  : "Notícias"}
              </h1>

              <p
                className="
                  mt-1
                  text-sm
                  text-muted
                "
              >
                {isSearchMode ? (
                  <>
                    Resultados para:{" "}
                    <span className="font-medium text-fg">
                      "{urlQuery}"
                    </span>
                  </>
                ) : (
                  "Fique por dentro das novidades do mundo dos animes."
                )}
              </p>
            </div>
          </div>
        </section>

        {/* =====================================================
            CONTADOR DA BUSCA
        ====================================================== */}

        {isSearchMode && (
          <div
            className="
              mb-5
              flex
              items-center
              gap-2
              text-sm
              text-muted
            "
          >
            <Search className="size-4 shrink-0" />

            <span>
              {searchResults.length}{" "}
              {searchResults.length ===
              1
                ? "resultado encontrado"
                : "resultados encontrados"}
            </span>
          </div>
        )}

        {/* =====================================================
            NOTÍCIAS
        ====================================================== */}

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
                    key={
                      item.id
                    }
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

            {/* =================================================
                PAGINAÇÃO
            ================================================== */}

            {totalPages > 1 && (
              <nav
                className="
                  mt-8
                  flex
                  flex-col
                  items-center
                  gap-3
                "
                aria-label={
                  isSearchMode
                    ? "Paginação dos resultados da busca"
                    : "Paginação das notícias"
                }
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
                        currentPage -
                          1,
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
                    (
                      _,
                      index,
                    ) =>
                      index +
                      1,
                  ).map(
                    (
                      page,
                    ) => (
                      <button
                        key={
                          page
                        }
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
                        currentPage +
                          1,
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
              min-h-[220px]
              flex-col
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
            <Newspaper className="mb-3 size-8 text-muted" />

            {isSearchMode ? (
              <>
                <p
                  className="
                    text-base
                    font-medium
                    text-fg
                  "
                >
                  Nenhuma notícia encontrada.
                </p>

                <p
                  className="
                    mt-2
                    text-sm
                    text-muted
                  "
                >
                  Não encontramos notícias para{" "}
                  <span className="font-medium text-fg">
                    "{urlQuery}"
                  </span>
                  .
                </p>
              </>
            ) : (
              <p className="text-sm text-muted">
                Nenhuma notícia disponível no momento.
              </p>
            )}
          </section>
        )}
      </div>
    </main>
  );
      }
