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

test("app in a real browser", { skip: !chromium && "playwright not installed" }, async (t) => {
  const server = await serve();
  const URL = `http://127.0.0.1:${server.address().port}/index.html`;
  // Prefer installed Chrome; fall back to `npx playwright install chromium`.
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

  await page.goto(URL, { waitUntil: "networkidle" });

  // --- seeding -------------------------------------------------------------
  const items = await page.locator(".checklist li").count();
  await ok("checklist seeds on first run", items === 6, `${items} items`);
  await ok("count line renders", (await page.locator("forgo-checklist .count").innerText()) === "0 of 6 done");

  // --- reactivity: no manual re-render call anywhere ------------------------
  await page.locator(".checklist input[type=checkbox]").first().check();
  await page.waitForTimeout(60);
  const afterToggle = await page.locator("forgo-checklist .count").innerText();
  await ok("toggling re-renders via subscriber", afterToggle === "1 of 6 done", afterToggle);
  await ok("done style applied", await page.locator(".checklist li").first().evaluate((el) => el.classList.contains("done")));

  // --- add item (delegated submit survives innerHTML rebuild) ---------------
  await page.fill(".add-row input", "buy more batteries");
  await page.click(".add-row button");
  await page.waitForTimeout(60);
  const afterAdd = await page.locator(".checklist li").count();
  await ok("add item works after re-render", afterAdd === 7, `${afterAdd} items`);
  await ok("input clears after add", (await page.inputValue(".add-row input")) === "");
  await ok("count updates on add", (await page.locator("forgo-checklist .count").innerText()) === "1 of 7 done");

  // --- delete --------------------------------------------------------------
  await page.locator('.checklist button[aria-label="Delete"]').last().click();
  await page.waitForTimeout(60);
  await ok("delete works", (await page.locator(".checklist li").count()) === 6);

  // --- persistence ---------------------------------------------------------
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(120);
  await ok("state persists across reload", (await page.locator("forgo-checklist .count").innerText()) === "1 of 6 done");

  // --- menu bar + clock ---------------------------------------------------
  await page.click("#title-btn");
  await ok("title tab opens the menu bar", await page.locator("#menubar").isVisible());
  const clock = await page.locator("#title-btn").innerText();
  await ok("title tab shows the time while open", /\d:\d\d/.test(clock), clock);
  await page.click('[data-menu="options"]');
  await ok("menu titles switch menus", await page.locator('[data-cmd="prefs"]').isVisible());
  await page.keyboard.press("Escape");
  await ok("escape closes the menu", await page.locator("#menubar").isHidden());
  await ok("title comes back", (await page.locator("#title-btn").innerText()) === "To Do List");

  // --- beam: share sheet stubbed; clipboard fallback -----------------------
  await page.evaluate(() => {
    /** @type {any} */ (navigator).share = async (/** @type {any} */ data) => {
      /** @type {any} */ (window).__beamed = data.text;
    };
  });
  await page.click("#title-btn");
  await page.click('[data-cmd="beam"]');
  await page.waitForTimeout(60);
  const beamed = await page.evaluate(() => /** @type {any} */ (window).__beamed);
  await ok("beam shares the list as plain text", /^- \[x\] HotSync before the trip$/m.test(beamed ?? "") && /^- \[ \] Buy AAA batteries$/m.test(beamed ?? ""), beamed);
  await ok("beam dialog closes after sharing", !(await page.locator("#beam-dialog").isVisible()));

  await page.evaluate(() => {
    /** @type {any} */ (navigator).share = undefined;
  });
  await page.click("#title-btn");
  await page.click('[data-cmd="beam"]');
  await page.waitForTimeout(60);
  await ok("without a share sheet, beam shows the text", (await page.inputValue("#beam-text")).includes("- [ ] Buy AAA batteries"));
  await page.click("#beam-close");

  // --- receive beam --------------------------------------------------------
  await page.click("#title-btn");
  await page.click('[data-cmd="receive"]');
  await page.fill("#receive-text", "nonsense");
  await page.click('#receive-form button[type="submit"]');
  await ok("receive rejects text with no to-dos", (await page.locator("#receive-status").innerText()).includes("Nothing to receive"));
  await page.fill("#receive-text", "To Do List: x\n[ ] charge the cradle\n[x] find the cable\n");
  await page.click('#receive-form button[type="submit"]');
  await page.waitForTimeout(60);
  await ok("receive appends items", (await page.locator("forgo-checklist .count").innerText()) === "2 of 8 done");
  await ok("receive dialog closes", !(await page.locator("#receive-dialog").isVisible()));
  for (let i = 0; i < 2; i++) await page.locator('.checklist button[aria-label="Delete"]').last().click();
  await page.waitForTimeout(60);

  // --- theme ---------------------------------------------------------------
  await page.click("#title-btn");
  await page.click('[data-menu="options"]');
  await page.click('[data-cmd="prefs"]');
  await page.click('[data-set-theme="backlight"]');
  await page.waitForTimeout(60);
  await ok("theme applies", (await page.getAttribute("html", "data-theme")) === "backlight");
  await ok("swatch aria-checked syncs", (await page.getAttribute('[data-set-theme="backlight"]', "aria-checked")) === "true");
  await ok("other swatch unchecked", (await page.getAttribute('[data-set-theme="palm"]', "aria-checked")) === "false");
  await ok("about lives in options", await page.locator("#settings-dialog .about").isVisible());
  await page.click("#settings-close");

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

  // --- offline (the whole point) -------------------------------------------
  await ctx.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  const offlineItems = await page.locator(".checklist li").count();
  await ok("works offline after reload", offlineItems === 6, `${offlineItems} items`);
  // query string must not miss the cache
  await page.goto(URL + "?utm_source=subway", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  await ok("offline with query string (ignoreSearch)", (await page.locator(".checklist li").count()) === 6);
  await ctx.setOffline(false);


  // --- the comparison probe ------------------------------------------------
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(100);
  await page.click(".add-row input");
  await page.type(".add-row input", "half-typed");
  const focusBefore = await page.evaluate(() => document.activeElement?.getAttribute("name"));
  await page.locator(".checklist input[type=checkbox]").nth(1).check();
  await page.waitForTimeout(80);
  const focusAfter = await page.evaluate(() => document.activeElement?.tagName);
  const valueAfter = await page.inputValue(".add-row input");
  await ok("typing survives a re-render elsewhere", focusBefore === "text" && focusAfter === "INPUT" && valueAfter === "half-typed",
    `focus ${focusBefore} -> ${focusAfter}, value "${valueAfter}"`);

  await ok("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
});
