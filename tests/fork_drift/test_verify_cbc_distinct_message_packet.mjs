import assert from "node:assert/strict";
import test from "node:test";
import { SCHEMA, canonical, digest, SOURCE_SHA, UPSTREAM_REVISION, sourceGraphBase } from "../../tools/cbc_distinct_message_census.mjs";
import { makePacket, bindSourceGraph } from "../../tools/cbc_distinct_message_packet.mjs";
import { verifyPacket } from "../../tools/verify_cbc_distinct_message_packet.mjs";

const ids=["a2","a3","b3","c3"];
function originalGraph(){
  return {bondsMap:{v0:70,v1:10,v2:10,v3:10},messages:[
    {id:"g0",sender:"v0",senderSeq:0,parents:[],seen:["g0"]},
    {id:"g1",sender:"v1",senderSeq:0,parents:[],seen:["g1"]},
    {id:"g2",sender:"v2",senderSeq:0,parents:[],seen:["g2"]},
    {id:"a2",sender:"v0",senderSeq:1,parents:["g0"],seen:["g0","a2"]},
    {id:"a3",sender:"v0",senderSeq:2,parents:["a2"],seen:["g0","a2","a3"]},
    {id:"b3",sender:"v1",senderSeq:1,parents:["g1"],seen:["g1","b3"]},
    {id:"c3",sender:"v2",senderSeq:1,parents:["g2"],seen:["g2","c3"]},
  ]};
}
function inputs(){
  const graph=originalGraph();
  const candidate={
    messageIds:ids,messageIdsUnique:true,
    justificationSenders:["v0","v0","v1","v2"],
    missingBondedMinimumSenders:["v3"],traceDistinctMinimumSenders:3,
    modelCountGatePassed:true,modelReportedFinalized:true,
    sourceDAGReachabilityChecked:true,actualRustFinalizerExecutedForThisExactCandidate:false,
    wireIngressVerified:false,
  };
  const body={schema:SCHEMA,producer:"aixaria0/RCHAIN-COMPLIER@"+SOURCE_SHA,researchUpstreamRevision:UPSTREAM_REVISION,datasets:[
    {name:"distinct-v0-message-stress",sourceMessageCount:graph.messages.length,sourceGraphBaseSha256:digest(canonical(sourceGraphBase(graph))),candidates:[candidate]},
    {name:"causally-valid-control",sourceMessageCount:graph.messages.length,sourceGraphBaseSha256:digest(canonical(sourceGraphBase(graph))),candidates:[]},
  ]};
  const census={...body,recordSha256:digest(canonical(body))};
  const packet=bindSourceGraph(makePacket(census),graph,
    ()=>({reachable:true,violations:[]}));
  return {census,packet};
}
function reseal(packet){
  const {packetSha256:_old,...body}=packet;
  return {...body,packetSha256:digest(canonical(body))};
}

test("independent verifier accepts four unique ID and exact parent-derived source graph only",()=>{
  const {census,packet}=inputs();
  const receipt=verifyPacket(census,packet);
  assert.equal(receipt.distinctJustificationIds,4);
  assert.equal(receipt.checkedMessageCount,7);
  assert.equal(receipt.authenticatedProducer,false);
  assert.equal(receipt.rustFinalizerReplayed,false);
  assert.equal(receipt.verdict,"SOURCE_GRAPH_AND_TRANSPORT_REPRESENTABLE_ONLY");
});

test("changed or resealed unsupported DAG is rejected",()=>{
  const {census,packet}=inputs();
  packet.sourceGraph.messages.find(x=>x.id==="a3").seen=["a3"];
  assert.throws(()=>verifyPacket(census,packet),/packet content mismatch/);
  packet.exactGraphSha256=digest(canonical(packet.sourceGraph));
  const resealed=reseal(packet);
  assert.throws(()=>verifyPacket(census,resealed),/Seen set/);
});

