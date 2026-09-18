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

The test suite verifies baseline replay determinism, partition divergence evidence, explicit equivocation detection, and the M2 fragility invariants. The stress demo now emits an invariant summary, counterexample count, and report digest for each scenario.

## M2 — Counterexample / Fragility Engine

M2 turns a stress result into an explicit invariant report. Each scenario is checked for replay determinism, baseline convergence where applicable, equivocation detection, and partition evidence.

A failed invariant becomes a structured counterexample with a failed round, cause, precondition, transition, conflict core, minimal replay scenario, and replay digest. The shrinker is deterministic and intentionally small; it is a reproducer generator, not a proof that the production protocol is vulnerable.

The stress demo includes a partition+reorder case so ordering pressure is represented in the matrix without changing the synthetic-first boundary.

## Next

The next research step is to feed faithful upstream block/DAG observations into this same evidence path and then reproduce any candidate fragility against the upstream implementation or formal specification.
