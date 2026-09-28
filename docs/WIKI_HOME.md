# RCHAIN-COMPLIER Documentation Hub

This hub summarizes the default-branch Casper CBC research and important independent research branches without merging their code histories. The v1 assurance path keeps verification, repair, native implementation replay, evidence transport, inspection, and independent root attestation as separate trust boundaries.

## Start here

- [Research Branch Atlas](RESEARCH_BRANCH_ATLAS.md)

- [Architecture](ARCHITECTURE.md)
- [Assurance Fabric](ASSURANCE_FABRIC.md)
- [Protocol-Agnostic Verification Compiler](PROTOCOL_AGNOSTIC_VERIFICATION_COMPILER.md)
- [Minimal Repair Compiler](MINIMAL_REPAIR_COMPILER.md)
- [Casper CBC Research Status](CASPER_CBC_RESEARCH_STATUS.md)
- [v1 Release Boundary](V1_RELEASE_BOUNDARY.md)
- [Cross-Repository Assurance Contract](CROSS_REPO_ASSURANCE_CONTRACT.md)
- [Four-Repository v1 Integration](FOUR_REPO_V1_INTEGRATION.md)
- [v1 Schema Index](V1_SCHEMA_INDEX.md)
- [v1 Baseline Manifest](V1_BASELINE_MANIFEST.md)
- [Failure Containment](FAILURE_CONTAINMENT.md)
- [Development](DEVELOPMENT.md)

## v1 evidence path

```text
VerificationProblem
  -> VerificationArtifact
  -> Minimal Repair
  -> Post-repair Verification
  -> Pinned Native Rust Replay
  -> Native Repair Binding
  -> Portable Propagation Envelope
  -> Sentinel Observation
  -> rlsenti Inspection
  -> Sovereign-Lattice Evidence-Root Attestation
```

Every arrow is a boundary, not permission to strengthen the claim. A digest establishes identity/integrity relative to bytes; a signature or attestation establishes binding to a key/root; neither establishes semantic truth by itself.

## Repository map

- **RCHAIN-COMPLIER** — primary compiler and documentation hub.
- **rchain-sentinel** — observation/transport validation boundary.
- **rlsenti** — read-only inspection boundary.
- **Sovereign-Lattice** — independent evidence-root attestation boundary.

The root `index.html` is the visual landing page for this same architecture.
