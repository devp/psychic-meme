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
  const BASE = `http://127.0.0.1:${server.address().port}/index.html`;
  // Pinned, so the lineup doesn't depend on when the test runs.
  const HOME = `${BASE}?day=wednesday&period=afternoon`;
  // Prefer installed Chrome; fall back to `node_modules/.bin/playwright install chromium`.
  const browser = await chromium.launch({ channel: "chrome" }).catch(() => chromium.launch());
  t.after(async () => {
    await browser.close();
    server.closeAllConnections();
    server.close();
  });

  const ok = (name, cond, extra = "") => t.test(name, () => assert.ok(cond, extra || name));

  const ctx = await browser.newContext({ viewport: { width: 1160, height: 760 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

  await page.goto(HOME, { waitUntil: "networkidle" });
  const heading = () => page.locator(".heading h1").innerText();

  // --- concierge: three questions deep --------------------------------------
  await ok("heading names the moment", (await heading()).replace(/\s+/g, " ") === "It's Wednesday Afternoon Play music for", await heading());
  await ok("the sky follows the period", (await page.getAttribute("html", "data-period")) === "afternoon");
  const tiles = await page.locator(".tile").count();
  await ok("situations render as tiles", tiles === 6, `${tiles} tiles`);
  const iconBox = await page.locator(".tile-art svg").first().boundingBox();
  await ok("tile icons are drawn from the sprite", iconBox && iconBox.width > 40, JSON.stringify(iconBox));
  await ok("no player before anything plays", !(await page.locator("player-bar").isVisible()));
  await ok("notice comes from the config", (await page.locator("#notice").innerText()).startsWith("Check out Mockza Daily"));

  await page.getByRole("link", { name: "Focusing (No Lyrics)" }).click();
  await page.waitForSelector(".tile-art--text");
  await ok("a situation asks its second question", (await heading()).includes("Pick a flavor"), await heading());
  await ok("it offers three refinements", (await page.locator(".tile").count()) === 3);

  await page.getByRole("link", { name: "Ambient" }).click();
  await page.waitForSelector(".card");
  await ok("a refinement offers three collections", (await page.locator(".card").count()) === 3);

  await page.getByRole("link", { name: "Back" }).click();
  await page.waitForSelector(".tile-art--text");
  await ok("back goes up one step", page.url().endsWith("#/for/focus"), page.url());
  await page.goBack();
  await page.waitForSelector(".card");

  // --- playing --------------------------------------------------------------
  await page.locator(".card", { hasText: "Deep Focus Ambient" }).click();
  await page.waitForSelector(".player-toggle[aria-label=Pause]");
  await ok("picking a card opens its page", page.url().endsWith("#/c/deep-focus-ambient"), page.url());
  await ok("and starts it", (await page.locator(".player-byline").innerText()).endsWith("Deep Focus Ambient"));
  await ok("the page's button agrees", (await page.locator(".feature .pill").innerText()).trim() === "Pause");
  await ok("similar collections are offered", (await page.locator(".card").count()) > 0);

  const first = await page.locator(".player-title").innerText();
  await page.getByRole("button", { name: "Skip" }).click();
  await page.waitForFunction((was) => {
    const now = document.querySelector(".player-title")?.textContent;
    return now && now !== was && !now.startsWith("Finding");
  }, first);
  await ok("skip brings the next item", true);

  await page.getByRole("button", { name: "Thumbs up" }).click();
  await ok("thumbs up sticks", (await page.getByRole("button", { name: "Thumbs up" }).getAttribute("aria-pressed")) === "true");

  await page.locator(".feature .pill").click();
  await page.waitForSelector(".player-toggle[aria-label=Play]");
  await ok("the page's button pauses the player", (await page.locator(".feature .pill").innerText()).trim() === "Play");
  await page.locator(".player-toggle").click();
  await page.waitForSelector(".player-toggle[aria-label=Pause]");

  // --- browse, recent, search -----------------------------------------------
  await page.getByRole("link", { name: "Genres", exact: true }).click();
  await page.waitForSelector(".links");
  await ok("nav marks where you are", (await page.getByRole("link", { name: "Genres", exact: true }).getAttribute("aria-current")) === "page");
  await page.getByRole("link", { name: /^Jazz/ }).click();
  await page.waitForSelector(".card");
  await ok("a category lists its collections", (await page.locator(".card").count()) === 4);
  await ok("the player survives navigation", await page.locator(".player-toggle[aria-label=Pause]").isVisible());

  await page.getByRole("link", { name: "Recent" }).click();
  // Not just ".card": the page being left has cards too.
  await page.waitForFunction(() => document.querySelector(".heading-title")?.textContent === "Recent");
  await ok("what was played is in Recent", (await page.locator(".card-title").allInnerTexts()).join() === "Deep Focus Ambient");
  await ok("and marked as on", (await page.locator(".card[data-on]").count()) === 1);
  const stored = await page.evaluate((ns) => localStorage.getItem(ns + ":recent"), appNs);
  await ok("recent is persisted", stored === '["deep-focus-ambient"]', String(stored));

  await page.fill(".nav-search input", "dinner jazz");
  await page.waitForFunction(() => location.hash.startsWith("#/search/") && document.querySelectorAll(".card").length === 2);
  await ok("search finds as you type", true);
  await page.fill(".nav-search input", "zzzz");
  await page.waitForSelector(".empty");
  await ok("no matches says so", (await page.locator(".empty").innerText()).includes("zzzz"));
  await page.getByRole("link", { name: "Concierge" }).click();
  await page.waitForSelector(".tile");
  await ok("leaving search clears the box", (await page.inputValue(".nav-search input")) === "");

  // --- about ----------------------------------------------------------------
  await page.getByRole("button", { name: "About" }).click();
  await ok("about opens", await page.locator("#about-dialog").isVisible());
  const share = await page.getAttribute("#share-link", "href");
  await ok("share link carries this app's URL", share?.includes("?q=http"), String(share));
  await page.getByRole("button", { name: "Done" }).click();

  // --- other moments --------------------------------------------------------
  await page.goto(`${BASE}?day=friday&period=evening`, { waitUntil: "networkidle" });
  await ok("another moment, another lineup", (await page.locator(".tile-label").first().innerText()) === "Getting the Party Started");
  await ok("and another sky", (await page.getAttribute("html", "data-period")) === "evening");

  // ?speed makes the mock engine's items end while we watch.
  await page.goto(`${BASE}?speed=600#/c/sofa-soul`, { waitUntil: "networkidle" });
  await page.locator(".feature .pill").click();
  await page.waitForSelector(".player-toggle[aria-label=Pause]");
  const before = await page.locator(".player-title").innerText();
  await page.waitForFunction((was) => {
    const now = document.querySelector(".player-title")?.textContent;
    return now && now !== was && !now.startsWith("Finding");
  }, before);
  await ok("an item that runs out brings the next", true);

  // --- offline (service worker) ---------------------------------------------
  const swState = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return reg.active?.state;
  });
  await ok("service worker activates", swState === "activated" || swState === "activating", String(swState));
  await page.waitForFunction(() => navigator.serviceWorker.controller || navigator.serviceWorker.ready.then((r) => r.active?.state === "activated"));
  await ctx.setOffline(true);
  await page.goto(`${HOME}#/for/focus`, { waitUntil: "load" });
  await page.waitForSelector(".tile-art--text");
  await ok("works offline, deep link and all", (await page.locator(".tile").count()) === 3);
  await ctx.setOffline(false);

  // --- phone ----------------------------------------------------------------
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await phone.newPage();
  p.on("pageerror", (e) => errors.push(String(e)));
  await p.goto(HOME, { waitUntil: "networkidle" });
  const fits = () => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth && document.body.scrollWidth <= window.innerWidth);
  await ok("phone: nothing wider than the screen", await fits());
  const cols = await p.evaluate(() => new Set([...document.querySelectorAll(".tile")].map((el) => Math.round(el.getBoundingClientRect().left))).size);
  await ok("phone: tiles wrap two across", cols === 2, `${cols} columns`);
  await p.goto(`${HOME}#/c/sofa-soul`, { waitUntil: "networkidle" });
  await p.locator(".feature .pill").click();
  await p.waitForSelector(".player-toggle[aria-label=Pause]");
  await ok("phone: still fits with the player up", await fits());
  const barBox = await p.locator("player-bar").boundingBox();
  await ok("phone: the player sits at the bottom", barBox && Math.round(barBox.y + barBox.height) === 844, JSON.stringify(barBox));
  await phone.close();

  await ok("no console or page errors", errors.length === 0, errors.join("\n"));
});
