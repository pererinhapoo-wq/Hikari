import { createFileRoute } from "@tanstack/react-router";
import { assertSameSiteRequest, CrossSiteRequestError } from "@/lib/auth/isolation.server";
import { requireAdminUser, AdminGuardError } from "@/lib/auth/admin-guard";

const MAX_REDIRECTS = 3;
const UPSTREAM_TIMEOUT_MS = 15000;
const MAX_PLAYLIST_BYTES = 2 * 1024 * 1024; // 2 MB

function isBlockedHostnameOrIp(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/^\[|\]$/g, "");
  if (!host) return true;

  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".home.arpa")
  ) {
    return true;
  }

  // IPv4 literals
  const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const a = Number(ipv4Match[1]);
    const b = Number(ipv4Match[2]);
    const c = Number(ipv4Match[3]);
    const d = Number(ipv4Match[4]);
    if (a > 255 || b > 255 || c > 255 || d > 255) return true;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  }

  // IPv6 loopback / private / link-local
  if (
    host === "::" ||
    host === "::1" ||
    host.startsWith("fc") ||
    host.startsWith("fd") ||
    host.startsWith("fe80:") ||
    host.startsWith("::ffff:127.") ||
    host.startsWith("::ffff:10.") ||
    host.startsWith("::ffff:192.168.") ||
    host.startsWith("::ffff:169.254.")
  ) {
    return true;
  }

  return false;
}

function validateSafeMediaUrl(rawUrl: string): URL | null {
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }
    if (parsed.username || parsed.password) {
      return null;
    }
    if (isBlockedHostnameOrIp(parsed.hostname)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function isM3u8Response(url: URL, contentType: string): boolean {
  const ct = contentType.toLowerCase();
  if (
    ct.includes("application/vnd.apple.mpegurl") ||
    ct.includes("application/x-mpegurl") ||
    ct.includes("audio/mpegurl")
  ) {
    return true;
  }
  return url.pathname.toLowerCase().endsWith(".m3u8");
}

function toProxyUrl(targetUrl: string): string {
  return `/api/video-proxy?url=${encodeURIComponent(targetUrl)}`;
}

function rewriteHlsPlaylist(playlistText: string, baseUrl: URL): string {
  const resolveAndProxy = (rawUri: string): string => {
    const trimmed = rawUri.trim();
    if (!trimmed) return rawUri;
    try {
      const resolved = new URL(trimmed, baseUrl).toString();
      if (!validateSafeMediaUrl(resolved)) {
        return rawUri;
      }
      return toProxyUrl(resolved);
    } catch {
      return rawUri;
    }
  };

  return playlistText
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith("#")) {
        // Rewrite URI="..." attributes inside #EXT-X-KEY, #EXT-X-MAP, #EXT-X-MEDIA, etc.
        return line.replace(/URI="([^"]+)"/gi, (_match, uri: string) => {
          return `URI="${resolveAndProxy(uri)}"`;
        });
      }
      return resolveAndProxy(trimmed);
    })
    .join("\n");
}

async function fetchWithSafeRedirects(
  initialUrl: URL,
  rangeHeader: string | null,
  signal: AbortSignal,
): Promise<{ response: Response; finalUrl: URL }> {
  let currentUrl = initialUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const headers = new Headers();
    if (rangeHeader) {
      headers.set("Range", rangeHeader);
    }
    headers.set("Accept", "*/*");

    const res = await fetch(currentUrl.toString(), {
      method: "GET",
      headers,
      redirect: "manual",
      signal,
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location || hop === MAX_REDIRECTS) {
        return { response: res, finalUrl: currentUrl };
      }
      let nextUrl: URL | null = null;
      try {
        nextUrl = validateSafeMediaUrl(new URL(location, currentUrl).toString());
      } catch {
        nextUrl = null;
      }
      if (!nextUrl) {
        throw new Error("Redirecionamento para destino não permitido.");
      }
      currentUrl = nextUrl;
      continue;
    }

    return { response: res, finalUrl: currentUrl };
  }

  throw new Error("Excesso de redirecionamentos ao buscar mídia.");
}

export const Route = createFileRoute("/api/video-proxy")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          assertSameSiteRequest();
          await requireAdminUser(request);

          const reqUrl = new URL(request.url);
          const rawTarget = reqUrl.searchParams.get("url") || "";
          const targetUrl = validateSafeMediaUrl(rawTarget);
          if (!targetUrl) {
            return Response.json(
              { error: "URL de vídeo inválida ou não permitida para captura." },
              { status: 400 },
            );
          }

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

          try {
            const rangeHeader = request.headers.get("range");
            const { response: upstream, finalUrl } = await fetchWithSafeRedirects(
              targetUrl,
              rangeHeader,
              controller.signal,
            );

            if (!upstream.ok && upstream.status !== 206) {
              return Response.json(
                { error: `Fonte remota retornou status ${upstream.status}.` },
                { status: upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502 },
              );
            }

            const contentType = upstream.headers.get("content-type") || "application/octet-stream";
            const lowerCt = contentType.toLowerCase();

            if (lowerCt.includes("text/html") || lowerCt.includes("application/xhtml")) {
              return Response.json(
                { error: "O link informado aponta para uma página HTML, não para um fluxo de vídeo direto." },
                { status: 415 },
              );
            }

            const outHeaders = new Headers();
            outHeaders.set("X-Content-Type-Options", "nosniff");
            outHeaders.set("Cache-Control", "private, max-age=300");

            if (isM3u8Response(finalUrl, contentType)) {
              const contentLength = Number(upstream.headers.get("content-length") || "0");
              if (contentLength > MAX_PLAYLIST_BYTES) {
                return Response.json(
                  { error: "Playlist HLS excede o tamanho máximo suportado." },
                  { status: 413 },
                );
              }
              const text = await upstream.text();
              if (text.length > MAX_PLAYLIST_BYTES) {
                return Response.json(
                  { error: "Playlist HLS excede o tamanho máximo suportado." },
                  { status: 413 },
                );
              }
              const rewritten = rewriteHlsPlaylist(text, finalUrl);
              outHeaders.set("Content-Type", "application/vnd.apple.mpegurl; charset=utf-8");
              return new Response(rewritten, {
                status: 200,
                headers: outHeaders,
              });
            }

            outHeaders.set("Content-Type", contentType);
            const acceptRanges = upstream.headers.get("accept-ranges");
            if (acceptRanges) outHeaders.set("Accept-Ranges", acceptRanges);
            const contentRange = upstream.headers.get("content-range");
            if (contentRange) outHeaders.set("Content-Range", contentRange);
            const contentLength = upstream.headers.get("content-length");
            if (contentLength) outHeaders.set("Content-Length", contentLength);

            return new Response(upstream.body, {
              status: upstream.status === 206 ? 206 : 200,
              headers: outHeaders,
            });
          } finally {
            clearTimeout(timeoutId);
          }
        } catch (err) {
          if (err instanceof CrossSiteRequestError) {
            return Response.json({ error: "Origem cruzada não permitida." }, { status: 403 });
          }
          if (err instanceof AdminGuardError) {
            return Response.json({ error: err.message }, { status: err.status });
          }
          const isAbort = err instanceof Error && err.name === "AbortError";
          return Response.json(
            {
              error: isAbort
                ? "Tempo limite excedido ao acessar o vídeo remoto via proxy."
                : err instanceof Error
                  ? err.message
                  : "Falha ao acessar vídeo remoto.",
            },
            { status: isAbort ? 504 : 502 },
          );
        }
      },
    },
  },
});
