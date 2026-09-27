import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  createSignedBuildProvenanceAttestation,
  createSignedNativeReplayAttestation,
  createSignedRecoveryReplayAttestation,
  sha256File,
} from "./attestation-producer-node.ts";
import {
  verifySignedBuildProvenanceAttestation,
} from "./build-provenance-signed-adapter.ts";
import {
  NATIVE_REPLAY_ATTESTATION_SCHEMA,
  signedNativeReplayAttestationToRecord,
  verifySignedNativeReplayAttestation,
  type NativeReplayAttestationPayload,
} from "./native-replay-signed-adapter.ts";

const TEST_SEED = "11".repeat(32);
const COMMIT = "a".repeat(40);
const SHA_A = `sha256:${"1".repeat(64)}`;
const SHA_B = `sha256:${"2".repeat(64)}`;

test("producer creates build provenance accepted by the pinned-key verifier", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "assurance-producer-"));
  const artifact = path.join(dir, "artifact.tgz");
  await writeFile(artifact, "deterministic test artifact");

  const envelope = await createSignedBuildProvenanceAttestation({
    repository: "aixaria0/RCHAIN-COMPLIER",
    commit: COMMIT,
    artifactPath: artifact,
    subjectName: "artifact.tgz",
    builderId: "https://github.com/aixaria0/RCHAIN-COMPLIER/actions/workflows/assurance-provenance.yml",
    invocationId: "test-run",
    privateSeedHex: TEST_SEED,
  });

  const verification = await verifySignedBuildProvenanceAttestation(
    envelope,
    envelope.signature.key_id,
  );

  assert.equal(verification.valid, true);
  assert.equal(verification.builderId?.includes("assurance-provenance.yml"), true);
  assert.equal(envelope.payload.release.commit, COMMIT);
  assert.match(envelope.payload.release.binary_sha256, /^sha256:[0-9a-f]{64}$/);
});

test("producer creates native replay evidence accepted by the pinned-key verifier", async () => {
  const payload: NativeReplayAttestationPayload = {
    schema: NATIVE_REPLAY_ATTESTATION_SCHEMA,
    collected_at_unix_ms: 1_800_000_000_000,
    release: {
      repository: "rchain-community/rchain-rust",
      commit: COMMIT,
      binary_sha256: SHA_A,
    },
    subject: {
      id: "state:test",
    },
    replay: {
      expected_digest: SHA_B,
      observed_digest: SHA_B,
      input_digests: [SHA_A],
    },
  };

  const envelope = createSignedNativeReplayAttestation({
    payload,
    privateSeedHex: TEST_SEED,
  });
  const verification = await verifySignedNativeReplayAttestation(
    envelope,
    envelope.signature.key_id,
  );

  assert.equal(verification.valid, true);
  assert.equal(verification.payloadDigest, envelope.payload_sha256);
});

test("producer rejects malformed raw private seed", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "assurance-producer-bad-"));
  const artifact = path.join(dir, "artifact.tgz");
  await writeFile(artifact, "x");

  await assert.rejects(
    createSignedBuildProvenanceAttestation({
      repository: "aixaria0/RCHAIN-COMPLIER",
      commit: COMMIT,
      artifactPath: artifact,
      builderId: "builder",
      privateSeedHex: "deadbeef",
    }),
    /32 bytes/,
  );
});


