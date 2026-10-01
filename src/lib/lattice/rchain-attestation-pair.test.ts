import assert from "node:assert/strict";
import test from "node:test";
import {
  ADVANCING_HEIGHT_SAMPLE,
  RCHAIN_LIVENESS_WINDOW,
  evaluateAttestationCandidates,
} from "./rchain-attestation-pair.ts";

test("paired evaluator rejects one-sided fixes and keeps only round-close plus cadence", () => {
  const report = evaluateAttestationCandidates(),
    byName = new Map(report.candidates.map((c) => [c.candidate, c]));

  assert.equal(byName.get("current-strict-height")!.c192.pass, false);
  assert.equal(byName.get("current-strict-height")!.c171.pass, false);

  const naive = byName.get("naive-nonstrict-height")!;
  assert.equal(naive.c192.advanceRestored, true);
  assert.equal(naive.c192.pass, false);
  assert.ok(naive.c171.sameHeightBurstRequests > 1);

  assert.equal(byName.get("own-quiet-cadence-only")!.c171.pass, true);
  assert.equal(byName.get("own-quiet-cadence-only")!.c192.pass, false);

  assert.equal(byName.get("round-close-only")!.c192.pass, true);
  assert.equal(byName.get("round-close-only")!.c171.pass, false);

  const paired = byName.get("round-close-plus-cadence")!;
  assert.equal(paired.c192.pass, true);
  assert.equal(paired.c192.requests, 2);
  assert.equal(paired.c171.pass, true);
  assert.equal(
    paired.c171.advancingHeightRequests,
    Math.ceil(ADVANCING_HEIGHT_SAMPLE / (RCHAIN_LIVENESS_WINDOW + 1)),
  );
  assert.deepEqual(report.survivors, ["round-close-plus-cadence"]);
});

test("paired evaluator keeps the claim boundary explicit", () => {
  const report = evaluateAttestationCandidates();
  assert.ok(report.claimBoundary.some((line) => /not a Rust repair/.test(line)));
  assert.ok(report.claimBoundary.some((line) => /devnet/.test(line)));
  assert.ok(report.implementationRequirements.some((line) => /latest message height/.test(line)));
  assert.ok(report.implementationRequirements.some((line) => /round-boundary/.test(line)));
});
