import { digest } from "../compiler/hash.ts";
import { analyzeCasperFinality, type FinalityAnalysis, type StakeMap } from "./casper-finality.ts";

export interface CasperFinalizerObservation {
  bondsMap: StakeMap;
  minimumMessageSenders: string[];
  supportObservers: Record<string, string[]>;
}

export interface CasperFinalizerTrace extends FinalityAnalysis {
  minimumMessageSenders: string[];
  support: string[];
  supportObservers: Record<string, string[]>;
  upstreamRule: "MIN_MESSAGE_COUNT_AND_FULL_PARTITION_SUPPORT";
  observationDigest: string;
}

/**
 * Convert a concrete DAG/finalizer observation into the same law probe used
 * by the stake matrix. This is an observation adapter, not a consensus
 * reimplementation.
 */
export function traceCasperFinalizerObservation(
  observation: CasperFinalizerObservation,
): CasperFinalizerTrace {
  const bonded = Object.keys(observation.bondsMap).sort();
  const minimumMessageSenders = [...new Set(observation.minimumMessageSenders)].sort();
  const support = Object.keys(observation.supportObservers)
    .filter((sender) => {
      const observers = new Set(observation.supportObservers[sender] ?? []);
      return bonded.every((validator) => observers.has(validator));
    })
    .sort();

  const analysis = analyzeCasperFinality({
    bonds: observation.bondsMap,
    support,
    minimumMessageSenders,
  });

  const canonicalObservers = Object.fromEntries(
    Object.entries(observation.supportObservers)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([sender, observers]) => [sender, [...new Set(observers)].sort()]),
  );

  return {
    ...analysis,
    minimumMessageSenders,
    support,
    supportObservers: canonicalObservers,
    upstreamRule: "MIN_MESSAGE_COUNT_AND_FULL_PARTITION_SUPPORT",
    observationDigest: digest([
      JSON.stringify({
        bondsMap: Object.fromEntries(
          Object.entries(observation.bondsMap).sort(([a], [b]) => a.localeCompare(b)),
        ),
        minimumMessageSenders,
        supportObservers: canonicalObservers,
        support,
        superMajority: analysis.superMajority,
        messageCoverage: analysis.messageCoverage,
      }),
    ]),
  };
}
