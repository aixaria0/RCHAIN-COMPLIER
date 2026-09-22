#!/usr/bin/env node
/** Independently bind a real offline Sentinel Rust observation to the M27 -> RLSenti receipt. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const EXPECTED_SENTINEL = "7823bac56f8dd845d9b9f9e7c50982b49decdcc2";
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
function argument(name) {
  const index = process.argv.indexOf(name);
  if (index < 0 || index + 1 >= process.argv.length) throw new Error("Missing " + name);
  return resolve(process.argv[index + 1]);
}
async function readJson(path) { return JSON.parse(await readFile(path, "utf8")); }
export async function check(sentinelDir, evidenceDir) {
  const sentinelCommit = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: sentinelDir, encoding: "utf8", timeout: 20000,
  }).trim();
  assert.equal(sentinelCommit, EXPECTED_SENTINEL);
  const manifest = await readJson(join(evidenceDir, "bridge-manifest.json"));
  const witness = await readJson(join(evidenceDir, "cbc-m27-witness.json"));
  const receipt = await readJson(join(evidenceDir, "rlsenti-witness-receipt.json"));
  const observedBytes = await readFile(join(evidenceDir, "sentinel-witness-observation.json"));
  const observation = JSON.parse(observedBytes.toString("utf8"));
  assert.equal(manifest.schema, "aria-cbc-cross-repo-bridge/v1");
  assert.equal(manifest.transportDigest, witness.payloadSha256);
  assert.equal(manifest.workbenchReceiptDigest, receipt.provenance.workbenchReceiptDigest);
  assert.equal(manifest.reportDigest, witness.report.digest);
  assert.equal(manifest.sourceCbcSha, receipt.source.commit);
  assert.equal(observation.schema, "aria-sentinel-cbc-observation/v1");
  assert.equal(observation.transport_digest, witness.payloadSha256);
  assert.equal(observation.source_report_digest, witness.report.digest);
  assert.equal(observation.source_revision, receipt.source.commit);
  assert.equal(observation.upstream_revision, receipt.source.upstreamRevision);
  assert.deepEqual(observation.justification_ids, receipt.witness.justificationIds);
  assert.deepEqual(observation.reported_sender_ids, receipt.witness.senderIds);
  assert.equal(observation.reported_minimum_distance, receipt.witness.distanceFromControl);
  assert.equal(observation.source_reported_finalized, receipt.witness.sourceReportedFinalized);
  assert.equal(observation.source_reported_reachable, receipt.witness.sourceReportedReachable);
  assert.equal(observation.integrity_checked, true);
  assert.equal(observation.producer_authenticated, false);
  assert.equal(observation.independently_verified_finality, false);
  assert.equal(observation.live_network, false);
  assert.equal(observation.evidence_class, "EXTERNAL_RESEARCH_REPORT_INTEGRITY_ONLY");
  const sourceLock = await readFile(join(evidenceDir, "sentinel-source-Cargo.lock"));
  const effectiveLock = await readFile(join(evidenceDir, "sentinel-effective-Cargo.lock"));
  const record = {
    schema: "aria-cbc-three-source-transport/v1",
    cbcSourceSha: manifest.sourceCbcSha,
    workbenchSourceSha: manifest.sourceWorkbenchSha,
    sentinelSourceSha: sentinelCommit,
    sourceReportDigest: manifest.reportDigest,
    witnessTransportDigest: witness.payloadSha256,
    workbenchReceiptDigest: receipt.provenance.workbenchReceiptDigest,
    sentinelObservationSha256: sha(observedBytes),
    sourceCargoLockSha256: sha(sourceLock),
    effectiveCargoLockSha256: sha(effectiveLock),
    cargoLockModified: !sourceLock.equals(effectiveLock),
    independentlyVerifiedFinality: false,
    liveNetwork: false,
    authenticatedProducer: false,
    claimBoundary: "Three-source, revision-pinned transport and structure comparison only; source-reported bounded witness is not independent Casper finality validation, an upstream fix, or deployed-network exploit evidence.",
  };
  await writeFile(join(evidenceDir, "cbc-three-source-transport.json"),
    JSON.stringify(record, null, 2) + "\n");
  return record;
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  try {
    const result = await check(argument("--sentinel-dir"), argument("--evidence-dir"));
    console.log(JSON.stringify({
      result: "MATCHED_TRANSPORT_AND_WITNESS_SHAPE",
      cbcSha: result.cbcSourceSha,
      rlsentiSha: result.workbenchSourceSha,
      sentinelSha: result.sentinelSourceSha,
      payloadSha256: result.witnessTransportDigest,
      independentFinalityProof: false,
    }));
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
