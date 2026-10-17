# carousel: sending a card to each other

Dev and Laura only, so there's no picker and there are no accounts beyond one 5apps account. The goals, in order: the fewest lines of code, nothing new to host or run, and a notification you actually see on your phone. The notification can be lossy.

## The shape

- **Data:** one shared remoteStorage space (5apps), holding one document per sent card.
- **Doorbell:** a push with no payload, sent through a stateless Worker deployed next to the static assets.

The app on each phone collects new cards from its inbox whenever it opens. The push only tells you to open it, so a missed notification costs nothing: the card shows up the next time the app opens anyway.

## One space, two people, no second sign-in

remoteStorage can't let one user into another user's storage: access tokens only cover the account that issued them. Two people can still share one account, though:

1. One device connects to 5apps once, which gives it `{storage href, bearer token}` scoped to `/carousel/`.
2. Options > **pair this device** shows that pair as a link or QR code: `#rs=<href>&t=<token>`, through `../misc/qr/`. Opening it on the other device stores the same pair. That device never signs in.

The token is a capability: whoever has the link can read and write `/carousel/`. Treat the link like a password. You can revoke it from the 5apps dashboard.

Reuse the remoteStorage client from the FTD branch (see `../forgotodo/TODO.sync.md`): the fetch-with-token call and the connect flow. carousel doesn't need FTD's whole-list ETag merge.

## Data layout

```
/carousel/inbox/<name>/<card id>.json   {url, text, from, sentAt}
/carousel/push/<name>.json              that person's push subscription
```

- **Send:** `PUT inbox/<other>/<id>.json` with `If-None-Match: *`. Each card is its own document, so two writers never conflict.
- **Receive:** on launch and on `visibilitychange`, `GET inbox/<me>/` (the folder listing), then GET each item. Each one goes through `add()` in `app.js`, which already skips duplicates, with `from` set. Then DELETE it.

## The doorbell

- Leaving out the payload skips web push's payload encryption, which is most of the code in any web-push library. The only crypto left is a VAPID ES256 JWT, which WebCrypto signs in about 30 lines.
- **Subscribe:** the notifications toggle in Options calls `pushManager.subscribe` with the VAPID public key, then PUTs the subscription to `push/<me>.json`.
- **Ring:** after a send, the app GETs `push/<other>.json` and POSTs its endpoint to the Worker's `/ring`. The Worker signs the JWT with its secret key, POSTs an empty push to the endpoint, and stores nothing. The Worker only exists because push services don't send CORS headers, so a browser can't POST to them directly.
- **sw.js:**
  - `push` shows "carousel: something new".
  - `notificationclick` focuses or opens the app, and the app drains the inbox.
  - The service worker writes nothing itself, because it can't reach localStorage, and doesn't need to.
- **iOS** delivers web push only to home-screen PWAs (16.4+), which carousel already is.

## UI

- **Card:** a "send to Laura/Dev" button next to edit, plus a `p` key binding. The other person is implied.
- **Options:**
  - **me** (Dev or Laura)
  - **connect storage** / **pair this device**
  - **notifications** on or off
- **Receive:** the existing toast says "2 from Laura". The cards land in the unread lane.

## State

- `state.js`:
  - `me`: a `persistedValue`.
  - `rs`: a `persistedJson` holding `{href, token}`.
- Card: an optional `sentAt`. `from` already exists, and `people` gets the other name added automatically.
- The push subscription lives in remote storage, not localStorage.

## Deploy

- The Worker script becomes `main` alongside the static assets in carousel's wrangler config.
- Add a `VAPID_PRIVATE` secret. The public key goes in the client.
- Check whether `.github/workflows/deploy.yml` needs to know about a `main`. Today it deploys assets only.

## Rough size

| piece | lines |
|---|---|
| inbox send/receive, given the FTD client | ~60 |
| pairing link and Options | ~30 |
| subscribe plus sw.js handlers | ~40 |
| Worker `/ring` (VAPID JWT and fetch) | ~50 |
| **total** | **~180** |

**Smaller first step, if wanted:** "send as link" through `navigator.share`, with a `?url=&text=&from=` URL that `parseShare` already almost reads. That's about 30 lines and no backend. But on iOS the link opens in Safari, which doesn't share storage with the home-screen app, so it's only worth keeping as an extra option.

## Not chosen

- **remoteStorage as two separate users:** the protocol has no way to grant another user access. A pull model through `/public/` with hard-to-guess paths would work, but it means checking each person's storage for new cards and adds more code.
- **Push with the card as payload:** needs payload encryption, and the card is lost if the notification is dismissed.
- **ntfy.sh as the relay:** the public server keeps messages for only 12 hours by default.
- **An inbox in Workers KV:** duplicates what the shared storage already gives us.

## Caveats

- 5apps still labels its storage "beta", and the remoteStorage spec is still an Internet Draft. If 5apps goes away, the inbox layout moves to any remoteStorage server, or to Workers KV, without UI changes.

## Open

- Does a sent card carry the sender's comment as a note?
- Should each person's deck also sync across their own devices later? The same storage would allow it, but it's out of scope here.
