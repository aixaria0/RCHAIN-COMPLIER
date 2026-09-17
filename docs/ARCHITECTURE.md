# Architecture

## System boundary

RChain Reality Compiler is the deterministic evidence and verification plane around distributed execution. Its central responsibility is to represent an execution claim, preserve provenance, apply deterministic transformations, and expose the evidence required to inspect the result.

It deliberately sits outside the consensus-critical path:

```text
┌───────────────────────────────┐
│ RChain / execution source     │
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│ Observer / Reality Adapter    │
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│ Canonical RealityRecord       │
│ observations / claims /       │
│ evidence / dependencies       │
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│ Reality + Proposition         │
│ Calculi / replay / checks     │
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│ RealityCertificate            │
│ state / provenance / digest   │
└───────────────┬───────────────┘
                │
         ┌──────┼────────┐
         ▼      ▼        ▼
      Replay  Causality  Workbench
      /diff   /evidence   /UI
```

The plane is therefore **sidecar-first**: a node, observer, archive, or test fixture can feed evidence into the same deterministic verification core without changing the underlying protocol.

## Five boundaries

### 1. Execution boundary

RChain or another source produces the execution state, event, block-shaped record, or process trace. The Reality Layer does not redefine that execution.

### 2. Observation boundary

An adapter captures what an observer can actually supply. Synthetic fixtures, `rchain-sentinel`, local nodes, archives, or future providers can all populate the same provider-neutral model.

### 3. Verification boundary

`src/lib/compiler` normalizes the record, evaluates the Reality Calculus, evaluates supplied RChain propositions, checks replay where possible, detects configured equivocation, and resolves a conservative state.

### 4. Evidence boundary

The certificate retains the inputs and reasoning context needed to inspect the result: source lineage, claims, evidence, dependencies, verification predicates, replay state, proof/diagnostic artifacts, and deterministic digests.

### 5. Presentation boundary

The workbench, causal explorer, evidence graph, adversarial views, and other UI surfaces consume verification artifacts. UI state must not become a source of verification truth.

## Compilation model

```text
Claim / event
  → canonical representation
  → observation + evidence model
  → calculi + replay
  → verification judgement
  → deterministic certificate
```

The important compiler property is reproducibility: equivalent normalized inputs and the same rules should yield equivalent derived artifacts and digests.

## Repository layers

### `src/lib/compiler`

The semantic core of the workbench. It contains compilation logic, Rholang-oriented structures, QLF-oriented structures, hashing, observation, exchange handling, calculi, proof/diagnostic artifacts, adapters, and shared types.

### `src/components/wb`

Reusable workbench presentation primitives. This layer remains independent of deployment-provider-specific behavior.

### `src/routes`

User-facing views. Routes compose compiler and evidence primitives into the verification workbench.

### `src/lib/multiplayer`

Transport and peer-to-peer concerns. Networking is an integration boundary, not part of deterministic verification itself.

### `server/`

Optional server/runtime integration. Server code may connect external systems to the application, but verification logic should remain testable without a live deployment.

### `scripts/`

Build, migration, browser verification, and repository tooling. Scripts should be deterministic where practical and should fail loudly when an invariant is violated.

## Evidence lifecycle

A verification artifact should be traceable through these stages:

```text
Claim
  → normalized representation
  → evidence envelope
  → verification predicates
  → replay / consistency / equivocation
  → deterministic result
```

Adversarial and replay paths branch from the evidence stage so the original artifact can be compared with a mutated or independently reconstructed state.

## Design constraints

1. Verification semantics must not depend on UI state.
2. Synthetic fixtures must be visibly distinguishable from live network evidence.
3. Hashes and derived identifiers must be reproducible.
4. External services should be adapters, not hidden dependencies of core verification.
5. A failing verification result should retain enough provenance to explain the failure.
6. New protocol assumptions should be documented next to the implementation that consumes them.
7. Provider-specific runtime concerns must not leak into the compiler boundary.
8. A certificate must never claim more than its supplied evidence and configured predicates establish.
9. Formal theorem proving must remain explicit: executable verification artifacts are not automatically mathematical proofs.

## Evolution path

The current workbench can evolve toward live RChain integration by replacing fixture producers with protocol adapters while retaining the same evidence and verification contracts:

```text
Synthetic fixture producer
          │
          ▼
   Canonical evidence contract
          ▲
          │
Live RChain / Sentinel adapter
          │
          ▼
   Independent verifier
          │
          ▼
   Reality Certificate
```

That separation is intentional: the UI should not need to know whether an evidence envelope originated from a fixture, a local node, a remote observer, or an archive.

## Non-goals

This repository is not:

- a replacement consensus protocol;
- an RChain fork;
- a new blockchain;
- a token or consumer Web3 application;
- an AI oracle that fills missing evidence;
- a claim of historical RChain consensus compatibility;
- a claim that every emitted certificate is a formal mathematical proof.
