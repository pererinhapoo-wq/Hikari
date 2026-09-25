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
    | "NOVO EPISÓDIO"
    | "PRÓXIMO LANÇAMENTO"
    | "DESTAQUE"
    | "NOVO HENTAI";
  title: string;
  description: string;
  date: string;
  time: string;
  image: string;
  animeId: string;
  trailerUrl?: string;
  isAdult?: boolean;
};

const ANILIST =
  "https://grokhikari.vercel.app/api-anilist";

type AniMedia = {
  id: number;
  isAdult?: boolean | null;

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
  score?: number | null;
  popularity?: number | null;
  updatedAt?: number | null;
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
};

type AniListResponse = {
  Page: {
    media: AniMedia[];
  };
};

type AiringScheduleItem = {
  id?: number | null;
  mediaId?: number | null;
  episode?: number | null;
  airingAt?: number | null;
};

type AiringScheduleResponse = {
  Page: {
    airingSchedules: AiringScheduleItem[];
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
      timeZone: "America/Recife",
    },
  ).format(
    new Date(
      date.year,
      date.month - 1,
      date.day,
    ),
  );
}

function formatEventDate(timestamp: number): string {
  const timeZone = "America/Recife";

  const getLocalDay = (value: Date) => {
    const parts = new Intl.DateTimeFormat(
      "en-US",
      {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        timeZone,
      },
    ).formatToParts(value);

    const year = Number(
      parts.find((part) => part.type === "year")?.value,
    );
    const month = Number(
      parts.find((part) => part.type === "month")?.value,
    );
    const day = Number(
      parts.find((part) => part.type === "day")?.value,
    );

    return Date.UTC(year, month - 1, day);
  };

  const eventDay = getLocalDay(new Date(timestamp));
  const todayDay = getLocalDay(new Date());
  const diffDays = Math.round(
    (eventDay - todayDay) / 86_400_000,
  );

  if (diffDays === 0) {
    return "Hoje";
  }

  if (diffDays === -1) {
    return "Ontem";
  }

  if (diffDays === 1) {
    return "Amanhã";
  }

  if (diffDays < 0 && diffDays >= -30) {
    return `Há ${Math.abs(diffDays)} dias`;
  }

  if (diffDays > 0 && diffDays <= 60) {
    return `Em ${diffDays} dias`;
  }

  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone,
    },
  ).format(new Date(timestamp));
}

function formatEventTime(timestamp: number): string {
  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Recife",
    },
  ).format(new Date(timestamp));
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

async function fetchLatestAiredEpisodes(
  mediaIds?: number[],
): Promise<
  Map<
    number,
    {
      episode: number;
      airingAt: number;
    }
  >
