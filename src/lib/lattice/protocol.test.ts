import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  artifactDigest,
  canonical,
  createEvent,
  generateIdentity,
  MAX_EVENT_BYTES,
  parseCanonical,
  validateEvent,
} from "./protocol.ts";
import { fixture } from "./fixtures.ts";
test("canonical golden bytes and hashes are stable", () => {
  const expected = '{"a":1,"b":[true,"tea",null]}';
  assert.equal(canonical({ b: [true, "tea", null], a: 1 }), expected);
  assert.equal(
    artifactDigest({ a: 1, b: [true, "tea", null] }),
    "sha256:" + createHash("sha256").update(expected).digest("hex"),
  );
  assert.equal(canonical({ message: "چای" }), '{"message":"چای"}');
});
test("unsupported objects, accessors, ambiguous numbers and cycles fail closed", () => {
  const cycle: Record<string, unknown> = {};
  cycle.self = cycle;
  let called = false;
  const getter = Object.defineProperty({}, "a", {
    enumerable: true,
    get() {
      called = true;
      return 1;
    },
  });
  for (const value of [
    new Date(),
    new Map(),
    new Set(),
    Object.create({}),
    undefined,
    NaN,
    Infinity,
    -0,
    1.5,
    2 ** 53,
    [undefined],
    Array(2),
    cycle,
    getter,
    { "bad-key": 1 },
    "\uD800",
  ])
    assert.throws(() => canonical(value));
  assert.equal(called, false);
});
test("noncanonical wire, duplicate keys, BOM and malformed UTF-8 are rejected", () => {
  for (const wire of ['{"a":1,"a":1}', '{ "a":1}', '{"a":1.0}', '{"a":1e0}', '{"a":"\\u0061"}'])
    assert.throws(() => parseCanonical(wire));
  assert.throws(() => parseCanonical(Buffer.from([0xc0, 0xaf])));
  assert.throws(() =>
    parseCanonical(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('{"a":1}')])),
  );
  assert.deepEqual(parseCanonical('{"a":1}'), { a: 1 });
});
test("depth, shape and byte budgets are enforced", () => {
  assert.throws(() => canonical("x".repeat(MAX_EVENT_BYTES)));
  assert.throws(() => canonical(Array(257).fill(0)));
  let value: unknown = 1;
  for (let i = 0; i < 14; i++) value = { a: value };
  assert.throws(() => canonical(value));
});
test("tampering, unknown schema, foreign policy and unadmitted identities fail admission", () => {
  const f = fixture();
  assert.throws(() => validateEvent({ ...f.good, body: f.claimBody(999) }, f.policy));
  assert.throws(() => validateEvent({ ...f.good, schema: "future/v2" }, f.policy));
  assert.throws(() => validateEvent({ ...f.good, unknown: 1 }, f.policy));
  assert.throws(() => validateEvent(f.good, { ...f.policy, latticeId: "other" }));
  assert.throws(() => validateEvent(f.good, { ...f.policy, members: [f.policy.members[1]!] }));
  assert.throws(() =>
    createEvent(generateIdentity(), f.policy, { sequence: 1, body: f.claimBody(12) }),
  );
});
test("event kind and claim domain require explicit membership scope", () => {
  const f = fixture();
  assert.throws(() => f.emit(f.a, { ...f.claimBody(12), domain: "forecasting" }));
  assert.throws(() =>
    createEvent(
      f.a,
      { ...f.policy, members: f.policy.members.map((m) => ({ ...m, kinds: ["claim"] })) },
      { sequence: 1, body: { kind: "challenge", claimId: f.bad.id, reason: "not authorized" } },
    ),
  );
});
test("content digest, direct parents and asserted confidence have separate validation", () => {
  const f = fixture();
  assert.throws(() =>
    f.emit(f.a, {
      kind: "evidence",
      claimId: f.good.id,
      relation: "supports",
      method: "fixture",
      artifact: {
        digest: artifactDigest({ wrong: 1 }),
        mediaType: "application/json",
        content: f.input,
      },
    }),
  );
  assert.throws(() =>
    f.emit(f.a, { ...f.claimBody(12), confidence: { ppm: 1000001, basis: "outside bounds" } }),
  );
  assert.ok(f.goodEvidence.parents.includes(f.good.id));
  assert.throws(() => validateEvent({ ...f.goodEvidence, parents: [] }, f.policy));
});
test("admission returns a detached snapshot", () => {
  const f = fixture(),
    copy = validateEvent(f.good, f.policy);
  f.good.body = f.claimBody(999);
  assert.equal(copy.body.kind === "claim" && copy.body.value, 12);
  assert.doesNotThrow(() => validateEvent(copy, f.policy));
});
