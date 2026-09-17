import { digest } from "./hash.ts";

export interface RealityProposition {
  id: string;
  statement: string;
  conflictsWith?: string[];
  requires?: string[];
}

export interface RealityBet {
  source: string;
  target: string;
  claim: string;
  belief: number;
  justification: string[];
}

export interface PropositionJudgement {
  propositionIds: string[];
  consistent: boolean;
  state: "CONSISTENT" | "CONFLICTING" | "INCOMPLETE";
  reason: string;
  digest: string;
}

export interface ConvergenceTrace {
  round: number;
  accepted: string[];
  rejected: string[];
}

export interface PropositionCalculusResult {
  accepted: RealityProposition[];
  rejected: RealityProposition[];
  trace: ConvergenceTrace[];
  judgement: PropositionJudgement;
  fixedPoint: boolean;
}

export interface Equivocation {
  source: string;
  claims: string[];
  betIds: string[];
}

function normalizeIds(ids: string[]): string[] {
  return [...new Set(ids)].sort();
}

function conflicts(a: RealityProposition, b: RealityProposition): boolean {
  return Boolean(
    a.conflictsWith?.includes(b.id) ||
      b.conflictsWith?.includes(a.id),
  );
}

function requirementsSatisfied(
  candidate: RealityProposition,
  accepted: Set<string>,
  known: Set<string>,
): boolean {
  for (const required of candidate.requires ?? []) {
    if (!known.has(required) || !accepted.has(required)) return false;
  }
  return true;
}

/**
 * Deterministic inclusion-maximal consistent subset.
 *
 * This is intentionally a maximal-set algorithm, not a claim of a globally
 * maximum-cardinality solution. Candidates are processed in stable id order;
 * a candidate is accepted only when it does not conflict with the current set
 * and all declared requirements are already satisfied.
 */
export function selectMaximallyConsistentPropositions(
  propositions: RealityProposition[],
): PropositionCalculusResult {
  const ordered = [...propositions].sort((a, b) => a.id.localeCompare(b.id));
  const known = new Set(ordered.map((p) => p.id));
  const accepted: RealityProposition[] = [];
  const rejected: RealityProposition[] = [];
  const acceptedIds = new Set<string>();
  const trace: ConvergenceTrace[] = [];

  let changed = true;
  let round = 0;
  let remaining = ordered;

  while (changed) {
    changed = false;
    round += 1;
    const acceptedThisRound: string[] = [];
    const rejectedThisRound: string[] = [];

    for (const candidate of remaining) {
      const hasConflict = accepted.some((item) => conflicts(item, candidate));
      const hasRequirements = requirementsSatisfied(candidate, acceptedIds, known);

      if (!hasConflict && hasRequirements) {
        accepted.push(candidate);
        acceptedIds.add(candidate.id);
        acceptedThisRound.push(candidate.id);
        changed = true;
      }
    }

    remaining = remaining.filter((candidate) => !acceptedIds.has(candidate.id));
    for (const candidate of remaining) {
      const hasConflict = accepted.some((item) => conflicts(item, candidate));
      const missing = !requirementsSatisfied(candidate, acceptedIds, known);
      if (hasConflict || missing) rejectedThisRound.push(candidate.id);
    }

    trace.push({
      round,
      accepted: normalizeIds(acceptedThisRound),
      rejected: normalizeIds(rejectedThisRound),
    });
  }

  const stillPending = remaining.filter((candidate) => !acceptedIds.has(candidate.id));
  const hasHardConflict = accepted.some((left, i) =>
    accepted.slice(i + 1).some((right) => conflicts(left, right)),
  );

  const rejectedIds = normalizeIds(stillPending.map((p) => p.id));
  for (const candidate of stillPending) rejected.push(candidate);

  const state = hasHardConflict
    ? "CONFLICTING"
    : rejected.length > 0
      ? "INCOMPLETE"
      : "CONSISTENT";

  const judgementPayload = {
    propositionIds: normalizeIds(accepted.map((p) => p.id)),
    consistent: !hasHardConflict,
    state,
    rejectedIds,
  };

  return {
    accepted,
    rejected,
    trace,
    fixedPoint: !changed,
    judgement: {
      propositionIds: judgementPayload.propositionIds,
      consistent: judgementPayload.consistent,
      state,
      reason:
        state === "CONSISTENT"
          ? "stable inclusion-maximal consistent proposition set"
          : state === "INCOMPLETE"
            ? "some propositions remain blocked by conflicts or unmet requirements"
            : "accepted proposition set contains a conflict",
      digest: digest([JSON.stringify(judgementPayload)]),
    },
  };
}

export function detectEquivocation(bets: RealityBet[]): Equivocation[] {
  const bySource = new Map<string, RealityBet[]>();
  for (const bet of bets) {
    const current = bySource.get(bet.source) ?? [];
    current.push(bet);
    bySource.set(bet.source, current);
  }

  return [...bySource.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([source, sourceBets]) => {
      const claims = normalizeIds(sourceBets.map((bet) => bet.claim));
      if (claims.length <= 1) return [];
      const betIds = sourceBets
        .map((bet) => digest([`${bet.source}|${bet.target}|${bet.claim}|${bet.belief}|${normalizeIds(bet.justification).join(",")}`]))
        .sort();
      return [{ source, claims, betIds }];
    });
}

export function proposition(statement: string, id = statement): RealityProposition {
  return { id, statement };
}

export function incompatible(
  id: string,
  statement: string,
  conflictsWith: string[],
): RealityProposition {
  return { id, statement, conflictsWith: normalizeIds(conflictsWith) };
}
