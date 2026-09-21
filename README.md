# RChain Casper CBC Stress Harness

**Deterministic, replayable research infrastructure for stress-testing Casper CBC finalization behavior against the real RChain Rust implementation.**

[![CI](https://github.com/aixaria0/RCHAIN-COMPLIER/actions/workflows/ci.yml/badge.svg)](https://github.com/aixaria0/RCHAIN-COMPLIER/actions/workflows/ci.yml)
[![Reality Plane CI](https://github.com/aixaria0/RCHAIN-COMPLIER/actions/workflows/reality-plane.yml/badge.svg)](https://github.com/aixaria0/RCHAIN-COMPLIER/actions/workflows/reality-plane.yml)
[![Upstream Finalizer](https://github.com/aixaria0/RCHAIN-COMPLIER/actions/workflows/m11-5-upstream-finalizer.yml/badge.svg)](https://github.com/aixaria0/RCHAIN-COMPLIER/actions/workflows/m11-5-upstream-finalizer.yml)
[![Upstream Validation](https://github.com/aixaria0/RCHAIN-COMPLIER/actions/workflows/m11-6-upstream-admission.yml/badge.svg)](https://github.com/aixaria0/RCHAIN-COMPLIER/actions/workflows/m11-6-upstream-admission.yml)
[![Upstream Pre-State Bridge](https://github.com/aixaria0/RCHAIN-COMPLIER/actions/workflows/m11-7-upstream-pre-state.yml/badge.svg)](https://github.com/aixaria0/RCHAIN-COMPLIER/actions/workflows/m11-7-upstream-pre-state.yml)

> Research status: executable upstream reproduction complete for the current duplicate-minimum-message candidate under a controlled DAG/state fixture.
>
> Important scope: this repository is a research and verification harness. It is not an RChain node, not a replacement for Casper, and does not by itself establish a production-network vulnerability.

## What this project does

This repository started as the RChain Reality Compiler: an evidence-oriented workbench for turning distributed execution observations into deterministic, inspectable records.

The current research track uses that architecture to answer a focused question:

**What happens when adversarial-but-causally-valid Casper CBC message histories are pushed through the actual upstream Rust finalization and validation pipeline?**

The harness keeps three layers separate:

~~~text
synthetic model
     |
upstream-facing observation
     |
real upstream Rust execution
     |
deterministic evidence
~~~

The goal is not to manufacture a vulnerability claim. The goal is to make the smallest implementation claim that survives contact with the actual code.

## Current verified result

Upstream pin:

~~~text
rchain-community/rchain-rust
d92f0787a6096cd6d79864ec2d7c1dd9b6912d0b
~~~

The current candidate reproduces this chain:

~~~text
duplicate-sender justification shape
          |
active block_summary validation
          |
get_pre_state_for_parents
          |
real Finalizer::calculate_finalization
          |
validate_block_checkpoint
          |
MultiParentCasper::validate
          |
1 passed / 0 failed
~~~

The concrete candidate contains a minimum-message multiset with duplicate sender coverage:

~~~text
minimum-message senders = [v0, v0, v1, v2]
bonded validators       = [v0, v1, v2, v3]
supporting stake        = 90 / 100
~~~

The key implementation boundary is that the minimum-message entry count equals the bond count while the distinct sender count does not. Later sender-keyed stages can therefore collapse duplicate entries.

The full integration probe also creates a real native PoS genesis state through RuntimeManager::compute_genesis and exercises the candidate through the production Rust validation functions used by MultiParentCasper::validate.

This is a confirmed implementation behavior under a deterministic integration fixture. It is deliberately not labelled a network-level vulnerability until the remaining ingress, signature, storage, and deployment assumptions are independently demonstrated.

See the full evidence log in docs/CASPER_CBC_RESEARCH_STATUS.md.

## Research progression

~~~text
law-level stake tension
        |
upstream minimum-message gate
        |
concrete DAG/message fixture
        |
causal reachability screen
        |
finalizer semantic lock
        |
real upstream Finalizer
        |
active validation admission
        |
real pre-state reconstruction
        |
full MultiParentCasper validation
~~~

| Milestone | Boundary | Result |
|---|---|---|
| M7 | deterministic tension minimization | 70/10 minimal law-level tension |
| M8 | upstream minimum-message gate | incomplete coverage blocked before fringe |
| M10 | concrete DAG/message construction | explicit sender/seq/parent/seen history |
| M11.4 | duplicate minimum-message candidate | candidate discrepancy isolated |
| M11.5 | real upstream Finalizer | confirmed |
| M11.6 | active block_summary validation | confirmed |
| M11.7–M11.9 | pre-state + checkpoint + full validation bridge | confirmed |

## Why the duplicate-message case matters

The candidate is intentionally narrow.

A protocol interpretation may expect one minimum message per bonded validator. The pinned implementation gate checks message count against bond count, while later processing is keyed by sender.

That creates the measurable boundary:

~~~text
count(minimumMessages) = count(bonds)
but
count(distinct senders) < count(bonds)
~~~

The harness does not assume that this is exploitable. It measures what the actual implementation does with that shape.

## What is real vs. synthetic

The synthetic layer provides deterministic stake-aware scenarios, delivery perturbations, equivocation, DAG/message construction, invariant checks, shrinking, and replay digests.

The upstream layer is separate. It injects focused integration tests into a clean checkout of the pinned upstream commit and compiles the relevant RChain crate against that exact revision.

No upstream source code is vendored into this repository.

## Reproduce the local research layer

Install dependencies:

~~~bash
npm install
~~~

Run the TypeScript research suite:

~~~bash
npm test
~~~

Run the repository quality gates:

~~~bash
npm run typecheck
npm run lint
npm run build
~~~

Run focused Casper demonstrations:

~~~bash
npm run demo:casper-upstream-gate
npm run demo:casper-concrete-dag
npm run demo:casper-finalizer-semantics
npm run demo:casper-adversarial-search
npm run demo:casper-upstream-reachability
npm run demo:casper-reachable-flip
npm run demo:casper-duplicate-minimum
~~~

The upstream Rust reproductions run in GitHub Actions so the exact upstream source revision is controlled and visible.

## Repository map

~~~text
src/lib/cbc/
    deterministic Casper stress model
    observation adapters
    DAG fixtures
    finalizer semantics
    reachability / perturbation searches

scripts/upstream/
    exact upstream integration reproducers

.github/workflows/
    repository CI
    Reality Plane CI
    pinned upstream Finalizer / validation bridges

docs/
    research status
    evidence / Reality Compiler architecture
~~~

Key upstream probes:

- scripts/upstream/m11-5-duplicate-minimum-messages.rs
- scripts/upstream/m11-6-duplicate-sender-admission.rs
- scripts/upstream/m11-7-pre-state-finalizer-bridge.rs

## Evidence discipline

**Observation** — a concrete result produced by the harness or upstream implementation.

**Reachability** — an observation that satisfies the currently checked upstream structural invariants.

**Implementation behavior** — the same shape exercised against real upstream Rust code.

**Protocol finding** — a stronger claim requiring protocol-level impact to be demonstrated.

The current milestone is in the third category.

## Non-goals

This repository does not claim to:

- replace the RChain node;
- implement a second Casper consensus engine;
- provide live mainnet evidence;
- prove all Casper safety or liveness properties;
- declare a vulnerability solely from a synthetic scenario;
- silently turn missing evidence into certainty.

## Research-facing architecture

The original Reality Compiler architecture remains useful because it provides an evidence boundary around the stress harness:

~~~text
execution / fixture
      |
canonical observation
      |
evidence + provenance
      |
deterministic analysis
      |
replay / contradiction checks
      |
upstream confirmation
      |
inspectable research result
~~~

## License

No license is currently declared for this repository. Public visibility should not be interpreted as a grant of reuse rights.

## Security

Consensus-sensitive findings should be handled carefully. See SECURITY.md.

## Contributing

Research contributions should include the exact upstream commit, a deterministic reproducer, the relevant implementation path, the observed result, and the smallest claim actually supported by the evidence. See CONTRIBUTING.md.
