// Wiring. Everything app-shaped lives here in the open, rather than behind a
// lib -- this is the file you edit first, so it should be readable top to
// bottom with no indirection.

import { syncAppHeight, visibleHeight } from "./lib/viewport.js";
import { buildIndex, fileNames, lint, postSlug, smolPubFile, stats } from "./lib/gemtext.js";
import {
  theme,
  font,
  tab,
  capsuleTitle,
  journalHost,
  posts,
  allPosts,
  postsForIndex,
  ensurePost,
  activePost,
  createPost,
  saveDraft,
  checkpoint,
} from "./state.js";
import { Tabs } from "./components/tabs.js";
import { GemPreview } from "./components/gem-preview.js";
import { PostList } from "./components/post-list.js";
import { PostHistory } from "./components/post-history.js";

customElements.define("gem-tabs", Tabs);
customElements.define("gem-preview", GemPreview);
customElements.define("post-list", PostList);
customElements.define("post-history", PostHistory);

const titleEl = /** @type {HTMLInputElement} */ (document.getElementById("post-title"));
const slugEl = /** @type {HTMLInputElement} */ (document.getElementById("post-slug"));
const bodyEl = /** @type {HTMLTextAreaElement} */ (document.getElementById("post-body"));
const saveStateEl = /** @type {HTMLElement} */ (document.getElementById("save-state"));
const historyEl = /** @type {HTMLDetailsElement} */ (document.getElementById("history"));
const historySummary = /** @type {HTMLElement} */ (document.getElementById("history-summary"));
const statusEl = /** @type {HTMLElement} */ (document.getElementById("draft-status"));
const lintsEl = /** @type {HTMLElement} */ (document.getElementById("draft-lints"));
const previewEl = /** @type {GemPreview} */ (document.getElementById("draft-preview"));
const previewNote = /** @type {HTMLElement} */ (document.getElementById("preview-note"));
const indexOut = /** @type {HTMLElement} */ (document.getElementById("index-out"));
const indexPreview = /** @type {GemPreview} */ (document.getElementById("index-preview"));
const capsuleEl = /** @type {HTMLInputElement} */ (document.getElementById("capsule-title"));
const hostEl = /** @type {HTMLInputElement} */ (document.getElementById("journal-host"));
const slugHostEl = /** @type {HTMLElement} */ (document.getElementById("slug-host"));

// ---- the editor -----------------------------------------------------------
// The textarea is the source of truth while you're typing; the store is the
// source of truth the moment you aren't. Everything below is about keeping
// that swap honest.

let editing = ensurePost().id;

/**
 * Writes are debounced because a keystroke costs a full re-serialisation of
 * every post in localStorage, and a long journal makes that a typing-speed
 * problem rather than a storage one. Everything that could end the session --
 * switching tabs, backgrounding the app, closing it -- flushes first, so the
 * debounce can never be the reason a sentence is missing.
 */
let saveTimer = 0;

function saveNow() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = 0;
  }
  const post = activePost();
  if (!post || post.id !== editing) return;
  if (saveDraft(editing, { title: titleEl.value, body: bodyEl.value, slug: slugEl.value })) {
    saySaved();
  }
}

function saveSoon() {
  if (saveTimer) clearTimeout(saveTimer);
  // window.setTimeout, not the bare one: with @types/node loaded for the
  // build scripts, the global returns a Node Timeout rather than a handle.
  saveTimer = window.setTimeout(saveNow, 300);
}

/**
 * Autosave that says so. An app that saves silently is indistinguishable from
 * one that isn't saving, which is the whole reason people press Copy before
 * closing a tab.
 */
function saySaved() {
  saveStateEl.textContent = "saved " + new Date().toLocaleTimeString();
  saveStateEl.dataset.state = "saved";
}

/** Fill the editor from the store. Only on a switch -- see paintIfSwitched. */
function paintEditor() {
  const post = activePost();
  if (!post) return;
  editing = post.id;
  titleEl.value = post.title;
  slugEl.value = post.slug;
  bodyEl.value = post.body;
  saveStateEl.textContent = post.body || post.title ? "saved" : "";
  saveStateEl.dataset.state = "saved";
  paintDraft();
}

