import test from "node:test";
import assert from "node:assert/strict";
import {
  canonical,
  artifactDigest,
  createEvent,
  EVENT_KINDS,
  generateIdentity,
  policyDigest,
  type LatticeEvent,
  type MembershipPolicy,
} from "../lattice/protocol.ts";
import { CORE_VERIFIERS, verificationBody } from "../lattice/verification.ts";
import { createSubmission, validateWorkload, type Workload } from "./submission.ts";
import {
  exportEvidence,
  packageDigest,
  parseEvidence,
  verifyEvidence,
  MAX_PACKAGE_BYTES,
} from "./package.ts";

function fixture(value = 10, operation = "integer-sum/v1") {
  const identities = Array.from({ length: 3 }, () => generateIdentity());
  const policy: MembershipPolicy = {
    schema: "intelligence-lattice-policy/v1",
    latticeId: "product-test",
    members: identities.map((i) => ({
      actorId: i.actorId,
      publicKeyHex: i.publicKeyHex,
      kinds: [...EVENT_KINDS],
      domains: ["*"],
    })),
  };
  const workload: Workload = {
    schema: "assurance-workload/v1",
    domain: "arithmetic",
    operation,
    predicate: "integer-sum",
    input: { schema: "integer-sum-input/v1", values: [2, 3, 5] },
    value,
  };
  const submission = createSubmission(
    workload,
    identities[0]!,
    policy,
    1,
    "2026-10-01T00:00:00.000Z",
  );
  const events = [...submission.events],
    request = events[3]!;
  if (CORE_VERIFIERS.has(operation))
    for (const identity of identities.slice(1))
      events.push(
        createEvent(identity, policy, {
          sequence: 1,
          issuedAt: "2026-10-01T00:00:00.000Z",
          body: verificationBody(request, new Map(events.map((e) => [e.id, e])), CORE_VERIFIERS),
        }),
      );
  const context = {
    expectedPolicyDigest: policyDigest(policy),
    expectedTaskId: submission.taskId,
    expectedClaimId: submission.claimId,
  };
  const bytes = exportEvidence(events, policy, submission);
  return { identities, policy, workload, submission, events, context, bytes };
}

test("canonical package export is order/duplicate invariant and independently verifies", () => {
  const f = fixture(),
    bytes = exportEvidence([...f.events].reverse().concat(f.events), f.policy, f.submission);
  assert.deepEqual(bytes, f.bytes);
  const report = verifyEvidence(bytes, {
    ...f.context,
    expectedPackageDigest: packageDigest(bytes),
  });
  assert.equal(report.status, "PASS");
  assert.equal(report.verifierActorIds.length, 2);
  assert.equal(parseEvidence(bytes).events.length, 6);
});

test("valid signatures cannot substitute policy, task, claim or task provenance", () => {
  const f = fixture(),
    other = fixture();
  for (const changed of [
    { expectedPolicyDigest: other.context.expectedPolicyDigest },
    { expectedTaskId: `sha256:${"0".repeat(64)}` },
    { expectedClaimId: other.context.expectedClaimId },
  ])
    assert.equal(verifyEvidence(f.bytes, { ...f.context, ...changed }).code, "BINDING_MISMATCH");
  const task = f.events[0]!;
  assert.equal(task.body.kind, "task");
  if (task.body.kind !== "task") return;
  const wrong = createEvent(f.identities[0]!, f.policy, {
    sequence: 5,
    body: {
      kind: "task",
      envelope: { ...task.body.envelope, operation: "another-operation/v1" },
    },
  });
  const bytes = exportEvidence([...f.events, wrong], f.policy, {
    ...f.submission,
    taskEventId: wrong.id,
  });
  assert.equal(verifyEvidence(bytes, f.context).code, "BINDING_MISMATCH");
});

test("absent quorum, unsupported verifier and a reproduced false claim have distinct outcomes", () => {
  const f = fixture();
  assert.equal(
    verifyEvidence(exportEvidence(f.events.slice(0, -1), f.policy, f.submission), f.context).code,
    "QUORUM_MISSING",
  );
  const unsupported = fixture(10, "unregistered/v1");
  assert.equal(verifyEvidence(unsupported.bytes, unsupported.context).code, "UNSUPPORTED_VERIFIER");
  const falseClaim = fixture(11),
    report = verifyEvidence(falseClaim.bytes, falseClaim.context);
  assert.equal(report.status, "FAIL");
  assert.equal(report.code, "CLAIM_REFUTED");
  // Submitter receipts do not count as independent verification.
  const request = f.events[3]!;
  const own = createEvent(f.identities[0]!, f.policy, {
    sequence: 5,
    body: verificationBody(request, new Map(f.events.map((e) => [e.id, e])), CORE_VERIFIERS),
  });
  const bytes = exportEvidence([...f.events.slice(0, -1), own], f.policy, f.submission);
  assert.equal(verifyEvidence(bytes, f.context).status, "BLOCKED");
});

