import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { chromium, launch, serve, overrides, root } from "./harness.mjs";

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
  await ok("About opens on first run", await page.locator("#about-dialog").isVisible());
  await page.click("#about-close");
  // The seed list is the tutorial, and changes with it; assert only relative to it.
  const seed = await page.locator(".checklist li").count();
  const tally = async () => (await page.locator("forgo-checklist .count").innerText()).match(/^\d+ of \d+ done/)?.[0];
  await ok("checklist seeds on first run", seed > 0, `${seed} items`);
  const total = Number((await tally())?.match(/of (\d+)/)?.[1]);
  await ok("count line renders", (await tally()) === `0 of ${total} done`);

  // --- reactivity: no manual re-render call anywhere ------------------------
  await page.locator(".checklist input[type=checkbox]").first().check();
  await page.waitForTimeout(60);
  const afterToggle = await tally();
  await ok("toggling re-renders via subscriber", afterToggle === `1 of ${total} done`, afterToggle);
  await ok("done style applied", await page.locator(".checklist li").first().evaluate((el) => el.classList.contains("done")));

  // --- add item (delegated submit survives innerHTML rebuild) ---------------
  await page.fill(".add-row input", "buy more batteries");
  await page.click(".add-row button");
  await page.waitForTimeout(60);
  const afterAdd = await page.locator(".checklist li").count();
  await ok("add item works after re-render", afterAdd === seed + 1, `${afterAdd} items`);
  await ok("input clears after add", (await page.inputValue(".add-row input")) === "");
  await ok("tapping New keeps focus in the input, so the keyboard stays up",
    await page.locator(".add-row input").evaluate((el) => document.activeElement === el));
  await ok("count updates on add", (await tally()) === `1 of ${total + 1} done`);

  // --- delete --------------------------------------------------------------
  const delRow = (text) => page.locator(".checklist li", { hasText: text }).locator('button[aria-label="Delete"]').click();
  await delRow("buy more batteries");
  await page.waitForTimeout(60);
  await ok("delete works", (await page.locator(".checklist li").count()) === seed);

  // --- persistence ---------------------------------------------------------
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(120);
  await ok("state persists across reload", (await tally()) === `1 of ${total} done`);
  await ok("About doesn't open again", await page.locator("#about-dialog").isHidden());

  // --- desktop + clock -----------------------------------------------------
  await page.click("#title-btn");
  await ok("title tab opens the desktop", await page.locator("#desktop").isVisible());
  await ok("every command is an icon with its name",
    JSON.stringify(await page.locator("#desktop .desk-icons span").allInnerTexts()) ===
      JSON.stringify(["Send List", "Receive List…", "Edit", "Sweep…", "Look Ahead", "Recycle…", "Forget", "Remember", "Shake Up", "Fast Forward…", "Themes…", "Options…", "Help…", "About…"]) &&
      (await page.locator("#desktop .desk-icons button svg.icon").count()) === 14);
  await ok("desktop groups by category",
    (await page.locator("#desktop h2").allInnerTexts()).join() === "Record,Organize,System");
  const clock = await page.locator("#title-btn").innerText();
  await ok("title tab shows the brand while open (clock is off by default)", clock === "forgotodo", clock);
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
  await ok("send shares the list as plain text", /^- \[x\] \S/m.test(sent ?? "") && /^- \[ \] \S/m.test(sent ?? ""), sent);
  await ok("send heads the text with the list name", (sent ?? "").startsWith("To Do List: Unfiled\n"), sent);
  await ok("send dialog closes after sharing", !(await page.locator("#send-dialog").isVisible()));

  await page.evaluate(() => {
    /** @type {any} */ (navigator).share = undefined;
  });
  await page.click("#title-btn");
  await page.click('[data-cmd="send"]');
  await page.waitForTimeout(60);
  await ok("without a share sheet, send shows the text", (await page.inputValue("#send-text")).includes("- [ ] "));
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
  await ok("receive appends items", (await tally()) === `2 of ${total + 2} done`);
  await ok("receive dialog closes", !(await page.locator("#receive-dialog").isVisible()));
  await delRow("charge the cradle");
  await delRow("find the cable");
  await page.waitForTimeout(60);

  // --- theme ---------------------------------------------------------------
  await page.click("#title-btn");
  await page.click('[data-cmd="themes"]');
  await ok("Themes… opens and closes the desktop",
    (await page.locator("#themes-dialog").isVisible()) && (await page.locator("#desktop").isHidden()));
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
  await page.click("#themes-close");
  await page.click("#title-btn");
  await page.click('[data-cmd="prefs"]');
  await ok("Options… opens preferences", await page.locator("#settings-dialog").isVisible());
  await page.click('[data-toggle="icons"]');
  await page.waitForTimeout(60);
  await ok("icons toggle off", (await page.getAttribute("html", "data-icons")) === "off");
  await page.click("#settings-close");
  await page.click("#title-btn");
  await page.click('[data-cmd="about"]');
  await ok("About… has about and share",
    (await page.locator("#about-dialog .about").isVisible()) && (await page.locator("#about-dialog #share-link").isVisible()));
  await ok("install hint is plain text until installable", (await page.getAttribute("#install-link", "href")) === null);
  await page.evaluate(() => {
    const e = /** @type {any} */ (new Event("beforeinstallprompt", { cancelable: true }));
    e.prompt = async () => { /** @type {any} */ (window).prompted = true; };
    dispatchEvent(e);
  });
  await ok("install hint becomes a link", (await page.getAttribute("#install-link", "href")) === "#");
  await page.click("#install-link");
  await ok("clicking the hint prompts to install, once",
    (await page.evaluate(() => /** @type {any} */ (window).prompted)) === true && (await page.getAttribute("#install-link", "href")) === null);
  await page.click("#about-close");
  await page.click("#title-btn");
  await page.click('[data-cmd="help"]');
  await ok("Help… opens help", await page.locator("#help-dialog").isVisible());
  await page.click("#help-close");
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
  await ok("works offline after reload", offlineItems === seed, `${offlineItems} items`);
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
  await ok("offline with query string (ignoreSearch)", (await page.locator(".checklist li").count()) === seed);
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
