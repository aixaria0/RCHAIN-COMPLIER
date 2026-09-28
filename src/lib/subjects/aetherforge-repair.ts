import {
  compileRepair,
  type RepairAdapter,
  type RepairProblem,
  type RepairTransition,
} from "../compiler/repair-compiler.ts";
import { compileVerification } from "../compiler/verification-compiler.ts";
import {
  AETHERFORGE_FROZEN_SNAPSHOT,
  createAetherForgeAdapter,
  createAetherForgeProblem,
  type AetherForgeSnapshot,
} from "./aetherforge.ts";

interface AetherForgeRepairState {
  snapshot: AetherForgeSnapshot;
}

interface NumericRepair {
  path: string;
  before: number;
  after: number;
  apply(snapshot: AetherForgeSnapshot): void;
}

function cloneSnapshot(snapshot: AetherForgeSnapshot): AetherForgeSnapshot {
  return structuredClone(snapshot);
}

function numericRepairs(snapshot: AetherForgeSnapshot): NumericRepair[] {
  const baseline = AETHERFORGE_FROZEN_SNAPSHOT;
  const repairs: NumericRepair[] = [];

  const add = (
    path: string,
    before: number,
    after: number,
    apply: (candidate: AetherForgeSnapshot) => void,
  ) => {
    if (!Object.is(before, after)) repairs.push({ path, before, after, apply });
  };

  add("gamma", snapshot.gamma, baseline.gamma, (candidate) => {
    candidate.gamma = baseline.gamma;
  });
  add("rhoC", snapshot.rhoC, baseline.rhoC, (candidate) => {
    candidate.rhoC = baseline.rhoC;
  });

  const faceLength = Math.min(snapshot.faceAreas.length, baseline.faceAreas.length);
  for (let index = 0; index < faceLength; index += 1) {
    const current = snapshot.faceAreas[index]!;
    const expected = baseline.faceAreas[index]!;
    add(`faceAreas[${index}].j`, current.j, expected.j, (candidate) => {
      candidate.faceAreas[index]!.j = expected.j;
    });
    add(`faceAreas[${index}].value`, current.value, expected.value, (candidate) => {
      candidate.faceAreas[index]!.value = expected.value;
    });
  }

  const bounceLength = Math.min(snapshot.bounce.length, baseline.bounce.length);
  for (let index = 0; index < bounceLength; index += 1) {
    const current = snapshot.bounce[index]!;
    const expected = baseline.bounce[index]!;
    add(`bounce[${index}].t`, current.t, expected.t, (candidate) => {
      candidate.bounce[index]!.t = expected.t;
    });
    add(`bounce[${index}].a`, current.a, expected.a, (candidate) => {
      candidate.bounce[index]!.a = expected.a;
    });
    add(`bounce[${index}].rho`, current.rho, expected.rho, (candidate) => {
      candidate.bounce[index]!.rho = expected.rho;
    });
  }

  return repairs;
}

function supportsBoundedSnapshot(snapshot: unknown): snapshot is AetherForgeSnapshot {
  if (!snapshot || typeof snapshot !== "object") return false;
  const candidate = snapshot as Partial<AetherForgeSnapshot>;
  if (
    candidate.schema !== "aetherforge-snapshot/v1" ||
    !Array.isArray(candidate.faceAreas) ||
    !Array.isArray(candidate.bounce) ||
    !candidate.source
  ) {
    return false;
  }

  return (
    candidate.faceAreas.length === AETHERFORGE_FROZEN_SNAPSHOT.faceAreas.length &&
    candidate.bounce.length === AETHERFORGE_FROZEN_SNAPSHOT.bounce.length &&
    candidate.source.repository === AETHERFORGE_FROZEN_SNAPSHOT.source.repository &&
    candidate.source.commit === AETHERFORGE_FROZEN_SNAPSHOT.source.commit &&
    candidate.source.file === AETHERFORGE_FROZEN_SNAPSHOT.source.file &&
    candidate.source.blobSha === AETHERFORGE_FROZEN_SNAPSHOT.source.blobSha
  );
}

export function createAetherForgeRepairAdapter(): RepairAdapter {
  return {
    id: "aetherforge-frozen-snapshot-repair",
    version: "1",
    modelFamily: "numeric-scientific-model/v1",
    priority: 50,
    supports(problem) {
      return supportsBoundedSnapshot(problem.originalProblem.payload);
    },
    createSearch(problem) {
      const initialSnapshot = cloneSnapshot(
        problem.originalProblem.payload as AetherForgeSnapshot,
      );

      return {
        initial: { snapshot: initialSnapshot } satisfies AetherForgeRepairState,
        stateKey(state) {
          return JSON.stringify((state as AetherForgeRepairState).snapshot);
        },
        expand(state): RepairTransition[] {
          const current = (state as AetherForgeRepairState).snapshot;
          return numericRepairs(current).map((repair) => {
            const next = cloneSnapshot(current);
            repair.apply(next);
            return {
              to: { snapshot: next } satisfies AetherForgeRepairState,
              label: `restore:${repair.path}`,
              cost: [1, Math.abs(repair.before - repair.after)],
              metadata: {
                path: repair.path,
                before: repair.before,
                after: repair.after,
                source: "pinned-aetherforge-snapshot",
              },
            };
          });
        },
        toVerificationProblem(state) {
          return createAetherForgeProblem(
            (state as AetherForgeRepairState).snapshot,
          );
        },
        maxStates: 1_000,
        limitations: [
          "allowed interventions only restore numeric fields to the pinned AETHER FORGE snapshot",
          "array shape and source identity are fixed; structural edits are outside this repair model",
          "repair success establishes internal conformance only, not physical correctness",
        ],
      };
    },
  };
}

export function createAetherForgeRepairProblem(
  snapshot: AetherForgeSnapshot,
): RepairProblem {
  if (!supportsBoundedSnapshot(snapshot)) {
    throw new Error("AETHER FORGE repair requires the pinned snapshot shape and source identity");
  }

  const originalProblem = createAetherForgeProblem(snapshot);
  const compiled = compileVerification(originalProblem, [createAetherForgeAdapter()]);
  if (
    compiled.status !== "COMPILED" ||
    compiled.artifact === null ||
    compiled.artifact.outcome !== "WITNESS_FOUND"
  ) {
    throw new Error("AETHER FORGE repair requires an original WITNESS_FOUND artifact");
  }

  return {
    id: "aetherforge-minimal-numeric-repair",
    modelFamily: originalProblem.modelFamily,
    originalProblem,
    originalArtifact: compiled.artifact,
    objectives: ["numeric_fields_changed", "absolute_numeric_delta"],
    payload: {
      repairSpace: "restore-numeric-field-from-pinned-snapshot/v1",
    },
  };
}

export function repairAetherForgeSnapshot(snapshot: AetherForgeSnapshot) {
  return compileRepair(
    createAetherForgeRepairProblem(snapshot),
    [createAetherForgeRepairAdapter()],
    createAetherForgeAdapter(),
  );
}
