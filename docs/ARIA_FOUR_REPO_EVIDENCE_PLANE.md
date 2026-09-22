# Aria Four-Repository Evidence Plane

## Objective

Turn four separate codebases into a **measurable, revision-pinned integration platform**. This first executable slice runs *real tests in each codebase* from exact immutable commits and emits one verifiable evidence bundle. It does **not** yet connect their internal runtimes, compare equivalent Casper implementations, prove protocol safety, or outperform the RChain node.

### Components and exact integration in this slice

| Component | Pinned source | Executed code | Evidence scope |
| --- | --- | --- | --- |
| [RCHAIN-COMPLIER](https://github.com/aixaria0/RCHAIN-COMPLIER) | `2d2c3d879b1a078693c8551385efb54a811d7172` (read-only PR #16 HEAD) | CBC simulator + M26 upstream-anchored replay + M27 bounded witness search tests | Synthetic CBC scenarios, observed pinned-revision semantics, bounded minimal-witness regression; **not** live network evidence |
| [rlsenti](https://github.com/aixaria0/rlsenti) | `00e1ed1b30a1779f72c59c0505467da60080a365` | `src/lib/compiler/compiler.test.ts` | Deterministic execution, provenance, adversarial mutation model |
| [Sovereign-Lattice](https://github.com/aixaria0/Sovereign-Lattice) | `e141e89e5ff158c0eba375448b8839bf7859fef5` | `rust_engine/tests/adversarial_scheduler.rs` | Independent PBFT input and quorum bounds; **not** RChain Casper CBC |
| [rchain-sentinel](https://github.com/aixaria0/rchain-sentinel) | `88250ff7ec2789a3c709c7e2991233e6dd244c4b` | `backend/src/casper_evidence.rs` tests | RNode-style Casper evidence inventory; **not** independent stake-weighted finality |

Each CI matrix worker checks out the **actual corresponding source repository** at the exact SHA, executes the named test with Node or Cargo, hashes its full stdout/stderr, and records the test command, source identity and exit code. The Rust repositories currently ship lockfiles that fail Cargo's `--locked` check on the selected runner; their tests are therefore allowed to resolve dependencies. The tool preserves both original and effective `Cargo.lock` bytes and hashes, and records whether resolution modified the checkout. This is **source-revision pinning with dependency-graph provenance**, not a fully frozen reproducible binary. Freeze/audit effective lockfiles before making reproducible-build or performance claims. The separate bundler checks all four entries are present, successful, at the expected commits, and have matching log bytes before publishing `four-repo-bundle.json`. A failed worker cannot become a four-of-four PASS report.

The canonical SHA-256 identifies the bytes in each record; it is **not a digital signature** or a claim of trusted hardware attestation. GitHub Actions and GitHub-hosted artifact retention provide the run context. Pinned commits can become obsolete: update pins intentionally, then rerun all four.

## Current architecture / next end-to-end integration

```text
RCHAIN-COMPLIER CBC scenario + upstream witness    [real code; synthetic fixture]
          |
          v
typed, revision-pinned witness envelope             [NEXT: schema and transport]
          |
          +----> RLSenti provenance + replay        [NEXT: real ingest adapter]
          |
          +----> Sentinel RNode observation         [NEXT: actual node-backed adapter]
          |
          +----> Sovereign-Lattice PBFT analysis     [NEXT: separate BFT control experiment]
          |
          v
source-level evidence, provenance, claim boundary    [first four-test CI slice COMPLETE]
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
2. **Typed interoperability:** define versioned CBC witness and provenance schemas; consume actual compiled witness data in RLSenti, and attach independently fetched Sentinel node observation where available. No fabricated live endpoints.
3. **Identical CBC scenario:** pin supported RChain forks and run the *same* reachable fixture through their real relevant implementation paths, with failures and limitations captured; compare semantics only between actually equivalent protocol paths. The existing PBFT engine is not part of a same-protocol correctness ranking.
4. **Independent verification:** emit replay trace, smallest witness, revision-aware differential, error localization, and cross-node observation; explicitly separate established upstream behavior from synthetic projections.
5. **Measured engineering advantage:** predeclare workload, hardware, samples and baseline for each measurable target (replay reproducibility, CI diagnosis time, detection precision, throughput/latency/resource use). Publish full raw measurements including regressions and no-result runs before claiming an improvement. An independent test or maintainer review must validate any proposed upstream fix.

### Review isolation

This work lives in independent draft PR #17. Patrick-facing Casper CBC evidence PR #16 stays unchanged and should not be merged, rebased or rewritten as a side-effect of this integration.
