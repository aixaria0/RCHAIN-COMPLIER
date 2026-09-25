# Casper CBC Research Status

## Executive status

**Current result: confirmed implementation behavior in the pinned upstream Rust validation pipeline, under a deterministic controlled DAG/state fixture.**

Upstream pin:

~~~text
rchain-community/rchain-rust
d92f0787a6096cd6d79864ec2d7c1dd9b6912d0b
~~~

Current duplicate-minimum-message candidate:

~~~text
minimum-message senders = [v0, v0, v1, v2]
bonded validators       = [v0, v1, v2, v3]
supporting stake        = 90 / 100
~~~

The key distinction is between minimum-message entry count and distinct sender coverage.

## Verified execution chain

The current integration evidence crosses these upstream boundaries:

1. Finalizer::check_min_messages
2. Finalizer::calculate_next_layer
3. Finalizer::calculate_next_fringe_support_map
4. Finalizer::calculate_fringe
5. Finalizer::calculate_finalization
6. casper::validate::block_summary
7. get_pre_state_for_parents
8. validate_block_checkpoint
9. MultiParentCasper::validate

The M11.7 bridge executes:

~~~bash
cargo test -p rchain-casper --test m11_7_pre_state_finalizer_bridge -- --nocapture
~~~

Latest verified result:

~~~text
running 1 test
test m11_7_real_pre_state_path_advances_the_upstream_finalizer ... ok
test result: ok. 1 passed; 0 failed
~~~

The fixture seeds a real native PoS genesis state through RuntimeManager::compute_genesis, constructs the controlled DAG and BlockStore, reconstructs pre-state through the upstream merge path, validates the checkpoint, and finally exercises MultiParentCasper::validate with a bounded timeout.

## M11.5 — upstream Finalizer

M11.5 moved the duplicate-minimum-message case from the TypeScript semantic mirror into the real upstream Rust Finalizer.

Confirmed behavior:

- count-only minimum-message gate passes;
- duplicate sender keys collapse during next-layer construction;
- sender-keyed support processing represents only the distinct senders present;
- Law-14 support reaches 90/100 in the candidate fixture;
- calculate_finalization advances the fringe.

This is confirmed upstream implementation behavior.

## M11.6 — active validation admission

M11.6 constructs a real BlockMessage whose distinct justification hashes correspond to:

~~~text
v0, v0, v1, v2, v3
~~~

The active casper::validate::block_summary path accepts the shape.

The existing SDK helper invalid_justification_follows does not enforce duplicate-sender cardinality because sender identities are compared as a Set.

This closes the active block-summary admission boundary for the controlled candidate.

## M11.7–M11.9 — pre-state and full validation bridge

The stronger bridge uses a deterministic in-memory DAG and BlockStore but calls the real upstream Rust functions.

The path is:

~~~text
BlockMessage
   |
block_summary
   |
validate_block_checkpoint
   |
get_pre_state_for_parents
   |
Finalizer::calculate_finalization
   |
pre-state / fringe reconstruction
   |
MultiParentCasper::validate
~~~

The fixture initially failed the full validator because the state had no native active-bonds leaf. That failure was an infrastructure/fixture issue, not a consensus outcome.

The harness was then changed to build a native PoS genesis state through RuntimeManager::compute_genesis and use that state as the candidate block state root.

The resulting upstream workflow passed with:

~~~text
1 passed; 0 failed
~~~

## M19 — downstream proposal propagation

M19 executes the real `DagMessageState::create_message` path with four bonded justifications carrying a three-member persisted fringe. With no newer finalization detected, the normal proposer construction preserves the parent fringe unchanged. The under-cardinality state is therefore not repaired at proposal construction.

## M20 — fork-sensitive propagation

M20 supplies two locally consistent views with complete four-sender justification coverage but different three-member fringes. The real proposal path preserves each fringe, and the resulting seen-closures differ: one view finalizes branch `v2`, the other branch `v3`.

This is the first concrete downstream state-selection consequence in the chain. It remains deliberately narrower than a live-network safety claim: the two views are supplied as different local histories, and the probe does not yet prove that an adversary can connect them into a causally valid conflicting-finality execution.

## M21 — exact invariant differential

M21 executes the exact pinned SDK predicate `invalid_justification_follows` against the duplicate witness and a one-per-sender control. The duplicate shape has four entries but only three distinct bonded senders, so the upstream predicate returns `true` (invalid); the control has four distinct bonded senders, so it returns `false`.

