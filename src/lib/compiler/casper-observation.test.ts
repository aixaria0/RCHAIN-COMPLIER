import assert from "node:assert/strict";
import test from "node:test";
import { toCasperObservationEvidence } from "./casper-observation.ts";

test("maps Casper block observations into auditable bet/proposition evidence", () => {
  const result = toCasperObservationEvidence({
    blockHash: "block-a",
    sender: "validator-a",
    seqNum: 7,
    blockNum: 12,
    justifications: ["parent-b", "parent-a", "parent-a"],
    bondsMap: { "validator-a": 42, "validator-b": 58 },
    fringe: ["parent-b", "parent-a"],
    preStateHash: "state-0",
    postStateHash: "state-1",
  });

  assert.equal(result.bet.source, "validator-a");
  assert.equal(result.bet.target, "block-12/seq-7");
  assert.equal(result.bet.claim, "block-a");
  assert.equal(result.bet.belief, 42);
  assert.deepEqual(result.bet.justification, ["parent-a", "parent-b"]);
  assert.deepEqual(result.proposition.requires, ["block:parent-b", "block:parent-a"]);
  assert.ok(result.observationDigest.length > 0);
});

test("observation digest is independent of fringe and bonds-map ordering", () => {
  const base = {
    blockHash: "block-a",
    sender: "validator-a",
    seqNum: 7,
    blockNum: 12,
    justifications: ["parent-a", "parent-b"],
    preStateHash: "state-0",
    postStateHash: "state-1",
  };

  const first = toCasperObservationEvidence({
    ...base,
    bondsMap: { "validator-a": 42, "validator-b": 58 },
    fringe: ["parent-b", "parent-a"],
  });
  const second = toCasperObservationEvidence({
    ...base,
    bondsMap: { "validator-b": 58, "validator-a": 42 },
    fringe: ["parent-a", "parent-b"],
  });

  assert.equal(first.observationDigest, second.observationDigest);
});
