import {
  createFileRoute,
  Link,
} from "@tanstack/react-router";

import {
  ArrowLeft,
  CalendarDays,
  Newspaper,
  Search,
} from "lucide-react";

import {
  useMemo,
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
  }),

  loader: async () => {
    return await fetchAutomaticNews();
  },

  component: NewsSearchPage,
});

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
  const loaderNews =
    Route.useLoaderData() as AutomaticNewsItem[];

  const {
    q,
  } = Route.useSearch();

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

        {/* TOPO */}
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
            "
          >
            <ArrowLeft className="size-4" />

            <span>
              Voltar
            </span>
          </Link>
        </div>

        {/* CABEÇALHO */}
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

        {/* RESULTADOS */}
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
              <Newspaper className="size-4" />

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
              {results.map(
                (item) => (
                  <Link
                    key={
                      item.id
                    }
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
                        }
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
                        <CalendarDays className="size-3.5" />

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
