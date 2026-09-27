/**
 * RChain Assurance Fabric v1
 *
 * Composes four independent responsibilities:
 *   POSSIBILITY  - bounded/counterfactual analysis
 *   REALITY      - live observations sealed as Reality Records
 *   CONFORMANCE  - model/implementation or replay comparison
 *   RECOVERY     - restored-state validation
 *
 * The evaluator is fail-closed. Synthetic records are useful evidence but
 * never satisfy the live-observation gate.
 */

import { digest } from "./hash.ts";
import {
  verifyRealityRecordIntegrity,
  type RealityRecord,
} from "./reality-record.ts";
import type { WeightedPossibilityResult } from "./possibility-plane.ts";
import { isCryptographicallyVerifiedSentinelRecord } from "./sentinel-signed-adapter.ts";
import {
  isCryptographicallyVerifiedBuildProvenance,
  type VerifiedBuildProvenance,
} from "./build-provenance-signed-adapter.ts";
import {
  isCryptographicallyVerifiedNativeReplayRecord,
  nativeReplaySignerKeyId,
} from "./native-replay-signed-adapter.ts";
import type { FragilityReport } from "../cbc/fragility-engine.ts";

export type AssurancePlane = "POSSIBILITY" | "REALITY" | "CONFORMANCE" | "RECOVERY" | "SUPPLY_CHAIN";
export type AssuranceGateState = "PASS" | "FAIL" | "BLOCKED" | "NOT_TESTED";
export type AssuranceSourceClass =
  | "SYNTHETIC"
  | "LIVE_OBSERVATION"
  | "NATIVE_REPLAY"
  | "FORMAL_MODEL"
  | "INDEPENDENT_ATTESTATION";

export interface AssuranceReleaseIdentity {
  repository: string;
  commit: string;
  binaryDigest?: string;
  buildProvenance?: string;
}

export interface AssuranceNetworkIdentity {
  genesis: string;
  networkId?: string;
  shardId?: string;
  protocolVersion?: string;
  epoch?: string | number;
}

export interface AssuranceRecordInput {
  label: string;
  sourceClass: AssuranceSourceClass;
  record: RealityRecord;
}

export interface AssuranceCheckInput {
  id: string;
  plane: Exclude<AssurancePlane, "REALITY">;
  state: AssuranceGateState;
  description: string;
  critical?: boolean;
  evidence?: string[];
  metrics?: Record<string, string | number | boolean | null>;
  producer?: string;
}

export interface AssuranceRequirements {
  requireReleaseArtifactIdentity: boolean;
  requireBuildProvenanceVerification: boolean;
  requireBuilderAuthorization: boolean;
  requireNativeReplaySignature: boolean;
  requireNativeReplayAuthorization: boolean;
  requireNativeReplayReleaseBinding: boolean;
  requireLiveObservation: boolean;
  requireFailureDomainDeclarations: boolean;
  requireObserverSignature: boolean;
  requireObserverAuthorization: boolean;
  requireNetworkIdentityBinding: boolean;
  requireFreshness: boolean;
  requirePossibility: boolean;
  requireConformance: boolean;
  requireRecovery: boolean;
}

export interface AssuranceFreshnessPolicy {
  maxObservationAgeMs: number;
}

export interface AssuranceObserverTrust {
  authorizedKeyIds: string[];
}

export interface AssuranceBuilderTrust {
  authorizedKeyIds: string[];
  authorizedBuilderIds: string[];
}

export interface AssuranceNativeReplayTrust {
  authorizedKeyIds: string[];
}

export interface AssuranceBuildProvenanceReference {
  schema: string;
  repository: string;
  commit: string;
  binaryDigest: string;
  statementDigest: string;
  payloadDigest: string;
  builderId: string;
  signerKeyId: string;
  subjectName: string;
  runtimeVerified: boolean;
}

export interface AssuranceFabricInput {
  issuedAt: string;
  freshness: AssuranceFreshnessPolicy;
  observerTrust?: AssuranceObserverTrust;
  builderTrust?: AssuranceBuilderTrust;
  nativeReplayTrust?: AssuranceNativeReplayTrust;
  buildProvenance?: VerifiedBuildProvenance;
  release: AssuranceReleaseIdentity;
  network: AssuranceNetworkIdentity;
  records: AssuranceRecordInput[];
  checks: AssuranceCheckInput[];
  requirements?: Partial<AssuranceRequirements>;
}

export interface AssuranceCheck {
  id: string;
  plane: AssurancePlane;
  state: AssuranceGateState;
  critical: boolean;
  description: string;
  evidence: string[];
  metrics?: Record<string, string | number | boolean | null>;
  producer?: string;
  producerVerified?: boolean;
}

export interface AssuranceRecordReference {
  id: string;
  label: string;
  source: string;
  sourceClass: AssuranceSourceClass;
  observerKeyId?: string;
  sourceClassVerified: boolean;
  state: RealityRecord["state"];
  digest: string;
  integrityValid: boolean;
}

export interface AssuranceCertificate {
  schema: "rchain-assurance-certificate/v1";
  id: string;
  issuedAt: string;
  policy: {
    id: "rchain-revival-strict/v1";
    digest: string;
  };
  freshness: AssuranceFreshnessPolicy;
  observerTrust: AssuranceObserverTrust;
  builderTrust: AssuranceBuilderTrust;
  nativeReplayTrust: AssuranceNativeReplayTrust;
  buildProvenance?: AssuranceBuildProvenanceReference;
  release: AssuranceReleaseIdentity;
  network: AssuranceNetworkIdentity;
  requirements: AssuranceRequirements;
  limitations: string[];
  records: AssuranceRecordReference[];
  checks: AssuranceCheck[];
  status: AssuranceGateState;
  summary: {
    pass: number;
    fail: number;
    blocked: number;
    notTested: number;
  };
  integrity: {
    algorithm: "SHA-256";
    certificateDigest: string;
  };
}

const DEFAULT_REQUIREMENTS: AssuranceRequirements = {
  requireReleaseArtifactIdentity: true,
  requireBuildProvenanceVerification: true,
  requireBuilderAuthorization: true,
  requireNativeReplaySignature: true,
  requireNativeReplayAuthorization: true,
  requireNativeReplayReleaseBinding: true,
  requireLiveObservation: true,
  requireFailureDomainDeclarations: true,
  requireObserverSignature: true,
  requireObserverAuthorization: true,
  requireNetworkIdentityBinding: true,
  requireFreshness: true,
  requirePossibility: true,
  requireConformance: true,
  requireRecovery: true,
};

const STRICT_POLICY_ID = "rchain-revival-strict/v1" as const;
const MIN_CROSS_NODE_TARGETS = 2;
const MANDATORY_LIMITATIONS = [
  "certificate SHA-256 integrity is not signer authenticity",
  "a verified Sentinel signature proves possession of the pinned observer key, not organizational authorization of that key",
  "a verified build-provenance signature proves possession of the pinned builder key and binds the signed SLSA statement to the declared source/artifact; it does not prove the trusted build platform behaved honestly outside that trust assumption",
  "builder authorization is an explicit certificate policy declaration; organizational authority for that authorization remains external",
  "native replay signatures prove possession of pinned replay keys and bind replay/recovery claims to those signed payloads; they do not independently prove the replay host was uncompromised",
  "signed failure-domain declarations make claimed operator/provider/region topology tamper-evident but do not independently corroborate that the declarations are true",
  "cross-node consistency is not a stake-weighted Casper finality proof",
  "bounded possibility search proves only the declared model and search scope",
  "signed observation timestamps are tamper-evident but freshness still depends on observer clock accuracy",
] as const;
const TRUSTED_CHECK_PRODUCERS = [
  "weighted-possibility-search/v1",
  "cbc-fragility-adapter/v1",
  "reality-record-conformance/v1",
  "reality-record-recovery/v1",
] as const;
const TRUSTED_CHECK_ATTESTATION = Symbol("rchain-assurance-trusted-check");

type TrustedAssuranceCheckInput = AssuranceCheckInput & {
  readonly [TRUSTED_CHECK_ATTESTATION]: true;
};

function trustedCheck(
  input: AssuranceCheckInput,
  producer: string,
): AssuranceCheckInput {
  const value = {
    ...input,
    producer,
    evidence: Object.freeze([...(input.evidence ?? [])]),
    ...(input.metrics ? { metrics: Object.freeze({ ...input.metrics }) } : {}),
  } as TrustedAssuranceCheckInput;
  Object.defineProperty(value, TRUSTED_CHECK_ATTESTATION, {
    value: true,
    enumerable: false,
    writable: false,
  });
  return Object.freeze(value);
}

function isTrustedCheck(input: AssuranceCheckInput): boolean {
  const attested =
    (input as Partial<TrustedAssuranceCheckInput>)[TRUSTED_CHECK_ATTESTATION] === true;
  const producerAllowed =
    typeof input.producer === "string" &&
    (TRUSTED_CHECK_PRODUCERS as readonly string[]).includes(input.producer);
  return attested && producerAllowed;
}

