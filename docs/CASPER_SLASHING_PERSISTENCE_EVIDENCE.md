# Casper slashing: persisted-state differential (research checkpoint)

## Request and scope
Patrick requested that the detective work focus on **our own Casper consensus**, particularly historical slashing criteria affecting validators and operators. This checkpoint inspects the **current Rust port** first. It does not exercise an external chain or claim a deployed exploit. The existing four-repo evidence layer and PR #16/#17 are untouched.

Pinned source: `rchain-community/rchain-rust@dfdce49473f452a9e968c33e7569014d597b2866` (`dev` on inspection).

## Source-level hypothesis (not a demonstrated live-network failure)

At `rholang/src/native_state.rs`:
- `withdraw` persists `pendingWithdrawers` via `set_pending_withdrawers`.
- `slash` loads `pending_withdrawers`, removes the validator **from a local map**, then persists only bonds, active and withdrawers; the pending map is not written. A staged request may remain in the underlying store until `close_block` clears it.
- `slash` also never clears `pos:committed`, although the legacy `Pos.rhox` slashing state update explicitly deletes `committedRewards[validator]`. The native withdrawal payment reads `committed` at payment time. This is a potential economic-accounting discrepancy requiring isolated test coverage. It is **not** evidence of an exploitable fund transfer until complete valid lifecycle replay.
- `untrust` calls the same `slash` method for bonded targets, so it inherits this state mutation path.

Slashing trigger in `casper/src/blocks/proposer/proposer.rs`: the proposer collects senders of validation-failed justifications and intersects them with the **pre-state bonded** set before creating slash system deploys. This mirrors the vendored Scala `legacy/.../Proposer.scala`; it is not an automatic penalty for all forms of missing participation. Confirm upstream admission/validation behavior before labeling a block invalid or slashable.

## Reproduction protocol

The workflow injects two tests **only into an ephemeral pinned upstream test module**, then runs:
1. Baseline: both independent assertions must fail with their precise sentinel messages. A passing baseline fails the evidence job closed.
2. Counterfactual: insert only the missing local persistence and committed-rewards cleanup in the ephemeral checkout. Both assertions and the existing slash-confiscation control must pass.
3. Upload the baseline log. A green workflow therefore means **reproduced divergence + passing isolated counterfactual**, not “unmodified upstream tests pass.”

This workflow does not change upstream production code in GitHub, does not write to PR #16/#17, and makes no real validator transactions.

## Necessary follow-up before an upstream issue/PR or severity claim

Re-run on current upstream HEAD; include a full play/replay system-deploy scenario, concurrent-slash vs withdrawal timing, re-bonding and claim expiry, exact validator-set effect, and conservation of REV. Separate (a) a stale pending-request state shape, (b) an un-cleared committed claim, and (c) a proven fund movement. Historical mainnet slashing policy cannot be inferred from the present code alone. Request maintainer review of expected semantics before proposing changes to slash economics.
