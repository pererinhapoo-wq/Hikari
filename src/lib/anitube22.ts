export const ANITUBE22_PROVIDER = "anitube22";
export const ANITUBE22_PLAYER_BASE = "https://www.anitube22.vip/playerricas.php";

export const ANITUBE22_INVALID_URL_ERROR = "cole a URL completa do player";
export const ANITUBE22_WRONG_LANG_ERROR = "esta fonte é de outro idioma";
export const ANITUBE22_NOT_FOUND_ERROR = "ID não encontrado no provedor";
export const ANITUBE22_INCOMPLETE_PLAY_ERROR = "fonte incompleta, recadastre";

export type SourceLang = "sub" | "dub";
export type SourceStatus = "active" | "broken" | "incomplete";

export interface EpisodeSourceItem {
  id: string;
  episodeId: string;
  provider: string;
  externalId: string;
  lang: SourceLang;
  quality: string | null;
  priority: number;
  status: SourceStatus;
  failCount: number;
  lastCheckedAt: string | null;
  namePath?: string | null;
  urlPath?: string | null;
  imgUrl?: string | null;
}

export interface Anitube22ParsedParts {
  externalId: string;
  namePath: string;
  urlPath: string;
  imgUrl: string;
}

const EPISODE_SUB_LANG_RE =
  /(?:^|[^a-z0-9])(leg|legendado|legendada|sub|subbed|english\s*sub|pt-br\s*leg|áudio\s*original|audio\s*original|japon[eê]s)(?:$|[^a-z0-9])/i;
const EPISODE_DUB_LANG_RE =
  /(?:^|[^a-z0-9])(dub|dubbed|dublado|dublada|dublagem|pt-br\s*dub|dub\s*pt-br|áudio\s*pt-br|audio\s*pt-br|pt-br)(?:$|[^a-z0-9])/i;

export function parseExplicitSourceLang(value?: string | null): SourceLang | null {
  if (!value || typeof value !== "string") return null;
  const clean = value.trim().toLowerCase();
  if (!clean) return null;
  if (clean === "sub" || clean === "leg" || clean === "legendado" || clean === "legendada" || clean === "subbed") {
    return "sub";
  }
  if (clean === "dub" || clean === "dublado" || clean === "dublada" || clean === "dubbed" || clean === "pt-br") {
    return "dub";
  }
  return null;
}

export function normalizeSourceLang(value?: string | null): SourceLang {
  return parseExplicitSourceLang(value) === "dub" ? "dub" : "sub";
}

export function detectEpisodeLanguageHint(
  texts: Array<string | null | undefined>,
): SourceLang | null {
  for (const text of texts) {
    if (!text || typeof text !== "string") continue;
    const trimmed = text.trim();
    if (!trimmed) continue;
    const hasSub = EPISODE_SUB_LANG_RE.test(trimmed);
    const hasDub = EPISODE_DUB_LANG_RE.test(trimmed);
    if (hasSub && !hasDub) return "sub";
    if (hasDub && !hasSub) return "dub";
    if (hasSub && hasDub) {
      // If both appear, pick whichever token matches at the end (e.g. "(Dublado)")
      const lastSub = trimmed.search(EPISODE_SUB_LANG_RE);
      const lastDub = trimmed.search(EPISODE_DUB_LANG_RE);
      return lastDub > lastSub ? "dub" : "sub";
    }
  }
  return null;
}

export function isLegacyAnitube22Ref(input?: string | null): boolean {
  if (!input || typeof input !== "string") return false;
  return /^anitube22:/i.test(input.trim());
}

/**
 * Faz o parse estrito da URL completa do playerricas.php:
 * - Exige protocolo http/https + pathname contendo playerricas.php
 * - Exige parâmetros não vazios `name` e `url`, além de ID numérico antes de `.mp4`
 * - Faz parse literal de `name`, `img` e `url` sem normalizar nem remover bucket/prefixo
 * - Descarta `time`
 */
export function parseAnitube22PlayerUrl(rawUrl: string): Anitube22ParsedParts | null {
  if (!rawUrl || typeof rawUrl !== "string") return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    if (!parsed.pathname.toLowerCase().includes("playerricas.php")) {
      return null;
    }

    const name = parsed.searchParams.get("name")?.trim() || "";
    const url = parsed.searchParams.get("url")?.trim() || "";
    const img = parsed.searchParams.get("img")?.trim() || "";

    if (!name || !url) {
      return null;
    }

    const idFromName = name.match(/(\d+)\.mp4/i)?.[1];
    const idFromUrl = url.match(/(\d+)\.mp4/i)?.[1];
    const externalId = idFromName || idFromUrl || "";
    if (!externalId) {
      return null;
    }

    return {
      externalId,
      namePath: name,
      urlPath: url,
      imgUrl: img,
    };
  } catch {
    return null;
  }
}

export function validateAnitube22PlayerUrl(
  rawUrl: string,
): { ok: true; parsed: Anitube22ParsedParts } | { ok: false; error: string } {
  const parsed = parseAnitube22PlayerUrl(rawUrl);
  if (!parsed) {
    return { ok: false, error: ANITUBE22_INVALID_URL_ERROR };
  }
  return { ok: true, parsed };
}

export function isAnitube22PlayerUrl(url?: string | null): boolean {
  if (!url || typeof url !== "string") return false;
  return parseAnitube22PlayerUrl(url) !== null;
}

export function stripTimeQueryParam(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return "";
  if (!/[?&]time=/i.test(trimmed)) return trimmed;
  const stripped = trimmed
    .replace(/([?&])time=[^&#]*(&)?/gi, (_m, prefix: string, trailingAmp?: string) => {
      if (prefix === "?" && trailingAmp) return "?";
      if (prefix === "&" && trailingAmp) return "&";
      return "";
    })
    .replace(/[?&]+$/, "");
  return stripped;
}

export function buildAnitube22PlayerUrlFromParts(
  parts: { namePath: string; urlPath: string; imgUrl?: string | null },
  nowSeconds: number = Math.floor(Date.now() / 1000),
): string {
  const namePath = parts.namePath?.trim();
  const urlPath = parts.urlPath?.trim();
  if (!namePath || !urlPath) {
    throw new Error("Fonte anitube22 incompleta (name_path e url_path obrigatórios).");
  }

  const ts =
    Number.isFinite(nowSeconds) && nowSeconds > 0
      ? Math.floor(nowSeconds)
      : Math.floor(Date.now() / 1000);

  const queryParts = [
    `name=${namePath}`,
    `img=${parts.imgUrl?.trim() || ""}`,
    `pais=pais=BR`,
    `time=${ts}`,
    `url=${urlPath}`,
  ];

  return `${ANITUBE22_PLAYER_BASE}?${queryParts.join("&")}`;
}

export function sortEpisodeSourcesByPriority(
  sources: EpisodeSourceItem[],
  lang?: SourceLang,
): EpisodeSourceItem[] {
  return sources
    .filter(
      (s) =>
        s.status !== "broken" &&
        s.status !== "incomplete" &&
        (s.provider !== ANITUBE22_PROVIDER || (Boolean(s.namePath?.trim()) && Boolean(s.urlPath?.trim()))) &&
        (lang ? s.lang === lang : true),
    )
    .slice()
    .sort((a, b) => a.priority - b.priority);
}

export function partitionEpisodeSourcesByLang(sources: EpisodeSourceItem[]): {
  sub: EpisodeSourceItem[];
  dub: EpisodeSourceItem[];
} {
  return {
    sub: sortEpisodeSourcesByPriority(sources, "sub"),
    dub: sortEpisodeSourcesByPriority(sources, "dub"),
  };
}
