import test from "node:test";
import assert from "node:assert/strict";
import { defaultStakeMatrix, runStakeMatrix } from "./casper-stake-matrix.ts";

test("strict threshold boundary is distinct from super-majority", () => {
  const results = runStakeMatrix(defaultStakeMatrix());
  assert.equal(results.find((x) => x.name === "exact-two-thirds")?.hypothesis, "THRESHOLD_BOUNDARY");
  assert.equal(results.find((x) => x.name === "strictly-over-two-thirds")?.hypothesis, "FULL_COVERAGE");
});

test("stake/coverage tension is classified without calling it a protocol failure", () => {
  const result = runStakeMatrix(defaultStakeMatrix()).find((x) => x.name === "high-stake-incomplete-coverage");
  assert.equal(result?.superMajority, true);
  assert.equal(result?.messageCoverage, false);
  assert.equal(result?.hypothesis, "STAKE_COVERAGE_TENSION");
});

test("fully covered super-majority remains distinguishable", () => {
  const result = runStakeMatrix(defaultStakeMatrix()).find((x) => x.name === "high-stake-full-coverage");
  assert.equal(result?.hypothesis, "FULL_COVERAGE");
});
