# M14 — Fringe Cardinality Invariant

## The stronger observation

Earlier milestones established that the duplicate-sender minimum-message shape passes the pinned Finalizer gate and reaches the finalization calculation.

M14 measures the output invariant itself.

For the four-validator stake distribution:

    v0 = 70
    v1 = 10
    v2 = 10
    v3 = 10

the controlled duplicate-minimum candidate supplies four minimum-message entries:

    v0, v0, v1, v2

The exact upstream Finalizer check accepts this because it compares the number of entries with the number of bonded validators.

The exact upstream calculate_next_layer then stores messages in a sender-keyed BTreeMap, collapsing the duplicate v0. The resulting layer has only:

    v0, v1, v2

The M14 probe then calls the public calculate_finalization path and observes a new fringe with exactly three messages, omitting v3.

## Why this is stronger

This is no longer only an input-admission observation.

It is an output-level invariant observation:

    4 bonded validators
            |
    4 minimum-message entries
    (v0, v0, v1, v2)
            |
    check_min_messages == true
            |
    sender-keyed next layer
            |
    3 sender identities
    (v0, v1, v2)
            |
    calculate_finalization
            |
    3-member fringe
    (v0, v1, v2)

The same pinned repository's consensus documentation describes the fringe as containing one message per bonded validator. M14 demonstrates that the implementation's public finalization path can return a smaller sender set under this controlled candidate.

## Evidence boundary

This is a concrete implementation invariant mismatch, not yet a statement that deployed consensus is unsafe.

The remaining question is downstream impact: what exact node behavior consumes this under-cardinality fringe, and can it produce divergent finality, incorrect state selection, or only a recoverable liveness or estimation condition?

No network or economic-exploit claim is made here.


## Historical parity

This is not currently identified as a Rust-only regression. The same pinned repository also contains the legacy Scala Finalizer, whose checkMinMessages implementation uses the same count-only predicate:

    minMsgs.size == bondsMap.size

Its calculateNextLayer implementation is likewise sender-keyed. The repository therefore supports a narrower historical interpretation: the observed behavior is inherited across the Scala-to-Rust implementation lineage at this revision. Determining whether the behavior is compatible with the intended protocol specification remains a separate question.
