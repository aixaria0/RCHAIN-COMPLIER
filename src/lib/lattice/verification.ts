import {
  compileVerification,
  type VerificationAdapter,
} from "../compiler/verification-compiler.ts";
import { assuranceStatusFromVerificationOutcome } from "../compiler/ecosystem-chain.ts";
import {
  artifactDigest,
  canonical,
  exact,
  type EventBody,
  type Json,
  type LatticeEvent,
  type Verdict,
} from "./protocol.ts";
export interface ReproducedResult {
  verdict: Verdict;
  artifact: Json;
}
export type VerifierRegistry = ReadonlyMap<
  string,
  (claim: LatticeEvent, evidence: LatticeEvent[]) => ReproducedResult
>;
const sumVerifier = (claim: LatticeEvent, evidence: LatticeEvent[]): ReproducedResult => {
  if (claim.body.kind !== "claim" || evidence.length !== 1 || evidence[0]!.body.kind !== "evidence")
    throw new Error("one claim and one evidence required");
  const c = claim.body,
    e = evidence[0]!.body;
  if (
    e.claimId !== claim.id ||
    c.subject !== e.artifact.digest ||
    c.predicate !== "integer-sum" ||
    c.domain !== "arithmetic" ||
    !Number.isSafeInteger(c.value)
  )
    throw new Error("integer-sum scope mismatch");
  const data = exact(e.artifact.content, ["schema", "values"]);
  if (
    data.schema !== "integer-sum-input/v1" ||
    !Array.isArray(data.values) ||
    !data.values.length ||
    data.values.length > 128 ||
    data.values.some((v) => !Number.isSafeInteger(v) || Math.abs(v) > 1000000)
  )
    throw new Error("bounded integer input required");
  const values = data.values as number[],
    sum = values.reduce((a, b) => a + b, 0);
  const adapter: VerificationAdapter = {
    id: "integer-sum",
    version: "1",
    modelFamily: "integer-sum",
    priority: 0,
    supports: () => true,
    verify: (p) => ({
      schema: "verification-artifact/v1",
      problemId: p.id,
      modelFamily: p.modelFamily,
      adapterId: "integer-sum",
      adapterVersion: "1",
      outcome: sum === c.value ? "UNREACHABLE_IN_MODEL" : "WITNESS_FOUND",
      scope: p.scope,
      assumptions: p.assumptions,
      limitations: [
        "Checks the exact supplied integers only; completeness and external relevance are not established.",
      ],
      witness: { sum, claimed: c.value, datasetDigest: artifactDigest(e.artifact.content) },
      metrics: { valuesChecked: values.length },
    }),
  };
  const compiled = compileVerification(
    {
      id: claim.id,
      modelFamily: "integer-sum",
      scope: {
        subject: c.subject,
        predicate: c.predicate,
        domain: c.domain,
        evidenceId: evidence[0]!.id,
      },
      assumptions: c.assumptions,
      payload: { values, claimed: c.value },
    },
    [adapter],
  );
  if (compiled.status !== "COMPILED" || !compiled.artifact)
    throw new Error("verification compiler blocked");
  const status = assuranceStatusFromVerificationOutcome(compiled.artifact.outcome, "VIOLATION");
  return {
    verdict: status === "PASS" ? "SUPPORTED" : status === "FAIL" ? "REFUTED" : "INCONCLUSIVE",
    artifact: JSON.parse(canonical(compiled.artifact)) as Json,
  };
};
export const DEFAULT_VERIFIERS: VerifierRegistry = new Map([["integer-sum/v1", sumVerifier]]);
export function reproduceRequest(
  request: LatticeEvent,
  events: ReadonlyMap<string, LatticeEvent>,
  registry = DEFAULT_VERIFIERS,
): ReproducedResult {
  if (request.body.kind !== "verification_request")
    throw new Error("verification request required");
  const verifier = registry.get(request.body.verifier);
  if (!verifier) throw new Error("unregistered verifier");
  const claim = events.get(request.body.claimId),
    evidence = request.body.evidenceIds.map((id) => events.get(id));
  if (!claim || evidence.some((e) => !e)) throw new Error("missing inputs");
  return verifier(claim, evidence as LatticeEvent[]);
}
export function verificationBody(
  request: LatticeEvent,
  events: ReadonlyMap<string, LatticeEvent>,
): Extract<EventBody, { kind: "verification" }> {
  if (request.body.kind !== "verification_request") throw new Error("request required");
  return {
    kind: "verification",
    requestId: request.id,
    claimId: request.body.claimId,
    evidenceIds: request.body.evidenceIds,
    verifier: request.body.verifier,
    ...reproduceRequest(request, events),
  };
}
