/**
 * Possibility Plane: deterministic weighted counterfactual search.
 *
 * This is intentionally not a reimplementation of AalWiNes or a claim of
 * pushdown-automata equivalence. It transfers one useful design idea:
 * search for a minimum-cost witness instead of enumerating scenarios blindly.
 *
 * The engine operates on an explicit finite state graph supplied by the caller.
 * With non-negative edge costs it uses deterministic Dijkstra search.
 */

export interface WeightedTransition<State> {
  to: State;
  label: string;
  cost: number;
  metadata?: Record<string, unknown>;
}

export interface WeightedWitnessStep {
  from: string;
  to: string;
  label: string;
  cost: number;
  cumulativeCost: number;
  metadata?: Record<string, unknown>;
}

export type WeightedPossibilityStatus = "REACHABLE" | "UNREACHABLE" | "LIMIT_REACHED";

export interface WeightedPossibilityResult {
  status: WeightedPossibilityStatus;
  minimumCost: number | null;
  witness: WeightedWitnessStep[];
  exploredStates: number;
  frontierPeak: number;
  goalStateKey: string | null;
}

export interface WeightedPossibilityOptions<State> {
  initial: State;
  stateKey: (state: State) => string;
  isGoal: (state: State) => boolean;
  expand: (state: State) => WeightedTransition<State>[];
  maxStates?: number;
}

interface QueueItem<State> {
  state: State;
  key: string;
  cost: number;
  witness: WeightedWitnessStep[];
}

function compareQueueItems<State>(left: QueueItem<State>, right: QueueItem<State>): number {
  if (left.cost !== right.cost) return left.cost - right.cost;
  if (left.key !== right.key) return left.key.localeCompare(right.key);
  const leftPath = left.witness.map((step) => step.label).join("\u0000");
  const rightPath = right.witness.map((step) => step.label).join("\u0000");
  return leftPath.localeCompare(rightPath);
}

function validateTransition<State>(transition: WeightedTransition<State>): void {
  if (!Number.isFinite(transition.cost) || transition.cost < 0) {
    throw new Error(`weighted possibility search requires a finite non-negative cost: ${transition.cost}`);
  }
  if (!transition.label) {
    throw new Error("weighted possibility search requires every transition to have a label");
  }
}

export function searchWeightedPossibility<State>(
  options: WeightedPossibilityOptions<State>,
): WeightedPossibilityResult {
  const maxStates = options.maxStates ?? 10_000;
  if (!Number.isInteger(maxStates) || maxStates <= 0) {
    throw new Error("maxStates must be a positive integer");
  }

  const initialKey = options.stateKey(options.initial);
  const frontier: QueueItem<State>[] = [{
    state: options.initial,
    key: initialKey,
    cost: 0,
    witness: [],
  }];
  const bestCost = new Map<string, number>([[initialKey, 0]]);
  const settled = new Set<string>();
  let frontierPeak = 1;

  while (frontier.length > 0) {
    frontier.sort(compareQueueItems);
    const current = frontier.shift()!;

    if (settled.has(current.key)) continue;
    const knownBest = bestCost.get(current.key);
    if (knownBest !== undefined && current.cost > knownBest) continue;

    if (settled.size >= maxStates) {
      return {
        status: "LIMIT_REACHED",
        minimumCost: null,
        witness: [],
        exploredStates: settled.size,
        frontierPeak,
        goalStateKey: null,
      };
    }

    settled.add(current.key);

    if (options.isGoal(current.state)) {
      return {
        status: "REACHABLE",
        minimumCost: current.cost,
        witness: current.witness,
        exploredStates: settled.size,
        frontierPeak,
        goalStateKey: current.key,
      };
    }

    const transitions = [...options.expand(current.state)].sort((left, right) => {
      const leftKey = options.stateKey(left.to);
      const rightKey = options.stateKey(right.to);
      return left.cost - right.cost || left.label.localeCompare(right.label) || leftKey.localeCompare(rightKey);
    });

    for (const transition of transitions) {
      validateTransition(transition);
      const nextKey = options.stateKey(transition.to);
      if (settled.has(nextKey)) continue;

      const nextCost = current.cost + transition.cost;
      const previousBest = bestCost.get(nextKey);
      if (previousBest !== undefined && nextCost >= previousBest) continue;

      bestCost.set(nextKey, nextCost);
      frontier.push({
        state: transition.to,
        key: nextKey,
        cost: nextCost,
        witness: [
          ...current.witness,
          {
            from: current.key,
            to: nextKey,
            label: transition.label,
            cost: transition.cost,
            cumulativeCost: nextCost,
            ...(transition.metadata ? { metadata: transition.metadata } : {}),
          },
        ],
      });
    }

    frontierPeak = Math.max(frontierPeak, frontier.length);
  }

  return {
    status: "UNREACHABLE",
    minimumCost: null,
    witness: [],
    exploredStates: settled.size,
    frontierPeak,
    goalStateKey: null,
  };
}
