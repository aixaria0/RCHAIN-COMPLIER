import assert from "node:assert/strict";
import test from "node:test";
import { AETHERFORGE_FROZEN_SNAPSHOT } from "./aetherforge.ts";
import { repairAetherForgeSnapshot } from "./aetherforge-repair.ts";

test("AETHER FORGE tamper is repaired by the minimum declared intervention", () => {
  const tampered = structuredClone(AETHERFORGE_FROZEN_SNAPSHOT);
  const original = tampered.bounce[0]!.rho;
  tampered.bounce[0]!.rho *= 2;

  const result = repairAetherForgeSnapshot(tampered);
  assert.equal(result.status, "COMPILED");
  assert.equal(result.artifact?.outcome, "REPAIR_FOUND");
  assert.equal(result.artifact?.selectedActions.length, 1);
  assert.equal(
    result.artifact?.selectedActions[0]?.label,
    "restore:bounce[0].rho",
  );
  assert.deepEqual(result.artifact?.totalCost, [1, original]);
  assert.equal(
    result.artifact?.postRepairVerification?.outcome,
    "UNREACHABLE_IN_MODEL",
  );
  assert.equal(
    result.artifact?.postRepairVerification?.problemId,
    "aetherforge-physics-numeric-conformance",
  );
  assert.equal(result.artifact?.metrics.rejectedIdentityCandidates, 0);
  assert.match(
    result.artifact?.limitations.join("\n") ?? "",
    /physical correctness/,
  );
});

test("AETHER FORGE repair minimizes number of changed fields before numeric delta", () => {
  const tampered = structuredClone(AETHERFORGE_FROZEN_SNAPSHOT);
  tampered.bounce[0]!.rho *= 2;
  tampered.bounce[1]!.rho *= 3;

  const result = repairAetherForgeSnapshot(tampered);
  assert.equal(result.status, "COMPILED");
  assert.equal(result.artifact?.outcome, "REPAIR_FOUND");
  assert.equal(result.artifact?.selectedActions.length, 2);
  assert.deepEqual(
    result.artifact?.selectedActions.map((action) => action.label),
    ["restore:bounce[0].rho", "restore:bounce[1].rho"],
  );
  assert.equal(result.artifact?.totalCost?.[0], 2);
  assert.equal(
    result.artifact?.postRepairVerification?.outcome,
    "UNREACHABLE_IN_MODEL",
  );
});
