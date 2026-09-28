import {
  searchLexicographicPossibility,
  type LexicographicTransition,
} from "./lexicographic-possibility.ts";
import {
  compileVerification,
  type CompiledVerification,
  type VerificationAdapter,
  type VerificationArtifact,
  type VerificationProblem,
} from "./verification-compiler.ts";

export type RepairOutcome =
  | "REPAIR_FOUND"
  | "NO_REPAIR_IN_MODEL"
  | "LIMIT_REACHED";

export interface RepairProblem {
  id: string;
  modelFamily: string;
  originalProblem: VerificationProblem;
  originalArtifact: VerificationArtifact;
  objectives: string[];
  payload: unknown;
}

export interface RepairTransition {
  to: unknown;
  label: string;
  cost: readonly number[];
  metadata?: Record<string, unknown>;
}

export interface RepairSearch {
  initial: unknown;
  stateKey(state: unknown): string;
  expand(state: unknown): RepairTransition[];
  toVerificationProblem(state: unknown): VerificationProblem;
  maxStates?: number;
  limitations?: string[];
}

export interface RepairAdapter {
  id: string;
  version: string;
  modelFamily: string | "*";
  priority: number;
  supports(problem: RepairProblem): boolean;
  createSearch(problem: RepairProblem): RepairSearch;
}

export interface RepairActionRecord {
  label: string;
  cost: number[];
  cumulativeCost: number[];
  metadata?: Record<string, unknown>;
}

export interface RepairArtifact {
  schema: "repair-artifact/v1";
  repairProblemId: string;
  modelFamily: string;
  repairAdapterId: string;
  repairAdapterVersion: string;
  verificationAdapterId: string;
  verificationAdapterVersion: string;
  originalProblemId: string;
  originalOutcome: "WITNESS_FOUND";
  outcome: RepairOutcome;
  objectives: string[];
  selectedActions: RepairActionRecord[];
  totalCost: number[] | null;
  postRepairVerification: VerificationArtifact | null;
  scope: Record<string, unknown>;
  assumptions: string[];
  limitations: string[];
  minimality?: {
    kind: "LEXICOGRAPHIC_MINIMUM_WITHIN_DECLARED_REPAIR_SPACE";
    objectives: string[];
  };
  metrics: {
    exploredStates: number;
    frontierPeak: number;
    rejectedIdentityCandidates: number;
  };
}

