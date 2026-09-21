# Casper CBC Stress Harness

## Scope

This is a synthetic-first research harness for stress-testing Casper CBC-shaped validator behaviour. It is deliberately separated from the live RChain network and does not claim historical protocol compatibility.

## M1 model

The first slice provides:

- deterministic validator state and event emission;
- network partitions, delayed cross-partition delivery, and deterministic reordering;
- explicit validator equivocation events;
- proposition selection through the repository's existing deterministic Proposition Calculus;
- replay digests and convergence traces;
- machine-readable evidence suitable for later Observatory views.

## Scenario shape

```text
validators
   ↓
validator events
   ├── partition / delay / reorder
   ├── equivocation
   ↓
propositions + justifications
   ↓
deterministic convergence
   ↓
replay digest
   ↓
stress result + evidence
```

The harness intentionally reports what the synthetic execution produced. It does not infer live Casper CBC safety or liveness properties from the fixture alone.

## Run

```bash
npm run demo:cbc-stress
```

The test suite verifies baseline replay determinism, partition divergence evidence, explicit equivocation detection, and the M2 fragility invariants. The stress demo now emits an invariant summary, counterexample count, and report digest for each scenario.

## M2 — Counterexample / Fragility Engine

M2 turns a stress result into an explicit invariant report. Each scenario is checked for replay determinism, baseline convergence where applicable, equivocation detection, and partition evidence.

A failed invariant becomes a structured counterexample with a failed round, cause, precondition, transition, conflict core, minimal replay scenario, and replay digest. The shrinker is deterministic and intentionally small; it is a reproducer generator, not a proof that the production protocol is vulnerable.

The stress demo includes a partition+reorder case so ordering pressure is represented in the matrix without changing the synthetic-first boundary.


## M4 — Stake-aware adversarial matrix

The law probe is now exercised through a small deterministic matrix covering:

- exact 2/3 boundary;
- strictly-over-2/3 support;
- concentrated stake with incomplete message coverage;
- concentrated stake with complete message coverage;
- balanced stake without super-majority.

The matrix classifies observations rather than declaring vulnerabilities. In particular, `STAKE_COVERAGE_TENSION` means the two upstream conditions point in different directions in the same observation: stake support exceeds 2/3 while minimum-message coverage is incomplete.

That classification is a research hypothesis generator. The next bridge is to obtain the corresponding block/DAG evidence and determine whether the state can actually arise in the upstream execution path under realistic delivery and fault conditions.


## Next

The next research step is to feed faithful upstream block/DAG observations into this same evidence path and then reproduce any candidate fragility against the upstream implementation or formal specification.


## M5 — Upstream finalizer observation bridge

The next bridge is now explicit: a concrete finalizer observation can provide the
minimum-message sender set plus, for each candidate sender, the bonded validators
that observed the complete next-fringe message set. The adapter derives support
only when the observer set covers the complete bonded partition, matching the
current upstream finalizer's calculate_fringe condition.

That trace is then passed into the existing M3 law probe. The resulting record
keeps the upstream-facing observation separate from the synthetic scenario
engine and carries a canonical observation digest for deterministic replay.

This still does not claim a protocol vulnerability. A STAKE_COVERAGE_TENSION
observation is a concrete condition worth reproducing through the upstream
execution path; it becomes a protocol finding only if an actual upstream
execution demonstrates the relevant safety/liveness consequence.


## M6 — deterministic DAG delivery/fault matrix

The observation bridge now has a deterministic delivery matrix covering four
observation states: complete delivery, an observer partition, a missing minimum
sender, and reordering with complete coverage. The matrix does not simulate the
network; it supplies explicit observed DAG/finalizer facts to the upstream-facing
adapter so the resulting law trace can be compared without ambiguity.

This gives the research path a clean separation:

1. delivery/fault conditions produce an observation;
2. the observation bridge derives full-partition support;
3. the upstream law probe evaluates stake threshold and minimum-message coverage;
4. deterministic digests make the observation replayable.

