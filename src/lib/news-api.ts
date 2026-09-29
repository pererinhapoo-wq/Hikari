import { createServerFn } from "@tanstack/react-start";

import {
  currentAnimeSeason,
  stripHtml,
} from "@/lib/utils";

export type AutomaticNewsItem = {
  id: string;
  type:
    | "NOVA TEMPORADA"
    | "TRAILER"
    | "NOVO EPISÓDIO"
    | "PRÓXIMO LANÇAMENTO"
    | "DESTAQUE"
    | "NOVO HENTAI"
    | "ANÚNCIO"
    | "RUMOR"
    | "NOVO VISUAL"
    | "DATA DE ESTREIA"
    | "ELENCO"
    | "NOTÍCIA";
  title: string;
  description: string;
  date: string;
  image: string;
  animeId: string;
  trailerUrl?: string;
  isAdult?: boolean;
  source?: string;
  sourceUrl?: string;
  publishedAt?: string;
  articleImages?: string[];
  isRumor?: boolean;
};

const ANILIST =
  "https://graphql.anilist.co";

type AniMedia = {
  id: number;
  isAdult?: boolean | null;

  title?: {
    romaji?: string | null;
    english?: string | null;
    native?: string | null;
  } | null;

  coverImage?: {
    extraLarge?: string | null;
    large?: string | null;
  } | null;

  description?: string | null;

  format?: string | null;
  status?: string | null;
  episodes?: number | null;
  score?: number | null;
  popularity?: number | null;
  season?: string | null;
  seasonYear?: number | null;

  startDate?: {
    year?: number | null;
    month?: number | null;
    day?: number | null;
  } | null;

  trailer?: {
    id?: string | null;
    site?: string | null;
    thumbnail?: string | null;
  } | null;
};

type AniListResponse = {
  Page: {
    media: AniMedia[];
  };
};

type AiringScheduleItem = {
  id?: number | null;
  mediaId?: number | null;
  episode?: number | null;
  airingAt?: number | null;
};

type AiringScheduleResponse = {
  Page: {
    airingSchedules: AiringScheduleItem[];
  };
};

const cache = new Map<
  string,
  {
    at: number;
    data: AutomaticNewsItem[];
  }
>();

const translationCache =
  new Map<
    string,
    string
  >();

const TTL =
  10 * 60 * 1000;

function fromCache(
  key: string,
): AutomaticNewsItem[] | null {
  const hit =
    cache.get(key);

  if (!hit) {
    return null;
  }

  if (
    Date.now() - hit.at >
    TTL
  ) {
    cache.delete(key);

    return null;
  }

  return hit.data;
}

function toCache(
  key: string,
  data: AutomaticNewsItem[],
): AutomaticNewsItem[] {
  cache.set(key, {
    at: Date.now(),
    data,
  });

  return data;
}

function formatDate(
  media: AniMedia,
): string {
  const date =
    media.startDate;

  if (
    !date?.year ||
    !date.month ||
    !date.day
  ) {
    return `${
      media.seasonYear ??
      "2026"
    }`;
  }

  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    },
  ).format(
    new Date(
      date.year,
      date.month - 1,
      date.day,
    ),
  );
}

function formatAiringDate(
  airingAt: number,
): string {
  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    },
  ).format(
    new Date(
      airingAt * 1000,
    ),
  );
}

function titleOf(
  media: AniMedia,
): string {
  // O nome do anime nunca deve cair para "native",
  // pois isso pode retornar caracteres japoneses.
  // A prioridade é sempre:
  // 1. Inglês
  // 2. Romaji
  // 3. "Anime" como último recurso
  return (
    media.title?.english?.trim() ||
    media.title?.romaji?.trim() ||
    "Anime"
  );
}

function cleanDescription(
  value:
    | string
    | null
    | undefined,
): string {
  return stripHtml(
    value,
  ).trim();
}

