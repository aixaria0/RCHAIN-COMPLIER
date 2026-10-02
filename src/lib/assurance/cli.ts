#!/usr/bin/env node
import { mkdirSync, writeFileSync, renameSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { initializeEngine, AssuranceEngine, type RunResult } from "./engine.ts";
import { loadState, loadRegistry, readBounded } from "./runtime.ts";
import { AssuranceError } from "./errors.ts";
import {
  MAX_PACKAGE_BYTES,
  verifyEvidence,
  type VerificationContext,
  type VerificationReport,
} from "./package.ts";
import { validateWorkload } from "./submission.ts";
import { canonical, exact, policyDigest, type Json } from "../lattice/protocol.ts";
import { EventJournal } from "../lattice/journal.ts";

const HELP = `RCHAIN-COMPLIER Assurance Engine
Usage:
  assurance init DIRECTORY [core|rchain] [TRUSTED_VERIFIER_MODULE]
  assurance run DIRECTORY WORKLOAD.json OUTPUT_PREFIX
  assurance verify PACKAGE.ndjson TRUST.json [OPERATOR_DIRECTORY]
  assurance status DIRECTORY
  assurance serve DIRECTORY
  assurance demo [OUTPUT_DIRECTORY]
Exit codes: 0 PASS/success, 1 FAIL, 2 BLOCKED, 3 operational/input error.
Requires Node >=22.18.0. Loopback-only; operator verifier modules are trusted local code.
`;

function atomicWrite(file: string, bytes: Uint8Array | string) {
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.${process.pid}.tmp`;
  writeFileSync(temporary, bytes, { mode: 0o600, flag: "wx" });
  renameSync(temporary, file);
}
function saveResult(prefix: string, result: RunResult) {
  atomicWrite(prefix + ".evidence.ndjson", result.evidence);
  atomicWrite(
    prefix + ".trust.json",
    canonical({ schema: "assurance-review-context/v1", ...result.context }),
  );
  atomicWrite(prefix + ".report.json", canonical(result.report));
}
function output(value: unknown) {
  process.stdout.write(JSON.stringify(value) + "\n");
}
function log(value: unknown) {
  process.stderr.write(
    JSON.stringify({ schema: "assurance-diagnostic/v1", ...(value as object) }) + "\n",
  );
}
function exitReport(report: VerificationReport) {
  output(report);
  return report.status === "PASS" ? 0 : report.status === "FAIL" ? 1 : 2;
}
function trustFile(file: string): VerificationContext {
  const value = exact(JSON.parse(readBounded(file, 16384).toString("utf8")), [
    "schema",
    "expectedPolicyDigest",
    "expectedTaskId",
    "expectedClaimId",
    "expectedPackageDigest",
  ]);
  if (value.schema !== "assurance-review-context/v1")
    throw new AssuranceError("INVALID_INPUT", "Unsupported review context");
  const { schema: _schema, ...context } = value;
  return context as unknown as VerificationContext;
}

async function managedRun(directory: string, input: unknown, prefix: string) {
  const engine = await AssuranceEngine.open(directory, { onDiagnostic: log });
  try {
    const result = await engine.run(validateWorkload(input));
    saveResult(resolve(prefix), result);
    return result;
  } finally {
    await engine.close();
  }
}

export async function main(args: string[]): Promise<number> {
  const [command, ...rest] = args;
  if (!command || ["help", "--help", "-h"].includes(command)) {
    process.stdout.write(HELP);
    return 0;
  }
  if (command === "--version") {
    output({ product: "RCHAIN-COMPLIER", version: "0.3.0" });
    return 0;
  }
  if (command === "init" && rest.length >= 1 && rest.length <= 3) {
    const integration = rest[1] ?? "core";
    if (integration !== "core" && integration !== "rchain")
      throw new AssuranceError("INVALID_INPUT", "Unknown integration");
    const state = initializeEngine(resolve(rest[0]!), { integration, verifierModule: rest[2] });
    output({
      schema: state.schema,
      directory: resolve(rest[0]!),
      policyDigest: policyDigest(state.policy),
      integration,
    });
    return 0;
  }
  if (command === "run" && rest.length === 3) {
    const input: unknown = JSON.parse(readBounded(rest[1]!, 16384).toString("utf8"));
    return exitReport((await managedRun(rest[0]!, input, rest[2]!)).report);
  }
  if (command === "verify" && (rest.length === 2 || rest.length === 3)) {
    const registry = rest[2] ? await loadRegistry(loadState(rest[2])) : undefined;
    return exitReport(
      verifyEvidence(readBounded(rest[0]!, MAX_PACKAGE_BYTES), {
        ...trustFile(rest[1]!),
        registry,
      }),
    );
  }
  if (command === "status" && rest.length === 1) {
    const directory = resolve(rest[0]!),
      state = loadState(directory),
      registry = await loadRegistry(state);
    const journals = [0, 1, 2].map((index) => {
      const journal = new EventJournal(
        join(directory, `journal-${index}`),
        state.policy,
        4096,
        registry,
      );
      try {
        const view = journal.view();
        return {
          actorId: state.policy.members[index]!.actorId,
          eventCount: view.eventCount,
          eventRoot: view.eventRoot,
          pending: view.pending.length,
          blocked: view.blocked.length,
          equivocations: view.equivocations.length,
          capacity: 4096,
        };
      } finally {
        journal.close();
      }
    });
    output({ schema: "assurance-status/v1", policyDigest: policyDigest(state.policy), journals });
    return 0;
  }
  if (command === "serve" && rest.length === 1) {
    const engine = await AssuranceEngine.open(rest[0]!, { onDiagnostic: log });
    output({
      schema: "assurance-service/v1",
      endpoints: engine.endpoints,
      policyDigest: policyDigest(engine.state.policy),
    });
    try {
      await new Promise<void>((res) => {
        process.once("SIGTERM", res);
        process.once("SIGINT", res);
      });
    } finally {
      await engine.close();
    }
    return 0;
  }
  if (command === "demo" && rest.length <= 1) {
    const directory = resolve(rest[0] ?? "artifacts/assurance-demo"),
      workspace = join(directory, "engine");
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    // Fresh demo directories are explicit: useful evidence is never removed implicitly.
    initializeEngine(workspace);
    const workload = validateWorkload({
      schema: "assurance-workload/v1",
      domain: "arithmetic",
      operation: "integer-sum/v1",
      predicate: "integer-sum",
      input: { schema: "integer-sum-input/v1", values: [2, 3, 5] },
      value: 10,
    });
    atomicWrite(join(directory, "workload.json"), canonical(workload));
    const first = await managedRun(workspace, workload, join(directory, "sample"));
    const recovered = await managedRun(workspace, workload, join(directory, "recovered"));
    const tampered = Buffer.from(first.evidence);
    const signature = tampered.indexOf('"signatureHex":"') + '"signatureHex":"'.length;
    tampered[signature] = tampered[signature] === 48 ? 49 : 48;
    atomicWrite(join(directory, "tampered.evidence.ndjson"), tampered);
    const tamper = verifyEvidence(tampered, first.context);
    const signatureCheck = verifyEvidence(tampered, {
      ...first.context,
      expectedPackageDigest: undefined,
    });
    const negative = await managedRun(
      workspace,
      { ...workload, value: 11 },
      join(directory, "negative"),
    );
    const checks = {
      threeProcesses: first.report.verifierActorIds.length === 2,
      pass: first.report.status === "PASS",
      restartIdempotent: first.report.packageDigest === recovered.report.packageDigest,
      tamperRejected: tamper.status === "FAIL",
      signatureTamperRejected: signatureCheck.status === "FAIL",
      negativeRefuted:
        negative.report.status === "FAIL" && negative.report.code === "CLAIM_REFUTED",
    };
    const summary: Json = {
      schema: "assurance-demo/v1",
      checks,
      outputDirectory: directory,
      report: first.report as unknown as Json,
    };
    atomicWrite(join(directory, "demo.json"), canonical(summary));
    output(summary);
    return Object.values(checks).every(Boolean) ? 0 : 1;
  }
  throw new AssuranceError("INVALID_INPUT", "Invalid arguments; use assurance --help");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = await main(process.argv.slice(2));
  } catch (cause) {
    output({
      schema: "assurance-error/v1",
      status: "BLOCKED",
      code: cause instanceof AssuranceError ? cause.code : "IO_ERROR",
      reason: cause instanceof Error ? cause.message : "Operation failed",
    });
    process.exitCode = 3;
  }
}
