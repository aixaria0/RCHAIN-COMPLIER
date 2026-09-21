import type { ConcreteDagFixture, DagMessage } from "./casper-concrete-dag.ts";
import { traceCasperFinalizerSemantics, type CasperFinalizerSemanticsTrace } from "./casper-finalizer-semantics.ts";

export type CasperMutation =
  | { kind: "ADD_PARENT"; messageId: string; parentId: string }
  | { kind: "ADD_SEEN"; messageId: string; seenId: string };

export interface CasperMutationSearchResult {
  baseline: CasperFinalizerSemanticsTrace;
  candidate: ConcreteDagFixture;
  candidateTrace: CasperFinalizerSemanticsTrace;
  mutations: CasperMutation[];
  mutationCount: number;
  lowerBound: number;
  minimalWithinMutationModel: boolean;
  essentialMutations: CasperMutation[];
  finalized: boolean;
}

/**
 * M11.1 constrained adversarial search.
 *
 * Mutation model:
 *   - only add parents from the first delivery layer (a1..d1) to the
 *     justification messages (a2..d2);
 *   - only add first-layer seen references to next-layer minimum messages.
 *
 * The search asks for the smallest mutation set in this model that reaches
 * Law-14 finalization while retaining minimum-message coverage.
 */
export function searchFinalizingMutation(fixture: ConcreteDagFixture): CasperMutationSearchResult {
  const baseline = traceCasperFinalizerSemantics(fixture);
  const bonded = Object.keys(fixture.bondsMap).sort();
  const byId = new Map(fixture.messages.map((message) => [message.id, message]));

  const justificationMessages = fixture.justifications
    .map((id) => byId.get(id))
    .filter((message): message is DagMessage => Boolean(message));
  const layerOne = fixture.messages
    .filter((message) => message.senderSeq === 1 && bonded.includes(message.sender))
    .sort((a, b) => a.id.localeCompare(b.id));

  const mutations: CasperMutation[] = [];

  for (const justification of justificationMessages) {
    const existingParentIds = new Set(justification.parents);
    for (const sender of bonded) {
      const representative = layerOne.find((message) => message.sender === sender);
      if (representative && !existingParentIds.has(representative.id)) {
        mutations.push({
          kind: "ADD_PARENT",
          messageId: justification.id,
          parentId: representative.id,
        });
      }
    }
  }

  const nextLayerIds = bonded
    .map((sender) => baseline.nextLayer[sender])
    .filter((id): id is string => Boolean(id))
    .sort();

  for (const observer of layerOne) {
    const seen = new Set(observer.seen);
    for (const minimumMessageId of nextLayerIds) {
      if (!seen.has(minimumMessageId)) {
        mutations.push({
          kind: "ADD_SEEN",
          messageId: observer.id,
          seenId: minimumMessageId,
        });
      }
    }
  }

  const parentLowerBound = justificationMessages.reduce((count, justification) => {
    const existing = new Set(justification.parents);
    return count + bonded.filter((sender) => {
      const representative = layerOne.find((message) => message.sender === sender);
      return Boolean(representative && !existing.has(representative.id));
    }).length;
  }, 0);
  const seenLowerBound = layerOne.length * nextLayerIds.length;
  const lowerBound = parentLowerBound + seenLowerBound;

  const candidate = applyMutations(fixture, mutations);
  const candidateTrace = traceCasperFinalizerSemantics(candidate);

  const finalized = candidateTrace.checkMinMessagesPassed && candidateTrace.finalized;

  const essentialMutations = mutations.filter((mutation, index) => {
    const reduced = applyMutations(fixture, mutations.filter((_, i) => i !== index));
    const trace = traceCasperFinalizerSemantics(reduced);
    return !trace.finalized;
  });

  return {
    baseline,
    candidate,
    candidateTrace,
    mutations,
    mutationCount: mutations.length,
    lowerBound,
    minimalWithinMutationModel: finalized && essentialMutations.length === mutations.length && lowerBound === mutations.length,
    essentialMutations,
    finalized,
  };
}

function applyMutations(fixture: ConcreteDagFixture, mutations: CasperMutation[]): ConcreteDagFixture {
  const messages = fixture.messages.map((message) => ({
    ...message,
    parents: [...message.parents],
    seen: [...message.seen],
  }));

  const byId = new Map(messages.map((message) => [message.id, message]));
  for (const mutation of mutations) {
    const target = byId.get(mutation.messageId);
    if (!target) throw new Error(`unknown mutation target: ${mutation.messageId}`);

    const values = mutation.kind === "ADD_PARENT" ? target.parents : target.seen;
    const value = mutation.kind === "ADD_PARENT" ? mutation.parentId : mutation.seenId;
    if (!values.includes(value)) values.push(value);
  }

  return {
    bondsMap: { ...fixture.bondsMap },
    messages,
    justifications: [...fixture.justifications],
  };
}
