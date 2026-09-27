import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const script = new URL("../scripts/warnings.sh", import.meta.url).pathname;
const repo = new URL("..", import.meta.url).pathname;

/** @param {Record<string, string>} files */
function fixture(files) {
  const dir = mkdtempSync(join(tmpdir(), "warnings-"));
  for (const [name, body] of Object.entries(files)) {
    mkdirSync(join(dir, name, ".."), { recursive: true });
    writeFileSync(join(dir, name), body);
  }
  return dir;
}

test("every rule fires on a fixture full of footguns", () => {
  const dir = fixture({
    "index.html": '<script type="importmap">{"imports":{"lit":"./x.js"}}</script>\n<my-widget></my-widget>\n',
    "app.js": [
      'import { x } from "unmapped-pkg";',
      'localStorage.getItem("a");',
      'el.innerHTML = "<b>x</b>";',
      "await Promise.resolve();",
      'window.addEventListener("load", () => {});',
      "// warn-ok: innerhtml-assign",
      'ok.innerHTML = "";',
    ].join("\n"),
    "components/w.js": [
      "class W {",
      "  static properties = { record: {} };",
      "  record = null;",
      "  connectedCallback() { store.subscribe(() => {}); }",
      "}",
    ].join("\n"),
    "style.css": "body { height: 100vh; }\ninput { font-size: 14px; }\n",
    "sw.js": 'importScripts("missing.js");\n',
    "precache-manifest.js": 'self.__PRECACHE = [\n  {\n    "url": "app.js",\n    "revision": "stale"\n  }\n];\n',
  });
  const r = spawnSync(script, ["--strict", dir], { encoding: "utf8" });
  assert.equal(r.status, 1);
  for (const rule of [
    "precache-stale",
    "import-script-missing",
    "element-undefined",
    "bare-import-unmapped",
    "class-field-shadow",
    "subscribe-no-teardown",
    "localstorage-direct",
    "innerhtml-assign",
    "load-after-await",
    "shell-100vh",
    "input-font-size",
  ]) {
    assert.match(r.stdout, new RegExp(`warn\\[${rule}\\]`), rule);
  }
  assert.equal(r.stdout.match(/warn\[innerhtml-assign\]/g)?.length, 1, "warn-ok suppresses");
});

test("the starter itself is clean under --strict", () => {
  const out = execFileSync(script, ["--strict", repo], { encoding: "utf8" });
  assert.match(out, /warnings: 0/);
});
