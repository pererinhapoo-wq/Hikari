import { getRedisClient } from "@/lib/redis";
import {
  readOpeningRedisJson,
  writeOpeningRedisJson,
  type FetchLike,
  type RedisLike,
} from "@/lib/aniskip";

export interface CatalogIdsInput {
  malId?: number | null;
  anilistId?: number | null;
  kitsuId?: number | null;
}

export interface ExternalAnimeIds {
  malId: number | null;
  anilistId: number | null;
  kitsuId: number | null;
  anidbId: number | null;
  tvdbId: number | null;
  tvdbSeason: number | null;
  tmdbId: number | null;
  tmdbSeason: number | null;
  imdbId: string | null;
  mediaType: string | null;
  source: "catalog" | "yuna" | "arm" | "none";
  fromCache?: boolean;
}

export interface ResolveExternalIdsOptions {
  fetchFn?: FetchLike;
  redis?: RedisLike | null;
  timeoutMs?: number;
}

export const EXTERNAL_IDS_POSITIVE_CACHE_TTL_SEC = 30 * 24 * 60 * 60; // 30 dias
export const EXTERNAL_IDS_NEGATIVE_CACHE_TTL_SEC = 24 * 60 * 60; // 24 horas

const DEFAULT_TIMEOUT_MS = 5000;
const USER_AGENT = "HikariAnimeStream/1.0 (+https://hikari.stream)";
const IMDB_ID_REGEX = /^tt\d{6,10}$/;

function toPositiveInt(val: unknown): number | null {
  if (typeof val !== "number" || !Number.isFinite(val)) return null;
  const intVal = Math.trunc(val);
  return intVal > 0 ? intVal : null;
}

function toValidImdbId(val: unknown): string | null {
  if (typeof val !== "string") return null;
  const trimmed = val.trim();
  return IMDB_ID_REGEX.test(trimmed) ? trimmed : null;
}

function buildPrimaryCacheKey(input: CatalogIdsInput): string | null {
  const malId = toPositiveInt(input.malId);
  if (malId) return `hikari:opening:ext-ids:v2:mal:${malId}`;
  const anilistId = toPositiveInt(input.anilistId);
  if (anilistId) return `hikari:opening:ext-ids:v2:anilist:${anilistId}`;
  const kitsuId = toPositiveInt(input.kitsuId);
  if (kitsuId) return `hikari:opening:ext-ids:v2:kitsu:${kitsuId}`;
  return null;
}

function buildFallbackCatalogIds(input: CatalogIdsInput): ExternalAnimeIds {
  const malId = toPositiveInt(input.malId);
  const anilistId = toPositiveInt(input.anilistId);
  const kitsuId = toPositiveInt(input.kitsuId);
  return {
    malId,
    anilistId,
    kitsuId,
    anidbId: null,
    tvdbId: null,
    tvdbSeason: null,
    tmdbId: null,
    tmdbSeason: null,
    imdbId: null,
    mediaType: null,
    source: malId || anilistId || kitsuId ? "catalog" : "none",
  };
}

interface RawRelationResponse {
  anidb?: unknown;
  anilist?: unknown;
  imdb?: unknown;
  kitsu?: unknown;
  myanimelist?: unknown;
  media?: unknown;
  themoviedb?: unknown;
  "themoviedb-season"?: unknown;
  thetvdb?: unknown;
  "thetvdb-season"?: unknown;
}

