# Disposable production-path wiring gate for C192 / C171

This stage follows the green paired model and green paired Rust scheduling gate.

It still does not modify the upstream rchain-rust repository. CI checks out the pinned upstream revision and rewires the real attestation tap only inside that disposable checkout.

## Production seam

The important ordering is already present upstream:

block validation
-> DAG insert
-> validated queue
-> attestation tap

Therefore the tap can inspect the post-insert DAG state without guessing whether the incoming block has landed.

The disposable patch keeps the existing strict one-response-per-remote-height rule, then adds two bounded inputs from the actual DAG view:

- own latest message height, used with the existing LIVENESS_WINDOW as the cadence;
- round_height and current tip, used to permit one self-trigger when a round has actually closed at the same height and this validator's latest message is on that boundary.

A per-process round key prevents duplicate self-triggers for the same boundary. It is intentionally not persisted: after a restart, a trigger is safe only if the DAG still presents the same stalled condition; once an escape has moved the tip above the round, the predicate is false.

## Why this is different from the prior gate

The prior Rust gate tested the candidate scheduling semantics beside the upstream tests.

This gate compiles those semantics into the actual attestation callback and reads real DagMessageState fields from the production object graph.

## CI acceptance

The temporary checkout must:

- match the exact pinned revision;
- pass git diff --check;
- compile rchain-node with the production tap rewired;
- keep the original strict-height C192 unit test green;
- pass the new cadence / one-shot round-trigger tests;
- preserve the exact temporary patch and cargo logs as artifacts.

## Claim boundary

A green result means the candidate can be wired into the real Rust production path and compiled against the pinned upstream tree while preserving the registered local bounds.

It still does not prove multi-validator finality, the measured C171 rate, Byzantine safety, or production readiness.

The next gate after this is the controlled devnet pair: C192 guard-live finality and C171 bounded rate, with the unmodified pinned tree as control.
