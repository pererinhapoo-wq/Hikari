import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  currentAnimeSeason,
  stripHtml,
  youtubeIdFrom,
} from "@/lib/utils";

import { seasonLabel } from "@/lib/labels";

import type {
  Anime,
  Episode,
  HomeCatalog,
  SearchParams,
  SearchResult,
  Season,
  SlimAnime,
  StreamingLink,
} from "@/lib/types";

const ANILIST = "https://graphql.anilist.co";
const JIKAN = "https://api.jikan.moe/v4";

const CARD_FIELDS = `
  id
  idMal
  isAdult
  title {
    romaji
    english
    native
  }
  coverImage {
    extraLarge
    large
    color
  }
  bannerImage
  averageScore
  genres
  format
  status
  episodes
  season
  seasonYear
  description(asHtml: false)
  trailer {
    id
    site
    thumbnail
  }
`;

type AniTitle = {
  romaji?: string | null;
  english?: string | null;
  native?: string | null;
};

type AniMedia = {
  id: number;
  idMal?: number | null;
  isAdult?: boolean;

  title?: AniTitle | null;

  coverImage?: {
    extraLarge?: string | null;
    large?: string | null;
    color?: string | null;
  } | null;

  bannerImage?: string | null;

  averageScore?: number | null;

  genres?: string[] | null;

  format?: string | null;

  status?: string | null;

  episodes?: number | null;

  duration?: number | null;

  season?: string | null;

  seasonYear?: number | null;

  description?: string | null;

  trailer?: {
    id?: string | null;
    site?: string | null;
    thumbnail?: string | null;
  } | null;

  studios?: {
    nodes?: {
      name: string;
    }[] | null;
  } | null;

  nextAiringEpisode?: {
    episode: number;
    airingAt: number;
  } | null;

  streamingEpisodes?: {
    title?: string;
    thumbnail?: string;
    url?: string;
    site?: string;
  }[] | null;

  recommendations?: {
    nodes?: {
      mediaRecommendation?: AniMedia | null;
    }[] | null;
  } | null;
};

const cache = new Map<
  string,
  {
    at: number;
    data: unknown;
  }
>();

const TTL = 5 * 60 * 1000;

function fromCache<T>(
  key: string,
): T | null {
  const hit = cache.get(key);

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

  return hit.data as T;
}

function toCache<T>(
  key: string,
  data: T,
): T {
  cache.set(key, {
    at: Date.now(),
    data,
  });

  return data;
}

async function anilistGraphQL<T>(
  query: string,
  variables?: Record<
    string,
    unknown
  >,
): Promise<T> {
  const res = await fetch(
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
        variables,
      }),
      signal:
        AbortSignal.timeout(
          12000,
        ),
    },
  );

  if (!res.ok) {
    throw new Error(
      `AniList indisponível (${res.status})`,
    );
  }

  const json =
    (await res.json()) as {
      data?: T;
      errors?: {
        message: string;
      }[];
    };

  if (
    json.errors?.length
  ) {
    throw new Error(
      json.errors[0]?.message ??
        "AniList error",
    );
  }

  if (!json.data) {
    throw new Error(
      "AniList sem dados",
    );
  }

  return json.data;
}

async function jikanFetch<T>(
  path: string,
  attempt = 0,
): Promise<T> {
  const res = await fetch(
    `${JIKAN}${path}`,
    {
      headers: {
        Accept:
          "application/json",
        "User-Agent":
          "Hikari/1.0 (anime catalog)",
      },
      signal:
        AbortSignal.timeout(
          12000,
        ),
    },
  );

  if (
    res.status === 429 &&
    attempt < 2
  ) {
    await new Promise(
      (resolve) =>
        setTimeout(
          resolve,
          900 *
            (attempt + 1),
        ),
    );

    return jikanFetch<T>(
      path,
      attempt + 1,
    );
  }

  if (!res.ok) {
    throw new Error(
      `MyAnimeList indisponível (${res.status})`,
    );
  }

  return (await res.json()) as T;
}

function isAdultAnime(
  media: AniMedia,
): boolean {
  return media.isAdult === true;
}

function trailerFromAni(
  media: AniMedia,
): string | null {
  const trailer =
    media.trailer;

  if (!trailer?.id) {
    return null;
  }

  if (
    (
      trailer.site ??
      "youtube"
    ).toLowerCase() ===
    "youtube"
  ) {
    return trailer.id;
  }

  return youtubeIdFrom(
    trailer.id,
  );
}

