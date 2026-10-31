export type CoverSizeVariant = "thumb" | "card-sm" | "card-md" | "card-lg";

export interface ResponsiveCoverAttrs {
  src: string;
  srcSet?: string;
  sizes?: string;
  fallbackSrc?: string;
}

const ANILIST_COVER_REGEX =
  /^https:\/\/s4\.anilist\.co\/file\/anilistcdn\/media\/anime\/cover\/(large|medium)\/([^/?#]+)(\?[^#]*)?$/i;

const SIZES_BY_VARIANT: Record<CoverSizeVariant, string> = {
  thumb: "56px",
  "card-sm": "(min-width: 640px) 112px, 96px",
  "card-md":
    "(min-width: 1024px) 150px, (min-width: 768px) 142px, (min-width: 640px) 126px, 106px",
  "card-lg": "(min-width: 1024px) 176px, (min-width: 640px) 24vw, 46vw",
};

/**
 * Resolve versões menores oficiais do CDN do AniList para cards e miniaturas
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

  const match = cleanUrl.match(ANILIST_COVER_REGEX);
  if (!match) {
    return { src: cleanUrl };
  }

  const tier = match[1].toLowerCase();
  const filename = match[2];
  const query = match[3] ?? "";
  const base = "https://s4.anilist.co/file/anilistcdn/media/anime/cover";

  const smallUrl = `${base}/small/${filename}${query}`;
  const mediumUrl = `${base}/medium/${filename}${query}`;
  const largeUrl = tier === "large" ? `${base}/large/${filename}${query}` : null;

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
    srcSet: largeUrl ? `${mediumUrl} 230w, ${largeUrl} 460w` : undefined,
    sizes: largeUrl ? SIZES_BY_VARIANT[variant] : undefined,
    fallbackSrc: cleanUrl !== mediumUrl ? cleanUrl : undefined,
  };
}
