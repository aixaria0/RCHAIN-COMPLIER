# C192 repeated control/candidate campaign

This is the gate after the green N=3 devnet smoke in PR #33.

It returns to the original n149 primary-arm timing instead of extending the smoke threshold:

- 3 validators;
- 3 unfiltered attempts per arm;
- 60 s settle;
- 60 s idle;
- 180 s reading;
- no autopropose;
- exactly one deploy at the start of the reading window;
- the same pinned upstream revision: `51935310789a1a75a183ad0af7152e4eef450c88`.

## Arms

Control is the unmodified pinned upstream tree.

Candidate is the same pinned tree plus the disposable production-path patch that passed PR #32 and the network smoke in PR #33.

Each arm uses the committed upstream `n149-sweep-run.sh` and `n149-sample.py` rather than a parallel network fixture.

## C192 acceptance

The gate fails closed if any attempt is void or instrumentally incomplete.

For every control attempt:

- all three validators must be sampled;
- all three senders must appear after the deploy;
- the idle window must contain zero blocks;
- exactly one deploy-bearing block must appear;
- block reads must have zero failures;
- the deploy must remain unfinalized for the full 180-second reading window.

For every candidate attempt, the same integrity requirements apply, but the deploy must finalize inside the 180-second window.

Attempts are reported individually. A successful attempt cannot average away a failed one.

## C171 is recorded, not decided here

For each attempt the campaign records the exact number of distinct post-deploy block hashes in the 180-second window.

That quantity has an explicit unit: **blocks per 180-second reading window**.

This gate deliberately does not convert those values into a C171 verdict. C171 still needs a separately preregistered pace experiment with:

- an explicit block/time unit;
- a candidate arm;
- a negative control with the cadence half removed;
- an acceptance boundary frozen before that run.

This separation prevents the C192 liveness campaign from silently inheriting an arbitrary rate threshold.

## Claim boundary

If green, this campaign supports only:

> On the pinned N=3 no-autopropose rig, the unmodified control reproduced the C192 no-finality condition in all three unfiltered attempts while the disposable candidate finalized in all three attempts under the same 60/60/180 protocol.

It does not prove Byzantine safety, hard-fork neutrality, public-testnet behavior, production readiness, or C171 closure.

No upstream branch or pull request is modified by this gate.


## Observed green campaign

PR #34 completed successfully on the pinned upstream revision.

| Arm | Attempt | Post-deploy blocks | Senders | Finality | Idle blocks | Failed block reads |
|---|---:|---:|---:|---:|---:|---:|
| unmodified control | 1 | 3 | 3 | never in 180 s | 0 | 0 |
| unmodified control | 2 | 3 | 3 | never in 180 s | 0 | 0 |
| unmodified control | 3 | 3 | 3 | never in 180 s | 0 | 0 |
| disposable candidate | 1 | 12 | 3 | 3 s | 0 | 0 |
| disposable candidate | 2 | 12 | 3 | 3 s | 0 | 0 |
| disposable candidate | 3 | 12 | 3 | 3 s | 0 | 0 |

There were zero void attempts.

The control therefore reproduced C192 in **3/3** unfiltered runs, and the candidate restored finality in **3/3** matched runs.

The C171 observation is intentionally kept separate:

- control block counts: `[3, 3, 3]`;
- candidate block counts: `[12, 12, 12]`;
- quantity: distinct post-deploy block hashes per 180-second reading window.

Those numbers are **not** a C171 verdict because the control is stalled. A stalled chain producing fewer blocks is not a successful pace bound.

The next experiment isolates the candidate's own-quiet cadence term with a cadence-off negative control while keeping the C192 self-trigger fixed.
