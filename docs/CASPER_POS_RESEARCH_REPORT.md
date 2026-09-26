# Casper PoS research update: pending withdrawal and real devnet baseline

**Scope:** bounded review of the Rust implementation, with exact source pins and
separate native, runtime, signed-ingress and network observations. Prepared for
a maintainer update on 2026-09-25. PR #17 remains draft; PR #16 is unchanged.

## Why this matters

The Rust PoS implementation documents cancellation of a validator's staged
withdrawal during `slash`. In the actual storage path, it removes the entry
from an in-memory map but does not persist that modified map. This leaves
withdrawal state behind. A deterministic native regression demonstrates that
the stale state can affect a later bond before the next epoch boundary. A
one-line research candidate eliminates the observed behavior, subject to a
protocol-policy decision. The benefit of a reviewed correction is to align
stored PoS state with the explicitly documented cancellation policy and protect
a newly accepted bond from inheriting an earlier withdrawal request.

## Reproducible evidence and boundaries

| Boundary | Exact observation | Provenance and limit |
| --- | --- | --- |
| Native PoS storage | At upstream [`0ac5498`](https://github.com/rchain-community/rchain-rust/commit/0ac5498fe246ea8a901c9e5277383f672ed9635d), the original implementation passed 3 controls and failed 2 documented-policy assertions. After `slash`, 9/9 test configurations retained the staged withdrawal. A later bond of 30 REV was withdrawn at the epoch boundary, became a claim and was returned at its deadline; tracked REV was conserved. | [Native CI and exact sources](https://github.com/aixaria0/RCHAIN-COMPLIER/actions/runs/36043123111); artifact `cbc-native-slashing-lifecycle`, SHA-256 `4b32e3c9ed93c29debae32cedd8ae98e554875ce6d876e7efd0f04b29258a898`. In-process native tests, not signed consensus. |
| Focused candidate | Adding the missing persistence call to the *temporary test checkout* made all 5 tests pass, and 0/9 configurations retained pending state. The candidate was restored after the run and has **not** been applied to production. | Same run and artifact. This is a conditional remediation experiment, not a consensus decision. |
| Actual Casper runtime | `RuntimeManager` play/replay agreed at the tested heights 5, 6, 7 and 10 while reflecting pending state before the epoch and a claim on the new bond afterward. | `casper-runtime.json` and raw Rust output in the same artifact. No signed ingress or peer finality in this test. |
| Signed ingress on old pin | Signed `address`, `withdraw`, `untrust`, `retrust`, and `rebond` operations were processed on the bootstrap. A peer proposed a block, then the follower encountered the known genesis replay mismatch. | [Run 36047814286](https://github.com/aixaria0/RCHAIN-COMPLIER/actions/runs/36047814286). `untrust` is governance revocation that invokes native `slash`; this run is **not** evidence of consensus-triggered punishment or finalized withdrawal. |
| Ordinary two-validator network | The upstream genesis fix at [`11b2200`](https://github.com/rchain-community/rchain-rust/commit/11b2200dcca580f2c00246302238840dcd4f08f6) allowed two connected validators to exchange 6 ordinary blocks and independently confirm the same finalized block #2. This passed twice, with 80/20 stake and current-timestamp signed `Nil` dev deploys. | [Run 36094971145, attempt 1](https://github.com/aixaria0/RCHAIN-COMPLIER/actions/runs/36094971145/artifacts/10846922754) and [run 36096318509](https://github.com/aixaria0/RCHAIN-COMPLIER/actions/runs/36096318509/artifacts/10846948382). Both artifact ZIP digests and all 97 individual file hashes in each were verified. This is normal sync/finality, not finalized slashing. |

The two successful normal-network runs finalized block #2 with **the same
post-state hash** `d06645fabf110cf7a5f51b99ad4893a265496d838a3d51197bcbb4468c92048d`.
Their block hashes differed because the upstream dev-mode signed keepalive uses
the current timestamp. Within each run both nodes agreed on block hash,
post-state hash and finality; each also reached tip height 7. The exact hashes,
CI corrections and intermediate failures are recorded in the
[devnet evidence checkpoint](CBC_DEVNET_SYNC_CHECKPOINT.md).

## Source diagnosis and policy decision

### Additional candidate validation, 2026-09-25

At upstream `11b2200dcca580f2c00246302238840dcd4f08f6`, the conditional
persistence candidate passed **41 tests, with zero failed or ignored** in
[run 36129888945](https://github.com/aixaria0/RCHAIN-COMPLIER/actions/runs/36129888945):
32 existing native-state unit tests, one new checkpoint/restore regression,
seven existing Casper determinism tests, and one existing runtime-restart test.
Harness commit: `f05490125e479f30a1145fa23cfbeb6ec1452443`.

The new regression applies the corrected native transition to a committed
two-validator fixture. It verifies that cancellation survives fresh-runtime
restore, the other validator's pending request and bond are preserved, staking
and Coop balances account for the transfer, repeated removal changes no root,
two independent executions from the same root agree, and the old root remains
readable with its original pending map. It uses the real Casper runtime and
native storage implementation with an in-memory history repository.

The [artifact](https://github.com/aixaria0/RCHAIN-COMPLIER/actions/runs/36129888945/artifacts/10861436990)
ZIP SHA-256 is `fe2fee8062df096478e5f12aaa9a5cb5d09486d02504e27ebbba56495d791daa`;
the downloaded ZIP and all seven files in its manifest were independently
verified. Its exact candidate source digest matches the earlier native
experiment, and `report.json` confirms restoration of the original source.

### Targeted Casper replay validation, 2026-09-25

The next [run 36130977848](https://github.com/aixaria0/RCHAIN-COMPLIER/actions/runs/36130977848)
at harness commit `3fa0412f37b513e17d9b35ad51d4ed2d46e68cef` extended the
focused test through `RuntimeManager::compute_state` with the supplied slash
system deploy and `replay_compute_state` with its recorded result. The played
and replayed roots matched. Reads from the replayed root confirmed cancellation,
preservation of the other pending entry, and the expected staking/Coop balances.
An empty-operation control produced a different root. All **41 tests passed
again**, with zero failed or ignored; the expanded assertions are within the
same focused test, not an additional test count.

The downloaded [artifact](https://github.com/aixaria0/RCHAIN-COMPLIER/actions/runs/36130977848/artifacts/10860824771)
matched ZIP SHA-256 `f0537cf6fbd98e3099f82b3915d232330b2fc3b7e61bad3113b42dea057698f1`.
All seven manifest file hashes were verified, and the archived Rust fixture
matched the submitted fixture. Original source restoration was confirmed.

**Boundary:** this validates execution/replay of a supplied system deploy under
the candidate, not the consensus decision to select it or signed peer finality.
Fresh-runtime restore in one process is not an OS restart or a disk-durability
result. See the [test scope](../tests/pos_review/README.md). The finding and
conditional repair are ready for maintainer review; protocol acceptance and
network-impact validation remain open.

### Persisted-state mismatch

In [`rholang/src/native_state.rs`](https://github.com/rchain-community/rchain-rust/blob/0ac5498fe246ea8a901c9e5277383f672ed9635d/rholang/src/native_state.rs),
`NativeSystemState::slash` reads `pending_withdrawers`, removes the validator
from that local map, then persists the updated bond, active and claim maps;
it never calls `set_pending_withdrawers` with the updated map. This is the
specific stored-state inconsistency the focused candidate tests.

The exact `native_state.rs` blob SHA is
`8203db21a128600b7762a20bd36fee5d9d7c3c18` at the tested old pin,
the fixed-network pin and upstream `dev` at
`ff0955ed4c8fff9151a871142e10ef164882fa58` on 2026-09-25.
That identical file supports continued source identity; the native lifecycle
test has **not** been rerun against the whole newer workspace.

The bundled [`Pos.rhox`](https://github.com/rchain-community/rchain-rust/blob/0ac5498fe246ea8a901c9e5277383f672ed9635d/legacy/casper/src/main/resources/Pos.rhox)
preserves the pending map during slash. The upstream
[`spec/AUDIT.md`](https://github.com/rchain-community/rchain-rust/blob/11b2200dcca580f2c00246302238840dcd4f08f6/spec/AUDIT.md)
explicitly records the Rust port's **intentional** cancellation difference and
states the payable outcome is identical when the old bond is zero. The native
regression shows why that equivalence needs a condition: if a new bond is
accepted before the epoch boundary, the old request can affect it. This does
not establish what policy the network *should* adopt. Maintainers should
confirm the intended rule for that transition before promoting the candidate
into consensus code.

## Actionable handoff

1. Confirm whether the documented Rust cancellation policy governs the
   slash → new-bond transition. If it does, persist the updated pending map
   in the same PoS transition as the other updates and retain the native controls
   for value conservation, ordinary withdrawal and repeated slash.
2. Review epoch/rebond semantics against the chosen protocol rule, then add
   a regression gate at the appropriate integration boundary. Keep governance
   revocation, consensus-invalid-block selection and network finality distinct.
3. Use the corrected, pinned two-validator network as an operational baseline
   for later *authorized* validation. Upstream already identified the C46
   genesis issue and supplied its repair; this research contributes the
   independent two-validator observation, not credit for that fix.

**Claims deliberately left open:** production consensus impact, historical
mainnet exposure, consensus-evidence-induced slashing, a finalized signed PoS
withdrawal, and a universal refinement theorem. The older green signed CI run
([#33](https://github.com/aixaria0/RCHAIN-COMPLIER/actions/runs/36033265854))
did not enforce a finalized outcome; the later old-pin signed run stopped at
genesis replay. Neither is evidence for those claims. The four-implementation
Finalizer/Lean conformance work remains in [draft PR #17](https://github.com/aixaria0/RCHAIN-COMPLIER/pull/17)
and is a separate result.
