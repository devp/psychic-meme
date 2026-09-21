// Gemtext, as data.
//
// Everything about the format lives here, and none of it touches the DOM or
// this app's state: parse() returns plain objects, the preview component turns
// those into elements, and the tests exercise the parser at `node --test`
// speed without a browser.
//
// The spec is small enough to keep in your head, which is the point of it:
// gemini://geminiprotocol.net/docs/gemtext.gmi
//
//   => URL [label]   link line (the ONLY way to link; no inline anchors)
//   # ## ###         headings, three levels, no more
//   * item           list item
//   > quoted         quote line
//   ```[alt]         toggles preformatted mode
//   anything else    a text line, which is a paragraph on its own

/**
 * @typedef {{ type: "heading", level: number, text: string }
 *   | { type: "link", url: string, label: string }
 *   | { type: "list", items: string[] }
 *   | { type: "quote", lines: string[] }
 *   | { type: "pre", alt: string, lines: string[], closed: boolean }
 *   | { type: "text", text: string }} Block
 */

/**
 * @typedef {Object} Lint
 * @property {number} line 1-based, so it matches what an editor would say
 * @property {string} rule
 * @property {string} message
 */

/** Split on any of the three line endings a pasted draft can arrive with. */
const LINES = /\r\n|\r|\n/;

/**
 * Line-oriented by construction: no line's meaning depends on any other line,
 * except inside a preformatted block. Adjacent list and quote lines are merged
 * into one block because that is a rendering decision, and the renderer should
 * not have to look ahead to make it.
 *
 * @param {string} text
 * @returns {Block[]}
 */
