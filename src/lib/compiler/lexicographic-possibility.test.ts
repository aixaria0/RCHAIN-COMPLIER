import assert from "node:assert/strict";
import test from "node:test";
import {
  compareLexicographic,
  searchLexicographicPossibility,
} from "./lexicographic-possibility.ts";

type Node = "start" | "a" | "b" | "goal";

test("selects the lexicographic minimum witness, not the smallest scalar sum", () => {
  const graph: Record<Node, Array<{to: Node; label: string; cost: number[]}>> = {
    start: [
      { to: "a", label: "few-actors", cost: [1, 100] },
      { to: "b", label: "many-actors", cost: [2, 0] },
    ],
    a: [{ to: "goal", label: "finish-a", cost: [0, 0] }],
    b: [{ to: "goal", label: "finish-b", cost: [0, 0] }],
    goal: [],
  };

  const result = searchLexicographicPossibility<Node>({
    initial: "start",
    objectives: ["actors", "secondary-cost"],
    stateKey: (state) => state,
    isGoal: (state) => state === "goal",
    expand: (state) => graph[state],
  });

  assert.equal(result.status, "REACHABLE");
  assert.deepEqual(result.minimumCost, [1, 100]);
  assert.deepEqual(result.witness.map((step) => step.label), ["few-actors", "finish-a"]);
});

test("uses later dimensions only when earlier dimensions tie", () => {
  assert.equal(compareLexicographic([1, 4, 99], [1, 5, 0]), -1);
  assert.equal(compareLexicographic([1, 4], [1, 4]), 0);
});

test("fails closed on search-budget exhaustion", () => {
  const result = searchLexicographicPossibility<number>({
    initial: 0,
    objectives: ["steps"],
    stateKey: String,
    isGoal: (state) => state === 10,
    expand: (state) => [{ to: state + 1, label: "next", cost: [1] }],
    maxStates: 3,
  });
  assert.equal(result.status, "LIMIT_REACHED");
  assert.equal(result.minimumCost, null);
  assert.deepEqual(result.witness, []);
});

test("rejects mismatched or negative cost vectors", () => {
  assert.throws(
    () => searchLexicographicPossibility({
      initial: 0,
      objectives: ["a", "b"],
      stateKey: String,
      isGoal: () => false,
      expand: () => [{ to: 1, label: "bad", cost: [1] }],
    }),
    /dimension mismatch/,
  );

  assert.throws(
    () => searchLexicographicPossibility({
      initial: 0,
      objectives: ["a"],
      stateKey: String,
      isGoal: () => false,
      expand: () => [{ to: 1, label: "bad", cost: [-1] }],
    }),
    /non-negative/,
  );
});