This sharpens the earlier M11.6/M12 result: the same witness that crosses the tested active summary/ingress boundaries is explicitly rejected by an existing upstream sender-set invariant predicate. M21 does not claim that this predicate is necessarily the correct consensus fix; it establishes the wiring differential at the pinned revision.

## M22 — exact call-site wiring audit

M22 takes the M21 differential one step further by checking the entire exact pinned source tree rather than relying on a local call-path reading.

The new workflow checks out the same revision and searches every source file outside `sdk/src/casper_syntax.rs` for `invalid_justification_follows`. The audit is designed to fail if the predicate is referenced by another module.

This closes an important ambiguity: at the pinned revision, the sender-set discriminator exists as an SDK predicate, but it is not wired into the active Casper validation source tree.

The corresponding M22 workflow must remain green before this repository treats the call-site statement as verified CI evidence.


## M23 — admission-to-proposal bridge

M23 closes the continuity gap between active admission and downstream state. On the exact pinned revision, the controlled duplicate-sender candidate first passes `casper::validate::block_summary`, is then inserted through the real `BlockDagKeyValueStorage`, and finally becomes input to the real `DagMessageState::create_message` path.

The persisted/latest fringe remains three-member, and the subsequent proposal preserves that fringe. This is a single continuous upstream storage/proposal test rather than separate isolated semantic fixtures.

## M24 — causal-origin search

M24 answers the opposite-direction question: can the normal proposer itself generate a one-to-three-member fringe from a clean sender-complete state?

The exact pinned `create_msg_and_update_sender()` path was exhaustively explored across all `4^1 + ... + 4^6 = 5,460` proposer schedules, starting from one latest message for each of four equal-stake validators.

The workflow passed with no under-cardinality witness.

This is a bounded causal-origin result, not a universal theorem. Its practical meaning is narrower and useful: within this clean proposer model and horizon, the observed under-cardinality shape is not spontaneously produced by ordinary proposal scheduling. It therefore enters the currently characterized system through the adversarial/input-validation boundary rather than through the normal proposer constructor itself.

The combined boundary is now:

```text
clean proposer schedules (5,460 searched)
        |
        +--> no 1..3 fringe produced
        |
adversarial duplicate-sender candidate
        |
        +--> active admission
        |
        +--> persisted under-cardinality fringe
        |
        +--> subsequent proposal propagation
```

## M25 — active gate counterfactual

M25 closes the active admission-boundary characterization without modifying the pinned upstream source.

The same real DAG identities were evaluated at the active `block_summary` boundary against a shadow distinct-bonded-sender predicate. Three controlled cases were checked:

~~~text
duplicate / missing bonded sender
    current count gate  = accepted
    shadow sender gate  = rejected

valid one-message-per-bonded-sender
    current count gate  = accepted
    shadow sender gate  = accepted

non-bonded replacement
    current count gate  = accepted
    shadow sender gate  = rejected
~~~

This is deliberately a compatibility characterization for the observed witness, not a claim that sender-set equality is the complete Casper specification or the only valid remediation.

## M26 — upstream-anchored CBC replay

M26 reconnects the original synthetic-first CBC stress harness to the now-characterized upstream boundary.

The exact pinned revision remains:

~~~text
rchain-community/rchain-rust@d92f0787a6096cd6d79864ec2d7c1dd9b6912d0b
~~~

The green M26 workflow runs three deterministic stress cases:

- baseline control: `CONVERGED`, 32 events, replay digest `9b66cf036e60a5449080ff04168b6063a4ad549179048f0154b0e55dc46cb7`;
- partition + reordering: `DIVERGENT`, 320 events, replay digest `339aeee9cd91cd2091bbce82a4cbb1faaef83844f8e5ac29d8151d82f0c6286c`;
- equivocation-4: `DIVERGENT`, 4 equivocations detected, 72 events, replay digest `253162794f58fa9d8924dbed81eadb5e2d345547f4ce9b19a2847a8272abc320`.

The same run verifies that the upstream boundary matrix remains:

~~~text
duplicate-missing-sender  -> count=true, shadow-sender=false
valid-control             -> count=true, shadow-sender=true
non-bonded-replacement    -> count=true, shadow-sender=false
~~~

M26 also emits a stable combined report digest:

~~~text
68754e9de6e75451d6ae05ff412b4bb9fa64fc570c2451029a8dc4d7884445cc
~~~

