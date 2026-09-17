/**
 * Adapter from the existing compiler output into the portable RealityRecord.
 *
 * This is deliberately an adapter rather than a second compiler: the existing
 * compile() pipeline remains the source of observations, claims, replay and
 * verification data. The adapter gives that result a provider-neutral,
 * independently inspectable representation.
 */

import type { ScenarioId, MutationId, Status } from "./types.ts";
import { compile, type EventEnvelope, type Reality } from "./compile.ts";
import {
  sealRealityRecord,
  type RealityClaim,
  type RealityDependency,
  type RealityEvidence,
  type RealityObservation,
  type RealityRecord,
  type RealityReplay,
  type RealityTransformation,
  type RealityVerification,
} from "./reality-record.ts";

function verificationState(status: Status): RealityVerification["state"] {
  switch (status) {
    case "PASS":
      return "VERIFIED";
    case "WARN":
      return "INCOMPLETE";
    case "FAIL":
      return "DIVERGENT";
    case "UNAVAILABLE":
      return "INCOMPLETE";
  }
}

function envelopeObservation(envelope: EventEnvelope): RealityObservation {
  return {
    id: envelope.eventId,
    source: envelope.layer,
    type: envelope.label,
    data: {
      parentEvent: envelope.parentEvent,
      actorCapability: envelope.actorCapability,
      qlfDigest: envelope.qlfDigest,
      rholangSourceHash: envelope.rholangSourceHash,
      normalizedProcess: envelope.normalizedProcess,
      executionTraceHash: envelope.executionTraceHash,
      deployId: envelope.deployId,
      blockHash: envelope.blockHash,
      nodeObservations: envelope.nodeObservations,
      verificationResults: envelope.verificationResults,
      payloadHash: envelope.payloadHash,
      previousHash: envelope.prevHash,
      eventHash: envelope.hash,
      fields: envelope.fields,
      summary: envelope.summary,
    },
  };
}

function claimsFromReality(reality: Reality): RealityClaim[] {
  return reality.claims.map((claim, index) => ({
    id: `claim_${String(index + 1).padStart(2, "0")}`,
    statement: claim.statement,
    basis: [claim.basis, `layer:${claim.layer}`, `status:${claim.status}`],
  }));
}

function evidenceFromReality(reality: Reality): RealityEvidence[] {
  return reality.envelopes.map((envelope) => ({
    id: `evidence_${envelope.eventId}`,
    observationIds: [envelope.eventId],
    hash: envelope.hash,
    description: `${envelope.label}: ${envelope.summary}`,
  }));
}

function dependenciesFromEnvelopes(envelopes: EventEnvelope[]): RealityDependency[] {
  return envelopes.flatMap((envelope) =>
    envelope.parentEvent
      ? [
          {
            from: envelope.parentEvent,
            to: envelope.eventId,
            relation: "causes",
          },
        ]
      : [],
  );
}

function transformationsFromReality(reality: Reality): RealityTransformation[] {
  const transformations: RealityTransformation[] = [];

  if (reality.qos) {
    transformations.push({
      id: "transform_qos_to_qlf",
      name: "QuantumOS event → QLF certificate",
      inputIds: [reality.qos.eventId],
      outputIds: reality.envelopes.filter((e) => e.layer === "qlf").map((e) => e.eventId),
      deterministic: true,
    });
  }

  if (reality.execution) {
    transformations.push({
      id: "transform_rholang_to_execution",
      name: "Rholang source → deterministic execution trace",
      inputIds: reality.envelopes.filter((e) => e.layer === "rholang").map((e) => e.eventId),
      outputIds: reality.execution.steps.map((_, index) => `step_${index + 1}`),
      deterministic: true,
    });
  }

  if (reality.blocks.length > 0) {
    transformations.push({
      id: "transform_execution_to_block",
      name: "Execution result → block proposal",
      inputIds: reality.envelopes.filter((e) => e.layer === "rholang").map((e) => e.eventId),
      outputIds: reality.blocks.map((block) => block.hash),
      deterministic: true,
    });
  }

  if (reality.observations.length > 0) {
    transformations.push({
      id: "transform_block_to_observation",
      name: "Block → independent node observation",
      inputIds: reality.blocks.map((block) => block.hash),
      outputIds: reality.envelopes
        .filter((e) => e.layer === "sentinel")
        .map((e) => e.eventId),
      deterministic: true,
    });
  }

  transformations.push({
    id: "transform_observation_to_verification",
    name: "Evidence → verification result",
    inputIds: reality.envelopes.map((e) => e.eventId),
    outputIds: reality.checks.map((check) => check.id),
    deterministic: true,
  });

  return transformations.filter((transformation) => transformation.outputIds.length > 0);
}

function evidenceIdForRef(envelopes: EventEnvelope[], source: string, field: string, value: string): string | null {
  const envelope = envelopes.find((candidate) =>
    candidate.fields.some(
      (candidateField) =>
        candidateField.source === source && candidateField.field === field && candidateField.value === value,
    ),
  );
  return envelope ? `evidence_${envelope.eventId}` : null;
}

function verificationsFromReality(reality: Reality): RealityVerification[] {
  return reality.checks.map((check) => ({
    id: check.id,
    predicate: check.name,
    state: verificationState(check.status),
    message: `${check.message} [source=${check.source}, severity=${check.severity}]`,
    evidenceIds: check.evidence.flatMap((evidence) => {
      const evidenceId = evidenceIdForRef(
        reality.envelopes,
        evidence.source,
        evidence.field,
        evidence.value,
      );
      return evidenceId ? [evidenceId] : [];
    }),
  }));
}

function replayFromReality(reality: Reality): RealityReplay {
  if (!reality.replay) {
    return {
      available: false,
      inputIds: reality.execution ? reality.execution.steps.map((_, index) => `step_${index + 1}`) : [],
      state: "INCOMPLETE",
    };
  }

  return {
    available: true,
    inputIds: reality.execution ? reality.execution.steps.map((_, index) => `step_${index + 1}`) : [],
    expectedDigest: reality.replay.expectedStateHash,
    observedDigest: reality.replay.observedStateHash,
    state: reality.replay.match ? "REPRODUCED" : "DIVERGENT",
  };
}

function subjectId(reality: Reality): string {
  return `scenario:${reality.scenario}:mutation:${reality.mutation}`;
}

export function realityToRecord(reality: Reality, previousDigest?: string): RealityRecord {
  const input = {
    schema: "rchain-reality-record/v1" as const,
    id: subjectId(reality),
    subject: {
      id: reality.qos.eventId,
      kind: "execution-claim",
      label: `${reality.scenario} / ${reality.mutation}`,
    },
    source: "rchain-reality-compiler",
    observations: reality.envelopes.map(envelopeObservation),
    claims: claimsFromReality(reality),
    evidence: evidenceFromReality(reality),
    dependencies: dependenciesFromEnvelopes(reality.envelopes),
    transformations: transformationsFromReality(reality),
    verification: verificationsFromReality(reality),
    replay: replayFromReality(reality),
  };

  return sealRealityRecord(input, previousDigest);
}

export function compileRealityRecord(
  scenario: ScenarioId,
  mutation: MutationId,
  previousDigest?: string,
): RealityRecord {
  return realityToRecord(compile(scenario, mutation), previousDigest);
}
