# Reality Calculus v0.1

Reality Calculus is the executable reasoning layer over `RealityRecord`.
It answers a narrower question than a consensus protocol:

> Given a recorded set of observations, claims, evidence, verification predicates,
and replay information, what conclusion follows from those facts and which rules
produced that conclusion?

It is intentionally not a second evidence model. Terms reference identities
already present in `RealityRecord`.

## Judgement form

The calculus evaluates terms to judgements:

```text
Γ ⊢ t ⇓ (state, observations, evidence, verifications, reason)
```

Every evaluation also emits a derivation tree and a deterministic derivation digest.

## Syntax

```text
term ::= observation(id)
       | compose(term, term)
       | require(ids, term)
       | check(predicate, term)
       | replay(expectedDigest, observedDigest, term)
```

## Rules

### OBS — observation

If the referenced observation exists:

```text
Γ contains observation o
------------------------- OBS
Γ ⊢ observation(o) ⇓ OBSERVED
```

A missing observation is `INCOMPLETE` rather than an invented observation.

### COMP — composition

Two derivations can be composed while preserving the union of their provenance:

```text
Γ ⊢ a ⇓ A      Γ ⊢ b ⇓ B
------------------------- COMP
Γ ⊢ compose(a,b) ⇓ join(A,B)
```

`join` is conservative: `DIVERGENT` dominates `INCOMPLETE`, and `INCOMPLETE`
dominates positive states. This prevents an incomplete positive result from
masking a contradiction.

### REQ — requirement

A term may declare required evidence identities:

```text
Γ contains every id in R
------------------------ REQ
Γ ⊢ require(R,t) ⇓ Γ ⊢ t
```

Missing required identities force `INCOMPLETE`.

### CHK — verification predicate

A predicate is only evaluated when it is recorded in the evidence set:

```text
Γ contains predicate p with verification v
------------------------------------------- CHK
Γ ⊢ check(p,t) ⇓ join(Γ ⊢ t, v)
```

The calculus does not trust an upstream boolean such as `finalized=true` by itself.
The predicate and its evidence identity must exist in the record.

### REP — replay

Replay equality is explicit:

```text
expectedDigest = observedDigest
------------------------------- REP
Γ ⊢ replay(expected, observed, t) ⇓ REPRODUCED
```

A mismatch is `DIVERGENT`.

## State algebra

For conservative composition the implementation uses this diagnostic precedence:

```text
OBSERVED < CONSISTENT < REPRODUCED < VERIFIED < INCOMPLETE < DIVERGENT
```

This is not a confidence score. It is a fail-closed diagnostic ordering for
combining derivations.

## Why this is useful

The calculus separates three questions that are often collapsed into one status:

```text
What was observed?
        ↓
What rule connects those observations to a claim?
        ↓
What exact derivation produced the result?
```

That makes a Reality Record explainable without trusting the component that
originated the observation.

## Sentinel boundary

A Sentinel observer supplies observations. Reality Calculus consumes them.
The boundary therefore remains:

```text
RChain node
    ↓
rchain-sentinel
    ↓
Sentinel evidence
    ↓
RealityRecord
    ↓
Reality Calculus
    ↓
Derivation + digest
```

A Sentinel observation cannot directly upgrade a claim to `VERIFIED` unless the
corresponding verification predicate and evidence are present in the record.

## Example derivation

```text
                OBS(observation:18492)
                         |
                         v
                CHK(canonical-consistency)
                         |
                         v
                  CONSISTENT
                         |
                    REP(h,h)
                         |
                         v
                  REPRODUCED
                         |
                         v
                    VERIFIED
```

The important artifact is not only the final word. It is the derivation tree that
shows which recorded facts and rules produced that word.
