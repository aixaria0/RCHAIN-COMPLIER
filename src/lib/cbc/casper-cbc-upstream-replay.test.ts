import assert from "node:assert/strict";
import test from "node:test";
import { runM26Replay } from "./casper-cbc-upstream-replay.ts";

test("M26 replay certificate is deterministic", () => {
  const first = runM26Replay();
  const second = runM26Replay();

  assert.equal(first.deterministic, true);
  assert.equal(first.digest, second.digest);
  assert.equal(first.cases.length, 3);
  assert.equal(first.upstreamGateMatrix.length, 3);
});

test("M26 covers the requested stress dimensions", () => {
  const report = runM26Replay();

  const baseline = report.cases.find((entry) => entry.name === "baseline-control")!;
  const partition = report.cases.find((entry) => entry.name === "partition-reorder")!;
  const equivocation = report.cases.find((entry) => entry.name === "equivocation-4")!;

  assert.equal(baseline.stress.result, "CONVERGED");
  assert.equal(partition.stress.result, "DIVERGENT");
  assert.equal(equivocation.stress.result, "DIVERGENT");
  assert.ok(partition.stress.eventCount > 0);
  assert.equal(equivocation.stress.equivocationsDetected, 4);
  assert.equal(partition.upstreamPairing.claimBoundary, "OBSERVATION_ONLY");
  assert.equal(equivocation.upstreamPairing.claimBoundary, "OBSERVATION_ONLY");
});

test("M26 preserves the upstream boundary differential", () => {
  const report = runM26Replay();
  const duplicate = report.upstreamGateMatrix.find((entry) => entry.name === "duplicate-missing-sender")!;
  const valid = report.upstreamGateMatrix.find((entry) => entry.name === "valid-control")!;
  const nonBonded = report.upstreamGateMatrix.find((entry) => entry.name === "non-bonded-replacement")!;

  assert.equal(duplicate.currentCountGate, true);
  assert.equal(duplicate.shadowDistinctSenderGate, false);
  assert.equal(duplicate.upstreamSemanticTrace?.checkMinMessagesPassed, true);
  assert.equal(duplicate.upstreamSemanticTrace?.distinctMinimumMessageCoverage, false);

  assert.equal(valid.currentCountGate, true);
  assert.equal(valid.shadowDistinctSenderGate, true);
  assert.equal(valid.upstreamSemanticTrace?.checkMinMessagesPassed, true);
  assert.equal(valid.upstreamSemanticTrace?.distinctMinimumMessageCoverage, true);

  assert.equal(nonBonded.currentCountGate, true);
  assert.equal(nonBonded.shadowDistinctSenderGate, false);
});
