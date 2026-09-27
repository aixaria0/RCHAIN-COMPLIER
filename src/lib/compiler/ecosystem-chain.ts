import { createHash } from "node:crypto";

export interface CrossRepoArtifact {
  producer: "RCHAIN-COMPLIER" | "rchain-sentinel" | "rlsenti" | "Sovereign-Lattice";
  schema: string;
  digest: string;
  status: "PASS" | "FAIL" | "BLOCKED" | "NOT_TESTED";
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
    attestation: CrossRepoArtifact;
  };
}

export function sha256Artifact(payload: string | Uint8Array): string {
  return `sha256:${createHash("sha256").update(payload).digest("hex")}`;
}

function validDigest(value: string): boolean {
  return /^sha256:[0-9a-f]{64}$/i.test(value);
}

export function validateEcosystemChain(
  manifest: CausalAssuranceEcosystemManifest,
): { status: "PASS" | "BLOCKED"; reason: string } {
  if (manifest.schema !== "causal-assurance-ecosystem/v1" || !manifest.runId || !manifest.subject.kind || !manifest.subject.id) {
    return { status: "BLOCKED", reason: "invalid ecosystem identity" };
  }
  const { possibility, observation, workbench, attestation } = manifest.artifacts;
  const expected = [
    [possibility, "RCHAIN-COMPLIER"],
    [observation, "rchain-sentinel"],
    [workbench, "rlsenti"],
    [attestation, "Sovereign-Lattice"],
  ] as const;
  for (const [artifact, producer] of expected) {
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
  if (!workbench.bindsTo?.includes(possibility.digest) || !workbench.bindsTo.includes(observation.digest)) {
    return { status: "BLOCKED", reason: "workbench does not bind upstream artifacts" };
  }
  if (!attestation.bindsTo?.includes(workbench.digest)) {
    return { status: "BLOCKED", reason: "attestation does not bind workbench artifact" };
  }
  return { status: "PASS", reason: "four-repository digest chain is complete" };
}
