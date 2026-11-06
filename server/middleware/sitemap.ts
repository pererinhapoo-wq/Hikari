import {
  generateAnimeSitemapXml,
  generateEpisodeSitemapXml,
  generateSitemapIndexXml,
  generateStaticSitemapXml,
  getSitemapAnimeCatalog,
} from "../../src/lib/seo";

interface MiddlewareEvent {
  url: URL;
  req: { method: string; headers: Headers };
}

export default async function sitemapMiddleware(
  event: MiddlewareEvent,
  next: () => unknown | Promise<unknown>,
): Promise<unknown> {
  const method = (event.req.method ?? "GET").toUpperCase();
  if (method !== "GET") return next();

  const path = event.url.pathname;
  if (!path.startsWith("/sitemap")) return next();

  if (path === "/sitemap.xml") {
    const animes = await getSitemapAnimeCatalog();
    const totalEpisodes = animes.reduce((acc, a) => acc + (a.episodesCount || 1), 0);
    const xml = generateSitemapIndexXml(animes.length, totalEpisodes);
    return new Response(xml, {
      headers: {
        "content-type": "application/xml; charset=utf-8",
        "cache-control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=86400",
      },
    });
  }

  if (path === "/sitemap-static.xml") {
    const xml = generateStaticSitemapXml();
    return new Response(xml, {
      headers: {
        "content-type": "application/xml; charset=utf-8",
        "cache-control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=86400",
      },
    });
  }

  const animeMatch = path.match(/^\/sitemap-animes-(\d+)\.xml$/);
  if (animeMatch) {
    const pageNum = parseInt(animeMatch[1], 10) || 1;
    const animes = await getSitemapAnimeCatalog();
    const xml = generateAnimeSitemapXml(animes, pageNum);
    return new Response(xml, {
      headers: {
        "content-type": "application/xml; charset=utf-8",
        "cache-control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=86400",
      },
    });
  }

  const epMatch = path.match(/^\/sitemap-episodios-(\d+)\.xml$/);
  if (epMatch) {
    const pageNum = parseInt(epMatch[1], 10) || 1;
    const animes = await getSitemapAnimeCatalog();
    const xml = generateEpisodeSitemapXml(animes, pageNum);
    return new Response(xml, {
      headers: {
        "content-type": "application/xml; charset=utf-8",
        "cache-control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=86400",
      },
    });
  }

  return next();
}
