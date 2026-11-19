export const ANITUBE22_PROVIDER = "anitube22";
export const ANITUBE22_PLAYER_BASE = "https://www.anitube22.vip/playerricas.php";
export const ANITUBE22_THUMB_BASE = "https://www.hinatasoul.com/media/videos/tmb";
export const ANITUBE22_R2_BASE =
  "https://173fe263eae04670ecfcebf237fd6480.r2.cloudflarestorage.com/ziphonec";

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
  lang: SourceLang;
}

const BARE_NUMERIC_ID_RE = /^\d{3,16}$/;
const DURABLE_REF_RE = /^anitube22:(?:\/\/)?(?:(sub|dub)(?:\/|:))?(\d{1,16})(?:[/?#].*)?$/i;
const APPHD_MP4_RE = /apphd\/(\d+)\.mp4/i;
const ZIPHONEC_MP4_RE = /ziphonec\/(\d+)\.mp4/i;
const HINATASOUL_TMB_RE = /hinatasoul\.com\/media\/videos\/tmb\/(\d+)(?:\/|$)/i;

export function normalizeSourceLang(value?: string | null): SourceLang {
  if (!value) return "sub";
  const clean = value.trim().toLowerCase();
  if (clean === "dub" || clean === "dublado" || clean === "dubbed" || clean === "pt-br") {
    return "dub";
  }
  return "sub";
}

export function parseAnitube22PlayerUrl(rawUrl: string): Anitube22ParsedParts | null {
  if (!rawUrl || typeof rawUrl !== "string") return null;
  const trimmed = rawUrl.trim();
  try {
    const queryPart = trimmed.includes("?") ? trimmed.split("?")[1] : trimmed;
    const params = new URLSearchParams(queryPart);
    const name = params.get("name");
    const url = params.get("url");
    const img = params.get("img");
    if (!name || !url) return null;

    const extIdMatch = name.match(/(\d+)\.mp4/i);
    const externalId = extIdMatch?.[1] || extractAnitube22ExternalId(name) || "";
    if (!externalId) return null;

    return {
      externalId,
      namePath: name,
      urlPath: url,
      imgUrl: img || `${ANITUBE22_THUMB_BASE}/${externalId}/default.jpg`,
      lang: extractAnitube22Lang(trimmed),
    };
  } catch {
    return null;
  }
}

export function extractAnitube22ExternalId(input?: string | null): string | null {
  if (!input || typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (BARE_NUMERIC_ID_RE.test(trimmed)) {
    return trimmed;
  }

  const durableMatch = trimmed.match(DURABLE_REF_RE);
  if (durableMatch?.[2]) {
    return durableMatch[2];
  }

  const parsed = parseAnitube22PlayerUrl(trimmed);
  if (parsed?.externalId) {
    return parsed.externalId;
  }

  const lower = trimmed.toLowerCase();
  const looksLikeAnitubeContext =
    lower.includes("anitube22") ||
    lower.includes("playerricas.php") ||
    lower.includes("ziphonec/") ||
    lower.includes("hinatasoul.com/media/videos/tmb/");

  if (!looksLikeAnitubeContext) {
    return null;
  }

  const apphdMatch = trimmed.match(APPHD_MP4_RE);
  if (apphdMatch?.[1]) return apphdMatch[1];

  const ziphonecMatch = trimmed.match(ZIPHONEC_MP4_RE);
  if (ziphonecMatch?.[1]) return ziphonecMatch[1];

  const tmbMatch = trimmed.match(HINATASOUL_TMB_RE);
  if (tmbMatch?.[1]) return tmbMatch[1];

  const idParamMatch = trimmed.match(/(?:[?&]id=)(\d+)/i);
  if (idParamMatch?.[1]) return idParamMatch[1];

  return null;
}

export function extractAnitube22Lang(input?: string | null): SourceLang {
  if (!input || typeof input !== "string") return "sub";
  const trimmed = input.trim();
  const durableMatch = trimmed.match(DURABLE_REF_RE);
  if (durableMatch?.[1]) {
    return durableMatch[1].toLowerCase() === "dub" ? "dub" : "sub";
  }
  const paramMatch = trimmed.match(/[?&]lang=(sub|dub)\b/i);
  if (paramMatch?.[1]) {
    return paramMatch[1].toLowerCase() === "dub" ? "dub" : "sub";
  }
  return "sub";
}

export function isAnitube22SourceInput(input?: string | null): boolean {
  return parseAnitube22PlayerUrl(input || "") !== null || extractAnitube22ExternalId(input) !== null;
}

export function isAnitube22PlayerUrl(url?: string | null): boolean {
  if (!url || typeof url !== "string") return false;
  const lower = url.trim().toLowerCase();
  return lower.includes("anitube22.vip/playerricas.php");
}

export function formatDurableAnitube22Ref(
  externalId: string,
  lang: SourceLang = "sub",
): string {
  const cleanId = extractAnitube22ExternalId(externalId) ?? externalId.trim().replace(/[^0-9]/g, "");
  if (!cleanId) {
    throw new Error("Identificador externo inválido para anitube22.");
  }
  const safeLang = normalizeSourceLang(lang);
  return `anitube22://${safeLang}/${cleanId}`;
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
  parts: { namePath: string; urlPath: string; imgUrl: string },
  nowSeconds: number = Math.floor(Date.now() / 1000),
): string {
  const ts =
    Number.isFinite(nowSeconds) && nowSeconds > 0
      ? Math.floor(nowSeconds)
      : Math.floor(Date.now() / 1000);

  return (
    `${ANITUBE22_PLAYER_BASE}?name=${parts.namePath}` +
    `&img=${parts.imgUrl}` +
    `&pais=pais=BR` +
    `&time=${ts}` +
    `&url=${parts.urlPath}`
  );
}

export function buildAnitube22PlayerUrl(
  externalIdOrRef: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): string {
  const cleanId =
    extractAnitube22ExternalId(externalIdOrRef) ??
    externalIdOrRef.trim().replace(/[^0-9]/g, "");
  if (!cleanId) {
    throw new Error("Identificador numérico externo inválido para anitube22.");
  }
  const ts =
    Number.isFinite(nowSeconds) && nowSeconds > 0
      ? Math.floor(nowSeconds)
      : Math.floor(Date.now() / 1000);

  return (
    `${ANITUBE22_PLAYER_BASE}?name=apphd/${cleanId}.mp4` +
    `&img=${ANITUBE22_THUMB_BASE}/${cleanId}/default.jpg` +
    `&pais=pais=BR` +
    `&time=${ts}` +
    `&url=${ANITUBE22_R2_BASE}/${cleanId}.mp4`
  );
}

export function buildAnitube22ThumbUrl(externalIdOrRef: string): string | null {
  const cleanId = extractAnitube22ExternalId(externalIdOrRef);
  if (!cleanId) return null;
  return `${ANITUBE22_THUMB_BASE}/${cleanId}/default.jpg`;
}

export function sortEpisodeSourcesByPriority(
  sources: EpisodeSourceItem[],
  lang?: SourceLang,
): EpisodeSourceItem[] {
  return sources
    .filter((s) => s.status !== "broken" && s.status !== "incomplete" && (lang ? s.lang === lang : true))
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
