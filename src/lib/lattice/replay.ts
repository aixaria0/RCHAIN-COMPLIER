import { canonical } from "./canonical.ts";
import {
  artifactDigest,
  EVENT_KINDS,
  policyDigest,
  sha256Artifact,
  type Json,
  type LatticeEvent,
  type MembershipPolicy,
} from "./protocol.ts";
import {
  DEFAULT_VERIFIERS,
  reproduceRequest,
  type ReproducedResult,
  type VerifierRegistry,
} from "./verification.ts";

export type DecisionResult = {
  accepted: string[];
  rejected: string[];
  unresolved: string[];
};

export function decide(
  claimIds: string[],
  verificationIds: string[],
  verifications: Array<{
    id: string;
    claimId: string;
    verdict: "SUPPORTED" | "REFUTED" | "INCONCLUSIVE";
    locallyReproduced: boolean;
  }>,
): DecisionResult {
  const selected = new Set(verificationIds);
  const byClaim = new Map<string, Set<string>>();
  for (const v of verifications) {
    if (!selected.has(v.id) || !v.locallyReproduced) continue;
    const s = byClaim.get(v.claimId) ?? new Set<string>();
    s.add(v.verdict);
    byClaim.set(v.claimId, s);
  }
  const accepted: string[] = [],
    rejected: string[] = [],
    unresolved: string[] = [];
  for (const id of claimIds) {
    const verdicts = byClaim.get(id) ?? new Set<string>();
    const support = verdicts.has("SUPPORTED"),
      refute = verdicts.has("REFUTED");
    if (support && !refute) accepted.push(id);
    else if (refute && !support) rejected.push(id);
    else unresolved.push(id);
  }
  return { accepted, rejected, unresolved };
}

