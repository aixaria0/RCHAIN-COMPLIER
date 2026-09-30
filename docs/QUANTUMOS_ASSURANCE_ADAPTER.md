# QuantumOS Proof-Carrying Closure Adapter

This branch adds a deliberately narrow integration boundary between the protocol-neutral Causal Assurance verification core and the public QuantumOS collective-intelligence model.

## Purpose

QuantumOS treats humans, agents, and rnodes as participants whose outputs should be checked rather than trusted. The adapter turns a normalized room closure into a bounded verification problem without making the Causal Assurance core depend on QuantumOS.

```text
QuantumOS room / agent / rnode
        |
        v
normalized closure observation
        |
        v
quantumos-proof-carrying-closure adapter
        |
        v
protocol-neutral verification compiler
        |
        +--> UNREACHABLE_IN_MODEL  (no contradiction inside supplied evidence)
        +--> WITNESS_FOUND         (explicit contradiction)
        +--> INCONCLUSIVE          (evidence insufficient for comparison)
```

## Current vertical slice

The first slice supports:

- `LEMMA` closures with signed evidence and an explicit ZFA-balanced result;
- `RHOLANG` closures with multiple independently identified perspectives;
- comparison only when every rnode reports the same program digest and pre-state;
- explicit post-state/result divergence witnesses;
- fail-closed handling of a single rnode, missing fields, or absent ZFA evidence;
- preservation of claim/scope/assumption identity through the existing verification compiler.

The adapter is intentionally not a QuantumOS client yet. It does not fetch room state, execute rholang, or claim chain finality. Those belong in later live adapters.

## Why this boundary

A single rnode result must not become a trusted oracle merely because it returned successfully. This adapter therefore reports one rnode as `INCONCLUSIVE`. Two comparable perspectives can establish bounded agreement; disagreement becomes a decidable falsifier.

This matches the existing Causal Assurance rule:

> A claim must never become stronger while moving through the pipeline unless new evidence explicitly justifies the stronger claim.

## Next live integration

The next step is to replace the frozen normalized fixture with an adapter that consumes real QuantumOS signed room envelopes and real rnode replay observations while preserving this exact verification contract.
