import { digest } from "../compiler/hash.ts";
import {
  incompatible,
  selectMaximallyConsistentPropositions,
  type RealityBet,
  type RealityProposition,
} from "../compiler/proposition-calculus.ts";
import { detectEquivocations, equivocate, type Equivocation } from "./equivocation-engine.ts";
import { partitionValidators, type NetworkPartition } from "./network-partition.ts";
import { createValidators, validatorEvent, type ValidatorEvent, type ValidatorState } from "./validator.ts";

export interface CbcScenario {
  name: string;
  validators: number;
  byzantine: number;
  partition?: number;
  delayedRounds?: number;
  reorder?: boolean;
  equivocations?: number;
  rounds?: number;
}

export interface CbcResult {
  scenario: CbcScenario;
  validators: ValidatorState[];
  events: ValidatorEvent[];
  equivocations: Equivocation[];
  convergenceRounds: number;
  fixedPoint: boolean;
  replayDigest: string;
  convergenceHistory: Array<{ round: number; accepted: string[]; rejected: string[] }>;
  result: "CONVERGED" | "DIVERGENT";
  evidence: {
    justificationGraph: Array<{ from: string; to: string; relation: string }>;
    propositionTrace: Array<{ round: number; accepted: string[]; rejected: string[] }>;
    replayDigest: string;
    convergenceHistory: Array<{ round: number; accepted: string[]; rejected: string[] }>;
  };
}

function propositions(events: ValidatorEvent[]): RealityProposition[] {
  const ids = [...new Set(events.map((event) => event.proposition))].sort();
  return ids.map((id) => {
    const conflicts = ids.filter((other) => other !== id && other.startsWith("state:") && id.startsWith("state:"));
    return conflicts.length ? incompatible(id, id, conflicts) : { id, statement: id };
  });
}

function bets(events: ValidatorEvent[]): RealityBet[] {
  return events
    .filter((event) => event.kind !== "RECEIVE")
    .map((event) => ({
      source: event.validator,
      target: `round:${event.round}`,
      claim: event.proposition,
      belief: 1,
      justification: [event.digest],
    }));
}

function graph(events: ValidatorEvent[]): Array<{ from: string; to: string; relation: string }> {
  return events
    .slice()
    .sort((a, b) => a.digest.localeCompare(b.digest))
    .map((event) => ({
      from: event.validator,
      to: event.proposition,
      relation: event.kind === "EQUIVOCATE" ? "equivocates" : "justifies",
    }));
}

export function simulateCbc(scenario: CbcScenario): CbcResult {
  const rounds = scenario.rounds ?? 8;
  const validators = createValidators(scenario.validators, scenario.byzantine);
  const events: ValidatorEvent[] = [];
  const partition: NetworkPartition | undefined =
    scenario.partition && scenario.partition > 0 && scenario.partition < scenario.validators
      ? partitionValidators(validators.map((v) => v.id), scenario.partition, scenario.delayedRounds ?? 0)
      : undefined;
  if (partition) partition.reorder = scenario.reorder ?? false;

  for (let round = 1; round <= rounds; round++) {
    const proposition = partition && round <= (scenario.delayedRounds ?? 0) + 1
      ? `state:partition-${partition.groups[0]!.length}-${partition.groups[1]!.length}`
      : "state:canonical";

    for (const validator of validators) {
      events.push(validatorEvent(round, validator, validator.honest ? proposition : "state:byzantine"));
    }

    if ((scenario.equivocations ?? 0) > 0 && round === 2) {
      for (const validator of validators.slice(0, Math.min(scenario.equivocations, validators.length))) {
        events.push(...equivocate(validator, round, ["state:canonical", "state:conflicting"]));
      }
    }
  }

  if (partition) {
    const deliveries = [];
    for (let round = 1; round <= rounds; round++) {
      deliveries.push(...partitionedRound(partition, round));
    }
    events.push(...deliveries.map((delivery) => ({
      round: delivery.round,
      validator: delivery.to,
      kind: "RECEIVE" as const,
      proposition: delivery.proposition,
      digest: digest([delivery.round, delivery.from, delivery.to, delivery.proposition]),
    })));
  }

  const result = selectMaximallyConsistentPropositions(propositions(events));
  const equivocations = detectEquivocations(events);
  const replayDigest = digest([events.map((event) => event.digest).sort(), result.trace]);
  const divergent = equivocations.length > 0 || result.judgement.state === "CONFLICTING" || (partition !== undefined && result.judgement.state !== "CONSISTENT");
  return {
    scenario,
    validators,
    events,
    equivocations,
    convergenceRounds: result.trace.length,
    fixedPoint: result.fixedPoint,
    replayDigest,
    convergenceHistory: result.trace,
    result: divergent ? "DIVERGENT" : "CONVERGED",
    evidence: {
      justificationGraph: graph(events),
      propositionTrace: result.trace,
      replayDigest,
      convergenceHistory: result.trace,
    },
  };
}

function partitionedRound(partition: NetworkPartition, round: number): Array<{ round: number; from: string; to: string; proposition: string }> {
  const deliveries = [];
  for (const [index, group] of partition.groups.entries()) {
    const other = partition.groups[1 - index] ?? [];
    for (const from of group) {
      for (const to of other) {
        deliveries.push({
          round: round + partition.delayedRounds + 1,
          from,
          to,
          proposition: `state:partition-${partition.groups[0]!.length}-${partition.groups[1]!.length}`,
        });
      }
    }
  }
  return partition.reorder ? deliveries.reverse() : deliveries.sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
}

export function replayCbc(scenario: CbcScenario): CbcResult {
  return simulateCbc({ ...scenario });
}
