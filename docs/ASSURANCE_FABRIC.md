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

The source class is also checked against the adapter source. In v1, a record can satisfy `LIVE_OBSERVATION` only when it comes from an explicitly trusted live adapter source (`rchain-sentinel`). Relabeling a compiler fixture as live evidence fails the certificate.

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

## Strict policy and non-bypassable producers

The default policy is identified as `rchain-revival-strict/v1`. Core requirements are monotonic: callers may not turn a required gate off.

Checks that can satisfy Possibility, Conformance, or Recovery are produced by trusted in-process helpers. A manually constructed `PASS` remains visible in the certificate but is downgraded to `BLOCKED` for promotion because it has no trusted producer attestation.

The live Reality gate also binds the declared `networkId` and `shardId` to an integrity-valid Sentinel `NetworkStatus` observation. If the declaration conflicts with the observed network identity, the certificate fails. If the live observation does not expose enough network identity to compare, promotion is blocked.

A record is not considered promotion-grade merely because it is labeled live. The strict live gate also requires Sentinel's finalized-block payload to be available, the canonical full-block identity to match, the node to report finality, canonical consistency to pass, and the observed network endpoint to be reachable. Missing evidence is `BLOCKED`, not silently treated as success.

Freshness is an explicit scoped policy, not a hard-coded project promise. The certificate requires the caller to declare `maxObservationAgeMs`; that budget is included in the certificate digest. Stale evidence is `BLOCKED`, while evidence timestamped after certificate issuance is `FAIL`. This makes freshness reviewable without inventing a universal latency or expiry target.

## Fail-closed promotion

Default promotion requirements are:

- at least one integrity-valid, non-divergent `LIVE_OBSERVATION`;
- a matching live Sentinel network identity (`networkId` + `shardId`);
- promotion-grade live evidence inside the declared freshness budget;
- at least one **trusted, critical PASS** Possibility check;
- at least one **trusted, critical PASS** Conformance check;
- at least one **trusted, critical PASS** Recovery check.

Overall status:

- any critical `FAIL` -> `FAIL`
- otherwise any critical `BLOCKED` / `NOT_TESTED` -> `BLOCKED`
- otherwise -> `PASS`

Optional/non-critical work can remain `NOT_TESTED` without hiding a failed critical condition. A placeholder, non-critical, blocked, failed, or not-tested check does not satisfy a required plane gate.

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

The certificate stores release identity, network/genesis identity, source-classified Reality Record digests, all gate results, and its own SHA-256 integrity digest. Certificate canonicalization sorts object keys recursively before hashing, so semantically identical metadata is not sensitive to object insertion order.

Recovery checks are stricter than digest equality: the helper requires an independent process, independent disk, and a trusted checkpoint in addition to matching pre/post recovery digests. A same-runtime or same-disk "restore" is therefore BLOCKED rather than promoted.

## Review boundary

A `PASS` means only that the declared gates passed for the declared commit, network identity, observations, model scope, and recovery test.

It does not mean that RChain is bug-free, globally safe, economically secure, or immune to failures outside the tested assumptions.
