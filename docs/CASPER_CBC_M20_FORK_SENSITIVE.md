# M20 — Fork-Sensitive Finality Propagation

## Question

Does the pinned upstream proposal-construction path propagate different finalized closures when two locally consistent views carry different under-cardinality fringes?

## Exact setup

Pinned upstream revision:

`rchain-community/rchain-rust@d92f0787a6096cd6d79864ec2d7c1dd9b6912d0b`

Both views contain four distinct bonded senders and therefore complete justification-sender coverage. Each view nevertheless carries a three-member fringe:

- View A: `v0, v1, v2`
- View B: `v0, v1, v3`

The two omitted branches are intentionally different.

## Result

The real upstream `DagMessageState::create_message` path preserves each input fringe into the subsequent proposal. The resulting finalized seen-closures therefore differ: View A carries branch `v2` while View B carries branch `v3`.

This is a concrete downstream state-selection consequence of allowing incompatible under-cardinality fringes to propagate.

## Interpretation boundary

This test does **not** establish a live-network conflicting-finality attack. The two views are deliberately supplied as different local histories. The result establishes that the pinned implementation does not repair the missing bonded-sender member during ordinary proposal construction; consequently, different under-cardinality views can remain distinguishable in downstream finality state.

The next research question is whether these views can be connected by a causally valid adversarial history that survives the full active validation path without introducing an independent invalidity condition.
