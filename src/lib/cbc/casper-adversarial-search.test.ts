import assert from "node:assert/strict";
import test from "node:test";
import { buildConcreteDAG } from "./casper-concrete-dag.ts";
import { searchFinalizingMutation } from "./casper-adversarial-search.ts";

test("M11.1 finds a deterministic finalizing candidate while preserving the gate", () => {
  const result = searchFinalizingMutation(buildConcreteDAG());
  assert.equal(result.baseline.checkMinMessagesPassed, true);
  assert.equal(result.baseline.finalized, false);
  assert.equal(result.candidateTrace.checkMinMessagesPassed, true);
  assert.equal(result.candidateTrace.finalized, true);
  assert.equal(result.candidateTrace.supportingStake, 100);
});

test("M11.1 reaches the candidate with 29 additions in the constrained mutation model", () => {
  const result = searchFinalizingMutation(buildConcreteDAG());
  assert.equal(result.mutationCount, 29);
  assert.equal(result.lowerBound, 29);
  assert.equal(result.minimalWithinMutationModel, true);
  assert.equal(result.essentialMutations.length, 29);
});

test("M11.1 mutation search is deterministic", () => {
  const first = searchFinalizingMutation(buildConcreteDAG());
  const second = searchFinalizingMutation(buildConcreteDAG());
  assert.deepEqual(first.mutations, second.mutations);
  assert.deepEqual(first.candidateTrace, second.candidateTrace);
});
