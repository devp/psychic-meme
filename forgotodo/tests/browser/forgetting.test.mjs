import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium, launch, serve } from "./harness.mjs";

test("forgetting, in a real browser", { skip: !chromium && "playwright not installed" }, async (t) => {
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
  await page.addInitScript(() => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    const key = (/** @type {number} */ daysAgo) => {
      const d = new Date();
      d.setDate(d.getDate() - daysAgo);
      const pad = (/** @type {number} */ n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    };
    const items = [
      { id: "a", text: "plain", done: false, seenDay: key(1) },
      { id: "b", text: "urgent!!!", done: false, seenDay: key(1) },
      { id: "c", text: "old news", done: true, doneDay: key(1) },
      { id: "d", text: "fresh done", done: true, doneDay: key(0) },
      { id: "e", text: "long gone!", done: false, seenDay: key(9) },
    ];
    localStorage.setItem("forgotodo:lists:records", JSON.stringify([
      { id: "L", name: "Unfiled", createdAt: 0, updatedAt: 0, items },
    ]));
    localStorage.setItem("forgotodo:lists:activeId", "L");
  });
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(100);

  const rows = await page.locator(".checklist li span").allInnerTexts();
  await ok("decays, purges, and sorts most to least urgent",
    JSON.stringify(rows) === JSON.stringify(["urgent!!", "fresh done", "plain?"]), JSON.stringify(rows));
  await ok("items with ! are marked urgent",
    (await page.locator(".checklist li.urgent span").allInnerTexts()).join() === "urgent!!");
  await ok("one day in, ? is faded", (await page.locator(".checklist li.faded").count()) === 1);
  await ok("nine days in, it's forgotten: hidden, but counted",
    (await page.locator("forgo-checklist .count").innerText()) === "1 of 4 done · 1 forgotten");

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(100);
  const again = await page.locator(".checklist li span").allInnerTexts();
  await ok("same day, no further decay", JSON.stringify(again) === JSON.stringify(rows), JSON.stringify(again));
});
