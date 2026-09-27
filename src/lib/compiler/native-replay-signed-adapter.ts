import {
  attestationPayloadDigest,
  attestationPublicKeyId,
  attestationSigningBytes,
  verifyPinnedEd25519Attestation,
  type PinnedEd25519Verification,
} from "./attestation-crypto.ts";
import {
  sealRealityRecord,
  type RealityRecord,
} from "./reality-record.ts";

export const NATIVE_REPLAY_ATTESTATION_SCHEMA =
  "rchain-native-replay-attestation/v1" as const;

export interface NativeReplayAttestationPayload {
  schema: typeof NATIVE_REPLAY_ATTESTATION_SCHEMA;
  collected_at_unix_ms: number;
  release: {
    repository: string;
    commit: string;
    binary_sha256: string;
  };
  subject: {
    id: string;
    label?: string;
  };
  replay: {
    expected_digest: string;
    observed_digest: string;
    input_digests: string[];
  };
  recovery?: {
    previous_record_digest: string;
    pre_process_id: string;
    recovered_process_id: string;
    pre_disk_id: string;
    recovered_disk_id: string;
    checkpoint_digest: string;
    checkpoint_trusted: boolean;
  };
}

export interface SignedNativeReplayAttestation {
  schema: typeof NATIVE_REPLAY_ATTESTATION_SCHEMA;
  payload: NativeReplayAttestationPayload;
  payload_sha256: string;
  signature: {
    algorithm: "Ed25519";
    key_id: string;
    public_key_hex: string;
    signature_hex: string;
  };
}

export type NativeReplayAttestationVerification = PinnedEd25519Verification;

const verifiedNativeReplayRecords = new WeakSet<RealityRecord>();
const nativeReplaySignerIds = new WeakMap<RealityRecord, string>();

function isSha256(value: string): boolean {
  return /^sha256:[0-9a-f]{64}$/i.test(value);
}

function validatePayload(payload: NativeReplayAttestationPayload): string | null {
  if (payload.schema !== NATIVE_REPLAY_ATTESTATION_SCHEMA) {
    return "unexpected native replay payload schema";
  }
  if (!payload.release.repository.trim()) {
    return "native replay repository identity is missing";
  }
  if (!/^[0-9a-f]{40}$/i.test(payload.release.commit)) {
    return "native replay commit must be a 40-hex Git commit";
  }
  if (!isSha256(payload.release.binary_sha256)) {
    return "native replay binary_sha256 must be a sha256 fingerprint";
  }
  if (!payload.subject.id.trim()) {
    return "native replay subject id is missing";
  }
  if (!isSha256(payload.replay.expected_digest)) {
    return "native replay expected_digest must be a sha256 fingerprint";
  }
  if (!isSha256(payload.replay.observed_digest)) {
    return "native replay observed_digest must be a sha256 fingerprint";
  }
  if (
    payload.replay.input_digests.some((digest) => !isSha256(digest))
  ) {
    return "native replay input_digests must all be sha256 fingerprints";
  }

  if (payload.recovery) {
    const recovery = payload.recovery;
    if (!/^[0-9a-f]{64}$/i.test(recovery.previous_record_digest)) {
      return "recovery previous_record_digest must be a Reality Record SHA-256 hex digest";
    }
    if (
      !recovery.pre_process_id ||
      !recovery.recovered_process_id ||
      recovery.pre_process_id === recovery.recovered_process_id
    ) {
      return "recovery requires distinct non-empty process ids";
    }
    if (
      !recovery.pre_disk_id ||
      !recovery.recovered_disk_id ||
      recovery.pre_disk_id === recovery.recovered_disk_id
    ) {
      return "recovery requires distinct non-empty disk ids";
    }
    if (!isSha256(recovery.checkpoint_digest)) {
      return "recovery checkpoint_digest must be a sha256 fingerprint";
    }
    if (recovery.checkpoint_trusted !== true) {
      return "recovery checkpoint must be explicitly trusted by the native replay signer";
    }
  }

  return null;
}

export function nativeReplayAttestationSigningBytes(
  payload: NativeReplayAttestationPayload,
): Uint8Array {
  return attestationSigningBytes(NATIVE_REPLAY_ATTESTATION_SCHEMA, payload);
}

export function nativeReplayAttestationPayloadDigest(
  payload: NativeReplayAttestationPayload,
): Promise<string> {
  return attestationPayloadDigest(payload);
}

export function nativeReplayAttestationPublicKeyId(
  publicKeyHex: string,
): Promise<string> {
  return attestationPublicKeyId(publicKeyHex);
}

