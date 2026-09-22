# Four-Rust-implementation CBC admission-gate differential

This is the next measured gate after the four-source Aria Evidence Plane. Its target is **four Rust implementations of the same RChain Finalizer path**, not a relative ranking of maintainers or projects.

## Immutable source matrix

| Target label | Repository | Pinned dev commit |
| --- | --- | --- |
| community | [rchain-community/rchain-rust](https://github.com/rchain-community/rchain-rust) | `7b986ee48cc1c0c09e21543c8ef01f84114d73b6` |
| shplarggle | [Shplarggle/rchain-rust](https://github.com/Shplarggle/rchain-rust) | `1470256ecd9d1ce3926754c321f5703ef8f95e1a` |
| nzpr | [nzpr/rchain-rust](https://github.com/nzpr/rchain-rust) | `0eabfc4a893bc42d1462f05ebb4bb477eabd0ee1` |
| bill_kunj | [Bill-Kunj/rchain-rust](https://github.com/Bill-Kunj/rchain-rust) | `9e667e203861c791aa9349b0351397ccc29f0fc8` |

Pins are historical snapshots, **not promises about current heads**. The upstream revision from the separate M27 report (`d92f078...`) is recorded as its fixture's origin; it is **not** one of these four current-dev implementation pins. This distinction prevents accidentally conflating an earlier upstream law-level characterization with a live/current implementation claim.

## Exactly identical fixture and test source

1. Independently check out the read-only `RCHAIN-COMPLIER` PR #16 commit `2d2c3d879b1a078693c8551385efb54a811d7172`. Run its **real** bounded M27 witness search, select the first minimum-distance finalizing-under-cardinality candidate, validate its source-reported properties, and serialize one content-hashed transport file.
2. Each Rust job downloads **that one unchanged artifact**. The same temporary Rust test source (`scripts/upstream/cbc-four-fork-minimum-sender-probe.rs`) is appended only to its own disposable checkout's `block-storage/src/dag/finalizer.rs`. Original source SHA-256, exact injected test SHA-256 and test-effective source SHA-256 are retained. The upstream GitHub repositories themselves are **never written to**.
3. The test constructs four distinct local message IDs with the M27-reported sender labels (three distinct bonded senders) and bonded stakes 70/10/10/10, and a four-distinct-sender control. It calls each implementation's **actual** `Finalizer::check_min_messages`, `Finalizer::calculate_next_layer` and `Finalizer::calculate_finalization`. Raw Rust output records control/duplicate count-gate results, distinct-layer sizes and local fringe flags. It **does not assert** the duplicate-gate result in advance; any legitimate observed difference must appear in the report.
4. The fan-in validates **all four exact commits**, the one fixture digest, one test-source digest, four actual Rust observation markers, test exit codes, original and effective source and Cargo locks, full stdout/stderr hashes and recorded command. Missing/failed/tampered/foreign evidence blocks publishing.
5. The JSON report lists the actual output of every target per field, identifies observed identical or differing fields, and describes any count-vs-distinct sender mismatch **within each reduced fixture** without an overall score, ranking, exploit claim or presupposed winner.

## First four-source measured result

The successful four-target CI run [#35790959201](https://github.com/aixaria0/RCHAIN-COMPLIER/actions/runs/35790959201) executed the same generated input (`8bb58e8eb36af5f4b5c78e40dcfec0d27982f279b21bef461dea226b73decf79`) in the four pinned Rust checkout test targets. Its published comparison reported **zero observed differences among six bounded fields**:

| Source-level observation | community | shplarggle | nzpr | bill_kunj |
| --- | --- | --- | --- | --- |
| Control: count gate (4 entries / 4 senders) | true | true | true | true |
| Control: distinct next-layer senders | 4 | 4 | 4 | 4 |
| Control: new fringe in reduced local DAG | false | false | false | false |
| One-replacement case: count gate (4 entries / 3 senders) | true | true | true | true |
| One-replacement case: distinct next-layer senders | 3 | 3 | 3 | 3 |
| One-replacement case: new fringe in reduced local DAG | false | false | false | false |

This is a shared **count-only gate behavior under the specific reduced local test**; it is not a claim that any of these four snapshots finalized a conflicting block or even a new fringe in this fixture. There is **no observed comparative winner or implementation difference in these six fields**. Our demonstrable engineering output is the repeatable four-way differential and evidence provenance; any proposed sender-set coverage check remains a separately reviewed counterfactual, with epoch-change semantics and the complete M27 DAG requiring independent validation.

The workflow also publishes `cbc-four-implementation-differential.html` for offline, mobile-friendly inspection alongside the JSON, exact test source, raw logs and retained local source/lockfile snapshots.

## Second independent same-source test: original M11.5 constructed causal DAG

The successful four-way workflow run [#35792755741](https://github.com/aixaria0/RCHAIN-COMPLIER/actions/runs/35792755741) additionally checked out the **original read-only M11.5 Rust integration test** from `aixaria0/RCHAIN-COMPLIER@2d2c3d879b1a078693c8551385efb54a811d7172`, preserving its test-source SHA-256 `4f1a336988259a201940155fe28b067263cfd92743c491a4ed55635eae0faaa0`. The exact same source file, unmodified, ran on each of the four pinned Rust Finalizer implementations.

All four actual Rust test invocations **passed the original constructed multi-layer DAG assertions**: four minimum-message entries with two distinct messages from v0, only three represented bonded senders, acceptance by the tested count gate, a three-sender next layer and an advancing locally computed fringe. The four outputs are independently retained as `causal-*` artifacts and checked by a fail-closed aggregator; `cbc-four-implementation-causal-m11.json` is published alongside the first reduced-fixture comparison and the offline dashboard.

**Do not conflate the two experiments.** The first imports the first bounded M27 source-reported sender shape (`v0,v0,v2,v3`) into a *reduced four-message local DAG* and does **not** advance fringe. The second uses the separately authored **M11.5 multi-layer causal DAG** (two distinct v0 messages, v1 and v2 present, v3 absent) and its own fixture-specific fringe assertion. Passing M11.5 does **not** establish the exact first M27 candidate was replayed, that a live RNode accepted the constructed case, or that conflicting finality exists.

This adds a source-backed, multi-layer differential regression to the research evidence: all four tested snapshots exhibit the original M11.5 behavior, **not** an observed quality or security ranking among their maintainers.

## What this does — and does not — establish

The sender labels come from a source-reported **bounded M27 reachable/finalizing witness**, but the four-message, empty-parent **local DAG constructed for this comparison is not that causal DAG**. The imported sender *shape* can characterize an admission-gate behavior across four real codebases; it cannot transfer M27's finality conclusion, prove remote exploitability, or establish causality from partitions/equivocation. Even a positive `check_min_messages` result is not block-receiver ingress, full validation, finality, or protocol safety.

The four identical source probes do not measure speed, throughput, latency, resilience or an accepted upstream correction. They compare one precisely bounded behavior and preserve any compile/test failure rather than declaring a result for an untested target. The BFT controls in Sovereign-Lattice are on a distinct PBFT protocol and are not part of this same-CBC-implementation comparison.

## Review and reproduction

See `.github/workflows/cbc-four-implementation-differential.yml`, triggered by changes to the comparator/probe or manually via Actions. Download `cbc-comparison-fixture`, all four `target-*` evidence artifacts, and `cbc-four-implementation-differential`. The final artifact includes the same original input JSON, a full machine-readable four-target report, and the standalone `cbc-four-implementation-differential.html` evidence dashboard. Inspect raw logs and original/effective source snapshots for each target.

Offline integrity tests can be run without cloning four Rust repos:

```sh
python3 -m unittest discover -s tests/fork_drift -p test_cbc_cross_fork_compare.py -v
```

This work is isolated in draft PR #17. PR #16 remains read-only and unchanged; there is no merge/rebase of Patrick's deliverable.
