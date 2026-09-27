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

For Sentinel, the source string alone is not sufficient. Promotion requires the signed Sentinel adapter path. The adapter verifies the pinned Ed25519 key, reconstructs a Reality Record, and carries a process-local cryptographic trust marker. The promotion-grade shape now includes finalized-block evidence, network status, an RNode-challenged genesis witness, cross-node observations, signed failure-domain declarations, and the adapter transformation/verification chain. Relabeling or reconstructing equivalent JSON does not recreate that trust marker.

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

### Direct Casper/CBC possibility search

`searchReachableCasperCounterexample()` now applies the same quantitative search discipline directly to the concrete Casper DAG model rather than only consuming a precomputed report.

The declared v1 search model is `reachability-valid-parent-deletions/v1`:

- the baseline must be upstream-reachable, finalizing, and have distinct bonded-sender minimum-message coverage;
- one transition removes one parent edge;
- after every mutation, `seen` is re-derived recursively from the parent graph, independent of message-array order;
- states that violate the upstream reachability/admissibility screen are discarded;
- states that lose the minimum-message count or distinct bonded-sender coverage are pruned;
- transition costs are explicit and non-negative;
- the goal is the minimum-cost reachable history that preserves those admission/coverage conditions but flips finalization.

The assurance adapter maps outcomes fail-closed:

- `COUNTEREXAMPLE_FOUND` → `FAIL`;
- `EXHAUSTED_NO_COUNTEREXAMPLE` → `PASS` **only within this declared mutation/search model**;
- `LIMIT_REACHED` → `BLOCKED`.

This is a concrete CBC counterexample search over the harness's causal DAG semantics. It is not a claim that every network behavior can be represented by parent deletion, nor is it a substitute for the pinned upstream Rust reproducer.

## Strict policy and non-bypassable producers

The default policy is identified as `rchain-revival-strict/v1`. Core requirements are monotonic: callers may not turn a required gate off.

Checks that can satisfy Possibility, Conformance, or Recovery are produced by trusted in-process helpers. A manually constructed `PASS` remains visible in the certificate but is downgraded to `BLOCKED` for promotion because it has no trusted producer attestation.

The live Reality gate binds the declared `genesis`, `networkId`, `shardId`, and optional epoch to pinned-key Sentinel evidence. Genesis is not accepted as a copied configuration string: Sentinel challenges the configured genesis hash through the RNode canonical `/api/block/{hash}` path, requires the returned hash to match, and requires block height zero. A mismatch is `FAIL`; unavailable or incomplete evidence is `BLOCKED`.

A record is not considered promotion-grade merely because it is labeled live. Under `rchain-revival-strict/v1`, unsigned Sentinel records are diagnostic only. The strict live gate requires the finalized-block payload to be available, canonical block identity to match, node-reported finality, canonical consistency, a reachable observed endpoint, verified genesis identity, and consistent height/hash observations across at least two targets. The signed snapshot must also declare operator, provider, region, and failure-domain metadata for every configured target with exact coverage, no duplicates, at least two distinct operators, and at least two distinct failure-domain identifiers. These declarations are tamper-evident because they are inside the signed snapshot; they are still declarations and not independent proof that the operational entities are truly separate. Cross-node consistency remains distinct from stake-weighted Casper finality.

Freshness is an explicit scoped policy, not a hard-coded project promise. The certificate requires the caller to declare `maxObservationAgeMs`; that budget is included in the certificate digest. Stale evidence is `BLOCKED`, while evidence timestamped after certificate issuance is `FAIL`. This makes freshness reviewable without inventing a universal latency or expiry target.

## Fail-closed promotion

Default promotion requirements are:

- a canonical 40-hex source commit, a `sha256:` binary digest, and a `sha256:` SLSA provenance-statement digest;
- a `rchain-build-provenance-attestation/v1` envelope whose pinned Ed25519 signature is reverified, whose in-toto/SLSA statement binds the exact repository + commit + binary subject, and whose signer key and builder ID are both inside the certificate's authorization policy;
- at least one integrity-valid, non-divergent `LIVE_OBSERVATION` produced from a pinned-key `rchain-sentinel-attestation/v1`;
- an RNode-challenged genesis witness matching the declared genesis at height zero;
- exact signed failure-domain declarations for the Sentinel target set, with at least two distinct operators and failure-domain identifiers;
- a matching live Sentinel network identity (`networkId`, `shardId`, optional epoch) and live evidence inside the declared freshness budget;
- at least one **trusted, critical PASS** Possibility check;
- at least one **trusted, critical PASS** Conformance check derived from a pinned-key signed native replay whose repository, commit, and binary digest match the exact release in the certificate;
- at least one **trusted, critical PASS** Recovery check derived from a signed chained before/after native-replay pair with stable subject identity, matching recovered state, distinct process/disk identifiers, a checkpoint digest included in replay inputs, a declared checkpoint source, signed recovery-log and restore-tool digests, and ordered restore timestamps.

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

