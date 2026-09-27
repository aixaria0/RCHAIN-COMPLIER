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
}

export interface AssuranceRequirements {
  requireLiveObservation: boolean;
  requirePossibility: boolean;
  requireConformance: boolean;
  requireRecovery: boolean;
}

export interface AssuranceFabricInput {
  issuedAt: string;
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
  requirePossibility: true,
  requireConformance: true,
  requireRecovery: true,
};

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

  const requirements = { ...DEFAULT_REQUIREMENTS, ...input.requirements };
  const reality = realityChecks(input.records);
  const suppliedChecks: AssuranceCheck[] = input.checks.map((check) => ({
    ...check,
    critical: check.critical ?? true,
    evidence: check.evidence ?? [],
  }));

  const hasLiveObservation = reality.references.some(
    (record) =>
      record.sourceClass === "LIVE_OBSERVATION" &&
      record.sourceClassVerified &&
      record.integrityValid &&
      record.state !== "DIVERGENT",
  );
  const hasPossibility = suppliedChecks.some(
    (check) => check.plane === "POSSIBILITY" && check.critical && check.state === "PASS",
  );
  const hasConformance = suppliedChecks.some(
    (check) => check.plane === "CONFORMANCE" && check.critical && check.state === "PASS",
  );
  const hasRecovery = suppliedChecks.some(
    (check) => check.plane === "RECOVERY" && check.critical && check.state === "PASS",
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

  const checks = [...reality.checks, ...suppliedChecks, ...gates];
  const status = deriveStatus(checks);
  const summary = summarize(checks);
  const id = `assurance:${digest([
    input.release.repository,
    input.release.commit,
    input.network.genesis,
  ]).slice(0, 20)}`;

  const payload: Omit<AssuranceCertificate, "integrity"> = {
    schema: "rchain-assurance-certificate/v1",
    id,
    issuedAt: input.issuedAt,
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

  return {
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
  };
}


export function possibilityChecksFromFragilityReport(
  report: FragilityReport,
): AssuranceCheckInput[] {
  return report.invariants.map((invariant) => {
    const counterexamples = report.counterexamples.filter(
      (counterexample) => counterexample.invariant === invariant.invariant,
    );
    return {
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
    };
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
  return {
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
  };
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
  return {
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
  };
}
