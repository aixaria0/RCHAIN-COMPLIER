/** Signatures establish attributable integrity, never truth. */
import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign,
  verify,
  type KeyObject,
} from "node:crypto";
import { sha256Artifact } from "../compiler/ecosystem-chain.ts";
import { canonical, artifactDigest } from "./canonical.ts";
export { canonical, parseCanonical, artifactDigest, MAX_EVENT_BYTES } from "./canonical.ts";
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export const EVENT_SCHEMA = "intelligence-lattice-event/v1";
export const MAX_BATCH_EVENTS = 32;
export const EVENT_KINDS = [
  "capability",
  "task",
  "claim",
  "evidence",
  "challenge",
  "evidence_request",
  "verification_request",
  "verification",
  "decision",
] as const;
export type EventKind = (typeof EVENT_KINDS)[number];
export type Verdict = "SUPPORTED" | "REFUTED" | "INCONCLUSIVE";
export interface DecisionResult {
  accepted: string[];
  rejected: string[];
  unresolved: string[];
}
export interface TaskEnvelope {
  schema: "intelligence-lattice-task/v1";
  taskId: string;
  domain: string;
  operation: string;
  input: { digest: string; mediaType: "application/json"; content: Json };
  dependencies: string[];
  authority: { mode: "observe-only"; issuer: string };
  output: { mediaType: "application/json"; claimPredicate: string };
}
export type EventBody =
  | { kind: "capability"; operations: string[]; implementation: string }
  | { kind: "task"; envelope: TaskEnvelope }
  | {
      kind: "claim";
      subject: string;
      predicate: string;
      value: Json;
      domain: string;
      method: string;
      assumptions: string[];
      confidence: { ppm: number | null; basis: string };
      falsifier: string;
    }
  | {
      kind: "evidence";
      claimId: string;
      relation: "supports" | "contradicts";
      artifact: { digest: string; mediaType: "application/json"; content: Json };
      method: string;
    }
  | { kind: "challenge"; claimId: string; reason: string }
  | { kind: "evidence_request"; claimId: string; question: string }
  | { kind: "verification_request"; claimId: string; evidenceIds: string[]; verifier: string }
  | {
      kind: "verification";
      requestId: string;
      claimId: string;
      evidenceIds: string[];
      verifier: string;
      verdict: Verdict;
      artifact: Json;
    }
  | {
      kind: "decision";
      procedure: "evidence-cut/v1";
      claimIds: string[];
      verificationIds: string[];
      result: DecisionResult;
    };
