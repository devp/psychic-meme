# fennel-laserswords: design (draft)

This is reusable code for the Fennel community. It makes a touch-first structural editor and a
browser REPL that click together, and [pizza-repl-fennel](../pizza-repl-fennel) is the demo.
It grew out of [sexp-spike](../sexp-spike), which settled the interaction model: tap to focus a
form, tap again to widen, structural edits, inline eval, and templates with holes.

Status: **draft for review.** No code has been extracted yet. Open questions are at the end.

## Goals

- **Editing doesn't need a Lua engine.** The structural editor works on plain text. Evaluation
  is something the editor *asks for*, and any REPL can answer.
- **Phone-first.** Touch and thumb reach come first; keyboard shortcuts come second.
- **Progressive enhancement.** The editor wraps a real `<textarea>`, so forms, `.value`, and
  "no JavaScript" all keep working.
- **No build step and no framework.** Plain ES modules, vendorable by copying, and MIT licensed
  like Fennel and Fengari.
- **Fennel-aware from Fennel itself.** Form knowledge comes from `fennel.syntax()`, not from
  hand-kept lists.

Non-goals for now: other Lisps, syntax highlighting beyond node kinds, a full IDE, and
multi-file projects.

## Packages

| Package | Is | Depends on |
|---|---|---|
| `fennel-laserswords` | core: reader, edit ops, holes, templates, syntax data. No DOM. | nothing |
| `laserswords-editor` | `<laserswords-editor>` custom element wrapping a textarea | core |
| `fennel-laserswords-repl` | REPL API with an engine adapter (Fengari first) | an engine (Fengari) + `fennel.lua` |

The editor and the REPL never import each other. A small `connect(editor, repl)` helper,
shipped with the editor, joins them through events, so any object with the REPL's
`eval()` shape works.

They live in `psychic-meme/packages/` while the API settles, and move to their own repo(s) after.

---

## 1. `fennel-laserswords` (core)

### Reading

```js
import { read } from "fennel-laserswords";
const doc = read(src);   // never throws; unbalanced input is flagged, not refused
```

`doc` is a tree of nodes:

```ts
type Kind = "file" | "list" | "sequence" | "table" | "string" | "symbol" | "number"
          | "keyword" | "comment" | "prefix" | "hole" | "error";
interface Node {
  kind: Kind;
  start: number; end: number;      // UTF-16 offsets into src, end exclusive
  open?: "(" | "[" | "{"; close?: ")" | "]" | "}";
  closed: boolean;                 // false for an unclosed collection or string
  prefix?: "`" | "'" | "," | "#";  // kind "prefix": quote, quasiquote, unquote, hashfn
  children: Node[]; parent?: Node;
}
```

Helpers: `nodeAt(doc, start, end = start)` finds the smallest node covering a range,
`describe(node, syntax)` gives labels like "table { } · 3 pairs" and "list · each", and
`balanced(doc)` reports whether the input is balanced.

### Focus and edits

**Focus is a range** (`{start, end}`), normally a node's exact span. It maps 1:1 onto a
textarea's selection and onto other editors' selections. (Open question 1.)

Every op is a pure function. It returns the text changes and the new focus, or a reason it
didn't apply:

```ts
type Change = { from: number; to: number; insert: string };   // CodeMirror 6 shape
type Result = { changes: Change[]; focus: Range } | { refused: string };  // e.g. "nothing to glom"

ops.glom(src, focus)              // slurp: pull the next sibling into the list
ops.yeet(src, focus)              // barf: push the last item out
ops.wrap(src, focus, "(")         // also "[" and "{"
ops.splice(src, focus)  ops.raise(src, focus)  ops.remove(src, focus)
ops.insert(src, focus, text, { where: "after" | "before" | "inside" | "head" | "replace" })
                                  // closes unclosed ( [ { " in `text`, and focuses where typing continues
ops.fill(src, focus, text)        // fill a hole; repeating holes stay
nav.parent / nav.child / nav.prev / nav.next (src, focus) → Range
apply(src, changes) → string
```

The change-list shape is borrowed from [paredit.js](https://github.com/rksm/paredit.js) (MIT,
dormant since 2022). It lets a host apply small splices, so native undo and the selection
survive. The reader and ops are new code, because paredit.js reads Clojure, edits around a
caret, and has no idea of a focused node or of holes.

### Holes and templates

- **Holes** are symbols starting with `▢`, followed by an optional hint: `▢name`. They're valid
  Fennel symbols, so a file with holes still reads. Evaluating one is a compile error, and the
  editor refuses to eval while a required hole remains.
- **Repeating holes** end in `…`: `▢body…`. Filling one adds a form before it and keeps the hole.
  An empty fill removes it. Leftover repeating holes are dropped at eval time.

Templates are derived from syntax data, with curated overrides:

```js
import { syntax, template } from "fennel-laserswords";
template("each", syntax)  // "(each [▢bindings…] ▢body…)"   binding-form? + body-form?
template("fn", syntax)    // "(fn ▢name [▢args…] ▢body…)"   override: define? + arglist
```

`syntax` is a JSON snapshot of `fennel.syntax()` from the Fennel version we test against (1.6.1).
The REPL package can refresh it from a live engine, which picks up user macros.

### Later

- `reindent(src, range, syntax)` using `body-form?`, matching fnlfmt's two-space bodies.
- Multi-select (a run of siblings).
- Comments attached to the node that follows them.

Size target: under 10 KB minified.

---

## 2. `<laserswords-editor>`

```html
<script type="module" src="laserswords-editor.js"></script>
<laserswords-editor view="nodes">
  <textarea name="src">(fn sq [n] (* n n))</textarea>