function validateAndNormalizeMapperResponse(
  input: CatalogIdsInput,
  raw: RawRelationResponse,
  source: "yuna" | "arm",
): ExternalAnimeIds | null {
  const inputMal = toPositiveInt(input.malId);
  const inputAnilist = toPositiveInt(input.anilistId);
  const inputKitsu = toPositiveInt(input.kitsuId);

  const mappedMal = toPositiveInt(raw.myanimelist);
  const mappedAnilist = toPositiveInt(raw.anilist);
  const mappedKitsu = toPositiveInt(raw.kitsu);

  // Valida que o retorno pertence exatamente ao mesmo anime do catálogo
  if (inputMal && mappedMal && mappedMal !== inputMal) {
    return null;
  }
  if (inputAnilist && mappedAnilist && mappedAnilist !== inputAnilist) {
    return null;
  }
  if (inputKitsu && mappedKitsu && mappedKitsu !== inputKitsu) {
    return null;
  }

  return {
    malId: inputMal ?? mappedMal,
    anilistId: inputAnilist ?? mappedAnilist,
    kitsuId: inputKitsu ?? mappedKitsu,
    anidbId: toPositiveInt(raw.anidb),
    tvdbId: toPositiveInt(raw.thetvdb),
    tvdbSeason: toPositiveInt(raw["thetvdb-season"]),
    tmdbId: toPositiveInt(raw.themoviedb),
    tmdbSeason: toPositiveInt(raw["themoviedb-season"]),
    imdbId: toValidImdbId(raw.imdb),
    mediaType: typeof raw.media === "string" && raw.media.trim() ? raw.media.trim().toUpperCase() : null,
    source,
  };
}

function mergeExternalAnimeIds(
  primary: ExternalAnimeIds | null,
  secondary: ExternalAnimeIds | null,
): ExternalAnimeIds | null {
  if (!primary) return secondary;
  if (!secondary) return primary;

  const secondaryAddedTargets = Boolean(
    (!primary.malId && secondary.malId) ||
      (!primary.tvdbId && secondary.tvdbId) ||
      (!primary.imdbId && secondary.imdbId) ||
      (!primary.tmdbId && secondary.tmdbId),
  );

  const primaryHadTargets = Boolean(primary.tvdbId || primary.imdbId || primary.tmdbId);

  return {
    malId: primary.malId ?? secondary.malId,
    anilistId: primary.anilistId ?? secondary.anilistId,
    kitsuId: primary.kitsuId ?? secondary.kitsuId,
    anidbId: primary.anidbId ?? secondary.anidbId,
    tvdbId: primary.tvdbId ?? secondary.tvdbId,
    tvdbSeason: primary.tvdbId
      ? (primary.tvdbSeason ?? secondary.tvdbSeason)
      : (secondary.tvdbSeason ?? primary.tvdbSeason),
    tmdbId: primary.tmdbId ?? secondary.tmdbId,
    tmdbSeason: primary.tmdbId
      ? (primary.tmdbSeason ?? secondary.tmdbSeason)
      : (secondary.tmdbSeason ?? primary.tmdbSeason),
    imdbId: primary.imdbId ?? secondary.imdbId,
    mediaType: primary.mediaType ?? secondary.mediaType,
    source: !primaryHadTargets && secondaryAddedTargets ? secondary.source : primary.source,
  };
}

async function queryMapperEndpoint(
  baseUrl: string,
  querySource: "myanimelist" | "anilist" | "kitsu",
  id: number,
  fetchFn: FetchLike,
  timeoutMs: number,
): Promise<{ status: "ok" | "not_found" | "error"; data?: RawRelationResponse }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = `${baseUrl}?source=${querySource}&id=${id}`;
    const res = await fetchFn(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
    });
    clearTimeout(timer);

    if (res.status === 404) {
      return { status: "not_found" };
    }
    if (!res.ok) {
      return { status: "error" };
    }
    const json = (await res.json()) as RawRelationResponse;
    if (!json || typeof json !== "object") {
      return { status: "not_found" };
    }
    return { status: "ok", data: json };
  } catch {
    clearTimeout(timer);
    return { status: "error" };
  }
}

/**
 * Calcula a temporada efetiva em provedores ocidentais (TVDB/TMDB/IMDb) respeitando o offset
 * da temporada base mapeada para a entrada do catálogo.
 */
export function resolveExternalSeasonNumber(
  catalogSeasonNumber: number,
  mappedBaseSeason: number | null | undefined,
): number | null {
  if (!Number.isFinite(catalogSeasonNumber) || catalogSeasonNumber < 1) {
    return null;
  }
  const safeCatalogSeason = Math.trunc(catalogSeasonNumber);
  if (typeof mappedBaseSeason === "number" && Number.isFinite(mappedBaseSeason) && mappedBaseSeason >= 1) {
    return Math.trunc(mappedBaseSeason) + (safeCatalogSeason - 1);
  }
  return safeCatalogSeason;
}

