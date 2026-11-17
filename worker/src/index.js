const ALLOWED = ['maximaimg.online'];
const DEFAULT_REFERERS = {
  'maximaimg.online': 'https://animefire.plus/',
};

const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-expose-headers': 'Content-Length, Content-Range, Accept-Ranges',
};

function fail(msg, status) {
  return new Response(msg, { status, headers: CORS });
}

function allowed(host) {
  return ALLOWED.some((s) => host === s || host.endsWith('.' + s));
}

function getReferers(env) {
  const raw = env?.REFERERS;
  if (!raw) return DEFAULT_REFERERS;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {
      return DEFAULT_REFERERS;
    }
  }
  if (typeof raw === 'object') return raw;
  return DEFAULT_REFERERS;
}

function refererFor(host, env) {
  const referers = getReferers(env);
  for (const [suffix, ref] of Object.entries(referers)) {
    if (host === suffix || host.endsWith('.' + suffix)) return ref;
  }
  return null;
}

async function fetchUpstream(target, env, extra = {}, method = 'GET') {
  const ref = refererFor(target.host, env);
  if (!ref) {
    throw new Error(`referer não configurado para ${target.host}`);
  }
  const h = new Headers(extra);
  h.set('User-Agent', env?.UA || DEFAULT_UA);
  h.set('Referer', ref);
  h.set('Accept', '*/*');
  return fetch(target.href, { method, headers: h, redirect: 'follow' });
}

// Só rotacionar em 429 (sem cdn-sv02)
async function fetchWithHostRotation(target, env, extra = {}, method = 'GET') {
  let res = await fetchUpstream(target, env, extra, method);
  if (res.status === 405 && method === 'HEAD') {
    res = await fetchUpstream(target, env, extra, 'GET');
  }
  if (res.status !== 429) return res;

  const fallbacks = env?.HOSTS_FALLBACK
    ? typeof env.HOSTS_FALLBACK === 'string'
      ? env.HOSTS_FALLBACK.split(',')
      : env.HOSTS_FALLBACK
    : [];
  for (const alt of fallbacks) {
    const cleanAlt = String(alt).trim();
    if (!cleanAlt || cleanAlt.includes('cdn-sv02')) continue;
    const host = target.host.replace(/^cdn-sv\d+/, cleanAlt);
    if (host === target.host) continue;
    const clone = new URL(target.href);
    clone.host = host;
    try {
      res = await fetchUpstream(clone, env, extra, method);
      if (res.status === 405 && method === 'HEAD') {
        res = await fetchUpstream(clone, env, extra, 'GET');
      }
      if (res.status !== 429) return res;
    } catch {
      // ignora erro de fallback e tenta próximo host
    }
  }
  return res;
}

