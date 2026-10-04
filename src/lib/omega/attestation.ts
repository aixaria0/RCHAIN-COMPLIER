import { createPublicKey, sign, verify, type KeyObject } from "node:crypto";
import { canonical, type Identity } from "../lattice/protocol.ts";
import type {
  OmegaProof,
  OmegaProofPayload,
  OmegaProofReport,
  OmegaStatus,
  OmegaTrust,
} from "./types.ts";

const SPKI = Buffer.from("302a300506032b6570032100", "hex");

function report(
  status: OmegaProofReport["status"],
  code: OmegaProofReport["code"],
  reason: string,
  proof?: OmegaProof,
): OmegaProofReport {
  return {
    schema: "omega-proof-report/v1",
    status,
    code,
    reason,
    nodeId: proof?.payload.nodeId ?? null,
    bootId: proof?.payload.bootId ?? null,
    eventRoot: proof?.payload.eventRoot ?? null,
  };
}

function publicKey(rawHex: string): KeyObject {
  if (!/^[0-9a-f]{64}$/.test(rawHex)) throw new Error("invalid Ed25519 public key");
  return createPublicKey({
    key: Buffer.concat([SPKI, Buffer.from(rawHex, "hex")]),
    format: "der",
    type: "spki",
  });
}

export function createOmegaProof(
  status: OmegaStatus,
  identity: Identity,
  ttlMs = 30_000,
): OmegaProof {
  if (!Number.isSafeInteger(ttlMs) || ttlMs < 1_000 || ttlMs > 300_000)
    throw new Error("Omega proof TTL must be between 1 and 300 seconds");
  if (!status.eventRoot) throw new Error("Omega proof requires an event root");
  const issued = Date.now();
  const payload: OmegaProofPayload = {
    schema: "omega-proof-payload/v1",
    nodeId: status.nodeId,
    bootId: status.bootId,
    issuedAt: new Date(issued).toISOString(),
    expiresAt: new Date(issued + ttlMs).toISOString(),
    policyDigest: status.policyDigest,
    ownerActorId: identity.actorId,
    ownerPublicKeyHex: identity.publicKeyHex,
    eventRoot: status.eventRoot,
    status,
  };
  const signatureHex = sign(null, Buffer.from(canonical(payload)), identity.privateKey).toString("hex");
  return { schema: "omega-proof/v1", payload, signatureHex };
}

export function verifyOmegaProof(
  proof: OmegaProof,
  trust: OmegaTrust,
  now = Date.now(),
): OmegaProofReport {
  try {
    if (proof.schema !== "omega-proof/v1" || proof.payload.schema !== "omega-proof-payload/v1")
      return report("FAIL", "INVALID_PROOF", "Unsupported Omega proof schema", proof);
    if (!/^[0-9a-f]{128}$/.test(proof.signatureHex))
      return report("FAIL", "INVALID_PROOF", "Malformed Ed25519 signature", proof);
    if (
      proof.payload.nodeId !== trust.expectedNodeId ||
      proof.payload.policyDigest !== trust.expectedPolicyDigest ||
      proof.payload.ownerActorId !== trust.expectedOwnerActorId ||
      proof.payload.ownerPublicKeyHex !== trust.expectedOwnerPublicKeyHex
    )
      return report("FAIL", "TRUST_MISMATCH", "Proof differs from independently retained trust pins", proof);
    if (
      proof.payload.status.nodeId !== proof.payload.nodeId ||
      proof.payload.status.bootId !== proof.payload.bootId ||
      proof.payload.status.policyDigest !== proof.payload.policyDigest ||
      proof.payload.status.eventRoot !== proof.payload.eventRoot
    )
      return report("FAIL", "INVALID_PROOF", "Signed status is not bound to the proof envelope", proof);
    const issued = Date.parse(proof.payload.issuedAt);
    const expires = Date.parse(proof.payload.expiresAt);
    if (!Number.isFinite(issued) || !Number.isFinite(expires) || expires <= issued || expires - issued > 300_000)
      return report("FAIL", "INVALID_PROOF", "Invalid proof lifetime", proof);
    if (now < issued - 5_000 || now > expires)
      return report("FAIL", "EXPIRED", "Omega liveness proof is outside its validity window", proof);
    const valid = verify(
      null,
      Buffer.from(canonical(proof.payload)),
      publicKey(proof.payload.ownerPublicKeyHex),
      Buffer.from(proof.signatureHex, "hex"),
    );
    if (!valid) return report("FAIL", "INVALID_PROOF", "Omega proof signature is invalid", proof);
    if (
      proof.payload.status.state !== "ONLINE" ||
      proof.payload.status.processes.alive !== 3 ||
      proof.payload.status.processes.unique !== 3 ||
      proof.payload.status.workers.verified !== 2 ||
      proof.payload.status.identity !== "PASS" ||
      proof.payload.status.replay !== "PASS" ||
      proof.payload.status.registry !== "PASS" ||
      proof.payload.status.equivocations !== 0
    )
      return report("FAIL", "NODE_NOT_ONLINE", "Signed status does not satisfy Omega ONLINE invariants", proof);
    return report("PASS", "VERIFIED", "Fresh signed Omega liveness proof verified against trust pins", proof);
  } catch (cause) {
    return report(
      "FAIL",
      "INVALID_PROOF",
      cause instanceof Error ? cause.message : "Invalid Omega proof",
      proof,
    );
  }
}
