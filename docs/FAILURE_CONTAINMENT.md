# Failure Containment

A central design goal of the Reality Layer is to prevent infrastructure failure, incomplete observation, or contradictory evidence from being mistaken for verified reality.

## Two different failure classes

The system distinguishes:

1. **Infrastructure failure** — a node, process, observer, or transport becomes unavailable or resource constrained.
2. **Epistemic failure** — the available evidence is incomplete, contradictory, divergent under replay, or mutually inconsistent.

They can interact, but they should not be represented as the same state.

```text
infrastructure failure
        ↓
 evidence availability changes
        ↓
     INCOMPLETE

conflicting observations
        ↓
 consistency analysis
        ↓
     DIVERGENT
```

Neither path should silently produce `VERIFIED`.

## Why memory exhaustion matters

A distributed project can fail because one component consumes more memory than the deployment can provide. That is an operational failure, not proof that the underlying state was false or true.

The Reality Layer therefore keeps execution and evidence separate. A future production adapter can use bounded queues, streaming ingestion, checkpoints, backpressure, and durable observation storage without changing the certificate semantics.

Those resource-management mechanisms are deliberately **not claimed as implemented by this research prototype**. The current boundary establishes the data and reasoning model that those mechanisms can feed.

## Conservative resolution

The engine uses conservative state resolution:

```text
DIVERGENT
    > INCOMPLETE
    > VERIFIED
    > REPRODUCED
    > CONSISTENT
    > OBSERVED
```

The exact precedence is implemented in the engine and is intentionally stricter than a simple boolean success flag. Divergence must not be hidden by a positive observation, and missing prerequisites must not be promoted to proof.

## Observer replacement

The verification core should not depend on one observer being permanently available.

```text
             ┌─ Sentinel
             ├─ RChain node
Reality ←────┼─ archive
             ├─ synthetic fixture
             └─ future observer
                    ↓
              Reality Adapter
                    ↓
              Reality Compiler
```

This makes the observer replaceable while keeping the verification semantics stable.

## Production path

The research prototype establishes the certificate boundary. A production deployment would add:

- bounded resource budgets;
- streaming evidence ingestion;
- durable checkpoints;
- multi-observer aggregation;
- recovery after process or node loss;
- explicit backpressure and retry policy;
- long-term certificate storage;
- operational metrics and alerting.

These are engineering layers around the core, not reasons to weaken the evidence semantics.
