import { createServerFn } from "@tanstack/react-start";

import {
  currentAnimeSeason,
  stripHtml,
} from "@/lib/utils";

export type AutomaticNewsItem = {
  id: string;
  type:
    | "NOVA TEMPORADA"
    | "TRAILER"
    | "NOVO EPISÓDIO";
  title: string;
  description: string;
  date: string;
  image: string;
  animeId: string;
  trailerUrl?: string;
};

const ANILIST =
  "https://graphql.anilist.co";

type AniMedia = {
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

  format?: string | null;
  status?: string | null;
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
    thumbnail?: string | null;
  } | null;

  airingSchedule?: {
    nodes?: {
      airingAt?: number | null;
      episode?: number | null;
    }[];
  } | null;
};

type AniListResponse = {
  Page: {
    media: AniMedia[];
  };
};

const cache = new Map<
  string,
  {
    at: number;
    data: AutomaticNewsItem[];
  }
>();

const translationCache =
  new Map<
    string,
    string
  >();

const TTL =
  10 * 60 * 1000;

function fromCache(
  key: string,
): AutomaticNewsItem[] | null {
  const hit =
    cache.get(key);

  if (!hit) {
    return null;
  }

  if (
    Date.now() - hit.at >
    TTL
  ) {
    cache.delete(key);

    return null;
  }

  return hit.data;
}

function toCache(
  key: string,
  data: AutomaticNewsItem[],
): AutomaticNewsItem[] {
  cache.set(key, {
    at: Date.now(),
    data,
  });

  return data;
}

function formatDate(
  media: AniMedia,
): string {
  const date =
    media.startDate;

  if (
    !date?.year ||
    !date.month ||
    !date.day
  ) {
    return `${
      media.seasonYear ??
      "2026"
    }`;
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

function formatAiringDate(
  airingAt: number,
): string {
  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    },
  ).format(
    new Date(
      airingAt * 1000,
    ),
  );
}

function titleOf(
  media: AniMedia,
): string {
  return (
    media.title?.english ||
    media.title?.romaji ||
    media.title?.native ||
    "Anime"
  );
}

function cleanDescription(
  value:
    | string
    | null
    | undefined,
): string {
  return stripHtml(
    value,
  ).trim();
}

async function translateToPortuguese(
  text: string,
): Promise<string> {
  const cleaned =
    text.trim();

  if (!cleaned) {
    return "";
  }

  const cached =
    translationCache.get(
      cleaned,
    );

  if (cached) {
    return cached;
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

    if (!translated) {
      return cleaned;
    }

    translationCache.set(
      cleaned,
      translated,
    );

    return translated;
  } catch {
    return cleaned;
  }
}

async function descriptionOf(
  media: AniMedia,
): Promise<string> {
  const description =
    cleanDescription(
      media.description,
    );

  if (!description) {
    return `${titleOf(
      media,
    )} faz parte da programação da temporada de ${(
      media.season ?? ""
    ).toLowerCase()} de ${
      media.seasonYear ?? ""
    }.`;
  }

  return translateToPortuguese(
    description,
  );
}

function trailerOf(
  media: AniMedia,
): string | undefined {
  const trailer =
    media.trailer;

  if (
    !trailer?.id ||
    trailer.site !==
      "youtube"
  ) {
    return undefined;
  }

  return `https://www.youtube.com/embed/${trailer.id}`;
}

function latestAiredEpisodeOf(
  media: AniMedia,
): {
  episode: number;
  airingAt: number;
} | null {
  const nodes =
    media.airingSchedule
      ?.nodes ?? [];

  const latest =
    nodes.find(
      (item) =>
        typeof item.airingAt ===
          "number" &&
        typeof item.episode ===
          "number",
    );

  if (!latest) {
    return null;
  }

  return {
    episode:
      latest.episode as number,

    airingAt:
      latest.airingAt as number,
  };
}

