import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildProvenancePayload,
  signBuildProvenancePayload,
  verifyBuildProvenanceEnvelope,
} from "./build-provenance.mjs";

test("build provenance producer binds artifact, source commit, and Ed25519 signer", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rchain-provenance-"));
  const artifact = join(dir, "artifact.tar");
  await writeFile(artifact, Buffer.from("deterministic-artifact"));

  const payload = await buildProvenancePayload({
    repository: "aixaria0/RCHAIN-COMPLIER",
    commit: "a".repeat(40),
    binaryPath: artifact,
    builderId: "https://github.com/aixaria0/RCHAIN-COMPLIER/actions/runs/123",
    invocationId: "123",
    startedOn: "2026-09-27T00:00:00.000Z",
    finishedOn: "2026-09-27T00:00:01.000Z",
  });

  assert.equal(payload.schema, "rchain-build-provenance-attestation/v1");
  assert.equal(payload.release.commit, "a".repeat(40));
  assert.match(payload.release.binary_sha256, /^sha256:[0-9a-f]{64}$/);
  assert.equal(
    payload.statement.predicate.buildDefinition.resolvedDependencies[0].digest.gitCommit,
    "a".repeat(40),
  );
  assert.equal(
    payload.statement.subject[0].digest.sha256,
    payload.release.binary_sha256.slice("sha256:".length),
  );

  const envelope = signBuildProvenancePayload(payload, "11".repeat(32));
  assert.equal(verifyBuildProvenanceEnvelope(envelope), true);
  assert.match(envelope.signature.key_id, /^sha256:[0-9a-f]{64}$/);
  assert.match(envelope.signature.public_key_hex, /^[0-9a-f]{64}$/);
  assert.match(envelope.signature.signature_hex, /^[0-9a-f]{128}$/);
});

test("build provenance signature fails after payload tampering", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rchain-provenance-"));
  const artifact = join(dir, "artifact.tar");
  await writeFile(artifact, Buffer.from("artifact"));

  const payload = await buildProvenancePayload({
    repository: "aixaria0/RCHAIN-COMPLIER",
    commit: "b".repeat(40),
    binaryPath: artifact,
    builderId: "builder",
  });
  const envelope = signBuildProvenancePayload(payload, "22".repeat(32));
  envelope.payload.release.commit = "c".repeat(40);

  assert.equal(verifyBuildProvenanceEnvelope(envelope), false);
});

test("producer rejects malformed commits and signing secrets", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rchain-provenance-"));
  const artifact = join(dir, "artifact.tar");
  await writeFile(artifact, Buffer.from("artifact"));

  await assert.rejects(
    () =>
      buildProvenancePayload({
        repository: "aixaria0/RCHAIN-COMPLIER",
        commit: "not-a-commit",
        binaryPath: artifact,
        builderId: "builder",
      }),
    /40-hex Git commit/,
  );

  const payload = await buildProvenancePayload({
    repository: "aixaria0/RCHAIN-COMPLIER",
    commit: "d".repeat(40),
    binaryPath: artifact,
    builderId: "builder",
  });
  assert.throws(
    () => signBuildProvenancePayload(payload, "abcd"),
    /32 bytes of hex/,
  );
});