/**
 * Resolve identificadores externos (TVDB, TMDB, IMDb, MAL, AniList) priorizando os IDs do catálogo
 * e consultando Yuna Relations (com fallback/complemento em ARM) com cache de 30 dias no Upstash Redis.
 */
export async function resolveExternalAnimeIds(
  input: CatalogIdsInput,
  options?: ResolveExternalIdsOptions,
): Promise<ExternalAnimeIds> {
  const baseline = buildFallbackCatalogIds(input);
  const cacheKey = buildPrimaryCacheKey(input);
  if (!cacheKey) {
    return baseline;
  }

  const redis =
    options && "redis" in options
      ? (options.redis ?? null)
      : (getRedisClient() as unknown as RedisLike | null);

  const cached = await readOpeningRedisJson<ExternalAnimeIds>(redis, cacheKey);
  if (cached && typeof cached === "object" && "source" in cached) {
    return {
      ...cached,
      malId: baseline.malId ?? cached.malId,
      anilistId: baseline.anilistId ?? cached.anilistId,
      kitsuId: baseline.kitsuId ?? cached.kitsuId,
      fromCache: true,
    };
  }

  const fetchFn = options?.fetchFn ?? fetch;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const lookupSource: "myanimelist" | "anilist" | "kitsu" = baseline.malId
    ? "myanimelist"
    : baseline.anilistId
      ? "anilist"
      : "kitsu";
  const lookupId = (baseline.malId ?? baseline.anilistId ?? baseline.kitsuId)!;

  let anyTransientFailure = false;
  let resolved: ExternalAnimeIds | null = null;

  // 1. Tenta Yuna Relations
  const yunaRes = await queryMapperEndpoint(
    "https://relations.yuna.moe/api/v2/ids",
    lookupSource,
    lookupId,
    fetchFn,
    timeoutMs,
  );
  if (yunaRes.status === "ok" && yunaRes.data) {
    const normalized = validateAndNormalizeMapperResponse(input, yunaRes.data, "yuna");
    if (normalized) {
      resolved = normalized;
    }
  } else if (yunaRes.status === "error") {
    anyTransientFailure = true;
  }

  // 2. Consulta ARM como fallback/complemento se Yuna falhou ou ainda faltam MAL/TVDB/IMDb
  const hasCompleteTargets = Boolean(
    resolved && resolved.malId && resolved.tvdbId && resolved.imdbId,
  );
  if (!hasCompleteTargets) {
    const armRes = await queryMapperEndpoint(
      "https://arm.haglund.dev/api/v2/ids",
      lookupSource,
      lookupId,
      fetchFn,
      timeoutMs,
    );
    if (armRes.status === "ok" && armRes.data) {
      const normalized = validateAndNormalizeMapperResponse(input, armRes.data, "arm");
      if (normalized) {
        resolved = mergeExternalAnimeIds(resolved, normalized);
      }
    } else if (armRes.status === "error") {
      anyTransientFailure = true;
    }
  }

  if (resolved) {
    const hasAllExternal = Boolean(resolved.tvdbId && resolved.imdbId && resolved.malId);
    const hasAnyExternalTarget = Boolean(
      resolved.tvdbId || resolved.imdbId || resolved.tmdbId || (resolved.malId && !baseline.malId),
    );
    if (!anyTransientFailure || hasAllExternal) {
      await writeOpeningRedisJson(
        redis,
        cacheKey,
        resolved,
        hasAnyExternalTarget ? EXTERNAL_IDS_POSITIVE_CACHE_TTL_SEC : EXTERNAL_IDS_NEGATIVE_CACHE_TTL_SEC,
      );
    }
    return resolved;
  }

  if (!anyTransientFailure) {
    await writeOpeningRedisJson(redis, cacheKey, baseline, EXTERNAL_IDS_NEGATIVE_CACHE_TTL_SEC);
  }

  return baseline;
}
