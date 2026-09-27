import assert from "node:assert/strict";
import test from "node:test";
import {
  ASSURANCE_PACKAGE_SCHEMA,
  assurancePackagePayloadDigest,
  assurancePackagePublicKeyId,
  assurancePackageSigningBytes,
  verifyAssurancePackage,
  type AssurancePackagePayload,
  type SignedAssurancePackage,
} from "./assurance-package.ts";
import type { AssuranceCertificate } from "./assurance-fabric.ts";

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function arrayBuffer(value: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(value.byteLength);
  new Uint8Array(buffer).set(value);
  return buffer;
}

const REVIEWER_KEY_PAIR = await globalThis.crypto.subtle.generateKey(
  { name: "Ed25519" },
  true,
  ["sign", "verify"],
) as CryptoKeyPair;
const REVIEWER_PUBLIC_KEY = new Uint8Array(
  await globalThis.crypto.subtle.exportKey("raw", REVIEWER_KEY_PAIR.publicKey),
);
const REVIEWER_PUBLIC_KEY_HEX = bytesToHex(REVIEWER_PUBLIC_KEY);
const REVIEWER_KEY_ID = await assurancePackagePublicKeyId(REVIEWER_PUBLIC_KEY_HEX);

async function signedEnvelope(payload: AssurancePackagePayload): Promise<SignedAssurancePackage> {
  const payloadDigest = await assurancePackagePayloadDigest(payload);
  const signature = new Uint8Array(
    await globalThis.crypto.subtle.sign(
      { name: "Ed25519" },
      REVIEWER_KEY_PAIR.privateKey,
      arrayBuffer(assurancePackageSigningBytes(payload)),
    ),
  );
  return {
    schema: ASSURANCE_PACKAGE_SCHEMA,
    payload,
    payload_sha256: payloadDigest,
    signature: {
      algorithm: "Ed25519",
      key_id: REVIEWER_KEY_ID,
      public_key_hex: REVIEWER_PUBLIC_KEY_HEX,
      signature_hex: bytesToHex(signature),
    },
  };
}

test("package verifier rejects an untrusted reviewer before trusting embedded evidence", async () => {
  const certificate = {
    schema: "rchain-assurance-certificate/v1",
  } as AssuranceCertificate;
  const envelope = await signedEnvelope({
    schema: ASSURANCE_PACKAGE_SCHEMA,
    certificate,
    build_provenance: {} as never,
    sentinel: [],
    native_replay: [],
  });

  const result = await verifyAssurancePackage(
    envelope,
    `sha256:${"0".repeat(64)}`,
  );
  assert.equal(result.valid, false);
  assert.equal(result.reviewerSignatureValid, false);
  assert.match(result.reason, /reviewer package signature rejected/);
});

test("package signature detects evidence-list tampering before source verification", async () => {
  const certificate = {
    schema: "rchain-assurance-certificate/v1",
  } as AssuranceCertificate;
  const envelope = await signedEnvelope({
    schema: ASSURANCE_PACKAGE_SCHEMA,
    certificate,
    build_provenance: {} as never,
    sentinel: [],
    native_replay: [],
  });
  envelope.payload.native_replay.push({} as never);

  const result = await verifyAssurancePackage(envelope, REVIEWER_KEY_ID);
  assert.equal(result.valid, false);
  assert.equal(result.reviewerSignatureValid, false);
  assert.match(result.reason, /payload digest mismatch|signature verification failed/);
});
