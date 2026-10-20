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
const appNs = (await readFile(join(root, "index.html"), "utf8")).match(/name="app-ns" content="([^"]+)"/)?.[1];
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

// ---- a fake Todoist ---------------------------------------------------------
// Stands in for api.todoist.com/api/v1 via page.route, so no token or network.

const localDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const day = (offset) => localDate(new Date(Date.now() + offset * 86400_000));

const PROJECTS = [
  { id: "pIn", name: "Inbox" },
  { id: "pHome", name: "Home" },
  { id: "pAg", name: "Agenda" },
  { id: "pW", name: "Watchlist" },
];
const SECTIONS = [
  { id: "sSchool", name: "School", project_id: "pAg", section_order: 2 },
  { id: "sLaura", name: "Laura", project_id: "pAg", section_order: 1 },
  { id: "sChores", name: "Chores", project_id: "pHome", section_order: 1 },
];
const TODAY = [
  { id: "t1", content: "Call the plumber", description: "", project_id: "pHome", section_id: "sChores", labels: [], due: { date: day(0), string: "today" } },
  { id: "t2", content: "Water plants", description: "", project_id: "pHome", labels: [], due: { date: day(0), string: "every day", is_recurring: true } },
  { id: "t3", content: "Email [the school](https://example.com)", description: "\nabout the IEP meeting\nmore", project_id: "pIn", labels: ["pin"], due: { date: day(-3), string: "Oct 17" } },
  { id: "t4", content: "Renew passport", description: "", project_id: "pIn", labels: [], due: { date: day(0) } },
];

/** @param {import("playwright").Page} page */
async function fakeTodoist(page, { failUuidOf = "" } = {}) {
  const log = { syncs: [], auth: new Set() };
  const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, content-type" };
  await page.route("https://api.todoist.com/api/v1/**", async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    log.auth.add(req.headers()["authorization"]);
    if (req.headers()["authorization"] !== "Bearer good-token") return route.fulfill({ status: 401, headers: cors, body: "Unauthorized" });
    const url = new URL(req.url());
    const json = (body) => route.fulfill({ status: 200, headers: { ...cors, "content-type": "application/json" }, body: JSON.stringify(body) });
    if (url.pathname.endsWith("/projects")) return json({ results: PROJECTS, next_cursor: null });
    if (url.pathname.endsWith("/sections")) return json({ results: SECTIONS, next_cursor: null });
    if (url.pathname.endsWith("/tasks/filter")) {
      const q = url.searchParams.get("query");
      // Two pages for Today, to exercise the cursor loop.
      if (q === "today | overdue") {
        return url.searchParams.get("cursor") === "p2"
          ? json({ results: TODAY.slice(2), next_cursor: null })
          : json({ results: TODAY.slice(0, 2), next_cursor: "p2" });
      }
      if (q === "@pin") return json({ results: TODAY.filter((t) => t.labels.includes("pin")), next_cursor: null });
      return json({ results: [], next_cursor: null });
    }
    if (url.pathname.endsWith("/sync")) {
      const commands = JSON.parse(new URLSearchParams(req.postData() ?? "").get("commands") ?? "[]");
      log.syncs.push(commands);
      const status = Object.fromEntries(
        commands.map((c) => [c.uuid, c.args.id === failUuidOf ? { error: "Item not found", error_code: 22 } : "ok"])
      );
      return json({ sync_status: status, temp_id_mapping: {} });
    }
    return route.fulfill({ status: 404, headers: cors });
  });
  return log;
}

