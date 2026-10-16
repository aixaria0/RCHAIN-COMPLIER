import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { AssuranceEngine, initializeEngine } from "./engine.ts";
import { verifyEvidence } from "./package.ts";
import { loadRegistry, loadState } from "./runtime.ts";
import { digestCxpRun } from "../integrations/quantum-cxp.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const verifierModule = join(here, "..", "integrations", "quantum-cxp.mjs");
const fixturePath = join(here, "..", "..", "..", "examples", "quantum-cxp", "chimera-run-v2.json");
const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));

function workload(input: unknown) {
  return {
    schema: "assurance-workload/v1" as const,
    domain: "quantum",
    operation: "quantum-cxp/v1",
    predicate: "cxp-contract-valid",
    input: input as never,
    value: true,
  };
}

test(
  "real Quantum001 CXP is reproduced by two independent assurance verifier identities",
  { timeout: 30000 },
  async () => {
    const root = mkdtempSync(join(tmpdir(), "quantum-cxp-assurance-"));
    let engine: AssuranceEngine | undefined;
    try {
      assert.equal(digestCxpRun(fixture), fixture.cxp_sha256);
      initializeEngine(root, { verifierModule });
      engine = await AssuranceEngine.open(root);
      assert.equal(new Set(engine.processIds).size, 3);

      const result = await engine.run(workload(fixture));
      assert.equal(result.report.status, "PASS");
      assert.equal(result.report.code, "VERIFIED");
      assert.equal(result.report.operation, "quantum-cxp/v1");
      assert.equal(result.report.verifierActorIds.length, 2);
      assert.equal(new Set(result.report.verifierActorIds).size, 2);

      const reviewer = verifyEvidence(result.evidence, {
        ...result.context,
        registry: await loadRegistry(loadState(root)),
      });
      assert.equal(reviewer.status, "PASS");
      assert.deepEqual(reviewer.verifierActorIds, result.report.verifierActorIds);

      const promotedClaim = structuredClone(fixture);
      promotedClaim.claims[0].status = "TRUE";
      promotedClaim.cxp_sha256 = digestCxpRun(promotedClaim);
      const rejectedClaim = await engine.run(workload(promotedClaim));
      assert.equal(rejectedClaim.report.status, "FAIL");
      assert.equal(rejectedClaim.report.code, "CLAIM_REFUTED");

      const promotedTruth = structuredClone(fixture);
      promotedTruth.authority.external_truth = "CONFIRMED";
      promotedTruth.verification.external_truth = "CONFIRMED";
      promotedTruth.cxp_sha256 = digestCxpRun(promotedTruth);
      const rejectedTruth = await engine.run(workload(promotedTruth));
      assert.equal(rejectedTruth.report.status, "FAIL");
      assert.equal(rejectedTruth.report.code, "CLAIM_REFUTED");
    } finally {
      await engine?.close();
      rmSync(root, { recursive: true, force: true });
    }
  },
);
