// Browser verification: the offline behaviour of a service worker cannot be
// checked any other way. Not part of `just check` -- playwright is a heavy
// dependency and this starter should install fast.
//
//   npm i -D playwright && just serve   # in another shell
//   just verify
import { chromium } from "playwright";

const URL = "http://localhost:8000/variants/vanilla/index.html";
/** @type {string[]} */
const out = [];
/** @param {string} n @param {boolean} c @param {string} [extra] */
const ok = (n, c, extra = "") => out.push(`${c ? "PASS" : "FAIL"}  ${n}${extra ? " — " + extra : ""}`);

const browser = await chromium.launch(
  process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}
);
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
/** @type {string[]} */
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

await page.goto(URL, { waitUntil: "networkidle" });

// --- seeding -------------------------------------------------------------
const items = await page.locator(".checklist li").count();
ok("checklist seeds on first run", items === 6, `${items} items`);
ok("count line renders", (await page.locator("pizza-checklist .count").innerText()) === "0 of 6 done");

// --- reactivity: no manual re-render call anywhere ------------------------
await page.locator(".checklist input[type=checkbox]").first().check();
await page.waitForTimeout(60);
const afterToggle = await page.locator("pizza-checklist .count").innerText();
ok("toggling re-renders via subscriber", afterToggle === "1 of 6 done", afterToggle);
ok("done style applied", await page.locator(".checklist li").first().evaluate((el) => el.classList.contains("done")));

// --- add item (delegated submit survives innerHTML rebuild) ---------------
await page.fill(".add-row input", "buy more pizza");
await page.click(".add-row button");
await page.waitForTimeout(60);
const afterAdd = await page.locator(".checklist li").count();
ok("add item works after re-render", afterAdd === 7, `${afterAdd} items`);
ok("count updates on add", (await page.locator("pizza-checklist .count").innerText()) === "1 of 7 done");

// --- delete --------------------------------------------------------------
await page.locator("button[data-remove]").last().click();
await page.waitForTimeout(60);
ok("delete works", (await page.locator(".checklist li").count()) === 6);

// --- persistence ---------------------------------------------------------
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(120);
ok("state persists across reload", (await page.locator("pizza-checklist .count").innerText()) === "1 of 6 done");

// --- tabs ----------------------------------------------------------------
await page.click('[data-tab="about"]');
await page.waitForTimeout(60);
ok("tab switches panel", await page.locator('.panel[data-panel="about"]').isVisible());
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(120);
ok("active tab persists", await page.locator('.panel[data-panel="about"]').isVisible());
await page.click('[data-tab="list"]');

// --- theme ---------------------------------------------------------------
await page.click("#settings-btn");
await page.click('[data-set-theme="phosphor"]');
await page.waitForTimeout(60);
ok("theme applies", (await page.getAttribute("html", "data-theme")) === "phosphor");
ok("swatch aria-checked syncs", (await page.getAttribute('[data-set-theme="phosphor"]', "aria-checked")) === "true");
ok("other swatch unchecked", (await page.getAttribute('[data-set-theme="dusk"]', "aria-checked")) === "false");
await page.click("#settings-close");

// --- service worker ------------------------------------------------------
const swState = await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return "none";
  await navigator.serviceWorker.ready;
  return reg.active ? "active" : "registered";
});
ok("service worker activates", swState === "active", swState);

const cached = await page.evaluate(async () => {
  const names = await caches.keys();
  const c = await caches.open(names[0]);
  return (await c.keys()).length;
});
ok("assets precached", cached >= 11, `${cached} entries in cache`);

// --- offline (the whole point) -------------------------------------------
await ctx.setOffline(true);
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(400);
const offlineItems = await page.locator(".checklist li").count();
ok("works offline after reload", offlineItems === 6, `${offlineItems} items`);
// query string must not miss the cache
await page.goto(URL + "?utm_source=subway", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(400);
ok("offline with query string (ignoreSearch)", (await page.locator(".checklist li").count()) === 6);
await ctx.setOffline(false);


// --- append-log: the travelling component ---------------------------------
// Driven through its property interface, which is the whole point of it.
await page.click('[data-tab="log"]');
await page.waitForTimeout(60);

/** @param {{id: string, text: string}[]} items */
const setItems = (items) =>
  page.evaluate((list) => {
    const el = /** @type {any} */ (document.getElementById("activity-log"));
    el.items = list.map((i) => ({ ...i, at: 1700000000000 }));
  }, items);

await setItems([{ id: "a", text: "alpha" }, { id: "b", text: "bravo" }]);
await page.waitForTimeout(60);
ok("log renders items", (await page.locator("#activity-log .log-entry").count()) === 2);

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
ok("append preserves existing nodes", survived === "survivor");
ok("append adds only the tail", (await page.locator("#activity-log .log-entry").count()) === 3);

// A non-prefix change must rebuild.
await setItems([{ id: "z", text: "zulu" }]);
await page.waitForTimeout(60);
const afterReset = await page.evaluate(
  () => /** @type {any} */ (document.querySelector("#activity-log .log-entry"))?.__marker
);
ok("non-prefix change rebuilds", afterReset === undefined);
ok("rebuild renders the new list", (await page.locator("#activity-log .log-entry").count()) === 1);
ok("aria-busy cleared after rebuild", (await page.getAttribute("#activity-log", "aria-busy")) === null);
ok("log carries role and live region", (await page.getAttribute("#activity-log", "role")) === "log");

// Scroll: follow when pinned to the bottom, stay put when reading back.
const many = Array.from({ length: 60 }, (_, i) => ({ id: "n" + i, text: "line " + i }));
await setItems(many);
await page.waitForTimeout(80);
const pinned = await page.evaluate(() => {
  const el = /** @type {HTMLElement} */ (document.getElementById("activity-log"));
  return el.scrollHeight - el.scrollTop - el.clientHeight < 8;
});
ok("stays pinned to the bottom while following", pinned);

await page.evaluate(() => {
  /** @type {HTMLElement} */ (document.getElementById("activity-log")).scrollTop = 0;
});
await setItems([...many, { id: "extra", text: "arrived while reading" }]);
await page.waitForTimeout(80);
const stayedPut = await page.evaluate(
  () => /** @type {HTMLElement} */ (document.getElementById("activity-log")).scrollTop
);
ok("does not yank you down when scrolled up", stayedPut < 8, `scrollTop=${stayedPut}`);

await page.click('[data-tab="list"]');
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
out.push(`PROBE focus before=${focusBefore} after=${focusAfter} value-after="${valueAfter}"`);

ok("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));

console.log(out.join("\n"));
await browser.close();
process.exit(out.some((l) => l.startsWith("FAIL")) ? 1 : 0);
