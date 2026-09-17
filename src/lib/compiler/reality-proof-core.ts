/**
 * Reality Proof Core
 *
 * Produces the explanatory artifacts for a Reality Engine run:
 * - proof-obligation ledger
 * - justification graph
 * - minimal conflict core
 *
 * These artifacts are deterministic and derived only from the engine inputs and
 * calculated results. They do not confer trust on an upstream issuer.
 */

import {
  detectEquivocation,
  type Equivocation,
  type PropositionCalculusResult,
  type RealityBet,
  type RealityProposition,
} from "./proposition-calculus.ts";
import type { RealityRecord, RealityState } from "./reality-record.ts";
import type { RealityCalculusResult } from "./reality-calculus.ts";

export type ProofObligationKind =
  | "OBSERVATION"
  | "CLAIM_BASIS"
  | "VERIFICATION"
  | "REPLAY"
  | "PROPOSITION"
  | "CONVERGENCE"
  | "EQUIVOCATION";

export type ProofObligationStatus = "SATISFIED" | "FAILED" | "OPEN";

export interface ProofObligation {
  id: string;
  kind: ProofObligationKind;
  statement: string;
  status: ProofObligationStatus;
  references: string[];
  reason: string;
}

export interface JustificationNode {
  id: string;
  kind:
    | "observation"
    | "evidence"
    | "claim"
    | "verification"
    | "replay"
    | "proposition"
    | "bet";
  label: string;
  status?: string;
}

export interface JustificationEdge {
  from: string;
  to: string;
  relation:
    | "supports"
    | "bases"
    | "checks"
    | "replays"
    | "requires"
    | "conflicts"
    | "justifies";
}

export interface JustificationGraph {
  nodes: JustificationNode[];
  edges: JustificationEdge[];
}

export interface ConflictCore {
  kind: "REPLAY" | "PROPOSITION" | "EQUIVOCATION";
  ids: string[];
  reason: string;
}

export interface RealityProofBundle {
  obligations: ProofObligation[];
  graph: JustificationGraph;
  conflicts: ConflictCore[];
  satisfiedCount: number;
  failedCount: number;
  openCount: number;
  proofState: Extract<RealityState, "VERIFIED" | "REPRODUCED" | "CONSISTENT" | "OBSERVED" | "INCOMPLETE" | "DIVERGENT">;
}

