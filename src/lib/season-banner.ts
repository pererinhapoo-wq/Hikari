import type { Anime, LocalAnime } from "./types.ts";

export interface ImageDimensions {
  width: number;
  height: number;
  aspect: number;
}

export interface SeasonBannerInput {
  animeId: string;
  anilistId?: number;
  malId?: number;
  kitsuId?: number;
  year?: number | null;
  startYear?: number | null;
  format?: string | null;
  status?: string | null;
  currentBanner?: string | null;
  currentCover?: string | null;
  isAdminCustomBanner?: boolean;
  fetchJikanPictures?: (malId: number) => Promise<string[]>;
}

export type AlternativeBannerSource =
  | "kitsu-season"
  | "jikan-season"
  | "livechart-season";

export interface ResolvedSeasonBanner {
  url: string | null;
  isAlternative: boolean;
  source:
    | "admin"
    | AlternativeBannerSource
    | "season-default"
    | "none";
  initialObjectPosition: string;
  aspect?: number;
}

export interface ViewportBannerSelectionParams {
  animeId?: string | null;
  isMobileViewport: boolean;
  isAdminBanner: boolean;
  baseSeasonBanner?: string | null;
  mobileBannerState?: {
    forId: string;
    url: string;
    isAlternative: boolean;
    initialObjectPosition: string;
  } | null;
  failedBannerUrls?: Record<string, true>;
}

export interface ViewportBannerSelectionResult {
  effectiveBannerUrl: string | null;
  defaultObjectPosition: string;
  isUsingMobileAlternative: boolean;
}

interface CacheEntry {
  url: string | null;
  source?: AlternativeBannerSource;
  aspect?: number;
  expiresAt: number;
}

const CACHE_PREFIX = "hikari:season-banner:v7:";
const POSITIVE_TTL_MS = 24 * 60 * 60 * 1000;
const NEGATIVE_TTL_MS = 6 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 2500;
const JIKAN_FETCH_TIMEOUT_MS = 2200;
const IMAGE_PROBE_TIMEOUT_MS = 3500;
const PROVIDER_COOLDOWN_MS = 60 * 1000;

export const MIN_ALT_WIDTH = 800;
export const MIN_ALT_HEIGHT = 400;
export const MIN_JIKAN_WIDTH = 580;
export const MIN_JIKAN_HEIGHT = 400;
export const MIN_HORIZONTAL_ASPECT = 1.30;
const MAX_STANDARD_HORIZONTAL_ASPECT = 2.05;
export const MAX_MOBILE_ALT_ASPECT = 2.05;
export const MAX_KITSU_ALT_ASPECT = 3.35;
export const MAX_PANORAMIC_BANNER_ASPECT = 2.5;

/**
 * Alternativas mobile específicas registradas por ID da temporada:
 * Garantem resolução determinística sem latência de rede, sem risco de timeout de APIs externas
 * e imunes a bloqueios por rate limiting ou cache negativo.
 * Utilizado para temporadas com banners panorâmicos de PC (> 2.5:1) que necessitam de artes
 * limpas e apropriadas para celular com foco nos personagens.
 */
export const SPECIFIC_SEASON_MOBILE_ALTERNATIVES: Record<
  string,
  {
    url: string;
    aspect: number;
    source: AlternativeBannerSource;
    initialObjectPosition?: string;
    expectedYear?: number;
    format?: string;
  }
