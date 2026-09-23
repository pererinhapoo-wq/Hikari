import {
  createFileRoute,
  Link,
  notFound,
  useSearch,
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

import { stripHtml } from "@/lib/utils";

type AnimeInfo = {
  id: string;
  name: string;
  image: string;
  synopsis: string;
  season: string;
  releaseDate: string;
  episodes: number | null;
};

type NewsItem = {
  id: string;
  type: string;
  title: string;
  description: string;
  content: string;
  date: string;
  image: string;
  animeId?: string;
  trailerUrl?: string;
  anime?: AnimeInfo;
};

type AniListMediaDetails = {
  id: number;

  title?: {
    romaji?: string | null;
    english?: string | null;
    native?: string | null;
  } | null;

  coverImage?: {
    extraLarge?: string | null;
    large?: string | null;
  } | null;

  description?: string | null;

  episodes?: number | null;

  season?: string | null;

  seasonYear?: number | null;

  startDate?: {
    year?: number | null;
    month?: number | null;
    day?: number | null;
  } | null;

  trailer?: {
    id?: string | null;
    site?: string | null;
  } | null;
};

const ANILIST =
  "https://graphql.anilist.co";

const NEWS: NewsItem[] = [
  {
    id: "frieren-trailer",
    type: "TRAILER",
    title:
      'Novo trailer de "Sousou no Frieren" é divulgado',
    description:
      "Um novo trailer foi divulgado, trazendo novas cenas e detalhes da próxima temporada.",
    content:
      'Um novo trailer de "Sousou no Frieren" foi divulgado, apresentando novas cenas e momentos inéditos da próxima temporada. O material mostra parte da jornada dos personagens e destaca diferentes situações que deverão aparecer nos próximos episódios.\n\nO novo vídeo também apresenta cenas de personagens conhecidos e alguns momentos que chamaram a atenção dos fãs. Mais detalhes sobre a história e a produção poderão ser divulgados posteriormente.',
    date: "22 de setembro de 2026",
    image:
      "https://cdn.myanimelist.net/images/anime/1015/138006l.jpg",
    trailerUrl:
      "https://www.youtube.com/embed/Fgj15FVP6IU",
    anime: {
      id: "52991",
      name: "Sousou no Frieren",
      image:
        "https://cdn.myanimelist.net/images/anime/1015/138006l.jpg",
      synopsis:
        "Durante sua jornada de dez anos para derrotar o Rei Demônio, Frieren e os membros do grupo de heróis criaram laços e memórias importantes. Após a aventura terminar, Frieren começa a perceber o verdadeiro significado daqueles momentos e decide compreender melhor os humanos e criar novas conexões.",
      season: "Outono de 2023",
      releaseDate: "29 de setembro de 2023",
      episodes: 28,
    },
  },
  {
    id: "one-piece-nova-temporada",
    type: "NOVA TEMPORADA",
    title:
      "One Piece ganha novidades sobre seu próximo arco",
    description:
      "Novas informações sobre a continuação da história foram divulgadas.",
    content:
      "Novas informações sobre o próximo arco de One Piece foram divulgadas. A atualização apresenta detalhes sobre a continuação da história e aumenta a expectativa para os próximos acontecimentos.\n\nA produção deve continuar revelando novas informações ao longo das próximas atualizações. Os fãs poderão acompanhar as novidades conforme novos materiais forem publicados.",
    date: "21 de setembro de 2026",
    image:
      "https://cdn.myanimelist.net/images/anime/1244/138851l.jpg",
  },
  {
    id: "anime-filme",
    type: "FILME",
    title:
      "Novo filme de anime recebe data de estreia",
    description:
      "A produção ganhou uma nova atualização e teve sua data de estreia anunciada.",
    content:
      "Um novo filme de anime recebeu uma atualização importante com a divulgação de sua data de estreia. A produção vinha sendo aguardada pelos fãs e agora possui uma nova previsão para chegar ao público.\n\nNovas informações sobre a equipe, personagens e materiais promocionais poderão ser divulgadas antes da estreia. O filme também deverá receber novos trailers e imagens promocionais.",
    date: "20 de setembro de 2026",
    image:
      "https://cdn.myanimelist.net/images/anime/1765/135099l.jpg",
  },
  {
    id: "novo-episodio",
    type: "NOVO EPISÓDIO",
    title:
      "Novo episódio de uma das séries mais populares chega esta semana",
    description:
      "O próximo episódio já tem data prevista e novas informações foram divulgadas.",
    content:
      "O próximo episódio da série já possui uma data prevista para lançamento. A atualização também trouxe novas informações sobre o que os espectadores poderão encontrar no próximo capítulo.\n\nA expectativa aumenta com a chegada do novo episódio, que deverá continuar os acontecimentos apresentados anteriormente. Novas informações podem ser divulgadas antes da publicação.",
    date: "19 de setembro de 2026",
    image:
      "https://cdn.myanimelist.net/images/anime/1801/142390l.jpg",
  },
  {
    id: "jujutsu-novidades",
    type: "NOVIDADES",
    title:
      "Jujutsu Kaisen recebe novas informações sobre a produção",
    description:
      "A produção divulgou novas informações para os fãs da série.",
    content:
      "A produção de Jujutsu Kaisen recebeu uma nova atualização. As informações divulgadas apresentam novidades relacionadas ao futuro da série e aos próximos materiais que deverão ser publicados.\n\nOs fãs poderão acompanhar novas imagens, vídeos e outros anúncios conforme a produção avançar. Mais detalhes serão adicionados quando novas informações oficiais forem disponibilizadas.",
    date: "18 de setembro de 2026",
    image:
      "https://jujutsukaisen.jp/news/images/20250728_01_01.jpg",
  },
  {
    id: "demon-slayer-filme",
    type: "FILME",
    title:
      "Novo projeto de Demon Slayer ganha novidades",
    description:
      "Novos detalhes do próximo projeto foram revelados.",
    content:
      "O próximo projeto relacionado a Demon Slayer recebeu novas informações. A atualização apresenta detalhes adicionais sobre a produção e aumenta a expectativa para os próximos materiais promocionais.\n\nNovas imagens, vídeos e informações sobre o projeto poderão ser divulgados posteriormente. O público poderá acompanhar as novidades conforme o lançamento se aproxima.",
    date: "17 de setembro de 2026",
    image:
      "https://cdn.myanimelist.net/images/anime/1765/135099l.jpg",
  },
  {
    id: "solo-leveling",
    type: "NOVA TEMPORADA",
    title:
      "Solo Leveling recebe atualização sobre sua próxima temporada",
    description:
      "A equipe de produção divulgou novas informações sobre a continuação.",
    content:
      "A próxima temporada de Solo Leveling recebeu uma nova atualização. As informações divulgadas trazem novidades sobre a continuação da produção e sobre os próximos materiais que serão apresentados aos fãs.\n\nA expectativa para a nova temporada continua crescendo, enquanto novas imagens e informações podem ser divulgadas durante os próximos anúncios.",
    date: "16 de setembro de 2026",
    image:
      "https://cdn.myanimelist.net/images/anime/1801/142390l.jpg",
  },
  {
    id: "bleach-news",
    type: "NOVIDADES",
    title:
      "Bleach ganha novas informações sobre seus próximos episódios",
    description:
      "Novos detalhes foram divulgados sobre a continuação da série.",
    content:
      "Novas informações sobre os próximos episódios de Bleach foram divulgadas. A atualização apresenta detalhes sobre a continuação da história e sobre os próximos acontecimentos da série.\n\nMais materiais promocionais poderão ser publicados durante as próximas atualizações. Os fãs poderão acompanhar as novidades conforme novos anúncios forem realizados.",
    date: "15 de setembro de 2026",
    image:
      "https://cdn.myanimelist.net/images/anime/3/40451.jpg",
  },
  {
    id: "chainsaw-man-filme",
    type: "FILME",
    title:
      "Chainsaw Man recebe novidades sobre seu filme",
    description:
      "O projeto ganhou novas informações e detalhes de produção.",
    content:
      "O filme de Chainsaw Man recebeu novas informações relacionadas ao seu desenvolvimento. A atualização apresenta detalhes adicionais sobre o projeto e seus próximos materiais promocionais.\n\nNovas imagens, vídeos e anúncios poderão ser divulgados antes do lançamento. O público poderá acompanhar as próximas atualizações conforme a produção avançar.",
    date: "14 de setembro de 2026",
    image:
      "https://api-cdn.myanimelist.net/images/anime/1632/110707.jpg",
  },
  {
    id: "my-hero-academia",
    type: "NOVA TEMPORADA",
    title:
      "My Hero Academia recebe novidades da próxima fase",
    description:
      "Novas informações sobre a produção foram divulgadas.",
    content:
      "My Hero Academia recebeu novas informações relacionadas à sua próxima fase. A atualização apresenta novidades sobre a produção e sobre os próximos conteúdos que deverão ser disponibilizados.\n\nNovos materiais promocionais poderão trazer mais detalhes sobre os personagens e acontecimentos da continuação. Outras informações serão divulgadas conforme novos anúncios forem realizados.",
    date: "13 de setembro de 2026",
    image:
      "https://cdn.myanimelist.net/images/anime/10/78745l.jpg",
  },
  {
    id: "dragon-ball",
    type: "NOVIDADES",
    title:
      "Dragon Ball ganha novas informações para os fãs",
    description:
      "A franquia recebeu uma nova atualização nesta semana.",
    content:
      "Dragon Ball recebeu uma nova atualização com informações para os fãs da franquia. O anúncio apresenta novidades sobre os próximos conteúdos e mantém a comunidade acompanhando os futuros projetos.\n\nNovas informações poderão surgir nas próximas atualizações, incluindo materiais promocionais, imagens e outros anúncios relacionados à franquia.",
    date: "12 de setembro de 2026",
    image:
      "https://cdn.myanimelist.net/images/anime/7/74606.jpg",
  },
  {
    id: "one-punch-man",
    type: "TRAILER",
    title:
      "Novo trailer de One Punch Man é divulgado",
    description:
      "O novo vídeo apresenta cenas inéditas e detalhes da produção.",
    content:
      "Um novo trailer de One Punch Man foi divulgado, apresentando cenas inéditas e novos detalhes da produção. O vídeo reúne diferentes momentos da série e mostra parte do conteúdo que deverá aparecer nos próximos episódios.\n\nO material promocional também aumenta a expectativa para a continuação. Novas informações poderão ser divulgadas durante os próximos anúncios da produção.",
    date: "11 de setembro de 2026",
    image:
      "https://cdn.myanimelist.net/images/anime/12/76049l.jpg",
  },
];

function titleOf(
  media: AniListMediaDetails,
): string {
  return (
    media.title?.english ||
    media.title?.romaji ||
    media.title?.native ||
    "Anime"
  );
}

function formatAnimeSeason(
  season:
    | string
    | null
    | undefined,
  year:
    | number
    | null
    | undefined,
): string {
  const names: Record<
    string,
    string
  > = {
    WINTER: "Inverno",
    SPRING: "Primavera",
    SUMMER: "Verão",
    FALL: "Outono",
  };

  const translated =
    season
      ? names[
          season.toUpperCase()
        ] ?? season
      : "Não informado";

  return year
    ? `${translated} de ${year}`
    : translated;
}

function formatAnimeDate(
  date:
    | AniListMediaDetails["startDate"]
    | null
    | undefined,
): string {
  if (
    !date?.year ||
    !date.month ||
    !date.day
  ) {
    return "Não informado";
  }

  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    },
  ).format(
    new Date(
      date.year,
      date.month - 1,
      date.day,
    ),
  );
}

