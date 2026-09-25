export interface UpstreamGateObservation {
  bondedValidators: string[];
  minimumMessageSenders: string[];
}

export interface UpstreamGateTrace {
  bondedCount: number;
  minimumMessageCount: number;
  distinctMinimumMessageCount: number;
  checkMinMessagesPassed: boolean;
  calculateFringeReachable: boolean;
  gate: "CHECK_MIN_MESSAGES" | "CALCULATE_FRINGE";
  conclusion:
    | "BLOCKED_BEFORE_FRINGE"
    | "FRINGE_STAGE_REACHABLE";
}

/**
 * Mirrors the ordering and cardinality rule in
 * rchain-community/rchain-rust's Finalizer::next_fringe at
 * d92f0787a6096cd6d79864ec2d7c1dd9b6912d0b:
 *
 *   min_msgs.len() == bonds_map.len()
 *
 * This is deliberately a count-of-entries check. Sender identity multiplicity
 * is observed separately because later upstream stages key data by sender.
 * This module is a control-flow probe, not a reimplementation of the upstream
 * finalizer.
 */
export function traceUpstreamFinalizerGate(
  observation: UpstreamGateObservation,
): UpstreamGateTrace {
  const bondedCount = new Set(observation.bondedValidators).size;
  const minimumMessageCount = observation.minimumMessageSenders.length;
  const distinctMinimumMessageCount = new Set(observation.minimumMessageSenders).size;
  const checkMinMessagesPassed = minimumMessageCount === bondedCount;

  return {
    bondedCount,
    minimumMessageCount,
    distinctMinimumMessageCount,
    checkMinMessagesPassed,
    calculateFringeReachable: checkMinMessagesPassed,
    gate: checkMinMessagesPassed ? "CALCULATE_FRINGE" : "CHECK_MIN_MESSAGES",
    conclusion: checkMinMessagesPassed
      ? "FRINGE_STAGE_REACHABLE"
      : "BLOCKED_BEFORE_FRINGE",
  };
}
