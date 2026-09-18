import { digest } from "./hash.ts";
import { detectEquivocation, type RealityBet } from "./proposition-calculus.ts";

export type FaultMode = "baseline" | "partition" | "equivocation" | "reorder" | "partition+equivocation";

export interface CbcValidator { id: string; stake: number; }

export interface CbcStressScenario {
  id: string;
  validators: CbcValidator[];
  rounds?: number;
  fault: FaultMode;
  partition?: string[][];
  equivocation?: { source: string; claims: string[] };
  reorder?: boolean;
}

export interface CbcRoundObservation {
  round: number;
  deliveredBetIds: string[];
  acceptedClaims: string[];
  blockedClaims: string[];
  equivocationSources: string[];
  partitioned: boolean;
}

export interface CbcFragilityMetrics {
  validators: number;
  totalStake: number;
  rounds: number;
  convergenceRounds: number | null;
  equivocationCount: number;
  blockedClaimCount: number;
  partitionedRounds: number;
  replayStable: boolean;
  divergence: boolean;
}

export interface CbcFragilityReport {
  scenarioId: string;
  modelBoundary: string;
  observations: CbcRoundObservation[];
  metrics: CbcFragilityMetrics;
  fragilities: string[];
  improvementHypotheses: string[];
  replayDigest: string;
}

function stable<T>(items: T[], key: (item: T) => string): T[] {
  return [...items].sort((a, b) => key(a).localeCompare(key(b)));
}

function makeBetId(bet: RealityBet): string {
  return digest([
    `${bet.source}|${bet.target}|${bet.claim}|${bet.belief}|${stable(bet.justification, (value) => value).join(",")}`,
  ]);
}

function buildBets(scenario: CbcStressScenario, round: number): RealityBet[] {
  const ordered = stable(scenario.validators, (v) => v.id);
  const target = `round-${round}`;
  const partitionGroup = new Set(scenario.partition?.[1] ?? []);
  const bets: RealityBet[] = ordered.map((validator) => ({
    source: validator.id,
    target,
    claim:
      (scenario.fault === "partition" || scenario.fault === "partition+equivocation") &&
      partitionGroup.has(validator.id)
        ? "block-B"
        : "block-A",
    belief: validator.stake,
    justification: [`parent-${Math.max(0, round - 1)}`],
  }));

  if (
    scenario.equivocation &&
    (scenario.fault === "equivocation" || scenario.fault === "partition+equivocation")
  ) {
    const source = scenario.equivocation.source;
    const index = bets.findIndex((bet) => bet.source === source);
    if (index >= 0) {
      const extra = scenario.equivocation.claims
        .filter((claim) => claim !== bets[index].claim)
        .map((claim) => ({
          source,
          target,
          claim,
          belief: bets[index].belief,
          justification: [`parent-${Math.max(0, round - 1)}`, "conflict"],
        }));
      bets.push(...extra);
    }
  }

  return bets;
}

function deliveredBets(bets: RealityBet[], scenario: CbcStressScenario): RealityBet[] {
  let delivered = [...bets];

  if (scenario.fault === "partition" || scenario.fault === "partition+equivocation") {
    const groups = scenario.partition ?? [];
    if (groups.length >= 2) {
      const isolated = new Set(groups[0]);
      delivered = delivered.filter(
        (bet) => !isolated.has(bet.source) || bet.claim === "block-A",
      );
    }
  }

  if (scenario.fault === "reorder" || scenario.reorder) {
    delivered = stable(
      delivered,
      (bet) => `${bet.claim}|${bet.source}|${bet.target}`,
    ).reverse();
  }

  return delivered;
}

function acceptedClaims(bets: RealityBet[]): string[] {
  const byClaim = new Map<string, number>();
  for (const bet of bets) {
    byClaim.set(bet.claim, (byClaim.get(bet.claim) ?? 0) + 1);
  }
  return [...byClaim.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([claim]) => claim);
}

/**
 * Deterministic stress harness for an abstract CBC-style validator/bet model.
 *
 * Boundary: this models validator observations, network faults, justification
 * and equivocation signals. It does not reproduce the historical RChain
 * Casper implementation or claim protocol-level safety/liveness results.
 */
export function runCbcStressScenario(scenario: CbcStressScenario): CbcFragilityReport {
  const rounds = Math.max(1, scenario.rounds ?? 3);
  const observations: CbcRoundObservation[] = [];

  for (let round = 1; round <= rounds; round += 1) {
    const bets = buildBets(scenario, round);
    const delivered = deliveredBets(bets, scenario);
    const equivocations = detectEquivocation(delivered);
    const claims = acceptedClaims(delivered);
    const allClaims = stable([...new Set(bets.map((bet) => bet.claim))], (value) => value);
    const blockedClaims = allClaims.filter((claim) => !claims.includes(claim));

    observations.push({
      round,
      deliveredBetIds: stable(delivered.map(makeBetId), (value) => value),
      acceptedClaims: claims,
      blockedClaims,
      equivocationSources: equivocations.map((item) => item.source),
      partitioned:
        scenario.fault === "partition" || scenario.fault === "partition+equivocation",
    });
  }

  const convergenceRounds =
    observations.length > 0 &&
    observations.every((observation) => observation.acceptedClaims.length === 1) &&
    observations.every((observation) => observation.equivocationSources.length === 0)
      ? observations[0].round
      : null;

  const equivocationCount = new Set(
    observations.flatMap((observation) => observation.equivocationSources),
  ).size;
  const blockedClaimCount = observations.reduce(
    (total, observation) => total + observation.blockedClaims.length,
    0,
  );
  const partitionedRounds = observations.filter((observation) => observation.partitioned).length;
  const replayDigest = digest([JSON.stringify({ scenario, observations })]);

  const fragilities: string[] = [];
  const improvementHypotheses: string[] = [];

  if (equivocationCount > 0) {
    fragilities.push("validator equivocation is observable in the delivered bet set");
    improvementHypotheses.push(
      "surface equivocation earlier in the justification/evidence path before convergence analysis",
    );
  }
  if (partitionedRounds > 0) {
    fragilities.push("network partition changes which validator observations are available");
    improvementHypotheses.push(
      "compare partition-local convergence against post-rejoin replay before accepting a stable result",
    );
  }
  if (scenario.fault === "reorder" || scenario.reorder) {
    fragilities.push("message ordering changes the observation sequence");
    improvementHypotheses.push(
      "make ordering assumptions explicit and verify replay invariance under admissible delivery permutations",
    );
  }
  if (blockedClaimCount > 0) {
    fragilities.push("some claims remain blocked from the observed set");
    improvementHypotheses.push(
      "record blocked claims with their causal justification instead of collapsing them into a binary failure",
    );
  }

  return {
    scenarioId: scenario.id,
    modelBoundary:
      "Synthetic CBC-style stress model; not a reproduction of historical RChain Casper consensus.",
    observations,
    metrics: {
      validators: scenario.validators.length,
      totalStake: scenario.validators.reduce((sum, validator) => sum + validator.stake, 0),
      rounds,
      convergenceRounds,
      equivocationCount,
      blockedClaimCount,
      partitionedRounds,
      replayStable: true,
      divergence: fragilities.length > 0,
    },
    fragilities,
    improvementHypotheses,
    replayDigest,
  };
}

export function replayCbcStressScenario(scenario: CbcStressScenario): boolean {
  const first = runCbcStressScenario(scenario);
  const second = runCbcStressScenario(scenario);
  return first.replayDigest === second.replayDigest;
}
