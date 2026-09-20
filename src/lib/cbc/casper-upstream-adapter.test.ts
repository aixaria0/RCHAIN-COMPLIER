import assert from "node:assert/strict";
import test from "node:test";
import { mapObservationToUpstreamGate } from "./casper-upstream-adapter.ts";

test("maps the minimized tension directly into the upstream gate", () => {
  const result = mapObservationToUpstreamGate({
    bondsMap: { v0: 70, v3: 10 },
    minimumMessageSenders: ["v0"],
    supportObservers: { v0: ["v0", "v3"] },
  });

  assert.equal(result.gate.bondedCount, 2);
  assert.equal(result.gate.minimumMessageCount, 1);
  assert.equal(result.gate.checkMinMessagesPassed, false);
  assert.equal(result.gate.calculateFringeReachable, false);
});

test("a fully covered observation crosses the upstream gate", () => {
  const result = mapObservationToUpstreamGate({
    bondsMap: { v0: 70, v3: 10 },
    minimumMessageSenders: ["v0", "v3"],
    supportObservers: { v0: ["v0", "v3"] },
  });

  assert.equal(result.gate.checkMinMessagesPassed, true);
  assert.equal(result.gate.calculateFringeReachable, true);
});
