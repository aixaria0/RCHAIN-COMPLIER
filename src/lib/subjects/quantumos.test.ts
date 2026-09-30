import assert from "node:assert/strict";
import test from "node:test";
import { compileVerification } from "../compiler/verification-compiler.ts";
import {
  QUANTUMOS_MATCHING_RHOLANG_FIXTURE,
  createQuantumOsClosureAdapter,
  createQuantumOsClosureProblem,
} from "./quantumos.ts";

test("matching independent rnode perspectives produce a bounded clean closure result", () => {
  const result = compileVerification(
    createQuantumOsClosureProblem(QUANTUMOS_MATCHING_RHOLANG_FIXTURE),
    [createQuantumOsClosureAdapter()],
  );

  assert.equal(result.status, "COMPILED");
  assert.equal(result.selectedAdapterId, "quantumos-proof-carrying-closure");
  assert.equal(result.artifact?.outcome, "UNREACHABLE_IN_MODEL");
  assert.equal(result.artifact?.metrics?.distinctPerspectives, 2);
});

test("post-state divergence becomes an explicit contradiction witness", () => {
  const divergent = structuredClone(QUANTUMOS_MATCHING_RHOLANG_FIXTURE);
  divergent.perspectives[1]!.postStateHash = "state:divergent";

  const result = compileVerification(
    createQuantumOsClosureProblem(divergent),
    [createQuantumOsClosureAdapter()],
  );

  assert.equal(result.status, "COMPILED");
  assert.equal(result.artifact?.outcome, "WITNESS_FOUND");
  const witness = result.artifact?.witness as
    | { violations?: string[] }
    | undefined;
  assert.ok(
    witness?.violations?.some((item) => item.includes("post-state divergence")),
  );
});

test("one rnode is inconclusive rather than silently trusted", () => {
  const single = structuredClone(QUANTUMOS_MATCHING_RHOLANG_FIXTURE);
  single.perspectives = [single.perspectives[0]!];

  const result = compileVerification(
    createQuantumOsClosureProblem(single),
    [createQuantumOsClosureAdapter()],
  );

  assert.equal(result.status, "COMPILED");
  assert.equal(result.artifact?.outcome, "INCONCLUSIVE");
  const witness = result.artifact?.witness as
    | { blockers?: string[] }
    | undefined;
  assert.ok(
    witness?.blockers?.some((item) =>
      item.includes("at least two independent perspectives"),
    ),
  );
});

test("unverified signed evidence is never promoted to a clean closure", () => {
  const unsigned = structuredClone(QUANTUMOS_MATCHING_RHOLANG_FIXTURE);
  unsigned.perspectives[0]!.signatureVerified = false;

  const result = compileVerification(
    createQuantumOsClosureProblem(unsigned),
    [createQuantumOsClosureAdapter()],
  );

  assert.equal(result.status, "COMPILED");
  assert.equal(result.artifact?.outcome, "WITNESS_FOUND");
});

test("lemma evidence blocks when ZFA closure evidence is absent", () => {
  const lemma = structuredClone(QUANTUMOS_MATCHING_RHOLANG_FIXTURE);
  lemma.closure.kind = "LEMMA";
  lemma.closure.id = "demo-lemma";
  lemma.perspectives = [
    {
      perspectiveId: "peer-a",
      evidenceDigest: "sha256:lemma-a",
      signatureVerified: true,
    },
  ];

  const result = compileVerification(
    createQuantumOsClosureProblem(lemma),
    [createQuantumOsClosureAdapter()],
  );

  assert.equal(result.status, "COMPILED");
  assert.equal(result.artifact?.outcome, "INCONCLUSIVE");
});
