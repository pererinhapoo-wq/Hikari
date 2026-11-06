import { FALLBACK_ANIMES } from "@/lib/fallback-catalog";
import { stripHtml } from "@/lib/utils";

export const CANONICAL_DOMAIN = "https://grokhikari.vercel.app";
export const DEFAULT_OG_IMAGE = `${CANONICAL_DOMAIN}/og.jpg`;

export function truncateSynopsis(synopsis?: string | null, maxChars = 155): string {
  const clean = stripHtml(synopsis || "")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

  if (!clean) {
    return "Confira a sinopse, elenco, episódios e onde assistir a este anime online em alta definição no HIKARI.";
  }

  if (clean.length <= maxChars) {
    return clean;
  }

  return clean.slice(0, maxChars - 1).trim() + "…";
}

export function buildCleanCanonical(path: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${CANONICAL_DOMAIN}${cleanPath}`;
}

export interface SchemaTVSeriesInput {
  name: string;
  alternateName?: string[];
  image?: string;
  description?: string;
  numberOfEpisodes?: number | null;
  datePublished?: string;
  genre?: string[];
  score?: number | null;
  studio?: string;
}

export function buildTVSeriesJsonLd(input: SchemaTVSeriesInput) {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "TVSeries",
    name: input.name,
    inLanguage: "pt-BR",
  };

  if (input.alternateName && input.alternateName.length > 0) {
    schema.alternateName = input.alternateName;
  }

  if (input.image) {
    schema.image = input.image;
  }

  if (input.description) {
    schema.description = input.description;
  }

  if (input.numberOfEpisodes && input.numberOfEpisodes > 0) {
    schema.numberOfEpisodes = input.numberOfEpisodes;
  }

  if (input.datePublished) {
    schema.datePublished = input.datePublished;
  }

  if (input.genre && input.genre.length > 0) {
    schema.genre = input.genre;
  }

  if (input.score && input.score > 0) {
    schema.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: (input.score / 10).toFixed(1),
      bestRating: "10",
      worstRating: "1",
      ratingCount: Math.max(10, Math.round(input.score * 12)),
    };
  }

  if (input.studio) {
    schema.productionCompany = {
      "@type": "Organization",
      name: input.studio,
    };
  }

  return schema;
}

export interface SchemaWatchInput {
  animeId: string;
  animeTitle: string;
  episodeNumber: number | string;
  episodeTitle?: string;
  image?: string;
  description?: string;
}

export function buildWatchJsonLd(input: SchemaWatchInput) {
  const epNum = Number(input.episodeNumber) || 1;
  const canonicalEpisodeUrl = `${CANONICAL_DOMAIN}/watch/${input.animeId}/ep-${epNum}`;
  const canonicalSeriesUrl = `${CANONICAL_DOMAIN}/anime/${input.animeId}`;

  const tvEpisode = {
    "@context": "https://schema.org",
    "@type": "TVEpisode",
    name: input.episodeTitle || `Episódio ${epNum} — ${input.animeTitle}`,
    episodeNumber: epNum,
    description: input.description || `Assista ao episódio ${epNum} de ${input.animeTitle} online no HIKARI.`,
    image: input.image || DEFAULT_OG_IMAGE,
    partOfSeries: {
      "@type": "TVSeries",
      name: input.animeTitle,
      url: canonicalSeriesUrl,
    },
  };

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Início",
        "item": `${CANONICAL_DOMAIN}/`,
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": input.animeTitle,
        "item": canonicalSeriesUrl,
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": `Episódio ${epNum}`,
        "item": canonicalEpisodeUrl,
      },
    ],
  };

  return [tvEpisode, breadcrumb];
}

export function buildHomeJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "HIKARI",
    url: `${CANONICAL_DOMAIN}/`,
    description: "HIKARI — catálogo e streaming de animes",
    inLanguage: "pt-BR",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${CANONICAL_DOMAIN}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

/* =========================================================
   GERAÇÃO DE SITEMAPS DINÂMICOS COM CACHE DIÁRIO
========================================================= */

interface SitemapAnimeItem {
  id: string;
  episodesCount: number;
  lastmod: string;
}

let sitemapCache: {
  timestamp: number;
  animes: SitemapAnimeItem[];
} | null = null;

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas (revalidação diária)

export async function getSitemapAnimeCatalog(): Promise<SitemapAnimeItem[]> {
  const now = Date.now();
  if (sitemapCache && now - sitemapCache.timestamp < CACHE_TTL_MS) {
    return sitemapCache.animes;
  }

  const itemsMap = new Map<string, SitemapAnimeItem>();
  const todayIso = new Date().toISOString().split("T")[0];

  // Adiciona catálogo de fallback embutido
  for (const fallback of FALLBACK_ANIMES) {
    itemsMap.set(fallback.id, {
      id: fallback.id,
      episodesCount: Math.max(1, fallback.episodesCount || 12),
      lastmod: todayIso,
    });
  }

  // Tenta buscar as páginas mais populares e recentes do AniList GraphQL
  try {
    const query = `
      query SitemapCatalog($page: Int) {
        Page(page: $page, perPage: 50) {
          pageInfo {
            hasNextPage
          }
          media(type: ANIME, sort: POPULARITY_DESC, isAdult: false) {
            id
            episodes
            updatedAt
          }
        }
      }
    `;

    // Busca até 10 páginas do AniList com controle de concorrência
    const pagesToFetch = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const results = await Promise.allSettled(
      pagesToFetch.map(async (page) => {
        const res = await fetch("https://graphql.anilist.co", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            query,
            variables: { page },
          }),
          signal: AbortSignal.timeout(8000),
        });

        if (!res.ok) return [];
        const json = await res.json() as {
          data?: {
            Page?: {
              media?: Array<{
                id: number;
                episodes?: number | null;
                updatedAt?: number | null;
              }>;
            };
          };
        };

        return json.data?.Page?.media ?? [];
      }),
    );

    for (const result of results) {
      if (result.status === "fulfilled" && Array.isArray(result.value)) {
        for (const m of result.value) {
          if (!m?.id) continue;
          const idStr = String(m.id);
          const lastmod = m.updatedAt
            ? new Date(m.updatedAt * 1000).toISOString().split("T")[0]
            : todayIso;
          itemsMap.set(idStr, {
            id: idStr,
            episodesCount: Math.max(1, Math.min(m.episodes || 12, 150)),
            lastmod,
          });
        }
      }
    }
  } catch (err) {
    console.warn("[sitemap] Falha ao consultar AniList em lote, usando catálogo local:", err);
  }

  const animes = Array.from(itemsMap.values());
  sitemapCache = {
    timestamp: now,
    animes,
  };

  return animes;
}

export function generateSitemapIndexXml(animesCount: number, episodesCount: number): string {
  const today = new Date().toISOString().split("T")[0];
  const animePages = Math.max(1, Math.ceil(animesCount / 50000));
  const episodePages = Math.max(1, Math.ceil(episodesCount / 50000));

  let sitemapsXml = `  <sitemap>\n    <loc>${CANONICAL_DOMAIN}/sitemap-static.xml</loc>\n    <lastmod>${today}</lastmod>\n  </sitemap>\n`;

  for (let i = 1; i <= animePages; i++) {
    sitemapsXml += `  <sitemap>\n    <loc>${CANONICAL_DOMAIN}/sitemap-animes-${i}.xml</loc>\n    <lastmod>${today}</lastmod>\n  </sitemap>\n`;
  }

  for (let i = 1; i <= episodePages; i++) {
    sitemapsXml += `  <sitemap>\n    <loc>${CANONICAL_DOMAIN}/sitemap-episodios-${i}.xml</loc>\n    <lastmod>${today}</lastmod>\n  </sitemap>\n`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapsXml}</sitemapindex>\n`;
}

