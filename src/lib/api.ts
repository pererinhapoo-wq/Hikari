import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { currentAnimeSeason, stripHtml, youtubeIdFrom } from "@/lib/utils";
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
  title { romaji english native }
  coverImage { extraLarge large color }
  bannerImage
  averageScore
  genres
  format
  status
  episodes
  season
  seasonYear
  description(asHtml: false)
  trailer { id site thumbnail }
`;

type AniTitle = {
  romaji?: string | null;
  english?: string | null;
  native?: string | null;
};

type AniMedia = {
  id: number;
  idMal?: number | null;
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
  studios?: { nodes?: { name: string }[] | null } | null;
  nextAiringEpisode?: { episode: number; airingAt: number } | null;
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

const cache = new Map<string, { at: number; data: unknown }>();
const TTL = 5 * 60 * 1000;

function fromCache<T>(key: string): T | null {
  const hit = cache.get(key);

  if (!hit) return null;

  if (Date.now() - hit.at > TTL) {
    cache.delete(key);
    return null;
  }

  return hit.data as T;
}

function toCache<T>(key: string, data: T): T {
  cache.set(key, { at: Date.now(), data });
  return data;
}

async function anilistGraphQL<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(ANILIST, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) {
    throw new Error(`AniList indisponível (${res.status})`);
  }

  const json = (await res.json()) as {
    data?: T;
    errors?: { message: string }[];
  };

  if (json.errors?.length) {
    throw new Error(json.errors[0]?.message ?? "AniList error");
  }

  if (!json.data) {
    throw new Error("AniList sem dados");
  }

  return json.data;
}

async function jikanFetch<T>(path: string, attempt = 0): Promise<T> {
  const res = await fetch(`${JIKAN}${path}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Hikari/1.0 (anime catalog)",
    },
    signal: AbortSignal.timeout(12000),
  });

  if (res.status === 429 && attempt < 2) {
    await new Promise((r) => setTimeout(r, 900 * (attempt + 1)));

    return jikanFetch<T>(path, attempt + 1);
  }

  if (!res.ok) {
    throw new Error(`MyAnimeList indisponível (${res.status})`);
  }

  return (await res.json()) as T;
}

function trailerFromAni(media: AniMedia): string | null {
  const t = media.trailer;

  if (!t?.id) return null;

  if ((t.site ?? "youtube").toLowerCase() === "youtube") {
    return t.id;
  }

  return youtubeIdFrom(t.id);
}

function mapAniSlim(media: AniMedia): SlimAnime {
  return {
    id: String(media.id),
    anilistId: media.id,
    malId: media.idMal ?? undefined,
    titles: {
      romaji: media.title?.romaji ?? "",
      english: media.title?.english ?? "",
      native: media.title?.native ?? "",
    },
    cover:
      media.coverImage?.extraLarge ||
      media.coverImage?.large ||
      "",
    banner: media.bannerImage || "",
    synopsis: stripHtml(media.description),
    score: media.averageScore ?? null,
    genres: media.genres ?? [],
    format: media.format ?? "",
    status: media.status ?? "",
    episodesCount: media.episodes ?? null,
    season: media.season ?? null,
    year: media.seasonYear ?? null,
    trailerId: trailerFromAni(media),
    color: media.coverImage?.color ?? undefined,
    source: "anilist",
  };
}

type JikanAnime = {
  mal_id: number;
  title?: string;
  title_english?: string | null;
  title_japanese?: string | null;
  synopsis?: string | null;
  score?: number | null;
  episodes?: number | null;
  status?: string | null;
  type?: string | null;
  year?: number | null;
  season?: string | null;
  genres?: { name: string }[];
  images?: {
    jpg?: {
      large_image_url?: string;
      image_url?: string;
    };
  };
  trailer?: {
    youtube_id?: string | null;
    images?: {
      maximum_image_url?: string;
    };
  };
  studios?: { name: string }[];
  duration?: string | null;
};

function jikanStatus(status?: string | null): string {
  const s = (status ?? "").toLowerCase();

  if (s.includes("air")) return "RELEASING";
  if (s.includes("finish") || s.includes("complete")) {
    return "FINISHED";
  }
  if (s.includes("not yet") || s.includes("upcoming")) {
    return "NOT_YET_RELEASED";
  }
  if (s.includes("hiatus")) return "HIATUS";

  return status?.toUpperCase().replace(/\s+/g, "_") ?? "";
}

function jikanFormat(type?: string | null): string {
  const t = (type ?? "").toUpperCase();

  if (t === "TV") return "TV";
  if (t === "MOVIE") return "MOVIE";
  if (t === "OVA") return "OVA";
  if (t === "ONA") return "ONA";
  if (t === "SPECIAL") return "SPECIAL";
  if (t === "MUSIC") return "MUSIC";

  return t;
}

function mapJikanSlim(a: JikanAnime): SlimAnime {
  return {
    id: `mal-${a.mal_id}`,
    malId: a.mal_id,
    titles: {
      romaji: a.title ?? "",
      english: a.title_english ?? "",
      native: a.title_japanese ?? "",
    },
    cover:
      a.images?.jpg?.large_image_url ||
      a.images?.jpg?.image_url ||
      "",
    banner: a.trailer?.images?.maximum_image_url || "",
    synopsis: stripHtml(a.synopsis),
    score: a.score != null ? Math.round(a.score * 10) : null,
    genres: (a.genres ?? []).map((g) => g.name),
    format: jikanFormat(a.type),
    status: jikanStatus(a.status),
    episodesCount: a.episodes ?? null,
    season: a.season ? a.season.toUpperCase() : null,
    year: a.year ??
