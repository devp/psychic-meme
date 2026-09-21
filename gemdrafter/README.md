# gemdrafter

A drafting table for [gemtext](https://geminiprotocol.net/docs/gemtext.gmi):
write a post, see it the way a Gemini client will, and get the `index.gmi` that
links them all up — newest written first.

Built from [`pizza-starter`](../pizza-starter): no build step, offline-first,
installable, phone-shaped.

## The problem it's pointed at

Gemtext is a format you can hold in your head — six line types, no inline
markup, no nesting. That's the appeal, and it's also why a drafting tool for it
should be small enough to read in one sitting. What you actually want while
writing a gemlog post on a phone is three things: the `=>` and `#` characters
without three trips to the symbol keyboard, a preview that answers *did that
line become a link*, and an index file you didn't hand-maintain.

So:

1. **The preview is a client, not a formatter.** It renders the blocks a client
   renders, shows every link's scheme (because half of gemspace won't open in
   the browser you're previewing in), and marks a preformatted block that you
   never closed.
2. **The index is generated, never edited.** It's a view over the posts, so it
   can't drift.
3. **Order is creation order.** Newest first, and fixing a typo in a year-old
   post does not walk it back to the top. That distinction is the one design
   decision in this app that took real thought — see below.

## The five tabs

| tab | what it's for |
| --- | --- |
| **draft** | title, the insert row, the textarea, a status line and the lint findings. |
| **preview** | the current draft, rendered the way a client would. |
| **posts** | every post, newest written first, grouped by month. |
| **index** | the generated `index.gmi`, ready to copy or download. |
| **about** | the whole format, and what this app refuses to do. |

## Design notes

**Creation order, not edit order.** `lib/store.js` hands back records sorted by
`updatedAt`, which is the right default for a list of documents you're working
on and the wrong one for a gemlog: a reader who already read a post would be
told it's new because you fixed a typo. `allPosts()` in `state.js` re-sorts by
`createdAt`, `buildIndex()` sorts the same way independently, and there is a
test for each — including one that edits an old post and asserts the index
doesn't move.

**A post's body lives in the record's single item.** `recordStore` holds
records *of items*, and a post is one blob of text rather than a list of
anything. The body rides in `items[0]` and everything goes through
`activePost()`/`setBody()`. The alternative was adding a field to `StoredRecord`,
which forks `lib/store.js` away from the starter for the sake of one string —
and that fork is what would stop you taking the starter's next fix.

**Writes are debounced; everything that ends a session flushes.** A keystroke
costs a full re-serialisation of every post in localStorage, so at capsule size
that's a typing-speed problem rather than a storage one. 300ms of idle, plus a
flush on tab switch, blur, `visibilitychange` and `pagehide` — the last of
which is what actually fires on iOS, where `beforeunload` usually doesn't.

**The textarea owns the text while you're typing.** The store notifies on every
write, including our own, so repainting the textarea from the store on our own
keystroke would fight the caret. `paintIfSwitched()` refills it only when the
post being edited actually changed.

**The preview escapes by construction.** Every interpolation goes through a Lit
template, so a draft containing `<script>` renders as those six characters.
The obvious way to write a markup renderer — build a string, assign
`innerHTML` — is the wrong one, and `just warnings` fails the build if anyone
reaches for it.

**Three lint rules, chosen because a client renders all three without
complaining:** a `=>` with no URL, a bare URL on a text line (gemtext has no
inline links, so it will *not* be clickable), and a fence that's never closed.

**The insert row toggles.** It's the only way to type `=> ` on a phone without
the symbol layer, so it has to be the way to untype it too.

## Deliberate omissions

- **No upload.** It drafts; something else serves your capsule.
- **No draft/published split.** Every post with a word in it is in the index
  (a blank draft isn't a post, and the app always has one of those open). An
  app that hides written posts from its own index has become a CMS.
- **No inline formatting help.** There is no inline formatting in gemtext. A
  bold button would be a lie about the format.
- **No autocomplete or syntax highlighting in the box.** A dumb textarea has
  one failure mode; the starter's `lib/viewport.js` carries the note about the
  project that died of the alternative.
- **No export-everything zip.** That's a build step and a dependency, for
  something `Download .gmi` does one file at a time.
- **No reordering.** See above; the order is when you wrote it.

## Where things are

```
lib/gemtext.js       the format as data: parse, lint, stats, slug, index. Pure.
lib/store.js         localStorage + subscribers (from pizza-starter, unchanged).
lib/viewport.js      the mobile keyboard fix (from pizza-starter, unchanged).
state.js             the posts store, the scalars, and the views over them.
app.js               all the wiring, in the open.
components/gem-preview.js  a travelling component: text in, gemtext rendered, no app imports.
components/post-list.js    the posts tab.
components/tabs.js         the tab strip (from pizza-starter).
tests/gemtext.test.mjs     the format, at `node --test` speed.
tests/state.test.mjs       ordering and the body encoding.
tests/browser/             the same flows in a real browser, including offline.
```

## Running it

```sh
just serve            # http://localhost:8000 -- a service worker needs http://
just dev-init         # dev tooling; nothing in node_modules ships
just dev-check        # types, precache manifest, tests
just dev-rebuild      # regenerate precache-manifest.js after editing app files
just warnings         # grep-level footgun checks, no node_modules needed
just dev-init-browser # opt in to the browser tests
```

Without `just` installed, read the `justfile` — every recipe is a one-liner.

## Provenance

Bot-generated from a prompt, on top of `pizza-starter`. Level 6 on the
[AI usage scale](https://raw.githubusercontent.com/devp/git-llm-annotate/refs/heads/main/ai-usage-levels-by-visidata.txt)
the starter cites — same caveat, same intent to revise downward.