export interface UnsignedEvent {
  schema: typeof EVENT_SCHEMA;
  latticeId: string;
  policyDigest: string;
  actorId: string;
  publicKeyHex: string;
  sequence: number;
  issuedAt: string;
  parents: string[];
  body: EventBody;
}
export interface LatticeEvent extends UnsignedEvent {
  id: string;
  signatureHex: string;
}
export interface Identity {
  actorId: string;
  publicKeyHex: string;
  privateKey: KeyObject;
}
export interface MembershipPolicy {
  schema: "intelligence-lattice-policy/v1";
  latticeId: string;
  members: { actorId: string; publicKeyHex: string; kinds: EventKind[]; domains: string[] }[];
}
const SPKI = Buffer.from("302a300506032b6570032100", "hex");
export function exact(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("object required");
  if (Object.keys(value).sort().join("|") !== keys.slice().sort().join("|"))
    throw new Error("unexpected or missing fields");
  return value as Record<string, unknown>;
}
function text(value: unknown, max = 256): asserts value is string {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw new Error("bounded text required");
}
function hash(value: unknown): asserts value is string {
  if (typeof value !== "string" || !/^sha256:[0-9a-f]{64}$/.test(value))
    throw new Error("invalid hash");
}
function strings(value: unknown, max = 16, hashes = false): asserts value is string[] {
  if (!Array.isArray(value) || value.length > max) throw new Error("array limit");
  for (const v of value) {
    if (hashes) hash(v);
    else text(v);
  }
  if (new Set(value).size !== value.length) throw new Error("duplicate array entry");
}
export function actorId(key: string): string {
  if (!/^[0-9a-f]{64}$/.test(key)) throw new Error("invalid Ed25519 key");
  return sha256Artifact(
    Buffer.concat([Buffer.from("intelligence-lattice-actor/v1\0"), Buffer.from(key, "hex")]),
  );
}
export function identityFromKey(privateKey: KeyObject): Identity {
  if (privateKey.type !== "private" || privateKey.asymmetricKeyType !== "ed25519")
    throw new Error("Ed25519 private key required");
  const der = createPublicKey(privateKey).export({ format: "der", type: "spki" }) as Buffer;
  if (der.length !== 44 || !der.subarray(0, 12).equals(SPKI))
    throw new Error("unexpected key encoding");
  const publicKeyHex = der.subarray(12).toString("hex");
  return { actorId: actorId(publicKeyHex), publicKeyHex, privateKey };
}
export function generateIdentity(): Identity {
  return identityFromKey(generateKeyPairSync("ed25519").privateKey);
}
export function loadIdentity(pem: string): Identity {
  return identityFromKey(createPrivateKey(pem));
}
export function policyDigest(policy: MembershipPolicy): string {
  canonical(policy);
  exact(policy, ["schema", "latticeId", "members"]);
  if (policy.schema !== "intelligence-lattice-policy/v1") throw new Error("unsupported policy");
  text(policy.latticeId, 128);
  if (!Array.isArray(policy.members) || !policy.members.length || policy.members.length > 16)
    throw new Error("member limit");
  const seen = new Set<string>();
  for (const m of policy.members) {
    exact(m, ["actorId", "publicKeyHex", "kinds", "domains"]);
    if (actorId(m.publicKeyHex) !== m.actorId || seen.has(m.actorId))
      throw new Error("invalid or duplicate member");
    strings(m.kinds, 8);
    if (!m.kinds.every((k) => EVENT_KINDS.includes(k))) throw new Error("unknown permitted kind");
    strings(m.domains);
    if (!m.domains.length) throw new Error("domain required");
    seen.add(m.actorId);
  }
  return sha256Artifact(`intelligence-lattice-policy/v1\0${canonical(policy)}`);
}
export function references(b: EventBody): string[] {
  switch (b.kind) {
    case "capability":
      return [];
    case "task":
      return b.envelope.dependencies;
    case "claim":
      return [];
    case "evidence":
    case "challenge":
    case "evidence_request":
      return [b.claimId];
    case "verification_request":
      return [b.claimId, ...b.evidenceIds];
    case "verification":
      return [b.requestId, b.claimId, ...b.evidenceIds];
    case "decision":
      return [...b.claimIds, ...b.verificationIds];
  }
}
function body(value: unknown): asserts value is EventBody {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("body required");
  const b = value as Record<string, unknown>;
  switch (b.kind) {
    case "capability":
      exact(b, ["kind", "operations", "implementation"]);
      strings(b.operations);
      hash(b.implementation);
      break;
    case "task": {
      exact(b, ["kind", "envelope"]);
      const e = exact(b.envelope, [
        "schema",
        "taskId",
        "domain",
        "operation",
        "input",
        "dependencies",
        "authority",
        "output",
      ]);
      if (e.schema !== "intelligence-lattice-task/v1") throw new Error("unsupported task schema");
      hash(e.taskId);
      text(e.domain);
      text(e.operation);
      strings(e.dependencies, 16, true);
      const input = exact(e.input, ["digest", "mediaType", "content"]);
      if (input.mediaType !== "application/json" || input.digest !== artifactDigest(input.content))
        throw new Error("task input mismatch");
      const authority = exact(e.authority, ["mode", "issuer"]);
      if (authority.mode !== "observe-only") throw new Error("task execution authority forbidden");
      text(authority.issuer);
      const output = exact(e.output, ["mediaType", "claimPredicate"]);
      if (output.mediaType !== "application/json") throw new Error("unsupported task output");
      text(output.claimPredicate);
      break;
    }
    case "claim": {
      exact(b, [
        "kind",
        "subject",
        "predicate",
        "value",
        "domain",
        "method",
        "assumptions",
        "confidence",
        "falsifier",
      ]);
      for (const k of ["subject", "predicate", "domain", "method", "falsifier"]) text(b[k]);
      strings(b.assumptions);
      const c = exact(b.confidence, ["ppm", "basis"]);
      text(c.basis);
      if (
        c.ppm !== null &&
        (!Number.isSafeInteger(c.ppm) || (c.ppm as number) < 0 || (c.ppm as number) > 1000000)
      )
        throw new Error("invalid asserted confidence");
      break;
    }
    case "evidence": {
      exact(b, ["kind", "claimId", "relation", "artifact", "method"]);
      hash(b.claimId);
      text(b.method);
      if (!["supports", "contradicts"].includes(b.relation as string))
        throw new Error("invalid relation");
      const a = exact(b.artifact, ["digest", "mediaType", "content"]);
      if (a.mediaType !== "application/json" || a.digest !== artifactDigest(a.content))
        throw new Error("artifact content mismatch");
      break;
    }
    case "challenge":
    case "evidence_request":
      exact(b, ["kind", "claimId", b.kind === "challenge" ? "reason" : "question"]);
      hash(b.claimId);
      text(b[b.kind === "challenge" ? "reason" : "question"]);
      break;
    case "verification_request":
    case "verification":
      exact(
        b,
        b.kind === "verification_request"
          ? ["kind", "claimId", "evidenceIds", "verifier"]
          : ["kind", "requestId", "claimId", "evidenceIds", "verifier", "verdict", "artifact"],
      );
      hash(b.claimId);
      strings(b.evidenceIds, 16, true);
      text(b.verifier);
      if (!b.evidenceIds.length) throw new Error("evidence required");
      if (b.kind === "verification") {
        hash(b.requestId);
        if (!["SUPPORTED", "REFUTED", "INCONCLUSIVE"].includes(b.verdict as string))
          throw new Error("invalid verdict");
      }
      break;
    case "decision": {
      exact(b, ["kind", "procedure", "claimIds", "verificationIds", "result"]);
      if (b.procedure !== "evidence-cut/v1") throw new Error("unknown procedure");
      strings(b.claimIds, 16, true);
      strings(b.verificationIds, 16, true);
      if (!b.claimIds.length) throw new Error("decision needs claims");
      const r = exact(b.result, ["accepted", "rejected", "unresolved"]);
      for (const k of ["accepted", "rejected", "unresolved"]) strings(r[k], 16, true);
      break;
    }
    default:
      throw new Error("unknown event kind");
  }
}
function signingBytes(unsigned: UnsignedEvent) {
  return Buffer.from(`${EVENT_SCHEMA}\0${canonical(unsigned)}`);
}
export function createEvent(
  identity: Identity,
  policy: MembershipPolicy,
  args: { sequence: number; body: EventBody; parents?: string[]; issuedAt?: string },
): LatticeEvent {
  const unsigned: UnsignedEvent = {
    schema: EVENT_SCHEMA,
    latticeId: policy.latticeId,
    policyDigest: policyDigest(policy),
    actorId: identity.actorId,
    publicKeyHex: identity.publicKeyHex,
    sequence: args.sequence,
    issuedAt: args.issuedAt ?? new Date().toISOString(),
    parents: [...new Set([...(args.parents ?? []), ...references(args.body)])].sort(),
    body: args.body,
  };
  const bytes = signingBytes(unsigned);
  return validateEvent(
    {
      ...unsigned,
      id: sha256Artifact(bytes),
      signatureHex: sign(null, bytes, identity.privateKey).toString("hex"),
    },
    policy,
  );
}
export function validateEvent(value: unknown, policy: MembershipPolicy): LatticeEvent {
  canonical(value);
  const e = exact(value, [
    "schema",
    "latticeId",
    "policyDigest",
    "actorId",
    "publicKeyHex",
    "sequence",
    "issuedAt",
    "parents",
    "body",
    "id",
    "signatureHex",
  ]);
  if (
    e.schema !== EVENT_SCHEMA ||
    e.latticeId !== policy.latticeId ||
    e.policyDigest !== policyDigest(policy)
  )
    throw new Error("schema/network/policy mismatch");
  if (!Number.isSafeInteger(e.sequence) || (e.sequence as number) < 1)
    throw new Error("invalid sequence");
  text(e.issuedAt);
  if (
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(e.issuedAt) ||
    new Date(e.issuedAt).toISOString() !== e.issuedAt
  )
    throw new Error("invalid asserted timestamp");
  strings(e.parents, 32, true);
  const parents = e.parents;
  if (parents.join() !== parents.slice().sort().join()) throw new Error("parents must be sorted");
  body(e.body);
  hash(e.id);
  if (typeof e.publicKeyHex !== "string" || actorId(e.publicKeyHex) !== e.actorId)
    throw new Error("identity mismatch");
  const member = policy.members.find(
    (m) => m.actorId === e.actorId && m.publicKeyHex === e.publicKeyHex,
  );
  if (!member || !member.kinds.includes(e.body.kind)) throw new Error("actor/kind not admitted");
  if (
    e.body.kind === "claim" &&
    !member.domains.includes("*") &&
    !member.domains.includes(e.body.domain)
  )
    throw new Error("claim domain not admitted");
  if (references(e.body).some((id) => !parents.includes(id)) || parents.includes(e.id))
    throw new Error("dependency binding mismatch");
  if (typeof e.signatureHex !== "string" || !/^[0-9a-f]{128}$/.test(e.signatureHex))
    throw new Error("invalid signature encoding");
  const { id: _id, signatureHex: _signature, ...unsigned } = e,
    bytes = signingBytes(unsigned as unknown as UnsignedEvent);
  const key = createPublicKey({
    key: Buffer.concat([SPKI, Buffer.from(e.publicKeyHex, "hex")]),
    format: "der",
    type: "spki",
  });
  if (
    sha256Artifact(bytes) !== e.id ||
    !verify(null, bytes, key, Buffer.from(e.signatureHex, "hex"))
  )
    throw new Error("invalid digest/signature");
  return JSON.parse(canonical(e)) as LatticeEvent;
}
