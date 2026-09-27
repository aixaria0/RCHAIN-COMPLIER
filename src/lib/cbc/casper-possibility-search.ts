import type { ConcreteDagFixture } from "./casper-concrete-dag.ts";
import {
  removeParentAndRecomputeSeen,
  type ReachableParentDeletion,
} from "./casper-reachable-perturbation-search.ts";
import {
  analyzeUpstreamReachability,
  type UpstreamReachabilityReport,
} from "./casper-upstream-reachability.ts";
import {
  traceCasperFinalizerSemantics,
  type CasperFinalizerSemanticsTrace,
} from "./casper-finalizer-semantics.ts";
import {
  searchWeightedPossibility,
  type WeightedPossibilityResult,
} from "../compiler/possibility-plane.ts";

export type CasperCounterexampleSearchStatus =
  | "COUNTEREXAMPLE_FOUND"
  | "EXHAUSTED_NO_COUNTEREXAMPLE"
  | "LIMIT_REACHED";

export interface CasperCounterexampleMutation extends ReachableParentDeletion {
  cost: number;
}

export interface CasperCounterexampleSearchOptions {
  maxStates?: number;
  mutationCost?: (mutation: ReachableParentDeletion) => number;
}

export interface CasperCounterexampleSearchResult {
  status: CasperCounterexampleSearchStatus;
  baseline: CasperFinalizerSemanticsTrace;
  baselineReachability: UpstreamReachabilityReport;
  minimumCost: number | null;
  mutations: CasperCounterexampleMutation[];
  candidate: ConcreteDagFixture | null;
  candidateTrace: CasperFinalizerSemanticsTrace | null;
  candidateReachability: UpstreamReachabilityReport | null;
  exploredStates: number;
  frontierPeak: number;
  searchModel: "reachability-valid-parent-deletions/v1";
}

interface SearchState {
  fixture: ConcreteDagFixture;
}

function canonicalStateKey(fixture: ConcreteDagFixture): string {
  return fixture.messages
    .map((message) => ({
      id: message.id,
      parents: [...message.parents].sort(),
    }))
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((message) => `${message.id}<-${message.parents.join(",")}`)
    .join("|");
}

function candidateMutations(
  fixture: ConcreteDagFixture,
  mutationCost: (mutation: ReachableParentDeletion) => number,
): Array<{
  fixture: ConcreteDagFixture;
  mutation: CasperCounterexampleMutation;
}> {
  const candidates: Array<{
    fixture: ConcreteDagFixture;
    mutation: CasperCounterexampleMutation;
  }> = [];

  for (const message of [...fixture.messages].sort((a, b) => a.id.localeCompare(b.id))) {
    for (const parentId of [...message.parents].sort()) {
      const mutation: ReachableParentDeletion = {
        messageId: message.id,
        removedParentId: parentId,
      };
      const cost = mutationCost(mutation);
      if (!Number.isFinite(cost) || cost < 0) {
        throw new Error(
          `Casper counterexample mutation cost must be finite and non-negative: ${cost}`,
        );
      }

      const candidate = removeParentAndRecomputeSeen(
        fixture,
        mutation.messageId,
        mutation.removedParentId,
      );
      const reachability = analyzeUpstreamReachability(candidate);
      if (!reachability.reachable) continue;

      const trace = traceCasperFinalizerSemantics(candidate);
      // Parent deletion cannot restore sender coverage once it is lost. Prune
      // states outside the question's declared semantic boundary.
      if (!trace.checkMinMessagesPassed || !trace.distinctMinimumMessageCoverage) {
        continue;
      }

      candidates.push({
        fixture: candidate,
        mutation: { ...mutation, cost },
      });
    }
  }

  return candidates;
}

function replayMutations(
  fixture: ConcreteDagFixture,
  mutations: CasperCounterexampleMutation[],
): ConcreteDagFixture {
  return mutations.reduce(
    (current, mutation) =>
      removeParentAndRecomputeSeen(
        current,
        mutation.messageId,
        mutation.removedParentId,
      ),
    fixture,
  );
}

