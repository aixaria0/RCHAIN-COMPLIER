#!/usr/bin/env node
/** Produce an identical, pinned M27-derived sender-input fixture for four real
 * Rust Finalizer check_min_messages probes. The reduced local DAG is distinct
 * from the causally-valid full M27 research fixture and from live RNode ingress.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";

const EXPECTED_CBC = "2d2c3d879b1a078693c8551385efb54a811d7172";
const UPSTREAM = "rchain-community/rchain-rust@d92f0787a6096cd6d79864ec2d7c1dd9b6912d0b";
function canonical(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean" ||
      (typeof value === "number" && Number.isFinite(value))) return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (typeof value === "object" && value) return "{" +
    Object.keys(value).sort().map((k) => JSON.stringify(k) + ":" + canonical(value[k])).join(",") + "}";
  throw new Error("Unsupported comparison input");
}
const digest = (value) => createHash("sha256").update(value, "utf8").digest("hex");
export async function makeFixture(sourceDir) {
  const commit = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: sourceDir, encoding: "utf8", timeout: 20_000,
  }).trim();
  assert.equal(commit, EXPECTED_CBC, "M27 fixture producer is not at the pinned SHA");
  const { runM27ReachabilityConstrainedSearch } = await import(pathToFileURL(
    join(sourceDir, "src/lib/cbc/casper-reachable-adversarial-history-search.ts")
  ).href);
  const report = runM27ReachabilityConstrainedSearch();
  assert.equal(report.milestone, "M27");
  assert.equal(report.upstreamRevision, UPSTREAM);
  assert.equal(report.deterministic, true);
  assert.equal(report.minimalFinalizingDistance, 1);
  const witness = report.minimalFinalizingWitnesses[0];
  assert.ok(witness);
  assert.equal(witness.reachable, true);
  assert.equal(witness.finalized, true);
  assert.equal(witness.classification, "UNDER_CARDINALITY");
  assert.equal(witness.distanceFromControl, 1);
  assert.equal(witness.distinctMinimumSenders, 3);
  assert.equal(witness.currentCountGate, true);
  assert.equal(witness.senderCoverage, false);
  assert.equal(witness.justifications.length, 4);
  assert.equal(witness.minimumMessageSenders.length, 4);
  const labels = witness.minimumMessageSenders;
  assert.ok(labels.every((id) => /^v[0-3]$/.test(id)));
  assert.equal(new Set(labels).size, 3);
  assert.equal(labels.filter((id, i) => id !== ["v0", "v1", "v2", "v3"][i]).length, 1);
  const body = {
    schema: "aria-cbc-four-implementation-input/v1",
    source: { repository: "aixaria0/RCHAIN-COMPLIER", commit, upstreamRevision: UPSTREAM },
    sourceReportDigest: report.digest,
    caseId: "m27-first-minimal-finalizing-under-cardinality-sender-shape",
    justifications: witness.justifications,
    senderIds: labels,
    bondedStake: { v0: 70, v1: 10, v2: 10, v3: 10 },
    scope: "M27 sender labels transplanted into identical REDUCED four-message local DAG in each implementation; not an M27 DAG reproduction, ingress proof, live node observation, or protocol safety result.",
  };
  return { ...body, payloadSha256: digest(canonical(body)) };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  try {
    const args = process.argv;
    const sourceIndex = args.indexOf("--source-dir");
    const outIndex = args.indexOf("--output");
    if (sourceIndex < 0 || outIndex < 0 || !args[sourceIndex + 1] || !args[outIndex + 1])
      throw new Error("Usage: --source-dir PINNED_M27_REPOSITORY --output FILE");
    const report = await makeFixture(resolve(args[sourceIndex + 1]));
    const out = resolve(args[outIndex + 1]);
    await mkdir(resolve(out, ".."), { recursive: true });
    await writeFile(out, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify({
      result: "M27_DERIVED_SENDER_INPUT_READY", sourceCommit: report.source.commit,
      inputSha256: report.payloadSha256, senderIds: report.senderIds,
      boundary: "REDUCED_GATE_FIXTURE_NOT_FULL_M27_DAG",
    }));
  } catch (error) { console.error(error); process.exitCode = 1; }
}