function mapAniSlim(
  media: AniMedia,
): SlimAnime {
  return {
    id: String(media.id),

    anilistId: media.id,

    malId:
      media.idMal ??
      undefined,

    titles: {
      romaji:
        media.title?.romaji ??
        "",
      english:
        media.title?.english ??
        "",
      native:
        media.title?.native ??
        "",
    },

    cover:
      media.coverImage
        ?.extraLarge ||
      media.coverImage
        ?.large ||
      "",

    banner:
      media.bannerImage ||
      "",

    synopsis: stripHtml(
      media.description,
    ),

    score:
      media.averageScore ??
      null,

    genres:
      media.genres ?? [],

    format:
      media.format ?? "",

    status:
      media.status ?? "",

    episodesCount:
      media.episodes ?? null,

    season:
      media.season ?? null,

    year:
      media.seasonYear ?? null,

    trailerId:
      trailerFromAni(
        media,
      ),

    color:
      media.coverImage
        ?.color ??
      undefined,

    source: "anilist",
  };
}

type JikanAnime = {
  mal_id: number;

  title?: string;

  title_english?:
    | string
    | null;

  title_japanese?:
    | string
    | null;

  synopsis?:
    | string
    | null;

  score?:
    | number
    | null;

  episodes?:
    | number
    | null;

  status?:
    | string
    | null;

  type?:
    | string
    | null;

  year?:
    | number
    | null;

  season?:
    | string
    | null;

  genres?: {
    name: string;
  }[];

  images?: {
    jpg?: {
      large_image_url?: string;
      image_url?: string;
    };
  };

  trailer?: {
    youtube_id?:
      | string
      | null;

    images?: {
      maximum_image_url?: string;
    };
  };

  studios?: {
    name: string;
  }[];

  duration?:
    | string
    | null;
};

function jikanStatus(
  status?: string | null,
): string {
  const value =
    (status ?? "").toLowerCase();

  if (
    value.includes("air")
  ) {
    return "RELEASING";
  }

  if (
    value.includes(
      "finish",
    ) ||
    value.includes(
      "complete",
    )
  ) {
    return "FINISHED";
  }

  if (
    value.includes(
      "not yet",
    ) ||
    value.includes(
      "upcoming",
    )
  ) {
    return "NOT_YET_RELEASED";
  }

  if (
    value.includes(
      "hiatus",
    )
  ) {
    return "HIATUS";
  }

  return (
    status
      ?.toUpperCase()
      .replace(
        /\s+/g,
        "_",
      ) ?? ""
  );
}

function jikanFormat(
  type?: string | null,
): string {
  const value =
    (
      type ?? ""
    ).toUpperCase();

  if (value === "TV") {
    return "TV";
  }

  if (
    value === "MOVIE"
  ) {
    return "MOVIE";
  }

  if (value === "OVA") {
    return "OVA";
  }

  if (value === "ONA") {
    return "ONA";
  }

  if (
    value === "SPECIAL"
  ) {
    return "SPECIAL";
  }

  if (
    value === "MUSIC"
  ) {
    return "MUSIC";
  }

  return value;
}

function mapJikanSlim(
  anime: JikanAnime,
): SlimAnime {
  return {
    id: `mal-${anime.mal_id}`,

    malId:
      anime.mal_id,

    titles: {
      romaji:
        anime.title ?? "",
      english:
        anime.title_english ??
        "",
      native:
        anime.title_japanese ??
        "",
    },

    cover:
      anime.images?.jpg
        ?.large_image_url ||
      anime.images?.jpg
        ?.image_url ||
      "",

    banner:
      anime.trailer?.images
        ?.maximum_image_url ||
      "",

    synopsis: stripHtml(
      anime.synopsis,
    ),

    score:
      anime.score != null
        ? Math.round(
            anime.score * 10,
          )
        : null,

    genres:
      (
        anime.genres ?? []
      ).map(
        (genre) =>
          genre.name,
      ),

    format:
      jikanFormat(
        anime.type,
      ),

    status:
      jikanStatus(
        anime.status,
      ),

    episodesCount:
      anime.episodes ??
      null,

    season:
      anime.season
        ? anime.season.toUpperCase()
        : null,

    year:
      anime.year ?? null,

    trailerId:
      anime.trailer
        ?.youtube_id ??
      null,

    source: "jikan",
  };
}

async function jikanEpisodes(
  malId: number,
): Promise<Season[]> {
  const episodes: Episode[] =
    [];

  let page = 1;
  let hasNext = true;

  while (
    hasNext &&
    page <= 8
  ) {
    type EpisodePage = {
      pagination?: {
        has_next_page?: boolean;
      };

      data?: {
        mal_id: number;
        title?: string;
        title_japanese?: string;
        aired?: string;
        filler?: boolean;
        recap?: boolean;
      }[];
    };

    const json =
      await jikanFetch<EpisodePage>(
        `/anime/${malId}/episodes?page=${page}`,
      );

    for (
      const episode of
        json.data ?? []
    ) {
      episodes.push({
        id: `mal-ep-${malId}-${episode.mal_id}`,

        number:
          episode.mal_id,

        title:
          episode.title ||
          episode.title_japanese ||
          `Episódio ${episode.mal_id}`,

        aired:
          episode.aired ??
          undefined,
      });
    }

    hasNext = Boolean(
      json.pagination
        ?.has_next_page,
    );

    page += 1;
  }

  if (!episodes.length) {
    return [];
  }

  return [
    {
      id: `mal-s1-${malId}`,

      number: 1,

      title:
        "Temporada 1",

      episodes,
    },
  ];
}

