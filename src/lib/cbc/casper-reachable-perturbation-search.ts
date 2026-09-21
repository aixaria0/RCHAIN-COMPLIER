import type { ConcreteDagFixture } from "./casper-concrete-dag.ts";
import { analyzeUpstreamReachability } from "./casper-upstream-reachability.ts";
import { traceCasperFinalizerSemantics, type CasperFinalizerSemanticsTrace } from "./casper-finalizer-semantics.ts";

export interface ReachableParentDeletion {
  messageId: string;
  removedParentId: string;
}

export interface ReachablePerturbationResult {
  baseline: CasperFinalizerSemanticsTrace;
  candidate: ConcreteDagFixture;
  candidateTrace: CasperFinalizerSemanticsTrace;
  reachability: ReturnType<typeof analyzeUpstreamReachability>;
  mutation: ReachableParentDeletion;
  mutationCount: 1;
}

/**
 * Searches one-edge, reachability-preserving deletions from a causally valid
 * finalizing history. The seen sets are re-derived from the resulting parent
 * graph exactly as upstream constructs them.
 */
export function searchReachableFinalizationFlip(
  fixture: ConcreteDagFixture,
): ReachablePerturbationResult[] {
  const baseline = traceCasperFinalizerSemantics(fixture);
  if (!baseline.finalized) {
    throw new Error("reachable perturbation search requires a finalizing baseline");
  }

  const candidates: ReachablePerturbationResult[] = [];
  for (const message of fixture.messages) {
    if (message.parents.length === 0) continue;

    for (const parentId of message.parents) {
      const candidate = removeParentAndRecomputeSeen(fixture, message.id, parentId);
      const reachability = analyzeUpstreamReachability(candidate);
      if (!reachability.reachable) continue;

      const candidateTrace = traceCasperFinalizerSemantics(candidate);
      if (
        candidateTrace.checkMinMessagesPassed &&
        candidateTrace.messageCoverage &&
        !candidateTrace.finalized
      ) {
        candidates.push({
          baseline,
          candidate,
          candidateTrace,
          reachability,
          mutation: { messageId: message.id, removedParentId: parentId },
          mutationCount: 1,
        });
      }
    }
  }

  return candidates.sort((a, b) =>
    a.mutation.messageId.localeCompare(b.mutation.messageId) ||
    a.mutation.removedParentId.localeCompare(b.mutation.removedParentId),
  );
}

function removeParentAndRecomputeSeen(
  fixture: ConcreteDagFixture,
  messageId: string,
  parentId: string,
): ConcreteDagFixture {
  const messages = fixture.messages.map((message) => ({
    ...message,
    parents: message.id === messageId
      ? message.parents.filter((id) => id !== parentId)
      : [...message.parents],
    seen: [],
  }));

  const byId = new Map(messages.map((message) => [message.id, message]));
  for (const message of messages) {
    const seen = new Set<string>([message.id]);
    for (const currentParentId of message.parents) {
      const parent = byId.get(currentParentId);
      if (!parent) continue;
      for (const seenId of parent.seen) seen.add(seenId);
    }
    message.seen = [...seen].sort();
  }

  return {
    bondsMap: { ...fixture.bondsMap },
    messages,
    justifications: [...fixture.justifications],
  };
}
