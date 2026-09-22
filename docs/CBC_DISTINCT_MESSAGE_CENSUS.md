# Distinct-message CBC witness census — the next evidence gate

## Why this is a separate search

The first reported M27 minimum-distance modeled-finalizing tuple was `a3,a3,c3,d3`. Its **four tuple slots** contain only **three unique message IDs**. All four pinned Rust Finalizer implementations deduplicated that repeated `a3` at their `BTreeSet<Message>` boundary. See `docs/M27_FIRST_SEMANTIC_DIVERGENCE.md`. The original tuple's modeled finalization must not be exported as a directly replayed four-unique-message Rust result.

The new, independent `tools/cbc_distinct_message_census.mjs` deliberately enumerates **subsets without replacement** from the *actual message IDs* in two already-implemented source DAGs, imported read-only from `RCHAIN-COMPLIER@2d2c3d879b1a078693c8551385efb54a811d7172`:

- `buildCausallyValidDAG()`: eight existing seq=2/3 message IDs; choose four = 70 subsets.
- `buildDuplicateMinimumMessageDAG()`: seven existing seq=2/3 message IDs; choose four = 35 subsets.

There are exactly **105 four-distinct-ID source-model candidates**. Each source DAG is screened with the existing `analyzeUpstreamReachability` checks; every candidate uses four existing, different message IDs. The existing `traceCasperFinalizerSemantics` mirror supplies *model-reported* count-gate, unique minimum-sender coverage, stake support and finalization fields.

## Actual outcome of the first source-model CI run

The source-model enumeration generated **105** distinct-ID candidates. The mirror classified **81** as missing at least one bonded minimum sender and **43** as both under-coverage and model-reported finalizing. These counts describe this **finite, source-fixture-specific search**, not live nodes, attack probabilities, or independent Rust finality.

The output `cbc-distinct-message-census.json` preserves **every candidate**, source IDs and sender mapping, its input DAG family, the source-model reachability result and the mirror results. Each candidate explicitly carries `actualRustFinalizerExecutedForThisExactCandidate: false` and `wireIngressVerified: false`. No candidate is silently promoted to an upstream exploit or independently observed finality result.

The original multi-layer M11.5 source-level Rust experiment with *different* `a2`/`a3` IDs from v0 remains **separate, previously executed evidence**; this census does not claim its exact TS fixture is byte-for-byte the same as that Rust graph.

## Reproduce

In GitHub Actions, run **CBC distinct message ID census**. The job pins the read-only original source commit, runs negative tests and the actual census, checks identity uniqueness and explicit claim flags, then uploads `cbc-distinct-message-census` as a machine-readable artifact.

```sh
node --test tests/fork_drift/test_cbc_distinct_message_census.mjs
node --experimental-strip-types tools/cbc_distinct_message_census.mjs \
  --source-dir /path/to/RCHAIN-COMPLIER-at-2d2c3d879b1a078693c8551385efb54a811d7172 \
  --output distinct-message-census.json
```

## Hash-bound, exact-graph replay input

The census now produces a second artifact, `cbc-distinct-id-rust-replay-input.json`. A deterministic selection rule chooses the first model-finalizing, under-covered, **four-distinct-message-ID** candidate. Unlike a sender-label-only repro, the packet includes the complete **original source DAG**: every message's ID, sender, sequence number, parents and derived `seen` list; the exact bonded-stake map; selected justification IDs; a canonical graph SHA-256; and the census SHA-256. The producer rechecks ID/sender mapping and source-level reachability before exporting.

The packet explicitly says `rustReplayVerified: false` and `wireIngressVerified: false`. It is an **input to** the next exact Rust replay—not proof that the replay has passed or that the graph is wire-admissible. Any claim of reproduction must be attached later to actual pinned Rust execution logs for the exact graph hash, not inferred from the mirror's `modelReportedFinalized` flag.

## Precise next acceptance gate

Select individual four-distinct-ID / three-sender candidates by *content-hashed source input*; construct the **exact same causal graph** in Rust, compare each intermediate Finalizer state (minimum-message identities, count gate, sender-map size, support and fringe), and independently check full upstream block validation/ingress. If the mirror and Rust disagree, report the **first divergence and complete raw evidence**, not a security verdict. An epoch/bond-set-aware counterfactual sender-coverage check must be evaluated independently before proposing an upstream protocol change.

This census lives in independent draft PR #17. PR #16 remains unchanged and is consumed read-only.
