# RChain Reality Compiler

**A deterministic evidence compiler for turning distributed execution claims into inspectable, reproducible, proof-carrying reality records.**

> **Status:** Research prototype / executable Reality Layer
>
> This repository is **not** an RChain node, a replacement for RChain consensus, or a requirement for running RChain. The word *compiler* describes the verification boundary: it compiles observations, execution traces, propositions, and evidence into a deterministic certificate that can be inspected and replayed independently.

## The problem

Distributed systems do not only produce state. They produce claims about state.

A block may claim an execution happened. An observer may report an event. A validator may justify a proposition. A replay may agree or diverge. A UI can display all of those things without establishing how they relate.

Reality Compiler makes that relationship executable.

```text
Observation
    ↓
Normalization
    ↓
Evidence / RealityRecord
    ↓
Reality Calculus
    ↓
Proposition Calculus
    ↓
Proof obligations + justification graph
    ↓
Replay / consistency / equivocation
    ↓
Deterministic RealityCertificate
    ↓
Justified next transition
```

The result is not merely a status label. The certificate carries the reasoning material needed to inspect why that status was produced.

## Why a compiler?

RChain itself does not need this repository in order to execute its protocol.

The compiler boundary exists for a different problem: **turning heterogeneous observations into a common, reproducible verification artifact.**

A network can execute correctly while its surrounding evidence is fragmented, contradictory, difficult to replay, or impossible to audit after an observer disappears. Reality Compiler treats observation as input and verification as a separate, deterministic layer.

The architecture is therefore closer to an evidence compiler than to a conventional blockchain application:

```text
provider / observer / fixture
            ↓
      canonical input
            ↓
     evidence compiler
            ↓
     proof-carrying result
```

A future observer can replace today's synthetic fixture without replacing the verification model.

## Reality Engine Core

The first executable engine boundary is `src/lib/compiler/reality-engine.ts`.

```text
RealityEngineInput
        ↓
canonical normalization
        ↓
RealityRecord
   ┌────┴─────────────────┐
   ↓                      ↓
Reality Calculus     Proposition Calculus
   ↓                      ↓
   └───────┬──────────────┘
           ↓
 replay / consistency / equivocation
           ↓
     state resolution
           ↓
   RealityCertificate
```

The engine is deliberately conservative:

- `DIVERGENT` takes precedence when replay diverges, propositions conflict, or equivocation is detected.
- `INCOMPLETE` is emitted when required evidence or proposition prerequisites are missing.
- `VERIFIED` requires successful verification, proposition consistency, and a fixed point.
- weaker states such as `OBSERVED`, `CONSISTENT`, and `REPRODUCED` remain explicit instead of being promoted to `VERIFIED`.

Run it directly:

```bash
npm run demo:reality-engine
```

## Proof-producing Reality Layer

The engine emits more than a final state. Its proof bundle exposes:

- **Proof obligations** — what had to be established.
- **Justification graph** — how observations, evidence, claims, propositions, and validations relate.
- **Conflict core** — where incompatible evidence or propositions collide.
- **Replay state** — whether the execution can be reproduced.
- **Equivocation signals** — whether mutually incompatible statements are being asserted.
- **Deterministic digests** — integrity anchors for the record, derivation, proposition judgement, and final certificate.

This makes failure informative. A divergent result is not a dead end; it is an auditable artifact describing the divergence.

## Reality Loop

The current Reality Layer closes an executable loop:

```text
OBSERVE → MEASURE → PROJECT → OBSERVE
```

`OBSERVE` captures provider-neutral evidence.

`MEASURE` derives verification state, proposition consistency, replay state, proof obligations, and conflicts.

`PROJECT` does not pretend to be an ML oracle. It derives the next justified transition from the current proof state. If the evidence is insufficient or contradictory, the engine can project **collect more evidence**, **isolate a conflict**, **replay**, or **hold state** rather than inventing certainty.

This separation leaves room for future predictive or ML systems without making prediction the source of truth for verification.

## Failure containment is a first-class concern

The architecture treats infrastructure failure and epistemic failure as different problems.

