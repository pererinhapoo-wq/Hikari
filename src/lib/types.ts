export type Episode = {
  id: string;
  number: number;
  title: string;
  thumbnail?: string;
  duration?: string;
  videoUrl?: string;
  videoUrl2?: string;
  videoUrl3?: string;
  synopsis?: string;
  aired?: string;
};

export type Season = {
  id: string;
  number: number;
  title: string;
  episodes: Episode[];
};

export type StreamingLink = {
  title: string;
  thumbnail: string;
  url: string;
  site: string;
};

export type SlimAnime = {
  id: string;
  anilistId?: number;
  malId?: number;
  titles: { romaji: string; english: string; native: string };
  cover: string;
  banner: string;
  synopsis: string;
  score: number | null;
  genres: string[];
  format: string;
  status: string;
  episodesCount: number | null;
  season: string | null;
  year: number | null;
  trailerId: string | null;
  color?: string;
  source: "anilist" | "jikan" | "local";
};

export type Anime = SlimAnime & {
  studios: string[];
  duration?: number | null;
  nextEpisode?: { episode: number; airingAt: number };
  streamingEpisodes: StreamingLink[];
  seasons: Season[];
  recommendations: SlimAnime[];
};

export type LocalAnime = {
  id: string;
  anilistId?: number;
  malId?: number;
  titleRomaji: string;
  titleEnglish: string;
  titleNative: string;
  cover: string;
  banner: string;
  synopsis: string;
  score: number | null;
  genres: string[];
  format: string;
  status: string;
  episodesCount: number | null;
  season: string | null;
  year: number | null;
  trailerId: string | null;
  hidden: boolean;
  seasons: Season[];
  createdAt: number;
  updatedAt: number;
};

export type HomeCatalog = {
  trending: SlimAnime[];
  popular: SlimAnime[];
  top: SlimAnime[];
  season: SlimAnime[];
  releases: SlimAnime[];
  seasonName: string;
  seasonYear: number;
  source: "anilist" | "jikan";
  genres: string[];
};

export type SearchParams = {
  q?: string;
  genre?: string;
  year?: string;
  format?: string;
  status?: string;
  sort?: string;
  page?: number;
};

export type SearchResult = {
  items: SlimAnime[];
  page: number;
  hasNext: boolean;
  source: "anilist" | "jikan";
};

export function displayTitle(
  a: { titles: SlimAnime["titles"] } | SlimAnime,
): string {
  return a.titles.english || a.titles.romaji || a.titles.native || "Sem título";
}

export function localToAnime(local: LocalAnime): Anime {
  return {
    id: local.id,
    anilistId: local.anilistId,
    malId: local.malId,
    titles: {
      romaji: local.titleRomaji,
      english: local.titleEnglish,
      native: local.titleNative,
    },
    cover: local.cover,
    banner: local.banner,
    synopsis: local.synopsis,
    score: local.score,
    genres: local.genres,
    format: local.format,
    status: local.status,
    episodesCount: local.episodesCount,
    season: local.season,
    year: local.year,
    trailerId: local.trailerId,
    source: "local",
    studios: [],
    streamingEpisodes: [],
    seasons: local.seasons,
    recommendations: [],
  };
}

export function animeToLocal(
  anime: Anime | SlimAnime,
  existing?: LocalAnime,
): LocalAnime {
  const now = Date.now();

  return {
    id:
      existing?.id ??
      (anime.source === "local"
        ? anime.id
        : `local-${crypto.randomUUID()}`),
    anilistId: anime.anilistId,
    malId: anime.malId,
    titleRomaji: anime.titles.romaji,
    titleEnglish: anime.titles.english,
    titleNative: anime.titles.native,
    cover: anime.cover,
    banner: anime.banner,
    synopsis: anime.synopsis,
    score: anime.score,
    genres: anime.genres,
    format: anime.format,
    status: anime.status,
    episodesCount: anime.episodesCount,
    season: anime.season,
    year: anime.year,
    trailerId: anime.trailerId,
    hidden: existing?.hidden ?? false,
    seasons: existing?.seasons ?? ("seasons" in anime ? anime.seasons : []),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  }
