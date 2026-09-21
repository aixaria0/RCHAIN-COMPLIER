import assert from "node:assert/strict";
import test from "node:test";
import { analyzeFragility } from "./fragility-engine.ts";
import { simulateCbc } from "./cbc-simulator.ts";

test("clean baseline satisfies explicit invariants", () => {
  const report = analyzeFragility(simulateCbc({ name: "baseline", validators: 4, byzantine: 0 }));
  assert.equal(report.counterexamples.length, 0);
  assert.ok(report.invariants.every((item) => item.satisfied));
});

test("equivocation coverage is checked as an invariant", () => {
  const report = analyzeFragility(simulateCbc({ name: "equivocation-4", validators: 8, byzantine: 4, equivocations: 4 }));
  const invariant = report.invariants.find((item) => item.invariant === "EQUIVOCATION_DETECTION");
  assert.equal(invariant?.satisfied, true);
  assert.equal(report.counterexamples.length, 0);
});

test("fragility report is deterministic", () => {
  const scenario = { name: "partition-16-16", validators: 32, byzantine: 0, partition: 16, delayedRounds: 2, reorder: true };
  const first = analyzeFragility(simulateCbc(scenario));
  const second = analyzeFragility(simulateCbc(scenario));
  assert.equal(first.digest, second.digest);
});