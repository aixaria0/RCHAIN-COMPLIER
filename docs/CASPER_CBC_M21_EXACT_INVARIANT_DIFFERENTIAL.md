# M21 — Exact Invariant Differential

M21 closes a sharper boundary than another reproduction of the duplicate-sender behavior.

At the exact pinned upstream revision:

`rchain-community/rchain-rust@d92f0787a6096cd6d79864ec2d7c1dd9b6912d0b`

the SDK already contains the concrete predicate `invalid_justification_follows`. Its implementation loads the justification messages, projects them to sender identities, forms a set, and compares that set with the bonded-sender set.

M21 now tests the exact four-entry witness against both sides of the differential. The active `casper::validate::block_summary` probe uses a bonded proposer (`v0`) with a self-justification, so the normal sequence-number check remains satisfiable; the four justifications are still `[v0, v0, v1, v2]` and `v3` is absent.

The M21 witness has four justification entries:

```text
[v0, v0, v1, v2]
```

against four bonded validators:

```text
[v0, v1, v2, v3]
```

Therefore:

```text
entry count              = 4
bonded-validator count   = 4
distinct justification senders = 3
bonded sender identities  = 4

invalid_justification_follows(...) = true
```

A control fixture with one justification from each of `v0,v1,v2,v3` returns `false` from the same upstream predicate.

This matters because M11.6 and M12 already established, independently, that the duplicate-sender shape can cross the active `casper::validate::block_summary` and cryptographic ingress boundaries. M21 therefore identifies an exact, existing upstream invariant predicate that discriminates the witness from the valid one-per-sender shape, while the active summary chain does not invoke that predicate.

This is still deliberately not phrased as a patch recommendation or a deployed-network vulnerability. The remaining question is whether enforcing that predicate at a specific consensus boundary is compatible with all legitimate multi-parent proposer semantics and historical network behavior.

## Result

The active-path result is now intended to be read together with the exact SDK predicate result. If both tests remain green at the pinned revision, the statement is stronger than M11.6: the exact four-entry Finalizer cardinality witness itself is admitted by `block_summary`, while the existing sender-set predicate rejects the same sender coverage.

The discrepancy is now reduced to a concrete differential:

```text
same witness
    |
    +--> active block_summary path: admitted        [M11.6]
    |
    +--> cryptographic receiver path: admitted      [M12]
    |
    +--> exact SDK invalid_justification_follows: rejected
```

That is a substantially narrower research statement than “the implementation is wrong”: the repository already contains a sender-set invariant, but the active validation path does not currently apply it at the tested boundary.

## Scope

M21 does not establish:

- a live mainnet exploit;
- conflicting finality on a deployed network;
- that `invalid_justification_follows` is the correct consensus fix;
- that all historical or current releases share this exact wiring.

It establishes the pinned-revision implementation differential and makes the next protocol-impact question precise.
