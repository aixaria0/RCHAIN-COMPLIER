# M24 — Causal Origin Search

## Question

M23 closed the admission-to-proposal bridge for an already admitted under-cardinality candidate. M24 asks the opposite direction:

> Can the normal proposer constructor itself generate a 1..3-member fringe from a clean one-message-per-bonded-validator DAG?

## Exact setup

Upstream revision:

```text
rchain-community/rchain-rust@d92f0787a6096cd6d79864ec2d7c1dd9b6912d0b
```

The probe uses the real `DagMessageState::create_msg_and_update_sender()` path. Four bonded validators are seeded with one latest message each. The search exhaustively explores every proposer sequence through depth six:

```text
4^1 + 4^2 + 4^3 + 4^4 + 4^5 + 4^6 = 5460 schedules
```

Each proposal uses the current `latest_msgs` as its justifications, matching the normal proposer shape rather than the adversarial duplicate-sender input used by M21–M23.

## Interpretation

If the search is green with no witness, the result is deliberately narrow:

```text
clean one-message-per-sender state
          |
          v
real create_msg_and_update_sender()
          |
          v
5460 schedules through depth 6
          |
          v
no 1..3-member fringe observed
```

That separates two mechanisms:

1. normal proposer construction under a clean sender-complete state; and
2. adversarially constructed but correctly signed inputs that the earlier M12/M21/M23 chain shows can cross active admission and propagate after insertion.

This is not a universal mathematical proof and does not exclude deeper or more complex histories. It is a bounded causal-origin characterization.

## Why this matters

M24 prevents the research from attributing the implementation discrepancy to ordinary honest proposal scheduling without evidence. A green result would mean the observed state is not spontaneously produced by this clean proposer path within the searched horizon; it instead requires an adversarially shaped input or an already-corrupted state.

The next step depends on the witness:

```text
no causal witness -> characterize exact adversarial boundary and remediation invariant
causal witness    -> replay the shortest causal history through full validation
```
