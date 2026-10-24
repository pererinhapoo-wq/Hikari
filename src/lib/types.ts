export type Episode = {
  id: string;
  number: number;
  title: string;
  thumbnail?: string;
  duration?: string;
  videoUrl?: string;
  videoUrl2?: string;
  videoUrl3?: string;
  videoUrl4?: string;
  videoUrl5?: string;
  synopsis?: string;
  aired?: string;
  published?: boolean;
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
  kitsuId?: number;
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
  source: "anilist" | "jikan" | "kitsu" | "local" | "cache";
};

export type AnimeVoiceActor = {
  id: number;
  name: { full: string; native?: string };
  image?: string;
  language: string;
};

export type AnimeCharacter = {
  id: number;
  name: { full: string; native?: string };
  image?: string;
  role: string;
  voiceActors: AnimeVoiceActor[];
};

export type AnimeStaff = {
  id: number;
  name: string;
  role: string;
  image?: string;
};

export type Anime = SlimAnime & {
  studios: string[];
  duration?: number | null;
  nextEpisode?: { episode: number; airingAt: number };
  streamingEpisodes: StreamingLink[];
  seasons: Season[];
  recommendations: SlimAnime[];
  characters?: AnimeCharacter[];
  staff?: AnimeStaff[];
  originSource?: string | null;
  countryOfOrigin?: string | null;
  startDate?: { year?: number | null; month?: number | null; day?: number | null } | null;
  endDate?: { year?: number | null; month?: number | null; day?: number | null } | null;
  rating?: string | null;
  synonyms?: string[];
  tags?: string[];
  images?: string[];
  producers?: string[];
  licensors?: string[];
  broadcast?: string | null;
  seasonNavigation?: SeasonNavigation;
};

export type SeasonNavigationItem = {
  id: string;
  title?: string;
};

export type SeasonNavigation = {
  items: SeasonNavigationItem[];
  previous?: SeasonNavigationItem;
  next?: SeasonNavigationItem;
};

export type LocalAnime = {
  id: string;
  anilistId?: number;
  malId?: number;
  kitsuId?: number;
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
  studios?: string[];
  characters?: AnimeCharacter[];
  staff?: AnimeStaff[];
};

export type HomeCatalog = {
  trending: SlimAnime[];
  popular: SlimAnime[];
  top: SlimAnime[];
  season: SlimAnime[];
  releases: SlimAnime[];
  seasonName: string;
  seasonYear: number;
  source: "anilist" | "jikan" | "kitsu" | "cache";
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
  total?: number;
  source: "anilist" | "jikan" | "kitsu";
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
    studios: local.studios ?? [],
    streamingEpisodes: [],
    seasons: local.seasons,
    recommendations: [],
    characters: local.characters ?? [],
    staff: local.staff ?? [],
  };
}

export function animeToLocal(
  anime: Anime | SlimAnime,
  existing?: LocalAnime,
): LocalAnime {
  const now = Date.now();

  const defaultSeasons: Season[] = [
    {
      id: `s-${crypto.randomUUID()}`,
      number: 1,
      title: "Temporada 1",
      episodes: [],
    },
  ];

  const fullAnime = anime as Partial<Anime>;

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
    seasons:
      existing?.seasons ??
      (anime.source === "local" && "seasons" in anime
        ? anime.seasons
        : defaultSeasons),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    studios:
      existing?.studios ??
      (Array.isArray(fullAnime.studios) && fullAnime.studios.length > 0
        ? fullAnime.studios
        : undefined),
    characters:
      existing?.characters ??
      (Array.isArray(fullAnime.characters) && fullAnime.characters.length > 0
        ? fullAnime.characters
        : undefined),
    staff:
      existing?.staff ??
      (Array.isArray(fullAnime.staff) && fullAnime.staff.length > 0
        ? fullAnime.staff
        : undefined),
  };
}
