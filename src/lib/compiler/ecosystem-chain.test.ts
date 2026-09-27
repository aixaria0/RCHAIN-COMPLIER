import assert from "node:assert/strict";
import test from "node:test";
import { runTamperMatrix, sha256Artifact, validateEcosystemChain, type CausalAssuranceEcosystemManifest } from "./ecosystem-chain.ts";

function fixture(): CausalAssuranceEcosystemManifest {
  const possibility = sha256Artifact("minimum-witness");
  const observation = sha256Artifact("observed:" + possibility);
  const workbench = sha256Artifact("view:" + possibility + ":" + observation);
  const attestation = sha256Artifact("attest:" + workbench);
  return {
    schema: "causal-assurance-ecosystem/v1",
    runId: "fixture-001",
    subject: { kind: "finite-state-model", id: "dual-refinement-fixture" },
    artifacts: {
      possibility: { producer: "RCHAIN-COMPLIER", schema: "verification-artifact/v1", digest: possibility, status: "PASS" },
      observation: { producer: "rchain-sentinel", schema: "causal-assurance-evidence/v1", digest: observation, status: "PASS", bindsTo: [possibility] },
      workbench: { producer: "rlsenti", schema: "assurance-workbench/v1", digest: workbench, status: "PASS", bindsTo: [possibility, observation] },
      attestation: { producer: "Sovereign-Lattice", schema: "causal-assurance-attestation/v1", digest: attestation, status: "PASS", bindsTo: [workbench] },
    },
  };
}

test("accepts a complete four-repository digest chain", () => {
  assert.equal(validateEcosystemChain(fixture()).status, "PASS");
});

test("fails closed if a cross-repository binding is tampered", () => {
  const manifest = fixture();
  manifest.artifacts.observation.bindsTo = [sha256Artifact("tampered")];
  assert.equal(validateEcosystemChain(manifest).status, "BLOCKED");
});

test("fails closed if any stage is not PASS", () => {
  const manifest = fixture();
  manifest.artifacts.workbench.status = "BLOCKED";
  assert.equal(validateEcosystemChain(manifest).status, "BLOCKED");
});

test("every declared cross-repository tamper boundary fails closed", () => {
  const results = runTamperMatrix(fixture());
  assert.deepEqual(
    results.map((result) => result.boundary),
    ["POSSIBILITY_DIGEST", "OBSERVATION_BINDING", "WORKBENCH_BINDING", "ATTESTATION_BINDING", "PROVENANCE_TRUST"],
  );
  assert.ok(results.every((result) => result.observed === "BLOCKED"));
});
