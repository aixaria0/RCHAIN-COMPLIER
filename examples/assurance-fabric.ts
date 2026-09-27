import {
  buildAssuranceCertificate,
  possibilityCheckFromSearch,
  searchWeightedPossibility,
} from "../src/lib/compiler/index.ts";

const search = searchWeightedPossibility<number>({
  initial: 0,
  stateKey: String,
  isGoal: (state) => state === 3,
  expand: (state) =>
    state < 3 ? [{ to: state + 1, label: "counterfactual-step", cost: 1 }] : [],
});

const possibility = possibilityCheckFromSearch({
  id: "demo_counterfactual",
  description: "Demonstrate a deterministic minimum-cost counterfactual witness.",
  result: search,
  expected: "REACHABLE",
});

// This deliberately remains BLOCKED: no live observation, conformance, or
// recovery evidence is supplied. The demo shows fail-closed behavior.
const certificate = buildAssuranceCertificate({
  issuedAt: "2026-09-27T00:00:00Z",
    freshness: { maxObservationAgeMs: 60_000 },
  release: {
    repository: "aixaria0/RCHAIN-COMPLIER",
    commit: "demo",
  },
  network: {
    genesis: "demo-genesis",
  },
  records: [],
  checks: [possibility],
});

console.log(JSON.stringify(certificate, null, 2));