export function replay(
  input: LatticeEvent[],
  policy: MembershipPolicy,
  registry: VerifierRegistry = DEFAULT_VERIFIERS,
) {
  const unique = new Map<string, LatticeEvent>();
  for (const e of input) unique.set(e.id, e);
  const events = [...unique.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const byActorSequence = new Map<string, LatticeEvent[]>();
  for (const e of events) {
    const key = `${e.actorId}:${e.sequence}`;
    byActorSequence.set(key, [...(byActorSequence.get(key) ?? []), e]);
  }
  const equivocations = [...byActorSequence.entries()]
    .filter(([, v]) => v.length > 1)
    .map(([key, v]) => ({ key, eventIds: v.map((e) => e.id).sort() }));
  const quarantined = new Set(equivocations.flatMap((x) => x.eventIds));

  const ready = new Set<string>();
  const blocked: Array<{ id: string; reason: string }> = [];
  const pending: Array<{ id: string; missing: string[] }> = [];

  let progress = true;
  while (progress) {
    progress = false;
    for (const e of events) {
      if (ready.has(e.id) || quarantined.has(e.id) || blocked.some((b) => b.id === e.id)) continue;
      const refs: string[] = [];
      switch (e.body.kind) {
        case "evidence":
          refs.push(e.body.claimId);
          break;
        case "challenge":
        case "evidence_request":
          refs.push(e.body.claimId);
          break;
        case "verification_request":
          refs.push(e.body.claimId, ...e.body.evidenceIds);
          break;
        case "verification":
          refs.push(e.body.requestId, e.body.claimId, ...e.body.evidenceIds);
          break;
        case "decision":
          refs.push(...e.body.claimIds, ...e.body.verificationIds);
          break;
      }
      const missing = refs.filter((id) => !unique.has(id));
      if (missing.length) continue;
      const quarantinedRef = refs.find((id) => quarantined.has(id));
      if (quarantinedRef) {
        blocked.push({ id: e.id, reason: `dependency quarantined: ${quarantinedRef}` });
        progress = true;
        continue;
      }
      if (!refs.every((id) => ready.has(id))) continue;

      if (e.body.kind === "verification_request" && !registry.has(e.body.verifier)) {
        blocked.push({ id: e.id, reason: "unregistered verifier" });
        progress = true;
        continue;
      }
      if (e.body.kind === "verification") {
        const request = unique.get(e.body.requestId);
        if (!request || request.body.kind !== "verification_request") {
          blocked.push({ id: e.id, reason: "invalid verification request binding" });
          progress = true;
          continue;
        }
        try {
          const reproduced = reproduceRequest(request, unique, registry);
          const matches =
            reproduced.verdict === e.body.verdict &&
            canonical(reproduced.artifact) === canonical(e.body.artifact);
          if (!matches) {
            blocked.push({ id: e.id, reason: "verification reproduction mismatch" });
            progress = true;
            continue;
          }
        } catch {
          blocked.push({ id: e.id, reason: "verification reproduction failed" });
          progress = true;
          continue;
        }
      }
      ready.add(e.id);
      progress = true;
    }
  }

  for (const e of events) {
    if (ready.has(e.id) || quarantined.has(e.id) || blocked.some((b) => b.id === e.id)) continue;
    const refs: string[] = [];
    switch (e.body.kind) {
      case "evidence":
      case "challenge":
      case "evidence_request":
        refs.push(e.body.claimId);
        break;
      case "verification_request":
        refs.push(e.body.claimId, ...e.body.evidenceIds);
        break;
      case "verification":
        refs.push(e.body.requestId, e.body.claimId, ...e.body.evidenceIds);
        break;
      case "decision":
        refs.push(...e.body.claimIds, ...e.body.verificationIds);
        break;
    }
    pending.push({ id: e.id, missing: refs.filter((id) => !ready.has(id)) });
  }

  const verifications = events
    .filter((e) => e.body.kind === "verification")
    .map((e) => {
      if (e.body.kind !== "verification") throw new Error("unreachable");
      let locallyReproduced = false;
      try {
        const request = unique.get(e.body.requestId);
        if (request?.body.kind === "verification_request") {
          const reproduced = reproduceRequest(request, unique, registry);
          locallyReproduced =
            reproduced.verdict === e.body.verdict &&
            canonical(reproduced.artifact) === canonical(e.body.artifact);
        }
      } catch {
        locallyReproduced = false;
      }
      return {
        id: e.id,
        claimId: e.body.claimId,
        requestId: e.body.requestId,
        verifier: e.body.verifier,
        verdict: e.body.verdict,
        artifact: e.body.artifact,
        locallyReproduced,
      };
    });

  const scope = (event: LatticeEvent, referencedId: string) =>
    event.parents.length === 0 || event.parents.includes(referencedId) || unique.has(referencedId);

  const eligible = events.filter((e) => ready.has(e.id) && !quarantined.has(e.id));
  const claims = events
    .filter((e) => e.body.kind === "claim")
    .map((e) => {
      if (e.body.kind !== "claim") throw new Error("unreachable");
      const ids = (kind: (typeof EVENT_KINDS)[number]) =>
        eligible
          .filter((x) => x.body.kind === kind && "claimId" in x.body && x.body.claimId === e.id)
          .map((x) => x.id);
      const relevant = verifications.filter((v) => v.claimId === e.id && v.locallyReproduced);
      const support = relevant.some((v) => v.verdict === "SUPPORTED"),
        refute = relevant.some((v) => v.verdict === "REFUTED");
      return {
        id: e.id,
        actorId: e.actorId,
        subject: e.body.subject,
        predicate: e.body.predicate,
        value: e.body.value,
        domain: e.body.domain,
        assumptions: e.body.assumptions,
        assertedConfidence: e.body.confidence,
        status: quarantined.has(e.id)
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
          const reproduced = verifications.find((r) => r.id === id);
          return (
            v?.body.kind === "verification" &&
            ready.has(id) &&
            b.claimIds.includes(v.body.claimId) &&
            reproduced?.locallyReproduced === true
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
    verifications,
    disagreements,
    decisions,
  };
}
