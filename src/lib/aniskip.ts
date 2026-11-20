import { getRedisClient } from "@/lib/redis";

export interface RedisLike {
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: unknown, options?: { ex?: number }): Promise<unknown>;
}

export type FetchLike = typeof fetch;

export type AniSkipFetchStatus =
  | "found"
  | "not_found"
  | "rate_limited"
  | "timeout"
  | "error"
  | "invalid_input";

export interface AniSkipRelationRuleEndpoint {
  start: number;
  end?: number;
}

export interface AniSkipRelationRule {
  from: AniSkipRelationRuleEndpoint;
  to: {
    malId: number;
    start: number;
    end?: number;
  };
}

export interface AniSkipTimestampResult {
  openingStartSeconds: number | null;
  openingEndSeconds: number | null;
  episodeLength: number | null;
  found: boolean;
  status?: AniSkipFetchStatus;
  skipType?: "op" | "mixed-op";
  resolvedMalId?: number;
  resolvedEpisodeNumber?: number;
  remapped?: boolean;
  fromCache?: boolean;
}

export interface AniSkipRelationRulesResult {
  rules: AniSkipRelationRule[];
  found: boolean;
  status?: AniSkipFetchStatus;
  fromCache?: boolean;
}

export interface AniSkipRequestOptions {
  episodeLength?: number | null;
  fetchFn?: FetchLike;
  redis?: RedisLike | null;
  timeoutMs?: number;
  relationRules?: AniSkipRelationRule[];
  maxRetries?: number;
  retryDelayMs?: number;
}

export const ANISKIP_POSITIVE_CACHE_TTL_SEC = 7 * 24 * 60 * 60; // 7 dias
export const ANISKIP_NEGATIVE_CACHE_TTL_SEC = 24 * 60 * 60; // 24 horas
export const ANISKIP_RULES_CACHE_TTL_SEC = 7 * 24 * 60 * 60; // 7 dias
export const ANISKIP_RULES_NEGATIVE_CACHE_TTL_SEC = 24 * 60 * 60; // 24 horas

const DEFAULT_TIMEOUT_MS = 5000;
const REDIS_TIMEOUT_MS = 2500;
const USER_AGENT = "HikariAnimeStream/1.0 (+https://hikari.stream)";

/**
 * Converte segundos inteiros para o formato "MM:SS" (ex: 2 -> "00:02", 180 -> "03:00").
 */