> = {
  // The Fragrant Flower Blooms With Dignity (AniList ID 181444 / MAL ID 59845 / Kitsu 49205)
  // Referência visual oficial do Kitsu: 1920x586 (proporção 3.276:1), enquadramento 50% 24%
  "181444": {
    url: "https://media.kitsu.app/anime/49205/cover_image/f430c372e17c02002329ebdad9f98f49.jpg",
    aspect: 1920 / 586,
    source: "kitsu-season",
    initialObjectPosition: "50% 24%",
    expectedYear: 2025,
    format: "TV",
  },
  // Kizumonogatari III: Reiketsu-hen (AniList ID 21400 / MAL ID 31758 / Kitsu 11407)
  // Imagem de referência aprovada: Kitsu 11407 (1280x911, proporção 1.405:1), enquadramento 50% 24%
  "21400": {
    url: "https://media.kitsu.app/anime/cover_images/11407/original.jpg",
    aspect: 1280 / 911,
    source: "kitsu-season",
    initialObjectPosition: "50% 24%",
    expectedYear: 2017,
    format: "MOVIE",
  },
  // Kizumonogatari II: Nekketsu-hen (AniList ID 21399 / MAL ID 31757 / Kitsu 11406)
  // Referência visual aprovada: Kitsu 11406 (1800x1056, proporção 1.705:1), enquadramento 52% 20%
  "21399": {
    url: "https://media.kitsu.app/anime/cover_images/11406/original.jpg",
    aspect: 1800 / 1056,
    source: "kitsu-season",
    initialObjectPosition: "52% 20%",
    expectedYear: 2016,
    format: "MOVIE",
  },
  // Gintama (2006) (AniList ID 918 / MAL ID 918 / Kitsu 818)
  // Referência visual aprovada: Kitsu 818 (1920x1200, proporção 1.60:1), enquadramento 52% 20%
  "918": {
    url: "https://media.kitsu.app/anime/cover_images/818/original.jpg",
    aspect: 1920 / 1200,
    source: "kitsu-season",
    initialObjectPosition: "52% 20%",
    expectedYear: 2006,
    format: "TV",
  },
  // Gintama' (2011) (AniList ID 9969 / MAL ID 9969 / Kitsu 5971)
  // Referência visual aprovada: Kitsu 5971 (1280x863, proporção 1.483:1), enquadramento 52% 20%
  "9969": {
    url: "https://media.kitsu.app/anime/cover_images/5971/original.jpg",
    aspect: 1280 / 863,
    source: "kitsu-season",
    initialObjectPosition: "52% 20%",
    expectedYear: 2011,
    format: "TV",
  },
  // Gintama': Enchousen (2012) (AniList ID 15417 / MAL ID 15417 / Kitsu 7253)
  // Arte oficial do Kitsu: 1920x1080 (proporção 1.778:1), enquadramento 52% 20%
  "15417": {
    url: "https://media.kitsu.app/anime/cover_images/7253/original.jpg",
    aspect: 1920 / 1080,
    source: "kitsu-season",
    initialObjectPosition: "52% 20%",
    expectedYear: 2012,
    format: "TV",
  },
  // Gintama° (2015) (AniList ID 20996 / MAL ID 28977 / Kitsu 10083)
  // Arte oficial do Kitsu: 1920x1261 (proporção 1.523:1), enquadramento 52% 20%
  "20996": {
    url: "https://media.kitsu.app/anime/cover_images/10083/original.jpg",
    aspect: 1920 / 1261,
    source: "kitsu-season",
    initialObjectPosition: "52% 20%",
    expectedYear: 2015,
    format: "TV",
  },
  // Gintama. (2017) (AniList ID 97889 / MAL ID 34096 / Kitsu 12553)
  // Arte oficial do Kitsu: 1920x1208 (proporção 1.589:1), enquadramento 52% 20%
  "97889": {
    url: "https://media.kitsu.app/anime/cover_images/12553/original.jpg",
    aspect: 1920 / 1208,
    source: "kitsu-season",
    initialObjectPosition: "52% 20%",
    expectedYear: 2017,
    format: "TV",
  },
  // Durarara!! Season 1 (AniList ID 6746 / MAL ID 6746 / Kitsu 5324)
  // Arte oficial do Kitsu: 1484x1084 (proporção 1.369:1), enquadramento 50% 24%
  "6746": {
    url: "https://media.kitsu.app/anime/cover_images/5324/original.jpg",
    aspect: 1484 / 1084,
    source: "kitsu-season",
    initialObjectPosition: "50% 24%",
    expectedYear: 2010,
    format: "TV",
  },
  // Durarara!!×2 Shou (AniList ID 20652 / MAL ID 23199 / Kitsu 8314)
  // Arte oficial do Kitsu: 1920x1080 (proporção 1.778:1), enquadramento 52% 20%
  "20652": {
    url: "https://media.kitsu.app/anime/cover_images/8314/original.jpg",
    aspect: 1920 / 1080,
    source: "kitsu-season",
    initialObjectPosition: "52% 20%",
    expectedYear: 2015,
    format: "TV",
  },
  // Durarara!!×2 Ten (AniList ID 20879 / MAL ID 27831 / Kitsu 9726)
  // Arte oficial do Kitsu: 1920x1080 (proporção 1.778:1), enquadramento 62% 20%
  "20879": {
    url: "https://media.kitsu.app/anime/cover_images/9726/original.jpg",
    aspect: 1920 / 1080,
    source: "kitsu-season",
    initialObjectPosition: "62% 20%",
    expectedYear: 2015,
    format: "TV",
  },
  // Durarara!!×2 Ketsu (AniList ID 20880 / MAL ID 27833 / Kitsu 9725)
  // Arte oficial do Kitsu: 1280x864 (proporção 1.481:1), enquadramento 50% 24%
  "20880": {
    url: "https://media.kitsu.app/anime/cover_images/9725/original.jpg",
    aspect: 1280 / 864,
    source: "kitsu-season",
    initialObjectPosition: "50% 24%",
    expectedYear: 2016,
    format: "TV",
  },
  // The Apothecary Diaries Season 3 (AniList ID 195516 / MAL ID 61987)
  // Referência visual aprovada: MAL 152170l.jpg (600x424, proporção 1.415:1), enquadramento 50% 24%
  "195516": {
    url: "https://cdn.myanimelist.net/images/anime/1501/152170l.jpg",
    aspect: 600 / 424,
    source: "jikan-season",
    initialObjectPosition: "50% 24%",
    expectedYear: 2026,
    format: "TV",
  },
  // The Apothecary Diaries Season 2 (AniList ID 176301 / MAL ID 58514)
  // Arte oficial limpa do MAL: 144365l.jpg (600x424, proporção 1.415:1), enquadramento 50% 24%
  "176301": {
    url: "https://cdn.myanimelist.net/images/anime/1681/144365l.jpg",
    aspect: 600 / 424,
    source: "jikan-season",
    initialObjectPosition: "50% 24%",
    expectedYear: 2025,
    format: "TV",
  },
  // The Disastrous Life of Saiki K. Season 2 (AniList ID 98034 / MAL ID 34612 / Kitsu 13477)
  // Referência visual aprovada: Kitsu 13477 (1920x1080, proporção 1.778:1), enquadramento 52% 20%
  "98034": {
    url: "https://media.kitsu.app/anime/cover_images/13477/original.jpg",
    aspect: 1920 / 1080,
    source: "kitsu-season",
    initialObjectPosition: "52% 20%",
    expectedYear: 2018,
    format: "TV",
  },
  // Great Teacher Onizuka (AniList ID 245 / MAL ID 245 / Kitsu 220)
  // Referência visual aprovada: Kitsu 220 (1600x1200, proporção 1.333:1), enquadramento 50% 24%
  "245": {
    url: "https://media.kitsu.app/anime/cover_images/220/original.jpg",
    aspect: 1600 / 1200,
    source: "kitsu-season",
    initialObjectPosition: "50% 24%",
    expectedYear: 1999,
    format: "TV",
  },
  // Blue Box Season 2 (AniList ID 189123 / MAL ID 61323)
  // Imagem LiveChart na máxima resolução disponível: 708x1000 (proporção 708 / 1000)
  "189123": {
    url: "https://u.livechart.me/anime_visuals/local_version/18706/image/6db75602c765ece7e3d0b85e58d2b787.webp/large.jpg",
    aspect: 708 / 1000,
    source: "livechart-season",
    initialObjectPosition: "50% 24%",
    expectedYear: 2026,
    format: "TV",
  },
  // Bakemonogatari (AniList ID 5081 / MAL ID 5081)
  // Imagem LiveChart na máxima resolução disponível: 354x500 (proporção 354 / 500)
  "5081": {
    url: "https://u.livechart.me/anime/visual/872/image/3585d1feda07bf144a7c440e4c42f387.jpg/large.jpg",
    aspect: 354 / 500,
    source: "livechart-season",
    initialObjectPosition: "50% 24%",
    expectedYear: 2009,
    format: "TV",
  },
  // STEEL BALL RUN JoJo's Bizarre Adventure 2nd - 3rd STAGE (AniList ID 210482 / MAL ID 61469)
  // Imagem LiveChart na máxima resolução disponível: 709x1000 (proporção 709 / 1000)
  "210482": {
    url: "https://u.livechart.me/anime_visuals/local_version/15960/image/69eee67f236746a2b8fad109b6bb5835.webp/large.jpg",
    aspect: 709 / 1000,
    source: "livechart-season",
    initialObjectPosition: "50% 24%",
    expectedYear: 2026,
    format: "ONA",
  },
  // Witch on the Holy Night (Mahoutsukai no Yoru) (AniList ID 143103 / MAL ID 50668)
  // Imagem LiveChart na máxima resolução disponível: 800x1000 (proporção 800 / 1000)
  "143103": {
    url: "https://u.livechart.me/anime_visuals/local_version/18871/image/02caff14b683eab2a511d928841e55db.webp/large.jpg",
    aspect: 800 / 1000,
    source: "livechart-season",
    initialObjectPosition: "50% 24%",
    expectedYear: 2026,
    format: "MOVIE",
  },
};

const memoryCache = new Map<string, CacheEntry>();
const jikanPicturesMemoryCache = new Map<
  number,
  { urls: string[]; expiresAt: number }
>();
let kitsuCooldownUntil = 0;
let kitsuCooldownForFetch: typeof fetch | null = null;
let jikanCooldownUntil = 0;
let jikanCooldownForFetch: typeof fetch | null = null;

export function clearSeasonBannerCache(): void {
  memoryCache.clear();
  jikanPicturesMemoryCache.clear();
}

/**
 * Normaliza URLs de imagem removendo parâmetros auxiliares de cache/CORS
 * para comparações determinísticas de igualdade.
 */
export function normalizeBannerUrl(url?: string | null): string {
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
 * Verifica se o registro local contém um banner personalizado pelo Admin.
 * Prioridade máxima absoluta:
 * - Anime criado localmente (!remote) com banner preenchido; ou
 * - Anime importado em que o Admin definiu uma URL de banner diferente da remota.
 */
export function hasAdminCustomBanner(
  localRecord?: LocalAnime | null,
  remote?: Anime | null,
): boolean {
  const localBanner = localRecord?.banner?.trim() ?? "";
  if (!localBanner) return false;
  if (!remote) return true;
  const remoteBanner = remote.banner?.trim() ?? "";
  if (!remoteBanner) return true;
  return normalizeBannerUrl(localBanner) !== normalizeBannerUrl(remoteBanner);
}

/**
 * Identifica origens que comprovadamente enviam Access-Control-Allow-Origin
 * para leitura segura em <canvas> sem poluir o console com erros de CORS.
 */
export function isCorsCapableBannerOrigin(url?: string | null): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host === "s4.anilist.co" ||
      host.endsWith(".anilist.co") ||
      host === "res.cloudinary.com"
    );
  } catch {
    return false;
  }
}

