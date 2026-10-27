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
}

export interface ResolvedSeasonBanner {
  url: string | null;
  isAlternative: boolean;
  source: "admin" | "kitsu-season" | "season-default" | "none";
  initialObjectPosition: string;
  aspect?: number;
}

interface CacheEntry {
  url: string | null;
  aspect?: number;
  expiresAt: number;
}

const CACHE_PREFIX = "hikari:season-banner:v4:";
const POSITIVE_TTL_MS = 24 * 60 * 60 * 1000;
const NEGATIVE_TTL_MS = 6 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 2500;
const IMAGE_PROBE_TIMEOUT_MS = 3500;
const PROVIDER_COOLDOWN_MS = 60 * 1000;

const MIN_ALT_WIDTH = 800;
const MIN_ALT_HEIGHT = 400;
const MIN_HORIZONTAL_ASPECT = 1.20;
const MAX_STANDARD_HORIZONTAL_ASPECT = 2.05;
const MAX_MOBILE_ALT_ASPECT = 3.25;

const memoryCache = new Map<string, CacheEntry>();
let kitsuCooldownUntil = 0;

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
 * Rejeita URLs temporárias/assinadas (ex.: Backblaze B2 X-Amz-Expires=900)
 * e exige que o caminho no CDN permanente do Kitsu pertença ao ID exato da temporada.
 */
export function isValidPermanentKitsuSeasonUrl(
  url: string | null | undefined,
  expectedKitsuId: string,
  currentCover?: string | null,
): url is string {
  if (!url || !expectedKitsuId) return false;
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
}): boolean {
  const { mappings, anilistId, malId } = params;

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

  // Pelo menos um identificador externo deve ter sido confirmado com sucesso
  const aniMatched =
    anilistId != null && aniIds.length === 1 && aniIds[0] === String(anilistId);
  const malMatched =
    malId != null && malIds.length === 1 && malIds[0] === String(malId);

  return aniMatched || malMatched;
}

/**
 * Ponto de partida de object-position adaptável conforme a geometria e composição da arte:
 * - Artes horizontais padrão [1.48..2.05] (ex.: 16:9, 16:10, 3:2): 52% 20% para equilibrar
 *   a composição ao lado da capa vertical sobreposta à esquerda sem cortar personagens nas bordas.
 * - Banners panorâmicos (> 2.05): ponto inicial 50% 24%, refinado pela leitura de
 *   densidade visual quando a origem suporta CORS.
 * - Imagens com proporção inferior a 1.48 (< 1.48): ponto equilibrado 50% 40% para
 *   evitar zoom excessivo no topo/cabelo ou corte do corpo dos personagens.
 */
export function initialObjectPositionForAspect(aspect?: number): string {
  if (!aspect || !Number.isFinite(aspect)) {
    return "50% 24%";
  }
  if (aspect >= 1.48 && aspect <= MAX_STANDARD_HORIZONTAL_ASPECT) {
    return "52% 20%";
  }
  if (aspect < 1.48) {
    return "50% 40%";
  }
  return "50% 24%";
}

function buildCacheKey(input: SeasonBannerInput): string {
  const expectedYear = input.startYear ?? input.year ?? "na";
  return `${CACHE_PREFIX}${input.animeId}:${input.anilistId ?? "na"}:${
    input.malId ?? "na"
  }:${input.kitsuId ?? "na"}:${expectedYear}:${input.format ?? "na"}`;
}

function readCache(key: string): CacheEntry | undefined {
  const now = Date.now();
  const mem = memoryCache.get(key);
  if (mem) {
    if (mem.expiresAt > now) return mem;
    memoryCache.delete(key);
  }

  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as CacheEntry;
    if (parsed && typeof parsed.expiresAt === "number" && parsed.expiresAt > now) {
      memoryCache.set(key, parsed);
      return parsed;
    }
    window.sessionStorage.removeItem(key);
  } catch {
    // sessionStorage indisponível ou bloqueado
  }
  return undefined;
}

