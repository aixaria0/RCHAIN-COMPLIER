#!/usr/bin/env node
/** Execute Sovereign-Lattice PBFT control against the actual M27 witness ID.
 *
 * This is cross-repository evidence correlation, never cross-protocol finality
 * verification: the external CBC sender labels are NOT PBFT votes/signatures.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const EXPECTED_LATTICE = "03259325d33a89e523b0ba83d55dd32f42ae4101";
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
async function json(path) { return JSON.parse(await readFile(path, "utf8")); }

function parameter(name) {
  const i = process.argv.indexOf(name);
  if (i < 0 || !process.argv[i + 1]) throw new Error("Missing " + name);
  return resolve(process.argv[i + 1]);
}

export async function runLatticeControl(latticeDir, evidenceDir) {
  const gitSha = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: latticeDir, encoding: "utf8", timeout: 20_000,
  }).trim();
  assert.equal(gitSha, EXPECTED_LATTICE, "Incorrect Sovereign-Lattice source revision");
  const manifest = await json(join(evidenceDir, "bridge-manifest.json"));
  const witness = await json(join(evidenceDir, "cbc-m27-witness.json"));
  const workbench = await json(join(evidenceDir, "rlsenti-witness-receipt.json"));
  const sentinel = await json(join(evidenceDir, "sentinel-witness-observation.json"));
  const threeSource = await readFile(join(evidenceDir, "cbc-three-source-transport.json"));
  const three = JSON.parse(threeSource.toString("utf8"));
  assert.equal(three.schema, "aria-cbc-three-source-transport/v1");
  assert.equal(manifest.schema, "aria-cbc-cross-repo-bridge/v1");
  assert.equal(witness.schema, "aria-cbc-witness/v1");
  assert.equal(workbench.schema, "aria-cbc-workbench-receipt/v1");
  assert.equal(sentinel.schema, "aria-sentinel-cbc-observation/v1");
  assert.equal(three.witnessTransportDigest, witness.payloadSha256);
  assert.equal(manifest.transportDigest, witness.payloadSha256);
  assert.equal(workbench.transport.payloadSha256, witness.payloadSha256);
  assert.equal(sentinel.transport_digest, witness.payloadSha256);
  assert.equal(three.sourceReportDigest, witness.report.digest);
  assert.equal(three.workbenchReceiptDigest, workbench.provenance.workbenchReceiptDigest);
  assert.equal(three.sentinelObservationSha256,
    sha256(await readFile(join(evidenceDir, "sentinel-witness-observation.json"))));
  assert.equal(three.independentlyVerifiedFinality, false);
  assert.equal(three.liveNetwork, false);
  assert.equal(three.authenticatedProducer, false);
  const senderIds = workbench.witness.senderIds;
  assert.deepEqual(senderIds, sentinel.reported_sender_ids);
  assert.deepEqual(senderIds,
    witness.report.minimalFinalizingWitnesses[0].minimumMessageSenders);
  assert.equal(senderIds.length, 4);
  assert.ok(senderIds.every((id) => /^v[0-3]$/.test(id)));
  const controlCsv = senderIds.join(",");
  const originalLock = await readFile(join(latticeDir, "rust_engine/Cargo.lock"));
  await writeFile(join(evidenceDir, "lattice-source-Cargo.lock"), originalLock);
  const command = [
    "run", "--manifest-path", join(latticeDir, "rust_engine/Cargo.toml"),
    "--bin", "pbft_external_control", "--", witness.payloadSha256, controlCsv,
  ];
  const binaryOutput = execFileSync("cargo", command, {
    cwd: latticeDir, encoding: "utf8", timeout: 900_000,
    maxBuffer: 2_000_000,
  });
  const control = JSON.parse(binaryOutput);
  assert.equal(control.schema, "aria-independent-pbft-control/v1");
  assert.equal(control.externalWitnessSha256, witness.payloadSha256);
  assert.deepEqual(control.senderLabels, senderIds);
  assert.equal(control.distinctSenderCount, 3);
  assert.equal(control.oneReplacementFromControl, true);
  assert.equal(control.allFourDistinct, false);
  assert.equal(control.pbftQuorumSize, 3);
  assert.equal(control.pbftTopologyAccepted, true);
  assert.equal(control.pbftTruncatedFrameRejected, true);
  assert.equal(control.pbftInvalidPhaseRejected, true);
  assert.equal(control.cbcFinalityVerified, false);
  assert.equal(control.pbftCertificateVerified, false);
  assert.equal(control.liveNetwork, false);
  assert.equal(control.evidenceKind, "INDEPENDENT_PBFT_CONTROL_ONLY");
  const effectiveLock = await readFile(join(latticeDir, "rust_engine/Cargo.lock"));
  await writeFile(join(evidenceDir, "lattice-effective-Cargo.lock"), effectiveLock);
  await writeFile(join(evidenceDir, "lattice-pbft-control.json"), binaryOutput);
  const body = {
    schema: "aria-cbc-four-repo-handoff/v1",
    cbcSourceSha: three.cbcSourceSha,
    workbenchSourceSha: three.workbenchSourceSha,
    sentinelSourceSha: three.sentinelSourceSha,
    latticeSourceSha: gitSha,
    witnessTransportSha256: witness.payloadSha256,
    upstreamRevision: sentinel.upstream_revision,
    threeSourceRecordSha256: sha256(threeSource),
    pbftControlJsonSha256: sha256(binaryOutput),
    latticeSourceCargoLockSha256: sha256(originalLock),
    latticeEffectiveCargoLockSha256: sha256(effectiveLock),
    sourceReportedBoundedFinalization: true,
    independentlyVerifiedCasperFinality: false,
    authenticatedProducer: false,
    liveNetwork: false,
    controlProtocol: "PBFT_DIFFERENT_FROM_CASPER_CBC",
    claimBoundary:
      "Four pinned source trees share a single offline witness correlation. PBFT tests its own topology, distinct identities and malformed frames; it does not validate the external Casper witness as a PBFT certificate or prove Casper finality.",
  };
  const full = { ...body, recordSha256: sha256(JSON.stringify(body)) };
  await writeFile(join(evidenceDir, "cbc-four-repo-handoff.json"),
    JSON.stringify(full, null, 2) + "\n");
  return full;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  try {
    const receipt = await runLatticeControl(parameter("--lattice-dir"),
      parameter("--evidence-dir"));
    console.log(JSON.stringify({
      result: "FOUR_PINNED_SOURCES_CONNECTED_BY_EVIDENCE_ID",
      cbcSourceSha: receipt.cbcSourceSha,
      rlsentiSourceSha: receipt.workbenchSourceSha,
      sentinelSourceSha: receipt.sentinelSourceSha,
      latticeSourceSha: receipt.latticeSourceSha,
      witnessDigest: receipt.witnessTransportSha256,
      pbftIsCasperOracle: false,
    }));
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
