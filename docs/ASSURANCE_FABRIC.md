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

The source class is also checked against an explicit source-class matrix. In v1, compiler fixtures bind to `SYNTHETIC`, Sentinel records bind to `LIVE_OBSERVATION`, and the reserved native-replay/formal-model/attestation classes have named adapter sources. Relabeling a compiler fixture as live evidence fails the certificate.

For Sentinel, the source string alone is not sufficient. Promotion also checks the expected Sentinel record shape: subject kind, finalized-block observation, network-status observation, and the adapter transformation identifiers must all be present before the record is treated as promotion-grade live evidence. This is structural validation, not cryptographic signer authentication.

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

A record is not considered promotion-grade merely because it is labeled live. The strict live gate also requires Sentinel's finalized-block payload to be available, the canonical full-block identity to match, the node to report finality, canonical consistency to pass, the observed network endpoint to be reachable, and the Sentinel cross-node report to show consistent height/hash observations across at least two configured targets with no recorded conflict. Missing evidence is `BLOCKED`, not silently treated as success. Cross-node consistency is deliberately described only as endpoint consistency: two URLs are not automatically two independent operators or failure domains, and this check is not a stake-weighted Casper finality proof.

Freshness is an explicit scoped policy, not a hard-coded project promise. The certificate requires the caller to declare `maxObservationAgeMs`; that budget is included in the certificate digest. Stale evidence is `BLOCKED`, while evidence timestamped after certificate issuance is `FAIL`. This makes freshness reviewable without inventing a universal latency or expiry target.

## Fail-closed promotion

Default promotion requirements are:

- release artifact identity must include a canonical 40-hex source commit, a `sha256:` binary digest, and a `sha256:` digest for the build-provenance statement; this is identity completeness, not signature authentication;

- at least one integrity-valid, non-divergent `LIVE_OBSERVATION`;
- a matching live Sentinel network identity (`networkId` + `shardId`);
- promotion-grade live evidence inside the declared freshness budget;
- at least one **trusted, critical PASS** Possibility check;
- at least one **trusted, critical PASS** Conformance check derived from an integrity-valid `rchain-rust-native-replay` Reality Record;
- at least one **trusted, critical PASS** Recovery check derived from a chained before/after native-replay record pair with stable subject identity, matching recovered state, distinct process/disk identifiers, and a trusted checkpoint.

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

The certificate stores release identity, network/genesis identity, source-classified Reality Record digests, all gate results, and its own SHA-256 integrity digest. Its certificate ID is also bound to repository/commit, network identity, issuance time, freshness scope, strict-policy digest, and the sorted Reality Record digests, so two materially different evidence snapshots do not share the same logical certificate identifier. Certificate canonicalization sorts object keys recursively before hashing, so semantically identical metadata is not sensitive to object insertion order.

Recovery checks are stricter than digest equality: the helper requires an independent process, independent disk, and a trusted checkpoint in addition to matching pre/post recovery digests. A same-runtime or same-disk "restore" is therefore BLOCKED rather than promoted.

## Review boundary

A `PASS` means only that the declared gates passed for the declared commit, network identity, observations, model scope, and recovery test.

It does not mean that RChain is bug-free, globally safe, economically secure, or immune to failures outside the tested assumptions.


## Validation

Consumers should run both:

- `verifyAssuranceCertificateIntegrity()` — detects payload changes relative to the embedded SHA-256 digest.
- `verifyAssuranceCertificatePolicy()` — confirms the certificate still carries the non-weakened `rchain-revival-strict/v1` requirements.

`validateAssuranceCertificate()` combines both checks. These checks provide deterministic integrity and policy validation; they do **not** provide signer authenticity. Cryptographic observer/build signatures remain a separate trust layer.


## Machine-readable limitations

Every certificate carries explicit limitations inside the hashed payload. v1 states that:

- SHA-256 integrity is not signer authenticity;
- the declared provenance-statement digest is not cryptographic verification of the builder/signature;
- cross-node consistency does not establish independent operators/failure domains;
- cross-node consistency is not a stake-weighted Casper finality proof;
- bounded possibility search applies only to its declared model/search scope.

These limitations remain present even on a `PASS` certificate so consumers cannot infer stronger guarantees from the status than the evidence supports.


## Record-bound conformance and recovery

Free-form digest comparison helpers remain available for diagnostics, but they are intentionally **not** trusted producers under `rchain-revival-strict/v1` and therefore cannot satisfy the Conformance or Recovery promotion gates.

Promotion-grade conformance is derived from a sealed `rchain-rust-native-replay` Reality Record whose replay is complete and reproduced. Promotion-grade recovery is derived from two integrity-valid native-replay records where the after-record links to the before-record digest, the subject identity is unchanged, recovered state matches the pre-recovery state, and the recovery context demonstrates a different process and disk plus a trusted checkpoint.

This still does not authenticate who produced the native-replay record; signer authenticity remains an explicitly recorded limitation.
