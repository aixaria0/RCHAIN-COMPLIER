import { digest } from "../compiler/hash.ts";
import type { RealityBet, RealityProposition } from "../compiler/proposition-calculus.ts";

export interface CasperBlockObservation {
  blockHash: string;
  sender: string;
  blockNum: number;
  seqNum: number;
  justifications: string[];
  bondsMap: Record<string, number>;
  fringe: string[];
  preStateHash: string;
  postStateHash: string;
}

export interface CasperObservationEvidence {
  bet: RealityBet;
  proposition: RealityProposition;
  observationDigest: string;
}

/**
 * Boundary adapter for fields represented by the current RChain Casper/Rust
 * implementation. It is intentionally an observation boundary, not a parser
 * or fork of upstream consensus code.
 */
export function toCasperObservationEvidence(
  observation: CasperBlockObservation,
): CasperObservationEvidence {
  const justifications = [...new Set(observation.justifications)].sort();
  const bet: RealityBet = {
    source: observation.sender,
    target: `block:${observation.blockNum}/seq:${observation.seqNum}`,
    claim: observation.blockHash,
    belief: observation.bondsMap[observation.sender] ?? 0,
    justification: justifications,
  };

  const proposition: RealityProposition = {
    id: `block:${observation.blockHash}`,
    statement: `block ${observation.blockHash} observed at height ${observation.blockNum}`,
    requires: justifications.map((hash) => `block:${hash}`),
  };

  const observationDigest = digest([
    JSON.stringify({
      ...observation,
      justifications,
      fringe: [...observation.fringe].sort(),
      bondsMap: Object.fromEntries(
        Object.entries(observation.bondsMap).sort(([a], [b]) => a.localeCompare(b)),
      ),
    }),
  ]);

  return { bet, proposition, observationDigest };
}