/**
 * Rejeita explicitamente URLs de trailers, miniaturas do YouTube/plataformas de vídeo,
 * thumbnails de episódios de streaming e capturas de tela de vídeo.
 */
export function isDisallowedMobileBannerUrl(url?: string | null): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed) return false;

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    const pathLower = parsed.pathname.toLowerCase();

    if (
      host === "youtu.be" ||
      host === "ytimg.com" ||
      host.endsWith(".ytimg.com") ||
      host === "youtube.com" ||
      host.endsWith(".youtube.com") ||
      host === "youtube-nocookie.com" ||
      host.endsWith(".youtube-nocookie.com") ||
      host === "vimeo.com" ||
      host.endsWith(".vimeo.com") ||
      host === "vimeocdn.com" ||
      host.endsWith(".vimeocdn.com") ||
      host === "dailymotion.com" ||
      host.endsWith(".dailymotion.com") ||
      host === "dmcdn.net" ||
      host.endsWith(".dmcdn.net") ||
      host === "img1.ak.crunchyroll.com"
    ) {
      return true;
    }

    if (
      pathLower.includes("/episodes/") ||
      pathLower.includes("/episode/") ||
      pathLower.includes("/streaming_episodes/") ||
      pathLower.includes("/episode_thumbnails/") ||
      pathLower.includes("/trailers/") ||
      pathLower.includes("/trailer/") ||
      pathLower.includes("/screenshots/") ||
      pathLower.includes("/screencaps/") ||
      /\/(?:maxresdefault|hqdefault|mqdefault|sddefault)\.(?:jpg|jpeg|webp|png)$/.test(
        pathLower,
      )
    ) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Rejeita URLs temporárias/assinadas (ex.: Backblaze B2 X-Amz-Expires=900)
 * e exige que o caminho no CDN permanente do Kitsu pertença ao ID exato da temporada.
 */
