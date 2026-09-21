import test from "node:test";
import assert from "node:assert/strict";
import { replayCbc, simulateCbc } from "./cbc-simulator.ts";

test("baseline replay is deterministic", () => {
  const scenario = { name: "baseline", validators: 4, byzantine: 0 };
  const first = simulateCbc(scenario);
  const replay = replayCbc(scenario);
  assert.equal(first.replayDigest, replay.replayDigest);
  assert.equal(first.result, "CONVERGED");
});

test("partition produces inspectable divergence", () => {
  const result = simulateCbc({
    name: "partition-16-16",
    validators: 32,
    byzantine: 0,
    partition: 16,
    delayedRounds: 2,
  });
  assert.equal(result.result, "DIVERGENT");
  assert.ok(result.evidence.justificationGraph.length > 0);
  assert.ok(result.convergenceHistory.length > 0);
});

test("equivocation is explicit evidence", () => {
  const result = simulateCbc({
    name: "equivocation-4",
    validators: 8,
    byzantine: 4,
    equivocations: 4,
  });
  assert.equal(result.equivocations.length, 4);
  assert.equal(result.result, "DIVERGENT");
});
