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

## Publication boundary

This repository is intentionally reproducible and public.

The evidence language remains strict:

synthetic observation != upstream behavior

upstream behavior != protocol vulnerability

deterministic reproduction > narrative assertion
