# M17 — Stake-Neutral Fringe Cardinality

The cardinality mismatch is not specific to a concentrated 70/10/10/10 bond distribution.

M17 replays the same exact-revision graph with four equal validators:

    v0 = 25
    v1 = 25
    v2 = 25
    v3 = 25

The duplicate minimum-message vector remains:

    v0, v0, v1, v2

The pinned Finalizer accepts the four-entry count gate and returns a three-sender fringe:

    v0, v1, v2

The resulting support is 75/100, which is strictly greater than the 2/3 finality threshold.

This removes a major confounder from the research: stake concentration is not required for the observed under-cardinality behavior.

The correct interpretation remains bounded. This is an implementation/invariant witness. It does not by itself establish conflicting finality, a deployed network safety failure, or an economic exploit.
