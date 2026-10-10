import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { chromium, launch, serve, overrides, root } from "./harness.mjs";

test("an update reload on resume, with a day's catch-up, in a real browser", { skip: !chromium && "playwright not installed" }, async (t) => {
  const browser = await launch();
  const server = await serve();
  const URL = `http://127.0.0.1:${server.address().port}/index.html`;
  t.after(async () => {
    overrides.clear();
    await browser.close();
    server.closeAllConnections();
    server.close();
  });
  const ok = (name, cond, extra = "") => t.test(name, () => assert.ok(cond, extra || name));

  const page = await (await browser.newContext()).newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.addInitScript(() => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    const d = new Date();
    const pad = (/** @type {number} */ n) => String(n).padStart(2, "0");
    const today = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    localStorage.setItem("forgotodo:lists:records", JSON.stringify([
      { id: "L", name: "Unfiled", createdAt: 0, updatedAt: 0, items: [
        { id: "a", text: "call mom!!", done: false, seenDay: today },
        { id: "b", text: "done today", done: true, doneDay: today },
      ] },
    ]));
    localStorage.setItem("forgotodo:lists:activeId", "L");
  });
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.evaluate(() => navigator.serviceWorker.ready);
  const texts = () => page.locator(".checklist li span").allInnerTexts();
  const resume = () =>
    page.evaluate(() => {
      for (const state of ["hidden", "visible"]) {
        Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
        document.dispatchEvent(new Event("visibilitychange"));
      }
    });
  const nextUpdate = (/** @type {number} */ ms) =>
    page.evaluate(
      (ms) =>
        new Promise((resolve) => {
          navigator.serviceWorker.addEventListener("message", (e) => resolve(e.data), { once: true });
          setTimeout(() => resolve("none"), ms);
        }),
      ms
    );

  // Let the launch check settle, then deploy.
  let heard = nextUpdate(1500);
  await resume();
  await heard;
  overrides.set("/app.css", (await readFile(join(root, "app.css"), "utf8")) + "\n/* deployed */\n");
  heard = nextUpdate(5000);
  await resume();
  await ok("an update is pending", (await heard) === "updated");

  // The next resume is also the next day: catch-up and the reload both run.
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  await page.clock.setFixedTime(tomorrow);
  await Promise.all([page.waitForEvent("load"), resume()]);
  await page.waitForTimeout(100);
  await ok("one day of catch-up, applied once across the reload",
    JSON.stringify(await texts()) === JSON.stringify(["call mom!"]), JSON.stringify(await texts()));
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(100);
  await ok("and stable after another launch the same day",
    JSON.stringify(await texts()) === JSON.stringify(["call mom!"]), JSON.stringify(await texts()));
  await ok("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
});
