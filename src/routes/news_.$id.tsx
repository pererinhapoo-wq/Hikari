import {
  createFileRoute,
  Link,
  notFound,
} from "@tanstack/react-router";

import {
  ArrowLeft,
  CalendarDays,
  Clapperboard,
  Newspaper,
  Play,
  Tv,
} from "lucide-react";

import {
  fetchAutomaticNews,
  type AutomaticNewsItem,
} from "@/lib/news-api";

import {
  fetchAdultNews,
} from "@/lib/news-api-adulto-separado";

import {
  NEWS,
  type AnimeInfo,
  type NewsItem,
} from "@/lib/news-detail-data";

export const Route = createFileRoute(
  "/news_/$id",
)({
  validateSearch: (search) => ({
    page: Math.max(
      1,
      Number(search.page) || 1,
    ),
  }),

  loader: async ({
    params,
  }) => {
    const {
      NEWS: staticNewsList,
      fetchAnimeInfo,
    } = await import("@/lib/news-detail-data");

    /*
     * Notícias fixas não precisam consultar o AniList.
     * Isso evita uma chamada externa desnecessária ao abrir
     * qualquer notícia estática.
     */
    const staticItem =
      staticNewsList.find(
        (item) =>
          item.id ===
          params.id,
      );

    if (staticItem) {
      return {
        automaticNews: [],
        automaticAnime: null,
        isAdultNews: false,
      };
    }

    /*
     * As notícias automáticas +18 usam os mesmos prefixos
     * de ID das notícias normais (auto-season, auto-trailer,
     * auto-episode etc.). Por isso não podemos descobrir a
     * origem apenas pelo ID.
     *
     * Procuramos a notícia nas duas fontes e usamos a fonte
     * em que ela realmente existir.
     */
    const [
      adultNews,
      normalNews,
    ] = await Promise.all([
      fetchAdultNews(),
      fetchAutomaticNews(),
    ]);

    const adultItem =
      adultNews.find(
        (item) =>
          item.id ===
          params.id,
      );

    const normalItem =
      normalNews.find(
        (item) =>
          item.id ===
          params.id,
      );

    const isAdultNews =
      Boolean(adultItem);

    const automaticNews =
      isAdultNews
        ? adultNews
        : normalNews;

    const automaticItem =
      isAdultNews
        ? adultItem
        : normalItem;

    let automaticAnime:
      | AnimeInfo
      | null =
      null;

    if (
      automaticItem?.animeId
    ) {
      const animeId =
        Number(
          automaticItem.animeId,
        );

      if (
        Number.isInteger(
          animeId,
        ) &&
        animeId > 0
      ) {
        automaticAnime =
          await fetchAnimeInfo(
            animeId,
          );
      }
    }

    return {
      automaticNews,
      automaticAnime,
      isAdultNews,
    };
  },

  component:
    NewsDetailsPage,
});