async function fetchSeason(
  season: string,
  year: number,
): Promise<AniMedia[]> {
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
            query AutomaticNews(
              $season: MediaSeason
              $year: Int
            ) {
              Page(
                page: 1
                perPage: 50
              ) {
                media(
                  type: ANIME
                  season: $season
                  seasonYear: $year
                  sort: START_DATE_DESC
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

                  format
                  status
                  episodes
                  season
                  seasonYear

                  startDate {
                    year
                    month
                    day
                  }

                  trailer {
                    id
                    site
                    thumbnail
                  }

                  airingSchedule(
                    notYetAired: false
                    page: 1
                    perPage: 1
                    sort: TIME_DESC
                  ) {
                    nodes {
                      airingAt
                      episode
                    }
                  }
                }
              }
            }
          `,

          variables: {
            season:
              season.toUpperCase(),

            year,
          },
        }),

        signal:
          AbortSignal.timeout(
            12000,
          ),
      },
    );

  if (!response.ok) {
    throw new Error(
      `AniList indisponível (${response.status})`,
    );
  }

  const json =
    (await response.json()) as {
      data?: AniListResponse;

      errors?: {
        message?: string;
      }[];
    };

  if (
    json.errors?.length ||
    !json.data?.Page
  ) {
    throw new Error(
      json.errors?.[0]
        ?.message ??
        "AniList sem dados",
    );
  }

  return json.data.Page.media;
}

export const fetchAutomaticNews =
  createServerFn({
    method: "GET",
  }).handler(async () => {
    const current =
      currentAnimeSeason();

    const season =
      String(
        current.season,
      ).toUpperCase();

    const year =
      Number(
        current.year,
      );

    const key =
      `automatic-news:${season}:${year}`;

    const cached =
      fromCache(key);

    if (cached) {
      return cached;
    }

    try {
      const media =
        await fetchSeason(
          season,
          year,
        );

      const filtered =
        media.filter(
          (anime) =>
            anime.id > 0 &&
            anime.format !==
              "MUSIC",
        );

      const news:
        AutomaticNewsItem[] =
        [];

      for (const anime of filtered) {
        const title =
          titleOf(
            anime,
          );

        const trailerUrl =
          trailerOf(
            anime,
          );

        const description =
          await descriptionOf(
            anime,
          );

        /*
         * NOTÍCIA DE NOVO EPISÓDIO
         *
         * Criamos uma notícia para o
         * último episódio que o AniList
         * registra como já exibido.
         */
        const latestEpisode =
          latestAiredEpisodeOf(
            anime,
          );

        if (
          latestEpisode &&
          latestEpisode.episode > 0 &&
          latestEpisode.airingAt * 1000 <=
            Date.now()
        ) {
          news.push({
            id:
              `auto-episode-${anime.id}-${latestEpisode.episode}`,

            type:
              "NOVO EPISÓDIO",

            title:
              `${title} — episódio ${latestEpisode.episode}`,

            description:
              `O episódio ${latestEpisode.episode} de ${title} foi ao ar em ${formatAiringDate(
                latestEpisode.airingAt,
              )}. ${description}`,

            date:
              formatAiringDate(
                latestEpisode.airingAt,
              ),

            image:
              anime.coverImage
                ?.extraLarge ||
              anime.coverImage
                ?.large ||
              "",

            animeId:
              String(
                anime.id,
              ),

            trailerUrl,
          });
        }

        /*
         * NOTÍCIA DE TRAILER
         */
        if (trailerUrl) {
          news.push({
            id:
              `auto-trailer-${anime.id}`,

            type:
              "TRAILER",

            title:
              `${title} — novo trailer`,

            description,

            date:
              formatDate(
                anime,
              ),

            image:
              anime.coverImage
                ?.extraLarge ||
              anime.coverImage
                ?.large ||
              "",

            animeId:
              String(
                anime.id,
              ),

            trailerUrl,
          });
        } else {
          /*
           * NOTÍCIA DE NOVA TEMPORADA
           */
          news.push({
            id:
              `auto-season-${anime.id}`,

            type:
              "NOVA TEMPORADA",

            title:
              `${title} — nova temporada`,

            description,

            date:
              formatDate(
                anime,
              ),

            image:
              anime.coverImage
                ?.extraLarge ||
              anime.coverImage
                ?.large ||
              "",

            animeId:
              String(
                anime.id,
              ),
          });
        }
      }

      const validNews =
        news.filter(
          (item) =>
            Boolean(
              item.image,
            ),
        );

      validNews.sort(
        (a, b) => {
          const dateA =
            Date.parse(
              a.date
                .split("/")
                .reverse()
                .join("-"),
            );

          const dateB =
            Date.parse(
              b.date
                .split("/")
                .reverse()
                .join("-"),
            );

          return (
            dateB - dateA
          );
        },
      );

      return toCache(
        key,
        validNews,
      );
    } catch {
      return [];
    }
  });