test("recovery producer hashes real checkpoint/log/tool/binary artifacts and emits verifier-compatible evidence", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "assurance-recovery-producer-"));
  const binary = path.join(dir, "rnode");
  const checkpoint = path.join(dir, "checkpoint.bin");
  const recoveryLog = path.join(dir, "recovery.log");
  const restoreTool = path.join(dir, "restore-tool");
  await Promise.all([
    writeFile(binary, "rnode-binary"),
    writeFile(checkpoint, "checkpoint-state"),
    writeFile(recoveryLog, "restore completed"),
    writeFile(restoreTool, "restore-tool-v1"),
  ]);

  const checkpointDigest = await sha256File(checkpoint);
  const binaryDigest = await sha256File(binary);
  const stateDigest = `sha256:${"7".repeat(64)}`;

  const envelope = await createSignedRecoveryReplayAttestation({
    repository: "rchain-community/rchain-rust",
    commit: COMMIT,
    binaryPath: binary,
    subjectId: "state:recovery-test",
    expectedDigest: stateDigest,
    observedDigest: stateDigest,
    inputDigests: [SHA_A],
    checkpointPath: checkpoint,
    checkpointSource: "staging-finalized-checkpoint",
    recoveryLogPath: recoveryLog,
    restoreToolPath: restoreTool,
    previousRecordDigest: "8".repeat(64),
    preProcessId: "pid-before",
    recoveredProcessId: "pid-after",
    preDiskId: "disk-before",
    recoveredDiskId: "disk-after",
    startedAtUnixMs: 1_800_000_000_000,
    finishedAtUnixMs: 1_800_000_000_500,
    privateSeedHex: TEST_SEED,
  });

  assert.equal(envelope.payload.release.binary_sha256, binaryDigest);
  assert.equal(envelope.payload.recovery?.checkpoint_digest, checkpointDigest);
  assert.ok(envelope.payload.replay.input_digests.includes(checkpointDigest));

  const verification = await verifySignedNativeReplayAttestation(
    envelope,
    envelope.signature.key_id,
  );
  assert.equal(verification.valid, true);

  const record = await signedNativeReplayAttestationToRecord({
    snapshot: envelope,
    expectedKeyId: envelope.signature.key_id,
  });
  assert.equal(record.replay.state, "REPRODUCED");
  assert.equal(record.integrity.previousDigest, "8".repeat(64));
  const recovery = record.observations.find(
    (observation) => observation.type === "RecoveryContext",
  );
  assert.equal(recovery?.data.checkpointDigest, checkpointDigest);
  assert.equal(recovery?.data.recoveryLogDigest, await sha256File(recoveryLog));
  assert.equal(recovery?.data.restoreToolDigest, await sha256File(restoreTool));
});

test("recovery producer rejects same-process or same-disk pseudo-restores", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "assurance-recovery-producer-bad-"));
  const file = path.join(dir, "artifact");
  await writeFile(file, "x");
  const stateDigest = `sha256:${"9".repeat(64)}`;

  await assert.rejects(
    createSignedRecoveryReplayAttestation({
      repository: "rchain-community/rchain-rust",
      commit: COMMIT,
      binaryPath: file,
      subjectId: "state:test",
      expectedDigest: stateDigest,
      observedDigest: stateDigest,
      checkpointPath: file,
      checkpointSource: "checkpoint",
      recoveryLogPath: file,
      restoreToolPath: file,
      previousRecordDigest: "a".repeat(64),
      preProcessId: "same",
      recoveredProcessId: "same",
      preDiskId: "disk-a",
      recoveredDiskId: "disk-b",
      startedAtUnixMs: 10,
      finishedAtUnixMs: 20,
      privateSeedHex: TEST_SEED,
    }),
    /process ids must be distinct/,
  );
});


test("recovery producer hashes concrete artifacts and emits verifier-accepted signed evidence", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "assurance-recovery-producer-"));
  const binary = path.join(dir, "rnode.bin");
  const checkpoint = path.join(dir, "checkpoint.tar.zst");
  const recoveryLog = path.join(dir, "recovery.log");
  const restoreTool = path.join(dir, "restore-tool");
  await Promise.all([
    writeFile(binary, "pinned-rnode-binary"),
    writeFile(checkpoint, "checkpoint-bytes"),
    writeFile(recoveryLog, "restore completed"),
    writeFile(restoreTool, "restore-tool-v1"),
  ]);

  const envelope = await createSignedRecoveryReplayAttestation({
    repository: "rchain-community/rchain-rust",
    commit: COMMIT,
    binaryPath: binary,
    subjectId: "native-state:test",
    expectedDigest: SHA_B,
    observedDigest: SHA_B,
    checkpointPath: checkpoint,
    checkpointSource: "file:///staging/checkpoint.tar.zst",
    recoveryLogPath: recoveryLog,
    restoreToolPath: restoreTool,
    previousRecordDigest: "a".repeat(64),
    preProcessId: "proc-before",
    recoveredProcessId: "proc-after",
    preDiskId: "disk-before",
    recoveredDiskId: "disk-after",
    startedAtUnixMs: 1_800_000_000_000,
    finishedAtUnixMs: 1_800_000_001_000,
    privateSeedHex: TEST_SEED,
  });

  const verification = await verifySignedNativeReplayAttestation(
    envelope,
    envelope.signature.key_id,
  );

  assert.equal(verification.valid, true);
  assert.equal(
    envelope.payload.replay.input_digests.includes(
      envelope.payload.recovery!.checkpoint_digest,
    ),
    true,
  );
  assert.notEqual(
    envelope.payload.release.binary_sha256,
    envelope.payload.recovery!.checkpoint_digest,
  );
  assert.match(envelope.payload.recovery!.recovery_log_digest, /^sha256:[0-9a-f]{64}$/);
  assert.match(envelope.payload.recovery!.restore_tool_digest, /^sha256:[0-9a-f]{64}$/);
});
