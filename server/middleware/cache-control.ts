export default async function cacheControlMiddleware(
  event: { url: URL; req: { method: string; headers: Headers } },
  next: () => unknown | Promise<unknown>,
): Promise<unknown> {
  const method = (event.req.method ?? "GET").toUpperCase();
  if (method !== "GET") {
    return next();
  }

  const path = event.url.pathname;
  const res = await next();

  if (res instanceof Response) {
    const headers = new Headers(res.headers);
    
    // Regra 4: Vary: Accept-Encoding mantido; nunca Vary: Cookie.
    headers.set("Vary", "Accept-Encoding");

    // Regra 1 & 3: Excluir /api/proxy/stream, /api/embed, /api/hls do no-store automático.
    // Deixa intacto se o handler já enviou Cache-Control (Regra 2).
    const isMediaOrEmbedRoute =
      path.startsWith("/api/proxy/stream") ||
      path.startsWith("/api/embed") ||
      path.startsWith("/api/hls");

    const hasExistingCacheControl = headers.has("Cache-Control");

    if (!hasExistingCacheControl && !isMediaOrEmbedRoute) {
      if (
        path.startsWith("/admin") ||
        path.startsWith("/login") ||
        path.startsWith("/api/") ||
        path.includes("progresso") ||
        path.includes("favoritos") ||
        path.includes("sessao") ||
        path.includes("session")
      ) {
        headers.set("Cache-Control", "private, no-store");
      } else if (path.startsWith("/anime/")) {
        headers.set(
          "Cache-Control",
          "public, s-maxage=60, stale-while-revalidate=300, stale-if-error=86400",
        );
        headers.set(
          "CDN-Cache-Control",
          "public, s-maxage=60, stale-while-revalidate=300, stale-if-error=86400",
        );
      } else if (
        path === "/" ||
        path.startsWith("/browse") ||
        path.startsWith("/search") ||
        path === "/calendar" ||
        path === "/episodes" ||
        path.startsWith("/news")
      ) {
        headers.set(
          "Cache-Control",
          "public, s-maxage=300, stale-while-revalidate=900, stale-if-error=86400",
        );
        headers.set(
          "CDN-Cache-Control",
          "public, s-maxage=300, stale-while-revalidate=900, stale-if-error=86400",
        );
      }
    }

    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers,
    });
  }

  return res;
}
