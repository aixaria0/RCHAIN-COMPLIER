export const DEFAULT_LIVENESS_WINDOW = 5;

export type AttestationCandidate =
  | "current-per-height"
  | "naive-same-height"
  | "pace-only"
  | "paced-designated-escape";

export interface AttestationScenario {
  sameHeightRemoteBlocks: number;
  advancingHeightSpan: number;
  livenessWindow?: number;
}

export interface AttestationEvaluation {
  candidate: AttestationCandidate;
  sameHeightRemoteRequests: number;
  advancingHeightRequests: number;
  localEscapeRequests: number;
  c192RestedRoundCanAdvance: boolean;
  c171SameHeightBurstBounded: boolean;
  c171AdvancingRateBounded: boolean;
  passesC192: boolean;
  passesC171: boolean;
  passesPairedGate: boolean;
  bound: string;
  prerequisites: string[];
  limitations: string[];
}

function positiveInteger(value: number, name: string) {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${name} must be a positive integer`);
}

export function pacedRequestCount(heightSpan: number, livenessWindow = DEFAULT_LIVENESS_WINDOW) {
  positiveInteger(heightSpan, "heightSpan");
  positiveInteger(livenessWindow, "livenessWindow");
  // First opportunity is due; afterwards the node must remain quiet for more than
  // LIVENESS_WINDOW heights before becoming due again.
  return 1 + Math.floor((heightSpan - 1) / (livenessWindow + 1));
}

export function evaluateAttestationCandidate(
  candidate: AttestationCandidate,
  scenario: AttestationScenario,
): AttestationEvaluation {
  const window = scenario.livenessWindow ?? DEFAULT_LIVENESS_WINDOW;
  positiveInteger(scenario.sameHeightRemoteBlocks, "sameHeightRemoteBlocks");
  positiveInteger(scenario.advancingHeightSpan, "advancingHeightSpan");
  positiveInteger(window, "livenessWindow");

  const paced = pacedRequestCount(scenario.advancingHeightSpan, window);
  const commonLimitations = [
    "Abstract sequence evaluator only; it does not modify or execute rchain-rust.",
    "Passing this gate is necessary evidence for a candidate, not proof of protocol safety or production liveness.",
    "A candidate that passes must still be injected into the pinned upstream checkout and then measured on controlled multi-validator devnet arms.",
  ];

  switch (candidate) {
    case "current-per-height": {
      const sameHeightRemoteRequests = 1;
      const advancingHeightRequests = scenario.advancingHeightSpan;
      const c192RestedRoundCanAdvance = false;
      const c171SameHeightBurstBounded = true;
      const c171AdvancingRateBounded = false;
      return {
        candidate,
        sameHeightRemoteRequests,
        advancingHeightRequests,
        localEscapeRequests: 0,
        c192RestedRoundCanAdvance,
        c171SameHeightBurstBounded,
        c171AdvancingRateBounded,
        passesC192: c192RestedRoundCanAdvance,
        passesC171: c171SameHeightBurstBounded && c171AdvancingRateBounded,
        passesPairedGate: false,
        bound: "one remote request per new height; rate still follows every advancing height",
        prerequisites: [],
        limitations: commonLimitations,
      };
    }

    case "naive-same-height": {
      const sameHeightRemoteRequests = scenario.sameHeightRemoteBlocks;
      const advancingHeightRequests = scenario.advancingHeightSpan;
      const c192RestedRoundCanAdvance = scenario.sameHeightRemoteBlocks > window;
      const c171SameHeightBurstBounded = false;
      const c171AdvancingRateBounded = false;
      return {
        candidate,
        sameHeightRemoteRequests,
        advancingHeightRequests,
        localEscapeRequests: 0,
        c192RestedRoundCanAdvance,
        c171SameHeightBurstBounded,
        c171AdvancingRateBounded,
        passesC192: c192RestedRoundCanAdvance,
        passesC171: false,
        passesPairedGate: false,
        bound: "remote request count scales with every same-height block and every advancing height",
        prerequisites: [],
        limitations: [
          ...commonLimitations,
          "This models the known-bad > to >= relaxation: it can feed the proposer escape by fan-out, but reopens the C171 storm path.",
        ],
      };
    }

    case "pace-only": {
      const sameHeightRemoteRequests = 1;
      const advancingHeightRequests = paced;
      const c192RestedRoundCanAdvance = false;
      const c171SameHeightBurstBounded = true;
      const c171AdvancingRateBounded = true;
      return {
        candidate,
        sameHeightRemoteRequests,
        advancingHeightRequests,
        localEscapeRequests: 0,
        c192RestedRoundCanAdvance,
        c171SameHeightBurstBounded,
        c171AdvancingRateBounded,
        passesC192: false,
        passesC171: true,
        passesPairedGate: false,
        bound: `at most one remote request every ${window + 1} visible height advances per node`,
        prerequisites: [
          "The pace term must apply while quorum is reachable; the current upstream guard does not impose that bound in the ordinary all-live case.",
        ],
        limitations: [
          ...commonLimitations,
          "Tip-relative quiet cannot wake a round whose tip is already frozen; own lag remains zero in the C192 rested-round shape.",
        ],
      };
    }

    case "paced-designated-escape": {
      const sameHeightRemoteRequests = 1;
      const advancingHeightRequests = paced;
      // The current proposer escape is taken only after LIVENESS_WINDOW declined
      // requests. A node-local driver therefore needs a bounded window+1 attempts,
      // owned by exactly one deterministic validator for that stalled round.
      const localEscapeRequests = window + 1;
      const c192RestedRoundCanAdvance = true;
      const c171SameHeightBurstBounded = true;
      const c171AdvancingRateBounded = true;
      return {
        candidate,
        sameHeightRemoteRequests,
        advancingHeightRequests,
        localEscapeRequests,
        c192RestedRoundCanAdvance,
        c171SameHeightBurstBounded,
        c171AdvancingRateBounded,
        passesC192: true,
        passesC171: true,
        passesPairedGate: true,
        bound:
          `remote pace <= 1 request per ${window + 1} visible height advances per node; ` +
          `stalled-round escape <= ${window + 1} local requests owned by one designated validator`,
        prerequisites: [
          "A deterministic round identity or equivalent shared key.",
          "Exactly one deterministic escape owner for a stalled round.",
          "A node-local trigger that continues while no new remote height arrives.",
          "The ordinary remote path remains pace-gated so the escape cannot become a second storm source.",
        ],
        limitations: [
          ...commonLimitations,
          "The evaluator intentionally does not choose the round key, selector, or timer implementation.",
          "The candidate is not upstream-ready until the exact trigger can be wired without introducing a second consensus-visible rule.",
        ],
      };
    }
  }
}
