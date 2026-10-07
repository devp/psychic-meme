import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";

// Opt-in: skipped unless playwright is installed (`just dev-init-browser`).
let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {}

// Installed Chrome; else Playwright's own (`node_modules/.bin/playwright install
// chromium`); else a Chromium the environment ships under
// PLAYWRIGHT_BROWSERS_PATH, as some cloud containers do. Call it before
// serve(): if no browser launches, the test fails rather than hanging on a
// server nobody closes.
async function launch() {
  const tries = [() => chromium.launch({ channel: "chrome" }), () => chromium.launch()];
  const shipped = process.env.PLAYWRIGHT_BROWSERS_PATH && join(process.env.PLAYWRIGHT_BROWSERS_PATH, "chromium");
  if (shipped && existsSync(shipped)) tries.push(() => chromium.launch({ executablePath: shipped }));
  let error;
  for (const attempt of tries) {
    try {
      return await attempt();
    } catch (e) {
      error = e;
    }
  }
  throw error;
}

const root = new URL("../..", import.meta.url).pathname;
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
  const browser = await launch();
  const server = await serve();
  const URL = `http://127.0.0.1:${server.address().port}/index.html`;
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
  await ok("tapping New keeps focus in the input, so the keyboard stays up",
    await page.locator(".add-row input").evaluate((el) => document.activeElement === el));
  await ok("count updates on add", (await page.locator("forgo-checklist .count").innerText()) === "1 of 7 done");

  // --- delete --------------------------------------------------------------
  const delRow = (text) => page.locator(".checklist li", { hasText: text }).locator('button[aria-label="Delete"]').click();
  await delRow("buy more batteries");
  await page.waitForTimeout(60);
  await ok("delete works", (await page.locator(".checklist li").count()) === 6);

  // --- persistence ---------------------------------------------------------
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(120);
  await ok("state persists across reload", (await page.locator("forgo-checklist .count").innerText()) === "1 of 6 done");

  // --- desktop + clock -----------------------------------------------------
  await page.click("#title-btn");
  await ok("title tab opens the desktop", await page.locator("#desktop").isVisible());
  await ok("every command is an icon with its name",
    JSON.stringify(await page.locator("#desktop .desk-icons span").allInnerTexts()) ===
      JSON.stringify(["Send List", "Receive List…", "Edit", "Sweep…", "Recycle…", "Forget", "Remember", "Shake Up", "Fast Forward…", "Options…"]) &&
      (await page.locator("#desktop .desk-icons button svg.icon").count()) === 10);
  await ok("desktop groups by category",
    (await page.locator("#desktop h2").allInnerTexts()).join() === "Record,Organize,System");
  const clock = await page.locator("#title-btn").innerText();
  await ok("title tab shows the time while open", /\d:\d\d/.test(clock), clock);
  await page.keyboard.press("Escape");
  await ok("escape closes the desktop", await page.locator("#desktop").isHidden());
  await ok("title comes back", (await page.locator("#title-btn").innerText()) === "To Do List");
  await page.click("#title-btn");
  await page.click("#desktop h2 >> nth=0");
  await ok("tapping bare desktop closes it", await page.locator("#desktop").isHidden());

  // --- send: share sheet stubbed; clipboard fallback -----------------------
  await page.evaluate(() => {
    /** @type {any} */ (navigator).share = async (/** @type {any} */ data) => {
      /** @type {any} */ (window).__sent = data.text;
    };
  });
  await page.click("#title-btn");
  await page.click('[data-cmd="send"]');
  await page.waitForTimeout(60);
  const sent = await page.evaluate(() => /** @type {any} */ (window).__sent);
  await ok("send shares the list as plain text", /^- \[x\] Back up before the trip!!$/m.test(sent ?? "") && /^- \[ \] Buy AAA batteries!$/m.test(sent ?? ""), sent);
  await ok("send heads the text with the list name", (sent ?? "").startsWith("To Do List: Unfiled\n"), sent);
  await ok("send dialog closes after sharing", !(await page.locator("#send-dialog").isVisible()));

  await page.evaluate(() => {
    /** @type {any} */ (navigator).share = undefined;
  });
  await page.click("#title-btn");
  await page.click('[data-cmd="send"]');
  await page.waitForTimeout(60);
  await ok("without a share sheet, send shows the text", (await page.inputValue("#send-text")).includes("- [ ] Buy AAA batteries"));
  await page.click("#send-close");

  // --- receive list --------------------------------------------------------
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
  await delRow("charge the cradle");
  await delRow("find the cable");
  await page.waitForTimeout(60);

  // --- theme ---------------------------------------------------------------
  await page.click("#title-btn");
  await page.click('[data-cmd="prefs"]');
  await ok("Options… opens preferences and closes the desktop",
    (await page.locator("#settings-dialog").isVisible()) && (await page.locator("#desktop").isHidden()));
  await page.click('[data-set-theme="cupertino"]');
  await page.waitForTimeout(60);
  await ok("choosing a theme picks its font", (await page.getAttribute("html", "data-font")) === "casual");
  await page.click('[data-set-theme="akihabara"]');
  await page.waitForTimeout(60);
  await ok("and the next theme picks its own", (await page.getAttribute("html", "data-font")) === "pixel");
  await ok("theme applies", (await page.getAttribute("html", "data-theme")) === "akihabara");
  await ok("swatch aria-checked syncs", (await page.getAttribute('[data-set-theme="akihabara"]', "aria-checked")) === "true");
  await ok("other swatch unchecked", (await page.getAttribute('[data-set-theme="palo-alto"]', "aria-checked")) === "false");
  await page.click('[data-set-mode="dark"]');
  await page.waitForTimeout(60);
  await ok("backlight on means the dark scheme", (await page.getAttribute("html", "data-scheme")) === "dark");
  await ok("browser chrome follows the theme",
    (await page.getAttribute('meta[name="theme-color"]', "content")) === "#0f380f");
  await page.emulateMedia({ colorScheme: "light" });
  await page.click('[data-set-mode="system"]');
  await page.waitForTimeout(60);
  await ok("auto follows the system (light)", (await page.getAttribute("html", "data-scheme")) === "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await page.waitForTimeout(60);
  await ok("auto follows the system (dark)", (await page.getAttribute("html", "data-scheme")) === "dark");
  await page.click('[data-set-font="casual"]');
  await page.waitForTimeout(60);
  await ok("casual font applies", (await page.getAttribute("html", "data-font")) === "casual");
  await page.click('[data-toggle="icons"]');
  await page.waitForTimeout(60);
  await ok("icons toggle off", (await page.getAttribute("html", "data-icons")) === "off");
  await ok("about lives in options", await page.locator("#settings-dialog .about").isVisible());
  await page.click("#settings-close");
  await ok("storage keys use the app-ns meta", (await page.evaluate(() => localStorage.getItem("forgotodo:theme"))) === "akihabara");
  await page.reload({ waitUntil: "networkidle" });
  await ok("options persist across reload",
    (await page.evaluate(() => [...document.documentElement.attributes].map((a) => a.name + "=" + a.value).join(" ")))
      .includes('data-theme=akihabara data-scheme=dark data-font=casual data-icons=off'));
  await ok("casual font is the body font",
    (await page.evaluate(() => getComputedStyle(document.body).fontFamily)).startsWith('"Comic Neue"'));
  await page.click("#title-btn");
  await ok("icons off shows the desktop by name",
    (await page.locator("#desktop svg.icon").first().isHidden()) &&
      (await page.locator('[data-cmd="send"] span').isVisible()));
  await page.keyboard.press("Escape");

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
  await ok("update: no reload while in use", await sameDocument());
  await Promise.all([page.waitForEvent("load"), resume()]);
  await ok("update: reloads on the next resume", !(await sameDocument()));
  const served = await page.evaluate(async () => (await fetch("app.css")).text());
  await ok("update: the reloaded page gets the new file", served.includes(MARK));
  overrides.clear();

  // --- offline (the whole point) -------------------------------------------
  await ctx.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  const offlineItems = await page.locator(".checklist li").count();
  await ok("works offline after reload", offlineItems === 6, `${offlineItems} items`);
  const offlineMissing = await page.evaluate(async () => {
    const urls = ["fonts/DepartureMono-Regular.woff2", "fonts/ComicNeue-Regular.woff2", "fonts/ComicNeue-Bold.woff2", "icons/forgotodo.svg", "manifest.webmanifest"];
    const missing = [];
    for (const u of urls) {
      const res = await fetch(u).catch(() => null);
      if (!res?.ok) missing.push(u);
    }
    return missing;
  });
  await ok("fonts and icon are cached for offline", offlineMissing.length === 0, offlineMissing.join(", "));
  await ok("styles apply offline",
    (await page.evaluate(() => getComputedStyle(document.body).fontFamily)).startsWith('"Comic Neue"'));
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

test("forgetting, in a real browser", { skip: !chromium && "playwright not installed" }, async (t) => {
  const browser = await launch();
  const server = await serve();
  const URL = `http://127.0.0.1:${server.address().port}/index.html`;
  t.after(async () => {
    await browser.close();
    server.closeAllConnections();
    server.close();
  });
  const ok = (name, cond, extra = "") => t.test(name, () => assert.ok(cond, extra || name));

  const page = await (await browser.newContext({ serviceWorkers: "block" })).newPage();
  await page.addInitScript(() => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    const key = (/** @type {number} */ daysAgo) => {
      const d = new Date();
      d.setDate(d.getDate() - daysAgo);
      const pad = (/** @type {number} */ n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    };
    const items = [
      { id: "a", text: "plain", done: false, seenDay: key(1) },
      { id: "b", text: "urgent!!!", done: false, seenDay: key(1) },
      { id: "c", text: "old news", done: true, doneDay: key(1) },
      { id: "d", text: "fresh done", done: true, doneDay: key(0) },
      { id: "e", text: "long gone!", done: false, seenDay: key(9) },
    ];
    localStorage.setItem("forgotodo:lists:records", JSON.stringify([
      { id: "L", name: "Unfiled", createdAt: 0, updatedAt: 0, items },
    ]));
    localStorage.setItem("forgotodo:lists:activeId", "L");
  });
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(100);

  const rows = await page.locator(".checklist li span").allInnerTexts();
  await ok("decays, purges, and sorts most to least urgent",
    JSON.stringify(rows) === JSON.stringify(["urgent!!", "fresh done", "plain?"]), JSON.stringify(rows));
  await ok("items with ! are marked urgent",
    (await page.locator(".checklist li.urgent span").allInnerTexts()).join() === "urgent!!");
  await ok("one day in, ? is faded", (await page.locator(".checklist li.faded").count()) === 1);
  await ok("nine days in, it's forgotten: hidden, but counted",
    (await page.locator("forgo-checklist .count").innerText()) === "1 of 4 done · 1 forgotten");

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(100);
  const again = await page.locator(".checklist li span").allInnerTexts();
  await ok("same day, no further decay", JSON.stringify(again) === JSON.stringify(rows), JSON.stringify(again));
});

test("organize and shrink to fit, in a real browser", { skip: !chromium && "playwright not installed" }, async (t) => {
  const browser = await launch();
  const server = await serve();
  const URL = `http://127.0.0.1:${server.address().port}/index.html`;
  t.after(async () => {
    await browser.close();
    server.closeAllConnections();
    server.close();
  });
  const ok = (name, cond, extra = "") => t.test(name, () => assert.ok(cond, extra || name));

  const page = await (await browser.newContext({ serviceWorkers: "block", viewport: { width: 390, height: 844 } })).newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.addInitScript(() => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    const d = new Date();
    const pad = (/** @type {number} */ n) => String(n).padStart(2, "0");
    const today = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const items = [
      { id: "a", text: "keep!", done: false, seenDay: today },
      { id: "b", text: "meh??", done: false, seenDay: today },
      { id: "c", text: "whatever??", done: false, seenDay: today },
      { id: "e", text: "maybe?", done: false, seenDay: today },
      { id: "d", text: "did it", done: true, doneDay: today },
    ];
    localStorage.setItem("forgotodo:lists:records", JSON.stringify([
      { id: "L", name: "Unfiled", createdAt: 0, updatedAt: 0, items },
    ]));
    localStorage.setItem("forgotodo:lists:activeId", "L");
  });
  await page.goto(URL, { waitUntil: "networkidle" });
  const texts = () => page.locator(".checklist li span").allInnerTexts();
  const run = async (/** @type {string} */ cmd) => {
    await page.click("#title-btn");
    await page.click(`[data-cmd="${cmd}"]`);
    await page.waitForTimeout(60);
  };

  const count = () => page.locator("forgo-checklist .count").innerText();
  const okBtn = () => page.click('#alert-dialog button[value="ok"]');
  const same = (/** @type {string[]} */ a, /** @type {string[]} */ b) => JSON.stringify(a) === JSON.stringify(b);

  await ok("forgotten to-dos are hidden but counted",
    same(await texts(), ["keep!", "did it", "maybe?"]) && (await count()) === "1 of 5 done · 2 forgotten");

  // --- sweep: the forgotten ------------------------------------------------
  await run("sweep");
  await ok("sweep shows the forgotten first",
    (await page.locator("#alert-list li").allInnerTexts()).join() === "meh??,whatever??");
  await page.click('#alert-dialog button[value="cancel"]');
  await page.waitForTimeout(60);
  await ok("cancel keeps them", (await count()) === "1 of 5 done · 2 forgotten");
  await run("sweep");
  await okBtn();
  await page.waitForTimeout(60);
  await ok("sweep deletes only the forgotten", same(await texts(), ["keep!", "did it", "maybe?"]) && (await count()) === "1 of 3 done");
  await run("sweep");
  await ok("nothing forgotten says so", (await page.locator("#alert-msg").innerText()) === "Nothing forgotten.");
  await ok("a notice has no cancel", await page.locator("#alert-cancel").isHidden());
  await okBtn();

  await run("recycle");
  await okBtn();
  await page.waitForTimeout(60);
  await ok("recycle deletes done items", same(await texts(), ["keep!", "maybe?"]));

  // --- forget / remember ---------------------------------------------------
  await run("forget");
  await page.waitForTimeout(700);
  await ok("forget poofs the lowest tier away", same(await texts(), ["keep!"]) && (await count()) === "0 of 2 done · 1 forgotten");
  await run("remember");
  await ok("remember brings it back at neutral", same(await texts(), ["keep!", "maybe"]));
  await ok("and it blinks", (await page.locator('li[data-anim="blink"]').count()) === 1);
  await run("remember");
  await ok("nothing forgotten to remember says so", (await page.locator("#alert-msg").innerText()) === "Nothing's forgotten.");
  await okBtn();
  await run("forget");
  await page.waitForTimeout(700);
  await run("forget");
  await page.waitForTimeout(700);
  await ok("forget works up the tiers", same(await texts(), []) && (await count()) === "0 of 2 done · 2 forgotten");
  await run("forget");
  await ok("nothing left to forget says so", (await page.locator("#alert-msg").innerText()) === "Nothing left to forget.");
  await okBtn();
  await run("remember");
  await run("remember");
  await ok("remember twice, both back", same((await texts()).sort(), ["keep", "maybe"]));

  // --- shake up: rig the dice ----------------------------------------------
  await page.evaluate(() => (Math.random = () => 0.1));
  await run("shake");
  await ok("shake up moves each to-do (all up, on these dice)", same((await texts()).sort(), ["keep!", "maybe!"]));
  await ok("and sums it up", (await count()) === "2 up · 0 down");

  // --- fast forward --------------------------------------------------------
  await page.locator(".checklist li", { hasText: "maybe!" }).locator("input[type=checkbox]").check();
  await page.waitForTimeout(60);
  await run("fastforward");
  await ok("fast forward says what tomorrow brings",
    (await page.locator("#alert-msg").innerText()) === "Tomorrow's list, today: 1 to-do drop a tier, 1 done cleared. Go ahead?");
  await okBtn();
  await page.waitForTimeout(60);
  await ok("and then it's tomorrow", same(await texts(), ["keep"]));

  // --- edit ----------------------------------------------------------------
  await run("edit");
  await ok("edit arms: the tab says what's next", (await page.locator("#title-btn").innerText()) === "Edit: tap a to-do");
  await page.click(".checklist li span");
  await ok("tapping a row opens it, without ticking it",
    (await page.locator(".edit-field").isVisible()) && !(await page.locator(".checklist li input[type=checkbox]").count()));
  await page.fill(".edit-field", "keep going!");
  await page.press(".edit-field", "Enter");
  await page.waitForTimeout(60);
  await ok("enter saves the edit", same(await texts(), ["keep going!"]) && (await page.locator("#title-btn").innerText()) === "To Do List");
  await run("edit");
  await page.click("#title-btn");
  await ok("tapping the tab cancels edit mode",
    (await page.locator("#title-btn").innerText()) === "To Do List" && (await page.locator("#desktop").isHidden()));
  await page.click(".checklist li span");
  await page.waitForTimeout(60);
  await ok("and taps tick again", (await page.locator(".checklist li.done").count()) === 1);
  await page.click(".checklist li span");

  // --- typing ?? files it straight away ------------------------------------
  await page.fill(".add-row input", "someday maybe??");
  await page.press(".add-row input", "Enter");
  await page.waitForTimeout(60);
  await ok("?? files it away, with a word", same(await texts(), ["keep going!"]) && (await count()) === "Filed away, forgotten.");

  // --- shrink to fit -----------------------------------------------------
  const size = () => page.locator(".checklist").evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  await ok("normal size with fit off", (await size()) === 15);
  await page.evaluate(() => localStorage.setItem("forgotodo:fit", "on"));
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(100);
  const one = await size();
  await ok("big with a short list", one === 28, String(one));
  for (let i = 0; i < 8; i++) {
    await page.fill(".add-row input", "task number " + i);
    await page.press(".add-row input", "Enter");
  }
  await page.locator(".add-row input").blur();
  await page.waitForTimeout(100);
  const nine = await size();
  await ok("smaller as it grows", nine < one && nine >= 15, String(nine));
  for (let i = 8; i < 40; i++) {
    await page.fill(".add-row input", "task number " + i);
    await page.press(".add-row input", "Enter");
  }
  await page.locator(".add-row input").blur();
  await page.waitForTimeout(100);
  const many = await size();
  const fits = await page.locator('[data-panel="list"]').evaluate((el) => el.scrollHeight <= el.clientHeight);
  await ok("shrinks further to fit", many < 15 && (fits || many === 10), `${many}px, fits: ${fits}`);

  await ok("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
});

test("catch-up and legacy options, in a real browser", { skip: !chromium && "playwright not installed" }, async (t) => {
  const browser = await launch();
  const server = await serve();
  const URL = `http://127.0.0.1:${server.address().port}/index.html`;
  t.after(async () => {
    await browser.close();
    server.closeAllConnections();
    server.close();
  });
  const ok = (name, cond, extra = "") => t.test(name, () => assert.ok(cond, extra || name));

  const page = await (await browser.newContext({ serviceWorkers: "block" })).newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.clock.install({ time: new Date(2026, 8, 27, 12, 0) });
  await page.addInitScript(() => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("forgotodo:theme", "backlight");
    localStorage.setItem("forgotodo:lists:records", JSON.stringify([
      { id: "L", name: "Unfiled", createdAt: 0, updatedAt: 0, items: [
        { id: "a", text: "call mom!", done: false, seenDay: "2026-09-27" },
        { id: "b", text: "done today", done: true, doneDay: "2026-09-27" },
      ] },
    ]));
    localStorage.setItem("forgotodo:lists:activeId", "L");
  });
  await page.goto(URL, { waitUntil: "networkidle" });
  const texts = () => page.locator(".checklist li span").allInnerTexts();

  await ok("old backlight theme becomes palo alto with the backlight on",
    (await page.getAttribute("html", "data-theme")) === "palo-alto" && (await page.getAttribute("html", "data-scheme")) === "dark");
  await ok("and the migration is saved",
    (await page.evaluate(() => [localStorage.getItem("forgotodo:theme"), localStorage.getItem("forgotodo:mode")].join())) === "palo-alto,dark");
  await ok("nothing decays the same day", JSON.stringify(await texts()) === JSON.stringify(["call mom!", "done today"]));

  await page.clock.setSystemTime(new Date(2026, 8, 28, 9, 0));
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await page.waitForTimeout(60);
  await ok("coming back the next day catches up", JSON.stringify(await texts()) === JSON.stringify(["call mom"]), JSON.stringify(await texts()));

  await ok("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
});

test("an update reload on resume, with a day's catch-up, in a real browser", { skip: !chromium && "playwright not installed" }, async (t) => {
  const browser = await launch();
  const server = await serve();
  const URL = `http://127.0.0.1:${server.address().port}/index.html`;
  t.after(async () => {
    overrides.clear();
    await browser.close();
    server.closeAllConnections();
    server.close();
  });
  const ok = (name, cond, extra = "") => t.test(name, () => assert.ok(cond, extra || name));

  const page = await (await browser.newContext()).newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.addInitScript(() => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    const d = new Date();
    const pad = (/** @type {number} */ n) => String(n).padStart(2, "0");
    const today = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    localStorage.setItem("forgotodo:lists:records", JSON.stringify([
      { id: "L", name: "Unfiled", createdAt: 0, updatedAt: 0, items: [
        { id: "a", text: "call mom!!", done: false, seenDay: today },
        { id: "b", text: "done today", done: true, doneDay: today },
      ] },
    ]));
    localStorage.setItem("forgotodo:lists:activeId", "L");
  });
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.evaluate(() => navigator.serviceWorker.ready);
  const texts = () => page.locator(".checklist li span").allInnerTexts();
  const resume = () =>
    page.evaluate(() => {
      for (const state of ["hidden", "visible"]) {
        Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
        document.dispatchEvent(new Event("visibilitychange"));
      }
    });
  const nextUpdate = (/** @type {number} */ ms) =>
    page.evaluate(
      (ms) =>
        new Promise((resolve) => {
          navigator.serviceWorker.addEventListener("message", (e) => resolve(e.data), { once: true });
          setTimeout(() => resolve("none"), ms);
        }),
      ms
    );

  // Let the launch check settle, then deploy.
  let heard = nextUpdate(1500);
  await resume();
  await heard;
  overrides.set("/app.css", (await readFile(join(root, "app.css"), "utf8")) + "\n/* deployed */\n");
  heard = nextUpdate(5000);
  await resume();
  await ok("an update is pending", (await heard) === "updated");

  // The next resume is also the next day: catch-up and the reload both run.
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  await page.clock.setFixedTime(tomorrow);
  await Promise.all([page.waitForEvent("load"), resume()]);
  await page.waitForTimeout(100);
  await ok("one day of catch-up, applied once across the reload",
    JSON.stringify(await texts()) === JSON.stringify(["call mom!"]), JSON.stringify(await texts()));
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(100);
  await ok("and stable after another launch the same day",
    JSON.stringify(await texts()) === JSON.stringify(["call mom!"]), JSON.stringify(await texts()));
  await ok("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
});
