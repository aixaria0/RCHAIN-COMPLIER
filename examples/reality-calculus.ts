import {
  compileRealityRecord,
  evaluateRealityTerm,
  termCheck,
  termCompose,
  termObservation,
  termReplay,
  termRequire,
} from "../src/lib/compiler/index.ts";

const record = compileRealityRecord("exchange-commit", "none");
const observation = termObservation(record.observations[0]!.id);
const checked = termCheck(record.verification[0]!.predicate, observation);
const replayed = termReplay(
  record.replay.expectedDigest ?? "expected",
  record.replay.observedDigest ?? "observed",
  checked,
);
const term = termRequire(record.observations.slice(0, 2).map((item) => item.id), termCompose(checked, replayed));
const result = evaluateRealityTerm(record, term);

console.log(JSON.stringify({
  state: result.judgement.state,
  reason: result.judgement.reason,
  observations: result.judgement.observationIds,
  verifications: result.judgement.verificationIds,
  derivationRule: result.derivation.rule,
  derivationDigest: result.derivationDigest,
}, null, 2));
