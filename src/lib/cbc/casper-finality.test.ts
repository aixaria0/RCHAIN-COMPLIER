import test from "node:test";
import assert from "node:assert/strict";
import { analyzeCasperFinality } from "./casper-finality.ts";

test("Casper finality law probe uses a strict greater-than two-thirds stake threshold", () => {
  const exact = analyzeCasperFinality({ bonds: { v0: 2, v1: 1 }, support: ["v0"], minimumMessageSenders: ["v0", "v1"] });
  assert.equal(exact.superMajority, false);
  const above = analyzeCasperFinality({ bonds: { v0: 3, v1: 1 }, support: ["v0"], minimumMessageSenders: ["v0", "v1"] });
  assert.equal(above.superMajority, true);
});

test("stake/count tension is a replayable observation", () => {
  const analysis = analyzeCasperFinality({
    bonds: { v0: 70, v1: 10, v2: 10, v3: 10 },
    support: ["v0"],
    minimumMessageSenders: ["v0"],
  });
  assert.equal(analysis.superMajority, true);
  assert.equal(analysis.messageCoverage, false);
  assert.deepEqual(analysis.missingBondedValidators, ["v1", "v2", "v3"]);
});

test("unbonded sender does not contribute stake", () => {
  const analysis = analyzeCasperFinality({
    bonds: { v0: 60, v1: 40 },
    support: ["v0", "vx"],
    minimumMessageSenders: ["v0", "v1", "vx"],
  });
  assert.equal(analysis.supportingStake, 60);
  assert.equal(analysis.superMajority, false);
  assert.deepEqual(analysis.extraSenders, ["vx"]);
});

test("analysis digest is deterministic under input ordering", () => {
  const a = analyzeCasperFinality({ bonds: { v1: 40, v0: 60 }, support: ["v1", "v0"], minimumMessageSenders: ["v1", "v0"] });
  const b = analyzeCasperFinality({ bonds: { v0: 60, v1: 40 }, support: ["v0", "v1"], minimumMessageSenders: ["v0", "v1"] });
  assert.equal(a.digest, b.digest);
});
