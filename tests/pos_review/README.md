# Conditional PoS persistence review

This gate validates the persistence candidate only, in a temporary checkout of
upstream `11b2200dcca580f2c00246302238840dcd4f08f6`. The existing source file is
SHA-256 checked before the change and restored after execution.

The policy under test is the cancellation rule documented in upstream
`native_state.rs::slash` and `spec/AUDIT.md` section 6. Its adoption remains a
maintainer decision because it changes stored PoS state.

Checks:

- Existing native PoS unit controls, including accounting and ordinary withdrawal.
- A direct-state fixture in a real Casper runtime: cancellation survives a
  committed checkpoint and fresh runtime restore, another validator's pending
  entry remains intact, balances are conserved, repeated removal changes no root,
  and two independent applications from one root produce the same output root.
- Existing upstream Casper determinism and runtime-restart integration controls.
- The corrected transition through Casper `compute_state` and recorded
  system-deploy `replay_compute_state`: equal output roots, cancellation and
  accounting read from the replayed root, and a no-operation control producing a
  different root.

The fresh runtimes share an in-memory history repository; this is not an OS
restart or a disk-durability test. The fixture tests direct native persistence
and the supplied system-deploy execution/replay, but not the consensus decision
that selects that operation. The existing determinism tests cover their own operations only. No signed peer
ingress, consensus evidence selection, network finality, or rebond scenario is
exercised. The workflow's result is provisional until its raw logs are reviewed.

Relevant upstream specification: Laws 10/11 (stored roots and replay), 44/47
(membership timing and withdrawal staging), `spec/RUST-FIRST.md` (native overlay
and checkpoint mechanics), and the legacy `Pos.rhox` withdrawal/slash contract.
This fixture checks the documented Rust cancellation policy, not Scala equivalence
or a formal proof. Failed commands, zero executed tests, and ignored tests fail
the gate. Raw logs, the exact candidate diff, lockfile, fixture and hashes are
retained with `report.json`.