A node can disappear. A process can exhaust memory. An observer can disagree with another observer. A replay can diverge. None of those should silently become `VERIFIED` merely because the UI or service is still running.

Reality Compiler therefore keeps:

```text
execution
observation
verification
replay
presentation
```

as separate boundaries.

The current implementation provides deterministic evidence artifacts and conservative state resolution. Resource budgeting, streaming ingestion, checkpointing, and durable multi-observer aggregation are intentionally future integration points rather than claims about the current prototype.

## Architecture

```text
src/
├── components/wb/       Workbench presentation
├── routes/              Interactive verification views
└── lib/
    ├── compiler/        Reality Engine, calculi, evidence, hashing, adapters
    └── multiplayer/     Peer-to-peer transport boundary

server/                  Optional runtime integration
scripts/                 Build, migration, and verification tooling
docs/                    Architecture and evidence contracts
examples/                Small executable verification demonstrations
```

Important documents:

- [`docs/REALITY_ENGINE_CORE.md`](docs/REALITY_ENGINE_CORE.md)
- [`docs/REALITY_EVIDENCE_PLANE.md`](docs/REALITY_EVIDENCE_PLANE.md)
- [`docs/REALITY_RECORD.md`](docs/REALITY_RECORD.md)
- [`docs/WHY_THIS_IS_A_COMPILER.md`](docs/WHY_THIS_IS_A_COMPILER.md)
- [`docs/FAILURE_CONTAINMENT.md`](docs/FAILURE_CONTAINMENT.md)

## RChain / QLF boundary

This repository is an independent research and engineering implementation. It is designed to provide verification-oriented tooling around RChain-shaped execution and Quantum Logical Framework concepts.

It does not claim to be an official RChain implementation, reproduce historical RChain consensus, or require changes to the underlying protocol.

The intended integration boundary is:

```text
RChain / observer / Sentinel / future provider
                    ↓
             Reality Adapter
                    ↓
             Reality Compiler
                    ↓
          auditable certificate
```

## What this is not

- Not a new blockchain.
- Not a token or Web3 consumer application.
- Not an RChain fork.
- Not a replacement for consensus.
- Not a claim of live mainnet evidence.
- Not an AI oracle that invents missing facts.

It is infrastructure for **evidence, reasoning, replay, and provenance** around distributed execution.

## Verification model

A useful result should expose:

1. The claim being evaluated.
2. The source execution or fixture.
3. The transformation and compilation path.
4. The evidence attached to the claim.
5. The predicates evaluated against that evidence.
6. Any adversarial mutation or replay divergence.
7. The proof obligations and justification graph.
8. The final deterministic result and its provenance.

`VERIFIED` means the configured predicates passed over the supplied evidence. It does **not** mean protocol finality, economic truth, or live network consensus.

## Development

Requirements:

- Node.js with npm
- A modern browser for the workbench

```bash
npm install
npm run dev
```

Quality gates:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Executable demonstrations:

```bash
npm run demo:reality-record
npm run demo:reality-calculus
npm run demo:proposition-calculus
npm run demo:reality-engine
```

## Design principles

**Determinism.** Equivalent normalized inputs should produce reproducible verification artifacts.

**Evidence over assertion.** The system exposes the material behind a result rather than hiding it behind a status badge.

**Provenance.** Every meaningful result should retain its origin and transformation path.

**Fail closed.** Missing or contradictory evidence should reduce certainty, not manufacture it.

**Adversarial by design.** Contradiction, replay divergence, equivocation, malformed evidence, and incomplete inputs are first-class cases.

**Explicit boundaries.** Live state, synthetic fixtures, transport, verification, and presentation remain separable.

**Replaceable observers.** The verification core should not care whether evidence originated from a fixture, Sentinel, an RChain node, or another observer implementation.

## License

No license is declared in this repository yet. Until a license is added, assume the repository contents remain under the copyright of their respective rights holders and are not automatically licensed for reuse.

## Validation

The main branch is expected to pass the repository quality gates before release: typecheck, lint, test, and production build.