function strictPolicyDescriptor(): Record<string, unknown> {
  return {
    id: STRICT_POLICY_ID,
    requirements: DEFAULT_REQUIREMENTS,
    minimumCrossNodeTargets: MIN_CROSS_NODE_TARGETS,
    failureDomainPolicy: {
      signedDeclarationsRequired: true,
      exactTargetCoverageRequired: true,
      minimumDistinctOperators: 2,
      minimumDistinctFailureDomains: 2,
      providerAndRegionMustBeDeclared: true,
    },
    nativeReplay: {
      attestationSchema: "rchain-native-replay-attestation/v1",
      signatureRequired: true,
      certificateEvidenceBindingRequired: true,
      releaseIdentityBindingRequired: true,
    },
    buildProvenance: {
      attestationSchema: "rchain-build-provenance-attestation/v1",
      statementType: "https://in-toto.io/Statement/v1",
      predicateType: "https://slsa.dev/provenance/v1",
    },
    sourceClassBindings: {
      SYNTHETIC: ["rchain-reality-compiler"],
      LIVE_OBSERVATION: ["rchain-sentinel"],
      NATIVE_REPLAY: ["rchain-rust-native-replay"],
      FORMAL_MODEL: ["quantum-logical-framework", "lean4"],
      INDEPENDENT_ATTESTATION: ["sovereign-lattice"],
    },
    trustedCheckProducers: [...TRUSTED_CHECK_PRODUCERS],
    mandatoryLimitations: [...MANDATORY_LIMITATIONS],
  };
}

function strictPolicyDigest(): string {
  return digest([JSON.stringify(canonicalize(strictPolicyDescriptor()))]);
}

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

function canonicalCertificatePayload(
  certificate: Omit<AssuranceCertificate, "integrity">,
): string {
  return JSON.stringify(canonicalize({
    schema: certificate.schema,
    id: certificate.id,
    issuedAt: certificate.issuedAt,
    policy: certificate.policy,
    freshness: certificate.freshness,
    observerTrust: certificate.observerTrust,
    builderTrust: certificate.builderTrust,
    nativeReplayTrust: certificate.nativeReplayTrust,
    buildProvenance: certificate.buildProvenance,
    release: certificate.release,
    network: certificate.network,
    requirements: certificate.requirements,
    limitations: certificate.limitations,
    records: certificate.records,
    checks: certificate.checks,
    status: certificate.status,
    summary: certificate.summary,
  }));
}

const SOURCE_CLASS_BINDINGS: Record<AssuranceSourceClass, ReadonlySet<string>> = {
  SYNTHETIC: new Set(["rchain-reality-compiler"]),
  LIVE_OBSERVATION: new Set(["rchain-sentinel"]),
  NATIVE_REPLAY: new Set(["rchain-rust-native-replay"]),
  FORMAL_MODEL: new Set(["quantum-logical-framework", "lean4"]),
  INDEPENDENT_ATTESTATION: new Set(["sovereign-lattice"]),
};

function sourceClassVerified(input: AssuranceRecordInput): boolean {
  return SOURCE_CLASS_BINDINGS[input.sourceClass].has(input.record.source);
}

function observerKeyId(record: RealityRecord): string | null {
  const observation = record.observations.find(
    (item) =>
      item.type === "AttestationSignature" &&
      item.source === "rchain-sentinel" &&
      typeof item.data.keyId === "string",
  );
  return observation && typeof observation.data.keyId === "string"
    ? observation.data.keyId
    : null;
}

function normalizedObserverTrust(
  input?: AssuranceObserverTrust,
): AssuranceObserverTrust {
  const authorizedKeyIds = [...new Set(input?.authorizedKeyIds ?? [])]
    .map((keyId) => keyId.toLowerCase())
    .sort();
  const malformed = authorizedKeyIds.filter(
    (keyId) => !/^sha256:[0-9a-f]{64}$/.test(keyId),
  );
  if (malformed.length > 0) {
    throw new Error(
      `observerTrust contains malformed key ids: ${malformed.join(", ")}`,
    );
  }
  return { authorizedKeyIds };
}

function normalizedBuilderTrust(
  input?: AssuranceBuilderTrust,
): AssuranceBuilderTrust {
  const authorizedKeyIds = [...new Set(input?.authorizedKeyIds ?? [])]
    .map((keyId) => keyId.toLowerCase())
    .sort();
  const malformed = authorizedKeyIds.filter(
    (keyId) => !/^sha256:[0-9a-f]{64}$/.test(keyId),
  );
  if (malformed.length > 0) {
    throw new Error(
      `builderTrust contains malformed key ids: ${malformed.join(", ")}`,
    );
  }

  const rawBuilderIds = input?.authorizedBuilderIds ?? [];
  if (rawBuilderIds.some((builderId) => !builderId.trim())) {
    throw new Error("builderTrust contains an empty builder id");
  }
  const authorizedBuilderIds = [...new Set(rawBuilderIds.map((builderId) => builderId.trim()))]
    .sort();

  return { authorizedKeyIds, authorizedBuilderIds };
}

function normalizedNativeReplayTrust(
  input?: AssuranceNativeReplayTrust,
): AssuranceNativeReplayTrust {
  const authorizedKeyIds = [...new Set(input?.authorizedKeyIds ?? [])]
    .map((keyId) => keyId.toLowerCase())
    .sort();
  const malformed = authorizedKeyIds.filter(
    (keyId) => !/^sha256:[0-9a-f]{64}$/.test(keyId),
  );
  if (malformed.length > 0) {
    throw new Error(
      `nativeReplayTrust contains malformed key ids: ${malformed.join(", ")}`,
    );
  }
  return { authorizedKeyIds };
}

function buildProvenanceReference(
  provenance?: VerifiedBuildProvenance,
): AssuranceBuildProvenanceReference | undefined {
  if (!provenance) return undefined;
  return {
    schema: provenance.schema,
    repository: provenance.repository,
    commit: provenance.commit,
    binaryDigest: provenance.binaryDigest,
    statementDigest: provenance.statementDigest,
    payloadDigest: provenance.payloadDigest,
    builderId: provenance.builderId,
    signerKeyId: provenance.signerKeyId,
    subjectName: provenance.subjectName,
    runtimeVerified: isCryptographicallyVerifiedBuildProvenance(provenance),
  };
}

function buildProvenanceVerificationCheck(
  release: AssuranceReleaseIdentity,
  provenance: VerifiedBuildProvenance | undefined,
  trust: AssuranceBuilderTrust,
): AssuranceCheck {
  if (!provenance) {
    return {
      id: "supply_chain_build_provenance",
      plane: "SUPPLY_CHAIN",
      state: "BLOCKED",
      critical: true,
      description: "No cryptographically verified signed SLSA build provenance was supplied.",
      evidence: [],
    };
  }

  const runtimeVerified = isCryptographicallyVerifiedBuildProvenance(provenance);
  if (!runtimeVerified) {
    return {
      id: "supply_chain_build_provenance",
      plane: "SUPPLY_CHAIN",
      state: "FAIL",
      critical: true,
      description: "Build provenance object was not produced by the pinned-key cryptographic verifier.",
      evidence: [`payload:${provenance.payloadDigest}`],
    };
  }

  const releaseComplete = Boolean(release.binaryDigest && release.buildProvenance);
  if (!releaseComplete) {
    return {
      id: "supply_chain_build_provenance",
      plane: "SUPPLY_CHAIN",
      state: "BLOCKED",
      critical: true,
      description: "Release identity is missing the binary or provenance-statement digest needed for provenance binding.",
      evidence: [`payload:${provenance.payloadDigest}`],
    };
  }

  const repositoryMatch =
    provenance.repository.trim().toLowerCase() === release.repository.trim().toLowerCase();
  const commitMatch =
    provenance.commit.toLowerCase() === release.commit.toLowerCase();
  const binaryMatch =
    provenance.binaryDigest.toLowerCase() === release.binaryDigest!.toLowerCase();
  const statementMatch =
    provenance.statementDigest.toLowerCase() === release.buildProvenance!.toLowerCase();

  if (!repositoryMatch || !commitMatch || !binaryMatch || !statementMatch) {
    return {
      id: "supply_chain_build_provenance",
      plane: "SUPPLY_CHAIN",
      state: "FAIL",
      critical: true,
      description: "Signed build provenance conflicts with the declared release repository, commit, binary digest, or provenance-statement digest.",
      evidence: [
        `repository-match:${repositoryMatch}`,
        `commit-match:${commitMatch}`,
        `binary-match:${binaryMatch}`,
        `statement-match:${statementMatch}`,
        `payload:${provenance.payloadDigest}`,
      ],
    };
  }

  if (trust.authorizedKeyIds.length === 0 || trust.authorizedBuilderIds.length === 0) {
    return {
      id: "supply_chain_build_provenance",
      plane: "SUPPLY_CHAIN",
      state: "BLOCKED",
      critical: true,
      description: "Builder trust policy must declare at least one authorized signer key and builder id.",
      evidence: [
        `signer:${provenance.signerKeyId}`,
        `builder:${provenance.builderId}`,
      ],
    };
  }

  const signerAuthorized = trust.authorizedKeyIds.includes(
    provenance.signerKeyId.toLowerCase(),
  );
  const builderAuthorized = trust.authorizedBuilderIds.includes(
    provenance.builderId,
  );

  return {
    id: "supply_chain_build_provenance",
    plane: "SUPPLY_CHAIN",
    state: signerAuthorized && builderAuthorized ? "PASS" : "FAIL",
    critical: true,
    description:
      signerAuthorized && builderAuthorized
        ? "Pinned-key signed SLSA provenance binds the authorized builder, source commit, and binary artifact to the declared release."
        : "Cryptographically valid build provenance was signed by a key or builder id outside the declared authorization policy.",
    evidence: [
      `payload:${provenance.payloadDigest}`,
      `statement:${provenance.statementDigest}`,
      `signer:${provenance.signerKeyId}`,
      `builder:${provenance.builderId}`,
      `subject:${provenance.subjectName}`,
      `signer-authorized:${signerAuthorized}`,
      `builder-authorized:${builderAuthorized}`,
    ],
    metrics: {
      runtimeVerified,
      repositoryMatch,
      commitMatch,
      binaryMatch,
      statementMatch,
      signerAuthorized,
      builderAuthorized,
    },
  };
}

