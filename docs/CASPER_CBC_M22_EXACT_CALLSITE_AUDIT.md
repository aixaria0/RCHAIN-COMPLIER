# M22 — Exact Call-Site Audit

## Question

The pinned SDK contains `invalid_justification_follows`, an explicit sender-set predicate intended to reject a message whose justifications do not cover the bonded sender set.

M21 established the behavioral differential: the exact predicate rejects the duplicate-sender witness, while the active `casper::validate::block_summary` probe accepts the same four-entry duplicate-sender shape.

M22 asks the sharper wiring question:

> At the exact pinned upstream revision, is `invalid_justification_follows` actually called anywhere outside its defining SDK module?

## Method

GitHub Actions checks out:

```text
rchain-community/rchain-rust
d92f0787a6096cd6d79864ec2d7c1dd9b6912d0b
```

The workflow then:

1. prints every occurrence in `sdk/src/casper_syntax.rs`;
2. searches the rest of the exact pinned source tree for the same symbol;
3. fails if any external reference exists;
4. prints the active `casper::validate::block_summary` body as an additional path-level audit.

The audit is static: it does not claim that an absent symbol proves a protocol-level defect by itself. It establishes the wiring state of the pinned source tree.

## Result

At the pinned revision, `invalid_justification_follows` is confined to its defining SDK module and its local tests. No external source reference is present.

The active `casper::validate::block_summary` path is composed of:

```text
justification_regressions
sequence_number
block_number
deploy checks
repeat_deploy
```

and does not invoke the SDK sender-set predicate.

Together with M21, this yields a precise differential:

```text
existing sender-set predicate
        |
        +-- duplicate sender witness => invalid

active block_summary path
        |
        +-- same controlled witness => admitted
```

This is stronger than saying "a helper exists." The pinned revision contains the discriminator, but the active validation path does not wire it into block-summary admission.

## Scope

M22 is an implementation-wiring result, not a live-network exploit claim.

It does not establish:

- that all deployed RChain versions share this exact source state;
- that a production node can be driven to a conflicting-finality outcome;
- that the sender-set predicate is necessarily the intended consensus fix.

The next protocol-impact question remains whether a causally valid adversarial history can carry the under-cardinality state into a concrete safety consequence.
