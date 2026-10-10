# Code audit: pizza-starter + forgotodo

Places to review by hand for LLM drift, highest impact first. Line refs as of 0c603c8.

## Tasks

- [ ] **1. Store loses writes across tabs.** `pizza-starter/app/lib/store.js:128-132`, `:34-40`
  - `recordStore` holds state in memory and rewrites the whole blob on every flush; nothing in the repo listens for `storage`.
  - Installed PWA + browser tab, or two tabs: last flush wins, the other's changes vanish. In forgotodo, any tap in a stale tab clobbers, and so does `forget()` on resume after a day rollover (`forgotodo/app.js:46-48`).
  - `writeRaw` swallows quota errors: memory and disk diverge silently.
  - Every app inherits this; it's the base for the remoteStorage sync (`forgotodo/TODO.sync.md`).

- [ ] **2. State lives in the text.** `forgotodo/lib/forget.js:40-100`
  - Confirm priority/snooze as `!` `?` `>` suffixes, and decay rewriting the text, was a deliberate call.
  - Consequences: user punctuation is behaviour ("Why?" starts faded); `withTier` strips trailing whitespace and `!?` runs; tail order matters (`foo!>` vs `foo>!`); daily decay is a text edit, a likely sync conflict.

- [ ] **3. Receive appends, so Send isn't a backup.** `forgotodo/app.js:249`, `:298-309`
  - Restoring a Send duplicates every item, resets decay clocks (`seenDay = today`), drops `doneDay`.

- [ ] **4. No batch write in the store.** `forgotodo/app.js:34-40`; callers `:307`, `:358`, `:386`, `:458`, `:470`, `:477`
  - Bulk actions loop one-item ops: per item, a full JSON write, a subscriber fan-out, and an async `refit` (~5 forced layouts).
  - 8 `/** @type {any} */` casts where store `Item` meets `ForgetItem` turn typing off at that boundary.

- [ ] **5. app.js has outgrown "top to bottom, no indirection".** `forgotodo/app.js:311-513`
  - 598 lines; organize commands mix dialog flow with counting.
  - `fastForward` derives categories by subtraction (`:496-501`); `shakeUp` returns a `move` tag. The pure function should categorize.

- [ ] **6. Update reload can eat a draft.** `forgotodo/app.js:585-597`
  - Pre-toast logic: reloads on resume unconditionally, though the comment says no half-typed text is lost.
  - Starter's `<update-toast>` has an `idle()` veto for this; forgotodo hasn't been ported.

- [ ] **7. sw.js "all-or-nothing" is only true for fetches.** `pizza-starter/app/sw.js:123-128`
  - A navigation during the `cache.put` loop can load mixed old/new files. Unlikely; the comment says it can't happen.

- [ ] **8. Hand-rolled reactive base next to vendored Lit.** `pizza-starter/app/lib/reactive-element.js`
  - A framework to maintain, plus its own lint rule. forgotodo already dropped it.

- [ ] **9. Essay comments.** e.g. `pizza-starter/app/lib/store.js:3-6`, `:99-106`; `reactive-element.js:23-43`; `sw.js:1-17`
  - Rationale narrated in code. Partly intended (the starter teaches), but forgotodo inherited the tone.

- [ ] **10. Homegrown tooling.** `scripts/warnings.sh` (144 lines, copied per app); `forgotodo/tests/browser/app.test.mjs` (826 lines, 6 scenario tests)
  - Check tests assert behaviour, not incidental DOM; check the grep lint and its `warn-ok:` pragmas still earn their upkeep.

## Fine as is

`forgotodo/lib/organize.js`, `lib/fit.js`, `lib/markdown.js`, and `forgetChanges` in `lib/forget.js`: pure, well-scoped.
