import assert from "node:assert/strict";
import test from "node:test";
import { buildDuplicateMinimumMessageDAG } from "./casper-concrete-dag.ts";
import { traceCasperFinalizerSemantics } from "./casper-finalizer-semantics.ts";
import {
  createCasperCoverageProblem,
  createCasperCoverageVerificationAdapter,
  repairCasperDuplicateMinimumSenderCoverage,
} from "./casper-repair-adapter.ts";
import { compileVerification } from "../compiler/verification-compiler.ts";

test("CBC duplicate-minimum fixture is a repairable WITNESS_FOUND claim", () => {
  const fixture = buildDuplicateMinimumMessageDAG();
  assert.ok(fixture.messages.some((message) => message.id === "d3"));
  assert.equal(fixture.justifications.includes("d3"), false);

  const compiled = compileVerification(
    createCasperCoverageProblem(fixture),
    [createCasperCoverageVerificationAdapter()],
  );

  assert.equal(compiled.status, "COMPILED");
  assert.equal(compiled.artifact?.outcome, "WITNESS_FOUND");
  assert.equal(compiled.artifact?.metrics?.checkMinMessagesPassed, true);
  assert.equal(compiled.artifact?.metrics?.distinctMinimumMessageCoverage, false);
  assert.equal(compiled.artifact?.metrics?.finalized, true);
});

test("CBC repair chooses a one-justification distinct-sender repair that preserves finalization", () => {
  const result = repairCasperDuplicateMinimumSenderCoverage();

  assert.equal(result.status, "COMPILED");
  assert.equal(result.artifact?.outcome, "REPAIR_FOUND");
  assert.equal(result.artifact?.selectedActions.length, 1);
  assert.equal(result.artifact?.selectedActions[0]?.label, "replace:a2->d3");
  assert.deepEqual(result.artifact?.totalCost, [0, 1, 1]);
  assert.equal(
    result.artifact?.selectedActions[0]?.metadata?.finalizationPreserved,
    true,
  );
  assert.equal(
    result.artifact?.selectedActions[0]?.metadata?.distinctCoverageAfter,
    true,
  );
  assert.equal(
    result.artifact?.postRepairVerification?.outcome,
    "UNREACHABLE_IN_MODEL",
  );
  assert.equal(
    result.artifact?.postRepairVerification?.metrics?.distinctMinimumMessageCoverage,
    true,
  );
  assert.equal(
    result.artifact?.postRepairVerification?.metrics?.finalized,
    true,
  );
  assert.equal(result.artifact?.metrics.rejectedIdentityCandidates, 0);
});

test("selected CBC repair maps to the expected distinct minimum-sender semantic trace", () => {
  const fixture = buildDuplicateMinimumMessageDAG();
  fixture.justifications = ["a3", "b3", "c3", "d3"];
  const trace = traceCasperFinalizerSemantics(fixture);

  assert.deepEqual(trace.minimumMessageSenders, ["v0", "v1", "v2", "v3"]);
  assert.equal(trace.distinctMinimumMessageCoverage, true);
  assert.equal(trace.finalized, true);
});
