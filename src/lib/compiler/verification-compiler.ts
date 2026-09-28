/**
 * Protocol-agnostic adaptive verification compiler.
 *
 * It chooses exactly one compatible verification adapter. Selection is
 * deterministic and fail-closed: no adapter or a top-priority tie is BLOCKED.
 * The compiler does not assume blockchain, networking, consensus, or RChain.
 */

export type VerificationOutcome =
  | "WITNESS_FOUND"
  | "UNREACHABLE_IN_MODEL"
  | "LIMIT_REACHED"
  | "INCONCLUSIVE";

export interface VerificationProblem {
  id: string;
  modelFamily: string;
  scope: Record<string, unknown>;
  assumptions: string[];
  payload: unknown;
}

export interface VerificationArtifact {
  schema: "verification-artifact/v1";
  problemId: string;
  modelFamily: string;
  adapterId: string;
  adapterVersion: string;
  outcome: VerificationOutcome;
  scope: Record<string, unknown>;
  assumptions: string[];
  limitations: string[];
  witness?: unknown;
  metrics?: Record<string, string | number | boolean | null>;
  minimality?: {
    kind: string;
    objectives?: string[];
  };
}

export interface VerificationAdapter {
  id: string;
  version: string;
  modelFamily: string | "*";
  priority: number;
  supports(problem: VerificationProblem): boolean;
  verify(problem: VerificationProblem): VerificationArtifact;
}

export interface CompiledVerification {
  status: "COMPILED" | "BLOCKED";
  problemId: string;
  candidateAdapters: string[];
  selectedAdapterId: string | null;
  reason: string;
  artifact: VerificationArtifact | null;
}

function validateProblem(problem: VerificationProblem): void {
  if (!problem.id.trim()) throw new Error("verification problem requires an id");
  if (!problem.modelFamily.trim()) {
    throw new Error("verification problem requires a modelFamily");
  }
  if (problem.assumptions.some((item) => !item.trim())) {
    throw new Error("verification assumptions must be non-empty strings");
  }
}

function validateAdapter(adapter: VerificationAdapter): void {
  if (!adapter.id.trim() || !adapter.version.trim()) {
    throw new Error("verification adapters require id and version");
  }
  if (!Number.isSafeInteger(adapter.priority)) {
    throw new Error(`adapter ${adapter.id} priority must be a safe integer`);
  }
}

function canonicalClaimValue(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalClaimValue(item)).join(",")}]`;
  }

  switch (typeof value) {
    case "string":
    case "boolean":
      return JSON.stringify(value);
    case "number":
      if (!Number.isFinite(value)) {
        throw new Error("verification claim metadata contains a non-finite number");
      }
      return Object.is(value, -0) ? "0" : String(value);
    case "object": {
      const record = value as Record<string, unknown>;
      return `{${Object.keys(record)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${canonicalClaimValue(record[key])}`)
        .join(",")}}`;
    }
    default:
      throw new Error(
        `verification claim metadata contains unsupported ${typeof value}`,
      );
  }
}

function artifactMatches(
  artifact: VerificationArtifact,
  problem: VerificationProblem,
  adapter: VerificationAdapter,
): boolean {
  try {
    return (
      artifact.schema === "verification-artifact/v1" &&
      artifact.problemId === problem.id &&
      artifact.modelFamily === problem.modelFamily &&
      artifact.adapterId === adapter.id &&
      artifact.adapterVersion === adapter.version &&
      canonicalClaimValue(artifact.scope) === canonicalClaimValue(problem.scope) &&
      canonicalClaimValue(artifact.assumptions) ===
        canonicalClaimValue(problem.assumptions)
    );
  } catch {
    return false;
  }
}

export function compileVerification(
  problem: VerificationProblem,
  adapters: VerificationAdapter[],
): CompiledVerification {
  validateProblem(problem);
  adapters.forEach(validateAdapter);

  const compatible = adapters
    .filter(
      (adapter) =>
        (adapter.modelFamily === "*" || adapter.modelFamily === problem.modelFamily) &&
        adapter.supports(problem),
    )
    .sort((left, right) => right.priority - left.priority || left.id.localeCompare(right.id));

  const candidateAdapters = compatible.map((adapter) => adapter.id);
  if (compatible.length === 0) {
    return {
      status: "BLOCKED",
      problemId: problem.id,
      candidateAdapters: [],
      selectedAdapterId: null,
      reason: "no compatible verification adapter",
      artifact: null,
    };
  }

  const bestPriority = compatible[0]!.priority;
  const best = compatible.filter((adapter) => adapter.priority === bestPriority);
  if (best.length !== 1) {
    return {
      status: "BLOCKED",
      problemId: problem.id,
      candidateAdapters,
      selectedAdapterId: null,
      reason: `ambiguous top-priority adapters: ${best.map((adapter) => adapter.id).join(", ")}`,
      artifact: null,
    };
  }

  const selected = best[0]!;
  const artifact = selected.verify(problem);
  if (!artifactMatches(artifact, problem, selected)) {
    return {
      status: "BLOCKED",
      problemId: problem.id,
      candidateAdapters,
      selectedAdapterId: selected.id,
      reason: "selected adapter returned an artifact with mismatched identity",
      artifact: null,
    };
  }

  return {
    status: "COMPILED",
    problemId: problem.id,
    candidateAdapters,
    selectedAdapterId: selected.id,
    reason: `selected ${selected.id}@${selected.version}`,
    artifact,
  };
}
