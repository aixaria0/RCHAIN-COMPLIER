import { analyzeCasperFinality } from "./casper-finality.ts";

describe("Casper finality law probe", () => {
  it("uses a strict greater-than two-thirds stake threshold", () => {
    const exact = analyzeCasperFinality({
      bonds: { v0: 2, v1: 1 },
      support: ["v0"],
      minimumMessageSenders: ["v0", "v1"],
    });
    expect(exact.superMajority).toBe(false);

    const above = analyzeCasperFinality({
      bonds: { v0: 3, v1: 1 },
      support: ["v0"],
      minimumMessageSenders: ["v0", "v1"],
    });
    expect(above.superMajority).toBe(true);
  });

  it("exposes stake/count tension as a replayable observation", () => {
    const analysis = analyzeCasperFinality({
      bonds: { v0: 70, v1: 10, v2: 10, v3: 10 },
      support: ["v0"],
      minimumMessageSenders: ["v0"],
    });
    expect(analysis.superMajority).toBe(true);
    expect(analysis.messageCoverage).toBe(false);
    expect(analysis.missingBondedValidators).toEqual(["v1", "v2", "v3"]);
  });

  it("does not count an unbonded sender as supporting stake", () => {
    const analysis = analyzeCasperFinality({
      bonds: { v0: 60, v1: 40 },
      support: ["v0", "vx"],
      minimumMessageSenders: ["v0", "v1", "vx"],
    });
    expect(analysis.supportingStake).toBe(60);
    expect(analysis.superMajority).toBe(false);
    expect(analysis.extraSenders).toEqual(["vx"]);
  });

  it("is deterministic under input ordering", () => {
    const a = analyzeCasperFinality({
      bonds: { v1: 40, v0: 60 },
      support: ["v1", "v0"],
      minimumMessageSenders: ["v1", "v0"],
    });
    const b = analyzeCasperFinality({
      bonds: { v0: 60, v1: 40 },
      support: ["v0", "v1"],
      minimumMessageSenders: ["v0", "v1"],
    });
    expect(a.digest).toBe(b.digest);
  });
});
