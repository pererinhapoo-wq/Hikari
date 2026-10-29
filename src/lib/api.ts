import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  currentAnimeSeason,
  stripHtml,
  youtubeIdFrom,
} from "@/lib/utils";

import { seasonLabel } from "@/lib/labels";

import {
  displayTitle,
  type Anime,
  type AnimeCharacter,
  type AnimeStaff,
  type Episode,
  type HomeCatalog,
  type SearchParams,
  type SearchResult,
  type Season,
  type SlimAnime,
  type StreamingLink,
} from "@/lib/types";

import {
  getEmergencyFallbackCatalog,
  FALLBACK_ANIMES,
} from "@/lib/fallback-catalog";

const ANILIST = "https://graphql.anilist.co";
const JIKAN = "https://api.jikan.moe/v4";
const KITSU = "https://kitsu.io/api/edge";

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

const ANI_CREDITS_FIELDS = `
  studios {
    edges {
      isMain
      node {
        name
        isAnimationStudio
      }
    }
    nodes {
      name
    }
  }
  characters(sort: [ROLE, RELEVANCE, ID], perPage: 25) {
    edges {
      role
      node {
        id
        name {
          full
          native
        }
        image {
          large
          medium
        }
      }
      voiceActors(sort: [RELEVANCE, ID]) {
        id
        name {
          full
          native
        }
        image {
          large
          medium
        }
        languageV2
      }
    }
  }
  staff(sort: [RELEVANCE, ID], perPage: 25) {
    edges {
      role
      node {
        id
        name {
          full
          native
        }
        image {
          large
          medium
        }
      }
    }
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
    edges?: {
      isMain?: boolean | null;
      node?: {
        name?: string | null;
        isAnimationStudio?: boolean | null;
      } | null;
    }[] | null;
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
        idMal?: number | null;
        type?: string | null;
        format?: string | null;
        status?: string | null;
        episodes?: number | null;
        seasonYear?: number | null;
        startDate?: {
          year?: number | null;
          month?: number | null;
          day?: number | null;
        } | null;
        title?: AniTitle | null;
        coverImage?: {
          extraLarge?: string | null;
          large?: string | null;
        } | null;
        bannerImage?: string | null;
      } | null;
    }[] | null;
  } | null;

  source?: string | null;
  countryOfOrigin?: string | null;
  startDate?: { year?: number | null; month?: number | null; day?: number | null } | null;
  endDate?: { year?: number | null; month?: number | null; day?: number | null } | null;
  synonyms?: string[] | null;

  characters?: {
    edges?: {
      role?: string | null;
      node?: {
        id: number;
        name?: {
          full?: string | null;
          native?: string | null;
        } | null;
        image?: {
          large?: string | null;
          medium?: string | null;
        } | null;
      } | null;
      voiceActors?: {
        id: number;
        name?: {
          full?: string | null;
          native?: string | null;
        } | null;
        image?: {
          large?: string | null;
          medium?: string | null;
        } | null;
        languageV2?: string | null;
      }[] | null;
    }[] | null;
  } | null;

  staff?: {
    edges?: {
      role?: string | null;
      node?: {
        id: number;
        name?: {
          full?: string | null;
          native?: string | null;
        } | null;
        image?: {
          large?: string | null;
          medium?: string | null;
        } | null;
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

  // O AniList pode ficar temporariamente lento ou retornar 5xx/429.
  // Fazemos até 3 tentativas, com espera progressiva, para evitar
  // que uma falha momentânea derrube a página inteira.
  for (
    let attempt = 0;
    attempt < 3;
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
            "User-Agent":
              "Hikari/1.0 (anime streaming platform; +https://hikari.app)",
          },
          body: JSON.stringify({
            query,
            variables,
          }),
          signal:
            AbortSignal.timeout(
              6000,
            ),
        },
      );

      if (!res.ok) {
        if (
          res.status === 403 ||
          res.status === 401 ||
          res.status === 400 ||
          res.status === 404
        ) {
          const nonRetryErr = new Error(
            `AniList indisponível (${res.status})`,
          );
          (nonRetryErr as unknown as { nonRetryable?: boolean }).nonRetryable = true;
          throw nonRetryErr;
        }

        const retryable =
          res.status === 429 ||
          res.status === 500 ||
          res.status === 502 ||
          res.status === 503 ||
          res.status === 504;

        if (
          retryable &&
          attempt < 2
        ) {
          const retryAfter = Number(
            res.headers.get(
              "Retry-After",
            ),
          );

          const waitMs =
            Number.isFinite(
              retryAfter,
            ) &&
            retryAfter > 0
              ? Math.min(
                  retryAfter * 1000,
                  6000,
                )
              : 800 *
                (attempt + 1);

          await new Promise(
            (resolve) =>
              setTimeout(
                resolve,
                waitMs,
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

      const hasUsableData =
        json.data != null &&
        Object.values(
          json.data as Record<string, unknown>,
        ).some(
          (value) =>
            value !== null &&
            value !== undefined,
        );

      if (
        json.errors?.length &&
        !hasUsableData
      ) {
        throw new Error(
          json.errors[0]?.message ??
            "AniList error",
        );
      }

      if (!json.data || !hasUsableData) {
        throw new Error(
          "AniList sem dados",
        );
      }

      return json.data;
    } catch (error) {
      lastError = error;

      if ((error as unknown as { nonRetryable?: boolean })?.nonRetryable) {
        throw error;
      }

      if (attempt < 1) {
        await new Promise(
          (resolve) =>
            setTimeout(
              resolve,
              800 *
                (attempt + 1),
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
  try {
    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (typeof window === "undefined") {
      headers["User-Agent"] = "Hikari/1.0 (anime catalog)";
    }

    const res = await fetch(
      `${JIKAN}${path}`,
      {
        headers,
        signal:
          AbortSignal.timeout(
            3500,
          ),
      },
    );

    const retryable =
      res.status === 429 ||
      res.status === 500 ||
      res.status === 502 ||
      res.status === 503 ||
      res.status === 504;

    if (
      retryable &&
      attempt < 1
    ) {
      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            600 *
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
  } catch (error) {
    throw error instanceof Error
      ? error
      : new Error("MyAnimeList indisponível");
  }
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
  const cacheKey = `jikan-episodes:v2:${malId}`;
  const cached = fromCache<Season[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const episodes: Episode[] = [];

  let page = 1;
  let hasNext = true;

  // Limita a até 2 páginas para não bloquear a resposta em animes longos
  while (
    hasNext &&
    page <= 2
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

    try {
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
    } catch {
      break;
    }
  }

  if (!episodes.length) {
    return [];
  }

  const result: Season[] = [
    {
      id: `mal-s1-${malId}`,

      number: 1,

      title:
        "Temporada 1",

      episodes,
    },
  ];

  return toCache(cacheKey, result);
}

type JikanPictureItem = {
  jpg?: {
    image_url?: string | null;
    small_image_url?: string | null;
    large_image_url?: string | null;
  } | null;
  webp?: {
    image_url?: string | null;
    small_image_url?: string | null;
    large_image_url?: string | null;
  } | null;
};

/**
 * Consulta a galeria de fotos e artes promocionais oficiais do anime no MyAnimeList via Jikan API.
 * Retorna as URLs em alta resolução (large_image_url), com cache em memória e tratamento de erros.
 */
export async function fetchJikanPictures(malId: number): Promise<string[]> {
  if (!malId || !Number.isFinite(malId)) {
    return [];
  }

  const cacheKey = `jikan-pictures:v1:${malId}`;
  const cached = fromCache<string[]>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const json = await jikanFetch<{ data: JikanPictureItem[] }>(
      `/anime/${malId}/pictures`,
    );

    const urls: string[] = [];
    const seen = new Set<string>();

    for (const item of json.data ?? []) {
      // Prioriza a imagem em maior resolução disponível
      const best =
        item.jpg?.large_image_url ||
        item.webp?.large_image_url ||
        item.jpg?.image_url ||
        item.webp?.image_url;

      if (best && typeof best === "string" && best.trim().length > 0) {
        const clean = best.trim();
        const normKey = clean.replace(/^https?:\/\//i, "").split("?")[0].toLowerCase();
        if (!seen.has(normKey)) {
          seen.add(normKey);
          urls.push(clean);
        }
      }
    }

    return toCache(cacheKey, urls);
  } catch (error) {
    console.warn(`[Hikari] Jikan pictures indisponível para malId ${malId}:`, error);
    return toCache(cacheKey, []);
  }
}

export const fetchAnimePictures = createServerFn({
  method: "GET",
})
  .validator(
    z.object({
      malId: z.number(),
    }),
  )
  .handler(async ({ data }) => {
    return fetchJikanPictures(data.malId);
  });

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

function extractAniStudios(
  studios: AniMedia["studios"],
): string[] {
  const uniqueNames = (names: (string | null | undefined)[]): string[] => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of names) {
      const clean = raw?.trim();
      if (!clean) continue;
      const key = clean.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        out.push(clean);
      }
    }
    return out;
  };

  const edges = studios?.edges ?? [];
  const mainFromEdges = uniqueNames(
    edges
      .filter((edge) => edge?.isMain)
      .map((edge) => edge?.node?.name),
  );
  if (mainFromEdges.length > 0) {
    return mainFromEdges;
  }

  const animFromEdges = uniqueNames(
    edges
      .filter((edge) => edge?.node?.isAnimationStudio)
      .map((edge) => edge?.node?.name),
  );
  if (animFromEdges.length > 0) {
    return animFromEdges;
  }

  return uniqueNames((studios?.nodes ?? []).map((s) => s?.name));
}

function extractAniCharacters(
  characters: AniMedia["characters"],
): AnimeCharacter[] {
  const seenCharIds = new Set<string>();
  const out: AnimeCharacter[] = [];

  for (const edge of characters?.edges ?? []) {
    const fullName = (
      edge?.node?.name?.full ||
      edge?.node?.name?.native ||
      ""
    ).trim();
    if (!fullName) continue;

    const id = edge?.node?.id ?? 0;
    const dedupKey = id > 0 ? `id:${id}` : `name:${fullName.toLowerCase()}`;
    if (seenCharIds.has(dedupKey)) continue;
    seenCharIds.add(dedupKey);

    const seenVaIds = new Set<string>();
    const voiceActors = (edge?.voiceActors ?? [])
      .map((va) => {
        const vaFull = (va?.name?.full || va?.name?.native || "").trim();
        if (!vaFull) return null;
        const lang = (va?.languageV2 ?? "Japanese").trim() || "Japanese";
        const vaKey = `${va.id || vaFull.toLowerCase()}:${lang.toLowerCase()}`;
        if (seenVaIds.has(vaKey)) return null;
        seenVaIds.add(vaKey);
        return {
          id: va.id ?? 0,
          name: {
            full: vaFull,
            native: va?.name?.native?.trim() || undefined,
          },
          image: va?.image?.large || va?.image?.medium || undefined,
          language: lang,
        };
      })
      .filter((va): va is NonNullable<typeof va> => va !== null);

    out.push({
      id,
      name: {
        full: fullName,
        native: edge?.node?.name?.native?.trim() || undefined,
      },
      image: edge?.node?.image?.large || edge?.node?.image?.medium || undefined,
      role: (edge?.role ?? "SUPPORTING").toUpperCase() === "MAIN" ? "MAIN" : "SUPPORTING",
      voiceActors,
    });
  }

  return out;
}

function extractAniStaff(
  staff: AniMedia["staff"],
): AnimeStaff[] {
  const seen = new Set<string>();
  const out: AnimeStaff[] = [];

  for (const edge of staff?.edges ?? []) {
    const name = (
      edge?.node?.name?.full ||
      edge?.node?.name?.native ||
      ""
    ).trim();
    if (!name) continue;

    const role = (edge?.role ?? "").trim() || "Equipe técnica";
    const id = edge?.node?.id ?? 0;
    const key = `${id || name.toLowerCase()}::${role.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      id,
      name,
      role,
      image: edge?.node?.image?.large || edge?.node?.image?.medium || undefined,
    });
  }

  return out;
}

