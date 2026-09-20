import type { CasperFinalizerObservation } from "./casper-finalizer-observation.ts";
import { traceUpstreamFinalizerGate, type UpstreamGateTrace } from "./casper-upstream-gate.ts";

export interface UpstreamMappedObservation {
  observation: CasperFinalizerObservation;
  gate: UpstreamGateTrace;
}

/**
 * Maps the existing observation boundary into the upstream gate probe.
 * This is deliberately an adapter: it does not execute or reimplement
 * upstream consensus.
 */
export function mapObservationToUpstreamGate(
  observation: CasperFinalizerObservation,
): UpstreamMappedObservation {
  return {
    observation,
    gate: traceUpstreamFinalizerGate({
      bondedValidators: Object.keys(observation.bondsMap),
      minimumMessageSenders: observation.minimumMessageSenders,
    }),
  };
}
