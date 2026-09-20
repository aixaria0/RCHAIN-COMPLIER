export interface DagMessage {
  id: string;
  sender: string;
  senderSeq: number;
  parents: string[];
  seen: string[];
}

export interface ConcreteDagFixture {
  bondsMap: Record<string, number>;
  messages: DagMessage[];
  justifications: string[];
}

export interface ConcreteDagTrace {
  minimumMessages: string[];
  minimumMessageSenders: string[];
  supportObservers: Record<string, string[]>;
  superMajority: boolean;
  messageCoverage: boolean;
  upstreamGate: "BLOCKED_BEFORE_FRINGE" | "FRINGE_STAGE_REACHABLE";
}

/**
 * Small deterministic message/DAG generator.
 *
 * It intentionally models only the data-flow needed to answer the current
 * research question: can a valid delivery history produce the observation
 * consumed by the Casper law probe? It is not an upstream consensus clone.
 */
export function buildConcreteDAG(): ConcreteDagFixture {
  const bondsMap = { v0: 70, v1: 10, v2: 10, v3: 10 };
  const messages: DagMessage[] = [
    { id: "g", sender: "v0", senderSeq: 0, parents: [], seen: ["g"] },
    { id: "a1", sender: "v0", senderSeq: 1, parents: ["g"], seen: ["g", "a1"] },
    { id: "b1", sender: "v1", senderSeq: 1, parents: ["a1"], seen: ["g", "a1", "b1"] },
    { id: "c1", sender: "v2", senderSeq: 1, parents: ["b1"], seen: ["g", "a1", "b1", "c1"] },
    { id: "d1", sender: "v3", senderSeq: 1, parents: ["c1"], seen: ["g", "a1", "b1", "c1", "d1"] },
    { id: "a2", sender: "v0", senderSeq: 2, parents: ["b1", "c1", "d1"], seen: ["g", "a1", "b1", "c1", "d1", "a2"] },
    { id: "b2", sender: "v1", senderSeq: 2, parents: ["a2"], seen: ["g", "a1", "b1", "c1", "d1", "a2", "b2"] },
    { id: "c2", sender: "v2", senderSeq: 2, parents: ["a2"], seen: ["g", "a1", "b1", "c1", "d1", "a2", "c2"] },
    { id: "d2", sender: "v3", senderSeq: 2, parents: ["a2"], seen: ["g", "a1", "b1", "c1", "d1", "a2", "d2"] },
  ];

  return { bondsMap, messages, justifications: ["a2", "b2", "c2", "d2"] };
}

function ancestors(id: string, byId: Map<string, DagMessage>): Set<string> {
  const out = new Set<string>();
  const queue = [id];
  while (queue.length) {
    const current = queue.pop()!;
    if (out.has(current)) continue;
    out.add(current);
    for (const parent of byId.get(current)?.parents ?? []) queue.push(parent);
  }
  return out;
}

export function traceConcreteDAG(fixture: ConcreteDagFixture): ConcreteDagTrace {
  const byId = new Map(fixture.messages.map((m) => [m.id, m]));
  const bonded = Object.keys(fixture.bondsMap).sort();
  const minimumMessages = bonded
    .map((sender) => fixture.justifications
      .map((id) => byId.get(id))
      .filter((m): m is DagMessage => Boolean(m && m.sender === sender))
      .sort((a, b) => a.senderSeq - b.senderSeq)[0])
    .filter((m): m is DagMessage => Boolean(m));

  const minimumMessageSenders = minimumMessages.map((m) => m.sender).sort();
  const supportObservers: Record<string, string[]> = {};

  for (const sender of bonded) {
    const justification = fixture.justifications
      .map((id) => byId.get(id))
      .find((m) => m?.sender === sender);
    if (!justification) continue;
    const seen = ancestors(justification.id, byId);
    const observers = fixture.messages
      .filter((m) => bonded.includes(m.sender) && m.seen.some((id) => seen.has(id)))
      .map((m) => m.sender);
    supportObservers[sender] = [...new Set(observers)].sort();
  }

  const fullSupport = bonded.every((sender) =>
    (supportObservers[sender] ?? []).length === bonded.length,
  );
  const total = Object.values(fixture.bondsMap).reduce((a, b) => a + b, 0);
  const supportingStake = bonded
    .filter((sender) => (supportObservers[sender] ?? []).length === bonded.length)
    .reduce((sum, sender) => sum + fixture.bondsMap[sender], 0);

  return {
    minimumMessages: minimumMessages.map((m) => m.id),
    minimumMessageSenders,
    supportObservers,
    superMajority: supportingStake * 3 > total * 2,
    messageCoverage: minimumMessageSenders.length === bonded.length,
    upstreamGate: minimumMessageSenders.length === bonded.length
      ? "FRINGE_STAGE_REACHABLE"
      : "BLOCKED_BEFORE_FRINGE",
  };
}
