import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

// Opt-in: skipped unless playwright is installed (`just dev-init-browser`).
let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {}

const root = new URL("../..", import.meta.url).pathname;
const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
};

function serve() {
  const server = createServer(async (req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname));
    const file = join(root, path === "/" ? "index.html" : path);
    try {
      if (!file.startsWith(root)) throw new Error("outside root");
      const body = await readFile(file);
      res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

test("gemdrafter in a real browser", { skip: !chromium && "playwright not installed" }, async (t) => {
  const server = await serve();
  const URL = `http://127.0.0.1:${server.address().port}/index.html`;
  // Prefer an explicitly-provided binary, then installed Chrome, then
  // `npx playwright install chromium`. The env var is for container images
  // that ship a browser whose build doesn't match the installed playwright:
  //   PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium just dev-check-tests
  const browser = process.env.PLAYWRIGHT_CHROMIUM_PATH
    ? await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
    : await chromium.launch({ channel: "chrome" }).catch(() => chromium.launch());
  t.after(async () => {
    await browser.close();
    server.closeAllConnections();
    server.close();
  });

  const ok = (name, cond, extra = "") => t.test(name, () => assert.ok(cond, extra || name));

  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

  const clickTab = (name) => page.getByRole("tab", { name, exact: true }).click();
  const settle = () => page.waitForTimeout(80);
  /** Writes are debounced 300ms in app.js; a tab switch flushes them. */
  const settleSave = () => page.waitForTimeout(420);
  const title = page.locator("#post-title");
  const body = page.locator("#post-body");
  const status = () => page.locator("#draft-status").innerText();

  await page.goto(URL, { waitUntil: "networkidle" });
  await settle();

  // --- first run opens a blank draft ---------------------------------------
  await ok("opens on the draft tab", await page.locator('.panel[data-panel="draft"]').isVisible());
  await ok("with an empty post", (await body.inputValue()) === "" && (await title.inputValue()) === "");
  await ok("and a filename already decided", (await status()).includes("-untitled.gmi"), await status());

  // --- typing: status, lint and preview all follow the textarea ------------
  await title.fill("Hello Gemini");
  await body.fill(
    [
      "# Hello Gemini",
      "",
      "A text line is a whole paragraph.",
      "=> gemini://geminiprotocol.net/ The spec",
      "* one",
      "* two",
      "> quoted",
      "```alt text",
      "  pre",
      "```",
    ].join("\n")
  );
  await settle();
  const stat = await status();
  await ok("status counts lines, links and prose words", /10 lines · 1[0-9] words · 1 link/.test(stat), stat);
  await ok("filename follows the title", stat.includes("-hello-gemini.gmi"), stat);
  await ok("a clean draft lints clean", (await page.locator(".lint").count()) === 0);

  await clickTab("preview");
  await settle();
  const types = await page.$$eval(
    "#draft-preview > *",
    (els) => els.map((e) => e.tagName.toLowerCase() + "." + (e.className || ""))
  );
  await ok(
    "every line type renders as itself",
    types.join(" ") === "h1.gem-h1 div.gem-blank p.gem-text p.gem-link ul.gem-list blockquote.gem-quote pre.gem-pre",
    types.join(" ")
  );
  await ok("list items are items", (await page.locator("#draft-preview .gem-list li").count()) === 2);
  await ok("the link keeps its label",
    (await page.locator("#draft-preview .gem-link a").innerText()) === "The spec");
  await ok("and says which scheme it is",
    (await page.locator("#draft-preview .gem-scheme").innerText()) === "gemini");
  await ok("preformatted alt text lands on the element",
    (await page.getAttribute("#draft-preview .gem-pre", "aria-label")) === "alt text");

  // Gemtext has no inline markup, so a draft full of angle brackets is text.
  await clickTab("draft");
  await body.fill("<script>alert(1)</script>\n=> javascript:alert(2) nope");
  await settle();
  await clickTab("preview");
  await settle();
  await ok("markup in a draft stays text",
    (await page.locator("#draft-preview .gem-text").innerText()) === "<script>alert(1)</script>");
  await ok("no injected element", (await page.locator("#draft-preview script").count()) === 0);

  // --- the lint rules ------------------------------------------------------
  await clickTab("draft");
  await body.fill("=>\nsee https://example.com for more\n```\nstranded");
  await settle();
  const lints = await page.locator(".lint").allInnerTexts();
  await ok("three findings, in line order", lints.length === 3, lints.join(" | "));
  await ok("empty link", lints[0].startsWith("line 1: link line with no URL"), lints[0]);
  await ok("bare url", lints[1].includes("won't be a link"), lints[1]);
  await ok("unclosed fence", lints[2].includes("never closed"), lints[2]);
  await ok("an unclosed block is marked in the preview too",
    (await page.locator("#draft-preview .gem-pre.unclosed").count()) === 1);

  // --- the insert row is a toggle -----------------------------------------
  await body.fill("a line");
  await body.click();
  await page.getByRole("button", { name: "=>", exact: true }).click();
  await ok("prefix goes on the caret's line", (await body.inputValue()) === "=> a line");
  await page.getByRole("button", { name: "=>", exact: true }).click();
  await ok("and comes back off", (await body.inputValue()) === "a line");

  // --- posts: newest written first ----------------------------------------
  await title.fill("Second post");
  await clickTab("posts");
  await settle();
  await ok("the draft is listed", (await page.locator(".post").count()) === 1);
  await page.getByRole("button", { name: "New post" }).click();
  await settle();
  await title.fill("Third post");
  await body.fill("more");
  await clickTab("posts");
  await settle();
  const titles = () => page.locator(".post-title").allInnerTexts();
  await ok("both posts are there", (await titles()).length === 2);
  await ok("newest first", (await titles())[0] === "Third post", (await titles()).join(" | "));
  await ok("each row shows the file it would become",
    (await page.locator(".post-file").first().innerText()).endsWith("-third-post.gmi"));

  // Backdate one post and reload: creation order, not edit order, decides.
  await page.evaluate(() => {
    const key = "gemdrafter:posts:records";
    const recs = JSON.parse(localStorage.getItem(key));
    const old = recs.find((r) => r.name === "Third post");
    old.createdAt = Date.UTC(2020, 0, 2);
    old.updatedAt = Date.now();
    localStorage.setItem(key, JSON.stringify(recs));
  });
  await page.reload({ waitUntil: "networkidle" });
  await settle();
  await ok("posts tab persists", await page.locator('.panel[data-panel="posts"]').isVisible());
  await ok("a backdated post sorts old despite a fresh edit",
    (await titles())[0] === "Second post", (await titles()).join(" | "));
  await ok("months are headings", (await page.locator(".month-head").count()) === 2,
    `${await page.locator(".month-head").count()} month headings`);

  // --- the index is generated, newest first --------------------------------
  await clickTab("index");
  await settle();
  const indexText = () => page.locator("#index-out").innerText();
  const lines = (await indexText()).split("\n").filter(Boolean);
  await ok("index is headed by the capsule title", lines[0] === "# My Gemlog", lines[0]);
  await ok("one link line per post", lines.length === 3, lines.join(" | "));
  await ok("newest first", lines[1].includes("Second post") && lines[2].includes("Third post"),
    lines.slice(1).join(" | "));
  await ok("the backdated post keeps its own date", /=> 2020-01-0\d-third-post\.gmi 2020-01-0\d/.test(lines[2]),
    lines[2]);

  await page.locator("#capsule-title").fill("Jackson Heights Gemlog");
  await settle();
  await ok("capsule title heads the index", (await indexText()).startsWith("# Jackson Heights Gemlog"));
  await ok("the rendered index is the same component",
    (await page.locator("#index-preview .gem-link").count()) === 2);

  // --- a post opens from the list and round-trips through storage ----------
  await clickTab("posts");
  await settle();
  await page.locator(".post-open").first().click();
  await settle();
  await ok("opening a post switches to the draft tab",
    await page.locator('.panel[data-panel="draft"]').isVisible());
  await ok("with its title loaded", (await title.inputValue()) === "Second post");
  await body.fill("edited, then left alone");
  await settleSave();
  await page.reload({ waitUntil: "networkidle" });
  await settle();
  await ok("the edit survived a reload", (await body.inputValue()) === "edited, then left alone");
  await ok("and it's still the same post", (await title.inputValue()) === "Second post");

  // --- delete ---------------------------------------------------------------
  await clickTab("posts");
  await settle();
  page.once("dialog", (d) => d.accept());
  await page.locator(".post-x").first().click();
  await settle();
  await ok("deleting removes the row", (await page.locator(".post").count()) === 1);
  await ok("the index follows", (await indexText()).split("\n").filter(Boolean).length === 2);
  await clickTab("draft");
  await settle();
  await ok("the editor opens the surviving post, not a blank",
    (await title.inputValue()) === "Third post", await title.inputValue());

  // --- theme ---------------------------------------------------------------
  await page.click("#settings-btn");
  await page.click('[data-set-theme="phosphor"]');
  await settle();
  await ok("theme applies", (await page.getAttribute("html", "data-theme")) === "phosphor");
  await ok("swatch aria-checked syncs",
    (await page.getAttribute('[data-set-theme="phosphor"]', "aria-checked")) === "true");
  await page.click("#settings-close");

  // --- gem-preview travels --------------------------------------------------
  // Driven through its property interface, which is the whole point of it.
  await page.evaluate(() => {
    const el = /** @type {any} */ (document.getElementById("index-preview"));
    el.text = "# From a property\n=> gemini://example.org/ nothing to do with the app";
  });
  await settle();
  await ok("a preview renders text it was handed",
    (await page.locator("#index-preview .gem-h1").innerText()) === "From a property");

  // --- offline (the whole point of the skeleton) ---------------------------
  const swState = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return "none";
    await navigator.serviceWorker.ready;
    return reg.active ? "active" : "registered";
  });
  await ok("service worker activates", swState === "active", swState);

  const cached = await page.evaluate(async () => {
    const names = await caches.keys();
    const c = await caches.open(names[0]);
    return (await c.keys()).length;
  });
  await ok("assets precached", cached >= 10, `${cached} entries in cache`);

  await ctx.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  await ok("works offline after reload", (await title.inputValue()) === "Third post");
  // query string must not miss the cache
  await page.goto(URL + "?utm_source=subway", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  await ok("offline with a query string (ignoreSearch)",
    (await page.locator("gem-tabs .tab").count()) === 5);
  await ctx.setOffline(false);

  await ok("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
});
