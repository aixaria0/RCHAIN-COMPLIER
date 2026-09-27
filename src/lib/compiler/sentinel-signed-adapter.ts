import {
  attestationPayloadDigest,
  attestationPublicKeyId,
  attestationSigningBytes,
  canonicalAttestationPayloadBytes,
  verifyPinnedEd25519Attestation,
  type PinnedEd25519Verification,
} from "./attestation-crypto.ts";
import {
  sealRealityRecord,
  type RealityRecord,
} from "./reality-record.ts";
import {
  SENTINEL_ENDPOINTS,
  sentinelBundleToRecord,
  type SentinelCrossNodeReport,
  type SentinelFinalizedBlockEvidence,
  type SentinelNetworkStatus,
} from "./sentinel-adapter.ts";

export const SENTINEL_ATTESTATION_SCHEMA = "rchain-sentinel-attestation/v1" as const;

export interface SignedSentinelAttestation {
  schema: typeof SENTINEL_ATTESTATION_SCHEMA;
  payload: {
    schema: typeof SENTINEL_ATTESTATION_SCHEMA;
    collected_at_unix_ms: number;
    network: SentinelNetworkStatus;
    finalized_block: SentinelFinalizedBlockEvidence;
    cross_node: SentinelCrossNodeReport;
  };
  payload_sha256: string;
  signature: {
    algorithm: "Ed25519";
    key_id: string;
    public_key_hex: string;
    signature_hex: string;
  };
}

export type SentinelAttestationVerification = PinnedEd25519Verification;

const verifiedSignedRecords = new WeakSet<RealityRecord>();

export function sentinelAttestationPayloadBytes(
  payload: SignedSentinelAttestation["payload"],
): Uint8Array {
  return canonicalAttestationPayloadBytes(payload);
}

export function sentinelAttestationSigningBytes(
  payload: SignedSentinelAttestation["payload"],
): Uint8Array {
  return attestationSigningBytes(SENTINEL_ATTESTATION_SCHEMA, payload);
}

export function sentinelAttestationPublicKeyId(
  publicKeyHex: string,
): Promise<string> {
  return attestationPublicKeyId(publicKeyHex);
}

export function sentinelAttestationPayloadDigest(
  payload: SignedSentinelAttestation["payload"],
): Promise<string> {
  return attestationPayloadDigest(payload);
}

export async function verifySignedSentinelAttestation(
  snapshot: SignedSentinelAttestation,
  expectedKeyId: string,
): Promise<SentinelAttestationVerification> {
  if (snapshot.schema !== SENTINEL_ATTESTATION_SCHEMA) {
    return {
      valid: false,
      keyId: null,
      reason: "unexpected envelope schema",
      payloadDigest: null,
    };
  }
  if (snapshot.payload.schema !== SENTINEL_ATTESTATION_SCHEMA) {
    return {
      valid: false,
      keyId: null,
      reason: "unexpected payload schema",
      payloadDigest: null,
    };
  }

  const result = await verifyPinnedEd25519Attestation({
    schema: SENTINEL_ATTESTATION_SCHEMA,
    payload: snapshot.payload,
    declaredPayloadDigest: snapshot.payload_sha256,
    algorithm: snapshot.signature.algorithm,
    declaredKeyId: snapshot.signature.key_id,
    publicKeyHex: snapshot.signature.public_key_hex,
    signatureHex: snapshot.signature.signature_hex,
    expectedKeyId,
  });

  return {
    ...result,
    reason:
      result.valid
        ? "Ed25519 Sentinel signature and pinned key id verified"
        : result.reason.replace("attestation signer", "Sentinel signer"),
  };
}

export async function signedSentinelAttestationToRecord(args: {
  snapshot: SignedSentinelAttestation;
  sentinelBaseUrl: string;
  expectedKeyId: string;
}): Promise<RealityRecord> {
  const verification = await verifySignedSentinelAttestation(
    args.snapshot,
    args.expectedKeyId,
  );
  if (!verification.valid || !verification.keyId || !verification.payloadDigest) {
    throw new Error(`Sentinel attestation rejected: ${verification.reason}`);
  }

  const collectedAt = new Date(args.snapshot.payload.collected_at_unix_ms).toISOString();
  const base = sentinelBundleToRecord({
    sentinelBaseUrl: args.sentinelBaseUrl,
    collectedAt,
    evidence: args.snapshot.payload.finalized_block,
    network: args.snapshot.payload.network,
    crossNode: args.snapshot.payload.cross_node,
  });
  const { integrity: _integrity, state: _state, ...payload } = base;

  const observationId = `sentinel-attestation:${verification.payloadDigest}`;
  const evidenceId = `evidence:${observationId}`;
  const record = sealRealityRecord({
    ...payload,
    observations: [
      ...payload.observations,
      {
        id: observationId,
        source: "rchain-sentinel",
        type: "AttestationSignature",
        timestamp: collectedAt,
        data: {
          schema: args.snapshot.schema,
          algorithm: args.snapshot.signature.algorithm,
          keyId: verification.keyId,
          payloadDigest: verification.payloadDigest,
          signatureVerified: true,
        },
      },
    ],
    evidence: [
      ...payload.evidence,
      {
        id: evidenceId,
        observationIds: [observationId],
        hash: verification.payloadDigest,
        description: "Pinned-key Ed25519 verification of the Sentinel observation snapshot.",
      },
    ],
    transformations: [
      ...payload.transformations,
      {
        id: "transform_sentinel_attestation_to_verified_observation",
        name: "Signed Sentinel snapshot → pinned-key verified observation",
        inputIds: [verification.payloadDigest],
        outputIds: [observationId],
        deterministic: true,
      },
    ],
    verification: [
      ...payload.verification,
      {
        id: "verify_sentinel_attestation_signature",
        predicate: "Ed25519 signature verifies under the pinned Sentinel key id",
        state: "VERIFIED",
        message: `Pinned Sentinel key verified: ${verification.keyId}`,
        evidenceIds: [evidenceId],
      },
    ],
  });

  verifiedSignedRecords.add(record);
  return record;
}

export function isCryptographicallyVerifiedSentinelRecord(
  record: RealityRecord,
): boolean {
  return verifiedSignedRecords.has(record);
}

export async function fetchSignedSentinelRealityRecord(
  sentinelBaseUrl: string,
  expectedKeyId: string,
  options: { fetchImpl?: typeof fetch } = {},
): Promise<RealityRecord> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const base = sentinelBaseUrl.replace(/\/+$/, "");
  const response = await fetchImpl(
    `${base}${SENTINEL_ENDPOINTS.attestationSnapshot}`,
  );
  if (!response.ok) {
    throw new Error(
      `Sentinel attestation endpoint returned HTTP ${response.status}`,
    );
  }

  const snapshot = (await response.json()) as SignedSentinelAttestation;
  return signedSentinelAttestationToRecord({
    snapshot,
    sentinelBaseUrl: base,
    expectedKeyId,
  });
}
