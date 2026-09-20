import { digest } from "../compiler/hash.ts";

export interface StakeMap { [validator: string]: number; }
export interface FinalityObservation {
  bonds: StakeMap;
  support: string[];
  minimumMessageSenders: string[];
}
export interface FinalityAnalysis {
  bonds: StakeMap;
  support: string[];
  minimumMessageSenders: string[];
  totalStake: number;
  supportingStake: number;
  thresholdNumerator: number;
  thresholdDenominator: number;
  superMajority: boolean;
  messageCoverage: boolean;
  coveredBondedValidators: string[];
  missingBondedValidators: string[];
  extraSenders: string[];
  digest: string;
}

/**
 * Pure probe of two upstream finalizer conditions:
 * 1. Law 14 uses a strict > 2/3 stake threshold.
 * 2. check_min_messages requires one minimum message for every bonded sender.
 *
 * This exposes the conditions for deterministic adversarial replay; it does not
 * implement consensus or claim a protocol-level finding.
 */
export function analyzeCasperFinality(observation: FinalityObservation): FinalityAnalysis {
  const bonds = Object.fromEntries(
    Object.entries(observation.bonds)
      .filter(([, stake]) => Number.isFinite(stake) && stake >= 0)
      .sort(([a], [b]) => a.localeCompare(b)),
  );
  const bonded = Object.keys(bonds);
  const support = [...new Set(observation.support)].sort();
  const minimum = [...new Set(observation.minimumMessageSenders)].sort();
  const totalStake = bonded.reduce((sum, validator) => sum + bonds[validator]!, 0);
  const supportingStake = support.reduce((sum, validator) => sum + (bonds[validator] ?? 0), 0);
  const coveredBondedValidators = minimum.filter((validator) => validator in bonds);
  const missingBondedValidators = bonded.filter((validator) => !minimum.includes(validator));
  const extraSenders = minimum.filter((validator) => !(validator in bonds));
  // Equivalent to upstream is_super_majority: supportingStake * 3 > totalStake * 2.
  const superMajority = supportingStake * 3 > totalStake * 2;
  const messageCoverage = minimum.length === bonded.length;
  return {
    bonds,
    support,
    minimumMessageSenders: minimum,
    totalStake,
    supportingStake,
    thresholdNumerator: 2,
    thresholdDenominator: 3,
    superMajority,
    messageCoverage,
    coveredBondedValidators,
    missingBondedValidators,
    extraSenders,
    digest: digest([JSON.stringify({
      bonds, support, minimum, totalStake, supportingStake,
      superMajority, messageCoverage, missingBondedValidators, extraSenders,
    })]),
  };
}