function normalizePersonName(raw?: string | null): string {
  const clean = (raw ?? "").trim();
  if (!clean) return "";
  // Jikan/MAL frequentemente formata nomes como "Sobrenome, Nome"
  const parts = clean.split(",");
  if (parts.length === 2) {
    const last = parts[0].trim();
    const first = parts[1].trim();
    if (first && last) {
      return `${first} ${last}`;
    }
  }
  return clean;
}

function cleanExternalPersonImage(url?: string | null): string | undefined {
  const clean = (url ?? "").trim();
  if (!clean) return undefined;
  if (clean.includes("questionmark_") || clean.endsWith("/na.gif")) {
    return undefined;
  }
  return clean;
}

export type AnimeCreditsResult = {
  studios: string[];
  characters: AnimeCharacter[];
  staff: AnimeStaff[];
  anilistId?: number;
  malId?: number;
  kitsuId?: number;
};

async function fetchAniCreditsById(
  anilistId: number,
): Promise<AnimeCreditsResult | null> {
  if (!Number.isFinite(anilistId) || anilistId <= 0) {
    return null;
  }
  try {
    const res = await anilistGraphQL<{ Media: AniMedia | null }>(
      `
      query MediaCreditsById($id: Int) {
        Media(id: $id, type: ANIME) {
          id
          idMal
          ${ANI_CREDITS_FIELDS}
        }
      }
      `,
      { id: anilistId },
    );
    if (!res.Media) return null;
    return {
      anilistId: res.Media.id,
      malId: res.Media.idMal ?? undefined,
      studios: extractAniStudios(res.Media.studios),
      characters: extractAniCharacters(res.Media.characters),
      staff: extractAniStaff(res.Media.staff),
    };
  } catch {
    return null;
  }
}

async function fetchAniCreditsByMalId(
  malId: number,
): Promise<AnimeCreditsResult | null> {
  if (!Number.isFinite(malId) || malId <= 0) {
    return null;
  }
  try {
    const res = await anilistGraphQL<{ Media: AniMedia | null }>(
      `
      query MediaCreditsByMalId($malId: Int) {
        Media(idMal: $malId, type: ANIME) {
          id
          idMal
          ${ANI_CREDITS_FIELDS}
        }
      }
      `,
      { malId },
    );
    if (!res.Media) return null;
    return {
      anilistId: res.Media.id,
      malId: res.Media.idMal ?? malId,
      studios: extractAniStudios(res.Media.studios),
      characters: extractAniCharacters(res.Media.characters),
      staff: extractAniStaff(res.Media.staff),
    };
  } catch {
    return null;
  }
}

function scoreTitleCandidate(
  candidateTitles: (string | null | undefined)[],
  targetTitles: string[],
  candidateYear?: number | null,
  targetYear?: number | null,
  candidateFormat?: string | null,
  targetFormat?: string | null,
): number {
  const normTargets = targetTitles
    .map((t) => normalizeSearchText(t))
    .filter((t) => t.length >= 2);
  const normCandidates = candidateTitles
    .filter((t): t is string => Boolean(t && t.trim()))
    .map((t) => normalizeSearchText(t))
    .filter((t) => t.length >= 2);

  if (normTargets.length === 0 || normCandidates.length === 0) {
    return 0;
  }

  let best = 0;
  for (const target of normTargets) {
    const compactTarget = target.replace(/\s/g, "");
    for (const cand of normCandidates) {
      const compactCand = cand.replace(/\s/g, "");
      if (cand === target || compactCand === compactTarget) {
        best = Math.max(best, 1000);
      } else if (
        cand.startsWith(`${target} `) ||
        target.startsWith(`${cand} `)
      ) {
        // Prefixo de título (ex.: subtítulo), pontuação menor para nunca ganhar do título exato
        const lenDiff = Math.abs(cand.length - target.length);
        best = Math.max(best, Math.max(700, 860 - lenDiff * 4));
      }
    }
  }

  if (best < 750) {
    return 0;
  }

  if (targetYear && candidateYear) {
    if (targetYear === candidateYear) {
      best += 60;
    } else if (Math.abs(targetYear - candidateYear) <= 1) {
      best += 25;
    } else {
      best -= 40;
    }
  }

  if (targetFormat && candidateFormat) {
    if (targetFormat.toUpperCase() === candidateFormat.toUpperCase()) {
      best += 30;
    } else {
      best -= 20;
    }
  }

  return best;
}

async function fetchAniCreditsByTitle(
  titles: string[],
  year?: number | null,
  format?: string | null,
): Promise<AnimeCreditsResult | null> {
  const cleanTitles = titles
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
  if (cleanTitles.length === 0) {
    return null;
  }

  try {
    const res = await anilistGraphQL<{
      Page?: {
        media?: AniMedia[] | null;
      } | null;
    }>(
      `
      query SearchCreditsByTitle($search: String) {
        Page(page: 1, perPage: 8) {
          media(
            type: ANIME,
            search: $search,
            sort: [SEARCH_MATCH, POPULARITY_DESC]
          ) {
            id
            idMal
            format
            seasonYear
            title {
              romaji
              english
              native
            }
            synonyms
            ${ANI_CREDITS_FIELDS}
          }
        }
      }
      `,
      { search: cleanTitles[0] },
    );

    const candidates = res.Page?.media ?? [];
    let bestMedia: AniMedia | null = null;
    let bestScore = 0;

    for (const media of candidates) {
      if (!media?.id) continue;
      const score = scoreTitleCandidate(
        [
          media.title?.romaji,
          media.title?.english,
          media.title?.native,
          ...(media.synonyms ?? []),
        ],
        cleanTitles,
        media.seasonYear,
        year,
        media.format,
        format,
      );
      if (score > bestScore) {
        bestScore = score;
        bestMedia = media;
      }
    }

    if (!bestMedia || bestScore < 750) {
      return null;
    }

    return {
      anilistId: bestMedia.id,
      malId: bestMedia.idMal ?? undefined,
      studios: extractAniStudios(bestMedia.studios),
      characters: extractAniCharacters(bestMedia.characters),
      staff: extractAniStaff(bestMedia.staff),
    };
  } catch {
    return null;
  }
}

async function fetchKitsuMappings(
  kitsuId: number,
): Promise<{ anilistId?: number; malId?: number }> {
  if (!Number.isFinite(kitsuId) || kitsuId <= 0) {
    return {};
  }

  const cacheKey = `kitsu-map:v1:${kitsuId}`;
  const cached = fromCache<{ anilistId?: number; malId?: number }>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const json = await kitsuFetch<{
      data?: {
        attributes?: {
          externalSite?: string | null;
          externalId?: string | null;
        };
      }[];
    }>(`/anime/${kitsuId}/mappings`);

    let anilistId: number | undefined;
    let malId: number | undefined;

    for (const item of json.data ?? []) {
      const site = (item.attributes?.externalSite ?? "").toLowerCase();
      const rawId = String(item.attributes?.externalId ?? "").trim();
      const match = rawId.match(/(\d+)$/);
      const numId = match ? Number(match[1]) : NaN;
      if (!Number.isFinite(numId) || numId <= 0) continue;

      if (site === "anilist/anime" || site === "anilist") {
        anilistId = anilistId ?? numId;
      } else if (site === "myanimelist/anime") {
        malId = malId ?? numId;
      }
    }

    const mapped = { anilistId, malId };
    if (anilistId || malId) {
      toCache(cacheKey, mapped);
    }
    return mapped;
  } catch {
    return {};
  }
}

