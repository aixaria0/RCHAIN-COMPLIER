import { digest } from "../compiler/hash.ts";
import { replayCbc, simulateCbc, type CbcResult, type CbcScenario } from "./cbc-simulator.ts";

export type FragilityInvariant =
  | "REPLAY_DETERMINISM"
  | "BASELINE_CONVERGENCE"
  | "EQUIVOCATION_DETECTION"
  | "PARTITION_EVIDENCE";

export interface Counterexample {
  invariant: FragilityInvariant;
  failedRound: number;
  cause: string;
  precondition: string;
  transition: string;
  conflictCore: string[];
  minimalReplay: CbcScenario;
  replayDigest: string;
}

export interface FragilityReport {
  scenario: CbcScenario;
  invariants: Array<{ invariant: FragilityInvariant; satisfied: boolean; observation: string }>;
  counterexamples: Counterexample[];
  digest: string;
}

function evaluateInvariants(result: CbcResult, replay: CbcResult): FragilityReport["invariants"] {
  const adversarial = result.scenario.partition !== undefined || result.scenario.equivocations !== undefined;
  return [
    {
      invariant: "REPLAY_DETERMINISM",
      satisfied: result.replayDigest === replay.replayDigest,
      observation: result.replayDigest === replay.replayDigest ? "identical scenario reproduced the same replay digest" : "identical scenario produced different replay digests",
    },
    {
      invariant: "BASELINE_CONVERGENCE",
      satisfied: adversarial ? true : result.result === "CONVERGED" && result.fixedPoint,
      observation: adversarial ? "not asserted for adversarial scenarios" : result.result + "/" + (result.fixedPoint ? "fixed-point" : "non-fixed-point"),
    },
    {
      invariant: "EQUIVOCATION_DETECTION",
      satisfied: (result.scenario.equivocations ?? 0) === result.equivocations.length,
      observation: "configured=" + (result.scenario.equivocations ?? 0) + ", detected=" + result.equivocations.length,
    },
    {
      invariant: "PARTITION_EVIDENCE",
      satisfied: result.scenario.partition === undefined || result.evidence.justificationGraph.length > 0,
      observation: result.scenario.partition === undefined ? "not applicable" : "graph-events=" + result.evidence.justificationGraph.length,
    },
  ];
}

function shrinkScenario(scenario: CbcScenario, predicate: (candidate: CbcResult) => boolean): CbcScenario {
  let current = { ...scenario };
  const candidates: CbcScenario[] = [];
  if ((current.rounds ?? 8) > 1) candidates.push({ ...current, rounds: 1 });
  if ((current.equivocations ?? 0) > 1) candidates.push({ ...current, equivocations: 1 });
  if (current.partition !== undefined && current.partition > 1 && current.validators - current.partition > 1) {
    candidates.push({ ...current, validators: 4, partition: 2 });
  }
  if ((current.delayedRounds ?? 0) > 0) candidates.push({ ...current, delayedRounds: 0 });
  for (const candidate of candidates) {
    if (predicate(simulateCbc(candidate))) current = candidate;
  }
  return current;
}

export function analyzeFragility(result: CbcResult): FragilityReport {
  const replay = replayCbc(result.scenario);
  const invariants = evaluateInvariants(result, replay);
  const counterexamples: Counterexample[] = [];

  for (const item of invariants.filter((entry) => !entry.satisfied)) {
    const minimalReplay = shrinkScenario(result.scenario, (candidate) => {
      if (item.invariant === "REPLAY_DETERMINISM") return candidate.replayDigest !== replayCbc(candidate).replayDigest;
      if (item.invariant === "EQUIVOCATION_DETECTION") return (candidate.scenario.equivocations ?? 0) !== candidate.equivocations.length;
      if (item.invariant === "BASELINE_CONVERGENCE") return candidate.result !== "CONVERGED" || !candidate.fixedPoint;
      return candidate.scenario.partition !== undefined && candidate.evidence.justificationGraph.length === 0;
    });
    const minimal = simulateCbc(minimalReplay);
    const failedRound = minimal.convergenceHistory.find((entry) => entry.rejected.length > 0 || entry.accepted.length === 0)?.round ?? 1;
    const conflictCore = minimal.convergenceHistory.flatMap((entry) => entry.rejected).slice(0, 8);
    counterexamples.push({
      invariant: item.invariant,
      failedRound,
      cause: item.observation,
      precondition: JSON.stringify(minimalReplay),
      transition: minimal.convergenceHistory[failedRound - 1] ? JSON.stringify(minimal.convergenceHistory[failedRound - 1]) : "no convergence transition recorded",
      conflictCore,
      minimalReplay,
      replayDigest: minimal.replayDigest,
    });
  }

  return {
    scenario: result.scenario,
    invariants,
    counterexamples,
    digest: digest([JSON.stringify({ scenario: result.scenario, invariants, counterexamples })]),
  };
}