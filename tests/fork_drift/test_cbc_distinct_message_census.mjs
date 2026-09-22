import assert from "node:assert/strict";
import test from "node:test";
import {
  SCHEMA, canonical, digest, combinationsDistinct, census,
} from "../../tools/cbc_distinct_message_census.mjs";

test("enumerator excludes repeated message identities and produces exact 4-of-8 census", () => {
  const source = ["a2", "a3", "b2", "b3", "c2", "c3", "d2", "d3"];
  const all = combinationsDistinct(source);
  assert.equal(all.length, 70);
  assert.equal(new Set(all.map((x) => x.join(","))).size, 70);
  assert.ok(all.every((candidate) => candidate.length === 4 &&
    new Set(candidate).size === 4));
  assert.throws(() => combinationsDistinct(["a3", "a3", "b3", "c3"]), /unique/);
  assert.throws(() => combinationsDistinct(source, 9), /length/);
});

function fixture() {
  const messages = [
    { id: "a2", sender: "v0", senderSeq: 2, parents: [], seen: ["a2"] },
    { id: "a3", sender: "v0", senderSeq: 3, parents: ["a2"], seen: ["a2", "a3"] },
    { id: "b3", sender: "v1", senderSeq: 3, parents: [], seen: ["b3"] },
    { id: "c3", sender: "v2", senderSeq: 3, parents: [], seen: ["c3"] },
    { id: "d3", sender: "v3", senderSeq: 3, parents: [], seen: ["d3"] },
  ];
  return { messages, bondsMap: { v0: 70, v1: 10, v2: 10, v3: 10 },
    justifications: ["a2", "a3", "b3", "c3"] };
}
const reachability = () => ({ reachable: true, violations: [] });
const mirror = ({ justifications, messages }) => {
  const ids = new Map(messages.map((message) => [message.id, message.sender]));
  const senders = justifications.map((id) => ids.get(id));
  const distinct = [...new Set(senders)].sort();
  return {
    minimumMessageIds: justifications,
    minimumMessageSenders: senders,
    uniqueMinimumMessageSenders: distinct,
    checkMinMessagesPassed: justifications.length === 4,
    finalized: distinct.length === 4,
    supportingStake: 70,
  };
};

test("every candidate is four-distinct-ID and carries model-vs-Rust claim boundaries", () => {
  const base = fixture();
  const datasets = [
    { name: "causally-valid-control", fixture: base, pool: ["a2", "a3", "b3", "c3", "d3"] },
    { name: "distinct-v0-message-stress", fixture: base, pool: ["a2", "a3", "b3", "c3", "d3"] },
  ];
  const result = census(datasets, reachability, mirror);
  assert.equal(result.schema, SCHEMA);
  assert.equal(result.totalDistinctIdCandidates, 10);
  assert.equal(result.totalUnderCoverageCandidates, 6);
  assert.equal(result.originalM27SelectedTupleAdmittedAsFourUniqueMessages, false);
  for (const candidate of result.datasets.flatMap((dataset) => dataset.candidates)) {
    assert.equal(new Set(candidate.messageIds).size, 4);
    assert.equal(candidate.actualRustFinalizerExecutedForThisExactCandidate, false);
    assert.equal(candidate.wireIngressVerified, false);
  }
  const { recordSha256, ...body } = result;
  assert.equal(recordSha256, digest(canonical(body)));
});

test("fail closed on missing parent, non-reachable source or unknown candidate message", () => {
  const value = fixture();
  const datasets = [
    { name: "causally-valid-control", fixture: value, pool: ["a2", "a3", "b3", "c3"] },
    { name: "distinct-v0-message-stress", fixture: value, pool: ["a2", "a3", "b3", "c3"] },
  ];
  assert.throws(() => census(datasets, () => ({ reachable: false, violations: [
    { code: "DAG_CYCLE" },
  ] }), mirror), /reachability/);
  const altered = structuredClone(datasets);
  altered[0].fixture.messages[1].parents = ["no-such-message"];
  assert.throws(() => census(altered, reachability, mirror), /missing parent/);
  const unknown = structuredClone(datasets);
  unknown[1].pool = ["a2", "a3", "b3", "phantom"];
  assert.throws(() => census(unknown, reachability, mirror), /unknown IDs/);
});

test("mirror cannot refer to an absent minimum-message ID", () => {
  const value = fixture();
  const datasets = [
    { name: "causally-valid-control", fixture: value, pool: ["a2", "a3", "b3", "c3"] },
    { name: "distinct-v0-message-stress", fixture: value, pool: ["a2", "a3", "b3", "c3"] },
  ];
  assert.throws(() => census(datasets, reachability,
    (args) => ({ ...mirror(args), minimumMessageIds: ["phantom"] })), /non-source/);
});