export function parse(text) {
  /** @type {Block[]} */
  const blocks = [];
  /** @type {{ alt: string, lines: string[], closed: boolean } | null} */
  let pre = null;

  for (const line of String(text ?? "").split(LINES)) {
    if (pre) {
      if (line.startsWith("```")) {
        blocks.push({ type: "pre", alt: pre.alt, lines: pre.lines, closed: true });
        pre = null;
      } else {
        pre.lines.push(line);
      }
      continue;
    }

    if (line.startsWith("```")) {
      pre = { alt: line.slice(3).trim(), lines: [], closed: false };
      continue;
    }

    if (line.startsWith("=>")) {
      const rest = line.slice(2).trim();
      const gap = rest.search(/\s/);
      const url = gap === -1 ? rest : rest.slice(0, gap);
      blocks.push({ type: "link", url, label: gap === -1 ? "" : rest.slice(gap).trim() });
      continue;
    }

    if (line.startsWith("#")) {
      // Only the first three #s are syntax; a fourth is text, per the spec.
      const level = Math.min(line.length - line.replace(/^#{1,3}/, "").length, 3);
      blocks.push({ type: "heading", level, text: line.slice(level).trim() });
      continue;
    }

    // "* " with the space: a bare "*" is a text line that happens to be an
    // asterisk, and rendering it as an empty bullet would be a lie.
    if (line.startsWith("* ")) {
      const last = blocks[blocks.length - 1];
      if (last && last.type === "list") last.items.push(line.slice(2).trim());
      else blocks.push({ type: "list", items: [line.slice(2).trim()] });
      continue;
    }

    if (line.startsWith(">")) {
      const quoted = line.slice(1).trim();
      const last = blocks[blocks.length - 1];
      if (last && last.type === "quote") last.lines.push(quoted);
      else blocks.push({ type: "quote", lines: [quoted] });
      continue;
    }

    blocks.push({ type: "text", text: line });
  }

  // An unterminated fence still has content in it; show it, and let lint()
  // be the one to complain.
  if (pre) blocks.push({ type: "pre", alt: pre.alt, lines: pre.lines, closed: false });

  return blocks;
}

/** Bare URLs a text line might be trying to link with. */
const BARE_URL = /(?:^|\s)((?:gemini|https?|gopher|mailto):\S+)/i;

/**
 * The three mistakes that survive a read-through, because a gemtext client
 * renders all of them without complaining.
 *
 * @param {string} text
 * @returns {Lint[]}
 */
export function lint(text) {
  /** @type {Lint[]} */
  const found = [];
  const lines = String(text ?? "").split(LINES);
  let fence = 0;
  let inPre = false;

  lines.forEach((line, i) => {
    const n = i + 1;

    if (line.startsWith("```")) {
      inPre = !inPre;
      if (inPre) fence = n;
      return;
    }
    if (inPre) return;

    if (line.startsWith("=>") && line.slice(2).trim() === "") {
      found.push({ line: n, rule: "empty-link", message: "link line with no URL" });
      return;
    }

    if (!line.startsWith("=>")) {
      const match = BARE_URL.exec(line);
      if (match) {
        found.push({
          line: n,
          rule: "bare-url",
          message: `"${match[1]}" won't be a link; gemtext only links on => lines`,
        });
      }
    }
  });

  if (inPre) {
    found.push({
      line: fence,
      rule: "unclosed-fence",
      message: "``` is never closed; everything below it renders as preformatted",
    });
  }

  return found;
}

/**
 * What an author counts. Words are counted over the prose only -- not the
 * "=>" and "#" that a whitespace split would hand you, not URLs, and not the
 * contents of a preformatted block, which is usually a code listing or a piece
 * of ASCII art and is nobody's idea of writing.
 *
 * @param {string} text
 * @returns {{ lines: number, words: number, chars: number, links: number }}
 */
export function stats(text) {
  const body = String(text ?? "");
  const blocks = parse(body);
  /** @param {string} s */
  const count = (s) => (s.match(/\S+/g) ?? []).length;

  let words = 0;
  for (const b of blocks) {
    if (b.type === "heading" || b.type === "text") words += count(b.text);
    else if (b.type === "link") words += count(b.label);
    else if (b.type === "list") words += b.items.reduce((n, i) => n + count(i), 0);
    else if (b.type === "quote") words += b.lines.reduce((n, l) => n + count(l), 0);
  }

  return {
    lines: body === "" ? 0 : body.split(LINES).length,
    words,
    chars: body.length,
    links: blocks.filter((b) => b.type === "link").length,
  };
}

/**
 * A filename-safe, ASCII-ish slug. Non-Latin titles legitimately reduce to
 * nothing here, hence the fallback -- the title is still the title, this is
 * only what goes on the end of a URL.
 *
 * @param {string} title
 * @returns {string}
 */
export function slugify(title) {
  const slug = String(title ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return slug || "untitled";
}

/**
 * Local calendar date, not UTC. A post written at 9pm in Queens belongs to
 * that day, and toISOString() would file it under tomorrow.
 *
 * @param {number} ms
 * @returns {string} YYYY-MM-DD
 */
export function localDate(ms) {
  const d = new Date(ms);
  const pad = (/** @type {number} */ n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * A post's slug: what it's called at the far end.
 *
 * On smol.pub the slug is the whole identity of a post -- it's the filename
 * you upload, and it's the URL (devp.smol.pub/<slug>) -- so it's a field you
 * can set, not a thing derived behind your back. An empty one falls back to
 * the title, which is right up until you rename the post and don't want the
 * link to move.
 *
 * @param {{ title: string, slug?: string }} post
 * @returns {string}
 */
export function postSlug(post) {
  const explicit = String(post.slug ?? "").trim();
  return explicit ? slugify(explicit) : slugify(post.title);
}

/**
 * Slugs for a whole journal, deduplicated. Two posts called "notes" would
 * otherwise overwrite each other on upload -- silently, after you'd stopped
 * paying attention.
 *
 * @param {{ id: string, title: string, slug?: string }[]} posts
 * @returns {Map<string, string>} post id -> slug
 */
export function fileNames(posts) {
  /** @type {Map<string, string>} */
  const byId = new Map();
  /** @type {Map<string, number>} */
  const seen = new Map();
  for (const post of posts) {
    const base = postSlug(post);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    byId.set(post.id, n === 1 ? base : `${base}-${n}`);
  }
  return byId;
}

/**
 * A post as smol.pub's CLI wants the file: the title on line 1 as a level-one
 * heading, a blank line, then the body. Its uploader reads the title off the
 * first line and the content from the third, and names the post after the
 * file, so this plus the slug is the whole upload.
 *
 * Body text that already opens with the title as a heading gets it removed
 * rather than doubled -- writing the heading yourself is the natural thing to
 * do, and publishing it twice is a silent, ugly result.
 *
 * @param {{ title: string, body: string }} post
 * @returns {string}
 */
export function smolPubFile(post) {
  const title = String(post.title ?? "").trim();
  const lines = String(post.body ?? "").split(LINES);
  const heading = /^#(?!#)\s*(.*)$/.exec(lines[0] ?? "");
  if (heading && title && heading[1].trim() === title) {
    lines.shift();
    if (lines[0] === "") lines.shift();
  }
  const body = lines.join("\n").replace(/\n+$/, "");
  return `# ${title || "Untitled"}\n\n${body}\n`;
}

/**
 * The capsule index: one link line per post, newest first.
 *
 * Newest-first by *creation*, which is the ordering a gemlog reader expects
 * and not the one a store sorted by last edit would give you. Fixing a typo
 * in a year-old post must not move it to the top of the page.
 *
 * The links are relative slugs, which is what a post is called on smol.pub
 * (devp.smol.pub/<slug>) and what a self-hosted capsule can name its files.
 * The date rides in the label, where a reader can see it.
 *
 * @param {{ title: string, posts: { id: string, title: string, slug?: string, createdAt: number }[] }} capsule
 * @returns {string} the contents of index.gmi
 */
export function buildIndex({ title, posts }) {
  const ordered = posts.slice().sort((a, b) => b.createdAt - a.createdAt);
  const names = fileNames(ordered);
  const lines = [`# ${title || "Gemlog"}`, ""];
  if (ordered.length === 0) lines.push("No posts yet.");
  for (const post of ordered) {
    lines.push(`=> ${names.get(post.id)} ${localDate(post.createdAt)} ${post.title || "Untitled"}`);
  }
  return lines.join("\n") + "\n";
}
