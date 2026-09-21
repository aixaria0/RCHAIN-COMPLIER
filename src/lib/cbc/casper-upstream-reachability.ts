import type { ConcreteDagFixture, DagMessage } from "./casper-concrete-dag.ts";

export interface UpstreamReachabilityViolation {
  code:
    | "MISSING_PARENT"
    | "DAG_CYCLE"
    | "SEQUENCE_MISMATCH"
    | "SEEN_NOT_DERIVED_FROM_PARENTS";
  messageId: string;
  detail: string;
}

export interface UpstreamReachabilityReport {
  reachable: boolean;
  violations: UpstreamReachabilityViolation[];
}

/**
 * Checks the upstream-derived message invariants that can be evaluated without
 * running the full Rust node:
 *
 * - every justification/parent exists;
 * - the parent graph is acyclic;
 * - a sender's sequence is one more than its latest same-sender direct
 *   justification (the upstream sequence_number predicate);
 * - seen is exactly the union of parent seen-sets plus the message itself,
 *   matching rchain-community/rchain-rust casper/src/dag.rs
 *   message_from_block_metadata.
 *
 * This is an admissibility/reachability screen, not a consensus implementation.
 */
export function analyzeUpstreamReachability(
  fixture: ConcreteDagFixture,
): UpstreamReachabilityReport {
  const byId = new Map(fixture.messages.map((message) => [message.id, message]));
  const violations: UpstreamReachabilityViolation[] = [];

  for (const message of fixture.messages) {
    for (const parentId of message.parents) {
      if (!byId.has(parentId)) {
        violations.push({
          code: "MISSING_PARENT",
          messageId: message.id,
          detail: `parent ${parentId} is not present in the message map`,
        });
      }
    }

    const sameSenderParents = message.parents
      .map((id) => byId.get(id))
      .filter((parent): parent is DagMessage =>
        Boolean(parent && parent.sender === message.sender),
      );
    const latestSameSenderSeq = sameSenderParents.length === 0
      ? -1
      : Math.max(...sameSenderParents.map((parent) => parent.senderSeq));

    if (latestSameSenderSeq + 1 !== message.senderSeq) {
      violations.push({
        code: "SEQUENCE_MISMATCH",
        messageId: message.id,
        detail: `expected senderSeq ${latestSameSenderSeq + 1}, observed ${message.senderSeq}`,
      });
    }

    const expectedSeen = new Set<string>([message.id]);
    for (const parentId of message.parents) {
      const parent = byId.get(parentId);
      if (!parent) continue;
      for (const seenId of parent.seen) expectedSeen.add(seenId);
    }

    const actualSeen = new Set(message.seen);
    if (!sameSet(actualSeen, expectedSeen)) {
      violations.push({
        code: "SEEN_NOT_DERIVED_FROM_PARENTS",
        messageId: message.id,
        detail: `expected derived seen set [${[...expectedSeen].sort().join(",")}], observed [${[...actualSeen].sort().join(",")}]`,
      });
    }
  }

  const cycleIds = findCycleIds(fixture.messages);
  for (const messageId of cycleIds) {
    violations.push({
      code: "DAG_CYCLE",
      messageId,
      detail: "message participates in a parent cycle",
    });
  }

  return {
    reachable: violations.length === 0,
    violations: violations.sort(
      (a, b) => a.messageId.localeCompare(b.messageId) || a.code.localeCompare(b.code),
    ),
  };
}

export function assertUpstreamReachable(fixture: ConcreteDagFixture): void {
  const report = analyzeUpstreamReachability(fixture);
  if (!report.reachable) {
    throw new Error(report.violations.map((violation) => `${violation.code}:${violation.messageId}`).join("; "));
  }
}

function sameSet(left: Set<string>, right: Set<string>): boolean {
  if (left.size !== right.size) return false;
  for (const value of left) if (!right.has(value)) return false;
  return true;
}

function findCycleIds(messages: DagMessage[]): string[] {
  const byId = new Map(messages.map((message) => [message.id, message]));
  const state = new Map<string, 0 | 1 | 2>();
  const cycles = new Set<string>();

  const visit = (id: string, stack: string[]): void => {
    const currentState = state.get(id) ?? 0;
    if (currentState === 1) {
      for (const stackId of stack.slice(stack.indexOf(id))) cycles.add(stackId);
      return;
    }
    if (currentState === 2) return;

    state.set(id, 1);
    const message = byId.get(id);
    for (const parentId of message?.parents ?? []) {
      if (byId.has(parentId)) visit(parentId, [...stack, id]);
    }
    state.set(id, 2);
  };

  for (const message of messages) visit(message.id, []);
  return [...cycles].sort();
}