function writeCache(key: string, url: string | null, aspect?: number): void {
  const entry: CacheEntry = {
    url,
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
  if (Date.now() < kitsuCooldownUntil) {
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

/**
 * Pré-carrega a imagem em memória sem crossOrigin para medir dimensões reais
 * e garantir que a URL esteja íntegra antes de exibi-la no DOM.
 */
export function probeImageDimensions(
  url: string,
  parentSignal?: AbortSignal,
): Promise<ImageDimensions | null> {
  if (typeof Image === "undefined" || !url) {
    return Promise.resolve(null);
  }

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

interface KitsuAnimeResource {
  id?: string;
  type?: string;
  attributes?: {
    startDate?: string | null;
    subtype?: string | null;
    coverImage?: {
      original?: string | null;
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
 * Resolve de forma isolada a arte de banner mobile para uma temporada específica.
 * Preserva sempre:
 * 1) Banner personalizado no Admin (prioridade máxima).
 * 2) Correspondência 1:1 validada por IDs cruzados, formato e ano da temporada.
 * 3) Fallback seguro para o banner oficial da própria temporada quando não há alternativa validada.
 */
export async function resolveSeasonMobileBanner(
  input: SeasonBannerInput,
  signal?: AbortSignal,
): Promise<ResolvedSeasonBanner> {
  const fallbackUrl = input.currentBanner?.trim() || null;

  if (input.isAdminCustomBanner) {
    return {
      url: fallbackUrl,
      isAlternative: false,
      source: fallbackUrl ? "admin" : "none",
      initialObjectPosition: "50% 24%",
    };
  }

  // Para temporadas NOT_YET_RELEASED ou em andamento, permite alternativa somente
  // quando a arte e o mapeamento estiverem estritamente validados para a temporada exata.

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
        source: "kitsu-season",
        initialObjectPosition: initialObjectPositionForAspect(cached.aspect),
        aspect: cached.aspect,
      };
    }
    return {
      url: fallbackUrl,
      isAlternative: false,
      source: fallbackUrl ? "season-default" : "none",
      initialObjectPosition: "50% 24%",
    };
  }

  const currentDimsPromise: Promise<ImageDimensions | null> = fallbackUrl
    ? probeImageDimensions(fallbackUrl, signal)
    : Promise.resolve(null);

  const kitsuLookupPromise = (async (): Promise<
    KitsuAnimeResource | undefined
  > => {
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
      if (animeCandidates.length === 1) {
        return animeCandidates[0];
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
      if (animeCandidates.length === 1) {
        return animeCandidates[0];
      }
    }

    if (input.kitsuId != null) {
      const lookupUrl = `https://kitsu.io/api/edge/anime/${encodeURIComponent(
        String(input.kitsuId),
      )}`;
      const res = await fetchJsonWithTimeout<KitsuSingleAnimeResponse>(
        lookupUrl,
        signal,
      );
      if (res?.data?.type === "anime" && res.data.id) {
        return res.data;
      }
    }

    return undefined;
  })();

  const [currentDims, kitsuItem] = await Promise.all([
    currentDimsPromise,
    kitsuLookupPromise,
  ]);

  if (signal?.aborted) {
    return {
      url: fallbackUrl,
      isAlternative: false,
      source: fallbackUrl ? "season-default" : "none",
      initialObjectPosition: "50% 24%",
    };
  }

  // Se o banner atual da temporada já possuir proporção horizontal adequada ao mobile, mantém.
  if (
    fallbackUrl &&
    currentDims &&
    currentDims.width >= 960 &&
    currentDims.height >= 500 &&
    currentDims.aspect >= MIN_HORIZONTAL_ASPECT &&
    currentDims.aspect <= MAX_STANDARD_HORIZONTAL_ASPECT
  ) {
    writeCache(cacheKey, null);
    return {
      url: fallbackUrl,
      isAlternative: false,
      source: "season-default",
      initialObjectPosition: initialObjectPositionForAspect(currentDims.aspect),
      aspect: currentDims.aspect,
    };
  }

  if (!kitsuItem?.id) {
    writeCache(cacheKey, null);
    return {
      url: fallbackUrl,
      isAlternative: false,
      source: fallbackUrl ? "season-default" : "none",
      initialObjectPosition: "50% 24%",
    };
  }

  const kitsuIdStr = String(kitsuItem.id);
  const candidateFormat = normalizeKitsuSubtype(kitsuItem.attributes?.subtype);
  const expectedYear = input.startYear ?? input.year ?? null;

  // Validação de formato (TV vs MOVIE/OVA) e ano exato da temporada
  if (
    !areFormatsCompatible(input.format, candidateFormat) ||
    !isSeasonYearConsistent(expectedYear, kitsuItem.attributes?.startDate)
  ) {
    writeCache(cacheKey, null);
    return {
      url: fallbackUrl,
      isAlternative: false,
      source: fallbackUrl ? "season-default" : "none",
      initialObjectPosition: "50% 24%",
    };
  }

  const candidateUrl = kitsuItem.attributes?.coverImage?.original ?? null;
  if (
    !isValidPermanentKitsuSeasonUrl(
      candidateUrl,
      kitsuIdStr,
      input.currentCover,
    )
  ) {
    writeCache(cacheKey, null);
    return {
      url: fallbackUrl,
      isAlternative: false,
      source: fallbackUrl ? "season-default" : "none",
      initialObjectPosition: "50% 24%",
    };
  }

  // Confirmação bidirecional dos mapeamentos externos em paralelo à medição real da imagem:
  // Só aprova a arte se AMBOS (identidade 1:1 da temporada + resolução/proporção) forem válidos.
  const [itemMappingsRes, candidateDims] = await Promise.all([
    fetchJsonWithTimeout<KitsuItemMappingsResponse>(
      `https://kitsu.io/api/edge/anime/${encodeURIComponent(kitsuIdStr)}/mappings`,
      signal,
    ),
    probeImageDimensions(candidateUrl, signal),
  ]);

  if (signal?.aborted) {
    return {
      url: fallbackUrl,
      isAlternative: false,
      source: fallbackUrl ? "season-default" : "none",
      initialObjectPosition: "50% 24%",
    };
  }

  const rawMappings = (itemMappingsRes?.data ?? []).map((m) => ({
    externalSite: m.attributes?.externalSite,
    externalId: m.attributes?.externalId,
  }));

  if (
    rawMappings.length === 0 ||
    !verifyBidirectionalSeasonMappings({
      mappings: rawMappings,
      anilistId: input.anilistId,
      malId: input.malId,
    })
  ) {
    writeCache(cacheKey, null);
    return {
      url: fallbackUrl,
      isAlternative: false,
      source: fallbackUrl ? "season-default" : "none",
      initialObjectPosition: "50% 24%",
    };
  }

  const passesQualityAndAspect =
    candidateDims != null &&
    candidateDims.width >= MIN_ALT_WIDTH &&
    candidateDims.height >= MIN_ALT_HEIGHT &&
    candidateDims.aspect >= MIN_HORIZONTAL_ASPECT &&
    candidateDims.aspect <= MAX_MOBILE_ALT_ASPECT &&
    (!currentDims ||
      candidateDims.aspect < currentDims.aspect - 0.35 ||
      (currentDims.aspect >= 2.1 &&
        candidateDims.aspect <= MAX_STANDARD_HORIZONTAL_ASPECT));

  if (!passesQualityAndAspect || !candidateDims) {
    writeCache(cacheKey, null);
    return {
      url: fallbackUrl,
      isAlternative: false,
      source: fallbackUrl ? "season-default" : "none",
      initialObjectPosition: "50% 24%",
    };
  }

  writeCache(cacheKey, candidateUrl, candidateDims.aspect);
  return {
    url: candidateUrl,
    isAlternative: true,
    source: "kitsu-season",
    initialObjectPosition: initialObjectPositionForAspect(candidateDims.aspect),
    aspect: candidateDims.aspect,
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
        } else {
          objectPosition = initialObjectPositionForAspect(aspect);
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
