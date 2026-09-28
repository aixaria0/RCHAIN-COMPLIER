# Four-Repository Assurance Fabric

This document mirrors the v1 integration contracts into the primary repository so the complete system can be reviewed from one source.

## Components

### RCHAIN-COMPLIER — producer
Compiles bounded verification evidence, searches the declared repair space, verifies the post-repair state, replays the selected CBC repair against the pinned upstream Rust implementation, binds the native receipt, and emits the portable propagation envelope.

### rchain-sentinel — observer
Consumes `causal-assurance-repair-propagation/v1`, validates transport structure, provenance and canonical digest syntax, requires native replay verification, and derives a deterministic observation digest.

### rlsenti — inspector
Performs read-only structural inspection of the portable repair envelope. It preserves the producer's claim boundary and does not turn presentation state into evidence authority.

### Sovereign-Lattice — independent attestor
Domain-separates and binds the propagation-envelope digest, Sentinel observation digest, repair problem identity and native-replay eligibility into an independent evidence root. PBFT consensus is not treated as equivalent to Casper CBC.

## End-to-end chain

```text
VerificationProblem
  │
  ├─ bounded verification
  ▼
VerificationArtifact
  │
  ├─ lexicographic repair search
  ▼
RepairArtifact
  │
  ├─ post-repair verification
  ▼
RepairPackage / Signed Root
  │
  ├─ pinned upstream Rust replay
  ▼
Native Replay Receipt
  │
  ├─ compiler/native binding
  ▼
Native Repair Binding
  │
  ├─ portable transport
  ▼
Propagation Envelope
  │
  ├─ Sentinel observation
  ▼
Sentinel Observation Digest
  │
  ├─ read-only inspection
  ▼
rlsenti
  │
  └─ independent evidence-root binding
  ▼
Sovereign-Lattice Attestation
```

## Fail-closed invariant

Mutation of an upstream identity or digest requires rebuilding every legitimately dependent downstream artifact. A stale downstream artifact must not remain valid after an upstream mutation.

## Semantic invariant

`integrity != truth`, `signature validity != trust`, `transport acceptance != protocol safety`, `native replay != live-network safety`, and `PBFT attestation != Casper finality`.
