# Reality Certificate

A `RealityCertificate` is the portable output of the Reality Layer. It records what the engine derived from a normalized evidence set, how that derivation was obtained, and the deterministic digest that binds the result.

It is an **evidence-backed verification artifact**. It is not automatically a protocol-finality certificate, an economic-truth oracle, or a formal theorem proof.

## Certificate contract

The current executable schema is:

```text
rchain-reality-certificate/v1
```

The engine emits:

```text
RealityCertificate
├── schema
├── engineVersion
├── state
├── record
├── reality
├── propositions
├── equivocations[]
├── proof
├── loop
├── sourceLineage
└── certificateDigest
```

### `schema`

Versioned identifier for the certificate contract.

### `engineVersion`

Version of the executable Reality Engine that produced the artifact.

### `state`

One conservative derived state:

```text
OBSERVED
CONSISTENT
REPRODUCED
VERIFIED
INCOMPLETE
DIVERGENT
```

These states describe the current evidence and verification result. They do not override the semantics of the underlying RChain protocol.

### `record`

The sealed `RealityRecord`, containing the subject, source, observations, claims, evidence, dependencies, transformations, verification checks, replay inputs, and record integrity.

### `reality`

Result of the Reality Calculus, including the deterministic judgement that follows from the supplied observations and checks.

### `propositions`

Result of the RChain Proposition Calculus, including accepted/rejected propositions, convergence information, and fixed-point status.

The implementation intentionally computes an inclusion-maximal consistent set using stable ordering. It does not claim to solve a globally maximum-cardinality subset problem or reproduce historical RChain consensus.

### `equivocations[]`

Explicitly detected cases where a source presents incompatible claims for the same target cycle under the engine's configured detection rules.

### `proof`

A machine-inspectable proof/diagnostic bundle: proof obligations, justification relationships, conflict information, and derived evidence needed to explain the engine's judgement.

A proof bundle is not synonymous with a formal mathematical proof. Formal theorem proving is a separate verification capability that may be connected through explicit predicates.

### `loop`

The deterministic Observe → Measure → Project result. Projection describes the next justified action from the current evidence state, such as collecting missing evidence, isolating a conflict, running replay, completing verification, or holding a verified state.

### `sourceLineage`

The source plus stable observation and claim identifiers used to trace the certificate back to its input boundary.

### `certificateDigest`

A deterministic digest over the normalized certificate payload. The repository exposes `verifyRealityCertificate()` to recompute and check this integrity binding.

## State semantics

`OBSERVED` means the system has observations but has not established a stronger result.

`CONSISTENT` means configured structural and proposition-consistency checks passed, without replay or full verification closure.

`REPRODUCED` means the relevant replay path succeeded and the proposition layer reached a consistent fixed point, while the full verification conditions are not yet established.

`VERIFIED` means the configured verification predicates passed over the supplied evidence, the proposition set is consistent, and the proposition process reached a fixed point.

`INCOMPLETE` means required evidence or prerequisites are missing.

`DIVERGENT` means the engine found a conflicting replay result, proposition conflict, or equivocation according to its configured rules.

The resolver is deliberately fail-closed: contradictory or missing evidence does not silently become `VERIFIED`.

## Evidence versus truth

A certificate answers a bounded question:

> **Given this normalized evidence, these rules, and these supplied replay/proposition inputs, what result does the deterministic verifier derive?**

It does not answer the unbounded question:

> **Is every fact about the underlying network true?**

That distinction is fundamental to the architecture. An upstream observer is an evidence source, not an unquestionable truth authority.

## RChain vocabulary boundary

The certificate can represent language that is structurally related to the RChain architecture's treatment of propositions, claims, belief, and justification. In that architecture, a validator's bet contains a claim and justification, and those justification structures can be used to analyze properties such as equivocation and build justification graphs.

This repository uses that vocabulary as an explicit research and verification model. It does not claim to reproduce the historical RChain consensus implementation.

## Example

A future testnet certificate could conceptually establish:

```text
SUBJECT
validator V1 / round 1842

OBSERVATIONS
peer report
proposal
proposition set
block/state record

CLAIMS
C1  proposal was observed
C2  required justification was present
C3  resulting transition matched supplied evidence
C4  replay reproduced the recorded result

VERIFICATION
C1 PASS
C2 PASS
C3 PASS
C4 PASS

STATUS
REPRODUCED

NEXT TRANSITION
COMPLETE_VERIFICATION
```

A stronger `VERIFIED` result requires the configured verification predicates to close as well. A contradiction would instead produce a `DIVERGENT` certificate containing the conflict evidence and diagnostic path.

## Operational boundary

The intended deployment path is sidecar-first:

```text
RChain node / observer
        ↓
Sentinel or adapter
        ↓
RealityRecord
        ↓
Reality Engine
        ↓
Reality Certificate
        ↓
Workbench / archive / independent verifier
```

No consensus-critical modification is required for this boundary. Live integration is an adapter concern; deterministic verification remains independently testable.

## Why this artifact matters

A dashboard answers **what status is being shown**.

A Reality Certificate is designed to answer:

```text
What was claimed?
What was observed?
What evidence supports it?
What transformations were applied?
What contradictions were found?
Was replay successful?
Which predicates passed?
Why did the engine reach this state?
Can another verifier recompute the certificate digest?
```

That is the intended role of the Reality Layer: make distributed execution evidence portable, inspectable, reproducible, and conservative about what it actually establishes.
