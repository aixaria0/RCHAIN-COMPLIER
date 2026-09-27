/**
 * Protocol-agnostic lexicographic minimum-witness search.
 *
 * The engine operates on an explicit finite graph. Costs are non-negative
 * vectors compared lexicographically. No protocol semantics are assumed.
 */

export type CostVector = readonly number[];

export interface LexicographicTransition<State> {
  to: State;
  label: string;
  cost: CostVector;
  metadata?: Record<string, unknown>;
}

export interface LexicographicWitnessStep {
  from: string;
  to: string;
  label: string;
  cost: number[];
  cumulativeCost: number[];
  metadata?: Record<string, unknown>;
}

export type LexicographicSearchStatus =
  | "REACHABLE"
  | "UNREACHABLE"
  | "LIMIT_REACHED";

export interface LexicographicSearchResult {
  status: LexicographicSearchStatus;
  objectives: string[];
  minimumCost: number[] | null;
  witness: LexicographicWitnessStep[];
  exploredStates: number;
  frontierPeak: number;
  goalStateKey: string | null;
}

export interface LexicographicSearchOptions<State> {
  initial: State;
  objectives: string[];
  stateKey: (state: State) => string;
  isGoal: (state: State) => boolean;
  expand: (state: State) => LexicographicTransition<State>[];
  maxStates?: number;
}

interface QueueItem<State> {
  state: State;
  key: string;
  cost: number[];
  witness: LexicographicWitnessStep[];
}

function validateObjectives(objectives: string[]): void {
  if (objectives.length === 0) {
    throw new Error("lexicographic search requires at least one objective");
  }
  if (objectives.some((name) => !name.trim())) {
    throw new Error("lexicographic objective names must be non-empty");
  }
  if (new Set(objectives).size !== objectives.length) {
    throw new Error("lexicographic objective names must be unique");
  }
}

function validateCost(cost: CostVector, dimensions: number): number[] {
  if (cost.length !== dimensions) {
    throw new Error(
      `cost vector dimension mismatch: expected ${dimensions}, got ${cost.length}`,
    );
  }
  const normalized = [...cost];
  if (normalized.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new Error("cost vectors require finite non-negative values");
  }
  return normalized;
}

export function compareLexicographic(left: CostVector, right: CostVector): number {
  if (left.length !== right.length) {
    throw new Error("cannot compare cost vectors with different dimensions");
  }
  for (let index = 0; index < left.length; index += 1) {
    const delta = left[index]! - right[index]!;
    if (delta !== 0) return delta < 0 ? -1 : 1;
  }
  return 0;
}

export function addCostVectors(left: CostVector, right: CostVector): number[] {
  if (left.length !== right.length) {
    throw new Error("cannot add cost vectors with different dimensions");
  }
  return left.map((value, index) => value + right[index]!);
}

function compareQueue<State>(left: QueueItem<State>, right: QueueItem<State>): number {
  const byCost = compareLexicographic(left.cost, right.cost);
  if (byCost !== 0) return byCost;
  if (left.key !== right.key) return left.key.localeCompare(right.key);
  return left.witness
    .map((step) => step.label)
    .join("\u0000")
    .localeCompare(right.witness.map((step) => step.label).join("\u0000"));
}

export function searchLexicographicPossibility<State>(
  options: LexicographicSearchOptions<State>,
): LexicographicSearchResult {
  validateObjectives(options.objectives);
  const maxStates = options.maxStates ?? 10_000;
  if (!Number.isSafeInteger(maxStates) || maxStates <= 0) {
    throw new Error("maxStates must be a positive safe integer");
  }

  const dimensions = options.objectives.length;
  const zero = Array.from({ length: dimensions }, () => 0);
  const initialKey = options.stateKey(options.initial);
  const frontier: QueueItem<State>[] = [{
    state: options.initial,
    key: initialKey,
    cost: zero,
    witness: [],
  }];
  const best = new Map<string, number[]>([[initialKey, zero]]);
  const settled = new Set<string>();
  let frontierPeak = 1;

  while (frontier.length > 0) {
    frontier.sort(compareQueue);
    const current = frontier.shift()!;

    if (settled.has(current.key)) continue;
    const known = best.get(current.key);
    if (known && compareLexicographic(current.cost, known) > 0) continue;

    if (settled.size >= maxStates) {
      return {
        status: "LIMIT_REACHED",
        objectives: [...options.objectives],
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
        objectives: [...options.objectives],
        minimumCost: [...current.cost],
        witness: current.witness,
        exploredStates: settled.size,
        frontierPeak,
        goalStateKey: current.key,
      };
    }

    const transitions = [...options.expand(current.state)].map((transition) => ({
      ...transition,
      normalizedCost: validateCost(transition.cost, dimensions),
      targetKey: options.stateKey(transition.to),
    }));

    transitions.sort((left, right) => {
      const byCost = compareLexicographic(left.normalizedCost, right.normalizedCost);
      if (byCost !== 0) return byCost;
      return left.label.localeCompare(right.label) || left.targetKey.localeCompare(right.targetKey);
    });

    for (const transition of transitions) {
      if (!transition.label) {
        throw new Error("lexicographic transitions require a non-empty label");
      }
      if (settled.has(transition.targetKey)) continue;

      const nextCost = addCostVectors(current.cost, transition.normalizedCost);
      const previousBest = best.get(transition.targetKey);
      if (previousBest && compareLexicographic(nextCost, previousBest) >= 0) continue;

      best.set(transition.targetKey, nextCost);
      frontier.push({
        state: transition.to,
        key: transition.targetKey,
        cost: nextCost,
        witness: [
          ...current.witness,
          {
            from: current.key,
            to: transition.targetKey,
            label: transition.label,
            cost: [...transition.normalizedCost],
            cumulativeCost: [...nextCost],
            ...(transition.metadata ? { metadata: transition.metadata } : {}),
          },
        ],
      });
    }

    frontierPeak = Math.max(frontierPeak, frontier.length);
  }

  return {
    status: "UNREACHABLE",
    objectives: [...options.objectives],
    minimumCost: null,
    witness: [],
    exploredStates: settled.size,
    frontierPeak,
    goalStateKey: null,
  };
}