function streamingFromAni(
  media: AniMedia,
): StreamingLink[] {
  return (
    media.streamingEpisodes ??
    []
  )
    .filter(
      (episode) =>
        Boolean(
          episode.url,
        ),
    )
    .map(
      (episode) => ({
        title:
          episode.title ??
          "Episódio",

        thumbnail:
          episode.thumbnail ??
          "",

        url:
          episode.url ?? "",

        site:
          episode.site ?? "",
      }),
    );
}

function mapAniFull(
  media: AniMedia,
  seasons: Season[],
): Anime {
  const slim =
    mapAniSlim(media);

  return {
    ...slim,

    duration:
      media.duration ??
      null,

    studios: (
      media.studios
        ?.nodes ?? []
    ).map(
      (studio) =>
        studio.name,
    ),

    nextEpisode:
      media.nextAiringEpisode ??
      undefined,

    streamingEpisodes:
      streamingFromAni(
        media,
      ),

    seasons,

    recommendations: (
      media.recommendations
        ?.nodes ?? []
    )
      .map(
        (node) =>
          node.mediaRecommendation,
      )
      .filter(
        (
          item,
        ): item is AniMedia =>
          Boolean(item?.id),
      )
      .slice(0, 12)
      .map(mapAniSlim),
  };
}

async function fetchRecentReleasesFromAni(): Promise<
  SlimAnime[]
> {
  const now =
    Math.floor(
      Date.now() / 1000,
    );

  const weekAgo =
    now -
    7 * 24 * 60 * 60;

  const data =
    await anilistGraphQL<{
      Page: {
        airingSchedules: {
          airingAt: number;
          episode: number;
          media?: AniMedia | null;
        }[];
      };
    }>(
      `
      query RecentReleases(
        $airingAtGreater: Int,
        $airingAtLesser: Int
      ) {
        Page(
          page: 1,
          perPage: 30
        ) {
          airingSchedules(
            airingAt_greater: $airingAtGreater,
            airingAt_lesser: $airingAtLesser,
            sort: TIME_DESC
          ) {
            airingAt
            episode
            media {
              ${CARD_FIELDS}
            }
          }
        }
      }
      `,
      {
        airingAtGreater:
          weekAgo,

        airingAtLesser:
          now,
      },
    );

  const seen =
    new Set<number>();

  const releases: SlimAnime[] =
    [];

  for (
    const item of
      data.Page
        .airingSchedules ?? []
  ) {
    const media =
      item.media;

    if (!media?.id) {
      continue;
    }

    if (
      isAdultAnime(media)
    ) {
      continue;
    }

    if (
      seen.has(media.id)
    ) {
      continue;
    }

    seen.add(media.id);

    releases.push(
      mapAniSlim(media),
    );

    if (
      releases.length >= 18
    ) {
      break;
    }
  }

  return releases;
}

