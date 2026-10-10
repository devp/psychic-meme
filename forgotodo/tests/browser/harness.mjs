// Shared by the browser tests: one file per block, so node --test runs them in parallel.

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";

// Opt-in: skipped unless playwright is installed (`just dev-init-browser`).
export let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {}

// Installed Chrome; else Playwright's own (`node_modules/.bin/playwright install
// chromium`); else a Chromium the environment ships under
// PLAYWRIGHT_BROWSERS_PATH, as some cloud containers do. Call it before
// serve(): if no browser launches, the test fails rather than hanging on a
// server nobody closes.
export async function launch() {
  const tries = [() => chromium.launch({ channel: "chrome" }), () => chromium.launch()];
  const shipped = process.env.PLAYWRIGHT_BROWSERS_PATH && join(process.env.PLAYWRIGHT_BROWSERS_PATH, "chromium");
  if (shipped && existsSync(shipped)) tries.push(() => chromium.launch({ executablePath: shipped }));
  let error;
  for (const attempt of tries) {
    try {
      return await attempt();
    } catch (e) {
      error = e;
    }
  }
  throw error;
}

export const root = new URL("../..", import.meta.url).pathname;
const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
};

// Path (as requested, e.g. "/app.css") -> body to serve instead of the file,
// or a number to answer with that status. Stands in for a deploy.
export const overrides = new Map();

export function serve() {
  const server = createServer(async (req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname));
    const file = join(root, path === "/" ? "index.html" : path);
    const override = overrides.get(path);
    if (typeof override === "number") return void res.writeHead(override).end();
    if (override !== undefined) {
      res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
      return void res.end(override);
    }
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
