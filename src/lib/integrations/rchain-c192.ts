/** RChain witness validation integration; never establishes upstream execution itself. */
import {
  compileVerification,
  type VerificationAdapter,
} from "../compiler/verification-compiler.ts";
import { assuranceStatusFromVerificationOutcome } from "../compiler/ecosystem-chain.ts";
import { canonical, exact, type Json, type LatticeEvent } from "../lattice/protocol.ts";
import type { ReproducedResult, VerifierRegistry } from "../lattice/verification.ts";
const C192_REPOSITORY = "rchain-community/rchain-rust";
const C192_REVISION = "51935310789a1a75a183ad0af7152e4eef450c88";
const C192_TEST = "a_round_that_comes_to_rest_at_one_height_is_sealed_by_its_own_bound";
const C192_SOURCE = "node/src/runtime/node_runtime.rs";
const C192_EVIDENCE = "spec/audit/evidence/n149-results.md";
const C192_COMMAND = `cargo test -p rchain-node ${C192_TEST} -- --nocapture`;
const SHA256 = /^sha256:[0-9a-f]{64}$/;
export const c192Verifier = (claim: LatticeEvent, evidence: LatticeEvent[]): ReproducedResult => {
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
export const RCHAIN_VERIFIERS: VerifierRegistry = new Map([
  ["rchain-c192-upstream/v1", c192Verifier],
]);
