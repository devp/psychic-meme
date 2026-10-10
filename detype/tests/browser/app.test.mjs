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

  const tabs = await page.getByRole("tab").allInnerTexts();
  await ok("tabs are write and pages", tabs.join(",") === "write,pages", tabs.join(","));

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
  const afterPaste = JSON.parse((await ls("detype:pages:records")) ?? "[]")[0].items.map((i) => i.text);
  await ok("pasted lines are saved, the tail isn't", afterPaste.slice(-2).join("|") === "pasted one|pasted two" && afterPaste.length === 7,
    afterPaste.join("|"));
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
  await ok("goal unit is labelled", (await page.innerText("#goal-target-unit")) === "lines");
  await page.fill("#goal-target", "14");
  await page.locator("#goal-target").dispatchEvent("change");
  await page.fill("#goal-target", "0");
  await page.locator("#goal-target").dispatchEvent("change");
  await ok("a non-positive goal reverts", (await page.inputValue("#goal-target")) === "14");
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
  const dlText = await readFile(await dl.path(), "utf8");
  await ok("day download is the blob plus a newline", dlText.startsWith("the kettle is on\ni should call the dentist\n") && dlText.endsWith("pasted two\n"),
    JSON.stringify(dlText));
  const [dlAll] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "download all" }).click()]);
  await ok("download all", dlAll.suggestedFilename() === `detype-all-${today}.txt`, dlAll.suggestedFilename());
  const allText = await readFile(await dlAll.path(), "utf8");
  await ok("download all heads each day with its date", allText.startsWith(`# ${today}\n\nthe kettle is on\n`), JSON.stringify(allText.slice(0, 80)));

  page.once("dialog", (d) => d.dismiss());
  await page.getByRole("button", { name: "delete", exact: true }).click();
  await page.waitForTimeout(60);
  await ok("cancelled delete keeps the page", (await page.locator("pages-list .page").count()) === 1);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "delete", exact: true }).click();
  await page.waitForTimeout(60);
  await ok("delete removes the page", (await page.locator("pages-list .page").count()) === 0);
  await ok("empty state shows", (await page.locator("pages-list p.quiet").innerText()).startsWith("Nothing here yet"));

  // Older days, seeded straight into storage. updatedAt runs opposite to the
  // day, so the order below can only come from sorting by day.
  await page.evaluate(() => {
    const line = (/** @type {string} */ text) => ({ id: "i" + text.length, text, at: 1 });
    localStorage.setItem("detype:pages:records", JSON.stringify([
      { id: "a", name: "2026-01-02", createdAt: 3, updatedAt: 3, items: [line("remember the zebra")] },
      { id: "b", name: "2026-01-03", createdAt: 2, updatedAt: 2, items: [] },
      { id: "c", name: "2026-01-04", createdAt: 1, updatedAt: 1, items: [line("hello")] },
      { id: "d", name: "2025-12-31", createdAt: 4, updatedAt: 4, items: [line("old year")] },
    ]));
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(120);
  await ok("active tab persists across reload", await page.locator('.panel[data-panel="pages"]').isVisible());
  const heads = await page.locator("pages-list .page-head h2").allInnerTexts();
  const expected = await page.evaluate(() =>
    ["2026-01-04", "2026-01-02", "2025-12-31"].map((k) => {
      const [y, m, d] = k.split("-").map(Number);
      return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    })
  );
  await ok("pages newest day first, empty days hidden, labelled by date", heads.join("|") === expected.join("|"), heads.join("|"));
  const counts = await page.locator("pages-list .page-head .quiet").allInnerTexts();
  await ok("word count per page, singular for one", counts.join("|") === "1 word|3 words|2 words", counts.join("|"));
  await page.fill("pages-list input[type=search]", "ZEBRA");
  await page.waitForTimeout(60);
  await ok("find is case-insensitive across days", (await page.locator("pages-list .page").count()) === 1);
  await ok("no month actions while searching", (await page.locator("pages-list .month-head").count()) === 0);
  await page.fill("pages-list input[type=search]", "nope");
  await page.waitForTimeout(60);
  await ok("find says when nothing matches", (await page.locator("pages-list p.quiet").innerText()).includes("nope"));
  await page.fill("pages-list input[type=search]", "");
  await page.waitForTimeout(60);

  const months = await page.locator("pages-list .month-head h2").allInnerTexts();
  const monthsExpected = await page.evaluate(() =>
    [[2026, 0], [2025, 11]].map(([y, m]) => new Date(y, m, 1).toLocaleDateString(undefined, { year: "numeric", month: "long" }))
  );
  await ok("pages grouped by month, newest first", months.join("|") === monthsExpected.join("|"), months.join("|"));
  await ok("month totals", (await page.locator("pages-list .month-head .quiet").first().innerText()) === "2 pages · 4 words");
  const jan = page.locator("pages-list .month").first();
  const [dlMonth] = await Promise.all([page.waitForEvent("download"), jan.getByRole("button", { name: "download month" }).click()]);
  await ok("download month", dlMonth.suggestedFilename() === "detype-2026-01.txt", dlMonth.suggestedFilename());
  const monthText = await readFile(await dlMonth.path(), "utf8");
  await ok("month download is that month only, oldest first",
    monthText === "# 2026-01-02\n\nremember the zebra\n\n# 2026-01-04\n\nhello\n", JSON.stringify(monthText));
  /** @type {string} */
  let monthPrompt = "";
  page.once("dialog", (d) => ((monthPrompt = d.message()), d.dismiss()));
  await jan.getByRole("button", { name: "delete month" }).click();
  await page.waitForTimeout(60);
  await ok("month delete asks with counts", monthPrompt.startsWith("Delete 2 pages (4 words) from "), monthPrompt);
  await ok("cancelled month delete keeps the pages", (await page.locator("pages-list .page").count()) === 3);
  page.once("dialog", (d) => d.accept());
  await jan.getByRole("button", { name: "delete month" }).click();
  await page.waitForTimeout(60);
  const left = await page.locator("pages-list .page-head h2").allInnerTexts();
  await ok("month delete removes only that month", left.length === 1 && left[0] === expected[2], left.join("|"));
  await ok("goal setting persists across reload",
    (await page.locator("#goal").evaluate((el) => /** @type {HTMLElement} */ (el).hidden)) === false &&
      (await ls("detype:goalUnit")) === "lines" && (await ls("detype:goalTarget")) === "14");

  await clickTab("write");
  await page.waitForTimeout(60);
  await ok("back to write focuses the line", (await page.evaluate(() => document.activeElement?.id)) === "line");

  // --- theme ---------------------------------------------------------------
  await page.click("#settings-btn");
  await page.click('[data-set-theme="linen"]');
  await page.waitForTimeout(60);
  await ok("theme applies", (await page.getAttribute("html", "data-theme")) === "linen");
  await ok("theme swatch aria-checked syncs", (await page.getAttribute('[data-set-theme="linen"]', "aria-checked")) === "true" &&
    (await page.getAttribute('[data-set-theme="dusk"]', "aria-checked")) === "false");
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await ok("linen palette reaches the page", bg === "rgb(245, 241, 232)", bg);
  const themeColor = await page.getAttribute('meta[name="theme-color"]', "content");
  await ok("theme-color follows the theme", themeColor === "#eee8da", String(themeColor));
  await page.click('[data-set-font="mono"]');
  await page.waitForTimeout(60);
  await ok("font applies", (await page.getAttribute("html", "data-font")) === "mono");
  const family = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  await ok("mono font reaches the page", family.includes("monospace"), family);
  await ok("font swatch aria-checked syncs", (await page.getAttribute('[data-set-font="mono"]', "aria-checked")) === "true");
  await ok("theme and font persist under the detype: namespace", (await ls("detype:theme")) === "linen" && (await ls("detype:font")) === "mono");
  await page.click("#settings-close");

  // --- service worker + offline ---------------------------------------------
  const swState = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return "none";
    await navigator.serviceWorker.ready;
    return reg.active ? "active" : "registered";
  });
  await ok("service worker activates", swState === "active", swState);

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
  const appCss = await readFile(join(root, "app.css"), "utf8");
  await page.evaluate(() => (/** @type {any} */ (window).__sameDocument = true));
  const sameDocument = () => page.evaluate(() => /** @type {any} */ (window).__sameDocument === true);

  let heard = nextUpdate(1500);
  await resume();
  await ok("update: nothing deployed, no update", (await heard) === "none");
  await ok("update: nothing deployed, no reload", await sameDocument());

  overrides.set("/app.css", appCss + MARK);
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

  // The line in the box isn't saved until Enter, so a pending reload waits.
  await page.fill("#line", "half a thought");
  await resume();
  await page.waitForTimeout(300);
  await ok("update: no reload while a line is half-typed", await sameDocument());
  await ok("update: the half-typed line survives the resume", (await page.inputValue("#line")) === "half a thought");
  await page.keyboard.press("Enter");

  await Promise.all([page.waitForEvent("load"), resume()]);
  await ok("update: reloads on the next resume with an empty box", !(await sameDocument()));
  const served = await page.evaluate(async () => (await fetch("app.css")).text());
  await ok("update: the reloaded page gets the new file", served.includes(MARK));
  const saved = JSON.parse((await ls("detype:pages:records")) ?? "[]").flatMap((p) => p.items.map((i) => i.text));
  await ok("update: the line finished before the reload was saved", saved.includes("half a thought"));
  await ok("update: no toast after reloading", !(await page.locator("update-toast").isVisible()));

  overrides.set("/app.css", appCss + MARK + MARK);
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

  await ctx.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  await page.keyboard.type("offline line");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(60);
  await ok("works offline after reload", (await page.locator("ghost-lines .ghost").count()) === 1);
  await ctx.setOffline(false);

  // --- storage full ----------------------------------------------------------
  await ok("save warning hidden while saving works", await page.locator("#save-warning").isHidden());
  await page.evaluate(() => {
    const w = /** @type {any} */ (window);
    w.__realSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new DOMException("full", "QuotaExceededError");
    };
  });
  await page.keyboard.type("this one won't fit");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(60);
  await ok("save warning shows when a line didn't save", await page.locator("#save-warning").isVisible());
  await ok("the line still lets go", (await page.inputValue("#line")) === "" && (await page.locator("ghost-lines .ghost").count()) === 2);
  await page.evaluate(() => {
    Storage.prototype.setItem = /** @type {any} */ (window).__realSetItem;
  });
  await page.keyboard.type("room again");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(60);
  await ok("save warning clears once a line saves", await page.locator("#save-warning").isHidden());

  // --- styles land (catches a rule lost when moving CSS around) ---------------
  await page.emulateMedia({ reducedMotion: "reduce" });
  const css = await page.evaluate(() => {
    const cs = (/** @type {string} */ sel) => getComputedStyle(/** @type {Element} */ (document.querySelector(sel)));
    return {
      ghost0: cs('.ghost[data-age="0"]').opacity,
      ghost2: cs('.ghost[data-age="2"]').opacity,
      hint: cs("#hint").opacity,
      line: cs("#line").fontSize,
      goal: cs("#goal").height,
      write: cs('.panel[data-panel="write"]').display,
      pages: cs('.panel[data-panel="pages"]').display,
      tab: cs(".tab.active").backgroundColor,
    };
  });
  await ok("ghost ages fade", css.ghost0 === "0.22" && css.ghost2 === "0.03", JSON.stringify(css));
  await ok("hint is gone", css.hint === "0", JSON.stringify(css));
  await ok("write layout", css.line === "20px" && css.goal === "2px" && css.write === "flex" && css.pages === "none", JSON.stringify(css));
  await ok("active tab uses the accent", css.tab === "rgb(111, 138, 120)", JSON.stringify(css));

  await ok("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));

  // --- pre-paint theme script, with app.js kept out ---------------------------
  const bare = await browser.newContext({ serviceWorkers: "block" });
  const bp = await bare.newPage();
  await bp.goto(URL);
  await bp.evaluate(() => {
    localStorage.setItem("detype:theme", "linen");
    localStorage.setItem("detype:font", "sans");
  });
  await bp.route("**/app.js", (r) => r.abort());
  await bp.reload({ waitUntil: "domcontentloaded" });
  const attrs = await bp.evaluate(() => [document.documentElement.dataset.theme, document.documentElement.dataset.font].join(","));
  await ok("saved theme and font apply before app.js runs", attrs === "linen,sans", attrs);
  await bare.close();
});
