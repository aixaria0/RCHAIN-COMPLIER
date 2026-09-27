import {
  searchLexicographicPossibility,
  type LexicographicTransition,
} from "./lexicographic-possibility.ts";
import type {
  VerificationAdapter,
  VerificationArtifact,
  VerificationProblem,
} from "./verification-compiler.ts";

export interface FiniteStateVerificationPayload<State> {
  initial: State;
  objectives: string[];
  stateKey: (state: State) => string;
  isGoal: (state: State) => boolean;
  expand: (state: State) => LexicographicTransition<State>[];
  maxStates?: number;
}

export interface FiniteStateAdapterOptions<State> {
  id: string;
  version?: string;
  modelFamily: string;
  priority?: number;
  isPayload(value: unknown): value is FiniteStateVerificationPayload<State>;
  limitations?: string[];
}

/**
 * Creates an exact finite-state adapter using lexicographic Dijkstra search.
 *
 * UNREACHABLE_IN_MODEL means the explicit finite graph was exhausted under
 * the supplied transition relation. It is not a claim about states omitted
 * by the caller's model.
 */
export function createFiniteStateLexicographicAdapter<State>(
  options: FiniteStateAdapterOptions<State>,
): VerificationAdapter {
  return {
    id: options.id,
    version: options.version ?? "1",
    modelFamily: options.modelFamily,
    priority: options.priority ?? 0,
    supports(problem: VerificationProblem): boolean {
      return options.isPayload(problem.payload);
    },
    verify(problem: VerificationProblem): VerificationArtifact {
      if (!options.isPayload(problem.payload)) {
        throw new Error(`${options.id} received an unsupported payload`);
      }

      const result = searchLexicographicPossibility(problem.payload);
      const outcome =
        result.status === "REACHABLE"
          ? "WITNESS_FOUND"
          : result.status === "UNREACHABLE"
            ? "UNREACHABLE_IN_MODEL"
            : "LIMIT_REACHED";

      return {
        schema: "verification-artifact/v1",
        problemId: problem.id,
        modelFamily: problem.modelFamily,
        adapterId: options.id,
        adapterVersion: options.version ?? "1",
        outcome,
        scope: { ...problem.scope },
        assumptions: [...problem.assumptions],
        limitations: [
          "result is limited to the explicit finite transition model supplied by the caller",
          "unreachable means unreachable only inside that declared model",
          ...(options.limitations ?? []),
        ],
        ...(result.status === "REACHABLE"
          ? {
              witness: result.witness,
              minimality: {
                kind: "LEXICOGRAPHIC_MINIMUM_WITHIN_MODEL",
                objectives: result.objectives,
              },
            }
          : {}),
        metrics: {
          exploredStates: result.exploredStates,
          frontierPeak: result.frontierPeak,
          minimumCost: result.minimumCost ? JSON.stringify(result.minimumCost) : "",
        },
      };
    },
  };
}