function sentinelRecordShapeVerified(record: RealityRecord): boolean {
  if (record.source !== "rchain-sentinel") return false;
  if (record.subject.kind !== "sentinel-observation") return false;

  const block = record.observations.find(
    (observation) =>
      observation.type === "FinalizedBlockEvidence" &&
      observation.source === "rchain-sentinel",
  );
  const network = record.observations.find(
    (observation) =>
      observation.type === "NetworkStatus" &&
      observation.source === "rchain-sentinel",
  );
  const genesis = record.observations.find(
    (observation) =>
      observation.type === "GenesisEvidence" &&
      observation.source === "rchain-sentinel",
  );
  const crossNode = record.observations.find(
    (observation) =>
      observation.type === "CrossNodeReport" &&
      observation.source === "rchain-sentinel",
  );
  const failureDomains = record.observations.find(
    (observation) =>
      observation.type === "FailureDomainDeclarations" &&
      observation.source === "rchain-sentinel",
  );
  const attestation = record.observations.find(
    (observation) =>
      observation.type === "AttestationSignature" &&
      observation.source === "rchain-sentinel",
  );
  if (!block || !network || !genesis || !crossNode || !failureDomains || !attestation) return false;

  const transformationIds = new Set(record.transformations.map((item) => item.id));
  return (
    transformationIds.has("transform_sentinel_finalized_block_to_reality_observation") &&
    transformationIds.has("transform_sentinel_network_status_to_reality_observation") &&
    transformationIds.has("transform_sentinel_genesis_to_verified_observation") &&
    transformationIds.has("transform_sentinel_cross_node_to_reality_observation") &&
    transformationIds.has("transform_sentinel_failure_domains_to_verified_observation") &&
    transformationIds.has("transform_sentinel_attestation_to_verified_observation") &&
    transformationIds.has("transform_sentinel_observations_to_verification")
  );
}

function liveEvidenceQuality(input: AssuranceRecordInput): {
  valid: boolean;
  description: string;
  evidence: string[];
} {
  if (
    input.sourceClass !== "LIVE_OBSERVATION" ||
    !sourceClassVerified(input) ||
    !sentinelRecordShapeVerified(input.record)
  ) {
    return {
      valid: false,
      description: "Record does not match the allowed rchain-sentinel live adapter source and shape.",
      evidence: [],
    };
  }

  const verificationById = new Map(
    input.record.verification.map((verification) => [verification.id, verification]),
  );
  const requiredVerificationIds = [
    "verify_sentinel_payload_available",
    "verify_sentinel_canonical_consistency",
    "verify_sentinel_finality_hash",
    "verify_sentinel_genesis_identity",
    "verify_sentinel_cross_node_consistency",
    "verify_sentinel_failure_domain_declarations",
    "verify_sentinel_attestation_signature",
  ];
  const missingOrUnverified = requiredVerificationIds.filter(
    (id) => verificationById.get(id)?.state !== "VERIFIED",
  );

  const block = input.record.observations.find(
    (observation) => observation.type === "FinalizedBlockEvidence",
  );
  const network = input.record.observations.find(
    (observation) => observation.type === "NetworkStatus",
  );
  const genesis = input.record.observations.find(
    (observation) => observation.type === "GenesisEvidence",
  );
  const crossNode = input.record.observations.find(
    (observation) => observation.type === "CrossNodeReport",
  );
  const failureDomains = input.record.observations.find(
    (observation) => observation.type === "FailureDomainDeclarations",
  );
  const blockData = block?.data ?? {};
  const networkData = network?.data ?? {};
  const genesisData = genesis?.data ?? {};
  const crossNodeData = crossNode?.data ?? {};
  const failureDomainData = failureDomains?.data ?? {};

  const observerSignatureVerified =
    isCryptographicallyVerifiedSentinelRecord(input.record);

  const blockEvidenceComplete =
    blockData.available === true &&
    blockData.fullBlockAvailable === true &&
    blockData.finalityHashMatch === true &&
    blockData.canonicalConsistency === true &&
    blockData.nodeReportedFinalized === true;
  const networkReachable = networkData.reachable === true;
  const genesisVerified =
    genesisData.genesisVerified === true &&
    genesisData.available === true &&
    genesisData.hashMatch === true &&
    genesisData.heightZero === true &&
    genesisData.observedHeight === 0 &&
    typeof genesisData.configuredHash === "string" &&
    typeof genesisData.observedHash === "string" &&
    genesisData.configuredHash.toLowerCase() === genesisData.observedHash.toLowerCase();
  const crossNodeConsistent =
    typeof crossNodeData.targetCount === "number" &&
    crossNodeData.targetCount >= MIN_CROSS_NODE_TARGETS &&
    crossNodeData.agreement === true &&
    crossNodeData.conflictingNodes === 0 &&
    crossNodeData.hashAgreement === true &&
    crossNodeData.heightAgreement === true;
  const failureDomainsDocumented =
    failureDomainData.declarationValidation === true &&
    failureDomainData.exactCoverage === true &&
    failureDomainData.targetCountConsistent === true &&
    typeof failureDomainData.declarationCount === "number" &&
    failureDomainData.declarationCount >= MIN_CROSS_NODE_TARGETS &&
    typeof failureDomainData.distinctOperators === "number" &&
    failureDomainData.distinctOperators >= 2 &&
    typeof failureDomainData.distinctFailureDomains === "number" &&
    failureDomainData.distinctFailureDomains >= 2;

  const valid =
    verifyRealityRecordIntegrity(input.record) &&
    missingOrUnverified.length === 0 &&
    blockEvidenceComplete &&
    networkReachable &&
    genesisVerified &&
    crossNodeConsistent &&
    failureDomainsDocumented &&
    observerSignatureVerified;

  const evidence = [
    ...(block ? [block.id] : []),
    ...(network ? [network.id] : []),
    ...(genesis ? [genesis.id] : []),
    ...(crossNode ? [crossNode.id] : []),
    ...(failureDomains ? [failureDomains.id] : []),
    ...requiredVerificationIds.map(
      (id) => `${id}:${verificationById.get(id)?.state ?? "MISSING"}`,
    ),
  ];

  return {
    valid,
    description: valid
      ? "Live Sentinel evidence is integrity-valid, pinned-key signed, network-reachable, RNode-genesis-verified, canonically consistent, node-finalized, cross-node consistent, and carries signed failure-domain declarations covering at least two distinct operators/failure domains."
      : `Live Sentinel evidence is incomplete: missing/unverified=[${missingOrUnverified.join(",")}], blockComplete=${blockEvidenceComplete}, networkReachable=${networkReachable}, genesisVerified=${genesisVerified}, crossNodeConsistent=${crossNodeConsistent}, failureDomainsDocumented=${failureDomainsDocumented}, observerSignatureVerified=${observerSignatureVerified}.`,
    evidence,
  };
}

