# Distinct-message CBC witness census and exact replay

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

## Replay and remaining acceptance gates

The selected `a2,a3,b2,c2` packet has now executed on all four pinned Rust Finalizers. [Run 35805385622](https://github.com/aixaria0/RCHAIN-COMPLIER/actions/runs/35805385622), at `8db29fbe10ae26bd9f9fc4fa0ed1bd591d10a70a`, records support 70/100, a true initial fringe predicate and final fringe `a1,b1,c1` in each implementation, with no difference at the compared initial-iteration stages. Minimum extraction remains a test projection of a private method, not an internal trace. See [the proof/code review entry point](CBC_LEAN_RUST_CONFORMANCE.md) for representation limits and the new Lean conformance gate. Full upstream block validation/ingress remains unverified. If the mirror and Rust disagree, report the **first divergence and complete raw evidence**, not a security verdict. An epoch/bond-set-aware counterfactual sender-coverage check must be evaluated independently before proposing an upstream protocol change.

This census lives in independent draft PR #17. PR #16 remains unchanged and is consumed read-only.

## Packet audit continuation (2026-09-23)

The handoff HEAD `a1a23270f9badc0977b7fdee30b9823dce12a56c` already included a packet verifier and Rust replay workflow. The census workflow succeeded, but exact replay run [35799781504](https://github.com/aixaria0/RCHAIN-COMPLIER/actions/runs/35799781504) failed: the generated Rust collection expression borrowed the collected set (`E0308`). That is a generated-test compilation failure, not a Finalizer semantic result.

Local regeneration confirmed 105 / 81 / 43. Deterministic selection is ASCII lexical DAG family followed by the comma-joined message IDs; the selected candidate remains `a2,a3,b2,c2` from `causally-valid-control`, with all 16 original messages. Its graph digest remains `d5145646e47d650acfdfc87d44d02e6eb5c9e126eed7d61bc5adf21b2e494281`.

The audit found that the old verifier accepted a changed positive stake if the packet and graph were resealed. The census now commits to the complete message/stake graph independently of the selected subset. Packet verification compares against that digest, checks deterministic selection and exact metadata, and the CLI regenerates the census from a clean pinned source checkout via required `--source-dir`. This rejects coordinated census/packet edits in the CI path, rather than trusting a self-reported SHA. SHA-256 still does not authenticate a producer.

Added regressions cover resealed stake changes, extra graph messages, source SHA, sender mapping, missing-coverage metadata, extra elevated claims and order-independent selection. The packet and census envelopes gain additive graph-binding metadata; historical artifacts are preserved, while the strengthened verifier requires newly generated bound inputs. These are integrity/representation checks, not Rust or ingress results.
