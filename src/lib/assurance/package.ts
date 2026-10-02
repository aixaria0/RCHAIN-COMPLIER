import { sha256Artifact } from "../compiler/ecosystem-chain.ts";
import {
  canonical,
  exact,
  MAX_EVENT_BYTES,
  parseCanonical,
  policyDigest,
  validateEvent,
  type LatticeEvent,
  type MembershipPolicy,
} from "../lattice/protocol.ts";
import { replay } from "../lattice/replay.ts";
import { CORE_VERIFIERS, type VerifierRegistry } from "../lattice/verification.ts";
import { AssuranceError, requireDigest, type ErrorCode } from "./errors.ts";

export const PACKAGE_SCHEMA = "assurance-evidence-package/v1";
export const MAX_PACKAGE_BYTES = 8 * 1024 * 1024;
export interface PackageManifest {
  schema: typeof PACKAGE_SCHEMA;
  canonicalProfile: "intelligence-lattice-canonical/v1";
  policy: MembershipPolicy;
  policyDigest: string;
  taskId: string;
  taskEventId: string;
  claimId: string;
  eventRoot: string;
  eventCount: number;
}
export interface VerificationContext {
  expectedPolicyDigest: string;
  expectedTaskId: string;
  expectedClaimId: string;
  expectedPackageDigest?: string;
  registry?: VerifierRegistry;
}
export interface VerificationReport {
  schema: "assurance-report/v1";
  status: "PASS" | "BLOCKED" | "FAIL";
  code: ErrorCode;
  reason: string;
  packageDigest: string | null;
  eventRoot: string | null;
  taskId: string | null;
  claimId: string | null;
  eventCount: number;
  verifierActorIds: string[];
  operation: string | null;
  limitations: string[];
}

export function packageDigest(bytes: Uint8Array): string {
  if (bytes.byteLength > MAX_PACKAGE_BYTES)
    throw new AssuranceError("RESOURCE_LIMIT", "Package exceeds 8 MiB");
  return sha256Artifact(Buffer.concat([Buffer.from(`${PACKAGE_SCHEMA}\0`), bytes]));
}

/** Canonical NDJSON: one bounded manifest, followed by unique signed events in ID order. */
export function exportEvidence(
  events: readonly LatticeEvent[],
  policy: MembershipPolicy,
  target: { taskEventId: string; claimId: string },
  registry: VerifierRegistry = CORE_VERIFIERS,
): Uint8Array {
  const view = replay(events, policy, registry);
  const task = events.find((e) => e.id === target.taskEventId);
  const claim = events.find((e) => e.id === target.claimId);
  if (task?.body.kind !== "task" || claim?.body.kind !== "claim")
    throw new AssuranceError("INVALID_INPUT", "Target task and claim must exist");
  const manifest: PackageManifest = {
    schema: PACKAGE_SCHEMA,
    canonicalProfile: "intelligence-lattice-canonical/v1",
    policy,
    policyDigest: policyDigest(policy),
    taskId: task.body.envelope.taskId,
    taskEventId: task.id,
    claimId: claim.id,
    eventRoot: view.eventRoot,
    eventCount: view.eventCount,
  };
  const unique = [...new Map(events.map((e) => [e.id, e])).values()].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );
  const bytes = Buffer.from(
    [canonical(manifest), ...unique.map((e) => canonical(e))].join("\n") + "\n",
  );
  if (bytes.length > MAX_PACKAGE_BYTES)
    throw new AssuranceError("RESOURCE_LIMIT", "Package exceeds 8 MiB");
  return bytes;
}

