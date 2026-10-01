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

const C192_REPOSITORY = "rchain-community/rchain-rust";
const C192_REVISION = "51935310789a1a75a183ad0af7152e4eef450c88";
const C192_TEST = "a_round_that_comes_to_rest_at_one_height_is_sealed_by_its_own_bound";
const C192_SOURCE = "node/src/runtime/node_runtime.rs";
const C192_EVIDENCE = "spec/audit/evidence/n149-results.md";
const C192_COMMAND = `cargo test -p rchain-node ${C192_TEST} -- --nocapture`;
const SHA256 = /^sha256:[0-9a-f]{64}$/;
const c192Verifier = (claim: LatticeEvent, evidence: LatticeEvent[]): ReproducedResult => {
  if (claim.body.kind !== "claim" || evidence.length !== 1 || evidence[0]!.body.kind !== "evidence")
    throw new Error("one claim and one evidence required");
  const c = claim.body,
    e = evidence[0]!.body;
  if (
    e.claimId !== claim.id ||
    c.subject !== e.artifact.digest ||
    c.predicate !== "c192-upstream-falsifier-passes" ||
    c.domain !== "rchain-casper" ||
    c.method !== "rchain-c192-upstream/v1" ||
    c.value !== true
  )
    throw new Error("C192 scope mismatch");
  const data = exact(e.artifact.content, [
    "schema",
    "repository",
    "revision",
    "issue",
    "finding",
    "sourcePath",
    "evidencePath",
    "testName",
    "command",
    "exitCode",
    "testPassed",
    "sourceSha256",
    "evidenceSha256",
    "outputSha256",
    "runUrl",
  ]);
  if (
    data.schema !== "rchain-c192-upstream-witness/v1" ||
    data.repository !== C192_REPOSITORY ||
    data.revision !== C192_REVISION ||
    data.issue !== 172 ||
    data.finding !== "C192" ||
    data.sourcePath !== C192_SOURCE ||
    data.evidencePath !== C192_EVIDENCE ||
    data.testName !== C192_TEST ||
    data.command !== C192_COMMAND ||
    data.exitCode !== 0 ||
    data.testPassed !== true ||
    typeof data.sourceSha256 !== "string" ||
    !SHA256.test(data.sourceSha256) ||
    typeof data.evidenceSha256 !== "string" ||
    !SHA256.test(data.evidenceSha256) ||
    typeof data.outputSha256 !== "string" ||
    !SHA256.test(data.outputSha256) ||
    typeof data.runUrl !== "string" ||
    !data.runUrl.startsWith("https://github.com/")
  )
    throw new Error("invalid pinned C192 upstream witness");
  const adapter: VerificationAdapter = {
    id: "rchain-c192-upstream",
    version: "1",
    modelFamily: "rchain-c192-upstream",
    priority: 0,
    supports: () => true,
    verify: (p) => ({
      schema: "verification-artifact/v1",
      problemId: p.id,
      modelFamily: p.modelFamily,
      adapterId: "rchain-c192-upstream",
      adapterVersion: "1",
      outcome: "WITNESS_FOUND",
      scope: p.scope,
      assumptions: p.assumptions,
      limitations: [
        "Confirms the pinned upstream C192 unit falsifier executed successfully; it does not rerun the multi-validator devnet measurement.",
        "Does not establish a repair, Byzantine safety, network finality, or production liveness.",
      ],
      witness: {
        repository: data.repository,
        revision: data.revision,
        issue: data.issue,
        finding: data.finding,
        testName: data.testName,
        sourceSha256: data.sourceSha256,
        evidenceSha256: data.evidenceSha256,
        outputSha256: data.outputSha256,
      },
      metrics: { upstreamTestsChecked: 1 },
    }),
  };
  const compiled = compileVerification(
    {
      id: claim.id,
      modelFamily: "rchain-c192-upstream",
      scope: {
        subject: c.subject,
        predicate: c.predicate,
        domain: c.domain,
        evidenceId: evidence[0]!.id,
        repository: data.repository,
        revision: data.revision,
      },
      assumptions: c.assumptions,
      payload: JSON.parse(canonical(e.artifact.content)) as Json,
    },
    [adapter],
  );
  if (compiled.status !== "COMPILED" || !compiled.artifact)
    throw new Error("verification compiler blocked");
  const status = assuranceStatusFromVerificationOutcome(compiled.artifact.outcome, "SUPPORT");
  return {
    verdict: status === "PASS" ? "SUPPORTED" : status === "FAIL" ? "REFUTED" : "INCONCLUSIVE",
    artifact: JSON.parse(canonical(compiled.artifact)) as Json,
  };
};
export const DEFAULT_VERIFIERS: VerifierRegistry = new Map([
  ["integer-sum/v1", sumVerifier],
  ["rchain-c192-upstream/v1", c192Verifier],
]);
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
