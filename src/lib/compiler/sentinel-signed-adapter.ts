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
    network: SentinelNetworkStatus;
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
  const failureDomainObservationId =
    `sentinel-failure-domains:${verification.payloadDigest}`;
  const evidenceId = `evidence:${observationId}`;
  const failureDomainEvidenceId =
    `evidence:${failureDomainObservationId}`;
  const failureDomainValidation =
    validateFailureDomainDeclarations(args.snapshot.payload);
  const record = sealRealityRecord({
    ...payload,
    observations: [
      ...payload.observations,
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
          signatureVerified: true,
        },
      },
    ],
    evidence: [
      ...payload.evidence,
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
