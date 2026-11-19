export const HIKARI_PLAYER_ORIGIN = "https://hikari-player-2.vercel.app" as const;
export const HIKARI_PLAYER_EPISODE_PATH_PREFIX = "/e/" as const;
export const HIKARI_PLAYER_EPISODE_ID_MAX_LENGTH = 128;

export interface HikariPlayerEpisodeIdValidation {
  valid: boolean;
  value: string | null;
  error?: string;
}

const VALID_ID_CHARS_REGEX = /^[A-Za-z0-9._-]+$/;
const URL_SCHEME_OR_PREFIX_REGEX = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;
const LIKELY_DOMAIN_REGEX =
  /(?:hikari-player|\.(?:vercel\.app|com|net|org|io|dev|app|tv|br|me|co|xyz)(?:$|[:/?#]))/i;

/**
 * Normalizes an optional Hikari Player episode ID by trimming whitespace
 * and converting empty/blank strings to null (no association).
 */
export function normalizeHikariPlayerEpisodeId(
  raw?: string | null,
): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Validates the Hikari Player episode ID (`player_episodes.id` in the separate player app).
 * - Blank / null / undefined => valid with `value: null` (no association).
 * - Rejects full URLs, paths, query strings, fragments, whitespace, and path traversal.
 */
export function validateHikariPlayerEpisodeId(
  raw?: string | null,
): HikariPlayerEpisodeIdValidation {
  if (raw === undefined || raw === null) {
    return { valid: true, value: null };
  }

  if (typeof raw !== "string") {
    return {
      valid: false,
      value: null,
      error: "O ID do episódio no Hikari Player deve ser um texto válido.",
    };
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return { valid: true, value: null };
  }

  if (trimmed.length > HIKARI_PLAYER_EPISODE_ID_MAX_LENGTH) {
    return {
      valid: false,
      value: null,
      error: `O ID do episódio no Hikari Player deve ter no máximo ${HIKARI_PLAYER_EPISODE_ID_MAX_LENGTH} caracteres.`,
    };
  }

  if (
    URL_SCHEME_OR_PREFIX_REGEX.test(trimmed) ||
    trimmed.includes("://") ||
    trimmed.includes("/") ||
    trimmed.includes("\\") ||
    trimmed.includes("?") ||
    trimmed.includes("#") ||
    trimmed.includes(":") ||
    trimmed.includes("@") ||
    LIKELY_DOMAIN_REGEX.test(trimmed)
  ) {
    return {
      valid: false,
      value: null,
      error:
        "Informe apenas o ID do episódio no Hikari Player (ex.: abc123), não a URL completa.",
    };
  }

  if (/\s/.test(trimmed)) {
    return {
      valid: false,
      value: null,
      error:
        "O ID do episódio no Hikari Player não pode conter espaços internos.",
    };
  }

  if (trimmed === "." || trimmed === ".." || trimmed.includes("..")) {
    return {
      valid: false,
      value: null,
      error: "ID do episódio no Hikari Player inválido.",
    };
  }

  if (!VALID_ID_CHARS_REGEX.test(trimmed)) {
    return {
      valid: false,
      value: null,
      error:
        "Use apenas letras, números, hífen (-), sublinhado (_) ou ponto (.) no ID do Hikari Player.",
    };
  }

  return { valid: true, value: trimmed };
}

/**
 * Safely constructs the public Hikari Player episode URL using the fixed
 * origin `https://hikari-player-2.vercel.app` and `/e/{id}` path.
 * Returns `null` when absent, empty, or invalid.
 */
export function buildHikariPlayerEpisodeUrl(
  rawId?: string | null,
): string | null {
  const validation = validateHikariPlayerEpisodeId(rawId);
  if (!validation.valid || !validation.value) {
    return null;
  }

  try {
    const url = new URL(
      `${HIKARI_PLAYER_EPISODE_PATH_PREFIX}${encodeURIComponent(validation.value)}`,
      HIKARI_PLAYER_ORIGIN,
    );
    if (url.origin !== HIKARI_PLAYER_ORIGIN) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}
