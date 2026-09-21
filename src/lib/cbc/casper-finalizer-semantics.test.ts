import assert from "node:assert/strict";
import test from "node:test";
import { buildConcreteDAG, buildCausallyValidDAG, buildDuplicateMinimumMessageDAG } from "./casper-concrete-dag.ts";
import { traceCasperFinalizerSemantics } from "./casper-finalizer-semantics.ts";

test("M11 reaches the upstream minimum-message gate on the concrete fixture", () => {
  const fixture = buildConcreteDAG();
  const trace = traceCasperFinalizerSemantics(fixture);
  assert.equal(trace.checkMinMessagesPassed, true);
  assert.deepEqual(trace.minimumMessageIds, ["a2", "b2", "c2", "d2"]);
});

test("M11 locks next-layer selection to upstream sender-sequence semantics", () => {
  const trace = traceCasperFinalizerSemantics(buildConcreteDAG());
  assert.deepEqual(trace.nextLayer, {
    v0: "a2",
    v1: "b2",
    v2: "c2",
    v3: "d2",
  });
});

test("M11 shows the current 9-message fixture does not produce Law-14 support", () => {
  const trace = traceCasperFinalizerSemantics(buildConcreteDAG());
  assert.deepEqual(trace.fullPartitionSupportSenders, []);
  assert.equal(trace.supportingStake, 0);
  assert.equal(trace.totalStake, 100);
  assert.equal(trace.superMajority, false);
  assert.equal(trace.finalized, false);
});

test("M11.2 causally valid three-layer DAG reaches Law-14 finalization", () => {
  const trace = traceCasperFinalizerSemantics(buildCausallyValidDAG());
  assert.equal(trace.checkMinMessagesPassed, true);
  assert.deepEqual(trace.nextLayer, {
    v0: "g0",
    v1: "g1",
    v2: "g2",
    v3: "g3",
  });
  assert.deepEqual(trace.fullPartitionSupportSenders, ["v0", "v1", "v2", "v3"]);
  assert.equal(trace.supportingStake, 100);
  assert.equal(trace.superMajority, true);
  assert.equal(trace.finalized, true);
});

test("M11.4 duplicate minimum messages expose the count-only gate boundary", () => {
  const trace = traceCasperFinalizerSemantics(buildDuplicateMinimumMessageDAG());
  assert.equal(trace.checkMinMessagesPassed, true);
  assert.deepEqual(trace.minimumMessageSenders, ["v0", "v0", "v1", "v2"]);
  assert.deepEqual(trace.uniqueMinimumMessageSenders, ["v0", "v1", "v2"]);
  assert.equal(trace.distinctMinimumMessageCoverage, false);
  assert.deepEqual(trace.nextLayer, {
    v0: "g0",
    v1: "g1",
    v2: "g2",
  });
  assert.equal(trace.supportingStake, 90);
  assert.equal(trace.superMajority, true);
  assert.equal(trace.finalized, true);
  assert.deepEqual(trace.justificationSupport, [
    { justificationId: "a2", sender: "v0", fullPartition: false },
    { justificationId: "a3", sender: "v0", fullPartition: true },
    { justificationId: "b3", sender: "v1", fullPartition: true },
    { justificationId: "c3", sender: "v2", fullPartition: true },
  ]);
});
