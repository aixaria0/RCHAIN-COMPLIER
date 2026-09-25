#!/usr/bin/env node
/**
 * Distinct-ID witness census across two existing, read-only CBC DAG fixtures.
 *
 * Unlike M27's ordered tuples with replacement, candidates here are subsets
 * of four DIFFERENT message IDs. Reachability is checked for each source DAG;
 * the mirror finalizer result is only a research-model observation. A passing
 * source-level M11.5 Rust test must be reported separately; it cannot be
 * inferred from this TS census, nor does either result prove live ingress.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const SOURCE_SHA = "2d2c3d879b1a078693c8551385efb54a811d7172";
export const UPSTREAM_REVISION =
  "rchain-community/rchain-rust@d92f0787a6096cd6d79864ec2d7c1dd9b6912d0b";
const BONDED = ["v0", "v1", "v2", "v3"];
export const SCHEMA = "aria-cbc-distinct-message-census/v1";

export function canonical(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean" ||
      (typeof value === "number" && Number.isFinite(value))) return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object") {
    return "{" + Object.keys(value).sort().map((key) =>
      JSON.stringify(key) + ":" + canonical(value[key])).join(",") + "}";
  }
  throw new Error("Non-JSON witness property");
}
// Hash the entire fixture independently of the selected justification subset.
export const sourceGraphBase = (fixture) => ({
  bondsMap: fixture.bondsMap, messages: fixture.messages,
});
export const digest = (value) =>
  createHash("sha256").update(value, "utf8").digest("hex");

export function combinationsDistinct(sourceIds, take = 4) {
  if (!Array.isArray(sourceIds) || new Set(sourceIds).size !== sourceIds.length ||
      !sourceIds.every((id) => typeof id === "string" && id.length > 0))
    throw new Error("Candidate pool must contain unique nonempty message IDs");
  if (!Number.isInteger(take) || take < 1 || take > sourceIds.length)
    throw new Error("Invalid subset length");
  const found = [];
  function visit(start, selected) {
    if (selected.length === take) {
      found.push([...selected]);
      return;
    }
    for (let i = start; i <= sourceIds.length - (take - selected.length); i++)
      visit(i + 1, [...selected, sourceIds[i]]);
  }
  visit(0, []);
  return found;
}

function assertCausalIntegrity(fixture, reachability) {
  const ids = fixture.messages.map((m) => m.id);
  if (new Set(ids).size !== ids.length) throw new Error("Source DAG has duplicate message identities");
  const byId = new Map(fixture.messages.map((m) => [m.id, m]));
  if (fixture.messages.some((m) => m.parents.some((parent) => !byId.has(parent))))
    throw new Error("Source DAG has a missing parent");
  if (!reachability.reachable || reachability.violations.length)
    throw new Error("Source DAG does not pass source-level causal reachability checks");
}

export function census(fixtures, reachabilityFn, traceFn) {
  if (!Array.isArray(fixtures) || fixtures.length !== 2) throw new Error("Expected two distinct original fixtures");
  const datasets = [];
  for (const { name, fixture, pool } of fixtures) {
    if (name !== "causally-valid-control" && name !== "distinct-v0-message-stress")
      throw new Error("Unknown source fixture");
    assertCausalIntegrity(fixture, reachabilityFn(fixture));
    const byId = new Map(fixture.messages.map((m) => [m.id, m]));
    if (!pool.every((id) => byId.has(id))) throw new Error("Candidate pool references unknown IDs");
    const subsets = combinationsDistinct(pool);
    const candidates = subsets.map((ids) => {
      const senders = ids.map((id) => byId.get(id).sender);
      const represented = [...new Set(senders)].sort();
      const reachability = reachabilityFn({ ...fixture, justifications: ids });
      const mirror = traceFn({ ...fixture, justifications: ids });
      if (!reachability.reachable) throw new Error("Candidate failed source-level reachability");
      if (mirror.minimumMessageIds.some((id) => !byId.has(id)))
        throw new Error("Mirror returned non-source minimum-message ID");
      const traceSenders = mirror.minimumMessageSenders;
      const idsUnique = new Set(ids).size === ids.length;
      const missingBonded = BONDED.filter((bonded) =>
        !new Set(mirror.uniqueMinimumMessageSenders).has(bonded));
      return {
        messageIds: ids,
        justificationSenders: senders,
        messageIdsUnique: idsUnique,
        justificationSenderCount: represented.length,
        sourceDAGReachabilityChecked: true,
        traceMinimumMessageIds: mirror.minimumMessageIds,
        traceMinimumMessageSenders: traceSenders,
        traceDistinctMinimumSenders: mirror.uniqueMinimumMessageSenders.length,
        missingBondedMinimumSenders: missingBonded,
        modelCountGatePassed: mirror.checkMinMessagesPassed,
        modelReportedFinalized: mirror.finalized,
        modelReportedSupportStake: mirror.supportingStake,
        modelNextLayer: mirror.nextLayer ?? null,
        modelSupportMap: mirror.supportMap ?? null,
        modelTotalStake: mirror.totalStake ?? null,
        actualRustFinalizerExecutedForThisExactCandidate: false,
        wireIngressVerified: false,
      };
    });
    const underCoverage = candidates.filter((candidate) =>
      candidate.traceDistinctMinimumSenders < BONDED.length);
    const underCoverageModelFinalizing = underCoverage.filter((candidate) =>
      candidate.modelReportedFinalized);
    datasets.push({
      name,
      sourceMessageCount: fixture.messages.length,
      sourceGraphBaseSha256: digest(canonical(sourceGraphBase(fixture))),
      candidatePool: pool,
      distinctFourMessageCandidateCount: candidates.length,
      underCoverageCandidateCount: underCoverage.length,
      underCoverageModelFinalizingCount: underCoverageModelFinalizing.length,
      candidates,
    });
  }
  const all = datasets.flatMap((x) => x.candidates);
  const body = {
    schema: SCHEMA,
    producer: "aixaria0/RCHAIN-COMPLIER@" + SOURCE_SHA,
    researchUpstreamRevision: UPSTREAM_REVISION,
    enumeration: "unordered subsets of four distinct existing message IDs; no replacement or fabricated source message identity",
    datasets,
    totalDistinctIdCandidates: all.length,
    totalUnderCoverageCandidates: all.filter((c) => c.traceDistinctMinimumSenders < 4).length,
    totalUnderCoverageModelFinalizingCandidates: all.filter(
      (c) => c.traceDistinctMinimumSenders < 4 && c.modelReportedFinalized).length,
    originalM27FirstTuple: ["a3", "a3", "c3", "d3"],
    originalM27SelectedTupleUniqueIds: 3,
    originalM27SelectedTupleAdmittedAsFourUniqueMessages: false,
    claimBoundary: "Both source DAGs pass source-level causal checks. The exhaustive subset census measures a TypeScript mirror only; individual candidates have NOT been replayed in Rust or wire ingress. The original distinct-ID M11.5 Rust integration test is a separate, independent observation.",
  };
  return { ...body, recordSha256: digest(canonical(body)) };
}

export async function runFromPinnedSource(sourceDir) {
  const sha = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: sourceDir, encoding: "utf8", timeout: 20_000,
  }).trim();
  assert.equal(sha, SOURCE_SHA, "Refusing an unpinned research source revision");
  const dirty = execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], {
    cwd: sourceDir, encoding: "utf8", timeout: 20_000,
  });
  assert.equal(dirty.trim(), "", "Refusing modified pinned research checkout");
  const folder = join(sourceDir, "src/lib/cbc");
  const { buildCausallyValidDAG, buildDuplicateMinimumMessageDAG } =
    await import(pathToFileURL(join(folder, "casper-concrete-dag.ts")).href);
  const { analyzeUpstreamReachability } =
    await import(pathToFileURL(join(folder, "casper-upstream-reachability.ts")).href);
  const { traceCasperFinalizerSemantics } =
    await import(pathToFileURL(join(folder, "casper-finalizer-semantics.ts")).href);
  return census([
    {
      name: "causally-valid-control",
      fixture: buildCausallyValidDAG(),
      pool: ["a2", "a3", "b2", "b3", "c2", "c3", "d2", "d3"],
    },
    {
      name: "distinct-v0-message-stress",
      fixture: buildDuplicateMinimumMessageDAG(),
      pool: ["a2", "a3", "b2", "b3", "c2", "c3", "d2"],
    },
  ], analyzeUpstreamReachability, traceCasperFinalizerSemantics);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  try {
    const i = process.argv.indexOf("--source-dir");
    const j = process.argv.indexOf("--output");
    if (i < 0 || j < 0 || !process.argv[i + 1] || !process.argv[j + 1])
      throw new Error("Usage: --source-dir PINNED_M27 --output REPORT.json");
    const report = await runFromPinnedSource(resolve(process.argv[i + 1]));
    const target = resolve(process.argv[j + 1]);
    await mkdir(resolve(target, ".."), { recursive: true });
    await writeFile(target, JSON.stringify(report, null, 2) + "\n", "utf8");
    console.log(JSON.stringify({
      schema: report.schema,
      totalDistinctIdCandidates: report.totalDistinctIdCandidates,
      underCoverageCandidates: report.totalUnderCoverageCandidates,
      sourceReportedFinalizingUnderCoverage: report.totalUnderCoverageModelFinalizingCandidates,
      originalM27SelectedTupleAdmittedAsFourUniqueMessages: false,
      rustProofForEveryCandidate: false,
      recordSha256: report.recordSha256,
    }));
  } catch (error) { console.error(error); process.exitCode = 1; }
}
