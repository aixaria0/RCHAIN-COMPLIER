# First semantic divergence: selected M27 tuple vs actual Rust Finalizer identity set

## Verified finding — exact original source and four real implementations

The first minimum-distance, source-reported finalizing M27 candidate exported from the read-only PR #16 source commit `2d2c3d879b1a078693c8551385efb54a811d7172` contains:

```text
ordered model candidate: a3, a3, c3, d3
reported sender labels: v0, v0, v2, v3
ordered tuple entries: 4
unique message IDs: 3
```

M27's search enumerates ordered four-entry arrays **with replacement** from `a3,b3,c3,d3`. By contrast, each examined real Rust `Finalizer::calculate_finalization` signature takes `BTreeSet<Message<...>>`. The selected candidate's second `a3` is the **same message identity**, not a different v0 message.

A temporary **identical Rust test** in the actual Finalizer source of each pinned version converts those exact ID/sender pairs to the implementation's `BTreeSet<Message>`, then invokes its `check_min_messages` and `calculate_next_layer`. It does not replace or monkey-patch Finalizer behavior. The successful [four-target ID audit run #35795547275](https://github.com/aixaria0/RCHAIN-COMPLIER/actions/runs/35795547275) recorded:

| Implementation | Ordered entries | Actual unique IDs | Four-distinct-ID representation | Actual post-set four-entry count gate |
| --- | ---: | ---: | --- | --- |
| rchain-community/rchain-rust | 4 | 3 | false | false |
| Shplarggle/rchain-rust | 4 | 3 | false | false |
| nzpr/rchain-rust | 4 | 3 | false | false |
| Bill-Kunj/rchain-rust | 4 | 3 | false | false |

**First observed mismatch:** the model's ordered tuple count is four, while the actual implementation's input identity set has three entries. For this **specific selected candidate**, the modeled four-entry count-gate/finality result cannot be directly replayed as four distinct justifications at the genuine Rust Finalizer entry boundary. The M27 source-level search result remains a reproducible result of that model; **it is not yet an established four-unique-ID upstream witness**.

This finding does **not** show that the underlying count-only `check_min_messages` code is repaired, that the real implementation is immune to duplicate-*sender* inputs from **different message IDs**, or that the protocol is safe or unsafe. It does **not** establish live RNode ingress, deployed-network exploitation or conflicting finality.

## Distinguish three separate pieces of evidence

1. The **first M27-selected ordered tuple** repeats the exact `a3` ID and fails the four-unique-message representation gate. This page and `cbc-m27-first-semantic-divergence.json` establish only this specific semantic boundary.
2. The separately executed **original M11.5 multi-layer DAG test** uses **different message IDs** for the two v0 messages. Its source-level Finalizer test passed independently on all four pinned versions, including its hand-constructed local fringe assertion. It is not the first M27 candidate and does not alone prove wire ingress or a deployed-network exploit.
3. The earlier **reduced M27 sender-shape gate test** created four *new, distinct* local message IDs with the same four sender labels. It showed count-only acceptance and no fringe in its simplified DAG. Because it substituted distinct local IDs, it cannot prove that the exact repeated-ID M27 tuple is realizable.

## Next acceptance gate, now unambiguous

Create a source-derived, **four-distinct-message-ID** witness with two messages from the same bonded sender and a missing fourth sender, with the **complete causal parent graph** and valid sender sequence/history. Pin the complete bytes and replay them through actual Rust Finalizer and real block/ingress validation paths. Separate the current count gate from a **counterfactual** distinct-bonded-sender coverage check; epoch transitions, bonded-set changes, and accepted-spec semantics require independent review. Only report finality, security, remediation, and performance effects that those real tests actually establish.

The current four-implementation audit is implemented in `tools/cbc_m27_identity_audit.py`, `tools/cbc_m27_identity_compare.py`, and `scripts/upstream/cbc-m27-unique-id-realizability-probe.rs`. All four exact source snapshots, the identical injected test, raw logs, and source/effective Cargo locks are retained; missing or forged evidence fails the aggregator. The comparison workflow also renders the first divergence in its offline HTML dashboard.

## Workbench-design insight from the uploaded workspace ZIP

The uploaded Workbench shows a *first-divergence* comparison and separates evidence basis from what is **not claimed**. We reused this **design principle**, not its platform-specific authentication, connector services, or pre-generated synthetic RNode observations. The identity audit above is generated and verified from actual GitHub Actions executions and real Rust source snapshots; it is not imported as a synthetic status from the ZIP.

PR #16 remains read-only and unchanged pending Patrick's review. This cross-implementation scope and corrected evidence boundary live in separate draft PR #17.
