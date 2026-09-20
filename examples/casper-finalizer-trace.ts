import { defaultStakeMatrix } from "../src/lib/cbc/casper-stake-matrix.ts";
import { traceCasperFinalizerObservation } from "../src/lib/cbc/casper-finalizer-observation.ts";

const matrixCase = defaultStakeMatrix().find((entry) => entry.name === "high-stake-incomplete-coverage")!;

const trace = traceCasperFinalizerObservation({
  bondsMap: matrixCase.bonds,
  minimumMessageSenders: matrixCase.minimumMessageSenders,
  supportObservers: {
    v0: ["v0", "v1", "v2", "v3"],
  },
});

console.log(JSON.stringify({
  support: trace.support,
  supportingStake: trace.supportingStake,
  totalStake: trace.totalStake,
  superMajority: trace.superMajority,
  messageCoverage: trace.messageCoverage,
  missingBondedValidators: trace.missingBondedValidators,
  observationDigest: trace.observationDigest,
}, null, 2));
