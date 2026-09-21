import assert from "node:assert/strict";
import test from "node:test";
import { buildConcreteDAG, buildCausallyValidDAG } from "./casper-concrete-dag.ts";
import { analyzeUpstreamReachability } from "./casper-upstream-reachability.ts";

test("the original nine-message fixture is correctly rejected by upstream reachability screening", () => {
  const report = analyzeUpstreamReachability(buildConcreteDAG());
  assert.equal(report.reachable, false);
  assert.equal(report.violations.filter((v) => v.code === "SEQUENCE_MISMATCH").length, 4);
});

test("the causally valid multi-layer fixture passes upstream reachability screening", () => {
  const report = analyzeUpstreamReachability(buildCausallyValidDAG());
  assert.equal(report.reachable, true);
  assert.deepEqual(report.violations, []);
});
