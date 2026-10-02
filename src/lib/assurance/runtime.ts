import { lstatSync, openSync, readSync, closeSync, fstatSync, constants } from "node:fs";
import { join, isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";
import { sha256Artifact } from "../compiler/ecosystem-chain.ts";
import { CORE_VERIFIERS, type VerifierRegistry } from "../lattice/verification.ts";
import { RCHAIN_VERIFIERS } from "../integrations/rchain-c192.ts";
import {
  canonical,
  exact,
  loadIdentity,
  parseCanonical,
  policyDigest,
  type MembershipPolicy,
} from "../lattice/protocol.ts";
import { AssuranceError } from "./errors.ts";

export interface EngineState {
  schema: "assurance-engine-state/v1";
  policy: MembershipPolicy;
  integration: "core" | "rchain";
  verifierModule: string | null;
  verifierModuleDigest: string | null;
}
export function readBounded(file: string, max: number): Buffer {
  const fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.isSymbolicLink())
      throw new AssuranceError("IO_ERROR", "Ordinary file required");
    if (stat.size > max) throw new AssuranceError("RESOURCE_LIMIT", "File size limit exceeded");
    // Bound the actual read as well as the size check (file can change concurrently).
    const bytes = Buffer.alloc(stat.size + 1);
    let count = 0;
    while (count < bytes.length) {
      const n = readSync(fd, bytes, count, bytes.length - count, null);
      if (!n) break;
      count += n;
    }
    if (count > stat.size) throw new AssuranceError("RESOURCE_LIMIT", "File grew during read");
    return bytes.subarray(0, count);
  } finally {
    closeSync(fd);
  }
}

export function loadState(directory: string): EngineState {
  const state = exact(parseCanonical(readBounded(join(directory, "engine.json"), 16384)), [
    "schema",
    "policy",
    "integration",
    "verifierModule",
    "verifierModuleDigest",
  ]) as unknown as EngineState;
  if (
    state.schema !== "assurance-engine-state/v1" ||
    !["core", "rchain"].includes(state.integration)
  )
    throw new AssuranceError("INVALID_INPUT", "Unsupported engine configuration");
  policyDigest(state.policy);
  if (state.policy.members.length !== 3)
    throw new AssuranceError("INVALID_INPUT", "Three-member policy required");
  if (
    state.verifierModule !== null &&
    (typeof state.verifierModule !== "string" || !isAbsolute(state.verifierModule))
  )
    throw new AssuranceError(
      "INVALID_INPUT",
      "Operator verifier module must be an absolute local path",
    );
  if ((state.verifierModule === null) !== (state.verifierModuleDigest === null))
    throw new AssuranceError("INVALID_INPUT", "Verifier module and digest must be paired");
  // Validate the canonical snapshot once more before sharing across processes.
  canonical(state);
  return state;
}
export function loadEngineIdentity(directory: string, index: number) {
  const file = join(directory, `identity-${index}.pem`);
  if (lstatSync(file).mode & 0o077)
    throw new AssuranceError("IO_ERROR", "Private key permissions must be 0600");
  return loadIdentity(readBounded(file, 4096).toString("utf8"));
}
export async function loadRegistry(state: EngineState): Promise<VerifierRegistry> {
  const registry = new Map(CORE_VERIFIERS);
  if (state.integration === "rchain") for (const entry of RCHAIN_VERIFIERS) registry.set(...entry);
  if (state.verifierModule) {
    const bytes = readBounded(state.verifierModule, 256 * 1024);
    if (sha256Artifact(bytes) !== state.verifierModuleDigest)
      throw new AssuranceError(
        "INTEGRITY_MISMATCH",
        "Operator verifier module changed; explicit migration required",
      );
    const moduleUrl = pathToFileURL(state.verifierModule);
    moduleUrl.searchParams.set("sha256", state.verifierModuleDigest!);
    const module = await import(moduleUrl.href);
    const extensions: unknown = module.VERIFIERS;
    if (!(extensions instanceof Map))
      throw new AssuranceError("INVALID_INPUT", "Verifier module must export a VERIFIERS Map");
    for (const [name, implementation] of extensions) {
      if (
        typeof name !== "string" ||
        !name.trim() ||
        name.length > 256 ||
        typeof implementation !== "function" ||
        registry.has(name) ||
        name === "replicate-events/v1"
      )
        throw new AssuranceError("INVALID_INPUT", "Invalid or conflicting verifier registration");
      registry.set(name, implementation);
    }
  }
  if (registry.size > 15)
    throw new AssuranceError("RESOURCE_LIMIT", "At most 15 operations can be advertised");
  return registry;
}

export function moduleDigest(file: string) {
  return sha256Artifact(readBounded(file, 256 * 1024));
}