The next target is to minimize a tension case while preserving the same finalizer
observation, then attach the minimized observation to an actual upstream execution
trace rather than treating the matrix itself as a protocol finding.


## M7 — deterministic tension minimization

The harness now minimizes a concrete STAKE_COVERAGE_TENSION observation while preserving the two defining predicates: strict supermajority stake support and incomplete minimum-message coverage. The minimizer removes bonded validators deterministically and stops at a two-validator case so the reproducer remains meaningfully multi-validator.

For the existing 70/10/10/10 fixture, the minimized observation is 70/10 with support from the 70-stake validator and only one minimum-message sender. This is a smaller observation of the same law-level tension, not yet an upstream protocol finding. The runnable reproducer is npm run demo:casper-tension-minimizer.

The next step is to map this minimized observation onto an actual upstream message/DAG construction and verify whether the upstream execution path can produce it, especially across check_min_messages and calculate_fringe.


## M8 — upstream control-flow gate

The minimized two-validator tension is now checked against the control-flow ordering visible in `rchain-community/rchain-rust` `Finalizer::next_fringe` at commit `9e667e203861c791aa9349b0351397ccc29f0fc8`. The upstream code calls `check_min_messages` before `calculate_next_layer`, `calculate_next_fringe_support_map`, and `calculate_fringe`; `check_min_messages` requires `min_msgs.len() == bonds_map.len()`.

Therefore an observation with strict supermajority stake but incomplete minimum-message coverage is a law-level tension, but it is blocked at the minimum-message gate before the Law-14 fringe calculation is reached. The new gate probe models this ordering without reimplementing consensus. This changes the research question from “does the stake threshold create a reachable contradiction?” to “can an actual upstream DAG/message construction produce the purported observation while satisfying the minimum-message gate, and if not, what upstream behavior should be treated as the invariant?”

Runnable check: `npm run demo:casper-upstream-gate`.


## M9 — observation-to-gate mapping

The minimized M7 observation is now mapped directly into the M8 upstream gate probe. This closes the handoff between the synthetic law-level minimizer and the upstream-facing control-flow boundary without duplicating consensus execution. The two cases are explicit: incomplete coverage is blocked before the fringe stage; complete coverage crosses the gate and becomes eligible for the next upstream-stage experiment.

This adapter is an instrumentation boundary, not a protocol implementation. The remaining research step is to replace the abstract validator/sender sets with a concrete DAG/message fixture whose delivery history generates those sets.


## M10 — concrete DAG/message construction

A deterministic nine-message fixture now generates the validator/message sets from explicit sender sequence, parent, seen-set, and justification data. The fixture is intentionally a narrow data-flow model rather than a consensus implementation. It verifies that complete minimum-message coverage and a strict-supermajority stake condition can coexist in a concrete delivery history, making the next step an upstream semantic comparison rather than another synthetic matrix.


## M11.1 — constrained adversarial delivery-history search

The semantic lock is now followed by a deterministic mutation search over the concrete nine-message DAG. The mutation model only adds first-layer parents to the four justification messages and adds first-layer visibility of the four next-layer minimum messages.

The search retains the upstream minimum-message gate and looks for a Law-14 finalizing candidate. It finds one with **29 additions**: 13 parent-edge additions and 16 seen-set additions. Each individual addition is essential within this constrained mutation model; removing any one prevents finalization.

The candidate therefore acts as a positive control for the semantic pipeline: the model can reach a fully supported fringe when the delivery history actually contains the required fan-in and visibility structure. This is **not** evidence of a production fragility by itself. The next research step is to minimize the mutation family against the real upstream DAG/message construction and determine whether the same support transition is reachable under the protocol's actual block/message invariants.


## M11.2 — upstream reachability gate

The next screen checks invariants that can be derived directly from the current upstream implementation before a candidate is treated as an upstream-reachable history.

