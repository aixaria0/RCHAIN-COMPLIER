# Changelog

## Assurance Engine 0.3.0 — release candidate

- Add a separately packaged, typed Node SDK and `assurance` CLI around the existing signed lattice/journal/compiler architecture.
- Add versioned generic workloads, canonical NDJSON evidence packages, explicit external reviewer pins and PASS/BLOCKED/FAIL reports.
- Make the three-process lifecycle reusable with persistent identities, SQLite supervisor ownership, idempotent submission and restart/rejoin.
- Thread integration registries through workers/journals/replay; extract the existing C192 verifier without changing its historical artifacts or defaults.
- Add package/adversarial/recovery tests, offline consumer and declaration verification, Node 22/24 product CI, checksums and public sample artifacts.
- Preserve existing dashboard/compiler APIs, RChain workflows, signed schemas and evidence lineage; document limits, security boundaries and migration/release policy.

The distributable is versioned independently of the existing private 0.2.0 repository/UI package. The original license remains unchanged. No upstream RChain repair, network finality, hidden-evidence completeness or maximum performance score is claimed.

## Unreleased — public Casper CBC research milestone

### Added

- deterministic Casper CBC adversarial and stress model;
- concrete DAG and message construction;
- upstream reachability screening;
- pinned upstream Finalizer reproducer;
- active Casper block-summary admission probe;
- pre-state / Finalizer bridge;
- full MultiParentCasper validation probe;
- public research-status documentation;
- security and contribution guidance.

### Verified

- duplicate-minimum-message Finalizer behavior reproduced in upstream Rust;
- duplicate-sender justification shape accepted by active block-summary validation;
- the controlled candidate traverses pre-state reconstruction and full MultiParentCasper validation in the pinned upstream fixture;
- repository CI, Reality Plane CI, and upstream bridge workflows are green on the publication candidate.

### Scope

The verified result is an implementation behavior under a deterministic controlled fixture, not a claim of a live-network vulnerability.