test("repeated justification ID cannot be laundered by a new hash",()=>{
  const {census,packet}=inputs();
  packet.selectedJustificationIds=["a2","a2","b3","c3"];
  packet.sourceGraph.justifications=[...packet.selectedJustificationIds];
  packet.exactGraphSha256=digest(canonical(packet.sourceGraph));
  assert.throws(()=>verifyPacket(census,reseal(packet)),/Repeated message ID/);
});

test("missing parent and altered sequence fail even if content hashes are updated",()=>{
  const {census,packet}=inputs();
  packet.sourceGraph.messages.find(x=>x.id==="a3").parents=["phantom"];
  packet.exactGraphSha256=digest(canonical(packet.sourceGraph));
  assert.throws(()=>verifyPacket(census,reseal(packet)),/missing parent/);
  const p=inputs();
  p.packet.sourceGraph.messages.find(x=>x.id==="a3").senderSeq=7;
  p.packet.exactGraphSha256=digest(canonical(p.packet.sourceGraph));
  assert.throws(()=>verifyPacket(p.census,reseal(p.packet)),/sequence/);
});

test("counterfeit source-model pass flags and wrong census link are rejected",()=>{
  const {census,packet}=inputs();
  packet.rustReplayVerified=true;
  assert.throws(()=>verifyPacket(census,reseal(packet)),/false/);
  const p=inputs();
  p.packet.censusSha256="f".repeat(64);
  assert.throws(()=>verifyPacket(p.census,reseal(p.packet)),/Expected values to be strictly equal/);
});

function resealGraph(packet) {
  packet.exactGraphSha256 = digest(canonical(packet.sourceGraph));
  return reseal(packet);
}
test("resealed changed stake or removed unselected source message cannot substitute the source graph", () => {
  const a = inputs();
  a.packet.sourceGraph.bondsMap.v0 = 71;
  assert.throws(() => verifyPacket(a.census, resealGraph(a.packet)), /differs from census fixture/);
  const b = inputs();
  b.packet.sourceGraph.messages.push({id:"extra",sender:"v3",senderSeq:0,parents:[],seen:["extra"]});
  b.packet.sourceDAGMessageCount++;
  assert.throws(() => verifyPacket(b.census, resealGraph(b.packet)), /differs from census fixture/);
});
test("wrong source SHA, sender mapping, missing coverage and elevated extra claims fail closed", () => {
  for (const mutate of [
    p => { p.sourceCommit = "f".repeat(40); },
    p => { p.selectedJustificationSenders[0] = "v3"; },
    p => { p.missingBondedMinimumSenders = []; },
    p => { p.producerAuthenticated = true; },
    p => { p.liveNetwork = true; },
    p => { p.exactGraphSha256 = "f".repeat(64); },
  ]) {
    const {census,packet} = inputs(); mutate(packet);
    assert.throws(() => verifyPacket(census, reseal(packet)));
  }
});
test("wrong census source SHA cannot be repaired with a new digest", () => {
  const {census} = inputs();
  census.producer = "aixaria0/RCHAIN-COMPLIER@" + "f".repeat(40);
  const {recordSha256: old, ...body} = census;
  census.recordSha256 = digest(canonical(body));
  assert.throws(() => makePacket(census), /Wrong census source SHA/);
});
test("deterministic selection ignores dataset and candidate arrival order", () => {
  const {census} = inputs();
  const second = structuredClone(census.datasets[0].candidates[0]);
  second.messageIds = ["a2","a3","b3","z3"];
  census.datasets[0].candidates.unshift(second);
  const seal = value => { const {recordSha256: old,...body}=value; return {...body,recordSha256:digest(canonical(body))}; };
  const expected = makePacket(seal(census));
  census.datasets.reverse();
  census.datasets[1].candidates.reverse();
  const actual = makePacket(seal(census));
  assert.deepEqual(actual.selectedJustificationIds, expected.selectedJustificationIds);
  assert.deepEqual(actual.selectedJustificationIds, ids);
});
