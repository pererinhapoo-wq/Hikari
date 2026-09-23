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

  const {
    page: urlPage,
  } = Route.useSearch();

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
  ] = useState(false);

  const [
    searchQuery,
    setSearchQuery,
  ] = useState("");

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

  /*
   * A busca procura somente nas notícias carregadas.
   * Não consulta o catálogo de animes.
   */
  const searchResults =
    useMemo(() => {
      const query =
        normalizeSearchText(
          searchQuery,
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
      searchQuery,
    ]);

  /*
   * Mostra TODOS os resultados.
   */
  const newsSearchResults =
    searchResults;

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        news.length /
          NEWS_PER_PAGE,
      ),
    );

  /* =========================================================
     SINCRONIZAÇÃO DA PAGINAÇÃO
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
    urlPage,
    currentPage,
  ]);

  useEffect(() => {
    if (
      currentPage >
      totalPages
    ) {
      setCurrentPage(
        totalPages,
      );

      void navigate({
        search: {
          page: totalPages,
        },
        resetScroll: false,
      });
    }
  }, [
    currentPage,
    totalPages,
    navigate,
  ]);

  /* =========================================================
     AÇÕES DA BUSCA
  ========================================================== */

  const openSearch = () => {
    setSearchOpen(true);
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery("");
  };

  const handleSearchSubmit =
    (
      event: FormEvent<HTMLFormElement>,
    ) => {
      event.preventDefault();
    };

  /* =========================================================
     NOTÍCIAS VISÍVEIS
  ========================================================== */

  const visibleNews =
    useMemo(() => {
      const start =
        (currentPage - 1) *
        NEWS_PER_PAGE;

      return news.slice(
        start,
        start +
          NEWS_PER_PAGE,
      );
    }, [
      news,
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
        page: nextPage,
      },
      resetScroll: false,
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
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

          {/* BUSCAR / FECHAR */}
          {!searchOpen ? (
            <button
              type="button"
              onClick={openSearch}
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
              aria-label="Abrir busca"
            >
              <Search className="size-4 shrink-0" />

              <span>
                Buscar
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={closeSearch}
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
              aria-label="Fechar busca"
            >
              <X className="size-4 shrink-0" />

              <span>
                Fechar
              </span>
            </button>
          )}
        </div>

        {/* =====================================================
            BUSCA
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

                {/* CAMPO */}
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

                {/* LUPA */}
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
                RESULTADOS DA BUSCA
            ================================================== */}

            {searchQuery.trim() && (
              <div className="mt-3">

                {newsSearchResults.length ===
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
                      max-h-[55vh]
                      overflow-y-auto
                      rounded-2xl
                      border
                      border-border
                      bg-surface
                    "
                  >
                    {newsSearchResults.map(
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
                          onClick={
                            closeSearch
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

                          {/* IMAGEM */}
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

                          {/* INFORMAÇÕES */}
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
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* =====================================================
            TÍTULO
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
                Notícias
              </h1>

              <p
                className="
                  mt-1
                  text-sm
                  text-muted
                "
              >
                Fique por dentro das novidades do mundo dos animes.
              </p>
            </div>
          </div>
        </section>

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

                  {/* ANTERIOR */}
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

                  {/* PÁGINAS */}
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

                  {/* PRÓXIMA */}
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
