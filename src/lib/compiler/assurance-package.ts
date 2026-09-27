import {
  attestationPayloadDigest,
  attestationPublicKeyId,
  attestationSigningBytes,
  verifyPinnedEd25519Attestation,
} from "./attestation-crypto.ts";
import {
  validateAssuranceCertificate,
  type AssuranceCertificate,
} from "./assurance-fabric.ts";
import {
  signedBuildProvenanceAttestationToVerified,
  type SignedBuildProvenanceAttestation,
} from "./build-provenance-signed-adapter.ts";
import {
  signedNativeReplayAttestationToRecord,
  type SignedNativeReplayAttestation,
} from "./native-replay-signed-adapter.ts";
import {
  signedSentinelAttestationToRecord,
  type SignedSentinelAttestation,
} from "./sentinel-signed-adapter.ts";

export const ASSURANCE_PACKAGE_SCHEMA =
  "rchain-assurance-package/v1" as const;

export interface AssurancePackagePayload {
  schema: typeof ASSURANCE_PACKAGE_SCHEMA;
  certificate: AssuranceCertificate;
  build_provenance: SignedBuildProvenanceAttestation;
  sentinel: Array<{
    sentinel_base_url: string;
    snapshot: SignedSentinelAttestation;
  }>;
  native_replay: SignedNativeReplayAttestation[];
}

export interface SignedAssurancePackage {
  schema: typeof ASSURANCE_PACKAGE_SCHEMA;
  payload: AssurancePackagePayload;
  payload_sha256: string;
  signature: {
    algorithm: "Ed25519";
    key_id: string;
    public_key_hex: string;
    signature_hex: string;
  };
}

export interface AssurancePackageVerification {
  valid: boolean;
  reviewerSignatureValid: boolean;
  certificateValid: boolean;
  buildProvenanceValid: boolean;
  sentinelEvidenceValid: boolean;
  nativeReplayEvidenceValid: boolean;
  reason: string;
  reviewerKeyId: string | null;
  reconstructedLiveRecordDigests: string[];
  reconstructedNativeReplayDigests: string[];
}

function normalize(values: string[]): string[] {
  return [...values].sort();
}

