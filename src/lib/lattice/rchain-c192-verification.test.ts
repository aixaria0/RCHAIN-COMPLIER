import assert from "node:assert/strict";
import test from "node:test";
import {
  artifactDigest,
  createEvent,
  EVENT_KINDS,
  generateIdentity,
  type EventBody,
  type Identity,
  type Json,
  type MembershipPolicy,
} from "./protocol.ts";
import { verificationBody } from "./verification.ts";

const REVISION = "51935310789a1a75a183ad0af7152e4eef450c88";
const TEST = "a_round_that_comes_to_rest_at_one_height_is_sealed_by_its_own_bound";
function fixture(revision = REVISION): Json {
  return {
    schema: "rchain-c192-upstream-witness/v1",
    repository: "rchain-community/rchain-rust",
    revision,
    issue: 172,
    finding: "C192",
    sourcePath: "node/src/runtime/node_runtime.rs",
    evidencePath: "spec/audit/evidence/n149-results.md",
    testName: TEST,
    command: `cargo test -p rchain-node ${TEST} -- --nocapture`,
    exitCode: 0,
    testPassed: true,
    sourceSha256: "sha256:" + "1".repeat(64),
    evidenceSha256: "sha256:" + "2".repeat(64),
    outputSha256: "sha256:" + "3".repeat(64),
    runUrl: "https://github.com/aixaria0/RCHAIN-COMPLIER/actions/runs/1",
  };
}
test("the C192 verifier binds the exact upstream revision and fails closed on substitution", () => {
  const a = generateIdentity(),
    b = generateIdentity(),
    policy: MembershipPolicy = {
      schema: "intelligence-lattice-policy/v1",
      latticeId: "rchain-c192-verifier-test",
      members: [a, b].map((i) => ({
        actorId: i.actorId,
        publicKeyHex: i.publicKeyHex,
        kinds: [...EVENT_KINDS],
        domains: ["rchain-casper"],
      })),
    },
    sequences = new Map<string, number>();
  function emit(identity: Identity, body: EventBody, parents: string[] = []) {
    const sequence = (sequences.get(identity.actorId) ?? 0) + 1;
    sequences.set(identity.actorId, sequence);
    return createEvent(identity, policy, { sequence, body, parents });
  }
  function make(revision = REVISION) {
    const input = fixture(revision),
      subject = artifactDigest(input),
      task = emit(a, {
        kind: "task",
        envelope: {
          schema: "intelligence-lattice-task/v1",
          taskId: artifactDigest({ purpose: "verify pinned upstream C192 falsifier", revision }),
          domain: "rchain-casper",
          operation: "rchain-c192-upstream/v1",
          input: { digest: subject, mediaType: "application/json", content: input },
          dependencies: [],
          authority: { mode: "observe-only", issuer: a.actorId },
          output: { mediaType: "application/json", claimPredicate: "c192-upstream-falsifier-passes" },
        },
      }),
      claim = emit(
        a,
        {
          kind: "claim",
          subject,
          predicate: "c192-upstream-falsifier-passes",
          value: true,
          domain: "rchain-casper",
          method: "rchain-c192-upstream/v1",
          assumptions: ["the CI witness faithfully records the exact cargo invocation"],
          confidence: { ppm: null, basis: "bounded upstream test evidence" },
          falsifier: "rerun the pinned cargo test or alter any bound witness field",
        },
        [task.id],
      ),
      evidence = emit(a, {
        kind: "evidence",
        claimId: claim.id,
        relation: "supports",
        method: "pinned upstream cargo-test artifact",
        artifact: { digest: subject, mediaType: "application/json", content: input },
      }),
      request = emit(a, {
        kind: "verification_request",
        claimId: claim.id,
        evidenceIds: [evidence.id],
        verifier: "rchain-c192-upstream/v1",
      }),
      map = new Map([task, claim, evidence, request].map((e) => [e.id, e]));
    return { request, map };
  }
  const good = make();
  assert.equal(verificationBody(good.request, good.map).verdict, "SUPPORTED");
  const wrongRevision = make("0000000000000000000000000000000000000000");
  assert.throws(
    () => verificationBody(wrongRevision.request, wrongRevision.map),
    /invalid pinned C192 upstream witness/,
  );
});
