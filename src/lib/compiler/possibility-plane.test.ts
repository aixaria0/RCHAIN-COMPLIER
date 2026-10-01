import assert from "node:assert/strict";
import test from "node:test";
import { searchWeightedPossibility } from "./possibility-plane.ts";

interface State {
  id: string;
}

const graph: Record<string, Array<{ to: string; label: string; cost: number }>> = {
  A: [
    { to: "B", label: "fast-first-hop", cost: 1 },
    { to: "C", label: "expensive-first-hop", cost: 4 },
  ],
  B: [
    { to: "D", label: "finish", cost: 2 },
    { to: "C", label: "detour", cost: 1 },
  ],
  C: [{ to: "D", label: "finish-from-c", cost: 4 }],
  D: [],
};

test("finds the deterministic minimum-cost counterfactual witness", () => {
  const result = searchWeightedPossibility<State>({
    initial: { id: "A" },
    stateKey: (state) => state.id,
    isGoal: (state) => state.id === "D",
    expand: (state) =>
      graph[state.id]!.map((edge) => ({
        to: { id: edge.to },
        label: edge.label,
        cost: edge.cost,
      })),
  });

  assert.equal(result.status, "REACHABLE");
  assert.equal(result.minimumCost, 3);
  assert.deepEqual(
    result.witness.map((step) => step.label),
    ["fast-first-hop", "finish"],
  );
  assert.equal(result.goalStateKey, "D");
});

test("reports unreachable without inventing a witness", () => {
  const result = searchWeightedPossibility<State>({
    initial: { id: "D" },
    stateKey: (state) => state.id,
    isGoal: (state) => state.id === "Z",
    expand: () => [],
  });

  assert.equal(result.status, "UNREACHABLE");
  assert.equal(result.minimumCost, null);
  assert.deepEqual(result.witness, []);
});

test("fails closed when the exploration budget is exhausted", () => {
  const result = searchWeightedPossibility<number>({
    initial: 0,
    stateKey: String,
    isGoal: (state) => state === 10,
    expand: (state) => [{ to: state + 1, label: "advance", cost: 1 }],
    maxStates: 3,
  });

  assert.equal(result.status, "LIMIT_REACHED");
  assert.equal(result.exploredStates, 3);
  assert.deepEqual(result.witness, []);
});

test("rejects negative transition costs", () => {
  assert.throws(
    () =>
      searchWeightedPossibility<number>({
        initial: 0,
        stateKey: String,
        isGoal: () => false,
        expand: () => [{ to: 1, label: "invalid", cost: -1 }],
      }),
    /finite non-negative cost/,
  );
});
