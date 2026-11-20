import { getRedisClient } from "@/lib/redis";
import {
  applyAniSkipRelationRules,
  fetchAniSkipRelationRules,
  fetchAniSkipTimestamps,
  formatSecondsToTime,
  normalizeEpisodeLengthParam,
  readOpeningRedisJson,
  writeOpeningRedisJson,
  type AniSkipRelationRule,
  type FetchLike,
  type RedisLike,
} from "@/lib/aniskip";
import {
  resolveExternalAnimeIds,
  resolveExternalSeasonNumber,
  type CatalogIdsInput,
  type ExternalAnimeIds,
} from "@/lib/opening-external-ids";

export type OpeningSourceId = "aniskip" | "theintrodb" | "introdb";

export type OpeningLookupStatus =
  | "found"
  | "not_found"
  | "no_intro"
  | "rate_limited"
  | "timeout"
  | "error"
  | "skipped";

export interface OpeningEpisodeQuery {
  seasonNumber: number;
  episodeNumber: number;
  episodeLengthSeconds?: number | null;
}

export interface OpeningSuggestion {
  seasonNumber: number;
  episodeNumber: number;
  found: boolean;
  startSeconds: number | null;
  endSeconds: number | null;
  startTime: string;
  endTime: string;
  source: OpeningSourceId | null;
  sourceLabel: string | null;
  confidence: number | null;
  submissionCount: number | null;
  status: OpeningLookupStatus;
  message?: string;
  remappedFrom?: {
    malId: number;
    episodeNumber: number;
    targetMalId: number;
    targetEpisodeNumber: number;
  };
  fromCache?: boolean;
}

export interface ProviderOptions {
  fetchFn?: FetchLike;
  redis?: RedisLike | null;
  timeoutMs?: number;
  episodeLengthSeconds?: number | null;
}

export interface CascadeBatchOptions {
  fetchFn?: FetchLike;
  redis?: RedisLike | null;
  timeoutMs?: number;
  concurrency?: number;
  /** Limites de episódios em temporadas anteriores para distinguir numeração cumulativa vs reiniciada */
  previousSeasonMaxEpisodes?: Record<number, number>;
}

export const PROVIDER_POSITIVE_CACHE_TTL_SEC = 7 * 24 * 60 * 60; // 7 dias
export const PROVIDER_NEGATIVE_CACHE_TTL_SEC = 24 * 60 * 60; // 24 horas

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_CONCURRENCY = 4;
const USER_AGENT = "HikariAnimeStream/1.0 (+https://hikari.stream)";

const SOURCE_LABELS: Record<OpeningSourceId, string> = {
  aniskip: "AniSkip",
  theintrodb: "TheIntroDB",
  introdb: "IntroDB",
};

function resolveRedis(options?: { redis?: RedisLike | null }): RedisLike | null {
  if (options && "redis" in options) {
    return options.redis ?? null;
  }
  return getRedisClient() as unknown as RedisLike | null;
}

function isAbortOrTimeoutError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const name = (err as { name?: string }).name;
  const msg = (err as { message?: string }).message ?? "";
  return name === "AbortError" || name === "TimeoutError" || /abort|timeout/i.test(msg);
}

/**
 * Valida que início e fim são números inteiros finitos >= 0 com fim estritamente maior que início.
 */
export function validateOpeningInterval(
  startSeconds: number | null | undefined,
  endSeconds: number | null | undefined,
  episodeLengthSeconds?: number | null,
): boolean {
  if (
    typeof startSeconds !== "number" ||
    !Number.isFinite(startSeconds) ||
    typeof endSeconds !== "number" ||
    !Number.isFinite(endSeconds)
  ) {
    return false;
  }
  const s = Math.round(startSeconds);
  const e = Math.round(endSeconds);
  if (s < 0 || e <= s) return false;

  const epLen = normalizeEpisodeLengthParam(episodeLengthSeconds);
  if (epLen > 0 && (s >= epLen || e > epLen + 15)) {
    return false;
  }
  return true;
}

