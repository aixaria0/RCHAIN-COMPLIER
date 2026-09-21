# Casper CBC Evidence Matrix

This document is the compact evidence map for the current research branch. It separates exact upstream observations from deterministic harness observations and from conclusions that still require protocol-impact evidence.

## Exact upstream pin

```text
rchain-community/rchain-rust
d92f0787a6096cd6d79864ec2d7c1dd9b6912d0b
```

Every upstream probe in this matrix checks out that exact revision before injection.

## Boundary chain

| Milestone | Boundary exercised | Evidence | What it establishes |
|---|---|---|---|
| M11.5 | Finalizer | Real `Finalizer::calculate_finalization` | Count-only minimum-message gate admits duplicate sender entries and finalization advances |
| M11.6 | Casper `block_summary` | Real `rchain_casper::validate::block_summary` | Duplicate-sender justification shape is not rejected by the active summary path |
| M11.7–M11.9 | Pre-state + full validator | Real `get_pre_state_for_parents` + `MultiParentCasper::validate` | Candidate reaches the real validation pipeline |
| M12 | BlockReceiver | Real content-addressed hash + signature + `BlockReceiver::apply` | A correctly formed candidate crosses cryptographic ingress and reaches validation |
| M13 | NodeRunning | Real `NodeRunning::handle` | A decoded `CasperMessage::BlockMessage` reaches the bounded block-ingress queue |
| M14 | Finalizer output | Real public `calculate_finalization` | Under the duplicate shape, the returned fringe has fewer sender identities than the bond set |
| M15 | Persistent DAG state | Real `BlockDagKeyValueStorage` / `DagRepresentation` | An under-cardinality fringe is representable and consumed by global finality-state helpers |
| M16 | Counterfactual gate | Exact upstream code + local invariant | Sender-set equality is a narrow remediation hypothesis; no upstream code is changed |
| M17 | Stake distribution | Exact upstream Finalizer | The under-cardinality witness survives equal 25/25/25/25 stake |
| M18 | Threshold boundary | Exact upstream Finalizer | 2/3 remains non-finalizing; 3/4 finalizes under the same cardinality shape |

## Interpretation ladder

The current evidence supports these statements:

1. The pinned implementation uses an entry-count minimum-message gate rather than a distinct-sender coverage gate.
2. The same revision uses sender-keyed structures in the next-layer/finalization calculation.
3. A controlled duplicate-sender candidate can therefore pass the count gate and produce a smaller sender set in the returned fringe.
4. A real signed and content-addressed `BlockMessage` carrying the shape can cross the checked NodeRunning/BlockReceiver/validation boundaries in the harness probes.
5. The resulting under-cardinality fringe is representable in the DAG finality state machinery.
6. The behavior is not currently characterized as Rust-only: the pinned repository's legacy Scala Finalizer contains the same count-only and sender-keyed pattern.
7. The pinned repository's reconstructed TLA+ model describes Law 15 with one latest message per bonded validator, so the runtime observation is a concrete implementation-vs-reconstructed-invariant discrepancy.

## Claims deliberately not made

This project does not currently claim:

- a deployed mainnet vulnerability;
- a proven conflicting-finality / double-finalization safety failure;
- a network-level exploit;
- an economic attack path;
- that the proposed sender-set check is already an accepted upstream fix.

Those claims require additional protocol-impact, deployment-version, and compatibility evidence.

## Research boundary

The next decisive test is downstream impact:

```text
under-cardinality fringe
        |
subsequent validator proposals
        |
merge / pre-state evolution
        |
fork-sensitive or safety-relevant consequence?
        |
yes -> characterize precisely
no  -> characterize as liveness / estimation / invariant divergence
```

The research should not skip this step merely because the implementation mismatch is reproducible.

## Reproduction

The repository contains one workflow per major upstream boundary under `.github/workflows/`, with corresponding injected probes under `scripts/upstream/`.

For a review, the most informative sequence is M11.5 -> M11.6 -> M11.7–M11.9 -> M12 -> M13 -> M14 -> M15 -> M16 -> M17 -> M18.



## Formal-status precision

The pinned repository's docs/src/formal/the-29-laws.md explicitly marks the Law-14 fringe antichain predicate and the Law-15 fringe_monotone / seen_monotone lemmas as **stated** in Lean. The table therefore distinguishes implementation behavior observed by the upstream probes, a reconstructed/model invariant, and formally *stated* Lean properties.

This research does not describe the Law-15 fringe cardinality property as a formally proven deployed theorem.


## Honest-proposer vs adversarial-input boundary

The pinned Rust proposer normally derives block parents from `pre_state.justifications`, and that pre-state is built from the DAG fringe. The normal proposer path therefore follows the one-message-per-validator fringe shape.

The research candidate is intentionally different: it is an adversarially constructed but correctly signed `BlockMessage` whose justification hashes are all valid DAG messages while two belong to the same sender. M11.6 and M12 show that the consensus/receiver path does not enforce distinct bonded-sender coverage for that input shape.

This distinction matters. The current evidence is not "honest nodes naturally generate duplicate fringes"; it is "the checked consensus path accepts a malformed-but-signed justification shape that the normal proposer path would not emit."