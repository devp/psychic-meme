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

  const clickTab = (name) => page.getByRole("tab", { name, exact: true }).click();

  await page.goto(URL, { waitUntil: "networkidle" });

  // --- seeding -------------------------------------------------------------
  const items = await page.locator(".checklist li").count();
  await ok("checklist seeds on first run", items === 6, `${items} items`);
  await ok("count line renders", (await page.locator("pizza-checklist .count").innerText()) === "0 of 6 done");

  // --- reactivity: no manual re-render call anywhere ------------------------
  await page.locator(".checklist input[type=checkbox]").first().check();
  await page.waitForTimeout(60);
  const afterToggle = await page.locator("pizza-checklist .count").innerText();
  await ok("toggling re-renders via subscriber", afterToggle === "1 of 6 done", afterToggle);
  await ok("done style applied", await page.locator(".checklist li").first().evaluate((el) => el.classList.contains("done")));

  // --- add item (delegated submit survives innerHTML rebuild) ---------------
  await page.fill(".add-row input", "buy more pizza");
  await page.click(".add-row button");
  await page.waitForTimeout(60);
  const afterAdd = await page.locator(".checklist li").count();
  await ok("add item works after re-render", afterAdd === 7, `${afterAdd} items`);
  await ok("input clears after add", (await page.inputValue(".add-row input")) === "");
  await ok("tapping Add keeps focus in the input, so the keyboard stays up",
    await page.locator(".add-row input").evaluate((el) => document.activeElement === el));
  await ok("count updates on add", (await page.locator("pizza-checklist .count").innerText()) === "1 of 7 done");

  // --- delete --------------------------------------------------------------
  await page.locator('.checklist button[aria-label="Delete"]').last().click();
  await page.waitForTimeout(60);
  await ok("delete works", (await page.locator(".checklist li").count()) === 6);

  // --- persistence ---------------------------------------------------------
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(120);
  await ok("state persists across reload", (await page.locator("pizza-checklist .count").innerText()) === "1 of 6 done");

  // --- tabs ----------------------------------------------------------------
  const tabCount = await page.getByRole("tab").count();
  await ok("one tab per panel", tabCount === (await page.locator(".panel[data-panel]").count()), `${tabCount} tabs`);
  await clickTab("about");
  await page.waitForTimeout(60);
  await ok("tab switches panel", await page.locator('.panel[data-panel="about"]').isVisible());
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(120);
  await ok("active tab persists", await page.locator('.panel[data-panel="about"]').isVisible());
  await clickTab("list");

  // --- list-summary: the same store, without Lit -----------------------------
  await clickTab("summary");
  await page.waitForTimeout(60);
  const summaryText = () => page.locator("pizza-list-summary .count").innerText();
  await ok("summary renders from the store", (await summaryText()) === "Setup: 1 of 6 done", await summaryText());
  await ok("summary shows `limit` items", (await page.locator(".summary li").count()) === 3);
  await page.locator(".summary li").last().click();
  await page.waitForTimeout(60);
  await ok("tapping an item ticks it", (await summaryText()) === "Setup: 2 of 6 done", await summaryText());
  await clickTab("list");
  await page.waitForTimeout(60);
  await ok("checklist sees the same change", (await page.locator("pizza-checklist .count").innerText()) === "2 of 6 done");

  // --- theme ---------------------------------------------------------------
  await page.click("#settings-btn");
  await page.click('[data-set-theme="phosphor"]');
  await page.waitForTimeout(60);
  await ok("theme applies", (await page.getAttribute("html", "data-theme")) === "phosphor");
  await ok("swatch aria-checked syncs", (await page.getAttribute('[data-set-theme="phosphor"]', "aria-checked")) === "true");
  await ok("other swatch unchecked", (await page.getAttribute('[data-set-theme="dusk"]', "aria-checked")) === "false");
  await page.click("#settings-close");
  await ok("storage keys use the app-ns meta", (await page.evaluate(() => localStorage.getItem("pizza-starter:theme"))) === "phosphor");

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
  const offlineItems = await page.locator(".checklist li").count();
  await ok("works offline after reload", offlineItems === 6, `${offlineItems} items`);
  // query string must not miss the cache
  await page.goto(URL + "?utm_source=subway", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  await ok("offline with query string (ignoreSearch)", (await page.locator(".checklist li").count()) === 6);
  await ctx.setOffline(false);


  // --- append-log: the travelling component ---------------------------------
  // Driven through its property interface, which is the whole point of it.
  await clickTab("log");
  await page.waitForTimeout(60);

  /** @param {{id: string, text: string}[]} items */
  const setItems = (items) =>
    page.evaluate((list) => {
      const el = /** @type {any} */ (document.getElementById("activity-log"));
      el.items = list.map((i) => ({ ...i, at: 1700000000000 }));
    }, items);

  await setItems([{ id: "a", text: "alpha" }, { id: "b", text: "bravo" }]);
  await page.waitForTimeout(60);
  await ok("log renders items", (await page.locator("#activity-log .log-entry").count()) === 2);

  // Mark the first node, then extend the array. If it's a real append, the
  // marked node survives untouched.
  await page.evaluate(() => {
    const first = document.querySelector("#activity-log .log-entry");
    /** @type {any} */ (first).__marker = "survivor";
  });
  await setItems([
    { id: "a", text: "alpha" },
    { id: "b", text: "bravo" },
    { id: "c", text: "charlie" },
  ]);
  await page.waitForTimeout(60);
  const survived = await page.evaluate(
    () => /** @type {any} */ (document.querySelector("#activity-log .log-entry")).__marker
  );
  await ok("append preserves existing nodes", survived === "survivor");
  await ok("append adds only the tail", (await page.locator("#activity-log .log-entry").count()) === 3);

  // A non-prefix change must rebuild.
  await setItems([{ id: "z", text: "zulu" }]);
  await page.waitForTimeout(60);
  const afterReset = await page.evaluate(
    () => /** @type {any} */ (document.querySelector("#activity-log .log-entry"))?.__marker
  );
  await ok("non-prefix change rebuilds", afterReset === undefined);
  await ok("rebuild renders the new list", (await page.locator("#activity-log .log-entry").count()) === 1);
  await ok("aria-busy cleared after rebuild", (await page.getAttribute("#activity-log", "aria-busy")) === null);
  await ok("log carries role and live region", (await page.getAttribute("#activity-log", "role")) === "log");

  // Scroll: follow when pinned to the bottom, stay put when reading back.
  const many = Array.from({ length: 60 }, (_, i) => ({ id: "n" + i, text: "line " + i }));
  await setItems(many);
  await page.waitForTimeout(80);
  const pinned = await page.evaluate(() => {
    const el = /** @type {HTMLElement} */ (document.getElementById("activity-log"));
    return el.scrollHeight - el.scrollTop - el.clientHeight < 8;
  });
  await ok("stays pinned to the bottom while following", pinned);

  await page.evaluate(() => {
    /** @type {HTMLElement} */ (document.getElementById("activity-log")).scrollTop = 0;
  });
  await setItems([...many, { id: "extra", text: "arrived while reading" }]);
  await page.waitForTimeout(80);
  const stayedPut = await page.evaluate(
    () => /** @type {HTMLElement} */ (document.getElementById("activity-log")).scrollTop
  );
  await ok("does not yank you down when scrolled up", stayedPut < 8, `scrollTop=${stayedPut}`);

  await clickTab("list");
  await page.waitForTimeout(60);

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

  // --- lib/reactive-element.js ---------------------------------------------
  const re = await page.evaluate(async () => {
    const { ReactiveElement } = await import("./lib/reactive-element.js");
    const tick = () => Promise.resolve();
    let updates = 0;
    class Probe extends ReactiveElement {
      static properties = ["count", "label"];
      constructor() {
        super();
        this.count = 0;
      }
      update() {
        updates++;
        this.textContent = `${this.label}:${this.count}`;
      }
    }
    class SubProbe extends Probe {
      static properties = ["extra"];
      update() {
        super.update();
        this.textContent += `:${this.extra}`;
      }
    }
    const early = /** @type {any} */ (document.createElement("re-probe"));
    early.label = "early"; // assigned before the class exists
    customElements.define("re-probe", Probe);
    customElements.define("re-sub-probe", SubProbe);
    const el = /** @type {any} */ (document.createElement("re-probe"));
    el.label = "off-page";
    await tick();
    const r = { offPage: updates };
    document.body.append(early, el);
    await tick();
    early.label = "later"; // would be ignored if the early value still hid the setter
    await tick();
    Object.assign(r, { early: early.textContent });
    updates = 0;
    el.count = 1;
    el.count = 2;
    el.label = "x";
    await tick();
    Object.assign(r, { batch: updates, text: el.textContent });
    updates = 0;
    el.count = 2; // unchanged
    await tick();
    Object.assign(r, { noop: updates });
    const sub = /** @type {any} */ (document.createElement("re-sub-probe"));
    document.body.append(sub);
    sub.label = "s";
    sub.extra = "e";
    await tick();
    Object.assign(r, { sub: sub.textContent });
    early.remove();
    el.remove();
    sub.remove();
    return r;
  });
  await ok("re: no render while off-page", re.offPage === 0);
  await ok("re: property set before define keeps its setter", re.early === "later:0", re.early);
  await ok("re: assignments batch into one update", re.batch === 1 && re.text === "x:2", `${re.batch} ${re.text}`);
  await ok("re: unchanged value skips the update", re.noop === 0);
  await ok("re: subclass adds to parent's properties", re.sub === "s:0:e", re.sub);

  await ok("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
});