/**
 * Quantitative counterexample search over the concrete Casper DAG model.
 *
 * Search space:
 *   - start from an upstream-reachable, finalizing concrete DAG;
 *   - transitions delete one parent edge;
 *   - seen sets are re-derived after every transition;
 *   - causally unreachable states are rejected;
 *   - minimum-message count and distinct bonded-sender coverage must remain.
 *
 * Goal:
 *   a reachability-valid history that crosses from finalizing to non-finalizing.
 *
 * A COUNTEREXAMPLE_FOUND result is minimal only inside this explicitly declared
 * parent-deletion model and supplied cost function. It is not a protocol-wide
 * minimality claim and does not execute the Rust node.
 */
export function searchReachableCasperCounterexample(
  fixture: ConcreteDagFixture,
  options: CasperCounterexampleSearchOptions = {},
): CasperCounterexampleSearchResult {
  const baselineReachability = analyzeUpstreamReachability(fixture);
  if (!baselineReachability.reachable) {
    throw new Error(
      "Casper counterexample search requires an upstream-reachable baseline",
    );
  }

  const baseline = traceCasperFinalizerSemantics(fixture);
  if (!baseline.finalized) {
    throw new Error(
      "Casper counterexample search requires a finalizing baseline",
    );
  }
  if (!baseline.distinctMinimumMessageCoverage) {
    throw new Error(
      "Casper counterexample search requires distinct bonded-sender minimum-message coverage",
    );
  }

  const mutationCost = options.mutationCost ?? (() => 1);
  const weighted: WeightedPossibilityResult = searchWeightedPossibility<SearchState>({
    initial: { fixture },
    stateKey: (state) => canonicalStateKey(state.fixture),
    isGoal: (state) => {
      const trace = traceCasperFinalizerSemantics(state.fixture);
      return (
        trace.checkMinMessagesPassed &&
        trace.distinctMinimumMessageCoverage &&
        !trace.finalized
      );
    },
    expand: (state) =>
      candidateMutations(state.fixture, mutationCost).map(({ fixture: next, mutation }) => ({
        to: { fixture: next },
        label: `remove-parent:${mutation.messageId}:${mutation.removedParentId}`,
        cost: mutation.cost,
        metadata: {
          messageId: mutation.messageId,
          removedParentId: mutation.removedParentId,
          mutationKind: "REMOVE_PARENT",
        },
      })),
    maxStates: options.maxStates,
  });

  const mutations: CasperCounterexampleMutation[] = weighted.witness.map((step) => {
    const messageId = step.metadata?.messageId;
    const removedParentId = step.metadata?.removedParentId;
    if (typeof messageId !== "string" || typeof removedParentId !== "string") {
      throw new Error("weighted Casper witness lost parent-deletion metadata");
    }
    return {
      messageId,
      removedParentId,
      cost: step.cost,
    };
  });

  if (weighted.status === "LIMIT_REACHED") {
    return {
      status: "LIMIT_REACHED",
      baseline,
      baselineReachability,
      minimumCost: null,
      mutations: [],
      candidate: null,
      candidateTrace: null,
      candidateReachability: null,
      exploredStates: weighted.exploredStates,
      frontierPeak: weighted.frontierPeak,
      searchModel: "reachability-valid-parent-deletions/v1",
    };
  }

  if (weighted.status === "UNREACHABLE") {
    return {
      status: "EXHAUSTED_NO_COUNTEREXAMPLE",
      baseline,
      baselineReachability,
      minimumCost: null,
      mutations: [],
      candidate: null,
      candidateTrace: null,
      candidateReachability: null,
      exploredStates: weighted.exploredStates,
      frontierPeak: weighted.frontierPeak,
      searchModel: "reachability-valid-parent-deletions/v1",
    };
  }

  const candidate = replayMutations(fixture, mutations);
  const candidateReachability = analyzeUpstreamReachability(candidate);
  const candidateTrace = traceCasperFinalizerSemantics(candidate);

  if (
    !candidateReachability.reachable ||
    !candidateTrace.checkMinMessagesPassed ||
    !candidateTrace.distinctMinimumMessageCoverage ||
    candidateTrace.finalized
  ) {
    throw new Error(
      "weighted Casper counterexample witness failed deterministic replay validation",
    );
  }

  return {
    status: "COUNTEREXAMPLE_FOUND",
    baseline,
    baselineReachability,
    minimumCost: weighted.minimumCost,
    mutations,
    candidate,
    candidateTrace,
    candidateReachability,
    exploredStates: weighted.exploredStates,
    frontierPeak: weighted.frontierPeak,
    searchModel: "reachability-valid-parent-deletions/v1",
  };
}
