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
import type { FragilityReport } from "../cbc/fragility-engine.ts";

export type AssurancePlane = "POSSIBILITY" | "REALITY" | "CONFORMANCE" | "RECOVERY";
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
  requireLiveObservation: boolean;
  requireNetworkIdentityBinding: boolean;
  requireFreshness: boolean;
  requirePossibility: boolean;
  requireConformance: boolean;
  requireRecovery: boolean;
}

export interface AssuranceFreshnessPolicy {
  maxObservationAgeMs: number;
}

export interface AssuranceFabricInput {
  issuedAt: string;
  freshness: AssuranceFreshnessPolicy;
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
  release: AssuranceReleaseIdentity;
  network: AssuranceNetworkIdentity;
  requirements: AssuranceRequirements;
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
  requireLiveObservation: true,
  requireNetworkIdentityBinding: true,
  requireFreshness: true,
  requirePossibility: true,
  requireConformance: true,
  requireRecovery: true,
};

const STRICT_POLICY_ID = "rchain-revival-strict/v1" as const;
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
  return (input as Partial<TrustedAssuranceCheckInput>)[TRUSTED_CHECK_ATTESTATION] === true;
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
    release: certificate.release,
    network: certificate.network,
    requirements: certificate.requirements,
    records: certificate.records,
    checks: certificate.checks,
    status: certificate.status,
    summary: certificate.summary,
  }));
}

const TRUSTED_LIVE_RECORD_SOURCES = new Set(["rchain-sentinel"]);

function sourceClassVerified(input: AssuranceRecordInput): boolean {
  if (input.sourceClass === "LIVE_OBSERVATION") {
    return TRUSTED_LIVE_RECORD_SOURCES.has(input.record.source);
  }
  if (input.record.source === "rchain-reality-compiler") {
    return input.sourceClass === "SYNTHETIC";
  }
  return true;
}

function liveEvidenceQuality(input: AssuranceRecordInput): {
  valid: boolean;
  description: string;
  evidence: string[];
} {
  if (input.sourceClass !== "LIVE_OBSERVATION" || input.record.source !== "rchain-sentinel") {
    return {
      valid: false,
      description: "Record is not a trusted rchain-sentinel live observation.",
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
  const blockData = block?.data ?? {};
  const networkData = network?.data ?? {};

  const blockEvidenceComplete =
    blockData.available === true &&
    blockData.fullBlockAvailable === true &&
    blockData.finalityHashMatch === true &&
    blockData.canonicalConsistency === true &&
    blockData.nodeReportedFinalized === true;
  const networkReachable = networkData.reachable === true;

  const valid =
    verifyRealityRecordIntegrity(input.record) &&
    missingOrUnverified.length === 0 &&
    blockEvidenceComplete &&
    networkReachable;

  const evidence = [
    ...(block ? [block.id] : []),
    ...(network ? [network.id] : []),
    ...requiredVerificationIds.map(
      (id) => `${id}:${verificationById.get(id)?.state ?? "MISSING"}`,
    ),
  ];

  return {
    valid,
    description: valid
      ? "Live Sentinel evidence is integrity-valid, network-reachable, canonically consistent, and node-finalized with a matching full-block identity."
      : `Live Sentinel evidence is incomplete: missing/unverified=[${missingOrUnverified.join(",")}], blockComplete=${blockEvidenceComplete}, networkReachable=${networkReachable}.`,
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
): Array<{ networkId?: string; shardId?: string; epoch?: string | number; observationId: string }> {
  const identities: Array<{ networkId?: string; shardId?: string; epoch?: string | number; observationId: string }> = [];
  for (const input of records) {
    if (
      input.sourceClass !== "LIVE_OBSERVATION" ||
      !sourceClassVerified(input) ||
      !verifyRealityRecordIntegrity(input.record)
    ) continue;

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
        observationId: observation.id,
      });
    }
  }
  return identities;
}

function networkIdentityBindingCheck(
  records: AssuranceRecordInput[],
  expected: AssuranceNetworkIdentity,
): AssuranceCheck {
  const observed = observedNetworkIdentity(records);
  const declaredComplete = Boolean(expected.networkId && expected.shardId);
  if (!declaredComplete) {
    return {
      id: "reality_network_identity",
      plane: "REALITY",
      state: "BLOCKED",
      critical: true,
      description: "Network identity binding requires declared networkId and shardId in addition to genesis.",
      evidence: [],
    };
  }
  if (observed.length === 0) {
    return {
      id: "reality_network_identity",
      plane: "REALITY",
      state: "BLOCKED",
      critical: true,
      description: "No integrity-valid live NetworkStatus observation is available to bind the declared network identity.",
      evidence: [],
    };
  }

  const comparable = observed.filter((identity) => identity.networkId && identity.shardId);
  if (comparable.length === 0) {
    return {
      id: "reality_network_identity",
      plane: "REALITY",
      state: "BLOCKED",
      critical: true,
      description: "Live NetworkStatus observations did not expose both network_id and shard_id.",
      evidence: observed.map((identity) => identity.observationId),
    };
  }

  const mismatches = comparable.filter((identity) =>
    identity.networkId !== expected.networkId ||
    identity.shardId !== expected.shardId ||
    (expected.epoch !== undefined && identity.epoch !== expected.epoch)
  );
  if (mismatches.length > 0) {
    return {
      id: "reality_network_identity",
      plane: "REALITY",
      state: "FAIL",
      critical: true,
      description: "Declared network identity conflicts with one or more live Sentinel observations.",
      evidence: mismatches.map((identity) =>
        `${identity.observationId}:network=${identity.networkId ?? "unknown"},shard=${identity.shardId ?? "unknown"},epoch=${identity.epoch ?? "unknown"}`
      ),
    };
  }

  return {
    id: "reality_network_identity",
    plane: "REALITY",
    state: "PASS",
    critical: true,
    description: "Declared networkId/shardId are bound to integrity-valid live Sentinel NetworkStatus observations.",
    evidence: comparable.map((identity) =>
      `${identity.observationId}:network=${identity.networkId},shard=${identity.shardId},epoch=${identity.epoch ?? "unknown"}`
    ),
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
  const reality = realityChecks(input.records);
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
      check.state === "PASS",
  );
  const hasRecovery = suppliedChecks.some(
    (check) =>
      check.plane === "RECOVERY" &&
      check.critical &&
      check.producerVerified &&
      check.state === "PASS",
  );

  const gates: AssuranceCheck[] = [
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
      hasConformance ? "Conformance evidence is present." : "Conformance evidence is missing.",
    ),
    requiredPlaneCheck(
      "gate_recovery",
      "RECOVERY",
      requirements.requireRecovery,
      hasRecovery,
      hasRecovery ? "Recovery evidence is present." : "Recovery evidence is missing.",
    ),
  ];

  const checks = [...reality.checks, networkIdentity, freshness, ...suppliedChecks, ...gates];
  const status = deriveStatus(checks);
  const summary = summarize(checks);
  const id = `assurance:${digest([
    input.release.repository,
    input.release.commit,
    input.network.genesis,
  ]).slice(0, 20)}`;

  const policy = {
    id: STRICT_POLICY_ID,
    digest: digest([JSON.stringify(DEFAULT_REQUIREMENTS)]),
  };
  const payload: Omit<AssuranceCertificate, "integrity"> = {
    schema: "rchain-assurance-certificate/v1",
    id,
    issuedAt: input.issuedAt,
    policy,
    freshness: input.freshness,
    release: input.release,
    network: input.network,
    requirements,
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
