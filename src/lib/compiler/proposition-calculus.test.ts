import assert from "node:assert/strict";
import test from "node:test";
import {
  detectEquivocation,
  incompatible,
  proposition,
  selectMaximallyConsistentPropositions,
  type RealityBet,
} from "./proposition-calculus.ts";

test("selects a deterministic inclusion-maximal consistent proposition set", () => {
  const result = selectMaximallyConsistentPropositions([
    proposition("tx-2-before-tx-3", "p2"),
    incompatible("tx-3-before-tx-2", "p3", ["p2"]),
    proposition("tx-4-independent", "p4"),
  ]);

  assert.deepEqual(result.accepted.map((item) => item.id), ["p2", "p4"]);
  assert.deepEqual(result.rejected.map((item) => item.id), ["p3"]);
  assert.equal(result.judgement.state, "INCOMPLETE");
  assert.equal(result.fixedPoint, true);
  assert.ok(result.judgement.digest.length > 0);
});

test("requirements converge across rounds", () => {
  const result = selectMaximallyConsistentPropositions([
    { id: "p2", statement: "state transition", requires: ["p1"] },
    proposition("p1", "prerequisite"),
  ]);

  assert.deepEqual(result.accepted.map((item) => item.id), ["p1", "p2"]);
  assert.equal(result.trace.length >= 2, true);
  assert.equal(result.judgement.state, "CONSISTENT");
});

test("detects validator equivocation from incompatible claims", () => {
  const bets: RealityBet[] = [
    { source: "validator-a", target: "cycle-9", claim: "block-A", belief: 0.8, justification: ["j1"] },
    { source: "validator-a", target: "cycle-9", claim: "block-B", belief: 0.8, justification: ["j2"] },
    { source: "validator-b", target: "cycle-9", claim: "block-A", belief: 0.9, justification: ["j3"] },
  ];

  const equivocations = detectEquivocation(bets);
  assert.equal(equivocations.length, 1);
  assert.equal(equivocations[0].source, "validator-a");
  assert.deepEqual(equivocations[0].claims, ["block-A", "block-B"]);
});

test("equivocation output is deterministic", () => {
  const a: RealityBet[] = [
    { source: "v", target: "c", claim: "B", belief: 0.7, justification: [] },
    { source: "v", target: "c", claim: "A", belief: 0.7, justification: [] },
  ];
  const b = [...a].reverse();

  assert.deepEqual(detectEquivocation(a), detectEquivocation(b));
});
