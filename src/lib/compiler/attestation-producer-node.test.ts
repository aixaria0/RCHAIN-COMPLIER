import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  createSignedBuildProvenanceAttestation,
  createSignedNativeReplayAttestation,
} from "./attestation-producer-node.ts";
import {
  verifySignedBuildProvenanceAttestation,
} from "./build-provenance-signed-adapter.ts";
import {
  NATIVE_REPLAY_ATTESTATION_SCHEMA,
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
