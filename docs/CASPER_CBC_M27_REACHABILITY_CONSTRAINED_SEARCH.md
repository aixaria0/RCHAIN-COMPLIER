# M27 — Reachability-Constrained Adversarial History Search

## Question

What is the smallest adversarial justification replacement that creates the under-cardinality witness, while every referenced message remains inside a causally reachability-valid DAG?

## Exact scope

M27 does not search arbitrary bytes, signatures, or an unrestricted network state.

It starts from the existing causally valid four-validator DAG used by the upstream reachability screen and takes the top-layer message pool:

```text
[a3, b3, c3, d3]
```

It then exhaustively enumerates every length-four justification selection with replacement:

```text
4^4 = 256 candidates
```

Each candidate is evaluated with:

- the existing upstream reachability screen;
- the current count-only minimum-message gate mirror;
- distinct bonded-sender coverage;
- the existing Finalizer semantic trace;
- finalization outcome;
- Hamming distance from the valid control `[a3,b3,c3,d3]`.

## Green result

The bounded search characterizes the complete replacement space:

| Measure | Result |
|---|---:|
| candidates | 256 |
| reachability-valid | 256 |
| current count gate passes | 256 |
| sender-complete | 24 |
| under-cardinality | 232 |
| exactly 3 distinct senders | 144 |
| minimum replacements to under-cardinality | 1 |
| minimum replacements to a finalizing under-cardinality witness | 1 |

The important point is not the raw number of combinatorial cases. It is the boundary:

```text
causally valid message pool
        |
        +--> one justification replacement
        |
        +--> four entries still satisfy count gate
        |
        +--> only three distinct bonded senders
        |
        +--> under-cardinality witness
```

The search therefore shrinks the adversarial construction from an abstract duplicate-sender idea to a one-step mutation of a sender-complete, reachability-valid justification set.

## Evidence boundary

M27 still does not prove that an arbitrary remote peer can submit the exact one-step mutation as a live production block under every network condition.

What it establishes is narrower and stronger:

> A minimal under-cardinality justification shape can be assembled entirely from messages that already satisfy the currently checked upstream DAG reachability constraints.

M12/M23/M25 then provide the separate active-ingress/admission evidence for the controlled shape.

## Why this is a meaningful next step

M24 searched the normal proposer direction and found no spontaneous under-cardinality fringe in 5,460 clean schedules.

M27 searches the opposite direction with a bounded adversarial mutation family and finds the smallest sender-cardinality mutation inside a reachability-valid message pool.

Together:

```text
honest proposer search
    -> no witness in bounded horizon

reachable message pool
    -> 1 replacement
    -> duplicate sender / missing bonded sender
    -> count gate still passes
```

This is still an evidence characterization, not a live-network exploit claim.

## Next boundary

The next step is to take the minimal witness and connect it to the exact signed/block ingress certificate already established by M12, while preserving the reachability certificate and replay digest as one composite evidence record.
