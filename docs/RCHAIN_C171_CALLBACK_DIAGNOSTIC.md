# C171 callback diagnostic after the null result

PRs #35 and #36 each recorded twelve post-deploy hashes in every candidate and
cadence-off attempt. Both arms finalized; both frozen pace-effect gates failed.
PR #37 is a separate acceptance campaign, not evidence supplied by this diagnostic.

This gate asks where those equivalent network outputs originate. It does not
relax the failed acceptance rule or propose a new upstream repair.

## Disposable instrumentation

The pinned source is `51935310789a1a75a183ad0af7152e4eef450c88`. The existing
production-path candidate is injected first. A second injector adds tagged
`C171_TRACE_V1` warning records, retained by the upstream n149 log collector.
These tagged warnings are diagnostic records, not fault reports.

Each remote callback observation records the block hash, observed height, own
latest height (-1 means absent), round height, tip height, strict-height predicate,
cadence predicate, remote-due decision and self-due decision. Queue admission is
recorded separately as accepted or rejected, correlated by node, hash and height.

The strict predicate is evaluated diagnostically against the value captured
under the original lock before its update. The cadence helper is pure. These
diagnostic evaluations occur after the original decisions; the existing
short-circuit condition and state updates retain their original ordering.

Removing the exact trace fragments recovers the candidate file byte-for-byte.
The injector rejects ambiguous/missing anchors and already-traced source.
CI verifies this roundtrip against the actual pinned candidate before compiling.
Both arms contain the same tracing. The cadence-off helper alone returns true;
the isolated diff and cumulative Rust patches are retained.

Tracing allocates a hash string and emits synchronous log calls. It can alter
scheduling and must not be used as an uninstrumented timing or safety proof.
Queue admission is not proposer completion or successful block production. The
existing discarded response receiver remains discarded; this patch does not
create a new completion observer.

## Diagnostic protocol

One fresh N=3 attempt per arm, using the same upstream n149 runner and sampler:
60 s settle, 60 s idle, 180 s reading, one deploy, no autopropose, 4 GiB node cap.
One attempt is sufficient to inspect a path, not to establish repeatability.

The JSON report retains every parsed decision and queue outcome per node and
the n149 network observation. It reports counts of strict eligibility, cadence
suppression, remote due, self due, self due with cadence false, queue acceptance
and queue rejection.

`COMPLETE` requires one non-void attempt per arm, all three nodes' trace logs,
nonempty decision observations, complete queue outcomes for admitted decisions,
and the existing network integrity checks. A missing/malformed trace, mismatched
queue record, incomplete network reading or void attempt is `BLOCKED`.

No requirement forces the candidate or negative control to have different
counts. No C171 pass/fail verdict is generated. Network finality observations
retain the height-based and API-error limitations of the upstream sampler.

## How to interpret the next artifact

1. If strict-eligible callbacks are suppressed by cadence while self-trigger
   admissions proceed with cadence false, the artifact identifies both paths;
   it does not yet prove that self-trigger alone explains all block production.
2. If admission counts differ but block counts do not, investigate proposer
   suppression/completion next. Current instrumentation stops at queue admission.
3. If no decision state separates the arms, derive a discriminating workload
   from the trace and preregister it before new acceptance observations.

Do not infer callback states from the endpoint block-height ceiling alone.
Do not erase a failed acceptance result by adding a diagnostic green check.
No upstream branch, public testnet or production deployment is modified.
