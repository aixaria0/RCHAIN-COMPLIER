import assert from "node:assert/strict";
import test from "node:test";
import { buildCausallyValidDAG } from "./casper-concrete-dag.ts";
import { removeParentAndRecomputeSeen, searchReachableFinalizationFlip } from "./casper-reachable-perturbation-search.ts";
import { analyzeUpstreamReachability } from "./casper-upstream-reachability.ts";

test("M11.3 finds a one-parent reachable finalization flip", () => {
  const results = searchReachableFinalizationFlip(buildCausallyValidDAG());
  assert.equal(results.length, 15);

  for (const result of results) {
    assert.equal(result.mutationCount, 1);
    assert.equal(result.reachability.reachable, true);
    assert.equal(result.baseline.finalized, true);
    assert.equal(result.candidateTrace.checkMinMessagesPassed, true);
    assert.equal(result.candidateTrace.distinctMinimumMessageCoverage, true);
    assert.equal(result.candidateTrace.finalized, false);
    assert.equal(result.candidateTrace.supportingStake < 70, true);
  }
});

test("M11.3 the smallest flips remove one of a3's non-self layer-2 parents", () => {
  const results = searchReachableFinalizationFlip(buildCausallyValidDAG());
  assert.deepEqual(
    results.map((result) => result.mutation),
    [
      { messageId: "a2", removedParentId: "b1" },
      { messageId: "a2", removedParentId: "c1" },
      { messageId: "a2", removedParentId: "d1" },
      { messageId: "a3", removedParentId: "b2" },
      { messageId: "a3", removedParentId: "c2" },
      { messageId: "a3", removedParentId: "d2" },
      { messageId: "b2", removedParentId: "a1" },
      { messageId: "b2", removedParentId: "c1" },
      { messageId: "b2", removedParentId: "d1" },
      { messageId: "c2", removedParentId: "a1" },
      { messageId: "c2", removedParentId: "b1" },
      { messageId: "c2", removedParentId: "d1" },
      { messageId: "d2", removedParentId: "a1" },
      { messageId: "d2", removedParentId: "b1" },
      { messageId: "d2", removedParentId: "c1" }
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


test("seen-set derivation is independent of message array order", () => {
  const baseline = buildCausallyValidDAG();
  const shuffled = {
    ...baseline,
    messages: [...baseline.messages].reverse(),
  };
  const candidate = removeParentAndRecomputeSeen(shuffled, "a3", "b2");
  const reachability = analyzeUpstreamReachability(candidate);

  assert.equal(reachability.reachable, true);
  const byId = new Map(candidate.messages.map((message) => [message.id, message]));
  assert.deepEqual(byId.get("a3")?.seen, [
    "a1", "a2", "a3", "b1", "c1", "c2", "d1", "d2", "g0", "g1", "g2", "g3",
  ]);
});
