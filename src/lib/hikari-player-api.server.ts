import { env } from "./env.server";
import { validateHikariPlayerEpisodeId } from "./hikari-player";
import { sanitizeEpisodeThumbnailUrl } from "./published-episodes";

export const DEFAULT_HIKARI_PLAYER_API_TIMEOUT_MS = 5000;

export type HikariPlayerApiConfig =
  | {
      configured: true;
      baseUrl: string;
      token: string;
    }
  | {
      configured: false;
      reason: "missing_env" | "invalid_base_url";
    };

export type HikariPlayerPosterLookupResult =
  | {
      ok: true;
      id: string;
      posterUrl: string | null;
    }
  | {
      ok: false;
      kind:
        | "invalid_id"
        | "unavailable"
        | "not_found"
        | "upstream_auth_error"
        | "upstream_error"
        | "timeout"
        | "aborted"
        | "network_error";
      id: string | null;
      status?: number;
      error: string;
    };

function normalizeHikariPlayerBaseUrl(rawBaseUrl?: string | null): string | null {
  if (!rawBaseUrl || typeof rawBaseUrl !== "string") return null;
  const trimmed = rawBaseUrl.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }
    if (parsed.username || parsed.password) {
      return null;
    }
    const cleanPath = parsed.pathname.replace(/\/+$/, "");
    return `${parsed.origin}${cleanPath}`;
  } catch {
    return null;
  }
}

/**
 * Lê e valida exclusivamente no servidor as variáveis de ambiente privadas do Hikari Player:
 * - HIKARI_PLAYER_BASE_URL
 * - HIKARI_PLAYER_API_TOKEN
 *
 * Nunca retorna nem expõe segredos em logs ou respostas HTTP.
 */
export function getHikariPlayerApiConfig(overrides?: {
  baseUrl?: string | null;
  apiToken?: string | null;
}): HikariPlayerApiConfig {
  const rawBaseUrl =
    overrides?.baseUrl !== undefined
      ? overrides.baseUrl?.trim() || undefined
      : env("HIKARI_PLAYER_BASE_URL");
  const rawToken =
    overrides?.apiToken !== undefined
      ? overrides.apiToken?.trim() || undefined
      : env("HIKARI_PLAYER_API_TOKEN");

  if (!rawBaseUrl || !rawToken) {
    return { configured: false, reason: "missing_env" };
  }

  const normalizedBaseUrl = normalizeHikariPlayerBaseUrl(rawBaseUrl);
  if (!normalizedBaseUrl) {
    return { configured: false, reason: "invalid_base_url" };
  }

  return {
    configured: true,
    baseUrl: normalizedBaseUrl,
    token: rawToken,
  };
}

/**
 * Consulta servidor-servidor o endpoint privado do Hikari Player:
 * GET {HIKARI_PLAYER_BASE_URL}/api/internal/episodes/{id}
 * com Authorization: Bearer <HIKARI_PLAYER_API_TOKEN>
 *
 * Extrai exclusivamente `poster_url` e sanitiza a URL antes de retornar.
 */
export async function fetchHikariPlayerEpisodePoster(
  rawEpisodeId: string | null | undefined,
  options?: {
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
    signal?: AbortSignal;
    baseUrl?: string | null;
    apiToken?: string | null;
  },
): Promise<HikariPlayerPosterLookupResult> {
  const validation = validateHikariPlayerEpisodeId(rawEpisodeId);
  if (!validation.valid || !validation.value) {
    return {
      ok: false,
      kind: "invalid_id",
      id: null,
      error: validation.error || "ID do episódio no Hikari Player inválido.",
    };
  }

  const episodeId = validation.value;
  const config = getHikariPlayerApiConfig(
    options?.baseUrl !== undefined || options?.apiToken !== undefined
      ? {
          baseUrl: options.baseUrl,
          apiToken: options.apiToken,
        }
      : undefined,
  );

  if (!config.configured) {
    return {
      ok: false,
      kind: "unavailable",
      id: episodeId,
      error: "Integração com o Hikari Player indisponível no servidor.",
    };
  }

  const fetchImpl = options?.fetchImpl ?? fetch;
  const timeoutMs =
    typeof options?.timeoutMs === "number" &&
    Number.isFinite(options.timeoutMs) &&
    options.timeoutMs > 0
      ? options.timeoutMs
      : DEFAULT_HIKARI_PLAYER_API_TIMEOUT_MS;

  const controller = new AbortController();
  let timedOut = false;
  let abortedByCaller = false;

  const onCallerAbort = () => {
    abortedByCaller = true;
    controller.abort();
  };

  if (options?.signal) {
    if (options.signal.aborted) {
      return {
        ok: false,
        kind: "aborted",
        id: episodeId,
        error: "Consulta cancelada.",
      };
    }
    options.signal.addEventListener("abort", onCallerAbort, { once: true });
  }

  const timeoutHandle = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const targetUrl = `${config.baseUrl}/api/internal/episodes/${encodeURIComponent(episodeId)}`;

  try {
    const response = await fetchImpl(targetUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${config.token}`,
      },
      signal: controller.signal,
    });

    if (response.status === 404) {
      return {
        ok: false,
        kind: "not_found",
        id: episodeId,
        status: 404,
        error: "Episódio não encontrado no Hikari Player.",
      };
    }

    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        kind: "upstream_auth_error",
        id: episodeId,
        status: response.status,
        error: "Falha de autenticação ao consultar o Hikari Player.",
      };
    }

    if (!response.ok) {
      return {
        ok: false,
        kind: "upstream_error",
        id: episodeId,
        status: response.status,
        error: `Falha ao consultar o Hikari Player (HTTP ${response.status}).`,
      };
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      return {
        ok: false,
        kind: "network_error",
        id: episodeId,
        error: "Resposta inválida do Hikari Player.",
      };
    }

    const rawPosterUrl =
      payload &&
      typeof payload === "object" &&
      "poster_url" in payload &&
      typeof (payload as { poster_url?: unknown }).poster_url === "string"
        ? (payload as { poster_url: string }).poster_url
        : null;

    const cleanPosterUrl = sanitizeEpisodeThumbnailUrl(rawPosterUrl);

    return {
      ok: true,
      id: episodeId,
      posterUrl: cleanPosterUrl,
    };
  } catch {
    if (abortedByCaller) {
      return {
        ok: false,
        kind: "aborted",
        id: episodeId,
        error: "Consulta cancelada.",
      };
    }
    if (timedOut) {
      return {
        ok: false,
        kind: "timeout",
        id: episodeId,
        error: "Tempo esgotado ao consultar o Hikari Player.",
      };
    }
    return {
      ok: false,
      kind: "network_error",
      id: episodeId,
      error: "Falha de comunicação ao consultar o Hikari Player.",
    };
  } finally {
    clearTimeout(timeoutHandle);
    if (options?.signal) {
      options.signal.removeEventListener("abort", onCallerAbort);
    }
  }
}
