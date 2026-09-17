import {
  detectEquivocation,
  incompatible,
  proposition,
  selectMaximallyConsistentPropositions,
  type RealityBet,
} from "../src/lib/compiler/index.ts";

const propositions = [
  proposition("transaction t occurs before s", "p-order-1"),
  incompatible("transaction s occurs before t", "p-order-2", ["p-order-1"]),
  proposition("transaction r is independent", "p-independent"),
];

const result = selectMaximallyConsistentPropositions(propositions);

const bets: RealityBet[] = [
  {
    source: "validator-A",
    target: "cycle-42",
    claim: "block-hash-A",
    belief: 0.82,
    justification: ["j-observation-1", "j-replay-1"],
  },
  {
    source: "validator-A",
    target: "cycle-42",
    claim: "block-hash-B",
    belief: 0.81,
    justification: ["j-observation-2"],
  },
  {
    source: "validator-B",
    target: "cycle-42",
    claim: "block-hash-A",
    belief: 0.91,
    justification: ["j-observation-1"],
  },
];

console.log(JSON.stringify({
  accepted: result.accepted,
  rejected: result.rejected,
  trace: result.trace,
  fixedPoint: result.fixedPoint,
  judgement: result.judgement,
  equivocation: detectEquivocation(bets),
}, null, 2));
