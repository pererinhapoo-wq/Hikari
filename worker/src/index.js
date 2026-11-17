const ALLOWED = ['maximaimg.online'];
const DEFAULT_REFERERS = {
  "maximaimg.online": "https://animefire.plus/"
};

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-expose-headers': 'Content-Length, Content-Range, Accept-Ranges',
};

function allowed(host) {
  return ALLOWED.some((s) => host === s || host.endsWith('.' + s));
}

function getReferers(env) {
  return env?.REFERERS || DEFAULT_REFERERS;
}

function refererFor(host, env) {
  const referers = getReferers(env);
  for (const [suffix, ref] of Object.entries(referers)) {
    if (host === suffix || host.endsWith('.' + suffix)) return ref;
  }
  return null;
}

function proxyUrl(abs) {
  return '/hls?u=' + encodeURIComponent(abs);
}

async function fetchUpstream(target, env, extra = {}) {
  const ref = refererFor(target.host, env);
  if (!ref) {
    throw new Error(`referer não configurado para ${target.host}`);
  }
  const h = new Headers(extra);
  h.set('User-Agent', env.UA || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36');
  h.set('Referer', ref);
  h.set('Accept', '*/*');
  return fetch(target.href, { headers: h, redirect: 'follow' });
}

// Só rotacionar em 429 (remover cdn-sv02/03 inválidos)
async function fetchWithHostRotation(target, env, extra) {
  let res;
  try {
    res = await fetchUpstream(target, env, extra);
  } catch (err) {
    throw err;
  }
  if (res.status !== 429) return res;

  const fallbacks = env.HOSTS_FALLBACK ? (typeof env.HOSTS_FALLBACK === 'string' ? env.HOSTS_FALLBACK.split(',') : env.HOSTS_FALLBACK) : [];
  for (const alt of fallbacks) {
    const cleanAlt = alt.trim();
    if (!cleanAlt) continue;
    const host = target.host.replace(/^cdn-sv\d+/, cleanAlt);
    if (host === target.host) continue;
    const clone = new URL(target.href);
    clone.host = host;
    try {
      res = await fetchUpstream(clone, env, extra);
      if (res.status !== 429) return res;
    } catch {}
  }
  return res;
}

function rewritePlaylist(text, base, req) {
  const abs = (u) => new URL(u.trim(), base).href;
  text = text.replace(/URI="([^"]+)"/g, (_, u) => `URI="${proxyUrl(abs(u))}"`);
  text = text.replace(/^(?!#)(.+)$/gm, (line) => (line.trim() ? proxyUrl(abs(line)) : line));
  return text;
}

// Resolução de página: extrai e testa candidatas m3u8
async function resolvePageToDirectUrl(pageUrl, env) {
  let pageRes;
  const ref = refererFor(new URL(pageUrl).host, env) || "https://animefire.plus/";
  try {
    pageRes = await fetch(pageUrl, {
      headers: {
        "User-Agent": env.UA || "Mozilla/5.0",
        "Referer": ref,
      },
    });
  } catch {
    return null;
  }
  if (!pageRes.ok) return null;
  const html = await pageRes.text();

  const regex = /\/stream\/[^"'\s]+\.m3u8/g;
  const matches = html.match(regex) || [];
  const uniqueCandidates = Array.from(new Set(matches));

  const parsedPage = new URL(pageUrl);
  for (const cand of uniqueCandidates) {
    const fullUrl = new URL(cand, parsedPage.origin).href;
    try {
      const testRes = await fetch(fullUrl, {
        method: "HEAD",
        headers: {
          "User-Agent": env.UA || "Mozilla/5.0",
          "Referer": ref,
        },
      });
      if (testRes.ok || testRes.status === 206) {
        return fullUrl;
      }
    } catch {
      // tenta GET se HEAD falhar
      try {
        const testRes = await fetch(fullUrl, {
          headers: {
            "User-Agent": env.UA || "Mozilla/5.0",
            "Referer": ref,
          },
        });
        if (testRes.ok || testRes.status === 206) {
          return fullUrl;
        }
      } catch {}
    }
  }
  return null;
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { ...CORS, 'access-control-allow-headers': '*' } });
    }

    // Endpoint de resolução /resolve?page_url=...
    if (url.pathname === '/resolve') {
      const pageUrl = url.searchParams.get('page_url');
      if (!pageUrl) return new Response(JSON.stringify({ error: 'missing page_url' }), { status: 400, headers: { 'content-type': 'application/json', ...CORS } });

      const cacheKey = 'res:' + pageUrl;
      const cached = await env.URL_CACHE?.get(cacheKey);
      if (cached) {
        return new Response(JSON.stringify({ directUrl: cached }), { status: 200, headers: { 'content-type': 'application/json', ...CORS } });
      }

      const directUrl = await resolvePageToDirectUrl(pageUrl, env);
      if (!directUrl) {
        return new Response(JSON.stringify({ error: 'resolution failed' }), { status: 404, headers: { 'content-type': 'application/json', ...CORS } });
      }

      await env.URL_CACHE?.put(cacheKey, directUrl, { expirationTtl: 300 });
      return new Response(JSON.stringify({ directUrl }), { status: 200, headers: { 'content-type': 'application/json', ...CORS } });
    }

    if (url.pathname !== '/hls') return new Response('HIKARI HLS proxy', { status: 200 });

    const raw = url.searchParams.get('u');
    if (!raw) return new Response('missing u', { status: 400 });

    let target;
    try { target = new URL(raw); } catch { return new Response('bad u', { status: 400 }); }

    if (!allowed(target.host)) return new Response('host not allowed', { status: 403 });

    let refVal = "";
    try {
      refVal = refererFor(target.host, env) || "";
      if (!refVal) {
        return new Response(`referer não configurado para ${target.host}`, { status: 502, headers: CORS });
      }
    } catch (err) {
      return new Response(err.message, { status: 502, headers: CORS });
    }

    const isPlaylist = target.pathname.endsWith('.m3u8') || target.pathname.endsWith('.m3u');

    if (isPlaylist) {
      const key = 'p:' + target.href;
      const cached = await env.URL_CACHE?.get(key);
      if (cached) {
        return new Response(cached, {
          headers: { 'content-type': 'application/vnd.apple.mpegurl', ...CORS, 'cache-control': `public, max-age=5` }
        });
      }

      let res;
      try {
        res = await fetchWithHostRotation(target, env);
      } catch (err) {
        return new Response(err.message, { status: 502, headers: CORS });
      }

      // Diagnóstico de 403 ou 404
      if (res.status === 403 || res.status === 404) {
        // Invalida cache KV se upstream retornar 403
        if (res.status === 403) {
          await env.URL_CACHE?.delete(key);
        }
        return new Response(`upstream ${res.status} | referer=${refVal} | url=${target.href}`, { status: 502, headers: CORS });
      }

      if (!res.ok) return new Response('upstream ' + res.status, { status: 502, headers: CORS });

      const text = rewritePlaylist(await res.text(), target, req);
      await env.URL_CACHE?.put(key, text, { expirationTtl: 5 });
      return new Response(text, {
        headers: { 'content-type': 'application/vnd.apple.mpegurl', ...CORS, 'cache-control': `public, max-age=5` }
      });
    }

    // Segmento
    const extra = {};
    const range = req.headers.get('Range');
    if (range) extra['Range'] = range;

    let res;
    try {
      res = await fetchWithHostRotation(target, env, extra);
    } catch (err) {
      return new Response(err.message, { status: 502, headers: CORS });
    }

    if (res.status === 403 || res.status === 404) {
      return new Response(`upstream ${res.status} | referer=${refVal} | url=${target.href}`, { status: 502, headers: CORS });
    }

    if (!res.ok && res.status !== 206) return new Response('upstream ' + res.status, { status: 502, headers: CORS });

    const out = new Headers(CORS);
    out.set('content-type', res.headers.get('content-type') || 'application/octet-stream');
    out.set('accept-ranges', 'bytes');
    const cr = res.headers.get('content-range'); if (cr) out.set('content-range', cr);
    const cl = res.headers.get('content-length'); if (cl) out.set('content-length', cl);
    out.set('cache-control', `public, max-age=3600, immutable`);

    return new Response(res.body, { status: res.status, headers: out });
  }
};
