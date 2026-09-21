# M12 — Cryptographic Ingress Boundary

## Purpose

M11 established that the duplicate-minimum-message candidate can cross the active Casper validation path under a controlled DAG/state fixture.

M12 closes a different gap: whether the candidate itself is merely an artificial in-memory object, or whether a content-addressed, correctly signed `BlockMessage` with the same duplicate-sender justification shape can cross the pinned upstream `BlockReceiver` ingress boundary.

This milestone intentionally stops before full Casper validation. M11.6–M11.7 cover the later validation boundary.

## Exact upstream revision

```text
rchain-community/rchain-rust
d92f0787a6096cd6d79864ec2d7c1dd9b6912d0b
```

## Probe

The injected upstream test:

1. builds a `BlockMessage` with five distinct justification hashes;
2. maps those hashes to senders `v0, v0, v1, v2, v3`;
3. computes the real content-addressed block hash with `hash_block`;
4. signs the block with the real upstream `ValidatorIdentity`;
5. passes the exact `BlockReceiver::check_if_of_interest` predicates;
6. feeds the block through `BlockReceiver::apply`;
7. verifies that the receiver stores the block and emits its hash onto the validation queue.

The test does not call a synthetic copy of the cryptographic checks. It uses the pinned upstream Rust implementation.

## Boundary interpretation

The result, when green, establishes:

> A wire-valid, correctly hashed and correctly signed `BlockMessage` carrying the duplicate-sender justification shape is not rejected by the pinned `BlockReceiver` ingress boundary and is forwarded toward validation.

That is stronger than M11.6's direct `block_summary` admission test because the candidate now crosses the production receiver's content-hash and signature gate.

It still does not establish a network exploit or protocol-level safety failure.

## Evidence boundary

```text
synthetic sender-shape
        |
real BlockMessage construction
        |
real hash_block
        |
real ValidatorIdentity::sign_block
        |
real BlockReceiver ingress
        |
validation queue
        |
M11.6 / M11.7 full validation
```

The remaining research question is not whether the object can be encoded, hashed, signed, received, and forwarded. The remaining question is what protocol-level consequence, if any, follows when the same shape participates in the validator/DAG/finalization state machine under realistic production assumptions.

## Specification alignment note

The same upstream revision's `docs/src/node/consensus.md` describes the Casper fringe as containing “one message per bonded validator.” The implementation helper `invalid_justification_follows` instead derives a `BTreeSet` of justification senders before comparing it with the bonded sender set. This is an important specification/implementation observation because a duplicate sender disappears at the set-construction step.

This statement is about the checked source revision and its documentation; it is not, by itself, a conclusion about a deployed network.