async function translateSynopsis(
  text: string,
): Promise<string> {
  const cleaned =
    stripHtml(
      text,
    ).trim();

  if (!cleaned) {
    return "Sinopse não disponível.";
  }

  try {
    const url =
      "https://translate.googleapis.com/translate_a/single" +
      "?client=gtx" +
      "&sl=auto" +
      "&tl=pt" +
      "&dt=t" +
      `&q=${encodeURIComponent(
        cleaned.slice(0, 5000),
      )}`;

    const response =
      await fetch(
        url,
        {
          signal:
            AbortSignal.timeout(
              8000,
            ),
        },
      );

    if (!response.ok) {
      return cleaned;
    }

    const json =
      (await response.json()) as unknown;

    if (
      !Array.isArray(json) ||
      !Array.isArray(json[0])
    ) {
      return cleaned;
    }

    const translated =
      json[0]
        .filter(
          (part) =>
            Array.isArray(part) &&
            typeof part[0] ===
              "string",
        )
        .map(
          (part) =>
            part[0] as string,
        )
        .join("")
        .trim();

    return translated ||
      cleaned;
  } catch {
    return cleaned;
  }
}

async function fetchAnimeInfo(
  animeId: number,
): Promise<AnimeInfo | null> {
  try {
    const response =
      await fetch(
        ANILIST,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            Accept:
              "application/json",
          },

          body: JSON.stringify({
            query: `
              query AnimeDetails(
                $id: Int
              ) {
                Media(
                  id: $id
                  type: ANIME
                ) {
                  id

                  title {
                    romaji
                    english
                    native
                  }

                  coverImage {
                    extraLarge
                    large
                  }

                  description(
                    asHtml: false
                  )

                  episodes

                  season

                  seasonYear

                  startDate {
                    year
                    month
                    day
                  }
                }
              }
            `,

            variables: {
              id: animeId,
            },
          }),

          signal:
            AbortSignal.timeout(
              10000,
            ),
        },
      );

    if (!response.ok) {
      return null;
    }

    const json =
      (await response.json()) as {
        data?: {
          Media?: AniListMediaDetails | null;
        };

        errors?: {
          message?: string;
        }[];
      };

    const media =
      json.data?.Media;

    if (!media) {
      return null;
    }

    const synopsis =
      await translateSynopsis(
        media.description ??
          "",
      );

    return {
      id: String(
        media.id,
      ),

      name:
        titleOf(
          media,
        ),

      image:
        media.coverImage
          ?.extraLarge ||
        media.coverImage
          ?.large ||
        "",

      synopsis,

      season:
        formatAnimeSeason(
          media.season,
          media.seasonYear,
        ),

      releaseDate:
        formatAnimeDate(
          media.startDate,
        ),

      episodes:
        media.episodes ??
        null,
    };
  } catch {
    return null;
  }
}

