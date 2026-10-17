import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium, launch, serve } from "./harness.mjs";

// A remoteStorage stand-in at https://storage.test, routed in the page.
test("sync, in a real browser", { skip: !chromium && "playwright not installed" }, async (t) => {
  const browser = await launch();
  const server = await serve();
  const URL = `http://127.0.0.1:${server.address().port}/index.html`;
  t.after(async () => {
    await browser.close();
    server.closeAllConnections();
    server.close();
  });
  const ok = (name, cond, extra = "") => t.test(name, () => assert.ok(cond, extra || name));

  let remote = { etag: '"v2"', body: JSON.stringify({ name: "Unfiled", items: [{ id: "x", text: "from the phone", done: false }] }) };
  const puts = [];
  const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET, PUT", "access-control-expose-headers": "ETag" };
  const context = await browser.newContext({ serviceWorkers: "block" });
  await context.route("https://storage.test/**", async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    if (req.method() === "PUT") {
      const h = await req.allHeaders();
      puts.push({ ifMatch: h["if-match"], body: req.postData() });
      if (h["if-match"] !== remote.etag) return route.fulfill({ status: 412, headers: cors });
      remote = { etag: `"p${puts.length}"`, body: req.postData() ?? "" };
      return route.fulfill({ status: 200, headers: { ...cors, etag: remote.etag } });
    }
    return route.fulfill({ status: 200, headers: { ...cors, etag: remote.etag, "content-type": "application/json" }, body: remote.body });
  });

  const page = await context.newPage();
  await page.addInitScript(() => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("forgotodo:lists:records", JSON.stringify([
      { id: "L", name: "Unfiled", createdAt: 0, updatedAt: 0, items: [{ id: "a", text: "on the laptop", done: false }] },
    ]));
    localStorage.setItem("forgotodo:lists:activeId", "L");
    localStorage.setItem("forgotodo:remote", JSON.stringify({ address: "me@storage.test", href: "https://storage.test/me", authURL: "https://storage.test/auth", token: "t" }));
    localStorage.setItem("forgotodo:sync", JSON.stringify({ L: { base: '"v1"', dirty: false } }));
  });
  const texts = () => page.locator(".checklist li span").allInnerTexts();
  const sync = async () => {
    await page.click("#title-btn");
    await page.click('[data-cmd="sync"]');
  };

  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.querySelector(".checklist li span")?.textContent === "from the phone");
  await ok("opening pulls when clean", (await texts()).join() === "from the phone");

  await sync();
  await page.waitForFunction(() => document.querySelector(".count")?.textContent === "Already in sync.");
  await ok("nothing changed says so", puts.length === 0);

  await page.click(".checklist li input[type=checkbox]");
  await sync();
  await page.waitForFunction(() => document.querySelector(".count")?.textContent?.startsWith("Synced"));
  await ok("a change pushes, If-Match base", puts.length === 1 && puts[0].ifMatch === '"v2"' && JSON.parse(puts[0].body).items[0].done === true);

  // The phone pushes; meanwhile this device changes too.
  remote = { etag: '"v9"', body: JSON.stringify({ items: [{ text: "phone again", done: false }] }) };
  await page.fill('.add-row input[name="text"]', "laptop again");
  await page.press('.add-row input[name="text"]', "Enter");
  await sync();
  await page.waitForSelector("#alert-dialog[open]");
  await ok("both changed asks, three ways",
    (await page.locator("#alert-dialog .dialog-buttons button:visible").allInnerTexts()).join() === "This device,Other device,Neither");
  await page.click('#alert-dialog button[value="cancel"]');
  await ok("Neither leaves the list alone", (await texts()).includes("laptop again") && puts.length === 1);

  await sync();
  await page.click('#alert-dialog button[value="other"]');
  await page.waitForFunction(() => document.querySelector(".checklist li span")?.textContent === "phone again");
  await ok("Other device pulls", (await texts()).join() === "phone again");

  await page.click("#title-btn");
  await page.click('[data-cmd="sweep"]');
  await ok("other alerts are back to plain OK",
    (await page.locator("#alert-dialog .dialog-buttons button:visible").allInnerTexts()).join() === "OK");
  await page.click('#alert-dialog button[value="ok"]');

  // Hold Sync: Disconnect, after a confirm.
  const holdSync = async () => {
    await page.click("#title-btn");
    await page.hover('[data-cmd="sync"]');
    await page.mouse.down();
    await page.waitForTimeout(2200);
    await page.mouse.up();
  };
  await holdSync();
  await ok("holding Sync asks to disconnect",
    (await page.locator("#alert-title").innerText()) === "Disconnect" &&
      (await page.locator("#alert-msg").innerText()).includes("me@storage.test"));
  await page.click('#alert-dialog button[value="cancel"]');
  await ok("Cancel stays connected", (await page.evaluate(() => localStorage.getItem("forgotodo:remote"))) !== "");
  await holdSync();
  await page.click('#alert-dialog button[value="ok"]');
  await page.waitForFunction(() => document.querySelector(".count")?.textContent === "Disconnected.");
  const stored = await page.evaluate(() => [localStorage.getItem("forgotodo:remote"), localStorage.getItem("forgotodo:sync")]);
  await ok("Disconnect forgets the connection and the ledger", stored.join() === ",", stored.join());
  await ok("and keeps the list", (await texts()).join() === "phone again");

  await sync();
  await ok("unconnected, Sync asks for an address", await page.locator("#connect-dialog").isVisible());
  await page.click("#connect-cancel");
  await holdSync();
  await ok("unconnected, Disconnect says so", (await page.locator("#alert-msg").innerText()) === "Sync isn't connected.");
});
