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
    title:
      'Novo trailer de "Sousou no Frieren" é divulgado',
    description:
      "Um novo trailer foi divulgado, trazendo novas cenas e detalhes da próxima temporada.",
    date: "22 de setembro de 2026",
    image:
      "https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=1200&q=90",
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
      "https://images.unsplash.com/photo-1618336753974-aae8e04506aa?auto=format&fit=crop&w=1200&q=90",
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
      "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=1200&q=90",
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
      "https://images.unsplash.com/photo-1612036782180-6f0b6cd846fe?auto=format&fit=crop&w=1200&q=90",
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
      "https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=1200&q=90",
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
      "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=1200&q=90",
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
      "https://images.unsplash.com/photo-1618336753974-aae8e04506aa?auto=format&fit=crop&w=1200&q=90",
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
      "https://images.unsplash.com/photo-1612036782180-6f0b6cd846fe?auto=format&fit=crop&w=1200&q=90",
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
      "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=1200&q=90",
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
      "https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=1200&q=90",
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
      "https://images.unsplash.com/photo-1618336753974-aae8e04506aa?auto=format&fit=crop&w=1200&q=90",
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
      "https://images.unsplash.com/photo-1612036782180-6f0b6cd846fe?auto=format&fit=crop&w=1200&q=90",
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
      {/* VOLTAR */}
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

      {/* TÍTULO */}
      <div>
        <div className="flex items-center gap-2">
          <Newspaper className="size-5 text-accent" />

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
        </div>

        <p className="mt-2 text-sm text-muted">
          Confira as principais novidades do mundo dos animes.
        </p>
      </div>

      {/* NOTÍCIAS */}
      <div className="space-y-5">
        {currentNews.map((news) => (
          <Link
            key={news.id}
            to="/news/$id"
            params={{
              id: news.id,
            }}
            className="
              group
              block
              overflow-hidden
              rounded-2xl
              bg-elevated
              shadow-[var(--shadow-border)]
              transition-all
              duration-200
              hover:-translate-y-0.5
              hover:bg-elevated/80
            "
          >
            <article>
              {/* IMAGEM */}
              <div
                className="
                  relative
                  aspect-video
                  w-full
                  overflow-hidden
                  bg-surface
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
                    group-hover:scale-[1.02]
                  "
                />

                <div
                  className="
                    pointer-events-none
                    absolute
                    inset-0
                    bg-linear-to-t
                    from-black/75
                    via-black/20
                    to-transparent
                  "
                />

                <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-6">
                  <span
                    className="
                      inline-flex
                      rounded-md
                      bg-black/40
                      px-2
                      py-1
                      text-[10px]
                      font-semibold
                      tracking-[0.12em]
                      text-white
                      uppercase
                      backdrop-blur-sm
                    "
                  >
                    {news.type}
                  </span>
                </div>
              </div>

              {/* CONTEÚDO */}
              <div className="p-5 sm:p-6">
                <h2
                  className="
                    font-display
                    text-xl
                    leading-tight
                    tracking-tight
                    text-fg
                    transition-colors
                    group-hover:text-accent
                    sm:text-2xl
                  "
                >
                  {news.title}
                </h2>

                <p
                  className="
                    mt-3
                    text-sm
                    leading-6
                    text-muted
                    sm:text-base
                  "
                >
                  {news.description}
                </p>

                <div
                  className="
                    mt-4
                    flex
                    items-center
                    gap-2
                    text-xs
                    text-subtle
                  "
                >
                  <CalendarDays className="size-4" />

                  <span>
                    {news.date}
                  </span>
                </div>
              </div>
            </article>
          </Link>
        ))}
      </div>

      {/* PAGINAÇÃO */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          {/* ANTERIOR */}
          <button
            type="button"
            onClick={() =>
              goToPage(currentPage - 1)
            }
            disabled={currentPage === 1}
            className="
              flex
              size-10
              items-center
              justify-center
              rounded-lg
              border
              border-border
              text-muted
              transition-colors
              hover:bg-elevated
              hover:text-fg
              disabled:pointer-events-none
              disabled:opacity-40
            "
            aria-label="Página anterior"
          >
            <ChevronLeft className="size-4" />
          </button>

          {/* PÁGINAS */}
          <div className="flex items-center gap-1">
            {Array.from(
              {
                length: totalPages,
              },
              (_, index) => index + 1,
            ).map((page) => (
              <button
                key={page}
                type="button"
                onClick={() => goToPage(page)}
                className={`
                  flex
                  size-10
                  items-center
                  justify-center
                  rounded-lg
                  text-sm
                  font-medium
                  transition-colors
                  ${
                    currentPage === page
                      ? "bg-accent text-white"
                      : "text-muted hover:bg-elevated hover:text-fg"
                  }
                `}
                aria-current={
                  currentPage === page
                    ? "page"
                    : undefined
                }
              >
                {page}
              </button>
            ))}
          </div>

          {/* PRÓXIMA */}
          <button
            type="button"
            onClick={() =>
              goToPage(currentPage + 1)
            }
            disabled={
              currentPage === totalPages
            }
            className="
              flex
              size-10
              items-center
              justify-center
              rounded-lg
              border
              border-border
              text-muted
              transition-colors
              hover:bg-elevated
              hover:text-fg
              disabled:pointer-events-none
              disabled:opacity-40
            "
            aria-label="Próxima página"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}

      {/* INDICADOR */}
      <p className="text-center text-xs text-subtle">
        Página {currentPage} de {totalPages}
      </p>
    </div>
  );
    }
