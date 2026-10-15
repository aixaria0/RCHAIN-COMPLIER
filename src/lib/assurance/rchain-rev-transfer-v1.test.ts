import assert from "node:assert/strict";
import { test } from "node:test";
import {
  fixture,
  fixturePolicy,
  seal,
  raw,
  block,
  NOW,
} from "../../../scripts/rchain-assurance-fixtures.mjs";
import { verifyRevTransferAssurance } from "./rchain-rev-transfer-v1.ts";
async function run(mutate: (p: any, policy: any) => unknown, expected: string, reseal = false) {
  const pkg = await fixture();
  const policy = fixturePolicy(pkg);
  await mutate(pkg, policy);
  if (reseal) {
    await seal(pkg);
    policy.received_payload_digest = pkg.provenance.payload_digest;
    policy.external_payload_digest = pkg.provenance.payload_digest;
  }
  const verdict = await verifyRevTransferAssurance(pkg, policy);
  assert.equal(verdict.status, expected, JSON.stringify(verdict));
}
test("bounded supported claim passes", () => run(() => {}, "PASS"));
test("coherently substituted receipt cannot manufacture independent package trust", async () => {
  const pkg = await fixture();
  const policy = fixturePolicy(pkg);
  const reviewerPin = policy.external_payload_digest;
  const observer = pkg.observers[0];
  const status = JSON.parse(observer.evidence.status.body);
  status.version = { node: "substituted-but-self-consistent" };
  observer.evidence.status = await raw("/api/status", status);
  await seal(pkg);
  // Recomputing a received digest is allowed; promoting it to a reviewer pin is not.
  policy.received_payload_digest = pkg.provenance.payload_digest;
  policy.external_payload_digest = null;
  const unpinned = await verifyRevTransferAssurance(pkg, policy);
  assert.equal(unpinned.status, "BLOCKED");
  assert.equal(unpinned.payload_trust, "UNPINNED");
  assert.equal(unpinned.checks.payload_integrity, "PASS");
  assert.equal(unpinned.checks.received_payload_integrity, "PASS");
  assert.equal(unpinned.checks.external_payload_pin, "BLOCKED");
  assert.ok(
    Object.entries(unpinned.checks).every(
      ([key, value]) => key === "external_payload_pin" || value === "PASS",
    ),
    JSON.stringify(unpinned),
  );
  policy.external_payload_digest = reviewerPin;
  const pinned = await verifyRevTransferAssurance(pkg, policy);
  assert.equal(pinned.status, "FAIL");
  assert.equal(pinned.payload_trust, "PIN_MISMATCH");
  assert.equal(pinned.checks.external_payload_pin, "FAIL");
});
test("independent matching pin is explicit and ambiguous legacy pins are rejected", async () => {
  const pkg = await fixture();
  const policy = fixturePolicy(pkg);
  assert.equal((await verifyRevTransferAssurance(pkg, policy)).payload_trust, "EXTERNALLY_PINNED");
  delete policy.external_payload_digest;
  (policy as any).expected_payload_digest = policy.received_payload_digest;
  const legacy = await verifyRevTransferAssurance(pkg, policy);
  assert.equal(legacy.status, "FAIL");
  assert.equal(legacy.payload_trust, "UNPINNED");
});
test("missing external pin never skips raw-evidence tamper checks", async () => {
  const pkg = await fixture();
  pkg.observers[0].evidence.status.body = "{}";
  await seal(pkg);
  const policy = fixturePolicy(pkg);
  policy.external_payload_digest = null;
  const verdict = await verifyRevTransferAssurance(pkg, policy);
  assert.equal(verdict.status, "FAIL");
  assert.equal(verdict.payload_trust, "UNPINNED");
  assert.equal(verdict.checks.raw_integrity, "FAIL");
});
test("wrong expected network fails", () => run((_p, t) => (t.network_id = "wrong"), "FAIL"));
test("wrong task fails", () => run((_p, t) => (t.action_id = "wrong"), "FAIL"));
test("wrong claim fails", () => run((_p, t) => (t.claim_id = "wrong"), "FAIL"));
test("modified payload with repaired JSON fails", () =>
  run((p) => (p.subject.action_id = "tamper"), "FAIL"));
test("same-height conflicting hashes fail", async () => {
  const p = await fixture("conflict");
  assert.equal((await verifyRevTransferAssurance(p, fixturePolicy(p))).status, "FAIL");
});
test("stale evidence blocks", () => run((_p, t) => (t.now_ms += 120000), "BLOCKED"));
test("missing observer blocks", () => run((p) => p.observers.pop(), "BLOCKED", true));
test("truncated package fails", () => run((p) => delete p.execution, "FAIL"));
test("reproduction mismatch fails", () =>
  run((p) => (p.reproduction_digest = "0".repeat(64)), "FAIL"));
