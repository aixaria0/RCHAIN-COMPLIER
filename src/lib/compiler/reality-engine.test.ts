import test from "node:test";
import assert from "node:assert/strict";
import { runRealityEngine, verifyRealityCertificate } from "./reality-engine.ts";
import { verifyRealityLoop } from "./reality-loop.ts";
import type { RealityEngineInput } from "./reality-engine.ts";

function input(overrides: Partial<RealityEngineInput> = {}): RealityEngineInput {
  return {
    record: {
      schema: "rchain-reality-record/v1",
      id: "record-001",
      subject: { id: "block-001", kind: "block" },
      source: "synthetic-test",
      observations: [
        {
          id: "obs-001",
          source: "sentinel",
          type: "finalized-block",
          data: { blockHash: "abc", height: 12 },
        },
      ],
      claims: [
        { id: "claim-001", statement: "block-001 is finalized", basis: ["obs-001"] },
      ],
      evidence: [
        {
          id: "evidence-001",
          observationIds: ["obs-001"],
          description: "synthetic finalized-block evidence",
        },
      ],
      dependencies: [],
      transformations: [],
      verification: [
        {
          id: "verification-001",
          predicate: "canonical_consistency",
          state: "VERIFIED",
          message: "canonical relation holds",
          evidenceIds: ["evidence-001"],
        },
      ],
      replay: {
        available: true,
        inputIds: ["obs-001"],
        expectedDigest: "replay-abc",
        observedDigest: "replay-abc",
        state: "REPRODUCED",
      },
    },
    propositions: [
      {
        id: "p-001",
        statement: "block-001 may be finalized",
      },
    ],
    bets: [],
    ...overrides,
  };
}

test("Reality Engine emits a verified deterministic certificate", () => {
  const first = runRealityEngine(input());
  const second = runRealityEngine(input());

  assert.equal(first.state, "VERIFIED");
  assert.equal(first.engineVersion, "0.3.0");
  assert.equal(first.certificateDigest, second.certificateDigest);
  assert.equal(first.record.integrity.recordDigest, second.record.integrity.recordDigest);
  assert.equal(verifyRealityCertificate(first), true);
  assert.equal(verifyRealityLoop(first.loop), true);
  assert.equal(first.loop.phases.join(" -> "), "OBSERVE -> MEASURE -> PROJECT");
  assert.equal(first.loop.projection.predictedState, "VERIFIED");
  assert.equal(first.loop.projection.nextAction, "HOLD_VERIFIED_STATE");
  assert.equal(first.proof.proofState, "VERIFIED");
  assert.equal(first.proof.failedCount, 0);
  assert.equal(first.proof.openCount, 0);
  assert.ok(first.proof.satisfiedCount >= 1);
  assert.equal(first.loop.measurement.failedObligations, 0);
  assert.equal(first.loop.measurement.proofCoverage, 1);
});

test("Reality Engine emits a justification graph linking claims to evidence", () => {
  const result = runRealityEngine(input());

  assert.ok(result.proof.graph.nodes.some((node) => node.id === "obs-001" && node.kind === "observation"));
  assert.ok(result.proof.graph.nodes.some((node) => node.id === "claim-001" && node.kind === "claim"));
  assert.ok(
    result.proof.graph.edges.some(
      (edge) => edge.from === "claim-001" && edge.to === "obs-001" && edge.relation === "bases",
    ),
  );
  assert.ok(
    result.proof.obligations.some(
      (obligation) => obligation.id === "replay" && obligation.status === "SATISFIED",
    ),
  );
});

test("Reality Engine is order-invariant after normalization", () => {
  const reordered = input({
    record: {
      ...input().record,
      observations: [...input().record.observations].reverse(),
      claims: [...input().record.claims].reverse(),
      evidence: [...input().record.evidence].reverse(),
    },
    propositions: [...(input().propositions ?? [])].reverse(),
  });

  assert.equal(runRealityEngine(input()).certificateDigest, runRealityEngine(reordered).certificateDigest);
});

test("Replay divergence is terminal and cannot be hidden by a verified predicate", () => {
  const result = runRealityEngine(
    input({
      record: {
        ...input().record,
        replay: {
          ...input().record.replay,
          observedDigest: "replay-tampered",
          state: "DIVERGENT",
        },
      },
    }),
  );

  assert.equal(result.state, "DIVERGENT");
  assert.equal(result.loop.projection.predictedState, "DIVERGENT");
  assert.equal(result.loop.projection.nextAction, "ISOLATE_CONFLICT");
  assert.ok(result.proof.conflicts.some((item) => item.kind === "REPLAY"));
  assert.ok(result.proof.obligations.some((item) => item.kind === "REPLAY" && item.status === "FAILED"));
});

test("Missing proposition requirements fail closed and keep projection open", () => {
  const result = runRealityEngine(
    input({
      propositions: [
        {
          id: "p-requires-missing",
          statement: "requires an unavailable prerequisite",
          requires: ["missing-proposition"],
        },
      ],
    }),
  );

  assert.equal(result.state, "INCOMPLETE");
  assert.equal(result.propositions.judgement.state, "INCOMPLETE");
  assert.equal(result.loop.projection.predictedState, "INCOMPLETE");
  assert.equal(result.loop.projection.nextAction, "COLLECT_MISSING_EVIDENCE");
  assert.ok(result.loop.measurement.openObligations > 0);
  assert.ok(result.proof.openCount > 0);
});

test("Conflicting bets surface equivocation as divergence", () => {
  const result = runRealityEngine(
    input({
      bets: [
        {
          source: "validator-a",
          target: "validator-b",
          claim: "p-001",
          belief: 1,
          justification: ["evidence-001"],
        },
        {
          source: "validator-a",
          target: "validator-b",
          claim: "p-002",
          belief: 1,
          justification: ["evidence-002"],
        },
      ],
    }),
  );

  assert.equal(result.state, "DIVERGENT");
  assert.equal(result.equivocations.length, 1);
  assert.equal(result.equivocations[0]?.source, "validator-a");
  assert.equal(result.loop.projection.nextAction, "ISOLATE_CONFLICT");
  assert.ok(result.proof.conflicts.some((item) => item.kind === "EQUIVOCATION"));
  assert.ok(result.proof.obligations.some((item) => item.kind === "EQUIVOCATION" && item.status === "FAILED"));
});
