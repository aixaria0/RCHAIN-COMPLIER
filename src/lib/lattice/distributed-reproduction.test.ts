import assert from "node:assert/strict";
import test from "node:test";
import {
  artifactDigest,
  createEvent,
  EVENT_KINDS,
  generateIdentity,
  type EventBody,
  type Identity,
  type LatticeEvent,
  type MembershipPolicy,
} from "./protocol.ts";
import { replay } from "./replay.ts";
import { verificationBody } from "./verification.ts";

test("three independent actors preserve TaskEnvelope provenance, reject invalid work and replay identically", () => {
  const a = generateIdentity(),
    b = generateIdentity(),
    c = generateIdentity(),
    policy: MembershipPolicy = {
      schema: "intelligence-lattice-policy/v1",
      latticeId: "three-actor-reproduction-v1",
      members: [a, b, c].map((i) => ({
        actorId: i.actorId,
        publicKeyHex: i.publicKeyHex,
        kinds: [...EVENT_KINDS],
        domains: ["arithmetic"],
      })),
    },
    sequences = new Map<string, number>();
  function emit(identity: Identity, body: EventBody, parents: string[] = []) {
    const sequence = (sequences.get(identity.actorId) ?? 0) + 1;
    sequences.set(identity.actorId, sequence);
    return createEvent(identity, policy, { sequence, body, parents });
  }

  const input = { schema: "integer-sum-input/v1", values: [2, 3, 7] },
    subject = artifactDigest(input),
    task = emit(a, {
      kind: "task",
      envelope: {
        schema: "intelligence-lattice-task/v1",
        taskId: artifactDigest({ purpose: "three-actor deterministic sum" }),
        domain: "arithmetic",
        operation: "independent-calculation",
        input: { digest: subject, mediaType: "application/json", content: input },
        dependencies: [],
        authority: { mode: "observe-only", issuer: a.actorId },
        output: { mediaType: "application/json", claimPredicate: "integer-sum" },
      },
    }),
    claimBody = (value: number, method = "independent-calculation"): Extract<EventBody, { kind: "claim" }> => ({
      kind: "claim",
      subject,
      predicate: "integer-sum",
      value,
      domain: "arithmetic",
      method,
      assumptions: ["declared input is complete"],
      confidence: { ppm: 900000, basis: "producer assertion only" },
      falsifier: "recompute exact declared integers",
    }),
    good = emit(b, claimBody(12), [task.id]),
    invalid = emit(c, claimBody(13, "wrong-operation"), [task.id]),
    evidence = emit(a, {
      kind: "evidence",
      claimId: good.id,
      relation: "supports",
      method: "declared input bytes",
      artifact: { digest: subject, mediaType: "application/json", content: input },
    }),
    request = emit(a, {
      kind: "verification_request",
      claimId: good.id,
      evidenceIds: [evidence.id],
      verifier: "integer-sum/v1",
    }),
    baseEvents: LatticeEvent[] = [task, good, invalid, evidence, request],
    eventMap = new Map(baseEvents.map((e) => [e.id, e])),
    receiptB = emit(b, verificationBody(request, eventMap)),
    receiptC = emit(c, verificationBody(request, eventMap)),
    all = [...baseEvents, receiptB, receiptC],
    view = replay(all, policy);

  const cert = view.reproductionCertificates.find(
    (x) => x.claimId === good.id && x.verdict === "SUPPORTED",
  );
  assert.ok(cert);
  assert.equal(cert.valid, true);
  assert.equal(cert.independentlyReproduced, 2);
  assert.deepEqual(cert.actorIds, [b.actorId, c.actorId].sort());
  assert.equal(cert.taskId, task.id);

  const badView = view.claims.find((x) => x.id === invalid.id)!;
  assert.equal(badView.taskProvenanceValid, false);
  assert.ok(view.blocked.some((x) => x.id === invalid.id && /task provenance/.test(x.reason)));

  const schedules = [
    [...all].reverse(),
    [receiptC, task, invalid, request, good, receiptB, evidence],
    [...all, ...all.slice(0, 3)],
  ];
  for (const schedule of schedules) assert.deepEqual(replay(schedule, policy), view);

  const beforeRejoin = replay(all.filter((e) => e.id !== receiptC.id), policy);
  assert.equal(
    beforeRejoin.reproductionCertificates.find((x) => x.claimId === good.id)!.valid,
    false,
  );
  assert.deepEqual(replay([...all.filter((e) => e.id !== receiptC.id), receiptC], policy), view);
});