test("package cannot substitute policy", () =>
  run((p) => (p.trust_policy = { min_observers: 0 }), "FAIL"));
test("tampered raw digest rejected even when outer repaired", () =>
  run((p) => (p.observers[0].evidence.status.body = "{}"), "FAIL", true));
test("canonical representation mismatch rejected", () =>
  run(
    async (p) => {
      const b = JSON.parse(p.observers[0].evidence.finalized_block.body);
      b.blockInfo.postStateHash = "wrong";
      p.observers[0].evidence.finalized_block = await raw(
        p.observers[0].evidence.finalized_block.path,
        b,
      );
    },
    "FAIL",
    true,
  ));
test("node count cannot duplicate identities", () =>
  run((_p, t) => (t.observers[1].node_identity = t.observers[0].node_identity), "FAIL"));
test("future evidence cannot pass", () => run((_p, t) => (t.now_ms -= 120000), "BLOCKED"));
test("missing finality blocks", async () => {
  const p = await fixture("blocked");
  assert.equal((await verifyRevTransferAssurance(p, fixturePolicy(p))).status, "BLOCKED");
});
test("success marker alone is not execution", () =>
  run(
    async (p) => {
      for (const o of p.observers) {
        const d = JSON.parse(o.evidence.deploy.body);
        d.ProcessedWithSuccess.deployResult = [];
        o.evidence.deploy = await raw(o.evidence.deploy.path, d);
      }
      p.execution = { status: "UNKNOWN" };
      p.finalized_state = { status: "UNAVAILABLE" };
    },
    "BLOCKED",
    true,
  ));
test("conflict remains FAIL with third observer unavailable", () =>
  run(
    async (p) => {
      const other = block("bb".repeat(32));
      p.observers[1].evidence.finalized = await raw("/api/last-finalized-block", {
        blockInfo: other,
      });
      p.observers[1].finalized_hash = other.blockHash;
      p.agreement.status = "CONFLICT";
    },
    "FAIL",
    true,
  ));
test("raw freshness independently checked", () =>
  run((p) => (p.observers[0].evidence.status.observed_at = NOW - 120000), "BLOCKED", true));

test("reproduction mismatch rejects even with repaired outer digest", async () => {
  const pkg = await fixture();
  pkg.reproduction_digest = "0".repeat(64);
  const { assurancePayloadDigest } = await import("./rchain-assurance-validation.ts");
  pkg.provenance.payload_digest = await assurancePayloadDigest(pkg);
  const verdict = await verifyRevTransferAssurance(pkg, fixturePolicy(pkg));
  assert.equal(verdict.status, "FAIL");
  assert.equal(verdict.checks.deterministic_reproduction, "FAIL");
});
test("incomplete external trust configuration blocks", async () => {
  const pkg = await fixture();
  const policy = fixturePolicy(pkg);
  policy.observers.pop();
  assert.equal((await verifyRevTransferAssurance(pkg, policy)).status, "BLOCKED");
});

test("direct boolean Vault result is reproduced without fabricating a tuple", () =>
  run(
    async (pkg) => {
      for (const observer of pkg.observers) {
        const deploy = JSON.parse(observer.evidence.deploy.body);
        deploy.ProcessedWithSuccess.deployResult = [{ ExprBool: { data: true } }];
        observer.evidence.deploy = await raw(observer.evidence.deploy.path, deploy);
      }
    },
    "PASS",
    true,
  ));

test("finalized read-back canonical metadata mismatch fails", () =>
  run(
    async (pkg) => {
      const observer = pkg.observers[0];
      const value = JSON.parse(observer.evidence.balance.body);
      value.block.postStateHash = "wrong-state";
      observer.evidence.balance = await raw(
        observer.evidence.balance.path,
        value,
        observer.evidence.balance.request,
      );
    },
    "FAIL",
    true,
  ));

test("incomplete canonical fields block without inventing a contradiction", () =>
  run(
    async (pkg) => {
      const observer = pkg.observers[0];
      const value = JSON.parse(observer.evidence.finalized_block.body);
      delete value.blockInfo.postStateHash;
      observer.evidence.finalized_block = await raw(observer.evidence.finalized_block.path, value);
      pkg.finalized_state = { status: "UNAVAILABLE", reason: "Canonical fields unavailable" };
    },
    "BLOCKED",
    true,
  ));

test("incomplete trust pins never downgrade a conflict to BLOCKED", async () => {
  const pkg = await fixture("conflict");
  const policy = fixturePolicy(pkg);
  policy.observers.pop();
  const verdict = await verifyRevTransferAssurance(pkg, policy);
  assert.equal(verdict.status, "FAIL");
  assert.equal(verdict.agreement, "CONFLICT");
});