/**
 * The store notifies on every write, including our own. Repainting the
 * textarea from the store on our own keystroke would fight the caret, so the
 * editor is refilled only when the store says something the editor doesn't.
 *
 * Two cases: a different post (you opened one from the list), or the same post
 * with different text -- which is what restoring a checkpoint is. The pending
 * guard is what keeps those apart from our own echo: while a save is queued,
 * the editor is what's true and the store is behind, so leave it alone. A
 * queued save is never lost to this, because clicking anything blurs the
 * textarea and blur flushes.
 */
function paintIfSwitched() {
  const post = activePost();
  if (!post) {
    // The post being edited was trashed or purged from the posts tab.
    editing = ensurePost().id;
    paintEditor();
    return;
  }
  if (post.id !== editing) {
    paintEditor();
    return;
  }
  const changedElsewhere =
    post.body !== bodyEl.value || post.title !== titleEl.value || post.slug !== slugEl.value;
  if (saveTimer === 0 && changedElsewhere) paintEditor();
  else paintDraft();
}

/** Status line, lint list and preview -- all read the editor, not the store. */
function paintDraft() {
  const text = bodyEl.value;
  const s = stats(text);
  const post = activePost();
  const slug = postSlug({ title: titleEl.value, slug: slugEl.value });
  slugEl.placeholder = slug;
  statusEl.textContent =
    `${s.lines} ${s.lines === 1 ? "line" : "lines"} · ${s.words} ${s.words === 1 ? "word" : "words"} · ` +
    `${s.links} ${s.links === 1 ? "link" : "links"} · ${s.chars} chars — uploads as ${slug}`;

  const kept = post ? post.revisions.length : 0;
  historySummary.textContent = kept === 1 ? "History — 1 checkpoint" : `History — ${kept} checkpoints`;

  // textContent, never innerHTML: a draft is user text, and it renders as
  // text everywhere in this app or it isn't trustworthy anywhere.
  lintsEl.replaceChildren(
    ...lint(text).map((l) => {
      const li = document.createElement("li");
      li.className = "lint";
      li.textContent = `line ${l.line}: ${l.message}`;
      return li;
    })
  );

  previewEl.text = text;
  previewNote.textContent = titleEl.value
    ? `${titleEl.value} — as a client would render it`
    : "As a client would render it";
}

/** @param {Event} _e */
function onEdit(_e) {
  saveStateEl.textContent = "editing…";
  saveStateEl.dataset.state = "dirty";
  saveSoon();
  paintDraft();
}

titleEl.addEventListener("input", onEdit);
slugEl.addEventListener("input", onEdit);
bodyEl.addEventListener("input", onEdit);

document.getElementById("checkpoint-post")?.addEventListener("click", () => {
  saveNow();
  const kept = checkpoint(editing);
  saveStateEl.textContent = kept ? "checkpointed" : "nothing new to keep";
  saveStateEl.dataset.state = "saved";
  historyEl.open = true;
});

// ---- the insert row -------------------------------------------------------
// Line prefixes, because every gemtext construct is one, and because typing
// "=> " on a phone keyboard means three trips to the symbol layer.

document.querySelectorAll("[data-insert]").forEach((btn) => {
  // Keeping the default action off pointerdown is what stops the tap from
  // moving focus, which on a phone is what stops the keyboard from closing
  // and the whole layout from jumping between every inserted "=> ". The
  // click still fires; only the focus change is prevented.
  btn.addEventListener("pointerdown", (e) => e.preventDefault());
  btn.addEventListener("click", () => {
    togglePrefix(bodyEl, btn.getAttribute("data-insert") ?? "");
    saveSoon();
    paintDraft();
  });
});

/**
 * Add the prefix to the caret's line, or take it off if it's already there.
 * Toggling matters more than it sounds: the row is the only way to type these
 * without the symbol keyboard, so it has to be the way to untype them too.
 *
 * @param {HTMLTextAreaElement} el
 * @param {string} prefix
 */
