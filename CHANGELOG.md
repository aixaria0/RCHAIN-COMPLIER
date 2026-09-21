# Changelog

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
