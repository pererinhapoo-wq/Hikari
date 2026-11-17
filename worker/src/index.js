const ALLOWED = ['maximaimg.online'];        // sufixos de host permitidos (evita proxy aberto)
const HOSTS_FALLBACK = ['cdn-sv02', 'cdn-sv03']; // tenta trocar sv01 por estes em caso de 429
const TTL_PLAYLIST = 5;    // s
const TTL_SEGMENT = 3600;  // s

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-expose-headers': 'Content-Length, Content-Range, Accept-Ranges',
};

function allowed(host) {
  return ALLOWED.some((s) => host === s || host.endsWith('.' + s));
}

function refererFor(host) {
  for (const [suffix, ref] of Object.entries(REFERERS || {})) {
    if (host === suffix || host.endsWith('.' + suffix)) return ref;
  }
  return null;
}

function proxyUrl(abs) {
  return '/hls?u=' + encodeURIComponent(abs);
}

async function fetchUpstream(target, extra = {}) {
  const h = new Headers(extra);
  h.set('User-Agent', UA);
  const ref = refererFor(target.host);
  if (ref) h.set('Referer', ref);
  h.set('Accept', '*/*');
  return fetch(target.href, { headers: h, redirect: 'follow' });
}

// troca sv01 -> sv02/sv03 quando vem 429
async function fetchWithHostRotation(target, extra) {
  let res = await fetchUpstream(target, extra);
  if (res.status !== 429) return res;
  for (const alt of HOSTS_FALLBACK) {
    const host = target.host.replace(/^cdn-sv\d+/, alt);
    if (host === target.host) continue;
    const clone = new URL(target.href);
    clone.host = host;
    res = await fetchUpstream(clone, extra);
    if (res.status !== 429) return res;
  }
  return res;
}

function rewritePlaylist(text, base, req) {
  const abs = (u) => new URL(u.trim(), base).href;
  // atributos URI="" (EXT-X-KEY, EXT-X-MAP, EXT-X-MEDIA)
  text = text.replace(/URI="([^"]+)"/g, (_, u) => `URI="${proxyUrl(abs(u))}"`);
  // linhas de URI (segmentos e variantes)
  text = text.replace(/^(?!#)(.+)$/gm, (line) => (line.trim() ? proxyUrl(abs(line)) : line));
  return text;
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { ...CORS, 'access-control-allow-headers': '*' } });
    }

    if (url.pathname !== '/hls') return new Response('HIKARI HLS proxy', { status: 200 });

    const raw = url.searchParams.get('u');
    if (!raw) return new Response('missing u', { status: 400 });

    let target;
    try { target = new URL(raw); } catch { return new Response('bad u', { status: 400 }); }
    if (!allowed(target.host)) return new Response('host not allowed', { status: 403 });

    const isPlaylist = target.pathname.endsWith('.m3u8') || target.pathname.endsWith('.m3u');

    if (isPlaylist) {
      const key = 'p:' + target.href;
      const cached = await env.URL_CACHE?.get(key);
      if (cached) {
        return new Response(cached, {
          headers: { 'content-type': 'application/vnd.apple.mpegurl', ...CORS, 'cache-control': `public, max-age=${TTL_PLAYLIST}` }
        });
      }
      const res = await fetchWithHostRotation(target);
      if (!res.ok) return new Response('upstream ' + res.status, { status: 502, headers: CORS });

      const text = rewritePlaylist(await res.text(), target, req);
      await env.URL_CACHE?.put(key, text, { expirationTtl: TTL_PLAYLIST });
      return new Response(text, {
        headers: { 'content-type': 'application/vnd.apple.mpegurl', ...CORS, 'cache-control': `public, max-age=${TTL_PLAYLIST}` }
      });
    }

    // segmento: repassa Range e status (206) sem bufferizar
    const extra = {};
    const range = req.headers.get('Range');
    if (range) extra['Range'] = range;

    const res = await fetchWithHostRotation(target, extra);
    if (!res.ok && res.status !== 206) return new Response('upstream ' + res.status, { status: 502, headers: CORS });

    const out = new Headers(CORS);
    out.set('content-type', res.headers.get('content-type') || 'application/octet-stream');
    out.set('accept-ranges', 'bytes');
    const cr = res.headers.get('content-range'); if (cr) out.set('content-range', cr);
    const cl = res.headers.get('content-length'); if (cl) out.set('content-length', cl);
    out.set('cache-control', `public, max-age=${TTL_SEGMENT}, immutable`);

    return new Response(res.body, { status: res.status, headers: out });
  }
};
