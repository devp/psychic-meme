# carousel: sending a card to each other

Dev and Laura only. The goals, in order: the fewest lines of code, nothing new to host beyond what carousel already deploys on, and a push notification you actually see. The notification can be lossy, because the inbox isn't.

## The shape

One Cloudflare Worker, deployed with carousel's static assets, plus Workers KV. The Worker holds:
- who's who
- each person's push subscription
- who may send to whom
- an inbox of sent cards

Every disposable record has an expiry, so state cleans itself up instead of piling up.

Push needs server-side state anyway, for the subscriptions. Once that exists, the inbox is just a few more keys in the same store.

## Identity

- On first use the device makes a random `{id, secret}` and keeps it in localStorage. It also copies it to the Cache API, because sw.js can't read localStorage.
- The server stores only a hash of the secret. Every route checks the id and secret.
- The push subscription is a field on the user. The app re-sends it on every launch and on `pushsubscriptionchange`, because subscriptions rotate and iOS expires them.
- The VAPID key is the server's own key. It is not anyone's identity.
- If iOS clears the app's storage, its identity goes with it: re-pair.

## KV

```
u:<id>             {secretHash, name, sub, allows: [ids]}
p:<code>           {id}                         expires after 10 min
i:<to>:<itemId>    {url, text, note, from, sentAt}   expires after 30 days
```

`allows` is who may send to *me*. That's the only list `send` checks.

## Routes

| route | does |
|---|---|
| `POST /register` | creates `u:<id>` |
| `PUT /sub` | stores my push subscription |
| `POST /pair` | returns a short code, e.g. `K7M-2QP` |
| `POST /pair/<code>` | adds each person to the other's `allows`, deletes the code |
| `DELETE /allow/<id>` | stops `<id>` sending to me. My side only |
| `POST /send` | writes `i:` for everyone whose `allows` includes me, then pushes each of them |
| `GET /inbox` | my unacknowledged items |
| `DELETE /inbox/<itemId>` | the acknowledgement |

## Push

- **No payload.** That skips web push's payload encryption, which is most of the code in any web-push library. What's left is a VAPID ES256 JWT, signed with WebCrypto in about 30 lines. The push only exists because push services don't send CORS headers, so the browser can't reach them directly.
- **sw.js `push`:** fetches `/inbox` with the cached secret, then shows a single notification with a fixed `tag` that replaces the previous one instead of stacking: "Laura: <title>", or "3 new".
- **Re-nudging:** anything not acknowledged shows up again in every later notification.
- **Daily cron:** a Cloudflare Cron Trigger lists the `i:` keys, groups them by recipient, and sends one empty push to each person who has items waiting. That's about 10 lines plus `triggers.crons` in the wrangler config. `list` is fine at two users.
- **sw.js `notificationclick`:** focuses or opens the app. The app drains `/inbox` through `add()` in `app.js`, then DELETEs each item. The service worker never writes cards itself.
- KV is eventually consistent, so an item you've already acknowledged can come back for up to a minute. `add()` already skips duplicate URLs; for inbox items it should do that silently.
- iOS delivers web push only to home-screen PWAs (16.4+), and carousel already is one.

## Pairing and revoking

- **Pair:** Options > **pair** shows a code that's valid for 10 minutes. The other phone types it in. Making the code and entering it are the two consents, so there's no confirmation round-trip.
- **Why no QR code:** scanning one on an iPhone opens Safari, which doesn't share storage with the home-screen app.
- **Revoke:** Options lists the people you're paired with, each with a **remove** button. Removing someone only edits *your* `allows`. They can no longer send to you; your sends to them are their list's business. Re-pair to undo.

## Send

- A **send** button on the card, next to edit, plus a `p` key binding.
- It goes to everyone you're paired with, so there's no picker.
- It marks the card read: `patchCard(id, { readAt: Date.now() })`.
- It carries the sender's comment as `note`. On the receiving side, the note becomes the new card's `comment`, so it shows where comments already show, next to "from Laura". The receiver can edit it like any comment.
- The toast says "sent to Laura". On the receiving side, cards land in the unread lane with `from` set, and `people` gains the name.

## State (client)

- `state.js`:
  - `me`: `persistedValue`, the display name.
  - `identity`: `persistedJson`, holding `{id, secret}`.
- Card: an optional `sentAt`. `from` already exists.

## Deploy

- The Worker script becomes `main` next to the static assets in carousel's wrangler config, along with a KV binding and `triggers.crons`.
- Add a `VAPID_PRIVATE` secret. The public key goes in the client.
- Check whether `.github/workflows/deploy.yml` needs to know about `main`. Today it deploys assets only.
- KV's free tier allows 1k writes a day, which is plenty.

## Rough size

| piece | lines |
|---|---|
| Worker: routes, auth, KV | ~90 |
| Worker: VAPID push and cron | ~40 |
| client: register, subscribe, send, drain | ~50 |
| client: pairing and revoking in Options | ~30 |
| sw.js `push` and `notificationclick` | ~20 |
| **total** | **~230** |

## Not chosen

- **remoteStorage (5apps), one shared account:** no access for a second user, so it would mean sharing the token through a pairing link, porting the FTD client, and depending on a service still labelled beta. And push would need a server anyway.
- **Push with the card as payload:** needs payload encryption, and the card is lost if the notification is dismissed.
- **ntfy.sh:** the public server keeps messages for only 12 hours by default.
- **"Send as link" through `navigator.share`:** about 30 lines and no backend. But on iOS the link opens in Safari, which doesn't share storage with the home-screen app. It could still be added later as an extra.
