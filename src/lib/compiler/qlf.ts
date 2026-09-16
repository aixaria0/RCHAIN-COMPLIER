import { digest } from "./hash";

export type Phase = "+" | "-";

/**
 * QLF event-level certificate.
 *
 * Faithful to quantum-logical-framework:
 *   toSpectralMode(s) for a pure-phase string is diag(count_pos, count_neg)
 *   toSpectralMode_hermitian — always
 *   spectral_symmetric_eq_scalar_id — when count_pos = count_neg, mode = n · I
 *
 * This certifies the *event*, not RChain finality.
 */
export interface QlfCertificate {
  phaseString: string;
  countPos: number;
  countNeg: number;
  balanced: boolean;
  closed: boolean;
  spectralGap: number;
  symmetric: boolean;
  hermitian: true;
  spectralForm: "c · I" | "diag(p, q)";
  matrix: [[number, number], [number, number]];
  scalar: number | null;
  claim: string;
  notClaimed: string;
  digest: string;
}

export function certify(phases: Phase[], closed: boolean): QlfCertificate {
  const countPos = phases.filter((p) => p === "+").length;
  const countNeg = phases.filter((p) => p === "-").length;
  const balanced = countPos === countNeg;
  const symmetric = balanced;
  const n = countPos;
  const matrix: [[number, number], [number, number]] = [
    [countPos, 0],
    [0, countNeg],
  ];
  return {
    phaseString: phases.join(" "),
    countPos,
    countNeg,
    balanced,
    closed,
    spectralGap: Math.abs(countPos - countNeg),
    symmetric,
    hermitian: true,
    spectralForm: symmetric ? "c · I" : "diag(p, q)",
    matrix,
    scalar: symmetric ? n : null,
    claim: symmetric
      ? "ZFA-balanced phase string; spectral mode is scalar × identity (QLF theorem spectral_symmetric_eq_scalar_id)."
      : "Phase string is not ZFA-balanced; spectral mode is Hermitian but not scalar × identity.",
    notClaimed:
      "QLF does not prove RChain Casper finality, PBFT safety, or that this event is on-chain.",
    digest: digest(["qlf", phases.join(""), String(closed)]),
  };
}

/** Each COMM is a (+ send, − receive) pair — a ZFA-balanced unit. */
export function phasesFromComms(commCount: number, extra: Phase[] = []): Phase[] {
  const out: Phase[] = [];
  for (let i = 0; i < commCount; i++) out.push("+", "-");
  return out.concat(extra);
}
