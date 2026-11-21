export const PLACEHOLDER_COVER_FALLBACK = "/assets/placeholder-cover.webp";

export function stripCatalogImageVersion(
  url: string | null | undefined,
): string {
  const cleanUrl = typeof url === "string" ? url.trim() : "";
  if (!cleanUrl) return "";
  const lower = cleanUrl.toLowerCase();
  if (lower.startsWith("data:") || lower.startsWith("blob:")) {
    return cleanUrl;
  }

  try {
    const isRelative = cleanUrl.startsWith("/");
    const parsed = isRelative
      ? new URL(cleanUrl, "http://hikari.local")
      : new URL(cleanUrl);
    if (!parsed.searchParams.has("hv")) {
      return cleanUrl;
    }
    parsed.searchParams.delete("hv");
    if (isRelative) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
    return parsed.toString();
  } catch {
    return cleanUrl;
  }
}

export function withCatalogImageVersion(
  url: string | null | undefined,
  versionMs?: number | null,
): string {
  const cleanUrl = stripCatalogImageVersion(url);
  if (!cleanUrl) return "";
  if (
    typeof versionMs !== "number" ||
    !Number.isFinite(versionMs) ||
    versionMs <= 0
  ) {
    return cleanUrl;
  }

  const lower = cleanUrl.toLowerCase();
  if (lower.startsWith("data:") || lower.startsWith("blob:")) {
    return cleanUrl;
  }

  try {
    const isRelative = cleanUrl.startsWith("/");
    const parsed = isRelative
      ? new URL(cleanUrl, "http://hikari.local")
      : new URL(cleanUrl);

    parsed.searchParams.set("hv", String(Math.floor(versionMs)));
    if (isRelative) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
    return parsed.toString();
  } catch {
    return cleanUrl;
  }
}

export function anilistImage(url: string | null | undefined, width: number): string {
  return optimizeImageUrl(url, width);
}

export function optimizeImageUrl(
  url: string | null | undefined,
  width: number,
  height?: number,
): string {
  const rawClean = stripCatalogImageVersion(url);
  if (!rawClean) {
    return PLACEHOLDER_COVER_FALLBACK;
  }

  const lower = rawClean.toLowerCase();
  if (
    rawClean.startsWith("/") ||
    lower.startsWith("data:") ||
    lower.startsWith("blob:") ||
    lower.startsWith("http://localhost") ||
    lower.startsWith("http://127.0.0.1")
  ) {
    return rawClean;
  }

  if (rawClean.includes("image.tmdb.org/t/p/")) {
    const targetWidth = width <= 300 ? "w300" : width <= 780 ? "w780" : "w1280";
    return rawClean.replace(/\/t\/p\/(?:original|w\d+)\//, `/t/p/${targetWidth}/`);
  }

  if (rawClean.includes("s4.anilist.co/file/anilistcdn/media/anime/cover/")) {
    const coverVariant = width < 200 ? "small" : width <= 250 ? "medium" : "large";
    return rawClean.replace(
      /\/cover\/(?:small|medium|large|extraLarge)\//,
      `/cover/${coverVariant}/`,
    );
  }

  const cloud = typeof process !== "undefined" && process.env?.VITE_CLOUDINARY_CLOU_NAME
    ? process.env.VITE_CLOUDINARY_CLOU_NAME.trim()
    : "";

  if (cloud && (rawClean.startsWith("https://") || rawClean.startsWith("http://"))) {
    const hStr = height ? `,h_${height}` : "";
    return `https://res.cloudinary.com/${cloud}/image/fetch/f_webp,q_72,c_fill,w_${width}${hStr}/${encodeURIComponent(rawClean)}`;
  }

  return rawClean;
}

export type CoverSizeVariant = "thumb" | "card-sm" | "card-md" | "card-lg";

export interface ResponsiveCoverAttrs {
  src: string;
  srcSet?: string;
  sizes?: string;
  fallbackSrc?: string;
  loading?: "lazy" | "eager";
  decoding?: "async" | "sync";
  fetchPriority?: "high" | "low" | "auto";
  draggable?: boolean;
}

const SIZES_BY_VARIANT: Record<CoverSizeVariant, string> = {
  thumb: "56px",
  "card-sm": "(min-width: 640px) 112px, 96px",
  "card-md":
    "(min-width: 1024px) 150px, (min-width: 768px) 142px, (min-width: 640px) 126px, 106px",
  "card-lg": "(min-width: 1024px) 176px, (min-width: 640px) 24vw, 46vw",
};

export function getResponsiveCoverAttrs(
  coverUrl: string | null | undefined,
  variant: CoverSizeVariant = "card-md",
  isLcp = false,
): ResponsiveCoverAttrs {
  const clean = stripCatalogImageVersion(coverUrl);
  if (!clean) {
    return {
      src: PLACEHOLDER_COVER_FALLBACK,
      loading: isLcp ? "eager" : "lazy",
      decoding: isLcp ? "sync" : "async",
      fetchPriority: isLcp ? "high" : "low",
      draggable: false,
    };
  }

  const optimized = optimizeImageUrl(clean, 230, 345);
  return {
    src: optimized,
    sizes: SIZES_BY_VARIANT[variant],
    loading: isLcp ? "eager" : "lazy",
    decoding: isLcp ? "sync" : "async",
    fetchPriority: isLcp ? "high" : "low",
    draggable: false,
  };
}
