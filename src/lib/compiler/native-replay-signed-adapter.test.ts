import assert from "node:assert/strict";
import test from "node:test";
import {
  NATIVE_REPLAY_ATTESTATION_SCHEMA,
  isCryptographicallyVerifiedNativeReplayRecord,
  nativeReplayAttestationPayloadDigest,
  nativeReplayAttestationPublicKeyId,
  nativeReplayAttestationSigningBytes,
  nativeReplaySignerKeyId,
  signedNativeReplayAttestationToRecord,
  verifySignedNativeReplayAttestation,
  type NativeReplayAttestationPayload,
  type SignedNativeReplayAttestation,
} from "./native-replay-signed-adapter.ts";

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function arrayBuffer(value: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(value.byteLength);
  new Uint8Array(buffer).set(value);
  return buffer;
}

const KEY_PAIR = await globalThis.crypto.subtle.generateKey(
  { name: "Ed25519" },
  true,
  ["sign", "verify"],
) as CryptoKeyPair;
const PUBLIC_KEY = new Uint8Array(
  await globalThis.crypto.subtle.exportKey("raw", KEY_PAIR.publicKey),
);
const PUBLIC_KEY_HEX = bytesToHex(PUBLIC_KEY);
const KEY_ID = await nativeReplayAttestationPublicKeyId(PUBLIC_KEY_HEX);

const COMMIT = "a".repeat(40);
const BINARY = `sha256:${"b".repeat(64)}`;
const STATE = `sha256:${"c".repeat(64)}`;
const INPUT = `sha256:${"d".repeat(64)}`;
const CHECKPOINT = `sha256:${"e".repeat(64)}`;
const RECOVERY_LOG = `sha256:${"1".repeat(64)}`;
const RESTORE_TOOL = `sha256:${"2".repeat(64)}`;

async function signedSnapshot(
  payload: NativeReplayAttestationPayload,
): Promise<SignedNativeReplayAttestation> {
  const payloadDigest = await nativeReplayAttestationPayloadDigest(payload);
  const signature = new Uint8Array(
    await globalThis.crypto.subtle.sign(
      { name: "Ed25519" },
      KEY_PAIR.privateKey,
      arrayBuffer(nativeReplayAttestationSigningBytes(payload)),
    ),
  );

  return {
    schema: NATIVE_REPLAY_ATTESTATION_SCHEMA,
    payload,
    payload_sha256: payloadDigest,
    signature: {
      algorithm: "Ed25519",
      key_id: KEY_ID,
      public_key_hex: PUBLIC_KEY_HEX,
      signature_hex: bytesToHex(signature),
    },
  };
}

function beforePayload(): NativeReplayAttestationPayload {
  return {
    schema: NATIVE_REPLAY_ATTESTATION_SCHEMA,
    collected_at_unix_ms: Date.parse("2026-09-27T01:10:00Z"),
    release: {
      repository: "rchain-community/rchain-rust",
      commit: COMMIT,
      binary_sha256: BINARY,
    },
    subject: {
      id: "native-state:test",
      label: "Pinned native replay before recovery",
    },
    replay: {
      expected_digest: STATE,
      observed_digest: STATE,
      input_digests: [INPUT],
    },
  };
}

test("verifies and converts a pinned signed native replay into a Reality Record", async () => {
  const snapshot = await signedSnapshot(beforePayload());
  const verification = await verifySignedNativeReplayAttestation(snapshot, KEY_ID);
  assert.equal(verification.valid, true);

  const record = await signedNativeReplayAttestationToRecord({
    snapshot,
    expectedKeyId: KEY_ID,
  });

  assert.equal(record.source, "rchain-rust-native-replay");
  assert.equal(record.replay.state, "REPRODUCED");
  assert.equal(isCryptographicallyVerifiedNativeReplayRecord(record), true);
  assert.equal(nativeReplaySignerKeyId(record), KEY_ID);
  assert.equal(
    record.verification.find(
      (check) => check.id === "verify_native_replay_attestation_signature",
    )?.state,
    "VERIFIED",
  );
});

