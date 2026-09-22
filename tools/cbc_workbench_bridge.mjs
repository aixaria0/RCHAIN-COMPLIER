#!/usr/bin/env node
/** Real cross-repository transfer of the pinned M27 report into RLSenti.
 *
 * Digest verification checks accidental edits, not the identity of the
 * producer. The bounded source-reported Finalizer observation is not a
 * deployed-network vulnerability or an independent finality proof.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";

const EXPECTED_CBC = "2d2c3d879b1a078693c8551385efb54a811d7172";
const EXPECTED_WORKBENCH = "46a38c443e5904d7d485519d8ea348a442c010c1";

export function canonicalJson(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  if (value && typeof value === "object") {
    return "{" + Object.keys(value).sort().map((key) =>
      JSON.stringify(key) + ":" + canonicalJson(value[key])).join(",") + "}";
  }
  throw new Error("Non-JSON value cannot enter witness transport");
}

export function hexSha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function param(args, name) {
  const index = args.indexOf(name);
  if (index < 0 || index + 1 >= args.length) throw new Error("Missing " + name);
  return resolve(args[index + 1]);
}

function checkoutSha(folder, expected, label) {
  const sha = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: folder, encoding: "utf8", timeout: 20000,
  }).trim();
  assert.equal(sha, expected, "Incorrect source pin: " + label);
  return sha;
}

export async function runBridge(cbcDir, workbenchDir, outDir) {
  checkoutSha(cbcDir, EXPECTED_CBC, "cbc");
  const workbenchSha = checkoutSha(workbenchDir, EXPECTED_WORKBENCH, "workbench");
  const { runM27ReachabilityConstrainedSearch } = await import(pathToFileURL(
    join(cbcDir, "src/lib/cbc/casper-reachable-adversarial-history-search.ts")
  ).href);
  const { receiveCbcWitness, verifyCbcWorkbenchReceipt } = await import(pathToFileURL(
    join(workbenchDir, "src/lib/compiler/cbc-witness-adapter.ts")
  ).href);
  const report = runM27ReachabilityConstrainedSearch();
  assert.equal(report.milestone, "M27");
  assert.equal(report.deterministic, true);
  assert.equal(report.minimalFinalizingDistance, 1);
  assert.ok(report.minimalFinalizingWitnesses.length > 0);
  const body = {
    schema: "aria-cbc-witness/v1",
    source: {
      repository: "aixaria0/RCHAIN-COMPLIER",
      commit: EXPECTED_CBC,
      upstreamRevision: report.upstreamRevision,
    },
    report,
  };
  const witness = { ...body, payloadSha256: hexSha256(canonicalJson(body)) };
  const receipt = receiveCbcWitness(witness);
  assert.equal(receipt.transport.payloadSha256, witness.payloadSha256);
  assert.equal(receipt.source.commit, EXPECTED_CBC);
  assert.equal(receipt.provenance.sourceReportDigest, report.digest);
  assert.equal(receipt.transport.authenticatedProducer, false);
  assert.equal(receipt.witness.sourceReportedFinalized, true);
  assert.equal(verifyCbcWorkbenchReceipt(receipt), true);
  // Reject transport modification and receipt modification *using the actual M27 report*.
  const tampered = structuredClone(witness);
  tampered.report.minimalFinalizingWitnesses[0].justifications[0] = "z3";
  assert.throws(() => receiveCbcWitness(tampered), /digest mismatch/);
  const edited = structuredClone(receipt);
  edited.witness.sourceReportedFinalized = false;
  assert.equal(verifyCbcWorkbenchReceipt(edited), false);
  await mkdir(outDir, { recursive: true });
  const manifest = {
    schema: "aria-cbc-cross-repo-bridge/v1",
    sourceCbcSha: EXPECTED_CBC,
    sourceWorkbenchSha: workbenchSha,
    upstreamRevision: report.upstreamRevision,
    reportDigest: report.digest,
    transportDigest: witness.payloadSha256,
    workbenchReceiptDigest: receipt.provenance.workbenchReceiptDigest,
    sourceReportedReachable: receipt.witness.sourceReportedReachable,
    sourceReportedFinalized: receipt.witness.sourceReportedFinalized,
    authenticatedProducer: false,
    independentlyVerifiedCasperFinality: false,
    liveNetwork: false,
    evidenceKind: "source-reported-bounded-witness-transport-integrity",
    claimBoundary: receipt.claimBoundary,
  };
  await writeFile(join(outDir, "cbc-m27-witness.json"), JSON.stringify(witness, null, 2) + "\n");
  await writeFile(join(outDir, "rlsenti-witness-receipt.json"), JSON.stringify(receipt, null, 2) + "\n");
  await writeFile(join(outDir, "bridge-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  return manifest;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  try {
    const [, , ...args] = process.argv;
    const report = await runBridge(param(args, "--cbc-dir"),
      param(args, "--workbench-dir"), param(args, "--out-dir"));
    console.log(JSON.stringify({
      bridge: "PASSED",
      cbcSource: report.sourceCbcSha,
      rlsentiSource: report.sourceWorkbenchSha,
      transportDigest: report.transportDigest,
      receiptDigest: report.workbenchReceiptDigest,
      semanticClaims: "SOURCE_REPORTED_ONLY",
    }));
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
