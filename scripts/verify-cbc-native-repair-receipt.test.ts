import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const base = {
  schema: "cbc-native-repair-replay/v1",
  upstreamRepository: "rchain-community/rchain-rust",
  upstreamCommit: "d92f0787a6096cd6d79864ec2d7c1dd9b6912d0b",
  repairAction: "replace:a2->d3",
  before: {
    justifications: ["a2", "a3", "b3", "c3"],
    minimumMessageSenders: ["v0", "v0", "v1", "v2"],
    fringe: ["a1", "b1", "c1"],
    finalized: true,
  },
  after: {
    justifications: ["a3", "b3", "c3", "d3"],
    minimumMessageSenders: ["v0", "v1", "v2", "v3"],
    fringe: ["a1", "b1", "c1", "d1"],
    finalized: true,
  },
};

function run(receipt: unknown) {
  const dir = mkdtempSync(join(tmpdir(), "cbc-native-binding-"));
  const file = join(dir, "receipt.json");
  writeFileSync(file, JSON.stringify(receipt));
  return spawnSync(
    process.execPath,
    ["--experimental-strip-types", "scripts/verify-cbc-native-repair-receipt.ts", file],
    { encoding: "utf8" },
  );
}

test("native replay receipt binds to the compiler-selected CBC repair", () => {
  const result = run(base);
  assert.equal(result.status, 0, result.stderr);
  const binding = JSON.parse(result.stdout);
  assert.equal(binding.schema, "cbc-native-repair-binding/v1");
  assert.equal(binding.repairAction, "replace:a2->d3");
  assert.equal(binding.nativeReplayVerified, true);
  assert.match(binding.repairArtifactDigest, /^sha256:[0-9a-f]{64}$/);
  assert.match(binding.nativeReceiptDigest, /^sha256:[0-9a-f]{64}$/);
});

test("native replay binding fails closed if native action differs from selected repair", () => {
  const result = run({ ...base, repairAction: "replace:a3->d3" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /does not match compiler selection/);
});

test("native replay binding rejects a receipt that loses finalization preservation", () => {
  const result = run({ ...base, after: { ...base.after, finalized: false } });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /exactly match the pinned before\/after Finalizer fixture/);
});


test("native replay binding rejects same-cardinality but different sender identities", () => {
  const result = run({
    ...base,
    before: {
      ...base.before,
      minimumMessageSenders: ["v0", "v1", "v1", "v2"],
    },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /exactly match the pinned before\/after Finalizer fixture/);
});

test("native replay binding rejects justification drift", () => {
  const result = run({
    ...base,
    after: {
      ...base.after,
      justifications: ["a3", "b3", "c3", "x3"],
    },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /exactly match the pinned before\/after Finalizer fixture/);
});

test("native replay binding rejects fringe drift", () => {
  const result = run({
    ...base,
    after: {
      ...base.after,
      fringe: ["a1", "b1", "c1", "x1"],
    },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /exactly match the pinned before\/after Finalizer fixture/);
});
