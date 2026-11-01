export type CoverSizeVariant = "thumb" | "card-sm" | "card-md" | "card-lg";

export interface ResponsiveCoverAttrs {
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

  // Tratamento otimizado para capas do AniList
  const aniMatch = cleanUrl.match(ANILIST_COVER_REGEX);
  if (aniMatch) {
    const filename = aniMatch[2];
    const query = aniMatch[3] ?? "";
    const base = "https://s4.anilist.co/file/anilistcdn/media/anime/cover";

    const smallUrl = `${base}/small/${filename}${query}`;
    const mediumUrl = `${base}/medium/${filename}${query}`;
    const largeUrl = `${base}/large/${filename}${query}`;

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

    const smallUrl = `${base}/${id}/small.${ext}${query}`;
    const mediumUrl = `${base}/${id}/medium.${ext}${query}`;
    const largeUrl = `${base}/${id}/large.${ext}${query}`;

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

  return { src: cleanUrl };
}
