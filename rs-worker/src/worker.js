// remoteStorage server on Cloudflare Workers + R2
// Implements draft-dejong-remotestorage-27 (application-first, implicit grant).
// One user per deployment. Data and tokens both live in one R2 bucket.

const SPEC = 'draft-dejong-remotestorage-27';
const REL = 'http://tools.ietf.org/id/draft-dejong-remotestorage';
const FOLDER_CONTEXT = 'http://remotestorage.io/spec/folder-description';
const DATA = 'data/';     // R2 prefix for user documents
const TOKENS = 'tokens/'; // R2 prefix for bearer tokens (stored by SHA-256, never raw)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Expose-Headers': 'ETag, Content-Type, Content-Length, Last-Modified',
};
const PREFLIGHT = {
  ...CORS,
  'Access-Control-Allow-Methods': 'GET, HEAD, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'Authorization, Content-Type, Content-Length, If-Match, If-None-Match, Origin, X-Requested-With',
  'Access-Control-Max-Age': '86400',
};
// Spec wants "no-cache" (+ "public" under /public/). "no-transform" stops Cloudflare's edge
// from compressing bodies, which would otherwise weaken our strong ETags.
const NO_CACHE = 'no-cache, no-transform';
const NO_CACHE_PUBLIC = 'no-cache, public, no-transform';

export default {
  async fetch(request, env) {
    try {
      return await route(request, env);
    } catch (e) {
      console.error(e);
      return err(500, 'Internal Server Error');
    }
  },
};

async function route(request, env) {
  const url = new URL(request.url);
  if (url.pathname === '/oauth') return oauth(request, url, env);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: PREFLIGHT });
  if (url.pathname === '/.well-known/webfinger') return webfinger(url, env);
  const root = `/storage/${env.RS_USER}`;
  if (url.pathname === root || url.pathname.startsWith(root + '/')) {
    return storage(request, env, url.pathname.slice(root.length) || '/');
  }
  return err(404, 'Not Found');
}

// ---------------------------------------------------------------- WebFinger

function webfinger(url, env) {
  const resource = (url.searchParams.get('resource') || '').toLowerCase();
  const subject = `acct:${env.RS_USER}@${url.host}`.toLowerCase();
  if (resource !== subject) return err(404, 'Unknown resource');
  const authOrigin = env.AUTH_ORIGIN || url.origin;
  const body = {
    subject,
    links: [{
      href: `${url.origin}/storage/${env.RS_USER}`,
      rel: REL,
      properties: {
        'http://remotestorage.io/spec/version': SPEC,
        'http://tools.ietf.org/html/rfc6749#section-4.2': `${authOrigin}/oauth`,
        'http://tools.ietf.org/html/rfc6750#section-2.3': null, // no token-in-query
        'http://tools.ietf.org/html/rfc7233': null,             // no Range requests
        'http://remotestorage.io/spec/web-authoring': null,
      },
    }],
  };
  return res(200, JSON.stringify(body), { 'Content-Type': 'application/jrd+json' });
}

// ---------------------------------------------------------------- Storage API

async function storage(request, env, rel) {
  const p = parsePath(rel);
  if (!p) return err(400, 'Bad Request: invalid path');
  const m = request.method;
  if (!['GET', 'HEAD', 'PUT', 'DELETE'].includes(m)) {
    return err(405, 'Method Not Allowed', { Allow: 'GET, HEAD, PUT, DELETE, OPTIONS' });
  }

  const isPublic = p.segs[0] === 'public';
  const publicDocRead = isPublic && !p.isFolder && (m === 'GET' || m === 'HEAD');
  if (!publicDocRead) {
    const hasHeader = request.headers.has('Authorization');
    const scopes = await tokenScopes(request, env);
    if (!scopes) {
      return err(401, 'Unauthorized', {
        'WWW-Authenticate': hasHeader
          ? 'Bearer realm="remoteStorage", error="invalid_token"'
          : 'Bearer realm="remoteStorage"',
      });
    }
    if (!allowed(scopes, m, p.path)) {
      return err(403, 'Forbidden: insufficient scope', {
        'WWW-Authenticate': 'Bearer realm="remoteStorage", error="insufficient_scope"',
      });
    }
  }

  const cache = isPublic ? NO_CACHE_PUBLIC : NO_CACHE;
  if (p.isFolder) {
    if (m === 'PUT' || m === 'DELETE') return err(400, 'Bad Request: PUT and DELETE apply to documents only');
    return getFolder(env, p, m, request, cache);
  }

  const key = DATA + p.segs.join('/');
  if (new TextEncoder().encode(key).length > 1000) return err(414, 'URI Too Long');
  if (m === 'GET' || m === 'HEAD') return getDoc(env, key, m, request, cache);
  if (m === 'PUT') return putDoc(env, p, key, request);
  return deleteDoc(env, key, request);
}

