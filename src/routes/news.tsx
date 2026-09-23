import {
  createFileRoute,
  Link,
} from "@tanstack/react-router";

import { useState } from "react";

import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Newspaper,
} from "lucide-react";

export const Route = createFileRoute(
  "/news",
)({
  component: NewsPage,
});

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
    title:
      'Novo trailer de "Sousou no Frieren" é divulgado',
    description:
      "Um novo trailer foi divulgado, trazendo novas cenas e detalhes da próxima temporada.",
    date: "22 de setembro de 2026",
    image:
      "https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=900&q=85",
  },
  {
    id: "one-piece-nova-temporada",
    type: "NOVA TEMPORADA",
    title:
      "One Piece ganha novidades sobre seu próximo arco",
    description:
      "Novas informações sobre a continuação da história foram divulgadas.",
    date: "21 de setembro de 2026",
    image:
      "https://images.unsplash.com/photo-1618336753974-aae8e04506aa?auto=format&fit=crop&w=900&q=85",
  },
  {
    id: "anime-filme",
    type: "FILME",
    title:
      "Novo filme de anime recebe data de estreia",
    description:
      "A produção ganhou uma nova atualização e teve sua data de estreia anunciada.",
    date: "20 de setembro de 2026",
    image:
      "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=900&q=85",
  },
  {
    id: "novo-episodio",
    type: "NOVO EPISÓDIO",
    title:
      "Novo episódio de uma das séries mais populares chega esta semana",
    description:
      "O próximo episódio já tem data prevista e novas informações foram divulgadas.",
    date: "19 de setembro de 2026",
    image:
      "https://images.unsplash.com/photo-1612036782180-6f0b6cd846fe?auto=format&fit=crop&w=900&q=85",
  },
  {
    id: "jujutsu-novidades",
    type: "NOVIDADES",
    title:
      "Jujutsu Kaisen recebe novas informações sobre a produção",
    description:
      "A produção divulgou novas informações para os fãs da série.",
    date: "18 de setembro de 2026",
    image:
      "https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=900&q=85",
  },
  {
    id: "demon-slayer-filme",
    type: "FILME",
    title:
      "Novo projeto de Demon Slayer ganha novidades",
    description:
      "Novos detalhes do próximo projeto foram revelados.",
    date: "17 de setembro de 2026",
    image:
      "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=900&q=85",
  },
  {
    id: "solo-leveling",
    type: "NOVA TEMPORADA",
    title:
      "Solo Leveling recebe atualização sobre sua próxima temporada",
    description:
      "A equipe de produção divulgou novas informações sobre a continuação.",
    date: "16 de setembro de 2026",
    image:
      "https://images.unsplash.com/photo-1618336753974-aae8e04506aa?auto=format&fit=crop&w=900&q=85",
  },
  {
    id: "bleach-news",
    type: "NOVIDADES",
    title:
      "Bleach ganha novas informações sobre seus próximos episódios",
    description:
      "Novos detalhes foram divulgados sobre a continuação da série.",
    date: "15 de setembro de 2026",
    image:
      "https://images.unsplash.com/photo-1612036782180-6f0b6cd846fe?auto=format&fit=crop&w=900&q=85",
  },
  {
    id: "chainsaw-man-filme",
    type: "FILME",
    title:
      "Chainsaw Man recebe novidades sobre seu filme",
    description:
      "O projeto ganhou novas informações e detalhes de produção.",
    date: "14 de setembro de 2026",
    image:
      "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=900&q=85",
  },
  {
    id: "my-hero-academia",
    type: "NOVA TEMPORADA",
    title:
      "My Hero Academia recebe novidades da próxima fase",
    description:
      "Novas informações sobre a produção foram divulgadas.",
    date: "13 de setembro de 2026",
    image:
      "https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=900&q=85",
  },
  {
    id: "dragon-ball",
    type: "NOVIDADES",
    title:
      "Dragon Ball ganha novas informações para os fãs",
    description:
      "A franquia recebeu uma nova atualização nesta semana.",
    date: "12 de setembro de 2026",
    image:
      "https://images.unsplash.com/photo-1618336753974-aae8e04506aa?auto=format&fit=crop&w=900&q=85",
  },
  {
    id: "one-punch-man",
    type: "TRAILER",
    title:
      "Novo trailer de One Punch Man é divulgado",
    description:
      "O novo vídeo apresenta cenas inéditas e detalhes da produção.",
    date: "11 de setembro de 2026",
    image:
      "https://images.unsplash.com/photo-1612036782180-6f0b6cd846fe?auto=format&fit=crop&w=900&q=85",
  },
];

