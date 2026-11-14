function getCloudinaryCloud(): string {
  const fromProcess =
    typeof process !== "undefined"
      ? process.env?.NEXT_PUBLIC_CLOUDINARY_CLOUD ||
        process.env?.VITE_CLOUDINARY_CLOUD_NAME ||
        ""
      : "";
  if (fromProcess && fromProcess.trim()) {
    return fromProcess.trim();
  }
  const fromMeta =
    typeof import.meta !== "undefined"
      ? (import.meta.env?.NEXT_PUBLIC_CLOUDINARY_CLOUD as string | undefined) ||
        (import.meta.env?.VITE_CLOUDINARY_CLOUD_NAME as string | undefined) ||
        ""
      : "";
  return fromMeta ? fromMeta.trim() : "";
}

const IMMUTABLE_CDN_HOSTS = [
  "s4.anilist.co",
  "media.kitsu.app",
  "media.kitsu.io",
  "cdn.myanimelist.net",
  "public.blob.vercel-storage.com",
];

function isImmutableImageCdn(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  return IMMUTABLE_CDN_HOSTS.some(
    (allowed) => host === allowed || host.endsWith(`.${allowed}`),
  );
}

function hasSignedQueryParams(url: URL): boolean {
  for (const key of url.searchParams.keys()) {
    const lower = key.toLowerCase();
    if (
      lower.startsWith("x-amz-") ||
      lower === "signature" ||
      lower === "googleaccessid" ||
      lower === "expires" ||
      lower === "policy" ||
      lower === "key-pair-id" ||
      lower === "sig" ||
      lower === "sv" ||
      lower === "se" ||
      lower === "sp" ||
      lower === "token"
    ) {
      return true;
    }
  }
  return false;
}

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
  const cleanUrl = typeof url === "string" ? url.trim() : "";
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

    if (!isRelative && isImmutableImageCdn(parsed)) {
      return cleanUrl;
    }
    if (hasSignedQueryParams(parsed)) {
      return cleanUrl;
    }

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
  const cleanUrl = typeof url === "string" ? url.trim() : "";
  if (!cleanUrl) return "";
  const cloud = getCloudinaryCloud();
  if (
    cloud &&
    (cleanUrl.startsWith("https://") || cleanUrl.startsWith("http://")) &&
    !cleanUrl.includes("res.cloudinary.com/")
  ) {
    return `https://res.cloudinary.com/${cloud}/image/fetch/f_auto,q_auto:good,c_limit,w_${width}/${encodeURIComponent(cleanUrl)}`;
  }
  return cleanUrl;
}

export type CoverSizeVariant = "thumb" | "card-sm" | "card-md" | "card-lg";

export interface ResponsiveCoverAttrs {
  graphicUrl?: string;
  src: string;
  srcSet?: string;
  sizes?: string;
  fallbackSrc?: string;
}

const ANILIST_COVER_REGEX =
  /^https:\/\/s4\.anilist\.co\/file\/anilistcdn\/media\/anime\/cover\/(large|medium|small|extraLarge)\/([^/?#]+)(\?[^#]*)?$/i;

const KITSU_POSTER_REGEX =
  /^https:\/\/media\.kitsu\.(?:app|io)\/anime\/poster_images\/(\d+)\/(large|medium|small|tiny|original)\.([a-z0-9]+)(\?[^#]*)?$/i;

const SIZES_BY_VARIANT: Record<CoverSizeVariant, string> = {
  thumb: "56px",
  "card-sm": "(min-width: 640px) 112px, 96px",
  "card-md":
    "(min-width: 1024px) 150px, (min-width: 768px) 142px, (min-width: 640px) 126px, 106px",
  "card-lg": "(min-width: 1024px) 176px, (min-width: 640px) 24vw, 46vw",
};

/**
 * Resolve versões menores oficiais do CDN do AniList e Kitsu para cards e miniaturas
 * sem modificar a URL original armazenada nos dados do anime.
 */
export function getResponsiveCoverAttrs(
  coverUrl: string | null | undefined,
  variant: CoverSizeVariant = "card-md",
): ResponsiveCoverAttrs {
  const cleanUrl = typeof coverUrl === "string" ? coverUrl.trim() : "";
  if (!cleanUrl) {
    return { src: "" };
  }

  const hasCloud = Boolean(getCloudinaryCloud());

  // Tratamento otimizado para capas do AniList
  const aniMatch = cleanUrl.match(ANILIST_COVER_REGEX);
  if (aniMatch) {
    const filename = aniMatch[2];
    const query = aniMatch[3] ?? "";
    const base = "https://s4.anilist.co/file/anilistcdn/media/anime/cover";

    const smallUrl = hasCloud ? anilistImage(cleanUrl, 100) : `${base}/small/${filename}${query}`;
    const mediumUrl = hasCloud ? anilistImage(cleanUrl, 230) : `${base}/medium/${filename}${query}`;
    const largeUrl = hasCloud ? anilistImage(cleanUrl, 460) : `${base}/large/${filename}${query}`;

    if (variant === "thumb") {
      return {
        src: smallUrl,
        srcSet: `${smallUrl} 100w, ${mediumUrl} 230w`,
        sizes: SIZES_BY_VARIANT.thumb,
        fallbackSrc: cleanUrl,
      };
    }

    return {
      src: mediumUrl,
      srcSet: `${mediumUrl} 230w, ${largeUrl} 460w`,
      sizes: SIZES_BY_VARIANT[variant],
      fallbackSrc: cleanUrl !== mediumUrl ? cleanUrl : undefined,
    };
  }

  // Tratamento otimizado para pôsteres do Kitsu
  const kitsuMatch = cleanUrl.match(KITSU_POSTER_REGEX);
  if (kitsuMatch) {
    const id = kitsuMatch[1];
    const ext = kitsuMatch[3];
    const query = kitsuMatch[4] ?? "";
    const base = "https://media.kitsu.app/anime/poster_images";

    const smallUrl = hasCloud ? anilistImage(cleanUrl, 110) : `${base}/${id}/small.${ext}${query}`;
    const mediumUrl = hasCloud ? anilistImage(cleanUrl, 220) : `${base}/${id}/medium.${ext}${query}`;
    const largeUrl = hasCloud ? anilistImage(cleanUrl, 550) : `${base}/${id}/large.${ext}${query}`;

    if (variant === "thumb") {
      return {
        src: smallUrl,
        srcSet: `${smallUrl} 110w, ${mediumUrl} 220w`,
        sizes: SIZES_BY_VARIANT.thumb,
        fallbackSrc: cleanUrl,
      };
    }

    return {
      src: mediumUrl,
      srcSet: `${mediumUrl} 220w, ${largeUrl} 550w`,
      sizes: SIZES_BY_VARIANT[variant],
      fallbackSrc: cleanUrl !== mediumUrl ? cleanUrl : undefined,
    };
  }

  return { src: hasCloud ? anilistImage(cleanUrl, 460) : cleanUrl };
}
