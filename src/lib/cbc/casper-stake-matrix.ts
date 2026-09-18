import { analyzeCasperFinality, type FinalityAnalysis } from "./casper-finality.ts";

export interface StakeMatrixCase {
  name: string;
  bonds: Record<string, number>;
  support: string[];
  minimumMessageSenders: string[];
}

export interface StakeMatrixResult extends FinalityAnalysis {
  name: string;
  hypothesis: "STAKE_COVERAGE_TENSION" | "THRESHOLD_BOUNDARY" | "FULL_COVERAGE" | "NO_SUPERMAJORITY";
}

export function classifyStakeCase(name: string, analysis: FinalityAnalysis): StakeMatrixResult["hypothesis"] {
  if (analysis.superMajority && !analysis.messageCoverage) return "STAKE_COVERAGE_TENSION";
  if (!analysis.superMajority && analysis.supportingStake * 3 === analysis.totalStake * 2) return "THRESHOLD_BOUNDARY";
  if (analysis.superMajority && analysis.messageCoverage) return "FULL_COVERAGE";
  return "NO_SUPERMAJORITY";
}

export function runStakeMatrix(cases: StakeMatrixCase[]): StakeMatrixResult[] {
  return cases.map(({ name, ...observation }) => {
    const analysis = analyzeCasperFinality(observation);
    return { name, ...analysis, hypothesis: classifyStakeCase(name, analysis) };
  });
}

export function defaultStakeMatrix(): StakeMatrixCase[] {
  return [
    {
      name: "exact-two-thirds",
      bonds: { v0: 2, v1: 1 },
      support: ["v0"],
      minimumMessageSenders: ["v0", "v1"],
    },
    {
      name: "strictly-over-two-thirds",
      bonds: { v0: 3, v1: 1 },
      support: ["v0"],
      minimumMessageSenders: ["v0", "v1"],
    },
    {
      name: "high-stake-incomplete-coverage",
      bonds: { v0: 70, v1: 10, v2: 10, v3: 10 },
      support: ["v0"],
      minimumMessageSenders: ["v0"],
    },
    {
      name: "high-stake-full-coverage",
      bonds: { v0: 70, v1: 10, v2: 10, v3: 10 },
      support: ["v0"],
      minimumMessageSenders: ["v0", "v1", "v2", "v3"],
    },
    {
      name: "balanced-no-supermajority",
      bonds: { v0: 25, v1: 25, v2: 25, v3: 25 },
      support: ["v0", "v1"],
      minimumMessageSenders: ["v0", "v1", "v2", "v3"],
    },
  ];
}
