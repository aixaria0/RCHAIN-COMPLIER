import assert from "node:assert/strict";
import test from "node:test";
import { compileRealityRecord } from "./reality-record-adapter.ts";
import { sealRealityRecord } from "./reality-record.ts";
import {
  sentinelBundleToRecord,
  type SentinelCrossNodeReport,
  type SentinelFinalizedBlockEvidence,
  type SentinelNetworkStatus,
} from "./sentinel-adapter.ts";
import { searchWeightedPossibility } from "./possibility-plane.ts";
import {
  SENTINEL_ATTESTATION_SCHEMA,
  sentinelAttestationPayloadDigest,
  sentinelAttestationPublicKeyId,
  sentinelAttestationSigningBytes,
  signedSentinelAttestationToRecord,
  type SignedSentinelAttestation,
} from "./sentinel-signed-adapter.ts";
import {
  buildAssuranceCertificate,
  conformanceCheckFromDigests,
  conformanceCheckFromRealityRecord,
  possibilityCheckFromSearch,
  recoveryCheckFromDigests,
  recoveryCheckFromRecordChain,
  validateAssuranceCertificate,
  verifyAssuranceCertificateIntegrity,
  verifyAssuranceCertificatePolicy,
} from "./assurance-fabric.ts";

const RELEASE_COMMIT = "a".repeat(40);
const RELEASE_BINARY = `sha256:${"b".repeat(64)}`;
const RELEASE_PROVENANCE = `sha256:${"c".repeat(64)}`;

function releaseIdentity(repository = "rchain-community/rchain-rust") {
  return {
    repository,
    commit: RELEASE_COMMIT,
    binaryDigest: RELEASE_BINARY,
    buildProvenance: RELEASE_PROVENANCE,
  };
}

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

const liveCrossNode: SentinelCrossNodeReport = {
  target_count: 2,
  reachable_count: 2,
  evidence_count: 2,
  agreeing_nodes: 2,
  quorum_required: 2,
  quorum_observed: true,
  agreement_ratio: 1,
  common_finalized_height: 18492,
  common_block_hash: "abc123",
  height_agreement: true,
  hash_agreement: true,
  missing_height_nodes: 0,
  missing_hash_nodes: 0,
  conflicting_nodes: 0,
  agreement: true,
  status: "pass",
  verification_basis: "two targets agree; not a stake-weighted Casper finality proof",
  observations: [
    {
      node_url: "http://node-a:40403",
      reachable: true,
      finalized_height: 18492,
      block_hash: "abc123",
      payload_sha256: "deadbeef-a",
      proposer: "val_0a17",
      signature_present: true,
      justification_present: true,
      full_block_available: true,
      full_block_hash_match: true,
      node_reported_finalized: true,
    },
    {
      node_url: "http://node-b:40403",
      reachable: true,
      finalized_height: 18492,
      block_hash: "abc123",
      payload_sha256: "deadbeef-b",
      proposer: "val_0a17",
      signature_present: true,
      justification_present: true,
      full_block_available: true,
      full_block_hash_match: true,
      node_reported_finalized: true,
    },
  ],
};

function testBytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function testArrayBuffer(value: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(value.byteLength);
  new Uint8Array(buffer).set(value);
  return buffer;
}

const TEST_OBSERVER_KEY_PAIR = await globalThis.crypto.subtle.generateKey(
  { name: "Ed25519" },
  true,
  ["sign", "verify"],
) as CryptoKeyPair;
const TEST_OBSERVER_PUBLIC_KEY = new Uint8Array(
  await globalThis.crypto.subtle.exportKey("raw", TEST_OBSERVER_KEY_PAIR.publicKey),
);
const TEST_OBSERVER_PUBLIC_KEY_HEX = testBytesToHex(TEST_OBSERVER_PUBLIC_KEY);
const TEST_OBSERVER_KEY_ID = await sentinelAttestationPublicKeyId(
  TEST_OBSERVER_PUBLIC_KEY_HEX,
);