async function translateToPortuguese(
  text: string,
): Promise<string> {
  const cleaned = text.trim();

  if (!cleaned) {
    return "";
  }

  const cached = translationCache.get(cleaned);
  if (cached) {
    return cached;
  }

  // Primeiro tenta MyMemory. É uma API pública simples e não exige chave
  // para esse uso; se falhar, tenta o endpoint do Google.
  try {
    const myMemoryUrl =
      "https://api.mymemory.translated.net/get" +
      `?q=${encodeURIComponent(cleaned.slice(0, 4500))}` +
      "&langpair=en|pt-BR";

    const response = await fetch(myMemoryUrl, {
      signal: AbortSignal.timeout(8000),
      headers: {
        Accept: "application/json",
        "User-Agent": "Hikari/1.0 (anime news)",
      },
    });

    if (response.ok) {
      const json = (await response.json()) as {
        responseData?: {
          translatedText?: string;
        };
      };

      const translated =
        json.responseData?.translatedText?.trim() || "";

      if (
        translated &&
        translated.toLowerCase() !== cleaned.toLowerCase()
      ) {
        translationCache.set(cleaned, translated);
        return translated;
      }
    }
  } catch {
    // Tenta o segundo provedor abaixo.
  }

  try {
    const url =
      "https://translate.googleapis.com/translate_a/single" +
      "?client=gtx" +
      "&sl=auto" +
      "&tl=pt" +
      "&dt=t" +
      `&q=${encodeURIComponent(cleaned.slice(0, 5000))}`;

    const response = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: {
        Accept: "application/json",
        "User-Agent": "Hikari/1.0 (anime news)",
      },
    });

    if (response.ok) {
      const json = (await response.json()) as unknown;

      if (
        Array.isArray(json) &&
        Array.isArray(json[0])
      ) {
        const translated =
          json[0]
            .filter(
              (part) =>
                Array.isArray(part) &&
                typeof part[0] === "string",
            )
            .map((part) => part[0] as string)
            .join("")
            .trim();

        if (translated) {
          translationCache.set(cleaned, translated);
          return translated;
        }
      }
    }
  } catch {
    // Usa o fallback seguro abaixo.
  }

  return "";
}

async function translateNewsTitle(
  title: string,
  animeName: string,
): Promise<string> {
  const cleanedTitle = title.trim();
  const cleanAnimeName = animeName.trim();

  if (!cleanedTitle) {
    return "";
  }

  if (!cleanAnimeName) {
    const translated = await translateToPortuguese(cleanedTitle);
    return translated || cleanedTitle;
  }

  // Protege o nome oficial do anime para traduzir somente o restante.
  const token = "__HIKARI_ANIME_NAME__";
  const escaped = cleanAnimeName.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );

  const protectedTitle = cleanedTitle.replace(
    new RegExp(escaped, "ig"),
    token,
  );

  const translated = await translateToPortuguese(protectedTitle);

  if (!translated) {
    // Nunca mostra mensagem de erro como título.
    return cleanedTitle;
  }

  return translated
    .replace(new RegExp(token, "g"), cleanAnimeName)
    .replace(/\s+/g, " ")
    .trim();
}

async function descriptionOf(
  media: AniMedia,
): Promise<string> {
  const description =
    cleanDescription(
      media.description,
    );

  if (!description) {
    return `${titleOf(
      media,
    )} faz parte da programação da temporada de ${(
      media.season ?? ""
    ).toLowerCase()} de ${
      media.seasonYear ?? ""
    }.`;
  }

  const translated = await translateToPortuguese(description);

  return (
    translated ||
    `${titleOf(media)} — descrição da notícia em português indisponível no momento.`
  );
}

function trailerOf(
  media: AniMedia,
): string | undefined {
  const trailer =
    media.trailer;

  if (
    !trailer?.id ||
    trailer.site !==
      "youtube"
  ) {
    return undefined;
  }

  return `https://www.youtube.com/embed/${trailer.id}`;
}

async function fetchLatestAiredEpisodes(): Promise<
  Map<
    number,
    {
      episode: number;
      airingAt: number;
    }
  >
> {
  const result =
    new Map<
      number,
      {
        episode: number;
        airingAt: number;
      }
    >();

  try {
    const response =
      await fetch(
        ANILIST,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            Accept:
              "application/json",
          },

          body: JSON.stringify({
            query: `
              query LatestAiredEpisodes {
                Page(
                  page: 1
                  perPage: 50
                ) {
                  airingSchedules(
                    notYetAired: false
                    sort: TIME_DESC
                  ) {
                    id
                    mediaId
                    episode
                    airingAt
                  }
                }
              }
            `,
          }),

          signal:
            AbortSignal.timeout(
              12000,
            ),
        },
      );

    if (!response.ok) {
      return result;
    }

    const json =
      (await response.json()) as {
        data?: AiringScheduleResponse;

        errors?: {
          message?: string;
        }[];
      };

    if (
      json.errors?.length ||
      !json.data?.Page
    ) {
      return result;
    }

    for (const item of
      json.data.Page
        .airingSchedules ?? []) {
      if (
        typeof item.mediaId !==
          "number" ||
        typeof item.episode !==
          "number" ||
        typeof item.airingAt !==
          "number"
      ) {
        continue;
      }

      if (
        item.episode <= 0 ||
        item.airingAt * 1000 >
          Date.now()
      ) {
        continue;
      }

      if (
        !result.has(
          item.mediaId,
        )
      ) {
        result.set(
          item.mediaId,
          {
            episode:
              item.episode,

            airingAt:
              item.airingAt,
          },
        );
      }
    }
  } catch {
    return result;
  }

  return result;
}

