#!/usr/bin/env node
/** Export a full causal-DAG candidate, not merely the four sender labels.
 *
 * Selects a deterministic four-distinct-message, three-sender, model-finalizing
 * candidate. Full graph bytes and stakes travel with its own content digest.
 * NOT a Rust-tested or wire-ingress-tested finality witness.
 */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { runFromPinnedSource, SOURCE_SHA, SCHEMA, canonical, digest } from "./cbc_distinct_message_census.mjs";

export const PACKET_SCHEMA = "aria-cbc-distinct-id-rust-replay-input/v1";
const BONDED = ["v0", "v1", "v2", "v3"];

export function makePacket(census) {
  if (census?.schema !== SCHEMA) throw new Error("Unsupported census input schema");
  const { recordSha256: seal, ...body } = census;
  if (seal !== digest(canonical(body))) throw new Error("Census digest mismatch");
  if (!Array.isArray(census.datasets) || census.datasets.length !== 2)
    throw new Error("Exactly two source DAG datasets required");
  for (const dataset of census.datasets) {
    if (!Array.isArray(dataset.candidates)) throw new Error("Missing source candidates");
    for (const candidate of dataset.candidates) {
      if (!Array.isArray(candidate.messageIds) || candidate.messageIds.length !== 4 ||
          new Set(candidate.messageIds).size !== 4 || candidate.messageIdsUnique !== true)
        throw new Error("Census contains duplicate or invalid candidate message identity");
      if (!Array.isArray(candidate.justificationSenders) ||
          candidate.justificationSenders.length !== 4 ||
          candidate.actualRustFinalizerExecutedForThisExactCandidate !== false ||
          candidate.wireIngressVerified !== false)
        throw new Error("Candidate attempts to elevate unverified source-model claims");
    }
  }
  const choices = census.datasets.flatMap((dataset) =>
    dataset.candidates
      .filter((candidate) =>
        candidate.messageIdsUnique === true &&
        candidate.messageIds.length === 4 &&
        candidate.traceDistinctMinimumSenders === 3 &&
        candidate.modelCountGatePassed === true &&
        candidate.modelReportedFinalized === true &&
        candidate.sourceDAGReachabilityChecked === true &&
        candidate.actualRustFinalizerExecutedForThisExactCandidate === false &&
        candidate.wireIngressVerified === false)
      .map((candidate) => ({ dataset, candidate })));
  choices.sort((a, b) =>
    a.dataset.name.localeCompare(b.dataset.name) ||
    a.candidate.messageIds.join(",").localeCompare(b.candidate.messageIds.join(",")));
  // No invented result if the constrained model has no candidate.
  const selected = choices[0];
  if (!selected) {
    return { schema: PACKET_SCHEMA, selection: "NO_ELIGIBLE_SOURCE_MODEL_CANDIDATE",
      censusSha256: seal, sourceCommit: SOURCE_SHA, rustReplayVerified: false,
      wireIngressVerified: false };
  }
  const ids = selected.candidate.messageIds;
  if (new Set(ids).size !== 4) throw new Error("Selected witness repeats a message ID");
  if (new Set(selected.candidate.justificationSenders).size !== 3)
    throw new Error("Selected witness has unexpected source sender coverage");
  const encoded = {
    schema: PACKET_SCHEMA,
    selection: "MODEL_CANDIDATE_READY_FOR_INDEPENDENT_RUST_REPLAY",
    censusSha256: seal,
    sourceCommit: SOURCE_SHA,
    sourceDAGFamily: selected.dataset.name,
    sourceDAGMessageCount: selected.dataset.sourceMessageCount,
    selectedJustificationIds: [...ids],
    selectedJustificationSenders: [...selected.candidate.justificationSenders],
    missingBondedMinimumSenders: [...selected.candidate.missingBondedMinimumSenders],
    sourceModelFinalized: true,
    rustReplayVerified: false,
    wireIngressVerified: false,
    claimBoundary: "Deterministic selection from reachable original TypeScript source DAG; four distinct message IDs, model-only finalization. Exact graph and intermediate Finalizer results require independent Rust execution. Not a live-network or safety proof.",
  };
  // This stage intentionally uses only census metadata. Full original graph
  // is injected by the source-pinned builder below.
  return encoded;
}

