export const RCHAIN_ATTESTATION_REVISION =
  "51935310789a1a75a183ad0af7152e4eef450c88";
export const RCHAIN_LIVENESS_WINDOW = 5;
export const ADVANCING_HEIGHT_SAMPLE = 36;
export const SAME_HEIGHT_BURST = 7;

export type AttestationCandidate =
  | "current-strict-height"
  | "naive-nonstrict-height"
  | "own-quiet-cadence-only"
  | "round-close-only"
  | "round-close-plus-cadence";

export interface ScenarioResult {
  pass: boolean;
  requests: number;
  bound: number;
  advanceRestored?: boolean;
  reason: string;
}

export interface CandidateEvaluation {
  candidate: AttestationCandidate;
  c192: ScenarioResult;
  c171: ScenarioResult & {
    sameHeightBurstRequests: number;
    advancingHeightRequests: number;
  };
  pass: boolean;
}

export interface PairedAttestationEvaluation {
  schema: "rchain-attestation-pair-evaluation/v1";
  upstreamRevision: string;
  livenessWindow: number;
  candidates: CandidateEvaluation[];
  survivors: AttestationCandidate[];
  implementationRequirements: string[];
  claimBoundary: string[];
}

interface SimState {
  lastRemoteHeight: number | null;
  ownLatestHeight: number | null;
  requests: number;
  selfTriggeredRounds: Set<number>;
}

function initialState(ownLatestHeight: number | null = null): SimState {
  return {
    lastRemoteHeight: null,
    ownLatestHeight,
    requests: 0,
    selfTriggeredRounds: new Set<number>(),
  };
}

function usesCadence(candidate: AttestationCandidate) {
  return candidate === "own-quiet-cadence-only" || candidate === "round-close-plus-cadence";
}

function usesRoundClose(candidate: AttestationCandidate) {
  return candidate === "round-close-only" || candidate === "round-close-plus-cadence";
}

function remoteWarranted(
  candidate: AttestationCandidate,
  state: SimState,
  height: number,
): boolean {
  if (candidate === "naive-nonstrict-height")
    return state.lastRemoteHeight === null || height >= state.lastRemoteHeight;

  const newRemoteHeight = state.lastRemoteHeight === null || height > state.lastRemoteHeight;
  if (!newRemoteHeight) return false;
  if (!usesCadence(candidate)) return true;
  if (state.ownLatestHeight === null) return true;
  return height - state.ownLatestHeight > RCHAIN_LIVENESS_WINDOW;
}

function observeRemote(candidate: AttestationCandidate, state: SimState, height: number) {
  if (!remoteWarranted(candidate, state, height)) return false;
  state.lastRemoteHeight = height;
  state.requests += 1;
  // The evaluator assumes a warranted request produces one local attestation at the current tip.
  // This is the smallest model needed to reason about pacing; it is not a network-finality model.
  state.ownLatestHeight = height;
  return true;
}

function selfTriggerAtStalledRound(
  candidate: AttestationCandidate,
  state: SimState,
  roundHeight: number,
) {
  if (!usesRoundClose(candidate) || state.selfTriggeredRounds.has(roundHeight)) return false;
  if (state.ownLatestHeight !== roundHeight) return false;
  state.selfTriggeredRounds.add(roundHeight);
  state.requests += 1;
  // The purpose of the bounded self-trigger is to create the first message above the stalled round.
  state.ownLatestHeight = roundHeight + 1;
  return true;
}

function evaluateC192(candidate: AttestationCandidate): ScenarioResult {
  const state = initialState();
  let remoteRequests = 0;
  for (let i = 0; i < SAME_HEIGHT_BURST; i++)
    if (observeRemote(candidate, state, 1)) remoteRequests += 1;

  let advanceRestored = false;
  if (candidate === "naive-nonstrict-height") {
    // The upstream issue records that >= restores advance only because the burst creates enough proposal
    // requests to drive the proposer's bounded escape. Preserve that as a negative control.
    advanceRestored = remoteRequests > RCHAIN_LIVENESS_WINDOW;
  } else if (selfTriggerAtStalledRound(candidate, state, 1)) {
    advanceRestored = state.ownLatestHeight === 2;
  }

  const boundedBurst = remoteRequests <= 1;
  const boundedTotal = state.requests <= 2;
  const pass = advanceRestored && boundedBurst && boundedTotal;
  return {
    pass,
    requests: state.requests,
    bound: 2,
    advanceRestored,
    reason: pass
      ? "the stalled same-height round gains exactly one bounded self-trigger without reopening burst fan-out"
      : !advanceRestored
        ? "the same-height round still has no bounded path to produce a message above the stalled height"
        : "advance returns only by exceeding the per-round request bound",
  };
}

function evaluateC171(candidate: AttestationCandidate) {
  const sameHeight = initialState(9);
  for (let i = 0; i < SAME_HEIGHT_BURST; i++) observeRemote(candidate, sameHeight, 10);

  const advancing = initialState();
  for (let height = 1; height <= ADVANCING_HEIGHT_SAMPLE; height++)
    observeRemote(candidate, advancing, height);

  const pacedBound = Math.ceil(ADVANCING_HEIGHT_SAMPLE / (RCHAIN_LIVENESS_WINDOW + 1));
  const sameHeightBound = sameHeight.requests <= 1;
  const paced = advancing.requests <= pacedBound;
  const pass = sameHeightBound && paced;
  return {
    pass,
    requests: sameHeight.requests + advancing.requests,
    bound: 1 + pacedBound,
    sameHeightBurstRequests: sameHeight.requests,
    advancingHeightRequests: advancing.requests,
    reason: pass
      ? "same-height fan-out stays single-shot and advancing-height requests are paced by own quiet"
      : !sameHeightBound
        ? "same-height peer fan-out can enqueue more than one request"
        : "advancing remote heights still trigger faster than the own-quiet cadence bound",
  };
}

export function evaluateAttestationCandidates(): PairedAttestationEvaluation {
  const names: AttestationCandidate[] = [
    "current-strict-height",
    "naive-nonstrict-height",
    "own-quiet-cadence-only",
    "round-close-only",
    "round-close-plus-cadence",
  ];
  const candidates = names.map((candidate) => {
    const c192 = evaluateC192(candidate);
    const c171 = evaluateC171(candidate);
    return { candidate, c192, c171, pass: c192.pass && c171.pass };
  });
  return {
    schema: "rchain-attestation-pair-evaluation/v1",
    upstreamRevision: RCHAIN_ATTESTATION_REVISION,
    livenessWindow: RCHAIN_LIVENESS_WINDOW,
    candidates,
    survivors: candidates.filter((c) => c.pass).map((c) => c.candidate),
    implementationRequirements: [
      "retain a single-shot bound for a burst of remote blocks at one height",
      "read this validator's latest message height so advancing-height requests can use the existing own-quiet cadence",
      "observe or derive a deterministic round-boundary/stall signal",
      "permit at most one self-driven escape for a stalled round before a new boundary is observed",
      "keep the evaluator outside consensus/wire validity rules until the Rust implementation passes paired unit and devnet falsifiers",
    ],
    claimBoundary: [
      "This is a deterministic scheduling model over the upstream C192/C171 observations, not a Rust repair.",
      "Passing the model does not prove finality, Byzantine safety, production liveness, or devnet behavior.",
      "A candidate must next be injected into a disposable pinned rchain-rust checkout and pass both upstream-facing falsifiers before any upstream change is proposed.",
    ],
  };
}
