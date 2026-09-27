/**
 * Protocol-independent, finite-state what-if analysis.
 *
 * A failed component remains failed for the whole trace. The first pass
 * intentionally forgets that global constraint; it is an over-approximation.
 * A concrete trace is checked against one consistent failure assignment.
 * If the cheapest abstract trace is spurious, an exact product-state search
 * tracks both failed and required-operational components.
 *
 * This is not a pushdown automaton. Its polynomial claim is limited to the
 * ordinary finite graph first pass; the exact fallback may be exponential.
 */
import { searchWeightedPossibility, type WeightedWitnessStep } from "./possibility-plane.ts";

export interface WhatIfTransition<State> {
  to: State;
  label: string;
  cost: number;
  requiresFailed?: string[];
  requiresOperational?: string[];
}

export interface WhatIfOptions<State> {
  initial: State;
  stateKey: (state: State) => string;
  isGoal: (state: State) => boolean;
  expand: (state: State) => WhatIfTransition<State>[];
  maxFailures: number;
  maxStates?: number;
}

export interface WhatIfResult {
  status: "REACHABLE" | "UNREACHABLE" | "INCONCLUSIVE";
  minimumCost: number | null;
  witness: WeightedWitnessStep[];
  failedComponents: string[];
  abstractStates: number;
  exactStates: number;
  refinement: "NOT_NEEDED" | "EXACT" | "BUDGET_EXHAUSTED";
}

interface ProductState<State> {
  node: State;
  failed: string[];
  operational: string[];
}

function normalized(ids: string[] | undefined): string[] {
  const values = ids ?? [];
  if (values.some((id) => typeof id !== "string" || id.length === 0)) {
    throw new Error("component IDs must be non-empty strings");
  }
  return [...new Set(values)].sort();
}

function checked<State>(
  edge: WhatIfTransition<State>,
): Required<Pick<WhatIfTransition<State>, "requiresFailed" | "requiresOperational">> {
  if (!Number.isFinite(edge.cost) || edge.cost < 0 || !edge.label) {
    throw new Error("transitions require a label and finite non-negative cost");
  }
  const requiresFailed = normalized(edge.requiresFailed);
  const requiresOperational = normalized(edge.requiresOperational);
  if (requiresFailed.some((id) => requiresOperational.includes(id))) {
    throw new Error("a transition cannot require the same component failed and operational");
  }
  return { requiresFailed, requiresOperational };
}

function encode(parts: unknown[]): string {
  return JSON.stringify(parts);
}

export function analyzeQuantitativeWhatIf<State>(options: WhatIfOptions<State>): WhatIfResult {
  if (!Number.isSafeInteger(options.maxFailures) || options.maxFailures < 0) {
    throw new Error("maxFailures must be a non-negative safe integer");
  }
  const maxStates = options.maxStates ?? 10_000;
  if (!Number.isSafeInteger(maxStates) || maxStates < 1) {
    throw new Error("maxStates must be a positive safe integer");
  }

  // The abstract graph admits every edge that could be enabled by a local
  // assignment. It deliberately ignores consistency across different edges.
  const abstract = searchWeightedPossibility({
    initial: options.initial,
    stateKey: options.stateKey,
    isGoal: options.isGoal,
    maxStates,
    expand: (node) =>
      options.expand(node).flatMap((edge) => {
        const requirements = checked(edge);
        if (requirements.requiresFailed.length > options.maxFailures) return [];
        return [
          {
            to: edge.to,
            label: edge.label,
            cost: edge.cost,
            metadata: {
              requiresFailed: requirements.requiresFailed,
              requiresOperational: requirements.requiresOperational,
            },
          },
        ];
      }),
  });

  const base = {
    abstractStates: abstract.exploredStates,
    exactStates: 0,
    minimumCost: null,
    witness: [] as WeightedWitnessStep[],
    failedComponents: [] as string[],
  };
  if (abstract.status === "LIMIT_REACHED") {
    return { ...base, status: "INCONCLUSIVE", refinement: "BUDGET_EXHAUSTED" };
  }
  if (abstract.status === "UNREACHABLE") {
    return { ...base, status: "UNREACHABLE", refinement: "NOT_NEEDED" };
  }

  let failed = new Set<string>();
  let operational = new Set<string>();
  let feasible = true;
  for (const step of abstract.witness) {
    const down = step.metadata?.requiresFailed as string[];
    const up = step.metadata?.requiresOperational as string[];
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
      ...base,
      status: "REACHABLE",
      refinement: "NOT_NEEDED",
      minimumCost: abstract.minimumCost,
      witness: abstract.witness,
      failedComponents: [...failed].sort(),
    };
  }

  // Exact finite product of location and static failure assignment. We keep
  // operational requirements too, so a later failure cannot invalidate an
  // earlier transition. An exhausted budget proves neither result.
  const exact = searchWeightedPossibility<ProductState<State>>({
    initial: { node: options.initial, failed: [], operational: [] },
    stateKey: (state) => encode([options.stateKey(state.node), state.failed, state.operational]),
    isGoal: (state) => options.isGoal(state.node),
    maxStates,
    expand: (state) =>
      options.expand(state.node).flatMap((edge) => {
        const { requiresFailed: down, requiresOperational: up } = checked(edge);
        if (
          down.some((id) => state.operational.includes(id)) ||
          up.some((id) => state.failed.includes(id))
        )
          return [];
        const nextFailed = normalized([...state.failed, ...down]);
        if (nextFailed.length > options.maxFailures) return [];
        return [
          {
            to: {
              node: edge.to,
              failed: nextFailed,
              operational: normalized([...state.operational, ...up]),
            },
            label: edge.label,
            cost: edge.cost,
            metadata: { requiresFailed: down, requiresOperational: up },
          },
        ];
      }),
  });
  if (exact.status === "LIMIT_REACHED") {
    return {
      ...base,
      exactStates: exact.exploredStates,
      status: "INCONCLUSIVE",
      refinement: "BUDGET_EXHAUSTED",
    };
  }
  if (exact.status === "UNREACHABLE") {
    return {
      ...base,
      exactStates: exact.exploredStates,
      status: "UNREACHABLE",
      refinement: "EXACT",
    };
  }
  const productGoal = JSON.parse(exact.goalStateKey!) as [string, string[], string[]];
  return {
    ...base,
    exactStates: exact.exploredStates,
    status: "REACHABLE",
    refinement: "EXACT",
    minimumCost: exact.minimumCost,
    witness: exact.witness,
    failedComponents: productGoal[1],
  };
}
