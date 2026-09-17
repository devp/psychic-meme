# pizza-starter (for PWAs)

Use pizza-starter as a skeleton or quickstart for building small offline-first web apps (as PWAs) for pizza rats. 🍕

Includes vendored versions of [Workbox](https://developer.chrome.com/docs/workbox) and  [Lit](https://lit.dev/) 

## Misc Features

- mobile keyboard tweaks for portrait mode
- state synced with localStorage

## Quick start

- Copy folder to start a new app.
- `just serve`.
- Edit files. Work through app's default checklist to customize. Run `just warnings` sometimes.

## Usage

- Usually: **no rebuild needed**, edit an existing file and serve it.
- Optionally:
  - Run the tasks in `justfile` (either by installing [just](https://just.systems/) or using treating the file as documentation).
    - Run `dev-init` to install developer-side tooling.
    - `warnings` and `dev-check` would flag a stale build manifest, which would require `dev-rebuild`
    - Run `just dev-init-hooks` to catch (some) issues without setting up CI.

## Design constrants / usage (WIP)

## FAQ

**Q: Why didn't you just—**

A: no thx

**Q: This title is misleading! What if I actually want a starter for making pizza dough?**

A: Not true! I recommend maintaining a sourdough starter during 2020, and using that to make the best sourdough pizza. (That's what [labmouse](https://github.com/labmouse) did! You missed out.)

**Q: Pizza rat? Isn't that meme *old*?**

A: Aren't we all?

## TODO

- [ ] doc: explain usage
- [ ] doc: explain the "why" behind my design choices (yagni, opt-in to complexity, anti-NIH/dont-reinvent, no-build-step, avoid-npm-when-you-can, make the best tools easily at hand without being cumbersome)
- [ ] doc: explain "pizza rat" user persona

### TODO: Audit and revise for comprehension

This repo is currenty bot-generated & *mostly* author-understood. Goal is to more substantively revise the code for comprehension. (See also [AI Usage Levels](https://raw.githubusercontent.com/devp/git-llm-annotate/refs/heads/main/ai-usage-levels-by-visidata.txt)); this code is at Level 6, and my goal is Level 5 or 4 with my own contributions and revision.)

**Still needing review:**

- components/append-log.js
- components/checklist.js
- components/tabs.js
- index.html
- app.js
- sw-globals.d.ts
- sw.js
- precache-manifest.js
- manifest.webmanifest
- package-lock.json
- package.json
- justfile
- scripts/build-precache.mjs
- scripts/check-sw.mjs
- scripts/dev-vendor.sh
- scripts/install-hooks.sh
- scripts/warnings.sh
- jsconfig.json
- lib/store.js
- lib/viewport.js
- state.js
- tests/store.test.mjs
- tests/browser/app.test.mjs
- tests/warnings.test.mjs
- style.css
