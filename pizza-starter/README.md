# pizza-starter

A skeleton for small offline-first web apps that behave like apps on a phone.

Clone a variant, serve it, add it to your home screen. It works in airplane
mode before you've written a line. There is no build step — the files you edit
are the files that ship.

## Why this exists

Because "offline, installable, phone-first, no build" is a mode worth having
handy, and standing it up from scratch is a day you don't have. It was
extracted from [`pizza-repl`](../pizza-repl), which needed all of this and
solved it the hard way.

The two things it gives you that nothing off the shelf does:

- **The mobile keyboard actually works.** `lib/viewport.js`. On a phone the
  layout viewport doesn't shrink when the keyboard opens, so a plain `100dvh`
  column lets the keyboard cover your input. Most web apps get this wrong.
- **State can't go stale.** `lib/store.js` has subscribers, so you never
  hand-call a re-render and never forget one.

## Quick start

```sh
just serve                      # http://localhost:8000 -- a service worker needs http://, not file://
just check                      # typecheck + precache verification
```

Open the app and work through the checklist. It lists the steps to make this
yours, and step six is deleting it.

`just check` needs `npm install` once. Nothing from `node_modules` ships.

## What's here

```
lib/viewport.js      keyboard/viewport handling, autoGrow, Enter-to-submit
lib/store.js         localStorage with subscribers: scalars and record lists
variants/vanilla/    custom elements + a ~40-line reactive base class
tools/               the precache verifier
```

Both libs are framework-agnostic on purpose — plain functions, no DOM
framework, no custom elements. A second variant (Lit) is planned and will
share them unchanged.

## The rules this follows

See [SKELETON.md](SKELETON.md). Short version: the files you edit are the files
that ship, the one derived thing is checked rather than generated, and the
input stays dumb.
