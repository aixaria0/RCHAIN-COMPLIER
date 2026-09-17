# Reality Evidence Plane

## Purpose

The Reality Evidence Plane is the verification boundary between observed RChain execution and a human-auditable statement about that execution.

It does not replace an RChain node, consensus, or application logic. It observes execution, normalizes evidence, derives explicit claims, and evaluates deterministic verification predicates.

## Core pipeline

```text
RChain / Execution Source
        |
        v
Observation Adapter
        |
        v
Canonical Event Model
        |
        v
Evidence Envelope
        |
        +------> Claim Set
        |
        +------> Causality Graph
        |
        +------> Replay Input
        |
        v
Verification Engine
        |
        +------> VERIFIED
        +------> DIVERGENT
        +------> INCOMPLETE
```

## Reality Record

A Reality Record is the smallest portable unit that answers: what is being claimed, what evidence supports it, what transformations produced the evidence, and can the result be checked independently?

Conceptual shape:

```text
RealityRecord
├── subject
├── source
├── observations[]
├── claims[]
├── evidence[]
├── dependencies[]
├── transformations[]
├── verification[]
├── replay[]
└── integrity
```

The first implementation should keep this model provider-neutral. An RChain adapter may populate it, but the verification plane must not depend on a single transport or deployment environment.

## Verification states

`OBSERVED` means an adapter supplied evidence.

`CONSISTENT` means structural and integrity predicates passed.

`REPRODUCED` means the relevant computation or state transition can be replayed against the supplied inputs.

`VERIFIED` means the configured verification predicates passed over the complete evidence set.

`DIVERGENT` means replay or verification produced a conflicting result.

`INCOMPLETE` means the available evidence cannot establish the requested claim.

These states are deliberately descriptive. The system must never upgrade an unsupported claim merely because an upstream component asserts it.

## Evidence lifecycle

1. Observe execution without changing its meaning.
2. Normalize observations into a canonical representation.
3. Hash or otherwise bind evidence to stable identities where applicable.
4. Build explicit claims from observations.
5. Record causal/dependency relationships.
6. Run deterministic structural predicates.
7. Replay where a replayable input is available.
8. Run optional formal predicates.
9. Emit a verification result with provenance and failure reasons.

## RChain alignment

The design is informed by the RChain architecture documentation's emphasis on public compute infrastructure, compositional execution, formal verification, and consensus propositions with justification/evidence.

This repository remains an independent implementation and must not imply official RChain status.

## Initial milestone

The first milestone is not a live-network integration. It is a deterministic vertical slice:

```text
synthetic execution fixture
        -> canonical events
        -> evidence envelope
        -> claim set
        -> causality graph
        -> deterministic verification
        -> replay check
        -> Reality Record
```

Once this contract is stable, `rchain-sentinel` can become the first observation adapter without coupling the verification core to the node transport.

## Design constraints

- Deterministic outputs for identical inputs.
- Explicit provenance for every verification result.
- No hidden network calls in core verification.
- Adversarial fixtures are first-class test inputs.
- Evidence and claims are separate objects.
- Failed or incomplete verification is a valid result.
- Live RChain integration is an adapter concern.
