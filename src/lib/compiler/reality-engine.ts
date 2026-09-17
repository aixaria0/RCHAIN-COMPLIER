/**
 * Reality Engine Core v0.1
 *
 * The engine is the first executable boundary that turns observations,
 * verification records, replay evidence, and propositions into one portable
 * RealityCertificate. It deliberately composes the existing calculi instead
 * of creating a parallel evidence model.
 */

import { digest } from "./hash.ts";
import {
  evaluateRealityTerm,
  termCheck,
  termCompose,
  termObservation,
  termReplay,
  type RealityCalculusResult,
  type RealityTerm,
} from "./reality-calculus.ts";
import {
  detectEquivocation,
  selectMaximallyConsistentPropositions,
  type Equivocation,
  type PropositionCalculusResult,
  type RealityBet,
  type RealityProposition,
} from "./proposition-calculus.ts";
import {
  sealRealityRecord,
  type RealityRecord,
  type RealityState,
} from "./reality-record.ts";

export interface RealityEngineInput {
  record: Omit<RealityRecord, "state" | "integrity"> & { state?: RealityState };
  propositions?: RealityProposition[];
  bets?: RealityBet[];
  previousDigest?: string;
}

export interface RealityEngineCertificate {
  schema: "rchain-reality-certificate/v1";
  engineVersion: "0.1.0";
  state: RealityState;
  record: RealityRecord;
  reality: RealityCalculusResult;
  propositions: PropositionCalculusResult;
  equivocations: Equivocation[];
  sourceLineage: {
    source: string;
    observationIds: string[];
    claimIds: string[];
  };
  certificateDigest: string;
}

function normalizeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, normalizeValue(item)]),
  );
}

function stableIds(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function normalizeRecord(
  record: RealityEngineInput["record"],
): RealityEngineInput["record"] {
  return {
    ...record,
    subject: normalizeValue(record.subject) as RealityEngineInput["record"]["subject"],
    observations: [...record.observations]
      .map((item) => ({ ...item, data: normalizeValue(item.data) as Record<string, unknown> }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    claims: [...record.claims].sort((left, right) => left.id.localeCompare(right.id)).map((item) => ({
      ...item,
      basis: stableIds(item.basis),
    })),
    evidence: [...record.evidence]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((item) => ({ ...item, observationIds: stableIds(item.observationIds) })),
    dependencies: [...record.dependencies].sort((left, right) =>
      `${left.from}|${left.to}|${left.relation}`.localeCompare(`${right.from}|${right.to}|${right.relation}`),
    ),
    transformations: [...record.transformations]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((item) => ({
        ...item,
        inputIds: stableIds(item.inputIds),
        outputIds: stableIds(item.outputIds),
      })),
    verification: [...record.verification]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((item) => ({ ...item, evidenceIds: stableIds(item.evidenceIds) })),
    replay: {
      ...record.replay,
      inputIds: stableIds(record.replay.inputIds),
    },
    state: record.state,
  };
}

function composeObservationTerms(record: RealityEngineInput["record"]): RealityTerm {
  const observations = record.observations.map((item) => termObservation(item.id));
  if (observations.length === 0) return termObservation("__missing_observation__");
  return observations.reduce((left, right) => termCompose(left, right));
}

function buildRealityTerm(record: RealityEngineInput["record"]): RealityTerm {
  let term = composeObservationTerms(record);
  for (const verification of [...record.verification].sort((a, b) => a.predicate.localeCompare(b.predicate))) {
    term = termCheck(verification.predicate, term);
  }
  if (
    record.replay.available &&
    record.replay.expectedDigest &&
    record.replay.observedDigest
  ) {
    term = termReplay(record.replay.expectedDigest, record.replay.observedDigest, term);
  }
  return term;
}

function resolveState(
  reality: RealityCalculusResult,
  propositions: PropositionCalculusResult,
  equivocations: Equivocation[],
): RealityState {
  if (
    reality.judgement.state === "DIVERGENT" ||
    propositions.judgement.state === "CONFLICTING" ||
    equivocations.length > 0
  ) {
    return "DIVERGENT";
  }

  if (
    reality.judgement.state === "INCOMPLETE" ||
    propositions.judgement.state === "INCOMPLETE"
  ) {
    return "INCOMPLETE";
  }

  if (
    reality.judgement.state === "VERIFIED" &&
    propositions.judgement.state === "CONSISTENT" &&
    propositions.fixedPoint
  ) {
    return "VERIFIED";
  }

  if (
    reality.judgement.state === "REPRODUCED" &&
    propositions.judgement.state === "CONSISTENT" &&
    propositions.fixedPoint
  ) {
    return "REPRODUCED";
  }

  if (
    reality.judgement.state === "CONSISTENT" &&
    propositions.judgement.state === "CONSISTENT"
  ) {
    return "CONSISTENT";
  }

  return "OBSERVED";
}

export function runRealityEngine(input: RealityEngineInput): RealityEngineCertificate {
  const normalized = normalizeRecord(input.record);
  const reality = evaluateRealityTerm(normalized as RealityRecord, buildRealityTerm(normalized));
  const propositions = selectMaximallyConsistentPropositions(
    [...(input.propositions ?? [])]
      .map((item) => ({
        ...item,
        conflictsWith: stableIds(item.conflictsWith ?? []),
        requires: stableIds(item.requires ?? []),
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
  );
  const equivocations = detectEquivocation(input.bets ?? []);
  const state = resolveState(reality, propositions, equivocations);
  const record = sealRealityRecord({ ...normalized, state }, input.previousDigest);
  const sourceLineage = {
    source: normalized.source,
    observationIds: stableIds(normalized.observations.map((item) => item.id)),
    claimIds: stableIds(normalized.claims.map((item) => item.id)),
  };

  const certificateDigest = digest([
    normalizeValue({
      schema: "rchain-reality-certificate/v1",
      engineVersion: "0.1.0",
      state,
      record,
      reality,
      propositions,
      equivocations,
      sourceLineage,
    }),
  ]);

  return {
    schema: "rchain-reality-certificate/v1",
    engineVersion: "0.1.0",
    state,
    record,
    reality,
    propositions,
    equivocations,
    sourceLineage,
    certificateDigest,
  };
}

export function verifyRealityCertificate(certificate: RealityEngineCertificate): boolean {
  const { certificateDigest: _certificateDigest, ...payload } = certificate;
  return digest([normalizeValue(payload)]) === certificate.certificateDigest;
}
