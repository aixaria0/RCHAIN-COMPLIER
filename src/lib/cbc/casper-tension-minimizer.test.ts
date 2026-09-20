import test from "node:test";
import assert from "node:assert/strict";
import { minimizeTensionObservation } from "./casper-tension-minimizer.ts";

test("minimizes a stake/coverage tension to the smallest multi-validator observation", () => {
  const result = minimizeTensionObservation({
    bondsMap: { v0: 70, v1: 10, v2: 10, v3: 10 },
    minimumMessageSenders: ["v0"],
    supportObservers: { v0: ["v0", "v1", "v2", "v3"] },
  });

  assert.equal(result.original.superMajority, true);
  assert.equal(result.original.messageCoverage, false);
  assert.equal(Object.keys(result.minimized.bondsMap).length, 2);
  assert.equal(result.minimized.superMajority, true);
  assert.equal(result.minimized.messageCoverage, false);
  assert.deepEqual(result.minimized.bondsMap, { v0: 70, v3: 10 });
  assert.deepEqual(result.minimized.support, ["v0"]);
  assert.deepEqual(result.minimized.minimumMessageSenders, ["v0"]);
  assert.equal(result.removedValidators.length, 2);
  assert.equal(result.preservedPredicate, "SUPERMAJORITY_AND_INCOMPLETE_COVERAGE");
});

test("rejects observations that are not tension cases", () => {
  assert.throws(
    () =>
      minimizeTensionObservation({
        bondsMap: { v0: 70, v1: 10, v2: 10, v3: 10 },
        minimumMessageSenders: ["v0", "v1", "v2", "v3"],
        supportObservers: { v0: ["v0", "v1", "v2", "v3"] },
      }),
    /supermajority\/incomplete-coverage/,
  );
});
