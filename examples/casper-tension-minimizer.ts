import { minimizeTensionObservation } from "../src/lib/cbc/casper-tension-minimizer.ts";

const result = minimizeTensionObservation({
  bondsMap: { v0: 70, v1: 10, v2: 10, v3: 10 },
  minimumMessageSenders: ["v0"],
  supportObservers: { v0: ["v0", "v1", "v2", "v3"] },
});

console.log(JSON.stringify({
  original: {
    validators: Object.keys(result.original.bondsMap).length,
    supportingStake: result.original.supportingStake,
    totalStake: result.original.totalStake,
    messageCoverage: result.original.messageCoverage,
    digest: result.original.observationDigest,
  },
  minimized: {
    validators: Object.keys(result.minimized.bondsMap).length,
    bonds: result.minimized.bondsMap,
    support: result.minimized.support,
    minimumMessageSenders: result.minimized.minimumMessageSenders,
    supportingStake: result.minimized.supportingStake,
    totalStake: result.minimized.totalStake,
    messageCoverage: result.minimized.messageCoverage,
    digest: result.minimized.observationDigest,
  },
  removedValidators: result.removedValidators,
  preservedPredicate: result.preservedPredicate,
}, null, 2));
