# Sync (desktop ↔ mobile)

Single user, a few devices, automatic. No CRDT library.

## Decisions

- **Edit = replace.** Every mutation tombstones the old item and adds a new one. Nothing is updated in place.
- **New id is derived, not random:** `newId = hash(oldId + newContent)`. Both devices decaying `A` produce the same `B`, so duplicates collapse.
- **Merge = set union** of live items and of tombstones. No timestamps, no HLC, no LWW.
- **Divergent concurrent edits both survive** as duplicates; the user deletes one. No edit is silently lost.
- **Pull whole state, merge, push whole state.** Use ETag/If-Match so concurrent pushes can't clobber each other.
- **Sync on** `visibilitychange`, a timer while visible, and debounced after a local write.
- **Only `lists` syncs.** `activeId`, theme, mode, font, icons and fit stay per-device.
- **Transport: remoteStorage protocol.**

## Concurrent cases

| Device X | Device Y | Result |
|---|---|---|
| decays A | decays A | same new id, one item |
| edits A → "x" | edits A → "y" | both survive |
| edits A | checks A done | both survive; the done one is removed the next day |

## Tasks

- [ ] `lib/store.js`: `updateItem` becomes tombstone + add with the derived id, and returns the new id. Call sites stay the same.
- [ ] Synchronous hash for ids (cyrb53 or similar). `crypto.subtle.digest` is async, and ids only need to be unique.
- [ ] Carry an `order` key (the item's first id) through every replace and sort by it. Otherwise an edited item jumps to the bottom.
- [ ] Fix code that holds an id after an edit: `blink([change.id])` (`app.js:379`, `app.js:392`) and `rowOf`. Use the id that `updateItem` returns.
- [ ] Check edit focus/blur behavior: `repeat` is keyed on `i.id` (`components/checklist.js:147`), so a replaced row gets rebuilt rather than updated (`editingId`, `checklist.js:151–159`).
- [ ] Tombstone pruning with a ~30-day cutoff. A device offline longer than that resurrects deleted items; accepted.
- [ ] Sync adapter (remoteStorage client, pull/merge/push loop).

## Open questions

- **remoteStorage provider:** who still runs public hosting? If no one does, self-host, which means running a server.
- **Second-device onboarding:** a QR code with the secret in the URL fragment, a paste button, or a password manager. On iOS, a home-screen PWA's storage is separate from Safari's, so pairing has to happen in the installed app.
- **Multiple lists:** `recordStore` holds several records, but only the active one gets decayed (`app.js:42`). Sync all records, or drop multi-list?