export function isValidPermanentKitsuSeasonUrl(
  url: string | null | undefined,
  expectedKitsuId: string,
  currentCover?: string | null,
): url is string {
  if (!url || !expectedKitsuId) return false;
  if (isDisallowedMobileBannerUrl(url)) return false;

  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== "https:") return false;

    const host = parsed.hostname.toLowerCase();
    if (host !== "media.kitsu.app" && host !== "media.kitsu.io") {
      return false;
    }

    const queryLower = parsed.search.toLowerCase();
    if (
      queryLower.includes("x-amz-expires") ||
      queryLower.includes("x-amz-signature") ||
      queryLower.includes("awsaccesskeyid") ||
      queryLower.includes("expires=") ||
      queryLower.includes("token=")
    ) {
      return false;
    }

    const path = parsed.pathname;
    const matchesExactSeasonPath =
      path.includes(`/anime/${expectedKitsuId}/cover_image/`) ||
      path.includes(`/anime/cover_images/${expectedKitsuId}/`);
    if (!matchesExactSeasonPath) {
      return false;
    }

    if (
      currentCover &&
      normalizeBannerUrl(url) === normalizeBannerUrl(currentCover)
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Valida URLs de imagens promocionais do MyAnimeList (Jikan `/anime/{malId}/pictures`),
 * aceitando apenas o CDN oficial de animes (`/images/anime/`), rejeitando URLs temporárias,
 * miniaturas de vídeo/episódios, ícones/placeholders e imagens idênticas à capa ou ao banner atual.
 */
export function isValidMalSeasonPictureUrl(
  url: string | null | undefined,
  currentCover?: string | null,
  currentBanner?: string | null,
): url is string {
  if (!url) return false;
  if (isDisallowedMobileBannerUrl(url)) return false;

  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== "https:") return false;

    const host = parsed.hostname.toLowerCase();
    if (
      host !== "cdn.myanimelist.net" &&
      host !== "api-cdn.myanimelist.net" &&
      !host.endsWith(".myanimelist.net")
    ) {
      return false;
    }

    const pathLower = parsed.pathname.toLowerCase();
    if (!pathLower.includes("/images/anime/")) {
      return false;
    }

    if (
      pathLower.includes("apple-touch-icon") ||
      pathLower.includes("qm_50") ||
      pathLower.endsWith("/na.gif")
    ) {
      return false;
    }

    const queryLower = parsed.search.toLowerCase();
    if (
      queryLower.includes("x-amz-expires") ||
      queryLower.includes("x-amz-signature") ||
      queryLower.includes("awsaccesskeyid") ||
      queryLower.includes("expires=") ||
      queryLower.includes("token=")
    ) {
      return false;
    }

    const normalizedCandidate = normalizeBannerUrl(url);
    if (
      currentCover &&
      normalizedCandidate === normalizeBannerUrl(currentCover)
    ) {
      return false;
    }

    if (
      currentBanner &&
      normalizedCandidate === normalizeBannerUrl(currentBanner)
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Avalia se uma imagem da galeria do MyAnimeList/Jikan corresponde a uma arte promocional
 * horizontal limpa da temporada:
 * - Exige pelo menos 580x400 pixels e proporção entre 1.30:1 e 2.05:1.
 * - Rejeita pôsteres verticais (< 1.30:1) e faixas panorâmicas (> 2.05:1).
 * - Rejeita capturas 16:9 de vídeo/PV/episódio em resolução SD/qHD (aspect ~1.72..1.82 com largura < 1200px,
 *   como quadros 600x337, 600x338, 854x480 ou 960x540 extraídos de trailers ou cenas com legendas).
 */
export function isCleanMalHorizontalArtworkDims(
  dims?: ImageDimensions | null,
): dims is ImageDimensions {
  if (!dims) return false;
  if (dims.width < MIN_JIKAN_WIDTH || dims.height < MIN_JIKAN_HEIGHT) {
    return false;
  }
  if (
    dims.aspect < MIN_HORIZONTAL_ASPECT ||
    dims.aspect > MAX_MOBILE_ALT_ASPECT
  ) {
    return false;
  }
  if (dims.width < 1200 && dims.aspect >= 1.72 && dims.aspect <= 1.82) {
    return false;
  }
  return true;
}

/**
 * Garante isolamento estrito entre mobile e desktop na seleção final do banner:
 * - No desktop (`isMobileViewport === false`), preserva integralmente `baseSeasonBanner` e `"50% 24%"`.
 * - Quando há banner personalizado pelo Admin (`isAdminBanner === true`), preserva sempre `baseSeasonBanner`.
 * - No mobile, aplica a alternativa validada da temporada somente quando disponível e sem erro de carregamento.
 */
export function selectViewportBanner(
  params: ViewportBannerSelectionParams,
): ViewportBannerSelectionResult {
  const failed = params.failedBannerUrls ?? {};
  const mobileState = params.mobileBannerState;
  const activeMobileAlt =
    !params.isAdminBanner &&
    params.isMobileViewport &&
    Boolean(params.animeId) &&
    mobileState != null &&
    mobileState.forId === params.animeId &&
    mobileState.isAlternative &&
    !failed[mobileState.url]
      ? mobileState
      : null;

  const effectiveBannerUrl =
    activeMobileAlt?.url ??
    (params.baseSeasonBanner && !failed[params.baseSeasonBanner]
      ? params.baseSeasonBanner
      : null);

  const defaultObjectPosition =
    activeMobileAlt?.initialObjectPosition ??
    (!params.isAdminBanner &&
    params.isMobileViewport &&
    mobileState != null &&
    mobileState.forId === params.animeId &&
    effectiveBannerUrl === mobileState.url
      ? mobileState.initialObjectPosition
      : "50% 24%");

  return {
    effectiveBannerUrl,
    defaultObjectPosition,
    isUsingMobileAlternative: activeMobileAlt != null,
  };
}

function normalizeKitsuSubtype(subtype?: string | null): string | null {
  if (!subtype) return null;
  const upper = subtype.trim().toUpperCase();
  if (
    upper === "TV" ||
    upper === "MOVIE" ||
    upper === "OVA" ||
    upper === "ONA" ||
    upper === "SPECIAL" ||
    upper === "MUSIC"
  ) {
    return upper;
  }
  if (upper === "TV_SHORT") return "TV_SHORT";
  return null;
}

function areFormatsCompatible(
  expected?: string | null,
  candidate?: string | null,
): boolean {
  if (!expected || !candidate) return true;
  const normExpected = expected.trim().toUpperCase();
  const normCandidate = candidate.trim().toUpperCase();
  if (normExpected === normCandidate) return true;
  // TV e TV_SHORT são ambos séries televisivas
  if (
    (normExpected === "TV" && normCandidate === "TV_SHORT") ||
    (normExpected === "TV_SHORT" && normCandidate === "TV")
  ) {
    return true;
  }
  return false;
}

/**
 * Valida correspondência estrita do ano de estreia da temporada.
 * Permite diferença de 1 ano apenas na virada Dezembro/Janeiro de temporada de inverno.
 */
export function isSeasonYearConsistent(
  expectedYear: number | null | undefined,
  kitsuStartDate: string | null | undefined,
): boolean {
  if (!expectedYear) return true;
  if (!kitsuStartDate) return false;

  const match = /^(\d{4})-(\d{2})/.exec(kitsuStartDate.trim());
  if (!match) return false;

  const kitsuYear = Number(match[1]);
  const kitsuMonth = Number(match[2]);
  if (!Number.isFinite(kitsuYear)) return false;

  if (kitsuYear === expectedYear) return true;

  // Virada de ano em estreia de temporada de inverno (ex.: prévia em dez/2023 vs jan/2024)
  if (kitsuYear === expectedYear - 1 && kitsuMonth === 12) return true;
  if (kitsuYear === expectedYear + 1 && kitsuMonth === 1) return true;

  return false;
}

/**
 * Valida se os mapeamentos externos do item no Kitsu apontam de forma 1:1 exclusiva
 * para os IDs da temporada atual (rejeitando entradas mescladas de múltiplos cours
 * ou divergências entre AniList e MyAnimeList).
 */
export function verifyBidirectionalSeasonMappings(params: {
  mappings: Array<{ externalSite?: string; externalId?: string }>;
  anilistId?: number;
  malId?: number;
  kitsuId?: number;
  candidateKitsuId?: string;
}): boolean {
  const { mappings, anilistId, malId, kitsuId, candidateKitsuId } = params;

  if (
    kitsuId != null &&
    candidateKitsuId != null &&
    String(kitsuId) !== String(candidateKitsuId).trim()
  ) {
    return false;
  }

  const aniIds = mappings
    .filter((m) => m.externalSite === "anilist/anime" && m.externalId)
    .map((m) => String(m.externalId).trim());

  const malIds = mappings
    .filter((m) => m.externalSite === "myanimelist/anime" && m.externalId)
    .map((m) => String(m.externalId).trim());

  // Se o Kitsu mapear múltiplos IDs de uma mesma plataforma, significa agrupamento
  // de temporadas/cours em uma única entrada, não sendo 1:1.
  if (aniIds.length > 1 || malIds.length > 1) {
    return false;
  }

  // Se o Kitsu tiver mapeamento AniList e o anilistId foi informado, devem ser estritamente iguais
  if (aniIds.length === 1 && anilistId != null) {
    if (aniIds[0] !== String(anilistId)) {
      return false;
    }
  }

  // Se o Kitsu tiver mapeamento MyAnimeList e o malId foi informado, devem ser estritamente iguais
  if (malIds.length === 1 && malId != null) {
    if (malIds[0] !== String(malId)) {
      return false;
    }
  }

  // Pelo menos um identificador da temporada deve ter sido confirmado com sucesso
  const aniMatched =
    anilistId != null && aniIds.length === 1 && aniIds[0] === String(anilistId);
  const malMatched =
    malId != null && malIds.length === 1 && malIds[0] === String(malId);
  const kitsuOnlyMatched =
    anilistId == null &&
    malId == null &&
    kitsuId != null &&
    candidateKitsuId != null &&
    String(kitsuId) === String(candidateKitsuId).trim();

  return aniMatched || malMatched || kitsuOnlyMatched;
}

/**
 * Ponto de partida de object-position adaptável conforme a geometria e composição da arte:
 * - Artes horizontais padrão [1.48..2.05] (ex.: 16:9, 16:10, 3:2): 52% 20% para equilibrar
 *   a composição ao lado da capa vertical sobreposta à esquerda sem cortar personagens nas bordas.
 * - Banners horizontais compactos (< 1.48, ex.: 4:3, 1.405, 1.415) e panorâmicos (> 2.05):
 *   ponto 50% 24% preservando cabeças, rostos e olhos dos personagens sem corte superior nem zoom excessivo.
 */
export function initialObjectPositionForAspect(aspect?: number): string {
  if (!aspect || !Number.isFinite(aspect)) {
    return "50% 24%";
  }
  if (aspect >= 1.48 && aspect <= MAX_STANDARD_HORIZONTAL_ASPECT) {
    return "52% 20%";
  }
  return "50% 24%";
}

function buildCacheKey(input: SeasonBannerInput): string {
  const expectedYear = input.startYear ?? input.year ?? "na";
  const normalizedBanner = normalizeBannerUrl(input.currentBanner) || "none";
  return `${CACHE_PREFIX}${input.animeId}:${input.anilistId ?? "na"}:${
    input.malId ?? "na"
  }:${input.kitsuId ?? "na"}:${expectedYear}:${input.format ?? "na"}:${normalizedBanner}`;
}

function readCache(key: string): CacheEntry | undefined {
  const now = Date.now();
  const mem = memoryCache.get(key);
  if (mem) {
    if (mem.expiresAt > now && !isDisallowedMobileBannerUrl(mem.url)) {
      return mem;
    }
    memoryCache.delete(key);
  }

  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as CacheEntry;
    if (
      parsed &&
      typeof parsed.expiresAt === "number" &&
      parsed.expiresAt > now &&
      !isDisallowedMobileBannerUrl(parsed.url)
    ) {
      memoryCache.set(key, parsed);
      return parsed;
    }
    window.sessionStorage.removeItem(key);
  } catch {
    // sessionStorage indisponível ou bloqueado
  }
  return undefined;
}

function writeCache(
  key: string,
  url: string | null,
  aspect?: number,
  source?: AlternativeBannerSource,
): void {
  const entry: CacheEntry = {
    url,
    source: url ? source : undefined,
    aspect,
    expiresAt: Date.now() + (url ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS),
  };
  memoryCache.set(key, entry);

  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // Ignora falhas de quota
  }
}

async function fetchJsonWithTimeout<T>(
  url: string,
  parentSignal?: AbortSignal,
): Promise<T | null> {
  if (
    kitsuCooldownForFetch === globalThis.fetch &&
    Date.now() < kitsuCooldownUntil
  ) {
    return null;
  }

  const controller = new AbortController();
  const onParentAbort = () => controller.abort();
  parentSignal?.addEventListener("abort", onParentAbort, { once: true });

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/vnd.api+json, application/json",
      },
      signal: controller.signal,
    });

    if (response.status === 429 || response.status >= 500) {
      kitsuCooldownUntil = Date.now() + PROVIDER_COOLDOWN_MS;
      kitsuCooldownForFetch = globalThis.fetch;
      return null;
    }

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
    parentSignal?.removeEventListener("abort", onParentAbort);
  }
}

