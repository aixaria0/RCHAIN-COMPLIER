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
| Paired C192/C171 candidate evaluator | ✅ Merged — PR #30 |
| Disposable paired Rust gate | ✅ Merged — PR #31 |
| Disposable production-path wiring | ✅ Compiled/tested — PR #32 |
| Controlled N=3 devnet smoke | ✅ PASS — PR #33 |
| Repeated 180 s controlled campaign | ⏭️ Next gate |
| Byzantine consensus / production safety claim | ❌ Not claimed |

## Current milestone: PR #33

[PR #33 — controlled C192/C171 devnet smoke](https://github.com/aixaria0/RCHAIN-COMPLIER/pull/33) is the first network-level comparison of the pinned upstream control against the disposable production-path candidate.

The N=3, no-autopropose smoke used the upstream n149 sampler and the same pinned revision on both arms.

Observed in the green run:

- **control:** 3 post-deploy blocks, 3 senders, no finality in the 90 s window;
- **candidate:** 12 post-deploy blocks, 3 senders, finality in **3 s**;
- zero failed block reads;
- zero idle-window blocks;
- one deploy-bearing block in each arm.

The candidate stayed below the pre-run CI smoke ceiling of 36 post-deploy blocks. That ceiling is intentionally **not** presented as a protocol bound or C171 closure; its original rationale misread an upstream height-rate as a block-rate, so the numeric boundary was retained rather than moved after observing candidate data.

The accurate claim is:

> **On one controlled N=3 devnet smoke attempt, the disposable candidate restored finality where the pinned control reproduced C192, while remaining below the frozen smoke-growth ceiling.**

This does not close C192 or C171. The next gate is the repeated 180-second campaign with unfiltered attempts and an explicit block-rate reading.

See [RChain C192 / C171 Devnet Smoke](docs/RCHAIN_C192_C171_DEVNET_SMOKE.md).

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

The RChain path has now crossed four increasingly external boundaries:

```text
PR #28
pinned upstream C192 witness
        ↓
PR #30
paired C192/C171 candidate model
        ↓
PR #31
paired Rust scheduling gate
        ↓
PR #32
disposable production-path wiring
        ↓
PR #33
controlled N=3 devnet smoke
```

The PR #33 control reproduced the registered C192 shape: three post-deploy blocks from three senders and no finality in the 90-second window.

The disposable candidate changed that observed network behavior: twelve post-deploy blocks, three senders, and finality in 3 seconds, with no failed block reads and no idle-window blocks.

That is enough to justify a heavier campaign. It is not enough to claim the defect fixed.

The next boundary is therefore:

- repeat the N=3 control/candidate comparison for at least three unfiltered attempts;
- restore the original 180-second reading window;
- keep block counts and height counts separate;
- preregister the C171 rate quantity and unit explicitly;
- retain the unmodified pinned tree as the control.

No upstream PR should be opened from this repository until that repeated gate is green.

## Repository map

- [Architecture](docs/ARCHITECTURE.md)
- [Assurance Fabric](docs/ASSURANCE_FABRIC.md)
- [Intelligence Lattice Event Core](docs/INTELLIGENCE_LATTICE_EVENT_CORE.md)
- [RChain C192 Live Witness](docs/RCHAIN_C192_LIVE_WITNESS.md)
- [RChain C192 / C171 Paired Evaluator](docs/RCHAIN_C192_C171_PAIRED_EVALUATOR.md)
- [RChain C192 / C171 Disposable Rust Gate](docs/RCHAIN_C192_C171_RUST_GATE.md)
- [RChain C192 / C171 Production Wiring Gate](docs/RCHAIN_C192_C171_PRODUCTION_WIRING.md)\n- [RChain C192 / C171 Devnet Smoke](docs/RCHAIN_C192_C171_DEVNET_SMOKE.md)\n- [RChain C192 Repeated Campaign](docs/RCHAIN_C192_REPEATED_CAMPAIGN.md)
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