async function fetchSeason(
  season: string,
  year: number,
): Promise<AniMedia[]> {
  const response =
    await fetch(
      ANILIST,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          Accept:
            "application/json",
        },

        body: JSON.stringify({
          query: `
            query AutomaticNews(
              $season: MediaSeason
              $year: Int
            ) {
              Page(
                page: 1
                perPage: 50
              ) {
                media(
                  type: ANIME
                  season: $season
                  seasonYear: $year
                  sort: START_DATE_DESC
                ) {
                  id
                  isAdult

                  title {
                    romaji
                    english
                    native
                  }

                  coverImage {
                    extraLarge
                    large
                  }

                  description(
                    asHtml: false
                  )

                  format
                  status
                  episodes
                  season
                  seasonYear

                  startDate {
                    year
                    month
                    day
                  }

                  trailer {
                    id
                    site
                    thumbnail
                  }
                }
              }
            }
          `,

          variables: {
            season:
              season.toUpperCase(),

            year,
          },
        }),

        signal:
          AbortSignal.timeout(
            12000,
          ),
      },
    );

  if (!response.ok) {
    throw new Error(
      `AniList indisponível (${response.status})`,
    );
  }

  const json =
    (await response.json()) as {
      data?: AniListResponse;

      errors?: {
        message?: string;
      }[];
    };

  if (
    json.errors?.length ||
    !json.data?.Page
  ) {
    throw new Error(
      json.errors?.[0]
        ?.message ??
        "AniList sem dados",
    );
  }

  return json.data.Page.media;
}

async function fetchAdultCatalogNews(): Promise<
  AniMedia[]
> {
  const response =
    await fetch(
      ANILIST,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          Accept:
            "application/json",
        },

        body: JSON.stringify({
          query: `
            query AdultNews {
              trending: Page(
                page: 1
                perPage: 50
              ) {
                media(
                  type: ANIME
                  isAdult: true
                  sort: TRENDING_DESC
                ) {
                  id
                  isAdult
                  score
                  popularity

                  title {
                    romaji
                    english
                    native
                  }

                  coverImage {
                    extraLarge
                    large
                  }

                  description(
                    asHtml: false
                  )

                  format
                  status
                  episodes
                  season
                  seasonYear

                  startDate {
                    year
                    month
                    day
                  }

                  trailer {
                    id
                    site
                    thumbnail
                  }
                }
              }

              upcoming: Page(
                page: 1
                perPage: 50
              ) {
                media(
                  type: ANIME
                  isAdult: true
                  status: NOT_YET_RELEASED
                  sort: START_DATE_DESC
                ) {
                  id
                  isAdult
                  score
                  popularity

                  title {
                    romaji
                    english
                    native
                  }

                  coverImage {
                    extraLarge
                    large
                  }

                  description(
                    asHtml: false
                  )

                  format
                  status
                  episodes
                  season
                  seasonYear

                  startDate {
                    year
                    month
                    day
                  }

                  trailer {
                    id
                    site
                    thumbnail
                  }
                }
              }

              topRated: Page(
                page: 1
                perPage: 50
              ) {
                media(
                  type: ANIME
                  isAdult: true
                  sort: SCORE_DESC
                ) {
                  id
                  isAdult
                  score
                  popularity

                  title {
                    romaji
                    english
                    native
                  }

                  coverImage {
                    extraLarge
                    large
                  }

                  description(
                    asHtml: false
                  )

                  format
                  status
                  episodes
                  season
                  seasonYear

                  startDate {
                    year
                    month
                    day
                  }

                  trailer {
                    id
                    site
                    thumbnail
                  }
                }
              }
            }
          `,
        }),

        signal:
          AbortSignal.timeout(
            12000,
          ),
      },
    );

  if (!response.ok) {
    throw new Error(
      `AniList indisponível (${response.status})`,
    );
  }

  const json =
    (await response.json()) as {
      data?: {
        trending?: { media: AniMedia[] };
        upcoming?: { media: AniMedia[] };
        topRated?: { media: AniMedia[] };
      };

      errors?: {
        message?: string;
      }[];
    };

  if (
    json.errors?.length ||
    !json.data
  ) {
    throw new Error(
      json.errors?.[0]
        ?.message ??
        "AniList sem dados",
    );
  }

  const trending =
    json.data.trending?.media ?? [];
  const upcoming =
    json.data.upcoming?.media ?? [];
  const topRated =
    json.data.topRated?.media ?? [];

  const selected = new Map<
    number,
    AniMedia
  >();

  for (const anime of [
    ...trending.slice(0, 24),
    ...upcoming.slice(0, 24),
    ...topRated.slice(0, 24),
  ]) {
    if (
      anime.isAdult === true &&
      anime.id > 0 &&
      anime.format !== "MUSIC"
    ) {
      selected.set(
        anime.id,
        anime,
      );
    }
  }

  return Array.from(
    selected.values(),
  );
}