export function formatSecondsToTime(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || isNaN(seconds) || seconds < 0) {
    return "";
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Converte string "MM:SS" ou "HH:MM:SS" para segundos inteiros.
 */
export function parseTimeToSeconds(timeStr: string | null | undefined): number | null {
  if (!timeStr || typeof timeStr !== "string") return null;
  const trimmed = timeStr.trim();
  if (!trimmed) return null;

  if (/^\d+$/.test(trimmed)) {
    const val = parseInt(trimmed, 10);
    return isNaN(val) ? null : val;
  }

  const parts = trimmed.split(":").map((p) => parseInt(p, 10));
  if (parts.some(isNaN)) return null;

  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return null;
}

export async function readOpeningRedisJson<T>(
  redis: RedisLike | null | undefined,
  key: string,
): Promise<T | null> {
  if (!redis) return null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const raw = await Promise.race([
      redis.get<unknown>(key),
      new Promise<null>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Redis timeout")), REDIS_TIMEOUT_MS);
      }),
    ]);
    if (raw === null || raw === undefined) return null;
    if (typeof raw === "string") {
      return JSON.parse(raw) as T;
    }
    if (typeof raw === "object") {
      return raw as T;
    }
    return null;
  } catch (err) {
    console.warn("[aniskip] Falha ao ler cache do Redis (fallback direto):", err);
    return null;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export async function writeOpeningRedisJson(
  redis: RedisLike | null | undefined,
  key: string,
  value: unknown,
  ttlSec: number,
): Promise<void> {
  if (!redis) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      redis.set(key, JSON.stringify(value), { ex: ttlSec }),
      new Promise<void>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Redis timeout")), REDIS_TIMEOUT_MS);
      }),
    ]);
  } catch (err) {
    console.warn("[aniskip] Falha ao gravar cache no Redis:", err);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export function normalizeEpisodeLengthParam(episodeLength?: number | null): number {
  if (typeof episodeLength !== "number" || !Number.isFinite(episodeLength) || episodeLength <= 0) {
    return 0;
  }
  return Math.round(episodeLength);
}

/**
 * Monta a URL oficial da AniSkip API v2 com types=op, types=mixed-op e episodeLength (inclusive 0).
 */
export function buildAniSkipSkipTimesUrl(
  malId: number,
  episodeNumber: number,
  episodeLength?: number | null,
): string {
  const safeLen = normalizeEpisodeLengthParam(episodeLength);
  return `https://api.aniskip.com/v2/skip-times/${malId}/${episodeNumber}?types=op&types=mixed-op&episodeLength=${safeLen}`;
}

function isValidRelationRule(rule: unknown): rule is AniSkipRelationRule {
  if (!rule || typeof rule !== "object") return false;
  const r = rule as Partial<AniSkipRelationRule>;
  if (!r.from || !r.to) return false;
  if (typeof r.from.start !== "number" || !Number.isFinite(r.from.start) || r.from.start < 1) {
    return false;
  }
  if (r.from.end !== undefined && (typeof r.from.end !== "number" || !Number.isFinite(r.from.end) || r.from.end < r.from.start)) {
    return false;
  }
  if (typeof r.to.malId !== "number" || !Number.isFinite(r.to.malId) || r.to.malId < 1) {
    return false;
  }
  if (typeof r.to.start !== "number" || !Number.isFinite(r.to.start) || r.to.start < 1) {
    return false;
  }
  if (r.to.end !== undefined && (typeof r.to.end !== "number" || !Number.isFinite(r.to.end) || r.to.end < r.to.start)) {
    return false;
  }
  return true;
}

/**
 * Aplica relation-rules da AniSkip para remapear (malId, episodeNumber) quando o episódio
 * pertence a uma continuação/entrada vinculada no MyAnimeList.
 */
export function applyAniSkipRelationRules(
  malId: number,
  episodeNumber: number,
  rules: AniSkipRelationRule[],
): { malId: number; episodeNumber: number; remapped: boolean } {
  if (!malId || malId <= 0 || !episodeNumber || episodeNumber <= 0 || !Array.isArray(rules) || rules.length === 0) {
    return { malId, episodeNumber, remapped: false };
  }

  for (const rule of rules) {
    if (!isValidRelationRule(rule)) continue;
    const withinStart = episodeNumber >= rule.from.start;
    const withinEnd = rule.from.end === undefined || episodeNumber <= rule.from.end;
    if (!withinStart || !withinEnd) continue;

    const targetEp = episodeNumber - rule.from.start + rule.to.start;
    if (targetEp < 1) continue;
    if (rule.to.end !== undefined && targetEp > rule.to.end) continue;

    const targetMalId = Math.trunc(rule.to.malId);
    const remapped = targetMalId !== malId || targetEp !== episodeNumber;
    return {
      malId: targetMalId,
      episodeNumber: targetEp,
      remapped,
    };
  }

  return { malId, episodeNumber, remapped: false };
}

function resolveRedisInstance(options?: AniSkipRequestOptions): RedisLike | null {
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

async function fetchWithTimeoutAndRateRetry(
  url: string,
  fetchFn: FetchLike,
  timeoutMs: number,
  maxRetries: number,
  retryDelayMs: number,
): Promise<{ response?: Response; status: AniSkipFetchStatus }> {
  let attempt = 0;
  while (true) {
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
        if (attempt < maxRetries) {
          attempt += 1;
          const retryAfterHeader = res.headers?.get?.("retry-after");
          const parsedRetryMs =
            retryAfterHeader && /^\d+$/.test(retryAfterHeader.trim())
              ? Math.min(Number(retryAfterHeader.trim()) * 1000, 1500)
              : retryDelayMs;
          if (parsedRetryMs > 0) {
            await new Promise((r) => setTimeout(r, parsedRetryMs));
          }
          continue;
        }
        return { response: res, status: "rate_limited" };
      }

      if (res.status === 404) {
        return { response: res, status: "not_found" };
      }

      if (!res.ok) {
        return { response: res, status: "error" };
      }

      return { response: res, status: "found" };
    } catch (err) {
      clearTimeout(timer);
      if (isAbortOrTimeoutError(err)) {
        return { status: "timeout" };
      }
      return { status: "error" };
    }
  }
}

/**
 * Consulta a API v2 do AniSkip para obter timestamps de abertura (op e mixed-op) de um episódio específico.
 * Faz cache positivo (7 dias) e cache negativo (24 horas) para 404/sem resultado.
 * Nunca coloca 429, timeout ou erro 5xx no cache negativo.
 */