function ids(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function obligationStatusFromState(state: RealityState): ProofObligationStatus {
  if (state === "DIVERGENT") return "FAILED";
  if (state === "INCOMPLETE") return "OPEN";
  return "SATISFIED";
}

function propositionConflictPairs(
  accepted: RealityProposition[],
  rejected: RealityProposition[],
): [string, string][] {
  const pairs: [string, string][] = [];
  for (const candidate of rejected) {
    for (const winner of accepted) {
      const conflict =
        candidate.conflictsWith?.includes(winner.id) ||
        winner.conflictsWith?.includes(candidate.id);
      if (conflict) pairs.push([candidate.id, winner.id].sort() as [string, string]);
    }
  }
  return pairs.sort(([a1, b1], [a2, b2]) => `${a1}|${b1}`.localeCompare(`${a2}|${b2}`));
}

export function buildRealityProofBundle(args: {
  record: RealityRecord;
  reality: RealityCalculusResult;
  propositions: PropositionCalculusResult;
  bets: RealityBet[];
  equivocations?: Equivocation[];
}): RealityProofBundle {
  const { record, reality, propositions, bets } = args;
  const equivocations = args.equivocations ?? detectEquivocation(bets);
  const nodes: JustificationNode[] = [];
  const edges: JustificationEdge[] = [];
  const obligations: ProofObligation[] = [];
  const conflicts: ConflictCore[] = [];

  for (const observation of record.observations) {
    nodes.push({ id: observation.id, kind: "observation", label: observation.type, status: "OBSERVED" });
  }
  for (const evidence of record.evidence) {
    nodes.push({ id: evidence.id, kind: "evidence", label: evidence.description });
    for (const observationId of evidence.observationIds) {
      edges.push({ from: evidence.id, to: observationId, relation: "supports" });
    }
  }
  for (const claim of record.claims) {
    nodes.push({ id: claim.id, kind: "claim", label: claim.statement });
    for (const basisId of claim.basis) {
      edges.push({ from: claim.id, to: basisId, relation: "bases" });
    }
  }
  for (const verification of record.verification) {
    nodes.push({ id: verification.id, kind: "verification", label: verification.predicate, status: verification.state });
    for (const evidenceId of verification.evidenceIds) {
      edges.push({ from: verification.id, to: evidenceId, relation: "checks" });
    }
  }
  nodes.push({ id: "replay", kind: "replay", label: "deterministic replay", status: record.replay.state });
  for (const inputId of record.replay.inputIds) {
    edges.push({ from: "replay", to: inputId, relation: "replays" });
  }

  const knownObservations = new Set(record.observations.map((item) => item.id));
  const knownEvidence = new Set(record.evidence.map((item) => item.id));
  obligations.push({
    id: "observation-coverage",
    kind: "OBSERVATION",
    statement: "At least one observation anchors the record.",
    status: record.observations.length > 0 ? "SATISFIED" : "OPEN",
    references: ids(record.observations.map((item) => item.id)),
    reason: record.observations.length > 0 ? "observation anchor present" : "record has no observations",
  });

  for (const claim of record.claims) {
    const missing = claim.basis.filter((basisId) => !knownObservations.has(basisId) && !knownEvidence.has(basisId));
    const status: ProofObligationStatus = missing.length > 0 ? "OPEN" : "SATISFIED";
    obligations.push({
      id: `claim-basis:${claim.id}`,
      kind: "CLAIM_BASIS",
      statement: `Claim ${claim.id} has resolvable basis references.`,
      status,
      references: ids(claim.basis),
      reason: missing.length > 0 ? `missing basis: ${ids(missing).join(", ")}` : "all basis references resolve",
    });
  }

  for (const verification of record.verification) {
    obligations.push({
      id: `verification:${verification.id}`,
      kind: "VERIFICATION",
      statement: `Verification predicate ${verification.predicate} must hold.`,
      status: obligationStatusFromState(verification.state),
      references: ids(verification.evidenceIds),
      reason: verification.message,
    });
  }

  obligations.push({
    id: "replay",
    kind: "REPLAY",
    statement: "Replay must reproduce the recorded execution when replay is available.",
    status: record.replay.available ? obligationStatusFromState(record.replay.state) : "OPEN",
    references: ids(record.replay.inputIds),
    reason: record.replay.available ? `replay=${record.replay.state}` : "replay unavailable",
  });

  for (const proposition of propositions.accepted) {
    nodes.push({ id: `prop:${proposition.id}`, kind: "proposition", label: proposition.statement, status: "ACCEPTED" });
    for (const required of proposition.requires ?? []) {
      edges.push({ from: `prop:${proposition.id}`, to: `prop:${required}`, relation: "requires" });
    }
  }
  for (const proposition of propositions.rejected) {
    nodes.push({ id: `prop:${proposition.id}`, kind: "proposition", label: proposition.statement, status: "BLOCKED" });
    for (const required of proposition.requires ?? []) {
      edges.push({ from: `prop:${proposition.id}`, to: `prop:${required}`, relation: "requires" });
    }
  }

  const propositionStatus: ProofObligationStatus =
    propositions.judgement.state === "CONFLICTING" ? "FAILED" :
    propositions.judgement.state === "INCOMPLETE" ? "OPEN" : "SATISFIED";
  obligations.push({
    id: "proposition-consistency",
    kind: "PROPOSITION",
    statement: "The accepted proposition set must remain consistent.",
    status: propositionStatus,
    references: ids(propositions.accepted.map((item) => `prop:${item.id}`)),
    reason: propositions.judgement.reason,
  });

  obligations.push({
    id: "proposition-convergence",
    kind: "CONVERGENCE",
    statement: "The proposition process must reach a fixed point.",
    status: propositions.fixedPoint && propositions.judgement.state === "CONSISTENT" ? "SATISFIED" :
      propositions.judgement.state === "CONFLICTING" ? "FAILED" : "OPEN",
    references: propositions.trace.map((round) => `round:${round.round}`),
    reason: propositions.fixedPoint ? "fixed point reached" : "convergence not established",
  });

  for (const bet of bets) {
    const betId = `bet:${bet.source}:${bet.target}:${bet.claim}`;
    nodes.push({ id: betId, kind: "bet", label: `${bet.source} → ${bet.target}: ${bet.claim}` });
    for (const justification of bet.justification) {
      edges.push({ from: betId, to: justification, relation: "justifies" });
    }
  }

  obligations.push({
    id: "equivocation",
    kind: "EQUIVOCATION",
    statement: "A validator must not issue contradictory claims for the same observation context.",
    status: equivocations.length === 0 ? "SATISFIED" : "FAILED",
    references: equivocations.flatMap((item) => item.betIds).sort(),
    reason: equivocations.length === 0 ? "no equivocation detected" : `${equivocations.length} equivocation group(s) detected`,
  });

  for (const pair of propositionConflictPairs(propositions.accepted, propositions.rejected)) {
    edges.push({ from: `prop:${pair[0]}`, to: `prop:${pair[1]}`, relation: "conflicts" });
    conflicts.push({ kind: "PROPOSITION", ids: pair, reason: "accepted/rejected propositions conflict" });
  }
  if (record.replay.state === "DIVERGENT") {
    conflicts.push({
      kind: "REPLAY",
      ids: ids([record.replay.expectedDigest ?? "", record.replay.observedDigest ?? ""].filter(Boolean)),
      reason: "replay digest mismatch",
    });
  }
  for (const equivocation of equivocations) {
    conflicts.push({ kind: "EQUIVOCATION", ids: ids(equivocation.betIds), reason: `validator ${equivocation.source} issued incompatible claims` });
  }

  const orderedObligations = obligations.sort((a, b) => a.id.localeCompare(b.id));
  const orderedNodes = nodes.sort((a, b) => a.id.localeCompare(b.id));
  const orderedEdges = edges.sort((a, b) => `${a.from}|${a.to}|${a.relation}`.localeCompare(`${b.from}|${b.to}|${b.relation}`));
  const orderedConflicts = conflicts.sort((a, b) => `${a.kind}|${a.ids.join(",")}`.localeCompare(`${b.kind}|${b.ids.join(",")}`));
  const failedCount = orderedObligations.filter((item) => item.status === "FAILED").length;
  const openCount = orderedObligations.filter((item) => item.status === "OPEN").length;
  const satisfiedCount = orderedObligations.length - failedCount - openCount;

  return {
    obligations: orderedObligations,
    graph: { nodes: orderedNodes, edges: orderedEdges },
    conflicts: orderedConflicts,
    satisfiedCount,
    failedCount,
    openCount,
    proofState: record.state,
  };
}
