# Reality Engine Core

Reality Engine Core is the first executable engine boundary of the Reality Layer.

It consumes normalized observations and existing evidence structures, evaluates them through the Reality Calculus, evaluates any supplied RChain propositions through the Proposition Calculus, and emits one deterministic `RealityCertificate`.

## Execution pipeline

```text
RealityEngineInput
      |
      v
canonical normalization
      |
      v
RealityRecord
      |
      +------ Reality Calculus
      |       OBS / COMP / REQ / CHK / REP
      |
      +------ RChain Proposition Calculus
      |       consistency / requirements / convergence
      |
      +------ equivocation analysis
      |
      v
state resolution
      |
      v
RealityCertificate
      |
      +-- record digest
      +-- derivation digest
      +-- proposition judgement digest
      +-- source lineage
      +-- certificate digest
```

## State semantics

The engine is fail-closed and resolves state conservatively:

- `DIVERGENT` when replay diverges, propositions conflict, or equivocation is detected.
- `INCOMPLETE` when required evidence or proposition prerequisites are missing.
- `VERIFIED` only when the Reality Calculus reaches `VERIFIED`, the proposition set is consistent, and the proposition process reaches a fixed point.
- `REPRODUCED` when replay succeeds and proposition consistency/fixed-point requirements hold but full verification has not been established.
- `CONSISTENT` when the evidence and proposition layers are consistent without reproduction or verification closure.
- `OBSERVED` when the engine has observations but cannot establish a stronger state.

## Determinism

Before evaluation, the engine canonicalizes collection order, nested object keys, proposition relations, and evidence identifiers. The same normalized input and rules therefore produce the same record and certificate digests.

## Trust boundary

Upstream adapters are observations, not truth authorities. Sentinel data can enter through the existing observer boundary, but the engine derives its own judgement from the recorded evidence.

The engine does not replace RChain consensus and does not claim compatibility with a historical consensus implementation. It is an independently executable reasoning boundary that can consume synthetic fixtures today and live observer evidence later.

## Runnable proof

```bash
npm run demo:reality-engine
```

The demo emits the certificate state, certificate digest, record digest, proposition judgement digest, fixed-point status, equivocation signals, and a local certificate-integrity check.
