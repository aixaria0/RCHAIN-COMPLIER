export interface SemanticDagMessage {
  id: string;
  sender: string;
  senderSeq: number;
  parents: string[];
  seen: string[];
}

export interface CasperFinalizerSemanticsInput {
  bondsMap: Record<string, number>;
  messages: SemanticDagMessage[];
  justifications: string[];
  finalized?: string[];
}

export interface CasperFinalizerSemanticsTrace {
  bondedSenders: string[];
  minimumMessageIds: string[];
  minimumMessageSenders: string[];
  checkMinMessagesPassed: boolean;
  nextLayer: Record<string, string>;
  supportMap: Record<string, Record<string, string[]>>;
  fullPartitionSupportSenders: string[];
  supportingStake: number;
  totalStake: number;
  superMajority: boolean;
  finalized: boolean;
}

/**
 * Faithful data-flow probe of the upstream Finalizer stages at
 * rchain-community/rchain-rust commit d92f0787a6096cd6d79864ec2d7c1dd9b6912d0b:
 *
 * check_min_messages -> calculate_next_layer ->
 * calculate_next_fringe_support_map -> calculate_fringe.
 *
 * It intentionally mirrors the observable control/data flow without importing
 * upstream code or pretending to be a consensus implementation.
 */
export function traceCasperFinalizerSemantics(
  input: CasperFinalizerSemanticsInput,
): CasperFinalizerSemanticsTrace {
  const byId = new Map(input.messages.map((message) => [message.id, message]));
  const bondedSenders = Object.keys(input.bondsMap).sort();
  const finalized = new Set(input.finalized ?? []);

  const selfParents = (message: SemanticDagMessage): SemanticDagMessage[] => {
    const chain: SemanticDagMessage[] = [];
    let next = message.parents
      .map((id) => byId.get(id))
      .filter((candidate): candidate is SemanticDagMessage =>
        Boolean(candidate && candidate.sender === message.sender && !finalized.has(candidate.id)),
      )
      .sort((a, b) => a.id.localeCompare(b.id));

    while (next.length > 0) {
      const current = next.pop()!;
      chain.push(current);
      next = current.parents
        .map((id) => byId.get(id))
        .filter((candidate): candidate is SemanticDagMessage =>
          Boolean(candidate && candidate.sender === message.sender && !finalized.has(candidate.id)),
        )
        .sort((a, b) => a.id.localeCompare(b.id));
    }
    return chain;
  };

  // Upstream next_fringe starts one chain per justification and takes its oldest
  // non-finalized self-parent message.
  const minimumMessages = input.justifications
    .map((id) => byId.get(id))
    .filter((message): message is SemanticDagMessage => Boolean(message))
    .map((message) => {
      const chain = [message, ...selfParents(message)];
      return chain[chain.length - 1]!;
    });

  const minimumMessageSenders = minimumMessages.map((message) => message.sender).sort();
  const checkMinMessagesPassed = minimumMessages.length === bondedSenders.length;

  const nextLayer: Record<string, SemanticDagMessage> = {};
  for (const message of minimumMessages) nextLayer[message.sender] = message;

  if (checkMinMessagesPassed) {
    const candidates = minimumMessages
      .flatMap((message) => message.parents.map((id) => byId.get(id)))
      .filter((candidate): candidate is SemanticDagMessage => Boolean(candidate))
      .filter((candidate) => Object.prototype.hasOwnProperty.call(nextLayer, candidate.sender));

    for (const candidate of candidates) {
      const current = nextLayer[candidate.sender]!;
      if (candidate.senderSeq > current.senderSeq) nextLayer[candidate.sender] = candidate;
    }
  }

  const nextLayerIds = new Set(Object.values(nextLayer).map((message) => message.id));
  const supportMap: Record<string, Record<string, string[]>> = {};

  if (checkMinMessagesPassed) {
    for (const justificationId of input.justifications) {
      const justification = byId.get(justificationId);
      if (!justification) continue;

      const parentsOfParent = justification.parents.filter((id) => !nextLayerIds.has(id));
      const seenBy: Record<string, string[]> = {};

      for (const [sender, minimumMessage] of Object.entries(nextLayer)) {
        const observers = new Set<string>();
        for (const parentId of parentsOfParent) {
          const parent = byId.get(parentId);
          if (!parent) continue;

          const selfMessages = [parent, ...selfParents(parent)];
          if (selfMessages.some((message) => message.seen.includes(minimumMessage.id))) {
            observers.add(parent.sender);
          }
        }
        if (observers.size > 0) seenBy[sender] = [...observers].sort();
      }

      if (Object.keys(seenBy).length > 0) supportMap[justification.sender] = seenBy;
    }
  }

  const bondedSet = new Set(bondedSenders);
  const fullPartitionSupportSenders = Object.entries(supportMap)
    .filter(([, seenBy]) =>
      Object.keys(seenBy).length > 0 &&
      Object.values(seenBy).every((observers) =>
        observers.length === bondedSenders.length &&
        observers.every((observer) => bondedSet.has(observer)),
      ),
    )
    .map(([sender]) => sender)
    .sort();

  const totalStake = bondedSenders.reduce((sum, sender) => sum + (input.bondsMap[sender] ?? 0), 0);
  const supportingStake = fullPartitionSupportSenders
    .reduce((sum, sender) => sum + (input.bondsMap[sender] ?? 0), 0);

  return {
    bondedSenders,
    minimumMessageIds: minimumMessages.map((message) => message.id),
    minimumMessageSenders,
    checkMinMessagesPassed,
    nextLayer: Object.fromEntries(
      Object.entries(nextLayer).sort(([a], [b]) => a.localeCompare(b)).map(([sender, message]) => [sender, message.id]),
    ),
    supportMap: Object.fromEntries(
      Object.entries(supportMap).sort(([a], [b]) => a.localeCompare(b)).map(([sender, seenBy]) => [
        sender,
        Object.fromEntries(Object.entries(seenBy).sort(([a], [b]) => a.localeCompare(b))),
      ]),
    ),
    fullPartitionSupportSenders,
    supportingStake,
    totalStake,
    superMajority: supportingStake * 3 > totalStake * 2,
    finalized: checkMinMessagesPassed && supportingStake * 3 > totalStake * 2,
  };
}
