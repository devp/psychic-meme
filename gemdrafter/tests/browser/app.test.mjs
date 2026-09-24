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

/**
 * Set to pretend a deploy happened: the bytes are appended to
 * precache-manifest.js, which is the only file a real deploy changes. The
 * comment doesn't alter what gets precached -- just the script's bytes, which
 * is exactly what the worker's update check compares.
 */
const deploy = { bump: "" };

function serve() {
  const server = createServer(async (req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname));
    const file = join(root, path === "/" ? "index.html" : path);
    try {
      if (!file.startsWith(root)) throw new Error("outside root");
      const body =
        path === "/precache-manifest.js" && deploy.bump
          ? Buffer.concat([await readFile(file), Buffer.from(deploy.bump)])
          : await readFile(file);
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
  const slug = page.locator("#post-slug");
  const body = page.locator("#post-body");
  const status = () => page.locator("#draft-status").innerText();
  const saveState = () => page.locator("#save-state").innerText();

  await page.goto(URL, { waitUntil: "networkidle" });
  await settle();

  // --- first run opens a blank draft ---------------------------------------
  await ok("opens on the draft tab", await page.locator('.panel[data-panel="draft"]').isVisible());
  await ok("with an empty post", (await body.inputValue()) === "" && (await title.inputValue()) === "");
  await ok("and a slug already decided", (await status()).includes("uploads as untitled"), await status());
  await ok("the host is shown beside the slug",
    (await page.locator("#slug-host").innerText()) === "devp.smol.pub/");

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
  await ok("the slug follows the title", stat.includes("uploads as hello-gemini"), stat);
  await ok("and shows in the slug field as a placeholder",
    (await slug.getAttribute("placeholder")) === "hello-gemini");
  await ok("a clean draft lints clean", (await page.locator(".lint").count()) === 0);

  // --- autosave says so ----------------------------------------------------
  await ok("typing marks the draft dirty",
    (await page.locator("#save-state").getAttribute("data-state")) === "dirty" ||
      /saved/.test(await saveState()), await saveState());
  await settleSave();
  await ok("and the save is reported", /^saved /.test(await saveState()), await saveState());

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

  // --- a slug you set outlives the title ------------------------------------
  await clickTab("draft");
  await settle();
  await slug.fill("hello-gemini-forever");
  await title.fill("Hello Gemini, retitled");
  await settle();
  await ok("the set slug stays put", (await status()).includes("uploads as hello-gemini-forever"),
    await status());
  await slug.fill("");
  await settle();
  await ok("clearing it goes back to deriving",
    (await status()).includes("uploads as hello-gemini-retitled"), await status());
  await title.fill("Hello Gemini");
  await settleSave();

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

  // --- writing mode: the chrome folds away for the keyboard -----------------
  // The viewport is shrunk by hand, because a headless browser has no on-screen
  // keyboard to shrink it for us. 420px is about what a phone has left with one
  // up.
  const chromeShown = async () => ({
    header: await page.locator(".app-header").isVisible(),
    tabs: await page.locator("gem-tabs").isVisible(),
    title: await title.isVisible(),
    slug: await slug.isVisible(),
    buttons: await page.locator(".editor .add-row").isVisible(),
    history: await page.locator("#history").isVisible(),
  });
  const bodyHeight = () =>
    body.evaluate((/** @type {HTMLElement} */ el) => el.getBoundingClientRect().height);

  await clickTab("draft");
  await body.click();
  await settle();
  await ok("a tall viewport keeps its chrome even with the body focused",
    (await chromeShown()).header === true);

  const tallBody = await bodyHeight();
  await page.setViewportSize({ width: 390, height: 420 });
  await body.click();
  await settle();
  const folded = await chromeShown();
  await ok("header, title, slug, buttons and history fold away",
    !folded.header && !folded.title && !folded.slug && !folded.buttons && !folded.history,
    JSON.stringify(folded));
  await ok("the tab strip stays, because draft->preview->draft is the loop", folded.tabs);
  await ok("the insert row stays", await page.locator(".ins-row").isVisible());
  await ok("and the save state stays readable", await page.locator("#save-state").isVisible());

  // The point of the exercise: more text on screen than the app would have had.
  const shortBody = await bodyHeight();
  const wouldHaveBeen = 420 - (844 - tallBody); // same chrome, shorter viewport
  await ok("the textarea keeps most of what the viewport lost",
    shortBody > wouldHaveBeen + 150,
    `${Math.round(shortBody)}px vs ${Math.round(wouldHaveBeen)}px unfolded`);

  await ok("and it's a real number of lines", shortBody > 200, `${Math.round(shortBody)}px`);

  // Tapping the insert row must not cost the keyboard: no focus change, no
  // unfold, no jump mid-sentence.
  await body.fill("a line");
  await page.getByRole("button", { name: "=>", exact: true }).click();
  await settle();
  await ok("the insert row keeps focus in the textarea",
    await body.evaluate((/** @type {HTMLElement} */ el) => document.activeElement === el));
  await ok("so the chrome stays folded", !(await chromeShown()).header);
  await ok("and it still inserts", (await body.inputValue()) === "=> a line");
  await page.getByRole("button", { name: "=>", exact: true }).click();

  await page.locator("#post-title").evaluate((/** @type {HTMLElement} */ el) => el.blur());
  await body.evaluate((/** @type {HTMLElement} */ el) => el.blur());
  await settle();
  await ok("dismissing the keyboard gives the chrome back", (await chromeShown()).header);

  // Focus in the title is not writing mode: you need to see the field above it.
  await title.click();
  await settle();
  await ok("the title field doesn't fold anything", (await chromeShown()).slug);
  await title.evaluate((/** @type {HTMLElement} */ el) => el.blur());
  await page.setViewportSize({ width: 390, height: 844 });
  await settle();

  // --- checkpoints and history ---------------------------------------------
  await body.fill("the good version");
  await settleSave();
  await page.getByRole("button", { name: "Checkpoint", exact: true }).click();
  await settle();
  await ok("the history opens on its first checkpoint",
    await page.locator("#history").evaluate((/** @type {any} */ el) => el.open));
  await ok("and lists it", (await page.locator(".revision").count()) === 1);
  await ok("the summary counts it",
    (await page.locator("#history-summary").innerText()) === "History — 1 checkpoint",
    await page.locator("#history-summary").innerText());
  await page.getByRole("button", { name: "Checkpoint", exact: true }).click();
  await settle();
  await ok("pressing it again keeps one", (await page.locator(".revision").count()) === 1);
  await ok("and says so", (await saveState()) === "nothing new to keep", await saveState());

  await body.fill("ruined it");
  await settleSave();
  await page.getByRole("button", { name: "Restore", exact: true }).first().click();
  await settle();
  await ok("restore puts the old text back", (await body.inputValue()) === "the good version");
  await ok("and the mistake is now in the history", (await page.locator(".revision").count()) === 2);
  await page.getByRole("button", { name: "Restore", exact: true }).first().click();
  await settle();
  await ok("so the restore is itself undoable", (await body.inputValue()) === "ruined it");
  await body.fill("a line");
  await settleSave();

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
  // Live rows only: the trash renders .post-title too.
  const titles = () => page.locator(".post:not(.trashed) .post-title").allInnerTexts();
  await ok("both posts are there", (await titles()).length === 2);
  await ok("newest first", (await titles())[0] === "Third post", (await titles()).join(" | "));
  await ok("each row shows the slug it would take",
    (await page.locator(".post-file").first().innerText()) === "third-post",
    await page.locator(".post-file").first().innerText());

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
  await ok("links are slugs, with the date in the label",
    /^=> third-post 2020-01-0\d Third post$/.test(lines[2]), lines[2]);

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

  // --- trash, then storage --------------------------------------------------
  await clickTab("posts");
  await settle();
  const listed = await titles();
  await page.locator(".post .post-x").first().click();
  await settle();
  await ok("the × moves a post to the trash without asking",
    (await page.locator(".post:not(.trashed)").count()) === 1);
  await ok("the index follows", (await indexText()).split("\n").filter(Boolean).length === 2);
  await ok("the trash says what's in it",
    (await page.locator(".trash summary").innerText()) === "Trash — 1",
    await page.locator(".trash summary").innerText());

  await clickTab("draft");
  await settle();
  await ok("the editor opens the surviving post, not a blank",
    (await title.inputValue()) === listed[1], await title.inputValue());

  await clickTab("posts");
  await page.locator(".trash summary").click();
  await settle();
  await ok("a trashed post keeps its history",
    (await page.locator(".post.trashed .post-meta").innerText()).includes("checkpoints kept"),
    await page.locator(".post.trashed .post-meta").innerText());

  await page.getByRole("button", { name: "Restore", exact: true }).first().click();
  await settle();
  await ok("restoring puts it back in the list", (await page.locator(".post:not(.trashed)").count()) === 2);
  await ok("in its own place, not at the top", (await titles())[0] === listed[0], (await titles()).join(" | "));
  await ok("and the trash is gone when it's empty", (await page.locator(".trash").count()) === 0);

  // Only the trash can take something out of storage, and only after asking.
  await page.locator(".post .post-x").first().click();
  await settle();
  await page.locator(".trash summary").click();
  page.once("dialog", (d) => d.dismiss());
  await page.locator(".post.trashed .post-x").click();
  await settle();
  await ok("a declined confirm keeps the post", (await page.locator(".post.trashed").count()) === 1);
  const stored = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem("gemdrafter:posts:records") ?? "[]").length);
  await ok("and it's still in storage", (await stored()) === 2, String(await stored()));

  page.once("dialog", (d) => d.accept());
  await page.locator(".post.trashed .post-x").click();
  await settle();
  await ok("accepting deletes it from storage", (await stored()) === 1, String(await stored()));
  await ok("and the trash goes away", (await page.locator(".trash").count()) === 0);

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

  // --- knowing which build you're on ---------------------------------------
  await ok("the registration revalidates its imports",
    (await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      return reg?.updateViaCache;
    })) === "none",
    "updateViaCache");

  await page.click("#settings-btn");
  await page.waitForFunction(() => !/checking/.test(document.getElementById("build-state")?.textContent ?? ""));
  const build = await page.locator("#build-state").innerText();
  await ok("Options names the build the worker is serving",
    /^build [0-9a-f]{8} · \d+ files cached$/.test(build), build);
  await page.click("#settings-close");

  // The same manifest has to give the same id twice, or it isn't a version.
  const twice = await page.evaluate(async () => {
    const ask = () =>
      new Promise((resolve) => {
        const ch = new MessageChannel();
        ch.port1.onmessage = (e) => resolve(e.data.build);
        navigator.serviceWorker.controller?.postMessage({ type: "build" }, [ch.port2]);
      });
    return [await ask(), await ask()];
  });
  await ok("the build id is stable", twice[0] === twice[1], twice.join(" vs "));

  await ok("no update bar on a page that didn't update",
    await page.locator("#update-bar").isHidden());
  // A worker taking over a page that already had one is the update case. The
  // event is dispatched by hand because a real one needs a second deploy.
  await page.evaluate(() => navigator.serviceWorker.dispatchEvent(new Event("controllerchange")));
  await settle();
  await ok("a worker handover offers a reload", await page.locator("#update-bar").isVisible());
  await ok("and says why",
    (await page.locator("#update-bar span").innerText()) === "A new version is installed.");

  // --- checking for a new build ---------------------------------------------
  // From a clean page: the synthetic controllerchange above left the bar and
  // the dialog's reload button showing, which is the state this section is
  // about arriving at honestly.
  await page.reload({ waitUntil: "networkidle" });
  await settle();
  await ok("a fresh load offers no reload", await page.locator("#update-bar").isHidden());
  await page.click("#settings-btn");
  await page.waitForFunction(() => !/checking/.test(document.getElementById("build-state")?.textContent ?? ""));
  const beforeCheck = await page.locator("#build-state").innerText();

  await page.getByRole("button", { name: "Check for updates" }).click();
  await page.waitForFunction(() => !/checking/.test(document.getElementById("build-state")?.textContent ?? ""));
  await ok("checking with nothing deployed says you're current",
    (await page.locator("#build-state").innerText()) === beforeCheck,
    await page.locator("#build-state").innerText());
  await ok("and offers no reload", await page.locator("#update-reload-now").isHidden());

  // Now pretend a deploy happened. This is the case the button exists for: the
  // browser would otherwise only look on a navigation, which a home-screen app
  // may go weeks without.
  deploy.bump = "\n// redeployed\n";
  await page.getByRole("button", { name: "Check for updates" }).click();
  await page.waitForSelector("#update-bar:not([hidden])", { timeout: 10000 });
  await page.waitForFunction(() => !/checking/.test(document.getElementById("build-state")?.textContent ?? ""));
  await ok("a check finds a deploy and raises the bar", true);
  await ok("the dialog offers the reload too", await page.locator("#update-reload-now").isVisible());
  await ok("and says what happened",
    /new version/i.test(await page.locator("#build-state").innerText()),
    await page.locator("#build-state").innerText());

  // The reload is the thing that actually puts you on it.
  await page.click("#update-reload-now");
  await page.waitForLoadState("networkidle");
  await settle();
  await ok("reloading clears the bar", await page.locator("#update-bar").isHidden());
  await ok("and the draft survived the reload", (await title.inputValue()) === "Third post",
    await title.inputValue());
  // Left deployed on purpose: reverting it would be another byte change, and
  // another update, in the middle of the offline tests below.

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
  await ok("works offline after reload", (await title.inputValue()) === "Third post",
    await title.inputValue());
  // query string must not miss the cache
  await page.goto(URL + "?utm_source=subway", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  await ok("offline with a query string (ignoreSearch)",
    (await page.locator("gem-tabs .tab").count()) === 5);
  await ctx.setOffline(false);

  await ok("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
});
