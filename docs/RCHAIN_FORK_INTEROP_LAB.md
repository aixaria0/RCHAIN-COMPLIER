# RChain fork drift evidence — first interoperability slice

This independent tool inventories the **revision relationship** between the RChain community Rust node and named forks. It makes no claim that one implementation is better, faster or more secure. No fork source code is copied.

## Reproduce

```sh
python3 tools/cbc_fork_drift.py --output fork-drift.json
python3 -m unittest discover -s tests/fork_drift -p 'test_*.py' -v
```

The CLI queries GitHub's public commit and compare APIs. Set `GITHUB_TOKEN` for higher rate limits. The report contains both exact tip SHAs, exact merge-base SHA, fork-only and upstream-only commit counts, the compare URL, and a SHA-256 fingerprint of the canonical sorted JSON payload. The digest is a reproducibility identifier, **not** a cryptographic attestation of GitHub data.

**Comparison direction matters:** `upstream/dev...owner:dev` treats upstream as the base and fork as the head. Therefore `ahead_by` is fork-only history, while `behind_by` is upstream-only history. Never call the reverse-direction `ahead_by` value fork-only commits.

## Why it exists

A future comparative CBC conformance lab must first establish which executable source revisions were tested. GitHub popularity, README assertions, recency and an unpinned benchmark cannot establish consensus correctness. This first slice only locks revision ancestry and output provenance.

## Next acceptance gates

1. Pin dependency/toolchain lockfiles and exact upstream integration revisions for each target.
2. Execute **identical, reachable** CBC scenario fixtures against each selected Rust implementation revision in isolated CI jobs. Capture process exit, protocol observations, errors and machine-readable traces.
3. Cross-check evidence with Sentinel's *node-reported* observations, maintaining a clear boundary from independent stake-weighted finality proof.
4. Emit a differential matrix and minimized replay bundle; classify any mismatch by independently reproduced source behavior rather than calling it a network exploit.
5. Integrate a user-facing view in RLSenti **only after** a real adapter replaces synthetic data; do not silently relabel demo fixtures as live evidence.

The separately reviewed Casper CBC deliverable in PR #16 is intentionally unchanged by this branch. A revision-drift report is not itself an upstream bug report or a replacement RChain node.
