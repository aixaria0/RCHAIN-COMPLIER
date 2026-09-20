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


## M4 — Stake-aware adversarial matrix

The law probe is now exercised through a small deterministic matrix covering:

- exact 2/3 boundary;
- strictly-over-2/3 support;
- concentrated stake with incomplete message coverage;
- concentrated stake with complete message coverage;
- balanced stake without super-majority.

The matrix classifies observations rather than declaring vulnerabilities. In particular, `STAKE_COVERAGE_TENSION` means the two upstream conditions point in different directions in the same observation: stake support exceeds 2/3 while minimum-message coverage is incomplete.

That classification is a research hypothesis generator. The next bridge is to obtain the corresponding block/DAG evidence and determine whether the state can actually arise in the upstream execution path under realistic delivery and fault conditions.


## Next

The next research step is to feed faithful upstream block/DAG observations into this same evidence path and then reproduce any candidate fragility against the upstream implementation or formal specification.


## M5 — Upstream finalizer observation bridge

The next bridge is now explicit: a concrete finalizer observation can provide the
minimum-message sender set plus, for each candidate sender, the bonded validators
that observed the complete next-fringe message set. The adapter derives support
only when the observer set covers the complete bonded partition, matching the
current upstream finalizer's calculate_fringe condition.

That trace is then passed into the existing M3 law probe. The resulting record
keeps the upstream-facing observation separate from the synthetic scenario
engine and carries a canonical observation digest for deterministic replay.

This still does not claim a protocol vulnerability. A STAKE_COVERAGE_TENSION
observation is a concrete condition worth reproducing through the upstream
execution path; it becomes a protocol finding only if an actual upstream
execution demonstrates the relevant safety/liveness consequence.
