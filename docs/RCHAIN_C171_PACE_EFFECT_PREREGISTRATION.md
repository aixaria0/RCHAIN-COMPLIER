# C171 pace-effect gate — pre-registration

**Status: FROZEN before any C171 pace-effect network run.**

Upstream owner: `rchain-community/rchain-rust#149` / C171.

Pinned source revision:

```text
51935310789a1a75a183ad0af7152e4eef450c88
```

This gate comes after the C192 candidate has passed the paired model, Rust scheduling gate,
production-path compile/test, one N=3 network smoke, and the repeated C192 campaign.

It does **not** assume C171 is fixed by those results.

## Question

Does the own-quiet cadence term have a causal network-level effect once the C192 self-trigger remains enabled?

The upstream issue asks for exactly this falsifier shape:

> a three-validator devnet with `--attest-on-new-blocks` whose block growth per deploy is bounded,
> and red when the pace term is deleted.

This gate isolates the pace term instead of comparing the candidate to an unrelated historical tree.

## Arms

Both arms start from the same pinned upstream revision and both keep:

- the existing strict one-response-per-remote-height rule;
- the deterministic stalled-round self-trigger from the disposable production-path candidate;
- the same N=3 no-autopropose devnet rig;
- the same deploy, sampler, timing and resource cap.

Only one line of behavior differs.

### Candidate

Uses the production-path cadence:

```text
remote_height - own_latest_height > LIVENESS_WINDOW
```

with the shipped `LIVENESS_WINDOW = 5`.

### Cadence-off negative control

Uses the same candidate, but replaces only `attestation_cadence_due(...)` with `true`.

It does **not** change:

- strict remote-height deduplication;
- the self-trigger;
- proposer round rules;
- finality rules;
- wire validity;
- validator set;
- devnet timing.

The exact temporary diff is retained as evidence.

## Fixed network protocol

Per arm:

- validators: 3;
- attempts: 3, unfiltered;
- autopropose: off;
- attest-on-new-blocks: on;
- settle: 60 s;
- idle: 60 s;
- reading: 180 s;
- exactly one deploy at the start of the reading window;
- 4 GiB cgroup cap per node;
- same upstream `n149-sweep-run.sh` and `n149-sample.py`.

The measured network-rate quantity is explicit:

> **distinct post-deploy block hashes per 180-second reading window**

No height delta is substituted for a block count.

Time to finality is reported beside every block count.

## Integrity requirements

Every attempt in both arms must have:

- 3 sampled nodes;
- 3 post-deploy senders;
- zero failed block reads;
- zero idle-window blocks;
- exactly one deploy-bearing block;
- a 180-second reading window.

Any violation makes the comparison BLOCKED.

## Pre-registered causal acceptance

The candidate must finalize in all three attempts.

The cadence-off arm is considered **red** if either:

1. it loses finality in at least one otherwise valid attempt; or
2. it finalizes in all three attempts, but the block-count ranges separate completely:

```text
max(candidate_blocks_per_180s) < min(cadence_off_blocks_per_180s)
```

The non-overlap rule is intentionally stronger than comparing means. One quiet negative-control run cannot
be averaged away by two storms.

If neither condition holds, the pace-effect gate FAILS.

## Why there is no absolute block ceiling here

The earlier smoke gate froze a CI ceiling before its run, but its original rationale misread an upstream
height rate as a block rate. That number remains useful only as historical smoke acceptance.

C171 deserves a clean experiment.

This gate therefore establishes whether deleting the pace term has a reproducible causal effect before any
absolute network-rate constant is proposed.

If the gate is green by rate separation, the observed candidate range can be used to preregister the
subsequent closure experiment. If it is green only because cadence-off loses finality, the result shows the
pace term is necessary for liveness but does not by itself quantify the C171 rate bound.

## Claim boundary

A green result supports only:

> Under the pinned N=3 no-autopropose rig, removing only the own-quiet cadence makes the otherwise identical
> C192 candidate observably worse by pre-registered block-growth separation or by loss of finality.

It does not close C171, prove validator-count independence, establish Byzantine safety, or authorize an
upstream merge.
