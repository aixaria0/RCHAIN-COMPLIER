# Casper CBC Stress Lab

## Why this exists

Patrick proposed stress testing the Casper CBC proof-of-stake algorithm, finding fragilities, and proposing improvements.

This first milestone is deliberately synthetic-first. It turns the existing Reality + Proposition Calculus work into a deterministic harness for validator observations, faults, justification and replay.

## Model boundary

The harness is an executable CBC-style stress model. It does not reproduce the historical RChain Casper implementation and does not claim protocol-level safety, liveness, or economic conclusions.

The purpose of this layer is narrower:

1. generate controlled validator observations;
2. inject explicit network/validator faults;
3. preserve the resulting evidence;
4. make every scenario replayable;
5. turn observed failure modes into testable improvement hypotheses.

## Fault model

The first harness supports:

- baseline
- partition
- equivocation
- reorder
- partition+equivocation

A scenario is deterministic. Validator identities, stake, target round, claims, justifications and delivery order are part of the replay input.

## Evidence path

```text
Validator observations
        |
        v
Reality Bet
        |
        +---- fault injection
        |
        v
Delivered evidence
        |
        v
Equivocation detection
        |
        v
Fragility metrics
        |
        v
Improvement hypotheses
        |
        v
Replay digest
```

The repository path is:

```text
Sentinel
  -> RealityRecord
  -> Reality Calculus
  -> Proposition Calculus
  -> CBC Stress Lab
  -> Fragility Report
```

## Metrics

The initial report exposes:

- validator count
- total stake
- rounds
- convergence observation
- equivocation count
- blocked claim count
- partitioned rounds
- replay stability
- divergence signal

The divergence signal is an observability flag, not a claim that the underlying Casper protocol is unsafe.

## Improvement discipline

A fragility is recorded only from an observable condition in the scenario.

An improvement is recorded as a hypothesis, not as a claimed protocol fix. The next research stage is to connect each hypothesis to a concrete upstream Casper implementation or formal specification, construct a counterexample or regression scenario, and measure the result.

## Run it

```bash
npm run demo:cbc-stress
```

The output includes the scenario, metrics, fragilities, improvement hypotheses and deterministic replay digest.

## Next boundary

The next meaningful step is not adding more UI. It is replacing the synthetic validator transition model with an adapter around the actual Casper/RChain code path or a faithful formal model, while keeping the same evidence and replay interfaces.
