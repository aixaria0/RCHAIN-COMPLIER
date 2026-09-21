import assert from "node:assert/strict";
import test from "node:test";
import { buildConcreteDAG } from "./casper-concrete-dag.ts";
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
