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
  bannerImage?: string;
  animeId: string;
  trailerUrl?: string;
  isAdult?: boolean;
  source?: string;
  sourceUrl?: string;
  publishedAt?: string;
  articleImages?: string[];
  isRumor?: boolean;
  xPosts?: string[];
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
  return (
    media.title?.english ||
    media.title?.romaji ||
    media.title?.native ||
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
  const cleaned =
    text.trim();

  if (!cleaned) {
    return "";
  }

  const cached =
    translationCache.get(
      cleaned,
    );

  if (cached) {
    return cached;
  }

  const source = cleaned.slice(
    0,
    5000,
  );

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const url =
        "https://translate.googleapis.com/translate_a/single" +
        "?client=gtx" +
        "&sl=auto" +
        "&tl=pt" +
        "&dt=t" +
        `&q=${encodeURIComponent(source)}`;

      const response =
        await fetch(
          url,
          {
            signal:
              AbortSignal.timeout(
                8000,
              ),
          },
        );

      if (!response.ok) {
        continue;
      }

      const json =
        (await response.json()) as unknown;

      if (
        !Array.isArray(json) ||
        !Array.isArray(json[0])
      ) {
        continue;
      }

      const translated =
        json[0]
          .filter(
            (part) =>
              Array.isArray(part) &&
              typeof part[0] ===
                "string",
          )
          .map(
            (part) =>
              part[0] as string,
          )
          .join("")
          .trim();

      if (!translated) {
        continue;
      }

      translationCache.set(
        cleaned,
        translated,
      );

      return translated;
    } catch {
      // Tenta novamente uma vez antes de devolver o texto original.
    }
  }

  return cleaned;
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

  return translateToPortuguese(
    description,
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
  bannerImage?: string;
  articleImages: string[];
  source: string;
  type: AutomaticNewsItem["type"];
  isRumor: boolean;
  animeId: string;
  trailerUrl?: string;
  xPosts?: string[];
};

type ExternalNewsFeed =
  | {
      kind: "rss";
      name: string;
      url: string;
    }
  | {
      kind: "x-mirror";
      name: string;
      url: string;
      handle: string;
    };

const EXTERNAL_NEWS_FEEDS: ExternalNewsFeed[] = [
  {
    kind: "rss",
    name: "MyAnimeList",
    url: "https://myanimelist.net/rss/news.xml",
  },
  {
    kind: "rss",
    name: "Anime Corner",
    url: "https://animecorner.me/category/anime-news/feed/",
  },
  {
    kind: "x-mirror",
    name: "SugoiLITE",
    handle: "SugoiLITE",
    url: "https://twstalker.com/SugoiLITE",
  },
  {
    kind: "x-mirror",
    name: "SugoiBingus",
    handle: "SugoiBingus",
    url: "https://twstalker.com/SugoiBingus",
  },
];

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


