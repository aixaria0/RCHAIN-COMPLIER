# RCHAIN-COMPLIER Wiki Home

RCHAIN-COMPLIER is a protocol-agnostic verification and bounded-repair compiler with a Casper CBC research implementation. The v1 assurance path keeps verification, repair, native implementation replay, evidence transport, inspection, and independent root attestation as separate trust boundaries.

## Start here

- [Architecture](ARCHITECTURE.md)
- [Assurance Fabric](ASSURANCE_FABRIC.md)
- [Protocol-Agnostic Verification Compiler](PROTOCOL_AGNOSTIC_VERIFICATION_COMPILER.md)
- [Minimal Repair Compiler](MINIMAL_REPAIR_COMPILER.md)
- [Casper CBC Research Status](CASPER_CBC_RESEARCH_STATUS.md)
- [v1 Release Boundary](V1_RELEASE_BOUNDARY.md)
- [Cross-Repository Assurance Contract](CROSS_REPO_ASSURANCE_CONTRACT.md)
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
