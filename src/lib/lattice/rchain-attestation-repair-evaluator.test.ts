import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_LIVENESS_WINDOW,
  evaluateAttestationCandidate,
  pacedRequestCount,
} from "./rchain-attestation-repair-evaluator.ts";

const scenario = {
  sameHeightRemoteBlocks: 7,
  advancingHeightSpan: 24,
  livenessWindow: DEFAULT_LIVENESS_WINDOW,
};

test("current per-height rule preserves the burst bound but fails both paired goals", () => {
  const result = evaluateAttestationCandidate("current-per-height", scenario);
  assert.equal(result.sameHeightRemoteRequests, 1);
  assert.equal(result.c192RestedRoundCanAdvance, false);
  assert.equal(result.c171AdvancingRateBounded, false);
  assert.equal(result.passesPairedGate, false);
});

test("the naive same-height relaxation feeds liveness through fan-out and is rejected", () => {
  const result = evaluateAttestationCandidate("naive-same-height", scenario);
  assert.equal(result.sameHeightRemoteRequests, 7);
  assert.equal(result.c192RestedRoundCanAdvance, true);
  assert.equal(result.c171SameHeightBurstBounded, false);
  assert.equal(result.passesPairedGate, false);
});

test("pace alone bounds C171 but cannot wake a frozen C192 tip", () => {
  const result = evaluateAttestationCandidate("pace-only", scenario);
  assert.equal(result.advancingHeightRequests, pacedRequestCount(24, 5));
  assert.equal(result.advancingHeightRequests, 4);
  assert.equal(result.passesC171, true);
  assert.equal(result.passesC192, false);
  assert.equal(result.passesPairedGate, false);
});

test("paced designated escape is the only candidate admitted by the abstract paired gate", () => {
  const result = evaluateAttestationCandidate("paced-designated-escape", scenario);
  assert.equal(result.sameHeightRemoteRequests, 1);
  assert.equal(result.advancingHeightRequests, 4);
  assert.equal(result.localEscapeRequests, 6);
  assert.equal(result.passesC192, true);
  assert.equal(result.passesC171, true);
  assert.equal(result.passesPairedGate, true);
});

test("the admitted candidate's per-node request bound does not scale with the same-height peer burst", () => {
  for (const sameHeightRemoteBlocks of [2, 4, 7, 31, 127]) {
    const result = evaluateAttestationCandidate("paced-designated-escape", {
      sameHeightRemoteBlocks,
      advancingHeightSpan: 24,
      livenessWindow: 5,
    });
    assert.equal(result.sameHeightRemoteRequests, 1);
    assert.equal(result.localEscapeRequests, 6);
    assert.equal(result.advancingHeightRequests, 4);
  }
});

test("input bounds fail closed", () => {
  assert.throws(
    () =>
      evaluateAttestationCandidate("paced-designated-escape", {
        sameHeightRemoteBlocks: 0,
        advancingHeightSpan: 24,
      }),
    /sameHeightRemoteBlocks/,
  );
});
