# M28 — Minimal Duplicate-Sender Cryptographic Ingress

## Question

Does the one-replacement under-cardinality witness identified by M27 also have a concrete wire-valid representation that crosses the real upstream `BlockReceiver` ingress boundary?

## Exact upstream revision

```text
rchain-community/rchain-rust@d92f0787a6096cd6d79864ec2d7c1dd9b6912d0b
```

## Witness

M27 established that the minimum adversarial distance from the sender-complete control is one justification replacement. M28 uses the canonical four-entry duplicate shape:

```text
v0, v0, v1, v2
```

That is four entries but only three distinct bonded senders.

## Boundary

The injected probe uses the real upstream `ValidatorIdentity`, block signing, block hashing and `BlockReceiver` path.

The certificate checks:

1. the candidate is content-addressed and signed with the upstream cryptographic identity;
2. the duplicate-sender four-entry justification set is preserved on the wire object;
3. the real receiver interest/validation predicate accepts the block;
4. the real receiver stores the block and emits it to the validation queue.

The test deliberately stops at ingress. Full Casper admission and downstream propagation remain separately covered by M11.6–M25.

## Why M28 matters

M27 proved minimality inside a reachability-valid message pool.

M12 proved that a correctly signed duplicate-sender candidate can cross cryptographic ingress.

M28 joins those two statements for the **minimum four-entry witness shape**, reducing another gap in the evidence chain:

```text
reachability-valid message pool
        |
        +--> one justification replacement
        |
        +--> 4-entry / 3-sender witness
        |
        +--> real signing + content addressing
        |
        +--> real BlockReceiver ingress
```

This is still not a claim that the witness produces a live-network safety failure. It is a concrete upstream implementation boundary.

## Next boundary

The next useful step is a composite certificate that carries the M27 minimality/reachability digest together with the M28 signed-ingress result and the M25 active sender-set differential, so the complete evidence chain has one machine-readable identity.