async function fetchHomeFromAni(): Promise<HomeCatalog> {
  const {
    season,
    year,
  } = currentAnimeSeason();

  const data =
    await anilistGraphQL<{
      trending: {
        media: AniMedia[];
      };

      popular: {
        media: AniMedia[];
      };

      top: {
        media: AniMedia[];
      };

      season: {
        media: AniMedia[];
      };

      genres: string[];
    }>(
      `
      query Home(
        $season: MediaSeason,
        $year: Int
      ) {
        trending: Page(
          page: 1,
          perPage: 18
        ) {
          media(
            type: ANIME,
            sort: TRENDING_DESC
          ) {
            ${CARD_FIELDS}
          }
        }

        popular: Page(
          page: 1,
          perPage: 18
        ) {
          media(
            type: ANIME,
            sort: POPULARITY_DESC
          ) {
            ${CARD_FIELDS}
          }
        }

        top: Page(
          page: 1,
          perPage: 18
        ) {
          media(
            type: ANIME,
            sort: SCORE_DESC
          ) {
            ${CARD_FIELDS}
          }
        }

        season: Page(
          page: 1,
          perPage: 18
        ) {
          media(
            type: ANIME,
            season: $season,
            seasonYear: $year,
            sort: POPULARITY_DESC
          ) {
            ${CARD_FIELDS}
          }
        }

        genres: GenreCollection
      }
      `,
      {
        season,
        year,
      },
    );

  const releases =
    await fetchRecentReleasesFromAni();

  const trending =
    (
      data.trending
        .media ?? []
    ).filter(
      (anime) =>
        !isAdultAnime(
          anime,
        ),
    );

  const popular =
    (
      data.popular
        .media ?? []
    ).filter(
      (anime) =>
        !isAdultAnime(
          anime,
        ),
    );

  const top =
    (
      data.top.media ?? []
    ).filter(
      (anime) =>
        !isAdultAnime(
          anime,
        ),
    );

  const seasonItems =
    (
      data.season
        .media ?? []
    ).filter(
      (anime) =>
        !isAdultAnime(
          anime,
        ),
    );

  return {
    trending:
      trending.map(
        mapAniSlim,
      ),

    popular:
      popular.map(
        mapAniSlim,
      ),

    top:
      top.map(
        mapAniSlim,
      ),

    season:
      seasonItems.map(
        mapAniSlim,
      ),

    releases,

    seasonName:
      seasonLabel(season),

    seasonYear:
      year,

    source: "anilist",

    genres:
      (
        data.genres ?? []
      ).filter(
        (genre) =>
          genre &&
          genre !==
            "Hentai",
      ),
  };
}

async function fetchHomeFromJikan(): Promise<HomeCatalog> {
  const {
    season,
    year,
  } = currentAnimeSeason();

  type List = {
    data?: JikanAnime[];
  };

  const [
    now,
    top,
    popular,
  ] = await Promise.all([
    jikanFetch<List>(
      "/seasons/now?limit=18",
    ),

    jikanFetch<List>(
      "/top/anime?filter=bypopularity&limit=18",
    ),

    jikanFetch<List>(
      "/top/anime?limit=18",
    ),
  ]);

  const seasonItems =
    (
      now.data ?? []
    ).map(
      mapJikanSlim,
    );

  const popularItems =
    (
      top.data ?? []
    ).map(
      mapJikanSlim,
    );

  const topItems =
    (
      popular.data ?? []
    ).map(
      mapJikanSlim,
    );

  return {
    trending:
      seasonItems,

    popular:
      popularItems,

    top:
      topItems,

    season:
      seasonItems,

    releases:
      seasonItems.slice(
        0,
        18,
      ),

    seasonName:
      seasonLabel(season),

    seasonYear:
      year,

    source: "jikan",

    genres: [
      "Action",
      "Adventure",
      "Comedy",
      "Drama",
      "Fantasy",
      "Horror",
      "Mecha",
      "Mystery",
      "Romance",
      "Sci-Fi",
      "Slice of Life",
      "Sports",
      "Supernatural",
      "Thriller",
    ],
  };
}

export const fetchHomeCatalog =
  createServerFn({
    method: "GET",
  }).handler(
    async () => {
      const key =
        "home";

      const cached =
        fromCache<HomeCatalog>(
          key,
        );

      if (cached) {
        return cached;
      }

      try {
        return toCache(
          key,
          await fetchHomeFromAni(),
        );
      } catch {
        return toCache(
          key,
          await fetchHomeFromJikan(),
        );
      }
    },
  );

const searchSchema =
  z.object({
    q: z.string().optional(),

    genre:
      z.string().optional(),

    year:
      z.string().optional(),

    format:
      z.string().optional(),

    status:
      z.string().optional(),

    sort:
      z.string().optional(),

    page:
      z.number().optional(),
  });

function normalizeSearchText(
  value: string,
): string {
  return value
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .toLowerCase()
    .replace(
      /[^\p{L}\p{N}]+/gu,
      " ",
    )
    .replace(
      /\s+/g,
      " ",
    )
    .trim();
}

function searchScore(
  anime: SlimAnime,
  query: string,
): number {
  const q =
    normalizeSearchText(
      query,
    );

  if (!q) {
    return 0;
  }

  const titles = [
    anime.titles.romaji,
    anime.titles.english,
    anime.titles.native,
  ]
    .filter(Boolean)
    .map(
      normalizeSearchText,
    );

  const compactQuery =
    q.replace(/\s/g, "");

  let score = 0;

  for (
    const title of titles
  ) {
    const compactTitle =
      title.replace(
        /\s/g,
        "",
      );

    if (title === q) {
      score = Math.max(
        score,
        1000,
      );
      continue;
    }

    if (
      title.startsWith(q)
    ) {
      score = Math.max(
        score,
        900,
      );
    }

    if (
      compactTitle.startsWith(
        compactQuery,
      )
    ) {
      score = Math.max(
        score,
        850,
      );
    }

    if (
      title.includes(q)
    ) {
      score = Math.max(
        score,
        750,
      );
    }

    const queryWords =
      q.split(" ");

    const titleWords =
      title.split(" ");

    const allWordsMatch =
      queryWords.every(
        (queryWord) =>
          titleWords.some(
            (titleWord) =>
              titleWord.startsWith(
                queryWord,
              ),
          ),
      );

    if (allWordsMatch) {
      score = Math.max(
        score,
        800,
      );
    }

    if (
      compactTitle.includes(
        compactQuery,
      )
    ) {
      score = Math.max(
        score,
        700,
      );
    }
  }

  if (score === 0) {
    const firstWord =
      q.split(" ")[0];

    if (
      firstWord &&
      titles.some(
        (title) =>
          title.includes(
            firstWord,
          ),
      )
    ) {
      score = 100;
    }
  }

  return score;
}