interface JikanPictureResource {
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
}

async function defaultFetchJikanPictures(
  malId: number,
  parentSignal?: AbortSignal,
): Promise<string[]> {
  if (!malId || !Number.isFinite(malId) || malId <= 0) {
    return [];
  }

  const now = Date.now();
  const cached = jikanPicturesMemoryCache.get(malId);
  if (cached) {
    if (cached.expiresAt > now) {
      return cached.urls;
    }
    jikanPicturesMemoryCache.delete(malId);
  }

  if (
    jikanCooldownForFetch === globalThis.fetch &&
    now < jikanCooldownUntil
  ) {
    return [];
  }

  const controller = new AbortController();
  const onParentAbort = () => controller.abort();
  parentSignal?.addEventListener("abort", onParentAbort, { once: true });

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, JIKAN_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(
      `https://api.jikan.moe/v4/anime/${encodeURIComponent(String(malId))}/pictures`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        signal: controller.signal,
      },
    );

    if (response.status === 429 || response.status >= 500) {
      jikanCooldownUntil = Date.now() + PROVIDER_COOLDOWN_MS;
      jikanCooldownForFetch = globalThis.fetch;
      return [];
    }

    if (!response.ok) {
      return [];
    }

    const json = (await response.json()) as { data?: JikanPictureResource[] };
    const urls: string[] = [];
    const seen = new Set<string>();

    for (const item of json.data ?? []) {
      const best =
        item.jpg?.large_image_url ||
        item.webp?.large_image_url ||
        item.jpg?.image_url ||
        item.webp?.image_url;

      if (best && typeof best === "string" && best.trim().length > 0) {
        const clean = best.trim();
        const normKey = clean
          .replace(/^https?:\/\//i, "")
          .split("?")[0]
          .toLowerCase();
        if (!seen.has(normKey)) {
          seen.add(normKey);
          urls.push(clean);
        }
      }
    }

    jikanPicturesMemoryCache.set(malId, {
      urls,
      expiresAt: Date.now() + POSITIVE_TTL_MS,
    });
    return urls;
  } catch {
    if (!parentSignal?.aborted) {
      jikanCooldownUntil = Date.now() + PROVIDER_COOLDOWN_MS;
      jikanCooldownForFetch = globalThis.fetch;
    }
    return [];
  } finally {
    clearTimeout(timeoutId);
    parentSignal?.removeEventListener("abort", onParentAbort);
  }
}

/**
 * Analisa cabeçalhos binários de imagem (JPEG, PNG, WebP) em memória.
 * Permite validação de dimensões em testes unitários e ambientes Node.js
 * com precisão e sem depender do objeto DOM Image.
 */
export function parseImageDimensionsFromBuffer(
  buf: Uint8Array,
): ImageDimensions | null {
  if (!buf || buf.length < 8) return null;

  // PNG: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4E &&
    buf[3] === 0x47
  ) {
    if (buf.length >= 24) {
      const width =
        ((buf[16] << 24) | (buf[17] << 16) | (buf[18] << 8) | buf[19]) >>> 0;
      const height =
        ((buf[20] << 24) | (buf[21] << 16) | (buf[22] << 8) | buf[23]) >>> 0;
      if (width > 0 && height > 0) {
        return { width, height, aspect: width / height };
      }
    }
  }

  // JPEG: [0xFF, 0xD8]
  if (buf[0] === 0xFF && buf[1] === 0xD8) {
    let offset = 2;
    while (offset < buf.length - 8) {
      while (offset < buf.length && buf[offset] !== 0xFF) offset++;
      while (offset < buf.length && buf[offset] === 0xFF) offset++;
      if (offset >= buf.length) break;
      const marker = buf[offset++];
      if (marker === 0xD9 || marker === 0xDA) break;
      if (offset + 1 >= buf.length) break;
      const len = (buf[offset] << 8) | buf[offset + 1];
      if (len < 2) break;
      if (marker === 0xC0 || marker === 0xC1 || marker === 0xC2) {
        if (offset + 6 < buf.length) {
          const height = (buf[offset + 3] << 8) | buf[offset + 4];
          const width = (buf[offset + 5] << 8) | buf[offset + 6];
          if (width > 0 && height > 0) {
            return { width, height, aspect: width / height };
          }
        }
      }
      offset += len;
    }
  }

  // WebP: RIFF ... WEBP
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    const chunkType = String.fromCharCode(buf[12], buf[13], buf[14], buf[15]);
    if (chunkType === "VP8 " && buf.length >= 30) {
      const width = ((buf[27] << 8) | buf[26]) & 0x3fff;
      const height = ((buf[29] << 8) | buf[28]) & 0x3fff;
      if (width > 0 && height > 0) {
        return { width, height, aspect: width / height };
      }
    } else if (chunkType === "VP8L" && buf.length >= 25) {
      const b1 = buf[21];
      const b2 = buf[22];
      const b3 = buf[23];
      const b4 = buf[24];
      const width = 1 + (((b2 & 0x3f) << 8) | b1);
      const height = 1 + (((b4 & 0xf) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6));
      if (width > 0 && height > 0) {
        return { width, height, aspect: width / height };
      }
    } else if (chunkType === "VP8X" && buf.length >= 30) {
      const width = 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16));
      const height = 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16));
      if (width > 0 && height > 0) {
        return { width, height, aspect: width / height };
      }
    }
  }

  return null;
}

/**
 * Pré-carrega a imagem em memória sem crossOrigin para medir dimensões reais
 * e garantir que a URL esteja íntegra antes de exibi-la no DOM.
 * Em ambiente de testes/Node.js onde Image não está disponível, utiliza fetch
 * com parsing seguro de cabeçalhos binários.
 */
export function probeImageDimensions(
  url: string,
  parentSignal?: AbortSignal,
): Promise<ImageDimensions | null> {
  if (!url) {
    return Promise.resolve(null);
  }

  if (typeof Image !== "undefined") {
    return new Promise((resolve) => {
      if (parentSignal?.aborted) {
        resolve(null);
        return;
      }

      const img = new Image();
      let settled = false;

      const finish = (result: ImageDimensions | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        parentSignal?.removeEventListener("abort", onAbort);
        img.onload = null;
        img.onerror = null;
        resolve(result);
      };

      const onAbort = () => {
        img.src = "";
        finish(null);
      };

      const timer = setTimeout(() => {
        img.src = "";
        finish(null);
      }, IMAGE_PROBE_TIMEOUT_MS);

      parentSignal?.addEventListener("abort", onAbort, { once: true });

      img.onload = () => {
        const width = img.naturalWidth;
        const height = img.naturalHeight;
        if (!width || !height) {
          finish(null);
          return;
        }
        finish({
          width,
          height,
          aspect: width / height,
        });
      };

      img.onerror = () => {
        finish(null);
      };

      img.src = url;
    });
  }

  return (async () => {
    try {
      const controller = new AbortController();
      const onParentAbort = () => controller.abort();
      parentSignal?.addEventListener("abort", onParentAbort, { once: true });

      const timeoutId = setTimeout(() => controller.abort(), IMAGE_PROBE_TIMEOUT_MS);
      try {
        const res = await fetch(url, {
          method: "GET",
          headers: { Accept: "image/*" },
          signal: controller.signal,
        });
        if (!res.ok) return null;
        const ab = await res.arrayBuffer();
        return parseImageDimensionsFromBuffer(new Uint8Array(ab));
      } finally {
        clearTimeout(timeoutId);
        parentSignal?.removeEventListener("abort", onParentAbort);
      }
    } catch {
      return null;
    }
  })();
}