export async function fetchAniSkipTimestamps(
  malId: number,
  episodeNumber: number,
  options?: AniSkipRequestOptions,
): Promise<AniSkipTimestampResult> {
  if (!Number.isFinite(malId) || malId <= 0 || !Number.isFinite(episodeNumber) || episodeNumber <= 0) {
    return {
      openingStartSeconds: null,
      openingEndSeconds: null,
      episodeLength: null,
      found: false,
      status: "invalid_input",
    };
  }

  const mapped =
    options?.relationRules && options.relationRules.length > 0
      ? applyAniSkipRelationRules(malId, episodeNumber, options.relationRules)
      : { malId, episodeNumber, remapped: false };

  const targetMalId = mapped.malId;
  const targetEpisode = mapped.episodeNumber;
  const safeEpisodeLength = normalizeEpisodeLengthParam(options?.episodeLength);

  const cacheKey = `hikari:aniskip:v4:${targetMalId}:${targetEpisode}:len${safeEpisodeLength}:op-mixed`;
  const redis = resolveRedisInstance(options);

  const cached = await readOpeningRedisJson<AniSkipTimestampResult>(redis, cacheKey);
  if (cached && typeof cached === "object" && typeof cached.found === "boolean") {
    return {
      ...cached,
      resolvedMalId: cached.resolvedMalId ?? targetMalId,
      resolvedEpisodeNumber: cached.resolvedEpisodeNumber ?? targetEpisode,
      remapped: mapped.remapped || Boolean(cached.remapped),
      fromCache: true,
    };
  }

  const fetchFn = options?.fetchFn ?? fetch;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRetries = options?.maxRetries ?? 1;
  const retryDelayMs = options?.retryDelayMs ?? 300;

  const url = buildAniSkipSkipTimesUrl(targetMalId, targetEpisode, safeEpisodeLength);
  const net = await fetchWithTimeoutAndRateRetry(url, fetchFn, timeoutMs, maxRetries, retryDelayMs);

  if (net.status === "rate_limited") {
    console.warn("[aniskip] Rate limit atingido (429) na API do AniSkip.");
    return {
      openingStartSeconds: null,
      openingEndSeconds: null,
      episodeLength: null,
      found: false,
      status: "rate_limited",
      resolvedMalId: targetMalId,
      resolvedEpisodeNumber: targetEpisode,
      remapped: mapped.remapped,
    };
  }

  if (net.status === "timeout" || net.status === "error" || !net.response) {
    if (net.status === "error" && net.response) {
      console.warn(`[aniskip] AniSkip retornou status HTTP ${net.response.status}`);
    }
    return {
      openingStartSeconds: null,
      openingEndSeconds: null,
      episodeLength: null,
      found: false,
      status: net.status,
      resolvedMalId: targetMalId,
      resolvedEpisodeNumber: targetEpisode,
      remapped: mapped.remapped,
    };
  }

  if (net.status === "not_found") {
    const negativeResult: AniSkipTimestampResult = {
      openingStartSeconds: null,
      openingEndSeconds: null,
      episodeLength: null,
      found: false,
      status: "not_found",
      resolvedMalId: targetMalId,
      resolvedEpisodeNumber: targetEpisode,
      remapped: mapped.remapped,
    };
    await writeOpeningRedisJson(redis, cacheKey, negativeResult, ANISKIP_NEGATIVE_CACHE_TTL_SEC);
    return negativeResult;
  }

  try {
    const data = (await net.response.json()) as {
      found?: boolean;
      results?: Array<{
        skipType?: string;
        interval?: {
          startTime?: number;
          endTime?: number;
        };
        episodeLength?: number;
      }>;
    };

    const opCandidates = Array.isArray(data?.results)
      ? data.results
          .filter((r) => r.skipType === "op" || r.skipType === "mixed-op")
          .sort((a, b) => {
            if (a.skipType === b.skipType) return 0;
            return a.skipType === "op" ? -1 : 1;
          })
      : [];

    let validMatch: AniSkipTimestampResult | null = null;
    for (const candidate of opCandidates) {
      const rawStart = candidate.interval?.startTime;
      const rawEnd = candidate.interval?.endTime;
      if (typeof rawStart !== "number" || !Number.isFinite(rawStart)) continue;
      if (typeof rawEnd !== "number" || !Number.isFinite(rawEnd)) continue;

      const start = Math.round(rawStart);
      const end = Math.round(rawEnd);
      const epLen =
        typeof candidate.episodeLength === "number" &&
        Number.isFinite(candidate.episodeLength) &&
        candidate.episodeLength > 0
          ? Math.round(candidate.episodeLength)
          : null;

      if (start < 0 || end <= start) continue;
      if (epLen !== null && (start >= epLen || end > epLen + 15)) continue;

      validMatch = {
        openingStartSeconds: start,
        openingEndSeconds: end,
        episodeLength: epLen,
        found: true,
        status: "found",
        skipType: candidate.skipType as "op" | "mixed-op",
        resolvedMalId: targetMalId,
        resolvedEpisodeNumber: targetEpisode,
        remapped: mapped.remapped,
      };
      break;
    }

    if (!data?.found || !validMatch) {
      const negativeResult: AniSkipTimestampResult = {
        openingStartSeconds: null,
        openingEndSeconds: null,
        episodeLength: null,
        found: false,
        status: "not_found",
        resolvedMalId: targetMalId,
        resolvedEpisodeNumber: targetEpisode,
        remapped: mapped.remapped,
      };
      await writeOpeningRedisJson(redis, cacheKey, negativeResult, ANISKIP_NEGATIVE_CACHE_TTL_SEC);
      return negativeResult;
    }

    await writeOpeningRedisJson(redis, cacheKey, validMatch, ANISKIP_POSITIVE_CACHE_TTL_SEC);
    return validMatch;
  } catch (err) {
    console.warn("[aniskip] Erro ao processar JSON da AniSkip:", err);
    return {
      openingStartSeconds: null,
      openingEndSeconds: null,
      episodeLength: null,
      found: false,
      status: "error",
      resolvedMalId: targetMalId,
      resolvedEpisodeNumber: targetEpisode,
      remapped: mapped.remapped,
    };
  }
}

