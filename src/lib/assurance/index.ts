/** Supported Node-only product interface. Low-level lattice APIs remain available through /lattice. */
export * from "./errors.ts";
export * from "./submission.ts";
export * from "./package.ts";
export * from "./engine.ts";
export {
  canonical,
  parseCanonical,
  artifactDigest,
  policyDigest,
  type TaskEnvelope,
  type MembershipPolicy,
  type LatticeEvent,
} from "../lattice/protocol.ts";
export { replay } from "../lattice/replay.ts";
export {
  CORE_VERIFIERS,
  type VerifierRegistry,
  type ReproducedResult,
} from "../lattice/verification.ts";
