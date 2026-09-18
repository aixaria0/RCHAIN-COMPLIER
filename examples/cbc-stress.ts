import { analyzeFragility } from "../src/lib/cbc/fragility-engine.ts";
import { replayCbc, simulateCbc, type CbcScenario } from "../src/lib/cbc/cbc-simulator.ts";

const scenarios: CbcScenario[] = [
  { name: "baseline-4", validators: 4, byzantine: 0 },
  { name: "partition-16-16", validators: 32, byzantine: 0, partition: 16, delayedRounds: 2 },
  { name: "partition-reorder", validators: 8, byzantine: 0, partition: 4, delayedRounds: 1, reorder: true },
  { name: "equivocation-4", validators: 8, byzantine: 4, equivocations: 4 },
];

for (const scenario of scenarios) {
  const first = simulateCbc(scenario);
  const replay = replayCbc(scenario);
  const report = analyzeFragility(first);
  console.log([
    "Scenario: " + scenario.name,
    "Validators: " + scenario.validators,
    "Equivocations: " + first.equivocations.length,
    "Convergence rounds: " + first.convergenceRounds,
    "Replay: " + (first.replayDigest === replay.replayDigest ? "deterministic" : "DIVERGENT"),
    "Fragility invariants: " + report.invariants.filter((item) => item.satisfied).length + "/" + report.invariants.length + " satisfied",
    "Counterexamples: " + report.counterexamples.length,
    "Result: " + first.result,
    "Report digest: " + report.digest,
    "Replay digest: " + first.replayDigest,
    "",
  ].join("\n"));
}