The key precision is causal scope: M26 pairs synthetic stress evidence with the exact upstream boundary; it does not claim that partition or equivocation alone causally generates the exact duplicate-sender witness.

## M27 — reachability-constrained adversarial search

M27 exhaustively enumerates all 256 four-entry justification selections from the reachability-valid top-layer pool [a3,b3,c3,d3].

~~~~text
candidates                       256
reachability-valid               256
count-gate accepted              256
sender-complete                   24
under-cardinality                232
exactly three senders            144
minimum mutation distance         1
minimum finalizing distance       1
~~~~

This gives the investigation a bounded minimality result: one justification replacement is enough to produce an under-cardinality witness from a message pool already satisfying the currently checked upstream DAG constraints.

M27 report digest:

~~~~text
f69415f0214605192c92a490027331e0a567b1d28eaed3dc5e4542d9d3ce0c6f
~~~~

## M28 — minimal duplicate-sender cryptographic ingress

M28 connects the M27 minimum witness to the exact upstream wire/receiver boundary.

At the same pinned revision, the witness is content-addressed and signed through the real upstream identity path. The injected BlockReceiver probe verifies that the four-entry / three-sender justification shape crosses the receiver boundary and reaches the validation queue.

Result:

~~~~text
exact upstream pin: verified
M28 probe: 1 passed, 0 failed
~~~~

This closes a practical evidence gap between minimum reachable witness and wire-valid ingress representation.

## Deliverable value

The research branch now provides a reusable Casper CBC stress/evidence workflow rather than a collection of standalone probes.

~~~~text
synthetic stress
      |
      v
deterministic evidence
      |
      v
exact upstream revision
      |
      v
minimal reachable witness
      |
      v
real signed ingress
      |
      v
explicit protocol-claim boundary
~~~~

The resulting value is reproducibility, inspectability, and a clear path for extending the same harness to additional fault modes, validator histories, or upstream revisions without rebuilding the investigation from scratch.

## Next boundary

The next research step is optional protocol-impact characterization, not required for the core deliverable. The current PR can be reviewed and consumed as a deterministic stress/evidence harness with an exact upstream reproduction chain.

## What this establishes

The strongest defensible statement at this stage is:

> The pinned upstream implementation contains a confirmed duplicate-minimum-message behavior that traverses the controlled full Casper validation pipeline.

That is stronger than a semantic-model discrepancy and stronger than an isolated Finalizer unit reproduction.

## What this does not establish

It does not, by itself, establish:

- that every production network version accepts the same shape;
- that an arbitrary network peer can construct the exact block under all cryptographic and transport constraints;
- that the behavior creates a live-network safety failure;
- that the behavior has a practical economic exploit path;
- that distinct-sender coverage is necessarily the intended specification invariant.

The current result should therefore remain classified as confirmed implementation behavior pending a separate protocol-impact analysis.

## Smallest next research hypothesis

The narrow hypothesis is whether the intended minimum-message invariant should be based on distinct bonded-sender coverage rather than raw message count:

~~~text
current gate:
count(minimumMessages) == count(bonds)

candidate invariant:
count(distinct senders in minimumMessages)
    == count(distinct bonded validators)
~~~

That is an impact-characterization question, not a patch recommendation.

## Primary reproduction artifacts

- scripts/upstream/m11-5-duplicate-minimum-messages.rs
- scripts/upstream/m11-6-duplicate-sender-admission.rs
- scripts/upstream/m11-7-pre-state-finalizer-bridge.rs
- .github/workflows/m11-5-upstream-finalizer.yml
- .github/workflows/m11-6-upstream-admission.yml
- .github/workflows/m11-7-upstream-pre-state.yml

## Local research modules

- src/lib/cbc/casper-concrete-dag.ts
- src/lib/cbc/casper-finalizer-semantics.ts
- src/lib/cbc/casper-upstream-gate.ts
- src/lib/cbc/casper-upstream-adapter.ts
- src/lib/cbc/casper-upstream-reachability.ts
- src/lib/cbc/casper-reachable-perturbation-search.test.ts
- src/lib/cbc/casper-cbc-upstream-replay.ts
- src/lib/cbc/casper-cbc-upstream-replay.test.ts

## Publication boundary

This repository is intentionally reproducible and public.

The evidence language remains strict:

synthetic observation != upstream behavior

upstream behavior != protocol vulnerability

deterministic reproduction > narrative assertion
