import { traceCasperFinalizerObservation, type CasperFinalizerObservation, type CasperFinalizerTrace } from "./casper-finalizer-observation.ts";

export interface TensionMinimizationResult {
  original: CasperFinalizerTrace;
  minimized: CasperFinalizerTrace;
  removedValidators: string[];
  preservedPredicate: "SUPERMAJORITY_AND_INCOMPLETE_COVERAGE";
}

function isTension(trace: CasperFinalizerTrace): boolean {
  return trace.superMajority && !trace.messageCoverage;
}

function canonicalObservation(observation: CasperFinalizerObservation): CasperFinalizerObservation {
  return {
    bondsMap: Object.fromEntries(
      Object.entries(observation.bondsMap).sort(([a], [b]) => a.localeCompare(b)),
    ),
    minimumMessageSenders: [...new Set(observation.minimumMessageSenders)].sort(),
    supportObservers: Object.fromEntries(
      Object.entries(observation.supportObservers)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([sender, observers]) => [sender, [...new Set(observers)].sort()]),
    ),
  };
}

/**
 * Deterministically remove bonded validators while preserving the concrete
 * tension predicate. This is a reproducer minimizer, not a proof search.
 */
export function minimizeTensionObservation(
  observation: CasperFinalizerObservation,
): TensionMinimizationResult {
  let current = canonicalObservation(observation);
  const original = traceCasperFinalizerObservation(current);
  if (!isTension(original)) {
    throw new Error("minimizeTensionObservation requires a supermajority/incomplete-coverage observation");
  }

  const removedValidators: string[] = [];
  let changed = true;

  while (changed) {
    changed = false;
    for (const validator of Object.keys(current.bondsMap).sort()) {
      if (Object.keys(current.bondsMap).length <= 2) continue;\n      if (!(validator in current.bondsMap)) continue;

      const candidateBonds = { ...current.bondsMap };
      delete candidateBonds[validator];

      const candidateMinimum = current.minimumMessageSenders.filter((sender) => sender !== validator);
      const candidateObservers = Object.fromEntries(
        Object.entries(current.supportObservers)
          .filter(([sender]) => sender !== validator)
          .map(([sender, observers]) => [
            sender,
            observers.filter((observer) => observer !== validator),
          ]),
      );

      const candidate = canonicalObservation({
        bondsMap: candidateBonds,
        minimumMessageSenders: candidateMinimum,
        supportObservers: candidateObservers,
      });
      const trace = traceCasperFinalizerObservation(candidate);

      if (isTension(trace)) {
        current = candidate;
        removedValidators.push(validator);
        changed = true;
        break;
      }
    }
  }

  return {
    original,
    minimized: traceCasperFinalizerObservation(current),
    removedValidators,
    preservedPredicate: "SUPERMAJORITY_AND_INCOMPLETE_COVERAGE",
  };
}
