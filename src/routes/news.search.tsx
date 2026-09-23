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
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  fetchAutomaticNews,
  type AutomaticNewsItem,
} from "@/lib/news-api";

export const Route = createFileRoute(
  "/news/search",
)({
  validateSearch: (search) => ({
    q: String(
      search.q ?? "",
    ),
    page: Math.max(
      1,
      Number(search.page) || 1,
    ),
  }),

  loader: async () => {
    return await fetchAutomaticNews();
  },

  component: NewsSearchPage,
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

function NewsSearchPage() {
  const navigate =
    useNavigate({
      from: "/news/search",
    });

  const loaderNews =
    Route.useLoaderData() as AutomaticNewsItem[];

  const {
    q,
    page: urlPage,
  } = Route.useSearch();

  const [
    currentPage,
    setCurrentPage,
  ] = useState(urlPage);

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
   * Procura somente nas notícias.
   */
  const results =
    useMemo(() => {
      const query =
        normalizeSearchText(
          q,
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
      q,
    ]);

  /*
   * Quantidade total de páginas.
   */
  const totalPages =
    Math.max(
      1,
      Math.ceil(
        results.length /
          NEWS_PER_PAGE,
      ),
    );

  /*
   * Sincroniza a página
   * com a URL.
   */
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

  /*
   * Se a página atual não existir,
   * volta para a última página.
   */
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
          q,
          page: totalPages,
        },
        resetScroll: false,
      });
    }
  }, [
    currentPage,
    totalPages,
    navigate,
    q,
  ]);

  /*
   * Resultados da página atual.
   */
  const visibleResults =
    useMemo(() => {
      const start =
        (currentPage - 1) *
        NEWS_PER_PAGE;

      return results.slice(
        start,
        start +
          NEWS_PER_PAGE,
      );
    }, [
      results,
      currentPage,
    ]);

  /*
   * Trocar de página.
   */
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
        q,
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
            mb-8
            flex
            items-center
            justify-between
            gap-3
          "
        >
          <Link
            to="/news"
            className="
              inline-flex
              items-center
              gap-2
              rounded-lg
              px-2
              py-2
              text-sm
              font-medium
              text-muted
              transition
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
        </div>

        {/* =====================================================
            CABEÇALHO
        ====================================================== */}

        <section
          className="
            mb-8
            rounded-3xl
            border
            border-border
            bg-card
            p-5
            sm:p-6
          "
        >
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
                size-11
                shrink-0
                items-center
                justify-center
                rounded-full
                bg-elevated
                text-fg
              "
            >
              <Search className="size-5" />
            </div>

            <div className="min-w-0">
              <h1
                className="
                  text-xl
                  font-semibold
                  tracking-tight
                "
              >
                Resultados da busca
              </h1>

              <p
                className="
                  mt-1
                  break-words
                  text-sm
                  text-muted
                "
              >
                Resultados para:{" "}
                <span className="font-medium text-fg">
                  {q}
                </span>
              </p>
            </div>
          </div>
        </section>

        {/* =====================================================
            RESULTADOS
        ====================================================== */}

        {results.length > 0 ? (
          <>
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
              <Newspaper className="size-4 shrink-0" />

              <span>
                {results.length}{" "}
                {results.length ===
                1
                  ? "resultado encontrado"
                  : "resultados encontrados"}
              </span>
            </div>

            <section
              className="
                grid
                grid-cols-1
                gap-4
                sm:grid-cols-2
              "
            >
              {visibleResults.map(
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
                      active:scale-[0.99]
                    "
                  >

                    {/* IMAGEM */}

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

                    {/* INFORMAÇÕES */}

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
                aria-label="Paginação dos resultados da busca"
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

                  {/* NÚMEROS */}

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

            <p className="text-sm text-muted">
              Nenhuma notícia encontrada.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