function rankSearchResults(
  items: SlimAnime[],
  query?: string,
): SlimAnime[] {
  if (!query?.trim()) {
    return items;
  }

  return [...items]
    .map(
      (anime, index) => ({
        anime,

        score:
          searchScore(
            anime,
            query,
          ),

        index,
      }),
    )
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.index - b.index,
    )
    .map(
      (item) =>
        item.anime,
    );
}

function mergeSearchItems(
  first: SlimAnime[],
  second: SlimAnime[],
): SlimAnime[] {
  const seen =
    new Set<string>();

  const result: SlimAnime[] =
    [];

  for (
    const anime of [
      ...first,
      ...second,
    ]
  ) {
    const key =
      anime.anilistId
        ? `ani-${anime.anilistId}`
        : anime.malId
          ? `mal-${anime.malId}`
          : anime.id;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(anime);
  }

  return result;
}

async function searchAni(
  params: SearchParams,
): Promise<SearchResult> {
  const page =
    params.page ?? 1;

  const sort =
    params.sort ||
    (
      params.q
        ? "SEARCH_MATCH"
        : "TRENDING_DESC"
    );

  const year =
    params.year
      ? Number(params.year)
      : undefined;

  const data =
    await anilistGraphQL<{
      Page: {
        pageInfo: {
          hasNextPage: boolean;
        };

        media: AniMedia[];
      };
    }>(
      `
      query Search(
        $page: Int,
        $search: String,
        $genre: String,
        $year: Int,
        $format: MediaFormat,
        $status: MediaStatus,
        $sort: [MediaSort]
      ) {
        Page(
          page: $page,
          perPage: 24
        ) {
          pageInfo {
            hasNextPage
          }

          media(
            type: ANIME,
            search: $search,
            genre: $genre,
            seasonYear: $year,
            format: $format,
            status: $status,
            sort: $sort
          ) {
            ${CARD_FIELDS}
          }
        }
      }
      `,
      {
        page,

        search:
          params.q ||
          undefined,

        genre:
          params.genre ||
          undefined,

        year:
          year &&
          Number.isFinite(
            year,
          )
            ? year
            : undefined,

        format:
          params.format ||
          undefined,

        status:
          params.status ||
          undefined,

        sort: [sort],
      },
    );

  return {
    items: rankSearchResults(
      (
        data.Page.media ??
        []
      )
        .filter(
          (anime) =>
            !isAdultAnime(
              anime,
            ),
        )
        .map(
          mapAniSlim,
        ),
      params.q,
    ),

    page,

    hasNext:
      Boolean(
        data.Page.pageInfo
          ?.hasNextPage,
      ),

    source: "anilist",
  };
}

async function searchJikan(
  params: SearchParams,
): Promise<SearchResult> {
  const page =
    params.page ?? 1;

  const query =
    new URLSearchParams();

  if (params.q) {
    query.set(
      "q",
      params.q,
    );
  }

  query.set(
    "page",
    String(page),
  );

  query.set(
    "limit",
    "24",
  );

  query.set(
    "sfw",
    "true",
  );

  if (params.genre) {
    query.set(
      "genres",
      params.genre,
    );
  }

  const json =
    await jikanFetch<{
      pagination?: {
        has_next_page?: boolean;
      };

      data?: JikanAnime[];
    }>(
      `/anime?${query.toString()}`,
    );

  return {
    items: rankSearchResults(
      (
        json.data ?? []
      ).map(
        mapJikanSlim,
      ),
      params.q,
    ),

    page,

    hasNext:
      Boolean(
        json.pagination
          ?.has_next_page,
      ),

    source: "jikan",
  };
}