The original nine-message fixture now has an explicit result: it fails the sender-sequence invariant for all four seq=2 messages because the upstream validation requires the creator's latest justified sequence plus one. This fixture therefore remains a semantic/data-flow fixture, not an upstream-valid block history.

A second 13-message positive-control fixture was added with three causal layers after a non-bonded genesis: seq=1 minimum messages, seq=2 observers, and seq=3 justifications. Its seen sets are derived exactly as upstream constructs them from parent seen-sets plus the current message. The reachability screen passes, and the semantic finalizer trace reaches Law-14 with full 100/100 stake support.

This gives the investigation a clean separation between two cases: a semantic probe that is useful for isolating finalizer logic, and a causally admissible positive control that demonstrates the support transition can arise in a message history satisfying the currently checked DAG invariants.


## M11.3 — reachability-preserving finalization flip

Starting from the causally valid three-layer positive control, the harness now searches one-parent deletions and re-derives every affected seen-set from the resulting parent graph.

It finds three equivalent one-change cases. Removing exactly one non-self layer-2 parent from the high-stake validator's justification (a3 -> b2, a3 -> c2, or a3 -> d2) keeps the history upstream-admissible and keeps minimum-message coverage intact, but removes full-partition support for the 70-stake sender. Finalization therefore flips from true to false with a single parent-edge change.

This is an important reachable liveness boundary, not yet a protocol fragility finding. The observed transition is consistent with the finalizer's support rule: the high-stake justification no longer has a complete observer partition. The next step is to determine whether an equivalent one-edge boundary is merely the expected CBC liveness condition or exposes an implementation-specific mismatch when exercised through the actual upstream Rust DAG construction.


## M11.4 — duplicate minimum-message candidate

A new deterministic fixture explores a sharper boundary in the upstream finalizer gate. It contains four minimum-message entries but only three distinct bonded senders: the justification set includes two messages from v0 and one each from v1 and v2, while v3 has no minimum message.

The reachability screen still passes the currently checked DAG invariants. The finalizer semantic trace nevertheless shows the count-only gate passing (`min_msgs.len() == bonds_map.len()`), a distinct-sender coverage failure, and a Law-14 finalization outcome with 90/100 supporting stake. The duplicate v0 justifications also demonstrate sender-keyed support-map overwrite: one v0 justification has full partition support while the other does not, and the sender-keyed map retains the later processed witness.

This is now the most interesting implementation-level candidate in the investigation, but it remains a **candidate discrepancy**, not a vulnerability claim. The required next step is an actual upstream Rust execution/reproducer using the same concrete Message set to determine whether the production Finalizer exhibits the same behavior. If reproduced, the smallest fix hypothesis is to validate distinct bonded sender coverage rather than message count alone before entering fringe calculation.


## M11.5 — pinned upstream Finalizer reproducer

The investigation now contains an executable reproduction against the exact upstream commit used for the semantic lock: `rchain-community/rchain-rust@d92f0787a6096cd6d79864ec2d7c1dd9b6912d0b`.

The reproducer injects a temporary integration test into upstream `block-storage/tests` and runs `cargo test -p rchain-block-storage` against the real Rust `Finalizer`, covering:

- the exact four-entry minimum-message multiset `v0, v0, v1, v2`
- the production `check_min_messages` predicate
- production `calculate_next_layer` sender-key collapse
- production `calculate_next_fringe_support_map`
- production `calculate_fringe` Law-14 evaluation
- the full public `calculate_finalization` loop

A second source-level observation is now explicit: the pinned SDK contains `invalid_justification_follows`, which compares the distinct sender set of justifications against the bonded sender set, but the current `casper/src/validate.rs::block_summary` path does not call that predicate. The active validation chain is justification regression, sequence number, block number, pure deploy checks, and repeat-deploy validation.