Recovery checks are stricter than digest equality. The signed recovery manifest must prove record chaining, stable subject identity, a different process and disk, a trusted checkpoint whose digest is one of the actual replay inputs, a checkpoint source, SHA-256 identities for the recovery log and restore tool, and ordered start/finish timestamps. A same-runtime restore, same-disk restore, hand-declared checkpoint that was not replayed, or incomplete restore manifest is `BLOCKED`; a complete state mismatch is `FAIL`.

## Review boundary

A `PASS` means only that the declared gates passed for the declared commit, network identity, observations, model scope, and recovery test.

It does not mean that RChain is bug-free, globally safe, economically secure, or immune to failures outside the tested assumptions.


## Validation

Consumers should run both:

- `verifyAssuranceCertificateIntegrity()` — detects payload changes relative to the embedded SHA-256 digest.
- `verifyAssuranceCertificatePolicy()` — confirms the certificate still carries the non-weakened `rchain-revival-strict/v1` requirements.

`validateAssuranceCertificate()` combines both checks. Certificate-only validation still does **not** recreate source-attestation authenticity after serialization. For an external trust decision, use the portable Assurance Package verifier described below: it re-verifies the reviewer signature and every original build, Sentinel, and native-replay attestation from scratch and checks that the reconstructed Reality Record digests exactly match the certificate.


## Machine-readable limitations

Every certificate carries explicit limitations inside the hashed payload. v1 states that:

- SHA-256 integrity is not signer authenticity;
- build provenance authenticity depends on runtime verification of the pinned Ed25519 builder key plus the declared builder authorization set; this does not prove the trusted build platform itself was uncompromised;
- signed failure-domain metadata records a tamper-evident declaration, not independent corroboration that the named operators/providers/regions are actually separate;
- cross-node consistency is not a stake-weighted Casper finality proof;
- bounded possibility search applies only to its declared model/search scope.

These limitations remain present even on a `PASS` certificate so consumers cannot infer stronger guarantees from the status than the evidence supports.


## Record-bound conformance and recovery

Free-form digest comparison helpers remain available for diagnostics, but they are intentionally **not** trusted producers under `rchain-revival-strict/v1` and therefore cannot satisfy the Conformance or Recovery promotion gates.

Promotion-grade conformance is derived only from a pinned-key signed `rchain-native-replay-attestation/v1` that reconstructs an integrity-valid `rchain-rust-native-replay` Reality Record and binds the exact repository, commit, and binary digest in the release. Promotion-grade recovery requires two such signed records; the after-record must link to the before-record digest, retain the subject identity, reproduce the state, and carry the complete checkpoint-bound recovery artifact manifest.

Native-replay key possession is verified cryptographically. Organizational authorization is a separate explicit certificate policy: a cryptographically valid native-replay signer outside the declared authorization set causes `FAIL`.


## Optional Ed25519 certificate envelope

`scripts/assurance-signature.mjs` can wrap the complete canonical Assurance Certificate in a detached-style Ed25519 envelope. The signature covers the entire canonical certificate object, not only its embedded SHA-256 digest.

The envelope publishes the Ed25519 public key and a `sha256:` key fingerprint. Verification can pin an expected `keyId`; **pinning is required for an external trust decision**. Verifying a signature against a public key supplied by the same envelope proves key possession, not that the signer is an authorized RChain reviewer.

Private keys are never generated, stored, or committed by the Assurance Fabric. Key custody and reviewer authorization remain external operational responsibilities.

This closes certificate tamper/authorship mechanics when a trusted key is pinned, but it does not retroactively authenticate unsigned Sentinel or native-replay observations contained in the certificate.


## Signed Sentinel observation path

The signed path is intentionally two-stage:

1. `rchain-sentinel` produces `rchain-sentinel-attestation/v1`, signing one canonical snapshot containing network status, RNode-challenged genesis evidence, finalized-block evidence, cross-node observations, and exact failure-domain declarations.
2. `sentinel-signed-adapter.ts` recomputes the canonical payload SHA-256, verifies the Ed25519 signature and pinned key fingerprint, validates genesis identity, validates exact failure-domain coverage, and reconstructs the corresponding Reality Record.

Only after all checks pass does the adapter create a Reality Record and mark that in-memory record as cryptographically verified. Re-sealing, copying, deserializing, or manually adding `signatureVerified: true` does not recreate this runtime trust marker; the original signed snapshot must be reverified.

This proves that the snapshot was signed by the holder of the pinned key. It still does not establish that the pinned key is organizationally authorized unless that authorization is managed outside this code.


## Observer authorization set

Cryptographic validity and authorization are separate checks.

Each certificate can declare:

```ts
observerTrust: {
  authorizedKeyIds: ["sha256:..."]
}
```

The key IDs are normalized, validated, sorted, included in the certificate payload, and bound into the certificate identifier. A signed Sentinel record can satisfy strict promotion only if:

1. its Ed25519 signature was verified at runtime against a pinned key;
2. the attested key fingerprint appears in the certificate's declared authorization set.

A valid signature from a key outside that set is a `FAIL`, not merely missing evidence. An empty authorization set is `BLOCKED`.

This mechanism records the trust decision; it does not itself establish who has organizational authority to add a key to the set. That authority should be controlled by the process/key that signs the final Assurance Certificate.


## Cryptographic promotion boundary

Logical PASS values are not self-authenticating. The default certificate policy therefore refuses promotion when a caller merely supplies strings that claim a build, replay, recovery, or live observation occurred.

The trusted promotion path is:

```text
source commit
    |
signed SLSA / in-toto provenance
    |
binary SHA-256
    |
signed native replay -----------+
                                 |
signed Sentinel observation ----+--> Assurance Certificate
       |                         |
       +-- network/shard/epoch --+
       +-- failure domains ------+
                                 |
previous Reality Record -> signed recovery replay
```

The runtime trust markers are intentionally non-serializable process-local capabilities (WeakSet-backed). Reconstructing equivalent JSON does not recreate cryptographic trust; the corresponding signed adapter must verify the pinned key in the current process.

This v1 policy is intentionally conservative. A certificate may remain BLOCKED even when individual logical checks pass if their evidence is not cryptographically bound to the declared release and observed network.


## Portable Assurance Package

A process-local WeakSet trust marker is intentionally not serializable. That protects the in-process API from hand-constructed objects, but it is insufficient when an artifact is handed to another reviewer or machine.

`rchain-assurance-package/v1` is the portable external-verification boundary. Its payload contains:

- the complete Assurance Certificate;
- the original signed SLSA/in-toto build-provenance attestation;
- the original signed Sentinel snapshot(s), including their Sentinel base URL used when reconstructing the Reality Record;
- the original signed native-replay/recovery attestation(s).

The whole package is then signed by a reviewer key using Ed25519. `verifyAssurancePackage()` requires a pinned expected reviewer key ID and performs the following from scratch:

1. recompute and verify the package payload digest and reviewer signature;
2. verify the embedded certificate integrity and non-weakened strict policy;
3. reverify the build provenance under the authorized builder key and builder ID, then compare its source/artifact/provenance identities to the certificate;
4. reverify every Sentinel snapshot under an authorized observer key, reconstruct each Reality Record, and require the resulting digest set to exactly equal the certificate's `LIVE_OBSERVATION` references;
5. reverify every native-replay/recovery snapshot under an authorized replay key, reconstruct the records, and require the digest set to exactly equal the certificate's `NATIVE_REPLAY` references.

Adding, deleting, replacing, or reordering evidence semantically outside the signed canonical package cannot silently change the trusted result. A reviewer signature proves possession of the pinned reviewer key; the governance process that authorizes that key remains external.


## Semantic validation and promotion boundary

Certificate verification is deliberately stronger than recomputing its SHA-256 digest. A verifier also recomputes the check summary and derived status, rejects duplicate check identifiers, requires every strict-policy gate exactly once, and rejects PASS results for Possibility/Conformance/Recovery unless they retain trusted-producer metadata. A signed Assurance Package is promotion-grade only when the embedded certificate itself is `PASS`.

Build provenance repository identity is exact after normalization. Substring/prefix matches are rejected, preventing a dependency URI such as an attacker-controlled repository path that merely contains the expected repository name from satisfying source binding.