async function searchRelaxed(
  params: SearchParams,
): Promise<SlimAnime[]> {
  const original =
    params.q?.trim() ?? "";

  const normalized =
    normalizeSearchText(
      original,
    );

  if (
    normalized.length < 2
  ) {
    return [];
  }

  const compact =
    normalized.replace(
      /\s/g,
      "",
    );

  const words =
    normalized
      .split(/\s+/)
      .filter(Boolean);

  const variants =
    new Set<string>();

  variants.add(
    normalized,
  );

  if (compact) {
    variants.add(
      compact,
    );
  }

  if (
    words.length > 1
  ) {
    variants.add(
      words[0],
    );
  }

  for (
    let length =
      normalized.length - 1;
    length >= 2;
    length--
  ) {
    variants.add(
      normalized.slice(
        0,
        length,
      ),
    );

    if (
      normalized.length -
        length >=
      4
    ) {
      break;
    }
  }

  const validVariants =
    [...variants].filter(
      (value) =>
        value.trim().length >= 2,
    );

  const allResults =
    await Promise.all(
      validVariants.map(
        async (variant) => {
          const searchParams:
            SearchParams = {
            ...params,
            q: variant,
            page: 1,
          };

          const results =
            await Promise.allSettled(
              [
                searchAni(
                  searchParams,
                ),
                searchJikan(
                  searchParams,
                ),
              ],
            );

          const ani =
            results[0].status ===
            "fulfilled"
              ? results[0].value
                  .items
              : [];

          const jikan =
            results[1].status ===
            "fulfilled"
              ? results[1].value
                  .items
              : [];

          return mergeSearchItems(
            ani,
            jikan,
          );
        },
      ),
    );

  const merged =
    allResults.reduce(
      (
        accumulated,
        current,
      ) =>
        mergeSearchItems(
          accumulated,
          current,
        ),
      [] as SlimAnime[],
    );

  const ranked =
    merged
      .map(
        (
          anime,
          index,
        ) => ({
          anime,
          score:
            searchScore(
              anime,
              original,
            ),
          index,
        }),
      )
      .sort(
        (a, b) => {
          if (
            b.score !==
            a.score
          ) {
            return (
              b.score -
              a.score
            );
          }

          return (
            a.index -
            b.index
          );
        },
      )
      .map(
        (item) =>
          item.anime,
      );

  return ranked;
}

export const searchCatalog =
  createServerFn({
    method: "GET",
  })
    .validator(
      searchSchema,
    )
    .handler(
      async ({
        data,
      }) => {
        const key =
          `search:${JSON.stringify(data)}`;

        const cached =
          fromCache<SearchResult>(
            key,
          );

        if (cached) {
          return cached;
        }

        const q =
          data.q?.trim() ?? "";

        if (q) {
          const results =
            await Promise.allSettled([
              searchAni(data),
              searchJikan(data),
            ]);

          const aniResult =
            results[0].status ===
            "fulfilled"
              ? results[0].value
              : null;

          const jikanResult =
            results[1].status ===
            "fulfilled"
              ? results[1].value
              : null;

          let items =
            rankSearchResults(
              mergeSearchItems(
                aniResult?.items ??
                  [],
                jikanResult?.items ??
                  [],
              ),
              q,
            );

          const hasStrongMatch =
            items.some(
              (anime) =>
                searchScore(
                  anime,
                  q,
                ) >= 700,
            );

          if (
            !hasStrongMatch
          ) {
            try {
              const relaxed =
                await searchRelaxed(
                  data,
                );

              items =
                rankSearchResults(
                  mergeSearchItems(
                    items,
                    relaxed,
                  ),
                  q,
                );
            } catch {
              // Mantém os resultados atuais.
            }
          }

          const scored =
            items
              .map(
                (
                  anime,
                  index,
                ) => ({
                  anime,
                  score:
                    searchScore(
                      anime,
                      q,
                    ),
                  index,
                }),
              )
              .filter(
                (item) =>
                  item.score > 0,
              )
              .sort(
                (a, b) =>
                  b.score -
                    a.score ||
                  a.index -
                    b.index,
              )
              .map(
                (item) =>
                  item.anime,
              );

          if (
            scored.length > 0
          ) {
            items = scored;
          }

          const result:
            SearchResult = {
            items:
              items.slice(
                0,
                24,
              ),

            page:
              data.page ??
              1,

            hasNext:
              Boolean(
                aniResult?.hasNext ||
                  jikanResult?.hasNext,
              ),

            source:
              aniResult &&
              jikanResult
                ? "anilist"
                : aniResult
                  ? "anilist"
                  : "jikan",
          };

          return toCache(
            key,
            result,
          );
        }

        try {
          return toCache(
            key,
            await searchAni(
              data,
            ),
          );
        } catch {
          return toCache(
            key,
            await searchJikan(
              data,
            ),
          );
        }
      },
    );

/*
 * 🔞 CATÁLOGO +18
 *
 * Este catálogo é separado
 * do conteúdo normal da Home,
 * busca e categorias.
 */