function togglePrefix(el, prefix) {
  if (!prefix) return;
  const start = el.selectionStart;
  const end = el.selectionEnd;
  const lineStart = el.value.lastIndexOf("\n", start - 1) + 1;
  const has = el.value.startsWith(prefix, lineStart);

  if (has) {
    el.setRangeText("", lineStart, lineStart + prefix.length, "preserve");
    el.selectionStart = Math.max(lineStart, start - prefix.length);
    el.selectionEnd = Math.max(lineStart, end - prefix.length);
  } else {
    el.setRangeText(prefix, lineStart, lineStart, "preserve");
    el.selectionStart = start + prefix.length;
    el.selectionEnd = end + prefix.length;
  }
  el.focus();
}

// ---- post-level actions ---------------------------------------------------

document.getElementById("new-post")?.addEventListener("click", () => {
  saveNow();
  createPost();
  paintEditor();
  titleEl.focus();
});

/**
 * The upload, as smol.pub's CLI wants it: title on the first line, blank
 * second line, body from the third. The same bytes go to the clipboard and to
 * the file, because a post that reads differently depending on how you moved
 * it is a bug waiting for a bad week.
 * @returns {{ name: string, text: string }|null}
 */
function upload() {
  saveNow();
  const post = activePost();
  if (!post) return null;
  // The name has to match the one the index links to, collisions and all.
  const names = fileNames(allPosts());
  return { name: names.get(post.id) ?? postSlug(post), text: smolPubFile(post) };
}

document.getElementById("copy-post")?.addEventListener("click", () => {
  const out = upload();
  if (out) copy(out.text, `Copied, ready to paste as ${out.name}.`);
});

document.getElementById("download-post")?.addEventListener("click", () => {
  const out = upload();
  // No extension: smol.pub names the post after the file, so the file is the
  // slug. `smolpub <file>` uploads it as-is.
  if (out) download(out.name, out.text);
});

// ---- the index ------------------------------------------------------------
// Generated, never edited. It's a view of the posts, so there is nothing here
// to keep in sync -- it is rebuilt whenever the posts or the title change.

function paintIndex() {
  const text = buildIndex({ title: capsuleTitle.get(), posts: postsForIndex() });
  indexOut.textContent = text;
  indexPreview.text = text;
}

capsuleTitle.subscribe((v) => {
  if (capsuleEl.value !== v) capsuleEl.value = v;
  paintIndex();
});

capsuleEl.addEventListener("input", () => capsuleTitle.set(capsuleEl.value));

journalHost.subscribe((v) => {
  if (hostEl.value !== v) hostEl.value = v;
  slugHostEl.textContent = (v ? v.replace(/\/+$/, "") : "") + "/";
});

hostEl.addEventListener("input", () => journalHost.set(hostEl.value));

document.getElementById("copy-index")?.addEventListener("click", () => {
  copy(indexOut.textContent ?? "", "index.gmi copied.");
});

document.getElementById("download-index")?.addEventListener("click", () => {
  download("index.gmi", indexOut.textContent ?? "");
});

// ---- store -> screen ------------------------------------------------------

posts.subscribe(() => {
  paintIfSwitched();
  paintIndex();
});

paintEditor();
paintIndex();

// ---- clipboard and files --------------------------------------------------

/**
 * @param {string} text
 * @param {string} done what the status line says on success
 */
function copy(text, done) {
  const say = (/** @type {string} */ msg) => {
    statusEl.textContent = msg;
    window.setTimeout(paintDraft, 1600);
  };
  // The clipboard is absent on http:// outside localhost, and refusable
  // everywhere else, so both the missing-API and the refused-permission paths
  // have to say something -- a copy button that silently does nothing is worse
  // than no copy button.
  const written = navigator.clipboard?.writeText(text);
  if (!written) {
    say("No clipboard here — select the text and copy.");
    return;
  }
  written.then(
    () => say(done),
    () => say("Couldn't reach the clipboard — select and copy.")
  );
}

/**
 * @param {string} name
 * @param {string} text
 */
