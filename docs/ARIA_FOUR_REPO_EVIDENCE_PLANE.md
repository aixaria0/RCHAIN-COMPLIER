# Aria Four-Repository Evidence Plane

## Objective

Turn four separate codebases into a **measurable, revision-pinned integration platform**. This first executable slice runs *real tests in each codebase* from exact immutable commits and emits one verifiable evidence bundle. It does **not** yet connect their internal runtimes, compare equivalent Casper implementations, prove protocol safety, or outperform the RChain node.

### Components and exact integration in this slice

| Component | Pinned source | Executed code | Evidence scope |
| --- | --- | --- | --- |
| [RCHAIN-COMPLIER](https://github.com/aixaria0/RCHAIN-COMPLIER) | `2d2c3d879b1a078693c8551385efb54a811d7172` (read-only PR #16 HEAD) | CBC simulator + M26 upstream-anchored replay + M27 bounded witness search tests | Synthetic CBC scenarios, observed pinned-revision semantics, bounded minimal-witness regression; **not** live network evidence |
| [rlsenti](https://github.com/aixaria0/rlsenti) | `00e1ed1b30a1779f72c59c0505467da60080a365` | `src/lib/compiler/compiler.test.ts` | Deterministic execution, provenance, adversarial mutation model |
| [Sovereign-Lattice](https://github.com/aixaria0/Sovereign-Lattice) | `03259325d33a89e523b0ba83d55dd32f42ae4101` (Sovereign-Lattice draft PR #1) | Full Rust test suite and evidence-bound offline PBFT control | Independent PBFT topology, quorum and malformed-frame experiment correlated to the same witness digest; **not** Casper CBC finality |
| [rchain-sentinel](https://github.com/aixaria0/rchain-sentinel) | `7823bac56f8dd845d9b9f9e7c50982b49decdcc2` (Sentinel draft PR #1) | Backend full Cargo tests + offline external M27 witness inspector | RNode-style evidence inventory + independent transport/shape observer; **not** independent stake-weighted finality |

Each CI matrix worker checks out the **actual corresponding source repository** at the exact SHA, executes the named test with Node or Cargo, hashes its full stdout/stderr, and records the test command, source identity and exit code. The Rust repositories currently ship lockfiles that fail Cargo's `--locked` check on the selected runner; their tests are therefore allowed to resolve dependencies. The tool preserves both original and effective `Cargo.lock` bytes and hashes, and records whether resolution modified the checkout. This is **source-revision pinning with dependency-graph provenance**, not a fully frozen reproducible binary. Freeze/audit effective lockfiles before making reproducible-build or performance claims. The separate bundler checks all four entries are present, successful, at the expected commits, and have matching log bytes before publishing `four-repo-bundle.json`. A failed worker cannot become a four-of-four PASS report.

The canonical SHA-256 identifies the bytes in each record; it is **not a digital signature** or a claim of trusted hardware attestation. GitHub Actions and GitHub-hosted artifact retention provide the run context. Pinned commits can become obsolete: update pins intentionally, then rerun all four.

## Open the actual evidence dashboard\n\nIn the completed GitHub Actions run **Aria four-repository source evidence**, download the `four-repo-bundle` artifact and open `four-repo-dashboard.html` locally (tablet browser supported). The HTML is generated **only after** all four pinned source tests and evidence integrity checks pass. It displays each source/test scope, exact SHA, output fingerprints and Cargo dependency-lock status. Keep `four-repo-bundle.json` and the four `component-*` artifacts with the dashboard to audit underlying logs. This is a static CI report, not a live network dashboard or cross-protocol compatibility result.\n\n## Proven three-source transport on actual source code

The `cbc-workbench-bridge` CI job checks out three independent source trees at **exact commit SHAs** and runs an actual data transfer:

```text
RCHAIN-COMPLIER @ 2d2c3d879b1a078693c8551385efb54a811d7172
  runM27ReachabilityConstrainedSearch() -> source-reported M27 report
                                    |
                          canonical SHA-256 envelope
                                    |
             +----------------------+-------------------+
             |                                          |
rlsenti @ 46a38c443e5904d7d485519d8ea348a442c010c1
receiveCbcWitness() -> provenance receipt       rchain-sentinel @
             |                                   7823bac56f8dd845d9b9f9e7c50982b49decdcc2
             |                                 Rust cbc_witness_inspect CLI
             +----------------------+-------------------+
                                    |
           verify_cbc_sentinel_bridge.mjs compares
           transport digest, source pin, report digest,
           exact four-entry witness and explicit claim flags.
```

This job **passes the same actual M27 JSON bytes** to both independent consumers. It fails on a missing or mismatched revision, mutated witness, mismatched receipt, inconsistent sender mapping, or elevated finality claim. The Rust dependency-lockfile source and effective bytes are preserved alongside the transport artifacts.

From Actions, download the `cbc-workbench-bridge` artifact to inspect `cbc-m27-witness.json`, `rlsenti-witness-receipt.json`, `sentinel-witness-observation.json`, `cbc-three-source-transport.json`, and the two Sentinel Cargo lockfile snapshots. The `four-repo-bundle` artifact includes the three-source manifest along with its separate four-component source-test record and offline dashboard.

**This is actual external-data interoperability among CBC / RLSenti / Sentinel on an offline source-reported witness.** It is not authentication of the report producer, proof that a deployed network generated the witness, independent finality verification, or a live RNode adapter. Sovereign-Lattice is the fourth source under a separate PBFT control test; no CBC witness is incorrectly interpreted as a PBFT certificate.

## Proven four-source correlation without cross-protocol conflation

Sovereign-Lattice's actual Rust `pbft_external_control` binary now receives the **same M27 transport digest and sender labels** after RLSenti and Sentinel have independently inspected the imported witness. It invokes the real `PbftState::new` topology/registry checks and `PbftMessage::from_bytes` malformed-frame checks. A fourth receipt records the exact Sovereign-Lattice source SHA, observed PBFT control results, the original/effective dependency-lockfile hashes, and an explicit `cbcFinalityVerified: false` / `pbftCertificateVerified: false` / `liveNetwork: false` boundary. The source is also independently executed in the four-way test matrix.

The final bundle job requires both the **four successful actual source test records** and the **M27 → RLSenti → Sentinel → Sovereign-Lattice evidence handoff** to pass, and emits `four-repo-integration.json`. Negative tests reject missing fourth-source execution, altered PBFT results and re-sealed source-pin substitutions. The PBFT receiver uses CBC participant labels as metadata for its own independent experiment, never as imported PBFT votes or certificates. This is real four-source integration **at the evidence plane**, not four interoperating live consensus engines or a CBC vulnerability proof.

Download the `cbc-workbench-bridge` artifact to inspect `cbc-four-repo-handoff.json` and `lattice-pbft-control.json`; the final `four-repo-bundle` includes `four-repo-integration.json` plus the source-test dashboard and original evidence references.

## Current architecture / next end-to-end integration

```text
RCHAIN-COMPLIER CBC scenario + upstream witness    [real code; synthetic fixture]
          |
          v
typed, revision-pinned witness envelope             [DONE: offline v1 transport]
          |
          +----> RLSenti receipt from real witness  [DONE: integrity-only adapter]
          |
          +----> Sentinel offline witness inspector [DONE: integrity-only adapter; live RNode NEXT]
          |
          +----> Sovereign-Lattice PBFT control      [DONE: separate PBFT control correlated by digest]
          |
          v
four-source CI + four-source evidence handoff        [COMPLETE; live-node adapter and same-protocol conformance NEXT]
```

Sovereign-Lattice operates a different PBFT protocol. Its role is an independent, clearly labelled BFT *control experiment*, never a Casper finality oracle. RLSenti's demo/compiler output must be labelled synthetic unless real adapter data is supplied. Sentinel reports node-provided claims and evidence; its 2/3 node-count agreement must not be confused with Casper's stake-weighted finality.

## Reproduce / verify

```bash
python3 -m unittest discover -s tests/fork_drift -p 'test_*.py' -v
# GitHub Actions > Aria four-repository source evidence > run workflow
# Download the four-repo-bundle artifact and verify against component artifacts:
python3 tools/four_repo_evidence.py combine --input-dir evidence --output four-repo-bundle.json
```

Local `capture` only works in the corresponding repository checked out at the exact pin:

```bash
python3 tools/four_repo_evidence.py capture --component cbc --source-dir source --out-dir evidence
```

Use the published Actions run for the exact source checkouts and execution; do not confuse the offline mocked contract tests with execution of the other three repositories.

## Acceptance gates before any comparative performance or implementation claims

1. **Four-source CI:** all four actual test scopes run at pinned commits; bundle checks missing/failed/forged log and wrong-SHA conditions. Current slice.
2. **Typed interoperability:** versioned v1 M27 witness transport is executed by RLSenti and Sentinel's **offline** inspector; the next boundary is a deployed, authenticated source and an independently fetched real Sentinel node observation. No fabricated live endpoints.
3. **Identical CBC scenario:** pin supported RChain forks and run the *same* reachable fixture through their real relevant implementation paths, with failures and limitations captured; compare semantics only between actually equivalent protocol paths. The existing PBFT engine is not part of a same-protocol correctness ranking.
4. **Independent verification:** emit replay trace, smallest witness, revision-aware differential, error localization, and cross-node observation; explicitly separate established upstream behavior from synthetic projections.
5. **Measured engineering advantage:** predeclare workload, hardware, samples and baseline for each measurable target (replay reproducibility, CI diagnosis time, detection precision, throughput/latency/resource use). Publish full raw measurements including regressions and no-result runs before claiming an improvement. An independent test or maintainer review must validate any proposed upstream fix.

### Review isolation

This work lives in independent draft PR #17. Patrick-facing Casper CBC evidence PR #16 stays unchanged and should not be merged, rebased or rewritten as a side-effect of this integration.
