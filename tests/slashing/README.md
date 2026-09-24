# Native Casper slashing: withdrawal lifecycle

Reproduction: [CI run 35997602746](https://github.com/aixaria0/RCHAIN-COMPLIER/actions/runs/35997602746) on `rchain-community/rchain-rust` commit `0ac5498fe246ea8a901c9e5277383f672ed9635d`. Download the `cbc-native-slashing-lifecycle` artifact for the exact original source, temporary candidate, Rust test, Cargo lockfile, stdout/stderr and hash manifest.

The unmodified native PoS implementation passes three control tests and fails two contractual assertions. Calling `withdraw`, then `slash`, leaves the old request in `pending_withdrawers` (nine of nine parameterized checks). If that validator bonds again before the next epoch boundary, `close_block` converts the old request into a claim on the **new** 30 REV bond; the validator is removed from the pool at block 10 and receives 30 REV at block 30. Total tracked REV is conserved, and a repeated slash does not transfer the original stake twice.

A temporary, one-line experiment persists the pending map after `slash` removes the entry. On that variant all five tests pass: the new 30 REV stake stays bonded at the boundary. The runner restores the original source after testing. This experiment is **not** a consensus patch or a recommendation to change network behavior without review.

Consensus question: `Pos.rhox` leaves a slashed validator's pending entry present, whereas the Rust source comment and `spec/AUDIT.md` say the port cancels it. The epoch transition has a separate rule to discard a pending entry when no matching bond exists. Decide what should happen when a slashed validator is allowed to bond again before that transition, and confirm the intended Scala behavior, before applying a fix. The test exercises native state methods, not signed deploy ingress, proposer integration or a live network.

## Casper runtime execution

[CI run 36003518764](https://github.com/aixaria0/RCHAIN-COMPLIER/actions/runs/36003518764) adds a second reproduction on the unmodified Rust source. It runs `compute_genesis`, executes Rholang `withdraw` at block 5 and `bond` at block 7 through Casper `compute_state`, calls the actual `Slash` and `CloseBlock` system deploys, and replays each block with `replay_compute_state`. The four original/replay state hashes match. At block 6, `pending=true` and `bonded=false`; at block 7, both are true; at block 10, `pending=false`, `bonded=false`, `claim=30`. The uploaded artifact contains complete Cargo output and a hash manifest.

This confirms the behavior in real Casper runtime execution and validation replay. The fixture enters after network signature checking and constructs the `Slash` system deploy directly; it does not establish that a running proposer produces the same sequence from invalid-block evidence. That network boundary remains untested.

## Signed devnet attempt: finality gate

[Run 36033265854](https://github.com/aixaria0/RCHAIN-COMPLIER/actions/runs/36033265854) executed the withdraw → untrust/slash → trust → rebond sequence through signed deploys on a throwaway Docker devnet, but it did **not** establish the withdrawal effect: the node tip reached block 31 while /api/last-finalized-block remained at block 3, below the block-30 withdrawal deadline. Its target_bonded=true observation came from state that had not finalized the relevant epoch transition. Treat that run as an executed but inconclusive ingress test, not as proof that fresh stake was captured.

The runner now waits up to 120 seconds for finality to reach the withdrawal deadline, records both node logs and final devnet status, and exits non-zero with INCONCLUSIVE_FINALITY_LAG if the gate is not met. It only evaluates bond-status after that finalized-state gate. A green run must reach the deadline and show the target no longer bonded; otherwise it is either inconclusive or the predicted effect was not reproduced.
