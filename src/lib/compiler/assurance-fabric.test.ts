import assert from "node:assert/strict";
import test from "node:test";
import { compileRealityRecord } from "./reality-record-adapter.ts";
import {
  sentinelBundleToRecord,
  type SentinelFinalizedBlockEvidence,
} from "./sentinel-adapter.ts";
import { searchWeightedPossibility } from "./possibility-plane.ts";
import {
  buildAssuranceCertificate,
  possibilityCheckFromSearch,
  verifyAssuranceCertificateIntegrity,
} from "./assurance-fabric.ts";

const liveEvidence: SentinelFinalizedBlockEvidence = {
  available: true,
  raw: { blockHash: "abc123", height: 18492 },
  payload_sha256: "deadbeef",
  block_hash: "abc123",
  parent_hash: "parent123",
  proposer: "val_0a17",
  signature: "sig",
  justification_present: true,
  full_block_available: true,
  full_block: { blockHash: "abc123", height: 18492 },
  full_block_hash: "abc123",
  node_reported_finalized: true,
  finality_hash_match: true,
  canonical_consistency: true,
  canonical_mismatches: [],
  finality_error: null,
  error: null,
};

function possibilityPass() {
  const result = searchWeightedPossibility<number>({
    initial: 0,
    stateKey: String,
    isGoal: (state) => state === 2,
    expand: (state) => (state < 2 ? [{ to: state + 1, label: "mutation", cost: 1 }] : []),
  });
  return possibilityCheckFromSearch({
    id: "possibility_minimum_witness",
    description: "Minimum two-step witness remains reachable in the bounded model.",
    result,
    expected: "REACHABLE",
  });
}

function commonChecks() {
  return [
    possibilityPass(),
    {
      id: "conformance_exact_replay",
      plane: "CONFORMANCE" as const,
      state: "PASS" as const,
      description: "Pinned implementation replay matched the expected digest.",
      evidence: ["replay:abc"],
    },
    {
      id: "recovery_restart_state",
      plane: "RECOVERY" as const,
      state: "PASS" as const,
      description: "Recovered state digest matched the pre-restart finalized state.",
      evidence: ["state:abc"],
    },
  ];
}

test("synthetic evidence cannot promote a certificate through the live gate", () => {
  const synthetic = compileRealityRecord("hello-rho", "none");
  const certificate = buildAssuranceCertificate({
    issuedAt: "2026-09-27T00:00:00Z",
    release: { repository: "aixaria0/RCHAIN-COMPLIER", commit: "deadbeef" },
    network: { genesis: "genesis:test" },
    records: [{ label: "synthetic fixture", sourceClass: "SYNTHETIC", record: synthetic }],
    checks: commonChecks(),
  });

  assert.equal(certificate.status, "BLOCKED");
  assert.equal(
    certificate.checks.find((check) => check.id === "gate_live_observation")?.state,
    "BLOCKED",
  );
  assert.equal(verifyAssuranceCertificateIntegrity(certificate), true);
});

test("live reality + possibility + conformance + recovery can produce PASS", () => {
  const live = sentinelBundleToRecord({
    sentinelBaseUrl: "http://sentinel.example",
    collectedAt: "2026-09-27T00:00:00Z",
    evidence: liveEvidence,
  });

  const certificate = buildAssuranceCertificate({
    issuedAt: "2026-09-27T00:00:01Z",
    release: {
      repository: "rchain-community/rchain-rust",
      commit: "pinned-rust-commit",
      binaryDigest: "sha256:binary",
    },
    network: {
      genesis: "genesis:test",
      networkId: "testnet",
      shardId: "root",
    },
    records: [{ label: "Sentinel live observation", sourceClass: "LIVE_OBSERVATION", record: live }],
    checks: commonChecks(),
  });

  assert.equal(certificate.status, "PASS");
  assert.equal(certificate.records[0]?.sourceClass, "LIVE_OBSERVATION");
  assert.equal(verifyAssuranceCertificateIntegrity(certificate), true);
});

test("a divergent live Reality Record forces the certificate to FAIL", () => {
  const divergent = sentinelBundleToRecord({
    sentinelBaseUrl: "http://sentinel.example",
    collectedAt: "2026-09-27T00:00:00Z",
    evidence: {
      ...liveEvidence,
      canonical_consistency: false,
      canonical_mismatches: ["parent_hash"],
    },
  });

  const certificate = buildAssuranceCertificate({
    issuedAt: "2026-09-27T00:00:02Z",
    release: { repository: "rchain-community/rchain-rust", commit: "pinned-rust-commit" },
    network: { genesis: "genesis:test" },
    records: [{ label: "divergent live observation", sourceClass: "LIVE_OBSERVATION", record: divergent }],
    checks: commonChecks(),
  });

  assert.equal(certificate.status, "FAIL");
  assert.ok(
    certificate.checks.some(
      (check) => check.plane === "REALITY" && check.state === "FAIL",
    ),
  );
});

test("certificate integrity detects post-seal tampering", () => {
  const live = sentinelBundleToRecord({
    sentinelBaseUrl: "http://sentinel.example",
    collectedAt: "2026-09-27T00:00:00Z",
    evidence: liveEvidence,
  });
  const certificate = buildAssuranceCertificate({
    issuedAt: "2026-09-27T00:00:03Z",
    release: { repository: "rchain-community/rchain-rust", commit: "pinned-rust-commit" },
    network: { genesis: "genesis:test" },
    records: [{ label: "live", sourceClass: "LIVE_OBSERVATION", record: live }],
    checks: commonChecks(),
  });

  certificate.checks[0]!.description = "tampered";
  assert.equal(verifyAssuranceCertificateIntegrity(certificate), false);
});
