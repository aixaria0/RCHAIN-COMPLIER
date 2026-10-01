# Disposable paired Rust gate for C192 / C171

This stage follows the deterministic paired evaluator and still does not modify the upstream rchain-rust repository.

CI checks out the pinned upstream revision into a disposable workspace and injects a Rust-only scheduling harness beside the existing attest_warranted tests.

## Candidate shape

single-shot remote-height bound
+ own-quiet cadence
+ one bounded self-trigger for a stalled round

## What CI proves

The original upstream C192 sequence falsifier is run unchanged.

The injected Rust tests then require:
- one remote-driven request for the measured same-height C192 burst;
- one and only one self-trigger for that stalled round;
- one request for a same-height C171 burst;
- one request per LIVENESS_WINDOW + 1 heights in the advancing-height sample.

Negative controls require:
- a non-strict height comparison to reopen the same-height burst;
- strict-height without a self-trigger to remain sealed;
- a round escape without own-quiet cadence to remain unpaced.

The exact temporary Rust diff and both cargo logs are retained as CI artifacts.

## Claim boundary

A green gate means only that the paired candidate and its negative controls compile and pass as Rust scheduling tests against the pinned upstream source tree.

It does not mean the production tap has been rewired, the multi-validator devnet finalises, C192 or C171 is fixed upstream, or the candidate is consensus-safe.

## Next gate

After this is green, the next experiment is production-path wiring in another disposable checkout. That stage must feed the candidate actual node/DAG state, preserve the strict same-height bound, reuse existing liveness semantics, and derive the self-trigger from deterministic round state before any upstream PR is opened.
