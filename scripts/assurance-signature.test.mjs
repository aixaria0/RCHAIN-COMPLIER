import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import test from "node:test";
import {
  ASSURANCE_SIGNATURE_SCHEMA,
  signAssuranceCertificate,
  verifyAssuranceSignature,
} from "./assurance-signature.mjs";

function certificateFixture() {
  return {
    schema: "rchain-assurance-certificate/v1",
    id: "assurance:test",
    issuedAt: "2026-09-27T01:00:00Z",
    policy: {
      id: "rchain-revival-strict/v1",
      digest: "a".repeat(64),
    },
    freshness: { maxObservationAgeMs: 60000 },
    release: {
      repository: "rchain-community/rchain-rust",
      commit: "b".repeat(40),
      binaryDigest: `sha256:${"c".repeat(64)}`,
      buildProvenance: `sha256:${"d".repeat(64)}`,
    },
    network: {
      genesis: "genesis:test",
      networkId: "testnet",
      shardId: "root",
    },
    requirements: {
      requireReleaseArtifactIdentity: true,
      requireLiveObservation: true,
      requireNetworkIdentityBinding: true,
      requireFreshness: true,
      requirePossibility: true,
      requireConformance: true,
      requireRecovery: true,
    },
    limitations: ["certificate SHA-256 integrity is not signer authenticity"],
    records: [],
    checks: [],
    status: "PASS",
    summary: { pass: 0, fail: 0, blocked: 0, notTested: 0 },
    integrity: {
      algorithm: "SHA-256",
      certificateDigest: "e".repeat(64),
    },
  };
}

test("Ed25519 envelope signs and verifies the complete canonical certificate", () => {
  const { privateKey } = generateKeyPairSync("ed25519");
  const envelope = signAssuranceCertificate(certificateFixture(), privateKey);

  assert.equal(envelope.schema, ASSURANCE_SIGNATURE_SCHEMA);
  assert.match(envelope.signature.keyId, /^sha256:[0-9a-f]{64}$/);
  assert.equal(
    verifyAssuranceSignature(envelope, { expectedKeyId: envelope.signature.keyId }),
    true,
  );
});

test("certificate tampering invalidates the Ed25519 signature", () => {
  const { privateKey } = generateKeyPairSync("ed25519");
  const envelope = signAssuranceCertificate(certificateFixture(), privateKey);
  envelope.certificate.status = "FAIL";

  assert.equal(verifyAssuranceSignature(envelope), false);
});

test("a different pinned signer key id is rejected", () => {
  const { privateKey } = generateKeyPairSync("ed25519");
  const envelope = signAssuranceCertificate(certificateFixture(), privateKey);

  assert.equal(
    verifyAssuranceSignature(envelope, { expectedKeyId: `sha256:${"0".repeat(64)}` }),
    false,
  );
});

test("non-Ed25519 keys are rejected", () => {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });

  assert.throws(
    () => signAssuranceCertificate(certificateFixture(), privateKey),
    /Ed25519 private key/,
  );
});
