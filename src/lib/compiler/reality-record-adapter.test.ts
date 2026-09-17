import assert from "node:assert/strict";
import test from "node:test";
import {
  compileRealityRecord,
  realityToRecord,
  verifyRealityRecordIntegrity,
} from "./index.ts";
import { compile } from "./compile.ts";

function assertLinkedChain(record: ReturnType<typeof compileRealityRecord>): void {
  assert.ok(record.observations.length >= 3, "expected multiple evidence-plane observations");
  for (let index = 1; index < record.observations.length; index += 1) {
    const current = record.observations[index]!;
    const previous = record.observations[index - 1]!;
    assert.equal(current.data.previousHash, previous.data.eventHash);
    assert.equal(current.data.parentEvent, previous.id);
  }
}

test("compileRealityRecord produces an inspectable baseline certificate", () => {
  const record = compileRealityRecord("exchange-commit", "none");

  assert.equal(record.schema, "rchain-reality-record/v1");
  assert.equal(record.source, "rchain-reality-compiler");
  assert.equal(record.subject.kind, "execution-claim");
  assert.equal(record.replay.state, "REPRODUCED");
  assert.ok(record.claims.length > 0);
  assert.ok(record.evidence.length === record.observations.length);
  assert.ok(record.dependencies.length > 0);
  assert.ok(record.transformations.length > 0);
  assert.ok(record.verification.length > 0);
  assert.equal(verifyRealityRecordIntegrity(record), true);
  assertLinkedChain(record);
});

test("equivalent compiler inputs produce the same portable certificate", () => {
  const first = compileRealityRecord("exchange-commit", "none");
  const second = compileRealityRecord("exchange-commit", "none");

  assert.equal(first.integrity.recordDigest, second.integrity.recordDigest);
  assert.deepEqual(first.observations, second.observations);
  assert.deepEqual(first.verification, second.verification);
});

test("tampered replay becomes a divergent Reality Record", () => {
  const record = compileRealityRecord("exchange-commit", "tamper-trace");

  assert.equal(record.replay.state, "DIVERGENT");
  assert.equal(record.state, "DIVERGENT");
  assert.ok(record.verification.some((check) => check.state === "DIVERGENT"));
  assert.equal(verifyRealityRecordIntegrity(record), true);
});

test("missing capability is represented as incomplete replay evidence", () => {
  const record = compileRealityRecord("cap-payment", "drop-capability");

  assert.equal(record.replay.available, false);
  assert.equal(record.replay.state, "INCOMPLETE");
  assert.notEqual(record.state, "VERIFIED");
  assert.equal(record.observations.length, 3);
  assert.equal(verifyRealityRecordIntegrity(record), true);
});

test("Reality Record chaining preserves previous digest without changing identity", () => {
  const baseline = compileRealityRecord("hello-rho", "none");
  const chained = compileRealityRecord("hello-rho", "none", baseline.integrity.recordDigest);

  assert.equal(chained.id, baseline.id);
  assert.equal(chained.integrity.previousDigest, baseline.integrity.recordDigest);
  assert.equal(chained.integrity.recordDigest, baseline.integrity.recordDigest);
});

test("realityToRecord keeps the existing compiler result as the source of truth", () => {
  const reality = compile("exchange-abort", "force-abort");
  const record = realityToRecord(reality);

  assert.equal(record.subject.id, reality.qos.eventId);
  assert.equal(record.observations.length, reality.envelopes.length);
  assert.deepEqual(
    record.claims.map((claim) => claim.statement),
    reality.claims.map((claim) => claim.statement),
  );
});
