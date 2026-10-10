import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium, launch, serve } from "./harness.mjs";

test("organize and shrink to fit, in a real browser", { skip: !chromium && "playwright not installed" }, async (t) => {
  const browser = await launch();
  const server = await serve();
  const URL = `http://127.0.0.1:${server.address().port}/index.html`;
  t.after(async () => {
    await browser.close();
    server.closeAllConnections();
    server.close();
  });
  const ok = (name, cond, extra = "") => t.test(name, () => assert.ok(cond, extra || name));

  const page = await (await browser.newContext({ serviceWorkers: "block", viewport: { width: 390, height: 844 } })).newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.addInitScript(() => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("forgotodo:fit", "off");
    const d = new Date();
    const pad = (/** @type {number} */ n) => String(n).padStart(2, "0");
    const today = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const items = [
      { id: "a", text: "keep!", done: false, seenDay: today },
      { id: "b", text: "meh??", done: false, seenDay: today },
      { id: "c", text: "whatever??", done: false, seenDay: today },
      { id: "e", text: "maybe?", done: false, seenDay: today },
      { id: "d", text: "did it", done: true, doneDay: today },
    ];
    localStorage.setItem("forgotodo:lists:records", JSON.stringify([
      { id: "L", name: "Unfiled", createdAt: 0, updatedAt: 0, items },
    ]));
    localStorage.setItem("forgotodo:lists:activeId", "L");
  });
  await page.goto(URL, { waitUntil: "networkidle" });
  const texts = () => page.locator(".checklist li span").allInnerTexts();
  const run = async (/** @type {string} */ cmd) => {
    await page.click("#title-btn");
    await page.click(`[data-cmd="${cmd}"]`);
    await page.waitForTimeout(60);
  };

  const count = () => page.locator("forgo-checklist .count").innerText();
  const okBtn = () => page.click('#alert-dialog button[value="ok"]');
  // Forget writes once its rows have puffed away; wait for that, not a clock.
  const poofed = async () => {
    await page.waitForFunction(() => !document.querySelector('[data-anim="poof"]'));
    await page.waitForTimeout(60);
  };
  // Forget and Remember ask how many, or what; Enter answers.
  const pick = async (/** @type {string} */ cmd, query = "") => {
    await run(cmd);
    await page.fill("#pick-text", query);
    await page.press("#pick-text", "Enter");
    await page.waitForTimeout(60);
  };
  const same = (/** @type {string[]} */ a, /** @type {string[]} */ b) => JSON.stringify(a) === JSON.stringify(b);

  await ok("forgotten to-dos are hidden but counted",
    same(await texts(), ["keep!", "did it", "maybe?"]) && (await count()) === "1 of 5 done · 2 forgotten");

  // --- sweep: the forgotten ------------------------------------------------
  await run("sweep");
  await ok("sweep shows the forgotten first",
    (await page.locator("#alert-list li").allInnerTexts()).join() === "meh??,whatever??");
  await page.click('#alert-dialog button[value="cancel"]');
  await page.waitForTimeout(60);
  await ok("cancel keeps them", (await count()) === "1 of 5 done · 2 forgotten");
  await run("sweep");
  await okBtn();
  await page.waitForTimeout(60);
  await ok("sweep deletes only the forgotten", same(await texts(), ["keep!", "did it", "maybe?"]) && (await count()) === "1 of 3 done");
  await run("sweep");
  await ok("nothing forgotten says so", (await page.locator("#alert-msg").innerText()) === "Nothing forgotten.");
  await ok("a notice has no cancel", await page.locator("#alert-cancel").isHidden());
  await okBtn();

  await run("recycle");
  await okBtn();
  await page.waitForTimeout(60);
  await ok("recycle deletes done items", same(await texts(), ["keep!", "maybe?"]));

  // --- forget / remember ---------------------------------------------------
  await pick("forget");
  await poofed();
  await ok("forget poofs the lowest tier away", same(await texts(), ["keep!"]) && (await count()) === "0 of 2 done · 1 forgotten");
  await pick("remember");
  await ok("remember brings it back at neutral", same(await texts(), ["keep!", "maybe"]));
  await ok("and it blinks", (await page.locator('li[data-anim="blink"]').count()) === 1);
  await pick("remember");
  await ok("nothing forgotten to remember says so", (await page.locator("#alert-msg").innerText()) === "Nothing's forgotten.");
  await okBtn();
  await pick("forget");
  await poofed();
  await pick("forget");
  await poofed();
  await ok("forget works up the tiers", same(await texts(), []) && (await count()) === "0 of 2 done · 2 forgotten");
  await pick("forget");
  await ok("nothing left to forget says so", (await page.locator("#alert-msg").innerText()) === "Nothing left to forget.");
  await okBtn();
  await run("forget");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(60);
  await ok("escape on the prompt does nothing", (await count()) === "0 of 2 done · 2 forgotten" && (await page.locator("#alert-dialog").isHidden()));
  await pick("remember", "MAY");
  await ok("remember by phrase, any case", same(await texts(), ["maybe"]));
  await pick("remember", "nope");
  await ok("no match says so", (await page.locator("#alert-msg").innerText()) === "Nothing matches “nope”.");
  await okBtn();
  await pick("forget", "2");
  await poofed();
  await ok("forget a number", same(await texts(), []));
  await pick("remember", "2");
  await ok("remember a number, both back", same((await texts()).sort(), ["keep", "maybe"]));

  // --- shake up: rig the dice ----------------------------------------------
  await page.evaluate(() => (Math.random = () => 0.5));
  await run("shake");
  await ok("shake up moves each to-do (all up, on these dice)", same((await texts()).sort(), ["keep!", "maybe!"]));
  await ok("and sums it up", (await count()) === "2 up · 0 down");

  // --- fast forward --------------------------------------------------------
  await page.locator(".checklist li", { hasText: "maybe!" }).locator("input[type=checkbox]").check();
  await page.waitForTimeout(60);
  await run("fastforward");
  await ok("fast forward says what tomorrow brings",
    (await page.locator("#alert-msg").innerText()) === "Tomorrow's list, today: 1 to-do drop a tier, 1 done cleared. Go ahead?");
  await okBtn();
  await page.waitForTimeout(60);
  await ok("and then it's tomorrow", same(await texts(), ["keep"]));

  // --- edit ----------------------------------------------------------------
  await run("edit");
  await ok("edit arms: the tab says what's next", (await page.locator("#title-btn").innerText()) === "Edit: tap a to-do");
  await page.click(".checklist li span");
  await ok("tapping a row opens it, without ticking it",
    (await page.locator(".edit-field").isVisible()) && !(await page.locator(".checklist li input[type=checkbox]").count()));
  await page.fill(".edit-field", "keep going!");
  await page.press(".edit-field", "Enter");
  await page.waitForTimeout(60);
  await ok("enter saves the edit", same(await texts(), ["keep going!"]) && (await page.locator("#title-btn").innerText()) === "To Do List");
  await run("edit");
  await page.click("#title-btn");
  await ok("tapping the tab cancels edit mode",
    (await page.locator("#title-btn").innerText()) === "To Do List" && (await page.locator("#desktop").isHidden()));
  await page.click(".checklist li span");
  await page.waitForTimeout(60);
  await ok("and taps tick again", (await page.locator(".checklist li.done").count()) === 1);
  await page.click(".checklist li span");

  // --- typing ?? files it straight away ------------------------------------
  await page.fill(".add-row input", "someday maybe??");
  await page.press(".add-row input", "Enter");
  await page.waitForTimeout(60);
  await ok("?? files it away, with a word", same(await texts(), ["keep going!"]) && (await count()) === "Filed away, forgotten.");

  // --- snooze: > hides it for a day each ---------------------------------
  await page.fill(".add-row input", "later>>");
  await page.press(".add-row input", "Enter");
  await page.waitForTimeout(60);
  await ok(">> snoozes it, with a word", same(await texts(), ["keep going!"]) && (await count()) === "Snoozed for 2 days.");
  await run("lookahead");
  await ok("look ahead lists the snoozed",
    (await page.locator("#alert-list li").allInnerTexts()).join() === "later>>" && (await page.locator("#alert-cancel").isHidden()));
  await okBtn();
  await run("fastforward");
  await ok("fast forward counts the snooze apart",
    (await page.locator("#alert-msg").innerText()) === "Tomorrow's list, today: 1 to-do drop a tier, 1 snoozed a day closer. Go ahead?");
  await okBtn();
  await page.waitForTimeout(3100);
  await ok("still asleep, still counted", same(await texts(), ["keep going"]) && (await count()) === "0 of 3 done · 1 forgotten · 1 snoozed");

  // --- shrink to fit -----------------------------------------------------
  const size = () => page.locator(".checklist").evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  await ok("normal size with fit off", (await size()) === 15);
  await page.evaluate(() => localStorage.setItem("forgotodo:fit", "on"));
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(100);
  const one = await size();
  await ok("big with a short list", one === 28, String(one));
  for (let i = 0; i < 8; i++) {
    await page.fill(".add-row input", "task number " + i);
    await page.press(".add-row input", "Enter");
  }
  await page.locator(".add-row input").blur();
  await page.waitForTimeout(100);
  const nine = await size();
  await ok("smaller as it grows", nine < one && nine >= 15, String(nine));
  for (let i = 8; i < 40; i++) {
    await page.fill(".add-row input", "task number " + i);
    await page.press(".add-row input", "Enter");
  }
  await page.locator(".add-row input").blur();
  await page.waitForTimeout(100);
  const many = await size();
  const fits = await page.locator('[data-panel="list"]').evaluate((el) => el.scrollHeight <= el.clientHeight);
  await ok("shrinks further to fit", many < 15 && (fits || many === 10), `${many}px, fits: ${fits}`);

  // --- reduced motion: Forget doesn't wait on a poof -------------------------
  await page.emulateMedia({ reducedMotion: "reduce" });
  const before = await page.locator(".checklist li").count();
  await pick("forget");
  await ok("reduced motion: forget is immediate", (await page.locator(".checklist li").count()) === before - 1);
  await pick("remember");
  await ok("reduced motion: remember doesn't blink", (await page.locator('li[data-anim="blink"]').count()) === 0);
  await page.emulateMedia({ reducedMotion: "no-preference" });

  // --- Blink changes off: Remember doesn't blink ------------------------------
  await page.click("#title-btn");
  await page.click('[data-cmd="prefs"]');
  await page.click('[data-toggle="flash"]');
  await page.click("#settings-close");
  await ok("blink toggle off", (await page.getAttribute("html", "data-flash")) === "off");
  await pick("forget");
  await poofed();
  await pick("remember");
  await ok("blink off: remember doesn't blink", (await page.locator('li[data-anim="blink"]').count()) === 0);

  await ok("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
});
