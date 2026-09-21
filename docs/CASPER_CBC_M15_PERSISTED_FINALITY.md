# M15 — Persisted DAG Finality State

M14 established that the pinned Finalizer can return a three-member fringe for a four-validator bond set.

M15 follows that value into the real BlockDagKeyValueStorage insertion path.

The candidate metadata is inserted with the three-member fringe:

    a1, b1, c1

The exact upstream storage implementation then:

1. persists the metadata;
2. computes and stores FringeData for that fringe;
3. inserts the message into DagMessageState;
4. exposes the same fringe through DagRepresentation.latest_fringe();
5. derives global finalized_blocks_set() from the latest fringe's seen closure.

The probe verifies that the global representation now reports a1/a2, b1/b2 and c1/c2 as finalized while d2, the bonded v3 branch, is not in the finalized closure.

## Why this matters

The observation has crossed another architectural boundary:

    Finalizer output
          |
    BlockMetadata.fringe
          |
    BlockDagKeyValueStorage.insert
          |
    FringeData + DagMessageState
          |
    DagRepresentation.latest_fringe
          |
    finalized_blocks_set()

This is still not sufficient to label the network unsafe. It does establish that the under-cardinality result is representable and consumable by the persistent DAG state machinery, rather than disappearing as a transient calculator artifact.

The next question is the protocol effect of carrying this state forward across subsequent validator proposals and conflicting histories.