function rewritePlaylist(text, base, proxyUrl) {
  const abs = (u) => new URL(u.trim(), base).href;
  text = text.replace(/URI="([^"]+)"/g, (_, u) => `URI="${proxyUrl(abs(u))}"`);
  text = text.replace(/^(?!#)(.+)$/gm, (line) => (line.trim() ? proxyUrl(abs(line)) : line));
  return text;
}

// Resolução de página: extrai e testa candidatas m3u8
async function resolvePageToDirectUrl(pageUrl, env) {
  let pageRes;
  const ref = refererFor(new URL(pageUrl).host, env) || 'https://animefire.plus/';
  try {
    pageRes = await fetch(pageUrl, {
      headers: {
        'User-Agent': env?.UA || DEFAULT_UA,
        Referer: ref,
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
        method: 'HEAD',
        headers: {
          'User-Agent': env?.UA || DEFAULT_UA,
          Referer: ref,
        },
      });
      if (testRes.ok || testRes.status === 206) {
        return fullUrl;
      }
    } catch {
      try {
        const testRes = await fetch(fullUrl, {
          headers: {
            'User-Agent': env?.UA || DEFAULT_UA,
            Referer: ref,
          },
        });
        if (testRes.ok || testRes.status === 206) {
          return fullUrl;
        }
      } catch {
        // ignora falha de candidata
      }
    }
  }
  return null;
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: { ...CORS, 'access-control-allow-headers': '*' },
      });
    }

    const url = new URL(req.url);
    const MOUNT = url.pathname;
    function proxyUrl(abs) {
      return MOUNT + '?u=' + encodeURIComponent(abs);
    }

    // Endpoint de resolução ?page_url=...
    if (url.pathname.endsWith('/resolve')) {
      const pageUrl = url.searchParams.get('page_url');
      if (!pageUrl) {
        return new Response(JSON.stringify({ error: 'missing page_url' }), {
          status: 400,
          headers: { 'content-type': 'application/json', ...CORS },
        });
      }

      const cacheKey = 'res:' + pageUrl;
      const cached = await env?.URL_CACHE?.get(cacheKey);
      if (cached) {
        return new Response(JSON.stringify({ directUrl: cached }), {
          status: 200,
          headers: { 'content-type': 'application/json', ...CORS },
        });
      }

      const directUrl = await resolvePageToDirectUrl(pageUrl, env);
      if (!directUrl) {
        return new Response(JSON.stringify({ error: 'resolution failed' }), {
          status: 404,
          headers: { 'content-type': 'application/json', ...CORS },
        });
      }

      await env?.URL_CACHE?.put(cacheKey, directUrl, { expirationTtl: 300 });
      return new Response(JSON.stringify({ directUrl }), {
        status: 200,
        headers: { 'content-type': 'application/json', ...CORS },
      });
    }

    const raw = url.searchParams.get('u');
    if (!raw) {
      if (MOUNT === '/' || MOUNT === '') {
        return new Response('HIKARI HLS proxy', { status: 200, headers: CORS });
      }
      return fail('missing u', 400);
    }

    let target;
    try {
      target = new URL(raw);
    } catch {
      return fail('bad u', 400);
    }

    if (!allowed(target.host)) {
      return fail('host not allowed', 403);
    }

    const refVal = refererFor(target.host, env);
    if (!refVal) {
      return fail('referer não configurado para ' + target.host, 502);
    }

    const lowerTargetPath = target.pathname.toLowerCase();
    const isPlaylist = lowerTargetPath.endsWith('.m3u8') || lowerTargetPath.endsWith('.m3u');
    const upstreamMethod = req.method === 'HEAD' ? 'HEAD' : 'GET';

    if (isPlaylist) {
      const key = 'p:' + target.href;
      if (upstreamMethod === 'GET') {
        const cached = await env?.URL_CACHE?.get(key);
        if (cached) {
          return new Response(cached, {
            headers: {
              'content-type': 'application/vnd.apple.mpegurl',
              ...CORS,
              'cache-control': 'public, max-age=5',
            },
          });
        }
      }

      let res;
      try {
        res = await fetchWithHostRotation(target, env, {}, upstreamMethod);
      } catch (err) {
        return fail(err instanceof Error ? err.message : 'upstream fetch failed', 502);
      }

      if (res.status === 403 || res.status === 404) {
        if (res.status === 403) {
          await env?.URL_CACHE?.delete(key);
        }
        return fail('upstream ' + res.status + ' | referer=' + refVal + ' | url=' + target.href, 502);
      }

      if (!res.ok) {
        return fail('upstream ' + res.status, 502);
      }

      if (upstreamMethod === 'HEAD') {
        return new Response(null, {
          status: 200,
          headers: {
            'content-type': 'application/vnd.apple.mpegurl',
            ...CORS,
            'cache-control': 'public, max-age=5',
          },
        });
      }

      const body = await res.text();
      if (!body.startsWith('#EXTM3U')) {
        return fail(
          'upstream não devolveu HLS (status ' + res.status + '): ' + body.slice(0, 200),
          502,
        );
      }

      const text = rewritePlaylist(body, target, proxyUrl);
      await env?.URL_CACHE?.put(key, text, { expirationTtl: 5 });
      return new Response(text, {
        headers: {
          'content-type': 'application/vnd.apple.mpegurl',
          ...CORS,
          'cache-control': 'public, max-age=5',
        },
      });
    }

    // Segmento
    const extra = {};
    const range = req.headers.get('Range');
    if (range) extra['Range'] = range;

    let res;
    try {
      res = await fetchWithHostRotation(target, env, extra, upstreamMethod);
    } catch (err) {
      return fail(err instanceof Error ? err.message : 'upstream fetch failed', 502);
    }

    if (res.status === 403 || res.status === 404) {
      return fail('upstream ' + res.status + ' | referer=' + refVal + ' | url=' + target.href, 502);
    }

    if (!res.ok && res.status !== 206) {
      return fail('upstream ' + res.status, 502);
    }

    const out = new Headers(CORS);
    out.set('content-type', res.headers.get('content-type') || 'application/octet-stream');
    out.set('accept-ranges', 'bytes');
    const cr = res.headers.get('content-range');
    if (cr) out.set('content-range', cr);
    const cl = res.headers.get('content-length');
    if (cl) out.set('content-length', cl);
    out.set('cache-control', 'public, max-age=3600, immutable');

    return new Response(upstreamMethod === 'HEAD' ? null : res.body, {
      status: res.status,
      headers: out,
    });
  },
};