test("app in a real browser", { skip: !chromium && "playwright not installed" }, async (t) => {
  const server = await serve();
  const URL = `http://127.0.0.1:${server.address().port}/index.html`;
  // CHROMIUM_PATH: a browser other than playwright's own, e.g. /opt/pw-browsers/chromium.
  const browser = process.env.CHROMIUM_PATH
    ? await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
    : await chromium.launch({ channel: "chrome" }).catch(() => chromium.launch());
  t.after(async () => {
    await browser.close();
    server.closeAllConnections();
    server.close();
  });

  const ok = (name, cond, extra = "") => t.test(name, () => assert.ok(cond, extra || name));

  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(5000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && !m.text().includes("401") && errors.push(m.text()));
  const api = await fakeTodoist(page, { failUuidOf: "t4" });

  const verb = (name) => page.locator(".verbs .verb", { hasText: name }).first();
  const content = () => page.locator(".card .content").innerText();
  const count = () => page.locator(".progress .count").innerText();
  const tick = () => page.waitForTimeout(60);

  await page.goto(URL, { waitUntil: "networkidle" });

  // --- setup -----------------------------------------------------------------
  await ok("no token: setup shows", await page.locator("ttr-setup").isVisible());
  await page.fill("input[name=token]", "bad-token");
  await page.click("text=save & test");
  await page.locator("ttr-setup .error").waitFor();
  await ok("a bad token fails the test call", (await page.locator("ttr-setup .error").innerText()).includes("rejected"));
  await page.fill("input[name=token]", "good-token");
  await page.click("text=save & test");
  await page.locator("ttr-setup .applied").waitFor();
  await ok("a good token passes", (await page.locator("ttr-setup .applied").innerText()).includes("connected"));
  await ok("token stored under the app namespace", (await page.evaluate((k) => localStorage.getItem(k), `${appNs}:token`)) === "good-token");
  await page.click("text=go");

  // --- picker ------------------------------------------------------------------
  await page.locator(".target-count", { hasText: "4" }).waitFor();
  const counts = await page.locator(".target-count").allInnerTexts();
  await ok("picker counts every target (cursor followed)", counts.join(",") === "4,1,0", counts.join(","));

  // --- triage ------------------------------------------------------------------
  const before = api.syncs.length;
  await page.locator(".target", { hasText: "Today" }).click();
  await page.locator(".card").waitFor();
  await ok("overdue card first", (await content()) === "Email the school", await content());
  await ok("markdown links show as text", !(await content()).includes("]("));
  await ok("overdue badge", (await page.locator(".badge.late").innerText()) === "overdue 3d");
  await ok("first line of description", (await page.locator(".card .desc").innerText()) === "about the IEP meeting");
  await ok("progress", (await count()) === "1 / 4");

  await verb("Date").click();
  await ok("Date opens buckets", (await page.locator(".tray .verb").allInnerTexts()).join(" ") === "+1w +2w +1mo +3mo");
  await page.locator(".tray .verb", { hasText: "+2w" }).click();
  await tick();
  await ok("a bucket decides and advances", (await count()) === "2 / 4");
  await ok("where: project / section", (await page.locator(".card .where").innerText()) === "Home / Chores");

  await verb("Agenda").click();
  await ok("Agenda shows its sections in order", (await page.locator(".tray .verb").allInnerTexts()).join(" ") === "Laura School");
  await page.locator(".tray .verb", { hasText: "Laura" }).click();
  await tick();

  // recurring
  await ok("recurring badge", await page.locator(".badge.recur").isVisible());
  const rverbs = await page.locator(".verbs .verb").allInnerTexts();
  await ok("recurring: no Date/Tomorrow, Done (this one), Kill series", rverbs.join("|") === "Agenda|Done (this one)|Kill series", rverbs.join("|"));
  await verb("Kill series").click();
  await ok("Kill series asks first", (await count()) === "3 / 4" && (await verb("tap again").isVisible()));
  await page.click("text=skip ›");
  await tick();
  await ok("skip advances", (await count()) === "4 / 4");

  await verb("Done").click();
  await tick();
  await ok("last card leads to the summary", await page.locator(".summary").isVisible());
  await ok("no network during triage", api.syncs.length === before);

  // undo walks back
  await page.click("text=↶ undo");
  await page.click("text=↶ undo");
  await tick();
  await ok("undo walks back through skips", (await content()) === "Water plants");
  await page.click("text=↶ undo");
  await page.click("text=↶ undo");
  await tick();
  await ok("undo walks back to the first card", (await content()) === "Email the school" && (await count()) === "1 / 4");
  await ok("undo disabled at the start", await page.locator("text=↶ undo").isDisabled());

  // redo it: Date +1w, Agenda Laura, Done (this one), Done
  await verb("Date").click();
  await page.locator(".tray .verb", { hasText: "+1w" }).click();
  await verb("Agenda").click();
  await page.locator(".tray .verb", { hasText: "Laura" }).click();
  await verb("Done (this one)").click();
  await verb("Done").click();
  await tick();

  const groups = await page.locator(".summary h3").allInnerTexts();
  await ok("summary groups by verb", groups.join("|") === "Date +1w (1)|Agenda → Laura (1)|Done (this one) (1)|Done (1)", groups.join("|"));
  await page.locator(".drop", { hasText: "Water plants" }).click();
  await tick();
  await ok("tapping a row drops it", !(await page.locator(".drop", { hasText: "Water plants" }).count()));
  await ok("apply count", (await page.locator(".verb.apply").innerText()) === "Apply 3 changes");

  // --- start over ----------------------------------------------------------------
  // (checked on a copy of the flow below, after apply; here: the confirm text)

  // --- apply ---------------------------------------------------------------------
  await page.click(".verb.apply");
  await page.locator(".summary .applied").waitFor();
  await ok("one sync request", api.syncs.length === before + 1, `${api.syncs.length - before}`);
  const sent = api.syncs.at(-1).map((c) => `${c.type}:${c.args.id}:${JSON.stringify("due" in c.args ? c.args.due : c.args.section_id ?? "")}`);
  await ok(
    "commands in order",
    sent.join(" ") === `item_update:t3:{"date":"${day(7)}"} item_move:t1:"sLaura" item_update:t1:null item_close:t4:""`,
    sent.join(" ")
  );
  await ok("every command has a uuid", api.syncs.at(-1).every((c) => /^[0-9a-f-]{36}$/.test(c.uuid)));
  await ok("applied count", (await page.locator(".summary .applied").innerText()) === "✓ 2 applied");
  await ok("failure named with reason", (await page.locator(".failed").innerText()).includes("Renew passport") && (await page.locator(".failed").innerText()).includes("Item not found"));

  // --- start over / back ask first ------------------------------------------------
  await page.click("text=again");
  await page.locator(".card").waitFor();
  await page.click("text=skip ›");
  await page.click("text=start over");
  await ok("start over asks first", await page.locator("text=discard 1 decisions?").isVisible());
  await page.click("text=discard 1 decisions?");
  await page.locator(".card").waitFor();
  await ok("start over refetches from the top", (await count()) === "1 / 4");
  await page.click("text=skip ›");
  await page.click("text=‹ targets");
  await page.click("text=discard 1?");
  await ok("back to targets", await page.locator("ttr-picker").isVisible());
  await ok("start over sent nothing", api.syncs.length === before + 1);

  // --- pins: unpin --------------------------------------------------------------
  await page.locator(".target", { hasText: "Pins" }).click();
  await page.locator(".card").waitFor();
  await ok("Pins verbs", (await page.locator(".verbs .verb").allInnerTexts()).join("|") === "Unpin|Date|Agenda|Done");
  await verb("Unpin").click();
  await page.click(".verb.apply");
  await page.locator(".summary .applied").waitFor();
  const unpin = api.syncs.at(-1)[0];
  await ok("unpin keeps the other labels", unpin.type === "item_update" && JSON.stringify(unpin.args.labels) === "[]");
  await page.click("text=targets");

  // --- empty target --------------------------------------------------------------
  await page.locator(".target", { hasText: "Inbox" }).click();
  await page.locator(".summary").waitFor();
  await ok("empty target says so", (await page.locator(".summary").innerText()).includes("Nothing in Inbox"));
  await page.click(".controls >> text=done");

  // --- theme ---------------------------------------------------------------------
  await page.click("#settings-btn");
  await page.click('[data-set-theme="paper"]');
  await ok("theme applies", (await page.getAttribute("html", "data-theme")) === "paper");
  await page.click('[data-set-theme="ddr"]');
  await page.click("#settings-close");
  await page.locator(".target", { hasText: "Today" }).click();
  await page.locator(".card").waitFor();
  await page.click("text=skip ›");
  await ok("ddr: a decision flashes its judgement", (await page.locator(".judge-word").innerText()) === "BOO");
  await page.click("text=start over");
  await page.click("text=discard 1 decisions?");
  await page.click("text=‹ targets");
  await page.click("#settings-btn");
  await page.click('[data-set-theme="dusk"]');
  await page.click("#settings-close");
  await page.locator(".target", { hasText: "Today" }).click();
  await page.locator(".card").waitFor();
  await page.click("text=skip ›");
  await ok("other themes hide it", !(await page.locator(".judge").isVisible()));
  await page.click("text=‹ targets");
  await page.click("text=discard 1?");

  // --- config --------------------------------------------------------------------
  await page.click("#settings-btn");
  await page.fill("#config-text", '{"watchBuckets": ["+1mo", "+6mo"], "dateBuckets": ["+soon"]}');
  await page.click("#config-save");
  await ok("bad config refused", (await page.locator("#config-note").innerText()).includes("bad bucket"));
  await page.fill("#config-text", '{"watchBuckets": ["+1mo", "+6mo"]}');
  await page.click("#config-save");
  await ok("config saved", (await page.locator("#config-note").innerText()) === "saved");
  await page.click("#settings-close");

  // --- offline ------------------------------------------------------------------
  const swState = await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    return (await navigator.serviceWorker.getRegistration())?.active ? "active" : "none";
  });
  await ok("service worker activates", swState === "active", swState);
  await ctx.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  await ok("app shell loads offline", await page.locator("ttr-picker .target").first().isVisible());
  await ctx.setOffline(false);

  await ok("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
});