async function fetchKitsuIdByExternal(
  externalSite: "anilist/anime" | "myanimelist/anime",
  externalId: number,
): Promise<number | undefined> {
  if (!Number.isFinite(externalId) || externalId <= 0) {
    return undefined;
  }
  const cacheKey = `kitsu-rev:v1:${externalSite}:${externalId}`;
  const cached = fromCache<number>(cacheKey);
  if (cached) {
    return cached;
  }
  try {
    const json = await kitsuFetch<{
      data?: {
        relationships?: {
          item?: {
            data?: { type?: string; id?: string } | null;
          };
        };
      }[];
    }>(
      `/mappings?filter[externalSite]=${encodeURIComponent(externalSite)}&filter[externalId]=${externalId}&include=item`,
    );
    const ref = json.data?.find(
      (entry) => entry.relationships?.item?.data?.type === "anime",
    )?.relationships?.item?.data;
    const kitsuId = ref?.id ? Number(ref.id) : NaN;
    if (Number.isFinite(kitsuId) && kitsuId > 0) {
      return toCache(cacheKey, kitsuId);
    }
    return undefined;
  } catch {
    return undefined;
  }
}

async function fetchKitsuIdByTitle(
  titles: string[],
  year?: number | null,
  format?: string | null,
): Promise<number | undefined> {
  const cleanTitles = titles
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
  if (cleanTitles.length === 0) {
    return undefined;
  }

  try {
    const json = await kitsuFetch<{ data?: KitsuAnimeItem[] }>(
      `/anime?filter[text]=${encodeURIComponent(cleanTitles[0])}&page[limit]=8`,
    );
    let bestId: number | undefined;
    let bestScore = 0;

    for (const item of json.data ?? []) {
      const slim = mapKitsuSlim(item);
      const score = scoreTitleCandidate(
        [
          slim.titles.romaji,
          slim.titles.english,
          slim.titles.native,
          item.attributes?.canonicalTitle,
        ],
        cleanTitles,
        slim.year,
        year,
        slim.format,
        format,
      );
      if (score > bestScore && slim.kitsuId) {
        bestScore = score;
        bestId = slim.kitsuId;
      }
    }

    return bestScore >= 750 ? bestId : undefined;
  } catch {
    return undefined;
  }
}

async function fetchKitsuCreditsDirect(
  kitsuId: number,
): Promise<AnimeCreditsResult | null> {
  if (!Number.isFinite(kitsuId) || kitsuId <= 0) {
    return null;
  }

  type KitsuIncludedEntity = {
    id: string;
    type: string;
    attributes?: {
      name?: string | null;
      canonicalName?: string | null;
      names?: { en?: string | null; ja_jp?: string | null } | null;
      locale?: string | null;
      role?: string | null;
      image?: {
        large?: string | null;
        medium?: string | null;
        original?: string | null;
        small?: string | null;
      } | null;
    };
    relationships?: Record<
      string,
      {
        data?:
          | { id: string; type: string }
          | { id: string; type: string }[]
          | null;
      }
    >;
  };

  type KitsuResourceResponse = {
    data?: KitsuIncludedEntity[];
    included?: KitsuIncludedEntity[];
  };

  const [charsSettled, staffSettled, prodSettled] = await Promise.allSettled([
    kitsuFetch<KitsuResourceResponse>(
      `/anime/${kitsuId}/characters?sort=role&page[limit]=25&include=character,voices.person`,
    ),
    kitsuFetch<KitsuResourceResponse>(
      `/anime/${kitsuId}/staff?page[limit]=25&include=person`,
    ),
    kitsuFetch<KitsuResourceResponse>(
      `/anime/${kitsuId}/productions?page[limit]=20&include=company`,
    ),
  ]);

  const characters: AnimeCharacter[] = [];
  if (charsSettled.status === "fulfilled") {
    const body = charsSettled.value;
    const inc = new Map<string, KitsuIncludedEntity>(
      (body.included ?? []).map((item) => [`${item.type}:${item.id}`, item]),
    );
    const seenChar = new Set<string>();

    for (const mc of body.data ?? []) {
      const charRef = mc.relationships?.character?.data;
      if (!charRef || Array.isArray(charRef)) continue;
      const ch = inc.get(`${charRef.type}:${charRef.id}`);
      const fullName = stripHtml(
        ch?.attributes?.canonicalName ||
          ch?.attributes?.name ||
          ch?.attributes?.names?.en ||
          "",
      ).trim();
      if (!fullName) continue;

      const charId = Number(ch?.id ?? 0);
      const dedupKey = charId > 0 ? `id:${charId}` : `name:${fullName.toLowerCase()}`;
      if (seenChar.has(dedupKey)) continue;
      seenChar.add(dedupKey);

      const voiceRefsRaw = mc.relationships?.voices?.data;
      const voiceRefs = Array.isArray(voiceRefsRaw) ? voiceRefsRaw : [];
      const voiceActors: AnimeCharacter["voiceActors"] = [];
      const seenVa = new Set<string>();

      for (const vr of voiceRefs) {
        const voice = inc.get(`${vr.type}:${vr.id}`);
        const personRef = voice?.relationships?.person?.data;
        if (!personRef || Array.isArray(personRef)) continue;
        const person = inc.get(`${personRef.type}:${personRef.id}`);
        const vaName = stripHtml(
          person?.attributes?.name || person?.attributes?.canonicalName || "",
        ).trim();
        if (!vaName) continue;

        const locale = (voice?.attributes?.locale ?? "").toLowerCase();
        let language = "";
        if (locale === "ja_jp" || locale === "ja") {
          language = "Japanese";
        } else if (locale === "pt_br" || locale === "pt-br") {
          language = "Portuguese (Brazil)";
        } else if (locale === "pt") {
          language = "Portuguese";
        } else {
          continue;
        }

        const vaId = Number(person?.id ?? 0);
        const vaKey = `${vaId || vaName.toLowerCase()}:${language}`;
        if (seenVa.has(vaKey)) continue;
        seenVa.add(vaKey);

        voiceActors.push({
          id: vaId,
          name: { full: vaName },
          image: cleanExternalPersonImage(
            person?.attributes?.image?.large ||
              person?.attributes?.image?.original ||
              person?.attributes?.image?.medium,
          ),
          language,
        });
      }

      const isMain = (mc.attributes?.role ?? "").toLowerCase() === "main";
      characters.push({
        id: charId,
        name: {
          full: fullName,
          native: ch?.attributes?.names?.ja_jp?.trim() || undefined,
        },
        image: cleanExternalPersonImage(
          ch?.attributes?.image?.large ||
            ch?.attributes?.image?.original ||
            ch?.attributes?.image?.medium,
        ),
        role: isMain ? "MAIN" : "SUPPORTING",
        voiceActors,
      });
    }

    characters.sort((a, b) =>
      a.role === b.role ? 0 : a.role === "MAIN" ? -1 : 1,
    );
  }

  const staff: AnimeStaff[] = [];
  if (staffSettled.status === "fulfilled") {
    const body = staffSettled.value;
    const inc = new Map<string, KitsuIncludedEntity>(
      (body.included ?? []).map((item) => [`${item.type}:${item.id}`, item]),
    );
    const seenStaff = new Set<string>();

    for (const st of body.data ?? []) {
      const personRef = st.relationships?.person?.data;
      if (!personRef || Array.isArray(personRef)) continue;
      const person = inc.get(`${personRef.type}:${personRef.id}`);
      const name = stripHtml(
        person?.attributes?.name || person?.attributes?.canonicalName || "",
      ).trim();
      if (!name) continue;

      const role = (st.attributes?.role ?? "").trim() || "Equipe técnica";
      const personId = Number(person?.id ?? 0);
      const key = `${personId || name.toLowerCase()}::${role.toLowerCase()}`;
      if (seenStaff.has(key)) continue;
      seenStaff.add(key);

      staff.push({
        id: personId,
        name,
        role,
        image: cleanExternalPersonImage(
          person?.attributes?.image?.large ||
            person?.attributes?.image?.original ||
            person?.attributes?.image?.medium,
        ),
      });
    }
  }

  const studios: string[] = [];
  if (prodSettled.status === "fulfilled") {
    const body = prodSettled.value;
    const inc = new Map<string, KitsuIncludedEntity>(
      (body.included ?? []).map((item) => [`${item.type}:${item.id}`, item]),
    );
    const studioExplicit: string[] = [];
    const studioHeuristic: string[] = [];
    const studioPattern =
      /\b(animation|studio|studios|bones|madhouse|mappa|ufotable|wit|trigger|sunrise|pierrot|gainax|shaft|cloverworks|a-1 pictures|j\.c\.staff|tms|olm|gonzo|deen|silver link|white fox|lerche|p\.a\. works|kinema citrus|david production|science saru|kyoto animation|production i\.g)\b/i;

    for (const pr of body.data ?? []) {
      const compRef = pr.relationships?.company?.data;
      if (!compRef || Array.isArray(compRef)) continue;
      const comp = inc.get(`${compRef.type}:${compRef.id}`);
      const compName = (comp?.attributes?.name ?? "").trim();
      if (!compName) continue;

      const role = (pr.attributes?.role ?? "").toLowerCase();
      if (role === "studio") {
        studioExplicit.push(compName);
      } else if (studioPattern.test(compName)) {
        studioHeuristic.push(compName);
      }
    }

    const picked = studioExplicit.length > 0 ? studioExplicit : studioHeuristic;
    const seenS = new Set<string>();
    for (const name of picked) {
      const k = name.toLowerCase();
      if (!seenS.has(k)) {
        seenS.add(k);
        studios.push(name);
      }
    }
  }

  if (characters.length === 0 && staff.length === 0 && studios.length === 0) {
    return null;
  }

  return {
    kitsuId,
    studios,
    characters,
    staff,
  };
}

