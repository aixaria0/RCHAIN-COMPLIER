import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { EventJournal } from "./journal.ts";
import { fixture } from "./fixtures.ts";
function temporary() {
  return mkdtempSync(join(tmpdir(), "lattice-journal-"));
}
test("durable restart reproduces signed reasoning history", () => {
  const f = fixture(),
    dir = temporary();
  try {
    let j = new EventJournal(dir, f.policy);
    j.append([f.good, f.bad, f.goodEvidence, f.badEvidence]);
    const view = j.view();
    j.close();
    j = new EventJournal(dir, f.policy);
    assert.deepEqual(j.view(), view);
    j.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("invalid batches and exhausted capacity are atomic; duplicates are idempotent", () => {
  const f = fixture(),
    dir = temporary();
  try {
    const j = new EventJournal(dir, f.policy, 2);
    assert.throws(() => j.append([f.good, { ...f.bad, signatureHex: "0".repeat(128) }]));
    assert.equal(j.allEvents().length, 0);
    j.append([f.good]);
    assert.throws(() => j.append([f.bad, f.goodEvidence]));
    assert.equal(j.allEvents().length, 1);
    assert.deepEqual(j.append([f.good]), { inserted: 0, duplicates: 1 });
    j.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("new policy cannot silently reinterpret persisted events", () => {
  const f = fixture(),
    dir = temporary();
  try {
    const j = new EventJournal(dir, f.policy);
    j.append([f.good]);
    j.close();
    assert.throws(
      () => new EventJournal(dir, { ...f.policy, latticeId: "foreign" }),
      /policy mismatch/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("structurally valid SQLite index corruption fails closed", () => {
  const f = fixture(),
    dir = temporary();
  try {
    const j = new EventJournal(dir, f.policy);
    j.append([f.good]);
    j.close();
    const db = new DatabaseSync(join(dir, "events.sqlite"));
    db.prepare("UPDATE events SET actor_id=?").run("corrupt");
    db.close();
    assert.throws(() => new EventJournal(dir, f.policy), /corruption/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("database writer serialization and local cursor do not imply causal order", () => {
  const f = fixture(),
    dir = temporary();
  try {
    const a = new EventJournal(dir, f.policy),
      b = new EventJournal(dir, f.policy);
    a.append([f.badEvidence]);
    b.append([f.bad]);
    assert.deepEqual(a.view(), b.view());
    assert.equal(a.view().pending.length, 0);
    assert.equal(a.page().events[0]!.id, f.badEvidence.id);
    assert.deepEqual(b.append([f.bad]), { inserted: 0, duplicates: 1 });
    a.close();
    b.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("exposed directory permissions and missing cursor entries are detected", () => {
  const f = fixture(),
    dir = temporary();
  try {
    chmodSync(dir, 0o755);
    assert.throws(() => new EventJournal(dir, f.policy), /0700/);
    chmodSync(dir, 0o700);
    const j = new EventJournal(dir, f.policy);
    j.append([f.good, f.bad]);
    j.close();
    const db = new DatabaseSync(join(dir, "events.sqlite"));
    db.exec("DELETE FROM events WHERE position=1");
    db.close();
    assert.throws(() => new EventJournal(dir, f.policy), /cursor corruption/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
