import { createFileRoute } from "@tanstack/react-router";

function isPrivateIpOrHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h === "::1" ||
    h.endsWith(".local") ||
    h.endsWith(".internal")
  ) {
    return true;
  }

  // Verifica faixas de IP privadas
  const parts = h.split(".").map(Number);
  if (parts.length === 4 && parts.every((p) => !isNaN(p) && p >= 0 && p <= 255)) {
    if (parts[0] === 10) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
  }
  return false;
}

async function handleProxy({ request }: { request: Request }) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
        "Access-Control-Allow-Headers": "*",
      },
    });
  }

  const urlObj = new URL(request.url);
  const targetUrl = urlObj.searchParams.get("url");

  if (!targetUrl) {
    return Response.json({ error: "Parâmetro 'url' é obrigatório." }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return Response.json({ error: "URL inválida." }, { status: 400 });
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return Response.json({ error: "Protocolo não permitido." }, { status: 400 });
  }

  if (isPrivateIpOrHost(parsed.hostname)) {
    return Response.json({ error: "Endereço restrito." }, { status: 403 });
  }

  try {
    const incomingRange = request.headers.get("range");
    const rangeHeader = incomingRange || "bytes=0-10485760"; // Até 10MB para captura de frame

    const upstreamHeaders: Record<string, string> = {
      Range: rangeHeader,
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    };

    const upstream = await fetch(targetUrl, {
      method: "GET",
      headers: upstreamHeaders,
    });

    if (!upstream.ok && upstream.status !== 206) {
      return Response.json(
        { error: `Erro no servidor de origem (${upstream.status})` },
        { status: upstream.status },
      );
    }

    const responseHeaders = new Headers();
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    responseHeaders.set("Access-Control-Allow-Headers", "*");
    responseHeaders.set("Content-Type", upstream.headers.get("content-type") || "video/mp4");

    if (upstream.headers.get("content-range")) {
      responseHeaders.set("Content-Range", upstream.headers.get("content-range")!);
    }
    if (upstream.headers.get("content-length")) {
      responseHeaders.set("Content-Length", upstream.headers.get("content-length")!);
    }
    responseHeaders.set("Accept-Ranges", "bytes");
    responseHeaders.set("Cache-Control", "public, max-age=3600");

    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Falha ao acessar vídeo remoto." },
      { status: 502 },
    );
  }
}

export const Route = createFileRoute("/api/video-proxy")({
  server: {
    handlers: {
      GET: handleProxy,
      OPTIONS: handleProxy,
    },
  },
});
