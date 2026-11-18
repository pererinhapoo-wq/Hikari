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
    headers.set("Vary", "Accept-Encoding");

    if (
      path.startsWith("/api/") ||
      path.includes("progresso") ||
      path.includes("favoritos") ||
      path.includes("sessao") ||
      path.includes("session")
    ) {
      headers.set("Cache-Control", "private, no-store");
    } else if (path.startsWith("/watch/")) {
      headers.set(
        "Cache-Control",
        "public, s-maxage=600, stale-while-revalidate=86400",
      );
    } else if (
      path === "/" ||
      path.startsWith("/browse") ||
      path.startsWith("/anime/") ||
      path === "/calendar" ||
      path === "/episodes" ||
      path.startsWith("/season/") ||
      path.startsWith("/search")
    ) {
      headers.set(
        "Cache-Control",
        "public, s-maxage=300, stale-while-revalidate=86400",
      );
    }

    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers,
    });
  }

  return res;
}