type ExternalNewsItem = {
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  url: string;
  image: string;
  articleImages: string[];
  source: string;
  type: AutomaticNewsItem["type"];
  isRumor: boolean;
  animeId: string;
  trailerUrl?: string;
};

const EXTERNAL_NEWS_FEEDS = [
  {
    name: "Anime Corner",
    url: "https://animecorner.me/category/anime-news/feed/",
  },
] as const;

function xmlDecode(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#039;|&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function xmlTag(
  block: string,
  name: string,
): string {
  const match = block.match(
    new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, "i"),
  );

  return xmlDecode(match?.[1]?.trim() ?? "");
}

function xmlAttribute(
  block: string,
  tag: string,
  attribute: string,
): string {
  const match = block.match(
    new RegExp(`<${tag}\\b[^>]*\\b${attribute}=["']([^"']+)["'][^>]*>`, "i"),
  );

  return xmlDecode(match?.[1]?.trim() ?? "");
}

function absoluteUrl(
  value: string,
  baseUrl: string,
): string {
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return "";
  }
}

function stripMarkup(value: string): string {
  return stripHtml(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

function imageFromHtml(
  html: string,
  baseUrl: string,
): string {
  const og = html.match(
    /<meta[^>]+(?:property|name)=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
  );

  if (og?.[1]) {
    return absoluteUrl(og[1], baseUrl);
  }

  const reverseOg = html.match(
    /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']og:image["'][^>]*>/i,
  );

  return reverseOg?.[1]
    ? absoluteUrl(reverseOg[1], baseUrl)
    : "";
}

function imagesFromHtml(
  html: string,
  baseUrl: string,
): string[] {
  const images = new Set<string>();
  const pattern = /<img\b[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) && images.size < 8) {
    const url = absoluteUrl(match[1], baseUrl);
    if (url && !url.startsWith("data:")) {
      images.add(url);
    }
  }

  return Array.from(images);
}

function isGameNews(
  title: string,
  content: string,
  url: string,
): boolean {
  const normalized = `${title} ${content} ${url}`.toLowerCase();

  return /\\b(video game|video games|gaming|gameplay|game trailer|game pv|game announcement|game release|mobile game|gacha game|console game|pc game|playstation|xbox|nintendo|steam|switch|ps4|ps5|xbox series|xbox one|rpg game|action game|fighting game|visual novel game|smartphone game)\\b/i.test(
    normalized,
  ) || /(?:^|[\\s:/_-])game(?:$|[\\s:/_-])/i.test(normalized);
}

function typeFromExternalNews(
  title: string,
): {
  type: AutomaticNewsItem["type"];
  isRumor: boolean;
} {
  const normalized = title.toLowerCase();

  const isRumor =
    /\b(rumou?r|rumor|leak|leaked|scoop|according to leaks|reportedly|allegedly)\b/i.test(
      normalized,
    );

  if (isRumor) {
    return {
      type: "RUMOR",
      isRumor: true,
    };
  }

  if (/\b(trailer|pv|teaser|promo|promotional video|cm)\b/i.test(normalized)) {
    return { type: "TRAILER", isRumor: false };
  }

  if (/\b(new season|season [0-9ivx]+|season [0-9ivx]+ announced|sequel|second season|third season|fourth season|returning)\b/i.test(normalized)) {
    return { type: "NOVA TEMPORADA", isRumor: false };
  }

  if (/\b(key visual|new visual|visual revealed|poster|artwork|illustration)\b/i.test(normalized)) {
    return { type: "NOVO VISUAL", isRumor: false };
  }

  if (/\b(release date|premiere date|premieres|premiere|debut|starts? airing|air date)\b/i.test(normalized)) {
    return { type: "DATA DE ESTREIA", isRumor: false };
  }

  if (/\b(cast|staff|voice actor|voice actress|additional cast|additional staff)\b/i.test(normalized)) {
    return { type: "ELENCO", isRumor: false };
  }

  if (/\b(anime adaptation|anime announced|gets an anime|anime project|anime series announced|adaptation announced)\b/i.test(normalized)) {
    return { type: "ANÚNCIO", isRumor: false };
  }

  return { type: "NOTÍCIA", isRumor: false };
}

function formatExternalDate(
  iso: string,
): string {
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) {
    return "";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(timestamp));
}