export const fetchAdultCatalog =
  createServerFn({
    method: "GET",
  }).handler(
    async () => {
      const key =
        "adult-catalog";

      const cached =
        fromCache<SearchResult>(
          key,
        );

      if (cached) {
        return cached;
      }

      const data =
        await anilistGraphQL<{
          Page: {
            pageInfo: {
              hasNextPage: boolean;
            };

            media: AniMedia[];
          };
        }>(
          `
          query AdultCatalog {
            Page(
              page: 1,
              perPage: 30
            ) {
              pageInfo {
                hasNextPage
              }

              media(
                type: ANIME,
                isAdult: true,
                sort: TRENDING_DESC
              ) {
                ${CARD_FIELDS}
              }
            }
          }
          `,
        );

      const items =
        (
          data.Page.media ??
          []
        )
          .filter(
            (anime) =>
              isAdultAnime(
                anime,
              ),
          )
          .map(
            mapAniSlim,
          );

      return toCache(
        key,
        {
          items,

          page: 1,

          hasNext:
            Boolean(
              data.Page
                .pageInfo
                ?.hasNextPage,
            ),

          source:
            "anilist" as const,
        },
      );
    },
  );

const idSchema =
  z.object({
    id: z.string(),
  });

export const fetchAnimeDetail =
  createServerFn({
    method: "GET",
  })
    .validator(idSchema)
    .handler(
      async ({
        data,
      }) => {
        const { id } =
          data;

        if (
          id.startsWith(
            "local-",
          )
        ) {
          return null;
        }

        const key =
          `detail:${id}`;

        const cached =
          fromCache<Anime>(
            key,
          );

        if (cached) {
          return cached;
        }

        if (
          id.startsWith(
            "mal-",
          )
        ) {
          const malId =
            Number(
              id.replace(
                "mal-",
                "",
              ),
            );

          const json =
            await jikanFetch<{
              data: JikanAnime;
            }>(
              `/anime/${malId}/full`,
            );

          const slim =
            mapJikanSlim(
              json.data,
            );

          let seasons: Season[] =
            [];

          try {
            seasons =
              await jikanEpisodes(
                malId,
              );
          } catch {
            seasons = [];
          }

          const anime: Anime =
            {
              ...slim,

              studios: (
                json.data
                  .studios ?? []
              ).map(
                (studio) =>
                  studio.name,
              ),

              streamingEpisodes:
                [],

              seasons,

              recommendations:
                [],
            };

          return toCache(
            key,
            anime,
          );
        }

        const anilistId =
          Number(id);

        if (
          !Number.isFinite(
            anilistId,
          )
        ) {
          return null;
        }

        try {
          const result =
            await anilistGraphQL<{
              Media:
                | AniMedia
                | null;
            }>(
              `
              query Detail($id: Int) {
                Media(
                  id: $id,
                  type: ANIME
                ) {
                  ${CARD_FIELDS}

                  duration

                  studios(
                    isMain: true
                  ) {
                    nodes {
                      name
                    }
                  }

                  nextAiringEpisode {
                    episode
                    airingAt
                  }

                  streamingEpisodes {
                    title
                    thumbnail
                    url
                    site
                  }

                  recommendations(
                    sort: RATING_DESC,
                    perPage: 10
                  ) {
                    nodes {
                      mediaRecommendation {
                        id
                        idMal

                        title {
                          romaji
                          english
                          native
                        }

                        coverImage {
                          extraLarge
                          large
                          color
                        }

                        bannerImage
                        averageScore
                        genres
                        format
                        status
                        episodes
                        season
                        seasonYear

                        trailer {
                          id
                          site
                        }
                      }
                    }
                  }
                }
              }
              `,
              {
                id: anilistId,
              },
            );

          const media =
            result.Media;

          if (!media) {
            return null;
          }

          let seasons: Season[] =
            [];

          if (media.idMal) {
            try {
              seasons =
                await jikanEpisodes(
                  media.idMal,
                );
            } catch {
              seasons = [];
            }
          }

          if (
            !seasons.length &&
            (
              media
                .streamingEpisodes
                ?.length ||
              media.episodes
            )
          ) {
            const fromStream:
              Episode[] =
              (
                media
                  .streamingEpisodes ??
                []
              ).map(
                (
                  episode,
                  index,
                ) => ({
                  id: `stream-${media.id}-${index}`,

                  number:
                    index + 1,

                  title:
                    episode.title ??
                    `Episódio ${index + 1}`,

                  thumbnail:
                    episode.thumbnail,

                  videoUrl:
                    episode.url,
                }),
              );

            const count =
              media.episodes ??
              fromStream.length;

            const episodes =
              fromStream.length >=
              count
                ? fromStream
                : Array.from(
                    {
                      length:
                        count,
                    },
                    (
                      _,
                      index,
                    ) => {
                      const found =
                        fromStream[
                          index
                        ];

                      return (
                        found ?? {
                          id: `ep-${media.id}-${index + 1}`,

                          number:
                            index + 1,

                          title:
                            `Episódio ${index + 1}`,
                        }
                      );
                    },
                  );

            seasons = [
              {
                id: `s1-${media.id}`,

                number: 1,

                title:
                  "Temporada 1",

                episodes,
              },
            ];
          }

          return toCache(
            key,
            mapAniFull(
              media,
              seasons,
            ),
          );
        } catch {
          try {
            const json =
              await jikanFetch<{
                data: JikanAnime;
              }>(
                `/anime/${anilistId}/full`,
              );

            const slim =
              mapJikanSlim(
                json.data,
              );

            let seasons: Season[] =
              [];

            try {
              seasons =
                await jikanEpisodes(
                  anilistId,
                );
            } catch {
              seasons = [];
            }

            return toCache(
              key,
              {
                ...slim,

                studios: (
                  json.data
                    .studios ?? []
                ).map(
                  (studio) =>
                    studio.name,
                ),

                streamingEpisodes:
                  [],

                seasons,

                recommendations:
                  [],
              },
            );
          } catch {
            return null;
          }
        }
      },
    );

