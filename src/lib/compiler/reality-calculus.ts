/**
 * Reality Calculus v0.1
 *
 * A small compositional calculus over the existing RealityRecord model.
 * It does not create a second evidence model: terms reference observations,
 * predicates, and replay digests already represented by RealityRecord.
 */

import { digest } from "./hash.ts";
import type { RealityRecord, RealityState } from "./reality-record.ts";

export type RealityRule = "OBS" | "COMP" | "REQ" | "CHK" | "REP";

export type RealityTerm =
  | { kind: "observation"; observationId: string }
  | { kind: "compose"; left: RealityTerm; right: RealityTerm }
  | { kind: "require"; ids: string[]; term: RealityTerm }
  | { kind: "check"; predicate: string; term: RealityTerm }
  | { kind: "replay"; expectedDigest: string; observedDigest: string; term: RealityTerm };

export interface RealityJudgement {
  state: RealityState;
  observationIds: string[];
  evidenceIds: string[];
  verificationIds: string[];
  reason: string;
}

export interface RealityDerivation {
  rule: RealityRule;
  conclusion: RealityJudgement;
  premises: RealityDerivation[];
}

export interface RealityCalculusResult {
  judgement: RealityJudgement;
  derivation: RealityDerivation;
  derivationDigest: string;
}

const stateRank: Record<RealityState, number> = {
  OBSERVED: 0,
  CONSISTENT: 1,
  REPRODUCED: 2,
  VERIFIED: 3,
  INCOMPLETE: 4,
  DIVERGENT: 5,
};

function joinState(left: RealityState, right: RealityState): RealityState {
  return stateRank[left] >= stateRank[right] ? left : right;
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function mergeJudgements(left: RealityJudgement, right: RealityJudgement): RealityJudgement {
  const state = joinState(left.state, right.state);
  const reasons = [left.reason, right.reason].filter(Boolean).join(" + ");
  return {
    state,
    observationIds: unique([...left.observationIds, ...right.observationIds]),
    evidenceIds: unique([...left.evidenceIds, ...right.evidenceIds]),
    verificationIds: unique([...left.verificationIds, ...right.verificationIds]),
    reason: reasons || "composed evidence",
  };
}

function missingIds(record: RealityRecord, ids: string[]): string[] {
  const known = new Set([
    ...record.observations.map((item) => item.id),
    ...record.evidence.map((item) => item.id),
    ...record.verification.map((item) => item.id),
  ]);
  return ids.filter((id) => !known.has(id));
}

function evaluateTerm(record: RealityRecord, term: RealityTerm): RealityDerivation {
  switch (term.kind) {
    case "observation": {
      const observation = record.observations.find((item) => item.id === term.observationId);
      if (!observation) {
        const conclusion: RealityJudgement = {
          state: "INCOMPLETE",
          observationIds: [],
          evidenceIds: [],
          verificationIds: [],
          reason: `missing observation: ${term.observationId}`,
        };
        return { rule: "OBS", conclusion, premises: [] };
      }
      const conclusion: RealityJudgement = {
        state: "OBSERVED",
        observationIds: [observation.id],
        evidenceIds: record.evidence.filter((item) => item.observationIds.includes(observation.id)).map((item) => item.id),
        verificationIds: record.verification.filter((item) => item.evidenceIds.some((id) => record.evidence.find((e) => e.id === id)?.observationIds.includes(observation.id))).map((item) => item.id),
        reason: `observed: ${observation.id}`,
      };
      return { rule: "OBS", conclusion, premises: [] };
    }

    case "compose": {
      const left = evaluateTerm(record, term.left);
      const right = evaluateTerm(record, term.right);
      return {
        rule: "COMP",
        conclusion: mergeJudgements(left.conclusion, right.conclusion),
        premises: [left, right],
      };
    }

    case "require": {
      const premise = evaluateTerm(record, term.term);
      const missing = missingIds(record, term.ids);
      const conclusion = missing.length
        ? {
            ...premise.conclusion,
            state: "INCOMPLETE" as const,
            reason: `${premise.conclusion.reason}; missing required evidence: ${missing.join(", ")}`,
          }
        : premise.conclusion;
      return { rule: "REQ", conclusion, premises: [premise] };
    }

    case "check": {
      const premise = evaluateTerm(record, term.term);
      if (premise.conclusion.state === "INCOMPLETE" || premise.conclusion.state === "DIVERGENT") {
        return { rule: "CHK", conclusion: premise.conclusion, premises: [premise] };
      }
      const verification = record.verification.find((item) => item.predicate === term.predicate);
      if (!verification) {
        return {
          rule: "CHK",
          conclusion: {
            ...premise.conclusion,
            state: "INCOMPLETE",
            reason: `${premise.conclusion.reason}; predicate not present: ${term.predicate}`,
          },
          premises: [premise],
        };
      }
      const checked: RealityJudgement = {
        ...premise.conclusion,
        state: joinState(premise.conclusion.state, verification.state),
        verificationIds: unique([...premise.conclusion.verificationIds, verification.id]),
        evidenceIds: unique([...premise.conclusion.evidenceIds, ...verification.evidenceIds]),
        reason: `${premise.conclusion.reason}; ${verification.predicate}: ${verification.state}`,
      };
      return { rule: "CHK", conclusion: checked, premises: [premise] };
    }

    case "replay": {
      const premise = evaluateTerm(record, term.term);
      const replayState: RealityState = term.expectedDigest === term.observedDigest ? "REPRODUCED" : "DIVERGENT";
      return {
        rule: "REP",
        conclusion: {
          ...premise.conclusion,
          state: joinState(premise.conclusion.state, replayState),
          reason: `${premise.conclusion.reason}; replay=${replayState}`,
        },
        premises: [premise],
      };
    }
  }
}

export function evaluateRealityTerm(record: RealityRecord, term: RealityTerm): RealityCalculusResult {
  const derivation = evaluateTerm(record, term);
  const derivationDigest = digest([
    JSON.stringify({
      rule: derivation.rule,
      conclusion: derivation.conclusion,
      premises: derivation.premises,
    }),
  ]);
  return {
    judgement: derivation.conclusion,
    derivation,
    derivationDigest,
  };
}

export function termObservation(observationId: string): RealityTerm {
  return { kind: "observation", observationId };
}

export function termCompose(left: RealityTerm, right: RealityTerm): RealityTerm {
  return { kind: "compose", left, right };
}

export function termRequire(ids: string[], term: RealityTerm): RealityTerm {
  return { kind: "require", ids: [...ids].sort(), term };
}

export function termCheck(predicate: string, term: RealityTerm): RealityTerm {
  return { kind: "check", predicate, term };
}

export function termReplay(expectedDigest: string, observedDigest: string, term: RealityTerm): RealityTerm {
  return { kind: "replay", expectedDigest, observedDigest, term };
}