export async function verifySignedNativeReplayAttestation(
  snapshot: SignedNativeReplayAttestation,
  expectedKeyId: string,
): Promise<NativeReplayAttestationVerification> {
  if (snapshot.schema !== NATIVE_REPLAY_ATTESTATION_SCHEMA) {
    return {
      valid: false,
      keyId: null,
      reason: "unexpected native replay envelope schema",
      payloadDigest: null,
    };
  }

  const payloadError = validatePayload(snapshot.payload);
  if (payloadError) {
    return {
      valid: false,
      keyId: null,
      reason: payloadError,
      payloadDigest: null,
    };
  }

  const result = await verifyPinnedEd25519Attestation({
    schema: NATIVE_REPLAY_ATTESTATION_SCHEMA,
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
    reason: result.valid
      ? "Ed25519 native replay signature and pinned key id verified"
      : result.reason.replace("attestation signer", "native replay signer"),
  };
}

export async function signedNativeReplayAttestationToRecord(args: {
  snapshot: SignedNativeReplayAttestation;
  expectedKeyId: string;
}): Promise<RealityRecord> {
  const verification = await verifySignedNativeReplayAttestation(
    args.snapshot,
    args.expectedKeyId,
  );
  if (!verification.valid || !verification.keyId || !verification.payloadDigest) {
    throw new Error(`Native replay attestation rejected: ${verification.reason}`);
  }

  const payload = args.snapshot.payload;
  const match = payload.replay.expected_digest === payload.replay.observed_digest;
  const timestamp = new Date(payload.collected_at_unix_ms).toISOString();
  const attestationObservationId =
    `native-replay-attestation:${verification.payloadDigest}`;
  const executionObservationId =
    `native-replay-execution:${verification.payloadDigest}`;
  const observations = [
    {
      id: executionObservationId,
      source: "rchain-rust-native-replay",
      type: "NativeReplayExecution",
      timestamp,
      data: {
        repository: payload.release.repository,
        commit: payload.release.commit,
        binaryDigest: payload.release.binary_sha256,
        expectedDigest: payload.replay.expected_digest,
        observedDigest: payload.replay.observed_digest,
        inputDigests: payload.replay.input_digests,
      },
    },
    {
      id: attestationObservationId,
      source: "rchain-rust-native-replay",
      type: "AttestationSignature",
      timestamp,
      data: {
        schema: args.snapshot.schema,
        algorithm: args.snapshot.signature.algorithm,
        keyId: verification.keyId,
        payloadDigest: verification.payloadDigest,
        signatureVerified: true,
      },
    },
    ...(payload.recovery
      ? [
          {
            id: `recovery-context:${verification.payloadDigest}`,
            source: "rchain-rust-native-replay",
            type: "RecoveryContext",
            timestamp,
            data: {
              preProcessId: payload.recovery.pre_process_id,
              recoveredProcessId: payload.recovery.recovered_process_id,
              preDiskId: payload.recovery.pre_disk_id,
              recoveredDiskId: payload.recovery.recovered_disk_id,
              checkpointDigest: payload.recovery.checkpoint_digest,
              checkpointTrusted: payload.recovery.checkpoint_trusted,
            },
          },
        ]
      : []),
  ];

  const evidenceId = `evidence:${attestationObservationId}`;
  const record = sealRealityRecord(
    {
      schema: "rchain-reality-record/v1",
      id: `native-replay:${verification.payloadDigest}`,
      subject: {
        id: payload.subject.id,
        kind: "native-replay",
        ...(payload.subject.label ? { label: payload.subject.label } : {}),
      },
      source: "rchain-rust-native-replay",
      observations,
      claims: [
        {
          id: "claim_native_replay_state",
          statement: match
            ? "Pinned native replay produced the expected state digest."
            : "Pinned native replay produced a state digest different from the expected state.",
          basis: [
            executionObservationId,
            `commit:${payload.release.commit}`,
            `binary:${payload.release.binary_sha256}`,
          ],
        },
      ],
      evidence: [
        {
          id: evidenceId,
          observationIds: observations.map((observation) => observation.id),
          hash: verification.payloadDigest,
          description: "Pinned-key signed native replay evidence package.",
        },
      ],
      dependencies: observations
        .slice(1)
        .map((observation) => ({
          from: executionObservationId,
          to: observation.id,
          relation: "contextualizes",
        })),
      transformations: [
        {
          id: "transform_native_replay_attestation_to_reality_record",
          name: "Signed native replay attestation → Reality Record",
          inputIds: [verification.payloadDigest],
          outputIds: observations.map((observation) => observation.id),
          deterministic: true,
        },
      ],
      verification: [
        {
          id: "verify_native_replay_attestation_signature",
          predicate: "Ed25519 signature verifies under the pinned native replay key id",
          state: "VERIFIED",
          message: `Pinned native replay signer verified: ${verification.keyId}`,
          evidenceIds: [evidenceId],
        },
        {
          id: "verify_native_replay_state_digest",
          predicate: "expected replay state digest equals observed replay state digest",
          state: match ? "VERIFIED" : "DIVERGENT",
          message: match
            ? "Native replay state digest matches the expected digest."
            : "Native replay state digest diverges from the expected digest.",
          evidenceIds: [evidenceId],
        },
      ],
      replay: {
        available: true,
        inputIds: payload.replay.input_digests,
        expectedDigest: payload.replay.expected_digest,
        observedDigest: payload.replay.observed_digest,
        state: match ? "REPRODUCED" : "DIVERGENT",
      },
    },
    payload.recovery?.previous_record_digest,
  );

  verifiedNativeReplayRecords.add(record);
  nativeReplaySignerIds.set(record, verification.keyId);
  return record;
}

export function isCryptographicallyVerifiedNativeReplayRecord(
  record: RealityRecord,
): boolean {
  return verifiedNativeReplayRecords.has(record);
}

export function nativeReplaySignerKeyId(record: RealityRecord): string | null {
  return nativeReplaySignerIds.get(record) ?? null;
}
