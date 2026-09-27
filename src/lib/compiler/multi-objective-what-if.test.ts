import assert from "node:assert/strict";
import test from "node:test";
import { analyzeMultiObjectiveWhatIf } from "./multi-objective-what-if.ts";

type Node = "start" | "a" | "b" | "goal";

test("refines a lexicographically cheapest spurious witness and returns the exact minimum", () => {
  const graph: Record<Node, any[]> = {
    start: [
      { to: "a", label: "cheap-up", cost: [1, 0], requiresOperational: ["x"] },
      { to: "b", label: "valid-down", cost: [2, 0], requiresFailed: ["x"] },
    ],
    a: [{ to: "goal", label: "cheap-down", cost: [0, 0], requiresFailed: ["x"] }],
    b: [{ to: "goal", label: "valid-finish", cost: [0, 1], requiresFailed: ["x"] }],
    goal: [],
  };
  const result = analyzeMultiObjectiveWhatIf<Node>({
    initial: "start",
    objectives: ["actors", "secondary"],
    stateKey: (state) => state,
    isGoal: (state) => state === "goal",
    expand: (state) => graph[state],
    maxFailures: 1,
  });
  assert.equal(result.status, "REACHABLE");
  assert.equal(result.refinement, "EXACT");
  assert.equal(result.minimalityScope, "EXACT_PRODUCT_GRAPH");
  assert.deepEqual(result.minimumCost, [2, 1]);
  assert.deepEqual(result.witness.map((step) => step.label), ["valid-down", "valid-finish"]);
  assert.deepEqual(result.failedComponents, ["x"]);
});

test("an unreachable over-approximation is reported only within the declared model", () => {
  const result = analyzeMultiObjectiveWhatIf({
    initial: "start",
    objectives: ["changes"],
    stateKey: String,
    isGoal: (state) => state === "goal",
    expand: () => [],
    maxFailures: 1,
  });
  assert.equal(result.status, "UNREACHABLE");
  assert.equal(result.minimalityScope, "ABSTRACT_GRAPH");
});

test("budget exhaustion remains inconclusive", () => {
  const result = analyzeMultiObjectiveWhatIf<number>({
    initial: 0,
    objectives: ["steps", "failures"],
    stateKey: String,
    isGoal: (state) => state === 10,
    expand: (state) => [{ to: state + 1, label: "advance", cost: [1, 0] }],
    maxFailures: 0,
    maxStates: 2,
  });
  assert.equal(result.status, "INCONCLUSIVE");
  assert.equal(result.refinement, "BUDGET_EXHAUSTED");
  assert.equal(result.minimalityScope, "NONE");
  assert.equal(result.minimumCost, null);
});

test("lexicographic priority is preserved when the abstract witness is feasible", () => {
  const result = analyzeMultiObjectiveWhatIf({
    initial: "start",
    objectives: ["actors", "messages"],
    stateKey: String,
    isGoal: (state) => state === "goal",
    expand: (state: string) => state === "start" ? [
      { to: "goal", label: "few-actors", cost: [1, 100] },
      { to: "goal", label: "many-actors", cost: [2, 0] },
    ] : [],
    maxFailures: 0,
  });
  assert.equal(result.status, "REACHABLE");
  assert.deepEqual(result.minimumCost, [1, 100]);
  assert.equal(result.refinement, "NOT_NEEDED");
});
