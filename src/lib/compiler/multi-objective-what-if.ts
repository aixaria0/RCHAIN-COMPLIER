/**
 * Multi-objective dual-refinement what-if analysis.
 *
 * Pass 1 is an over-approximation that forgets global failure consistency.
 * A candidate witness is validated against one static failure assignment.
 * Spurious candidates trigger an exact product-state refinement. Search budget
 * exhaustion is INCONCLUSIVE and is never promoted to UNREACHABLE.
 */
import {
  searchLexicographicPossibility,
  type CostVector,
  type LexicographicWitnessStep,
} from "./lexicographic-possibility.ts";

export interface MultiObjectiveWhatIfTransition<State> {
  to: State;
  label: string;
  cost: CostVector;
  requiresFailed?: string[];
  requiresOperational?: string[];
  metadata?: Record<string, unknown>;
}

export interface MultiObjectiveWhatIfOptions<State> {
  initial: State;
  objectives: string[];
  stateKey: (state: State) => string;
  isGoal: (state: State) => boolean;
  expand: (state: State) => MultiObjectiveWhatIfTransition<State>[];
  maxFailures: number;
  maxStates?: number;
}

export interface MultiObjectiveWhatIfResult {
  status: "REACHABLE" | "UNREACHABLE" | "INCONCLUSIVE";
  objectives: string[];
  minimumCost: number[] | null;
  witness: LexicographicWitnessStep[];
  failedComponents: string[];
  abstractStates: number;
  exactStates: number;
  refinement: "NOT_NEEDED" | "EXACT" | "BUDGET_EXHAUSTED";
  minimalityScope: "ABSTRACT_GRAPH" | "EXACT_PRODUCT_GRAPH" | "NONE";
}

interface ProductState<State> {
  node: State;
  failed: string[];
  operational: string[];
}

function normalized(ids: string[] | undefined): string[] {
  const values = ids ?? [];
  if (values.some((id) => typeof id !== "string" || !id.trim())) {
    throw new Error("component IDs must be non-empty strings");
  }
  return [...new Set(values)].sort();
}

function requirements<State>(edge: MultiObjectiveWhatIfTransition<State>) {
  if (!edge.label) throw new Error("transitions require a non-empty label");
  const failed = normalized(edge.requiresFailed);
  const operational = normalized(edge.requiresOperational);
  if (failed.some((id) => operational.includes(id))) {
    throw new Error("a transition cannot require the same component failed and operational");
  }
  return { failed, operational };
}

function encode(parts: unknown[]): string {
  return JSON.stringify(parts);
}

export function analyzeMultiObjectiveWhatIf<State>(
  options: MultiObjectiveWhatIfOptions<State>,
): MultiObjectiveWhatIfResult {
  if (!Number.isSafeInteger(options.maxFailures) || options.maxFailures < 0) {
    throw new Error("maxFailures must be a non-negative safe integer");
  }
  const maxStates = options.maxStates ?? 10_000;
  const abstract = searchLexicographicPossibility({
    initial: options.initial,
    objectives: options.objectives,
    stateKey: options.stateKey,
    isGoal: options.isGoal,
    maxStates,
    expand: (node) =>
      options.expand(node).flatMap((edge) => {
        const req = requirements(edge);
        if (req.failed.length > options.maxFailures) return [];
        return [{
          to: edge.to,
          label: edge.label,
          cost: edge.cost,
          metadata: {
            ...(edge.metadata ?? {}),
            requiresFailed: req.failed,
            requiresOperational: req.operational,
          },
        }];
      }),
  });

  const empty = {
    objectives: [...options.objectives],
    minimumCost: null,
    witness: [] as LexicographicWitnessStep[],
    failedComponents: [] as string[],
    abstractStates: abstract.exploredStates,
    exactStates: 0,
  };
  if (abstract.status === "LIMIT_REACHED") {
    return { ...empty, status: "INCONCLUSIVE", refinement: "BUDGET_EXHAUSTED", minimalityScope: "NONE" };
  }
  if (abstract.status === "UNREACHABLE") {
    return { ...empty, status: "UNREACHABLE", refinement: "NOT_NEEDED", minimalityScope: "ABSTRACT_GRAPH" };
  }

  let failed = new Set<string>();
  let operational = new Set<string>();
  let feasible = true;
  for (const step of abstract.witness) {
    const down = (step.metadata?.requiresFailed as string[] | undefined) ?? [];
    const up = (step.metadata?.requiresOperational as string[] | undefined) ?? [];
    if (down.some((id) => operational.has(id)) || up.some((id) => failed.has(id))) {
      feasible = false;
      break;
    }
    failed = new Set([...failed, ...down]);
    operational = new Set([...operational, ...up]);
    if (failed.size > options.maxFailures) {
      feasible = false;
      break;
    }
  }
  if (feasible) {
    return {
      ...empty,
      status: "REACHABLE",
      refinement: "NOT_NEEDED",
      minimalityScope: "ABSTRACT_GRAPH",
      minimumCost: abstract.minimumCost,
      witness: abstract.witness,
      failedComponents: [...failed].sort(),
    };
  }

  const exact = searchLexicographicPossibility<ProductState<State>>({
    initial: { node: options.initial, failed: [], operational: [] },
    objectives: options.objectives,
    stateKey: (state) => encode([options.stateKey(state.node), state.failed, state.operational]),
    isGoal: (state) => options.isGoal(state.node),
    maxStates,
    expand: (state) =>
      options.expand(state.node).flatMap((edge) => {
        const req = requirements(edge);
        if (
          req.failed.some((id) => state.operational.includes(id)) ||
          req.operational.some((id) => state.failed.includes(id))
        ) return [];
        const nextFailed = normalized([...state.failed, ...req.failed]);
        if (nextFailed.length > options.maxFailures) return [];
        return [{
          to: {
            node: edge.to,
            failed: nextFailed,
            operational: normalized([...state.operational, ...req.operational]),
          },
          label: edge.label,
          cost: edge.cost,
          metadata: {
            ...(edge.metadata ?? {}),
            requiresFailed: req.failed,
            requiresOperational: req.operational,
          },
        }];
      }),
  });

  if (exact.status === "LIMIT_REACHED") {
    return {
      ...empty,
      exactStates: exact.exploredStates,
      status: "INCONCLUSIVE",
      refinement: "BUDGET_EXHAUSTED",
      minimalityScope: "NONE",
    };
  }
  if (exact.status === "UNREACHABLE") {
    return {
      ...empty,
      exactStates: exact.exploredStates,
      status: "UNREACHABLE",
      refinement: "EXACT",
      minimalityScope: "EXACT_PRODUCT_GRAPH",
    };
  }
  const goal = JSON.parse(exact.goalStateKey!) as [string, string[], string[]];
  return {
    ...empty,
    exactStates: exact.exploredStates,
    status: "REACHABLE",
    refinement: "EXACT",
    minimalityScope: "EXACT_PRODUCT_GRAPH",
    minimumCost: exact.minimumCost,
    witness: exact.witness,
    failedComponents: goal[1],
  };
}
