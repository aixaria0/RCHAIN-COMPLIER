import { buildConcreteDAG, buildCausallyValidDAG } from "../src/lib/cbc/casper-concrete-dag.ts";
import { analyzeUpstreamReachability } from "../src/lib/cbc/casper-upstream-reachability.ts";
import { traceCasperFinalizerSemantics } from "../src/lib/cbc/casper-finalizer-semantics.ts";

for (const [name, fixture] of [
  ["semantic-9-message", buildConcreteDAG()],
  ["causally-valid-13-message", buildCausallyValidDAG()],
] as const) {
  console.log(JSON.stringify({
    name,
    reachability: analyzeUpstreamReachability(fixture),
    finalizer: traceCasperFinalizerSemantics(fixture),
  }, null, 2));
}
