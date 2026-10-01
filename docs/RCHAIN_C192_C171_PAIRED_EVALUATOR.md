# RChain C192 / C171 paired repair evaluator

This stage begins where [RCHAIN_C192_LIVE_WITNESS.md](RCHAIN_C192_LIVE_WITNESS.md) stops.

PR #28 proved that the real upstream C192 falsifier can be executed at a pinned `rchain-rust` revision and carried through the three-process evidence lifecycle. It deliberately did **not** guess the repair.

This evaluator asks the next narrower question:

> Which scheduling shape can restore progress for C192 without reopening C171's attestation storm?

## Pinned upstream seam

The evaluator is bound to:

- repository: `rchain-community/rchain-rust`
- revision: `51935310789a1a75a183ad0af7152e4eef450c88`
- C192 owner: issue #172
- C171 owner: issue #149
- current tap: one response per strictly newer remote height
- proposer cadence: own latest message more than `LIVENESS_WINDOW` heights behind the tip
- round state: `round_parents` / `has_advanced_past_the_round`
- existing proposer escape: bounded by `LIVENESS_WINDOW`

CI checks these symbols and exact semantics before accepting the model output. If upstream moves, the evaluator fails closed instead of silently applying an old model to a new tree.

## Candidate matrix

| Candidate | C192 stalled round | C171 burst / pace | Result |
|---|---:|---:|---|
| current strict per-height tap | blocked | unpaced as heights advance | reject |
| naive `>=` | advance returns through fan-out | same-height burst reopens | reject |
| own-quiet cadence only | still blocked | bounded | reject |
| round-close self-trigger only | bounded escape restores advance | advancing-height storm remains | reject |
| round-close self-trigger + own-quiet cadence | bounded model passes | bounded model passes | **survives this model** |

The last row is **not a fix claim**. It is the only candidate in this deliberately small model that does not fail one of the two registered directions immediately.

## Why extra state is unavoidable

The current tap signature is approximately:

```text
(me, remote sender, remote height, last answered remote height) -> bool
```

That is enough to enforce one response per remote height. It is not enough to answer either of the next questions:

1. Has this validator itself been quiet for more than the existing liveness window?
2. Has the current round reached a deterministic boundary or remained stalled long enough to justify one bounded self-driven escape?

The upstream tree already has both kinds of state elsewhere: `cadence_due` reads the validator's own latest message, and `DagMessageState` maintains the round boundary plus the proposer's bounded escape path. The next implementation experiment should reuse those semantics rather than add an unrelated wall clock or a second independent notion of a round.

## What the evaluator proves

Only this:

- the current strict-height rule fails the C192 model;
- changing `>` to `>=` fails the bounded-burst control;
- cadence without a self-driven stalled-round escape still fails C192;
- a self-driven escape without cadence still fails C171;
- the combined shape is the only candidate in this model that satisfies both local acceptance conditions.

## What it does not prove

It does **not** prove that the combined candidate:

- compiles in the production Rust path;
- preserves all proposer invariants;
- finalises the multi-validator devnet;
- eliminates the measured C171 rate on a real network;
- is consensus-safe or hard-fork-neutral;
- should be merged upstream.

## Next gate

The next step, only after this evaluator is green, is a **disposable patch against the same pinned upstream checkout**.

That patch must run both sides together:

1. C192: the stalled same-height round obtains a bounded path to a higher message.
2. C171: the all-live advancing-height arm stays under a stated request/block-rate bound.
3. Negative control: removing the cadence half turns C171 red.
4. Negative control: removing the self-trigger half turns C192 red.
5. No change is proposed to upstream until the paired Rust gate is green.

Only after that should the candidate reach a controlled multi-validator devnet.