async function fetchExternalFeed(
  feed: (typeof EXTERNAL_NEWS_FEEDS)[number],
): Promise<ExternalNewsItem[]> {
  const response = await fetch(feed.url, {
    cache: "no-store",
    headers: {
      Accept: "application/rss+xml, application/xml, text/xml",
      "User-Agent": "Hikari/1.0 (anime news)",
    },
    signal: AbortSignal.timeout(12000),
  });

  if (!response.ok) {
    throw new Error(`${feed.name} indisponível (${response.status})`);
  }

  const xml = await response.text();
  const blocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];

  const parsed = blocks.slice(0, 50).map((block): ExternalNewsItem | null => {
    const url =
      xmlTag(block, "link") ||
      xmlAttribute(block, "guid", "isPermaLink");
    const title = xmlTag(block, "title");
    const publishedAt =
      xmlTag(block, "pubDate") ||
      xmlTag(block, "dc:date") ||
      xmlTag(block, "published") ||
      xmlTag(block, "updated");

    if (!title || !url || !publishedAt) {
      return null;
    }

    const content =
      xmlTag(block, "content:encoded") ||
      xmlTag(block, "description") ||
      "";

    const image =
      xmlAttribute(block, "media:content", "url") ||
      xmlAttribute(block, "media:thumbnail", "url") ||
      xmlAttribute(block, "enclosure", "url") ||
      imageFromHtml(content, url);

    if (isGameNews(title, content, url)) {
      return null;
    }

    const articleImages = imagesFromHtml(content, url);
    const classified = typeFromExternalNews(title);

    return {
      id: `external-${encodeURIComponent(url)}`,
      title,
      description: stripMarkup(content).slice(0, 700),
      publishedAt: new Date(publishedAt).toISOString(),
      url,
      image: image || articleImages[0] || "",
      articleImages,
      source: feed.name,
      type: classified.type,
      isRumor: classified.isRumor,
      animeId: "",
    };
  }).filter(Boolean) as ExternalNewsItem[];

  const enriched = await Promise.all(
    parsed.map(async (item) => {
      try {
        const response = await fetch(item.url, {
          headers: {
            Accept: "text/html,application/xhtml+xml",
            "User-Agent": "Hikari/1.0 (anime news)",
          },
          signal: AbortSignal.timeout(8000),
        });

        if (response.ok) {
          const html = await response.text();
          item.image =
            imageFromHtml(html, item.url) || item.image;
          item.articleImages = Array.from(
            new Set([
              ...item.articleImages,
              ...imagesFromHtml(html, item.url),
            ]),
          ).slice(0, 8);

          const pageDescription =
            html.match(
              /<meta[^>]+(?:property|name)=["'](?:og:description|description)["'][^>]+content=["']([^"']+)["'][^>]*>/i,
            )?.[1] ?? "";

          if (pageDescription) {
            item.description = stripMarkup(pageDescription).slice(0, 700);
          }
        }
      } catch {
        // Mantém o item do RSS mesmo se a página original falhar.
      }

      const animeName = await findAniListAnimeName(item.title);
      const animeId = await findAniListAnimeId(item.title);

      if (animeName) {
        item.title = await translateNewsTitle(
          item.title,
          animeName,
        );
      } else {
        const translatedTitle =
          await translateToPortuguese(item.title);

        item.title =
          translatedTitle || item.title;
      }

      item.animeId = animeId;

      if (item.type === "TRAILER" && item.url.includes("youtube.com")) {
        item.trailerUrl = item.url;
      }

      return item;
    }),
  );

  return enriched;
}

const aniListSearchCache = new Map<string, string>();

const aniListAnimeNameCache = new Map<string, string>();

function extractAnimeNameFallback(newsTitle: string): string {
  let value = newsTitle
    .replace(/\s+/g, " ")
    .trim();

  // Remove common article suffixes while preserving the franchise name.
  value = value
    .replace(/\s+(?:anime|manga)\s+(?:reveals?|announces?|announced|gets|receives?|confirms?|confirmed)\b[\s\S]*$/i, "")
    .replace(/\s+(?:gets|receives?|announces?|announced|reveals?|revealed|confirms?|confirmed)\s+(?:an|a)\s+anime\b[\s\S]*$/i, "")
    .replace(/\s+first\s+theatrical\s+anime\s+film\s+project\s+announced[\s\S]*$/i, "")
    .replace(/\s+first\s+theatrical\s+anime\s+film\s+project\b[\s\S]*$/i, "")
    .replace(/\s+(?:season|cour)\s+[0-9ivx]+\b[\s\S]*$/i, "")
    .replace(/\s+(?:reveals?|revealed|announces?|announced|gets|receives?|confirms?|confirmed)\b[\s\S]*$/i, "")
    .trim();

  // Strip a trailing article descriptor if the previous rules left one.
  value = value
    .replace(/\s+(?:anime|manga)\s*$/i, "")
    .trim();

  // Avoid returning a generic fragment.
  if (value.length < 3 || /^(anime|manga|season|cour)$/i.test(value)) {
    return "";
  }

  return value;
}

async function findAniListAnimeName(
  newsTitle: string,
): Promise<string> {
  // Tenta várias formas do título original. Remover palavras demais antes
  // da busca fazia alguns títulos não encontrarem o anime no AniList; quando
  // isso acontecia, o tradutor acabava traduzindo o nome do anime também.
  const original = newsTitle
    .replace(/\s+/g, " ")
    .trim();

  const candidates = Array.from(
    new Set(
      [
        original,
        original
          .replace(
            /\b(reveals?|revealed|announces?|announced|gets|receives?|reveals?|confirms?|confirmed)\b[\s\S]*$/i,
            "",
          )
          .replace(/\s+/g, " ")
          .trim(),
        original
          .replace(
            /\b(first|new|official)\s+(trailer|teaser|visual|key visual|poster|pv)\b[\s\S]*$/i,
            "",
          )
          .replace(/\s+/g, " ")
          .trim(),
        original
          .replace(
            /\b(anime|manga)\s+(reveals?|announces?|announced|gets|receives?|confirms?|confirmed)\b[\s\S]*$/i,
            "",
          )
          .replace(/\s+/g, " ")
          .trim(),
      ].filter((value) => value.length >= 3),
    ),
  );

  for (const candidate of candidates) {
    const key = candidate.toLowerCase();
    const cached = aniListAnimeNameCache.get(key);
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch(ANILIST, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          query: `
            query FindAnimeName($search: String) {
              Page(page: 1, perPage: 5) {
                media(type: ANIME, search: $search, sort: SEARCH_MATCH) {
                  id
                  isAdult
                  title {
                    english
                    romaji
                  }
                }
              }
            }
          `,
          variables: { search: candidate.slice(0, 120) },
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) {
        continue;
      }

      const json = (await response.json()) as {
        data?: {
          Page?: {
            media?: {
              id: number;
              isAdult?: boolean | null;
              title?: {
                english?: string | null;
                romaji?: string | null;
              } | null;
            }[];
          };
        };
      };

      const media =
        json.data?.Page?.media ?? [];

      const match =
        media.find(
          (item) => item.isAdult !== true,
        ) ?? media[0];

      const animeName =
        match?.title?.english?.trim() ||
        match?.title?.romaji?.trim() ||
        "";

      if (animeName) {
        // Cacheia todas as formas testadas para evitar novas consultas.
        for (const value of candidates) {
          aniListAnimeNameCache.set(
            value.toLowerCase(),
            animeName,
          );
        }
        return animeName;
      }
    } catch {
      // Tenta a próxima forma do título.
    }
  }

  // If AniList is unavailable or does not match the title, keep a likely
  // franchise name instead of translating the anime name into Portuguese.
  return extractAnimeNameFallback(original);
}

