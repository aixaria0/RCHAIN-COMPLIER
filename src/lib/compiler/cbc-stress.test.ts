import assert from "node:assert/strict";
import test from "node:test";
import {
  replayCbcStressScenario,
  runCbcStressScenario,
  type CbcStressScenario,
} from "./cbc-stress.ts";

const validators = [
  { id: "v-a", stake: 1 },
  { id: "v-b", stake: 1 },
  { id: "v-c", stake: 1 },
  { id: "v-d", stake: 1 },
];

test("baseline scenario is deterministic and convergent", () => {
  const scenario: CbcStressScenario = { id: "baseline", validators, fault: "baseline" };
  const result = runCbcStressScenario(scenario);

  assert.equal(result.metrics.validators, 4);
  assert.equal(result.metrics.convergenceRounds, 1);
  assert.equal(result.metrics.equivocationCount, 0);
  assert.equal(result.metrics.divergence, false);
  assert.equal(replayCbcStressScenario(scenario), true);
});

test("equivocation becomes explicit evidence", () => {
  const scenario: CbcStressScenario = {
    id: "equivocation",
    validators,
    fault: "equivocation",
    equivocation: { source: "v-a", claims: ["block-A", "block-B"] },
  };
  const result = runCbcStressScenario(scenario);

  assert.equal(result.metrics.equivocationCount, 1);
  assert.deepEqual(result.observations[0].equivocationSources, ["v-a"]);
  assert.match(result.fragilities[0], /equivocation/);
  assert.ok(result.replayDigest.length > 0);
});

test("partition is visible in the evidence report", () => {
  const result = runCbcStressScenario({
    id: "partition",
    validators,
    fault: "partition",
    partition: [["v-a", "v-b"], ["v-c", "v-d"]],
  });

  assert.equal(result.metrics.partitionedRounds, 3);
  assert.equal(result.metrics.replayStable, true);
  assert.equal(result.metrics.divergence, true);
  assert.equal(result.observations[0].acceptedClaims.length, 2);
  assert.equal(result.fragilities.some((item) => item.includes("partition")), true);
});

test("reordering remains replayable", () => {
  const scenario: CbcStressScenario = {
    id: "reorder",
    validators,
    fault: "reorder",
    reorder: true,
  };
  const result = runCbcStressScenario(scenario);

  assert.equal(result.metrics.replayStable, true);
  assert.equal(replayCbcStressScenario(scenario), true);
});
