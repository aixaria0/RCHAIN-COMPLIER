#!/usr/bin/env node
/** Independently validate a distinct-ID replay INPUT against its original census.
 *
 * This verifier checks provenance/integrity and local DAG representability,
 * not Rust Finalizer behavior, RNode ingress, or consensus finality.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { SCHEMA as CENSUS_SCHEMA, canonical, digest, SOURCE_SHA } from "./cbc_distinct_message_census.mjs";
import { PACKET_SCHEMA } from "./cbc_distinct_message_packet.mjs";

const identity = (m) => m.id;
export function verifyPacket(census, packet) {
  if (census?.schema !== CENSUS_SCHEMA || packet?.schema !== PACKET_SCHEMA)
    throw new Error("Unsupported input schema");
  const { recordSha256: censusSeal, ...censusBody } = census;
  assert.equal(censusSeal, digest(canonical(censusBody)), "Census content mismatch");
  const { packetSha256, ...packetBody } = packet;
  assert.equal(packetSha256, digest(canonical(packetBody)), "Replay packet content mismatch");
  assert.equal(packet.sourceCommit, SOURCE_SHA);
  assert.equal(packet.censusSha256, censusSeal);
  assert.equal(packet.selection, "MODEL_CANDIDATE_READY_FOR_INDEPENDENT_RUST_REPLAY");
  assert.equal(packet.sourceModelFinalized, true);
  assert.equal(packet.rustReplayVerified, false);
  assert.equal(packet.wireIngressVerified, false);
  const graph = packet.sourceGraph;
  assert.ok(graph && Array.isArray(graph.messages) && graph.messages.length > 0);
  assert.equal(packet.sourceDAGMessageCount, graph.messages.length);
  assert.equal(packet.exactGraphSha256, digest(canonical(graph)), "Exact source graph digest mismatch");
  assert.deepEqual(graph.justifications, packet.selectedJustificationIds);
  assert.equal(graph.justifications.length, 4);
  assert.equal(new Set(graph.justifications).size, 4, "Repeated message ID is not replayable");
  const byId = new Map(graph.messages.map((m) => [identity(m), m]));
  assert.equal(byId.size, graph.messages.length, "Duplicate message identity in source DAG");
  const bonded = ["v0", "v1", "v2", "v3"];
  assert.deepEqual(Object.keys(graph.bondsMap).sort(), bonded);
  assert.ok(bonded.every((s) => Number.isSafeInteger(graph.bondsMap[s]) && graph.bondsMap[s] > 0));
  const states = new Map();
  function visit(id) {
    const value = states.get(id) ?? 0;
    if (value === 1) throw new Error("DAG cycle");
    if (value === 2) return;
    const m = byId.get(id);
    if (!m) throw new Error("DAG references missing parent " + id);
    if (!bonded.includes(m.sender) || !Number.isSafeInteger(m.senderSeq) || m.senderSeq < 0)
      throw new Error("Invalid validator or sequence");
    if (!Array.isArray(m.parents) || !Array.isArray(m.seen))
      throw new Error("Invalid message parent or seen list");
    states.set(id, 1);
    const actualSeen = new Set([id]);
    let latestSelfSeq = -1;
    for (const parent of m.parents) {
      visit(parent);
      const p = byId.get(parent);
      for (const seenId of p.seen) actualSeen.add(seenId);
      if (p.sender === m.sender) latestSelfSeq = Math.max(latestSelfSeq, p.senderSeq);
    }
    if (m.senderSeq !== latestSelfSeq + 1)
      throw new Error("Sender sequence inconsistent with parent graph");
    if (new Set(m.seen).size !== m.seen.length ||
        actualSeen.size !== m.seen.length ||
        m.seen.some((seenId) => !actualSeen.has(seenId)))
      throw new Error("Seen set not derived from parents");
    states.set(id, 2);
  }
  for (const id of byId.keys()) visit(id);
  assert.equal(packet.selectedJustificationSenders.length, 4);
  assert.equal(new Set(packet.selectedJustificationSenders).size, 3);
  for (let i = 0; i < 4; i++)
    assert.equal(byId.get(graph.justifications[i])?.sender,
      packet.selectedJustificationSenders[i], "Source message/sender mismatch");
  const matchingDataset = census.datasets.find((x) => x.name === packet.sourceDAGFamily);
  assert.ok(matchingDataset, "Selected DAG family not in source census");
  const matching = matchingDataset.candidates.find((candidate) =>
    canonical(candidate.messageIds) === canonical(graph.justifications));
  assert.ok(matching, "Selected candidate not present in source census");
  assert.deepEqual(matching.justificationSenders, packet.selectedJustificationSenders);
  assert.equal(matching.modelReportedFinalized, true);
  assert.equal(matching.sourceDAGReachabilityChecked, true);
  assert.equal(matching.actualRustFinalizerExecutedForThisExactCandidate, false);
  assert.equal(matching.wireIngressVerified, false);
  return {
    schema: "aria-cbc-distinct-id-packet-verification/v1",
    sourceCommit: SOURCE_SHA,
    censusSha256: censusSeal,
    packetSha256,
    exactSourceGraphSha256: packet.exactGraphSha256,
    checkedMessageCount: byId.size,
    checkedJustificationCount: 4,
    distinctJustificationIds: 4,
    authenticatedProducer: false,
    rustFinalizerReplayed: false,
    wireIngressVerified: false,
    verdict: "SOURCE_GRAPH_AND_TRANSPORT_REPRESENTABLE_ONLY",
  };
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  try {
    const args = process.argv;
    const i = args.indexOf("--census"), j = args.indexOf("--packet");
    if (i < 0 || j < 0 || !args[i + 1] || !args[j + 1])
      throw new Error("Usage: --census REPORT.json --packet INPUT.json");
    const census = JSON.parse(await readFile(resolve(args[i + 1]), "utf8"));
    const packet = JSON.parse(await readFile(resolve(args[j + 1]), "utf8"));
    console.log(JSON.stringify(verifyPacket(census, packet)));
  } catch (error) { console.error(error); process.exitCode = 1; }
}
