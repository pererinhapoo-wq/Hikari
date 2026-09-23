import {
  createFileRoute,
  Link,
} from "@tanstack/react-router";

import {
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Newspaper,
} from "lucide-react";

import {
  useEffect,
  useState,
} from "react";

import {
  fetchAutomaticNews,
  type AutomaticNewsItem,
} from "@/lib/news-api";

const NEWS_PER_PAGE = 4;

export const Route = createFileRoute(
  "/news",
)({
  component: NewsPage,
});

function NewsPage() {
  const [news, setNews] =
    useState<AutomaticNewsItem[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [currentPage, setCurrentPage] =
    useState(1);

  useEffect(() => {
    let active = true;

    const loadNews = async () => {
      try {
        const result =
          await fetchAutomaticNews();

        if (!active) {
          return;
        }

        setNews(result);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadNews();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [news.length]);

  const totalPages = Math.max(
    1,
    Math.ceil(
      news.length / NEWS_PER_PAGE,
    ),
  );

  const startIndex =
    (currentPage - 1) *
    NEWS_PER_PAGE;

  const currentNews =
    news.slice(
      startIndex,
      startIndex + NEWS_PER_PAGE,
    );

  const goToPage = (
    page: number,
  ) => {
    const nextPage =
      Math.min(
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
    <div className="space-y-6 pb-10">
      <Link
        to="/"
        className="
          inline-flex
          w-fit
          items-center
          gap-2
          rounded-lg
          px-2.5
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

      <div className="flex items-start gap-3">
        <div
          className="
            flex
            size-10
            shrink-0
            items-center
            justify-center
            rounded-xl
            bg-elevated
            text-fg
          "
        >
          <Newspaper className="size-5" />
        </div>

        <div>
          <h1 className="text-2xl font-bold text-fg">
            Notícias
          </h1>

          <p className="mt-1 text-sm text-muted">
            Fique por dentro das novidades do mundo dos animes.
          </p>
        </div>
      </div>

      {loading ? (
        <div
          className="
            flex
            min-h-48
            items-center
            justify-center
            rounded-2xl
            border
            border-border
            bg-surface
            text-sm
            text-muted
          "
        >
          Carregando notícias...
        </div>
      ) : currentNews.length === 0 ? (
        <div
          className="
            flex
            min-h-48
            items-center
            justify-center
            rounded-2xl
            border
            border-border
            bg-surface
            px-5
            text-center
            text-sm
            text-muted
          "
        >
          Nenhuma notícia disponível no momento.
        </div>
      ) : (
        <div
          className="
            grid
            gap-5
            md:grid-cols-2
            xl:grid-cols-3
          "
        >
          {currentNews.map((item) => (
            <Link
              key={item.id}
              to="/news/$id"
              params={{
                id: item.id,
              }}
              className="
                group
                overflow-hidden
                rounded-2xl
                border
                border-border
                bg-surface
                transition-all
                duration-300
                hover:-translate-y-1
                hover:border-border-strong
                hover:shadow-xl
              "
            >
              <div
                className="
                  relative
                  aspect-video
                  w-full
                  overflow-hidden
                  bg-black
                "
              >
                <img
                  src={item.image}
                  alt=""
                  loading="lazy"
                  className="
                    size-full
                    object-contain
                    transition-transform
                    duration-500
                    group-hover:scale-[1.02]
                  "
                />

                <div
                  className="
                    pointer-events-none
                    absolute
                    inset-0
                    bg-gradient-to-t
                    from-black/80
                    via-black/10
                    to-transparent
                  "
                />

                <div
                  className="
                    absolute
                    bottom-3
                    left-3
                    rounded-full
                    bg-black/65
                    px-3
                    py-1
                    text-[11px]
                    font-semibold
                    uppercase
                    tracking-wide
                    text-white
                    backdrop-blur-sm
                  "
                >
                  {item.type}
                </div>
              </div>

              <div className="space-y-3 p-4">
                <h2
                  className="
                    line-clamp-2
                    text-lg
                    font-semibold
                    leading-tight
                    text-fg
                    transition-colors
                    group-hover:text-primary
                  "
                >
                  {item.title}
                </h2>

                <p
                  className="
                    line-clamp-2
                    text-sm
                    leading-relaxed
                    text-muted
                  "
                >
                  {item.description}
                </p>

                <div
                  className="
                    flex
                    items-center
                    gap-2
                    text-xs
                    text-muted
                  "
                >
                  <CalendarDays className="size-4" />
                  <span>{item.date}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {!loading &&
        news.length > 0 && (
          <>
            <div
              className="
                flex
                flex-wrap
                items-center
                justify-center
                gap-2
                pt-2
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
                className="
                  inline-flex
                  size-10
                  items-center
                  justify-center
                  rounded-lg
                  border
                  border-border
                  bg-surface
                  text-muted
                  transition-all
                  hover:bg-elevated
                  hover:text-fg
                  disabled:cursor-not-allowed
                  disabled:opacity-40
                "
                aria-label="Página anterior"
              >
                <ChevronLeft className="size-4" />
              </button>

              {Array.from(
                {
                  length: totalPages,
                },
                (_, index) =>
                  index + 1,
              ).map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() =>
                    goToPage(page)
                  }
                  className={`
                    inline-flex
                    size-10
                    items-center
                    justify-center
                    rounded-lg
                    border
                    text-sm
                    font-medium
                    transition-all
                    ${
                      currentPage === page
                        ? "border-primary bg-primary text-white"
                        : "border-border bg-surface text-muted hover:bg-elevated hover:text-fg"
                    }
                  `}
                >
                  {page}
                </button>
              ))}

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
                className="
                  inline-flex
                  size-10
                  items-center
                  justify-center
                  rounded-lg
                  border
                  border-border
                  bg-surface
                  text-muted
                  transition-all
                  hover:bg-elevated
                  hover:text-fg
                  disabled:cursor-not-allowed
                  disabled:opacity-40
                "
                aria-label="Próxima página"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>

            <div className="text-center text-xs text-muted">
              Página {currentPage} de{" "}
              {totalPages}
            </div>
          </>
        )}
    </div>
  );
        }
