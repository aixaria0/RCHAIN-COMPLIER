import assert from "node:assert/strict";
import test from "node:test";
import { buildConcreteDAG } from "./casper-concrete-dag.ts";
import { searchFinalizingMutation } from "./casper-adversarial-search.ts";

test("M11.1 legacy mutation model is explicitly non-finalizing under locked self-parent semantics", () => {
  const result = searchFinalizingMutation(buildConcreteDAG());
  assert.equal(result.baseline.finalized, false);
  assert.equal(result.candidateTrace.checkMinMessagesPassed, true);
  assert.equal(result.finalized, false);
  assert.equal(result.minimalWithinMutationModel, false);
  assert.equal(result.mutationCount, 29);
  assert.equal(result.lowerBound, 29);
});

test("M11.1 mutation search remains deterministic", () => {
  const first = searchFinalizingMutation(buildConcreteDAG());
  const second = searchFinalizingMutation(buildConcreteDAG());
  assert.deepEqual(first.mutations, second.mutations);
  assert.deepEqual(first.candidateTrace, second.candidateTrace);
  assert.equal(first.finalized, second.finalized);
});
