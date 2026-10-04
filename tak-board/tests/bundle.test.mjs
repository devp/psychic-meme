import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, mkdtempSync, copyFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;

test("committed tak-board.js matches a fresh build of src/", () => {
  const committed = readFileSync(join(root, "tak-board.js"), "utf8");
  const dir = mkdtempSync(join(tmpdir(), "tak-board-"));
  try {
    copyFileSync(join(root, "tak-board.js"), join(dir, "tak-board.js"));
    execFileSync(join(root, "scripts/build.sh"), { cwd: root, stdio: "pipe" });
    assert.equal(readFileSync(join(root, "tak-board.js"), "utf8"), committed, "run scripts/build.sh and commit tak-board.js");
  } finally {
    copyFileSync(join(dir, "tak-board.js"), join(root, "tak-board.js"));
    rmSync(dir, { recursive: true });
  }
});
