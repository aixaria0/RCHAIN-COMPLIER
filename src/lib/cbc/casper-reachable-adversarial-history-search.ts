import { digest } from "../compiler/hash.ts";
import { buildCausallyValidDAG, type ConcreteDagFixture } from "./casper-concrete-dag.ts";
import { traceCasperFinalizerSemantics } from "./casper-finalizer-semantics.ts";
import { analyzeUpstreamReachability } from "./casper-upstream-reachability.ts";

const BONDED = ["v0", "v1", "v2", "v3"];
const TOP_LAYER = ["a3", "b3", "c3", "d3"] as const;
const CONTROL = [...TOP_LAYER];

export interface M27Candidate {
  justifications: string[];
  distanceFromControl: number;
  distinctMinimumSenders: number;
  minimumMessageSenders: string[];
  currentCountGate: boolean;
  senderCoverage: boolean;
  reachable: boolean;
  finalized: boolean;
  supportingStake: number;
  classification: "VALID_CONTROL" | "UNDER_CARDINALITY" | "OTHER";
}

export interface M27SearchReport {
  milestone: "M27";
  upstreamRevision: "rchain-community/rchain-rust@d92f0787a6096cd6d79864ec2d7c1dd9b6912d0b";
  searchSpace: {
    sourceJustificationPool: string[];
    candidateCount: number;
    reachableCount: number;
    currentCountGateCount: number;
    senderCompleteCount: number;
    underCardinalityCount: number;
    exactlyThreeSenderCount: number;
  };
  minimalAdversarialDistance: number;
  minimalFinalizingDistance: number;
  minimalWitnesses: M27Candidate[];
  minimalFinalizingWitnesses: M27Candidate[];
  deterministic: boolean;
  digest: string;
}

function replaceJustifications(
  fixture: ConcreteDagFixture,
  justifications: string[],
): ConcreteDagFixture {
  return {
    ...fixture,
    justifications: [...justifications],
  };
}

function distanceFromControl(justifications: string[]): number {
  return justifications.reduce(
    (distance, id, index) => distance + (id === CONTROL[index] ? 0 : 1),
    0,
  );
}

function classify(
  fixture: ConcreteDagFixture,
  justifications: string[],
): M27Candidate {
  const reachability = analyzeUpstreamReachability(fixture);
  const trace = traceCasperFinalizerSemantics({
    bondsMap: fixture.bondsMap,
    messages: fixture.messages,
    justifications,
  });
  const senderCoverage =
    BONDED.every((sender) => trace.uniqueMinimumMessageSenders.includes(sender)) &&
    trace.uniqueMinimumMessageSenders.length === BONDED.length;

  return {
    justifications: [...justifications],
    distanceFromControl: distanceFromControl(justifications),
    distinctMinimumSenders: trace.uniqueMinimumMessageSenders.length,
    minimumMessageSenders: [...trace.minimumMessageSenders],
    currentCountGate: trace.checkMinMessagesPassed,
    senderCoverage,
    reachable: reachability.reachable && justifications.every((id) =>
      fixture.messages.some((message) => message.id === id),
    ),
    finalized: trace.finalized,
    supportingStake: trace.supportingStake,
    classification: senderCoverage
      ? "VALID_CONTROL"
      : trace.checkMinMessagesPassed && trace.uniqueMinimumMessageSenders.length < BONDED.length
        ? "UNDER_CARDINALITY"
        : "OTHER",
  };
}

function enumerate(pool: readonly string[], length: number): string[][] {
  const out: string[][] = [];

  const visit = (prefix: string[]): void => {
    if (prefix.length === length) {
      out.push([...prefix]);
      return;
    }
    for (const id of pool) visit([...prefix, id]);
  };

  visit([]);
  return out;
}

function canonicalCandidateKey(candidate: M27Candidate): string {
  return [
    candidate.distanceFromControl,
    candidate.justifications.join(","),
  ].join("|");
}

function computeReport(): M27SearchReport {
  const base = buildCausallyValidDAG();
  const candidates = enumerate(TOP_LAYER, CONTROL.length).map((justifications) =>
    classify(replaceJustifications(base, justifications), justifications),
  );

  const reachable = candidates.filter((candidate) => candidate.reachable);
  const countGate = candidates.filter((candidate) => candidate.currentCountGate);
  const senderComplete = candidates.filter((candidate) => candidate.senderCoverage);
  const underCardinality = candidates.filter(
    (candidate) => candidate.classification === "UNDER_CARDINALITY",
  );
  const exactlyThreeSender = underCardinality.filter(
    (candidate) => candidate.distinctMinimumSenders === 3,
  );
  const finalizingUnderCardinality = underCardinality.filter((candidate) => candidate.finalized);

  const minimalAdversarialDistance = Math.min(
    ...underCardinality.map((candidate) => candidate.distanceFromControl),
  );
  const minimalFinalizingDistance = Math.min(
    ...finalizingUnderCardinality.map((candidate) => candidate.distanceFromControl),
  );

  const minimalWitnesses = underCardinality
    .filter((candidate) => candidate.distanceFromControl === minimalAdversarialDistance)
    .sort((a, b) => canonicalCandidateKey(a).localeCompare(canonicalCandidateKey(b)))
    .slice(0, 12);

  const minimalFinalizingWitnesses = finalizingUnderCardinality
    .filter((candidate) => candidate.distanceFromControl === minimalFinalizingDistance)
    .sort((a, b) => canonicalCandidateKey(a).localeCompare(canonicalCandidateKey(b)))
    .slice(0, 12);

  const reportBody = {
    milestone: "M27",
    upstreamRevision: "rchain-community/rchain-rust@d92f0787a6096cd6d79864ec2d7c1dd9b6912d0b",
    searchSpace: {
      sourceJustificationPool: [...TOP_LAYER],
      candidateCount: candidates.length,
      reachableCount: reachable.length,
      currentCountGateCount: countGate.length,
      senderCompleteCount: senderComplete.length,
      underCardinalityCount: underCardinality.length,
      exactlyThreeSenderCount: exactlyThreeSender.length,
    },
    minimalAdversarialDistance,
    minimalFinalizingDistance,
    minimalWitnesses,
    minimalFinalizingWitnesses,
    deterministic: true,
  };

  return {
    ...reportBody,
    digest: digest([JSON.stringify(reportBody)]),
  };
}

export function runM27ReachabilityConstrainedSearch(): M27SearchReport {
  const first = computeReport();
  const second = computeReport();

  return {
    ...first,
    deterministic: first.digest === second.digest,
  };
}
