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

import { useState } from "react";

type NewsItem = {
  id: string;
  type: string;
  title: string;
  description: string;
  date: string;
  image: string;
};

const NEWS: NewsItem[] = [
  {
    id: "frieren-trailer",
    type: "TRAILER",
    title: "Frieren ganha novo trailer",
    description:
      "Novo material promocional de Frieren: Beyond Journey's End é divulgado.",
    date: "23/09/2026",
    image:
      "https://cdn.myanimelist.net/images/anime/1015/138006l.jpg",
  },
  {
    id: "one-piece-novo-episodio",
    type: "NOVO EPISÓDIO",
    title: "One Piece recebe novo episódio",
    description:
      "Confira as novidades do anime e os próximos acontecimentos da série.",
    date: "22/09/2026",
    image:
      "https://cdn.myanimelist.net/images/anime/1244/138851l.jpg",
  },
  {
    id: "filme-anime",
    type: "FILME",
    title: "Novo filme de anime ganha novidades",
    description:
      "Novas informações sobre um dos próximos lançamentos para os fãs de anime.",
    date: "21/09/2026",
    image:
      "https://cdn.myanimelist.net/images/anime/1765/135099l.jpg",
  },
  {
    id: "jujutsu-kaisen",
    type: "NOVIDADE",
    title: "Jujutsu Kaisen ganha novo visual",
    description:
      "Um novo visual promocional de Jujutsu Kaisen foi divulgado oficialmente.",
    date: "20/09/2026",
    image:
      "https://jujutsukaisen.jp/news/images/20250728_01_01.jpg",
  },
  {
    id: "demon-slayer",
    type: "FILME",
    title: "Demon Slayer recebe novidades",
    description:
      "Confira as últimas informações relacionadas ao universo de Demon Slayer.",
    date: "19/09/2026",
    image:
      "https://cdn.myanimelist.net/images/anime/1765/135099l.jpg",
  },
  {
    id: "solo-leveling",
    type: "NOVIDADE",
    title: "Solo Leveling ganha novidades",
    description:
      "Novas informações sobre Solo Leveling foram divulgadas.",
    date: "18/09/2026",
    image:
      "https://cdn.myanimelist.net/images/anime/1801/142390l.jpg",
  },
  {
    id: "bleach",
    type: "NOVIDADE",
    title: "Bleach ganha novo visual",
    description:
      "Confira as novidades de Bleach e o que vem pela frente no anime.",
    date: "17/09/2026",
    image:
      "https://cdn.myanimelist.net/images/anime/3/40451.jpg",
  },
  {
    id: "chainsaw-man",
    type: "FILME",
    title: "Chainsaw Man recebe novo material",
    description:
      "Novas imagens e informações sobre Chainsaw Man foram divulgadas.",
    date: "16/09/2026",
    image:
      "https://api-cdn.myanimelist.net/images/anime/1632/110707.jpg",
  },
  {
    id: "my-hero-academia",
    type: "NOVIDADE",
    title: "My Hero Academia ganha novidades",
    description:
      "Confira as últimas informações sobre My Hero Academia.",
    date: "15/09/2026",
    image:
      "https://cdn.myanimelist.net/images/anime/10/78745l.jpg",
  },
  {
    id: "dragon-ball",
    type: "NOVIDADE",
    title: "Dragon Ball recebe novidades",
    description:
      "Novas informações sobre o universo de Dragon Ball foram divulgadas.",
    date: "14/09/2026",
    image:
      "https://cdn.myanimelist.net/images/anime/7/74606.jpg",
  },
  {
    id: "one-punch-man",
    type: "TRAILER",
    title: "One Punch Man ganha novidades",
    description:
      "Confira as últimas informações e novidades de One Punch Man.",
    date: "13/09/2026",
    image:
      "https://cdn.myanimelist.net/images/anime/12/76049l.jpg",
  },
  {
    id: "anime-news",
    type: "NOVIDADE",
    title: "Novidades no mundo dos animes",
    description:
      "Confira mais uma seleção de novidades do mundo dos animes.",
    date: "12/09/2026",
    image:
      "https://cdn.myanimelist.net/images/anime/1244/138851l.jpg",
  },
];

const NEWS_PER_PAGE = 4;

export const Route = createFileRoute(
  "/news",
)({
  component: NewsPage,
});

function NewsPage() {
  const [currentPage, setCurrentPage] =
    useState(1);

  const totalPages = Math.ceil(
    NEWS.length / NEWS_PER_PAGE,
  );

  const startIndex =
    (currentPage - 1) * NEWS_PER_PAGE;

  const currentNews = NEWS.slice(
    startIndex,
    startIndex + NEWS_PER_PAGE,
  );

  const goToPage = (page: number) => {
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

      <div className="grid gap-5 md:grid-cols-2">
        {currentNews.map((news) => (
          <Link
            key={news.id}
            to="/news/$id"
            params={{
              id: news.id,
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
                src={news.image}
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
                {news.type}
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
                {news.title}
              </h2>

              <p
                className="
                  line-clamp-2
                  text-sm
                  leading-relaxed
                  text-muted
                "
              >
                {news.description}
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
                <span>{news.date}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>

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
            goToPage(currentPage - 1)
          }
          disabled={currentPage === 1}
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
          { length: totalPages },
          (_, index) => index + 1,
        ).map((page) => (
          <button
            key={page}
            type="button"
            onClick={() => goToPage(page)}
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
            goToPage(currentPage + 1)
          }
          disabled={
            currentPage === totalPages
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
        Página {currentPage} de {totalPages}
      </div>
    </div>
  );
    }
