import assert from "node:assert/strict";
import test from "node:test";
import { analyzeQuantitativeWhatIf, type WhatIfTransition } from "./quantitative-what-if.ts";

type Node = "start" | "a" | "b" | "goal";
const analyze = (
  graph: Record<Node, WhatIfTransition<Node>[]>,
  maxFailures: number,
  maxStates?: number,
) =>
  analyzeQuantitativeWhatIf({
    initial: "start" as Node,
    stateKey: (node) => node,
    isGoal: (node) => node === "goal",
    expand: (node) => graph[node],
    maxFailures,
    maxStates,
  });

test("rejects a cheap phantom trace and finds the cheapest consistent witness", () => {
  const result = analyze(
    {
      start: [
        { to: "a", label: "fail-x", cost: 1, requiresFailed: ["x"] },
        { to: "b", label: "safe-detour", cost: 3 },
      ],
      a: [{ to: "goal", label: "use-x", cost: 1, requiresOperational: ["x"] }],
      b: [{ to: "goal", label: "finish", cost: 2 }],
      goal: [],
    },
    1,
  );
  assert.equal(result.status, "REACHABLE");
  assert.equal(result.refinement, "EXACT");
  assert.equal(result.minimumCost, 5);
  assert.deepEqual(
    result.witness.map((step) => step.label),
    ["safe-detour", "finish"],
  );
  assert.deepEqual(result.failedComponents, []);
});

test("counts distinct persistent failures globally, not once per hop", () => {
  const result = analyze(
    {
      start: [{ to: "a", label: "first", cost: 1, requiresFailed: ["x"] }],
      a: [{ to: "goal", label: "second", cost: 1, requiresFailed: ["y"] }],
      b: [],
      goal: [],
    },
    1,
  );
  assert.equal(result.status, "UNREACHABLE");
  assert.equal(result.refinement, "EXACT");
  const allowed = analyze(
    {
      start: [{ to: "a", label: "first", cost: 1, requiresFailed: ["x"] }],
      a: [{ to: "goal", label: "second", cost: 1, requiresFailed: ["x"] }],
      b: [],
      goal: [],
    },
    1,
  );
  assert.equal(allowed.status, "REACHABLE");
  assert.deepEqual(allowed.failedComponents, ["x"]);
});

test("distinguishes exhausted refinement from a proof of unreachability", () => {
  const result = analyze(
    {
      start: [{ to: "a", label: "fail-x", cost: 1, requiresFailed: ["x"] }],
      a: [{ to: "goal", label: "use-x", cost: 1, requiresOperational: ["x"] }],
      b: [],
      goal: [],
    },
    1,
    2,
  );
  assert.equal(result.status, "INCONCLUSIVE");
  assert.equal(result.refinement, "BUDGET_EXHAUSTED");
  assert.deepEqual(result.witness, []);
});

test("rejects internally contradictory transition requirements", () => {
  assert.throws(
    () =>
      analyze(
        {
          start: [
            {
              to: "goal",
              label: "impossible",
              cost: 1,
              requiresFailed: ["x"],
              requiresOperational: ["x"],
            },
          ],
          a: [],
          b: [],
          goal: [],
        },
        1,
      ),
    /same component/,
  );
});
