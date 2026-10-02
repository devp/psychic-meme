// remoteStorage server on Cloudflare Workers + R2 (draft-dejong-remotestorage-27).
// One user per deployment. Login is delegated to Cloudflare Access; Hono does routing + CORS;
// jose verifies Access's JWT; R2 evaluates conditional GET/PUT headers itself.
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const DATA = 'data/';     // R2 prefix for user documents
const TOKENS = 'tokens/'; // R2 prefix for bearer tokens, stored as SHA-256 hashes
const app = new Hono();

app.use('/.well-known/*', cors());
app.use('/storage/*', cors({
  origin: '*',
  allowMethods: ['GET', 'HEAD', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Authorization', 'Content-Type', 'Content-Length', 'If-Match', 'If-None-Match', 'Origin', 'X-Requested-With'],
  exposeHeaders: ['ETag', 'Content-Type', 'Content-Length', 'Last-Modified'],
  maxAge: 86400,
}));
app.onError((e) => (console.error(e), fail(500, 'Internal Server Error')));

// ---------------------------------------------------------------- WebFinger

app.get('/.well-known/webfinger', (c) => {
  const { origin, host } = new URL(c.req.url);
  const subject = `acct:${c.env.RS_USER}@${host}`.toLowerCase();
  if ((c.req.query('resource') || '').toLowerCase() !== subject) return fail(404, 'Unknown resource');
  return res(200, JSON.stringify({
    subject,
    links: [{
      href: `${origin}/storage/${c.env.RS_USER}`,
      rel: 'http://tools.ietf.org/id/draft-dejong-remotestorage',
      properties: {
        'http://remotestorage.io/spec/version': 'draft-dejong-remotestorage-27',
        'http://tools.ietf.org/html/rfc6749#section-4.2': `${c.env.AUTH_ORIGIN || origin}/oauth`,
        'http://tools.ietf.org/html/rfc6750#section-2.3': null,
        'http://tools.ietf.org/html/rfc7233': null,
        'http://remotestorage.io/spec/web-authoring': null,
      },
    }],
  }), { 'Content-Type': 'application/jrd+json' });
});

// ---------------------------------------------------------------- Storage API

app.all('/storage/*', async (c) => {
  const { env } = c, req = c.req.raw, m = req.method;
  const root = `/storage/${env.RS_USER}`, pathname = new URL(req.url).pathname;
  if (pathname !== root && !pathname.startsWith(root + '/')) return fail(404, 'Not Found');
  if (!['GET', 'HEAD', 'PUT', 'DELETE'].includes(m)) return fail(405, 'Method Not Allowed');
  const p = parsePath(pathname.slice(root.length) || '/');
  if (!p) return fail(400, 'Bad Request: invalid path');

  // Public documents (not folders) are readable without a token.
  const isPublic = p.segs[0] === 'public';
  if (!(isPublic && !p.isFolder && (m === 'GET' || m === 'HEAD'))) {
    const scopes = await tokenScopes(req, env);
    if (!scopes) return fail(401, 'Unauthorized', { 'WWW-Authenticate': 'Bearer realm="remoteStorage"' });
    if (!allowed(scopes, m, p.path)) {
      return fail(403, 'Forbidden', { 'WWW-Authenticate': 'Bearer realm="remoteStorage", error="insufficient_scope"' });
    }
  }

  // Spec: "no-cache" (+ "public" under /public/). "no-transform" keeps the edge from
  // compressing bodies, which would break our strong ETags.
  const cache = isPublic ? 'no-cache, public, no-transform' : 'no-cache, no-transform';
  if (p.isFolder) {
    return m === 'PUT' || m === 'DELETE' ? fail(400, 'PUT/DELETE apply to documents only') : getFolder(env, p, m, req, cache);
  }
  const key = DATA + p.segs.join('/');
  if (new TextEncoder().encode(key).length > 1000) return fail(414, 'URI Too Long');

  if (m === 'GET' || m === 'HEAD') {
    const obj = await env.BUCKET.get(key, { onlyIf: req.headers }); // R2 applies If-None-Match
    if (!obj) return fail(404, 'Not Found');
    const h = { ETag: `"${obj.etag}"`, 'Cache-Control': cache };
    if (!('body' in obj)) return res(304, null, h);
    if (m === 'HEAD') obj.body.cancel();
    return res(200, m === 'HEAD' ? null : obj.body, {
      ...h,
      'Content-Type': obj.httpMetadata?.contentType || 'application/octet-stream',
      'Content-Length': String(obj.size),
      'Last-Modified': obj.uploaded.toUTCString(),
    });
  }

  if (m === 'PUT') {
    // 409 if a folder on the path is a document, or this document name is a folder.
    for (let i = 1; i < p.segs.length; i++) {
      if (await env.BUCKET.head(DATA + p.segs.slice(0, i).join('/'))) return fail(409, 'Conflict: document in the way');
    }
    if ((await env.BUCKET.list({ prefix: key + '/', limit: 1 })).objects.length) return fail(409, 'Conflict: folder exists');
    const max = Number(env.MAX_DOC_BYTES || 10 * 1024 * 1024);
    const body = await req.arrayBuffer(); // also covers chunked uploads
    if (body.byteLength > max) return fail(413, 'Payload Too Large');
    const obj = await env.BUCKET.put(key, body, {
      httpMetadata: { contentType: req.headers.get('Content-Type') || 'application/octet-stream' },
      onlyIf: req.headers, // R2 applies If-Match / If-None-Match atomically
    });
    return obj ? res(200, null, { ETag: `"${obj.etag}"` }) : fail(412, 'Precondition Failed');
  }

  // DELETE: R2's delete has no conditional option, so check If-Match by hand.
  const existing = await env.BUCKET.head(key);
  if (!existing) return fail(404, 'Not Found');
  const ifMatch = etagList(req.headers.get('If-Match'));
  if (ifMatch.length && !ifMatch.includes('*') && !ifMatch.includes(existing.etag)) {
    return fail(412, 'Precondition Failed', { ETag: `"${existing.etag}"` });
  }
  await env.BUCKET.delete(key);
  return res(200, null, { ETag: `"${existing.etag}"` });
});

// Folder ETags are derived, not stored: a hash over every (path, ETag) in the subtree,
// so any change below a folder changes its ETag all the way up to the root. A folder
// exists exactly when it contains a document.
async function getFolder(env, p, m, req, cache) {
  const prefix = DATA + (p.segs.length ? p.segs.join('/') + '/' : '');
  const items = {}, all = [], subs = new Map();
  let cursor;
  do {
    const page = await env.BUCKET.list({ prefix, cursor, include: ['httpMetadata'] });
    for (const o of page.objects) {
      const rel = o.key.slice(prefix.length), i = rel.indexOf('/');
      all.push([rel, o.etag]);
      if (i === -1) {
        items[rel] = {
          ETag: o.etag,
          'Content-Type': o.httpMetadata?.contentType || 'application/octet-stream',
          'Content-Length': o.size,
          'Last-Modified': o.uploaded.toUTCString(),
        };
      } else {
        const name = rel.slice(0, i);
        subs.set(name, [...(subs.get(name) || []), [rel.slice(i + 1), o.etag]]);
      }
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  for (const [name, entries] of subs) items[name + '/'] = { ETag: await treeHash(entries) };

  const etag = await treeHash(all);
  const h = { ETag: `"${etag}"`, 'Cache-Control': cache };
  const inm = etagList(req.headers.get('If-None-Match'));
  if (inm.includes('*') || inm.includes(etag)) return res(304, null, h);
  const body = JSON.stringify({ '@context': 'http://remotestorage.io/spec/folder-description', items });
  return res(200, m === 'HEAD' ? null : body, { ...h, 'Content-Type': 'application/ld+json' });
}

// ---------------------------------------------------------------- Access control

async function tokenScopes(req, env) {
  const m = (req.headers.get('Authorization') || '').match(/^Bearer\s+(\S+)$/i);
  const rec = m && (await env.BUCKET.head(TOKENS + (await sha256hex(m[1]))));
  return rec ? rec.customMetadata.scopes.split(' ') : null;
}

// '*:rw' anything, '*:r' reads; '<module>:rw|r' covers /<module>/ and /public/<module>/.
function allowed(scopes, method, path) {
  const write = method !== 'GET' && method !== 'HEAD';
  return scopes.some((s) => {
    const [mod, lvl] = s.split(':');
    if (write && lvl !== 'rw') return false;
    return mod === '*' || path.startsWith(`/${mod}/`) || path.startsWith(`/public/${mod}/`);
  });
}

// ---------------------------------------------------------------- OAuth dialog (implicit grant)
// Cloudflare Access sits in front of /oauth and handles login. We verify its JWT, show an
// Allow/Deny form, and redirect back with a token in the URL fragment.

app.on(['GET', 'POST'], '/oauth', async (c) => {
  const { env } = c, req = c.req.raw, url = new URL(req.url), isPost = req.method === 'POST';
  if (env.AUTH_ORIGIN && url.origin !== env.AUTH_ORIGIN) return fail(404, 'Not Found');
  if (isPost && req.headers.get('Origin') !== url.origin) return fail(403, 'Cross-site form submission refused');
  const params = isPost ? new URLSearchParams(await req.text()) : url.searchParams;

  let target;
  try { target = new URL(params.get('redirect_uri')); } catch {}
  const local = target && ['localhost', '127.0.0.1', '[::1]'].includes(target.hostname);
  if (!target || !(target.protocol === 'https:' || (target.protocol === 'http:' && local))) {
    return fail(400, 'Missing or invalid redirect_uri');
  }
  const state = params.get('state');
  const back = (fields) => {
    const f = new URLSearchParams(fields);
    if (state) f.set('state', state);
    target.hash = '';
    return new Response(null, { status: 302, headers: { Location: `${target.href}#${f}` } });
  };
  if (params.get('response_type') !== 'token') return back({ error: 'unsupported_response_type' });
  const scopes = (params.get('scope') || '').split(/\s+/).filter(Boolean).map((s) => s.replace(/^root:/i, '*:'));
  if (!scopes.length || !scopes.every((s) => /^([a-z0-9_-]+|\*):(r|rw)$/i.test(s) && !/^public:/i.test(s))) {
    return back({ error: 'invalid_scope' });
  }
  const email = await accessEmail(req, env);
  if (!email) return fail(403, 'Cloudflare Access did not vouch for this request');

  if (!isPost) {
    const fields = { redirect_uri: target.href, response_type: 'token', scope: scopes.join(' '), state: state || '' };
    return page(`<h1>Allow access?</h1>
      <p><b>${esc(target.origin)}</b> wants access to your storage (signed in as ${esc(email)}):</p>
      <ul>${scopes.map((s) => `<li>${s.endsWith(':rw') ? 'read/write' : 'read-only'}: <code>${esc(s.split(':')[0])}</code></li>`).join('')}</ul>
      <form method="post" action="/oauth">
        ${Object.entries(fields).map(([k, v]) => `<input type="hidden" name="${k}" value="${esc(v)}">`).join('')}
        <button name="allow" value="Allow">Allow</button> <button name="allow" value="Deny">Deny</button>
      </form>`);
  }
  if (params.get('allow') !== 'Allow') return back({ error: 'access_denied' });

  const token = b64url(crypto.getRandomValues(new Uint8Array(32)));
  await env.BUCKET.put(TOKENS + (await sha256hex(token)), '', {
    customMetadata: { scopes: scopes.join(' '), origin: target.origin, created: new Date().toISOString() },
  });
  return back({ access_token: token, token_type: 'bearer' });
});

let jwks;
async function accessEmail(req, env) {
  const jwt = req.headers.get('Cf-Access-Jwt-Assertion');
  if (!jwt || !env.ACCESS_TEAM || !env.ACCESS_AUD) return null;
  jwks ||= createRemoteJWKSet(new URL(`${env.ACCESS_TEAM}/cdn-cgi/access/certs`));
  try {
    const { payload } = await jwtVerify(jwt, jwks, { issuer: env.ACCESS_TEAM, audience: env.ACCESS_AUD });
    return !env.ACCESS_EMAIL || payload.email === env.ACCESS_EMAIL ? payload.email || 'Access user' : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- Helpers

function parsePath(rel) {
  const isFolder = rel.endsWith('/');
  const segs = [];
  for (const r of rel.split('/').slice(1, isFolder ? -1 : undefined)) {
    let s;
    try { s = decodeURIComponent(r); } catch { return null; }
    if (!s || s === '.' || s === '..' || s.includes('/') || s.includes('\0')) return null;
    segs.push(s);
  }
  if (!isFolder && !segs.length) return null;
  return { segs, isFolder, path: '/' + segs.join('/') + (isFolder && segs.length ? '/' : '') };
}

const etagList = (h) => (h || '').split(',').map((s) => s.trim().replace(/^W\//, '').replace(/^"|"$/g, '')).filter(Boolean);
const sha256hex = async (s) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, '0')).join('');
const treeHash = async (entries) => (await sha256hex(JSON.stringify(entries))).slice(0, 32);
const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
const res = (status, body, headers = {}) => new Response(body, { status, headers });
const fail = (status, msg, headers = {}) => res(status, msg, { 'Content-Type': 'text/plain; charset=utf-8', ...headers });
const page = (inner) => res(200, `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Allow access?</title>${inner}`, {
  'Content-Type': 'text/html; charset=utf-8',
  'Content-Security-Policy': "default-src 'none'; form-action 'self' https: http://localhost:* http://127.0.0.1:*; frame-ancestors 'none'",
  'Cache-Control': 'no-store',
});

export default app;