async function fetchSugoiMirrorFeed(
  feed: Extract<ExternalNewsFeed, { kind: "x-mirror" }>,
): Promise<ExternalNewsItem[]> {
  const response = await fetch(feed.url, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "Hikari/1.0 (anime news)",
    },
    signal: AbortSignal.timeout(12000),
  });

  if (!response.ok) {
    throw new Error(`${feed.name} indisponível (${response.status})`);
  }

  const html = await response.text();
  const statusPattern = new RegExp(
    `href=["']/${feed.handle}/status/(\\d+)["']`,
    "gi",
  );
  const ids = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = statusPattern.exec(html)) && ids.size < 12) {
    ids.add(match[1]);
  }

  const items = await Promise.all(
    Array.from(ids).map(async (statusId): Promise<ExternalNewsItem | null> => {
      const xUrl = `https://x.com/${feed.handle}/status/${statusId}`;
      const mirrorUrl = `${feed.url}/status/${statusId}`;

      try {
        const statusResponse = await fetch(mirrorUrl, {
          headers: {
            Accept: "text/html,application/xhtml+xml",
            "User-Agent": "Hikari/1.0 (anime news)",
          },
          signal: AbortSignal.timeout(8000),
        });

        if (!statusResponse.ok) {
          return null;
        }

        const statusHtml = await statusResponse.text();
        const description =
          statusHtml.match(
            /<meta[^>]+(?:property|name)=["'](?:og:description|description)["'][^>]+content=["']([^"']+)["'][^>]*>/i,
          )?.[1] ??
          statusHtml.match(
            /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:description|description)["'][^>]*>/i,
          )?.[1] ??
          "";

        const ogTitle =
          statusHtml.match(
            /<meta[^>]+(?:property|name)=["']og:title["'][^>]+content=["']([^"']+)["'][^>]*>/i,
          )?.[1] ??
          statusHtml.match(
            /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']og:title["'][^>]*>/i,
          )?.[1] ??
          "";

        const text = stripMarkup(description || ogTitle)
          .replace(/^Sugoi(?: LITE|Bingus)?\s+(?:on X|on Twitter)\s*[:\-]?\s*/i, "")
          .trim();

        if (!text) {
          return null;
        }

        const publishedAt =
          statusHtml.match(
            /<meta[^>]+(?:property|name)=["'](?:article:published_time|datePublished)["'][^>]+content=["']([^"']+)["'][^>]*>/i,
          )?.[1] ??
          statusHtml.match(
            /<time[^>]+datetime=["']([^"']+)["'][^>]*>/i,
          )?.[1] ??
          "";

        const image = imageFromHtml(statusHtml, mirrorUrl);
        const articleImages = imagesFromHtml(statusHtml, mirrorUrl);
        if (isGameNews(text, "", xUrl)) {
          return null;
        }

        return {
          id: `sugoi-${feed.handle.toLowerCase()}-${statusId}`,
          title: text,
          description: text,
          publishedAt: publishedAt && !Number.isNaN(Date.parse(publishedAt))
            ? new Date(publishedAt).toISOString()
            : new Date().toISOString(),
          url: xUrl,
          image: image || articleImages[0] || "",
          articleImages,
          source: feed.name,
          type: "RUMOR",
          isRumor: true,
          animeId: "",
          xPosts: [xUrl],
        };
      } catch {
        return null;
      }
    }),
  );

  return items.filter(Boolean) as ExternalNewsItem[];
}

async function fetchExternalFeed(
  feed: ExternalNewsFeed,
): Promise<ExternalNewsItem[]> {
  if (feed.kind === "x-mirror") {
    return [];
  }

  const response = await fetch(feed.url, {
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

  const parsed = blocks.slice(0, 30).map((block): ExternalNewsItem | null => {
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

      const animeId = await findAniListAnimeId(item.title);
      item.animeId = animeId;
      const animeMeta = await fetchAniListMeta(animeId);
      item.bannerImage = animeMeta.bannerImage || item.bannerImage;
      item.title = finalizeExternalNewsTitle(
        await translateExternalTitle(item.title, animeId),
      );

      if (item.type === "TRAILER" && item.url.includes("youtube.com")) {
        item.trailerUrl = item.url;
      }

      return item;
    }),
  );

  return enriched;
}

const aniListSearchCache = new Map<string, string>();
const aniListMetaCache = new Map<string, {
  title: string;
  english: string;
  romaji: string;
  image: string;
  bannerImage: string;
}>();

async function fetchAniListMeta(
  animeId: string,
): Promise<{ title: string; english: string; romaji: string; image: string; bannerImage: string }> {
  if (!animeId) {
    return { title: "", english: "", romaji: "", image: "", bannerImage: "" };
  }

  const cached = aniListMetaCache.get(animeId);
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
          query AnimeMeta($id: Int) {
            Media(id: $id, type: ANIME) {
              id
              isAdult
              title {
                english
                romaji
              }
              coverImage {
                extraLarge
                large
              }
              bannerImage
            }
          }
        `,
        variables: { id: Number(animeId) },
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      return { title: "", english: "", romaji: "", image: "", bannerImage: "" };
    }

    const json = (await response.json()) as {
      data?: {
        Media?: {
          isAdult?: boolean | null;
          title?: {
            english?: string | null;
            romaji?: string | null;
          } | null;
          coverImage?: {
            extraLarge?: string | null;
            large?: string | null;
          } | null;
          bannerImage?: string | null;
        } | null;
      };
    };

    const media = json.data?.Media;
    if (!media || media.isAdult === true) {
      return { title: "", english: "", romaji: "", image: "", bannerImage: "" };
    }

    const english = media.title?.english?.trim() || "";
    const romaji = media.title?.romaji?.trim() || "";

    const meta = {
      title: english || romaji,
      english,
      romaji,
      image:
        media.coverImage?.extraLarge ||
        media.coverImage?.large ||
        "",
      bannerImage: media.bannerImage || "",
    };

    aniListMetaCache.set(animeId, meta);
    return meta;
  } catch {
    return { title: "", english: "", romaji: "", image: "", bannerImage: "" };
  }
}

function cleanExternalTitle(value: string): string {
  return xmlDecode(
    value
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/\s+/g, " "),
  )
    .replace(/^FixupX\s*[-:–—]?\s*/i, "")
    .replace(/^Media\s+\d+\s*\/\s*\d+\s*[:|-]?\s*/i, "")
    .replace(/^\d{1,2}:\d{2}\s*/i, "")
    .replace(/^[✅☑️✔️✓\s]+/u, "")
    .replace(/^(?:SUGOI\s+)?(?:LITE|BINGUS)\s*\([^)]*\)\s*/i, "")
    .replace(/^(?:SUGOI\s+)?(?:LITE|BINGUS)\s*[-:–—]?\s*/i, "")
    .replace(/\b(?:@SugoiLITE|@SugoiBingus)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function joinNewsTitleParts(...parts: string[]): string {
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

function normalizePortugueseNewsFragment(value: string): string {
  return value
    .replace(/\bTV Anime\b/gi, "Anime de TV")
    .replace(/\bis listed for\b/gi, "está listado com")
    .replace(/\blisted for\b/gi, "listado com")
    .replace(/\bepisodes\b/gi, "episódios")
    .replace(/\bconsecutive episodes\b/gi, "episódios consecutivos")
    .replace(/\bhas officially revealed\b/gi, "revelou oficialmente")
    .replace(/\bofficially revealed\b/gi, "revelou oficialmente")
    .replace(/\brevealed its latest promo\b/gi, "revelou sua última promoção")
    .replace(/\breveals its latest promo\b/gi, "revela sua última promoção")
    .replace(/\bEnds with\b/gi, "termina com")
    .replace(/\bends with\b/gi, "termina com")
    .replace(/\b6th Volume\b/gi, "6º volume")
    .replace(/\b5th Volume\b/gi, "5º volume")
    .replace(/\b4th Volume\b/gi, "4º volume")
    .replace(/\b3rd Volume\b/gi, "3º volume")
    .replace(/\b2nd Volume\b/gi, "2º volume")
    .replace(/\b1st Volume\b/gi, "1º volume")
    .replace(/\bVolume\b/gi, "volume")
    .replace(/\bannounces\b/gi, "anuncia")
    .replace(/\bannounced\b/gi, "anunciado")
    .replace(/\breveals\b/gi, "revela")
    .replace(/\brevealed\b/gi, "revelou")
    .replace(/\bnew visual\b/gi, "novo visual")
    .replace(/\blatest visual\b/gi, "novo visual")
    .replace(/\badditional cast\b/gi, "elenco adicional")
    .replace(/\bcast members\b/gi, "membros do elenco")
    .replace(/\bmain cast\b/gi, "elenco principal")
    .replace(/\bsecond teaser promotional\b/gi, "segundo teaser promocional")
    .replace(/\bsecond promotional teaser\b/gi, "segundo teaser promocional")
    .replace(/\bpromotional teaser\b/gi, "teaser promocional")
    .replace(/\btrailer\b/gi, "trailer")
    .replace(/\btheatrical film\b/gi, "filme para os cinemas")
    .replace(/\bfilm project\b/gi, "projeto de filme")
    .replace(/\bgets an anime adaptation\b/gi, "ganha adaptação para anime")
    .replace(/\bwill get an anime adaptation\b/gi, "ganhará adaptação para anime")
    .replace(/\bhas been announced\b/gi, "foi anunciado")
    .replace(/\bhas announced\b/gi, "anunciou")
    .replace(/\bnew season\b/gi, "nova temporada")
    .replace(/\bsecond season\b/gi, "segunda temporada")
    .replace(/\bthird season\b/gi, "terceira temporada")
    .replace(/\bfirst season\b/gi, "primeira temporada")
    .replace(/\bfirst project\b/gi, "primeiro projeto")
    .replace(/\bfor the first time\b/gi, "pela primeira vez")
    .replace(/\bthe anime\b/gi, "o anime")
    .replace(/\bthe light novel\b/gi, "a light novel")
    .replace(/\blight novel\b/gi, "light novel")
    .replace(/\bJapanese TV\b/gi, "TV japonesa")
    .replace(/\bwebsite\b/gi, "site oficial")
    .replace(/\bofficial website\b/gi, "site oficial")
    .replace(/\s+/g, " ")
    .trim();
}

async function translateNewsFragment(value: string): Promise<string> {
  const translated = await translateToPortuguese(value);
  return normalizePortugueseNewsFragment(translated || value);
}

function finalizeExternalNewsTitle(value: string): string {
  return joinNewsTitleParts(value)
    .replace(/\bAnime TV(?=[A-Z])/g, "Anime de TV ")
    .replace(/\bTV(?=[A-Z])/g, "TV ")
    .replace(/(?<=[a-záéíóúãõç])(?=[A-Z][a-z])/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function translateExternalTitle(
  rawTitle: string,
  animeId: string,
): Promise<string> {
  const cleaned = cleanExternalTitle(rawTitle)
    .replace(/&quot;|&#34;|&#x22;/gi, '"')
    .replace(/&#39;|&#x27;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return "";

  const meta = await fetchAniListMeta(animeId);
  const official = (meta.english || meta.romaji || meta.title || "").trim();

  // Primeiro, preserve o nome que a própria fonte marcou como título.
  // Isso evita depender exclusivamente do resultado de busca do AniList.
  // Ex.: "SUIKODEN" (Gensou Suikoden) -> Gensou Suikoden.
  const quotedWithParenthetical = cleaned.match(
    /(?:"([^"“”]{2,120})"|“([^”]{2,120})”)\s*\(([^()]{2,160})\)/,
  );

  if (quotedWithParenthetical) {
    const quotedName = (
      quotedWithParenthetical[1] || quotedWithParenthetical[2] || ""
    ).trim();
    const parentheticalName = quotedWithParenthetical[3].trim();
    const titleName =
      parentheticalName.length >= quotedName.length
        ? parentheticalName
        : quotedName;

    const blockStart = quotedWithParenthetical.index ?? -1;
    if (blockStart >= 0) {
      const blockEnd = blockStart + quotedWithParenthetical[0].length;
      const before = cleaned.slice(0, blockStart);
      const after = cleaned.slice(blockEnd);
      const [beforePt, afterPt] = await Promise.all([
        translateNewsFragment(before),
        translateNewsFragment(after),
      ]);

      return joinNewsTitleParts(beforePt, titleName, afterPt);
    }
  }

  // Títulos entre aspas são preservados; somente o texto ao redor é traduzido.
  // Isso cobre HIRAYASUMI e títulos de light novel como
  // 'Sekai Saikyou no Majo, Hajimemashita'.
  const quoted =
    cleaned.match(/"([^"“”]{2,160})"/) ||
    cleaned.match(/“([^”]{2,160})”/) ||
    cleaned.match(/'([^']{2,160})'/);
  if (quoted?.[1]) {
    const quotedName = quoted[1].trim();
    const quotedIndex = quoted.index ?? cleaned.indexOf(quoted[0]);
    if (quotedIndex >= 0) {
      const before = cleaned.slice(0, quotedIndex);
      const after = cleaned.slice(quotedIndex + quoted[0].length);
      const [beforePt, afterPt] = await Promise.all([
        translateNewsFragment(before),
        translateNewsFragment(after),
      ]);

      return joinNewsTitleParts(beforePt, quotedName, afterPt);
    }
  }

  // Quando não há título destacado pela fonte, usa o nome oficial do AniList
  // como trecho protegido e traduz somente o restante.
  if (official) {
    const lower = cleaned.toLocaleLowerCase();
    const index = lower.indexOf(official.toLocaleLowerCase());

    if (index >= 0) {
      const before = cleaned.slice(0, index);
      const after = cleaned.slice(index + official.length);
      const [beforePt, afterPt] = await Promise.all([
        translateNewsFragment(before),
        translateNewsFragment(after),
      ]);

      return joinNewsTitleParts(beforePt, official, afterPt);
    }
  }

  return joinNewsTitleParts(await translateNewsFragment(cleaned));
}

async function findAniListAnimeId(
  newsTitle: string,
): Promise<string> {
  const raw = xmlDecode(newsTitle)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const candidates = [
    ...Array.from(
      raw.matchAll(/["“”']([^"“”']{2,120})["“”']/g),
    ).map((match) => match[1].trim()),
    ...Array.from(
      raw.matchAll(/\(([^()]{2,120})\)/g),
    ).map((match) => match[1].trim()),
    raw
      .replace(/\[[^\]]*\]/g, " ")
      .replace(/\([^)]*\)/g, " ")
      .replace(/\b(tv anime|anime|new trailer|trailer|teaser|pv|visual|key visual|announced|revealed|season [0-9ivx]+|premiere date|release date|listed|episodes?)\b/gi, " ")
      .replace(/[:|—–-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  ]
    .filter(Boolean)
    .map((value) => value.slice(0, 100))
    .filter((value, index, list) => list.indexOf(value) === index);

  for (const cleaned of candidates) {
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
          variables: { search: cleaned },
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
        media.find((item) => item.isAdult !== true) ??
        media[0];

      if (!match?.id) {
        continue;
      }

      const id = String(match.id);
      aniListSearchCache.set(key, id);
      return id;
    } catch {
      // Tenta o próximo candidato.
    }
  }

  return "";
}

function htmlText(value: string): string {
  return stripMarkup(
    value
      .replace(/<br\s*\/?>(?=.)/gi, " ")
      .replace(/<[^>]+>/g, " "),
  );
}

function telegramPostBlock(html: string, matchIndex: number): string {
  const marker = '<div class="tgme_widget_message_wrap';
  const start = html.lastIndexOf(marker, matchIndex);
  if (start < 0) return html.slice(Math.max(0, matchIndex - 4000), Math.min(html.length, matchIndex + 5000));
  const next = html.indexOf(marker, matchIndex + 1);
  return html.slice(start, next >= 0 ? next : Math.min(html.length, start + 30000));
}

function telegramPostImage(html: string, baseUrl: string): string {
  const photo = html.match(
    /tgme_widget_message_photo_wrap[^>]*style=["'][^"']*background-image\s*:\s*url\((?:["']?)([^\)"']+)(?:["']?)\)[^"']*["']/i,
  )?.[1];
  if (photo) return absoluteUrl(photo, baseUrl);

  const background = html.match(
    /style=["'][^"']*background-image\s*:\s*url\((?:["']?)([^\)"']+)(?:["']?)\)[^"']*["']/i,
  )?.[1];
  return background ? absoluteUrl(background, baseUrl) : "";
}

async function fetchSugoiProfile(
  source: Extract<ExternalNewsFeed, { kind: "x-mirror" }>,
): Promise<ExternalNewsItem[]> {
  // O canal público de anúncios do SugoiLITE espelha os posts do X via
  // FixupX. Isso é mais estável no servidor do Hikari do que abrir cada
  // página do TwStalker individualmente.
  const telegramUrl = "https://t.me/s/sugoileaks";
  const response = await fetch(telegramUrl, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "Hikari/1.0 (anime news)",
    },
    signal: AbortSignal.timeout(12000),
  });

  if (!response.ok) {
    throw new Error(`${source.name} indisponível (${response.status})`);
  }

  const html = await response.text();
  const results: ExternalNewsItem[] = [];
  const seen = new Set<string>();

  const linkPattern = /<a\b[^>]*href=["'](?:https?:\/\/)?fixupx\.com\/(SugoiLITE|SugoiBingus)\/status\/(\d+)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(html)) && results.length < 24) {
    const handle = match[1];
    const statusId = match[2];
    const anchorHtml = match[3];

    if (handle.toLowerCase() !== source.handle.toLowerCase()) continue;
    if (seen.has(statusId)) continue;
    seen.add(statusId);

    const context = telegramPostBlock(html, match.index);

    const text = stripMarkup(anchorHtml)
      .replace(/\s+/g, " ")
      .trim();

    if (text.length < 30 || isGameNews(text, "", `https://x.com/${handle}/status/${statusId}`)) {
      continue;
    }

    const publishedAt =
      context.match(/<time\b[^>]*datetime=["']([^"']+)["'][^>]*>/i)?.[1] ??
      context.match(/datetime=["']([^"']+)["']/i)?.[1] ??
      "";

    const image = telegramPostImage(context, telegramUrl);
    const articleImages = image ? [image] : [];
    const xUrl = `https://x.com/${handle}/status/${statusId}`;

    const rawTitle = cleanExternalTitle(text);
    if (!rawTitle) continue;

    const animeId = await findAniListAnimeId(rawTitle);
    const meta = await fetchAniListMeta(animeId);
    const translatedTitle = await translateExternalTitle(
      rawTitle,
      animeId,
    );

    // Para o banner, usa a capa extraLarge do AniList quando houver
    // correspondência. Isso evita esticar miniaturas comprimidas do
    // espelho do Sugoi e preserva a qualidade visual do banner.
    const bestImage =
      meta.image ||
      image ||
      articleImages[0] ||
      "";
    const bannerImage =
      meta.bannerImage ||
      image ||
      "";

    results.push({
      id: `sugoi-${handle.toLowerCase()}-${statusId}`,
      title: finalizeExternalNewsTitle(translatedTitle || rawTitle),
      description: translatedTitle || rawTitle,
      publishedAt:
        publishedAt && !Number.isNaN(Date.parse(publishedAt))
          ? new Date(publishedAt).toISOString()
          : new Date().toISOString(),
      url: xUrl,
      image: bestImage,
      bannerImage,
      articleImages,
      source: handle,
      type: "RUMOR",
      isRumor: true,
      animeId,
      xPosts: [xUrl],
    });
  }

  return results;
}

async function fetchExternalNews(): Promise<AutomaticNewsItem[]> {
  const [rssResults, sugoiResults] = await Promise.all([
    Promise.allSettled(
      EXTERNAL_NEWS_FEEDS
        .filter((feed): feed is Extract<ExternalNewsFeed, { kind: "rss" }> =>
          feed.kind === "rss",
        )
        .map((feed) => fetchExternalFeed(feed)),
    ),
    Promise.allSettled(
      EXTERNAL_NEWS_FEEDS
        .filter((feed): feed is Extract<ExternalNewsFeed, { kind: "x-mirror" }> =>
          feed.kind === "x-mirror",
        )
        .map((source) => fetchSugoiProfile(source)),
    ),
  ]);

  const merged = [
    ...rssResults.flatMap((result) =>
      result.status === "fulfilled" ? result.value : [],
    ),
    ...sugoiResults.flatMap((result) =>
      result.status === "fulfilled" ? result.value : [],
    ),
  ];

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
        "Descrição indisponível.",
      date: formatExternalDate(item.publishedAt),
      image: item.image,
      bannerImage: item.bannerImage,
      animeId: item.animeId,
      trailerUrl: item.trailerUrl,
      source: item.source,
      sourceUrl: item.url,
      publishedAt: item.publishedAt,
      articleImages: item.articleImages,
      isRumor: item.isRumor,
      xPosts: item.xPosts,
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
