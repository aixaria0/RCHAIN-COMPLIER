#!/usr/bin/env node
/** Fail-closed final evidence gate: four source-test records plus the actual
 * M27 -> RLSenti -> Sentinel -> Sovereign-Lattice correlated handoff.
 * Content hashes are reproducibility identifiers, not source authentication.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

export const EXPECTED = {
  cbc: "2d2c3d879b1a078693c8551385efb54a811d7172",
  workbench: "00e1ed1b30a1779f72c59c0505467da60080a365",
  sentinel: "7823bac56f8dd845d9b9f9e7c50982b49decdcc2",
  lattice: "03259325d33a89e523b0ba83d55dd32f42ae4101",
};
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const readJson = async (name) => JSON.parse(await readFile(name, "utf8"));
const shaFile = async (name) => hash(await readFile(name));

export async function verifyFourRepoBundle(bundleFile, bridgeDir) {
  const bundleBytes = await readFile(bundleFile);
  const bundle = JSON.parse(bundleBytes.toString("utf8"));
  assert.equal(bundle.schema, "aria-four-repo-bundle/v1");
  assert.equal(bundle.components_passed, 4);
  assert.equal(bundle.entries?.length, 4);
  for (const [component, expected] of Object.entries(EXPECTED)) {
    const entry = bundle.entries.find((record) => record.component === component);
    assert.ok(entry, "Missing source-test component " + component);
    assert.equal(entry.source_sha, expected);
    assert.equal(entry.exit_code, 0);
    assert.equal(entry.interoperability_verified, false);
    assert.equal(entry.live_network, false);
  }
  assert.equal(new Set(bundle.entries.map((item) => item.component)).size, 4);
  const report = await readJson(join(bridgeDir, "cbc-four-repo-handoff.json"));
  const { recordSha256, ...body } = report;
  assert.equal(recordSha256, hash(JSON.stringify(body)), "Forged handoff record digest");
  assert.equal(report.schema, "aria-cbc-four-repo-handoff/v1");
  assert.equal(report.cbcSourceSha, EXPECTED.cbc);
  assert.equal(report.sentinelSourceSha, EXPECTED.sentinel);
  assert.equal(report.latticeSourceSha, EXPECTED.lattice);
  assert.equal(report.workbenchSourceSha, "46a38c443e5904d7d485519d8ea348a442c010c1");
  const bridgeManifest = await readJson(join(bridgeDir, "bridge-manifest.json"));
  const witness = await readJson(join(bridgeDir, "cbc-m27-witness.json"));
  const workbench = await readJson(join(bridgeDir, "rlsenti-witness-receipt.json"));
  const sentinel = await readJson(join(bridgeDir, "sentinel-witness-observation.json"));
  const control = await readJson(join(bridgeDir, "lattice-pbft-control.json"));
  const threeSource = await readFile(join(bridgeDir, "cbc-three-source-transport.json"));
  assert.equal(report.threeSourceRecordSha256, hash(threeSource));
  assert.equal(report.pbftControlJsonSha256, await shaFile(join(bridgeDir, "lattice-pbft-control.json")));
  assert.equal(report.latticeSourceCargoLockSha256, await shaFile(join(bridgeDir, "lattice-source-Cargo.lock")));
  assert.equal(report.latticeEffectiveCargoLockSha256, await shaFile(join(bridgeDir, "lattice-effective-Cargo.lock")));
  assert.equal(report.witnessTransportSha256, witness.payloadSha256);
  assert.equal(bridgeManifest.transportDigest, witness.payloadSha256);
  assert.equal(workbench.transport.payloadSha256, witness.payloadSha256);
  assert.equal(sentinel.transport_digest, witness.payloadSha256);
  assert.equal(control.externalWitnessSha256, witness.payloadSha256);
  assert.deepEqual(control.senderLabels, workbench.witness.senderIds);
  assert.deepEqual(control.senderLabels, sentinel.reported_sender_ids);
  assert.deepEqual(control.senderLabels,
    witness.report.minimalFinalizingWitnesses[0].minimumMessageSenders);
  assert.equal(control.oneReplacementFromControl, true);
  assert.equal(control.distinctSenderCount, 3);
  assert.equal(control.pbftQuorumSize, 3);
  assert.equal(control.pbftTopologyAccepted, true);
  assert.equal(control.pbftTruncatedFrameRejected, true);
  assert.equal(control.pbftInvalidPhaseRejected, true);
  assert.equal(control.evidenceKind, "INDEPENDENT_PBFT_CONTROL_ONLY");
  assert.equal(report.controlProtocol, "PBFT_DIFFERENT_FROM_CASPER_CBC");
  for (const flag of [
    workbench.transport.authenticatedProducer,
    sentinel.producer_authenticated,
    sentinel.independently_verified_finality,
    sentinel.live_network,
    control.cbcFinalityVerified,
    control.pbftCertificateVerified,
    control.liveNetwork,
    report.independentlyVerifiedCasperFinality,
    report.authenticatedProducer,
    report.liveNetwork,
  ]) assert.equal(flag, false, "Evidence must not elevate unverified claim");
  const selected = witness.report.minimalFinalizingWitnesses[0];
  assert.equal(selected.justifications.length, 4, "M27 report must contain four tuple slots");
  assert.equal(selected.minimumMessageSenders.length, 4);
  const senderById = { a3: "v0", b3: "v1", c3: "v2", d3: "v3" };
  for (let i = 0; i < 4; i++) {
    assert.equal(senderById[selected.justifications[i]], selected.minimumMessageSenders[i],
      "M27 source-report message identity must match sender label");
  }
  const uniqueSelectedIds = new Set(selected.justifications).size;
  const selectedFourDistinctIdsRepresentable = uniqueSelectedIds === 4;
  const final = {
    schema: "aria-verified-four-repo-evidence/v1",
    sourceTestBundleSha256: hash(bundleBytes),
    fourSourceHandoffRecordSha256: report.recordSha256,
    witnessTransportSha256: witness.payloadSha256,
    sourceRevisions: {
      cbc: report.cbcSourceSha,
      rlsenti: report.workbenchSourceSha,
      sentinel: report.sentinelSourceSha,
      lattice: report.latticeSourceSha,
    },
    sourceTestsPassed: 4,
    externalWitnessConsumers: 3,
    selectedM27MessageIds: [...selected.justifications],
    selectedM27UniqueMessageIds: uniqueSelectedIds,
    selectedM27FourDistinctIdsRepresentable: selectedFourDistinctIdsRepresentable,
    selectedM27RealFinalizerFinalityIndependentlyReplayed: false,
    firstSemanticDivergence: selectedFourDistinctIdsRepresentable
      ? "No identical-ID collapse observed; real full-DAG replay remains unverified."
      : "M27's four ordered tuple slots contain repeated identical message IDs. The actual Rust Finalizer takes a BTreeSet of unique Message identities; the selected four-slot modeled candidate cannot directly become four distinct justifications.",
    independentProtocols: ["Casper CBC research observation", "PBFT control"],
    liveNetwork: false,
    independentlyVerifiedCasperFinality: false,
    claimBoundary: "Four pinned source test suites and an offline source-reported M27 handoff are verified. The first selected modeled tuple repeats the same message ID and is not yet a four-distinct-ID Rust Finalizer replay; no independent finality or live RNode result is established. Sovereign-Lattice executes a separate PBFT control only.",
  };
  return final;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  try {
    const args = process.argv;
    const i = args.indexOf("--bundle");
    const j = args.indexOf("--bridge-dir");
    const k = args.indexOf("--output");
    if (i < 0 || j < 0 || k < 0 || !args[i + 1] || !args[j + 1] || !args[k + 1])
      throw new Error("Expected --bundle FILE --bridge-dir DIR --output FILE");
    const result = await verifyFourRepoBundle(resolve(args[i + 1]), resolve(args[j + 1]));
    await writeFile(resolve(args[k + 1]), JSON.stringify(result, null, 2) + "\n");
    console.log(JSON.stringify({ result: "VERIFIED_FOUR_SOURCE_EVIDENCE_BUNDLE",
      witnessDigest: result.witnessTransportSha256, actualSourceSuites: result.sourceTestsPassed,
      sourceEvidenceConsumers: result.externalWitnessConsumers, liveNetwork: false }));
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
