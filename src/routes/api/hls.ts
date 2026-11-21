import { createFileRoute } from "@tanstack/react-router";
import {
  getRedisSegMode,
  setRedisSegMode,
  getRedisPlaylistCache,
  setRedisPlaylistCache,
} from "@/lib/redis";

const ALLOWED = ["maximaimg.online"];
const DEFAULT_REFERERS: Record<string, string> = {
  "maximaimg.online": "https://api.anivideo.net/",
  "animesdigital.org": "https://animesdigital.org/",
  "api.anivideo.net": "https://animesdigital.org/",
};

const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-expose-headers": "Content-Length, Content-Range, Accept-Ranges",
};

const noRefererHosts = new Set<string>();

function fail(msg: string, status: number): Response {
  return new Response(msg, { status, headers: CORS });
}

function allowed(host: string): boolean {
  const hostname = host.split(":")[0].toLowerCase();
  return ALLOWED.some((s) => hostname === s || hostname.endsWith("." + s));
}

function getReferers(): Record<string, string> {
  const raw = typeof process !== "undefined" ? process.env?.REFERERS : undefined;
  if (!raw) return DEFAULT_REFERERS;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, string>;
    }
  } catch {
    return { "maximaimg.online": raw };
  }
  return DEFAULT_REFERERS;
}

function refererFor(host: string): string | null {
  const hostname = host.split(":")[0].toLowerCase();
  const referers = getReferers();
  for (const [suffix, ref] of Object.entries(referers)) {
    if (hostname === suffix || hostname.endsWith("." + suffix)) {
      return ref;
    }
  }
  return null;
}

function originFromReferer(ref: string): string {
  try {
    return new URL(ref).origin;
  } catch {
    return ref.replace(/\/+$/, "");
  }
}

async function fetchUpstream(
  target: URL,
  extra: Record<string, string> = {},
  method = "GET",
  refVal: string | null = null,
  includeReferer = true,
): Promise<Response> {
  const h = new Headers(extra);
  const ua = (typeof process !== "undefined" ? process.env?.UA : undefined) || DEFAULT_UA;
  h.set("User-Agent", ua);
  h.set("Accept", "*/*");
  if (includeReferer) {
    if (!refVal) {
      throw new Error("referer não configurado para " + target.host);
    }
    h.set("Referer", refVal);
    h.set("Origin", originFromReferer(refVal));
  }
  return fetch(target.href, {
    method,
    headers: h,
    redirect: "follow",
    signal: AbortSignal.timeout(15000),
  });
}

async function fetchWithHostRotation(
  target: URL,
  extra: Record<string, string> = {},
  method = "GET",
  refVal: string,
): Promise<{ res: Response; noRefererStatus: number | null }> {
  const hostKey = target.host.toLowerCase();
  const useReferer = !noRefererHosts.has(hostKey);

  let res = await fetchUpstream(target, extra, method, refVal, useReferer);
  if (res.status === 405 && method === "HEAD") {
    res = await fetchUpstream(target, extra, "GET", refVal, useReferer);
  }

  if (res.status === 403 && useReferer) {
    let noRefRes = await fetchUpstream(target, extra, method, refVal, false);
    if (noRefRes.status === 405 && method === "HEAD") {
      noRefRes = await fetchUpstream(target, extra, "GET", refVal, false);
    }
    if (noRefRes.status === 200 || noRefRes.status === 206) {
      noRefererHosts.add(hostKey);
      return { res: noRefRes, noRefererStatus: noRefRes.status };
    }
    return { res, noRefererStatus: noRefRes.status };
  }

  if (res.status !== 429) {
    return { res, noRefererStatus: null };
  }

  const rawFallbacks =
    typeof process !== "undefined" ? process.env?.HOSTS_FALLBACK : undefined;
  const fallbacks = rawFallbacks ? rawFallbacks.split(",") : [];
  for (const alt of fallbacks) {
    const cleanAlt = alt.trim();
    if (!cleanAlt || cleanAlt.includes("cdn-sv02")) continue;
    const host = target.host.replace(/^cdn-sv\d+/, cleanAlt);
    if (host === target.host) continue;
    const clone = new URL(target.href);
    clone.host = host;
    try {
      res = await fetchUpstream(clone, extra, method, refVal, useReferer);
      if (res.status === 405 && method === "HEAD") {
        res = await fetchUpstream(clone, extra, "GET", refVal, useReferer);
      }
      if (res.status !== 429) {
        return { res, noRefererStatus: null };
      }
    } catch {
      // ignore upstream fetch error in fallback
    }
  }
  return { res, noRefererStatus: null };
}