async function signedLiveRecord(collectedAt: string) {
  const payload: SignedSentinelAttestation["payload"] = {
    schema: SENTINEL_ATTESTATION_SCHEMA,
    collected_at_unix_ms: Date.parse(collectedAt),
    network: liveNetwork,
    finalized_block: liveEvidence,
    cross_node: liveCrossNode,
  };
  const payloadDigest = await sentinelAttestationPayloadDigest(payload);
  const signature = new Uint8Array(
    await globalThis.crypto.subtle.sign(
      { name: "Ed25519" },
      TEST_OBSERVER_KEY_PAIR.privateKey,
      testArrayBuffer(sentinelAttestationSigningBytes(payload)),
    ),
  );
  const snapshot: SignedSentinelAttestation = {
    schema: SENTINEL_ATTESTATION_SCHEMA,
    payload,
    payload_sha256: payloadDigest,
    signature: {
      algorithm: "Ed25519",
      key_id: TEST_OBSERVER_KEY_ID,
      public_key_hex: TEST_OBSERVER_PUBLIC_KEY_HEX,
      signature_hex: testBytesToHex(signature),
    },
  };

  return signedSentinelAttestationToRecord({
    snapshot,
    sentinelBaseUrl: "http://sentinel.example",
    expectedKeyId: TEST_OBSERVER_KEY_ID,
  });
}

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

function nativeReplayPair() {
  const before = sealRealityRecord({
    schema: "rchain-reality-record/v1",
    id: "native-replay:before",
    subject: {
      id: "native-state:test",
      kind: "native-replay",
      label: "Pinned Rust replay before recovery",
    },
    source: "rchain-rust-native-replay",
    observations: [
      {
        id: "native-state-before",
        source: "rchain-rust-native-replay",
        type: "StateDigest",
        data: { stateDigest: "state:abc" },
      },
    ],
    claims: [],
    evidence: [],
    dependencies: [],
    transformations: [],
    verification: [
      {
        id: "native_replay_before",
        predicate: "expectedDigest === observedDigest",
        state: "VERIFIED",
        message: "Pinned native replay matched.",
        evidenceIds: [],
      },
    ],
    replay: {
      available: true,
      inputIds: [],
      expectedDigest: "state:abc",
      observedDigest: "state:abc",
      state: "REPRODUCED",
    },
  });

  const after = sealRealityRecord(
    {
      schema: "rchain-reality-record/v1",
      id: "native-replay:after",
      subject: {
        id: "native-state:test",
        kind: "native-replay",
        label: "Pinned Rust replay after recovery",
      },
      source: "rchain-rust-native-replay",
      observations: [
        {
          id: "recovery-context",
          source: "rchain-rust-native-replay",
          type: "RecoveryContext",
          data: {
            preProcessId: "proc-before",
            recoveredProcessId: "proc-after",
            preDiskId: "disk-before",
            recoveredDiskId: "disk-after",
            checkpointTrusted: true,
          },
        },
      ],
      claims: [],
      evidence: [],
      dependencies: [],
      transformations: [],
      verification: [
        {
          id: "native_replay_after",
          predicate: "recoveredDigest === preRecoveryDigest",
          state: "VERIFIED",
          message: "Recovered native replay matched the pre-recovery state.",
          evidenceIds: [],
        },
      ],
      replay: {
        available: true,
        inputIds: [],
        expectedDigest: "state:abc",
        observedDigest: "state:abc",
        state: "REPRODUCED",
      },
    },
    before.integrity.recordDigest,
  );

  return { before, after };
}

function commonChecks() {
  const native = nativeReplayPair();
  return [
    possibilityPass(),
    conformanceCheckFromRealityRecord({
      id: "conformance_exact_replay",
      description: "Pinned implementation replay matched the expected digest.",
      record: native.before,
    }),
    recoveryCheckFromRecordChain({
      id: "recovery_restart_state",
      description: "Recovered state remained linked and identical across an independent process/disk restore.",
      before: native.before,
      after: native.after,
    }),
  ];
}