> {
  const result =
    new Map<
      number,
      {
        episode: number;
        airingAt: number;
      }
    >();

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
              query LatestAiredEpisodes {
                Page(
                  page: 1
                  perPage: 50
                ) {
                  airingSchedules(
                    notYetAired: false
                    ${
                      mediaIds?.length
                        ? `mediaId_in: [${mediaIds.join(",")}]`
                        : ""
                    }
                    sort: TIME_DESC
                  ) {
                    id
                    mediaId
                    episode
                    airingAt
                  }
                }
              }
            `,
          }),

          signal:
            AbortSignal.timeout(
              12000,
            ),
        },
      );

    if (!response.ok) {
      return result;
    }

    const json =
      (await response.json()) as {
        data?: AiringScheduleResponse;

        errors?: {
          message?: string;
        }[];
      };

    if (
      json.errors?.length ||
      !json.data?.Page
    ) {
      return result;
    }

    for (const item of
      json.data.Page
        .airingSchedules ?? []) {
      if (
        typeof item.mediaId !==
          "number" ||
        typeof item.episode !==
          "number" ||
        typeof item.airingAt !==
          "number"
      ) {
        continue;
      }

      if (
        item.episode <= 0 ||
        item.airingAt * 1000 >
          Date.now()
      ) {
        continue;
      }

      if (
        !result.has(
          item.mediaId,
        )
      ) {
        result.set(
          item.mediaId,
          {
            episode:
              item.episode,

            airingAt:
              item.airingAt,
          },
        );
      }
    }
  } catch {
    return result;
  }

  return result;
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
                  isAdult

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

async function fetchAdultCatalogNews(): Promise<
  AniMedia[]
> {
  const query = `
    query AdultNews {
      page1: Page(
        page: 1
        perPage: 50
      ) {
        media(
          type: ANIME
          isAdult: true
          genre: "Hentai"
          sort: START_DATE_DESC
        ) {
          id
          isAdult
          score: averageScore

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
        }
      }

      page2: Page(
        page: 2
        perPage: 50
      ) {
        media(
          type: ANIME
          isAdult: true
          genre: "Hentai"
          sort: START_DATE_DESC
        ) {
          id
          isAdult
          score: averageScore

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
        }
      }
    }
  `;

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
          query,
        }),

        signal:
          AbortSignal.timeout(
            8000,
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
      data?: {
        page1?: {
          media?: AniMedia[];
        };
        page2?: {
          media?: AniMedia[];
        };
      };

      errors?: {
        message?: string;
      }[];
    };

  if (
    json.errors?.length ||
    !json.data
  ) {
    throw new Error(
      json.errors?.[0]
        ?.message ??
        "AniList sem dados",
    );
  }

  const merged = [
    ...(json.data.page1?.media ?? []),
    ...(json.data.page2?.media ?? []),
  ];

  const unique =
    Array.from(
      new Map(
        merged.map((anime) => [
          anime.id,
          anime,
        ]),
      ).values(),
    );

  return unique.filter(
    (anime) =>
      anime.isAdult === true &&
      anime.id > 0 &&
      anime.format !== "MUSIC",
  );
}

async function buildNews(
  media: AniMedia[],
  latestEpisodes: Map<
    number,
    {
      episode: number;
      airingAt: number;
    }
  >,
): Promise<AutomaticNewsItem[]> {
  const news:
    AutomaticNewsItem[] =
    [];

  const isAdultFeed =
    media.some(
      (anime) => anime.isAdult === true,
    );

  const now = Date.now();
  const RECENT_UPDATE_WINDOW =
    30 * 24 * 60 * 60 * 1000;
  const RECENT_RELEASE_WINDOW =
    isAdultFeed
      ? 30 * 24 * 60 * 60 * 1000
      : 120 * 24 * 60 * 60 * 1000;
  const UPCOMING_RELEASE_WINDOW =
    isAdultFeed
      ? 60 * 24 * 60 * 60 * 1000
      : 180 * 24 * 60 * 60 * 1000;
  const RECENT_EPISODE_WINDOW =
    isAdultFeed
      ? 7 * 24 * 60 * 60 * 1000
      : 14 * 24 * 60 * 60 * 1000;

  const recentMedia = media.filter(
    (anime) => {
      const updatedAt =
        typeof anime.updatedAt ===
          "number" &&
        anime.updatedAt > 0
          ? anime.updatedAt * 1000
          : 0;

      const startDate =
        anime.startDate;
      const startTimestamp =
        startDate?.year &&
        startDate.month &&
        startDate.day
          ? new Date(
              startDate.year,
              startDate.month - 1,
              startDate.day,
            ).getTime()
          : 0;

      const latestEpisode =
        latestEpisodes.get(
          anime.id,
        );

      const episodeTimestamp =
        latestEpisode?.airingAt
          ? latestEpisode.airingAt * 1000
          : 0;

      const recentlyUpdated =
        updatedAt > 0 &&
        now - updatedAt <=
          RECENT_UPDATE_WINDOW &&
        updatedAt <= now;

      const recentlyReleased =
        startTimestamp > 0 &&
        startTimestamp <= now &&
        now - startTimestamp <=
          RECENT_RELEASE_WINDOW;

      const upcoming =
        startTimestamp > now &&
        startTimestamp - now <=
          UPCOMING_RELEASE_WINDOW;

      const recentlyAired =
        episodeTimestamp > 0 &&
        episodeTimestamp <= now &&
        now - episodeTimestamp <=
          RECENT_EPISODE_WINDOW;

      return (
        recentlyReleased ||
        upcoming ||
        recentlyAired
      );
    },
  );

  // A lista de notícias deve ser formada por acontecimentos
  // recentes, e não por todos os animes antigos do catálogo.
  // Mantemos somente os títulos que tiveram atualização recente,
  // lançamento recente/próximo ou episódio recém-exibido.
  media = recentMedia;

  // Só traduzimos os animes que realmente podem gerar
  // uma notícia. Isso evita dezenas de chamadas externas
  // de tradução para títulos antigos que serão descartados.
  const prepared =
    media.map(
      (anime) => ({
        anime,
        title: titleOf(anime),
        trailerUrl: trailerOf(anime),
        latestEpisode: latestEpisodes.get(anime.id),
      }),
    );

  const descriptions =
    await Promise.all(
      prepared.map(({ anime }) =>
        descriptionOf(anime),
      ),
    );

  const topRated = [
    ...media,
  ]
    .filter(
      (anime) =>
        typeof anime.score ===
          "number" &&
        anime.score > 0,
    )
    .sort(
      (a, b) =>
        (b.score ?? 0) -
        (a.score ?? 0),
    )
    .slice(0, 8);

  if (!isAdultFeed) {
    for (const anime of topRated) {
    const title = titleOf(anime);
    const preparedIndex = prepared.findIndex(
      ({ anime: preparedAnime }) =>
        preparedAnime.id === anime.id,
    );
    const description =
      preparedIndex >= 0
        ? descriptions[preparedIndex]
        : "";

    news.push({
      id: `auto-highlight-${anime.id}`,
      type: "DESTAQUE",
      title,
      description,
      date: formatUpdatedDate(
        anime.updatedAt,
      ),
      time: formatUpdatedTime(
        anime.updatedAt,
      ),
      image:
        anime.coverImage?.extraLarge ||
        anime.coverImage?.large ||
        "",
      animeId: String(anime.id),
      trailerUrl: trailerOf(anime),
      isAdult: true,
    });
    }
  }

  for (
    let index = 0;
    index <
    prepared.length;
    index++
  ) {
    const {
      anime,
      title,
      trailerUrl,
      latestEpisode,
    } =
      prepared[index];

    const description =
      descriptions[index];

    const isAdult =
      anime.isAdult === true;

    const updatedTimestamp =
      typeof anime.updatedAt ===
        "number" &&
      anime.updatedAt > 0
        ? anime.updatedAt * 1000
        : 0;

    const recentlyUpdated =
      updatedTimestamp > 0 &&
      now - updatedTimestamp <=
        RECENT_UPDATE_WINDOW &&
      updatedTimestamp <= now;

    const startDate = anime.startDate;
    const startTimestamp =
      startDate?.year &&
      startDate.month &&
      startDate.day
        ? new Date(
            startDate.year,
            startDate.month - 1,
            startDate.day,
          ).getTime()
        : 0;

    if (
      isAdultFeed &&
      isAdult &&
      startTimestamp > now
    ) {
      news.push({
        id:
          `auto-upcoming-${anime.id}`,

        type:
          "PRÓXIMO LANÇAMENTO",

        title:
          isAdult
            ? title
            : `${title} — próximo lançamento`,

        description:
          `Novo conteúdo de ${title} está previsto para ${formatDate(
            anime,
          )}. ${description}`,

        date:
          isAdultFeed
            ? formatEventDate(
                startTimestamp,
              )
            : formatUpdatedDate(
                anime.updatedAt,
              ),

        time:
          isAdultFeed
            ? formatEventTime(
                startTimestamp,
              )
            : formatUpdatedTime(
                anime.updatedAt,
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

        isAdult:
          anime.isAdult === true,
      });
    }

    if (
      latestEpisode &&
      latestEpisode.episode > 0 &&
      latestEpisode.airingAt * 1000 <=
        Date.now() &&
      (!isAdultFeed ||
        Date.now() -
          latestEpisode.airingAt * 1000 <=
          RECENT_EPISODE_WINDOW)
    ) {
      news.push({
        id:
          `auto-episode-${anime.id}-${latestEpisode.episode}`,

        type:
          "NOVO EPISÓDIO",

        title:
          isAdult
            ? `${title} — Episode ${latestEpisode.episode}`
            : `${title} — episódio ${latestEpisode.episode}`,

        description:
          `O episódio ${latestEpisode.episode} de ${title} foi ao ar em ${formatAiringDate(
            latestEpisode.airingAt,
          )}. ${description}`,

        date:
          isAdultFeed && latestEpisode
            ? formatEventDate(
                latestEpisode.airingAt * 1000,
              )
            : formatUpdatedDate(
                anime.updatedAt,
              ),

        time:
          isAdultFeed && latestEpisode
            ? formatEventTime(
                latestEpisode.airingAt * 1000,
              )
            : formatUpdatedTime(
                anime.updatedAt,
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

        isAdult:
          anime.isAdult === true,
      });
    }

    const recentlyReleased =
      startTimestamp > 0 &&
      startTimestamp <= now &&
      now - startTimestamp <=
        RECENT_RELEASE_WINDOW;

    const upcoming =
      startTimestamp > now &&
      startTimestamp - now <=
        UPCOMING_RELEASE_WINDOW;

    const recentlyAired =
      latestEpisode?.airingAt
        ? latestEpisode.airingAt * 1000 <= now &&
          now - latestEpisode.airingAt * 1000 <=
            RECENT_EPISODE_WINDOW
        : false;

    const releaseTimestamp =
      startTimestamp > 0
        ? startTimestamp
        : 0;

    const episodeTimestamp =
      latestEpisode?.airingAt
        ? latestEpisode.airingAt * 1000
        : 0;

    const eventTimestamp =
      recentlyAired && episodeTimestamp > 0
        ? episodeTimestamp
        : releaseTimestamp > 0
          ? releaseTimestamp
          : updatedTimestamp;

    if (
      trailerUrl &&
      (recentlyReleased ||
        upcoming ||
        recentlyAired)
    ) {
      news.push({
        id:
          `auto-trailer-${anime.id}`,

        type:
          "TRAILER",

        title:
          isAdult
            ? title
            : `${title} — novo trailer`,

        description,

        date:
          isAdultFeed && eventTimestamp > 0
            ? formatEventDate(eventTimestamp)
            : formatUpdatedDate(anime.updatedAt),

        time:
          isAdultFeed && eventTimestamp > 0
            ? formatEventTime(eventTimestamp)
            : formatUpdatedTime(anime.updatedAt),

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

        isAdult:
          anime.isAdult === true,
      });
    } else if (
      recentlyReleased ||
      upcoming ||
      recentlyAired
    ) {
      news.push({
        id:
          `auto-season-${anime.id}`,

        type:
          isAdult
            ? "NOVO HENTAI"
            : "NOVA TEMPORADA",

        title:
          isAdult
            ? title
            : `${title} — nova temporada`,

        description,

        date:
          isAdultFeed && eventTimestamp > 0
            ? formatEventDate(eventTimestamp)
            : formatUpdatedDate(anime.updatedAt),

        time:
          isAdultFeed && eventTimestamp > 0
            ? formatEventTime(eventTimestamp)
            : formatUpdatedTime(anime.updatedAt),

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

        isAdult:
          anime.isAdult === true,
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
      const parse = (
        value: string,
      ) => {
        const match =
          value.match(
            /^(\d{2})\/(\d{2})\/(\d{4})$/,
          );

        if (!match) {
          return 0;
        }

        return new Date(
          Number(match[3]),
          Number(match[2]) - 1,
          Number(match[1]),
        ).getTime();
      };

      return (
        parse(b.date) -
        parse(a.date)
      );
    },
  );

  // Um mesmo anime pode gerar mais de um tipo
  // de notícia (ex.: "PRÓXIMO LANÇAMENTO" e
  // "NOVO HENTAI"). Para a página +18,
  // mostramos apenas uma notícia por anime,
  // evitando cards duplicados. Como a lista já
  // está ordenada por data, a primeira notícia
  // de cada anime é a mais recente.
  const uniqueNews =
    Array.from(
      new Map(
        validNews.map((item) => [
          item.animeId ?? item.id,
          item,
        ]),
      ).values(),
    );

  return uniqueNews;
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
      return cached.filter(
        (item) =>
          item.isAdult !== true,
      );
    }

    try {
      const [
        media,
        latestEpisodes,
      ] =
        await Promise.all([
          fetchSeason(
            season,
            year,
          ),
          fetchLatestAiredEpisodes(),
        ]);

      const nonAdultMedia =
        media.filter(
          (anime) =>
            anime.isAdult !== true,
        );

      const news =
        await buildNews(
          nonAdultMedia,
          latestEpisodes,
        );

      return toCache(
        key,
        news,
      );
    } catch {
      return [];
    }
  });

export const fetchAdultNews =
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
      `automatic-adult-news:v2:${season}:${year}`;

    const cached =
      fromCache(key);

    if (cached) {
      return cached.filter(
        (item) =>
          item.isAdult === true,
      );
    }

    try {
      /*
       * As notícias +18 não dependem
       * da temporada atual.
       *
       * Buscamos diretamente os animes
       * marcados pelo AniList como adultos.
       */
      const adultMedia =
        await fetchAdultCatalogNews();

      const latestEpisodes =
        await fetchLatestAiredEpisodes(
          adultMedia.map(
            (anime) => anime.id,
          ),
        );

      const news =
        await buildNews(
          adultMedia,
          latestEpisodes,
        );

      return toCache(
        key,
        news,
      );
    } catch (error) {
      throw error instanceof Error
        ? error
        : new Error(
            "Falha ao carregar notícias +18",
          );
    }
  });
