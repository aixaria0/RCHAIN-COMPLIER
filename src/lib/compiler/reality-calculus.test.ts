import assert from "node:assert/strict";
import test from "node:test";
import { compileRealityRecord } from "./reality-record-adapter.ts";
import {
  evaluateRealityTerm,
  termCheck,
  termCompose,
  termObservation,
  termReplay,
  termRequire,
} from "./reality-calculus.ts";

function baseline() {
  return compileRealityRecord("exchange-commit", "none");
}

test("OBS derives an observed judgement from one recorded observation", () => {
  const record = baseline();
  const result = evaluateRealityTerm(record, termObservation(record.observations[0]!.id));

  assert.equal(result.judgement.state, "OBSERVED");
  assert.deepEqual(result.judgement.observationIds, [record.observations[0]!.id]);
  assert.equal(result.derivation.rule, "OBS");
  assert.match(result.derivationDigest, /^[0-9a-f]{64}$/);
});

test("COMP combines evidence without losing provenance", () => {
  const record = baseline();
  const term = termCompose(termObservation(record.observations[0]!.id), termObservation(record.observations[1]!.id));
  const result = evaluateRealityTerm(record, term);

  assert.equal(result.judgement.state, "OBSERVED");
  assert.equal(result.judgement.observationIds.length, 2);
  assert.equal(result.derivation.rule, "COMP");
  assert.equal(result.derivation.premises.length, 2);
});

test("REQ fails closed when a required evidence identity is missing", () => {
  const record = baseline();
  const result = evaluateRealityTerm(record, termRequire(["does-not-exist"], termObservation(record.observations[0]!.id)));

  assert.equal(result.judgement.state, "INCOMPLETE");
  assert.match(result.judgement.reason, /missing required evidence/);
  assert.equal(result.derivation.rule, "REQ");
});

test("CHK raises a recorded verification predicate without trusting an upstream status flag", () => {
  const record = baseline();
  const predicate = record.verification[0]!.predicate;
  const result = evaluateRealityTerm(record, termCheck(predicate, termObservation(record.observations[0]!.id)));

  assert.equal(result.derivation.rule, "CHK");
  assert.equal(result.judgement.verificationIds.includes(record.verification[0]!.id), true);
  assert.notEqual(result.judgement.state, "INCOMPLETE");
});

test("REP distinguishes reproducible execution from divergent execution", () => {
  const record = baseline();
  const seed = termObservation(record.observations[0]!.id);
  const reproduced = evaluateRealityTerm(record, termReplay("abc", "abc", seed));
  const divergent = evaluateRealityTerm(record, termReplay("abc", "xyz", seed));

  assert.equal(reproduced.judgement.state, "REPRODUCED");
  assert.equal(divergent.judgement.state, "DIVERGENT");
});

test("DIVERGENT dominates INCOMPLETE and positive states under composition", () => {
  const record = baseline();
  const observed = termObservation(record.observations[0]!.id);
  const divergent = termReplay("expected", "observed", observed);
  const incomplete = termRequire(["missing"], observed);

  assert.equal(evaluateRealityTerm(record, termCompose(divergent, incomplete)).judgement.state, "DIVERGENT");
});

test("identical calculus terms yield identical derivation digests", () => {
  const record = baseline();
  const term = termCheck(record.verification[0]!.predicate, termObservation(record.observations[0]!.id));
  const first = evaluateRealityTerm(record, term);
  const second = evaluateRealityTerm(record, term);

  assert.equal(first.derivationDigest, second.derivationDigest);
});