function realityChecks(records: AssuranceRecordInput[]): {
  references: AssuranceRecordReference[];
  checks: AssuranceCheck[];
} {
  const references: AssuranceRecordReference[] = [];
  const checks: AssuranceCheck[] = [];

  for (const input of records) {
    const integrityValid = verifyRealityRecordIntegrity(input.record);
    const classificationVerified = sourceClassVerified(input);
    references.push({
      id: input.record.id,
      label: input.label,
      source: input.record.source,
      sourceClass: input.sourceClass,
      ...(observerKeyId(input.record) ? { observerKeyId: observerKeyId(input.record)! } : {}),
      sourceClassVerified: classificationVerified,
      state: input.record.state,
      digest: input.record.integrity.recordDigest,
      integrityValid,
    });

    checks.push({
      id: `reality_source_class:${input.record.id}`,
      plane: "REALITY",
      state: classificationVerified ? "PASS" : "FAIL",
      critical: true,
      description: classificationVerified
        ? `${input.label}: evidence source classification is bound to an allowed adapter source.`
        : `${input.label}: source ${input.record.source} cannot be promoted as ${input.sourceClass}.`,
      evidence: [input.record.source],
    });

    if (input.sourceClass === "LIVE_OBSERVATION") {
      const quality = liveEvidenceQuality(input);
      checks.push({
        id: `reality_live_quality:${input.record.id}`,
        plane: "REALITY",
        state: quality.valid ? "PASS" : "BLOCKED",
        critical: true,
        description: quality.description,
        evidence: quality.evidence,
      });
    }

    if (input.sourceClass === "NATIVE_REPLAY") {
      const signatureVerified =
        isCryptographicallyVerifiedNativeReplayRecord(input.record);
      const signerKeyId = nativeReplaySignerKeyId(input.record);
      checks.push({
        id: `reality_native_replay_signature:${input.record.id}`,
        plane: "REALITY",
        state: signatureVerified && signerKeyId ? "PASS" : "BLOCKED",
        critical: true,
        description:
          signatureVerified && signerKeyId
            ? `${input.label}: native replay attestation signature was verified against pinned key ${signerKeyId}.`
            : `${input.label}: native replay record lacks runtime proof of pinned-key signature verification.`,
        evidence: [
          input.record.integrity.recordDigest,
          ...(signerKeyId ? [`signer:${signerKeyId}`] : []),
        ],
      });
    }

    checks.push({
      id: `reality_integrity:${input.record.id}`,
      plane: "REALITY",
      state: integrityValid ? "PASS" : "FAIL",
      critical: true,
      description: integrityValid
        ? `${input.label}: Reality Record integrity verified.`
        : `${input.label}: Reality Record integrity verification failed.`,
      evidence: [input.record.integrity.recordDigest],
    });

    const divergent =
      input.record.state === "DIVERGENT" ||
      input.record.verification.some((verification) => verification.state === "DIVERGENT") ||
      input.record.replay.state === "DIVERGENT";

    checks.push({
      id: `reality_divergence:${input.record.id}`,
      plane: "REALITY",
      state: divergent ? "FAIL" : "PASS",
      critical: true,
      description: divergent
        ? `${input.label}: divergent runtime/replay evidence is present.`
        : `${input.label}: no divergent evidence is recorded.`,
      evidence: [input.record.integrity.recordDigest],
    });
  }

  return { references, checks };
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function observedNetworkIdentity(
  records: AssuranceRecordInput[],
): Array<{
  networkId?: string;
  shardId?: string;
  epoch?: string | number;
  genesisHash?: string;
  observationId: string;
  genesisObservationId?: string;
}> {
  const identities: Array<{
    networkId?: string;
    shardId?: string;
    epoch?: string | number;
    genesisHash?: string;
    observationId: string;
    genesisObservationId?: string;
  }> = [];

  for (const input of records) {
    if (
      input.sourceClass !== "LIVE_OBSERVATION" ||
      !sourceClassVerified(input) ||
      !verifyRealityRecordIntegrity(input.record) ||
      !isCryptographicallyVerifiedSentinelRecord(input.record)
    ) continue;

    const genesis = input.record.observations.find(
      (observation) =>
        observation.type === "GenesisEvidence" &&
        observation.source === "rchain-sentinel" &&
        observation.data.genesisVerified === true &&
        typeof observation.data.observedHash === "string",
    );
    const genesisHash =
      genesis && typeof genesis.data.observedHash === "string"
        ? genesis.data.observedHash
        : undefined;

    for (const observation of input.record.observations) {
      if (observation.type !== "NetworkStatus") continue;
      const rnode = objectValue(observation.data.rnode);
      if (!rnode) continue;
      const networkId = typeof rnode.network_id === "string" ? rnode.network_id : undefined;
      const shardId = typeof rnode.shard_id === "string" ? rnode.shard_id : undefined;
      const epoch =
        typeof rnode.current_epoch === "string" || typeof rnode.current_epoch === "number"
          ? rnode.current_epoch
          : undefined;
      identities.push({
        ...(networkId ? { networkId } : {}),
        ...(shardId ? { shardId } : {}),
        ...(epoch !== undefined ? { epoch } : {}),
        ...(genesisHash ? { genesisHash } : {}),
        observationId: observation.id,
        ...(genesis ? { genesisObservationId: genesis.id } : {}),
      });
    }
  }
  return identities;
}

function observerAuthorizationCheck(
  records: AssuranceRecordInput[],
  trust: AssuranceObserverTrust,
): AssuranceCheck {
  if (trust.authorizedKeyIds.length === 0) {
    return {
      id: "reality_observer_authorization",
      plane: "REALITY",
      state: "BLOCKED",
      critical: true,
      description: "No authorized Sentinel observer key ids were declared for this certificate scope.",
      evidence: [],
    };
  }

  const verified = records
    .filter(
      (record) =>
        record.sourceClass === "LIVE_OBSERVATION" &&
        isCryptographicallyVerifiedSentinelRecord(record.record),
    )
    .map((record) => ({
      record,
      keyId: observerKeyId(record.record),
    }));

  const missingKeyId = verified.filter((item) => !item.keyId);
  if (missingKeyId.length > 0) {
    return {
      id: "reality_observer_authorization",
      plane: "REALITY",
      state: "FAIL",
      critical: true,
      description: "A cryptographically verified Sentinel record is missing its attested observer key id.",
      evidence: missingKeyId.map((item) => item.record.record.integrity.recordDigest),
    };
  }

  const unauthorized = verified.filter(
    (item) => !trust.authorizedKeyIds.includes(item.keyId!.toLowerCase()),
  );
  if (unauthorized.length > 0) {
    return {
      id: "reality_observer_authorization",
      plane: "REALITY",
      state: "FAIL",
      critical: true,
      description: "One or more cryptographically verified Sentinel records were signed by keys outside the declared authorization set.",
      evidence: unauthorized.map(
        (item) => `${item.record.record.integrity.recordDigest}:key=${item.keyId}`,
      ),
    };
  }

  if (verified.length === 0) {
    return {
      id: "reality_observer_authorization",
      plane: "REALITY",
      state: "BLOCKED",
      critical: true,
      description: "No cryptographically verified Sentinel observation is available to satisfy the declared observer authorization policy.",
      evidence: trust.authorizedKeyIds.map((keyId) => `authorized-key:${keyId}`),
    };
  }

  return {
    id: "reality_observer_authorization",
    plane: "REALITY",
    state: "PASS",
    critical: true,
    description: "All cryptographically verified Sentinel observations use keys inside the declared authorization set.",
    evidence: verified.map(
      (item) => `${item.record.record.integrity.recordDigest}:key=${item.keyId}`,
    ),
    metrics: {
      authorizedKeyCount: trust.authorizedKeyIds.length,
      verifiedObserverCount: verified.length,
    },
  };
}

function failureDomainDeclarationsCheck(
  records: AssuranceRecordInput[],
): AssuranceCheck {
  const candidates = records
    .filter(
      (record) =>
        record.sourceClass === "LIVE_OBSERVATION" &&
        sourceClassVerified(record) &&
        verifyRealityRecordIntegrity(record.record) &&
        isCryptographicallyVerifiedSentinelRecord(record.record),
    )
    .map((record) => {
      const observation = record.record.observations.find(
        (item) => item.type === "FailureDomainDeclarations",
      );
      const verification = record.record.verification.find(
        (item) => item.id === "verify_sentinel_failure_domain_declarations",
      );
      return { record, observation, verification };
    });

  if (candidates.length === 0) {
    return {
      id: "reality_failure_domain_declarations",
      plane: "REALITY",
      state: "BLOCKED",
      critical: true,
      description: "No signed Sentinel live record is available for failure-domain declaration review.",
      evidence: [],
    };
  }

  const valid = candidates.filter(({ observation, verification }) => {
    const data = observation?.data ?? {};
    return (
      verification?.state === "VERIFIED" &&
      data.declarationValidation === true &&
      data.exactCoverage === true &&
      data.targetCountConsistent === true &&
      typeof data.declarationCount === "number" &&
      data.declarationCount >= MIN_CROSS_NODE_TARGETS &&
      typeof data.distinctOperators === "number" &&
      data.distinctOperators >= 2 &&
      typeof data.distinctFailureDomains === "number" &&
      data.distinctFailureDomains >= 2
    );
  });

  if (valid.length === 0) {
    return {
      id: "reality_failure_domain_declarations",
      plane: "REALITY",
      state: "BLOCKED",
      critical: true,
      description: "Signed Sentinel evidence does not document exact target coverage with at least two distinct operators and failure-domain ids.",
      evidence: candidates.map(({ record }) => record.record.integrity.recordDigest),
    };
  }

  const observations = valid.flatMap(({ observation }) => observation ? [observation] : []);
  const operatorCount = Math.max(
    ...observations.map((item) =>
      typeof item.data.distinctOperators === "number" ? item.data.distinctOperators : 0,
    ),
  );
  const providerCount = Math.max(
    ...observations.map((item) =>
      typeof item.data.distinctProviders === "number" ? item.data.distinctProviders : 0,
    ),
  );
  const regionCount = Math.max(
    ...observations.map((item) =>
      typeof item.data.distinctRegions === "number" ? item.data.distinctRegions : 0,
    ),
  );
  const failureDomainCount = Math.max(
    ...observations.map((item) =>
      typeof item.data.distinctFailureDomains === "number" ? item.data.distinctFailureDomains : 0,
    ),
  );

  return {
    id: "reality_failure_domain_declarations",
    plane: "REALITY",
    state: "PASS",
    critical: true,
    description: "Signed Sentinel topology declarations exactly cover the observed target set and document multiple operators/failure domains. This records the declaration; it does not independently prove the metadata.",
    evidence: observations.map((item) => item.id),
    metrics: {
      distinctOperators: operatorCount,
      distinctProviders: providerCount,
      distinctRegions: regionCount,
      distinctFailureDomains: failureDomainCount,
    },
  };
}

function nativeReplayAuthorizationCheck(
  records: AssuranceRecordInput[],
  trust: AssuranceNativeReplayTrust,
): AssuranceCheck {
  const declared = records.filter(
    (record) => record.sourceClass === "NATIVE_REPLAY",
  );
  if (declared.length === 0) {
    return {
      id: "reality_native_replay_authorization",
      plane: "REALITY",
      state: "BLOCKED",
      critical: true,
      description: "No native replay Reality Records are included in the certificate evidence set.",
      evidence: [],
    };
  }

  const verified = declared
    .filter(
      (record) =>
        sourceClassVerified(record) &&
        verifyRealityRecordIntegrity(record.record) &&
        isCryptographicallyVerifiedNativeReplayRecord(record.record),
    )
    .map((record) => ({
      record,
      keyId: nativeReplaySignerKeyId(record.record),
    }));

  if (verified.length === 0) {
    return {
      id: "reality_native_replay_authorization",
      plane: "REALITY",
      state: "BLOCKED",
      critical: true,
      description: "No cryptographically verified native replay record is available for authorization.",
      evidence: declared.map((item) => item.record.integrity.recordDigest),
    };
  }

  const missingKeyId = verified.filter((item) => !item.keyId);
  if (missingKeyId.length > 0) {
    return {
      id: "reality_native_replay_authorization",
      plane: "REALITY",
      state: "FAIL",
      critical: true,
      description: "A cryptographically verified native replay record is missing its signer key id.",
      evidence: missingKeyId.map((item) => item.record.record.integrity.recordDigest),
    };
  }

  if (trust.authorizedKeyIds.length === 0) {
    return {
      id: "reality_native_replay_authorization",
      plane: "REALITY",
      state: "BLOCKED",
      critical: true,
      description: "No authorized native replay signer key ids were declared.",
      evidence: verified.map(
        (item) => `${item.record.record.integrity.recordDigest}:key=${item.keyId}`,
      ),
    };
  }

  const unauthorized = verified.filter(
    (item) => !trust.authorizedKeyIds.includes(item.keyId!.toLowerCase()),
  );
  if (unauthorized.length > 0) {
    return {
      id: "reality_native_replay_authorization",
      plane: "REALITY",
      state: "FAIL",
      critical: true,
      description: "One or more signed native replay records use keys outside the declared authorization set.",
      evidence: unauthorized.map(
        (item) => `${item.record.record.integrity.recordDigest}:key=${item.keyId}`,
      ),
    };
  }

  return {
    id: "reality_native_replay_authorization",
    plane: "REALITY",
    state: "PASS",
    critical: true,
    description: "All cryptographically verified native replay records use authorized signer keys.",
    evidence: verified.map(
      (item) => `${item.record.record.integrity.recordDigest}:key=${item.keyId}`,
    ),
    metrics: {
      verifiedNativeReplayCount: verified.length,
      authorizedNativeReplayKeyCount: trust.authorizedKeyIds.length,
    },
  };
}

function nativeReplayReleaseBindingCheck(
  records: AssuranceRecordInput[],
  release: AssuranceReleaseIdentity,
): AssuranceCheck {
  const signed = records.filter(
    (record) =>
      record.sourceClass === "NATIVE_REPLAY" &&
      sourceClassVerified(record) &&
      verifyRealityRecordIntegrity(record.record) &&
      isCryptographicallyVerifiedNativeReplayRecord(record.record),
  );

  if (signed.length === 0) {
    return {
      id: "reality_native_replay_release_binding",
      plane: "REALITY",
      state: "BLOCKED",
      critical: true,
      description: "No cryptographically verified native replay record is available to bind the declared release identity.",
      evidence: [],
    };
  }

  if (!release.binaryDigest) {
    return {
      id: "reality_native_replay_release_binding",
      plane: "REALITY",
      state: "BLOCKED",
      critical: true,
      description: "Release binary digest is required before native replay evidence can be bound to the release.",
      evidence: signed.map((item) => item.record.integrity.recordDigest),
    };
  }

  const observations = signed.map((item) => ({
    record: item,
    execution: item.record.observations.find(
      (observation) =>
        observation.type === "NativeReplayExecution" &&
        observation.source === "rchain-rust-native-replay",
    ),
  }));

  if (observations.some(({ execution }) => !execution)) {
    return {
      id: "reality_native_replay_release_binding",
      plane: "REALITY",
      state: "BLOCKED",
      critical: true,
      description: "One or more signed native replay records are missing the NativeReplayExecution identity observation.",
      evidence: observations
        .filter(({ execution }) => !execution)
        .map(({ record }) => record.record.integrity.recordDigest),
    };
  }

  const comparisons = observations.map(({ record, execution }) => {
    const data = execution!.data;
    const repository =
      typeof data.repository === "string" ? data.repository.trim().toLowerCase() : null;
    const commit =
      typeof data.commit === "string" ? data.commit.toLowerCase() : null;
    const binaryDigest =
      typeof data.binaryDigest === "string" ? data.binaryDigest.toLowerCase() : null;
    return {
      digest: record.record.integrity.recordDigest,
      repository,
      commit,
      binaryDigest,
      repositoryMatch: repository === release.repository.trim().toLowerCase(),
      commitMatch: commit === release.commit.toLowerCase(),
      binaryMatch: binaryDigest === release.binaryDigest!.toLowerCase(),
    };
  });

  const incomplete = comparisons.filter(
    (item) => !item.repository || !item.commit || !item.binaryDigest,
  );
  if (incomplete.length > 0) {
    return {
      id: "reality_native_replay_release_binding",
      plane: "REALITY",
      state: "BLOCKED",
      critical: true,
      description: "Signed native replay release identity is incomplete.",
      evidence: incomplete.map((item) => item.digest),
    };
  }

  const mismatches = comparisons.filter(
    (item) =>
      !item.repositoryMatch || !item.commitMatch || !item.binaryMatch,
  );
  if (mismatches.length > 0) {
    return {
      id: "reality_native_replay_release_binding",
      plane: "REALITY",
      state: "FAIL",
      critical: true,
      description: "Signed native replay evidence was produced for a different repository, commit, or binary than the declared release.",
      evidence: mismatches.flatMap((item) => [
        `record:${item.digest}`,
        `repository-match:${item.repositoryMatch}`,
        `commit-match:${item.commitMatch}`,
        `binary-match:${item.binaryMatch}`,
      ]),
    };
  }

  return {
    id: "reality_native_replay_release_binding",
    plane: "REALITY",
    state: "PASS",
    critical: true,
    description: "All cryptographically verified native replay records bind to the exact repository, commit, and binary digest declared by the release.",
    evidence: comparisons.map((item) => `record:${item.digest}`),
    metrics: {
      boundNativeReplayRecords: comparisons.length,
    },
  };
}

function nativeReplayRecordDigestSet(
  records: AssuranceRecordInput[],
): ReadonlySet<string> {
  return new Set(
    records
      .filter(
        (record) =>
          record.sourceClass === "NATIVE_REPLAY" &&
          sourceClassVerified(record) &&
          verifyRealityRecordIntegrity(record.record) &&
          isCryptographicallyVerifiedNativeReplayRecord(record.record),
      )
      .map((record) => record.record.integrity.recordDigest),
  );
}

function checkBoundToNativeReplayRecords(
  check: AssuranceCheck,
  records: AssuranceRecordInput[],
): boolean {
  const available = nativeReplayRecordDigestSet(records);
  if (check.plane === "CONFORMANCE") {
    const refs = check.evidence
      .filter((item) => item.startsWith("record:"))
      .map((item) => item.slice("record:".length));
    return refs.length >= 1 && refs.every((digest) => available.has(digest));
  }
  if (check.plane === "RECOVERY") {
    const before = check.evidence
      .filter((item) => item.startsWith("before-record:"))
      .map((item) => item.slice("before-record:".length));
    const after = check.evidence
      .filter((item) => item.startsWith("after-record:"))
      .map((item) => item.slice("after-record:".length));
    return (
      before.length >= 1 &&
      after.length >= 1 &&
      [...before, ...after].every((digest) => available.has(digest))
    );
  }
  return true;
}

function networkIdentityBindingCheck(
  records: AssuranceRecordInput[],
  expected: AssuranceNetworkIdentity,
): AssuranceCheck {
  const observed = observedNetworkIdentity(records);
  const declaredComplete = Boolean(
    expected.genesis &&
    expected.networkId &&
    expected.shardId,
  );
  if (!declaredComplete) {
    return {
      id: "reality_network_identity",
      plane: "REALITY",
      state: "BLOCKED",
      critical: true,
      description: "Network identity binding requires declared genesis, networkId, and shardId.",
      evidence: [],
    };
  }
  if (observed.length === 0) {
    return {
      id: "reality_network_identity",
      plane: "REALITY",
      state: "BLOCKED",
      critical: true,
      description: "No cryptographically verified live NetworkStatus + GenesisEvidence observation is available to bind the declared network identity.",
      evidence: [],
    };
  }

  const comparable = observed.filter(
    (identity) => identity.networkId && identity.shardId && identity.genesisHash,
  );
  if (comparable.length === 0) {
    return {
      id: "reality_network_identity",
      plane: "REALITY",
      state: "BLOCKED",
      critical: true,
      description: "Live Sentinel evidence did not expose verified genesis hash together with network_id and shard_id.",
      evidence: observed.flatMap((identity) => [
        identity.observationId,
        ...(identity.genesisObservationId ? [identity.genesisObservationId] : []),
      ]),
    };
  }

  const mismatches = comparable.filter(
    (identity) =>
      identity.networkId !== expected.networkId ||
      identity.shardId !== expected.shardId ||
      identity.genesisHash!.toLowerCase() !== expected.genesis.toLowerCase() ||
      (expected.epoch !== undefined && identity.epoch !== expected.epoch),
  );
  if (mismatches.length > 0) {
    return {
      id: "reality_network_identity",
      plane: "REALITY",
      state: "FAIL",
      critical: true,
      description: "Declared genesis/network/shard identity conflicts with one or more pinned-key live Sentinel observations.",
      evidence: mismatches.map(
        (identity) =>
          `${identity.observationId}:genesis=${identity.genesisHash ?? "unknown"},network=${identity.networkId ?? "unknown"},shard=${identity.shardId ?? "unknown"},epoch=${identity.epoch ?? "unknown"}`,
      ),
    };
  }

  return {
    id: "reality_network_identity",
    plane: "REALITY",
    state: "PASS",
    critical: true,
    description: "Declared genesis/networkId/shardId are bound to pinned-key live Sentinel evidence; genesis was challenged through the RNode canonical block endpoint at height zero.",
    evidence: comparable.flatMap((identity) => [
      `${identity.observationId}:network=${identity.networkId},shard=${identity.shardId},epoch=${identity.epoch ?? "unknown"}`,
      ...(identity.genesisObservationId
        ? [`${identity.genesisObservationId}:genesis=${identity.genesisHash}`]
        : []),
    ]),
  };
}

function releaseArtifactIdentityCheck(
  release: AssuranceReleaseIdentity,
): AssuranceCheck {
  const commitValid = /^[0-9a-f]{40}$/i.test(release.commit);
  const binaryValid = /^sha256:[0-9a-f]{64}$/i.test(release.binaryDigest ?? "");
  const provenanceValid = /^sha256:[0-9a-f]{64}$/i.test(release.buildProvenance ?? "");
  const complete = commitValid && binaryValid && provenanceValid;

  return {
    id: "supply_chain_release_identity",
    plane: "SUPPLY_CHAIN",
    state: complete ? "PASS" : "BLOCKED",
    critical: true,
    description: complete
      ? "Release source commit, binary SHA-256 identity, and build-provenance statement digest are declared in canonical formats. This does not authenticate the builder or provenance signature."
      : "Release artifact identity is incomplete: a 40-hex commit, sha256 binary digest, and sha256 provenance-statement digest are required.",
    evidence: [
      `commit:${release.commit}`,
      ...(release.binaryDigest ? [`binary:${release.binaryDigest}`] : []),
      ...(release.buildProvenance ? [`provenance:${release.buildProvenance}`] : []),
    ],
    metrics: {
      commitValid,
      binaryValid,
      provenanceValid,
    },
  };
}

function freshnessCheck(
  records: AssuranceRecordInput[],
  issuedAt: string,
  policy: AssuranceFreshnessPolicy,
): AssuranceCheck {
  const issuedAtMs = Date.parse(issuedAt);
  if (!Number.isFinite(issuedAtMs)) {
    throw new Error("assurance certificate issuedAt must be a valid ISO timestamp");
  }
  if (!Number.isFinite(policy.maxObservationAgeMs) || policy.maxObservationAgeMs <= 0) {
    throw new Error("freshness.maxObservationAgeMs must be a positive finite number");
  }

  const candidates = records
    .filter((record) => liveEvidenceQuality(record).valid)
    .flatMap((record) =>
      record.record.observations
        .filter((observation) => observation.timestamp)
        .map((observation) => ({
          id: observation.id,
          timestamp: observation.timestamp!,
          timeMs: Date.parse(observation.timestamp!),
        })),
    )
    .filter((item) => Number.isFinite(item.timeMs));

  if (candidates.length === 0) {
    return {
      id: "reality_freshness",
      plane: "REALITY",
      state: "BLOCKED",
      critical: true,
      description: "No timestamped promotion-grade live observations are available for freshness evaluation.",
      evidence: [],
    };
  }

  const future = candidates.filter((item) => item.timeMs > issuedAtMs);
  if (future.length > 0) {
    return {
      id: "reality_freshness",
      plane: "REALITY",
      state: "FAIL",
      critical: true,
      description: "One or more live observations are timestamped after certificate issuance.",
      evidence: future.map((item) => `${item.id}@${item.timestamp}`),
    };
  }

  const freshest = candidates.reduce((best, item) => item.timeMs > best.timeMs ? item : best);
  const ageMs = issuedAtMs - freshest.timeMs;
  const withinBudget = ageMs <= policy.maxObservationAgeMs;

  return {
    id: "reality_freshness",
    plane: "REALITY",
    state: withinBudget ? "PASS" : "BLOCKED",
    critical: true,
    description: withinBudget
      ? `Freshest live observation age ${ageMs}ms is within the declared ${policy.maxObservationAgeMs}ms budget.`
      : `Freshest live observation age ${ageMs}ms exceeds the declared ${policy.maxObservationAgeMs}ms budget.`,
    evidence: [`${freshest.id}@${freshest.timestamp}`, `age-ms:${ageMs}`],
    metrics: {
      ageMs,
      maxObservationAgeMs: policy.maxObservationAgeMs,
    },
  };
}

function requiredPlaneCheck(
  id: string,
  plane: AssurancePlane,
  required: boolean,
  present: boolean,
  description: string,
): AssuranceCheck {
  if (!required) {
    return {
      id,
      plane,
      state: present ? "PASS" : "NOT_TESTED",
      critical: false,
      description,
      evidence: [],
    };
  }
  return {
    id,
    plane,
    state: present ? "PASS" : "BLOCKED",
    critical: true,
    description,
    evidence: [],
  };
}

function summarize(checks: AssuranceCheck[]): AssuranceCertificate["summary"] {
  return {
    pass: checks.filter((check) => check.state === "PASS").length,
    fail: checks.filter((check) => check.state === "FAIL").length,
    blocked: checks.filter((check) => check.state === "BLOCKED").length,
    notTested: checks.filter((check) => check.state === "NOT_TESTED").length,
  };
}

function deriveStatus(checks: AssuranceCheck[]): AssuranceGateState {
  const critical = checks.filter((check) => check.critical);
  if (critical.some((check) => check.state === "FAIL")) return "FAIL";
  if (critical.some((check) => check.state === "BLOCKED" || check.state === "NOT_TESTED")) return "BLOCKED";
  return "PASS";
}

export function buildAssuranceCertificate(input: AssuranceFabricInput): AssuranceCertificate {
  if (!input.release.repository || !input.release.commit) {
    throw new Error("assurance certificate requires repository and commit identity");
  }
  if (!input.network.genesis) {
    throw new Error("assurance certificate requires network genesis identity");
  }
  if (!input.issuedAt) {
    throw new Error("assurance certificate requires an explicit issuedAt timestamp");
  }
  if (!input.freshness) {
    throw new Error("assurance certificate requires an explicit freshness policy");
  }

  if (
    input.requirements &&
    Object.entries(DEFAULT_REQUIREMENTS).some(
      ([key, required]) =>
        required &&
        input.requirements?.[key as keyof AssuranceRequirements] === false,
    )
  ) {
    throw new Error("rchain-revival-strict/v1 requirements cannot be weakened");
  }

  const requirements = { ...DEFAULT_REQUIREMENTS, ...input.requirements };
  const observerTrust = normalizedObserverTrust(input.observerTrust);
  const builderTrust = normalizedBuilderTrust(input.builderTrust);
  const nativeReplayTrust = normalizedNativeReplayTrust(input.nativeReplayTrust);
  const reality = realityChecks(input.records);
  const releaseIdentity = releaseArtifactIdentityCheck(input.release);
  const buildProvenance = buildProvenanceVerificationCheck(
    input.release,
    input.buildProvenance,
    builderTrust,
  );
  const buildProvenanceRef = buildProvenanceReference(input.buildProvenance);
  const observerAuthorization = observerAuthorizationCheck(input.records, observerTrust);
  const failureDomains = failureDomainDeclarationsCheck(input.records);
  const nativeReplayAuthorization = nativeReplayAuthorizationCheck(
    input.records,
    nativeReplayTrust,
  );
  const nativeReplayReleaseBinding = nativeReplayReleaseBindingCheck(
    input.records,
    input.release,
  );
  const networkIdentity = networkIdentityBindingCheck(input.records, input.network);
  const freshness = freshnessCheck(input.records, input.issuedAt, input.freshness);
  const suppliedChecks: AssuranceCheck[] = input.checks.map((check) => {
    const producerVerified = isTrustedCheck(check);
    const requestedState = check.state;
    return {
      ...check,
      state: !producerVerified && requestedState === "PASS" ? "BLOCKED" : requestedState,
      critical: check.critical ?? true,
      evidence: check.evidence ?? [],
      producer: check.producer ?? "external/unverified",
      producerVerified,
    };
  });

  const hasLiveObservation = input.records.some((record) => {
    if (
      record.sourceClass !== "LIVE_OBSERVATION" ||
      !sourceClassVerified(record) ||
      !verifyRealityRecordIntegrity(record.record)
    ) return false;
    return liveEvidenceQuality(record).valid;
  });
  const hasObserverSignature = input.records.some(
    (record) =>
      record.sourceClass === "LIVE_OBSERVATION" &&
      sourceClassVerified(record) &&
      verifyRealityRecordIntegrity(record.record) &&
      isCryptographicallyVerifiedSentinelRecord(record.record),
  );
  const hasNativeReplaySignature = input.records.some(
    (record) =>
      record.sourceClass === "NATIVE_REPLAY" &&
      sourceClassVerified(record) &&
      verifyRealityRecordIntegrity(record.record) &&
      isCryptographicallyVerifiedNativeReplayRecord(record.record),
  );
  const hasPossibility = suppliedChecks.some(
    (check) =>
      check.plane === "POSSIBILITY" &&
      check.critical &&
      check.producerVerified &&
      check.state === "PASS",
  );
  const hasConformance = suppliedChecks.some(
    (check) =>
      check.plane === "CONFORMANCE" &&
      check.critical &&
      check.producerVerified &&
      check.state === "PASS" &&
      checkBoundToNativeReplayRecords(check, input.records),
  );
  const hasRecovery = suppliedChecks.some(
    (check) =>
      check.plane === "RECOVERY" &&
      check.critical &&
      check.producerVerified &&
      check.state === "PASS" &&
      checkBoundToNativeReplayRecords(check, input.records),
  );

  const gates: AssuranceCheck[] = [
    requiredPlaneCheck(
      "gate_release_artifact_identity",
      "SUPPLY_CHAIN",
      requirements.requireReleaseArtifactIdentity,
      releaseIdentity.state === "PASS",
      releaseIdentity.description,
    ),
    requiredPlaneCheck(
      "gate_build_provenance",
      "SUPPLY_CHAIN",
      requirements.requireBuildProvenanceVerification &&
        requirements.requireBuilderAuthorization,
      buildProvenance.state === "PASS",
      buildProvenance.description,
    ),
    requiredPlaneCheck(
      "gate_native_replay_signature",
      "REALITY",
      requirements.requireNativeReplaySignature,
      hasNativeReplaySignature,
      hasNativeReplaySignature
        ? "At least one certificate-bound native replay record has runtime proof of pinned-key Ed25519 verification."
        : "No certificate-bound native replay record has runtime proof of pinned-key Ed25519 verification.",
    ),
    requiredPlaneCheck(
      "gate_native_replay_authorization",
      "REALITY",
      requirements.requireNativeReplayAuthorization,
      nativeReplayAuthorization.state === "PASS",
      nativeReplayAuthorization.description,
    ),
    requiredPlaneCheck(
      "gate_native_replay_release_binding",
      "REALITY",
      requirements.requireNativeReplayReleaseBinding,
      nativeReplayReleaseBinding.state === "PASS",
      nativeReplayReleaseBinding.description,
    ),
    requiredPlaneCheck(
      "gate_live_observation",
      "REALITY",
      requirements.requireLiveObservation,
      hasLiveObservation,
      hasLiveObservation
        ? "At least one integrity-valid, non-divergent live observation is present."
        : "No integrity-valid, non-divergent live observation is present. Synthetic evidence cannot satisfy this gate.",
    ),
    requiredPlaneCheck(
      "gate_failure_domain_declarations",
      "REALITY",
      requirements.requireFailureDomainDeclarations,
      failureDomains.state === "PASS",
      failureDomains.description,
    ),
    requiredPlaneCheck(
      "gate_observer_signature",
      "REALITY",
      requirements.requireObserverSignature,
      hasObserverSignature,
      hasObserverSignature
        ? "At least one live Sentinel Reality Record was cryptographically verified against a pinned Ed25519 observer key."
        : "No live Sentinel Reality Record has runtime proof of pinned-key Ed25519 verification.",
    ),
    requiredPlaneCheck(
      "gate_observer_authorization",
      "REALITY",
      requirements.requireObserverAuthorization,
      observerAuthorization.state === "PASS",
      observerAuthorization.description,
    ),
    requiredPlaneCheck(
      "gate_network_identity",
      "REALITY",
      requirements.requireNetworkIdentityBinding,
      networkIdentity.state === "PASS",
      networkIdentity.description,
    ),
    requiredPlaneCheck(
      "gate_freshness",
      "REALITY",
      requirements.requireFreshness,
      freshness.state === "PASS",
      freshness.description,
    ),
    requiredPlaneCheck(
      "gate_possibility",
      "POSSIBILITY",
      requirements.requirePossibility,
      hasPossibility,
      hasPossibility ? "Possibility analysis is present." : "Possibility analysis is missing.",
    ),
    requiredPlaneCheck(
      "gate_conformance",
      "CONFORMANCE",
      requirements.requireConformance,
      hasConformance,
      hasConformance
        ? "Critical conformance PASS is backed by a pinned signed native replay bound to the declared release."
        : "Conformance requires a critical PASS plus a pinned signed native replay bound to the declared repository, commit, and binary.",
    ),
    requiredPlaneCheck(
      "gate_recovery",
      "RECOVERY",
      requirements.requireRecovery,
      hasRecovery,
      hasRecovery
        ? "Critical recovery PASS is backed by signed native replay evidence with an independent process/disk and previous-record linkage."
        : "Recovery requires a critical PASS plus signed native replay recovery evidence bound to a previous Reality Record.",
    ),
  ];

  const checks = [releaseIdentity, buildProvenance, ...reality.checks, observerAuthorization, failureDomains, nativeReplayAuthorization, nativeReplayReleaseBinding, networkIdentity, freshness, ...suppliedChecks, ...gates];
  const status = deriveStatus(checks);
  const summary = summarize(checks);
  const policy = {
    id: STRICT_POLICY_ID,
    digest: strictPolicyDigest(),
  };
  const id = `assurance:${digest([
    input.release.repository,
    input.release.commit,
    input.network.genesis,
    input.network.networkId ?? "",
    input.network.shardId ?? "",
    input.issuedAt,
    JSON.stringify(input.freshness),
    ...observerTrust.authorizedKeyIds,
    ...builderTrust.authorizedKeyIds,
    ...builderTrust.authorizedBuilderIds,
    ...nativeReplayTrust.authorizedKeyIds,
    input.buildProvenance?.payloadDigest ?? "",
    ...reality.references.map((record) => record.digest).sort(),
    policy.digest,
  ]).slice(0, 32)}`;
  const limitations = [...MANDATORY_LIMITATIONS];

  const payload: Omit<AssuranceCertificate, "integrity"> = {
    schema: "rchain-assurance-certificate/v1",
    id,
    issuedAt: input.issuedAt,
    policy,
    freshness: input.freshness,
    observerTrust,
    builderTrust,
    nativeReplayTrust,
    ...(buildProvenanceRef ? { buildProvenance: buildProvenanceRef } : {}),
    release: input.release,
    network: input.network,
    requirements,
    limitations,
    records: reality.references,
    checks,
    status,
    summary,
  };

  return {
    ...payload,
    integrity: {
      algorithm: "SHA-256",
      certificateDigest: digest([canonicalCertificatePayload(payload)]),
    },
  };
}

export function verifyAssuranceCertificateIntegrity(certificate: AssuranceCertificate): boolean {
  const { integrity: _integrity, ...payload } = certificate;
  return digest([canonicalCertificatePayload(payload)]) === certificate.integrity.certificateDigest;
}

export function verifyAssuranceCertificatePolicy(certificate: AssuranceCertificate): boolean {
  if (certificate.policy.id !== STRICT_POLICY_ID) return false;
  if (certificate.policy.digest !== strictPolicyDigest()) return false;
  const requirementsValid = (Object.keys(DEFAULT_REQUIREMENTS) as Array<keyof AssuranceRequirements>).every(
    (key) => DEFAULT_REQUIREMENTS[key] !== true || certificate.requirements[key] === true,
  );
  const limitationsValid = MANDATORY_LIMITATIONS.every(
    (limitation) => certificate.limitations.includes(limitation),
  );
  return requirementsValid && limitationsValid;
}

export function validateAssuranceCertificate(certificate: AssuranceCertificate): {
  valid: boolean;
  integrity: boolean;
  policy: boolean;
} {
  const integrity = verifyAssuranceCertificateIntegrity(certificate);
  const policy = verifyAssuranceCertificatePolicy(certificate);
  return {
    valid: integrity && policy,
    integrity,
    policy,
  };
}

export function possibilityCheckFromSearch(args: {
  id: string;
  description: string;
  result: WeightedPossibilityResult;
  expected: "REACHABLE" | "UNREACHABLE";
  critical?: boolean;
}): AssuranceCheckInput {
  const { result } = args;
  const matched = result.status === args.expected;
  const limited = result.status === "LIMIT_REACHED";

  return trustedCheck({
    id: args.id,
    plane: "POSSIBILITY",
    state: limited ? "BLOCKED" : matched ? "PASS" : "FAIL",
    critical: args.critical ?? true,
    description: args.description,
    evidence: result.witness.map(
      (step) => `${step.from} --${step.label}/${step.cost}--> ${step.to}`,
    ),
    metrics: {
      exploredStates: result.exploredStates,
      frontierPeak: result.frontierPeak,
      minimumCost: result.minimumCost,
      expected: args.expected,
      observed: result.status,
    },
  }, "weighted-possibility-search/v1");
}


export function possibilityChecksFromFragilityReport(
  report: FragilityReport,
): AssuranceCheckInput[] {
  return report.invariants.map((invariant) => {
    const counterexamples = report.counterexamples.filter(
      (counterexample) => counterexample.invariant === invariant.invariant,
    );
    return trustedCheck({
      id: `cbc_fragility:${invariant.invariant}`,
      plane: "POSSIBILITY",
      state: invariant.satisfied ? "PASS" : "FAIL",
      critical: true,
      description: invariant.observation,
      evidence: counterexamples.flatMap((counterexample) => [
        `replay:${counterexample.replayDigest}`,
        `transition:${counterexample.transition}`,
        ...counterexample.conflictCore.map((item) => `conflict:${item}`),
      ]),
      metrics: {
        reportDigest: report.digest,
        counterexamples: counterexamples.length,
      },
    }, "cbc-fragility-adapter/v1");
  });
}

export function conformanceCheckFromRealityRecord(args: {
  id: string;
  description: string;
  record: RealityRecord;
  critical?: boolean;
}): AssuranceCheckInput {
  const record = args.record;
  const sourceValid = record.source === "rchain-rust-native-replay";
  const integrityValid = verifyRealityRecordIntegrity(record);
  const signatureVerified = isCryptographicallyVerifiedNativeReplayRecord(record);
  const signerKeyId = nativeReplaySignerKeyId(record);
  const complete =
    record.replay.available &&
    Boolean(record.replay.expectedDigest) &&
    Boolean(record.replay.observedDigest);
  const match =
    complete &&
    record.replay.expectedDigest === record.replay.observedDigest &&
    record.replay.state === "REPRODUCED";
  const state: AssuranceGateState =
    complete && !match
      ? "FAIL"
      : !sourceValid || !integrityValid || !signatureVerified || !signerKeyId || !complete
        ? "BLOCKED"
        : "PASS";

  return trustedCheck({
    id: args.id,
    plane: "CONFORMANCE",
    state,
    critical: args.critical ?? true,
    description: args.description,
    evidence: [
      `record:${record.integrity.recordDigest}`,
      `source:${record.source}`,
      `signature-verified:${signatureVerified}`,
      ...(signerKeyId ? [`signer:${signerKeyId}`] : []),
      ...(record.replay.expectedDigest ? [`expected:${record.replay.expectedDigest}`] : []),
      ...(record.replay.observedDigest ? [`observed:${record.replay.observedDigest}`] : []),
    ],
    metrics: {
      sourceValid,
      integrityValid,
      signatureVerified,
      signerKeyId: signerKeyId ?? "",
      complete,
      match,
    },
  }, "reality-record-conformance/v1");
}

export function recoveryCheckFromRecordChain(args: {
  id: string;
  description: string;
  before: RealityRecord;
  after: RealityRecord;
  critical?: boolean;
}): AssuranceCheckInput {
  const before = args.before;
  const after = args.after;
  const sourceValid =
    before.source === "rchain-rust-native-replay" &&
    after.source === "rchain-rust-native-replay";
  const beforeSignatureVerified =
    isCryptographicallyVerifiedNativeReplayRecord(before);
  const afterSignatureVerified =
    isCryptographicallyVerifiedNativeReplayRecord(after);
  const beforeSignerKeyId = nativeReplaySignerKeyId(before);
  const afterSignerKeyId = nativeReplaySignerKeyId(after);
  const signaturesVerified =
    beforeSignatureVerified &&
    afterSignatureVerified &&
    Boolean(beforeSignerKeyId) &&
    Boolean(afterSignerKeyId);
  const integrityValid =
    verifyRealityRecordIntegrity(before) &&
    verifyRealityRecordIntegrity(after);
  const chainLinked = after.integrity.previousDigest === before.integrity.recordDigest;
  const subjectStable = before.subject.id === after.subject.id;

  const beforeDigest = before.replay.observedDigest;
  const recoveredDigest = after.replay.observedDigest;
  const stateComplete = Boolean(beforeDigest && recoveredDigest);
  const stateMatch = stateComplete && beforeDigest === recoveredDigest;

  const recoveryObservation = after.observations.find(
    (observation) =>
      observation.type === "RecoveryContext" &&
      observation.source === "rchain-rust-native-replay",
  );
  const recoveryData = recoveryObservation?.data ?? {};
  const preProcessId =
    typeof recoveryData.preProcessId === "string" ? recoveryData.preProcessId : null;
  const recoveredProcessId =
    typeof recoveryData.recoveredProcessId === "string" ? recoveryData.recoveredProcessId : null;
  const preDiskId =
    typeof recoveryData.preDiskId === "string" ? recoveryData.preDiskId : null;
  const recoveredDiskId =
    typeof recoveryData.recoveredDiskId === "string" ? recoveryData.recoveredDiskId : null;
  const checkpointTrusted = recoveryData.checkpointTrusted === true;
  const independentProcess =
    Boolean(preProcessId && recoveredProcessId) && preProcessId !== recoveredProcessId;
  const independentDisk =
    Boolean(preDiskId && recoveredDiskId) && preDiskId !== recoveredDiskId;
  const methodologyComplete =
    Boolean(recoveryObservation) &&
    independentProcess &&
    independentDisk &&
    checkpointTrusted;

  const complete =
    sourceValid &&
    integrityValid &&
    signaturesVerified &&
    chainLinked &&
    subjectStable &&
    stateComplete &&
    methodologyComplete;
  const state: AssuranceGateState =
    stateComplete && !stateMatch
      ? "FAIL"
      : !complete
        ? "BLOCKED"
        : "PASS";

  return trustedCheck({
    id: args.id,
    plane: "RECOVERY",
    state,
    critical: args.critical ?? true,
    description: args.description,
    evidence: [
      `before-record:${before.integrity.recordDigest}`,
      `after-record:${after.integrity.recordDigest}`,
      `chain-linked:${chainLinked}`,
      `subject-stable:${subjectStable}`,
      `before-signature-verified:${beforeSignatureVerified}`,
      `after-signature-verified:${afterSignatureVerified}`,
      ...(beforeSignerKeyId ? [`before-signer:${beforeSignerKeyId}`] : []),
      ...(afterSignerKeyId ? [`after-signer:${afterSignerKeyId}`] : []),
      ...(beforeDigest ? [`pre-recovery:${beforeDigest}`] : []),
      ...(recoveredDigest ? [`recovered:${recoveredDigest}`] : []),
      `independent-process:${independentProcess}`,
      `independent-disk:${independentDisk}`,
      `checkpoint-trusted:${checkpointTrusted}`,
    ],
    metrics: {
      sourceValid,
      integrityValid,
      signaturesVerified,
      beforeSignerKeyId: beforeSignerKeyId ?? "",
      afterSignerKeyId: afterSignerKeyId ?? "",
      chainLinked,
      subjectStable,
      stateComplete,
      stateMatch,
      methodologyComplete,
      independentProcess,
      independentDisk,
      checkpointTrusted,
    },
  }, "reality-record-recovery/v1");
}

/**
 * Diagnostic helper only. Free-form digest inputs are intentionally not a
 * strict-policy trusted producer; use conformanceCheckFromRealityRecord() for
 * promotion-grade conformance evidence.
 */
export function conformanceCheckFromDigests(args: {
  id: string;
  description: string;
  expectedDigest?: string | null;
  observedDigest?: string | null;
  critical?: boolean;
}): AssuranceCheckInput {
  const complete = Boolean(args.expectedDigest && args.observedDigest);
  const match = complete && args.expectedDigest === args.observedDigest;
  return trustedCheck({
    id: args.id,
    plane: "CONFORMANCE",
    state: !complete ? "BLOCKED" : match ? "PASS" : "FAIL",
    critical: args.critical ?? true,
    description: args.description,
    evidence: [
      ...(args.expectedDigest ? [`expected:${args.expectedDigest}`] : []),
      ...(args.observedDigest ? [`observed:${args.observedDigest}`] : []),
    ],
    metrics: {
      match,
      complete,
    },
  }, "digest-conformance/v1");
}

/**
 * Diagnostic helper only. Free-form digest inputs are intentionally not a
 * strict-policy trusted producer; use recoveryCheckFromRecordChain() for
 * promotion-grade recovery evidence.
 */
export function recoveryCheckFromDigests(args: {
  id: string;
  description: string;
  preRecoveryDigest?: string | null;
  recoveredDigest?: string | null;
  independentProcess?: boolean;
  independentDisk?: boolean;
  checkpointTrusted?: boolean;
  critical?: boolean;
}): AssuranceCheckInput {
  const complete = Boolean(args.preRecoveryDigest && args.recoveredDigest);
  const methodologyComplete =
    args.independentProcess === true &&
    args.independentDisk === true &&
    args.checkpointTrusted === true;
  const match = complete && args.preRecoveryDigest === args.recoveredDigest;
  return trustedCheck({
    id: args.id,
    plane: "RECOVERY",
    state: !complete || !methodologyComplete ? "BLOCKED" : match ? "PASS" : "FAIL",
    critical: args.critical ?? true,
    description: args.description,
    evidence: [
      ...(args.preRecoveryDigest ? [`pre-recovery:${args.preRecoveryDigest}`] : []),
      ...(args.recoveredDigest ? [`recovered:${args.recoveredDigest}`] : []),
      `independent-process:${args.independentProcess === true}`,
      `independent-disk:${args.independentDisk === true}`,
      `checkpoint-trusted:${args.checkpointTrusted === true}`,
    ],
    metrics: {
      match,
      complete,
      methodologyComplete,
      independentProcess: args.independentProcess === true,
      independentDisk: args.independentDisk === true,
      checkpointTrusted: args.checkpointTrusted === true,
    },
  }, "digest-recovery/v1");
}
