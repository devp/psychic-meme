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
// The localStorage prefix new-app.sh set; read, not hardcoded, so a renamed copy passes.
const appNs = (await readFile(join(root, "index.html"), "utf8")).match(/name="app-ns" content="([^"]+)"/)?.[1];
const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
};

// Path (as requested, e.g. "/app.css") -> body to serve instead of the file,
// or a number to answer with that status. Stands in for a deploy.
const overrides = new Map();

function serve() {
  const server = createServer(async (req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname));
    const file = join(root, path === "/" ? "index.html" : path);
    const override = overrides.get(path);
    if (typeof override === "number") return void res.writeHead(override).end();
    if (override !== undefined) {
      res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
      return void res.end(override);
    }
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

test("app in a real browser", { skip: !chromium && "playwright not installed" }, async (t) => {
  const server = await serve();
  const URL = `http://127.0.0.1:${server.address().port}/index.html`;
  // Prefer installed Chrome; fall back to `node_modules/.bin/playwright install chromium`.
  const browser = await chromium.launch({ channel: "chrome" }).catch(() => chromium.launch());
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

  // noembed.com stands in for the title lookup; never hit the network.
  let noembed = '{"title":"Fetched Title"}';
  await ctx.route("https://noembed.com/**", (r) => r.fulfill({ contentType: "application/json", body: noembed }));
  // The embed players: answer with a stub so the iframe has something to load.
  await ctx.route((u) => /(youtube-nocookie|instagram|facebook|example)\.com$/.test(u.hostname), (r) => r.fulfill({ contentType: "text/html", body: "<p>embed</p>" }));

  const ls = (k) => page.evaluate((k) => localStorage.getItem(k), `${appNs}:${k}`);
  const cardsNow = async () => JSON.parse((await ls("deck:records")) ?? "[]")[0]?.items ?? [];
  const desc = () => page.locator(".card .desc").innerText();
  const pos = () => page.locator(".deck-nav .pos").innerText();
  const box = async () => (await page.locator(".stage").boundingBox()) ?? { x: 0, y: 0, width: 0, height: 0 };
  /** Drag across the stage with a mouse, which sends the same pointer events a finger does. */
  const drag = async (dx, dy, holdMs = 0) => {
    // Taps and holds go on the description: on the comment box they're the box's.
    const b = dx || dy ? await box() : ((await page.locator(".card .desc").boundingBox()) ?? (await box()));
    const x = b.x + b.width / 2, y = b.y + b.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    if (holdMs) await page.waitForTimeout(holdMs);
    await page.mouse.move(x + dx, y + dy, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(60);
  };

  // --- empty, then share in ------------------------------------------------
  await page.goto(URL, { waitUntil: "networkidle" });
  await ok("empty deck says so", await page.locator(".empty").isVisible());

  await page.goto(URL + "?text=" + encodeURIComponent("first one https://example.com/a"), { waitUntil: "networkidle" });
  await ok("share: card added with text as description", (await desc()) === "first one", await desc());
  await ok("share: query string is cleaned up", (await page.evaluate(() => location.search)) === "");
  await ok("share: toast confirms", (await page.locator(".toast").innerText()).startsWith("added"));

  await page.goto(URL + "?url=" + encodeURIComponent("https://youtu.be/ID"), { waitUntil: "networkidle" });
  await page.waitForTimeout(150);
  const all = await cardsNow();
  await ok("share: second card", all.length === 2);
  await ok("share: no description fetches the title", all[1].description === "Fetched Title", all[1].description);
  await ok("share: addedAt stamped", typeof all[1].addedAt === "number" && all[1].readAt === null && all[1].comment === null);

  await page.goto(URL + "?url=" + encodeURIComponent("https://youtu.be/ID"), { waitUntil: "networkidle" });
  await ok("share: duplicate is refused", (await cardsNow()).length === 2 && (await page.locator(".toast").innerText()).includes("already"));

  await page.goto(URL + "?text=" + encodeURIComponent("third https://www.instagram.com/p/ABC/"), { waitUntil: "networkidle" });

  // --- swiping ---------------------------------------------------------------
  await ok("deck opens on the oldest", (await desc()) === "first one" && (await pos()) === "1 / 3", await pos());
  await drag(-120, 0);
  await ok("swipe left: next card", (await desc()) === "Fetched Title", await desc());
  await drag(120, 0);
  await drag(120, 0);
  await ok("swipe right past the start wraps round", (await desc()) === "third", await desc());
  await page.reload({ waitUntil: "networkidle" });
  await ok("position persists across reload", (await desc()) === "third");

  // --- comment ---------------------------------------------------------------
  await page.fill(".card .comment", "  nice one \n");
  await page.waitForTimeout(500);
  await ok("comment autosaves, trimmed", (await cardsNow())[2].comment === "nice one");
  await page.fill(".card .comment", "   ");
  await page.locator(".card .desc").click({ position: { x: 1, y: 1 }, trial: true });
  await page.waitForTimeout(500);
  await ok("blank comment saves as null", (await cardsNow())[2].comment === null);

  // --- reading -----------------------------------------------------------------
  await drag(0, 0);
  await ok("tap: reader opens", await page.locator(".reader[open]").isVisible());
  const src = await page.locator(".reader iframe").getAttribute("src");
  await ok("tap: instagram renders as embed by default", src === "https://www.instagram.com/p/ABC/embed/captioned/", src ?? "");
  const box90 = await page.locator(".reader").boundingBox();
  await ok("reader takes ~90% of the viewport", Math.abs((box90?.width ?? 0) - 351) < 4, String(box90?.width));
  await ok("tap: marked read", typeof (await cardsNow())[2].readAt === "number");
  await page.click(".reader .close");
  await ok("[x] closes, iframe gone", !(await page.locator(".reader[open]").count()) && !(await page.locator(".reader iframe").count()));
  await ok("read card stays until we move", (await desc()) === "third" && (await page.locator(".card .read-tag").count()) === 1);
  await drag(-120, 0);
  await ok("moving on drops the read card", (await pos()) === "1 / 2", await pos());
  await drag(-120, 0);
  await ok("…and it doesn't come round again", (await desc()) !== "third" && (await pos()) === "2 / 2");

  // --- edit, lanes -------------------------------------------------------------
  await drag(0, 0, 700);
  await ok("long press opens the editor", await page.locator(".editor[open]").isVisible());
  await ok("long press doesn't read", !(await page.locator(".reader[open]").count()));
  await page.selectOption('.editor select[name="lane"]', { label: "new lane…" });
  await page.fill('.editor input[name="lane-new"]', "music");
  await page.fill('.editor textarea[name="description"]', "renamed");
  await page.click(".editor .btn.primary");
  await ok("edit saves description", (await desc()) === "renamed");
  await ok("new lane appears after all", (await page.locator(".lane-chip.lane").count()) === 2);

  const chip = () => page.locator('.lane-chip.lane[aria-pressed="true"]').innerText();
  await drag(0, -120);
  await ok("swipe up: next lane", (await chip()).startsWith("music"));
  await ok("lane filters", (await pos()) === "1 / 1" && (await desc()) === "renamed");
  await drag(0, 120);
  await ok("swipe down: back to all", (await chip()).startsWith("all") && (await pos()) === "2 / 2", await pos());

  await drag(0, 0, 700);
  await page.fill('.editor textarea[name="description"]', "not this");
  await page.click('.editor .btn.close');
  await ok("cancel discards", (await desc()) === "renamed");

  // The read toggle: every lane's read cards. Un-mark from the card, re-mark
  // from the editor, un-mark again.
  const toggle = (/** @type {string} */ v) => page.locator(".show-toggle .lane-chip", { hasText: new RegExp(`^${v}$`) });
  await toggle("read").click();
  await ok("read toggle: all lanes' read cards", (await desc()) === "third" && (await pos()) === "1 / 1", await pos());
  await ok("…and it persists", (await ls("show")) === "read");
  await drag(0, -120);
  await ok("read toggle: per lane", (await chip()).startsWith("music") && (await pos()) === "0 / 0", await pos());
  await drag(0, 120);
  await page.click(".card .btn.unread");
  await ok("mark unread button clears readAt", (await cardsNow())[2].readAt === null);
  await ok("…and the card stays until we move", (await desc()) === "third" && !(await page.locator(".card .read-tag").count()));
  await drag(0, 0, 700);
  await page.check('.editor input[name="read"]');
  await page.click(".editor .btn.primary");
  await ok("editor marks read again", typeof (await cardsNow())[2].readAt === "number");
  await page.click(".card .btn.unread");
  await toggle("unread").click();
  await ok("mark unread puts it back in the deck", (await pos()).endsWith("/ 3"), await pos());

  // --- spin ----------------------------------------------------------------------
  const before = await desc();
  await page.click("#spin-btn");
  await page.waitForTimeout(1500);
  await ok("spin lands somewhere else", (await desc()) !== before);

  // --- options -------------------------------------------------------------------
  await page.click("#settings-btn");
  await page.selectOption('select[data-mode="instagram"]', "open");
  await ok("render mode persists", JSON.parse((await ls("modes")) ?? "{}").instagram === "open");
  const [download] = await Promise.all([page.waitForEvent("download"), page.click("#export-all")]);
  const exported = JSON.parse(await (await import("node:fs/promises")).readFile(await download.path(), "utf8"));
  await ok("export all", exported.cards.length === 3);
  await page.click("#delete-read");
  await ok("delete read: first tap only asks", (await cardsNow()).length === 3);
  await page.click('[data-set-theme="santa-monica"]');
  await ok("theme applies", (await page.getAttribute("html", "data-theme")) === "santa-monica");
  await ok("swatch aria-checked syncs", (await page.getAttribute('[data-set-theme="santa-monica"]', "aria-checked")) === "true");
  await page.click("#settings-close");
  await ok("storage keys use the app-ns meta", (await ls("theme")) === "santa-monica");

  // --- title retries -------------------------------------------------------
  const cardAt = async (/** @type {string} */ url) => (await cardsNow()).find((c) => c.url === url);
  noembed = "{}"; // the lookup comes back with nothing
  await page.goto(URL + "?url=" + encodeURIComponent("https://example.com/later"), { waitUntil: "networkidle" });
  const tried = await cardAt("https://example.com/later");
  await ok("title: nothing found leaves it blank", tried?.description === "" && typeof tried?.titleTriedAt === "number");
  noembed = '{"title":"Later Title"}';
  await page.reload({ waitUntil: "networkidle" });
  await ok("title: no retry within a day", (await cardAt("https://example.com/later"))?.description === "");
  await page.evaluate(([key, url]) => {
    const records = JSON.parse(localStorage.getItem(key) ?? "[]");
    records[0].items.find((/** @type {any} */ c) => c.url === url).titleTriedAt = 0;
    localStorage.setItem(key, JSON.stringify(records));
  }, [`${appNs}:deck:records`, "https://example.com/later"]);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(150);
  await ok("title: retried on launch a day on", (await cardAt("https://example.com/later"))?.description === "Later Title");

  noembed = "{}";
  await page.goto(URL + "?url=" + encodeURIComponent("https://example.com/open"), { waitUntil: "networkidle" });
  noembed = '{"title":"Open Title"}';
  await page.evaluate(async (url) => {
    const deck = /** @type {any} */ (document.querySelector("cr-deck"));
    const records = JSON.parse(localStorage.getItem(`${document.querySelector('meta[name="app-ns"]')?.getAttribute("content")}:deck:records`) ?? "[]");
    deck.fire("read", records[0].items.find((/** @type {any} */ c) => c.url === url));
  }, "https://example.com/open");
  await page.waitForTimeout(150);
  await ok("title: retried on open", (await cardAt("https://example.com/open"))?.description === "Open Title");
  await page.click(".reader .close");

  // --- service worker ------------------------------------------------------
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
  await ok("assets precached", cached >= 11, `${cached} entries in cache`);

  // --- updates -------------------------------------------------------------
  // Headless pages never change visibility on their own; fake a trip to the
  // background and back, which is what app.js listens for.
  const resume = () =>
    page.evaluate(() => {
      for (const state of ["hidden", "visible"]) {
        Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
        document.dispatchEvent(new Event("visibilitychange"));
      }
    });
  // Resolves with the page's next message from sw.js, or "none" after ms.
  const nextUpdate = (ms) =>
    page.evaluate(
      (ms) =>
        new Promise((resolve) => {
          navigator.serviceWorker.addEventListener("message", (e) => resolve(e.data), { once: true });
          setTimeout(() => resolve("none"), ms);
        }),
      ms
    );
  const cachedCss = () =>
    page.evaluate(async () => (await (await caches.match("app.css"))?.text()) ?? "");
  const MARK = "\n/* deployed */\n";
  const css = await readFile(join(root, "app.css"), "utf8");
  await page.evaluate(() => (/** @type {any} */ (window).__sameDocument = true));
  const sameDocument = () => page.evaluate(() => /** @type {any} */ (window).__sameDocument === true);

  let heard = nextUpdate(1500);
  await resume();
  await ok("update: nothing deployed, no update", (await heard) === "none");
  await ok("update: nothing deployed, no reload", await sameDocument());

  overrides.set("/app.css", css + MARK);
  overrides.set("/state.js", 500);
  heard = nextUpdate(1500);
  await resume();
  await ok("update: one failed fetch stores nothing", (await heard) === "none" && !(await cachedCss()).includes(MARK));
  overrides.delete("/state.js");

  heard = nextUpdate(5000);
  await resume();
  await ok("update: a changed file is announced", (await heard) === "updated");
  await ok("update: the new bytes are cached", (await cachedCss()).includes(MARK));
  await ok("update: the toast shows right away", await page.locator("update-toast").isVisible());
  await ok("update: no reload while in use", await sameDocument());
  await Promise.all([page.waitForEvent("load"), resume()]);
  await ok("update: reloads on the next resume", !(await sameDocument()));
  const served = await page.evaluate(async () => (await fetch("app.css")).text());
  await ok("update: the reloaded page gets the new file", served.includes(MARK));
  await ok("update: no toast after reloading", !(await page.locator("update-toast").isVisible()));

  overrides.set("/app.css", css + MARK + MARK);
  await page.evaluate(() => (/** @type {any} */ (window).__sameDocument = true));
  // Right after a reload, the launch check may still be running; a resume
  // then shares it and misses this deploy. Resume until it's heard.
  let next = "none";
  for (let i = 0; i < 5 && next !== "updated"; i++) {
    heard = nextUpdate(2000);
    await resume();
    next = await heard;
  }
  await ok("update: the next one is announced", next === "updated");
  await Promise.all([page.waitForEvent("load"), page.locator("update-toast").getByRole("button", { name: "Reload" }).click()]);
  await ok("update: the toast's Reload reloads", !(await sameDocument()));
  overrides.clear();

  // --- offline (the whole point) -------------------------------------------
  await ctx.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  await ok("works offline after reload", await page.locator(".card").isVisible());
  // query string must not miss the cache
  await page.goto(URL + "?utm_source=subway", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  await ok("offline with query string (ignoreSearch)", await page.locator(".card").isVisible());
  await ctx.setOffline(false);

  await ok("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
});
