import { buildConcreteDAG, traceConcreteDAG } from "../src/lib/cbc/casper-concrete-dag.ts";
console.log(JSON.stringify(traceConcreteDAG(buildConcreteDAG()), null, 2));
