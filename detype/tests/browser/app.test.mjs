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
  const browser = await chromium
    .launch({ channel: "chrome" })
    .catch(() => chromium.launch())
    .catch(() => chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium" }));
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
  const ls = (key) => page.evaluate((k) => localStorage.getItem(k), key);
  const today = await page.evaluate(() => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });

  await page.goto(URL, { waitUntil: "networkidle" });

  // --- writing -------------------------------------------------------------
  await ok("line box is focused on load", (await page.evaluate(() => document.activeElement?.id)) === "line");

  await page.keyboard.type("the kettle is on");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter"); // empty: ignored
  await page.keyboard.type("   ");
  await page.keyboard.press("Enter"); // whitespace: ignored
  await page.keyboard.type("i should call the dentist");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(60);

  await ok("box clears after Enter", (await page.inputValue("#line")) === "");
  const ghosts = await page.locator("ghost-lines .ghost").count();
  await ok("let-go lines become ghosts", ghosts === 2, `${ghosts} ghosts`);
  await ok("newest ghost is age 0", (await page.locator("ghost-lines .ghost").last().getAttribute("data-age")) === "0");
  await ok("ghosts are hidden from screen readers", (await page.getAttribute("ghost-lines", "aria-hidden")) === "true");
  await ok("hint fades after the first line", await page.locator("#hint").evaluate((el) => el.classList.contains("gone")));

  const stored = JSON.parse((await ls("detype:pages:records")) ?? "[]");
  await ok("one page, named for today", stored.length === 1 && stored[0].name === today, JSON.stringify(stored).slice(0, 200));
  await ok("empty lines are not kept", stored[0].items.map((i) => i.text).join("|") === "the kettle is on|i should call the dentist");

  // Ghosts keep their nodes as they age, so the fade transition runs.
  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector("ghost-lines .ghost")).__marker = "same";
  });
  for (const t of ["three", "four", "five"]) {
    await page.keyboard.type(t);
    await page.keyboard.press("Enter");
  }
  await page.waitForTimeout(60);
  await ok("at most three ghosts linger", (await page.locator("ghost-lines .ghost").count()) === 3);
  await ok("oldest ghost is age 2", (await page.locator("ghost-lines .ghost").first().getAttribute("data-age")) === "2");

  // A newline arriving in the value (phone IME, paste) lets go of each line.
  await page.fill("#line", "pasted one\npasted two\nstill typing");
  await page.waitForTimeout(60);
  await ok("newline in value lets go, keeps the tail", (await page.inputValue("#line")) === "still typing");
  await page.fill("#line", "");

  // --- reload: saved, but the screen starts fresh ---------------------------
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(120);
  await ok("ghosts don't come back after reload", (await page.locator("ghost-lines .ghost").count()) === 0);

  // --- goal ----------------------------------------------------------------
  await ok("goal bar hidden by default", await page.locator("#goal").isHidden());
  await page.keyboard.press("Tab"); // no mouse: reach the controls by keyboard
  await page.click("#settings-btn");
  await page.click('[data-set-goal="lines"]');
  await page.waitForTimeout(60);
  await ok("unit switch sets that unit's default", (await page.inputValue("#goal-target")) === "50");
  await page.fill("#goal-target", "14");
  await page.locator("#goal-target").dispatchEvent("change");
  await page.click("#settings-close");
  await page.waitForTimeout(60);
  await ok("goal bar shows when on", await page.locator("#goal").isVisible());
  const width = await page.locator("#goal-fill").evaluate((el) => el.style.width);
  await ok("7 of 14 lines is half", parseFloat(width) === 50, width);
  await ok("focus returns to the line after options", (await page.evaluate(() => document.activeElement?.id)) === "line");

  // --- pages ---------------------------------------------------------------
  await clickTab("pages");
  await page.waitForTimeout(60);
  await ok("today's page is listed", (await page.locator("pages-list .page").count()) === 1);
  const text = await page.locator("pages-list .page-text").innerText();
  await ok("page is one blob, a line per line", text.startsWith("the kettle is on\ni should call the dentist\nthree"), text);

  await page.fill("pages-list input[type=search]", "dentist");
  await page.waitForTimeout(60);
  await ok("find keeps matching pages", (await page.locator("pages-list .page").count()) === 1);
  await page.fill("pages-list input[type=search]", "zebra");
  await page.waitForTimeout(60);
  await ok("find hides non-matching pages", (await page.locator("pages-list .page").count()) === 0);
  await page.fill("pages-list input[type=search]", "");

  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "download", exact: true }).click()]);
  await ok("download one day as .txt", dl.suggestedFilename() === `detype-${today}.txt`, dl.suggestedFilename());
  const [dlAll] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "download all" }).click()]);
  await ok("download all", dlAll.suggestedFilename() === `detype-all-${today}.txt`, dlAll.suggestedFilename());

  page.once("dialog", (d) => d.dismiss());
  await page.getByRole("button", { name: "delete" }).click();
  await page.waitForTimeout(60);
  await ok("cancelled delete keeps the page", (await page.locator("pages-list .page").count()) === 1);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "delete" }).click();
  await page.waitForTimeout(60);
  await ok("delete removes the page", (await page.locator("pages-list .page").count()) === 0);

  await clickTab("write");
  await page.waitForTimeout(60);
  await ok("back to write focuses the line", (await page.evaluate(() => document.activeElement?.id)) === "line");

  // --- theme ---------------------------------------------------------------
  await page.click("#settings-btn");
  await page.click('[data-set-theme="linen"]');
  await page.waitForTimeout(60);
  await ok("theme applies", (await page.getAttribute("html", "data-theme")) === "linen");
  await page.click("#settings-close");

  // --- service worker + offline ---------------------------------------------
  const swState = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return "none";
    await navigator.serviceWorker.ready;
    return reg.active ? "active" : "registered";
  });
  await ok("service worker activates", swState === "active", swState);

  await ctx.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  await page.keyboard.type("offline line");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(60);
  await ok("works offline after reload", (await page.locator("ghost-lines .ghost").count()) === 1);
  await ctx.setOffline(false);

  await ok("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
});
