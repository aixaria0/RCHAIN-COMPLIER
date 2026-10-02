# C171 pace-effect: observed null result and next diagnostic

This record is based on downloaded artifacts, not inferred from PR prose. It preserves the frozen experimental verdict. No acceptance boundary is changed.

## Completed campaigns

Pinned upstream: `51935310789a1a75a183ad0af7152e4eef450c88`.

Each arm used N=3, three unfiltered attempts, no autopropose, one deploy, 60 s settle / 60 s idle / 180 s read, and the upstream n149 sampler.

| PR | Run | Artifact | Candidate blocks per 180 s | Cadence-off blocks per 180 s | Candidate finality observations (s) | Cadence-off finality observations (s) | Verdict |
|---|---|---|---|---|---|---|---|
| [35](https://github.com/aixaria0/RCHAIN-COMPLIER/pull/35) | [36949695792](https://github.com/aixaria0/RCHAIN-COMPLIER/actions/runs/36949695792) | 11204652895 | 12, 12, 12 | 12, 12, 12 | 3, 3, 4 | 3, 3, 3 | FAIL |
| [36](https://github.com/aixaria0/RCHAIN-COMPLIER/pull/36) | [36958369200](https://github.com/aixaria0/RCHAIN-COMPLIER/actions/runs/36958369200) | 11207743045 | 12, 12, 12 | 12, 12, 12 | 3, 4, 3 | 2, 3, 3 | FAIL |

ZIP SHA-256 values matched the GitHub artifact digests:

- 11204652895: `ba8fb8afea8e92fff6bb41da72157989711eb66b7e2ba55398fb64779c1b6fbb`
- 11207743045: `f40b092409886512935f4ccc5c0ce3457e9ed913374038adb3ccbcdf67e922af`

Both JSON reports contain empty blockedReasons and the failure reason:

> cadence-off control was not red: block-count ranges overlap and all negative-control attempts finalized

## Raw-artifact cross-check

Across all twelve attempts:

- no void attempt;
- exactly 180 seconds in the read-window marks;
- zero idle-window blocks;
- exactly one deploy-bearing block;
- three sampled nodes and three post-deploy senders;
- zero reported block-read errors;
- twelve unique post-deploy hashes, thirteen total including genesis;
- maximum post-deploy block number 4;
- all recorded node alive values equal 1, with no blank height readings.

All post-deploy hashes were first seen within offsets 0 through 4 seconds; the exact offset range varies by attempt. These observations describe a bounded initial burst, not sustained throughput.

The cumulative candidate and cadence-off patches were compared. Their behavioral difference is confined to the cadence helper replacement, apart from Git blob metadata and diff hunk line offsets. The other production callback and test additions are identical in the retained patches.

## What failed

The causal acceptance rule requires candidate finality in every attempt and either cadence-off finality loss or complete block-count separation:

`max(candidate) < min(cadence-off)`.

Here that inequality is `12 < 12`, which is false, and every cadence-off attempt reports finality. FAIL is the expected experimental verdict, not a build or instrumentation failure reported by these gates.

This does not erase PR #34's C192 result. It means the additional hypothesis that this single-deploy N=3 experiment exposes a beneficial cadence effect is unsupported by both completed campaigns.

It also does not prove cadence is universally unnecessary. Equivalent endpoints can mask different internal scheduling decisions.

## Measurement limits

Finality is an observation of finalized block number reaching the deploy-bearing block number on the recorded nodes; the artifacts do not independently bind finalized hashes to that deploy. Seconds are sampler observations, not precise consensus latency. The sampler's `none` conflates no parsed finalized number with an unsuccessful finality API response.

There are no production, Byzantine-safety, sustained-rate, or validator-count-independence claims.

## Next diagnostic, before another causal acceptance run

Do not lower the acceptance threshold or keep repeating identical runs to obtain green.

First retain the outcome of the already-running PR #37 separately. Its results are not included above.

The smallest useful new experiment is diagnostic observability of the existing callback, on the same pinned source, recording:

1. remote block hash and height, own latest height, DAG round height and tip height;
2. strict-height eligibility, cadence decision and self-trigger decision;
3. successful queue admission versus full/closed queue;
4. subsequent proposer completion or rejection, correlated to the request where possible.

This should distinguish testable explanations:

- cadence changes admissions, but proposer rules erase the difference;
- self-trigger admissions dominate both arms;
- the one-deploy stimulus does not reach the state where cadence changes network output.

These are hypotheses, not observations established by the current artifacts. The block-number ceiling alone does not prove which callback conditions were encountered.

Instrumentation must preserve the predicates, evaluation order and state mutation boundaries, retain full trace artifacts, and acknowledge that tracing can perturb timing. Keep the existing acceptance gate unchanged. Derive a discriminating workload from the trace, then freeze its protocol and acceptance boundary before collecting new acceptance data.

No upstream patch or production deployment follows from this null result.
