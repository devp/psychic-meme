import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium, launch, serve } from "./harness.mjs";

test("catch-up and legacy options, in a real browser", { skip: !chromium && "playwright not installed" }, async (t) => {
  const browser = await launch();
  const server = await serve();
  const URL = `http://127.0.0.1:${server.address().port}/index.html`;
  t.after(async () => {
    await browser.close();
    server.closeAllConnections();
    server.close();
  });
  const ok = (name, cond, extra = "") => t.test(name, () => assert.ok(cond, extra || name));

  const page = await (await browser.newContext({ serviceWorkers: "block" })).newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.clock.install({ time: new Date(2026, 8, 27, 12, 0) });
  await page.addInitScript(() => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("forgotodo:theme", "backlight");
    localStorage.setItem("forgotodo:lists:records", JSON.stringify([
      { id: "L", name: "Unfiled", createdAt: 0, updatedAt: 0, items: [
        { id: "a", text: "call mom!", done: false, seenDay: "2026-09-27" },
        { id: "b", text: "done today", done: true, doneDay: "2026-09-27" },
      ] },
    ]));
    localStorage.setItem("forgotodo:lists:activeId", "L");
  });
  await page.goto(URL, { waitUntil: "networkidle" });
  const texts = () => page.locator(".checklist li span").allInnerTexts();

  await ok("old backlight theme becomes palo alto with the backlight on",
    (await page.getAttribute("html", "data-theme")) === "palo-alto" && (await page.getAttribute("html", "data-scheme")) === "dark");
  await ok("and the migration is saved",
    (await page.evaluate(() => [localStorage.getItem("forgotodo:theme"), localStorage.getItem("forgotodo:mode")].join())) === "palo-alto,dark");
  await ok("nothing decays the same day", JSON.stringify(await texts()) === JSON.stringify(["call mom!", "done today"]));

  await page.clock.setSystemTime(new Date(2026, 8, 28, 9, 0));
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await page.waitForTimeout(60);
  await ok("coming back the next day catches up", JSON.stringify(await texts()) === JSON.stringify(["call mom"]), JSON.stringify(await texts()));

  await ok("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
});