test("missing dependencies, validly signed false receipts and equivocation cannot pass", () => {
  const f = fixture();
  const missing = exportEvidence(
    f.events.filter((e) => e !== f.events[2]),
    f.policy,
    f.submission,
  );
  assert.equal(verifyEvidence(missing, f.context).status, "BLOCKED");
  const receipt = f.events.at(-1)!;
  if (receipt.body.kind !== "verification") return;
  const falseReceipt = createEvent(f.identities[2]!, f.policy, {
    sequence: 1,
    body: { ...receipt.body, verdict: "REFUTED" },
  });
  const bad = exportEvidence([...f.events.slice(0, -1), falseReceipt], f.policy, f.submission);
  assert.equal(verifyEvidence(bad, f.context).status, "BLOCKED");
  const forked = exportEvidence([...f.events, falseReceipt], f.policy, f.submission);
  assert.equal(verifyEvidence(forked, f.context).status, "BLOCKED");
});

test("validly signed wrong-input evidence and wrong-operation requests fail task binding", () => {
  const f = fixture(),
    evidence = f.events[2]!,
    request = f.events[3]!;
  if (evidence.body.kind !== "evidence" || request.body.kind !== "verification_request") return;
  const foreign = createEvent(f.identities[0]!, f.policy, {
    sequence: 5,
    body: {
      ...evidence.body,
      artifact: { ...evidence.body.artifact, content: { x: 1 }, digest: artifactDigest({ x: 1 }) },
    },
  });
  const wrongInput = exportEvidence([...f.events, foreign], f.policy, f.submission);
  assert.equal(verifyEvidence(wrongInput, f.context).code, "BINDING_MISMATCH");
  const wrongRequest = createEvent(f.identities[0]!, f.policy, {
    sequence: 5,
    body: { ...request.body, verifier: "different/v1" },
  });
  const bytes = exportEvidence([...f.events, wrongRequest], f.policy, f.submission);
  assert.equal(verifyEvidence(bytes, f.context).code, "BINDING_MISMATCH");
});

test("unrelated unsupported tasks stay retained without poisoning a valid target", () => {
  const f = fixture(),
    other = createSubmission(
      { ...f.workload, operation: "unknown/v1" },
      f.identities[0]!,
      f.policy,
      5,
    );
  const bytes = exportEvidence([...f.events, ...other.events], f.policy, f.submission);
  assert.equal(verifyEvidence(bytes, f.context).status, "PASS");
});

test("malformed, ambiguous, truncated, reordered and oversized bytes fail closed", () => {
  const f = fixture(),
    lines = Buffer.from(f.bytes).toString("utf8").trimEnd().split("\n");
  const mutations = [
    Buffer.from(f.bytes).subarray(0, f.bytes.length - 1),
    Buffer.from("\ufeff" + Buffer.from(f.bytes).toString()),
    Buffer.from(lines.join("\r\n") + "\r\n"),
    Buffer.from([lines[0], ...lines.slice(1).reverse()].join("\n") + "\n"),
    Buffer.from(
      Buffer.from(f.bytes).toString().replace('"eventCount":6', '"eventCount":6,"eventCount":6'),
    ),
    Buffer.alloc(MAX_PACKAGE_BYTES + 1),
    Buffer.from([0xc0, 0xaf, 10]),
  ];
  for (const bytes of mutations) assert.equal(verifyEvidence(bytes, f.context).status, "FAIL");
  const events = f.events.map((e) => ({ ...e })) as LatticeEvent[];
  events[0]!.signatureHex = "0".repeat(128);
  const corrupted = Buffer.from(
    [lines[0], ...events.sort((a, b) => (a.id < b.id ? -1 : 1)).map((e) => canonical(e))].join(
      "\n",
    ) + "\n",
  );
  assert.equal(verifyEvidence(corrupted, f.context).status, "FAIL");
});

test("retained package digest detects removal even when an attacker repairs the manifest", () => {
  const f = fixture();
  const fewer = exportEvidence(f.events.slice(0, -1), f.policy, f.submission);
  assert.equal(
    verifyEvidence(fewer, { ...f.context, expectedPackageDigest: packageDigest(f.bytes) }).code,
    "INTEGRITY_MISMATCH",
  );
});

test("seeded bounded adversarial mutations never gain PASS", () => {
  const f = fixture();
  let seed = 1701;
  for (let i = 0; i < 100; i++) {
    seed = (1664525 * seed + 1013904223) >>> 0;
    const bytes = Buffer.from(f.bytes),
      index = seed % bytes.length;
    bytes[index] = bytes[index]! ^ 1;
    assert.notEqual(verifyEvidence(bytes, f.context).status, "PASS");
  }
  for (const input of [
    { ...f.workload, extra: 1 },
    { ...f.workload, input: NaN },
    { ...f.workload, schema: "v2" },
    { ...f.workload, operation: "" },
  ])
    assert.throws(() => validateWorkload(input), { code: "INVALID_INPUT" });
});
