import { digest } from "../compiler/hash.ts";
import { replayCbc, simulateCbc, type CbcResult, type CbcScenario } from "./cbc-simulator.ts";
import {
  buildCausallyValidDAG,
  buildDuplicateMinimumMessageDAG,
} from "./casper-concrete-dag.ts";
import {
  traceCasperFinalizerSemantics,
  type CasperFinalizerSemanticsTrace,
} from "./casper-finalizer-semantics.ts";

export const M26_UPSTREAM_REVISION =
  "rchain-community/rchain-rust@d92f0787a6096cd6d79864ec2d7c1dd9b6912d0b";

export interface M26UpstreamGateCase {
  name: "duplicate-missing-sender" | "valid-control" | "non-bonded-replacement";
  minimumMessageSenders: string[];
  bondedSenders: string[];
  currentCountGate: boolean;
  shadowDistinctSenderGate: boolean;
  upstreamSemanticTrace?: CasperFinalizerSemanticsTrace;
}

export interface M26ReplayCase {
  name: "partition-reorder" | "equivocation-4" | "baseline-control";
  scenario: CbcScenario;
  stress: {
    result: CbcResult["result"];
    fixedPoint: boolean;
    equivocationsDetected: number;
    eventCount: number;
    convergenceRounds: number;
    replayDigest: string;
  };
  upstreamPairing: {
    relationship: "PAIRED_EVIDENCE" | "CONTROL";
    claimBoundary: "OBSERVATION_ONLY";
  };
}

export interface M26ReplayReport {
  milestone: "M26";
  upstreamRevision: string;
  coupling: "SYNTHETIC_STRESS_PAIRED_WITH_UPSTREAM_BOUNDARY";
  cases: M26ReplayCase[];
  upstreamGateMatrix: M26UpstreamGateCase[];
  deterministic: boolean;
  digest: string;
}

const BONDS = ["v0", "v1", "v2", "v3"];

function shadowDistinctSenderGate(
  minimumMessageSenders: string[],
  bondedSenders: string[],
): boolean {
  const observed = new Set(minimumMessageSenders);
  const bonded = new Set(bondedSenders);
  return observed.size === bonded.size && [...observed].every((sender) => bonded.has(sender));
}

function currentCountGate(
  minimumMessageSenders: string[],
  bondedSenders: string[],
): boolean {
  return minimumMessageSenders.length === bondedSenders.length;
}

function buildUpstreamGateMatrix(): M26UpstreamGateCase[] {
  const duplicateFixture = traceCasperFinalizerSemantics(buildDuplicateMinimumMessageDAG());
  const validFixture = traceCasperFinalizerSemantics(buildCausallyValidDAG());

  const cases: M26UpstreamGateCase[] = [
    {
      name: "duplicate-missing-sender",
      minimumMessageSenders: ["v0", "v0", "v1", "v2"],
      bondedSenders: BONDS,
      currentCountGate: currentCountGate(["v0", "v0", "v1", "v2"], BONDS),
      shadowDistinctSenderGate: shadowDistinctSenderGate(["v0", "v0", "v1", "v2"], BONDS),
      upstreamSemanticTrace: duplicateFixture,
    },
    {
      name: "valid-control",
      minimumMessageSenders: ["v0", "v1", "v2", "v3"],
      bondedSenders: BONDS,
      currentCountGate: currentCountGate(["v0", "v1", "v2", "v3"], BONDS),
      shadowDistinctSenderGate: shadowDistinctSenderGate(["v0", "v1", "v2", "v3"], BONDS),
      upstreamSemanticTrace: validFixture,
    },
    {
      name: "non-bonded-replacement",
      minimumMessageSenders: ["v0", "v1", "v3", "vx"],
      bondedSenders: BONDS,
      currentCountGate: currentCountGate(["v0", "v1", "v3", "vx"], BONDS),
      shadowDistinctSenderGate: shadowDistinctSenderGate(["v0", "v1", "v3", "vx"], BONDS),
    },
  ];

  return cases;
}

const SCENARIOS: M26ReplayCase["scenario"][] = [
  {
    name: "baseline-control",
    validators: 4,
    byzantine: 0,
  },
  {
    name: "partition-reorder",
    validators: 8,
    byzantine: 0,
    partition: 4,
    delayedRounds: 1,
    reorder: true,
  },
  {
    name: "equivocation-4",
    validators: 8,
    byzantine: 4,
    equivocations: 4,
  },
];

function runStressCase(scenario: CbcScenario): M26ReplayCase {
  const first = simulateCbc(scenario);
  const replay = replayCbc(scenario);
  const isControl = scenario.name === "baseline-control";

  return {
    name: scenario.name as M26ReplayCase["name"],
    scenario,
    stress: {
      result: first.result,
      fixedPoint: first.fixedPoint,
      equivocationsDetected: first.equivocations.length,
      eventCount: first.events.length,
      convergenceRounds: first.convergenceRounds,
      replayDigest: first.replayDigest,
    },
    upstreamPairing: {
      relationship: isControl ? "CONTROL" : "PAIRED_EVIDENCE",
      claimBoundary: "OBSERVATION_ONLY",
    },
  };
}

export function runM26Replay(): M26ReplayReport {
  const firstCases = SCENARIOS.map(runStressCase);
  const replayCases = SCENARIOS.map(runStressCase);
  const deterministic = firstCases.every(
    (first, index) => first.stress.replayDigest === replayCases[index]!.stress.replayDigest,
  );

  const upstreamGateMatrix = buildUpstreamGateMatrix();

  return {
    milestone: "M26",
    upstreamRevision: M26_UPSTREAM_REVISION,
    coupling: "SYNTHETIC_STRESS_PAIRED_WITH_UPSTREAM_BOUNDARY",
    cases: firstCases,
    upstreamGateMatrix,
    deterministic,
    digest: digest([
      JSON.stringify({
        milestone: "M26",
        upstreamRevision: M26_UPSTREAM_REVISION,
        cases: firstCases,
        upstreamGateMatrix,
        deterministic,
      }),
    ]),
  };
}
