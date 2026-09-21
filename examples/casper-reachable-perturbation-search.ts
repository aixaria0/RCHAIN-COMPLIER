import { buildCausallyValidDAG } from "../src/lib/cbc/casper-concrete-dag.ts";
import { searchReachableFinalizationFlip } from "../src/lib/cbc/casper-reachable-perturbation-search.ts";

const results = searchReachableFinalizationFlip(buildCausallyValidDAG());
console.log(JSON.stringify(results.map((result) => ({
  mutation: result.mutation,
  reachability: result.reachability,
  baselineFinalized: result.baseline.finalized,
  candidateFinalized: result.candidateTrace.finalized,
  candidateSupportingStake: result.candidateTrace.supportingStake,
  candidateSupporters: result.candidateTrace.fullPartitionSupportSenders,
})), null, 2));
