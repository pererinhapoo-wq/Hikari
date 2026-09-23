import { createServerFn } from "@tanstack/react-start";

import { currentAnimeSeason, stripHtml } from "@/lib/utils";

export type AutomaticNewsItem = {
  id: string;
  type: "NOVA TEMPORADA";
  title: string;
  description: string;
  date: string;
  image: string;
  animeId: string;
};

const ANILIST = "https://graphql.anilist.co";

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

const TTL = 10 * 60 * 1000;

function fromCache(
  key: string,
): AutomaticNewsItem[] | null {
  const hit = cache.get(key);

  if (!hit) {
    return null;
  }

  if (Date.now() - hit.at > TTL) {
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
  const date = media.startDate;

  if (
    !date?.year ||
    !date.month ||
    !date.day
  ) {
    return `${media.seasonYear ?? "2026"}`;
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

function descriptionOf(
  media: AniMedia,
): string {
  const description =
    stripHtml(
      media.description,
    );

  if (description) {
    return description;
  }

  return `${titleOf(media)} faz parte da programação da temporada de ${(
    media.season ?? ""
  ).toLowerCase()} de ${media.seasonYear ?? ""}.`;
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
                  sort: START_DATE
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
                }
              }
            }
          `,
          variables: {
            season,
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
      json.errors?.[0]?.message ??
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

    const key =
      `automatic-news:${current.season}:${current.year}`;

    const cached =
      fromCache(key);

    if (cached) {
      return cached;
    }

    try {
      const media =
        await fetchSeason(
          current.season,
          current.year,
        );

      const news =
        media
          .filter(
            (anime) =>
              anime.id > 0 &&
              anime.format !==
                "MUSIC",
          )
          .map(
            (
              anime,
            ): AutomaticNewsItem => ({
              id: `auto-${anime.id}`,

              type:
                "NOVA TEMPORADA",

              title:
                `${titleOf(anime)} — nova temporada`,

              description:
                descriptionOf(anime),

              date:
                formatDate(anime),

              image:
                anime.coverImage
                  ?.extraLarge ||
                anime.coverImage
                  ?.large ||
                "",

              animeId:
                String(anime.id),
            }),
          )
          .filter(
            (news) =>
              Boolean(news.image),
          );

      return toCache(
        key,
        news,
      );
    } catch {
      return [];
    }
  });