This does **not** by itself prove a protocol vulnerability. The decisive evidence is the result of the real upstream integration test. The pinned upstream test has now passed. The real Rust Finalizer reproduced the duplicate-sender case exactly: four minimum-message entries (`v0, v0, v1, v2`) pass the count-only gate, the sender-keyed next layer collapses to three senders, the support map yields 90/100 supporting stake, and the public finalization loop advances the fringe. This is therefore a **confirmed implementation behavior of the pinned Finalizer**, not merely a semantic-mirror artifact.


### M11.5 result — confirmed in upstream Rust

The M11.5 workflow checked out `rchain-community/rchain-rust@d92f0787a6096cd6d79864ec2d7c1dd9b6912d0b`, installed its pinned Rust toolchain, installed `protoc`, injected the deterministic test into `block-storage/tests`, and executed:

`cargo test -p rchain-block-storage --test m11_5_duplicate_minimum_messages -- --nocapture`

Result: **1 passed; 0 failed**.

The test exercised the actual upstream `Finalizer` methods rather than the TypeScript mirror. The pinned implementation confirmed the candidate behavior: the four-entry minimum-message vector `v0, v0, v1, v2` passes `check_min_messages`; `calculate_next_layer` collapses the duplicate sender; `calculate_next_fringe_support_map` produces full-partition support for the three represented justification senders; `calculate_fringe` accepts 90/100 stake; and `calculate_finalization` advances the fringe.

This establishes a real upstream implementation behavior. It does **not yet establish that an externally submitted block can traverse the entire production validation/ingress path with this duplicate-sender justification set**. That is the next boundary before calling it a protocol vulnerability.


## M11.6 — active validation admission probe

The next boundary is now exercised against the active upstream Casper validation path rather than only the Finalizer internals. The pinned upstream commit remains `d92f0787a6096cd6d79864ec2d7c1dd9b6912d0b`.

The injected M11.6 integration test constructs a real `BlockMessage` whose five distinct justification hashes represent only four distinct senders: `v0, v0, v1, v2, v3`. The current block uses `v3` as sender with the matching sequence/block-number relationships and supplies the referenced parent blocks through the real `BlockStore` interface.

The test calls the production `casper::validate::block_summary` function. This is the active validation chain used by `MultiParentCasper::validate` before `validate_block_checkpoint`: justification regression, sequence number, block number, deploy checks, and repeat-deploy validation. The candidate block passes this path unchanged.

The probe also locks down the limitation of the existing SDK helper: `invalid_justification_follows` compares a Set of justification senders with the bonded-sender Set. A duplicate sender therefore disappears during comparison; `v0,v0,v1,v2,v3` is treated as the same sender set as `v0,v1,v2,v3`. So the helper, even if called, does not enforce one-justification-per-bonded-sender cardinality.

Combined with M11.5, this establishes a stronger boundary: the pinned Finalizer demonstrably processes the duplicate-minimum-message shape, while the active block-summary validation path does not reject the corresponding duplicate-sender justification shape. This is still described as a **confirmed implementation discrepancy / admission boundary**, not yet as a protocol vulnerability, because the complete production `validate_block_checkpoint` replay path and network ingress must still be exercised with the same block.

Runnable upstream probe:

`cargo test -p rchain-casper --test m11_6_duplicate_sender_admission -- --nocapture`

**M11.6 result — confirmed in upstream Casper validation:** the workflow checked out `rchain-community/rchain-rust@d92f0787a6096cd6d79864ec2d7c1dd9b6912d0b`, injected the test into `casper/tests`, and executed `cargo test -p rchain-casper --test m11_6_duplicate_sender_admission -- --nocapture`. Result: **1 passed; 0 failed**. The active `block_summary` path therefore admits the duplicate-sender justification shape used by the probe. This is an implementation/admission finding, not yet a protocol-vulnerability claim.

The next decisive experiment is the end-to-end bridge from this admitted `BlockMessage` into `validate_block_checkpoint -> get_pre_state_for_parents -> Finalizer::calculate_finalization`, using a minimal real upstream DAG/state cache rather than a semantic mirror.