// Folder ETags are derived, not stored: a hash over every (path, ETag) in the subtree.
// Any PUT/DELETE below a folder changes its hash, all the way up to the root, and
// folders exist exactly when they contain a document. R2 listing is strongly consistent.
async function getFolder(env, p, m, request, cache) {
  const prefix = DATA + (p.segs.length ? p.segs.join('/') + '/' : '');
  const items = {};
  const all = [];
  const subs = new Map();
  let cursor;
  do {
    const page = await env.BUCKET.list({ prefix, cursor, include: ['httpMetadata'] });
    for (const o of page.objects) {
      const rel = o.key.slice(prefix.length);
      all.push([rel, o.etag]);
      const i = rel.indexOf('/');
      if (i === -1) {
        items[rel] = {
          ETag: o.etag,
          'Content-Type': o.httpMetadata?.contentType || 'application/octet-stream',
          'Content-Length': o.size,
          'Last-Modified': o.uploaded.toUTCString(),
        };
      } else {
        const name = rel.slice(0, i);
        if (!subs.has(name)) subs.set(name, []);
        subs.get(name).push([rel.slice(i + 1), o.etag]);
      }
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);

  for (const [name, entries] of subs) items[name + '/'] = { ETag: await treeHash(entries) };
  const etag = await treeHash(all);
  const headers = { ETag: `"${etag}"`, 'Cache-Control': cache };
  if (noneMatch(request, etag)) return res(304, null, headers);

  const body = JSON.stringify({ '@context': FOLDER_CONTEXT, items });
  headers['Content-Type'] = 'application/ld+json';
  headers['Content-Length'] = String(new TextEncoder().encode(body).length);
  return res(200, m === 'HEAD' ? null : body, headers);
}

async function getDoc(env, key, m, request, cache) {
  const obj = m === 'HEAD' ? await env.BUCKET.head(key) : await env.BUCKET.get(key);
  if (!obj) return err(404, 'Not Found');
  const headers = { ETag: `"${obj.etag}"`, 'Cache-Control': cache };
  if (noneMatch(request, obj.etag)) {
    await obj.body?.cancel();
    return res(304, null, headers);
  }
  headers['Content-Type'] = obj.httpMetadata?.contentType || 'application/octet-stream';
  headers['Content-Length'] = String(obj.size);
  headers['Last-Modified'] = obj.uploaded.toUTCString();
  return res(200, m === 'HEAD' ? null : obj.body, headers);
}

async function putDoc(env, p, key, request) {
  // 409 if a folder on the path is already a document, or this document name is already a folder.
  for (let i = 1; i < p.segs.length; i++) {
    if (await env.BUCKET.head(DATA + p.segs.slice(0, i).join('/'))) {
      return err(409, 'Conflict: a document exists where a folder is needed');
    }
  }
  const asFolder = await env.BUCKET.list({ prefix: key + '/', limit: 1 });
  if (asFolder.objects.length) return err(409, 'Conflict: a folder exists with this name');

  const max = Number(env.MAX_DOC_BYTES || 10 * 1024 * 1024);
  if (Number(request.headers.get('Content-Length') || 0) > max) return err(413, 'Payload Too Large');
  const body = await request.arrayBuffer(); // buffering also covers chunked uploads
  if (body.byteLength > max) return err(413, 'Payload Too Large');

  const existing = await env.BUCKET.head(key);
  const ifMatch = etagList(request.headers.get('If-Match'));
  const ifNone = etagList(request.headers.get('If-None-Match'));
  if (ifNone.includes('*') && existing) {
    return err(412, 'Precondition Failed', { ETag: `"${existing.etag}"` });
  }
  if (ifMatch.length && !(existing && (ifMatch.includes('*') || ifMatch.includes(existing.etag)))) {
    return err(412, 'Precondition Failed', existing ? { ETag: `"${existing.etag}"` } : {});
  }

  const opts = {
    httpMetadata: { contentType: request.headers.get('Content-Type') || 'application/octet-stream' },
  };
  if (ifMatch.length) opts.onlyIf = { etagMatches: existing.etag }; // atomic re-check in R2
  const obj = await env.BUCKET.put(key, body, opts);
  if (!obj) return err(412, 'Precondition Failed');
  return res(existing ? 200 : 201, null, { ETag: `"${obj.etag}"` });
}

async function deleteDoc(env, key, request) {
  const existing = await env.BUCKET.head(key);
  if (!existing) return err(404, 'Not Found');
  const ifMatch = etagList(request.headers.get('If-Match'));
  if (ifMatch.length && !ifMatch.includes('*') && !ifMatch.includes(existing.etag)) {
    return err(412, 'Precondition Failed', { ETag: `"${existing.etag}"` });
  }
  await env.BUCKET.delete(key);
  return res(200, null, { ETag: `"${existing.etag}"` });
}

// ---------------------------------------------------------------- Access control

async function tokenScopes(request, env) {
  const m = (request.headers.get('Authorization') || '').match(/^Bearer\s+(\S+)$/i);
  if (!m) return null;
  const rec = await env.BUCKET.head(TOKENS + (await sha256hex(m[1])));
  return rec ? rec.customMetadata.scopes.split(' ') : null;
}

// Spec section 9: '*:rw' anything, '*:r' reads; '<module>:rw|r' covers /<module>/ and /public/<module>/.
function allowed(scopes, method, path) {
  const write = method !== 'GET' && method !== 'HEAD';
  return scopes.some((s) => {
    const [mod, lvl] = s.split(':');
    if (write && lvl !== 'rw') return false;
    if (mod === '*') return true;
    return path.startsWith(`/${mod}/`) || path.startsWith(`/public/${mod}/`);
  });
}

function parseScopes(s) {
  const list = (s || '').split(/\s+/).filter(Boolean);
  if (!list.length) return null;
  for (const x of list) {
    const m = x.match(/^([a-z0-9_-]+|\*):(r|rw)$/i);
    if (!m || m[1].toLowerCase() === 'public') return null;
  }
  return list.map((x) => x.replace(/^root:/i, '*:')); // older clients say "root" for "*"
}

// ---------------------------------------------------------------- OAuth dialog (implicit grant)

async function oauth(request, url, env) {
  // Spec section 14: the dialog SHOULD live on a different origin from the storage.
  if (env.AUTH_ORIGIN && url.origin !== env.AUTH_ORIGIN) return html(404, page('Not found', ''));

  const isPost = request.method === 'POST';
  if (!isPost && request.method !== 'GET') return html(405, page('Method not allowed', ''));
  if (isPost && request.headers.get('Origin') !== url.origin) {
    return html(403, page('Forbidden', '<p>Cross-site form submission refused.</p>'));
  }
  const params = isPost ? new URLSearchParams(await request.text()) : url.searchParams;

  let target;
  try { target = new URL(params.get('redirect_uri') || ''); } catch {}
  const local = target && ['localhost', '127.0.0.1', '[::1]'].includes(target.hostname);
  if (!target || !(target.protocol === 'https:' || (target.protocol === 'http:' && local))) {
    return html(400, page('Invalid request', '<p>Missing or invalid <code>redirect_uri</code>.</p>'));
  }
  const state = params.get('state');
  const back = (fields) => {
    const f = new URLSearchParams(fields);
    if (state) f.set('state', state);
    target.hash = '';
    return new Response(null, { status: 302, headers: { Location: `${target.href}#${f}` } });
  };

  if (params.get('response_type') !== 'token') return back({ error: 'unsupported_response_type' });
  const scopes = parseScopes(params.get('scope'));
  if (!scopes) return back({ error: 'invalid_scope' });

  let identity = null;
  if (env.ACCESS_TEAM_DOMAIN) {
    identity = await verifyAccess(request, env);
    if (!identity) {
      return html(403, page('Not signed in',
        '<p>Cloudflare Access did not vouch for this request. Check that an Access application covers <code>/oauth</code>.</p>'));
    }
  }

  const fields = {
    redirect_uri: target.href, response_type: 'token', scope: scopes.join(' '),
    state: state || '', client_id: params.get('client_id') || '',
  };
  if (!isPost) return html(200, dialog(target.origin, scopes, fields, identity));
  if (params.get('allow') !== 'Allow') return back({ error: 'access_denied' });
  if (!identity && !(await passwordOk(params.get('password'), env))) {
    return html(401, dialog(target.origin, scopes, fields, null, 'Wrong password.'));
  }

  const token = randomToken();
  await env.BUCKET.put(TOKENS + (await sha256hex(token)), '', {
    customMetadata: { scopes: scopes.join(' '), origin: target.origin, created: new Date().toISOString() },
  });
  return back({ access_token: token, token_type: 'bearer' });
}

function dialog(origin, scopes, fields, identity, error = '') {
  const label = (s) => {
    const [mod, lvl] = s.split(':');
    const what = mod === '*' ? '<strong>everything</strong>' : `<code>${esc(mod)}</code>`;
    return `<li>${lvl === 'rw' ? 'Read and write' : 'Read only'}: ${what}</li>`;
  };
  const hidden = Object.entries(fields)
    .map(([k, v]) => `<input type="hidden" name="${k}" value="${esc(v)}">`).join('');
  const who = identity
    ? `<p class="muted">Signed in as ${esc(identity)}</p>`
    : `<label>Password<input type="password" name="password" autocomplete="current-password" autofocus></label>`;
  return page('Allow access?', `
    <p><strong>${esc(origin)}</strong> wants access to your storage:</p>
    <ul>${scopes.map(label).join('')}</ul>
    ${error ? `<p class="error">${esc(error)}</p>` : ''}
    <form method="post" action="/oauth">${hidden}${who}
      <div class="row"><button name="allow" value="Allow">Allow</button>
      <button name="allow" value="Deny" class="secondary">Deny</button></div>
    </form>`);
}

async function passwordOk(pw, env) {
  if (!env.RS_PASSWORD || !pw) return false;
  const [a, b] = await Promise.all([digest(pw), digest(env.RS_PASSWORD)]);
  return crypto.subtle.timingSafeEqual(a, b);
}

// Validates the JWT Cloudflare Access adds to requests it let through.
async function verifyAccess(request, env) {
  const jwt = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!jwt) return null;
  try {
    const [h, p, s] = jwt.split('.');
    const header = JSON.parse(new TextDecoder().decode(b64urlDecode(h)));
    const claims = JSON.parse(new TextDecoder().decode(b64urlDecode(p)));
    const certs = await (await fetch(`https://${env.ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`)).json();
    const jwk = certs.keys.find((k) => k.kid === header.kid);
    if (!jwk) return null;
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlDecode(s), new TextEncoder().encode(`${h}.${p}`));
    const aud = [].concat(claims.aud);
    if (!ok || !aud.includes(env.ACCESS_AUD) || claims.exp * 1000 < Date.now()) return null;
    if (claims.iss !== `https://${env.ACCESS_TEAM_DOMAIN}`) return null;
    if (env.ACCESS_EMAIL && claims.email !== env.ACCESS_EMAIL) return null;
    return claims.email || 'Access user';
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- Helpers

function parsePath(rel) {
  const isFolder = rel.endsWith('/');
  const raw = rel.split('/').slice(1, isFolder ? -1 : undefined);
  const segs = [];
  for (const r of raw) {
    let s;
    try { s = decodeURIComponent(r); } catch { return null; }
    if (!s || s === '.' || s === '..' || s.includes('/') || s.includes('\0')) return null;
    segs.push(s);
  }
  if (!isFolder && !segs.length) return null;
  return { segs, isFolder, path: '/' + segs.join('/') + (isFolder && segs.length ? '/' : '') };
}

function etagList(h) {
  return (h || '').split(',')
    .map((s) => s.trim().replace(/^W\//, '').replace(/^"|"$/g, ''))
    .filter(Boolean);
}

function noneMatch(request, etag) {
  const list = etagList(request.headers.get('If-None-Match'));
  return list.includes('*') || list.includes(etag);
}

async function treeHash(entries) {
  return (await sha256hex(JSON.stringify(entries))).slice(0, 32);
}

async function digest(s) {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
}

async function sha256hex(s) {
  return [...new Uint8Array(await digest(s))].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s) {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function res(status, body, headers = {}) {
  return new Response(body, { status, headers: { ...CORS, ...headers } });
}

function err(status, message, headers = {}) {
  return res(status, message, { 'Content-Type': 'text/plain; charset=utf-8', ...headers });
}

function html(status, body) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Frame-Options': 'DENY',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self' https: http://localhost:* http://127.0.0.1:*; frame-ancestors 'none'",
      'Referrer-Policy': 'no-referrer',
      'Cache-Control': 'no-store',
    },
  });
}

function page(title, inner) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title>
<style>
  body{font:16px/1.5 system-ui,sans-serif;max-width:28rem;margin:3rem auto;padding:0 1rem;color:#222;background:#fafafa}
  @media (prefers-color-scheme:dark){body{color:#ddd;background:#181818}input{background:#222;color:#ddd}}
  label{display:block;margin:1rem 0}input{display:block;width:100%;padding:.5rem;margin-top:.25rem;box-sizing:border-box}
  .row{display:flex;gap:.5rem}button{padding:.5rem 1.25rem;font-size:1rem;cursor:pointer}
  .secondary{opacity:.75}.error{color:#c33}.muted{opacity:.7}
</style></head><body><h1>${esc(title)}</h1>${inner}</body></html>`;
}
