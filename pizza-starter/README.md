# pizza-starter (for PWAs)

Use pizza-starter as a skeleton or quickstart for building small offline-first web apps (as PWAs) for pizza rats. 🍕

Includes a vendored copy of [Lit](https://lit.dev/), and a hand-written service worker (`sw.js`) for offline.

## Misc Features

- mobile keyboard tweaks for portrait mode
- state synced with localStorage

## Quick start

- `just new-app <name>` copies `app/` to `<name>` at the repo root and stamps it with a `STARTER` file (commit, tree hash, date). Everything outside `app/` is about the starter, not part of it.
- `cd <name> && just serve`.
- Edit files. Work through app's default checklist to customize. Run `just warnings` sometimes.
- Later, from `pizza-starter/`: `just drift <name>` shows what the starter and the app each changed since the copy. Pass `-p` for the full diff.

## Usage

Paths from here on are relative to `app/`.

Workflow tasks: see `justfile` (install [just](https://just.systems/), or read the file as documentation).

No build step or npm needed to make changes: edit, save and reload.

- **Offline** is `sw.js`: it answers from its cache, then refetches in the background. So an edit shows up **one reload late** (the first reload fetches it, the second shows it). Chrome DevTools > Application > Service workers > "Bypass for network" skips that while iterating.
- **Adding, renaming or deleting a file:** update `ASSETS` in `sw.js` by hand. `just warnings` lists what's missing or gone; edit until it's clean. `just dev-init-hooks` runs it on push.
- **Don't want offline:** delete the `// ---- offline` block in `app.js` and `sw.js`.
- `just dev-check`: typecheck and tests. Needs node (`just dev-init` once).

## Design notes

### FAQ

**Q: Why didn't you just—**

A: no thx

**Q: This title is misleading! What if I actually want a starter for making pizza dough?**

A: Not true! I recommend maintaining a sourdough starter during 2020, and using that to make the best sourdough pizza. (That's what [labmouse](https://github.com/labmouse) did! You missed out.)

**Q: Pizza rat? Isn't that meme *old*?**

A: Aren't we all?

### Components

Currently based on a combination of different bases.


| Component | Base | Why |
|---|---|---|
| `components/checklist.js` | Lit | DOM diffing: Re-renders on every store change, and its add-row `<input>` is inside that render. Lit keeps the existing input node, so half-typed text and focus survive (test: *typing survives a re-render elsewhere*). |
| `components/append-log.js` | Lit | DOM diffing: Keyed `repeat()` keeps existing entries' nodes, so the `aria-live` region announces only what's new and the scroll position holds (tests: *append adds only the tail*, *stays pinned to the bottom while following*). Takes plain properties and imports no app state, so it travels to another app. |
| `components/list-summary.js` | `lib/reactive-element.js` | The same list without Lit: declared properties, one batched `update()`, DOM by hand. `update()` calls `replaceChildren`, so it holds nothing to lose -- no inputs, no scroll. |
| `components/tabs.js` | plain `HTMLElement` | Renders once, from the `.panel[data-panel]` sections. No reactivity needed. |


`lib/reactive-element.js` is ~40 lines of code: property setters, one batched
update on a microtask, first render on connect. Its header lists everything it
leaves out versus Lit's ReactiveElement, each with the workaround, but id does
rebuild everything.

- [ ] consider consolidating on my preferences for my own default base class vs just using lit

## TODO

- [ ] doc: explain usage
- [ ] doc: explain the "why" behind my design choices (yagni, opt-in to complexity, anti-NIH/dont-reinvent, no-build-step, avoid-npm-when-you-can, make the best tools easily at hand without being cumbersome)
- [ ] doc: explain "pizza rat" user persona

### TODO: Audit and revise for comprehension

This repo is currenty bot-generated & *mostly* author-understood. Goal is to more substantively revise the code for comprehension. (In terms of [AI Usage Levels](https://raw.githubusercontent.com/devp/git-llm-annotate/refs/heads/main/ai-usage-levels-by-visidata.txt), this code is at Level 6, and my goal is Level 5 or 4.)


| File | AI Usage Level |
|---|---|
| README.md | 2 |
| icons/pizza.svg | 5 |
| app.css | 6 |
| app.js | 6 |
| base.css | 6 |
| components/append-log.js | 6 |
| components/checklist.js | 6 |
| components/list-summary.js | 6 |
| components/tabs.js | 6 |
| index.html | 6 |
| jsconfig.json | 6 |
| justfile | 6 |
| lib/reactive-element.js | 6 |
| lib/store.js | 6 |
| lib/viewport.js | 6 |
| manifest.webmanifest | 6 |
| scripts/check-sw.mjs | 6 |
| scripts/dev-vendor.sh | 6 |
| scripts/install-hooks.sh | 6 |
| scripts/warnings.sh | 6 |
| state.js | 6 |
| sw.js | 6 |
| tests/browser/app.test.mjs | 6 |
| tests/store.test.mjs | 6 |
| tests/warnings.test.mjs | 6 |
| theme.css | 6 |


