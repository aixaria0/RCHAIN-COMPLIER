import { compileRealityRecord } from "../src/lib/compiler/reality-record-adapter.ts";

const baseline = compileRealityRecord("exchange-commit", "none");
const adversarial = compileRealityRecord("exchange-commit", "tamper-trace");

console.log("=== BASELINE REALITY RECORD ===");
console.log(JSON.stringify(baseline, null, 2));
console.log();
console.log("=== ADVERSARIAL REALITY RECORD ===");
console.log(JSON.stringify(adversarial, null, 2));
