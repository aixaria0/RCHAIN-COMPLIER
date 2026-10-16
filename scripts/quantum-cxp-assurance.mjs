#!/usr/bin/env node
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import { AssuranceEngine, initializeEngine } from "../src/lib/assurance/engine.ts";
import { verifyEvidence } from "../src/lib/assurance/package.ts";
import { loadRegistry, loadState } from "../src/lib/assurance/runtime.ts";

function fail(message, code = 2) {
  process.stderr.write(`${JSON.stringify({ schema: "quantum-cxp-assurance-error/v1", status: "REJECTED", error: message })}\n`);
  process.exit(code);
}

const args = process.argv.slice(2);
if (args.length !== 2) fail("usage: quantum-cxp-assurance.mjs <chimera-run-v2.json> <output-dir>");

const [inputArg, outputArg] = args;
const inputPath = resolve(inputArg);
const outputDir = resolve(outputArg);
const runtimeDir = join(outputDir, "runtime");
const here = dirname(fileURLToPath(import.meta.url));
const verifierModule = resolve(here, "../src/lib/integrations/quantum-cxp.mjs");
let engine;

try {
  const run = JSON.parse(readFileSync(inputPath, "utf8"));
  mkdirSync(outputDir, { recursive: true });
  initializeEngine(runtimeDir, { verifierModule });
  engine = await AssuranceEngine.open(runtimeDir);

  const result = await engine.run({
    schema: "assurance-workload/v1",
    domain: "quantum",
    operation: "quantum-cxp/v1",
    predicate: "cxp-contract-valid",
    input: run,
    value: true,
  });

  const reviewer = verifyEvidence(result.evidence, {
    ...result.context,
    registry: await loadRegistry(loadState(runtimeDir)),
  });

  const processIds = engine.processIds;
  const distinctProcesses = new Set(processIds).size;
  const verifierIds = result.report.verifierActorIds;
  const distinctVerifiers = new Set(verifierIds).size;
  const valid =
    result.report.status === "PASS" &&
    result.report.code === "VERIFIED" &&
    reviewer.status === "PASS" &&
    verifierIds.length === 2 &&
    distinctVerifiers === 2 &&
    processIds.length === 3 &&
    distinctProcesses === 3;

  const summary = {
    schema: "quantum-cxp-assurance-run/v1",
    status: valid ? "PASS" : "BLOCKED",
    scope: "DETACHED_CXP_CONTRACT_REPRODUCTION_WITH_THREE_LOCAL_PROCESSES",
    operation: "quantum-cxp/v1",
    cxpSha256: run.cxp_sha256,
    processIds,
    distinctProcesses,
    verifierActorIds: verifierIds,
    distinctVerifiers,
    reportStatus: result.report.status,
    reportCode: result.report.code,
    reviewerStatus: reviewer.status,
    limitations: [
      "Three local processes do not establish host or organizational independence.",
      "This assurance run does not execute the quantum workload or establish QPU execution.",
      "External truth remains outside this verifier scope.",
    ],
  };

  writeFileSync(join(outputDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  writeFileSync(join(outputDir, "report.json"), `${JSON.stringify(result.report, null, 2)}\n`);
  writeFileSync(join(outputDir, "reviewer-report.json"), `${JSON.stringify(reviewer, null, 2)}\n`);
  writeFileSync(join(outputDir, "context.json"), `${JSON.stringify(result.context, null, 2)}\n`);
  if (typeof result.evidence === "string") {
    writeFileSync(join(outputDir, "evidence.ndjson"), result.evidence);
  } else {
    writeFileSync(join(outputDir, "evidence.json"), `${JSON.stringify(result.evidence, null, 2)}\n`);
  }

  process.stdout.write(`${JSON.stringify(summary)}\n`);
  if (!valid) process.exitCode = 1;
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
} finally {
  await engine?.close();
  rmSync(runtimeDir, { recursive: true, force: true });
}
