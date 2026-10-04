import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { initializeEngine } from "../assurance/engine.ts";
import { OmegaNode } from "./node.ts";
import { verifyOmegaProof } from "./attestation.ts";

async function fixture() {
  const root = mkdtempSync(join(tmpdir(), "omega-node-"));
  initializeEngine(root);
  const node = await OmegaNode.open(root);
  return { root, node };
}

test(
  "Omega ONLINE requires live three-process identity-bound replay and yields a fresh signed proof",
  { timeout: 20_000 },
  async () => {
    const { root, node } = await fixture();
    try {
      const status = await node.status();
      assert.equal(status.state, "ONLINE");
      assert.equal(status.processes.alive, 3);
      assert.equal(status.processes.unique, 3);
      assert.equal(status.workers.verified, 2);
      assert.equal(status.identity, "PASS");
      assert.equal(status.replay, "PASS");
      assert.equal(status.equivocations, 0);

      const trust = node.trust();
      const proof = await node.prove();
      const report = verifyOmegaProof(proof, trust);
      assert.equal(report.status, "PASS");
      assert.equal(report.code, "VERIFIED");

      const tampered = structuredClone(proof);
      tampered.payload.status.processes.alive = 2;
      assert.equal(verifyOmegaProof(tampered, trust).status, "FAIL");

      const wrongTrust = { ...trust, expectedNodeId: trust.expectedNodeId + "00" };
      assert.equal(verifyOmegaProof(proof, wrongTrust).code, "TRUST_MISMATCH");
      assert.equal(verifyOmegaProof(proof, trust, Date.parse(proof.payload.expiresAt) + 1).code, "EXPIRED");
    } finally {
      await node.close();
      rmSync(root, { recursive: true, force: true });
    }
  },
);

test("worker loss degrades Omega and recovery restores ONLINE with a new process set", { timeout: 20_000 }, async () => {
  const { root, node } = await fixture();
  try {
    const before = node.engine.processIds.slice();
    process.kill(before[2]!, "SIGKILL");
    await new Promise((resolve) => setTimeout(resolve, 100));
    const degraded = await node.status();
    assert.equal(degraded.state, "DEGRADED");
    assert.equal(degraded.processes.alive, 2);
    assert.equal(degraded.workers.verified, 1);

    await node.engine.recover();
    const recovered = await node.status();
    assert.equal(recovered.state, "ONLINE");
    assert.ok(node.engine.processIds.every((pid) => !before.includes(pid)));
  } finally {
    await node.close();
    rmSync(root, { recursive: true, force: true });
  }
});