export function bindSourceGraph(packet, fixture, reachabilityFn) {
  if (packet.selection !== "MODEL_CANDIDATE_READY_FOR_INDEPENDENT_RUST_REPLAY")
    throw new Error("Cannot bind absent candidate");
  const reachable = reachabilityFn({
    ...fixture, justifications: packet.selectedJustificationIds,
  });
  if (!reachable.reachable || reachable.violations.length)
    throw new Error("Selected source graph did not pass reachability screen");
  if (new Set(fixture.messages.map((message) => message.id)).size !== fixture.messages.length)
    throw new Error("Source graph contains duplicate message identities");
  const byId = new Map(fixture.messages.map((message) => [message.id, message]));
  for (const [i, id] of packet.selectedJustificationIds.entries()) {
    if (!byId.has(id) || byId.get(id).sender !== packet.selectedJustificationSenders[i])
      throw new Error("Selected ID/sender not present in exact source DAG");
  }
  if (BONDED.some((sender) => !(sender in fixture.bondsMap)))
    throw new Error("Missing bonded validator stake");
  const sourceGraph = {
    bondsMap: { ...fixture.bondsMap },
    messages: fixture.messages.map((message) => ({
      id: message.id, sender: message.sender, senderSeq: message.senderSeq,
      parents: [...message.parents], seen: [...message.seen],
    })),
    justifications: [...packet.selectedJustificationIds],
  };
  const exactGraphSha256 = digest(canonical(sourceGraph));
  const content = { ...packet, sourceGraph, exactGraphSha256 };
  return { ...content, packetSha256: digest(canonical(content)) };
}

export async function runPacketFromPinnedSource(sourceDir) {
  const source = resolve(sourceDir);
  const census = await runFromPinnedSource(source); // verifies exact Git SHA
  const packet = makePacket(census);
  if (packet.selection !== "MODEL_CANDIDATE_READY_FOR_INDEPENDENT_RUST_REPLAY")
    return packet;
  const path = pathToFileURL(join(source, "src/lib/cbc/casper-concrete-dag.ts"));
  // Use an explicit pinned source module, never any fixture copied into the orchestrator.
  const { buildCausallyValidDAG, buildDuplicateMinimumMessageDAG } = await import(path.href);
  const { analyzeUpstreamReachability } = await import(pathToFileURL(
    join(source, "src/lib/cbc/casper-upstream-reachability.ts")).href);
  const selectedFixture = packet.sourceDAGFamily === "causally-valid-control"
    ? buildCausallyValidDAG() : buildDuplicateMinimumMessageDAG();
  assert.equal(selectedFixture.messages.length, packet.sourceDAGMessageCount);
  return bindSourceGraph(packet, selectedFixture, analyzeUpstreamReachability);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  try {
    const s = process.argv.indexOf("--source-dir");
    const o = process.argv.indexOf("--output");
    if (s < 0 || o < 0 || !process.argv[s + 1] || !process.argv[o + 1])
      throw new Error("Usage: --source-dir PINNED_RESEARCH --output PACKET.json");
    const packet = await runPacketFromPinnedSource(resolve(process.argv[s + 1]));
    const path = resolve(process.argv[o + 1]);
    await mkdir(resolve(path, ".."), { recursive: true });
    await writeFile(path, JSON.stringify(packet, null, 2) + "\n");
    console.log(JSON.stringify({
      selection: packet.selection, sourceDAGFamily: packet.sourceDAGFamily ?? null,
      selectedIds: packet.selectedJustificationIds ?? [],
      fullGraphSha256: packet.exactGraphSha256 ?? null,
      rustReplayVerified: false, wireIngressVerified: false,
    }));
  } catch (error) { console.error(error); process.exitCode = 1; }
}
