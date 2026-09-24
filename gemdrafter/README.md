# gemdrafter

A drafting table for [gemtext](https://geminiprotocol.net/docs/gemtext.gmi),
pointed at [smol.pub](https://smol.pub): write a post, see it the way a Gemini
client will, keep checkpoints as you go, and get the file smol.pub's uploader
wants. Posts are listed newest written first.

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
4. **Nothing you typed should be gone.** Autosave, a checkpoint per sitting,
   and a trash that holds a deleted post and its whole history until you
   explicitly delete it from storage.

## Writing for smol.pub

smol.pub identifies a post by its **slug**: `devp.smol.pub/<slug>`, and the
name of the file its uploader sends. So the slug is a field here, not something
derived behind your back — it follows the title until you set it, and then it
stays put, because renaming a post shouldn't move its URL.

**Copy** and **Download** produce the file
[smol.pub's CLI](https://smol.pub/cli) reads: the title on line one as a
level-one heading, a blank second line, the body from the third. The download
has no extension, because the filename *is* the slug. A body that already opens
with the title as a heading doesn't get it published twice.

smol.pub builds your journal index itself, so the **index** tab is for a capsule
you serve yourself, or a table of contents you link by hand. Its links are
relative slugs, which work in both places.

The app doesn't upload. smol.pub's uploader authenticates with a session cookie
for *their* origin, which a page served from somewhere else cannot send — so an
upload button here would be a lie. `smolpub <file>` is the last step.

## The five tabs

| tab | what it's for |
| --- | --- |
| **draft** | title, slug, the insert row, the textarea, the status line, lint findings and the post's history. |
| **preview** | the current draft, rendered the way a client would. |
| **posts** | every post, newest written first, grouped by month, with the trash folded underneath. |
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

**The chrome folds away for the keyboard.** With one up, this app's own
furniture — header, title, slug, buttons, history — was about 230px against
roughly 140px of textarea: five lines. While the body has focus in a short
viewport, all of it folds and the textarea takes the space back (measured:
140px to 274px, five lines to eleven). The tab strip stays, because
draft → preview → draft is the loop the app is for. Dismiss the keyboard and
everything is back; there's no mode to leave.

**The insert row doesn't cost you the keyboard.** Its buttons cancel the
default action on `pointerdown`, so the tap never moves focus — no keyboard
dismissal, no unfold, no jump in the middle of a sentence. The click still
fires; only the focus change is prevented.

**You can tell which build you're on.** `sw.js` never changes; only
`precache-manifest.js` does, so the manifest's contents are this app's only
honest version number — and the worker is the only scope that can see them.
Options asks it over a MessagePort and shows `build <8 hex> · N files cached`.
When a new worker takes over a page that already had one, a bar offers a
reload, because the page in front of you was assembled from the old build.
The registration passes `updateViaCache: "none"`: the default lets the HTTP
cache answer for imported scripts, which on GitHub Pages can hide a deploy for
the length of its `max-age`.

**Writes are debounced; everything that ends a session flushes.** A keystroke
costs a full re-serialisation of every post in localStorage, so at capsule size
that's a typing-speed problem rather than a storage one. 300ms of idle, plus a
flush on tab switch, blur, `visibilitychange` and `pagehide` — the last of
which is what actually fires on iOS, where `beforeunload` usually doesn't.

**The textarea owns the text while you're typing — and only then.** The store
notifies on every write, including our own, so repainting from the store on
your own keystroke would fight the caret. `paintIfSwitched()` refills when the
store says something the editor doesn't *and* no save is pending: a different
post, or the same post restored from a checkpoint. Getting that second case
wrong is what made restore look like it did nothing, which the browser test
caught.

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
  something Download does one file at a time.
- **No automatic emptying of the trash.** Nothing deletes itself on a timer.
  The one irreversible button is one you press.
- **No diff view.** The history says when, how long and what it was called;
  seeing what changed is what Restore-and-look-at-it is for, and it's
  undoable.
- **No reordering.** See above; the order is when you wrote it.

## Where things are

```
lib/gemtext.js       the format as data: parse, lint, stats, slugs, the smol.pub file, index. Pure.
lib/store.js         localStorage + subscribers (from pizza-starter, unchanged).
lib/viewport.js      the mobile keyboard fix (from pizza-starter, unchanged).
state.js             the posts store, checkpoints, trash, and the views over them.
app.js               all the wiring, in the open.
components/gem-preview.js  a travelling component: text in, gemtext rendered, no app imports.
components/post-list.js    the posts tab, and the trash.
components/post-history.js the checkpoints for the post you're editing.
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
