import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium, launch, serve } from "./harness.mjs";

test("erase all data, in a real browser", { skip: !chromium && "playwright not installed" }, async (t) => {
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
    localStorage.setItem("other-app:keep", "1");
    localStorage.setItem("forgotodo:theme", "akihabara");
    // Enough rows that the list lies under every desktop icon.
    const filler = Array.from({ length: 30 }, (_, i) => ({ id: "f" + i, text: "filler " + i, done: false }));
    localStorage.setItem("forgotodo:lists:records", JSON.stringify([
      { id: "L", name: "Unfiled", createdAt: 0, updatedAt: 0, items: [{ id: "a", text: "mine", done: false }, ...filler] },
    ]));
    localStorage.setItem("forgotodo:lists:activeId", "L");
  });
  await page.goto(URL, { waitUntil: "networkidle" });
  // Hold Recycle until it fires, then let go: the release lands over the list.
  const holdRecycle = async (/** @type {number} */ ms) => {
    await page.click("#title-btn");
    await page.hover('[data-cmd="recycle"]');
    await page.mouse.down();
    await page.waitForTimeout(ms);
  };
  const openErase = async () => {
    await holdRecycle(2200);
    await page.mouse.up();
  };
  const answer = (v) => page.click(`#alert-dialog button[value="${v}"]`);

  // A hold command that opens no dialog: the release lands right on the list.
  await page.evaluate(() => (/** @type {HTMLElement} */ (document.querySelector('[data-cmd="sweep"]')).dataset.holdCmd = "none"));
  await page.click("#title-btn");
  const box = await page.locator('[data-cmd="sweep"]').boundingBox();
  const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(2200);
  await ok("a fired hold closes the desktop over a row",
    (await page.locator("#desktop").isHidden()) && (await page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest(".checklist li"), [x, y])));
  await page.mouse.up();
  await page.waitForTimeout(60);
  await ok("and the release ticks nothing", (await page.locator(".checklist li.done").count()) === 0);
  await page.click(".checklist li span");
  await page.waitForTimeout(60);
  await ok("the next tap ticks as usual", (await page.locator(".checklist li.done").count()) === 1);
  await page.click(".checklist li.done span");
  await page.waitForTimeout(60);

  await holdRecycle(1000);
  await ok("holding shakes the icon", (await page.getAttribute('[data-cmd="recycle"]', "data-holding")) === "" &&
    (await page.locator('[data-cmd="recycle"] .icon').evaluate((el) => getComputedStyle(el).animationName)) === "anxious");
  await page.mouse.up();
  await page.waitForTimeout(60);
  await page.click('#alert-dialog button[value="ok"]');
  await page.emulateMedia({ reducedMotion: "reduce" });
  await holdRecycle(1000);
  await ok("reduced motion: held, but no shake",
    (await page.getAttribute('[data-cmd="recycle"]', "data-holding")) === "" &&
    (await page.locator('[data-cmd="recycle"] .icon').evaluate((el) => getComputedStyle(el).animationName)) === "none");
  await page.mouse.up();
  await page.waitForTimeout(60);
  await ok("a short hold is just Recycle", (await page.locator("#alert-title").innerText()) === "Recycle");
  await answer("ok");

  await openErase();
  await ok("a full hold asks to erase, and the release ticks nothing",
    (await page.locator("#alert-title").innerText()) === "Erase" && (await page.locator(".checklist li.done").count()) === 0);
  await answer("ok");
  await answer("cancel");
  await ok("cancelling any confirm keeps everything",
    (await page.locator(".checklist li").allInnerTexts()).join().includes("mine"));

  await openErase();
  await answer("ok");
  await answer("ok");
  await Promise.all([page.waitForEvent("load"), answer("ok")]);
  await page.waitForTimeout(120);
  await ok("three OKs erase and start a first run",
    (await page.locator("#about-dialog").isVisible()) && (await page.locator(".checklist li").count()) > 0 &&
      (await page.getAttribute("html", "data-theme")) === "palo-alto");
  await ok("other apps' keys survive", (await page.evaluate(() => localStorage.getItem("other-app:keep"))) === "1");
});
