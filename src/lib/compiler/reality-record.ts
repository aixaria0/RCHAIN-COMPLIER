/**
 * Portable, provider-neutral evidence record.
 *
 * A RealityRecord describes a claim without granting trust to the source that
 * produced it. Verification status is derived from recorded observations and
 * deterministic predicates rather than asserted by an upstream adapter.
 */

import { digest } from "./hash.ts";

export type RealityState =
  | "OBSERVED"
  | "CONSISTENT"
  | "REPRODUCED"
  | "VERIFIED"
  | "DIVERGENT"
  | "INCOMPLETE";

export interface RealitySubject {
  id: string;
  kind: string;
  label?: string;
}

export interface RealityObservation {
  id: string;
  source: string;
  type: string;
  timestamp?: string;
  data: Record<string, unknown>;
}

export interface RealityClaim {
  id: string;
  statement: string;
  basis: string[];
}

export interface RealityEvidence {
  id: string;
  observationIds: string[];
  hash?: string;
  description: string;
}

export interface RealityDependency {
  from: string;
  to: string;
  relation: string;
}

export interface RealityTransformation {
  id: string;
  name: string;
  inputIds: string[];
  outputIds: string[];
  deterministic: boolean;
}

export interface RealityVerification {
  id: string;
  predicate: string;
  state: RealityState;
  message: string;
  evidenceIds: string[];
}

export interface RealityReplay {
  available: boolean;
  inputIds: string[];
  expectedDigest?: string;
  observedDigest?: string;
  state: Extract<RealityState, "REPRODUCED" | "DIVERGENT" | "INCOMPLETE">;
}

export interface RealityIntegrity {
  recordDigest: string;
  previousDigest?: string;
  algorithm: "SHA-256";
}

export interface RealityRecord {
  schema: "rchain-reality-record/v1";
  id: string;
  subject: RealitySubject;
  source: string;
  observations: RealityObservation[];
  claims: RealityClaim[];
  evidence: RealityEvidence[];
  dependencies: RealityDependency[];
  transformations: RealityTransformation[];
  verification: RealityVerification[];
  replay: RealityReplay;
  state: RealityState;
  integrity: RealityIntegrity;
}

function canonicalPayload(record: Omit<RealityRecord, "integrity">): string {
  return JSON.stringify({
    schema: record.schema,
    id: record.id,
    subject: record.subject,
    source: record.source,
    observations: record.observations,
    claims: record.claims,
    evidence: record.evidence,
    dependencies: record.dependencies,
    transformations: record.transformations,
    verification: record.verification,
    replay: record.replay,
    state: record.state,
  });
}

export function deriveRealityState(record: Omit<RealityRecord, "integrity" | "state">): RealityState {
  if (record.verification.some((check) => check.state === "DIVERGENT") || record.replay.state === "DIVERGENT") {
    return "DIVERGENT";
  }
  if (record.verification.some((check) => check.state === "INCOMPLETE") || record.replay.state === "INCOMPLETE") {
    return "INCOMPLETE";
  }
  if (record.verification.length === 0) return "OBSERVED";
  if (record.replay.available && record.replay.state === "REPRODUCED") return "REPRODUCED";
  if (record.verification.every((check) => check.state === "VERIFIED")) return "VERIFIED";
  if (record.verification.every((check) => check.state === "CONSISTENT" || check.state === "VERIFIED")) {
    return "CONSISTENT";
  }
  return "OBSERVED";
}

export function sealRealityRecord(
  input: Omit<RealityRecord, "integrity" | "state"> & { state?: RealityState },
  previousDigest?: string,
): RealityRecord {
  const state = input.state ?? deriveRealityState(input);
  const payload = { ...input, state };
  const recordDigest = digest([canonicalPayload(payload)]);

  return {
    ...payload,
    state,
    integrity: {
      recordDigest,
      ...(previousDigest ? { previousDigest } : {}),
      algorithm: "SHA-256",
    },
  };
}

export function verifyRealityRecordIntegrity(record: RealityRecord): boolean {
  const { integrity: _integrity, ...payload } = record;
  return digest([canonicalPayload(payload)]) === record.integrity.recordDigest;
}