export function parseEvidence(bytes: Uint8Array): {
  manifest: PackageManifest;
  events: LatticeEvent[];
} {
  if (bytes.byteLength > MAX_PACKAGE_BYTES)
    throw new AssuranceError("RESOURCE_LIMIT", "Package exceeds 8 MiB");
  try {
    const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
    if (!text.endsWith("\n")) throw new Error("LF-terminated NDJSON required");
    const lines = text.slice(0, -1).split("\n");
    if (lines.length < 2 || lines.length > 4097) throw new Error("Package event limit");
    if (lines.some((line) => Buffer.byteLength(line) > MAX_EVENT_BYTES))
      throw new Error("Record byte limit");
    const manifest = exact(parseCanonical(lines[0]!), [
      "schema",
      "canonicalProfile",
      "policy",
      "policyDigest",
      "taskId",
      "taskEventId",
      "claimId",
      "eventRoot",
      "eventCount",
    ]) as unknown as PackageManifest;
    if (
      manifest.schema !== PACKAGE_SCHEMA ||
      manifest.canonicalProfile !== "intelligence-lattice-canonical/v1"
    )
      throw new Error("Unsupported package version or canonical profile");
    for (const key of ["policyDigest", "taskId", "taskEventId", "claimId", "eventRoot"] as const)
      requireDigest(manifest[key], key);
    if (policyDigest(manifest.policy) !== manifest.policyDigest)
      throw new Error("Policy digest mismatch");
    if (manifest.eventCount !== lines.length - 1) throw new Error("Event count mismatch");
    const events = lines
      .slice(1)
      .map((line) => validateEvent(parseCanonical(line), manifest.policy));
    if (events.some((e, i) => i > 0 && events[i - 1]!.id >= e.id))
      throw new Error("Unique ascending event IDs required");
    return { manifest, events };
  } catch (cause) {
    throw new AssuranceError(
      "INVALID_INPUT",
      "Malformed, noncanonical or invalidly signed evidence package",
      { cause },
    );
  }
}

