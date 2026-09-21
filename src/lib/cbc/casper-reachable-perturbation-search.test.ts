import assert from "node:assert/strict";
import test from "node:test";
import { buildCausallyValidDAG } from "./casper-concrete-dag.ts";
import { searchReachableFinalizationFlip } from "./casper-reachable-perturbation-search.ts";

test("M11.3 finds a one-parent reachable finalization flip", () => {
  const results = searchReachableFinalizationFlip(buildCausallyValidDAG());
  assert.equal(results.length, 3);

  for (const result of results) {
    assert.equal(result.mutationCount, 1);
    assert.equal(result.reachability.reachable, true);
    assert.equal(result.baseline.finalized, true);
    assert.equal(result.candidateTrace.checkMinMessagesPassed, true);
    assert.equal(result.candidateTrace.messageCoverage, true);
    assert.equal(result.candidateTrace.finalized, false);
    assert.equal(result.candidateTrace.supportingStake < 70, true);
  }
});

test("M11.3 the smallest flips remove one of a3's non-self layer-2 parents", () => {
  const results = searchReachableFinalizationFlip(buildCausallyValidDAG());
  assert.deepEqual(
    results.map((result) => result.mutation),
    [
      { messageId: "a3", removedParentId: "b2" },
      { messageId: "a3", removedParentId: "c2" },
      { messageId: "a3", removedParentId: "d2" },
    ],
  );
});

test("M11.3 perturbation search is deterministic", () => {
  const first = searchReachableFinalizationFlip(buildCausallyValidDAG());
  const second = searchReachableFinalizationFlip(buildCausallyValidDAG());
  assert.deepEqual(
    first.map((result) => result.mutation),
    second.map((result) => result.mutation),
  );
});
