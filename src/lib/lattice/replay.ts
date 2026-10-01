import { sha256Artifact } from "../compiler/ecosystem-chain.ts";
import {
  canonical,
  policyDigest,
  validateEvent,
  type DecisionResult,
  type LatticeEvent,
  type MembershipPolicy,
  type Verdict,
} from "./protocol.ts";
import { DEFAULT_VERIFIERS, reproduceRequest, type VerifierRegistry } from "./verification.ts";
export interface VerificationView {
  id: string;
  claimId: string;
  taskId: string | null;
  provenanceValid: boolean;
  verdict: Verdict;
  locallyReproduced: boolean;
  reason: string;
}
export function decide(
  claimIds: string[],
  verificationIds: string[],
  views: VerificationView[],
): DecisionResult {
  const selected = new Set(verificationIds),
    result: DecisionResult = { accepted: [], rejected: [], unresolved: [] };
  for (const id of claimIds.slice().sort()) {
    const results = views.filter(
        (v) => selected.has(v.id) && v.claimId === id && v.locallyReproduced,
      ),
      support = results.some((v) => v.verdict === "SUPPORTED"),
      refute = results.some((v) => v.verdict === "REFUTED");
    (support && !refute
      ? result.accepted
      : refute && !support
        ? result.rejected
        : result.unresolved
    ).push(id);
  }
  return result;
}
export function replay(
  input: readonly LatticeEvent[],
  policy: MembershipPolicy,
  registry: VerifierRegistry = DEFAULT_VERIFIERS,
) {
  if (input.length > 4096) throw new Error("replay event limit");
  const unique = new Map<string, LatticeEvent>();
  for (const value of input) {
    const event = validateEvent(value, policy),
      old = unique.get(event.id);
    if (old && canonical(old) !== canonical(event)) throw new Error("event ID collision");
    unique.set(event.id, event);
  }
  const events = [...unique.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
    slots = new Map<string, LatticeEvent[]>();
  for (const e of events) {
    const slot = `${e.actorId}:${e.sequence}`;
    slots.set(slot, [...(slots.get(slot) ?? []), e]);
  }
  const equivocations = [...slots.values()]
      .filter((v) => v.length > 1)
      .map((v) => ({
        actorId: v[0]!.actorId,
        sequence: v[0]!.sequence,
        eventIds: v.map((e) => e.id),
      })),
    quarantine = new Set(equivocations.flatMap((v) => v.eventIds));
  let changed = true;
  while (changed) {
    changed = false;
    for (const e of events)
      if (!quarantine.has(e.id) && e.parents.some((p) => quarantine.has(p))) {
        quarantine.add(e.id);
        changed = true;
      }
  }
  const ready = new Set<string>();
  changed = true;
  while (changed) {
    changed = false;
    for (const e of events)
      if (!ready.has(e.id) && !quarantine.has(e.id) && e.parents.every((p) => ready.has(p))) {
        ready.add(e.id);
        changed = true;
      }
  }
  const pending = events.filter((e) => !ready.has(e.id) && !quarantine.has(e.id)).map((e) => e.id),
    eligible = events.filter((e) => ready.has(e.id));
  const blocked: { id: string; reason: string }[] = events
    .filter((e) => quarantine.has(e.id))
    .map((e) => ({ id: e.id, reason: "equivocation or dependency on equivocation" }));
  const invalidTaskClaims = new Set<string>();
  const taskProvenance = eligible
    .filter((e) => e.body.kind === "claim")
    .flatMap((claim) => {
      if (claim.body.kind !== "claim") return [];
      const claimBody = claim.body;
      const tasks = claim.parents
        .map((id) => unique.get(id))
        .filter((e): e is LatticeEvent => e?.body.kind === "task");
      if (!tasks.length) return [];
      const validTasks = tasks.filter((task) => {
        if (task.body.kind !== "task") return false;
        const envelope = task.body.envelope;
        return (
          ready.has(task.id) &&
          envelope.domain === claimBody.domain &&
          envelope.operation === claimBody.method &&
          envelope.input.digest === claimBody.subject &&
          envelope.output.claimPredicate === claimBody.predicate
        );
      });
      const valid = tasks.length === 1 && validTasks.length === 1;
      if (!valid) {
        invalidTaskClaims.add(claim.id);
        blocked.push({ id: claim.id, reason: "task provenance mismatch" });
      }
      return [{ claimId: claim.id, taskId: tasks[0]!.id, valid }];
    });
  function scope(e: LatticeEvent, id: string) {
    const claim = unique.get(id),
      member = policy.members.find((m) => m.actorId === e.actorId)!;
    return (
      claim?.body.kind === "claim" &&
      !invalidTaskClaims.has(id) &&
      (member.domains.includes("*") || member.domains.includes(claim.body.domain))
    );
  }
  function provenanceForClaim(claimId: string) {
    const match = taskProvenance.find((p) => p.claimId === claimId);
    return { taskId: match?.taskId ?? null, valid: match?.valid ?? true };
  }
  function inputs(request: LatticeEvent) {
    if (request.body.kind !== "verification_request" || !scope(request, request.body.claimId))
      throw new Error("request claim/domain mismatch");
    const b = request.body;
    for (const id of b.evidenceIds) {
      const e = unique.get(id)!;
      if (e.body.kind !== "evidence" || e.body.claimId !== b.claimId || !scope(e, b.claimId))
        throw new Error("evidence claim/domain mismatch");
    }
  }
  for (const e of eligible) {
    const b = e.body;
    if (
      !["evidence", "challenge", "evidence_request", "verification_request"].includes(b.kind) ||
      !("claimId" in b)
    )
      continue;
    try {
      if (!scope(e, b.claimId)) throw new Error("claim reference/domain mismatch");
      if (b.kind === "verification_request") {
        inputs(e);
        if (!registry.has(b.verifier)) throw new Error("unregistered verifier");
      }
    } catch (error) {
      blocked.push({
        id: e.id,
        reason: error instanceof Error ? error.message : "invalid reference",
      });
    }
  }
  const verifications: VerificationView[] = [];
  for (const e of eligible) {
    if (e.body.kind !== "verification") continue;
    const b = e.body;
    let locallyReproduced = false,
      reason = "";
    try {
      if (!scope(e, b.claimId)) throw new Error("verification domain mismatch");
      const request = unique.get(b.requestId)!;
      inputs(request);
      if (
        request.body.kind !== "verification_request" ||
        request.body.claimId !== b.claimId ||
        request.body.verifier !== b.verifier ||
        canonical(request.body.evidenceIds) !== canonical(b.evidenceIds)
      )
        throw new Error("request binding mismatch");
      const result = reproduceRequest(request, unique, registry);
      if (result.verdict !== b.verdict || canonical(result.artifact) !== canonical(b.artifact))
        throw new Error("local reproduction differs");
      locallyReproduced = true;
      reason = "locally reproduced using registered deterministic verifier";
    } catch (error) {
      reason = error instanceof Error ? error.message : "verification failed";
    }
    const provenance = provenanceForClaim(b.claimId);
    verifications.push({
      id: e.id,
      claimId: b.claimId,
      taskId: provenance.taskId,
      provenanceValid: provenance.valid,
      verdict: b.verdict,
      locallyReproduced,
      reason,
    });
    if (!locallyReproduced) blocked.push({ id: e.id, reason });
  }
  const claims = events
    .filter((e) => e.body.kind === "claim")
    .map((e) => {
      const results = verifications.filter((v) => v.claimId === e.id && v.locallyReproduced),
        support = results.some((v) => v.verdict === "SUPPORTED"),
        refute = results.some((v) => v.verdict === "REFUTED");
      const linked = eligible.filter(
          (v) => "claimId" in v.body && v.body.claimId === e.id && scope(v, e.id),
        ),
        ids = (kind: string) => linked.filter((v) => v.body.kind === kind).map((v) => v.id);
      return {
        id: e.id,
        actorId: e.actorId,
        issuedAt: e.issuedAt,
        claim: e.body,
        taskId: taskProvenance.find((p) => p.claimId === e.id)?.taskId ?? null,
        taskProvenanceValid: taskProvenance.find((p) => p.claimId === e.id)?.valid ?? null,
        status: quarantine.has(e.id)
          ? "QUARANTINED"
          : !ready.has(e.id)
            ? "PENDING"
            : support && refute
              ? "DISPUTED"
              : support
                ? "SUPPORTED"
                : refute
                  ? "REFUTED"
                  : "UNVERIFIED",
        evidenceIds: ids("evidence"),
        challengeIds: ids("challenge"),
        evidenceRequestIds: ids("evidence_request"),
        verificationRequestIds: ids("verification_request"),
        verificationIds: verifications.filter((v) => v.claimId === e.id).map((v) => v.id),
        provenance: {
          taskId: provenanceForClaim(e.id).taskId,
          evidenceIds: ids("evidence"),
          verificationRequestIds: ids("verification_request"),
          verificationIds: verifications.filter((v) => v.claimId === e.id).map((v) => v.id),
          valid: provenanceForClaim(e.id).valid,
        },
      };
    });
  const groups = new Map<string, LatticeEvent[]>();
  for (const e of events)
    if (e.body.kind === "claim") {
      const key = canonical({
        subject: e.body.subject,
        predicate: e.body.predicate,
        domain: e.body.domain,
        assumptions: e.body.assumptions.slice().sort(),
      });
      groups.set(key, [...(groups.get(key) ?? []), e]);
    }
  const disagreements = [...groups.entries()]
    .filter(
      ([, v]) =>
        new Set(v.map((e) => canonical(e.body.kind === "claim" ? e.body.value : null))).size > 1,
    )
    .map(([proposition, v]) => ({
      proposition: JSON.parse(proposition) as unknown,
      claimIds: v.map((e) => e.id),
    }));
  const decisions = eligible
    .filter((e) => e.body.kind === "decision")
    .map((e) => {
      if (e.body.kind !== "decision") throw new Error("unreachable");
      const b = e.body,
        recomputed = decide(b.claimIds, b.verificationIds, verifications);
      const bound =
        b.claimIds.every(
          (id) => unique.get(id)?.body.kind === "claim" && ready.has(id) && scope(e, id),
        ) &&
        b.verificationIds.every((id) => {
          const v = unique.get(id);
          if (v?.body.kind !== "verification" || !ready.has(id)) return false;
          const claimId = v.body.claimId;
          return (
            b.claimIds.includes(claimId) &&
            verifications.some(
              (receipt) =>
                receipt.id === id &&
                receipt.locallyReproduced &&
                receipt.provenanceValid &&
                receipt.taskId === provenanceForClaim(claimId).taskId,
            )
          );
        });
      return {
        id: e.id,
        actorId: e.actorId,
        procedure: b.procedure,
        claimIds: b.claimIds,
        verificationIds: b.verificationIds,
        valid: bound && canonical(recomputed) === canonical(b.result),
        declared: b.result,
        recomputed,
        authority: "actor-scoped evidence cut; no execution permit or universal truth",
      };
    });
  return {
    schema: "intelligence-lattice-view/v1",
    latticeId: policy.latticeId,
    policyDigest: policyDigest(policy),
    eventCount: events.length,
    eventRoot: sha256Artifact(
      `intelligence-lattice-set/v1\0${policyDigest(policy)}\0${events.map((e) => e.id).join("\n")}`,
    ),
    ready: [...ready].sort(),
    pending,
    blocked: blocked.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
    equivocations,
    claims,
    taskProvenance,
    disagreements,
    verifications,
    decisions,
  };
}