interface KitsuAnimeResource {
  id?: string;
  type?: string;
  attributes?: {
    startDate?: string | null;
    subtype?: string | null;
    coverImage?: {
      original?: string | null;
      large?: string | null;
    } | null;
  };
}

interface KitsuMappingsLookupResponse {
  data?: Array<{
    id?: string;
    relationships?: {
      item?: {
        data?: { id?: string; type?: string } | null;
      };
    };
  }>;
  included?: KitsuAnimeResource[];
}

interface KitsuSingleAnimeResponse {
  data?: KitsuAnimeResource;
}

interface KitsuItemMappingsResponse {
  data?: Array<{
    attributes?: {
      externalSite?: string;
      externalId?: string;
    };
  }>;
}

/**
 * Resolve de forma isolada a arte promocional oficial, limpa e horizontal para o banner mobile
 * da temporada exata, sem utilizar trailers, miniaturas do YouTube ou cenas de episódios:
 * 1) Banner personalizado pelo administrador (prioridade absoluta).
 * 2) Alternativas registradas por ID da temporada (SPECIFIC_SEASON_MOBILE_ALTERNATIVES).
 * 3) Kitsu: tentar primeiro obter arte horizontal oficial limpa da temporada exata
 *    (1.30:1 a 3.35:1, mínimo 800x400, mapeamento 1:1, ano e formato validados).
 * 4) MyAnimeList/Jikan (`fetchJikanPictures(malId)`): arte promocional horizontal limpa da temporada
 *    (1.30:1 a 2.05:1, mínimo 580x400, rejeitando pôsteres verticais e capturas 16:9 de vídeo/PV).
 * 5) Fallback seguro: se nenhuma alternativa limpa e comprovadamente adequada for encontrada,
 *    mantém o banner original do AniList da temporada.
 */
