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
  publishedAt?: string;
  articleImages?: string[];
  mentionedHentai?: {
    title: string;
    image: string;
  }[];
};

const ANILIST = "https://graphql.anilist.co";

const ADULT_NEWS_RSS_FEEDS = [
  "https://eroeronews.com/feed/",
  "https://eroeronews.com/categorias/estrenos/feed/",
];

type AniMedia = {
  id: number;
  type?: "ANIME" | "MANGA" | null;
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

function imageFromRss(block: string): string {
  const candidates = [
    /<media:content[^>]+url=["']([^"']+)["'][^>]*>/i,
    /<media:thumbnail[^>]+url=["']([^"']+)["'][^>]*>/i,
    /<thumbnail[^>]+url=["']([^"']+)["'][^>]*>/i,
    /<enclosure[^>]+url=["']([^"']+)["'][^>]*>/i,
    /<(?:img|source)[^>]+(?:data-src|data-lazy-src|data-original|data-image)=["']([^"']+)["'][^>]*>/i,
    /<(?:img|source)[^>]+src=["']([^"']+)["'][^>]*>/i,
  ];

  for (const pattern of candidates) {
    const match = block.match(pattern);

    if (match?.[1]) {
      return decodeXml(match[1]);
    }
  }

  const content = firstXmlValue(
    block,
    "content:encoded",
  );

  const image = content.match(
    /<img[^>]+(?:data-src|data-lazy-src|data-original|src)=["']([^"']+)["'][^>]*>/i,
  );

  return decodeXml(
    image?.[1] ?? "",
  );
}

function imageFromHtml(html: string): string {
  const candidates = [
    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["'][^>]*>/i,
    /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["'][^>]*>/i,
    /<link[^>]+rel=["'][^"']*image_src[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>/i,
    /<img[^>]+(?:data-src|data-lazy-src|data-original|data-image|src)=["']([^"']+)["'][^>]*>/i,
  ];

  for (const pattern of candidates) {
    const match = html.match(pattern);

    if (match?.[1]) {
      return decodeXml(match[1].trim());
    }
  }

  return "";
}

function imagesFromHtml(
  html: string,
  baseUrl: string,
): string[] {
  const values: string[] = [];

  const add = (value: string) => {
    const decoded = decodeXml(value.trim());

    if (!decoded) {
      return;
    }

    try {
      const absolute = new URL(
        decoded,
        baseUrl,
      ).href;

      if (
        /^https?:\/\//i.test(absolute) &&
        !values.includes(absolute)
      ) {
        values.push(absolute);
      }
    } catch {
      // Ignora URLs de imagem inválidas.
    }
  };

  const metaPatterns = [
    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["'][^>]*>/gi,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["'][^>]*>/gi,
    /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["'][^>]*>/gi,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["'][^>]*>/gi,
  ];

  for (const pattern of metaPatterns) {
    for (const match of html.matchAll(pattern)) {
      if (match[1]) add(match[1]);
    }
  }

  const imagePattern =
    /<img[^>]+(?:data-src|data-lazy-src|data-original|data-image|src)=["']([^"']+)["'][^>]*>/gi;

  for (const match of html.matchAll(imagePattern)) {
    if (match[1]) add(match[1]);
  }

  return values.slice(0, 5);
}

async function fetchArticleImages(
  articleUrl: string,
): Promise<string[]> {
  const url = articleUrl.trim();

  if (!/^https?:\/\//i.test(url)) {
    return [];
  }

  try {
    const response = await fetch(
      url,
      {
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "User-Agent":
            "Hikari/1.0 (adult news image)",
        },
        signal: AbortSignal.timeout(8000),
      },
    );

    if (!response.ok) {
      return [];
    }

    const html = await response.text();
    return imagesFromHtml(
      html,
      url,
    );
  } catch {
    return [];
  }
}

async function proxyRssImage(
  imageUrl: string,
  maxImageBytes = 1_500_000,
): Promise<string> {
  const url = imageUrl.trim();

  if (!/^https?:\/\//i.test(url)) {
    return "";
  }

  const MAX_IMAGE_BYTES = maxImageBytes;

  try {
    const response =
      await fetch(
        url,
        {
          headers: {
            Accept:
              "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
            Referer:
              "https://eroeronews.com/",
            "User-Agent":
              "Hikari/1.0 (adult news image)",
          },
          signal:
            AbortSignal.timeout(8000),
        },
      );

    if (!response.ok) {
      return "";
    }

    const contentType =
      (response.headers.get(
        "content-type",
      ) ?? "")
        .split(";", 1)[0]
        .trim()
        .toLowerCase();

    if (!contentType.startsWith("image/")) {
      return "";
    }

    const contentLength = Number(
      response.headers.get(
        "content-length",
      ) ?? "0",
    );

    if (
      Number.isFinite(contentLength) &&
      contentLength > MAX_IMAGE_BYTES
    ) {
      return "";
    }

    const buffer =
      new Uint8Array(
        await response.arrayBuffer(),
      );

    if (
      buffer.byteLength >
      MAX_IMAGE_BYTES
    ) {
      return "";
    }

    let binary = "";
    const CHUNK_SIZE = 0x8000;

    for (
      let index = 0;
      index < buffer.length;
      index += CHUNK_SIZE
    ) {
      binary += String.fromCharCode(
        ...buffer.subarray(
          index,
          Math.min(
            index + CHUNK_SIZE,
            buffer.length,
          ),
        ),
      );
    }

    return `data:${contentType};base64,${btoa(binary)}`;
  } catch {
    return "";
  }
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

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function mediaSearchCandidates(
  title: string,
  description: string,
): string[] {
  const source = `${title}\n${description}`;
  const candidates: string[] = [];

  for (const pattern of [
    /[“「『"]([^”」』"\n]{2,120})[”」』"]/g,
    /[‘']([^’'\n]{2,120})[’']/g,
  ]) {
    for (const match of source.matchAll(pattern)) {
      const value = match[1]?.trim();

      if (value && value.length >= 3) {
        candidates.push(value);
      }
    }
  }

  candidates.push(title.trim());

  return Array.from(
    new Set(
      candidates
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ).slice(0, 4);
}

function mediaTitleValues(
  media: AniMedia,
): string[] {
  return [
    media.title?.english,
    media.title?.romaji,
    media.title?.native,
  ].filter(
    (value): value is string =>
      Boolean(value?.trim()),
  );
}

function titleMatchScore(
  candidate: string,
  media: AniMedia,
): number {
  const query = normalizeSearchText(candidate);

  if (!query) {
    return 0;
  }

  let best = 0;

  for (const title of mediaTitleValues(media)) {
    const normalized = normalizeSearchText(title);

    if (!normalized) {
      continue;
    }

    if (normalized === query) {
      best = Math.max(best, 100);
      continue;
    }

    if (
      normalized.includes(query) ||
      query.includes(normalized)
    ) {
      best = Math.max(best, 80);
      continue;
    }

    const queryTokens = new Set(
      query.split(" ").filter(Boolean),
    );
    const titleTokens = new Set(
      normalized.split(" ").filter(Boolean),
    );

    if (!queryTokens.size || !titleTokens.size) {
      continue;
    }

    let overlap = 0;

    for (const token of queryTokens) {
      if (titleTokens.has(token)) {
        overlap += 1;
      }
    }

    best = Math.max(
      best,
      Math.round(
        (overlap / queryTokens.size) * 70,
      ),
    );
  }

  return best;
}

const mediaCoverCache = new Map<
  string,
  string
>();

async function fetchAniListCover(
  title: string,
  description: string,
): Promise<string> {
  const candidates = mediaSearchCandidates(
    title,
    description,
  );

  for (const candidate of candidates) {
    const key = normalizeSearchText(candidate);

    if (!key) {
      continue;
    }

    const cached = mediaCoverCache.get(key);

    if (cached) {
      return cached;
    }

    try {
      const response = await fetch(
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
              query AdultNewsMediaCover(
                $search: String!
              ) {
                Page(
                  page: 1
                  perPage: 10
                ) {
                  media(
                    search: $search
                    type: ANIME
                    isAdult: true
                  ) {
                    id
                    type
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
                  }
                }
              }
            `,
            variables: {
              search: candidate,
            },
          }),
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
        (await response.json()) as {
          data?: {
            Page?: {
              media?: AniMedia[];
            };
          };
        };

      const media =
        json.data?.Page?.media ?? [];

      const match = media
        .filter(
          (item) =>
            item.isAdult === true &&
            Boolean(
              item.coverImage?.extraLarge ||
              item.coverImage?.large,
            ),
        )
        .sort(
          (a, b) =>
            titleMatchScore(candidate, b) -
            titleMatchScore(candidate, a),
        )[0];

      const image =
        match?.coverImage?.extraLarge ||
        match?.coverImage?.large ||
        "";

      if (image) {
        mediaCoverCache.set(key, image);
        return image;
      }
    } catch {
      // Tenta o próximo candidato sem quebrar o feed.
    }
  }

  return "";
}

function isListLikeAdultNews(
  title: string,
  description: string,
): boolean {
  const value = `${title} ${description}`.toLowerCase();

  return /\b(lista|ranking|mais vendidos|recomend|outubro|novembro|dezembro|janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro)\b/.test(
    value,
  );
}

function extractHentaiTitles(
  title: string,
  description: string,
): string[] {
  if (!isListLikeAdultNews(title, description)) {
    return [];
  }

  const source = stripHtml(description)
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ");

  const values: string[] = [];
  const numbered = /(?:^|[\n\r]|\s)(\d+)\s*(?:\.\s*-|-\s*|\)\s*|\.\s*)([^\n]+?)(?=(?:\s+\d+\s*(?:\.\s*-|-\s*|\)\s*|\.\s*))|[\n\r]+|$)/g;

  for (const match of source.matchAll(numbered)) {
    const value = match[2]
      ?.replace(/\s+/g, " ")
      .replace(/^[-–—: ]+/, "")
      .replace(/\s+(?:a\s+)?animação\s+\d+(?:\s+e\s+\d+)?\s*$/i, "")
      .trim();

    if (value && value.length >= 4 && value.length <= 140) {
      values.push(value);
    }
  }

  return Array.from(
    new Map(
      values.map((value) => [
        normalizeSearchText(value),
        value,
      ]),
    ).values(),
  ).slice(0, 12);
}

async function fetchMentionedHentai(
  title: string,
  description: string,
): Promise<{ title: string; image: string }[]> {
  const titles = extractHentaiTitles(
    title,
    description,
  );

  if (!titles.length) {
    return [];
  }

  const results: { title: string; image: string }[] = [];

  for (const hentaiTitle of titles) {
    const image = await fetchAniListCover(
      hentaiTitle,
      hentaiTitle,
    );

    if (image) {
      results.push({
        title: hentaiTitle,
        image,
      });
    }
  }

  return results;
}

const ADULT_IMAGE_FALLBACK =
  `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450">
      <rect width="800" height="450" fill="#17131f"/>
      <text x="400" y="225" fill="#a855f7" font-family="Arial, sans-serif" font-size="42" text-anchor="middle" dominant-baseline="middle">Hikari +18</text>
    </svg>
  `)}`;

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

        const categoryValue =
          categories.toLowerCase();

        if (
          /\bmanhwa\b/.test(categoryValue) ||
          /\bmanhua\b/.test(categoryValue) ||
          /\bmanga\b/.test(categoryValue)
        ) {
          return null;
        }

        const rawDescription =
          firstXmlValue(
            item,
            "content:encoded",
          ) ||
          firstXmlValue(
            item,
            "description",
          );

        const articleImages =
          imagesFromHtml(
            rawDescription,
            link,
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
          publishedAt:
            Number.isNaN(Date.parse(date))
              ? ""
              : new Date(Date.parse(date)).toISOString(),
          image:
            imageFromRss(item),
          animeId: "",
          isAdult: true,
          url: link,
          articleImages,
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

  const hentaiOnly = parsed.filter((item) => {
    const value = `${item.title} ${item.description}`.toLowerCase();

    return !(
      /\bmanhwa\b/.test(value) ||
      /\bmanhua\b/.test(value) ||
      /\bmanga\b/.test(value)
    );
  });

  return Promise.all(
    hentaiOnly.map(
      async (item) => {
        const title =
          await translateToPortuguese(
            item.title,
          );
        const description =
          await translateToPortuguese(
            item.description,
          );
        const image =
          await fetchAniListCover(
            item.title,
            item.description,
          );

        let rssImage = "";
        let articleImages = [
          ...(item.articleImages ?? []),
        ];

        if (image) {
          rssImage = image;
        } else if (item.image) {
          rssImage = await proxyRssImage(
            item.image,
          );
        }

        if (item.url) {
          const pageImages =
            await fetchArticleImages(
              item.url,
            );

          articleImages = [
            ...articleImages,
            ...pageImages,
          ].filter(
            (value, index, list) =>
              list.indexOf(value) === index,
          ).slice(0, 8);

          if (!rssImage && pageImages[0]) {
            rssImage = await proxyRssImage(
              pageImages[0],
            );
          }
        }

        const proxiedArticleImages =
          (
            await Promise.all(
              articleImages.map((imageUrl) =>
                proxyRssImage(imageUrl, 700_000),
              ),
            )
          ).filter(Boolean);

        const mentionedHentai =
          await fetchMentionedHentai(
            title,
            description,
          );

        return {
          ...item,
          title,
          description,
          image:
            rssImage ||
            proxiedArticleImages[0] ||
            ADULT_IMAGE_FALLBACK,
          articleImages:
            proxiedArticleImages,
          mentionedHentai,
        };
      },
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
              publishedAt:
                anime.startDate?.year &&
                anime.startDate?.month &&
                anime.startDate?.day
                  ? new Date(
                      anime.startDate.year,
                      anime.startDate.month - 1,
                      anime.startDate.day,
                    ).toISOString()
                  : "",
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
        const timeA =
          a.publishedAt
            ? Date.parse(a.publishedAt)
            : Date.parse(
                a.date
                  .split("/")
                  .reverse()
                  .join("-"),
              );

        const timeB =
          b.publishedAt
            ? Date.parse(b.publishedAt)
            : Date.parse(
                b.date
                  .split("/")
                  .reverse()
                  .join("-"),
              );

        return (
          (Number.isNaN(timeB) ? 0 : timeB) -
          (Number.isNaN(timeA) ? 0 : timeA)
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
