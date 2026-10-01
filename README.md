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
| Active unresolved `rchain-rust` witness through this lifecycle | ✅ C192 / Issue #172 — PR #28 |
| Byzantine consensus / production safety claim | ❌ Not claimed |

## Current milestone: PR #28

[PR #28 — unresolved RChain C192 witness](https://github.com/aixaria0/RCHAIN-COMPLIER/pull/28) is the first active upstream RChain finding carried through the evidence lifecycle end to end.

The CI gate checks out `rchain-community/rchain-rust@51935310789a1a75a183ad0af7152e4eef450c88`, executes the upstream C192 falsifier `a_round_that_comes_to_rest_at_one_height_is_sealed_by_its_own_bound`, binds the source/evidence/output digests into a TaskEnvelope, obtains two independent verification receipts, kills and restarts the coordinator, rejoins the three-process lifecycle, and independently replays the exported event history.

The demonstrated claim is deliberately narrow:

> **The pinned upstream C192 unit falsifier executed successfully at the declared revision, and that execution artifact remained task-bound and replayable through the three-process evidence lifecycle.**

This is a real upstream execution boundary. It is **not** a claim that Issue #172 is fixed, that the multi-validator devnet measurement was rerun, or that a safe C192/C171 repair has been designed.

See [RChain C192 Live Witness](docs/RCHAIN_C192_LIVE_WITNESS.md).

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

The C192 integration is reproduced in CI from the pinned upstream revision and then passed into the local three-process lifecycle.

## RChain integration boundary

The earlier PoS/slashing work established the evidence-first method; already-resolved trust/slash paths are **not** presented as current open problems.

PR #28 now crosses the first external RChain boundary:

```text
pinned rchain-rust source
        ↓
real upstream C192 cargo test
        ↓
source / evidence / output digests
        ↓
TaskEnvelope
        ↓
two independent verification workers
        ↓
reproduction certificate
        ↓
SIGKILL + SQLite journal recovery
        ↓
three-process convergence
        ↓
independent deterministic replay
```

The next boundary is not another fixture. It is to evaluate a candidate repair against **both sides of the same attestation-tap tension**:

- C192 / Issue #172: a round that comes to rest at one height must be able to advance;
- C171 / Issue #149: the advance mechanism must remain bounded and must not reintroduce the all-live block storm.

That repair should be tested first against the paired unit falsifiers, then against the relevant controlled multi-validator devnet arms before any production-liveness claim is made.

## Repository map

- [Architecture](docs/ARCHITECTURE.md)
- [Assurance Fabric](docs/ASSURANCE_FABRIC.md)
- [Intelligence Lattice Event Core](docs/INTELLIGENCE_LATTICE_EVENT_CORE.md)
- [RChain C192 Live Witness](docs/RCHAIN_C192_LIVE_WITNESS.md)
- [RChain C192 / C171 Paired Evaluator](docs/RCHAIN_C192_C171_PAIRED_EVALUATOR.md)
- [RChain C192 / C171 Disposable Rust Gate](docs/RCHAIN_C192_C171_RUST_GATE.md)
- [RChain C192 / C171 Production Wiring Gate](docs/RCHAIN_C192_C171_PRODUCTION_WIRING.md)\n- [RChain C192 / C171 Devnet Smoke](docs/RCHAIN_C192_C171_DEVNET_SMOKE.md)
- [Four-Repository Assurance](docs/FOUR_REPO_ASSURANCE.md)
- [Casper CBC Research Status](docs/CASPER_CBC_RESEARCH_STATUS.md)
- [Research Branch Atlas](docs/RESEARCH_BRANCH_ATLAS.md)
- [Schema Index](docs/V1_SCHEMA_INDEX.md)
- [Release Boundary](docs/V1_RELEASE_BOUNDARY.md)
- [Documentation Hub](docs/WIKI_HOME.md)
- [Ecosystem comparison](docs/ECOSYSTEM_COMPARISON.md)
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
