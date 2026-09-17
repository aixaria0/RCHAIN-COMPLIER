import test from "node:test";
import assert from "node:assert/strict";
import {
  deriveRealityState,
  sealRealityRecord,
  verifyRealityRecordIntegrity,
} from "./reality-record.ts";

const base = {
  schema: "rchain-reality-record/v1" as const,
  id: "rr-test-001",
  subject: { id: "validator-1", kind: "validator", label: "V1" },
  source: "synthetic-rchain-fixture",
  observations: [
    {
      id: "obs-1",
      source: "sentinel-fixture",
      type: "consensus-event",
      data: { round: 1842, block: "b1842" },
    },
  ],
  claims: [
    {
      id: "claim-1",
      statement: "validator-1 participated in round 1842",
      basis: ["obs-1"],
    },
  ],
  evidence: [
    {
      id: "evidence-1",
      observationIds: ["obs-1"],
      description: "Observed consensus event",
    },
  ],
  dependencies: [],
  transformations: [
    {
      id: "normalize-1",
      name: "canonicalize-observation",
      inputIds: ["obs-1"],
      outputIds: ["evidence-1"],
      deterministic: true,
    },
  ],
  verification: [
    {
      id: "check-1",
      predicate: "evidence-complete",
      state: "CONSISTENT" as const,
      message: "Required evidence is present",
      evidenceIds: ["evidence-1"],
    },
  ],
  replay: {
    available: true,
    inputIds: ["obs-1"],
    expectedDigest: "abc",
    observedDigest: "abc",
    state: "REPRODUCED" as const,
  },
};

test("seals a deterministic Reality Record", () => {
  const record = sealRealityRecord(base);
  assert.equal(record.state, "REPRODUCED");
  assert.equal(record.integrity.algorithm, "SHA-256");
  assert.match(record.integrity.recordDigest, /^[0-9a-f]{64}$/);
  assert.equal(verifyRealityRecordIntegrity(record), true);

  const second = sealRealityRecord(base);
  assert.equal(second.integrity.recordDigest, record.integrity.recordDigest);
});

test("derives divergence from verification or replay evidence", () => {
  const divergent = {
    ...base,
    replay: { ...base.replay, state: "DIVERGENT" as const },
  };
  assert.equal(deriveRealityState(divergent), "DIVERGENT");
});

test("does not upgrade incomplete evidence", () => {
  const incomplete = {
    ...base,
    verification: [
      {
        ...base.verification[0],
        state: "INCOMPLETE" as const,
      },
    ],
    replay: { ...base.replay, state: "INCOMPLETE" as const },
  };
  assert.equal(deriveRealityState(incomplete), "INCOMPLETE");
});
