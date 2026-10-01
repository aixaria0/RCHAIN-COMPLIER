import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { evaluateAttestationCandidates } from "../src/lib/lattice/rchain-attestation-pair.ts";

export async function runPairedAttestationEvaluation() {
  return evaluateAttestationCandidates();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const report = await runPairedAttestationEvaluation(),
    outputPath = process.argv[2];
  if (outputPath) await writeFile(outputPath, JSON.stringify(report, null, 2) + "\n");
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
}
