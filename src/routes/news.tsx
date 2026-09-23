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
    title:
      "Diários de uma Apotecária 3ª temporada estreia em outubro",
    description:
      "A terceira temporada de Diários de uma Apotecária estreia em 2 de outubro de 2026.",
    date: "23/09/2026",
    image:
      "https://i0.wp.com/riot-us.com/wp-content/uploads/2026/09/TheApothecaryDiaries_S3_KV_16x9_3840x2160_LogoLeft_Copyright_en-US-533x300.png?ssl=1",
  },
  {
    id: "black-clover-season-2",
    type: "NOVA TEMPORADA",
    title:
      "Black Clover 2ª temporada estreia em 3 de outubro",
    description:
      "Asta e os Cavaleiros Mágicos retornam para uma nova fase da história.",
    date: "22/09/2026",
    image:
      "https://i0.wp.com/riot-us.com/wp-content/uploads/2026/09/BlackClover_S2_BaseAsset_KV_16x9_3840x2160_LogoCenter_Copyright_en-US-533x300.png?ssl=1",
  },
  {
    id: "aoashi-season-2",
    type: "NOVA TEMPORADA",
    title:
      "Aoashi 2ª temporada estreia em 4 de outubro",
    description:
      "Ashito retorna para uma nova fase defendendo o Tokyo City Esperion.",
    date: "21/09/2026",
    image:
      "https://i0.wp.com/riot-us.com/wp-content/uploads/2026/09/BlackClover_S2_BaseAsset_KV_16x9_3840x2160_LogoCenter_Copyright_en-US-533x300.png?ssl=1",
  },
  {
    id: "firefly-wedding",
    type: "ESTREIA",
    title:
      "Firefly Wedding estreia em 9 de outubro",
    description:
      "O anime baseado no mangá de Oreco Tachibana chega na nova temporada.",
    date: "20/09/2026",
    image:
      "https://cdn.myanimelist.net/images/anime/1/145923l.jpg",
  },
  {
    id: "detective-is-already-dead-season-2",
    type: "NOVA TEMPORADA",
    title:
      "The Detective Is Already Dead 2ª temporada estreia em outubro",
    description:
      "A segunda temporada chega em 7 de outubro com novos mistérios.",
    date: "19/09/2026",
    image:
      "https://cdn.myanimelist.net/images/anime/1117/116991l.jpg",
  },
  {
    id: "returners-magic-season-2",
    type: "NOVA TEMPORADA",
    title:
      "A Returner's Magic Should Be Special ganha 2ª temporada",
    description:
      "Desir e seus companheiros retornam para uma nova batalha contra os Shadow Worlds.",
    date: "18/09/2026",
    image:
      "https://cdn.myanimelist.net/images/anime/1164/138847l.jpg",
  },
  {
    id: "magic-knight-rayearth",
    type: "ESTREIA",
    title:
      "Novo Magic Knight Rayearth estreia em outubro",
    description:
      "O novo anime de Magic Knight Rayearth chega à televisão japonesa em outubro.",
    date: "17/09/2026",
    image:
      "https://cdn.myanimelist.net/images/anime/4/75531l.jpg",
  },
  {
    id: "vermilion-mask",
    type: "ESTREIA",
    title:
      "The Vermilion Mask estreia em 10 de outubro",
    description:
      "A nova série acompanha Peru em uma jornada ligada às máscaras criadas por seu mestre.",
    date: "16/09/2026",
    image:
      "https://i0.wp.com/riot-us.com/wp-content/uploads/2026/09/TheVermilionMask_S1_BaseAsset_KV_16x9_3840x2160_LogoLeft_Copyright_en-US-533x300.jpg?ssl=1",
  },
  {
    id: "psyren",
    type: "ESTREIA",
    title:
      "PSYREN entra na programação da temporada de outubro",
    description:
      "A nova adaptação de PSYREN foi anunciada para a temporada de outono e ainda aguarda uma data específica.",
    date: "15/09/2026",
    image:
      "https://i0.wp.com/riot-us.com/wp-content/uploads/2026/09/Psyren_S1_BaseAsset_TeaserVisual2_16x9_3840x2160_LogoLeft_Copyright_en-US-533x300.png?ssl=1",
  },
  {
    id: "overgeared",
    type: "ESTREIA",
    title:
      "Overgeared chega antes da temporada principal de outubro",
    description:
      "Overgeared tem estreia antecipada marcada para 27 de setembro.",
    date: "14/09/2026",
    image:
      "https://i0.wp.com/riot-us.com/wp-content/uploads/2026/09/Overgeared_S1_BaseAsset_KV1_16x9_3840x2160_LogoLeft_Copyright_en-US-533x300.png?ssl=1",
  },
  {
    id: "wild-last-boss-season-2",
    type: "NOVA TEMPORADA",
    title:
      "A Wild Last Boss Appeared! ganha 2ª temporada",
    description:
      "A segunda temporada terá uma estreia antecipada em 26 de setembro.",
    date: "13/09/2026",
    image:
      "https://i0.wp.com/riot-us.com/wp-content/uploads/2026/09/Overgeared_S1_BaseAsset_KV1_16x9_3840x2160_LogoLeft_Copyright_en-US-533x300.png?ssl=1",
  },
  {
    id: "space-mercenary",
    type: "ESTREIA",
    title:
      "Reborn as a Space Mercenary estreia em 4 de outubro",
    description:
      "A nova série acompanha um jogador que acaba vivendo dentro do universo de seu jogo.",
    date: "12/09/2026",
    image:
      "https://i0.wp.com/riot-us.com/wp-content/uploads/2026/09/Overgeared_S1_BaseAsset_KV1_16x9_3840x2160_LogoLeft_Copyright_en-US-533x300.png?ssl=1",
  },
  {
    id: "iceblade-sorcerer-season-2",
    type: "NOVA TEMPORADA",
    title:
      "The Iceblade Sorcerer Shall Rule the World II estreia em outubro",
    description:
      "Ray retorna para uma nova temporada da série de fantasia.",
    date: "11/09/2026",
    image:
      "https://cdn.myanimelist.net/images/anime/1244/132095l.jpg",
  },
  {
    id: "ace-of-diamond-second-season",
    type: "NOVA TEMPORADA",
    title:
      "Ace of the Diamond act II retorna em outubro",
    description:
      "A segunda parte da temporada continua em outubro com novos confrontos no beisebol.",
    date: "10/09/2026",
    image:
      "https://cdn.myanimelist.net/images/anime/2/83183l.jpg",
  },
  {
    id: "sasaki-and-peeps-season-2",
    type: "NOVA TEMPORADA",
    title:
      "Sasaki and Peeps 2ª temporada chega em outubro",
    description:
      "Sasaki e Peeps retornam em uma nova temporada programada para 7 de outubro.",
    date: "09/09/2026",
    image:
      "https://cdn.myanimelist.net/images/anime/1770/133033l.jpg",
  },
  {
    id: "hotel-inhumans-season-2",
    type: "NOVA TEMPORADA",
    title:
      "HOTEL INHUMANS 2ª temporada estreia em outubro",
    description:
      "O misterioso hotel retorna para uma nova temporada durante o outono de 2026.",
    date: "08/09/2026",
    image:
      "https://cdn.myanimelist.net/images/anime/1810/145641l.jpg",
  },
  {
    id: "chitose-ramune-bottle",
    type: "NOVA TEMPORADA",
    title:
      "Chitose Is in the Ramune Bottle retorna em outubro",
    description:
      "A segunda parte da série está programada para estrear em 13 de outubro.",
    date: "07/09/2026",
    image:
      "https://cdn.myanimelist.net/images/anime/1765/145936l.jpg",
  },
  {
    id: "dark-machine",
    type: "ESTREIA",
    title:
      "DARK MACHINE THE ANIMATION estreia em outubro",
    description:
      "A nova produção está programada para chegar em 13 de outubro.",
    date: "06/09/2026",
    image:
      "https://cdn.myanimelist.net/images/anime/1174/147107l.jpg",
  },
  {
    id: "dreamland",
    type: "ESTREIA",
    title:
      "Dreamland entra na programação de outubro",
    description:
      "A nova animação está programada para estrear em 16 de outubro.",
    date: "05/09/2026",
    image:
      "https://cdn.myanimelist.net/images/anime/1451/147032l.jpg",
  },
  {
    id: "fall-2026-lineup",
    type: "TEMPORADA",
    title:
      "Temporada de outubro reúne novas séries e continuações",
    description:
      "A programação de outono de 2026 reúne novas estreias e várias segundas e terceiras temporadas.",
    date: "04/09/2026",
    image:
      "https://i0.wp.com/riot-us.com/wp-content/uploads/2026/09/TheApothecaryDiaries_S3_KV_16x9_3840x2160_LogoLeft_Copyright_en-US-533x300.png?ssl=1",
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
