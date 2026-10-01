import {
  compileVerification,
  createFiniteStateLexicographicAdapter,
  type FiniteStateVerificationPayload,
  type VerificationProblem,
} from "../src/lib/verification-core/index.ts";

type State = "healthy" | "degraded" | "failed";

const payload: FiniteStateVerificationPayload<State> = {
  initial: "healthy",
  objectives: ["components_changed", "recovery_cost"],
  stateKey: (state) => state,
  isGoal: (state) => state === "failed",
  expand: (state) => {
    if (state === "healthy") {
      return [
        { to: "degraded", label: "lose-primary", cost: [1, 2] },
        { to: "failed", label: "direct-catastrophe", cost: [3, 0] },
      ];
    }
    if (state === "degraded") {
      return [{ to: "failed", label: "lose-backup", cost: [1, 1] }];
    }
    return [];
  },
};

const adapter = createFiniteStateLexicographicAdapter<State>({
  id: "generic-finite-state",
  modelFamily: "finite-transition-system",
  priority: 10,
  isPayload: (value): value is FiniteStateVerificationPayload<State> =>
    Boolean(value && typeof value === "object" && "initial" in value && "expand" in value),
});

const problem: VerificationProblem = {
  id: "standalone-demo",
  modelFamily: "finite-transition-system",
  scope: { system: "generic-redundant-service", version: "1" },
  assumptions: ["the supplied transition relation is complete for this demo"],
  payload,
};

console.log(JSON.stringify(compileVerification(problem, [adapter]), null, 2));
