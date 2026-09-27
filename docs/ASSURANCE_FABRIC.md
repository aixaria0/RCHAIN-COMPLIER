# RChain Assurance Fabric v1

## Purpose

Assurance Fabric connects the Reality Plane to bounded counterfactual analysis, implementation/model conformance, and recovery evidence.

It answers four different questions without collapsing them into one score:

1. **Possibility** — what can happen inside a declared model and search budget?
2. **Reality** — what was actually observed from a live system?
3. **Conformance** — did the implementation/replay match the expected model or digest?
4. **Recovery** — after interruption or restore, did the trusted state reconcile?

A release can only receive a `PASS` certificate when the required planes have evidence and no critical check is failed or blocked.

## Non-goals

This module is **not**:

- a replacement for Casper CBC finality;
- a second consensus layer;
- an implementation of AalWiNes or Weighted Pushdown Automata;
- a claim that finite search proves protocol-wide correctness;
- permission for an AI system to restart, slash, rotate keys, or modify quorum.

The Possibility Plane adopts a narrower idea from quantitative network verification: search for a minimum-cost counterexample/witness rather than enumerate failures blindly.

## Source classes

Every Reality Record is explicitly classified:

- `SYNTHETIC`
- `LIVE_OBSERVATION`
- `NATIVE_REPLAY`
- `FORMAL_MODEL`
- `INDEPENDENT_ATTESTATION`

A synthetic record can support development and regression testing, but it never satisfies the live-observation gate.

## Weighted possibility search

`searchWeightedPossibility()` performs deterministic Dijkstra search on an explicit finite state graph with non-negative transition costs.

The returned artifact contains:

- status: `REACHABLE | UNREACHABLE | LIMIT_REACHED`
- minimum cost when a target is reached;
- the exact witness path;
- explored-state count;
- peak frontier size.

`LIMIT_REACHED` is not treated as absence of a counterexample. It becomes `BLOCKED` when mapped to a critical assurance check.

This engine deliberately makes no pushdown-system or polynomial-time claim beyond the explicit graph it receives.

## Fail-closed promotion

Default promotion requirements are:

- at least one integrity-valid, non-divergent `LIVE_OBSERVATION`;
- at least one Possibility check;
- at least one Conformance check;
- at least one Recovery check.

Overall status:

- any critical `FAIL` -> `FAIL`
- otherwise any critical `BLOCKED` / `NOT_TESTED` -> `BLOCKED`
- otherwise -> `PASS`

Optional/non-critical work can remain `NOT_TESTED` without hiding a failed critical condition.

## Intended integration

```text
counterfactual / CBC search
          |
          v
   POSSIBILITY PLANE
          |
          +----------------------+
                                 |
rchain-rust -> rchain-sentinel -> Reality Record
                                 |
                                 v
                           REALITY PLANE
                                 |
Lean / exact replay ------------+----> CONFORMANCE
                                 |
restart / restore --------------+----> RECOVERY
                                 |
                                 v
                       Assurance Certificate
```

The certificate stores release identity, network/genesis identity, source-classified Reality Record digests, all gate results, and its own SHA-256 integrity digest.

## Review boundary

A `PASS` means only that the declared gates passed for the declared commit, network identity, observations, model scope, and recovery test.

It does not mean that RChain is bug-free, globally safe, economically secure, or immune to failures outside the tested assumptions.
