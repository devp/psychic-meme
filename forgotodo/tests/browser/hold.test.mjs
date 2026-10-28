import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium, launch, serve } from "./harness.mjs";

test("desktop hold commands, in a real browser", { skip: !chromium && "playwright not installed" }, async (t) => {
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
    localStorage.setItem("forgotodo:lists:records", JSON.stringify([
      { id: "L", name: "Unfiled", createdAt: 0, updatedAt: 0, items: [{ id: "a", text: "mine", done: false }] },
    ]));
    localStorage.setItem("forgotodo:lists:activeId", "L");
  });
  await page.goto(URL, { waitUntil: "networkidle" });
  const hold = async (/** @type {string} */ cmd) => {
    await page.click("#title-btn");
    await page.hover(`[data-cmd="${cmd}"]`);
    await page.mouse.down();
    await page.waitForTimeout(2200);
    await page.mouse.up();
    await page.waitForTimeout(60);
  };

  // Random, so hold a few times: it never lands on the theme it left.
  const themes = [await page.getAttribute("html", "data-theme")];
  for (let i = 0; i < 6; i++) {
    await hold("themes");
    themes.push(await page.getAttribute("html", "data-theme"));
  }
  await ok("hold Themes always changes theme", themes.every((v, i) => i === 0 || v !== themes[i - 1]), themes.join(" > "));
  await ok("hold Themes opens no dialog", !(await page.locator("#themes-dialog").isVisible()));
  await ok("hold Themes picks its font too", await page.evaluate(() => {
    const root = document.documentElement;
    const tf = document.querySelector(`[data-set-theme="${root.dataset.theme}"]`)?.getAttribute("data-theme-font");
    return !tf || tf === root.dataset.font;
  }));

  // Stored order: the list shows by priority, and the tutorial's first is a !!!.
  const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem("forgotodo:lists:records") ?? "[]")[0].items.map((i) => i.text));
  await hold("help");
  const texts = await stored();
  await ok("hold Help appends the tutorial after the list",
    texts[0] === "mine" && texts[1]?.startsWith("Welcome to forgotodo"), texts.join(" | "));
  await ok("hold Help opens no dialog", !(await page.locator("#help-dialog").isVisible()));
});
