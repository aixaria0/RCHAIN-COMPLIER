import assert from "node:assert/strict";
import test from "node:test";
import { traceCasperFinalizerObservation } from "./casper-finalizer-observation.ts";

test("derives full-partition support from concrete observer sets", () => {
  const result = traceCasperFinalizerObservation({
    bondsMap: { v0: 70, v1: 10, v2: 10, v3: 10 },
    minimumMessageSenders: ["v0", "v1", "v2", "v3"],
    supportObservers: {
      v0: ["v0", "v1", "v2", "v3"],
      v1: ["v0", "v1"],
    },
  });

  assert.deepEqual(result.support, ["v0"]);
  assert.equal(result.superMajority, true);
  assert.equal(result.messageCoverage, true);
  assert.equal(result.observationDigest.length > 0, true);
});

test("exposes stake/coverage tension without declaring a protocol failure", () => {
  const result = traceCasperFinalizerObservation({
    bondsMap: { v0: 70, v1: 10, v2: 10, v3: 10 },
    minimumMessageSenders: ["v0"],
    supportObservers: {
      v0: ["v0", "v1", "v2", "v3"],
    },
  });

  assert.deepEqual(result.support, ["v0"]);
  assert.equal(result.superMajority, true);
  assert.equal(result.messageCoverage, false);
  assert.deepEqual(result.missingBondedValidators, ["v1", "v2", "v3"]);
});

test("partial observer coverage does not count as full-partition support", () => {
  const result = traceCasperFinalizerObservation({
    bondsMap: { v0: 70, v1: 10, v2: 10, v3: 10 },
    minimumMessageSenders: ["v0", "v1", "v2", "v3"],
    supportObservers: {
      v0: ["v0", "v1", "v2"],
    },
  });

  assert.deepEqual(result.support, []);
  assert.equal(result.superMajority, false);
  assert.equal(result.messageCoverage, true);
});
