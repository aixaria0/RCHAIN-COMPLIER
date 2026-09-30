import { compileVerification } from "../src/lib/compiler/verification-compiler.ts";
import {
  QUANTUMOS_MATCHING_RHOLANG_FIXTURE,
  createQuantumOsClosureAdapter,
  createQuantumOsClosureProblem,
} from "../src/lib/subjects/quantumos.ts";

const clean = compileVerification(
  createQuantumOsClosureProblem(QUANTUMOS_MATCHING_RHOLANG_FIXTURE),
  [createQuantumOsClosureAdapter()],
);

const divergent = structuredClone(QUANTUMOS_MATCHING_RHOLANG_FIXTURE);
divergent.closure.id = "demo-rholang-divergence";
divergent.perspectives[1]!.postStateHash = "state:divergent";

const rejected = compileVerification(
  createQuantumOsClosureProblem(divergent),
  [createQuantumOsClosureAdapter()],
);

console.log(
  JSON.stringify(
    {
      matchingPerspectives: clean,
      divergentPerspectives: rejected,
    },
    null,
    2,
  ),
);
