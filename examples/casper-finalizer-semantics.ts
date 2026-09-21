import { buildConcreteDAG } from "../src/lib/cbc/casper-concrete-dag.ts";
import { traceCasperFinalizerSemantics } from "../src/lib/cbc/casper-finalizer-semantics.ts";

const trace = traceCasperFinalizerSemantics(buildConcreteDAG());
console.log(JSON.stringify(trace, null, 2));
