import { buildDuplicateMinimumMessageDAG } from "../src/lib/cbc/casper-concrete-dag.ts";
import { analyzeUpstreamReachability } from "../src/lib/cbc/casper-upstream-reachability.ts";
import { traceCasperFinalizerSemantics } from "../src/lib/cbc/casper-finalizer-semantics.ts";

const fixture = buildDuplicateMinimumMessageDAG();
console.log(JSON.stringify({
  reachability: analyzeUpstreamReachability(fixture),
  finalizer: traceCasperFinalizerSemantics(fixture),
}, null, 2));
