import { sha256Artifact } from "./ecosystem-chain.ts";
import type { RepairArtifact } from "./repair-compiler.ts";
import type { VerificationArtifact } from "./verification-compiler.ts";

export const REPAIR_PACKAGE_SCHEMA = "causal-assurance-repair-package/v1" as const;

export type RepairPackageRole =
  | "ORIGINAL_VERIFICATION"
  | "REPAIR"
  | "POST_REPAIR_VERIFICATION";

export interface RepairPackageArtifact {
  role: RepairPackageRole;
  bytes: string;
  sha256: string;
  bindsTo: string[];
}

export interface RepairPackage {
  schema: typeof REPAIR_PACKAGE_SCHEMA;
  runId: string;
  subject: string;
  artifacts: RepairPackageArtifact[];
}

export interface RepairPackageVerification {
  valid: boolean;
  reason: string;
  recomputedDigests: string[];
}

const ROLE_ORDER: RepairPackageRole[] = [
  "ORIGINAL_VERIFICATION",
  "REPAIR",
  "POST_REPAIR_VERIFICATION",
];

function canonical(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonical(item)).join(",")}]`;
  }
  switch (typeof value) {
    case "string":
    case "boolean":
      return JSON.stringify(value);
    case "number":
      if (!Number.isFinite(value)) throw new Error("non-finite canonical value");
      return Object.is(value, -0) ? "0" : String(value);
    case "object": {
      const record = value as Record<string, unknown>;
      return `{${Object.keys(record)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`)
        .join(",")}}`;
    }
    default:
      throw new Error(`unsupported canonical value: ${typeof value}`);
  }
}

function parseJson<T>(bytes: string): T | null {
  try {
    return JSON.parse(bytes) as T;
  } catch {
    return null;
  }
}

export function createRepairPackage(
  runId: string,
  subject: string,
  original: VerificationArtifact,
  repair: RepairArtifact,
  postRepair: VerificationArtifact,
): RepairPackage {
  const bytes = [
    JSON.stringify(original),
    JSON.stringify(repair),
    JSON.stringify(postRepair),
  ];
  const digests = bytes.map(sha256Artifact);

  return {
    schema: REPAIR_PACKAGE_SCHEMA,
    runId,
    subject,
    artifacts: [
      {
        role: "ORIGINAL_VERIFICATION",
        bytes: bytes[0]!,
        sha256: digests[0]!,
        bindsTo: [],
      },
      {
        role: "REPAIR",
        bytes: bytes[1]!,
        sha256: digests[1]!,
        bindsTo: [digests[0]!],
      },
      {
        role: "POST_REPAIR_VERIFICATION",
        bytes: bytes[2]!,
        sha256: digests[2]!,
        bindsTo: [digests[0]!, digests[1]!],
      },
    ],
  };
}

export function verifyRepairPackage(
  pkg: RepairPackage,
): RepairPackageVerification {
  const fail = (
    reason: string,
    recomputedDigests: string[] = [],
  ): RepairPackageVerification => ({
    valid: false,
    reason,
    recomputedDigests,
  });

  if (
    pkg.schema !== REPAIR_PACKAGE_SCHEMA ||
    !pkg.runId.trim() ||
    !pkg.subject.trim()
  ) {
    return fail("invalid repair package identity");
  }

  if (pkg.artifacts.length !== ROLE_ORDER.length) {
    return fail("repair package requires exactly three artifacts");
  }

  const recomputed: string[] = [];
  for (let index = 0; index < ROLE_ORDER.length; index += 1) {
    const artifact = pkg.artifacts[index]!;
    if (artifact.role !== ROLE_ORDER[index]) {
      return fail(`unexpected repair artifact role at index ${index}`, recomputed);
    }

    const actual = sha256Artifact(artifact.bytes);
    recomputed.push(actual);
    if (actual !== artifact.sha256) {
      return fail(`repair artifact digest mismatch: ${artifact.role}`, recomputed);
    }

    const expectedBindings = recomputed.slice(0, -1);
    if (
      artifact.bindsTo.length !== expectedBindings.length ||
      artifact.bindsTo.some(
        (digest, bindingIndex) => digest !== expectedBindings[bindingIndex],
      )
    ) {
      return fail(`repair artifact binding mismatch: ${artifact.role}`, recomputed);
    }
  }

  const original = parseJson<VerificationArtifact>(pkg.artifacts[0]!.bytes);
  const repair = parseJson<RepairArtifact>(pkg.artifacts[1]!.bytes);
  const postRepair = parseJson<VerificationArtifact>(pkg.artifacts[2]!.bytes);

  if (!original || !repair || !postRepair) {
    return fail("repair package contains non-JSON artifact bytes", recomputed);
  }
  if (
    original.schema !== "verification-artifact/v1" ||
    original.outcome !== "WITNESS_FOUND"
  ) {
    return fail("original verification must be WITNESS_FOUND", recomputed);
  }
  if (
    repair.schema !== "repair-artifact/v1" ||
    repair.outcome !== "REPAIR_FOUND"
  ) {
    return fail("repair artifact must be REPAIR_FOUND", recomputed);
  }
  if (
    postRepair.schema !== "verification-artifact/v1" ||
    postRepair.outcome !== "UNREACHABLE_IN_MODEL"
  ) {
    return fail(
      "post-repair verification must be UNREACHABLE_IN_MODEL",
      recomputed,
    );
  }

  if (
    repair.originalProblemId !== original.problemId ||
    postRepair.problemId !== original.problemId
  ) {
    return fail("repair package problem identity mismatch", recomputed);
  }
  if (
    repair.verificationAdapterId !== original.adapterId ||
    repair.verificationAdapterVersion !== original.adapterVersion ||
    postRepair.adapterId !== original.adapterId ||
    postRepair.adapterVersion !== original.adapterVersion
  ) {
    return fail("repair package verification adapter mismatch", recomputed);
  }
  if (
    original.modelFamily !== postRepair.modelFamily ||
    repair.modelFamily !== original.modelFamily
  ) {
    return fail("repair package model family mismatch", recomputed);
  }
  if (
    canonical(original.scope) !== canonical(postRepair.scope) ||
    canonical(original.scope) !== canonical(repair.scope)
  ) {
    return fail("repair package scope changed across repair", recomputed);
  }
  if (
    canonical(original.assumptions) !== canonical(postRepair.assumptions) ||
    canonical(original.assumptions) !== canonical(repair.assumptions)
  ) {
    return fail("repair package assumptions changed across repair", recomputed);
  }
  if (
    !repair.postRepairVerification ||
    canonical(repair.postRepairVerification) !== canonical(postRepair)
  ) {
    return fail("embedded post-repair verification does not match package artifact", recomputed);
  }

  return {
    valid: true,
    reason:
      "repair package bytes, transitive bindings, claim identity, verifier identity, and post-repair result independently reverified",
    recomputedDigests: recomputed,
  };
}
