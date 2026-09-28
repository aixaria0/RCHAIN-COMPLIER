# v1 Release Boundary

## Included

v1 includes deterministic verification outcomes, bounded lexicographic repair search, repair packaging, pinned native Rust replay for the CBC fixture, native receipt binding, portable cross-repository evidence transport, read-only inspection, and independent evidence-root attestation.

## Completion gates

1. Verification and repair tests are fail-closed.
2. Original evidence replays exactly before repair search.
3. Repair preserves claim identity, scope, assumptions, and verifier identity.
4. Native replay runs against the pinned upstream implementation.
5. Native receipt is bound to the compiler-selected repair.
6. Portable propagation preserves transitive digests and provenance.
7. Downstream consumers reject malformed digests or absent native replay.
8. Independent attestation binds evidence roots without claiming target-protocol consensus.

## Explicit non-claims

v1 does not establish live-network ingress, production-wide Casper safety, physical correctness of external scientific subjects, or equivalence between Sovereign-Lattice PBFT and Casper CBC finality.

## v2 boundary

Temporal assurance graphs, regression localization, verifier diversity/disagreement analysis, and broader repair synthesis belong to v2 and must not be back-claimed into v1 evidence.
