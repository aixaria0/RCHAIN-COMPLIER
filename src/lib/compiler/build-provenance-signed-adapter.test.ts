import assert from "node:assert/strict";
import test from "node:test";
import {
  BUILD_PROVENANCE_ATTESTATION_SCHEMA,
  IN_TOTO_STATEMENT_V1,
  SLSA_PROVENANCE_V1,
  buildProvenanceAttestationPayloadDigest,
  buildProvenanceAttestationPublicKeyId,
  buildProvenanceAttestationSigningBytes,
  isCryptographicallyVerifiedBuildProvenance,
  signedBuildProvenanceAttestationToVerified,
  verifySignedBuildProvenanceAttestation,
  type BuildProvenanceAttestationPayload,
  type SignedBuildProvenanceAttestation,
} from "./build-provenance-signed-adapter.ts";

const COMMIT = "a".repeat(40);
const BINARY_HEX = "b".repeat(64);
const BINARY = `sha256:${BINARY_HEX}`;
const REPOSITORY = "rchain-community/rchain-rust";

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
const KEY_ID = await buildProvenanceAttestationPublicKeyId(PUBLIC_KEY_HEX);

function payload(): BuildProvenanceAttestationPayload {
  return {
    schema: BUILD_PROVENANCE_ATTESTATION_SCHEMA,
    release: {
      repository: REPOSITORY,
      commit: COMMIT,
      binary_sha256: BINARY,
    },
    statement: {
      _type: IN_TOTO_STATEMENT_V1,
      subject: [
        {
          name: "rnode",
          digest: { sha256: BINARY_HEX },
        },
      ],
      predicateType: SLSA_PROVENANCE_V1,
      predicate: {
        buildDefinition: {
          buildType: "https://github.com/actions/workflow/v1",
          externalParameters: {
            repository: REPOSITORY,
            ref: "refs/heads/dev",
          },
          resolvedDependencies: [
            {
              uri: `git+https://github.com/${REPOSITORY}@refs/heads/dev`,
              digest: { gitCommit: COMMIT },
            },
          ],
        },
        runDetails: {
          builder: {
            id: "https://github.com/actions/runner",
          },
          metadata: {
            invocationId: "run-42",
          },
        },
      },
    },
  };
}

async function signedSnapshot(
  source = payload(),
): Promise<SignedBuildProvenanceAttestation> {
  const payloadSha256 = await buildProvenanceAttestationPayloadDigest(source);
  const signature = new Uint8Array(
    await globalThis.crypto.subtle.sign(
      { name: "Ed25519" },
      KEY_PAIR.privateKey,
      arrayBuffer(buildProvenanceAttestationSigningBytes(source)),
    ),
  );

  return {
    schema: BUILD_PROVENANCE_ATTESTATION_SCHEMA,
    payload: source,
    payload_sha256: payloadSha256,
    signature: {
      algorithm: "Ed25519",
      key_id: KEY_ID,
      public_key_hex: PUBLIC_KEY_HEX,
      signature_hex: bytesToHex(signature),
    },
  };
}

test("verifies signed SLSA provenance and binds source plus binary", async () => {
  const snapshot = await signedSnapshot();
  const result = await verifySignedBuildProvenanceAttestation(snapshot, KEY_ID);

  assert.equal(result.valid, true);
  assert.equal(result.builderId, "https://github.com/actions/runner");
  assert.equal(result.subjectName, "rnode");
  assert.match(result.statementDigest ?? "", /^sha256:[0-9a-f]{64}$/);

  const verified = await signedBuildProvenanceAttestationToVerified({
    snapshot,
    expectedKeyId: KEY_ID,
  });
  assert.equal(isCryptographicallyVerifiedBuildProvenance(verified), true);
  assert.equal(verified.repository, REPOSITORY);
  assert.equal(verified.commit, COMMIT);
  assert.equal(verified.binaryDigest, BINARY);
});

test("rejects provenance whose resolved dependency does not bind the release commit", async () => {
  const broken = payload();
  broken.statement.predicate.buildDefinition.resolvedDependencies![0]!.digest = {
    gitCommit: "f".repeat(40),
  };
  const snapshot = await signedSnapshot(broken);
  const result = await verifySignedBuildProvenanceAttestation(snapshot, KEY_ID);

  assert.equal(result.valid, false);
  assert.match(result.reason, /resolvedDependencies/);
});

test("rejects provenance whose subject does not bind the declared binary", async () => {
  const broken = payload();
  broken.statement.subject[0]!.digest.sha256 = "0".repeat(64);
  const snapshot = await signedSnapshot(broken);
  const result = await verifySignedBuildProvenanceAttestation(snapshot, KEY_ID);

  assert.equal(result.valid, false);
  assert.match(result.reason, /binary SHA-256/);
});

test("rejects a valid signature when the signer is not the pinned builder key", async () => {
  const snapshot = await signedSnapshot();
  const result = await verifySignedBuildProvenanceAttestation(
    snapshot,
    `sha256:${"0".repeat(64)}`,
  );

  assert.equal(result.valid, false);
  assert.match(result.reason, /pinned expected key/);
});

test("tampering after signing invalidates the provenance signature", async () => {
  const snapshot = await signedSnapshot();
  snapshot.payload.statement.predicate.runDetails.builder.id =
    "https://malicious.example/builder";

  const result = await verifySignedBuildProvenanceAttestation(snapshot, KEY_ID);
  assert.equal(result.valid, false);
});