function buildNotFoundSuggestion(
  seasonNumber: number,
  episodeNumber: number,
  status: OpeningLookupStatus,
  source: OpeningSourceId | null = null,
  message?: string,
): OpeningSuggestion {
  return {
    seasonNumber,
    episodeNumber,
    found: false,
    startSeconds: null,
    endSeconds: null,
    startTime: "",
    endTime: "",
    source,
    sourceLabel: source ? SOURCE_LABELS[source] : null,
    confidence: null,
    submissionCount: null,
    status,
    message,
  };
}

/**
 * Converte milissegundos para segundos inteiros arredondados (retorna null se inválido/ausente).
 */
export function millisecondsToSeconds(ms: unknown): number | null {
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms < 0) return null;
  return Math.round(ms / 1000);
}

/**
 * ETAPA 2 — Consulta TheIntroDB v4 (`GET https://api.theintrodb.org/v4/media`).
 * Usa `tvdb_id` como identidade primária (com fallback em `tmdb_id` se `tvdb_id` não estiver disponível).
 * Rejeita segmentos com início ou fim ausente e nunca mistura intervalos.
 */
export async function fetchTheIntroDbOpening(
  params: {
    tvdbId?: number | null;
    tmdbId?: number | null;
    seasonNumber: number;
    episodeNumber: number;
    catalogSeasonNumber?: number;
  },
  options?: ProviderOptions,
): Promise<OpeningSuggestion> {
  const catalogSeason = params.catalogSeasonNumber ?? params.seasonNumber;
  const tvdbId = typeof params.tvdbId === "number" && params.tvdbId > 0 ? Math.trunc(params.tvdbId) : null;
  const tmdbId = typeof params.tmdbId === "number" && params.tmdbId > 0 ? Math.trunc(params.tmdbId) : null;
  const season = Math.trunc(params.seasonNumber);
  const episode = Math.trunc(params.episodeNumber);

  if ((!tvdbId && !tmdbId) || season < 1 || episode < 1) {
    return buildNotFoundSuggestion(
      catalogSeason,
      episode,
      "skipped",
      "theintrodb",
      "Identificador TVDB/TMDB ou episódio indisponível.",
    );
  }

  const idKind = tvdbId ? "tvdb" : "tmdb";
  const idValue = (tvdbId ?? tmdbId)!;
  const cacheKey = `hikari:theintrodb:v4:${idKind}:${idValue}:s${season}:e${episode}`;
  const redis = resolveRedis(options);

  const cached = await readOpeningRedisJson<OpeningSuggestion>(redis, cacheKey);
  if (cached && typeof cached === "object" && typeof cached.found === "boolean") {
    return {
      ...cached,
      seasonNumber: catalogSeason,
      episodeNumber: episode,
      fromCache: true,
    };
  }

  const fetchFn = options?.fetchFn ?? fetch;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const queryParam = tvdbId ? `tvdb_id=${tvdbId}` : `tmdb_id=${tmdbId}`;
  const url = `https://api.theintrodb.org/v4/media?${queryParam}&season=${season}&episode=${episode}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchFn(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
    });
    clearTimeout(timer);

    if (res.status === 429) {
      console.warn("[theintrodb] Rate limit atingido (429).");
      return buildNotFoundSuggestion(
        catalogSeason,
        episode,
        "rate_limited",
        "theintrodb",
        "Limite de requisições do TheIntroDB atingido.",
      );
    }

    if (res.status === 404) {
      const neg = buildNotFoundSuggestion(
        catalogSeason,
        episode,
        "not_found",
        "theintrodb",
        "Nenhuma opening encontrada no TheIntroDB.",
      );
      await writeOpeningRedisJson(redis, cacheKey, neg, PROVIDER_NEGATIVE_CACHE_TTL_SEC);
      return neg;
    }

    if (!res.ok) {
      return buildNotFoundSuggestion(
        catalogSeason,
        episode,
        "error",
        "theintrodb",
        `TheIntroDB retornou HTTP ${res.status}.`,
      );
    }

    const data = (await res.json()) as {
      intro?: Array<{
        start_ms?: number | null;
        end_ms?: number | null;
        confidence?: number | null;
      }>;
    };

    const intros = Array.isArray(data?.intro) ? data.intro : [];
    let validIntro: { startSeconds: number; endSeconds: number; confidence: number | null } | null = null;

    for (const item of intros) {
      if (!item || typeof item !== "object") continue;
      const startSeconds = millisecondsToSeconds(item.start_ms);
      const endSeconds = millisecondsToSeconds(item.end_ms);
      if (startSeconds === null || endSeconds === null) continue;
      if (!validateOpeningInterval(startSeconds, endSeconds, options?.episodeLengthSeconds)) {
        continue;
      }
      validIntro = {
        startSeconds,
        endSeconds,
        confidence:
          typeof item.confidence === "number" && Number.isFinite(item.confidence)
            ? item.confidence
            : null,
      };
      break;
    }

    if (!validIntro) {
      const neg = buildNotFoundSuggestion(
        catalogSeason,
        episode,
        "not_found",
        "theintrodb",
        intros.length > 0
          ? "TheIntroDB retornou intervalo incompleto ou inválido."
          : "Nenhuma opening encontrada no TheIntroDB.",
      );
      await writeOpeningRedisJson(redis, cacheKey, neg, PROVIDER_NEGATIVE_CACHE_TTL_SEC);
      return neg;
    }

    const foundResult: OpeningSuggestion = {
      seasonNumber: catalogSeason,
      episodeNumber: episode,
      found: true,
      startSeconds: validIntro.startSeconds,
      endSeconds: validIntro.endSeconds,
      startTime: formatSecondsToTime(validIntro.startSeconds),
      endTime: formatSecondsToTime(validIntro.endSeconds),
      source: "theintrodb",
      sourceLabel: SOURCE_LABELS.theintrodb,
      confidence: validIntro.confidence,
      submissionCount: null,
      status: "found",
      message: "Sugestão encontrada via TheIntroDB.",
    };

    await writeOpeningRedisJson(redis, cacheKey, foundResult, PROVIDER_POSITIVE_CACHE_TTL_SEC);
    return foundResult;
  } catch (err) {
    clearTimeout(timer);
    if (isAbortOrTimeoutError(err)) {
      return buildNotFoundSuggestion(
        catalogSeason,
        episode,
        "timeout",
        "theintrodb",
        "Tempo esgotado ao consultar TheIntroDB.",
      );
    }
    return buildNotFoundSuggestion(
      catalogSeason,
      episode,
      "error",
      "theintrodb",
      "Falha temporária ao consultar TheIntroDB.",
    );
  }
}

/**
 * ETAPA 3 — Consulta IntroDB (`GET https://api.introdb.app/segments`).
 * Trata `no_intro === true`, valida `start_sec` e `end_sec`, e extrai `confidence` e `submission_count`.
 */
export async function fetchIntroDbOpening(
  params: {
    imdbId?: string | null;
    seasonNumber: number;
    episodeNumber: number;
    catalogSeasonNumber?: number;
  },
  options?: ProviderOptions,
): Promise<OpeningSuggestion> {
  const catalogSeason = params.catalogSeasonNumber ?? params.seasonNumber;
  const imdbId = typeof params.imdbId === "string" ? params.imdbId.trim() : "";
  const season = Math.trunc(params.seasonNumber);
  const episode = Math.trunc(params.episodeNumber);

  if (!/^tt\d{6,10}$/.test(imdbId) || season < 1 || episode < 1) {
    return buildNotFoundSuggestion(
      catalogSeason,
      episode,
      "skipped",
      "introdb",
      "IMDb ID ou episódio indisponível.",
    );
  }

  const cacheKey = `hikari:introdb:v1:${imdbId}:s${season}:e${episode}`;
  const redis = resolveRedis(options);

  const cached = await readOpeningRedisJson<OpeningSuggestion>(redis, cacheKey);
  if (cached && typeof cached === "object" && typeof cached.found === "boolean") {
    return {
      ...cached,
      seasonNumber: catalogSeason,
      episodeNumber: episode,
      fromCache: true,
    };
  }

  const fetchFn = options?.fetchFn ?? fetch;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const url = `https://api.introdb.app/segments?imdb_id=${encodeURIComponent(imdbId)}&season=${season}&episode=${episode}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchFn(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
    });
    clearTimeout(timer);

    if (res.status === 429) {
      console.warn("[introdb] Rate limit atingido (429).");
      return buildNotFoundSuggestion(
        catalogSeason,
        episode,
        "rate_limited",
        "introdb",
        "Limite de requisições do IntroDB atingido.",
      );
    }

    if (res.status === 404) {
      const neg = buildNotFoundSuggestion(
        catalogSeason,
        episode,
        "not_found",
        "introdb",
        "Nenhuma opening encontrada no IntroDB.",
      );
      await writeOpeningRedisJson(redis, cacheKey, neg, PROVIDER_NEGATIVE_CACHE_TTL_SEC);
      return neg;
    }

    if (!res.ok) {
      return buildNotFoundSuggestion(
        catalogSeason,
        episode,
        "error",
        "introdb",
        `IntroDB retornou HTTP ${res.status}.`,
      );
    }

    const data = (await res.json()) as {
      no_intro?: boolean;
      intro?: {
        start_sec?: number | null;
        end_sec?: number | null;
        start_ms?: number | null;
        end_ms?: number | null;
        confidence?: number | null;
        submission_count?: number | null;
      } | null;
    };

    if (data?.no_intro === true) {
      const noIntroRes = buildNotFoundSuggestion(
        catalogSeason,
        episode,
        "no_intro",
        "introdb",
        "IntroDB confirmou que este episódio não possui opening.",
      );
      await writeOpeningRedisJson(redis, cacheKey, noIntroRes, PROVIDER_NEGATIVE_CACHE_TTL_SEC);
      return noIntroRes;
    }

    const rawStartSec =
      typeof data?.intro?.start_sec === "number" && Number.isFinite(data.intro.start_sec)
        ? data.intro.start_sec
        : typeof data?.intro?.start_ms === "number" && Number.isFinite(data.intro.start_ms)
          ? data.intro.start_ms / 1000
          : null;

    const rawEndSec =
      typeof data?.intro?.end_sec === "number" && Number.isFinite(data.intro.end_sec)
        ? data.intro.end_sec
        : typeof data?.intro?.end_ms === "number" && Number.isFinite(data.intro.end_ms)
          ? data.intro.end_ms / 1000
          : null;

    if (rawStartSec === null || rawEndSec === null) {
      const neg = buildNotFoundSuggestion(
        catalogSeason,
        episode,
        "not_found",
        "introdb",
        "Nenhuma opening completa encontrada no IntroDB.",
      );
      await writeOpeningRedisJson(redis, cacheKey, neg, PROVIDER_NEGATIVE_CACHE_TTL_SEC);
      return neg;
    }

    const startSeconds = Math.round(rawStartSec);
    const endSeconds = Math.round(rawEndSec);

    if (!validateOpeningInterval(startSeconds, endSeconds, options?.episodeLengthSeconds)) {
      const neg = buildNotFoundSuggestion(
        catalogSeason,
        episode,
        "not_found",
        "introdb",
        "IntroDB retornou intervalo inválido.",
      );
      await writeOpeningRedisJson(redis, cacheKey, neg, PROVIDER_NEGATIVE_CACHE_TTL_SEC);
      return neg;
    }

    const confidence =
      typeof data?.intro?.confidence === "number" && Number.isFinite(data.intro.confidence)
        ? data.intro.confidence
        : null;
    const submissionCount =
      typeof data?.intro?.submission_count === "number" && Number.isFinite(data.intro.submission_count)
        ? Math.max(0, Math.round(data.intro.submission_count))
        : null;

    const foundResult: OpeningSuggestion = {
      seasonNumber: catalogSeason,
      episodeNumber: episode,
      found: true,
      startSeconds,
      endSeconds,
      startTime: formatSecondsToTime(startSeconds),
      endTime: formatSecondsToTime(endSeconds),
      source: "introdb",
      sourceLabel: SOURCE_LABELS.introdb,
      confidence,
      submissionCount,
      status: "found",
      message: "Sugestão encontrada via IntroDB.",
    };

    await writeOpeningRedisJson(redis, cacheKey, foundResult, PROVIDER_POSITIVE_CACHE_TTL_SEC);
    return foundResult;
  } catch (err) {
    clearTimeout(timer);
    if (isAbortOrTimeoutError(err)) {
      return buildNotFoundSuggestion(
        catalogSeason,
        episode,
        "timeout",
        "introdb",
        "Tempo esgotado ao consultar IntroDB.",
      );
    }
    return buildNotFoundSuggestion(
      catalogSeason,
      episode,
      "error",
      "introdb",
      "Falha temporária ao consultar IntroDB.",
    );
  }
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const limit = Math.max(1, Math.min(concurrency, items.length));
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function runWorker(): Promise<void> {
    while (true) {
      const idx = nextIndex++;
      if (idx >= items.length) return;
      results[idx] = await worker(items[idx]);
    }
  }

  await Promise.all(Array.from({ length: limit }, () => runWorker()));
  return results;
}

function canQueryAniSkipForSeasonEpisode(
  malId: number | null,
  seasonNumber: number,
  episodeNumber: number,
  rules: AniSkipRelationRule[],
  previousSeasonMaxEpisodes?: Record<number, number>,
): boolean {
  if (!malId || malId <= 0) return false;
  if (seasonNumber <= 1) return true;

  // Se houver relation-rule explícita cobrindo este episódio, pode consultar o alvo remapeado
  const remapped = applyAniSkipRelationRules(malId, episodeNumber, rules);
  if (remapped.remapped) return true;

  // Em numeração cumulativa (ex: T1 1..12, T2 13..24), ainda pertence ao mesmo MAL ID ou cadeia
  const prevMax = previousSeasonMaxEpisodes?.[seasonNumber] ?? 0;
  if (prevMax > 0 && episodeNumber > prevMax) {
    return true;
  }

  // Caso contrário, T2+ com ep reiniciado (ex: 1..12) sob MAL ID de T1 seria episódio errado
  return false;
}

/**
 * ETAPA 5 — Executa o fluxo em cascata para um lote de episódios:
 * 1) AniSkip -> 2) TheIntroDB -> 3) IntroDB.
 * Interrompe imediatamente ao obter uma sugestão utilizável, sem misturar fontes e sem
 * transformar falhas temporárias/timeout/429 em confirmação negativa.
 */
export async function fetchOpeningSuggestionsCascade(
  idsInput: CatalogIdsInput,
  episodes: OpeningEpisodeQuery[],
  options?: CascadeBatchOptions,
): Promise<{
  resolvedIds: ExternalAnimeIds;
  relationRulesFound: boolean;
  suggestions: OpeningSuggestion[];
}> {
  const redis = resolveRedis(options);
  const fetchFn = options?.fetchFn ?? fetch;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const concurrency = options?.concurrency ?? DEFAULT_CONCURRENCY;

  // Resolve IDs externos (Yuna/ARM com cache 30d) somente quando houver pelo menos um ID no catálogo
  const resolvedIds = await resolveExternalAnimeIds(idsInput, {
    fetchFn,
    redis,
    timeoutMs,
  });

  const effectiveMalId = resolvedIds.malId ?? (idsInput.malId && idsInput.malId > 0 ? Math.trunc(idsInput.malId) : null);

  // Busca relation-rules da AniSkip uma única vez por lote (com cache)
  const relationRulesResult = effectiveMalId
    ? await fetchAniSkipRelationRules(effectiveMalId, { fetchFn, redis, timeoutMs })
    : { rules: [] as AniSkipRelationRule[], found: false };

  const rateLimitedProviders = new Set<OpeningSourceId>();

  const primaryAnimeKey =
    effectiveMalId
      ? `mal:${effectiveMalId}`
      : resolvedIds.anilistId
        ? `anilist:${resolvedIds.anilistId}`
        : resolvedIds.kitsuId
          ? `kitsu:${resolvedIds.kitsuId}`
          : "unknown";

  const suggestions = await runWithConcurrency(episodes, concurrency, async (ep) => {
    const seasonNumber = Math.max(1, Math.trunc(ep.seasonNumber || 1));
    const episodeNumber = Math.trunc(ep.episodeNumber);
    const epLen = normalizeEpisodeLengthParam(ep.episodeLengthSeconds);

    if (episodeNumber < 1) {
      return buildNotFoundSuggestion(
        seasonNumber,
        episodeNumber,
        "skipped",
        null,
        "Número de episódio inválido.",
      );
    }

    const cascadeCacheKey = `hikari:opening:cascade:v1:${primaryAnimeKey}:s${seasonNumber}:e${episodeNumber}:len${epLen}`;
    const cachedCascade = await readOpeningRedisJson<OpeningSuggestion>(redis, cascadeCacheKey);
    if (cachedCascade && typeof cachedCascade === "object" && typeof cachedCascade.found === "boolean") {
      return {
        ...cachedCascade,
        fromCache: true,
      };
    }

    let hadTransientFailure: OpeningLookupStatus | null = null;
    let sawNoIntro = false;

    // 1. AniSkip (fonte principal)
    if (
      !rateLimitedProviders.has("aniskip") &&
      canQueryAniSkipForSeasonEpisode(
        effectiveMalId,
        seasonNumber,
        episodeNumber,
        relationRulesResult.rules,
        options?.previousSeasonMaxEpisodes,
      )
    ) {
      const aniRes = await fetchAniSkipTimestamps(effectiveMalId!, episodeNumber, {
        episodeLength: epLen,
        relationRules: relationRulesResult.rules,
        fetchFn,
        redis,
        timeoutMs,
      });

      if (
        aniRes.found &&
        validateOpeningInterval(aniRes.openingStartSeconds, aniRes.openingEndSeconds, epLen)
      ) {
        const result: OpeningSuggestion = {
          seasonNumber,
          episodeNumber,
          found: true,
          startSeconds: aniRes.openingStartSeconds,
          endSeconds: aniRes.openingEndSeconds,
          startTime: formatSecondsToTime(aniRes.openingStartSeconds),
          endTime: formatSecondsToTime(aniRes.openingEndSeconds),
          source: "aniskip",
          sourceLabel: SOURCE_LABELS.aniskip,
          confidence: null,
          submissionCount: null,
          status: "found",
          message: aniRes.remapped
            ? `Sugestão encontrada via AniSkip (remapeado para MAL #${aniRes.resolvedMalId} Ep. ${aniRes.resolvedEpisodeNumber}).`
            : "Sugestão encontrada via AniSkip.",
          ...(aniRes.remapped && aniRes.resolvedMalId && aniRes.resolvedEpisodeNumber
            ? {
                remappedFrom: {
                  malId: effectiveMalId!,
                  episodeNumber,
                  targetMalId: aniRes.resolvedMalId,
                  targetEpisodeNumber: aniRes.resolvedEpisodeNumber,
                },
              }
            : {}),
          fromCache: aniRes.fromCache,
        };
        await writeOpeningRedisJson(redis, cascadeCacheKey, result, PROVIDER_POSITIVE_CACHE_TTL_SEC);
        return result;
      }

      if (aniRes.status === "rate_limited") {
        rateLimitedProviders.add("aniskip");
        hadTransientFailure = "rate_limited";
      } else if (aniRes.status === "timeout" || aniRes.status === "error") {
        hadTransientFailure = hadTransientFailure ?? aniRes.status;
      }
    }

    const isMovie = resolvedIds.mediaType === "MOVIE";

    // 2. TheIntroDB (primeiro fallback)
    const tidbSeason = resolveExternalSeasonNumber(seasonNumber, resolvedIds.tvdbSeason ?? resolvedIds.tmdbSeason);
    if (
      !isMovie &&
      !rateLimitedProviders.has("theintrodb") &&
      tidbSeason !== null &&
      (resolvedIds.tvdbId || resolvedIds.tmdbId)
    ) {
      const tidbRes = await fetchTheIntroDbOpening(
        {
          tvdbId: resolvedIds.tvdbId,
          tmdbId: resolvedIds.tmdbId,
          seasonNumber: tidbSeason,
          episodeNumber,
          catalogSeasonNumber: seasonNumber,
        },
        {
          fetchFn,
          redis,
          timeoutMs,
          episodeLengthSeconds: epLen,
        },
      );

      if (tidbRes.found && validateOpeningInterval(tidbRes.startSeconds, tidbRes.endSeconds, epLen)) {
        await writeOpeningRedisJson(redis, cascadeCacheKey, tidbRes, PROVIDER_POSITIVE_CACHE_TTL_SEC);
        return tidbRes;
      }

      if (tidbRes.status === "rate_limited") {
        rateLimitedProviders.add("theintrodb");
        hadTransientFailure = hadTransientFailure ?? "rate_limited";
      } else if (tidbRes.status === "timeout" || tidbRes.status === "error") {
        hadTransientFailure = hadTransientFailure ?? tidbRes.status;
      }
    }

    // 3. IntroDB (segundo fallback)
    const imdbSeason = resolveExternalSeasonNumber(
      seasonNumber,
      resolvedIds.tvdbSeason ?? resolvedIds.tmdbSeason,
    );
    if (
      !isMovie &&
      !rateLimitedProviders.has("introdb") &&
      imdbSeason !== null &&
      resolvedIds.imdbId
    ) {
      const idbRes = await fetchIntroDbOpening(
        {
          imdbId: resolvedIds.imdbId,
          seasonNumber: imdbSeason,
          episodeNumber,
          catalogSeasonNumber: seasonNumber,
        },
        {
          fetchFn,
          redis,
          timeoutMs,
          episodeLengthSeconds: epLen,
        },
      );

      if (idbRes.found && validateOpeningInterval(idbRes.startSeconds, idbRes.endSeconds, epLen)) {
        await writeOpeningRedisJson(redis, cascadeCacheKey, idbRes, PROVIDER_POSITIVE_CACHE_TTL_SEC);
        return idbRes;
      }

      if (idbRes.status === "no_intro") {
        sawNoIntro = true;
      } else if (idbRes.status === "rate_limited") {
        rateLimitedProviders.add("introdb");
        hadTransientFailure = hadTransientFailure ?? "rate_limited";
      } else if (idbRes.status === "timeout" || idbRes.status === "error") {
        hadTransientFailure = hadTransientFailure ?? idbRes.status;
      }
    }

    // 4. Sem resultado utilizável: não tratar timeout/429/erro como ausência confirmada!
    if (hadTransientFailure) {
      const msg =
        hadTransientFailure === "rate_limited"
          ? "Limite de requisições atingido temporariamente. Tente novamente em instantes."
          : hadTransientFailure === "timeout"
            ? "Tempo esgotado em uma ou mais fontes. Tente novamente."
            : "Erro temporário ao consultar fontes externas. Tente novamente.";
      return buildNotFoundSuggestion(seasonNumber, episodeNumber, hadTransientFailure, null, msg);
    }

    const finalNegative = buildNotFoundSuggestion(
      seasonNumber,
      episodeNumber,
      sawNoIntro ? "no_intro" : "not_found",
      sawNoIntro ? "introdb" : null,
      sawNoIntro
        ? "IntroDB confirmou que não há opening neste episódio (demais fontes sem resultado)."
        : "Nenhuma opening encontrada nas fontes consultadas.",
    );

    await writeOpeningRedisJson(redis, cascadeCacheKey, finalNegative, PROVIDER_NEGATIVE_CACHE_TTL_SEC);
    return finalNegative;
  });

  return {
    resolvedIds,
    relationRulesFound: relationRulesResult.found,
    suggestions,
  };
}
