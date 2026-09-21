export interface UpstreamGateObservation {
  bondedValidators: string[];
  minimumMessageSenders: string[];
}

export interface UpstreamGateTrace {
  bondedCount: number;
  minimumMessageCount: number;
  checkMinMessagesPassed: boolean;
  calculateFringeReachable: boolean;
  gate: "CHECK_MIN_MESSAGES" | "CALCULATE_FRINGE";
  conclusion:
    | "BLOCKED_BEFORE_FRINGE"
    | "FRINGE_STAGE_REACHABLE";
}

/**
 * Mirrors the ordering in rchain-community/rchain-rust's Finalizer::next_fringe:
 * check_min_messages() gates calculate_fringe(). This is a control-flow probe,
 * not a reimplementation of the upstream finalizer.
 */
export function traceUpstreamFinalizerGate(
  observation: UpstreamGateObservation,
): UpstreamGateTrace {
  const bondedCount = new Set(observation.bondedValidators).size;
  const minimumMessageCount = new Set(observation.minimumMessageSenders).size;
  const checkMinMessagesPassed = minimumMessageCount === bondedCount;

  return {
    bondedCount,
    minimumMessageCount,
    checkMinMessagesPassed,
    calculateFringeReachable: checkMinMessagesPassed,
    gate: checkMinMessagesPassed ? "CALCULATE_FRINGE" : "CHECK_MIN_MESSAGES",
    conclusion: checkMinMessagesPassed
      ? "FRINGE_STAGE_REACHABLE"
      : "BLOCKED_BEFORE_FRINGE",
  };
}
