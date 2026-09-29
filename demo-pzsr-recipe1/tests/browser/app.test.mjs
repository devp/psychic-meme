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

test("supper-deck in a real browser", { skip: !chromium && "playwright not installed" }, async (t) => {
  const server = await serve();
  const URL = `http://127.0.0.1:${server.address().port}/index.html`;
  // Prefer an explicitly-provided binary, then installed Chrome, then
  // `node_modules/.bin/playwright install chromium`. The env var is for container images
  // that ship a browser whose build doesn't match the installed playwright:
  //   PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium just dev-check-tests
  const browser = process.env.PLAYWRIGHT_CHROMIUM_PATH
    ? await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH })
    : await chromium.launch({ channel: "chrome" }).catch(() => chromium.launch());
  t.after(async () => {
    await browser.close();
    server.closeAllConnections();
    server.close();
  });

  const ok = (name, cond, extra = "") => t.test(name, () => assert.ok(cond, extra || name));

  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"]);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

  const clickTab = (name) => page.getByRole("tab", { name, exact: false }).click();
  const settle = () => page.waitForTimeout(80);
  /** The fling animation in pick-deck.js is 190ms; wait past it. */
  const settleFling = () => page.waitForTimeout(320);
  const cardName = () => page.locator(".deck-card:not(.peek) h3").innerText();
  const deckCount = () => page.locator(".deck-count").innerText();
  const badge = (tabId) =>
    page.locator(`[data-tab="${tabId}"] .badge`).evaluate((el) => (el.hidden ? "" : el.textContent));

  await page.goto(URL, { waitUntil: "networkidle" });
  await settle();

  const tabLabels = await page.getByRole("tab").evaluateAll((tabs) => tabs.map((b) => b.firstChild?.textContent));
  await ok("one tab per panel, labelled from the page",
    tabLabels.join(",") === "tonight,week,pantry,shop,about", tabLabels.join(","));

  // --- first run seeds a kitchen -------------------------------------------
  await ok("a card is dealt on first run", (await page.locator(".deck-card:not(.peek)").count()) === 1);
  await ok("the deck reads as a deck", (await page.locator(".deck-card.peek").count()) === 1);
  const firstCount = await deckCount();
  await ok("deck reports a pool over 100", /1[01]\d dishes match/.test(firstCount), firstCount);
  await ok("picking for Monday first", firstCount.includes("Mon"), firstCount);

  await clickTab("pantry");
  await settle();
  const pantryRows = await page.locator(".pantry li").count();
  await ok("pantry seeds one row per staple", pantryRows === 75, `${pantryRows} rows`);
  const shortNote = await page.locator('.panel[data-panel="pantry"] .panel-note').innerText();
  await ok("pantry reports what's short", /15 of 75 staples are low or out/.test(shortNote), shortNote);
  await clickTab("tonight");
  await settle();

  // --- the deck is stable, which is the whole point ------------------------
  const before = await cardName();
  await page.reload({ waitUntil: "networkidle" });
  await settle();
  await ok("same card after a reload (seeded shuffle)", (await cardName()) === before, before);

  // --- filters narrow the pool before you start looking --------------------
  const quickInLibrary = await page.evaluate(async () => {
    const { RECIPES } = await import("./data/recipes.js");
    return RECIPES.filter((r) => r.prep <= 15).length;
  });
  await page.getByRole("radio", { name: "≤ 15 min", exact: true }).click();
  await settle();
  const quick = await deckCount();
  await ok(
    "time filter narrows to exactly the quick dishes",
    Number(quick.match(/^(\d+)/)[1]) === quickInLibrary && quickInLibrary < 115,
    `${quick} vs ${quickInLibrary} in the library`
  );
  await page.getByRole("radio", { name: "no-cook", exact: true }).click();
  await settle();
  const quickNoCook = await deckCount();
  await ok(
    "filters AND together",
    Number(quickNoCook.match(/^(\d+)/)[1]) <= Number(quick.match(/^(\d+)/)[1]),
    `${quick} -> ${quickNoCook}`
  );
  const everyNoCook = await page.evaluate(async () => {
    const { RECIPES } = await import("./data/recipes.js");
    return RECIPES.filter((r) => r.prep <= 15 && r.method === "no-cook").length;
  });
  await ok("pool matches the library", Number(quickNoCook.match(/^(\d+)/)[1]) === everyNoCook,
    `${quickNoCook} vs ${everyNoCook}`);
  await ok("clear chip counts active filters", (await page.locator(".chip.clear").innerText()).trim() === "clear 2");
  await page.locator(".chip.clear").click();
  await settle();
  await ok("clear restores the full pool", (await deckCount()) === firstCount);

  const poolSize = async () => Number((await deckCount()).match(/^(\d+)/)[1]);
  const libraryCount = (/** @type {string} */ src) =>
    page.evaluate(async (src) => {
      const { RECIPES } = await import("./data/recipes.js");
      return RECIPES.filter(new Function("r", "return " + src)).length;
    }, src);
  const kids = page.getByRole("button", { name: "kids will eat it" });
  await kids.click();
  await settle();
  await ok("kids chip is pressed", (await kids.getAttribute("aria-pressed")) === "true");
  await ok("kids chip keeps only kid-safe dishes", (await poolSize()) === (await libraryCount("r.kidOk")),
    await deckCount());
  await ok("a kid-safe card says so", (await page.locator(".deck-card:not(.peek) .kid").count()) === 1);
  await kids.click();
  await page.getByRole("radio", { name: "bengali", exact: true }).click();
  await settle();
  await ok("lane filter narrows to the lane", (await poolSize()) === (await libraryCount('r.lane === "bengali"')),
    await deckCount());
  await page.locator(".chip.clear").click();
  await settle();
  await ok("clear resets every axis", (await deckCount()) === firstCount && (await page.locator(".chip.clear").count()) === 0);

  // --- "nothing to buy" is the pantry-aware filter -------------------------
  await page.getByRole("button", { name: "nothing to buy" }).click();
  await settle();
  const cookable = Number((await deckCount()).match(/^(\d+)/)[1]);
  const trulyCookable = await page.evaluate(async () => {
    const { RECIPES } = await import("./data/recipes.js");
    const { isCookable } = await import("./lib/plan.js");
    const { pantryMap } = await import("./state.js");
    const pan = pantryMap();
    return RECIPES.filter((r) => isCookable(r, pan)).length;
  });
  await ok("cookable filter agrees with the pantry", cookable === trulyCookable,
    `${cookable} vs ${trulyCookable}`);
  await ok("and it actually excludes things", cookable < 115, `${cookable}`);
  const cookableCard = await page.locator(".deck-card:not(.peek) .card-verdict").innerText();
  await ok("a cookable card says so", cookableCard.includes("Everything's in the kitchen"), cookableCard);
  await page.locator(".chip.clear").click();
  await settle();

  const verdict = await page.locator(".deck-card:not(.peek) .card-verdict").innerText();
  const expected = await page.evaluate(async (name) => {
    const { RECIPES } = await import("./data/recipes.js");
    const { STAPLE_BY_ID } = await import("./data/staples.js");
    const { missingFor } = await import("./lib/plan.js");
    const { pantryMap } = await import("./state.js");
    const r = RECIPES.find((x) => x.name === name);
    const missing = r ? missingFor(r, pantryMap()) : ["?"];
    return missing.length === 0
      ? "Everything's in the kitchen."
      : "Need to buy: " + missing.map((id) => STAPLE_BY_ID.get(id)?.name).join(", ");
  }, await cardName());
  await ok("card verdict matches missingFor", verdict === expected, `${verdict} vs ${expected}`);

  // --- a button decision lands on the first open night ---------------------
  const pick1 = await cardName();
  await page.getByRole("button", { name: "Cook it" }).click();
  await settleFling();
  await ok("card advances after a decision", (await cardName()) !== pick1, pick1);
  await ok("week badge counts the pick", (await badge("week")) === "1", await badge("week"));
  const nowPicking = await deckCount();
  await ok("now picking for Tuesday", nowPicking.includes("Tue"), nowPicking);

  await clickTab("week");
  await settle();
  const monday = await page.locator(".night").first().innerText();
  await ok("the dish is on Monday", monday.includes(pick1), monday);
  await ok("six nights still open", (await page.locator(".night.open").count()) === 6);
  await ok("the log recorded the decision",
    (await page.locator("#decision-log .log-entry").first().innerText()).includes(pick1));

  // --- a swipe is the same decision ----------------------------------------
  await clickTab("tonight");
  await settle();
  const pick2 = await cardName();
  const box = await page.locator(".deck-card:not(.peek)").boundingBox();
  const midY = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width / 2, midY);
  await page.mouse.down();
  // Several small steps: the axis lock in pick-deck.js only engages after 8px.
  for (const dx of [20, 60, 110, 150]) {
    await page.mouse.move(box.x + box.width / 2 + dx, midY);
  }
  const stampOpacity = await page
    .locator(".stamp-cook")
    .evaluate((el) => Number(el.style.opacity));
  await ok("the cook stamp tracks the drag", stampOpacity === 1, String(stampOpacity));
  await page.mouse.up();
  await settleFling();
  await ok("swipe right plans the dish", (await badge("week")) === "2", await badge("week"));
  await ok("swipe advances the card", (await cardName()) !== pick2);

  // A vertical drag must not count as a decision.
  const pick3 = await cardName();
  const box2 = await page.locator(".deck-card:not(.peek)").boundingBox();
  await page.mouse.move(box2.x + box2.width / 2, box2.y + 20);
  await page.mouse.down();
  for (const dy of [12, 40, 80]) await page.mouse.move(box2.x + box2.width / 2, box2.y + 20 + dy);
  await page.mouse.up();
  await settleFling();
  await ok("a vertical drag decides nothing", (await cardName()) === pick3 && (await badge("week")) === "2");

  // --- passing on a dish, and taking it back -------------------------------
  const passed = await cardName();
  await page.getByRole("button", { name: "Not tonight" }).click();
  await settleFling();
  await ok("passing advances without planning", (await badge("week")) === "2");
  await ok("the pass is undoable", (await page.locator(".skip-row").innerText()).includes("1 passed on"));
  await page.getByRole("button", { name: "undo last" }).click();
  await settle();
  await ok("undo puts it back in the deck",
    await page.evaluate((name) => !!document.body.innerText.includes(name), passed));
  await ok("skip row goes away when empty", (await page.locator(".skip-row").count()) === 0);

  const poolBeforeSwipe = await deckCount();
  const box3 = await page.locator(".deck-card:not(.peek)").boundingBox();
  const midY3 = box3.y + box3.height / 2;
  await page.mouse.move(box3.x + box3.width / 2, midY3);
  await page.mouse.down();
  for (const dx of [-20, -60, -110, -150]) await page.mouse.move(box3.x + box3.width / 2 + dx, midY3);
  await ok("the skip stamp tracks a left drag",
    (await page.locator(".stamp-skip").evaluate((el) => Number(el.style.opacity))) === 1);
  await page.mouse.up();
  await settleFling();
  await ok("swipe left passes without planning",
    (await badge("week")) === "2" && (await page.locator(".skip-row").innerText()).includes("1 passed on"));
  await page.getByRole("button", { name: "reshuffle all" }).click();
  await settle();
  await ok("reshuffle all takes every pass back",
    (await page.locator(".skip-row").count()) === 0 && (await deckCount()) === poolBeforeSwipe);

  // --- keyboard is a first-class path --------------------------------------
  const byKey = await cardName();
  await page.locator(".deck-card:not(.peek)").focus();
  await page.keyboard.press("ArrowRight");
  await settleFling();
  await ok("right arrow cooks it", (await badge("week")) === "3", await badge("week"));
  await ok("card advanced", (await cardName()) !== byKey);

  // --- the shopping list is generated, not edited --------------------------
  await clickTab("shop");
  await settle();
  const listed = await page.locator(".shop li").count();
  await ok("the list has lines", listed > 0, `${listed}`);
  await ok("shop badge matches the list", (await badge("shop")) === String(listed),
    `badge ${await badge("shop")} vs ${listed}`);
  const storeHeads = await page.locator('.panel[data-panel="shop"] .kind-head').count();
  await ok("grouped by store", storeHeads >= 2, `${storeHeads} stores`);
  await ok("restock-only lines are labelled",
    (await page.locator(".shop-why", { hasText: "restock" }).count()) > 0);

  const generated = await page.evaluate(async () => {
    const { buildShoppingList, countLines } = await import("./lib/plan.js");
    const { STAPLES, STORES } = await import("./data/staples.js");
    const { RECIPE_BY_ID } = await import("./data/recipes.js");
    const { pantryMap, planItems } = await import("./state.js");
    return countLines(
      buildShoppingList({
        picks: planItems().map((p) => RECIPE_BY_ID.get(p.recipeId)).filter(Boolean),
        pantry: pantryMap(),
        staples: STAPLES,
        stores: STORES,
      })
    );
  });
  await ok("what you see is what the pure function returns", listed === generated,
    `${listed} vs ${generated}`);

  await page.getByRole("button", { name: "Copy as text" }).click();
  await settle();
  await ok("copy confirms", (await page.getByRole("button", { name: "Copied" }).count()) === 1);
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  const firstHead = (await page.locator('.panel[data-panel="shop"] .kind-head').first().textContent())?.trim() ?? "";
  const [clipStore, clipLine] = clip.split("\n");
  await ok("copied text is the list, grouped by store",
    firstHead.startsWith(clipStore) && clipLine.startsWith("- ")
      && clip.split("\n").filter((l) => l.startsWith("- ")).length === listed,
    JSON.stringify(clip.slice(0, 80)));

  // --- pantry -> list -> pantry, the loop that keeps it honest -------------
  await page.locator(".shop input[type=checkbox]").first().check();
  await settle();
  const firstLineName = await page.locator(".shop-name").first().innerText();
  await ok("ticking marks the line got", await page.locator(".shop li").first().evaluate((el) =>
    el.classList.contains("got")));
  await page.getByRole("button", { name: /Put away/ }).click();
  await settle();
  const afterPutAway = await page.locator(".shop li").count();
  await ok("putting away shortens the list", afterPutAway === listed - 1,
    `${listed} -> ${afterPutAway}`);

  await clickTab("pantry");
  await settle();
  const restocked = await page.evaluate(async (name) => {
    const { STAPLES } = await import("./data/staples.js");
    const { pantryMap } = await import("./state.js");
    const staple = STAPLES.find((s) => s.name === name);
    return pantryMap().get(staple.id);
  }, firstLineName);
  await ok("the staple is back to have", restocked === "have", `${firstLineName} is ${restocked}`);

  // --- pantry edits reach the deck -----------------------------------------
  await page.getByRole("button", { name: "only what's short" }).click();
  await settle();
  const shortRows = await page.locator(".pantry li").count();
  await ok("only-short filters the pantry", shortRows > 0 && shortRows < 75, `${shortRows} rows`);
  await ok("and only-short shows nothing that's on hand",
    (await page.locator(".pantry li.p-have").count()) === 0);
  await page.getByRole("button", { name: "only what's short" }).click();
  await settle();

  // A low -> out flip wouldn't move the count: both are already on the list.
  const stocked = page.locator(".pantry li.p-have").first();
  const stockedName = await stocked.locator(".p-name span").first().innerText();
  await stocked.getByRole("radio", { name: "out" }).click();
  await settle();
  await ok("marking something out grows the list", Number(await badge("shop")) === afterPutAway + 1,
    `badge is ${await badge("shop")}, was ${afterPutAway}, flipped ${stockedName}`);

  // --- a night can be moved and freed --------------------------------------
  await clickTab("week");
  await settle();
  const mondayDish = await page.locator(".night").first().locator("strong").innerText();
  await page.locator(".night-move select").first().selectOption("wed");
  await settle();
  const wed = await page.locator(".night").nth(2).innerText();
  await ok("moving to an occupied night swaps them", wed.includes(mondayDish), wed);
  await ok("nothing was dropped in the swap", (await badge("week")) === "3", await badge("week"));
  const weekNote = await page.locator("week-plan .panel-note").innerText();
  const expectedNote = await page.evaluate(async () => {
    const { RECIPE_BY_ID } = await import("./data/recipes.js");
    const { formatPrep } = await import("./components/pick-deck.js");
    const { planItems } = await import("./state.js");
    const mins = planItems().reduce((n, p) => n + (RECIPE_BY_ID.get(p.recipeId)?.prep ?? 0), 0);
    return `3 of 7 nights picked · ${formatPrep(mins)} of cooking`;
  });
  await ok("week note sums the cooking time", weekNote === expectedNote, `${weekNote} vs ${expectedNote}`);
  await ok("formatPrep reads like speech", await page.evaluate(async () => {
    const { formatPrep } = await import("./components/pick-deck.js");
    return [formatPrep(45), formatPrep(60), formatPrep(90)].join("|");
  }) === "45 min|1h|1h 30m");
  await page.locator(".night-x").first().click();
  await settle();
  await ok("removing frees the night", (await badge("week")) === "2", await badge("week"));

  // --- persistence ---------------------------------------------------------
  await page.reload({ waitUntil: "networkidle" });
  await settle();
  await ok("active tab persists", await page.locator('.panel[data-panel="week"]').isVisible());
  await ok("the plan persists", (await badge("week")) === "2", await badge("week"));

  // --- theme ---------------------------------------------------------------
  await page.click("#settings-btn");
  await page.click('[data-set-theme="kitchen"]');
  await settle();
  await ok("theme applies", (await page.getAttribute("html", "data-theme")) === "kitchen");
  await ok("swatch aria-checked syncs",
    (await page.getAttribute('[data-set-theme="kitchen"]', "aria-checked")) === "true");
  await ok("other swatch unchecked",
    (await page.getAttribute('[data-set-theme="dusk"]', "aria-checked")) === "false");
  await page.click('[data-set-font="mono"]');
  await settle();
  await ok("font applies", (await page.getAttribute("html", "data-font")) === "mono");
  await page.click("#settings-close");
  await ok("storage keys keep the supper-deck namespace", await page.evaluate(() =>
    localStorage.getItem("supper-deck:theme") === "kitchen" && localStorage.getItem("supper-deck:font") === "mono"));

  // --- append-log: the travelling component --------------------------------
  // Driven through its property interface, which is the whole point of it.
  /** @param {{id: string, text: string}[]} items */
  const setItems = (items) =>
    page.evaluate((list) => {
      const el = /** @type {any} */ (document.getElementById("decision-log"));
      el.items = list.map((i) => ({ ...i, at: 1700000000000 }));
    }, items);

  await setItems([{ id: "a", text: "alpha" }, { id: "b", text: "bravo" }]);
  await settle();
  await ok("log renders items", (await page.locator("#decision-log .log-entry").count()) === 2);
  await page.evaluate(() => {
    /** @type {any} */ (document.querySelector("#decision-log .log-entry")).__marker = "survivor";
  });
  await setItems([
    { id: "a", text: "alpha" },
    { id: "b", text: "bravo" },
    { id: "c", text: "charlie" },
  ]);
  await settle();
  const survived = await page.evaluate(
    () => /** @type {any} */ (document.querySelector("#decision-log .log-entry")).__marker
  );
  await ok("keyed repeat preserves existing nodes", survived === "survivor");
  await ok("log carries role and live region",
    (await page.getAttribute("#decision-log", "role")) === "log");

  // --- offline (the whole point of the skeleton) ---------------------------
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
  await ok("assets precached", cached >= 18, `${cached} entries in cache`);

  await ctx.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  await ok("works offline after reload", (await badge("week")) === "2", await badge("week"));
  // query string must not miss the cache
  await page.goto(URL + "?utm_source=subway", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  await ok("offline with a query string (ignoreSearch)",
    (await page.locator("supper-tabs .tab").count()) === 5);
  await ctx.setOffline(false);

  // --- reset ---------------------------------------------------------------
  page.once("dialog", (d) => d.accept());
  await page.click("#settings-btn");
  await page.click("#reset-all");
  await page.waitForTimeout(500);
  await ok("reset reseeds an empty plan", (await badge("week")) === "", `badge ${await badge("week")}`);
  await ok("reset keeps a working pantry",
    (await page.locator(".deck-card:not(.peek)").count()) === 1);

  // --- edge states, in a fresh profile -------------------------------------
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p2 = await ctx2.newPage();
  p2.on("pageerror", (e) => errors.push(String(e)));
  p2.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await p2.goto(URL, { waitUntil: "networkidle" });
  await p2.waitForTimeout(80);

  // Checked on first install, before any request has passed through the
  // worker: later reloads would cache files at runtime and hide a gap.
  const uncached = await p2.evaluate(async () => {
    await navigator.serviceWorker.ready;
    const keys = new Set();
    for (const name of await caches.keys()) {
      for (const req of await (await caches.open(name)).keys()) keys.add(new URL(req.url).pathname);
    }
    const loaded = performance.getEntriesByType("resource").map((e) => new URL(e.name))
      .filter((u) => u.origin === location.origin).map((u) => u.pathname);
    const need = new Set([...loaded, "/index.html", "/data/recipes.js", "/data/staples.js"]);
    return [...need].filter((p) => !p.endsWith("/sw.js") && !keys.has(p));
  });
  await ok("install caches everything the page loads", uncached.length === 0, uncached.join(", "));
  const badge2 = (tabId) =>
    p2.locator(`[data-tab="${tabId}"] .badge`).evaluate((el) => (el.hidden ? "" : el.textContent));
  const tab2 = (name) => p2.getByRole("tab", { name, exact: false }).click();

  for (let i = 0; i < 7; i++) {
    await p2.getByRole("button", { name: "Cook it" }).click();
    await p2.waitForTimeout(320);
  }
  await ok("seven picks fill the week", (await badge2("week")) === "7", await badge2("week"));
  await ok("a full week stops dealing",
    (await p2.locator(".deck-empty").innerText()).includes("Seven nights, seven dishes.")
      && (await p2.getByRole("button", { name: "Cook it" }).count()) === 0);

  await tab2("week");
  await p2.waitForTimeout(80);
  await ok("no night is open", (await p2.locator(".night.open").count()) === 0);
  await p2.getByRole("button", { name: "Start a fresh week" }).click();
  await p2.waitForTimeout(80);
  await ok("a fresh week empties the plan",
    (await badge2("week")) === "" && (await p2.locator(".night.open").count()) === 7);
  await ok("last week is kept as its own record", await p2.evaluate(async () => {
    const { plan } = await import("./state.js");
    const all = plan.getAll();
    return all.length === 2 && all.some((r) => r.items.length === 7);
  }));
  await ok("the fresh week is logged",
    (await p2.locator("#decision-log .log-entry").first().innerText()).includes("started a fresh week"));

  await tab2("tonight");
  await p2.waitForTimeout(80);
  const combos = await p2.evaluate(async () => {
    const { RECIPES, LANES, METHODS } = await import("./data/recipes.js");
    /** @type {{lane: string, method: string, n: number}[]} */
    const out = [];
    for (const l of LANES) for (const m of METHODS) {
      out.push({ lane: l.label, method: m.label, n: RECIPES.filter((r) => r.lane === l.id && r.method === m.id).length });
    }
    return { empty: out.find((c) => c.n === 0), one: out.find((c) => c.n === 1) };
  });
  const pickCombo = async (c) => {
    await p2.getByRole("radio", { name: c.lane, exact: true }).click();
    await p2.getByRole("radio", { name: c.method, exact: true }).click();
    await p2.waitForTimeout(80);
  };
  await pickCombo(combos.empty);
  const emptyText = await p2.locator(".deck-empty").innerText();
  await ok("no matches says so and offers to loosen",
    emptyText.includes("Nothing left in this deck.") && emptyText.includes("clear all"), emptyText);
  await p2.getByRole("button", { name: "clear all" }).click();
  await p2.waitForTimeout(80);
  await ok("clear all deals again", (await p2.locator(".deck-card:not(.peek)").count()) === 1);

  await pickCombo(combos.one);
  await p2.getByRole("button", { name: "Not tonight" }).click();
  await p2.waitForTimeout(320);
  await ok("passing the last card offers a reshuffle",
    (await p2.locator(".deck-empty").innerText()).includes("take back the 1 you passed on"));
  await p2.locator(".deck-empty").getByRole("button", { name: "reshuffle" }).click();
  await p2.waitForTimeout(80);
  await ok("reshuffle deals the passed card again", (await p2.locator(".deck-count").innerText()).startsWith("1 dish match"));

  const logLen = await p2.evaluate(async () => {
    const { note, activity } = await import("./state.js");
    for (let i = 0; i < 50; i++) note("filler " + i);
    const rec = activity.get(activity.getActiveId() ?? "");
    return { n: rec?.items.length, last: rec?.items.at(-1)?.text };
  });
  await ok("the log keeps the last 40", logLen.n === 40 && logLen.last === "filler 49", JSON.stringify(logLen));
  await ctx2.close();

  await ok("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
});
