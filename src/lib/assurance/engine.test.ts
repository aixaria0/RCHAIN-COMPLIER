import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { AssuranceEngine, initializeEngine } from "./engine.ts";
import { validateWorkload } from "./submission.ts";
import { verifyEvidence } from "./package.ts";
import { loadState, loadRegistry } from "./runtime.ts";

const workload = validateWorkload({
  schema: "assurance-workload/v1",
  domain: "arithmetic",
  operation: "integer-sum/v1",
  predicate: "integer-sum",
  input: { schema: "integer-sum-input/v1", values: [2, 3, 5] },
  value: 10,
});

test(
  "three-process reusable engine has bounded submission, durable restart/rejoin and independent verification",
  { timeout: 20000 },
  async () => {
    const root = mkdtempSync(join(tmpdir(), "assurance-engine-"));
    let engine: AssuranceEngine | undefined;
    try {
      initializeEngine(root);
      engine = await AssuranceEngine.open(root);
      assert.equal(new Set(engine.processIds).size, 3);
      await assert.rejects(() => AssuranceEngine.open(root), { code: "BUSY" });
      const running = engine.run(workload);
      await assert.rejects(() => engine!.run(workload), { code: "BUSY" });
      const first = await running;
      assert.equal(first.report.status, "PASS");
      assert.equal(verifyEvidence(first.evidence, first.context).status, "PASS");
      const previousPids = engine.processIds;
      process.kill(previousPids[0]!, "SIGKILL");
      await engine.recover();
      assert.ok(engine.processIds.every((pid) => !previousPids.includes(pid)));
      const recovered = await engine.run(workload);
      assert.deepEqual(recovered.evidence, first.evidence);
      await Promise.all([engine.close(), engine.close()]);
      engine = await AssuranceEngine.open(root);
      assert.deepEqual((await engine.run(workload)).evidence, first.evidence);
      const unknown = await engine.run({ ...workload, operation: "unknown/v1" });
      assert.equal(unknown.report.status, "BLOCKED");
      assert.equal((await engine.run(workload)).report.status, "PASS");
      assert.equal((await engine.run({ ...workload, value: 11 })).report.code, "CLAIM_REFUTED");
      await assert.rejects(() => engine!.run(workload, 0), { code: "INVALID_INPUT" });
    } finally {
      await engine?.close();
      rmSync(root, { recursive: true, force: true });
    }
  },
);

test(
  "operator verifier extension is separate trusted code, pinned on restart and used by all three processes",
  { timeout: 20000 },
  async () => {
    const root = mkdtempSync(join(tmpdir(), "assurance-plugin-"));
    const module = join(root, "plugin.mjs"),
      workspace = join(root, "engine");
    // This trusted example checks only equality of two bounded input fields, not arbitrary execution.
    const source = `export const VERIFIERS = new Map([["field-equality/v1", (claim, evidence) => {
    const data = evidence[0].body.artifact.content;
    const actual = data.left === data.right;
    return {verdict: claim.body.value === actual ? "SUPPORTED" : "REFUTED", artifact: {schema:"field-equality-result/v1",actual}};
  }]]);`;
    writeFileSync(module, source);
    let engine: AssuranceEngine | undefined;
    try {
      initializeEngine(workspace, { verifierModule: module });
      engine = await AssuranceEngine.open(workspace);
      const result = await engine.run({
        schema: "assurance-workload/v1",
        domain: "example",
        operation: "field-equality/v1",
        predicate: "fields-equal",
        input: { left: 7, right: 7 },
        value: true,
      });
      assert.equal(result.report.status, "PASS");
      assert.equal(verifyEvidence(result.evidence, result.context).status, "BLOCKED");
      assert.equal(
        verifyEvidence(result.evidence, {
          ...result.context,
          registry: await loadRegistry(loadState(workspace)),
        }).status,
        "PASS",
      );
      await engine.close();
      writeFileSync(module, source + "\n// changed implementation");
      await assert.rejects(() => AssuranceEngine.open(workspace), { code: "INTEGRITY_MISMATCH" });
    } finally {
      await engine?.close();
      rmSync(root, { recursive: true, force: true });
    }
  },
);
