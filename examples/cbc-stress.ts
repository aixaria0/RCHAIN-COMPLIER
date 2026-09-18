import { replayCbc, simulateCbc, type CbcScenario } from "../src/lib/cbc/cbc-simulator.ts";

const scenarios: CbcScenario[] = [
  { name: "baseline-4", validators: 4, byzantine: 0 },
  { name: "partition-16-16", validators: 32, byzantine: 0, partition: 16, delayedRounds: 2 },
  { name: "equivocation-4", validators: 8, byzantine: 4, equivocations: 4 },
];

for (const scenario of scenarios) {
  const first = simulateCbc(scenario);
  const replay = replayCbc(scenario);
  console.log([
    `Scenario: ${scenario.name}`,
    `Validators: ${scenario.validators}`,
    `Equivocations: ${first.equivocations.length}`,
    `Convergence rounds: ${first.convergenceRounds}`,
    `Replay: ${first.replayDigest === replay.replayDigest ? "deterministic" : "DIVERGENT"}`,
    "",
    `Result: ${first.result}`,
    "",
    "Evidence:",
    "- justification graph",
    "- proposition trace",
    `- replay digest: ${first.replayDigest}`,
    "- convergence history",
    "",
  ].join("\n"));
}
