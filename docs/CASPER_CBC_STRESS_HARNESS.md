# Casper CBC Stress Harness

## Scope

This is a synthetic-first research harness for stress-testing Casper CBC-shaped validator behaviour. It is deliberately separated from the live RChain network and does not claim historical protocol compatibility.

## M1 model

The first slice provides:

- deterministic validator state and event emission;
- network partitions, delayed cross-partition delivery, and deterministic reordering;
- explicit validator equivocation events;
- proposition selection through the repository's existing deterministic Proposition Calculus;
- replay digests and convergence traces;
- machine-readable evidence suitable for later Observatory views.

## Scenario shape

```text
validators
   ↓
validator events
   ├── partition / delay / reorder
   ├── equivocation
   ↓
propositions + justifications
   ↓
deterministic convergence
   ↓
replay digest
   ↓
stress result + evidence
```

The harness intentionally reports what the synthetic execution produced. It does not infer live Casper CBC safety or liveness properties from the fixture alone.

## Run

```bash
npm run demo:cbc-stress
```

The test suite also verifies baseline replay determinism, partition divergence evidence, and explicit equivocation detection.

## Next

M2 will add a scenario matrix and fragility measurements across validator counts, partition sizes, delay schedules, equivocation patterns, and replay comparisons.
