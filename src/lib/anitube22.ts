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

/**
 * Extrai o timestamp de expiração (ms) de uma URL assinada SigV4 (X-Amz-Date + X-Amz-Expires)
 * ou parâmetro numérico Expires. Retorna null quando não houver metadados de expiração.
 */
export function parseSignedUrlExpiresAtMs(rawUrl?: string | null): number | null {
  if (!rawUrl || typeof rawUrl !== "string") return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    const amzDate =
      parsed.searchParams.get("X-Amz-Date") ??
      parsed.searchParams.get("x-amz-date");
    const amzExpires =
      parsed.searchParams.get("X-Amz-Expires") ??
      parsed.searchParams.get("x-amz-expires");

    if (amzDate && amzExpires) {
      const expiresSec = Number.parseInt(amzExpires, 10);
      if (Number.isFinite(expiresSec) && expiresSec > 0) {
        const compactMatch = amzDate
          .trim()
          .match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/i);
        let baseMs = NaN;
        if (compactMatch) {
          baseMs = Date.UTC(
            Number(compactMatch[1]),
            Number(compactMatch[2]) - 1,
            Number(compactMatch[3]),
            Number(compactMatch[4]),
            Number(compactMatch[5]),
            Number(compactMatch[6]),
          );
        } else {
          baseMs = Date.parse(amzDate);
        }
        if (Number.isFinite(baseMs)) {
          return baseMs + expiresSec * 1000;
        }
      }
    }

    const legacyExpires = parsed.searchParams.get("Expires");
    if (legacyExpires && /^\d+$/.test(legacyExpires.trim())) {
      const expSec = Number.parseInt(legacyExpires.trim(), 10);
      if (Number.isFinite(expSec) && expSec > 0) {
        return expSec * 1000;
      }
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Extrai do HTML/JS do provedor (playerricas.php) a URL assinada do bucket R2 (X-Amz-Signature)
 * ou URL de playlist HLS (.m3u8). Ignora a própria URL do playerricas.php.
 */
export function extractSignedMediaUrlFromProviderHtml(
  body: string,
): { url: string; kind: "mp4" | "hls" } | null {
  if (!body || typeof body !== "string") return null;

  const normalized = body
    .replace(/\\\//g, "/")
    .replace(/\\u0026/gi, "&")
    .replace(/\\u002f/gi, "/")
    .replace(/\\u003d/gi, "=")
    .replace(/\\u003f/gi, "?")
    .replace(/&amp;/gi, "&")
    .replace(/&#0*38;/g, "&")
    .replace(/&#x0*26;/gi, "&");

  const urlRegex = /https?:\/\/[^\s"'`<>\\[\](){}]+/gi;
  const rawMatches = normalized.match(urlRegex) || [];

  const candidates: string[] = [];
  const seen = new Set<string>();

  for (const rawMatch of rawMatches) {
    const cleaned = rawMatch.replace(/[;,.)\]}]+$/, "");
    if (!cleaned || seen.has(cleaned)) continue;
    try {
      const parsed = new URL(cleaned);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") continue;
      if (parsed.pathname.toLowerCase().includes("playerricas.php")) continue;
      seen.add(cleaned);
      candidates.push(cleaned);
    } catch {
      // ignora fragmento inválido
    }
  }

  const isM3u8Candidate = (u: string): boolean => {
    try {
      const parsed = new URL(u);
      return (
        parsed.pathname.toLowerCase().endsWith(".m3u8") ||
        /\.m3u8(?:[?#&]|$)/i.test(u)
      );
    } catch {
      return /\.m3u8(?:[?#&]|$)/i.test(u);
    }
  };

  const signedCandidates = candidates.filter((u) =>
    /[?&]X-Amz-Signature=/i.test(u),
  );
  if (signedCandidates.length > 0) {
    const hlsSigned = signedCandidates.find(isM3u8Candidate);
    if (hlsSigned) {
      return { url: hlsSigned, kind: "hls" };
    }
    const r2Signed = signedCandidates.find((u) => {
      try {
        return new URL(u).hostname
          .toLowerCase()
          .endsWith("r2.cloudflarestorage.com");
      } catch {
        return false;
      }
    });
    return { url: r2Signed || signedCandidates[0], kind: "mp4" };
  }

  const hlsCandidate = candidates.find(isM3u8Candidate);
  if (hlsCandidate) {
    return { url: hlsCandidate, kind: "hls" };
  }

  return null;
}

