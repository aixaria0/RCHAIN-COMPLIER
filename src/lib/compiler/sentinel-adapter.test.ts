import assert from "node:assert/strict";
import test from "node:test";
import {
  SENTINEL_ENDPOINTS,
  fetchSentinelBundle,
  sentinelBundleToRecord,
  type SentinelFinalizedBlockEvidence,
  type SentinelNetworkStatus,
} from "./sentinel-adapter.ts";
import { verifyRealityRecordIntegrity } from "./reality-record.ts";

const evidence: SentinelFinalizedBlockEvidence = {
  available: true,
  raw: { blockHash: "abc123", height: 18492 },
  payload_sha256: "deadbeef",
  block_hash: "abc123",
  parent_hash: "parent123",
  proposer: "val_0a17",
  signature: "sig",
  justification_present: true,
  full_block_available: true,
  full_block: { blockHash: "abc123", height: 18492 },
  full_block_hash: "abc123",
  node_reported_finalized: true,
  finality_hash_match: true,
  canonical_consistency: true,
  canonical_mismatches: [],
  finality_error: null,
  error: null,
};

const network: SentinelNetworkStatus = {
  reachable: true,
  node_url: "http://localhost:40403",
  latency_ms: 7,
  http_status: 200,
  probe: "status",
  error: null,
  rnode: {
    node: { id: "node-a", host: "localhost", port: 40403 },
    network_id: "local",
    shard_id: "root",
    latest_block_number: 18494,
    last_finalized_block_number: 18492,
    validator: true,
    ready: true,
    current_epoch: 42,
  },
};

test("maps a real Sentinel evidence shape into a portable Reality Record", () => {
  const record = sentinelBundleToRecord({
    sentinelBaseUrl: "http://localhost:8080",
    collectedAt: "2026-09-17T20:30:00Z",
    evidence,
    network,
  });

  assert.equal(record.source, "rchain-sentinel");
  assert.equal(record.subject.id, "abc123");
  assert.equal(record.observations.length, 2);
  assert.equal(record.claims.length, 2);
  assert.equal(record.verification.length, 3);
  assert.equal(record.replay.available, false);
  assert.equal(record.state, "INCOMPLETE");
  assert.equal(verifyRealityRecordIntegrity(record), true);
  assert.ok(record.dependencies.some((dependency) => dependency.relation === "contextualizes"));
});

test("canonical mismatch becomes a divergent verification state", () => {
  const record = sentinelBundleToRecord({
    sentinelBaseUrl: "http://localhost:8080",
    collectedAt: "2026-09-17T20:30:00Z",
    evidence: {
      ...evidence,
      canonical_consistency: false,
      canonical_mismatches: ["proposer", "parent_hash"],
    },
  });

  assert.equal(record.state, "DIVERGENT");
  assert.equal(
    record.verification.find((check) => check.id === "verify_sentinel_canonical_consistency")?.state,
    "DIVERGENT",
  );
  assert.equal(verifyRealityRecordIntegrity(record), true);
});

test("fetches the documented Sentinel endpoints without requiring a live Sentinel", async () => {
  const requested: string[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    requested.push(url);
    return new Response(
      JSON.stringify(url.endsWith(SENTINEL_ENDPOINTS.networkStatus) ? network : evidence),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  const bundle = await fetchSentinelBundle("http://sentinel.example/", {
    fetchImpl,
    collectedAt: "2026-09-17T20:31:00Z",
    includeNetworkStatus: true,
  });

  assert.deepEqual(requested, [
    `http://sentinel.example${SENTINEL_ENDPOINTS.finalizedBlockEvidence}`,
    `http://sentinel.example${SENTINEL_ENDPOINTS.networkStatus}`,
  ]);
  assert.equal(bundle.evidence.block_hash, "abc123");
  assert.equal(bundle.network?.rnode?.last_finalized_block_number, 18492);
});