export interface CompiledRepair {
  status: "COMPILED" | "BLOCKED";
  repairProblemId: string;
  candidateAdapters: string[];
  selectedAdapterId: string | null;
  reason: string;
  artifact: RepairArtifact | null;
}

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
      if (!Number.isFinite(value)) throw new Error("claim identity contains a non-finite number");
      return Object.is(value, -0) ? "0" : String(value);
    case "object": {
      const record = value as Record<string, unknown>;
      return `{${Object.keys(record)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`)
        .join(",")}}`;
    }
    default:
      throw new Error(`claim identity contains unsupported ${typeof value}`);
  }
}

function sameClaimIdentity(candidate: VerificationProblem, original: VerificationProblem): boolean {
  return (
    candidate.id === original.id &&
    candidate.modelFamily === original.modelFamily &&
    canonical(candidate.scope) === canonical(original.scope) &&
    canonical(candidate.assumptions) === canonical(original.assumptions)
  );
}

function validateProblem(problem: RepairProblem): void {
  if (!problem.id.trim()) throw new Error("repair problem requires an id");
  if (!problem.modelFamily.trim()) throw new Error("repair problem requires a modelFamily");
  if (problem.modelFamily !== problem.originalProblem.modelFamily) {
    throw new Error("repair problem modelFamily must match original verification problem");
  }
  if (problem.objectives.length === 0 || problem.objectives.some((item) => !item.trim())) {
    throw new Error("repair problem requires non-empty objective names");
  }
  if (new Set(problem.objectives).size !== problem.objectives.length) {
    throw new Error("repair objective names must be unique");
  }
}

function validateAdapter(adapter: RepairAdapter): void {
  if (!adapter.id.trim() || !adapter.version.trim()) {
    throw new Error("repair adapters require id and version");
  }
  if (!Number.isSafeInteger(adapter.priority)) {
    throw new Error(`repair adapter ${adapter.id} priority must be a safe integer`);
  }
}

function originalArtifactMatches(
  problem: RepairProblem,
  verificationAdapter: VerificationAdapter,
): boolean {
  const artifact = problem.originalArtifact;
  const original = problem.originalProblem;
  return (
    artifact.schema === "verification-artifact/v1" &&
    artifact.problemId === original.id &&
    artifact.modelFamily === original.modelFamily &&
    artifact.adapterId === verificationAdapter.id &&
    artifact.adapterVersion === verificationAdapter.version &&
    artifact.outcome === "WITNESS_FOUND" &&
    canonical(artifact.scope) === canonical(original.scope) &&
    canonical(artifact.assumptions) === canonical(original.assumptions)
  );
}

function verificationSucceeded(
  result: CompiledVerification,
  verificationAdapter: VerificationAdapter,
): result is CompiledVerification & { artifact: VerificationArtifact } {
  return (
    result.status === "COMPILED" &&
    result.selectedAdapterId === verificationAdapter.id &&
    result.artifact !== null &&
    result.artifact.adapterVersion === verificationAdapter.version &&
    result.artifact.outcome === "UNREACHABLE_IN_MODEL"
  );
}

export function compileRepair(
  problem: RepairProblem,
  repairAdapters: RepairAdapter[],
  verificationAdapter: VerificationAdapter,
): CompiledRepair {
  validateProblem(problem);
  repairAdapters.forEach(validateAdapter);

  if (!originalArtifactMatches(problem, verificationAdapter)) {
    return {
      status: "BLOCKED",
      repairProblemId: problem.id,
      candidateAdapters: [],
      selectedAdapterId: null,
      reason:
        "original verification artifact is not a WITNESS_FOUND artifact bound to the same claim and verification adapter",
      artifact: null,
    };
  }

  const compatible = repairAdapters
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
      repairProblemId: problem.id,
      candidateAdapters: [],
      selectedAdapterId: null,
      reason: "no compatible repair adapter",
      artifact: null,
    };
  }

  const bestPriority = compatible[0]!.priority;
  const best = compatible.filter((adapter) => adapter.priority === bestPriority);
  if (best.length !== 1) {
    return {
      status: "BLOCKED",
      repairProblemId: problem.id,
      candidateAdapters,
      selectedAdapterId: null,
      reason: `ambiguous top-priority repair adapters: ${best.map((adapter) => adapter.id).join(", ")}`,
      artifact: null,
    };
  }

  const selected = best[0]!;
  const search = selected.createSearch(problem);
  const initialProblem = search.toVerificationProblem(search.initial);

  if (!sameClaimIdentity(initialProblem, problem.originalProblem)) {
    return {
      status: "BLOCKED",
      repairProblemId: problem.id,
      candidateAdapters,
      selectedAdapterId: selected.id,
      reason: "repair adapter initial state changes claim identity",
      artifact: null,
    };
  }

  let rejectedIdentityCandidates = 0;
  let identityViolation = false;
  const verificationByState = new Map<string, CompiledVerification>();

  const evaluate = (state: unknown): CompiledVerification | null => {
    const key = search.stateKey(state);
    const cached = verificationByState.get(key);
    if (cached) return cached;

    const candidate = search.toVerificationProblem(state);
    if (!sameClaimIdentity(candidate, problem.originalProblem)) {
      rejectedIdentityCandidates += 1;
      identityViolation = true;
      return null;
    }

    const result = compileVerification(candidate, [verificationAdapter]);
    verificationByState.set(key, result);
    return result;
  };

  const expand = (state: unknown): LexicographicTransition<unknown>[] => {
    const transitions = search.expand(state);
    const accepted: LexicographicTransition<unknown>[] = [];

    for (const transition of transitions) {
      const candidate = search.toVerificationProblem(transition.to);
      if (!sameClaimIdentity(candidate, problem.originalProblem)) {
        rejectedIdentityCandidates += 1;
        identityViolation = true;
        continue;
      }
      accepted.push({
        to: transition.to,
        label: transition.label,
        cost: transition.cost,
        ...(transition.metadata ? { metadata: transition.metadata } : {}),
      });
    }

    return accepted;
  };

  const result = searchLexicographicPossibility({
    initial: search.initial,
    objectives: problem.objectives,
    stateKey: search.stateKey,
    isGoal: (state) => {
      const verified = evaluate(state);
      return verified ? verificationSucceeded(verified, verificationAdapter) : false;
    },
    expand,
    ...(search.maxStates === undefined ? {} : { maxStates: search.maxStates }),
  });

  if (identityViolation) {
    return {
      status: "BLOCKED",
      repairProblemId: problem.id,
      candidateAdapters,
      selectedAdapterId: selected.id,
      reason: "repair adapter attempted to change claim identity (id, modelFamily, scope, or assumptions)",
      artifact: null,
    };
  }

  const repairOutcome: RepairOutcome =
    result.status === "REACHABLE"
      ? "REPAIR_FOUND"
      : result.status === "UNREACHABLE"
        ? "NO_REPAIR_IN_MODEL"
        : "LIMIT_REACHED";

  const postRepairVerification =
    result.goalStateKey === null
      ? null
      : verificationByState.get(result.goalStateKey)?.artifact ?? null;

  const artifact: RepairArtifact = {
    schema: "repair-artifact/v1",
    repairProblemId: problem.id,
    modelFamily: problem.modelFamily,
    repairAdapterId: selected.id,
    repairAdapterVersion: selected.version,
    verificationAdapterId: verificationAdapter.id,
    verificationAdapterVersion: verificationAdapter.version,
    originalProblemId: problem.originalProblem.id,
    originalOutcome: "WITNESS_FOUND",
    outcome: repairOutcome,
    objectives: [...problem.objectives],
    selectedActions: result.witness.map((step) => ({
      label: step.label,
      cost: [...step.cost],
      cumulativeCost: [...step.cumulativeCost],
      ...(step.metadata ? { metadata: step.metadata } : {}),
    })),
    totalCost: result.minimumCost ? [...result.minimumCost] : null,
    postRepairVerification,
    scope: { ...problem.originalProblem.scope },
    assumptions: [...problem.originalProblem.assumptions],
    limitations: [
      "repair minimality is established only inside the declared repair state space",
      "a successful repair preserves problem id, model family, scope, assumptions, and verification adapter",
      "REPAIR_FOUND means the same verifier returned UNREACHABLE_IN_MODEL after the selected intervention",
      ...(search.limitations ?? []),
    ],
    ...(repairOutcome === "REPAIR_FOUND"
      ? {
          minimality: {
            kind: "LEXICOGRAPHIC_MINIMUM_WITHIN_DECLARED_REPAIR_SPACE" as const,
            objectives: [...problem.objectives],
          },
        }
      : {}),
    metrics: {
      exploredStates: result.exploredStates,
      frontierPeak: result.frontierPeak,
      rejectedIdentityCandidates,
    },
  };

  return {
    status: "COMPILED",
    repairProblemId: problem.id,
    candidateAdapters,
    selectedAdapterId: selected.id,
    reason: `selected ${selected.id}@${selected.version}; ${repairOutcome}`,
    artifact,
  };
}
