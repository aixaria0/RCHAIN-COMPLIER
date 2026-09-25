import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXPECTED, verifyFourRepoBundle } from "../../tools/verify_four_repo_handoff.mjs";

const sha = (value) => createHash("sha256").update(value).digest("hex");
async function writeJson(path, value) {
  await writeFile(path, JSON.stringify(value, null, 2) + "\n");
}
async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), "aria-four-sources-"));
  const bridgeDir = join(dir, "bridge");
  await mkdir(bridgeDir);
  const bundle = {
    schema: "aria-four-repo-bundle/v1",
    components_passed: 4,
    entries: Object.entries(EXPECTED).map(([component, source_sha]) => ({
      component, source_sha, exit_code: 0, interoperability_verified: false, live_network: false,
    })),
  };
  const bundleFile = join(dir, "four-repo-bundle.json");
  await writeJson(bundleFile, bundle);
  const digest = "a".repeat(64);
  const senderIds = ["v0", "v0", "v2", "v3"];
  const witness = {
    payloadSha256: digest,
    report: {
      digest: "b".repeat(64),
      minimalFinalizingWitnesses: [{ justifications: ["a3", "a3", "c3", "d3"], minimumMessageSenders: senderIds }],
    },
  };
  const three = {
    cbcSourceSha: EXPECTED.cbc,
    workbenchSourceSha: "46a38c443e5904d7d485519d8ea348a442c010c1",
    sentinelSourceSha: EXPECTED.sentinel,
  };
  const control = {
    schema: "aria-independent-pbft-control/v1",
    externalWitnessSha256: digest,
    senderLabels: senderIds,
    distinctSenderCount: 3,
    oneReplacementFromControl: true,
    allFourDistinct: false,
    pbftQuorumSize: 3,
    pbftTopologyAccepted: true,
    pbftTruncatedFrameRejected: true,
    pbftInvalidPhaseRejected: true,
    cbcFinalityVerified: false,
    pbftCertificateVerified: false,
    liveNetwork: false,
    evidenceKind: "INDEPENDENT_PBFT_CONTROL_ONLY",
  };
  await writeJson(join(bridgeDir, "bridge-manifest.json"), { transportDigest: digest });
  await writeJson(join(bridgeDir, "cbc-m27-witness.json"), witness);
  await writeJson(join(bridgeDir, "rlsenti-witness-receipt.json"), {
    transport: { payloadSha256: digest, authenticatedProducer: false },
    witness: { senderIds },
  });
  await writeJson(join(bridgeDir, "sentinel-witness-observation.json"), {
    transport_digest: digest, reported_sender_ids: senderIds,
    producer_authenticated: false, independently_verified_finality: false, live_network: false,
  });
  await writeJson(join(bridgeDir, "lattice-pbft-control.json"), control);
  const threeSourcePath = join(bridgeDir, "cbc-three-source-transport.json");
  await writeJson(threeSourcePath, three);
  const sourceLock = join(bridgeDir, "lattice-source-Cargo.lock");
  const effectiveLock = join(bridgeDir, "lattice-effective-Cargo.lock");
  await writeFile(sourceLock, "source-lock");
  await writeFile(effectiveLock, "effective-lock");
  const body = {
    schema: "aria-cbc-four-repo-handoff/v1",
    cbcSourceSha: EXPECTED.cbc,
    workbenchSourceSha: three.workbenchSourceSha,
    sentinelSourceSha: EXPECTED.sentinel,
    latticeSourceSha: EXPECTED.lattice,
    threeSourceRecordSha256: sha(await readFile(threeSourcePath)),
    pbftControlJsonSha256: sha(await readFile(join(bridgeDir, "lattice-pbft-control.json"))),
    latticeSourceCargoLockSha256: sha(await readFile(sourceLock)),
    latticeEffectiveCargoLockSha256: sha(await readFile(effectiveLock)),
    witnessTransportSha256: digest,
    controlProtocol: "PBFT_DIFFERENT_FROM_CASPER_CBC",
    independentlyVerifiedCasperFinality: false,
    authenticatedProducer: false,
    liveNetwork: false,
  };
  await writeJson(join(bridgeDir, "cbc-four-repo-handoff.json"), {
    ...body, recordSha256: sha(JSON.stringify(body)),
  });
  return { dir, bridgeDir, bundleFile, control };
}

test("four-source bound evidence passes only with all four sources and explicit limits", async () => {
  const f = await fixture();
  try {
    const result = await verifyFourRepoBundle(f.bundleFile, f.bridgeDir);
    assert.equal(result.sourceTestsPassed, 4);
    assert.equal(result.externalWitnessConsumers, 3);
    assert.deepEqual(result.selectedM27MessageIds, ["a3", "a3", "c3", "d3"]);
    assert.equal(result.selectedM27UniqueMessageIds, 3);
    assert.equal(result.selectedM27FourDistinctIdsRepresentable, false);
    assert.equal(result.selectedM27RealFinalizerFinalityIndependentlyReplayed, false);
    assert.equal(result.independentlyVerifiedCasperFinality, false);
    assert.equal(result.liveNetwork, false);
  } finally { await rm(f.dir, { recursive: true, force: true }); }
});

test("missing Sovereign-Lattice test evidence fails closed", async () => {
  const f = await fixture();
  try {
    const bundle = JSON.parse(await readFile(f.bundleFile, "utf8"));
    bundle.entries = bundle.entries.filter((x) => x.component !== "lattice");
    bundle.components_passed = 3;
    await writeJson(f.bundleFile, bundle);
    await assert.rejects(verifyFourRepoBundle(f.bundleFile, f.bridgeDir));
  } finally { await rm(f.dir, { recursive: true, force: true }); }
});

test("tampered PBFT receipt fails even if the JSON remains valid", async () => {
  const f = await fixture();
  try {
    f.control.cbcFinalityVerified = true;
    await writeJson(join(f.bridgeDir, "lattice-pbft-control.json"), f.control);
    await assert.rejects(verifyFourRepoBundle(f.bundleFile, f.bridgeDir));
  } finally { await rm(f.dir, { recursive: true, force: true }); }
});

test("re-sealed fourth receipt with altered source pin fails", async () => {
  const f = await fixture();
  try {
    const file = join(f.bridgeDir, "cbc-four-repo-handoff.json");
    const value = JSON.parse(await readFile(file, "utf8"));
    value.latticeSourceSha = "f".repeat(40);
    const { recordSha256: _old, ...body } = value;
    value.recordSha256 = sha(JSON.stringify(body));
    await writeJson(file, value);
    await assert.rejects(verifyFourRepoBundle(f.bundleFile, f.bridgeDir));
  } finally { await rm(f.dir, { recursive: true, force: true }); }
});
