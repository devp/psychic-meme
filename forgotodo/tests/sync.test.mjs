import { test } from "node:test";
import assert from "node:assert/strict";
import { decide, syncLedger, syncList } from "../lib/sync.js";

test("decide: the button table", () => {
  assert.equal(decide({ base: "v1", dirty: false }, "v1"), "in-sync");
  assert.equal(decide({ base: "v1", dirty: false }, "v2"), "pull");
  assert.equal(decide({ base: "v1", dirty: true }, "v1"), "push");
  assert.equal(decide({ base: "v1", dirty: true }, "v2"), "ask");
});

test("decide: never synced counts as dirty; nothing remote is a push", () => {
  assert.equal(decide({ base: null, dirty: false }, "v1"), "ask");
  assert.equal(decide({ base: null, dirty: false }, null), "push");
  assert.equal(decide({ base: "v1", dirty: false }, null), "push");
});

/** A persistedValue stand-in. */
function value(v = "") {
  return { get: () => v, set: (/** @type {string} */ next) => void (v = next) };
}

test("syncLedger: per list, dirty until synced", () => {
  const ledger = syncLedger(value());
  assert.deepEqual(ledger.get("a"), { base: null, dirty: false });
  ledger.markDirty("a");
  ledger.synced("b", "v1");
  assert.deepEqual(ledger.get("a"), { base: null, dirty: true });
  assert.deepEqual(ledger.get("b"), { base: "v1", dirty: false });
  ledger.markDirty("b");
  ledger.synced("a", "v2");
  assert.deepEqual(ledger.get("a"), { base: "v2", dirty: false });
  assert.deepEqual(ledger.get("b"), { base: "v1", dirty: true });
  assert.deepEqual(syncLedger(value("not json")).get("a"), { base: null, dirty: false });
});

/**
 * One device's view: a remote holding at most one document, and a list.
 * @param {{ remote?: { body: string, etag: string } | null, state?: { base: string|null, dirty: boolean }, choice?: "this"|"other"|"neither", racePut?: boolean }} o
 */
function device({ remote = null, state = { base: null, dirty: false }, choice = "neither", racePut = false }) {
  const ledger = syncLedger(value());
  if (state.base) ledger.synced("L", state.base);
  if (state.dirty) ledger.markDirty("L");
  /** @type {{ ifMatch: string|null }[]} */
  const puts = [];
  /** @type {any[]} */
  const written = [];
  let asked = 0;
  let n = 1;
  const client = {
    get: async () => remote,
    put: async (/** @type {string} */ _path, /** @type {string} */ body, /** @type {{ ifMatch: string|null }} */ opts) => {
      puts.push(opts);
      if (racePut) return null;
      remote = { body, etag: `"p${n++}"` };
      return { etag: remote.etag };
    },
  };
  const opts = {
    client,
    ledger,
    id: "L",
    read: () => ({ name: "here", items: [{ text: "mine" }] }),
    write: (/** @type {any} */ doc) => written.push(doc),
    choose: async () => (asked++, choice),
  };
  return { opts, ledger, puts, written, asked: () => asked, remote: () => remote };
}

const theirs = { body: JSON.stringify({ name: "there", items: [{ text: "theirs" }] }), etag: '"v2"' };

test("syncList: clean and current says so, touches nothing", async () => {
  const d = device({ remote: { ...theirs, etag: '"v1"' }, state: { base: '"v1"', dirty: false } });
  assert.equal(await syncList(d.opts), "in-sync");
  assert.equal(d.puts.length + d.written.length, 0);
});

test("syncList: clean and behind pulls", async () => {
  const d = device({ remote: theirs, state: { base: '"v1"', dirty: false } });
  assert.equal(await syncList(d.opts), "pulled");
  assert.deepEqual(d.written[0].items, [{ text: "theirs" }]);
  assert.deepEqual(d.ledger.get("L"), { base: '"v2"', dirty: false });
});

test("syncList: dirty and current pushes If-Match base", async () => {
  const d = device({ remote: { ...theirs, etag: '"v1"' }, state: { base: '"v1"', dirty: true } });
  assert.equal(await syncList(d.opts), "pushed");
  assert.deepEqual(d.puts, [{ ifMatch: '"v1"' }]);
  assert.deepEqual(JSON.parse(d.remote()?.body ?? ""), { name: "here", items: [{ text: "mine" }] });
  assert.deepEqual(d.ledger.get("L"), { base: '"p1"', dirty: false });
});

test("syncList: first device creates the document", async () => {
  const d = device({});
  assert.equal(await syncList(d.opts), "pushed");
  assert.deepEqual(d.puts, [{ ifMatch: null }]);
});

test("syncList: both changed asks; This device pushes over the remote's version", async () => {
  const d = device({ remote: theirs, state: { base: '"v1"', dirty: true }, choice: "this" });
  assert.equal(await syncList(d.opts), "pushed");
  assert.equal(d.asked(), 1);
  assert.deepEqual(d.puts, [{ ifMatch: '"v2"' }]);
});

test("syncList: Other device pulls; Neither leaves it dirty", async () => {
  const other = device({ remote: theirs, state: { base: '"v1"', dirty: true }, choice: "other" });
  assert.equal(await syncList(other.opts), "pulled");
  assert.deepEqual(other.ledger.get("L"), { base: '"v2"', dirty: false });

  const neither = device({ remote: theirs, state: { base: '"v1"', dirty: true }, choice: "neither" });
  assert.equal(await syncList(neither.opts), "kept");
  assert.equal(neither.puts.length + neither.written.length, 0);
  assert.deepEqual(neither.ledger.get("L"), { base: '"v1"', dirty: true });
});

test("syncList: a second device's first sync asks, so joining can't clobber", async () => {
  const d = device({ remote: theirs, choice: "other" });
  assert.equal(await syncList(d.opts), "pulled");
  assert.equal(d.asked(), 1);
});

test("syncList: a push that loses the race says so and stays dirty", async () => {
  const d = device({ remote: { ...theirs, etag: '"v1"' }, state: { base: '"v1"', dirty: true }, racePut: true });
  assert.equal(await syncList(d.opts), "raced");
  assert.deepEqual(d.ledger.get("L"), { base: '"v1"', dirty: true });
});

test("syncList quiet: pulls when clean, otherwise does nothing and never asks", async () => {
  const clean = device({ remote: theirs, state: { base: '"v1"', dirty: false } });
  assert.equal(await syncList({ ...clean.opts, quiet: true }), "pulled");
  for (const state of [{ base: '"v1"', dirty: true }, { base: null, dirty: false }]) {
    const d = device({ remote: theirs, state, choice: "this" });
    assert.equal(await syncList({ ...d.opts, quiet: true }), "skipped");
    assert.equal(d.asked() + d.puts.length + d.written.length, 0);
  }
});

test("syncList: a remote document that isn't a list throws before writing", async () => {
  const d = device({ remote: { body: "[1]", etag: '"v2"' }, state: { base: '"v1"', dirty: false } });
  await assert.rejects(syncList(d.opts), /isn't one this app can read/);
  assert.equal(d.written.length, 0);
});