const browseSchema =
  z.object({
    section: z.enum([
      "popular",
      "season",
      "top",
      "trending",
    ]),

    page:
      z.number().optional(),
  });

export const fetchBrowse =
  createServerFn({
    method: "GET",
  })
    .validator(
      browseSchema,
    )
    .handler(
      async ({
        data,
      }) => {
        const page =
          data.page ?? 1;

        const key =
          `browse:${data.section}:${page}`;

        const cached =
          fromCache<SearchResult>(
            key,
          );

        if (cached) {
          return cached;
        }

        const {
          season,
          year,
        } =
          currentAnimeSeason();

        const sortMap = {
          popular:
            "POPULARITY_DESC",

          top:
            "SCORE_DESC",

          trending:
            "TRENDING_DESC",

          season:
            "POPULARITY_DESC",
        } as const;

        try {
          const isSeason =
            data.section ===
            "season";

          const result =
            await anilistGraphQL<{
              Page: {
                pageInfo: {
                  hasNextPage: boolean;
                };

                media: AniMedia[];
              };
            }>(
              isSeason
                ? `
            query BrowseSeason(
              $page: Int,
              $sort: [MediaSort],
              $season: MediaSeason,
              $year: Int
            ) {
              Page(
                page: $page,
                perPage: 24
              ) {
                pageInfo {
                  hasNextPage
                }

                media(
                  type: ANIME,
                  sort: $sort,
                  season: $season,
                  seasonYear: $year
                ) {
                  ${CARD_FIELDS}
                }
              }
            }
            `
                : `
            query Browse(
              $page: Int,
              $sort: [MediaSort]
            ) {
              Page(
                page: $page,
                perPage: 24
              ) {
                pageInfo {
                  hasNextPage
                }

                media(
                  type: ANIME,
                  sort: $sort
                ) {
                  ${CARD_FIELDS}
                }
              }
            }
            `,
              isSeason
                ? {
                    page,

                    sort: [
                      sortMap.season,
                    ],

                    season,

                    year,
                  }
                : {
                    page,

                    sort: [
                      sortMap[
                        data.section
                      ],
                    ],
                  },
            );

          return toCache(
            key,
            {
              items: (
                result.Page
                  .media ?? []
              )
                .filter(
                  (anime) =>
                    !isAdultAnime(
                      anime,
                    ),
                )
                .map(
                  mapAniSlim,
                ),

              page,

              hasNext:
                Boolean(
                  result.Page
                    .pageInfo
                    ?.hasNextPage,
                ),

              source:
                "anilist" as const,
            },
          );
        } catch {
          const path =
            data.section ===
            "top"
              ? `/top/anime?page=${page}&limit=24`
              : data.section ===
                  "popular"
                ? `/top/anime?filter=bypopularity&page=${page}&limit=24`
                : `/seasons/now?page=${page}&limit=24`;

          const json =
            await jikanFetch<{
              pagination?: {
                has_next_page?: boolean;
              };

              data?: JikanAnime[];
            }>(path);

          return toCache(
            key,
            {
              items: (
                json.data ??
                []
              ).map(
                mapJikanSlim,
              ),

              page,

              hasNext:
                Boolean(
                  json.pagination
                    ?.has_next_page,
                ),

              source:
                "jikan" as const,
            },
          );
        }
      },
    );
