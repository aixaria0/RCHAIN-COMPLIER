import { defaultStakeMatrix, runStakeMatrix } from "./casper-stake-matrix.ts";

describe("stake-aware Casper matrix", () => {
  it("classifies the strict threshold boundary separately from super-majority", () => {
    const results = runStakeMatrix(defaultStakeMatrix());
    expect(results.find((x) => x.name === "exact-two-thirds")?.hypothesis).toBe("THRESHOLD_BOUNDARY");
    expect(results.find((x) => x.name === "strictly-over-two-thirds")?.hypothesis).toBe("FULL_COVERAGE");
  });

  it("finds stake/coverage tension without calling it a protocol failure", () => {
    const result = runStakeMatrix(defaultStakeMatrix()).find((x) => x.name === "high-stake-incomplete-coverage");
    expect(result?.superMajority).toBe(true);
    expect(result?.messageCoverage).toBe(false);
    expect(result?.hypothesis).toBe("STAKE_COVERAGE_TENSION");
  });

  it("keeps a fully covered super-majority distinguishable", () => {
    const result = runStakeMatrix(defaultStakeMatrix()).find((x) => x.name === "high-stake-full-coverage");
    expect(result?.hypothesis).toBe("FULL_COVERAGE");
  });
});
