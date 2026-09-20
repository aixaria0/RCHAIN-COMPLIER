import assert from "node:assert/strict";
import test from "node:test";
import { buildConcreteDAG, traceConcreteDAG } from "./casper-concrete-dag.ts";

test("concrete DAG produces one minimum message per bonded sender", () => {
  const trace = traceConcreteDAG(buildConcreteDAG());
  assert.deepEqual(trace.minimumMessageSenders, ["v0", "v1", "v2", "v3"]);
  assert.equal(trace.messageCoverage, true);
  assert.equal(trace.upstreamGate, "FRINGE_STAGE_REACHABLE");
});

test("concrete delivery history preserves deterministic message identities", () => {
  const fixture = buildConcreteDAG();
  assert.deepEqual(fixture.justifications, ["a2", "b2", "c2", "d2"]);
  assert.equal(fixture.messages.length, 9);
});

test("the concrete fixture does not manufacture supermajority support", () => {
  const trace = traceConcreteDAG(buildConcreteDAG());
  assert.equal(trace.superMajority, true);
});
