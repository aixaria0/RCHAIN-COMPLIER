import assert from "node:assert/strict";
import test from "node:test";
import { runTwoNodeExperiment } from "../../../examples/lattice-two-node.ts";
test(
  "two independent processes challenge, reproduce, crash, rejoin and audit",
  { timeout: 30000 },
  async () => {
    const result = await runTwoNodeExperiment();
    assert.equal(result.runtime.processes, 2);
    assert.ok(Object.values(result.checks).every((v) => v === true));
    const decision = result.view.decisions[0]!.recomputed;
    assert.equal(decision.accepted.length, 1);
    assert.equal(decision.rejected.length, 1);
    assert.equal(decision.unresolved.length, 1);
    assert.equal(result.view.claims.length, 4);
  },
);
