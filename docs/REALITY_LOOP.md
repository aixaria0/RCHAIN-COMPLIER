# Reality Loop v0.3

The Reality Loop closes the verification boundary into three explicit phases:

```text
OBSERVE → MEASURE → PROJECT → OBSERVE …
```

It is deliberately deterministic. `PROJECT` is a proof-state transition, not a machine-learning prediction. The loop never invents future evidence or promotes an unverified claim.

## Observe

The loop starts from the existing `RealityRecord` and its provider-specific observation boundary.

```text
Sentinel / network observation
          ↓
     RealityObservation
          ↓
       RealityRecord
```

Observations, evidence, claims, verification records, replay inputs, and record integrity remain separately inspectable.

## Measure

The engine materializes a `RealityMeasurement` from the proof-producing execution:

- observation count
- evidence count
- claim count
- verification count
- satisfied/open/failed proof obligations
- conflict count
- proposition convergence rounds
- fixed-point state
- proof coverage

This turns the proof ledger into a stable measurement vector without assigning trust to an upstream source.

## Project

`RealityProjection` derives the next protocol-relevant state transition from the current proof state.

Possible actions are:

```text
CONTINUE_OBSERVATION
COLLECT_MISSING_EVIDENCE
ISOLATE_CONFLICT
RUN_REPLAY
COMPLETE_VERIFICATION
HOLD_VERIFIED_STATE
```

Each projection carries a deterministic basis and rationale. The result is included in the `RealityCertificate` digest.

## Why this boundary matters

The loop creates a clean separation between three different questions:

1. **What was observed?** — evidence acquisition.
2. **What can be measured/proved from it?** — deterministic verification and justification.
3. **What transition is justified next?** — proof-carrying projection.

That separation makes the system suitable for a future forecasting layer without coupling prediction to the trust boundary. A statistical or learned model may later consume a sequence of measured trajectory points, while the underlying certificate and verification core remain deterministic and independently checkable.

## State discipline

```text
DIVERGENT  → isolate conflict
INCOMPLETE → collect missing evidence
OBSERVED   → establish consistency or continue observation
CONSISTENT → replay when available
REPRODUCED → complete verification
VERIFIED   → hold until new evidence changes the inputs
```

These are conservative protocol transitions, not outcome guarantees.

## Scope boundary

The Reality Loop is not a historical RChain consensus implementation, not a replacement for validator consensus, and not a claim of live network finality. It is an executable, provider-neutral reasoning boundary between observed execution and auditable claims.
