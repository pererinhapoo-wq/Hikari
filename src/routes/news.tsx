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
    id: "apothecary-diaries-season-3",
    type: "NOVA TEMPORADA",
    title: "Diários de uma Apotecária 3ª temporada estreia em outubro",
    description:
      "A 3ª temporada de Diários de uma Apotecária estreia em 2 de outubro de 2026.",
    date: "23/09/2026",
    image:
      "https://cdn.myanimelist.net/images/anime/1898/146069l.jpg",
  },
  {
    id: "black-clover-season-2",
    type: "NOVA TEMPORADA",
    title: "Black Clover 2ª temporada estreia em 3 de outubro",
    description:
      "Asta e os Cavaleiros Mágicos retornam com a 2ª temporada de Black Clover.",
    date: "22/09/2026",
    image:
      "https://cdn.myanimelist.net/images/anime/2/67057l.jpg",
  },
  {
    id: "aoashi-season-2",
    type: "NOVA TEMPORADA",
    title: "Aoashi 2ª temporada chega em outubro",
    description:
      "Ashito Aoi retorna para uma nova fase no futebol de elite a partir de 4 de outubro.",
    date: "21/09/2026",
    image:
      "https://cdn.myanimelist.net/images/anime/1291/123462l.jpg",
  },
  {
    id: "firefly-wedding",
    type: "ESTREIA",
    title: "Firefly Wedding estreia em outubro",
    description:
      "A adaptação de Firefly Wedding está entre as novas séries da temporada de outubro.",
    date: "20/09/2026",
    image:
      "https://cdn.myanimelist.net/images/manga/1/271069l.jpg",
  },
  {
    id: "returners-magic-season-2",
    type: "NOVA TEMPORADA",
    title: "A Returner's Magic Should Be Special ganha 2ª temporada",
    description:
      "Desir retorna para tentar mudar novamente o futuro na nova temporada.",
    date: "19/09/2026",
    image:
      "https://cdn.myanimelist.net/images/anime/1164/138847l.jpg",
  },
  {
    id: "detective-is-already-dead-season-2",
    type: "NOVA TEMPORADA",
    title: "The Detective Is Already Dead 2ª temporada estreia em outubro",
    description:
      "Os mistérios continuam para Kimihiko na segunda temporada da série.",
    date: "18/09/2026",
    image:
      "https://cdn.myanimelist.net/images/anime/1117/116991l.jpg",
  },
  {
    id: "iceblade-sorcerer-season-2",
    type: "NOVA TEMPORADA",
    title: "The Iceblade Sorcerer Shall Rule the World II chega em outubro",
    description:
      "Ray e seus amigos retornam para uma nova temporada cheia de conflitos.",
    date: "17/09/2026",
    image:
      "https://cdn.myanimelist.net/images/anime/1244/132095l.jpg",
  },
  {
    id: "dragon-ball-super-beerus",
    type: "ESTREIA",
    title: "Dragon Ball Super: Beerus estreia em outubro",
    description:
      "Um novo projeto de Dragon Ball Super está programado para chegar em 11 de outubro.",
    date: "16/09/2026",
    image:
      "https://cdn.myanimelist.net/images/anime/7/74606l.jpg",
  },
  {
    id: "magic-knight-rayearth",
    type: "ESTREIA",
    title: "Magic Knight Rayearth retorna na temporada de outubro",
    description:
      "O clássico Magic Knight Rayearth está entre os títulos programados para a temporada de outono.",
    date: "15/09/2026",
    image:
      "https://cdn.myanimelist.net/images/anime/4/75531l.jpg",
  },
  {
    id: "ace-of-diamond-act-ii",
    type: "NOVA TEMPORADA",
    title: "Ace of Diamond act II retorna em outubro",
    description:
      "A nova fase de Ace of Diamond act II está prevista para estrear em 11 de outubro.",
    date: "14/09/2026",
    image:
      "https://cdn.myanimelist.net/images/anime/2/83183l.jpg",
  },
  {
    id: "psyren",
    type: "ESTREIA",
    title: "PSYREN está entre as novas estreias de outubro",
    description:
      "A adaptação de PSYREN chega à temporada de outubro de 2026 com nova produção em anime.",
    date: "13/09/2026",
    image:
      "https://cdn.myanimelist.net/images/manga/3/251792l.jpg",
  },
  {
    id: "overgeared",
    type: "ESTREIA",
    title: "Overgeared estreia na temporada de outubro",
    description:
      "Grid ganha uma nova vida ao se tornar herdeiro de um lendário ferreiro.",
    date: "12/09/2026",
    image:
      "https://cdn.myanimelist.net/images/anime/1143/145969l.jpg",
  },
  {
    id: "space-mercenary",
    type: "ESTREIA",
    title: "Reborn as a Space Mercenary estreia em outubro",
    description:
      "Um jogador acorda dentro do universo de seu jogo favorito e parte para aventuras espaciais.",
    date: "11/09/2026",
    image:
      "https://cdn.myanimelist.net/images/manga/1/276814l.jpg",
  },
  {
    id: "wild-last-boss-season-2",
    type: "NOVA TEMPORADA",
    title: "A Wild Last Boss Appeared! ganha 2ª temporada",
    description:
      "A série retorna com uma nova fase na temporada de outono de 2026.",
    date: "10/09/2026",
    image:
      "https://cdn.myanimelist.net/images/anime/1714/147441l.jpg",
  },
  {
    id: "salty-koharu",
    type: "ESTREIA",
    title: "The Salty Koharu Has a Soft Spot for Me estreia em outubro",
    description:
      "A nova comédia romântica está programada para chegar no início de outubro.",
    date: "09/09/2026",
    image:
      "https://cdn.myanimelist.net/images/anime/1174/147107l.jpg",
  },
  {
    id: "vermilion-mask",
    type: "ESTREIA",
    title: "The Vermilion Mask estreia em outubro",
    description:
      "A nova série está programada para estrear em 10 de outubro de 2026.",
    date: "08/09/2026",
    image:
      "https://cdn.myanimelist.net/images/anime/1015/147156l.jpg",
  },
  {
    id: "return-of-the-great-witch",
    type: "TEMPORADA",
    title: "A temporada de outubro traz dezenas de novos animes",
    description:
      "A programação de outono de 2026 reúne novas séries e várias continuações.",
    date: "07/09/2026",
    image:
      "https://cdn.myanimelist.net/images/anime/1451/147032l.jpg",
  },
  {
    id: "october-anime-lineup",
    type: "TEMPORADA",
    title: "Confira alguns dos animes que chegam em outubro",
    description:
      "Black Clover, Diários de uma Apotecária, Aoashi e outras séries estão confirmadas para a nova temporada.",
    date: "06/09/2026",
    image:
      "https://cdn.myanimelist.net/images/anime/1898/146069l.jpg",
  },
  {
    id: "fall-2026-anime",
    type: "TEMPORADA",
    title: "Temporada de Outono 2026 ganha programação atualizada",
    description:
      "A lista de lançamentos de outubro continua recebendo novos títulos e informações.",
    date: "05/09/2026",
    image:
      "https://cdn.myanimelist.net/images/anime/2/67057l.jpg",
  },
  {
    id: "anime-october-preview",
    type: "PRÓXIMAS ESTREIAS",
    title: "Outubro promete uma nova temporada cheia de estreias",
    description:
      "Veja os principais animes que estão chegando nas próximas semanas.",
    date: "04/09/2026",
    image:
      "https://cdn.myanimelist.net/images/anime/1291/123462l.jpg",
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

      <div
        className="
          grid
          gap-5
          md:grid-cols-2
          xl:grid-cols-3
        "
      >
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
