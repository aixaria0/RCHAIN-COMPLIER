import { runM26Replay } from "../src/lib/cbc/casper-cbc-upstream-replay.ts";

const report = runM26Replay();

for (const entry of report.cases) {
  console.log([
    "Scenario: " + entry.name,
    "Stress result: " + entry.stress.result,
    "Equivocations detected: " + entry.stress.equivocationsDetected,
    "Events: " + entry.stress.eventCount,
    "Convergence rounds: " + entry.stress.convergenceRounds,
    "Replay digest: " + entry.stress.replayDigest,
    "Upstream pairing: " + entry.upstreamPairing.relationship,
    "Claim boundary: " + entry.upstreamPairing.claimBoundary,
    "",
  ].join("\n"));
}

console.log("Upstream boundary matrix:");
for (const entry of report.upstreamGateMatrix) {
  console.log(
    [
      entry.name,
      "count-gate=" + entry.currentCountGate,
      "shadow-sender-gate=" + entry.shadowDistinctSenderGate,
    ].join(" | "),
  );
}

console.log("M26 deterministic: " + report.deterministic);
console.log("M26 report digest: " + report.digest);
