# rs-worker — a remoteStorage server on Cloudflare

A single-user [remoteStorage](https://remotestorage.io) server (spec **draft-dejong-remotestorage-27**)
that runs as one Cloudflare Worker backed by one R2 bucket. Apps connect with the address
`dev@<your-host>` and the standard remoteStorage.js connect widget.

## What's code vs. config

```
                       ┌──────────────────────── Cloudflare ────────────────────────┐
  any remoteStorage    │                                                            │
  app (browser)        │   [config] Cloudflare Access  (optional, guards /oauth)    │
      │                │        │  Google/GitHub/email-OTP login                    │
      │ 1 WebFinger    │        ▼                                                   │
      ├───────────────▶│   [SCRIPT] src/worker.js  ── the only code ──────────┐     │
      │ 2 OAuth dialog │      /.well-known/webfinger   discovery               │     │
      ├───────────────▶│      /oauth                   consent + token issue   │     │
      │ 3 GET/PUT/DEL  │      /storage/<user>/...      the storage API         │     │
      └───────────────▶│                                                       ▼     │
                       │   [config] R2 bucket "remotestorage"                        │
                       │      data/…    your documents                              │
                       │      tokens/…  SHA-256 of issued bearer tokens + scopes    │
                       │                                                            │
                       │   [config] wrangler.toml   binds bucket, sets RS_USER      │
                       │   [secret] RS_PASSWORD     (only if not using Access)      │
                       └────────────────────────────────────────────────────────────┘
```

| File / thing | Kind | Notes |
|---|---|---|
| `src/worker.js` | **script** (~440 lines, no deps) | WebFinger, OAuth implicit grant, storage API |
| `wrangler.toml` | config | bucket binding + a few vars |
| R2 bucket | config | `npx wrangler r2 bucket create remotestorage` |
| `RS_PASSWORD` | secret | the login for the consent screen |
| Cloudflare Access app | config (optional) | swap the password for Google/GitHub login |
| WAF rate-limit rule | config (optional) | the spec's "SHOULD stop brute force / DoS" |

## Deploy (about 10 minutes)

```sh
npm i -D wrangler
npx wrangler login
npx wrangler r2 bucket create remotestorage
npx wrangler secret put RS_PASSWORD        # pick something long
npx wrangler deploy
```

Your address is now `dev@rs-worker.<your-subdomain>.workers.dev`. Test it:
open https://myfavoritedrinks.5apps.com, click the widget, enter that address.

### Recommended: custom domains
On a domain you control in Cloudflare, add two Worker routes/custom domains to the same Worker:
- `storage.example.com` — the storage API (your address becomes `dev@storage.example.com`)
- `auth.example.com` — the login page; set `AUTH_ORIGIN = "https://auth.example.com"`

The spec asks for the login page to be on a different origin from the stored data, so a malicious
HTML file someone stores can't phish your password from the same origin.

### Optional: Cloudflare Access instead of a password
1. Zero Trust → Access → Applications → add a self-hosted app for `auth.example.com/oauth`,
   with a policy allowing only your email.
2. Copy the app's **AUD tag**, then set `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, and `ACCESS_EMAIL` in `wrangler.toml`.
3. The Worker verifies the Access JWT itself, so it can't be bypassed by hitting the Worker directly.
   `RS_PASSWORD` is then unused.

### Staying free and capped
- On the Workers **Free** plan, requests over the daily quota fail instead of billing you.
- R2's free tier is 10 GB with no egress fees. Note that R2 needs a payment method on file and
  bills above the free tier, so set a **billing notification** in the dashboard.
- `MAX_DOC_BYTES` caps each document (default 10 MB, which returns 413 above that).

## Spec coverage

| Spec requirement | Status |
|---|---|
| Folder listings (JSON-LD, `@context`, items with ETag/Content-Type/Content-Length/Last-Modified) | ✅ |
| Empty folders return `{}` and are hidden from their parent | ✅ |
| Folders created/deleted implicitly; ancestor ETags change on every PUT/DELETE | ✅ (derived hash of the subtree) |
| Strong ETags on GET/HEAD/PUT/DELETE; `If-Match`, `If-None-Match`, `If-None-Match: *` → 304/412 | ✅ |
| 401/403/404/409/413/414 status codes | ✅ |
| `Cache-Control: no-cache` (and `public` under `/public/`) | ✅ |
| Anonymous GET of `/public/` documents, but not folders | ✅ |
| Scopes `<module>:r` / `:rw`, `*:rw`, plus `/public/<module>/` | ✅ (`root:` accepted as an alias of `*`) |
| CORS on every response, plus preflight | ✅ |
| WebFinger with rel, version, and auth-dialog properties | ✅ |
| OAuth 2.0 implicit grant; `state` echoed back; errors returned in the fragment | ✅ |
| Chunked PUT bodies | ✅ |
| Range requests, token-in-query, PKCE, storage-first launch | — optional; advertised as `null` / not offered |
| 429 rate limiting | — use a Cloudflare WAF rule (config) |
| Token revocation UI | — not in the spec; see below |

Tested locally with `wrangler dev` and with the official **remoteStorage.js** client in Chromium
(connect, storeFile, getFile, getListing, remove).

## Known limits
- **Concurrency:** `If-Match` is enforced atomically by R2. `If-None-Match: *` (create-only) has a
  tiny race window if two clients create the same new file in the same instant.
- **Big folders:** each folder GET lists its whole subtree to compute the ETag. That's fine for
  personal data (thousands of documents); it would be slow with hundreds of thousands.
- **Revoking an app:** delete its object under `tokens/` in the R2 dashboard. Each token's metadata
  records the app's origin and creation time. Deleting the whole `tokens/` folder logs out every app.
