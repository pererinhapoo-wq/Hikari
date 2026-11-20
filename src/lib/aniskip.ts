import { getRedisClient } from "@/lib/redis";

export interface AniSkipTimestampResult {
  openingStartSeconds: number | null;
  openingEndSeconds: number | null;
  episodeLength: number | null;
  found: boolean;
}

export interface AniSkipRelationRulesResult {
  rules: Array<Record<string, unknown>>;
  found: boolean;
}

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

const ANISKIP_CACHE_TTL = 7 * 24 * 60 * 60; // 7 dias

/**
 * Consulta a API v2 do AniSkip para obter timestamps de abertura (op) de um episódio específico.
 */
export async function fetchAniSkipTimestamps(
  malId: number,
  episodeNumber: number,
): Promise<AniSkipTimestampResult> {
  if (!malId || malId <= 0 || !episodeNumber || episodeNumber <= 0) {
    return { openingStartSeconds: null, openingEndSeconds: null, episodeLength: null, found: false };
  }

  const cacheKey = `hikari:aniskip:v2:${malId}:${episodeNumber}:op`;
  const redis = getRedisClient();

  if (redis) {
    try {
      const cached = await redis.get<string>(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as AniSkipTimestampResult;
        if (parsed && typeof parsed === "object") {
          return parsed;
        }
      }
    } catch (err) {
      console.warn("[aniskip] Falha ao ler cache do Redis (fallback direto para API):", err);
    }
  }

  try {
    const url = `https://api.aniskip.com/v2/skip-times/${malId}/${episodeNumber}?types[]=op`;
    const controller = new AbortController();
    const timeoutTimer = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "HikariAnimeStream/1.0 (+https://hikari.stream)",
      },
    });
    clearTimeout(timeoutTimer);

    if (res.status === 404) {
      return { openingStartSeconds: null, openingEndSeconds: null, episodeLength: null, found: false };
    }

    if (res.status === 429) {
      console.warn("[aniskip] Rate limit atingido (429) na API do AniSkip.");
      return { openingStartSeconds: null, openingEndSeconds: null, episodeLength: null, found: false };
    }

    if (!res.ok) {
      console.warn(`[aniskip] AniSkip retornou status HTTP ${res.status}`);
      return { openingStartSeconds: null, openingEndSeconds: null, episodeLength: null, found: false };
    }

    const data = (await res.json()) as {
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

    if (!data || !data.found || !Array.isArray(data.results)) {
      return { openingStartSeconds: null, openingEndSeconds: null, episodeLength: null, found: false };
    }

    const opResult = data.results.find(
      (r) => r.skipType === "op" || r.skipType === "mixed-op",
    );

    if (!opResult || !opResult.interval) {
      return { openingStartSeconds: null, openingEndSeconds: null, episodeLength: null, found: false };
    }

    const start = typeof opResult.interval.startTime === "number" ? Math.round(opResult.interval.startTime) : null;
    const end = typeof opResult.interval.endTime === "number" ? Math.round(opResult.interval.endTime) : null;
    const epLen = typeof opResult.episodeLength === "number" ? Math.round(opResult.episodeLength) : null;

    if (start !== null && end !== null && (start < 0 || end <= start)) {
      console.warn("[aniskip] Intervalo de opening inválido retornado pela API:", { start, end });
      return { openingStartSeconds: null, openingEndSeconds: null, episodeLength: epLen, found: false };
    }

    const result: AniSkipTimestampResult = {
      openingStartSeconds: start,
      openingEndSeconds: end,
      episodeLength: epLen,
      found: true,
    };

    if (redis) {
      try {
        await redis.set(cacheKey, JSON.stringify(result), { ex: ANISKIP_CACHE_TTL });
      } catch (err) {
        console.warn("[aniskip] Falha ao gravar cache no Redis:", err);
      }
    }

    return result;
  } catch (err) {
    console.warn("[aniskip] Erro ao consultar AniSkip:", err);
    return { openingStartSeconds: null, openingEndSeconds: null, episodeLength: null, found: false };
  }
}

/**
 * Consulta as regras de relacionamento do AniSkip para o MAL ID.
 */
export async function fetchAniSkipRelationRules(malId: number): Promise<AniSkipRelationRulesResult> {
  if (!malId || malId <= 0) {
    return { rules: [], found: false };
  }

  const cacheKey = `hikari:aniskip:rules:${malId}`;
  const redis = getRedisClient();

  if (redis) {
    try {
      const cached = await redis.get<string>(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as AniSkipRelationRulesResult;
        if (parsed && typeof parsed === "object") {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
  }

  try {
    const url = `https://api.aniskip.com/v2/relation-rules/${malId}`;
    const controller = new AbortController();
    const timeoutTimer = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "HikariAnimeStream/1.0 (+https://hikari.stream)",
      },
    });
    clearTimeout(timeoutTimer);

    if (!res.ok) {
      return { rules: [], found: false };
    }

    const data = (await res.json()) as {
      found?: boolean;
      rules?: Array<Record<string, unknown>>;
    };

    const result: AniSkipRelationRulesResult = {
      rules: Array.isArray(data?.rules) ? data.rules : [],
      found: Boolean(data?.found),
    };

    if (redis) {
      try {
        await redis.set(cacheKey, JSON.stringify(result), { ex: ANISKIP_CACHE_TTL });
      } catch {
        // ignore
      }
    }

    return result;
  } catch {
    return { rules: [], found: false };
  }
}
