/**
 * Reality Loop v0.3
 *
 * Turns a verified engine result into three explicit phases:
 *   OBSERVE -> MEASURE -> PROJECT
 *
 * Projection is intentionally deterministic. It is not an ML forecast and does
 * not invent future evidence. It computes the next protocol-relevant state
 * transition allowed by the current proof state.
 */

import { digest } from "./hash.ts";
import type { RealityCalculusResult } from "./reality-calculus.ts";
import type { PropositionCalculusResult } from "./proposition-calculus.ts";
import type { RealityProofBundle } from "./reality-proof-core.ts";
import type { RealityRecord, RealityState } from "./reality-record.ts";

export type RealityNextAction =
  | "CONTINUE_OBSERVATION"
  | "COLLECT_MISSING_EVIDENCE"
  | "ISOLATE_CONFLICT"
  | "RUN_REPLAY"
  | "COMPLETE_VERIFICATION"
  | "HOLD_VERIFIED_STATE";

export interface RealityMeasurement {
  observationCount: number;
  evidenceCount: number;
  claimCount: number;
  verificationCount: number;
  satisfiedObligations: number;
  openObligations: number;
  failedObligations: number;
  conflictCount: number;
  convergenceRounds: number;
  fixedPoint: boolean;
  proofCoverage: number;
}

export interface RealityProjection {
  method: "proof-state-transition/v1";
  currentState: RealityState;
  predictedState: RealityState;
  nextAction: RealityNextAction;
  basis: string[];
  rationale: string;
}

export interface RealityLoop {
  schema: "rchain-reality-loop/v1";
  phases: ["OBSERVE", "MEASURE", "PROJECT"];
  measurement: RealityMeasurement;
  projection: RealityProjection;
  loopDigest: string;
}

function stableIds(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function measurementOf(
  record: RealityRecord,
  propositions: PropositionCalculusResult,
  proof: RealityProofBundle,
): RealityMeasurement {
  const totalObligations = proof.obligations.length;
  const proofCoverage =
    totalObligations === 0 ? 0 : proof.satisfiedCount / totalObligations;

  return {
    observationCount: record.observations.length,
    evidenceCount: record.evidence.length,
    claimCount: record.claims.length,
    verificationCount: record.verification.length,
    satisfiedObligations: proof.satisfiedCount,
    openObligations: proof.openCount,
    failedObligations: proof.failedCount,
    conflictCount: proof.conflicts.length,
    convergenceRounds: propositions.trace.length,
    fixedPoint: propositions.fixedPoint,
    proofCoverage,
  };
}

function project(
  state: RealityState,
  record: RealityRecord,
  propositions: PropositionCalculusResult,
  proof: RealityProofBundle,
): RealityProjection {
  const failed = proof.obligations.filter((item) => item.status === "FAILED");
  const open = proof.obligations.filter((item) => item.status === "OPEN");
  const basis = stableIds([
    ...failed.map((item) => item.id),
    ...open.map((item) => item.id),
    ...proof.conflicts.flatMap((item) => item.ids),
  ]);

  if (state === "DIVERGENT") {
    return {
      method: "proof-state-transition/v1",
      currentState: state,
      predictedState: "DIVERGENT",
      nextAction: "ISOLATE_CONFLICT",
      basis,
      rationale: "Conflicting evidence is terminal until its conflict core is isolated or superseded by new evidence.",
    };
  }

  if (state === "INCOMPLETE") {
    return {
      method: "proof-state-transition/v1",
      currentState: state,
      predictedState: "INCOMPLETE",
      nextAction: "COLLECT_MISSING_EVIDENCE",
      basis: stableIds(open.map((item) => item.id)),
      rationale: "Open proof obligations prevent promotion; the next deterministic step is evidence completion.",
    };
  }

  if (state === "OBSERVED") {
    const nextState: RealityState = proof.openCount === 0 && proof.failedCount === 0 && propositions.fixedPoint
      ? "CONSISTENT"
      : "OBSERVED";
    return {
      method: "proof-state-transition/v1",
      currentState: state,
      predictedState: nextState,
      nextAction: nextState === "CONSISTENT" ? "RUN_REPLAY" : "CONTINUE_OBSERVATION",
      basis: nextState === "CONSISTENT" ? ["proposition-convergence"] : [],
      rationale: nextState === "CONSISTENT"
        ? "All current obligations are satisfied and proposition evaluation has converged; replay is the next independent check."
        : "The observation is recorded, but the proof state does not yet justify promotion to consistency.",
    };
  }

  if (state === "CONSISTENT") {
    const replayReady = record.replay.available;
    return {
      method: "proof-state-transition/v1",
      currentState: state,
      predictedState: replayReady ? "REPRODUCED" : "CONSISTENT",
      nextAction: replayReady ? "RUN_REPLAY" : "CONTINUE_OBSERVATION",
      basis: ["replay"],
      rationale: replayReady
        ? "Consistency has been established; an available replay provides the next independent reproduction boundary."
        : "Consistency is established, but no replay input is currently available for promotion.",
    };
  }

  if (state === "REPRODUCED") {
    const verificationsSatisfied = proof.obligations
      .filter((item) => item.kind === "VERIFICATION")
      .every((item) => item.status === "SATISFIED");
    const canVerify = verificationsSatisfied && propositions.fixedPoint && proof.openCount === 0 && proof.failedCount === 0;
    return {
      method: "proof-state-transition/v1",
      currentState: state,
      predictedState: canVerify ? "VERIFIED" : "REPRODUCED",
      nextAction: canVerify ? "HOLD_VERIFIED_STATE" : "COMPLETE_VERIFICATION",
      basis: canVerify
        ? ["replay", "proposition-convergence"]
        : stableIds([
          ...proof.obligations.filter((item) => item.kind === "VERIFICATION" && item.status !== "SATISFIED").map((item) => item.id),
          ...open.map((item) => item.id),
        ]),
      rationale: canVerify
        ? "Replay reproduced the result and all verification obligations are satisfied at a converged proposition fixed point."
        : "Reproduction is established, but verification is not yet complete enough for promotion.",
    };
  }

  return {
    method: "proof-state-transition/v1",
    currentState: "VERIFIED",
    predictedState: "VERIFIED",
    nextAction: "HOLD_VERIFIED_STATE",
    basis: ["verification", "replay", "proposition-convergence"],
    rationale: "The proof state is already verified; the loop remains stable until new evidence changes its inputs.",
  };
}

export function buildRealityLoop(args: {
  state: RealityState;
  record: RealityRecord;
  propositions: PropositionCalculusResult;
  proof: RealityProofBundle;
}): RealityLoop {
  const measurement = measurementOf(args.record, args.propositions, args.proof);
  const projection = project(args.state, args.record, args.propositions, args.proof);
  const payload: Omit<RealityLoop, "loopDigest"> = {
    schema: "rchain-reality-loop/v1",
    phases: ["OBSERVE", "MEASURE", "PROJECT"],
    measurement,
    projection,
  };

  return {
    ...payload,
    loopDigest: digest([JSON.stringify(payload)]),
  };
}

export function verifyRealityLoop(loop: RealityLoop): boolean {
  const { loopDigest: _loopDigest, ...payload } = loop;
  return digest([JSON.stringify(payload)]) === loop.loopDigest;
}
