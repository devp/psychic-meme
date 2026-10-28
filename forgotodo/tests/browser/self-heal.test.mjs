import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { chromium, launch, serve, overrides, root } from "./harness.mjs";

// A deploy whose app.js throws before <update-toast> runs can't ask the worker
// for its own fix. The worker checks on every navigation anyway, so the next
// deploy still lands.
test("a broken deploy heals on the next launch, in a real browser", { skip: !chromium && "playwright not installed" }, async (t) => {
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
  const rows = () => page.locator(".checklist li").count();
  // Wait for the worker's cache to hold app.js with (or without) `marker`.
  const cached = (/** @type {string} */ marker, /** @type {boolean} */ want) =>
    page.waitForFunction(
      async ([marker, want]) => {
        for (const name of await caches.keys()) {
          const hit = await (await caches.open(name)).match("app.js");
          if (hit) return (await hit.text()).includes(marker) === want;
        }
        return false;
      },
      [marker, want],
      { polling: 100, timeout: 10000 }
    );

  await page.goto(URL, { waitUntil: "networkidle" });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await ok("starts working", (await rows()) > 0);

  // Deploy an app.js that fails to load, like a stale import.
  const good = await readFile(join(root, "app.js"), "utf8");
  overrides.set("/app.js", 'import { gone } from "./state.js";\n' + good);
  await page.reload({ waitUntil: "networkidle" });
  await cached("gone", true);
  errors.length = 0;
  await page.reload({ waitUntil: "networkidle" });
  await ok("the broken deploy is running", (await rows()) === 0 && errors.length > 0, errors.join(" | "));

  // Deploy the fix. Launching the broken app is enough to fetch it...
  overrides.delete("/app.js");
  await page.reload({ waitUntil: "networkidle" });
  await cached("gone", false);
  // ...and the launch after that runs it.
  errors.length = 0;
  await page.reload({ waitUntil: "networkidle" });
  await ok("the fix is running", (await rows()) > 0);
  await ok("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
});
