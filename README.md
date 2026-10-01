# Causal Assurance Framework

**A protocol-independent verification and evidence framework for turning bounded technical claims into reproducible, inspectable, cryptographically bound assurance artifacts.**

[![CI](https://github.com/aixaria0/RCHAIN-COMPLIER/actions/workflows/ci.yml/badge.svg)](https://github.com/aixaria0/RCHAIN-COMPLIER/actions/workflows/ci.yml)
[![Verification Core CI](https://github.com/aixaria0/RCHAIN-COMPLIER/actions/workflows/verification-core-ci.yml/badge.svg)](https://github.com/aixaria0/RCHAIN-COMPLIER/actions/workflows/verification-core-ci.yml)
[![Reality Plane CI](https://github.com/aixaria0/RCHAIN-COMPLIER/actions/workflows/reality-ci.yml/badge.svg)](https://github.com/aixaria0/RCHAIN-COMPLIER/actions/workflows/reality-ci.yml)
[![Assurance Provenance](https://github.com/aixaria0/RCHAIN-COMPLIER/actions/workflows/assurance-provenance.yml/badge.svg)](https://github.com/aixaria0/RCHAIN-COMPLIER/actions/workflows/assurance-provenance.yml)

The project combines a verification compiler, evidence binding, replay/provenance checks, and a crash-safe multi-process audit lifecycle. RChain/Casper is the first serious external target, but the core is deliberately protocol-independent.

## What it does

```text
verification problem / witness
            │
            ▼
observation evidence
            │
            ▼
replay + provenance checks
            │
            ▼
portable assurance package
            │
            ▼
canonical package root
            │
            ▼
pinned-key Ed25519 signature
            │
            ▼
optional independent review
```

The governing rule is simple:

> **A claim must never become stronger while moving through the pipeline unless new evidence explicitly justifies the stronger claim.**

So, by construction:

```text
missing evidence   != PASS
INCONCLUSIVE       != PASS
hash integrity     != truth
signature validity != trust
replay success     != production safety
```

## Current status

| Area | Status |
|---|---|
| Protocol-independent assurance baseline | ✅ Implemented and CI-gated — PR #21 |
| Portable packages / canonical roots / Ed25519 | ✅ Implemented |
| Cross-repository assurance path | ✅ Implemented and documented |
| Intelligence Lattice event core | ✅ On `main` |
| Three-process lifecycle | ✅ Merged — PR #27 |
| Separate identities + SQLite WAL journals | ✅ Tested |
| TaskEnvelope-bound provenance | ✅ Tested |
| Real `SIGKILL` + restart/rejoin | ✅ Tested |
| Deterministic exported-event replay | ✅ Tested |
| Signed build provenance | ✅ Gated |
| Live unresolved `rchain-rust` witness through this lifecycle | ⏭️ Next milestone |
| Byzantine consensus / production safety claim | ❌ Not claimed |

## Current milestone: PR #27

[PR #27 — Intelligence Lattice: three-process lifecycle gate](https://github.com/aixaria0/RCHAIN-COMPLIER/pull/27) moves the evidence lifecycle across real OS process boundaries.

It exercises three distinct Ed25519 identities and SQLite WAL-backed journals, two independent deterministic verification workers, TaskEnvelope-bound contributions, invalid-task containment, a real coordinator `SIGKILL`, restart/rejoin, convergence, and deterministic replay.

A correctly signed contribution for the wrong task is still rejected. Killing a process does not turn invalid evidence into valid evidence.

That is the current demonstrated boundary.

## Quickstart

Requires a modern Node.js runtime with support for the project's `--experimental-strip-types` workflows.

```bash
npm ci
npm run demo
```

The default demo runs the three-process evidence lifecycle.

Useful gates:

```bash
npm run test:lattice
npm run typecheck:lattice
npm run lint:lattice
npm run test:verification-core
npm test
```

## RChain integration boundary

The earlier PoS/slashing work helped establish the evidence-first method, but already-resolved trust/slash paths are **not** presented as current open problems.

PR #27 still does **not** execute `rchain-rust` directly.

The next external milestone is:

```text
rchain-rust source + exact input provenance
        ↓
TaskEnvelope
        ↓
execution evidence
        ↓
persisted pre/post-state observations
        ↓
process failure / recovery
        ↓
deterministic replay
        ↓
independently verifiable audit artifact
```

The target should be one **active, unresolved** RChain witness whose result is not known in advance.

## Repository map

- [Architecture](docs/ARCHITECTURE.md)
- [Assurance Fabric](docs/ASSURANCE_FABRIC.md)
- [Intelligence Lattice Event Core](docs/INTELLIGENCE_LATTICE_EVENT_CORE.md)
- [Four-Repository Assurance](docs/FOUR_REPO_ASSURANCE.md)
- [Casper CBC Research Status](docs/CASPER_CBC_RESEARCH_STATUS.md)
- [Research Branch Atlas](docs/RESEARCH_BRANCH_ATLAS.md)
- [Schema Index](docs/V1_SCHEMA_INDEX.md)
- [Release Boundary](docs/V1_RELEASE_BOUNDARY.md)
- [Documentation Hub](docs/WIKI_HOME.md)
- [Archived full project reference](docs/PROJECT_REFERENCE_2026-10-02.md)

## Research branches

Historical research branches are intentionally preserved even when their old pull requests are closed. They contain useful experimental lineage, but an open PR is no longer used as a storage mechanism for archival research.

See [Research Branch Atlas](docs/RESEARCH_BRANCH_ATLAS.md) for the map.

## Security

This repository deals with consensus-sensitive and assurance-sensitive behavior. Do not publish actionable network exploits, credentials, private keys, or unpublished operational details in public issues.

See [SECURITY.md](SECURITY.md).

## License

This repository currently uses an **all-rights-reserved proprietary license**. Public visibility does not grant reuse rights.

See [LICENSE](LICENSE).
