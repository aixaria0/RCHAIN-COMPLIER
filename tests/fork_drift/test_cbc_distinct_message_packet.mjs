import assert from "node:assert/strict";
import test from "node:test";
import { digest, canonical, SCHEMA, SOURCE_SHA, UPSTREAM_REVISION, sourceGraphBase } from "../../tools/cbc_distinct_message_census.mjs";
import { bindSourceGraph, makePacket, PACKET_SCHEMA } from "../../tools/cbc_distinct_message_packet.mjs";

const ids = ["a2", "a3", "b3", "c3"];
function census(candidateOverride = {}) {
  const candidate = {
    messageIds: ids, messageIdsUnique: true,
    justificationSenders: ["v0", "v0", "v1", "v2"],
    missingBondedMinimumSenders: ["v3"],
    traceDistinctMinimumSenders: 3,
    modelCountGatePassed: true, modelReportedFinalized: true,
    sourceDAGReachabilityChecked: true,
    actualRustFinalizerExecutedForThisExactCandidate: false,
    wireIngressVerified: false, ...candidateOverride,
  };
  const body = {
    schema: SCHEMA, producer: "aixaria0/RCHAIN-COMPLIER@" + SOURCE_SHA, researchUpstreamRevision: UPSTREAM_REVISION,
    datasets: [
      { name: "distinct-v0-message-stress", sourceMessageCount: 4, sourceGraphBaseSha256: digest(canonical(sourceGraphBase(graph()))),
        candidates: [candidate] },
      { name: "causally-valid-control", sourceMessageCount: 4, sourceGraphBaseSha256: digest(canonical(sourceGraphBase(graph()))),
        candidates: [] },
    ],
  };
  return { ...body, recordSha256: digest(canonical(body)) };
}
function graph() {
  return {
    bondsMap: { v0: 70, v1: 10, v2: 10, v3: 10 },
    messages: [
      { id: "a2", sender: "v0", senderSeq: 2, parents: [], seen: ["a2"] },
      { id: "a3", sender: "v0", senderSeq: 3, parents: ["a2"], seen: ["a2", "a3"] },
      { id: "b3", sender: "v1", senderSeq: 3, parents: [], seen: ["b3"] },
      { id: "c3", sender: "v2", senderSeq: 3, parents: [], seen: ["c3"] },
    ],
  };
}
const reachable = () => ({ reachable: true, violations: [] });

test("export full original graph, distinct IDs, source-pinned packet and honest evidence flags", () => {
  const packet = makePacket(census());
  assert.equal(packet.schema, PACKET_SCHEMA);
  assert.equal(packet.sourceCommit, SOURCE_SHA);
  assert.equal(packet.rustReplayVerified, false);
  const bound = bindSourceGraph(packet, graph(), reachable);
  assert.deepEqual(bound.sourceGraph.justifications, ids);
  assert.equal(new Set(bound.sourceGraph.justifications).size, 4);
  assert.equal(bound.sourceGraph.messages.length, 4);
  assert.equal(bound.exactGraphSha256, digest(canonical(bound.sourceGraph)));
  const { packetSha256, ...body } = bound;
  assert.equal(packetSha256, digest(canonical(body)));
  assert.equal(bound.wireIngressVerified, false);
});

test("missing eligible modeled candidate is reported, never invented", () => {
  const none = makePacket(census({ modelReportedFinalized: false }));
  assert.equal(none.selection, "NO_ELIGIBLE_SOURCE_MODEL_CANDIDATE");
  assert.equal(none.rustReplayVerified, false);
});

test("re-sealed duplicate identity, tampered census and wrong source mapping fail closed", () => {
  const bad = census({ messageIds: ["a2", "a2", "b3", "c3"] });
  assert.throws(() => makePacket(bad), /candidate|Selected witness/);
  const mutated = census();
  mutated.datasets[0].candidates[0].modelReportedFinalized = false;
  assert.throws(() => makePacket(mutated), /digest mismatch/);
  const packet = makePacket(census());
  const wrong = graph();
  wrong.messages[1].sender = "v3";
  assert.throws(() => bindSourceGraph(packet, wrong, reachable), /ID\/sender/);
});

test("full source graph fails closed on false causality or duplicate graph ID", () => {
  const packet = makePacket(census());
  assert.throws(() => bindSourceGraph(packet, graph(),
    () => ({ reachable: false, violations: [{ code: "DAG_CYCLE" }] })), /reachability/);
  const bad = graph();
  bad.messages[1].id = "a2";
  assert.throws(() => bindSourceGraph(packet, bad, reachable), /duplicate/);
});
