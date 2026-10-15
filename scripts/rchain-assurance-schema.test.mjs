import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import Ajv from "ajv";
import { validateRevTransferPackage } from "../src/lib/assurance/rchain-assurance-validation.ts";
const schema = JSON.parse(readFileSync("contracts/rchain-assurance/v1.schema.json", "utf8"));
const validate = new Ajv({ strict: true }).compile(schema);
for (const name of ["pass", "blocked", "conflict"]) test(`canonical ${name} validates in Ajv and shipped validator`, () => {
  const pkg = JSON.parse(readFileSync(`contracts/rchain-assurance/examples/${name}.json`, "utf8"));
  assert.equal(validate(pkg), true, JSON.stringify(validate.errors));
  assert.deepEqual(validateRevTransferPackage(pkg), []);
  for (const mutation of [p => delete p.subject, p => p.trust_policy = {}, p => p.observers[0].evidence.deploy = { body: "{}" }, p => p.execution.status = "SUCCESS", p => p.provenance.generated_at = -1, p => p.observers[0].evidence.ancestry = {}]) {
    const copy = structuredClone(pkg); mutation(copy);
    assert.equal(validate(copy), false);
    assert.ok(validateRevTransferPackage(copy).length);
  }
});