export async function resolveSeasonMobileBanner(
  input: SeasonBannerInput,
  signal?: AbortSignal,
): Promise<ResolvedSeasonBanner> {
  const fallbackUrl = input.currentBanner?.trim() || null;

  // 1. Banner personalizado pelo administrador: prioridade absoluta
  if (input.isAdminCustomBanner) {
    return {
      url: fallbackUrl,
      isAlternative: false,
      source: fallbackUrl ? "admin" : "none",
      initialObjectPosition: "50% 24%",
    };
  }

  // Alternativas mobile específicas registradas por ID da temporada:
  // Garantem resolução determinística sem latência de rede, sem risco de timeout de APIs externas
  // e imunes a bloqueios por rate limiting ou cache negativo.
  const specificAlt =
    (input.animeId && SPECIFIC_SEASON_MOBILE_ALTERNATIVES[input.animeId]) ||
    (input.anilistId != null &&
      SPECIFIC_SEASON_MOBILE_ALTERNATIVES[String(input.anilistId)]) ||
    (input.malId != null &&
      SPECIFIC_SEASON_MOBILE_ALTERNATIVES[`mal:${input.malId}`]);

  const expectedYear = input.startYear ?? input.year ?? null;
  const isSpecificAltValidForInput =
    specificAlt &&
    (!specificAlt.expectedYear ||
      isSeasonYearConsistent(expectedYear, `${specificAlt.expectedYear}-01-01`)) &&
    (!specificAlt.format ||
      areFormatsCompatible(input.format, specificAlt.format)) &&
    (!input.currentCover ||
      normalizeBannerUrl(specificAlt.url) !==
        normalizeBannerUrl(input.currentCover));

  if (isSpecificAltValidForInput && specificAlt) {
    const cacheKey = buildCacheKey(input);
    writeCache(
      cacheKey,
      specificAlt.url,
      specificAlt.aspect,
      specificAlt.source,
    );
    return {
      url: specificAlt.url,
      isAlternative: true,
      source: specificAlt.source,
      initialObjectPosition:
        specificAlt.initialObjectPosition ??
        initialObjectPositionForAspect(specificAlt.aspect),
      aspect: specificAlt.aspect,
    };
  }

  if (
    input.anilistId == null &&
    input.malId == null &&
    input.kitsuId == null
  ) {
    return {
      url: fallbackUrl,
      isAlternative: false,
      source: fallbackUrl ? "season-default" : "none",
      initialObjectPosition: "50% 24%",
    };
  }

  const cacheKey = buildCacheKey(input);
  const cached = readCache(cacheKey);
  if (cached) {
    if (cached.url) {
      return {
        url: cached.url,
        isAlternative: true,
        source: cached.source ?? "kitsu-season",
        initialObjectPosition: initialObjectPositionForAspect(cached.aspect),
        aspect: cached.aspect,
      };
    }
    return {
      url: fallbackUrl,
      isAlternative: false,
      source: fallbackUrl ? "season-default" : "none",
      initialObjectPosition: initialObjectPositionForAspect(cached.aspect),
      aspect: cached.aspect,
    };
  }

  // 2. Kitsu: tentar primeiro obter a arte horizontal oficial limpa da temporada exata
  const { candidates: kitsuCandidates, hadLookupConflict } = await (async (): Promise<{
    candidates: KitsuAnimeResource[];
    hadLookupConflict: boolean;
  }> => {
    const candidates: KitsuAnimeResource[] = [];
    const seenIds = new Set<string>();
    let aniResolvedId: string | null = null;
    let malResolvedId: string | null = null;

    const addCandidate = (item?: KitsuAnimeResource | null) => {
      if (item?.type === "anime" && item.id && !seenIds.has(item.id)) {
        seenIds.add(item.id);
        candidates.push(item);
      }
    };

    if (input.anilistId != null) {
      const lookupUrl = `https://kitsu.io/api/edge/mappings?filter[externalSite]=anilist/anime&filter[externalId]=${encodeURIComponent(
        String(input.anilistId),
      )}&include=item`;
      const res = await fetchJsonWithTimeout<KitsuMappingsLookupResponse>(
        lookupUrl,
        signal,
      );
      const animeCandidates = (res?.included ?? []).filter(
        (item) => item.type === "anime" && item.id,
      );
      if (animeCandidates.length > 1) {
        return { candidates: [], hadLookupConflict: true };
      }
      if (animeCandidates.length === 1) {
        aniResolvedId = String(animeCandidates[0].id);
        addCandidate(animeCandidates[0]);
      }
    }

    if (input.malId != null) {
      const lookupUrl = `https://kitsu.io/api/edge/mappings?filter[externalSite]=myanimelist/anime&filter[externalId]=${encodeURIComponent(
        String(input.malId),
      )}&include=item`;
      const res = await fetchJsonWithTimeout<KitsuMappingsLookupResponse>(
        lookupUrl,
        signal,
      );
      const animeCandidates = (res?.included ?? []).filter(
        (item) => item.type === "anime" && item.id,
      );
      if (animeCandidates.length > 1) {
        return { candidates: [], hadLookupConflict: true };
      }
      if (animeCandidates.length === 1) {
        malResolvedId = String(animeCandidates[0].id);
        if (aniResolvedId && aniResolvedId !== malResolvedId) {
          return { candidates: [], hadLookupConflict: true };
        }
        addCandidate(animeCandidates[0]);
      }
    }

    if (input.kitsuId != null) {
      const kitsuIdKey = String(input.kitsuId);
      if (
        (aniResolvedId && aniResolvedId !== kitsuIdKey) ||
        (malResolvedId && malResolvedId !== kitsuIdKey)
      ) {
        return { candidates: [], hadLookupConflict: true };
      }
      if (!seenIds.has(kitsuIdKey)) {
        const lookupUrl = `https://kitsu.io/api/edge/anime/${encodeURIComponent(
          kitsuIdKey,
        )}`;
        const res = await fetchJsonWithTimeout<KitsuSingleAnimeResponse>(
          lookupUrl,
          signal,
        );
        if (res?.data?.type === "anime" && res.data.id) {
          addCandidate(res.data);
        }
      }
    }

    return { candidates, hadLookupConflict: false };
  })();

  if (signal?.aborted) {
    return {
      url: fallbackUrl,
      isAlternative: false,
      source: fallbackUrl ? "season-default" : "none",
      initialObjectPosition: "50% 24%",
    };
  }

  let verifiedAtLeastOneKitsuSeason = false;
  let detectedExplicitSeasonConflict = hadLookupConflict;

  for (const kitsuItem of kitsuCandidates) {
    if (signal?.aborted) break;

    const kitsuIdStr = String(kitsuItem.id);
    const candidateFormat = normalizeKitsuSubtype(kitsuItem.attributes?.subtype);
    const kitsuStartDate = kitsuItem.attributes?.startDate;

    const formatCompatible = areFormatsCompatible(input.format, candidateFormat);
    const yearConsistent = isSeasonYearConsistent(expectedYear, kitsuStartDate);

    if (
      (candidateFormat && !formatCompatible) ||
      (kitsuStartDate && !yearConsistent)
    ) {
      detectedExplicitSeasonConflict = true;
    }

    if (!formatCompatible || !yearConsistent) {
      continue;
    }

    // Em temporadas futuras ainda sem ano definido, nunca aceita itens já lançados em anos anteriores
    if (
      input.status === "NOT_YET_RELEASED" &&
      !expectedYear &&
      kitsuStartDate
    ) {
      const startMatch = /^(\d{4})/.exec(kitsuStartDate.trim());
      if (startMatch && Number(startMatch[1]) < new Date().getFullYear()) {
        detectedExplicitSeasonConflict = true;
        continue;
      }
    }

    const candidateUrl =
      kitsuItem.attributes?.coverImage?.original ||
      kitsuItem.attributes?.coverImage?.large ||
      null;
    const hasValidKitsuCoverUrl =
      isValidPermanentKitsuSeasonUrl(
        candidateUrl,
        kitsuIdStr,
        input.currentCover,
      ) &&
      !(
        fallbackUrl != null &&
        normalizeBannerUrl(candidateUrl) === normalizeBannerUrl(fallbackUrl)
      );

    const shouldVerifyMappings =
      hasValidKitsuCoverUrl ||
      (input.anilistId != null && input.malId != null);

    if (!shouldVerifyMappings) {
      continue;
    }

    const [itemMappingsRes, candidateDims] = await Promise.all([
      fetchJsonWithTimeout<KitsuItemMappingsResponse>(
        `https://kitsu.io/api/edge/anime/${encodeURIComponent(kitsuIdStr)}/mappings`,
        signal,
      ),
      hasValidKitsuCoverUrl && candidateUrl
        ? probeImageDimensions(candidateUrl, signal)
        : Promise.resolve(null),
    ]);

    if (signal?.aborted) break;

    if (!itemMappingsRes) {
      continue;
    }

    const rawMappings = (itemMappingsRes.data ?? []).map((m) => ({
      externalSite: m.attributes?.externalSite,
      externalId: m.attributes?.externalId,
    }));

    if (
      rawMappings.length === 0 ||
      !verifyBidirectionalSeasonMappings({
        mappings: rawMappings,
        anilistId: input.anilistId,
        malId: input.malId,
        kitsuId: input.kitsuId,
        candidateKitsuId: kitsuIdStr,
      })
    ) {
      if (rawMappings.length > 0) {
        detectedExplicitSeasonConflict = true;
      }
      continue;
    }

    verifiedAtLeastOneKitsuSeason = true;

    const passesQualityAndAspect =
      hasValidKitsuCoverUrl &&
      candidateUrl != null &&
      candidateDims != null &&
      candidateDims.width >= MIN_ALT_WIDTH &&
      candidateDims.height >= MIN_ALT_HEIGHT &&
      candidateDims.aspect >= MIN_HORIZONTAL_ASPECT &&
      candidateDims.aspect <= MAX_KITSU_ALT_ASPECT;

    if (!passesQualityAndAspect || !candidateDims || !candidateUrl) {
      continue;
    }

    writeCache(cacheKey, candidateUrl, candidateDims.aspect, "kitsu-season");
    return {
      url: candidateUrl,
      isAlternative: true,
      source: "kitsu-season",
      initialObjectPosition: initialObjectPositionForAspect(candidateDims.aspect),
      aspect: candidateDims.aspect,
    };
  }

  if (signal?.aborted) {
    return {
      url: fallbackUrl,
      isAlternative: false,
      source: fallbackUrl ? "season-default" : "none",
      initialObjectPosition: "50% 24%",
    };
  }

  const hasSeasonIdentityConflict =
    detectedExplicitSeasonConflict && !verifiedAtLeastOneKitsuSeason;

  // 4. MyAnimeList / Jikan: consultar fetchJikanPictures(malId) e aceitar somente artes promocionais
  //    horizontais limpas (>= 580x400 e 1.30:1..2.05:1, rejeitando capturas 16:9 de vídeo/episódio)
  if (
    !hasSeasonIdentityConflict &&
    input.malId != null &&
    Number.isFinite(input.malId) &&
    input.malId > 0
  ) {
    let malPictures: string[] = [];
    try {
      malPictures = input.fetchJikanPictures
        ? await input.fetchJikanPictures(input.malId)
        : await defaultFetchJikanPictures(input.malId, signal);
    } catch {
      malPictures = [];
    }

    if (signal?.aborted) {
      return {
        url: fallbackUrl,
        isAlternative: false,
        source: fallbackUrl ? "season-default" : "none",
        initialObjectPosition: "50% 24%",
      };
    }

    const candidateMalUrls = (Array.isArray(malPictures) ? malPictures : []).filter(
      (picUrl) =>
        isValidMalSeasonPictureUrl(picUrl, input.currentCover, fallbackUrl),
    );

    const BATCH_SIZE = 4;
    for (let i = 0; i < candidateMalUrls.length; i += BATCH_SIZE) {
      if (signal?.aborted) break;
      const batch = candidateMalUrls.slice(i, i + BATCH_SIZE);
      const batchDims = await Promise.all(
        batch.map((picUrl) => probeImageDimensions(picUrl, signal)),
      );

      if (signal?.aborted) break;

      for (let j = 0; j < batch.length; j++) {
        const picUrl = batch[j];
        const dims = batchDims[j];
        if (isCleanMalHorizontalArtworkDims(dims)) {
          writeCache(cacheKey, picUrl, dims.aspect, "jikan-season");
          return {
            url: picUrl,
            isAlternative: true,
            source: "jikan-season",
            initialObjectPosition: initialObjectPositionForAspect(dims.aspect),
            aspect: dims.aspect,
          };
        }
      }
    }
  }

  if (signal?.aborted) {
    return {
      url: fallbackUrl,
      isAlternative: false,
      source: fallbackUrl ? "season-default" : "none",
      initialObjectPosition: "50% 24%",
    };
  }

  // 4. Fallback seguro: manter o banner original do AniList da temporada quando não houver alternativa limpa
  const isCurrentBannerClean =
    Boolean(fallbackUrl) && !isDisallowedMobileBannerUrl(fallbackUrl);

  const isFallbackDistinctFromCover = !(
    fallbackUrl &&
    input.currentCover &&
    normalizeBannerUrl(fallbackUrl) === normalizeBannerUrl(input.currentCover)
  );

  const currentDims =
    fallbackUrl && isCurrentBannerClean && isFallbackDistinctFromCover
      ? await probeImageDimensions(fallbackUrl, signal)
      : null;

  writeCache(cacheKey, null, currentDims?.aspect);
  return {
    url: fallbackUrl,
    isAlternative: false,
    source: fallbackUrl ? "season-default" : "none",
    initialObjectPosition: initialObjectPositionForAspect(currentDims?.aspect),
    aspect: currentDims?.aspect,
  };
}

