# Reality Engine Core

`RealityEngine` is the executable boundary between observed execution evidence and an auditable claim.

It deliberately composes the existing `RealityRecord`, Reality Calculus, and RChain Proposition Calculus instead of introducing a second evidence model.

```text
Observation / Sentinel evidence
          |
          v
   Canonical normalization
          |
          v
     RealityRecord
          |
          +------------------+
          |                  |
          v                  v
 Reality Calculus     Proposition Calculus
          |                  |
          +--------+---------+
                   |
                   v
        Proof Obligation Ledger
                   |
          +--------+---------+
          |                  |
          v                  v
  Justification Graph   Conflict Core
          |                  |
          +--------+---------+
                   |
                   v
          RealityCertificate
```

## Engine contract

For deterministic inputs, the engine produces a deterministic certificate digest.

```text
same normalized input
+ same propositions
+ same bets
+ same previous digest
= same certificate
```

The engine does not treat upstream status strings as truth. It derives a terminal state from explicit replay, verification, proposition, convergence, and equivocation evidence.

## Proof obligations

The engine emits an ordered ledger containing obligations such as:

- observation coverage
- claim-basis resolution
- verification predicates
- replay reproduction
- proposition consistency
- convergence / fixed point
- equivocation absence

Each obligation is `SATISFIED`, `OPEN`, or `FAILED` and carries references plus a reason.

## Justification graph

The graph makes provenance machine-readable. Nodes represent observations, evidence, claims, verifications, replay, propositions, and validator bets. Edges express `supports`, `bases`, `checks`, `replays`, `requires`, `conflicts`, and `justifies` relationships.

The graph is deterministic and suitable for rendering without changing the verification semantics.

## Conflict core

When a result is divergent, the certificate carries compact conflict evidence rather than only a boolean failure. The current core classes are:

- `REPLAY` — expected and observed replay digests differ.
- `PROPOSITION` — an accepted and blocked proposition pair conflict.
- `EQUIVOCATION` — a validator issued incompatible claims.

## State discipline

`DIVERGENT` is terminal for contradictory replay, proposition, or validator evidence. Missing prerequisites remain `INCOMPLETE`. `VERIFIED` requires successful verification, a consistent proposition judgement, and a fixed point.

The engine is intentionally not a replacement for RChain consensus and does not claim compatibility with a historical consensus implementation. It is a portable execution core that can be fed by synthetic fixtures now and observation adapters later.
