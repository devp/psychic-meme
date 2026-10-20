# carousel-service: a minimal inbox for carousel

A fork of `../carousel/PLAN.md` (v3, 5apps). Instead of using someone else's storage, carousel gets a tiny inbox service of its own that keeps as little as possible. Traffic is about 2 requests a day. This plan is simpler than v3: no sign-in, no iOS redirect, no shared tokens, no beta provider. The cost is owning about 60 lines of Worker.

## The shape

- One Cloudflare Worker plus one KV namespace, with no dependencies. It lives in this folder.
- carousel calls it cross-origin.
- The server never parses a card. It holds opaque strings until the recipient deletes them.

## Config

Users live in a Worker secret (`wrangler secret put USERS`), never in `vars`, which ends up in the repo and the dashboard:

```json
{ "users": [
  { "username": "dev",   "key": "<random>", "shareWith": ["laura"], "allowFrom": ["laura"] },
  { "username": "laura", "key": "<random>", "shareWith": ["dev"],   "allowFrom": ["dev"] }
] }
```

- **Keys** are random strings, not human passwords, because they sit in localStorage.
- **Revoking** someone means editing the secret.
- **Both lists stay,** because both parties should agree on who sends to whom. A card goes from A to B only if A's `shareWith` includes B *and* B's `allowFrom` includes A.
- **More users:** if there are ever others, assume they form separate groups that don't send to each other.

## Auth

- Every request sends `Authorization: Basic <user:key>`, checked against `USERS`.
- A bad or missing header gets a 401.

## Storage

- **Keys:** one KV key per item, `inbox:<user>:<id>`, with value `{from, sentAt, card}`.
- **No arrays:** a stale read (KV is eventually consistent) can't wipe a card someone else just sent.
- **Expiry:** every key expires after 30 days. Nothing else is stored.

## Routes

| route | body | returns |
|---|---|---|
| `POST /outbox` | `{card}` | `201 {to: [...]}`: whoever it was delivered to |
| `GET /inbox` | (none) | `200 [{id, from, sentAt, card}]`, or `[]` |
| `DELETE /inbox` | `{ids}` (required) | `200 {deleted: n}`, or `400` if `ids` is missing or empty |
| `OPTIONS *` | (none) | CORS preflight |

- **`/outbox`:**
  - `card` is an opaque string, capped at about 4 KB.
  - For each user U in my `shareWith` whose `allowFrom` includes me, write `inbox:U:<id>`.
  - The server sets `id` (`crypto.randomUUID()`), `from` (the authenticated username) and `sentAt`. The client never sets them.
- **Read, then delete:** two steps instead of read-and-delete in one call, so a response that drops on the subway can't lose cards. Only the ids sent get deleted.
- **Never a 204 with a body:** a 204 response drops its body.
- **CORS:** allow carousel's origin, `Authorization` and `Content-Type`.
- **Logging:** don't log card bodies.

## Client (carousel, about 40 lines)

- **Options:** username and key, kept in localStorage.
- **Send:** a button on the card, plus a `p` key binding.
  - It does `POST /outbox` with `card = JSON.stringify({url, text, note})`, where `note` is the card's comment.
  - It marks the card read.
  - The toast says "sent to Laura", or "nobody to send to" if `to` is empty.
- **Drain:** on launch and on `visibilitychange`:
  1. `GET /inbox`.
  2. Run each item through `add()` in `app.js`: `from` comes from the server, and `note` becomes the card's `comment`.
  3. `DELETE /inbox` with those ids.
- **Duplicates:** an item you've already deleted can come back for up to a minute. `add()` already skips duplicate URLs; for inbox items it should do that silently.

## Ops

- `wrangler.toml` here, with `main` and the KV binding.
- Add this folder to the deploy list in `../.github/workflows/deploy.yml`. Today the workflow deploys static assets only, so check how it handles a Worker with a script.
- `GET /inbox` with curl is the diagnostic: `curl -u dev:<key> https://…/inbox`.

## Later

- **Doorbell:** it lives here.
  - Push subscriptions go in KV, alongside a VAPID secret.
  - `/outbox` sends an empty push to each recipient.
  - A daily cron over `inbox:` keys re-nudges anything still waiting.
  - taklifter could reuse it by adding an `app` field.
- **Backend starter:** the second time this Worker changes may be the moment to extract a mini generic backend starter for pizza-style apps, the way `../pizza-starter/` serves the front end. Not yet.
