import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parse,
  lint,
  stats,
  slugify,
  localDate,
  fileName,
  fileNames,
  buildIndex,
} from "../lib/gemtext.js";

test("parse: the five line types", () => {
  const blocks = parse(
    ["# One", "## Two", "### Three", "=> gemini://example.org/ Home", "* a", "* b", "> quoted", "plain"].join("\n")
  );
  assert.deepEqual(
    blocks.map((b) => b.type),
    ["heading", "heading", "heading", "link", "list", "quote", "text"]
  );
  assert.deepEqual(blocks[0], { type: "heading", level: 1, text: "One" });
  assert.deepEqual(blocks[2], { type: "heading", level: 3, text: "Three" });
  assert.deepEqual(blocks[3], { type: "link", url: "gemini://example.org/", label: "Home" });
  assert.deepEqual(blocks[4], { type: "list", items: ["a", "b"] });
});

test("parse: a fourth # is text, not a heading level", () => {
  const [b] = parse("#### deep");
  assert.deepEqual(b, { type: "heading", level: 3, text: "# deep" });
});

test("parse: a link with no label keeps an empty one, so the URL can stand in", () => {
  assert.deepEqual(parse("=> gemini://example.org/"), [
    { type: "link", url: "gemini://example.org/", label: "" },
  ]);
  // Tabs and extra spaces are whitespace like any other.
  assert.deepEqual(parse("=>\tgemini://x/\tthe label"), [
    { type: "link", url: "gemini://x/", label: "the label" },
  ]);
});

test('parse: "*" needs its space to be a list item', () => {
  assert.equal(parse("*starred*")[0].type, "text");
  assert.equal(parse("* item")[0].type, "list");
});

test("parse: nothing inside a preformatted block is syntax", () => {
  const blocks = parse(["```python", "# not a heading", "* not a list", "```", "# a heading"].join("\n"));
  assert.deepEqual(blocks[0], {
    type: "pre",
    alt: "python",
    lines: ["# not a heading", "* not a list"],
    closed: true,
  });
  assert.equal(blocks[1].type, "heading");
});

test("parse: an unclosed fence still shows its contents", () => {
  const [b] = parse("```\nstranded");
  assert.deepEqual(b, { type: "pre", alt: "", lines: ["stranded"], closed: false });
});

test("parse: adjacent list and quote lines merge, separated ones don't", () => {
  const blocks = parse(["* a", "text", "* b", "> q1", "> q2"].join("\n"));
  assert.deepEqual(
    blocks.map((b) => b.type),
    ["list", "text", "list", "quote"]
  );
  assert.deepEqual(blocks[3], { type: "quote", lines: ["q1", "q2"] });
});

test("parse: CRLF and CR are line endings too", () => {
  assert.equal(parse("# a\r\n# b\r# c").length, 3);
});

test("lint: the three mistakes a client renders without complaining", () => {
  const found = lint(["=>", "see https://example.com for more", "```", "raw"].join("\n"));
  assert.deepEqual(
    found.map((f) => [f.line, f.rule]),
    [
      [1, "empty-link"],
      [2, "bare-url"],
      [3, "unclosed-fence"],
    ]
  );
});

test("lint: a clean draft lints clean, and preformatted text is exempt", () => {
  const draft = ["# Title", "=> gemini://example.org/ Home", "```", "curl https://example.com", "```"].join("\n");
  assert.deepEqual(lint(draft), []);
});

test("stats counts prose, not syntax", () => {
  const s = stats("# Title\n\ntwo words\n=> gemini://x/ a label\n");
  // "Title" + "two words" + the link's label. Not "#", "=>" or the URL.
  assert.deepEqual({ lines: s.lines, words: s.words, links: s.links }, { lines: 5, words: 5, links: 1 });
  assert.equal(stats("").lines, 0);
  assert.equal(stats("```\nlots of code words in here\n```").words, 0);
});

test("slugify: filename-safe, and never empty", () => {
  assert.equal(slugify("Hello, Gemini!"), "hello-gemini");
  assert.equal(slugify("  Café — déjà vu  "), "cafe-deja-vu");
  assert.equal(slugify("it's fine"), "its-fine");
  assert.equal(slugify(""), "untitled");
  assert.equal(slugify("日本語"), "untitled");
  assert.ok(slugify("x".repeat(200)).length <= 60);
});

test("localDate is local, not UTC", () => {
  const at = new Date(2026, 8, 21, 23, 30).getTime(); // 11:30pm on the 21st, locally
  assert.equal(localDate(at), "2026-09-21");
  assert.equal(fileName({ title: "Hello Gemini", createdAt: at }), "2026-09-21-hello-gemini.gmi");
});

test("fileNames: same title, same day, different files", () => {
  const at = new Date(2026, 8, 21, 9, 0).getTime();
  const names = fileNames([
    { id: "a", title: "notes", createdAt: at },
    { id: "b", title: "notes", createdAt: at },
    { id: "c", title: "notes", createdAt: at + 86_400_000 },
  ]);
  assert.equal(names.get("a"), "2026-09-21-notes.gmi");
  assert.equal(names.get("b"), "2026-09-21-notes-2.gmi");
  assert.equal(names.get("c"), "2026-09-22-notes.gmi");
});

test("buildIndex: newest written first, whatever order it's handed", () => {
  const day = (/** @type {number} */ d) => new Date(2026, 8, d, 12).getTime();
  const index = buildIndex({
    title: "My Gemlog",
    posts: [
      { id: "old", title: "First", createdAt: day(1) },
      { id: "new", title: "Third", createdAt: day(9) },
      { id: "mid", title: "Second", createdAt: day(5) },
    ],
  });
  assert.deepEqual(index.split("\n"), [
    "# My Gemlog",
    "",
    "=> 2026-09-09-third.gmi 2026-09-09 Third",
    "=> 2026-09-05-second.gmi 2026-09-05 Second",
    "=> 2026-09-01-first.gmi 2026-09-01 First",
    "",
  ]);
});

test("buildIndex: an edit does not reorder the index", () => {
  const day = (/** @type {number} */ d) => new Date(2026, 8, d, 12).getTime();
  // updatedAt is deliberately not an input: the only ordering key is creation.
  const posts = [
    { id: "old", title: "Old", createdAt: day(1), updatedAt: day(30) },
    { id: "new", title: "New", createdAt: day(9), updatedAt: day(9) },
  ];
  assert.match(buildIndex({ title: "t", posts }).split("\n")[2], /2026-09-09-new\.gmi/);
});

test("buildIndex: an empty capsule says so, and an untitled post still links", () => {
  assert.match(buildIndex({ title: "", posts: [] }), /^# Gemlog\n\nNo posts yet\.\n$/);
  const at = new Date(2026, 8, 21, 12).getTime();
  assert.match(
    buildIndex({ title: "t", posts: [{ id: "a", title: "", createdAt: at }] }),
    /=> 2026-09-21-untitled\.gmi 2026-09-21 Untitled/
  );
});

test("the index it generates parses back as gemtext", () => {
  const at = new Date(2026, 8, 21, 12).getTime();
  const blocks = parse(buildIndex({ title: "My Gemlog", posts: [{ id: "a", title: "Hi", createdAt: at }] }));
  assert.deepEqual(
    blocks.map((b) => b.type),
    ["heading", "text", "link", "text"]
  );
  assert.deepEqual(lint(buildIndex({ title: "My Gemlog", posts: [{ id: "a", title: "Hi", createdAt: at }] })), []);
});
