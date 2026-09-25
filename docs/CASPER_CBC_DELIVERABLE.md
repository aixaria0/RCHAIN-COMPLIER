# Casper CBC Stress & Evidence Deliverable

## Purpose

This PR delivers a reusable, deterministic research harness for Casper CBC stress analysis, plus an exact-upstream evidence bridge that turns a synthetic observation into a reproducible implementation-level investigation.

The value is a reviewable workflow that answers: what was stressed, what was observed, whether the observation can be anchored to the pinned upstream implementation, what the smallest witness is, and which claims are actually established.

## Deliverable

### 1. Deterministic CBC stress surface

- validator events
- partitions and delayed delivery
- deterministic reordering
- explicit equivocation
- convergence/divergence classification
- replay digests
- machine-readable evidence traces

### 2. Upstream-anchored evidence chain

~~~~text
rchain-community/rchain-rust@d92f0787a6096cd6d79864ec2d7c1dd9b6912d0b
~~~~

The evidence chain reaches Finalizer, active block_summary, full Casper validation, signed/content-addressed ingress, NodeRunning dispatch, persisted DAG state, and proposal propagation.

### 3. Minimal witness characterization

The bounded adversarial search exhaustively checks 256 four-entry justification selections from a reachability-valid message pool.

~~~~text
256 candidates
256 reachability-valid
24 sender-complete
232 under-cardinality
144 exactly 3 distinct senders
1 replacement = minimum mutation to under-cardinality
1 replacement = minimum mutation to a finalizing under-cardinality witness
~~~~

This turns the observed duplicate-sender case into a bounded minimality result rather than a hand-picked example.

### 4. Active-boundary compatibility characterization

~~~~text
duplicate / missing sender       count gate: accept   shadow: reject
valid sender-complete control     count gate: accept   shadow: accept
non-bonded replacement            count gate: accept   shadow: reject
~~~~

No upstream patch is included.

### 5. Wire-valid minimum witness

The minimum four-entry duplicate-sender shape is constructed with the real upstream signing/hash path and crosses the exact BlockReceiver ingress boundary.

~~~~text
exact upstream pin verified
M28 probe: 1 passed, 0 failed
~~~~

## Clear value proposition

For a maintainer, this PR provides a compact and repeatable way to reproduce and interrogate Casper CBC edge conditions without first standing up a full network.

The practical benefits are deterministic replay, exact upstream revision pinning, separation of synthetic stress evidence from implementation evidence, minimal-witness search instead of a hand-built counterexample, machine-readable digests/traces for later tooling, and explicit claim boundaries that prevent a test result from being presented as a deployed-network vulnerability.

## Current evidence boundary

The PR establishes pinned-revision implementation behavior and a deterministic stress/evidence workflow.

It does not claim a deployed mainnet vulnerability, conflicting finality, a network-level exploit, an economic attack, or that a sender-set predicate is already an accepted upstream fix.

## Reproduction entry points

~~~~text
npm run demo:cbc-stress
npm run demo:casper-cbc-upstream-replay
npm run demo:casper-reachable-adversarial-history-search
~~~~

The PR workflows run the corresponding deterministic checks in CI.
