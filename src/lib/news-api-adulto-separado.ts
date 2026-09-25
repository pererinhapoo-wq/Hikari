import { createServerFn } from "@tanstack/react-start";

import { currentAnimeSeason, stripHtml } from "@/lib/utils";

export type AutomaticNewsItem = {
  id: string;
  type:
    | "NOVA TEMPORADA"
    | "TRAILER"
    | "NOVO HENTAI"
    | "NOVO EPISÓDIO"
    | "ANÚNCIO"
    | "ESTREIA"
    | "RECOMENDAÇÃO";
  title: string;
  description: string;
  date: string;
  image: string;
  animeId: string;
  isAdult: boolean;
  url?: string;
};

const ANILIST = "https://graphql.anilist.co";

const ADULT_NEWS_RSS_FEEDS = [
  "https://eroeronews.com/feed/",
  "https://eroeronews.com/categorias/manhwa/feed/",
  "https://eroeronews.com/categorias/manga-hentai/feed/",
  "https://eroeronews.com/categorias/estrenos/feed/",
];

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
  season?: string | null;
  seasonYear?: number | null;
  startDate?: {
    year?: number | null;
    month?: number | null;
    day?: number | null;
  } | null;
};

type AniListResponse = {
  Page: {
    media: AniMedia[];
  };
};

const cache = new Map<
  string,
  {
    at: number;
    data: AutomaticNewsItem[];
  }
>();

const TTL = 10 * 60 * 1000;

function fromCache(
  key: string,
): AutomaticNewsItem[] | null {
  const hit = cache.get(key);

  if (!hit) {
    return null;
  }

  if (Date.now() - hit.at > TTL) {
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
  const date = media.startDate;

  if (
    !date?.year ||
    !date.month ||
    !date.day
  ) {
    return `${media.seasonYear ?? "2026"}`;
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

function descriptionOf(
  media: AniMedia,
): string {
  const description =
    stripHtml(
      media.description,
    );

  if (description) {
    return description;
  }

  return `${titleOf(media)} faz parte da programação da temporada de ${(
    media.season ?? ""
  ).toLowerCase()} de ${media.seasonYear ?? ""}.`;
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
                  sort: START_DATE
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
                }
              }
            }
          `,
          variables: {
            season,
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
      json.errors?.[0]?.message ??
        "AniList sem dados",
    );
  }

  return json.data.Page.media;
}

function decodeXml(
  value: string,
): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function firstXmlValue(
  block: string,
  tag: string,
): string {
  const match = block.match(
    new RegExp(
      `<${tag}[^>]*>([\\s\\S]*?)</${tag}>`,
      "i",
    ),
  );

  return decodeXml(
    match?.[1]?.trim() ?? "",
  );
}

function normalizeUrl(
  value: string,
): string {
  const url = decodeXml(value.trim());

  if (url.startsWith("//")) {
    return `https:${url}`;
  }

  return url;
}

function looksSpanish(value: string): boolean {
  const text = ` ${value.toLowerCase()} `;

  const markers = [
    " el ",
    " la ",
    " los ",
    " las ",
    " un ",
    " una ",
    " de ",
    " del ",
    " para ",
    " con ",
    " por ",
    " que ",
    " se ",
    " este ",
    " estos ",
    " esta ",
    " estas ",
    " nueva ",
    " nuevo ",
    " estrenos ",
    " tráiler ",
    " termina ",
    " fueron ",
    " vendidos ",
    " imágenes ",
    " revelan ",
  ];

  return (
    markers.filter((marker) =>
      text.includes(marker),
    ).length >= 2
  );
}

async function translateToPortuguese(
  value: string,
): Promise<string> {
  const text = value.trim();

  if (!text || !looksSpanish(text)) {
    return text;
  }

  try {
    const response =
      await fetch(
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=pt&dt=t&q=${encodeURIComponent(text.slice(0, 4500))}`,
        {
          headers: {
            Accept:
              "application/json",
            "User-Agent":
              "Hikari/1.0 (adult news)",
          },
          signal:
            AbortSignal.timeout(
              5000,
            ),
        },
      );

    if (!response.ok) {
      return text;
    }

    const data =
      (await response.json()) as unknown;

    if (
      !Array.isArray(data) ||
      !Array.isArray(data[0])
    ) {
      return text;
    }

    const translated =
      data[0]
        .filter(
          (part): part is unknown[] =>
            Array.isArray(part),
        )
        .map((part) =>
          String(part[0] ?? ""),
        )
        .join("")
        .trim();

    return translated || text;
  } catch {
    return text;
  }
}

