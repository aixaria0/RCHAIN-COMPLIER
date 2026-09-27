import assert from "node:assert/strict";
import test from "node:test";
import {
  attestationPayloadDigest,
  attestationPublicKeyId,
  attestationSigningBytes,
} from "./attestation-crypto.ts";
import {
  buildAssuranceCertificate,
  conformanceCheckFromRealityRecord,
  possibilityCheckFromSearch,
  recoveryCheckFromRecordChain,
} from "./assurance-fabric.ts";
import {
  ASSURANCE_PACKAGE_SCHEMA,
  assurancePackagePayloadDigest,
  assurancePackageSigningBytes,
  verifyAssurancePackage,
  type AssurancePackagePayload,
  type SignedAssurancePackage,
} from "./assurance-package.ts";
import {
  BUILD_PROVENANCE_ATTESTATION_SCHEMA,
  IN_TOTO_STATEMENT_V1,
  SLSA_PROVENANCE_V1,
  signedBuildProvenanceAttestationToVerified,
  type BuildProvenanceAttestationPayload,
  type SignedBuildProvenanceAttestation,
} from "./build-provenance-signed-adapter.ts";
import {
  NATIVE_REPLAY_ATTESTATION_SCHEMA,
  signedNativeReplayAttestationToRecord,
  type NativeReplayAttestationPayload,
  type SignedNativeReplayAttestation,
} from "./native-replay-signed-adapter.ts";
import { searchWeightedPossibility } from "./possibility-plane.ts";
import {
  SENTINEL_ATTESTATION_SCHEMA,
  signedSentinelAttestationToRecord,
  type SignedSentinelAttestation,
} from "./sentinel-signed-adapter.ts";

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function arrayBuffer(value: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(value.byteLength);
  new Uint8Array(buffer).set(value);
  return buffer;
}

async function keyMaterial() {
  const pair = await globalThis.crypto.subtle.generateKey(
    { name: "Ed25519" },
    true,
    ["sign", "verify"],
  ) as CryptoKeyPair;
  const publicKey = new Uint8Array(
    await globalThis.crypto.subtle.exportKey("raw", pair.publicKey),
  );
  const publicKeyHex = bytesToHex(publicKey);
  const keyId = await attestationPublicKeyId(publicKeyHex);
  return { pair, publicKeyHex, keyId };
}

async function signAttestation<T extends object>(args: {
  schema: string;
  payload: T;
  key: Awaited<ReturnType<typeof keyMaterial>>;
}) {
  const payloadDigest = await attestationPayloadDigest(args.payload);
  const signature = new Uint8Array(
    await globalThis.crypto.subtle.sign(
      { name: "Ed25519" },
      args.key.pair.privateKey,
      arrayBuffer(attestationSigningBytes(args.schema, args.payload)),
    ),
  );
  return {
    payloadDigest,
    signature: {
      algorithm: "Ed25519" as const,
      key_id: args.key.keyId,
      public_key_hex: args.key.publicKeyHex,
      signature_hex: bytesToHex(signature),
    },
  };
}

const COMMIT = "a".repeat(40);
const BINARY = `sha256:${"b".repeat(64)}`;
const STATE = `sha256:${"c".repeat(64)}`;
const INPUT = `sha256:${"d".repeat(64)}`;
const CHECKPOINT = `sha256:${"e".repeat(64)}`;
const RECOVERY_LOG = `sha256:${"1".repeat(64)}`;
const RESTORE_TOOL = `sha256:${"2".repeat(64)}`;
const GENESIS = "genesis:test";
const BUILDER_ID = "https://github.com/actions/runner";

