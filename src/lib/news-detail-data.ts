import { stripHtml } from "@/lib/utils";

export type AnimeInfo = {
  id: string;
  name: string;
  image: string;
  synopsis: string;
  season: string;
  releaseDate: string;
  episodes: number | null;
};

export type NewsItem = {
  id: string;
  type: string;
  title: string;
  description: string;
  content: string;
  date: string;
  time?: string;
  image: string;
  source?: string;
  animeId?: string;
  trailerUrl?: string;
  isAdult?: boolean;
  articleImages?: string[];
  mentionedHentai?: {
    title: string;
    image: string;
  }[];
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

const ANILIST = "https://graphql.anilist.co";

export const NEWS: NewsItem[] = [
  {
    id: "frieren-trailer",
    type: "TRAILER",
    title: 'Novo trailer de "Sousou no Frieren" é divulgado',
    description:
      "Um novo trailer foi divulgado, trazendo novas cenas e detalhes da próxima temporada.",
    content:
      'Um novo trailer de "Sousou no Frieren" foi divulgado, apresentando novas cenas e momentos inéditos da próxima temporada. O material mostra parte da jornada dos personagens e destaca diferentes situações que deverão aparecer nos próximos episódios.\n\nO novo vídeo também apresenta cenas de personagens conhecidos e alguns momentos que chamaram a atenção dos fãs. Mais detalhes sobre a história e a produção poderão ser divulgados posteriormente.',
    date: "22 de setembro de 2026",
    image: "https://cdn.myanimelist.net/images/anime/1015/138006l.jpg",
    trailerUrl: "https://www.youtube.com/embed/Fgj15FVP6IU",
    anime: {
      id: "52991",
      name: "Sousou no Frieren",
      image: "https://cdn.myanimelist.net/images/anime/1015/138006l.jpg",
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
    title: "One Piece ganha novidades sobre seu próximo arco",
    description:
      "Novas informações sobre a continuação da história foram divulgadas.",
    content:
      "Novas informações sobre o próximo arco de One Piece foram divulgadas. A atualização apresenta detalhes sobre a continuação da história e aumenta a expectativa para os próximos acontecimentos.\n\nA produção deve continuar revelando novas informações ao longo das próximas atualizações. Os fãs poderão acompanhar as novidades conforme novos materiais forem publicados.",
    date: "21 de setembro de 2026",
    image: "https://cdn.myanimelist.net/images/anime/1244/138851l.jpg",
  },
  {
    id: "anime-filme",
    type: "FILME",
    title: "Novo filme de anime recebe data de estreia",
    description:
      "A produção ganhou uma nova atualização e teve sua data de estreia anunciada.",
    content:
      "Um novo filme de anime recebeu uma atualização importante com a divulgação de sua data de estreia. A produção vinha sendo aguardada pelos fãs e agora possui uma nova previsão para chegar ao público.\n\nNovas informações sobre a equipe, personagens e materiais promocionais poderão ser divulgadas antes da estreia. O filme também deverá receber novos trailers e imagens promocionais.",
    date: "20 de setembro de 2026",
    image: "https://cdn.myanimelist.net/images/anime/1765/135099l.jpg",
  },
  {
    id: "novo-episodio",
    type: "NOVO EPISÓDIO",
    title: "Novo episódio de uma das séries mais populares chega esta semana",
    description:
      "O próximo episódio já tem data prevista e novas informações foram divulgadas.",
    content:
      "O próximo episódio da série já possui uma data prevista para lançamento. A atualização também trouxe novas informações sobre o que os espectadores poderão encontrar no próximo capítulo.\n\nA expectativa aumenta com a chegada do novo episódio, que deverá continuar os acontecimentos apresentados anteriormente. Novas informações podem ser divulgadas antes da publicação.",
    date: "19 de setembro de 2026",
    image: "https://cdn.myanimelist.net/images/anime/1801/142390l.jpg",
  },
  {
    id: "jujutsu-novidades",
    type: "NOVIDADES",
    title: "Jujutsu Kaisen recebe novas informações sobre a produção",
    description: "A produção divulgou novas informações para os fãs da série.",
    content:
      "A produção de Jujutsu Kaisen recebeu uma nova atualização. As informações divulgadas apresentam novidades relacionadas ao futuro da série e aos próximos materiais que deverão ser publicados.\n\nOs fãs poderão acompanhar novas imagens, vídeos e outros anúncios conforme a produção avançar. Mais detalhes serão adicionados quando novas informações oficiais forem disponibilizadas.",
    date: "18 de setembro de 2026",
    image: "https://jujutsukaisen.jp/news/images/20250728_01_01.jpg",
  },
  {
    id: "demon-slayer-filme",
    type: "FILME",
    title: "Novo projeto de Demon Slayer ganha novidades",
    description: "Novos detalhes do próximo projeto foram revelados.",
    content:
      "O próximo projeto relacionado a Demon Slayer recebeu novas informações. A atualização apresenta detalhes adicionais sobre a produção e aumenta a expectativa para os próximos materiais promocionais.\n\nNovas imagens, vídeos e informações sobre o projeto poderão ser divulgados posteriormente. O público poderá acompanhar as novidades conforme o lançamento se aproxima.",
    date: "17 de setembro de 2026",
    image: "https://cdn.myanimelist.net/images/anime/1765/135099l.jpg",
  },
  {
    id: "solo-leveling",
    type: "NOVA TEMPORADA",
    title: "Solo Leveling recebe atualização sobre sua próxima temporada",
    description:
      "A equipe de produção divulgou novas informações sobre a continuação.",
    content:
      "A próxima temporada de Solo Leveling recebeu uma nova atualização. As informações divulgadas trazem novidades sobre a continuação da produção e sobre os próximos materiais que serão apresentados aos fãs.\n\nA expectativa para a nova temporada continua crescendo, enquanto novas imagens e informações podem ser divulgadas durante os próximos anúncios.",
    date: "16 de setembro de 2026",
    image: "https://cdn.myanimelist.net/images/anime/1801/142390l.jpg",
  },
  {
    id: "bleach-news",
    type: "NOVIDADES",
    title: "Bleach ganha novas informações sobre seus próximos episódios",
    description:
      "Novos detalhes foram divulgados sobre a continuação da série.",
    content:
      "Novas informações sobre os próximos episódios de Bleach foram divulgadas. A atualização apresenta detalhes sobre a continuação da história e sobre os próximos acontecimentos da série.\n\nMais materiais promocionais poderão ser publicados durante as próximas atualizações. Os fãs poderão acompanhar as novidades conforme novos anúncios forem realizados.",
    date: "15 de setembro de 2026",
    image: "https://cdn.myanimelist.net/images/anime/3/40451.jpg",
  },
  {
    id: "chainsaw-man-filme",
    type: "FILME",
    title: "Chainsaw Man recebe novidades sobre seu filme",
    description: "O projeto ganhou novas informações e detalhes de produção.",
    content:
      "O filme de Chainsaw Man recebeu novas informações relacionadas ao seu desenvolvimento. A atualização apresenta detalhes adicionais sobre o projeto e seus próximos materiais promocionais.\n\nNovas imagens, vídeos e anúncios poderão ser divulgados antes do lançamento. O público poderá acompanhar as próximas atualizações conforme a produção avançar.",
    date: "14 de setembro de 2026",
    image: "https://api-cdn.myanimelist.net/images/anime/1632/110707.jpg",
  },
  {
    id: "my-hero-academia",
    type: "NOVA TEMPORADA",
    title: "My Hero Academia recebe novidades da próxima fase",
    description: "Novas informações sobre a produção foram divulgadas.",
    content:
      "My Hero Academia recebeu novas informações relacionadas à sua próxima fase. A atualização apresenta novidades sobre a produção e sobre os próximos conteúdos que deverão ser disponibilizados.\n\nNovos materiais promocionais poderão trazer mais detalhes sobre os personagens e acontecimentos da continuação. Outras informações serão divulgadas conforme novos anúncios forem realizados.",
    date: "13 de setembro de 2026",
    image: "https://cdn.myanimelist.net/images/anime/10/78745l.jpg",
  },
  {
    id: "dragon-ball",
    type: "NOVIDADES",
    title: "Dragon Ball ganha novas informações para os fãs",
    description: "A franquia recebeu uma nova atualização nesta semana.",
    content:
      "Dragon Ball recebeu uma nova atualização com informações para os fãs da franquia. O anúncio apresenta novidades sobre os próximos conteúdos e mantém a comunidade acompanhando os futuros projetos.\n\nNovas informações poderão surgir nas próximas atualizações, incluindo materiais promocionais, imagens e outros anúncios relacionados à franquia.",
    date: "12 de setembro de 2026",
    image: "https://cdn.myanimelist.net/images/anime/7/74606.jpg",
  },
  {
    id: "one-punch-man",
    type: "TRAILER",
    title: "Novo trailer de One Punch Man é divulgado",
    description:
      "O novo vídeo apresenta cenas inéditas e detalhes da produção.",
    content:
      "Um novo trailer de One Punch Man foi divulgado, apresentando cenas inéditas e novos detalhes da produção. O vídeo reúne diferentes momentos da série e mostra parte do conteúdo que deverá aparecer nos próximos episódios.\n\nO material promocional também aumenta a expectativa para a continuação. Novas informações poderão ser divulgadas durante os próximos anúncios da produção.",
    date: "11 de setembro de 2026",
    image: "https://cdn.myanimelist.net/images/anime/12/76049l.jpg",
  },
];

function titleOf(media: AniListMediaDetails): string {
  return (
    media.title?.english || media.title?.romaji || media.title?.native || "Anime"
  );
}

function formatAnimeSeason(
  season: string | null | undefined,
  year: number | null | undefined,
): string {
  const names: Record<string, string> = {
    WINTER: "Inverno",
    SPRING: "Primavera",
    SUMMER: "Verão",
    FALL: "Outono",
  };

  const translated = season
    ? (names[season.toUpperCase()] ?? season)
    : "Não informado";

  return year ? `${translated} de ${year}` : translated;
}

function formatAnimeDate(
  date: AniListMediaDetails["startDate"] | null | undefined,
): string {
  if (!date?.year || !date.month || !date.day) {
    return "Não informado";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date.year, date.month - 1, date.day));
}

async function translateSynopsis(text: string): Promise<string> {
  const cleaned = stripHtml(text).trim();

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
      `&q=${encodeURIComponent(cleaned.slice(0, 5000))}`;

    const response = await fetch(url, {
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      return cleaned;
    }

    const json = (await response.json()) as unknown;

    if (!Array.isArray(json) || !Array.isArray(json[0])) {
      return cleaned;
    }

    const translated = json[0]
      .filter((part) => Array.isArray(part) && typeof part[0] === "string")
      .map((part) => part[0] as string)
      .join("")
      .trim();

    return translated || cleaned;
  } catch {
    return cleaned;
  }
}

export async function fetchAnimeInfo(
  animeId: number,
): Promise<AnimeInfo | null> {
  try {
    const response = await fetch(ANILIST, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        query: `
          query AnimeDetails($id: Int) {
            Media(id: $id, type: ANIME) {
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
              description(asHtml: false)
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
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return null;
    }

    const json = (await response.json()) as {
      data?: {
        Media?: AniListMediaDetails | null;
      };
      errors?: {
        message?: string;
      }[];
    };

    const media = json.data?.Media;

    if (!media) {
      return null;
    }

    const synopsis = await translateSynopsis(media.description ?? "");

    return {
      id: String(media.id),
      name: titleOf(media),
      image: media.coverImage?.extraLarge || media.coverImage?.large || "",
      synopsis,
      season: formatAnimeSeason(media.season, media.seasonYear),
      releaseDate: formatAnimeDate(media.startDate),
      episodes: media.episodes ?? null,
    };
  } catch {
    return null;
  }
}
