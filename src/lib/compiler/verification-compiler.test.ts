import assert from "node:assert/strict";
import test from "node:test";
import {
  compileVerification,
  type VerificationAdapter,
  type VerificationProblem,
} from "./verification-compiler.ts";
import {
  createFiniteStateLexicographicAdapter,
  type FiniteStateVerificationPayload,
} from "./finite-state-verifier.ts";

type Node = "start" | "goal";

function isFinitePayload(value: unknown): value is FiniteStateVerificationPayload<Node> {
  return Boolean(value && typeof value === "object" && "initial" in value && "expand" in value);
}

function problem(): VerificationProblem {
  return {
    id: "generic-counterexample-001",
    modelFamily: "finite-transition-system",
    scope: { version: "fixture-v1" },
    assumptions: ["transition relation is complete for this fixture"],
    payload: {
      initial: "start" as Node,
      objectives: ["mutations", "latency"],
      stateKey: (state: Node) => state,
      isGoal: (state: Node) => state === "goal",
      expand: (state: Node) =>
        state === "start"
          ? [{ to: "goal" as Node, label: "flip", cost: [1, 7] }]
          : [],
    },
  };
}

test("adaptive compiler selects a unique compatible adapter", () => {
  const adapter = createFiniteStateLexicographicAdapter<Node>({
    id: "finite-lex",
    modelFamily: "finite-transition-system",
    priority: 10,
    isPayload: isFinitePayload,
  });

  const compiled = compileVerification(problem(), [adapter]);
  assert.equal(compiled.status, "COMPILED");
  assert.equal(compiled.selectedAdapterId, "finite-lex");
  assert.equal(compiled.artifact?.outcome, "WITNESS_FOUND");
  assert.deepEqual(compiled.artifact?.minimality?.objectives, ["mutations", "latency"]);
});

test("adapter selection is fail-closed on equal-priority ambiguity", () => {
  const first = createFiniteStateLexicographicAdapter<Node>({
    id: "a",
    modelFamily: "finite-transition-system",
    priority: 10,
    isPayload: isFinitePayload,
  });
  const second = createFiniteStateLexicographicAdapter<Node>({
    id: "b",
    modelFamily: "finite-transition-system",
    priority: 10,
    isPayload: isFinitePayload,
  });

  const compiled = compileVerification(problem(), [first, second]);
  assert.equal(compiled.status, "BLOCKED");
  assert.match(compiled.reason, /ambiguous/);
});

test("higher-priority domain adapter beats a generic fallback", () => {
  const exact = createFiniteStateLexicographicAdapter<Node>({
    id: "domain-exact",
    modelFamily: "finite-transition-system",
    priority: 100,
    isPayload: isFinitePayload,
  });
  const generic: VerificationAdapter = {
    id: "generic-fallback",
    version: "1",
    modelFamily: "*",
    priority: 1,
    supports: () => true,
    verify: (input) => ({
      schema: "verification-artifact/v1",
      problemId: input.id,
      modelFamily: input.modelFamily,
      adapterId: "generic-fallback",
      adapterVersion: "1",
      outcome: "INCONCLUSIVE",
      scope: input.scope,
      assumptions: input.assumptions,
      limitations: ["fallback only"],
    }),
  };

  const compiled = compileVerification(problem(), [generic, exact]);
  assert.equal(compiled.status, "COMPILED");
  assert.equal(compiled.selectedAdapterId, "domain-exact");
});

test("mismatched adapter artifacts are rejected", () => {
  const bad: VerificationAdapter = {
    id: "bad",
    version: "1",
    modelFamily: "finite-transition-system",
    priority: 99,
    supports: () => true,
    verify: (input) => ({
      schema: "verification-artifact/v1",
      problemId: "wrong-id",
      modelFamily: input.modelFamily,
      adapterId: "bad",
      adapterVersion: "1",
      outcome: "INCONCLUSIVE",
      scope: input.scope,
      assumptions: input.assumptions,
      limitations: [],
    }),
  };

  const compiled = compileVerification(problem(), [bad]);
  assert.equal(compiled.status, "BLOCKED");
  assert.match(compiled.reason, /mismatched identity/);
});


test("artifact scope weakening is rejected", () => {
  const bad: VerificationAdapter = {
    id: "scope-weakener",
    version: "1",
    modelFamily: "finite-transition-system",
    priority: 99,
    supports: () => true,
    verify: (input) => ({
      schema: "verification-artifact/v1",
      problemId: input.id,
      modelFamily: input.modelFamily,
      adapterId: "scope-weakener",
      adapterVersion: "1",
      outcome: "UNREACHABLE_IN_MODEL",
      scope: { version: "weakened-fixture" },
      assumptions: [...input.assumptions],
      limitations: [],
    }),
  };

  const compiled = compileVerification(problem(), [bad]);
  assert.equal(compiled.status, "BLOCKED");
  assert.match(compiled.reason, /mismatched identity/);
});

test("artifact assumption weakening is rejected", () => {
  const bad: VerificationAdapter = {
    id: "assumption-weakener",
    version: "1",
    modelFamily: "finite-transition-system",
    priority: 99,
    supports: () => true,
    verify: (input) => ({
      schema: "verification-artifact/v1",
      problemId: input.id,
      modelFamily: input.modelFamily,
      adapterId: "assumption-weakener",
      adapterVersion: "1",
      outcome: "UNREACHABLE_IN_MODEL",
      scope: { ...input.scope },
      assumptions: ["weakened assumption"],
      limitations: [],
    }),
  };

  const compiled = compileVerification(problem(), [bad]);
  assert.equal(compiled.status, "BLOCKED");
  assert.match(compiled.reason, /mismatched identity/);
});