export const Route = createFileRoute(
  "/news/$id",
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
    const automaticNews =
      await fetchAutomaticNews();

    const automaticItem =
      automaticNews.find(
        (item) =>
          item.id ===
          params.id,
      );

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
  let content =
    item.description;

  if (
    item.type ===
    "NOVO EPISÓDIO"
  ) {
    content =
      `${item.description}\n\n` +
      `Este episódio faz parte da programação atual de ${anime?.name ?? "este anime"}. ` +
      `Acompanhe a página do anime para encontrar os episódios disponíveis no Hikari.`;
  } else if (
    item.type ===
    "TRAILER"
  ) {
    content =
      `${item.description}\n\n` +
      `O trailer foi identificado automaticamente a partir dos dados disponíveis para ${anime?.name ?? "este anime"}. ` +
      `Novas informações poderão aparecer conforme os dados forem atualizados.`;
  } else {
    content =
      `${item.description}\n\n` +
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

    image:
      item.image,

    animeId:
      item.animeId,

    trailerUrl:
      item.trailerUrl,

    anime:
      anime ?? undefined,
  };
}

function NewsDetailsPage() {
  const { id } =
    Route.useParams();

  const { page } =
    Route.useSearch();

  const {
    automaticNews,
    automaticAnime,
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

  /*
   * Escolhe notícias diferentes conforme
   * a notícia atualmente aberta.
   *
   * Em vez de sempre pegar as primeiras 3,
   * encontramos a posição da notícia atual
   * e pegamos as próximas 3.
   *
   * Quando chegar ao final da lista,
   * volta para o começo automaticamente.
   */
  const currentNewsIndex =
    allNews.findIndex(
      (item) =>
        item.id === news.id,
    );

  const relatedNews =
    currentNewsIndex >= 0
      ? Array.from(
          {
            length: Math.min(
              3,
              Math.max(
                allNews.length - 1,
                0,
              ),
            ),
          },
          (_, index) => {
            const nextIndex =
              (currentNewsIndex +
                index +
                1) %
              allNews.length;

            return allNews[
              nextIndex
            ];
          },
        )
      : allNews
          .filter(
            (item) =>
              item.id !==
              news.id,
          )
          .slice(0, 3);

  return (
    <div className="space-y-6 pb-10">
      {/* VOLTAR */}
      <Link
        to="/news"
        search={{
          page,
        }}
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
            bg-surface
          "
        >
          <img
            src={news.image}
            alt=""
            className="
              size-full
              object-cover
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
              {news.date}
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
                    alt={item.title}
                    className="
                      size-full
                      object-cover
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
