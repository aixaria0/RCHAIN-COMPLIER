import type {
  VerificationAdapter,
  VerificationArtifact,
  VerificationProblem,
} from "../compiler/verification-compiler.ts";

export const AETHERFORGE_SOURCE = {
  repository: "aixaria0/aetherforge",
  commit: "f264c530a39acf029070eee077eec96518a84055",
  file: "src/lib/physics.ts",
  blobSha: "4bde80996a058a3c454c2c24654aea00e9873da8",
} as const;

export interface AetherForgeSnapshot {
  schema: "aetherforge-snapshot/v1";
  source: {
    repository: string;
    commit: string;
    file: string;
    blobSha: string;
  };
  gamma: number;
  faceAreas: Array<{ j: number; value: number }>;
  rhoC: number;
  bounce: Array<{ t: number; a: number; rho: number }>;
}

export const AETHERFORGE_FROZEN_SNAPSHOT: AetherForgeSnapshot = {
  schema: "aetherforge-snapshot/v1",
  source: { ...AETHERFORGE_SOURCE },
  gamma: 0.237532957976268,
  faceAreas: [
    { j: 0.5, value: 5.170045537944336 },
    { j: 1, value: 8.442649009944395 },
    { j: 2, value: 14.62309703569477 },
    { j: 10, value: 62.61236081462931 },
    { j: 50, value: 301.46286825913023 },
  ],
  rhoC: 0.40920343683061156,
  bounce: [
    { t: -3, a: 2.1592828834995985, rho: 0.004037216315996671 },
    { t: -2, a: 1.5552986459319043, rho: 0.02891056034483249 },
    { t: -1, a: 1.1555698629817919, rho: 0.1718549439691328 },
    { t: 0, a: 1, rho: 0.40920343683061156 },
    { t: 1, a: 1.1555698629817919, rho: 0.1718549439691328 },
    { t: 2, a: 1.5552986459319043, rho: 0.02891056034483249 },
    { t: 3, a: 2.1592828834995985, rho: 0.004037216315996671 },
  ],
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isSnapshot(value: unknown): value is AetherForgeSnapshot {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AetherForgeSnapshot>;
  return (
    candidate.schema === "aetherforge-snapshot/v1" &&
    isFiniteNumber(candidate.gamma) &&
    isFiniteNumber(candidate.rhoC) &&
    Array.isArray(candidate.faceAreas) &&
    Array.isArray(candidate.bounce) &&
    Boolean(candidate.source)
  );
}

function close(left: number, right: number, tolerance = 1e-12): boolean {
  return Math.abs(left - right) <= tolerance * Math.max(1, Math.abs(left), Math.abs(right));
}

export function inspectAetherForgeSnapshot(snapshot: AetherForgeSnapshot): string[] {
  const violations: string[] = [];

  if (!(snapshot.gamma > 0)) violations.push("gamma must be finite and positive");
  if (!(snapshot.rhoC > 0)) violations.push("rhoC must be finite and positive");

  for (let index = 0; index < snapshot.faceAreas.length; index += 1) {
    const current = snapshot.faceAreas[index]!;
    if (!isFiniteNumber(current.j) || !isFiniteNumber(current.value) || current.j < 0 || current.value < 0) {
      violations.push(`faceAreas[${index}] must contain finite non-negative j/value`);
    }
    if (index > 0) {
      const previous = snapshot.faceAreas[index - 1]!;
      if (!(current.j > previous.j)) violations.push("face-area fixture j values must be strictly increasing");
      if (!(current.value > previous.value)) violations.push("face area must increase across the frozen j samples");
    }
  }

  if (snapshot.bounce.length < 3 || snapshot.bounce.length % 2 === 0) {
    violations.push("bounce fixture must have an odd number of samples with a center point");
    return violations;
  }

  const center = snapshot.bounce[Math.floor(snapshot.bounce.length / 2)]!;
  if (!close(center.t, 0) || !close(center.a, 1) || !close(center.rho, snapshot.rhoC)) {
    violations.push("bounce center must be t=0, a=1, rho=rhoC");
  }

  for (let left = 0; left < Math.floor(snapshot.bounce.length / 2); left += 1) {
    const right = snapshot.bounce.length - 1 - left;
    const a = snapshot.bounce[left]!;
    const b = snapshot.bounce[right]!;
    if (![a.t, a.a, a.rho, b.t, b.a, b.rho].every(isFiniteNumber)) {
      violations.push(`bounce pair ${left}/${right} contains a non-finite value`);
      continue;
    }
    if (!close(a.t, -b.t) || !close(a.a, b.a) || !close(a.rho, b.rho)) {
      violations.push(`bounce symmetry violated at pair ${left}/${right}`);
    }
  }

  return violations;
}

export function createAetherForgeAdapter(): VerificationAdapter {
  return {
    id: "aetherforge-numeric-conformance",
    version: "1",
    modelFamily: "numeric-scientific-model/v1",
    priority: 50,
    supports(problem: VerificationProblem): boolean {
      return isSnapshot(problem.payload);
    },
    verify(problem: VerificationProblem): VerificationArtifact {
      if (!isSnapshot(problem.payload)) {
        throw new Error("aetherforge adapter received an unsupported payload");
      }
      const violations = inspectAetherForgeSnapshot(problem.payload);
      return {
        schema: "verification-artifact/v1",
        problemId: problem.id,
        modelFamily: problem.modelFamily,
        adapterId: "aetherforge-numeric-conformance",
        adapterVersion: "1",
        outcome: violations.length ? "WITNESS_FOUND" : "UNREACHABLE_IN_MODEL",
        scope: { ...problem.scope },
        assumptions: [...problem.assumptions],
        limitations: [
          "checks only deterministic numerical self-consistency of the supplied frozen snapshot",
          "does not establish physical correctness of EPRL, LQC, black-hole entropy, or gravitational-wave models",
          "source pin is recorded as provenance metadata; this adapter does not fetch or authenticate GitHub",
        ],
        ...(violations.length ? { witness: { violations } } : {}),
        metrics: {
          faceAreaSamples: problem.payload.faceAreas.length,
          bounceSamples: problem.payload.bounce.length,
          sourceCommit: problem.payload.source.commit,
          sourceBlob: problem.payload.source.blobSha,
        },
      };
    },
  };
}

export function createAetherForgeProblem(
  snapshot: AetherForgeSnapshot = AETHERFORGE_FROZEN_SNAPSHOT,
): VerificationProblem {
  return {
    id: "aetherforge-physics-numeric-conformance",
    modelFamily: "numeric-scientific-model/v1",
    scope: {
      subject: "AETHER FORGE numerical model snapshot",
      repository: snapshot.source.repository,
      commit: snapshot.source.commit,
      sourceFile: snapshot.source.file,
      sourceBlob: snapshot.source.blobSha,
    },
    assumptions: [
      "the supplied snapshot was produced from the pinned AETHER FORGE source revision",
      "floating-point comparison tolerance is 1e-12 relative to unit scale",
      "the declared fixture samples are the complete scope of this conformance run",
    ],
    payload: snapshot,
  };
}