export function generateStaticSitemapXml(): string {
  const today = new Date().toISOString().split("T")[0];

  const staticUrls = [
    { loc: `${CANONICAL_DOMAIN}/`, changefreq: "daily", priority: "1.0" },
    { loc: `${CANONICAL_DOMAIN}/calendar`, changefreq: "daily", priority: "0.8" },
    { loc: `${CANONICAL_DOMAIN}/browse/popular`, changefreq: "daily", priority: "0.8" },
    { loc: `${CANONICAL_DOMAIN}/search`, changefreq: "weekly", priority: "0.5" },
    { loc: `${CANONICAL_DOMAIN}/sobre`, changefreq: "monthly", priority: "0.4" },
    { loc: `${CANONICAL_DOMAIN}/contato`, changefreq: "monthly", priority: "0.4" },
    { loc: `${CANONICAL_DOMAIN}/termos`, changefreq: "monthly", priority: "0.3" },
    { loc: `${CANONICAL_DOMAIN}/privacidade`, changefreq: "monthly", priority: "0.3" },
    { loc: `${CANONICAL_DOMAIN}/dmca`, changefreq: "monthly", priority: "0.3" },
  ];

  const urlsXml = staticUrls
    .map(
      (u) =>
        `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlsXml}\n</urlset>\n`;
}

export function generateAnimeSitemapXml(
  animes: SitemapAnimeItem[],
  pageNumber = 1,
  pageSize = 50000,
): string {
  const start = (pageNumber - 1) * pageSize;
  const chunk = animes.slice(start, start + pageSize);

  const urlsXml = chunk
    .map((anime) => {
      const loc = `${CANONICAL_DOMAIN}/anime/${anime.id}`;
      return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${anime.lastmod}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.8</priority>\n  </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlsXml}\n</urlset>\n`;
}

export function generateEpisodeSitemapXml(
  animes: SitemapAnimeItem[],
  pageNumber = 1,
  pageSize = 50000,
): string {
  const episodeUrls: Array<{ loc: string; lastmod: string }> = [];

  for (const anime of animes) {
    const totalEp = Math.max(1, anime.episodesCount);
    for (let ep = 1; ep <= totalEp; ep++) {
      episodeUrls.push({
        loc: `${CANONICAL_DOMAIN}/watch/${anime.id}/ep-${ep}`,
        lastmod: anime.lastmod,
      });
    }
  }

  const start = (pageNumber - 1) * pageSize;
  const chunk = episodeUrls.slice(start, start + pageSize);

  const urlsXml = chunk
    .map((item) => {
      return `  <url>\n    <loc>${item.loc}</loc>\n    <lastmod>${item.lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.6</priority>\n  </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlsXml}\n</urlset>\n`;
}