test("portable Assurance Package re-verifies every signed source and exact Reality Record set", async () => {
  const builderKey = await keyMaterial();
  const observerKey = await keyMaterial();
  const nativeKey = await keyMaterial();
  const reviewerKey = await keyMaterial();

  const provenancePayload: BuildProvenanceAttestationPayload = {
    schema: BUILD_PROVENANCE_ATTESTATION_SCHEMA,
    release: {
      repository: "rchain-community/rchain-rust",
      commit: COMMIT,
      binary_sha256: BINARY,
    },
    statement: {
      _type: IN_TOTO_STATEMENT_V1,
      subject: [{
        name: "rnode",
        digest: { sha256: BINARY.replace(/^sha256:/, "") },
      }],
      predicateType: SLSA_PROVENANCE_V1,
      predicate: {
        buildDefinition: {
          buildType: "https://github.com/actions/workflow/v1",
          externalParameters: {
            repository: "rchain-community/rchain-rust",
          },
          resolvedDependencies: [{
            uri: "git+https://github.com/rchain-community/rchain-rust@refs/heads/dev",
            digest: { gitCommit: COMMIT },
          }],
        },
        runDetails: {
          builder: { id: BUILDER_ID },
        },
      },
    },
  };
  const provenanceSigned = await signAttestation({
    schema: BUILD_PROVENANCE_ATTESTATION_SCHEMA,
    payload: provenancePayload,
    key: builderKey,
  });
  const provenanceSnapshot: SignedBuildProvenanceAttestation = {
    schema: BUILD_PROVENANCE_ATTESTATION_SCHEMA,
    payload: provenancePayload,
    payload_sha256: provenanceSigned.payloadDigest,
    signature: provenanceSigned.signature,
  };
  const provenance = await signedBuildProvenanceAttestationToVerified({
    snapshot: provenanceSnapshot,
    expectedKeyId: builderKey.keyId,
  });

  const sentinelPayload: SignedSentinelAttestation["payload"] = {
    schema: SENTINEL_ATTESTATION_SCHEMA,
    collected_at_unix_ms: Date.parse("2026-09-27T00:00:00Z"),
    network: {
      reachable: true,
      node_url: "http://node-a:40403",
      latency_ms: 5,
      http_status: 200,
      probe: "status",
      error: null,
      rnode: {
        node: { id: "node-a", host: "node-a", port: 40403 },
        network_id: "testnet",
        shard_id: "root",
        latest_block_number: 11,
        last_finalized_block_number: 10,
        validator: true,
        ready: true,
        current_epoch: 42,
      },
    },
    genesis: {
      configured_hash: GENESIS,
      available: true,
      raw: { blockHash: GENESIS, blockNumber: 0 },
      payload_sha256: `sha256:${"3".repeat(64)}`,
      observed_hash: GENESIS,
      observed_height: 0,
      hash_match: true,
      height_zero: true,
      error: null,
    },
    finalized_block: {
      available: true,
      raw: { blockHash: "abc123", blockNumber: 10 },
      payload_sha256: "deadbeef",
      block_hash: "abc123",
      parent_hash: "parent123",
      proposer: "validator-a",
      signature: "sig",
      justification_present: true,
      full_block_available: true,
      full_block: { blockHash: "abc123", blockNumber: 10 },
      full_block_hash: "abc123",
      node_reported_finalized: true,
      finality_hash_match: true,
      canonical_consistency: true,
      canonical_mismatches: [],
      finality_error: null,
      error: null,
    },
    cross_node: {
      target_count: 2,
      reachable_count: 2,
      evidence_count: 2,
      agreeing_nodes: 2,
      quorum_required: 2,
      quorum_observed: true,
      agreement_ratio: 1,
      common_finalized_height: 10,
      common_block_hash: "abc123",
      height_agreement: true,
      hash_agreement: true,
      missing_height_nodes: 0,
      missing_hash_nodes: 0,
      conflicting_nodes: 0,
      agreement: true,
      status: "pass",
      verification_basis: "endpoint consistency only",
      observations: [
        {
          node_url: "http://node-a:40403",
          reachable: true,
          finalized_height: 10,
          block_hash: "abc123",
          payload_sha256: "a",
          proposer: "validator-a",
          signature_present: true,
          justification_present: true,
          full_block_available: true,
          full_block_hash_match: true,
          node_reported_finalized: true,
        },
        {
          node_url: "http://node-b:40403",
          reachable: true,
          finalized_height: 10,
          block_hash: "abc123",
          payload_sha256: "b",
          proposer: "validator-b",
          signature_present: true,
          justification_present: true,
          full_block_available: true,
          full_block_hash_match: true,
          node_reported_finalized: true,
        },
      ],
    },
    failure_domains: [
      {
        node_url: "http://node-a:40403",
        operator_id: "operator-a",
        provider_id: "provider-a",
        region: "region-a",
        failure_domain_id: "domain-a",
      },
      {
        node_url: "http://node-b:40403",
        operator_id: "operator-b",
        provider_id: "provider-b",
        region: "region-b",
        failure_domain_id: "domain-b",
      },
    ],
  };
  const sentinelSigned = await signAttestation({
    schema: SENTINEL_ATTESTATION_SCHEMA,
    payload: sentinelPayload,
    key: observerKey,
  });
  const sentinelSnapshot: SignedSentinelAttestation = {
    schema: SENTINEL_ATTESTATION_SCHEMA,
    payload: sentinelPayload,
    payload_sha256: sentinelSigned.payloadDigest,
    signature: sentinelSigned.signature,
  };
  const live = await signedSentinelAttestationToRecord({
    snapshot: sentinelSnapshot,
    sentinelBaseUrl: "http://sentinel.example",
    expectedKeyId: observerKey.keyId,
  });

  const beforePayload: NativeReplayAttestationPayload = {
    schema: NATIVE_REPLAY_ATTESTATION_SCHEMA,
    collected_at_unix_ms: Date.parse("2026-09-27T00:00:00Z"),
    release: {
      repository: "rchain-community/rchain-rust",
      commit: COMMIT,
      binary_sha256: BINARY,
    },
    subject: { id: "state:test", label: "before recovery" },
    replay: {
      expected_digest: STATE,
      observed_digest: STATE,
      input_digests: [INPUT],
    },
  };
  const beforeSigned = await signAttestation({
    schema: NATIVE_REPLAY_ATTESTATION_SCHEMA,
    payload: beforePayload,
    key: nativeKey,
  });
  const beforeSnapshot: SignedNativeReplayAttestation = {
    schema: NATIVE_REPLAY_ATTESTATION_SCHEMA,
    payload: beforePayload,
    payload_sha256: beforeSigned.payloadDigest,
    signature: beforeSigned.signature,
  };
  const before = await signedNativeReplayAttestationToRecord({
    snapshot: beforeSnapshot,
    expectedKeyId: nativeKey.keyId,
  });

  const afterPayload: NativeReplayAttestationPayload = {
    ...beforePayload,
    collected_at_unix_ms: Date.parse("2026-09-27T00:00:01Z"),
    replay: {
      ...beforePayload.replay,
      input_digests: [INPUT, CHECKPOINT],
    },
    recovery: {
      previous_record_digest: before.integrity.recordDigest,
      pre_process_id: "process-before",
      recovered_process_id: "process-after",
      pre_disk_id: "disk-before",
      recovered_disk_id: "disk-after",
      checkpoint_digest: CHECKPOINT,
      checkpoint_trusted: true,
      checkpoint_source: "file:///staging/checkpoint.tar.zst",
      recovery_log_digest: RECOVERY_LOG,
      restore_tool_digest: RESTORE_TOOL,
      started_at_unix_ms: Date.parse("2026-09-27T00:00:00Z"),
      finished_at_unix_ms: Date.parse("2026-09-27T00:00:01Z"),
    },
  };
  const afterSigned = await signAttestation({
    schema: NATIVE_REPLAY_ATTESTATION_SCHEMA,
    payload: afterPayload,
    key: nativeKey,
  });
  const afterSnapshot: SignedNativeReplayAttestation = {
    schema: NATIVE_REPLAY_ATTESTATION_SCHEMA,
    payload: afterPayload,
    payload_sha256: afterSigned.payloadDigest,
    signature: afterSigned.signature,
  };
  const after = await signedNativeReplayAttestationToRecord({
    snapshot: afterSnapshot,
    expectedKeyId: nativeKey.keyId,
  });

  const possibilitySearch = searchWeightedPossibility<number>({
    initial: 0,
    stateKey: String,
    isGoal: (state) => state === 1,
    expand: (state) =>
      state === 0 ? [{ to: 1, label: "bounded-transition", cost: 1 }] : [],
  });
  const certificate = buildAssuranceCertificate({
    issuedAt: "2026-09-27T00:00:02Z",
    freshness: { maxObservationAgeMs: 60_000 },
    observerTrust: { authorizedKeyIds: [observerKey.keyId] },
    builderTrust: {
      authorizedKeyIds: [builderKey.keyId],
      authorizedBuilderIds: [BUILDER_ID],
    },
    nativeReplayTrust: { authorizedKeyIds: [nativeKey.keyId] },
    buildProvenance: provenance,
    release: {
      repository: "rchain-community/rchain-rust",
      commit: COMMIT,
      binaryDigest: BINARY,
      buildProvenance: provenance.statementDigest,
    },
    network: {
      genesis: GENESIS,
      networkId: "testnet",
      shardId: "root",
      epoch: 42,
    },
    records: [
      { label: "signed live", sourceClass: "LIVE_OBSERVATION", record: live },
      { label: "signed replay before", sourceClass: "NATIVE_REPLAY", record: before },
      { label: "signed replay after", sourceClass: "NATIVE_REPLAY", record: after },
    ],
    checks: [
      possibilityCheckFromSearch({
        id: "bounded-possibility",
        description: "Bounded possibility witness is reproduced.",
        result: possibilitySearch,
        expected: "REACHABLE",
      }),
      conformanceCheckFromRealityRecord({
        id: "native-conformance",
        description: "Signed native replay matches.",
        record: before,
      }),
      recoveryCheckFromRecordChain({
        id: "native-recovery",
        description: "Signed recovery replay matches with independent recovery artifacts.",
        before,
        after,
      }),
    ],
  });
  assert.equal(certificate.status, "PASS");

  const packagePayload: AssurancePackagePayload = {
    schema: ASSURANCE_PACKAGE_SCHEMA,
    certificate,
    build_provenance: provenanceSnapshot,
    sentinel: [{
      sentinel_base_url: "http://sentinel.example",
      snapshot: sentinelSnapshot,
    }],
    native_replay: [beforeSnapshot, afterSnapshot],
  };
  const packageDigest = await assurancePackagePayloadDigest(packagePayload);
  const reviewerSignature = new Uint8Array(
    await globalThis.crypto.subtle.sign(
      { name: "Ed25519" },
      reviewerKey.pair.privateKey,
      arrayBuffer(assurancePackageSigningBytes(packagePayload)),
    ),
  );
  const envelope: SignedAssurancePackage = {
    schema: ASSURANCE_PACKAGE_SCHEMA,
    payload: packagePayload,
    payload_sha256: packageDigest,
    signature: {
      algorithm: "Ed25519",
      key_id: reviewerKey.keyId,
      public_key_hex: reviewerKey.publicKeyHex,
      signature_hex: bytesToHex(reviewerSignature),
    },
  };

  const verified = await verifyAssurancePackage(envelope, reviewerKey.keyId);
  assert.equal(verified.valid, true);
  assert.equal(verified.reviewerSignatureValid, true);
  assert.equal(verified.certificateValid, true);
  assert.equal(verified.buildProvenanceValid, true);
  assert.equal(verified.sentinelEvidenceValid, true);
  assert.equal(verified.nativeReplayEvidenceValid, true);
  assert.deepEqual(verified.reconstructedLiveRecordDigests, [live.integrity.recordDigest]);
  assert.deepEqual(
    verified.reconstructedNativeReplayDigests,
    [after.integrity.recordDigest, before.integrity.recordDigest].sort(),
  );
});
