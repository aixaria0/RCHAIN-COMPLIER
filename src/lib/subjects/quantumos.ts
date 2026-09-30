import type {
  VerificationAdapter,
  VerificationArtifact,
  VerificationProblem,
} from "../compiler/verification-compiler.ts";

export const QUANTUMOS_REFERENCE_SOURCE = {
  repository: "rchain-community/quantum-os",
  commit: "55b5dd53c03cd813092498d6ac14de9dce268f89",
  issueRefs: [132, 138],
} as const;

export type QuantumOsClosureKind = "LEMMA" | "RHOLANG";

export interface QuantumOsPerspectiveEvidence {
  perspectiveId: string;
  evidenceDigest: string;
  signatureVerified: boolean;
  zfaBalanced?: boolean;
  programDigest?: string;
  preStateHash?: string;
  postStateHash?: string;
  resultDigest?: string;
}

export interface QuantumOsClosureObservation {
  schema: "quantumos-closure-observation/v1";
  source: {
    repository: string;
    commit: string;
  };
  closure: {
    id: string;
    kind: QuantumOsClosureKind;
    claimDigest: string;
    scopeDigest: string;
    assumptionsDigest: string;
  };
  perspectives: QuantumOsPerspectiveEvidence[];
}

export interface QuantumOsInspection {
  violations: string[];
  blockers: string[];
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPerspective(value: unknown): value is QuantumOsPerspectiveEvidence {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<QuantumOsPerspectiveEvidence>;
  return (
    nonEmpty(candidate.perspectiveId) &&
    nonEmpty(candidate.evidenceDigest) &&
    typeof candidate.signatureVerified === "boolean"
  );
}

function isObservation(value: unknown): value is QuantumOsClosureObservation {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<QuantumOsClosureObservation>;
  const closure = candidate.closure;
  return (
    candidate.schema === "quantumos-closure-observation/v1" &&
    Boolean(candidate.source) &&
    nonEmpty(candidate.source?.repository) &&
    nonEmpty(candidate.source?.commit) &&
    Boolean(closure) &&
    nonEmpty(closure?.id) &&
    (closure?.kind === "LEMMA" || closure?.kind === "RHOLANG") &&
    nonEmpty(closure?.claimDigest) &&
    nonEmpty(closure?.scopeDigest) &&
    nonEmpty(closure?.assumptionsDigest) &&
    Array.isArray(candidate.perspectives) &&
    candidate.perspectives.every(isPerspective)
  );
}

function distinct(values: string[]): string[] {
  return [...new Set(values)];
}

export function inspectQuantumOsClosure(
  observation: QuantumOsClosureObservation,
): QuantumOsInspection {
  const violations: string[] = [];
  const blockers: string[] = [];

  if (observation.perspectives.length === 0) {
    blockers.push("no participant or node evidence was supplied");
    return { violations, blockers };
  }

  const ids = observation.perspectives.map((item) => item.perspectiveId);
  if (distinct(ids).length !== ids.length) {
    violations.push("duplicate perspective identity detected");
  }

  for (const perspective of observation.perspectives) {
    if (!perspective.signatureVerified) {
      violations.push(
        `perspective ${perspective.perspectiveId} has unverified signed evidence`,
      );
    }
  }

  if (observation.closure.kind === "LEMMA") {
    for (const perspective of observation.perspectives) {
      if (perspective.zfaBalanced === undefined) {
        blockers.push(
          `perspective ${perspective.perspectiveId} did not provide a ZFA closure result`,
        );
      } else if (!perspective.zfaBalanced) {
        violations.push(
          `perspective ${perspective.perspectiveId} rejects the lemma as not ZFA-balanced`,
        );
      }
    }

    return { violations, blockers };
  }

  if (distinct(ids).length < 2) {
    blockers.push(
      "rholang closure requires at least two independent perspectives before cross-checking",
    );
  }

  const required: Array<keyof QuantumOsPerspectiveEvidence> = [
    "programDigest",
    "preStateHash",
    "postStateHash",
    "resultDigest",
  ];

  for (const perspective of observation.perspectives) {
    for (const field of required) {
      if (!nonEmpty(perspective[field])) {
        blockers.push(
          `perspective ${perspective.perspectiveId} is missing ${field}`,
        );
      }
    }
  }

  if (blockers.length > 0) {
    return { violations, blockers };
  }

  const programs = distinct(
    observation.perspectives.map((item) => item.programDigest!),
  );
  const preStates = distinct(
    observation.perspectives.map((item) => item.preStateHash!),
  );

  if (programs.length !== 1) {
    blockers.push(
      "perspectives did not execute the same program digest; results are not comparable",
    );
  }
  if (preStates.length !== 1) {
    blockers.push(
      "perspectives did not start from the same pre-state; results are not comparable",
    );
  }

  if (blockers.length > 0) {
    return { violations, blockers };
  }

  const postStates = distinct(
    observation.perspectives.map((item) => item.postStateHash!),
  );
  const results = distinct(
    observation.perspectives.map((item) => item.resultDigest!),
  );

  if (postStates.length !== 1) {
    violations.push("post-state divergence across independent rnode perspectives");
  }
  if (results.length !== 1) {
    violations.push("result divergence across independent rnode perspectives");
  }

  return { violations, blockers };
}

export function createQuantumOsClosureAdapter(): VerificationAdapter {
  return {
    id: "quantumos-proof-carrying-closure",
    version: "1",
    modelFamily: "collective-closure-evidence/v1",
    priority: 80,
    supports(problem: VerificationProblem): boolean {
      return isObservation(problem.payload);
    },
    verify(problem: VerificationProblem): VerificationArtifact {
      if (!isObservation(problem.payload)) {
        throw new Error("QuantumOS closure adapter received an unsupported payload");
      }

      const inspection = inspectQuantumOsClosure(problem.payload);
      const outcome =
        inspection.violations.length > 0
          ? "WITNESS_FOUND"
          : inspection.blockers.length > 0
            ? "INCONCLUSIVE"
            : "UNREACHABLE_IN_MODEL";

      return {
        schema: "verification-artifact/v1",
        problemId: problem.id,
        modelFamily: problem.modelFamily,
        adapterId: "quantumos-proof-carrying-closure",
        adapterVersion: "1",
        outcome,
        scope: { ...problem.scope },
        assumptions: [...problem.assumptions],
        limitations: [
          "this adapter verifies only the supplied normalized QuantumOS evidence snapshot",
          "it does not fetch QuantumOS state, execute rholang, or authenticate GitHub provenance by itself",
          "UNREACHABLE_IN_MODEL means no contradiction was found inside the supplied evidence boundary; it is not a global safety or finality proof",
          "rholang agreement is comparable only when independent perspectives report the same program digest and pre-state",
        ],
        ...(inspection.violations.length > 0
          ? {
              witness: {
                kind: "QUANTUMOS_CLOSURE_CONTRADICTION",
                violations: inspection.violations,
              },
            }
          : inspection.blockers.length > 0
            ? {
                witness: {
                  kind: "QUANTUMOS_CLOSURE_BLOCKERS",
                  blockers: inspection.blockers,
                },
              }
            : {}),
        metrics: {
          closureKind: problem.payload.closure.kind,
          perspectives: problem.payload.perspectives.length,
          distinctPerspectives: distinct(
            problem.payload.perspectives.map((item) => item.perspectiveId),
          ).length,
          sourceCommit: problem.payload.source.commit,
        },
      };
    },
  };
}

export function createQuantumOsClosureProblem(
  observation: QuantumOsClosureObservation,
): VerificationProblem {
  return {
    id: `quantumos-closure:${observation.closure.id}`,
    modelFamily: "collective-closure-evidence/v1",
    scope: {
      subject: "QuantumOS proof-carrying closure",
      repository: observation.source.repository,
      commit: observation.source.commit,
      closureId: observation.closure.id,
      closureKind: observation.closure.kind,
      claimDigest: observation.closure.claimDigest,
      scopeDigest: observation.closure.scopeDigest,
      assumptionsDigest: observation.closure.assumptionsDigest,
    },
    assumptions: [
      "the supplied evidence belongs to the declared QuantumOS closure",
      "perspective identities are independent only when the caller has established that independence",
      "signatureVerified means the caller validated the signed envelope before normalization",
      "for rholang, equal program and pre-state digests are required before post-state comparison",
    ],
    payload: observation,
  };
}

export const QUANTUMOS_MATCHING_RHOLANG_FIXTURE: QuantumOsClosureObservation = {
  schema: "quantumos-closure-observation/v1",
  source: {
    repository: QUANTUMOS_REFERENCE_SOURCE.repository,
    commit: QUANTUMOS_REFERENCE_SOURCE.commit,
  },
  closure: {
    id: "demo-rholang-closure",
    kind: "RHOLANG",
    claimDigest: "sha256:claim-demo",
    scopeDigest: "sha256:scope-demo",
    assumptionsDigest: "sha256:assumptions-demo",
  },
  perspectives: [
    {
      perspectiveId: "rnode-a",
      evidenceDigest: "sha256:evidence-a",
      signatureVerified: true,
      programDigest: "sha256:program",
      preStateHash: "state:before",
      postStateHash: "state:after",
      resultDigest: "sha256:result",
    },
    {
      perspectiveId: "rnode-b",
      evidenceDigest: "sha256:evidence-b",
      signatureVerified: true,
      programDigest: "sha256:program",
      preStateHash: "state:before",
      postStateHash: "state:after",
      resultDigest: "sha256:result",
    },
  ],
};