/**
 * Consulta as regras de relacionamento do AniSkip para o MAL ID.
 */
export async function fetchAniSkipRelationRules(
  malId: number,
  options?: Pick<AniSkipRequestOptions, "fetchFn" | "redis" | "timeoutMs" | "maxRetries" | "retryDelayMs">,
): Promise<AniSkipRelationRulesResult> {
  if (!Number.isFinite(malId) || malId <= 0) {
    return { rules: [], found: false, status: "invalid_input" };
  }

  const cacheKey = `hikari:aniskip:rules:v2:${malId}`;
  const redis = resolveRedisInstance(options);

  const cached = await readOpeningRedisJson<AniSkipRelationRulesResult>(redis, cacheKey);
  if (cached && typeof cached === "object" && Array.isArray(cached.rules)) {
    return {
      ...cached,
      fromCache: true,
    };
  }

  const fetchFn = options?.fetchFn ?? fetch;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRetries = options?.maxRetries ?? 1;
  const retryDelayMs = options?.retryDelayMs ?? 300;

  const url = `https://api.aniskip.com/v2/relation-rules/${malId}`;
  const net = await fetchWithTimeoutAndRateRetry(url, fetchFn, timeoutMs, maxRetries, retryDelayMs);

  if (net.status === "rate_limited" || net.status === "timeout" || net.status === "error") {
    return { rules: [], found: false, status: net.status };
  }

  if (net.status === "not_found" || !net.response) {
    const neg: AniSkipRelationRulesResult = { rules: [], found: false, status: "not_found" };
    await writeOpeningRedisJson(redis, cacheKey, neg, ANISKIP_RULES_NEGATIVE_CACHE_TTL_SEC);
    return neg;
  }

  try {
    const data = (await net.response.json()) as {
      found?: boolean;
      rules?: unknown[];
    };

    const validRules = Array.isArray(data?.rules) ? data.rules.filter(isValidRelationRule) : [];
    const found = Boolean(data?.found) && validRules.length > 0;
    const result: AniSkipRelationRulesResult = {
      rules: validRules,
      found,
      status: found ? "found" : "not_found",
    };

    await writeOpeningRedisJson(
      redis,
      cacheKey,
      result,
      found ? ANISKIP_RULES_CACHE_TTL_SEC : ANISKIP_RULES_NEGATIVE_CACHE_TTL_SEC,
    );
    return result;
  } catch {
    return { rules: [], found: false, status: "error" };
  }
}