function equalStringArrays(left: string[], right: string[]): boolean {
  const a = normalize(left);
  const b = normalize(right);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

export function assurancePackageSigningBytes(
  payload: AssurancePackagePayload,
): Uint8Array {
  return attestationSigningBytes(ASSURANCE_PACKAGE_SCHEMA, payload);
}

export function assurancePackagePayloadDigest(
  payload: AssurancePackagePayload,
): Promise<string> {
  return attestationPayloadDigest(payload);
}

export function assurancePackagePublicKeyId(
  publicKeyHex: string,
): Promise<string> {
  return attestationPublicKeyId(publicKeyHex);
}

export async function verifyAssurancePackage(
  envelope: SignedAssurancePackage,
  expectedReviewerKeyId: string,
): Promise<AssurancePackageVerification> {
  const fail = (
    reason: string,
    partial: Partial<AssurancePackageVerification> = {},
  ): AssurancePackageVerification => ({
    valid: false,
    reviewerSignatureValid: false,
    certificateValid: false,
    buildProvenanceValid: false,
    sentinelEvidenceValid: false,
    nativeReplayEvidenceValid: false,
    reason,
    reviewerKeyId: null,
    reconstructedLiveRecordDigests: [],
    reconstructedNativeReplayDigests: [],
    ...partial,
  });

  if (envelope.schema !== ASSURANCE_PACKAGE_SCHEMA) {
    return fail("unexpected Assurance Package envelope schema");
  }
  if (envelope.payload.schema !== ASSURANCE_PACKAGE_SCHEMA) {
    return fail("unexpected Assurance Package payload schema");
  }

  const reviewer = await verifyPinnedEd25519Attestation({
    schema: ASSURANCE_PACKAGE_SCHEMA,
    payload: envelope.payload,
    declaredPayloadDigest: envelope.payload_sha256,
    algorithm: envelope.signature.algorithm,
    declaredKeyId: envelope.signature.key_id,
    publicKeyHex: envelope.signature.public_key_hex,
    signatureHex: envelope.signature.signature_hex,
    expectedKeyId: expectedReviewerKeyId,
  });
  if (!reviewer.valid || !reviewer.keyId) {
    return fail(`reviewer package signature rejected: ${reviewer.reason}`);
  }

  const certificate = envelope.payload.certificate;
  const certificateValidation = validateAssuranceCertificate(certificate);
  if (!certificateValidation.valid) {
    return fail("embedded Assurance Certificate failed integrity/policy validation", {
      reviewerSignatureValid: true,
      reviewerKeyId: reviewer.keyId,
    });
  }

  const provenanceSigner =
    envelope.payload.build_provenance.signature.key_id.toLowerCase();
  if (!certificate.builderTrust.authorizedKeyIds.includes(provenanceSigner)) {
    return fail("build provenance signer is outside the certificate builder authorization set", {
      reviewerSignatureValid: true,
      certificateValid: true,
      reviewerKeyId: reviewer.keyId,
    });
  }

  let verifiedProvenance;
  try {
    verifiedProvenance = await signedBuildProvenanceAttestationToVerified({
      snapshot: envelope.payload.build_provenance,
      expectedKeyId: provenanceSigner,
    });
  } catch (error) {
    return fail(
      `build provenance verification failed: ${error instanceof Error ? error.message : String(error)}`,
      {
        reviewerSignatureValid: true,
        certificateValid: true,
        reviewerKeyId: reviewer.keyId,
      },
    );
  }

  const provenanceRef = certificate.buildProvenance;
  const provenanceMatches = Boolean(
    provenanceRef &&
    provenanceRef.runtimeVerified === true &&
    provenanceRef.repository.toLowerCase() === verifiedProvenance.repository.toLowerCase() &&
    provenanceRef.commit.toLowerCase() === verifiedProvenance.commit.toLowerCase() &&
    provenanceRef.binaryDigest.toLowerCase() === verifiedProvenance.binaryDigest.toLowerCase() &&
    provenanceRef.statementDigest.toLowerCase() === verifiedProvenance.statementDigest.toLowerCase() &&
    provenanceRef.payloadDigest.toLowerCase() === verifiedProvenance.payloadDigest.toLowerCase() &&
    provenanceRef.builderId === verifiedProvenance.builderId &&
    provenanceRef.signerKeyId.toLowerCase() === verifiedProvenance.signerKeyId.toLowerCase(),
  );
  if (!provenanceMatches) {
    return fail("reverified build provenance does not match the certificate provenance reference", {
      reviewerSignatureValid: true,
      certificateValid: true,
      reviewerKeyId: reviewer.keyId,
    });
  }

  const liveDigests: string[] = [];
  for (const item of envelope.payload.sentinel) {
    const signer = item.snapshot.signature.key_id.toLowerCase();
    if (!certificate.observerTrust.authorizedKeyIds.includes(signer)) {
      return fail("Sentinel signer is outside the certificate observer authorization set", {
        reviewerSignatureValid: true,
        certificateValid: true,
        buildProvenanceValid: true,
        reviewerKeyId: reviewer.keyId,
        reconstructedLiveRecordDigests: liveDigests,
      });
    }
    try {
      const record = await signedSentinelAttestationToRecord({
        snapshot: item.snapshot,
        sentinelBaseUrl: item.sentinel_base_url,
        expectedKeyId: signer,
      });
      liveDigests.push(record.integrity.recordDigest);
    } catch (error) {
      return fail(
        `Sentinel evidence verification failed: ${error instanceof Error ? error.message : String(error)}`,
        {
          reviewerSignatureValid: true,
          certificateValid: true,
          buildProvenanceValid: true,
          reviewerKeyId: reviewer.keyId,
          reconstructedLiveRecordDigests: liveDigests,
        },
      );
    }
  }

  const expectedLiveDigests = certificate.records
    .filter((record) => record.sourceClass === "LIVE_OBSERVATION")
    .map((record) => record.digest);
  if (!equalStringArrays(liveDigests, expectedLiveDigests)) {
    return fail("reverified Sentinel Reality Record set does not exactly match certificate LIVE_OBSERVATION references", {
      reviewerSignatureValid: true,
      certificateValid: true,
      buildProvenanceValid: true,
      reviewerKeyId: reviewer.keyId,
      reconstructedLiveRecordDigests: liveDigests,
    });
  }

  const nativeDigests: string[] = [];
  for (const snapshot of envelope.payload.native_replay) {
    const signer = snapshot.signature.key_id.toLowerCase();
    if (!certificate.nativeReplayTrust.authorizedKeyIds.includes(signer)) {
      return fail("native replay signer is outside the certificate replay authorization set", {
        reviewerSignatureValid: true,
        certificateValid: true,
        buildProvenanceValid: true,
        sentinelEvidenceValid: true,
        reviewerKeyId: reviewer.keyId,
        reconstructedLiveRecordDigests: liveDigests,
        reconstructedNativeReplayDigests: nativeDigests,
      });
    }
    try {
      const record = await signedNativeReplayAttestationToRecord({
        snapshot,
        expectedKeyId: signer,
      });
      nativeDigests.push(record.integrity.recordDigest);
    } catch (error) {
      return fail(
        `native replay evidence verification failed: ${error instanceof Error ? error.message : String(error)}`,
        {
          reviewerSignatureValid: true,
          certificateValid: true,
          buildProvenanceValid: true,
          sentinelEvidenceValid: true,
          reviewerKeyId: reviewer.keyId,
          reconstructedLiveRecordDigests: liveDigests,
          reconstructedNativeReplayDigests: nativeDigests,
        },
      );
    }
  }

  const expectedNativeDigests = certificate.records
    .filter((record) => record.sourceClass === "NATIVE_REPLAY")
    .map((record) => record.digest);
  if (!equalStringArrays(nativeDigests, expectedNativeDigests)) {
    return fail("reverified native replay Reality Record set does not exactly match certificate NATIVE_REPLAY references", {
      reviewerSignatureValid: true,
      certificateValid: true,
      buildProvenanceValid: true,
      sentinelEvidenceValid: true,
      reviewerKeyId: reviewer.keyId,
      reconstructedLiveRecordDigests: liveDigests,
      reconstructedNativeReplayDigests: nativeDigests,
    });
  }

  return {
    valid: true,
    reviewerSignatureValid: true,
    certificateValid: true,
    buildProvenanceValid: true,
    sentinelEvidenceValid: true,
    nativeReplayEvidenceValid: true,
    reason: "reviewer signature, certificate policy/integrity, signed build provenance, signed Sentinel evidence, and signed native replay evidence all reverified and match the certificate references",
    reviewerKeyId: reviewer.keyId,
    reconstructedLiveRecordDigests: normalize(liveDigests),
    reconstructedNativeReplayDigests: normalize(nativeDigests),
  };
}
