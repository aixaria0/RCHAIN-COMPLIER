import assert from "node:assert/strict";
import test from "node:test";
import { buildCausallyValidDAG } from "./casper-concrete-dag.ts";
import { searchReachableCasperCounterexample } from "./casper-possibility-search.ts";

test("finds a minimum-cost upstream-reachable Casper finalization counterexample", () => {
  const result = searchReachableCasperCounterexample(buildCausallyValidDAG());

  assert.equal(result.status, "COUNTEREXAMPLE_FOUND");
  assert.equal(result.minimumCost, 1);
  assert.equal(result.mutations.length, 1);
  assert.equal(result.baseline.finalized, true);
  assert.equal(result.baselineReachability.reachable, true);
  assert.equal(result.candidateReachability?.reachable, true);
  assert.equal(result.candidateTrace?.checkMinMessagesPassed, true);
  assert.equal(result.candidateTrace?.distinctMinimumMessageCoverage, true);
  assert.equal(result.candidateTrace?.finalized, false);
  assert.ok((result.candidateTrace?.supportingStake ?? 100) < 70);
});

test("counterexample search is deterministic for the same causal DAG", () => {
  const first = searchReachableCasperCounterexample(buildCausallyValidDAG());
  const second = searchReachableCasperCounterexample(buildCausallyValidDAG());

  assert.deepEqual(first.mutations, second.mutations);
  assert.equal(first.minimumCost, second.minimumCost);
  assert.equal(first.exploredStates, second.exploredStates);
});

test("weighted mutation cost changes which minimum witness is preferred", () => {
  const result = searchReachableCasperCounterexample(buildCausallyValidDAG(), {
    mutationCost: (mutation) =>
      mutation.messageId === "a3" && mutation.removedParentId === "b2"
        ? 0.25
        : 2,
  });

  assert.equal(result.status, "COUNTEREXAMPLE_FOUND");
  assert.equal(result.minimumCost, 0.25);
  assert.deepEqual(result.mutations, [
    { messageId: "a3", removedParentId: "b2", cost: 0.25 },
  ]);
});

test("search budget exhaustion is LIMIT_REACHED rather than a false safety result", () => {
  const result = searchReachableCasperCounterexample(buildCausallyValidDAG(), {
    maxStates: 1,
  });

  assert.equal(result.status, "LIMIT_REACHED");
  assert.equal(result.minimumCost, null);
  assert.equal(result.candidate, null);
});

test("invalid mutation cost is rejected", () => {
  assert.throws(
    () =>
      searchReachableCasperCounterexample(buildCausallyValidDAG(), {
        mutationCost: () => -1,
      }),
    /finite and non-negative/,
  );
});
