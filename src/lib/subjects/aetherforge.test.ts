import assert from "node:assert/strict";
import test from "node:test";
import { compileVerification } from "../compiler/verification-compiler.ts";
import {
  AETHERFORGE_FROZEN_SNAPSHOT,
  createAetherForgeAdapter,
  createAetherForgeProblem,
} from "./aetherforge.ts";

test("AETHER FORGE is accepted as a non-blockchain external subject", () => {
  const result = compileVerification(createAetherForgeProblem(), [createAetherForgeAdapter()]);
  assert.equal(result.status, "COMPILED");
  assert.equal(result.selectedAdapterId, "aetherforge-numeric-conformance");
  assert.equal(result.artifact?.outcome, "UNREACHABLE_IN_MODEL");
  assert.equal(result.artifact?.scope.repository, "aixaria0/aetherforge");
  assert.equal(result.artifact?.metrics?.sourceCommit, "f264c530a39acf029070eee077eec96518a84055");
  assert.match(result.artifact?.limitations.join("\n") ?? "", /does not establish physical correctness/);
});

test("AETHER FORGE snapshot tampering becomes an explicit witness", () => {
  const tampered = structuredClone(AETHERFORGE_FROZEN_SNAPSHOT);
  tampered.bounce[0]!.rho *= 2;

  const result = compileVerification(createAetherForgeProblem(tampered), [createAetherForgeAdapter()]);
  assert.equal(result.status, "COMPILED");
  assert.equal(result.artifact?.outcome, "WITNESS_FOUND");

  const witness = result.artifact?.witness as { violations?: string[] } | undefined;
  assert.ok(witness?.violations?.some((item) => item.includes("bounce symmetry")));
});
