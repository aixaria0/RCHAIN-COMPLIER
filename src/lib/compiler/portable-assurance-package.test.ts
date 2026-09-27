import assert from "node:assert/strict";
import test from "node:test";
import { sha256Artifact } from "./ecosystem-chain.ts";
import { PORTABLE_ASSURANCE_PACKAGE_SCHEMA, verifyPortableAssurancePackage, type PortableAssurancePackage } from "./portable-assurance-package.ts";
import { CROSS_REPO_FIXTURE_V1 } from "./cross-repo-fixture.ts";

function fixture(): PortableAssurancePackage {
  const bytes = [
    CROSS_REPO_FIXTURE_V1,
    "evidence:v1\nsource=rchain-sentinel\n",
    "workbench:v1\nverdict=BLOCKED\n",
    "attestation:v1\ndecision=ABSTAINED\n",
  ];
  const digests = bytes.map(sha256Artifact);
  return {
    schema: PORTABLE_ASSURANCE_PACKAGE_SCHEMA,
    runId: "fixture-001",
    subject: "finite-state-model:dual-refinement-fixture",
    artifacts: [
      { role: "WITNESS", bytes: bytes[0], sha256: digests[0], bindsTo: [] },
      { role: "EVIDENCE", bytes: bytes[1], sha256: digests[1], bindsTo: [digests[0]] },
      { role: "WORKBENCH", bytes: bytes[2], sha256: digests[2], bindsTo: [digests[0], digests[1]] },
      { role: "ATTESTATION", bytes: bytes[3], sha256: digests[3], bindsTo: [digests[0], digests[1], digests[2]] },
    ],
  };
}

test("independent verifier recomputes every portable package digest and binding", () => {
  assert.equal(verifyPortableAssurancePackage(fixture()).valid, true);
});

for (const index of [0, 1, 2, 3]) {
  test(`tampered raw bytes at artifact ${index} fail closed`, () => {
    const pkg = fixture();
    pkg.artifacts[index].bytes += "tampered";
    const result = verifyPortableAssurancePackage(pkg);
    assert.equal(result.valid, false);
    assert.match(result.reason, /digest mismatch/);
  });
}

test("rebinding a valid artifact to the wrong predecessor fails closed", () => {
  const pkg = fixture();
  pkg.artifacts[3].bindsTo[1] = pkg.artifacts[0].sha256;
  const result = verifyPortableAssurancePackage(pkg);
  assert.equal(result.valid, false);
  assert.match(result.reason, /binding mismatch/);
});

test("base portable package is valid without reviewer attestation", () => {
  const pkg = fixture();
  pkg.artifacts = pkg.artifacts.slice(0, 3);
  const result = verifyPortableAssurancePackage(pkg);
  assert.equal(result.valid, true);
  assert.equal(result.recomputedDigests.length, 3);
});

test("portable package rejects any artifact after the single optional attestation", () => {
  const pkg = fixture();
  pkg.artifacts.push({ ...pkg.artifacts[3]!, bindsTo: [...pkg.artifacts[3]!.bindsTo] });
  assert.equal(verifyPortableAssurancePackage(pkg).valid, false);
});
