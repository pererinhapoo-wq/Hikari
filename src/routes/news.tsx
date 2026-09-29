import {
  createFileRoute,
  Link,
  stripSearchParams,
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

  search: {
    middlewares: [
      stripSearchParams({
        q: "",
        page: 1,
      }),
    ],
  },

  loader: async () => {
    return await fetchAutomaticNews();
  },

  component: NewsPage,
});

const NEWS_PER_PAGE = 8;

type AnimeCalendarItem = {
  id: number;
  episode: number;
  airingAt: number;
  title: string;
  image: string;
  coverImage: string;
};

async function fetchAnimeCalendar(): Promise<AnimeCalendarItem[]> {
  const now = Math.floor(Date.now() / 1000);
  const sevenDays = now + 7 * 24 * 60 * 60;

  const query = `
    query ($airingAtGreater: Int, $airingAtLesser: Int) {
      Page(perPage: 20) {
        airingSchedules(
          airingAt_greater: $airingAtGreater
          airingAt_lesser: $airingAtLesser
          sort: TIME
        ) {
          airingAt
          episode
          media {
            id
            title {
              english
              romaji
            }
            bannerImage
            coverImage {
              extraLarge
              large
            }
          }
        }
      }
    }
  `;

  try {
    const response = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        variables: {
          airingAtGreater: now,
          airingAtLesser: sevenDays,
        },
      }),
    });

    if (!response.ok) return [];

    const data = await response.json();
    const schedules = data?.data?.Page?.airingSchedules;

    if (!Array.isArray(schedules)) return [];

    return schedules
      .filter(
        (item: any) =>
          item?.media &&
          (item.media.title?.english || item.media.title?.romaji) &&
          item?.airingAt &&
          item?.episode,
      )
      .map((item: any) => ({
        id: Number(item.media.id),
        episode: Number(item.episode),
        airingAt: Number(item.airingAt),
        title:
          item.media.title?.english?.trim() ||
          item.media.title?.romaji?.trim() ||
          "Anime",
        image:
          item.media.bannerImage ||
          item.media.coverImage?.extraLarge ||
          item.media.coverImage?.large ||
          "",
        coverImage:
          item.media.coverImage?.extraLarge ||
          item.media.coverImage?.large ||
          item.media.bannerImage ||
          "",
      }))
      .filter((item: AnimeCalendarItem) => item.image)
      .slice(0, 12);
  } catch {
    return [];
  }
}

function formatCalendarDay(timestamp: number) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  })
    .format(new Date(timestamp * 1000))
    .replace(".", "")
    .replace(/\b\w/, (letter) => letter.toUpperCase());
}

function formatCalendarTime(timestamp: number) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp * 1000));
}

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