async function findAniListAnimeId(
  newsTitle: string,
): Promise<string> {
  const cleaned = newsTitle
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b(new trailer|trailer|teaser|pv|visual|key visual|announced|revealed|season [0-9ivx]+|premiere date|release date)\b/gi, " ")
    .replace(/[:|—–-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned || cleaned.length < 3) {
    return "";
  }

  const key = cleaned.toLowerCase();
  const cached = aniListSearchCache.get(key);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(ANILIST, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        query: `
          query FindAnime($search: String) {
            Page(page: 1, perPage: 3) {
              media(type: ANIME, search: $search, sort: SEARCH_MATCH) {
                id
                isAdult
              }
            }
          }
        `,
        variables: { search: cleaned.slice(0, 100) },
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      return "";
    }

    const json = (await response.json()) as {
      data?: { Page?: { media?: { id: number; isAdult?: boolean | null }[] } };
    };

    const match =
      json.data?.Page?.media?.find(
        (media) => media.isAdult !== true,
      ) ?? json.data?.Page?.media?.[0];

    if (!match?.id) {
      return "";
    }

    const id = String(match.id);
    aniListSearchCache.set(key, id);
    return id;
  } catch {
    return "";
  }
}

async function fetchExternalNews(): Promise<AutomaticNewsItem[]> {
  const results = await Promise.allSettled(
    EXTERNAL_NEWS_FEEDS.map((feed) => fetchExternalFeed(feed)),
  );

  const merged = results.flatMap((result) =>
    result.status === "fulfilled" ? result.value : [],
  );

  const unique = new Map<string, ExternalNewsItem>();
  for (const item of merged) {
    const key = item.url || `${item.source}:${item.title}`;
    if (!unique.has(key)) {
      unique.set(key, item);
    }
  }

  const sorted = Array.from(unique.values()).sort(
    (a, b) =>
      Date.parse(b.publishedAt) -
      Date.parse(a.publishedAt),
  );

  return Promise.all(
    sorted.map(async (item) => ({
      id: item.id,
      type: item.type,
      title: item.title,
      description:
        (await translateToPortuguese(item.description)) ||
        "A descrição em português está temporariamente indisponível.",
      date: formatExternalDate(item.publishedAt),
      image: item.image,
      animeId: item.animeId,
      trailerUrl: item.trailerUrl,
      source: item.source,
      sourceUrl: item.url,
      publishedAt: item.publishedAt,
      articleImages: item.articleImages,
      isRumor: item.isRumor,
    })),
  );
}

