import { writeFileSync } from "node:fs";
import { assuranceDigest, rawAssuranceDigest, assurancePayloadDigest, assuranceReproductionDigest } from "../src/lib/assurance/rchain-assurance-validation.ts";
export const NOW = 1792080000000;
export const DEPLOY = "ab".repeat(70);
export const RECIPIENT = "1111syntheticRecipient";
export const TERM = `new revVault(\`rho:rchain:revVault\`), deployerId(\`rho:rchain:deployerId\`), deployId(\`rho:rchain:deployId\`), resultCh in {\n    revVault!("transfer", *deployerId, "${RECIPIENT}", 100, *resultCh) |\n    for (@result <- resultCh) { deployId!(result) }\n  }`;
export function balanceTerm(address) { return `new return, revVault(\`rho:rchain:revVault\`), balanceCh in { revVault!("getBalance", "${address}", *balanceCh) | for (@balance <- balanceCh) { return!(balance) } }`; }
export function block(hash = "aa".repeat(32), height = 10) { return { blockHash: hash, blockNumber: height, shardId: "root", sender: "synthetic-validator", seqNum: height, preStateHash: "pre", postStateHash: "post", justifications: [], bonds: [{ validator: "synthetic-validator", stake: 100 }], sigAlgorithm: "secp256k1", sig: "synthetic-block-signature", parents: [] }; }
export async function raw(path, value, request) { const body = JSON.stringify(value); return { path, ...(request ? { request } : {}), body, digest: await rawAssuranceDigest(body), observed_at: NOW }; }
export async function seal(pkg) {
  for (const observer of pkg.observers) { const { observation_digest: _d, ...data } = observer; observer.observation_digest = await assuranceDigest(data); }
  pkg.reproduction_digest = await assuranceReproductionDigest(pkg);
  pkg.provenance.payload_digest = await assurancePayloadDigest(pkg);
  return pkg;
}
export async function fixture(kind = "pass") {
  const b = block();
  const observers = await Promise.all(["one", "two"].map(async (id) => {
    const evidence = {
      status: await raw("/api/status", { networkId: "synthetic-testnet", shardId: "root", node: { id } }),
      deploy: await raw(`/api/v1/deploy-status/${DEPLOY}`, { ProcessedWithSuccess: { deployResult: [{ ExprTuple: { ps: [{ ExprBool: { data: true } }, { ExprString: { data: "transfer-result" } }] } }], block: b } }),
      block: await raw(`/api/block/${b.blockHash}`, { blockInfo: b, deploys: [{ sig: DEPLOY, deployer: "synthetic-signer", term: TERM, errored: false }] }),
      finalized: await raw("/api/last-finalized-block", { blockInfo: b }),
      finalized_block: await raw(`/api/block/${b.blockHash}`, { blockInfo: b, deploys: [{ sig: DEPLOY, deployer: "synthetic-signer", term: TERM, errored: false }] }),
      is_finalized: await raw(`/api/is-finalized/${b.blockHash}`, { finalized: true }),
      balance: await raw("/api/explore-deploy", { expr: [{ ExprInt: { data: 1100 } }], block: b }, balanceTerm(RECIPIENT)), ancestry: [],
    };
    return { observer_id: `synthetic-${id}`, node_identity: id, source: `https://synthetic-${id}.invalid`, failure_domain: `fixture-${id}`, observed_at: NOW, finalized_height: 10, finalized_hash: b.blockHash, observation_digest: "0".repeat(64), status: "OBSERVED", reason: null, evidence };
  }));
  const pkg = { version: "rchain-assurance/v1", subject: { action_type: "REV_TRANSFER", action_id: DEPLOY, deploy_id: DEPLOY }, network: { network_id: "synthetic-testnet", shard_id: "root" }, submission: { status: "OBSERVED", signer: "synthetic-signer" }, execution: { status: "OBSERVED", observed_at: NOW, block_hash: b.blockHash, block_height: 10 }, inclusion: { status: "OBSERVED", observed_at: NOW, block_hash: b.blockHash, block_height: 10 }, finalized_state: { status: "OBSERVED", observed_at: NOW, finalized_block_hash: b.blockHash, finalized_block_height: 10 }, observers, agreement: { status: "EXACT_AGREEMENT" }, claim: { claim_id: `rev-transfer:${DEPLOY}`, claim_type: "REV_TRANSFER_FINALIZED" }, verification: Object.fromEntries(["payload_integrity", "network_identity", "canonical_consistency", "cross_node_agreement", "finalized_state_observation", "deterministic_reproduction"].map(k => [k, "UNKNOWN"])), reproduction_digest: "0".repeat(64), provenance: { producer: "rchain-sentinel", source_revision: "synthetic-fixture-v1", payload_digest: "0".repeat(64), generated_at: NOW } };
  if (kind === "blocked") { pkg.finalized_state = { status: "UNAVAILABLE", reason: "Awaiting finalized-state read-back" }; for (const o of observers) o.evidence.balance = null; }
  if (kind === "conflict") { const other = block("bb".repeat(32)); const o = observers[1]; o.finalized_hash = other.blockHash; o.evidence.finalized = await raw("/api/last-finalized-block", { blockInfo: other }); o.evidence.finalized_block = await raw(`/api/block/${other.blockHash}`, { blockInfo: other, deploys: [] }); pkg.agreement.status = "CONFLICT"; pkg.finalized_state = { status: "CONFLICT", reason: "Same-height different finalized hashes" }; }
  return seal(pkg);
}
export function fixturePolicy(pkg) { return { verifier: "rchain-rev-transfer-assurance/v1", action_id: DEPLOY, deploy_id: DEPLOY, claim_id: `rev-transfer:${DEPLOY}`, network_id: "synthetic-testnet", shard_id: "root", signer: "synthetic-signer", term: TERM, recipient: RECIPIENT, amount_drops: 100, recipient_balance_before: 1000, now_ms: NOW + 1000, max_age_ms: 60000, max_future_skew_ms: 1000, min_observers: 2, min_failure_domains: 2, observers: pkg.observers.map(o => ({ observer_id: o.observer_id, source: o.source, node_identity: o.node_identity, failure_domain: o.failure_domain })), producer: "rchain-sentinel", source_revision: "synthetic-fixture-v1", expected_payload_digest: pkg.provenance.payload_digest }; }
if (process.argv.includes("--write")) for (const kind of ["pass", "blocked", "conflict"]) writeFileSync(`contracts/rchain-assurance/examples/${kind}.json`, JSON.stringify(await fixture(kind), null, 2) + "\n");