test("synthetic evidence cannot promote a certificate through the live gate", () => {
  const synthetic = compileRealityRecord("hello-rho", "none");
  const certificate = buildAssuranceCertificate({
    issuedAt: "2026-09-27T00:00:00Z",
    freshness: { maxObservationAgeMs: 60_000 },
    release: releaseIdentity("aixaria0/RCHAIN-COMPLIER"),
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

test("live reality + possibility + conformance + recovery can produce PASS", async () => {
  const live = await signedLiveRecord("2026-09-27T00:00:00Z");

  const certificate = buildAssuranceCertificate({
    issuedAt: "2026-09-27T00:00:01Z",
    freshness: { maxObservationAgeMs: 60_000 },
    release: releaseIdentity(),
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
    crossNode: liveCrossNode,
  });

  const certificate = buildAssuranceCertificate({
    issuedAt: "2026-09-27T00:00:02Z",
    freshness: { maxObservationAgeMs: 60_000 },
    release: releaseIdentity(),
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
    crossNode: liveCrossNode,
  });
  const certificate = buildAssuranceCertificate({
    issuedAt: "2026-09-27T00:00:03Z",
    freshness: { maxObservationAgeMs: 60_000 },
    release: releaseIdentity(),
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
    freshness: { maxObservationAgeMs: 60_000 },
    release: releaseIdentity("aixaria0/RCHAIN-COMPLIER"),
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
    crossNode: liveCrossNode,
  });
  const certificate = buildAssuranceCertificate({
    issuedAt: "2026-09-27T00:02:01Z",
    freshness: { maxObservationAgeMs: 60_000 },
    release: releaseIdentity(),
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
    freshness: { maxObservationAgeMs: 60_000 },
        release: releaseIdentity("aixaria0/RCHAIN-COMPLIER"),
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
    crossNode: liveCrossNode,
  });
  const certificate = buildAssuranceCertificate({
    issuedAt: "2026-09-27T00:04:01Z",
    freshness: { maxObservationAgeMs: 60_000 },
    release: releaseIdentity(),
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
    crossNode: liveCrossNode,
  });
  const certificate = buildAssuranceCertificate({
    issuedAt: "2026-09-27T00:05:01Z",
    freshness: { maxObservationAgeMs: 60_000 },
    release: releaseIdentity(),
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
    crossNode: liveCrossNode,
  });

  const certificate = buildAssuranceCertificate({
    issuedAt: "2026-09-27T00:06:01Z",
    freshness: { maxObservationAgeMs: 60_000 },
    release: releaseIdentity(),
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
    crossNode: liveCrossNode,
  });

  const certificate = buildAssuranceCertificate({
    issuedAt: "2026-09-27T00:07:01Z",
    freshness: { maxObservationAgeMs: 60_000 },
    release: releaseIdentity(),
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


test("stale live evidence blocks promotion under the declared freshness budget", () => {
  const stale = sentinelBundleToRecord({
    sentinelBaseUrl: "http://sentinel.example",
    collectedAt: "2026-09-27T00:00:00Z",
    evidence: liveEvidence,
    network: liveNetwork,
    crossNode: liveCrossNode,
  });
  const certificate = buildAssuranceCertificate({
    issuedAt: "2026-09-27T00:10:00Z",
    freshness: { maxObservationAgeMs: 60_000 },
    release: releaseIdentity(),
    network: { genesis: "genesis:test", networkId: "testnet", shardId: "root" },
    records: [{ label: "stale live", sourceClass: "LIVE_OBSERVATION", record: stale }],
    checks: commonChecks(),
  });

  assert.equal(
    certificate.checks.find((check) => check.id === "reality_freshness")?.state,
    "BLOCKED",
  );
  assert.equal(certificate.status, "BLOCKED");
});

test("future-dated live evidence fails freshness validation", async () => {
  const future = await signedLiveRecord("2026-09-27T00:10:00Z");
  const certificate = buildAssuranceCertificate({
    issuedAt: "2026-09-27T00:09:00Z",
    freshness: { maxObservationAgeMs: 60_000 },
    release: releaseIdentity(),
    network: { genesis: "genesis:test", networkId: "testnet", shardId: "root" },
    records: [{ label: "future live", sourceClass: "LIVE_OBSERVATION", record: future }],
    checks: commonChecks(),
  });

  assert.equal(
    certificate.checks.find((check) => check.id === "reality_freshness")?.state,
    "FAIL",
  );
  assert.equal(certificate.status, "FAIL");
});


test("certificate identity changes with issuance scope and evidence", () => {
  const live = sentinelBundleToRecord({
    sentinelBaseUrl: "http://sentinel.example",
    collectedAt: "2026-09-27T00:08:00Z",
    evidence: liveEvidence,
    network: liveNetwork,
    crossNode: liveCrossNode,
  });
  const base = {
    freshness: { maxObservationAgeMs: 60_000 },
    release: releaseIdentity(),
    network: { genesis: "genesis:test", networkId: "testnet", shardId: "root" },
    records: [{ label: "live", sourceClass: "LIVE_OBSERVATION" as const, record: live }],
    checks: commonChecks(),
  };
  const first = buildAssuranceCertificate({
    ...base,
    issuedAt: "2026-09-27T00:08:01Z",
  });
  const second = buildAssuranceCertificate({
    ...base,
    issuedAt: "2026-09-27T00:08:02Z",
  });

  assert.notEqual(first.id, second.id);
  assert.notEqual(first.integrity.certificateDigest, second.integrity.certificateDigest);
});

test("policy validator rejects a weakened serialized certificate even independently of policy claims", () => {
  const live = sentinelBundleToRecord({
    sentinelBaseUrl: "http://sentinel.example",
    collectedAt: "2026-09-27T00:09:00Z",
    evidence: liveEvidence,
    network: liveNetwork,
    crossNode: liveCrossNode,
  });
  const certificate = buildAssuranceCertificate({
    issuedAt: "2026-09-27T00:09:01Z",
    freshness: { maxObservationAgeMs: 60_000 },
    release: releaseIdentity(),
    network: { genesis: "genesis:test", networkId: "testnet", shardId: "root" },
    records: [{ label: "live", sourceClass: "LIVE_OBSERVATION", record: live }],
    checks: commonChecks(),
  });

  assert.equal(verifyAssuranceCertificatePolicy(certificate), true);
  assert.equal(validateAssuranceCertificate(certificate).valid, true);

  const weakened = structuredClone(certificate);
  weakened.requirements.requireRecovery = false;
  assert.equal(verifyAssuranceCertificatePolicy(weakened), false);
  assert.equal(validateAssuranceCertificate(weakened).valid, false);

  const stripped = structuredClone(certificate);
  stripped.limitations = stripped.limitations.slice(1);
  assert.equal(verifyAssuranceCertificatePolicy(stripped), false);
  assert.equal(validateAssuranceCertificate(stripped).valid, false);
});


test("a source string alone cannot impersonate the Sentinel live adapter shape", () => {
  const valid = sentinelBundleToRecord({
    sentinelBaseUrl: "http://sentinel.example",
    collectedAt: "2026-09-27T00:11:00Z",
    evidence: liveEvidence,
    network: liveNetwork,
    crossNode: liveCrossNode,
  });
  const { integrity: _integrity, state: _state, ...payload } = valid;
  const malformed = sealRealityRecord({
    ...payload,
    subject: {
      ...payload.subject,
      kind: "forged-sentinel-shape",
    },
  });

  const certificate = buildAssuranceCertificate({
    issuedAt: "2026-09-27T00:11:01Z",
    freshness: { maxObservationAgeMs: 60_000 },
    release: releaseIdentity(),
    network: { genesis: "genesis:test", networkId: "testnet", shardId: "root" },
    records: [{ label: "malformed live", sourceClass: "LIVE_OBSERVATION", record: malformed }],
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


test("missing binary or provenance identity blocks strict promotion", () => {
  const live = sentinelBundleToRecord({
    sentinelBaseUrl: "http://sentinel.example",
    collectedAt: "2026-09-27T00:12:00Z",
    evidence: liveEvidence,
    network: liveNetwork,
    crossNode: liveCrossNode,
  });
  const certificate = buildAssuranceCertificate({
    issuedAt: "2026-09-27T00:12:01Z",
    freshness: { maxObservationAgeMs: 60_000 },
    release: {
      repository: "rchain-community/rchain-rust",
      commit: RELEASE_COMMIT,
    },
    network: { genesis: "genesis:test", networkId: "testnet", shardId: "root" },
    records: [{ label: "live", sourceClass: "LIVE_OBSERVATION", record: live }],
    checks: commonChecks(),
  });

  assert.equal(
    certificate.checks.find((check) => check.id === "supply_chain_release_identity")?.state,
    "BLOCKED",
  );
  assert.equal(
    certificate.checks.find((check) => check.id === "gate_release_artifact_identity")?.state,
    "BLOCKED",
  );
  assert.equal(certificate.status, "BLOCKED");
  assert.ok(certificate.limitations.some((item) => item.includes("not signer authenticity")));
});


test("free-form digest helpers remain diagnostic and cannot satisfy strict promotion", () => {
  const live = sentinelBundleToRecord({
    sentinelBaseUrl: "http://sentinel.example",
    collectedAt: "2026-09-27T00:13:00Z",
    evidence: liveEvidence,
    network: liveNetwork,
    crossNode: liveCrossNode,
  });
  const certificate = buildAssuranceCertificate({
    issuedAt: "2026-09-27T00:13:01Z",
    freshness: { maxObservationAgeMs: 60_000 },
    release: releaseIdentity(),
    network: { genesis: "genesis:test", networkId: "testnet", shardId: "root" },
    records: [{ label: "live", sourceClass: "LIVE_OBSERVATION", record: live }],
    checks: [
      possibilityPass(),
      conformanceCheckFromDigests({
        id: "diagnostic-conformance",
        description: "free-form matching digests",
        expectedDigest: "x",
        observedDigest: "x",
      }),
      recoveryCheckFromDigests({
        id: "diagnostic-recovery",
        description: "free-form recovery digests",
        preRecoveryDigest: "x",
        recoveredDigest: "x",
        independentProcess: true,
        independentDisk: true,
        checkpointTrusted: true,
      }),
    ],
  });

  assert.equal(
    certificate.checks.find((check) => check.id === "gate_conformance")?.state,
    "BLOCKED",
  );
  assert.equal(
    certificate.checks.find((check) => check.id === "gate_recovery")?.state,
    "BLOCKED",
  );
  assert.equal(certificate.status, "BLOCKED");
});


test("recovery record chain must preserve digest linkage", () => {
  const native = nativeReplayPair();
  const { integrity: _integrity, state: _state, ...afterPayload } = native.after;
  const unlinkedAfter = sealRealityRecord(afterPayload);

  const check = recoveryCheckFromRecordChain({
    id: "broken-recovery-chain",
    description: "after-record lost previousDigest linkage",
    before: native.before,
    after: unlinkedAfter,
  });

  const live = sentinelBundleToRecord({
    sentinelBaseUrl: "http://sentinel.example",
    collectedAt: "2026-09-27T00:14:00Z",
    evidence: liveEvidence,
    network: liveNetwork,
    crossNode: liveCrossNode,
  });
  const certificate = buildAssuranceCertificate({
    issuedAt: "2026-09-27T00:14:01Z",
    freshness: { maxObservationAgeMs: 60_000 },
    release: releaseIdentity(),
    network: { genesis: "genesis:test", networkId: "testnet", shardId: "root" },
    records: [{ label: "live", sourceClass: "LIVE_OBSERVATION", record: live }],
    checks: [
      possibilityPass(),
      conformanceCheckFromRealityRecord({
        id: "conformance",
        description: "native replay",
        record: native.before,
      }),
      check,
    ],
  });

  assert.equal(check.state, "BLOCKED");
  assert.equal(
    certificate.checks.find((item) => item.id === "gate_recovery")?.state,
    "BLOCKED",
  );
});

test("recovery state mismatch becomes FAIL rather than BLOCKED", () => {
  const native = nativeReplayPair();
  const { integrity: _integrity, state: _state, ...afterPayload } = native.after;
  const mismatchedAfter = sealRealityRecord(
    {
      ...afterPayload,
      replay: {
        ...afterPayload.replay,
        observedDigest: "state:different",
      },
    },
    native.before.integrity.recordDigest,
  );

  const check = recoveryCheckFromRecordChain({
    id: "recovery-state-mismatch",
    description: "recovered state differs from pre-recovery state",
    before: native.before,
    after: mismatchedAfter,
  });

  assert.equal(check.state, "FAIL");
});


test("unsigned live Sentinel evidence cannot satisfy the observer-signature gate", () => {
  const unsigned = sentinelBundleToRecord({
    sentinelBaseUrl: "http://sentinel.example",
    collectedAt: "2026-09-27T00:15:00Z",
    evidence: liveEvidence,
    network: liveNetwork,
    crossNode: liveCrossNode,
  });
  const certificate = buildAssuranceCertificate({
    issuedAt: "2026-09-27T00:15:01Z",
    freshness: { maxObservationAgeMs: 60_000 },
    release: releaseIdentity(),
    network: { genesis: "genesis:test", networkId: "testnet", shardId: "root" },
    records: [{ label: "unsigned live", sourceClass: "LIVE_OBSERVATION", record: unsigned }],
    checks: commonChecks(),
  });

  assert.equal(
    certificate.checks.find((check) => check.id === "gate_observer_signature")?.state,
    "BLOCKED",
  );
  assert.equal(
    certificate.checks.find((check) => check.id === "gate_live_observation")?.state,
    "BLOCKED",
  );
  assert.equal(certificate.status, "BLOCKED");
});