function rewritePlaylist(
  text: string,
  base: URL,
  proxyUrl: (abs: string) => string,
  segMode: string,
): string {
  const abs = (u: string) => new URL(u.trim(), base).href;
  text = text.replace(/URI="([^"]+)"/g, (_, u: string) => {
    const absUrl = abs(u);
    return `URI="${segMode === "proxy" ? proxyUrl(absUrl) : absUrl}"`;
  });
  text = text.replace(/^(?!#)(.+)$/gm, (line: string) => {
    if (!line.trim()) return line;
    const absUrl = abs(line);
    return segMode === "proxy" ? proxyUrl(absUrl) : absUrl;
  });
  return text;
}

async function handleHlsProxy(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: { ...CORS, "access-control-allow-headers": "*" },
    });
  }

  const url = new URL(req.url);
  const proxyseg = url.searchParams.get("proxyseg") === "1";
  const MOUNT = url.pathname;
  function proxyUrl(abs: string): string {
    return MOUNT + "?u=" + encodeURIComponent(abs);
  }

  const raw = url.searchParams.get("u");
  if (!raw) {
    return fail("missing u", 400);
  }

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return fail("bad u", 400);
  }

  if (target.protocol !== "https:" && target.protocol !== "http:") {
    return fail("bad u", 400);
  }

  if (!allowed(target.host)) {
    return fail("host not allowed", 403);
  }

  const hostKey = target.host.toLowerCase();
  if (proxyseg) {
    await setRedisSegMode(hostKey, "proxy", 3600);
  }

  const currentSegMode = (await getRedisSegMode(hostKey)) || "direct";

  const refVal = refererFor(target.host);
  if (!refVal) {
    return fail("referer não configurado para " + target.host, 502);
  }

  const lowerTargetPath = target.pathname.toLowerCase();
  const isPlaylist =
    lowerTargetPath.endsWith(".m3u8") || lowerTargetPath.endsWith(".m3u");
  const upstreamMethod = req.method === "HEAD" ? "HEAD" : "GET";

  if (isPlaylist) {
    if (upstreamMethod === "GET") {
      const cached = await getRedisPlaylistCache(target.href);
      if (cached) {
        const rewrittenCached = rewritePlaylist(cached, target, proxyUrl, currentSegMode);
        return new Response(rewrittenCached, {
          headers: {
            "content-type": "application/vnd.apple.mpegurl",
            ...CORS,
            "cache-control": "public, max-age=5, stale-while-revalidate=30",
            "cdn-cache-control": "public, max-age=5, stale-while-revalidate=30",
          },
        });
      }
    }

    let res: Response;
    try {
      const result = await fetchWithHostRotation(target, {}, upstreamMethod, refVal);
      res = result.res;
    } catch (err) {
      return fail(
        err instanceof Error ? err.message : "upstream fetch failed",
        502,
      );
    }

    if (res.status === 403 || res.status === 404 || !res.ok) {
      return fail("upstream " + res.status, 502);
    }

    if (upstreamMethod === "HEAD") {
      return new Response(null, {
        status: 200,
        headers: {
          "content-type": "application/vnd.apple.mpegurl",
          ...CORS,
          "cache-control": "public, max-age=5, stale-while-revalidate=30",
          "cdn-cache-control": "public, max-age=5, stale-while-revalidate=30",
        },
      });
    }

    const body = await res.text();
    if (!body.startsWith("#EXTM3U")) {
      return fail("upstream não devolveu HLS", 502);
    }

    await setRedisPlaylistCache(target.href, body, 5);

    const text = rewritePlaylist(body, target, proxyUrl, currentSegMode);
    return new Response(text, {
      headers: {
        "content-type": "application/vnd.apple.mpegurl",
        ...CORS,
        "cache-control": "public, max-age=5, stale-while-revalidate=30",
        "cdn-cache-control": "public, max-age=5, stale-while-revalidate=30",
      },
    });
  }

  // Segmento
  const extra: Record<string, string> = {};
  const range = req.headers.get("Range");
  if (range) extra["Range"] = range;

  let res: Response;
  try {
    const result = await fetchWithHostRotation(target, extra, upstreamMethod, refVal);
    res = result.res;
  } catch (err) {
    return fail(
      err instanceof Error ? err.message : "upstream fetch failed",
      502,
    );
  }

  if (!res.ok && res.status !== 206) {
    return fail("upstream " + res.status, 502);
  }

  const out = new Headers(CORS);
  out.set(
    "content-type",
    res.headers.get("content-type") || "application/octet-stream",
  );
  out.set("accept-ranges", "bytes");
  const cr = res.headers.get("content-range");
  if (cr) out.set("content-range", cr);
  const cl = res.headers.get("content-length");
  if (cl) out.set("content-length", cl);
  out.set("cache-control", "public, max-age=31536000, immutable");
  out.set("cdn-cache-control", "public, max-age=31536000, immutable");

  return new Response(upstreamMethod === "HEAD" ? null : res.body, {
    status: res.status,
    headers: out,
  });
}

export const Route = createFileRoute("/api/hls")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => handleHlsProxy(request),
      HEAD: async ({ request }) => handleHlsProxy(request),
      GET: async ({ request }) => handleHlsProxy(request),
    },
  },
});
