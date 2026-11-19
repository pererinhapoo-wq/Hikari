export const ANITUBE22_PROVIDER = "anitube22";
export const ANITUBE22_PLAYER_BASE = "https://www.anitube22.vip/playerricas.php";
export const ANITUBE22_THUMB_BASE = "https://www.hinatasoul.com/media/videos/tmb";
export const ANITUBE22_R2_BASE =
  "https://173fe263eae04670ecfcebf237fd6480.r2.cloudflarestorage.com/ziphonec";

export type SourceLang = "sub" | "dub";
export type SourceStatus = "active" | "broken";

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

/**
 * Extrai o ID numérico durável de fontes do provedor anitube22
 * a partir de ID numérico puro, referência canônica `anitube22://...`
 * ou URL legada (`playerricas.php?...`, R2 `ziphonec/{ID}.mp4`, thumbnail `hinatasoul`).
 */
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
  return extractAnitube22ExternalId(input) !== null;
}

export function isAnitube22PlayerUrl(url?: string | null): boolean {
  if (!url || typeof url !== "string") return false;
  const lower = url.trim().toLowerCase();
  return lower.includes("anitube22.vip/playerricas.php");
}

/**
 * Formata a referência durável sem assinatura e sem `time=` para persistência segura.
 */
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

/**
 * Remove qualquer parâmetro `time=` de URLs antes de gravar no banco.
 */
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

/**
 * Monta em runtime a URL completa do player `anitube22` a partir exclusivamente do ID numérico durável,
 * mantendo exatamente `pais=pais=BR` duplicado sem normalização e `time` em segundos Unix.
 */
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

/**
 * Filtra fontes ativas e ordena por prioridade crescente (menor número primeiro).
 * `sub` e `dub` são mantidos como listas independentes.
 */
export function sortEpisodeSourcesByPriority(
  sources: EpisodeSourceItem[],
  lang?: SourceLang,
): EpisodeSourceItem[] {
  return sources
    .filter((s) => s.status !== "broken" && (lang ? s.lang === lang : true))
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
