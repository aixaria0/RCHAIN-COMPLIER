import { createHash } from "node:crypto";
import type { VerificationOutcome } from "./verification-compiler.ts";

export type AssuranceArtifactStatus = "PASS" | "FAIL" | "BLOCKED" | "NOT_TESTED";

export interface CrossRepoArtifact {
  producer: "RCHAIN-COMPLIER" | "rchain-sentinel" | "rlsenti" | "Sovereign-Lattice";
  schema: string;
  digest: string;
  status: AssuranceArtifactStatus;
  bindsTo?: string[];
}

export interface CausalAssuranceEcosystemManifest {
  schema: "causal-assurance-ecosystem/v1";
  runId: string;
  subject: { kind: string; id: string };
  artifacts: {
    possibility: CrossRepoArtifact;
    observation: CrossRepoArtifact;
    workbench: CrossRepoArtifact;
    attestation?: CrossRepoArtifact;
  };
}

export interface EcosystemValidationPolicy {
  requireAttestation?: boolean;
}

export function sha256Artifact(payload: string | Uint8Array): string {
  return `sha256:${createHash("sha256").update(payload).digest("hex")}`;
}

function validDigest(value: string): boolean {
  return /^sha256:[0-9a-f]{64}$/i.test(value);
}

/**
 * Maps verification semantics into assurance semantics without promotion.
 * INCONCLUSIVE and LIMIT_REACHED are always BLOCKED; a found counterexample
 * is FAIL. Only model-scoped unreachability may become PASS.
 */
export function assuranceStatusFromVerificationOutcome(outcome: VerificationOutcome): AssuranceArtifactStatus {
  switch (outcome) {
    case "UNREACHABLE_IN_MODEL":
      return "PASS";
    case "WITNESS_FOUND":
      return "FAIL";
    case "LIMIT_REACHED":
    case "INCONCLUSIVE":
      return "BLOCKED";
  }
}

export function validateEcosystemChain(
  manifest: CausalAssuranceEcosystemManifest,
  policy: EcosystemValidationPolicy = {},
): { status: "PASS" | "BLOCKED"; reason: string } {
  if (
    manifest.schema !== "causal-assurance-ecosystem/v1"
    || !manifest.runId
    || !manifest.subject.kind
    || !manifest.subject.id
  ) {
    return { status: "BLOCKED", reason: "invalid ecosystem identity" };
  }

  const { possibility, observation, workbench, attestation } = manifest.artifacts;
  const required = [
    [possibility, "RCHAIN-COMPLIER"],
    [observation, "rchain-sentinel"],
    [workbench, "rlsenti"],
  ] as const;

  for (const [artifact, producer] of required) {
    if (artifact.producer !== producer || !artifact.schema || !validDigest(artifact.digest)) {
      return { status: "BLOCKED", reason: `invalid ${producer} artifact` };
    }
    if (artifact.status !== "PASS") {
      return { status: "BLOCKED", reason: `${producer} is ${artifact.status}` };
    }
  }

  if (!observation.bindsTo?.includes(possibility.digest)) {
    return { status: "BLOCKED", reason: "observation does not bind possibility artifact" };
  }
  if (
    !workbench.bindsTo?.includes(possibility.digest)
    || !workbench.bindsTo.includes(observation.digest)
  ) {
    return { status: "BLOCKED", reason: "workbench does not bind upstream artifacts" };
  }

  if (!attestation) {
    if (policy.requireAttestation) {
      return { status: "BLOCKED", reason: "policy requires reviewer attestation" };
    }
    return { status: "PASS", reason: "base three-repository assurance chain is complete" };
  }

  if (
    attestation.producer !== "Sovereign-Lattice"
    || !attestation.schema
    || !validDigest(attestation.digest)
  ) {
    return { status: "BLOCKED", reason: "invalid Sovereign-Lattice artifact" };
  }
  if (attestation.status !== "PASS") {
    return { status: "BLOCKED", reason: `Sovereign-Lattice is ${attestation.status}` };
  }
  if (!attestation.bindsTo?.includes(workbench.digest)) {
    return { status: "BLOCKED", reason: "attestation does not bind workbench artifact" };
  }
  return { status: "PASS", reason: "four-repository assurance chain is complete" };
}

export type TamperBoundary =
  | "POSSIBILITY_DIGEST"
  | "OBSERVATION_BINDING"
  | "WORKBENCH_BINDING"
  | "ATTESTATION_BINDING"
  | "PROVENANCE_TRUST";

export interface TamperProbeResult {
  boundary: TamperBoundary;
  expected: "BLOCKED";
  observed: "BLOCKED";
  reason: string;
}

function cloneManifest(value: CausalAssuranceEcosystemManifest): CausalAssuranceEcosystemManifest {
  return JSON.parse(JSON.stringify(value)) as CausalAssuranceEcosystemManifest;
}

/** Deterministic negative-control matrix. Every mutation must fail closed. */
export function runTamperMatrix(
  pristine: CausalAssuranceEcosystemManifest,
): TamperProbeResult[] {
  if (!pristine.artifacts.attestation) {
    throw new Error("tamper matrix requires an attested manifest");
  }
  if (validateEcosystemChain(pristine, { requireAttestation: true }).status !== "PASS") {
    throw new Error("tamper matrix requires a valid pristine manifest");
  }
  const probes: Array<[TamperBoundary, (m: CausalAssuranceEcosystemManifest) => void]> = [
    ["POSSIBILITY_DIGEST", (m) => { m.artifacts.possibility.digest = "sha256:" + "0".repeat(64); }],
    ["OBSERVATION_BINDING", (m) => { m.artifacts.observation.bindsTo = ["sha256:" + "1".repeat(64)]; }],
    ["WORKBENCH_BINDING", (m) => {
      m.artifacts.workbench.bindsTo = ["sha256:" + "2".repeat(64), m.artifacts.observation.digest];
    }],
    ["ATTESTATION_BINDING", (m) => {
      if (!m.artifacts.attestation) throw new Error("attestation missing");
      m.artifacts.attestation.bindsTo = ["sha256:" + "3".repeat(64)];
    }],
    ["PROVENANCE_TRUST", (m) => { m.artifacts.possibility.status = "BLOCKED"; }],
  ];
  return probes.map(([boundary, mutate]) => {
    const candidate = cloneManifest(pristine);
    mutate(candidate);
    const result = validateEcosystemChain(candidate, { requireAttestation: true });
    if (result.status !== "BLOCKED") {
      throw new Error(`tamper probe escaped fail-closed boundary: ${boundary}`);
    }
    return { boundary, expected: "BLOCKED", observed: "BLOCKED", reason: result.reason };
  });
}
