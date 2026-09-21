import assert from "node:assert/strict";
import test from "node:test";
import { runM27ReachabilityConstrainedSearch } from "./casper-reachable-adversarial-history-search.ts";

test("M27 exhaustively characterizes the bounded replacement space", () => {
  const report = runM27ReachabilityConstrainedSearch();

  assert.equal(report.searchSpace.candidateCount, 256);
  assert.equal(report.searchSpace.reachableCount, 256);
  assert.equal(report.searchSpace.currentCountGateCount, 256);
  assert.equal(report.searchSpace.senderCompleteCount, 24);
  assert.equal(report.searchSpace.underCardinalityCount, 232);
  assert.equal(report.searchSpace.exactlyThreeSenderCount, 144);
});

test("M27 finds a one-replacement under-cardinality witness from reachable messages", () => {
  const report = runM27ReachabilityConstrainedSearch();

  assert.equal(report.minimalAdversarialDistance, 1);
  assert.ok(report.minimalWitnesses.length > 0);
  for (const witness of report.minimalWitnesses) {
    assert.equal(witness.distanceFromControl, 1);
    assert.equal(witness.currentCountGate, true);
    assert.equal(witness.senderCoverage, false);
    assert.equal(witness.reachable, true);
    assert.equal(witness.distinctMinimumSenders, 3);
  }
});

test("M27 finds a one-replacement finalizing witness", () => {
  const report = runM27ReachabilityConstrainedSearch();

  assert.equal(report.minimalFinalizingDistance, 1);
  assert.ok(report.minimalFinalizingWitnesses.length > 0);

  const witness = report.minimalFinalizingWitnesses[0]!;
  assert.equal(witness.distanceFromControl, 1);
  assert.equal(witness.currentCountGate, true);
  assert.equal(witness.senderCoverage, false);
  assert.equal(witness.reachable, true);
  assert.equal(witness.finalized, true);
});

test("M27 search is deterministic", () => {
  const first = runM27ReachabilityConstrainedSearch();
  const second = runM27ReachabilityConstrainedSearch();

  assert.equal(first.digest, second.digest);
  assert.equal(first.deterministic, true);
});
