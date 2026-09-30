import assert from "node:assert/strict";
import test from "node:test";
import { createEvent } from "./protocol.ts";
import { decide, replay } from "./replay.ts";
import { verificationBody } from "./verification.ts";
import { fixture } from "./fixtures.ts";
function scenario() {
  const f = fixture(),
    challenge = f.emit(f.a, { kind: "challenge", claimId: f.bad.id, reason: "sum disagrees" }),
    request = f.emit(f.a, {
      kind: "verification_request",
      claimId: f.bad.id,
      evidenceIds: [f.badEvidence.id],
      verifier: "integer-sum/v1",
    });
  const events = [f.good, f.bad, f.goodEvidence, f.badEvidence, challenge, request];
  const verification = f.emit(
    f.b,
    verificationBody(request, new Map(events.map((e) => [e.id, e]))),
  );
  return { ...f, challenge, request, verification, events: [...events, verification] };
}
test("high confidence and supporting evidence alone leave a claim unverified", () => {
  const f = scenario(),
    v = replay([f.bad, f.badEvidence], f.policy);
  assert.equal(v.claims[0]!.status, "UNVERIFIED");
});
test("challenge and deterministic refutation retain disagreement and provenance", () => {
  const f = scenario(),
    v = replay(f.events, f.policy);
  const bad = v.claims.find((c) => c.id === f.bad.id)!;
  assert.equal(bad.status, "REFUTED");
  assert.deepEqual(bad.challengeIds, [f.challenge.id]);
  assert.equal(v.disagreements.length, 1);
  assert.equal(v.verifications[0]!.locallyReproduced, true);
});
test("signed false receipts remain visible but cannot validate a claim", () => {
  const f = scenario(),
    falseReceipt = f.emit(f.b, {
      ...verificationBody(f.request, new Map(f.events.map((e) => [e.id, e]))),
      verdict: "SUPPORTED",
    });
  const v = replay([...f.events.filter((e) => e.id !== f.verification.id), falseReceipt], f.policy);
  assert.equal(v.claims.find((c) => c.id === f.bad.id)!.status, "UNVERIFIED");
  assert.equal(v.verifications[0]!.locallyReproduced, false);
  assert.match(v.blocked[0]!.reason, /reproduction/);
});
test("unknown verifier and mismatched input binding cannot confer validation", () => {
  const f = scenario(),
    request = f.emit(f.a, {
      kind: "verification_request",
      claimId: f.bad.id,
      evidenceIds: [f.goodEvidence.id],
      verifier: "unknown/v1",
    }),
    receipt = f.emit(f.b, {
      kind: "verification",
      requestId: request.id,
      claimId: f.bad.id,
      evidenceIds: [f.goodEvidence.id],
      verifier: "unknown/v1",
      verdict: "SUPPORTED",
      artifact: { schema: "fake" },
    });
  const v = replay([...f.events, request, receipt], f.policy);
  assert.equal(v.verifications.find((r) => r.id === receipt.id)!.locallyReproduced, false);
  assert.ok(v.blocked.some((b) => b.id === request.id));
});
test("missing parents remain pending until dependencies arrive", () => {
  const f = scenario(),
    v = replay([f.request, f.verification], f.policy);
  assert.equal(v.pending.length, 2);
  assert.equal(v.verifications.length, 0);
  assert.equal(replay(f.events, f.policy).pending.length, 0);
});
test("100 seeded duplicate and reordering schedules reproduce the same complete-set view", () => {
  const f = scenario(),
    expected = replay(f.events, f.policy);
  let seed = 270921;
  for (let n = 0; n < 100; n++) {
    const events = [...f.events, ...f.events.slice(0, 3)];
    for (let i = events.length - 1; i > 0; i--) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const j = seed % (i + 1);
      [events[i], events[j]] = [events[j]!, events[i]!];
    }
    assert.deepEqual(replay(events, f.policy), expected);
  }
});
test("equivocation preserves both signed events and quarantines dependents", () => {
  const f = scenario(),
    fork = createEvent(f.b, f.policy, { sequence: f.bad.sequence, body: f.claimBody(14) });
  const v = replay([...f.events, fork], f.policy);
  assert.equal(v.equivocations.length, 1);
  assert.equal(v.claims.find((c) => c.id === f.bad.id)!.status, "QUARANTINED");
  assert.equal(v.verifications.length, 0);
});
test("explicit decisions retain rejected and unresolved conclusions", () => {
  const f = scenario(),
    v = replay(f.events, f.policy),
    claimIds = [f.good.id, f.bad.id],
    verificationIds = [f.verification.id],
    result = decide(claimIds, verificationIds, v.verifications);
  assert.deepEqual(result, { accepted: [], rejected: [f.bad.id], unresolved: [f.good.id] });
  const decision = f.emit(f.a, {
    kind: "decision",
    procedure: "evidence-cut/v1",
    claimIds,
    verificationIds,
    result,
  });
  assert.equal(replay([...f.events, decision], f.policy).decisions[0]!.valid, true);
  const fake = f.emit(f.a, {
    kind: "decision",
    procedure: "evidence-cut/v1",
    claimIds,
    verificationIds,
    result: { accepted: claimIds, rejected: [], unresolved: [] },
  });
  assert.equal(replay([...f.events, fake], f.policy).decisions[0]!.valid, false);
});
test("agreement cannot outvote a reproduced counterexample", () => {
  const f = scenario(),
    clones = Array.from({ length: 5 }, () => f.emit(f.a, f.claimBody(13))),
    v = replay([...f.events, ...clones], f.policy);
  assert.equal(v.claims.find((c) => c.id === f.bad.id)!.status, "REFUTED");
  assert.ok(clones.every((e) => v.claims.find((c) => c.id === e.id)!.status === "UNVERIFIED"));
});
test("assumption ordering and clock skew do not hide contradiction", () => {
  const f = fixture(),
    left = f.emit(f.a, { ...f.claimBody(12), assumptions: ["a", "b"] }),
    right = createEvent(f.b, f.policy, {
      sequence: 20,
      body: { ...f.claimBody(13), assumptions: ["b", "a"] },
      issuedAt: "1970-01-01T00:00:00.000Z",
    });
  assert.equal(replay([left, right], f.policy).disagreements.length, 1);
  assert.deepEqual(replay([right, left], f.policy), replay([left, right], f.policy));
});
