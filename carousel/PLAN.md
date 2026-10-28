# carousel: a metadata Worker for titles and FB embeds

Not built yet. This is the plan, written to start the work cold.

Two problems, one fix:

- **Titles.** Cards from Facebook and Instagram, and from any site noembed.com
  doesn't know, come in with no description, because the share sheet often
  sends a bare URL.
- **FB embeds.** "embed" mode fails for Facebook, while "open app/tab" works.
  The FB app shares `facebook.com/share/p/…`, `/share/r/…` and `/share/v/…`
  links. These are redirects, and FB's embed players (`plugins/post.php`,
  `plugins/video.php`) want the post's real URL. Facebook now defaults to
  "open" (see `state.js`) until this lands.

The fix for both: a small same-origin endpoint that fetches the page
server-side and reports its title and its real URL.

## Why the browser can't do this itself

- **fetch():** sites don't send CORS headers, so the page can't read the
  response. That's why titles go through noembed.com, a proxy that does send
  them.
- **The reader iframe:** it's cross-origin, so its `document.title` is
  unreadable. "Grab the `<title>` the first time I open it" can't happen in
  the page.
- **"open":** `window.open(…, "noopener")`, or the FB app itself, gives back
  no handle at all.

The Worker reads the same `<title>` and `og:` tags you'd see on first open,
just server-side. The app already retries a blank title when a card is
opened (`lookUpTitle` in `app.js`), so the Worker slots into that path and
"capture the title on first open" comes for free.

## The endpoint

`carousel/worker.js`: a Cloudflare Worker module alongside the static assets.

`GET /api/meta?url=<link>` returns JSON (every field optional):

```json
{ "url": "<final URL after redirects>", "canonical": "<og:url or link rel=canonical>",
  "title": "...", "description": "...", "image": "...", "siteName": "..." }
```

- **Input:** only `http:` and `https:` URLs, at most 2 kB. Anything else gets
  a 400.
- **Fetch:** `redirect: "follow"`, an 8 s timeout, and
  `User-Agent: facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)`.
  Sites give link previewers their OG tags, Facebook included for public
  posts. If a site turns out to treat that UA badly, try a Twitterbot or
  Discordbot UA next.
- **Parse:** `HTMLRewriter`, which is built into Workers, so there are no
  dependencies. Read `<title>`, `meta[property^="og:"]`, `meta[name^="twitter:"]`,
  `meta[name="description"]` and `link[rel="canonical"]`. Stop reading once
  `</head>` arrives, or after 512 kB.
- **Title precedence:** `og:title` > `twitter:title` > `<title>`. Trim it,
  decode entities, collapse whitespace, cap at 300 chars.
- **Output:** only the small JSON above, never the page itself, so it can't
  be used as an open proxy. Send no CORS headers: only same-origin pages can
  read it.
- **Cache:** `caches.default`, keyed on the normalised input URL, for 1 day.
  Empty results are cached too, for 1 hour, so a login-walled site isn't
  hammered.
- **Errors:** a network failure or timeout returns `502 {}`. The client
  treats any non-200 as "no title".
- **Routing:** by default, assets are served first and only paths that aren't
  assets reach the Worker. Anything that isn't `/api/meta` gets
  `env.ASSETS.fetch(request)`, so the Worker never changes how the app
  itself is served.

## Client changes

- **`app.js`:** `fetchTitle` becomes `fetchMeta(url)`, which tries
  `./api/meta` first and falls back to noembed. A relative path keeps
  `just serve` working: python's static server 404s, so it falls through to
  noembed.
- **`lookUpTitle`:** it fills in `description` as now, and also stores
  `canonicalUrl` (the redirect target, else `og:url`) when it differs from
  `url`. It already runs at share time, on launch, when the network comes
  back, and on open. Nothing new to schedule.
- **`lib/deck.js`:** add `canonicalUrl?: string|null` to `Card`. `embedUrl`
  and `platformOf` take `card.canonicalUrl ?? card.url`. `url` stays as
  shared, for ↗ and for spotting duplicates. Dedupe should also match on
  `canonicalUrl`, since the same post often arrives via two different share
  links.
- **`embedUrl` for FB:** with a canonical URL, the video regex
  (`/videos/`, `/watch`, `/reel/`) works on the real path. Reels may still
  refuse to embed; check, and send them to "open" if so.
- **Later, cheap:** `image` gives card thumbnails (`og:image`). Not part of
  this.
- **`sw.js` needs no change:** `/api/meta` isn't in `ASSETS`, so a cache miss
  goes straight to the network.

## Deploy

`.github/workflows/deploy.yml` deploys every site as plain assets. One change
there: when the site has a `worker.js`, pass it as the entry point.

```sh
entry=; [ -f "$dir/worker.js" ] && entry="$dir/worker.js"
npx --yes wrangler@4.141.0 deploy $dry $entry --name "$name" --assets "$dir" --compatibility-date 2026-09-25
```

- **`carousel/.assetsignore`:** list `worker.js`, `PLAN.md`, `tests/`,
  `scripts/` and `node_modules/`, so none of them are published as files.
- **Typecheck:** the top-level `*.js` glob in `jsconfig.json` would pick up
  `worker.js` with DOM types. Exclude it, and check it on its own the way
  `scripts/check-sw.mjs` checks `sw.js`, against `@cloudflare/workers-types`
  (dev-only, like everything in `devDependencies`).
- **Free plan:** 100k Worker requests a day, far more than this needs.

## Testing

- **Unit:** keep the tag precedence and cleanup as a pure function,
  `pickMeta(tags) -> meta`, in `lib/meta.js`, and test it under node.
  `HTMLRewriter` itself only runs in workerd.
- **Browser test:** route `**/api/meta*` like noembed is routed now. Check
  that it's preferred over noembed, that noembed is used when it fails, and
  that an FB card with a stored canonical URL frames `plugins/post.php?href=<canonical>`.
- **By hand, against the deployed Worker (the part that matters):** run
  `curl 'https://carousel.dzza.workers.dev/api/meta?url=…'` for real links
  shared from the phone, and record what comes back here:
  - FB `share/p`, `share/r` and `share/v`, `fb.watch`, a public page's
    `/videos/`, a reel
  - IG `/p/`, `/reel/`
  - YouTube, a news site, a Substack, a paywalled site

## Risks and open questions

- **Login walls.** FB and IG may serve a login page to Cloudflare's IP
  ranges and drop the OG tags. The canonical URL from the redirect chain
  usually still comes back, and that alone fixes FB embeds. If titles don't,
  the fallback is to prompt: "no title found -- add one?" on the card after
  you come back from reading it.
- **Reels.** FB reels may not embed even with the real URL. Decide per
  result from the testing above.
- **Default.** Once FB embeds are verified, decide whether Facebook goes
  back to "embed" by default.
- **Backfill.** Existing cards with a description from the share text never
  get a `canonicalUrl`. A one-off backfill on launch for FB cards
  (`!canonicalUrl`, once each) would cover them.
