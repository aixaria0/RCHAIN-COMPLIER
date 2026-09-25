# Ordinary two-validator sync and finality

This isolated CI gate checks upstream genesis replay fix
[`11b2200dcca580f2c00246302238840dcd4f08f6`](https://github.com/rchain-community/rchain-rust/commit/11b2200dcca580f2c00246302238840dcd4f08f6)
on a fresh Docker devnet. It runs on branch `test/cbc-genesis-sync`.

The upstream node is built without Rust changes. The launcher adaptations are
recorded: unique Docker resource names, loopback host ports, readable genesis
files, whitespace-trimmed bootstrap identity, and an explicitly **80/20** bonded
stake distribution. Both nodes receive the same genesis bonds and funded wallet
configuration. This is one controlled topology, not a general finality result.

Autopropose is disabled. Each validator proposes in turn using the upstream
dev-mode signed `Nil` keepalive. Every proposed block must be retrieved with
identical metadata from the peer before the next proposal. At least two blocks
from each validator are required. Success additionally requires:

- both nodes report a connected peer;
- finality advances beyond the initial genesis height;
- the latest finalized height, block hash and post-state hash agree;
- both nodes explicitly report that common block as finalized.

Startup checks the identical genesis block in both nodes' height indexes. It
does not require a finalized fringe before allowing normal proposals. The first
[CI run](https://github.com/aixaria0/RCHAIN-COMPLIER/actions/runs/36092895016)
built successfully and both nodes reached Running, but the original harness
incorrectly required `/api/last-finalized-block` before producing any blocks.
The bootstrap returned `Finalized fringe is not available.`; that run did not
exercise the proposal/replay path. The startup gate is corrected, with a
regression check. Finality remains mandatory at the end.

The evidence gate rejects height-only progress, missing/ambiguous fields,
mismatched hashes and one-sided finality. `result.json` identifies the failed
phase; raw HTTP responses, command results, container logs, launcher diff,
image identity and SHA-256 manifest are retained even on failure. A build failure
retains its build log and never counts as network validation.

This test performs normal block production only. It does not establish any
slashing, withdrawal, adversarial consensus, old-mainnet or safety-theorem claim.
The earlier signed-devnet workflow and its original pin remain separate evidence.

Local prerequisites: Python 3, Docker, OpenSSL, curl, and a clean checkout at the
exact upstream pin. The GitHub workflow builds and runs the test automatically.

```sh
python3 -m unittest discover -s tests/devnet -p 'test_*.py' -v
export RNODE_IMAGE=rnode:genesis-11b2200
bash /path/to/pinned-rchain-rust/tools/devnet.sh build
python3 tests/devnet/sync_finality.py /path/to/pinned-rchain-rust /path/to/new-evidence
```
