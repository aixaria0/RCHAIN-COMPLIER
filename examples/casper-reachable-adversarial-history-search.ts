import { runM27ReachabilityConstrainedSearch } from "../src/lib/cbc/casper-reachable-adversarial-history-search.ts";

const report = runM27ReachabilityConstrainedSearch();

console.log("M27 candidate count: " + report.searchSpace.candidateCount);
console.log("Reachability-valid candidates: " + report.searchSpace.reachableCount);
console.log("Current count-gate candidates: " + report.searchSpace.currentCountGateCount);
console.log("Sender-complete candidates: " + report.searchSpace.senderCompleteCount);
console.log("Under-cardinality candidates: " + report.searchSpace.underCardinalityCount);
console.log("Exactly-three-sender candidates: " + report.searchSpace.exactlyThreeSenderCount);
console.log("Minimum adversarial distance: " + report.minimalAdversarialDistance);
console.log("Minimum finalizing distance: " + report.minimalFinalizingDistance);
console.log("");
console.log("Minimal witnesses:");
for (const witness of report.minimalWitnesses.slice(0, 4)) {
  console.log(
    [
      witness.justifications.join(","),
      "senders=" + witness.minimumMessageSenders.join(","),
      "countGate=" + witness.currentCountGate,
      "senderCoverage=" + witness.senderCoverage,
      "finalized=" + witness.finalized,
    ].join(" | "),
  );
}
console.log("");
console.log("M27 deterministic: " + report.deterministic);
console.log("M27 report digest: " + report.digest);
