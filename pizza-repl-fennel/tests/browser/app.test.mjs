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
  ".md": "text/markdown",
  ".webmanifest": "application/manifest+json",
  ".wasm": "application/wasm",
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

// The language-specific half of this test is ./lang-case.mjs. Everything here
// is the same in every pizza-repl-<lang>.
import { LANG } from "./lang-case.mjs";

test("app in a real browser", { skip: !chromium && "playwright not installed" }, async (t) => {
  const server = await serve();
  const URL = `http://127.0.0.1:${server.address().port}/index.html`;
  // $CHROMIUM if set (a path to a chromium binary), else installed Chrome, else
  // `node_modules/.bin/playwright install chromium`.
  const browser = process.env.CHROMIUM
    ? await chromium.launch({ executablePath: process.env.CHROMIUM })
    : await chromium.launch({ channel: "chrome" }).catch(() => chromium.launch());
  t.after(async () => {
    await browser.close();
    server.closeAllConnections();
    server.close();
  });

  const ok = (name, cond, extra = "") => t.test(name, () => assert.ok(cond, extra || name));

  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  // Headless has no usable clipboard; record what the app copies instead.
  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async (/** @type {string} */ text) => void (/** @type {any} */ (window).__copied = text) },
    });
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("dialog", (d) => d.accept());

  const clickTab = (name) => page.getByRole("tab", { name, exact: true }).click();
  const run = async (source) => {
    await page.fill("#input", source);
    await page.press("#input", "Enter");
    await page.waitForTimeout(60);
  };
  const results = () => page.locator("#output .result").allInnerTexts();
  const copied = () => page.evaluate(() => /** @type {any} */ (window).__copied);

  await page.goto(URL, { waitUntil: "networkidle" });

  // --- repl ----------------------------------------------------------------
  await ok("greeting shows while empty", (await page.getAttribute("#output", "data-empty"))?.startsWith(LANG.greeting));
  await ok("placeholder comes from lang.js", (await page.getAttribute("#input", "placeholder")) === LANG.value[0]);

  await run(LANG.value[0]);
  await run(LANG.error);
  await run(LANG.printed[0]);
  let r = await results();
  await ok("evaluates a value", r[0] === LANG.value[1], JSON.stringify(r));
  await ok("an error renders as an error", (await page.locator("#output .result").nth(1).getAttribute("class"))?.includes("error"));
  await ok("printed output precedes the value", r[2] === LANG.printed[1], JSON.stringify(r[2]));
  await ok("input clears after run", (await page.inputValue("#input")) === "");

  await page.fill("#input", LANG.another[0]);
  await page.click("#run-btn");
  await page.waitForTimeout(60);
  await ok("Run button runs", (await results()).at(-1) === LANG.another[1]);
  await ok("tapping Run keeps focus in the input, so the keyboard stays up",
    await page.locator("#input").evaluate((el) => document.activeElement === el));

  await page.press("#input", "Shift+Enter");
  await ok("Shift-Enter doesn't run", (await results()).length === 4);
  await page.fill("#input", "");

  // --- engines: lib/engine.js over http -----------------------------------
  const engine = await page.evaluate(async () => {
    const { loadWasm, fetchBytes } = await import("./lib/engine.js");
    const url = new URL("tests/fixtures/add.wasm", location.href);
    const streamed = /** @type {any} */ ((await loadWasm(url)).instance.exports).add(2, 3);
    return { streamed, bytes: (await fetchBytes(url)).length };
  });
  await ok("a wasm engine loads, streamed", engine.streamed === 5, JSON.stringify(engine));
  await ok("fetchBytes reads an engine file", engine.bytes > 8);

  // --- copy caret ----------------------------------------------------------
  await page.locator("#output .copy-caret").first().click();
  await ok("caret copies its input", (await copied()) === LANG.value[0]);
  await ok("caret refills an empty input", (await page.inputValue("#input")) === LANG.value[0]);
  await page.fill("#input", "half-typed");
  await page.locator("#output .copy-caret").nth(3).click();
  await ok("caret never clobbers a half-typed input", (await page.inputValue("#input")) === "half-typed");
  await page.fill("#input", "");

  // caret option: copy only / fill only (both is the default, tested above)
  const setCaret = async (/** @type {string} */ mode) => {
    await page.click("#settings-btn");
    await page.click(`[data-set-caret="${mode}"]`);
    await page.click('#settings-dialog [data-close]');
  };
  await page.evaluate(() => void ((/** @type {any} */ (window)).__copied = null));
  await setCaret("copy");
  await page.locator("#output .copy-caret").first().click();
  await ok("copy-only: copies", (await copied()) === LANG.value[0]);
  await ok("copy-only: leaves the input alone", (await page.inputValue("#input")) === "");
  await setCaret("fill");
  await page.evaluate(() => void ((/** @type {any} */ (window)).__copied = null));
  await page.locator("#output .copy-caret").first().click();
  await ok("fill-only: refills the input", (await page.inputValue("#input")) === LANG.value[0]);
  await ok("fill-only: doesn't copy", (await copied()) === null);
  await page.fill("#input", "");
  await setCaret("both");

  // --- key row -------------------------------------------------------------
  const keys = await page.locator("#key-row [data-ins]").evaluateAll((bs) => bs.map((b) => /** @type {HTMLElement} */ (b).dataset.ins));
  await ok("the key row has lang.keys, split around ⋯", keys.length > 0 &&
    (await page.locator("#key-row > *").nth(Math.ceil(keys.length / 2)).getAttribute("id")) === "commands-btn");
  await page.locator("#key-row [data-ins]").first().click();
  await page.locator("#key-row [data-ins]").last().click();
  await ok("keys insert at the caret", (await page.inputValue("#input")) === keys[0] + keys.at(-1));
  await page.fill("#input", "");
  await page.click("#commands-btn");
  const commandItems = () => page.locator("#commands-list .command-item").allTextContents();
  const defaults = await commandItems();
  await ok("⋯ lists the language's commands", defaults.length > 0 && defaults.every((c) => c !== ""));
  await page.locator("#commands-list .command-item").first().click();
  await ok("picking a command pastes it and closes the popup",
    (await page.inputValue("#input")) === defaults[0] && !(await page.locator("#commands-dialog").evaluate((d) => /** @type {HTMLDialogElement} */ (d).open)));
  await page.fill("#input", "");
  await page.click("#settings-btn");
  await page.fill("#commands-field", "alpha, beta ,, gamma");
  await page.click('#settings-dialog [data-close]');
  await ok("custom shortcuts follow the defaults",
    (await commandItems()).join("|") === [...defaults, "alpha", "beta", "gamma"].join("|"));
  await page.click("#settings-btn");
  await page.fill("#commands-field", "");
  await page.click('#settings-dialog [data-close]');
  await ok("blank leaves just the defaults", (await commandItems()).join("|") === defaults.join("|"));

  // --- completions (when lang.js has complete) -----------------------------
  const chips = () => page.locator("#suggest-row .suggest-item").allTextContents();
  const C = LANG.completion;
  if (!C) {
    await ok("no complete(): no strip, no option", (await page.locator("#suggest-row").isHidden()) && (await page.locator("#suggest-section").isHidden()));
  } else {
    await page.locator("#input").pressSequentially(C.first);
    await ok("no completions under two characters", (await chips()).length === 0);
    await page.locator("#input").pressSequentially(C.more);
    await ok("completions show for the word at the caret", (await chips()).includes(C.pick), JSON.stringify(await chips()));
    await page.locator("#suggest-row .suggest-item", { hasText: new RegExp(`^${C.pick}$`) }).click();
    await ok("tapping a completion replaces the word", (await page.inputValue("#input")) === C.picked);
    await ok("tapping a completion keeps focus in the input",
      await page.locator("#input").evaluate((el) => document.activeElement === el));
    await page.locator("#input").pressSequentially(C.tab);
    await page.press("#input", "Tab");
    await ok("Tab completes a single candidate", (await page.inputValue("#input")) === C.tabbed, await page.inputValue("#input"));
    await page.fill("#input", "");
    await page.click("#settings-btn");
    await page.click('[data-set-suggest="off"]');
    await page.click('#settings-dialog [data-close]');
    await page.locator("#input").pressSequentially(C.first + C.more);
    await ok("completions can be turned off", await page.locator("#suggest-row").isHidden());
    await page.fill("#input", "");
    await page.click("#settings-btn");
    await page.click('[data-set-suggest="on"]');
    await page.click('#settings-dialog [data-close]');
  }

  // --- persistence ---------------------------------------------------------
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(120);
  await ok("session survives a reload", (await results()).length === 4);
  await run(LANG.lastAfterReload[0]);
  await ok("interpreter state is per page load", (await results()).at(-1) === LANG.lastAfterReload[1], (await results()).at(-1));

  // --- docs ----------------------------------------------------------------
  // One docs tab: it shows the last doc read; tapped again, a menu of chips.
  const docsTab = page.locator('repl-tabs [data-tab="docs"]');
  const docMenu = page.locator("#doc-menu");
  const shownDoc = () => page.locator(".doc-page:not([hidden])").getAttribute("data-doc");
  const docPage = (/** @type {string} */ id) => page.locator(`.doc-page[data-doc="${id}"]`);
  /** Open the docs tab on doc `id`, through the menu if it isn't showing. */
  const openDoc = async (/** @type {string} */ id) => {
    if ((await docsTab.getAttribute("aria-selected")) !== "true") await docsTab.click();
    if ((await shownDoc()) === id) return;
    await docsTab.click();
    await docMenu.locator(`[data-doc="${id}"]`).click();
  };
  await ok("three tabs: repl, docs, log", (await page.getByRole("tab").count()) === 3);
  await ok("jump button hidden on the repl tab", await page.locator("#doc-index-btn").isHidden());
  await docsTab.click();
  await ok("the docs tab opens on a doc", (await page.locator(".doc-page:not([hidden])").count()) === 1);
  await ok("…without the menu", await docMenu.isHidden());
  await docsTab.click();
  await ok("tapping it again drops down the menu", await docMenu.isVisible());
  await ok("one chip per doc", (await docMenu.locator(".doc-chip").count()) === (await page.locator(".doc-page").count()));
  await page.locator("#docs-panel").click({ position: { x: 20, y: 300 } });
  await ok("tapping elsewhere closes the menu", await docMenu.isHidden());
  await openDoc(LANG.doc);
  await ok("picking a chip shows that doc and closes the menu", (await shownDoc()) === LANG.doc && (await docMenu.isHidden()));
  const chipLabel = (await docMenu.locator(`[data-doc="${LANG.doc}"]`).textContent()) ?? "";
  await ok("the tab is labelled with the doc it shows", ((await docsTab.textContent()) ?? "").startsWith(chipLabel), chipLabel);
  await page.waitForSelector(`.doc-page[data-doc="${LANG.doc}"] doc-view h2`);
  await ok("doc renders markdown", (await docPage(LANG.doc).locator("doc-view h2").count()) > 5);
  await ok("jump button shows on the docs tab", await page.locator("#doc-index-btn").isVisible());
  await page.click("#doc-index-btn");
  const jumpItems = page.locator("#doc-index-list .doc-index-item");
  await ok("jump list lists the doc's headings", (await jumpItems.count()) > 5);
  await jumpItems.nth(4).click();
  await page.waitForTimeout(60);
  await ok("jumping closes the list", !(await page.locator("#doc-index-dialog").evaluate((d) => /** @type {HTMLDialogElement} */ (d).open)));
  const docScroll = () => page.locator("#docs-panel").evaluate((p) => p.scrollTop);
  const jumped = await docScroll();
  await ok("jumping scrolls the doc", jumped > 0);
  await clickTab("repl");
  await docsTab.click();
  await ok("a doc keeps its place across tabs", Math.abs((await docScroll()) - jumped) < 2, `${await docScroll()} vs ${jumped}`);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(120);
  await ok("the docs tab and its doc persist", (await page.locator("#docs-panel").isVisible()) && (await shownDoc()) === LANG.doc);
  const app = JSON.parse(await readFile(join(root, "package.json"), "utf8")).name;
  await page.evaluate(([app, id]) => (localStorage.setItem(app + ":tab", id), localStorage.removeItem(app + ":doc")), [app, LANG.doc]);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(120);
  await ok("a stored per-doc tab (older versions) opens that doc", (await page.locator("#docs-panel").isVisible()) && (await shownDoc()) === LANG.doc);
  await clickTab("repl");
  await ok("switching to the repl focuses the input",
    await page.locator("#input").evaluate((el) => document.activeElement === el));

  // --- sessions ------------------------------------------------------------
  await clickTab("log");
  await ok("log lists the current session", (await page.locator("session-list .session-row.current").count()) === 1);
  await page.click("#new-session-btn");
  await page.waitForTimeout(60);
  await ok("new session adds a row", (await page.locator("session-list .session-row").count()) === 2);
  await clickTab("repl");
  await ok("new session starts empty", (await results()).length === 0);
  await run(LANG.another[0]);
  await clickTab("log");

  await page.locator("session-list .session-row").nth(1).click(); // the older one
  await ok("opening a session shows its entries", (await page.locator("#session-view .result").count()) === 5);
  await page.fill("#session-name", "first");
  await page.press("#session-name", "Tab");
  await page.waitForTimeout(60);
  await ok("rename shows in the list", (await page.locator("session-list .session-name").allInnerTexts()).includes("first"));

  await page.click("#session-export-btn");
  const exported = await copied();
  await ok("export copies commented source", exported?.startsWith(LANG.exportHead), exported?.slice(0, 60));
  await ok("export comments out the error", exported?.includes(LANG.exportedError));
  await page.locator("#session-view .copy-caret").first().click();
  await ok("a caret in the session viewer copies", (await copied()) === LANG.value[0]);
  await page.click('#session-dialog [data-close]');
  await ok("…but doesn't refill the input behind the dialog", (await page.inputValue("#input")) === "");

  await clickTab("repl");
  await run(exported);
  await ok("pasting an export back runs clean", !(await page.locator("#output .result").last().getAttribute("class"))?.includes("error"),
    (await results()).at(-1));

  await clickTab("log");
  await page.locator("session-list .session-row").nth(1).click();
  await page.click("#session-delete-btn");
  await page.waitForTimeout(60);
  await ok("delete removes the session", (await page.locator("session-list .session-row").count()) === 1);

  await page.locator("session-list .session-row").first().click();
  await page.click("#session-delete-btn");
  await page.waitForTimeout(60);
  await ok("deleting the active session starts a fresh one",
    (await page.locator("session-list .session-row.current").count()) === 1 && (await page.locator("session-list .session-meta").innerText()).includes("0 entries"));
  await clickTab("repl");
  await ok("…and the repl shows it empty", (await results()).length === 0);

  await run("1");
  await page.click("#settings-btn");
  await page.click("#clear-output-btn");
  await page.click('#settings-dialog [data-close]');
  await ok("clear output empties the session", (await results()).length === 0);

  // --- theme ---------------------------------------------------------------
  await page.click("#settings-btn");
  await page.click('[data-set-theme="phosphor"]');
  await page.waitForTimeout(60);
  await ok("theme applies", (await page.getAttribute("html", "data-theme")) === "phosphor");
  await ok("swatch aria-checked syncs", (await page.getAttribute('[data-set-theme="phosphor"]', "aria-checked")) === "true");
  await page.click('#settings-dialog [data-close]');
  await ok("storage keys use the app-ns meta", (await page.evaluate((app) => localStorage.getItem(app + ":theme"), app)) === "phosphor");

  // --- service worker ------------------------------------------------------
  const swState = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return "none";
    await navigator.serviceWorker.ready;
    return reg.active ? "active" : "registered";
  });
  await ok("service worker activates", swState === "active", swState);

  const assets = (await readFile(join(root, "sw-assets.js"), "utf8")).match(/const ASSETS = \[([^\]]*)\]/)?.[1].match(/"[^"]+"/g)?.length;
  const cached = await page.evaluate(async () => {
    const names = await caches.keys();
    const c = await caches.open(names[0]);
    return (await c.keys()).length;
  });
  await ok("every asset precached", cached === assets, `${cached} of ${assets}`);

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
  await page.fill("#input", "half-typed");
  await resume();
  await page.waitForTimeout(200);
  await ok("update: no reload while an entry is half-typed", await sameDocument());
  await page.fill("#input", "");
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
  await page.goto(URL + "?utm_source=subway", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  await run(LANG.offline[0]);
  await ok("evaluates offline", (await results()).at(-1) === LANG.offline[1]);
  await openDoc(LANG.unopenedDoc); // never opened before in this test
  await page.waitForSelector(`.doc-page[data-doc="${LANG.unopenedDoc}"] doc-view h2`, { timeout: 3000 }).catch(() => {});
  await ok("an unopened doc loads offline", (await docPage(LANG.unopenedDoc).locator("doc-view h2").count()) > LANG.unopenedDocSections);
  await ctx.setOffline(false);

  await ok("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
});
