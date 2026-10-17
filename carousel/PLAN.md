# carousel: sending a card to each other

Dev and Laura, with trust assumed and data that doesn't last long. The goal is the simplest thing that stands on what we already need: an existing remoteStorage provider (5apps), a shared token, and a convention. There's no server of our own and no push yet.

## The shape

Each device can play two roles:

- **Sink** (optional): my own inbox, `carousel/inbox/` in my 5apps storage. Having one means connecting my 5apps account.
- **Sender**: a list of other people's inboxes. No account needed.

Sending and receiving are separate permissions. To receive from someone, you give them your sink. They don't have to give you theirs.

## Sink

- **Connect:** reuse FTD's client, `forgotodo/lib/remotestorage.js` on `feature/sync-to-remoteServer-6apps` (`discover`, `authorizeURL`, `fromRedirect`), with scope `carousel:rw`.
- **iOS fallback:** an installed app's sign-in redirect probably comes back in Safari, whose storage is separate. So connect in any browser, even a desktop one, and paste `{href, token}` into the app. FTD needs this path too.
- **Share:** Options > **let someone send to me** shows a string to copy: `carousel:<href>#<token>`.
  - A QR code is fine on Android.
  - On iOS, paste it instead: a scanned QR code opens Safari.
- **Drain:** on launch and on `visibilitychange`:
  1. `GET carousel/inbox/` to get the folder listing.
  2. GET each item and run it through `add()` in `app.js` (silent on duplicates). Set `from`, and make the note the card's `comment`.
  3. DELETE the item.
- **Client additions:** `list(path)` and `del(path)` alongside `get`/`put`, about 15 lines, plus a drain of about 25.

## Sender

- **Add a target:** Options > **send to someone**: paste their string and give it a name.
  - Stored as `targets: [{name, href, token}]`, a `persistedJson` in `state.js`.
  - Each target has a **remove** button.
- **Send:** a button on the card, plus a `p` key binding. For each target, a plain fetch, with no remoteStorage client involved:

  ```
  PUT <href>/carousel/inbox/<sentAt>-<random>.json
  Authorization: Bearer <token>
  If-None-Match: *
  {url, text, note, from, sentAt}
  ```

- **After sending:** the card is marked read (`patchCard(id, { readAt: Date.now() })`), and a toast says "sent to Laura".
- **Revoked target:** a 401 or 403 means the token was revoked. Say so, and offer to remove the target.
- **Size:** about 15 lines for sending, plus about 30 for the Options UI.

## Conventions

These hold by agreement, not enforcement:
- Inbox files have unique names, `<sentAt>-<random>`, and are written create-only.
- Only the reader deletes them.
- Senders don't touch anything outside `inbox/`.

A misbehaving client could do more, since the token is `carousel:rw` for the whole `/carousel/` folder. We accept that.

## Revoking

- The reader revokes the token in the 5apps panel, reconnects, and re-shares with whoever should still be able to send. Worst case: set it up again.
- If the shared token is the same one the reader's own device uses, revoking also signs that device out. Accepted.
- **To check:** does authorizing a second time give a separate token that can be revoked on its own? If so, mint one just for sharing.

## Notes

- A shared token can read everything under `/carousel/`. If each person's own deck ever syncs, give it a separate module (e.g. `carousel-deck`) so shared tokens can't reach it.
- No push: new cards show up when the app opens or comes to the foreground.
- 5apps still labels its storage beta, and the remoteStorage spec is still an Internet Draft.
- **Before reusing FTD's client, fix two bugs in its sync** (they matter for FTD; carousel only needs the client part):
  - A pull re-adds every item with a new id.
  - Edits made while a push is in flight get marked clean without being sent.

## Later: a doorbell

A push with no payload, rung by a small Cloudflare Worker that holds the VAPID key, possibly shared with taklifter.
- The Worker stores each person's push subscription.
- After a PUT, the sender asks the Worker to ring the recipient.
- sw.js shows "something new", and opening the app drains the inbox as usual.
- A daily cron could re-nudge for anything still waiting.
- The inbox stays on 5apps either way.

## Not chosen

- **Worker + KV inbox (plan v2):** a server of our own, with auth, to own and run.
- **Self-hosted rs-worker:** needs a domain on Cloudflare plus Access.
- **Push with the card as payload:** needs payload encryption, and the card is lost if the notification is dismissed.
- **ntfy.sh:** messages are kept for only 12 hours by default.
- **Plain links through `navigator.share`:** on iOS they open in Safari, not the installed app.
