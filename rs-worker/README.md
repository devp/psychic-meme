# rs-worker — a remoteStorage server on Cloudflare

A single-user [remoteStorage](https://remotestorage.io) server (spec **draft-dejong-remotestorage-27**)
that runs as one Cloudflare Worker backed by one R2 bucket. Apps connect with the address
`dev@<your-storage-host>` and the standard remoteStorage.js connect widget.

## What's code vs. config

```
                       ┌──────────────────────── Cloudflare ────────────────────────┐
  any remoteStorage    │                                                            │
  app (browser)        │   [config] Cloudflare Access on auth.<domain>/oauth        │
      │                │        │  does the login (Google/GitHub/email code)        │
      │ 1 WebFinger    │        ▼                                                   │
      ├───────────────▶│   [SCRIPT] src/worker.js  ── the only code ──────────┐     │
      │ 2 OAuth dialog │      /.well-known/webfinger   discovery               │     │
      ├───────────────▶│      /oauth                   Allow/Deny + token      │     │
      │ 3 GET/PUT/DEL  │      /storage/<user>/...      the storage API         │     │
      └───────────────▶│        (Hono: routing + CORS · jose: Access JWT)      ▼     │
                       │   [config] R2 bucket "remotestorage"                        │
                       │      data/…    your documents                              │
                       │      tokens/…  SHA-256 of issued bearer tokens + scopes    │
                       │                                                            │
                       │   [config] wrangler.toml   bucket, user, Access settings   │
                       └────────────────────────────────────────────────────────────┘
```

| File / thing | Kind | Notes |
|---|---|---|
| `src/worker.js` | **script** (~260 lines) | WebFinger, OAuth implicit grant, storage API |
| `hono`, `jose` | libraries | routing + CORS; verifying the Access login token |
| `wrangler.toml` | config | bucket binding + a few vars |
| R2 bucket | config | `npx wrangler r2 bucket create remotestorage` |
| Cloudflare Access app | config | the login; free for small teams |
| WAF rate-limit rule | config (optional) | the spec's "SHOULD stop brute force / DoS" |

## Deploy

You need a domain on Cloudflare, because Access protects a hostname you own.
(A bare `*.workers.dev` URL won't work: Access there gates the whole hostname, including the storage API.)

1. **Two hostnames → one Worker.** In the Worker's *Domains & Routes*, add custom domains
   `storage.example.com` (the API; your address becomes `dev@storage.example.com`) and
   `auth.example.com` (the login page). The spec asks for the login page to be on a different origin
   from stored data.
2. **Access.** Zero Trust → Access → Applications → *Self-hosted*: domain `auth.example.com`,
   path `oauth`, with a policy allowing only your email. Copy the app's **AUD tag**.
3. **Config.** In `wrangler.toml`, set `AUTH_ORIGIN`, `ACCESS_TEAM` (e.g. `https://yourteam.cloudflareaccess.com`),
   and `ACCESS_AUD`.
4. **Ship it:**
   ```sh
   npm install
   npx wrangler login
   npx wrangler r2 bucket create remotestorage
   npx wrangler deploy
   ```
5. **Try it:** open https://myfavoritedrinks.5apps.com, click the widget, and enter `dev@storage.example.com`.

The Worker verifies Access's signed token itself, so hitting the Worker some other way doesn't skip login.

### Staying free and capped
- On the Workers **Free** plan, requests over the daily quota fail instead of billing you.
- R2's free tier is 10 GB with no egress fees, but R2 needs a payment method on file and bills above
  the free tier, so set a **billing notification** in the dashboard.
- `MAX_DOC_BYTES` caps each document (default 10 MB, which returns 413 above that).

## Spec coverage

| Spec requirement | Status |
|---|---|
| Folder listings (JSON-LD, `@context`, items with ETag/Content-Type/Content-Length/Last-Modified) | ✅ |
| Empty folders return `{}` and are hidden from their parent | ✅ |
| Folders created/deleted implicitly; ancestor ETags change on every PUT/DELETE | ✅ (derived hash of the subtree) |
| Strong ETags; `If-Match`, `If-None-Match`, `If-None-Match: *` → 304/412 | ✅ (R2 evaluates GET/PUT conditions) |
| 401/403/404/409/413/414 status codes | ✅ |
| `Cache-Control: no-cache` (and `public` under `/public/`) | ✅ |
| Anonymous GET of `/public/` documents, but not folders | ✅ |
| Scopes `<module>:r` / `:rw`, `*:rw`, plus `/public/<module>/` | ✅ (`root:` accepted as an alias of `*`) |
| CORS on every response, plus preflight | ✅ |
| WebFinger with rel, version, and auth-dialog properties | ✅ |
| OAuth 2.0 implicit grant; `state` echoed back; errors returned in the fragment | ✅ |
| Range requests, token-in-query, PKCE, storage-first launch | — optional; advertised as `null` / not offered |
| 429 rate limiting | — use a Cloudflare WAF rule (config) |

Successful PUTs return `200` (the spec allows 200 or 201).

Tested locally with `wrangler dev` (with a stand-in Access token issuer) and with the official
**remoteStorage.js** client in Chromium (connect, storeFile, getFile, getListing, remove).
Not yet tested against live R2: on first deploy, confirm that a second `PUT` with `If-None-Match: *` returns 412.

## Known limits
- **DELETE with `If-Match`** is checked, then deleted, in two steps (R2's delete has no condition option),
  so there's a tiny race window. Conditional GET and PUT are atomic.
- **Big folders:** each folder GET lists its whole subtree to compute the ETag. That's fine for
  personal data (thousands of documents); it would be slow with hundreds of thousands.
- **Revoking an app:** delete its object under `tokens/` in the R2 dashboard. Each token's metadata
  records the app's origin and creation time. Deleting the whole `tokens/` folder logs out every app.
