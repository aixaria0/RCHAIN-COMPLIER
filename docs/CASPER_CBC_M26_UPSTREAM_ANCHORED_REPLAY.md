# M26 — Upstream-Anchored CBC Replay

## Question

Can the original synthetic-first Casper CBC stress harness now be paired with the exact upstream boundary that M11–M25 characterized, while keeping the causal claim boundary explicit?

## Exact upstream anchor

```text
rchain-community/rchain-rust@d92f0787a6096cd6d79864ec2d7c1dd9b6912d0b
```

## Replay surface

M26 runs three deterministic stress scenarios through the existing CBC simulator:

1. `baseline-control`
2. `partition-reorder`
3. `equivocation-4`

Each scenario records event count, convergence rounds, result, equivocation evidence, and replay digest.

The stress result is then paired with the already-characterized upstream boundary matrix:

| Boundary case | Current count gate | Shadow distinct-sender gate |
|---|---:|---:|
| duplicate / missing bonded sender | accept | reject |
| valid one-message-per-bonded-sender | accept | accept |
| non-bonded replacement | accept | reject |

The duplicate and valid rows are also checked against the existing semantic Finalizer model so the M26 certificate preserves the M11.5/M21/M25 distinction rather than inventing a new consensus model.

## Important evidence boundary

M26 does **not** claim that a partition or equivocation scenario by itself causally produces the exact duplicate-sender upstream witness.

Instead it establishes a reproducible pairing:

```text
synthetic stress execution
        |
        +--> deterministic event/replay evidence
        |
        +--> paired with exact upstream boundary matrix
        |
        +--> common machine-readable replay certificate
```

This is deliberately an observation boundary, not a network exploit claim.

## Why this is the right next step

The original project direction asked for a synthetic-first stress harness capable of deterministic partition, reordering and equivocation experiments. The later upstream work established that the interesting sender-cardinality boundary is real at the pinned implementation revision.

M26 reconnects those two threads:

- stress scenarios remain synthetic and reproducible;
- the upstream revision remains exact and pinned;
- the sender-cardinality differential remains independently characterized;
- one digest covers the paired evidence record;
- no causal or production-network conclusion is inferred without a separate execution proving that linkage.

## Expected result

A green M26 run means:

- baseline replay is deterministic and convergent;
- partition + reordering produces inspectable divergent evidence;
- equivocation is explicitly detected;
- the upstream count-vs-sender coverage differential remains stable;
- the combined report is deterministic.

## Next boundary

The next meaningful step is not another isolated unit test. It is a bounded adversarial-history search that generates candidate event histories from the stress model, applies the existing upstream reachability screen, and only promotes histories satisfying those upstream-derived constraints into the evidence set.

That keeps the research moving toward a causally grounded replay without collapsing the synthetic harness into an unverified consensus reimplementation.