</laserswords-editor>
```

- **The textarea is the source of truth.** Every edit is applied to its value and fires its
  normal `input` event. `view="text"` shows the plain textarea, for anything structural ops
  can't express. Without JavaScript, it simply is the textarea.
- **Focus is the textarea's selection.** Tapping a node selects its range. A range selected in
  text view becomes the nearest node when you switch back to nodes.
- **Actions:** a built-in context row plus a nav row, as in the spike. An `actions` attribute
  sets which ops show. `editor.exec("glom")` lets a host build its own controls instead.
- **Eval is a request.** The editor fires `laserswords-eval` with
  `{ id, source, range, scope: "form" | "file", fresh: boolean }`. The host answers with
  `editor.showResult(id, { value?, error? })`. A result is drawn inline next to its form, and
  struck through once that form is edited.
- **Other events:** `laserswords-focus` (`{ range, node }`).
- **Styling:** CSS custom properties (`--ls-paren`, `--ls-focus`, …) and `::part()` names.
  Light and dark come from the host.
- **No dependencies beyond the core.** Plain custom element, no Lit.

### Glue

```js
import { connect } from "laserswords-editor/connect.js";
connect(editor, repl);   // eval requests → repl.eval → editor.showResult; fresh → repl.restart() first
```

---

## 3. `fennel-laserswords-repl`

```js
import { createRepl } from "fennel-laserswords-repl";
import { fengariEngine } from "fennel-laserswords-repl/engines/fengari.js";

const repl = await createRepl({
  engine: fengariEngine(window.fengari),   // fengari-web, loaded however the host likes
  fennel: await (await fetch("fennel.lua")).text(),
});

await repl.eval("(+ 1 2)")
// → { values: ["3"], output: [], error: null }
// error: { kind: "parse" | "compile" | "runtime" | "lua", message }
await repl.restart();          // fresh state, same Fennel
await repl.syntax();           // live fennel.syntax(), includes macros the user defined
await repl.complete("str");    // ,complete
await repl.doc("table.insert") // ,doc
repl.dispose();
```

- **Fennel's own REPL semantics.** It drives `fennel.repl` in a coroutine, as `lang.js` does
  today, so locals persist and `*1`, `,doc` and the like behave as Fennel defines them.
- **Structured results.** Values come from `onValues` (`fennel.view` strings) and output from a
  `print` captured through `env`, not a global override. Error kinds come from `onError`.
- **Always async**, even on Fengari, so a Web Worker adapter can be added without changing
  callers. In worker mode, interrupting a runaway loop means terminating and restarting the
  worker.
- **Engine adapter interface** (internal, small): `start(fennelSource, bootLua)` and
  `call(fn, ...strings) → strings`. Fengari ships first. Candidates for later: a Fengari Web
  Worker adapter, and [wasmoon](https://github.com/ceifa/wasmoon) (Lua 5.4 in WebAssembly:
  faster, about 130 KB gzipped versus Fengari's 69 KB, but needs a hosted `.wasm` and handles
  coroutines awkwardly).

---

## pizza-repl-fennel as the demo

- `vendor/laserswords/` holds copies of the three packages, as it already vendors Fengari and
  Fennel.
- `lang.js` becomes a thin wrapper over `fennel-laserswords-repl`, and its tests carry over.
- A **file | repl** switch: the REPL view is today's app. The file view is `<laserswords-editor>`
  joined to the same REPL through `connect()`. Each session gets a file.
- `sexp-spike/` is retired once that ships.

## Order of work

1. Core: reader, ops, holes, templates. Node tests port the spike's flows as cases.
2. REPL: extract from `lang.js`, add structured results, keep `tests/lang.test.mjs` passing.
3. Editor element, then rebuild the spike page as about 20 lines over 1 + 2 + 3 to prove the fit.
4. Switch pizza-repl-fennel over.
5. Publish: repo, npm, and an announcement on Fennel's list or forum.

## Open questions

1. **Focus model.** Ranges (recommended, above) or node paths.
2. **The hole marker.** `▢` reads well, but it's hard to type on a desktop keyboard. An
   alternative is `_?name`, which is ASCII, still a valid symbol, and unlikely in real code.
3. **Shadow DOM or light DOM** for the editor's node view. Shadow DOM isolates its styles;
   light DOM is easier for hosts to restyle.
4. **Built-in action bar on by default, or headless by default** with the bar as an opt-in part.
5. **Where it's published.** GitHub (where psychic-meme is) or sourcehut (where Fennel lives),
   and whether to offer the REPL package to fennel-lang.org's in-browser REPL. We couldn't
   read that site's REPL code during the survey: sr.ht wasn't reachable.
6. **Fennel version policy.** One syntax snapshot per supported Fennel release, or only the
   latest.