function download(name, text) {
  // text/gemini is the real media type, and the one a capsule will serve it as.
  const url = URL.createObjectURL(new Blob([text], { type: "text/gemini;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  // In the document, because Safari won't follow a click on a detached anchor.
  document.body.append(a);
  a.click();
  a.remove();
  // Revoking immediately races the download on some browsers; a second is
  // longer than any of them need and the URL is dead either way.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---- shell glue -----------------------------------------------------------
// Theme, font and tab are just persisted scalars with a subscriber each. No
// lib needed; this is the whole of it.

theme.subscribe((v) => {
  document.documentElement.setAttribute("data-theme", v);
  syncChecked("[data-set-theme]", "data-set-theme", v);
});

font.subscribe((v) => {
  document.documentElement.setAttribute("data-font", v);
  syncChecked("[data-set-font]", "data-set-font", v);
});

tab.subscribe((v) => {
  saveNow();
  document.querySelectorAll(".panel").forEach((p) => {
    p.classList.toggle("active", p.getAttribute("data-panel") === v);
  });
  document.querySelectorAll("gem-tabs [data-tab]").forEach((b) => {
    const on = b.getAttribute("data-tab") === v;
    b.classList.toggle("active", on);
    b.setAttribute("aria-selected", String(on));
  });
});

/**
 * @param {string} selector
 * @param {string} attr
 * @param {string} value
 */
function syncChecked(selector, attr, value) {
  document.querySelectorAll(selector).forEach((b) => {
    b.setAttribute("aria-checked", String(b.getAttribute(attr) === value));
  });
}

document.addEventListener("click", (e) => {
  const el = e.target instanceof Element ? e.target : null;
  if (!el) return;
  const t = el.closest("[data-set-theme]");
  if (t) theme.set(t.getAttribute("data-set-theme") ?? "dusk");
  const f = el.closest("[data-set-font]");
  if (f) font.set(f.getAttribute("data-set-font") ?? "mono");
});

const settings = /** @type {HTMLDialogElement} */ (document.getElementById("settings-dialog"));
document.getElementById("settings-btn")?.addEventListener("click", () => settings.showModal());
document.getElementById("settings-close")?.addEventListener("click", () => settings.close());

// Anything that could be the last moment of the session gets a flush.
// pagehide fires where beforeunload doesn't, which on iOS is most of the time.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") saveNow();
});
window.addEventListener("pagehide", saveNow);
bodyEl.addEventListener("blur", saveNow);
titleEl.addEventListener("blur", saveNow);

// ---- phone ----------------------------------------------------------------
// Writing mode: with the keyboard up, this app's own chrome is the thing
// standing between you and the page.
//
// Measured on the phone this was built for: header 42, title 40, slug row 34,
// button row 88 (it wraps), history summary 24 -- about 230px of app, against
// roughly 120px of textarea once the keyboard has taken its half. Five lines.
// Folding that chrome away while you type roughly triples the visible text,
// and costs nothing: dismiss the keyboard and it's all back.
//
// The tab strip stays. Draft -> preview -> draft is the loop this app is for,
// and hiding it would put a keyboard dismissal in the middle of it.

/**
 * Short enough that the app's chrome is competing with the text -- which on a
 * phone means the keyboard is up.
 *
 * An absolute height rather than a fraction of the window: the viewport meta
 * carries `interactive-widget=resizes-content`, so on Android the layout
 * viewport shrinks along with the visual one and the ratio between them barely
 * moves. 560 clears every phone's keyboard-up height and no phone's
 * keyboard-down one.
 */
const WRITING_HEIGHT = 560;

/**
 * Fold the chrome away only while the body has focus in a short viewport.
 * Title and slug focus don't count: those are one line each, and hiding the
 * field above the one you're typing in is its own kind of rude.
 */
function syncWritingMode() {
  const writing = document.activeElement === bodyEl && visibleHeight() < WRITING_HEIGHT;
  if (writing) document.documentElement.dataset.writing = "1";
  else delete document.documentElement.dataset.writing;
}

bodyEl.addEventListener("focus", syncWritingMode);
bodyEl.addEventListener("blur", syncWritingMode);

// The keyboard opening is a visualViewport resize, which is the callback this
// takes -- so the fold happens with the keyboard rather than after it.
syncAppHeight(syncWritingMode);

// ---- offline --------------------------------------------------------------

if ("serviceWorker" in navigator) {
  const register = () =>
    navigator.serviceWorker.register("sw.js").catch(() => {
      /* not fatal -- the app still works, it just won't survive the subway */
    });

  // Not simply addEventListener("load", ...). Any top-level await in this
  // module defers the rest of its body past the load event, so a load listener
  // registered here would never fire and offline would silently never work.
  // Check readyState first and this stays correct either way.
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}