async function buildNews(
  media: AniMedia[],
  latestEpisodes: Map<
    number,
    {
      episode: number;
      airingAt: number;
    }
  >,
): Promise<AutomaticNewsItem[]> {
  const prepared =
    media.map(
      (anime) => {
        const title =
          titleOf(
            anime,
          );

        const trailerUrl =
          trailerOf(
            anime,
          );

        const latestEpisode =
          latestEpisodes.get(
            anime.id,
          );

        return {
          anime,
          title,
          trailerUrl,
          latestEpisode,
        };
      },
    );

  const descriptions =
    await Promise.all(
      prepared.map(
        ({
          anime,
        }) =>
          descriptionOf(
            anime,
          ),
      ),
    );

  const news:
    AutomaticNewsItem[] =
    [];

  const now = Date.now();
  const isAdultFeed =
    media.some(
      (anime) => anime.isAdult === true,
    );

  const topRated = [
    ...media,
  ]
    .filter(
      (anime) =>
        typeof anime.score ===
          "number" &&
        anime.score > 0,
    )
    .sort(
      (a, b) =>
        (b.score ?? 0) -
        (a.score ?? 0),
    )
    .slice(0, 8);

  if (isAdultFeed) {
    for (const anime of topRated) {
    const title = titleOf(anime);
    const preparedIndex = prepared.findIndex(
      ({ anime: preparedAnime }) =>
        preparedAnime.id === anime.id,
    );
    const description =
      preparedIndex >= 0
        ? descriptions[preparedIndex]
        : "";

    news.push({
      id: `auto-highlight-${anime.id}`,
      type: "DESTAQUE",
      title,
      description,
      date: formatDate(anime),
      image:
        anime.coverImage?.extraLarge ||
        anime.coverImage?.large ||
        "",
      animeId: String(anime.id),
      trailerUrl: trailerOf(anime),
      isAdult: true,
    });
    }
  }

  for (
    let index = 0;
    index <
    prepared.length;
    index++
  ) {
    const {
      anime,
      title,
      trailerUrl,
      latestEpisode,
    } =
      prepared[index];

    const description =
      descriptions[index];

    const isAdult =
      anime.isAdult === true;

    const startDate = anime.startDate;
    const startTimestamp =
      startDate?.year &&
      startDate.month &&
      startDate.day
        ? new Date(
            startDate.year,
            startDate.month - 1,
            startDate.day,
          ).getTime()
        : 0;

    if (
      isAdultFeed &&
      isAdult &&
      startTimestamp > now
    ) {
      news.push({
        id:
          `auto-upcoming-${anime.id}`,

        type:
          "PRÓXIMO LANÇAMENTO",

        title:
          isAdult
            ? title
            : `${title} — próximo lançamento`,

        description:
          `Novo conteúdo de ${title} está previsto para ${formatDate(
            anime,
          )}. ${description}`,

        date:
          formatDate(
            anime,
          ),

        image:
          anime.coverImage
            ?.extraLarge ||
          anime.coverImage
            ?.large ||
          "",

        animeId:
          String(
            anime.id,
          ),

        trailerUrl,

        isAdult:
          anime.isAdult === true,
      });
    }

    if (
      latestEpisode &&
      latestEpisode.episode > 0 &&
      latestEpisode.airingAt * 1000 <=
        Date.now()
    ) {
      news.push({
        id:
          `auto-episode-${anime.id}-${latestEpisode.episode}`,

        type:
          "NOVO EPISÓDIO",

        title:
          isAdult
            ? `${title} — Episode ${latestEpisode.episode}`
            : `${title} — episódio ${latestEpisode.episode}`,

        description:
          `O episódio ${latestEpisode.episode} de ${title} foi ao ar em ${formatAiringDate(
            latestEpisode.airingAt,
          )}. ${description}`,

        date:
          formatAiringDate(
            latestEpisode.airingAt,
          ),

        image:
          anime.coverImage
            ?.extraLarge ||
          anime.coverImage
            ?.large ||
          "",

        animeId:
          String(
            anime.id,
          ),

        trailerUrl,

        isAdult:
          anime.isAdult === true,
      });
    }

    if (trailerUrl) {
      news.push({
        id:
          `auto-trailer-${anime.id}`,

        type:
          "TRAILER",

        title:
          isAdult
            ? title
            : `${title} — novo trailer`,

        description,

        date:
          formatDate(
            anime,
          ),

        image:
          anime.coverImage
            ?.extraLarge ||
          anime.coverImage
            ?.large ||
          "",

        animeId:
          String(
            anime.id,
          ),

        trailerUrl,

        isAdult:
          anime.isAdult === true,
      });
    } else {
      news.push({
        id:
          `auto-season-${anime.id}`,

        type:
          isAdult
            ? "NOVO HENTAI"
            : "NOVA TEMPORADA",

        title:
          isAdult
            ? title
            : `${title} — nova temporada`,

        description,

        date:
          formatDate(
            anime,
          ),

        image:
          anime.coverImage
            ?.extraLarge ||
          anime.coverImage
            ?.large ||
          "",

        animeId:
          String(
            anime.id,
          ),

        isAdult:
          anime.isAdult === true,
      });
    }
  }

  const validNews =
    news.filter(
      (item) =>
        Boolean(
          item.image,
        ),
    );

  validNews.sort(
    (a, b) => {
      const parse = (
        value: string,
      ) => {
        const match =
          value.match(
            /^(\d{2})\/(\d{2})\/(\d{4})$/,
          );

        if (!match) {
          return 0;
        }

        return new Date(
          Number(match[3]),
          Number(match[2]) - 1,
          Number(match[1]),
        ).getTime();
      };

      return (
        parse(b.date) -
        parse(a.date)
      );
    },
  );

  return validNews;
}

