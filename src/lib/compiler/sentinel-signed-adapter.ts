import {
  sealRealityRecord,
  type RealityRecord,
} from "./reality-record.ts";
import {
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

export interface SentinelAttestationVerification {
  valid: boolean;
  keyId: string | null;
  reason: string;
  payloadDigest: string | null;
}

const verifiedSignedRecords = new WeakSet<RealityRecord>();

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  return value;
}

export function sentinelAttestationPayloadBytes(
  payload: SignedSentinelAttestation["payload"],
): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(canonicalize(payload)));
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function hexToBytes(value: string): Uint8Array {
  if (value.length % 2 !== 0 || !/^[0-9a-f]*$/i.test(value)) {
    throw new Error("invalid hexadecimal input");
  }
  const output = new Uint8Array(value.length / 2);
  for (let index = 0; index < output.length; index += 1) {
    output[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return output;
}

function bytesToHex(value: ArrayBuffer | Uint8Array): string {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: Uint8Array): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", value);
  return `sha256:${bytesToHex(digest)}`;
}

export function sentinelAttestationSigningBytes(
  payload: SignedSentinelAttestation["payload"],
): Uint8Array {
  return signingMessage(sentinelAttestationPayloadBytes(payload));
}

export async function sentinelAttestationPublicKeyId(
  publicKeyHex: string,
): Promise<string> {
  const publicKey = hexToBytes(publicKeyHex);
  if (publicKey.length !== 32) {
    throw new Error("Ed25519 public key must contain exactly 32 bytes");
  }
  return sha256(publicKey);
}

export async function sentinelAttestationPayloadDigest(
  payload: SignedSentinelAttestation["payload"],
): Promise<string> {
  return sha256(sentinelAttestationPayloadBytes(payload));
}

function signingMessage(payloadBytes: Uint8Array): Uint8Array {
  return concatBytes(
    new TextEncoder().encode(`${SENTINEL_ATTESTATION_SCHEMA}\n`),
    payloadBytes,
  );
}

export async function verifySignedSentinelAttestation(
  snapshot: SignedSentinelAttestation,
  expectedKeyId: string,
): Promise<SentinelAttestationVerification> {
  try {
    if (snapshot.schema !== SENTINEL_ATTESTATION_SCHEMA) {
      return { valid: false, keyId: null, reason: "unexpected envelope schema", payloadDigest: null };
    }
    if (snapshot.payload.schema !== SENTINEL_ATTESTATION_SCHEMA) {
      return { valid: false, keyId: null, reason: "unexpected payload schema", payloadDigest: null };
    }
    if (snapshot.signature.algorithm !== "Ed25519") {
      return { valid: false, keyId: null, reason: "unexpected signature algorithm", payloadDigest: null };
    }
    if (!/^sha256:[0-9a-f]{64}$/i.test(expectedKeyId)) {
      return { valid: false, keyId: null, reason: "expected key id is not a sha256 fingerprint", payloadDigest: null };
    }

    const publicKey = hexToBytes(snapshot.signature.public_key_hex);
    const signature = hexToBytes(snapshot.signature.signature_hex);
    if (publicKey.length !== 32 || signature.length !== 64) {
      return {
        valid: false,
        keyId: null,
        reason: "invalid Ed25519 public-key or signature length",
        payloadDigest: null,
      };
    }

    const keyId = await sha256(publicKey);
    if (keyId.toLowerCase() !== snapshot.signature.key_id.toLowerCase()) {
      return { valid: false, keyId, reason: "public key fingerprint does not match envelope key_id", payloadDigest: null };
    }
    if (keyId.toLowerCase() !== expectedKeyId.toLowerCase()) {
      return { valid: false, keyId, reason: "Sentinel signer key id is not the pinned expected key", payloadDigest: null };
    }

    const payloadBytes = sentinelAttestationPayloadBytes(snapshot.payload);
    const payloadDigest = await sha256(payloadBytes);
    if (payloadDigest.toLowerCase() !== snapshot.payload_sha256.toLowerCase()) {
      return { valid: false, keyId, reason: "canonical payload digest mismatch", payloadDigest };
    }

    const cryptoKey = await globalThis.crypto.subtle.importKey(
      "raw",
      publicKey,
      { name: "Ed25519" },
      false,
      ["verify"],
    );
    const signatureValid = await globalThis.crypto.subtle.verify(
      { name: "Ed25519" },
      cryptoKey,
      signature,
      signingMessage(payloadBytes),
    );

    return {
      valid: signatureValid,
      keyId,
      reason: signatureValid ? "Ed25519 signature and pinned key id verified" : "Ed25519 signature verification failed",
      payloadDigest,
    };
  } catch (error) {
    return {
      valid: false,
      keyId: null,
      reason: error instanceof Error ? error.message : "Sentinel attestation verification failed",
      payloadDigest: null,
    };
  }
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

export function isCryptographicallyVerifiedSentinelRecord(record: RealityRecord): boolean {
  return verifiedSignedRecords.has(record);
}
