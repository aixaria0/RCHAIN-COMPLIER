import { sha256Artifact } from "../compiler/ecosystem-chain.ts";
import {
  artifactDigest,
  canonical,
  createEvent,
  exact,
  type Identity,
  type Json,
  type LatticeEvent,
  type MembershipPolicy,
  type TaskEnvelope,
} from "../lattice/protocol.ts";
import { AssuranceError } from "./errors.ts";

export interface Workload {
  schema: "assurance-workload/v1";
  domain: string;
  operation: string;
  predicate: string;
  input: Json;
  value: Json;
}

/** Detached, bounded JSON only; this interface grants no code execution authority. */
export function validateWorkload(value: unknown): Workload {
  try {
    const data = exact(JSON.parse(canonical(value)), [
      "schema",
      "domain",
      "operation",
      "predicate",
      "input",
      "value",
    ]);
    if (data.schema !== "assurance-workload/v1") throw new Error("unsupported workload version");
    for (const name of ["domain", "operation", "predicate"])
      if (
        typeof data[name] !== "string" ||
        !(data[name] as string).trim() ||
        (data[name] as string).length > 256
      )
        throw new Error(`invalid ${name}`);
    return data as unknown as Workload;
  } catch (cause) {
    throw new AssuranceError("INVALID_INPUT", "Invalid bounded workload", { cause });
  }
}

export function workloadId(input: Workload): string {
  return sha256Artifact(`assurance-workload/v1\0${canonical(validateWorkload(input))}`);
}

/** Four signed events form one atomic journal batch. The task ID includes the asserted value. */
export function createSubmission(
  input: Workload,
  identity: Identity,
  policy: MembershipPolicy,
  sequence: number,
  issuedAt = new Date().toISOString(),
): { taskId: string; taskEventId: string; claimId: string; events: LatticeEvent[] } {
  const workload = validateWorkload(input),
    taskId = workloadId(workload);
  const envelope: TaskEnvelope = {
    schema: "intelligence-lattice-task/v1",
    taskId,
    domain: workload.domain,
    operation: workload.operation,
    input: {
      digest: artifactDigest(workload.input),
      mediaType: "application/json",
      content: workload.input,
    },
    dependencies: [],
    authority: { mode: "observe-only", issuer: identity.actorId },
    output: { mediaType: "application/json", claimPredicate: workload.predicate },
  };
  const task = createEvent(identity, policy, {
    sequence,
    issuedAt,
    body: { kind: "task", envelope },
  });
  const claim = createEvent(identity, policy, {
    sequence: sequence + 1,
    issuedAt,
    parents: [task.id],
    body: {
      kind: "claim",
      subject: envelope.input.digest,
      predicate: workload.predicate,
      value: workload.value,
      domain: workload.domain,
      method: workload.operation,
      assumptions: [],
      confidence: { ppm: null, basis: "unverified submission" },
      falsifier: "Registered deterministic verification refutes the asserted value",
    },
  });
  const evidence = createEvent(identity, policy, {
    sequence: sequence + 2,
    issuedAt,
    body: {
      kind: "evidence",
      claimId: claim.id,
      relation: "supports",
      artifact: envelope.input,
      method: workload.operation,
    },
  });
  const request = createEvent(identity, policy, {
    sequence: sequence + 3,
    issuedAt,
    body: {
      kind: "verification_request",
      claimId: claim.id,
      evidenceIds: [evidence.id],
      verifier: workload.operation,
    },
  });
  return {
    taskId,
    taskEventId: task.id,
    claimId: claim.id,
    events: [task, claim, evidence, request],
  };
}
