import assert from "node:assert/strict";
import test from "node:test";
import { defaultFinalizerDeliveryMatrix, runFinalizerDeliveryMatrix } from "./casper-finalizer-delivery-matrix.ts";

test("delivery matrix separates coverage loss from harmless ordering changes", () => {
  const results = runFinalizerDeliveryMatrix(defaultFinalizerDeliveryMatrix());

  const complete = results.find((x) => x.name === "all-delivered")!;
  const partition = results.find((x) => x.name === "observer-partition")!;
  const missing = results.find((x) => x.name === "missing-minimum-sender")!;
  const reordered = results.find((x) => x.name === "reordered-but-complete")!;

  assert.equal(complete.superMajority, true);
  assert.equal(complete.messageCoverage, true);

  assert.equal(partition.superMajority, false);
  assert.equal(partition.messageCoverage, true);

  assert.equal(missing.superMajority, true);
  assert.equal(missing.messageCoverage, false);

  assert.equal(reordered.superMajority, true);
  assert.equal(reordered.messageCoverage, true);
  assert.deepEqual(reordered.minimumMessageSenders, ["v0", "v1", "v2", "v3"]);
});
