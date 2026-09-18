import { replayCbcStressScenario, runCbcStressScenario } from "../src/lib/compiler/cbc-stress.ts";

const scenario = {
  id: "patrick-first-stress",
  validators: [
    { id: "v-a", stake: 10 },
    { id: "v-b", stake: 10 },
    { id: "v-c", stake: 10 },
    { id: "v-d", stake: 10 },
  ],
  rounds: 3,
  fault: "partition+equivocation" as const,
  partition: [["v-a", "v-b"], ["v-c", "v-d"]],
  equivocation: { source: "v-a", claims: ["block-A", "block-B"] },
};

const report = runCbcStressScenario(scenario);

console.log("=== Casper CBC Stress Lab ===");
console.log(`scenario: ${report.scenarioId}`);
console.log(`model: ${report.modelBoundary}`);
console.log("");
console.log("metrics:");
console.log(JSON.stringify(report.metrics, null, 2));
console.log("");
console.log("fragilities:");
for (const item of report.fragilities) console.log(`- ${item}`);
console.log("");
console.log("improvement hypotheses:");
for (const item of report.improvementHypotheses) console.log(`- ${item}`);
console.log("");
console.log(`replay stable: ${replayCbcStressScenario(scenario)}`);
console.log(`replay digest: ${report.replayDigest}`);
