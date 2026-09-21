import { buildConcreteDAG } from "../src/lib/cbc/casper-concrete-dag.ts";
import { searchFinalizingMutation } from "../src/lib/cbc/casper-adversarial-search.ts";

const result = searchFinalizingMutation(buildConcreteDAG());

console.log(JSON.stringify({
  baseline: result.baseline,
  candidate: result.candidateTrace,
  mutationCount: result.mutationCount,
  lowerBound: result.lowerBound,
  minimalWithinMutationModel: result.minimalWithinMutationModel,
  mutations: result.mutations,
}, null, 2));
