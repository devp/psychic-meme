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

// The language-specific half of this test. Everything below it is the same in
// every pizza-repl-<lang>.
const LANG = {
  greeting: "Fennel REPL",
  value: ["(+ 1 2)", "3"],
  error: "(nope)",
  printed: ["(print :hi) 5", "hi\n5"],
  another: ["(* 2 3)", "6"],
  // interpreter state doesn't survive a reload
  lastAfterReload: ["*1", "nil"],
  doc: "reference",
  unopenedDoc: "lua",
  exportHead: ';; pizza-repl-fennel export: "first"',
  exportedError: ";; (nope)\n",
  offline: ["(* 10 10)", "100"],
};

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

  // --- copy caret ----------------------------------------------------------
  await page.locator("#output .copy-caret").first().click();
  await ok("caret copies its input", (await copied()) === LANG.value[0]);
  await ok("caret refills an empty input", (await page.inputValue("#input")) === LANG.value[0]);
  await page.fill("#input", "half-typed");
  await page.locator("#output .copy-caret").nth(3).click();
  await ok("caret never clobbers a half-typed input", (await page.inputValue("#input")) === "half-typed");
  await page.fill("#input", "");

  // --- persistence ---------------------------------------------------------
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(120);
  await ok("session survives a reload", (await results()).length === 4);
  await run(LANG.lastAfterReload[0]);
  await ok("interpreter state is per page load", (await results()).at(-1) === LANG.lastAfterReload[1], (await results()).at(-1));

  // --- docs ----------------------------------------------------------------
  const tabCount = await page.getByRole("tab").count();
  await ok("one tab per panel", tabCount === (await page.locator(".panel[data-panel]").count()), `${tabCount} tabs`);
  await ok("jump button hidden on the repl tab", await page.locator("#doc-index-btn").isHidden());
  await clickTab(LANG.doc);
  await page.waitForSelector(`.panel[data-panel="${LANG.doc}"] doc-view h2`);
  await ok("doc renders markdown", (await page.locator(`.panel[data-panel="${LANG.doc}"] doc-view h2`).count()) > 5);
  await ok("jump button shows on a doc tab", await page.locator("#doc-index-btn").isVisible());
  await page.click("#doc-index-btn");
  const jumpItems = page.locator("#doc-index-list .doc-index-item");
  await ok("jump list lists the doc's headings", (await jumpItems.count()) > 5);
  await jumpItems.nth(4).click();
  await page.waitForTimeout(60);
  await ok("jumping closes the list", !(await page.locator("#doc-index-dialog").evaluate((d) => /** @type {HTMLDialogElement} */ (d).open)));
  await ok("jumping scrolls the doc", (await page.locator(`.panel[data-panel="${LANG.doc}"]`).evaluate((p) => p.scrollTop)) > 0);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(120);
  await ok("active tab persists", await page.locator(`.panel[data-panel="${LANG.doc}"]`).isVisible());
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
  const app = JSON.parse(await readFile(join(root, "package.json"), "utf8")).name;
  await ok("storage keys use the app-ns meta", (await page.evaluate((app) => localStorage.getItem(app + ":theme"), app)) === "phosphor");

  // --- service worker ------------------------------------------------------
  const swState = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return "none";
    await navigator.serviceWorker.ready;
    return reg.active ? "active" : "registered";
  });
  await ok("service worker activates", swState === "active", swState);

  const assets = (await readFile(join(root, "sw.js"), "utf8")).match(/const ASSETS = \[([^\]]*)\]/)?.[1].match(/"[^"]+"/g)?.length;
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
  overrides.clear();

  // --- offline (the whole point) -------------------------------------------
  await ctx.setOffline(true);
  await page.goto(URL + "?utm_source=subway", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  await run(LANG.offline[0]);
  await ok("evaluates offline", (await results()).at(-1) === LANG.offline[1]);
  await clickTab(LANG.unopenedDoc); // never opened before in this test
  await page.waitForSelector(`.panel[data-panel="${LANG.unopenedDoc}"] doc-view h2`, { timeout: 3000 }).catch(() => {});
  await ok("an unopened doc loads offline", (await page.locator(`.panel[data-panel="${LANG.unopenedDoc}"] doc-view h2`).count()) > 5);
  await ctx.setOffline(false);

  await ok("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
});
