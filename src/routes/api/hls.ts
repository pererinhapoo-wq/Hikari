import { createFileRoute } from "@tanstack/react-router";

const ALLOWED = ["maximaimg.online"];
const DEFAULT_REFERERS: Record<string, string> = {
  "maximaimg.online": "https://animefire.plus/",
};

const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-expose-headers": "Content-Length, Content-Range, Accept-Ranges",
};

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
    // Caso REFERERS seja passado como string única, aplica ao host padrão
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

async function fetchUpstream(
  target: URL,
  extra: Record<string, string> = {},
  method = "GET",
): Promise<Response> {
  const ref = refererFor(target.host);
  if (!ref) {
    throw new Error("referer não configurado para " + target.host);
  }
  const h = new Headers(extra);
  const ua = (typeof process !== "undefined" ? process.env?.UA : undefined) || DEFAULT_UA;
  h.set("User-Agent", ua);
  h.set("Referer", ref);
  h.set("Accept", "*/*");
  return fetch(target.href, {
    method,
    headers: h,
    redirect: "follow",
    signal: AbortSignal.timeout(15000),
  });
}

// Só rotacionar em 429 (sem cdn-sv02)
async function fetchWithHostRotation(
  target: URL,
  extra: Record<string, string> = {},
  method = "GET",
): Promise<Response> {
  let res = await fetchUpstream(target, extra, method);
  if (res.status === 405 && method === "HEAD") {
    res = await fetchUpstream(target, extra, "GET");
  }
  if (res.status !== 429) return res;

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
      res = await fetchUpstream(clone, extra, method);
      if (res.status === 405 && method === "HEAD") {
        res = await fetchUpstream(clone, extra, "GET");
      }
      if (res.status !== 429) return res;
    } catch {
      // ignora erro e tenta próximo host
    }
  }
  return res;
}

function rewritePlaylist(
  text: string,
  base: URL,
  proxyUrl: (abs: string) => string,
): string {
  const abs = (u: string) => new URL(u.trim(), base).href;
  text = text.replace(/URI="([^"]+)"/g, (_, u: string) => `URI="${proxyUrl(abs(u))}"`);
  text = text.replace(/^(?!#)(.+)$/gm, (line: string) =>
    line.trim() ? proxyUrl(abs(line)) : line,
  );
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

  const refVal = refererFor(target.host);
  if (!refVal) {
    return fail("referer não configurado para " + target.host, 502);
  }

  const lowerTargetPath = target.pathname.toLowerCase();
  const isPlaylist =
    lowerTargetPath.endsWith(".m3u8") || lowerTargetPath.endsWith(".m3u");
  const upstreamMethod = req.method === "HEAD" ? "HEAD" : "GET";

  if (isPlaylist) {
    let res: Response;
    try {
      res = await fetchWithHostRotation(target, {}, upstreamMethod);
    } catch (err) {
      return fail(
        err instanceof Error ? err.message : "upstream fetch failed",
        502,
      );
    }

    if (res.status === 403 || res.status === 404) {
      return fail(
        "upstream " + res.status + " | referer=" + refVal + " | url=" + target.href,
        502,
      );
    }

    if (!res.ok) {
      return fail("upstream " + res.status, 502);
    }

    if (upstreamMethod === "HEAD") {
      return new Response(null, {
        status: 200,
        headers: {
          "content-type": "application/vnd.apple.mpegurl",
          ...CORS,
          "cache-control": "public, max-age=5",
        },
      });
    }

    const body = await res.text();
    if (!body.startsWith("#EXTM3U")) {
      return fail(
        "upstream não devolveu HLS (status " + res.status + "): " + body.slice(0, 200),
        502,
      );
    }

    const text = rewritePlaylist(body, target, proxyUrl);
    return new Response(text, {
      headers: {
        "content-type": "application/vnd.apple.mpegurl",
        ...CORS,
        "cache-control": "public, max-age=5",
      },
    });
  }

  // Segmento (streaming sem bufferizar)
  const extra: Record<string, string> = {};
  const range = req.headers.get("Range");
  if (range) extra["Range"] = range;

  let res: Response;
  try {
    res = await fetchWithHostRotation(target, extra, upstreamMethod);
  } catch (err) {
    return fail(
      err instanceof Error ? err.message : "upstream fetch failed",
      502,
    );
  }

  if (res.status === 403 || res.status === 404) {
    return fail(
      "upstream " + res.status + " | referer=" + refVal + " | url=" + target.href,
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
  out.set("cache-control", "public, max-age=3600, immutable");

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
