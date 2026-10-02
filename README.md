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
| Repeated 180 s controlled campaign | ✅ PASS — PR #34 |
| C171 pace-effect causal gate | ⏭️ Next gate |
| Byzantine consensus / production safety claim | ❌ Not claimed |

## Current milestone: PR #34

[PR #34 — repeated C192 control/candidate campaign](https://github.com/aixaria0/RCHAIN-COMPLIER/pull/34) repeated the N=3 comparison with the original 60/60/180 timing and three unfiltered attempts per arm.

The result was deterministic across all six network attempts:

| Arm | Attempt 1 | Attempt 2 | Attempt 3 | Finality |
|---|---:|---:|---:|---|
| unmodified control | 3 blocks | 3 blocks | 3 blocks | never in 180 s, all 3 attempts |
| disposable candidate | 12 blocks | 12 blocks | 12 blocks | **3 s, all 3 attempts** |

Every attempt had:

- 3 sampled nodes;
- 3 post-deploy senders;
- exactly one deploy-bearing block;
- zero idle-window blocks;
- zero failed block reads;
- zero void attempts.

So the smoke result from PR #33 was not a one-run accident.

The bounded claim now supported is:

> **On the pinned N=3 no-autopropose rig, the unmodified control reproduced the C192 no-finality condition in all three unfiltered 180-second attempts, while the disposable production-path candidate finalized in 3 seconds in all three attempts under the same protocol.**

This still does **not** close C171. The same run recorded 12 candidate blocks versus 3 control blocks per 180-second window, but the control is stalled; treating its smaller count as a rate win would be exactly the wrong conclusion.

The next gate therefore isolates C171's cadence term with a matched negative control.

See [RChain C192 Repeated Campaign](docs/RCHAIN_C192_REPEATED_CAMPAIGN.md).

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

The RChain path has now crossed five increasingly external boundaries:

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
        ↓
PR #34
three-attempt 60/60/180 C192 campaign
```

PR #34 reproduced the baseline defect three times: each control attempt produced 3 post-deploy blocks from 3 senders and never finalized inside 180 seconds.

The same pinned rig with the disposable candidate produced 12 post-deploy blocks in every attempt and finalized in 3 seconds every time.

That is strong repeatability evidence for the C192 half of the change. It is not yet a C171 result.

The next boundary is deliberately causal rather than threshold-driven:

- keep the C192 self-trigger and strict-height behavior fixed;
- run the candidate with its own-quiet cadence term;
- run a matched negative control with only that cadence term removed;
- use three unfiltered N=3 attempts per arm under the same 60/60/180 protocol;
- record distinct post-deploy block hashes per 180-second window and time-to-finality together;
- require the negative control to become observably worse before claiming the pace term has a network-level effect.

No absolute C171 block ceiling is inferred from PR #34, and no upstream production-readiness claim follows from it.

## Repository map

- [Architecture](docs/ARCHITECTURE.md)
- [Assurance Fabric](docs/ASSURANCE_FABRIC.md)
- [Intelligence Lattice Event Core](docs/INTELLIGENCE_LATTICE_EVENT_CORE.md)
- [RChain C192 Live Witness](docs/RCHAIN_C192_LIVE_WITNESS.md)
- [RChain C192 / C171 Paired Evaluator](docs/RCHAIN_C192_C171_PAIRED_EVALUATOR.md)
- [RChain C192 / C171 Disposable Rust Gate](docs/RCHAIN_C192_C171_RUST_GATE.md)
- [RChain C192 / C171 Production Wiring Gate](docs/RCHAIN_C192_C171_PRODUCTION_WIRING.md)
- [RChain C192 / C171 Devnet Smoke](docs/RCHAIN_C192_C171_DEVNET_SMOKE.md)
- [RChain C192 Repeated Campaign](docs/RCHAIN_C192_REPEATED_CAMPAIGN.md)
- [RChain C171 Pace Effect Preregistration](docs/RCHAIN_C171_PACE_EFFECT_PREREGISTRATION.md)
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