const NEWS_PER_PAGE = 4;

function NewsPage() {
  const [currentPage, setCurrentPage] = useState(1);

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
    if (page < 1 || page > totalPages) {
      return;
    }

    setCurrentPage(page);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <div className="space-y-6 pb-8">
      {/* CABEÇALHO */}
      <section className="space-y-4">
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
              size-11
              shrink-0
              items-center
              justify-center
              rounded-xl
              bg-elevated
            "
          >
            <Newspaper className="size-5 text-fg" />
          </div>

          <div className="min-w-0">
            <h1
              className="
                font-display
                text-2xl
                tracking-tight
                text-fg
                sm:text-3xl
              "
            >
              Notícias
            </h1>

            <p className="mt-1 text-sm text-muted">
              Todas as novidades do mundo dos animes,
              em um só lugar.
            </p>
          </div>
        </div>
      </section>

      {/* LISTA DE NOTÍCIAS */}
      <section className="space-y-3">
        {currentNews.map((news) => (
          <Link
            key={news.id}
            to="/"
            className="
              group
              block
              overflow-hidden
              rounded-2xl
              bg-elevated
              shadow-[var(--shadow-border)]
              transition
              hover:bg-surface
            "
          >
            <article
              className="
                flex
                min-w-0
                flex-col
                sm:flex-row
              "
            >
              {/* IMAGEM */}
              <div
                className="
                  relative
                  aspect-video
                  w-full
                  shrink-0
                  overflow-hidden
                  bg-surface
                  sm:aspect-auto
                  sm:h-[170px]
                  sm:w-[290px]
                "
              >
                <img
                  src={news.image}
                  alt=""
                  className="
                    size-full
                    object-cover
                    transition-transform
                    duration-500
                    group-hover:scale-[1.03]
                  "
                />

                <div
                  className="
                    pointer-events-none
                    absolute
                    inset-0
                    bg-linear-to-t
                    from-black/35
                    to-transparent
                  "
                />
              </div>

              {/* CONTEÚDO */}
              <div
                className="
                  flex
                  min-w-0
                  flex-1
                  flex-col
                  justify-center
                  p-4
                  sm:p-5
                "
              >
                <div className="flex items-center justify-between gap-3">
                  <span
                    className="
                      inline-flex
                      w-fit
                      rounded-md
                      bg-accent/15
                      px-2
                      py-1
                      text-[9px]
                      font-semibold
                      tracking-[0.12em]
                      text-accent
                      uppercase
                      sm:text-[10px]
                    "
                  >
                    {news.type}
                  </span>

                  <ArrowRight
                    className="
                      size-4
                      shrink-0
                      text-muted
                      transition-transform
                      group-hover:translate-x-1
                      group-hover:text-fg
                    "
                  />
                </div>

                <h2
                  className="
                    mt-3
                    line-clamp-2
                    font-display
                    text-lg
                    leading-snug
                    tracking-tight
                    text-fg
                    sm:text-xl
                  "
                >
                  {news.title}
                </h2>

                <p
                  className="
                    mt-2
                    line-clamp-2
                    text-xs
                    leading-relaxed
                    text-muted
                    sm:text-sm
                  "
                >
                  {news.description}
                </p>

                <div
                  className="
                    mt-3
                    flex
                    items-center
                    gap-1.5
                    text-[11px]
                    text-subtle
                  "
                >
                  <CalendarDays className="size-3.5" />
                  <span>{news.date}</span>
                </div>
              </div>
            </article>
          </Link>
        ))}
      </section>

      {/* PAGINAÇÃO */}
      <section
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
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage === 1}
          className="
            inline-flex
            size-10
            items-center
            justify-center
            rounded-xl
            bg-elevated
            text-muted
            transition
            hover:bg-surface
            hover:text-fg
            disabled:pointer-events-none
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
              rounded-xl
              text-sm
              font-semibold
              transition
              ${
                currentPage === page
                  ? "bg-accent text-white"
                  : "bg-elevated text-muted hover:bg-surface hover:text-fg"
              }
            `}
            aria-label={`Página ${page}`}
            aria-current={
              currentPage === page
                ? "page"
                : undefined
            }
          >
            {page}
          </button>
        ))}

        <button
          type="button"
          onClick={() => goToPage(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="
            inline-flex
            size-10
            items-center
            justify-center
            rounded-xl
            bg-elevated
            text-muted
            transition
            hover:bg-surface
            hover:text-fg
            disabled:pointer-events-none
            disabled:opacity-40
          "
          aria-label="Próxima página"
        >
          <ChevronRight className="size-4" />
        </button>
      </section>
    </div>
  );
    }
