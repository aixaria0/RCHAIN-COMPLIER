import assert from "node:assert/strict";
import test from "node:test";
import {
  compileRepair,
  type RepairAdapter,
  type RepairProblem,
} from "./repair-compiler.ts";
import {
  compileVerification,
  type VerificationAdapter,
  type VerificationProblem,
} from "./verification-compiler.ts";

interface TinyState {
  value: number;
}

const verifier: VerificationAdapter = {
  id: "tiny-verifier",
  version: "1",
  modelFamily: "tiny/v1",
  priority: 10,
  supports(problem) {
    return typeof (problem.payload as Partial<TinyState> | null)?.value === "number";
  },
  verify(problem) {
    const value = (problem.payload as TinyState).value;
    return {
      schema: "verification-artifact/v1",
      problemId: problem.id,
      modelFamily: problem.modelFamily,
      adapterId: "tiny-verifier",
      adapterVersion: "1",
      outcome: value === 0 ? "UNREACHABLE_IN_MODEL" : "WITNESS_FOUND",
      scope: { ...problem.scope },
      assumptions: [...problem.assumptions],
      limitations: ["tiny fixture"],
      ...(value === 0 ? {} : { witness: { value } }),
    };
  },
};

function verificationProblem(value: number): VerificationProblem {
  return {
    id: "same-claim",
    modelFamily: "tiny/v1",
    scope: { property: "value must be zero" },
    assumptions: ["integer fixture"],
    payload: { value },
  };
}

function repairProblem(value = 2): RepairProblem {
  const originalProblem = verificationProblem(value);
  const compiled = compileVerification(originalProblem, [verifier]);
  assert.equal(compiled.status, "COMPILED");
  assert.ok(compiled.artifact);
  return {
    id: "tiny-repair",
    modelFamily: "tiny/v1",
    originalProblem,
    originalArtifact: compiled.artifact,
    objectives: ["actions", "delta"],
    payload: { value },
  };
}

const honestRepair: RepairAdapter = {
  id: "tiny-repair-adapter",
  version: "1",
  modelFamily: "tiny/v1",
  priority: 10,
  supports() {
    return true;
  },
  createSearch(problem) {
    const start = (problem.payload as TinyState).value;
    return {
      initial: { value: start },
      stateKey(state) {
        return String((state as TinyState).value);
      },
      expand(state) {
        const value = (state as TinyState).value;
        if (value === 0) return [];
        return [
          {
            to: { value: value - 1 },
            label: `decrement:${value}->${value - 1}`,
            cost: [1, 1],
          },
        ];
      },
      toVerificationProblem(state) {
        return verificationProblem((state as TinyState).value);
      },
    };
  },
};

test("repair compiler finds the lexicographic minimum repair and re-runs the same verifier", () => {
  const result = compileRepair(repairProblem(), [honestRepair], verifier);
  assert.equal(result.status, "COMPILED");
  assert.equal(result.artifact?.outcome, "REPAIR_FOUND");
  assert.deepEqual(result.artifact?.totalCost, [2, 2]);
  assert.equal(result.artifact?.selectedActions.length, 2);
  assert.equal(result.artifact?.postRepairVerification?.outcome, "UNREACHABLE_IN_MODEL");
  assert.equal(result.artifact?.verificationAdapterId, "tiny-verifier");
  assert.equal(result.artifact?.metrics.rejectedIdentityCandidates, 0);
});

test("repair compiler blocks scope weakening instead of certifying a fake repair", () => {
  const malicious: RepairAdapter = {
    ...honestRepair,
    id: "scope-weakener",
    createSearch(problem) {
      const start = (problem.payload as TinyState).value;
      return {
        initial: { value: start },
        stateKey(state) {
          return String((state as TinyState).value);
        },
        expand() {
          return [{ to: { value: 0 }, label: "pretend-fix", cost: [1, 0] }];
        },
        toVerificationProblem(state) {
          const candidate = verificationProblem((state as TinyState).value);
          if ((state as TinyState).value === 0) {
            candidate.scope = { property: "weakened claim" };
          }
          return candidate;
        },
      };
    },
  };

  const result = compileRepair(repairProblem(), [malicious], verifier);
  assert.equal(result.status, "BLOCKED");
  assert.equal(result.artifact, null);
  assert.match(result.reason, /change claim identity/);
});

test("repair compiler refuses a non-failing original artifact", () => {
  const originalProblem = verificationProblem(0);
  const original = compileVerification(originalProblem, [verifier]);
  assert.equal(original.status, "COMPILED");
  assert.ok(original.artifact);

  const problem: RepairProblem = {
    id: "not-failing",
    modelFamily: "tiny/v1",
    originalProblem,
    originalArtifact: original.artifact,
    objectives: ["actions"],
    payload: { value: 0 },
  };

  const result = compileRepair(problem, [honestRepair], verifier);
  assert.equal(result.status, "BLOCKED");
  assert.match(result.reason, /WITNESS_FOUND/);
});


test("repair compiler blocks an adapter whose initial state is already repaired", () => {
  const malicious: RepairAdapter = {
    ...honestRepair,
    id: "pre-repaired-initial-state",
    createSearch() {
      return {
        initial: { value: 0 },
        stateKey(state) {
          return String((state as TinyState).value);
        },
        expand() {
          return [];
        },
        toVerificationProblem(state) {
          return verificationProblem((state as TinyState).value);
        },
      };
    },
  };

  const result = compileRepair(repairProblem(), [malicious], verifier);
  assert.equal(result.status, "BLOCKED");
  assert.equal(result.artifact, null);
  assert.match(result.reason, /initial state does not reproduce the original subject payload/);
});

test("repair compiler blocks a forged original artifact that does not replay exactly", () => {
  const problem = repairProblem();
  problem.originalArtifact = {
    ...problem.originalArtifact,
    witness: { value: 999 },
  };

  const result = compileRepair(problem, [honestRepair], verifier);
  assert.equal(result.status, "BLOCKED");
  assert.equal(result.artifact, null);
  assert.match(result.reason, /does not reproduce exactly/);
});
