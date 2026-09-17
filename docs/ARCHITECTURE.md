# Architecture

## System boundary

RChain Reality Compiler is a verification workbench. Its central responsibility is to represent an execution claim, preserve provenance, apply deterministic transformations, and expose the evidence required to inspect the result.

```text
┌───────────────┐
│ Execution     │
│ claim / event │
└───────┬───────┘
        │
        ▼
┌───────────────┐
│ Compilation   │  Rho / QLF-oriented transforms
└───────┬───────┘
        │
        ▼
┌───────────────┐
│ Evidence      │  hashes, traces, block-shaped evidence
└───────┬───────┘
        │
        ▼
┌───────────────┐
│ Verification  │  predicates / invariant checks
└───────┬───────┘
        │
        ├──────────────► Causality
        ├──────────────► Counterfactuals
        └──────────────► Replay divergence
```

## Repository layers

### `src/lib/compiler`

The semantic core of the workbench. It contains compilation logic, Rholang-oriented structures, QLF-oriented structures, hashing, observation, exchange handling, and shared types.

### `src/components/wb`

Reusable workbench presentation primitives. This layer remains independent of deployment-provider-specific behavior.

### `src/routes`

User-facing views. Routes compose compiler/evidence primitives into the verification workbench.

### `src/lib/app-data`

Application data and readiness boundaries. It should not contain verification semantics that belong in the compiler layer.

### `src/lib/multiplayer`

Transport and peer-to-peer concerns. Networking is an integration boundary, not part of deterministic verification itself.

### `server/`

Optional server/runtime integration. Server code may connect external systems to the application, but verification logic should remain testable without a live deployment.

### `scripts/`

Build, migration, preview, and verification tooling. Scripts should be deterministic where practical and should fail loudly when an invariant is violated.

## Evidence lifecycle

A verification artifact should be traceable through these stages:

```text
Claim
  → normalized representation
  → compiled representation
  → execution trace
  → evidence envelope
  → verification predicates
  → result
```

Adversarial and replay paths branch from the evidence stage so the original artifact can be compared with a mutated or independently reconstructed state.

## Design constraints

1. Verification semantics must not depend on UI state.
2. Synthetic fixtures must be visibly distinguishable from live network evidence.
3. Hashes and derived identifiers must be reproducible.
4. External services should be adapters, not hidden dependencies of core verification.
5. A failing verification result should retain enough provenance to explain the failure.
6. New protocol assumptions should be documented next to the implementation that consumes them.

## Evolution path

The current workbench can evolve toward live RChain integration by replacing fixture producers with protocol adapters while retaining the same evidence and verification contracts:

```text
Synthetic fixture producer
          │
          ▼
   Evidence contract
          ▲
          │
Live RChain adapter ──────► independent verifier
```

That separation is intentional: the UI should not need to know whether an evidence envelope originated from a fixture, a local node, or a remote observer.
