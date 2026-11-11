import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

// Opt-in: skipped unless playwright is installed (`just dev-init-browser`).
let chromium, devices;
try {
  ({ chromium, devices } = await import("playwright"));
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

  const ctx = await browser.newContext({ ...devices["Pixel 5"], permissions: ["clipboard-read", "clipboard-write"] });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

  const clickTab = (name) => page.getByRole("tab", { name, exact: true }).click();

  page.on("dialog", (d) => d.accept());
  await page.goto(URL, { waitUntil: "networkidle" });

  const entries = page.locator(".timeline .entry");
  const composer = page.locator(".composer input[name=text]");
  const say = async (text) => {
    await composer.fill(text);
    await composer.press("Enter");
    await page.waitForTimeout(40);
  };
  /** @param {string} text */
  // Match the entry's own text, not the connection chips that quote it.
  const entry = (text) => entries.filter({ has: page.locator(".entry-text", { hasText: text }) }).first();
  const clipboard = () => page.evaluate(() => navigator.clipboard.readText());

  // --- first run -----------------------------------------------------------
  await ok("opens on the records tab", await page.locator('.panel[data-panel="records"]').isVisible());
  await ok("toolkit seeds neutral starters", (await page.evaluate((k) => {
    const raw = JSON.parse(localStorage.getItem(k) ?? "[]");
    return raw[0]?.items?.length ?? 0;
  }, `${appNs}:toolkit:records`)) === 5);

  // --- start a record from the compass -------------------------------------
  await page.getByRole("button", { name: "New record" }).click();
  await ok("New record opens the record tab", await page.locator('.panel[data-panel="record"]').isVisible());
  await page.getByRole("button", { name: "Add situation" }).click();
  await ok("a corner tap focuses the composer", await composer.evaluate((el) => document.activeElement === el));
  await say("Presenting to the team tomorrow");
  await ok("adds an entry", (await entries.count()) === 1);

  // --- cause chain: situation -> thought -> feeling -> behavior -> back -----
  await entry("Presenting").click();
  await page.getByRole("button", { name: "What does it cause?" }).click();
  await ok("the composer suggests the next corner",
    (await page.locator('.cat-chip[aria-checked="true"]').innerText()) === "Thought");
  await say("I'm going to mess this up");
  await say("tight chest, dread");
  await say("kept refreshing email");
  await ok("the chain adds entries", (await entries.count()) === 4);
  await ok("each entry shows where it came from", (await entry("tight chest").locator(".route").count()) === 2);
  await ok("no hint before the loop", !(await page.locator(".rose-hint").isVisible()));
  await page.locator(".chip.existing", { hasText: "I'm going to mess" }).click();
  await page.waitForTimeout(40);
  await ok("linking back to an earlier thought shows the hint", await page.locator(".rose-hint").isVisible());
  await ok("needle points at the center", await page.locator(".rose-pin.wanted").count() === 1);
  await page.locator(".rose-hint button").click();
  await page.waitForTimeout(40);
  await ok("the hint dismisses", !(await page.locator(".rose-hint").isVisible()));

  // --- intervention, from the toolkit or typed -----------------------------
  await entry("refreshing").click();
  await page.getByRole("button", { name: "Intervene" }).click();
  await ok("toolkit offers behavior moves", (await page.locator(".chip.tool", { hasText: "different thing" }).count()) === 1);
  await ok("and not thought-only ones", (await page.locator(".chip.tool", { hasText: "evidence" }).count()) === 0);
  await page.locator(".save-tool input").check();
  await say("what evidence do I have either way?");
  await say("I've presented this twice before and it was fine");
  await ok("an intervention starts a new round", await page.locator(".rose-pin.wanted").count() === 0);
  await ok("needle points at the next unvisited corner", await page.locator(".rose-corner.wanted").count() === 1);

  // --- exports ---------------------------------------------------------------
  await page.getByRole("button", { name: "Copy timeline" }).click();
  await page.waitForTimeout(60);
  const timeline = (await clipboard()).split("\n");
  await ok("timeline: one line per entry", timeline.length === 6, timeline.join(" | "));
  await ok("timeline: dated first line", /^\d{4}-\d\d-\d\d Situation: Presenting/.test(timeline[0]), timeline[0]);
  await ok("timeline: then times", /^\d\d:\d\d \[intervention\] what evidence/.test(timeline[4]), timeline[4]);

  await page.getByRole("button", { name: "Copy map (Markdown)" }).click();
  await page.waitForTimeout(60);
  const map = await clipboard();
  await ok("map: mermaid then outline", map.startsWith("## Graph\n\n```mermaid\nflowchart TD") && map.includes("## Outline"));
  const outline = map.slice(map.indexOf("## Outline"));
  await ok("map: the loop prints as (back to), once",
    outline.split("(back to) **thought** I'm going to mess this up").length === 2, outline);
  await ok("map: every entry printed in full once",
    ["Presenting", "tight chest", "refreshing", "evidence", "twice before"].every((t) =>
      outline.split("\n").filter((l) => l.includes(t) && !l.includes("(back to)")).length === 1), outline);

  // --- resolve / reopen ------------------------------------------------------
  await page.locator('.cat-chip[data-cat="resolution"]').click();
  await page.getByRole("radio", { name: "less" }).click();
  await composer.press("Enter");
  await page.waitForTimeout(40);
  await ok("resolving with no text works", (await page.locator(".record-head .badge").innerText()) === "resolved");
  await say("a bit wobbly again");
  await ok("adding after a resolution reopens", (await page.locator(".record-head .badge").count()) === 0);

  // --- delete ----------------------------------------------------------------
  await entry("wobbly").click();
  await page.getByRole("button", { name: "Delete" }).click();
  await page.waitForTimeout(40);
  await ok("delete works", (await entries.count()) === 7);

  // --- persistence and the list ------------------------------------------------
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(120);
  await ok("state persists across reload", (await entries.count()) === 7);
  await ok("active tab persists", await page.locator('.panel[data-panel="record"]').isVisible());
  await clickTab("Records");
  await ok("the list shows the record", (await page.locator(".records li").count()) === 1);
  await ok("titled by its situation", (await page.locator(".record-title").innerText()) === "Presenting to the team tomorrow");
  await clickTab("Toolkit");
  await ok("save to toolkit kept the intervention", (await page.locator(".tool-text", { hasText: "what evidence do I have either way?" }).count()) === 1);
  await clickTab("Record");

  // --- theme ---------------------------------------------------------------
  await page.click("#settings-btn");
  await page.click('[data-set-theme="light"]');
  await page.waitForTimeout(60);
  await ok("theme applies", (await page.getAttribute("html", "data-theme")) === "light");
  await ok("light tokens apply", (await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--bg").trim())) === "#f1e4c3");
  await ok("swatch aria-checked syncs", (await page.getAttribute('[data-set-theme="light"]', "aria-checked")) === "true");
  await page.click("#settings-close");
  await ok("storage keys use the app-ns meta", (await page.evaluate((k) => localStorage.getItem(k), `${appNs}:theme`)) === "light");

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
  const offlineEntries = await entries.count();
  await ok("works offline after reload", offlineEntries === 7, `${offlineEntries} entries`);
  // query string must not miss the cache
  await page.goto(URL + "?utm_source=subway", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  await ok("offline with query string (ignoreSearch)", (await entries.count()) === 7);
  await ctx.setOffline(false);

  await ok("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
});
