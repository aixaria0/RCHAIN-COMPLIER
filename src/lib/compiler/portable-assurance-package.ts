import { sha256Artifact } from "./ecosystem-chain.ts";

export const PORTABLE_ASSURANCE_PACKAGE_SCHEMA = "causal-assurance-portable-package/v1" as const;

export type PortableArtifactRole = "WITNESS" | "EVIDENCE" | "WORKBENCH" | "ATTESTATION";

export interface PortableAssuranceArtifact {
  role: PortableArtifactRole;
  bytes: string;
  sha256: string;
  bindsTo: string[];
}

export interface PortableAssurancePackage {
  schema: typeof PORTABLE_ASSURANCE_PACKAGE_SCHEMA;
  runId: string;
  subject: string;
  artifacts: PortableAssuranceArtifact[];
}

export interface PortablePackageVerification {
  valid: boolean;
  reason: string;
  recomputedDigests: string[];
}

const baseOrder: PortableArtifactRole[] = ["WITNESS", "EVIDENCE", "WORKBENCH"];
const attestedOrder: PortableArtifactRole[] = [...baseOrder, "ATTESTATION"];

export function verifyPortableAssurancePackage(pkg: PortableAssurancePackage): PortablePackageVerification {
  const fail = (reason: string, recomputedDigests: string[] = []): PortablePackageVerification =>
    ({ valid: false, reason, recomputedDigests });

  if (pkg.schema !== PORTABLE_ASSURANCE_PACKAGE_SCHEMA || !pkg.runId.trim() || !pkg.subject.trim()) {
    return fail("invalid package identity");
  }
  const order = pkg.artifacts.length === baseOrder.length
    ? baseOrder
    : pkg.artifacts.length === attestedOrder.length
      ? attestedOrder
      : null;
  if (!order) return fail("package must contain three base artifacts and at most one reviewer attestation");

  const recomputed: string[] = [];
  for (let i = 0; i < order.length; i += 1) {
    const artifact = pkg.artifacts[i];
    if (artifact.role !== order[i]) return fail(`unexpected artifact role at index ${i}`, recomputed);
    const actual = sha256Artifact(artifact.bytes);
    recomputed.push(actual);
    if (actual !== artifact.sha256) return fail(`artifact digest mismatch: ${artifact.role}`, recomputed);
    const expectedBindings = recomputed.slice(0, -1);
    if (
      artifact.bindsTo.length !== expectedBindings.length
      || artifact.bindsTo.some((digest, index) => digest !== expectedBindings[index])
    ) {
      return fail(`artifact binding mismatch: ${artifact.role}`, recomputed);
    }
  }
  return {
    valid: true,
    reason: order.length === 4
      ? "base artifacts and optional attestation independently reverified"
      : "base artifact bytes, digests, ordering, and transitive bindings independently reverified",
    recomputedDigests: recomputed,
  };
}
