import { repairCasperDuplicateMinimumSenderCoverage } from "../src/lib/cbc/casper-repair-adapter.ts";

const result = repairCasperDuplicateMinimumSenderCoverage();
console.log(JSON.stringify(result, null, 2));
