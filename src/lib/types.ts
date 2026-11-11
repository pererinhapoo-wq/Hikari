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
  todayEpisode?: {
    number: number;
    airingAt: number;
  };
  todayUpcomingEpisodes?: {
    number: number;
    airingAt: number;
  }[];
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
  todaySchedule: SlimAnime[];
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
  a?:
    | {
        titles?: { english?: string | null; romaji?: string | null; native?: string | null };
        titleRomaji?: string | null;
        titleEnglish?: string | null;
        titleNative?: string | null;
        title?: string | null;
      }
    | SlimAnime
    | LocalAnime
    | null,
): string {
  if (!a) return "Sem título";
  const obj = a as Record<string, any>;

  const english =
    obj.titles?.english?.trim() ||
    (typeof obj.titleEnglish === "string" ? obj.titleEnglish.trim() : undefined);

  const romaji =
    obj.titles?.romaji?.trim() ||
    (typeof obj.titleRomaji === "string" ? obj.titleRomaji.trim() : undefined);

  const rawTitle =
    typeof obj.title === "string" ? obj.title.trim() : undefined;

  const native =
    obj.titles?.native?.trim() ||
    (typeof obj.titleNative === "string" ? obj.titleNative.trim() : undefined);

  return english || romaji || rawTitle || native || "Sem título";
}

export function localToAnime(local: LocalAnime): Anime {
  return {
    id: local.id,
    anilistId: local.anilistId,
    malId: local.malId,
    kitsuId: local.kitsuId,
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

/**
 * Normaliza URLs de imagem removendo parâmetros auxiliares de cache/CORS
 * para comparações determinísticas de igualdade.
 */
export function normalizeImageUrl(url?: string | null): string {
  if (!url) return "";
  const trimmed = url.trim();
  if (!trimmed) return "";

  try {
    const parsed = new URL(trimmed);
    parsed.searchParams.delete("cors");
    const search = parsed.searchParams.toString();
    const cleanPath = parsed.pathname.replace(/\/+$/, "");
    return `${parsed.protocol.toLowerCase()}//${parsed.host.toLowerCase()}${cleanPath}${
      search ? `?${search}` : ""
    }`;
  } catch {
    return trimmed.replace(/[?&]cors=1\b/g, "").replace(/\/+$/, "");
  }
}

/**
 * Valida se uma URL é segura para persistência (rejeita esquemas temporários blob:
 * e Data URLs em Base64 maiores que 2048 caracteres).
 */
export function isValidImageUrl(url?: string | null): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  if (lower.startsWith("blob:")) return false;
  if (lower.startsWith("data:") && trimmed.length > 2048) return false;
  return true;
}

/**
 * Identifica se uma URL pertence aos CDNs remotos padrão (AniList, MyAnimeList, Kitsu).
 */
export function isRemoteDefaultCdn(url?: string | null): boolean {
  if (!url) return false;
  try {
    const host = new URL(url.trim()).hostname.toLowerCase();
    return (
      host === "s4.anilist.co" ||
      host.endsWith(".anilist.co") ||
      host === "cdn.myanimelist.net" ||
      host.endsWith(".myanimelist.net") ||
      host === "media.kitsu.app" ||
      host.endsWith(".kitsu.app")
    );
  } catch {
    return false;
  }
}

/**
 * Verifica se uma URL existente representa uma imagem personalizada pelo administrador.
 * Considera-se personalizada quando:
 * 1. For uma URL válida que não pertence a um CDN remoto padrão; OU
 * 2. Quando pertencer a um CDN remoto, mas for diferente da URL padrão do catálogo remoto.
 */
export function isCustomImageUrl(
  candidateUrl?: string | null,
  remoteDefaultUrl?: string | null,
): boolean {
  if (!candidateUrl) return false;
  const trimmedCandidate = candidateUrl.trim();
  if (!trimmedCandidate || !isValidImageUrl(trimmedCandidate)) return false;

  // Se a imagem não for de um CDN remoto padrão, é uma URL personalizada pelo admin
  if (!isRemoteDefaultCdn(trimmedCandidate)) {
    return true;
  }

  // Se for de um CDN remoto mas não há imagem remota comparável, mantém como personalizada
  if (!remoteDefaultUrl) return true;
  const trimmedRemote = remoteDefaultUrl.trim();
  if (!trimmedRemote) return true;

  // Se for de um CDN remoto, compara se é diferente da imagem remota padrão
  return normalizeImageUrl(trimmedCandidate) !== normalizeImageUrl(trimmedRemote);
}

/**
 * Resolve a imagem final preservando URLs personalizadas e evitando sobrescritas acidentais.
 */
export function resolvePreservedImage(
  incomingUrl?: string | null,
  existingUrl?: string | null,
  isLocalSource?: boolean,
): string {
  const cleanExisting =
    existingUrl?.trim() && isValidImageUrl(existingUrl) ? existingUrl.trim() : "";
  const cleanIncoming =
    incomingUrl?.trim() && isValidImageUrl(incomingUrl) ? incomingUrl.trim() : "";

  if (isLocalSource) {
    // Edição pelo admin: nova URL intencional tem prioridade;
    // se não enviada ou vazia, preserva a imagem existente.
    return cleanIncoming || cleanExisting;
  }

  // Importação ou sincronização remota (AniList/Jikan/Kitsu):
  // Se já existe uma imagem personalizada no registro local, ela NUNCA deve ser substituída pela imagem remota padrão.
  if (cleanExisting && isCustomImageUrl(cleanExisting, cleanIncoming)) {
    return cleanExisting;
  }

  // Se não havia imagem personalizada, aceita a nova imagem remota
  return cleanIncoming || cleanExisting;
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
  const isLocalSource = anime.source === "local";

  const resolvedCover = resolvePreservedImage(
    anime.cover,
    existing?.cover,
    isLocalSource,
  );

  const resolvedBanner = resolvePreservedImage(
    anime.banner,
    existing?.banner,
    isLocalSource,
  );

  return {
    id:
      existing?.id ??
      (isLocalSource
        ? anime.id
        : `local-${crypto.randomUUID()}`),
    anilistId: anime.anilistId ?? existing?.anilistId,
    malId: anime.malId ?? existing?.malId,
    kitsuId: anime.kitsuId ?? existing?.kitsuId,
    titleRomaji: anime.titles.romaji,
    titleEnglish: anime.titles.english,
    titleNative: anime.titles.native,
    cover: resolvedCover,
    banner: resolvedBanner,
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
      isLocalSource && "seasons" in anime && Array.isArray(anime.seasons) && anime.seasons.length > 0
        ? anime.seasons
        : (existing?.seasons ?? defaultSeasons),
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