async function fetchJikanCredits(
  malId: number,
): Promise<AnimeCreditsResult | null> {
  if (!Number.isFinite(malId) || malId <= 0) {
    return null;
  }

  type JikanCharItem = {
    character?: {
      mal_id?: number;
      name?: string;
      images?: {
        jpg?: { image_url?: string };
        webp?: { image_url?: string };
      };
    };
    role?: string;
    voice_actors?: {
      person?: {
        mal_id?: number;
        name?: string;
        images?: {
          jpg?: { image_url?: string };
        };
      };
      language?: string;
    }[];
  };

  type JikanStaffItem = {
    person?: {
      mal_id?: number;
      name?: string;
      images?: {
        jpg?: { image_url?: string };
      };
    };
    positions?: string[];
  };

  const [charsRes, staffRes] = await Promise.allSettled([
    jikanFetch<{ data?: JikanCharItem[] }>(`/anime/${malId}/characters`),
    jikanFetch<{ data?: JikanStaffItem[] }>(`/anime/${malId}/staff`),
  ]);

  const characters: AnimeCharacter[] = [];
  if (charsRes.status === "fulfilled") {
    for (const item of (charsRes.value.data ?? []).slice(0, 25)) {
      const fullName = normalizePersonName(item.character?.name);
      if (!fullName) continue;

      const voiceActors = (item.voice_actors ?? [])
        .map((va) => {
          const vaName = normalizePersonName(va.person?.name);
          if (!vaName) return null;
          const rawLang = (va.language ?? "").trim();
          const low = rawLang.toLowerCase();
          const language =
            low.includes("portuguese") || low.includes("brazil")
              ? "Portuguese (Brazil)"
              : rawLang || "Japanese";
          return {
            id: va.person?.mal_id ?? 0,
            name: { full: vaName },
            image: cleanExternalPersonImage(va.person?.images?.jpg?.image_url),
            language,
          };
        })
        .filter((va): va is NonNullable<typeof va> => va !== null);

      characters.push({
        id: item.character?.mal_id ?? 0,
        name: { full: fullName },
        image: cleanExternalPersonImage(
          item.character?.images?.jpg?.image_url ||
            item.character?.images?.webp?.image_url,
        ),
        role: (item.role ?? "").toUpperCase() === "MAIN" ? "MAIN" : "SUPPORTING",
        voiceActors,
      });
    }
  }

  const staff: AnimeStaff[] = [];
  if (staffRes.status === "fulfilled") {
    for (const item of (staffRes.value.data ?? []).slice(0, 25)) {
      const name = normalizePersonName(item.person?.name);
      if (!name) continue;
      const role =
        (item.positions ?? []).map((p) => p.trim()).filter(Boolean).join(", ") ||
        "Equipe técnica";
      staff.push({
        id: item.person?.mal_id ?? 0,
        name,
        role,
        image: cleanExternalPersonImage(item.person?.images?.jpg?.image_url),
      });
    }
  }

  if (characters.length === 0 && staff.length === 0) {
    return null;
  }

  return {
    malId,
    studios: [],
    characters,
    staff,
  };
}

async function resolveAnimeCredits(input: {
  anilistId?: number;
  malId?: number;
  kitsuId?: number;
  titles?: string[];
  year?: number | null;
  format?: string | null;
  skipAnilist?: boolean;
}): Promise<AnimeCreditsResult> {
  const cleanTitles = (input.titles ?? [])
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);

  const cacheKey = `credits:v1:${input.anilistId ?? 0}:${input.malId ?? 0}:${input.kitsuId ?? 0}:${input.skipAnilist ? 1 : 0}:${normalizeSearchText(cleanTitles[0] ?? "")}:${input.year ?? 0}`;
  const cached = fromCache<AnimeCreditsResult>(cacheKey);
  if (cached) {
    return cached;
  }

  let studios: string[] = [];
  let characters: AnimeCharacter[] = [];
  let staff: AnimeStaff[] = [];
  let resolvedAniId =
    input.anilistId && Number.isFinite(input.anilistId) && input.anilistId > 0
      ? input.anilistId
      : undefined;
  let resolvedMalId =
    input.malId && Number.isFinite(input.malId) && input.malId > 0
      ? input.malId
      : undefined;
  let resolvedKitsuId =
    input.kitsuId && Number.isFinite(input.kitsuId) && input.kitsuId > 0
      ? input.kitsuId
      : undefined;

  const mergePart = (part: AnimeCreditsResult | null) => {
    if (!part) return;
    if (studios.length === 0 && part.studios.length > 0) {
      studios = part.studios;
    }
    if (characters.length === 0 && part.characters.length > 0) {
      characters = part.characters;
    }
    if (staff.length === 0 && part.staff.length > 0) {
      staff = part.staff;
    }
    if (!resolvedAniId && part.anilistId) {
      resolvedAniId = part.anilistId;
    }
    if (!resolvedMalId && part.malId) {
      resolvedMalId = part.malId;
    }
    if (!resolvedKitsuId && part.kitsuId) {
      resolvedKitsuId = part.kitsuId;
    }
  };

  let triedAniById: number | undefined;

  // 1. AniList por ID direto
  if (!input.skipAnilist && resolvedAniId) {
    triedAniById = resolvedAniId;
    mergePart(await fetchAniCreditsById(resolvedAniId));
  }

  // 2. Se possui kitsuId e ainda faltam créditos, descobre IDs mapeados (AniList / MAL)
  if (
    resolvedKitsuId &&
    (characters.length === 0 || staff.length === 0 || studios.length === 0)
  ) {
    const mapped = await fetchKitsuMappings(resolvedKitsuId);
    if (!resolvedAniId && mapped.anilistId) {
      resolvedAniId = mapped.anilistId;
    }
    if (!resolvedMalId && mapped.malId) {
      resolvedMalId = mapped.malId;
    }
    if (
      !input.skipAnilist &&
      resolvedAniId &&
      resolvedAniId !== triedAniById
    ) {
      triedAniById = resolvedAniId;
      mergePart(await fetchAniCreditsById(resolvedAniId));
    }
  }

  // 3. AniList por malId
  if (
    !input.skipAnilist &&
    resolvedMalId &&
    !triedAniById &&
    (characters.length === 0 || staff.length === 0 || studios.length === 0)
  ) {
    mergePart(await fetchAniCreditsByMalId(resolvedMalId));
    if (resolvedAniId) {
      triedAniById = resolvedAniId;
    }
  }

  // 4. AniList por correspondência estrita de título (para animes locais sem ID externo)
  if (
    !input.skipAnilist &&
    !triedAniById &&
    cleanTitles.length > 0 &&
    (characters.length === 0 || staff.length === 0)
  ) {
    mergePart(await fetchAniCreditsByTitle(cleanTitles, input.year, input.format));
  }

  // 5. Kitsu direto (resiliente quando AniList está indisponível ou incompleto)
  if (characters.length === 0 || staff.length === 0 || studios.length === 0) {
    if (!resolvedKitsuId && resolvedAniId) {
      resolvedKitsuId = await fetchKitsuIdByExternal(
        "anilist/anime",
        resolvedAniId,
      );
    }
    if (!resolvedKitsuId && resolvedMalId) {
      resolvedKitsuId = await fetchKitsuIdByExternal(
        "myanimelist/anime",
        resolvedMalId,
      );
    }
    if (!resolvedKitsuId && cleanTitles.length > 0) {
      resolvedKitsuId = await fetchKitsuIdByTitle(
        cleanTitles,
        input.year,
        input.format,
      );
    }
    if (resolvedKitsuId) {
      mergePart(await fetchKitsuCreditsDirect(resolvedKitsuId));
    }
  }

  // 6. Jikan / MyAnimeList direto como reserva complementar
  if ((characters.length === 0 || staff.length === 0) && resolvedMalId) {
    mergePart(await fetchJikanCredits(resolvedMalId));
  }

  const result: AnimeCreditsResult = {
    studios,
    characters,
    staff,
    anilistId: resolvedAniId,
    malId: resolvedMalId,
    kitsuId: resolvedKitsuId,
  };

  if (characters.length > 0 || staff.length > 0) {
    toCache(cacheKey, result);
  }

  return result;
}

