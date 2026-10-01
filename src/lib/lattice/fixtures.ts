import {
  artifactDigest,
  createEvent,
  EVENT_KINDS,
  generateIdentity,
  type EventBody,
  type Identity,
  type MembershipPolicy,
} from "./protocol.ts";
export function fixture() {
  const a = generateIdentity(),
    b = generateIdentity();
  const policy: MembershipPolicy = {
    schema: "intelligence-lattice-policy/v1",
    latticeId: "conformance",
    members: [a, b].map((i) => ({
      actorId: i.actorId,
      publicKeyHex: i.publicKeyHex,
      kinds: [...EVENT_KINDS],
      domains: ["arithmetic"],
    })),
  };
  const sequences = new Map<string, number>();
  const emit = (i: Identity, body: EventBody, parents?: string[]) => {
    const sequence = (sequences.get(i.actorId) ?? 0) + 1;
    sequences.set(i.actorId, sequence);
    return createEvent(i, policy, {
      sequence,
      body,
      parents,
      issuedAt: "2026-09-30T00:00:00.000Z",
    });
  };
  const input = { schema: "integer-sum-input/v1", values: [2, 3, 7] };
  const claimBody = (value: number): Extract<EventBody, { kind: "claim" }> => ({
    kind: "claim",
    subject: artifactDigest(input),
    predicate: "integer-sum",
    value,
    domain: "arithmetic",
    method: "independent-calculation",
    assumptions: ["declared input is complete"],
    confidence: { ppm: 990000, basis: "producer assertion, uncalibrated" },
    falsifier: "independently sum the declared integers",
  });
  const good = emit(a, claimBody(12)),
    bad = emit(b, claimBody(13));
  const evidence = (i: Identity, claimId: string) =>
    emit(i, {
      kind: "evidence",
      claimId,
      relation: "supports",
      artifact: { digest: artifactDigest(input), mediaType: "application/json", content: input },
      method: "declared input bytes",
    });
  const goodEvidence = evidence(a, good.id),
    badEvidence = evidence(b, bad.id);
  return { a, b, policy, input, emit, claimBody, good, bad, goodEvidence, badEvidence };
}