function automaticToNewsItem(
  item: AutomaticNewsItem,
  anime:
    | AnimeInfo
    | null
    | undefined,
): NewsItem {
  let content = "";

  if (
    item.type ===
    "NOVO EPISÓDIO"
  ) {
    content =
      `Este episódio faz parte da programação atual de ${anime?.name ?? "este anime"}. ` +
      `Acompanhe a página do anime para encontrar os episódios disponíveis no Hikari.`;
  } else if (
    item.type ===
    "TRAILER"
  ) {
    content =
      `O trailer foi identificado automaticamente a partir dos dados disponíveis para ${anime?.name ?? "este anime"}. ` +
      `Novas informações poderão aparecer conforme os dados forem atualizados.`;
  } else {
    content =
      `${anime?.name ?? item.title} faz parte da programação atual de animes. ` +
      `Novas informações poderão aparecer conforme os dados da temporada forem atualizados.`;
  }

  return {
    id:
      item.id,

    type:
      item.type,

    title:
      item.title,

    description:
      item.description,

    content,

    date:
      item.date,

    time:
      "time" in item &&
      typeof item.time === "string"
        ? item.time
        : undefined,

    image:
      item.image,

    animeId:
      item.animeId,

    trailerUrl:
      item.trailerUrl,

    isAdult:
      item.isAdult === true,

    source:
      "source" in item &&
      typeof item.source === "string"
        ? item.source
        : undefined,
    articleImages:
      "articleImages" in item &&
      Array.isArray(item.articleImages)
        ? item.articleImages
        : [],

    mentionedHentai:
      "mentionedHentai" in item &&
      Array.isArray(item.mentionedHentai)
        ? item.mentionedHentai
        : [],

    anime:
      anime ?? undefined,
  };
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

function NewsDetailsPage() {
  const { id } =
    Route.useParams();

  const { page } =
    Route.useSearch();

  const {
    automaticNews,
    automaticAnime,
    isAdultNews,
  } =
    Route.useLoaderData();

  const automaticItem =
    automaticNews.find(
      (item) =>
        item.id === id,
    );

  const automaticNewsItem =
    automaticItem
      ? automaticToNewsItem(
          automaticItem,
          automaticAnime,
        )
      : null;

  const staticNews =
    NEWS.find(
      (item) =>
        item.id === id,
    );

  const news =
    automaticNewsItem ??
    staticNews;

  if (!news) {
    throw notFound();
  }

  const allNews = [
    ...NEWS,
    ...automaticNews.map(
      (item) => {
        if (
          item.id ===
          automaticItem?.id
        ) {
          return automaticToNewsItem(
            item,
            automaticAnime,
          );
        }

        return automaticToNewsItem(
          item,
          undefined,
        );
      },
    ),
  ];

  const filteredNews =
    allNews.filter((item) =>
      isAdultNews
        ? item.isAdult === true
        : item.isAdult !== true,
    );

  const currentNewsIndex =
    filteredNews.findIndex(
      (item) =>
        item.id === news.id,
    );

  const relatedNews: NewsItem[] = [];

  if (filteredNews.length > 1) {
    const startIndex =
      currentNewsIndex >= 0
        ? currentNewsIndex + 1
        : 0;

    for (
      let offset = 0;
      offset < filteredNews.length &&
        relatedNews.length < 3;
      offset++
    ) {
      const index =
        (startIndex + offset) %
        filteredNews.length;

      const item =
        filteredNews[index];

      if (item.id !== news.id) {
        relatedNews.push(item);
      }
    }
  }

  return (
    <div className="space-y-6 pb-10">
      {/* VOLTAR */}
      <Link
        to={
          isAdultNews
            ? "/adult/news"
            : "/news"
        }
        search={{
          page,
        }}
        className="
          relative
          top-2
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

        <span>
          Voltar para notícias
        </span>
      </Link>

      {/* CABEÇALHO */}
      <article
        className="
          overflow-hidden
          rounded-2xl
          bg-elevated
          shadow-[var(--shadow-border)]
        "
      >
        {/* IMAGEM */}
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
            src={news.image}
            alt=""
            className="
              size-full
              object-contain
            "
          />

          <div
            className="
              pointer-events-none
              absolute
              inset-0
              bg-linear-to-t
              from-black/70
              via-black/20
              to-transparent
            "
          />

          <div
            className="
              absolute
              bottom-0
              left-0
              right-0
              p-5
              sm:p-8
            "
          >
            <span
              className="
                inline-flex
                rounded-md
                bg-accent/15
                px-2
                py-1
                text-[10px]
                font-semibold
                tracking-[0.12em]
                text-accent
                uppercase
              "
            >
              {news.type}
            </span>

            <h1
              className="
                mt-3
                max-w-4xl
                font-display
                text-2xl
                leading-tight
                tracking-tight
                text-white
                sm:text-4xl
              "
            >
              {news.title}
            </h1>
          </div>
        </div>

        {/* CONTEÚDO */}
        <div className="p-5 sm:p-8">
          <div
            className="
              flex
              items-center
              gap-2
              text-xs
              text-subtle
            "
          >
            <CalendarDays className="size-4" />

            <span>
              {news.date} · {formatRelativeNewsTime(news.date, news.time)}
            </span>
          </div>

          <div className="mt-6">
            <p
              className="
                text-sm
                leading-7
                text-muted
                sm:text-base
              "
            >
              {news.description}
            </p>
          </div>

          {/* CONTEÚDO COMPLETO */}
          <div className="mt-6 space-y-4">
            {news.content
              .split("\n\n")
              .map(
                (
                  paragraph,
                  index,
                ) => (
                  <p
                    key={index}
                    className="
                      text-sm
                      leading-7
                      text-muted
                      sm:text-base
                    "
                  >
                    {paragraph}
                  </p>
                ),
              )}
          </div>

          {/* HENTAIS CITADOS NA MATÉRIA */}
          {news.mentionedHentai &&
            news.mentionedHentai.length > 0 && (
              <section
                className="
                  mt-8
                  space-y-4
                "
              >
                <div className="flex items-center gap-2">
                  <Clapperboard className="size-5 text-accent" />

                  <h2
                    className="
                      font-display
                      text-lg
                      tracking-tight
                      text-fg
                    "
                  >
                    Hentai citados na notícia
                  </h2>
                </div>

                <div
                  className="
                    grid
                    grid-cols-1
                    gap-4
                    sm:grid-cols-2
                  "
                >
                  {news.mentionedHentai.map(
                    (hentai) => (
                      <div
                        key={`${hentai.title}-${hentai.image}`}
                        className="
                          overflow-hidden
                          rounded-2xl
                          bg-black
                          shadow-[var(--shadow-border)]
                        "
                      >
                        <img
                          src={hentai.image}
                          alt={hentai.title}
                          loading="lazy"
                          className="
                            aspect-video
                            h-auto
                            w-full
                            object-contain
                          "
                        />

                        <div
                          className="
                            px-4
                            py-3
                            text-sm
                            font-medium
                            leading-6
                            text-fg
                          "
                        >
                          {hentai.title}
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </section>
            )}

          {/* IMAGENS DA MATÉRIA */}
          {news.articleImages &&
            news.articleImages.length > 0 && (
              <section
                className="
                  mt-8
                  space-y-4
                "
              >
                <div className="flex items-center gap-2">
                  <Newspaper className="size-5 text-accent" />

                  <h2
                    className="
                      font-display
                      text-lg
                      tracking-tight
                      text-fg
                    "
                  >
                    Imagens da notícia
                  </h2>
                </div>

                <div
                  className="
                    grid
                    grid-cols-1
                    gap-4
                    sm:grid-cols-2
                  "
                >
                  {news.articleImages.map(
                    (image, index) => (
                      <div
                        key={`${image}-${index}`}
                        className="
                          overflow-hidden
                          rounded-2xl
                          bg-black
                          shadow-[var(--shadow-border)]
                        "
                      >
                        <img
                          src={image}
                          alt={`${news.title} — imagem ${index + 1}`}
                          loading="lazy"
                          className="
                            h-auto
                            max-h-[520px]
                            w-full
                            object-contain
                          "
                        />
                      </div>
                    ),
                  )}
                </div>

                {news.source && (
                  <p
                    className="
                      text-xs
                      text-muted
                    "
                  >
                    Fonte: {news.source}
                  </p>
                )}
              </section>
            )}

          {/* TRAILER */}
          {news.type ===
            "TRAILER" &&
            news.trailerUrl && (
              <section
                id="trailer"
                className="
                  mt-8
                  scroll-mt-6
                  space-y-4
                "
              >
                <div
                  className="
                    flex
                    flex-col
                    gap-3
                    sm:flex-row
                    sm:items-center
                    sm:justify-between
                  "
                >
                  <div className="flex items-center gap-2">
                    <Play className="size-5 fill-current text-accent" />

                    <h2
                      className="
                        font-display
                        text-lg
                        tracking-tight
                        text-fg
                      "
                    >
                      Trailer
                    </h2>
                  </div>

                  <a
                    href="#trailer-player"
                    className="
                      inline-flex
                      w-fit
                      items-center
                      gap-2
                      rounded-lg
                      bg-accent
                      px-4
                      py-2
                      text-sm
                      font-semibold
                      text-white
                      transition-all
                      hover:opacity-90
                      active:scale-[0.97]
                    "
                  >
                    <Play className="size-4 fill-current" />

                    <span>
                      Assistir trailer
                    </span>
                  </a>
                </div>

                <div
                  id="trailer-player"
                  className="
                    overflow-hidden
                    rounded-xl
                    bg-black
                    shadow-[var(--shadow-border)]
                  "
                >
                  <div
                    className="
                      relative
                      aspect-video
                      w-full
                    "
                  >
                    <iframe
                      src={
                        news.trailerUrl
                      }
                      title={`Trailer - ${news.title}`}
                      className="
                        absolute
                        inset-0
                        size-full
                      "
                      loading="lazy"
                      allow="
                        accelerometer;
                        autoplay;
                        clipboard-write;
                        encrypted-media;
                        gyroscope;
                        picture-in-picture;
                        web-share
                      "
                      allowFullScreen
                    />
                  </div>
                </div>

                <p
                  className="
                    text-xs
                    leading-5
                    text-subtle
                  "
                >
                  Trailer disponível
                  através do link
                  fornecido pelos
                  dados da notícia.
                </p>
              </section>
            )}

          {/* ANIME RELACIONADO */}
          {news.anime && (
            <section
              className="
                mt-8
                overflow-hidden
                rounded-2xl
                bg-surface
                shadow-[var(--shadow-border)]
              "
            >
              <div
                className="
                  flex
                  items-center
                  gap-2
                  border-b
                  border-border
                  p-4
                  sm:p-5
                "
              >
                <Tv className="size-5 text-accent" />

                <h2
                  className="
                    font-display
                    text-lg
                    tracking-tight
                    text-fg
                  "
                >
                  Anime relacionado
                </h2>
              </div>

              <div
                className="
                  grid
                  gap-5
                  p-4
                  sm:p-5
                  md:grid-cols-[180px_1fr]
                "
              >
                <div
                  className="
                    mx-auto
                    w-full
                    max-w-[180px]
                    overflow-hidden
                    rounded-xl
                    bg-elevated
                  "
                >
                  <img
                    src={
                      news.anime
                        .image
                    }
                    alt={
                      news.anime
                        .name
                    }
                    className="
                      aspect-[2/3]
                      w-full
                      object-cover
                    "
                  />
                </div>

                <div className="min-w-0">
                  <div
                    className="
                      flex
                      flex-col
                      gap-3
                      sm:flex-row
                      sm:items-start
                      sm:justify-between
                    "
                  >
                    <div>
                      <h3
                        className="
                          font-display
                          text-xl
                          tracking-tight
                          text-fg
                        "
                      >
                        {
                          news
                            .anime
                            .name
                        }
                      </h3>

                      <p className="mt-1 text-sm text-subtle">
                        Anime relacionado
                        à notícia
                      </p>
                    </div>

                    <Link
                      to="/anime/$id"
                      params={{
                        id: news
                          .anime
                          .id,
                      }}
                      className="
                        inline-flex
                        w-fit
                        shrink-0
                        items-center
                        gap-2
                        rounded-lg
                        bg-accent
                        px-4
                        py-2
                        text-sm
                        font-semibold
                        text-white
                        transition-all
                        hover:opacity-90
                        active:scale-[0.97]
                      "
                    >
                      <Play className="size-4 fill-current" />

                      <span>
                        Assistir anime
                      </span>
                    </Link>
                  </div>

                  <div
                    className="
                      mt-5
                      grid
                      grid-cols-1
                      gap-3
                      sm:grid-cols-3
                    "
                  >
                    <div
                      className="
                        rounded-lg
                        bg-elevated
                        p-3
                      "
                    >
                      <div
                        className="
                          flex
                          items-center
                          gap-2
                          text-xs
                          text-subtle
                        "
                      >
                        <Clapperboard className="size-4" />

                        <span>
                          Temporada
                        </span>
                      </div>

                      <p
                        className="
                          mt-1
                          text-sm
                          font-medium
                          text-fg
                        "
                      >
                        {
                          news
                            .anime
                            .season
                        }
                      </p>
                    </div>

                    <div
                      className="
                        rounded-lg
                        bg-elevated
                        p-3
                      "
                    >
                      <div
                        className="
                          flex
                          items-center
                          gap-2
                          text-xs
                          text-subtle
                        "
                      >
                        <CalendarDays className="size-4" />

                        <span>
                          Lançamento
                        </span>
                      </div>

                      <p
                        className="
                          mt-1
                          text-sm
                          font-medium
                          text-fg
                        "
                      >
                        {
                          news
                            .anime
                            .releaseDate
                        }
                      </p>
                    </div>

                    <div
                      className="
                        rounded-lg
                        bg-elevated
                        p-3
                      "
                    >
                      <div
                        className="
                          flex
                          items-center
                          gap-2
                          text-xs
                          text-subtle
                        "
                      >
                        <Tv className="size-4" />

                        <span>
                          Episódios
                        </span>
                      </div>

                      <p
                        className="
                          mt-1
                          text-sm
                          font-medium
                          text-fg
                        "
                      >
                        {
                          news
                            .anime
                            .episodes ??
                          "Não informado"
                        }
                      </p>
                    </div>
                  </div>

                  <div className="mt-5">
                    <h4
                      className="
                        text-sm
                        font-semibold
                        text-fg
                      "
                    >
                      Sinopse
                    </h4>

                    <p
                      className="
                        mt-2
                        text-sm
                        leading-7
                        text-muted
                      "
                    >
                      {
                        news
                          .anime
                          .synopsis
                      }
                    </p>
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>
      </article>

      {/* MAIS NOTÍCIAS */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Newspaper className="size-5 text-accent" />

          <h2
            className="
              font-display
              text-xl
              tracking-tight
              text-fg
              sm:text-2xl
            "
          >
            Mais notícias
          </h2>
        </div>

        <div
          className="
            grid
            gap-4
            md:grid-cols-3
          "
        >
          {relatedNews.map(
            (item) => (
              <Link
                key={item.id}
                to="/news/$id"
                params={{
                  id: item.id,
                }}
                search={{
                  page,
                }}
                className="
                  group
                  overflow-hidden
                  rounded-xl
                  bg-elevated
                  shadow-[var(--shadow-border)]
                  transition-all
                  duration-200
                  hover:-translate-y-0.5
                  hover:bg-elevated/80
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
                    className="
                      size-full
                      object-contain
                      transition-transform
                      duration-300
                      group-hover:scale-105
                    "
                  />

                  <div
                    className="
                      pointer-events-none
                      absolute
                      inset-0
                      bg-linear-to-t
                      from-black/70
                      via-black/10
                      to-transparent
                    "
                  />

                  <span
                    className="
                      absolute
                      bottom-3
                      left-3
                      rounded-md
                      bg-black/60
                      px-2
                      py-1
                      text-[9px]
                      font-semibold
                      tracking-[0.1em]
                      text-white
                      uppercase
                      backdrop-blur-sm
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
                      leading-6
                      text-fg
                      transition-colors
                      group-hover:text-accent
                    "
                  >
                    {item.title}
                  </h3>

                  <div
                    className="
                      mt-3
                      flex
                      items-center
                      gap-2
                      text-[11px]
                      text-subtle
                    "
                  >
                    <CalendarDays className="size-3.5" />

                    <span>
                      {item.date}
                    </span>
                  </div>
                </div>
              </Link>
            ),
          )}
        </div>
      </section>
    </div>
  );
      }