function imageFromRss(
  block: string,
): string {
  const candidates = [
    /<media:content[^>]+url=["']([^"']+)["'][^>]*>/i,
    /<media:thumbnail[^>]+url=["']([^"']+)["'][^>]*>/i,
    /<thumbnail[^>]+url=["']([^"']+)["'][^>]*>/i,
    /<enclosure[^>]+url=["']([^"']+)["'][^>]*>/i,
    /<(?:img|source)[^>]+(?:data-src|data-lazy-src|data-original|data-image)=['"]([^'"]+)['"][^>]*>/i,
    /<(?:img|source)[^>]+src=['"]([^'"]+)['"][^>]*>/i,
  ];

  for (const pattern of candidates) {
    const match = block.match(pattern);

    if (match?.[1]) {
      return normalizeUrl(match[1]);
    }
  }

  const ogImage =
    block.match(
      /<meta[^>]+(?:property|name)=['"]og:image['"][^>]+content=['"]([^'"]+)['"][^>]*>/i,
    ) ||
    block.match(
      /<meta[^>]+content=['"]([^'"]+)['"][^>]+(?:property|name)=['"]og:image['"][^>]*>/i,
    );

  if (ogImage?.[1]) {
    return normalizeUrl(ogImage[1]);
  }

  const content =
    firstXmlValue(
      block,
      "content:encoded",
    );

  const contentImage =
    content.match(
      /<(?:img|source)[^>]+(?:data-src|data-lazy-src|data-original|data-image)=['"]([^'"]+)['"][^>]*>/i,
    ) ||
    content.match(
      /<(?:img|source)[^>]+src=['"]([^'"]+)['"][^>]*>/i,
    );

  return normalizeUrl(
    contentImage?.[1] ?? "",
  );
}

function formatRssDate(
  value: string,
): string {
  if (!value) {
    return "";
  }

  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    },
  ).format(
    new Date(timestamp),
  );
}

function typeFromRss(
  title: string,
  categories: string,
): AutomaticNewsItem["type"] {
  const value =
    `${title} ${categories}`.toLowerCase();

  if (
    value.includes("trailer") ||
    value.includes("tráiler")
  ) {
    return "TRAILER";
  }

  if (
    value.includes("episodio") ||
    value.includes("episode") ||
    value.includes("capítulo") ||
    value.includes("chapter")
  ) {
    return "NOVO EPISÓDIO";
  }

  if (
    value.includes("estreno") ||
    value.includes("estreia") ||
    value.includes("ova") ||
    value.includes("lançamento")
  ) {
    return "ESTREIA";
  }

  if (
    value.includes("recomend") ||
    value.includes("vendidos") ||
    value.includes("ranking") ||
    value.includes("top ")
  ) {
    return "RECOMENDAÇÃO";
  }

  if (
    value.includes("nuevo") ||
    value.includes("nuevo hentai") ||
    value.includes("novo") ||
    value.includes("hentai") ||
    value.includes("manga hentai") ||
    value.includes("manhwa") ||
    value.includes("manhua")
  ) {
    return "NOVO HENTAI";
  }

  return "ANÚNCIO";
}

async function fetchAdultNewsFeed(
  feedUrl: string,
): Promise<AutomaticNewsItem[]> {
  const response =
    await fetch(
      feedUrl,
      {
        headers: {
          Accept:
            "application/rss+xml, application/xml, text/xml",
          "User-Agent":
            "Hikari/1.0 (adult news)",
        },
        signal:
          AbortSignal.timeout(
            12000,
          ),
      },
    );

  if (!response.ok) {
    throw new Error(
      `Fonte de notícias indisponível (${response.status})`,
    );
  }

  const xml =
    await response.text();

  const items =
    xml.match(
      /<item\b[\s\S]*?<\/item>/gi,
    ) ?? [];

  const parsed = items
    .map(
      (
        item,
        index,
      ): AutomaticNewsItem | null => {
        const title =
          firstXmlValue(
            item,
            "title",
          );

        const link =
          firstXmlValue(
            item,
            "link",
          );

        const date =
          firstXmlValue(
            item,
            "pubDate",
          );

        const categories =
          Array.from(
            item.matchAll(
              /<category[^>]*>([\s\S]*?)<\/category>/gi,
            ),
          )
            .map((match) =>
              decodeXml(
                match[1] ?? "",
              ),
            )
            .join(" ");

        const rawDescription =
          firstXmlValue(
            item,
            "content:encoded",
          ) ||
          firstXmlValue(
            item,
            "description",
          );

        const description =
          stripHtml(
            rawDescription,
          );

        if (!title || !link) {
          return null;
        }

        return {
          id:
            `auto-adult-rss-${index}-${encodeURIComponent(link)}`,
          type:
            typeFromRss(
              title,
              categories,
            ),
          title,
          description:
            description ||
            "Nova notícia da área adulta.",
          date:
            formatRssDate(date),
          image:
            imageFromRss(item),
          animeId: "",
          isAdult: true,
          url: link,
        };
      },
    )
    .filter(
      (
        item,
      ): item is AutomaticNewsItem =>
        Boolean(
          item?.title &&
          item?.url,
        ),
    );

  return Promise.all(
    parsed.map(
      async (item) => ({
        ...item,
        title:
          await translateToPortuguese(
            item.title,
          ),
        description:
          await translateToPortuguese(
            item.description,
          ),
      }),
    ),
  );
}

export const fetchAutomaticNews =
  createServerFn({
    method: "GET",
  }).handler(async () => {
    const current =
      currentAnimeSeason();

    const key =
      `automatic-news:${current.season}:${current.year}`;

    const cached =
      fromCache(key);

    if (cached) {
      return cached;
    }

    try {
      const media =
        await fetchSeason(
          current.season,
          current.year,
        );

      const news =
        media
          .filter(
            (anime) =>
              anime.id > 0 &&
              anime.format !==
                "MUSIC" &&
              anime.isAdult !== true,
          )
          .map(
            (
              anime,
            ): AutomaticNewsItem => ({
              id:
                `auto-${anime.id}`,
              type:
                "NOVA TEMPORADA",
              title:
                `${titleOf(anime)} — nova temporada`,
              description:
                descriptionOf(anime),
              date:
                formatDate(anime),
              image:
                anime.coverImage
                  ?.extraLarge ||
                anime.coverImage
                  ?.large ||
                "",
              animeId:
                String(anime.id),
              isAdult:
                anime.isAdult === true,
            }),
          )
          .filter(
            (news) =>
              Boolean(news.image),
          );

      return toCache(
        key,
        news,
      );
    } catch {
      return [];
    }
  });

export const fetchAdultNews =
  createServerFn({
    method: "GET",
  }).handler(async () => {
    const current =
      currentAnimeSeason();

    const key =
      `automatic-adult-news:${current.season}:${current.year}`;

    const cached =
      fromCache(key);

    if (cached) {
      return cached;
    }

    try {
      const [
        media,
        ...rssResults
      ] = await Promise.all([
        fetchSeason(
          current.season,
          current.year,
        ).catch(() => []),
        ...ADULT_NEWS_RSS_FEEDS.map(
          (feedUrl) =>
            fetchAdultNewsFeed(
              feedUrl,
            ).catch(() => []),
        ),
      ]);

      const seasonNews =
        media
          .filter(
            (anime) =>
              anime.id > 0 &&
              anime.format !==
                "MUSIC" &&
              anime.isAdult === true,
          )
          .map(
            (
              anime,
            ): AutomaticNewsItem => ({
              id:
                `auto-adult-${anime.id}`,
              type:
                "NOVA TEMPORADA",
              title:
                `${titleOf(anime)} — nova temporada`,
              description:
                descriptionOf(anime),
              date:
                formatDate(anime),
              image:
                anime.coverImage
                  ?.extraLarge ||
                anime.coverImage
                  ?.large ||
                "",
              animeId:
                String(anime.id),
              isAdult: true,
            }),
          )
          .filter(
            (news) =>
              Boolean(news.image),
          );

      const externalNews =
        rssResults.flat();

      const combined = [
        ...externalNews,
        ...seasonNews,
      ];

      const unique =
        Array.from(
          new Map(
            combined.map((item) => [
              item.url ||
                `${item.title}-${item.date}`,
              item,
            ]),
          ).values(),
        );

      unique.sort((a, b) => {
        const dateA = Date.parse(
          a.date
            .split("/")
            .reverse()
            .join("-"),
        );

        const dateB = Date.parse(
          b.date
            .split("/")
            .reverse()
            .join("-"),
        );

        return (
          (Number.isNaN(dateB)
            ? 0
            : dateB) -
          (Number.isNaN(dateA)
            ? 0
            : dateA)
        );
      });

      return toCache(
        key,
        unique,
      );
    } catch {
      return [];
    }
  });
