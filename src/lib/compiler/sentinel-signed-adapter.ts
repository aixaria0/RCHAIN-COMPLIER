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

export interface SentinelGenesisEvidence {
  configured_hash: string;
  available: boolean;
  raw: Record<string, unknown> | null;
  payload_sha256: string | null;
  observed_hash: string | null;
  observed_height: number | null;
  hash_match: boolean | null;
  height_zero: boolean | null;
  error: string | null;
}

export interface SentinelFailureDomainDeclaration {
  node_url: string;
  operator_id: string;
  provider_id: string;
  region: string;
  failure_domain_id: string;
}

export interface SignedSentinelAttestation {
  schema: typeof SENTINEL_ATTESTATION_SCHEMA;
  payload: {
    schema: typeof SENTINEL_ATTESTATION_SCHEMA;
    collected_at_unix_ms: number;
    challenge_nonce: string;
    network: SentinelNetworkStatus;
    genesis: SentinelGenesisEvidence;
    finalized_block: SentinelFinalizedBlockEvidence;
    cross_node: SentinelCrossNodeReport;
    failure_domains: SentinelFailureDomainDeclaration[];
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

function normalizeNodeUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function validateFailureDomainDeclarations(
  payload: SignedSentinelAttestation["payload"],
): { valid: boolean; reason: string; metrics: Record<string, number | boolean> } {
  const targetUrls = payload.cross_node.observations.map((item) =>
    normalizeNodeUrl(item.node_url),
  );
  const targetSet = new Set(targetUrls);
  const declarations = payload.failure_domains ?? [];
  const declarationUrls = declarations.map((item) =>
    normalizeNodeUrl(item.node_url),
  );
  const declarationSet = new Set(declarationUrls);

  const fieldsComplete = declarations.every(
    (item) =>
      normalizeNodeUrl(item.node_url).length > 0 &&
      item.operator_id.trim().length > 0 &&
      item.provider_id.trim().length > 0 &&
      item.region.trim().length > 0 &&
      item.failure_domain_id.trim().length > 0,
  );
  const noDuplicateTargets =
    declarationSet.size === declarationUrls.length &&
    targetSet.size === targetUrls.length;
  const exactCoverage =
    targetSet.size === declarationSet.size &&
    [...targetSet].every((url) => declarationSet.has(url));
  const targetCountConsistent =
    payload.cross_node.target_count === targetUrls.length &&
    declarations.length === targetUrls.length;
  const distinctOperators = new Set(
    declarations.map((item) => item.operator_id.trim()),
  ).size;
  const distinctProviders = new Set(
    declarations.map((item) => item.provider_id.trim()),
  ).size;
  const distinctRegions = new Set(
    declarations.map((item) => item.region.trim()),
  ).size;
  const distinctFailureDomains = new Set(
    declarations.map((item) => item.failure_domain_id.trim()),
  ).size;
  const minimumIndependentDeclarations =
    declarations.length >= 2 &&
    distinctOperators >= 2 &&
    distinctFailureDomains >= 2;

  const valid =
    fieldsComplete &&
    noDuplicateTargets &&
    exactCoverage &&
    targetCountConsistent &&
    minimumIndependentDeclarations;

  return {
    valid,
    reason: valid
      ? "signed failure-domain declarations exactly cover all cross-node targets with at least two distinct operators and failure-domain ids"
      : `invalid signed failure-domain declarations: fieldsComplete=${fieldsComplete}, noDuplicateTargets=${noDuplicateTargets}, exactCoverage=${exactCoverage}, targetCountConsistent=${targetCountConsistent}, declarations=${declarations.length}, distinctOperators=${distinctOperators}, distinctFailureDomains=${distinctFailureDomains}`,
    metrics: {
      declarationCount: declarations.length,
      targetCount: targetUrls.length,
      fieldsComplete,
      noDuplicateTargets,
      exactCoverage,
      targetCountConsistent,
      distinctOperators,
      distinctProviders,
      distinctRegions,
      distinctFailureDomains,
      minimumIndependentDeclarations,
    },
  };
}

function isChallengeNonce(value: string): boolean {
  return /^[0-9a-f]{64}$/.test(value);
}

function generateChallengeNonce(): string {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function verifySignedSentinelAttestation(
  snapshot: SignedSentinelAttestation,
  expectedKeyId: string,
  expectedChallengeNonce?: string,
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
  if (!isChallengeNonce(snapshot.payload.challenge_nonce)) {
    return {
      valid: false,
      keyId: null,
      reason: "Sentinel challenge nonce must be exactly 32 bytes of lowercase hexadecimal",
      payloadDigest: null,
    };
  }
  if (
    expectedChallengeNonce !== undefined &&
    snapshot.payload.challenge_nonce !== expectedChallengeNonce
  ) {
    return {
      valid: false,
      keyId: null,
      reason: "signed Sentinel challenge nonce does not match the verifier request",
      payloadDigest: null,
    };
  }

  const failureDomains = validateFailureDomainDeclarations(snapshot.payload);
  if (!failureDomains.valid) {
    return {
      valid: false,
      keyId: null,
      reason: failureDomains.reason,
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
  expectedChallengeNonce?: string;
}): Promise<RealityRecord> {
  const verification = await verifySignedSentinelAttestation(
    args.snapshot,
    args.expectedKeyId,
    args.expectedChallengeNonce,
  );
  if (!verification.valid || !verification.keyId || !verification.payloadDigest) {
    throw new Error(`Sentinel attestation rejected: ${verification.reason}`);
  }

  const collectedAt = new Date(args.snapshot.payload.collected_at_unix_ms).toISOString();
  const genesis = args.snapshot.payload.genesis;
  const genesisVerified =
    genesis.available === true &&
    typeof genesis.configured_hash === "string" &&
    genesis.configured_hash.trim().length > 0 &&
    typeof genesis.observed_hash === "string" &&
    genesis.observed_hash.trim().length > 0 &&
    genesis.hash_match === true &&
    genesis.observed_height === 0 &&
    genesis.height_zero === true &&
    typeof genesis.payload_sha256 === "string" &&
    /^sha256:[0-9a-f]{64}$/i.test(genesis.payload_sha256);
  const genesisDivergent =
    genesis.available === true &&
    (genesis.hash_match === false ||
      genesis.height_zero === false ||
      (typeof genesis.observed_height === "number" && genesis.observed_height !== 0));

  const base = sentinelBundleToRecord({
    sentinelBaseUrl: args.sentinelBaseUrl,
    collectedAt,
    evidence: args.snapshot.payload.finalized_block,
    network: args.snapshot.payload.network,
    crossNode: args.snapshot.payload.cross_node,
  });
  const { integrity: _integrity, state: _state, ...payload } = base;

  const observationId = `sentinel-attestation:${verification.payloadDigest}`;
  const genesisObservationId =
    `sentinel-genesis:${verification.payloadDigest}`;
  const failureDomainObservationId =
    `sentinel-failure-domains:${verification.payloadDigest}`;
  const evidenceId = `evidence:${observationId}`;
  const genesisEvidenceId = `evidence:${genesisObservationId}`;
  const failureDomainEvidenceId =
    `evidence:${failureDomainObservationId}`;
  const failureDomainValidation =
    validateFailureDomainDeclarations(args.snapshot.payload);
  const record = sealRealityRecord({
    ...payload,
    observations: [
      ...payload.observations,
      {
        id: genesisObservationId,
        source: "rchain-sentinel",
        type: "GenesisEvidence",
        timestamp: collectedAt,
        data: {
          configuredHash: genesis.configured_hash,
          available: genesis.available,
          payloadSha256: genesis.payload_sha256,
          observedHash: genesis.observed_hash,
          observedHeight: genesis.observed_height,
          hashMatch: genesis.hash_match,
          heightZero: genesis.height_zero,
          error: genesis.error,
          genesisVerified,
        },
      },
      {
        id: failureDomainObservationId,
        source: "rchain-sentinel",
        type: "FailureDomainDeclarations",
        timestamp: collectedAt,
        data: {
          declarations: args.snapshot.payload.failure_domains,
          ...failureDomainValidation.metrics,
          declarationValidation: failureDomainValidation.valid,
        },
      },
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
          challengeNonce: args.snapshot.payload.challenge_nonce,
          challengeVerified:
            args.expectedChallengeNonce === undefined ||
            args.snapshot.payload.challenge_nonce === args.expectedChallengeNonce,
          signatureVerified: true,
        },
      },
    ],
    evidence: [
      ...payload.evidence,
      {
        id: genesisEvidenceId,
        observationIds: [genesisObservationId],
        ...(genesis.payload_sha256 ? { hash: genesis.payload_sha256 } : {}),
        description: "Configured genesis trust anchor challenged against the RNode canonical block endpoint.",
      },
      {
        id: failureDomainEvidenceId,
        observationIds: [failureDomainObservationId],
        hash: verification.payloadDigest,
        description: "Signed operator/provider/region/failure-domain declarations bound to the Sentinel cross-node target set.",
      },
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
        id: "transform_sentinel_genesis_to_verified_observation",
        name: "RNode genesis challenge → signed genesis identity observation",
        inputIds: [verification.payloadDigest],
        outputIds: [genesisObservationId],
        deterministic: true,
      },
      {
        id: "transform_sentinel_failure_domains_to_verified_observation",
        name: "Signed failure-domain declarations → target-bound operational topology observation",
        inputIds: [verification.payloadDigest],
        outputIds: [failureDomainObservationId],
        deterministic: true,
      },
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
        id: "verify_sentinel_genesis_identity",
        predicate: "configured genesis hash resolves through RNode /block/{hash}, matches the returned hash, and has blockNumber = 0",
        state: genesisVerified ? "VERIFIED" : genesisDivergent ? "DIVERGENT" : "INCOMPLETE",
        message: genesisVerified
          ? `RNode genesis identity verified: ${genesis.observed_hash}`
          : genesis.error ?? `Genesis evidence incomplete or mismatched: configured=${genesis.configured_hash}, observed=${genesis.observed_hash ?? "missing"}, height=${genesis.observed_height ?? "missing"}`,
        evidenceIds: [genesisEvidenceId],
      },
      {
        id: "verify_sentinel_failure_domain_declarations",
        predicate: "signed failure-domain declarations exactly cover cross-node targets and document at least two operators/failure domains",
        state: failureDomainValidation.valid ? "VERIFIED" : "DIVERGENT",
        message: failureDomainValidation.reason,
        evidenceIds: [failureDomainEvidenceId],
      },
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
  options: { fetchImpl?: typeof fetch; challengeNonce?: string } = {},
): Promise<RealityRecord> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const base = sentinelBaseUrl.replace(/\/+$/, "");
  const challengeNonce = options.challengeNonce ?? generateChallengeNonce();
  if (!isChallengeNonce(challengeNonce)) {
    throw new Error("Sentinel challenge nonce must be exactly 32 bytes of lowercase hexadecimal");
  }
  const response = await fetchImpl(
    `${base}${SENTINEL_ENDPOINTS.attestationSnapshot}?nonce=${encodeURIComponent(challengeNonce)}`,
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
    expectedChallengeNonce: challengeNonce,
  });
}
