# Research Branch Atlas

This page is a documentation-only map of the repository's major research lines. It intentionally does **not** merge their code or histories.

## Main — upstream Casper CBC execution baseline

The default branch contains the deterministic Casper CBC stress harness and controlled upstream Rust reproduction path. It keeps synthetic modeling, upstream-facing observation, native execution, and evidence separate.

Pinned implementation used by the documented CBC reproduction:

`rchain-community/rchain-rust@d92f0787a6096cd6d79864ec2d7c1dd9b6912d0b`

The documented controlled candidate exercises duplicate minimum-message sender coverage through upstream finalization/validation code. This is an implementation-behavior result under a controlled fixture, not a production-network vulnerability claim.

## CBC fork-drift / conformance line

Important branches:
- `feature/casper-cbc-stress-harness`
- `feat/cbc-fork-drift-evidence`
- `feat/casper-slashing-conformance`
- `research/casper-slashing-persistence-evidence`
- `research/m12-cryptographic-ingress-boundary`

This family extends the CBC research toward deterministic adversarial DAGs, implementation-boundary evidence, conformance checks, persistence/slashing research, and the cryptographic ingress boundary.

These branches remain independent research lines. Their presence here is descriptive, not a claim that every branch result has been incorporated into `main`.

## Reality Compiler line

Important branches:
- `feature/reality-calculus`
- `feature/reality-engine-core`
- `feature/reality-engine-proof-core`
- `feature/reality-evidence-plane`
- `feature/reality-loop`
- `feat/reality-plane-maintainer-loop`

This family develops the evidence-oriented compiler/workbench:

```text
Execution
  -> Trace
  -> state / block evidence
  -> evidence envelope
  -> verification
  -> Reality Record
  -> human-auditable result
```

Its central contribution is separation of observation from verification and deterministic, portable provenance. A `VERIFIED` result means configured predicates passed over supplied evidence; it does not by itself establish protocol finality.

## Causal Assurance / Repair Compiler v1

Branch:
- `feat/assurance-fabric-v1`

This line generalizes the earlier work into a protocol-independent assurance compiler:

```text
bounded verification
  -> minimal repair
  -> post-repair verification
  -> pinned native replay
  -> native repair binding
  -> portable propagation
  -> observation
  -> inspection
  -> independent evidence-root attestation
```

The implementation is distributed across RCHAIN-COMPLIER, rchain-sentinel, rlsenti, and Sovereign-Lattice. The branch remains independent and is not merged into `main`.

## How the lines relate

```text
Reality Compiler
  evidence + causality + replay vocabulary
              │
              ▼
Casper CBC stress/conformance
  adversarial DAG + upstream Rust evidence
              │
              ▼
Causal Assurance v1
  generic verification + repair + transitive assurance
```

This is a conceptual lineage, not Git ancestry or a claim that all code is present on the default branch.

## Repository rule

The default branch may carry documentation snapshots describing verified work on independent branches. Copying documentation to `main` does not merge branch code, change branch ancestry, or promote branch-only implementation into default-branch functionality.