test("signed recovery after-record cryptographically binds the previous Reality Record", async () => {
  const before = await signedNativeReplayAttestationToRecord({
    snapshot: await signedSnapshot(beforePayload()),
    expectedKeyId: KEY_ID,
  });

  const afterPayload: NativeReplayAttestationPayload = {
    ...beforePayload(),
    collected_at_unix_ms: Date.parse("2026-09-27T01:11:00Z"),
    subject: {
      id: "native-state:test",
      label: "Pinned native replay after recovery",
    },
    replay: {
      ...beforePayload().replay,
      input_digests: [INPUT, CHECKPOINT],
    },
    recovery: {
      previous_record_digest: before.integrity.recordDigest,
      pre_process_id: "proc-before",
      recovered_process_id: "proc-after",
      pre_disk_id: "disk-before",
      recovered_disk_id: "disk-after",
      checkpoint_digest: CHECKPOINT,
      checkpoint_trusted: true,
      checkpoint_source: "file:///staging/checkpoint-42.tar.zst",
      recovery_log_digest: RECOVERY_LOG,
      restore_tool_digest: RESTORE_TOOL,
      started_at_unix_ms: Date.parse("2026-09-27T01:10:30Z"),
      finished_at_unix_ms: Date.parse("2026-09-27T01:10:55Z"),
    },
  };
  const after = await signedNativeReplayAttestationToRecord({
    snapshot: await signedSnapshot(afterPayload),
    expectedKeyId: KEY_ID,
  });

  assert.equal(after.integrity.previousDigest, before.integrity.recordDigest);
  assert.equal(after.subject.id, before.subject.id);
  assert.equal(after.replay.observedDigest, before.replay.observedDigest);
  assert.equal(isCryptographicallyVerifiedNativeReplayRecord(after), true);
});

test("native replay state mismatch becomes divergent even with a valid signature", async () => {
  const payload = beforePayload();
  payload.replay.observed_digest = `sha256:${"f".repeat(64)}`;
  const record = await signedNativeReplayAttestationToRecord({
    snapshot: await signedSnapshot(payload),
    expectedKeyId: KEY_ID,
  });

  assert.equal(record.replay.state, "DIVERGENT");
  assert.equal(record.state, "DIVERGENT");
});

test("wrong pinned native replay signer is rejected", async () => {
  const snapshot = await signedSnapshot(beforePayload());
  await assert.rejects(
    () =>
      signedNativeReplayAttestationToRecord({
        snapshot,
        expectedKeyId: `sha256:${"0".repeat(64)}`,
      }),
    /not the pinned expected key/,
  );
});

test("native replay payload validation rejects ambiguous digest formats before signature trust", async () => {
  const payload = beforePayload();
  payload.replay.expected_digest = "state:abc";
  const snapshot = await signedSnapshot(payload);
  const verification = await verifySignedNativeReplayAttestation(snapshot, KEY_ID);

  assert.equal(verification.valid, false);
  assert.match(verification.reason, /expected_digest must be a sha256/);
});


test("recovery checkpoint must be an actual signed replay input", async () => {
  const before = await signedNativeReplayAttestationToRecord({
    snapshot: await signedSnapshot(beforePayload()),
    expectedKeyId: KEY_ID,
  });
  const payload: NativeReplayAttestationPayload = {
    ...beforePayload(),
    recovery: {
      previous_record_digest: before.integrity.recordDigest,
      pre_process_id: "proc-before",
      recovered_process_id: "proc-after",
      pre_disk_id: "disk-before",
      recovered_disk_id: "disk-after",
      checkpoint_digest: CHECKPOINT,
      checkpoint_trusted: true,
      checkpoint_source: "file:///staging/checkpoint.tar.zst",
      recovery_log_digest: RECOVERY_LOG,
      restore_tool_digest: RESTORE_TOOL,
      started_at_unix_ms: 1,
      finished_at_unix_ms: 2,
    },
  };

  const verification = await verifySignedNativeReplayAttestation(
    await signedSnapshot(payload),
    KEY_ID,
  );
  assert.equal(verification.valid, false);
  assert.match(verification.reason, /included in replay input_digests/);
});

test("recovery artifact manifest rejects malformed log/tool identity", async () => {
  const before = await signedNativeReplayAttestationToRecord({
    snapshot: await signedSnapshot(beforePayload()),
    expectedKeyId: KEY_ID,
  });
  const payload: NativeReplayAttestationPayload = {
    ...beforePayload(),
    replay: {
      ...beforePayload().replay,
      input_digests: [INPUT, CHECKPOINT],
    },
    recovery: {
      previous_record_digest: before.integrity.recordDigest,
      pre_process_id: "proc-before",
      recovered_process_id: "proc-after",
      pre_disk_id: "disk-before",
      recovered_disk_id: "disk-after",
      checkpoint_digest: CHECKPOINT,
      checkpoint_trusted: true,
      checkpoint_source: "file:///staging/checkpoint.tar.zst",
      recovery_log_digest: "not-a-digest",
      restore_tool_digest: RESTORE_TOOL,
      started_at_unix_ms: 1,
      finished_at_unix_ms: 2,
    },
  };

  const verification = await verifySignedNativeReplayAttestation(
    await signedSnapshot(payload),
    KEY_ID,
  );
  assert.equal(verification.valid, false);
  assert.match(verification.reason, /recovery_log_digest/);
});
