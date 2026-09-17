# RChain Reality Compiler

A verification-oriented workbench for turning distributed execution claims into structured, independently checkable evidence.

> **Status:** Research prototype / verification workbench
>
> The current application is designed to make execution, causality, evidence, counterfactuals, and replay divergence inspectable. It should not be interpreted as a live RChain node or as production consensus infrastructure unless explicitly stated by the implementation.

## What this project is

RChain Reality Compiler is organized around a simple boundary:

```text
Execution
   ↓
Trace
   ↓
RChain state / block evidence
   ↓
Evidence envelope
   ↓
Verification
   ↓
Human-auditable result
```

The workbench provides a visual surface for examining this pipeline and for testing adversarial or divergent cases against deterministic fixtures.

## Core capabilities

- Compiler-oriented pipeline for Rholang/RChain-shaped execution claims.
- QLF-oriented representation and verification hooks.
- Deterministic hashing and evidence structures.
- Causality exploration from event to verification result.
- Counterfactual/adversarial case analysis.
- Replay-divergence inspection.
- Evidence graph visualization.
- A dedicated architecture view documenting system boundaries.
- TypeScript, React, TanStack Router, Vite, and a server-side runtime.
- Automated type checking, linting, formatting, tests, and CI quality gates.

## Architecture

The implementation is deliberately split into layers:

```text
src/
├── components/wb/       Workbench presentation layer
├── routes/              Application views
└── lib/
    ├── compiler/        Compilation, Rho, QLF, hashing, observation
    ├── app-data/        Application data and readiness boundaries
    └── multiplayer/     Peer-to-peer transport boundary

server/                  Optional server/runtime integration
scripts/                 Build, migration, preview, and verification tooling
docs/                    Architecture and engineering documentation
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the system model and [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) for the engineering workflow.

## Verification model

The project treats verification as a first-class artifact rather than a UI decoration. A useful result should expose:

1. The claim being evaluated.
2. The source execution or synthetic fixture.
3. The transformation/compilation steps.
4. The evidence attached to the claim.
5. The verification predicates that were evaluated.
6. Any adversarial mutation or replay divergence.
7. The final deterministic result and its provenance.

This separation makes it possible to replace synthetic fixtures with real chain evidence later without changing the conceptual verification boundary.

## Development

Requirements:

- Node.js with npm
- A modern browser for the workbench

Install dependencies and run the development server:

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

Formatting:

```bash
npm run format
```

The same gates run in GitHub Actions for pushes to `main` and pull requests targeting `main`.

## Project principles

**Determinism.** Equivalent inputs should produce reproducible verification results.

**Provenance.** A result is only useful when its origin and transformation path can be inspected.

**Explicit boundaries.** Live chain state, synthetic fixtures, transport, and presentation are separate concerns.

**Adversarial by design.** Verification must account for malformed, contradictory, divergent, and replayed evidence rather than only the happy path.

**Evidence over assertion.** The system should expose the material needed to reproduce or independently inspect a result.

## Relationship to RChain and QLF

This repository is an independent research and engineering implementation. It is intended to provide adapters and verification-oriented tooling around RChain-shaped execution and Quantum Logical Framework concepts; it is not presented as an official RChain implementation.

Where an external protocol, repository, or specification is used, the implementation should preserve that boundary explicitly in code and documentation.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md). Changes that affect verification semantics should include tests and a short explanation of the invariant being preserved or changed.

## Security

See [`SECURITY.md`](SECURITY.md) for responsible vulnerability reporting and the project's security scope.

## License

No license is declared in this repository yet. Until a license is added, assume that the repository contents remain under the copyright of their respective rights holders and are not automatically licensed for reuse.
