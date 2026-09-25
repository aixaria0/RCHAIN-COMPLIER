# M18 — Exact Threshold Boundary

M18 isolates the two separate properties involved in the research:

1. The finality threshold itself remains strict. With three equal validators, a duplicate-minimum shape can leave two unique senders carrying exactly 2/3 stake, and the pinned Finalizer does not finalize.
2. The cardinality gap becomes observable at the smallest equal-stake validator count where a proper supermajority can be formed by fewer than all validators: four validators. Three of four equal senders carry 3/4 stake, and the same duplicate-minimum shape finalizes to a three-member fringe.

So the observed behavior is not caused by a relaxed >2/3 threshold.

    N=3: 2/3  -> no finalization
    N=4: 3/4  -> three-member fringe

The threshold arithmetic is behaving as coded; the mismatch is that the entry-count gate permits four entries to represent only three sender identities.

This is a characterization result, not a deployed-network safety claim.