function formatRelativeNewsTime(
  dateValue: string,
  timeValue?: string,
) {
  if (!dateValue) return "";

  const normalized = dateValue.trim();
  let date: Date | null = null;

  const numericMatch = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (numericMatch) {
    const [, day, month, year] = numericMatch;
    date = new Date(Number(year), Number(month) - 1, Number(day));
  } else {
    const parsed = Date.parse(normalized);
    if (!Number.isNaN(parsed)) date = new Date(parsed);
  }

  if (!date) return "";

  if (timeValue) {
    const timeMatch = timeValue.trim().match(/^(\d{1,2}):(\d{2})$/);
    if (timeMatch) {
      date.setHours(Number(timeMatch[1]), Number(timeMatch[2]), 0, 0);
    }
  }

  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - date.getTime());
  const minutes = Math.floor(diffMs / 60000);

  if (minutes < 1) return "Há menos de 1 minuto";
  if (minutes < 60) return `Há ${minutes} ${minutes === 1 ? "minuto" : "minutos"}`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Há ${hours} ${hours === 1 ? "hora" : "horas"}`;

  const days = Math.floor(hours / 24);
  return `Há ${days} ${days === 1 ? "dia" : "dias"}`;
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

  const currentPage =
    Math.max(
      1,
      Number(search.page) || 1,
    );

  const urlQuery =
    typeof search.q === "string"
      ? search.q
      : "";

  /*
   * =========================================================
   * BUSCA
   * =========================================================
   *
   * A busca começa fechada mesmo quando existe q na URL.
   * Assim, ao recarregar uma página de resultados, o campo
   * não abre sozinho.
   */

  const [
    searchOpen,
    setSearchOpen,
  ] = useState(false);

  const [
    searchQuery,
    setSearchQuery,
  ] = useState("");

  /*
   * =========================================================
   * BANNER DE DESTAQUE
   * =========================================================
   * Banner exclusivo da /news.
   * Não altera os botões Voltar/Buscar nem a paginação.
   */
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [calendarEpisodes, setCalendarEpisodes] = useState<AnimeCalendarItem[]>([]);

  /*
   * =========================================================
   * NOTÍCIAS
   * =========================================================
   */

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

  const featuredNews = useMemo(() => {
    return news.slice(0, 5);
  }, [news]);

  useEffect(() => {
    if (featuredNews.length <= 1) {
      setFeaturedIndex(0);
      return;
    }

    if (featuredIndex >= featuredNews.length) {
      setFeaturedIndex(0);
      return;
    }

    const timer = window.setInterval(() => {
      setFeaturedIndex((current) =>
        (current + 1) % featuredNews.length,
      );
    }, 6000);

    return () => {
      window.clearInterval(timer);
    };
  }, [featuredNews.length, featuredIndex]);

  const featuredItem =
    featuredNews[featuredIndex] ?? featuredNews[0];

  useEffect(() => {
    let active = true;

    void fetchAnimeCalendar().then((items) => {
      if (active) setCalendarEpisodes(items);
    });

    return () => {
      active = false;
    };
  }, []);

  /*
   * =========================================================
   * EM ALTA
   * =========================================================
   * Seção automática baseada nas notícias mais recentes
   * disponíveis no catálogo.
   */
  const hotNews = useMemo(() => {
    return news.slice(0, 6);
  }, [news]);

  /*
   * =========================================================
   * RESULTADOS ENQUANTO DIGITA
   * =========================================================
   */

  const liveSearchResults =
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
   * =========================================================
   * RESULTADOS DA URL
   * =========================================================
   */

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
   * =========================================================
   * PRIMEIROS 5 RESULTADOS
   * =========================================================
   */

  const previewSearchResults =
    liveSearchResults.slice(
      0,
      5,
    );

  /*
   * =========================================================
   * MODO DE BUSCA
   * =========================================================
   */

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

  /*
   * =========================================================
   * PESQUISAR
   * =========================================================
   */

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

      /*
       * Fecha a caixa imediatamente.
       * Os resultados continuam na página porque q
       * continua sendo enviado pela URL.
       */
      setSearchOpen(false);

      void navigate({
        to: "/news",
        search: {
          q: query,
          page: 1,
        },
        resetScroll: false,
      });
    };

  /*
   * =========================================================
   * VER TODOS OS RESULTADOS
   * =========================================================
   */

  const handleViewAllResults =
    () => {
      const query =
        searchQuery.trim();

      if (!query) {
        return;
      }

      setSearchOpen(false);

      void navigate({
        to: "/news/search",
        search: {
          q: query,
          page: 1,
        },
        resetScroll: false,
      });
    };

  /*
   * =========================================================
   * LIMPAR CAMPO DA BUSCA
   * =========================================================
   */

  const clearSearchInput = () => {
    setSearchQuery("");
  };

  /*
   * =========================================================
   * FECHAR BUSCA
   * =========================================================
   */

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery("");
  };

  /*
   * =========================================================
   * VOLTAR
   * =========================================================
   */

  const handleBack = () => {
    if (isSearchMode) {
      void navigate({
        to: "/news",
        search: {},
        resetScroll: false,
      });

      setSearchOpen(false);
      setSearchQuery("");

      return;
    }

    void navigate({
      to: "/",
    });
  };

  /*
   * =========================================================
   * PAGINAÇÃO
   * =========================================================
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

    void navigate({
      to: "/news",
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

  /*
   * =========================================================
   * NOTÍCIAS VISÍVEIS
   * =========================================================
   */

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
          <button
            type="button"
            onClick={
              handleBack
            }
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
          </button>

          <button
            type="button"
            onClick={() => {
              if (
                searchOpen
              ) {
                closeSearch();
              } else {
                /*
                 * Ao abrir novamente a busca, preservamos
                 * os resultados que já estão na página.
                 * O campo começa vazio para uma nova pesquisa.
                 */
                setSearchQuery("");
                setSearchOpen(true);
              }
            }}
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
            {searchOpen ? (
              <>
                <X className="size-4" />

                <span>
                  Fechar
                </span>
              </>
            ) : (
              <>
                <Search className="size-4" />

                <span>
                  Buscar
                </span>
              </>
            )}
          </button>
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
                <input
                  autoFocus
                  type="text"
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
                    pr-24
                    text-base
                    text-fg
                    outline-none
                    placeholder:text-muted
                    focus:border-fg/30
                  "
                  aria-label="Buscar notícias"
                />

                {searchQuery.trim() && (
                  <button
                    type="button"
                    onClick={
                      clearSearchInput
                    }
                    className="
                      absolute
                      right-12
                      flex
                      size-10
                      items-center
                      justify-center
                      rounded-xl
                      text-muted
                      transition
                      hover:bg-background
                      hover:text-fg
                      active:scale-95
                    "
                    aria-label="Limpar busca"
                  >
                    <X className="size-5" />
                  </button>
                )}

                <button
                  type="submit"
                  className="
                    absolute
                    right-2
                    flex
                    size-10
                    items-center
                    justify-center
                    rounded-xl
                    text-muted
                    transition
                    hover:bg-background
                    hover:text-fg
                    active:scale-95
                  "
                  aria-label="Pesquisar notícias"
                >
                  <Search className="size-5" />
                </button>
              </div>
            </form>

            {/* =================================================
                RESULTADOS
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

                    {/* PRIMEIROS 5 */}

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
                          className="
                            flex
                            items-center
                            gap-3
                            border-b
                            border-border
                            px-4
                            py-3
                            transition
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

                              {item.date} · {formatRelativeNewsTime(item.date, "time" in item && typeof item.time === "string" ? item.time : undefined)}
                            </p>
                          </div>
                        </Link>
                      ),
                    )}

                    {/* =================================================
                        VER TODOS
                    ================================================== */}

                    {liveSearchResults.length >
                      5 && (
                      <button
                        type="button"
                        onClick={
                          handleViewAllResults
                        }
                        className="
                          flex
                          w-full
                          cursor-pointer
                          items-center
                          justify-center
                          border-t
                          border-border
                          px-4
                          py-4
                          text-sm
                          font-semibold
                          text-fg
                          transition
                          hover:bg-elevated
                          active:bg-elevated
                        "
                      >
                        Ver todos os resultados
                        {" ("}
                        {
                          liveSearchResults.length
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
            BANNER DE DESTAQUE DA /NEWS
        ====================================================== */}

        {!isSearchMode && featuredItem && (
          <section className="mb-7">
            <Link
              to="/news/$id"
              params={{
                id: featuredItem.id,
              }}
              search={{
                page: currentPage,
              }}
              className="
                group
                relative
                block
                overflow-hidden
                rounded-3xl
                border
                border-border
                bg-card
                shadow-sm
              "
            >
              <div
                className="
                  relative
                  aspect-[16/8]
                  min-h-[220px]
                  w-full
                  overflow-hidden
                  bg-black
                  sm:aspect-[16/7]
                  lg:aspect-[16/6]
                "
              >
                <img
                  src={featuredItem.image}
                  alt={featuredItem.title}
                  className="
                    absolute
                    inset-0
                    h-full
                    w-full
                    object-cover
                    transition-transform
                    duration-700
                    group-hover:scale-[1.02]
                  "
                  loading="eager"
                />

                <div
                  className="
                    absolute
                    inset-0
                    bg-gradient-to-t
                    from-black
                    via-black/55
                    to-black/5
                  "
                />

                <div
                  className="
                    absolute
                    inset-x-0
                    bottom-0
                    p-5
                    sm:p-7
                    lg:p-8
                  "
                >
                  <span
                    className="
                      inline-flex
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
                    {featuredItem.type}
                  </span>

                  <h2
                    className="
                      mt-3
                      max-w-4xl
                      line-clamp-2
                      text-xl
                      font-bold
                      leading-tight
                      text-white
                      sm:text-2xl
                      lg:text-3xl
                    "
                  >
                    {featuredItem.title}
                  </h2>

                  <p
                    className="
                      mt-2
                      hidden
                      max-w-3xl
                      line-clamp-2
                      text-sm
                      leading-relaxed
                      text-white/75
                      sm:block
                    "
                  >
                    {featuredItem.description}
                  </p>
                </div>
              </div>

              <div
                className="
                  flex
                  items-center
                  justify-center
                  gap-1.5
                  bg-black/35
                  px-4
                  py-2.5
                  backdrop-blur-sm
                "
              >
                {featuredNews.map((item, index) => (
                  <span
                    key={item.id}
                    className={`
                      h-1.5
                      rounded-full
                      transition-all
                      ${
                        index === featuredIndex
                          ? "w-6 bg-accent"
                          : "w-1.5 bg-muted/50"
                      }
                    `}
                  />
                ))}
              </div>
            </Link>
          </section>
        )}

        {/* =====================================================
            CONTADOR
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
            <Search className="size-4" />

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
                      transition
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
                          {item.date} · {formatRelativeNewsTime(item.date, "time" in item && typeof item.time === "string" ? item.time : undefined)}
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
              >
                <div
                  className="
                    flex
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
                          ${
                            currentPage ===
                            page
                              ? "border-accent/50 bg-accent/15 text-accent"
                              : "border-border bg-card text-muted"
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

            {/* =================================================
                EM ALTA
            ================================================== */}

            {!isSearchMode && hotNews.length > 0 && (
              <section className="mt-10">
                <div className="mb-4">
                  <h2 className="text-xl font-semibold tracking-tight">
                    Em alta
                  </h2>
                </div>

                <div
                  className="
                    flex
                    gap-4
                    overflow-x-auto
                    pb-2
                    snap-x
                    snap-mandatory
                    [scrollbar-width:none]
                    [&::-webkit-scrollbar]:hidden
                  "
                >
                  {hotNews.map((item) => (
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
                        w-[78vw]
                        max-w-[340px]
                        shrink-0
                        snap-start
                        overflow-hidden
                        rounded-3xl
                        border
                        border-border
                        bg-card
                        transition
                        hover:bg-elevated
                        sm:w-[300px]
                      "
                    >
                      <div className="relative aspect-[16/9] w-full overflow-hidden bg-black">
                        <img
                          src={item.image}
                          alt={item.title}
                          className="
                            h-full
                            w-full
                            object-cover
                            transition-transform
                            duration-500
                            group-hover:scale-[1.03]
                          "
                          loading="lazy"
                        />
                        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent" />
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
                        <h3
                          className="
                            line-clamp-2
                            text-sm
                            font-semibold
                            leading-snug
                          "
                        >
                          {item.title}
                        </h3>
                        <p className="mt-2 text-xs text-muted">
                          {item.date} · {formatRelativeNewsTime(item.date, "time" in item && typeof item.time === "string" ? item.time : undefined)}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
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

            <p className="text-base font-medium">
              Nenhuma notícia encontrada.
            </p>

            {isSearchMode && (
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
            )}
          </section>
        )}

        {/* =================================================
            CALENDÁRIO DE ANIME
        ================================================== */}

        {!isSearchMode && calendarEpisodes.length > 0 && (
          <section className="mt-10">
            <div className="mb-4">
              <h2 className="text-xl font-semibold tracking-tight">
                Calendário de Anime
              </h2>
            </div>

            <div
              className="
                grid
                grid-cols-2
                gap-3
                sm:grid-cols-2
                sm:gap-4
                lg:grid-cols-4
              "
            >
              {calendarEpisodes.map((item) => (
                <article
                  key={`${item.id}-${item.airingAt}-${item.episode}`}
                  className="
                    min-w-0
                    overflow-hidden
                    rounded-3xl
                    border
                    border-border
                    bg-card
                  "
                >
                  <div className="relative w-full overflow-hidden bg-black">
                    <div className="sm:hidden">
                      <div className="relative aspect-[3/4] w-full overflow-hidden">
                        <img
                          src={item.coverImage}
                          alt={item.title}
                          className="h-full w-full object-cover object-center"
                          loading="lazy"
                        />
                      </div>
                    </div>

                    <div className="hidden sm:block">
                      <div className="relative aspect-[16/7] w-full overflow-hidden">
                        <img
                          src={item.image}
                          alt={item.title}
                          className="h-full w-full object-cover object-center"
                          loading="lazy"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="p-3 sm:p-4">
                    <p className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-accent sm:text-xs">
                      {formatCalendarDay(item.airingAt)} · {formatCalendarTime(item.airingAt)}
                    </p>
                    <h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-snug sm:text-base">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-xs text-muted">
                      Episódio {item.episode}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