/** Trust is supplied by the reviewer, never derived from keys or identifiers inside a package. */
export function verifyEvidence(
  bytes: Uint8Array,
  context: VerificationContext,
): VerificationReport {
  const report: VerificationReport = {
    schema: "assurance-report/v1",
    status: "FAIL",
    code: "INVALID_INPUT",
    reason: "Invalid package",
    packageDigest: null,
    eventRoot: null,
    taskId: null,
    claimId: null,
    eventCount: 0,
    verifierActorIds: [],
    operation: null,
    limitations: [
      "Distinct local identities do not establish independent operators or malicious-host isolation.",
      "PASS reproduces registered verifier semantics; external execution and withheld-evidence completeness require separate provenance.",
    ],
  };
  const finish = (status: VerificationReport["status"], code: ErrorCode, reason: string) => ({
    ...report,
    status,
    code,
    reason,
  });
  try {
    // Fail fast before decoding/hashing oversized input.
    if (bytes.byteLength > MAX_PACKAGE_BYTES)
      throw new AssuranceError("RESOURCE_LIMIT", "Package exceeds 8 MiB");
    requireDigest(context.expectedPolicyDigest, "expectedPolicyDigest");
    requireDigest(context.expectedTaskId, "expectedTaskId");
    requireDigest(context.expectedClaimId, "expectedClaimId");
    if (context.expectedPackageDigest !== undefined)
      requireDigest(context.expectedPackageDigest, "expectedPackageDigest");
    report.packageDigest = packageDigest(bytes);
    if (context.expectedPackageDigest && context.expectedPackageDigest !== report.packageDigest)
      return finish(
        "FAIL",
        "INTEGRITY_MISMATCH",
        "Package bytes differ from the independently retained digest",
      );
    const { manifest: m, events } = parseEvidence(bytes);
    Object.assign(report, {
      eventRoot: m.eventRoot,
      taskId: m.taskId,
      claimId: m.claimId,
      eventCount: m.eventCount,
    });
    if (
      m.policyDigest !== context.expectedPolicyDigest ||
      m.taskId !== context.expectedTaskId ||
      m.claimId !== context.expectedClaimId
    )
      return finish(
        "FAIL",
        "BINDING_MISMATCH",
        "Package differs from the reviewer's policy, task or claim",
      );
    const registry = context.registry ?? CORE_VERIFIERS;
    const view = replay(events, m.policy, registry);
    if (view.eventRoot !== m.eventRoot)
      return finish("FAIL", "INTEGRITY_MISMATCH", "Declared event root differs from replay");
    const task = events.find((e) => e.id === m.taskEventId);
    const claim = view.claims.find((c) => c.id === m.claimId);
    if (task?.body.kind !== "task" || task.body.envelope.taskId !== m.taskId || !claim)
      return finish("BLOCKED", "INCOMPLETE_EVIDENCE", "Target task or claim is absent");
    if (claim.taskId !== m.taskEventId || claim.taskProvenanceValid !== true)
      return finish(
        "FAIL",
        "BINDING_MISMATCH",
        "Signed claim does not bind to exactly the declared task",
      );
    report.operation = task.body.envelope.operation;
    if (!registry.has(task.body.envelope.operation))
      return finish(
        "BLOCKED",
        "UNSUPPORTED_VERIFIER",
        "Reviewer has no registered verifier for this operation",
      );
    const operation = task.body.envelope.operation;
    for (const event of events) {
      if (!("claimId" in event.body) || event.body.claimId !== m.claimId) continue;
      if (
        (event.body.kind === "verification_request" || event.body.kind === "verification") &&
        event.body.verifier !== operation
      )
        return finish(
          "FAIL",
          "BINDING_MISMATCH",
          "Target verification selects a different operation from its task",
        );
      if (
        event.body.kind === "evidence" &&
        event.body.artifact.digest !== task.body.envelope.input.digest
      )
        return finish(
          "FAIL",
          "BINDING_MISMATCH",
          "Target evidence input differs from its task input",
        );
    }
    // Assess the target's causal cone and attached evidence. Unrelated retained research remains visible.
    const relevant = new Set([m.taskEventId, m.claimId]);
    for (const event of events)
      if ("claimId" in event.body && event.body.claimId === m.claimId) relevant.add(event.id);
      else if (event.body.kind === "decision" && event.body.claimIds.includes(m.claimId))
        relevant.add(event.id);
    let changed = true;
    while (changed) {
      changed = false;
      for (const event of events)
        if (relevant.has(event.id))
          for (const parent of event.parents)
            if (!relevant.has(parent)) {
              relevant.add(parent);
              changed = true;
            }
    }
    if (
      view.pending.some((id) => relevant.has(id)) ||
      view.blocked.some((b) => relevant.has(b.id)) ||
      view.decisions.some((d) => d.claimIds.includes(m.claimId) && !d.valid)
    )
      return finish(
        "BLOCKED",
        "INCOMPLETE_EVIDENCE",
        "Target evidence contains missing dependencies, quarantined or unreproduced events",
      );
    const receipts = view.verifications.filter(
      (v) => v.claimId === m.claimId && v.locallyReproduced && v.provenanceValid,
    );
    const matching = receipts.filter((v) => {
      const event = events.find((e) => e.id === v.id)!;
      return (
        event.body.kind === "verification" &&
        event.body.verifier === operation &&
        v.actorId !== claim.actorId &&
        v.actorId !== task.actorId
      );
    });
    const support = [
      ...new Set(matching.filter((v) => v.verdict === "SUPPORTED").map((v) => v.actorId)),
    ].sort();
    const refute = [
      ...new Set(matching.filter((v) => v.verdict === "REFUTED").map((v) => v.actorId)),
    ].sort();
    report.verifierActorIds = [...new Set([...support, ...refute])].sort();
    if (
      receipts.some((v) => v.verdict === "SUPPORTED") &&
      receipts.some((v) => v.verdict === "REFUTED")
    )
      return finish(
        "BLOCKED",
        "CONFLICT",
        "Reproduced receipts disagree; agreement cannot erase a counterexample",
      );
    if (refute.length >= 2)
      return finish(
        "FAIL",
        "CLAIM_REFUTED",
        "Two distinct non-submitter identities independently reproduce refutation",
      );
    if (refute.length)
      return finish(
        "BLOCKED",
        "QUORUM_MISSING",
        "Refutation exists; a second independent receipt is required",
      );
    if (support.length >= 2)
      return finish(
        "PASS",
        "VERIFIED",
        "Task-bound claim reproduced by two distinct non-submitter identities",
      );
    return finish(
      "BLOCKED",
      "QUORUM_MISSING",
      "Two independent conclusive verifier receipts are required",
    );
  } catch (cause) {
    return finish(
      "FAIL",
      cause instanceof AssuranceError ? cause.code : "INVALID_INPUT",
      cause instanceof Error ? cause.message : "Invalid package",
    );
  }
}
