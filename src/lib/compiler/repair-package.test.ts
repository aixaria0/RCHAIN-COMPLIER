import assert from "node:assert/strict";
import test from "node:test";
import { generateKeyPairSync } from "node:crypto";
import { buildDuplicateMinimumMessageDAG } from "../cbc/casper-concrete-dag.ts";
import {
  createCasperCoverageProblem,
  createCasperCoverageVerificationAdapter,
  repairCasperDuplicateMinimumSenderCoverage,
} from "../cbc/casper-repair-adapter.ts";
import { compileVerification } from "./verification-compiler.ts";
import {
  createRepairPackage,
  verifyRepairPackage,
} from "./repair-package.ts";
import {
  canonicalRepairPackageRoot,
  signRepairPackageRoot,
  verifySignedRepairRoot,
} from "./signed-repair-root.ts";

function fixture() {
  const originalProblem = createCasperCoverageProblem(
    buildDuplicateMinimumMessageDAG(),
  );
  const original = compileVerification(originalProblem, [
    createCasperCoverageVerificationAdapter(),
  ]);
  const repaired = repairCasperDuplicateMinimumSenderCoverage();

  assert.equal(original.status, "COMPILED");
  assert.ok(original.artifact);
  assert.equal(original.artifact.outcome, "WITNESS_FOUND");
  assert.equal(repaired.status, "COMPILED");
  assert.ok(repaired.artifact);
  assert.equal(repaired.artifact.outcome, "REPAIR_FOUND");
  assert.ok(repaired.artifact.postRepairVerification);

  return createRepairPackage(
    "cbc-repair-fixture-001",
    "rchain-rust-finalizer:duplicate-minimum-sender-coverage",
    original.artifact,
    repaired.artifact,
    repaired.artifact.postRepairVerification,
  );
}

function privateKeyPem() {
  return generateKeyPairSync("ed25519")
    .privateKey.export({ type: "pkcs8", format: "pem" })
    .toString();
}

test("CBC repair package independently binds original witness, repair, and post-repair verification", () => {
  const pkg = fixture();
  const result = verifyRepairPackage(pkg);
  assert.equal(result.valid, true);
  assert.equal(result.recomputedDigests.length, 3);
});

test("repair package rejects claim weakening even when digests are recomputed", () => {
  const pkg = fixture();
  const post = JSON.parse(pkg.artifacts[2]!.bytes);
  post.scope = { weakened: true };
  pkg.artifacts[2]!.bytes = JSON.stringify(post);

  const { sha256Artifact } = await import("./ecosystem-chain.ts");
  pkg.artifacts[2]!.sha256 = sha256Artifact(pkg.artifacts[2]!.bytes);

  const result = verifyRepairPackage(pkg);
  assert.equal(result.valid, false);
  assert.match(result.reason, /scope changed/);
});

test("repair package rejects post-repair artifact substitution", () => {
  const pkg = fixture();
  const post = JSON.parse(pkg.artifacts[2]!.bytes);
  post.outcome = "INCONCLUSIVE";
  pkg.artifacts[2]!.bytes = JSON.stringify(post);

  const result = verifyRepairPackage(pkg);
  assert.equal(result.valid, false);
});

test("signed repair root is deterministic and requires an externally pinned Ed25519 key id", () => {
  const pkg = fixture();
  const signed = signRepairPackageRoot(pkg, privateKeyPem());
  assert.equal(canonicalRepairPackageRoot(pkg), canonicalRepairPackageRoot(pkg));
  assert.equal(verifySignedRepairRoot(pkg, signed, signed.keyId), true);

  const other = signRepairPackageRoot(pkg, privateKeyPem());
  assert.notEqual(other.keyId, signed.keyId);
  assert.equal(verifySignedRepairRoot(pkg, signed, other.keyId), false);
});

test("tampered repair bytes invalidate the signed root", () => {
  const pkg = fixture();
  const signed = signRepairPackageRoot(pkg, privateKeyPem());
  pkg.artifacts[1]!.bytes += "tampered";
  assert.equal(verifySignedRepairRoot(pkg, signed, signed.keyId), false);
});
