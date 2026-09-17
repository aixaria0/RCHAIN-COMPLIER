# RChain Proposition Calculus

## Purpose

The Reality Calculus reasons over evidence. The RChain Proposition Calculus adds a consensus-facing layer for statements about blockchain state, proposition dependencies, incompatible propositions, validator bets, justification references, and convergence to a stable proposition set.

This is an executable research formalism, not a claim that it reproduces the historical RChain consensus implementation.

## Core Objects

```text
Proposition
  id
  statement
  conflictsWith[]
  requires[]

Bet
  source
  target
  claim
  belief
  justification[]
```

The model deliberately preserves the language used in the RChain architecture document: validators can bet on logical propositions, with a claim, belief, and justification; proposition sets are evaluated for consistency before materialization. See the architecture source cited in the project context.

## Calculus

`PROP/OBS` — introduce a proposition backed by an observed evidence record.

`CONS` — accept a proposition when it does not conflict with the current accepted set and its declared prerequisites are satisfied.

`REJECT` — retain a proposition as rejected when it conflicts with accepted propositions or remains blocked by missing prerequisites.

`FIX` — repeat deterministic acceptance passes until the accepted set stops changing.

`EQV` — detect equivocation when one validator source presents multiple distinct claims for the same target cycle.

The implementation produces a convergence trace and a deterministic digest of the resulting judgement.

## Maximal vs maximum

The implementation computes an inclusion-maximal consistent set using stable proposition ordering. It does **not** claim to solve the globally maximum-cardinality consistent-subset problem.

That distinction is deliberate: the implementation is deterministic and inspectable without silently introducing an NP-hard optimizer or pretending to reproduce a consensus algorithm that is not implemented here.

## Connection to RealityRecord

```text
RChain/Sentinel observation
        ↓
RealityRecord
        ↓
Reality Calculus
        ↓
RChain Proposition Calculus
        ↓
consistent proposition set
        ↓
justification / equivocation analysis
        ↓
Reality Certificate
```

The evidence layer remains provider-neutral. The proposition layer consumes claims and evidence; it does not promote an upstream `finalized` field into truth.

## Demo

```bash
npm run demo:proposition-calculus
```

The demo emits accepted and rejected propositions, convergence rounds, fixed-point status, judgement digest, and detected equivocation.
