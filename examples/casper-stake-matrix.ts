import { defaultStakeMatrix, runStakeMatrix } from "../src/lib/cbc/casper-stake-matrix.ts";

for (const result of runStakeMatrix(defaultStakeMatrix())) {
  console.log(JSON.stringify({
    scenario: result.name,
    totalStake: result.totalStake,
    supportingStake: result.supportingStake,
    superMajority: result.superMajority,
    messageCoverage: result.messageCoverage,
    missingBondedValidators: result.missingBondedValidators,
    hypothesis: result.hypothesis,
    digest: result.digest,
  }));
}
