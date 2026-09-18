import { digest } from "./hash.ts";
import type { RealityBet, RealityProposition } from "./proposition-calculus.ts";

export interface CasperBlockObservation {
  blockHash: string;
  sender: string;
  seqNum: number;
  blockNum: number;
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
 * Boundary adapter for the fields exposed by the RChain Casper/Rust model.
 *
 * This is an observation schema, not a parser for the upstream repository.
 * The field names intentionally follow the current Rust/Scala Casper concepts:
 * block hash, sender, sequence number, justifications, bonds map, fringe and
 * pre/post state hashes.
 */
export function toCasperObservationEvidence(
  observation: CasperBlockObservation,
): CasperObservationEvidence {
  const justifications = [...new Set(observation.justifications)].sort();
  const bet: RealityBet = {
    source: observation.sender,
    target: `block-${observation.blockNum}/seq-${observation.seqNum}`,
    claim: observation.blockHash,
    belief: observation.bondsMap[observation.sender] ?? 0,
    justification: justifications,
  };

  const proposition: RealityProposition = {
    id: `block:${observation.blockHash}`,
    statement: `block ${observation.blockHash} is a valid observation at height ${observation.blockNum}`,
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
