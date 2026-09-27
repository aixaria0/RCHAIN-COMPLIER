import assert from "node:assert/strict";
import test from "node:test";
import { compileRealityRecord } from "./reality-record-adapter.ts";
import {
  sentinelBundleToRecord,
  type SentinelFinalizedBlockEvidence,
  type SentinelNetworkStatus,
} from "./sentinel-adapter.ts";
import { searchWeightedPossibility } from "./possibility-plane.ts";
import {
  buildAssuranceCertificate,
  conformanceCheckFromDigests,
  possibilityCheckFromSearch,
  recoveryCheckFromDigests,
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

const liveNetwork: SentinelNetworkStatus = {
  reachable: true,
  node_url: "http://rnode.example:40403",
  latency_ms: 7,
  http_status: 200,
  probe: "http://rnode.example:40403/api/status",
  error: null,
  rnode: {
    node: { id: "node-a", host: "rnode.example", port: 40403 },
    network_id: "testnet",
    shard_id: "root",
    latest_block_number: 18494,
    last_finalized_block_number: 18492,
    validator: true,
    ready: true,
    current_epoch: 42,
  },
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
    conformanceCheckFromDigests({
      id: "conformance_exact_replay",
      description: "Pinned implementation replay matched the expected digest.",
      expectedDigest: "state:abc",
      observedDigest: "state:abc",
    }),
    recoveryCheckFromDigests({
      id: "recovery_restart_state",
      description: "Recovered state digest matched the pre-restart finalized state.",
      preRecoveryDigest: "state:abc",
      recoveredDigest: "state:abc",
      independentProcess: true,
      independentDisk: true,
      checkpointTrusted: true,
    }),
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
    network: liveNetwork,
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
      epoch: 42,
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
    network: liveNetwork,
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
    network: liveNetwork,
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

test("digest helpers block missing evidence and fail mismatches", () => {
  const incomplete = conformanceCheckFromDigests({
    id: "missing_conformance",
    description: "missing observed digest",
    expectedDigest: "expected",
  });
  const mismatch = recoveryCheckFromDigests({
    id: "recovery_mismatch",
    description: "state changed across recovery",
    preRecoveryDigest: "before",
    recoveredDigest: "after",
    independentProcess: true,
    independentDisk: true,
    checkpointTrusted: true,
  });
  const weakMethod = recoveryCheckFromDigests({
    id: "recovery_same_runtime",
    description: "digest matched but restore did not use independent process/disk",
    preRecoveryDigest: "same",
    recoveredDigest: "same",
    independentProcess: false,
    independentDisk: false,
    checkpointTrusted: true,
  });

  assert.equal(incomplete.state, "BLOCKED");
  assert.equal(mismatch.state, "FAIL");
  assert.equal(weakMethod.state, "BLOCKED");
});


test("mislabeling a synthetic record as LIVE_OBSERVATION fails closed", () => {
  const synthetic = compileRealityRecord("hello-rho", "none");
  const certificate = buildAssuranceCertificate({
    issuedAt: "2026-09-27T00:01:00Z",
    release: { repository: "aixaria0/RCHAIN-COMPLIER", commit: "deadbeef" },
    network: { genesis: "genesis:test" },
    records: [{ label: "spoofed live source", sourceClass: "LIVE_OBSERVATION", record: synthetic }],
    checks: commonChecks(),
  });

  assert.equal(certificate.status, "FAIL");
  assert.equal(certificate.records[0]?.sourceClassVerified, false);
  assert.equal(
    certificate.checks.find((check) => check.id.startsWith("reality_source_class:"))?.state,
    "FAIL",
  );
});

test("non-critical or non-passing plane entries cannot satisfy a required gate", () => {
  const live = sentinelBundleToRecord({
    sentinelBaseUrl: "http://sentinel.example",
    collectedAt: "2026-09-27T00:02:00Z",
    evidence: liveEvidence,
    network: liveNetwork,
  });
  const certificate = buildAssuranceCertificate({
    issuedAt: "2026-09-27T00:02:01Z",
    release: { repository: "rchain-community/rchain-rust", commit: "pinned-rust-commit" },
    network: { genesis: "genesis:test" },
    records: [{ label: "live", sourceClass: "LIVE_OBSERVATION", record: live }],
    checks: [
      {
        id: "weak_possibility_marker",
        plane: "POSSIBILITY",
        state: "NOT_TESTED",
        critical: false,
        description: "placeholder only",
      },
      conformanceCheckFromDigests({
        id: "conformance",
        description: "matching conformance",
        expectedDigest: "x",
        observedDigest: "x",
      }),
      recoveryCheckFromDigests({
        id: "recovery",
        description: "valid recovery",
        preRecoveryDigest: "x",
        recoveredDigest: "x",
        independentProcess: true,
        independentDisk: true,
        checkpointTrusted: true,
      }),
    ],
  });

  assert.equal(certificate.status, "BLOCKED");
  assert.equal(
    certificate.checks.find((check) => check.id === "gate_possibility")?.state,
    "BLOCKED",
  );
});


test("strict revival policy cannot be weakened by the caller", () => {
  assert.throws(
    () =>
      buildAssuranceCertificate({
        issuedAt: "2026-09-27T00:03:00Z",
        release: { repository: "aixaria0/RCHAIN-COMPLIER", commit: "deadbeef" },
        network: { genesis: "genesis:test", networkId: "testnet", shardId: "root" },
        records: [],
        checks: [],
        requirements: { requireLiveObservation: false },
      }),
    /requirements cannot be weakened/,
  );
});

test("a manually forged PASS cannot satisfy a required assurance plane", () => {
  const live = sentinelBundleToRecord({
    sentinelBaseUrl: "http://sentinel.example",
    collectedAt: "2026-09-27T00:04:00Z",
    evidence: liveEvidence,
    network: liveNetwork,
  });
  const certificate = buildAssuranceCertificate({
    issuedAt: "2026-09-27T00:04:01Z",
    release: { repository: "rchain-community/rchain-rust", commit: "pinned-rust-commit" },
    network: { genesis: "genesis:test", networkId: "testnet", shardId: "root" },
    records: [{ label: "live", sourceClass: "LIVE_OBSERVATION", record: live }],
    checks: [
      {
        id: "forged-possibility-pass",
        plane: "POSSIBILITY",
        state: "PASS",
        critical: true,
        description: "caller asserted PASS without a trusted producer",
      },
      conformanceCheckFromDigests({
        id: "conformance",
        description: "matching conformance",
        expectedDigest: "x",
        observedDigest: "x",
      }),
      recoveryCheckFromDigests({
        id: "recovery",
        description: "valid recovery",
        preRecoveryDigest: "x",
        recoveredDigest: "x",
        independentProcess: true,
        independentDisk: true,
        checkpointTrusted: true,
      }),
    ],
  });

  const forged = certificate.checks.find((check) => check.id === "forged-possibility-pass");
  assert.equal(forged?.producerVerified, false);
  assert.equal(forged?.state, "BLOCKED");
  assert.equal(
    certificate.checks.find((check) => check.id === "gate_possibility")?.state,
    "BLOCKED",
  );
  assert.equal(certificate.status, "BLOCKED");
});

test("declared network identity must match the live Sentinel observation", () => {
  const live = sentinelBundleToRecord({
    sentinelBaseUrl: "http://sentinel.example",
    collectedAt: "2026-09-27T00:05:00Z",
    evidence: liveEvidence,
    network: liveNetwork,
  });
  const certificate = buildAssuranceCertificate({
    issuedAt: "2026-09-27T00:05:01Z",
    release: { repository: "rchain-community/rchain-rust", commit: "pinned-rust-commit" },
    network: { genesis: "genesis:test", networkId: "wrong-network", shardId: "root" },
    records: [{ label: "live", sourceClass: "LIVE_OBSERVATION", record: live }],
    checks: commonChecks(),
  });

  assert.equal(
    certificate.checks.find((check) => check.id === "reality_network_identity")?.state,
    "FAIL",
  );
  assert.equal(certificate.status, "FAIL");
});


test("live label is insufficient when Sentinel evidence is unavailable", () => {
  const unavailable = sentinelBundleToRecord({
    sentinelBaseUrl: "http://sentinel.example",
    collectedAt: "2026-09-27T00:06:00Z",
    evidence: {
      ...liveEvidence,
      available: false,
      full_block_available: false,
      full_block: null,
      full_block_hash: null,
      node_reported_finalized: null,
      finality_hash_match: null,
      canonical_consistency: null,
      canonical_mismatches: [],
      error: "RNode unavailable",
    },
    network: liveNetwork,
  });

  const certificate = buildAssuranceCertificate({
    issuedAt: "2026-09-27T00:06:01Z",
    release: { repository: "rchain-community/rchain-rust", commit: "pinned-rust-commit" },
    network: { genesis: "genesis:test", networkId: "testnet", shardId: "root" },
    records: [{ label: "unavailable live source", sourceClass: "LIVE_OBSERVATION", record: unavailable }],
    checks: commonChecks(),
  });

  assert.equal(
    certificate.checks.find((check) => check.id.startsWith("reality_live_quality:"))?.state,
    "BLOCKED",
  );
  assert.equal(
    certificate.checks.find((check) => check.id === "gate_live_observation")?.state,
    "BLOCKED",
  );
  assert.equal(certificate.status, "BLOCKED");
});

test("unreachable network status cannot satisfy the live observation gate", () => {
  const unreachable = sentinelBundleToRecord({
    sentinelBaseUrl: "http://sentinel.example",
    collectedAt: "2026-09-27T00:07:00Z",
    evidence: liveEvidence,
    network: {
      ...liveNetwork,
      reachable: false,
      error: "timeout",
    },
  });

  const certificate = buildAssuranceCertificate({
    issuedAt: "2026-09-27T00:07:01Z",
    release: { repository: "rchain-community/rchain-rust", commit: "pinned-rust-commit" },
    network: { genesis: "genesis:test", networkId: "testnet", shardId: "root" },
    records: [{ label: "unreachable live source", sourceClass: "LIVE_OBSERVATION", record: unreachable }],
    checks: commonChecks(),
  });

  assert.equal(
    certificate.checks.find((check) => check.id.startsWith("reality_live_quality:"))?.state,
    "BLOCKED",
  );
  assert.equal(certificate.status, "BLOCKED");
});
