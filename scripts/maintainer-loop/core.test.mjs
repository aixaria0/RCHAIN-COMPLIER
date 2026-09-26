import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runScenario, verifyIntegrity } from "./core.mjs";
import { getScenario } from "./scenarios.mjs";

async function fixture(name) {
  return JSON.parse(await readFile(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
}

test("issue #74 is classified by semantic effect, not deploy success", async () => {
  const input = await fixture("issue-74-silent-trust.json");
  const result = runScenario({ scenario: getScenario("TRUST_BOND_ACTIVATE"), input });
  assert.equal(result.state, "DIVERGENT");
  assert.equal(result.firstDivergence?.id, "verify:trusted_contains_target");
  assert.equal(verifyIntegrity(result.record), true);
});

test("PR #81 catches Running without an HTTP surface", async () => {
  const input = await fixture("pr-81-http-router.json");
  const result = runScenario({ scenario: getScenario("NODE_BOOT"), input });
  assert.equal(result.state, "DIVERGENT");
  assert.equal(result.firstDivergence?.id, "verify:http_bound");
});

test("missing semantic evidence fails closed", () => {
  const result = runScenario({
    scenario: getScenario("TRUST_BOND_ACTIVATE"),
    input: { subject: { id: "partial" }, observations: { trust: { processed: true } } },
  });
  assert.equal(result.state, "INCOMPLETE");
  assert.equal(result.firstDivergence?.id, "verify:trusted_contains_target");
});

test("healthy node boot verifies", () => {
  const result = runScenario({
    scenario: getScenario("NODE_BOOT"),
    input: {
      subject: { id: "healthy-node" },
      observations: {
        node: {
          processRunning: true,
          httpBound: true,
          healthOk: true,
          statusReadable: true
        }
      }
    },
  });
  assert.equal(result.state, "VERIFIED");
  assert.equal(result.firstDivergence, null);
  assert.equal(verifyIntegrity(result.record), true);
});