export const fetchAnimeCredits = createServerFn({
  method: "GET",
})
  .validator(
    z.object({
      anilistId: z.number().optional(),
      malId: z.number().optional(),
      kitsuId: z.number().optional(),
      titles: z.array(z.string()).optional(),
      year: z.number().nullable().optional(),
      format: z.string().nullable().optional(),
    }),
  )
  .handler(async ({ data }) => {
    return resolveAnimeCredits(data);
  });

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
          ${CARD_FIELDS}
          duration
          source
          countryOfOrigin
          startDate {
            year
            month
            day
          }
          endDate {
            year
            month
            day
          }
          ${ANI_CREDITS_FIELDS}
          synonyms
          relations {
            edges {
              relationType
              node {
                id
                idMal
                type
                format
                status
                episodes
                seasonYear
                startDate {
                  year
                  month
                  day
                }
                title {
                  romaji
                  english
                }
                coverImage {
                  extraLarge
                  large
                }
                bannerImage
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

const SEASON_NAV_SERIES_FORMATS = new Set(["TV", "TV_SHORT", "ONA"]);

type SeasonGraphEdge = {
  relationType?: string | null;
  node?: {
    id: number;
    idMal?: number | null;
    type?: string | null;
    format?: string | null;
    status?: string | null;
    episodes?: number | null;
    seasonYear?: number | null;
    startDate?: {
      year?: number | null;
      month?: number | null;
      day?: number | null;
    } | null;
    title?: AniTitle | null;
  } | null;
};

type SeasonGraphNode = {
  id: number;
  type?: string | null;
  format?: string | null;
  status?: string | null;
  episodes?: number | null;
  seasonYear?: number | null;
  startDate?: {
    year?: number | null;
    month?: number | null;
    day?: number | null;
  } | null;
  title?: AniTitle | null;
  edges: SeasonGraphEdge[];
};

function isChronologicalAnimeEdge(
  edge: SeasonGraphEdge | null | undefined,
): edge is {
  relationType: "PREQUEL" | "SEQUEL";
  node: NonNullable<SeasonGraphEdge["node"]>;
} {
  if (!edge || !edge.node?.id || !Number.isFinite(edge.node.id)) {
    return false;
  }
  if (edge.relationType !== "PREQUEL" && edge.relationType !== "SEQUEL") {
    return false;
  }
  if (edge.node.type && edge.node.type !== "ANIME") {
    return false;
  }
  return true;
}

function getSeasonNodeDateKey(node: SeasonGraphNode): number {
  const year = node.startDate?.year ?? node.seasonYear ?? null;
  if (!year || !Number.isFinite(year)) {
    return 99999999;
  }
  const month =
    node.startDate?.month &&
    node.startDate.month >= 1 &&
    node.startDate.month <= 12
      ? node.startDate.month
      : 13;
  const day =
    node.startDate?.day && node.startDate.day >= 1 && node.startDate.day <= 31
      ? node.startDate.day
      : 32;
  return year * 10000 + month * 100 + day;
}

function edgeContradictsReleaseDate(
  earlier: SeasonGraphNode,
  later: SeasonGraphNode,
): boolean {
  const earlierYear = earlier.startDate?.year ?? earlier.seasonYear ?? null;
  const laterYear = later.startDate?.year ?? later.seasonYear ?? null;
  if (!earlierYear || !laterYear) return false;
  if (earlierYear !== laterYear) return earlierYear > laterYear;

  const earlierMonth = earlier.startDate?.month ?? null;
  const laterMonth = later.startDate?.month ?? null;
  if (!earlierMonth || !laterMonth) return false;
  if (earlierMonth !== laterMonth) return earlierMonth > laterMonth;

  const earlierDay = earlier.startDate?.day ?? null;
  const laterDay = later.startDate?.day ?? null;
  if (!earlierDay || !laterDay) return false;
  return earlierDay > laterDay;
}

function canReachSeasonNode(
  startId: number,
  goalId: number,
  adj: Map<number, Set<number>>,
): boolean {
  if (startId === goalId) return true;
  const visited = new Set<number>([startId]);
  const queue = [startId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = adj.get(current);
    if (!neighbors) continue;
    for (const next of neighbors) {
      if (next === goalId) return true;
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  return false;
}

async function fetchAniSeasonNodesBatch(
  ids: number[],
): Promise<SeasonGraphNode[]> {
  const validIds = Array.from(
    new Set(ids.filter((id) => Number.isInteger(id) && id > 0)),
  );
  if (validIds.length === 0) return [];

  const chunks: number[][] = [];
  for (let i = 0; i < validIds.length; i += 10) {
    chunks.push(validIds.slice(i, i + 10));
  }

  const collected: SeasonGraphNode[] = [];

  for (const chunk of chunks) {
    const selections = chunk
      .map(
        (id, idx) => `
        m${idx}: Media(id: ${id}, type: ANIME) {
          id
          type
          format
          status
          episodes
          seasonYear
          startDate {
            year
            month
            day
          }
          title {
            romaji
            english
          }
          relations {
            edges {
              relationType
              node {
                id
                type
                format
                status
                episodes
                seasonYear
                startDate {
                  year
                  month
                  day
                }
                title {
                  romaji
                  english
                }
              }
            }
          }
        }`,
      )
      .join("\n");

    const response = await anilistGraphQL<
      Record<
        string,
        | {
            id: number;
            type?: string | null;
            format?: string | null;
            status?: string | null;
            episodes?: number | null;
            seasonYear?: number | null;
            startDate?: {
              year?: number | null;
              month?: number | null;
              day?: number | null;
            } | null;
            title?: AniTitle | null;
            relations?: { edges?: SeasonGraphEdge[] | null } | null;
          }
        | null
      >
    >(`query SeasonGraphBatch {\n${selections}\n}`);

    for (let idx = 0; idx < chunk.length; idx += 1) {
      const entry = response[`m${idx}`];
      if (!entry?.id) continue;
      collected.push({
        id: entry.id,
        type: entry.type,
        format: entry.format,
        status: entry.status,
        episodes: entry.episodes,
        seasonYear: entry.seasonYear,
        startDate: entry.startDate,
        title: entry.title,
        edges: (entry.relations?.edges ?? []).filter(Boolean) as SeasonGraphEdge[],
      });
    }
  }

  return collected;
}

function orderFranchiseSeasonNodes(
  allNodes: Map<number, SeasonGraphNode>,
  keptNodes: SeasonGraphNode[],
): SeasonGraphNode[] {
  if (keptNodes.length <= 1) return keptNodes;

  const fullAdj = new Map<number, Set<number>>();
  for (const id of allNodes.keys()) {
    fullAdj.set(id, new Set());
  }

  const candidateEdges: Array<[number, number]> = [];
  for (const source of allNodes.values()) {
    for (const edge of source.edges) {
      if (!isChronologicalAnimeEdge(edge)) continue;
      const targetId = edge.node.id;
      if (!allNodes.has(targetId) || targetId === source.id) continue;

      if (edge.relationType === "SEQUEL") {
        candidateEdges.push([source.id, targetId]);
      } else {
        candidateEdges.push([targetId, source.id]);
      }
    }
  }

  for (const [fromId, toId] of candidateEdges) {
    const fromNode = allNodes.get(fromId);
    const toNode = allNodes.get(toId);
    if (!fromNode || !toNode) continue;
    if (edgeContradictsReleaseDate(fromNode, toNode)) continue;
    if (canReachSeasonNode(toId, fromId, fullAdj)) continue;
    fullAdj.get(fromId)!.add(toId);
  }

  const keptIds = new Set(keptNodes.map((n) => n.id));
  const keptAdj = new Map<number, Set<number>>();
  const inDegree = new Map<number, number>();
  for (const node of keptNodes) {
    keptAdj.set(node.id, new Set());
    inDegree.set(node.id, 0);
  }

  for (const node of keptNodes) {
    const visited = new Set<number>([node.id]);
    const queue = [node.id];
    while (queue.length > 0) {
      const curr = queue.shift()!;
      for (const next of fullAdj.get(curr) ?? []) {
        if (visited.has(next)) continue;
        visited.add(next);
        queue.push(next);
        if (keptIds.has(next) && next !== node.id) {
          const neighbors = keptAdj.get(node.id)!;
          if (!neighbors.has(next)) {
            neighbors.add(next);
            inDegree.set(next, (inDegree.get(next) ?? 0) + 1);
          }
        }
      }
    }
  }

  const compareNodes = (a: SeasonGraphNode, b: SeasonGraphNode) =>
    getSeasonNodeDateKey(a) - getSeasonNodeDateKey(b) || a.id - b.id;

  const ready = keptNodes
    .filter((node) => (inDegree.get(node.id) ?? 0) === 0)
    .sort(compareNodes);

  const ordered: SeasonGraphNode[] = [];
  const placed = new Set<number>();

  while (ready.length > 0) {
    const current = ready.shift()!;
    if (placed.has(current.id)) continue;
    placed.add(current.id);
    ordered.push(current);

    for (const neighborId of keptAdj.get(current.id) ?? []) {
      const nextDeg = (inDegree.get(neighborId) ?? 0) - 1;
      inDegree.set(neighborId, nextDeg);
      if (nextDeg === 0 && !placed.has(neighborId)) {
        const neighborNode = allNodes.get(neighborId);
        if (neighborNode) {
          ready.push(neighborNode);
          ready.sort(compareNodes);
        }
      }
    }
  }

  if (ordered.length < keptNodes.length) {
    const remaining = keptNodes
      .filter((node) => !placed.has(node.id))
      .sort(compareNodes);
    ordered.push(...remaining);
  }

  return ordered;
}

async function buildSeasonNavigation(
  media: AniMedia,
): Promise<SeasonNavigation> {
  const navKey = `season-nav:v3:${media.id}`;
  const cached = fromCache<SeasonNavigation>(navKey);
  if (cached) {
    return cached;
  }

  const rootEdges = (media.relations?.edges ?? []).filter(
    Boolean,
  ) as SeasonGraphEdge[];

  const nodesById = new Map<number, SeasonGraphNode>();
  const fetchedIds = new Set<number>([media.id]);

  nodesById.set(media.id, {
    id: media.id,
    type: "ANIME",
    format: media.format,
    status: media.status,
    episodes: media.episodes,
    seasonYear: media.seasonYear,
    startDate: media.startDate,
    title: media.title,
    edges: rootEdges,
  });

  const enqueueNeighbors = (edges: SeasonGraphEdge[]): number[] => {
    const nextIds: number[] = [];
    for (const edge of edges) {
      if (!isChronologicalAnimeEdge(edge)) continue;
      const neighbor = edge.node;
      if (!nodesById.has(neighbor.id)) {
        nodesById.set(neighbor.id, {
          id: neighbor.id,
          type: neighbor.type ?? "ANIME",
          format: neighbor.format,
          status: neighbor.status,
          episodes: neighbor.episodes,
          seasonYear: neighbor.seasonYear,
          startDate: neighbor.startDate,
          title: neighbor.title,
          edges: [],
        });
      }
      if (
        !fetchedIds.has(neighbor.id) &&
        neighbor.status !== "NOT_YET_RELEASED" &&
        neighbor.status !== "CANCELLED"
      ) {
        nextIds.push(neighbor.id);
      }
    }
    return nextIds;
  };

  let frontier = Array.from(new Set(enqueueNeighbors(rootEdges)));
  const MAX_ROUNDS = 12;
  const MAX_NODES = 48;

  for (
    let round = 0;
    round < MAX_ROUNDS && frontier.length > 0 && fetchedIds.size < MAX_NODES;
    round += 1
  ) {
    const remainingBudget = MAX_NODES - fetchedIds.size;
    const toFetch = frontier.slice(0, remainingBudget);
    for (const id of toFetch) {
      fetchedIds.add(id);
    }

    try {
      const fetchedNodes = await fetchAniSeasonNodesBatch(toFetch);
      const nextFrontierSet = new Set<number>();

      for (const fetchedNode of fetchedNodes) {
        nodesById.set(fetchedNode.id, fetchedNode);
        for (const neighborId of enqueueNeighbors(fetchedNode.edges)) {
          if (!fetchedIds.has(neighborId)) {
            nextFrontierSet.add(neighborId);
          }
        }
      }

      frontier = Array.from(nextFrontierSet);
    } catch {
      break;
    }
  }

  const releasedNodes = Array.from(nodesById.values()).filter(
    (node) =>
      node.id === media.id ||
      (node.status !== "NOT_YET_RELEASED" &&
        node.status !== "CANCELLED" &&
        node.format !== "MUSIC"),
  );

  const isRootSeries =
    !media.format || SEASON_NAV_SERIES_FORMATS.has(media.format);
  const seriesNodes = releasedNodes.filter(
    (node) => !node.format || SEASON_NAV_SERIES_FORMATS.has(node.format),
  );

  let keptNodes: SeasonGraphNode[];
  if (seriesNodes.length >= 2) {
    keptNodes = isRootSeries
      ? seriesNodes
      : seriesNodes.some((n) => n.id === media.id)
        ? seriesNodes
        : [...seriesNodes, nodesById.get(media.id)!];
  } else {
    keptNodes = releasedNodes;
  }

  const orderedNodes = orderFranchiseSeasonNodes(nodesById, keptNodes);

  const items: SeasonNavigationItem[] = orderedNodes.map((node) => ({
    id: String(node.id),
    title: node.title?.english ?? node.title?.romaji ?? undefined,
  }));

  for (let i = 0; i < orderedNodes.length; i += 1) {
    const targetNode = orderedNodes[i];
    const targetIsSeries =
      !targetNode.format || SEASON_NAV_SERIES_FORMATS.has(targetNode.format);
    if (targetNode.id !== media.id && targetIsSeries !== isRootSeries) {
      continue;
    }
    toCache(`season-nav:v3:${targetNode.id}`, {
      items,
      previous: i > 0 ? items[i - 1] : undefined,
      next: i < items.length - 1 ? items[i + 1] : undefined,
    });
  }

  const currentIdx = orderedNodes.findIndex((n) => n.id === media.id);
  const fallbackResult: SeasonNavigation = {
    items:
      items.length > 0
        ? items
        : [
            {
              id: String(media.id),
              title: media.title?.english ?? media.title?.romaji ?? undefined,
            },
          ],
    previous: currentIdx > 0 ? items[currentIdx - 1] : undefined,
    next:
      currentIdx >= 0 && currentIdx < items.length - 1
        ? items[currentIdx + 1]
        : undefined,
  };

  return fromCache<SeasonNavigation>(navKey) ?? toCache(navKey, fallbackResult);
}

function mapAniFull(
  media: AniMedia,
  seasons: Season[],
  seasonNavigation?: SeasonNavigation,
  extraImages?: string[],
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

  const characters = extractAniCharacters(media.characters);
  const staff = extractAniStaff(media.staff);

  const images: string[] = [];
  const seenImgs = new Set<string>();

  const normKey = (url: string) =>
    url.replace(/^https?:\/\//i, "").split("?")[0].toLowerCase().trim();

  const addImg = (url?: string | null) => {
    if (url && typeof url === "string" && url.trim().length > 0) {
      const clean = url.trim();
      const key = normKey(clean);
      if (!seenImgs.has(key)) {
        seenImgs.add(key);
        images.push(clean);
      }
    }
  };

  const mainCoverKey = slim.cover ? normKey(slim.cover) : "";
  const mainBannerKey = slim.banner ? normKey(slim.banner) : "";

  // 1. Artes promocionais oficiais da galeria MyAnimeList / Jikan
  if (extraImages && extraImages.length > 0) {
    for (const pic of extraImages) {
      const key = normKey(pic);
      // Não duplica a capa principal do topo nem o banner
      if (key !== mainCoverKey && key !== mainBannerKey) {
        addImg(pic);
      }
    }
  }

  // 2. Complementar oficial: Key visuals e pôsteres das obras da franquia (prequels/sequels/filmes)
  (media.relations?.edges ?? []).forEach((edge) => {
    const node = edge?.node as { coverImage?: { extraLarge?: string; large?: string } } | undefined;
    const relCover = node?.coverImage?.extraLarge || node?.coverImage?.large;
    if (relCover) {
      const key = normKey(relCover);
      if (key !== mainCoverKey && key !== mainBannerKey) {
        addImg(relCover);
      }
    }
  });

  const synonyms = (media.synonyms ?? []).filter(Boolean);
  const tags = (media.tags ?? [])
    .filter((t) => !t.isAdult && t.name)
    .sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0))
    .slice(0, 10)
    .map((t) => t.name);

  return {
    ...slim,

    duration:
      media.duration ??
      null,

    studios: extractAniStudios(media.studios),

    characters,
    staff,
    originSource: media.source ?? null,
    countryOfOrigin: media.countryOfOrigin ?? null,
    startDate: media.startDate ?? null,
    endDate: media.endDate ?? null,
    rating: media.isAdult ? "18+ (Adulto)" : null,
    synonyms,
    tags,
    images,

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
    page <= 10 && releases.length < 18;
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
    await fetchRecentReleasesFromAni().catch(() => []);

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

    releases:
      releases.length > 0
        ? releases
        : seasonItems.map(mapAniSlim).slice(0, 18),

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

async function kitsuFetch<T>(path: string): Promise<T> {
  const url = path.startsWith("http") ? path : `${KITSU}${path}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      "User-Agent": "Hikari/1.0 (anime catalog)",
    },
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) {
    throw new Error(`Kitsu indisponível (${res.status})`);
  }

  return (await res.json()) as T;
}

type KitsuAnimeItem = {
  id: string;
  type: string;
  attributes?: {
    slug?: string;
    synopsis?: string;
    description?: string;
    titles?: {
      en?: string;
      en_jp?: string;
      en_us?: string;
      ja_jp?: string;
    };
    canonicalTitle?: string;
    averageRating?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    subtype?: string | null;
    status?: string | null;
    posterImage?: {
      tiny?: string;
      large?: string;
      small?: string;
      medium?: string;
      original?: string;
    } | null;
    coverImage?: {
      tiny?: string;
      large?: string;
      small?: string;
      original?: string;
    } | null;
    episodeCount?: number | null;
    youtubeVideoId?: string | null;
    nsfw?: boolean | null;
  };
};

function mapKitsuSlim(item: KitsuAnimeItem): SlimAnime {
  const attr = item.attributes ?? {};
  const rating = attr.averageRating
    ? Math.round(Number(attr.averageRating))
    : null;
  const year = attr.startDate
    ? new Date(attr.startDate).getFullYear()
    : null;

  let season: string | null = null;
  if (attr.startDate) {
    const month = new Date(attr.startDate).getMonth();
    if (month >= 0 && month <= 2) season = "WINTER";
    else if (month >= 3 && month <= 5) season = "SPRING";
    else if (month >= 6 && month <= 8) season = "SUMMER";
    else season = "FALL";
  }

  let status = "FINISHED";
  if (attr.status === "current") status = "RELEASING";
  else if (attr.status === "unreleased" || attr.status === "tba")
    status = "NOT_YET_RELEASED";

  const cover =
    attr.posterImage?.large ||
    attr.posterImage?.medium ||
    attr.posterImage?.original ||
    attr.posterImage?.small ||
    "";

  const banner =
    attr.coverImage?.large ||
    attr.coverImage?.original ||
    attr.coverImage?.small ||
    "";

  const romaji = attr.titles?.en_jp || attr.canonicalTitle || "";
  const english =
    attr.titles?.en || attr.titles?.en_us || attr.canonicalTitle || romaji;
  const native = attr.titles?.ja_jp || "";

  return {
    id: `kitsu-${item.id}`,
    kitsuId: Number(item.id),
    titles: {
      romaji,
      english,
      native,
    },
    cover,
    banner,
    synopsis: stripHtml(attr.synopsis || attr.description || ""),
    score: rating,
    genres: [],
    format: (attr.subtype || "TV").toUpperCase(),
    status,
    episodesCount: attr.episodeCount ?? null,
    season,
    year: Number.isFinite(year) ? year : null,
    trailerId: attr.youtubeVideoId || null,
    source: "kitsu",
  };
}

async function fetchHomeFromKitsu(): Promise<HomeCatalog> {
  const { season, year } = currentAnimeSeason();

  type KitsuList = {
    data?: KitsuAnimeItem[];
  };

  const [trending, popular, top, seasonData] = await Promise.all([
    kitsuFetch<KitsuList>("/trending/anime?limit=18").catch(() => ({
      data: [],
    })),
    kitsuFetch<KitsuList>("/anime?sort=-userCount&page[limit]=18").catch(
      () => ({ data: [] }),
    ),
    kitsuFetch<KitsuList>("/anime?sort=-averageRating&page[limit]=18").catch(
      () => ({ data: [] }),
    ),
    kitsuFetch<KitsuList>(
      `/anime?filter[season]=${season.toLowerCase()}&filter[seasonYear]=${year}&sort=-userCount&page[limit]=18`,
    ).catch(() => ({ data: [] })),
  ]);

  const trendingItems = (trending.data ?? []).map(mapKitsuSlim);
  const popularItems = (popular.data ?? []).map(mapKitsuSlim);
  const topItems = (top.data ?? []).map(mapKitsuSlim);
  let seasonItems = (seasonData.data ?? []).map(mapKitsuSlim);

  if (seasonItems.length === 0) {
    seasonItems = trendingItems.length > 0 ? trendingItems : popularItems;
  }

  const catalog: HomeCatalog = {
    trending: trendingItems.length > 0 ? trendingItems : popularItems,
    popular: popularItems,
    top: topItems,
    season: seasonItems,
    releases: seasonItems.slice(0, 18),
    seasonName: seasonLabel(season),
    seasonYear: year,
    source: "kitsu",
    genres: [
      "Ação",
      "Aventura",
      "Comédia",
      "Drama",
      "Fantasia",
      "Ficção Científica",
      "Mistério",
      "Romance",
      "Sobrenatural",
      "Suspense",
    ],
  };

  if (catalog.trending.length === 0 && catalog.popular.length === 0) {
    throw new Error("Kitsu sem dados");
  }

  return catalog;
}

async function fetchBrowseFromKitsu(
  section: "popular" | "season" | "top" | "trending",
  page: number,
  genre?: string,
  seasonParam?: string,
  yearParam?: number,
): Promise<SearchResult> {
  const current = currentAnimeSeason();
  const targetSeason = (seasonParam || current.season).toLowerCase();
  const targetYear = yearParam || current.year;
  const limit = 20;
  const offset = Math.max(0, (page - 1) * limit);

  let path = `/anime?sort=-userCount&page[limit]=${limit}&page[offset]=${offset}`;
  if (section === "top") {
    path = `/anime?sort=-averageRating&page[limit]=${limit}&page[offset]=${offset}`;
  } else if (section === "trending") {
    path =
      page === 1
        ? `/trending/anime?limit=${limit}`
        : `/anime?sort=-userCount&page[limit]=${limit}&page[offset]=${offset}`;
  } else if (section === "season") {
    path = `/anime?filter[season]=${targetSeason}&filter[seasonYear]=${targetYear}&sort=-userCount&page[limit]=${limit}&page[offset]=${offset}`;
  }

  if (genre) {
    path += `&filter[categories]=${encodeURIComponent(genre)}`;
  }

  try {
    const json = await kitsuFetch<{
      data?: KitsuAnimeItem[];
    }>(path);

    const items = (json.data ?? []).map(mapKitsuSlim);

    return {
      items,
      page,
      hasNext: items.length >= limit,
      source: "kitsu",
    };
  } catch {
    return {
      items: FALLBACK_ANIMES,
      page,
      hasNext: false,
      source: "kitsu",
    };
  }
}

export const fetchHomeCatalog =
  createServerFn({
    method: "GET",
  }).handler(
    async () => {
      const key = "home";

      const cached =
        fromCache<HomeCatalog>(
          key,
        );

      if (cached) {
        return cached;
      }

      // 1. Tenta AniList (fonte primária do Hikari)
      try {
        const aniData = await fetchHomeFromAni();
        if (aniData?.trending?.length > 0) {
          return toCache(key, aniData);
        }
      } catch (aniErr) {
        console.warn(
          "[Hikari] AniList indisponível, tentando reserva MyAnimeList / Jikan...",
          aniErr instanceof Error ? aniErr.message : aniErr,
        );
      }

      // 2. Tenta MyAnimeList / Jikan (reserva secundária)
      try {
        const jikanData = await fetchHomeFromJikan();
        if (jikanData?.trending?.length > 0) {
          return toCache(key, jikanData);
        }
      } catch (jikanErr) {
        console.warn(
          "[Hikari] Jikan indisponível, tentando reserva Kitsu...",
          jikanErr instanceof Error ? jikanErr.message : jikanErr,
        );
      }

      // 3. Tenta Kitsu (reserva resiliente contra quedas de AniList e Jikan)
      try {
        const kitsuData = await fetchHomeFromKitsu();
        if (kitsuData?.trending?.length > 0) {
          return toCache(key, kitsuData);
        }
      } catch (kitsuErr) {
        console.warn(
          "[Hikari] Kitsu indisponível, usando catálogo seguro de contingência...",
          kitsuErr instanceof Error ? kitsuErr.message : kitsuErr,
        );
      }

      // 4. Catálogo de segurança local garantido
      return toCache(key, getEmergencyFallbackCatalog());
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

async function searchKitsu(
  params: SearchRequestParams,
): Promise<SearchResult> {
  const page = params.page ?? 1;
  const limit = 20;
  const offset = Math.max(0, (page - 1) * limit);

  if (!params.q) {
    return fetchBrowseFromKitsu("popular", page, params.genre);
  }

  let path = `/anime?filter[text]=${encodeURIComponent(params.q)}&page[limit]=${limit}&page[offset]=${offset}`;
  if (params.genre) {
    path += `&filter[categories]=${encodeURIComponent(params.genre)}`;
  }

  try {
    const json = await kitsuFetch<{
      data?: KitsuAnimeItem[];
    }>(path);

    const items = rankSearchResults(
      (json.data ?? []).map(mapKitsuSlim),
      params.q,
    );

    return {
      items,
      page,
      hasNext: (json.data?.length ?? 0) >= limit,
      source: "kitsu",
    };
  } catch {
    return {
      items: [],
      page,
      hasNext: false,
      source: "kitsu",
    };
  }
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
      searchKitsu(searchParams),
    ]);

    const ani =
      results[0].status === "fulfilled"
        ? results[0].value.items
        : [];

    const jikan =
      results[1].status === "fulfilled"
        ? results[1].value.items
        : [];

    const kitsu =
      results[2].status === "fulfilled"
        ? results[2].value.items
        : [];

    const items = rankSearchResults(
      mergeSearchItems(mergeSearchItems(ani, jikan), kitsu),
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
  source: "anilist" | "jikan" | "kitsu";
}> {
  const attempts = [
    searchAni(params).catch(() => null),
    searchJikan(params).catch(() => null),
    searchKitsu(params).catch(() => null),
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
           * Pesquisa direta nas fontes ao mesmo tempo.
           * Se o AniList estiver fora do ar, Kitsu responde rapidamente.
           */
          const direct = await searchDirectFast(data);

          let items = direct.items;

          /*
           * Se as fontes diretas não encontrarem uma correspondência forte e
           * direta, fazemos a busca flexível para erros e abreviações.
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
          try {
            return toCache(
              key,
              await searchJikan(
                data,
              ),
            );
          } catch {
            return toCache(
              key,
              await searchKitsu(
                data,
              ),
            );
          }
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

      try {
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
          await fetchRecentAdultReleasesFromAni().catch(() => []);

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
      } catch (err) {
        console.warn("[Hikari] Catálogo adulto temporariamente indisponível:", err);
        return toCache(key, {
          items: [],
          recentItems: [],
          page: 1,
          hasNext: false,
          source: "anilist" as const,
        });
      }
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

type AdultTagCatalog = {
  items: SlimAnime[];
  tags: {
    name: string;
    count: number;
    animeIds: string[];
  }[];
};

function normalizeAdultTagName(name: string): string {
  return name.trim().toLowerCase();
}

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

      try {
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

        let data: Record<
          string,
          {
            pageInfo: {
              hasNextPage: boolean;
            };

            media: AniMedia[];
          }
        > | null = null;

        try {
          data = await anilistGraphQL<
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
        } catch {
          hasNextPage = false;
          break;
        }

        if (!data) {
          hasNextPage = false;
          break;
        }

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
    } catch (err) {
      console.warn("[Hikari] Tags adultas indisponíveis:", err);
      return toCache(key, {
        items: [],
        tags: MAIN_ADULT_TAGS.map((t) => ({
          name: t.name,
          count: 0,
          animeIds: [],
        })),
      });
    }
  },
);

const idSchema =
  z.object({
    id: z.string(),
  });

async function fetchKitsuDetail(kitsuId: number): Promise<Anime> {
  const animeJson = await kitsuFetch<{ data: KitsuAnimeItem }>(`/anime/${kitsuId}`);
  const item = animeJson.data;
  if (!item?.id) {
    throw new Error("Anime não encontrado no Kitsu");
  }
  const slim = mapKitsuSlim(item);

  const episodesTask = (async (): Promise<Episode[]> => {
    try {
      const epJson = await kitsuFetch<{
        data?: {
          id: string;
          attributes?: {
            number?: number;
            canonicalTitle?: string;
            titles?: { en_jp?: string; en_us?: string; ja_jp?: string };
            synopsis?: string;
            thumbnail?: { original?: string };
            airdate?: string;
            length?: number;
          };
        }[];
      }>(`/anime/${kitsuId}/episodes?page[limit]=20`);

      return (epJson.data ?? []).map((ep, idx) => {
        const epNum = ep.attributes?.number ?? idx + 1;
        return {
          id: `kitsu-ep-${kitsuId}-${epNum}`,
          number: epNum,
          title:
            ep.attributes?.canonicalTitle ||
            ep.attributes?.titles?.en_us ||
            `Episódio ${epNum}`,
          thumbnail: ep.attributes?.thumbnail?.original,
          synopsis: ep.attributes?.synopsis,
          aired: ep.attributes?.airdate,
        };
      });
    } catch {
      return [];
    }
  })();

  const creditsTask = resolveAnimeCredits({
    kitsuId,
    titles: [slim.titles.romaji, slim.titles.english, slim.titles.native],
    year: slim.year,
    format: slim.format,
  }).catch(
    (): AnimeCreditsResult => ({
      studios: [],
      characters: [],
      staff: [],
    }),
  );

  let [episodes, credits] = await Promise.all([episodesTask, creditsTask]);

  if (episodes.length === 0 && slim.episodesCount) {
    episodes = Array.from(
      { length: Math.min(slim.episodesCount, 24) },
      (_, idx) => ({
        id: `kitsu-ep-${kitsuId}-${idx + 1}`,
        number: idx + 1,
        title: `Episódio ${idx + 1}`,
      }),
    );
  }

  const seasons: Season[] = [
    {
      id: `kitsu-s1-${kitsuId}`,
      number: 1,
      title: "Temporada 1",
      episodes,
    },
  ];

  return {
    ...slim,
    anilistId: credits.anilistId ?? slim.anilistId,
    malId: credits.malId ?? slim.malId,
    studios: credits.studios,
    characters: credits.characters,
    staff: credits.staff,
    streamingEpisodes: [],
    seasons,
    recommendations: [],
    seasonNavigation: {
      items: [
        {
          id: `kitsu-${kitsuId}`,
          title: displayTitle(slim),
        },
      ],
    },
  };
}

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
          `detail:v5:${id}`;

        const cached =
          fromCache<Anime>(
            key,
          );

        if (cached) {
          return cached;
        }

        if (id.startsWith("kitsu-")) {
          const kitsuId = Number(id.replace("kitsu-", ""));
          try {
            const detail = await fetchKitsuDetail(kitsuId);
            if (
              (detail.characters?.length ?? 0) > 0 ||
              (detail.staff?.length ?? 0) > 0
            ) {
              return toCache(key, detail);
            }
            return detail;
          } catch {
            const fallback = FALLBACK_ANIMES.find((a) => a.id === id);
            if (fallback) {
              const fallbackCredits = await resolveAnimeCredits({
                anilistId: fallback.anilistId,
                malId: fallback.malId,
                kitsuId: fallback.kitsuId ?? kitsuId,
                titles: [
                  fallback.titles.romaji,
                  fallback.titles.english,
                  fallback.titles.native,
                ],
                year: fallback.year,
                format: fallback.format,
              }).catch(
                (): AnimeCreditsResult => ({
                  studios: [],
                  characters: [],
                  staff: [],
                }),
              );

              return {
                ...fallback,
                studios: fallbackCredits.studios,
                streamingEpisodes: [],
                seasons: [
                  {
                    id: `s1-${fallback.id}`,
                    number: 1,
                    title: "Temporada 1",
                    episodes: Array.from(
                      { length: fallback.episodesCount ?? 12 },
                      (_, i) => ({
                        id: `ep-${fallback.id}-${i + 1}`,
                        number: i + 1,
                        title: `Episódio ${i + 1}`,
                      }),
                    ),
                  },
                ],
                recommendations: [],
                characters: fallbackCredits.characters,
                staff: fallbackCredits.staff,
              };
            }
            return null;
          }
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

          let seasons: Season[] = [];
          let jikanPictures: string[] = [];

          try {
            const [seasonsRes, picsRes] = await Promise.allSettled([
              jikanEpisodes(malId),
              fetchJikanPictures(malId),
            ]);
            if (seasonsRes.status === "fulfilled") {
              seasons = seasonsRes.value;
            }
            if (picsRes.status === "fulfilled") {
              jikanPictures = picsRes.value;
            }
          } catch {
            seasons = [];
            jikanPictures = [];
          }

          let seasonNavigation:
            SeasonNavigation | undefined;
          let aniMedia: AniMedia | null = null;

          try {
            aniMedia =
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

          const mappedAni = aniMedia ? mapAniFull(aniMedia, seasons, seasonNavigation, jikanPictures) : null;
          const jikanStudios = (json.data.studios ?? [])
            .map((studio) => studio.name?.trim())
            .filter((name): name is string => Boolean(name));

          let resolvedCharacters = mappedAni?.characters ?? [];
          let resolvedStaff = mappedAni?.staff ?? [];
          let resolvedStudios =
            jikanStudios.length > 0
              ? jikanStudios
              : (mappedAni?.studios ?? []);

          if (
            resolvedCharacters.length === 0 ||
            resolvedStaff.length === 0 ||
            resolvedStudios.length === 0
          ) {
            const extraCredits = await resolveAnimeCredits({
              anilistId: aniMedia?.id,
              malId,
              titles: [
                slim.titles.romaji,
                slim.titles.english,
                slim.titles.native,
              ],
              year: slim.year,
              format: slim.format,
              skipAnilist: Boolean(aniMedia),
            }).catch(() => null);

            if (extraCredits) {
              if (resolvedCharacters.length === 0 && extraCredits.characters.length > 0) {
                resolvedCharacters = extraCredits.characters;
              }
              if (resolvedStaff.length === 0 && extraCredits.staff.length > 0) {
                resolvedStaff = extraCredits.staff;
              }
              if (resolvedStudios.length === 0 && extraCredits.studios.length > 0) {
                resolvedStudios = extraCredits.studios;
              }
            }
          }

          const anime: Anime & {
            seasonNavigation?: SeasonNavigation;
          } = {
            ...slim,
            anilistId: aniMedia?.id ?? slim.anilistId,
            studios: resolvedStudios,
            streamingEpisodes: [],
            seasons,
            images: jikanPictures.length > 0 ? jikanPictures : (mappedAni?.images ?? []),
            recommendations: mappedAni?.recommendations ?? [],
            characters: resolvedCharacters,
            staff: resolvedStaff,
            originSource: mappedAni?.originSource ?? (json.data as Record<string, unknown>)?.source as string ?? null,
            countryOfOrigin: mappedAni?.countryOfOrigin ?? "JP",
            startDate: mappedAni?.startDate ?? null,
            endDate: mappedAni?.endDate ?? null,
            rating: ((json.data as Record<string, unknown>)?.rating as string) ?? null,
            seasonNavigation,
          };

          if (resolvedCharacters.length > 0 || resolvedStaff.length > 0) {
            return toCache(key, anime);
          }

          return anime;
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
                  source
                  countryOfOrigin
                  startDate {
                    year
                    month
                    day
                  }
                  endDate {
                    year
                    month
                    day
                  }

                  ${ANI_CREDITS_FIELDS}

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

                  synonyms

                  relations {
                    edges {
                      relationType
                      node {
                        id
                        idMal
                        type
                        format
                        status
                        episodes
                        seasonYear
                        startDate {
                          year
                          month
                          day
                        }
                        title {
                          romaji
                          english
                        }
                        coverImage {
                          extraLarge
                          large
                        }
                        bannerImage
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

          let seasons: Season[] = [];
          let jikanPictures: string[] = [];

          if (
            media.streamingEpisodes &&
            media.streamingEpisodes.length > 0
          ) {
            const fromStream: Episode[] =
              media.streamingEpisodes.map(
                (episode, index) => ({
                  id: `stream-${media.id}-${index}`,
                  number: index + 1,
                  title:
                    episode.title ??
                    `Episódio ${index + 1}`,
                  thumbnail: episode.thumbnail,
                  videoUrl: episode.url,
                }),
              );

            const count =
              media.episodes ??
              fromStream.length;

            const episodes =
              fromStream.length >= count
                ? fromStream
                : Array.from(
                    { length: count },
                    (_, index) => {
                      const found =
                        fromStream[index];
                      return (
                        found ?? {
                          id: `ep-${media.id}-${index + 1}`,
                          number: index + 1,
                          title: `Episódio ${index + 1}`,
                        }
                      );
                    },
                  );

            seasons = [
              {
                id: `s1-${media.id}`,
                number: 1,
                title: "Temporada 1",
                episodes,
              },
            ];
          } else if (media.idMal) {
            try {
              const [seasonsRes, picsRes] = await Promise.allSettled([
                Promise.race([
                  jikanEpisodes(media.idMal),
                  new Promise<Season[]>((_, reject) =>
                    setTimeout(
                      () =>
                        reject(
                          new Error(
                            "Jikan timeout",
                          ),
                        ),
                      2000,
                    ),
                  ),
                ]),
                Promise.race([
                  fetchJikanPictures(media.idMal),
                  new Promise<string[]>((_, reject) =>
                    setTimeout(
                      () =>
                        reject(
                          new Error(
                            "Jikan pics timeout",
                          ),
                        ),
                      2000,
                    ),
                  ),
                ]),
              ]);

              if (seasonsRes.status === "fulfilled") {
                seasons = seasonsRes.value;
              }
              if (picsRes.status === "fulfilled") {
                jikanPictures = picsRes.value;
              }
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

          const mapped = mapAniFull(
            media,
            seasons,
            seasonNavigation,
            jikanPictures,
          );

          if (
            (mapped.characters?.length ?? 0) === 0 ||
            (mapped.staff?.length ?? 0) === 0 ||
            (mapped.studios?.length ?? 0) === 0
          ) {
            const extraCredits = await resolveAnimeCredits({
              anilistId,
              malId: media.idMal ?? undefined,
              titles: [
                mapped.titles.romaji,
                mapped.titles.english,
                mapped.titles.native,
              ],
              year: mapped.year,
              format: mapped.format,
              skipAnilist: true,
            }).catch(() => null);

            if (extraCredits) {
              if ((mapped.characters?.length ?? 0) === 0 && extraCredits.characters.length > 0) {
                mapped.characters = extraCredits.characters;
              }
              if ((mapped.staff?.length ?? 0) === 0 && extraCredits.staff.length > 0) {
                mapped.staff = extraCredits.staff;
              }
              if ((mapped.studios?.length ?? 0) === 0 && extraCredits.studios.length > 0) {
                mapped.studios = extraCredits.studios;
              }
            }
          }

          return toCache(key, mapped);
        } catch {
          // O ID desta rota é um ID do AniList.
          // Se o AniList estiver indisponível, verificamos se o anime está no catálogo seguro
          const fallback = FALLBACK_ANIMES.find(
            (a) => a.anilistId === anilistId || a.id === id,
          );

          if (fallback) {
            const fallbackCredits = await resolveAnimeCredits({
              anilistId: fallback.anilistId ?? anilistId,
              malId: fallback.malId,
              kitsuId: fallback.kitsuId,
              titles: [
                fallback.titles.romaji,
                fallback.titles.english,
                fallback.titles.native,
              ],
              year: fallback.year,
              format: fallback.format,
              skipAnilist: true,
            }).catch(
              (): AnimeCreditsResult => ({
                studios: [],
                characters: [],
                staff: [],
              }),
            );

            const fallbackDetail = {
              ...fallback,
              studios: fallbackCredits.studios,
              streamingEpisodes: [],
              seasons: [
                {
                  id: `s1-${fallback.id}`,
                  number: 1,
                  title: "Temporada 1",
                  episodes: Array.from(
                    { length: fallback.episodesCount ?? 12 },
                    (_, i) => ({
                      id: `ep-${fallback.id}-${i + 1}`,
                      number: i + 1,
                      title: `Episódio ${i + 1}`,
                    }),
                  ),
                },
              ],
              recommendations: [],
              characters: fallbackCredits.characters,
              staff: fallbackCredits.staff,
              seasonNavigation: {
                items: [
                  {
                    id: String(fallback.anilistId ?? fallback.id),
                    title: displayTitle(fallback),
                  },
                ],
              },
            };

            if (
              fallbackCredits.characters.length > 0 ||
              fallbackCredits.staff.length > 0
            ) {
              return toCache(key, fallbackDetail);
            }

            return fallbackDetail;
          }

          return null;
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
    return [
      "Action",
      "Adventure",
      "Comedy",
      "Drama",
      "Fantasy",
      "Horror",
      "Mystery",
      "Romance",
      "Sci-Fi",
      "Slice of Life",
      "Sports",
      "Supernatural",
      "Thriller",
    ];
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
          try {
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
          } catch {
            return toCache(
              key,
              await fetchBrowseFromKitsu(data.section, page, genre, season, year),
            );
          }
        }
      },
    );
