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

const ANILIST = "https://grokhikari.vercel.app/api-anilist";
const JIKAN = "https://api.jikan.moe/v4";

const CARD_FIELDS = `
  id
  idMal
  isAdult
  tags {
    name
    category
    rank
    isAdult
  }
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

type SeasonNavigationItem = {
  id: string;
  title?: string;
};

type SeasonNavigation = {
  items: SeasonNavigationItem[];
  previous?: SeasonNavigationItem;
  next?: SeasonNavigationItem;
};

type AniMedia = {
  id: number;
  idMal?: number | null;
  isAdult?: boolean;

  tags?: {
    name: string;
    category?: string | null;
    rank?: number | null;
    isAdult?: boolean | null;
  }[] | null;

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

  relations?: {
    edges?: {
      relationType?: string | null;
      node?: {
        id: number;
        title?: AniTitle | null;
      } | null;
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
  let lastError: unknown;

  for (
    let attempt = 0;
    attempt < 2;
    attempt++
  ) {
    try {
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
        const shouldRetry =
          res.status === 429 ||
          res.status >= 500;

        if (
          shouldRetry &&
          attempt === 0
        ) {
          await new Promise(
            (resolve) =>
              setTimeout(
                resolve,
                350,
              ),
          );
          continue;
        }

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
    } catch (error) {
      lastError = error;

      if (attempt === 0) {
        await new Promise(
          (resolve) =>
            setTimeout(
              resolve,
              350,
            ),
        );
        continue;
      }

      throw error;
    }
  }

  throw (
    lastError instanceof Error
      ? lastError
      : new Error(
          "AniList indisponível",
        )
  );
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

function isHentaiAnime(
  media: AniMedia,
): boolean {
  return (
    media.isAdult === true &&
    (media.genres ?? []).some(
      (genre) =>
        genre.trim().toLowerCase() ===
        "hentai",
    )
  );
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

async function fetchAniMediaByMalId(
  malId: number,
): Promise<AniMedia | null> {
  const result =
    await anilistGraphQL<{
      Media: AniMedia | null;
    }>(
      `
      query MediaByMalId($malId: Int) {
        Media(
          idMal: $malId,
          type: ANIME
        ) {
          id
          idMal
          title {
            romaji
            english
            native
          }
          relations {
            edges {
              relationType
              node {
                id
                title {
                  romaji
                  english
                }
              }
            }
          }
        }
      }
      `,
      { malId },
    );

  return result.Media;
}

async function buildSeasonNavigation(
  media: AniMedia,
): Promise<SeasonNavigation> {
  const current: SeasonNavigationItem = {
    id: String(media.id),
    title:
      media.title?.english ??
      media.title?.romaji ??
      undefined,
  };

  const findRelation = (
    source: AniMedia,
    type: "PREQUEL" | "SEQUEL",
  ) =>
    (source.relations?.edges ?? []).find(
      (relation) =>
        relation.relationType === type &&
        Boolean(relation.node?.id),
    )?.node;

  const fetchRelations = async (
    id: number,
  ): Promise<AniMedia["relations"]> => {
    const result =
      await anilistGraphQL<{
        Media:
          | Pick<AniMedia, "relations">
          | null;
      }>(
        `
        query SeasonRelations($id: Int) {
          Media(id: $id, type: ANIME) {
            relations {
              edges {
                relationType
                node {
                  id
                  title {
                    romaji
                    english
                  }
                }
              }
            }
          }
        }
        `,
        { id },
      );

    return result.Media?.relations;
  };

  const previous: SeasonNavigationItem[] = [];
  const next: SeasonNavigationItem[] = [];
  const visited = new Set<string>([current.id]);

  let cursor = findRelation(media, "PREQUEL");
  let steps = 0;

  while (cursor?.id && steps < 10) {
    const item: SeasonNavigationItem = {
      id: String(cursor.id),
      title:
        cursor.title?.english ??
        cursor.title?.romaji ??
        undefined,
    };

    if (visited.has(item.id)) break;
    visited.add(item.id);
    previous.unshift(item);
    steps++;

    const relations = await fetchRelations(cursor.id);
    cursor = relations
      ? (relations.edges ?? []).find(
          (relation) =>
            relation.relationType ===
              "PREQUEL" &&
            Boolean(relation.node?.id),
        )?.node
      : undefined;
  }

  cursor = findRelation(media, "SEQUEL");
  steps = 0;

  while (cursor?.id && steps < 10) {
    const item: SeasonNavigationItem = {
      id: String(cursor.id),
      title:
        cursor.title?.english ??
        cursor.title?.romaji ??
        undefined,
    };

    if (visited.has(item.id)) break;
    visited.add(item.id);
    next.push(item);
    steps++;

    const relations = await fetchRelations(cursor.id);
    cursor = relations
      ? (relations.edges ?? []).find(
          (relation) =>
            relation.relationType ===
              "SEQUEL" &&
            Boolean(relation.node?.id),
        )?.node
      : undefined;
  }

  return {
    items: [
      ...previous,
      current,
      ...next,
    ],
    previous: previous.at(-1),
    next: next[0],
  };
}

function mapAniFull(
  media: AniMedia,
  seasons: Season[],
  seasonNavigation?: SeasonNavigation,
): Anime & {
  seasonNavigation: SeasonNavigation;
} {
  const slim =
    mapAniSlim(media);

  const relations =
    media.relations?.edges ?? [];

  const previousRelation =
    relations.find(
      (relation) =>
        relation.relationType ===
        "PREQUEL",
    );

  const nextRelation =
    relations.find(
      (relation) =>
        relation.relationType ===
        "SEQUEL",
    );

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

    seasonNavigation:
      seasonNavigation ?? {
        items: [
          {
            id: String(media.id),
            title:
              media.title?.english ??
              media.title?.romaji ??
              undefined,
          },
        ],

        previous:
          previousRelation?.node?.id
            ? {
                id: String(
                  previousRelation.node.id,
                ),
                title:
                  previousRelation.node
                    .title?.english ??
                  previousRelation.node
                    .title?.romaji ??
                  undefined,
              }
            : undefined,

        next:
          nextRelation?.node?.id
            ? {
                id: String(
                  nextRelation.node.id,
                ),
                title:
                  nextRelation.node
                    .title?.english ??
                  nextRelation.node
                    .title?.romaji ??
                  undefined,
              }
            : undefined,
      },

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

async function fetchRecentAdultReleasesFromAni(): Promise<
  SlimAnime[]
> {
  const now =
    Math.floor(
      Date.now() / 1000,
    );

  const recentWindow =
    now -
    90 * 24 * 60 * 60;

  const seen =
    new Set<number>();

  const releases: SlimAnime[] =
    [];

  for (
    let page = 1;
    page <= 3 && releases.length < 18;
    page++
  ) {
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
        query RecentAdultReleases(
          $airingAtGreater: Int,
          $airingAtLesser: Int,
          $page: Int!
        ) {
          Page(
            page: $page,
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
            recentWindow,

          airingAtLesser:
            now,

          page,
        },
      );

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
        !isHentaiAnime(media)
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
  }

  return releases;
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

    adult:
      z.boolean().optional(),
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

function searchDistance(
  a: string,
  b: string,
): number {
  if (a === b) {
    return 0;
  }

  if (!a) {
    return b.length;
  }

  if (!b) {
    return a.length;
  }

  const previous = Array.from(
    { length: b.length + 1 },
    (_, i) => i,
  );

  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = previous[0];
    previous[0] = i;

    for (let j = 1; j <= b.length; j += 1) {
      const above = previous[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;

      previous[j] = Math.min(
        previous[j] + 1,
        previous[j - 1] + 1,
        diagonal + cost,
      );

      diagonal = above;
    }
  }

  return previous[b.length];
}

function searchScore(
  anime: SlimAnime,
  query: string,
): number {
  const q = normalizeSearchText(query);

  if (!q) {
    return 0;
  }

  const titles = [
    anime.titles.romaji,
    anime.titles.english,
    anime.titles.native,
  ]
    .filter(Boolean)
    .map(normalizeSearchText);

  const compactQuery = q.replace(/\s/g, "");
  const queryWords = q.split(" ").filter(Boolean);
  let score = 0;

  for (const title of titles) {
    const compactTitle = title.replace(/\s/g, "");
    const titleWords = title.split(" ").filter(Boolean);

    if (title === q) {
      score = Math.max(score, 1200);
      continue;
    }

    if (title.startsWith(q)) {
      score = Math.max(score, 1100);
    }

    if (compactTitle.startsWith(compactQuery)) {
      score = Math.max(score, 1050);
    }

    if (title.includes(q)) {
      score = Math.max(score, 950);
    }

    if (compactTitle.includes(compactQuery)) {
      score = Math.max(score, 900);
    }

    const allWordsMatch = queryWords.every((queryWord) =>
      titleWords.some((titleWord) => titleWord.startsWith(queryWord)),
    );

    if (allWordsMatch) {
      score = Math.max(score, 1000);
    }

    /*
     * Tolerância pequena para erros de digitação.
     * Só entra quando a palavra pesquisada é razoavelmente grande,
     * evitando resultados aleatórios para buscas muito curtas.
     */
    if (compactQuery.length >= 4) {
      const closeWord = titleWords.some((titleWord) => {
        if (titleWord.length < compactQuery.length - 1) {
          return false;
        }

        const sample = titleWord.slice(0, compactQuery.length);
        const distance = searchDistance(compactQuery, sample);

        return distance <= (compactQuery.length >= 7 ? 2 : 1);
      });

      if (closeWord) {
        score = Math.max(score, 820);
      }
    }

    /*
     * Também aceita uma sequência de caracteres que aparece na ordem
     * correta dentro do título, mesmo com caracteres intermediários.
     */
    if (compactQuery.length >= 4) {
      let queryIndex = 0;

      for (const character of compactTitle) {
        if (character === compactQuery[queryIndex]) {
          queryIndex += 1;

          if (queryIndex === compactQuery.length) {
            break;
          }
        }
      }

      if (queryIndex === compactQuery.length) {
        score = Math.max(score, 650);
      }
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

        relevance:
          searchScore(
            anime,
            query,
          ),

        rating:
          anime.score ??
          -1,

        index,
      }),
    )
    .sort(
      (a, b) =>
        b.relevance -
          a.relevance ||
        b.rating - a.rating ||
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

type SearchRequestParams =
  SearchParams & {
    adult?: boolean;
  };

async function searchAni(
  params: SearchRequestParams,
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
        $sort: [MediaSort],
        $isAdult: Boolean
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
            sort: $sort,
            isAdult: $isAdult
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
          params.adult
            ? "Hentai"
            : params.genre ||
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

        isAdult:
          Boolean(params.adult),
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
            params.adult
              ? isHentaiAnime(
                  anime,
                )
              : !isAdultAnime(
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
  params: SearchRequestParams,
): Promise<SearchResult> {
  const page =
    params.page ?? 1;

  if (params.adult) {
    return {
      items: [],
      page,
      hasNext: false,
      source: "jikan",
    };
  }

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
  params: SearchRequestParams,
): Promise<SlimAnime[]> {
  const original = params.q?.trim() ?? "";
  const normalized = normalizeSearchText(original);

  if (normalized.length < 2) {
    return [];
  }

  const compact = normalized.replace(/\s/g, "");
  const variants = new Set<string>();

  variants.add(original);
  variants.add(normalized);

  if (compact && compact !== normalized) {
    variants.add(compact);
  }

  // Para pesquisas curtas, uma única redução já é suficiente.
  // Evitamos várias consultas em cascata que deixavam a busca lenta.
  if (compact.length >= 4) {
    variants.add(compact.slice(0, -1));
  }

  if (compact.length >= 6) {
    variants.add(compact.slice(0, -2));
  }

  const validVariants = [...variants].filter(
    (value) => value.trim().length >= 3,
  );

  const attempts = validVariants.map(async (variant) => {
    const searchParams: SearchRequestParams = {
      ...params,
      q: variant,
      page: 1,
    };

    const results = await Promise.allSettled([
      searchAni(searchParams),
      searchJikan(searchParams),
    ]);

    const ani =
      results[0].status === "fulfilled"
        ? results[0].value.items
        : [];

    const jikan =
      results[1].status === "fulfilled"
        ? results[1].value.items
        : [];

    const items = rankSearchResults(
      mergeSearchItems(ani, jikan),
      original,
    );

    return items;
  });

  // Assim que uma variante produzir uma correspondência forte,
  // podemos responder sem esperar as outras consultas.
  const pending = new Set(attempts);

  while (pending.size > 0) {
    const settled = await Promise.race(
      [...pending].map(async (promise) => ({
        promise,
        items: await promise,
      })),
    );

    pending.delete(settled.promise);

    if (
      settled.items.some(
        (anime) =>
          searchScore(anime, original) >= 1100,
      )
    ) {
      return settled.items;
    }
  }

  // Se nenhuma variante encontrou correspondência forte,
  // combina os resultados que já terminaram.
  const completed = await Promise.all(attempts);

  return rankSearchResults(
    completed.reduce(
      (accumulated, current) =>
        mergeSearchItems(accumulated, current),
      [] as SlimAnime[],
    ),
    original,
  );
}

function isStrongSearchResult(
  items: SlimAnime[],
  query: string,
): boolean {
  return items.some(
    (anime) =>
      searchScore(anime, query) >= 1100,
  );
}

async function searchDirectFast(
  params: SearchRequestParams,
): Promise<{
  items: SlimAnime[];
  hasNext: boolean;
  source: "anilist" | "jikan";
}> {
  const attempts = [
    searchAni(params).catch(() => null),
    searchJikan(params).catch(() => null),
  ];

  const pending = new Set(attempts);
  const results: SearchResult[] = [];

  while (pending.size > 0) {
    const settled = await Promise.race(
      [...pending].map(async (promise) => ({
        promise,
        result: await promise,
      })),
    );

    pending.delete(settled.promise);

    if (!settled.result) {
      continue;
    }

    results.push(settled.result);

    // Se uma fonte já encontrou o título certo, não precisamos esperar
    // uma segunda API mais lenta para mostrar o resultado ao usuário.
    if (
      params.q &&
      isStrongSearchResult(
        settled.result.items,
        params.q,
      )
    ) {
      return {
        items: rankSearchResults(
          settled.result.items,
          params.q,
        ),
        hasNext: settled.result.hasNext,
        source: settled.result.source,
      };
    }
  }

  const merged = results.reduce(
    (accumulated, current) =>
      mergeSearchItems(
        accumulated,
        current.items,
      ),
    [] as SlimAnime[],
  );

  return {
    items: rankSearchResults(
      merged,
      params.q,
    ),
    hasNext: results.some(
      (result) => result.hasNext,
    ),
    source: results[0]?.source ?? "anilist",
  };
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
          `search:v4:${JSON.stringify(data)}`;

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
          /*
           * Pesquisa direta nas duas fontes ao mesmo tempo.
           * Antes o Hikari esperava o AniList terminar para só então
           * consultar o Jikan. Se o AniList demorasse, a busca inteira
           * ficava lenta ou podia terminar sem resultado.
           */
          const direct = await searchDirectFast(data);

          let items = direct.items;

          /*
           * Se as fontes diretas não encontrarem uma correspondência forte e
           * direta (não apenas uma aproximação por erro de digitação),
           * aí sim fazemos a busca flexível para erros e abreviações.
           * Ex.: "naru", "narut", "jujut".
           */
          const hasStrongMatch = items.some(
            (anime) =>
              searchScore(anime, q) >= 1100,
          );

          if (!hasStrongMatch) {
            try {
              const relaxed =
                await searchRelaxed(data);

              items = rankSearchResults(
                mergeSearchItems(
                  items,
                  relaxed,
                ),
                q,
              );
            } catch {
              // Mantém os resultados diretos já encontrados.
            }
          }

          const result: SearchResult = {
            items: items.slice(0, 24),
            page: data.page ?? 1,
            hasNext: direct.hasNext,
            source: direct.source,
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
        "adult-catalog:v2";

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
                genre: "Hentai",
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
              isHentaiAnime(
                anime,
              ),
          )
          .map(
            mapAniSlim,
          );

      const recentItems =
        await fetchRecentAdultReleasesFromAni();

      return toCache(
        key,
        {
          items,
          recentItems,

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


const MAIN_ADULT_TAGS = [
  { name: "Anal", type: "tag", aliases: ["Anal Sex"] },
  { name: "Boquete", type: "tag", aliases: ["Fellatio"] },
  { name: "Harém", type: "tag", aliases: ["Female Harem", "Male Harem", "Mixed Gender Harem"] },
  { name: "Incesto", type: "tag", aliases: ["Incest"] },
  { name: "Lactante", type: "tag", aliases: ["Lactation"] },
  { name: "Milf", type: "tag", aliases: ["MILF"] },
  { name: "Futanari", type: "tag", aliases: ["Futanari"] },
  { name: "Ecchi", type: "genre", aliases: ["Ecchi"] },
  { name: "Yuri", type: "tag", aliases: ["Yuri"] },
  { name: "Yaoi", type: "tag", aliases: ["Boys' Love"] },
  { name: "Romance", type: "genre", aliases: ["Romance"] },
  { name: "Masturbação", type: "tag", aliases: ["Masturbation"] },
  { name: "Orgia", type: "tag", aliases: ["Group Sex"] },
  { name: "Peitões", type: "tag", aliases: ["Large Breasts"] },
  { name: "Brinquedos", type: "tag", aliases: ["Sex Toys"] },
  { name: "BDSM", type: "tag", aliases: ["Bondage"] },
  { name: "Cunnilingus", type: "tag", aliases: ["Cunnilingus"] },
  { name: "Tentáculos", type: "tag", aliases: ["Tentacles"] },
  { name: "NTR", type: "tag", aliases: ["Netorare"] },
  { name: "Netorare", type: "tag", aliases: ["Netorare"] },
  { name: "Cosplay", type: "tag", aliases: ["Cosplay"] },
  { name: "Voyeur", type: "tag", aliases: ["Voyeur"] },
  { name: "Exibicionismo", type: "tag", aliases: ["Exhibitionism"] },
  { name: "Vida Escolar", type: "tag", aliases: ["School"] },
  { name: "Professora", type: "tag", aliases: ["Teacher"] },
  { name: "Boobjob", type: "tag", aliases: ["Boobjob"] },
  { name: "Empregada", type: "tag", aliases: ["Maids"] },
  { name: "Handjob", type: "tag", aliases: ["Handjob"] },
  { name: "Human Pet", type: "tag", aliases: ["Human Pet"] },
  { name: "Sumata", type: "tag", aliases: ["Sumata"] },
  { name: "Office / Escritório", type: "tag", aliases: ["Office"] },
  { name: "Comédia", type: "genre", aliases: ["Comedy"] },
  { name: "Magia", type: "tag", aliases: ["Magic"] },
  { name: "Elfos", type: "tag", aliases: ["Elf"] },
  { name: "Demônios", type: "tag", aliases: ["Demons"] },
  { name: "Vampiros", type: "tag", aliases: ["Vampire"] },
  { name: "Terror", type: "genre", aliases: ["Horror"] },
  { name: "Virgem", type: "tag", aliases: ["Virginity"] },
  { name: "Esporte", type: "genre", aliases: ["Sports"] },
  { name: "Ahegao", type: "tag", aliases: ["Ahegao"] },
] as const;

const ADULT_FEATURED_TAGS = [
  "Anal", "Boquete", "Harém", "Incesto", "Lactante", "Milf", "Futanari", "Ecchi", "Yuri", "Yaoi", "Romance", "Masturbação", "Orgia", "Peitões", "Brinquedos", "BDSM", "Cunnilingus", "Tentáculos", "NTR", "Netorare", "Cosplay", "Voyeur", "Exibicionismo", "Vida Escolar", "Professora", "Boobjob", "Empregada", "Handjob", "Human Pet", "Sumata", "Office / Escritório", "Comédia", "Magia", "Elfos", "Demônios", "Vampiros", "Terror", "Virgem", "Esporte", "Ahegao",
] as const;



const ADULT_REMOVED_TAGS = new Set([
  "travesti",
  "trans",
  "super poderes",
  "mistério",
  "ninjas",
  "monstros",
  "gay",
]);

export const fetchAdultTags =
  createServerFn({
    method: "GET",
  }).handler(
    async () => {
      const key =
        "adult-tags:v10";

      const cached =
        fromCache<AdultTagCatalog>(
          key,
        );

      if (cached) {
        return cached;
      }

      const allMedia =
        new Map<number, AniMedia>();

      const addMedia = (
        media:
          | AniMedia[]
          | null
          | undefined,
      ) => {
        for (const anime of media ?? []) {
          if (isHentaiAnime(anime)) {
            allMedia.set(
              anime.id,
              anime,
            );
          }
        }
      };

      // Busca complementar: alguns títulos com gênero Hentai
      // podem vir do AniList sem isAdult=true. Eles ainda precisam
      // entrar no catálogo de tags para que a tag seja contabilizada.
      const addFallbackMedia = (
        media:
          | AniMedia[]
          | null
          | undefined,
      ) => {
        for (const anime of media ?? []) {
          const isHentaiByGenre =
            (anime.genres ?? []).some(
              (genre) =>
                normalizeAdultTagName(genre) ===
                "hentai",
            );

          if (isHentaiByGenre) {
            allMedia.set(
              anime.id,
              anime,
            );
          }
        }
      };

      /*
       * Primeira página.
       * Fazemos uma requisição separada
       * para descobrir se existem mais páginas.
       */
      const firstPage =
        await anilistGraphQL<{
          Page: {
            pageInfo: {
              hasNextPage: boolean;
            };

            media: AniMedia[];
          };
        }>(
          `
          query AdultTagsFirst {
            Page(
              page: 1,
              perPage: 50
            ) {
              pageInfo {
                hasNextPage
              }

              media(
                type: ANIME,
                isAdult: true,
                genre: "Hentai",
                sort: TRENDING_DESC
              ) {
                ${CARD_FIELDS}
              }
            }
          }
          `,
        );

      addMedia(
        firstPage.Page.media,
      );

      let nextPage = 2;

      let hasNextPage =
        Boolean(
          firstPage.Page.pageInfo
            ?.hasNextPage,
        );

      /*
       * Em vez de fazer uma requisição
       * para cada página, agrupamos
       * 5 páginas em uma única query.
       */
      const batchSize = 5;

      while (hasNextPage) {
        const pages =
          Array.from(
            {
              length: batchSize,
            },
            (_, index) =>
              nextPage + index,
          );

        const pageFields =
          pages
            .map(
              (page) => `
                page${page}: Page(
                  page: ${page},
                  perPage: 50
                ) {
                  pageInfo {
                    hasNextPage
                  }

                  media(
                    type: ANIME,
                    isAdult: true,
                    genre: "Hentai",
                    sort: TRENDING_DESC
                  ) {
                    ${CARD_FIELDS}
                  }
                }
              `,
            )
            .join("\n");

        const data =
          await anilistGraphQL<
            Record<
              string,
              {
                pageInfo: {
                  hasNextPage: boolean;
                };

                media: AniMedia[];
              }
            >
          >(
            `
            query AdultTagsBatch {
              ${pageFields}
            }
            `,
          );

        hasNextPage = false;

        for (const page of pages) {
          const result =
            data[
              `page${page}`
            ];

          if (!result) {
            continue;
          }

          addMedia(
            result.media,
          );

          if (
            result.pageInfo
              ?.hasNextPage
          ) {
            hasNextPage = true;
          }
        }

        nextPage += batchSize;

        /*
         * Pequena pausa entre os lotes
         * para evitar muitas requisições
         * em sequência.
         */
        if (hasNextPage) {
          await new Promise(
            (resolve) =>
              setTimeout(
                resolve,
                750,
              ),
          );
        }
      }

      /*
       * Algumas tags específicas podem não aparecer no primeiro
       * conjunto do catálogo adulto. Consultamos diretamente
       * as tags oficiais do AniList, sem criar aliases inventados.
       */
      const fallbackTags =
        MAIN_ADULT_TAGS.filter(
          (tag) => tag.type === "tag",
        );

      // Não consulte todas as tags em paralelo: isso dispara o rate limit
      // do AniList e provoca 429 (Too Many Requests).
      // Uma página por tag já basta para descobrir se existem resultados.
      for (const mainTag of fallbackTags) {
        const alias = mainTag.aliases[0];

        if (!alias) {
          continue;
        }

        try {
          const result =
            await anilistGraphQL<{
              Page: {
                media: AniMedia[];
              };
            }>(
              `
              query AdultTagFallback(
                $tag: String
              ) {
                Page(
                  page: 1,
                  perPage: 50
                ) {
                  media(
                    type: ANIME,
                    genre: "Hentai",
                    tag: $tag,
                    sort: TRENDING_DESC
                  ) {
                    ${CARD_FIELDS}
                  }
                }
              }
              `,
              { tag: alias },
            );

          addFallbackMedia(
            result.Page.media ?? [],
          );

          await new Promise(
            (resolve) => setTimeout(resolve, 350),
          );
        } catch {
          // Um erro em uma tag não interrompe as demais.
        }
      }

      const media =
        Array.from(
          allMedia.values(),
        );

      const items =
        media.map(
          mapAniSlim,
        );

      const tags =
        MAIN_ADULT_TAGS.map((mainTag) => {
          const aliases = new Set(
            [
              mainTag.name,
              ...mainTag.aliases,
            ].map(normalizeAdultTagName),
          );

          const animeIds = new Set<string>();

          for (const anime of media) {
            if (mainTag.type === "genre") {
              const matchesGenre =
                (anime.genres ?? []).some((genre) =>
                  aliases.has(
                    normalizeAdultTagName(genre),
                  ),
                );

              if (matchesGenre) {
                animeIds.add(String(anime.id));
              }

              continue;
            }

            const matchesTag =
              (anime.tags ?? []).some((tag) =>
                aliases.has(
                  normalizeAdultTagName(tag.name),
                ),
              );

            if (matchesTag) {
              animeIds.add(String(anime.id));
            }
          }

          return {
            name: mainTag.name,
            count: animeIds.size,
            animeIds: Array.from(animeIds),
          };
        });

      return toCache(
        key,
        {
          items,
          tags,
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
          `detail:v3:${id}`;

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

          let seasonNavigation:
            SeasonNavigation | undefined;

          try {
            const aniMedia =
              await fetchAniMediaByMalId(
                malId,
              );

            if (aniMedia) {
              const navigation =
                await buildSeasonNavigation(
                  aniMedia,
                );

              // A página MAL usa `mal-<id>` como URL
              // atual. Mantemos esse ID no item atual
              // para que ele fique selecionado, enquanto
              // as outras temporadas continuam apontando
              // para os IDs do AniList.
              const currentAniId =
                String(aniMedia.id);

              seasonNavigation = {
                ...navigation,

                items: navigation.items.map(
                  (item) =>
                    item.id === currentAniId
                      ? {
                          ...item,
                          id: `mal-${malId}`,
                        }
                      : item,
                ),
              };
            }
          } catch {
            seasonNavigation =
              undefined;
          }

          const anime: Anime & {
            seasonNavigation?: SeasonNavigation;
          } =
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

              seasonNavigation,
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

                  relations {
                    edges {
                      relationType
                      node {
                        id
                        title {
                          romaji
                          english
                        }
                      }
                    }
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

          const seasonNavigation =
            await buildSeasonNavigation(
              media,
            );

          return toCache(
            key,
            mapAniFull(
              media,
              seasons,
              seasonNavigation,
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

export const fetchGenres = createServerFn({
  method: "GET",
}).handler(async () => {
  const key = "genres:all";

  const cached =
    fromCache<string[]>(key);

  if (cached) {
    return cached;
  }

  try {
    const result =
      await anilistGraphQL<{
        GenreCollection: string[];
      }>(
        `
        query Genres {
          GenreCollection
        }
        `,
      );

    const genres =
      (result.GenreCollection ?? [])
        .filter(
          (genre) =>
            genre &&
            genre !== "Hentai",
        )
        .sort((a, b) =>
          a.localeCompare(b),
        );

    return toCache(
      key,
      genres,
    );
  } catch {
    return [];
  }
});

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

    season: z.enum([
      "WINTER",
      "SPRING",
      "SUMMER",
      "FALL",
    ]).optional(),

    year:
      z.number().optional(),

    genre:
      z.string().optional(),
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

        const current =
          currentAnimeSeason();

        const season =
          data.season ??
          current.season;

        const year =
          data.year ??
          current.year;

        const genre =
          data.genre?.trim() || undefined;

        const key =
          `browse:${data.section}:${season}:${year}:${genre ?? "all"}:${page}`;

        const cached =
          fromCache<SearchResult>(
            key,
          );

        if (cached) {
          return cached;
        }

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
              $sort: [MediaSort],
              $genre: String
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
                  genre: $genre
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

                    genre,
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