/**
 * Calcula o object-position horizontal a partir da distribuição de energia visual
 * por colunas em banners panorâmicos, posicionando o foco principal fora da área
 * ocupada pela capa vertical à esquerda no mobile.
 */
export function computePanoramicFocalPercentFromColumns(
  columnEnergies: number[],
  aspect: number,
): number {
  const n = columnEnergies.length;
  if (n < 8 || !Number.isFinite(aspect) || aspect < 2.0) {
    return 50;
  }

  const mobileBoxAspect = 1.05;
  const scaledRatio = aspect / mobileBoxAspect;
  if (scaledRatio <= 1.15) {
    return 50;
  }

  const winCols = Math.max(
    8,
    Math.min(n - 2, Math.round(n * (mobileBoxAspect / aspect))),
  );

  let totalWindowSum = 0;
  let windowCount = 0;
  let bestStart = 0;
  let bestSum = -1;

  let running = 0;
  for (let i = 0; i < n; i++) {
    running += columnEnergies[i];
    if (i >= winCols) {
      running -= columnEnergies[i - winCols];
    }
    if (i >= winCols - 1) {
      const start = i - winCols + 1;
      totalWindowSum += running;
      windowCount++;
      if (running > bestSum) {
        bestSum = running;
        bestStart = start;
      }
    }
  }

  if (windowCount === 0 || totalWindowSum <= 0) {
    return 50;
  }

  const meanWindow = totalWindowSum / windowCount;
  // Se a energia for amplamente distribuída (elenco ou padronagem), mantém centralizado
  if (bestSum < meanWindow * 1.24) {
    return 50;
  }

  let weightedIdx = 0;
  let weightTotal = 0;
  for (let i = bestStart; i < bestStart + winCols; i++) {
    const w = columnEnergies[i];
    weightedIdx += (i + 0.5) * w;
    weightTotal += w;
  }

  const uPeak =
    weightTotal > 0
      ? weightedIdx / weightTotal / n
      : (bestStart + winCols / 2) / n;

  // Posiciona o sujeito levemente à direita do centro no mobile quando ele
  // está na metade esquerda da arte original, evitando que fique atrás da capa
  const targetScreenFrac = uPeak < 0.46 ? 0.58 : 0.5;
  const rawPercent =
    ((uPeak * scaledRatio - targetScreenFrac) / (scaledRatio - 1)) * 100;

  return Math.round(Math.max(22, Math.min(78, rawPercent)));
}

/**
 * Inspeciona de forma segura e isolada o banner em origens com suporte a CORS:
 * - Corrige a ordem de onload/onerror antes de atribuir image.src uma única vez.
 * - Nunca dispara requisições crossOrigin="anonymous" contra CDNs sem CORS.
 * - Captura qualquer falha de canvas sem interromper a renderização.
 */
export function analyzeBannerFramingAndTheme(params: {
  bannerUrl: string;
  hasExplicitColor: boolean;
  defaultThemeColor: string;
  onResult: (result: { objectPosition?: string; themeColor?: string }) => void;
}): () => void {
  const { bannerUrl, hasExplicitColor, defaultThemeColor, onResult } = params;

  if (typeof window === "undefined" || !bannerUrl) {
    return () => {};
  }

  if (!isCorsCapableBannerOrigin(bannerUrl)) {
    return () => {};
  }

  let cancelled = false;
  const image = new Image();

  const timer = window.setTimeout(() => {
    if (cancelled) return;

    image.crossOrigin = "anonymous";
    const corsUrl =
      bannerUrl + (bannerUrl.includes("?") ? "&" : "?") + "cors=1";

    image.onload = () => {
      if (cancelled) return;
      try {
        const width = image.naturalWidth;
        const height = image.naturalHeight;
        if (!width || !height) return;

        const aspect = width / height;
        let objectPosition: string | undefined;
        let themeColor: string | undefined;

        if (aspect >= 2.2) {
          const scanCanvas = document.createElement("canvas");
          const scanCtx = scanCanvas.getContext("2d", {
            willReadFrequently: true,
          });
          if (scanCtx) {
            const scanW = 96;
            const scanH = 24;
            scanCanvas.width = scanW;
            scanCanvas.height = scanH;

            scanCtx.drawImage(
              image,
              0,
              height * 0.06,
              width,
              height * 0.64,
              0,
              0,
              scanW,
              scanH,
            );
            const scanPixels = scanCtx.getImageData(0, 0, scanW, scanH).data;
            const colEnergies = new Array<number>(scanW).fill(0);

            for (let y = 0; y < scanH; y++) {
              for (let x = 1; x < scanW; x++) {
                const idx1 = (y * scanW + x) * 4;
                const idx0 = (y * scanW + (x - 1)) * 4;
                let diff =
                  Math.abs(scanPixels[idx1] - scanPixels[idx0]) +
                  Math.abs(scanPixels[idx1 + 1] - scanPixels[idx0 + 1]) +
                  Math.abs(scanPixels[idx1 + 2] - scanPixels[idx0 + 2]);

                if (y > 0) {
                  const idxUp = ((y - 1) * scanW + x) * 4;
                  diff +=
                    (Math.abs(scanPixels[idx1] - scanPixels[idxUp]) +
                      Math.abs(scanPixels[idx1 + 1] - scanPixels[idxUp + 1]) +
                      Math.abs(scanPixels[idx1 + 2] - scanPixels[idxUp + 2])) *
                    0.5;
                }

                colEnergies[x] += diff;
              }
            }

            const focalXPercent = computePanoramicFocalPercentFromColumns(
              colEnergies,
              aspect,
            );
            objectPosition = `${focalXPercent}% 24%`;
          }
        }

        if (!hasExplicitColor) {
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d", {
            willReadFrequently: true,
          });
          if (context) {
            canvas.width = 40;
            canvas.height = 20;
            context.drawImage(
              image,
              width * 0.25,
              height * 0.1,
              width * 0.5,
              height * 0.35,
              0,
              0,
              canvas.width,
              canvas.height,
            );
            const pixels = context.getImageData(
              0,
              0,
              canvas.width,
              canvas.height,
            ).data;
            let red = 0;
            let green = 0;
            let blue = 0;
            let count = 0;

            for (let i = 0; i < pixels.length; i += 4) {
              if (pixels[i + 3] < 180) continue;
              red += pixels[i];
              green += pixels[i + 1];
              blue += pixels[i + 2];
              count++;
            }

            if (count > 0) {
              const factor = 0.72;
              const finalRed = Math.round((red / count) * factor);
              const finalGreen = Math.round((green / count) * factor);
              const finalBlue = Math.round((blue / count) * factor);
              themeColor = `rgb(${finalRed}, ${finalGreen}, ${finalBlue})`;
            }
          }
        }

        if (!cancelled) {
          onResult({ objectPosition, themeColor });
        }
      } catch {
        if (!cancelled && !hasExplicitColor) {
          onResult({ themeColor: defaultThemeColor });
        }
      }
    };

    image.onerror = () => {
      if (!cancelled && !hasExplicitColor) {
        onResult({ themeColor: defaultThemeColor });
      }
    };

    // Atribuição única após registrar onload/onerror
    image.src = corsUrl;
  }, 120);

  return () => {
    cancelled = true;
    window.clearTimeout(timer);
    image.onload = null;
    image.onerror = null;
    image.src = "";
  };
}
