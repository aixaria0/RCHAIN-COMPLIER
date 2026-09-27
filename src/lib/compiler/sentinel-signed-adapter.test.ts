import assert from "node:assert/strict";
import test from "node:test";
import {
  SENTINEL_ATTESTATION_SCHEMA,
  fetchSignedSentinelRealityRecord,
  isCryptographicallyVerifiedSentinelRecord,
  sentinelAttestationPayloadDigest,
  sentinelAttestationPublicKeyId,
  sentinelAttestationSigningBytes,
  signedSentinelAttestationToRecord,
  verifySignedSentinelAttestation,
  type SignedSentinelAttestation,
} from "./sentinel-signed-adapter.ts";

function toArrayBuffer(value: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(value.byteLength);
  new Uint8Array(buffer).set(value);
  return buffer;
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function payloadFixture(): SignedSentinelAttestation["payload"] {
  return {
    schema: SENTINEL_ATTESTATION_SCHEMA,
    collected_at_unix_ms: Date.parse("2026-09-27T01:00:00Z"),
    network: {
      reachable: true,
      node_url: "http://node-a:40403",
      latency_ms: 5,
      http_status: 200,
      probe: "http://node-a:40403/api/status",
      error: null,
      rnode: {
        node: { id: "node-a", host: "node-a", port: 40403 },
        network_id: "testnet",
        shard_id: "root",
        latest_block_number: 11,
        last_finalized_block_number: 10,
        validator: true,
        ready: true,
        current_epoch: 1,
      },
    },
    finalized_block: {
      available: true,
      raw: { blockHash: "abc", blockNumber: 10 },
      payload_sha256: "deadbeef",
      block_hash: "abc",
      parent_hash: "parent",
      proposer: "validator",
      signature: "node-signature",
      justification_present: true,
      full_block_available: true,
      full_block: { blockHash: "abc", blockNumber: 10 },
      full_block_hash: "abc",
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
      common_block_hash: "abc",
      height_agreement: true,
      hash_agreement: true,
      missing_height_nodes: 0,
      missing_hash_nodes: 0,
      conflicting_nodes: 0,
      agreement: true,
      status: "pass",
      verification_basis: "two targets agree; not a stake-weighted Casper proof",
      observations: [
        {
          node_url: "http://node-a:40403",
          reachable: true,
          finalized_height: 10,
          block_hash: "abc",
          payload_sha256: "a",
          proposer: "validator",
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
          block_hash: "abc",
          payload_sha256: "b",
          proposer: "validator",
          signature_present: true,
          justification_present: true,
          full_block_available: true,
          full_block_hash_match: true,
          node_reported_finalized: true,
        },
      ],
    },
  };
}

async function signedFixture(): Promise<{
  snapshot: SignedSentinelAttestation;
  keyId: string;
}> {
  const keyPair = await globalThis.crypto.subtle.generateKey(
    { name: "Ed25519" },
    true,
    ["sign", "verify"],
  );
  const publicKey = new Uint8Array(
    await globalThis.crypto.subtle.exportKey("raw", keyPair.publicKey),
  );
  const publicKeyHex = bytesToHex(publicKey);
  const keyId = await sentinelAttestationPublicKeyId(publicKeyHex);
  const payload = payloadFixture();
  const payloadDigest = await sentinelAttestationPayloadDigest(payload);
  const signature = new Uint8Array(
    await globalThis.crypto.subtle.sign(
      { name: "Ed25519" },
      keyPair.privateKey,
      toArrayBuffer(sentinelAttestationSigningBytes(payload)),
    ),
  );

  return {
    keyId,
    snapshot: {
      schema: SENTINEL_ATTESTATION_SCHEMA,
      payload,
      payload_sha256: payloadDigest,
      signature: {
        algorithm: "Ed25519",
        key_id: keyId,
        public_key_hex: publicKeyHex,
        signature_hex: bytesToHex(signature),
      },
    },
  };
}

test("verifies canonical Ed25519 Sentinel snapshot against a pinned key id", async () => {
  const { snapshot, keyId } = await signedFixture();
  const result = await verifySignedSentinelAttestation(snapshot, keyId);

  assert.equal(result.valid, true);
  assert.equal(result.keyId, keyId);
  assert.equal(result.payloadDigest, snapshot.payload_sha256);
});

test("rejects a valid snapshot when the pinned signer key is different", async () => {
  const { snapshot } = await signedFixture();
  const result = await verifySignedSentinelAttestation(
    snapshot,
    `sha256:${"0".repeat(64)}`,
  );

  assert.equal(result.valid, false);
  assert.match(result.reason, /not the pinned expected key/);
});

test("rejects payload tampering even when digest and signature fields are left untouched", async () => {
  const { snapshot, keyId } = await signedFixture();
  snapshot.payload.finalized_block.block_hash = "tampered";

  const result = await verifySignedSentinelAttestation(snapshot, keyId);
  assert.equal(result.valid, false);
  assert.match(result.reason, /payload digest mismatch/);
});

test("only a cryptographically verified signed snapshot receives runtime trust", async () => {
  const { snapshot, keyId } = await signedFixture();
  const record = await signedSentinelAttestationToRecord({
    snapshot,
    sentinelBaseUrl: "http://sentinel.example",
    expectedKeyId: keyId,
  });

  assert.equal(isCryptographicallyVerifiedSentinelRecord(record), true);
  assert.equal(
    record.verification.find(
      (check) => check.id === "verify_sentinel_attestation_signature",
    )?.state,
    "VERIFIED",
  );
  assert.ok(
    record.observations.some(
      (observation) =>
        observation.type === "AttestationSignature" &&
        observation.data.keyId === keyId &&
        observation.data.signatureVerified === true,
    ),
  );
});


test("fetch helper verifies the pinned snapshot before returning a trusted Reality Record", async () => {
  const { snapshot, keyId } = await signedFixture();
  const requested: string[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    requested.push(String(input));
    return new Response(JSON.stringify(snapshot), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  const record = await fetchSignedSentinelRealityRecord(
    "http://sentinel.example/",
    keyId,
    { fetchImpl },
  );

  assert.deepEqual(requested, [
    "http://sentinel.example/api/attestation/snapshot",
  ]);
  assert.equal(isCryptographicallyVerifiedSentinelRecord(record), true);
});

test("fetch helper fails closed when the signed endpoint is unavailable", async () => {
  const { keyId } = await signedFixture();
  const fetchImpl: typeof fetch = async () =>
    new Response("signing disabled", { status: 503 });

  await assert.rejects(
    () =>
      fetchSignedSentinelRealityRecord(
        "http://sentinel.example",
        keyId,
        { fetchImpl },
      ),
    /HTTP 503/,
  );
});