export const fetchAutomaticNews =
  createServerFn({
    method: "GET",
  }).handler(async () => {
    const current = currentAnimeSeason();
    const season = String(current.season).toUpperCase();
    const year = Number(current.year);
    const key = `automatic-news:v2:${season}:${year}`;

    const cached = fromCache(key);
    if (cached) {
      return cached.filter((item) => item.isAdult !== true);
    }

    try {
      const [media, latestEpisodes, externalNews] =
        await Promise.all([
          fetchSeason(season, year),
          fetchLatestAiredEpisodes(),
          fetchExternalNews(),
        ]);

      const nonAdultMedia = media.filter(
        (anime) => anime.isAdult !== true,
      );

      const catalogNews = await buildNews(
        nonAdultMedia,
        latestEpisodes,
      );

      const combined = [
        ...externalNews,
        ...catalogNews,
      ]
        .filter((item) => item.isAdult !== true && Boolean(item.image))
        .sort((a, b) => {
          const aTime = a.publishedAt
            ? Date.parse(a.publishedAt)
            : parseNewsDateServer(a.date);
          const bTime = b.publishedAt
            ? Date.parse(b.publishedAt)
            : parseNewsDateServer(b.date);
          return bTime - aTime;
        });

      return toCache(key, combined);
    } catch {
      return [];
    }
  });

function parseNewsDateServer(value: string): number {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) {
    return Date.parse(value) || 0;
  }

  return new Date(
    Number(match[3]),
    Number(match[2]) - 1,
    Number(match[1]),
  ).getTime();
}

export const fetchAdultNews =
  createServerFn({
    method: "GET",
  }).handler(async () => {
    const current =
      currentAnimeSeason();

    const season =
      String(
        current.season,
      ).toUpperCase();

    const year =
      Number(
        current.year,
      );

    const key =
      `automatic-adult-news:${season}:${year}`;

    const cached =
      fromCache(key);

    if (cached) {
      return cached.filter(
        (item) =>
          item.isAdult === true,
      );
    }

    try {
      /*
       * As notícias +18 não dependem
       * da temporada atual.
       *
       * Buscamos diretamente os animes
       * marcados pelo AniList como adultos.
       */
      const [
        adultMedia,
        latestEpisodes,
      ] =
        await Promise.all([
          fetchAdultCatalogNews(),
          fetchLatestAiredEpisodes(),
        ]);

      const news =
        await buildNews(
          adultMedia,
          latestEpisodes,
        );

      return toCache(
        key,
        news,
      );
    } catch {
      return [];
    }
  });
